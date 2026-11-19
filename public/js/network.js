let socket;

export function connectToGame({
  token,
  name,
  appearance = null,
  onWelcome,
  onJoined,
  onMoved,
  onLeft,
  onChat,
  onChatHistory,
  onRoomState,
  onRoomList,
  onRoomKicked,
  onRoomClosed,
  onRoomOwnerChanged,
  onRoomError,
  onVoiceSignal,
  onCombatShot,
  onCombatBoom,
  onCombatEliminated,
  onCombatRevived,
  onCombatRegen,
  onCombatSlow,
  onCombatHeal,
  onCombatBlock,
  onCombatBlocked,
  onCrystalState,
  onCrystalOffer,
  onCrystalError,
  onCrystalEquip,
  onInventoryUpdate,
  onInventoryToast,
  onItemSpawn,
  onHockeyState,
  onHockeyGoal,
  onScoreUpdate,
  onScoreState,
  onScoreProfile,
  onShopResult,
  onModeState,
  onModeEvent,
  onModeError,
  onGameFull,
  onDisconnect,
  onConnectError,
}) {
  socket = io({ auth: { token } });

  socket.on("connect", () => {
    socket.emit("player:join", { name, appearance });
    if (onConnectError) onConnectError("");
  });

  socket.on("connect_error", () => {
    if (onConnectError) onConnectError("No se pudo conectar al servidor. Reintentando…");
  });

  socket.on("disconnect", () => {
    if (onDisconnect) onDisconnect();
  });

  socket.on("game:full", (data) => {
    if (onGameFull) onGameFull(data && data.error ? data.error : "El lobby está lleno.");
  });

  socket.on("welcome", (message) => onWelcome(message));
  socket.on("player:joined", (player) => onJoined(player));
  socket.on("player:moved", (message) => onMoved(message));
  socket.on("player:left", (message) => onLeft(message));
  socket.on("chat:message", (message) => onChat(message));
  socket.on("chat:history", (messages) => onChatHistory(messages));
  socket.on("room:state", (data) => onRoomState(data));
  socket.on("room:list", (data) => onRoomList(data));
  socket.on("room:kicked", (data) => onRoomKicked(data));
  socket.on("room:closed", (data) => onRoomClosed(data));
  socket.on("room:ownerChanged", (data) => onRoomOwnerChanged(data));
  socket.on("room:error", (data) => onRoomError(data));
  socket.on("voice:signal", (data) => onVoiceSignal(data));
  socket.on("combat:shot", (data) => onCombatShot(data));
  socket.on("combat:boom", (data) => onCombatBoom(data));
  socket.on("combat:eliminated", (data) => onCombatEliminated(data));
  socket.on("combat:revived", (data) => onCombatRevived(data));
  socket.on("combat:regen", (data) => onCombatRegen(data));
  socket.on("combat:slow", (data) => onCombatSlow(data));
  socket.on("combat:heal", (data) => onCombatHeal(data));
  socket.on("combat:block", (data) => onCombatBlock(data));
  socket.on("combat:blocked", (data) => onCombatBlocked(data));
  socket.on("crystal:state", (data) => onCrystalState(data));
  socket.on("crystal:offer", (data) => onCrystalOffer(data));
  socket.on("crystal:error", (data) => onCrystalError(data));
  socket.on("crystal:equip", (data) => onCrystalEquip(data));
  socket.on("inventory:update", (data) => onInventoryUpdate(data));
  socket.on("inventory:toast", (data) => onInventoryToast(data));
  socket.on("item:spawn", (data) => onItemSpawn(data));
  socket.on("hockey:state", (data) => onHockeyState(data));
  socket.on("hockey:goal", (data) => onHockeyGoal(data));
  socket.on("score:update", (data) => onScoreUpdate && onScoreUpdate(data));
  socket.on("score:state", (data) => onScoreState && onScoreState(data));
  socket.on("score:profile", (data) => onScoreProfile && onScoreProfile(data));
  socket.on("shop:result", (data) => onShopResult && onShopResult(data));
  socket.on("mode:state", (data) => onModeState && onModeState(data));
  socket.on("mode:event", (data) => onModeEvent && onModeEvent(data));
  socket.on("mode:error", (data) => onModeError && onModeError(data));
}

export function sendMove(x, z, yaw, y = 0, sprint = false, slide = false) {
  if (socket) {
    socket.emit("player:move", { x, z, yaw, y, sprint, slide });
  }
}

export function sendChat(text) {
  if (socket) {
    socket.emit("chat:message", { text });
  }
}

export function createRoom(name, mapId) {
  if (socket) {
    socket.emit("room:create", { name, mapId });
  }
}

export function joinRoom(code) {
  if (socket) {
    socket.emit("room:join", { code });
  }
}

export function leaveRoom() {
  if (socket) {
    socket.emit("room:leave");
  }
}

export function kickPlayer(targetId) {
  if (socket) {
    socket.emit("room:kick", { targetId });
  }
}

export function closeRoom() {
  if (socket) {
    socket.emit("room:close");
  }
}

export function sendVoiceSignal(type, target, details) {
  if (socket) {
    socket.emit("voice:signal", { type, target, ...details });
  }
}

export function sendShoot(dx, dz) {
  if (socket) {
    socket.emit("combat:shoot", { dx, dz });
  }
}

export function sendBlock(on, yaw) {
  if (socket) {
    socket.emit("combat:block", { on: !!on, yaw });
  }
}

export function sendCrystalOffer(crystalId) {
  if (socket) {
    socket.emit("crystal:offer", { crystalId });
  }
}

export function sendCrystalRespond(crystalId, accept) {
  if (socket) {
    socket.emit("crystal:respond", { crystalId, accept });
  }
}

export function sendInventoryUse(slot, item) {
  if (socket) {
    socket.emit("inventory:use", { slot, id: item && item.id, type: item && item.type });
  }
}

export function sendInventoryThrow(slot, item, dx, dz) {
  if (socket) {
    socket.emit("inventory:throw", {
      slot,
      id: item && item.id,
      type: item && item.type,
      dx,
      dz,
    });
  }
}

export function leaveServer() {
  if (socket) {
    socket.disconnect();
    socket = undefined;
  }
}

export function buyWeapon(weaponId) {
  if (socket) {
    socket.emit("shop:buy", { weaponId });
  }
}

// --- Minijuegos -------------------------------------------------------------

export function enterHub() {
  if (socket) socket.emit("hub:enter");
}

export function joinMode(modeId, variant) {
  if (socket) socket.emit("mode:join", variant ? { modeId, variant } : { modeId });
}

export function leaveMode() {
  if (socket) socket.emit("mode:leave");
}

export function sendModeAction(payload) {
  if (socket) socket.emit("mode:action", payload || {});
}