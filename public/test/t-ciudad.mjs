// Suite de Ciudad social (Ola 6, alcance C1-C2).
//
// Cubre cuatro capas:
//  1. Contrato compartido: catálogo, 13 coleccionables, celdas de 20 m y radio
//     de interés de 40 m, con el mapa propio `ciudad-rol` y su portal en la isla.
//  2. Controlador autoritativo con reloj determinista: recogida, economía,
//     respawn, persistencia y rejoin.
//  3. Servidor real con Socket.IO simulado: sala MODO-CIUDAD oculta sin
//     combate, perfil propio en `me`, filtrado por distancia y escritura en DB.
//  4. Salida y reconexión al distrito.

import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

process.env.DB_PATH = path.join(os.tmpdir(), "pingui-ciudad-" + Date.now() + ".db");

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
const DEF = await import(url("public/js/cityDefs.js"));
const MODE = await import(url("public/js/modeDefs.js"));
const HUB = await import(url("public/js/hubDefs.js"));
const MAPS = await import(url("public/js/mapDefs.js"));
const OBS = await import(url("public/js/mapObstacles.js"));
const CTRL = await import(url("server/modes/ciudad.js"));
const DB = await import(url("server/db.js"));

run("01 defs: catálogo de 13 objetos y 13 coleccionables", () => {
  eq(DEF.CITY_ITEMS.length, 13, "trece objetos en la tienda");
  eq(DEF.CITY_COLLECTIBLES.length, 13, "trece puntos de recogida");
  eq(DEF.CITY_START_COINS, 60, "monedas iniciales");
  eq(DEF.CITY_RESPAWN_MS, 30000, "respawn de 30 s");
  eq(DEF.CITY_INTERACT_RANGE, 2.8, "radio de interacción");
  ok(DEF.CITY_ITEMS.every((item) => item.buy > item.sell && item.sell > 0), "margen de la tienda");
  const ids = DEF.CITY_COLLECTIBLES.map((spot) => spot.id);
  eq(new Set(ids).size, 13, "ids de coleccionables únicos");
  ok(DEF.CITY_COLLECTIBLES.every((spot) => DEF.cityItemById(spot.item)), "todo objeto recogible existe");
  ok(
    DEF.CITY_COLLECTIBLES.every((spot) => Math.abs(spot.x) <= 89 && Math.abs(spot.z) <= 89),
    "los puntos caben en el distrito"
  );
  eq(DEF.cityItemById("recuerdo").name, "Recuerdo de la plaza", "búsqueda por id");
  eq(DEF.cityItemById("nope"), null, "id inexistente");
  eq(DEF.cityCollectibleById("plaza").coins, 18, "coleccionable por id");
});

run("02 defs: celdas de 20 m, interés de 40 m y spawns repartidos", () => {
  eq(DEF.CITY_CELL_SIZE, 20, "celdas de 20 m");
  eq(DEF.CITY_INTEREST_RANGE, 40, "radio de interés de 40 m");
  eq(JSON.stringify(DEF.cityCellOf(0, 0)), JSON.stringify({ cx: 0, cz: 0 }), "celda central");
  eq(JSON.stringify(DEF.cityCellOf(-1, -20)), JSON.stringify({ cx: -1, cz: -1 }), "celda negativa");
  eq(DEF.cityCellsInRange(0, 0).length, 25, "5x5 celdas alcanzables");
  eq(DEF.cityWithinInterest({ x: 0, z: 0 }, { x: 39, z: 0 }), true, "39 m dentro");
  eq(DEF.cityWithinInterest({ x: 0, z: 0 }, { x: 41, z: 0 }), false, "41 m fuera");
  eq(DEF.cityClamp(200), 89, "borde del mapa");
  eq(DEF.cityClamp(-200), -89, "borde negativo");
  const near = DEF.cityNearestCollectible(0, -1.5);
  eq(near.id, "plaza", "objeto cercano a la fuente");
  eq(DEF.cityNearestCollectible(85, 85), null, "sin objeto en la esquina");
  const a = DEF.citySpawnFor(0, 50);
  const b = DEF.citySpawnFor(1, 50);
  ok(Math.hypot(a.x - b.x, a.z - b.z) > 2, "spawns distintos");
  ok(DEF.citySpawnFor(99, 50).x >= -89, "spawn con índice alto acotado");
});

