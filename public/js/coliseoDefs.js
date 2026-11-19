// Definiciones compartidas del Coliseo melee (Ola 2).
//
// Módulo puro: lo importan el cliente (HUD, arena y validación local) y el
// servidor (controlador autoritativo). No toca DOM ni three.js.
//
// Reglas del modo:
// - Arena circular de 34 m de diámetro, sin armas de fuego.
// - Formatos 1v1, 2v2 y todos contra todos (hasta 8).
// - Al mejor de 5 rondas: gana el primero que llega a 3.
// - Cada ronda dura 90 s o termina cuando queda un solo bando en pie.

export const COLISEO_MAP_ID = "coliseo";
export const COLISEO_ARENA_RADIUS = 17;
export const COLISEO_PLAY_RADIUS = 16.35;
export const COLISEO_SPAWN_RADIUS = 13;

export const COLISEO_ROUNDS_TO_WIN = 3;
export const COLISEO_ROUND_MS = 90000;
export const COLISEO_COUNTDOWN_MS = 3200;
export const COLISEO_ROUND_END_MS = 3200;
export const COLISEO_RESTART_MS = 12000;

// Solo cuerpo a cuerpo. El servidor rechaza cualquier otra arma aunque un
// cliente manipulado intente equiparla.
export const COLISEO_WEAPONS = [
  { id: "daga", name: "Daga", hint: "Rápida y precisa" },
  { id: "espada", name: "Espada", hint: "Equilibrada" },
  { id: "maza", name: "Maza", hint: "Golpe contundente" },
  { id: "escudo", name: "Escudo", hint: "Bloquea y empuja" },
  { id: "martillo", name: "Martillo", hint: "Lento y demoledor" },
];

export const COLISEO_WEAPON_IDS = COLISEO_WEAPONS.map((weapon) => weapon.id);
export const COLISEO_DEFAULT_WEAPON = "espada";

export const COLISEO_TEAMS = [
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

// Colores para el modo libre: cada pingüino es su propio bando.
export const COLISEO_FFA_COLORS = [
  "#7dd3fc",
  "#f472b6",
  "#facc15",
  "#4ade80",
  "#fb923c",
  "#a78bfa",
  "#f87171",
  "#2dd4bf",
];

export const COLISEO_VARIANTS = [
  {
    id: "1v1",
    label: "1 vs 1",
    detail: "Duelo · al mejor de 5",
    mode: "teams",
    teamSize: 1,
    maxPlayers: 2,
    sides: 2,
  },
  {
    id: "2v2",
    label: "2 vs 2",
    detail: "Equipos · al mejor de 5",
    mode: "teams",
    teamSize: 2,
    maxPlayers: 4,
    sides: 2,
  },
  {
    id: "ffa",
    label: "Todos contra todos",
    detail: "Hasta 8 pingüinos · al mejor de 5",
    mode: "ffa",
    teamSize: 1,
    maxPlayers: 8,
    sides: 8,
  },
];

export function getColiseoVariant(id) {
  return COLISEO_VARIANTS.find((variant) => variant.id === id) || null;
}

export function resolveColiseoVariant(value) {
  if (value && typeof value === "object") {
    return COLISEO_VARIANTS.find((variant) => variant.id === value.id) || COLISEO_VARIANTS[0];
  }
  return getColiseoVariant(value) || COLISEO_VARIANTS[0];
}

export function getColiseoTeam(id) {
  return COLISEO_TEAMS.find((team) => team.id === id) || null;
}

export function isColiseoWeapon(id) {
  return COLISEO_WEAPON_IDS.includes(id);
}

const TAU = Math.PI * 2;
const round = (value) => Math.round(value * 100) / 100;

// Punto de aparición de un bando/miembro. En equipos, cian ocupa el lado +Z y
// rosa el -Z. En FFA cada jugador recibe un vértice del octógono.
export function coliseoSpawn(def, sideIndex, memberIndex = 0) {
  const variant = resolveColiseoVariant(def);
  if (variant.mode === "ffa") {
    const angle = -Math.PI / 2 + (Math.max(0, sideIndex) / variant.maxPlayers) * TAU;
    const x = round(Math.cos(angle) * COLISEO_SPAWN_RADIUS);
    const z = round(Math.sin(angle) * COLISEO_SPAWN_RADIUS);
    return { x, z, yaw: round(Math.atan2(-x, -z)) };
  }

  const side = sideIndex === 0 ? 1 : -1;
  const offset = (memberIndex - (variant.teamSize - 1) / 2) * 3.4;
  const x = round(offset);
  const z = round(side * COLISEO_SPAWN_RADIUS);
  return { x, z, yaw: round(Math.atan2(-x, -z)) };
}

// Mantiene al jugador dentro del círculo de juego. El servidor y el cliente
// comparten esta función para que el borde no se pueda atravesar.
export function coliseoClamp(x, z, radius = COLISEO_PLAY_RADIUS) {
  const nx = Number(x) || 0;
  const nz = Number(z) || 0;
  const dist = Math.hypot(nx, nz);
  if (dist <= radius || dist === 0) return { x: nx, z: nz };
  const k = radius / dist;
  return { x: nx * k, z: nz * k };
}

export function coliseoInside(x, z, radius = COLISEO_ARENA_RADIUS) {
  return Math.hypot(Number(x) || 0, Number(z) || 0) <= radius;
}

// Bando que le toca a un jugador según el orden de entrada. En equipos se
// alterna para equilibrar; en FFA no hay bando.
export function coliseoSideForIndex(def, index) {
  const variant = resolveColiseoVariant(def);
  if (variant.mode === "ffa") return null;
  return COLISEO_TEAMS[index % 2].id;
}
