import * as THREE from "/vendor/three/three.module.js";
import { MAPS, getMap, getRoomMaps, getMapBoundary } from "./mapDefs.js";
import { MAP_OBSTACLES } from "./mapObstacles.js";
import { HUB_PORTALS, LOBBY_PORTAL } from "./hubDefs.js";
import { getMode } from "./modeDefs.js";
import {
  COLISEO_ARENA_RADIUS,
  COLISEO_MAP_ID,
  COLISEO_PLAY_RADIUS,
  getColiseoRadii,
  resolveColiseoVariant,
  setActiveColiseoVariant,
} from "./coliseoDefs.js";
import {
  HIDE_CAGE_RADIUS,
  HIDE_MAP_ID,
  HIDE_SPOTS,
} from "./hideDefs.js";
import {
  TNT_BLOCK_SIZE,
  TNT_GRID,
  TNT_LAYERS,
  TNT_MAP_ID,
  tntCellCenter,
  tntGlobalIndex,
  tntLayerHeight,
  tntPartsOf,
} from "./tntDefs.js";
import {
  KARTS_MAP_ID,
  KARTS_PADDOCK_CENTER,
  KARTS_PORTALS,
  KARTS_TRACKS,
  KART_CATALOG,
  KART_PEDESTALS,
  kartsPointAt,
} from "./kartsDefs.js";
import { createKartPedestal } from "./kartModels.js";

export { MAPS, getMap, getRoomMaps, getMapBoundary };
export { makeCordilleraScenery, makeTerrain };

export const BOUNDARY = 40;

// Mapas con terreno con relieve. Todo lo que en este archivo preguntaba
// "¿es cordillera?" en realidad pregunta "¿este mapa tiene relieve?", así que el
// tuner de mapas (public/debug/mapatune.html) puede registrar ids propios aquí
// mientras previsualiza.
const TERRAIN_IDS = new Set(["cordillera"]);

export function isTerrainMap(id) {
  return TERRAIN_IDS.has(id);
}

// ---------------------------------------------------------------- terreno procedural (cordillera)

const TERRAIN_SEED = 20260905;
const TERRAIN_LATTICE = 128;
let terrainTable = null;

function hash2int(x, z) {
  let h = (x | 0) ^ (TERRAIN_SEED | 0) * 2654435761;
  h = Math.imul(h ^ (z | 0), 374761393);
  h = Math.imul(h ^ (h >>> 13), 668265263);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function ensureTerrainTable() {
  if (terrainTable) return;
  terrainTable = new Float32Array(TERRAIN_LATTICE * TERRAIN_LATTICE);
  for (let i = 0; i < terrainTable.length; i++) {
    terrainTable[i] = hash2int(i % TERRAIN_LATTICE, Math.floor(i / TERRAIN_LATTICE));
  }
}

function lat(x, z) {
  const s = TERRAIN_LATTICE;
  return terrainTable[((z % s) + s) % s * s + (((x % s) + s) % s)];
}

function valueNoise(x, z) {
  ensureTerrainTable();
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = lat(ix, iz);
  const b = lat(ix + 1, iz);
  const c = lat(ix, iz + 1);
  const d = lat(ix + 1, iz + 1);
  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return top + (bottom - top) * sz;
}

function mxNoise(x, z) {
  return valueNoise(x, z) * 2 - 1;
}

function smoothstep01(t) {
  const tt = Math.max(0, Math.min(1, t));
  return tt * tt * (3 - 2 * tt);
}

// Geografía portada del ejemplo "procedural terrain" de three.js:
// warp + ruido fractal + moldeado |v|^2·sign escalado a un mundo gigante,
// con un sesgo vertical para que las llanuras y las cumbres nevadas convivan.
function cordilleraHeight(x, z, boundary) {
  const S = 0.05;
  const sx = x * S;
  const sz = z * S;

  const wx = sx + mxNoise(sx * 1.05, sz * 1.05) * 1.0;
  const wz = sz + mxNoise(sz * 1.05 + 13.7, sx * 1.05 + 7.1) * 1.0;

  let e = 0;
  for (let i = 1; i <= 3; i++) {
    e += mxNoise(wx * (0.175 * i * 2) + i * 987, wz * (0.175 * i * 2) + i * 511) / (i * 2);
  }
  const e2 = e + 0.55;
  const signed = Math.sign(e2);
  let h = Math.pow(Math.abs(e2), 2) * signed * 26;

  h = Math.max(-0.45, Math.min(32, h));

  const half = boundary;
  const dEdge = Math.min(half - Math.abs(x), half - Math.abs(z));
  const rimZone = boundary * 0.4;
  if (dEdge < rimZone) {
    h *= smoothstep01(dEdge / rimZone);
  }
  return h;
}

export function getTerrainHeightAt(mapId, x, z) {
  if (!isTerrainMap(mapId)) return 0;
  return cordilleraHeight(x, z, getMapBoundary(mapId));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let cordilleraObstacles = null;

function makeCordilleraObstacles() {
  if (cordilleraObstacles) return cordilleraObstacles;
  const rng = mulberry32(20260905);
  const list = [];
  const heightAt = (x, z) => cordilleraHeight(x, z, 300);

  function site(minH, maxH) {
    for (let i = 0; i < 24; i++) {
      const x = (rng() - 0.5) * 560;
      const z = (rng() - 0.5) * 560;
      const h = heightAt(x, z);
      if (h >= minH && h <= maxH) return { x, z, h };
    }
    return { x: (rng() - 0.5) * 560, z: (rng() - 0.5) * 560, h: 2 };
  }

  for (let i = 0; i < 170; i++) {
    const p = site(0.8, 16);
    list.push({ kind: "pine", type: "circle", x: p.x, z: p.z, r: 0.9 + rng() * 0.4 });
  }
  for (let i = 0; i < 70; i++) {
    const p = site(0.8, 24);
    list.push({ kind: "rock", type: "circle", x: p.x, z: p.z, r: 1.1 + rng() * 0.9 });
  }
  for (let i = 0; i < 55; i++) {
    const p = site(0.8, 18);
    list.push({ kind: "crate", type: "box", x: p.x, z: p.z, w: 1.8 + rng() * 1.2, d: 1.8 + rng() * 1.2 });
  }
  for (let i = 0; i < 10; i++) {
    const p = site(2, 26);
    list.push({ kind: "pillar", type: "circle", x: p.x, z: p.z, r: 0.7 + rng() * 0.3, h: 3.4 + rng() * 2 });
  }
  for (let i = 0; i < 8; i++) {
    const p = site(0.8, 10);
    list.push({ kind: "igl", type: "box", x: p.x, z: p.z, w: 6 + rng() * 3, d: 5 + rng() * 3 });
  }
  cordilleraObstacles = list;
  return list;
}

export function getMapObstacles(id) {
  const def = MAP_DEFS[id] || MAP_DEFS.nevado;
  if (id === "cordillera") {
    // Escena procedural + props que añada el jugador (colisión y minimapa).
    return makeCordilleraObstacles().concat(def.obstacles || []);
  }
  return def.obstacles;
}

function makeCanvasTexture(size, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ---------------------------------------------------------------- terreno

function makeGround(cfg, boundary, maxAnisotropy = 1) {
  const size = boundary * 2;
  const texture = makeCanvasTexture(512, (ctx, size) => {
    ctx.fillStyle = cfg.base;
    ctx.fillRect(0, 0, size, size);
    if (cfg.grid) {
      ctx.strokeStyle = "rgba(120, 180, 255, 0.35)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= 8; i++) {
        const p = (i / 8) * size;
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, size);
        ctx.moveTo(0, p);
        ctx.lineTo(size, p);
        ctx.stroke();
      }
    }
    for (let i = 0; i < cfg.speckles; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 0.6 + Math.random() * 1.6;
      ctx.fillStyle = Math.random() < 0.5 ? cfg.light : cfg.dark;
      const drawAt = (cx, cy) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      };
      const wrapX = x < r ? [x + size] : x > size - r ? [x - size] : [];
      const wrapY = y < r ? [y + size] : y > size - r ? [y - size] : [];
      drawAt(x, y);
      for (const wx of wrapX) drawAt(wx, y);
      for (const wy of wrapY) drawAt(x, wy);
      for (const wx of wrapX) for (const wy of wrapY) drawAt(wx, wy);
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Mantiene la densidad de la textura al crecer el mapa: 120 m usa 1,5 veces
  // más repeticiones que el recinto de 80 m, así el grano no se ve estirado.
  const repeat = (cfg.repeat || 6) * (size / 80);
  texture.repeat.set(repeat, repeat);
  // Anisotropía: el suelo se ve en ángulo rasante desde la cámara en tercera
  // persona; sin esto la textura se ve borrosa en la distancia.
  texture.anisotropy = Math.min(8, maxAnisotropy || 1);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff, roughness: cfg.roughness ?? 0.95, metalness: 0 })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  // El tuner de mapas localiza el suelo por este nombre para colocar props.
  plane.name = "map-ground";
  return plane;
}

// ---------------------------------------------------------------- terreno displazado (cordillera)

function makeTerrain(boundary) {
  const size = boundary * 2;
  const geometry = new THREE.PlaneGeometry(size, size, 192, 192);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] = cordilleraHeight(positions[i], positions[i + 2], boundary);
  }
  geometry.computeVertexNormals();

  const colors = new Float32Array(positions.length);
  const sand = new THREE.Color(0xe8e2c2);
  const grass = new THREE.Color(0x6fae4e);
  const rock = new THREE.Color(0x9aa6b0);
  const snow = new THREE.Color(0xf6faff);
  const base = new THREE.Color();

  const normals = geometry.attributes.normal.array;
  for (let i = 0; i < positions.length; i += 3) {
    const y = positions[i + 1];
    const x = positions[i];
    const z = positions[i + 2];
    const n = normals[i + 1];
    const slope = 1 - Math.max(-1, Math.min(1, n));
    const jitter = (mxNoise(x * 0.55, z * 0.55) + 1) * 0.5;
    const snowline = 12 + jitter * 3;

    if (y < 0.6) {
      base.copy(sand);
    } else if (y < snowline) {
      if (slope > 0.34) {
        base.copy(rock);
      } else {
        base.copy(grass);
        base.offsetHSL(0, 0, (jitter - 0.5) * 0.06);
      }
    } else {
      base.copy(snow);
    }
    if (y >= 0.6 && y < snowline && slope > 0.34 && y > 8.5) {
      base.lerp(snow, (y - 8.5) / (snowline - 8.5));
    }
    colors[i] = base.r;
    colors[i + 1] = base.g;
    colors[i + 2] = base.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 })
  );
  terrain.receiveShadow = true;
  terrain.castShadow = false;
  // Nombres que usa el tuner de mapas para saber dónde se puede colocar.
  terrain.name = "map-terrain";

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x4db2ff,
      transparent: true,
      opacity: 0.72,
      roughness: 0.22,
      metalness: 0.05,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.5;
  water.name = "map-water";

  return { terrain, water };
}

// ---------------------------------------------------------------- cielo

function makeSky(colors, radius = 160) {
  const geometry = new THREE.SphereGeometry(radius, 32, 18);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(colors.top) },
      midColor: { value: new THREE.Color(colors.mid) },
      horizonColor: { value: new THREE.Color(colors.horizon) },
      topOffset: { value: 1 },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform float topOffset;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld).y;
        h = clamp(h * topOffset, -1.0, 1.0);
        float down = smoothstep(-0.35, 0.0, h);
        float up = smoothstep(0.0, 0.4, h) * 0.95;
        vec3 color = mix(mix(horizonColor, midColor, down), topColor, up);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geometry, material);
  return sky;
}

// ---------------------------------------------------------------- partículas

function makeParticles(cfg, boundary) {
  const count = cfg.count;
  const span = boundary * 2.4;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * span;
    positions[i * 3 + 1] = Math.random() * 22;
    positions[i * 3 + 2] = (Math.random() - 0.5) * span;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: cfg.color,
    size: cfg.size ?? 0.16,
    transparent: true,
    opacity: cfg.opacity ?? 0.85,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);

  const dir = cfg.rise ? 1 : -1;
  let time = 0;
  function update(dt) {
    time += dt;
    const attr = geometry.attributes.position;
    const arr = attr.array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += dir * dt * (cfg.speed ?? 1.2 + (i % 3) * 0.5);
      arr[i * 3] += Math.sin(time + i) * dt * 0.4;
      if ((dir > 0 && arr[i * 3 + 1] > 22) || (dir < 0 && arr[i * 3 + 1] < 0)) {
        arr[i * 3 + 1] = dir > 0 ? 0 : 22;
        arr[i * 3] = (Math.random() - 0.5) * span;
        arr[i * 3 + 2] = (Math.random() - 0.5) * span;
      }
    }
    attr.needsUpdate = true;
  }

  return { points, update };
}

// ---------------------------------------------------------------- pista de hielo (solo nevado)

function makeRinkTexture() {
  return makeCanvasTexture(512, (ctx, size) => {
    const cx = size / 2;
    const grad = ctx.createRadialGradient(cx, cx, size * 0.1, cx, cx, size * 0.5);
    grad.addColorStop(0, "#f6fcff");
    grad.addColorStop(1, "#cfe8f8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = "rgba(90, 150, 210, 0.55)";
    ctx.lineWidth = size * 0.012;
    ctx.beginPath();
    ctx.arc(cx, cx, size * 0.46, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(220, 70, 90, 0.85)";
    ctx.lineWidth = size * 0.014;
    for (const fx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + fx * size * 0.34, cx - size * 0.4);
      ctx.lineTo(cx + fx * size * 0.34, cx + size * 0.4);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(60, 120, 220, 0.6)";
    ctx.lineWidth = size * 0.01;
    ctx.beginPath();
    ctx.moveTo(cx, cx - size * 0.44);
    ctx.lineTo(cx, cx + size * 0.44);
    ctx.stroke();

    ctx.fillStyle = "rgba(220, 70, 90, 0.9)";
    for (const fx of [-1, 1]) {
      for (const fz of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + fx * size * 0.3, cx + fz * size * 0.28, size * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

function makeRinkGoal(xPos, isRight) {
  const goalGroup = new THREE.Group();
  goalGroup.position.set(xPos, 0, 0);
  if (isRight) goalGroup.rotation.y = Math.PI;

  const postMat = new THREE.MeshStandardMaterial({
    color: 0xeb3449,
    metalness: 0.6,
    roughness: 0.25,
  });

  const netMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  });

  const width = 3.6;
  const height = 1.35;
  const depth = 1.1;
  const r = 0.055;

  // Postes verticales izquierdo y derecho
  const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(r, r, height, 12), postMat);
  leftPost.position.set(0, height / 2, -width / 2);
  leftPost.castShadow = true;

  const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(r, r, height, 12), postMat);
  rightPost.position.set(0, height / 2, width / 2);
  rightPost.castShadow = true;

  // Travesaño superior
  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 12), postMat);
  crossbar.rotation.x = Math.PI / 2;
  crossbar.position.set(0, height, 0);
  crossbar.castShadow = true;

  // Base trasera
  const backBottom = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 12), postMat);
  backBottom.rotation.x = Math.PI / 2;
  backBottom.position.set(-depth, r, 0);

  // Soportes inclinados traseros
  for (const sz of [-1, 1]) {
    const slantLength = Math.hypot(height, depth);
    const slant = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, slantLength, 8), postMat);
    slant.position.set(-depth / 2, height / 2, sz * (width / 2));
    slant.rotation.z = Math.atan2(depth, height);
    goalGroup.add(slant);
  }

  // Red en 3D
  const netGeo = new THREE.BoxGeometry(depth, height, width, 5, 5, 10);
  netGeo.translate(-depth / 2, height / 2, 0);
  const netMesh = new THREE.Mesh(netGeo, netMat);

  // Línea de gol resaltada con relieve luminoso en el hielo
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xff1e43,
    emissive: 0xff1e43,
    emissiveIntensity: 0.6,
    roughness: 0.2,
  });
  const goalLine = new THREE.Mesh(new THREE.PlaneGeometry(0.2, width + 0.4), lineMat);
  goalLine.rotation.x = -Math.PI / 2;
  goalLine.position.set(0, 0.025, 0);

  goalGroup.add(leftPost, rightPost, crossbar, backBottom, netMesh, goalLine);
  return goalGroup;
}

