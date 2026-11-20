// HUD del paddock y de la carrera de Karts.
//
// No es modal: se juega caminando por el paddock y, en carrera, conduciendo con
// el teclado. Muestra velocidad, vuelta, posición, clasificación, tienda física
// (los mismos cinco karts de los pedestales) y los tres portales. El servidor
// sigue siendo la única fuente de verdad: aquí solo se pintan estados y se
// envían intenciones.

import { KARTS_TRACKS } from "./kartsDefs.js";

const PHASE_LABEL = {
  waiting: "En el paddock",
  countdown: "¡Prepárate!",
  racing: "En carrera",
  finished: "Resultado",
};

const ORDINAL = ["1.º", "2.º", "3.º", "4.º", "5.º", "6.º", "7.º", "8.º"];

export function createKartsHud({ getMyId, onBuy, onEquip, onTrack, onReady, onLeave } = {}) {
  const root = document.getElementById("karts-hud");
  if (!root) return null;

  const phaseEl = document.getElementById("karts-hud-phase");
  const timerEl = document.getElementById("karts-hud-timer");
  const speedEl = document.getElementById("karts-hud-speed");
  const lapEl = document.getElementById("karts-hud-lap");
  const posEl = document.getElementById("karts-hud-pos");
  const surfaceEl = document.getElementById("karts-hud-surface");
  const pointsEl = document.getElementById("karts-hud-points");
  const boardEl = document.getElementById("karts-hud-board");
  const kartsEl = document.getElementById("karts-hud-karts");
  const tracksEl = document.getElementById("karts-hud-tracks");
  const noteEl = document.getElementById("karts-hud-note");
  const flashEl = document.getElementById("karts-hud-flash");
  const resultEl = document.getElementById("karts-hud-result");
  const readyBtn = document.getElementById("karts-hud-ready");
  const closeBtn = document.getElementById("karts-hud-close");
  const countdownEl = document.getElementById("karts-hud-countdown");

  if (closeBtn) closeBtn.addEventListener("click", () => onLeave && onLeave());
  if (readyBtn) readyBtn.addEventListener("click", () => onReady && onReady());

  let state = null;
  let flash = "";
  let flashUntil = 0;
  let kartButtons = new Map();
  let trackButtons = new Map();
  let catalogKey = "";

  function myEntry() {
    if (!state) return null;
    const id = getMyId ? getMyId() : null;
    return (state.players || []).find((player) => player.id === id) || null;
  }

  function buildShop() {
    const catalog = state.catalog || [];
    const key = catalog.map((kart) => kart.id).join("|");
    if (key === catalogKey) return;
    catalogKey = key;
    kartsEl.innerHTML = "";
    kartButtons = new Map();
    for (const kart of catalog) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "karts-shop-item";
      btn.style.setProperty("--kart-color", kart.color || "#f472b6");
      btn.dataset.kartId = kart.id;
      btn.addEventListener("click", () => {
        const mine = myEntry();
        if (!mine) return;
        if (mine.owned.includes(kart.id)) onEquip && onEquip(kart.id);
        else onBuy && onBuy(kart.id);
      });
      kartsEl.appendChild(btn);
      kartButtons.set(kart.id, btn);
    }

    tracksEl.innerHTML = "";
    trackButtons = new Map();
    for (const track of KARTS_TRACKS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "karts-track-item";
      btn.dataset.trackId = track.id;
      btn.title = track.description;
      btn.addEventListener("click", () => {
        if (track.status !== "live") {
          flash = "Esa pista está en preparación.";
          flashUntil = Date.now() + 1800;
          render();
          return;
        }
        onTrack && onTrack(track.id);
      });
      tracksEl.appendChild(btn);
      trackButtons.set(track.id, btn);
    }
  }

  function renderShop() {
    const mine = myEntry();
    const owned = mine ? mine.owned : [];
    const points = mine ? mine.points : 0;
    if (pointsEl) pointsEl.textContent = `${points} pts de carrera`;
    for (const kart of state.catalog || []) {
      const btn = kartButtons.get(kart.id);
      if (!btn) continue;
      const isOwned = owned.includes(kart.id);
      const isEquipped = mine && mine.kartId === kart.id;
      const canBuy = points >= kart.price;
      btn.classList.toggle("is-owned", isOwned);
      btn.classList.toggle("is-equipped", !!isEquipped);
      btn.classList.toggle("is-locked", !isOwned && !canBuy);
      btn.innerHTML =
        `<span class="karts-shop-dot"></span>` +
        `<span class="karts-shop-name">${kart.name}</span>` +
        `<span class="karts-shop-price">` +
        (isEquipped ? "Equipado" : isOwned ? "Equipar" : `${kart.price} pts`) +
        `</span>`;
    }
    for (const track of KARTS_TRACKS) {
      const btn = trackButtons.get(track.id);
      if (!btn) continue;
      const selected = mine && mine.trackId === track.id;
      btn.classList.toggle("is-selected", !!selected);
      btn.classList.toggle("is-prep", track.status !== "live");
      btn.textContent = `${track.short} · ${track.length} m${track.status !== "live" ? " · En preparación" : ""}`;
    }
  }

  function renderBoard() {
    if (!boardEl) return;
    const standings = state.standings || [];
    if (!standings.length || state.phase === "waiting") {
      boardEl.hidden = true;
      boardEl.innerHTML = "";
      return;
    }
    boardEl.hidden = false;
    boardEl.innerHTML = standings
      .map((entry, index) => {
        const me = entry.id === (getMyId ? getMyId() : null);
        return `<div class="karts-board-row${me ? " is-me" : ""}">` +
          `<span class="karts-board-pos">${ORDINAL[index] || index + 1}</span>` +
          `<span class="karts-board-name">${entry.name}</span>` +
          `<span class="karts-board-lap">${entry.laps || 0}/${state.laps || 3}</span>` +
          `</div>`;
      })
      .join("");
  }

  function render() {
    if (!state) return;
    buildShop();

    if (phaseEl) phaseEl.textContent = PHASE_LABEL[state.phase] || "";
    const ms =
      state.phase === "countdown"
        ? state.countdownMs
        : state.phase === "racing"
          ? state.remainingMs
          : state.phase === "finished"
            ? state.resultMs
            : 0;
    const secs = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    if (timerEl) {
      timerEl.textContent = secs > 0 ? `${secs}s` : "";
      timerEl.hidden = secs <= 0;
    }

    const mine = myEntry();
    if (speedEl) speedEl.textContent = `${Math.round((mine ? mine.speed : 0) * 3.6)} km/h`;
    if (lapEl) lapEl.textContent = `Vuelta ${Math.min(mine ? mine.laps : 0, state.laps || 3)}/${state.laps || 3}`;
    if (posEl) posEl.textContent = mine && mine.position ? ORDINAL[mine.position - 1] || `${mine.position}.º` : "—";
    if (surfaceEl) {
      const surface = mine && mine.boosting
        ? "TURBO"
        : mine && mine.sector % 3 === 1
          ? "Hielo / grava"
          : "Asfalto";
      surfaceEl.textContent = surface;
      surfaceEl.classList.toggle("is-boost", !!(mine && mine.boosting));
    }

    if (countdownEl) {
      const count = state.phase === "countdown" ? Math.ceil((state.countdownMs || 0) / 1000) : 0;
      countdownEl.hidden = !count;
      countdownEl.textContent = count > 0 ? String(count) : "";
    }

    const canReady = state.phase === "waiting" || state.phase === "finished";
    if (readyBtn) {
      readyBtn.hidden = !canReady;
      readyBtn.disabled = !canReady;
      readyBtn.textContent = mine && mine.ready && state.phase === "waiting" ? "Cancelar listo" : "Listo";
      readyBtn.classList.toggle("is-ready", !!(mine && mine.ready && state.phase === "waiting"));
    }

    if (noteEl) {
      if (state.phase === "waiting") {
        noteEl.textContent =
          `Mínimo ${state.minPlayers} jugadores. Compra en los pedestales o aquí, elige portal y pulsa «Listo». ` +
          `En carrera: W/S acelerar, A/D girar, Espacio derrapar.`;
      } else if (state.phase === "countdown") {
        noteEl.textContent = "Pisa el acelerador en cuanto se apague el semáforo.";
      } else if (state.phase === "racing") {
        noteEl.textContent = mine && mine.finished
          ? "Has terminado. Espera al resto de la parrilla."
          : "3 vueltas. Respeta los sectores: los atajos acortan, pero no saltan checkpoints.";
      } else {
        noteEl.textContent = "Reparto de puntos por posición y vuelta. La tienda vuelve a abrirse enseguida.";
      }
    }

    if (Date.now() > flashUntil) flash = "";
    if (flashEl) {
      flashEl.hidden = !flash;
      flashEl.textContent = flash;
    }

    if (resultEl) {
      resultEl.hidden = state.phase !== "finished" || !state.winner;
      if (state.phase === "finished" && state.winner) {
        const won = state.winner.id === (mine && mine.id);
        resultEl.textContent = `${state.winner.name} gana · ${won ? "¡Tú ganas!" : "Mala suerte"}`;
      }
    }

    renderShop();
    renderBoard();
  }

  function show() {
    root.hidden = false;
    render();
  }

  function hide() {
    root.hidden = true;
    state = null;
    flash = "";
    catalogKey = "";
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
    if (ev.type === "boost" && ev.playerId === (getMyId ? getMyId() : null)) {
      flash = "⚡ Turbo activado";
    } else if (ev.type === "lap" && ev.playerId === (getMyId ? getMyId() : null)) {
      flash = `🔁 Vuelta ${ev.laps}/${state.laps || 3}`;
    } else if (ev.type === "finish" && ev.playerId === (getMyId ? getMyId() : null)) {
      flash = `🏁 Has terminado en ${ev.position}.º`;
    } else if (ev.type === "purchase" && ev.playerId === (getMyId ? getMyId() : null)) {
      flash = "🛒 Kart comprado";
    } else if (ev.type === "result") {
      flash = "🏁 Carrera terminada";
    } else {
      return;
    }
    flashUntil = Date.now() + 2200;
    render();
  }

  return {
    show,
    hide,
    isOpen,
    setState,
    event,
    getState: () => state,
    dispose() {
      if (closeBtn) closeBtn.removeEventListener("click", onLeave);
      root.hidden = true;
    },
  };
}
