// Modelos 3D de los karts y de los pedestales de la tienda del paddock.
//
// Los kart se construyen con geometría primitiva para que la escena cargue sin
// assets externos. Todos apuntan hacia +Z (yaw 0) y miden ~3,2 m de largo, la
// misma escala que usa el controlador para la física. Cada malla del pedestal
// lleva `userData.kartId` para que el raycaster del cliente sepa qué kart se ha
// pulsado sin depender de un div superpuesto.

import * as THREE from "/vendor/three/three.module.js";
import { kartById } from "./kartsDefs.js";

function labelSprite(text, color = "#ffffff", width = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 52px 'Trebuchet MS', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(8, 10, 22, 0.9)";
  ctx.strokeText(text, width / 2, 66);
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  sprite.scale.set(6.4, 1.6, 1);
  return sprite;
}

function tagMeshes(root, kartId) {
  root.traverse((child) => {
    if (child.isMesh) child.userData.kartId = kartId;
  });
}

// Un kart completo: pan de suelo, chasis, carenados, alas, escape, cuatro
// ruedas con llanta y el pingüino conductor con casco y volante. Todo apunta a
// +Z (yaw 0) y mide ~3,2 m de largo, la misma escala que usa la física.
export function createKartModel(kartId, { scale = 1 } = {}) {
  const kart = kartById(kartId) || kartById("pingui_gt");
  const group = new THREE.Group();
  const bodyColor = new THREE.Color(kart.color);
  const accentColor = new THREE.Color(kart.accent);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.4,
    metalness: 0.18,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.38,
    metalness: 0.1,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c2436, roughness: 0.75 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x12151f, roughness: 0.95 });
  const hubMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.32,
    metalness: 0.45,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.2,
    metalness: 0.35,
  });
  const faceMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });

  function piece(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }

  // Chasis y pan: la silueta baja es lo que separa un kart de un pingüino de pie.
  piece(new THREE.BoxGeometry(1.8, 0.16, 2.95), darkMat, 0, 0.3, 0);
  piece(new THREE.BoxGeometry(1.95, 0.44, 2.35), bodyMat, 0, 0.58, -0.12);

  // Morro y ala delantera con endplates.
  const nose = piece(new THREE.ConeGeometry(0.62, 1.5, 4), bodyMat, 0, 0.54, 1.5);
  nose.rotation.x = Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  piece(new THREE.BoxGeometry(2.7, 0.1, 0.44), accentMat, 0, 0.34, 2.18);
  for (const side of [-1, 1]) {
    piece(new THREE.BoxGeometry(0.12, 0.42, 0.55), accentMat, side * 1.35, 0.46, 2.18);
  }

  // Faldones laterales, tomas de aire y carenado del motor.
  for (const side of [-1, 1]) {
    piece(new THREE.BoxGeometry(0.58, 0.32, 1.5), bodyMat, side * 1.08, 0.54, -0.15);
    piece(new THREE.BoxGeometry(0.12, 0.34, 1.5), accentMat, side * 1.4, 0.56, -0.15);
    const intake = piece(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 12), darkMat, side * 1.42, 0.66, 0.32);
    intake.rotation.z = Math.PI / 2;
  }
  piece(new THREE.BoxGeometry(0.95, 0.5, 0.9), bodyMat, 0, 0.96, -0.9);
  const cover = piece(new THREE.CylinderGeometry(0.34, 0.34, 0.95, 12), bodyMat, 0, 1.16, -0.95);
  cover.rotation.x = Math.PI / 2;
  const exhaust = piece(new THREE.CylinderGeometry(0.11, 0.14, 0.55, 10), darkMat, 0.28, 0.92, -1.45);
  exhaust.rotation.x = Math.PI / 2;

  // Alerón trasero y barra de seguridad por encima del asiento.
  piece(new THREE.BoxGeometry(2.45, 0.14, 0.55), accentMat, 0, 1.32, -1.58);
  for (const side of [-1, 1]) {
    piece(new THREE.BoxGeometry(0.12, 0.55, 0.12), darkMat, side * 0.92, 1.02, -1.58);
    piece(new THREE.BoxGeometry(0.1, 0.75, 0.1), darkMat, side * 0.42, 1.15, -0.55);
  }
  piece(new THREE.BoxGeometry(0.94, 0.1, 0.1), darkMat, 0, 1.52, -0.55);

  // Ruedas: cada grupo gira en su eje X, listo para animarlas con la velocidad.
  const wheels = [];
  for (const side of [-1, 1]) {
    for (const z of [-1.05, 1.1]) {
      const wheel = new THREE.Group();
      wheel.position.set(side * 1.2, 0.39, z);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.32, 16), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheel.add(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.34, 14), hubMat);
      hub.rotation.z = Math.PI / 2;
      wheel.add(hub);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 6, 14), accentMat);
      rim.rotation.y = Math.PI / 2;
      rim.position.x = side * 0.18;
      wheel.add(rim);
      group.add(wheel);
      wheels.push(wheel);
    }
  }
  group.userData.wheels = wheels;

  // Conductor sentado: asiento, cuerpo, cara, casco del color del kart,
  // visor, pico y volante. Se distingue del pingüino que va caminando.
  const seat = piece(new THREE.BoxGeometry(0.8, 0.62, 0.14), darkMat, 0, 0.82, -0.42);
  seat.rotation.x = -0.1;
  const torso = piece(
    new THREE.SphereGeometry(0.42, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0x25334d, roughness: 0.85 }),
    0,
    1.02,
    -0.04
  );
  torso.scale.set(0.9, 1.08, 0.82);
  piece(new THREE.SphereGeometry(0.3, 14, 12), faceMat, 0, 1.5, 0.06);
  piece(
    new THREE.SphereGeometry(0.35, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    accentMat,
    0,
    1.58,
    0.02
  );
  piece(new THREE.BoxGeometry(0.52, 0.12, 0.09), visorMat, 0, 1.5, 0.32);
  const beak = piece(
    new THREE.ConeGeometry(0.1, 0.24, 8),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.7 }),
    0,
    1.42,
    0.34
  );
  beak.rotation.x = Math.PI / 2;
  const steering = piece(new THREE.TorusGeometry(0.2, 0.04, 8, 16), darkMat, 0, 1.05, 0.32);
  steering.rotation.x = -0.55;

  group.scale.setScalar(scale);
  tagMeshes(group, kart.id);
  group.userData.kartId = kart.id;
  return group;
}

