// Comprueba que el HAND_TUNING que usa el juego (getGripPose de viewmodel.js)
// coincide exactamente con los valores ajustados a mano en el tuner.
// Uso: node public/test/runner.mjs public/test/t-tuningcheck.mjs
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { WEAPON_LIST } from "../js/weaponDefs.js";
import { getGripPose } from "../js/viewmodel.js";

function stubCanvas() {
  const ctx2d = new Proxy(
    {},
    {
      get: (t, k) => {
        if (k === "measureText") return () => ({ width: 40 });
        return () => {};
      },
      set: () => true,
    }
  );
  globalThis.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }),
  };
  globalThis.window = globalThis;
}
stubCanvas();

// Ruta configurable: TUNER_ESPERADO o, por defecto, la carpeta temporal.
// Si el archivo no existe, el test se salta (no falla la suite).
const ESPERADO_PATH =
  process.env.TUNER_ESPERADO || path.join(os.tmpdir(), "opencode", "tuning-esperado.json");
if (!existsSync(ESPERADO_PATH)) {
  console.log(`SKIP: falta ${ESPERADO_PATH} (valores esperados del tuner). Nada que comprobar.`);
  process.exit(0);
}
const ESPERADO = JSON.parse(readFileSync(ESPERADO_PATH, "utf8"));

const FIELDS = ["rightPos", "rightRot", "leftPos", "leftRot"];
const EPS = 0.0005;
let ok = 0;
let fail = 0;

for (const w of WEAPON_LIST) {
  const got = getGripPose(w.id);
  const exp = ESPERADO[w.id];
  if (!exp) {
    console.log(`FALLO ${w.id}: no hay valor esperado`);
    fail++;
    continue;
  }
  const bad = [];
  for (const f of FIELDS) {
    for (let i = 0; i < 3; i++) {
      if (Math.abs(got[f][i] - exp[f][i]) > EPS) {
        bad.push(`${f}[${"xyz"[i]}] juego=${got[f][i]} esperado=${exp[f][i]}`);
      }
    }
  }
  if (bad.length === 0) {
    ok++;
  } else {
    fail++;
    console.log(`FALLO ${w.id}:`);
    for (const b of bad) console.log(`    ${b}`);
  }
}

console.log(`tuning: ${ok} ok, ${fail} fail (armas: ${WEAPON_LIST.length})`);
