import * as THREE from "/vendor/three/three.module.js";
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
  enterHub,
  joinMode,
  leaveMode,
  sendModeAction,
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
import { createPairsHud } from "./pairs.js";
import { createPairsBoard } from "./pairsBoard.js";
import { createColiseoHud } from "./coliseo.js";
import { createEsconditeHud } from "./escondite.js";
import { createTntHud } from "./tnt.js";
import { createKartsHud } from "./kartsHud.js";
import { createCityHud } from "./ciudadHud.js";
import { createKartModel } from "./kartModels.js";
import { cityItemById, cityNearestCollectible } from "./cityDefs.js";
import {
  KARTS_MAP_ID,
  KARTS_PORTALS,
  KARTS_PORTAL_TRIGGER,
  KART_START_ID,
  KART_PEDESTALS,
  kartById,
} from "./kartsDefs.js";
import { playTntEliminated, playTntFall, playTntFuse } from "./tntSound.js";
import { hideSpotAt } from "./hideDefs.js";
import {
  resolvePairsVariant,
  teamPadAt,
  cardIndexAt,
  getPairsTeam,
  clampPairsZoom,
  PAIRS_ZOOM_STEP,
} from "./pairsDefs.js";
import { HUB_CODE, LOBBY_PORTAL, PORTAL_TRIGGER_RADIUS, nearestPortal } from "./hubDefs.js";
import { clampColiseoZoom, COLISEO_ZOOM_STEP } from "./coliseoDefs.js";
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
const portalPrompt = document.getElementById("portal-prompt");
const portalPromptText = document.getElementById("portal-prompt-text");
const portalPromptBtn = document.getElementById("portal-prompt-btn");
const pairsSelect = document.getElementById("pairs-select");
const pairsSelectClose = document.getElementById("pairs-select-close");
const coliseoSelect = document.getElementById("coliseo-select");
const coliseoSelectClose = document.getElementById("coliseo-select-close");
const zoneFade = document.getElementById("zone-fade");
const zoneFadeLabel = document.getElementById("zone-fade-label");

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
  if (myRoom && myRoom.kind === "mode") leaveMode();
  else leaveRoom();
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

if (portalPromptBtn) {
  portalPromptBtn.addEventListener("click", () => activatePortal());
}

if (pairsSelectClose) pairsSelectClose.addEventListener("click", closePairsSelect);
if (pairsSelect) {
  pairsSelect.addEventListener("click", (event) => {
    if (event.target === pairsSelect) {
      closePairsSelect();
      return;
    }
    const button = event.target.closest && event.target.closest("[data-variant]");
    if (!button) return;
    closePairsSelect();
    joinMode("pares", button.dataset.variant);
  });
}

