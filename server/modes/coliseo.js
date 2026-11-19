// Controlador autoritativo del Coliseo melee (Ola 2).
//
// Módulo puro: no toca Socket.IO ni el DOM. El servidor le inyecta `onChange`
// para difundir el estado y aplica los eventos de ronda (teletransporte,
// revivir y equipar) cuando el controlador avisa.
//
// Reglas:
// - Formatos 1v1, 2v2 y todos contra todos (hasta 8).
// - Al mejor de 5: gana el primer bando que llega a 3 rondas.
// - Cada ronda dura 90 s o termina cuando queda un solo bando en pie.
// - Entre rondas hay 3 s de cuenta atrás; al morir se es espectador hasta la
//   siguiente ronda.
// - Solo se aceptan armas melee del loadout. El servidor es quien equipa.

import {
  COLISEO_TEAMS,
  COLISEO_FFA_COLORS,
  COLISEO_ROUNDS_TO_WIN,
  COLISEO_ROUND_MS,
  COLISEO_COUNTDOWN_MS,
  COLISEO_ROUND_END_MS,
  COLISEO_RESTART_MS,
  COLISEO_DEFAULT_WEAPON,
  resolveColiseoVariant,
  coliseoSpawn,
  isColiseoWeapon,
} from "../../public/js/coliseoDefs.js";

function nameOf(player) {
  return String(player && player.name ? player.name : "Pingüino").slice(0, 20);
}

