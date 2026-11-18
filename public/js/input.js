const keys = new Set();

const MOVEMENT_KEYS = new Set([
  "w", "a", "s", "d",
  "arrowup", "arrowdown", "arrowleft", "arrowright",
]);

export function isTyping() {
  const el = document.activeElement;
  return !!(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable));
}

addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (isTyping()) return;
  if (MOVEMENT_KEYS.has(key)) {
    event.preventDefault();
  }
  keys.add(key);
});

addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

addEventListener("focusin", () => {
  if (isTyping()) keys.clear();
});

addEventListener("blur", () => keys.clear());
addEventListener("visibilitychange", () => keys.clear());

export function getInputDirection() {
  if (isTyping()) return { dx: 0, dz: 0 };

  let dx = 0;
  let dz = 0;

  if (keys.has("w") || keys.has("arrowup")) dz -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dz += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;

  return { dx, dz };
}

// Fase 4: Shift se consulta cada frame; el resto de teclas de movimiento ya
// están en `keys`. Se expone para no duplicar el registro de teclas en main.js.
export function isKeyDown(key) {
  return keys.has(String(key).toLowerCase());
}