run("03 defs: modo en vivo, mapa propio y portal en la isla", () => {
  const mode = MODE.getMode("ciudad");
  eq(mode.status, "live", "modo en vivo");
  eq(mode.mapId, "ciudad-rol", "mapa propio");
  eq(mode.camera, "first", "cámara en primera persona");
  eq(mode.allowThirdPerson, false, "sin tercera persona");
  eq(mode.allowCombat, false, "sin combate");
  eq(mode.maxPlayers, 50, "hasta 50 jugadores");
  eq(MODE.modeRoomCode("ciudad"), "MODO-CIUDAD", "sala reservada");
  ok(MAPS.MAPS.some((map) => map.id === "ciudad-rol"), "mapa registrado");
  ok(MAPS.MAPS.find((map) => map.id === "ciudad-rol").size >= 180, "distrito de 180 m");
  ok(OBS.MAP_OBSTACLES["ciudad-rol"] && OBS.MAP_OBSTACLES["ciudad-rol"].length >= 10, "obstáculos del distrito");
  ok(HUB.HUB_PORTALS.some((portal) => portal.modeId === "ciudad" && portal.status === "live"), "portal vivo");
});

// ------------------------------------------------ controlador determinista
let clock = 1_000_000;
const saved = { collectibles: [], profiles: [] };
const game = CTRL.createCityGame({
  now: () => clock,
  loadCollectibles: () => saved.collectibles,
  persistCollectible: (state) => saved.collectibles.push({ ...state }),
  walletOf: ({ userId }) => (userId ? { coins: 200, collected: 3 } : null),
  inventoryOf: () => [],
  persistProfile: (identity, data) => saved.profiles.push({ identity, data: { ...data, wallet: { ...data.wallet } } }),
});

run("04 controlador: entrada, spawn y snapshot sin fases", () => {
  eq(game.join({ id: "A", name: "Alfa" }).ok, true, "entrar al distrito");
  eq(game.status, "open", "mundo abierto");
  eq(game.phase, "living", "sin fases de partida");
  eq(game.canMove("A"), true, "puede moverse");
  eq(game.canMove("B"), false, "quien no entró no se mueve");
  const snap = game.snapshot();
  eq(snap.modeId, "ciudad", "id del modo");
  eq(snap.mapId, "ciudad-rol", "mapa del modo");
  eq(snap.cellSize, 20, "celdas en el snapshot");
  eq(snap.interestRange, 40, "interés en el snapshot");
  eq(snap.players.length, 1, "un jugador");
  eq(snap.collectibles.length, 13, "13 coleccionables");
  eq(snap.catalog.length, 13, "catálogo en el snapshot");
  const spawn = game.spawnFor("A");
  eq(spawn.x, 0, "spawn central x");
  eq(spawn.z, -8, "spawn central z");
  eq(game.resultStats(), null, "sin resultados de fin de partida");
});

run("05 controlador: recogida exige distancia y una sola vez", () => {
  const far = game.action("A", { type: "collect", id: "plaza" }, { x: 0, z: -8 });
  eq(far.ok, false, "no se recoge desde lejos");
  eq(far.reason, "not-near", "razón de distancia");
  const bad = game.action("A", { type: "collect", id: "nope" }, { x: 0, z: 0 });
  eq(bad.reason, "bad-item", "id desconocido");
  const got = game.action("A", { type: "collect", id: "plaza" }, { x: 0, z: 0 });
  eq(got.ok, true, "recoger en la fuente");
  const me = game.profileForId("A");
  eq(me.wallet.coins, 78, "60 iniciales + 18 de la fuente");
  eq(me.wallet.collected, 1, "contador de recogidas");
  eq(me.wallet.earned, 18, "monedas ganadas");
  eq(me.inventory[0].id, "recuerdo", "objeto en la mochila");
  const again = game.action("A", { type: "collect", id: "plaza" }, { x: 0, z: 0 });
  eq(again.reason, "already-collected", "no se recoge dos veces");
  const spot = game.snapshot().collectibles.find((entry) => entry.id === "plaza");
  eq(spot.available, false, "fuente agotada");
  eq(spot.availableAt, clock + 30000, "hora de respawn");
  eq(spot.secondsLeft, 30, "cuenta atrás");
});

