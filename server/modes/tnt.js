// Controlador autoritativo de TNT Run (Ola 3).
//
// Módulo puro: no toca Socket.IO ni el DOM. El servidor inyecta `onChange` para
// difundir el estado y un reloj inyectable para que las pruebas sean
// deterministas. El bloque pisado SIEMPRE se deriva de la posición autoritativa
// que ya validó `player:move`; el cliente solo envía intenciones de movimiento.
//
// La rejilla completa son 5 capas × 16 × 16 = 1280 bloques. El estado se guarda
// como un Set de bloques caídos y un Map de mechas pendientes, no como 1280
// objetos sueltos. Los eventos de mecha/caída alimentan la animación y el sonido
// del cliente; el snapshot periódico lleva el estado completo para reconciliar.

import {
  TNT_COUNTDOWN_MS,
  TNT_FUSE_MS,
  TNT_GRID,
  TNT_LAYERS,
  TNT_MAP_ID,
  TNT_MATCH_MS,
  TNT_MAX_BLOCKS_PER_SEC,
  TNT_MAX_PLAYERS,
  TNT_MIN_PLAYERS,
  TNT_RECONNECT_GRACE_MS,
  TNT_RESULT_MS,
  TNT_TICK_MS,
  tntAdjacent,
  tntCellCenter,
  tntCellFromPosition,
  tntGlobalIndex,
  tntLayerHeight,
  tntRank,
  tntSameCell,
  tntSpawnFor,
  tntWinnerByHeight,
} from "../../public/js/tntDefs.js";

function nameOf(player) {
  return String(player && player.name ? player.name : "Pingüino").slice(0, 20);
}

function stableKey(info = {}) {
  const name = nameOf(info).trim().toLowerCase();
  return Number.isFinite(Number(info.userId)) && info.userId
    ? `u:${info.userId}`
    : `n:${name}`;
}

