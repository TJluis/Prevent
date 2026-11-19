// Definiciones compartidas de TNT Run (Ola 3).
//
// Módulo puro: lo importan el cliente (HUD, arena 3D y validación local) y el
// servidor (controlador autoritativo). No toca DOM ni three.js.
//
// Reglas del modo:
// - De 4 a 16 pingüinos. Todos pulsan «Listo», hay una cuenta atrás corta y
//   arranca la partida en la capa alta de una isla flotante de 5 capas.
// - Cada capa es una rejilla de 16×16 bloques de 1,5 m. Al pisar un bloque
//   arranca una mecha de 600 ms; pasado ese tiempo el bloque cae y deja hueco.
// - Si el jugador se queda sin bloque bajo los pies, baja una capa si el bloque
//   inferior sigue firme; si no hay capa inferior, queda eliminado.
// - Gana el último vivo. A los 5 minutos gana quien esté en la capa más alta
//   (desempate: bloques pisados y, si sigue empatado, orden de entrada).

export const TNT_MAP_ID = "tnt";
export const TNT_LAYERS = 5;
export const TNT_GRID = 16;
export const TNT_CELL = 1.5;
export const TNT_LAYER_GAP = 1.5;
export const TNT_BLOCK_SIZE = 1.4;
export const TNT_MAP_SIZE = 48;

export const TNT_MIN_PLAYERS = 4;
export const TNT_MAX_PLAYERS = 16;

export const TNT_FUSE_MS = 600;
export const TNT_TICK_MS = 50; // 20 Hz, según el plan de modalidades.
export const TNT_MATCH_MS = 300000; // 5 minutos.
export const TNT_COUNTDOWN_MS = 3000;
export const TNT_RESULT_MS = 10000;
export const TNT_RECONNECT_GRACE_MS = 45000;
export const TNT_MAX_BLOCKS_PER_SEC = 8;

export const TNT_PHASES = ["waiting", "countdown", "playing", "result"];

export const TNT_COLORS = {
  fire: "#fb923c",
  fuse: "#facc15",
  safe: "#38bdf8",
  danger: "#f87171",
  void: "#0b1020",
};

const HALF = (TNT_GRID * TNT_CELL) / 2;
const round = (value) => Math.round(value * 100) / 100;

// La capa 0 es la más baja (y = 0) y la capa 4 la más alta (y = 6). Victoria
// por altura significa, por tanto, quedarse en el mayor índice de capa.
export function tntLayerHeight(layer) {
  return round(Math.max(0, Math.min(TNT_LAYERS - 1, layer)) * TNT_LAYER_GAP);
}

export function tntIsTopLayer(layer) {
  return layer === TNT_LAYERS - 1;
}

export function tntGlobalIndex(layer, row, col) {
  if (!Number.isInteger(layer) || layer < 0 || layer >= TNT_LAYERS) return -1;
  if (!Number.isInteger(row) || row < 0 || row >= TNT_GRID) return -1;
  if (!Number.isInteger(col) || col < 0 || col >= TNT_GRID) return -1;
  return layer * TNT_GRID * TNT_GRID + row * TNT_GRID + col;
}

export function tntPartsOf(index) {
  if (!Number.isInteger(index) || index < 0 || index >= TNT_LAYERS * TNT_GRID * TNT_GRID) return null;
  const layer = Math.floor(index / (TNT_GRID * TNT_GRID));
  const rest = index - layer * TNT_GRID * TNT_GRID;
  return { layer, row: Math.floor(rest / TNT_GRID), col: rest % TNT_GRID };
}

// Convierte una posición del mundo a celda de la rejilla. Fuera de la isla
// devuelve null: el servidor lo trata como caída al vacío.
export function tntCellFromPosition(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  const col = Math.floor((x + HALF) / TNT_CELL);
  const row = Math.floor((z + HALF) / TNT_CELL);
  if (row < 0 || row >= TNT_GRID || col < 0 || col >= TNT_GRID) return null;
  return { row, col };
}

export function tntCellCenter(row, col) {
  return {
    x: round(-HALF + (col + 0.5) * TNT_CELL),
    z: round(-HALF + (row + 0.5) * TNT_CELL),
  };
}

export function tntAdjacent(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function tntSameCell(a, b) {
  return !!a && !!b && a.row === b.row && a.col === b.col;
}

// Puntos de salida repartidos por la capa alta: primero un anillo interior y,
// si hace falta, un segundo anillo. Siempre caen en celdas distintas.
const SPAWN_RING = [
  [4, 4], [4, 11], [11, 11], [11, 4],
  [4, 7], [7, 11], [11, 8], [8, 4],
  [3, 8], [8, 3], [12, 7], [7, 12],
  [2, 2], [2, 13], [13, 13], [13, 2],
];

export function tntSpawnFor(index, total = TNT_MIN_PLAYERS) {
  const count = Math.max(1, Math.min(SPAWN_RING.length, Number(total) || TNT_MIN_PLAYERS));
  const at = ((Number(index) || 0) % count + count) % count;
  const [row, col] = SPAWN_RING[at];
  const center = tntCellCenter(row, col);
  return {
    x: center.x,
    z: center.z,
    y: tntLayerHeight(TNT_LAYERS - 1),
    yaw: Math.atan2(-center.x, -center.z),
    row,
    col,
    layer: TNT_LAYERS - 1,
  };
}

// Ordena a los supervivientes por capa (más alta primero), bloques pisados y
// orden de entrada. Se usa para la victoria por tiempo y para el ranking.
export function tntRank(players) {
  return [...players]
    .filter((p) => p && !p.eliminated)
    .sort((a, b) => {
      if (b.layer !== a.layer) return b.layer - a.layer;
      if ((b.blocks || 0) !== (a.blocks || 0)) return (b.blocks || 0) - (a.blocks || 0);
      return (a.order || 0) - (b.order || 0);
    });
}

export function tntWinnerByHeight(players) {
  const ranked = tntRank(players);
  return ranked.length ? ranked[0] : null;
}
