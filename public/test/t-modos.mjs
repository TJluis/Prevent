// Suite de la isla de minijuegos y de la modalidad "Encuentra los pares".
//
// Cubre tres capas:
//  1. Contrato de modos, formatos y portales (módulos puros compartidos).
//  2. Geometría del tablero 3D (cartas, plataformas de equipo y atriles).
//  3. Controlador de Pares con reloj y RNG deterministas, más el flujo real de
//     servidor (isla -> portal -> formato -> equipos -> volteo -> isla) con
//     Socket.IO simulado y posiciones autoritativas.

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
const DEF = await import(url("public/js/pairsDefs.js"));
const PAIRS = await import(url("server/modes/pairs.js"));

run("01 modeDefs: seis modalidades y Pares con dos formatos", () => {
  eq(MODE.MODES.length, 6, "número de modalidades");
  const ids = MODE.MODES.map((m) => m.id);
  eq(new Set(ids).size, 6, "ids únicos");
  eq(MODE.liveModes().length, 1, "solo una modalidad live");
  eq(MODE.liveModes()[0].id, "pares", "la modalidad live es Pares");
  for (const mode of MODE.MODES) {
    if (!mode.name || !mode.icon || !mode.mapId) throw new Error(`modalidad incompleta: ${mode.id}`);
    if (mode.status !== "live" && mode.status !== "soon") throw new Error(`estado inválido: ${mode.id}`);
  }
  const pares = MODE.getMode("pares");
  eq(pares.maxPlayers, 4, "aforo máximo de Pares");
  eq(pares.variants.length, 2, "dos formatos");
  eq(pares.variants.map((v) => v.id).join(","), "1v1,2v2", "ids de formato");
  eq(MODE.getModeVariant("pares", "2v2").cardCount, 36, "36 cartas en 2v2");
  eq(MODE.getModeVariant("pares", "3v3"), null, "formato inexistente");
  eq(MODE.modeRoomCode("pares"), "MODO-PARES", "código base de Pares");
  eq(MODE.modeRoomCode("pares", "1v1"), "MODO-PARES-1V1", "sala del formato 1v1");
  eq(MODE.modeRoomCode("pares", "2v2"), "MODO-PARES-2V2", "sala del formato 2v2");
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

run("04 obstáculos: portales, spawn y arena despejados", () => {
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

  // El centro del tablero y las plataformas de equipo deben quedar libres.
  for (const variantId of ["1v1", "2v2"]) {
    const def = DEF.getPairsVariant(variantId);
    eq(OBS.isInsideObstacle("pares", 0, 0, 0.2), false, `centro libre (${variantId})`);
    for (const teamId of ["cian", "rosa"]) {
      const pad = DEF.teamPad(def, teamId);
      if (Math.abs(pad.z) >= MAPS.getMapBoundary("pares") - 1) {
        throw new Error(`plataforma ${teamId} fuera de la arena (${variantId})`);
      }
      eq(OBS.isInsideObstacle("pares", pad.x, pad.z, 0.4), false, `plataforma ${teamId} libre (${variantId})`);
    }
  }
});

run("05 pairsDefs: cartas, plataformas, atriles y llegada neutra", () => {
  eq(DEF.PAIRS_EMOJIS.length, 24, "24 emojis distintos");
  eq(new Set(DEF.PAIRS_EMOJIS).size, 24, "sin emojis repetidos");
  eq(DEF.PAIRS_TEAMS.length, 2, "dos equipos");

  for (const variantId of ["1v1", "2v2"]) {
    const def = DEF.getPairsVariant(variantId);
    eq(def.cardCount, def.grid * def.grid, `cartas de ${variantId}`);
    eq(def.pairCount, def.cardCount / 2, `parejas de ${variantId}`);

    // Cada centro cae en su propia celda y los huecos no activan cartas.
    for (const index of [0, 1, def.grid, def.cardCount - 1]) {
      const center = DEF.cardCenter(def, index);
      eq(DEF.cardIndexAt(def, center.x, center.z), index, `centro ${index} (${variantId})`);
    }
    eq(DEF.cardIndexAt(def, 999, 999), -1, `fuera del tablero (${variantId})`);

    const cian = DEF.teamPad(def, "cian");
    const rosa = DEF.teamPad(def, "rosa");
    if (!(cian.z > 0 && rosa.z < 0)) throw new Error(`plataformas mal colocadas (${variantId})`);
    eq(DEF.teamPadAt(def, cian.x, cian.z), "cian", `plataforma cian (${variantId})`);
    eq(DEF.teamPadAt(def, rosa.x, rosa.z), "rosa", `plataforma rosa (${variantId})`);
    eq(DEF.teamPadAt(def, 0, 0), null, `centro sin plataforma (${variantId})`);
    eq(DEF.cardIndexAt(def, cian.x, cian.z), -1, `la plataforma no pisa carta (${variantId})`);

    // Los atriles quedan detrás de cada plataforma y dentro de la arena.
    for (const teamId of ["cian", "rosa"]) {
      const rack = DEF.teamRack(def, teamId);
      const slot = DEF.teamRackSlot(def, teamId, def.pairCount - 1);
      if (!rack || !slot) throw new Error(`atril incompleto (${teamId}, ${variantId})`);
      if (Math.abs(rack.z) >= MAPS.getMapBoundary("pares") - 1) {
        throw new Error(`atril ${teamId} fuera de la arena (${variantId})`);
      }
      if (Math.sign(slot.z - rack.z) !== rack.sign && def.pairCount > rack.columns) {
        throw new Error(`hueco de atril mal orientado (${teamId}, ${variantId})`);
      }
    }

    const spawn = DEF.neutralSpawn(def);
    eq(DEF.cardIndexAt(def, spawn.x, spawn.z), -1, `llegada fuera del tablero (${variantId})`);
    eq(DEF.teamPadAt(def, spawn.x, spawn.z), null, `llegada fuera de plataformas (${variantId})`);
  }
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

// Réplica del barajado del controlador. `times` permite saltar los barajados
// previos (el constructor baraja una vez y la cuenta atrás vuelve a barajar).
function shuffledDeck(rng, pairCount) {
  const deck = [];
  for (let pair = 0; pair < pairCount; pair++) {
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

function deckAt(seed, times, pairCount = 8) {
  const rng = mulberry32(seed);
  let deck = null;
  for (let i = 0; i < times; i++) deck = shuffledDeck(rng, pairCount);
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

const cardPos = (def, index) => DEF.cardCenter(def, index);

function seat(game, def, id, teamId) {
  const pad = DEF.teamPad(def, teamId);
  return game.action(id, { type: "team", team: teamId }, { x: pad.x, z: pad.z });
}

run("06 Pares: equipos por plataforma, cuenta atrás y snapshot oculto", () => {
  let clock = 1000;
  const game = PAIRS.createPairsGame({ now: () => clock, rng: mulberry32(7), variant: "1v1" });
  game.join({ id: "A", name: "Alfa" });
  game.join({ id: "B", name: "Beta" });

  let snap = game.snapshot();
  eq(snap.status, "waiting", "sin equipos completos no empieza");
  eq(snap.variant, "1v1", "variante del controlador");
  eq(snap.cards.length, 16, "tablero 4x4");
  eq(snap.cards.every((c) => c.emoji === null), true, "ningún emoji visible al empezar");
  eq(snap.teams.every((team) => team.members.length === 0), true, "equipos vacíos");
  eq(game.join({ id: "C", name: "Ce" }).reason, "full", "aforo del controlador");

  const def = DEF.getPairsVariant("1v1");
  eq(seat(game, def, "A", "cian").ok, true, "A elige cian");
  eq(seat(game, def, "B", "rosa").ok, true, "B elige rosa");
  snap = game.snapshot();
  eq(snap.teams.find((t) => t.id === "cian").members.join(","), "A", "cian con A");
  eq(snap.teams.find((t) => t.id === "rosa").members.join(","), "B", "rosa con B");

  clock += 100;
  eq(game.tick(), true, "los equipos completos abren la cuenta atrás");
  snap = game.snapshot();
  eq(snap.status, "starting", "estado de cuenta atrás");
  if (snap.countdownMs <= 0) throw new Error("la cuenta atrás debe tener duración");
  eq(snap.cards.every((c) => c.emoji === null), true, "las cartas siguen ocultas");

  clock += 3300;
  eq(game.tick(), true, "la cuenta atrás termina");
  snap = game.snapshot();
  eq(snap.status, "playing", "partida en curso");
  eq(snap.turnTeam, "cian", "empieza el equipo cian");
  if (snap.turnMs <= 0) throw new Error("el turno debe tener duración");
});

run("07 Pares: tablero completo, atriles y reinicio", () => {
  const seed = 1234;
  let clock = 2000;
  const def = DEF.getPairsVariant("1v1");
  const game = PAIRS.createPairsGame({ now: () => clock, rng: mulberry32(seed), variant: "1v1" });
  game.join({ id: "A", name: "Alfa" });
  game.join({ id: "B", name: "Beta" });
  seat(game, def, "A", "cian");
  seat(game, def, "B", "rosa");
  clock += 10;
  game.tick();
  clock += 3300;
  game.tick();

  // El constructor baraja una vez y la cuenta atrás vuelve a barajar.
  const groups = pairIndices(deckAt(seed, 2));
  for (const [i, j] of groups) {
    clock += 100;
    eq(game.action("A", { type: "flip" }, cardPos(def, i)).ok, true, `voltear ${i}`);
    clock += 100;
    eq(game.action("A", { type: "flip" }, cardPos(def, j)).ok, true, `voltear ${j}`);
  }

  const snap = game.snapshot();
  eq(snap.status, "finished", "tablero completado");
  const cian = snap.teams.find((t) => t.id === "cian");
  const rosa = snap.teams.find((t) => t.id === "rosa");
  eq(cian.score, 8, "cian encontró las 8 parejas");
  eq(rosa.score, 0, "rosa no sumó");
  eq(cian.rack.length, 8, "el atril de cian guarda 8 parejas");
  eq(cian.rack.map((entry) => entry.slot).join(","), "0,1,2,3,4,5,6,7", "huecos del atril");
  eq(snap.winnerTeams.join(","), "cian", "gana cian");
  eq(snap.winnerIds.join(","), "A", "el ganador es A");
  eq(snap.cards.every((c) => c.matched && c.emoji), true, "todas las cartas visibles al final");
  eq(snap.cards.every((c) => c.ownerTeam === "cian" && Number.isInteger(c.slot)), true, "parejas asignadas al atril");
  eq(game.action("A", { type: "flip" }, cardPos(def, 0)).reason, "not-playing", "no se juega con la ronda cerrada");

  clock += 12000;
  eq(game.tick(), true, "el reinicio avanza");
  let next = game.snapshot();
  eq(next.status, "starting", "la revancha empieza con cuenta atrás");
  clock += 3300;
  game.tick();
  next = game.snapshot();
  eq(next.status, "playing", "nueva ronda en curso");
  eq(next.turnTeam, "cian", "el turno vuelve a cian");
  eq(next.teams.every((team) => team.score === 0 && team.rack.length === 0), true, "marcador y atriles reiniciados");
  eq(next.cards.every((c) => !c.matched && c.emoji === null), true, "cartas ocultas de nuevo");
});

run("08 Pares: fallo, cambio de turno, timeout y abandono", () => {
  const seed = 99;
  let clock = 5000;
  const def = DEF.getPairsVariant("1v1");
  const game = PAIRS.createPairsGame({ now: () => clock, rng: mulberry32(seed), variant: "1v1" });
  game.join({ id: "A", name: "Alfa" });
  game.join({ id: "B", name: "Beta" });
  seat(game, def, "A", "cian");
  seat(game, def, "B", "rosa");
  clock += 10;
  game.tick();
  clock += 3300;
  game.tick();

  const groups = pairIndices(deckAt(seed, 2));
  const i = groups[0][0];
  const j = groups[1][0];

  clock += 50;
  eq(game.action("A", { type: "flip" }, cardPos(def, i)).ok, true, "primer volteo");
  clock += 50;
  eq(game.action("A", { type: "flip" }, cardPos(def, j)).ok, true, "segundo volteo");
  let snap = game.snapshot();
  if (snap.waitMs <= 0) throw new Error("el fallo debe abrir la ventana de espera");
  eq(snap.turnTeam, "cian", "el turno no cambia hasta ocultar las cartas");
  eq(
    game.action("A", { type: "flip" }, cardPos(def, groups[0][1])).reason,
    "wait",
    "no se puede voltear durante la espera"
  );
  eq(
    game.action("B", { type: "flip" }, cardPos(def, groups[1][1])).reason,
    "not-your-turn",
    "B no puede jugar fuera de turno"
  );

  clock += 400;
  eq(game.tick(), false, "todavía no toca cambiar");
  clock += 900;
  eq(game.tick(), true, "pasada la espera cambia el turno");
  snap = game.snapshot();
  eq(snap.turnTeam, "rosa", "ahora juega rosa");
  eq(snap.cards.every((c) => c.emoji === null), true, "las cartas vuelven a ocultarse");
  eq(
    game.action("A", { type: "flip" }, cardPos(def, i)).reason,
    "not-your-turn",
    "cian perdió el turno"
  );

  clock += 20100;
  eq(game.tick(), true, "el turno agotado pasa al otro equipo");
  eq(game.snapshot().turnTeam, "cian", "vuelve el turno de cian");

  eq(game.leave("B").ok, true, "B abandona");
  snap = game.snapshot();
  eq(snap.status, "waiting", "sin equipo completo la partida se pausa");
  eq(snap.teams.find((t) => t.id === "rosa").members.length, 0, "rosa queda vacío");
  eq(snap.teams.find((t) => t.id === "cian").members.join(","), "A", "A sigue en cian");
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

// RNG determinista para el servidor: las pruebas no dependen del azar real.
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
if (!modeTimer) throw new Error("no se registró el tick de minijuegos");

let A;
let B;
let C;
const PARES_PORTAL = HUB.HUB_PORTALS.find((p) => p.modeId === "pares");

run("09 servidor: la isla es una zona oculta sin combate", () => {
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

run("10 servidor: portal, formato obligatorio y sala por variante", () => {
  const before = emitted.length;
  fire(A, "mode:join", { modeId: "pares" });
  const denied = find("mode:error", (x) => x.ch === "#A", before);
  eq(!!denied, true, "lejos del portal se rechaza");
  eq(/Acércate/.test(denied.d.error), true, "el aviso pide acercarse al portal");

  const spawn = welcomePos("A") || HUB.HUB_SPAWN;
  eq(moveTo(A, "A", PARES_PORTAL, spawn), true, "A llega al portal de Pares");

  const badFrom = emitted.length;
  fire(A, "mode:join", { modeId: "pares", variant: "3v3" });
  const bad = find("mode:error", (x) => x.ch === "#A", badFrom);
  eq(!!bad, true, "un formato inexistente se rechaza");
  eq(/formato/i.test(bad.d.error), true, "el aviso habla del formato");

  const from = emitted.length;
  fire(A, "mode:join", { modeId: "pares", variant: "1v1" });
  const state = find("room:state", (x) => x.ch === "#A", from);
  eq(!!state, true, "entrar al portal responde con room:state");
  eq(state.d.room.kind, "mode", "la zona es un modo");
  eq(state.d.room.modeId, "pares", "modo Pares");
  eq(state.d.room.variant, "1v1", "formato 1v1");
  eq(state.d.room.code, "MODO-PARES-1V1", "sala propia del formato");
  eq(state.d.room.combat, false, "el minijuego no tiene combate");

  const mode = find("mode:state", (x) => x.ch === "room:MODO-PARES-1V1", from);
  eq(!!mode, true, "se difunde el estado de la partida");
  eq(mode.d.status, "waiting", "espera a que se completen los equipos");
  eq(mode.d.variant, "1v1", "el snapshot declara la variante");
  eq(mode.d.cards.length, 16, "tablero 4x4");
  eq(mode.d.cards.every((c) => c.emoji === null), true, "el servidor no filtra emojis");
  eq(mode.d.teams.every((team) => team.members.length === 0), true, "sin equipos al entrar");

  const changeFrom = emitted.length;
  fire(A, "mode:join", { modeId: "pares", variant: "2v2" });
  const change = find("mode:error", (x) => x.ch === "#A", changeFrom);
  eq(!!change, true, "no se cambia de formato sin volver a la isla");
  eq(/formato/i.test(change.d.error), true, "el aviso pide volver a la isla");

  const list = find("room:list");
  eq(list.d.rooms.some((r) => r.code === "MODO-PARES-1V1"), false, "la sala 1v1 es oculta");
  eq(list.d.rooms.some((r) => r.code === "MODO-PARES-2V2"), false, "la sala 2v2 es oculta");
});

run("11 servidor: combate y tienda quedan bloqueados en el modo", () => {
  const before = emitted.length;
  fire(A, "combat:shoot", { dx: 0, dz: -1 });
  eq(find("combat:shot", null, before), null, "disparar no produce eventos en el modo");

  fire(A, "shop:buy", { weaponId: "pistola" });
  const shop = find("shop:result", (x) => x.ch === "#A", before);
  eq(!!shop, true, "la tienda responde");
  eq(shop.d.ok, false, "la compra se rechaza");
  eq(shop.d.reason, "no-room", "motivo: no es una sala privada");
});

run("12 servidor: equipos, cuenta atrás y volteo autoritativo", () => {
  const def = DEF.getPairsVariant("1v1");

  B = mk("B");
  io.connect(B);
  fire(B, "player:join", { name: "Beta" });
  fire(B, "hub:enter");
  const spawnB = welcomePos("B") || HUB.HUB_SPAWN;
  eq(moveTo(B, "B", PARES_PORTAL, spawnB), true, "B llega al portal");

  const beforeB = emitted.length;
  fire(B, "mode:join", { modeId: "pares", variant: "1v1" });
  const joined = find("mode:state", (x) => x.ch === "room:MODO-PARES-1V1", beforeB);
  eq(!!joined, true, "B recibe el estado al entrar");
  eq(joined.d.players.length, 2, "la partida tiene dos jugadores");
  eq(joined.d.status, "waiting", "aún faltan equipos");

  const padCian = DEF.teamPad(def, "cian");
  const padRosa = DEF.teamPad(def, "rosa");
  const spawnA = welcomePos("A") || DEF.neutralSpawn(def);
  eq(moveTo(A, "A", padCian, spawnA), true, "A llega a la plataforma cian");
  const teamAFrom = emitted.length;
  fire(A, "mode:action", { type: "team", team: "cian" });
  const teamA = find("mode:state", (x) => x.ch === "room:MODO-PARES-1V1", teamAFrom);
  eq(!!teamA, true, "elegir equipo difunde estado");
  eq(teamA.d.teams.find((t) => t.id === "cian").members.join(","), "A", "A queda en cian");

  const spawnB2 = welcomePos("B") || DEF.neutralSpawn(def);
  eq(moveTo(B, "B", padRosa, spawnB2), true, "B llega a la plataforma rosa");
  const teamBFrom = emitted.length;
  fire(B, "mode:action", { type: "team", team: "rosa" });
  const teamB = find("mode:state", (x) => x.ch === "room:MODO-PARES-1V1", teamBFrom);
  eq(!!teamB, true, "el segundo equipo difunde estado");
  eq(teamB.d.teams.find((t) => t.id === "rosa").members.join(","), "B", "B queda en rosa");
  eq(teamB.d.status, "waiting", "la cuenta atrás empieza en el siguiente tick");

  clock += 100;
  modeTimer.fn();
  let snap = find("mode:state", (x) => x.ch === "room:MODO-PARES-1V1");
  eq(snap.d.status, "starting", "los equipos completos abren la cuenta atrás");
  if (snap.d.countdownMs <= 0) throw new Error("la cuenta atrás debe durar");

  clock += 3300;
  modeTimer.fn();
  snap = find("mode:state", (x) => x.ch === "room:MODO-PARES-1V1");
  eq(snap.d.status, "playing", "la partida empieza");
  eq(snap.d.turnTeam, "cian", "el primer turno es de cian");

  const card0 = cardPos(def, 0);
  eq(moveTo(A, "A", card0), true, "A camina hasta la carta 0");
  const beforeFlip = emitted.length;
  fire(A, "mode:action", { type: "flip" });
  const flip = find("mode:state", (x) => x.ch === "room:MODO-PARES-1V1", beforeFlip);
  eq(!!flip, true, "el volteo difunde estado");
  eq(flip.d.cards[0].flipped, true, "la carta pisada se voltea");
  const visible = flip.d.cards.filter((c) => c.emoji !== null);
  eq(visible.length, 1, "solo la carta volteada revela su emoji");

  const beforeWrongTurn = emitted.length;
  fire(B, "mode:action", { type: "flip" });
  const wrongTurn = find("mode:error", (x) => x.ch === "#B", beforeWrongTurn);
  eq(!!wrongTurn, true, "el otro equipo no puede voltear");
  eq(/turno/i.test(wrongTurn.d.error), true, "el aviso habla del turno");

  const beforeRepeat = emitted.length;
  fire(A, "mode:action", { type: "flip" });
  const repeat = find("mode:error", (x) => x.ch === "#A", beforeRepeat);
  eq(!!repeat, true, "no se repite la misma carta");
  eq(/boca arriba/i.test(repeat.d.error), true, "el aviso dice que ya está boca arriba");

  const neutral = DEF.neutralSpawn(def);
  eq(moveTo(A, "A", neutral), true, "A vuelve al punto neutro");
  const beforeOffCard = emitted.length;
  fire(A, "mode:action", { type: "flip" });
  const offCard = find("mode:error", (x) => x.ch === "#A", beforeOffCard);
  eq(!!offCard, true, "fuera del tablero no se voltea");
  eq(/carta/i.test(offCard.d.error), true, "el aviso pide pisar una carta");

  const beforeLeave = emitted.length;
  fire(A, "mode:leave");
  const back = find("room:state", (x) => x.ch === "#A", beforeLeave);
  eq(!!back, true, "salir del modo responde con room:state");
  eq(back.d.room.kind, "hub", "A vuelve a la isla");
  const afterLeave = find("mode:state", (x) => x.ch === "room:MODO-PARES-1V1", beforeLeave);
  eq(!!afterLeave, true, "el modo difunde la salida");
  eq(afterLeave.d.players.length, 1, "queda un jugador");
  eq(afterLeave.d.status, "waiting", "sin equipo completo la partida se pausa");
  eq(afterLeave.d.teams.find((t) => t.id === "rosa").members.join(","), "B", "B sigue en rosa");
});

run("13 servidor: el formato 2v2 usa su propia sala y tablero 6x6", () => {
  C = mk("C");
  io.connect(C);
  fire(C, "player:join", { name: "Gamma" });
  fire(C, "hub:enter");
  const spawnC = welcomePos("C") || HUB.HUB_SPAWN;
  eq(moveTo(C, "C", PARES_PORTAL, spawnC), true, "C llega al portal");

  const from = emitted.length;
  fire(C, "mode:join", { modeId: "pares", variant: "2v2" });
  const state = find("room:state", (x) => x.ch === "#C", from);
  eq(!!state, true, "2v2 responde con room:state");
  eq(state.d.room.code, "MODO-PARES-2V2", "sala del formato 2v2");
  eq(state.d.room.variant, "2v2", "variante 2v2");

  const mode = find("mode:state", (x) => x.ch === "room:MODO-PARES-2V2", from);
  eq(!!mode, true, "se difunde el estado 2v2");
  eq(mode.d.grid, 6, "tablero 6x6");
  eq(mode.d.cards.length, 36, "36 cartas");
  eq(mode.d.pairCount, 18, "18 parejas");
  eq(mode.d.teamSize, 2, "dos jugadores por equipo");
  eq(mode.d.maxPlayers, 4, "aforo de 4");
  eq(mode.d.status, "waiting", "espera equipos");

  const def = DEF.getPairsVariant("2v2");
  const spawnC2 = welcomePos("C") || DEF.neutralSpawn(def);
  eq(moveTo(C, "C", DEF.teamPad(def, "cian"), spawnC2), true, "C llega a la plataforma cian 2v2");
  const teamFrom = emitted.length;
  fire(C, "mode:action", { type: "team", team: "cian" });
  const team = find("mode:state", (x) => x.ch === "room:MODO-PARES-2V2", teamFrom);
  eq(team.d.teams.find((t) => t.id === "cian").members.join(","), "C", "C queda en cian");
  eq(team.d.status, "waiting", "con un solo miembro no empieza");

  // La partida 1v1 de B no se ve afectada por la sala 2v2.
  const other = find("mode:state", (x) => x.ch === "room:MODO-PARES-1V1");
  eq(other.d.players.length, 1, "la sala 1v1 conserva a B");
});

const failed = results.filter((r) => !r.ok);
console.log(`\nRESULTADO modos: ${results.length - failed.length}/${results.length} ok`);
if (failed.length) {
  console.log(failed.map((r) => `- ${r.name}: ${r.extra || ""}`).join("\n"));
  process.exit(1);
}
