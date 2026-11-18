import { createWorld, getRoomMaps, getMap, getTerrainHeightAt } from "./world.js";
import { createAvatar, animateAvatar } from "./avatar.js";
import { moveWithCollisions } from "./collision.js";
import { getInputDirection, isTyping, isKeyDown } from "./input.js";
import { createMotionState, stepMotion } from "./motion.js";
import { openDressing, closeDressing } from "./dressing.js";
import {
  connectToGame,
  sendMove,
  sendChat,
  createRoom,
  joinRoom,
  leaveRoom,
  kickPlayer,
  closeRoom,
  sendVoiceSignal,
  sendShoot,
  sendBlock,
  sendCrystalOffer,
  sendCrystalRespond,
  sendInventoryUse,
  sendInventoryThrow,
  buyWeapon,
  leaveServer,
} from "./network.js";
import { createVoiceManager } from "./voice.js";
import { setupChatUI } from "./chat.js";
import { createMinimap } from "./minimap.js";
import { createHockey } from "./hockey.js";
import { createCombat } from "./combat.js";
import { buildViewmodel } from "./viewmodel.js";
import { createLoot } from "./loot.js";
import { createInventoryBar } from "./inventory.js";
import { createScoreboard } from "./scoreboard.js";
import { createShop } from "./shop.js";
import { getWeapon } from "./weaponDefs.js";
import { isTouchMode, initTouchControls } from "./touch.js";
import {
  getSensitivity,
  isAutoReloadEnabled,
  setupSettings,
  setupHelp,
  maybeShowHelp,
  setupSocialTabs,
  setupMobileMenu,
  registerChat,
  showToast,
} from "./hud.js";
import {
  getSession,
  setSession,
  clearSession,
  apiRegister,
  apiLogin,
  apiMe,
  apiSaveAppearance,
  apiLogout,
} from "./session.js";

const joinScreen = document.getElementById("join-screen");
const joinForm = document.getElementById("join-form");
const nameInput = document.getElementById("name-input");
const passwordInput = document.getElementById("password-input");
const registerBtn = document.getElementById("register-btn");
const joinError = document.getElementById("join-error");
const gameScreen = document.getElementById("game");
const gameError = document.getElementById("game-error");
const onlineList = document.getElementById("online-list");
const logoutBtn = document.getElementById("logout-btn");
const roomCreateForm = document.getElementById("room-create-form");
const roomNameInput = document.getElementById("room-name-input");
const roomMapSelect = document.getElementById("room-map-select");
const roomJoinForm = document.getElementById("room-join-form");
const roomCodeInput = document.getElementById("room-code-input");
const roomPlace = document.getElementById("room-place");
const roomCurrent = document.getElementById("room-current");
const roomOwnerInfo = document.getElementById("room-owner-info");
const roomLeaveBtn = document.getElementById("room-leave-btn");
const roomCloseBtn = document.getElementById("room-close-btn");
const roomsTitleText = document.getElementById("rooms-title-text");
const roomInfoToggle = document.getElementById("room-info-toggle");
const roomListEl = document.getElementById("room-list");
const roomErrorEl = document.getElementById("room-error");
const voiceBtn = document.getElementById("voice-btn");
const voiceStatus = document.getElementById("voice-status");
const headerPlace = document.getElementById("header-place");
const fpToggleBtn = document.getElementById("fp-toggle");
const fpCrosshairEl = document.getElementById("fp-crosshair");
const fpHintEl = document.getElementById("fp-hint");
const staminaHudEl = document.getElementById("motion-stamina");
const staminaFillEl = document.getElementById("motion-stamina-fill");

const WALK_SPEED = 6;
const MOVE_SEND_INTERVAL = 50;
const FP_EYE = 1.35;
let cameraRecoilKick = 0;

for (const map of getRoomMaps()) {
  const option = document.createElement("option");
  option.value = map.id;
  option.textContent = map.name;
  roomMapSelect.appendChild(option);
}

let started = false;
let running = false;

function isLoading(message) {
  joinError.textContent = message;
}

function showJoinError(message) {
  joinError.textContent = message;
}

logoutBtn.addEventListener("click", handleLogout);

joinForm.addEventListener("submit", handleJoinSubmit);
registerBtn.addEventListener("click", handleRegister);

roomCreateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearRoomError();
  createRoom(roomNameInput.value.trim(), roomMapSelect.value);
  roomNameInput.value = "";
});

roomJoinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearRoomError();
  joinRoom(roomCodeInput.value.trim());
  roomCodeInput.value = "";
});

roomLeaveBtn.addEventListener("click", () => {
  clearRoomError();
  leaveRoom();
});

roomCloseBtn.addEventListener("click", () => {
  clearRoomError();
  closeRoom();
});

if (roomInfoToggle) {
  roomInfoToggle.addEventListener("click", () => {
    setRoomInfoCollapsed(!document.body.classList.contains("room-info-collapsed"));
  });
}

const shopOpenBtn = document.getElementById("shop-open-btn");
if (shopOpenBtn) {
  shopOpenBtn.addEventListener("click", () => {
    if (!shop || !shop.show()) {
      if (!myRoom) showToast("La tienda solo está disponible dentro de una sala");
    }
  });
}

voiceBtn.addEventListener("click", handleVoiceToggle);

document.getElementById("wardrobe-btn").addEventListener("click", openWardrobe);
if (fpToggleBtn) fpToggleBtn.addEventListener("click", toggleFPView);

const TOUCH_MODE = isTouchMode();
if (TOUCH_MODE) document.body.classList.add("touch-mode");

setupSocialTabs();
setupHelp();
setupSettings({
  onAutoReload: (value) => {
    if (combat) combat.setAutoReload(value);
  },
});
setupMobileMenu({
  onWardrobe: openWardrobe,
  onLogout: handleLogout,
});

let minimap = null;
let paused = false;

document.addEventListener("visibilitychange", () => {
  paused = document.hidden;
});

