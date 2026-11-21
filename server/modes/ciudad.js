// Controlador autoritativo de Ciudad social (Ola 6, alcance C1-C2).
//
// Módulo puro: no toca Socket.IO ni DOM. El servidor inyecta el reloj, el estado
// persistente y los callbacks de escritura. El cliente solo envía intenciones
// (`collect`, `buy`, `sell`); la distancia al coleccionable, el precio y el
// respawn los decide aquí con la posición autoritativa que validó `player:move`.
//
// No hay fases ni fin de partida: el distrito es persistente. Cada jugador
// conserva su cartera y su mochila en un perfil que sobrevive al `mode:leave`.

import {
  CITY_COLLECTIBLES,
  CITY_INTERACT_RANGE,
  CITY_ITEMS,
  CITY_MAP_ID,
  CITY_MAX_PLAYERS,
  CITY_RESPAWN_MS,
  CITY_START_COINS,
  cityCellOf,
  cityClamp,
  cityCollectibleById,
  cityItemById,
  citySpawnFor,
} from "../../public/js/cityDefs.js";

const INVENTORY_LIMIT = 24;
const MAX_QTY = 999;

function copyWallet(wallet) {
  return {
    coins: Math.max(0, Math.round(Number(wallet && wallet.coins) || 0)),
    collected: Math.max(0, Math.round(Number(wallet && wallet.collected) || 0)),
    earned: Math.max(0, Math.round(Number(wallet && wallet.earned) || 0)),
    sold: Math.max(0, Math.round(Number(wallet && wallet.sold) || 0)),
    bought: Math.max(0, Math.round(Number(wallet && wallet.bought) || 0)),
  };
}

function copyInventory(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && item.id && Number(item.qty) > 0)
    .map((item) => ({ id: String(item.id), qty: Math.min(MAX_QTY, Math.round(Number(item.qty) || 1)) }))
    .slice(0, INVENTORY_LIMIT);
}

function addToInventory(inventory, itemId, qty = 1) {
  if (!cityItemById(itemId) || qty <= 0) return false;
  const found = inventory.find((item) => item.id === itemId);
  if (found) {
    found.qty = Math.min(MAX_QTY, found.qty + qty);
    return true;
  }
  if (inventory.length >= INVENTORY_LIMIT) return false;
  inventory.push({ id: itemId, qty: Math.min(MAX_QTY, qty) });
  return true;
}

function takeFromInventory(inventory, itemId, qty = 1) {
  const index = inventory.findIndex((item) => item.id === itemId);
  if (index < 0 || qty <= 0) return false;
  inventory[index].qty -= qty;
  if (inventory[index].qty <= 0) inventory.splice(index, 1);
  return true;
}

function profileKey(identity) {
  if (identity && identity.userId) return `user:${identity.userId}`;
  return `guest:${identity && identity.name ? identity.name : "anónimo"}`;
}

