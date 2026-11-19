// HUD de "Encuentra los pares".
//
// Ya no hay tablero DOM: el tablero es 3D (pairsBoard.js) y el jugador camina
// por la arena. Este módulo solo pinta el estado que llega por `mode:state`
// (equipos, turno, cuenta atrás, marcador y pista) y ofrece el botón de salir.
// El contenedor no captura el ratón para que se pueda seguir jugando.

import { getPairsTeam, getPairsVariant } from "./pairsDefs.js";

export function createPairsHud({ onLeave, onZoomIn, onZoomOut, getMyId, notify } = {}) {
  const hud = document.getElementById("pairs-hud");
  const variantEl = document.getElementById("pairs-hud-variant");
  const turnEl = document.getElementById("pairs-hud-turn");
  const teamsEl = document.getElementById("pairs-hud-teams");
  const noteEl = document.getElementById("pairs-hud-note");
  const countdownEl = document.getElementById("pairs-hud-countdown");
  const closeBtn = document.getElementById("pairs-hud-close");
  const zoomInBtn = document.getElementById("pairs-hud-zoom-in");
  const zoomOutBtn = document.getElementById("pairs-hud-zoom-out");

  let state = null;
  let visible = false;
  let countdownLeft = 0;
  let local = { cardIndex: -1, padTeam: null };
  let shownVariant = null;

  function myId() {
    return getMyId ? getMyId() : null;
  }

  function teamOf(id) {
    if (!state || !id) return null;
    const player = (state.players || []).find((entry) => entry.id === id);
    return player ? player.team : null;
  }

  function getMyTeam() {
    return teamOf(myId());
  }

  function nameOf(id) {
    if (!state) return "—";
    const player = (state.players || []).find((entry) => entry.id === id);
    if (!player) return "—";
    return player.id === myId() ? "ti" : player.name;
  }

  function teamName(teamId) {
    const team = getPairsTeam(teamId);
    return team ? team.name : "Equipo";
  }

  function canFlipNow() {
    if (!state || state.status !== "playing") return false;
    if (state.waitMs > 0) return false;
    const team = getMyTeam();
    return !!team && state.turnTeam === team;
  }

  function status() {
    return state ? state.status : "idle";
  }

  function renderVariant() {
    if (!variantEl) return;
    const id = (state && state.variant) || shownVariant;
    const def = getPairsVariant(id);
    variantEl.textContent = def ? def.label : "";
    variantEl.hidden = !def;
  }

  function renderTeams() {
    if (!teamsEl) return;
    teamsEl.innerHTML = "";
    if (!state) return;
    const mine = getMyTeam();
    for (const team of state.teams || []) {
      const def = getPairsTeam(team.id);
      const chip = document.createElement("div");
      chip.className = "pairs-team";
      chip.style.setProperty("--team-color", (def && def.color) || team.color || "#7dd3fc");
      if (team.id === mine) chip.classList.add("is-mine");
      if (state.status === "playing" && state.turnTeam === team.id) chip.classList.add("is-turn");

      const head = document.createElement("div");
      head.className = "pairs-team-head";
      const name = document.createElement("b");
      name.textContent = (def && def.short) || team.short || team.name;
      const score = document.createElement("span");
      const pairs = team.score === 1 ? "par" : "pares";
      score.textContent = `${team.score} ${pairs}`;
      head.append(name, score);

      const members = document.createElement("div");
      members.className = "pairs-team-members";
      const names = (team.members || []).map(nameOf);
      members.textContent = names.length ? names.join(" · ") : "libre";

      chip.append(head, members);
      teamsEl.appendChild(chip);
    }
  }

  function renderTurn() {
    if (!turnEl) return;
    if (!state) {
      turnEl.textContent = "";
      return;
    }
    const mine = getMyTeam();
    if (state.status === "waiting") {
      turnEl.textContent = "Esperando equipos";
    } else if (state.status === "starting") {
      turnEl.textContent = "Preparados…";
    } else if (state.status === "finished") {
      const winners = (state.winnerTeams || []).map(teamName);
      turnEl.textContent = winners.length ? `Gana ${winners.join(" y ")}` : "Ronda terminada";
    } else if (state.turnTeam === mine) {
      turnEl.textContent = "Tu turno";
    } else if (state.turnTeam) {
      turnEl.textContent = `Turno de ${teamName(state.turnTeam)}`;
    } else {
      turnEl.textContent = "";
    }
  }

  function renderNote() {
    if (!noteEl) return;
    if (!state) {
      noteEl.textContent = "";
      return;
    }
    const mine = getMyTeam();
    if (state.status === "waiting") {
      if (!mine) {
        noteEl.textContent = "Pisa una plataforma (Cian o Rosa) para elegir equipo.";
      } else {
        noteEl.textContent = `Estás en ${teamName(mine)}. Esperando al otro equipo…`;
      }
      return;
    }
    if (state.status === "starting") {
      noteEl.textContent = "La partida empieza en unos segundos.";
      return;
    }
    if (state.status === "finished") {
      noteEl.textContent = "La siguiente ronda empieza en unos segundos…";
      return;
    }
    if (!mine) {
      noteEl.textContent = "Pisa una plataforma para elegir equipo.";
      return;
    }
    if (state.waitMs > 0) {
      noteEl.textContent = "No coinciden: memoriza y espera el cambio de turno.";
      return;
    }
    if (state.turnTeam !== mine) {
      noteEl.textContent = "Es el turno del otro equipo: observa y memoriza.";
      return;
    }
    if (local.cardIndex < 0) {
      noteEl.textContent = "Camina sobre una carta y salta (Espacio) para voltearla.";
      return;
    }
    noteEl.textContent = "¡Salta para voltear esta carta!";
  }

  function renderCountdown() {
    if (!countdownEl) return;
    if (!state || state.status !== "starting" || countdownLeft <= 0) {
      countdownEl.hidden = true;
      countdownEl.textContent = "";
      return;
    }
    countdownEl.hidden = false;
    countdownEl.textContent = String(Math.max(1, Math.ceil(countdownLeft)));
  }

  function render() {
    renderVariant();
    renderTeams();
    renderTurn();
    renderNote();
    renderCountdown();
  }

  function show(variantId) {
    if (variantId) shownVariant = variantId;
    visible = true;
    if (hud) hud.hidden = false;
    render();
  }

  function hide() {
    visible = false;
    if (hud) hud.hidden = true;
  }

  function setState(snapshot) {
    state = snapshot || null;
    if (!state) {
      countdownLeft = 0;
      render();
      return;
    }
    if (state.variant) shownVariant = state.variant;
    if (state.status === "starting") {
      countdownLeft = Math.max(0, Number(state.countdownMs) || 0) / 1000;
    } else {
      countdownLeft = 0;
    }
    render();
  }

  // Datos locales que no vienen del servidor: carta bajo los pies y plataforma.
  function setLocal(info) {
    const next = info || {};
    const cardIndex = Number.isInteger(next.cardIndex) ? next.cardIndex : -1;
    const padTeam = next.padTeam || null;
    if (cardIndex === local.cardIndex && padTeam === local.padTeam) return;
    local = { cardIndex, padTeam };
    if (visible) renderNote();
  }

  // Cuenta atrás local entre snapshots (el servidor solo emite al cambiar).
  function update(dt) {
    if (!visible || !state || state.status !== "starting") return;
    countdownLeft = Math.max(0, countdownLeft - (Number(dt) || 0));
    renderCountdown();
  }

  function event(payload) {
    if (!payload || !notify) return;
    if (payload.type === "match") {
      const emoji = payload.emoji || "✨";
      notify(`${emoji} ${teamName(payload.team)} suma un par`, 2000);
    } else if (payload.type === "win") {
      const winners = (payload.winnerTeams || []).map(teamName);
      notify(`🏆 ${winners.length ? `Gana ${winners.join(" y ")}` : "Ronda terminada"}`, 2600);
    } else if (payload.type === "timeout") {
      notify(`⏱️ Se acabó el turno de ${teamName(payload.team)}`, 2000);
    } else if (payload.type === "pause") {
      notify("Partida en pausa: faltan jugadores", 2200);
    }
  }

  const onCloseClick = () => {
    if (onLeave) onLeave();
  };
  if (closeBtn) closeBtn.addEventListener("click", onCloseClick);

  const onZoomInClick = () => {
    if (onZoomIn) onZoomIn();
  };
  const onZoomOutClick = () => {
    if (onZoomOut) onZoomOut();
  };
  if (zoomInBtn) zoomInBtn.addEventListener("click", onZoomInClick);
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", onZoomOutClick);

  function dispose() {
    hide();
    if (closeBtn) closeBtn.removeEventListener("click", onCloseClick);
    if (zoomInBtn) zoomInBtn.removeEventListener("click", onZoomInClick);
    if (zoomOutBtn) zoomOutBtn.removeEventListener("click", onZoomOutClick);
    state = null;
    local = { cardIndex: -1, padTeam: null };
  }

  return {
    show,
    hide,
    setState,
    setLocal,
    update,
    event,
    render,
    dispose,
    getMyTeam,
    canFlipNow,
    status,
    getState: () => state,
    isOpen: () => visible,
  };
}