addEventListener("keydown", (event) => {
  if (gameScreen.hidden || !chat || dressingOpen()) return;
  const active = document.activeElement;
  const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
  if (event.key === "Tab" && !typing) {
    event.preventDefault();
    if (scoreboard && scoreboard.show()) return;
    if (!myRoom) showToast("El marcador está disponible dentro de una sala");
    return;
  }
  if ((event.key === "b" || event.key === "B") && !typing) {
    event.preventDefault();
    if (shop && shop.toggle()) return;
    if (!myRoom) showToast("La tienda solo está disponible dentro de una sala");
    return;
  }
  if (event.key === "Escape" && !typing) {
    if (shop && shop.isOpen()) {
      event.preventDefault();
      shop.hide();
      return;
    }
    if (scoreboard && scoreboard.isOpen()) {
      event.preventDefault();
      scoreboard.hide();
      return;
    }
  }
  if (event.key === "Enter" && !typing) {
    event.preventDefault();
    // Si hay un cristal ofrecido, Enter lo recoge (sin tocar el ratón).
    if (loot && loot.acceptOffer()) return;
    chat.open();
  } else if (event.key === "Escape" && (typing || chat.isFocused())) {
    event.preventDefault();
    chat.blur();
  } else if ((event.code === "Space" || event.key === " ") && !typing) {
    event.preventDefault();
    if (event.repeat) return;
    // Fase 4: Espacio salta; disparar queda en clic izquierdo / botón táctil.
    jumpQueued = true;
  } else if (
    (event.code === "KeyC" ||
      event.code === "ControlLeft" ||
      event.code === "ControlRight" ||
      event.key === "Control") &&
    !typing
  ) {
    event.preventDefault();
    if (event.repeat) return;
    slideQueued = true;
  } else if ((event.code === "KeyQ" || event.key === "q" || event.key === "Q") && !typing) {
    if (event.repeat) return;
    event.preventDefault();
    blockHeldKey = true;
    const def = combat ? combat.getWeaponDef() : null;
    if (!myRoom) showToast("Entra a una sala para combatir");
    else if (def && def.block) combat.setBlock(true, cameraYaw);
    else showToast("Necesitas el escudo para bloquear");
  } else if ((event.code === "KeyR" || event.key === "r" || event.key === "R") && !typing) {
    event.preventDefault();
    if (combat) combat.reload();
  }
});

addEventListener("keyup", (event) => {
  if (event.key === "Tab") {
    if (scoreboard) scoreboard.hide();
    return;
  }
  if (event.code !== "KeyQ" && event.key !== "q" && event.key !== "Q") return;
  blockHeldKey = false;
  if (!blockHeldMouse && combat) combat.setBlock(false, cameraYaw);
});

addEventListener("blur", () => stopBlocking());

async function handleJoinSubmit(event) {
  event.preventDefault();
  const name = nameInput.value.trim();
  const password = passwordInput.value;

  if (!name) {
    showJoinError("Escribe un nombre para entrar.");
    return;
  }

  try {
    if (password) {
      isLoading("Iniciando sesión…");
      const { status, body } = await apiLogin(name, password);
      if (status !== 200) {
        showJoinError(body.error || "No se pudo iniciar sesión.");
        return;
      }
      setSession(body.token, body.user.username);
      beginDressing(body.user, body.token);
    } else {
      beginDressing({ username: name }, null);
    }
  } catch (err) {
    showJoinError("Problema de red: " + err.message);
  }
}

async function handleRegister() {
  const name = nameInput.value.trim();
  const password = passwordInput.value;

  if (!name) {
    showJoinError("Escribe un nombre para crear la cuenta.");
    return;
  }
  if (!password) {
    showJoinError("Escribe una contraseña para crear la cuenta.");
    return;
  }

  try {
    isLoading("Creando cuenta…");
    const { status, body } = await apiRegister(name, password);
    if (status !== 201) {
      showJoinError(body.error || "No se pudo crear la cuenta.");
      return;
    }
    setSession(body.token, body.user.username);
    beginDressing(body.user, body.token);
  } catch (err) {
    showJoinError("Problema de red: " + err.message);
  }
}

async function autoLogin() {
  const { token, username } = getSession();
  if (!token || !username) return;

  isLoading("Reconectando…");
  const { status, body } = await apiMe(token);
  if (status !== 200) {
    clearSession();
    showJoinError("");
    return;
  }
  beginDressing(body.user, token);
}

autoLogin();

let chat;
let scene;
let camera;
let renderer;
let myId = null;
let myAvatar = null;
let myName = null;
let myPosition = { x: 0, z: 0 };
let myOwnHp = 100;
let myOwnAlive = true;
let lastMoveSend = 0;
let lastUpdate = performance.now();
let currentToken = null;
let myAppearance = null;
let myColor = null;
let myRoom = null;
let hosting = false;
let lastRoomPanelCode = null;
let currentPlayers = [];
let voice = null;
let voiceRunning = false;
let combat = null;
let loot = null;
let inventoryBar = null;
let scoreboard = null;
let shop = null;
let myScore = 0;
let slowUntil = 0;
let motion = createMotionState();
let jumpQueued = false;
let slideQueued = false;
// Último frame en el que el jugador quiso moverse pero una pared/borde lo
// dejó casi clavado: se usa para no gastar stamina corriendo contra un muro.
let lastBlocked = false;
let world = null;
let currentMapId = "nevado";
let hockey = null;
let cameraYaw = 0;
let cameraPitch = 0.35;
let fpMode = false;let viewGun = null;
let viewRig = null;
let viewWid = null;
let draggingCamera = false;
let lastMouseX = 0;
let lastMouseY = 0;
let touchCtl = null;
let blockHeldKey = false;
let blockHeldMouse = false;
let blockHeldTouch = false;
const remotes = new Map();

function blockMoveScale() {
  const def = combat && combat.getWeaponDef ? combat.getWeaponDef() : null;
  return (def && def.block && def.block.moveScale) || 0.55;
}

function stopBlocking() {
  blockHeldKey = false;
  blockHeldMouse = false;
  blockHeldTouch = false;
  if (combat) combat.setBlock(false, cameraYaw);
}

function blockHeld() {
  return blockHeldKey || blockHeldMouse || blockHeldTouch;
}

// Keepalive propio del escudo, independiente de requestAnimationFrame. Si el
// navegador estrangula el bucle de render (pestaña en segundo plano, GC, tirón
// de carga) el servidor cortaría el bloqueo y el escudo quedaría bajado aunque
// el jugador siguiera pulsando Q. Aquí se reenvía el bloqueo y, si el servidor
// lo cortó por un hueco de red, se vuelve a levantar mientras siga pulsado.
setInterval(() => {
  if (!combat || !myRoom || !myOwnAlive || !blockHeld()) return;
  const def = combat.getWeaponDef();
  if (!def || !def.block) return;
  // Durante el guard break o sin aguante no se reintenta: el servidor
  // reiniciaría el castigo en cada intento.
  if (combat.isGuardBroken() || combat.getBlockStamina() <= 0) return;
  // Tras romperse la guardia hay que soltar y volver a pulsar.
  if (combat.isBlockSuppressed()) return;
  if (combat.isBlocking()) combat.updateBlock(cameraYaw);
  else combat.setBlock(true, cameraYaw);
}, 140);

function syncShieldButton() {
  const def = combat && combat.getWeaponDef ? combat.getWeaponDef() : null;
  document.body.classList.toggle("has-shield", !!(def && def.block));
}

function dressingOpen() {
  return !document.getElementById("dress-screen").hidden;
}

function openWardrobe() {
  if (!running || !myAvatar || !myOwnAlive) return;
  if (combat && combat.isAnimating(myId)) return;
  openDressing({
    name: myName,
    appearance: myAppearance,
    onPlay: (appearance) => {
      myAppearance = appearance;
      if (currentToken) {
        apiSaveAppearance(currentToken, appearance).catch((err) =>
          console.warn("No se guardó la apariencia:", err)
        );
      }
      applyAppearance(appearance);
    },
    onBack: () => {
      closeDressing();
    },
  });
}

