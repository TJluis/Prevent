// Controlador autoritativo del Escondite (Ola 2).
//
// Módulo puro: no toca Socket.IO ni el DOM. El servidor inyecta `onChange` para
// difundir el estado, `positionOf` para consultar dónde está cada jugador y un
// RNG (semilla en las pruebas) para elegir al buscador.
//
// Reglas:
// - De 3 a 12 jugadores; todos pulsan «Listo» y el buscador se elige al azar.
// - `hide` (90 s): el buscador queda congelado en la jaula central.
// - `seek` (180 s): el buscador etiqueta con distancia < 1,6 m y línea libre.
// - Esquivas del escondido, pulso del buscador y gracia de reconnect de 45 s.
// - Gana el buscador si etiqueta a todos; si no, ganan los escondidos.

import {
  HIDE_DASH_COUNT,
  HIDE_DASH_IFRAME_MS,
  HIDE_DASH_RECHARGE_MS,
  HIDE_HIDE_MS,
  HIDE_MAP_ID,
  HIDE_MAX_PLAYERS,
  HIDE_MIN_PLAYERS,
  HIDE_PULSE_COOLDOWN_MS,
  HIDE_PULSE_RADIUS,
  HIDE_RECONNECT_GRACE_MS,
  HIDE_RESULT_MS,
  HIDE_SEEK_MS,
  HIDE_TAG_RANGE,
  HIDE_COVERS,
  hasLineOfSight,
  hideDistance,
  hideSeekerSpawn,
  hideStartSpawn,
  stableHideKey,
} from "../../public/js/hideDefs.js";

function nameOf(player) {
  return String(player && player.name ? player.name : "Pingüino").slice(0, 20);
}

