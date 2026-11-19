import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

process.env.DB_PATH = path.join(os.tmpdir(), "pingui-test-" + Date.now() + ".db");

// Raíz del proyecto calculada desde la ubicación de este archivo.
const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const url = (rel) => pathToFileURL(path.join(PROJ, rel)).href;

const results = [];
function t(name, ok, extra = "") {
  results.push({ name, ok, extra });
  if (!ok) console.log("FAIL: " + name + (extra ? " | " + extra : ""));
  else console.log("ok  : " + name);
}
const eq = (a, b, msg) => {
  if (a !== b) throw new Error(`${msg}: espere ${JSON.stringify(b)} pero hay ${JSON.stringify(a)}`);
};

let clock = 1_000_000;
Date.now = () => clock;

// Los cristales y los códigos de sala salen de Math.random. Sin semilla fija,
// el disparo previo a la cura de la prueba 18 podía matar al objetivo y la
// suite fallaba de forma intermitente. El patrón es el mismo de t-coliseo.
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
Math.random = mulberry32(20261119);

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
const fire = (s, e, d) => {
  if (s._h[e]) return s._h[e](d);
  return undefined;
};

const find = (e, pred, from = 0) => {
  for (let i = emitted.length - 1; i >= from; i--) {
    const x = emitted[i];
    if (x.e === e && (!pred || pred(x))) return x;
  }
  return null;
};
const lastMoved = (id) =>
  find("player:moved", (x) => x.d && x.d.id === id && x.ch && x.ch.indexOf("room:") === 0);
const welcomePos = (id) => {
  const w = find("welcome", (x) => x.ch === "#" + id);
  if (!w || !Array.isArray(w.d.players)) return null;
  const p = w.d.players.find((p) => p.id === id);
  return p ? { x: p.x, z: p.z } : null;
};

function moveTo(sock, id, tx, tz, mirror) {
  let cur = mirror;
  let first = true;
  for (let i = 0; i < 400; i++) {
    clock += 200;
    if (!first) {
      const lm = lastMoved(id);
      if (lm) cur = { x: lm.d.x, z: lm.d.z };
    }
    const dx = tx - cur.x;
    const dz = tz - cur.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return true;
    const step = Math.min(2.0, dist);
    const nx = cur.x + (dx / dist) * step;
    const nz = cur.z + (dz / dist) * step;
    const before = emitted.length;
    fire(sock, "player:move", { x: nx, z: nz });
    const mv = find("player:moved", (x) => x.d && x.d.id === id && x.ch && x.ch.indexOf("room:") === 0, before);
    if (!mv) {
      console.log(`[moveTo] ${id} rechazado en paso ${i} (${cur.x.toFixed(2)},${cur.z.toFixed(2)})->(${nx.toFixed(2)},${nz.toFixed(2)}) clock=${clock}`);
      return false;
    }
    first = false;
  }
  return true;
}

function run(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    if (/^SKIP:/i.test(e.message)) {
      results.push({ name, ok: true, extra: e.message });
      console.log("ok  : " + name + " (" + e.message + ")");
      return;
    }
    results.push({ name, ok: false, extra: e.message });
    console.log("FAIL: " + name + " | " + e.message);
  }
}

const { setupGame } = await import(url("server/game.js"));
// db.js se importa después de fijar DB_PATH para que use la BD temporal.
const { createUser, recordUserStats, getUserStats, getTopStats } = await import(url("server/db.js"));
const WPN = await import(url("public/js/weaponDefs.js"));
const WM = await import(url("public/js/weaponMath.js"));
const MOB = await import(url("public/js/mapObstacles.js"));
const getWeapon = WPN.getWeapon;
setupGame(io);

let code = null;
let A, B, Am, Bm;

run("01 dos joins en lobby", () => {
  A = mk("A");
  B = mk("B");
  io.connect(A);
  io.connect(B);
  fire(A, "player:join", { name: "Alfa" });
  fire(B, "player:join", { name: "Beta" });
  eq(!!find("welcome", (x) => x.ch === "#A"), true, "A sin welcome");
  eq(!!find("welcome", (x) => x.ch === "#B"), true, "B sin welcome");
  eq(
    emitted.filter((x) => x.e === "player:joined" && x.ch === "lobby").length,
    2,
    "player:joined de lobby (A+B)"
  );
});

run("02 chat de lobby con color", () => {
  fire(B, "chat:message", { text: "hola" });
  const m = find("chat:message", (x) => x.ch === "lobby");
  eq(typeof m.d.color, "string", "chat:message sin color");
});

run("03 crear sala (cordillera) con ownerId y crystal:state", () => {
  fire(B, "room:create", { name: "Equipo", mapId: "cordillera" });
  const rs = find("room:state", (x) => x.ch === "#B");
  eq(rs.d.hosting, true, "B no es host");
  code = rs.d.room.code;
  eq(typeof code === "string" && code.length === 4, true, "code no válido");
  const rl = find("room:list");
  const mine = rl.d.rooms.find((r) => r.code === code);
  eq(mine.ownerId, B.id, "room:list sin ownerId");
  eq(mine.mapId, "cordillera", "mapa no respetado");
  const cs = find("crystal:state", (x) => x.ch === "#B");
  eq(cs.d.crystals.length > 0, true, "sala sin cristales");
  eq(cs.d.crystals[0].type !== undefined, true, "cristal sin type");
});

run("04 A se une a la sala de B", () => {
  fire(A, "room:join", { code });
  const rs = find("room:state", (x) => x.ch === "#A");
  eq(rs.d.hosting, false, "A apareció como host");
  eq(rs.d.room && rs.d.room.code, code, "A no entró a la sala");
  Am = welcomePos("A");
  Bm = welcomePos("B");
  eq(!!Am && !!Bm, true, "sin posición de mapa");
});

run("05 mover aceptado en sala", () => {
  const before = emitted.length;
  fire(A, "player:move", { x: Am.x + 2, z: Am.z });
  const mv = find("player:moved", (x) => x.d && x.d.id === "A", before);
  eq(!!mv, true, "no se emitió player:moved");
  eq(Math.hypot(mv.d.x - (Am.x + 2), mv.d.z - Am.z) < 1e-6, true, "pos no aplicada");
});

run("06 anti-teletransporte rechaza salto > 2.5", () => {
  clock += 5000;
  const cur = lastMoved("A") || { d: { x: Am.x + 2, z: Am.z } };
  const before = emitted.length;
  fire(A, "player:move", { x: cur.d.x + 40, z: cur.d.z + 40 });
  const mv = find("player:moved", (x) => x.d && x.d.id === "A", before);
  eq(!!mv, false, "el salto llegó al mapa");
});