function applyAppearance(appearance) {
  if (!myAvatar) return;
  if (combat && combat.isAnimating(myId)) return;
  myPosition = { x: myAvatar.position.x, z: myAvatar.position.z };
  scene.remove(myAvatar);
  myAvatar = createAvatar(myName, myColor || "#4c84ff", appearance);
  myAvatar.position.set(myPosition.x, getTerrainHeightAt(currentMapId, myPosition.x, myPosition.z), myPosition.z);
  scene.add(myAvatar);
  if (combat) combat.reattachOwnGun();
}

function beginDressing(user, token) {
  openDressing({
    name: user.username,
    appearance: user.appearance,
    onBack: () => {
      showJoinError("");
      joinScreen.hidden = false;
      nameInput.focus();
    },
    onPlay: (appearance) => {
      myAppearance = appearance;
      if (token) {
        apiSaveAppearance(token, appearance).catch((err) => console.warn("No se guardó la apariencia:", err));
      }
      startGame(user, token);
    },
  });
}

function applyMap(mapId) {
  if (!mapId) mapId = "nevado";
  if (mapId === currentMapId) return;
  currentMapId = mapId;
  rebuildWorld();
}

function rebuildWorld() {
  if (!running || !started) return;

  const oldRenderer = world ? world.renderer : null;
  if (world) {
    if (world.scene) {
      world.scene.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        }
      });
    }
    world = null;
  }

  world = createWorld(currentMapId, oldRenderer);
  scene = world.scene;
  camera = world.camera;
  renderer = world.renderer;

  if (combat) combat.rebindScene(scene);
  if (hockey) hockey.attachScene(scene);
  if (loot) loot.attachScene(scene);
  if (myAvatar) scene.add(myAvatar);
  remotes.forEach((remote) => scene.add(remote.group));

  if (fpMode && camera) {
    camera.fov = 72;
    camera.updateProjectionMatrix();
  } else if (TOUCH_MODE && camera) {
    camera.fov = 66;
    camera.updateProjectionMatrix();
  }
  if (fpMode && viewGun && camera) {
    if (viewGun.parent) viewGun.parent.remove(viewGun);
    camera.add(viewGun);
  }
}

function updateFpButton() {
  if (!fpToggleBtn) return;
  fpToggleBtn.textContent = fpMode ? "🎯 3ª persona (V)" : "🎯 Primera persona (V)";
  fpToggleBtn.classList.toggle("fp-active", fpMode);
}

function updateFpUI() {
  updateFpButton();
  const isLocked = document.pointerLockElement === (renderer && renderer.domElement);
  if (fpCrosshairEl) fpCrosshairEl.hidden = !started;
  if (fpHintEl) {
    fpHintEl.hidden = !fpMode || TOUCH_MODE;
    if (fpMode && !TOUCH_MODE) {
      fpHintEl.textContent = isLocked
        ? "🎯 Puntero fijado (Presiona ESC para liberar)"
        : "🎯 Clic en la pantalla para fijar ratón (ESC para liberar)";
    }
  }
}

function removeViewGun() {
  if (viewGun) {
    if (viewGun.parent) viewGun.parent.remove(viewGun);
    viewGun.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      }
    });
    viewGun = null;
  }
  viewRig = null;
  viewWid = null;
}

function swapViewGun() {
  removeViewGun();
  if (!fpMode || !combat) return;
  const wid = combat.getWeaponId();
  viewWid = wid;
  const rig = buildViewmodel(wid, myAppearance);
  if (!rig) return;
  viewGun = rig.group;
  viewRig = rig;
  if (camera) camera.add(viewGun);
}

function enterLandscape() {
  if (!TOUCH_MODE) return;
  const lock = () => {
    try {
      if (screen.orientation && typeof screen.orientation.lock === "function") {
        const p = screen.orientation.lock("landscape");
        if (p && p.catch) p.catch(() => {});
      }
    } catch (_) {}
  };
  try {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      const p = el.requestFullscreen();
      if (p && p.then) p.then(lock, lock);
      else lock();
    } else {
      lock();
    }
  } catch (_) {
    lock();
  }
}

function setFPMode(on) {
  stopBlocking();
  fpMode = !!on;
  if (camera) {
    camera.fov = fpMode ? 72 : (TOUCH_MODE ? 66 : 55);
    camera.updateProjectionMatrix();
  }
  if (fpMode) {
    cameraPitch = 0.02;
    if (myAvatar) myAvatar.rotation.y = cameraYaw;
    swapViewGun();
  } else {
    cameraPitch = TOUCH_MODE ? 0.24 : 0.35;
    if (myAvatar) myAvatar.rotation.y = cameraYaw;
    removeViewGun();
    if (renderer && document.pointerLockElement === renderer.domElement) {
      document.exitPointerLock();
    }
  }
  if (myAvatar) myAvatar.visible = !fpMode;
  updateFpUI();
}

function toggleFPView() {
  if (!running || !started || !myAvatar || !myOwnAlive || !myRoom) return;
  if (!combat) return;
  if (combat.isAnimating(myId)) return;
  setFPMode(!fpMode);
}

let pointerUIbound = false;
function bindPointerUI() {
  if (pointerUIbound) return;
  pointerUIbound = true;
  if (TOUCH_MODE) return;

  document.addEventListener("pointerlockchange", () => {
    updateFpUI();
  });

  document.addEventListener("mousedown", (event) => {
    if (renderer && event.target !== renderer.domElement) return;
    if (fpMode && renderer && document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock();
    }
    if (event.button === 2) {
      event.preventDefault();
      if (fpMode) {
        const def = combat ? combat.getWeaponDef() : null;
        if (def && def.block) {
          blockHeldMouse = true;
          combat.setBlock(true, cameraYaw);
        } else if (def) {
          showToast("Solo el escudo bloquea");
        }
      } else {
        draggingCamera = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
      }
    } else if (event.button === 0 && combat) {
      combat.tryShoot();
    }
  });
  document.addEventListener("mousemove", (event) => {
    if (fpMode && renderer && document.pointerLockElement === renderer.domElement) {
      const dX = event.movementX || 0;
      const dY = event.movementY || 0;
      cameraYaw -= dX * 0.0022;
      cameraPitch = Math.max(-1.25, Math.min(1.2, cameraPitch - dY * 0.0022));
      if (viewRig && viewRig.setSway) {
        viewRig.setSway(dX, dY);
      }
      return;
    }
    if (!draggingCamera) return;
    const dX = event.clientX - lastMouseX;
    const dY = event.clientY - lastMouseY;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    cameraYaw -= dX * 0.005;
    if (fpMode) {
      cameraPitch = Math.max(-1.2, Math.min(1.15, cameraPitch - dY * 0.005));
      if (viewRig && viewRig.setSway) {
        viewRig.setSway(dX, dY);
      }
    }
  });
  document.addEventListener("mouseup", (event) => {
    draggingCamera = false;
    if (event.button === 2) {
      blockHeldMouse = false;
      if (!blockHeldKey && combat) combat.setBlock(false, cameraYaw);
    }
  });
  document.addEventListener("contextmenu", (event) => {
    if (renderer && event.target === renderer.domElement) event.preventDefault();
  });
}

