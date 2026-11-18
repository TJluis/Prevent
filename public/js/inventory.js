import { INVENTORY_SLOTS, getFood, getThrowable } from "./itemDefs.js";

export function createInventoryBar({ onUse, onThrow }) {
  const bar = document.createElement("div");
  bar.className = "item-bar";
  bar.hidden = true;

  const slots = [];
  for (let i = 0; i < INVENTORY_SLOTS; i++) {
    const slot = document.createElement("div");
    slot.className = "item-slot item-empty";
    slot.dataset.index = String(i);
    const keyBadge = document.createElement("span");
    keyBadge.className = "slot-key";
    keyBadge.textContent = String(i + 1);
    const icon = document.createElement("span");
    icon.className = "item-icon";
    const qty = document.createElement("span");
    qty.className = "item-qty";
    slot.append(keyBadge, icon, qty);
    // En pantalla táctil el "mousedown" sintético llega tarde o no llega:
    // seleccionamos con pointerdown y dejamos el doble toque nativo (dblclick).
    slot.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      select(i);
    });
    slot.addEventListener("mousedown", (event) => {
      if (event.pointerType === "touch") return;
      event.preventDefault();
      select(i);
    });
    slot.addEventListener("dblclick", () => use());
    bar.appendChild(slot);
    slots.push({ el: slot, icon, qty, keyBadge });
  }

  document.body.appendChild(bar);

  let enabled = false;
  let items = [];
  let selected = 0;

  function findDef(item) {
    if (!item) return null;
    return item.type === "food" ? getFood(item.id) : getThrowable(item.id);
  }

  function refreshSel() {
    slots.forEach((slot, i) => {
      slot.el.classList.toggle("item-selected", i === selected && !!items[i]);
    });
  }

  function refresh(list) {
    const prevId = items[selected] ? `${items[selected].type}:${items[selected].id}` : null;
    items = list || [];
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const item = items[i];
      const slot = slots[i];
      const def = findDef(item);
      if (item && def) {
        slot.icon.textContent = def.emoji;
        slot.qty.textContent = String(item.qty);
        slot.el.classList.toggle("item-food", item.type === "food");
        slot.el.classList.toggle("item-throwable", item.type === "throwable");
        slot.el.classList.remove("item-empty");
      } else {
        slot.icon.textContent = "";
        slot.qty.textContent = "";
        slot.el.classList.remove("item-food", "item-throwable");
        slot.el.classList.add("item-empty");
      }
    }
    if (prevId) {
      const idx = items.findIndex((it) => it && `${it.type}:${it.id}` === prevId);
      if (idx >= 0) selected = idx;
    }
    if (items.length === 0) selected = 0;
    else if (selected >= items.length) selected = 0;
    refreshSel();
  }

  function select(index) {
    selected = Math.max(0, Math.min(INVENTORY_SLOTS - 1, index));
    refreshSel();
  }

  function use() {
    if (!enabled) return;
    const item = items[selected];
    if (!item) return;
    if (item.type === "food") onUse(selected, item);
    else if (item.type === "throwable") onThrow(selected, item);
  }

  function setEnabled(value) {
    enabled = value;
    bar.hidden = !value;
  }

  function dispose() {
    bar.remove();
  }

  return {
    refresh,
    select,
    use,
    setEnabled,
    dispose,
  };
}