run("06 controlador: economía de compra/venta y errores", () => {
  eq(game.action("A", { type: "buy", itemId: "manzana", qty: 2 }).ok, true, "comprar dos manzanas");
  let me = game.profileForId("A");
  eq(me.wallet.coins, 62, "78 - 16");
  eq(me.inventory.find((item) => item.id === "manzana").qty, 2, "dos manzanas");
  eq(game.action("A", { type: "sell", itemId: "manzana", qty: 1 }).ok, true, "vender una");
  me = game.profileForId("A");
  eq(me.wallet.coins, 65, "62 + 3");
  eq(me.inventory.find((item) => item.id === "manzana").qty, 1, "queda una");
  eq(game.action("A", { type: "sell", itemId: "brujula" }).reason, "no-item", "sin objeto para vender");
  eq(game.action("A", { type: "buy", itemId: "nope" }).reason, "bad-item", "compra inválida");
  eq(game.action("A", { type: "buy", itemId: "brujula", qty: 2 }).reason, "not-enough-coins", "faltan monedas");
  eq(game.action("A", { type: "buy", itemId: "brujula" }).ok, true, "comprar brújula");
  eq(game.profileForId("A").wallet.coins, 25, "65 - 40");
  eq(game.action("A", { type: "buy", itemId: "brujula" }).reason, "not-enough-coins", "ya no alcanza");
  eq(game.action("A", { type: "dance" }).reason, "unknown-action", "acción desconocida");
});

run("07 controlador: respawn por tick y persistencia", () => {
  clock += 10_000;
  game.tick();
  eq(game.snapshot().collectibles.find((s) => s.id === "plaza").available, false, "sigue recogido");
  clock += 20_000;
  game.tick();
  const spot = game.snapshot().collectibles.find((s) => s.id === "plaza");
  eq(spot.available, true, "vuelve a estar disponible");
  eq(spot.secondsLeft, 0, "sin cuenta atrás");
  ok(saved.collectibles.some((s) => s.id === "plaza" && s.availableAt === 0), "respawn persistido");
  ok(saved.profiles.length >= 4, "perfil escrito tras cada acción");
  const last = saved.profiles[saved.profiles.length - 1];
  eq(last.data.wallet.coins, 25, "cartera persistida");
  eq(last.data.inventory.length, 3, "mochila persistida");
});

run("08 controlador: el perfil sobrevive a salir y permite rejoin", () => {
  eq(game.canRejoin({ name: "Alfa" }), true, "el nombre sigue ocupado en la sala");
  game.leave("A");
  eq(game.canRejoin({ name: "Alfa" }), true, "perfil de invitado guardado");
  eq(game.canRejoin({ name: "Otro" }), false, "otro nombre no hace rejoin");
  eq(game.join({ id: "A2", name: "Alfa" }).ok, true, "reentrar con otro socket");
  const me = game.profileForId("A2");
  eq(me.wallet.coins, 25, "recupera la cartera");
  eq(me.inventory.length, 3, "recupera la mochila");
  const withUser = CTRL.createCityGame({
    now: () => clock,
    walletOf: ({ userId }) => (userId ? { coins: 200 } : null),
  });
  withUser.join({ id: "U", name: "Usuario", userId: 42 });
  eq(withUser.profileForId("U").wallet.coins, 200, "cartera de cuenta desde DB");
});

run("09 controlador: aforo máximo configurable", () => {
  const small = CTRL.createCityGame({ now: () => clock, maxPlayers: 1 });
  eq(small.join({ id: "X", name: "X" }).ok, true, "primer jugador");
  eq(small.join({ id: "Y", name: "Y" }).ok, false, "segundo rechazado");
  eq(small.join({ id: "Y", name: "Y" }).reason, "full", "razón de aforo");
});

// ------------------------------------------------------ servidor con stubs
clock = 9_000_000;
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
    data: user ? { userId: user, username: "ciudad-account" } : {},
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
// `socket.emit` captura como "#A"; `io.to(member.id)` (usado por el filtrado de
// Ciudad) captura como "A". Ambas son emisiones dirigidas a ese jugador.
const direct = (e, id, pred, from = 0) =>
  find(e, (x) => (x.ch === "#" + id || x.ch === id) && (!pred || pred(x)), from);
