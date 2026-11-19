// HUD no modal del Coliseo melee (Ola 2).
//
// Muestra marcador por bando, ronda, fase, temporizador, selector de arma y
// botón de Listo. El estado siempre viene del servidor: este módulo solo pinta
// y manda intenciones (`weapon`, `ready`). Las acciones de combate siguen por
// el canal normal de disparos.

import { COLISEO_WEAPONS, COLISEO_DEFAULT_WEAPON } from "./coliseoDefs.js";

const PHASE_LABEL = {
  waiting: "Esperando jugadores",
  countdown: "Cuenta atrás",
  fight: "En combate",
  roundEnd: "Fin de ronda",
  matchEnd: "Partida terminada",
};

export function createColiseoHud({ getMyId, onWeapon, onReady, onLeave }) {
  const root = document.getElementById("coliseo-hud");
  if (!root) return null;

  const variantEl = document.getElementById("coliseo-hud-variant");
  const phaseEl = document.getElementById("coliseo-hud-phase");
  const timerEl = document.getElementById("coliseo-hud-timer");
  const scoresEl = document.getElementById("coliseo-hud-scores");
  const weaponsEl = document.getElementById("coliseo-hud-weapons");
  const readyBtn = document.getElementById("coliseo-hud-ready");
  const noteEl = document.getElementById("coliseo-hud-note");
  const countdownEl = document.getElementById("coliseo-hud-countdown");
  const closeBtn = document.getElementById("coliseo-hud-close");

  const weaponButtons = new Map();
  for (const weapon of COLISEO_WEAPONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "coliseo-weapon";
    btn.dataset.weapon = weapon.id;
    btn.title = weapon.hint;
    const name = document.createElement("b");
    name.textContent = weapon.name;
    const hint = document.createElement("span");
    hint.textContent = weapon.hint;
    btn.append(name, hint);
    btn.addEventListener("click", () => {
      selected = weapon.id;
      render();
      if (onWeapon) onWeapon(weapon.id);
    });
    weaponsEl.append(btn);
    weaponButtons.set(weapon.id, btn);
  }

  if (closeBtn) closeBtn.addEventListener("click", () => onLeave && onLeave());
  if (readyBtn) readyBtn.addEventListener("click", () => onReady && onReady());

  let state = null;
  let selected = COLISEO_DEFAULT_WEAPON;

  function myEntry() {
    if (!state) return null;
    const id = getMyId ? getMyId() : null;
    return (state.players || []).find((player) => player.id === id) || null;
  }

  function remainingSeconds() {
    if (!state) return 0;
    const ms =
      state.phase === "countdown"
        ? state.countdownMs
        : state.phase === "fight"
          ? state.fightMs
          : state.phase === "matchEnd"
            ? state.restartMs
            : 0;
    return Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  }

  function renderScores() {
    scoresEl.innerHTML = "";
    if (!state) return;
    const mine = myEntry();
    for (const entry of state.scores || []) {
      const row = document.createElement("div");
      row.className = "coliseo-score";
      if (!entry.alive) row.classList.add("is-dead");
      if (mine && Array.isArray(entry.members) && entry.members.includes(mine.id)) {
        row.classList.add("is-mine");
      }
      row.style.setProperty("--side-color", entry.color || "#dbeafe");

      const head = document.createElement("div");
      head.className = "coliseo-score-head";
      const name = document.createElement("span");
      name.className = "coliseo-score-name";
      name.textContent = entry.name || entry.id;
      const points = document.createElement("span");
      points.className = "coliseo-score-points";
      points.textContent = `${entry.score || 0}/${state.roundsToWin}`;
      head.append(name, points);

      const pips = document.createElement("div");
      pips.className = "coliseo-score-pips";
      for (let i = 0; i < state.roundsToWin; i++) {
        const pip = document.createElement("span");
        pip.className = "coliseo-pip" + (i < (entry.score || 0) ? " is-on" : "");
        pips.append(pip);
      }

      row.append(head, pips);
      scoresEl.append(row);
    }
  }

  function render() {
    if (!state) return;

    variantEl.textContent = state.variant || "";
    phaseEl.textContent = PHASE_LABEL[state.phase] || "";
    const secs = remainingSeconds();
    timerEl.textContent = secs > 0 ? `${secs}s` : "";
    timerEl.hidden = secs <= 0;
    countdownEl.hidden = state.phase !== "countdown" || secs <= 0;
    countdownEl.textContent = secs > 0 ? String(secs) : "";

    const mine = myEntry();
    const locked = state.phase === "fight" || state.phase === "matchEnd";
    // Mientras se espera, el servidor es la fuente del arma elegida; el clic
    // local solo adelanta el resaltado.
    if (mine && !locked && mine.weaponId) selected = mine.weaponId;
    for (const [id, btn] of weaponButtons) {
      btn.classList.toggle("is-selected", id === selected);
      btn.disabled = locked;
    }

    const waiting = state.phase === "waiting";
    readyBtn.hidden = state.phase === "matchEnd";
    readyBtn.disabled = !waiting;
    readyBtn.textContent = mine && mine.ready ? "Cancelar listo" : "Listo";
    readyBtn.classList.toggle("is-ready", !!(mine && mine.ready));

    if (state.phase === "waiting") {
      const count = (state.players || []).length;
      noteEl.textContent = `${count}/${state.maxPlayers} en sala · elige arma y pulsa Listo`;
    } else if (state.phase === "countdown") {
      noteEl.textContent = "Preparados…";
    } else if (state.phase === "fight") {
      noteEl.textContent = `Primero a ${state.roundsToWin} rondas`;
    } else if (state.phase === "roundEnd") {
      noteEl.textContent =
        state.lastRound && state.lastRound.winner ? "Ronda decidida" : "Ronda empatada";
    } else if (state.phase === "matchEnd") {
      noteEl.textContent = state.winner ? `Gana ${state.winner.name}` : "Partida terminada";
    } else {
      noteEl.textContent = "";
    }

    renderScores();
  }

  function show(variant) {
    root.hidden = false;
    if (variant) variantEl.textContent = variant;
    render();
  }

  function hide() {
    root.hidden = true;
    state = null;
  }

  function isOpen() {
    return !root.hidden;
  }

  function setState(next) {
    state = next || null;
    render();
  }

  // El estado completo llega con cada `mode:state`; los eventos solo añaden
  // contexto, así que no hace falta lógica extra aquí.
  function event() {}

  return {
    show,
    hide,
    isOpen,
    setState,
    event,
    getState: () => state,
    getSelectedWeapon: () => selected,
  };
}
