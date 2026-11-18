// Layouts de obstáculos compartidos entre el cliente (world.js) y el servidor
// (game.js). Es un módulo puro: no importa three.js ni toca el DOM, así que Node
// puede cargarlo para validar spawns de cristales sin montar el renderer.
//
// Principios de diseño PVP aplicados (arena shooters tipo Quake/Unreal/Halo):
// - Bucles de movimiento: anillos a varias distancias para rotar por el mapa sin
//   depender de un único pasillo.
// - Tres carriles: exterior, medio e interior, con coberturas escalonadas.
// - Control de líneas de visión: piezas altas (edificios, pilares, ruinas) y
//   bajas (cajas, rocas) alternadas; ninguna avenida recta queda limpia.
// - Plaza central despejada (~10 m): se lee el combate y ningún spawn queda
//   atrapado entre coberturas.
// - Simetría 180°: cada cobertura tiene su pareja opuesta, así ambos lados del
//   mapa ofrecen las mismas ventajas.
import { HUB_PORTALS } from "./hubDefs.js";

const TAU = Math.PI * 2;
const round = (value) => Math.round(value * 100) / 100;

// Anillo de obstáculos circulares. El jitter alterno mantiene la simetría 180°
// cuando el número de piezas es par (el opuesto conserva el mismo desplazamiento).
function ring(list, kind, radius, count, opts = {}) {
  const { offset = 0, r = 1, jitter = 0, type = "circle", ...rest } = opts;
  for (let i = 0; i < count; i++) {
    const angle = offset + (i / count) * TAU;
    const rr = radius + (i % 2 === 0 ? jitter : -jitter);
    list.push({
      kind,
      type,
      x: round(Math.cos(angle) * rr),
      z: round(Math.sin(angle) * rr),
      r,
      ...rest,
    });
  }
}

// Anillo de cajas (edificios de Ciudad Neón). Las cajas no se rotan al
// renderizar, así que la colisión axis-aligned coincide con la malla.
function boxRing(list, kind, radius, count, opts = {}) {
  const { offset = 0, w = 6, d = w, h = 4, jitter = 0 } = opts;
  for (let i = 0; i < count; i++) {
    const angle = offset + (i / count) * TAU;
    const rr = radius + (i % 2 === 0 ? jitter : -jitter);
    list.push({
      kind,
      type: "box",
      x: round(Math.cos(angle) * rr),
      z: round(Math.sin(angle) * rr),
      w,
      d,
      h,
    });
  }
}

// Añade una pieza y su opuesta (rotación de 180° respecto al centro).
function pair(list, obstacle) {
  list.push(obstacle);
  list.push({ ...obstacle, x: round(-obstacle.x), z: round(-obstacle.z) });
}

// Pares de cajas: [x, z, ancho] o [x, z, ancho, fondo].
function boxes(list, kind, items) {
  for (const [x, z, w, d] of items) {
    pair(list, { kind, type: "box", x, z, w, d: d || w });
  }
}

function rocks(list, items) {
  for (const [x, z, r] of items) {
    pair(list, { kind: "rock", type: "circle", x, z, r });
  }
}

// --- Selva Tropical ---------------------------------------------------------
// Árboles en dos anillos (cobertura visual + flanqueo), rocas en el carril
// interior y cajas en los cruces. Total: 60 obstáculos.
const selva = [];
ring(selva, "leaf", 52, 16, { r: 1.25, jitter: 1.2 });
ring(selva, "leaf", 38, 12, { offset: Math.PI / 12, r: 1.05, jitter: 1.0 });
ring(selva, "rock", 26, 8, { offset: Math.PI / 8, r: 1.45, jitter: 0.8 });
boxes(selva, "crate", [
  [14, 6, 2.4],
  [30, 14, 2.8],
  [44, 26, 2.4],
  [20, 32, 2.2],
  [6, 20, 2.0],
  [36, 4, 2.6],
  [48, 10, 2.2],
  [12, 44, 2.4],
]);
rocks(selva, [
  [24, 44, 1.7],
  [42, 34, 1.5],
  [18, 20, 1.2],
  [42, 16, 1.3],
]);