export function createEsconditeGame({
  now = () => Date.now(),
  rng = Math.random,
  onChange = () => {},
  positionOf = () => null,
  maxPlayers = HIDE_MAX_PLAYERS,
  minPlayers = HIDE_MIN_PLAYERS,
  hideMs = HIDE_HIDE_MS,
  seekMs = HIDE_SEEK_MS,
  resultMs = HIDE_RESULT_MS,
  reconnectMs = HIDE_RECONNECT_GRACE_MS,
} = {}) {
  const capacity = Math.max(HIDE_MAX_PLAYERS, Number(maxPlayers) || 0);
  const minimum = Math.max(2, Math.min(HIDE_MIN_PLAYERS, Number(minPlayers) || HIDE_MIN_PLAYERS));

  const players = new Map();
  const order = [];
  // Reservas por identidad estable (id de cuenta o nombre de invitado). Permiten
  // que un socket nuevo recupere el rol durante la gracia de desconexión.
  const reservations = new Map();

  let phase = "waiting"; // waiting | hide | seek | result
  let round = 0;
  let hideEndsAt = 0;
  let seekEndsAt = 0;
  let resultEndsAt = 0;
  let winner = null;
  let lastEvent = null;
  let version = 0;

  function playerOf(id) {
    return players.get(id) || null;
  }

  function seeker() {
    return order.map((id) => players.get(id)).find((p) => p && p.role === "seeker") || null;
  }

  function hiders() {
    return order.map((id) => players.get(id)).filter((p) => p && p.role === "hider");
  }

  function remainingHiders() {
    return hiders().filter((p) => !p.tagged);
  }

  function canStart() {
    if (players.size < minimum) return false;
    return order.every((id) => {
      const p = players.get(id);
      return p && p.ready && !p.offline;
    });
  }

  function resetAbilities(p) {
    p.tagged = false;
    p.dashes = HIDE_DASH_COUNT;
    p.dashRechargeAt = 0;
    p.dashUntil = 0;
    p.pulseAt = -Infinity;
  }

  function resetMatch() {
    phase = "waiting";
    hideEndsAt = 0;
    seekEndsAt = 0;
    resultEndsAt = 0;
    winner = null;
    reservations.clear();
    for (const p of players.values()) {
      p.role = null;
      p.ready = false;
      p.offline = false;
      p.disconnectUntil = 0;
      resetAbilities(p);
    }
  }

  function spawnFor(id) {
    const p = playerOf(id);
    if (!p) return hideSeekerSpawn();
    if (p.role === "seeker") return hideSeekerSpawn();
    return hideStartSpawn(p.spawnIndex, Math.max(1, order.length));
  }

  function snapshotPlayer(p) {
    const t = now();
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      ready: !!p.ready,
      offline: !!p.offline,
      tagged: !!p.tagged,
      dashes: p.role === "hider" ? p.dashes : 0,
      dashMs:
        p.role === "hider" && p.dashes < HIDE_DASH_COUNT
          ? Math.max(0, p.dashRechargeAt - t)
          : 0,
      dashUntil: p.dashUntil > t ? p.dashUntil - t : 0,
      pulseMs:
        p.role === "seeker" && Number.isFinite(p.pulseAt)
          ? Math.max(0, p.pulseAt + HIDE_PULSE_COOLDOWN_MS - t)
          : 0,
      spawn: spawnFor(p.id),
    };
  }

  function snapshot() {
    const t = now();
    return {
      modeId: "escondite",
      mapId: HIDE_MAP_ID,
      status: phase,
      phase,
      round,
      maxPlayers: capacity,
      minPlayers: minimum,
      hideMs: phase === "hide" ? Math.max(0, hideEndsAt - t) : 0,
      seekMs: phase === "seek" ? Math.max(0, seekEndsAt - t) : 0,
      resultMs: phase === "result" ? Math.max(0, resultEndsAt - t) : 0,
      seekerId: seeker() ? seeker().id : null,
      remainingHiders: remainingHiders().length,
      totalHiders: hiders().length,
      reconnectMs,
      players: order.map((id) => snapshotPlayer(players.get(id))),
      winner: winner ? { ...winner } : null,
      lastEvent: lastEvent ? { ...lastEvent } : null,
      version,
    };
  }

  function bump(event) {
    version += 1;
    if (event) lastEvent = { ...event, at: now() };
    onChange(snapshot(), event || null);
  }

  function startHide(t) {
    round += 1;
    phase = "hide";
    hideEndsAt = t + hideMs;
    seekEndsAt = 0;
    resultEndsAt = 0;
    winner = null;

    const roll = Math.max(0, Math.min(order.length - 1, Math.floor((Number(rng()) || 0) * order.length)));
    const seekerId = order[roll];
    for (const id of order) {
      const p = players.get(id);
      p.role = id === seekerId ? "seeker" : "hider";
      p.ready = true;
      p.offline = false;
      p.disconnectUntil = 0;
      resetAbilities(p);
      reservations.set(p.key, {
        id,
        role: p.role,
        until: Number.MAX_SAFE_INTEGER,
        userId: p.userId,
        name: p.name,
      });
    }
    bump({ type: "hideStart", seekerId, round });
  }

  function startSeek(t) {
    phase = "seek";
    seekEndsAt = t + seekMs;
    hideEndsAt = 0;
    bump({ type: "seekStart", round });
  }

  function end(t, role, reason) {
    if (winner) return;
    winner = { role, reason };
    phase = "result";
    hideEndsAt = 0;
    seekEndsAt = 0;
    resultEndsAt = t + resultMs;
    bump({ type: "result", winner: role, reason });
  }

  function dropPlayer(id, reason, t = now()) {
    const p = playerOf(id);
    if (!p) return false;
    players.delete(id);
    const index = order.indexOf(id);
    if (index >= 0) order.splice(index, 1);
    const reservation = reservations.get(p.key);
    if (reservation && reservation.id === id) reservations.delete(p.key);

    if (!players.size) {
      resetMatch();
    } else if (phase === "waiting" && !canStart()) {
      // Nada más que hacer: se sigue esperando a que alguien pulse «Listo».
    } else if ((phase === "hide" || phase === "seek") && !winner) {
      if (p.role === "seeker") end(t, "hider", "seeker-left");
      else if (p.role === "hider" && remainingHiders().length === 0) end(t, "seeker", "all-tagged");
    }
    bump({ type: "leave", playerId: id, name: p.name, reason });
    return true;
  }

  function expireReservations(t) {
    for (const p of [...players.values()]) {
      if (p.offline && p.disconnectUntil && t >= p.disconnectUntil) {
        dropPlayer(p.id, "expired", t);
      }
    }
  }

  function join(info = {}) {
    const id = info.id;
    if (!id) return { ok: false, reason: "bad-player" };
    const name = nameOf(info);
    const key = stableHideKey({ userId: info.userId, name });
    const t = now();

    if (players.has(id)) {
      const existing = players.get(id);
      existing.name = name;
      bump({ type: "join", playerId: id, name });
      return { ok: true };
    }

    // Reconnexión con un socket nuevo: la reserva conserva el rol durante 45 s.
    if (phase === "hide" || phase === "seek") {
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
        bump({ type: "rejoin", playerId: id, role: previous.role });
        return { ok: true, rejoin: true, role: previous.role };
      }
      return { ok: false, reason: "in-progress" };
    }

    if (players.size >= capacity) return { ok: false, reason: "full" };

    const p = {
      id,
      key,
      name,
      userId: Number.isFinite(Number(info.userId)) ? Number(info.userId) : null,
      role: null,
      ready: false,
      offline: false,
      disconnectUntil: 0,
      spawnIndex: order.length,
      ...{},
    };
    resetAbilities(p);
    players.set(id, p);
    order.push(id);
    bump({ type: "join", playerId: id, name });
    return { ok: true };
  }

  function leave(id, options = {}) {
    const reason = options && options.reason ? options.reason : "manual";
    const p = playerOf(id);
    if (!p) return { ok: false, reason: "not-in-game" };

    // Una desconexión (cierre de pestaña, corte de red) no elimina al jugador:
    // guarda su rol 45 s para que pueda volver con otro socket.
    if (reason === "disconnect" && (phase === "hide" || phase === "seek")) {
      p.offline = true;
      p.disconnectUntil = now() + reconnectMs;
      reservations.set(p.key, {
        id,
        role: p.role,
        until: p.disconnectUntil,
        userId: p.userId,
        name: p.name,
      });
      bump({ type: "disconnect", playerId: id, name: p.name });
      return { ok: true, offline: true };
    }

    return { ok: dropPlayer(id, reason) };
  }

  function myPosition(id, ctx = {}) {
    if (Number.isFinite(ctx.x) && Number.isFinite(ctx.z)) return { x: ctx.x, z: ctx.z };
    return positionOf(id);
  }

  function action(id, payload = {}, ctx = {}) {
    const p = playerOf(id);
    if (!p || p.offline) return { ok: false, reason: "not-in-game" };
    const t = now();

    if (payload.type === "ready") {
      if (phase !== "waiting") return { ok: false, reason: "not-waiting" };
      p.ready = !p.ready;
      bump({ type: "ready", playerId: id, ready: p.ready });
      return { ok: true, ready: p.ready };
    }

    if (payload.type === "dash") {
      if (phase !== "hide" && phase !== "seek") return { ok: false, reason: "wrong-phase" };
      if (p.role !== "hider") return { ok: false, reason: "wrong-role" };
      if (p.dashes <= 0) return { ok: false, reason: "not-ready" };
      if (p.dashes === HIDE_DASH_COUNT) p.dashRechargeAt = t + HIDE_DASH_RECHARGE_MS;
      p.dashes -= 1;
      p.dashUntil = t + HIDE_DASH_IFRAME_MS;
      bump({ type: "dash", playerId: id, until: p.dashUntil });
      return { ok: true, until: p.dashUntil };
    }

    if (payload.type === "pulse") {
      if (phase !== "seek") return { ok: false, reason: "wrong-phase" };
      if (p.role !== "seeker") return { ok: false, reason: "wrong-role" };
      if (t - p.pulseAt < HIDE_PULSE_COOLDOWN_MS) return { ok: false, reason: "not-ready" };
      p.pulseAt = t;
      const from = myPosition(id, ctx);
      const hits = [];
      if (from) {
        for (const hider of hiders()) {
          if (hider.tagged || hider.offline) continue;
          const to = positionOf(hider.id);
          if (!to) continue;
          if (hideDistance(from, to) > HIDE_PULSE_RADIUS) continue;
          if (!hasLineOfSight(from.x, from.z, to.x, to.z, HIDE_COVERS)) continue;
          hits.push(hider.id);
        }
      }
      bump({ type: "pulse", playerId: id, hits, radius: HIDE_PULSE_RADIUS });
      return { ok: true, hits };
    }

    if (payload.type === "tag") {
      if (phase !== "seek") return { ok: false, reason: "wrong-phase" };
      if (p.role !== "seeker") return { ok: false, reason: "wrong-role" };
      const target = playerOf(payload.targetId);
      if (!target || target.role !== "hider" || target.tagged || target.offline) {
        return { ok: false, reason: "bad-target" };
      }
      if (target.dashUntil > t) return { ok: false, reason: "dodged" };
      const from = myPosition(id, ctx);
      const to = positionOf(target.id);
      if (!from || !to) return { ok: false, reason: "bad-position" };
      if (hideDistance(from, to) > HIDE_TAG_RANGE) return { ok: false, reason: "too-far" };
      if (!hasLineOfSight(from.x, from.z, to.x, to.z, HIDE_COVERS)) {
        return { ok: false, reason: "blocked" };
      }
      target.tagged = true;
      bump({ type: "tag", seekerId: id, targetId: target.id });
      if (remainingHiders().length === 0) end(t, "seeker", "all-tagged");
      return { ok: true };
    }

    return { ok: false, reason: "unknown-action" };
  }

  function tick(t = now()) {
    expireReservations(t);

    // Las esquivas se recargan solas 25 s después del primer uso. Sin este
    // paso el contador del HUD avanzaría pero el jugador nunca recuperaría las
    // tres esquivas.
    for (const p of players.values()) {
      if (
        p.role === "hider" &&
        p.dashes < HIDE_DASH_COUNT &&
        p.dashRechargeAt &&
        t >= p.dashRechargeAt
      ) {
        p.dashes = HIDE_DASH_COUNT;
        p.dashRechargeAt = 0;
        bump({ type: "dashRecharge", playerId: p.id });
      }
    }

    if (phase === "waiting") {
      if (!canStart()) return false;
      startHide(t);
      return true;
    }

    if (phase === "hide" && t >= hideEndsAt) {
      startSeek(t);
      return true;
    }

    if (phase === "seek" && t >= seekEndsAt) {
      end(t, "hider", "timeout");
      return true;
    }

    if (phase === "result" && resultEndsAt && t >= resultEndsAt) {
      resetMatch();
      bump({ type: "restart" });
      return true;
    }

    return false;
  }

  function resultStats() {
    const role = winner ? winner.role : null;
    const winning = role
      ? order
          .map((id) => players.get(id))
          .filter((p) => p && p.role === role && (role !== "hider" || !p.tagged))
      : [];
    const entry = (p) => ({ id: p.id, name: p.name, userId: p.userId });
    return {
      modeId: "escondite",
      winner: role,
      reason: winner ? winner.reason : null,
      round,
      winners: winning.map(entry),
      participants: order.map((id) => players.get(id)).filter(Boolean).map(entry),
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
      const p = playerOf(id);
      if (!p || p.offline) return false;
      // El buscador no puede moverse mientras los escondidos huyen a la jaula.
      return !(phase === "hide" && p.role === "seeker");
    },
    canTag: (id) => phase === "seek" && !!playerOf(id) && playerOf(id).role === "seeker",
    canDash: (id) => {
      const p = playerOf(id);
      return phase !== "result" && !!p && !p.offline && p.role === "hider" && p.dashes > 0;
    },
    canPulse: (id) => {
      const p = playerOf(id);
      return (
        phase === "seek" &&
        !!p &&
        !p.offline &&
        p.role === "seeker" &&
        now() - p.pulseAt >= HIDE_PULSE_COOLDOWN_MS
      );
    },
    dashing: (id) => {
      const p = playerOf(id);
      return !!p && p.dashUntil > now();
    },
    roleOf: (id) => {
      const p = playerOf(id);
      return p ? p.role : null;
    },
    isOffline: (id) => {
      const p = playerOf(id);
      return !!p && !!p.offline;
    },
    canRejoin: (info = {}) => {
      if (phase !== "hide" && phase !== "seek") return false;
      const key = stableHideKey({ userId: info.userId, name: info.name });
      const reservation = reservations.get(key);
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
