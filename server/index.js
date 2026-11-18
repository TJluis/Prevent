import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { setupSpikeSignaling } from "./spike.js";
import { setupGame } from "./game.js";
import { authRouter, createSocketAuthMiddleware } from "./auth.js";
import { checkDb, countSessions, pruneExpiredSessions, closeDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const ENABLE_SPIKE = process.env.ENABLE_SPIKE === "1";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  transports: ["websocket", "polling"],
});

app.disable("x-powered-by");
app.set("trust proxy", 1);

pruneExpiredSessions();
setInterval(pruneExpiredSessions, 60 * 60 * 1000).unref();

io.use(createSocketAuthMiddleware());

app.use("/api", authRouter());
// Recursos de imagen: cache largo solo en /assets (7 días). El resto de
// estáticos (HTML, JS, CSS) sigue con la caché por defecto para que los
// cambios se vean al recargar.
app.use(
  "/assets",
  express.static(path.join(__dirname, "..", "public", "assets"), {
    maxAge: "7d",
    fallthrough: true,
  })
);
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(
  "/vendor/three",
  express.static(path.join(__dirname, "..", "node_modules", "three", "build"))
);
// Addons de three (GLTFLoader, DRACOLoader, SkeletonUtils, BufferGeometryUtils,
// decoders de draco/ktx2, RoomEnvironment...) — pendiente en la skill blender-gltf-pipeline.
app.use(
  "/vendor/three/examples",
  express.static(path.join(__dirname, "..", "node_modules", "three", "examples"), {
    index: false,
  })
);

app.get("/healthz", (_req, res) => {
  if (!checkDb()) return res.status(503).json({ ok: false, db: "error" });
  res.json({ ok: true, sessions: countSessions() });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

if (ENABLE_SPIKE) {
  app.get("/spike", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "spike.html"));
  });
}

// 404 amigable: JSON para la API, HTML (default de Express) para el resto
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Ruta no encontrada." });
  }
  next();
});

// Errores de rutas (body JSON inválido, etc.) → respuesta JSON en vez de HTML
app.use((err, _req, res, _next) => {
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Body JSON inválido." });
  }
  console.error("[error]", err);
  res.status(500).json({ error: "Error interno del servidor." });
});

io.on("connection", (socket) => {
  console.log(`[socket] cliente conectado: ${socket.id}`);
});

if (ENABLE_SPIKE) {
  setupSpikeSignaling(io);
}
setupGame(io);

httpServer.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`El puerto ${PORT} ya está en uso. Detén el otro proceso o usa PORT=<otro> npm start.`);
  } else {
    console.error("[server] error HTTP:", err);
  }
  process.exit(1);
});

httpServer.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});

// Apagado limpio: cierra HTTP + socket.io y libera SQLite (evita .db-wal/.db-shm atascados)
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} recibido. Cerrando servidor...`);
  io.close();
  httpServer.close(() => {
    closeDb();
    console.log("Servidor detenido.");
    process.exit(0);
  });
  setTimeout(() => {
    closeDb();
    process.exit(1);
  }, 4000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});