import { getUserById, saveUserPosition, insertMessage, getRecentMessages, getUserStats, recordUserStats, getTopStats } from "./db.js";
import { normalizeAppearance, DEFAULT_APPEARANCE } from "./appearance.js";
import { WEAPONS, getWeapon, isCrystalWeapon } from "../public/js/weaponDefs.js";
import {
  INVENTORY_SLOTS,
  getFood,
  getThrowable,
  getLootItem,
  pickWeighted,
  rollCrystalType,
  FOODS,
  THROWABLES,
} from "../public/js/itemDefs.js";
import { getMapBoundary, getRoomMaps, MAP_LOOT_COUNTS } from "../public/js/mapDefs.js";
import { isInsideObstacle } from "../public/js/mapObstacles.js";
import { HUB_CODE, HUB_MAP_ID, HUB_SPAWN, HUB_PORTALS, nearestPortal } from "../public/js/hubDefs.js";
import { getMode, getModeVariant, modeRoomCode } from "../public/js/modeDefs.js";
import { createPairsGame } from "./modes/pairs.js";
import { createColiseoGame } from "./modes/coliseo.js";
import { createEsconditeGame } from "./modes/escondite.js";
import { createTntGame } from "./modes/tnt.js";
import {
  COLISEO_MAP_ID,
  coliseoClamp,
  getColiseoRadii,
  isColiseoWeapon,
} from "../public/js/coliseoDefs.js";
import { HIDE_MAP_ID } from "../public/js/hideDefs.js";
import { TNT_MAP_ID, TNT_TICK_MS } from "../public/js/tntDefs.js";
import {
  computeBlockedDamage,
  getBlockConfig,
  BLOCK_STAMINA_MAX,
} from "../public/js/combatMath.js";
import { damageAtRange, rayRadiusFor } from "../public/js/weaponMath.js";

const POSITION_SAVE_MS = 10000;
const MOVE_HISTORY_LIMIT = 50;
const MAX_HP = 100;
const SHOT_DAMAGE = 12;
const SHOT_RANGE = 14;
const RESPAWN_MS = 10000;
const LOBBY_CHANNEL = "lobby";
const MAX_ROOMS = 10;
const MAX_ROOM_MEMBERS = 8;
const MAX_LOBBY = 16;
// La isla es una zona social persistente: no cuenta como sala privada y tiene
// su propio aforo. Los modos viven en salas ocultas (una por modalidad).
const MAX_HUB_MEMBERS = 24;
const MODE_TICK_MS = 200;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ROOM_MAP_IDS = getRoomMaps().map((map) => map.id);
const CRYSTAL_PICKUP_RANGE = 1.6;
const CRYSTAL_OFFER_MS = 8000;
const CRYSTAL_RESPAWN_MIN_MS = 15000;
const CRYSTAL_RESPAWN_MAX_MS = 20000;

// ---- movimiento (Fase 4) ----
// Presupuesto anti-speed-hack: el servidor repone 13 m/s (el sprint real ronda
// 9,3 m/s, con margen para el lag) y recorta el exceso en vez de descartar el
// paquete, para no dar tirones. El rechazo duro de saltos > 2,5 m se conserva.
const MOVE_BUDGET_RATE = 13; // m/s
const MOVE_BUDGET_MAX = 2.5; // m
const MOVE_MAX_STEP = 2.5; // m

// ---- puntaje (Fase 3) ----
const SCORE_KILL = 100;
const SCORE_ASSIST = 40;
const SCORE_STREAK_2 = 25;
const SCORE_STREAK_3 = 50;
const ASSIST_WINDOW_MS = 6000;
const FARM_WINDOW_MS = 60000;
const FARM_FACTOR = 0.5;

// ---- hockey del lobby ----
const HOCKEY_TICK_MS = 50;
const HOCKEY_RINK_RADIUS = 16.2;
const HOCKEY_PUCK_RADIUS = 0.55;
const HOCKEY_PLAYER_RADIUS = 0.75;
const HOCKEY_WALL_R = HOCKEY_RINK_RADIUS - HOCKEY_PUCK_RADIUS;
const HOCKEY_PUSH_BASE = 4;
const HOCKEY_PUSH_SPEED_FACTOR = 0.85;
const HOCKEY_MAX_SPEED = 26;
const HOCKEY_FRICTION = 0.99;
const HOCKEY_WALL_RESTITUTION = 0.85;
const HOCKEY_GOAL_X = 14.2;
const HOCKEY_GOAL_HALF = 1.8;

const hockeyPuck = { x: 0, z: 0, vx: 0, vz: 0, touchId: null };
const hockeyScores = new Map();
const hockeyPrev = new Map();

const COLORS = [
  "#f87171", "#fb923c", "#facc15", "#4ade80", "#2dd4bf",
  "#60a5fa", "#a78bfa", "#f472b6", "#fbbf24", "#34d399",
];

const players = new Map();
const rooms = new Map();
// Controladores de minijuegos activos, indexados por id de modo.
const modeGames = new Map();
// TNT Run corre a 20 Hz (el resto de modos, a 5 Hz). Se guarda aparte para no
// llamar dos veces por tick al mismo controlador.
let tntController = null;

let io;
let throwSeq = 1;

function mapIdOf(player) {
  if (player.roomCode) {
    const room = rooms.get(player.roomCode);
    if (room) return room.mapId;
  }
  return "nevado";
}

function clampPosition(value, mapId = "nevado") {
  const limit = getMapBoundary(mapId) - 0.5;
  return Math.max(-limit, Math.min(limit, value));
}

function randomSeat() {
  const offset = 3 + Math.random() * 12;
  const angle = Math.random() * Math.PI * 2;
  return { x: Math.cos(angle) * offset, z: Math.sin(angle) * offset };
}

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// Punto de aparición libre de coberturas. Los mapas de sala tienen ahora 50-64
// obstáculos, así que heredar la posición del lobby podía dejar al jugador
// dentro de una caja o un árbol. Se busca en el anillo central (que el diseño
// PVP deja despejado) y se descarta cualquier punto ocupado. Primero se prueban
// anillos deterministas (funciona aunque Math.random esté stubeado en tests) y
// después posiciones aleatorias.
function clearRoomSpawn(mapId) {
  const bound = getMapBoundary(mapId);
  const maxRadius = Math.min(14, Math.max(6, bound - 8));
  for (let ring = 0; ring < 4; ring++) {
    const radius = 4 + ring * 2.5;
    if (radius > maxRadius) break;
    const count = 12 + ring * 4;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + ring * 0.4;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (!isInsideObstacle(mapId, x, z, 1.2)) return { x, z };
    }
  }
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 3 + Math.random() * (maxRadius - 3);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (!isInsideObstacle(mapId, x, z, 1.2)) return { x, z };
  }
  return { x: 0, z: 0 };
}

function nudge(player) {
  const angle = Math.random() * Math.PI * 2;
  const distance = 0.6 + Math.random();
  const mapId = mapIdOf(player);
  return {
    x: clampPosition(player.x + Math.cos(angle) * distance, mapId),
    z: clampPosition(player.z + Math.sin(angle) * distance, mapId),
  };
}

// Al cambiar de zona (lobby <-> sala) un jugador eliminado revive al instante,
// para no quedar "muerto permanente" esperando un respawn emitido a la sala vieja.
function ensureAliveForZone(player, socket, channel) {
  if (player.alive) return;
  player.alive = true;
  player.hp = MAX_HP;
  if (player.respawnTimer) {
    clearTimeout(player.respawnTimer);
    player.respawnTimer = null;
  }
  io.to(channel).emit("combat:revived", { targetId: player.id });
}

function roomChannel(code) {
  return `room:${code}`;
}

function roomError(socket, error) {
  socket.emit("room:error", { error });
}

function throttle(socket, key, limit, windowMs) {
  const now = Date.now();
  if (!socket.data.throttle) socket.data.throttle = {};
  let bucket = socket.data.throttle[key];
  if (!bucket) {
    bucket = [];
    socket.data.throttle[key] = bucket;
  }
  while (bucket.length && now - bucket[bucket.length - 1] > windowMs) bucket.pop();
  if (bucket.length >= limit) return true;
  bucket.unshift(now);
  return false;
}

function randomRoomCode() {
  let code;
  do {
    code = "";
    for (let i = 0; i < 4; i++) {
      code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
    }
  } while (rooms.has(code));
  return code;
}

function publicRoom(room) {
  return {
    code: room.code,
    name: room.name,
    mapId: room.mapId,
    ownerId: room.ownerId,
    ownerName: room.ownerName,
    players: room.members.size,
    // Metadatos de zona: el cliente decide con ellos si hay combate, tienda o
    // tablero de minijuego. Las salas privadas normales siguen siendo "room".
    kind: room.kind || "room",
    modeId: room.modeId || null,
    variant: room.variant || null,
    status: room.status || "open",
    combat: room.combat !== false,
    maxPlayers: room.maxPlayers || MAX_ROOM_MEMBERS,
  };
}

function visibleRooms() {
  return [...rooms.values()].filter((room) => !room.hidden);
}

// Crea (o devuelve) la isla persistente. No aparece en room:list y no cuenta
// para el límite de salas privadas.
function ensureHub() {
  let hub = rooms.get(HUB_CODE);
  if (hub) return hub;
  hub = {
    code: HUB_CODE,
    name: "Isla de Minijuegos",
    mapId: HUB_MAP_ID,
    ownerId: null,
    ownerName: "—",
    members: new Set(),
    chat: [],
    kind: "hub",
    status: "open",
    combat: false,
    maxPlayers: MAX_HUB_MEMBERS,
    persistent: true,
    hidden: true,
    loot: [],
    lootPending: [],
    crystalSeq: 1,
  };
  rooms.set(HUB_CODE, hub);
  return hub;
}

// Cada modalidad tiene una sala oculta persistente. Los modos con formatos
// (Pares 1v1 / 2v2) tienen una sala por variante. Así el estado de la partida
// sobrevive a que un jugador salga y el canal de Socket.IO es el mismo que el de
// cualquier sala.
function ensureModeRoom(modeId, variantId = null) {
  const def = getMode(modeId);
  if (!def) return null;
  const variant = variantId ? getModeVariant(modeId, variantId) : null;
  if (variantId && !variant) return null;
  const code = modeRoomCode(modeId, variant ? variant.id : null);
  let room = rooms.get(code);
  if (!room) {
    const variantLabel = variant ? ` · ${variant.label}` : "";
    room = {
      code,
      name: `${def.name}${variantLabel}`,
      mapId: def.mapId,
      ownerId: null,
      ownerName: "—",
      members: new Set(),
      chat: [],
      kind: "mode",
      modeId: def.id,
      variant: variant ? variant.id : null,
      status: "waiting",
      // Los minijuegos sociales no tienen combate; el Coliseo sí (solo melee).
      combat: def.combat === true,
      maxPlayers: (variant && variant.maxPlayers) || def.maxPlayers || MAX_ROOM_MEMBERS,
      persistent: true,
      hidden: true,
      loot: [],
      lootPending: [],
      crystalSeq: 1,
    };
    rooms.set(code, room);
  }
  return room;
}

function roomMembers(room) {
  return [...players.values()].filter((player) => player.roomCode === room.code);
}

function lobbyPlayers() {
  return [...players.values()].filter((player) => !player.roomCode);
}