run("07 NaN es ignorado sin romper el juego", () => {
  const before = emitted.length;
  fire(A, "player:move", { x: NaN, z: 999 });
  const mv = find("player:moved", (x) => x.d && x.d.id === "A", before);
  eq(!!mv, false, "NaN no debería moverse");
  fire(A, "player:move", { x: lastMoved("A").d.x + 1, z: lastMoved("A").d.z });
  eq(!!find("player:moved", (x) => x.d && x.d.id === "A", before), true, "el server quedó roto tras NaN");
});

run("07b y/sprint/slide se acotan y retransmiten", () => {
  clock += 5000;
  const cur = lastMoved("A").d;
  const before = emitted.length;
  fire(A, "player:move", { x: cur.x + 0.5, z: cur.z, y: 9, sprint: true, slide: true });
  const mv = find("player:moved", (x) => x.d && x.d.id === "A", before);
  eq(!!mv, true, "no se emitió player:moved con y/sprint/slide");
  eq(mv.d.y, 3, "la altura debe acotarse a 3 m");
  eq(mv.d.sprint, true, "sprint no se retransmitió");
  eq(mv.d.slide, true, "slide no se retransmitió");

  clock += 5000;
  const before2 = emitted.length;
  fire(A, "player:move", { x: cur.x + 1, z: cur.z, y: -5 });
  const mv2 = find("player:moved", (x) => x.d && x.d.id === "A", before2);
  eq(!!mv2, true, "no se emitió el segundo player:moved");
  eq(mv2.d.y, 0, "la altura negativa debe quedar en 0");
  eq(mv2.d.sprint, false, "sprint ausente debe ser false");
  eq(mv2.d.slide, false, "slide ausente debe ser false");
});

run("07c presupuesto de velocidad recorta el exceso", () => {
  // Presupuesto lleno y primer paso de 2 m (dentro del tope duro de 2,5 m).
  clock += 5000;
  const start = lastMoved("A").d;
  let before = emitted.length;
  fire(A, "player:move", { x: start.x + 2, z: start.z });
  const first = find("player:moved", (x) => x.d && x.d.id === "A", before);
  eq(!!first, true, "el primer paso de 2 m debería aceptarse");
  eq(Math.abs(first.d.x - (start.x + 2)) < 1e-6, true, "el primer paso no se aplicó completo");

  // Sin tiempo para reponer (50 ms), otros 2 m implican 40 m/s: se recortan.
  clock += 50;
  before = emitted.length;
  fire(A, "player:move", { x: start.x + 4, z: start.z });
  const second = find("player:moved", (x) => x.d && x.d.id === "A", before);
  eq(!!second, true, "el paquete recortado no debería descartarse");
  const advanced = second.d.x - first.d.x;
  eq(advanced > 0.5 && advanced < 1.5, true, `recorte inesperado: ${advanced.toFixed(2)} m`);
});

const roomCrystals = [];
run("08 obtener cristal de arma vía oferta/aceptar", () => {
  const cs = find("crystal:state", (x) => x.ch === "#B");
  roomCrystals.push(...cs.d.crystals);
  const wc = roomCrystals.find((c) => c.type === "weapon");
  if (!wc) throw new Error("no hay cristal de arma en cordillera");
  Am = { x: lastMoved("A").d.x, z: lastMoved("A").d.z };
  eq(moveTo(A, "A", wc.x, wc.z, Am), true, "A no pudo acercarse al cristal");
  const before = emitted.length;
  fire(A, "crystal:offer", { crystalId: wc.id });
  const offer = find("crystal:offer", (x) => x.ch === "#A", before);
  eq(!!offer, true, "no llegó crystal:offer");
  eq(!!offer.d.weaponId, true, "offer sin weaponId");
  fire(A, "crystal:respond", { crystalId: wc.id, accept: true });
  const equip = find("crystal:equip", (x) => x.d.playerId === "A", before);
  eq(equip.d.weaponId, offer.d.weaponId, "weaponId no asignado");
  A.weapon = offer.d.weaponId;
});

run("09 cristal tomado / inexistente no genera oferta", () => {
  const consumed = A.weapon;
  const before = emitted.length;
  fire(A, "crystal:offer", { crystalId: "inventado" });
  eq(!!find("crystal:offer", (x) => x.ch === "#A", before), false, "cristal fantasma dio oferta");
  const wc = roomCrystals.find((c) => c.type === "weapon");
  fire(B, "crystal:offer", { crystalId: wc.id });
  eq(!!find("crystal:offer", (x) => x.ch === "#B", before), false, "B obtuvo oferta de cristal ya tomado");
});

run("10 disparo acierta (1..pellets) con dx/dz; la cadencia bloquea el segundo", () => {
  const a = { x: lastMoved("A").d.x, z: lastMoved("A").d.z };
  Bm = welcomePos("B") || { x: a.x + 9, z: a.z };
  eq(moveTo(B, "B", a.x + 1.2, a.z, Bm), true, "B no pudo colocarse");
  clock += 100;
  const pellets = getWeapon(A.weapon).pellets || 1;
  const before = emitted.length;
  fire(A, "combat:shoot", { dx: 1, dz: 0 });
  const hits = emitted.slice(before).filter(
    (x) => x.e === "combat:shot" && x.d.shooterId === "A" && x.d.hit === true
  );
  eq(hits.length >= 1 && hits.length <= pellets, true, `hits=${hits.length} fuera de 1..${pellets}`);
  const bad = hits.filter(
    (x) => !Number.isFinite(x.d.dx) || !Number.isFinite(x.d.dz) || (x.d.dx === 0 && x.d.dz === 0) || !x.d.targetId
  );
  eq(bad.length, 0, `shots inválidos: ${bad.length}`);

  const before2 = emitted.length;
  fire(A, "combat:shoot", { dx: 1, dz: 0 });
  const more = emitted.slice(before2).filter((x) => x.e === "combat:shot" && x.d.shooterId === "A");
  eq(more.length, 0, "la cadencia no frenó el segundo disparo");
});

run("11 tras cooldown el arma vuelve a disparar", () => {
  clock += 1600;
  const before = emitted.length;
  fire(A, "combat:shoot", { dx: 1, dz: 0 });
  const more = emitted.slice(before).filter(
    (x) => x.e === "combat:shot" && x.d.shooterId === "A" && x.d.hit === true
  );
  eq(more.length > 0, true, "el arma no disparó tras el cooldown");
});