function makeRink() {
  const group = new THREE.Group();

  const ice = new THREE.Mesh(
    new THREE.CircleGeometry(16.4, 64),
    new THREE.MeshStandardMaterial({
      map: makeRinkTexture(),
      roughness: 0.12,
      metalness: 0.18,
    })
  );
  ice.rotation.x = -Math.PI / 2;
  ice.position.y = 0.02;
  ice.receiveShadow = true;
  group.add(ice);

  const boardsOuter = new THREE.Mesh(
    new THREE.TorusGeometry(17.4, 0.32, 8, 64),
    new THREE.MeshStandardMaterial({ color: 0x24508f, roughness: 0.4 })
  );
  boardsOuter.rotation.x = Math.PI / 2;
  boardsOuter.position.y = 0.5;
  boardsOuter.castShadow = true;
  group.add(boardsOuter);

  const boardsInner = new THREE.Mesh(
    new THREE.TorusGeometry(16.9, 0.16, 8, 64),
    new THREE.MeshStandardMaterial({ color: 0xe83d54, roughness: 0.5 })
  );
  boardsInner.rotation.x = Math.PI / 2;
  boardsInner.position.y = 0.62;
  group.add(boardsInner);

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 0.9, 8),
      new THREE.MeshStandardMaterial({ color: 0xf2d06b })
    );
    post.position.set(Math.cos(angle) * 17.4, 0.45, Math.sin(angle) * 17.4);
    post.castShadow = true;
    group.add(post);
  }

  // Integrar porterías 3D resaltadas en ambas cabeceras
  group.add(makeRinkGoal(-14.5, false));
  group.add(makeRinkGoal(14.5, true));

  return group;
}

// Arena circular del Coliseo: suelo oscuro, anillo de aviso y muro cilíndrico
// de 34 m de diámetro. La colisión y el servidor usan el mismo radio de juego.
function makeColiseoArena() {
  const group = new THREE.Group();
  const floorRadius = COLISEO_PLAY_RADIUS + 0.65;

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(floorRadius, 80),
    new THREE.MeshStandardMaterial({ color: 0x241820, roughness: 0.86, metalness: 0.12 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  floor.receiveShadow = true;
  group.add(floor);

  const sand = new THREE.Mesh(
    new THREE.RingGeometry(COLISEO_PLAY_RADIUS - 0.9, floorRadius, 80),
    new THREE.MeshStandardMaterial({
      color: 0x7a3f4a,
      emissive: 0x3a141c,
      emissiveIntensity: 0.5,
      roughness: 0.7,
      side: THREE.DoubleSide,
    })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = 0.04;
  group.add(sand);

  // Marca central: ayuda a leer la simetría de la arena.
  const center = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.45, 48),
    new THREE.MeshStandardMaterial({
      color: 0xf87171,
      emissive: 0x8f1f2c,
      emissiveIntensity: 0.6,
      roughness: 0.5,
      side: THREE.DoubleSide,
    })
  );
  center.rotation.x = -Math.PI / 2;
  center.position.y = 0.05;
  group.add(center);

  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(COLISEO_ARENA_RADIUS, COLISEO_ARENA_RADIUS, 2.8, 80, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x3a2530,
      roughness: 0.62,
      metalness: 0.18,
      side: THREE.DoubleSide,
    })
  );
  wall.position.y = 1.4;
  wall.receiveShadow = true;
  group.add(wall);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(COLISEO_ARENA_RADIUS, 0.17, 8, 80),
    new THREE.MeshStandardMaterial({
      color: 0xf87171,
      emissive: 0xf87171,
      emissiveIntensity: 0.65,
      roughness: 0.35,
    })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 2.8;
  group.add(rim);

  // Antorchas repartidas por el muro para dar profundidad sin tapar el combate.
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const torch = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffd0a8,
        emissive: 0xff7a4a,
        emissiveIntensity: 1.1,
        roughness: 0.4,
      })
    );
    torch.position.set(
      Math.cos(angle) * (COLISEO_ARENA_RADIUS - 0.25),
      2.1,
      Math.sin(angle) * (COLISEO_ARENA_RADIUS - 0.25)
    );
    group.add(torch);
  }

  return group;
}

// Aldea del Escondite: jaula central del buscador, anillo de faroles y los doce
// marcadores de escondite. Las coberturas las añade `populate` desde
// MAP_OBSTACLES.escondite (misma geometría que la colisión y la línea de visión).
function makeHideVillage() {
  const group = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(HIDE_CAGE_RADIUS + 0.45, 48),
    new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.92 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.03;
  floor.receiveShadow = true;
  group.add(floor);

  const cageMat = new THREE.MeshStandardMaterial({
    color: 0xffb066,
    emissive: 0xff8a3c,
    emissiveIntensity: 0.85,
    roughness: 0.5,
  });
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(HIDE_CAGE_RADIUS - 0.18, HIDE_CAGE_RADIUS + 0.12, 48),
    cageMat
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  group.add(ring);

  // Barrotes bajos: se lee como jaula pero el buscador puede salir al empezar
  // la fase de búsqueda sin atravesar ninguna malla.
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.88 });
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.5, 6), postMat);
    post.position.set(Math.cos(angle) * HIDE_CAGE_RADIUS, 0.75, Math.sin(angle) * HIDE_CAGE_RADIUS);
    post.castShadow = true;
    group.add(post);
  }
  const top = new THREE.Mesh(new THREE.TorusGeometry(HIDE_CAGE_RADIUS, 0.06, 6, 48), postMat);
  top.rotation.x = Math.PI / 2;
  top.position.y = 1.5;
  group.add(top);

  // Marcadores de los doce escondites: un aro verde en el suelo.
  const spotMat = new THREE.MeshStandardMaterial({
    color: 0x4ade80,
    emissive: 0x22c55e,
    emissiveIntensity: 0.7,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const spotGeo = new THREE.RingGeometry(0.8, 1.25, 24);
  for (const spot of HIDE_SPOTS) {
    const marker = new THREE.Mesh(spotGeo, spotMat);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(spot.x, 0.05, spot.z);
    group.add(marker);
  }

  // Faroles en el anillo interior para dar calidez de aldea.
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const lamp = makeLamp();
    lamp.position.set(Math.cos(angle) * 11, 0, Math.sin(angle) * 11);
    group.add(lamp);
  }

  return group;
}

// Isla flotante del TNT Run: una malla instanciada por capa (5 draw calls para
// 1280 bloques). El servidor manda qué bloques están encendidos y cuáles
// cayeron; aquí solo se anima la caída y se tiñe la mecha. El estado es
// idempotente: un mismo evento repetido no reinicia la animación.
function makeTntArena() {
  const group = new THREE.Group();
  const total = TNT_LAYERS * TNT_GRID * TNT_GRID;
  const status = new Uint8Array(total); // 0 firme · 1 mecha · 2 cayendo · 3 ido
  const falling = new Map();
  const meshes = [];
  const dummy = new THREE.Object3D();
  const baseColors = [0x7f3f2f, 0x8d4632, 0x9d5133, 0xae5e34, 0xc06b36];
  const fuseColors = [0xfacc15, 0xff8a3c];
  const goneColor = new THREE.Color(0x24141a);
  const geo = new THREE.BoxGeometry(TNT_BLOCK_SIZE, 0.34, TNT_BLOCK_SIZE);

  function cellIndex(parts) {
    return parts.row * TNT_GRID + parts.col;
  }

  function colorAt(index, color) {
    const parts = tntPartsOf(index);
    if (!parts) return;
    const mesh = meshes[parts.layer];
    if (mesh) mesh.setColorAt(cellIndex(parts), color);
  }

  function matrixAt(index) {
    const parts = tntPartsOf(index);
    if (!parts) return null;
    const mesh = meshes[parts.layer];
    if (!mesh) return null;
    const at = cellIndex(parts);
    mesh.getMatrixAt(at, dummy.matrix);
    return { mesh, at };
  }

  for (let layer = 0; layer < TNT_LAYERS; layer++) {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.74,
      metalness: 0.04,
    });
    const mesh = new THREE.InstancedMesh(geo, material, TNT_GRID * TNT_GRID);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    for (let row = 0; row < TNT_GRID; row++) {
      for (let col = 0; col < TNT_GRID; col++) {
        const at = row * TNT_GRID + col;
        const center = tntCellCenter(row, col);
        dummy.position.set(center.x, tntLayerHeight(layer) - 0.17, center.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(at, dummy.matrix);
        mesh.setColorAt(at, new THREE.Color(baseColors[layer]));
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    meshes.push(mesh);
  }

  function reset() {
    status.fill(0);
    falling.clear();
    for (let layer = 0; layer < TNT_LAYERS; layer++) {
      const mesh = meshes[layer];
      for (let row = 0; row < TNT_GRID; row++) {
        for (let col = 0; col < TNT_GRID; col++) {
          const at = row * TNT_GRID + col;
          const center = tntCellCenter(row, col);
          dummy.position.set(center.x, tntLayerHeight(layer) - 0.17, center.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(at, dummy.matrix);
          mesh.setColorAt(at, new THREE.Color(baseColors[layer]));
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  function setFuse(index) {
    if (!Number.isInteger(index) || index < 0 || index >= total || status[index] !== 0) return;
    status[index] = 1;
    colorAt(index, new THREE.Color(fuseColors[0]));
    const mesh = meshes[tntPartsOf(index).layer];
    if (mesh && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function startFall(index) {
    if (!Number.isInteger(index) || index < 0 || index >= total || status[index] >= 2) return;
    status[index] = 2;
    const seed = ((index + 1) * 9301 + 49297) % 233280;
    falling.set(index, {
      t: 0,
      y: 0,
      vy: 0.6 + (seed / 233280) * 0.8,
      spin: ((seed / 233280) - 0.5) * 3.2,
    });
    colorAt(index, new THREE.Color(fuseColors[1]));
    const mesh = meshes[tntPartsOf(index).layer];
    if (mesh && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function setState(snapshot) {
    if (!snapshot) return;
    if (snapshot.phase === "waiting" || snapshot.phase === "countdown") {
      reset();
      return;
    }
    for (const item of snapshot.pending || []) setFuse(item.index);
    for (const index of snapshot.fallen || []) startFall(index);
  }

  function event(ev) {
    if (!ev) return;
    if (ev.type === "fuse") setFuse(ev.index);
    else if (ev.type === "blockFall") for (const index of ev.indices || []) startFall(index);
  }

  let pulseAt = 0;
  let pulseOn = false;
  function update(dt) {
    if (falling.size) {
      for (const [index, fall] of falling) {
        const parts = tntPartsOf(index);
        const mesh = meshes[parts.layer];
        const at = cellIndex(parts);
        const center = tntCellCenter(parts.row, parts.col);
        fall.t += dt;
        fall.vy += 17 * dt;
        fall.y -= fall.vy * dt;
        dummy.position.set(center.x, tntLayerHeight(parts.layer) - 0.17 + fall.y, center.z);
        dummy.rotation.set(fall.spin * fall.t, fall.spin * fall.t * 0.6, 0);
        const scale = Math.max(0, 1 + fall.y * 0.06);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(at, dummy.matrix);
        mesh.instanceMatrix.needsUpdate = true;
        if (fall.y < -26) {
          dummy.position.set(center.x, -1000, center.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(0.001, 0.001, 0.001);
          dummy.updateMatrix();
          mesh.setMatrixAt(at, dummy.matrix);
          mesh.instanceMatrix.needsUpdate = true;
          colorAt(index, goneColor);
          status[index] = 3;
          falling.delete(index);
        }
      }
    }

    pulseAt += dt;
    if (pulseAt < 0.12) return;
    pulseAt = 0;
    pulseOn = !pulseOn;
    let changed = false;
    for (let index = 0; index < total; index++) {
      if (status[index] !== 1) continue;
      colorAt(index, new THREE.Color(fuseColors[pulseOn ? 1 : 0]));
      changed = true;
    }
    if (changed) {
      for (const mesh of meshes) {
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  return { group, setState, event, update };
}

// ---------------------------------------------------------------- Karts (paddock + pista)

const KARTS_SURFACE_COLORS = {
  asphalt: 0x3b4356,
  ice: 0x9fd8f5,
  gravel: 0x9b8365,
  sand: 0xd6a45c,
};

function kartsTrackColor(track, t) {
  if (track.boosts.some((boost) => Math.abs(t - boost.t) < 0.012)) return 0x22d3ee;
  const surface = track.surfaces.find((s) => t >= s.from && t <= s.to);
  const base = new THREE.Color(KARTS_SURFACE_COLORS[surface ? surface.type : "asphalt"]);
  if (track.tunnels.some((tunnel) => t >= tunnel.fromT && t <= tunnel.toT)) {
    base.multiplyScalar(0.55);
  }
  return base;
}

function makeKartsTrackMesh(track) {
  const frames = track.frames;
  const n = frames.length;
  const half = track.width / 2;
  const positions = [];
  const colors = [];
  const indices = [];

  for (let i = 0; i <= n; i++) {
    const f = frames[i % n];
    const bankY = Math.sin(f.bank) * half;
    const color = kartsTrackColor(track, i === n ? 1 : f.t);
    positions.push(f.x - f.nx * half, f.y - bankY, f.z - f.nz * half);
    positions.push(f.x + f.nx * half, f.y + bankY, f.z + f.nz * half);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      side: THREE.DoubleSide,
    })
  );
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.add(mesh);

  // Bordillos rojo/blanco: se leen bien desde la cámara de seguimiento y
  // delimitan la pista aunque la superficie cambie de color.
  const curbPos = [];
  const curbCol = [];
  const curbIdx = [];
  const red = new THREE.Color(0xef4444);
  const white = new THREE.Color(0xf8fafc);
  for (let i = 0; i < n; i++) {
    const a = frames[i];
    const b = frames[(i + 1) % n];
    const color = Math.floor(i / 9) % 2 === 0 ? red : white;
    for (const side of [-1, 1]) {
      const base = curbPos.length / 3;
      for (const [f, inset] of [
        [a, 0],
        [b, 0],
        [a, 0.9],
        [b, 0.9],
      ]) {
        const offset = side * (half - inset);
        curbPos.push(
          f.x + f.nx * offset,
          f.y + Math.sin(f.bank) * offset + 0.06,
          f.z + f.nz * offset
        );
        curbCol.push(color.r, color.g, color.b);
      }
      curbIdx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }
  const curbGeo = new THREE.BufferGeometry();
  curbGeo.setAttribute("position", new THREE.Float32BufferAttribute(curbPos, 3));
  curbGeo.setAttribute("color", new THREE.Float32BufferAttribute(curbCol, 3));
  curbGeo.setIndex(curbIdx);
  curbGeo.computeVertexNormals();
  group.add(
    new THREE.Mesh(
      curbGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide })
    )
  );

  // Línea de salida ajedrezada.
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 8; col++) {
      ctx.fillStyle = (row + col) % 2 ? "#111827" : "#f8fafc";
      ctx.fillRect(col * 16, row * 16, 16, 16);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const start = kartsPointAt(track.id, 0);
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(track.width, 2.2),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
  );
  line.rotation.x = -Math.PI / 2;
  line.rotation.z = -start.yaw;
  line.position.set(start.x, start.y + 0.07, start.z);
  group.add(line);

  // Turbos: placas emisivas con cartel. El servidor aplica el impulso real;
  // esto solo avisa de dónde está.
  for (const boost of track.boosts) {
    const p = kartsPointAt(track.id, boost.distance);
    const pad = new THREE.Group();
    pad.position.set(p.x, p.y + 0.06, p.z);
    pad.rotation.y = p.yaw;
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(track.width * 0.55, 0.08, 4.2),
      new THREE.MeshStandardMaterial({
        color: 0x0891b2,
        emissive: 0x22d3ee,
        emissiveIntensity: 0.9,
        roughness: 0.4,
      })
    );
    pad.add(plate);
    const tag = makeLabelSprite("TURBO", "#a5f3fc", 320);
    tag.scale.set(4.2, 1.05, 1);
    tag.position.y = 1.7;
    pad.add(tag);
    group.add(pad);
  }

  // Túneles: arcos espaciados cada ~9 m. No tienen colisión propia; el coche
  // sigue la spline y el techo es decoración.
  for (const tunnel of track.tunnels) {
    for (let t = tunnel.fromT; t <= tunnel.toT + 0.001; t += 0.009) {
      const p = kartsPointAt(track.id, t * track.length);
      const arch = new THREE.Group();
      arch.position.set(p.x, p.y, p.z);
      arch.rotation.y = p.yaw;
      const mat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 6.2, 0.8), mat);
        pillar.position.set(side * (half + 0.5), 3.1, 0);
        pillar.castShadow = true;
        arch.add(pillar);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(track.width + 1.8, 0.7, 0.9), mat);
      beam.position.y = 6.3;
      beam.castShadow = true;
      arch.add(beam);
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(track.width + 1.8, 0.12, 0.2),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
      );
      strip.position.y = 5.88;
      strip.position.z = 0.5;
      arch.add(strip);
      group.add(arch);
    }
  }

  return group;
}

function makeKartsWorld() {
  const group = new THREE.Group();
  const center = KARTS_PADDOCK_CENTER;

  // Paddock cubierto: solera de hormigón, techo, vigas y cuatro pilares.
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(96, 0.3, 78),
    new THREE.MeshStandardMaterial({ color: 0x596274, roughness: 0.95 })
  );
  floor.position.set(center.x, -0.1, center.z);
  floor.receiveShadow = true;
  group.add(floor);

  const steel = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.35 });
  for (const dx of [-42, 42]) {
    for (const dz of [-32, 32]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 9.5, 1.1), steel);
      pillar.position.set(center.x + dx, 4.75, center.z + dz);
      pillar.castShadow = true;
      group.add(pillar);
    }
  }
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(92, 0.5, 72),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 })
  );
  roof.position.set(center.x, 9.6, center.z);
  roof.castShadow = true;
  group.add(roof);
  for (const dz of [-24, 0, 24]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(92, 0.5, 0.7), steel);
    beam.position.set(center.x, 9.2, center.z + dz);
    group.add(beam);
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(60, 0.12, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xfff7d6 })
    );
    light.position.set(center.x, 8.9, center.z + dz);
    group.add(light);
  }
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(92, 8, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x273449, roughness: 0.9 })
  );
  backWall.position.set(center.x, 4, center.z - 36);
  group.add(backWall);
  const banner = makeLabelSprite("🏁 PADDOCK KARTS", "#fbcfe8", 640);
  banner.scale.set(16, 4, 1);
  banner.position.set(center.x, 6.2, center.z - 35.4);
  group.add(banner);

  // Pista jugable (los otros dos trazados se anuncian solo en los portales).
  const track = KARTS_TRACKS.find((item) => item.status === "live") || KARTS_TRACKS[0];
  group.add(makeKartsTrackMesh(track));

  // Pedestales de la tienda. Cada malla lleva userData.kartId para el clic.
  const pedestals = [];
  const pickables = [];
  KART_PEDESTALS.forEach((position, index) => {
    const view = createKartPedestal(KART_CATALOG[index].id, position);
    group.add(view.group);
    pedestals.push(view);
    view.group.traverse((child) => {
      if (child.isMesh) pickables.push(child);
    });
  });

  // Portales de las tres pistas.
  const rings = [];
  KARTS_PORTALS.forEach((portal) => {
    const yaw = Math.atan2(center.x - portal.x, center.z - portal.z);
    const view = makePortalGate(
      {
        ...portal,
        icon: portal.status === "live" ? "🏁" : "🚧",
        short: portal.label,
      },
      { yaw }
    );
    group.add(view.group);
    rings.push(view.ring);
    if (portal.status !== "live") {
      const tag = makeLabelSprite("En preparación", "#cbd5e1", 420);
      tag.scale.set(5.2, 1.3, 1);
      tag.position.set(portal.x, 5.2, portal.z);
      group.add(tag);
    }
  });

  function setKartsState({ owned = [], equipped = null, points = 0 } = {}) {
    pedestals.forEach((view, index) => {
      const kart = KART_CATALOG[index];
      view.setState({
        owned: owned.includes(kart.id),
        equipped: equipped === kart.id,
        affordable: points >= kart.price,
      });
    });
  }

  return {
    group,
    pickables,
    setKartsState,
    update(t) {
      rings.forEach((ring, index) => {
        ring.rotation.z = t * 0.7 + index;
      });
      pedestals.forEach((view, index) => {
        view.ring.rotation.z = t * (index % 2 ? -0.5 : 0.5);
        view.kartModel.rotation.y = Math.sin(t * 0.35 + index) * 0.22;
      });
    },
  };
}