if (coliseoSelectClose) coliseoSelectClose.addEventListener("click", closeColiseoSelect);
if (coliseoSelect) {
  coliseoSelect.addEventListener("click", (event) => {
    if (event.target === coliseoSelect) {
      closeColiseoSelect();
      return;
    }
    const button = event.target.closest && event.target.closest("[data-variant]");
    if (!button) return;
    closeColiseoSelect();
    joinMode("coliseo", button.dataset.variant);
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
  onMinigames: handleMinigames,
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
    if (coliseoSelectOpen()) {
      event.preventDefault();
      closeColiseoSelect();
      return;
    }
    if (pairsSelectOpen()) {
      event.preventDefault();
      closePairsSelect();
      return;
    }
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
  if ((event.code === "KeyE" || event.key === "e" || event.key === "E") && !typing) {
    // En Ciudad la E recoge el objeto cercano antes que activar portales.
    if (cityArena() && cityInteract()) {
      event.preventDefault();
      return;
    }
    if (activatePortal()) {
      event.preventDefault();
      return;
    }
  }
  // Zoom del tablero en la arena de Pares: +/- acercan y alejan.
  if (
    pairsArena() &&
    !typing &&
    (event.key === "+" ||
      event.key === "=" ||
      event.key === "-" ||
      event.key === "_" ||
      event.code === "NumpadAdd" ||
      event.code === "NumpadSubtract")
  ) {
    event.preventDefault();
    if (!event.repeat) {
      const zoomIn =
        event.key === "+" || event.key === "=" || event.code === "NumpadAdd";
      nudgePairsZoom(zoomIn ? -PAIRS_ZOOM_STEP : PAIRS_ZOOM_STEP);
    }
    return;
  }
  // Zoom de cámara en el Coliseo: mismas teclas que Pares, sin tocar el HUD.
  if (
    coliseoArena() &&
    !typing &&
    (event.key === "+" ||
      event.key === "=" ||
      event.key === "-" ||
      event.key === "_" ||
      event.code === "NumpadAdd" ||
      event.code === "NumpadSubtract")
  ) {
    event.preventDefault();
    if (!event.repeat) {
      const zoomIn =
        event.key === "+" || event.key === "=" || event.code === "NumpadAdd";
      nudgeColiseoZoom(zoomIn ? -COLISEO_ZOOM_STEP : COLISEO_ZOOM_STEP);
    }
    return;
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
    if (!inCombatZone()) showToast("Entra a una sala para combatir");
    else if (!canUseCombat()) showToast("Espera a que empiece la ronda");
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

// Mantiene el HP del listado local alineado con los eventos de combate. Sin
// esto, un `room:state` posterior vuelve a pasar el HP viejo a `setFriends` y
// el avatar revivido se derrite otra vez para los demás jugadores.
function patchCurrentPlayer(id, patch) {
  const player = currentPlayers.find((entry) => entry.id === id);
  if (player) Object.assign(player, patch);
}
let voice = null;
let voiceRunning = false;
let combat = null;
let loot = null;
let inventoryBar = null;
let scoreboard = null;
let shop = null;
let pairsUI = null;
let pairsBoard = null;
let coliseoUI = null;
let esconditeUI = null;
let tntUI = null;
let kartsUI = null;
let cityUI = null;
// Último snapshot del controlador de Ciudad. El servidor decide distancias,
// precios y respawns; aquí solo se pinta y se calcula el objeto cercano.
let cityState = null;
// Último snapshot del controlador de Karts. La física la decide el servidor;
// aquí solo se usa para colocar avatares, pintar el HUD y detectar proximidad.
let kartsState = null;
let lastKartsDriveSend = 0;
const kartsRaycaster = new THREE.Raycaster();
const kartsPointer = new THREE.Vector2();
// Altura autoritativa de la capa del TNT y estado local de la caída del avatar.
let tntBaseY = 0;
let tntFalling = false;
let tntFallY = 0;
let tntFallVy = 0;

// Zoom del tablero en la arena de Pares. 1 es la vista por defecto; los valores
// menores acercan la cámara al centro del tablero y los mayores la alejan. Los
// límites viven en pairsDefs.js para que la suite pueda validarlos.
let pairsZoom = 1;

function setPairsZoom(value) {
  // Se redondea a 2 decimales para que la rueda no acumule ruido flotante.
  pairsZoom = Math.round(clampPairsZoom(value) * 100) / 100;
}

function nudgePairsZoom(delta) {
  setPairsZoom(pairsZoom + delta);
}

// Zoom de cámara del Coliseo. 1 es la vista por defecto; los valores menores
// acercan al pingüino y los mayores alejan para ver toda la arena.
let coliseoZoom = 1;

function setColiseoZoom(value) {
  coliseoZoom = clampColiseoZoom(value);
}

function nudgeColiseoZoom(delta) {
  setColiseoZoom(coliseoZoom + delta);
}
let lastPairsPad = null;
let lastZoneKey = null;
let zoneFadeTimer = null;
// Portal bajo los pies (isla) o puerta del lobby; se recalcula cada frame.
let portalTarget = null;
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
  if (!combat || !canUseCombat() || !myOwnAlive || !blockHeld()) return;
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

  if (pairsBoard) pairsBoard.detach();

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

  if (pairsBoard) pairsBoard.attachScene(scene);
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
  // Ciudad usa la FP para pasear, no para disparar: nunca se monta viewmodel.
  if (!fpMode || !combat || cityArena()) return;
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
  if (!running || !started || !myAvatar || !myOwnAlive) return;
  // En Ciudad la primera persona es obligatoria: V solo la restaura si algo la
  // apagó, pero nunca permite volver a la vista en tercera persona.
  if (cityArena()) {
    if (!fpMode) setFPMode(true);
    return;
  }
  if (!inCombatZone()) return;
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
    } else if (event.button === 0) {
      // En el paddock, clic sobre un pedestal 3D compra o equipa ese kart.
      const uiBlocks =
        dressingOpen() ||
        !!(shop && shop.isOpen()) ||
        !!(scoreboard && scoreboard.isOpen()) ||
        pairsSelectOpen() ||
        coliseoSelectOpen();
      const kartsPaddockOpen =
        !!kartsState && (kartsState.phase === "waiting" || kartsState.phase === "finished");
      if (
        kartsArena() &&
        kartsPaddockOpen &&
        !uiBlocks &&
        renderer &&
        camera &&
        world &&
        world.kartsPickables.length
      ) {
        const rect = renderer.domElement.getBoundingClientRect();
        kartsPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        kartsPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        kartsRaycaster.setFromCamera(kartsPointer, camera);
        const hit = kartsRaycaster
          .intersectObjects(world.kartsPickables, false)
          .find((entry) => !!entry.object.userData.kartId);
        if (hit) {
          activateKart(hit.object.userData.kartId);
          event.preventDefault();
          return;
        }
      }
      if (combat && canUseCombat()) combat.tryShoot();
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

// Rueda del ratón para acercar/alejar la vista en Pares y en el Coliseo. Se
// registra aparte de `bindPointerUI` porque en táctil ese flujo no se monta.
let pairsZoomBound = false;
function bindPairsZoom() {
  if (pairsZoomBound) return;
  pairsZoomBound = true;
  window.addEventListener(
    "wheel",
    (event) => {
      const delta = event.deltaY > 0 ? 1 : -1;
      if (pairsArena() && !pairsSelectOpen()) {
        event.preventDefault();
        nudgePairsZoom(delta * PAIRS_ZOOM_STEP);
        return;
      }
      if (coliseoArena()) {
        event.preventDefault();
        nudgeColiseoZoom(delta * COLISEO_ZOOM_STEP);
      }
    },
    { passive: false }
  );
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

  pairsUI = createPairsHud({
    onLeave: () => leaveMode(),
    getMyId: () => myId,
    notify: (text) => showToast(text, 2200),
    onZoomIn: () => nudgePairsZoom(-PAIRS_ZOOM_STEP),
    onZoomOut: () => nudgePairsZoom(PAIRS_ZOOM_STEP),
  });

  pairsBoard = createPairsBoard();
  pairsBoard.attachScene(scene);

  coliseoUI = createColiseoHud({
    getMyId: () => myId,
    onWeapon: (weaponId) => sendModeAction({ type: "weapon", weaponId }),
    onReady: () => sendModeAction({ type: "ready" }),
    onLeave: () => leaveMode(),
    onZoomIn: () => nudgeColiseoZoom(-COLISEO_ZOOM_STEP),
    onZoomOut: () => nudgeColiseoZoom(COLISEO_ZOOM_STEP),
  });

  esconditeUI = createEsconditeHud({
    getMyId: () => myId,
    onReady: () => sendModeAction({ type: "ready" }),
    onLeave: () => leaveMode(),
    onDash: () => sendModeAction({ type: "dash" }),
    onPulse: () => sendModeAction({ type: "pulse" }),
    onTag: () => esconditeTagNearest(),
  });

  tntUI = createTntHud({
    getMyId: () => myId,
    onReady: () => sendModeAction({ type: "ready" }),
    onLeave: () => leaveMode(),
  });

  kartsUI = createKartsHud({
    getMyId: () => myId,
    onBuy: (kartId) => sendModeAction({ type: "buy", kartId }),
    onEquip: (kartId) => sendModeAction({ type: "equip", kartId }),
    onTrack: (trackId) => sendModeAction({ type: "track", trackId }),
    onReady: () => sendModeAction({ type: "ready" }),
    onLeave: () => leaveMode(),
  });

  cityUI = createCityHud({
    getMyId: () => myId,
    onBuy: (itemId, qty) => sendModeAction({ type: "buy", itemId, qty }),
    onSell: (itemId, qty) => sendModeAction({ type: "sell", itemId, qty }),
    onLeave: () => leaveMode(),
  });

  if (TOUCH_MODE) {
    const needRoom = () => {
      if (!inCombatZone()) {
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

  // Caminata por pasos pequeños para pruebas: mueve la posición local y la
  // envía al servidor respetando el presupuesto de movimiento. El rAF de una
  // pestaña en segundo plano va a ~1 fps, así que caminar con teclas no sirve.
  async function walkTo(x, z) {
    for (let i = 0; i < 300; i++) {
      const dx = x - myPosition.x;
      const dz = z - myPosition.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.2) break;
      const step = Math.min(0.5, dist);
      myPosition = {
        x: myPosition.x + (dx / dist) * step,
        z: myPosition.z + (dz / dist) * step,
      };
      if (myAvatar) {
        myAvatar.position.set(
          myPosition.x,
          getTerrainHeightAt(currentMapId, myPosition.x, myPosition.z),
          myPosition.z
        );
      }
      sendMove(myPosition.x, myPosition.z, cameraYaw, 0, false, false);
      await new Promise((resolve) => setTimeout(resolve, 70));
    }
    return { x: myPosition.x, z: myPosition.z };
  }

  window.__test = {
    combat,
    loot,
    inventoryBar,
    scoreboard,
    shop,
    pairsUI,
    pairsBoard,
    coliseoUI,
    esconditeUI,
    tntUI,
    kartsUI,
    cityUI,
    remotes,
    walkTo,
    // Ciudad: recoge el objeto cercano y expone el estado para las pruebas de
    // cámara FP, economía e interest management.
    collectNearest: () => cityInteract(),
    get cityNearby() {
      return cityNearbySpot();
    },
    // Ganchos de prueba para la isla y los minijuegos: el servidor valida
    // igualmente proximidad, turno y presupuesto de movimiento.
    enterHub,
    joinMode,
    leaveMode,
    sendModeAction,
    sendMove,
    openPairsSelect,
    closePairsSelect,
    setPairsZoom,
    openColiseoSelect,
    closeColiseoSelect,
    get pairsZoom() { return pairsZoom; },
    get coliseoZoom() { return coliseoZoom; },
    setColiseoZoom,
    get pairsState() { return pairsUI ? pairsUI.getState() : null; },
    get coliseoState() { return coliseoUI ? coliseoUI.getState() : null; },
    get coliseoFight() { return coliseoFightActive(); },
    get esconditeState() { return esconditeUI ? esconditeUI.getState() : null; },
    get esconditeFrozen() { return esconditeSeekerFrozen(); },
    get tntState() { return tntUI ? tntUI.getState() : null; },
    get kartsState() { return kartsState; },
    get cityState() { return cityState; },
    get cityZone() {
      return myRoom && myRoom.kind === "mode" && myRoom.modeId === "ciudad"
        ? { modeId: myRoom.modeId, mapId: myRoom.mapId, combat: myRoom.combat, camera: "first" }
        : null;
    },
    get kartsTarget() { return portalTarget && portalTarget.kind ? portalTarget : null; },
    get tntBaseY() { return tntBaseY; },
    get tntFalling() { return tntFalling; },
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
  bindPairsZoom();

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
        if (Number.isFinite(y)) {
          remote.targetY = tntArena() ? Math.max(0, Math.min(20, y)) : Math.max(0, Math.min(3, y));
        }
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
      const nextZoneKey = room ? `${room.kind || "room"}:${room.code}` : "lobby";
      if (lastZoneKey !== null && nextZoneKey !== lastZoneKey) {
        closePairsSelect();
        closeColiseoSelect();
        flashZone(zoneLabel(room));
      }
      lastZoneKey = nextZoneKey;
      myRoom = room;
      hosting = !!isHosting;
      const kind = room ? room.kind || "room" : "lobby";
      const isPrivateRoom = kind === "room";
      const hasCombat = !!(room && room.combat !== false);
      applyMap(room && room.mapId ? room.mapId : "nevado");
      if (world && world.setColiseoVariant) {
        world.setColiseoVariant(
          kind === "mode" && room.modeId === "coliseo" ? room.variant || "1v1" : "1v1"
        );
      }
      // Ciudad es el único modo sin combate que exige FP: las demás zonas sin
      // combate vuelven a la vista en tercera persona al entrar.
      if (cityArena()) {
        if (!fpMode) setFPMode(true);
      } else if (!hasCombat && fpMode) {
        setFPMode(false);
      }
      if (combat) combat.setEnabled(hasCombat);
      if (!hasCombat) stopBlocking();
      syncShieldButton();
      if (hockey) hockey.setActive(!room);
      // En Karts y Ciudad se oculta la mochila de combate: Karts no la usa y
      // Ciudad tiene su propia mochila/economía en el HUD del distrito.
      if (inventoryBar) {
        inventoryBar.setEnabled(
          !(kind === "mode" && room && (room.modeId === "karts" || room.modeId === "ciudad"))
        );
      }
      if (loot) loot.setEnabled(isPrivateRoom);
      if (scoreboard) scoreboard.setRoom(isPrivateRoom);
      if (shop) {
        shop.setEnabled(isPrivateRoom);
        shop.setScore(myScore);
        shop.setEquipped(combat ? combat.getWeaponId() : null);
      }
      if (pairsUI) {
        if (kind === "mode" && room.modeId === "pares") {
          pairsUI.show(room.variant || "1v1");
          lastPairsPad = null;
        } else {
          pairsUI.hide();
        }
      }
      if (pairsBoard) {
        if (kind === "mode" && room.modeId === "pares") pairsBoard.show(room.variant || "1v1");
        else pairsBoard.hide();
      }
      if (coliseoUI) {
        if (kind === "mode" && room.modeId === "coliseo") {
          coliseoUI.show(room.variant || "1v1");
        } else {
          coliseoUI.hide();
        }
      }
      if (esconditeUI) {
        if (kind === "mode" && room.modeId === "escondite") {
          esconditeUI.show();
        } else {
          esconditeUI.hide();
          clearHideOpacity();
        }
      }
      if (tntUI) {
        if (kind === "mode" && room.modeId === "tnt") {
          tntUI.show();
        } else {
          tntUI.hide();
          tntBaseY = 0;
          tntFalling = false;
        }
      }
      if (kartsUI) {
        if (kind === "mode" && room.modeId === "karts") kartsUI.show();
        else {
          kartsUI.hide();
          kartsState = null;
        }
      }
      if (cityUI) {
        if (cityArena()) cityUI.show();
        else {
          cityUI.hide();
          cityState = null;
        }
      }
      updatePortalPrompt();
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
      if (myRoom && (myRoom.kind || "room") === "room") {
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
      patchCurrentPlayer(targetId, { hp: 0, alive: false });
      if (targetId === myId) {
        myOwnAlive = false;
        myOwnHp = 0;
        motion = createMotionState();
        jumpQueued = false;
        slideQueued = false;
        lastBlocked = false;
        if (touchCtl) touchCtl.setSprint(false);
        if (combat) combat.setOwn(0, false);
        chat.system?.(
          coliseoArena()
            ? "Te han eliminado. Serás espectador hasta la próxima ronda."
            : "Te han eliminado. Volverás en unos segundos."
        );
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
      patchCurrentPlayer(targetId, { hp: 100, alive: true });
      if (targetId === myId) {
        myOwnAlive = true;
        myOwnHp = 100;
        motion = createMotionState();
        jumpQueued = false;
        slideQueued = false;
        lastBlocked = false;
        if (combat) combat.setOwn(100, true);
        chat.system?.(coliseoArena() ? "¡Nueva ronda! Vuelves al combate." : "¡Has vuelto a la partida!");
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
      patchCurrentPlayer(targetId, { hp: targetHp, alive: targetHp > 0 });
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
    onModeState: (snapshot) => {
      if (!snapshot) return;
      // El servidor no manda el equipo propio: se deduce del id local para que
      // el HUD y el resaltado del tablero sepan a quién pertenece el turno.
      const mine = (snapshot.players || []).find((player) => player.id === myId);
      if (snapshot.modeId === "ciudad") {
        cityState = snapshot;
        if (cityUI) {
          if (cityArena() && !cityUI.isOpen()) cityUI.show();
          cityUI.setState(snapshot);
        }
        if (world && world.setCityState) world.setCityState(snapshot);
        return;
      }
      if (snapshot.modeId === "karts") {
        kartsState = snapshot;
        if (kartsUI) {
          if (myRoom && myRoom.modeId === "karts" && !kartsUI.isOpen()) kartsUI.show();
          kartsUI.setState(snapshot);
        }
        if (world && world.setKartsState) {
          world.setKartsState({
            owned: mine ? mine.owned : [KART_START_ID],
            equipped: mine ? mine.kartId : KART_START_ID,
            points: mine ? mine.points : 0,
          });
        }
        if (world && world.setKartsPhase) world.setKartsPhase(snapshot.phase);
        return;
      }
      if (snapshot.modeId === "escondite") {
        snapshot.myRole = mine ? mine.role : null;
        if (esconditeUI) {
          if (myRoom && myRoom.modeId === "escondite" && !esconditeUI.isOpen()) {
            esconditeUI.show();
          }
          esconditeUI.setState(snapshot);
          applyHideOpacity(snapshot);
        }
        return;
      }
      if (snapshot.modeId === "tnt") {
        snapshot.myLayer = mine ? mine.layer : null;
        snapshot.myBlocks = mine ? mine.blocks || 0 : 0;
        if (tntUI) {
          if (myRoom && myRoom.modeId === "tnt" && !tntUI.isOpen()) tntUI.show();
          tntUI.setState(snapshot);
        }
        if (mine && Number.isFinite(mine.y)) tntBaseY = mine.y;
        if (snapshot.phase === "waiting" || snapshot.phase === "countdown") resetTntAvatar();
        if (world && world.setTntState) world.setTntState(snapshot);
        return;
      }
      if (snapshot.modeId === "coliseo") {
        snapshot.mySide = mine ? mine.side : null;
        if (coliseoUI) {
          if (myRoom && myRoom.modeId === "coliseo" && !coliseoUI.isOpen()) {
            coliseoUI.show(snapshot.variant || myRoom.variant);
          }
          coliseoUI.setState(snapshot);
        }
        return;
      }
      snapshot.myTeam = mine ? mine.team : null;
      if (pairsUI) {
        if (myRoom && myRoom.modeId === "pares" && !pairsUI.isOpen()) {
          pairsUI.show(snapshot.variant || myRoom.variant);
        }
        pairsUI.setState(snapshot);
      }
      if (pairsBoard) pairsBoard.setState(snapshot);
    },
    onModeEvent: (payload) => {
      if (payload && payload.modeId === "ciudad") {
        if (cityUI) cityUI.event(payload);
        if (payload.type === "collect" && payload.playerId === myId) {
          const item = cityItemById(payload.item);
          showToast(`+${payload.coins} 🪙 · ${item ? item.name : payload.name}`, 1800);
        }
        return;
      }
      if (payload && payload.modeId === "karts") {
        if (kartsUI) kartsUI.event(payload);
        if (payload.type === "purchase" && payload.playerId === myId) {
          showToast("Kart añadido al garaje", 1800);
        } else if (payload.type === "result" && payload.winnerId === myId) {
          showToast("¡Victoria en la carrera!", 2200);
        }
        return;
      }
      if (payload && payload.modeId === "escondite") {
        if (esconditeUI) esconditeUI.event(payload);
        return;
      }
      if (payload && payload.modeId === "tnt") {
        if (tntUI) tntUI.event(payload);
        if (world && world.tntEvent) world.tntEvent(payload);
        if (payload.type === "fuse") playTntFuse();
        else if (payload.type === "blockFall") playTntFall();
        else if (payload.type === "playerFall") {
          if (payload.eliminated) {
            playTntEliminated();
            if (payload.playerId === myId) {
              tntBaseY = Number.isFinite(payload.y) ? payload.y : tntBaseY;
              tntFalling = true;
              tntFallY = 0;
              tntFallVy = 1.2;
            }
          } else {
            playTntFall();
            if (payload.playerId === myId && Number.isFinite(payload.y)) {
              tntBaseY = payload.y;
              fallToTntLayer();
            }
          }
        } else if (payload.type === "result") {
          playTntEliminated();
        }
        return;
      }
      if (payload && payload.modeId === "coliseo") {
        if (coliseoUI) coliseoUI.event(payload);
        return;
      }
      if (pairsUI) pairsUI.event(payload);
    },
    onModeRejoin: (data) => {
      if (!data) return;
      if (data.modeId === "escondite") {
        showToast("Reconectando al Escondite…", 2200);
        joinMode("escondite", null, true);
        return;
      }
      if (data.modeId === "tnt") {
        showToast("Reconectando al TNT Run…", 2200);
        joinMode("tnt", null, true);
      }
      if (data.modeId === "karts") {
        showToast("Reconectando al paddock…", 2200);
        joinMode("karts", null, true);
      }
      if (data.modeId === "ciudad") {
        showToast("Reconectando al distrito…", 2200);
        joinMode("ciudad", null, true);
      }
    },
    onModeTeleport: ({ id, x, z, y, yaw } = {}) => {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const ground = getTerrainHeightAt(currentMapId, x, z);
      const height = Number.isFinite(y) ? Math.max(0, y) : 0;
      if (id === myId) {
        // El servidor manda dónde empieza la ronda: se reposiciona el avatar
        // local y se orienta la cámara hacia el centro de la arena.
        myPosition = { x, z };
        motion = createMotionState();
        jumpQueued = false;
        slideQueued = false;
        lastBlocked = false;
        if (tntArena()) {
          tntBaseY = height;
          resetTntAvatar();
        }
        if (myAvatar) {
          myAvatar.position.set(x, ground + (tntArena() ? tntBaseY : 0), z);
          if (Number.isFinite(yaw)) {
            myAvatar.rotation.y = yaw;
            cameraYaw = yaw + Math.PI;
          }
        }
      } else {
        const remote = remotes.get(id);
        if (remote) {
          remote.targetX = x;
          remote.targetZ = z;
          remote.targetY = height;
          if (remote.group) {
            remote.group.position.set(x, ground + height, z);
            if (Number.isFinite(yaw)) remote.group.rotation.y = yaw;
          }
        }
      }
      voice.rememberPosition(id, x, z);
    },
    onModeError: ({ error } = {}) => {
      if (error) showToast(error, 2400);
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
  // En el Escondite F etiqueta y G usa la habilidad del rol (esquiva o pulso).
  // El servidor valida fase, distancia y línea de visión antes de aplicarlas.
  if (esconditeArena()) {
    if (key === "f") {
      esconditeTagNearest();
      return;
    }
    if (key === "g") {
      const state = esconditeUI ? esconditeUI.getState() : null;
      const mine = state && (state.players || []).find((player) => player.id === myId);
      if (mine && mine.role === "seeker") sendModeAction({ type: "pulse" });
      else if (mine && mine.role === "hider") sendModeAction({ type: "dash" });
      return;
    }
  }
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

  if (pairsUI) {
    pairsUI.dispose();
    pairsUI = null;
  }
  if (pairsBoard) {
    pairsBoard.dispose();
    pairsBoard = null;
  }
  if (esconditeUI) {
    esconditeUI.hide();
    esconditeUI = null;
  }
  if (tntUI) {
    tntUI.hide();
    tntUI = null;
  }
  if (kartsUI) {
    kartsUI.hide();
    kartsUI = null;
  }
  if (cityUI) {
    cityUI.dispose();
    cityUI = null;
  }
  cityState = null;
  kartsState = null;
  resetTntAvatar();
  tntBaseY = 0;
  clearHideOpacity();
  closePairsSelect();
  if (zoneFade) zoneFade.classList.remove("is-on");
  clearTimeout(zoneFadeTimer);
  lastZoneKey = null;
  lastPairsPad = null;
  portalTarget = null;
  if (portalPrompt) portalPrompt.hidden = true;
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
    hideOpacity: 1,
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

    // Paneles que bloquean el movimiento: vestidor, tienda, marcador y selector
    // de formato. El HUD de Pares NO bloquea: se juega caminando por la arena.
    const uiOpen =
      dressingOpen() ||
      !!(shop && shop.isOpen()) ||
      !!(scoreboard && scoreboard.isOpen()) ||
      pairsSelectOpen() ||
      coliseoSelectOpen();
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
        if (!inCombatZone()) showToast("Entra a una sala para combatir");
        else if (!canUseCombat()) showToast("Espera a que empiece la ronda");
        else if (combat) combat.tryShoot();
      }
      if (combat && canUseCombat()) {
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
    // Karts: intenciones de conducción a 20 Hz. Se usan las teclas sin girar
    // por la cámara porque A/D siempre son giro del volante, no del mundo.
    if (kartsArena() && kartsState && kartsState.phase === "racing" && now - lastKartsDriveSend >= 50) {
      let kartX = input.dx;
      let kartZ = input.dz;
      if (touchCtl && !uiOpen) {
        const tdKart = touchCtl.getDir();
        kartX += tdKart.x;
        kartZ += tdKart.z;
      }
      sendModeAction({
        type: "drive",
        throttle: kartZ < 0 ? 1 : kartZ > 0 ? -1 : 0,
        steer: kartX > 0.1 ? 1 : kartX < -0.1 ? -1 : 0,
        drift: isKeyDown(" ") || isKeyDown("shift"),
      });
      lastKartsDriveSend = now;
    }

    // En la arena de Pares la cámara está fija: el movimiento se hace relativo
    // a la pantalla (W hacia el fondo del tablero) para no depender del ratón.
    const arena = pairsArena();
    const baseYaw = arena ? 0 : cameraYaw;
    const cosY = Math.cos(baseYaw);
    const sinY = Math.sin(baseYaw);
    const mdx = dx * cosY + dz * sinY;
    const mdz = -dx * sinY + dz * cosY;
    const blockingNow = !!(combat && combat.isBlocking());
    // En el Coliseo solo se camina durante la ronda activa: en espera, cuenta
    // atrás y fin de ronda el servidor ignora el movimiento.
    const tntStateNow = tntUI ? tntUI.getState() : null;
    const tntCanMove = !tntArena() || !!(tntStateNow && tntStateNow.phase === "playing");
    const canMove =
      (!coliseoArena() || coliseoFightActive()) &&
      !esconditeSeekerFrozen() &&
      tntCanMove &&
      (!kartsArena() || !kartsRacing());
    const wantsMove = !!(mdx || mdz) && myOwnAlive && canMove;
    const sprintKey =
      !uiOpen && (isKeyDown("shift") || !!(touchCtl && touchCtl.sprintHeld));
    // Fase 4: salto/sprint/deslizamiento. El salto es cosmético (no esquiva
    // balas); el servidor sólo guarda y retransmite la altura para la pose.
    // En Pares, además, un salto sobre una carta envía la intención de voltear.
    const jumpEdge = jumpQueued && !uiOpen;
    const motionStep = stepMotion(
      motion,
      {
        move: wantsMove,
        sprint: sprintKey && !blockingNow,
        jump: jumpEdge && !tntArena(),
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
        getTerrainHeightAt(currentMapId, next.x, next.z) +
          (tntArena() ? tntBaseY + tntFallY : 0) +
          motionStep.y,
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

    updatePortalPrompt();
    if (cityArena() && cityUI) {
      const spot = cityNearbySpot();
      cityUI.setNearby(spot, spot ? spot.available : true);
    }
    applyKartsSnapshot(dt);

    // Arena de Pares: equipo al pisar plataforma, carta bajo los pies y salto
    // como intención de voltear. El servidor valida turno, carta y posición.
    let pairsPad = null;
    let pairsCard = -1;
    if (arena && pairsUI) {
      const def = pairsVariantDef();
      pairsPad = teamPadAt(def, myPosition.x, myPosition.z);
      pairsCard = cardIndexAt(def, myPosition.x, myPosition.z);
      const snap = pairsUI.getState();
      const waiting = !snap || snap.status === "waiting";
      if (
        waiting &&
        pairsPad &&
        pairsPad !== pairsUI.getMyTeam() &&
        pairsPad !== lastPairsPad
      ) {
        sendModeAction({ type: "team", team: pairsPad });
      }
      lastPairsPad = pairsPad;
      pairsUI.setLocal({ cardIndex: pairsCard, padTeam: pairsPad });

      if (jumpEdge && pairsCard >= 0 && pairsUI.canFlipNow()) {
        // Posición fresca justo antes de la intención: el servidor deduce la
        // carta con su posición autoritativa, no con un índice del cliente.
        sendMove(
          myPosition.x,
          myPosition.z,
          cameraYaw,
          motionStep.y,
          motionStep.sprinting,
          motionStep.sliding
        );
        lastMoveSend = now;
        sendModeAction({ type: "flip" });
      }
    } else {
      lastPairsPad = null;
    }

    // En 3.ª persona, bloquear gira al pingüino hacia donde mira la cámara:
    // el escudo debe apuntar al frente de la vista, no a la última caminata.
    if (!fpMode && myAvatar && blockingNow && !moving) {
      myAvatar.rotation.y += angleStep(myAvatar.rotation.y, cameraYaw + Math.PI) * Math.min(1, dt * 12);
    }

    if (myAvatar && (!combat || !combat.isAnimating(myId))) {
      const bob = moving && motion.grounded ? Math.abs(Math.sin(now * 0.012)) * 0.07 : 0;
      let tntHeight = 0;
      if (tntArena()) {
        const snap = tntUI ? tntUI.getState() : null;
        const mine = snap ? (snap.players || []).find((p) => p.id === myId) : null;
        const eliminated = !!(mine && mine.eliminated);
        if (tntFalling) {
          tntFallVy -= 18 * dt;
          tntFallY += tntFallVy * dt;
          if (!eliminated && tntFallY <= 0) {
            tntFallY = 0;
            tntFallVy = 0;
            tntFalling = false;
          }
          if (eliminated && tntFallY < -40) myAvatar.visible = false;
        }
        tntHeight = tntBaseY + tntFallY;
      }
      myAvatar.position.y = kartsRacing()
        ? myAvatar.position.y
        : getTerrainHeightAt(currentMapId, myAvatar.position.x, myAvatar.position.z) +
          tntHeight +
          motionStep.y +
          bob;
      animateAvatar(myAvatar, now, dt, moving, {
        jumping: motionStep.jumping,
        sprinting: motionStep.sprinting,
        sliding: motionStep.sliding,
      });
      // animateAvatar controla el balanceo al caminar; en carrera el peralte y
      // la pendiente del trazado mandan, así que se aplican después.
      if (kartsRacing()) {
        const mineSnap = kartsState && (kartsState.players || []).find((p) => p.id === myId);
        if (mineSnap) {
          myAvatar.rotation.z = -(Number(mineSnap.bank) || 0);
          myAvatar.rotation.x = Number(mineSnap.pitch) || 0;
        }
      } else {
        myAvatar.rotation.x = 0;
      }
    }

    remotes.forEach((remote, remoteId) => {
      const group = remote.group;
      const animating = combat ? combat.isAnimating(remoteId) : false;
      const headX = remote.targetX - group.position.x;
      const headZ = remote.targetZ - group.position.z;
      const moved = Math.hypot(headX, headZ) > 0.001 && !animating;
      if (moved && !kartsRacing()) {
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
        if (kartsRacing()) {
          const entry =
            kartsState && (kartsState.players || []).find((p) => p.id === remoteId);
          if (entry) {
            group.rotation.z = -(Number(entry.bank) || 0);
            group.rotation.x = Number(entry.pitch) || 0;
          }
        } else {
          group.rotation.x = 0;
        }
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

  if (pairsBoard) {
    const team = arena && pairsUI ? getPairsTeam(pairsUI.getMyTeam()) : null;
    pairsBoard.update(dt, {
      active: !!arena,
      x: myPosition.x,
      z: myPosition.z,
      canFlip: !!(pairsUI && pairsUI.canFlipNow()),
      color: (team && team.color) || "#dbeafe",
    });
  }

  if (pairsUI) pairsUI.update(dt);

    if (kartsRacing() && myAvatar) {
      // Cámara de seguimiento baja, justo detrás del kart. El yaw lo manda el
      // snapshot autoritativo, así que el coche siempre se ve de espaldas.
      const target = myAvatar.position;
      camera.position.set(
        target.x + Math.sin(cameraYaw) * 12,
        target.y + 5.4,
        target.z + Math.cos(cameraYaw) * 12
      );
      camera.lookAt(target.x, target.y + 1.3, target.z);
    } else if (arena) {
      // Cámara elevada y fija sobre el tablero: se ve la cuadrícula completa,
      // las dos plataformas y los atriles sin girar con el ratón.
      const big = pairsVariantDef().grid >= 6;
      camera.position.set(
        0,
        (big ? 20 : 17.5) * pairsZoom,
        (big ? 26 : 22.5) * pairsZoom
      );
      camera.lookAt(0, 0.6, 0);
    } else if (fpMode) {
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
      const zoom = coliseoArena() ? coliseoZoom : 1;
      const camDist = (big ? 55 : 16) * zoom;
      const camHeight =
        ((big ? 34 : 12) + Math.sin(cameraPitch) * (big ? 18 : 6)) * zoom;
      camera.position.set(
        cameraTarget.x + Math.sin(cameraYaw) * camDist,
        Math.max((big ? 12 : 4) * zoom, camHeight),
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
    const kind = myRoom.kind || "room";
    if (kind === "hub") {
      roomsTitleText.textContent = "Isla de Minijuegos";
    } else if (kind === "mode") {
      roomsTitleText.textContent = myRoom.name;
    } else {
      const collapsed = document.body.classList.contains("room-info-collapsed");
      roomsTitleText.textContent = collapsed ? `${myRoom.name} (${myRoom.code})` : "Sala privada";
    }
  } else {
    roomsTitleText.textContent = "Salas privadas";
  }
}

function zoneKind() {
  if (!myRoom) return "lobby";
  return myRoom.kind || "room";
}

function inPrivateRoom() {
  return zoneKind() === "room";
}

function inHub() {
  return zoneKind() === "hub";
}

function inMode() {
  return zoneKind() === "mode";
}

// Arena 3D de Pares: cámara elevada, movimiento relativo a la pantalla y
// tablero físico. El resto de zonas conserva la cámara y los controles de siempre.
function pairsArena() {
  return !!myRoom && myRoom.kind === "mode" && myRoom.modeId === "pares";
}

function pairsVariantDef() {
  return resolvePairsVariant(myRoom && myRoom.variant ? myRoom.variant : "1v1");
}

// Arena del Coliseo melee: misma cámara y controles que una sala, pero con
// reglas propias (solo melee, rondas y movimiento únicamente en `fight`).
function coliseoArena() {
  return !!myRoom && myRoom.kind === "mode" && myRoom.modeId === "coliseo";
}

function coliseoFightActive() {
  const state = coliseoUI ? coliseoUI.getState() : null;
  return !!state && state.phase === "fight";
}

// --- TNT Run ----------------------------------------------------------------

function tntArena() {
  return !!myRoom && myRoom.kind === "mode" && myRoom.modeId === "tnt";
}

// El servidor manda la nueva capa: se deja que el avatar caiga desde donde
// estaba hasta la altura autoritativa en vez de teletransportarlo en seco.
function fallToTntLayer() {
  if (!myAvatar) return;
  const ground = getTerrainHeightAt(currentMapId, myPosition.x, myPosition.z);
  const previousY = myAvatar.position.y - ground;
  tntFallY = Math.max(0, previousY - tntBaseY);
  tntFallVy = 0;
  tntFalling = true;
}

function resetTntAvatar() {
  tntFalling = false;
  tntFallY = 0;
  tntFallVy = 0;
  if (myAvatar) myAvatar.visible = true;
}

// --- Ciudad social ----------------------------------------------------------

function cityArena() {
  return !!myRoom && myRoom.kind === "mode" && myRoom.modeId === "ciudad";
}

function cityCollectibleEntry(spot) {
  if (!spot || !cityState) return null;
  return (cityState.collectibles || []).find((entry) => entry.id === spot.id) || null;
}

// Objeto más cercano dentro del radio de interacción, con el estado de respawn
// que mandó el servidor. Se usa tanto para el aviso del HUD como para la tecla E.
function cityNearbySpot() {
  if (!cityArena()) return null;
  const spot = cityNearestCollectible(myPosition.x, myPosition.z);
  if (!spot) return null;
  const entry = cityCollectibleEntry(spot);
  return { ...spot, available: entry ? entry.available !== false : true };
}

function cityInteract() {
  const spot = cityNearbySpot();
  if (!spot) return false;
  if (spot.available === false) {
    showToast("Ese objeto ya fue recogido; volverá a aparecer.", 1800);
    return true;
  }
  sendModeAction({ type: "collect", id: spot.id });
  return true;
}

// --- Karts ------------------------------------------------------------------

function kartsArena() {
  return !!myRoom && myRoom.kind === "mode" && myRoom.modeId === KARTS_MAP_ID;
}

function kartsRacing() {
  return (
    kartsArena() &&
    !!kartsState &&
    (kartsState.phase === "countdown" || kartsState.phase === "racing")
  );
}

// Comprar o equipar desde el pedestal 3D, desde el aviso de proximidad o desde
// el HUD. El controlador decide si la compra es válida.
function activateKart(kartId) {
  const mine = kartsState && (kartsState.players || []).find((p) => p.id === myId);
  if (!mine) return;
  const kart = kartById(kartId);
  if (mine.owned.includes(kartId)) {
    sendModeAction({ type: "equip", kartId });
  } else if (mine.points >= (kart ? kart.price : 0)) {
    sendModeAction({ type: "buy", kartId });
  } else {
    showToast(`Te faltan ${Math.max(0, (kart ? kart.price : 0) - mine.points)} puntos de carrera.`, 2200);
  }
}

// Durante la carrera el avatar NO se mueve con el teclado: el servidor manda la
// posición 20 veces por segundo y aquí solo se interpola hacia ella. Encima del
// pingüino se monta el kart 3D que tenga equipado cada jugador.
function attachKartModel(avatar, kartId) {
  if (!avatar) return;
  const current = avatar.userData.kartModel;
  if (current && current.userData.kartId === kartId) return;
  if (current) {
    avatar.remove(current);
    avatar.userData.kartModel = null;
  }
  if (!avatar.userData.kartHiddenMeshes) {
    const hidden = [];
    avatar.traverse((child) => {
      if (child.isMesh && child.visible) hidden.push(child);
    });
    hidden.forEach((mesh) => {
      mesh.visible = false;
    });
    avatar.userData.kartHiddenMeshes = hidden;

    const labels = [];
    avatar.traverse((child) => {
      if (child.isSprite) {
        labels.push({ sprite: child, y: child.position.y });
        child.position.y = 2.95;
      }
    });
    avatar.userData.kartLabels = labels;
  }
  const model = createKartModel(kartId);
  avatar.add(model);
  avatar.userData.kartModel = model;
}

function detachKartModel(avatar) {
  if (!avatar || !avatar.userData.kartModel) return;
  avatar.remove(avatar.userData.kartModel);
  avatar.userData.kartModel = null;
  for (const mesh of avatar.userData.kartHiddenMeshes || []) mesh.visible = true;
  for (const label of avatar.userData.kartLabels || []) label.sprite.position.y = label.y;
  avatar.userData.kartHiddenMeshes = null;
  avatar.userData.kartLabels = null;
}

function spinKartWheels(avatar, speed, dt) {
  const model = avatar && avatar.userData.kartModel;
  if (!model || !model.userData.wheels || !Number.isFinite(speed)) return;
  const spin = (speed / 0.39) * Math.max(0, Math.min(dt, 0.1));
  for (const wheel of model.userData.wheels) wheel.rotation.x -= spin;
}

function applyKartsSnapshot(dt = 0) {
  if (!kartsRacing() || !kartsState) {
    if (myAvatar) detachKartModel(myAvatar);
    for (const remote of remotes.values()) detachKartModel(remote.group);
    return;
  }

  const active = new Set();
  for (const entry of kartsState.players || []) {
    active.add(entry.id);
    const kartId = entry.kartId || KART_START_ID;
    const height = Number.isFinite(entry.y) ? entry.y : 0;
    if (entry.id === myId) {
      if (!myAvatar) continue;
      myPosition = { x: entry.x, z: entry.z };
      myAvatar.position.set(entry.x, height, entry.z);
      if (Number.isFinite(entry.yaw)) myAvatar.rotation.y = entry.yaw;
      cameraYaw = entry.yaw + Math.PI;
      attachKartModel(myAvatar, kartId);
      spinKartWheels(myAvatar, entry.speed, dt);
      continue;
    }
    const remote = remotes.get(entry.id);
    if (!remote) continue;
    remote.targetX = entry.x;
    remote.targetZ = entry.z;
    remote.targetY = height;
    if (remote.group) {
      remote.group.position.set(entry.x, height, entry.z);
      if (Number.isFinite(entry.yaw)) remote.group.rotation.y = entry.yaw;
      attachKartModel(remote.group, kartId);
      spinKartWheels(remote.group, entry.speed, dt);
    }
  }
  if (myAvatar && !active.has(myId)) detachKartModel(myAvatar);
  for (const [id, remote] of remotes) {
    if (!active.has(id)) detachKartModel(remote.group);
  }
}

// --- Escondite --------------------------------------------------------------

function esconditeArena() {
  return !!myRoom && myRoom.kind === "mode" && myRoom.modeId === "escondite";
}

function esconditeSeekerFrozen() {
  if (!esconditeArena()) return false;
  const state = esconditeUI ? esconditeUI.getState() : null;
  if (!state || state.phase !== "hide") return false;
  const mine = (state.players || []).find((player) => player.id === myId);
  return !!mine && mine.role === "seeker";
}

function esconditeTagNearest() {
  const state = esconditeUI ? esconditeUI.getState() : null;
  if (!state || state.phase !== "seek") return;
  const mine = (state.players || []).find((player) => player.id === myId);
  if (!mine || mine.role !== "seeker") return;
  let target = null;
  let best = Infinity;
  for (const player of state.players || []) {
    if (player.role !== "hider" || player.tagged || player.offline) continue;
    const remote = remotes.get(player.id);
    if (!remote) continue;
    const dist = Math.hypot(remote.targetX - myPosition.x, remote.targetZ - myPosition.z);
    if (dist < best) {
      best = dist;
      target = player.id;
    }
  }
  if (target) sendModeAction({ type: "tag", targetId: target });
}

// Los escondidos dentro de un escondite se ven atenuados para quien no es su
// compañero de bando; el buscador solo los distingue si están expuestos.
function applyHideOpacity(snapshot) {
  if (!esconditeArena() || !snapshot) return;
  const mine = (snapshot.players || []).find((player) => player.id === myId);
  const showAll = mine && mine.role === "seeker" && snapshot.phase === "result";
  remotes.forEach((remote, id) => {
    const entry = (snapshot.players || []).find((player) => player.id === id);
    const hidden =
      !!entry &&
      !showAll &&
      entry.role === "hider" &&
      !entry.tagged &&
      !!hideSpotAt(remote.targetX, remote.targetZ, 1.5);
    const opacity = hidden ? 0.28 : 1;
    if (remote.hideOpacity === opacity) return;
    remote.hideOpacity = opacity;
    if (!remote.group) return;
    remote.group.traverse((node) => {
      const materials = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : [];
      for (const material of materials) {
        material.transparent = opacity < 1;
        material.opacity = opacity;
        material.depthWrite = opacity >= 1;
      }
    });
  });
}

function clearHideOpacity() {
  remotes.forEach((remote) => {
    if (remote.hideOpacity === undefined || remote.hideOpacity === 1) return;
    remote.hideOpacity = 1;
    if (!remote.group) return;
    remote.group.traverse((node) => {
      const materials = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : [];
      for (const material of materials) {
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
      }
    });
  });
}

// Zonas donde el combate está permitido: salas privadas y el Coliseo melee.
function inCombatZone() {
  return inPrivateRoom() || coliseoArena();
}

// Además de estar en zona de combate, el Coliseo exige que la ronda esté
// activa. Evita que el cliente anime golpes que el servidor va a descartar.
function canUseCombat() {
  return inCombatZone() && (!coliseoArena() || coliseoFightActive());
}

function zoneLabel(room) {
  if (!room) return "Lobby";
  const kind = room.kind || "room";
  if (kind === "hub") return "Isla de Minijuegos";
  if (kind === "mode") return room.name || "Minijuego";
  return room.name || "Sala";
}

// Fundido breve al cambiar de zona. La etiqueta se ve sobre el negro.
function flashZone(label) {
  if (!zoneFade) return;
  if (zoneFadeLabel) zoneFadeLabel.textContent = label;
  zoneFade.classList.add("is-on");
  clearTimeout(zoneFadeTimer);
  zoneFadeTimer = setTimeout(() => zoneFade.classList.remove("is-on"), 820);
}

function pairsSelectOpen() {
  return !!(pairsSelect && !pairsSelect.hidden);
}

function openPairsSelect() {
  if (pairsSelect) pairsSelect.hidden = false;
}

function closePairsSelect() {
  if (pairsSelect) pairsSelect.hidden = true;
}

function coliseoSelectOpen() {
  return !!(coliseoSelect && !coliseoSelect.hidden);
}

function openColiseoSelect() {
  if (coliseoSelect) coliseoSelect.hidden = false;
}

function closeColiseoSelect() {
  if (coliseoSelect) coliseoSelect.hidden = true;
}

function handleMinigames() {
  if (inPrivateRoom()) {
    showToast("Sal de la sala para ir a los minijuegos.", 2400);
    return;
  }
  if (inHub()) {
    showToast("Ya estás en la isla: camina hasta un portal.", 2200);
    return;
  }
  enterHub();
}

// Aviso de proximidad: puerta del lobby o portal de la isla. El radio visual
// (3,2 m) es menor que el que valida el servidor (6 m) para tolerar la latencia.
function updatePortalPrompt() {
  if (!portalPrompt) return;
  let target = null;

  // Paddock: los pedestales y los portales se detectan por proximidad, igual
  // que los portales de la isla. El servidor valida la acción de todos modos.
  if (kartsArena() && (!kartsState || kartsState.phase === "waiting" || kartsState.phase === "finished")) {
    const mine = kartsState && (kartsState.players || []).find((p) => p.id === myId);
    let best = null;
    for (const pedestal of KART_PEDESTALS) {
      const dist = Math.hypot(myPosition.x - pedestal.x, myPosition.z - pedestal.z);
      if (dist > 4.8 || (best && dist >= best.dist)) continue;
      const kart = kartById(pedestal.kartId);
      const owned = !!(mine && mine.owned.includes(pedestal.kartId));
      const equipped = !!(mine && mine.kartId === pedestal.kartId);
      best = {
        dist,
        target: {
          kind: "kart",
          kartId: pedestal.kartId,
          label: kart ? kart.name : "Kart",
          icon: equipped ? "✅" : owned ? "🏎️" : "🛒",
          live: true,
          action: equipped
            ? "Equipado"
            : owned
              ? "Equipar (E)"
              : mine && mine.points >= (kart ? kart.price : 0)
                ? `Comprar ${kart ? kart.price : 0} pts (E)`
                : `Faltan ${Math.max(0, (kart ? kart.price : 0) - (mine ? mine.points : 0))} pts`,
        },
      };
    }
    for (const portal of KARTS_PORTALS) {
      const dist = Math.hypot(myPosition.x - portal.x, myPosition.z - portal.z);
      if (dist > KARTS_PORTAL_TRIGGER || (best && dist >= best.dist)) continue;
      best = {
        dist,
        target: {
          kind: "track",
          trackId: portal.trackId,
          label: portal.label,
          icon: portal.status === "live" ? "🏁" : "🚧",
          live: portal.status === "live",
          action: portal.status === "live" ? "Entrar (E)" : "En preparación",
        },
      };
    }
    if (best) target = best.target;
  } else if (inHub()) {
    const near = nearestPortal(myPosition.x, myPosition.z);
    if (near) {
      target = {
        modeId: near.modeId,
        label: near.label,
        icon: near.icon,
        live: near.status === "live",
      };
    }
  } else if (!myRoom) {
    const dist = Math.hypot(myPosition.x - LOBBY_PORTAL.x, myPosition.z - LOBBY_PORTAL.z);
    if (dist <= PORTAL_TRIGGER_RADIUS) {
      target = { modeId: "hub", label: "Minijuegos", icon: LOBBY_PORTAL.icon, live: true };
    }
  }

  portalTarget = target;
  if (!target) {
    portalPrompt.hidden = true;
    return;
  }

  portalPromptText.textContent = `${target.icon} ${target.label}`;
  portalPromptBtn.textContent = target.action || (target.live ? "Entrar (E)" : "Próximamente");
  portalPromptBtn.disabled = !target.live;
  portalPrompt.hidden = false;
}

function activatePortal() {
  if (!portalTarget) return false;
  if (!portalTarget.live) {
    showToast(`${portalTarget.label} todavía no está disponible.`, 2200);
    return true;
  }
  if (portalTarget.kind === "kart") {
    activateKart(portalTarget.kartId);
    return true;
  }
  if (portalTarget.kind === "track") {
    if (!portalTarget.live) {
      showToast("Esa pista está en preparación.", 2200);
      return true;
    }
    sendModeAction({ type: "track", trackId: portalTarget.trackId });
    showToast("Pista seleccionada. Pulsa «Listo» cuando estés preparado.", 2000);
    return true;
  }
  if (portalTarget.modeId === "hub") enterHub();
  else if (portalTarget.modeId === "pares" && !inMode()) openPairsSelect();
  else if (portalTarget.modeId === "coliseo" && !inMode()) openColiseoSelect();
  else joinMode(portalTarget.modeId);
  return true;
}

function renderRoomPanel() {
  const kind = zoneKind();
  const inZone = !!myRoom;
  const isPrivate = kind === "room";
  const roomCode = myRoom ? myRoom.code : null;
  // Al entrar o salir de una sala el panel vuelve a mostrarse completo; el
  // colapso es una preferencia momentánea, no se arrastra a la siguiente sala.
  if (roomCode !== lastRoomPanelCode) {
    lastRoomPanelCode = roomCode;
    setRoomInfoCollapsed(false);
  }
  document.body.classList.toggle("in-room", inZone);
  if (roomInfoToggle) roomInfoToggle.hidden = !isPrivate;
  roomCreateForm.hidden = inZone;
  roomJoinForm.hidden = inZone;
  roomListEl.hidden = inZone;
  roomPlace.hidden = !inZone;
  const mapName = myRoom ? getMap(myRoom.mapId).name : null;
  headerPlace.textContent = !myRoom
    ? "· Lobby"
    : kind === "hub"
      ? "· Isla de Minijuegos"
      : kind === "mode"
        ? `· ${myRoom.name}`
        : `· ${myRoom.name} (${myRoom.code})${mapName ? ` · ${mapName}` : ""}`;
  if (fpToggleBtn) fpToggleBtn.hidden = !isPrivate;
  if (shopOpenBtn) shopOpenBtn.hidden = !isPrivate;

  if (myRoom) {
    if (kind === "hub") {
      roomCurrent.textContent = "🎮 Isla de Minijuegos";
      roomOwnerInfo.textContent = "Zona social · sin combate · camina hasta un portal";
      roomLeaveBtn.textContent = "Salir al lobby";
    } else if (kind === "mode") {
      const statusText =
        myRoom.status === "playing"
          ? "Partida en curso"
          : myRoom.status === "finished"
            ? "Ronda terminada"
            : "Esperando jugadores";
      roomCurrent.textContent = `${myRoom.name}${mapName ? ` — ${mapName}` : ""}`;
      roomOwnerInfo.textContent = `Minijuego · ${statusText} · sin combate`;
      roomLeaveBtn.textContent = "← Volver a la isla";
    } else {
      roomCurrent.textContent = `${myRoom.name} (${myRoom.code})${mapName ? ` — ${mapName}` : ""}`;
      roomOwnerInfo.textContent = hosting
        ? "Eres el anfitrión"
        : `Anfitrión: ${myRoom.ownerName}`;
      roomLeaveBtn.textContent = "Salir de la sala";
    }
    roomCloseBtn.hidden = !(isPrivate && hosting);
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
    button.disabled = inPrivateRoom();
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