// Tablero DOM de "Encuentra los pares".
//
// La partida es autoritativa en el servidor: aquí solo se pinta el snapshot que
// llega por mode:state y se envían intenciones de voltear. El tablero vive en
// una capa DOM (no en el canvas 3D) para que sea fiable con ratón y táctil, y
// para que el estado oculto de las cartas nunca dependa del render 3D.

const CARD_BACK = "❔";

export function createPairsUI({ onFlip, onLeave, getMyId, notify } = {}) {
  const overlay = document.getElementById("pairs-overlay");
  const board = document.getElementById("pairs-board");
  const turnEl = document.getElementById("pairs-turn");
  const playersEl = document.getElementById("pairs-players");
  const noteEl = document.getElementById("pairs-note");
  const closeBtn = document.getElementById("pairs-close");

  let state = null;
  let open = false;
  const buttons = [];

  function myId() {
    return getMyId ? getMyId() : null;
  }

  function buildBoard() {
    if (!board || buttons.length) return;
    for (let i = 0; i < 16; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pairs-card";
      button.dataset.index = String(i);
      button.textContent = CARD_BACK;
      button.setAttribute("aria-label", `Carta ${i + 1}, boca abajo`);
      board.appendChild(button);
      buttons.push(button);
    }
  }

  function myTurn() {
    return !!state && state.status === "playing" && state.turnId === myId() && !state.waitMs;
  }

  function nameOf(id) {
    if (!state) return "—";
    const player = (state.players || []).find((p) => p.id === id);
    if (!player) return "—";
    return player.id === myId() ? "ti" : player.name;
  }

  function renderBoard() {
    buildBoard();
    if (!state) return;
    const cards = state.cards || [];
    const canFlip = myTurn();
    buttons.forEach((button, index) => {
      const card = cards[index];
      const faceUp = !!card && (card.matched || card.flipped);
      button.textContent = faceUp && card.emoji ? card.emoji : CARD_BACK;
      button.classList.toggle("is-matched", !!(card && card.matched));
      button.classList.toggle("is-flipped", !!(card && card.flipped && !card.matched));
      button.classList.toggle("is-mine", canFlip && !faceUp);
      button.disabled = !canFlip || !card || card.matched || card.flipped;
      button.setAttribute(
        "aria-label",
        faceUp && card.emoji
          ? `Carta ${index + 1}, ${card.emoji}${card.matched ? ", pareja encontrada" : ""}`
          : `Carta ${index + 1}, boca abajo`
      );
    });
  }

  function renderPlayers() {
    if (!playersEl) return;
    playersEl.innerHTML = "";
    if (!state) return;
    const list = state.players || [];
    if (!list.length) {
      const empty = document.createElement("span");
      empty.className = "pairs-empty";
      empty.textContent = "Esperando jugadores…";
      playersEl.appendChild(empty);
      return;
    }
    for (const player of list) {
      const chip = document.createElement("span");
      chip.className = "pairs-player";
      if (player.id === myId()) chip.classList.add("is-me");
      if (player.id === state.turnId && state.status === "playing") chip.classList.add("is-turn");
      const name = document.createElement("b");
      name.textContent = player.id === myId() ? `${player.name} (ti)` : player.name;
      const score = document.createElement("span");
      score.textContent = ` · ${player.score} ${player.score === 1 ? "par" : "pares"}`;
      chip.append(name, score);
      playersEl.appendChild(chip);
    }
  }

  function renderStatus() {
    if (!turnEl || !state) return;
    if (state.status === "waiting") {
      turnEl.textContent = "Esperando jugadores…";
    } else if (state.status === "finished") {
      const ids = state.winnerIds || [];
      const others = ids.filter((id) => id !== myId()).map(nameOf);
      if (!ids.length) turnEl.textContent = "Ronda terminada";
      else if (ids.includes(myId())) {
        turnEl.textContent = others.length ? `¡Ganas tú y ${others.join(" y ")}!` : "¡Ganas tú!";
      } else {
        turnEl.textContent = `Ronda terminada: gana ${others.join(" y ")}`;
      }
    } else if (myTurn()) {
      turnEl.textContent = "Tu turno · voltea dos cartas";
    } else if (state.turnId === myId()) {
      // Espera del fallo: el turno sigue siendo mío pero aún no puedo voltear.
      turnEl.textContent = "Tu turno en un momento…";
    } else {
      turnEl.textContent = `Turno de ${nameOf(state.turnId)}`;
    }
  }

  function renderNote() {
    if (!noteEl || !state) return;
    if (state.status === "finished") {
      noteEl.textContent = "La siguiente ronda empieza en unos segundos…";
    } else if (state.waitMs) {
      noteEl.textContent = "No coinciden: memoriza y espera el cambio de turno.";
    } else {
      noteEl.textContent = "Si las dos cartas coinciden sumas un par y sigues jugando.";
    }
  }

  function render() {
    renderBoard();
    renderPlayers();
    renderStatus();
    renderNote();
  }

  function show() {
    open = true;
    if (overlay) overlay.hidden = false;
    render();
  }

  function hide() {
    open = false;
    if (overlay) overlay.hidden = true;
  }

  function setState(snapshot) {
    state = snapshot || null;
    if (!state) {
      hide();
      return;
    }
    render();
  }

  function event(payload) {
    if (!payload || !notify) return;
    if (payload.type === "match") {
      notify(`${payload.emoji || "✨"} ¡Pareja encontrada!`);
    } else if (payload.type === "win") {
      notify("🏆 ¡Tablero completado!");
    } else if (payload.type === "restart") {
      notify("Nueva ronda");
    }
  }

  const onBoardClick = (event_) => {
    const button = event_.target.closest && event_.target.closest(".pairs-card");
    if (!button || button.disabled) return;
    const index = Number(button.dataset.index);
    if (!Number.isInteger(index)) return;
    if (onFlip) onFlip(index);
  };
  const onCloseClick = () => {
    if (onLeave) onLeave();
  };

  if (board) board.addEventListener("click", onBoardClick);
  if (closeBtn) closeBtn.addEventListener("click", onCloseClick);
  buildBoard();

  function dispose() {
    hide();
    if (board) board.removeEventListener("click", onBoardClick);
    if (closeBtn) closeBtn.removeEventListener("click", onCloseClick);
    state = null;
  }

  return {
    show,
    hide,
    setState,
    event,
    render,
    dispose,
    isOpen: () => open,
    getState: () => state,
  };
}