// ---------------------------------------------------------------- decoración genérica

function pineTree(palette, scale) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.3, 1.8, 8),
    new THREE.MeshStandardMaterial({ color: palette.trunk, roughness: 1 })
  );
  trunk.position.y = 0.9;
  trunk.castShadow = true;
  group.add(trunk);

  const layers = [
    { y: 1.9, r: 1.0 },
    { y: 2.6, r: 0.78 },
    { y: 3.2, r: 0.55 },
  ];
  for (const layer of layers) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(layer.r, 1.0, 10),
      new THREE.MeshStandardMaterial({ color: palette.leaf, roughness: 0.85 })
    );
    cone.position.y = layer.y;
    cone.castShadow = true;
    group.add(cone);

    const snow = new THREE.Mesh(
      new THREE.ConeGeometry(layer.r * 0.95, 0.28, 10),
      new THREE.MeshStandardMaterial({ color: palette.highlight, roughness: 0.9 })
    );
    snow.position.y = layer.y + 0.45;
    snow.castShadow = true;
    group.add(snow);
  }

  group.scale.setScalar(scale);
  return group;
}

function leafTree(palette, scale) {
  const group = new THREE.Group();
  const scaleVal = scale || 1;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.26, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: palette.trunk, roughness: 1 })
  );
  trunk.position.y = 0.8;
  trunk.castShadow = true;
  group.add(trunk);

  const shades = palette.shades || [0x2e8b57, 0x3aa868, 0x55c98a];
  const blobs = [
    { y: 1.7, r: 0.85, c: shades[0] },
    { y: 2.25, r: 0.65, c: shades[1] },
    { y: 2.75, r: 0.42, c: shades[2] },
  ];
  for (const blob of blobs) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(blob.r, 12, 10),
      new THREE.MeshStandardMaterial({ color: blob.c, roughness: 0.9 })
    );
    sphere.position.y = blob.y;
    sphere.castShadow = true;
    group.add(sphere);
  }

  group.scale.setScalar(scaleVal);
  return group;
}

function cactus(palette, scale) {
  const group = new THREE.Group();
  const s = scale || 1;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22 * s, 0.28 * s, 2.4 * s, 10),
    new THREE.MeshStandardMaterial({ color: palette.body, roughness: 0.9 })
  );
  body.position.y = 1.2 * s;
  body.castShadow = true;
  group.add(body);

  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * s, 0.14 * s, 1.1 * s, 8),
      new THREE.MeshStandardMaterial({ color: palette.body, roughness: 0.9 })
    );
    arm.position.set(sx * 0.32 * s, 1.85 * s, 0);
    arm.rotation.z = sx * 0.55;
    arm.castShadow = true;
    group.add(arm);

    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.13 * s, 8, 8),
      new THREE.MeshStandardMaterial({ color: palette.body, roughness: 0.9 })
    );
    tip.position.set(sx * 0.62 * s, 2.42 * s, 0);
    group.add(tip);
  }

  return group;
}

function rockMesh(r, color) {
  const rock = new THREE.Mesh(
    new THREE.SphereGeometry(r, 8, 6),
    new THREE.MeshStandardMaterial({ color, roughness: 1 })
  );
  rock.position.y = r * 0.6;
  rock.scale.y = 0.7;
  rock.castShadow = true;

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(r * 0.7, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 })
  );
  cap.position.set(r * 0.25, r * 0.95, r * -0.15);
  cap.scale.y = 0.6;
  cap.castShadow = true;

  const group = new THREE.Group();
  group.add(rock, cap);
  return group;
}

function crate(o, palette) {
  const group = new THREE.Group();
  const w = o.w;
  const d = o.d || o.w;
  const color = palette.bands[Math.abs(o.x + o.z) % palette.bands.length];
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(w, w, d),
    new THREE.MeshStandardMaterial({ color: palette.box, roughness: 0.6 })
  );
  box.position.y = w / 2;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);

  for (const by of [0.35, 0.7]) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.02, 0.3, d + 0.02),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
    );
    band.position.y = w * by;
    group.add(band);
  }
  return group;
}

// --- Props de la aldea del Escondite ---------------------------------------
// Cabañas, pajares, vallas y pozos. Se dibujan como mallas individuales (no
// instanciadas) porque solo hay una docena y cada tipo tiene su silueta.

function cabinMesh(o, palette) {
  const group = new THREE.Group();
  const w = o.w || 4.2;
  const d = o.d || 3.2;
  const h = o.h || 2.7;
  const wallMat = new THREE.MeshStandardMaterial({ color: palette.wall || 0x9a6a44, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: palette.roof || 0x6d3f34, roughness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: palette.trim || 0xe8d8b0, roughness: 0.8 });

  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  walls.position.y = h / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 1.5, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, d / w);
  roof.position.y = h + 0.7;
  roof.castShadow = true;
  group.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.12), roofMat);
  door.position.set(0, 0.75, d / 2 + 0.02);
  group.add(door);

  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xffe9b8,
    emissive: 0xffc45e,
    emissiveIntensity: 0.45,
    roughness: 0.5,
  });
  for (const sx of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.5), windowMat);
    win.position.set(sx * (w / 3.2), h * 0.62, d / 2 + 0.03);
    group.add(win);
  }

  const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.16, 0.16), trimMat);
  beam.position.set(0, h - 0.1, d / 2 + 0.04);
  group.add(beam);

  return group;
}

function haystackMesh(o, palette) {
  const group = new THREE.Group();
  const r = o.r || 1.6;
  const h = r * 1.5;
  const mat = new THREE.MeshStandardMaterial({ color: palette.body || 0xd9b45c, roughness: 1 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 14), mat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  cap.position.y = h;
  cap.scale.y = 0.55;
  cap.castShadow = true;
  group.add(cap);

  const bandMat = new THREE.MeshStandardMaterial({ color: palette.dark || 0xb08a3a, roughness: 0.95 });
  for (const by of [0.35, 0.7]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.02, r + 0.04, 0.12, 14), bandMat);
    band.position.y = h * by;
    group.add(band);
  }
  return group;
}

function fenceMesh(o, palette) {
  const group = new THREE.Group();
  const w = o.w || 4.2;
  const h = o.h || 1.6;
  const mat = new THREE.MeshStandardMaterial({ color: palette.body || 0x8a6238, roughness: 0.9 });
  const posts = 3;
  for (let i = 0; i < posts; i++) {
    const x = -w / 2 + (i / (posts - 1)) * w;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16), mat);
    post.position.set(x, h / 2, 0);
    post.castShadow = true;
    group.add(post);
  }
  for (const by of [0.45, 0.8]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, 0.1), mat);
    rail.position.set(0, h * by, 0);
    rail.castShadow = true;
    group.add(rail);
  }
  return group;
}

function wellMesh(o, palette) {
  const group = new THREE.Group();
  const r = o.r || 1.35;
  const stoneMat = new THREE.MeshStandardMaterial({ color: palette.stone || 0x8f8f86, roughness: 1 });
  const roofMat = new THREE.MeshStandardMaterial({ color: palette.roof || 0x6d3f34, roughness: 0.85 });

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.9, 16, 1, true), stoneMat);
  rim.position.y = 0.45;
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(r * 0.82, 16),
    new THREE.MeshStandardMaterial({ color: 0x2b5f7a, roughness: 0.25, metalness: 0.3 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.32;
  group.add(water);

  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 0.14), roofMat);
    post.position.set(sx * r * 0.75, 1.2, 0);
    post.castShadow = true;
    group.add(post);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.25, 0.8, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.2;
  roof.castShadow = true;
  group.add(roof);
  return group;
}

function iglooGroup(w, d) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(w, 3.2, d),
    new THREE.MeshStandardMaterial({ color: 0xdff1fa, roughness: 0.85 })
  );
  base.position.y = 1.6;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(w, d) * 0.55, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xbfe0f2, roughness: 0.8 })
  );
  dome.position.set(0, 3.2, 0);
  dome.castShadow = true;
  group.add(dome);

  const door = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.65, 1.6, 12, 1, false, Math.PI, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x24485e })
  );
  door.rotation.x = Math.PI;
  door.position.set(0, 0.8, d / 2 + 0.1);
  group.add(door);

  const windowMat = new THREE.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffc45e, emissiveIntensity: 0.35 });
  for (const sx of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), windowMat);
    win.position.set(sx * (w / 4), 2.2, d / 2 + 0.08);
    group.add(win);
  }

  return group;
}

function pillar(o, palette) {
  const group = new THREE.Group();
  const h = o.h || 3.5;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(o.r, o.r * 1.15, h, 10),
    new THREE.MeshStandardMaterial({ color: palette.body, roughness: 0.9 })
  );
  body.position.y = h / 2;
  body.castShadow = true;
  group.add(body);

  if (palette.glow) {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(o.r * 0.7, 10, 8),
      new THREE.MeshStandardMaterial({
        color: palette.glow,
        emissive: palette.glow,
        emissiveIntensity: 1.1,
      })
    );
    glow.position.y = h + 0.1;
    group.add(glow);
  }

  return group;
}