function sameZone(a, b) {
  return (a.roomCode || null) === (b.roomCode || null);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function playerChannel(player) {
  return player.roomCode ? roomChannel(player.roomCode) : LOBBY_CHANNEL;
}

function addInventoryItem(player, type, id) {
  const entry = player.inventory.find((it) => it.type === type && it.id === id);
  if (entry) {
    entry.qty += 1;
    return true;
  }
  if (player.inventory.length >= INVENTORY_SLOTS) return false;
  player.inventory.push({ type, id, qty: 1 });
  return true;
}

const RAY_RADIUS = 0.7;

// Devuelve el objetivo (otro jugador de la zona) al que alcanza el rayo
// que parte de `origin` con dirección normalizada (dx, dz). Devuelve null si no.
// `radius` permite que precisión y escopeta tengan una tolerancia distinta.
function raycastHit(origin, dx, dz, candidates, maxRange, radius = RAY_RADIUS) {
  let bestTarget = null;
  let bestT = maxRange + 1;
  for (const c of candidates) {
    if (c.id === origin.id || !c.alive) continue;
    const ox = c.x - origin.x;
    const oz = c.z - origin.z;
    const along = ox * dx + oz * dz;
    if (along < 0 || along > maxRange) continue;
    const px = origin.x + dx * along;
    const pz = origin.z + dz * along;
    const perp = Math.hypot(c.x - px, c.z - pz);
    if (perp <= radius && along < bestT) {
      bestT = along;
      bestTarget = c;
    }
  }
  return bestTarget;
}

function playerSnapshot(player) {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    appearance: player.appearance || DEFAULT_APPEARANCE,
    x: player.x,
    z: player.z,
    y: Math.max(0, Math.min(3, Number(player.y) || 0)),
    hp: Math.max(0, Math.round(player.hp)),
    alive: player.alive,
    weaponId: player.weaponId || null,
    blocking: !!player.blocking,
    score: Math.max(0, Math.round(player.score || 0)),
    kills: player.kills || 0,
    deaths: player.deaths || 0,
    streak: player.streak || 0,
  };
}

// ---- puntaje: instantáneas y eventos (Fase 3) ----

function scoreSnapshot(player) {
  return {
    id: player.id,
    name: player.name,
    score: Math.max(0, Math.round(player.score || 0)),
    kills: player.kills || 0,
    deaths: player.deaths || 0,
    streak: player.streak || 0,
  };
}

function zonePlayers(player) {
  const code = player.roomCode || null;
  return [...players.values()].filter((other) => (other.roomCode || null) === code);
}

function scoreStatePayload(player) {
  return {
    players: zonePlayers(player)
      .map(scoreSnapshot)
      .sort((a, b) => b.score - a.score || b.kills - a.kills),
  };
}

function emitScoreUpdate(player, delta, reason) {
  io.to(playerChannel(player)).emit("score:update", {
    ...scoreSnapshot(player),
    playerId: player.id,
    delta,
    reason,
  });
}

function addScore(player, delta, reason) {
  if (!delta) return;
  player.score = Math.max(0, (player.score || 0) + delta);
  emitScoreUpdate(player, delta, reason);
}

function sendScoreState(player, socket = null) {
  const payload = scoreStatePayload(player);
  if (socket) socket.emit("score:state", payload);
  else io.to(playerChannel(player)).emit("score:state", payload);
}

function sendScoreProfile(socket, player) {
  const lifetime = player.userId ? getUserStats(player.userId) : null;
  socket.emit("score:profile", {
    playerId: player.id,
    lifetime: lifetime
      ? {
          score: lifetime.score_total,
          kills: lifetime.kills,
          deaths: lifetime.deaths,
          bestStreak: lifetime.best_streak,
          duelWins: lifetime.duel_wins || 0,
          duelRounds: lifetime.duel_rounds || 0,
          hideWins: lifetime.hide_wins || 0,
          seekWins: lifetime.seek_wins || 0,
        }
      : null,
    top: getTopStats(5),
  });
}

function noteHit(target, shooter, now) {
  if (!target.lastHitBy) target.lastHitBy = new Map();
  for (const [id, at] of target.lastHitBy) {
    if (now - at > ASSIST_WINDOW_MS) target.lastHitBy.delete(id);
  }
  target.lastHitBy.set(shooter.id, now);
}

// Cierra la baja: reparte puntos de kill/racha/asistencia y reinicia la racha
// de la víctima. El anti-farmeo reduce a la mitad las bajas al mismo rival en
// menos de 60 s.
function resolveKill(shooter, target) {
  const now = Date.now();
  const assists = [...(target.lastHitBy || [])].filter(
    ([id, at]) => id !== (shooter && shooter.id) && now - at <= ASSIST_WINDOW_MS
  );

  target.deaths = (target.deaths || 0) + 1;
  target.streak = 0;
  target.lastHitBy = new Map();
  emitScoreUpdate(target, 0, "death");

  if (shooter && shooter.id !== target.id) {
    shooter.kills = (shooter.kills || 0) + 1;
    shooter.streak = (shooter.streak || 0) + 1;
    shooter.bestStreak = Math.max(shooter.bestStreak || 0, shooter.streak);

    if (!shooter.recentKills) shooter.recentKills = new Map();
    for (const [id, at] of shooter.recentKills) {
      if (now - at > FARM_WINDOW_MS) shooter.recentKills.delete(id);
    }
    const farmed = shooter.recentKills.has(target.id);
    shooter.recentKills.set(target.id, now);

    let points = Math.round(SCORE_KILL * (farmed ? FARM_FACTOR : 1));
    if (shooter.streak === 2) points += SCORE_STREAK_2;
    else if (shooter.streak >= 3) points += Math.min(SCORE_STREAK_3, 100);
    addScore(shooter, points, farmed ? "kill-farm" : "kill");

    if (shooter.userId) {
      recordUserStats(shooter.userId, {
        score: points,
        kills: 1,
        bestStreak: shooter.bestStreak,
      });
    }
  }

  for (const [id] of assists) {
    const helper = players.get(id);
    if (!helper) continue;
    addScore(helper, SCORE_ASSIST, "assist");
    if (helper.userId) recordUserStats(helper.userId, { score: SCORE_ASSIST });
  }

  if (target.userId) recordUserStats(target.userId, { deaths: 1 });
}

// Devuelve la stamina del escudo a su máximo y corta el bloqueo. Se usa al
// morir, cambiar de arma o cambiar de zona.
function resetBlock(player) {
  player.blocking = false;
  player.blockStamina = BLOCK_STAMINA_MAX;
  player.blockBrokenUntil = 0;
  player.blockRegenAt = 0;
  player.blockKeepAliveAt = 0;
}

function damageTarget(shooter, target, damage, dirX, dirZ, opts = {}) {
  const now = Date.now();
  const block = computeBlockedDamage(target, shooter, damage, now);
  const applied = block.blocked ? 0 : block.damage;
  target.hp = Math.max(0, target.hp - applied);
  if (applied > 0 && shooter && shooter.id !== target.id) noteHit(target, shooter, now);
  shooter.lastShotAt = now;
  const mag = typeof dirX === "number" && typeof dirZ === "number" ? Math.hypot(dirX, dirZ) : 0;
  const dx = mag > 1e-6 ? dirX / mag : 0;
  const dz = mag > 1e-6 ? dirZ / mag : 0;
  io.to(playerChannel(shooter)).emit("combat:shot", {
    shooterId: shooter.id,
    shooterName: shooter.name,
    weaponId: shooter.weaponId,
    hit: true,
    blocked: block.blocked,
    damage: applied,
    dx,
    dz,
    targetId: target.id,
    targetHp: Math.round(target.hp),
    x: target.x,
    z: target.z,
  });

  if (block.blocked) {
    // Chispas/sonido de escudo: el daño no entra, pero el cliente debe verlo.
    io.to(playerChannel(shooter)).emit("combat:blocked", {
      targetId: target.id,
      shooterId: shooter.id,
      x: target.x,
      z: target.z,
      damage,
      guardBreak: false,
    });
  }

  if (target.hp <= 0 && target.alive) {
    target.alive = false;
    target.weaponId = null;
    resetBlock(target);
    if (opts.coliseo) {
      // En el Coliseo no hay respawn ni puntos de kill: la baja deja al jugador
      // como espectador hasta que el controlador inicie la siguiente ronda.
      const zone = playerChannel(shooter);
      io.to(zone).emit("combat:eliminated", {
        targetId: target.id,
        eliminatedByName: shooter.name,
      });
      io.to(zone).emit("crystal:equip", { playerId: target.id, weaponId: null });
      io.to(zone).emit("combat:block", {
        playerId: target.id,
        blocking: false,
        stamina: BLOCK_STAMINA_MAX,
      });
      if (typeof opts.onEliminated === "function") opts.onEliminated(target);
      return;
    }
    resolveKill(shooter, target);
    const zone = playerChannel(shooter);
    io.to(zone).emit("combat:eliminated", {
      targetId: target.id,
      eliminatedByName: shooter.name,
    });
    io.to(zone).emit("crystal:equip", { playerId: target.id, weaponId: null });
    io.to(zone).emit("combat:block", {
      playerId: target.id,
      blocking: false,
      stamina: BLOCK_STAMINA_MAX,
    });
    target.respawnTimer = setTimeout(() => {
      target.respawnTimer = null;
      const t = players.get(target.id);
      if (!t) return;
      t.hp = MAX_HP;
      t.alive = true;
      resetBlock(t);
      io.to(playerChannel(t)).emit("combat:revived", { targetId: target.id });
    }, RESPAWN_MS);
  }
}

function broadcastRoomList() {
  io.emit("room:list", {
    rooms: visibleRooms().map(publicRoom),
  });
}

function hockeySnapshot() {
  return {
    x: hockeyPuck.x,
    z: hockeyPuck.z,
    vx: hockeyPuck.vx,
    vz: hockeyPuck.vz,
    scores: [...hockeyScores]
      .map(([id, n]) => ({ id, name: players.get(id) ? players.get(id).name : "?", n }))
      .sort((a, b) => b.n - a.n),
  };
}

function resetHockey() {
  resetPuckPlacement();
  hockeyScores.clear();
  hockeyPrev.clear();
}

function resetPuckPlacement() {
  hockeyPuck.x = 0;
  hockeyPuck.z = 0;
  hockeyPuck.vx = 0;
  hockeyPuck.vz = 0;
  hockeyPuck.touchId = null;
}

function tickHockey() {
  const lobby = lobbyPlayers();
  if (!lobby.length) {
    if (hockeyPuck.x || hockeyPuck.z || hockeyScores.size) resetHockey();
    return;
  }

  const p = hockeyPuck;
  const dt = HOCKEY_TICK_MS / 1000;

  p.x += p.vx * dt;
  p.z += p.vz * dt;

  p.vx *= HOCKEY_FRICTION;
  p.vz *= HOCKEY_FRICTION;
  const speed = Math.hypot(p.vx, p.vz);
  if (speed > HOCKEY_MAX_SPEED) {
    const k = HOCKEY_MAX_SPEED / speed;
    p.vx *= k;
    p.vz *= k;
  }

  const dist = Math.hypot(p.x, p.z);
  if (dist > HOCKEY_WALL_R) {
    const nx = p.x / dist;
    const nz = p.z / dist;
    p.x = nx * HOCKEY_WALL_R;
    p.z = nz * HOCKEY_WALL_R;
    const vn = p.vx * nx + p.vz * nz;
    if (vn < 0) {
      p.vx -= (1 + HOCKEY_WALL_RESTITUTION) * vn * nx;
      p.vz -= (1 + HOCKEY_WALL_RESTITUTION) * vn * nz;
    }
  }

  for (const pl of lobby) {
    const prev = hockeyPrev.get(pl.id) || { x: pl.x, z: pl.z };
    const pvx = (pl.x - prev.x) / dt;
    const pvz = (pl.z - prev.z) / dt;

    const dx = p.x - pl.x;
    const dz = p.z - pl.z;
    const d = Math.hypot(dx, dz);
    const minD = HOCKEY_PLAYER_RADIUS + HOCKEY_PUCK_RADIUS;
    if (d > 0 && d < minD) {
      const nx = dx / d;
      const nz = dz / d;
      p.x = pl.x + nx * minD;
      p.z = pl.z + nz * minD;
      const approach = pvx * nx + pvz * nz;
      const boost = HOCKEY_PUSH_BASE + Math.max(0, approach) * HOCKEY_PUSH_SPEED_FACTOR;
      p.vx += nx * boost;
      p.vz += nz * boost;
      p.touchId = pl.id;
    }
    hockeyPrev.set(pl.id, { x: pl.x, z: pl.z });
  }

  if (Math.abs(p.x) > HOCKEY_GOAL_X && Math.abs(p.z) < HOCKEY_GOAL_HALF) {
    const scorer = p.touchId ? players.get(p.touchId) : null;
    if (scorer) {
      hockeyScores.set(scorer.id, (hockeyScores.get(scorer.id) || 0) + 1);
      io.to(LOBBY_CHANNEL).emit("hockey:goal", {
        scorerId: scorer.id,
        scorerName: scorer.name,
        scores: hockeySnapshot().scores,
      });
      console.log(`[hockey] ${scorer.name} anotó un gol (${hockeyScores.get(scorer.id)})`);
    }
    resetPuckPlacement();
  }

  io.to(LOBBY_CHANNEL).emit("hockey:state", hockeySnapshot());
}