const elimTarget = {
  dead: false,
};
run("12 matar a víctima C reiterando tiros (cadencia con reloj)", () => {
  const C = mk("C");
  io.connect(C);
  fire(C, "player:join", { name: "Ce" });
  fire(C, "room:join", { code });
  const a = { x: lastMoved("A").d.x, z: lastMoved("A").d.z };
  const cpos = welcomePos("C");
  eq(cpos !== null, true, "C sin posición");
  eq(moveTo(C, "C", a.x + 1.2, a.z, cpos), true, "C no se colocó");
  for (let i = 0; i < 30 && !elimTarget.dead; i++) {
    clock += 1700;
    const before = emitted.length;
    fire(A, "combat:shoot", { dx: 1, dz: 0 });
    const any = emitted.slice(before).filter((x) => x.e === "combat:shot" && x.d.shooterId === "A");
    elimTarget.shot += any.length;
    const el = find("combat:eliminated", (x) => x.d.targetId === "C", before);
    if (el) elimTarget.dead = true;
  }
  eq(elimTarget.dead, true, "C nunca fue eliminado");
  global.C = C;
});

run("13 invariante de combat:shot en toda la suite (dx/dz numéricos)", () => {
  const shots = emitted.filter((x) => x.e === "combat:shot" && x.d.hit === true);
  const bad = shots.filter((x) => !Number.isFinite(x.d.dx) || !Number.isFinite(x.d.dz) || (x.d.dx === 0 && x.d.dz === 0));
  eq(bad.length, 0, `shots inválidos: ${bad.length}`);
});

run("14 muerto no puede moverse", () => {
  clock += 200;
  const before = emitted.length;
  fire(C, "player:move", { x: 10, z: 10 });
  const mv = find("player:moved", (x) => x.d && x.d.id === "C", before);
  eq(!!mv, false, "muerto se pudo mover");
});

run("15 salir de sala revive a C y limpia los cristales del lobby", () => {
  const before = emitted.length;
  fire(C, "room:leave");
  const rev = find("combat:revived", (x) => x.d.targetId === "C", before);
  eq(rev !== null, true, "no se revivió al salir de zona");
  eq(rev.ch === "lobby", true, "revivido a un canal incorrecto");
  const cs = find("crystal:state", (x) => x.ch === "#C", before);
  eq(!!cs, true, "no se envió crystal:state al volver al lobby");
  eq(cs.d.crystals.length, 0, "el lobby no debe tener cristales");
});

let throwableSlot = -1;
run("16 agarrar lanzable apuntando a bola_nieve", () => {
  let got = false;
  for (let i = 0; i < 3; i++) {
    const cs = find("crystal:state", (x) => x.ch && x.ch.indexOf("room:") === 0);
    if (!cs) break;
    const tc = cs.d.crystals.find((c) => c.type === "throwable");
    if (!tc) break;
    const before = emitted.length;
    Am = { x: lastMoved("A").d.x, z: lastMoved("A").d.z };
    if (!moveTo(A, "A", tc.x, tc.z, Am)) break;
    fire(A, "crystal:offer", { crystalId: tc.id });
    const upd = find("inventory:update", (x) => x.ch === "#A", before);
    if (!upd) break;
    const bi = upd.d.inventory.findIndex((it) => it.type === "throwable" && it.id === "bola_nieve");
    if (bi >= 0) {
      throwableSlot = bi;
      A.throwable = "bola_nieve";
      got = true;
      break;
    }
  }
  if (!got) A.throwable = "granada";
  results.push({ name: "(info) lanzable final: " + A.throwable, ok: true });
});

run("17 bola de nieve aplica combate:slow con duración (no epoch)", () => {
  if (A.throwable !== "bola_nieve") throw new Error("SKIP: el lanzable no fue bola_nieve, no se prueba slow");
  fire(C, "room:join", { code });
  const cpos = welcomePos("C");
  eq(cpos !== null, true, "C sin posición al reentrar");
  const a = { x: lastMoved("A").d.x, z: lastMoved("A").d.z };
  eq(moveTo(C, "C", a.x + 1.2, a.z, cpos), true, "C no se colocó para la nieve");
  clock += 100;
  const invNow = find("inventory:update", (x) => x.ch === "#A");
  const itemNow = invNow.d.inventory.find((it) => it.type === "throwable" && it.id === A.throwable);
  eq(!!itemNow, true, "A perdió el lanzable antes de probar el slow");
  const slotNow = invNow.d.inventory.indexOf(itemNow);
  const before = emitted.length;
  fire(A, "inventory:throw", {
    slot: slotNow,
    id: itemNow.id,
    type: itemNow.type,
    dx: 1,
    dz: 0,
  });
  const slow = find("combat:slow", (x) => x.d.targetId === "C", before);
  eq(slow !== null, true, "no hubo combat:slow");
  eq(typeof slow.d.until === "number" && slow.d.until > 0 && slow.d.until <= 60000, true, "until fuera de rango de duración");
});

