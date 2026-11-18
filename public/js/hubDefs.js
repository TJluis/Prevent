// Definición de la Isla de Minijuegos: código de sala reservado, mapa,
// posiciones de los portales y ayudas de proximidad.
//
// Módulo puro: lo importan el cliente (render y prompt) y el servidor (validar
// que el jugador está cerca de un portal antes de cambiar de zona).
import { getMode } from "./modeDefs.js";

export const HUB_CODE = "ISLA";
export const HUB_MAP_ID = "isla";
export const HUB_NAME = "Isla de Minijuegos";

// Punto de llegada al entrar a la isla. Queda dentro del anillo de portales
// (radio 18) pero lejos de todos para no disparar un portal sin querer.
export const HUB_SPAWN = { x: 0, z: 9 };

// Radio del anillo de portales y distancia a la que se muestra el aviso.
export const HUB_PORTAL_RING = 18;
export const PORTAL_TRIGGER_RADIUS = 3.2;

// Portal del lobby: se dibuja en el Pueblo Nevado y lleva a la isla.
// Se coloca al sur de la pista de hockey, en una zona libre de obstáculos.
export const LOBBY_PORTAL = {
  modeId: "hub",
  x: 0,
  z: -25,
  icon: "🎮",
  label: "Minijuegos",
  color: "#7dd3fc",
};

// Orden del anillo (sentido horario desde el norte). Se mantiene estable para
// que las posiciones no cambien entre cliente y servidor.
const RING_ORDER = ["pares", "tnt", "karts", "ciudad", "coliseo", "escondite"];

function round2(value) {
  return Math.round(value * 100) / 100;
}

export const HUB_PORTALS = RING_ORDER.map((id, index) => {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / RING_ORDER.length;
  const mode = getMode(id);
  return {
    modeId: id,
    angle,
    x: round2(Math.cos(angle) * HUB_PORTAL_RING),
    z: round2(Math.sin(angle) * HUB_PORTAL_RING),
    icon: mode ? mode.icon : "❔",
    label: mode ? mode.name : id,
    color: mode ? mode.color : "#8b93a7",
    status: mode ? mode.status : "off",
  };
});

// Devuelve el portal más cercano dentro del radio indicado, o null.
export function nearestPortal(x, z, portals = HUB_PORTALS, radius = PORTAL_TRIGGER_RADIUS) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  let best = null;
  let bestDist = radius;
  for (const portal of portals || []) {
    const dist = Math.hypot(x - portal.x, z - portal.z);
    if (dist <= bestDist) {
      bestDist = dist;
      best = portal;
    }
  }
  return best ? { ...best, distance: bestDist } : null;
}