// ---- cristales de objetos (combate en salas) ----

function randomCrystalSpot(room) {
  const bound = getMapBoundary(room.mapId) - 4;
  const spot = () => ({ x: -bound + Math.random() * bound * 2, z: -bound + Math.random() * bound * 2 });
  // Los mapas grandes tienen más coberturas: descartamos cualquier punto que
  // caiga dentro de un obstáculo (con 1,1 m de margen) antes de comprobar la
  // distancia al resto de cristales.
  for (const minDist of [5, 3, 1.6, 0.9]) {
    for (let i = 0; i < 20; i++) {
      const candidate = spot();
      if (isInsideObstacle(room.mapId, candidate.x, candidate.z, 1.1)) continue;
      const tooClose = room.loot.some((c) => Math.hypot(c.x - candidate.x, c.z - candidate.z) < minDist);
      if (!tooClose) return candidate;
    }
  }
  // Último recurso: cualquier punto libre de obstáculos, aunque quede cerca de
  // otro cristal. En un mapa de 120 m siempre hay hueco.
  for (let i = 0; i < 80; i++) {
    const candidate = spot();
    if (!isInsideObstacle(room.mapId, candidate.x, candidate.z, 1.1)) return candidate;
  }
  return spot();
}

function randomCrystalWeapon() {
  const ids = Object.keys(WEAPONS).filter((id) => isCrystalWeapon(id));
  const laser = "laser";
  if (Math.random() < 0.01) return laser;
  // El escudo es una herramienta defensiva: aparece algo más a menudo que el
  // resto para que se pueda probar el bloqueo.
  if (Math.random() < 0.12) return "escudo";
  const others = ids.filter((id) => id !== laser);
  return others[Math.floor(Math.random() * others.length)];
}

function makeCrystal(room) {
  const spot = randomCrystalSpot(room);
  const type = rollCrystalType();
  const crystal = {
    id: room.crystalSeq++,
    x: spot.x,
    z: spot.z,
    type,
    weaponId: null,
    itemId: null,
    state: "available",
    offeredTo: null,
    offerExpire: 0,
  };
  if (type === "weapon") {
    crystal.weaponId = randomCrystalWeapon();
  } else if (type === "food") {
    crystal.itemId = pickWeighted(FOODS);
  } else {
    crystal.itemId = pickWeighted(THROWABLES);
  }
  return crystal;
}
// Los cristales solo existen en salas privadas: el lobby es una zona social
// (hockey, chat, vestidor) sin combate ni objetos que recoger.
function spawnRoomCrystals(room, mapId) {
  const count = MAP_LOOT_COUNTS[mapId] || 4;
  room.loot = [];
  room.lootPending = [];
  room.crystalSeq = 1;
  for (let i = 0; i < count; i++) {
    room.loot.push(makeCrystal(room));
  }
}

function broadcastCrystals(room) {
  io.to(roomChannel(room.code)).emit("crystal:state", {
    crystals: room.loot.map((c) => ({ id: c.id, x: c.x, z: c.z, type: c.type })),
  });
}

function crystalTick() {
  const now = Date.now();
  for (const room of rooms.values()) {
    for (const crystal of room.loot) {
      if (crystal.state === "offered" && crystal.offerExpire < now) {
        crystal.state = "available";
        crystal.offeredTo = null;
        crystal.offerExpire = 0;
      }
    }
    const tickNow = Date.now();
    let respawned = false;
    while (room.lootPending.length) {
      const idx = room.lootPending.findIndex((p) => p.respawnAt <= tickNow);
      if (idx < 0) break;
      room.lootPending.splice(idx, 1);
      room.loot.push(makeCrystal(room));
      respawned = true;
    }
    if (respawned) broadcastCrystals(room);
  }
}

// Avanza los temporizadores de todos los minijuegos (turnos, reinicio de ronda).
// Cada controlador decide si hubo cambios y emite su propio estado. La posición
// autoritativa se consulta en el momento para asignar equipos y deducir cartas.
function modeTick() {
  const posOf = (id) => {
    const player = players.get(id);
    return player ? { x: player.x, z: player.z } : null;
  };
  for (const game of modeGames.values()) {
    if (game === tntController) continue; // Tiene su propio intervalo de 20 Hz.
    game.tick(Date.now(), posOf);
  }
}

// Tick dedicado de TNT Run: las mechas de 600 ms necesitan 20 Hz para que la
// animación de caída no se sienta a saltos. El reloj se consulta una sola vez.
function tntTick() {
  if (tntController) tntController.tick(Date.now());
}

function transferOwnership(room) {
  const nextId = [...room.members][0];
  room.ownerId = nextId;
  const owner = players.get(nextId);
  room.ownerName = owner ? owner.name : "—";
  io.to(roomChannel(room.code)).emit("room:ownerChanged", {
    code: room.code,
    ownerId: nextId,
    ownerName: room.ownerName,
  });
  io.to(nextId).emit("room:state", { room: publicRoom(room), hosting: true });
}

function removeFromRoom(player, reason = "manual") {
  const room = rooms.get(player.roomCode);
  if (!room) return;

  // Se quita primero del recuento de la sala: `game.leave` difunde el estado y
  // puede reenviar `room:state`, que debe reflejar ya el aforo correcto.
  room.members.delete(player.id);
  // Los minijuegos necesitan saber que el jugador se fue (turnos, marcador).
  if (room.kind === "mode") {
    const game = modeGames.get(room.code);
    if (game) game.leave(player.id, { reason });
  }

  if (room.members.size === 0 && !room.persistent) {
    rooms.delete(room.code);
  } else if (room.ownerId === player.id) {
    transferOwnership(room);
  }
}

// Sale del canal de la zona actual sin entrar todavía en otra. Lo usan los
// cambios de zona y la creación de salas desde la isla.
function detachFromRoom(socket, player, { notify = true, reason = "manual" } = {}) {
  const oldCode = player.roomCode;
  if (!oldCode) return;
  const channel = roomChannel(oldCode);
  socket.leave(channel);
  if (notify) socket.to(channel).emit("player:left", { id: socket.id });
  removeFromRoom(player, reason);
  player.roomCode = null;
}

function moveSocketToLobby(socket, player, { notifyOldRoom = true } = {}) {
  detachFromRoom(socket, player, { notify: notifyOldRoom });
  player.weaponId = null;
  resetBlock(player);

  socket.join(LOBBY_CHANNEL);
  const lobbyNudge = nudge(player);
  player.x = lobbyNudge.x;
  player.z = lobbyNudge.z;
  ensureAliveForZone(player, socket, LOBBY_CHANNEL);

  socket.emit("welcome", { id: socket.id, players: lobbyPlayers().map(playerSnapshot) });
  socket.emit("chat:history", getRecentMessages(MOVE_HISTORY_LIMIT));
  socket.to(LOBBY_CHANNEL).emit("player:joined", playerSnapshot(player));
  socket.emit("room:state", { room: null, hosting: false });
  socket.emit("crystal:equip", { playerId: socket.id, weaponId: null });
  socket.emit("combat:block", {
    playerId: socket.id,
    blocking: false,
    stamina: BLOCK_STAMINA_MAX,
  });
  socket.emit("inventory:update", { playerId: socket.id, inventory: player.inventory });
  // El lobby no tiene cristales: se limpia el estado del cliente al volver.
  socket.emit("crystal:state", { crystals: [] });
  sendScoreState(player, socket);
  sendScoreProfile(socket, player);
  broadcastRoomList();
}

function moveSocketToRoom(socket, player, room) {
  if (player.roomCode === room.code) return;

  if (player.roomCode) {
    detachFromRoom(socket, player);
  } else {
    socket.leave(LOBBY_CHANNEL);
    socket.to(LOBBY_CHANNEL).emit("player:left", { id: socket.id });
  }

  player.roomCode = room.code;
  player.weaponId = null;
  resetBlock(player);
  room.members.add(socket.id);

  // Al entrar en una sala se reaparece en la plaza central libre de coberturas;
  // en la cordillera (terreno procedural) se conserva el nudge de siempre.
  const roomNudge = room.mapId === "cordillera" ? nudge(player) : clearRoomSpawn(room.mapId);
  player.x = roomNudge.x;
  player.z = roomNudge.z;
  socket.join(roomChannel(room.code));
  ensureAliveForZone(player, socket, roomChannel(room.code));

  socket.emit("welcome", { id: socket.id, players: roomMembers(room).map(playerSnapshot) });
  socket.emit("chat:history", room.chat);
  socket.to(roomChannel(room.code)).emit("player:joined", playerSnapshot(player));
  socket.emit("room:state", { room: publicRoom(room), hosting: socket.id === room.ownerId });
  socket.emit("crystal:equip", { playerId: socket.id, weaponId: null });
  socket.emit("combat:block", {
    playerId: socket.id,
    blocking: false,
    stamina: BLOCK_STAMINA_MAX,
  });
  socket.emit("inventory:update", { playerId: socket.id, inventory: player.inventory });
  socket.emit("crystal:state", {
    crystals: room.loot.map((c) => ({ id: c.id, x: c.x, z: c.z, type: c.type })),
  });
  sendScoreState(player, socket);
  sendScoreProfile(socket, player);
  broadcastRoomList();
}

// Isla de Minijuegos: zona social persistente, sin combate, con un portal por
// modalidad. Entrar desde el lobby no exige caminar al portal (también hay
// botón en el menú), pero desde una sala privada hay que salir primero.
function moveSocketToHub(socket, player) {
  const hub = ensureHub();

  if (player.roomCode === HUB_CODE) {
    socket.emit("room:state", { room: publicRoom(hub), hosting: false });
    return;
  }

  const current = player.roomCode ? rooms.get(player.roomCode) : null;
  if (current && current.kind === "room") {
    return roomError(socket, "Sal de la sala antes de ir a los minijuegos.");
  }
  if (!hub.members.has(socket.id) && hub.members.size >= MAX_HUB_MEMBERS) {
    return roomError(socket, "La isla está llena. Inténtalo en un momento.");
  }

  // El lobby no es una sala: `player.roomCode` es null mientras se está en él,
  // así que `detachFromRoom` no lo abandonaría. Sin este leave el socket sigue
  // suscrito a `lobby` y los jugadores de una zona aparecen en la otra.
  if (!player.roomCode) {
    socket.leave(LOBBY_CHANNEL);
    socket.to(LOBBY_CHANNEL).emit("player:left", { id: socket.id });
  }

  detachFromRoom(socket, player);
  player.roomCode = HUB_CODE;
  player.weaponId = null;
  resetBlock(player);
  player.x = HUB_SPAWN.x;
  player.z = HUB_SPAWN.z;
  player.y = 0;
  hub.members.add(socket.id);
  socket.join(roomChannel(HUB_CODE));
  ensureAliveForZone(player, socket, roomChannel(HUB_CODE));

  socket.emit("welcome", { id: socket.id, players: roomMembers(hub).map(playerSnapshot) });
  socket.emit("chat:history", hub.chat);
  socket.to(roomChannel(HUB_CODE)).emit("player:joined", playerSnapshot(player));
  socket.emit("room:state", { room: publicRoom(hub), hosting: false });
  socket.emit("crystal:equip", { playerId: socket.id, weaponId: null });
  socket.emit("combat:block", {
    playerId: socket.id,
    blocking: false,
    stamina: BLOCK_STAMINA_MAX,
  });
  socket.emit("inventory:update", { playerId: socket.id, inventory: player.inventory });
  socket.emit("crystal:state", { crystals: [] });
  sendScoreState(player, socket);
  sendScoreProfile(socket, player);
  broadcastRoomList();
}