function startGame(user, token) {
  if (started) return;
  started = true;
  currentToken = token;
  myName = user.username;

  chat = setupChatUI((text) => sendChat(text));
  registerChat(chat);
  minimap = createMinimap();

  let worldLocal;
  try {
    worldLocal = createWorld(currentMapId);
  } catch (err) {
    console.error(err);
    joinError.textContent = err.message;
    started = false;
    return;
  }

  world = worldLocal;
  scene = world.scene;
  camera = world.camera;
  renderer = world.renderer;

  if (TOUCH_MODE && camera) {
    camera.fov = 66;
    camera.updateProjectionMatrix();
    cameraPitch = 0.24;
  }
  enterLandscape();

  hockey = createHockey();
  hockey.attachScene(scene);
  hockey.setActive(true);

  voice = createVoiceManager({ getId: () => myId, sendSignal: sendVoiceSignal });

  combat = createCombat({
    scene,
    getOwnId: () => myId,
    getOwnPosition: () => myPosition,
    getOwnAvatar: () => myAvatar,
    getRemotes: () => remotes,
    getOwnAim: () =>
      fpMode ? { dx: -Math.sin(cameraYaw), dz: -Math.cos(cameraYaw) } : null,
    shoot: (dx, dz) => sendShoot(dx, dz),
    block: (on, yaw) => sendBlock(on, yaw),
    notify: (text) => showToast(text, 2200),
    onOwnFire: () => {
      if (viewRig) viewRig.playFire();
      if (fpMode) cameraRecoilKick = 0.035;
    },
    onReloadStart: (weapon) => {
      if (viewRig && weapon && weapon.reloadMs > 0) viewRig.startReload(weapon.reloadMs);
    },
    onReloadEnd: () => {
      if (viewRig) viewRig.endReload();
    },
  });
combat.setOwn(myOwnHp, myOwnAlive);

  loot = createLoot({
    getOwnPosition: () => myPosition,
    onPickup: (crystalId) => sendCrystalOffer(crystalId),
    onRespond: (crystalId, accept) => sendCrystalRespond(crystalId, accept),
    hasWeapon: () => !!(combat && combat.getWeaponId()),
    getMapId: () => currentMapId,
  });
  loot.attachScene(scene);

  inventoryBar = createInventoryBar({
    onUse: (slot, item) => sendInventoryUse(slot, item),
    onThrow: (slot, item) => {
      const f = { dx: -Math.sin(cameraYaw), dz: -Math.cos(cameraYaw) };
      sendInventoryThrow(slot, item, f.dx, f.dz);
    },
  });
  // La mochila también sirve en el lobby (comer para curarse); lanzar sigue
  // siendo exclusivo de las salas y el servidor lo avisa si se intenta.
  inventoryBar.setEnabled(true);

  combat.setAutoReload(isAutoReloadEnabled());

  scoreboard = createScoreboard({ getMyId: () => myId });
  scoreboard.setEnabled(true);

  shop = createShop({
    onBuy: (weaponId) => buyWeapon(weaponId),
    getScore: () => myScore,
    getEquippedId: () => (combat ? combat.getWeaponId() : null),
    notify: (text) => {
      showToast(text, 2200);
      chat?.system?.(text);
    },
  });

  if (TOUCH_MODE) {
    const needRoom = () => {
      if (!myRoom) {
        showToast("Entra a una sala para combatir");
        return false;
      }
      return true;
    };
    touchCtl = initTouchControls({
      onReload: () => { if (needRoom() && combat) combat.reload(); },
      // Comer funciona también en el lobby; lanzar lo valida el servidor.
      onUse: () => { if (inventoryBar) inventoryBar.use(); },
      onView: () => { if (needRoom()) toggleFPView(); },
      onInv: () => { document.body.classList.toggle("inv-open"); },
      onJump: () => { jumpQueued = true; },
      onSlide: () => { slideQueued = true; },
      onBlock: (on) => {
        if (!combat) return;
        blockHeldTouch = !!on;
        if (!on) {
          combat.setBlock(false, cameraYaw);
          return;
        }
        if (!needRoom()) return;
        const def = combat.getWeaponDef();
        if (def && def.block) combat.setBlock(true, cameraYaw);
        else showToast("Necesitas el escudo para bloquear");
      },
    });
  }

  document.addEventListener("keydown", handleGameKey);

  window.__test = {
    combat,
    loot,
    inventoryBar,
    scoreboard,
    shop,
    remotes,
    get myId() { return myId; },
    get myRoom() { return myRoom; },
    get myAvatar() { return myAvatar; },
    get myOwnAlive() { return myOwnAlive; },
    get myOwnHp() { return myOwnHp; },
    get myScore() { return myScore; },
    get viewRig() { return viewRig; },
    get fpMode() { return fpMode; },
    get camera() { return camera; },
    get motion() { return motion; },
    get position() { return { x: myPosition.x, z: myPosition.z }; },
  };

  bindPointerUI();

  connectToGame({
    token,
    name: user.username,
    appearance: myAppearance || (user && user.appearance) || null,
    onWelcome: (message) => {
      myId = message.id;
      if (gameError) gameError.hidden = true;
      const me = message.players.find((player) => player.id === myId);
      if (!me) return;

      myPosition = { x: me.x, z: me.z };
      myOwnHp = me.hp;
      myOwnAlive = me.alive;
      myColor = me.color;
      motion = createMotionState();
      jumpQueued = false;
      slideQueued = false;
      lastBlocked = false;
      if (combat) combat.setOwn(myOwnHp, myOwnAlive);
      if (myAvatar) scene.remove(myAvatar);
      myAvatar = createAvatar(me.name, me.color, me.appearance || myAppearance);
      scene.add(myAvatar);
      myAvatar.position.set(me.x, getTerrainHeightAt(currentMapId, me.x, me.z), me.z);

      remotes.forEach((remote) => scene.remove(remote.group));
      remotes.clear();

      currentPlayers = message.players;
      if (scoreboard) scoreboard.setState(message.players);
      const scoreMe = message.players.find((player) => player.id === myId);
      if (scoreMe) {
        myScore = scoreMe.score || 0;
        if (shop) shop.setScore(myScore);
      }
      renderOnlineList();
      voice.setContacts(message.players);
      message.players.forEach((player) => {
        if (player.id !== myId) {
          spawnRemote(player);
          voice.rememberPosition(player.id, player.x, player.z);
        }
      });
      if (combat) combat.setFriends(message.players);
    },
    onJoined: (player) => {
      if (!currentPlayers.some((existing) => existing.id === player.id)) {
        currentPlayers.push(player);
      }
      addOnline(player);
      voice.setContacts(currentPlayers);
      voice.rememberPosition(player.id, player.x, player.z);
      if (!remotes.has(player.id)) {
        spawnRemote(player);
      }
      if (combat) combat.setFriends(currentPlayers);
      if (scoreboard) scoreboard.add(player);
    },
    onMoved: ({ id, x, z, y, sprint, slide }) => {
      const remote = remotes.get(id);
      if (remote) {
        remote.targetX = x;
        remote.targetZ = z;
        if (Number.isFinite(y)) remote.targetY = Math.max(0, Math.min(3, y));
        remote.sprinting = !!sprint;
        remote.sliding = !!slide;
        if (combat) combat.movePuddle(id, x, z);
      }
      voice.rememberPosition(id, x, z);
    },
    onLeft: ({ id }) => {
      const remote = remotes.get(id);
      if (remote) {
        scene.remove(remote.group);
        remotes.delete(id);
      }
      if (combat) combat.forget(id);
      if (scoreboard) scoreboard.remove(id);
      currentPlayers = currentPlayers.filter((player) => player.id !== id);
      removeOnline(id);
      voice.setContacts(currentPlayers);
    },    onChat: (message) =>
      chat.appendMessage({ ...message, own: message.name === myName }),
    onChatHistory: (messages) => {
      chat.clear();
      if (messages.length) {
        chat.divider("— Historial reciente —");
        messages.forEach((message) =>
          chat.appendMessage({
            name: message.username || message.name,
            text: message.text,
            time: message.created_at
              ? new Date(message.created_at.replace(" ", "T") + "Z").getTime()
              : message.time,
            own: (message.username || message.name) === myName,
          })
        );
      }
    },
    onRoomState: ({ room, hosting: isHosting }) => {
      myRoom = room;
      hosting = !!isHosting;
      applyMap(room && room.mapId ? room.mapId : "nevado");
      const isPrivateRoom = !!room;
      if (!isPrivateRoom && fpMode) {
        setFPMode(false);
      }
      if (combat) combat.setEnabled(isPrivateRoom);
      if (!isPrivateRoom) stopBlocking();
      syncShieldButton();
      if (hockey) hockey.setActive(!isPrivateRoom);
      if (inventoryBar) inventoryBar.setEnabled(true);
      if (loot) loot.setEnabled(isPrivateRoom);
      if (scoreboard) scoreboard.setRoom(isPrivateRoom);
      if (shop) {
        shop.setEnabled(isPrivateRoom);
        shop.setScore(myScore);
        shop.setEquipped(combat ? combat.getWeaponId() : null);
      }
      renderRoomPanel();
      syncRemotes();
      // Al entrar en una sala, los que ya estaban llevan arma: el welcome llega
      // antes de room:state, así que aquí se aplican las armas de los remotos.
      if (combat) {
        for (const remote of remotes.values()) {
          combat.setRemoteWeapon(remote.group, remote.weaponId);
        }
      }
    },
    onRoomList: ({ rooms }) => renderRoomList(rooms),
    onRoomKicked: ({ name }) => {
      roomErrorEl.textContent = `El anfitrión te sacó de la sala "${name}".`;
    },
    onRoomClosed: ({ name }) => {
      roomErrorEl.textContent = `El anfitrión cerró la sala "${name}".`;
    },
    onRoomOwnerChanged: ({ ownerId, ownerName }) => {
      if (myRoom) {
        myRoom.ownerId = ownerId;
        myRoom.ownerName = ownerName;
        hosting = ownerId === myId;
        renderRoomPanel();
      }
    },
    onRoomError: ({ error }) => {
      roomErrorEl.textContent = error;
    },
    onVoiceSignal: (signal) => {
      voice.handleSignal(signal);
    },
    onCombatShot: (data) => {
      if (combat) combat.onShot(data);
    },
    onCombatBoom: ({ x, z, r, snow }) => {
      if (combat) combat.onBoom(x, z, r, snow);
    },
    onCombatSlow: ({ targetId, until }) => {
      if (targetId === myId) {
        const duration = Math.min(Math.max(Number(until) || 0, 0), 60000);
        slowUntil = performance.now() + duration;
      }
    },
    onCombatHeal: ({ targetId, targetHp }) => {
      if (targetId === myId) {
        myOwnHp = targetHp;
        if (combat) combat.setOwn(targetHp, myOwnAlive);
      } else if (combat) {
        combat.setRemoteHp(targetId, targetHp);
      }
    },
    onCombatBlock: (data) => {
      if (combat) combat.onBlock(data);
    },
    onCombatBlocked: (data) => {
      if (combat) combat.onBlocked(data);
    },
    onItemSpawn: (data) => {
      if (combat) combat.onThrowSpawn(data);
    },
    onInventoryUpdate: ({ playerId, inventory }) => {
      if (playerId === myId && inventoryBar) inventoryBar.refresh(inventory);
    },
    onInventoryToast: ({ playerId, text }) => {
      if (playerId === myId && text) {
        if (/inventario lleno/i.test(text) && loot) loot.rejectAsk();
        showToast(text, 2200);
        chat.system?.(text);
      }
    },
    onCrystalState: ({ crystals }) => {
      if (loot) loot.setCrystals(crystals);
    },
    onCrystalOffer: (data) => {
      if (loot) loot.offer(data);
    },
    onCrystalError: ({ error } = {}) => {
      if (!error) return;
      showToast(error, 2400);
      // Evita que el cliente vuelva a pedir el mismo cristal en bucle.
      if (loot) loot.rejectAsk();
    },
    onCrystalEquip: ({ playerId, weaponId }) => {
      if (playerId === myId) {
        if (combat) combat.setWeapon(weaponId);
        if (shop) shop.setEquipped(weaponId);
        syncShieldButton();
        const w = weaponId ? getWeapon(weaponId) : null;
        chat.system?.(w ? `Has equipado: ${w.name}` : "Sin arma. Entra a una sala y busca un cristal.");
      } else if (combat) {
        const remote = remotes.get(playerId);
        if (remote) {
          remote.weaponId = weaponId;
          combat.setRemoteWeapon(remote.group, weaponId);
        }
      }
    },
    onCombatEliminated: ({ targetId }) => {
      if (targetId === myId) {
        myOwnAlive = false;
        myOwnHp = 0;
        motion = createMotionState();
        jumpQueued = false;
        slideQueued = false;
        lastBlocked = false;
        if (touchCtl) touchCtl.setSprint(false);
        if (combat) combat.setOwn(0, false);
        chat.system?.("Te han eliminado. Volverás en unos segundos.");
      } else {
        const remote = remotes.get(targetId);
        if (remote) {
          remote.targetY = 0;
          remote.sprinting = false;
          remote.sliding = false;
        }
        if (combat) combat.setRemoteHp(targetId, 0);
      }
    },
    onCombatRevived: ({ targetId }) => {
      if (targetId === myId) {
        myOwnAlive = true;
        myOwnHp = 100;
        motion = createMotionState();
        jumpQueued = false;
        slideQueued = false;
        lastBlocked = false;
        if (combat) combat.setOwn(100, true);
        chat.system?.("¡Has vuelto a la partida!");
      } else {
        const remote = remotes.get(targetId);
        if (remote) {
          remote.targetY = 0;
          remote.sprinting = false;
          remote.sliding = false;
        }
        if (combat) combat.setRemoteHp(targetId, 100);
      }
    },
    onCombatRegen: ({ targetId, targetHp }) => {
      if (targetId === myId) {
        myOwnHp = targetHp;
        if (combat) combat.setOwn(targetHp, myOwnAlive);
      } else if (combat) {
        combat.setRemoteHp(targetId, targetHp);
      }
    },
    onHockeyState: (state) => {
      if (hockey) hockey.setState(state);
    },
    onHockeyGoal: ({ scorerName }) => {
      chat?.system?.(`¡${scorerName} anotó un gol de hockey!`);
    },
    onScoreState: ({ players } = {}) => {
      if (scoreboard) scoreboard.setState(players || []);
      const me = (players || []).find((player) => player.id === myId);
      if (me) {
        myScore = me.score || 0;
        if (shop) shop.setScore(myScore);
      }
    },
    onScoreUpdate: (data) => {
      if (!data) return;
      if (scoreboard) scoreboard.update(data);
      if (data.playerId !== myId) return;
      myScore = Math.max(0, Math.round(Number(data.score) || 0));
      if (shop) shop.setScore(myScore);
      if (data.delta > 0 && (data.reason === "kill" || data.reason === "kill-farm")) {
        showToast(`+${data.delta} puntos`, 1400);
      }
    },
    onScoreProfile: (data) => {
      if (!data || data.playerId !== myId) return;
      if (shop && data.lifetime) shop.setLifetime(data.lifetime);
    },
    onShopResult: (data) => {
      if (shop) shop.handleResult(data);
    },
    onGameFull: (error) => {
      leaveGame();
      showJoinError(error || "El lobby está lleno. Inténtalo más tarde.");
    },
    onDisconnect: () => showGameError("Conexión perdida. Reconectando…"),
    onConnectError: (message) => {
      if (message) showGameError(message);
    },
  });

  joinScreen.hidden = true;
  gameScreen.hidden = false;
  document.body.classList.add("in-game");
  running = true;

  updateFpUI();
  maybeShowHelp();

  requestAnimationFrame(loop);
}

