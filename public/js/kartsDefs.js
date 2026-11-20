// Definiciones compartidas de Karts (Bloque 1).
//
// Módulo puro: ni DOM ni three.js. Lo importan el cliente (mundo, renderer de la
// pista y HUD) y el servidor (controlador autoritativo). La spline se resuelve
// con aritmética plana para que Node pueda cargarla sin dependencias gráficas;
// el cliente reutiliza exactamente los mismos puntos para dibujar el asfalto.
//
// Modelo de pista:
// - Puntos de control {x,y,z} de una curva de Catmull-Rom cerrada.
// - La forma se escala en X/Z hasta que la longitud del arco es la pedida
//   (1000 / 1600 / 2400 m). La altura `y` no se escala: es el desnivel real.
// - Cada muestra guardaposición, tangente, normal lateral y peralte (bank)
//   derivado de la curvatura. Los checkpoints, boosts y superficies se dan por
//   parámetro `t` (0..1 de la vuelta) y se traducen a distancia de arco.
// - `kartsNearest` proyecta una posición del mundo sobre la pista. Es la única
//   fuente de verdad para progreso, corrección de fuera de pista y respawn.

export const KARTS_MAP_ID = "karts";
export const KARTS_MIN_PLAYERS = 2;
export const KARTS_MAX_PLAYERS = 8;
export const KARTS_LAPS = 3;
export const KARTS_SECTORS = 12;
export const KARTS_TICK_MS = 50; // 20 Hz: la física corre en el servidor.
export const KARTS_COUNTDOWN_MS = 4000;
export const KARTS_RESULT_MS = 14000;
export const KARTS_MATCH_MS = 900000; // 15 min de límite por carrera.
export const KARTS_PHASES = ["waiting", "countdown", "racing", "finished"];
export const KARTS_TRACK_WIDTH = 14; // m; suficiente para 8 karts en paralelo.
// Graderíos: uno cada ~125 m, alternando lados y siempre fuera del ancho de
// calzada. La distancia es de arco, así que se reparten por igual aunque la
// spline tenga curvas cerradas o tramos de hielo.
export const KARTS_GRANDSTAND_SPACING = 125;
export const KARTS_GRANDSTAND_OFFSET = KARTS_TRACK_WIDTH / 2 + 9;
// El paddock se aparta del trazado: la spline pasa por (0,0) y se abre hacia el
// noreste, así que un centro en (0,-100) deja ~99 m de margen incluso a la
// curva más cercana. Pedestales y portales se sitúan alrededor de este punto.
export const KARTS_PADDOCK_CENTER = { x: 0, z: -100 };
export const KARTS_PADDOCK_SPAWN = { x: 0, z: -100, yaw: 0 };

const TAU = Math.PI * 2;
const SAMPLES = 720;
const round = (value) => Math.round(value * 100) / 100;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// --- catálogo ---------------------------------------------------------------
// Un kart inicial y cuatro desbloqueables. Las diferencias son suaves (≤25 % en
// velocidad, ≤33 % en aceleración y ≤12 % en manejo) para no romper el equilibrio.
export const KART_CATALOG = [
  {
    id: "pingui_gt",
    name: "Pingüi GT",
    price: 0,
    color: "#f472b6",
    accent: "#fbcfe8",
    speed: 25,
    acceleration: 9,
    handling: 3.4,
    blurb: "El clásico del paddock. Equilibrado y fácil de dominar.",
  },
  {
    id: "cometa",
    name: "Cometa",
    price: 180,
    color: "#38bdf8",
    accent: "#bae6fd",
    speed: 28,
    acceleration: 10,
    handling: 3.2,
    blurb: "Más punta en las rectas, frenos un poco más largos.",
  },
  {
    id: "tornado",
    name: "Tornado",
    price: 360,
    color: "#4ade80",
    accent: "#bbf7d0",
    speed: 25,
    acceleration: 12,
    handling: 3.7,
    blurb: "Sale como un rayo y se mete en las curvas más cerradas.",
  },
  {
    id: "rayo",
    name: "Rayo",
    price: 650,
    color: "#facc15",
    accent: "#fef08a",
    speed: 31,
    acceleration: 11,
    handling: 3.0,
    blurb: "Velocidad pura. Castiga los errores en el hielo.",
  },
  {
    id: "titan",
    name: "Titán",
    price: 1000,
    color: "#a78bfa",
    accent: "#ddd6fe",
    speed: 29,
    acceleration: 10.5,
    handling: 3.8,
    blurb: "Pesado, rápido y con la mejor tracción del paddock.",
  },
];

