// Controlador autoritativo de "Encuentra los pares" (tablero 3D).
//
// Es un módulo puro: no toca Socket.IO ni el DOM. El servidor le inyecta
// `onChange` para difundir el estado y `tick` recibe la posición autoritativa de
// cada jugador para asignar equipos y deducir qué carta se pisa.
//
// Reglas:
// - Dos formatos: 1v1 (4x4, 16 cartas) y 2v2 (6x6, 36 cartas).
// - Cada equipo elige plataforma física en la arena. Cuando ambos equipos están
//   completos empieza una cuenta atrás y luego la partida.
// - Turno por equipo: cualquiera de sus miembros puede pisar una carta y saltar.
//   Si acierta, el equipo suma el par, lo guarda en su atril y repite turno.
// - El estado que viaja al cliente NUNCA revela emojis de cartas ocultas.

import {
  PAIRS_EMOJIS,
  PAIRS_TEAMS,
  getPairsTeam,
  resolvePairsVariant,
  cardIndexAt,
  teamPadAt,
  teamRackSlot,
  neutralSpawn,
} from "../../public/js/pairsDefs.js";

export { PAIRS_EMOJIS };

// Compatibilidad con la primera versión (1v1).
export const PAIRS_GRID = 4;
export const PAIRS_CARD_COUNT = 16;
export const PAIRS_PAIR_COUNT = 8;

const DEFAULT_REVEAL_MS = 1200;
const DEFAULT_TURN_MS = 20000;
const DEFAULT_RESTART_MS = 12000;
const DEFAULT_COUNTDOWN_MS = 3200;

