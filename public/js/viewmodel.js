import * as THREE from "/vendor/three/three.module.js";
import { getWeapon } from "./weaponDefs.js";
import { SKIN_DEFS } from "./skinDefs.js";

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// Color con el que se pintan las manos FPV: debe hacer juego con el cuerpo del
// pingüino (igual que las alas en 3ª persona). Si hay skin usa su color de
// cuerpo; si no, el color elegido; por defecto el body estándar.
function resolveHandColor(appearance) {
  if (appearance && typeof appearance === "object") {
    const skinDef = appearance.skin ? SKIN_DEFS[appearance.skin] : null;
    if (skinDef && skinDef.colors && skinDef.colors.body != null) return skinDef.colors.body;
    if (typeof appearance.body === "string") return appearance.body;
  }
  return 0x222b3f;
}

// Postura de las dos aletas por arma (rot [x, y, z] y opcional pos [x,y,z]).
// Afinan el "agarre": las aletas quedan una por cada lado de la cámara (como
// en el pingüino 3ª persona), inclinadas hacia adentro y con la punta baja.
// Pose de las aletas en primera persona. Las 17 armas fueron ajustadas una a
// una con public/debug/flippertune.html (posicion y rotacion por aleta).
const HAND_TUNING = {
  default: { rightRot: [0.22, 0, 0.35], leftRot: [0.22, 0, -0.35] },
  pistola: { rightPos: [0.085, -0.395, -0.03], rightRot: [0.24, -0.11, 0.41], leftPos: [-0.14, -0.385, -0.205], leftRot: [0.22, 0, -0.35] },
  smg: { rightPos: [0.05, -0.305, 0.005], rightRot: [-0.31, -1.25, -0.08], leftPos: [-0.075, -0.365, -0.075], leftRot: [-0.15, 1.15, -0.6] },
  assault: { rightPos: [0.115, -0.275, 0.08], rightRot: [-0.11, -1.22, 0.35], leftPos: [-0.04, -0.385, -0.15], leftRot: [0.22, 1.48, -0.34] },
  shotgun: { rightPos: [0.14, -0.42, 0.015], rightRot: [0.05, -0.02, 0.41], leftPos: [-0.075, -0.395, -0.15], leftRot: [-0.47, -0.34, -0.18] },
  sniper: { rightPos: [-0.015, -0.32, 0.15], rightRot: [-0.31, -1.64, 0.4], leftPos: [-0.13, -0.285, -0.25], leftRot: [-0.31, 0.57, -0.4] },
  granade: { rightPos: [0.095, -0.305, -0.22], rightRot: [0.11, -1.61, 0.22], leftPos: [-0.06, -0.32, -0.26], leftRot: [0.2, 1.77, -0.22] },
  plasma: { rightPos: [0.14, -0.43, -0.085], rightRot: [0.22, 0, 0.35], leftPos: [-0.06, -0.34, -0.22], leftRot: [0.22, 1.58, -0.35] },
  minigun: { rightPos: [0.085, -0.365, 0.105], rightRot: [0.3, -1.64, 0.4], leftPos: [-0.085, -0.385, -0.285], leftRot: [0.31, 0.24, -0.15] },
  llama: { rightPos: [0.05, -0.195, 0.105], rightRot: [-0.96, -0.34, 0.15], leftPos: [-0.52, -0.34, 0.09], leftRot: [0.22, 0, -0.35] },
  laser: { rightPos: [0.115, -0.33, 0.04], rightRot: [0.22, -1.25, 0.35], leftPos: [-0.005, -0.34, -0.115], leftRot: [0.22, 1.84, -0.35] },
  arco: { rightPos: [0.23, -0.395, -0.18], rightRot: [0.18, -0.1, 0.32], leftPos: [-0.25, -0.44, -0.16], leftRot: [0.18, 0.2, -0.38] },
  espada: { rightPos: [0.085, -0.32, -0.175], rightRot: [0.26, -1.38, 0.36], leftPos: [-0.095, -0.24, -0.16], leftRot: [0.26, 1.12, -0.36] },
  hacha: { rightPos: [0.06, -0.44, -0.34], rightRot: [0.24, -1.67, 0.36], leftPos: [-0.05, -0.305, -0.26], leftRot: [0.24, 1.38, -0.36] },
  daga: { rightPos: [0.085, -0.295, -0.05], rightRot: [0.24, -1.32, 0.57], leftPos: [-0.665, -0.385, -0.06], leftRot: [0.24, 0, -0.34] },
  maza: { rightPos: [0.085, -0.62, -0.295], rightRot: [0.24, -1.25, 0.36], leftPos: [-0.095, -0.485, -0.33], leftRot: [0.24, 1.15, -0.36] },
  lanza: { rightPos: [0.175, -0.25, 0.13], rightRot: [-0.08, -0.08, 0.36], leftPos: [-0.04, -0.24, -0.2], leftRot: [-0.21, 1.19, -0.36] },
  escudo: { rightPos: [0.32, -0.41, -0.14], rightRot: [0.16, 0, 0.4], leftPos: [-0.81, -0.42, -0.14], leftRot: [0.16, 0, -0.4] },
  // Armas de la Fase 2: reutilizan la pose de un arma de forma parecida.
  revolver: { rightPos: [0.085, -0.395, -0.03], rightRot: [0.24, -0.11, 0.41], leftPos: [-0.14, -0.385, -0.205], leftRot: [0.22, 0, -0.35] },
  dmr: { rightPos: [-0.015, -0.32, 0.15], rightRot: [-0.31, -1.64, 0.4], leftPos: [-0.13, -0.285, -0.25], leftRot: [-0.31, 0.57, -0.4] },
  martillo: { rightPos: [0.085, -0.62, -0.295], rightRot: [0.24, -1.25, 0.36], leftPos: [-0.095, -0.485, -0.33], leftRot: [0.24, 1.15, -0.36] },
  ballesta: { rightPos: [0.23, -0.395, -0.18], rightRot: [0.18, -0.1, 0.32], leftPos: [-0.25, -0.44, -0.16], leftRot: [0.18, 0.2, -0.38] },
};

// Posición de la ALETA (raíz) por defecto: una a cada lado de la cámara,
// a una distancia horizontal GLOBAL (respecto a la cámara) de ±WING_X, de
// modo que queden visibles flanqueando el arma. Se convierte a local del
// grupo para compensar el offset BASE y la escala VM_SCALE del viewmodel.
// side: +1 derecha.
const WING_X = 0.42;
function defaultHandPos(side, grips) {
  const g = side > 0 ? grips.right : grips.left;
  const x = (side * WING_X - BASE.x) / VM_SCALE;
  return [x, g[1] - 0.06, g[2] + 0.04];
}

// Convierte un punto en coordenadas GLOBALES respecto a la cámara al espacio
// local del grupo del viewmodel (que está desplazado por BASE y escalado por
// VM_SCALE). Necesario para las posturas que NO dependen del arma, como la
// postura de reposo: sin esta conversión las aletas caen cerca del arma (que
// ya está corrida hacia la derecha) y se ven junta.
function globalToLocal(gx, gy, gz) {
  return [(gx - BASE.x) / VM_SCALE, (gy - BASE.y) / VM_SCALE, (gz - BASE.z) / VM_SCALE];
}


function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.15,
    ...(opts.side ? { side: opts.side } : {}),
    ...(opts.emissive
      ? { emissive: opts.emissive, emissiveIntensity: opts.emIntensity ?? 0.6 }
      : {}),
  });
}