export function createTntGame({
  now = () => Date.now(),
  onChange = () => {},
  maxPlayers = TNT_MAX_PLAYERS,
  minPlayers = TNT_MIN_PLAYERS,
  fuseMs = TNT_FUSE_MS,
  matchMs = TNT_MATCH_MS,
  countdownMs = TNT_COUNTDOWN_MS,
  resultMs = TNT_RESULT_MS,
  reconnectMs = TNT_RECONNECT_GRACE_MS,
  maxBlocksPerSec = TNT_MAX_BLOCKS_PER_SEC,
} = {}) {
  const capacity = Math.max(TNT_MAX_PLAYERS, Number(maxPlayers) || 0);
  const minimum = Math.max(2, Math.min(TNT_MIN_PLAYERS, Number(minPlayers) || TNT_MIN_PLAYERS));
  const fuse = Math.max(100, Number(fuseMs) || TNT_FUSE_MS);
  const limitBlocks = Math.max(1, Number(maxBlocksPerSec) || TNT_MAX_BLOCKS_PER_SEC);

  const players = new Map();
  const order = [];
  const reservations = new Map();
  // Una mecha es { bloque -> instante en que cae }. Caído es un Set de índices
  // globales layer*256 + row*16 + col.
  const pending = new Map();
  const fallen = new Set();

  let phase = "waiting"; // waiting | countdown | playing | result
  let round = 0;
  let countdownEndsAt = 0;
  let playingEndsAt = 0;
  let resultEndsAt = 0;
  let winnerId = null;
  let winnerReason = null;
  let lastEvent = null;
  let version = 0;

  function playerOf(id) {
    return players.get(id) || null;
  }

  function list() {
    return order.map((id) => players.get(id)).filter(Boolean);
  }

  function activePlayers() {
    return list().filter((p) => !p.eliminated && !p.offline);
  }

  function canStart() {
    if (players.size < minimum) return false;
    return order.every((id) => {
      const p = players.get(id);
      return p && p.ready && !p.offline;
    });
  }

  function spawnFor(id) {
    const p = playerOf(id);
    return tntSpawnFor(p ? p.order : 0, Math.max(1, order.length));
  }

  function snapshotPlayer(p, t) {
    const spawn = spawnFor(p.id);
    return {
      id: p.id,
      name: p.name,
      ready: !!p.ready,
      offline: !!p.offline,
      eliminated: !!p.eliminated,
      layer: p.layer,
      y: tntLayerHeight(p.layer),
      blocks: p.blocks,
      cell: { row: p.cell.row, col: p.cell.col },
      spawn,
    };
  }

  function snapshot() {
    const t = now();
    const winner = winnerId ? playerOf(winnerId) : null;
    return {
      modeId: "tnt",
      mapId: TNT_MAP_ID,
      status: phase,
      phase,
      round,
      maxPlayers: capacity,
      minPlayers: minimum,
      tickMs: TNT_TICK_MS,
      fuseMs: fuse,
      countdownMs: phase === "countdown" ? Math.max(0, countdownEndsAt - t) : 0,
      remainingMs: phase === "playing" ? Math.max(0, playingEndsAt - t) : 0,
      resultMs: phase === "result" ? Math.max(0, resultEndsAt - t) : 0,
      alive: activePlayers().map((p) => p.id),
      eliminated: list().filter((p) => p.eliminated).map((p) => p.id),
      pending: [...pending.entries()].map(([index, at]) => ({
        index,
        ms: Math.max(0, at - t),
      })),
      fallen: [...fallen],
      players: list().map((p) => snapshotPlayer(p, t)),
      winner: winner
        ? { id: winner.id, name: winner.name, reason: winnerReason }
        : null,
      lastEvent: lastEvent ? { ...lastEvent } : null,
      version,
    };
  }

  function bump(event) {
    version += 1;
    if (event) lastEvent = { ...event, at: now() };
    onChange(snapshot(), event || null);
  }

  function ignite(p, cell, t) {
    const index = tntGlobalIndex(p.layer, cell.row, cell.col);
    if (index < 0 || fallen.has(index) || pending.has(index)) return false;
    pending.set(index, t + fuse);
    bump({ type: "fuse", playerId: p.id, index, layer: p.layer, ms: fuse });
    return true;
  }

  function emitFall(p, fromLayer, toLayer, eliminated) {
    const center = tntCellCenter(p.cell.row, p.cell.col);
    bump({
      type: "playerFall",
      playerId: p.id,
      fromLayer,
      toLayer,
      x: center.x,
      z: center.z,
      y: tntLayerHeight(toLayer === null ? fromLayer : toLayer),
      eliminated,
    });
  }

  // Un jugador sin soporte baja una capa si el bloque inferior sigue firme; si
  // no hay bloque inferior, queda eliminado. Nunca se queda flotando.
  function drop(p, t) {
    if (!p || p.eliminated || p.offline) return false;
    const fromLayer = p.layer;
    const below = fromLayer - 1;
    const belowIndex = below >= 0 ? tntGlobalIndex(below, p.cell.row, p.cell.col) : -1;
    if (belowIndex >= 0 && !fallen.has(belowIndex)) {
      p.layer = below;
      ignite(p, p.cell, t);
      emitFall(p, fromLayer, below, false);
      return false;
    }
    p.eliminated = true;
    emitFall(p, fromLayer, null, true);
    return true;
  }

  function checkVictory(t) {
    if (phase !== "playing") return false;
    const alive = activePlayers();
    if (alive.length > 1) return false;
    const winner = alive.length === 1 ? alive[0] : tntWinnerByHeight(list());
    if (winner && !winner.eliminated) end(t, winner, "last-standing");
    else end(t, null, "draw");
    return true;
  }

  function resolveFuses(t) {
    const landed = [];
    for (const [index, at] of pending) {
      if (t < at) continue;
      pending.delete(index);
      fallen.add(index);
      landed.push(index);
    }
    if (!landed.length) return false;

    bump({ type: "blockFall", indices: landed });
    // Después de cada desplome hay que revisar quién se ha quedado sin suelo:
    // el bloque que acaba de caer puede estar justo bajo un jugador inmóvil.
    for (const p of list()) {
      if (p.eliminated || p.offline) continue;
      const index = tntGlobalIndex(p.layer, p.cell.row, p.cell.col);
      if (index >= 0 && fallen.has(index)) drop(p, t);
    }
    checkVictory(t);
    return true;
  }

  function start(t) {
    round += 1;
    phase = "countdown";
    countdownEndsAt = t + countdownMs;
    playingEndsAt = 0;
    resultEndsAt = 0;
    winnerId = null;
    winnerReason = null;
    pending.clear();
    fallen.clear();
    reservations.clear();
    list().forEach((p, i) => {
      const spawn = tntSpawnFor(i, order.length);
      p.ready = true;
      p.offline = false;
      p.eliminated = false;
      p.disconnectUntil = 0;
      p.layer = spawn.layer;
      p.cell = { row: spawn.row, col: spawn.col };
      p.blocks = 0;
      p.blockTimes = [];
    });
    bump({ type: "countdown", round, ms: countdownMs });
  }

  function startPlaying(t) {
    phase = "playing";
    playingEndsAt = t + matchMs;
    countdownEndsAt = 0;
    bump({ type: "start", round, endsAt: playingEndsAt });
    // La celda de salida también cuenta como pisada: aunque nadie se moviese,
    // el suelo bajo sus pies acabaría cayendo igualmente.
    for (const p of activePlayers()) ignite(p, p.cell, t);
  }

  function end(t, winner, reason) {
    if (winnerId || phase === "result") return;
    winnerId = winner ? winner.id : null;
    winnerReason = reason;
    phase = "result";
    countdownEndsAt = 0;
    playingEndsAt = 0;
    resultEndsAt = t + resultMs;
    bump({
      type: "result",
      winnerId,
      winner: winner ? winner.name : null,
      reason,
    });
  }

  function resetMatch() {
    phase = "waiting";
    countdownEndsAt = 0;
    playingEndsAt = 0;
    resultEndsAt = 0;
    winnerId = null;
    winnerReason = null;
    pending.clear();
    fallen.clear();
    reservations.clear();
    for (const p of players.values()) {
      p.ready = false;
      p.offline = false;
      p.eliminated = false;
      p.disconnectUntil = 0;
      p.blocks = 0;
      p.blockTimes = [];
    }
  }

  function dropPlayer(id, reason, t = now()) {
    const p = playerOf(id);
    if (!p) return false;
    players.delete(id);
    const at = order.indexOf(id);
    if (at >= 0) order.splice(at, 1);
    reservations.delete(p.key);
    if (!players.size) resetMatch();
    else if (phase === "playing") checkVictory(t);
    bump({ type: "leave", playerId: id, name: p.name, reason });
    return true;
  }

  function expireReservations(t) {
    for (const p of list()) {
      if (p.offline && p.disconnectUntil && t >= p.disconnectUntil) {
        dropPlayer(p.id, "expired", t);
      }
    }
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

    // Reconexión durante la partida: se conservan capa, celda y bloques
    // destruidos durante 45 s para que un corte de red no elimine al jugador.
    if (phase === "playing") {
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

    if (phase === "countdown") return { ok: false, reason: "in-progress" };
    if (players.size >= capacity) return { ok: false, reason: "full" };

    const p = {
      id,
      key,
      name,
      userId: Number.isFinite(Number(info.userId)) && info.userId ? Number(info.userId) : null,
      order: order.length,
      ready: false,
      offline: false,
      eliminated: false,
      disconnectUntil: 0,
      layer: TNT_LAYERS - 1,
      cell: { row: 0, col: 0 },
      blocks: 0,
      blockTimes: [],
    };
    const spawn = spawnFor(id);
    p.cell = { row: spawn.row, col: spawn.col };
    players.set(id, p);
    order.push(id);
    bump({ type: "join", playerId: id, name });
    return { ok: true };
  }

  function leave(id, options = {}) {
    const reason = options && options.reason ? options.reason : "manual";
    const p = playerOf(id);
    if (!p) return { ok: false, reason: "not-in-game" };

    if (reason === "disconnect" && phase === "playing") {
      p.offline = true;
      p.disconnectUntil = now() + reconnectMs;
      reservations.set(p.key, { id, until: p.disconnectUntil, name: p.name });
      bump({ type: "disconnect", playerId: id, name: p.name });
      return { ok: true, offline: true };
    }
    return { ok: dropPlayer(id, reason) };
  }

  function action(id, payload = {}, ctx = {}) {
    const p = playerOf(id);
    if (!p || p.offline) return { ok: false, reason: "not-in-game" };
    const t = now();

    if (payload.type === "ready") {
      if (phase !== "waiting" && phase !== "result") return { ok: false, reason: "not-waiting" };
      p.ready = !p.ready;
      bump({ type: "ready", playerId: id, ready: p.ready });
      return { ok: true, ready: p.ready };
    }

    if (payload.type === "move") {
      const x = Number(payload.x !== undefined ? payload.x : ctx.x);
      const z = Number(payload.z !== undefined ? payload.z : ctx.z);
      return move(id, x, z);
    }

    return { ok: false, reason: "unknown-action" };
  }

  // Deriva la celda pisada de (x,z), valida adyacencia y cadencia, enciende la
  // mecha del bloque y devuelve la posición corregida que debe adoptar el
  // servidor. Nunca confía en una altura ni en un índice enviado por el cliente.
  function move(id, x, z) {
    const p = playerOf(id);
    if (!p || p.offline || p.eliminated) return { ok: false, reason: "eliminated" };
    if (phase !== "playing") return { ok: false, reason: "wrong-phase" };
    const t = now();
    const centerOf = () => tntCellCenter(p.cell.row, p.cell.col);
    const corrected = (reason) => {
      const center = centerOf();
      return {
        ok: false,
        reason,
        x: center.x,
        z: center.z,
        y: tntLayerHeight(p.layer),
        layer: p.layer,
        cell: { ...p.cell },
        eliminated: false,
      };
    };

    const target = tntCellFromPosition(x, z);
    if (!target) {
      drop(p, t);
      checkVictory(t);
      const center = centerOf();
      return {
        ok: true,
        x: center.x,
        z: center.z,
        y: tntLayerHeight(p.layer),
        layer: p.layer,
        cell: { ...p.cell },
        eliminated: p.eliminated,
        fell: true,
      };
    }

    if (tntSameCell(target, p.cell)) {
      return {
        ok: true,
        x,
        z,
        y: tntLayerHeight(p.layer),
        layer: p.layer,
        cell: { ...p.cell },
        eliminated: false,
      };
    }
    if (!tntAdjacent(target, p.cell)) return corrected("not-adjacent");

    p.blockTimes = p.blockTimes.filter((ts) => t - ts < 1000);
    if (p.blockTimes.length >= limitBlocks) return corrected("too-fast");

    p.cell = target;
    p.blockTimes.push(t);
    p.blocks += 1;
    const index = tntGlobalIndex(p.layer, target.row, target.col);
    let fell = false;
    if (index < 0 || fallen.has(index)) {
      fell = drop(p, t);
    } else {
      ignite(p, target, t);
    }
    resolveFuses(t);
    checkVictory(t);

    return {
      ok: true,
      x,
      z,
      y: tntLayerHeight(p.layer),
      layer: p.layer,
      cell: { ...p.cell },
      eliminated: p.eliminated,
      fell,
      blockIndex: index,
    };
  }

  function tick(t = now()) {
    expireReservations(t);

    if (phase === "waiting") {
      if (!canStart()) return false;
      start(t);
      return true;
    }
    if (phase === "countdown" && t >= countdownEndsAt) {
      startPlaying(t);
      return true;
    }
    if (phase === "playing") {
      let changed = resolveFuses(t);
      if (phase === "playing" && t >= playingEndsAt) {
        const ranked = tntRank(list());
        end(t, ranked.length ? playerOf(ranked[0].id) : null, "time");
        changed = true;
      }
      return changed;
    }
    if (phase === "result" && resultEndsAt && t >= resultEndsAt) {
      resetMatch();
      bump({ type: "restart" });
      return true;
    }
    return false;
  }

  function resultStats() {
    const winner = winnerId ? playerOf(winnerId) : null;
    const entry = (p) => ({
      id: p.id,
      name: p.name,
      userId: p.userId,
      blocks: p.blocks || 0,
      eliminated: !!p.eliminated,
    });
    const blocks = {};
    for (const p of list()) blocks[p.id] = p.blocks || 0;
    return {
      modeId: "tnt",
      winner: winnerId,
      reason: winnerReason,
      round,
      winners: winner ? [entry(winner)] : [],
      participants: list().map(entry),
      blocks,
    };
  }

  return {
    join,
    leave,
    action,
    move,
    tick,
    snapshot,
    spawnFor,
    resultStats,
    canMove: (id) => {
      const p = playerOf(id);
      return phase === "playing" && !!p && !p.eliminated && !p.offline;
    },
    isEliminated: (id) => {
      const p = playerOf(id);
      return !!p && !!p.eliminated;
    },
    layerOf: (id) => {
      const p = playerOf(id);
      return p ? p.layer : null;
    },
    canRejoin: (info = {}) => {
      if (phase !== "playing") return false;
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
    get size() {
      return players.size;
    },
    get capacity() {
      return capacity;
    },
  };
}
