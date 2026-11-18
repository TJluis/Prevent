import * as THREE from "/vendor/three/three.module.js";
import { createAvatar } from "./avatar.js";
import {
  BODY_COLORS,
  BELLY_COLORS,
  BEAK_COLORS,
  HATS,
  SCARF_COLORS,
  GLASSES,
  SKINS,
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  randomAppearance,
} from "./appearance.js";

let scene = null;
let camera = null;
let renderer = null;
let previewGroup = null;
let previewRunning = false;
let pendingOnPlay = null;
let pendingOnBack = null;
let dressingName = "Tú";
let currentAppearance = { ...DEFAULT_APPEARANCE };

let isDraggingPreview = false;
let lastMouseXPreview = 0;

function setupPreviewControls(container) {
  container.style.cursor = "grab";
  const startDrag = (clientX) => {
    isDraggingPreview = true;
    lastMouseXPreview = clientX;
    container.style.cursor = "grabbing";
  };
  const moveDrag = (clientX) => {
    if (!isDraggingPreview || !previewGroup) return;
    const deltaX = clientX - lastMouseXPreview;
    previewGroup.rotation.y += deltaX * 0.012;
    lastMouseXPreview = clientX;
  };
  const endDrag = () => {
    isDraggingPreview = false;
    container.style.cursor = "grab";
  };

  container.onmousedown = (e) => startDrag(e.clientX);
  window.onmousemove = (e) => moveDrag(e.clientX);
  window.onmouseup = endDrag;

  container.ontouchstart = (e) => {
    if (e.touches.length > 0) startDrag(e.touches[0].clientX);
  };
  window.ontouchmove = (e) => {
    if (e.touches.length > 0) moveDrag(e.touches[0].clientX);
  };
  window.ontouchend = endDrag;
}

function ensurePreviewScene() {
  const container = document.getElementById("dress-preview");
  if (renderer) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x17233a);
  camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 50);
  camera.position.set(0, 0.95, 4.1);
  camera.lookAt(0, 0.85, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xfff4df, 1.3);
  key.position.set(2, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fc2ff, 0.5);
  rim.position.set(-3, 2, -3);
  scene.add(rim);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.45, 48),
    new THREE.MeshStandardMaterial({ color: 0x9fd1f5, roughness: 0.3, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.01;
  scene.add(ring);

  setupPreviewControls(container);

  previewRunning = true;
  const tick = () => {
    if (!previewRunning) return;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  tick();
}

function disposePreviewScene() {
  previewRunning = false;
  if (renderer) {
    renderer.dispose();
    renderer.domElement?.parentNode?.removeChild(renderer.domElement);
  }
  renderer = null;
  scene = null;
  camera = null;
  previewGroup = null;
}

function rebuildPreview(name) {
  if (!previewGroup) {
    previewGroup = new THREE.Group();
    scene.add(previewGroup);
  }
  previewGroup.clear();
  previewGroup.add(createAvatar(name || "Tú", "#4c84ff", currentAppearance));
}

function updateSwatches() {
  const name = dressingName;
  renderRow("dress-body", "Color del cuerpo", (el) =>
    makeColorSwatches(el, BODY_COLORS, currentAppearance.body, (c) => {
      currentAppearance.body = c;
      updateSwatches();
      rebuildPreview(name);
    })
  );
  renderRow("dress-belly", "Color de la panza", (el) =>
    makeColorSwatches(el, BELLY_COLORS, currentAppearance.belly, (c) => {
      currentAppearance.belly = c;
      updateSwatches();
      rebuildPreview(name);
    })
  );
  renderRow("dress-beak", "Color del pico", (el) =>
    makeColorSwatches(el, BEAK_COLORS, currentAppearance.beak, (c) => {
      currentAppearance.beak = c;
      updateSwatches();
      rebuildPreview(name);
    })
  );
  renderRow("dress-hat", "Sombrero", (el) =>
    makeKeyButtons(
      el,
      HATS.map((h) => h.id),
      HATS.map((h) => h.label),
      currentAppearance.hat,
      (v) => {
        currentAppearance.hat = v;
        updateSwatches();
        rebuildPreview(name);
      }
    )
  );
  renderRow("dress-scarf", "Bufanda", (el) =>
    makeColorButtons(el, SCARF_COLORS, currentAppearance.scarf, (v) => {
      currentAppearance.scarf = v;
      updateSwatches();
      rebuildPreview(name);
    })
  );
  renderRow("dress-glasses", "Lentes", (el) =>
    makeKeyButtons(
      el,
      GLASSES.map((g) => g.id),
      GLASSES.map((g) => g.label),
      currentAppearance.glasses,
      (v) => {
        currentAppearance.glasses = v;
        updateSwatches();
        rebuildPreview(name);
      }
    )
  );
  renderRow("dress-skin", "Skin", (el) =>
    makeKeyButtons(
      el,
      SKINS.map((s) => s.id),
      SKINS.map((s) => s.label),
      currentAppearance.skin,
      (v) => {
        currentAppearance.skin = v;
        updateSwatches();
        rebuildPreview(name);
      }
    )
  );
  updateJerseyControls();
}

function isJerseySkin() {
  return currentAppearance.skin === "volleyball" || currentAppearance.skin === "futbol";
}

function updateJerseyControls() {
  const show = isJerseySkin();
  const rowN = document.getElementById("dress-jersey-row");
  const rowNm = document.getElementById("dress-jerseyname-row");
  if (rowN) rowN.hidden = !show;
  if (rowNm) rowNm.hidden = !show;
  const numEl = document.getElementById("dress-jersey");
  const nameEl = document.getElementById("dress-jerseyname");
  if (numEl) numEl.value = currentAppearance.number ?? "";
  if (nameEl) nameEl.value = currentAppearance.jerseyName ?? "";
}

function clearRow(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = "";
}

function renderRow(id, label, build) {
  const rowWrap = document.getElementById(id + "-row");
  if (rowWrap) {
    const title = rowWrap.querySelector(".dress-row-title");
    if (title) title.textContent = label;
  }
  clearRow(id);
  build(document.getElementById(id));
}

function makeColorSwatches(container, palette, selected, onPick) {
  container.innerHTML = "";
  for (const color of palette) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "swatch" + (color === selected ? " selected" : "");
    swatch.style.background = color;
    swatch.title = color;
    swatch.addEventListener("click", () => onPick(color));
    container.appendChild(swatch);
  }
}

function makeKeyButtons(container, keys, labels, selected, onPick) {
  container.innerHTML = "";
  keys.forEach((key, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-btn" + (key === selected ? " selected" : "");
    btn.textContent = labels[index];
    btn.dataset.value = key === null ? "" : String(key);
    btn.addEventListener("click", () => onPick(key));
    container.appendChild(btn);
  });
}

function makeColorButtons(container, colors, selected, onPick) {
  container.innerHTML = "";
  for (const color of colors) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-btn" + (color === selected ? " selected" : "");
    if (color) {
      btn.style.background = color;
      btn.title = color;
    } else {
      btn.textContent = "Ninguna";
      btn.classList.add("empty-option");
    }
    btn.dataset.value = color === null ? "" : String(color);
    btn.addEventListener("click", () => onPick(color));
    container.appendChild(btn);
  }
}