// Monolito de portal: piedra hexagonal con un aro luminoso en la cima. El aro
// flotante, el haz y la etiqueta los añade makePortalGate (van aparte para poder
// animarlos sin tocar la colisión).
function monolith(palette) {
  const group = new THREE.Group();
  const h = 3.2;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 1.0, h, 6),
    new THREE.MeshStandardMaterial({
      color: palette.body || 0x5f6f7d,
      roughness: 0.85,
      flatShading: true,
    })
  );
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const glowColor = palette.glow || 0x7ff0d0;
  const cap = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.08, 8, 18),
    new THREE.MeshStandardMaterial({
      color: glowColor,
      emissive: glowColor,
      emissiveIntensity: 1.3,
      roughness: 0.35,
    })
  );
  cap.rotation.x = Math.PI / 2;
  cap.position.y = h + 0.05;
  group.add(cap);

  return group;
}

// Monumento central de la isla: un pingüino de piedra sobre un pedestal.
function monument() {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x8fa3b0, roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2f3b4a, roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: 0xeaf4ff, roughness: 0.8 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.45, 0.55, 14), stone);
  base.position.y = 0.275;
  base.receiveShadow = true;
  group.add(base);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.5, 1.1, 12), stone);
  pedestal.position.y = 1.05;
  pedestal.castShadow = true;
  group.add(pedestal);

  const body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 18, 14), dark);
  body.scale.set(1, 1.25, 0.95);
  body.position.y = 2.45;
  body.castShadow = true;
  group.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.74, 16, 12), white);
  belly.scale.set(0.95, 1.1, 0.6);
  belly.position.set(0, 2.4, 0.55);
  group.add(belly);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), dark);
  head.position.y = 3.5;
  head.castShadow = true;
  group.add(head);

  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.42, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2a03d, roughness: 0.6 })
  );
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 3.44, 0.66);
  group.add(beak);

  return group;
}

function stalagmite(palette) {
  const group = new THREE.Group();
  const h = 1.6 + Math.random() * 1.2;
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, h, 7),
    new THREE.MeshStandardMaterial({ color: palette.rock, roughness: 1, flatShading: true })
  );
  body.position.y = h / 2;
  body.castShadow = true;
  group.add(body);

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.24, 6),
    new THREE.MeshStandardMaterial({ color: palette.glow, emissive: palette.glow, emissiveIntensity: 0.9 })
  );
  tip.position.y = h + 0.1;
  group.add(tip);
  return group;
}

function shroom(palette) {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.26, 0.6, 8),
    new THREE.MeshStandardMaterial({ color: palette.stem, roughness: 0.9 })
  );
  stem.position.y = 0.3;
  stem.castShadow = true;
  group.add(stem);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.44, 10, 8),
    new THREE.MeshStandardMaterial({
      color: palette.cap,
      roughness: 0.7,
      emissive: palette.glow,
      emissiveIntensity: 0.5,
    })
  );
  cap.position.y = 0.8;
  cap.scale.y = 0.72;
  group.add(cap);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 6),
    new THREE.MeshBasicMaterial({ color: palette.glow })
  );
  glow.position.y = 1.06;
  group.add(glow);
  return group;
}

function crystalCluster(x, z, s) {
  const group = new THREE.Group();
  const colors = [0x5ae3ff, 0x35d9b8, 0x8f8bff];
  const spikes = [
    [0, 0, 1.9], [0.7, 0.2, 1.3], [-0.8, 0.1, 1.5], [0, 0.3, 2.3], [0.4, -0.5, 1.1], [-0.5, -0.6, 1.2],
  ];
  spikes.forEach(([sx, sz, sh], i) => {
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry((0.16 + Math.random() * 0.12) * s, sh * s, 5),
      new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        emissive: colors[i % colors.length],
        emissiveIntensity: 0.85,
        roughness: 0.35,
      })
    );
    spike.position.set(sx * s, (sh / 2) * s, sz * s);
    spike.rotation.y = Math.random() * Math.PI * 2;
    spike.rotation.z = (Math.random() - 0.5) * 0.35;
    group.add(spike);
  });
  group.position.set(x, 0, z);
  return group;
}

// ---------------------------------------------------------------- cueva (solo gruta)

function makeCave(boundary = 40) {
  const group = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x101630, roughness: 1 });
  // La cúpula acompaña el tamaño del mapa para que el techo no se abra en los
  // mapas de 120 m (antes estaba fijada al recinto de 80 m).
  const scale = boundary / 40;

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(46 * scale, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    rockMat
  );
  dome.position.y = -2;
  group.add(dome);

  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = (6 + Math.random() * 32) * scale;
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.18 + Math.random() * 0.4, 1.8 + Math.random() * 3, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a2238, roughness: 1, flatShading: true })
    );
    const y = (5.4 + Math.random() * 3.2) * (0.9 + scale * 0.35);
    spike.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
    spike.rotation.x = Math.PI;
    group.add(spike);
  }

  return group;
}

function buildingMesh(o, palette) {
  const group = new THREE.Group();
  const h = o.h || 4;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(o.w, h, o.d || o.w),
    new THREE.MeshStandardMaterial({ color: palette.body, roughness: 0.75 })
  );
  body.position.y = h / 2;
  body.castShadow = true;
  group.add(body);

  const winMat = new THREE.MeshStandardMaterial({
    color: 0xffd27f,
    emissive: 0xffb84d,
    emissiveIntensity: 0.85,
  });
  const rows = Math.max(2, Math.floor(h));
  for (let r = 0; r < rows; r++) {
    for (const sx of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.04), winMat);
      win.position.set(sx * (o.w / 4), 0.8 + r * 0.9, (o.d || o.w) / 2 + 0.03);
      group.add(win);
    }
  }

  return group;
}

function ruinMesh(o, palette) {
  const group = new THREE.Group();
  const w = o.w;
  const d = o.d || o.w;
  const stone = new THREE.Mesh(
    new THREE.BoxGeometry(w, 1.1, d),
    new THREE.MeshStandardMaterial({ color: palette.body, roughness: 0.95 })
  );
  stone.position.y = 0.55;
  stone.castShadow = true;
  stone.receiveShadow = true;
  group.add(stone);

  const pillarMat = new THREE.MeshStandardMaterial({ color: palette.pillar, roughness: 0.95 });
  for (const [px, pz] of [
    [-w / 2 + 0.6, -d / 2 + 0.6],
    [w / 2 - 0.6, -d / 2 + 0.6],
    [-w / 2 + 0.6, d / 2 - 0.6],
    [w / 2 - 0.6, d / 2 - 0.6],
  ]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 2.6, 10), pillarMat);
    col.position.set(px, 2.4, pz);
    col.castShadow = true;
    group.add(col);
  }

  return group;
}

function flower(palette) {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.04, 0.45, 6),
    new THREE.MeshStandardMaterial({ color: 0x3f8f3f, roughness: 0.9 })
  );
  stem.position.y = 0.22;
  group.add(stem);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshStandardMaterial({ color: palette[Math.floor(Math.random() * palette.length)], roughness: 0.8 })
  );
  head.position.y = 0.48;
  group.add(head);

  return group;
}

function lavaPool(r) {
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(r, 24),
    new THREE.MeshStandardMaterial({
      color: 0xff7a1a,
      emissive: 0xff5a00,
      emissiveIntensity: 1.2,
      roughness: 0.5,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.03;
  return pool;
}

function neonRing({ x, z, y = 1.2, r = 1.1, color = 0x69e6ff }) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r, 0.05, 8, 32),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, y, z);
  return ring;
}

// ---------------------------------------------------------------- decoración fija (nevado)

function makeFlag(angle) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.09, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xefefef, roughness: 0.5 })
  );
  pole.position.y = 2;
  pole.castShadow = true;
  group.add(pole);

  const colors = [0xe83d54, 0xffb02e, 0x2ec98f, 0x3f7fe0];
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.8),
    new THREE.MeshStandardMaterial({
      color: colors[Math.floor(angle / (Math.PI / 2)) % colors.length],
      side: THREE.DoubleSide,
    })
  );
  flag.position.set(0.7, 3.1, 0);
  group.add(flag);

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd166 })
  );
  ball.position.y = 4;
  group.add(ball);

  return group;
}

function makeSnowman() {
  const group = new THREE.Group();
  const snow = new THREE.MeshStandardMaterial({ color: 0xf8fcff, roughness: 0.9 });

  const base = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), snow);
  base.position.y = 0.85;
  base.castShadow = true;
  group.add(base);

  const mid = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), snow);
  mid.position.y = 1.95;
  mid.castShadow = true;
  group.add(mid);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), snow);
  head.position.y = 2.95;
  head.castShadow = true;
  group.add(head);

  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.28, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8862e })
  );
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 2.98, 0.4);
  group.add(beak);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a2330 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eye.position.set(sx * 0.13, 3.06, 0.36);
    group.add(eye);
  }

  const buttons = new THREE.MeshStandardMaterial({ color: 0x2b3444 });
  for (let i = 0; i < 3; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), buttons);
    dot.position.set(0, 1.75 - i * 0.28, 0.54);
    group.add(dot);
  }

  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.1, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xe83d54 })
  );
  scarf.rotation.x = Math.PI / 2;
  scarf.position.set(0, 2.45, 0);
  group.add(scarf);

  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x2b3444 })
  );
  hat.position.y = 3.45;
  group.add(hat);

  const hatBrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.42, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: 0x2b3444 })
  );
  hatBrim.position.y = 3.12;
  group.add(hatBrim);

  return group;
}

function makeLamp() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.1, 3.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x35455f, roughness: 0.6 })
  );
  pole.position.y = 1.8;
  pole.castShadow = true;
  group.add(pole);

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.08, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x35455f })
  );
  arm.position.set(0.35, 3.6, 0);
  group.add(arm);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffc45e, emissiveIntensity: 0.9 })
  );
  glow.position.set(0.7, 3.52, 0);
  group.add(glow);

  return group;
}

function makePenguin() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 0.55, 6, 14),
    new THREE.MeshStandardMaterial({ color: 0x222b3f, roughness: 0.7 })
  );
  body.position.y = 0.72;
  body.castShadow = true;
  group.add(body);

  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xf4f8fc, roughness: 0.6 })
  );
  belly.scale.set(1, 1.25, 0.65);
  belly.position.set(0, 0.68, 0.28);
  group.add(belly);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0x222b3f })
  );
  head.position.y = 1.35;
  group.add(head);

  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.26, 8),
    new THREE.MeshStandardMaterial({ color: 0xff9f1c })
  );
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.32, 0.3);
  group.add(beak);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f1624 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eye.position.set(sx * 0.13, 1.42, 0.26);
    group.add(eye);
  }

  group.rotation.y = Math.random() * Math.PI * 2;
  return group;
}

function makeMountain(x, z, height, radius, color = 0x8fa8c8) {
  const group = new THREE.Group();
  const rock = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 1 })
  );
  rock.position.y = height / 2;
  group.add(rock);

  const snowCap = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.45, height * 0.28, 8),
    new THREE.MeshStandardMaterial({ color: 0xf6fbff, roughness: 0.95 })
  );
  snowCap.position.y = height * 0.82;
  group.add(snowCap);

  group.position.set(x, 0, z);
  return group;
}

// ---------------------------------------------------------------- definiciones de mapas

export const MAP_DEFS = {
  nevado: {
    obstacles: [
      { kind: "crate", type: "box", x: 5, z: 3, w: 2, d: 2 },
      { kind: "crate", type: "box", x: -6, z: 4, w: 2, d: 2 },
      { kind: "crate", type: "box", x: 0, z: -7, w: 3, d: 3 },
      { kind: "crate", type: "box", x: -8, z: -4, w: 2, d: 2 },
      { kind: "crate", type: "box", x: 8, z: -2, w: 1.5, d: 1.5 },
      { kind: "crate", type: "box", x: 14, z: 6, w: 2, d: 2 },
      { kind: "crate", type: "box", x: -16, z: 10, w: 2, d: 2 },
      { kind: "crate", type: "box", x: 20, z: -12, w: 3, d: 2 },
      { kind: "crate", type: "box", x: -24, z: -8, w: 2, d: 2 },
      { kind: "crate", type: "box", x: 30, z: 14, w: 2, d: 2 },
      { kind: "rock", type: "circle", x: 12, z: -14, r: 1.4 },
      { kind: "rock", type: "circle", x: -30, z: 18, r: 1.8 },
      { kind: "rock", type: "circle", x: 24, z: 22, r: 1.2 },
      { kind: "rock", type: "circle", x: -14, z: -22, r: 1.6 },
      { kind: "rock", type: "circle", x: 34, z: -20, r: 1.3 },
      { kind: "igl", type: "box", x: -22, z: -20, w: 8, d: 7 },
      { kind: "igl", type: "box", x: 22, z: 8, w: 9, d: 7 },
      { kind: "igl", type: "box", x: -6, z: 24, w: 7, d: 8 },
      { kind: "igl", type: "box", x: 6, z: -30, w: 8, d: 8 },
      { kind: "igl", type: "box", x: 32, z: -6, w: 7, d: 7 },
      { kind: "pine", type: "circle", x: -4, z: -16, r: 0.9 },
      { kind: "pine", type: "circle", x: 16, z: -8, r: 0.9 },
      { kind: "pine", type: "circle", x: -12, z: 12, r: 0.9 },
      { kind: "pine", type: "circle", x: 4, z: 14, r: 0.9 },
      { kind: "pine", type: "circle", x: -20, z: 4, r: 1.0 },
      { kind: "pine", type: "circle", x: 20, z: 18, r: 1.0 },
      { kind: "pine", type: "circle", x: -28, z: -14, r: 1.0 },
      { kind: "pine", type: "circle", x: 28, z: -24, r: 1.0 },
      { kind: "pine", type: "circle", x: -18, z: 28, r: 1.1 },
      { kind: "pine", type: "circle", x: 10, z: 32, r: 1.1 },
      { kind: "pine", type: "circle", x: 38, z: 24, r: 1.1 },
      { kind: "pine", type: "circle", x: -38, z: -30, r: 1.2 },
      { kind: "pine", type: "circle", x: 30, z: 34, r: 1.1 },
      { kind: "pine", type: "circle", x: -32, z: -2, r: 1.0 },
      { kind: "pine", type: "circle", x: 18, z: -34, r: 1.0 },
      { kind: "pine", type: "circle", x: -34, z: 8, r: 1.1 },
      { kind: "pine", type: "circle", x: 2, z: 22, r: 0.9 },
      { kind: "pine", type: "circle", x: -2, z: -26, r: 0.9 },
    ],
    palette: {
      pine: { trunk: 0x6a4526, leaf: 0x2e6b45, highlight: 0xf4fafe },
      rock: 0x9fb6cc,
      crate: { box: 0xe9eef3, bands: [0x3f8f6c, 0x4688c9, 0xe07a3a, 0x9a5bb8, 0xd34f5f] },
    },
  },

  selva: {
    obstacles: MAP_OBSTACLES.selva,
    palette: {
      leaf: { trunk: 0x5a3420, shades: [0x1f6f3f, 0x2e8b57, 0x3aa868] },
      rock: 0x6f8f6a,
      crate: { box: 0xaa8b5d, bands: [0x5f7030, 0x2e7d4f, 0x7a4a2a] },
    },
  },

  desierto: {
    obstacles: MAP_OBSTACLES.desierto,
    palette: {
      cactus: { body: 0x3f8f4e },
      rock: 0xc8a165,
      ruin: { body: 0xd8b57a, pillar: 0xc8985a },
      crate: { box: 0xa97c43, bands: [0x7a4a2a, 0xc9a227, 0x5f7030] },
    },
  },

  volcan: {
    obstacles: MAP_OBSTACLES.volcan,
    palette: {
      pillar: { body: 0x3a3a44 },
      rock: 0x4a4650,
      crate: { box: 0x5b5650, bands: [0x8a3c2a, 0x3a3a44, 0xff7a1a] },
    },
  },

  pradera: {
    obstacles: MAP_OBSTACLES.pradera,
    palette: {
      leaf: { trunk: 0x6a4a2a, shades: [0x58a832, 0x74c651, 0x8fd96f] },
      rock: 0x9aa5a0,
      crate: { box: 0xc8a468, bands: [0x8a5a30, 0x4a8f4f, 0xd9a227] },
    },
  },

  ciudad: {
    obstacles: MAP_OBSTACLES.ciudad,
    palette: {
      pillar: { body: 0x3d4a6b, glow: 0x69e6ff },
      building: { body: 0x232a45 },
      crate: { box: 0x2c3350, bands: [0x69e6ff, 0xff4dc8, 0x9a5bb8] },
    },
  },

  cordillera: {
    obstacles: [],
    palette: {
      pine: { trunk: 0x6a4526, leaf: 0x2e6b45, highlight: 0xf4fafe },
      rock: 0x8d99a6,
      crate: { box: 0xdfe8f1, bands: [0x3f8f6c, 0x4688c9, 0xe07a3a, 0x9a5bb8, 0xd34f5f] },
      pillar: { body: 0xcfd9e8, glow: 0x9fd8ff },
    },
  },

  gruta: {
    obstacles: MAP_OBSTACLES.gruta,
    palette: {
      rock: 0x5a6277,
      pillar: { body: 0x3d4a6b, glow: 0x5ae3ff },
      stalagmite: { rock: 0x46506b, glow: 0x7cffd4 },
      shroom: { stem: 0xc8bfa8, cap: 0x9a5bb8, glow: 0xd98aff },
    },
  },

  isla: {
    obstacles: MAP_OBSTACLES.isla,
    palette: {
      leaf: { trunk: 0x7a5230, shades: [0x2f9a5e, 0x47b874, 0x62d08c] },
      rock: 0xb9a889,
      pillar: { body: 0x5f6f7d, glow: 0x7ff0d0 },
      crate: { box: 0xc9a468, bands: [0x2f9a5e, 0x7dd3fc, 0xfacc15] },
    },
  },

  pares: {
    obstacles: MAP_OBSTACLES.pares,
    palette: {
      pillar: { body: 0x3d4a6b, glow: 0x7dd3fc },
      rock: 0x6b7a99,
      crate: { box: 0x2c3350, bands: [0x7dd3fc, 0xf472b6, 0xfacc15] },
    },
  },

  coliseo: {
    obstacles: MAP_OBSTACLES.coliseo,
    palette: {
      pillar: { body: 0x4a3550, glow: 0xf87171 },
      rock: 0x6f5f74,
      crate: { box: 0x2a2238, bands: [0xf87171, 0xf472b6, 0xfacc15] },
    },
  },

  escondite: {
    obstacles: MAP_OBSTACLES.escondite,
    palette: {
      pine: { trunk: 0x6b4a2c, leaf: 0x2f7a4a, highlight: 0xcfe8d0 },
      rock: 0x8a8f7a,
      crate: { box: 0xb08a54, bands: [0x6d4c2a, 0x9a7a3a, 0x4f7a4a] },
      cabin: { wall: 0x9a6a44, roof: 0x6d3f34, trim: 0xe8d8b0 },
      haystack: { body: 0xd9b45c, dark: 0xb08a3a },
      fence: { body: 0x8a6238 },
      well: { stone: 0x8f8f86, roof: 0x6d3f34 },
    },
  },

  tnt: {
    obstacles: MAP_OBSTACLES.tnt,
    palette: {},
  },
};

