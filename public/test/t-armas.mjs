// Pruebas de la Fase 2: clases de arma, caída de daño, precios y las cuatro
// armas nuevas. Uso: node public/test/runner.mjs public/test/t-armas.mjs
import {
  WEAPONS,
  WEAPON_LIST,
  WEAPON_DEFAULT_ID,
  isCrystalWeapon,
} from "../js/weaponDefs.js";
import {
  WEAPON_CLASSES,
  damageAtRange,
  rayRadiusFor,
  DEFAULT_RAY_RADIUS,
} from "../js/weaponMath.js";
import { reloadProgress, reloadStyleFor } from "../js/viewmodel.js";

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
const ok = (v, msg) => {
  if (!v) throw new Error(msg);
};
const near = (a, b, eps, msg) => {
  if (Math.abs(a - b) > eps) throw new Error(`${msg}: espere ~${b} pero hay ${a}`);
};

const NEW_WEAPONS = ["revolver", "dmr", "martillo", "ballesta"];

t("ids únicos y coherentes con su clave", () => {
  eq(WEAPON_LIST.length, Object.keys(WEAPONS).length, "WEAPON_LIST");
  const seen = new Set();
  for (const [key, w] of Object.entries(WEAPONS)) {
    eq(w.id, key, `${key}.id`);
    ok(!seen.has(w.id), `id repetido: ${w.id}`);
    seen.add(w.id);
  }
});

t("todas las armas declaran una clase conocida y un alcance dentro de su rol", () => {
  for (const w of WEAPON_LIST) {
    const cls = WEAPON_CLASSES[w.class];
    ok(!!cls, `${w.id}: clase desconocida ${w.class}`);
    ok(w.range >= cls.min && w.range <= cls.max,
      `${w.id}: range ${w.range} fuera de ${w.class} [${cls.min}, ${cls.max}]`);
  }
});

t("precios: la pistola es gratis y el resto cuesta más de 0", () => {
  eq(WEAPONS[WEAPON_DEFAULT_ID].price, 0, "pistola.price");
  for (const w of WEAPON_LIST) {
    if (w.id === WEAPON_DEFAULT_ID) continue;
    ok(w.price > 0, `${w.id}: price=${w.price}`);
    ok(Number.isInteger(w.price), `${w.id}: price no entero`);
  }
});

t("cuerpo a cuerpo sin perdigones y con arco válido", () => {
  for (const w of WEAPON_LIST) {
    if (w.kind !== "melee") continue;
    eq(w.pellets, undefined, `${w.id}: pellets en melee`);
    ok(w.arc > 0 && w.arc <= Math.PI * 2, `${w.id}: arc=${w.arc}`);
    eq(w.mag, 0, `${w.id}: mag`);
    eq(w.reloadMs, 0, `${w.id}: reloadMs`);
  }
});

t("armas de fuego con cargador y recarga (láser infinito aparte)", () => {
  for (const w of WEAPON_LIST) {
    if (w.kind === "melee") continue;
    ok(w.pellets >= 1, `${w.id}: pellets=${w.pellets}`);
    if (w.id === "laser") {
      // El láser es el arma de munición infinita del juego.
      eq(w.mag, 0, "laser.mag");
      eq(w.reloadMs, 0, "laser.reloadMs");
      continue;
    }
    ok(w.mag > 0, `${w.id}: mag=${w.mag}`);
    ok(w.reloadMs > 0, `${w.id}: reloadMs=${w.reloadMs}`);
  }
});

t("caída de daño bien formada en todas las armas", () => {
  for (const w of WEAPON_LIST) {
    ok(w.falloff > 0 && w.falloff <= 1, `${w.id}: falloff=${w.falloff}`);
    ok(w.rangeMin >= 0, `${w.id}: rangeMin=${w.rangeMin}`);
    ok(w.rangeMin < w.range, `${w.id}: rangeMin ${w.rangeMin} >= range ${w.range}`);
    ok(w.damage > 0, `${w.id}: damage=${w.damage}`);
    ok(w.cooldownMs > 0, `${w.id}: cooldownMs=${w.cooldownMs}`);
  }
});

t("el escudo mantiene su configuración de bloqueo", () => {
  const block = WEAPONS.escudo.block;
  ok(!!block, "escudo sin block");
  eq(block.reduction, 1, "reduction");
  eq(block.arc, 2.4, "arc");
  eq(block.staminaMax, 100, "staminaMax");
  eq(block.staminaDrain, 28, "staminaDrain");
  eq(block.regen, 14, "regen");
  eq(block.regenDelayMs, 600, "regenDelayMs");
  eq(block.breakMs, 1200, "breakMs");
  eq(block.moveScale, 0.55, "moveScale");
});

