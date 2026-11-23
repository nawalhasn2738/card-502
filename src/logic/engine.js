// The game engine: pure functions. Each takes a state and returns a NEW state.
// No UI code in here, so it can be tested and explained on its own.
// Invalid actions never throw: they return the same state with lastEvent = { type: 'INVALID', reason }.

const { RULES, SUITS, RANKS } = require('./constants');
const { createDeck, shuffle } = require('./deck');
const { handPoints } = require('./scoring');
const R = require('./rules');

const clone = (s) => JSON.parse(JSON.stringify(s));
const invalid = (state, reason) => ({ ...state, lastEvent: { type: 'INVALID', reason } });

// Next non-eliminated player, `steps` seats ahead (play always goes clockwise).
function nextActive(state, from, steps = 1) {
  const n = state.players.length;
  let idx = from;
  for (let s = 0; s < steps; s++) {
    do { idx = (idx + 1) % n; } while (state.players[idx].eliminated);
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
  const s = clone(prev);
  s.round += 1;
  s.drawPile = shuffle(createDeck(), rng);
  s.discardPile = [];
  s.pendingDraw = 0;
  s.pendingType = null;
  s.pendingSkip = false;
  s.chosenSuit = null;
  s.chosenRank = null;
  s.winnerId = null;
  s.roundResult = null;
  s.phase = 'playing';

  s.players.forEach((p) => { p.hand = []; });
  for (let i = 0; i < RULES.handSize; i++) {
    s.players.forEach((p) => { if (!p.eliminated) p.hand.push(s.drawPile.pop()); });
  }

  // Flip the first table card; special cards go back to the bottom of the pile.
  let guard = 0;
  let card = s.drawPile.pop();
  while (R.isSpecial(card) && guard++ < 60) {
    s.drawPile.unshift(card);
    card = s.drawPile.pop();
  }
  s.discardPile.push(card);

  const active = s.players.map((p, i) => ({ ...p, index: i })).filter((p) => !p.eliminated);
  s.roundStarter = s.round === 1 ? 0 : active.reduce((best, p) => p.score < best.score ? p : best).index;
  s.currentPlayer = s.roundStarter;
  s.lastEvent = { type: 'ROUND_START', round: s.round };
  return s;
}

// playerConfigs: [{ name: 'Naval' }, { name: 'Bot 1', isBot: true }, ...]
function createGame(playerConfigs, rng = Math.random) {
  const n = playerConfigs.length;
  if (n < RULES.minPlayers || n > RULES.maxPlayers) {
    throw new Error(`Players must be between ${RULES.minPlayers} and ${RULES.maxPlayers}`);
  }
  const base = {
    players: playerConfigs.map((c, i) => ({
      id: 'p' + i, name: c.name, isBot: !!c.isBot, hand: [], score: 0, eliminated: false,
    })),
    drawPile: [], discardPile: [],
    currentPlayer: 0, roundStarter: -1, round: 0,
    phase: 'playing',            // 'playing' | 'roundOver' | 'gameOver'
    pendingDraw: 0, pendingType: null, pendingSkip: false,
    chosenSuit: null, chosenRank: null,
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
  const survivor = active.every((p) => p.score >= RULES.eliminationScore)
    ? active.reduce((best, p) => p.score < best.score ? p : best)
    : null;
  const eliminatedIds = [];
  active.forEach((p) => {
    if (p.score >= RULES.eliminationScore && p !== survivor) {
      p.eliminated = true;
      eliminatedIds.push(p.id);
    }
  });
  s.roundResult = { endedBy, winnerId: reason === 'EMPTY_HAND' ? endedBy : null, reason, points, eliminatedIds };
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
  s.chosenRank = null;
  s.lastEvent = { type: 'ROUND_END', ...s.roundResult };
}

// ---- player actions ----
function playCard(state, { cardId, chosenSuit, chosenRank } = {}, rng = Math.random) {
  if (state.phase !== 'playing') return invalid(state, 'NOT_PLAYING');
  const idx = state.currentPlayer;
  const card = state.players[idx].hand.find((c) => c.id === cardId);
  if (!card) return invalid(state, 'CARD_NOT_IN_HAND');
  if (!R.isLegalPlay(state, card)) return invalid(state, 'ILLEGAL_CARD');
  if (R.isJack(card)) {
    const suitDemand = SUITS.includes(chosenSuit) && chosenRank == null;
    const rankDemand = RANKS.includes(chosenRank) && chosenSuit == null;
    if (!suitDemand && !rankDemand) return invalid(state, 'JACK_NEEDS_DEMAND');
  }

  const s = clone(state);
  const player = s.players[idx];
  player.hand = player.hand.filter((c) => c.id !== cardId);
  s.discardPile.push(card);
  s.chosenSuit = R.isJack(card) ? chosenSuit ?? null : null;
  s.chosenRank = R.isJack(card) ? chosenRank ?? null : null;
  s.pendingSkip = false;
  s.lastEvent = { type: 'PLAY', playerId: player.id, card,
    chosenSuit: s.chosenSuit, chosenRank: s.chosenRank, skippedId: null };

  if (R.isSevenOfHearts(card)) { endRound(s, idx, 'SEVEN_OF_HEARTS'); return s; }
  if (player.hand.length === 0) { endRound(s, idx, 'EMPTY_HAND'); return s; }

  if (R.isTwo(card)) {
    s.pendingDraw += RULES.twoPenalty;
    s.pendingType = 'two';
  }
  if (R.isAceOfSpades(card) || (card.rank === 'A' && s.pendingType === 'ace')) {
    s.pendingDraw += RULES.aceOfSpadesPenalty;
    s.pendingType = 'ace';
  }
  s.currentPlayer = nextActive(s, idx);
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
  if (state.phase !== 'playing') return invalid(state, 'NOT_PLAYING');
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
  if (state.phase !== 'playing') return invalid(state, 'NOT_PLAYING');
  if (!state.pendingSkip) return invalid(state, 'NOTHING_TO_PASS');
  const s = clone(state);
  s.lastEvent = { type: 'SKIP', playerId: s.players[s.currentPlayer].id };
  s.pendingSkip = false;
  s.currentPlayer = nextActive(s, s.currentPlayer);
  return s;
}

function nextRound(state, rng = Math.random) {
  if (state.phase !== 'roundOver') return invalid(state, 'ROUND_NOT_OVER');
  return startRound(state, rng);
}

function restartGame(state, rng = Math.random) {
  return createGame(state.players.map((p) => ({ name: p.name, isBot: p.isBot })), rng);
}

module.exports = {
  createGame, startRound, playCard, drawCard, passTurn, nextRound, restartGame, nextActive,
};
