// Suite del Escondite (Ola 2).
//
// Cubre cuatro capas:
//  1. Contrato compartido: 12 escondites, estándares de la aldea y línea de visión.
//  2. Controlador autoritativo: fases, roles, etiquetas, esquivas, pulso y gracia.
//  3. Persistencia: columnas hide_wins y seek_wins.
//  4. Servidor real con Socket.IO simulado: portal, sala sin combate, jaula,
//     teletransporte, pulso sanitizado y reconexión con el rol reservado.

import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

process.env.DB_PATH = path.join(os.tmpdir(), "pingui-escondite-" + Date.now() + ".db");

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

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------- módulos puros
const DEF = await import(url("public/js/hideDefs.js"));
const MODE = await import(url("public/js/modeDefs.js"));
const HUB = await import(url("public/js/hubDefs.js"));
const MAPS = await import(url("public/js/mapDefs.js"));
const OBS = await import(url("public/js/mapObstacles.js"));
const CTRL = await import(url("server/modes/escondite.js"));
const DB = await import(url("server/db.js"));

run("01 defs: doce escondites, jaula y constantes de juego", () => {
  eq(DEF.HIDE_MIN_PLAYERS, 3, "mínimo de jugadores");
  eq(DEF.HIDE_MAX_PLAYERS, 12, "máximo de jugadores");
  eq(DEF.HIDE_HIDE_MS, 90000, "fase de ocultación");
  eq(DEF.HIDE_SEEK_MS, 180000, "fase de búsqueda");
  eq(DEF.HIDE_RECONNECT_GRACE_MS, 45000, "gracia de reconexión");
  eq(DEF.HIDE_TAG_RANGE, 1.6, "alcance de etiqueta");
  eq(DEF.HIDE_DASH_COUNT, 3, "tres esquivas");
  eq(DEF.HIDE_DASH_RECHARGE_MS, 25000, "recarga de esquiva");
  eq(DEF.HIDE_PULSE_COOLDOWN_MS, 30000, "recarga del pulso");
  eq(DEF.HIDE_PULSE_RADIUS, 8, "radio del pulso");
  eq(DEF.HIDE_PHASES.join(","), "waiting,hide,seek,result", "fases");
  eq(DEF.HIDE_SPOTS.length, 12, "doce escondites");
  eq(DEF.HIDE_COVERS.length, 12, "una cobertura por escondite");
  eq(new Set(DEF.HIDE_SPOTS.map((s) => s.id)).size, 12, "ids únicos");
  const kinds = DEF.HIDE_SPOTS.map((s) => s.kind).join(",");
  eq(kinds, "cabin,haystack,crate,fence,well,tree,cabin,haystack,crate,fence,well,tree", "tipos repartidos");
  eq(DEF.HIDE_ROLES.seeker.name, "Buscador", "nombre del buscador");
  eq(DEF.HIDE_ROLES.hider.name, "Escondido", "nombre del escondido");
  eq(DEF.hideSeekerSpawn().x, 0, "buscador en el centro");
  eq(DEF.hideSeekerSpawn().z, 0, "buscador en el centro");
  const spawn = DEF.hideStartSpawn(0, 3);
  eq(Math.round(Math.hypot(spawn.x, spawn.z)), DEF.HIDE_START_RADIUS, "anillo de salida");
});

run("02 mapa: aldea, coberturas compartidas y portal en vivo", () => {
  const map = MAPS.getMap("escondite");
  eq(map.size, 72, "mapa de 72 m");
  eq(map.room, false, "no es sala privada");
  eq(MAPS.getRoomMaps().some((m) => m.id === "escondite"), false, "fuera del selector");
  const obstacles = OBS.MAP_OBSTACLES.escondite;
  eq(obstacles.length, 24, "12 coberturas y 12 adornos");
  eq(obstacles.filter((o) => o.kind === "cabin").length, 2, "cabañas");
  eq(obstacles.filter((o) => o.kind === "fence").length, 2, "vallas");
  const boundary = MAPS.getMapBoundary("escondite");
  for (const o of obstacles) {
    if (Math.abs(o.x) > boundary || Math.abs(o.z) > boundary) {
      throw new Error(`obstáculo fuera del mapa: ${o.kind}`);
    }
  }
  eq(OBS.isInsideObstacle("escondite", 0, 0, 0.2), false, "jaula despejada");
  for (const spot of DEF.HIDE_SPOTS) {
    eq(OBS.isInsideObstacle("escondite", spot.x, spot.z, 0.2), false, `escondite ${spot.id} libre`);
  }
  const mode = MODE.getMode("escondite");
  eq(mode.status, "live", "modalidad en vivo");
  eq(mode.combat === true, false, "sin combate");
  eq(MODE.modeRoomCode("escondite"), "MODO-ESCONDITE", "sala oculta");
  eq(MODE.isModeLive("escondite"), true, "isModeLive");
  const portal = HUB.HUB_PORTALS.find((p) => p.modeId === "escondite");
  ok(portal, "falta el portal del Escondite");
  eq(portal.status, "live", "portal activo");
});