const BASE = new THREE.Vector3(0.26, -0.12, -0.48);
const VM_SCALE = 1.15;

function add(group, mesh, x, y, z) {
  if (x !== undefined) mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function makeFlipper(side, color) {
  // Aleta estilo la del pingüino en 3ª persona: cápsula + punta redonda,
  // aplanada (silueta teardrop) y del color del cuerpo. El extremo +Y es el
  // "puño" (muñeca) y el -Y la punta de la aleta. side: +1 derecha.
  const flipper = new THREE.Group();
  const skin = mat(color, { roughness: 0.7 });
  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.18, 6, 10), skin);
  upper.position.y = 0.13;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.078, 8, 8), skin);
  tip.position.y = -0.09;
  const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.094, 10, 8), skin);
  wrist.scale.set(1, 0.8, 0.7);
  wrist.position.y = 0.3;
  flipper.add(upper, tip, wrist);
  flipper.scale.set(1, 1.1, 0.55);
  flipper.userData.side = side;
  return flipper;
}

// ------------------------------------------------ ESTRUCTURA DE LAS ARMAS ------------------------------------------------
// Cada arma se describe como una LISTA DE PIEZAS con sus medidas. Antes estas
// medidas vivían escritas dentro de buildGun()/buildMelee(); ahora viven aquí,
// de modo que public/debug/weapontune.html puede editar cualquier número,
// añadir o quitar piezas y recolorearlas sin tocar el código.
//
// Piezas: caja | cilindro | esfera | cono | toro | icosaedro | rotor | puntas | arco
//   todas: x,y,z (posicion), rx,ry,rz (rotacion), mat (cuerpo, acento, metal,
//   oscuro, madera, maderaOscura, laton, cuero, cuerda), escala, visible
//   caja: w,h,l · cilindro: r,r2,l,seg · esfera: r,seg,seg2,phi,phiLen,theta,thetaLen
//   cono: r,h,seg · toro: r,tubo,seg,seg2,arc · icosaedro: r,detalle
//   rotor: r,l,r2,l2,radio,n,eje,eje2 (eje/eje2 = desplazamiento z de los caños
//     DENTRO del rotor; x,y,z colocan el rotor completo)
//   puntas: r,h,seg,lerp,centro,dirs (centro/dirs en el espacio de la pieza)
const WEAPON_PARTS = {
  pistola: {
    piezas: [
      { tipo: "caja", mat: "oscuro", w: 0.07, h: 0.09, l: 0.32, x: 0, y: 0.04, z: -0.18 },
      { tipo: "cilindro", mat: "metal", r: 0.028, l: 0.2, seg: 10, x: 0, y: 0.04, z: -0.4, rx: Math.PI / 2 },
      { tipo: "caja", mat: "cuerpo", w: 0.058, h: 0.2, l: 0.075, x: 0, y: -0.1, z: -0.04, rx: -0.3 },
      { tipo: "toro", mat: "laton", r: 0.035, tubo: 0.012, seg: 6, seg2: 12, arc: Math.PI * 1.5, x: 0, y: -0.06, z: -0.14, rz: 0.4 },
      { tipo: "caja", mat: "acento", w: 0.032, h: 0.008, l: 0.16, x: 0, y: 0.088, z: -0.24 },
      { tipo: "caja", mat: "cuerpo", w: 0.014, h: 0.012, l: 0.02, x: 0, y: 0.1, z: -0.04 },
      { tipo: "caja", mat: "cuerpo", w: 0.014, h: 0.012, l: 0.02, x: 0, y: 0.1, z: -0.32 },
    ],
    agarres: { right: [0.05, -0.12, -0.02], left: [-0.06, -0.08, -0.12] },
  },
  smg: {
    piezas: [
      { tipo: "cilindro", mat: "oscuro", r: 0.03, l: 0.26, seg: 10, x: 0, y: 0.01, z: -0.42, rx: Math.PI / 2 },
      { tipo: "caja", mat: "cuerpo", w: 0.06, h: 0.09, l: 0.42, x: 0, y: 0.01, z: -0.18 },
      { tipo: "caja", mat: "oscuro", w: 0.04, h: 0.18, l: 0.08, x: 0, y: -0.13, z: -0.08, rx: 0.42 },
      { tipo: "caja", mat: "maderaOscura", w: 0.05, h: 0.07, l: 0.13, x: 0, y: 0.01, z: 0.15 },
      { tipo: "caja", mat: "acento", w: 0.062, h: 0.016, l: 0.12, x: 0, y: 0.06, z: -0.32 },
      { tipo: "caja", mat: "cuerpo", w: 0.05, h: 0.03, l: 0.04, x: 0, y: 0.05, z: 0.01 },
    ],
    agarres: { right: [0.06, -0.06, 0.04], left: [-0.06, -0.05, 0.05] },
  },
  assault: {
    piezas: [
      { tipo: "cilindro", mat: "oscuro", r: 0.026, l: 0.38, seg: 10, x: 0, y: 0.02, z: -0.5, rx: Math.PI / 2 },
      { tipo: "caja", mat: "cuerpo", w: 0.07, h: 0.1, l: 0.5, x: 0, y: 0.02, z: -0.17 },
      { tipo: "caja", mat: "oscuro", w: 0.05, h: 0.22, l: 0.09, x: 0, y: -0.13, z: -0.14, rx: 0.3 },
      { tipo: "caja", mat: "madera", w: 0.06, h: 0.09, l: 0.16, x: 0, y: 0.02, z: 0.2 },
      { tipo: "caja", mat: "acento", w: 0.03, h: 0.03, l: 0.3, x: 0, y: 0.09, z: -0.28 },
      { tipo: "caja", mat: "maderaOscura", w: 0.06, h: 0.06, l: 0.16, x: 0, y: 0, z: -0.4 },
      { tipo: "caja", mat: "cuerpo", w: 0.01, h: 0.05, l: 0.01, x: 0, y: 0.08, z: -0.06 },
    ],
    agarres: { right: [0.06, -0.06, 0.04], left: [-0.06, -0.05, 0.05] },
  },
  shotgun: {
    piezas: [
      { tipo: "cilindro", mat: "oscuro", r: 0.027, l: 0.5, seg: 10, x: -0.034, y: 0.02, z: -0.44, rx: Math.PI / 2 },
      { tipo: "cilindro", mat: "oscuro", r: 0.027, l: 0.5, seg: 10, x: 0.034, y: 0.02, z: -0.44, rx: Math.PI / 2 },
      { tipo: "caja", mat: "cuerpo", w: 0.1, h: 0.11, l: 0.44, x: 0, y: 0.02, z: -0.14 },
      { tipo: "caja", mat: "oscuro", w: 0.02, h: 0.05, l: 0.28, x: 0, y: -0.06, z: -0.44 },
      { tipo: "caja", mat: "maderaOscura", w: 0.055, h: 0.18, l: 0.08, x: 0, y: -0.1, z: -0.02, rx: -0.18 },
      { tipo: "caja", mat: "acento", w: 0.102, h: 0.018, l: 0.07, x: 0, y: 0.02, z: -0.36 },
    ],
    agarres: { right: [0.06, -0.06, 0.04], left: [-0.06, -0.05, 0.05] },
  },
  sniper: {
    piezas: [
      { tipo: "cilindro", mat: "oscuro", r: 0.022, l: 0.72, seg: 10, x: 0, y: 0.04, z: -0.62, rx: Math.PI / 2 },
      { tipo: "toro", mat: "oscuro", r: 0.036, tubo: 0.02, seg: 6, seg2: 14, x: 0, y: 0.04, z: -0.99, rx: -Math.PI / 2 },
      { tipo: "caja", mat: "cuerpo", w: 0.06, h: 0.1, l: 0.5, x: 0, y: 0.04, z: -0.16 },
      { tipo: "cilindro", mat: "oscuro", r: 0.038, l: 0.3, seg: 12, x: 0, y: 0.15, z: -0.16, rx: Math.PI / 2 },
      { tipo: "cilindro", mat: "acento", r: 0.044, l: 0.025, seg: 12, x: 0, y: 0.15, z: 0.0, rx: Math.PI / 2 },
      { tipo: "cilindro", mat: "acento", r: 0.044, l: 0.025, seg: 12, x: 0, y: 0.15, z: -0.32, rx: Math.PI / 2 },
      { tipo: "caja", mat: "oscuro", w: 0.04, h: 0.1, l: 0.1, x: 0, y: -0.08, z: -0.1, rx: 0.3 },
      { tipo: "caja", mat: "maderaOscura", w: 0.05, h: 0.07, l: 0.2, x: 0, y: 0.04, z: 0.2 },
      { tipo: "cilindro", mat: "laton", r: 0.012, l: 0.09, seg: 8, x: -0.05, y: 0.16, z: -0.06, rz: Math.PI / 2 },
    ],
    agarres: { right: [0.06, -0.06, 0.04], left: [-0.06, -0.05, 0.05] },
  },
  granade: {
    piezas: [
      { tipo: "esfera", mat: "cuerpo", r: 0.1, seg: 14, seg2: 12, x: 0, y: 0.02, z: -0.26 },
      { tipo: "cilindro", mat: "oscuro", r: 0.038, r2: 0.045, l: 0.06, seg: 10, x: 0, y: 0.12, z: -0.26 },
      { tipo: "caja", mat: "oscuro", w: 0.02, h: 0.09, l: 0.03, x: 0.08, y: 0.06, z: -0.26, rz: 0.35 },
      { tipo: "toro", mat: "laton", r: 0.022, tubo: 0.009, seg: 6, seg2: 12, x: 0.1, y: 0.09, z: -0.26 },
      { tipo: "cilindro", mat: "cuerpo", r: 0.055, r2: 0.065, l: 0.16, seg: 12, x: 0, y: 0.02, z: -0.5, rx: Math.PI / 2 },
    ],
    morro: [0, 0, -0.58],
    agarres: { right: [0.06, -0.08, -0.2], left: [-0.05, -0.06, -0.24] },
  },
  plasma: {
    piezas: [
      { tipo: "cilindro", mat: "cuerpo", r: 0.045, l: 0.4, seg: 10, x: 0, y: 0.02, z: -0.38, rx: Math.PI / 2 },
      { tipo: "cilindro", mat: "acento", r: 0.052, l: 0.09, seg: 12, x: 0, y: 0.02, z: -0.48, rx: Math.PI / 2 },
      { tipo: "esfera", mat: "cuerpo", r: 0.1, seg: 12, seg2: 10, thetaLen: Math.PI / 2, x: 0, y: -0.02, z: -0.08, rx: -Math.PI },
      { tipo: "caja", mat: "oscuro", w: 0.05, h: 0.17, l: 0.08, x: 0, y: -0.13, z: -0.08 },
      { tipo: "toro", mat: "acento", r: 0.05, tubo: 0.008, seg: 6, seg2: 14, x: 0, y: 0.02, z: -0.2 },
      { tipo: "esfera", mat: "acento", r: 0.035, seg: 10, seg2: 10, x: 0, y: 0.02, z: -0.6 },
    ],
    agarres: { right: [0.06, -0.06, 0.04], left: [-0.06, -0.05, 0.05] },
  },
  minigun: {
    piezas: [
      { tipo: "rotor", mat: "oscuro", mat2: "metal", r: 0.05, l: 0.28, r2: 0.017, l2: 0.32, radio: 0.048, n: 5, x: 0, y: 0, z: -0.32, eje: 0, eje2: -0.02 },
      { tipo: "cilindro", mat: "cuerpo", r: 0.07, r2: 0.08, l: 0.3, seg: 14, x: 0, y: 0, z: -0.16, rx: Math.PI / 2 },
      { tipo: "cilindro", mat: "maderaOscura", r: 0.03, r2: 0.035, l: 0.34, seg: 8, x: 0, y: -0.2, z: -0.06, rz: Math.PI / 2 },
      { tipo: "caja", mat: "oscuro", w: 0.12, h: 0.1, l: 0.16, x: 0, y: -0.1, z: 0.08 },
      { tipo: "cilindro", mat: "acento", r: 0.074, l: 0.04, seg: 14, x: 0, y: 0, z: -0.02 },
    ],
    agarres: { right: [0.06, -0.18, -0.02], left: [-0.07, -0.16, -0.08] },
  },
  llama: {
    piezas: [
      { tipo: "cilindro", mat: "cuerpo", r: 0.055, l: 0.28, seg: 12, x: 0, y: 0.02, z: -0.24, rx: Math.PI / 2 },
      { tipo: "cono", mat: "oscuro", r: 0.05, h: 0.2, seg: 10, x: 0, y: 0.02, z: -0.5, rx: Math.PI / 2 },
      { tipo: "toro", mat: "acento", r: 0.057, tubo: 0.011, seg: 6, seg2: 14, x: 0, y: 0.02, z: -0.1, ry: Math.PI / 2 },
      { tipo: "cilindro", mat: "oscuro", r: 0.02, l: 0.18, seg: 8, x: 0.06, y: 0.06, z: -0.36, rx: Math.PI / 2 },
      { tipo: "caja", mat: "acento", w: 0.03, h: 0.03, l: 0.02, x: 0, y: 0.058, z: -0.3 },
    ],
    agarres: { right: [0.06, -0.06, 0.04], left: [-0.06, -0.05, 0.05] },
    morro: [0, 0.02, -0.6],
  },
  laser: {
    piezas: [
      { tipo: "cilindro", mat: "cuerpo", r: 0.035, l: 0.38, seg: 10, x: 0, y: 0.02, z: -0.38, rx: Math.PI / 2 },
      { tipo: "cilindro", mat: "acento", r: 0.045, l: 0.07, seg: 12, x: 0, y: 0.02, z: -0.46, rx: Math.PI / 2 },
      { tipo: "caja", mat: "cuerpo", w: 0.06, h: 0.1, l: 0.2, x: 0, y: 0.02, z: -0.08 },
      { tipo: "caja", mat: "oscuro", w: 0.05, h: 0.05, l: 0.15, x: 0, y: 0.02, z: 0.12 },
      { tipo: "esfera", mat: "acento", r: 0.024, seg: 10, seg2: 8, x: 0, y: 0.02, z: -0.62 },
      { tipo: "caja", mat: "acento", w: 0.01, h: 0.03, l: 0.42, x: 0.048, y: 0.02, z: -0.34 },
    ],
    agarres: { right: [0.06, -0.06, 0.04], left: [-0.06, -0.05, 0.05] },
  },
  arco: {
    piezas: [
      { tipo: "arco", mat: "madera", R: 0.4, y0: -0.02, h1: 0.52, h2: -0.12, depth: 0.03, x: 0, y: 0.02, z: -0.24, rx: Math.PI / 2 },
      { tipo: "cilindro", mat: "cuerda", r: 0.003, l: 0.95, seg: 4, x: 0, y: 0.02, z: 0.0, rx: Math.PI / 2 },
      { tipo: "cilindro", mat: "maderaOscura", r: 0.007, l: 0.6, seg: 6, x: 0, y: 0.03, z: -0.45, rx: Math.PI / 2 },
      { tipo: "cono", mat: "metal", r: 0.012, h: 0.06, seg: 6, x: 0, y: 0.03, z: -0.76, rx: -Math.PI / 2 },
      { tipo: "cilindro", mat: "metal", r: 0.008, l: 0.02, seg: 10, x: 0, y: 0.03, z: -0.78, rx: Math.PI / 2 },
      { tipo: "cilindro", mat: "acento", r: 0.036, l: 0.09, seg: 10, x: 0, y: 0.02, z: -0.24, rx: Math.PI / 2 },
    ],
    agarres: { right: [0.04, -0.04, -0.22], left: [-0.07, -0.04, -0.22] },
  },
  espada: {
    piezas: [
      { tipo: "caja", mat: "metal", w: 0.05, h: 0.31, l: 0.62, x: 0, y: 0.36, z: -0.55 },
      { tipo: "cono", mat: "metal", r: 0.034, h: 0.18, seg: 6, x: 0, y: 0.36, z: -0.93, rx: -Math.PI / 2 },
      { tipo: "caja", mat: "acento", w: 0.058, h: 0.31, l: 0.012, x: 0, y: 0.36, z: -0.48 },
      { tipo: "caja", mat: "acento", w: 0.058, h: 0.31, l: 0.012, x: 0, y: 0.36, z: -0.64 },
      { tipo: "caja", mat: "acento", w: 0.058, h: 0.31, l: 0.012, x: 0, y: 0.36, z: -0.8 },
      { tipo: "caja", mat: "acento", w: 0.02, h: 0.29, l: 0.05, x: 0, y: 0.36, z: -0.55 },
      { tipo: "caja", mat: "laton", w: 0.26, h: 0.05, l: 0.07, x: 0, y: 0.19, z: -0.17 },
      { tipo: "cilindro", mat: "maderaOscura", r: 0.024, r2: 0.032, l: 0.24, seg: 8, x: 0, y: 0.05, z: -0.17, rx: 0.18 },
      { tipo: "esfera", mat: "laton", r: 0.045, seg: 8, seg2: 8, x: 0, y: -0.08, z: -0.18 },
    ],
    agarres: { right: [0.04, 0.04, -0.16], left: [-0.04, 0.05, -0.18] },
  },
  hacha: {
    piezas: [
      { tipo: "cilindro", mat: "madera", r: 0.024, r2: 0.036, l: 0.62, seg: 8, x: 0, y: -0.1, z: -0.32, rx: 0.32 },
      { tipo: "esfera", mat: "maderaOscura", r: 0.05, seg: 8, seg2: 8, x: 0, y: -0.4, z: -0.5 },
      { tipo: "caja", mat: "metal", w: 0.34, h: 0.08, l: 0.14, x: 0.03, y: 0.13, z: -0.3, ry: 0.45 },
      { tipo: "esfera", mat: "oscuro", r: 0.075, seg: 10, seg2: 10, escala: [1, 0.8, 1], x: 0.05, y: 0.19, z: -0.3 },
      { tipo: "cono", mat: "acento", r: 0.06, h: 0.2, seg: 4, x: 0.19, y: 0.13, z: -0.2, rz: Math.PI / 4, ry: 0.45 },
    ],
    agarres: { right: [0.03, -0.16, -0.32], left: [-0.08, -0.02, -0.3] },
  },
  daga: {
    piezas: [
      { tipo: "caja", mat: "metal", w: 0.035, h: 0.22, l: 0.44, x: 0, y: 0.28, z: -0.42 },
      { tipo: "cono", mat: "metal", r: 0.024, h: 0.14, seg: 6, x: 0, y: 0.28, z: -0.71, rx: -Math.PI / 2 },
      { tipo: "caja", mat: "acento", w: 0.01, h: 0.2, l: 0.4, x: 0.012, y: 0.28, z: -0.42 },
      { tipo: "caja", mat: "laton", w: 0.17, h: 0.03, l: 0.05, x: 0, y: 0.15, z: -0.14 },
      { tipo: "cilindro", mat: "maderaOscura", r: 0.022, r2: 0.028, l: 0.17, seg: 8, x: 0, y: 0.06, z: -0.14, rx: 0.12 },
      { tipo: "esfera", mat: "laton", r: 0.034, seg: 8, seg2: 8, x: 0, y: -0.03, z: -0.15 },
    ],
    agarres: { right: [0.04, 0.05, -0.13], left: [-0.03, 0.08, -0.15] },
  },
  maza: {
    piezas: [
      { tipo: "cilindro", mat: "madera", r: 0.026, r2: 0.038, l: 0.56, seg: 8, x: 0, y: -0.14, z: -0.34 },
      { tipo: "cilindro", mat: "laton", r: 0.04, l: 0.07, seg: 8, x: 0, y: -0.04, z: -0.26 },
      { tipo: "icosaedro", mat: "oscuro", r: 0.14, detalle: 0, x: 0, y: 0.16, z: -0.24 },
      {
        tipo: "puntas", mat: "acento", r: 0.022, h: 0.09, seg: 6, centro: [0, 0.16, -0.24], lerp: 0.7,
        dirs: [[0, 0.32, -0.24], [0.14, 0.16, -0.24], [-0.14, 0.16, -0.24], [0, 0.16, -0.4], [0.1, 0.28, -0.32], [-0.1, 0.04, -0.32]],
      },
    ],
    agarres: { right: [0.03, -0.12, -0.3], left: [-0.03, -0.1, -0.34] },
  },
  lanza: {
    piezas: [
      { tipo: "cilindro", mat: "madera", r: 0.02, r2: 0.026, l: 1.2, seg: 8, x: 0, y: 0.12, z: -0.5, rx: -Math.PI / 2 },
      { tipo: "cilindro", mat: "oscuro", r: 0.03, r2: 0.026, l: 0.09, seg: 8, x: 0, y: 0.12, z: 0.04 },
      { tipo: "cono", mat: "metal", r: 0.036, h: 0.3, seg: 6, x: 0, y: 0.12, z: -1.06, rx: -Math.PI / 2 },
      { tipo: "cilindro", mat: "acento", r: 0.026, r2: 0.024, l: 0.06, seg: 8, x: 0, y: 0.12, z: -0.6 },
    ],
    agarres: { right: [0.04, 0.06, -0.28], left: [-0.04, 0.03, -0.24] },
  },
  escudo: {
    piezas: [
      // Disco frontal redondo, aro dorado y umbo central. Antes era una
      // semiesfera pequeña que casi no se veía en primera persona.
      { tipo: "cilindro", mat: "cuerpo", r: 0.23, r2: 0.23, l: 0.045, seg: 28, x: 0, y: 0.02, z: -0.36, rx: Math.PI / 2 },
      { tipo: "toro", mat: "laton", r: 0.23, tubo: 0.028, seg: 10, seg2: 28, x: 0, y: 0.02, z: -0.36 },
      { tipo: "toro", mat: "acento", r: 0.145, tubo: 0.012, seg: 8, seg2: 24, x: 0, y: 0.02, z: -0.383 },
      { tipo: "esfera", mat: "laton", r: 0.07, seg: 14, seg2: 10, thetaLen: Math.PI / 2, x: 0, y: 0.02, z: -0.383, rx: -Math.PI / 2 },
      { tipo: "caja", mat: "laton", w: 0.44, h: 0.03, l: 0.025, x: 0, y: 0.02, z: -0.385 },
    ],
    agarres: { right: [0.08, -0.13, -0.2], left: [-0.08, -0.13, -0.2] },
  },
  // ---- Fase 2: cuatro armas nuevas (mismas piezas, otra combinación) ----
  revolver: {
    piezas: [
      { tipo: "caja", mat: "oscuro", w: 0.075, h: 0.1, l: 0.34, x: 0, y: 0.04, z: -0.18 },
      { tipo: "cilindro", mat: "metal", r: 0.03, l: 0.26, seg: 10, x: 0, y: 0.04, z: -0.44, rx: Math.PI / 2 },
      // Tambor de seis recámaras: un cilindro hexagonal corto.
      { tipo: "cilindro", mat: "laton", r: 0.06, r2: 0.06, l: 0.08, seg: 6, x: 0, y: 0.04, z: -0.26, rx: Math.PI / 2 },
      { tipo: "caja", mat: "cuerpo", w: 0.06, h: 0.21, l: 0.08, x: 0, y: -0.1, z: -0.04, rx: -0.3 },
      { tipo: "caja", mat: "acento", w: 0.034, h: 0.008, l: 0.16, x: 0, y: 0.09, z: -0.26 },
      { tipo: "cilindro", mat: "laton", r: 0.012, l: 0.1, seg: 8, x: -0.05, y: 0.1, z: -0.06, rz: Math.PI / 2 },
    ],
    agarres: { right: [0.05, -0.12, -0.02], left: [-0.06, -0.08, -0.12] },
  },
  dmr: {
    piezas: [
      { tipo: "cilindro", mat: "oscuro", r: 0.024, l: 0.62, seg: 10, x: 0, y: 0.03, z: -0.58, rx: Math.PI / 2 },
      { tipo: "caja", mat: "cuerpo", w: 0.065, h: 0.1, l: 0.5, x: 0, y: 0.03, z: -0.2 },
      // Mira telescópica.
      { tipo: "cilindro", mat: "oscuro", r: 0.032, l: 0.28, seg: 12, x: 0, y: 0.14, z: -0.22, rx: Math.PI / 2 },
      { tipo: "cilindro", mat: "acento", r: 0.038, l: 0.02, seg: 12, x: 0, y: 0.14, z: -0.06, rx: Math.PI / 2 },
      { tipo: "cilindro", mat: "acento", r: 0.038, l: 0.02, seg: 12, x: 0, y: 0.14, z: -0.36, rx: Math.PI / 2 },
      { tipo: "caja", mat: "oscuro", w: 0.045, h: 0.2, l: 0.09, x: 0, y: -0.13, z: -0.12, rx: 0.3 },
      { tipo: "caja", mat: "maderaOscura", w: 0.055, h: 0.09, l: 0.18, x: 0, y: 0.03, z: 0.2 },
      { tipo: "caja", mat: "acento", w: 0.03, h: 0.02, l: 0.3, x: 0, y: 0.09, z: -0.36 },
    ],
    agarres: { right: [0.06, -0.06, 0.04], left: [-0.06, -0.05, 0.05] },
  },
  martillo: {
    piezas: [
      { tipo: "cilindro", mat: "madera", r: 0.025, r2: 0.04, l: 0.72, seg: 8, x: 0, y: -0.16, z: -0.36 },
      { tipo: "cilindro", mat: "laton", r: 0.045, l: 0.08, seg: 8, x: 0, y: -0.04, z: -0.28 },
      { tipo: "caja", mat: "oscuro", w: 0.3, h: 0.16, l: 0.18, x: 0, y: 0.18, z: -0.24 },
      { tipo: "caja", mat: "metal", w: 0.34, h: 0.06, l: 0.12, x: 0, y: 0.27, z: -0.24 },
      { tipo: "caja", mat: "acento", w: 0.34, h: 0.04, l: 0.06, x: 0, y: 0.12, z: -0.24 },
    ],
    agarres: { right: [0.03, -0.12, -0.3], left: [-0.03, -0.1, -0.34] },
  },
  ballesta: {
    piezas: [
      { tipo: "caja", mat: "maderaOscura", w: 0.07, h: 0.09, l: 0.62, x: 0, y: 0.02, z: -0.28 },
      { tipo: "arco", mat: "madera", R: 0.36, y0: -0.02, h1: 0.44, h2: -0.1, depth: 0.03, x: 0, y: 0.02, z: -0.5, rx: Math.PI / 2 },
      { tipo: "cilindro", mat: "cuerda", r: 0.003, l: 0.78, seg: 4, x: 0, y: 0.02, z: -0.28, rx: Math.PI / 2 },
      { tipo: "cilindro", mat: "metal", r: 0.008, l: 0.5, seg: 6, x: 0, y: 0.03, z: -0.5, rx: Math.PI / 2 },
      { tipo: "cono", mat: "metal", r: 0.014, h: 0.07, seg: 6, x: 0, y: 0.03, z: -0.8, rx: -Math.PI / 2 },
      { tipo: "caja", mat: "acento", w: 0.075, h: 0.03, l: 0.12, x: 0, y: 0.08, z: -0.16 },
      { tipo: "caja", mat: "oscuro", w: 0.06, h: 0.14, l: 0.07, x: 0, y: -0.09, z: -0.02, rx: 0.25 },
    ],
    agarres: { right: [0.04, -0.06, -0.22], left: [-0.07, -0.04, -0.22] },
  },
};