export function createCityGame({
  maxPlayers = CITY_MAX_PLAYERS,
  now = Date.now,
  onChange = () => {},
  loadCollectibles = () => [],
  persistCollectible = () => {},
  walletOf = () => null,
  inventoryOf = () => [],
  persistProfile = () => {},
} = {}) {
  const clock = typeof now === "function" ? now : Date.now;
  const players = new Map();
  const profiles = new Map();
  const collectibles = new Map();

  for (const spot of CITY_COLLECTIBLES) {
    collectibles.set(spot.id, { ...spot, availableAt: 0, collectorId: null, collected: false });
  }
  for (const saved of loadCollectibles() || []) {
    const target = collectibles.get(saved.id);
    if (!target) continue;
    target.availableAt = Math.max(0, Math.round(Number(saved.availableAt) || 0));
    target.collectorId = saved.collectorId || null;
    target.collected = target.availableAt > clock();
  }

  function profileFor(identity) {
    const key = profileKey(identity);
    let profile = profiles.get(key);
    if (!profile) {
      profile = {
        key,
        userId: identity.userId || null,
        name: identity.name || "Pingüí",
        wallet: copyWallet(walletOf(identity) || { coins: CITY_START_COINS }),
        inventory: copyInventory(inventoryOf(identity) || []),
      };
      profiles.set(key, profile);
    }
    return profile;
  }

  // El id del actor se pasa explícitamente: dos invitados con el mismo nombre
  // comparten clave de perfil, pero cada uno debe actualizar solo su espejo
  // local. `activeId` se usa solo como reserva para acciones sin actor.
  function saveProfile(profile, actorId = null) {
    persistProfile(
      { id: actorId !== null ? actorId : profile.activeId, userId: profile.userId, name: profile.name },
      { wallet: { ...profile.wallet }, inventory: profile.inventory.map((item) => ({ ...item })) }
    );
  }

  function emit(event) {
    onChange(snapshot(), event || null);
  }

  function snapshot() {
    const timestamp = clock();
    return {
      modeId: "ciudad",
      mapId: CITY_MAP_ID,
      status: "open",
      phase: "living",
      maxPlayers,
      cellSize: 20,
      interestRange: 40,
      now: timestamp,
      players: [...players.values()].map((player) => ({
        id: player.id,
        name: player.name,
        x: player.x,
        z: player.z,
        cell: cityCellOf(player.x, player.z),
        coins: player.profile.wallet.coins,
        collected: player.profile.wallet.collected,
      })),
      collectibles: [...collectibles.values()].map((spot) => ({
        id: spot.id,
        name: spot.name,
        x: spot.x,
        z: spot.z,
        coins: spot.coins,
        item: spot.item,
        available: !spot.collected,
        availableAt: spot.availableAt,
        secondsLeft: spot.collected ? Math.max(0, Math.ceil((spot.availableAt - timestamp) / 1000)) : 0,
      })),
      catalog: CITY_ITEMS.map((item) => ({ ...item })),
    };
  }

  return {
    get status() {
      return "open";
    },
    get phase() {
      return "living";
    },

    join({ id, name, userId } = {}) {
      if (!id) return { ok: false, reason: "bad-position" };
      if (players.has(id)) return { ok: true };
      if (players.size >= maxPlayers) return { ok: false, reason: "full" };
      const identity = { id, name, userId };
      const profile = profileFor(identity);
      profile.activeId = id;
      profile.name = name || profile.name;
      const slot = players.size;
      const spawn = citySpawnFor(slot, maxPlayers);
      players.set(id, {
        id,
        name: name || profile.name,
        userId: userId || null,
        profile,
        x: spawn.x,
        z: spawn.z,
      });
      emit({ type: "join", playerId: id, name: name || profile.name });
      return { ok: true };
    },

    leave(id, { reason = "manual" } = {}) {
      const player = players.get(id);
      if (!player) return;
      players.delete(id);
      if (player.profile.activeId === id) player.profile.activeId = null;
      saveProfile(player.profile, id);
      emit({ type: "leave", playerId: id, reason });
    },

    canMove(id) {
      return players.has(id);
    },

    canRejoin({ userId, name } = {}) {
      if (userId && [...players.values()].some((p) => p.userId === userId)) return true;
      if (name && [...players.values()].some((p) => p.name === name && !p.userId)) return true;
      // Los perfiles guardados también cuentan: el servidor avisa al reconectar
      // aunque la sala esté vacía tras un reinicio.
      return profiles.has(profileKey({ userId, name }));
    },

    spawnFor(id) {
      const player = players.get(id);
      if (player) return { x: player.x, z: player.z, yaw: 0 };
      const spawn = citySpawnFor(players.size, maxPlayers);
      return { ...spawn };
    },

    // El servidor inyecta el perfil propio en el snapshot de cada jugador: el
    // resto del mundo solo ve monedas y recuento, nunca la mochila ajena.
    profileForId(id) {
      const player = players.get(id);
      if (!player) return null;
      return {
        wallet: { ...player.profile.wallet },
        inventory: player.profile.inventory.map((item) => ({ ...item })),
      };
    },

    action(id, payload = {}, position = {}) {
      const player = players.get(id);
      if (!player) return { ok: false, reason: "bad-position" };
      // El servidor manda su propia posición autoritativa: ignoramos cualquier
      // coordenada que llegue en el payload del cliente.
      const px = Number.isFinite(position.x) ? position.x : player.x;
      const pz = Number.isFinite(position.z) ? position.z : player.z;
      player.x = cityClamp(px);
      player.z = cityClamp(pz);

      const type = payload.type;
      const profile = player.profile;

      if (type === "collect") {
        const spot = collectibles.get(payload.id);
        if (!spot) return { ok: false, reason: "bad-item" };
        if (spot.collected) return { ok: false, reason: "already-collected" };
        if (Math.hypot(player.x - spot.x, player.z - spot.z) > CITY_INTERACT_RANGE) {
          return { ok: false, reason: "not-near" };
        }
        profile.wallet.coins += spot.coins;
        profile.wallet.earned += spot.coins;
        profile.wallet.collected += 1;
        const itemAdded = addToInventory(profile.inventory, spot.item, 1);
        spot.collected = true;
        spot.availableAt = clock() + CITY_RESPAWN_MS;
        spot.collectorId = id;
        persistCollectible({ id: spot.id, availableAt: spot.availableAt, collectorId: id });
        saveProfile(profile, id);
        emit({
          type: "collect",
          playerId: id,
          id: spot.id,
          name: spot.name,
          coins: spot.coins,
          item: spot.item,
          itemAdded,
          wallet: { ...profile.wallet },
          inventory: profile.inventory.map((item) => ({ ...item })),
        });
        return { ok: true };
      }

      if (type === "buy" || type === "sell") {
        const catalog = cityItemById(payload.itemId);
        if (!catalog) return { ok: false, reason: "bad-item" };
        const qty = Math.max(1, Math.min(10, Math.round(Number(payload.qty) || 1)));
        if (type === "buy") {
          const price = catalog.buy * qty;
          if (profile.wallet.coins < price) return { ok: false, reason: "not-enough-coins" };
          if (!addToInventory(profile.inventory, catalog.id, qty)) {
            return { ok: false, reason: "inventory-full" };
          }
          profile.wallet.coins -= price;
          profile.wallet.bought += qty;
        } else {
          if (!takeFromInventory(profile.inventory, catalog.id, qty)) {
            return { ok: false, reason: "no-item" };
          }
          const value = catalog.sell * qty;
          profile.wallet.coins += value;
          profile.wallet.sold += qty;
        }
        saveProfile(profile, id);
        emit({
          type,
          playerId: id,
          itemId: catalog.id,
          qty,
          wallet: { ...profile.wallet },
          inventory: profile.inventory.map((item) => ({ ...item })),
        });
        return { ok: true };
      }

      if (type === "emote") {
        const emote = String(payload.emote || "").slice(0, 24);
        if (!emote) return { ok: false, reason: "unknown-action" };
        emit({ type: "emote", playerId: id, emote });
        return { ok: true };
      }

      return { ok: false, reason: "unknown-action" };
    },

    tick() {
      const timestamp = clock();
      let changed = false;
      const respawns = [];
      for (const spot of collectibles.values()) {
        if (!spot.collected || timestamp < spot.availableAt) continue;
        spot.collected = false;
        spot.collectorId = null;
        spot.availableAt = 0;
        persistCollectible({ id: spot.id, availableAt: 0, collectorId: null });
        respawns.push(spot.id);
        changed = true;
      }
      if (changed) emit({ type: "respawn", ids: respawns });
    },

    snapshot,
    resultStats() {
      return null;
    },
  };
}