async function handleVoiceToggle() {
  if (voiceRunning) {
    voiceRunning = false;
    voice.setMicEnabled(false);
    voiceBtn.textContent = "Activar voz";
    voiceStatus.textContent = "";
    return;
  }

  voiceStatus.textContent = "Pidiendo micrófono…";
  try {
    await voice.start();
    voiceRunning = true;
    voice.setMicEnabled(true);
    voice.setContacts(currentPlayers);
    voiceBtn.textContent = "Silenciar micrófono";
    voiceStatus.textContent = "Voz activa (se oye por proximidad)";
  } catch (err) {
    voiceStatus.textContent = "Micrófono no disponible: " + err.message;
  }
}

async function handleLogout() {
  const { token } = getSession();
  if (token) {
    try {
      await apiLogout(token);
    } catch {
      // el servidor puede no estar accesible; continuamos igual
    }
  }
  clearSession();
  leaveGame();
}

function handleGameKey(event) {
  if (isTyping() || !inventoryBar) return;
  const key = event.key.toLowerCase();
  if (key >= "1" && key <= "5") {
    inventoryBar.select(Number(key) - 1);
  } else if (key === "f") {
    inventoryBar.use();
  } else if (key === "v") {
    toggleFPView();
  }
}

function leaveGame() {
  if (!running) return;
  running = false;

  if (touchCtl) {
    touchCtl.dispose();
    touchCtl = null;
  }
  document.body.classList.remove("inv-open", "sheet-rooms", "sheet-online", "menu-open", "chat-open", "in-room", "in-game", "has-shield", "room-info-collapsed");

  if (fpMode) setFPMode(false);
  fpMode = false;

  if (fpCrosshairEl) fpCrosshairEl.hidden = true;
  if (fpHintEl) fpHintEl.hidden = true;

  leaveServer();

  if (myAvatar) scene.remove(myAvatar);
  remotes.forEach((remote) => scene.remove(remote.group));
  remotes.clear();

  if (combat) {
    combat.dispose();
    combat = null;
  }

  if (hockey) {
    hockey.dispose();
    hockey = null;
  }

  if (loot) {
    loot.dispose();
    loot = null;
  }

  if (inventoryBar) {
    inventoryBar.dispose();
    inventoryBar = null;
  }

  if (scoreboard) {
    scoreboard.dispose();
    scoreboard = null;
  }

  if (shop) {
    shop.dispose();
    shop = null;
  }
  myScore = 0;
  slowUntil = 0;
  motion = createMotionState();
  jumpQueued = false;
  slideQueued = false;
  document.removeEventListener("keydown", handleGameKey);

  onlineList.innerHTML = "";
  chat.clear();

  if (voice) {
    voice.stop();
    voice = null;
  }
  voiceRunning = false;
  voiceBtn.textContent = "Activar voz";
  voiceStatus.textContent = "";

  if (minimap) {
    minimap.clear();
    minimap = null;
  }

  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }

  myId = null;
  myAvatar = null;
  myName = null;
  myColor = null;
  myOwnHp = 100;
  myOwnAlive = true;
  myRoom = null;
  hosting = false;
  currentPlayers = [];
  scene = undefined;
  camera = undefined;
  renderer = undefined;
  currentToken = null;
  started = false;
  passwordInput.value = "";
  roomErrorEl.textContent = "";
  renderRoomPanel();

  gameScreen.hidden = true;
  joinScreen.hidden = false;
  nameInput.focus();
}

