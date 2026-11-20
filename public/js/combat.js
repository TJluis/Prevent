import * as THREE from "/vendor/three/three.module.js";
import { getWeapon, WEAPON_DEFAULT_ID } from "./weaponDefs.js";
import { damageAtRange, rayRadiusFor } from "./weaponMath.js";
import { buildWeaponGroup } from "./viewmodel.js";
import { setAvatarWeapon } from "./avatar.js";
import { BLOCK_STAMINA_MAX } from "./combatMath.js";

const MAX_HP = 100;
const PROJ_SPEED = 55;
const RAY_RADIUS = 0.7;
const RESPAWN_MS = 10000;

// En móvil el botón de recarga del HUD se muestra compacto para no ensanchar
// el panel (en pantallas de 640-700 px se encimaba con los botones táctiles).
function isTouchUi() {
  return document.body.classList.contains("touch-mode");
}
function reloadLabel() {
  return isTouchUi() ? "↻" : "Recargar (R)";
}
function reloadingLabel() {
  return isTouchUi() ? "…" : "Recargando…";
}

let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      audioCtx = null;
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone({ freq = 440, end = 220, dur = 0.12, type = "square", gain = 0.25, when = 0 }) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + when);
  if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(30, end), ctx.currentTime + when + dur);
  g.gain.setValueAtTime(gain, ctx.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(ctx.currentTime + when);
  osc.stop(ctx.currentTime + when + dur + 0.02);
}

function playNoise({ dur = 0.1, gain = 0.3, when = 0, type = "highpass", freq = 1200 }) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  src.start(ctx.currentTime + when);
}

function playShoot(weapon) {
  const s = weapon.sound;
  const jitter = 1 + (Math.random() - 0.5) * 0.08;
  playTone({ freq: s.freq * jitter, end: s.end, dur: s.dur, type: s.type, gain: s.gain });
  playNoise({ dur: 0.1, gain: 0.25, type: "highpass", freq: 1200 });
}

function playSwish() {
  playNoise({ dur: 0.16, gain: 0.3, type: "bandpass", freq: 900 });
  playTone({ freq: 900, end: 300, dur: 0.18, type: "sine", gain: 0.12 });
}

// Golpe absorbido por el escudo: metal agudo y seco.
function playBlockClang() {
  playTone({ freq: 1500, end: 760, dur: 0.1, type: "square", gain: 0.16 });
  playTone({ freq: 2200, end: 1200, dur: 0.07, type: "triangle", gain: 0.1 });
  playNoise({ dur: 0.08, gain: 0.14, type: "highpass", freq: 2600 });
}

// Guard break: el escudo cede y queda inutilizable unos segundos.
function playGuardBreak() {
  playTone({ freq: 460, end: 90, dur: 0.34, type: "sawtooth", gain: 0.22 });
  playNoise({ dur: 0.3, gain: 0.22, type: "lowpass", freq: 700 });
}

function playExplosion() {
  playNoise({ dur: 0.5, gain: 0.6, type: "lowpass", freq: 300 });
  playTone({ freq: 90, end: 30, dur: 0.4, type: "sine", gain: 0.5 });
}

function playSnowburst() {
  playNoise({ dur: 0.35, gain: 0.5, type: "highpass", freq: 900 });
  playTone({ freq: 720, end: 1400, dur: 0.3, type: "sine", gain: 0.35 });
}

function playReload() {
  playTone({ freq: 500, end: 300, dur: 0.06, type: "square", gain: 0.18 });
  playTone({ freq: 650, end: 380, dur: 0.08, type: "square", gain: 0.18, when: 0.18 });
  playTone({ freq: 820, end: 480, dur: 0.1, type: "square", gain: 0.18, when: 0.36 });
}

function playEmpty() {
  playTone({ freq: 260, end: 140, dur: 0.05, type: "square", gain: 0.12 });
}

// Arma para el modelo 3ª persona: reutiliza el modelo detallado de la
// primera persona (viewmodel.buildWeaponGroup), girado 180° en Y para apuntar
// a +Z (frente del pingüino) y escalado para verse proporcional al cuerpo.
// El giro base se conserva en userData.baseRotY porque update() re-compone la
// rotación en cada frame (swing de melee / reposo).
//
// La posición NO es fija: se calcula para que el CENTRO DE AGARRE del modelo
// (userData.grips) caiga en TP_HOLD, justo delante del pecho. Así las dos
// aletas del pingüino alcanzan el arma (avatar.js -> poseWingsForGun) en vez de
// quedarse colgando en vertical, y el arma no queda enterrada en el torso.
const TP_HOLD = { x: 0.05, y: 0.86, z: 0.45 };
const TP_SCALE = 1.45;
const TP_FALLBACK_GRIPS = { right: [0.05, -0.08, 0], left: [-0.05, -0.05, 0] };

export function solveWeaponHold(rawGrips) {
  const grips = rawGrips || TP_FALLBACK_GRIPS;
  const cx = (grips.right[0] + grips.left[0]) * 0.5;
  const cy = (grips.right[1] + grips.left[1]) * 0.5;
  const cz = (grips.right[2] + grips.left[2]) * 0.5;
  // El giro de 180° en Y invierte X y Z: el agarre queda en
  // (x + s*cx, y - s*cy, z + s*cz) respecto al punto de agarre.
  return {
    scale: TP_SCALE,
    x: TP_HOLD.x + TP_SCALE * cx,
    y: TP_HOLD.y - TP_SCALE * cy,
    z: TP_HOLD.z + TP_SCALE * cz,
  };
}

