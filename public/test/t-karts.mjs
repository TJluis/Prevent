// Suite de Karts (Bloque 1).
//
// Cubre cuatro capas:
//  1. Contrato compartido: catálogo de 5 karts, tres pistas con longitudes
//     verificadas, spline, superficies, turbos, túneles y atajos.
//  2. Controlador autoritativo: fases, compra/equipo, checkpoints por sector,
//     tres vueltas, puntos y rejoin.
//  3. Persistencia: race_points y tabla user_karts.
//  4. Servidor real con Socket.IO simulado: sala MODO-KARTS sin combate,
//     paddock, compra persistida, tick propio de 20 Hz y carrera completa.

import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

process.env.DB_PATH = path.join(os.tmpdir(), "pingui-karts-" + Date.now() + ".db");

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
const DEF = await import(url("public/js/kartsDefs.js"));
const MODE = await import(url("public/js/modeDefs.js"));
const HUB = await import(url("public/js/hubDefs.js"));
const MAPS = await import(url("public/js/mapDefs.js"));
const OBS = await import(url("public/js/mapObstacles.js"));
const CTRL = await import(url("server/modes/karts.js"));
const DB = await import(url("server/db.js"));

run("01 defs: catálogo de cinco karts con precios y stats equilibradas", () => {
  eq(DEF.KART_CATALOG.length, 5, "cinco karts");
  eq(DEF.KART_CATALOG.map((kart) => kart.price).join(","), "0,180,360,650,1000", "precios");
  eq(DEF.KART_START_ID, "pingui_gt", "kart inicial");
  const speeds = DEF.KART_CATALOG.map((kart) => kart.speed);
  eq(Math.min(...speeds), 25, "velocidad mínima");
  eq(Math.max(...speeds), 31, "velocidad máxima");
  ok(DEF.kartStats("cometa").speed === 28, "stats por id");
  ok(DEF.kartStats("inexistente").speed === 25, "stats por defecto");
  eq(DEF.kartById("rayo").name, "Rayo", "búsqueda por id");
  eq(DEF.kartById("nope"), null, "id inexistente");
  eq(DEF.KARTS_LAPS, 3, "tres vueltas");
  eq(DEF.KARTS_MAX_PLAYERS, 8, "ocho jugadores");
  eq(DEF.KARTS_TICK_MS, 50, "física a 20 Hz");
  eq(DEF.KARTS_PHASES.join(","), "waiting,countdown,racing,finished", "fases");
});

run("02 defs: tres pistas con la longitud pedida y sus diferenciadores", () => {
  eq(DEF.KARTS_TRACKS.length, 3, "tres pistas");
  eq(DEF.KARTS_TRACKS.map((track) => track.status).join(","), "live,prep,prep", "solo la primera jugable");
  for (const track of DEF.KARTS_TRACKS) {
    ok(Math.abs(track.length - track.targetLength) < 1, `${track.id}: longitud ${track.length}`);
    ok(track.frames.length > 500, `${track.id}: spline muestreada`);
    ok(track.surfaces.length >= 2, `${track.id}: superficies`);
    ok(track.boosts.length >= 2, `${track.id}: turbos`);
    ok(track.tunnels.length >= 1, `${track.id}: túneles`);
    ok(track.shortcuts.length >= 1, `${track.id}: atajos`);
    ok(track.obstacles.length >= 5, `${track.id}: obstáculos con colisión`);
    ok(
      track.obstacles.every((o) => Math.abs(o.lateral) + o.radius < track.width / 2),
      `${track.id}: los obstáculos dejan hueco para pasar`
    );
  }
  eq(DEF.KARTS_TRACKS.map((t) => t.targetLength).join(","), "1000,1600,2400", "longitudes objetivo");
  eq(DEF.isTrackPlayable("paddock"), true, "paddock jugable");
  eq(DEF.isTrackPlayable("dunas"), false, "dunas en preparación");
  eq(DEF.isTrackPlayable("nope"), false, "id desconocido");
});

