// Controlador del servidor para "Encuentra los pares".
//
// Es un módulo puro: no toca Socket.IO ni el DOM. El servidor le inyecta
// `onChange` para difundir el estado y los eventos; las pruebas lo manejan con
// un reloj y un generador aleatorio deterministas.
//
// Reglas:
// - Tablero de 4x4 (8 parejas de emojis) barajado al empezar cada ronda.
// - Por turnos: se voltean dos cartas. Si coinciden, el jugador suma un par y
//   repite turno; si no, se muestran un instante y pasa el turno.
// - El estado que viaja al cliente NUNCA revela emojis de cartas ocultas.
// - Al completar el tablero gana quien tenga más pares; la ronda se reinicia
//   sola pasados unos segundos.

export const PAIRS_GRID = 4;
export const PAIRS_CARD_COUNT = PAIRS_GRID * PAIRS_GRID;
export const PAIRS_PAIR_COUNT = PAIRS_CARD_COUNT / 2;

export const PAIRS_EMOJIS = ["🐧", "❄️", "🎩", "🧊", "🐟", "⭐", "🎈", "🍕"];

const DEFAULT_REVEAL_MS = 1000;
const DEFAULT_RESTART_MS = 12000;

function shuffledDeck(rng) {
  const deck = [];
  for (let pair = 0; pair < PAIRS_PAIR_COUNT; pair++) {
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
  }));
}

export function createPairsGame({
  now = () => Date.now(),
  rng = Math.random,
  onChange = () => {},
  maxPlayers = 6,
  revealMs = DEFAULT_REVEAL_MS,
  restartMs = DEFAULT_RESTART_MS,
} = {}) {
  const players = new Map();
  let order = [];
  let cards = shuffledDeck(rng);
  let flipped = [];
  let lockedUntil = 0;
  let status = "waiting"; // waiting | playing | finished
  let turnId = null;
  let winnerIds = [];
  let restartAt = 0;
  let version = 0;

  function resetRound() {
    cards = shuffledDeck(rng);
    flipped = [];
    lockedUntil = 0;
    winnerIds = [];
    restartAt = 0;
    for (const player of players.values()) player.score = 0;
    status = order.length ? "playing" : "waiting";
    turnId = order[0] || null;
  }

  function resetAll() {
    players.clear();
    order = [];
    resetRound();
    status = "waiting";
  }

  function advanceTurn() {
    if (!order.length) {
      turnId = null;
      return;
    }
    const index = order.indexOf(turnId);
    turnId = order[(index + 1) % order.length];
  }

  function winners() {
    if (!order.length) return [];
    let best = 0;
    for (const id of order) best = Math.max(best, players.get(id).score);
    return order.filter((id) => players.get(id).score === best);
  }

  function snapshot() {
    const t = now();
    return {
      modeId: "pares",
      status,
      turnId,
      waitMs: lockedUntil > t ? Math.max(0, lockedUntil - t) : 0,
      version,
      maxPlayers,
      pairCount: PAIRS_PAIR_COUNT,
      cards: cards.map((card) => {
        const faceUp = card.matched || flipped.includes(card.i);
        return {
          i: card.i,
          matched: card.matched,
          flipped: flipped.includes(card.i),
          // Oculta la cara salvo que esté emparejada o boca arriba ahora.
          emoji: faceUp ? card.emoji : null,
        };
      }),
      players: order.map((id) => {
        const player = players.get(id);
        return { id, name: player.name, score: player.score };
      }),
      winnerIds: [...winnerIds],
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
    if (players.size >= maxPlayers) return { ok: false, reason: "full" };

    if (status === "finished" && restartAt && now() >= restartAt) resetRound();

    players.set(id, { id, name, score: 0 });
    order.push(id);
    if (status === "waiting") {
      status = "playing";
      turnId = order[0];
    }
    bump({ type: "join", playerId: id, name });
    return { ok: true };
  }

  function leave(id) {
    if (!players.has(id)) return { ok: false, reason: "not-in-game" };
    const player = players.get(id);
    const index = order.indexOf(id);

    players.delete(id);
    order.splice(index, 1);

    if (!order.length) {
      resetAll();
      bump({ type: "leave", playerId: id, name: player.name });
      return { ok: true };
    }

    if (turnId === id) {
      turnId = order[index % order.length];
      flipped = [];
      lockedUntil = 0;
    }
    if (status === "finished") winnerIds = winners();
    bump({ type: "leave", playerId: id, name: player.name });
    return { ok: true };
  }

  function action(id, payload = {}) {
    if (!players.has(id)) return { ok: false, reason: "not-in-game" };
    if (payload.type !== "flip") return { ok: false, reason: "unknown-action" };
    if (status !== "playing") return { ok: false, reason: "not-playing" };
    if (turnId !== id) return { ok: false, reason: "not-your-turn" };

    const t = now();
    if (lockedUntil > t) return { ok: false, reason: "wait" };

    const index = Number(payload.index);
    if (!Number.isInteger(index) || index < 0 || index >= cards.length) {
      return { ok: false, reason: "bad-index" };
    }
    const card = cards[index];
    if (card.matched) return { ok: false, reason: "matched" };
    if (flipped.includes(index)) return { ok: false, reason: "already-flipped" };

    flipped.push(index);

    if (flipped.length === 1) {
      bump({ type: "flip", playerId: id, index, emoji: card.emoji });
      return { ok: true };
    }

    const [a, b] = flipped;
    const first = cards[a];
    const second = cards[b];

    if (first.pair === second.pair) {
      first.matched = true;
      second.matched = true;
      players.get(id).score += 1;
      flipped = [];

      if (cards.every((c) => c.matched)) {
        status = "finished";
        winnerIds = winners();
        restartAt = t + restartMs;
        bump({
          type: "win",
          playerId: id,
          winnerIds: [...winnerIds],
          a,
          b,
          emoji: first.emoji,
        });
      } else {
        bump({ type: "match", playerId: id, a, b, emoji: first.emoji });
      }
    } else {
      lockedUntil = t + revealMs;
      bump({ type: "miss", playerId: id, a, b });
    }

    return { ok: true };
  }

  // Avanza temporizadores. Devuelve true si cambió algo (y por tanto ya emitió).
  function tick(t = now()) {
    let changed = false;

    if (status === "playing" && lockedUntil && t >= lockedUntil) {
      flipped = [];
      lockedUntil = 0;
      advanceTurn();
      changed = true;
      bump({ type: "turn", playerId: turnId });
    }

    if (status === "finished" && restartAt && t >= restartAt) {
      resetRound();
      changed = true;
      bump({ type: "restart" });
    }

    return changed;
  }

  return {
    join,
    leave,
    action,
    tick,
    snapshot,
    get status() {
      return status;
    },
    get size() {
      return players.size;
    },
    get turnId() {
      return turnId;
    },
  };
}