export const THEMES = {
  nevado: {
    sky: { top: 0x3f87c9, mid: 0x9fd4f2, horizon: 0xf2f8fd },
    fog: { color: 0xf2f8fd, near: 55, far: 150 },
    ground: {
      base: "#edf6fb",
      light: "rgba(255,255,255,0.9)",
      dark: "rgba(190,215,235,0.5)",
      repeat: 6,
      speckles: 2600,
      roughness: 0.95,
    },
    wall: 0x2f6ba8,
    wallTop: 0xf4f8fc,
    hemisphere: 0xdff3ff,
    particles: { color: 0xffffff, count: 420, size: 0.16 },
  },
  selva: {
    sky: { top: 0x2f9a86, mid: 0x9fe0c8, horizon: 0xeafbe8 },
    fog: { color: 0x9fe0c8, near: 70, far: 190 },
    ground: {
      base: "#2c5a34",
      light: "rgba(120,200,110,0.35)",
      dark: "rgba(25,60,35,0.45)",
      repeat: 5,
      speckles: 3200,
      roughness: 1,
    },
    wall: 0x2e5a3a,
    wallTop: 0x8fd977,
    hemisphere: 0xd5f5d0,
    particles: { color: 0xc8ffb0, count: 160, size: 0.12, opacity: 0.6 },
  },
  desierto: {
    sky: { top: 0xe8894a, mid: 0xf7c878, horizon: 0xffefd0 },
    fog: { color: 0xf2c98d, near: 80, far: 200 },
    ground: {
      base: "#e8c97a",
      light: "rgba(255,240,200,0.5)",
      dark: "rgba(200,160,90,0.35)",
      repeat: 5,
      speckles: 2400,
      roughness: 1,
    },
    wall: 0xa97c43,
    wallTop: 0xf2d39a,
    hemisphere: 0xffe3b0,
    particles: null,
  },
  volcan: {
    sky: { top: 0x3b1216, mid: 0x7d2a1f, horizon: 0xc96a2e },
    fog: { color: 0x4a1a16, near: 60, far: 170 },
    ground: {
      base: "#2a2420",
      light: "rgba(120,80,60,0.4)",
      dark: "rgba(10,8,8,0.6)",
      repeat: 5,
      speckles: 2200,
      roughness: 1,
    },
    wall: 0x3a3a44,
    wallTop: 0x6a4a3f,
    hemisphere: 0xc98a7a,
    particles: { color: 0xff8c3a, count: 200, size: 0.2, opacity: 0.7 },
  },
  pradera: {
    sky: { top: 0x4fafe6, mid: 0xbfe6ff, horizon: 0xeffcff },
    fog: { color: 0xbfe6ff, near: 70, far: 200 },
    ground: {
      base: "#7ec850",
      light: "rgba(220,255,190,0.4)",
      dark: "rgba(60,130,50,0.35)",
      repeat: 5,
      speckles: 3000,
      roughness: 1,
    },
    wall: 0x5a9e3f,
    wallTop: 0xd9f0a8,
    hemisphere: 0xe2f7e0,
    particles: { color: 0xffb0d8, count: 120, size: 0.1, opacity: 0.55 },
  },
  ciudad: {
    sky: { top: 0x0b1230, mid: 0x3a2a6b, horizon: 0x8a4f9f },
    fog: { color: 0x241a45, near: 65, far: 175 },
    ground: {
      base: "#181c2e",
      light: "rgba(120,140,220,0.25)",
      dark: "rgba(0,0,10,0.5)",
      repeat: 4,
      speckles: 1800,
      grid: true,
      roughness: 0.8,
      metalness: 0.2,
    },
    wall: 0x303a5c,
    wallTop: 0x69e6ff,
    hemisphere: 0x8f96c9,
    particles: { color: 0x69e6ff, count: 130, size: 0.12, opacity: 0.7 },
  },

  cordillera: {
    sky: { top: 0x2f5d9e, mid: 0x9fc4ee, horizon: 0xf2f8fd },
    fog: { color: 0xcfdff2, near: 90, far: 420 },
    ground: {
      base: "#cddcee",
      light: "rgba(255,255,255,0.8)",
      dark: "rgba(150,175,205,0.4)",
      repeat: 6,
      speckles: 0,
      roughness: 0.96,
    },
    wall: 0x2a4a6e,
    wallTop: 0xeef6fd,
    hemisphere: 0xdff3ff,
    particles: { color: 0xffffff, count: 700, size: 0.16, opacity: 0.75 },
  },

  gruta: {
    sky: { top: 0x0a0e24, mid: 0x1c2a52, horizon: 0x3a5f9c },
    fog: { color: 0x141a38, near: 50, far: 170 },
    ground: {
      base: "#171f36",
      light: "rgba(110,150,220,0.14)",
      dark: "rgba(5,8,20,0.55)",
      repeat: 4,
      speckles: 2400,
      roughness: 1,
    },
    wall: 0x232c48,
    wallTop: 0x5ae3ff,
    hemisphere: 0x6a7bb8,
    ambient: { color: 0x4a5f96, intensity: 0.4 },
    sun: { color: 0x9fb8e8, intensity: 0.55 },
    particles: { color: 0x7fffe0, count: 260, size: 0.12, opacity: 0.75, rise: true, speed: 0.7 },
  },

  isla: {
    sky: { top: 0x1f8fd0, mid: 0x9fe6ff, horizon: 0xfff4d6 },
    fog: { color: 0xcdefff, near: 60, far: 165 },
    ground: {
      base: "#e8d7a8",
      light: "rgba(255,250,220,0.55)",
      dark: "rgba(170,140,90,0.35)",
      repeat: 5,
      speckles: 2200,
      roughness: 1,
    },
    wall: 0x1f6f8f,
    wallTop: 0x8ff0d8,
    hemisphere: 0xd8fff4,
    sun: { color: 0xfff2cf, intensity: 1.6 },
    particles: { color: 0xbdf7ff, count: 120, size: 0.1, opacity: 0.45, rise: true, speed: 0.5 },
  },

  pares: {
    sky: { top: 0x120c2a, mid: 0x2a1b52, horizon: 0x4b2f86 },
    fog: { color: 0x1b1238, near: 35, far: 115 },
    ground: {
      base: "#241a44",
      light: "rgba(150,120,255,0.22)",
      dark: "rgba(8,4,24,0.55)",
      repeat: 4,
      speckles: 1600,
      roughness: 0.85,
      grid: "rgba(125,211,252,0.25)",
    },
    wall: 0x2a2050,
    wallTop: 0x7dd3fc,
    hemisphere: 0x9f8cff,
    ambient: { color: 0x6f5fbf, intensity: 0.55 },
    sun: { color: 0xc9b8ff, intensity: 1.0 },
    particles: { color: 0x7dd3fc, count: 160, size: 0.1, opacity: 0.6, rise: true, speed: 0.4 },
  },

  coliseo: {
    sky: { top: 0x1a0d12, mid: 0x3c1822, horizon: 0x6b2a34 },
    fog: { color: 0x241016, near: 38, far: 120 },
    ground: {
      base: "#2a1d22",
      light: "rgba(248,113,113,0.22)",
      dark: "rgba(12,6,9,0.6)",
      repeat: 4,
      speckles: 1400,
      roughness: 0.9,
      grid: "rgba(248,113,113,0.18)",
    },
    wall: 0x3a2530,
    wallTop: 0xf87171,
    hemisphere: 0xd9a3a3,
    ambient: { color: 0x7a3f4a, intensity: 0.6 },
    sun: { color: 0xffd0c8, intensity: 1.1 },
    particles: { color: 0xffb4a8, count: 140, size: 0.1, opacity: 0.5, rise: true, speed: 0.35 },
  },

  escondite: {
    sky: { top: 0x2c4a63, mid: 0x8fb0b8, horizon: 0xffe0b0 },
    fog: { color: 0xd9e4d8, near: 48, far: 135 },
    ground: {
      base: "#4d6b3f",
      light: "rgba(190,220,150,0.35)",
      dark: "rgba(30,50,25,0.45)",
      repeat: 5,
      speckles: 2600,
      roughness: 1,
    },
    wall: 0x4a5a3a,
    wallTop: 0xd9b45c,
    hemisphere: 0xd8ecc8,
    ambient: { color: 0x6a7a5a, intensity: 0.55 },
    sun: { color: 0xffe6b8, intensity: 1.35 },
    particles: { color: 0xffe9a8, count: 140, size: 0.1, opacity: 0.5, rise: true, speed: 0.3 },
  },

  tnt: {
    sky: { top: 0x120c1c, mid: 0x4a1f18, horizon: 0xd45a24 },
    fog: { color: 0x2a1420, near: 34, far: 115 },
    ground: {
      base: "#3a2020",
      light: "rgba(255,150,90,0.25)",
      dark: "rgba(20,8,14,0.5)",
      repeat: 4,
      speckles: 800,
      roughness: 1,
    },
    wall: 0x4a2b22,
    wallTop: 0xfb923c,
    hemisphere: 0xffb27a,
    ambient: { color: 0x5a2b22, intensity: 0.5 },
    sun: { color: 0xffd2a1, intensity: 1.25 },
    particles: { color: 0xffa54a, count: 160, size: 0.12, opacity: 0.65, rise: true, speed: 0.5 },
  },

  karts: {
    sky: { top: 0x14213d, mid: 0x36506e, horizon: 0x94a8bd },
    fog: { color: 0x9fb0c4, near: 90, far: 340 },
    ground: {
      base: "#4b5563",
      light: "rgba(255,255,255,0.12)",
      dark: "rgba(15,23,42,0.4)",
      repeat: 12,
      speckles: 900,
      roughness: 0.95,
      grid: "rgba(148,163,184,0.16)",
    },
    wall: 0x273449,
    wallTop: 0xf472b6,
    hemisphere: 0xcbd5e1,
    ambient: { color: 0x93a4bd, intensity: 0.65 },
    sun: { color: 0xfff2d6, intensity: 1.35 },
    particles: { color: 0xfbcfe8, count: 90, size: 0.09, opacity: 0.35 },
  },
};

function renderObstacle(o, mapId) {
  const def = MAP_DEFS[mapId] || MAP_DEFS.nevado;
  const palette = def.palette;
  switch (o.kind) {
    case "pine":
      return pineTree(palette.pine, 0.9 + Math.random() * 0.3);
    case "leaf":
      return leafTree(palette.leaf, 0.9 + Math.random() * 0.35);
    case "cactus":
      return cactus(palette.cactus, 0.9 + Math.random() * 0.25);
    case "rock":
      return rockMesh(o.r, palette.rock);
    case "crate":
      return crate(o, palette.crate);
    case "igl": {
      const g = iglooGroup(o.w, o.d);
      g.rotation.y = Math.random() * Math.PI;
      return g;
    }
    case "pillar":
      return pillar(o, palette.pillar);
    case "stalagmite":
      return stalagmite(palette.stalagmite);
    case "shroom":
      return shroom(palette.shroom);
    case "building":
      return buildingMesh(o, palette.building);
    case "ruin":
      return ruinMesh(o, palette.ruin);
    case "monolith":
      return monolith(palette.pillar || {});
    case "monument":
      return monument();
    case "cabin":
      return cabinMesh(o, palette.cabin || {});
    case "haystack":
      return haystackMesh(o, palette.haystack || {});
    case "fence":
      return fenceMesh(o, palette.fence || {});
    case "well":
      return wellMesh(o, palette.well || {});
    default:
      return null;
  }
}

