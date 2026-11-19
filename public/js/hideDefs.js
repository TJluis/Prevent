// Definiciones compartidas del Escondite (Ola 2).
//
// Módulo puro: lo importan el cliente (HUD, aldea y validación local) y el
// servidor (controlador autoritativo). No toca DOM ni three.js.
//
// Reglas del modo:
// - 3 a 12 pingüinos. Uno es el buscador (elegido al azar con semilla) y el
//   resto se esconde.
// - Fase `hide` (90 s): el buscador queda congelado dentro de la jaula central
//   mientras los escondidos corren a los 12 escondites de la aldea.
// - Fase `seek` (180 s): el buscador sale a atrapar. Los escondidos ganan si
//   sobrevive al menos uno; el buscador gana si atrapa a todos.
// - El buscador tiene un pulso de detección cada 30 s (radio 8 m). Los
//   escondidos tienen 3 esquivas cortas que recargan cada 25 s.
// - Etiquetar exige distancia < 1,6 m y línea de visión libre: las coberturas
//   de la aldea bloquean el pulso y la etiqueta.

export const HIDE_MAP_ID = "escondite";
export const HIDE_MAP_SIZE = 72;
export const HIDE_MIN_PLAYERS = 3;
export const HIDE_MAX_PLAYERS = 12;

export const HIDE_HIDE_MS = 90000;
export const HIDE_SEEK_MS = 180000;
export const HIDE_RESULT_MS = 12000;
export const HIDE_RECONNECT_GRACE_MS = 45000;

// Jaula central del buscador y anillo desde el que arrancan los escondidos.
export const HIDE_CAGE_RADIUS = 2.8;
export const HIDE_START_RADIUS = 5;
export const HIDE_SPOT_RING = 29.5;
export const HIDE_COVER_RING = 24;

export const HIDE_TAG_RANGE = 1.6;
export const HIDE_DASH_COUNT = 3;
export const HIDE_DASH_RECHARGE_MS = 25000;
export const HIDE_DASH_IFRAME_MS = 550;
export const HIDE_PULSE_COOLDOWN_MS = 30000;
export const HIDE_PULSE_RADIUS = 8;

export const HIDE_PHASES = ["waiting", "hide", "seek", "result"];

export const HIDE_ROLES = {
  seeker: {
    id: "seeker",
    name: "Buscador",
    short: "Busca",
    icon: "🔎",
    color: "#fb923c",
    dark: "#3a1e08",
  },
  hider: {
    id: "hider",
    name: "Escondido",
    short: "Esconde",
    icon: "🫣",
    color: "#4ade80",
    dark: "#0d2a16",
  },
};

export function hideRoleColor(role) {
  return (HIDE_ROLES[role] && HIDE_ROLES[role].color) || "#dbeafe";
}

export function isHideRole(role) {
  return role === "seeker" || role === "hider";
}

const TAU = Math.PI * 2;
const round = (value) => Math.round(value * 100) / 100;

// Tipos de cobertura repartidos por el anillo. Las vallas caen en los índices
// 3 y 9 (ángulos 90° y 270°) para que su lado fino sea radial y bloqueen de
// verdad la línea de visión desde la jaula.
const COVER_KINDS = [
  "cabin",
  "haystack",
  "crate",
  "fence",
  "well",
  "tree",
  "cabin",
  "haystack",
  "crate",
  "fence",
  "well",
  "tree",
];

const COVER_NAMES = {
  cabin: "Cabaña",
  haystack: "Pajar",
  crate: "Cajas",
  fence: "Valla",
  well: "Pozo",
  tree: "Árbol",
};

function coverFor(kind, x, z) {
  if (kind === "cabin") {
    return { kind, type: "box", x, z, w: 4.2, d: 3.2, h: 2.7 };
  }
  if (kind === "crate") {
    return { kind, type: "box", x, z, w: 2.4, d: 2.4, h: 2.1 };
  }
  if (kind === "fence") {
    return { kind, type: "box", x, z, w: 4.2, d: 0.35, h: 1.6 };
  }
  if (kind === "haystack") {
    return { kind, type: "circle", x, z, r: 1.6 };
  }
  if (kind === "well") {
    return { kind, type: "circle", x, z, r: 1.35 };
  }
  return { kind, type: "circle", x, z, r: 1.15 };
}

// Doce escondites en un anillo de 29,5 m. La cobertura se coloca 5,5 m hacia el
// centro para tapar la línea recta desde la jaula; el escondido se sitúa en el
// lado exterior, de espaldas a la aldea.
export const HIDE_SPOTS = COVER_KINDS.map((kind, index) => {
  const angle = (index / COVER_KINDS.length) * TAU;
  const x = round(Math.cos(angle) * HIDE_SPOT_RING);
  const z = round(Math.sin(angle) * HIDE_SPOT_RING);
  const coverX = round(Math.cos(angle) * HIDE_COVER_RING);
  const coverZ = round(Math.sin(angle) * HIDE_COVER_RING);
  return {
    id: index,
    name: `${COVER_NAMES[kind]} ${index + 1}`,
    kind,
    angle: round(angle),
    x,
    z,
    yaw: round(Math.atan2(x, z)),
    cover: coverFor(kind, coverX, coverZ),
  };
});