const welcomePos = (id) => {
  const w = direct("welcome", id);
  const p = w && Array.isArray(w.d.players) ? w.d.players.find((row) => row.id === id) : null;
  return p ? { x: p.x, z: p.z } : null;
};
const lastDirectMove = (id, from = 0) => {
  const m = direct("player:moved", id, null, from);
  return m ? { x: m.d.x, z: m.d.z } : welcomePos(id) || HUB.HUB_SPAWN;
};
function moveTo(sock, id, target) {
  let cur = welcomePos(id) || HUB.HUB_SPAWN;
  for (let i = 0; i < 600; i++) {
    clock += 200;
    const dx = target.x - cur.x;
    const dz = target.z - cur.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return true;
    const step = Math.min(2, dist);
    const from = emitted.length;
    fire(sock, "player:move", { x: cur.x + (dx / dist) * step, z: cur.z + (dz / dist) * step });
    const mv = direct("player:moved", id, null, from);
    if (!mv) {
      // En la isla el movimiento va por el canal de sala y el arnés captura
      // todas las emisiones, incluida la del propio socket.
      const roomMv = find(
        "player:moved",
        (x) => String(x.ch).startsWith("room:") && x.d && x.d.id === id,
        from
      );
      if (!roomMv) return false;
      cur = { x: roomMv.d.x, z: roomMv.d.z };
    } else {
      cur = { x: mv.d.x, z: mv.d.z };
    }
  }
  return false;
}

// En Ciudad `player:moved` solo se envía a los vecinos (nunca al que se mueve),
// así que el arnés sigue la posición localmente y la contrasta con el `mode:state`
// autoritativo que el controlador emite al ejecutar un emote.
const clamp89 = (v) => Math.max(-89, Math.min(89, v));
function cityPos(id) {
  const state = direct("mode:state", id);
  const row = state && state.d.players && state.d.players.find((p) => p.id === id);
  return row ? { x: row.x, z: row.z } : null;
}
function moveCity(sock, id, from, target) {
  let cur = { ...from };
  for (let i = 0; i < 600; i++) {
    clock += 200;
    const dx = target.x - cur.x;
    const dz = target.z - cur.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) break;
    const step = Math.min(2, dist);
    cur = {
      x: clamp89(cur.x + (dx / dist) * step),
      z: clamp89(cur.z + (dz / dist) * step),
    };
    fire(sock, "player:move", cur);
  }
  // Fuerza un state nuevo para leer la posición autoritativa desde el servidor.
  clock += 200;
  fire(sock, "mode:action", { type: "emote", emote: "caminando" });
  const real = cityPos(id);
  ok(
    real && Math.hypot(real.x - target.x, real.z - target.z) < 1,
    `${id} llega a su destino (real=${JSON.stringify(real)} target=${JSON.stringify(target)})`
  );
  return real || cur;
}

const { setupGame } = await import(url("server/game.js"));
setupGame(io);

const modeTimer = timers.filter((h) => h.interval && h.ms === 200).pop();
ok(modeTimer, "no se registró el tick genérico de modos (5 Hz)");
const tickMode = () => modeTimer.fn();

const PORTAL = HUB.HUB_PORTALS.find((p) => p.modeId === "ciudad");
const ROOM = MODE.modeRoomCode("ciudad");
const ACCOUNT = DB.createUser("ciudad-account", "hash", "#ffffff", null);

function enterGame(id, name, user = null) {
  const sock = mk(id, user);
  io.connect(sock);
  fire(sock, "player:join", { name });
  fire(sock, "hub:enter");
  ok(moveTo(sock, id, PORTAL), `${name} llega al portal de Ciudad`);
  return sock;
}