// Colores de los materiales que no vienen del arma.
const PART_MATERIALS = {
  metal: { color: 0xb8c0cc, roughness: 0.45, metalness: 0.6 },
  oscuro: { color: 0x6b727e, roughness: 0.55, metalness: 0.4 },
  madera: { color: 0x7a5230, roughness: 0.9 },
  maderaOscura: { color: 0x4e3320, roughness: 0.9 },
  laton: { color: 0xc9a227, roughness: 0.35, metalness: 0.7 },
  cuero: { color: 0xd8562e },
  cuerda: { color: 0x8b909b },
};

export function getWeaponParts(id) {
  return WEAPON_PARTS[id] || null;
}

function partMaterials(weapon, parts) {
  const cfg = weapon.model;
  const over = parts.colores || {};
  const out = {};
  // El tuner guarda cuerpo/acento en def.colores; antes se ignoraban y el
  // selector de color no tenía efecto sobre la malla.
  const cuerpo = over.cuerpo ?? cfg.color;
  const acento = over.acento ?? cfg.accent;
  out.cuerpo = mat(cuerpo);
  out.acento = mat(acento, { emissive: acento });
  out.cuerda = new THREE.MeshBasicMaterial({ color: over.cuerda ?? PART_MATERIALS.cuerda.color });
  for (const [k, def] of Object.entries(PART_MATERIALS)) {
    if (k === "cuerda") continue;
    out[k] = mat(over[k] ?? def.color, { roughness: def.roughness, metalness: def.metalness });
  }
  return out;
}

