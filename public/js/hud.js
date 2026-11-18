const HELP_KEY = "clubpingui.helpSeen.v1";
const SENS_KEY = "clubpingui.sens";
const AUTORELOAD_KEY = "clubpingui.autoreload";

let helpState = { show: null, close: null };
let sensCb = null;
let autoReloadCb = null;
let toastTimer = null;

export function showToast(text, ms) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => { el.hidden = true; }, 220);
  }, ms || 1600);
}

export function getSensitivity() {
  const v = parseFloat(localStorage.getItem(SENS_KEY) || "1");
  return isFinite(v) && v > 0 ? v : 1;
}

export function isAutoReloadEnabled() {
  const v = localStorage.getItem(AUTORELOAD_KEY);
  return v === null ? true : v !== "0";
}

export function setupSettings(opts) {
  opts = opts || {};
  sensCb = opts.onSensitivity || null;
  autoReloadCb = opts.onAutoReload || null;

  const btn = document.getElementById("settings-btn");
  const pop = document.getElementById("settings-pop");
  const range = document.getElementById("sens-range");
  const val = document.getElementById("sens-val");
  const chk = document.getElementById("tgl-autoreload");
  if (!pop) return;

  range.value = getSensitivity();
  val.textContent = getSensitivity().toFixed(2);
  chk.checked = isAutoReloadEnabled();

  if (btn) btn.addEventListener("click", (e) => {
    e.stopPropagation();
    pop.hidden = !pop.hidden;
  });
  range.addEventListener("input", () => {
    localStorage.setItem(SENS_KEY, range.value);
    val.textContent = (+range.value).toFixed(2);
    if (sensCb) sensCb(+range.value);
  });
  chk.addEventListener("change", () => {
    localStorage.setItem(AUTORELOAD_KEY, chk.checked ? "1" : "0");
    if (autoReloadCb) autoReloadCb(chk.checked);
  });
  document.addEventListener("click", (e) => {
    if (!pop.hidden && !pop.contains(e.target) && (!btn || e.target !== btn)) pop.hidden = true;
  });
}

export function setupHelp() {
  const btn = document.getElementById("info-btn");
  const modal = document.getElementById("info-modal");
  const closeBtn = document.getElementById("info-close");
  if (!modal) return { show() {}, close() {} };

  const show = () => {
    modal.hidden = false;
    document.body.classList.add("modal-open");
  };
  const close = () => {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    localStorage.setItem(HELP_KEY, "1");
  };
  if (btn) btn.addEventListener("click", show);
  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", (e) => {
    if (!modal.hidden && (e.key === "Escape" || e.key === "Esc")) close();
  });
  helpState.show = show;
  helpState.close = close;
  return { show, close };
}

export function maybeShowHelp() {
  if (helpState.show && !localStorage.getItem(HELP_KEY)) helpState.show();
}

let chatApi = null;

/** El chat se registra aquí para coordinar paneles y chat. */
export function registerChat(api) {
  chatApi = api;
}

const SOCIAL_PANELS = { rooms: "rooms-panel", online: "online-panel" };

function closeSettingsPop() {
  const settings = document.getElementById("settings-pop");
  if (settings) settings.hidden = true;
}

export function setSocialTab(page) {
  const panelId = SOCIAL_PANELS[page] || null;
  document.querySelectorAll(".social-page").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
  document.body.classList.toggle("sheet-rooms", page === "rooms");
  document.body.classList.toggle("sheet-online", page === "online");
  if (page) {
    closeMobileMenu();
    if (chatApi && chatApi.close) chatApi.close();
  }
  closeSettingsPop();
}

export function openRoomsSheet() {
  setSocialTab("rooms");
}

export function closeRoomsSheet() {
  document.body.classList.remove("sheet-rooms");
  const panel = document.getElementById("rooms-panel");
  if (panel) panel.classList.remove("active");
}

export function openOnlineSheet() {
  setSocialTab("online");
}

export function closeOnlineSheet() {
  document.body.classList.remove("sheet-online");
  const panel = document.getElementById("online-panel");
  if (panel) panel.classList.remove("active");
}

export function closeSocialPanels() {
  closeRoomsSheet();
  closeOnlineSheet();
}

function syncMenuAria() {
  const btn = document.getElementById("menu-btn");
  const menu = document.getElementById("mobile-menu");
  const open = document.body.classList.contains("menu-open");
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  if (menu) {
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    menu.inert = !open;
  }
}

export function toggleMobileMenu() {
  const open = !document.body.classList.contains("menu-open");
  document.body.classList.toggle("menu-open", open);
  if (open) closeSettingsPop();
  syncMenuAria();
}

export function closeMobileMenu() {
  const menu = document.getElementById("mobile-menu");
  const active = document.activeElement;
  if (menu && active && menu.contains(active)) {
    const btn = document.getElementById("menu-btn");
    if (btn) btn.focus();
    else active.blur();
  }
  document.body.classList.remove("menu-open");
  syncMenuAria();
}

export function setupSocialTabs() {
  const roomsClose = document.getElementById("rooms-close-btn");
  if (roomsClose) roomsClose.addEventListener("click", closeRoomsSheet);
  const onlineClose = document.getElementById("online-close-btn");
  if (onlineClose) onlineClose.addEventListener("click", closeOnlineSheet);
  // Los paneles se cierran al tocar fuera de ellos o al abrir el chat.
  document.addEventListener("clubpingui:chat-open", closeSocialPanels);
  document.addEventListener("pointerdown", (event) => {
    const open = document.body.classList.contains("sheet-rooms") || document.body.classList.contains("sheet-online");
    if (!open) return;
    if (event.target.closest && (event.target.closest("#rooms-panel") || event.target.closest("#online-panel"))) return;
    closeSocialPanels();
  }, true);
}

export function setupMobileMenu(handlers) {
  handlers = handlers || {};
  const btn = document.getElementById("menu-btn");
  const items = document.querySelectorAll("#mobile-menu .mm-item");
  if (btn) btn.addEventListener("click", (e) => { e.stopPropagation(); toggleMobileMenu(); });
  items.forEach((it) => {
    it.addEventListener("click", (e) => {
      closeMobileMenu();
      const act = it.dataset.act;
      if (act === "rooms") openRoomsSheet();
      else if (act === "online") openOnlineSheet();
      else if (act === "chat") {
        setSocialTab(null);
        if (chatApi && chatApi.open) chatApi.open();
      }
      else if (act === "wardrobe" && handlers.onWardrobe) handlers.onWardrobe();
      else if (act === "info" && helpState.show) helpState.show();
      else if (act === "settings") {
        e.stopPropagation();
        const pop = document.getElementById("settings-pop");
        if (pop) pop.hidden = !pop.hidden;
      }
      else if (act === "logout" && handlers.onLogout) handlers.onLogout();
    });
  });
  document.addEventListener("click", (e) => {
    if (document.body.classList.contains("menu-open") && !e.target.closest("#mobile-menu, #menu-btn")) {
      closeMobileMenu();
    }
  });
}