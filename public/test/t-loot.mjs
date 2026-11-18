// Prueba la recogida de cristales con Enter (loot.js acceptOffer) sin navegador.
// Uso: node public/test/runner.mjs public/test/t-loot.mjs
import { createLoot } from "../js/loot.js";

// --- Stubs mínimos de DOM/canvas para que loot.js pueda construir la UI ---
function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    className: "",
    hidden: false,
    textContent: "",
    children: [],
    listeners: {},
    style: {},
    width: 0,
    height: 0,
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    },
    append(...kids) {
      this.children.push(...kids);
    },
    remove() {},
    getContext() {
      return {
        createRadialGradient: () => ({ addColorStop() {} }),
        fillRect() {},
        set fillStyle(_v) {},
      };
    },
  };
  return el;
}

globalThis.document = {
  createElement: (tag) => makeEl(tag),
  body: { appendChild() {} },
};
globalThis.window = globalThis;

const results = [];
function t(name, ok, extra = "") {
  results.push({ name, ok, extra });
  if (!ok) console.log("FAIL: " + name + (extra ? " | " + extra : ""));
  else console.log("ok  : " + name);
}

const asked = [];
const responded = [];
let pos = { x: 0, z: 0 };

const loot = createLoot({
  getOwnPosition: () => pos,
  onPickup: (id) => asked.push(id),
  onRespond: (id, accept) => responded.push({ id, accept }),
  hasWeapon: () => false,
  getMapId: () => "nevado",
});

t("acceptOffer sin oferta devuelve false", () => {
  if (loot.acceptOffer() !== false) throw new Error("debería devolver false");
});

loot.setCrystals([{ id: 1, x: 0, z: 0, type: "weapon" }]);
pos = { x: 0, z: 0 };
loot.update(0, 0.016);
t("acercarse pide la oferta del cristal", () => {
  if (asked.length === 0) throw new Error("no se pidió la oferta");
  if (asked[0] !== 1) throw new Error(`id inesperado: ${asked[0]}`);
});

// El servidor responde con la oferta (arma concreta).
loot.offer({ crystalId: 1, weaponId: "pistola" });
t("con oferta visible, acceptOffer devuelve true", () => {
  if (loot.acceptOffer() !== true) throw new Error("debería devolver true");
});
t("acceptOffer responde aceptando el cristal", () => {
  const last = responded[responded.length - 1];
  if (!last || last.id !== 1 || last.accept !== true) {
    throw new Error(`respuesta inesperada: ${JSON.stringify(last)}`);
  }
});
t("tras aceptar, ya no hay oferta pendiente", () => {
  if (loot.acceptOffer() !== false) throw new Error("la oferta debería haberse cerrado");
});

// Tras responder, el cristal queda suprimido unos 1,6 s: no debe re-pedirse.
asked.length = 0;
pos = { x: 0, z: 0 };
loot.update(0.1, 0.016);
t("el cristal aceptado no se vuelve a pedir de inmediato", () => {
  if (asked.length !== 0) throw new Error(`se re-pidió: ${asked.length}`);
});

// Cristal fuera de rango: no se pide.
const asked2 = [];
const loot2 = createLoot({
  getOwnPosition: () => ({ x: 50, z: 50 }),
  onPickup: (id) => asked2.push(id),
  onRespond: () => {},
  hasWeapon: () => false,
  getMapId: () => "nevado",
});
loot2.setCrystals([{ id: 2, x: 0, z: 0, type: "weapon" }]);
loot2.update(0, 0.016);
t("un cristal lejano no se ofrece", () => {
  if (asked2.length !== 0) throw new Error("se ofreció un cristal lejano");
});

loot.dispose();
loot2.dispose();

const total = results.length;
const ok = results.filter((r) => r.ok).length;
console.log(`\nRESULTADO loot: ${ok}/${total} ok`);
if (ok !== total) process.exitCode = 1;
