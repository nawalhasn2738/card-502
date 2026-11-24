// The game engine: pure functions. Each takes a state and returns a NEW state.
// No UI code in here, so it can be tested and explained on its own.
// Invalid actions never throw: they return the same state with lastEvent = { type: 'INVALID', reason }.

const { RULES, SUITS } = require('./constants');
const { createDeck, shuffle } = require('./deck');
const { handPoints } = require('./scoring');
const R = require('./rules');

const clone = (s) => JSON.parse(JSON.stringify(s));
const invalid = (state, reason) => ({ ...state, lastEvent: { type: 'INVALID', reason } });

// Next non-eliminated player, `steps` seats ahead (play always goes clockwise).
// Malformed entries are unavailable seats, not active players.
const isActivePlayer = (p) => !!p && typeof p === 'object' && !Array.isArray(p) &&
  typeof p.id === 'string' && p.id.length > 0 && typeof p.name === 'string' &&
  typeof p.isBot === 'boolean' && Array.isArray(p.hand) &&
  Number.isFinite(p.score) && p.eliminated === false;

function nextActive(state, from, steps = 1) {
  if (!Array.isArray(state?.players) || !state.players.some(isActivePlayer)) return -1;
  const n = state.players.length;
  if (!Number.isInteger(from) || from < -1 || from >= n || !Number.isInteger(steps) || steps < 0) return -1;
  let idx = from;
  for (let s = 0; s < steps; s++) {
    do { idx = (idx + 1) % n; } while (!isActivePlayer(state.players[idx]));
  }
  return idx;
}

// ---- drawing (these mutate the working copy `s` inside this file only) ----
function reshuffleDiscard(s, rng) {
  if (s.discardPile.length <= 1) return;       // nothing to reshuffle
  const top = s.discardPile.pop();             // keep the top card on the table
  s.drawPile = shuffle(s.discardPile, rng);
  s.discardPile = [top];
}

function takeFromPile(s, n, rng) {
  const drawn = [];
  for (let i = 0; i < n; i++) {
    if (s.drawPile.length === 0) reshuffleDiscard(s, rng);
    if (s.drawPile.length === 0) break;        // truly no cards left anywhere
    drawn.push(s.drawPile.pop());
  }
  return drawn;
}

// ---- starting a game / round ----
function startRound(prev, rng = Math.random) {
  if (!Array.isArray(prev?.players)) return invalid(prev, 'INVALID_STATE');
  if (nextActive(prev, -1) === -1) return invalid(prev, 'NO_ACTIVE_PLAYERS');
  const previousPoints = prev.roundResult?.points;
  const s = clone(prev);
  s.round += 1;
  s.drawPile = shuffle(createDeck(), rng);
  s.discardPile = [];
  s.pendingDraw = 0;
  s.pendingType = null;
  s.pendingSkip = false;
  s.chosenSuit = null;
  delete s.chosenRank; // discard obsolete rank demands from older snapshots
  s.winnerId = null;
  s.roundResult = null;
  s.phase = 'playing';

  s.players.forEach((p) => { p.hand = []; });
  for (let i = 0; i < RULES.handSize; i++) {
    s.players.forEach((p) => { if (!p.eliminated) p.hand.push(s.drawPile.pop()); });
  }

  // Reject 2, Jack, every Ace and 7H; retain unverified legacy 8 rejection.
  // Do not silently accept a forbidden opener if the entire undealt pile is
  // special. The reference provides no redeal rule for this rare situation.
  if (!s.drawPile.some(R.isOpeningCard)) return invalid(prev, 'NO_OPENING_CARD');
  let card = s.drawPile.pop();
  while (!R.isOpeningCard(card)) {
    s.drawPile.unshift(card);
    card = s.drawPile.pop();
  }
  s.discardPile.push(card);

  const active = s.players.map((p, i) => ({ ...p, index: i })).filter((p) => !p.eliminated);
  // Use previous-round points, not cumulative totals or a winner override.
  // Missing historical points tie at zero (legacy/manual snapshots).
  const points = (p) => previousPoints?.[p.id] ?? 0;
  s.roundStarter = s.round === 1 ? active[0].index
    : active.reduce((best, p) => points(p) < points(best) ? p : best).index;
  s.currentPlayer = s.roundStarter;
  s.lastEvent = { type: 'ROUND_START', round: s.round };
  return s;
}