let A, B;
let A_POS = { x: 0, z: -8 };
run("10 servidor: sala MODO-CIUDAD oculta, sin combate y mapa propio", () => {
  A = enterGame("A", "Alfa");
  const from = emitted.length;
  fire(A, "mode:join", { modeId: "ciudad" });
  const state = direct("room:state", "A", null, from);
  ok(state, "responde room:state");
  eq(state.d.room.kind, "mode", "sala de modalidad");
  eq(state.d.room.code, ROOM, "código reservado");
  eq(state.d.room.modeId, "ciudad", "id del modo");
  eq(state.d.room.mapId, "ciudad-rol", "mapa propio, no el PVP");
  eq(state.d.room.combat, false, "sin combate");
  eq(state.d.room.maxPlayers, 50, "aforo de 50");
  const listing = find("room:list", (x) => x.ch === "*");
  ok(listing && !listing.d.rooms.some((r) => r.code === ROOM), "sala oculta fuera de room:list");
  const welcome = direct("welcome", "A", null, from);
  ok(welcome, "recibe welcome");
  eq(welcome.d.players.length, 1, "se ve a sí mismo en el welcome");
  eq(welcome.d.players[0].x, 0, "spawn autoritativo x");
  eq(welcome.d.players[0].z, -8, "spawn autoritativo z");
  const states = emitted.filter(
    (x) => x.e === "mode:state" && (x.ch === "#A" || x.ch === "A") && x.d.modeId === "ciudad"
  );
  eq(states.length, 1, "un solo state filtrado al entrar, sin duplicado global");
  eq(states[0].d.me.wallet.coins, 60, "el state trae la cartera propia");
  eq(states[0].d.me.inventory.length, 0, "mochila propia vacía");
  eq(states[0].d.players.length, 1, "jugadores filtrados en el state");
});

run("11 servidor: recoger con E es autoritativo y persiste", () => {
  A_POS = moveCity(A, "A", A_POS, { x: 0, z: 0 });
  const from = emitted.length;
  fire(A, "mode:action", { type: "collect", id: "plaza", x: 80, z: 80 });
  const state = direct("mode:state", "A", null, from);
  ok(state, "el controlador vuelve a difundir estado");
  eq(state.d.me.wallet.coins, 78, "cartera actualizada en el state propio");
  eq(state.d.me.wallet.collected, 1, "contador actualizado");
  eq(state.d.me.inventory[0].id, "recuerdo", "objeto añadido");
  const event = find("mode:event", (x) => x.d && x.d.type === "collect", from);
  ok(event, "evento de recogida difundido");
  eq(event.d.playerId, "A", "autor de la recogida");
  eq(event.d.coins, 18, "monedas del evento");
  eq(DB.getCityWallet(null) && DB.getCityWallet(null).coins, 60, "invitado no escribe en la DB");
  const savedSpot = DB.getCityCollectibles().find((s) => s.id === "plaza");
  ok(savedSpot && savedSpot.availableAt > clock, "respawn de la fuente persistido");
  const dup = emitted.length;
  fire(A, "mode:action", { type: "collect", id: "plaza" });
  ok(direct("mode:error", "A", null, dup), "el servidor avisa si se recoge dos veces");
});

run("12 servidor: compra y venta con cartera de cuenta", () => {
  const C = enterGame("C", "Carla", ACCOUNT);
  const from = emitted.length;
  fire(C, "mode:join", { modeId: "ciudad" });
  let state = direct("mode:state", "C", null, from);
  eq(state.d.me.wallet.coins, 60, "cartera inicial de la cuenta");
  clock += 300;
  fire(C, "mode:action", { type: "buy", itemId: "pan", qty: 2 });
  state = direct("mode:state", "C", null, from);
  eq(state.d.me.wallet.coins, 40, "60 - 20");
  eq(DB.getCityWallet(ACCOUNT).coins, 40, "compra escrita en city_wallets");
  eq(DB.getCityInventory(ACCOUNT)[0].qty, 2, "compra escrita en city_inventory");
  clock += 300;
  fire(C, "mode:action", { type: "sell", itemId: "pan", qty: 1 });
  state = direct("mode:state", "C", null, from);
  eq(state.d.me.wallet.coins, 44, "40 + 4");
  eq(DB.getCityInventory(ACCOUNT)[0].qty, 1, "queda un pan en la DB");
});

