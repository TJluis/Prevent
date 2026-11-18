const state = {
  dir: { x: 0, z: 0 },
  fireHeld: false,
  fireTaps: 0,
  blockHeld: false,
  sprintHeld: false,
  look: { dx: 0, dy: 0 }
};

const JOY_R = 50;
let pointers = new Map();
let joyEl = null;
let joyBase = null;
let joyStick = null;
let listeners = [];

export function isTouchMode() {
  if (window.__forceTouch) return true;
  if (!window.matchMedia) return (navigator.maxTouchPoints || 0) > 0;
  // Un portátil con pantalla táctil (puntero fino + hover) NO debe recibir el
  // layout móvil: sólo lo activamos cuando el puntero principal es grueso o
  // cuando no hay hover (teléfonos/tabletas reales).
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const anyCoarse = window.matchMedia("(any-pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  return coarse || (anyCoarse && noHover);
}

function uiBlocked(e) {
  if (e.target.closest && e.target.closest("button, input, textarea, select, .hud-card, .item-slot, .crystal-offer, .hockey-board, .info-card, #mobile-menu, #rooms-panel")) return true;
  const game = document.getElementById("game");
  if (game && game.hidden) return true;
  const dress = document.getElementById("dress-screen");
  if (dress && !dress.hidden) return true;
  if (!document.getElementById("info-modal").hidden) return true;
  if (document.body.classList.contains("menu-open")) return true;
  if (document.body.classList.contains("sheet-rooms")) return true;
  if (document.body.classList.contains("sheet-online")) return true;
  if (!document.getElementById("settings-pop").hidden) return true;
  return false;
}

function showJoy(x, y) {
  joyBase.style.left = x + "px";
  joyBase.style.top = y + "px";
  joyBase.hidden = false;
  joyStick.style.transform = "translate(0px, 0px)";
}

function updateJoy(p) {
  let dx = p.x - p.ox;
  let dy = p.y - p.oy;
  const dist = Math.hypot(dx, dy);
  if (dist > JOY_R) {
    dx = dx / dist * JOY_R;
    dy = dy / dist * JOY_R;
  }
  joyStick.style.transform = "translate(" + dx + "px, " + dy + "px)";
  state.dir.x = dx / JOY_R;
  state.dir.z = dy / JOY_R;
}

function onDown(e) {
  if (e.pointerType !== "touch") return;
  if (uiBlocked(e)) return;
  e.preventDefault();
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isJoyZone = e.clientX <= w * 0.45 && e.clientY >= h * 0.5;
  if (isJoyZone) {
    const p = { kind: "joy", x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY };
    pointers.set(e.pointerId, p);
    showJoy(e.clientX, e.clientY);
  } else {
    pointers.set(e.pointerId, { kind: "look", x: e.clientX, y: e.clientY });
  }
}

function onMove(e) {
  if (e.pointerType !== "touch") return;
  const p = pointers.get(e.pointerId);
  if (!p) return;
  e.preventDefault();
  if (p.kind === "joy") {
    p.x = e.clientX;
    p.y = e.clientY;
    updateJoy(p);
  } else {
    state.look.dx += e.clientX - p.x;
    state.look.dy += e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
  }
}

function onUp(e) {
  if (e.pointerType !== "touch") return;
  const p = pointers.get(e.pointerId);
  if (!p) return;
  pointers.delete(e.pointerId);
  if (p.kind === "joy") {
    state.dir.x = 0;
    state.dir.z = 0;
    if (joyBase) joyBase.hidden = true;
  }
}

export function initTouchControls(cb) {
  cb = cb || {};
  joyBase = document.getElementById("joy-base");
  joyStick = document.getElementById("joy-stick");
  const fire = document.getElementById("fire-btn");
  if (joyBase) joyBase.hidden = true;

  const handlers = [
    [window, "pointerdown", onDown],
    [window, "pointermove", onMove],
    [window, "pointerup", onUp],
    [window, "pointercancel", onUp]
  ];
  for (const [t, ev, fn] of handlers) {
    t.addEventListener(ev, fn, { passive: false });
    listeners.push([t, ev, fn]);
  }

  if (fire) {
    const fdown = (e) => { e.preventDefault(); state.fireHeld = true; state.fireTaps++; };
    const fup = (e) => { e.preventDefault(); state.fireHeld = false; };
    fire.addEventListener("pointerdown", fdown);
    fire.addEventListener("pointerup", fup);
    fire.addEventListener("pointercancel", fup);
    fire.addEventListener("contextmenu", (e) => e.preventDefault());
    listeners.push([fire, "pointerdown", fdown], [fire, "pointerup", fup], [fire, "pointercancel", fup]);
  }

  const bind = (id, fn) => {
    const el = document.getElementById(id);
    if (el && fn) {
      el.addEventListener("click", fn);
      listeners.push([el, "click", fn]);
    }
  };
  if (cb.onReload) bind("t-reload", cb.onReload);
  if (cb.onUse) bind("t-use", cb.onUse);
  if (cb.onView) bind("t-view", cb.onView);
  if (cb.onInv) bind("t-inv", cb.onInv);
  if (cb.onJump) bind("t-jump", cb.onJump);
  if (cb.onSlide) bind("t-slide", cb.onSlide);

  // Sprint: interruptor (Fase 4). Tocar 💨 activa/desactiva correr, así se
  // puede pulsar 🛷 con el mismo pulgar sin mantener dos dedos.
  const sprintEl = document.getElementById("t-sprint");
  const setSprint = (value) => {
    state.sprintHeld = !!value;
    if (!sprintEl) return;
    sprintEl.classList.toggle("is-held", state.sprintHeld);
    sprintEl.setAttribute("aria-pressed", state.sprintHeld ? "true" : "false");
  };
  if (sprintEl) {
    const stoggle = (e) => { e.preventDefault(); setSprint(!state.sprintHeld); };
    sprintEl.addEventListener("click", stoggle);
    sprintEl.addEventListener("contextmenu", (e) => e.preventDefault());
    listeners.push([sprintEl, "click", stoggle]);
    setSprint(false);
  }

  // Bloqueo con escudo: mantener pulsado el botón (pointerdown/up).
  const blockEl = document.getElementById("t-block");
  if (blockEl && cb.onBlock) {
    const bdown = (e) => { e.preventDefault(); state.blockHeld = true; cb.onBlock(true); };
    const bup = (e) => { e.preventDefault(); state.blockHeld = false; cb.onBlock(false); };
    blockEl.addEventListener("pointerdown", bdown);
    blockEl.addEventListener("pointerup", bup);
    blockEl.addEventListener("pointercancel", bup);
    blockEl.addEventListener("pointerleave", bup);
    blockEl.addEventListener("contextmenu", (e) => e.preventDefault());
    listeners.push(
      [blockEl, "pointerdown", bdown],
      [blockEl, "pointerup", bup],
      [blockEl, "pointercancel", bup],
      [blockEl, "pointerleave", bup]
    );
  }

  return {
    getDir: () => state.dir,
    get fireHeld() { return state.fireHeld; },
    get blockHeld() { return state.blockHeld; },
    get sprintHeld() { return state.sprintHeld; },
    setSprint(value) { setSprint(value); },
    consumeFireTap() {
      if (state.fireTaps > 0) { state.fireTaps--; return true; }
      return false;
    },
    consumeLook() {
      const l = { dx: state.look.dx, dy: state.look.dy };
      state.look.dx = 0;
      state.look.dy = 0;
      return l;
    },
    dispose() {
      for (const [t, ev, fn] of listeners) t.removeEventListener(ev, fn);
      listeners = [];
      pointers.clear();
      state.dir.x = 0;
      state.dir.z = 0;
      state.fireHeld = false;
      state.fireTaps = 0;
      state.blockHeld = false;
      setSprint(false);
      state.look.dx = 0;
      state.look.dy = 0;
    }
  };
}