function moveSocketToMode(socket, player, room) {
  const game = modeGames.get(room.code);
  if (player.roomCode === room.code) {
    if (game) socket.emit("mode:state", game.snapshot());
    socket.emit("room:state", { room: publicRoom(room), hosting: false });
    return;
  }

  if (player.roomCode) {
    detachFromRoom(socket, player);
  } else {
    socket.leave(LOBBY_CHANNEL);
    socket.to(LOBBY_CHANNEL).emit("player:left", { id: socket.id });
  }

  player.roomCode = room.code;
  player.weaponId = null;
  resetBlock(player);
  room.members.add(socket.id);
  socket.join(roomChannel(room.code));

  // Se une al controlador ANTES de calcular el spawn: en el Coliseo el bando
  // (y por tanto el punto de aparición) se asigna al entrar. El socket ya está
  // en el canal para recibir el `mode:state` que difunde `join`.
  if (game) {
    const result = game.join({ id: player.id, name: player.name, userId: player.userId });
    if (!result.ok) {
      const message =
        result.reason === "full"
          ? "La partida está llena."
          : result.reason === "in-progress"
            ? "La partida ya está en marcha. Espera al siguiente reinicio."
            : "No se pudo entrar a la partida.";
      roomError(socket, message);
      moveSocketToHub(socket, player);
      return;
    }
    room.status = game.status;
  }

  // Los minijuegos 3D tienen un punto de llegada propio (fuera del tablero y de
  // las plataformas de equipo). El resto sigue usando el spawn libre genérico.
  const spawn = game && game.spawnFor ? game.spawnFor(player.id) : clearRoomSpawn(room.mapId);
  player.x = spawn.x;
  player.z = spawn.z;
  player.y = Number.isFinite(spawn.y) ? spawn.y : 0;
  if (Number.isFinite(spawn.yaw)) player.yaw = spawn.yaw;
  ensureAliveForZone(player, socket, roomChannel(room.code));

  socket.emit("welcome", { id: socket.id, players: roomMembers(room).map(playerSnapshot) });
  socket.emit("chat:history", room.chat);
  socket.to(roomChannel(room.code)).emit("player:joined", playerSnapshot(player));
  socket.emit("room:state", { room: publicRoom(room), hosting: false });
  // El estado se reenvía tras room:state para que el cliente ya conozca la zona
  // cuando pinte el HUD del minijuego.
  if (game) socket.emit("mode:state", game.snapshot());
  socket.emit("crystal:equip", { playerId: socket.id, weaponId: null });
  socket.emit("combat:block", {
    playerId: socket.id,
    blocking: false,
    stamina: BLOCK_STAMINA_MAX,
  });
  socket.emit("inventory:update", { playerId: socket.id, inventory: player.inventory });
  socket.emit("crystal:state", { crystals: [] });
  sendScoreState(player, socket);
  sendScoreProfile(socket, player);

  broadcastRoomList();
}

// Difunde el estado de un modo a su sala oculta. También sincroniza
// room.status para que room:list (y el cliente) sepa si hay partida en curso.
function emitModeState(roomCode, snapshot, event) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const statusChanged = room.status !== snapshot.status;
  room.status = snapshot.status;
  const channel = roomChannel(room.code);
  io.to(channel).emit("mode:state", snapshot);
  if (event) {
    const payload = { modeId: snapshot.modeId, variant: snapshot.variant, ...event };
    // El pulso del Escondite solo revela a quién detectó al buscador: los
    // escondidos reciben el evento sin la lista de jugadores detectados.
    if (event.type === "pulse") {
      io.to(channel).emit("mode:event", { ...payload, hits: [] });
      io.to(event.playerId).emit("mode:event", payload);
    } else {
      io.to(channel).emit("mode:event", payload);
    }
  }
  // El panel lateral muestra el estado de la partida; si cambia (empieza,
  // termina o se reinicia) se reenvía room:state para no quedarse en
  // "Esperando jugadores" con la partida ya en marcha.
  if (statusChanged) {
    io.to(roomChannel(room.code)).emit("room:state", {
      room: publicRoom(room),
      hosting: false,
    });
  }
}

// ---- Coliseo melee ---------------------------------------------------------

function isColiseoRoom(room) {
  return !!room && room.kind === "mode" && room.modeId === "coliseo";
}

function coliseoGameFor(room) {
  return isColiseoRoom(room) ? modeGames.get(room.code) || null : null;
}

// Coloca a un jugador en su punto de aparición, lo revive y le equipa el arma
// elegida. El cliente recibe `mode:teleport` para corregir su posición local:
// el servidor es quien decide dónde empieza cada ronda.
function coliseoPlace(room, game, snapshot, player) {
  const info = (snapshot.players || []).find((entry) => entry.id === player.id);
  const spawn = game.spawnFor(player.id);
  player.x = spawn.x;
  player.z = spawn.z;
  player.y = 0;
  player.yaw = spawn.yaw;
  player.hp = MAX_HP;
  player.alive = true;
  player.weaponId = info ? info.weaponId : player.weaponId;
  player.lastShotAt = 0;
  player.lastThrowAt = 0;
  player.moveBudget = MOVE_BUDGET_MAX;
  player.moveBudgetAt = Date.now();
  resetBlock(player);

  const channel = roomChannel(room.code);
  io.to(channel).emit("mode:teleport", {
    id: player.id,
    x: player.x,
    z: player.z,
    yaw: player.yaw,
  });
  io.to(channel).emit("combat:revived", { targetId: player.id });
  io.to(channel).emit("crystal:equip", {
    playerId: player.id,
    weaponId: player.weaponId,
  });
  io.to(channel).emit("combat:block", {
    playerId: player.id,
    blocking: false,
    stamina: BLOCK_STAMINA_MAX,
  });
}

// Persiste el resultado de la partida en user_stats. Los ganadores suman una
// victoria de duelo y cada participante registrado acumula sus rondas ganadas.
function persistColiseoResult(snapshot) {
  if (!snapshot || !snapshot.winner) return;
  const winnerId = snapshot.winner.id;
  const scores = new Map((snapshot.scores || []).map((entry) => [entry.id, entry.score || 0]));
  for (const entry of snapshot.players || []) {
    const player = players.get(entry.id);
    if (!player || !player.userId) continue;
    const key = snapshot.mode === "ffa" ? entry.id : entry.side;
    const won = snapshot.mode === "ffa" ? entry.id === winnerId : entry.side === winnerId;
    recordUserStats(player.userId, {
      duelWins: won ? 1 : 0,
      duelRounds: scores.get(key) || 0,
    });
  }
}

// Aplica los eventos del controlador: al empezar una ronda todos vuelven a su
// spawn con el arma elegida; al terminar la partida se guardan las estadísticas.
function applyColiseoEvent(room, snapshot, event) {
  if (!event || !snapshot) return;
  const game = coliseoGameFor(room);
  if (!game) return;

  if (event.type === "countdown" || event.type === "roundStart") {
    for (const player of roomMembers(room)) coliseoPlace(room, game, snapshot, player);
    return;
  }
  if (event.type === "join" && (snapshot.phase === "countdown" || snapshot.phase === "fight")) {
    const player = players.get(event.playerId);
    if (player) coliseoPlace(room, game, snapshot, player);
    return;
  }
  if (event.type === "matchEnd") {
    persistColiseoResult(snapshot);
  }
}

// ---- Escondite -------------------------------------------------------------

function isEsconditeRoom(room) {
  return !!room && room.kind === "mode" && room.modeId === "escondite";
}

function esconditeGameFor(room) {
  return isEsconditeRoom(room) ? modeGames.get(room.code) || null : null;
}

// El servidor decide el punto de llegada de cada fase (jaula para el buscador,
// anillo interior para los escondidos) y avisa al cliente con `mode:teleport`.
function esconditePlace(room, game, player) {
  const spawn = game.spawnFor(player.id);
  player.x = spawn.x;
  player.z = spawn.z;
  player.y = 0;
  if (Number.isFinite(spawn.yaw)) player.yaw = spawn.yaw;
  player.weaponId = null;
  player.hp = MAX_HP;
  player.alive = true;
  player.moveBudget = MOVE_BUDGET_MAX;
  player.moveBudgetAt = Date.now();
  resetBlock(player);
  io.to(roomChannel(room.code)).emit("mode:teleport", {
    id: player.id,
    x: player.x,
    z: player.z,
    yaw: player.yaw,
  });
}

function persistEsconditeResult(game) {
  if (!game || !game.resultStats) return;
  const stats = game.resultStats();
  if (!stats.winner) return;
  const winners = new Set((stats.winners || []).map((entry) => entry.userId));
  for (const entry of stats.participants || []) {
    if (!entry.userId) continue;
    const won = winners.has(entry.userId);
    recordUserStats(entry.userId, {
      hideWins: stats.winner === "hider" && won ? 1 : 0,
      seekWins: stats.winner === "seeker" && won ? 1 : 0,
    });
  }
}

function applyEsconditeEvent(room, snapshot, event) {
  if (!event || !snapshot) return;
  const game = esconditeGameFor(room);
  if (!game) return;

  if (event.type === "hideStart" || event.type === "seekStart") {
    for (const player of roomMembers(room)) esconditePlace(room, game, player);
    return;
  }
  if (event.type === "join" || event.type === "rejoin") {
    const player = players.get(event.playerId);
    if (player) esconditePlace(room, game, player);
    return;
  }
  if (event.type === "result") {
    persistEsconditeResult(game);
  }
}

// Devuelve la sala de Escondite con un rol reservado para este jugador, si la
// hubiera. Se usa al volver a conectar para avisar al cliente de la reconexión.
function esconditeRejoinRoomFor(player) {
  if (!player) return null;
  for (const room of rooms.values()) {
    if (!isEsconditeRoom(room)) continue;
    const game = esconditeGameFor(room);
    if (game && game.canRejoin && game.canRejoin({ userId: player.userId, name: player.name })) {
      return room;
    }
  }
  return null;
}

// ---- TNT Run ---------------------------------------------------------------

function isTntRoom(room) {
  return !!room && room.kind === "mode" && room.modeId === "tnt";
}

function tntGameFor(room) {
  return isTntRoom(room) ? modeGames.get(room.code) || null : null;
}

// Coloca al pingüino en la celda y capa que decide el controlador. El cliente
// usa `y` para situar al jugador en la altura correcta de la isla flotante.
function tntPlace(room, game, player) {
  const spawn = game.spawnFor(player.id);
  player.x = spawn.x;
  player.z = spawn.z;
  player.y = Number.isFinite(spawn.y) ? spawn.y : 0;
  if (Number.isFinite(spawn.yaw)) player.yaw = spawn.yaw;
  player.weaponId = null;
  player.hp = MAX_HP;
  player.alive = true;
  player.moveBudget = MOVE_BUDGET_MAX;
  player.moveBudgetAt = Date.now();
  resetBlock(player);
  io.to(roomChannel(room.code)).emit("mode:teleport", {
    id: player.id,
    x: player.x,
    z: player.z,
    y: player.y,
    yaw: player.yaw,
  });
}

