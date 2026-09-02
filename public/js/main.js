import { createWorld } from "./world.js";
import { createAvatar } from "./avatar.js";
import { moveWithCollisions } from "./collision.js";
import { getInputDirection } from "./input.js";
import { connectToGame, sendMove, sendChat } from "./network.js";
import { setupChatUI } from "./chat.js";

const joinScreen = document.getElementById("join-screen");
const joinForm = document.getElementById("join-form");
const nameInput = document.getElementById("name-input");
const joinError = document.getElementById("join-error");
const gameScreen = document.getElementById("game");
const onlineList = document.getElementById("online-list");

const WALK_SPEED = 6;
const MOVE_SEND_INTERVAL = 50;

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    joinError.textContent = "Escribe un nombre para entrar.";
    return;
  }
  startGame(name);
});

let chat;
let scene;
let camera;
let myId = null;
let myAvatar = null;
let myPosition = { x: 0, z: 0 };
let lastMoveSend = 0;
const remotes = new Map();

function startGame(name) {
  joinScreen.hidden = true;
  gameScreen.hidden = false;

  const world = createWorld();
  scene = world.scene;
  camera = world.camera;

  chat = setupChatUI((text) => sendChat(text));

  connectToGame({
    name,
    onWelcome: (message) => {
      myId = message.id;
      const me = message.players.find((player) => player.id === myId);
      myAvatar = createAvatar(me.name, me.color);
      scene.add(myAvatar);
      myPosition = { x: me.x, z: me.z };
      myAvatar.position.set(me.x, 0, me.z);

      updateOnlineList(message.players);
      message.players.forEach((player) => {
        if (player.id !== myId) spawnRemote(player);
      });
    },
    onJoined: (player) => {
      spawnRemote(player);
      addOnline(player);
    },
    onMoved: ({ id, x, z }) => {
      const remote = remotes.get(id);
      if (remote) {
        remote.targetX = x;
        remote.targetZ = z;
      }
    },
    onLeft: ({ id }) => {
      const remote = remotes.get(id);
      if (remote) {
        scene.remove(remote.group);
        remotes.delete(id);
        removeOnline(id);
      }
    },
    onChat: (message) => chat.appendMessage(message),
  });

  requestAnimationFrame(loop);
}

function spawnRemote(player) {
  const group = createAvatar(player.name, player.color);
  group.position.set(player.x, 0, player.z);
  scene.add(group);
  remotes.set(player.id, { group, targetX: player.x, targetZ: player.z, name: player.name, color: player.color });
}

let lastUpdate = performance.now();

function loop(now) {
  const dt = Math.min((now - lastUpdate) / 1000, 0.05);
  lastUpdate = now;

  const { dx, dz } = getInputDirection();
  if (dx || dz) {
    const length = Math.hypot(dx, dz);
    const next = moveWithCollisions(
      myPosition.x + (dx / length) * WALK_SPEED * dt,
      myPosition.z + (dz / length) * WALK_SPEED * dt
    );
    myPosition = next;
    myAvatar.position.set(next.x, 0, next.z);

    if (now - lastMoveSend >= MOVE_SEND_INTERVAL) {
      sendMove(next.x, next.z);
      lastMoveSend = now;
    }
  }

  remotes.forEach((remote) => {
    const group = remote.group;
    group.position.x += (remote.targetX - group.position.x) * Math.min(1, dt * 12);
    group.position.z += (remote.targetZ - group.position.z) * Math.min(1, dt * 12);
  });

  camera.position.set(myAvatar.position.x, 7, myAvatar.position.z + 10);
  camera.lookAt(myAvatar.position.x, 0, myAvatar.position.z);

  world.renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function updateOnlineList(players) {
  onlineList.innerHTML = "";
  players.forEach(addOnline);
}

function addOnline(player) {
  if (player.id !== myId) {
    const item = document.createElement("li");
    item.id = `online-${player.id}`;
    const dot = document.createElement("span");
    dot.style.background = player.color;
    item.append(dot, document.createTextNode(player.name));
    onlineList.appendChild(item);
  }
}

function removeOnline(id) {
  const item = document.getElementById(`online-${id}`);
  if (item) item.remove();
}