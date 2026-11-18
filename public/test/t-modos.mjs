// Suite de la isla de minijuegos y de la modalidad "Encuentra los pares".
//
// Cubre tres capas:
//  1. Contrato de modos y portales (módulos puros compartidos con el cliente).
//  2. Mapas internos y sus obstáculos (la isla no puede tener un portal dentro
//     de una roca ni dejar el spawn atrapado).
//  3. Controlador de Pares con reloj y RNG deterministas, más el flujo real de
//     servidor (isla -> portal -> partida -> isla) con Socket.IO simulado.

import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

process.env.DB_PATH = path.join(os.tmpdir(), "pingui-modos-" + Date.now() + ".db");

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

// ------------------------------------------------------------- módulos puros
const MODE = await import(url("public/js/modeDefs.js"));
const HUB = await import(url("public/js/hubDefs.js"));
const MAPS = await import(url("public/js/mapDefs.js"));
const OBS = await import(url("public/js/mapObstacles.js"));
const PAIRS = await import(url("server/modes/pairs.js"));

run("01 modeDefs: seis modalidades únicas y Pares es la única en vivo", () => {
  eq(MODE.MODES.length, 6, "número de modalidades");
  const ids = MODE.MODES.map((m) => m.id);
  eq(new Set(ids).size, 6, "ids únicos");
  eq(MODE.liveModes().length, 1, "solo una modalidad live");
  eq(MODE.liveModes()[0].id, "pares", "la modalidad live es Pares");
  for (const mode of MODE.MODES) {
    if (!mode.name || !mode.icon || !mode.mapId) throw new Error(`modalidad incompleta: ${mode.id}`);
    if (mode.status !== "live" && mode.status !== "soon") throw new Error(`estado inválido: ${mode.id}`);
  }
  eq(MODE.modeRoomCode("pares"), "MODO-PARES", "código reservado de Pares");
  eq(MODE.isModeLive("tnt"), false, "TNT todavía no está en vivo");
  eq(MODE.getMode("nope"), null, "modo inexistente devuelve null");
});

run("02 hubDefs: anillo de seis portales y detección de proximidad", () => {
  eq(HUB.HUB_CODE, "ISLA", "código de la isla");
  eq(HUB.HUB_MAP_ID, "isla", "mapa de la isla");
  eq(HUB.HUB_PORTALS.length, 6, "un portal por modalidad");
  const ids = HUB.HUB_PORTALS.map((p) => p.modeId);
  eq(new Set(ids).size, 6, "portales únicos");
  for (const portal of HUB.HUB_PORTALS) {
    const radius = Math.hypot(portal.x, portal.z);
    if (Math.abs(radius - HUB.HUB_PORTAL_RING) > 0.02) {
      throw new Error(`portal ${portal.modeId} fuera del anillo: ${radius}`);
    }
  }
  const near = HUB.nearestPortal(HUB.HUB_PORTALS[0].x + 2, HUB.HUB_PORTALS[0].z);
  eq(near && near.modeId, HUB.HUB_PORTALS[0].modeId, "portal más cercano");
  eq(HUB.nearestPortal(0, 0), null, "el centro no activa ningún portal");
  eq(HUB.nearestPortal(HUB.HUB_PORTALS[0].x + 5, HUB.HUB_PORTALS[0].z), null, "fuera del radio no activa");
  const lobby = HUB.LOBBY_PORTAL;
  if (!lobby || lobby.modeId !== "hub") throw new Error("falta la puerta del lobby");
});

run("03 mapas internos: isla y arena no aparecen en el selector de salas", () => {
  const isla = MAPS.getMap("isla");
  const pares = MAPS.getMap("pares");
  eq(isla.size, 64, "tamaño de la isla");
  eq(pares.size, 44, "tamaño de la arena de Pares");
  eq(isla.room, false, "la isla no es sala privada");
  eq(pares.room, false, "la arena no es sala privada");
  const roomIds = MAPS.getRoomMaps().map((m) => m.id);
  eq(roomIds.includes("isla"), false, "getRoomMaps excluye la isla");
  eq(roomIds.includes("pares"), false, "getRoomMaps excluye Pares");
});