function spawnRemote(player) {
  const group = createAvatar(player.name, player.color, player.appearance);
  group.position.set(player.x, getTerrainHeightAt(currentMapId, player.x, player.z), player.z);
  scene.add(group);
  if (combat) combat.setRemoteWeapon(group, player.weaponId);
  remotes.set(player.id, {
    group,
    targetX: player.x,
    targetZ: player.z,
    targetY: Number.isFinite(player.y) ? player.y : 0,
    y: 0,
    sprinting: false,
    sliding: false,
    color: player.color,
    weaponId: player.weaponId,
  });
}

function syncRemotes() {
  if (!scene || !myId) return;

  const expected = new Map(
    currentPlayers.filter((player) => player.id !== myId).map((player) => [player.id, player])
  );

  for (const [id, remote] of remotes) {
    if (!expected.has(id)) {
      scene.remove(remote.group);
      remotes.delete(id);
      removeOnline(id);
    }
  }

  for (const player of expected.values()) {
    if (!remotes.has(player.id)) {
      spawnRemote(player);
    }
  }

  if (combat) combat.setFriends(currentPlayers);
}

function angleStep(current, target) {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

// Barra de resistencia: fina, sobre el inventario. Sólo visible por debajo de
// 100 y se desvanece al llenarse (clase `is-full`).
function updateStaminaHud(stamina) {
  if (!staminaHudEl || !staminaFillEl) return;
  const pct = Math.max(0, Math.min(100, Number(stamina) || 0));
  staminaFillEl.style.width = pct.toFixed(1) + "%";
  staminaFillEl.classList.toggle("mid", pct > 25 && pct <= 55);
  staminaFillEl.classList.toggle("low", pct <= 25);
  staminaHudEl.classList.toggle("is-full", pct >= 99.5);
}

function loop(now) {
  if (!running) return;

  if (paused) {
    requestAnimationFrame(loop);
    return;
  }

  try {
    const dt = Math.min((now - lastUpdate) / 1000, 0.05);
    lastUpdate = now;

    // Paneles que bloquean el movimiento: vestidor, tienda y marcador.
    const uiOpen =
      dressingOpen() ||
      !!(shop && shop.isOpen()) ||
      !!(scoreboard && scoreboard.isOpen());
    if (touchCtl && !uiOpen) {
      const l = touchCtl.consumeLook();
      if (l.dx || l.dy) {
        const sens = getSensitivity();
        cameraYaw -= l.dx * 0.005 * sens;
        if (fpMode) {
          cameraPitch = Math.max(-1.2, Math.min(1.15, cameraPitch - l.dy * 0.005 * sens));
        } else {
          cameraPitch = Math.max(0.06, Math.min(1.05, cameraPitch - l.dy * 0.004 * sens));
        }
      }
      if (touchCtl.consumeFireTap()) {
        if (!myRoom) showToast("Entra a una sala para combatir");
        else if (combat) combat.tryShoot();
      }
      if (combat && myRoom) {
        const wdef = combat.getWeaponDef();
        const auto = wdef && wdef.kind !== "melee" && wdef.cooldownMs <= 280;
        if (touchCtl.fireHeld && auto) combat.tryShoot();
      }
    }

    // Keepalive del escudo: el servidor corta el bloqueo si deja de recibirlo.
    if (combat) combat.updateBlock(cameraYaw);

    const input = uiOpen ? { dx: 0, dz: 0 } : getInputDirection();
    let dx = input.dx;
    let dz = input.dz;
    if (touchCtl && !uiOpen) {
      const td = touchCtl.getDir();
      dx += td.x;
      dz += td.z;
      const mag = Math.hypot(dx, dz);
      if (mag > 1) {
        dx /= mag;
        dz /= mag;
      }
    }
    const cosY = Math.cos(cameraYaw);
    const sinY = Math.sin(cameraYaw);
    const mdx = dx * cosY + dz * sinY;
    const mdz = -dx * sinY + dz * cosY;
    const blockingNow = !!(combat && combat.isBlocking());
    const wantsMove = !!(mdx || mdz) && myOwnAlive;
    const sprintKey =
      !uiOpen && (isKeyDown("shift") || !!(touchCtl && touchCtl.sprintHeld));
    // Fase 4: salto/sprint/deslizamiento. El salto es cosmético (no esquiva
    // balas); el servidor sólo guarda y retransmite la altura para la pose.
    const motionStep = stepMotion(
      motion,
      {
        move: wantsMove,
        sprint: sprintKey && !blockingNow,
        jump: jumpQueued && !uiOpen,
        slide: slideQueued && !uiOpen,
        blocked: lastBlocked,
      },
      dt
    );
    jumpQueued = false;
    slideQueued = false;
    updateStaminaHud(motionStep.stamina);
    // FOV: +6° suave al sprintar; vuelve al soltar Shift.
    if (camera) {
      const baseFov = fpMode ? 72 : (TOUCH_MODE ? 66 : 55);
      const targetFov = baseFov + (motionStep.sprinting ? 6 : 0);
      if (Math.abs(camera.fov - targetFov) > 0.01) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
        camera.updateProjectionMatrix();
      }
    }
    const moving = wantsMove && myAvatar;
    if (moving) {
      const length = Math.hypot(mdx, mdz);
      const speed =
        WALK_SPEED *
        motionStep.speedMult *
        (blockingNow ? blockMoveScale() : 1) *
        (performance.now() < slowUntil ? 0.55 : 1);
      const fromX = myPosition.x;
      const fromZ = myPosition.z;
      const next = moveWithCollisions(
        myPosition.x + (mdx / length) * speed * dt,
        myPosition.z + (mdz / length) * speed * dt,
        currentMapId
      );
      // Si apenas avanzó respecto a lo pedido, está chocando con una pared o
      // el borde: el siguiente frame no gastará stamina por correr ahí.
      const wanted = speed * dt;
      const advanced = Math.hypot(next.x - fromX, next.z - fromZ);
      lastBlocked = wanted > 1e-4 && advanced < wanted * 0.3;
      myPosition = next;
      myAvatar.position.set(
        next.x,
        getTerrainHeightAt(currentMapId, next.x, next.z) + motionStep.y,
        next.z
      );
      if (!myOwnAlive && combat) combat.movePuddle(myId, next.x, next.z);

      const targetAngle = blockingNow ? cameraYaw + Math.PI : Math.atan2(mdx, mdz);
      myAvatar.rotation.y += angleStep(myAvatar.rotation.y, targetAngle) * Math.min(1, dt * 12);
    } else {
      lastBlocked = false;
    }

    // Envía también la altura mientras se salta o desliza en el sitio.
    if (
      myAvatar &&
      (moving || !motion.grounded || motionStep.sliding) &&
      now - lastMoveSend >= MOVE_SEND_INTERVAL
    ) {
      sendMove(
        myPosition.x,
        myPosition.z,
        cameraYaw,
        motionStep.y,
        motionStep.sprinting,
        motionStep.sliding
      );
      lastMoveSend = now;
    }

    // En 3.ª persona, bloquear gira al pingüino hacia donde mira la cámara:
    // el escudo debe apuntar al frente de la vista, no a la última caminata.
    if (!fpMode && myAvatar && blockingNow && !moving) {
      myAvatar.rotation.y += angleStep(myAvatar.rotation.y, cameraYaw + Math.PI) * Math.min(1, dt * 12);
    }

    if (myAvatar && (!combat || !combat.isAnimating(myId))) {
      const bob = moving && motion.grounded ? Math.abs(Math.sin(now * 0.012)) * 0.07 : 0;
      myAvatar.position.y =
        getTerrainHeightAt(currentMapId, myAvatar.position.x, myAvatar.position.z) +
        motionStep.y +
        bob;
      animateAvatar(myAvatar, now, dt, moving, {
        jumping: motionStep.jumping,
        sprinting: motionStep.sprinting,
        sliding: motionStep.sliding,
      });
    }

    remotes.forEach((remote, remoteId) => {
      const group = remote.group;
      const animating = combat ? combat.isAnimating(remoteId) : false;
      const headX = remote.targetX - group.position.x;
      const headZ = remote.targetZ - group.position.z;
      const moved = Math.hypot(headX, headZ) > 0.001 && !animating;
      if (moved) {
        group.rotation.y += angleStep(group.rotation.y, Math.atan2(headX, headZ)) * Math.min(1, dt * 12);
      }
      group.position.x += headX * Math.min(1, dt * 12);
      group.position.z += headZ * Math.min(1, dt * 12);
      const targetY = remote.targetY || 0;
      remote.y = (remote.y || 0) + (targetY - (remote.y || 0)) * Math.min(1, dt * 14);
      if (!animating) {
        group.position.y =
          getTerrainHeightAt(currentMapId, group.position.x, group.position.z) +
          remote.y +
          (moved ? Math.abs(Math.sin(now * 0.012)) * 0.06 : 0);
        animateAvatar(group, now, dt, moved, {
          jumping: remote.y > 0.05,
          sprinting: remote.sprinting,
          sliding: remote.sliding,
        });
      }
    });

    if (myAvatar) {
      const positions = new Map();
      remotes.forEach((remote, id) =>
        positions.set(id, { x: remote.targetX, z: remote.targetZ, color: remote.color })
      );
      if (voice) {
        voice.updatePositions({ x: myAvatar.position.x, z: myAvatar.position.z }, positions);
      }
      minimap.update({ x: myAvatar.position.x, z: myAvatar.position.z }, positions, currentMapId);
    }

  if (world && world.update) world.update(dt);

  if (combat) {
    combat.update(dt);
  }

  if (loot) {
    loot.update(now, dt);
  }

  if (hockey) {
    hockey.update(dt);
  }

    if (fpMode) {
      if (combat && combat.getWeaponId() !== viewWid) swapViewGun();
      cameraRecoilKick *= 0.82;
      const effectivePitch = cameraPitch + cameraRecoilKick;

      const bobY = moving ? Math.abs(Math.sin(now * 0.012)) * 0.042 : 0;
      const bobRoll = moving ? Math.sin(now * 0.006) * 0.015 : 0;
      const eyeY =
        getTerrainHeightAt(currentMapId, myPosition.x, myPosition.z) +
        FP_EYE +
        motionStep.y +
        bobY;
      camera.position.set(myPosition.x, eyeY, myPosition.z);
      camera.rotation.order = "YXZ";
      camera.rotation.set(effectivePitch, cameraYaw, bobRoll);
      if (myAvatar) myAvatar.rotation.y = cameraYaw;
      if (viewRig) viewRig.update(now, dt, moving, !!(combat && combat.isBlocking()));
    } else {
      const cameraTarget = myAvatar ? myAvatar.position : { x: 0, y: 0, z: 0 };
      const big = currentMapId === "cordillera";
      const camDist = big ? 55 : 16;
      const camHeight = (big ? 34 : 12) + Math.sin(cameraPitch) * (big ? 18 : 6);
      camera.position.set(
        cameraTarget.x + Math.sin(cameraYaw) * camDist,
        Math.max(big ? 12 : 4, camHeight),
        cameraTarget.z + Math.cos(cameraYaw) * camDist
      );
      camera.lookAt(
        cameraTarget.x,
        getTerrainHeightAt(currentMapId, cameraTarget.x, cameraTarget.z) + 1.2,
        cameraTarget.z
      );
    }

    renderer.render(scene, camera);
  } catch (err) {
    console.error(err);
    showGameError(err.message);
    return;
  }

  if (running) {
    requestAnimationFrame(loop);
  }
}