export const KART_START_ID = "pingui_gt";

export function kartById(id) {
  return KART_CATALOG.find((kart) => kart.id === id) || null;
}

export function kartStats(id) {
  const kart = kartById(id) || KART_CATALOG[0];
  return {
    speed: kart.speed,
    acceleration: kart.acceleration,
    handling: kart.handling,
  };
}

// Puntos por carrera: posición final + bonus por vuelta, escalado por longitud
// de pista. Un invitado conserva los suyos mientras dure la sesión del servidor.
const PLACE_POINTS = [120, 95, 78, 64, 54, 44, 34, 24];
export function kartRacePoints(position, laps = 0, trackId = "paddock") {
  const place = PLACE_POINTS[clamp(Math.round(position) - 1, 0, PLACE_POINTS.length - 1)];
  const track = getTrack(trackId);
  const factor = track ? track.pointsFactor : 1;
  return Math.round(place * factor) + Math.max(0, Math.round(laps)) * Math.round(10 * factor);
}

// --- pistas -----------------------------------------------------------------
// `points` son [x, y, z]. La y ya es la elevación final en metros. Las formas
// están pensadas para tener curvas de ambos sentidos, rectas largas y zonas de
// frenada; el escalado las lleva a la longitud objetivo.
const TRACK_BLUEPRINTS = [
  {
    id: "paddock",
    name: "Circuito del Paddock",
    short: "Paddock",
    length: 1000,
    pointsFactor: 1,
    status: "live",
    description: "1.000 m · desnivel suave, dos turbos y un atajo de interior.",
    color: "#f472b6",
    points: [
      [0, 0, 0], [34, 1, -6], [66, 2, -4], [90, 3, 14], [96, 4, 40],
      [80, 5, 62], [50, 4, 70], [24, 2, 58], [4, 1, 64], [-18, 2, 86],
      [-48, 4, 80], [-68, 6, 56], [-64, 5, 26], [-46, 3, 4], [-22, 1, -4],
    ],
    surfaces: [
      { from: 0.20, to: 0.28, type: "ice", grip: 0.68, label: "Hielo" },
      { from: 0.63, to: 0.71, type: "gravel", grip: 0.78, label: "Grava" },
    ],
    boosts: [{ at: 0.34 }, { at: 0.79 }],
    tunnels: [{ from: 0.47, to: 0.54 }],
    shortcuts: [{ from: 0.10, to: 0.20, gain: 1.16, side: -1 }],
    obstacles: [
      { at: 0.105, lateral: 0, radius: 1.25, type: "cones", label: "Conos" },
      { at: 0.19, lateral: 3.0, radius: 1.15, type: "barril", label: "Barril" },
      { at: 0.29, lateral: -3.0, radius: 1.2, type: "neumatico", label: "Neumático" },
      { at: 0.43, lateral: 1.2, radius: 1.3, type: "cones", label: "Conos" },
      { at: 0.57, lateral: -1.0, radius: 1.35, type: "barril", label: "Barril" },
      { at: 0.71, lateral: 3.2, radius: 1.15, type: "neumatico", label: "Neumático" },
      { at: 0.85, lateral: -2.4, radius: 1.25, type: "cones", label: "Conos" },
    ],
  },
  {
    id: "dunas",
    name: "Dunas del Cañón",
    short: "Dunas",
    length: 1600,
    pointsFactor: 1.4,
    status: "prep",
    description: "1.600 m · arena, túnel largo y mucha pendiente. En preparación.",
    color: "#fb923c",
    points: [
      [0, 0, 0], [40, 4, -10], [80, 8, -6], [112, 12, 18], [120, 14, 52],
      [104, 10, 82], [70, 6, 92], [38, 3, 78], [10, 2, 88], [-16, 6, 116],
      [-54, 12, 118], [-88, 16, 94], [-102, 14, 56], [-90, 8, 20],
      [-64, 4, -2], [-30, 1, -8],
    ],
    surfaces: [
      { from: 0.12, to: 0.24, type: "sand", grip: 0.72, label: "Arena" },
      { from: 0.55, to: 0.64, type: "ice", grip: 0.62, label: "Hielo" },
    ],
    boosts: [{ at: 0.30 }, { at: 0.68 }, { at: 0.88 }],
    tunnels: [{ from: 0.40, to: 0.49 }],
    shortcuts: [{ from: 0.74, to: 0.84, gain: 1.2, side: 1 }],
    obstacles: [
      { at: 0.11, lateral: 0, radius: 1.3, type: "cones", label: "Conos" },
      { at: 0.22, lateral: 3.1, radius: 1.2, type: "neumatico", label: "Neumático" },
      { at: 0.35, lateral: -2.8, radius: 1.25, type: "barril", label: "Barril" },
      { at: 0.52, lateral: 1.4, radius: 1.3, type: "cones", label: "Conos" },
      { at: 0.66, lateral: -1.6, radius: 1.2, type: "neumatico", label: "Neumático" },
      { at: 0.79, lateral: 3.2, radius: 1.2, type: "barril", label: "Barril" },
      { at: 0.92, lateral: -2.2, radius: 1.25, type: "cones", label: "Conos" },
    ],
  },
  {
    id: "cordillera",
    name: "Cordillera Extrema",
    short: "Cordillera",
    length: 2400,
    pointsFactor: 1.9,
    status: "prep",
    description: "2.400 m · la extensa: hielo, grava, dos túneles y tres atajos. En preparación.",
    color: "#60a5fa",
    points: [
      [0, 0, 0], [46, 6, -14], [94, 12, -10], [134, 18, 14], [150, 22, 54],
      [140, 18, 96], [104, 12, 118], [60, 6, 112], [22, 2, 92], [-8, 4, 104],
      [-40, 10, 136], [-84, 16, 142], [-122, 20, 116], [-140, 22, 76],
      [-130, 16, 34], [-104, 10, 4], [-70, 5, -10], [-34, 2, -6],
    ],
    surfaces: [
      { from: 0.14, to: 0.23, type: "ice", grip: 0.6, label: "Hielo" },
      { from: 0.38, to: 0.47, type: "gravel", grip: 0.76, label: "Grava" },
      { from: 0.70, to: 0.79, type: "sand", grip: 0.7, label: "Arena" },
    ],
    boosts: [{ at: 0.28 }, { at: 0.52 }, { at: 0.66 }, { at: 0.9 }],
    tunnels: [{ from: 0.32, to: 0.38 }, { from: 0.82, to: 0.88 }],
    shortcuts: [
      { from: 0.08, to: 0.17, gain: 1.18, side: -1 },
      { from: 0.58, to: 0.68, gain: 1.22, side: 1 },
      { from: 0.90, to: 0.97, gain: 1.14, side: -1 },
    ],
    obstacles: [
      { at: 0.105, lateral: 0, radius: 1.3, type: "cones", label: "Conos" },
      { at: 0.20, lateral: 3.2, radius: 1.2, type: "barril", label: "Barril" },
      { at: 0.30, lateral: -3.1, radius: 1.25, type: "neumatico", label: "Neumático" },
      { at: 0.44, lateral: 1.5, radius: 1.3, type: "cones", label: "Conos" },
      { at: 0.56, lateral: -1.4, radius: 1.25, type: "barril", label: "Barril" },
      { at: 0.68, lateral: 3.3, radius: 1.2, type: "neumatico", label: "Neumático" },
      { at: 0.78, lateral: -2.5, radius: 1.3, type: "cones", label: "Conos" },
      { at: 0.88, lateral: 2.3, radius: 1.2, type: "barril", label: "Barril" },
    ],
  },
];

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const axis = (a, b, c, d) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return {
    x: axis(p0.x, p1.x, p2.x, p3.x),
    y: axis(p0.y, p1.y, p2.y, p3.y),
    z: axis(p0.z, p1.z, p2.z, p3.z),
  };
}

