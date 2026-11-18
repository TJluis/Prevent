import * as THREE from "/vendor/three/three.module.js";
import { getWeapon } from "./weaponDefs.js";
import { WEAPON_CLASSES } from "./weaponMath.js";
import { getTerrainHeightAt } from "./world.js";

const PICKUP_RANGE = 1.4;
const CRYSTAL_HEIGHT = 0.8;
const RE_ASK_MS = 1600;
const OFFER_TIMEOUT_MS = 8000;

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(190, 233, 255, 0.95)");
  grad.addColorStop(0.35, "rgba(104, 183, 233, 0.55)");
  grad.addColorStop(1, "rgba(104, 183, 233, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

const TYPE_STYLE = {
  weapon: { color: 0x68b7e9, emissive: 0x4f7e8b, glow: 0x68b7e9, light: 0x68b7e9, ring: 0x68b7e9 },
  food: { color: 0x7fe0a8, emissive: 0x3fba7a, glow: 0x58d391, light: 0x58d391, ring: 0x58d391 },
  throwable: { color: 0xffb066, emissive: 0xe8903a, glow: 0xff9e55, light: 0xff9e55, ring: 0xff9e55 },
};

export function createLoot({ getOwnPosition, onPickup, onRespond, hasWeapon, getMapId }) {
  let scene = null;
  let enabled = true;
  const crystals = new Map();
  const suppressed = new Map();
  const glowTexture = makeGlowTexture();
  let pendingOfferId = null;
  let offerAt = 0;
  let lastAskId = null;
  let lastEmitAt = 0;

  const offerEl = document.createElement("div");
  offerEl.className = "crystal-offer";
  offerEl.hidden = true;
  const offerName = document.createElement("div");
  offerName.className = "crystal-offer-name";
  const offerDesc = document.createElement("div");
  offerDesc.className = "crystal-offer-desc";
  const offerBtns = document.createElement("div");
  offerBtns.className = "crystal-offer-btns";
  const acceptBtn = document.createElement("button");
  acceptBtn.type = "button";
  acceptBtn.className = "crystal-accept";
  acceptBtn.addEventListener("click", () => respond(true));
  const declineBtn = document.createElement("button");
  declineBtn.type = "button";
  declineBtn.className = "crystal-decline";
  declineBtn.addEventListener("click", () => respond(false));
  offerBtns.append(acceptBtn, declineBtn);
  offerEl.append(offerName, offerDesc, offerBtns);
  document.body.appendChild(offerEl);

  function makeCrystal(id, x, z, type) {
    const style = TYPE_STYLE[type] || TYPE_STYLE.weapon;
    const group = new THREE.Group();
    const gy = getTerrainHeightAt(getMapId(), x, z);
    group.position.set(x, gy + CRYSTAL_HEIGHT, z);

    const inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.32, 0),
      new THREE.MeshPhongMaterial({
        color: style.color,
        emissive: style.emissive,
        emissiveIntensity: 0.6,
        shininess: 80,
      })
    );
    inner.name = "inner";
    group.add(inner);

    const outer = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshBasicMaterial({
        color: style.color,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
      })
    );
    outer.name = "outer";
    group.add(outer);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0.9,
      })
    );
    glow.name = "glow";
    glow.material.color.setHex(style.glow);
    glow.scale.set(2.6, 2.6, 1);
    group.add(glow);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.58, 28),
      new THREE.MeshBasicMaterial({
        color: style.ring,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      })
    );
    ring.name = "ring";
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -CRYSTAL_HEIGHT;
    group.add(ring);

    if (scene) scene.add(group);
    crystals.set(id, { group, x, z, type: style, inner, outer, glow, ring, baseT: Math.random() * 10 });
    return crystals.get(id);
  }

  function removeCrystal(id) {
    const c = crystals.get(id);
    if (!c) return;
    if (scene) scene.remove(c.group);
    c.inner.geometry.dispose();
    c.inner.material.dispose();
    c.outer.geometry.dispose();
    c.outer.material.dispose();
    c.glow.material.dispose();
    c.ring.geometry.dispose();
    c.ring.material.dispose();
    crystals.delete(id);
    if (id === pendingOfferId) {
      pendingOfferId = null;
      offerEl.hidden = true;
    }
  }

  function setCrystals(list) {
    const incoming = new Set();
    for (const c of list || []) {
      incoming.add(c.id);
      let entry = crystals.get(c.id);
      if (!entry) {
        entry = makeCrystal(c.id, c.x, c.z, c.type);
      } else {
        entry.x = c.x;
        entry.z = c.z;
        entry.group.position.set(c.x, getTerrainHeightAt(getMapId(), c.x, c.z) + CRYSTAL_HEIGHT, c.z);
      }
    }
    for (const id of [...crystals.keys()]) {
      if (!incoming.has(id)) removeCrystal(id);
    }
  }

  function offer(data) {
    if (pendingOfferId === data.crystalId && !offerEl.hidden) return;
    pendingOfferId = data.crystalId;
    offerAt = performance.now();
    const weapon = getWeapon(data.weaponId);
    offerName.textContent = weapon ? weapon.name : (data.weaponName || "Cristal de Arma");
    const armed = hasWeapon ? hasWeapon() : false;
    const cls = weapon ? WEAPON_CLASSES[weapon.class] : null;
    offerDesc.textContent = weapon
      ? `⚔️ ${weapon.damage}${weapon.pellets > 1 ? `×${weapon.pellets}` : ""} · 🎯 ${weapon.range} m${cls ? ` · ${cls.label}` : ""}`
      : "Cristal Mágico Encontrado";
    acceptBtn.textContent = armed ? "🔄 Equipar / Cambiar (Enter)" : "⚡ Equipar Arma (Enter)";
    declineBtn.textContent = armed ? "Mantener Actual" : "Dejar Cristal";
    offerEl.hidden = false;
  }

  // Recoge el cristal ofrecido sin usar el ratón (tecla Enter).
  // Devuelve true si había una oferta visible y se aceptó.
  function acceptOffer() {
    if (!pendingOfferId || offerEl.hidden) return false;
    respond(true);
    return true;
  }

  function respond(accept) {
    const id = pendingOfferId;
    pendingOfferId = null;
    offerAt = 0;
    offerEl.hidden = true;
    if (id) {
      suppressed.set(id, performance.now() + RE_ASK_MS);
      if (onRespond) onRespond(id, accept);
    }
  }

  // El servidor revierte la oferta a los 8 s sin evento; aquí hacemos lo mismo
  // para no quedar bloqueados recogiendo cristales de la sala.
  function expireOffer(now) {
    if (pendingOfferId && offerAt && now - offerAt > OFFER_TIMEOUT_MS) respond(false);
  }

  // El servidor respondió que el inventario está lleno: deja de preguntar por
  // el cristal actual (evita spam de "Inventario lleno." cada ~1.6 s).
  function rejectAsk() {
    if (lastAskId) {
      suppressed.set(lastAskId, performance.now() + 4000);
      lastAskId = null;
    }
  }

  function setCrystalsEnabled(value) {
    enabled = value;
    if (!value) {
      pendingOfferId = null;
      offerEl.hidden = true;
      suppressed.clear();
    }
  }

  function update(time, dt) {
    const now = performance.now();
    for (const [id, c] of crystals) {
      const t = time + c.baseT;
      c.inner.rotation.y += dt * 0.9;
      c.inner.rotation.x += dt * 0.3;
      c.outer.rotation.y -= dt * 0.55;
      c.outer.rotation.x -= dt * 0.2;
      const pulse = 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(t * 3));
      c.inner.material.emissiveIntensity = pulse;
      c.outer.material.opacity = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(t * 2.4));
      c.glow.material.opacity = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3.2));
      c.glow.scale.setScalar(2.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3.2)));
      c.ring.scale.setScalar(0.9 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.8)));
      c.ring.material.opacity = 0.28 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.8));
      c.group.position.y = getTerrainHeightAt(getMapId(), c.x, c.z) + CRYSTAL_HEIGHT + Math.sin(t * 1.1) * 0.12;
      if (suppressed.has(id) && suppressed.get(id) < now) suppressed.delete(id);
    }

    if (pendingOfferId) {
      expireOffer(now);
      return;
    }
    const pos = getOwnPosition();
    if (!pos || !enabled) return;
    let near = null;
    let bestD = PICKUP_RANGE;
    for (const [id, c] of crystals) {
      if (id === pendingOfferId) continue;
      if (suppressed.has(id)) continue;
      const d = Math.hypot(pos.x - c.x, pos.z - c.z);
      if (d < bestD) {
        bestD = d;
        near = id;
      }
    }
    if (near && now - lastEmitAt > 400) {
      lastEmitAt = now;
      lastAskId = near;
      if (onPickup) onPickup(near);
    }
  }

  function attachScene(newScene) {
    scene = newScene;
    if (!scene) return;
    for (const [, c] of crystals) {
      if (c.group && !c.group.parent) {
        scene.add(c.group);
      }
    }
  }

  function dispose() {
    for (const id of [...crystals.keys()]) removeCrystal(id);
    glowTexture.dispose();
    offerEl.remove();
  }

  return {
    attachScene,
    setCrystals,
    offer,
    acceptOffer,
    update,
    setEnabled: setCrystalsEnabled,
    rejectAsk,
    dispose,
  };
}