run("03 línea de visión: las coberturas tapan la jaula y los escondites", () => {
  for (const spot of DEF.HIDE_SPOTS) {
    eq(DEF.hasLineOfSight(0, 0, spot.x, spot.z, DEF.HIDE_COVERS), false, `escondite ${spot.id} tapado`);
  }
  eq(DEF.hasLineOfSight(0, 0, 3, 0, DEF.HIDE_COVERS), true, "zona interior despejada");
  // La valla de (0, 24) bloquea una etiqueta a 1,6 m a ambos lados.
  eq(DEF.canTag({ x: 0, z: 23.2 }, { x: 0, z: 24.8 }, DEF.HIDE_COVERS), false, "no se etiqueta tras la valla");
  eq(DEF.canTag({ x: 3, z: 0 }, { x: 4, z: 0 }, DEF.HIDE_COVERS), true, "etiqueta con línea libre");
  eq(DEF.canTag({ x: 0, z: 0 }, { x: 4, z: 0 }, DEF.HIDE_COVERS), false, "fuera de alcance");
  eq(DEF.hideSpotAt(DEF.HIDE_SPOTS[0].x, DEF.HIDE_SPOTS[0].z).id, 0, "detecta el escondite");
  eq(DEF.hideSpotAt(0, 0), null, "la jaula no es escondite");
  eq(DEF.stableHideKey({ userId: 7, name: "Alfa" }), "u:7", "clave de cuenta");
  eq(DEF.stableHideKey({ userId: null, name: " AlFa " }), "n:alfa", "clave de invitado");
});

// ------------------------------------------------------- controlador puro
function makeController(seed = 1, positions = new Map()) {
  const clock = { value: 1_000_000 };
  const game = CTRL.createEsconditeGame({
    now: () => clock.value,
    rng: mulberry32(seed),
    positionOf: (id) => positions.get(id) || null,
  });
  return { game, clock, positions };
}

function fill(game, ids = ["A", "B", "C"]) {
  ids.forEach((id) => game.join({ id, name: id, userId: id === "A" ? 1 : null }));
  ids.forEach((id) => game.action(id, { type: "ready" }));
  return game.tick();
}

run("04 controlador: espera,roles con semilla y buscador congelado", () => {
  const { game, clock } = makeController(1);
  game.join({ id: "A", name: "Alfa" });
  game.join({ id: "B", name: "Beta" });
  eq(game.snapshot().phase, "waiting", "espera jugadores");
  eq(game.join({ id: "C", name: "Gamma" }).ok, true, "tercer jugador aceptado");
  eq(game.action("A", { type: "ready" }).ok, true, "A listo");
  eq(game.tick(), false, "falta el resto");
  game.action("B", { type: "ready" });
  game.action("C", { type: "ready" });
  clock.value += 100;
  eq(game.tick(), true, "todos listos abre la fase hide");
  const snap = game.snapshot();
  eq(snap.phase, "hide", "fase hide");
  eq(snap.round, 1, "primera partida");
  eq(new Set(snap.players.map((p) => p.role)).size, 2, "un buscador y escondidos");
  eq(snap.players.filter((p) => p.role === "seeker").length, 1, "un solo buscador");
  eq(snap.seekerId, snap.players.find((p) => p.role === "seeker").id, "seekerId coincide");
  const seeker = snap.seekerId;
  eq(game.canMove(seeker), false, "buscador no puede moverse en hide");
  eq(game.canMove(seeker === "A" ? "B" : "A"), true, "escondido sí puede moverse");
  eq(game.spawnFor(seeker).x, 0, "buscador spawn en la jaula");
  eq(game.action(seeker, { type: "tag", targetId: "B" }).reason, "wrong-phase", "no se etiqueta en hide");

  clock.value += DEF.HIDE_HIDE_MS;
  eq(game.tick(), true, "termina hide");
  eq(game.snapshot().phase, "seek", "fase seek");
  eq(game.canMove(seeker), true, "buscador ya puede salir");
});