run("13 servidor: interest management a 40 m en moved y state", () => {
  B = enterGame("B", "Beto");
  fire(B, "mode:join", { modeId: "ciudad" });
  const nearState = direct("mode:state", "A");
  ok(nearState.d.players.some((p) => p.id === "B"), "Beto se ve al entrar");
  const from = emitted.length;
  const B_POS = moveCity(B, "B", cityPos("B") || { x: 0, z: -8 }, { x: -80, z: -80 });
  ok(Math.hypot(B_POS.x - A_POS.x, B_POS.z - A_POS.z) > 40, "Beto queda fuera del radio de Alfa");
  const movesToA = emitted.filter(
    (x) =>
      x.e === "player:moved" &&
      (x.ch === "#A" || x.ch === "A") &&
      x.d &&
      x.d.id === "B"
  );
  ok(movesToA.length > 0, "el movimiento cercano sí se difunde");
  ok(
    movesToA.every(
      (x) => Math.hypot(x.d.x - A_POS.x, x.d.z - A_POS.z) <= 40
    ),
    "ningún movimiento por encima de los 40 m llega a Alfa"
  );
  ok(
    find("player:left", (x) => (x.ch === "#A" || x.ch === "A") && x.d.id === "B", from),
    "Alfa recibe la baja de Beto al cruzar el radio"
  );
  ok(
    find("player:left", (x) => (x.ch === "#B" || x.ch === "B") && x.d.id === "A", from),
    "Beto deja de ver a Alfa al cruzar el radio"
  );
  // Una acción de Alfa fuerza un state nuevo: Beto ya no debe aparecer.
  clock += 300;
  fire(A, "mode:action", { type: "emote", emote: "hola" });
  const farState = direct("mode:state", "A", null, from);
  ok(farState.d.players.length < nearState.d.players.length, "el state filtra al que está lejos");
  ok(!farState.d.players.some((p) => p.id === "B"), "Beto desaparece del state de Alfa");
  ok(farState.d.players.some((p) => p.id === "A"), "Alfa sigue en su propio state");
  const ownState = direct("mode:state", "B", null, from);
  ok(ownState.d.players.some((p) => p.id === "B"), "Beto sí se ve a sí mismo");

  // Volver al radio debe recrear los avatares sin esperar a otra acción.
  const backFrom = emitted.length;
  moveCity(B, "B", cityPos("B") || B_POS, { x: 0, z: -8 });
  ok(
    find("player:joined", (x) => (x.ch === "#A" || x.ch === "A") && x.d.id === "B", backFrom),
    "Alfa vuelve a ver a Beto al reentrar al radio"
  );
  ok(
    find("player:joined", (x) => (x.ch === "#B" || x.ch === "B") && x.d.id === "A", backFrom),
    "Beto vuelve a ver a Alfa al reentrar al radio"
  );
  // Se deja a Beto lejos otra vez para que la prueba 14 siga siendo válida.
  moveCity(B, "B", cityPos("B") || { x: 0, z: -8 }, { x: -80, z: -80 });
});

run("14 servidor: salida filtrada, tick de respawn y rejoin", () => {
  // Alfa y Beto están lejos: la salida de Beto no debe llegar a Alfa.
  const from = emitted.length;
  fire(B, "disconnect");
  eq(
    find("player:left", (x) => x.ch === "#A" || x.ch === "A", from),
    null,
    "salida lejana no difundida"
  );
  // El tick genérico debe devolver la fuente cuando venza su plazo.
  const plaza = DB.getCityCollectibles().find((s) => s.id === "plaza");
  if (plaza.availableAt > clock) {
    tickMode();
    eq(
      direct("mode:state", "A", null, from).d.collectibles.find((s) => s.id === "plaza").available,
      false,
      "sigue recogida antes del respawn"
    );
  }
  clock = plaza.availableAt + 1;
  tickMode();
  const respawned = direct("mode:state", "A", null, from);
  eq(respawned.d.collectibles.find((s) => s.id === "plaza").available, true, "tick devuelve la fuente");
  ok(find("mode:event", (x) => x.d && x.d.type === "respawn", from), "evento de respawn difundido");
  // Beto se reconecta con el mismo nombre de invitado.
  const B2 = mk("B2", null);
  io.connect(B2);
  const joinFrom = emitted.length;
  fire(B2, "player:join", { name: "Beto" });
  const rejoin = direct("mode:rejoin", "B2", null, joinFrom);
  ok(rejoin, "el servidor ofrece rejoin al distrito");
  eq(rejoin.d.modeId, "ciudad", "rejoin de Ciudad");
  fire(B2, "mode:join", { modeId: "ciudad", rejoin: true });
  ok(direct("mode:state", "B2", null, joinFrom), "rejoin recibe el estado del distrito");
  const restored = direct("mode:state", "B2", null, joinFrom);
  ok(restored.d.players.some((p) => p.id === "B2"), "el jugador restaurado aparece en su estado");
});

const passed = results.filter((r) => r.ok).length;
console.log(`\nCiudad: ${passed}/${results.length} pruebas correctas`);
if (passed !== results.length) process.exitCode = 1;
