// Controlador autoritativo de Karts (Bloque 1).
//
// Módulo puro: no toca Socket.IO ni DOM. El servidor inyecta el reloj y un
// `onChange` para difundir el estado a 20 Hz. El cliente SOLO envía intenciones
// (`throttle`, `steer`, `drift`); la física, la vuelta, la clasificación y los
// puntos los decide aquí. En el paddock (fase waiting) el jugador se mueve con
// `player:move` como en cualquier另一种 zona social; en carrera ese canal se
// bloquea y la posición sale del snapshot.
//
// El paddock y la pista viven en la misma sala y el mismo mapa: los portales
// cambian `trackId` y el servidor teletransporta a la parrilla. Así no hay que
// crear salasPor pista ni recargar la escena en mitad de una carrera.

import {
  KARTS_COUNTDOWN_MS,
  KARTS_LAPS,
  KARTS_MAP_ID,
  KARTS_MATCH_MS,
  KARTS_MAX_PLAYERS,
  KARTS_MIN_PLAYERS,
  KARTS_PADDOCK_SPAWN,
  KARTS_RESULT_MS,
  KARTS_SECTORS,
  KARTS_TICK_MS,
  KART_CATALOG,
  KART_START_ID,
  getTrack,
  isTrackPlayable,
  kartRacePoints,
  kartStats,
  kartsBoostAt,
  kartsObstacleHits,
  kartsPointAt,
  kartsSectorOf,
  kartsShortcutAt,
  kartsSpawnFor,
  kartsSurfaceAt,
} from "../../public/js/kartsDefs.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round2 = (value) => Math.round(value * 100) / 100;

function nameOf(player) {
  return String(player && player.name ? player.name : "Pingüino").slice(0, 20);
}

function stableKey(info = {}) {
  const name = nameOf(info).trim().toLowerCase();
  return Number.isFinite(Number(info.userId)) && info.userId ? `u:${info.userId}` : `n:${name}`;
}

