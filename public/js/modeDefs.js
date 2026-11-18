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

export const MODES = [
  {
    id: "pares",
    name: "Encuentra los pares",
    short: "Pares",
    icon: "🃏",
    status: "live",
    mapId: "pares",
    maxPlayers: 6,
    color: "#7dd3fc",
    tagline: "Memoria por turnos",
    blurb: "Voltea dos cartas. Si coinciden, sumas un par y sigues jugando.",
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
    status: "soon",
    mapId: "coliseo",
    maxPlayers: 8,
    color: "#f87171",
    tagline: "Solo cuerpo a cuerpo",
    blurb: "Arena cerrada, sin armas de fuego. Espada, escudo y reflejos.",
  },
  {
    id: "escondite",
    name: "Escondite",
    short: "Escondite",
    icon: "🫣",
    status: "soon",
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

// Código reservado de la sala interna de cada modo. Se usa como canal de
// Socket.IO y como `roomCode` del jugador, igual que una sala privada.
export function modeRoomCode(id) {
  return "MODO-" + String(id || "").toUpperCase();
}
