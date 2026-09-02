const BOUNDARY = 20;

const COLORS = [
  "#f87171", "#fb923c", "#facc15", "#4ade80", "#2dd4bf",
  "#60a5fa", "#a78bfa", "#f472b6", "#fbbf24", "#34d399",
];

const players = new Map();

function clampPosition(value) {
  const limit = BOUNDARY - 0.5;
  return Math.max(-limit, Math.min(limit, value));
}

function spawnSeat() {
  const offset = 3 + Math.random() * 12;
  const angle = Math.random() * Math.PI * 2;
  return {
    x: Math.cos(angle) * offset,
    z: Math.sin(angle) * offset,
  };
}

export function setupGame(io) {
  io.on("connection", (socket) => {
    socket.on("player:join", ({ name } = {}) => {
      if (players.has(socket.id)) return;

      const safeName = String(name || "").trim().slice(0, 20) || "Anónimo";
      const seat = spawnSeat();
      const player = {
        id: socket.id,
        name: safeName,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        x: seat.x,
        z: seat.z,
      };

      players.set(socket.id, player);
      socket.emit("welcome", { id: socket.id, players: [...players.values()] });
      socket.broadcast.emit("player:joined", player);
      console.log(`[game] ${safeName} entró (${socket.id})`);
    });

    socket.on("player:move", ({ x, z } = {}) => {
      const player = players.get(socket.id);
      if (!player || typeof x !== "number" || typeof z !== "number") return;

      player.x = clampPosition(x);
      player.z = clampPosition(z);
      socket.broadcast.emit("player:moved", { id: socket.id, x: player.x, z: player.z });
    });

    socket.on("chat:message", ({ text } = {}) => {
      const player = players.get(socket.id);
      if (!player) return;

      const clean = String(text || "").trim().slice(0, 200);
      if (!clean) return;

      io.emit("chat:message", { id: socket.id, name: player.name, text: clean, time: Date.now() });
    });

    socket.on("disconnect", () => {
      const player = players.get(socket.id);
      if (!player) return;

      players.delete(socket.id);
      socket.broadcast.emit("player:left", { id: socket.id });
      console.log(`[game] ${player.name} salió`);
    });
  });
}