run("03 defs: spline, proyección, sectores y ayudas por parámetro", () => {
  const p = DEF.kartsPointAt("paddock", 0);
  ok(Math.hypot(p.x, p.z) < 0.1, "el arco 0 está en el origen");
  const n = DEF.kartsNearest("paddock", p.x, p.z);
  ok(n.distance < 0.1, "la proyección cae sobre la pista");
  ok(Math.abs(n.t - p.t) < 0.01 || Math.abs(n.t - 1) < 0.01, "parámetro coherente");
  eq(DEF.kartsPointAt("nope", 0), null, "pista inexistente");
  eq(DEF.kartsSectorOf(0), 0, "sector 0");
  eq(DEF.kartsSectorOf(0.2), 2, "sector 2");
  eq(DEF.kartsSectorOf(1), 0, "el final vuelve al sector 0");
  eq(DEF.kartsSurfaceAt("paddock", 0.24).type, "ice", "tramo de hielo");
  eq(DEF.kartsSurfaceAt("paddock", 0.9).type, "asphalt", "asfalto por defecto");
  eq(DEF.kartsBoostAt("paddock", 0.34), true, "turbo en t=0.34");
  eq(DEF.kartsBoostAt("paddock", 0.5), false, "sin turbo a media pista");
  ok(DEF.kartsShortcutAt("paddock", 0.15, -1), "atajo interior");
  eq(DEF.kartsShortcutAt("paddock", 0.15, 1), null, "el atajo tiene lado");
  eq(DEF.kartsTunnelAt("paddock", 0.5), true, "túnel a media pista");
  eq(DEF.kartsTunnelAt("paddock", 0.9), false, "sin túnel al final");
  const relief = DEF.kartsPointAt("paddock", 200, 2);
  ok(Number.isFinite(relief.bank) && Math.abs(relief.bank) > 0, "peralte en la spline");
  ok(Number.isFinite(relief.pitch), "pendiente en la spline");
  ok(
    Math.abs(DEF.kartsPointAt("paddock", 0).y - DEF.kartsPointAt("paddock", 450).y) > 1,
    "desnivel real entre dos puntos de la pista"
  );
  const firstObstacle = DEF.getTrack("paddock").obstacles[0];
  eq(
    DEF.kartsObstacleHits("paddock", firstObstacle.distance, firstObstacle.lateral).id,
    firstObstacle.id,
    "colisión sobre el obstáculo"
  );
  eq(
    DEF.kartsObstacleHits("paddock", firstObstacle.distance + 40, firstObstacle.lateral),
    null,
    "sin colisión lejos del obstáculo"
  );
  eq(
    DEF.kartsObstacleHits("paddock", firstObstacle.distance, firstObstacle.lateral + 5),
    null,
    "se puede esquivar por el lateral"
  );
  const spawns = [];
  for (let i = 0; i < 8; i++) spawns.push(DEF.kartsSpawnFor("paddock", i, 8));
  eq(new Set(spawns.map((s) => `${s.x.toFixed(1)},${s.z.toFixed(1)}`)).size, 8, "ocho salidas distintas");
  ok(spawns.every((s) => s.distance > 0 && s.distance < 100), "parrilla tras la línea");
});

run("04 defs: puntos por posición y vuelta, y paddock separado de la pista", () => {
  eq(DEF.kartRacePoints(1, 3, "paddock"), 150, "ganador: 120 + 3 vueltas");
  eq(DEF.kartRacePoints(2, 3, "paddock"), 125, "segundo: 95 + 3 vueltas");
  eq(DEF.kartRacePoints(8, 0, "paddock"), 24, "último sin vueltas");
  ok(DEF.kartRacePoints(1, 3, "cordillera") > 150, "pista larga da más puntos");
  const features = [
    DEF.KARTS_PADDOCK_SPAWN,
    ...DEF.KART_PEDESTALS,
    ...DEF.KARTS_PORTALS,
  ];
  ok(
    features.every((f) => DEF.kartsNearest("paddock", f.x, f.z).distance > 50),
    "paddock, tienda y portales lejos del trazado"
  );
  eq(DEF.KART_PEDESTALS.length, 5, "un pedestal por kart");
  eq(DEF.KARTS_PORTALS.length, 3, "tres portales");
  eq(DEF.KARTS_PORTAL_TRIGGER, 6, "radio de activación");
});

