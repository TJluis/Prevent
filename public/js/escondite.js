// HUD no modal del Escondite (Ola 2).
//
// Pinta fase, rol, reloj, escondidos que quedan y las habilidades del buscador
// (pulso y etiqueta) y de los escondidos (esquiva). El estado siempre viene del
// servidor; este módulo solo muestra y manda intenciones.

import { HIDE_ROLES, hideRoleColor } from "./hideDefs.js";

const PHASE_LABEL = {
  waiting: "Esperando jugadores",
  hide: "Los escondidos corren",
  seek: "El buscador ya sale",
  result: "Partida terminada",
};

export function createEsconditeHud({
  getMyId,
  onReady,
  onLeave,
  onDash,
  onPulse,
  onTag,
} = {}) {
  const root = document.getElementById("escondite-hud");
  if (!root) return null;

  const phaseEl = document.getElementById("escondite-hud-phase");
  const timerEl = document.getElementById("escondite-hud-timer");
  const roleEl = document.getElementById("escondite-hud-role");
  const hidersEl = document.getElementById("escondite-hud-hiders");
  const noteEl = document.getElementById("escondite-hud-note");
  const readyBtn = document.getElementById("escondite-hud-ready");
  const dashBtn = document.getElementById("escondite-hud-dash");
  const pulseBtn = document.getElementById("escondite-hud-pulse");
  const tagBtn = document.getElementById("escondite-hud-tag");
  const closeBtn = document.getElementById("escondite-hud-close");
  const detectedEl = document.getElementById("escondite-hud-detected");
  const resultEl = document.getElementById("escondite-hud-result");

  if (closeBtn) closeBtn.addEventListener("click", () => onLeave && onLeave());
  if (readyBtn) readyBtn.addEventListener("click", () => onReady && onReady());
  if (dashBtn) dashBtn.addEventListener("click", () => onDash && onDash());
  if (pulseBtn) pulseBtn.addEventListener("click", () => onPulse && onPulse());
  if (tagBtn) tagBtn.addEventListener("click", () => onTag && onTag());

  let state = null;
  let detected = [];
  let detectedUntil = 0;

  function myEntry() {
    if (!state) return null;
    const id = getMyId ? getMyId() : null;
    return (state.players || []).find((player) => player.id === id) || null;
  }

  function remainingSeconds() {
    if (!state) return 0;
    const ms =
      state.phase === "hide"
        ? state.hideMs
        : state.phase === "seek"
          ? state.seekMs
          : state.phase === "result"
            ? state.resultMs
            : 0;
    return Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  }

  function nameOf(id) {
    const entry = (state.players || []).find((player) => player.id === id);
    return entry ? entry.name : id;
  }

  function render() {
    if (!state) return;

    phaseEl.textContent = PHASE_LABEL[state.phase] || "";
    const secs = remainingSeconds();
    timerEl.textContent = secs > 0 ? `${secs}s` : "";
    timerEl.hidden = secs <= 0;

    const mine = myEntry();
    const role = mine && mine.role ? HIDE_ROLES[mine.role] : null;
    roleEl.textContent = role ? `${role.icon} ${role.name}` : "Sin rol";
    roleEl.style.setProperty("--role-color", hideRoleColor(mine && mine.role));
    roleEl.hidden = !role;

    hidersEl.textContent =
      state.phase === "waiting"
        ? `${(state.players || []).length}/${state.maxPlayers} en sala`
        : `${state.remainingHiders}/${state.totalHiders} escondidos`;
    hidersEl.hidden = state.phase === "result";

    readyBtn.hidden = state.phase !== "waiting";
    readyBtn.disabled = state.phase !== "waiting";
    readyBtn.textContent = mine && mine.ready ? "Cancelar listo" : "Listo";
    readyBtn.classList.toggle("is-ready", !!(mine && mine.ready));

    const isHider = !!(mine && mine.role === "hider");
    const isSeeker = !!(mine && mine.role === "seeker");
    const inRound = state.phase === "hide" || state.phase === "seek";

    dashBtn.hidden = !isHider;
    dashBtn.disabled = !inRound || !mine || mine.dashes <= 0;
    dashBtn.textContent = `Esquivar (G) · ${mine ? mine.dashes : 0}`;

    pulseBtn.hidden = !isSeeker;
    pulseBtn.disabled = state.phase !== "seek" || !mine || mine.pulseMs > 0;
    pulseBtn.textContent =
      mine && mine.pulseMs > 0
        ? `Pulso (G) · ${Math.ceil(mine.pulseMs / 1000)}s`
        : "Pulso (G)";

    tagBtn.hidden = !isSeeker;
    tagBtn.disabled = state.phase !== "seek";
    tagBtn.textContent = "Etiquetar (F)";

    if (mine && mine.offline) {
      noteEl.textContent = "Desconectado: tu rol está reservado 45 s.";
    } else if (state.phase === "waiting") {
      noteEl.textContent = `Mínimo ${state.minPlayers} jugadores. Todos listos y el buscador sale al azar.`;
    } else if (state.phase === "hide") {
      noteEl.textContent = isSeeker
        ? "Quédate quieto en la jaula. Ya saldrás a buscar."
        : "Corre a un aro verde y quédate quieto: estás más oculto.";
    } else if (state.phase === "seek") {
      noteEl.textContent = isSeeker
        ? "Acércate a 1,6 m con la línea libre y pulsa F."
        : "Aguita hasta que pase el reloj. Esquiva con G si te ven.";
    } else if (state.phase === "result") {
      noteEl.textContent = "";
    } else {
      noteEl.textContent = "";
    }

    if (state.phase === "result" && state.winner) {
      const won =
        state.winner.role === "hider" ? isHider : state.winner.role === "seeker" ? isSeeker : false;
      const who = state.winner.role === "hider" ? "Los escondidos" : "El buscador";
      resultEl.hidden = false;
      resultEl.textContent = `${who} ganan · ${won ? "¡Tú ganas!" : "Mala suerte"}`;
    } else {
      resultEl.hidden = true;
      resultEl.textContent = "";
    }

    if (Date.now() > detectedUntil) detected = [];
    detectedEl.hidden = !detected.length;
    detectedEl.textContent = detected.length
      ? `🔎 Detectado: ${detected.map(nameOf).join(", ")}`
      : "";
  }

  function show() {
    root.hidden = false;
    render();
  }

  function hide() {
    root.hidden = true;
    state = null;
    detected = [];
  }

  function isOpen() {
    return !root.hidden;
  }

  function setState(next) {
    state = next || null;
    render();
  }

  function event(ev) {
    if (!ev || ev.type !== "pulse" || !ev.hits || !ev.hits.length) return;
    detected = ev.hits.slice();
    detectedUntil = Date.now() + 5000;
    render();
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
