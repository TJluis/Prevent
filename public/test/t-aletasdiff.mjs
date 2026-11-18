// Compara los valores que guardó el tuner de aletas contra los valores por
// defecto que usa el juego (getGripPose de viewmodel.js), para saber qué armas
// se han modificado y en qué campos.
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

// Ruta configurable: TUNER_OUT o, por defecto, la carpeta temporal del sistema.
// Si el archivo no existe, el test se salta (no falla la suite).
const OUT = process.env.TUNER_OUT || path.join(os.tmpdir(), "opencode", "tuner-out.json");
if (!existsSync(OUT)) {
  console.log(`SKIP: falta ${OUT} (salida del tuner de aletas). Nada que comparar.`);
  process.exit(0);
}
const data = JSON.parse(readFileSync(OUT, "utf8"));

const EPS = 0.0005;
const FIELDS = ["rightPos", "rightRot", "leftPos", "leftRot"];

let changed = 0;
const lines = [];

for (const w of WEAPON_LIST) {
  const saved = data.tuning[w.id];
  if (!saved) {
    lines.push(`${w.id.padEnd(10)} SIN DATOS en el tuner`);
    continue;
  }
  const base = getGripPose(w.id);
  const diffs = [];
  for (const f of FIELDS) {
    for (let i = 0; i < 3; i++) {
      const d = (saved[f]?.[i] ?? NaN) - (base[f][i] ?? NaN);
      if (!Number.isFinite(d) || Math.abs(d) > EPS) {
        diffs.push(`${f}[${"xyz"[i]}] ${fmt(saved[f]?.[i])} -> ${fmt(base[f][i])} (${d > 0 ? "+" : ""}${d.toFixed(3)})`);
      }
    }
  }
  if (diffs.length === 0) {
    lines.push(`${w.id.padEnd(10)} sin cambios`);
  } else {
    changed++;
    lines.push(`${w.id.padEnd(10)} ${diffs.length} cambios`);
    for (const d of diffs) lines.push(`    ${d}`);
  }
}

function fmt(v) {
  return Number.isFinite(v) ? v.toFixed(3) : String(v);
}

console.log(`generado: ${data.generated}`);
console.log(`armas en el tuner: ${Object.keys(data.tuning).length} / ${WEAPON_LIST.length}`);
console.log(`errores JS: ${(data.errors || []).length}`);
console.log(`armas modificadas: ${changed}`);
console.log(lines.join("\n"));