// playerConfigs: [{ name: 'Nawal' }, { name: 'Bot 1', isBot: true }, ...]
function createGame(playerConfigs, rng = Math.random) {
  if (!Array.isArray(playerConfigs) || playerConfigs.some((p) => !p || typeof p.name !== 'string')) {
    return invalid(null, 'INVALID_PLAYERS');
  }
  const n = playerConfigs.length;
  if (n < RULES.minPlayers || n > RULES.maxPlayers) {
    return invalid(null, 'INVALID_PLAYERS');
  }
  const base = {
    players: playerConfigs.map((c, i) => ({
      id: 'p' + i, name: c.name, isBot: !!c.isBot, hand: [], score: 0, eliminated: false,
    })),
    drawPile: [], discardPile: [],
    currentPlayer: 0, roundStarter: -1, round: 0,
    phase: 'playing',            // 'playing' | 'roundOver' | 'gameOver'
    pendingDraw: 0, pendingType: null, pendingSkip: false,
    chosenSuit: null,
    roundResult: null, winnerId: null, lastEvent: null,
  };
  return startRound(base, rng);
}

// ---- ending a round ----
function endRound(s, endedByIdx, reason) {
  const endedBy = s.players[endedByIdx].id;
  const points = {};
  const active = s.players.filter((p) => !p.eliminated);
  active.forEach((p) => {
    const pts = handPoints(p.hand);
    points[p.id] = pts;
    p.score += pts;
  });
  const eliminatedIds = [];
  active.forEach((p) => {
    // Explicit round-winner protection takes precedence over the ambiguous
    // all-cross-502 fallback. Equal-score fallback is therefore unnecessary.
    if (p.score >= RULES.eliminationScore && p.id !== endedBy) {
      p.eliminated = true;
      eliminatedIds.push(p.id);
    }
  });
  s.roundResult = { endedBy, winnerId: endedBy, reason, points, eliminatedIds };
  const remaining = s.players.filter((p) => !p.eliminated);
  if (remaining.length <= 1) {
    s.phase = 'gameOver';
    s.winnerId = remaining[0]?.id ?? null;
  } else {
    s.phase = 'roundOver';
  }
  s.pendingDraw = 0;
  s.pendingType = null;
  s.pendingSkip = false;
  s.chosenSuit = null;
  delete s.chosenRank;
  s.lastEvent = { type: 'ROUND_END', ...s.roundResult };
}

// ---- player actions ----
function turnError(state) {
  if (state?.phase !== 'playing') return 'NOT_PLAYING';
  if (!Array.isArray(state.players)) return 'INVALID_STATE';
  if (nextActive(state, -1) === -1) return 'NO_ACTIVE_PLAYERS';
  const player = state.players[state.currentPlayer];
  if (!isActivePlayer(player) ||
      !Array.isArray(state.drawPile) || !R.topCard(state)) return 'INVALID_STATE';
  return null;
}

