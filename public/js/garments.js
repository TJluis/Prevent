// Prendas conformes a la forma procesal del pingüino (FV2.2).
// La ropa se genera muestreando la MISMA silueta del cuerpo (cápsula + panza)
// en cada altura/ángulo, de modo que abraza el cuerpo exactamente (incluida
// la panza sobresaliente) y se re-acomoda sola si cambian las proporciones.
// Los valores de este módulo DEBEN coincidir con los usados en createAvatar.

import * as THREE from "/vendor/three/three.module.js";

// --- Silueta del torso: cápsula principal + panza ---
// Cuerpo: CapsuleGeometry(0.42, 0.3) centrado en (0, 0.62, 0).
// Zona recta: y en [0.47, 0.77]; casquetes esféricos arriba (ctro y=0.77)
// y abajo (ctro y=0.47).
const BODY_R = 0.42;
const BODY_CY = 0.62;
const BODY_HALF = 0.15;
const BODY_TOP = 0.77; // 0.62 + 0.15
const BODY_BOT = 0.47; // 0.62 - 0.15

// Panza: Sphere(0.36) escalada (1, 1.15, 0.5) centrada en (0, 0.58, 0.3).
// => semiejes rx=0.36, ry=0.414, rz=0.18.
const BELLY_CX = 0;
const BELLY_CY = 0.58;
const BELLY_CZ = 0.3;
const BELLY_RX = 0.36;
const BELLY_RY = 0.36 * 1.15;
const BELLY_RZ = 0.36 * 0.5;

// --- Cabeza (para casco/capucha) ---
const HEAD_R = 0.34;
const HEAD_CX = 0;
const HEAD_CY = 1.32;
const HEAD_CZ = 0;

// Grosor de tela para las prendas.
export const GARMENT_OFF = 0.045; // pared exterior (visible: ropa "encima")
const GARMENT_IN = GARMENT_OFF * 0.5; // pared interior (aún fuera de la piel)

// Relieves de las prendas (dobladillos, vueltas, costuras): banda cerrada cuyo
// radio nace apenas hundido en la tela (base) y sobresale un poco (off), para
// que el relieve se "cosa" sin z-fighting con la prenda base.
export const BAND_BASE = GARMENT_OFF * 0.94; // se hunde 0.003 en la tela base
export const BAND_OFF = 0.014; // alivio del relieve sobre la superficie

// Radio horizontal de la cápsula del cuerpo en la altura absoluta y.
export function bodyRadiusAt(y) {
  if (y >= BODY_BOT && y <= BODY_TOP) return BODY_R;
  const c = y < BODY_BOT ? BODY_BOT : BODY_TOP;
  const d = y - c;
  const r = BODY_R * BODY_R - d * d;
  return r > 0 ? Math.sqrt(r) : 0;
}

// Radio del borde de la panza (elipse) en la altura y y ángulo t. t=0 es la
// parte frontal (+Z), t=PI la espalda. Devuelve distancia desde el eje del
// cuerpo al borde; 0 si la panza no penetra en esa dirección.
export function bellyBoundaryAt(y, t) {
  const dy = (y - BELLY_CY) / BELLY_RY;
  if (Math.abs(dy) >= 1) return 0;
  const k = Math.sqrt(Math.max(0, 1 - dy * dy));
  const ex = BELLY_RX * k;
  const ez = BELLY_RZ * k;
  if (ex <= 0 || ez <= 0) return 0;
  const sinT = Math.sin(t);
  const cosT = Math.cos(t);
  const A = (sinT * sinT) / (ex * ex) + (cosT * cosT) / (ez * ez);
  const B = (-2 * BELLY_CZ * cosT) / (ez * ez);
  const C = (BELLY_CZ * BELLY_CZ) / (ez * ez) - 1;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return 0;
  const root = (-B - Math.sqrt(disc)) / (2 * A);
  return root > 0 ? root : 0;
}

// Radio de la silueta completa (cuerpo ∪ panza) en altura y y ángulo t.
export function silhouetteRadiusAt(y, t) {
  return Math.max(bodyRadiusAt(y), bellyBoundaryAt(y, t));
}

// Distancia al frente de la silueta (+Z) en la altura y (para anclar
// accesorios a la superficie sin offsets mágicos).
export function surfaceFrontZAt(y) {
  return silhouetteRadiusAt(y, 0);
}

// --- Constructores de mallas conformes de VOLUMEN (doble pared + cintas) ---
// La prenda es un tubo cerrado con: pared exterior (silueta+off), pared
// interior (silueta+inner), cintas superior e inferior (dobladillos) y cierres
// verticales en los cortes del arco. Así se ve como ropa maciza puesta encima
// del cuerpo y nunca se "ve por dentro".

