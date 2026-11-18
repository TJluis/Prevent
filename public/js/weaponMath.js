// Matemática pura de armas (cliente + servidor).
// Sin dependencias de navegador ni de Three.js: solo datos y funciones.

// Clases de arma y su ventana de alcance recomendada (metros).
// `min`/`max` se usan en las pruebas para evitar que un arma quede fuera de su
// rol (por ejemplo, una escopeta con alcance de francotirador).
export const WEAPON_CLASSES = {
  melee: { label: "Cuerpo a cuerpo", min: 1.8, max: 3.4 },
  sidearm: { label: "Pistola", min: 10, max: 16 },
  smg: { label: "Subfusil", min: 10, max: 14 },
  shotgun: { label: "Escopeta", min: 6, max: 10 },
  rifle: { label: "Rifle", min: 16, max: 26 },
  marksman: { label: "Precisión", min: 26, max: 42 },
  heavy: { label: "Pesada", min: 8, max: 16 },
  launcher: { label: "Lanzagranadas", min: 14, max: 20 },
  special: { label: "Especial", min: 16, max: 26 },
};

// Daño del arma a una distancia dada.
//  · Hasta `rangeMin` el daño es pleno.
//  · Desde `range` el daño se queda en `damage * falloff`.
//  · Entre ambos cae de forma lineal.
// Los cuerpos a cuerpo usan rangeMin 0 y falloff 1: daño constante.
export function damageAtRange(weapon, dist) {
  if (!weapon) return 0;
  const { rangeMin = 0, range, falloff = 1 } = weapon;
  if (!(range > 0)) return weapon.damage;
  const d = Number.isFinite(dist) ? Math.max(0, dist) : 0;
  if (d <= rangeMin) return weapon.damage;
  if (d >= range) return weapon.damage * falloff;
  const t = (d - rangeMin) / (range - rangeMin);
  return weapon.damage * (1 - t * (1 - falloff));
}

// Radio del rayo de impacto por clase. Los tiros de precisión perdonan menos
// y la escopeta algo más, para que su dispersión no se sienta injusta.
export const DEFAULT_RAY_RADIUS = 0.7;
export function rayRadiusFor(weapon) {
  if (!weapon) return DEFAULT_RAY_RADIUS;
  if (weapon.class === "marksman") return 0.55;
  if (weapon.class === "shotgun") return 0.9;
  return DEFAULT_RAY_RADIUS;
}
