// Pruebas de la matemática del escudo (bloqueo frontal con aguante).
// Uso: node public/test/runner.mjs public/test/t-combate.mjs
import {
  BLOCK_STAMINA_MAX,
  getBlockConfig,
  facingVector,
  blockArcCos,
  isInBlockArc,
  computeBlockedDamage,
} from "../js/combatMath.js";
import { WEAPONS } from "../js/weaponDefs.js";

const results = [];
function t(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log("ok  : " + name);
  } catch (err) {
    results.push({ name, ok: false, extra: err.message });
    console.log("FAIL: " + name + " | " + err.message);
  }
}
const eq = (a, b, msg) => {
  if (a !== b) throw new Error(`${msg}: espere ${JSON.stringify(b)} pero hay ${JSON.stringify(a)}`);
};
const near = (a, b, eps, msg) => {
  if (Math.abs(a - b) > eps) throw new Error(`${msg}: espere ~${b} pero hay ${a}`);
};

const NOW = 10_000;
const makeTarget = (over = {}) => ({
  id: "t",
  weaponId: "escudo",
  blocking: true,
  blockStamina: BLOCK_STAMINA_MAX,
  blockBrokenUntil: 0,
  yaw: 0, // mira hacia -Z
  x: 0,
  z: 0,
  ...over,
});

t("el escudo tiene configuración de bloqueo", () => {
  const cfg = getBlockConfig("escudo");
  if (!cfg) throw new Error("sin config de bloqueo");
  eq(cfg.reduction, 1, "reduction");
  eq(cfg.arc, 2.4, "arc");
  eq(cfg.staminaDrain, 28, "staminaDrain");
  eq(cfg.moveScale, 0.55, "moveScale");
  eq(cfg.breakMs, 1200, "breakMs");
});

t("un arma sin escudo no tiene bloqueo", () => {
  eq(getBlockConfig("pistola"), null, "pistola");
  eq(getBlockConfig(null), null, "sin arma");
});

t("el escudo sigue siendo melee con golpe de 18", () => {
  const w = WEAPONS.escudo;
  eq(w.kind, "melee", "kind");
  eq(w.damage, 18, "damage");
  eq(w.range, 2.2, "range");
  eq(w.cooldownMs, 700, "cooldownMs");
});

t("facingVector apunta hacia -Z con yaw 0", () => {
  const f = facingVector(0);
  near(f.x, 0, 1e-9, "x");
  near(f.z, -1, 1e-9, "z");
});

t("facingVector gira con el yaw", () => {
  const f = facingVector(Math.PI / 2);
  near(f.x, -1, 1e-9, "x");
  near(f.z, 0, 1e-9, "z");
});

t("blockArcCos usa la mitad del arco", () => {
  near(blockArcCos({ arc: 2.4 }), Math.cos(1.2), 1e-9, "cos");
});

t("un atacante de frente está en el arco", () => {
  const target = makeTarget();
  const shooter = { x: 0, z: -2 };
  eq(isInBlockArc(target, shooter, getBlockConfig("escudo")), true, "frente");
});

t("un atacante por detrás NO está en el arco", () => {
  const target = makeTarget();
  const shooter = { x: 0, z: 2 };
  eq(isInBlockArc(target, shooter, getBlockConfig("escudo")), false, "detrás");
});

t("un atacante de lado NO está en el arco", () => {
  const target = makeTarget();
  const shooter = { x: 2, z: 0 };
  eq(isInBlockArc(target, shooter, getBlockConfig("escudo")), false, "lado");
});

t("el borde interior del arco bloquea", () => {
  const target = makeTarget();
  const a = 1.0; // < 1.2 rad
  const shooter = { x: Math.sin(a) * 2, z: -Math.cos(a) * 2 };
  eq(isInBlockArc(target, shooter, getBlockConfig("escudo")), true, "borde interior");
});

t("el borde exterior del arco no bloquea", () => {
  const target = makeTarget();
  const a = 1.4; // > 1.2 rad
  const shooter = { x: Math.sin(a) * 2, z: -Math.cos(a) * 2 };
  eq(isInBlockArc(target, shooter, getBlockConfig("escudo")), false, "borde exterior");
});

t("bloqueo frontal anula el 100 % del daño", () => {
  const target = makeTarget();
  const r = computeBlockedDamage(target, { x: 0, z: -2 }, 34, NOW);
  eq(r.blocked, true, "blocked");
  eq(r.damage, 0, "damage");
});

t("un golpe por detrás entra completo", () => {
  const target = makeTarget();
  const r = computeBlockedDamage(target, { x: 0, z: 2 }, 34, NOW);
  eq(r.blocked, false, "blocked");
  eq(r.damage, 34, "damage");
});

t("sin escudo no se bloquea", () => {
  const target = makeTarget({ weaponId: "espada" });
  const r = computeBlockedDamage(target, { x: 0, z: -2 }, 34, NOW);
  eq(r.blocked, false, "blocked");
  eq(r.damage, 34, "damage");
});

t("sin levantar el escudo no se bloquea", () => {
  const target = makeTarget({ blocking: false });
  const r = computeBlockedDamage(target, { x: 0, z: -2 }, 34, NOW);
  eq(r.blocked, false, "blocked");
  eq(r.damage, 34, "damage");
});

t("con aguante a 0 no se bloquea", () => {
  const target = makeTarget({ blockStamina: 0 });
  const r = computeBlockedDamage(target, { x: 0, z: -2 }, 34, NOW);
  eq(r.blocked, false, "blocked");
  eq(r.damage, 34, "damage");
});

t("durante el guard break no se bloquea", () => {
  const target = makeTarget({ blockStamina: 0, blockBrokenUntil: NOW + 500 });
  const r = computeBlockedDamage(target, { x: 0, z: -2 }, 34, NOW);
  eq(r.blocked, false, "blocked");
  eq(r.damage, 34, "damage");
});

t("al terminar el guard break vuelve a bloquear", () => {
  const target = makeTarget({ blockBrokenUntil: NOW - 1 });
  const r = computeBlockedDamage(target, { x: 0, z: -2 }, 34, NOW);
  eq(r.blocked, true, "blocked");
  eq(r.damage, 0, "damage");
});

const total = results.length;
const ok = results.filter((r) => r.ok).length;
console.log(`\nRESULTADO combate: ${ok}/${total} ok`);
if (ok !== total) process.exitCode = 1;