run("18 inventario: comida en lobby y sala, avisos y validación", () => {
  if (!C) throw new Error("SKIP: sin víctima C dispuesta");
  fire(C, "room:leave");
  fire(C, "room:join", { code });
  const cpos = welcomePos("C");
  eq(cpos !== null, true, "C sin posición al reentrar");
  const csNow = find("crystal:state", (x) => x.ch && x.ch.indexOf("room:") === 0);
  const wc = csNow.d.crystals.find((c) => c.type === "weapon");
  eq(moveTo(C, "C", wc.x, wc.z, cpos), true, "C no llegó a arma");
  const beforeArm = emitted.length;
  fire(C, "crystal:offer", { crystalId: wc.id });
  fire(C, "crystal:respond", { crystalId: wc.id, accept: true });
  eq(!!find("crystal:equip", (x) => x.d.playerId === "C" && x.d.weaponId, beforeArm), true, "C no se armó");

  const cs2 = find("crystal:state", (x) => x.ch && x.ch.indexOf("room:") === 0);
  const fc = cs2.d.crystals.find((c) => c.type === "food" && !c._t2);
  if (!fc) throw new Error("SKIP: sin cristal de comida disponible");
  fc._t2 = true;
  const am = { x: lastMoved("A").d.x, z: lastMoved("A").d.z };
  eq(moveTo(A, "A", fc.x, fc.z, am), true, "A no llegó al cristal de comida");
  const before = emitted.length;
  fire(A, "crystal:offer", { crystalId: fc.id });
  const upd = find("inventory:update", (x) => x.ch === "#A", before);
  const foodSlot = upd.d.inventory.findIndex((it) => it.type === "food");
  eq(foodSlot >= 0, true, "no se recogió comida");
  const food = upd.d.inventory[foodSlot];

  // 1) Con la vida al máximo: aviso y no se gasta la comida.
  const beforeFull = emitted.length;
  fire(A, "inventory:use", { slot: foodSlot, id: food.id, type: food.type });
  eq(
    !!find("inventory:toast", (x) => x.ch === "#A" && /vida al máximo/i.test(x.d.text), beforeFull),
    true,
    "no avisó de vida al máximo"
  );
  eq(!!find("combat:heal", (x) => x.d.targetId === "A", beforeFull), false, "curó con la vida al máximo");
  eq(!!find("inventory:update", (x) => x.ch === "#A", beforeFull), false, "gastó comida con la vida al máximo");

  // 2) Slot vacío: aviso.
  clock += 500;
  const beforeEmpty = emitted.length;
  fire(A, "inventory:use", { slot: 4, id: "x", type: "food" });
  eq(
    !!find("inventory:toast", (x) => x.ch === "#A" && /vacío/i.test(x.d.text), beforeEmpty),
    true,
    "no avisó del espacio vacío"
  );

  // 3) Objeto desincronizado: avisa y reenvía el inventario.
  clock += 500;
  const beforeMismatch = emitted.length;
  fire(A, "inventory:use", { slot: foodSlot, id: "granada", type: "throwable" });
  eq(
    !!find("inventory:toast", (x) => x.ch === "#A" && /inventario cambió/i.test(x.d.text), beforeMismatch),
    true,
    "no avisó de la desincronización"
  );
  eq(!!find("inventory:update", (x) => x.ch === "#A", beforeMismatch), true, "no resincronizó el inventario");

  // 4) C hiere a A dentro de la sala.
  const la = { x: lastMoved("A").d.x, z: lastMoved("A").d.z };
  eq(
    moveTo(C, "C", la.x + 1.2, la.z, { x: lastMoved("C").d.x, z: lastMoved("C").d.z }),
    true,
    "C no se colocó para disparar"
  );
  clock += 100;
  const beforeHit = emitted.length;
  fire(C, "combat:shoot", { dx: -1, dz: 0 });
  const hitA = find("combat:shot", (x) => x.d.shooterId === "C" && x.d.targetId === "A", beforeHit);
  eq(!!hitA, true, "A no fue alcanzado (necesario para curarse)");
  eq(hitA.d.targetHp < 100, true, "A siguió con 100 hp");

  // 5) A sale al lobby herido (sigue vivo, no se le cura) y come allí.
  fire(A, "room:leave");
  clock += 500;
  const beforeLobby = emitted.length;
  fire(A, "inventory:use", { slot: foodSlot, id: food.id, type: food.type });
  const healLobby = find("combat:heal", (x) => x.d.targetId === "A", beforeLobby);
  eq(healLobby !== null, true, "comer en el lobby no curó");
  eq(healLobby.ch === "lobby", true, "cura de lobby emitida a canal equivocado");

  // 6) Vuelve a la sala y recoge otra comida para probar la cura en sala.
  fire(A, "room:join", { code });
  const apos = welcomePos("A");
  eq(apos !== null, true, "A sin posición al reentrar");
  const cs3 = find("crystal:state", (x) => x.ch === "#A");
  const fc2 = cs3.d.crystals.find((c) => c.type === "food" && !c._t2);
  if (!fc2) throw new Error("SKIP: sin segunda comida disponible");
  fc2._t2 = true;
  eq(moveTo(A, "A", fc2.x, fc2.z, apos), true, "A no llegó a la segunda comida");
  const beforePick2 = emitted.length;
  fire(A, "crystal:offer", { crystalId: fc2.id });
  const upd2 = find("inventory:update", (x) => x.ch === "#A", beforePick2);
  const foodSlot2 = upd2.d.inventory.findIndex((it) => it.type === "food");
  eq(foodSlot2 >= 0, true, "no se recogió la segunda comida");
  const food2 = upd2.d.inventory[foodSlot2];

  // 7) C vuelve a herir a A y A come dentro de la sala.
  const a2 = { x: lastMoved("A").d.x, z: lastMoved("A").d.z };
  eq(
    moveTo(C, "C", a2.x + 1.2, a2.z, { x: lastMoved("C").d.x, z: lastMoved("C").d.z }),
    true,
    "C no se recolocó para el segundo disparo"
  );
  clock += 2000;
  const beforeHit2 = emitted.length;
  fire(C, "combat:shoot", { dx: -1, dz: 0 });
  const hitA2 = find("combat:shot", (x) => x.d.shooterId === "C" && x.d.targetId === "A", beforeHit2);
  eq(!!hitA2, true, "A no fue herido dentro de la sala");
  eq(hitA2.d.targetHp < 100, true, "A siguió con 100 hp en la sala");

  clock += 500;
  const beforeHeal2 = emitted.length;
  fire(A, "inventory:use", { slot: foodSlot2, id: food2.id, type: food2.type });
  const heal2 = find("combat:heal", (x) => x.d.targetId === "A", beforeHeal2);
  eq(heal2 !== null, true, "comer en sala no curó");
  eq(heal2.ch.indexOf("room:") === 0, true, "cura de sala emitida a canal equivocado");
});

run("18b lanzar en el lobby se rechaza con aviso", () => {
  fire(A, "room:leave");
  clock += 500;
  const beforeThrow = emitted.length;
  fire(A, "inventory:throw", { slot: 0, dx: 1, dz: 0 });
  eq(!!find("item:spawn", (x) => x.ch === "lobby", beforeThrow), false, "se lanzó un objeto en el lobby");
  eq(
    !!find("inventory:toast", (x) => x.ch === "#A" && /sala para lanzar/i.test(x.d.text), beforeThrow),
    true,
    "no avisó de que hay que entrar a una sala para lanzar"
  );
});

run("18c pedir cristal desde el lobby da crystal:error", () => {
  const beforeErr = emitted.length;
  fire(A, "crystal:offer", { crystalId: 1 });
  const err = find("crystal:error", (x) => x.ch === "#A", beforeErr);
  eq(!!err, true, "no se avisó del error de cristal");
  eq(/sala/i.test(err.d.error), true, "mensaje de error inesperado");
});

// ---- Fase 1.2: bloqueo con escudo (protocolo autoritativo) ----
// El tick de aguante es el único setInterval de 100 ms del servidor.
const blockTick = timers.find((h) => h.interval && h.ms === 100);
let shieldD, shieldE, shieldCode, shieldSpot;

