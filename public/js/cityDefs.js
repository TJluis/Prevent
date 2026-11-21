// Definiciones compartidas de Ciudad social (Ola 6, alcance C1-C2).
//
// Módulo puro: ni DOM ni three.js. Lo importan el cliente (mundo, HUD y cámara)
// y el servidor (controlador autoritativo y persistencia). El distrito es un
// mapa propio y distinto del mapa PVP "ciudad": aquí no hay combate ni cristales,
// hay calles, coleccionables con respawn y una economía mínima de recuerdos.
//
// Interest management: el mundo se divide en celdas de 20 m y un jugador solo
// recibe a los vecinos que caen dentro del radio de 40 m. El servidor aplica el
// filtro tanto al `welcome` como a `player:moved` y a `mode:state`.

export const CITY_MAP_ID = "ciudad-rol";
export const CITY_MIN_PLAYERS = 1;
export const CITY_MAX_PLAYERS = 50;
export const CITY_CELL_SIZE = 20;
export const CITY_INTEREST_RANGE = 40;
export const CITY_INTERACT_RANGE = 2.8;
export const CITY_RESPAWN_MS = 30000;
export const CITY_START_COINS = 60;
export const CITY_SPAWN = { x: 0, z: -8, yaw: 0 };

const TAU = Math.PI * 2;
const round = (value) => Math.round(value * 100) / 100;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Catálogo de la economía básica. `buy` es lo que cuesta en la tienda del HUD y
// `sell` lo que devuelve al venderlo; siempre hay margen para que recoger en la
// calle siga siendo más rentable que comprar y vender.
export const CITY_ITEMS = [
  { id: "recuerdo", name: "Recuerdo de la plaza", icon: "🖼️", buy: 30, sell: 12 },
  { id: "manzana", name: "Manzana", icon: "🍎", buy: 8, sell: 3 },
  { id: "pan", name: "Pan recién hecho", icon: "🥖", buy: 10, sell: 4 },
  { id: "flor", name: "Flor del parque", icon: "🌸", buy: 12, sell: 5 },
  { id: "mapa", name: "Mapa de la ciudad", icon: "🗺️", buy: 18, sell: 7 },
  { id: "brujula", name: "Brújula del mirador", icon: "🧭", buy: 40, sell: 16 },
  { id: "tornillo", name: "Tornillo del taller", icon: "🔩", buy: 6, sell: 2 },
  { id: "semilla", name: "Semilla del jardín", icon: "🌱", buy: 9, sell: 3 },
  { id: "concha", name: "Concha del muelle", icon: "🐚", buy: 14, sell: 5 },
  { id: "libro", name: "Libro viejo", icon: "📖", buy: 26, sell: 10 },
  { id: "taza", name: "Taza de chocolate", icon: "☕", buy: 16, sell: 6 },
  { id: "moneda", name: "Moneda brillante", icon: "🪙", buy: 5, sell: 2 },
  { id: "llave", name: "Llave oxidada", icon: "🔑", buy: 22, sell: 9 },
];

// Los puntos están en los cruces de las calles, nunca encima de los edificios
// del layout `ciudad-rol` (manzanas centradas en ±15 y ±45, de 18 × 18 m).
export const CITY_COLLECTIBLES = [
  { id: "plaza", name: "Fuente de la Plaza", x: 0, z: 0, coins: 18, item: "recuerdo" },
  { id: "mercado", name: "Puesto del Mercado", x: 30, z: 0, coins: 12, item: "manzana" },
  { id: "panaderia", name: "Panadería", x: -30, z: 0, coins: 12, item: "pan" },
  { id: "parque", name: "Parque central", x: 0, z: 30, coins: 14, item: "flor" },
  { id: "estacion", name: "Estación", x: 0, z: -30, coins: 14, item: "mapa" },
  { id: "mirador", name: "Mirador", x: 60, z: 0, coins: 20, item: "brujula" },
  { id: "taller", name: "Taller", x: -60, z: 0, coins: 20, item: "tornillo" },
  { id: "jardin", name: "Jardín botánico", x: 0, z: 60, coins: 20, item: "semilla" },
  { id: "muelle", name: "Muelle viejo", x: 0, z: -60, coins: 20, item: "concha" },
  { id: "noreste", name: "Rincón de los libros", x: 30, z: 30, coins: 16, item: "libro" },
  { id: "noroeste", name: "Cafetería", x: -30, z: 30, coins: 16, item: "taza" },
  { id: "sureste", name: "Fuente pequeña", x: 30, z: -30, coins: 16, item: "moneda" },
  { id: "suroeste", name: "Callejón", x: -30, z: -30, coins: 16, item: "llave" },
];

export function cityItemById(id) {
  return CITY_ITEMS.find((item) => item.id === id) || null;
}

export function cityCollectibleById(id) {
  return CITY_COLLECTIBLES.find((spot) => spot.id === id) || null;
}

// Devolver la fuente más cercana dentro del radio de interacción. El servidor
// vuelve a comprobar la distancia con su posición autoritativa: esto es solo una
// ayuda para el HUD y para el atajo de teclado del cliente.
export function cityNearestCollectible(x, z, range = CITY_INTERACT_RANGE) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  let best = null;
  let bestDist = range;
  for (const spot of CITY_COLLECTIBLES) {
    const dist = Math.hypot(x - spot.x, z - spot.z);
    if (dist <= bestDist) {
      bestDist = dist;
      best = spot;
    }
  }
  return best ? { ...best, distance: round(bestDist) } : null;
}

// --- celdas e interest management -------------------------------------------

export function cityCellOf(x, z) {
  return {
    cx: Math.floor(x / CITY_CELL_SIZE),
    cz: Math.floor(z / CITY_CELL_SIZE),
  };
}

export function cityCellKey(cx, cz) {
  return `${cx}:${cz}`;
}

export function cityCellsInRange(x, z, range = CITY_INTEREST_RANGE) {
  const cell = cityCellOf(x, z);
  const reach = Math.ceil(range / CITY_CELL_SIZE);
  const keys = [];
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dz = -reach; dz <= reach; dz++) {
      keys.push(cityCellKey(cell.cx + dx, cell.cz + dz));
    }
  }
  return keys;
}

export function cityWithinInterest(a, b, range = CITY_INTEREST_RANGE) {
  if (!a || !b) return false;
  return Math.hypot(a.x - b.x, a.z - b.z) <= range;
}

// Puntos de llegada repartidos alrededor de la fuente para que una entrada
// multijugador no apile a todos los pingüinos en el mismo sitio.
export function citySpawnFor(index = 0, total = 1) {
  const count = Math.max(1, Math.min(12, total));
  const slot = ((index % count) + count) % count;
  const radius = slot === 0 ? 0 : 3.2 + Math.floor(slot / 6) * 2.4;
  const angle = slot === 0 ? 0 : (slot / Math.max(1, count - 1)) * TAU;
  return {
    x: round(CITY_SPAWN.x + Math.cos(angle) * radius),
    z: round(CITY_SPAWN.z + Math.sin(angle) * radius),
    yaw: CITY_SPAWN.yaw,
  };
}

export function cityClamp(value) {
  // El mapa mide 180 m (radio 90). Margen de 1 m para no pegar la cámara al muro.
  return clamp(value, -89, 89);
}