function makeOwnWeapon(weapon) {
  const gun = weapon ? buildWeaponGroup(weapon) : null;
  if (!gun) return null;
  const hold = solveWeaponHold(gun.userData.grips);
  gun.rotation.y = Math.PI;
  gun.scale.setScalar(hold.scale);
  gun.position.set(hold.x, hold.y, hold.z);
  gun.userData.baseRotY = Math.PI;
  gun.userData.baseZ = hold.z;
  gun.userData.baseY = hold.y;
  return gun;
}

const MELT_DUR = 1.4;
const RISE_DUR = 1.0;
const PUDDLE_RADIUS = 0.55;
const SINK = 0.16;

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function makePuddle(color) {
  const group = new THREE.Group();
  const liquid = new THREE.Mesh(
    new THREE.CircleGeometry(PUDDLE_RADIUS, 28),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.15,
      metalness: 0.65,
      transparent: true,
      opacity: 0,
    })
  );
  liquid.rotation.x = -Math.PI / 2;
  liquid.position.y = 0.02;
  group.add(liquid);

  const glossy = new THREE.Mesh(
    new THREE.CircleGeometry(PUDDLE_RADIUS * 0.6, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0,
    })
  );
  glossy.rotation.x = -Math.PI / 2;
  glossy.position.y = 0.035;
  group.add(glossy);

  return { group, liquid, glossy };
}

function disposePuddle(puddle) {
  for (const mesh of [puddle.liquid, puddle.glossy]) {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
}

function ownColor(root) {
  if (!root) return 0x1b2330;
  for (const child of root.children) {
    if (child.isMesh && child.material && child.material.color) {
      return child.material.color;
    }
  }
  return 0x1b2330;
}

function makeBarSprite(width, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 12;
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })
  );
  sprite.scale.set(width, width * (12 / 64), 1);
  return { sprite, canvas, ctx: canvas.getContext("2d"), texture, color };
}

function drawBar(bar, ratio) {
  const { canvas, ctx, texture, color } = bar;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(10, 12, 20, 0.75)";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#3a4157";
  ctx.fillRect(2, 2, w - 4, h - 4);
  const fillW = (w - 4) * Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = ratio > 0.5 ? color : ratio > 0.25 ? "#fbbf24" : "#f87171";
  ctx.fillRect(2, 2, fillW, h - 4);
  if (ratio < 1) {
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  }
  texture.needsUpdate = true;
}

function makeHud() {
  const hud = document.createElement("div");
  hud.id = "combat-hud";
  hud.hidden = true;

  const weaponLabel = document.createElement("div");
  weaponLabel.className = "weapon-label";
  weaponLabel.textContent = "Sin arma";

  const ammoWrap = document.createElement("div");
  ammoWrap.className = "ammo-wrap";
  const ammoText = document.createElement("span");
  ammoText.className = "ammo-text";
  ammoText.textContent = "—";
  const reloadBtn = document.createElement("button");
  reloadBtn.type = "button";
  reloadBtn.id = "reload-btn";
  reloadBtn.textContent = reloadLabel();
  reloadBtn.addEventListener("click", () => hud.reload());
  ammoWrap.append(ammoText, reloadBtn);

  const hpWrap = document.createElement("div");
  hpWrap.className = "hp-wrap";
  const hpLabel = document.createElement("span");
  hpLabel.className = "hp-label";
  hpLabel.textContent = "HP";
  const hpBar = document.createElement("div");
  hpBar.className = "hp-bar-outer";
  hpBar.innerHTML = '<div class="hp-bar-inner"></div>';
  const hpText = document.createElement("span");
  hpText.className = "hp-text";
  hpText.textContent = "100";
  hpWrap.append(hpLabel, hpBar, hpText);

  const combatRow = document.createElement("div");
  combatRow.className = "combat-row";
  combatRow.append(ammoWrap, hpWrap);

  const blockRow = document.createElement("div");
  blockRow.className = "block-row";
  blockRow.hidden = true;
  const blockLabel = document.createElement("span");
  blockLabel.className = "block-label";
  blockLabel.textContent = "AGUANTE";
  const blockBar = document.createElement("div");
  blockBar.className = "block-bar-outer";
  blockBar.innerHTML = '<div class="block-bar-inner"></div>';
  const blockText = document.createElement("span");
  blockText.className = "block-text";
  blockText.textContent = "100";
  blockRow.append(blockLabel, blockBar, blockText);

  const respawn = document.createElement("div");
  respawn.className = "respawn-overlay";
  respawn.hidden = true;
  const respawnText = document.createElement("div");
  respawnText.className = "respawn-text";
  respawnText.textContent = "";
  respawn.appendChild(respawnText);

  hud.append(weaponLabel, combatRow, blockRow, respawn);
  document.body.appendChild(hud);
  return hud;
}