run("20 el escudo aparece y se equipa (cristales forzados)", () => {
  // Math.random constante 0.87: tipo "weapon" y randomCrystalWeapon cae en
  // others[16] === "escudo" (las armas de la Fase 2 cambian los índices).
  // Todos los cristales de la sala son escudos y comparten posición (el spot
  // también es constante), lo que simplifica el recorrido del test.
  const realRandom = Math.random;
  Math.random = () => 0.87;
  try {
    shieldD = mk("D");
    io.connect(shieldD);
    fire(shieldD, "player:join", { name: "Delta" });
    fire(shieldD, "room:create", { name: "Guardia", mapId: "selva" });
  } finally {
    Math.random = realRandom;
  }
  const rs = find("room:state", (x) => x.ch === "#D");
  eq(!!rs && !!rs.d.room, true, "D no creó la sala");
  shieldCode = rs.d.room.code;
  const cs = find("crystal:state", (x) => x.ch === "#D");
  eq(!!cs && cs.d.crystals.length > 0, true, "la sala de prueba no tiene cristales");
  eq(cs.d.crystals.every((c) => c.type === "weapon"), true, "los cristales forzados no son armas");
  const c0 = cs.d.crystals[0];
  shieldSpot = { x: c0.x, z: c0.z };
  const dpos = welcomePos("D");
  eq(!!dpos, true, "D sin posición inicial");
  eq(
    MOB.isInsideObstacle("selva", dpos.x, dpos.z, 0.9),
    false,
    "D apareció dentro de una cobertura"
  );
  eq(moveTo(shieldD, "D", c0.x, c0.z, dpos), true, "D no llegó al cristal de escudo");
  const before = emitted.length;
  fire(shieldD, "crystal:offer", { crystalId: c0.id });
  const offer = find("crystal:offer", (x) => x.ch === "#D", before);
  eq(!!offer, true, "no llegó la oferta del cristal");
  eq(offer.d.weaponId, "escudo", "el cristal forzado no era un escudo");
  fire(shieldD, "crystal:respond", { crystalId: c0.id, accept: true });
  const equip = find("crystal:equip", (x) => x.d.playerId === "D", before);
  eq(!!equip && equip.d.weaponId === "escudo", true, "D no equipó el escudo");
});

run("21 bloquear emite combat:block con aguante lleno", () => {
  clock += 500;
  const before = emitted.length;
  fire(shieldD, "combat:block", { on: true, yaw: 0 });
  const ev = find("combat:block", (x) => x.ch === "room:" + shieldCode && x.d.playerId === "D", before);
  eq(!!ev, true, "no se emitió combat:block");
  eq(ev.d.blocking, true, "el bloqueo no se activó");
  eq(ev.d.stamina, 100, "el aguante inicial no es 100");
});

run("21b el bloqueo tolera un hueco de keepalive de 0,9 s pero no 1,3 s", () => {
  // Un parón del navegador (pestaña en segundo plano, GC) no debe bajar el
  // escudo: el margen del servidor es de 1,2 s.
  const beforeGap = emitted.length;
  clock += 900;
  blockTick.fn();
  eq(
    !!find("combat:block", (x) => x.d.playerId === "D" && x.d.blocking === false, beforeGap),
    false,
    "un hueco de 0,9 s cortó el bloqueo"
  );

  const beforeDrop = emitted.length;
  clock += 1300;
  blockTick.fn();
  const drop = find(
    "combat:block",
    (x) => x.ch === "room:" + shieldCode && x.d.playerId === "D" && x.d.blocking === false,
    beforeDrop
  );
  eq(!!drop, true, "el bloqueo no se cortó al perder el keepalive 1,3 s");

  // D vuelve a bloquear para el resto de las pruebas.
  const before = emitted.length;
  fire(shieldD, "combat:block", { on: true, yaw: 0 });
  const ev = find(
    "combat:block",
    (x) => x.ch === "room:" + shieldCode && x.d.playerId === "D" && x.d.blocking === true,
    before
  );
  eq(!!ev, true, "D no pudo volver a bloquear tras el hueco");
});

run("22 el escudo anula el daño frontal", () => {
  shieldE = mk("E");
  io.connect(shieldE);
  fire(shieldE, "player:join", { name: "Eco" });
  fire(shieldE, "room:join", { code: shieldCode });
  const epos = welcomePos("E");
  eq(!!epos, true, "E sin posición al entrar");
  const cs = find("crystal:state", (x) => x.ch === "#E");
  eq(!!cs && cs.d.crystals.length > 0, true, "E no ve cristales de escudo");
  const c1 = cs.d.crystals[0];
  eq(moveTo(shieldE, "E", c1.x, c1.z, epos), true, "E no llegó al cristal");
  const beforePick = emitted.length;
  fire(shieldE, "crystal:offer", { crystalId: c1.id });
  fire(shieldE, "crystal:respond", { crystalId: c1.id, accept: true });
  const eqp = find("crystal:equip", (x) => x.d.playerId === "E", beforePick);
  eq(!!eqp && eqp.d.weaponId === "escudo", true, "E no equipó un escudo");

  // E se coloca delante de D (D mira hacia -Z con yaw 0).
  eq(
    moveTo(shieldE, "E", shieldSpot.x, shieldSpot.z - 1.2, { x: c1.x, z: c1.z }),
    true,
    "E no se colocó delante de D"
  );
  clock += 100;
  const before = emitted.length;
  fire(shieldE, "combat:shoot", { dx: 0, dz: 1 });
  const hit = find("combat:shot", (x) => x.d.shooterId === "E" && x.d.targetId === "D", before);
  eq(!!hit, true, "E no alcanzó a D");
  eq(hit.d.blocked, true, "el golpe frontal no fue bloqueado");
  eq(hit.d.damage, 0, "el bloqueo no anuló el daño");
  eq(hit.d.targetHp, 100, "D perdió vida con el escudo levantado");
  eq(!!find("combat:blocked", (x) => x.d.targetId === "D", before), true, "no se emitieron chispas de bloqueo");
});

run("23 un golpe por detrás entra completo", () => {
  clock += 800;
  eq(
    moveTo(shieldE, "E", shieldSpot.x, shieldSpot.z + 1.2, { x: shieldSpot.x, z: shieldSpot.z - 1.2 }),
    true,
    "E no se colocó detrás de D"
  );
  clock += 100;
  const before = emitted.length;
  fire(shieldE, "combat:shoot", { dx: 0, dz: -1 });
  const hit = find("combat:shot", (x) => x.d.shooterId === "E" && x.d.targetId === "D", before);
  eq(!!hit, true, "E no alcanzó a D por detrás");
  eq(hit.d.blocked, false, "se bloqueó un golpe por detrás");
  eq(hit.d.targetHp < 100, true, "el daño por detrás no entró");
});

run("24 el aguante se agota y rompe la guardia 1,2 s", () => {
  clock += 100;
  fire(shieldD, "combat:block", { on: true, yaw: 0 });
  const before = emitted.length;
  let guardBreak = null;
  for (let i = 0; i < 60 && !guardBreak; i++) {
    clock += 100;
    if (i % 3 === 0) fire(shieldD, "combat:block", { on: true, yaw: 0 }); // keepalive < 450 ms
    blockTick.fn();
    guardBreak = find("combat:block", (x) => x.d.playerId === "D" && x.d.guardBreak === true, before);
  }
  eq(!!guardBreak, true, "el escudo nunca llegó a romperse");
  eq(guardBreak.d.stamina, 0, "el aguante no quedó a 0");
  eq(guardBreak.d.blocking, false, "siguió bloqueando tras romperse");

  // Durante el guard break el servidor rechaza volver a bloquear.
  const beforeDeny = emitted.length;
  fire(shieldD, "combat:block", { on: true, yaw: 0 });
  const deny = find("combat:block", (x) => x.ch === "#D" && x.d.reason === "guard-break", beforeDeny);
  eq(!!deny, true, "no se rechazó el bloqueo durante el guard break");
  eq(deny.d.blocking, false, "quedó bloqueando durante el guard break");

  // Reintentar durante el castigo no debe alargarlo.
  clock += 300;
  const beforeDeny2 = emitted.length;
  fire(shieldD, "combat:block", { on: true, yaw: 0 });
  eq(
    !!find("combat:block", (x) => x.ch === "#D" && x.d.reason === "guard-break", beforeDeny2),
    true,
    "el segundo intento no fue rechazado"
  );
});