function sampleCurve(points, count = SAMPLES) {
  const n = points.length;
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    const u = (i / count) * n;
    const seg = Math.floor(u) % n;
    const t = u - Math.floor(u);
    out[i] = catmull(
      points[(seg - 1 + n) % n],
      points[seg % n],
      points[(seg + 1) % n],
      points[(seg + 2) % n],
      t
    );
  }
  return out;
}

function buildTrack(blueprint) {
  const base = blueprint.points.map(([x, y, z]) => ({ x, y, z }));
  const firstPass = sampleCurve(base, 360);
  let baseLength = 0;
  for (let i = 0; i < firstPass.length; i++) {
    const a = firstPass[i];
    const b = firstPass[(i + 1) % firstPass.length];
    baseLength += Math.hypot(b.x - a.x, b.z - a.z);
  }
  const scale = blueprint.length / baseLength;
  const scaled = base.map((p) => ({ x: p.x * scale, y: p.y, z: p.z * scale }));
  const samples = sampleCurve(scaled);

  const arc = new Float64Array(samples.length + 1);
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i];
    const b = samples[(i + 1) % samples.length];
    arc[i + 1] = arc[i] + Math.hypot(b.x - a.x, b.z - a.z);
  }
  const length = arc[samples.length];

  // Tangente, normal y peralte: el peralte crece con la curvatura y se limita
  // a ~17° para que la malla no se retuerza en las horquillas.
  const frames = new Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const prev = samples[(i - 1 + samples.length) % samples.length];
    const next = samples[(i + 1) % samples.length];
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const mag = Math.hypot(tx, tz) || 1;
    const dx = tx / mag;
    const dz = tz / mag;
    const a = samples[i];
    const b = next;
    const bx = b.x - a.x;
    const bz = b.z - a.z;
    const bm = Math.hypot(bx, bz) || 1;
    const curvature = (dx * (bz / bm) - dz * (bx / bm)) / (mag || 1);
    frames[i] = {
      x: a.x,
      y: a.y,
      z: a.z,
      dx,
      dz,
      // Normal hacia la derecha de la marcha (en el plano XZ).
      nx: -dz,
      nz: dx,
      bank: clamp(curvature * 85, -0.3, 0.3),
      t: arc[i] / length,
    };
  }

  const endpoints = (item) => ({
    fromT: item.from,
    toT: item.to,
    fromDistance: item.from * length,
    toDistance: item.to * length,
  });

  return {
    id: blueprint.id,
    name: blueprint.name,
    short: blueprint.short,
    description: blueprint.description,
    status: blueprint.status,
    color: blueprint.color,
    length: round(length),
    targetLength: blueprint.length,
    pointsFactor: blueprint.pointsFactor,
    width: KARTS_TRACK_WIDTH,
    samples,
    frames,
    arc,
    scale: round(scale),
    surfaces: blueprint.surfaces.map((s) => ({ ...s, ...endpoints(s) })),
    boosts: blueprint.boosts.map((b) => ({
      ...b,
      t: b.at,
      distance: b.at * length,
      ...kartsPointAtRaw(frames, arc, length, b.at * length),
    })),
    tunnels: blueprint.tunnels.map(endpoints),
    shortcuts: blueprint.shortcuts.map((s) => ({
      ...s,
      ...endpoints(s),
    })),
    // Obstáculos rígidos dentro del trazado. Se resuelven en coordenadas de
    // pista (distancia de arco + lateral) para que la colisión sea coherente
    // con la spline, el peralte y los bucles de vuelta.
    obstacles: blueprint.obstacles.map((o, index) => {
      const raw = kartsPointAtRaw(frames, arc, length, o.at * length);
      return {
        ...o,
        id: `${blueprint.id}-ob-${index + 1}`,
        t: o.at,
        distance: o.at * length,
        x: raw.x + raw.nx * o.lateral,
        y: raw.y + Math.sin(raw.bank) * o.lateral,
        z: raw.z + raw.nz * o.lateral,
        yaw: raw.yaw,
        bank: raw.bank,
      };
    }),
    // Graderíos fuera de la pista, con el mismo marco de referencia que los
    // obstáculos para que el renderer solo tenga que colocar las mallas.
    grandstands: buildGrandstands(blueprint, frames, arc, length),
  };
}