run("05 controlador: semilla distinta cambia al buscador", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 8; seed++) {
    const { game } = makeController(seed);
    fill(game);
    seen.add(game.snapshot().seekerId);
  }
  ok(seen.size > 1, "la semilla influye en el buscador");
});

run("06 controlador: etiqueta con distancia y línea de visión", () => {
  const positions = new Map([
    ["A", { x: 0, z: 0 }],
    ["B", { x: 1, z: 0 }],
    ["C", { x: 0, z: 23.2 }],
  ]);
  const { game, clock } = makeController(1, positions);
  game.join({ id: "A", name: "Alfa" });
  game.join({ id: "B", name: "Beta" });
  game.join({ id: "C", name: "Gamma" });
  ["A", "B", "C"].forEach((id) => game.action(id, { type: "ready" }));
  clock.value += 100;
  game.tick();
  const seeker = game.snapshot().seekerId;
  const other = seeker === "A" ? "B" : "A";

  // Colocamos al buscador en (0,0) y a un escondido a 1 m, con línea libre.
  positions.set(seeker, { x: 0, z: 0 });
  positions.set(other, { x: 1, z: 0 });
  clock.value += DEF.HIDE_HIDE_MS;
  game.tick();
  eq(game.action(seeker, { type: "tag", targetId: other }).ok, true, "etiqueta válida");
  eq(game.snapshot().players.find((p) => p.id === other).tagged, true, "escondido marcado");
  eq(game.action(seeker, { type: "tag", targetId: other }).reason, "bad-target", "no se repite");

  // El otro escondido está detrás de la valla de (0, 24), a 1,6 m.
  const walled = game.snapshot().players.find((p) => p.role === "hider" && !p.tagged).id;
  positions.set(seeker, { x: 0, z: 23.3 });
  positions.set(walled, { x: 0, z: 24.7 });
  eq(game.action(seeker, { type: "tag", targetId: walled }).reason, "blocked", "bloquea la cobertura");

  positions.set(seeker, { x: 40, z: 40 });
  eq(game.action(seeker, { type: "tag", targetId: walled }).reason, "too-far", "fuera de alcance");
});

run("07 controlador: esquivas del escondido y pulso del buscador", () => {
  const positions = new Map([
    ["A", { x: 0, z: 0 }],
    ["B", { x: 7, z: 0 }],
    ["C", { x: 0, z: 12 }],
  ]);
  const { game, clock } = makeController(1, positions);
  fill(game);
  clock.value += DEF.HIDE_HIDE_MS;
  game.tick();
  const seeker = game.snapshot().seekerId;
  const hiders = game.snapshot().players.filter((p) => p.role === "hider").map((p) => p.id);
  positions.set(seeker, { x: 0, z: 0 });

  for (const hider of hiders) {
    positions.set(hider, { x: 7, z: 0 });
    for (let i = 0; i < DEF.HIDE_DASH_COUNT; i++) {
      eq(game.action(hider, { type: "dash" }).ok, true, `esquiva ${i + 1} de ${hider}`);
    }
  }
  eq(game.action(hiders[0], { type: "dash" }).reason, "not-ready", "sin esquivas");
  eq(game.action(hiders[0], { type: "dash" }).ok, false, "sigue sin esquivas");
  clock.value += DEF.HIDE_DASH_RECHARGE_MS;
  game.tick();
  eq(game.action(hiders[0], { type: "dash" }).ok, true, "recarga tras 25 s");

  // El pulso solo ve a quien está a 8 m con línea libre: el primer escondido
  // a 7 m y el segundo a 12 m (los ids dependen de la semilla).
  const nearHider = hiders[0];
  const farHider = hiders[1];
  positions.set(seeker, { x: 0, z: 0 });
  positions.set(nearHider, { x: 7, z: 0 });
  positions.set(farHider, { x: 0, z: 12 });
  const pulse = game.action(seeker, { type: "pulse" });
  eq(pulse.ok, true, "pulso disponible");
  eq(pulse.hits.includes(nearHider), true, "detecta al escondido cercano");
  eq(pulse.hits.includes(farHider), false, "no detecta al lejano");
  eq(game.action(seeker, { type: "pulse" }).reason, "not-ready", "pulso en recarga");
  clock.value += DEF.HIDE_PULSE_COOLDOWN_MS;
  eq(game.action(seeker, { type: "pulse" }).ok, true, "pulso recargado");
  eq(game.action(hiders[0], { type: "pulse" }).reason, "wrong-role", "pulso es solo del buscador");
});

