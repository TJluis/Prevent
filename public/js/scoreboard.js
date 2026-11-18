// Marcador de la zona: chip de puntos junto al HUD y tabla de los mejores.
// Los datos llegan del servidor (score:state / score:update), nunca se calculan
// aquí: el cliente solo presenta.

const MEDALS = ["🥇", "🥈", "🥉", "4.º", "5.º", "6.º", "7.º", "8.º"];

function normalize(entry) {
  return {
    id: entry.id || entry.playerId,
    name: entry.name || "—",
    score: Number(entry.score) || 0,
    kills: Number(entry.kills) || 0,
    deaths: Number(entry.deaths) || 0,
    streak: Number(entry.streak) || 0,
  };
}

export function createScoreboard({ getMyId } = {}) {
  const hud = document.getElementById("score-hud");
  const valueEl = document.getElementById("score-value");
  const streakEl = document.getElementById("score-streak");
  const panel = document.getElementById("scoreboard-panel");
  const body = document.getElementById("scoreboard-body");
  const closeBtn = document.getElementById("scoreboard-close");

  let players = [];
  let open = false;
  let enabled = false;
  let inRoom = false;

  function myId() {
    return getMyId ? getMyId() : null;
  }

  function sortedPlayers() {
    return [...players].sort((a, b) => b.score - a.score || b.kills - a.kills);
  }

  function renderHud() {
    const me = players.find((p) => p.id === myId());
    if (valueEl) valueEl.textContent = String(me ? me.score : 0);
    if (streakEl) {
      const streak = me ? me.streak : 0;
      streakEl.hidden = streak < 2;
      streakEl.textContent = streak >= 2 ? `🔥 x${streak}` : "";
    }
  }

  function renderTable() {
    if (!body) return;
    body.innerHTML = "";
    const list = sortedPlayers().slice(0, 8);
    if (!list.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.className = "scoreboard-empty";
      td.textContent = inRoom ? "Aún no hay puntos en esta sala." : "Entra a una sala para competir.";
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }
    list.forEach((player, index) => {
      const tr = document.createElement("tr");
      if (player.id === myId()) tr.className = "me";
      const cells = [
        MEDALS[index] || String(index + 1),
        player.name,
        player.kills,
        player.deaths,
        player.score,
      ];
      for (const value of cells) {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.appendChild(td);
      }
      body.appendChild(tr);
    });
  }

  function render() {
    renderHud();
    renderTable();
  }

  function setState(list) {
    players = Array.isArray(list) ? list.map(normalize) : [];
    render();
  }

  function update(entry) {
    if (!entry) return;
    const next = normalize(entry);
    const index = players.findIndex((p) => p.id === next.id);
    if (index >= 0) players[index] = { ...players[index], ...next };
    else players.push(next);
    render();
  }

  function add(player) {
    if (!player || !player.id) return;
    if (!players.some((p) => p.id === player.id)) {
      players.push(normalize(player));
      render();
    }
  }

  function remove(id) {
    const before = players.length;
    players = players.filter((p) => p.id !== id);
    if (players.length !== before) render();
  }

  function clear() {
    players = [];
    render();
  }

  function setEnabled(on) {
    enabled = !!on;
    if (hud) hud.hidden = !enabled;
    if (!enabled) hide();
    render();
  }

  function setRoom(value) {
    inRoom = !!value;
    if (!inRoom) hide();
    render();
  }

  function show() {
    if (!enabled || !inRoom) return false;
    open = true;
    if (panel) panel.hidden = false;
    render();
    return true;
  }

  function hide() {
    open = false;
    if (panel) panel.hidden = true;
  }

  function toggle() {
    if (open) {
      hide();
      return true;
    }
    return show();
  }

  const onClose = () => hide();
  if (closeBtn) closeBtn.addEventListener("click", onClose);

  function dispose() {
    hide();
    if (closeBtn) closeBtn.removeEventListener("click", onClose);
    if (hud) hud.hidden = true;
    players = [];
  }

  return {
    setEnabled,
    setRoom,
    setState,
    update,
    add,
    remove,
    clear,
    show,
    hide,
    toggle,
    isOpen: () => open,
    isEnabled: () => enabled,
    render,
    dispose,
  };
}