run("05 registro: mapa interno, modalidad activa y sala oculta", () => {
  const map = MAPS.getMap("karts");
  eq(map.size, 1400, "recinto grande");
  eq(map.room, false, "no es sala privada");
  eq(MAPS.getRoomMaps().some((m) => m.id === "karts"), false, "fuera del selector");
  eq(Array.isArray(OBS.MAP_OBSTACLES.karts), true, "colisión compartida");
  eq(OBS.MAP_OBSTACLES.karts.length, 0, "sin obstáculos de mapa en el paddock (los de pista van en kartsDefs)");
  eq(OBS.isInsideObstacle("karts", 0, -100), false, "paddock despejado");
  const mode = MODE.getMode("karts");
  eq(mode.status, "live", "modalidad activa");
  eq(mode.mapId, "karts", "usa su mapa");
  eq(mode.maxPlayers, 8, "hasta ocho");
  eq(mode.combat === true, false, "sin combate");
  eq(MODE.modeRoomCode("karts"), "MODO-KARTS", "sala oculta");
  eq(MODE.isModeLive("karts"), true, "isModeLive");
  const portal = HUB.HUB_PORTALS.find((p) => p.modeId === "karts");
  ok(portal, "falta el portal de la isla");
  eq(portal.status, "live", "portal activo");
});

// ------------------------------------------------------- controlador puro
function makeController() {
  const clock = { value: 1_000_000 };
  const events = [];
  const game = CTRL.createKartsGame({
    now: () => clock.value,
    onChange: (_snapshot, event) => {
      if (event) events.push(event.type);
    },
  });
  return { game, clock, events };
}

function beginRace(game, clock, pointsA = 0) {
  game.join({ id: "A", name: "Alfa", points: pointsA });
  game.join({ id: "B", name: "Beta" });
  game.action("A", { type: "track", trackId: "paddock" });
  game.action("B", { type: "ready" });
  clock.value += 50;
  game.tick(); // -> countdown
  clock.value += DEF.KARTS_COUNTDOWN_MS + 10;
  game.tick(); // -> racing
}

run("06 controlador: garaje, puntos y portales en preparación", () => {
  const { game } = makeController();
  eq(game.join({ id: "A", name: "Alfa", points: 500 }).ok, true, "jugador aceptado");
  eq(game.join({ id: "B", name: "Beta" }).ok, true, "segundo jugador");
  eq(game.snapshot().phase, "waiting", "espera en el paddock");
  eq(game.action("A", { type: "buy", kartId: "cometa" }).ok, true, "compra con puntos");
  eq(game.action("A", { type: "buy", kartId: "cometa" }).reason, "already-owned", "no compra dos veces");
  eq(game.action("B", { type: "buy", kartId: "rayo" }).reason, "not-enough-points", "sin puntos");
  eq(game.action("A", { type: "equip", kartId: "cometa" }).ok, true, "equipa");
  eq(game.action("A", { type: "equip", kartId: "titan" }).reason, "not-owned", "no equipa lo que no tiene");
  eq(game.action("A", { type: "track", trackId: "dunas" }).reason, "in-preparation", "pista en preparación");
  eq(game.action("A", { type: "track", trackId: "paddock" }).ok, true, "pista jugable");
  const mine = game.snapshot().players.find((p) => p.id === "A");
  eq(mine.points, 320, "500 - 180 de la Cometa");
  eq(mine.kartId, "cometa", "kart equipado");
  eq(mine.trackId, "paddock", "pista elegida");
  eq(mine.ready, true, "elegir pista marca listo");
});