function populate(scene, mapId) {
  const def = MAP_DEFS[mapId] || MAP_DEFS.nevado;
  // En la cordillera la escena procedural la añade createWorld aparte, así que
  // aquí solo entran sus props editables; el resto de mapas (incluidos los que
  // crean los jugadores) entran completos.
  const obstacles = mapId === "cordillera" ? def.obstacles || [] : getMapObstacles(mapId) || [];
  const groupInst = makeSceneryGroup(obstacles, mapId);
  if (groupInst.children.length > 0) {
    scene.add(groupInst);
  }
  const relief = isTerrainMap(mapId);
  for (const obstacle of obstacles) {
    const kind = obstacle.kind;
    if (kind === "pine" || kind === "leaf" || kind === "cactus" || kind === "rock" || kind === "crate") {
      continue;
    }
    const mesh = renderObstacle(obstacle, mapId);
    if (!mesh) continue;
    const gy = relief ? cordilleraHeight(obstacle.x, obstacle.z, getMapBoundary(mapId)) : 0;
    mesh.position.set(obstacle.x, gy, obstacle.z);
    // El tuner de mapas necesita saber qué obstáculo representa cada malla.
    mesh.userData.obstacle = obstacle;
    scene.add(mesh);
  }
}

// ---------------------------------------------------------------- escena de cordillera (instanciada)

const CORD_Y_AXIS = new THREE.Vector3(0, 1, 0);

function makeCordilleraScenery() {
  const list = makeCordilleraObstacles();
  const group = new THREE.Group();
  const m4 = new THREE.Matrix4();
  const vPos = new THREE.Vector3();
  const vScale = new THREE.Vector3();
  const qYaw = new THREE.Quaternion();

  function put(x, y, z, sx, sy, sz, yaw = 0) {
    qYaw.setFromAxisAngle(CORD_Y_AXIS, yaw);
    vPos.set(x, y, z);
    vScale.set(sx, sy, sz);
    m4.compose(vPos, qYaw, vScale);
    return m4;
  }

  function addInst(geometry, material, count, fill) {
    const inst = new THREE.InstancedMesh(geometry, material, count);
    inst.castShadow = true;
    for (let i = 0; i < count; i++) fill(inst, i);
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
    return inst;
  }

  const byKind = (kind) => list.filter((o) => o.kind === kind);
  const gy = (o) => cordilleraHeight(o.x, o.z, 300);
  const yawOf = (o) => (Math.abs(o.x * 12.9898) + Math.abs(o.z * 78.233)) % 6.2832;

  const pines = byKind("pine");
  if (pines.length) {
    const trunk = new THREE.CylinderGeometry(0.22, 0.3, 1.8, 8);
    trunk.translate(0, 0.9, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4526, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e6b45, roughness: 0.85 });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4fafe, roughness: 0.9 });
    const layers = [
      { y: 1.9, r: 1.0 },
      { y: 2.6, r: 0.78 },
      { y: 3.2, r: 0.55 },
    ];
    const pineScale = (o) => 0.75 + (o.r - 0.9) * 1.2;
    addInst(trunk, trunkMat, pines.length, (inst, i) => {
      const o = pines[i];
      const s = pineScale(o);
      inst.setMatrixAt(i, put(o.x, gy(o), o.z, s, s, s, yawOf(o)));
    });
    for (const layer of layers) {
      const cone = new THREE.ConeGeometry(layer.r, 1.0, 10);
      cone.translate(0, layer.y, 0);
      const snow = new THREE.ConeGeometry(layer.r * 0.95, 0.28, 10);
      snow.translate(0, layer.y + 0.45, 0);
      addInst(cone, leafMat, pines.length, (inst, i) => {
        const o = pines[i];
        const s = pineScale(o);
        inst.setMatrixAt(i, put(o.x, gy(o), o.z, s, s, s, yawOf(o)));
      });
      addInst(snow, snowMat, pines.length, (inst, i) => {
        const o = pines[i];
        const s = pineScale(o);
        inst.setMatrixAt(i, put(o.x, gy(o), o.z, s, s, s, yawOf(o)));
      });
    }
  }

  const rocks = byKind("rock");
  if (rocks.length) {
    const rockGeom = new THREE.SphereGeometry(1, 8, 6);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8d99a6, roughness: 1 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    addInst(rockGeom, rockMat, rocks.length, (inst, i) => {
      const o = rocks[i];
      inst.setMatrixAt(i, put(o.x, gy(o) + o.r * 0.6, o.z, o.r, o.r * 0.7, o.r));
    });
    addInst(rockGeom, capMat, rocks.length, (inst, i) => {
      const o = rocks[i];
      inst.setMatrixAt(i, put(o.x + o.r * 0.25, gy(o) + o.r * 0.95, o.z - o.r * 0.15, o.r * 0.7, o.r * 0.42, o.r * 0.7));
    });
  }

  const crates = byKind("crate");
  if (crates.length) {
    const boxGeom = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xdfe8f1, roughness: 0.6 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const bandColors = [0x3f8f6c, 0x4688c9, 0xe07a3a, 0x9a5bb8, 0xd34f5f];
    addInst(boxGeom, boxMat, crates.length, (inst, i) => {
      const o = crates[i];
      inst.setMatrixAt(i, put(o.x, gy(o) + o.w / 2, o.z, o.w, o.w, o.d));
    });
    for (const by of [0.35, 0.7]) {
      const inst = addInst(boxGeom, bandMat, crates.length, (inst, i) => {
        const o = crates[i];
        inst.setMatrixAt(i, put(o.x, gy(o) + o.w * by, o.z, o.w + 0.02, 0.3, o.d + 0.02));
      });
      crates.forEach((o, i) => {
        inst.setColorAt(i, new THREE.Color(bandColors[Math.abs(o.x + o.z) % bandColors.length]));
      });
    }
  }

  const pillars = byKind("pillar");
  if (pillars.length) {
    const bodyGeom = new THREE.CylinderGeometry(1, 1, 1, 10);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcfd9e8, roughness: 0.9 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x9fd8ff, emissiveIntensity: 1.1 });
    addInst(bodyGeom, bodyMat, pillars.length, (inst, i) => {
      const o = pillars[i];
      const h = o.h || 3.5;
      inst.setMatrixAt(i, put(o.x, gy(o) + h / 2, o.z, o.r, h, o.r));
    });
    const glowGeom = new THREE.SphereGeometry(1, 10, 8);
    addInst(glowGeom, glowMat, pillars.length, (inst, i) => {
      const o = pillars[i];
      const h = o.h || 3.5;
      const r = o.r * 0.7;
      inst.setMatrixAt(i, put(o.x, gy(o) + h + 0.1, o.z, r, r, r));
    });
  }

  const igloos = byKind("igl");
  if (igloos.length) {
    const baseGeom = new THREE.BoxGeometry(1, 1, 1);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xdff1fa, roughness: 0.85 });
    const domeGeom = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xbfe0f2, roughness: 0.8 });
    const doorGeom = new THREE.CylinderGeometry(0.5, 0.65, 1.6, 12, 1, false, Math.PI, Math.PI);
    doorGeom.rotateX(Math.PI);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x24485e });
    const winGeom = new THREE.CircleGeometry(0.42, 12);
    const winMat = new THREE.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffc45e, emissiveIntensity: 0.35 });

    addInst(baseGeom, baseMat, igloos.length, (inst, i) => {
      const o = igloos[i];
      inst.setMatrixAt(i, put(o.x, gy(o) + 1.6, o.z, o.w, 3.2, o.d));
    });
    addInst(domeGeom, domeMat, igloos.length, (inst, i) => {
      const o = igloos[i];
      const s = Math.max(o.w, o.d) * 0.55;
      inst.setMatrixAt(i, put(o.x, gy(o) + 3.2, o.z, s, s, s));
    });
    const doorInst = addInst(doorGeom, doorMat, igloos.length, (inst, i) => {
      const o = igloos[i];
      inst.setMatrixAt(i, put(o.x, gy(o) + 0.8, o.z + o.d / 2 + 0.1, 1, 1, 1));
    });
    doorInst.castShadow = false;
    const winInst = new THREE.InstancedMesh(winGeom, winMat, igloos.length * 2);
    let wi = 0;
    igloos.forEach((o, i) => {
      for (const sx of [-1, 1]) {
        winInst.setMatrixAt(wi++, put(o.x + sx * (o.w / 4), gy(o) + 2.2, o.z + o.d / 2 + 0.08, 1, 1, 1));
      }
    });
    winInst.instanceMatrix.needsUpdate = true;
    winInst.computeBoundingSphere();
    group.add(winInst);
  }

  return group;
}