function persistTntResult(game) {
  if (!game || !game.resultStats) return;
  const stats = game.resultStats();
  if (!stats.winner) return;
  for (const entry of stats.participants || []) {
    if (!entry.userId) continue;
    recordUserStats(entry.userId, {
      tntWins: entry.id === stats.winner ? 1 : 0,
      tntBlocks: stats.blocks ? stats.blocks[entry.id] || 0 : 0,
    });
  }
}

function applyTntEvent(room, snapshot, event) {
  if (!event || !snapshot) return;
  const game = tntGameFor(room);
  if (!game) return;

  if (event.type === "countdown" || event.type === "start" || event.type === "restart") {
    for (const player of roomMembers(room)) tntPlace(room, game, player);
    return;
  }
  if (event.type === "join" || event.type === "rejoin") {
    const player = players.get(event.playerId);
    if (player) tntPlace(room, game, player);
    return;
  }
  if (event.type === "playerFall") {
    const player = players.get(event.playerId);
    if (!player) return;
    if (event.eliminated) {
      player.alive = false;
    } else {
      player.x = event.x;
      player.z = event.z;
      player.y = event.y;
      player.moveBudget = MOVE_BUDGET_MAX;
      player.moveBudgetAt = Date.now();
      io.to(roomChannel(room.code)).emit("mode:teleport", {
        id: player.id,
        x: player.x,
        z: player.z,
        y: player.y,
        yaw: player.yaw,
      });
    }
    return;
  }
  if (event.type === "result") {
    persistTntResult(game);
  }
}

function tntRejoinRoomFor(player) {
  if (!player) return null;
  for (const room of rooms.values()) {
    if (!isTntRoom(room)) continue;
    const game = tntGameFor(room);
    if (game && game.canRejoin && game.canRejoin({ userId: player.userId, name: player.name })) {
      return room;
    }
  }
  return null;
}

