// Prueba de carga/concurrencia (A11) para Club Pingüi.
// Levanta el servidor REAL en este proceso (server/index.js) y le conecta
// bots con socket.io-client por WebSocket: lobby + creación/unión de salas,
// movimiento, chat (RTT end-to-end con token) y disparos.
//
// Uso:  node public/test/load.mjs   (LOAD_BOTS=60 es el default)

import os from "node:os";
import path from "node:path";
import { io } from "socket.io-client";

const TOTAL = Number.parseInt(process.env.LOAD_BOTS || "60", 10);
const RESIDENTS = Math.min(8, Math.max(2, Math.floor(TOTAL * 0.15))); // se quedan en el lobby
const CREATORS = Math.min(10, Math.max(1, Math.floor(TOTAL * 0.2))); // crean una sala cada uno (máx MAX_ROOMS=10)
const JOINERS = Math.max(0, TOTAL - RESIDENTS - CREATORS);
const DURATION_MS = Number.parseInt(process.env.LOAD_DURATION_MS || "25000", 10);
const PORT = Number.parseInt(process.env.LOAD_PORT || "3311", 10);
const URL = `http://127.0.0.1:${PORT}`;

process.env.PORT = String(PORT);
process.env.DB_PATH = path.join(os.tmpdir(), `club-load-${Date.now()}.db`);
process.env.ENABLE_SPIKE = "0";

// Silenciar el ruido de conexión/join del server para no inundar la salida
const origLog = console.log.bind(console);
console.log = (...a) => {
  const s = a.join(" ");
  if (/\[socket\]|\[game\]|\[rooms\]/.test(s)) return;
  origLog(...a);
};
console.error = origLog;

const stats = {
  bots: TOTAL,
  connects: 0,
  admits: 0,
  gameFull: 0,
  admittedAfterFull: 0,
  connectErrors: 0,
  unexpectedDisconnects: 0,
  roomErrors: 0,
  connectMs: [],
  admitMs: [],
  chatRttMs: [],
  chatSamples: 0,
  movesIn: 0,
  shots: 0,
  roomJoins: 0,
  weaponsGained: 0,
  startedAt: Date.now(),
};

const rooms = { codes: [] }; // códigos publicados por los creadores

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randPos = () => ({ x: (Math.random() - 0.5) * 220, z: (Math.random() - 0.5) * 220 });
const q = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
};