run("25 tras el guard break el aguante regenera y se puede bloquear", () => {
  // 1,2 s de guard break + 0,1 s de regeneración (14/s) => ~1 de aguante.
  // El segundo intento rechazado (a los 0,3 s) no debe haber alargado el
  // castigo: con 1,3 s desde la rotura ya se puede volver a bloquear.
  for (let i = 0; i < 10; i++) {
    clock += 100;
    blockTick.fn();
  }
  const before = emitted.length;
  fire(shieldD, "combat:block", { on: true, yaw: 0 });
  const ev = find("combat:block", (x) => x.ch === "room:" + shieldCode && x.d.playerId === "D", before);
  eq(!!ev, true, "no volvió a bloquear tras el guard break");
  eq(ev.d.blocking, true, "el bloqueo no se reactivó");
  eq(ev.d.stamina > 0, true, "el aguante no regeneró");
});

run("26 sin escudo el servidor rechaza el bloqueo", () => {
  const F = mk("F");
  io.connect(F);
  fire(F, "player:join", { name: "Foxtrot" });
  fire(F, "room:join", { code: shieldCode });
  clock += 500;
  const before = emitted.length;
  fire(F, "combat:block", { on: true, yaw: 0 });
  const deny = find("combat:block", (x) => x.ch === "#F" && x.d.reason === "no-shield", before);
  eq(!!deny, true, "no se rechazó el bloqueo sin escudo");
  eq(deny.d.blocking, false, "quedó bloqueando sin escudo");
  fire(F, "disconnect");
});

run("27 soltar el escudo corta el bloqueo", () => {
  const before = emitted.length;
  fire(shieldD, "combat:block", { on: false, yaw: 0 });
  const ev = find(
    "combat:block",
    (x) => x.ch === "room:" + shieldCode && x.d.playerId === "D" && x.d.blocking === false,
    before
  );
  eq(!!ev, true, "no se emitió el fin del bloqueo");
});

run("28 con el escudo levantado se puede golpear (bash)", () => {
  fire(shieldD, "combat:block", { on: true, yaw: 0 });
  eq(
    moveTo(shieldE, "E", shieldSpot.x, shieldSpot.z - 1.2, { x: shieldSpot.x, z: shieldSpot.z + 1.2 }),
    true,
    "E no volvió al frente de D"
  );
  clock += 800;
  const before = emitted.length;
  fire(shieldD, "combat:shoot", { dx: 0, dz: -1 });
  const hit = find("combat:shot", (x) => x.d.shooterId === "D" && x.d.targetId === "E", before);
  eq(!!hit, true, "el escudo no golpeó mientras bloqueaba");
});

run("29 limpieza de la sala de escudo", () => {
  fire(shieldD, "disconnect");
  fire(shieldE, "disconnect");
  eq(roomsSizeOk(), true, "la sala de escudo no se cerró al salir todos");
});

run("30 ballesta: cristal nuevo, equipar y daño con caída", () => {
  // Math.random constante 0.99: tipo "weapon" y randomCrystalWeapon cae en
  // others[18] === "ballesta". Así probamos de paso que las armas nuevas
  // entran en el pool de cristales.
  const realRandom = Math.random;
  Math.random = () => 0.99;
  let H, I, bcode;
  try {
    H = mk("H");
    io.connect(H);
    fire(H, "player:join", { name: "Hotel" });
    fire(H, "room:create", { name: "Ballesta", mapId: "selva" });
    const rs = find("room:state", (x) => x.ch === "#H");
    eq(!!rs && !!rs.d.room, true, "H no creó la sala");
    bcode = rs.d.room.code;
    I = mk("I");
    io.connect(I);
    fire(I, "player:join", { name: "India" });
    fire(I, "room:join", { code: bcode });
  } finally {
    Math.random = realRandom;
  }

  const cs = find("crystal:state", (x) => x.ch === "#H");
  eq(!!cs && cs.d.crystals.length > 0, true, "la sala de ballesta no tiene cristales");
  eq(cs.d.crystals.every((c) => c.type === "weapon"), true, "los cristales forzados no son armas");
  const c0 = cs.d.crystals[0];
  const hpos = welcomePos("H");
  eq(moveTo(H, "H", c0.x, c0.z, hpos), true, "H no llegó al cristal de ballesta");

  const before = emitted.length;
  fire(H, "crystal:offer", { crystalId: c0.id });
  const offer = find("crystal:offer", (x) => x.ch === "#H", before);
  eq(!!offer && offer.d.weaponId === "ballesta", true, "el cristal forzado no era una ballesta");
  fire(H, "crystal:respond", { crystalId: c0.id, accept: true });
  const equip = find("crystal:equip", (x) => x.d.playerId === "H", before);
  eq(!!equip && equip.d.weaponId === "ballesta", true, "H no equipó la ballesta");

  // I se coloca a 18 m de H, hacia el centro del mapa para no salir del límite.
  const dir = c0.x > 0 ? -1 : 1;
  const ix = c0.x + dir * 18;
  const ipos = welcomePos("I");
  eq(moveTo(I, "I", ix, c0.z, ipos), true, "I no llegó a la distancia de prueba");

  const hm = lastMoved("H");
  const im = lastMoved("I");
  const actualDist = Math.hypot(im.d.x - hm.d.x, im.d.z - hm.d.z);
  const weapon = getWeapon("ballesta");
  eq(actualDist > weapon.rangeMin && actualDist < weapon.range, true,
    `distancia de prueba ${actualDist} fuera de la caída`);

  clock += 1000;
  const shootBefore = emitted.length;
  fire(H, "combat:shoot", { dx: dir, dz: 0 });
  const hit = find(
    "combat:shot",
    (x) => x.d.shooterId === "H" && x.d.targetId === "I" && x.d.hit === true,
    shootBefore
  );
  eq(!!hit, true, "la ballesta no alcanzó a I");
  const expected = WM.damageAtRange(weapon, actualDist);
  eq(Math.abs(hit.d.damage - expected) < 1e-9, true,
    `daño ${hit.d.damage} != ${expected} a ${actualDist.toFixed(2)} m`);
  eq(hit.d.damage < weapon.damage, true, "no se aplicó la caída de daño");

  fire(H, "disconnect");
  fire(I, "disconnect");
});