export function openDressing({ name, appearance, onPlay, onBack }) {
  pendingOnPlay = onPlay || null;
  pendingOnBack = onBack || null;
  dressingName = name || "Tú";
  const screen = document.getElementById("dress-screen");
  screen.hidden = false;
  currentAppearance = normalizeAppearance(appearance);

  document.getElementById("dress-name").textContent = name
    ? `Personaliza a ${name}`
    : "Personaliza tu pingüino";

  ensurePreviewScene();
  rebuildPreview(dressingName);
  updateSwatches();
}

export function closeDressing() {
  const screen = document.getElementById("dress-screen");
  if (screen) screen.hidden = true;
  disposePreviewScene();
}

export function cancelDressing() {
  const back = pendingOnBack;
  pendingOnPlay = null;
  pendingOnBack = null;
  closeDressing();
  if (back) back();
}

export function commitDressing() {
  const cb = pendingOnPlay;
  if (!cb) return;
  pendingOnPlay = null;
  closeDressing();
  cb(normalizeAppearance(currentAppearance));
}

export function randomizeDressing() {
  currentAppearance = randomAppearance();
  updateSwatches();
  rebuildPreview(document.getElementById("dress-name")?.textContent || "Tú");
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("dress-back-btn")?.addEventListener("click", cancelDressing);
  document.getElementById("dress-random-btn")?.addEventListener("click", randomizeDressing);
  document.getElementById("dress-play-btn")?.addEventListener("click", commitDressing);

  document.getElementById("dress-jersey")?.addEventListener("input", (e) => {
    const v = e.target.value.trim();
    currentAppearance.number = /^\d{1,2}$/.test(v) ? v : null;
    rebuildPreview(document.getElementById("dress-name")?.textContent || "Tú");
  });
  document.getElementById("dress-jerseyname")?.addEventListener("input", (e) => {
    currentAppearance.jerseyName = e.target.value.replace(/\s+/g, " ").trim().slice(0, 12);
    e.target.value = currentAppearance.jerseyName;
    rebuildPreview(document.getElementById("dress-name")?.textContent || "Tú");
  });

  document.querySelectorAll("#dress-tabs .dress-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#dress-tabs .dress-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      document.querySelectorAll(".dress-row").forEach((row) => {
        if (target === "all" || row.dataset.category === target) {
          row.style.display = "";
        } else {
          row.style.display = "none";
        }
      });
    });
  });
});