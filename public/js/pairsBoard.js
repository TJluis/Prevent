// Render 3D del tablero de "Encuentra los pares".
//
// El servidor manda el estado (qué cartas están boca arriba, qué parejas están
// ganadas y en qué atril). Aquí solo se pinta: cartas físicas, plataformas de
// equipo, atriles y el resaltado de la carta que el jugador pisa.
//
// Las caras ocultas nunca se crean en el cliente: el emoji solo llega cuando la
// carta está boca arriba o ya emparejada.

import * as THREE from "/vendor/three/three.module.js";
import {
  PAIRS_CARD_Y,
  PAIRS_BOARD_Y,
  PAIRS_TEAMS,
  resolvePairsVariant,
  cardCenter,
  cardStride,
  boardSize,
  teamPad,
  teamRack,
  teamRackSlot,
  cardIndexAt,
} from "./pairsDefs.js";

const FONT =
  "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji','Segoe UI',system-ui,sans-serif";

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function makeCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  if ("colorSpace" in texture) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeBackTexture() {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#1b2750");
  grad.addColorStop(0.55, "#111a38");
  grad.addColorStop(1, "#080d1d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Trama sutil de copos.
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#9ad9ff";
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const x = 26 + ((i * 61) % 210);
    const y = 26 + ((i * 97) % 210);
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x + 7, y);
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x, y + 7);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(125,211,252,0.85)";
  ctx.lineWidth = 9;
  roundRect(ctx, 11, 11, size - 22, size - 22, 24);
  ctx.stroke();

  ctx.fillStyle = "rgba(125,211,252,0.16)";
  roundRect(ctx, 24, 24, size - 48, size - 48, 18);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e8f8ff";
  ctx.font = `bold 118px ${FONT}`;
  ctx.fillText("?", size / 2, size / 2 + 8);
  return canvasTexture(canvas);
}

function makeFaceTexture(emoji) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#f8fcff");
  grad.addColorStop(1, "#cfe6ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(125,211,252,0.95)";
  ctx.lineWidth = 9;
  roundRect(ctx, 11, 11, size - 22, size - 22, 24);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `150px ${FONT}`;
  ctx.fillText(emoji, size / 2, size / 2 + 12);
  return canvasTexture(canvas);
}

function makeLabelTexture(title, color, subtitle) {
  const width = 512;
  const height = 160;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "rgba(7,12,26,0.82)";
  roundRect(ctx, 8, 8, width - 16, height - 16, 26);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.font = `bold 56px ${FONT}`;
  ctx.fillText(title, width / 2, subtitle ? 62 : 80);
  if (subtitle) {
    ctx.fillStyle = "#dbeafe";
    ctx.font = `34px ${FONT}`;
    ctx.fillText(subtitle, width / 2, 118);
  }
  return canvasTexture(canvas);
}