function roomsSizeOk() {
  const rl = find("room:list");
  return !rl || !rl.d.rooms.some((r) => r.code === shieldCode);
}

run("19 lobby lleno produce game:full", () => {
  for (let i = 0; i < 16; i++) {
    const g = mk("G" + i);
    io.connect(g);
    fire(g, "player:join", { name: "G" + i });
  }
  const F = mk("FULL");
  io.connect(F);
  fire(F, "player:join", { name: "Full" });
  const gf = find("game:full", (x) => x.ch === "#FULL");
  eq(gf !== null, true, "no se notificó game:full");
});

// ---- Fase 3: puntaje y tienda ----

function respawnAll() {
  for (const h of timers) {
    if (h.interval || h.cleared || h.ms !== 10000 || typeof h.fn !== "function") continue;
    h.cleared = true;
    h.fn();
  }
}

function shootUntilKill(sock, shooterId, targetId, dx, dz, maxShots = 24) {
  for (let i = 0; i < maxShots; i++) {
    clock += 500;
    const before = emitted.length;
    fire(sock, "combat:shoot", { dx, dz });
    const hit = emitted.slice(before).filter(
      (x) => x.e === "combat:shot" && x.d.shooterId === shooterId && x.d.targetId === targetId
    );
    if (!hit.length) continue;
    const dead = find("combat:eliminated", (x) => x.d.targetId === targetId, before);
    if (dead) return true;
  }
  return false;
}

let shopCode = null;
let P, Q, R;

run("31 tienda: comprar fuera de sala se rechaza", () => {
  // El test 19 llenó el lobby: se liberan sus conexiones para los jugadores P/Q/R.
  for (let i = 0; i < 16; i++) {
    const g = io._sock.get("G" + i);
    if (g) fire(g, "disconnect");
  }
  P = mk("P");
  io.connect(P);
  fire(P, "player:join", { name: "Puntos" });

  const before = emitted.length;
  fire(P, "shop:buy", { weaponId: "daga" });
  const res = find("shop:result", (x) => x.ch === "#P", before);
  eq(!!res, true, "no llegó shop:result");
  eq(res.d.ok, false, "compró fuera de una sala");
  eq(res.d.reason, "no-room", "motivo: " + res.d.reason);
  eq(res.d.score, 0, "el saldo cambió fuera de sala");
});

run("32 tienda: sin puntos se rechaza y el saldo queda intacto", () => {
  fire(P, "room:create", { name: "Tienda", mapId: "nevado" });
  const rs = find("room:state", (x) => x.ch === "#P");
  eq(!!rs && !!rs.d.room, true, "P no creó la sala");
  shopCode = rs.d.room.code;

  const ss = find("score:state", (x) => x.ch === "#P");
  eq(!!ss && Array.isArray(ss.d.players), true, "sin score:state al crear la sala");

  const before = emitted.length;
  fire(P, "shop:buy", { weaponId: "sniper" });
  const res = find("shop:result", (x) => x.ch === "#P", before);
  eq(!!res && res.d.ok === false, true, "compró sin puntos");
  eq(res.d.reason, "insufficient", "motivo: " + res.d.reason);
  eq(res.d.score, 0, "el saldo cambió al fallar la compra");
  const upd = find(
    "score:update",
    (x) => x.d && x.d.playerId === "P" && x.d.reason === "shop",
    before
  );
  eq(!!upd, false, "se emitió score:update de una compra fallida");
});

run("33 puntaje y tienda: 4 bajas, compra de daga y reequipar gratis", () => {
  let before = emitted.length;
  fire(P, "shop:buy", { weaponId: "pistola" });
  let res = find("shop:result", (x) => x.ch === "#P", before);
  eq(!!res && res.d.ok === true && res.d.price === 0, true, "no equipó la pistola gratis");
  let eqp = find(
    "crystal:equip",
    (x) => x.d.playerId === "P" && x.d.weaponId === "pistola",
    before
  );
  eq(!!eqp, true, "sin crystal:equip de la pistola gratis");

  Q = mk("Q");
  io.connect(Q);
  fire(Q, "player:join", { name: "Victima" });
  fire(Q, "room:join", { code: shopCode });
  const ppos = welcomePos("P");
  const qpos = welcomePos("Q");
  eq(!!ppos && !!qpos, true, "sin posiciones iniciales de P/Q");
  eq(moveTo(Q, "Q", ppos.x + 1.2, ppos.z, qpos), true, "Q no se colocó frente a P");

  const kills = [];
  for (let i = 0; i < 4; i++) {
    before = emitted.length;
    const ok = shootUntilKill(P, "P", "Q", 1, 0);
    eq(ok, true, "Q no murió en la baja " + (i + 1));
    const upd = find("score:update", (x) => x.d.playerId === "P", before);
    eq(!!upd, true, "sin score:update de la baja " + (i + 1));
    kills.push(upd);
    const death = find(
      "score:update",
      (x) => x.d.playerId === "Q" && x.d.reason === "death",
      before
    );
    eq(!!death, true, "sin score:update de muerte");
    eq(death.d.streak, 0, "la muerte no reinició la racha");
    eq(death.d.deaths, i + 1, "muertes acumuladas: " + death.d.deaths);
    respawnAll();
  }

  eq(kills[0].d.reason, "kill", "motivo de la primera baja: " + kills[0].d.reason);
  eq(kills[0].d.delta, 100, "la primera baja no dio 100: " + kills[0].d.delta);
  eq(kills[1].d.reason, "kill-farm", "la segunda baja no fue anti-farmeo");
  eq(kills[1].d.delta, 75, "segunda baja (50 + 25 de racha): " + kills[1].d.delta);
  eq(kills[3].d.delta, 100, "cuarta baja (50 + 50 de racha): " + kills[3].d.delta);
  eq(kills[3].d.score, 375, "puntaje acumulado: " + kills[3].d.score);

  before = emitted.length;
  fire(P, "shop:buy", { weaponId: "daga" });
  res = find("shop:result", (x) => x.ch === "#P", before);
  eq(!!res && res.d.ok === true, true, "no compró la daga");
  eq(res.d.price, 300, "precio de la daga: " + res.d.price);
  eq(res.d.score, 75, "saldo tras comprar la daga: " + res.d.score);
  eqp = find(
    "crystal:equip",
    (x) => x.d.playerId === "P" && x.d.weaponId === "daga",
    before
  );
  eq(!!eqp, true, "sin crystal:equip de la daga comprada");
  const spend = find(
    "score:update",
    (x) => x.d.playerId === "P" && x.d.reason === "shop",
    before
  );
  eq(!!spend && spend.d.delta === -300, true, "sin score:update de gasto");

  before = emitted.length;
  fire(P, "shop:buy", { weaponId: "daga" });
  res = find("shop:result", (x) => x.ch === "#P", before);
  eq(
    !!res && res.d.ok === true && res.d.price === 0 && res.d.alreadyEquipped === true,
    true,
    "reequipar la misma arma no fue gratis"
  );
  eq(res.d.score, 75, "reequipar descontó puntos");
});