run("08 controlador: reconexión con gracia y expiración", () => {
  const { game, clock } = makeController(1);
  fill(game);
  clock.value += DEF.HIDE_HIDE_MS;
  game.tick();
  const snap = game.snapshot();
  const seeker = snap.seekerId;
  const hider = snap.players.find((p) => p.role === "hider");
  // `fill` da userId 1 a A y deja a B/C como invitados; el snapshot no expone
  // el userId, así que se recupera del id para componer la clave estable.
  const hiderUserId = hider.id === "A" ? 1 : null;

  eq(game.leave(hider.id, { reason: "disconnect" }).offline, true, "desconexión reserva el rol");
  eq(game.snapshot().players.find((p) => p.id === hider.id).offline, true, "aparece offline");
  eq(game.canRejoin({ userId: hiderUserId, name: hider.name }), true, "rejoin disponible");
  eq(game.canRejoin({ userId: 999, name: "Otro" }), false, "otro nombre no reclama el rol");
  const rejoined = game.join({ id: "NEW", name: hider.name, userId: hiderUserId });
  eq(rejoined.ok, true, "rejoin aceptado");
  eq(rejoined.rejoin, true, "marca rejoin");
  eq(rejoined.role, "hider", "recupera el rol");
  eq(game.snapshot().players.find((p) => p.id === "NEW").role, "hider", "nuevo socket es escondido");

  eq(game.leave("NEW", { reason: "disconnect" }).offline, true, "segunda desconexión");
  clock.value += DEF.HIDE_RECONNECT_GRACE_MS + 1;
  game.tick();
  eq(!!game.snapshot().players.find((p) => p.id === "NEW"), false, "expira tras 45 s");
  eq(game.canRejoin({ userId: hiderUserId, name: hider.name }), false, "reserva caducada");
  eq(game.canMove(seeker), true, "la partida sigue en seek");
});

run("09 controlador: tres partidas completas y reinicio", () => {
  for (let seed = 1; seed <= 3; seed++) {
    const positions = new Map();
    const { game, clock } = makeController(seed, positions);
    game.join({ id: "A", name: "Alfa", userId: 1 });
    game.join({ id: "B", name: "Beta", userId: 2 });
    game.join({ id: "C", name: "Gamma", userId: 3 });
    ["A", "B", "C"].forEach((id) => game.action(id, { type: "ready" }));
    clock.value += 100;
    game.tick();
    eq(game.snapshot().phase, "hide", `partida ${seed}: hide`);

    clock.value += DEF.HIDE_HIDE_MS;
    game.tick();
    eq(game.snapshot().phase, "seek", `partida ${seed}: seek`);

    // Victoria del buscador: se etiqueta a todos los escondidos.
    const seeker = game.snapshot().seekerId;
    const hiders = game.snapshot().players.filter((p) => p.role === "hider").map((p) => p.id);
    positions.set(seeker, { x: 0, z: 0 });
    for (const hider of hiders) {
      positions.set(hider, { x: 1, z: 0 });
      const res = game.action(seeker, { type: "tag", targetId: hider });
      eq(res.ok, true, `partida ${seed}: etiqueta a ${hider}`);
    }
    let snap = game.snapshot();
    eq(snap.phase, "result", `partida ${seed}: result`);
    eq(snap.winner.role, "seeker", `partida ${seed}: gana el buscador`);
    const stats = game.resultStats();
    eq(stats.winner, "seeker", `partida ${seed}: stats del buscador`);
    eq(stats.winners.length, 1, `partida ${seed}: un ganador`);

    clock.value += DEF.HIDE_RESULT_MS;
    game.tick();
    snap = game.snapshot();
    eq(snap.phase, "waiting", `partida ${seed}: vuelve a waiting`);
    eq(snap.players.every((p) => !p.ready && !p.role), true, `partida ${seed}: roles limpios`);
  }
});

run("10 controlador: los escondidos ganan si sobreviven al reloj", () => {
  const { game, clock } = makeController(2);
  fill(game);
  clock.value += DEF.HIDE_HIDE_MS;
  game.tick();
  clock.value += DEF.HIDE_SEEK_MS;
  game.tick();
  const snap = game.snapshot();
  eq(snap.phase, "result", "termina por tiempo");
  eq(snap.winner.role, "hider", "ganan los escondidos");
  eq(snap.winner.reason, "timeout", "motivo timeout");
  eq(game.resultStats().winners.length, 2, "dos escondidos ganadores");
});