run("04 obstáculos: portales y spawn despejados en la isla", () => {
  const isla = OBS.MAP_OBSTACLES.isla;
  const pares = OBS.MAP_OBSTACLES.pares;
  if (!isla || !pares) throw new Error("faltan layouts internos");
  eq(isla.filter((o) => o.kind === "monolith").length, 6, "un monolito por portal");
  eq(isla.filter((o) => o.kind === "monument").length, 1, "monumento central");
  for (const portal of HUB.HUB_PORTALS) {
    const mono = isla.find((o) => o.kind === "monolith" && o.x === portal.x && o.z === portal.z);
    if (!mono) throw new Error(`portal sin monolito: ${portal.modeId}`);
  }
  const bound = MAPS.getMapBoundary("isla");
  for (const o of isla) {
    if (Math.abs(o.x) > bound || Math.abs(o.z) > bound) throw new Error(`obstáculo fuera del mapa: ${o.kind}`);
  }
  eq(OBS.isInsideObstacle("isla", 0, 0, 0.1), true, "el monumento ocupa el centro");
  eq(OBS.isInsideObstacle("isla", HUB.HUB_SPAWN.x, HUB.HUB_SPAWN.z, 0.5), false, "spawn libre");
  eq(pares.length, 8, "arena de Pares con 8 coberturas");
});

// --------------------------------------------------------- Pares determinista
const EMOJIS = PAIRS.PAIRS_EMOJIS;

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