function showGameError(message) {
  gameError.textContent = "Error: " + message;
  gameError.hidden = false;
}

function clearRoomError() {
  roomErrorEl.textContent = "";
}

function setRoomInfoCollapsed(collapsed) {
  document.body.classList.toggle("room-info-collapsed", collapsed);
  if (roomInfoToggle) {
    roomInfoToggle.setAttribute("aria-expanded", String(!collapsed));
    const label = collapsed
      ? "Mostrar información de la sala"
      : "Ocultar información de la sala";
    roomInfoToggle.title = label;
    roomInfoToggle.setAttribute("aria-label", label);
    roomInfoToggle.textContent = collapsed ? "▸" : "▾";
  }
  updateRoomsTitle();
}

function updateRoomsTitle() {
  if (!roomsTitleText) return;
  if (myRoom) {
    const collapsed = document.body.classList.contains("room-info-collapsed");
    roomsTitleText.textContent = collapsed ? `${myRoom.name} (${myRoom.code})` : "Sala privada";
  } else {
    roomsTitleText.textContent = "Salas privadas";
  }
}

function renderRoomPanel() {
  const inRoom = !!myRoom;
  const roomCode = myRoom ? myRoom.code : null;
  // Al entrar o salir de una sala el panel vuelve a mostrarse completo; el
  // colapso es una preferencia momentánea, no se arrastra a la siguiente sala.
  if (roomCode !== lastRoomPanelCode) {
    lastRoomPanelCode = roomCode;
    setRoomInfoCollapsed(false);
  }
  document.body.classList.toggle("in-room", inRoom);
  if (roomInfoToggle) roomInfoToggle.hidden = !inRoom;
  roomCreateForm.hidden = inRoom;
  roomJoinForm.hidden = inRoom;
  roomListEl.hidden = inRoom;
  roomPlace.hidden = !inRoom;
  const mapName = myRoom ? getMap(myRoom.mapId).name : null;
  headerPlace.textContent = myRoom
    ? `· ${myRoom.name} (${myRoom.code})${mapName ? ` · ${mapName}` : ""}`
    : "· Lobby";
  if (fpToggleBtn) fpToggleBtn.hidden = !myRoom;

  if (myRoom) {
    roomCurrent.textContent = `${myRoom.name} (${myRoom.code})${mapName ? ` — ${mapName}` : ""}`;
    roomOwnerInfo.textContent = hosting
      ? "Eres el anfitrión"
      : `Anfitrión: ${myRoom.ownerName}`;
    roomCloseBtn.hidden = !hosting;
  }

  renderOnlineList();
}

