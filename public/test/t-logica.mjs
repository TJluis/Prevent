import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

// Raíz del proyecto calculada desde la ubicación de este archivo:
// así los tests siempre prueban la copia en la que se editan.
const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const url = (rel) => pathToFileURL(path.join(PROJ, rel)).href;

const results = [];
function t(name, ok, extra = "") {
  let passed = ok;
  let detail = extra;
  // Las aserciones se escriben como callbacks; hay que ejecutarlas. Antes se
  // guardaba la función (siempre truthy) y los fallos quedaban ocultos.
  if (typeof ok === "function") {
    try {
      ok();
      passed = true;
    } catch (err) {
      passed = false;
      detail = err && err.message ? err.message : String(err);
    }
  }
  results.push({ name, ok: passed, extra: detail });
  if (!passed) console.log("FAIL: " + name + (detail ? " | " + detail : ""));
  else console.log("ok  : " + name);
}

const WPN = await import(url("public/js/weaponDefs.js"));
const ITM = await import(url("public/js/itemDefs.js"));
const MAP = await import(url("public/js/mapDefs.js"));
const APP = await import(url("server/appearance.js"));
const WLD = await import(url("public/js/world.js"));
const COL = await import(url("public/js/collision.js"));
const MOB = await import(url("public/js/mapObstacles.js"));

t("arma: todos los ids resuelven y tienen forma válida", () => {
  const ids = Object.keys(WPN.WEAPONS);
  if (ids.length < 15) throw new Error(`pocas armas: ${ids.length}`);
  for (const id of ids) {
    const w = WPN.WEAPONS[id];
    if (typeof w.name !== "string" || !w.name.trim()) throw new Error(`${id} sin name`);
    if (!["hitscan", "melee", "splash"].includes(w.kind)) throw new Error(`${id} kind=${w.kind}`);
    if (!(w.damage > 0)) throw new Error(`${id} damage=${w.damage}`);
    if (!(w.range > 0)) throw new Error(`${id} range=${w.range}`);
    if (!(w.cooldownMs > 0)) throw new Error(`${id} cooldownMs=${w.cooldownMs}`);
    if (!(typeof w.mag === "number" && w.mag >= 0)) throw new Error(`${id} mag=${w.mag}`);
    if (w.kind === "hitscan" && !(w.pellets >= 1)) throw new Error(`${id} pellets`);
    if (w.kind === "melee" && !(w.arc > 0 && w.arc <= Math.PI * 2)) throw new Error(`${id} arc=${w.arc}`);
    if (w.kind === "splash" && !(w.splash > 0)) throw new Error(`${id} splash`);
  }
});

t("arma: getWeapon fallback a default y isCrystalWeapon lo excluye", () => {
  const def = WPN.getWeapon("no_existe");
  if (!def || !def.id) throw new Error("getWeapon sin default");
  if (WPN.isCrystalWeapon(def.id)) throw new Error("default tratado como cristal");
  if (!WPN.isCrystalWeapon("espada")) throw new Error("espada no es cristal");
  if (WPN.getWeapon(null).id !== WPN.WEAPON_DEFAULT_ID) throw new Error("null no devuelve default");
});

t("itemDefs: inventario, pesos y resolución", () => {
  if (!(ITM.INVENTORY_SLOTS >= 3)) throw new Error("slots");
  for (const [id, d] of Object.entries(ITM.FOODS)) {
    if (d.id !== id || typeof d.name !== "string" || !(d.heal > 0) || !(d.weight > 0))
      throw new Error(`food ${id} roto`);
  }
  for (const [id, d] of Object.entries(ITM.THROWABLES)) {
    if (d.id !== id || typeof d.name !== "string" || !(d.damage > 0) || !(d.weight > 0))
      throw new Error(`throwable ${id} roto`);
  }
  if (ITM.getFood("pescado_ahumado").heal !== 35) throw new Error("getFood");
  if (ITM.getThrowable("bola_nieve").slowMs !== 2000) throw new Error("getThrowable");
  if (ITM.getLootItem("food", "pulpo_vapor") === null) throw new Error("getLootItem food");
  if (ITM.getLootItem("nada", "x") !== null) throw new Error("getLootItem inválido");
});