function placePart(mesh, part, group) {
  if (part.escala) mesh.scale.set(part.escala[0], part.escala[1], part.escala[2]);
  if (part.rx || part.ry || part.rz) mesh.rotation.set(part.rx || 0, part.ry || 0, part.rz || 0);
  // Basta con que exista UNA coordenada: las definiciones antiguas omiten las
  // que valen 0 (p. ej. el rotor solo traía z).
  if (part.x !== undefined || part.y !== undefined || part.z !== undefined) {
    mesh.position.set(part.x || 0, part.y || 0, part.z || 0);
  }
  group.add(mesh);
  return mesh;
}

// Convierte una descripción de pieza en malla y la cuelga del grupo.
function buildPart(part, group, mats) {
  if (part.visible === false) return null;
  let m = mats[part.mat] || mats.cuerpo;
  if (part.side) {
    m = m.clone();
    m.side = part.side === "double" ? THREE.DoubleSide : THREE.FrontSide;
  }
  let mesh;
  switch (part.tipo) {
    case "caja":
      mesh = new THREE.Mesh(new THREE.BoxGeometry(part.w, part.h, part.l), m);
      break;
    case "cilindro":
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(part.r, part.r2 ?? part.r, part.l, part.seg ?? 10),
        m
      );
      break;
    case "esfera":
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(
          part.r, part.seg ?? 10, part.seg2 ?? 8,
          part.phi ?? 0, part.phiLen ?? Math.PI * 2,
          part.theta ?? 0, part.thetaLen ?? Math.PI
        ),
        m
      );
      break;
    case "cono":
      mesh = new THREE.Mesh(new THREE.ConeGeometry(part.r, part.h, part.seg ?? 6), m);
      break;
    case "toro":
      mesh = new THREE.Mesh(
        new THREE.TorusGeometry(part.r, part.tubo, part.seg ?? 6, part.seg2 ?? 14, part.arc ?? Math.PI * 2),
        m
      );
      break;
    case "icosaedro":
      mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(part.r, part.detalle ?? 0), m);
      break;
    case "rotor": {
      // El grupo exterior recibe posición/rotación/escala; el interior es el
      // que gira (userData.spinGroup), para que rx/ry/rz no se pierdan con la
      // animación. eje/eje2 desplazan los caños dentro del rotor.
      const holder = new THREE.Group();
      const spin = new THREE.Group();
      const eje = part.eje ?? 0;
      const eje2 = part.eje2 ?? (part.z2 !== undefined ? part.z2 - (part.z ?? 0) : -0.02);
      addBarrel(spin, part.r, part.l, [0, 0, eje], mats[part.mat] || mats.oscuro);
      for (let i = 0; i < (part.n ?? 5); i++) {
        const a = (i / (part.n ?? 5)) * Math.PI * 2;
        addBarrel(
          spin, part.r2, part.l2,
          [Math.cos(a) * part.radio, Math.sin(a) * part.radio, eje2],
          mats[part.mat2] || mats.metal
        );
      }
      holder.add(spin);
      holder.userData.spinGroup = spin;
      return placePart(holder, part, group);
    }
    case "puntas": {
      // Las puntas también se agrupan para que x,y,z,rx,ry,rz,escala y visible
      // se comporten igual que en el resto de piezas.
      const holder = new THREE.Group();
      const centro = Array.isArray(part.centro) ? part.centro : [0, 0, 0];
      const dirs = Array.isArray(part.dirs) ? part.dirs : [];
      const c = new THREE.Vector3(centro[0] || 0, centro[1] || 0, centro[2] || 0);
      for (const d of dirs) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(part.r ?? 0.02, part.h ?? 0.09, part.seg ?? 6), m);
        const dir = new THREE.Vector3(d[0] || 0, d[1] || 0, d[2] || 0).sub(c);
        if (dir.lengthSq() < 1e-12) continue;
        dir.normalize();
        spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const pos = new THREE.Vector3(d[0] || 0, d[1] || 0, d[2] || 0).lerp(c, part.lerp ?? 0.7);
        spike.position.copy(pos);
        holder.add(spike);
      }
      return placePart(holder, part, group);
    }
    case "arco": {
      const shape = new THREE.Shape();
      const R = part.R;
      const k = part.k ?? 0.9;
      shape.moveTo(-R, part.y0);
      shape.quadraticCurveTo(-R * k, part.h1, 0, part.h1);
      shape.quadraticCurveTo(R * k, part.h1, R, part.y0);
      shape.quadraticCurveTo(R * k, part.h2, 0, part.h2);
      shape.quadraticCurveTo(-R * k, part.h2, -R, part.y0);
      mesh = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, { depth: part.depth, bevelEnabled: false }),
        m
      );
      break;
    }
    default:
      return null;
  }
  return placePart(mesh, part, group);
}