function renderRoomList(rooms) {
  roomListEl.innerHTML = "";

  if (!rooms.length) {
    const empty = document.createElement("p");
    empty.textContent = "No hay salas abiertas.";
    roomListEl.appendChild(empty);
    return;
  }

  rooms.forEach((room) => {
    const item = document.createElement("div");
    item.className = "room-item";

    const info = document.createElement("span");
    const mapName = getMap(room.mapId).name;
    info.textContent = `${room.name} · ${room.code} · ${mapName} · ${room.players} jug.`;

    const button = document.createElement("button");
    button.type = "button";
    button.disabled = !!myRoom;
    button.textContent = "Unirse";
    button.addEventListener("click", () => {
      clearRoomError();
      joinRoom(room.code);
    });

    item.append(info, button);
    roomListEl.appendChild(item);
  });
}

function renderOnlineList() {
  onlineList.innerHTML = "";
  currentPlayers.forEach(addOnline);
}

function addOnline(player) {
  if (player.id === myId) return;
  if (document.getElementById(`online-${player.id}`)) return;

  const item = document.createElement("li");
  item.id = `online-${player.id}`;

  const dot = document.createElement("span");
  dot.className = "online-dot";
  dot.style.background = player.color;

  const name = document.createElement("span");
  name.className = "online-name";
  name.textContent = player.name;

  item.append(dot, name);

  if (hosting) {
    const kick = document.createElement("button");
    kick.type = "button";
    kick.className = "kick-btn";
    kick.textContent = "Expulsar";
    kick.addEventListener("click", () => kickPlayer(player.id));
    item.appendChild(kick);
  }

  onlineList.appendChild(item);
}

function removeOnline(id) {
  const item = document.getElementById(`online-${id}`);
  if (item) item.remove();
}

window.__pinguinLoaded = true;