function makeBot(i) {
  const b = {
    i,
    sock: null,
    roomCode: null,
    admitted: false,
    inRoom: false,
    pos: randPos(),
    target: randPos(),
    weaponId: null,
    crystalTarget: null,
    nextChat: Date.now() + 500 + Math.random() * 1500,
    nextShot: Date.now() + 3000,
    stop: false,
  };

  const sock = io(URL, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    timeout: 8000,
  });
  b.sock = sock;

  const t0 = Date.now();

  sock.on("connect", () => {
    stats.connects++;
    stats.connectMs.push(Date.now() - t0);
    sock.emit("player:join", { name: `Bot${i}` });
  });

  sock.on("connect_error", () => {
    stats.connectErrors++;
    b.admitted = false;
  });

  sock.on("game:full", () => {
    stats.gameFull++;
    setTimeout(() => {
      if (!b.stop && !b.admitted) sock.emit("player:join", { name: `Bot${i}` });
    }, 180 + Math.random() * 120);
  });

  sock.on("welcome", (w) => {
    if (!b.admitted) {
      b.admitted = true;
      stats.admits++;
      stats.admitMs.push(Date.now() - t0);
      const me = (w && w.players || []).find((p) => p.id === sock.id);
      b.pos = me ? { x: me.x, z: me.z } : randPos();
    }
    if (i < RESIDENTS) {
      // se queda en el lobby
    } else if (i < RESIDENTS + CREATORS) {
      sock.emit("room:create", {
        name: `Sala ${i}`,
        mapId: pick(["map_tundra", "map_playa", "map_arena"]),
      });
    } else {
      const code = rooms.codes[(i - RESIDENTS - CREATORS) % CREATORS] || null;
      if (code) {
        sock.emit("room:join", { code });
      } else {
        setTimeout(() => {
          const c2 = rooms.codes[(i - RESIDENTS - CREATORS) % CREATORS];
          if (c2) sock.emit("room:join", { code: c2 });
        }, 250);
      }
    }
  });

  sock.on("room:state", (d) => {
    if (d && d.room) {
      b.roomCode = d.room.code;
      b.inRoom = true;
      stats.roomJoins++;
      if (!rooms.codes.includes(d.room.code)) rooms.codes.push(d.room.code);
    }
  });

  sock.on("room:error", () => {
    stats.roomErrors++;
    if (i >= RESIDENTS + CREATORS && !b.inRoom) {
      // reintentar unirse cuando exista la sala
      setTimeout(() => {
        const c2 = rooms.codes[(i - RESIDENTS - CREATORS) % CREATORS];
        if (c2 && !b.stop) sock.emit("room:join", { code: c2 });
      }, 250);
    }
  });

  sock.on("crystal:state", (d) => {
    const w = (d.crystals || []).find((c) => c.type === "weapon" && !c.ownerId);
    if (w) b.crystalTarget = w;
  });

  sock.on("crystal:equip", (d) => {
    if (d && d.weaponId) {
      b.weaponId = d.weaponId;
      stats.weaponsGained++;
    }
  });

  sock.on("player:moved", () => {
    stats.movesIn++;
  });

  sock.on("chat:message", (m) => {
    if (m && m.id === sock.id && m.text && m.text.startsWith("__RTT")) {
      const ts = Number(m.text.slice(5));
      if (Number.isFinite(ts)) {
        stats.chatRttMs.push(Date.now() - ts);
        stats.chatSamples++;
      }
    }
  });

  sock.on("disconnect", (reason) => {
    if (!b.stop && reason !== "io client disconnect") stats.unexpectedDisconnects++;
  });

  // Bucle de acciones
  const loop = setInterval(() => {
    if (b.stop || !b.admitted) return;

    // Movimiento: pasos hacia el objetivo (o hacia el cristal de arma)
    let target = b.target;
    const hunting = b.inRoom && !b.weaponId && b.crystalTarget;
    if (hunting) target = { x: b.crystalTarget.x, z: b.crystalTarget.z };
    const dx = target.x - b.pos.x;
    const dz = target.z - b.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.2) {
      if (hunting) {
        // listo para oferta
        sock.emit("crystal:offer", { crystalId: b.crystalTarget.id });
      } else {
        b.target = randPos();
      }
    } else {
      const step = Math.min(hunting ? 0.5 : 2.0, dist);
      b.pos = { x: b.pos.x + (dx / dist) * step, z: b.pos.z + (dz / dist) * step };
      sock.emit("player:move", { x: b.pos.x, z: b.pos.z });
    }

    // Oferta de cristal (se acepta cuando está cerca)
    if (
      b.inRoom &&
      !b.weaponId &&
      b.crystalTarget &&
      dist < 1.2 &&
      Math.random() < 0.02
    ) {
      sock.emit("crystal:respond", { crystalId: b.crystalTarget.id, accept: true });
    }

    // Disparos (los de sala con arma)
    if (b.inRoom && b.weaponId && Date.now() > b.nextShot) {
      const a = Math.random() * Math.PI * 2;
      sock.emit("combat:shoot", { dx: Math.cos(a), dz: Math.sin(a) });
      stats.shots++;
      b.nextShot = Date.now() + 1200 + Math.random() * 1800;
    }

    // Chat de lobby o sala
    if (Date.now() > b.nextChat) {
      sock.emit("chat:message", { text: `Hola desde Bot${i}` });
      b.nextChat = Date.now() + 2000 + Math.random() * 2500;
    }
  }, 60);

  b.stopLoops = () => clearInterval(loop);
  b.rttProbe = () => {
    const tag = Date.now();
    sock.emit("chat:message", { text: `__RTT${tag}` });
  };
  b.close = () => {
    b.stop = true;
    try {
      sock.emit("room:leave");
    } catch {
      /* sin sala */
    }
    sock.disconnect();
  };

  return b;
}

console.log(`[load] Levantando servidor real en ${URL} (DB temporal)...`);
await import("../../server/index.js");

