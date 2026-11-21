// HUD del Distrito de Pingüí (Ciudad social, C1-C2).
//
// No es modal: se pasea en primera persona y se recoge con la tecla E. Muestra
// la cartera, la mochila, los 13 puntos del catálogo y el objeto cercano. El
// servidor sigue siendo la única fuente de verdad: aquí solo se pintan estados
// y se envían intenciones (`collect`, `buy`, `sell`).

import { CITY_ITEMS, cityItemById } from "./cityDefs.js";

const EMPTY_WALLET = { coins: 0, collected: 0, earned: 0, sold: 0, bought: 0 };

export function createCityHud({ getMyId, onBuy, onSell, onLeave } = {}) {
  const root = document.getElementById("ciudad-hud");
  if (!root) return null;

  const coinsEl = document.getElementById("ciudad-hud-coins");
  const collectedEl = document.getElementById("ciudad-hud-collected");
  const nearbyEl = document.getElementById("ciudad-hud-nearby");
  const inventoryEl = document.getElementById("ciudad-hud-inventory");
  const shopEl = document.getElementById("ciudad-hud-shop");
  const flashEl = document.getElementById("ciudad-hud-flash");
  const closeBtn = document.getElementById("ciudad-hud-close");

  const handleLeave = () => onLeave && onLeave();
  const handleShopClick = (event) => {
    const btn = event.target.closest("button[data-action]");
    if (!btn || btn.disabled) return;
    const itemId = btn.dataset.itemId;
    if (!itemId) return;
    if (btn.dataset.action === "buy") onBuy && onBuy(itemId, 1);
    else if (btn.dataset.action === "sell") onSell && onSell(itemId, 1);
  };
  if (closeBtn) closeBtn.addEventListener("click", handleLeave);
  if (shopEl) shopEl.addEventListener("click", handleShopClick);

  let state = null;
  let wallet = { ...EMPTY_WALLET };
  let inventory = [];
  let nearby = null;
  let flash = "";
  let flashUntil = 0;
  let catalogKey = "";
  let shopCatalog = [];

  function myPlayer() {
    if (!state) return null;
    const id = getMyId ? getMyId() : null;
    return (state.players || []).find((player) => player.id === id) || null;
  }

  function syncProfile() {
    if (state && state.me && state.me.wallet) {
      wallet = { ...EMPTY_WALLET, ...state.me.wallet };
      inventory = Array.isArray(state.me.inventory) ? state.me.inventory.map((item) => ({ ...item })) : [];
      return;
    }
    const mine = myPlayer();
    wallet = {
      ...EMPTY_WALLET,
      coins: mine ? Number(mine.coins) || 0 : 0,
      collected: mine ? Number(mine.collected) || 0 : 0,
    };
  }

  function buildShop() {
    const catalog = state && Array.isArray(state.catalog) && state.catalog.length ? state.catalog : CITY_ITEMS;
    const key = catalog.map((item) => item.id).join("|");
    if (key === catalogKey || !shopEl) return;
    catalogKey = key;
    shopCatalog = catalog;
    shopEl.innerHTML = catalog
      .map(
        (item) =>
          `<div class="city-shop-item" data-item-id="${item.id}">` +
          `<span class="city-shop-icon">${item.icon || "🎁"}</span>` +
          `<span class="city-shop-name">${item.name}</span>` +
          `<button type="button" class="city-shop-btn" data-action="buy" data-item-id="${item.id}">Comprar ${item.buy}</button>` +
          `<button type="button" class="city-shop-btn is-sell" data-action="sell" data-item-id="${item.id}">Vender ${item.sell}</button>` +
          `</div>`
      )
      .join("");
  }

  function renderWallet() {
    if (coinsEl) coinsEl.textContent = `${wallet.coins} 🪙`;
    if (collectedEl) collectedEl.textContent = `${wallet.collected} recogidos`;
  }

  function renderInventory() {
    if (!inventoryEl) return;
    if (!inventory.length) {
      inventoryEl.innerHTML = `<span class="city-inventory-empty">Mochila vacía · recoge objetos con E</span>`;
      return;
    }
    inventoryEl.innerHTML = inventory
      .map((item) => {
        const def = cityItemById(item.id);
        return (
          `<span class="city-inventory-item" title="${def ? def.name : item.id}">` +
          `${def ? def.icon : "🎁"} <b>${Math.max(1, Number(item.qty) || 1)}</b>` +
          `</span>`
        );
      })
      .join("");
  }

  function renderShop() {
    if (!shopEl) return;
    const qty = new Map(inventory.map((item) => [item.id, Number(item.qty) || 0]));
    for (const item of shopEl.querySelectorAll(".city-shop-item")) {
      const def = item.querySelector('button[data-action="buy"]');
      const sell = item.querySelector('button[data-action="sell"]');
      const catalogItem = shopCatalog.find((x) => x.id === item.dataset.itemId);
      if (def) def.disabled = wallet.coins < Number(catalogItem ? catalogItem.buy : 0);
      if (sell) sell.disabled = (qty.get(item.dataset.itemId) || 0) <= 0;
    }
  }

  function renderNearby() {
    if (!nearbyEl) return;
    if (!nearby || !nearby.spot) {
      nearbyEl.hidden = true;
      nearbyEl.textContent = "";
      return;
    }
    nearbyEl.hidden = false;
    if (nearby.available === false) {
      nearbyEl.textContent = `${nearby.spot.name} · ya recogido, vuelve enseguida`;
      nearbyEl.classList.add("is-unavailable");
    } else {
      nearbyEl.textContent = `E · Recoger ${nearby.spot.name} (+${nearby.spot.coins} 🪙)`;
      nearbyEl.classList.remove("is-unavailable");
    }
  }

  function render() {
    if (!state) return;
    buildShop();
    renderWallet();
    renderInventory();
    renderShop();
    renderNearby();
    if (flashEl) {
      if (Date.now() > flashUntil) flash = "";
      flashEl.hidden = !flash;
      flashEl.textContent = flash;
    }
  }

  function show() {
    root.hidden = false;
    render();
  }

  function hide() {
    root.hidden = true;
    state = null;
    wallet = { ...EMPTY_WALLET };
    inventory = [];
    nearby = null;
    flash = "";
  }

  function isOpen() {
    return !root.hidden;
  }

  function setState(next) {
    state = next || null;
    if (!state) return;
    syncProfile();
    render();
  }

  function setNearby(spot, available = true) {
    const next = spot ? { spot, available } : null;
    const before = nearby;
    if (
      before === next ||
      (before && next && before.spot === next.spot && before.available === next.available)
    ) {
      return;
    }
    nearby = next;
    renderNearby();
  }

  function event(ev) {
    if (!ev || !state) return;
    const mine = getMyId ? getMyId() : null;
    const mineAction = ev.playerId === mine;
    if (mineAction && ev.wallet) {
      wallet = { ...EMPTY_WALLET, ...ev.wallet };
      if (Array.isArray(ev.inventory)) {
        inventory = ev.inventory.map((item) => ({ ...item }));
      }
    }
    if (mineAction && ev.type === "collect") flash = `+${ev.coins} 🪙 · ${ev.name}`;
    else if (mineAction && ev.type === "buy") flash = "🛒 Compra añadida a la mochila";
    else if (mineAction && ev.type === "sell") flash = "💰 Objeto vendido";
    else return;
    flashUntil = Date.now() + 2200;
    render();
  }

  return {
    show,
    hide,
    isOpen,
    setState,
    setNearby,
    event,
    getState: () => state,
    getWallet: () => ({ ...wallet }),
    getInventory: () => inventory.map((item) => ({ ...item })),
    dispose() {
      if (closeBtn) closeBtn.removeEventListener("click", handleLeave);
      if (shopEl) {
        shopEl.removeEventListener("click", handleShopClick);
        shopEl.innerHTML = "";
      }
      hide();
    },
  };
}