// ---------------------------------------------------------------- escena genérica instanciada (para mapas planos)

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function makeSceneryGroup(obstacles, mapId) {
  const list = obstacles || [];
  const group = new THREE.Group();
  const m4 = new THREE.Matrix4();
  const vPos = new THREE.Vector3();
  const vScale = new THREE.Vector3();
  const qYaw = new THREE.Quaternion();

  const relief = isTerrainMap(mapId);
  const boundary = getMapBoundary(mapId);
  const gy = (o) => (relief ? cordilleraHeight(o.x, o.z, boundary) : 0);
  const yawOf = (o) => (Math.abs((o.x || 0) * 12.9898) + Math.abs((o.z || 0) * 78.233)) % 6.2832;
  // Escala determinista por obstáculo: todas las piezas de un mismo objeto deben
  // compartir escala o las piezas quedan flotando/desalineadas.
  const scaleCache = new Map();
  const scaleOf = (o, base, spread) => {
    const key = o;
    let s = scaleCache.get(key);
    if (s === undefined) {
      s = base * (1 - spread + (((yawOf(o) * 7.3) % 1) * spread * 2));
      scaleCache.set(key, s);
    }
    return s;
  };

  function put(x, y, z, sx, sy, sz, yaw = 0) {
    qYaw.setFromAxisAngle(Y_AXIS, yaw);
    vPos.set(x, y, z);
    vScale.set(sx, sy, sz);
    m4.compose(vPos, qYaw, vScale);
    return m4;
  }

  // Lista de obstáculos del bloque en curso: sirve para que el tuner de mapas
  // pueda saber qué obstáculo representa cada InstancedMesh.
  let currentList = [];

  function addInst(geometry, material, count, fill, noShadow = false) {
    if (count <= 0) return null;
    const inst = new THREE.InstancedMesh(geometry, material, count);
    inst.castShadow = !noShadow;
    inst.receiveShadow = true;
    inst.userData.obstacles = currentList;
    for (let i = 0; i < count; i++) fill(inst, i);
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
    return inst;
  }

  const byKind = (kind) => {
    currentList = list.filter((o) => o.kind === kind);
    return currentList;
  };
  const def = MAP_DEFS[mapId] || MAP_DEFS.nevado;
  const palette = def.palette || {};

  // Pines
  const pines = byKind("pine");
  if (pines.length) {
    const trunk = new THREE.CylinderGeometry(0.22, 0.3, 1.8, 8);
    trunk.translate(0, 0.9, 0);
    const p = palette.pine || {};
    const trunkMat = new THREE.MeshStandardMaterial({ color: p.trunk || 0x6a4526, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: p.leaf || 0x2e6b45, roughness: 0.85 });
    const snowMat = new THREE.MeshStandardMaterial({ color: p.highlight || 0xf4fafe, roughness: 0.9 });
    const layers = [
      { y: 1.9, r: 1.0 },
      { y: 2.6, r: 0.78 },
      { y: 3.2, r: 0.55 },
    ];
    const pineScale = (o) => scaleOf(o, 0.9 + ((o.r || 0.9) - 0.9) * 0.3, 0.1);
    addInst(trunk, trunkMat, pines.length, (inst, i) => {
      const o = pines[i];
      const s = pineScale(o);
      inst.setMatrixAt(i, put(o.x, gy(o), o.z, s, s, s, yawOf(o)));
    });
    for (const layer of layers) {
      const cone = new THREE.ConeGeometry(layer.r, 1.0, 10);
      cone.translate(0, layer.y, 0);
      const snow = new THREE.ConeGeometry(layer.r * 0.95, 0.28, 10);
      snow.translate(0, layer.y + 0.45, 0);
      addInst(cone, leafMat, pines.length, (inst, i) => {
        const o = pines[i];
        const s = pineScale(o);
        inst.setMatrixAt(i, put(o.x, gy(o), o.z, s, s, s, yawOf(o)));
      });
      addInst(snow, snowMat, pines.length, (inst, i) => {
        const o = pines[i];
        const s = pineScale(o);
        inst.setMatrixAt(i, put(o.x, gy(o), o.z, s, s, s, yawOf(o)));
      });
    }
  }

  // Leaves
  const leaves = byKind("leaf");
  if (leaves.length) {
    const lp = palette.leaf || {};
    const trunk = new THREE.CylinderGeometry(0.18, 0.26, 1.6, 8);
    trunk.translate(0, 0.8, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: lp.trunk || 0x5a3420, roughness: 1 });
    const leafScale = (o) => scaleOf(o, 0.9, 0.15);
    addInst(trunk, trunkMat, leaves.length, (inst, i) => {
      const o = leaves[i];
      const s = leafScale(o);
      inst.setMatrixAt(i, put(o.x, gy(o), o.z, s, s, s, yawOf(o)));
    });
    const shades = lp.shades || [0x2e8b57, 0x3aa868, 0x55c98a];
    const blobs = [
      { y: 1.7, r: 0.85 },
      { y: 2.25, r: 0.65 },
      { y: 2.75, r: 0.42 },
    ];
    blobs.forEach((b, bi) => {
      const g = new THREE.SphereGeometry(b.r, 12, 10);
      g.translate(0, b.y, 0);
      const m = new THREE.MeshStandardMaterial({ color: shades[bi % shades.length], roughness: 0.9 });
      addInst(g, m, leaves.length, (inst, i) => {
        const o = leaves[i];
        const s = leafScale(o);
        inst.setMatrixAt(i, put(o.x, gy(o), o.z, s, s, s, yawOf(o)));
      });
    });
  }

  // Cactus
  const cact = byKind("cactus");
  if (cact.length) {
    const cp = palette.cactus || {};
    const mat = new THREE.MeshStandardMaterial({ color: cp.body || 0x7fb56a, roughness: 0.9 });
    const cactusScale = (o) => scaleOf(o, 0.9, 0.18);
    const body = new THREE.CylinderGeometry(0.22, 0.28, 2.4, 9);
    body.translate(0, 1.2, 0);
    addInst(body, mat, cact.length, (inst, i) => {
      const o = cact[i];
      const s = cactusScale(o);
      inst.setMatrixAt(i, put(o.x, gy(o), o.z, s, s, s, yawOf(o)));
    });
    // Brazos: geometría pre-posicionada por lado (evita espejar con escala negativa,
    // que invertiría el winding y rompería las normales).
    for (const sx of [-1, 1]) {
      const arm = new THREE.CylinderGeometry(0.12, 0.14, 1.1, 8);
      arm.rotateZ(sx * -0.55);
      arm.translate(sx * 0.32, 1.85, 0);
      const tip = new THREE.SphereGeometry(0.13, 7, 7);
      tip.translate(sx * 0.62, 2.42, 0);
      addInst(arm, mat, cact.length, (inst, i) => {
        const o = cact[i];
        const s = cactusScale(o);
        inst.setMatrixAt(i, put(o.x, gy(o), o.z, s, s, s, yawOf(o)));
      });
      addInst(tip, mat, cact.length, (inst, i) => {
        const o = cact[i];
        const s = cactusScale(o);
        inst.setMatrixAt(i, put(o.x, gy(o), o.z, s, s, s, yawOf(o)));
      });
    }
  }

  // Rocks
  const rocks = byKind("rock");
  if (rocks.length) {
    const rp = palette.rock || 0x8d99a6;
    const rockGeom = new THREE.SphereGeometry(1, 8, 6);
    const rockMat = new THREE.MeshStandardMaterial({ color: rp, roughness: 1 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    const rockScale = (o) => scaleOf(o, 1, 0.12);
    addInst(rockGeom, rockMat, rocks.length, (inst, i) => {
      const o = rocks[i];
      const r = (o.r || 1) * rockScale(o);
      inst.setMatrixAt(i, put(o.x, gy(o) + r * 0.6, o.z, r, r * 0.7, r, yawOf(o)));
    });
    addInst(rockGeom, capMat, rocks.length, (inst, i) => {
      const o = rocks[i];
      const r = (o.r || 1) * rockScale(o);
      inst.setMatrixAt(
        i,
        put(o.x + r * 0.25, gy(o) + r * 0.95, o.z - r * 0.15, r * 0.7, r * 0.42, r * 0.7, yawOf(o))
      );
    });
  }

  // Crates (ligeros)
  const crates = byKind("crate");
  if (crates.length) {
    const cp = palette.crate || {};
    const boxGeom = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.MeshStandardMaterial({ color: cp.box || 0xdfe8f1, roughness: 0.6 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const bands = cp.bands || [0x3f8f6c, 0x4688c9, 0xe07a3a, 0x9a5bb8, 0xd34f5f];
    addInst(boxGeom, boxMat, crates.length, (inst, i) => {
      const o = crates[i];
      const w = o.w || 1;
      const d = o.d || w;
      inst.setMatrixAt(i, put(o.x, gy(o) + w / 2, o.z, w, w, d, yawOf(o)));
    });
    const bandInst = addInst(boxGeom, bandMat, crates.length * 2, (inst, i) => {
      const o = crates[Math.floor(i / 2)];
      const w = o.w || 1;
      const d = o.d || w;
      const by = i % 2 === 0 ? 0.35 : 0.7;
      inst.setMatrixAt(i, put(o.x, gy(o) + w * by, o.z, w + 0.02, 0.3, d + 0.02, yawOf(o)));
    });
    if (bandInst) {
      for (let i = 0; i < crates.length * 2; i++) {
        const o = crates[Math.floor(i / 2)];
        const c = bands[Math.abs(Math.floor(o.x + o.z + i)) % bands.length];
        bandInst.setColorAt(i, new THREE.Color(c));
      }
      bandInst.instanceColor.needsUpdate = true;
    }
  }

  return group;
}

// ---------------------------------------------------------------- cobertura vegetal instanciada (visual)

// Fusión manual de geometrías no indexadas (atributos position/normal/uv comunes).
// Existe para no depender de BufferGeometryUtils: los addons de examples/jsm no se sirven.
function mergeGeometries(list) {
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv"]) {
    const itemSize = name === "uv" ? 2 : 3;
    let total = 0;
    for (const g of list) total += g.attributes[name].array.length;
    const merged = new Float32Array(total);
    let offset = 0;
    for (const g of list) {
      merged.set(g.attributes[name].array, offset);
      offset += g.attributes[name].array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(merged, itemSize));
  }
  return out;
}

// Matas de hierba, guijarros y flores repartidos por el mapa. Son SOLO decoración:
// no se registran en getMapObstacles(), así que no afectan colisiones ni minimapa,
// y su altura se mantiene baja para no estorbar la lectura de jugadores.
export const GROUND_COVER = {
  nevado: {
    seed: 4101,
    keepOut: [{ x: 0, z: 0, r: 18.5 }], // pista de hockey
    tufts: 150,
    pebbles: 70,
    flowers: 0,
    tuftColor: [0xdfe9f2, 0xcfdde9],
    pebbleColor: 0xa8bccd,
  },
  selva: {
    seed: 4102,
    keepOut: [],
    tufts: 320,
    pebbles: 90,
    flowers: 60,
    tuftColor: [0x2f8f4a, 0x3aa05a, 0x2a7a40],
    pebbleColor: 0x6f8f6a,
  },
  desierto: {
    seed: 4103,
    keepOut: [],
    tufts: 90,
    pebbles: 190,
    flowers: 0,
    tuftColor: [0xc9a869, 0xb89a5c],
    pebbleColor: 0xc8a165,
  },
  volcan: {
    seed: 4104,
    keepOut: [],
    tufts: 40,
    pebbles: 200,
    flowers: 0,
    tuftColor: [0x6b4a3a, 0x57402f],
    pebbleColor: 0x4a4038,
  },
  pradera: {
    seed: 4105,
    keepOut: [],
    tufts: 340,
    pebbles: 60,
    flowers: 140,
    tuftColor: [0x62b03f, 0x74c451, 0x549a37],
    pebbleColor: 0x9aa5a0,
  },
  ciudad: {
    seed: 4106,
    keepOut: [],
    tufts: 0,
    pebbles: 110,
    flowers: 0,
    tuftColor: [0x3a4468],
    pebbleColor: 0x39415f,
  },
  cordillera: {
    seed: 4107,
    keepOut: [],
    tufts: 900,
    pebbles: 420,
    flowers: 0,
    tuftColor: [0xdfe9f2, 0xcfdde9, 0xe8f2f8],
    pebbleColor: 0x9aa6b0,
  },
  gruta: {
    seed: 4108,
    keepOut: [{ x: 0, z: 0, r: 4 }],
    tufts: 70,
    pebbles: 170,
    flowers: 0,
    tuftColor: [0x3f6f6a, 0x356059],
    pebbleColor: 0x5a6277,
  },
  isla: {
    seed: 4109,
    keepOut: [{ x: 0, z: 0, r: 4.2 }],
    tufts: 190,
    pebbles: 90,
    flowers: 46,
    tuftColor: [0x5aa85a, 0x76bf6a, 0x8fd07a],
    pebbleColor: 0xd9c79a,
  },
  escondite: {
    seed: 4110,
    keepOut: [
      { x: 0, z: 0, r: HIDE_CAGE_RADIUS + 0.6 },
      ...HIDE_SPOTS.map((spot) => ({ x: spot.x, z: spot.z, r: 1.6 })),
    ],
    tufts: 260,
    pebbles: 80,
    flowers: 30,
    tuftColor: [0x5aa85a, 0x76bf6a, 0x8fd07a],
    pebbleColor: 0xb8ad8a,
  },
};

function makeGroundCover(scene, mapId, boundary) {
  const cfg = GROUND_COVER[mapId];
  if (!cfg) return;

  const rng = mulberry32(cfg.seed);
  const obstacles = getMapObstacles(mapId) || [];
  const isRelief = isTerrainMap(mapId);
  const gy = (x, z) => (isRelief ? cordilleraHeight(x, z, boundary) : 0);
  const limit = boundary - 3;
  // Los recuentos de GROUND_COVER están pensados para 80 m. Al duplicar el área
  // de los mapas de sala se duplica también la vegetación para que no queden
  // claros vacíos. La cordillera ya tiene sus propios recuentos.
  const density = isRelief ? 1 : (boundary / 40) ** 2;

  // ¿La posición está libre? (fuera de zonas de juego y de obstáculos)
  const free = (x, z) => {
    if (Math.abs(x) > limit || Math.abs(z) > limit) return false;
    if (isRelief && gy(x, z) < 0.12) return false; // no sembrar en zonas inundadas
    for (const k of cfg.keepOut) {
      if (Math.hypot(x - k.x, z - k.z) < k.r) return false;
    }
    for (const o of obstacles) {
      const pad = o.type === "box" ? Math.max(o.w || 1, o.d || 1) * 0.5 : o.r || 1;
      const d = Math.hypot(x - o.x, z - o.z);
      if (d < pad + 0.7) return false;
    }
    return true;
  };

  function scatter(count, place) {
    const items = [];
    let guard = 0;
    while (items.length < count && guard < count * 25) {
      guard++;
      const x = (rng() - 0.5) * (boundary * 2 - 6);
      const z = (rng() - 0.5) * (boundary * 2 - 6);
      if (!free(x, z)) continue;
      items.push(place(x, z));
    }
    return items;
  }

  const group = new THREE.Group();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  function fillInst(geometry, material, items) {
    if (!items.length) return null;
    const inst = new THREE.InstancedMesh(geometry, material, items.length);
    inst.receiveShadow = true;
    items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.yaw);
      pos.set(it.x, gy(it.x, it.z), it.z);      scl.set(it.s, it.sy ?? it.s, it.s);
      m4.compose(pos, q, scl);
      inst.setMatrixAt(i, m4);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
    return inst;
  }

  // Matas de hierba: 3 hojas cruzadas por mata (silueta legible desde cualquier ángulo)
  if (cfg.tufts > 0) {
    const blades = [];
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.PlaneGeometry(0.46, 0.6, 1, 3);
      blade.translate(0, 0.3, 0);
      blade.rotateY((i / 3) * Math.PI);
      blade.rotateZ((i - 1) * 0.24);
      blades.push(blade.toNonIndexed());
      blade.dispose();
    }
    const merged = mergeGeometries(blades);
    blades.forEach((g) => g.dispose());
    const tuftItems = scatter(Math.round(cfg.tufts * density), (x, z) => ({
      x,
      z,
      s: 0.75 + rng() * 0.7,
      sy: 0.7 + rng() * 0.9,
      yaw: rng() * Math.PI * 2,
    }));
    const tuftMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      side: THREE.DoubleSide,
    });
    const tuftInst = fillInst(merged, tuftMat, tuftItems);
    if (tuftInst) {
      // La hierba no recibe sombras: son planos finos y el shadow map genera acne.
      tuftInst.receiveShadow = false;
    }
    if (tuftInst && cfg.tuftColor.length > 1) {
      const c = new THREE.Color();
      tuftItems.forEach((it, i) => {
        c.set(cfg.tuftColor[Math.floor(rng() * cfg.tuftColor.length)]);
        tuftInst.setColorAt(i, c);
      });
      tuftInst.instanceColor.needsUpdate = true;
    }
  }

  // Guijarros: icosaedros chatos y pintados con instanceColor
  if (cfg.pebbles > 0) {
    const pebbleGeom = new THREE.IcosahedronGeometry(0.18, 0);
    pebbleGeom.scale(1, 0.62, 1);
    const pebbleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    const pebbleItems = scatter(Math.round(cfg.pebbles * density), (x, z) => ({
      x,
      z,
      s: 0.6 + rng() * 1.5,
      yaw: rng() * Math.PI * 2,
    }));
    const pebbleInst = fillInst(pebbleGeom, pebbleMat, pebbleItems);
    if (pebbleInst) {
      const base = new THREE.Color(cfg.pebbleColor);
      const jittered = new THREE.Color();
      pebbleItems.forEach((it, i) => {
        jittered.copy(base).offsetHSL((rng() - 0.5) * 0.03, (rng() - 0.5) * 0.08, (rng() - 0.5) * 0.12);
        pebbleInst.setColorAt(i, jittered);
      });
      pebbleInst.instanceColor.needsUpdate = true;
    }
  }

  // Flores: tallo + sépalos planos (instancia única con vertexColors no hace falta:
  // el color va por instanceColor y el tallo comparte material).
  if (cfg.flowers > 0) {
    const petal = new THREE.CircleGeometry(0.16, 5);
    petal.rotateX(-Math.PI / 2);
    petal.translate(0, 0.42, 0);
    const stem = new THREE.CylinderGeometry(0.018, 0.026, 0.42, 5);
    stem.translate(0, 0.21, 0);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4f8f3a, roughness: 0.95 });
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, side: THREE.DoubleSide });
    const flowerItems = scatter(Math.round(cfg.flowers * density), (x, z) => ({
      x,
      z,
      s: 0.8 + rng() * 0.7,
      yaw: rng() * Math.PI * 2,
    }));
    fillInst(stem, stemMat, flowerItems);
    const petalInst = fillInst(petal, petalMat, flowerItems);
    if (petalInst) {
      const palette = [0xff5d8f, 0xffd166, 0xf472b6, 0xffffff, 0xbf80ff, 0xff9f1c];
      const c = new THREE.Color();
      flowerItems.forEach((it, i) => {
        c.set(palette[Math.floor(rng() * palette.length)]);
        petalInst.setColorAt(i, c);
      });
      petalInst.instanceColor.needsUpdate = true;
    }
  }

  if (group.children.length) scene.add(group);
}

// ---------------------------------------------------------------- portales de minijuegos

// Etiqueta flotante. Se dibuja en un canvas y se monta en un Sprite para que
// siempre mire a la cámara, sin importar desde dónde se acerque el jugador.
function makeLabelSprite(text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = "bold 56px 'Trebuchet MS', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 12;
  ctx.strokeStyle = "rgba(6, 12, 24, 0.85)";
  ctx.strokeText(text, 256, 66);
  ctx.fillStyle = color || "#ffffff";
  ctx.fillText(text, 256, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  sprite.scale.set(4.8, 1.2, 1);
  return sprite;
}

// Aro, haz de luz y etiqueta de un portal. El monolito (colisión) va aparte en
// MAP_OBSTACLES para que el servidor también lo conozca.
function makePortalGate(portal, { yaw = 0 } = {}) {
  const group = new THREE.Group();
  group.position.set(portal.x, 0, portal.z);
  group.rotation.y = yaw;

  const color = new THREE.Color(portal.color || "#7dd3fc");
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.5, 6.4, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  beam.position.y = 3.2;
  group.add(beam);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.35, 0.08, 8, 36),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.4,
      roughness: 0.3,
    })
  );
  ring.position.y = 2.1;
  group.add(ring);

  const label = makeLabelSprite(
    `${portal.icon || "🌀"} ${portal.short || portal.label || ""}`,
    portal.color
  );
  label.position.y = 4.15;
  group.add(label);

  return { group, ring };
}

// Isla: un portal por modalidad, orientado hacia el centro.
function makeHubPortals() {
  const group = new THREE.Group();
  const rings = [];
  for (const portal of HUB_PORTALS) {
    const mode = getMode(portal.modeId);
    const view = makePortalGate(
      {
        ...portal,
        short: mode ? mode.short : portal.label,
        color: mode ? mode.color : portal.color,
      },
      { yaw: -portal.angle + Math.PI / 2 }
    );
    group.add(view.group);
    rings.push(view.ring);

    if (!mode || mode.status !== "live") {
      const tag = makeLabelSprite("próximamente", "#c7d2fe");
      tag.scale.set(2.9, 0.72, 1);
      tag.position.y = 3.35;
      view.group.add(tag);
    }
  }

  return {
    group,
    update(t) {
      rings.forEach((ring, index) => {
        ring.rotation.z = t * 0.8 + index;
      });
    },
  };
}

// Lobby: puerta de entrada a la isla, al sur de la pista de hockey.
function makeLobbyPortal() {
  const view = makePortalGate({ ...LOBBY_PORTAL, short: "Minijuegos" }, { yaw: 0 });
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 32),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(LOBBY_PORTAL.color),
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.03;
  view.group.add(disc);
  return view;
}