export function createPairsBoard() {
  let scene = null;
  let root = null;
  let cardsGroup = null;
  let hover = null;
  let def = resolvePairsVariant("1v1");
  let variant = def.id;
  let state = null;
  let roundSeen = null;
  let visible = false;
  let elapsed = 0;

  const cards = [];
  const pads = new Map();
  const racks = new Map();
  const rackKeepers = new Map();
  const backTexture = makeBackTexture();
  const faceTextures = new Map();

  function faceTexture(emoji) {
    let texture = faceTextures.get(emoji);
    if (!texture) {
      texture = makeFaceTexture(emoji);
      faceTextures.set(emoji, texture);
    }
    return texture;
  }

  function disposeObject(object) {
    object.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (material) material.dispose();
      }
    });
  }

  function disposeRoot() {
    if (root && root.parent) root.parent.remove(root);
    if (root) disposeObject(root);
    root = null;
    cardsGroup = null;
    hover = null;
    cards.length = 0;
    pads.clear();
    racks.clear();
    rackKeepers.clear();
  }

  function buildBoardBase() {
    const board = boardSize(def);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x101a36,
      roughness: 0.62,
      metalness: 0.28,
      emissive: 0x0b1533,
      emissiveIntensity: 0.55,
    });
    const baseGeometry = new THREE.BoxGeometry(board + 1.5, 0.16, board + 1.5);
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.07;
    base.receiveShadow = true;
    base.castShadow = true;
    root.add(base);

    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(baseGeometry),
      new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.85 })
    );
    border.position.copy(base.position);
    root.add(border);

    // Rejilla tenue en los bordes de las cartas.
    const stride = cardStride(def);
    const half = (def.grid / 2) * stride;
    const points = [];
    for (let i = 0; i <= def.grid; i++) {
      const p = -half + i * stride;
      points.push(p, PAIRS_BOARD_Y + 0.02, -half, p, PAIRS_BOARD_Y + 0.02, half);
      points.push(-half, PAIRS_BOARD_Y + 0.02, p, half, PAIRS_BOARD_Y + 0.02, p);
    }
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    root.add(
      new THREE.LineSegments(
        gridGeometry,
        new THREE.LineBasicMaterial({ color: 0x35518a, transparent: true, opacity: 0.45 })
      )
    );
  }

  function buildCard(index) {
    const center = cardCenter(def, index);
    if (!center) return;
    const size = def.cardSize;
    const group = new THREE.Group();
    group.position.set(center.x, PAIRS_CARD_Y, center.z);
    group.userData.index = index;

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a1124,
      roughness: 0.7,
      metalness: 0.18,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(size * 0.97, 0.08, size * 0.97), baseMaterial);
    base.position.y = 0.04;
    base.castShadow = true;
    base.receiveShadow = true;

    const flip = new THREE.Group();
    flip.position.y = 0.09;

    const backMaterial = new THREE.MeshStandardMaterial({
      map: backTexture,
      roughness: 0.62,
      metalness: 0.06,
    });
    const faceMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a1124,
      roughness: 0.58,
      metalness: 0.06,
    });
    const planeGeometry = new THREE.PlaneGeometry(size * 0.9, size * 0.9);
    const back = new THREE.Mesh(planeGeometry, backMaterial);
    back.rotation.x = -Math.PI / 2;
    back.position.y = 0.002;
    back.receiveShadow = true;

    const face = new THREE.Mesh(planeGeometry, faceMaterial);
    face.rotation.x = Math.PI / 2;
    face.position.y = -0.002;

    flip.add(back, face);
    group.add(base, flip);
    cardsGroup.add(group);

    cards[index] = {
      index,
      group,
      flip,
      faceMaterial,
      home: { x: center.x, z: center.z },
      mode: "board",
      target: 0,
      faceEmoji: null,
      flight: null,
      vanish: null,
    };
  }

  function buildPad(team) {
    const pad = teamPad(def, team.id);
    if (!pad) return;
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(team.dark),
      emissive: new THREE.Color(team.color),
      emissiveIntensity: 0.22,
      roughness: 0.5,
      metalness: 0.22,
    });
    const geometry = new THREE.BoxGeometry(pad.w, 0.22, pad.d);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(pad.x, 0.11, pad.z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    root.add(mesh);

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(team.color),
      transparent: true,
      opacity: 0.85,
    });
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial);
    edge.position.copy(mesh.position);
    root.add(edge);

    const labelTexture = makeLabelTexture(team.short.toUpperCase(), team.color, "PISA AQUÍ");
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      depthWrite: false,
    });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(pad.w * 0.72, pad.d * 0.72), labelMaterial);
    label.rotation.x = -Math.PI / 2;
    label.position.set(pad.x, 0.24, pad.z);
    root.add(label);

    pads.set(team.id, { material, edgeMaterial, labelMaterial, labelTexture });
  }

  function buildRack(team) {
    const rack = teamRack(def, team.id);
    if (!rack) return;
    const material = new THREE.MeshStandardMaterial({
      color: 0x111a33,
      emissive: new THREE.Color(team.dark),
      emissiveIntensity: 0.5,
      roughness: 0.58,
      metalness: 0.25,
    });
    const geometry = new THREE.BoxGeometry(rack.w, 0.7, rack.d);
    const table = new THREE.Mesh(geometry, material);
    table.position.set(rack.x, 0.35, rack.z);
    table.receiveShadow = true;
    table.castShadow = true;
    root.add(table);

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(team.color),
        transparent: true,
        opacity: 0.8,
      })
    );
    edge.position.copy(table.position);
    root.add(edge);

    const spriteMaterial = new THREE.SpriteMaterial({
      map: makeLabelTexture(team.short.toUpperCase(), team.color, "0 pares"),
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(rack.x, 2.05, rack.z);
    sprite.scale.set(3.7, 1.16, 1);
    root.add(sprite);

    racks.set(team.id, { sprite, material, labelText: null });
  }

  function buildHover() {
    const inner = def.cardSize * 0.42;
    const outer = def.cardSize * 0.53;
    const material = new THREE.MeshBasicMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    hover = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 40), material);
    hover.rotation.x = -Math.PI / 2;
    hover.position.y = PAIRS_CARD_Y + 0.14;
    hover.visible = false;
    root.add(hover);
  }

  function build() {
    disposeRoot();
    def = resolvePairsVariant(variant);
    variant = def.id;
    if (!scene) return;

    root = new THREE.Group();
    root.name = "pairs-board";
    root.visible = visible;
    scene.add(root);

    buildBoardBase();
    cardsGroup = new THREE.Group();
    root.add(cardsGroup);
    for (let i = 0; i < def.cardCount; i++) buildCard(i);
    for (const team of PAIRS_TEAMS) {
      buildPad(team);
      buildRack(team);
    }
    buildHover();
    roundSeen = null;
    resetCards();
    if (state) applyState();
  }

  function resetCards() {
    rackKeepers.clear();
    for (const card of cards) {
      if (!card) continue;
      card.mode = "board";
      card.target = 0;
      card.faceEmoji = null;
      card.flight = null;
      card.vanish = null;
      card.group.visible = true;
      card.group.position.set(card.home.x, PAIRS_CARD_Y, card.home.z);
      card.group.rotation.set(0, 0, 0);
      card.group.scale.setScalar(1);
      card.flip.rotation.x = 0;
      card.faceMaterial.map = null;
      card.faceMaterial.color.setHex(0x0a1124);
      card.faceMaterial.needsUpdate = true;
    }
  }

  function setFace(card, emoji) {
    if (!emoji || card.faceEmoji === emoji) return;
    card.faceEmoji = emoji;
    card.faceMaterial.map = faceTexture(emoji);
    card.faceMaterial.color.setHex(0xffffff);
    card.faceMaterial.needsUpdate = true;
  }

  function startRackFlight(card, cardState) {
    const team = cardState.ownerTeam;
    const slot = cardState.slot;
    if (!team || !Number.isInteger(slot)) return;
    const key = `${team}:${slot}`;
    const keeper = rackKeepers.get(key);
    if (keeper == null) {
      rackKeepers.set(key, card.index);
      const target = teamRackSlot(def, team, slot);
      if (!target) return;
      card.mode = "flying";
      card.target = Math.PI;
      card.flip.rotation.x = Math.PI;
      card.flight = {
        t: 0,
        duration: 0.85,
        from: card.group.position.clone(),
        to: new THREE.Vector3(target.x, target.y, target.z),
        arc: 1.5,
      };
    } else {
      card.mode = "vanish";
      card.vanish = { t: 0, duration: 0.42 };
    }
  }

  function applyCards() {
    if (!state) return;
    for (const cardState of state.cards || []) {
      const card = cards[cardState.i];
      if (!card) continue;
      const faceUp = !!(cardState.matched || cardState.flipped);
      if (faceUp && cardState.emoji) setFace(card, cardState.emoji);
      if (card.mode === "board") {
        card.target = faceUp ? Math.PI : 0;
      }
      if (cardState.matched && card.mode === "board") {
        startRackFlight(card, cardState);
      }
    }
  }

  function updateRacks() {
    if (!state) return;
    for (const team of state.teams || []) {
      const rack = racks.get(team.id);
      if (!rack) continue;
      const plural = team.score === 1 ? "par" : "pares";
      const text = `${team.score} ${plural}`;
      if (rack.labelText === text) continue;
      rack.labelText = text;
      const old = rack.sprite.material.map;
      rack.sprite.material.map = makeLabelTexture(team.short.toUpperCase(), team.color, text);
      rack.sprite.material.needsUpdate = true;
      if (old) old.dispose();
    }
  }

  function updatePads() {
    if (!state) return;
    const myTeam = state.myTeam || null;
    for (const team of PAIRS_TEAMS) {
      const pad = pads.get(team.id);
      if (!pad) continue;
      const isTurn = state.status === "playing" && state.turnTeam === team.id;
      const mine = myTeam === team.id;
      const base = isTurn ? 0.95 : mine ? 0.55 : 0.22;
      pad.turn = isTurn;
      pad.baseGlow = base;
      pad.material.emissiveIntensity = base;
      pad.edgeMaterial.opacity = isTurn ? 1 : mine ? 0.9 : 0.55;
    }
  }

  function applyState() {
    if (!state) return;
    if (state.round !== roundSeen) {
      roundSeen = state.round;
      resetCards();
    }
    applyCards();
    updateRacks();
    updatePads();
  }

  function setVariant(id) {
    const next = resolvePairsVariant(id);
    if (next.id === variant && root) return;
    variant = next.id;
    build();
  }

  function attachScene(nextScene) {
    if (!nextScene) return;
    if (scene === nextScene && root && root.parent === nextScene) return;
    disposeRoot();
    scene = nextScene;
    build();
  }

  function detach() {
    disposeRoot();
    scene = null;
  }

  function show(variantId) {
    if (variantId) setVariant(variantId);
    else if (!root) build();
    visible = true;
    if (root) root.visible = true;
  }

  function hide() {
    visible = false;
    if (root) root.visible = false;
    if (hover) hover.visible = false;
  }

  function setState(snapshot) {
    if (!snapshot) {
      state = null;
      return;
    }
    if (snapshot.variant && snapshot.variant !== variant) {
      setVariant(snapshot.variant);
    }
    state = snapshot;
    applyState();
  }

  function update(dt, info = {}) {
    if (!root || !root.visible) return;
    const step = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
    elapsed += step;

    for (const card of cards) {
      if (!card) continue;
      if (card.mode === "board") {
        const diff = card.target - card.flip.rotation.x;
        if (Math.abs(diff) > 0.001) {
          card.flip.rotation.x += Math.sign(diff) * Math.min(Math.abs(diff), step * 13);
        }
      } else if (card.mode === "flying" && card.flight) {
        const flight = card.flight;
        flight.t += step;
        const k = Math.min(1, flight.t / flight.duration);
        const ease = k * k * (3 - 2 * k);
        card.group.position.x = flight.from.x + (flight.to.x - flight.from.x) * ease;
        card.group.position.z = flight.from.z + (flight.to.z - flight.from.z) * ease;
        card.group.position.y =
          flight.from.y + (flight.to.y - flight.from.y) * ease + Math.sin(k * Math.PI) * flight.arc;
        card.group.rotation.y += step * 2.6;
        if (k >= 1) {
          card.mode = "rack";
          card.group.position.copy(flight.to);
          card.group.rotation.set(0, 0, 0);
          card.group.scale.setScalar(0.9);
          card.flip.rotation.x = Math.PI;
        }
      } else if (card.mode === "vanish" && card.vanish) {
        const vanish = card.vanish;
        vanish.t += step;
        const k = Math.min(1, vanish.t / vanish.duration);
        card.group.scale.setScalar(Math.max(0.001, 1 - k));
        card.group.position.y = PAIRS_CARD_Y + k * 0.8;
        card.group.rotation.y += step * 7;
        if (k >= 1) {
          card.mode = "gone";
          card.group.visible = false;
        }
      }
    }

    // Pulso de la plataforma a la que le toca jugar.
    for (const pad of pads.values()) {
      if (pad.turn) {
        pad.material.emissiveIntensity = 0.72 + Math.sin(elapsed * 4.5) * 0.22;
      }
    }

    if (hover) {
      const active = !!info.active;
      const index = active ? cardIndexAt(def, info.x, info.z) : -1;
      const card = index >= 0 ? cards[index] : null;
      if (card && card.mode === "board") {
        hover.visible = true;
        hover.position.x = card.home.x;
        hover.position.z = card.home.z;
        const color = info.color || "#dbeafe";
        hover.material.color.set(color);
        const pulse = 1 + Math.sin(elapsed * 6) * 0.06;
        hover.scale.setScalar(pulse);
        hover.material.opacity = info.canFlip ? 0.95 : 0.34;
      } else {
        hover.visible = false;
      }
    }
  }

  function dispose() {
    disposeRoot();
    scene = null;
    state = null;
    visible = false;
    backTexture.dispose();
    for (const texture of faceTextures.values()) texture.dispose();
    faceTextures.clear();
  }

  return {
    attachScene,
    detach,
    show,
    hide,
    setVariant,
    setState,
    update,
    dispose,
    get variant() {
      return variant;
    },
    get state() {
      return state;
    },
    get group() {
      return root;
    },
    get visible() {
      return visible;
    },
  };
}