export const HIDE_COVERS = HIDE_SPOTS.map((spot) => spot.cover);

// Punto de arranque de un escondido en el anillo central. `index` es el orden
// de entrada del jugador, así que dos jugadores nunca comparten posición.
export function hideStartSpawn(index = 0, count = HIDE_MAX_PLAYERS) {
  const total = Math.max(1, Number(count) || HIDE_MAX_PLAYERS);
  const angle = ((Number(index) || 0) / total) * TAU;
  const x = round(Math.cos(angle) * HIDE_START_RADIUS);
  const z = round(Math.sin(angle) * HIDE_START_RADIUS);
  return { x, z, yaw: round(Math.atan2(x, z)) };
}

export function hideSeekerSpawn() {
  return { x: 0, z: 0, yaw: 0 };
}

export function hideSpotAt(x, z, maxDist = 1.5) {
  const px = Number(x);
  const pz = Number(z);
  if (!Number.isFinite(px) || !Number.isFinite(pz)) return null;
  let best = null;
  let bestDist = Number(maxDist) || 0;
  for (const spot of HIDE_SPOTS) {
    const dist = Math.hypot(px - spot.x, pz - spot.z);
    if (dist <= bestDist) {
      bestDist = dist;
      best = { ...spot, distance: dist };
    }
  }
  return best;
}

// --- línea de visión --------------------------------------------------------
// El servidor y el cliente comparten estas funciones. Las coberturas llegan
// como argumento para poder validar la geometría sin cargar el mapa completo.

function segmentHitsCircle(ax, az, bx, bz, cx, cz, radius) {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  const r = Math.max(0, Number(radius) || 0);
  if (lenSq < 1e-9) return Math.hypot(ax - cx, az - cz) <= r;
  let t = ((cx - ax) * dx + (cz - az) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = ax + dx * t;
  const pz = az + dz * t;
  return Math.hypot(px - cx, pz - cz) <= r;
}

function segmentHitsBox(ax, az, bx, bz, box) {
  const halfW = Math.max(0.01, (Number(box.w) || 1) / 2);
  const halfD = Math.max(0.01, (Number(box.d) || box.w || 1) / 2);
  const minX = box.x - halfW;
  const maxX = box.x + halfW;
  const minZ = box.z - halfD;
  const maxZ = box.z + halfD;

  const dx = bx - ax;
  const dz = bz - az;
  let t0 = 0;
  let t1 = 1;

  const clip = (origin, delta, min, max) => {
    if (Math.abs(delta) < 1e-9) return origin >= min && origin <= max;
    let near = (min - origin) / delta;
    let far = (max - origin) / delta;
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
    return t0 <= t1;
  };

  if (!clip(ax, dx, minX, maxX)) return false;
  if (!clip(az, dz, minZ, maxZ)) return false;
  return t0 <= t1;
}

export function segmentBlocked(ax, az, bx, bz, obstacles = []) {
  const x1 = Number(ax);
  const z1 = Number(az);
  const x2 = Number(bx);
  const z2 = Number(bz);
  if (![x1, z1, x2, z2].every(Number.isFinite)) return false;
  for (const o of obstacles || []) {
    if (!o) continue;
    if (o.type === "box") {
      if (segmentHitsBox(x1, z1, x2, z2, o)) return true;
    } else if (segmentHitsCircle(x1, z1, x2, z2, o.x, o.z, o.r || 0)) {
      return true;
    }
  }
  return false;
}

export function hasLineOfSight(ax, az, bx, bz, obstacles = []) {
  return !segmentBlocked(ax, az, bx, bz, obstacles);
}

export function hideDistance(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot(Number(a.x) - Number(b.x), Number(a.z) - Number(b.z));
}

// Etiqueta válida: distancia corta y ninguna cobertura en medio.
export function canTag(seeker, target, obstacles = [], range = HIDE_TAG_RANGE) {
  if (!seeker || !target) return false;
  if (hideDistance(seeker, target) > range) return false;
  return hasLineOfSight(seeker.x, seeker.z, target.x, target.z, obstacles);
}

// Identidad estable para reservar el rol durante una reconexión: las cuentas
// usan el id de usuario y los invitados el nombre normalizado.
export function stableHideKey({ userId, name } = {}) {
  if (Number.isFinite(Number(userId)) && Number(userId) > 0) return `u:${Number(userId)}`;
  return `n:${String(name || "")
    .trim()
    .toLowerCase()
    .slice(0, 20)}`;
}
