import * as THREE from "/vendor/three/three.module.js";

const PUCK_RADIUS = 0.55;

function makePuck() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(PUCK_RADIUS, PUCK_RADIUS, 0.16, 24),
    new THREE.MeshStandardMaterial({ color: 0x141a28, roughness: 0.35 })
  );
  body.position.y = 0.08;
  body.castShadow = true;
  group.add(body);

  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(PUCK_RADIUS * 0.45, PUCK_RADIUS * 0.45, 0.18, 24),
    new THREE.MeshStandardMaterial({ color: 0xffb02e, roughness: 0.5 })
  );
  stripe.position.y = 0.085;
  group.add(stripe);

  return group;
}

export function createHockey() {
  const group = makePuck();
  group.visible = false;
  let active = false;

  const target = { x: 0, z: 0, vx: 0, vz: 0 };

  const board = document.createElement("div");
  board.className = "hockey-board";
  board.innerHTML = `<div class="hockey-title">Hockey de pinguinos</div><div class="hockey-list"></div>`;
  board.hidden = true;
  document.body.appendChild(board);
  const listEl = board.querySelector(".hockey-list");

  function renderScores(scores) {
    listEl.innerHTML = "";
    if (!scores || !scores.length) {
      listEl.textContent = "Empuja el disco y anota un gol.";
      return;
    }
    scores.slice(0, 5).forEach((s, i) => {
      const row = document.createElement("div");
      row.className = "hockey-row";
      row.textContent = `${i + 1}. ${s.name}  ·  ${s.n}`;
      listEl.appendChild(row);
    });
  }

  function setState(state) {
    if (!state) return;
    target.x = state.x;
    target.z = state.z;
    target.vx = state.vx;
    target.vz = state.vz;
    const dx = state.x - group.position.x;
    const dz = state.z - group.position.z;
    if (Math.hypot(dx, dz) > 6) {
      group.position.set(state.x, 0, state.z);
    }
    if (state.scores) renderScores(state.scores);
  }

  function setActive(value) {
    active = !!value;
    group.visible = active;
    board.hidden = !active;
  }

  return {
    attachScene(scene) {
      if (group.parent) group.parent.remove(group);
      scene.add(group);
      group.visible = active;
    },
    setState,
    setActive,
    update(dt) {
      if (!group.visible) return;
      // Predicción local de movimiento entre ticks
      target.x += target.vx * dt * 0.95;
      target.z += target.vz * dt * 0.95;
      target.vx *= 0.98;
      target.vz *= 0.98;

      const k = Math.min(1, dt * 14);
      group.position.x += (target.x - group.position.x) * k;
      group.position.z += (target.z - group.position.z) * k;
      group.rotation.y += Math.hypot(target.vx, target.vz) * dt * 2.0;
    },
    dispose() {
      active = false;
      if (group.parent) group.parent.remove(group);
      if (board.parent) board.parent.removeChild(board);
    },
  };
}