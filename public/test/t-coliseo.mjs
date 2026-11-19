// Suite del Coliseo melee (Ola 2).
//
// Cubre tres capas:
//  1. Contrato compartido: formatos, loadout melee, spawns y limite circular.
//  2. Controlador autoritativo: equipos, listo, rondas, muertes y revancha.
//  3. Servidor real con Socket.IO simulado: entrada desde el portal, solo
//     melee, movimiento limitado a la ronda, sin respawn y persistencia.

import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

process.env.DB_PATH = path.join(os.tmpdir(), "pingui-coliseo-" + Date.now() + ".db");

const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const url = (rel) => pathToFileURL(path.join(PROJ, rel)).href;

const results = [];
function t(name, ok, extra = "") {
  results.push({ name, ok, extra });
  if (!ok) console.log("FAIL: " + name + (extra ? " | " + extra : ""));
  else console.log("ok  : " + name);
}
function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg}: espere ${JSON.stringify(expected)} pero hay ${JSON.stringify(actual)}`);
  }
}
function run(name, fn) {
  try {
    fn();
    t(name, true);
  } catch (e) {
    t(name, false, e.message);
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------- modulos puros
const DEF = await import(url("public/js/coliseoDefs.js"));
const MODE = await import(url("public/js/modeDefs.js"));
const HUB = await import(url("public/js/hubDefs.js"));
const MAPS = await import(url("public/js/mapDefs.js"));
const OBS = await import(url("public/js/mapObstacles.js"));
const WEAPONS = await import(url("public/js/weaponDefs.js"));
const COLISEO = await import(url("server/modes/coliseo.js"));
const DB = await import(url("server/db.js"));

run("01 defs: formatos, loadout melee y sala por variante", () => {
  eq(DEF.COLISEO_VARIANTS.map((v) => v.id).join(","), "1v1,2v2,ffa", "formatos");
  eq(DEF.COLISEO_WEAPONS.length, 5, "cinco armas melee");
  for (const weapon of DEF.COLISEO_WEAPONS) {
    const def = WEAPONS.getWeapon(weapon.id);
    if (!def) throw new Error(`arma inexistente: ${weapon.id}`);
    eq(def.class, "melee", `${weapon.id} es melee`);
    eq(DEF.isColiseoWeapon(weapon.id), true, `${weapon.id} esta en el loadout`);
  }
  eq(DEF.isColiseoWeapon("pistola"), false, "la pistola queda fuera");
  eq(DEF.isColiseoWeapon("francotirador"), false, "el francotirador queda fuera");
  eq(MODE.getMode("coliseo").status, "live", "Coliseo en vivo");
  eq(MODE.getMode("coliseo").combat, true, "Coliseo habilita combate");
  eq(MODE.getMode("coliseo").variants.length, 3, "tres formatos en modeDefs");
  eq(MODE.modeRoomCode("coliseo", "1v1"), "MODO-COLISEO-1V1", "sala 1v1");
  eq(MODE.modeRoomCode("coliseo", "ffa"), "MODO-COLISEO-FFA", "sala FFA");
  eq(MODE.liveModes().map((m) => m.id).join(","), "pares,coliseo", "dos modos live");
});

run("02 mapa: arena circular, obstaculos y limite compartido", () => {
  const map = MAPS.getMap("coliseo");
  eq(map.size, 52, "tamano del mapa");
  eq(map.room, false, "no aparece como sala privada");
  eq(MAPS.getRoomMaps().some((m) => m.id === "coliseo"), false, "fuera del selector de salas");
  const obstacles = OBS.MAP_OBSTACLES.coliseo;
  eq(obstacles.length, 8, "cuatro pilares y cuatro rocas");
  eq(obstacles.filter((o) => o.kind === "pillar").length, 4, "pilares");
  eq(obstacles.filter((o) => o.kind === "rock").length, 4, "rocas");
  eq(OBS.isInsideObstacle("coliseo", 0, 0, 0.2), false, "centro libre");
  const boundary = MAPS.getMapBoundary("coliseo");
  for (const o of obstacles) {
    if (Math.abs(o.x) > boundary || Math.abs(o.z) > boundary) {
      throw new Error(`obstaculo fuera del mapa: ${o.kind}`);
    }
  }
  const portal = HUB.HUB_PORTALS.find((p) => p.modeId === "coliseo");
  if (!portal) throw new Error("falta el portal del Coliseo");
  eq(portal.status, "live", "portal activo");
});

run("03 spawns: dentro del circulo y mirando al centro", () => {
  for (const variant of DEF.COLISEO_VARIANTS) {
    const def = DEF.getColiseoVariant(variant.id);
    const count = variant.mode === "ffa" ? variant.maxPlayers : variant.teamSize * 2;
    for (let i = 0; i < count; i++) {
      const side = variant.mode === "ffa" ? i : i % 2;
      const member = variant.mode === "ffa" ? 0 : Math.floor(i / 2);
      const spawn = DEF.coliseoSpawn(def, side, member);
      const dist = Math.hypot(spawn.x, spawn.z);
      if (dist > DEF.COLISEO_PLAY_RADIUS) {
        throw new Error(`spawn fuera del circulo (${variant.id}): ${dist}`);
      }
      if (dist > 0.5) {
        const expected = Math.atan2(-spawn.x, -spawn.z);
        if (Math.abs(spawn.yaw - expected) > 0.02) {
          throw new Error(`spawn no mira al centro (${variant.id}): ${spawn.yaw} vs ${expected}`);
        }
      }
    }
  }
  eq(DEF.coliseoSideForIndex(DEF.getColiseoVariant("1v1"), 0), "cian", "primer lado cian");
  eq(DEF.coliseoSideForIndex(DEF.getColiseoVariant("1v1"), 1), "rosa", "segundo lado rosa");
  eq(DEF.coliseoSideForIndex(DEF.getColiseoVariant("ffa"), 0), null, "FFA sin bandos");
});

run("04 clamp: el borde circular no se atraviesa", () => {
  const inside = DEF.coliseoClamp(3, 4);
  eq(inside.x, 3, "x interior intacta");
  eq(inside.z, 4, "z interior intacta");
  const out = DEF.coliseoClamp(100, 0);
  eq(Math.round(Math.hypot(out.x, out.z) * 100) / 100, DEF.COLISEO_PLAY_RADIUS, "recorta al radio");
  eq(DEF.coliseoInside(0, 0), true, "el centro esta dentro");
  eq(DEF.coliseoInside(30, 0), false, "fuera del muro");
  eq(DEF.coliseoClamp(0, 0).x, 0, "el origen no se mueve");
});

// ------------------------------------------------------- controlador puro
function controller(nowRef, variant = "1v1") {
  return COLISEO.createColiseoGame({ now: () => nowRef.value, variant });
}

run("05 controlador: equipos, listo, cuenta atras y primera ronda", () => {
  const clock = { value: 1000 };
  const game = controller(clock);
  const events = [];
  game.join({ id: "A", name: "Alfa" });
  game.join({ id: "B", name: "Beta" });
  let snap = game.snapshot();
  eq(snap.phase, "waiting", "espera jugadores");
  eq(snap.players.map((p) => p.side).join(","), "cian,rosa", "bandos alternos");
  eq(snap.scores.map((s) => s.score).join(","), "0,0", "marcador a cero");
  eq(game.canFight("A"), false, "no se lucha en espera");

  eq(game.join({ id: "C", name: "Gamma" }).reason, "full", "aforo 1v1");
  eq(game.action("A", { type: "weapon", weaponId: "pistola" }).reason, "bad-weapon", "arma no permitida");
  eq(game.action("A", { type: "weapon", weaponId: "maza" }).ok, true, "arma melee aceptada");
  eq(game.action("A", { type: "ready" }).ok, true, "A listo");
  eq(game.snapshot().phase, "waiting", "falta B");
  eq(game.action("B", { type: "ready" }).ok, true, "B listo");

  clock.value += 100;
  eq(game.tick(), true, "todos listos abre cuenta atras");
  snap = game.snapshot();
  eq(snap.phase, "countdown", "fase countdown");
  if (snap.countdownMs <= 0) throw new Error("la cuenta atras debe durar");

  clock.value += 3300;
  eq(game.tick(), true, "termina la cuenta atras");
  snap = game.snapshot();
  eq(snap.phase, "fight", "fase fight");
  eq(snap.round, 1, "primera ronda");
  eq(game.canFight("A"), true, "A puede luchar");
  eq(snap.players.find((p) => p.id === "A").weaponId, "maza", "arma equipada");
});

run("06 controlador: muertes, rondas y partido al mejor de 5", () => {
  const clock = { value: 2000 };
  const game = controller(clock);
  game.join({ id: "A", name: "Alfa" });
  game.join({ id: "B", name: "Beta" });
  game.action("A", { type: "ready" });
  game.action("B", { type: "ready" });
  clock.value += 100;
  game.tick();
  clock.value += 3300;
  game.tick();

  eq(game.eliminate("B"), true, "la baja cierra la ronda");
  let snap = game.snapshot();
  eq(snap.phase, "roundEnd", "fin de ronda");
  eq(snap.scores.find((s) => s.id === "cian").score, 1, "cian suma la ronda");
  eq(snap.lastRound.reason, "wipe", "ronda decidida por baja");
  eq(snap.winner, null, "aun no hay ganador del partido");

  clock.value += 3300;
  game.tick();
  eq(game.snapshot().phase, "countdown", "vuelve la cuenta atras");
  clock.value += 3300;
  game.tick();
  eq(game.snapshot().phase, "fight", "segunda ronda");

  game.eliminate("B");
  clock.value += 3300;
  game.tick();
  clock.value += 3300;
  game.tick();
  game.eliminate("B");
  clock.value += 3300;
  game.tick();
  clock.value += 3300;
  game.tick();
  snap = game.snapshot();
  eq(snap.phase, "matchEnd", "partido decidido a 3 rondas");
  eq(snap.winner.id, "cian", "gana el equipo cian");
  eq(snap.winner.kind, "team", "el ganador es un equipo");
  eq(game.eliminate("A"), false, "la partida cerrada no reparte mas rondas");
  eq(game.snapshot().phase, "matchEnd", "la partida sigue cerrada");

  clock.value += 12000;
  eq(game.tick(), true, "la revancha reinicia");
  snap = game.snapshot();
  eq(snap.phase, "waiting", "vuelve la espera");
  eq(snap.scores.every((s) => s.score === 0), true, "marcador limpio");
  eq(snap.players.every((p) => p.ready === false), true, "todos deben marcar listo");
});

run("07 controlador FFA: cada jugador es su propio bando", () => {
  const clock = { value: 3000 };
  const game = controller(clock, "ffa");
  for (const id of ["A", "B", "C"]) game.join({ id, name: id });
  let snap = game.snapshot();
  eq(snap.players.map((p) => p.side).join(","), "A,B,C", "bandos por jugador");
  eq(new Set(snap.scores.map((s) => s.color)).size, 3, "colores distintos");
  for (const id of ["A", "B", "C"]) game.action(id, { type: "ready" });
  clock.value += 100;
  game.tick();
  clock.value += 3300;
  game.tick();
  eq(game.snapshot().phase, "fight", "FFA empieza con tres");

  game.eliminate("A");
  eq(game.snapshot().phase, "fight", "con dos vivos la ronda sigue");
  game.eliminate("B");
  snap = game.snapshot();
  eq(snap.phase, "roundEnd", "queda un solo bando");
  eq(snap.scores.find((s) => s.id === "C").score, 1, "C gana la ronda");
});

run("08 controlador: no se entra a una partida en curso", () => {
  const clock = { value: 4000 };
  const game = controller(clock);
  game.join({ id: "A", name: "Alfa" });
  game.join({ id: "B", name: "Beta" });
  game.action("A", { type: "ready" });
  game.action("B", { type: "ready" });
  clock.value += 100;
  game.tick();
  clock.value += 3300;
  game.tick();
  eq(game.snapshot().phase, "fight", "partida en marcha");
  eq(game.join({ id: "C", name: "Gamma" }).reason, "in-progress", "join rechazado");
  game.leave("B");
  eq(game.snapshot().phase, "roundEnd", "el abandono cierra la ronda");
});

run("09 db: duel_wins y duel_rounds se acumulan", () => {
  const userId = DB.createUser("duelista", "hash", "#ffffff", null);
  DB.recordUserStats(userId, { duelWins: 1, duelRounds: 3 });
  let stats = DB.getUserStats(userId);
  eq(stats.duel_wins, 1, "una victoria");
  eq(stats.duel_rounds, 3, "tres rondas");
  DB.recordUserStats(userId, { duelWins: 0, duelRounds: 2 });
  stats = DB.getUserStats(userId);
  eq(stats.duel_wins, 1, "las victorias se suman");
  eq(stats.duel_rounds, 5, "las rondas se suman");
});

// ------------------------------------------------------ servidor con stubs
let clock = 5_000_000;
Date.now = () => clock;
const timers = [];
global.setTimeout = (fn, ms) => {
  const h = { fn, ms, cleared: false, interval: false };
  timers.push(h);
  return h;
};
global.setInterval = (fn, ms) => {
  const h = { fn, ms, cleared: false, interval: true };
  timers.push(h);
  return h;
};
global.clearTimeout = (h) => {
  if (h) h.cleared = true;
};
global.clearInterval = (h) => {
  if (h) h.cleared = true;
};

Math.random = mulberry32(20261118);

const emitted = [];
const io = {
  on(ev, fn) {
    if (ev === "connection") io._conn = fn;
  },
  to(ch) {
    return { emit: (e, d) => emitted.push({ ch, e, d }) };
  },
  emit(e, d) {
    emitted.push({ ch: "*", e, d });
  },
  sockets: { sockets: { get: (id) => io._sock.get(id) } },
  _sock: new Map(),
  connect(s) {
    io._sock.set(s.id, s);
    io._conn(s);
  },
};
const mk = (id) => {
  const s = {
    id,
    data: {},
    rooms: new Set(),
    on(e, fn) {
      (s._h ||= {})[e] = fn;
    },
    emit(e, d) {
      emitted.push({ ch: "#" + id, e, d });
    },
    to(ch) {
      return { emit: (e, d) => emitted.push({ ch, e, d }) };
    },
    join(ch) {
      s.rooms.add(ch);
    },
    leave(ch) {
      s.rooms.delete(ch);
    },
    _h: {},
  };
  io._sock.set(s.id, s);
  return s;
};
const fire = (s, e, d) => (s._h[e] ? s._h[e](d) : undefined);

const find = (e, pred, from = 0) => {
  for (let i = emitted.length - 1; i >= from; i--) {
    const x = emitted[i];
    if (x.e === e && (!pred || pred(x))) return x;
  }
  return null;
};
const lastFor = (e, id, from = 0) => find(e, (x) => x.ch === "#" + id, from);
const roomEmit = (e, code, from = 0) => find(e, (x) => x.ch === "room:" + code, from);

const welcomePos = (id) => {
  const w = find("welcome", (x) => x.ch === "#" + id);
  if (!w || !Array.isArray(w.d.players)) return null;
  const p = w.d.players.find((p) => p.id === id);
  return p ? { x: p.x, z: p.z } : null;
};
const lastMoved = (id) =>
  find("player:moved", (x) => x.d && x.d.id === id && x.ch && x.ch.indexOf("room:") === 0);
const currentPos = (id) => {
  const moved = lastMoved(id);
  if (moved) return { x: moved.d.x, z: moved.d.z };
  return welcomePos(id);
};

function moveTo(sock, id, target, mirror) {
  let cur = mirror || currentPos(id);
  let first = true;
  for (let i = 0; i < 400; i++) {
    clock += 200;
    if (!first) {
      const lm = lastMoved(id);
      if (lm) cur = { x: lm.d.x, z: lm.d.z };
    }
    const dx = target.x - cur.x;
    const dz = target.z - cur.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return true;
    const step = Math.min(2.0, dist);
    const nx = cur.x + (dx / dist) * step;
    const nz = cur.z + (dz / dist) * step;
    const before = emitted.length;
    fire(sock, "player:move", { x: nx, z: nz });
    const mv = find(
      "player:moved",
      (x) => x.d && x.d.id === id && x.ch && x.ch.indexOf("room:") === 0,
      before
    );
    if (!mv) return false;
    first = false;
  }
  return false;
}

const { setupGame } = await import(url("server/game.js"));
setupGame(io);

const modeTimer = timers.find((h) => h.interval && h.ms === 200);
if (!modeTimer) throw new Error("no se registro el tick de minijuegos");

const COLISEO_PORTAL = HUB.HUB_PORTALS.find((p) => p.modeId === "coliseo");
const ROOM = MODE.modeRoomCode("coliseo", "1v1");

let A;
let B;

run("10 servidor: portal, sala propia y combate habilitado", () => {
  A = mk("A");
  io.connect(A);
  fire(A, "player:join", { name: "Alfa" });
  fire(A, "hub:enter");
  const spawnA = welcomePos("A") || HUB.HUB_SPAWN;
  eq(moveTo(A, "A", COLISEO_PORTAL, spawnA), true, "A llega al portal");

  const from = emitted.length;
  fire(A, "mode:join", { modeId: "coliseo", variant: "1v1" });
  const state = lastFor("room:state", "A", from);
  eq(!!state, true, "responde room:state");
  eq(state.d.room.kind, "mode", "zona de minijuego");
  eq(state.d.room.modeId, "coliseo", "modo Coliseo");
  eq(state.d.room.variant, "1v1", "formato 1v1");
  eq(state.d.room.code, ROOM, "sala por variante");
  eq(state.d.room.combat, true, "combate habilitado");

  const mode = roomEmit("mode:state", ROOM, from);
  eq(!!mode, true, "se difunde el estado");
  eq(mode.d.phase, "waiting", "espera jugadores");
  eq(mode.d.players.length, 1, "un jugador dentro");
  eq(mode.d.players[0].side, "cian", "primer bando cian");
  eq(mode.d.roundsToWin, 3, "al mejor de 5");

  // Sin ronda activa el servidor ignora el movimiento.
  const beforeMove = emitted.length;
  fire(A, "player:move", { x: 2, z: 12 });
  eq(
    find("player:moved", (x) => x.d && x.d.id === "A", beforeMove),
    null,
    "en espera no se puede caminar"
  );
});

run("11 servidor: loadout melee y armas de fuego rechazadas", () => {
  const before = emitted.length;
  fire(A, "mode:action", { type: "weapon", weaponId: "pistola" });
  const bad = lastFor("mode:error", "A", before);
  eq(!!bad, true, "arma de fuego rechazada");
  eq(/no esta permitida|no está permitida/i.test(bad.d.error), true, "el aviso habla del arma");

  const okFrom = emitted.length;
  fire(A, "mode:action", { type: "weapon", weaponId: "maza" });
  const state = roomEmit("mode:state", ROOM, okFrom);
  eq(!!state, true, "arma melee aceptada");
  eq(state.d.players.find((p) => p.id === "A").weaponId, "maza", "maza equipada");

  const shootFrom = emitted.length;
  fire(A, "combat:shoot", { dx: 0, dz: -1 });
  eq(roomEmit("combat:shot", ROOM, shootFrom), null, "fuera de ronda no se golpea");
});

run("12 servidor: listo, cuenta atras y teletransporte autoritativo", () => {
  B = mk("B");
  io.connect(B);
  fire(B, "player:join", { name: "Beta" });
  fire(B, "hub:enter");
  const spawnB = welcomePos("B") || HUB.HUB_SPAWN;
  eq(moveTo(B, "B", COLISEO_PORTAL, spawnB), true, "B llega al portal");
  const joinFrom = emitted.length;
  fire(B, "mode:join", { modeId: "coliseo", variant: "1v1" });
  const joined = roomEmit("mode:state", ROOM, joinFrom);
  eq(joined.d.players.length, 2, "dos jugadores");
  eq(joined.d.players.map((p) => p.side).join(","), "cian,rosa", "bandos alternos");
  eq(joined.d.phase, "waiting", "aun no empieza");

  fire(A, "mode:action", { type: "ready" });
  fire(B, "mode:action", { type: "ready" });
  clock += 100;
  modeTimer.fn();
  const countdown = roomEmit("mode:state", ROOM);
  eq(countdown.d.phase, "countdown", "cuenta atras");
  const teleportA = find(
    "mode:teleport",
    (x) => x.ch === "room:" + ROOM && x.d.id === "A",
    joinFrom
  );
  const teleportB = find(
    "mode:teleport",
    (x) => x.ch === "room:" + ROOM && x.d.id === "B",
    joinFrom
  );
  eq(!!teleportA, true, "A recibe su spawn");
  eq(!!teleportB, true, "B recibe su spawn");
  const distA = Math.hypot(teleportA.d.x, teleportA.d.z);
  if (distA > DEF.COLISEO_PLAY_RADIUS) throw new Error("spawn de A fuera del circulo");
  eq(
    Math.abs(teleportA.d.yaw - Math.atan2(-teleportA.d.x, -teleportA.d.z)) < 0.02,
    true,
    "A mira al centro"
  );
  const equip = find(
    "crystal:equip",
    (x) => x.ch === "room:" + ROOM && x.d.playerId === "A" && x.d.weaponId === "maza",
    joinFrom
  );
  eq(!!equip, true, "el servidor equipa la maza elegida");

  clock += 3300;
  modeTimer.fn();
  const fight = roomEmit("mode:state", ROOM);
  eq(fight.d.phase, "fight", "ronda en curso");
  eq(fight.d.round, 1, "ronda 1");
});

run("13 servidor: melee, baja sin respawn y marcador", () => {
  // Los spawns de la ronda llegan por `mode:teleport`; el `welcome` es de la
  // isla y no sirve para calcular la distancia.
  const tpA = find("mode:teleport", (x) => x.ch === "room:" + ROOM && x.d.id === "A");
  const tpB = find("mode:teleport", (x) => x.ch === "room:" + ROOM && x.d.id === "B");
  eq(!!tpA, true, "A tiene spawn de ronda");
  eq(!!tpB, true, "B tiene spawn de ronda");
  const target = { x: tpB.d.x, z: tpB.d.z + 1.8 };
  eq(
    moveTo(A, "A", target, { x: tpA.d.x, z: tpA.d.z }),
    true,
    "A se acerca a B durante la ronda"
  );

  const timersBefore = timers.filter((h) => h.ms === 10000 && !h.cleared).length;
  let eliminated = null;
  for (let hit = 0; hit < 3 && !eliminated; hit++) {
    const from = emitted.length;
    fire(A, "combat:shoot", { dx: 0, dz: -1 });
    eliminated = find(
      "combat:eliminated",
      (x) => x.ch === "room:" + ROOM && x.d.targetId === "B",
      from
    );
    clock += 800;
  }
  eq(!!eliminated, true, "tres golpes de maza eliminan a B");
  const timersAfter = timers.filter((h) => h.ms === 10000 && !h.cleared).length;
  eq(timersAfter, timersBefore, "el Coliseo no programa respawn");

  const snap = roomEmit("mode:state", ROOM);
  eq(snap.d.phase, "roundEnd", "la baja cierra la ronda");
  eq(snap.d.scores.find((s) => s.id === "cian").score, 1, "cian suma la ronda");

  // Un cliente nuevo no entra a mitad de partida.
  const C = mk("C");
  io.connect(C);
  fire(C, "player:join", { name: "Gamma" });
  fire(C, "hub:enter");
  const spawnC = welcomePos("C") || HUB.HUB_SPAWN;
  eq(moveTo(C, "C", COLISEO_PORTAL, spawnC), true, "C llega al portal");
  const beforeC = emitted.length;
  fire(C, "mode:join", { modeId: "coliseo", variant: "1v1" });
  const denied = lastFor("mode:error", "C", beforeC);
  eq(!!denied, true, "entrar en partida se rechaza");
  eq(/marcha|reinicio/i.test(denied.d.error), true, "el aviso pide esperar");

  clock += 3300;
  modeTimer.fn();
  const next = roomEmit("mode:state", ROOM);
  eq(next.d.phase, "countdown", "siguiente ronda");
  const revived = find(
    "combat:revived",
    (x) => x.ch === "room:" + ROOM && x.d.targetId === "B",
    beforeC
  );
  eq(!!revived, true, "B revive al empezar la ronda");
  clock += 3300;
  modeTimer.fn();
  eq(roomEmit("mode:state", ROOM).d.phase, "fight", "ronda 2 en curso");
});

run("14 servidor: sin curacion ni lanzables dentro del Coliseo", () => {
  const before = emitted.length;
  fire(A, "inventory:use", { slot: 0 });
  const toast = find(
    "inventory:toast",
    (x) => x.ch === "#A" && /Coliseo/i.test(x.d.text),
    before
  );
  eq(!!toast, true, "curarse se bloquea con aviso");

  const beforeThrow = emitted.length;
  fire(A, "inventory:throw", { slot: 0, dx: 0, dz: -1 });
  const throwToast = find(
    "inventory:toast",
    (x) => x.ch === "#A" && /Coliseo/i.test(x.d.text),
    beforeThrow
  );
  eq(!!throwToast, true, "lanzar objetos se bloquea con aviso");

  const beforeShop = emitted.length;
  fire(A, "shop:buy", { weaponId: "pistola" });
  const shop = find("shop:result", (x) => x.ch === "#A", beforeShop);
  eq(!!shop, true, "la tienda responde");
  eq(shop.d.ok, false, "la tienda no vende en el Coliseo");
});

const failed = results.filter((r) => !r.ok);
console.log(`\nRESULTADO coliseo: ${results.length - failed.length}/${results.length} ok`);
if (failed.length) {
  console.log(failed.map((r) => `- ${r.name}: ${r.extra || ""}`).join("\n"));
  process.exit(1);
}