function addFixedDecor(scene, mapId) {
  if (mapId !== "nevado") return;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const flag = makeFlag(angle);
    flag.position.set(Math.cos(angle) * 20.5, 0, Math.sin(angle) * 20.5);
    scene.add(flag);
  }

  const snowmen = [
    [-12, -19],
    [23, -16],
    [-26, 6],
    [30, 26],
    [-34, -24],
  ];
  snowmen.forEach(([x, z]) => {
    const m = makeSnowman();
    m.position.set(x, 0, z);
    m.rotation.y = Math.random() * Math.PI * 2;
    scene.add(m);
  });

  const lamps = [
    [-18, -8],
    [18, 12],
    [-10, 20],
    [26, -4],
  ];
  lamps.forEach(([x, z]) => {
    const lamp = makeLamp();
    lamp.position.set(x, 0, z);
    scene.add(lamp);
  });

  const penguins = [
    [-14, 6],
    [12, -20],
    [30, -18],
    [-30, 12],
    [8, 26],
    [-24, -2],
  ];
  penguins.forEach(([x, z]) => {
    const p = makePenguin();
    p.position.set(x, 0, z);
    scene.add(p);
  });

  const mountains = [
    [-120, -130, 52, 42],
    [130, -110, 46, 38],
    [-135, 125, 55, 44],
    [118, 138, 48, 40],
    [-60, 150, 38, 30],
    [150, 30, 44, 36],
    [40, -150, 40, 32],
  ];
  mountains.forEach(([x, z, h, r]) => {
    scene.add(makeMountain(x, z, h, r));
  });
}

function addExtraDecor(scene, mapId) {
  if (mapId === "selva") {
    const flowersPal = [0xff5d8f, 0xffd166, 0xf472b6, 0xffffff];
    const spots = [
      [-2, 2], [8, 10], [-14, -6], [24, -18], [-30, 6], [16, 30], [-24, 30], [36, -24],
    ];
    for (const [x, z] of spots) {
      for (let i = 0; i < 4; i++) {
        const f = flower(flowersPal);
        f.position.set(x + (Math.random() - 0.5) * 1.6, 0, z + (Math.random() - 0.5) * 1.6);
        f.rotation.y = Math.random() * Math.PI * 2;
        scene.add(f);
      }
    }
  } else if (mapId === "volcan") {
    const pools = [
      [18, -2], [-20, 4], [2, 24], [-2, -24], [32, -30], [-32, 30], [28, -16],
    ];
    for (const [x, z] of pools) {
      const pool = lavaPool(1.1 + Math.random() * 0.8);
      pool.position.set(x, 0, z);
      scene.add(pool);
    }
  } else if (mapId === "ciudad") {
    const spots = [
      [4, -2], [-4, 8], [18, 18], [-18, 8], [10, -10], [28, 2], [-28, -4], [2, -34],
    ];
    for (const [x, z] of spots) {
      scene.add(neonRing({ x, z, y: 1.3, r: 1.2, color: x % 2 ? 0x69e6ff : 0xff4dc8 }));
    }
  } else if (mapId === "pradera") {
    const flowersPal = [0xff9ff0, 0xffd166, 0xff6b6b, 0xffffff, 0xbf80ff];
    const spots = [
      [-2, 2], [8, 10], [-14, -6], [24, -18], [-30, 6], [16, 30], [-24, 30], [36, -24], [-8, 30],
    ];
    for (const [x, z] of spots) {
      for (let i = 0; i < 5; i++) {
        const f = flower(flowersPal);
        f.position.set(x + (Math.random() - 0.5) * 2, 0, z + (Math.random() - 0.5) * 2);
        f.rotation.y = Math.random() * Math.PI * 2;
        scene.add(f);
      }
    }
  } else if (mapId === "desierto") {
    const sandRocks = [
      [-8, 12], [14, 24], [-26, -12], [32, 20], [-34, -26], [26, -26],
    ];
    sandRocks.forEach(([x, z]) => {
      const m = rockMesh(0.7 + Math.random() * 0.6, 0xc8a165);
      m.position.set(x, 0, z);
      scene.add(m);
    });
  } else if (mapId === "gruta") {
    const pools = [
      [0, 0], [-18, 16], [22, -18], [-12, -26], [26, 24],
    ];
    for (const [x, z] of pools) {
      const size = 2.5 + Math.random() * 0.9;
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(size, 32),
        new THREE.MeshStandardMaterial({
          color: 0x1a6e63,
          emissive: 0x35d9b8,
          emissiveIntensity: 0.9,
          roughness: 0.3,
        })
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, 0.035, z);
      pool.receiveShadow = true;
      scene.add(pool);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(size * 1.05, size * 1.3, 32),
        new THREE.MeshBasicMaterial({ color: 0x5ae3ff, transparent: true, opacity: 0.35 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.05, z);
      scene.add(ring);
    }

    const glows = [
      { x: 0, z: 0, y: 4, color: 0x5ae3ff },
      { x: -18, z: 16, y: 2.5, color: 0x35d9b8 },
      { x: 22, z: -18, y: 2.5, color: 0xd98aff },
    ];
    glows.forEach((g) => {
      const light = new THREE.PointLight(g.color, 1.1, 20);
      light.position.set(g.x, g.y, g.z);
      scene.add(light);
    });

    scene.add(crystalCluster(0, 0, 1.6));
  }
}

let currentResizeHandler = null;

function addResizeListener(camera, renderer) {
  if (currentResizeHandler) removeEventListener("resize", currentResizeHandler);
  currentResizeHandler = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener("resize", currentResizeHandler);
}

// Instala temporalmente las definiciones que trae el tuner de mapas
// (public/debug/mapatune.html) para que createWorld construya un mapa nuevo o
// modificado SIN escribir en las tablas del juego. Devuelve una función que lo
// restaura todo.
function installMapOverrides(mapId, ov) {
  const undo = [];
  const put = (table, key, value) => {
    undo.push({ table, key, had: Object.prototype.hasOwnProperty.call(table, key), value: table[key] });
    table[key] = value;
  };
  if (ov.def) put(MAP_DEFS, mapId, ov.def);
  if (ov.theme) put(THEMES, mapId, ov.theme);
  if (ov.cover) put(GROUND_COVER, mapId, ov.cover);

  let entry = MAPS.find((m) => m.id === mapId);
  if (ov.size !== undefined || ov.name !== undefined || ov.room !== undefined) {
    if (!entry && ov.size !== undefined) {
      entry = { id: mapId, name: ov.name || mapId, room: ov.room !== false, size: ov.size };
      MAPS.push(entry);
      undo.push({ list: MAPS, index: MAPS.length - 1 });
    } else if (entry) {
      undo.push({ entry, size: entry.size, name: entry.name, room: entry.room });
      if (ov.size !== undefined) entry.size = ov.size;
      if (ov.name !== undefined) entry.name = ov.name;
      if (ov.room !== undefined) entry.room = ov.room;
    }
  }

  const hadTerrain = TERRAIN_IDS.has(mapId);
  if (ov.terrain === true) TERRAIN_IDS.add(mapId);
  else if (ov.terrain === false) TERRAIN_IDS.delete(mapId);

  return () => {
    for (const u of undo.reverse()) {
      if (u.list) u.list.splice(u.index, 1);
      else if (u.entry) { u.entry.size = u.size; u.entry.name = u.name; u.entry.room = u.room; }
      else if (u.had) u.table[u.key] = u.value;
      else delete u.table[u.key];
    }
    if (ov.terrain !== undefined) {
      if (hadTerrain) TERRAIN_IDS.add(mapId);
      else TERRAIN_IDS.delete(mapId);
    }
  };
}

export function createWorld(mapId = "nevado", existingRenderer = null, overrides = null) {
  const restore = overrides ? installMapOverrides(mapId, overrides) : null;
  try {
    return buildWorld(mapId, existingRenderer);
  } finally {
    if (restore) restore();
  }
}

function buildWorld(mapId = "nevado", existingRenderer = null) {
  const theme = THEMES[mapId] || THEMES.nevado;
  const boundary = getMapBoundary(mapId);
  const scene = new THREE.Scene();
  if (theme.fog && theme.fog.far) {
    scene.fog = new THREE.Fog(theme.fog.color, theme.fog.near, theme.fog.far);
  }

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 1600);

  let renderer = existingRenderer;
  if (!renderer) {
    try {
      if (!window.WebGL2RenderingContext) {
        throw new Error("WebGL2 no está disponible en este navegador");
      }
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (err) {
      throw new Error(
        "No se pudo inicializar el 3D (" + err.message + "). Activa la aceleración de hardware de tu navegador."
      );
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.className = "penguin-canvas";

    const canvas = renderer.domElement;
    canvas.addEventListener("webglcontextlost", (event) => event.preventDefault());
    canvas.addEventListener("webglcontextrestored", () => {
      renderer.shadowMap.enabled = true;
    });

    const container = document.getElementById("game");
    if (container && !container.contains(canvas)) {
      container.prepend(canvas);
    }
  }

  const amb = theme.ambient || { color: 0xcfe8ff, intensity: 0.55 };
  const ambient = new THREE.AmbientLight(amb.color, amb.intensity);
  const hemisphere = new THREE.HemisphereLight(theme.hemisphere || 0xdff3ff, 0x7fa0c0, theme.hemisphereIntensity ?? 0.8);
  const sunConf = theme.sun || { color: 0xfff4df, intensity: 1.5 };
  const sun = new THREE.DirectionalLight(sunConf.color, sunConf.intensity);
  // Los mapas de sala de 120 m necesitan un frustum de sombras mayor que el
  // recinto de 80 m, pero no tanto como la cordillera procedural.
  const bigMap = isTerrainMap(mapId) || boundary > 50;
  const shadowSpan = isTerrainMap(mapId) ? 220 : boundary > 50 ? 90 : 60;
  sun.position.set(bigMap ? 60 : 18, bigMap ? 90 : 30, bigMap ? 40 : 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(bigMap ? 2048 : 1024, bigMap ? 2048 : 1024);
  sun.shadow.camera.left = -shadowSpan;
  sun.shadow.camera.right = shadowSpan;
  sun.shadow.camera.top = shadowSpan;
  sun.shadow.camera.bottom = -shadowSpan;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = bigMap ? 500 : 120;
  sun.shadow.bias = -0.0004;
  scene.add(ambient, hemisphere, sun);

  scene.add(camera);

  const sky = makeSky(theme.sky, Math.max(220, boundary * 2.2));
  scene.add(sky);

  if (isTerrainMap(mapId)) {
    const { terrain, water } = makeTerrain(boundary);
    scene.add(terrain, water);
  } else if (mapId !== TNT_MAP_ID) {
    scene.add(makeGround(theme.ground, boundary, renderer.capabilities.getMaxAnisotropy()));
  }

  let tntArena = null;
  let kartsWorld = null;
  let coliseoArenaGroup = null;
  let activeColiseoVariantId = "1v1";
  if (mapId === "nevado") {
    scene.add(makeRink());
  } else if (mapId === "gruta") {
    scene.add(makeCave(boundary));
  } else if (mapId === COLISEO_MAP_ID) {
    coliseoArenaGroup = makeColiseoArena();
    scene.add(coliseoArenaGroup);
  } else if (mapId === HIDE_MAP_ID) {
    scene.add(makeHideVillage());
  } else if (mapId === TNT_MAP_ID) {
    // Sin suelo ni muros: la isla flotante es lo único que sostiene a los
    // jugadores y los bordes se juzgan con la rejilla del servidor.
    tntArena = makeTntArena();
    scene.add(tntArena.group);
  } else if (mapId === KARTS_MAP_ID) {
    // Paddock cubierto, pedestales, portales y la pista de 1.000 m.
    kartsWorld = makeKartsWorld();
    scene.add(kartsWorld.group);
  }

  const wallMaterial = new THREE.MeshStandardMaterial({ color: theme.wall, roughness: 0.55 });
  const wallTopMaterial = new THREE.MeshStandardMaterial({ color: theme.wallTop, roughness: 0.4 });
  const wallLong = new THREE.BoxGeometry(boundary * 2, 0.9, 0.35);
  const wallShort = new THREE.BoxGeometry(0.35, 0.9, boundary * 2);

  function addWall(x, z, geometry, rotationY) {
    const wall = new THREE.Mesh(geometry, wallMaterial);
    wall.position.set(x, 0.45, z);
    if (rotationY) wall.rotation.y = rotationY;
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);

    const cap = new THREE.Mesh(geometry, wallTopMaterial);
    cap.position.set(x, 0.9, z);
    if (rotationY) cap.rotation.y = rotationY;
    scene.add(cap);
  }
  // El Coliseo cierra su propio recinto circular: no lleva las cuatro paredes
  // cuadradas del resto de mapas.
  if (mapId !== COLISEO_MAP_ID && mapId !== TNT_MAP_ID && mapId !== KARTS_MAP_ID) {
    addWall(0, -boundary, wallLong, 0);
    addWall(0, boundary, wallLong, 0);
    addWall(-boundary, 0, wallShort, 0);
    addWall(boundary, 0, wallShort, 0);
  }

  if (mapId === "cordillera") {
    scene.add(makeCordilleraScenery());
  }
  populate(scene, mapId);
  addFixedDecor(scene, mapId);
  addExtraDecor(scene, mapId);
  makeGroundCover(scene, mapId, boundary);

  let portalUpdate = null;
  if (mapId === "isla") {
    const portals = makeHubPortals();
    scene.add(portals.group);
    portalUpdate = portals.update;
  } else if (mapId === "nevado") {
    const gate = makeLobbyPortal();
    scene.add(gate.group);
    portalUpdate = (t) => {
      gate.ring.rotation.z = t * 0.9;
    };
  }

  let particleUpdate = null;
  if (theme.particles) {
    const { points, update } = makeParticles(theme.particles, boundary);
    scene.add(points);
    particleUpdate = update;
  }

  addResizeListener(camera, renderer);

  let elapsed = 0;
  return {
    scene,
    camera,
    renderer,
    setTntState(snapshot) {
      if (tntArena) tntArena.setState(snapshot);
    },
    tntEvent(ev) {
      if (tntArena) tntArena.event(ev);
    },
    setKartsState(state) {
      if (kartsWorld) kartsWorld.setKartsState(state);
    },
    // Mallas de los pedestales: el cliente lanza un raycaster sobre ellas para
    // comprar/equipar haciendo clic en el kart 3D.
    get kartsPickables() {
      return kartsWorld ? kartsWorld.pickables : [];
    },
    // El 2v2 usa un anillo mayor: se escala la arena visible y se actualizan
    // los radios que comparten colisión y validación local.
    setColiseoVariant(variant) {
      activeColiseoVariantId = resolveColiseoVariant(variant).id;
      const radii = setActiveColiseoVariant(activeColiseoVariantId);
      if (!coliseoArenaGroup) return radii;
      const scale = radii.arena / COLISEO_ARENA_RADIUS;
      coliseoArenaGroup.scale.set(scale, 1, scale);
      return radii;
    },
    coliseoRadii() {
      return getColiseoRadii(activeColiseoVariantId);
    },
    update(dt) {
      elapsed += dt;
      if (particleUpdate) particleUpdate(dt);
      if (portalUpdate) portalUpdate(elapsed);
      if (tntArena) tntArena.update(dt);
      if (kartsWorld) kartsWorld.update(elapsed);
      if (isTerrainMap(mapId)) sky.position.copy(camera.position);
    },
  };
}