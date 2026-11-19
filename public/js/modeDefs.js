// Registro compartido de modalidades de Club Pingüi.
//
// Es un módulo puro (sin DOM ni three.js) para que el servidor pueda importarlo
// desde Node y validar qué modos existen y cuáles están disponibles. El cliente
// lo usa para pintar los portales de la isla y el menú de minijuegos.
//
// `status`:
//   - "live": el portal abre una partida real.
//   - "soon": el portal se muestra (para que la isla se lea completa) pero
//     avisa de que la modalidad todavía no está disponible.
//   - "off": oculto.
//
// `mapId` solo es obligatorio en modos "live"; los "soon" lo declaran como
// reserva para no romper el contrato cuando se implementen.
//
// `variants` es opcional: los modos con formatos (Pares 1v1/2v2) abren una sala
// oculta distinta por variante para que ambos formatos puedan jugarse a la vez.

import { PAIRS_VARIANTS } from "./pairsDefs.js";
import { COLISEO_VARIANTS } from "./coliseoDefs.js";

export const MODES = [
  {
    id: "pares",
    name: "Encuentra los pares",
    short: "Pares",
    icon: "🃏",
    status: "live",
    mapId: "pares",
    maxPlayers: 4,
    color: "#7dd3fc",
    tagline: "Memoria en el tablero 3D",
    blurb: "Camina sobre una carta y salta para voltearla. Las parejas vuelan al atril de tu equipo.",
    variants: PAIRS_VARIANTS.map((variant) => ({
      id: variant.id,
      label: variant.label,
      detail: variant.detail,
      teamSize: variant.teamSize,
      grid: variant.grid,
      cardCount: variant.cardCount,
      pairCount: variant.pairCount,
      maxPlayers: variant.maxPlayers,
    })),
  },
  {
    id: "tnt",
    name: "TNT Run",
    short: "TNT Run",
    icon: "💥",
    status: "soon",
    mapId: "tnt",
    maxPlayers: 12,
    color: "#fb923c",
    tagline: "Suelo que se derrumba",
    blurb: "Corre por una plataforma que desaparece a tu paso. El último en pie gana.",
  },
  {
    id: "karts",
    name: "Carreras de karts",
    short: "Karts",
    icon: "🏎️",
    status: "soon",
    mapId: "karts",
    maxPlayers: 8,
    color: "#f472b6",
    tagline: "Velocidad y derrapes",
    blurb: "Circuitos con atajos, turbos y choques entre pingüinos.",
  },
  {
    id: "ciudad",
    name: "Ciudad social",
    short: "Ciudad",
    icon: "🏙️",
    status: "soon",
    mapId: "ciudad-rol",
    maxPlayers: 24,
    color: "#a78bfa",
    tagline: "Rol en primera persona",
    blurb: "Pasea, explora y colecciona objetos en una ciudad pensada para rolear.",
  },
  {
    id: "coliseo",
    name: "Coliseo melee",
    short: "Coliseo",
    icon: "⚔️",
    status: "live",
    mapId: "coliseo",
    maxPlayers: 8,
    // El Coliseo es el único modo con combate real: el servidor habilita el
    // canal de disparos y valida que solo se usen armas melee del loadout.
    combat: true,
    color: "#f87171",
    tagline: "Solo cuerpo a cuerpo",
    blurb: "Arena cerrada, sin armas de fuego. Espada, escudo y reflejos.",
    variants: COLISEO_VARIANTS.map((variant) => ({
      id: variant.id,
      label: variant.label,
      detail: variant.detail,
      teamSize: variant.teamSize,
      maxPlayers: variant.maxPlayers,
      mode: variant.mode,
      sides: variant.sides,
    })),
  },
  {
    id: "escondite",
    name: "Escondite",
    short: "Escondite",
    icon: "🫣",
    status: "live",
    mapId: "escondite",
    maxPlayers: 12,
    color: "#4ade80",
    tagline: "Encuentra o escóndete",
    blurb: "Un buscador, muchos escondites y un reloj en contra.",
  },
];

export function getMode(id) {
  return MODES.find((mode) => mode.id === id) || null;
}

export function isModeLive(id) {
  const mode = getMode(id);
  return !!mode && mode.status === "live";
}

export function liveModes() {
  return MODES.filter((mode) => mode.status === "live");
}

// Variante concreta de un modo, o null. Los modos sin variantes devuelven null.
export function getModeVariant(id, variantId) {
  const mode = getMode(id);
  if (!mode || !Array.isArray(mode.variants)) return null;
  return mode.variants.find((variant) => variant.id === variantId) || null;
}

// Código reservado de la sala interna de cada modo. Se usa como canal de
// Socket.IO y como `roomCode` del jugador, igual que una sala privada. Los
// modos con variantes añaden el formato para tener una sala por formato.
export function modeRoomCode(id, variant) {
  const base = "MODO-" + String(id || "").toUpperCase();
  if (!variant) return base;
  const suffix = String(variant).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return suffix ? `${base}-${suffix}` : base;
}
