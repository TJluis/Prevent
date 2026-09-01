const statusEl = document.getElementById("server-status");

const socket = io();

socket.on("connect", () => {
  statusEl.textContent = "Conectado al servidor. Fase 0 lista.";
  statusEl.style.color = "#4ade80";
});

socket.on("disconnect", () => {
  statusEl.textContent = "Desconectado del servidor.";
  statusEl.style.color = "#f87171";
});