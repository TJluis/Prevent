let socket;

export function connectToGame({ name, onWelcome, onJoined, onMoved, onLeft, onChat }) {
  socket = io();

  socket.on("connect", () => {
    socket.emit("player:join", { name });
  });

  socket.on("welcome", (message) => onWelcome(message));
  socket.on("player:joined", (player) => onJoined(player));
  socket.on("player:moved", (message) => onMoved(message));
  socket.on("player:left", (message) => onLeft(message));
  socket.on("chat:message", (message) => onChat(message));
}

export function sendMove(x, z) {
  if (socket) {
    socket.emit("player:move", { x, z });
  }
}

export function sendChat(text) {
  if (socket) {
    socket.emit("chat:message", { text });
  }
}