run("11 db: hide_wins y seek_wins se acumulan", () => {
  const userId = DB.createUser("escondidor", "hash", "#ffffff", null);
  DB.recordUserStats(userId, { hideWins: 1, seekWins: 0 });
  let stats = DB.getUserStats(userId);
  eq(stats.hide_wins, 1, "una victoria como escondido");
  eq(stats.seek_wins, 0, "ninguna como buscador");
  DB.recordUserStats(userId, { hideWins: 0, seekWins: 2 });
  stats = DB.getUserStats(userId);
  eq(stats.hide_wins, 1, "las victorias de escondido se conservan");
  eq(stats.seek_wins, 2, "las victorias de buscador se suman");
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

Math.random = mulberry32(20261119);

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
const currentPos = (id) => {
  const moved = find("player:moved", (x) => x.d && x.d.id === id && String(x.ch).startsWith("room:"));
  if (moved) return { x: moved.d.x, z: moved.d.z };
  return welcomePos(id) || HUB.HUB_SPAWN;
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
    const before = emitted.length;
    fire(sock, "player:move", { x: nx, z: nz });
    const mv = find(
      "player:moved",
      (x) => x.d && x.d.id === id && String(x.ch).startsWith("room:"),
      before
    );
    if (!mv) return false;
    cur = { x: mv.d.x, z: mv.d.z };
  }
  return false;
}

const { setupGame } = await import(url("server/game.js"));
setupGame(io);

const modeTimer = timers.find((h) => h.interval && h.ms === 200);
ok(modeTimer, "no se registró el tick de minijuegos");

const PORTAL = HUB.HUB_PORTALS.find((p) => p.modeId === "escondite");
const ROOM = MODE.modeRoomCode("escondite");
const SOCKETS = [];

function enterGame(id, name) {
  const sock = mk(id);
  io.connect(sock);
  fire(sock, "player:join", { name });
  fire(sock, "hub:enter");
  const spawn = welcomePos(id) || HUB.HUB_SPAWN;
  ok(moveTo(sock, id, PORTAL), `${name} llega al portal del Escondite`);
  SOCKETS.push(sock);
  return sock;
}

let A, B, C;

run("12 servidor: entrada sin combate y sala oculta del Escondite", () => {
  A = enterGame("A", "Alfa");
  const from = emitted.length;
  fire(A, "mode:join", { modeId: "escondite" });
  const state = lastFor("room:state", "A", from);
  ok(state, "responde room:state");
  eq(state.d.room.kind, "mode", "zona de minijuego");
  eq(state.d.room.modeId, "escondite", "modo Escondite");
  eq(state.d.room.code, ROOM, "sala oculta");
  eq(state.d.room.combat, false, "sin combate");
  eq(state.d.room.mapId, "escondite", "mapa de la aldea");
  const mode = roomEmit("mode:state", ROOM, from);
  ok(mode, "difunde mode:state");
  eq(mode.d.phase, "waiting", "espera jugadores");
  eq(mode.d.minPlayers, 3, "mínimo de tres");
  const list = find("room:list", (x) => x.ch === "#A", from);
  if (list) eq(list.d.rooms.some((r) => r.code === ROOM), false, "sala oculta no se anuncia");
});

run("13 servidor: listo, jaula y teletransporte autoritativo", () => {
  B = enterGame("B", "Beta");
  C = enterGame("C", "Gamma");
  const joinFrom = emitted.length;
  fire(B, "mode:join", { modeId: "escondite" });
  fire(C, "mode:join", { modeId: "escondite" });
  const state = roomEmit("mode:state", ROOM, joinFrom);
  eq(state.d.players.length, 3, "tres jugadores en la sala");

  const startFrom = emitted.length;
  fire(A, "mode:action", { type: "ready" });
  fire(B, "mode:action", { type: "ready" });
  fire(C, "mode:action", { type: "ready" });
  clock += 100;
  modeTimer.fn();
  const hide = roomEmit("mode:state", ROOM, startFrom);
  ok(hide, "difunde el inicio");
  eq(hide.d.phase, "hide", "fase hide");
  eq(hide.d.players.filter((p) => p.role === "seeker").length, 1, "un buscador");
  const seekerId = hide.d.seekerId;
  ok(seekerId, "hay buscador");
  const teleports = [];
  for (let i = startFrom; i < emitted.length; i++) {
    if (emitted[i].e === "mode:teleport") teleports.push(emitted[i].d);
  }
  eq(teleports.length, 3, "teletransporte para los tres");
  const seekerTp = teleports.find((x) => x.id === seekerId);
  eq(seekerTp.x, 0, "buscador a la jaula");
  eq(seekerTp.z, 0, "buscador a la jaula");

  // El buscador no puedemoverse en hide aunque envíe player:move.
  const moveFrom = emitted.length;
  fire(seekerId === "A" ? A : seekerId === "B" ? B : C, "player:move", { x: 1.2, z: 0 });
  eq(
    find("player:moved", (x) => x.d && x.d.id === seekerId, moveFrom),
    null,
    "el servidor ignora el movimiento del buscador en hide"
  );
});

run("14 servidor: fase seek, pulso sanitizado y sin combate", () => {
  const from = emitted.length;
  clock += DEF.HIDE_HIDE_MS + 100;
  modeTimer.fn();
  const seek = roomEmit("mode:state", ROOM, from);
  ok(seek, "difunde seek");
  eq(seek.d.phase, "seek", "fase seek");
  const seekerId = seek.d.seekerId;
  const seekerSock = seekerId === "A" ? A : seekerId === "B" ? B : C;

  const pulseFrom = emitted.length;
  fire(seekerSock, "mode:action", { type: "pulse" });
  const publicPulse = find("mode:event", (x) => x.ch === "room:" + ROOM && x.d.type === "pulse", pulseFrom);
  const privatePulse = find("mode:event", (x) => x.ch === seekerId && x.d.type === "pulse", pulseFrom);
  ok(publicPulse, "evento público de pulso");
  ok(privatePulse, "evento privado para el buscador");
  eq(Array.isArray(publicPulse.d.hits), true, "el público lleva hits");
  eq(publicPulse.d.hits.length, 0, "el resto no ve a quién detectó");
  eq(Array.isArray(privatePulse.d.hits), true, "el buscador ve los hits");

  const shootFrom = emitted.length;
  fire(seekerSock, "combat:shoot", { dx: 0, dz: -1 });
  eq(find("combat:shot", (x) => x.ch === "room:" + ROOM, shootFrom), null, "no se puede disparar");
  fire(seekerSock, "combat:block", { on: true });
  eq(find("combat:block", (x) => x.ch === "#" + seekerId, shootFrom), null, "no se puede bloquear");
  fire(seekerSock, "inventory:use", { slot: 0 });
  const toast = lastFor("inventory:toast", seekerId, shootFrom);
  if (toast) eq(/Escondite/.test(toast.d.text), true, "avisa de que no se puede curar");
});

run("15 servidor: reconexión conserva el rol 45 s", () => {
  const before = roomEmit("mode:state", ROOM);
  ok(before, "hay estado de la partida");
  const seekerId = before.d.seekerId;
  const seekerSock = seekerId === "A" ? A : seekerId === "B" ? B : C;
  const name = seekerId === "A" ? "Alfa" : seekerId === "B" ? "Beta" : "Gamma";

  fire(seekerSock, "disconnect");
  const offline = roomEmit("mode:state", ROOM);
  ok(offline, "estado tras la desconexión");
  eq(offline.d.players.find((p) => p.id === seekerId).offline, true, "jugador marcado offline");
  eq(offline.d.phase, "seek", "la partida sigue");

  const D = mk("D");
  io.connect(D);
  fire(D, "player:join", { name });
  const rejoinNotice = lastFor("mode:rejoin", "D");
  ok(rejoinNotice, "el servidor avisa al cliente de la reconexión");
  eq(rejoinNotice.d.modeId, "escondite", "aviso del modo correcto");

  const from = emitted.length;
  fire(D, "mode:join", { modeId: "escondite", rejoin: true });
  const rejoined = roomEmit("mode:state", ROOM, from);
  ok(rejoined, "estado difundido al reingresar");
  const back = rejoined.d.players.find((p) => p.id === "D");
  ok(back, "el nuevo socket está en la partida");
  eq(back.role, "seeker", "recupera el rol de buscador");
  eq(back.offline, false, "ya no está offline");
  eq(rejoined.d.seekerId, "D", "el buscador ahora es D");
});
