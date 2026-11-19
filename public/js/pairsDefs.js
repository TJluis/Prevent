// Geometría y reglas compartidas de "Encuentra los pares".
//
// Módulo puro (sin DOM ni three.js): lo importan el servidor (para deducir la
// carta que el jugador pisa), el render 3D del tablero y las pruebas. Todo se
// calcula a partir de la variante para que cliente y servidor midan igual.
//
// El tablero está centrado en (0, 0) y el eje +Z mira hacia la cámara elevada:
// la fila 0 queda al fondo (norte) y la última fila cerca del jugador (sur).

export const PAIRS_MODE_ID = "pares";

// 24 emojis distintos: 6x6 necesita 18 parejas únicas y 4x4 usa las 8 primeras.
// El emparejamiento va por índice de pareja, nunca por el carácter visible, así
// que dos parejas jamás comparten emoji.
export const PAIRS_EMOJIS = [
  "🐧", "❄️", "🎩", "🧊", "🐟", "⭐", "🎈", "🍕",
  "🌈", "🍦", "🎮", "🚀", "🌙", "🍀", "🎁", "🦊",
  "🍩", "💎", "🔔", "🧸", "🍉", "🪐", "🎧", "🐳",
];

export const PAIRS_TEAMS = [
  {
    id: "cian",
    name: "Equipo Cian",
    short: "Cian",
    color: "#7dd3fc",
    dark: "#123044",
  },
  {
    id: "rosa",
    name: "Equipo Rosa",
    short: "Rosa",
    color: "#f472b6",
    dark: "#3c1430",
  },
];

export const PAIRS_VARIANTS = [
  {
    id: "1v1",
    label: "1 vs 1",
    detail: "16 cartas · tablero 4×4",
    teamSize: 1,
    grid: 4,
    cardSize: 1.85,
    gap: 0.42,
    maxPlayers: 2,
  },
  {
    id: "2v2",
    label: "2 vs 2",
    detail: "36 cartas · tablero 6×6",
    teamSize: 2,
    grid: 6,
    cardSize: 1.55,
    gap: 0.28,
    maxPlayers: 4,
  },
];

for (const variant of PAIRS_VARIANTS) {
  variant.cardCount = variant.grid * variant.grid;
  variant.pairCount = variant.cardCount / 2;
}

export function getPairsVariant(id) {
  return PAIRS_VARIANTS.find((variant) => variant.id === id) || null;
}

export function resolvePairsVariant(value) {
  // Acepta tanto el id ("2v2") como la propia definición; el render 3D pasa el
  // objeto para no repetir búsquedas y así conserva la variante correcta.
  if (value && typeof value === "object") {
    return getPairsVariant(value.id) || PAIRS_VARIANTS[0];
  }
  return (typeof value === "string" && getPairsVariant(value)) || PAIRS_VARIANTS[0];
}

export function getPairsTeam(id) {
  return PAIRS_TEAMS.find((team) => team.id === id) || null;
}

export function otherPairsTeam(id) {
  return id === "cian" ? "rosa" : id === "rosa" ? "cian" : null;
}

// Distancia entre centros de dos cartas contiguas (incluye el hueco).
export function cardStride(variant) {
  const def = resolvePairsVariant(variant);
  return def.cardSize + def.gap;
}

// Lado total del área de cartas (sin el marco decorativo).
export function boardSize(variant) {
  const def = resolvePairsVariant(variant);
  return def.grid * def.cardSize + (def.grid - 1) * def.gap;
}

// Centro de la carta `index` en coordenadas de mundo (y se resuelve en el render).
export function cardCenter(variant, index) {
  const def = resolvePairsVariant(variant);
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i >= def.cardCount) return null;
  const stride = cardStride(def);
  const half = (def.grid - 1) / 2;
  const col = i % def.grid;
  const row = Math.floor(i / def.grid);
  return {
    x: (col - half) * stride,
    z: (row - half) * stride,
  };
}