export function setupGame(ioServer) {
  io = ioServer;

  // La isla existe desde el arranque para que room:list y los portales tengan
  // un destino estable aunque todavía no haya nadie dentro.
  ensureHub();
  // Pares tiene una sala y un controlador por formato (1v1 y 2v2). Ambos se
  // crean al arrancar para que el estado y los canales sean estables.
  for (const variant of getMode("pares").variants || []) {
    const room = ensureModeRoom("pares", variant.id);
    if (!room) continue;
    modeGames.set(
      room.code,
      createPairsGame({
        variant: variant.id,
        maxPlayers: variant.maxPlayers,
        onChange: (snapshot, event) => emitModeState(room.code, snapshot, event),
      })
    );
  }

  // Coliseo: una sala y un controlador por formato (1v1, 2v2 y FFA). Es el único
  // modo con combate real, así que además de emitir el estado aplica los
  // eventos de ronda (teletransporte, revivir, equipar y estadísticas).
  for (const variant of getMode("coliseo").variants || []) {
    const room = ensureModeRoom("coliseo", variant.id);
    if (!room) continue;
    modeGames.set(
      room.code,
      createColiseoGame({
        variant: variant.id,
        maxPlayers: variant.maxPlayers,
        onChange: (snapshot, event) => {
          emitModeState(room.code, snapshot, event);
          applyColiseoEvent(room, snapshot, event);
        },
      })
    );
  }

  // Escondite: una sala oculta sin combate. El buscador se elige con el RNG real
  // del servidor y las posiciones se leen del estado autoritativo para validar
  // etiquetas y pulsos.
  const hideRoom = ensureModeRoom("escondite");
  if (hideRoom) {
    modeGames.set(
      hideRoom.code,
      createEsconditeGame({
        onChange: (snapshot, event) => {
          emitModeState(hideRoom.code, snapshot, event);
          applyEsconditeEvent(hideRoom, snapshot, event);
        },
        positionOf: (id) => {
          const holder = players.get(id);
          return holder ? { x: holder.x, z: holder.z } : null;
        },
      })
    );
  }

  // TNT Run: sala oculta sin combate. La rejilla y las mechas viven en el
  // controlador; el movimiento autoritativo se le entrega en `player:move`.
  // El tick propio de 20 Hz se registra al final de setupGame.
  const tntRoom = ensureModeRoom("tnt");
  if (tntRoom) {
    tntController = createTntGame({
      maxPlayers: getMode("tnt").maxPlayers,
      onChange: (snapshot, event) => {
        emitModeState(tntRoom.code, snapshot, event);
        applyTntEvent(tntRoom, snapshot, event);
      },
    });
    modeGames.set(tntRoom.code, tntController);
  }

  io.on("connection", (socket) => {
    socket.on("player:join", (payload = {}) => {
      if (players.has(socket.id)) return;

      if (lobbyPlayers().length >= MAX_LOBBY) {
        socket.emit("game:full", { error: "El lobby está lleno (16 jugadores). Inténtalo más tarde." });
        return;
      }

      const isAccount = typeof socket.data.userId === "number";
      const userName = socket.data.username || String(payload.name || "").trim().slice(0, 20) || "Anónimo";
      const color = isAccount ? socket.data.color : randomColor();
      const appearance = isAccount
        ? normalizeAppearance(payload.appearance || socket.data.appearance)
        : normalizeAppearance(payload.appearance);

      let position = randomSeat();
      if (isAccount) {
        const user = getUserById(socket.data.userId);
        if (user && typeof user.last_x === "number" && typeof user.last_z === "number") {
          position = { x: user.last_x, z: user.last_z };
        }
      }

      const player = {
        id: socket.id,
        userId: isAccount ? socket.data.userId : null,
        name: userName,
        color,
        appearance,
        x: clampPosition(position.x),
        z: clampPosition(position.z),
        roomCode: null,
        movedSinceSave: false,
        hp: MAX_HP,
        alive: true,
        weaponId: null,
        inventory: [],
        lastThrowAt: 0,
        slowUntil: 0,
        lastMoveAt: 0,
        moveBudget: MOVE_BUDGET_MAX,
        moveBudgetAt: Date.now(),
        respawnTimer: null,
        yaw: 0,
        y: 0,
        sprinting: false,
        sliding: false,
        blocking: false,
        blockStamina: BLOCK_STAMINA_MAX,
        blockBrokenUntil: 0,
        blockRegenAt: 0,
        blockKeepAliveAt: 0,
        score: 0,
        kills: 0,
        deaths: 0,
        streak: 0,
        bestStreak: 0,
        lastHitBy: new Map(),
        recentKills: new Map(),
      };

      players.set(socket.id, player);
      socket.join(LOBBY_CHANNEL);

      socket.emit("welcome", { id: socket.id, players: lobbyPlayers().map(playerSnapshot) });
      socket.emit("chat:history", getRecentMessages(MOVE_HISTORY_LIMIT));
      socket.to(LOBBY_CHANNEL).emit("player:joined", playerSnapshot(player));
      socket.emit("room:state", { room: null, hosting: false });
      socket.emit("inventory:update", { playerId: socket.id, inventory: player.inventory });
      socket.emit("hockey:state", hockeySnapshot());
      sendScoreState(player, socket);
      sendScoreProfile(socket, player);
      broadcastRoomList();
      console.log(`[game] ${player.name} entró (${socket.id})${isAccount ? " [cuenta]" : " [invitado]"}`);

      // Si tenía una plaza reservada en el Escondite o en TNT Run, avisamos al
      // cliente para que vuelva a entrar automáticamente y recupere su estado.
      const rejoinRoom = esconditeRejoinRoomFor(player) || tntRejoinRoomFor(player);
      if (rejoinRoom) {
        socket.emit("mode:rejoin", {
          modeId: rejoinRoom.modeId,
          roomCode: rejoinRoom.code,
        });
      }

      socket.on("player:move", ({ x, z, yaw, y, sprint, slide } = {}) => {
        if (!Number.isFinite(x) || !Number.isFinite(z)) return;
        if (!player.alive) return;
        // En el Coliseo solo se puede mover durante la ronda activa: en espera,
        // cuenta atrás o fin de ronda el servidor ignora las posiciones.
        const moveRoom = player.roomCode ? rooms.get(player.roomCode) : null;
        const moveGame = coliseoGameFor(moveRoom);
        if (moveGame && !moveGame.canFight(player.id)) return;
        // En el Escondite el buscador queda inmóvil en la jaula durante `hide`.
        const hideGame = esconditeGameFor(moveRoom);
        if (hideGame && !hideGame.canMove(player.id)) return;
        // En TNT Run solo se mueve quien sigue vivo y con la partida en marcha.
        const tntGame = tntGameFor(moveRoom);
        if (tntGame && !tntGame.canMove(player.id)) return;
        if (throttle(socket, "move", 40, 1000)) return;

        const now = Date.now();
        const dist = Math.hypot(x - player.x, z - player.z);

        // Anti-teletransporte / anti-sniping de loot: rechaza saltos de posición
        // mayores que un radio generoso (normal ~0.3-1.6 por envío, 50 ms).
        if (dist > MOVE_MAX_STEP) return;

        // Anti-speed-hack moderado: repone presupuesto a 13 m/s y, si el envío
        // pide más de lo disponible, recorta la posición en lugar de descartar
        // el paquete (evita tirones con lag). Un cliente legítimo que corre
        // (~9,3 m/s) nunca agota el presupuesto.
        const elapsed = Math.max(0, now - player.moveBudgetAt);
        const budget = Number.isFinite(player.moveBudget) ? player.moveBudget : MOVE_BUDGET_MAX;
        player.moveBudget = Math.min(
          MOVE_BUDGET_MAX,
          budget + (elapsed / 1000) * MOVE_BUDGET_RATE
        );
        player.moveBudgetAt = now;

        let targetX = x;
        let targetZ = z;
        if (dist > player.moveBudget) {
          const ratio = dist > 0 ? player.moveBudget / dist : 0;
          targetX = player.x + (x - player.x) * ratio;
          targetZ = player.z + (z - player.z) * ratio;
          player.moveBudget = 0;
        } else {
          player.moveBudget = Math.max(0, player.moveBudget - dist);
        }

        // TNT Run: la celda pisada, la mecha y la altura las decide el
        // controlador a partir de la posición ya presupuestada. Si el cliente
        // intenta cruzar dos celdas de golpe, devuelve el centro de la actual.
        let tntLayer = null;
        if (tntGame) {
          const result = tntGame.move(player.id, targetX, targetZ);
          if (result && Number.isFinite(result.x) && Number.isFinite(result.z)) {
            targetX = result.x;
            targetZ = result.z;
          }
          tntLayer = result && Number.isFinite(result.y) ? result.y : null;
        }

        player.lastMoveAt = now;
        if (Number.isFinite(yaw)) player.yaw = yaw;
        // Altura del salto (Fase 4): cosmética, acotada a [0, 3] m. En TNT Run
        // la altura es autoritativa (capa × 1,5 m) y el salto está desactivado.
        player.y = tntLayer !== null ? tntLayer : Number.isFinite(y) ? Math.max(0, Math.min(3, y)) : 0;
        player.sprinting = !!sprint;
        player.sliding = !!slide;
        const mapId = mapIdOf(player);
        player.x = clampPosition(targetX, mapId);
        player.z = clampPosition(targetZ, mapId);
        if (mapId === COLISEO_MAP_ID) {
          // El 2v2 juega en un anillo mayor; el resto de formatos conserva el
          // radio original de 17 m.
          const radii = moveGame ? getColiseoRadii(moveGame.variant) : null;
          const inside = coliseoClamp(player.x, player.z, radii ? radii.play : undefined);
          player.x = inside.x;
          player.z = inside.z;
        }
        player.movedSinceSave = true;

        const moved = {
          id: socket.id,
          x: player.x,
          z: player.z,
          y: player.y,
          sprint: player.sprinting,
          slide: player.sliding,
        };
        if (player.roomCode) {
          socket.to(roomChannel(player.roomCode)).emit("player:moved", moved);
        } else {
          socket.to(LOBBY_CHANNEL).emit("player:moved", moved);
        }
      });

      socket.on("chat:message", ({ text } = {}) => {
        const clean = String(text || "").trim().slice(0, 200);
        if (!clean) return;
        if (throttle(socket, "chat", 6, 1000)) return;

        if (player.roomCode) {
          const room = rooms.get(player.roomCode);
          if (!room) return;
          room.chat.push({ name: player.name, text: clean, time: Date.now(), color: player.color });
          if (room.chat.length > MOVE_HISTORY_LIMIT) room.chat.shift();
          io.to(roomChannel(room.code)).emit("chat:message", {
            id: socket.id,
            name: player.name,
            text: clean,
            time: Date.now(),
            color: player.color,
          });
        } else {
          if (player.userId) insertMessage(player.userId, player.name, clean);
          io.to(LOBBY_CHANNEL).emit("chat:message", {
            id: socket.id,
            name: player.name,
            text: clean,
            time: Date.now(),
            color: player.color,
          });
        }
      });

      socket.on("voice:signal", (msg = {}) => {
        const { target, type, sdp, candidate } = msg;
        if (!target || target === socket.id || !type) return;
        if (throttle(socket, "voice", 30, 1000)) return;
        io.to(target).emit("voice:signal", { type, from: socket.id, sdp, candidate });
      });

      socket.on("combat:block", ({ on, yaw } = {}) => {
        const now = Date.now();
        if (Number.isFinite(yaw)) player.yaw = yaw;
        // El escudo solo se puede usar durante la ronda activa del Coliseo.
        const blockRoom = player.roomCode ? rooms.get(player.roomCode) : null;
        const blockGame = coliseoGameFor(blockRoom);
        if (blockGame && !blockGame.canFight(player.id)) return;
        if (blockRoom && blockRoom.combat === false) return;
        const cfg = getBlockConfig(player.weaponId);
        const deny = (reason) => {
          player.blocking = false;
          socket.emit("combat:block", {
            playerId: socket.id,
            blocking: false,
            stamina: Math.round(player.blockStamina),
            reason,
          });
        };

        if (!player.alive) return deny("dead");
        if (!player.roomCode) return deny("no-room");
        if (!cfg) return deny("no-shield");

        if (!on) {
          if (player.blocking) {
            player.blocking = false;
            player.blockRegenAt = now + (cfg.regenDelayMs || 600);
            io.to(roomChannel(player.roomCode)).emit("combat:block", {
              playerId: socket.id,
              blocking: false,
              stamina: Math.round(player.blockStamina),
            });
          }
          return;
        }
        if (throttle(socket, "block", 12, 1000)) return;

        if (now < player.blockBrokenUntil) {
          socket.emit("combat:block", {
            playerId: socket.id,
            blocking: false,
            stamina: 0,
            reason: "guard-break",
            brokenForMs: player.blockBrokenUntil - now,
          });
          return;
        }
        if (player.blockStamina <= 0) {
          // Idempotente: reintentar durante el castigo no debe alargarlo.
          if (now >= player.blockBrokenUntil) {
            player.blockBrokenUntil = now + (cfg.breakMs || 1200);
            player.blockRegenAt = player.blockBrokenUntil;
          }
          return deny("guard-break");
        }

        const wasBlocking = player.blocking;
        player.blocking = true;
        player.blockKeepAliveAt = now;
        player.blockRegenAt = 0;
        if (!wasBlocking) {
          io.to(roomChannel(player.roomCode)).emit("combat:block", {
            playerId: socket.id,
            blocking: true,
            stamina: Math.round(player.blockStamina),
          });
        }
      });

      socket.on("combat:shoot", ({ dx, dz } = {}) => {
        if (!player.alive) return;
        if (!player.roomCode) return;
        const room = rooms.get(player.roomCode);
        if (!room) return;
        // La isla y los minijuegos no tienen combate: sus acciones van por
        // mode:action, no por el canal de disparos.
        if (room.combat === false) return;
        const coliseoGame = coliseoGameFor(room);
        if (coliseoGame && !coliseoGame.canFight(player.id)) return;
        const weapon = player.weaponId ? getWeapon(player.weaponId) : null;
        if (!weapon) return;
        // El Coliseo solo admite el loadout melee: aunque un cliente manipulado
        // envíe un arma de fuego, el servidor la rechaza aquí.
        if (coliseoGame && (weapon.class !== "melee" || !isColiseoWeapon(weapon.id))) return;
        // Bloquear impide disparar armas de fuego; el escudo puede hacer bash.
        if (player.blocking && weapon.id !== "escudo") return;
        if (throttle(socket, "shoot", 40, 1000)) return;

        const dirX = Number(dx);
        const dirZ = Number(dz);
        if (!Number.isFinite(dirX) || !Number.isFinite(dirZ)) return;
        if (Math.hypot(dirX, dirZ) < 1e-4) return;
        let nx = dirX / Math.hypot(dirX, dirZ);
        let nz = dirZ / Math.hypot(dirX, dirZ);

        // Cadencia autoritativa por arma (el cliente también la aplica localmente).
        const shootAt = Date.now();
        if (shootAt - player.lastShotAt < weapon.cooldownMs) return;
        player.lastShotAt = shootAt;

        const zone = roomChannel(room.code);
        // En el Coliseo no hay fuego amigo: se descartan los compañeros de bando.
        const candidates = coliseoGame
          ? roomMembers(room).filter((candidate) => !coliseoGame.sameSide(player.id, candidate.id))
          : roomMembers(room);

        if (weapon.kind === "melee") {
          const arcHalf = Math.min(Math.PI, (weapon.arc || 1.5) / 2);
          const arcCos = Math.cos(arcHalf);
          let target = null;
          let bestD = weapon.range + 1;
          for (const candidate of candidates) {
            if (candidate.id === player.id || !candidate.alive) continue;
            const ox = candidate.x - player.x;
            const oz = candidate.z - player.z;
            const dist = Math.hypot(ox, oz);
            if (dist > weapon.range || dist < 1e-3) continue;
            const dot = (ox * nx + oz * nz) / dist;
            if (dot < arcCos) continue;
            if (dist < bestD) {
              bestD = dist;
              target = candidate;
            }
          }
          if (target) {
            const opts = coliseoGame
              ? { coliseo: true, onEliminated: (victim) => coliseoGame.eliminate(victim.id) }
              : {};
            damageTarget(player, target, damageAtRange(weapon, bestD), nx, nz, opts);
          }
          return;
        }

        if (weapon.kind === "splash") {
          const target = raycastHit(player, nx, nz, candidates, weapon.range, rayRadiusFor(weapon));
          const impact = target
            ? { x: target.x, z: target.z }
            : { x: player.x + nx * weapon.range, z: player.z + nz * weapon.range };
          io.to(zone).emit("combat:boom", { x: impact.x, z: impact.z, r: weapon.splash });

          let anyDamaged = false;
          for (const candidate of candidates) {
            if (candidate.id === player.id) continue;
            if (!candidate.alive) continue;
            const blastDist = distance(candidate, impact);
            if (blastDist <= weapon.splash) {
              anyDamaged = true;
              damageTarget(player, candidate, damageAtRange(weapon, blastDist), nx, nz);
            }
          }
          if (!anyDamaged) {
            io.to(zone).emit("combat:shot", {
              shooterId: player.id,
              shooterName: player.name,
              weaponId: player.weaponId,
              hit: false,
              dx: nx,
              dz: nz,
              x: impact.x,
              z: impact.z,
            });
          }
          return;
        }

        for (let i = 0; i < weapon.pellets; i++) {
          const spread = weapon.spread * (Math.random() * 2 - 1);
          const cos = Math.cos(spread);
          const sin = Math.sin(spread);
          const pdx = nx * cos - nz * sin;
          const pdz = nz * cos + nx * sin;

          const target = raycastHit(player, pdx, pdz, candidates, weapon.range, rayRadiusFor(weapon));
          const point = target
            ? { x: target.x, z: target.z }
            : { x: player.x + pdx * weapon.range, z: player.z + pdz * weapon.range };

          if (target) {
            const hitDist = Math.hypot(target.x - player.x, target.z - player.z);
            damageTarget(player, target, damageAtRange(weapon, hitDist), pdx, pdz);
          } else {
            io.to(zone).emit("combat:shot", {
              shooterId: player.id,
              shooterName: player.name,
              weaponId: player.weaponId,
              hit: false,
              dx: pdx,
              dz: pdz,
              x: point.x,
              z: point.z,
            });
          }
          if (target && !target.alive) break;
        }
      });

      socket.on("crystal:offer", ({ crystalId } = {}) => {
        const crystalError = (text) => socket.emit("crystal:error", { crystalId, error: text });
        const owner = players.get(socket.id);
        if (!owner || !owner.roomCode) return crystalError("Entra a una sala para recoger objetos");
        const room = rooms.get(owner.roomCode);
        if (!room) return crystalError("Entra a una sala para recoger objetos");
        if (throttle(socket, "crystal", 5, 1000)) return;

        const crystal = room.loot.find((c) => c.id === crystalId);
        if (!crystal) return crystalError("Ese cristal ya no está disponible");
        if (crystal.state !== "available") {
          if (crystal.offeredTo === socket.id) return;
          return crystalError("Ese cristal ya no está disponible");
        }
        if (distance(owner, crystal) > CRYSTAL_PICKUP_RANGE) {
          return crystalError("Acércate más al cristal");
        }

        if (crystal.type !== "weapon") {
          const def = getLootItem(crystal.type, crystal.itemId);
          if (def && addInventoryItem(owner, crystal.type, crystal.itemId)) {
            room.loot = room.loot.filter((c) => c.id !== crystal.id);
            room.lootPending.push({
              respawnAt: Date.now() + CRYSTAL_RESPAWN_MIN_MS + Math.random() * (CRYSTAL_RESPAWN_MAX_MS - CRYSTAL_RESPAWN_MIN_MS),
            });
            socket.emit("inventory:update", { playerId: socket.id, inventory: owner.inventory });
            socket.emit("inventory:toast", { playerId: socket.id, text: `Obtenido: ${def.name}` });
            broadcastCrystals(room);
          } else {
            socket.emit("inventory:toast", { playerId: socket.id, text: "Inventario lleno." });
          }
          return;
        }

        crystal.state = "offered";
        crystal.offeredTo = socket.id;
        crystal.offerExpire = Date.now() + CRYSTAL_OFFER_MS;
        socket.emit("crystal:offer", {
          crystalId: crystal.id,
          weaponId: crystal.weaponId,
          weaponName: getWeapon(crystal.weaponId).name,
        });
      });

      socket.on("crystal:respond", ({ crystalId, accept } = {}) => {
        const owner = players.get(socket.id);
        if (!owner || !owner.roomCode) return;
        const room = rooms.get(owner.roomCode);
        if (!room) return;

        const crystal = room.loot.find((c) => c.id === crystalId);
        if (!crystal || crystal.state !== "offered" || crystal.offeredTo !== socket.id) return;

        if (accept) {
          owner.weaponId = crystal.weaponId;
          resetBlock(owner);
          room.loot = room.loot.filter((c) => c.id !== crystalId);
          room.lootPending.push({
            respawnAt: Date.now() + CRYSTAL_RESPAWN_MIN_MS + Math.random() * (CRYSTAL_RESPAWN_MAX_MS - CRYSTAL_RESPAWN_MIN_MS),
          });
          io.to(roomChannel(room.code)).emit("crystal:equip", {
            playerId: socket.id,
            weaponId: owner.weaponId,
          });
          io.to(roomChannel(room.code)).emit("combat:block", {
            playerId: socket.id,
            blocking: false,
            stamina: BLOCK_STAMINA_MAX,
          });
          broadcastCrystals(room);
        } else {
          crystal.state = "available";
          crystal.offeredTo = null;
          crystal.offerExpire = 0;
        }
      });

      socket.on("inventory:use", ({ slot, id, type } = {}) => {
        const toast = (text) => socket.emit("inventory:toast", { playerId: socket.id, text });
        if (!player.alive) return toast("Estás eliminado: espera a reaparecer");
        // El Coliseo no tiene curación: ni comida ni objetos de apoyo.
        if (player.roomCode && isColiseoRoom(rooms.get(player.roomCode))) {
          return toast("En el Coliseo no se puede curar");
        }
        if (player.roomCode && isEsconditeRoom(rooms.get(player.roomCode))) {
          return toast("En el Escondite no se puede curar");
        }
        if (player.roomCode && isTntRoom(rooms.get(player.roomCode))) {
          return toast("En TNT Run no se puede curar");
        }
        if (throttle(socket, "inv", 2, 400)) return;

        const idx = Number(slot);
        if (!Number.isInteger(idx) || idx < 0 || idx >= player.inventory.length) {
          return toast("Ese espacio está vacío");
        }
        const item = player.inventory[idx];
        if (id !== undefined && (item.id !== id || item.type !== type)) {
          socket.emit("inventory:update", { playerId: socket.id, inventory: player.inventory });
          return toast("El inventario cambió. Inténtalo de nuevo.");
        }
        if (item.type !== "food") return toast("Ese objeto no se puede comer");
        const def = getFood(item.id);
        if (!def) return toast("Ese objeto no se puede usar");
        if (player.hp >= MAX_HP) return toast("Ya tienes la vida al máximo");

        player.hp = Math.min(MAX_HP, player.hp + def.heal);
        item.qty -= 1;
        if (item.qty <= 0) player.inventory.splice(idx, 1);
        const zone = playerChannel(player);
        io.to(zone).emit("combat:heal", { targetId: socket.id, targetHp: player.hp });
        socket.emit("inventory:update", { playerId: socket.id, inventory: player.inventory });
        toast(`Comiste ${def.name} (+${def.heal} HP)`);
      });

      socket.on("inventory:throw", ({ slot, id, type, dx, dz } = {}) => {
        const toast = (text) => socket.emit("inventory:toast", { playerId: socket.id, text });
        if (!player.roomCode) return toast("Entra a una sala para lanzar objetos");
        const room = rooms.get(player.roomCode);
        if (!room) return toast("Entra a una sala para lanzar objetos");
        if (room.combat === false) return toast("Aquí no se pueden lanzar objetos");
        // El Coliseo es solo melee: se bloquean lanzables aunque el cliente los
        // tenga en el inventario de la cuenta.
        if (isColiseoRoom(room)) return toast("En el Coliseo no se pueden lanzar objetos");
        if (!player.alive) return toast("Estás eliminado: espera a reaparecer");
        if (throttle(socket, "throw", 20, 1000)) return;

        const idx = Number(slot);
        if (!Number.isInteger(idx) || idx < 0 || idx >= player.inventory.length) {
          return toast("Ese espacio está vacío");
        }
        const item = player.inventory[idx];
        if (id !== undefined && (item.id !== id || item.type !== type)) {
          socket.emit("inventory:update", { playerId: socket.id, inventory: player.inventory });
          return toast("El inventario cambió. Inténtalo de nuevo.");
        }
        if (item.type !== "throwable") return toast("Ese objeto no se puede lanzar");
        const def = getThrowable(item.id);
        if (!def) return toast("Ese objeto no se puede lanzar");
        const now = Date.now();
        if (now - player.lastThrowAt < def.cooldownMs) {
          return toast(`Espera un momento para volver a lanzar ${def.name}`);
        }

        const dirX = Number(dx);
        const dirZ = Number(dz);
        if (!Number.isFinite(dirX) || !Number.isFinite(dirZ)) return toast("No se pudo lanzar el objeto");
        const len = Math.hypot(dirX, dirZ);
        if (len < 1e-4) return toast("No se pudo lanzar el objeto");
        const nx = dirX / len;
        const nz = dirZ / len;

        player.lastThrowAt = now;
        item.qty -= 1;
        if (item.qty <= 0) player.inventory.splice(idx, 1);
        socket.emit("inventory:update", { playerId: socket.id, inventory: player.inventory });

        const zone = roomChannel(room.code);
        const candidates = roomMembers(room);
        const start = { x: player.x, z: player.z };
        const end = { x: player.x + nx * def.range, z: player.z + nz * def.range };

        let boomPoint = end;
        let hitTarget = null;
        const hitR = item.id === "granada" ? 1.0 : 0.9;
        for (const candidate of candidates) {
          if (candidate.id === player.id || !candidate.alive) continue;
          const along = ((candidate.x - start.x) * nx + (candidate.z - start.z) * nz) / def.range;
          const t = Math.max(0, Math.min(1, along));
          const px = start.x + nx * def.range * t;
          const pz = start.z + nz * def.range * t;
          if (Math.hypot(candidate.x - px, candidate.z - pz) <= hitR) {
            hitTarget = candidate;
            boomPoint = { x: px, z: pz };
            break;
          }
        }

        const flightDist = Math.hypot(boomPoint.x - start.x, boomPoint.z - start.z);
        const flightMs = Math.max(80, Math.round((flightDist / def.speed) * 1000));
        throwSeq += 1;
        io.to(zone).emit("item:spawn", {
          id: throwSeq,
          type: item.id,
          ownerId: player.id,
          x: start.x,
          z: start.z,
          toX: boomPoint.x,
          toZ: boomPoint.z,
          flightMs,
          snow: item.id === "bola_nieve",
        });

        if (item.id === "bola_nieve") {
          if (hitTarget) {
            damageTarget(player, hitTarget, def.damage, nx, nz);
            hitTarget.slowUntil = now + def.slowMs;
            io.to(zone).emit("combat:slow", { targetId: hitTarget.id, until: def.slowMs });
          }
        } else {
          for (const candidate of candidates) {
            if (candidate.id === player.id || !candidate.alive) continue;
            if (distance(candidate, boomPoint) <= def.splash) {
              damageTarget(player, candidate, def.damage);
            }
          }
        }

        setTimeout(() => {
          io.to(zone).emit("combat:boom", {
            x: boomPoint.x,
            z: boomPoint.z,
            r: def.splash,
            snow: item.id === "bola_nieve",
          });
        }, flightMs);
      });

      socket.on("room:create", ({ name, mapId } = {}) => {
        const roomOwner = players.get(socket.id);
        if (!roomOwner) return;
        if (throttle(socket, "room", 5, 1000)) return roomError(socket, "Demasiadas acciones. Espera un momento.");
        if (roomOwner.roomCode) {
          const current = rooms.get(roomOwner.roomCode);
          // Crear una sala desde la isla o un modo es válido: se abandona esa
          // zona. Desde otra sala privada hay que salir primero.
          if (!current || current.kind === "room") return roomError(socket, "Ya estás en una sala.");
          detachFromRoom(socket, roomOwner);
        } else {
          socket.leave(LOBBY_CHANNEL);
          socket.to(LOBBY_CHANNEL).emit("player:left", { id: socket.id });
        }
        if (visibleRooms().length >= MAX_ROOMS) return roomError(socket, "Hay demasiadas salas abiertas.");

        const code = randomRoomCode();
        const cleanedName = String(name || "").trim().slice(0, 20);
        const chosenMap = ROOM_MAP_IDS.includes(mapId)
          ? mapId
          : ROOM_MAP_IDS[Math.floor(Math.random() * ROOM_MAP_IDS.length)];
        const room = {
          code,
          name: cleanedName || `Sala ${code}`,
          mapId: chosenMap,
          ownerId: socket.id,
          ownerName: player.name,
          members: new Set([socket.id]),
          chat: [],
          kind: "room",
          status: "open",
          combat: true,
          maxPlayers: MAX_ROOM_MEMBERS,
        };
        rooms.set(code, room);
        roomOwner.roomCode = code;
        roomOwner.weaponId = null;
        spawnRoomCrystals(room, chosenMap);

        socket.join(roomChannel(code));

        socket.emit("welcome", { id: socket.id, players: roomMembers(room).map(playerSnapshot) });
        socket.emit("chat:history", []);
        socket.emit("room:state", { room: publicRoom(room), hosting: true });
        socket.emit("crystal:equip", { playerId: socket.id, weaponId: null });
        socket.emit("inventory:update", { playerId: socket.id, inventory: player.inventory });
        socket.emit("crystal:state", {
          crystals: room.loot.map((c) => ({ id: c.id, x: c.x, z: c.z, type: c.type })),
        });
        sendScoreState(roomOwner, socket);
        sendScoreProfile(socket, roomOwner);
        broadcastRoomList();
        console.log(`[rooms] ${player.name} creó la sala ${code} ("${room.name}")`);
      });

      socket.on("room:join", ({ code } = {}) => {
        const joiner = players.get(socket.id);
        if (!joiner) return;
        if (throttle(socket, "room", 5, 1000)) return roomError(socket, "Demasiadas acciones. Espera un momento.");
        if (joiner.roomCode) {
          const current = rooms.get(joiner.roomCode);
          if (!current || current.kind === "room") return roomError(socket, "Ya estás en una sala.");
          // Desde la isla o un minijuego sí se puede entrar a una sala privada;
          // moveSocketToRoom se encarga de abandonar la zona anterior.
        }

        const roomCode = String(code || "").trim().toUpperCase();
        const room = rooms.get(roomCode);
        if (!room || room.hidden) return roomError(socket, "No existe esa sala.");
        if (room.members.size >= MAX_ROOM_MEMBERS) return roomError(socket, "La sala está llena.");

        moveSocketToRoom(socket, joiner, room);
        console.log(`[rooms] ${player.name} se unió a la sala ${room.code}`);
      });

      socket.on("room:leave", () => {
        const leaver = players.get(socket.id);
        if (!leaver || !leaver.roomCode) return;
        moveSocketToLobby(socket, leaver);
      });

      // Entrar a la isla de minijuegos. Se permite desde el lobby (portal o
      // botón del menú) y desde otra zona social, nunca desde una sala privada.
      socket.on("hub:enter", () => {
        const visitor = players.get(socket.id);
        if (!visitor) return;
        if (throttle(socket, "room", 5, 1000)) return roomError(socket, "Demasiadas acciones. Espera un momento.");
        moveSocketToHub(socket, visitor);
      });

      // Entrar a un minijuego: hay que estar en la isla y cerca del portal.
      // El radio del servidor (6 m) es mayor que el del aviso (3,2 m) para
      // tolerar el retardo de red sin abrir la puerta a teletransportes.
      socket.on("mode:join", ({ modeId, variant, rejoin } = {}) => {
        const visitor = players.get(socket.id);
        if (!visitor) return;
        if (throttle(socket, "mode", 6, 1000)) {
          return socket.emit("mode:error", { error: "Demasiadas acciones. Espera un momento." });
        }
        const def = getMode(modeId);
        if (!def) return socket.emit("mode:error", { error: "Ese minijuego no existe." });
        if (def.status !== "live") {
          return socket.emit("mode:error", { error: `${def.name} todavía no está disponible.` });
        }
        // Los modos con formatos exigen una variante válida; si no llega, se
        // usa la primera (1v1) para no romper clientes antiguos.
        let variantId = null;
        if (Array.isArray(def.variants) && def.variants.length) {
          variantId = variant || def.variants[0].id;
          if (!getModeVariant(def.id, variantId)) {
            return socket.emit("mode:error", { error: "Ese formato no existe." });
          }
        }

        // Reconexión al Escondite o a TNT Run: el controlador decide si sigue
        // vigente la reserva para esta cuenta o nombre de invitado.
        const rejoinAvailable =
          !!rejoin &&
          (def.id === "escondite" || def.id === "tnt") &&
          (() => {
            const target = ensureModeRoom(def.id, variantId);
            const targetGame = target ? modeGames.get(target.code) : null;
            return (
              !!targetGame &&
              !!targetGame.canRejoin &&
              targetGame.canRejoin({ userId: visitor.userId, name: visitor.name })
            );
          })();

        const current = visitor.roomCode ? rooms.get(visitor.roomCode) : null;
        if (current && current.kind === "room") {
          return socket.emit("mode:error", { error: "Sal de la sala para entrar a un minijuego." });
        }
        if (current && current.kind === "mode") {
          const sameVariant = (current.variant || null) === variantId;
          if (current.modeId === def.id && sameVariant) {
            return moveSocketToMode(socket, visitor, current);
          }
          return socket.emit("mode:error", {
            error:
              current.modeId === def.id
                ? "Vuelve a la isla para cambiar de formato."
                : "Vuelve a la isla para entrar a otro minijuego.",
          });
        }
        if ((!current || current.kind !== "hub") && !rejoinAvailable) {
          return socket.emit("mode:error", { error: "Entra a la isla para elegir un minijuego." });
        }
        if (!rejoinAvailable) {
          const portal = nearestPortal(visitor.x, visitor.z, HUB_PORTALS, 6);
          if (!portal || portal.modeId !== def.id) {
            return socket.emit("mode:error", { error: "Acércate al portal para entrar." });
          }
        }
        const room = ensureModeRoom(def.id, variantId);
        if (!room) return socket.emit("mode:error", { error: "Ese minijuego no está listo." });
        if (!room.members.has(visitor.id) && !rejoinAvailable) {
          // Una partida en curso está cerrada aunque quede aforo: el aviso lo
          // decide el controlador antes que el recuento de la sala.
          const game = modeGames.get(room.code);
          const state = game ? game.snapshot() : null;
          const inProgress =
            !!state &&
            [
              "fight",
              "roundEnd",
              "matchEnd", // Coliseo
              "hide",
              "seek", // Escondite
              "countdown",
              "playing", // TNT Run
            ].includes(state.phase);
          if (inProgress) {
            return socket.emit("mode:error", {
              error: "La partida ya está en marcha. Espera al reinicio.",
            });
          }
          if (room.members.size >= room.maxPlayers) {
            return socket.emit("mode:error", { error: "La partida está llena." });
          }
        }
        moveSocketToMode(socket, visitor, room);
      });

      // Volver a la isla desde un minijuego.
      socket.on("mode:leave", () => {
        const visitor = players.get(socket.id);
        if (!visitor) return;
        if (throttle(socket, "room", 5, 1000)) return;
        moveSocketToHub(socket, visitor);
      });

      // Acciones del minijuego: elegir equipo (plataforma) o voltear una carta
      // saltando encima. La carta se deduce de la posición autoritativa del
      // servidor, nunca de un índice elegido por el cliente.
      socket.on("mode:action", (payload = {}) => {
        const visitor = players.get(socket.id);
        if (!visitor || !visitor.roomCode) return;
        const room = rooms.get(visitor.roomCode);
        if (!room || room.kind !== "mode") return;
        if (throttle(socket, "modeact", 12, 1000)) return;
        const game = modeGames.get(room.code);
        if (!game) return;

        const result = game.action(visitor.id, payload, { x: visitor.x, z: visitor.z });
        if (!result.ok) {
          const messages = {
            "not-your-turn": "Es el turno del otro equipo.",
            wait: "Espera a que se oculten las cartas.",
            matched: "Esa pareja ya está encontrada.",
            "already-flipped": "Esa carta ya está boca arriba.",
            "not-on-card": "Ponte encima de una carta y salta.",
            "no-team": "Pisa una plataforma para elegir equipo.",
            "not-playing": "La partida todavía no ha empezado.",
            "not-waiting": "La partida ya está en marcha.",
            "team-full": "Ese equipo está completo.",
            "not-on-pad": "Pisa la plataforma del equipo.",
            "bad-team": "Equipo no válido.",
            "bad-weapon": "Esa arma no está permitida en el Coliseo.",
            "in-progress": "La partida ya está en marcha.",
            "wrong-phase": "Ahora mismo no puedes hacer eso.",
            "wrong-role": "Esa habilidad es solo del buscador o del escondido.",
            "not-ready": "La habilidad todavía está recargando.",
            "bad-target": "Ese jugador no puede ser etiquetado.",
            dodged: "El escondido esquivó la etiqueta.",
            "bad-position": "No se pudo calcular la distancia.",
            "too-far": "Estás demasiado lejos para etiquetar.",
            blocked: "Hay una cobertura de por medio.",
            "not-adjacent": "No puedes cruzar más de un bloque a la vez.",
            "too-fast": "Vas demasiado rápido por la isla.",
            eliminated: "Ya estás eliminado de esta partida.",
            "unknown-action": "Esa acción no existe.",
          };
          const message = messages[result.reason];
          if (message) socket.emit("mode:error", { error: message });
        }
      });

      socket.on("room:kick", ({ targetId } = {}) => {
        const host = players.get(socket.id);
        const room = host && host.roomCode ? rooms.get(host.roomCode) : null;
        if (!room || room.ownerId !== socket.id) return;
        if (!targetId || targetId === socket.id || !room.members.has(targetId)) return;

        const targetSocket = io.sockets.sockets.get(targetId);
        const target = players.get(targetId);
        if (!targetSocket || !target) return;

        io.to(targetId).emit("room:kicked", { code: room.code, name: room.name });
        moveSocketToLobby(targetSocket, target);
        console.log(`[rooms] ${player.name} expulsó a ${target.name} de la sala ${room.code}`);
      });

      socket.on("room:close", () => {
        const host = players.get(socket.id);
        const room = host && host.roomCode ? rooms.get(host.roomCode) : null;
        if (!room || room.ownerId !== socket.id) return;

        const code = room.code;
        const name = room.name;
        const memberIds = [...room.members];
        io.to(roomChannel(code)).emit("room:closed", { code, name });
        rooms.delete(code);
        broadcastRoomList();

        for (const id of memberIds) {
          const memberSocket = io.sockets.sockets.get(id);
          const member = players.get(id);
          if (memberSocket && member) {
            moveSocketToLobby(memberSocket, member, { notifyOldRoom: false });
          }
        }
        console.log(`[rooms] ${player.name} cerró la sala ${code}`);
      });

      // Tienda de armas: solo dentro de salas, con puntos de la sesión.
      // El cliente nunca envía precios; el servidor los toma de WEAPONS.
      socket.on("shop:buy", ({ weaponId } = {}) => {
        const buyer = players.get(socket.id);
        if (!buyer) return;
        const score = Math.max(0, Math.round(buyer.score || 0));
        const deny = (reason, extra = {}) =>
          socket.emit("shop:result", { ok: false, reason, weaponId: weaponId || null, score, ...extra });

        if (!buyer.alive) return deny("dead");
        if (!buyer.roomCode) return deny("no-room");
        const shopRoom = rooms.get(buyer.roomCode);
        if (!shopRoom || shopRoom.kind !== "room") return deny("no-room");
        if (throttle(socket, "shop", 6, 1000)) return deny("throttle");
        const id = typeof weaponId === "string" ? weaponId : "";
        if (!Object.prototype.hasOwnProperty.call(WEAPONS, id)) return deny("unknown");
        const def = WEAPONS[id];

        if (buyer.weaponId === def.id) {
          socket.emit("shop:result", {
            ok: true,
            weaponId: def.id,
            price: 0,
            score,
            alreadyEquipped: true,
          });
          return;
        }

        const price = Math.max(0, Math.round(def.price || 0));
        if (score < price) return deny("insufficient", { price });

        buyer.score = score - price;
        buyer.weaponId = def.id;
        resetBlock(buyer);
        const zone = roomChannel(buyer.roomCode);
        io.to(zone).emit("crystal:equip", { playerId: buyer.id, weaponId: def.id });
        io.to(zone).emit("combat:block", {
          playerId: buyer.id,
          blocking: false,
          stamina: BLOCK_STAMINA_MAX,
        });
        emitScoreUpdate(buyer, -price, "shop");
        socket.emit("shop:result", { ok: true, weaponId: def.id, price, score: buyer.score });
      });

      socket.on("disconnect", () => {
        if (player.respawnTimer) {
          clearTimeout(player.respawnTimer);
          player.respawnTimer = null;
        }
        if (player.roomCode) {
          const room = rooms.get(player.roomCode);
          if (room) {
            socket.to(roomChannel(room.code)).emit("player:left", { id: socket.id });
          }
          removeFromRoom(player, "disconnect");
        } else {
          socket.to(LOBBY_CHANNEL).emit("player:left", { id: socket.id });
        }

        players.delete(socket.id);
        hockeyPrev.delete(socket.id);
        hockeyScores.delete(socket.id);
        for (const room of rooms.values()) {
          for (const crystal of room.loot) {
            if (crystal.offeredTo === socket.id) {
              crystal.state = "available";
              crystal.offeredTo = null;
              crystal.offerExpire = 0;
            }
          }
        }
        if (player.movedSinceSave && player.userId) {
          saveUserPosition(player.userId, player.x, player.z);
        }
        broadcastRoomList();
        console.log(`[game] ${player.name} salió`);
      });
    });
  });

  setInterval(() => {
    for (const player of players.values()) {
      if (player.movedSinceSave && player.userId) {
        saveUserPosition(player.userId, player.x, player.z);
        player.movedSinceSave = false;
      }
    }
  }, POSITION_SAVE_MS);

  setInterval(() => {
    const now = Date.now();
    for (const player of players.values()) {
      if (!player.alive) continue;
      if (player.hp >= MAX_HP) continue;
      if (player.lastShotAt && now - player.lastShotAt < 8000) continue;
      player.hp = Math.min(MAX_HP, player.hp + 8);
      io.to(playerChannel(player)).emit("combat:regen", { targetId: player.id, targetHp: Math.round(player.hp) });
    }
  }, 10000);

  // Aguante del escudo: drena mientras se bloquea y regenera al soltar.
  setInterval(() => {
    const now = Date.now();
    for (const player of players.values()) {
      const cfg = getBlockConfig(player.weaponId);
      if (player.blocking) {
        // 1,2 s de margen: el cliente reenvía cada ~140 ms, pero un parón del
        // navegador (pestaña en segundo plano, GC) no debe bajar el escudo.
        if (!cfg || !player.alive || now - player.blockKeepAliveAt > 1200) {
          player.blocking = false;
          player.blockRegenAt = now + (cfg ? cfg.regenDelayMs || 600 : 600);
          if (player.roomCode) {
            io.to(roomChannel(player.roomCode)).emit("combat:block", {
              playerId: player.id,
              blocking: false,
              stamina: Math.round(player.blockStamina),
            });
          }
          continue;
        }
        player.blockStamina = Math.max(0, player.blockStamina - (cfg.staminaDrain || 28) * 0.1);
        if (player.blockStamina <= 0) {
          player.blocking = false;
          player.blockBrokenUntil = now + (cfg.breakMs || 1200);
          player.blockRegenAt = player.blockBrokenUntil;
          const zone = playerChannel(player);
          io.to(zone).emit("combat:block", {
            playerId: player.id,
            blocking: false,
            stamina: 0,
            guardBreak: true,
          });
          io.to(zone).emit("combat:blocked", {
            targetId: player.id,
            x: player.x,
            z: player.z,
            damage: 0,
            guardBreak: true,
          });
        } else {
          io.to(player.id).emit("combat:block", {
            playerId: player.id,
            blocking: true,
            stamina: Math.round(player.blockStamina),
          });
        }
      } else if (player.blockStamina < BLOCK_STAMINA_MAX && now >= player.blockRegenAt) {
        const regen = cfg ? (cfg.regen || 14) : 14;
        player.blockStamina = Math.min(BLOCK_STAMINA_MAX, player.blockStamina + regen * 0.1);
        io.to(player.id).emit("combat:block", {
          playerId: player.id,
          blocking: false,
          stamina: Math.round(player.blockStamina),
        });
      }
    }
  }, 100);

  setInterval(tickHockey, HOCKEY_TICK_MS);
  setInterval(crystalTick, 1000);
  setInterval(modeTick, MODE_TICK_MS);
  if (tntController) setInterval(tntTick, TNT_TICK_MS);
}