// Construye el arma completa a partir de su lista de piezas.
// `def` permite pasar una definición propia (la usa public/debug/weapontune.html
// para previsualizar cambios sin tocar la tabla del juego).
function buildFromParts(weapon, vm, def = WEAPON_PARTS[weapon.id]) {
  if (!def) return false;
  const group = vm.group;
  const mats = partMaterials(weapon, def);
  if (weapon.kind !== "melee") {
    // Fogonazo: esfera oculta que el combate enciende al disparar. Va primero
    // para conservar el orden de mallas del modelo original.
    const cfg = weapon.model;
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    );
    flash.visible = false;
    flash.position.set(0, 0, -(cfg.barrel || 0.55) - 0.2);
    if (def.morro) flash.position.set(def.morro[0], def.morro[1], def.morro[2]);
    group.add(flash);
    vm.muzzle = flash;
  }
  for (const part of def.piezas) {
    const built = buildPart(part, group, mats);
    if (part.tipo === "rotor" && built) vm.spin = built.userData.spinGroup || built;
  }
  if (def.agarres) vm.grips = { right: def.agarres.right.slice(), left: def.agarres.left.slice() };
  return true;
}

// ------------------------------------------------ MELEE ------------------------------------------------

function buildMelee(weapon, vm) {
  if (buildFromParts(weapon, vm)) return;
}