function shuffledDeck(def, rng) {
  const deck = [];
  for (let pair = 0; pair < def.pairCount; pair++) {
    const emoji = PAIRS_EMOJIS[pair % PAIRS_EMOJIS.length];
    deck.push({ emoji, pair });
    deck.push({ emoji, pair });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck.map((card, index) => ({
    i: index,
    emoji: card.emoji,
    pair: card.pair,
    matched: false,
    ownerTeam: null,
    slot: null,
  }));
}

export function createPairsGame({
  variant = "1v1",
  now = () => Date.now(),
  rng = Math.random,
  onChange = () => {},
  maxPlayers,
  revealMs = DEFAULT_REVEAL_MS,
  turnMs = DEFAULT_TURN_MS,
  restartMs = DEFAULT_RESTART_MS,
  countdownMs = DEFAULT_COUNTDOWN_MS,
} = {}) {
  const def = resolvePairsVariant(variant);
  const capacity = Math.max(def.maxPlayers, Number(maxPlayers) || 0);

  const players = new Map();
  const order = [];
  const teams = new Map(
    PAIRS_TEAMS.map((team) => [
      team.id,
      { id: team.id, members: new Set(), score: 0, rack: [] },
    ])
  );

  let cards = shuffledDeck(def, rng);
  let round = 0;
  let flipped = [];
  let lockedUntil = 0;
  let turnEndsAt = 0;
  let turnTeam = null;
  let countdownEndsAt = 0;
  let restartAt = 0;
  let status = "waiting"; // waiting | starting | playing | finished
  let winnerTeams = [];
  let version = 0;

  function teamState(id) {
    return teams.get(id) || null;
  }

  function teamFull(teamId) {
    const team = teamState(teamId);
    return !!team && team.members.size >= def.teamSize;
  }

  function teamsComplete() {
    for (const team of teams.values()) {
      if (team.members.size !== def.teamSize) return false;
    }
    return true;
  }

  function clearRoundState() {
    cards = shuffledDeck(def, rng);
    round += 1;
    flipped = [];
    lockedUntil = 0;
    turnEndsAt = 0;
    turnTeam = null;
    countdownEndsAt = 0;
    restartAt = 0;
    winnerTeams = [];
    for (const team of teams.values()) {
      team.score = 0;
      team.rack = [];
    }
    status = "waiting";
  }

  function resetAll() {
    for (const team of teams.values()) {
      team.members.clear();
      team.score = 0;
      team.rack = [];
    }
    players.clear();
    order.length = 0;
    clearRoundState();
    status = "waiting";
  }

  function beginCountdown(t) {
    status = "starting";
    countdownEndsAt = t + countdownMs;
    turnTeam = null;
    turnEndsAt = 0;
    lockedUntil = 0;
  }

  function startMatch(t) {
    status = "playing";
    turnTeam = "cian";
    turnEndsAt = t + turnMs;
    countdownEndsAt = 0;
    lockedUntil = 0;
    flipped = [];
  }

  function advanceTurn(t) {
    turnTeam = turnTeam === "cian" ? "rosa" : "cian";
    flipped = [];
    lockedUntil = 0;
    turnEndsAt = t + turnMs;
  }

  function winners() {
    let best = -1;
    for (const team of teams.values()) best = Math.max(best, team.score);
    const result = [];
    for (const team of teams.values()) {
      if (team.score === best) result.push(team.id);
    }
    return result;
  }

  function assignTeam(player, teamId) {
    if (!player || !teamState(teamId)) return false;
    if (player.team === teamId) return false;
    if (teamFull(teamId)) return false;
    if (player.team) {
      const old = teamState(player.team);
      if (old) old.members.delete(player.id);
    }
    teamState(teamId).members.add(player.id);
    player.team = teamId;
    return true;
  }

  function autoAssign(posOf) {
    if (status !== "waiting" || typeof posOf !== "function") return [];
    const assigned = [];
    for (const player of players.values()) {
      const pos = posOf(player.id);
      if (!pos) continue;
      const pad = teamPadAt(def, pos.x, pos.z);
      if (!pad || pad === player.team) continue;
      if (teamFull(pad)) continue;
      if (assignTeam(player, pad)) assigned.push({ playerId: player.id, team: pad });
    }
    return assigned;
  }

  function snapshot() {
    const t = now();
    return {
      modeId: "pares",
      variant: def.id,
      grid: def.grid,
      cardCount: def.cardCount,
      pairCount: def.pairCount,
      teamSize: def.teamSize,
      status,
      round,
      turnTeam,
      waitMs: lockedUntil > t ? Math.max(0, lockedUntil - t) : 0,
      countdownMs: status === "starting" ? Math.max(0, countdownEndsAt - t) : 0,
      turnMs: status === "playing" ? Math.max(0, turnEndsAt - t) : 0,
      version,
      maxPlayers: capacity,
      teams: PAIRS_TEAMS.map((team) => {
        const state = teamState(team.id);
        return {
          id: team.id,
          name: team.name,
          short: team.short,
          color: team.color,
          score: state.score,
          members: [...state.members],
          rack: state.rack.map((entry) => ({ ...entry })),
        };
      }),
      players: order.map((id) => {
        const player = players.get(id);
        return {
          id,
          name: player.name,
          team: player.team,
          score: player.team ? teamState(player.team).score : 0,
        };
      }),
      cards: cards.map((card) => {
        const faceUp = card.matched || flipped.includes(card.i);
        return {
          i: card.i,
          matched: card.matched,
          flipped: flipped.includes(card.i),
          // Oculta la cara salvo que esté emparejada o boca arriba ahora.
          emoji: faceUp ? card.emoji : null,
          ownerTeam: card.matched ? card.ownerTeam : null,
          slot: card.matched ? card.slot : null,
        };
      }),
      winnerTeams: [...winnerTeams],
      winnerIds: winnerTeams.flatMap((teamId) => [...teamState(teamId).members]),
    };
  }

  function bump(event) {
    version += 1;
    onChange(snapshot(), event || null);
  }

  function join(player) {
    const id = player && player.id;
    if (!id) return { ok: false, reason: "bad-player" };
    const name = String(player.name || "Pingüino").slice(0, 20);

    if (players.has(id)) {
      players.get(id).name = name;
      bump(null);
      return { ok: true };
    }
    if (players.size >= capacity) return { ok: false, reason: "full" };

    players.set(id, { id, name, team: null });
    order.push(id);
    bump({ type: "join", playerId: id, name });
    return { ok: true };
  }

  function leave(id) {
    const player = players.get(id);
    if (!player) return { ok: false, reason: "not-in-game" };

    players.delete(id);
    const index = order.indexOf(id);
    if (index >= 0) order.splice(index, 1);
    if (player.team) {
      const team = teamState(player.team);
      if (team) team.members.delete(id);
    }

    if (!players.size) {
      resetAll();
      bump({ type: "leave", playerId: id, name: player.name });
      return { ok: true };
    }

    if (status !== "waiting" && !teamsComplete()) {
      clearRoundState();
      bump({ type: "pause", playerId: id, name: player.name, reason: "incomplete" });
      return { ok: true };
    }

    if (status === "finished") winnerTeams = winners();
    bump({ type: "leave", playerId: id, name: player.name });
    return { ok: true };
  }

  function action(id, payload = {}, pos = null) {
    const player = players.get(id);
    if (!player) return { ok: false, reason: "not-in-game" };

    if (payload.type === "team") {
      if (status !== "waiting") return { ok: false, reason: "not-waiting" };
      const teamId = payload.team;
      if (!getPairsTeam(teamId)) return { ok: false, reason: "bad-team" };
      if (!pos) return { ok: false, reason: "no-position" };
      const pad = teamPadAt(def, pos.x, pos.z);
      if (pad !== teamId) return { ok: false, reason: "not-on-pad" };
      if (teamFull(teamId) && player.team !== teamId) {
        return { ok: false, reason: "team-full" };
      }
      if (assignTeam(player, teamId)) {
        bump({ type: "team", playerId: id, team: teamId });
      }
      return { ok: true };
    }

    if (payload.type !== "flip") return { ok: false, reason: "unknown-action" };
    if (status !== "playing") return { ok: false, reason: "not-playing" };
    if (!player.team) return { ok: false, reason: "no-team" };
    if (turnTeam !== player.team) return { ok: false, reason: "not-your-turn" };

    const t = now();
    if (lockedUntil > t) return { ok: false, reason: "wait" };
    if (!pos) return { ok: false, reason: "no-position" };

    const index = cardIndexAt(def, pos.x, pos.z);
    if (index < 0) return { ok: false, reason: "not-on-card" };

    const card = cards[index];
    if (card.matched) return { ok: false, reason: "matched" };
    if (flipped.includes(index)) return { ok: false, reason: "already-flipped" };

    flipped.push(index);
    // Cada paso por una carta renueva el reloj del turno: el jugador puede
    // caminar hasta la segunda sin que se le agote el tiempo.
    turnEndsAt = t + turnMs;

    if (flipped.length === 1) {
      bump({ type: "flip", playerId: id, index, emoji: card.emoji, team: player.team });
      return { ok: true };
    }

    const [a, b] = flipped;
    const first = cards[a];
    const second = cards[b];

    if (first.pair === second.pair) {
      const team = teamState(player.team);
      const slot = team.rack.length;
      first.matched = true;
      second.matched = true;
      first.ownerTeam = player.team;
      second.ownerTeam = player.team;
      first.slot = slot;
      second.slot = slot;
      team.score += 1;
      team.rack.push({ emoji: first.emoji, slot, a, b });
      flipped = [];
      turnEndsAt = t + turnMs;

      if (cards.every((c) => c.matched)) {
        status = "finished";
        winnerTeams = winners();
        restartAt = t + restartMs;
        turnEndsAt = 0;
        bump({
          type: "win",
          team: player.team,
          winnerTeams: [...winnerTeams],
          a,
          b,
          emoji: first.emoji,
          slot,
        });
      } else {
        bump({ type: "match", team: player.team, a, b, emoji: first.emoji, slot });
      }
    } else {
      lockedUntil = t + revealMs;
      bump({ type: "miss", team: player.team, a, b });
    }

    return { ok: true };
  }

  // Avanza temporizadores y asignación por plataforma. `posOf(id)` devuelve la
  // posición autoritativa del jugador. Devuelve true si emitió algún cambio.
  function tick(t = now(), posOf = null) {
    let changed = false;

    if (status === "waiting") {
      const assigned = autoAssign(posOf);
      if (assigned.length) {
        changed = true;
        bump({ type: "team", assignments: assigned });
      }
      if (teamsComplete()) {
        clearRoundState();
        beginCountdown(t);
        changed = true;
        bump({ type: "countdown" });
      }
    }

    if (status === "starting") {
      if (!teamsComplete()) {
        clearRoundState();
        changed = true;
        bump({ type: "pause", reason: "incomplete" });
      } else if (countdownEndsAt && t >= countdownEndsAt) {
        startMatch(t);
        changed = true;
        bump({ type: "start", team: turnTeam });
      }
    }

    if (status === "playing") {
      if (!teamsComplete()) {
        clearRoundState();
        changed = true;
        bump({ type: "pause", reason: "incomplete" });
      } else if (lockedUntil && t >= lockedUntil) {
        lockedUntil = 0;
        flipped = [];
        advanceTurn(t);
        changed = true;
        bump({ type: "turn", team: turnTeam });
      } else if (turnEndsAt && t >= turnEndsAt) {
        flipped = [];
        advanceTurn(t);
        changed = true;
        bump({ type: "timeout", team: turnTeam });
      }
    }

    if (status === "finished" && restartAt && t >= restartAt) {
      clearRoundState();
      if (teamsComplete()) beginCountdown(t);
      changed = true;
      bump({ type: "restart" });
    }

    return changed;
  }

  return {
    variant: def.id,
    join,
    leave,
    action,
    tick,
    snapshot,
    spawnFor: () => neutralSpawn(def),
    get status() {
      return status;
    },
    get size() {
      return players.size;
    },
    get turnTeam() {
      return turnTeam;
    },
    get round() {
      return round;
    },
  };
}
