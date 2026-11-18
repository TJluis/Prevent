// Definición centralizada de skins del avatar (FV2).
// Cada skin es un objeto de datos: paleta que repinta el cuerpo y
// una lista de partes (piezas) ancladas a posiciones nombradas.
// Convención camelCase en inglés, coherente con el proyecto.

// Puntos de anclaje del modelo base (coordenadas locales del avatar).
// Si el modelo cambia (cabecera más grande, torso más ancho, etc.)
// solo hay que actualizar estos valores: las skins se ajustan solas.
export const ANCHORS = {
  torso: [0, 0.9, 0.32],
  neck: [0, 0.9, 0],
  face: [0, 1.4, 0.27],
  headTop: [0, 1.66, 0],
  head: [0, 1.58, 0],
  headCenter: [0, 1.32, 0],
  shoulderL: [-0.36, 1.06, 0.1],
  shoulderR: [0.36, 1.06, 0.1],
  sideL: [-0.52, 0.8, 0.02],
  sideR: [0.52, 0.8, 0.02],
};

const PI = Math.PI;

// parts: { mesh, args, color, anchor, offset?, rot?, text?, textColor?, sway? }
// mesh: "Box" | "Sphere" | "Cone" | "Cylinder" | "Torus" | "Capsule" | "Helmet" | "Plane"
//       | "Garment" | "CapShell" | "Band"
// - "Garment": ropa que abraza la silueta procesal (cápsula ∪ panza) entre yMin
//   e yMax. args: { yMin, yMax, off?, arcStart?, arcEnd? }. anchor "neck".
// - "CapShell": casco/capucha que calza sobre la esfera de la cabeza. args: { yMin, off? }.
// - "Band": relieve conforme (dobladillo, vuelta, cinturilla o costura) cosido a
//   la prenda: args: { yMin, yMax, base?, off?, arcStart?, arcEnd? }.
//   Sin arcStart/arcEnd rodea toda la prenda; con arcos angostos hace una
//   costura vertical en un tramo.
// - "Plane" con "text" => número/letrero dibujado en canvas. Con "dynamic" el
//   texto se resuelve desde la apariencia (appearance.number o
//   appearance.jerseyName) y cae al fallback "text"; "fallbackToName" usa el
//   nombre del jugador si no hay texto; "back": true pega la pieza a la espalda
//   (z negativa sobre silhouetteRadiusAt(y, PI), textura espejada).
// - "surface": true posiciona la pieza sobre la superficie del cuerpo (surfaceZ = separación);
//   elimina offsets Z manuales.
// - "sway": { amp, speed } hace oscilar la pieza con el movimiento (ropa colgante).
// - "hideBelly": true oculta la esfera de la panza (la piel que sobresalía de la
//   ropa en los dobladillos) porque la skin viste todo el cuerpo. Las skins de
//   pecho desnudo (playero, sencillo, fiesta, hielo, galaxia, paja) la conservan.
// Los yMin de las prendas de torso bajan hasta ~0.30 para que la panza quede
// DENTRO de la ropa; las piernas se cubren con pantalones (yMin ~0.06).
export const SKIN_DEFS = {
  tuxedo: {
    label: "Traje",
    colors: { body: 0x22263a, belly: 0xf4f8fc },
    hideBelly: true,
    parts: [
      { mesh: "Garment", args: { yMin: 0.3, yMax: 1.02, off: 0.012 }, color: 0xf4f8fc, anchor: "neck" },
      { mesh: "Garment", args: { yMin: 0.3, yMax: 1.05, arcStart: 0.85, arcEnd: PI * 2 - 0.85 }, color: 0x1c2134, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.3, yMax: 0.335, arcStart: 0.85, arcEnd: PI * 2 - 0.85 }, color: 0x161b2c, anchor: "neck" },
      { mesh: "Garment", args: { yMin: 0.06, yMax: 0.3 }, color: 0x1c2134, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.06, yMax: 0.09 }, color: 0x161b2c, anchor: "neck" },
      { mesh: "Box", args: [0.16, 0.06, 0.07], color: 0xf4f8fc, anchor: "torso", offset: [0, 0.26, 0.05] },
      { mesh: "Box", args: [0.07, 0.07, 0.04], color: 0x11131a, anchor: "torso", offset: [0, 0.06, 0], surface: true, surfaceZ: 0.03 },
      { mesh: "Box", args: [0.06, 0.2, 0.03], color: 0x11131a, anchor: "torso", offset: [0, -0.12, 0], surface: true, surfaceZ: 0.03, sway: { amp: 0.06, speed: 3 } },
      { mesh: "Box", args: [0.08, 0.24, 0.02], color: 0x11131a, anchor: "torso", offset: [-0.11, 0.14, 0], surface: true, surfaceZ: 0.08, rot: [0, 0, 0.35] },
      { mesh: "Box", args: [0.08, 0.24, 0.02], color: 0x11131a, anchor: "torso", offset: [0.11, 0.14, 0], surface: true, surfaceZ: 0.08, rot: [0, 0, -0.35] },
      { mesh: "Sphere", args: [0.022, 6, 6], color: 0x11131a, anchor: "torso", offset: [-0.05, -0.3, 0], surface: true, surfaceZ: 0.03 },
      { mesh: "Sphere", args: [0.022, 6, 6], color: 0x11131a, anchor: "torso", offset: [0.05, -0.3, 0], surface: true, surfaceZ: 0.03 },
    ],
  },
  beach: {
    label: "Playero",
    colors: { belly: 0xd9f5e0 },
    parts: [
      { mesh: "Box", args: [0.1, 0.07, 0.04], color: 0x111319, anchor: "face", offset: [-0.15, 0, 0] },
      { mesh: "Box", args: [0.1, 0.07, 0.04], color: 0x111319, anchor: "face", offset: [0.15, 0, 0] },
      { mesh: "Box", args: [0.06, 0.03, 0.03], color: 0x111319, anchor: "face", offset: [0, 0, 0] },
      { mesh: "Torus", args: [0.3, 0.06, 8, 20], color: 0xff6b5d, anchor: "neck", offset: [0, 0, 0], rot: [PI / 2, 0, 0] },
      { mesh: "Garment", args: { yMin: 0.24, yMax: 0.62 }, color: 0xff6b5d, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.24, yMax: 0.27 }, color: 0xe25c50, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.56, yMax: 0.585 }, color: 0xffffff, anchor: "neck" },
    ],
  },
  developer: {
    label: "Programador",
    colors: { body: 0x1f6f4a, belly: 0xf4f8fc },
    hideBelly: true,
    parts: [
      { mesh: "Garment", args: { yMin: 0.3, yMax: 1.04 }, color: 0x2b7d54, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.3, yMax: 0.335 }, color: 0x25704c, anchor: "neck" },
      { mesh: "Garment", args: { yMin: 0.06, yMax: 0.3 }, color: 0x2b7d54, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.06, yMax: 0.09 }, color: 0x25704c, anchor: "neck" },
      { mesh: "CapShell", args: { yMin: 1.4 }, color: 0x2b7d54, anchor: "headCenter" },
      { mesh: "Box", args: [0.06, 0.11, 0.05], color: 0x2b2f36, anchor: "head", offset: [-0.32, 0, 0] },
      { mesh: "Box", args: [0.06, 0.11, 0.05], color: 0x2b2f36, anchor: "head", offset: [0.32, 0, 0] },
      { mesh: "Torus", args: [0.3, 0.035, 8, 24], color: 0x2b2f36, anchor: "headTop", offset: [0, 0.02, 0] },
      { mesh: "Box", args: [0.03, 0.07, 0.03], color: 0x2b2f36, anchor: "head", offset: [0, -0.02, 0.28] },
      { mesh: "Torus", args: [0.44, 0.06, 8, 24], color: 0x175a38, anchor: "neck", offset: [0, 0.06, 0], rot: [PI / 2, 0, 0] },
    ],
  },
  simple: {
    label: "Sencillo",
    colors: {},
    parts: [
      { mesh: "Box", args: [0.18, 0.02, 0.02], color: 0x11131a, anchor: "face", offset: [0, -0.1, 0.05] },
    ],
  },
  tactical: {
    label: "Táctico",
    colors: { body: 0x2c3038, belly: 0x23262c },
    hideBelly: true,
    parts: [
      { mesh: "Garment", args: { yMin: 0.445, yMax: 1.02 }, color: 0x3a4149, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.445, yMax: 0.48 }, color: 0x303840, anchor: "neck" },
      { mesh: "Garment", args: { yMin: 0.06, yMax: 0.44 }, color: 0x24282f, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.06, yMax: 0.09 }, color: 0x1d2026, anchor: "neck" },
      { mesh: "Box", args: [0.2, 0.26, 0.06], color: 0x23262c, anchor: "torso", offset: [0, 0.14, 0], surface: true, surfaceZ: 0.08 },
      { mesh: "Box", args: [0.05, 0.14, 0.07], color: 0x30363e, anchor: "torso", offset: [-0.13, 0.08, 0], surface: true, surfaceZ: 0.08 },
      { mesh: "Box", args: [0.05, 0.14, 0.07], color: 0x30363e, anchor: "torso", offset: [0.13, 0.08, 0], surface: true, surfaceZ: 0.08 },
      { mesh: "Box", args: [0.12, 0.1, 0.05], color: 0x2a2f36, anchor: "shoulderL", offset: [0.04, -0.04, 0.02] },
      { mesh: "Box", args: [0.12, 0.1, 0.05], color: 0x2a2f36, anchor: "shoulderR", offset: [0.04, -0.04, 0.02] },
      { mesh: "Band", args: { yMin: 0.48, yMax: 0.55 }, color: 0x24282f, anchor: "neck" },
      { mesh: "Box", args: [0.09, 0.07, 0.04], color: 0x111319, anchor: "torso", offset: [0, -0.41, 0], surface: true, surfaceZ: 0.1 },
      { mesh: "CapShell", args: { yMin: 1.42 }, color: 0x2b3038, anchor: "headCenter" },
      { mesh: "Box", args: [0.24, 0.035, 0.05], color: 0x0d1016, anchor: "face", offset: [0, -0.02, 0.08] },
      { mesh: "Box", args: [0.09, 0.09, 0.03], color: 0x111319, anchor: "face", offset: [-0.15, 0, 0] },
      { mesh: "Box", args: [0.09, 0.09, 0.03], color: 0x111319, anchor: "face", offset: [0.15, 0, 0] },
      { mesh: "Box", args: [0.03, 0.07, 0.03], color: 0x111319, anchor: "face", offset: [0.04, -0.02, 0] },
    ],
  },
  volleyball: {
    label: "Voleibol",
    colors: { body: 0x2dd4bf, belly: 0x2dd4bf },
    hideBelly: true,
    parts: [
      { mesh: "Garment", args: { yMin: 0.46, yMax: 1.1 }, color: 0x2dd4bf, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.46, yMax: 0.485 }, color: 0x18b8a6, anchor: "neck" },
      { mesh: "Plane", args: [0.22, 0.24], text: "7", dynamic: "number", textColor: "#0b3a45", anchor: "torso", offset: [0, 0.15, 0], surface: true, surfaceZ: 0.052 },
      { mesh: "Plane", args: [0.44, 0.16], text: "@name", dynamic: "jerseyName", fallbackToName: true, textColor: "#0b3a45", anchor: "torso", offset: [0, -0.22, 0], back: true, surfaceZ: 0.052, rot: [0, PI, 0] },
      { mesh: "Garment", args: { yMin: 0.24, yMax: 0.46 }, color: 0x1d8f82, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.24, yMax: 0.27 }, color: 0x177a70, anchor: "neck" },
    ],
  },
  strawhat: {
    label: "Sombrero de paja",
    colors: {},
    parts: [
      { mesh: "Cylinder", args: [0.4, 0.42, 0.04, 20], color: 0xd9a62a, anchor: "headTop", offset: [0, -0.02, 0] },
      { mesh: "Cylinder", args: [0.16, 0.22, 0.26, 18], color: 0xc9972f, anchor: "headTop", offset: [0, 0.14, 0] },
      { mesh: "Cylinder", args: [0.17, 0.21, 0.06, 18], color: 0xc0392b, anchor: "headTop", offset: [0, 0.04, 0] },
    ],
  },
  pirate: {
    label: "Pirata",
    colors: { body: 0x5d4037, belly: 0xffe9c9 },
    hideBelly: true,
    parts: [
      { mesh: "Garment", args: { yMin: 0.3, yMax: 1.02, off: 0.012 }, color: 0xf5f0e6, anchor: "neck" },
      { mesh: "Garment", args: { yMin: 0.3, yMax: 1.05 }, color: 0x191a1e, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.3, yMax: 0.335 }, color: 0x101114, anchor: "neck" },
      { mesh: "Garment", args: { yMin: 0.06, yMax: 0.3 }, color: 0x191a1e, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.06, yMax: 0.09 }, color: 0x101114, anchor: "neck" },
      { mesh: "Box", args: [0.16, 0.05, 0.08], color: 0xf5f0e6, anchor: "torso", offset: [0, 0.26, 0.05] },
      { mesh: "Box", args: [0.08, 0.24, 0.02], color: 0x191a1e, anchor: "torso", offset: [-0.11, 0.14, 0], surface: true, surfaceZ: 0.08, rot: [0, 0, 0.35] },
      { mesh: "Box", args: [0.08, 0.24, 0.02], color: 0x191a1e, anchor: "torso", offset: [0.11, 0.14, 0], surface: true, surfaceZ: 0.08, rot: [0, 0, -0.35] },
      { mesh: "Box", args: [0.09, 0.09, 0.05], color: 0xf5c542, anchor: "torso", offset: [0, -0.24, 0], surface: true, surfaceZ: 0.08 },
      { mesh: "Cylinder", args: [0.38, 0.4, 0.05, 18], color: 0x17181c, anchor: "headTop", offset: [0, -0.02, 0] },
      { mesh: "Cylinder", args: [0.16, 0.26, 0.2, 12], color: 0x17181c, anchor: "headTop", offset: [0, 0.14, 0] },
      { mesh: "Box", args: [0.09, 0.09, 0.04], color: 0xf5f0e6, anchor: "headTop", offset: [0, 0.1, 0.22] },
      { mesh: "Box", args: [0.1, 0.1, 0.06], color: 0x0d0f16, anchor: "face", offset: [0.1, 0, 0.01] },
    ],
  },
  ninja: {
    label: "Ninja",
    colors: { body: 0x17181d, belly: 0x2e3942, beak: 0xff6b35 },
    hideBelly: true,
    parts: [
      { mesh: "Garment", args: { yMin: 0.1, yMax: 1.05 }, color: 0x2e3942, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.1, yMax: 0.135 }, color: 0x28323b, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.52, yMax: 0.6 }, color: 0x9c1a1a, anchor: "neck" },
      { mesh: "Box", args: [0.06, 0.16, 0.02], color: 0x9c1a1a, anchor: "neck", offset: [-0.2, -0.36, -0.06], sway: { amp: 0.1, speed: 2 } },
      { mesh: "Box", args: [0.44, 0.08, 0.1], color: 0x7a1212, anchor: "headTop", offset: [0, -0.02, 0] },
      { mesh: "Box", args: [0.06, 0.18, 0.01], color: 0x7a1212, anchor: "head", offset: [0, 0, -0.22] },
      { mesh: "Box", args: [0.06, 0.16, 0.01], color: 0x7a1212, anchor: "head", offset: [0.04, -0.02, -0.22] },
    ],
  },
  party: {
    label: "Fiesta",
    colors: { body: 0x8e44ad },
    parts: [
      { mesh: "Cone", args: [0.17, 0.45, 16], color: 0x8e44ad, anchor: "headTop", offset: [0, 0.2, 0] },
      { mesh: "Sphere", args: [0.08, 10, 8], color: 0xf2c94c, anchor: "headTop", offset: [0, 0.44, 0] },
    ],
  },
  hielo: {
    label: "Hielo",
    colors: { body: 0xa8dcf2, belly: 0xffffff, beak: 0xffb74d },
    parts: [
      { mesh: "Cone", args: [0.14, 0.3, 6], color: 0xe8f4ff, anchor: "headTop", offset: [0, 0.2, 0] },
      { mesh: "Cone", args: [0.08, 0.18, 5], color: 0xd6ecff, anchor: "headTop", offset: [-0.11, 0.14, 0.02] },
      { mesh: "Cone", args: [0.08, 0.18, 5], color: 0xd6ecff, anchor: "headTop", offset: [0.11, 0.14, 0.02] },
      { mesh: "Sphere", args: [0.03, 8, 8], color: 0xffffff, anchor: "headTop", offset: [0, 0.48, 0] },
    ],
  },
  galaxia: {
    label: "Galaxia",
    colors: { body: 0x2b1055, belly: 0xe0b4ff, beak: 0xf9c74f },
    parts: [
      { mesh: "Torus", args: [0.34, 0.028, 8, 24], color: 0xf9c74f, anchor: "headTop", offset: [0, 0.22, 0], rot: [0.9, 0.3, 0] },
      { mesh: "Sphere", args: [0.035, 8, 8], color: 0xfff6d0, anchor: "headTop", offset: [-0.12, 0.12, 0.26] },
      { mesh: "Sphere", args: [0.03, 8, 8], color: 0x8ecae6, anchor: "headTop", offset: [0.13, 0.28, 0.18] },
    ],
  },
  futbol: {
    label: "Futbolero",
    colors: { body: 0x303136, belly: 0xffffff, beak: 0xffd166 },
    hideBelly: true,
    parts: [
      { mesh: "Garment", args: { yMin: 0.46, yMax: 1.1 }, color: 0x303136, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.46, yMax: 0.485 }, color: 0xffffff, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.56, yMax: 0.585 }, color: 0xffffff, anchor: "neck" },
      { mesh: "Plane", args: [0.2, 0.22], text: "5", dynamic: "number", textColor: "#e8e8ea", anchor: "torso", offset: [0, 0.15, 0], surface: true, surfaceZ: 0.052 },
      { mesh: "Plane", args: [0.44, 0.16], text: "@name", dynamic: "jerseyName", fallbackToName: true, textColor: "#ffffff", anchor: "torso", offset: [0, -0.22, 0], back: true, surfaceZ: 0.052, rot: [0, PI, 0] },
      { mesh: "Garment", args: { yMin: 0.24, yMax: 0.46 }, color: 0x22252a, anchor: "neck" },
      { mesh: "Band", args: { yMin: 0.24, yMax: 0.27 }, color: 0x171a1e, anchor: "neck" },
    ],
  },
};

// Lista ordenada de ids de skin (para UI y aleatorización).
export const SKIN_IDS = Object.keys(SKIN_DEFS);