export function createCombat({
  scene: initialScene,
  getOwnId,
  getOwnPosition,
  getRemotes,
  getOwnAvatar,
  shoot,
  block: sendBlock,
  getOwnAim,
  onOwnFire,
  onReloadStart,
  onReloadEnd,
  notify,
}) {
  let scene = initialScene;
  const hud = makeHud();
  hud.shoot = () => fire();
  hud.reload = startReload;
  const blockRowEl = hud.querySelector(".block-row");
  const blockInnerEl = hud.querySelector(".block-bar-inner");
  const blockTextEl = hud.querySelector(".block-text");

  let enabled = false;
  let ownHp = MAX_HP;
  let ownAlive = true;
  let lastShot = 0;
  let weaponId = null;
  let weapon = null;
  let ammo = 0;
  let reloading = false;
  let reloadEnd = 0;
  let reloadDur = 0;
  let autoReload = true;
  let ownRespawnActive = false;
  let ownRespawnEnd = 0;
  const hpBars = new Map();
  const deadIds = new Set();
  const projectiles = [];
  const explosions = [];
  const itemFlights = [];
  const blood = [];
  const flashes = [];
  const fx = [];
  const puddles = new Map();

  let gun = null;
  let flashTimer = 0;
  let recoil = 0;
  let swing = 0;

  // Bloqueo con escudo. El servidor es la autoridad del aguante; el cliente
  // mantiene el estado para la pose, el HUD y el keepalive (~140 ms).
  let blocking = false;
  let blockStamina = BLOCK_STAMINA_MAX;
  let blockBrokenUntil = 0;
  let lastBlockSent = 0;
  // Tras romperse la guardia hay que soltar y volver a pulsar: evita que el
  // keepalive vuelva a levantar el escudo con 1 de aguante en bucle.
  let blockSuppressed = false;
  const BLOCK_KEEPALIVE_MS = 140;

  // Línea de mira (asistencia de puntería). Ocultar por defecto: al ser continua
  // y elevada (y=0.95), se percibía como un borde/frontera cruzando el mapa.
  const SHOW_AIM_LINE = false;

  const aimLine = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x4c84ff, transparent: true, opacity: 0.45 })
  );
  aimLine.frustumCulled = false;
  aimLine.visible = SHOW_AIM_LINE;
  scene.add(aimLine);

  function updateAmmo() {
    const text = hud.querySelector(".ammo-text");
    const btn = hud.querySelector("#reload-btn");
    const label = hud.querySelector(".weapon-label");
    if (!weapon) {
      if (text) text.textContent = "—";
      if (label) label.textContent = "Sin arma · busca un cristal";
      if (btn) {
        btn.disabled = true;
        btn.textContent = reloadLabel();
      }
      return;
    }
    const infinite = weapon.mag === 0;
    if (text) text.textContent = infinite ? "∞" : `${ammo} / ${weapon.mag}`;
    if (btn) btn.disabled = infinite || reloading || ammo >= weapon.mag;
    if (label) label.textContent = weapon.name;
  }

  function blockCfg() {
    return (weapon && weapon.block) || null;
  }

  function isBlocking() {
    return blocking && !!blockCfg() && blockStamina > 0 && ownAlive;
  }

  function updateBlockHud() {
    const cfg = blockCfg();
    if (!blockRowEl) return;
    blockRowEl.hidden = !cfg;
    if (!cfg) return;
    const broken = performance.now() < blockBrokenUntil;
    const pct = broken ? 0 : Math.max(0, Math.min(100, (blockStamina / BLOCK_STAMINA_MAX) * 100));
    if (blockInnerEl) {
      blockInnerEl.style.width = `${pct}%`;
      blockInnerEl.style.background = broken
        ? "#f87171"
        : pct > 45 ? "#38bdf8" : pct > 20 ? "#fbbf24" : "#f87171";
    }
    if (blockTextEl) blockTextEl.textContent = broken ? "ROTO" : String(Math.round(blockStamina));
    blockRowEl.classList.toggle("is-blocking", blocking && !broken);
    blockRowEl.classList.toggle("is-broken", broken);
  }

  // Levantar/bajar el escudo. on=true al mantener pulsado; el keepalive se
  // reenvía desde updateBlock() cada ~140 ms para que el servidor no lo corte.
  function setBlock(on, yaw) {
    const cfg = blockCfg();
    if (!on) blockSuppressed = false;
    if (!cfg || !enabled || !ownAlive) on = false;
    const now = performance.now();
    if (on) {
      if (blockSuppressed) return;
      if (now < blockBrokenUntil || blockStamina <= 0) return;
      if (blocking) {
        updateBlock(yaw);
        return;
      }
    } else if (!blocking) {
      return;
    }
    blocking = !!on;
    lastBlockSent = now;
    if (sendBlock) sendBlock(blocking, yaw);
    updateBlockHud();
  }

  function updateBlock(yaw) {
    if (!blocking) return;
    const now = performance.now();
    if (now - lastBlockSent < BLOCK_KEEPALIVE_MS) return;
    lastBlockSent = now;
    if (sendBlock) sendBlock(true, yaw);
  }

  function stopBlock() {
    if (!blocking) return;
    blocking = false;
    lastBlockSent = 0;
    if (sendBlock) sendBlock(false);
    updateBlockHud();
  }

  function setRemoteBlocking(root, on) {
    if (!root) return;
    root.userData.blocking = !!on;
    const rg = root.userData.remoteGun;
    if (!rg) return;
    if (on) {
      rg.rotation.x = -0.45;
      rg.position.y = (rg.userData.baseY != null ? rg.userData.baseY : rg.position.y) + 0.22;
    } else {
      rg.rotation.x = 0;
      if (rg.userData.baseY != null) rg.position.y = rg.userData.baseY;
    }
  }

  function onBlock(data) {
    if (!data || !data.playerId) return;
    if (data.playerId !== getOwnId()) {
      const remote = getRemotes().get(data.playerId);
      if (remote) setRemoteBlocking(remote.group, !!data.blocking);
      return;
    }

    const now = performance.now();
    if (data.guardBreak) {
      blocking = false;
      blockSuppressed = true;
      blockStamina = 0;
      blockBrokenUntil = now + ((blockCfg() && blockCfg().breakMs) || 1200);
      playGuardBreak();
      if (notify) notify("¡Escudo roto! Guardia baja 1,2 s");
      updateBlockHud();
      return;
    }
    if (data.reason === "guard-break") {
      blocking = false;
      blockSuppressed = true;
      blockStamina = 0;
      blockBrokenUntil = now + (data.brokenForMs || (blockCfg() && blockCfg().breakMs) || 1200);
      updateBlockHud();
      return;
    }

    if (typeof data.stamina === "number") blockStamina = data.stamina;
    if (data.blocking === true) {
      blocking = true;
    } else if (data.blocking === false) {
      blocking = false;
    }
    updateBlockHud();
  }

  function onBlocked(data) {
    if (!data) return;
    const x = Number(data.x);
    const z = Number(data.z);
    if (Number.isFinite(x) && Number.isFinite(z)) spawnSparks(x, z);
    playBlockClang();
  }

  function startReload() {
    if (!weapon || weapon.mag === 0 || ammo >= weapon.mag) return;
    if (reloading) return;
    reloading = true;
    reloadDur = weapon.reloadMs;
    reloadEnd = performance.now() + reloadDur;
    playReload();
    const btn = hud.querySelector("#reload-btn");
    if (btn) btn.textContent = reloadingLabel();
    if (onReloadStart) onReloadStart(weapon);
    updateAmmo();
  }

  function setReloadRing(pct) {
    const btn = hud.querySelector("#reload-btn");
    if (!btn) return;
    const value = Math.max(0, Math.min(100, pct));
    btn.style.setProperty("--reload", value.toFixed(1));
    btn.classList.toggle("is-reloading", value > 0 && value < 100);
  }

  // Cancela una recarga en curso (cambio de arma, muerte, salir del combate…).
  // El viewmodel debe volver a su pose normal y el anillo a cero.
  function cancelReload() {
    if (!reloading) return;
    reloading = false;
    reloadDur = 0;
    setReloadRing(0);
    const btn = hud.querySelector("#reload-btn");
    if (btn) btn.textContent = reloadLabel();
    if (onReloadEnd) onReloadEnd();
  }

  function finishReload() {
    if (!reloading) return;
    reloading = false;
    reloadDur = 0;
    ammo = weapon ? weapon.mag : 0;
    setReloadRing(0);
    const btn = hud.querySelector("#reload-btn");
    if (btn) btn.textContent = reloadLabel();
    if (onReloadEnd) onReloadEnd();
    updateAmmo();
  }

  function attachRemoteGun(root) {
    const weapon = root.userData.weaponId ? getWeapon(root.userData.weaponId) : null;
    if (root.userData.remoteGun) {
      if (weapon && root.userData.remoteGunWeaponId !== (weapon && weapon.id)) {
        root.remove(root.userData.remoteGun);
        root.userData.remoteGun = null;
      } else if (!weapon && root.userData.remoteGunWeaponId) {
        root.remove(root.userData.remoteGun);
        root.userData.remoteGun = null;
      }
      if (root.userData.remoteGun) return;
    }
    if (!weapon) return;
    const rg = makeOwnWeapon(weapon);
    rg.userData.remoteGun = true;
    rg.userData.remoteGunWeaponId = weapon.id;
    root.userData.remoteGun = rg;
    root.userData.remoteGunWeaponId = weapon.id;
    root.add(rg);
    setAvatarWeapon(root, rg);
    if (root.userData.blocking) setRemoteBlocking(root, true);
  }

  function setRemoteWeapon(root, weaponId) {
    if (!root) return;
    root.userData.weaponId = weaponId || null;
    attachRemoteGun(root);
  }

  function detachRemoteGun(root) {
    if (root.userData.remoteGun) {
      root.remove(root.userData.remoteGun);
      root.userData.remoteGun = null;
    }
    setAvatarWeapon(root, null);
  }

  function setWeapon(id) {
    const next = id ? getWeapon(id) : null;
    const nextId = next ? next.id : null;
    if (nextId === weaponId) {
      updateAmmo();
      return;
    }
    weaponId = nextId;
    weapon = next;
    ammo = weapon ? weapon.mag : 0;
    cancelReload();
    blockSuppressed = false;
    if (!weapon || !weapon.block) stopBlock();
    updateAmmo();
    updateBlockHud();
    if (enabled && getOwnAvatar()) {
      const avatar = getOwnAvatar();
      if (gun && gun.parent) gun.parent.remove(gun);
      gun = weapon ? makeOwnWeapon(weapon) : null;
      if (gun) {
        avatar.add(gun);
      }
      setAvatarWeapon(avatar, gun);
    }
  }

  function setEnabled(value) {
    enabled = value;
    hud.hidden = !value;
    aimLine.visible = value && SHOW_AIM_LINE;
    if (value) {
      if (!gun && weapon && getOwnAvatar()) {
        gun = makeOwnWeapon(weapon);
        const avatar = getOwnAvatar();
        avatar.add(gun);
        setAvatarWeapon(avatar, gun);
      }
      for (const [, remote] of getRemotes()) {
        attachRemoteGun(remote.group);
      }
      updateAmmo();
    } else {
      stopBlock();
      if (gun && gun.parent) gun.parent.remove(gun);
      gun = null;
      if (getOwnAvatar()) setAvatarWeapon(getOwnAvatar(), null);
      for (const [, remote] of getRemotes()) {
        detachRemoteGun(remote.group);
      }
      cancelReload();
      const btn = hud.querySelector("#reload-btn");
      if (btn) btn.textContent = reloadLabel();
      ammo = weapon ? weapon.mag : 0;
      updateAmmo();
    }
    updateBlockHud();
  }

  function setOwn(hp, alive) {
    const wasAlive = ownAlive;
    ownHp = hp;
    ownAlive = alive;
    const inner = hud.querySelector(".hp-bar-inner");
    if (inner) {
      inner.style.width = `${Math.max(0, Math.min(100, hp))}%`;
      inner.style.background = hp > 50 ? "#4ade80" : hp > 25 ? "#fbbf24" : "#f87171";
    }
    const text = hud.querySelector(".hp-text");
    if (text) text.textContent = String(Math.round(hp));
    const avatar = getOwnAvatar();
    if (!alive) {
      stopBlock();
      cancelReload();
      ownRespawnActive = true;
      ownRespawnEnd = performance.now() + RESPAWN_MS;
      if (avatar && wasAlive) {
        const pos = getOwnPosition();
        startMelt("__own__", avatar, pos.x, pos.z, ownColor(avatar));
      }
    } else {
      ownRespawnActive = false;
      const overlay = hud.querySelector(".respawn-overlay");
      if (overlay) overlay.hidden = true;
      if (avatar) startRise("__own__", avatar);
    }
    updateAmmo();
  }

  function ensureRemoteBar(id, color, name) {
    if (hpBars.has(id)) return hpBars.get(id);
    const bar = makeBarSprite(1.6, color);
    bar.sprite.position.y = 2.25;
    const group = getRemotes().get(id);
    if (group) group.group.add(bar.sprite);
    const barData = { ...bar, color, name, ratio: 1 };
    hpBars.set(id, barData);
    return barData;
  }

  function setRemoteHp(id, hp) {
    const group = getRemotes().get(id);
    if (!group) return;
    let barData = hpBars.get(id);
    if (!barData) {
      barData = ensureRemoteBar(id, group.color || "#4c84ff", "");
    }
    barData.ratio = hp / MAX_HP;
    drawBar(barData, barData.ratio);
    if (hp <= 0) {
      deadIds.add(id);
      if (!puddles.has(id)) {
        startMelt(id, group.group, group.group.position.x, group.group.position.z, barData.color);
      }
      if (barData.sprite.parent) barData.sprite.removeFromParent();
    } else {
      deadIds.delete(id);
      if (puddles.has(id)) startRise(id, group.group);
      if (!barData.sprite.parent) group.group.add(barData.sprite);
    }
  }

  function movePuddle(id, x, z) {
    const puddleId = id === getOwnId() ? "__own__" : id;
    const puddle = puddles.get(puddleId);
    if (puddle) {
      puddle.group.position.x = x;
      puddle.group.position.z = z;
    }
  }

  function setFriends(list) {
    for (const id of [...hpBars.keys()]) {
      if (!list.some((player) => player.id === id)) {
        hpBars.delete(id);
      }
    }
    for (const player of list) {
      if (player.id === getOwnId()) continue;
      ensureRemoteBar(player.id, player.color, player.name);
      setRemoteHp(player.id, player.hp);
    }
  }

  function startMelt(id, root, x, z, color) {
    stopFx(id);
    const puddle = makePuddle(color);
    puddle.group.position.set(x, 0, z);
    scene.add(puddle.group);
    puddles.set(id, puddle);
    fx.push({
      id,
      kind: "melt",
      root,
      start: performance.now(),
      dur: MELT_DUR * 1000,
      storeY: root.position.y,
      storeScale: root.scale.y,
      puddle,
    });
  }

  function startRise(id, root) {
    // Si la baja y el respawn se encadenan, la animación de melt todavía podría
    // ocultar el avatar justo después de empezar el rise. La cancelamos primero.
    stopFx(id);
    const puddle = puddles.get(id);
    if (!puddle) {
      root.visible = true;
      rootBody(root, { scale: 1, opacity: 1 });
      root.scale.y = root.userData.initScale || 1;
      root.position.y = root.userData.initY || 0;
      return;
    }
    root.visible = true;
    fx.push({
      id,
      kind: "rise",
      root,
      start: performance.now(),
      dur: RISE_DUR * 1000,
      storeY: root.position.y,
      storeScale: Math.max(0.02, root.scale.y || 0.02),
      puddle,
    });
  }

  function stopFx(id) {
    for (let i = fx.length - 1; i >= 0; i--) {
      if (fx[i].id === id) fx.splice(i, 1);
    }
  }

  function stepFx() {
    const now = performance.now();
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      const k = Math.min(1, (now - f.start) / f.dur);
      const e = easeOutCubic(k);
      if (f.kind === "melt") {
        rootBody(f.root, { scale: Math.max(0.02, f.storeScale * (1 - e)), opacity: 1 - e });
        f.root.position.y = f.storeY + (0 - f.storeY) * e;
        f.puddle.liquid.material.opacity = 0.9 * e;
        f.puddle.glossy.material.opacity = 0.4 * e;
        if (k >= 1) {
          f.root.visible = false;
          f.puddle.liquid.material.opacity = 0.9;
          f.puddle.glossy.material.opacity = 0.4;
          fx.splice(i, 1);
        }
      } else if (f.kind === "rise") {
        rootBody(f.root, { scale: Math.max(0.02, f.storeScale * (1 - e) + e), opacity: e });
        f.root.position.y = f.storeY + (0 - f.storeY) * (1 - e);
        f.puddle.liquid.material.opacity = 0.9 * (1 - e);
        f.puddle.glossy.material.opacity = 0.4 * (1 - e);
        if (k >= 1) {
          f.root.visible = true;
          rootBody(f.root, { scale: 1, opacity: 1 });
          f.root.position.y = 0;
          clearPuddle(f);
          fx.splice(i, 1);
        }
      }
    }
  }

  function rootBody(root, { scale, opacity }) {
    root.scale.y = scale;
    root.traverse((child) => {
      if ((child.isMesh || child.isSprite) && child.material && child.name !== "deathWings") {
        child.material.transparent = true;
        child.material.opacity = opacity;
      }
    });
  }

  function clearPuddle(f) {
    const puddle = f.puddle;
    if (!puddle) return;
    puddles.delete(f.id);
    scene.remove(puddle.group);
    disposePuddle(puddle);
  }

  function aimRay() {
    const external = getOwnAim ? getOwnAim() : null;
    if (external && typeof external.dx === "number" && typeof external.dz === "number") {
      return { dx: external.dx, dz: external.dz };
    }
    const avatar = getOwnAvatar();
    if (!avatar) return null;
    const facing = avatar.rotation.y;
    const dx = Math.sin(facing);
    const dz = Math.cos(facing);
    return { dx, dz };
  }

  function clientHit(origin, dx, dz, range, arc = null, radius = RAY_RADIUS) {
    let bestTarget = null;
    let bestT = range + 1;
    const arcCos = arc != null ? Math.cos(Math.min(Math.PI, arc / 2)) : -2;
    for (const [id, remote] of getRemotes()) {
      if (deadIds.has(id)) continue;
      const x = remote.targetX;
      const z = remote.targetZ;
      const ox = x - origin.x;
      const oz = z - origin.z;
      const dist = Math.hypot(ox, oz);
      if (dist > range || dist < 1e-3) continue;
      const along = ox * dx + oz * dz;
      if (along < 0) continue;
      if ((ox * dx + oz * dz) / dist < arcCos) continue;
      const px = origin.x + dx * along;
      const pz = origin.z + dz * along;
      if (Math.hypot(x - px, z - pz) <= radius && along < bestT) {
        bestT = along;
        bestTarget = { id, x, z, dist };
      }
    }
    return bestTarget;
  }

  function fire() {
    const now = performance.now();
    if (!enabled || !ownAlive || !weapon) return;
    if (reloading) return;
    // Con el escudo levantado solo se puede hacer bash; las armas de fuego no
    // disparan mientras bloqueas (el servidor también lo rechaza).
    if (blocking && weapon.id !== "escudo") return;
    const infinite = weapon.mag === 0;
    if (!infinite && ammo <= 0) {
      playEmpty();
      return;
    }
    if (now - lastShot < weapon.cooldownMs) return;
    lastShot = now;
    if (!infinite) ammo -= 1;
    updateAmmo();
    playShoot(weapon);
    if (!infinite && ammo <= 0 && autoReload) startReload();
    const origin = getOwnPosition();
    const ray = aimRay();
    if (!origin || !ray) return;
    shoot(ray.dx, ray.dz);

    if (weapon.kind === "melee") {
      playSwish();
      swing = now;
      const hit = clientHit(origin, ray.dx, ray.dz, weapon.range, weapon.arc, rayRadiusFor(weapon));
      if (hit) spawnBlood(hit.x, hit.z);
      if (onOwnFire) {
        onOwnFire({
          weaponId: weapon.id,
          kind: "melee",
          damage: hit ? damageAtRange(weapon, hit.dist) : 0,
        });
      }
      return;
    }

    playMuzzle(now);
    recoil = now;
    if (onOwnFire) onOwnFire({ weaponId: weapon.id, kind: "gun" });

    for (let i = 0; i < weapon.pellets; i++) {
      const spread = weapon.spread * (Math.random() * 2 - 1);
      const cos = Math.cos(spread);
      const sin = Math.sin(spread);
      const pdx = ray.dx * cos - ray.dz * sin;
      const pdz = ray.dz * cos + ray.dx * sin;
      const hit = clientHit(origin, pdx, pdz, weapon.range, null, rayRadiusFor(weapon));
      const impact = hit
        ? { x: hit.x, z: hit.z }
        : { x: origin.x + pdx * weapon.range, z: origin.z + pdz * weapon.range };
      spawnProjectile(origin, pdx, pdz, impact, weapon);
    }
  }

  function playMuzzle(now) {
    if (gun && gun.userData.muzzle) {
      gun.userData.muzzle.visible = true;
      flashTimer = now + 90;
    }
  }

  function spawnProjectile(from, dx, dz, to, weapon) {
    const proj = (weapon && weapon.projectile) || { shape: "capsule", size: 0.06, color: 0x4c84ff };
    const color = weapon ? weapon.color : 0x4c84ff;
    let mesh;
    if (proj.shape === "sphere") {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(proj.size, 10, 8),
        new THREE.MeshBasicMaterial({ color })
      );
    } else {
      mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(proj.size, 0.22, 4, 6),
        new THREE.MeshBasicMaterial({ color })
      );
    }
    mesh.position.set(from.x, 0.95, from.z);
    scene.add(mesh);
    projectiles.push({
      mesh,
      x: from.x,
      z: from.z,
      tx: to.x,
      tz: to.z,
      nx: dx,
      nz: dz,
      age: 0,
    });
  }

  function spawnBlood(x, z) {
    const count = 9;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(bloodDot()),
        transparent: true,
        color: 0xc2272c,
      });
      const sprite = new THREE.Sprite(mat);
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.4;
      sprite.position.set(x, 0.9 + Math.random() * 0.4, z);
      sprite.scale.set(0.22, 0.22, 1);
      scene.add(sprite);
      blood.push({
        sprite,
        mat,
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        vy: 1.5 + Math.random() * 1.5,
        life: 0.5,
        maxLife: 0.5,
      });
    }
  }

  function bloodDot() {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(8, 8, 1, 8, 8, 8);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(194,39,44,1)");
    g.addColorStop(1, "rgba(194,39,44,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
    return c;
  }

  // Chispas del escudo: partículas cortas y brillantes en el punto del impacto.
  function spawnSparks(x, z) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(bloodDot()),
        transparent: true,
        color: i % 2 ? 0xfff3b0 : 0x9fd8ff,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.4 + Math.random() * 2.4;
      sprite.position.set(x, 0.8 + Math.random() * 0.55, z);
      sprite.scale.set(0.16, 0.16, 1);
      scene.add(sprite);
      blood.push({
        sprite,
        mat,
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        vy: 1.6 + Math.random() * 1.8,
        life: 0.35,
        maxLife: 0.35,
      });
    }
  }

  function onShot(data) {
    if (data.targetId === getOwnId()) {
      setOwn(data.targetHp, ownAlive);
    } else if (data.targetId) {
      setRemoteHp(data.targetId, data.targetHp);
    }

    if (data.shooterId === getOwnId()) return;

    const remote = getRemotes().get(data.shooterId);
    const from = remote ? { x: remote.targetX, z: remote.targetZ } : null;
    if (from) {
      const weapon = getWeapon(data.weaponId);
      if (weapon && weapon.kind === "melee") {
        if (data.hit && !data.blocked) spawnBlood(data.x, data.z);
        return;
      }
      spawnProjectile(from, data.dx || 0, data.dz || 0, { x: data.x, z: data.z }, weapon);
    }
    if (data.hit && !data.blocked) spawnBlood(data.x, data.z);
  }

  function onBoom(x, z, r, snow) {
    if (snow) {
      playSnowburst();
    } else {
      playExplosion();
    }

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 10, 8),
      new THREE.MeshBasicMaterial({
        color: snow ? 0xdfeaff : 0xffd166,
        transparent: true,
        opacity: 0.9,
      })
    );
    flash.position.set(x, 0.9, z);
    scene.add(flash);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.4, 28),
      new THREE.MeshBasicMaterial({
        color: snow ? 0x8fc7ff : 0xff8c3a,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.15, z);
    scene.add(ring);

    explosions.push({ flash, ring, start: performance.now(), dur: 450, r, snow: !!snow });
  }

  function onThrowSpawn(data) {
    const snow = !!data.snow;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(snow ? 0.14 : 0.17, 10, 8),
      new THREE.MeshBasicMaterial({ color: snow ? 0xeef6ff : 0x2f3f4f })
    );
    if (!snow) {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff9e55 })
      );
      cap.position.y = 0.14;
      mesh.add(cap);
    }
    mesh.position.set(data.x, 0.6, data.z);
    scene.add(mesh);
    itemFlights.push({
      mesh,
      x: data.x,
      z: data.z,
      tx: data.toX,
      tz: data.toZ,
      dur: data.flightMs,
      start: performance.now(),
      snow,
    });
  }

  function stepItemFlights(now) {
    for (let i = itemFlights.length - 1; i >= 0; i--) {
      const f = itemFlights[i];
      const k = f.dur > 0 ? Math.min(1, (now - f.start) / f.dur) : 1;
      if (k >= 1) {
        scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        f.mesh.material.dispose();
        itemFlights.splice(i, 1);
        continue;
      }
      const arc = Math.sin(k * Math.PI);
      f.mesh.position.set(
        f.x + (f.tx - f.x) * k,
        0.55 + arc * 1.9,
        f.z + (f.tz - f.z) * k
      );
      f.mesh.rotation.x = k * 10;
      f.mesh.rotation.z = Math.sin(k * 14) * 0.6;
    }
  }

  function update(dt) {
    const now = performance.now();
    stepFx();
    stepItemFlights(now);
    if (reloading) {
      if (reloadDur > 0) {
        const elapsed = now - (reloadEnd - reloadDur);
        setReloadRing((elapsed / reloadDur) * 100);
      }
      if (now >= reloadEnd) finishReload();
    }
    if (blockCfg()) updateBlockHud();

    if (gun && gun.userData.muzzle && flashTimer && now > flashTimer) {
      gun.userData.muzzle.visible = false;
      flashTimer = 0;
    }

    if (gun) {
      const baseRotY = gun.userData.baseRotY || 0;
      const baseZ = gun.userData.baseZ != null ? gun.userData.baseZ : gun.position.z;
      const baseY = gun.userData.baseY != null ? gun.userData.baseY : gun.position.y;
      if (weapon && weapon.kind === "melee") {
        if (blocking && weapon.block) {
          // Pose de guardia: escudo al pecho, ligeramente adelantado.
          gun.rotation.set(-0.5, baseRotY, 0);
          gun.position.z = baseZ - 0.12;
          gun.position.y = baseY + 0.12;
        } else {
          const off = swing && now - swing < 300 ? (now - swing) / 300 : 1;
          gun.position.z = baseZ;
          gun.position.y = baseY;
          if (off < 1) {
            const s = Math.sin(off * Math.PI);
            gun.rotation.set(-s * 0.9, baseRotY, s * 0.45);
            gun.position.z = baseZ - s * 0.08;
          } else {
            gun.rotation.set(0, baseRotY, 0);
          }
        }
      } else {
        const offset = recoil && now - recoil < 130 ? (now - recoil) / 130 : 0;
        const push = Math.pow(1 - offset, 2) * 0.12;
        gun.position.z = baseZ + push;
        if (gun.userData.spin) {
          const firing = recoil && now - recoil < 200;
          gun.userData.spin.rotation.z += dt * (firing ? 38 : 3.5);
        }
      }
    }

    if (SHOW_AIM_LINE && enabled && getOwnAvatar()) {
      const ray = aimRay();
      const origin = getOwnPosition();
      if (ray && origin) {
        const range = weapon ? weapon.range : 0;
        const endX = origin.x + ray.dx * range;
        const endZ = origin.z + ray.dz * range;
        const positions = new Float32Array([
          origin.x, 0.95, origin.z,
          endX, 0.95, endZ,
        ]);
        aimLine.geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(positions, 3)
        );
        aimLine.geometry.computeBoundingSphere();
        aimLine.visible = SHOW_AIM_LINE && enabled && !!weapon;
      }
    }

    for (let i = explosions.length - 1; i >= 0; i--) {
      const e = explosions[i];
      const k = Math.min(1, (performance.now() - e.start) / e.dur);
      const scale = 0.6 + (e.r - 0.2) * easeOutCubic(k);
      e.ring.scale.setScalar(scale);
      e.ring.material.opacity = 0.85 * (1 - k);
      e.flash.scale.setScalar(1 + k * 1.4);
      e.flash.material.opacity = 0.9 * (1 - k);
      if (k >= 1) {
        scene.remove(e.ring);
        scene.remove(e.flash);
        e.ring.geometry.dispose();
        e.ring.material.dispose();
        e.flash.geometry.dispose();
        e.flash.material.dispose();
        explosions.splice(i, 1);
      }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += p.nx * PROJ_SPEED * dt;
      p.z += p.nz * PROJ_SPEED * dt;
      p.age += dt;
      p.mesh.position.set(p.x, 0.95, p.z);
      if (Math.hypot(p.tx - p.x, p.tz - p.z) < 0.5 || p.age > 6) {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        projectiles.splice(i, 1);
      }
    }

    for (let i = blood.length - 1; i >= 0; i--) {
      const b = blood[i];
      b.life -= dt;
      b.vy -= 3 * dt;
      b.sprite.position.x += b.vx * dt;
      b.sprite.position.z += b.vz * dt;
      b.sprite.position.y = Math.max(0.02, b.sprite.position.y + b.vy * dt);
      b.sprite.material.opacity = Math.max(0, b.life / b.maxLife);
      if (b.life <= 0) {
        scene.remove(b.sprite);
        b.sprite.material.map.dispose();
        b.sprite.material.dispose();
        blood.splice(i, 1);
      }
    }

    if (ownRespawnActive) {
      const remaining = Math.max(0, (ownRespawnEnd - now) / 1000);
      const overlay = hud.querySelector(".respawn-overlay");
      const respawnText = overlay ? overlay.querySelector(".respawn-text") : null;
      if (respawnText) respawnText.textContent = `${Math.ceil(remaining)}s`;
    }
  }

  function tryShoot() {
    if (enabled) fire();
  }

  function reattachOwnGun() {
    if (!enabled || !weapon) return;
    const avatar = getOwnAvatar();
    if (!avatar) return;
    if (!gun) {
      gun = makeOwnWeapon(weapon);
      avatar.add(gun);
    } else {
      avatar.add(gun);
    }
    setAvatarWeapon(avatar, gun);
  }

  function reloadButton() {
    return hud.querySelector("#reload-btn");
  }

  function forget(id) {
    deadIds.delete(id);
    hpBars.delete(id);
    stopFx(id);
    const puddle = puddles.get(id);
    if (puddle) {
      puddles.delete(id);
      scene.remove(puddle.group);
      disposePuddle(puddle);
    }
  }

  function reset() {
    weaponId = null;
    weapon = null;
    ammo = 0;
    cancelReload();
    reloading = false;
    reloadDur = 0;
    enabled = false;
    blocking = false;
    blockStamina = BLOCK_STAMINA_MAX;
    blockBrokenUntil = 0;
    blockSuppressed = false;
    lastBlockSent = 0;
    if (gun && gun.parent) gun.parent.remove(gun);
    gun = null;
    if (getOwnAvatar()) setAvatarWeapon(getOwnAvatar(), null);
    ownRespawnActive = false;
    ownRespawnEnd = 0;
    ownAlive = true;
    ownHp = MAX_HP;
    const overlay = hud.querySelector(".respawn-overlay");
    if (overlay) overlay.hidden = true;
    aimLine.visible = false;
    fx.length = 0;
    for (const [id, puddle] of puddles) {
      scene.remove(puddle.group);
      disposePuddle(puddle);
    }
    puddles.clear();
    updateAmmo();
    updateBlockHud();
  }

  function isAnimating(id) {
    const fxId = id === getOwnId() ? "__own__" : id;
    return fx.some((f) => f.id === fxId);
  }

  function rebindScene(newScene) {
    if (scene === newScene) return;
    scene.remove(aimLine);
    for (const [, puddle] of puddles) {
      scene.remove(puddle.group);
      newScene.add(puddle.group);
    }
    scene = newScene;
    newScene.add(aimLine);
  }

  function dispose() {
    reset();
    scene.remove(aimLine);
    aimLine.geometry.dispose();
    aimLine.material.dispose();
    if (hud && hud.parentNode) {
      hud.remove();
    }
  }

  return {
    show: () => setEnabled(true),
    hide: () => setEnabled(false),
    setEnabled,
    setOwn,
    setRemoteHp,
    setFriends,
    onShot,
    update,
    forget,
    reset,
    dispose,
    tryShoot,
    reload: startReload,
    isAnimating,
    reloadButton,
    movePuddle,
    reattachOwnGun,
    rebindScene,
    setWeapon,
    setAutoReload: (b) => { autoReload = !!b; },
    getWeaponId: () => weaponId,
    setBlock,
    updateBlock,
    isBlocking,
    onBlock,
    onBlocked,
    getBlockStamina: () => blockStamina,
    isGuardBroken: () => performance.now() < blockBrokenUntil,
    isBlockSuppressed: () => blockSuppressed,
    setRemoteWeapon,
    onBoom,
    onThrowSpawn,
    makeRemoteGun: () => makeOwnWeapon(getWeapon(WEAPON_DEFAULT_ID)),
    makeViewGun: (id) => {
      const w = id ? getWeapon(id) : null;
      return w ? makeOwnWeapon(w) : null;
    },
    getSwing: () => swing,
    getWeaponDef: () => weapon,
    attachRemoteGun,
  };
}