const waiting = new Set();
const pairs = new Map();

function pickPeer() {
  for (const id of waiting) {
    waiting.delete(id);
    return id;
  }
  return null;
}

export function setupSpikeSignaling(io) {
  io.on("connection", (socket) => {
    socket.on("spike:join", () => {
      const peer = pickPeer();
      if (peer) {
        pairs.set(socket.id, peer);
        pairs.set(peer, socket.id);
        io.to(socket.id).emit("spike:paired", { peerId: peer, initiator: true });
        io.to(peer).emit("spike:paired", { peerId: socket.id, initiator: false });
      } else {
        waiting.add(socket.id);
      }
    });

    socket.on("spike:sdp", (msg) => {
      if (msg && msg.target) {
        io.to(msg.target).emit("spike:sdp", { sdp: msg.sdp, from: socket.id });
      }
    });

    socket.on("spike:ice", (msg) => {
      if (msg && msg.target) {
        io.to(msg.target).emit("spike:ice", { candidate: msg.candidate, from: socket.id });
      }
    });

    socket.on("disconnect", () => {
      waiting.delete(socket.id);
      const peer = pairs.get(socket.id);
      if (peer) {
        pairs.delete(socket.id);
        pairs.delete(peer);
        io.to(peer).emit("spike:peer-left");
      }
    });
  });
}