function kartsPointAtRaw(frames, arc, length, distance) {
  const d = ((distance % length) + length) % length;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arc[mid] <= d) lo = mid;
    else hi = mid - 1;
  }
  const a = frames[lo];
  const b = frames[(lo + 1) % frames.length];
  const span = arc[lo + 1] - arc[lo] || 1;
  const k = clamp((d - arc[lo]) / span, 0, 1);
  const x = a.x + (b.x - a.x) * k;
  const y = a.y + (b.y - a.y) * k;
  const z = a.z + (b.z - a.z) * k;
  const dx = a.dx + (b.dx - a.dx) * k;
  const dz = a.dz + (b.dz - a.dz) * k;
  const mag = Math.hypot(dx, dz) || 1;
  return {
    x,
    y,
    z,
    yaw: Math.atan2(dx / mag, dz / mag),
    dx: dx / mag,
    dz: dz / mag,
    nx: a.nx,
    nz: a.nz,
    bank: a.bank,
  };
}

// Graderíos con público: se calculan sobre la misma spline que la pista para
// que queden alineados con el peralte y la pendiente, pero desplazados lo
// suficiente para no invadir la calzada ni los obstáculos.
function buildGrandstands(blueprint, frames, arc, length) {
  const count = Math.max(4, Math.round(length / KARTS_GRANDSTAND_SPACING));
  const list = [];
  for (let i = 0; i < count; i++) {
    const distance = ((i + 0.5) * length) / count;
    const t = distance / length;
    const side = i % 2 === 0 ? -1 : 1;
    const raw = kartsPointAtRaw(frames, arc, length, distance);
    const prev = kartsPointAtRaw(frames, arc, length, distance - 3);
    const next = kartsPointAtRaw(frames, arc, length, distance + 3);
    const lateral = side * KARTS_GRANDSTAND_OFFSET;
    list.push({
      id: `${blueprint.id}-gs-${i + 1}`,
      distance: round(distance),
      t: round(t),
      side,
      lateral: round(lateral),
      x: round(raw.x + raw.nx * lateral),
      y: round(raw.y + Math.sin(raw.bank) * lateral),
      z: round(raw.z + raw.nz * lateral),
      yaw: raw.yaw,
      bank: round(raw.bank),
      pitch: round(Math.atan2(next.y - prev.y, 6)),
      rows: 4,
      seatsPerRow: 7,
    });
  }
  return list;
}