export function createColiseoGame({
  variant = "1v1",
  now = () => Date.now(),
  onChange = () => {},
  maxPlayers,
  roundMs = COLISEO_ROUND_MS,
  countdownMs = COLISEO_COUNTDOWN_MS,
  roundEndMs = COLISEO_ROUND_END_MS,
  restartMs = COLISEO_RESTART_MS,
  roundsToWin = COLISEO_ROUNDS_TO_WIN,
} = {}) {
  const def = resolveColiseoVariant(variant);
  const capacity = Math.max(def.maxPlayers, Number(maxPlayers) || 0);

  const players = new Map();
  const order = [];
  const scores = new Map();

  let phase = "waiting"; // waiting | countdown | fight | roundEnd | matchEnd
  let round = 0;
  let countdownEndsAt = 0;
  let fightEndsAt = 0;
  let roundEndsAt = 0;
  let restartAt = 0;
  let matchWinner = null;
  let lastRound = null;
  let version = 0;

  function playerOf(id) {
    return players.get(id) || null;
  }

  function scoreOf(key) {
    return scores.get(key) || 0;
  }

  function colorFor(player) {
    if (def.mode === "ffa") {
      const idx = Math.max(0, order.indexOf(player.id));
      return COLISEO_FFA_COLORS[idx % COLISEO_FFA_COLORS.length];
    }
    const team = COLISEO_TEAMS.find((t) => t.id === player.side);
    return team ? team.color : "#dbeafe";
  }

  function sideName(player) {
    if (def.mode === "ffa") return player.name;
    const team = COLISEO_TEAMS.find((t) => t.id === player.side);
    return team ? team.name : player.side;
  }

  function nextSide() {
    if (def.mode === "ffa") return null;
    let cian = 0;
    let rosa = 0;
    for (const player of players.values()) {
      if (player.side === "cian") cian += 1;
      else if (player.side === "rosa") rosa += 1;
    }
    if (cian < rosa) return "cian";
    if (rosa < cian) return "rosa";
    return order.length % 2 === 0 ? "cian" : "rosa";
  }

  function sideKey(player) {
    return def.mode === "ffa" ? player.id : player.side;
  }

  // Cuántos jugadores vivos quedan por bando. En FFA cada jugador es un bando.
  function aliveSides() {
    if (def.mode === "ffa") {
      return order
        .map((id) => players.get(id))
        .filter((player) => player && player.alive)
        .map((player) => player.id);
    }
    return COLISEO_TEAMS.map((team) => team.id).filter((side) =>
      order.some((id) => {
        const player = players.get(id);
        return player && player.side === side && player.alive;
      })
    );
  }

  // `undefined` = la ronda sigue; `null` = empate; string = bando ganador.
  function roundOutcome() {
    if (!players.size) return null;
    const alive = aliveSides();
    if (alive.length === 1) return alive[0];
    if (alive.length === 0) return null;
    return undefined;
  }

  function timeoutWinner() {
    if (def.mode === "ffa") {
      const alive = aliveSides();
      return alive.length === 1 ? alive[0] : null;
    }
    const counts = COLISEO_TEAMS.map((team) => ({
      id: team.id,
      n: order.filter((id) => {
        const player = players.get(id);
        return player && player.side === team.id && player.alive;
      }).length,
    }));
    counts.sort((a, b) => b.n - a.n);
    if (counts[0].n === 0) return null;
    if (counts[0].n === counts[1].n) return null;
    return counts[0].id;
  }

  function canStart() {
    if (!players.size) return false;
    const ready = [...players.values()].every((player) => player.ready);
    if (!ready) return false;
    if (def.mode === "ffa") return players.size >= 2;
    return players.size >= capacity;
  }

  function beginCountdown(t) {
    phase = "countdown";
    countdownEndsAt = t + countdownMs;
    fightEndsAt = 0;
    roundEndsAt = 0;
    lastRound = null;
    // Al empezar la cuenta atrás todos vuelven a estar en pie: el servidor
    // aplica el teletransporte y el equipamiento con este evento.
    for (const player of players.values()) {
      player.alive = true;
      player.ready = true;
    }
  }

  function startRound(t) {
    round += 1;
    phase = "fight";
    fightEndsAt = t + roundMs;
    countdownEndsAt = 0;
    lastRound = null;
  }

  function endRound(t, winnerKey, reason) {
    if (winnerKey) scores.set(winnerKey, scoreOf(winnerKey) + 1);
    lastRound = { winner: winnerKey, reason, round };
    matchWinner = winnerKey && scoreOf(winnerKey) >= roundsToWin ? winnerKey : null;
    phase = "roundEnd";
    roundEndsAt = t + roundEndMs;
    fightEndsAt = 0;
    countdownEndsAt = 0;
  }

  function resetMatch() {
    scores.clear();
    round = 0;
    phase = "waiting";
    countdownEndsAt = 0;
    fightEndsAt = 0;
    roundEndsAt = 0;
    restartAt = 0;
    matchWinner = null;
    lastRound = null;
    for (const player of players.values()) {
      player.ready = false;
      player.alive = true;
    }
  }

  function scoreboard() {
    if (def.mode === "ffa") {
      return order.map((id) => {
        const player = players.get(id);
        return {
          id,
          name: player.name,
          color: colorFor(player),
          score: scoreOf(id),
          members: [id],
          alive: !!player.alive,
        };
      });
    }
    return COLISEO_TEAMS.map((team) => ({
      id: team.id,
      name: team.name,
      short: team.short,
      color: team.color,
      score: scoreOf(team.id),
      members: order.filter((id) => {
        const player = players.get(id);
        return player && player.side === team.id;
      }),
      alive: order.some((id) => {
        const player = players.get(id);
        return player && player.side === team.id && player.alive;
      }),
    }));
  }

  function spawnFor(id) {
    const player = playerOf(id);
    if (!player) return { x: 0, z: 0, yaw: 0 };
    if (def.mode === "ffa") {
      const index = Math.max(0, order.indexOf(id));
      return coliseoSpawn(def, index, 0);
    }
    const sideIndex = player.side === "cian" ? 0 : 1;
    const mates = order.filter((pid) => {
      const mate = playerOf(pid);
      return mate && mate.side === player.side;
    });
    return coliseoSpawn(def, sideIndex, Math.max(0, mates.indexOf(id)));
  }

  function snapshot() {
    const t = now();
    return {
      modeId: "coliseo",
      variant: def.id,
      mode: def.mode,
      teamSize: def.teamSize,
      maxPlayers: capacity,
      status: phase,
      phase,
      round,
      roundsToWin,
      roundMs,
      countdownMs: phase === "countdown" ? Math.max(0, countdownEndsAt - t) : 0,
      fightMs: phase === "fight" ? Math.max(0, fightEndsAt - t) : 0,
      restartMs: phase === "matchEnd" ? Math.max(0, restartAt - t) : 0,
      scores: scoreboard(),
      players: order.map((id) => {
        const player = players.get(id);
        return {
          id,
          name: player.name,
          side: player.side,
          sideName: sideName(player),
          color: colorFor(player),
          alive: !!player.alive,
          ready: !!player.ready,
          weaponId: player.weaponId,
          spawn: spawnFor(id),
        };
      }),
      winner: matchWinner
        ? {
            kind: def.mode === "ffa" ? "player" : "team",
            id: matchWinner,
            name:
              def.mode === "ffa"
                ? playerOf(matchWinner)
                  ? playerOf(matchWinner).name
                  : matchWinner
                : sideName({ side: matchWinner, name: matchWinner }),
          }
        : null,
      lastRound: lastRound ? { ...lastRound } : null,
      version,
    };
  }

  function bump(event) {
    version += 1;
    onChange(snapshot(), event || null);
  }

  function join(player) {
    const id = player && player.id;
    if (!id) return { ok: false, reason: "bad-player" };
    const name = nameOf(player);

    if (players.has(id)) {
      players.get(id).name = name;
      bump({ type: "join", playerId: id, name });
      return { ok: true };
    }
    // No se entra a una partida en curso: el bando y el arma se eligen antes de
    // la primera ronda. Al reiniciarse la partida vuelve a `waiting`. Se
    // comprueba antes del aforo para que el aviso sea el correcto cuando la
    // sala está llena porque la partida ya empezó.
    if (phase === "fight" || phase === "roundEnd" || phase === "matchEnd") {
      return { ok: false, reason: "in-progress" };
    }
    if (players.size >= capacity) return { ok: false, reason: "full" };

    const side = def.mode === "ffa" ? id : nextSide();
    const alive = phase === "waiting" || phase === "countdown";
    players.set(id, {
      id,
      name,
      side,
      weaponId: COLISEO_DEFAULT_WEAPON,
      ready: false,
      alive,
    });
    order.push(id);
    bump({ type: "join", playerId: id, name, side });
    return { ok: true };
  }

  function leave(id) {
    const player = players.get(id);
    if (!player) return { ok: false, reason: "not-in-game" };

    players.delete(id);
    const index = order.indexOf(id);
    if (index >= 0) order.splice(index, 1);

    if (!players.size) {
      resetMatch();
      bump({ type: "leave", playerId: id, name: player.name });
      return { ok: true };
    }

    if (phase === "countdown" && !canStart()) {
      phase = "waiting";
      countdownEndsAt = 0;
    }

    if (phase === "fight") {
      const outcome = roundOutcome();
      if (outcome !== undefined) {
        endRound(now(), outcome, "leave");
        bump({ type: "roundEnd", round, winner: outcome, reason: "leave" });
        return { ok: true };
      }
    }

    bump({ type: "leave", playerId: id, name: player.name });
    return { ok: true };
  }

  function action(id, payload = {}) {
    const player = playerOf(id);
    if (!player) return { ok: false, reason: "not-in-game" };

    if (payload.type === "weapon") {
      if (phase === "fight" || phase === "matchEnd") return { ok: false, reason: "not-waiting" };
      if (!isColiseoWeapon(payload.weaponId)) return { ok: false, reason: "bad-weapon" };
      player.weaponId = payload.weaponId;
      bump({ type: "weapon", playerId: id, weaponId: player.weaponId });
      return { ok: true };
    }

    if (payload.type === "ready") {
      if (phase !== "waiting") return { ok: false, reason: "not-waiting" };
      player.ready = !player.ready;
      bump({ type: "ready", playerId: id, ready: player.ready });
      return { ok: true };
    }

    return { ok: false, reason: "unknown-action" };
  }

  // El servidor llama a esto cuando un jugador llega a 0 HP. Devuelve true si
  // la ronda terminó con esa baja.
  function eliminate(id) {
    const player = playerOf(id);
    if (!player || !player.alive) return false;
    player.alive = false;

    if (phase === "fight") {
      const outcome = roundOutcome();
      if (outcome !== undefined) {
        endRound(now(), outcome, "wipe");
        bump({ type: "roundEnd", round, winner: outcome, reason: "wipe" });
        return true;
      }
    }

    bump({ type: "eliminated", playerId: id });
    return false;
  }

  function tick(t = now()) {
    let changed = false;

    if (phase === "waiting") {
      if (canStart()) {
        beginCountdown(t);
        changed = true;
        bump({ type: "countdown", round: round + 1 });
      }
    }

    if (phase === "countdown" && t >= countdownEndsAt) {
      startRound(t);
      changed = true;
      bump({ type: "roundStart", round });
    }

    if (phase === "fight" && t >= fightEndsAt) {
      const winner = timeoutWinner();
      endRound(t, winner, "timeout");
      changed = true;
      bump({ type: "roundEnd", round, winner, reason: "timeout" });
    }

    if (phase === "roundEnd" && t >= roundEndsAt) {
      if (matchWinner) {
        phase = "matchEnd";
        restartAt = t + restartMs;
        roundEndsAt = 0;
        changed = true;
        bump({
          type: "matchEnd",
          round,
          winner: matchWinner,
          scores: scoreboard(),
        });
      } else {
        beginCountdown(t);
        changed = true;
        bump({ type: "countdown", round: round + 1 });
      }
    }

    if (phase === "matchEnd" && restartAt && t >= restartAt) {
      resetMatch();
      changed = true;
      bump({ type: "restart" });
    }

    return changed;
  }

  return {
    variant: def.id,
    mode: def.mode,
    join,
    leave,
    action,
    tick,
    eliminate,
    snapshot,
    spawnFor,
    canFight: (id) => {
      const player = playerOf(id);
      return phase === "fight" && !!player && player.alive;
    },
    sideOf: (id) => {
      const player = playerOf(id);
      return player ? sideKey(player) : null;
    },
    sameSide: (a, b) => {
      const pa = playerOf(a);
      const pb = playerOf(b);
      if (!pa || !pb) return false;
      return sideKey(pa) === sideKey(pb);
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
    get round() {
      return round;
    },
  };
}
