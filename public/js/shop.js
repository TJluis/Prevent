// Tienda de armas dentro de salas. El catálogo se deriva de WEAPONS (una sola
// fuente de verdad); el cliente solo envía el id y el servidor valida precio y
// saldo. Este módulo no decide compras: pinta estado y manda intenciones.

import { WEAPONS } from "./weaponDefs.js";
import { WEAPON_CLASSES } from "./weaponMath.js";

const CLASS_ORDER = [
  "sidearm",
  "smg",
  "shotgun",
  "rifle",
  "marksman",
  "heavy",
  "special",
  "launcher",
  "melee",
];

const REASON_TEXT = {
  "no-room": "La tienda solo está disponible dentro de una sala.",
  dead: "No puedes comprar mientras estás eliminado.",
  insufficient: "No tienes puntos suficientes. Elimina rivales para ganar más.",
  unknown: "Esa arma no existe.",
  throttle: "Espera un momento antes de volver a comprar.",
};

function classLabel(def) {
  const info = WEAPON_CLASSES[def.class];
  return info ? info.label : def.class || "Arma";
}

function priceOf(def) {
  return Math.max(0, Math.round(def.price || 0));
}

export function createShop({ onBuy, getScore, getEquippedId, notify } = {}) {
  const panel = document.getElementById("shop-panel");
  const grid = document.getElementById("shop-grid");
  const scoreEl = document.getElementById("shop-score");
  const noteEl = document.getElementById("shop-note");
  const closeBtn = document.getElementById("shop-close");

  let enabled = false;
  let open = false;
  let score = 0;
  let equipped = null;
  let lifetime = null;
  let built = false;

  const weapons = Object.values(WEAPONS);

  function build() {
    if (!grid || built) return;
    built = true;
    const groups = new Map();
    for (const def of weapons) {
      const key = def.class || "special";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(def);
    }
    const order = [...CLASS_ORDER, ...groups.keys()].filter(
      (key, index, list) => groups.has(key) && list.indexOf(key) === index
    );

    for (const key of order) {
      const list = groups.get(key);
      list.sort((a, b) => priceOf(a) - priceOf(b) || a.name.localeCompare(b.name));

      const section = document.createElement("section");
      section.className = "shop-group";
      const title = document.createElement("h3");
      title.textContent = classLabel(list[0]);
      const cards = document.createElement("div");
      cards.className = "shop-group-grid";

      for (const def of list) {
        const card = document.createElement("article");
        card.className = "shop-item";
        card.dataset.weaponId = def.id;

        const name = document.createElement("div");
        name.className = "shop-item-name";
        name.textContent = def.name;

        const stats = document.createElement("div");
        stats.className = "shop-item-stats";
        const pellets = def.pellets > 1 ? `×${def.pellets}` : "";
        stats.textContent = `Daño ${def.damage}${pellets} · Alcance ${def.range} m`;

        const buy = document.createElement("button");
        buy.type = "button";
        buy.className = "shop-buy-btn";
        buy.textContent = "Comprar";
        buy.addEventListener("click", () => {
          if (onBuy) onBuy(def.id);
        });

        card.append(name, stats, buy);
        cards.appendChild(card);
      }

      section.append(title, cards);
      grid.appendChild(section);
    }
  }

  function currentScore() {
    return getScore ? Math.max(0, Math.round(Number(getScore()) || 0)) : score;
  }

  function currentEquipped() {
    return getEquippedId ? getEquippedId() : equipped;
  }

  function render() {
    if (!grid) return;
    build();
    const points = currentScore();
    const equippedId = currentEquipped();
    if (scoreEl) scoreEl.textContent = `${points} pts`;
    if (noteEl) {
      noteEl.textContent = lifetime
        ? `Historial: ${lifetime.score} pts · ${lifetime.kills} bajas · mejor racha ${lifetime.bestStreak}`
        : "Los cristales del mapa siguen dando armas gratis.";
    }
    for (const card of grid.querySelectorAll(".shop-item")) {
      const def = WEAPONS[card.dataset.weaponId];
      if (!def) continue;
      const price = priceOf(def);
      const owned = equippedId === def.id;
      const affordable = points >= price;
      card.classList.toggle("equipped", owned);
      card.classList.toggle("unaffordable", !owned && !affordable);
      const button = card.querySelector(".shop-buy-btn");
      if (!button) continue;
      button.disabled = owned || !affordable;
      button.textContent = owned ? "Equipada" : price === 0 ? "Equipar gratis" : `Comprar · ${price}`;
    }
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) hide();
    render();
  }

  function setScore(value) {
    score = Math.max(0, Math.round(Number(value) || 0));
    render();
  }

  function setEquipped(weaponId) {
    equipped = weaponId || null;
    render();
  }

  function setLifetime(data) {
    lifetime = data || null;
    render();
  }

  function show() {
    if (!enabled) return false;
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

  function handleResult(data) {
    if (!data) return;
    if (typeof data.score === "number") setScore(data.score);
    if (data.ok) {
      setEquipped(data.weaponId);
      if (notify) {
        const text = data.alreadyEquipped
          ? "Ya llevabas esa arma equipada."
          : data.price > 0
            ? `Has comprado ${WEAPONS[data.weaponId]?.name || "el arma"} por ${data.price} pts.`
            : `Has equipado ${WEAPONS[data.weaponId]?.name || "el arma"} gratis.`;
        notify(text, true);
      }
    } else if (notify) {
      notify(REASON_TEXT[data.reason] || "No se pudo completar la compra.", false);
    }
    render();
  }

  const onClose = () => hide();
  if (closeBtn) closeBtn.addEventListener("click", onClose);

  function dispose() {
    hide();
    if (closeBtn) closeBtn.removeEventListener("click", onClose);
    lifetime = null;
    score = 0;
    equipped = null;
  }

  return {
    setEnabled,
    setScore,
    setEquipped,
    setLifetime,
    show,
    hide,
    toggle,
    handleResult,
    render,
    isOpen: () => open,
    isEnabled: () => enabled,
    dispose,
  };
}