export const KARTS_TRACKS = TRACK_BLUEPRINTS.map(buildTrack);

export function getTrack(id) {
  return KARTS_TRACKS.find((track) => track.id === id) || null;
}

export function isTrackPlayable(id) {
  const track = getTrack(id);
  return !!track && track.status === "live";
}

export function kartsTrackLength(id) {
  const track = getTrack(id);
  return track ? track.length : 0;
}

// Posición sobre el arco. `lateral` se mide en metros hacia la normal derecha.
export function kartsPointAt(id, distance, lateral = 0) {
  const track = getTrack(id);
  if (!track) return null;
  const p = kartsPointAtRaw(track.frames, track.arc, track.length, distance);
  const side = clamp(Number(lateral) || 0, -track.width, track.width);
  // Pendiente en la dirección de marcha: se usa para que la física tenga en
  // cuenta cuestas arriba/abajo y para inclinar el kart en la pantalla.
  const prev = kartsPointAtRaw(track.frames, track.arc, track.length, distance - 3);
  const next = kartsPointAtRaw(track.frames, track.arc, track.length, distance + 3);
  return {
    x: round(p.x + p.nx * side),
    y: round(p.y + Math.sin(p.bank) * side),
    z: round(p.z + p.nz * side),
    yaw: p.yaw,
    bank: round(p.bank),
    pitch: round(Math.atan2(next.y - prev.y, 6)),
    t: round(((distance % track.length) + track.length) % track.length / track.length),
    dx: p.dx,
    dz: p.dz,
    nx: p.nx,
    nz: p.nz,
  };
}

