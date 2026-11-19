// Suite del TNT Run (Ola 3).
//
// Cubre cuatro capas:
//  1. Contrato compartido: rejilla 5×16×16, mecha de 600 ms y reglas de altura.
//  2. Controlador autoritativo: fases, celdas derivadas de x,z, límite de ritmo,
//     desplome en cascada, eliminación sin soporte y rejoin de 45 s.
//  3. Persistencia: columnas tnt_wins y tnt_blocks.
//  4. Servidor real con Socket.IO simulado: sala MODO-TNT sin combate, tick de
//     20 Hz, teletransportes con altura, mechas, caída y reconexión.

import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

process.env.DB_PATH = path.join(os.tmpdir(), "pingui-tnt-" + Date.now() + ".db");

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
    throw new Error(`${msg}: esperaba ${JSON.stringify(expected)} pero hay ${JSON.stringify(actual)}`);
  }
}
function ok(value, msg) {
  if (!value) throw new Error(msg);
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
const DEF = await import(url("public/js/tntDefs.js"));
const MODE = await import(url("public/js/modeDefs.js"));
const HUB = await import(url("public/js/hubDefs.js"));
const MAPS = await import(url("public/js/mapDefs.js"));
const OBS = await import(url("public/js/mapObstacles.js"));
const CTRL = await import(url("server/modes/tnt.js"));
const DB = await import(url("server/db.js"));

run("01 defs: rejilla de 5 capas, mecha y constantes del plan", () => {
  eq(DEF.TNT_LAYERS, 5, "cinco capas");
  eq(DEF.TNT_GRID, 16, "16 columnas por capa");
  eq(DEF.TNT_CELL, 1.5, "celda de 1,5 m");
  eq(DEF.TNT_LAYER_GAP, 1.5, "separación entre capas");
  eq(DEF.TNT_MIN_PLAYERS, 4, "mínimo de jugadores");
  eq(DEF.TNT_MAX_PLAYERS, 16, "máximo de jugadores");
  eq(DEF.TNT_FUSE_MS, 600, "mecha de 600 ms");
  eq(DEF.TNT_TICK_MS, 50, "tick de 20 Hz");
  eq(DEF.TNT_MATCH_MS, 300000, "partida de 5 minutos");
  eq(DEF.TNT_RECONNECT_GRACE_MS, 45000, "gracia de reconexión");
  eq(DEF.TNT_MAX_BLOCKS_PER_SEC, 8, "ocho bloques por segundo");
  eq(DEF.TNT_PHASES.join(","), "waiting,countdown,playing,result", "fases");
  eq(DEF.TNT_LAYERS * DEF.TNT_GRID * DEF.TNT_GRID, 1280, "1280 bloques");
  eq(DEF.tntLayerHeight(0), 0, "capa inferior a y=0");
  eq(DEF.tntLayerHeight(4), 6, "capa superior a y=6");
});

run("02 defs: índices globales y posición -> celda", () => {
  eq(DEF.tntGlobalIndex(4, 15, 15), 1279, "último bloque");
  eq(DEF.tntGlobalIndex(4, 16, 0), -1, "fila fuera de rango");
  eq(DEF.tntGlobalIndex(-1, 0, 0), -1, "capa fuera de rango");
  const parts = DEF.tntPartsOf(1279);
  eq(`${parts.layer}:${parts.row}:${parts.col}`, "4:15:15", "descomposición del índice");
  eq(DEF.tntPartsOf(1280), null, "índice imposible");

  const a = DEF.tntCellFromPosition(0.75, 0.75);
  eq(`${a.row}:${a.col}`, "8:8", "centro de la isla");
  const center = DEF.tntCellCenter(8, 8);
  eq(center.x, 0.75, "centro x");
  eq(center.z, 0.75, "centro z");
  eq(DEF.tntCellFromPosition(12.1, 0), null, "fuera de la isla");
  eq(DEF.tntCellFromPosition(-12.1, 0), null, "fuera de la isla");
  eq(DEF.tntAdjacent({ row: 4, col: 4 }, { row: 4, col: 5 }), true, "celda contigua");
  eq(DEF.tntAdjacent({ row: 4, col: 4 }, { row: 5, col: 5 }), false, "diagonal no vale");
  eq(DEF.tntAdjacent({ row: 4, col: 4 }, { row: 4, col: 6 }), false, "salto de dos no vale");
  eq(DEF.tntSameCell({ row: 1, col: 2 }, { row: 1, col: 2 }), true, "misma celda");
});

run("03 defs: salidas separadas y ranking por altura", () => {
  const spawns = [];
  for (let i = 0; i < 16; i++) spawns.push(DEF.tntSpawnFor(i, 16));
  eq(new Set(spawns.map((s) => `${s.row}:${s.col}`)).size, 16, "16 salidas distintas");
  ok(spawns.every((s) => s.layer === 4 && s.y === 6), "todos salen arriba");
  const players = [
    { id: "A", layer: 1, blocks: 20, order: 0, eliminated: false },
    { id: "B", layer: 3, blocks: 2, order: 1, eliminated: false },
    { id: "C", layer: 3, blocks: 5, order: 2, eliminated: false },
    { id: "D", layer: 4, blocks: 1, order: 3, eliminated: true },
  ];
  eq(DEF.tntRank(players).map((p) => p.id).join(","), "C,B,A", "elimina al caído");
  eq(DEF.tntWinnerByHeight(players).id, "C", "gana el más alto");
  eq(DEF.tntWinnerByHeight([players[3]]), null, "sin supervivientes no hay ganador");
});

run("04 mapa y modo: isla interna, portal en vivo y layout vacío", () => {
  const map = MAPS.getMap("tnt");
  eq(map.size, 48, "isla de 24 m de radio");
  eq(map.room, false, "no es sala privada");
  eq(MAPS.getRoomMaps().some((m) => m.id === "tnt"), false, "fuera del selector");
  eq(Array.isArray(OBS.MAP_OBSTACLES.tnt), true, "layout vacío para collision.js");
  eq(OBS.MAP_OBSTACLES.tnt.length, 0, "sin coberturas sólidas");
  eq(OBS.isInsideObstacle("tnt", 0, 0), false, "centro despejado");
  const mode = MODE.getMode("tnt");
  eq(mode.status, "live", "modalidad en vivo");
  eq(mode.mapId, "tnt", "usa la isla del TNT");
  eq(mode.maxPlayers, 16, "16 jugadores");
  eq(mode.combat === true, false, "sin combate");
  eq(MODE.modeRoomCode("tnt"), "MODO-TNT", "sala oculta");
  eq(MODE.isModeLive("tnt"), true, "isModeLive");
  const portal = HUB.HUB_PORTALS.find((p) => p.modeId === "tnt");
  ok(portal, "falta el portal del TNT");
  eq(portal.status, "live", "portal activo");
});

// ------------------------------------------------------- controlador puro
function makeController(overrides = {}) {
  const clock = { value: 1_000_000 };
  const game = CTRL.createTntGame({
    now: () => clock.value,
    fuseMs: overrides.fuseMs || DEF.TNT_FUSE_MS,
    matchMs: overrides.matchMs || DEF.TNT_MATCH_MS,
  });
  return { game, clock };
}

function fill(game, ids = ["A", "B", "C", "D"]) {
  ids.forEach((id) => game.join({ id, name: id.toUpperCase(), userId: null }));
  ids.forEach((id) => game.action(id, { type: "ready" }));
  return game.tick();
}

function begin(game, clock) {
  fill(game);
  clock.value += 100;
  game.tick(); // waiting -> countdown
  clock.value += DEF.TNT_COUNTDOWN_MS + 10;
  game.tick(); // countdown -> playing
}

function cellCenterOf(snapshot, id) {
  const entry = snapshot.players.find((p) => p.id === id);
  ok(entry, `jugador ${id} presente`);
  return { cell: entry.cell, ...DEF.tntCellCenter(entry.cell.row, entry.cell.col) };
}

run("05 controlador: espera, cuenta atrás y salida en la capa alta", () => {
  const { game, clock } = makeController();
  game.join({ id: "A", name: "Alfa" });
  game.join({ id: "B", name: "Beta" });
  game.join({ id: "C", name: "Gamma" });
  eq(game.snapshot().phase, "waiting", "espera jugadores");
  eq(game.tick(), false, "faltan jugadores");
  eq(game.join({ id: "D", name: "Delta" }).ok, true, "cuarto jugador aceptado");
  ["A", "B", "C"].forEach((id) => game.action(id, { type: "ready" }));
  eq(game.tick(), false, "falta el último listo");
  game.action("D", { type: "ready" });
  clock.value += 100;
  eq(game.tick(), true, "todos listos abre la cuenta atrás");
  eq(game.snapshot().phase, "countdown", "fase countdown");
  eq(game.canMove("A"), false, "no se mueve en countdown");
  clock.value += DEF.TNT_COUNTDOWN_MS;
  eq(game.tick(), true, "arranca la partida");
  const snap = game.snapshot();
  eq(snap.phase, "playing", "fase playing");
  eq(snap.players.length, 4, "cuatro jugadores");
  ok(snap.players.every((p) => p.layer === 4 && p.y === 6), "todos en la capa alta");
  eq(snap.pending.length, 4, "las celdas de salida también se encienden");
  eq(game.canMove("A"), true, "ya se puede mover");
});

run("06 controlador: la celda se deriva de x,z y exige adyacencia", () => {
  const { game, clock } = makeController();
  begin(game, clock);
  const at = cellCenterOf(game.snapshot(), "A");
  const same = game.move("A", at.x, at.z);
  eq(same.ok, true, "pisar la misma celda es válido");
  eq(game.snapshot().players.find((p) => p.id === "A").blocks, 0, "no cuenta como bloque nuevo");

  const next = DEF.tntCellCenter(at.cell.row, at.cell.col + 1);
  const res = game.move("A", next.x, next.z);
  eq(res.ok, true, "celda contigua aceptada");
  eq(res.layer, 4, "sigue en la capa alta");
  eq(game.snapshot().players.find((p) => p.id === "A").blocks, 1, "un bloque pisado");

  const far = DEF.tntCellCenter(at.cell.row, at.cell.col + 3);
  eq(game.move("A", far.x, far.z).reason, "not-adjacent", "rechaza salto de dos celdas");
  eq(game.snapshot().players.find((p) => p.id === "A").blocks, 1, "el rechazo no cuenta");
});

run("07 controlador: máximo de 8 bloques por segundo", () => {
  const { game, clock } = makeController();
  begin(game, clock);
  const at = cellCenterOf(game.snapshot(), "A");
  for (let i = 1; i <= 8; i++) {
    const center = DEF.tntCellCenter(at.cell.row, at.cell.col + i);
    eq(game.move("A", center.x, center.z).ok, true, `bloque ${i}`);
  }
  eq(game.snapshot().players.find((p) => p.id === "A").blocks, 8, "ocho bloques contados");
  const ninth = DEF.tntCellCenter(at.cell.row, at.cell.col + 9);
  eq(game.move("A", ninth.x, ninth.z).reason, "too-fast", "noveno rechazado");
  eq(game.snapshot().players.find((p) => p.id === "A").blocks, 8, "sigue en ocho");
});

run("08 controlador: mecha, desplome en cascada y nadie flotando", () => {
  const { game, clock } = makeController();
  begin(game, clock);
  eq(game.snapshot().players.every((p) => p.layer === 4), true, "empiezan arriba");

  for (let expected = 3; expected >= 0; expected--) {
    clock.value += DEF.TNT_FUSE_MS + 10;
    game.tick();
    const snap = game.snapshot();
    eq(snap.pending.length, 4, `${expected}: nueva mecha en cada capa`);
    ok(
      snap.players.every((p) => p.layer === expected && !p.eliminated),
      `todos bajan a la capa ${expected} sin flotar`
    );
  }

  clock.value += DEF.TNT_FUSE_MS + 10;
  game.tick();
  const snap = game.snapshot();
  eq(snap.players.every((p) => p.eliminated), true, "sin capa inferior están eliminados");
  eq(snap.phase, "result", "termina la partida");
  eq(snap.winner, null, "empate sin supervivientes");
  eq(snap.winnerReason || snap.winner && snap.winner.reason, null, "sin ganador");
  eq(game.resultStats().winner, null, "stats sin ganador");
});

run("09 controlador: última persona en pie gana", () => {
  const { game, clock } = makeController();
  begin(game, clock);
  for (const victim of ["B", "C", "D"]) {
    for (let i = 0; i < 5; i++) {
      const res = game.move(victim, 100, 100);
      eq(res.ok, true, `${victim} cae al vacío (${i + 1})`);
    }
  }
  const snap = game.snapshot();
  eq(snap.phase, "result", "partida terminada");
  eq(snap.winner.id, "A", "gana A");
  eq(snap.winner.reason, "last-standing", "por último vivo");
  eq(snap.alive.join(","), "A", "solo A sigue en pie");
  const stats = game.resultStats();
  eq(stats.winner, "A", "stats del ganador");
  eq(stats.participants.length, 4, "cuatro participantes");
  eq(typeof stats.blocks.A, "number", "bloques acumulados");
});

run("10 controlador: a los 5 minutos gana quien está más alto", () => {
  const { game, clock } = makeController({ fuseMs: 10_000_000 });
  begin(game, clock);
  // Tres jugadores bajan cuatro capas; A se queda arriba.
  for (const victim of ["B", "C", "D"]) {
    for (let i = 0; i < 4; i++) game.move(victim, 100, 100);
  }
  clock.value += DEF.TNT_MATCH_MS;
  game.tick();
  const snap = game.snapshot();
  eq(snap.phase, "result", "termina por tiempo");
  eq(snap.winner.id, "A", "gana el más alto");
  eq(snap.winner.reason, "time", "motivo time");
});

run("11 controlador: reconexión reserva capa y caduca a los 45 s", () => {
  const { game, clock } = makeController();
  begin(game, clock);
  const before = game.snapshot().players.find((p) => p.id === "A");
  eq(before.layer, 4, "A está arriba");
  game.action("A", { type: "ready" }); // se ignora fuera de waiting/result
  eq(game.leave("A", { reason: "disconnect" }).offline, true, "desconexión registrada");
  eq(game.canRejoin({ userId: null, name: "A" }), true, "reserva vigente");
  eq(game.join({ id: "Z", name: "A" }).rejoin, true, "rejoin aceptado");

  let snap = game.snapshot();
  const back = snap.players.find((p) => p.id === "Z");
  ok(back, "nuevo socket en la partida");
  eq(back.layer, before.layer, "recupera la capa");
  eq(back.blocks, before.blocks, "recupera los bloques");
  eq(back.offline, false, "ya no está offline");
  eq(snap.players.some((p) => p.id === "A"), false, "el socket viejo desaparece");

  game.leave("B", { reason: "disconnect" });
  clock.value += DEF.TNT_RECONNECT_GRACE_MS + 1;
  game.tick();
  snap = game.snapshot();
  eq(snap.players.some((p) => p.id === "B"), false, "la reserva caduca");
});

run("12 db: tnt_wins y tnt_blocks se acumulan", () => {
  const userId = DB.createUser("tnt-player", "hash", "#ffffff", null);
  DB.recordUserStats(userId, { tntWins: 1, tntBlocks: 12 });
  let stats = DB.getUserStats(userId);
  eq(stats.tnt_wins, 1, "una victoria");
  eq(stats.tnt_blocks, 12, "doce bloques");
  DB.recordUserStats(userId, { tntWins: 2, tntBlocks: 8 });
  stats = DB.getUserStats(userId);
  eq(stats.tnt_wins, 3, "las victorias se suman");
  eq(stats.tnt_blocks, 20, "los bloques se suman");
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

// Semilla estable: los cuatro spawns siempre caen en las mismas celdas.
const seedState = { value: 20261119 };
Math.random = () => {
  let x = (seedState.value += 0x6d2b79f5);
  x = Math.imul(x ^ (x >>> 15), 1 | x);
  x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
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
const all = (e, pred, from = 0) => {
  const out = [];
  for (let i = from; i < emitted.length; i++) {
    const x = emitted[i];
    if (x.e === e && (!pred || pred(x))) out.push(x);
  }
  return out;
};
const lastFor = (e, id, from = 0) => find(e, (x) => x.ch === "#" + id, from);
const roomEmit = (e, code, from = 0) => find(e, (x) => x.ch === "room:" + code, from);
const welcomePos = (id) => {
  const w = find("welcome", (x) => x.ch === "#" + id);
  if (!w || !Array.isArray(w.d.players)) return null;
  const p = w.d.players.find((p) => p.id === id);
  return p ? { x: p.x, z: p.z } : null;
};
const currentPos = (id) => {
  const moved = find(
    "player:moved",
    (x) => x.d && x.d.id === id && String(x.ch).startsWith("room:")
  );
  if (moved) return { x: moved.d.x, z: moved.d.z };
  return welcomePos(id) || HUB.HUB_SPAWN;
};
const latestPos = (id) => {
  for (let i = emitted.length - 1; i >= 0; i--) {
    const x = emitted[i];
    if (
      (x.e === "mode:teleport" || x.e === "player:moved") &&
      x.d &&
      x.d.id === id &&
      Number.isFinite(x.d.x) &&
      Number.isFinite(x.d.z)
    ) {
      return { x: x.d.x, z: x.d.z, y: x.d.y };
    }
  }
  return currentPos(id);
};
function moveTo(sock, id, target) {
  let cur = currentPos(id);
  for (let i = 0; i < 500; i++) {
    clock += 200;
    const dx = target.x - cur.x;
    const dz = target.z - cur.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return true;
    const step = Math.min(2, dist);
    const nx = cur.x + (dx / dist) * step;
    const nz = cur.z + (dz / dist) * step;
    const from = emitted.length;
    fire(sock, "player:move", { x: nx, z: nz });
    const mv = find(
      "player:moved",
      (x) => x.d && x.d.id === id && String(x.ch).startsWith("room:"),
      from
    );
    if (!mv) return false;
    cur = { x: mv.d.x, z: mv.d.z };
  }
  return false;
}

const { setupGame } = await import(url("server/game.js"));
setupGame(io);

const modeTimer = timers.find((h) => h.interval && h.ms === 200);
// El hockey también corre a 50 Hz: el tick del TNT es el último que se registra.
const fiftyMsTimers = timers.filter((h) => h.interval && h.ms === DEF.TNT_TICK_MS);
const tntTimer = fiftyMsTimers[fiftyMsTimers.length - 1];
ok(modeTimer, "no se registró el tick general de minijuegos");
ok(tntTimer, "no se registró el tick de 20 Hz del TNT");

const PORTAL = HUB.HUB_PORTALS.find((p) => p.modeId === "tnt");
const ROOM = MODE.modeRoomCode("tnt");
const SOCKETS = [];

function enterGame(id, name) {
  const sock = mk(id);
  io.connect(sock);
  fire(sock, "player:join", { name });
  fire(sock, "hub:enter");
  const spawn = welcomePos(id) || HUB.HUB_SPAWN;
  ok(moveTo(sock, id, PORTAL), `${name} llega al portal del TNT`);
  SOCKETS.push(sock);
  return sock;
}

let A, B, C, D;

run("13 servidor: sala oculta MODO-TNT sin combate", () => {
  A = enterGame("A", "Alfa");
  const from = emitted.length;
  fire(A, "mode:join", { modeId: "tnt" });
  const state = lastFor("room:state", "A", from);
  ok(state, "responde room:state");
  eq(state.d.room.kind, "mode", "zona de minijuego");
  eq(state.d.room.modeId, "tnt", "modo TNT");
  eq(state.d.room.code, ROOM, "sala oculta");
  eq(state.d.room.combat, false, "sin combate");
  eq(state.d.room.mapId, "tnt", "mapa de la isla");
  const mode = roomEmit("mode:state", ROOM, from);
  ok(mode, "difunde mode:state");
  eq(mode.d.phase, "waiting", "espera jugadores");
  eq(mode.d.minPlayers, 4, "mínimo de cuatro");
  eq(mode.d.maxPlayers, 16, "máximo de dieciséis");
  const list = find("room:list", (x) => x.ch === "#A", from);
  if (list) eq(list.d.rooms.some((r) => r.code === ROOM), false, "sala oculta no se anuncia");
});

run("14 servidor: listo, cuenta atrás y teletransporte con altura", () => {
  B = enterGame("B", "Beta");
  C = enterGame("C", "Gamma");
  D = enterGame("D", "Delta");
  const joinFrom = emitted.length;
  [B, C, D].forEach((sock) => fire(sock, "mode:join", { modeId: "tnt" }));
  const waiting = roomEmit("mode:state", ROOM, joinFrom);
  eq(waiting.d.players.length, 4, "cuatro jugadores en la sala");

  const startFrom = emitted.length;
  [A, B, C, D].forEach((sock) => fire(sock, "mode:action", { type: "ready" }));
  clock += 100;
  tntTimer.fn();
  const countdown = roomEmit("mode:state", ROOM, startFrom);
  ok(countdown, "difunde la cuenta atrás");
  eq(countdown.d.phase, "countdown", "fase countdown");

  clock += DEF.TNT_COUNTDOWN_MS + 10;
  const playFrom = emitted.length;
  tntTimer.fn();
  const playing = roomEmit("mode:state", ROOM, playFrom);
  ok(playing, "difunde el inicio");
  eq(playing.d.phase, "playing", "fase playing");
  const teleports = all("mode:teleport", (x) => String(x.ch).startsWith("room:" + ROOM), startFrom);
  ok(teleports.length >= 4, "teletransporte para los cuatro");
  ok(teleports.every((x) => x.d.y === 6), "todos teletransportados a la capa alta");
  const fuses = all("mode:event", (x) => x.d && x.d.type === "fuse", playFrom);
  ok(fuses.length >= 4, "se encienden las celdas de salida");
  ok(fuses.every((x) => x.d.modeId === "tnt"), "los eventos llevan el modo");
});

run("15 servidor: movimiento autoritativo, mecha y caída de bloques", () => {
  const state = roomEmit("mode:state", ROOM);
  const mine = state.d.players.find((p) => p.id === "A");
  const next = DEF.tntCellCenter(mine.cell.row, mine.cell.col + 1);
  const from = emitted.length;
  fire(A, "player:move", { x: next.x, z: next.z, y: 9 });
  const moved = find("player:moved", (x) => x.d && x.d.id === "A", from);
  ok(moved, "el servidor acepta el paso");
  eq(moved.d.y, 6, "la altura la decide la capa, no el cliente");
  eq(Math.round(moved.d.x * 100), Math.round(next.x * 100), "posición corregida a la celda");
  const expectedIndex = DEF.tntGlobalIndex(4, mine.cell.row, mine.cell.col + 1);
  ok(
    find("mode:event", (x) => x.d && x.d.type === "fuse" && x.d.index === expectedIndex, from),
    "evento de mecha de la celda pisada"
  );

  clock += DEF.TNT_FUSE_MS + 10;
  const fallFrom = emitted.length;
  tntTimer.fn();
  const blockFall = find("mode:event", (x) => x.d && x.d.type === "blockFall", fallFrom);
  ok(blockFall, "evento de desplome");
  ok(blockFall.d.indices.length >= 5, "caen las cuatro salidas y la celda nueva");
  const drops = all("mode:teleport", (x) => x.d && x.d.y === 4.5, fallFrom);
  ok(drops.length >= 4, "los cuatro bajan a la capa 3");
  const after = roomEmit("mode:state", ROOM, fallFrom);
  ok(after.d.players.every((p) => p.layer === 3), "estado sin jugadores flotando");

  const combatFrom = emitted.length;
  fire(A, "combat:shoot", { dx: 0, dz: -1 });
  fire(A, "combat:block", { on: true });
  fire(A, "inventory:use", { slot: 0 });
  eq(find("combat:shot", (x) => x.ch === "room:" + ROOM, combatFrom), null, "no se puede disparar");
  const toast = lastFor("inventory:toast", "A", combatFrom);
  if (toast) eq(/TNT/.test(toast.d.text), true, "avisa de que no se puede curar");
});

run("16 servidor: reconexión conserva la capa durante 45 s", () => {
  const before = roomEmit("mode:state", ROOM);
  const old = before.d.players.find((p) => p.id === "B");
  eq(old.layer, 3, "B está en la capa 3");

  const from = emitted.length;
  fire(B, "disconnect");
  const offline = roomEmit("mode:state", ROOM, from);
  ok(offline, "estado tras la desconexión");
  eq(offline.d.players.find((p) => p.id === "B").offline, true, "B marcado offline");
  eq(offline.d.phase, "playing", "la partida sigue");

  const E = mk("E");
  io.connect(E);
  fire(E, "player:join", { name: "Beta" });
  const notice = lastFor("mode:rejoin", "E");
  ok(notice, "el servidor avisa al cliente");
  eq(notice.d.modeId, "tnt", "aviso del modo correcto");

  const joinFrom = emitted.length;
  fire(E, "mode:join", { modeId: "tnt", rejoin: true });
  const rejoined = roomEmit("mode:state", ROOM, joinFrom);
  ok(rejoined, "estado difundido al reingresar");
  const back = rejoined.d.players.find((p) => p.id === "E");
  ok(back, "el nuevo socket está en la partida");
  eq(back.layer, old.layer, "recupera la capa");
  eq(back.blocks, old.blocks, "recupera los bloques");
  eq(back.offline, false, "ya no está offline");
  eq(rejoined.d.players.some((p) => p.id === "B"), false, "el socket antiguo desaparece");
});

const failed = results.filter((r) => !r.ok);
console.log(`\nRESULTADO tnt: ${results.length - failed.length}/${results.length} ok`);
if (failed.length) {
  console.log(failed.map((r) => `- ${r.name}: ${r.extra || ""}`).join("\n"));
  process.exit(1);
}