run("07 controlador: cuenta atrás, física autoritativa y tres vueltas", () => {
  const { game, clock, events } = makeController();
  beginRace(game, clock);
  const snap = game.snapshot();
  eq(snap.phase, "racing", "carrera iniciada");
  eq(snap.trackId, "paddock", "pista de la carrera");
  eq(snap.laps, 3, "tres vueltas");
  eq(game.canMove("A"), false, "player:move bloqueado en carrera");
  eq(game.action("A", { type: "ready" }).reason, "wrong-phase", "sin cambios de fase en carrera");
  eq(game.action("A", { type: "drive", throttle: 1 }).ok, true, "intención de conducción");

  let ticks = 0;
  const heights = [];
  while (game.phase === "racing" && ticks < 20000) {
    game.action("A", { type: "drive", throttle: 1, steer: 0 });
    game.action("B", { type: "drive", throttle: 1, steer: 0 });
    clock.value += DEF.KARTS_TICK_MS;
    game.tick();
    if (ticks % 20 === 0) {
      const leader = game.snapshot().players.find((p) => p.id === "A");
      heights.push(leader.y);
    }
    ticks++;
  }
  ok(ticks < 20000, "la carrera termina por vueltas");
  const done = game.snapshot();
  eq(done.phase, "finished", "fase de resultado");
  ok(done.players.every((p) => p.laps === 3), "todos dan tres vueltas");
  eq(done.winner.id, "A", "gana quien salió delante");
  eq(done.players.find((p) => p.id === "A").points, 150, "puntos del ganador");
  eq(done.players.find((p) => p.id === "B").points, 125, "puntos del segundo");
  ok(events.includes("lap") && events.includes("finish") && events.includes("result"), "eventos de vuelta y resultado");
  ok(events.includes("obstacle"), "los obstáculos generan colisión en carrera");
  ok(events.includes("kart-hit"), "los karts también colisionan entre sí");
  ok(Math.max(...heights) - Math.min(...heights) > 1, "el kart sigue el desnivel de la pista");
  const leader = done.players.find((p) => p.id === "A");
  ok(Number.isFinite(leader.bank) && Number.isFinite(leader.pitch), "el snapshot incluye peralte y pendiente");
  const stats = game.resultStats();
  eq(stats.participants.length, 2, "dos participantes");
  eq(stats.participants[0].earned, 150, "puntos ganados (no acumulados)");
  eq(stats.participants[1].earned, 125, "segundo también puntúa");
});

run("08 controlador: inactividad y reconexión reservan la plaza", () => {
  const { game, clock } = makeController();
  beginRace(game, clock, 200);
  clock.value += 3000;
  game.tick();
  const before = game.snapshot().players.find((p) => p.id === "A");
  eq(before.speed, 0, "sin intenciones el kart se detiene");
  eq(game.leave("A", { reason: "disconnect" }).offline, true, "desconexión en carrera");
  eq(game.canRejoin({ userId: null, name: "ALFA" }), true, "plaza reservada por nombre");
  eq(game.join({ id: "A2", name: "Alfa" }).rejoin, true, "rejoin recupera la plaza");
  eq(game.snapshot().players.some((p) => p.id === "A2"), true, "jugador reincorporado");
});

// -------------------------------------------------------------- persistencia
run("09 db: race_points y garaje por cuenta", () => {
  const userId = DB.createUser("karts-player", "hash", "#ffffff", null);
  DB.recordUserStats(userId, { racePoints: 200 });
  eq(DB.getUserStats(userId).race_points, 200, "puntos iniciales");
  eq(DB.unlockKart(userId, "cometa", true), true, "desbloquea la Cometa");
  eq(DB.getEquippedKart(userId), "cometa", "kart equipado");
  const owned = DB.getUserKarts(userId).map((kart) => kart.id);
  eq(owned.join(","), "cometa", "garaje persistido");
  DB.setEquippedKart(userId, "pingui_gt");
  eq(DB.getEquippedKart(userId), "pingui_gt", "cambio de equipo");
  DB.recordUserStats(userId, { racePoints: -180 });
  eq(DB.getUserStats(userId).race_points, 20, "los puntos se descuentan");
  eq(DB.getUserKarts(0).length, 0, "invitado sin filas");
});

