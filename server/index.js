import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { setupSpikeSignaling } from "./spike.js";
import { setupGame } from "./game.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static(path.join(__dirname, "..", "public")));
app.use(
  "/vendor/three",
  express.static(path.join(__dirname, "..", "node_modules", "three", "build"))
);

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/spike", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "spike.html"));
});

io.on("connection", (socket) => {
  console.log(`[socket] cliente conectado: ${socket.id}`);
});

setupSpikeSignaling(io);
setupGame(io);

httpServer.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});