export function createKartsGame({
  now = () => Date.now(),
  onChange = () => {},
  maxPlayers = KARTS_MAX_PLAYERS,
  minPlayers = KARTS_MIN_PLAYERS,
  laps = KARTS_LAPS,
  countdownMs = KARTS_COUNTDOWN_MS,
  resultMs = KARTS_RESULT_MS,
  matchMs = KARTS_MATCH_MS,
} = {}) {
  const capacity = Math.max(2, Math.min(KARTS_MAX_PLAYERS, Number(maxPlayers) || KARTS_MAX_PLAYERS));
  const minimum = Math.max(2, Math.min(capacity, Number(minPlayers) || KARTS_MIN_PLAYERS));
  const totalLaps = Math.max(1, Math.round(Number(laps) || KARTS_LAPS));
  const countdown = Math.max(500, Number(countdownMs) || KARTS_COUNTDOWN_MS);
  const results = Math.max(1000, Number(resultMs) || KARTS_RESULT_MS);
  const limit = Math.max(10000, Number(matchMs) || KARTS_MATCH_MS);

  const players = new Map();
  const order = [];
  const reservations = new Map();

  let phase = "waiting"; // waiting | countdown | racing | finished
  let round = 0;
  let trackId = "paddock";
  let countdownEndsAt = 0;
  let racingEndsAt = 0;
  let resultEndsAt = 0;
  let finishCount = 0;
  let winnerId = null;
  let lastEvent = null;
  let version = 0;

  function playerOf(id) {
    return players.get(id) || null;
  }

  function list() {
    return order.map((id) => players.get(id)).filter(Boolean);
  }

  function activePlayers() {
    return list().filter((p) => !p.offline);
  }

  function standings() {
    return list()
      .slice()
      .sort((a, b) => {
        if (a.finished && b.finished) return a.finishOrder - b.finishOrder;
        if (a.finished) return -1;
        if (b.finished) return 1;
        if (b.laps !== a.laps) return b.laps - a.laps;
        if (b.sectorsDone !== a.sectorsDone) return b.sectorsDone - a.sectorsDone;
        return b.distance - a.distance;
      });
  }

  function paddleSpawn(index, total) {
    const spread = Math.max(1, Math.min(total || 1, 8));
    const slot = ((index % spread) + spread) % spread;
    const angle = (slot / spread) * Math.PI * 2;
    return {
      x: round2(KARTS_PADDOCK_SPAWN.x + Math.cos(angle) * 6),
      y: 0,
      z: round2(KARTS_PADDOCK_SPAWN.z + Math.sin(angle) * 6),
      yaw: round2(KARTS_PADDOCK_SPAWN.yaw),
    };
  }

  function spawnFor(id) {
    const p = playerOf(id);
    const index = p ? p.order : 0;
    if (phase === "racing" || phase === "countdown") {
      return kartsSpawnFor(trackId, index, Math.max(players.size, minimum));
    }
    return paddleSpawn(index, players.size);
  }

  function snapshotPlayer(p) {
    const track = getTrack(trackId);
    let position;
    if (phase === "racing") {
      position = kartsPointAt(trackId, p.distance, p.lateral);
    } else if (phase === "countdown") {
      const spawn = kartsSpawnFor(trackId, p.order, Math.max(players.size, minimum));
      position = { ...spawn, ...kartsPointAt(trackId, spawn.distance, spawn.lateral) };
    } else {
      position = paddleSpawn(p.order, players.size);
    }
    return {
      id: p.id,
      name: p.name,
      ready: !!p.ready,
      offline: !!p.offline,
      kartId: p.kartId,
      points: p.points,
      owned: [...p.owned],
      trackId: p.trackId,
      laps: p.laps,
      sector: kartsSectorOf(p.t),
      sectorsDone: p.sectorsDone,
      t: round2(p.t),
      distance: round2(p.distance),
      x: round2(position.x),
      y: round2(position.y),
      z: round2(position.z),
      yaw: round2(position.yaw),
      bank: round2(position.bank || 0),
      pitch: round2(position.pitch || 0),
      speed: round2(p.speed),
      boosting: now() < p.boostUntil,
      finished: !!p.finished,
      finishOrder: p.finishOrder,
      position: p.position || 0,
    };
  }

  function snapshot() {
    const t = now();
    const track = getTrack(trackId);
    return {
      modeId: "karts",
      mapId: KARTS_MAP_ID,
      status: phase,
      phase,
      round,
      trackId,
      trackName: track ? track.name : "",
      trackLength: track ? track.length : 0,
      laps: totalLaps,
      maxPlayers: capacity,
      minPlayers: minimum,
      tickMs: KARTS_TICK_MS,
      countdownMs: phase === "countdown" ? Math.max(0, countdownEndsAt - t) : 0,
      remainingMs: phase === "racing" ? Math.max(0, racingEndsAt - t) : 0,
      resultMs: phase === "finished" ? Math.max(0, resultEndsAt - t) : 0,
      catalog: KART_CATALOG.map((kart) => ({
        id: kart.id,
        name: kart.name,
        price: kart.price,
        color: kart.color,
      })),
      players: list().map(snapshotPlayer),
      standings: standings().map((p) => ({ id: p.id, name: p.name, laps: p.laps, finishOrder: p.finishOrder })),
      winner: winnerId ? { id: winnerId, name: (playerOf(winnerId) || {}).name } : null,
      lastEvent: lastEvent ? { ...lastEvent } : null,
      version,
    };
  }

  function bump(event) {
    version += 1;
    if (event) lastEvent = { ...event, at: now() };
    onChange(snapshot(), event || null);
  }

  function resetRace() {
    countdownEndsAt = 0;
    racingEndsAt = 0;
    resultEndsAt = 0;
    finishCount = 0;
    winnerId = null;
    for (const p of players.values()) {
      p.ready = false;
      p.finished = false;
      p.finishOrder = 0;
      p.finishAt = 0;
      p.position = 0;
      p.laps = 0;
      p.sectorsDone = 0;
      p.nextSector = 1;
      p.distance = 0;
      p.lateral = 0;
      p.t = 0;
      p.speed = 0;
      p.boostUntil = 0;
      p.boostReadyAt = 0;
      p.obstacleCooldownUntil = 0;
      p.kartCooldownUntil = 0;
      p.input = { throttle: 0, steer: 0, drift: false };
    }
  }

  function dropPlayer(id, reason, t = now()) {
    const p = playerOf(id);
    if (!p) return false;
    players.delete(id);
    const at = order.indexOf(id);
    if (at >= 0) order.splice(at, 1);
    reservations.delete(p.key);
    if (!players.size) {
      phase = "waiting";
      resetRace();
    } else if (phase === "racing") {
      checkRaceEnd(t);
    }
    bump({ type: "leave", playerId: id, name: p.name, reason });
    return true;
  }

  function join(info = {}) {
    const id = info.id;
    if (!id) return { ok: false, reason: "bad-player" };
    const name = nameOf(info);
    const key = stableKey({ ...info, name });
    const t = now();

    if (players.has(id)) {
      const existing = players.get(id);
      existing.name = name;
      bump({ type: "join", playerId: id, name });
      return { ok: true };
    }
    if (phase === "countdown" || phase === "racing") {
      const reservation = reservations.get(key);
      if (reservation && reservation.until > t) {
        const previous = playerOf(reservation.id);
        if (!previous || !previous.offline) return { ok: false, reason: "in-progress" };
        players.delete(previous.id);
        const at = order.indexOf(previous.id);
        if (at >= 0) order[at] = id;
        previous.id = id;
        previous.name = name;
        previous.offline = false;
        previous.disconnectUntil = 0;
        players.set(id, previous);
        reservations.set(key, { ...reservation, id, name });
        bump({ type: "rejoin", playerId: id, name });
        return { ok: true, rejoin: true };
      }
      return { ok: false, reason: "in-progress" };
    }
    if (players.size >= capacity) return { ok: false, reason: "full" };

    const owned = Array.isArray(info.owned) ? info.owned.filter((kartId) => !!kartByIdLocal(kartId)) : [];
    if (!owned.includes(KART_START_ID)) owned.unshift(KART_START_ID);
    const p = {
      id,
      key,
      name,
      userId: Number.isFinite(Number(info.userId)) && info.userId ? Number(info.userId) : null,
      order: order.length,
      ready: false,
      offline: false,
      disconnectUntil: 0,
      points: Math.max(0, Math.round(Number(info.points) || 0)),
      owned,
      kartId: kartByIdLocal(info.equipped) && owned.includes(info.equipped) ? info.equipped : KART_START_ID,
      trackId: "paddock",
      laps: 0,
      sectorsDone: 0,
      nextSector: 1,
      distance: 0,
      lateral: 0,
      t: 0,
      speed: 0,
      boostUntil: 0,
      boostReadyAt: 0,
      obstacleCooldownUntil: 0,
      kartCooldownUntil: 0,
      finished: false,
      finishOrder: 0,
      finishAt: 0,
      position: 0,
      lastEarned: 0,
      input: { throttle: 0, steer: 0, drift: false },
      lastInputAt: t,
      lastTickAt: t,
    };
    players.set(id, p);
    order.push(id);
    bump({ type: "join", playerId: id, name });
    return { ok: true };
  }

  function kartByIdLocal(id) {
    return KART_CATALOG.some((kart) => kart.id === id);
  }

  function leave(id, options = {}) {
    const reason = options && options.reason ? options.reason : "manual";
    const p = playerOf(id);
    if (!p) return { ok: false, reason: "not-in-game" };
    if (reason === "disconnect" && (phase === "racing" || phase === "countdown")) {
      p.offline = true;
      p.disconnectUntil = now() + 45000;
      reservations.set(p.key, { id, until: p.disconnectUntil, name: p.name });
      bump({ type: "disconnect", playerId: id, name: p.name });
      return { ok: true, offline: true };
    }
    return { ok: dropPlayer(id, reason) };
  }

  function canStart() {
    if (activePlayers().length < minimum) return false;
    return order.every((id) => {
      const p = players.get(id);
      return p && (p.ready || p.offline) && isTrackPlayable(p.trackId);
    });
  }

  function start(t) {
    round += 1;
    phase = "countdown";
    countdownEndsAt = t + countdown;
    racingEndsAt = 0;
    resultEndsAt = 0;
    // La pista elegida por el primero que pulsó «Listo» manda; el resto corre
    // en el mismo circuito para que la clasificación sea comparable.
    const chosen = list().find((p) => isTrackPlayable(p.trackId));
    trackId = chosen ? chosen.trackId : "paddock";
    resetRace();
    for (const p of list()) {
      p.ready = true;
      p.offline = false;
      p.disconnectUntil = 0;
    }
    bump({ type: "countdown", round, trackId, ms: countdown });
  }

  function startRacing(t) {
    phase = "racing";
    racingEndsAt = t + limit;
    countdownEndsAt = 0;
    for (const p of list()) {
      const spawn = kartsSpawnFor(trackId, p.order, Math.max(players.size, minimum));
      p.distance = spawn.distance;
      p.lateral = spawn.lateral;
      p.t = kartsPointAt(trackId, spawn.distance, spawn.lateral).t;
      p.speed = 0;
      p.nextSector = 1;
      p.lastTickAt = t;
    }
    bump({ type: "start", round, trackId, endsAt: racingEndsAt });
  }

  function finishRace(t) {
    if (phase !== "racing") return;
    phase = "finished";
    racingEndsAt = 0;
    resultEndsAt = t + results;
    const ranked = standings();
    let points = 0;
    for (const p of ranked) {
      points += 1;
      p.position = points;
      p.lastEarned = kartRacePoints(points, p.laps, trackId);
      p.points = Math.max(0, p.points) + p.lastEarned;
      if (!winnerId) winnerId = p.id;
    }
    bump({
      type: "result",
      round,
      trackId,
      winnerId,
      winner: winnerId ? (playerOf(winnerId) || {}).name : null,
      rankings: ranked.map((p) => ({ id: p.id, position: p.position, points: p.points })),
    });
  }

  function checkRaceEnd(t) {
    if (phase !== "racing") return;
    if (activePlayers().length && activePlayers().every((p) => p.finished)) finishRace(t);
  }

  function action(id, payload = {}, ctx = {}) {
    const p = playerOf(id);
    if (!p || p.offline) return { ok: false, reason: "not-in-game" };
    const type = payload && payload.type;
    const t = now();

    if (type === "ready") {
      if (phase !== "waiting" && phase !== "finished") return { ok: false, reason: "wrong-phase" };
      p.ready = !p.ready;
      bump({ type: "ready", playerId: id, ready: p.ready });
      return { ok: true, ready: p.ready };
    }

    if (type === "track") {
      if (phase !== "waiting" && phase !== "finished") return { ok: false, reason: "wrong-phase" };
      const chosen = String(payload.trackId || "");
      if (!isTrackPlayable(chosen)) return { ok: false, reason: "in-preparation" };
      p.trackId = chosen;
      p.ready = true;
      bump({ type: "track", playerId: id, trackId: chosen });
      return { ok: true, trackId: chosen };
    }

    if (type === "buy") {
      const kartId = String(payload.kartId || "");
      const kart = KART_CATALOG.find((item) => item.id === kartId);
      if (!kart) return { ok: false, reason: "bad-kart" };
      if (p.owned.includes(kartId)) return { ok: false, reason: "already-owned" };
      if (p.points < kart.price) return { ok: false, reason: "not-enough-points" };
      p.points -= kart.price;
      p.owned.push(kartId);
      bump({ type: "purchase", playerId: id, kartId, points: p.points, price: kart.price });
      return { ok: true, points: p.points };
    }

    if (type === "equip") {
      const kartId = String(payload.kartId || "");
      if (!p.owned.includes(kartId)) return { ok: false, reason: "not-owned" };
      p.kartId = kartId;
      bump({ type: "equip", playerId: id, kartId });
      return { ok: true, kartId };
    }

    if (type === "drive") {
      if (phase !== "racing" || p.finished) return { ok: false, reason: "wrong-phase" };
      p.input = {
        throttle: clamp(Number(payload.throttle) || 0, -1, 1),
        steer: clamp(Number(payload.steer) || 0, -1, 1),
        drift: !!payload.drift,
      };
      p.lastInputAt = t;
      return { ok: true };
    }

    // Posición del paddock: se usa para detectar el pedestal y el portal
    // cercanos sin confiar en un id elegido por el cliente.
    if (type === "pedestal" || type === "portal") {
      if (phase !== "waiting" && phase !== "finished") return { ok: false, reason: "wrong-phase" };
      const x = Number(payload.x !== undefined ? payload.x : ctx.x);
      const z = Number(payload.z !== undefined ? payload.z : ctx.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return { ok: false, reason: "bad-position" };
      return { ok: true, x, z };
    }

    return { ok: false, reason: "unknown-action" };
  }

  function integrate(p, t) {
    const track = getTrack(trackId);
    if (!track) return;
    const dt = clamp((t - p.lastTickAt) / 1000, 0, 0.1);
    p.lastTickAt = t;
    if (dt <= 0) return;

    const cfg = kartStats(p.kartId);
    const idle = t - p.lastInputAt > 2000;
    const throttle = idle ? 0 : p.input.throttle;
    const steer = idle ? 0 : p.input.steer;
    const surface = kartsSurfaceAt(trackId, p.t);
    const boosting = t < p.boostUntil;
    const maxSpeed = cfg.speed * surface.grip * (boosting ? 1.45 : 1) * (p.input.drift ? 0.97 : 1);
    const current = kartsPointAt(trackId, p.distance, p.lateral);

    if (throttle > 0) p.speed += cfg.acceleration * throttle * dt;
    else if (throttle < 0) p.speed += cfg.acceleration * 1.6 * throttle * dt;
    p.speed -= p.speed * 0.32 * dt;
    // Desnivel real: cuesta arriba frena, cuesta abajo empuja. La y y el
    // peralte ya salían del snapshot; ahora la pendiente también afecta al
    // comportamiento del kart.
    p.speed -= Math.sin(current.pitch || 0) * 4.5 * dt;
    p.speed = clamp(p.speed, -6, maxSpeed);
    if (Math.abs(p.speed) < 0.04) p.speed = 0;

    const before = p.distance;
    p.distance += p.speed * dt;
    const shortcut = kartsShortcutAt(trackId, p.t, p.lateral);
    if (shortcut && p.speed > 0) p.distance += p.speed * dt * (shortcut.gain - 1);

    const grip = surface.grip * (p.input.drift ? 0.72 : 1);
    p.lateral += steer * cfg.handling * grip * dt * (0.35 + Math.min(1, Math.abs(p.speed) / cfg.speed));
    p.lateral -= p.lateral * 1.4 * dt;
    const half = track.width / 2 - 1.2;
    let offTrack = false;
    if (Math.abs(p.lateral) > half) {
      p.lateral = Math.sign(p.lateral) * half;
      p.speed *= 0.85;
      offTrack = true;
    }

    // Obstáculos rígidos: frenazo, desplazamiento lateral hacia el hueco libre
    // y evento para el HUD. El enfriamiento evita repetir el golpe cada tick.
    const hit = kartsObstacleHits(trackId, p.distance, p.lateral);
    if (hit) {
      const offset = p.lateral - hit.lateral;
      const pushSide = Math.abs(offset) < 0.05 ? (p.order % 2 ? 1 : -1) : Math.sign(offset);
      p.lateral = clamp(hit.lateral + pushSide * (hit.radius + 1.15), -half, half);
      if (t >= p.obstacleCooldownUntil) {
        p.speed *= 0.42;
        p.obstacleCooldownUntil = t + 700;
        bump({ type: "obstacle", playerId: p.id, obstacleId: hit.id, trackId });
      }
    }

    const point = kartsPointAt(trackId, p.distance, p.lateral);
    p.t = point.t;
    p.distance = ((p.distance % track.length) + track.length) % track.length;

    if (kartsBoostAt(trackId, p.t) && throttle > 0 && t >= p.boostReadyAt) {
      p.boostUntil = t + 1200;
      p.boostReadyAt = t + 5000;
      bump({ type: "boost", playerId: p.id, trackId });
    }

    // Checkpoints en orden: un atajo puede acortar metros, pero no saltarse
    // sectores. Solo el sector esperado hace avanzar la vuelta.
    const sector = kartsSectorOf(p.t);
    if (sector === p.nextSector) {
      p.nextSector = (sector + 1) % KARTS_SECTORS;
      p.sectorsDone += 1;
      if (p.nextSector === 0) {
        p.laps += 1;
        bump({ type: "lap", playerId: p.id, laps: p.laps, trackId });
        if (p.laps >= totalLaps) {
          p.finished = true;
          p.finishOrder = ++finishCount;
          p.finishAt = t;
          p.speed = 0;
          bump({ type: "finish", playerId: p.id, position: p.finishOrder, trackId });
          return;
        }
      }
    }

    if (offTrack && Math.floor(before / 10) !== Math.floor(p.distance / 10)) {
      // Evento cosmético con cadencia baja: el HUD avisa de la hierba/grava.
      bump({ type: "offtrack", playerId: p.id, surface: surface.type });
    }
  }

  // Contacto entre karts en coordenadas de pista: separa lateralmente y quita un
  // poco de velocidad a ambos. Es autoritativo, igual que el resto de la física.
  function resolveKartCollisions(t) {
    const track = getTrack(trackId);
    if (!track) return;
    const active = list().filter((p) => !p.offline && !p.finished);
    const half = track.width / 2 - 1.2;
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        let delta = Math.abs(a.distance - b.distance);
        delta = Math.min(delta, track.length - delta);
        const lateralDelta = a.lateral - b.lateral;
        if (delta >= 2.8 || Math.abs(lateralDelta) >= 2) continue;
        const sign = Math.abs(lateralDelta) < 0.05 ? (a.order % 2 ? 1 : -1) : Math.sign(lateralDelta);
        const push = (2 - Math.abs(lateralDelta)) / 2 + 0.05;
        a.lateral = clamp(a.lateral + sign * push, -half, half);
        b.lateral = clamp(b.lateral - sign * push, -half, half);
        a.speed *= 0.94;
        b.speed *= 0.94;
        if (t >= a.kartCooldownUntil) {
          a.kartCooldownUntil = t + 600;
          bump({ type: "kart-hit", playerId: a.id, otherId: b.id, trackId });
        }
        if (t >= b.kartCooldownUntil) {
          b.kartCooldownUntil = t + 600;
          bump({ type: "kart-hit", playerId: b.id, otherId: a.id, trackId });
        }
      }
    }
  }

  function tick(t = now()) {
    expireReservations(t);
    if (phase === "waiting") {
      if (!canStart()) return false;
      start(t);
      return true;
    }
    if (phase === "countdown" && t >= countdownEndsAt) {
      startRacing(t);
      return true;
    }
    if (phase === "racing") {
      const beforeVersion = version;
      for (const p of list()) {
        if (p.offline || p.finished) continue;
        integrate(p, t);
      }
      resolveKartCollisions(t);
      const ranked = standings();
      ranked.forEach((p, index) => {
        p.position = index + 1;
      });
      if (t >= racingEndsAt) finishRace(t);
      else checkRaceEnd(t);
      // Un snapshot por tick aunque no haya habido vuelta ni turbo: es la
      // posición autoritativa que interpola el cliente a 20 Hz.
      if (version === beforeVersion && phase === "racing") onChange(snapshot(), null);
      return true;
    }
    if (phase === "finished" && resultEndsAt && t >= resultEndsAt) {
      phase = "waiting";
      resetRace();
      bump({ type: "restart", round });
      return true;
    }
    return false;
  }

  function expireReservations(t) {
    for (const p of list()) {
      if (p.offline && p.disconnectUntil && t >= p.disconnectUntil) dropPlayer(p.id, "expired", t);
    }
  }

  function resultStats() {
    const ranked = standings();
    return {
      modeId: "karts",
      trackId,
      round,
      winner: winnerId,
      reason: "race",
      laps: totalLaps,
      winners: winnerId ? [playerOf(winnerId)].filter(Boolean) : [],
      participants: ranked.map((p) => ({
        id: p.id,
        name: p.name,
        userId: p.userId,
        kartId: p.kartId,
        position: p.position || ranked.indexOf(p) + 1,
        laps: p.laps,
        points: p.points,
        earned: p.lastEarned || 0,
      })),
    };
  }

  return {
    join,
    leave,
    action,
    tick,
    snapshot,
    spawnFor,
    resultStats,
    canMove: (id) => {
      if (phase === "racing") return false;
      const p = playerOf(id);
      return !!p && !p.offline;
    },
    isEliminated: () => false,
    canRejoin: (info = {}) => {
      if (phase !== "racing" && phase !== "countdown") return false;
      const reservation = reservations.get(stableKey(info));
      if (!reservation || reservation.until <= now()) return false;
      const previous = playerOf(reservation.id);
      return !!previous && !!previous.offline;
    },
    get status() {
      return phase;
    },
    get phase() {
      return phase;
    },
    get trackId() {
      return trackId;
    },
    get size() {
      return players.size;
    },
    get capacity() {
      return capacity;
    },
  };
}