// Pedestal de la tienda: base cilíndrica, aro de estado y kart flotando encima.
export function createKartPedestal(kartId, position) {
  const kart = kartById(kartId) || kartById("pingui_gt");
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);
  group.rotation.y = position.yaw || 0;
  group.userData.kartId = kart.id;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.0, 2.25, 0.55, 24),
    new THREE.MeshStandardMaterial({ color: 0x2b3245, roughness: 0.65, metalness: 0.2 })
  );
  base.position.y = 0.275;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(1.95, 1.95, 0.08, 24),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(kart.color), roughness: 0.4 })
  );
  top.position.y = 0.59;
  group.add(top);

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xfacc15,
    emissiveIntensity: 0.9,
    roughness: 0.35,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.07, 8, 32), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.66;
  group.add(ring);

  const kartModel = createKartModel(kart.id, { scale: 0.85 });
  kartModel.position.y = 1.35;
  group.add(kartModel);

  const price = kart.price
    ? `${kart.name} · ${kart.price} pts`
    : `${kart.name} · inicial`;
  const label = labelSprite(price, kart.color);
  label.position.y = 3.15;
  group.add(label);

  tagMeshes(group, kart.id);

  function setState({ owned = false, equipped = false, affordable = false } = {}) {
    const color = equipped ? 0x4ade80 : owned ? 0x60a5fa : affordable ? 0xfacc15 : 0x64748b;
    ringMaterial.color.setHex(color);
    ringMaterial.emissive.setHex(color);
    ringMaterial.emissiveIntensity = equipped ? 1.6 : owned ? 1.0 : affordable ? 0.9 : 0.25;
  }

  return { group, ring, kartModel, setState };
}