// Proyección precisa de (x,z) sobre la pista. `hint` es el índice de muestra
// anterior; al conducción real solo hay que mirar una ventana corta.
export function kartsNearest(id, x, z, hint = -1) {
  const track = getTrack(id);
  if (!track || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  const frames = track.frames;
  const n = frames.length;
  let start = 0;
  let end = n;
  if (Number.isInteger(hint) && hint >= 0) {
    start = (hint - 60 + n) % n;
    end = 121;
  }
  let best = -1;
  let bestDist = Infinity;
  for (let k = 0; k < end; k++) {
    const i = (start + k) % n;
    const f = frames[i];
    const d = (f.x - x) ** 2 + (f.z - z) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  // Refinamos contra los dos segmentos vecinos para no quedar a 0,5 m del
  // punto real cuando el coche va a alta velocidad.
  let bestProj = null;
  for (const shift of [-1, 0]) {
    const i = (best + shift + n) % n;
    const a = frames[i];
    const b = frames[(i + 1) % n];
    const sx = b.x - a.x;
    const sz = b.z - a.z;
    const len2 = sx * sx + sz * sz || 1;
    const u = clamp(((x - a.x) * sx + (z - a.z) * sz) / len2, 0, 1);
    const px = a.x + sx * u;
    const pz = a.z + sz * u;
    const dist = Math.hypot(x - px, z - pz);
    if (!bestProj || dist < bestProj.distance) {
      const dx = a.dx + (b.dx - a.dx) * u;
      const dz = a.dz + (b.dz - a.dz) * u;
      const mag = Math.hypot(dx, dz) || 1;
      const nx = -dz / mag;
      const nz = dx / mag;
      bestProj = {
        index: i,
        distance: dist,
        lateral: (x - px) * nx + (z - pz) * nz,
        x: px,
        y: a.y + (b.y - a.y) * u,
        z: pz,
        t: track.arc[i] / track.length + (u * (track.arc[i + 1] - track.arc[i])) / track.length,
        yaw: Math.atan2(dx / mag, dz / mag),
        bank: a.bank,
      };
    }
  }
  return bestProj;
}

export function kartsSectorOf(t) {
  return Math.floor(((((t % 1) + 1) % 1) * KARTS_SECTORS)) % KARTS_SECTORS;
}

export function kartsSurfaceAt(trackId, t) {
  const track = getTrack(trackId);
  if (!track) return { grip: 1, type: "asphalt", label: "Asfalto" };
  for (const surface of track.surfaces) {
    if (surface.from <= t && t <= surface.to) return surface;
  }
  return { grip: 1, type: "asphalt", label: "Asfalto" };
}

export function kartsBoostAt(trackId, t) {
  const track = getTrack(trackId);
  if (!track) return false;
  return track.boosts.some((boost) => {
    let d = Math.abs(t - boost.t);
    d = Math.min(d, 1 - d);
    return d <= 0.012;
  });
}

export function kartsShortcutAt(trackId, t, lateral) {
  const track = getTrack(trackId);
  if (!track || !Number.isFinite(lateral)) return null;
  for (const shortcut of track.shortcuts) {
    if (t >= shortcut.fromT && t <= shortcut.toT && Math.sign(lateral) === shortcut.side) {
      return shortcut;
    }
  }
  return null;
}

// Colisión con los obstáculos del trazado. Se mide en coordenadas de pista para
// que funcione igual en curvas, peraltes y al cerrar la vuelta.
export function kartsObstacleHits(trackId, distance, lateral, kartHalfLength = 1.3, kartHalfWidth = 0.9) {
  const track = getTrack(trackId);
  if (!track || !Number.isFinite(distance) || !Number.isFinite(lateral)) return null;
  const d = ((distance % track.length) + track.length) % track.length;
  for (const obstacle of track.obstacles) {
    let delta = Math.abs(d - obstacle.distance);
    delta = Math.min(delta, track.length - delta);
    if (
      delta <= obstacle.radius + kartHalfLength &&
      Math.abs(lateral - obstacle.lateral) <= obstacle.radius + kartHalfWidth
    ) {
      return obstacle;
    }
  }
  return null;
}

export function kartsTunnelAt(trackId, t) {
  const track = getTrack(trackId);
  if (!track) return false;
  return track.tunnels.some((tunnel) => t >= tunnel.fromT && t <= tunnel.toT);
}

// Parrilla de salida: ocho huecos en dos columnas, ligeramente por detrás de
// la línea (t=0) para que la primera curva no se congestione.
export function kartsSpawnFor(trackId, index = 0, total = KARTS_MAX_PLAYERS) {
  const track = getTrack(trackId) || KARTS_TRACKS[0];
  const i = ((Math.round(index) % KARTS_MAX_PLAYERS) + KARTS_MAX_PLAYERS) % KARTS_MAX_PLAYERS;
  const row = Math.floor(i / 2);
  const side = i % 2 === 0 ? -1 : 1;
  // La parrilla queda JUSTO DESPUÉS de la línea de salida: así el sector 0 es
  // el primero que se visita y la primera vuelta se valida desde el inicio.
  const distance = 8 + row * 9;
  const point = kartsPointAt(track.id, distance, side * 3.2);
  return {
    x: point.x,
    y: point.y,
    z: point.z,
    yaw: point.yaw,
    distance,
    lateral: side * 3.2,
  };
}

// Pedestales de la tienda y portales de las pistas, en el paddock.
export const KART_PEDESTALS = KART_CATALOG.map((kart, index) => {
  const angle = -Math.PI * 0.82 + index * 0.42;
  return {
    kartId: kart.id,
    x: round(KARTS_PADDOCK_CENTER.x + Math.cos(angle) * 17),
    z: round(KARTS_PADDOCK_CENTER.z + Math.sin(angle) * 17 + 4),
    yaw: round(angle + Math.PI / 2),
  };
});

export const KARTS_PORTALS = KARTS_TRACKS.map((track, index) => {
  const angle = Math.PI * (0.05 + index * 0.22);
  return {
    trackId: track.id,
    x: round(KARTS_PADDOCK_CENTER.x + Math.cos(angle) * 30),
    z: round(KARTS_PADDOCK_CENTER.z + Math.sin(angle) * 30 - 10),
    color: track.color,
    label: track.short,
    status: track.status,
  };
});

export const KARTS_PORTAL_TRIGGER = 6;