// Carta bajo una posición. Devuelve -1 si el punto cae fuera del tablero.
// Se redondea a la celda más cercana y se acepta también el hueco entre cartas.
export function cardIndexAt(variant, x, z) {
  const def = resolvePairsVariant(variant);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return -1;
  const stride = cardStride(def);
  const half = (def.grid - 1) / 2;
  const col = Math.round(x / stride + half);
  const row = Math.round(z / stride + half);
  if (col < 0 || row < 0 || col >= def.grid || row >= def.grid) return -1;
  const cx = (col - half) * stride;
  const cz = (row - half) * stride;
  if (Math.abs(x - cx) > stride / 2 || Math.abs(z - cz) > stride / 2) return -1;
  return row * def.grid + col;
}

// Plataforma de cada equipo: cian al sur (+Z, lado de la cámara) y rosa al
// norte (-Z). El jugador elige equipo pisándola.
export function teamPad(variant, teamId) {
  const def = resolvePairsVariant(variant);
  if (!getPairsTeam(teamId)) return null;
  const board = boardSize(def);
  const width = Math.min(7.2, board + 1.6);
  const depth = 2.4;
  const sign = teamId === "cian" ? 1 : -1;
  const z = (board / 2 + 1.4 + depth / 2) * sign;
  return { team: teamId, x: 0, z, w: width, d: depth, sign };
}

// Equipo cuya plataforma contiene el punto, o null. El margen de 0,3 m perdona
// el redondeo de la posición autoritativa del servidor.
export function teamPadAt(variant, x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  for (const team of PAIRS_TEAMS) {
    const pad = teamPad(variant, team.id);
    if (!pad) continue;
    if (Math.abs(x - pad.x) <= pad.w / 2 + 0.3 && Math.abs(z - pad.z) <= pad.d / 2 + 0.3) {
      return team.id;
    }
  }
  return null;
}

// Atril donde se guardan las parejas ganadas. Para 2v2 son 18 huecos en dos
// filas de 9; para 1v1, 8 huecos en una fila.
export function teamRack(variant, teamId) {
  const def = resolvePairsVariant(variant);
  const pad = teamPad(def, teamId);
  if (!pad) return null;
  const columns = Math.min(def.pairCount, 9);
  const rows = Math.ceil(def.pairCount / columns);
  const spacingX = 0.95;
  const spacingZ = 1.05;
  const w = columns * spacingX + 0.8;
  const d = rows * spacingZ + 0.7;
  const z = pad.z + pad.sign * (pad.d / 2 + 1.15 + d / 2);
  return {
    team: teamId,
    x: 0,
    z,
    w,
    d,
    columns,
    rows,
    spacingX,
    spacingZ,
    sign: pad.sign,
  };
}

// Posición del hueco `slot` del atril. La fila 0 queda junto a la plataforma y
// las siguientes se alejan hacia el borde de la arena.
export function teamRackSlot(variant, teamId, slot) {
  const rack = teamRack(variant, teamId);
  if (!rack) return null;
  const index = Math.max(0, Math.min(rack.columns * rack.rows - 1, Math.floor(Number(slot) || 0)));
  const col = index % rack.columns;
  const row = Math.floor(index / rack.columns);
  return {
    x: (col - (rack.columns - 1) / 2) * rack.spacingX,
    y: 0.86,
    z: rack.z + rack.sign * (row - (rack.rows - 1) / 2) * rack.spacingZ,
  };
}

// Punto de llegada neutro, fuera del tablero y de las plataformas.
export function neutralSpawn(variant) {
  const def = resolvePairsVariant(variant);
  return { x: -(boardSize(def) / 2 + 3.4), z: 0 };
}

// Altura del plano de las cartas sobre el suelo.
export const PAIRS_CARD_Y = 0.16;
export const PAIRS_BOARD_Y = 0.14;