t("itemDefs: rollCrystalType dentro de {weapon,food,throwable}", () => {
  const real = Math.random;
  const seen = new Set();
  // Probamos cada rama con un valor determinista: 0,01 → lanzable (15 %),
  // 0,20 → comida (25 %) y 0,90 → arma (60 % restante).
  try {
    for (const value of [0.01, 0.2, 0.9]) {
      Math.random = () => value;
      seen.add(ITM.rollCrystalType());
    }
  } finally {
    Math.random = real;
  }
  if (!seen.has("weapon") || !seen.has("food") || !seen.has("throwable"))
    throw new Error(`rolls fuera de rango: ${[...seen].join(",")}`);
  if (seen.size !== 3) throw new Error(`tipos raros: ${[...seen].join(",")}`);
});

t("mapDefs: mapas de sala únicos, con límite y cristales", () => {
  const roomMaps = MAP.getRoomMaps();
  if (roomMaps.length < 2) throw new Error("pocos mapas de sala");
  const ids = roomMaps.map((m) => m.id);
  if (new Set(ids).size !== ids.length) throw new Error("ids duplicados");
  for (const id of ids) {
    const b = MAP.getMapBoundary(id);
    if (!(b > 0)) throw new Error(`${id} límite ${JSON.stringify(b)}`);
    if (!(MAP.MAP_LOOT_COUNTS[id] >= 4)) throw new Error(`${id} pocos cristales`);
  }
  if (!MAP.getMap("no_existe")) throw new Error("getMap debe tener fallback");
  for (const map of roomMaps) {
    if (map.id === "cordillera") continue;
    if (map.size !== 120) throw new Error(`${map.id} debería medir 120 (mide ${map.size})`);
  }
});

t("mapObstacles: coberturas amplias, dentro del mapa y centro libre", () => {
  for (const map of MAP.getRoomMaps()) {
    if (map.id === "cordillera") continue;
    const list = MOB.getMapObstacles(map.id);
    if (!Array.isArray(list) || list.length < 40)
      throw new Error(`${map.id} sin coberturas suficientes (${list ? list.length : 0})`);
    const limit = MAP.getMapBoundary(map.id) - 1;
    for (const o of list) {
      const ext = o.type === "box" ? Math.max(o.w || 1, o.d || 1) / 2 : o.r || 1;
      if (Math.hypot(o.x, o.z) + ext > limit)
        throw new Error(`${map.id}: ${o.kind} en (${o.x}, ${o.z}) se sale del mapa`);
    }
    if (MOB.isInsideObstacle(map.id, 0, 0))
      throw new Error(`${map.id}: el centro está bloqueado`);
    const box = list.find((o) => o.type === "box");
    if (box && !MOB.isInsideObstacle(map.id, box.x, box.z))
      throw new Error(`${map.id}: isInsideObstacle no detecta la caja`);
  }
});

t("appearance: normalizeAppearance sane", () => {
  const base = APP.normalizeAppearance(null);
  if (typeof base.body !== "string" || base.number !== null) throw new Error("null no sane");
  const good = APP.normalizeAppearance({ body: "#c0392b", number: "9", jerseyName: "  Ana  " });
  if (good.body !== "#c0392b" || good.number !== "9" || good.jerseyName !== "Ana")
    throw new Error("campos válidos no pasaron");
  const bad = APP.normalizeAppearance({ body: "rojo", number: "x", jerseyName: "a".repeat(40) });
  if (bad.body !== APP.DEFAULT_APPEARANCE.body || bad.number !== null) throw new Error("garbage no sanitizado");
  if (bad.jerseyName.length > 12) throw new Error("jerseyName sin tope");
});

t("collision: clamp de borde y expulsión de obstáculos", () => {
  const b = MAP.getMapBoundary("nevado");
  const moved = COL.moveWithCollisions(1e6, 0, "nevado");
  if (!(moved.x <= b)) throw new Error(`sin clamp: ${moved.x} > ${b}`);
  const obs = WLD.getMapObstacles("nevado");
  if (!Array.isArray(obs) || obs.length === 0) throw new Error("sin obstáculos");
  const box = obs.find((o) => o.type === "box");
  if (!box) throw new Error("hay que tener un box en nevado");
  const res = COL.moveWithCollisions(box.x, box.z, "nevado");
  const inside = Math.abs(res.x - box.x) < box.w / 2 && Math.abs(res.z - box.z) < box.d / 2;
  if (inside) throw new Error(`siguió dentro del obstáculo (${res.x},${res.z})`);
});

const total = results.length;
const ok = results.filter((r) => r.ok).length;
console.log(`\nRESULTADO lógica: ${ok}/${total} ok`);
if (ok !== total) process.exitCode = 1;