function playCard(state, action = {}, rng = Math.random) {
  const error = turnError(state);
  if (error) return invalid(state, error);
  if (!action || typeof action !== 'object' || Array.isArray(action)) return invalid(state, 'INVALID_ACTION');
  const { cardId, chosenSuit } = action;
  const idx = state.currentPlayer;
  const card = state.players[idx].hand.find((c) => c.id === cardId);
  if (!card) return invalid(state, 'CARD_NOT_IN_HAND');
  if (!R.isLegalPlay(state, card)) return invalid(state, 'ILLEGAL_CARD');
  if (R.isJack(card)) {
    // Old UI rank buttons must fail explicitly rather than silently changing suit.
    if (!SUITS.includes(chosenSuit) || action.chosenRank != null) return invalid(state, 'JACK_NEEDS_SUIT');
  }

  const s = clone(state);
  const player = s.players[idx];
  player.hand = player.hand.filter((c) => c.id !== cardId);
  s.discardPile.push(card);
  s.chosenSuit = R.isJack(card) ? chosenSuit ?? null : null;
  delete s.chosenRank;
  s.pendingSkip = false;
  s.lastEvent = { type: 'PLAY', playerId: player.id, card,
    chosenSuit: s.chosenSuit, skippedId: null };

  if (R.isSevenOfHearts(card)) { endRound(s, idx, 'SEVEN_OF_HEARTS'); return s; }

  if (R.isTwo(card)) {
    s.pendingDraw += RULES.twoPenalty;
    s.pendingType = 'two';
  }
  if (R.isAceOfSpades(card) || (card.rank === 'A' && s.pendingType === 'ace')) {
    s.pendingDraw = RULES.aceOfSpadesPenalty;
    s.pendingType = 'ace';
  }
  s.currentPlayer = nextActive(s, idx);
  if (player.hand.length === 0) {
    // A final counter also passes the whole penalty, with no response turn.
    if (s.pendingDraw > 0) {
      s.players[s.currentPlayer].hand.push(...takeFromPile(s, s.pendingDraw, rng));
    }
    s.currentPlayer = idx;
    endRound(s, idx, 'EMPTY_HAND');
    return s;
  }
  if (R.isEight(card)) {
    const next = s.players[s.currentPlayer];
    if (next.hand.some(R.isEight)) s.pendingSkip = true;
    else {
      s.lastEvent.skippedId = next.id;
      s.currentPlayer = nextActive(s, s.currentPlayer);
    }
  }
  return s;
}

function drawCard(state, rng = Math.random) {
  const error = turnError(state);
  if (error) return invalid(state, error);
  if (state.pendingSkip) return invalid(state, 'SKIP_PENDING');
  const s = clone(state);
  const player = s.players[s.currentPlayer];

  if (s.pendingDraw > 0) {                       // take the whole penalty, turn ends
    const drawn = takeFromPile(s, s.pendingDraw, rng);
    player.hand.push(...drawn);
    s.lastEvent = { type: 'PENALTY_DRAW', playerId: player.id, count: drawn.length };
    s.pendingDraw = 0;
    s.pendingType = null;
    s.currentPlayer = nextActive(s, s.currentPlayer);
    return s;
  }

  const drawn = takeFromPile(s, 1, rng);
  if (drawn.length === 0) {                      // no cards anywhere: pass
    s.lastEvent = { type: 'DRAW_EMPTY', playerId: player.id };
    s.currentPlayer = nextActive(s, s.currentPlayer);
    return s;
  }
  player.hand.push(drawn[0]);
  s.lastEvent = { type: 'DRAW', playerId: player.id, card: drawn[0] };
  s.currentPlayer = nextActive(s, s.currentPlayer);
  return s;
}

// Accept an 8's skip instead of countering with another 8.
function passTurn(state) {
  const error = turnError(state);
  if (error) return invalid(state, error);
  if (!state.pendingSkip) return invalid(state, 'NOTHING_TO_PASS');
  const s = clone(state);
  s.lastEvent = { type: 'SKIP', playerId: s.players[s.currentPlayer].id };
  s.pendingSkip = false;
  s.currentPlayer = nextActive(s, s.currentPlayer);
  return s;
}

function nextRound(state, rng = Math.random) {
  if (state?.phase !== 'roundOver') return invalid(state, 'ROUND_NOT_OVER');
  return startRound(state, rng);
}

function restartGame(state, rng = Math.random) {
  if (!Array.isArray(state?.players)) return invalid(state, 'INVALID_STATE');
  return createGame(state.players.map((p) => ({ name: p.name, isBot: p.isBot })), rng);
}

module.exports = {
  createGame, startRound, playCard, drawCard, passTurn, nextRound, restartGame, nextActive,
};