// Réplica del barajado del controlador para conocer las parejas sin filtrar
// emojis a través del snapshot.
function expectedDeck(seed) {
  const rng = mulberry32(seed);
  const deck = [];
  for (let pair = 0; pair < PAIRS.PAIRS_PAIR_COUNT; pair++) {
    const emoji = EMOJIS[pair % EMOJIS.length];
    deck.push({ emoji, pair });
    deck.push({ emoji, pair });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

function pairIndices(deck) {
  const byPair = new Map();
  deck.forEach((card, index) => {
    if (!byPair.has(card.pair)) byPair.set(card.pair, []);
    byPair.get(card.pair).push(index);
  });
  return [...byPair.values()];
}

run("05 Pares: snapshot inicial no filtra emojis", () => {
  const game = PAIRS.createPairsGame({ now: () => 1000, rng: mulberry32(7), maxPlayers: 2 });
  game.join({ id: "A", name: "Alfa" });
  game.join({ id: "B", name: "Beta" });
  const snap = game.snapshot();
  eq(snap.status, "playing", "estado al unirse");
  eq(snap.turnId, "A", "empieza el primer jugador");
  eq(snap.players.length, 2, "dos jugadores");
  eq(snap.cards.length, 16, "tablero 4x4");
  eq(snap.cards.every((c) => c.emoji === null), true, "ningún emoji visible al empezar");
  eq(game.join({ id: "C", name: "Ce" }).reason, "full", "aforo del controlador");
});

run("06 Pares: partida completa por parejas y reinicio de ronda", () => {
  const seed = 1234;
  let clock = 1000;
  const game = PAIRS.createPairsGame({ now: () => clock, rng: mulberry32(seed), maxPlayers: 2 });
  game.join({ id: "A", name: "Alfa" });
  game.join({ id: "B", name: "Beta" });

  const groups = pairIndices(expectedDeck(seed));
  for (const [i, j] of groups) {
    clock += 100;
    eq(game.action("A", { type: "flip", index: i }).ok, true, `voltear ${i}`);
    clock += 100;
    eq(game.action("A", { type: "flip", index: j }).ok, true, `voltear ${j}`);
  }

  const snap = game.snapshot();
  eq(snap.status, "finished", "tablero completado");
  eq(snap.players.find((p) => p.id === "A").score, 8, "A encontró las 8 parejas");
  eq(snap.players.find((p) => p.id === "B").score, 0, "B no sumó");
  eq(snap.winnerIds.length, 1, "un ganador");
  eq(snap.winnerIds[0], "A", "gana A");
  eq(snap.cards.every((c) => c.matched && c.emoji), true, "todas las cartas visibles al final");

  eq(game.action("B", { type: "flip", index: 0 }).ok, false, "no se juega con la ronda cerrada");
  clock += 12000;
  eq(game.tick(), true, "el reinicio avanza");
  const next = game.snapshot();
  eq(next.status, "playing", "nueva ronda en curso");
  eq(next.turnId, "A", "el turno vuelve al primero");
  eq(next.players.every((p) => p.score === 0), true, "marcador reiniciado");
  eq(next.cards.every((c) => !c.matched && c.emoji === null), true, "cartas ocultas de nuevo");
});

run("07 Pares: fallo oculta cartas, cambia turno y rechaza acciones ajenas", () => {
  const seed = 99;
  let clock = 5000;
  const game = PAIRS.createPairsGame({ now: () => clock, rng: mulberry32(seed), maxPlayers: 2 });
  game.join({ id: "A", name: "Alfa" });
  game.join({ id: "B", name: "Beta" });

  const groups = pairIndices(expectedDeck(seed));
  const first = groups[0];
  const second = groups[1];
  const i = first[0];
  const j = second[0];

  clock += 50;
  eq(game.action("A", { type: "flip", index: i }).ok, true, "primer volteo");
  clock += 50;
  eq(game.action("A", { type: "flip", index: j }).ok, true, "segundo volteo");
  let snap = game.snapshot();
  if (snap.waitMs <= 0) throw new Error("el fallo debe abrir la ventana de espera");
  eq(snap.turnId, "A", "el turno no cambia hasta ocultar las cartas");
  eq(game.action("A", { type: "flip", index: first[1] }).reason, "wait", "no se puede voltear durante la espera");
  eq(game.action("B", { type: "flip", index: second[1] }).reason, "not-your-turn", "B no puede jugar fuera de turno");

  clock += 400;
  eq(game.tick(), false, "todavía no toca cambiar");
  clock += 700;
  eq(game.tick(), true, "pasada la espera cambia el turno");
  snap = game.snapshot();
  eq(snap.turnId, "B", "ahora juega B");
  eq(snap.cards.every((c) => c.emoji === null), true, "las cartas vuelven a ocultarse");
  eq(game.action("A", { type: "flip", index: i }).reason, "not-your-turn", "A perdió el turno");

  eq(game.leave("B").ok, true, "B abandona");
  eq(game.snapshot().turnId, "A", "el turno pasa al jugador que queda");
});

// ------------------------------------------------------ servidor con stubs
let clock = 2_000_000;
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
const welcomePos = (id) => {
  const w = find("welcome", (x) => x.ch === "#" + id);
  if (!w || !Array.isArray(w.d.players)) return null;
  const p = w.d.players.find((p) => p.id === id);
  return p ? { x: p.x, z: p.z } : null;
};
const lastMoved = (id) =>
  find("player:moved", (x) => x.d && x.d.id === id && x.ch && x.ch.indexOf("room:") === 0);

function moveTo(sock, id, target, mirror) {
  let cur = mirror;
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
    const mv = find("player:moved", (x) => x.d && x.d.id === id && x.ch && x.ch.indexOf("room:") === 0, before);
    if (!mv) return false;
    first = false;
  }
  return false;
}

const { setupGame } = await import(url("server/game.js"));
setupGame(io);

let A;
let B;
const PARES_PORTAL = HUB.HUB_PORTALS.find((p) => p.modeId === "pares");

run("08 servidor: la isla es una zona oculta sin combate", () => {
  A = mk("A");
  io.connect(A);
  fire(A, "player:join", { name: "Alfa" });
  fire(A, "hub:enter");

  const state = find("room:state", (x) => x.ch === "#A");
  eq(!!state, true, "hub:enter responde con room:state");
  eq(state.d.room.kind, "hub", "la zona es la isla");
  eq(state.d.room.mapId, "isla", "mapa de la isla");
  eq(state.d.room.combat, false, "la isla no tiene combate");

  const list = find("room:list");
  eq(list.d.rooms.some((r) => r.code === HUB.HUB_CODE), false, "la isla no aparece en room:list");
});

run("09 servidor: sin portal no se entra y con portal sí", () => {
  const before = emitted.length;
  fire(A, "mode:join", { modeId: "pares" });
  const denied = find("mode:error", (x) => x.ch === "#A", before);
  eq(!!denied, true, "lejos del portal se rechaza");
  eq(/Acércate/.test(denied.d.error), true, "el aviso pide acercarse al portal");

  const spawn = welcomePos("A") || HUB.HUB_SPAWN;
  eq(moveTo(A, "A", PARES_PORTAL, spawn), true, "A llega al portal de Pares");

  const from = emitted.length;
  fire(A, "mode:join", { modeId: "pares" });
  const state = find("room:state", (x) => x.ch === "#A", from);
  eq(!!state, true, "entrar al portal responde con room:state");
  eq(state.d.room.kind, "mode", "la zona es un modo");
  eq(state.d.room.modeId, "pares", "modo Pares");
  eq(state.d.room.combat, false, "el minijuego no tiene combate");

  const mode = find("mode:state", (x) => x.ch === "room:MODO-PARES", from);
  eq(!!mode, true, "se difunde el estado de la partida");
  eq(mode.d.status, "playing", "la partida empieza con A");
  eq(mode.d.turnId, "A", "A tiene el primer turno");
  eq(mode.d.cards.every((c) => c.emoji === null), true, "el servidor no filtra emojis");

  const list = find("room:list");
  eq(list.d.rooms.some((r) => r.code === "MODO-PARES"), false, "la sala del modo es oculta");
});

run("10 servidor: acciones de combate y tienda quedan bloqueadas en el modo", () => {
  const before = emitted.length;
  fire(A, "combat:shoot", { dx: 0, dz: -1 });
  eq(find("combat:shot", null, before), null, "disparar no produce eventos en el modo");

  fire(A, "shop:buy", { weaponId: "pistola" });
  const shop = find("shop:result", (x) => x.ch === "#A", before);
  eq(!!shop, true, "la tienda responde");
  eq(shop.d.ok, false, "la compra se rechaza");
  eq(shop.d.reason, "no-room", "motivo: no es una sala privada");
});

run("11 servidor: segundo jugador, volteo autoritativo y vuelta a la isla", () => {
  B = mk("B");
  io.connect(B);
  fire(B, "player:join", { name: "Beta" });
  fire(B, "hub:enter");
  const spawn = welcomePos("B") || HUB.HUB_SPAWN;
  eq(moveTo(B, "B", PARES_PORTAL, spawn), true, "B llega al portal");

  const beforeB = emitted.length;
  fire(B, "mode:join", { modeId: "pares" });
  const joined = find("mode:state", (x) => x.ch === "room:MODO-PARES", beforeB);
  eq(!!joined, true, "B recibe el estado al entrar");
  eq(joined.d.players.length, 2, "la partida tiene dos jugadores");

  const beforeFlip = emitted.length;
  fire(A, "mode:action", { type: "flip", index: 0 });
  const flip = find("mode:state", (x) => x.ch === "room:MODO-PARES", beforeFlip);
  eq(!!flip, true, "el volteo difunde estado");
  const visible = flip.d.cards.filter((c) => c.emoji !== null);
  eq(visible.length, 1, "solo la carta volteada revela su emoji");
  eq(flip.d.cards[0].flipped, true, "la carta 0 está boca arriba");

  const beforeLeave = emitted.length;
  fire(A, "mode:leave");
  const back = find("room:state", (x) => x.ch === "#A", beforeLeave);
  eq(!!back, true, "salir del modo responde con room:state");
  eq(back.d.room.kind, "hub", "A vuelve a la isla");
  const afterLeave = find("mode:state", (x) => x.ch === "room:MODO-PARES", beforeLeave);
  eq(!!afterLeave, true, "el modo difunde la salida");
  eq(afterLeave.d.players.length, 1, "queda un jugador");
  eq(afterLeave.d.turnId, "B", "el turno pasa a B");
});

const failed = results.filter((r) => !r.ok);
console.log(`\nRESULTADO modos: ${results.length - failed.length}/${results.length} ok`);
if (failed.length) {
  console.log(failed.map((r) => `- ${r.name}: ${r.extra || ""}`).join("\n"));
  process.exit(1);
}
