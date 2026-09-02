import * as THREE from "/vendor/three/three.module.js";

function makeNameLabel(name, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 38px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const text = name.toUpperCase();
  const textWidth = ctx.measureText(text).width + 30;
  const x = (256 - textWidth) / 2;
  const y = 12;
  const h = 40;

  ctx.fillStyle = "rgba(10, 12, 20, 0.65)";
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, textWidth, h, 10);
  } else {
    ctx.rect(x, y, textWidth, h);
  }
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
  ctx.lineWidth = 4;
  ctx.strokeText(text, 128, 32);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })
  );
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

export function createAvatar(name, color) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6, 4, 12), material);
  body.position.y = 0.75;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), material);
  head.position.y = 1.25;
  group.add(head);

  const label = makeNameLabel(name, color);
  label.position.y = 1.85;
  group.add(label);

  return group;
}