// ------------------------------------------------ ARMAS DE FUEGO ------------------------------------------------

function addBarrel(group, r, len, pos, m) {
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), m);
  barrel.rotation.x = Math.PI / 2;
  add(group, barrel, pos[0], pos[1], pos[2]);
}

function buildGun(weapon, vm) {
  if (buildFromParts(weapon, vm)) return;
}

// ------------------------------------------------ API ------------------------------------------------

const FIRE_MS = {
  recoil: 170,
  slash: 340,
  chop: 360,
  stab: 240,
  thrust: 280,
  bash: 300,
};

// Estilo de recarga por arma (Fase 5). Se anima de forma procedural en update():
//   mag   → el arma baja y la aleta izquierda va al cargador (pistolas, fusiles…)
//   shell → escopeta: 3 pulsos de bombeo
//   bolt  → cerrojo: la mano tira atrás y vuelve (francotirador, arco, ballesta)
//   spin  → minigun: el rotor gira a toda velocidad
//   none  → melee y láser (sin recarga visible)
const RELOAD_STYLE = {
  pistola: "mag",
  revolver: "mag",
  smg: "mag",
  assault: "mag",
  dmr: "mag",
  granade: "mag",
  plasma: "mag",
  llama: "mag",
  shotgun: "shell",
  sniper: "bolt",
  arco: "bolt",
  ballesta: "bolt",
  minigun: "spin",
  laser: "none",
};

export function reloadStyleFor(weaponOrId) {
  const weapon = typeof weaponOrId === "string" ? getWeapon(weaponOrId) : weaponOrId;
  if (!weapon) return "none";
  if (weapon.kind === "melee") return "none";
  return RELOAD_STYLE[weapon.id] || "mag";
}