t("damageAtRange: pleno, lineal y mínimo al alcance máximo", () => {
  const pistola = WEAPONS.pistola;
  eq(damageAtRange(pistola, 0), 12, "pistola a 0");
  eq(damageAtRange(pistola, 8), 12, "pistola a rangeMin");
  near(damageAtRange(pistola, 14), 8.4, 1e-9, "pistola a range");
  near(damageAtRange(pistola, 99), 8.4, 1e-9, "pistola fuera de alcance");
  near(damageAtRange(pistola, 11), 10.2, 1e-9, "pistola a mitad de caída");

  near(damageAtRange(WEAPONS.shotgun, 4), 8, 1e-9, "escopeta a rangeMin");
  near(damageAtRange(WEAPONS.shotgun, 9), 2.4, 1e-9, "escopeta al máximo");
  near(damageAtRange(WEAPONS.shotgun, 6.5), 5.2, 1e-9, "escopeta a mitad");

  near(damageAtRange(WEAPONS.sniper, 38), 52.25, 1e-9, "francotirador al máximo");
  eq(damageAtRange(WEAPONS.espada, 2.6), 34, "melee constante");
  eq(damageAtRange(null, 3), 0, "sin arma");
});

t("damageAtRange nunca sube con la distancia", () => {
  for (const w of WEAPON_LIST) {
    let prev = damageAtRange(w, 0);
    for (let d = 0; d <= w.range + 5; d += 0.25) {
      const dmg = damageAtRange(w, d);
      ok(dmg <= prev + 1e-9, `${w.id} sube en d=${d}: ${prev} -> ${dmg}`);
      prev = dmg;
    }
  }
});

t("radio de rayo por clase", () => {
  eq(rayRadiusFor(WEAPONS.sniper), 0.55, "marksman");
  eq(rayRadiusFor(WEAPONS.dmr), 0.55, "dmr");
  eq(rayRadiusFor(WEAPONS.shotgun), 0.9, "shotgun");
  eq(rayRadiusFor(WEAPONS.pistola), DEFAULT_RAY_RADIUS, "pistola");
  eq(rayRadiusFor(null), DEFAULT_RAY_RADIUS, "sin arma");
});

t("las cuatro armas nuevas existen, cuestan y salen en cristales", () => {
  for (const id of NEW_WEAPONS) {
    const w = WEAPONS[id];
    ok(!!w, `falta ${id}`);
    eq(isCrystalWeapon(id), true, `${id} no está en el pool de cristales`);
    ok(w.price > 0, `${id}: price`);
    ok(!!WEAPON_CLASSES[w.class], `${id}: class`);
  }
});

t("estilo de recarga por arma (Fase 5)", () => {
  for (const id of ["pistola", "revolver", "smg", "assault", "dmr", "granade", "plasma", "llama"]) {
    eq(reloadStyleFor(id), "mag", `${id} debería usar cargador`);
  }
  eq(reloadStyleFor("shotgun"), "shell", "escopeta: bombeo");
  for (const id of ["sniper", "arco", "ballesta"]) {
    eq(reloadStyleFor(id), "bolt", `${id} debería usar cerrojo`);
  }
  eq(reloadStyleFor("minigun"), "spin", "minigun: rotor");
  eq(reloadStyleFor("laser"), "none", "láser: sin recarga");
  for (const w of WEAPON_LIST) {
    if (w.kind === "melee") eq(reloadStyleFor(w.id), "none", `${w.id}: melee sin recarga`);
  }
  eq(reloadStyleFor(null), "none", "sin arma");
});

t("reloadProgress: 0→1, acotado y tolerante a datos inválidos", () => {
  eq(reloadProgress(1000, 1000, 500), 0, "al empezar");
  near(reloadProgress(1250, 1000, 500), 0.5, 1e-9, "a mitad");
  eq(reloadProgress(1500, 1000, 500), 1, "al terminar");
  eq(reloadProgress(9999, 1000, 500), 1, "después de terminar");
  eq(reloadProgress(900, 1000, 500), 0, "antes de empezar");
  eq(reloadProgress(1200, 1000, 0), 0, "duración 0");
  eq(reloadProgress(1200, 1000, -5), 0, "duración negativa");
  eq(reloadProgress(NaN, 1000, 500), 0, "now inválido");
});

const total = results.length;
const passed = results.filter((r) => r.ok).length;
console.log(`\nRESULTADO armas: ${passed}/${total} ok`);
if (passed !== total) {
  for (const r of results) {
    if (!r.ok) console.log(`  - ${r.name}: ${r.extra}`);
  }
  process.exitCode = 1;
}
