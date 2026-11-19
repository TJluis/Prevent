// HUD no modal del TNT Run (Ola 3).
//
// Pinta fase, reloj, jugadores en pie, capa actual y bloques pisados. El estado
// y los eventos llegan del servidor por `mode:state` / `mode:event`; aquí solo
// se muestran y se envían intenciones («Listo» y «salir»).

const PHASE_LABEL = {
  waiting: "Esperando jugadores",
  countdown: "¡Prepárate!",
  playing: "La isla se derrumba",
  result: "Partida terminada",
};

export function createTntHud({ getMyId, onReady, onLeave } = {}) {
  const root = document.getElementById("tnt-hud");
  if (!root) return null;

  const phaseEl = document.getElementById("tnt-hud-phase");
  const timerEl = document.getElementById("tnt-hud-timer");
  const aliveEl = document.getElementById("tnt-hud-alive");
  const layerEl = document.getElementById("tnt-hud-layer");
  const noteEl = document.getElementById("tnt-hud-note");
  const readyBtn = document.getElementById("tnt-hud-ready");
  const closeBtn = document.getElementById("tnt-hud-close");
  const flashEl = document.getElementById("tnt-hud-flash");
  const resultEl = document.getElementById("tnt-hud-result");

  if (closeBtn) closeBtn.addEventListener("click", () => onLeave && onLeave());
  if (readyBtn) readyBtn.addEventListener("click", () => onReady && onReady());

  let state = null;
  let flash = "";
  let flashUntil = 0;

  function myEntry() {
    if (!state) return null;
    const id = getMyId ? getMyId() : null;
    return (state.players || []).find((player) => player.id === id) || null;
  }

  function nameOf(id) {
    const entry = (state && state.players || []).find((player) => player.id === id);
    return entry ? entry.name : id;
  }

  function remainingSeconds() {
    if (!state) return 0;
    const ms =
      state.phase === "countdown"
        ? state.countdownMs
        : state.phase === "playing"
          ? state.remainingMs
          : state.phase === "result"
            ? state.resultMs
            : 0;
    return Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  }

  function render() {
    if (!state) return;

    phaseEl.textContent = PHASE_LABEL[state.phase] || "";
    const secs = remainingSeconds();
    timerEl.textContent = secs > 0 ? `${secs}s` : "";
    timerEl.hidden = secs <= 0;

    const mine = myEntry();
    aliveEl.textContent =
      state.phase === "waiting"
        ? `${(state.players || []).length}/${state.maxPlayers} en sala`
        : `${(state.alive || []).length} en pie · ${(state.players || []).length} jugando`;
    layerEl.textContent = mine
      ? `Capa ${Math.max(0, mine.layer) + 1}/5 · ${mine.blocks || 0} bloques`
      : "";
    layerEl.hidden = !mine;

    const canReady = state.phase === "waiting" || state.phase === "result";
    readyBtn.hidden = !canReady;
    readyBtn.disabled = !canReady;
    readyBtn.textContent = mine && mine.ready && state.phase === "waiting" ? "Cancelar listo" : "Listo";
    readyBtn.classList.toggle("is-ready", !!(mine && mine.ready && state.phase === "waiting"));

    if (mine && mine.offline) {
      noteEl.textContent = "Desconectado: tu plaza está reservada 45 s.";
    } else if (state.phase === "waiting" || state.phase === "result") {
      noteEl.textContent = `Mínimo ${state.minPlayers} jugadores. El suelo cae 600 ms después de pisarlo.`;
    } else if (state.phase === "countdown") {
      noteEl.textContent = "Sal de la capa superior cuando empiece. No hay salto en este modo.";
    } else {
      noteEl.textContent = mine && mine.eliminated
        ? "Has caído al vacío. Espera a la siguiente ronda."
        : "Cada bloque que pisas cae a los 600 ms. No te quedes quieto.";
    }

    if (Date.now() > flashUntil) flash = "";
    flashEl.hidden = !flash;
    flashEl.textContent = flash;

    if (state.phase === "result" && state.winner) {
      resultEl.hidden = false;
      const won = state.winner.id && state.winner.id === (mine && mine.id);
      const who = state.winner.name || "Nadie";
      const reason =
        state.winner.reason === "time" ? " por altura" : state.winner.reason === "draw" ? " (empate)" : "";
      resultEl.textContent = `${who} gana${reason} · ${won ? "¡Tú ganas!" : "Mala suerte"}`;
    } else {
      resultEl.hidden = true;
      resultEl.textContent = "";
    }
  }

  function show() {
    root.hidden = false;
    render();
  }

  function hide() {
    root.hidden = true;
    state = null;
    flash = "";
  }

  function isOpen() {
    return !root.hidden;
  }

  function setState(next) {
    state = next || null;
    render();
  }

  function event(ev) {
    if (!ev || !state) return;
    if (ev.type === "blockFall" && ev.indices && ev.indices.length) {
      flash = `💥 Caen ${ev.indices.length} bloque${ev.indices.length === 1 ? "" : "s"}`;
      flashUntil = Date.now() + 1400;
      render();
      return;
    }
    if (ev.type === "playerFall") {
      if (ev.eliminated) flash = `🍂 ${nameOf(ev.playerId)} cayó al vacío`;
      else flash = `⬇️ ${nameOf(ev.playerId)} bajó a la capa ${ev.toLayer + 1}`;
      flashUntil = Date.now() + 1800;
      render();
    }
  }

  return {
    show,
    hide,
    isOpen,
    setState,
    event,
    getState: () => state,
  };
}