// Progreso 0→1 de la recarga. Función pura (testeable): sin duración válida o
// antes del inicio devuelve 0; al superar el final, 1.
export function reloadProgress(now, start, dur) {
  if (!Number.isFinite(now) || !Number.isFinite(start) || !Number.isFinite(dur) || dur <= 0) {
    return 0;
  }
  return clamp01((now - start) / dur);
}

// Postura de REPARTO (sin arma): las dos aletas cuelgan una a cada lado de la
// cámara, bajas y abiertas, como las manos de un jugador en vista normal. Se
// definen en coordenadas GLOBALES respecto a la cámara (no en el espacio local
// del grupo del arma, que ya viene desplazado por BASE y escalado por
// VM_SCALE) y luego se convierten a local para que las aletas caigan realmente
// en ±REST_X y no se sigan pegando al lado del arma.
const REST_X = 0.46;
const REST_Y = -0.3;
const REST_Z = -0.46;
const ARM_MS = 240;

function swingValue(p) {
  if (p < 0.25) return 0.95 * easeOutCubic(p / 0.25);
  if (p < 0.7) {
    const u = (p - 0.25) / 0.45;
    return 0.95 - 1.9 * u * u;
  }
  const u = (p - 0.7) / 0.3;
  return -0.95 + 0.95 * (0.5 - 0.5 * Math.cos(Math.PI * u));
}

// Construye SOLO el arma (sin manos ni transformación de primera persona),
// lista para colgarse en 3ª persona o reutilizarse. Expone userData.muzzle
// (fogonazo), userData.spin (rotor) y userData.grips (posiciones de agarre).
export function buildWeaponGroup(weaponOrId) {
  const weapon = typeof weaponOrId === "string" ? (weaponOrId ? getWeapon(weaponOrId) : null) : weaponOrId;
  const group = new THREE.Group();
  const vm = {
    group,
    weapon,
    muzzle: null,
    spin: null,
    grips: { right: [0.05, -0.08, 0], left: [-0.05, -0.05, 0] },
  };

  if (weapon) {
    if (weapon.kind === "melee") buildMelee(weapon, vm);
    else buildGun(weapon, vm);
  }

  group.userData.muzzle = vm.muzzle;
  group.userData.spin = vm.spin || null;
  group.userData.grips = vm.grips;
  group.userData.weaponId = weapon ? weapon.id : null;
  return group;
}

// Igual que buildWeaponGroup pero usando una definición de piezas externa en
// lugar de la tabla del juego. Lo usa public/debug/weapontune.html para ver los
// cambios del tuner en 3D sin escribir en WEAPON_PARTS.
export function buildWeaponFromParts(weaponId, def) {
  const weapon = getWeapon(weaponId);
  const group = new THREE.Group();
  const vm = {
    group,
    weapon,
    muzzle: null,
    spin: null,
    grips: { right: [0.05, -0.08, 0], left: [-0.05, -0.05, 0] },
  };
  if (weapon) buildFromParts(weapon, vm, def);
  group.userData.muzzle = vm.muzzle;
  group.userData.spin = vm.spin || null;
  group.userData.grips = vm.grips;
  group.userData.weaponId = weaponId;
  return group;
}

// Exportado para el tuner de poses (public/debug/flippertune.html): devuelve la
// MISMA postura de agarre que usa buildViewmodel, con todos los valores ya
// resueltos (incluidos los que salen por defecto), para poder ajustarla con
// sliders y poder copiarla de vuelta a HAND_TUNING.
export function getGripPose(weaponId) {
  const weapon = weaponId ? getWeapon(weaponId) : null;
  const group = buildWeaponGroup(weapon);
  const grips = group.userData.grips;
  const t = weapon ? HAND_TUNING[weapon.id] || HAND_TUNING.default : null;
  return {
    rightPos: ((t && t.rightPos) || defaultHandPos(1, grips)).slice(),
    rightRot: (t ? t.rightRot : [1.32, -0.22, 0.34]).slice(),
    leftPos: ((t && t.leftPos) || defaultHandPos(-1, grips)).slice(),
    leftRot: (t ? t.leftRot : [1.32, 0.22, -0.34]).slice(),
  };
}

export function buildViewmodel(weaponId, appearance) {
  const weapon = weaponId ? getWeapon(weaponId) : null;
  const handColor = resolveHandColor(appearance);

  const group = buildWeaponGroup(weapon);
  group.scale.setScalar(VM_SCALE);
  const vm = {
    group,
    weapon,
    muzzle: group.userData.muzzle,
    spin: group.userData.spin,
    grips: group.userData.grips,
    fireStart: -Infinity,
    fireStyle: weapon && weapon.kind === "melee"
      ? weapon.id === "daga" ? "stab"
        : weapon.id === "lanza" ? "thrust"
          : weapon.id === "escudo" ? "bash"
            : (weapon.id === "hacha" || weapon.id === "maza" || weapon.id === "martillo") ? "chop"
              : "slash"
      : "recoil",
    hands: [],
    armStart: performance.now(),
    blockK: 0,
    reloadStart: -Infinity,
    reloadDur: 0,
    reloadStyle: reloadStyleFor(weapon),
  };

  // Dos aletas (como las alas del pingüino), una a cada lado de la cámara.
  //  · Sin arma: quedan en REPARTO, colgadas y separadas (vista normal).
  //  · Con arma: arrancan en reposo y se animan hasta AGARRAR el arma con las
  //    dos manos (postura afinada por arma vía HAND_TUNING).
  const tuning = weapon ? HAND_TUNING[weapon.id] || HAND_TUNING.default : null;
  const restPos = [globalToLocal(REST_X, REST_Y, REST_Z), globalToLocal(-REST_X, REST_Y, REST_Z)];
  const restRot = [
    [1.32, -0.22, 0.34],
    [1.32, 0.22, -0.34],
  ];
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const hand = makeFlipper(side, handColor);
    const gripPos = tuning
      ? (side > 0 ? tuning.rightPos : tuning.leftPos) || defaultHandPos(side, vm.grips)
      : restPos[i];
    const gripRot = tuning ? (side > 0 ? tuning.rightRot : tuning.leftRot) : restRot[i];
    hand.userData.restPos = restPos[i];
    hand.userData.restRot = restRot[i];
    hand.userData.gripPos = gripPos;
    hand.userData.gripRot = gripRot;
    hand.position.set(...(weapon ? restPos[i] : gripPos));
    hand.rotation.set(...(weapon ? restRot[i] : gripRot));
    group.add(hand);
    vm.hands.push(hand);
    group.userData[side > 0 ? "rightHand" : "leftHand"] = hand;
  }

  return finishViewmodel(weaponId, vm);
}