// Esperar salud
let healthy = false;
for (let i = 0; i < 50 && !healthy; i++) {
  try {
    const r = await fetch(`${URL}/healthz`);
    healthy = r.status === 200;
  } catch {
    /* reintentar */
  }
  if (!healthy) await new Promise((r) => setTimeout(r, 100));
}
if (!healthy) {
  console.error("[load] El servidor no respondió /healthz. Abort.");
  process.exit(1);
}

console.log(`[load] Servidor OK. Desplegando ${TOTAL} bots (${RESIDENTS} lobby + ${CREATORS} creadores + ${JOINERS} joiners)...`);

const bots = [];
for (let i = 0; i < TOTAL; i++) bots.push(makeBot(i));

// Esperar a que todos estén admitidos (con tope de tiempo)
const waitAdmit = async (ms) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (bots.every((b) => b.admitted)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
};
const allAdmit = await waitAdmit(20000);
if (!allAdmit) {
  const pend = bots.filter((b) => !b.admitted).length;
  console.log(`[load] WARN: ${pend} bots no admitidos en el lobby en 20s (capacidad limitada).`);
}

// Esperar a que los creadores publiquen salas y los joiners entren
for (let i = 0; i < 100; i++) {
  if (rooms.codes.length >= Math.min(CREATORS, 10)) break;
  await new Promise((r) => setTimeout(r, 100));
}

console.log(`[load] Salas creadas: ${rooms.codes.length}/${CREATORS}. Sometiendo ${DURATION_MS} ms de carga...`);
const tLoad0 = Date.now();

await new Promise((r) => setTimeout(r, DURATION_MS));

// RTT de cierre
for (const b of bots) b.rttProbe();
await new Promise((r) => setTimeout(r, 1500));

const elapsedMs = Date.now() - tLoad0;
const rssMB = Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10;

let sessions = null;
try {
  const r = await fetch(`${URL}/healthz`, { signal: AbortSignal.timeout(4000) });
  sessions = await r.json();
} catch {
  /* sin sesiones */
}

for (const b of bots) {
  b.stopLoops();
  b.close();
}
await new Promise((r) => setTimeout(r, 500));

const result = {
  prueba: "A11 Carga/Concurrencia",
  fecha: new Date().toISOString(),
  config: { bots: TOTAL, lobby: RESIDENTS, creadores: CREATORS, joiners: JOINERS, duracion_ms: DURATION_MS, port: PORT },
  resultados: {
    admisión: {
      admitidos: stats.admits,
      gameFull: stats.gameFull,
      noAdmitidos: TOTAL - stats.admits,
      connectErrors: stats.connectErrors,
      connectMs: {
        p50: Math.round(q(stats.connectMs, 0.5)),
        p95: Math.round(q(stats.connectMs, 0.95)),
        max: Math.round(Math.max(...stats.connectMs)),
      },
      admitMs: {
        p50: Math.round(q(stats.admitMs, 0.5)),
        p95: Math.round(q(stats.admitMs, 0.95)),
        max: Math.round(Math.max(...stats.admitMs)),
      },
    },
    actividades: {
      salasCreadas: rooms.codes.length,
      roomJoins: stats.roomJoins,
      armasObtenidas: stats.weaponsGained,
      disparos: stats.shots,
      movimientosRecibidos_total: stats.movesIn,
      movimientosRecibidos_porSeg: stats.movesIn ? Math.round(stats.movesIn / (elapsedMs / 1000)) : 0,
    },
    chat: {
      muestras: stats.chatSamples,
      rttMs: stats.chatRttMs.length
        ? { p50: Math.round(q(stats.chatRttMs, 0.5)), p95: Math.round(q(stats.chatRttMs, 0.95)), max: Math.round(Math.max(...stats.chatRttMs)) }
        : null,
    },
    estabilidad: {
      roomErrors: stats.roomErrors,
      disconnectsInesperados: stats.unexpectedDisconnects,
      sesionesHealthz: sessions,
      rssMB,
    },
  },
};

console.log(`\nLOAD_RESULT ${JSON.stringify(result)}`);
for (const b of bots) b.sock.close?.();
process.exit(0);