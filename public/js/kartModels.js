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

// Un kart completo: chasis, carenado, cuatro ruedas y el pingüino conductor.
export function createKartModel(kartId, { scale = 1 } = {}) {
  const kart = kartById(kartId) || kartById("pingui_gt");
  const group = new THREE.Group();
  const bodyColor = new THREE.Color(kart.color);
  const accentColor = new THREE.Color(kart.accent);

  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(2.15, 0.42, 3.0),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.42, metalness: 0.15 })
  );
  chassis.position.y = 0.55;
  chassis.castShadow = true;
  group.add(chassis);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.78, 1.25, 4),
    new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.4 })
  );
  nose.rotation.x = Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  nose.position.set(0, 0.53, 1.85);
  nose.castShadow = true;
  group.add(nose);

  const spoiler = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 0.14, 0.5),
    new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.45 })
  );
  spoiler.position.set(0, 1.05, -1.5);
  spoiler.castShadow = true;
  group.add(spoiler);
  for (const side of [-1, 1]) {
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.5, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x1c2436, roughness: 0.7 })
    );
    support.position.set(side * 0.9, 0.82, -1.5);
    group.add(support);
  }

  const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x141722, roughness: 0.95 });
  const hubMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.35,
    metalness: 0.4,
  });
  for (const side of [-1, 1]) {
    for (const z of [-1.05, 1.05]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.3, 14), tireMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 1.15, 0.37, z);
      wheel.castShadow = true;
      group.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.32, 12), hubMaterial);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(wheel.position);
      group.add(hub);
    }
  }

  // Conductor: cuerpo, cabeza, pico y ojos. Se ve desde la cámara en tercera
  // persona y es lo que distingue al kart del pingüino que va caminando.
  const driver = new THREE.Group();
  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(0.44, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x25334d, roughness: 0.85 })
  );
  belly.scale.set(0.9, 1.05, 0.8);
  belly.position.y = 1.18;
  driver.add(belly);
  const face = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 })
  );
  face.position.set(0, 1.62, 0.16);
  driver.add(face);
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.34, 8),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.7 })
  );
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.58, 0.48);
  driver.add(beak);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x0f172a })
    );
    eye.position.set(side * 0.12, 1.68, 0.42);
    driver.add(eye);
  }
  group.add(driver);

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