function finishViewmodel(weaponId, vm) {
  const group = vm.group;
  const base = BASE.clone();
  group.position.copy(base);

  let currentSwayX = 0;
  let currentSwayY = 0;
  let targetSwayX = 0;
  let targetSwayY = 0;

  function setSway(dx, dy) {
    targetSwayX = Math.max(-0.06, Math.min(0.06, dx * -0.0012));
    targetSwayY = Math.max(-0.05, Math.min(0.05, dy * 0.0012));
  }

  function playFire() {
    vm.fireStart = performance.now();
    if (vm.muzzle) vm.muzzle.visible = true;
  }

  function startReload(ms) {
    const dur = Number(ms);
    if (!Number.isFinite(dur) || dur <= 0) {
      endReload();
      return;
    }
    vm.reloadStart = performance.now();
    vm.reloadDur = dur;
  }

  function endReload() {
    vm.reloadStart = -Infinity;
    vm.reloadDur = 0;
  }

  function update(now, dt, moving, blocking) {
    group.position.copy(base);
    group.rotation.set(0, 0, 0);

    // Pose de guardia del escudo: se sube al centro de la vista. Se interpola
    // para que levantar/bajar el escudo no sea un salto.
    const wantBlock = blocking && vm.weapon && vm.weapon.id === "escudo" ? 1 : 0;
    vm.blockK += (wantBlock - vm.blockK) * Math.min(1, dt * 12);

    // Agarre con las dos manos: solo cuando hay arma. Las aletas van de la
    // postura de reposo (una a cada lado) a la de agarre sobre el arma.
    if (vm.weapon) {
      const arm = easeOutCubic(clamp01((now - vm.armStart) / ARM_MS));
      for (const hand of vm.hands) {
        const d = hand.userData;
        hand.position.set(
          d.restPos[0] + (d.gripPos[0] - d.restPos[0]) * arm,
          d.restPos[1] + (d.gripPos[1] - d.restPos[1]) * arm,
          d.restPos[2] + (d.gripPos[2] - d.restPos[2]) * arm
        );
        hand.rotation.set(
          d.restRot[0] + (d.gripRot[0] - d.restRot[0]) * arm,
          d.restRot[1] + (d.gripRot[1] - d.restRot[1]) * arm,
          d.restRot[2] + (d.gripRot[2] - d.restRot[2]) * arm
        );
      }
      // Raise corto sincronizado: el arma entra un poco más baja y sube al
      // terminar el agarre (efecto de "coger el arma").
      const raise = 1 - arm;
      group.position.y -= raise * 0.05;
      group.rotation.x += raise * 0.13;
    }

    // Decaimiento e interpolación de sway al mover ratón
    targetSwayX *= 0.88;
    targetSwayY *= 0.88;
    const lerpFactor = Math.min(1, dt * 18);
    currentSwayX += (targetSwayX - currentSwayX) * lerpFactor;
    currentSwayY += (targetSwayY - currentSwayY) * lerpFactor;

    group.position.x += currentSwayX;
    group.position.y += currentSwayY;
    group.rotation.z += currentSwayX * 0.45;
    group.rotation.y += currentSwayX * 0.25;
    group.rotation.x -= currentSwayY * 0.35;

    const t = now * 0.001;
    group.rotation.z += Math.sin(t * 0.9) * 0.012;
    group.rotation.y += Math.sin(t * 1.15) * 0.01;
    group.position.y += Math.sin(t * 1.3) * 0.004;

    if (moving) {
      const b = Math.sin(now * 0.012);
      group.position.y += b * 0.018;
      group.rotation.x += Math.abs(b) * 0.03;
      group.rotation.z += b * 0.012;
    }

    if (vm.blockK > 0.001) {
      const k = vm.blockK;
      group.position.x += (0.02 - base.x) * 0.7 * k;
      group.position.y += 0.08 * k;
      group.position.z += 0.03 * k;
      group.rotation.x += 0.12 * k;
      group.rotation.y -= 0.12 * k;
    }

    // Recarga procedural (Fase 5): el arma se inclina y la aleta izquierda hace
    // el gesto del estilo (cargador, bombeo, cerrojo…). No se animan piezas
    // sueltas: todo son offsets sobre la pose ya calculada.
    const reloading =
      vm.reloadDur > 0 && now >= vm.reloadStart && now < vm.reloadStart + vm.reloadDur;
    if (reloading) {
      const rp = reloadProgress(now, vm.reloadStart, vm.reloadDur);
      const k = Math.sin(rp * Math.PI);
      const left = vm.hands[1] || null;

      if (vm.reloadStyle === "mag") {
        group.position.y -= 0.09 * k;
        group.rotation.x += 0.5 * k;
        group.rotation.z += 0.35 * k;
        if (left) {
          const reach = Math.sin(clamp01(rp * 1.25) * Math.PI);
          left.position.x -= 0.06 * reach;
          left.position.y -= 0.16 * reach;
          left.position.z += 0.1 * reach;
          left.rotation.x += 0.9 * reach;
        }
      } else if (vm.reloadStyle === "shell") {
        const pulse = Math.abs(Math.sin(rp * Math.PI * 3));
        group.position.y -= 0.05 * k;
        group.rotation.x += 0.22 * k;
        group.rotation.z += 0.15 * k;
        if (left) {
          left.position.y -= 0.1 * pulse;
          left.position.z += 0.12 * pulse;
          left.rotation.x += 1.1 * pulse;
        }
      } else if (vm.reloadStyle === "bolt") {
        const pull = Math.sin(clamp01(rp / 0.7) * Math.PI);
        group.position.y -= 0.05 * k;
        group.rotation.x += 0.28 * k;
        group.rotation.z += 0.2 * k;
        if (left) {
          left.position.y -= 0.06 * pull;
          left.position.z += 0.14 * pull;
          left.rotation.x += 1.2 * pull;
        }
      } else if (vm.reloadStyle === "spin") {
        group.position.y -= 0.06 * k;
        group.rotation.x += 0.3 * k;
        group.rotation.z += 0.2 * k;
        if (left) {
          left.position.y -= 0.08 * k;
          left.position.z += 0.1 * k;
        }
        if (vm.spin) vm.spin.rotation.z += dt * 26;
      }
    }

    const age = now - vm.fireStart;
    const dur = FIRE_MS[vm.fireStyle] || 170;

    if (vm.fireStyle === "recoil" && age < dur) {
      const k = 1 - age / dur;
      group.position.z += Math.pow(k, 2) * 0.14;
      group.rotation.x -= Math.pow(k, 2) * 0.05;
      if (vm.muzzle) {
        vm.muzzle.visible = age < 85;
        if (vm.muzzle.userData.sparkle) vm.muzzle.userData.sparkle.visible = age < 70;
      }
    } else {
      if (vm.muzzle) vm.muzzle.visible = false;
    }

    if (vm.fireStyle === "slash" && age < dur) {
      group.rotation.y += swingValue(clamp01(age / dur)) * 1.1;
      group.rotation.x -= Math.abs(swingValue(clamp01(age / dur))) * 0.18;
    } else if (vm.fireStyle === "chop" && age < dur) {
      const p = clamp01(age / dur);
      group.rotation.x += swingValue(p) * -1.15;
      group.rotation.y += Math.abs(swingValue(p)) * 0.25;
    } else if (vm.fireStyle === "stab" && age < dur) {
      const p = clamp01(age / dur);
      group.position.z -= 0.32 * Math.sin(p * Math.PI);
      group.rotation.x += 0.08 * Math.sin(p * Math.PI);
    } else if (vm.fireStyle === "thrust" && age < dur) {
      const p = clamp01(age / dur);
      group.position.z -= 0.38 * Math.sin(p * Math.PI);
      group.rotation.x += 0.06 * Math.sin(p * Math.PI);
    } else if (vm.fireStyle === "bash" && age < dur) {
      const p = clamp01(age / dur);
      group.position.z -= 0.34 * Math.sin(p * Math.PI);
      group.rotation.z -= 0.22 * Math.sin(p * Math.PI);
    }

    if (vm.spin) {
      const firing = age >= 0 && age < 200;
      vm.spin.rotation.z += dt * (firing ? 38 : 3.5);
    }
  }

  return { group, playFire, update, setSway, startReload, endReload, weaponId };
}