// ------------------------------------------------------ servidor con stubs
let clock = 9_000_000;
Date.now = () => clock;
global.setTimeout = (fn, ms) => ({ fn, ms, cleared: false, interval: false });
global.clearTimeout = (h) => {
  if (h) h.cleared = true;
};
const timers = [];
global.setInterval = (fn, ms) => {
  const h = { fn, ms, cleared: false, interval: true };
  timers.push(h);
  return h;
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
const mk = (id, user = null) => {
  const s = {
    id,
    data: user ? { userId: user, username: "karts-account" } : {},
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
const roomEmit = (e, code, from = 0) => find(e, (x) => x.ch === "room:" + code, from);
const welcomePos = (id) => {
  const w = find("welcome", (x) => x.ch === "#" + id);
  if (!w || !Array.isArray(w.d.players)) return null;
  const p = w.d.players.find((p) => p.id === id);
  return p ? { x: p.x, z: p.z } : null;
};
const currentPos = (id) => {
  const moved = find("player:moved", (x) => x.d && x.d.id === id && String(x.ch).startsWith("room:"));
  return moved ? { x: moved.d.x, z: moved.d.z } : welcomePos(id) || HUB.HUB_SPAWN;
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
    const from = emitted.length;
    fire(sock, "player:move", {
      x: cur.x + (dx / dist) * step,
      z: cur.z + (dz / dist) * step,
    });
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

const fifty = timers.filter((h) => h.interval && h.ms === DEF.KARTS_TICK_MS);
const kartsTimer = fifty[fifty.length - 1];
ok(kartsTimer, "no se registró el tick de 20 Hz de Karts");
const tickKarts = () => kartsTimer.fn();

const PORTAL = HUB.HUB_PORTALS.find((p) => p.modeId === "karts");
const ROOM = MODE.modeRoomCode("karts");
const ACCOUNT = DB.createUser("karts-account", "hash", "#ffffff", null);
DB.recordUserStats(ACCOUNT, { racePoints: 500 });

function enterGame(id, name, user = null) {
  const sock = mk(id, user);
  io.connect(sock);
  fire(sock, "player:join", { name });
  fire(sock, "hub:enter");
  ok(moveTo(sock, id, PORTAL), `${name} llega al portal de Karts`);
  return sock;
}

let A, B;
run("10 servidor: sala MODO-KARTS oculta, sin combate y paddock", () => {
  A = enterGame("A", "Alfa", ACCOUNT);
  const from = emitted.length;
  fire(A, "mode:join", { modeId: "karts" });
  const state = find("room:state", (x) => x.ch === "#A", from);
  ok(state, "responde room:state");
  eq(state.d.room.kind, "mode", "zona de minijuego");
  eq(state.d.room.modeId, "karts", "modo Karts");
  eq(state.d.room.code, ROOM, "sala oculta");
  eq(state.d.room.combat, false, "sin combate");
  eq(state.d.room.mapId, "karts", "mapa del paddock");
  const mode = roomEmit("mode:state", ROOM, from);
  ok(mode, "difunde mode:state");
  eq(mode.d.phase, "waiting", "espera en el paddock");
  eq(mode.d.minPlayers, 2, "mínimo dos");
  eq(mode.d.maxPlayers, 8, "máximo ocho");
  const mine = mode.d.players.find((p) => p.id === "A");
  ok(mine, "el jugador aparece en el estado");
  ok(
    Math.hypot(mine.x - DEF.KARTS_PADDOCK_CENTER.x, mine.z - DEF.KARTS_PADDOCK_CENTER.z) < 10,
    "entra en el paddock, no en la pista"
  );
  const list = find("room:list", (x) => x.ch === "#A", from);
  if (list) eq(list.d.rooms.some((r) => r.code === ROOM), false, "sala oculta no se anuncia");
});

run("11 servidor: compra con cuenta persistida y pista en preparación", () => {
  const from = emitted.length;
  fire(A, "mode:action", { type: "buy", kartId: "cometa" });
  const profile = find("score:profile", (x) => x.ch === "A", from);
  ok(profile, "avisa del perfil actualizado");
  ok(profile.d.karts.includes("cometa"), "kart en el garaje del perfil");
  eq(profile.d.racePoints, 320, "500 - 180 puntos");
  eq(DB.getUserStats(ACCOUNT).race_points, 320, "puntos persistidos");
  eq(DB.getEquippedKart(ACCOUNT), null, "comprar no cambia el equipo por defecto");
  fire(A, "mode:action", { type: "equip", kartId: "cometa" });
  eq(DB.getEquippedKart(ACCOUNT), "cometa", "equipo persistido");
  const beforeError = emitted.length;
  fire(A, "mode:action", { type: "track", trackId: "dunas" });
  const error = find("mode:error", (x) => x.ch === "#A", beforeError);
  ok(error, "la pista en preparación devuelve error");
  ok(/preparación/i.test(error.d.error), "mensaje de preparación");
  fire(A, "mode:action", { type: "track", trackId: "paddock" });
});

run("12 servidor: movimiento bloqueado y conducción autoritativa", () => {
  B = enterGame("B", "Beta");
  const fromJoinB = emitted.length;
  fire(B, "mode:join", { modeId: "karts" });
  ok(find("mode:state", (x) => x.ch === "room:" + ROOM, fromJoinB), "Beta entra al paddock");
  const fromReady = emitted.length;
  fire(B, "mode:action", { type: "ready" });
  ok(find("mode:state", (x) => x.ch === "room:" + ROOM, fromReady), "estado tras Listo");
  clock += 50;
  tickKarts();
  eq(roomEmit("mode:state", ROOM, fromReady).d.phase, "countdown", "cuenta atrás");
  clock += DEF.KARTS_COUNTDOWN_MS + 10;
  tickKarts();
  const started = roomEmit("mode:state", ROOM, fromReady);
  eq(started.d.phase, "racing", "carrera iniciada");

  const fromMove = emitted.length;
  fire(A, "player:move", { x: 999, z: 999 });
  eq(
    emitted.slice(fromMove).some((x) => x.e === "player:moved" && x.d && x.d.id === "A"),
    false,
    "player:move no mueve al kart"
  );

  const posA = started.d.players.find((p) => p.id === "A");
  for (let i = 0; i < 60; i++) {
    fire(A, "mode:action", { type: "drive", throttle: 1, steer: 0 });
    fire(B, "mode:action", { type: "drive", throttle: 1, steer: 0 });
    clock += DEF.KARTS_TICK_MS;
    tickKarts();
  }
  const after = roomEmit("mode:state", ROOM, fromMove);
  const posAAfter = after.d.players.find((p) => p.id === "A");
  ok(posAAfter.distance > posA.distance + 5, "el kart avanza por la spline");
  ok(posAAfter.speed > 5, "velocidad autoritativa");
  ok(Number.isFinite(posAAfter.bank) && Number.isFinite(posAAfter.pitch), "relieve en el snapshot del servidor");
});

run("13 servidor: resultado, puntos y vueltas en la DB", () => {
  const from = emitted.length;
  let guard = 0;
  while (guard < 20000) {
    fire(A, "mode:action", { type: "drive", throttle: 1, steer: 0 });
    fire(B, "mode:action", { type: "drive", throttle: 1, steer: 0 });
    clock += DEF.KARTS_TICK_MS;
    tickKarts();
    guard++;
    const snap = roomEmit("mode:state", ROOM, from);
    if (snap && snap.d.phase === "finished") break;
  }
  ok(guard < 20000, "la carrera del servidor termina");
  const snap = roomEmit("mode:state", ROOM, from);
  eq(snap.d.phase, "finished", "fase de resultado");
  ok(snap.d.players.every((p) => p.laps === 3), "tres vueltas por jugador");
  // 320 tras la compra, más 150 del primer puesto.
  eq(DB.getUserStats(ACCOUNT).race_points, 470, "puntos de carrera persistidos");
  const guest = snap.d.players.find((p) => p.id === "B");
  eq(guest.points, 125, "el invitado conserva sus puntos en la sesión");
  const resultEvent = find("mode:event", (x) => x.e === "mode:event" && x.ch === "room:" + ROOM && x.d.type === "result", from);
  ok(resultEvent, "evento de resultado difundido");
});

const passed = results.filter((r) => r.ok).length;
console.log(`\nKarts: ${passed}/${results.length} pruebas correctas`);
if (passed !== results.length) process.exitCode = 1;