// --- Desierto Árido ---------------------------------------------------------
// Cactus ligeros en los carriles exteriores, ruinas altas como cobertura dura y
// rocas/cajas para romper las líneas de tiro. Total: 64 obstáculos.
const desierto = [];
ring(desierto, "cactus", 52, 16, { offset: Math.PI / 16, r: 0.62, jitter: 1.4 });
ring(desierto, "rock", 38, 12, { r: 1.5, jitter: 1.0 });
ring(desierto, "cactus", 26, 8, { offset: Math.PI / 8, r: 0.58, jitter: 0.8 });
for (const [x, z, w, d] of [
  [18, 18, 7, 6],
  [38, 10, 6, 7],
  [12, 38, 8, 5],
  [32, 32, 6, 6],
]) {
  pair(desierto, { kind: "ruin", type: "box", x, z, w, d });
}
boxes(desierto, "crate", [
  [14, 6, 2.4],
  [28, 20, 2.2],
  [44, 26, 2.6],
  [6, 26, 2.0],
  [30, 4, 2.2],
  [48, 14, 2.4],
]);
rocks(desierto, [
  [22, 42, 1.6],
  [42, 32, 1.5],
  [8, 14, 1.2],
  [40, 22, 1.3],
]);

// --- Tierras Volcánicas -----------------------------------------------------
// Pilares de basalto como cobertura alta en dos anillos, rocas en el carril
// interior y cajas junto a los cruces. Total: 50 obstáculos.
const volcan = [];
ring(volcan, "pillar", 50, 12, { r: 0.85, h: 4.2, jitter: 1.2 });
ring(volcan, "pillar", 36, 10, { offset: Math.PI / 10, r: 0.8, h: 3.8, jitter: 1.0 });
ring(volcan, "rock", 24, 8, { offset: Math.PI / 8, r: 1.4, jitter: 0.8 });
boxes(volcan, "crate", [
  [14, 6, 2.4],
  [28, 18, 2.2],
  [40, 30, 2.6],
  [8, 28, 2.2],
  [34, 6, 2.4],
  [48, 14, 2.2],
]);
rocks(volcan, [
  [20, 40, 1.7],
  [42, 34, 1.5],
  [10, 14, 1.2],
  [38, 22, 1.3],
]);

// --- Pradera de Flores ------------------------------------------------------
// Misma estructura de carriles que Selva, con árboles frutales y rocas bajas:
// mucha cobertura visual pero pasos amplios. Total: 50 obstáculos.
const pradera = [];
ring(pradera, "leaf", 50, 12, { r: 1.05, jitter: 1.2 });
ring(pradera, "leaf", 36, 10, { offset: Math.PI / 10, r: 0.95, jitter: 1.0 });
ring(pradera, "rock", 24, 8, { offset: Math.PI / 8, r: 1.3, jitter: 0.8 });
boxes(pradera, "crate", [
  [14, 6, 2.4],
  [28, 18, 2.2],
  [42, 30, 2.6],
  [8, 28, 2.2],
  [34, 6, 2.4],
  [48, 14, 2.2],
]);
rocks(pradera, [
  [20, 40, 1.6],
  [42, 34, 1.4],
  [10, 14, 1.2],
  [38, 22, 1.3],
]);

// --- Ciudad Neón ------------------------------------------------------------
// Edificios altos en el anillo exterior, pilares de neón en dos carriles y
// cajas de suministros en los cruces. Total: 48 obstáculos.
const ciudad = [];
boxRing(ciudad, "building", 46, 8, { offset: Math.PI / 8, w: 6, d: 6, h: 4.6, jitter: 0.6 });
ring(ciudad, "pillar", 34, 12, { r: 0.55, h: 3.4, jitter: 0.6 });
ring(ciudad, "pillar", 20, 8, { offset: Math.PI / 8, r: 0.5, h: 3.0, jitter: 0.5 });
boxes(ciudad, "crate", [
  [14, 6, 2.2],
  [26, 14, 2.4],
  [44, 30, 2.2],
  [8, 28, 2.0],
  [36, 6, 2.2],
  [50, 16, 2.0],
  [12, 46, 2.0],
  [38, 38, 2.2],
  [22, 48, 2.0],
  [46, 6, 2.0],
]);