function wallPositions(radiusAt, yMin, yMax, segH, segV, arcStart, arcEnd) {
  const positions = [];
  for (let i = 0; i <= segH; i++) {
    const u = segH === 0 ? 0 : i / segH;
    const y = yMin + (yMax - yMin) * u;
    for (let j = 0; j <= segV; j++) {
      const a = arcStart + ((arcEnd - arcStart) * j) / segV;
      const r = radiusAt(y, a);
      positions.push(r * Math.sin(a), y, r * Math.cos(a));
    }
  }
  return positions;
}

function wallQuads(segH, segV, base, inverse) {
  const idx = [];
  const stride = segV + 1;
  for (let i = 0; i < segH; i++) {
    for (let j = 0; j < segV; j++) {
      const a = base + i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      if (inverse) idx.push(a, b, c, b, d, c);
      else idx.push(a, c, b, b, c, d);
    }
  }
  return idx;
}

function buildDoubleWall({ yMin, yMax, off, inner, arcStart, arcEnd, segH, segV, radiusAt }) {
  const out = wallPositions((y, a) => radiusAt(y, a) + off, yMin, yMax, segH, segV, arcStart, arcEnd);
  const inn = wallPositions((y, a) => radiusAt(y, a) + inner, yMin, yMax, segH, segV, arcStart, arcEnd);
  const positions = out.concat(inn);
  const nRing = segV + 1;
  const nWall = (segH + 1) * nRing;
  const indices = wallQuads(segH, segV, 0, false).concat(wallQuads(segH, segV, nWall, true));

  const addRim = (i) => {
    const ob = i * nRing;
    const ib = nWall + i * nRing;
    for (let j = 0; j < segV; j++) {
      const oa = ob + j;
      const oc = oa + 1;
      const ia = ib + j;
      const ic = ia + 1;
      indices.push(oa, ia, oc, oc, ia, ic);
    }
  };
  addRim(segH); // dobladillo superior
  addRim(0);    // dobladillo inferior

  if (Math.abs(arcEnd - arcStart - Math.PI * 2) > 1e-3) {
    const addSeam = (j) => {
      for (let i = 0; i < segH; i++) {
        const oa = i * nRing + j;
        const oc = (i + 1) * nRing + j;
        const ia = nWall + i * nRing + j;
        const ic = nWall + (i + 1) * nRing + j;
        indices.push(oa, ia, oc, oc, ia, ic);
      }
    };
    addSeam(0);
    addSeam(segV);
  }

  const g = new THREE.BufferGeometry();
  g.setIndex(indices);
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

// Prenda que envuelve el torso: volumen conforme a la silueta (cápsula ∪ panza)
// entre yMin e yMax absolutos. Opcionalmente deja un hueco frontal (arcStart/
// arcEnd) para chaquetas con abertura; los bordes del corte se cierran.
export function buildConformingShell({
  yMin,
  yMax,
  off = GARMENT_OFF,
  arcStart = 0,
  arcEnd = Math.PI * 2,
  segH = 20,
  segV = 40,
}) {
  return buildDoubleWall({
    yMin,
    yMax,
    off,
    inner: off * 0.5,
    arcStart,
    arcEnd,
    segH,
    segV,
    radiusAt: (y, a) => silhouetteRadiusAt(y, a),
  });
}

// Casco/capucha que calza sobre la cabeza (esfera). yMin es la altura del
// borde; desde ahí hasta la coronilla se cubre la esfera con volumen.
export function buildCapShell({
  yMin,
  off = GARMENT_OFF,
  arcStart = 0,
  arcEnd = Math.PI * 2,
  segH = 14,
  segV = 24,
}) {
  const yTop = HEAD_CY + HEAD_R;
  return buildDoubleWall({
    yMin,
    yMax: yTop,
    off,
    inner: off * 0.5,
    arcStart,
    arcEnd,
    segH,
    segV,
    radiusAt: (y) => {
      const dy = y - HEAD_CY;
      return Math.sqrt(Math.max(0, HEAD_R * HEAD_R - dy * dy));
    },
  });
}

// Relieve conforme: banda cerrada (dobladillo, vuelta, cinturilla o costura) que
// nace "cosida" a la tela (interior en silhouette+base) y sobresale off por
// fuera. Con arcStart/arcEnd muestra un relieve solo en un tramo (ej. costura
// frontal) o con el arco completo rodea la prenda.
export function buildBand({
  yMin,
  yMax,
  base = BAND_BASE,
  off = BAND_OFF,
  arcStart = 0,
  arcEnd = Math.PI * 2,
  segH = 3,
  segV = 40,
}) {
  return buildDoubleWall({
    yMin,
    yMax,
    off,
    inner: off * 0.5,
    arcStart,
    arcEnd,
    segH,
    segV,
    radiusAt: (y, a) => silhouetteRadiusAt(y, a) + base,
  });
}