run("34 asistencia +40 y la muerte reinicia la racha", () => {
  let before = emitted.length;
  fire(P, "shop:buy", { weaponId: "pistola" });
  let res = find("shop:result", (x) => x.ch === "#P", before);
  eq(!!res && res.d.ok === true && res.d.price === 0, true, "no volvió a la pistola gratis");
  eq(res.d.score, 75, "cambiar de arma gratis descontó puntos");

  R = mk("R");
  io.connect(R);
  fire(R, "player:join", { name: "Ayuda" });
  fire(R, "room:join", { code: shopCode });
  before = emitted.length;
  fire(R, "shop:buy", { weaponId: "pistola" });
  const rBuy = find("shop:result", (x) => x.ch === "#R", before);
  eq(!!rBuy && rBuy.d.ok === true, true, "R no equipó la pistola gratis");
  const qm = lastMoved("Q");
  const rpos = welcomePos("R");
  eq(!!qm && !!rpos, true, "sin posición de Q/R");
  eq(moveTo(R, "R", qm.d.x + 1.2, qm.d.z, rpos), true, "R no se colocó junto a Q");

  before = emitted.length;
  fire(R, "combat:shoot", { dx: -1, dz: 0 });
  const rHit = find(
    "combat:shot",
    (x) => x.d.shooterId === "R" && x.d.targetId === "Q" && x.d.hit === true,
    before
  );
  eq(!!rHit, true, "R no alcanzó a Q para la asistencia");

  before = emitted.length;
  const ok = shootUntilKill(P, "P", "Q", 1, 0);
  eq(ok, true, "P no remató a Q");
  const pUpd = find("score:update", (x) => x.d.playerId === "P", before);
  eq(!!pUpd && pUpd.d.delta === 100, true, "baja con asistencia: " + (pUpd && pUpd.d.delta));
  const assist = find(
    "score:update",
    (x) => x.d.playerId === "R" && x.d.reason === "assist",
    before
  );
  eq(!!assist, true, "R no recibió puntos de asistencia");
  eq(assist.d.delta, 40, "asistencia: " + assist.d.delta);
  respawnAll();
});

run("35 el anti-farmeo caduca a los 60 s", () => {
  clock += 61000;
  const before = emitted.length;
  const ok = shootUntilKill(P, "P", "Q", 1, 0);
  eq(ok, true, "P no mató a Q tras 60 s");
  const upd = find("score:update", (x) => x.d.playerId === "P", before);
  eq(!!upd && upd.d.reason === "kill", true, "motivo: " + (upd && upd.d.reason));
  eq(upd.d.delta, 150, "baja completa + racha: " + upd.d.delta);
  respawnAll();
});

run("36 un muerto no puede comprar en la tienda", () => {
  let before = emitted.length;
  fire(Q, "shop:buy", { weaponId: "pistola" });
  const qres = find("shop:result", (x) => x.ch === "#Q", before);
  eq(!!qres && qres.d.ok === true && qres.d.price === 0, true, "Q no equipó pistola gratis");

  const qm = lastMoved("Q");
  eq(!!qm, true, "sin posición de Q");
  const ok = shootUntilKill(Q, "Q", "P", -1, 0);
  eq(ok, true, "Q no eliminó a P");

  const lastP = find("score:update", (x) => x.d.playerId === "P");
  const scoreBefore = lastP ? lastP.d.score : 0;
  before = emitted.length;
  fire(P, "shop:buy", { weaponId: "daga" });
  const res = find("shop:result", (x) => x.ch === "#P", before);
  eq(!!res && res.d.ok === false, true, "un jugador muerto pudo comprar");
  eq(res.d.reason, "dead", "motivo: " + res.d.reason);
  eq(res.d.score, scoreBefore, "el saldo de un muerto cambió");

  respawnAll();
  for (const s of [P, Q, R]) if (s) fire(s, "disconnect");
});

// ---- Fase 3: persistencia del historial (user_stats) ----

run("37 user_stats acumula puntos, bajas/muertes y conserva la mejor racha", () => {
  const id = createUser("StatsUno", null, "#123456", null);
  eq(getUserStats(id), null, "una cuenta nueva no debería tener fila de stats");

  let stats = recordUserStats(id, { score: 100, kills: 1, bestStreak: 1 });
  eq(stats.score_total, 100, "puntos iniciales: " + stats.score_total);
  eq(stats.kills, 1, "bajas iniciales: " + stats.kills);

  stats = recordUserStats(id, { score: 25, deaths: 1, bestStreak: 3 });
  eq(stats.score_total, 125, "los puntos deben acumularse: " + stats.score_total);
  eq(stats.kills, 1, "las bajas no deben perderse: " + stats.kills);
  eq(stats.deaths, 1, "muertes: " + stats.deaths);
  eq(stats.best_streak, 3, "mejor racha: " + stats.best_streak);

  stats = recordUserStats(id, { bestStreak: 2 });
  eq(stats.best_streak, 3, "la mejor racha no debe bajar");
});

run("38 getTopStats ordena por puntos y une el nombre de la cuenta", () => {
  const id = createUser("StatsDos", null, "#abcdef", null);
  recordUserStats(id, { score: 400, kills: 4, bestStreak: 2 });

  const top = getTopStats(5);
  eq(top[0].username, "StatsDos", "primero: " + top[0].username);
  eq(top[0].score, 400, "puntos del primero: " + top[0].score);
  const uno = top.find((row) => row.username === "StatsUno");
  eq(!!uno, true, "StatsUno no aparece en el top");
  eq(uno.score, 125, "puntos de StatsUno: " + uno.score);
  eq(
    top.every((row, i, list) => i === 0 || list[i - 1].score >= row.score),
    true,
    "el top no está ordenado por puntos"
  );
});

run("39 recordUserStats sin cuenta válida no crea filas", () => {
  eq(recordUserStats(0, { score: 50 }), null, "userId 0 no debería guardar");
  eq(recordUserStats(null, { score: 50 }), null, "userId null no debería guardar");
});

for (const h of timers) h.cleared = true;

const total = results.length;
const ok = results.filter((r) => r.ok).length;
const skip = results.filter((r) => r.ok && /SKIP/i.test(r.extra || "")).length;
console.log(`\nRESULTADO protocolo: ${ok}/${total} ok${skip ? ` (${skip} skip)` : ""}`);
if (ok !== total) {
  process.exitCode = 1;
}