// --- Gruta Luminosa ---------------------------------------------------------
// Rocas en dos anillos, pilares de cristal y estalagmitas cerca del centro,
// setas como cobertura baja. Total: 52 obstáculos.
const gruta = [];
ring(gruta, "rock", 50, 12, { r: 1.5, jitter: 1.4 });
ring(gruta, "rock", 36, 10, { offset: Math.PI / 10, r: 1.3, jitter: 1.0 });
ring(gruta, "pillar", 24, 8, { offset: Math.PI / 8, r: 0.6, h: 4.0, jitter: 0.6 });
ring(gruta, "stalagmite", 14, 6, { offset: Math.PI / 6, r: 0.75, jitter: 0.5 });
for (const [x, z, r] of [
  [8, 6, 0.7],
  [26, 20, 0.75],
  [38, 10, 0.7],
  [16, 36, 0.7],
  [44, 28, 0.7],
]) {
  pair(gruta, { kind: "shroom", type: "circle", x, z, r });
}
rocks(gruta, [
  [20, 40, 1.6],
  [42, 34, 1.4],
  [6, 16, 1.2],
]);

// --- Isla de Minijuegos -----------------------------------------------------
// Un monolito por portal (las coordenadas vienen de hubDefs para que cliente y
// servidor no se desincronicen), un monumento central y vegetación en el borde.
// El anillo queda despejado para poder caminar de portal en portal.
const isla = [
  { kind: "monument", type: "circle", x: 0, z: 0, r: 2.6 },
  ...HUB_PORTALS.map((portal) => ({
    kind: "monolith",
    type: "circle",
    x: portal.x,
    z: portal.z,
    r: 1.15,
  })),
];

for (const [x, z, r] of [
  [-25, -14, 1.0],
  [25, -14, 1.0],
  [-25, 14, 1.0],
  [25, 14, 1.0],
  [-9, -28, 0.9],
  [9, -28, 0.9],
  [-9, 28, 0.9],
  [9, 28, 0.9],
]) {
  isla.push({ kind: "leaf", type: "circle", x, z, r });
}
for (const [x, z, r] of [
  [-21, 0, 1.1],
  [21, 0, 1.1],
  [0, -27, 1.0],
  [0, 27, 1.0],
]) {
  isla.push({ kind: "rock", type: "circle", x, z, r });
}

// --- Arena de Pares ---------------------------------------------------------
// Cuatro pilares en las esquinas y rocas bajas en los ejes: dan profundidad sin
// tapar el centro, que es donde se coloca el tablero DOM.
const pares = [
  { kind: "pillar", type: "circle", x: -14, z: -14, r: 1.0, h: 4.2 },
  { kind: "pillar", type: "circle", x: 14, z: -14, r: 1.0, h: 4.2 },
  { kind: "pillar", type: "circle", x: -14, z: 14, r: 1.0, h: 4.2 },
  { kind: "pillar", type: "circle", x: 14, z: 14, r: 1.0, h: 4.2 },
  { kind: "rock", type: "circle", x: 0, z: -18, r: 1.2 },
  { kind: "rock", type: "circle", x: 0, z: 18, r: 1.2 },
  { kind: "rock", type: "circle", x: -18, z: 0, r: 1.2 },
  { kind: "rock", type: "circle", x: 18, z: 0, r: 1.2 },
];

export const MAP_OBSTACLES = {
  selva,
  desierto,
  volcan,
  pradera,
  ciudad,
  gruta,
  isla,
  pares,
};

// Devuelve la lista de obstáculos de un mapa de sala (o null si no tiene layout
// propio; nevado y cordillera se gestionan en world.js).
export function getMapObstacles(mapId) {
  return MAP_OBSTACLES[mapId] || null;
}

// ¿La posición cae dentro de un obstáculo (con margen opcional)? El servidor lo
// usa para no generar cristales dentro de una cobertura.
export function isInsideObstacle(mapId, x, z, pad = 0) {
  const list = MAP_OBSTACLES[mapId];
  if (!list) return false;
  for (const o of list) {
    if (o.type === "box") {
      const halfW = (o.w || 1) / 2 + pad;
      const halfD = (o.d || o.w || 1) / 2 + pad;
      if (Math.abs(x - o.x) <= halfW && Math.abs(z - o.z) <= halfD) return true;
    } else {
      const radius = (o.r || 1) + pad;
      if (Math.hypot(x - o.x, z - o.z) <= radius) return true;
    }
  }
  return false;
}
