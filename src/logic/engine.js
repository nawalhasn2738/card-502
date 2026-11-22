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
  s.chosenSuit = null;
  s.drawnCardId = null;
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

  s.roundStarter = nextActive(s, s.roundStarter);
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
    pendingDraw: 0,              // cards the next player must draw (stacked 2s / Ace of Spades)
    chosenSuit: null,            // suit named by the last Jack
    drawnCardId: null,           // set after a draw when the drawn card is playable
    roundResult: null, winnerId: null, lastEvent: null,
  };
  return startRound(base, rng);
}

// ---- ending a round ----
function endRound(s, winnerIdx, reason) {
  const winner = s.players[winnerIdx];
  const points = {};
  const eliminatedIds = [];
  s.players.forEach((p, i) => {
    if (p.eliminated || i === winnerIdx) return;
    const pts = handPoints(p.hand);
    points[p.id] = pts;
    p.score += pts;
    if (p.score >= RULES.eliminationScore) {
      p.eliminated = true;
      eliminatedIds.push(p.id);
    }
  });
  s.roundResult = { winnerId: winner.id, reason, points, eliminatedIds };
  const remaining = s.players.filter((p) => !p.eliminated);
  if (remaining.length <= 1) {
    s.phase = 'gameOver';
    s.winnerId = remaining[0].id;
  } else {
    s.phase = 'roundOver';
  }
  s.drawnCardId = null;
  s.lastEvent = { type: 'ROUND_END', ...s.roundResult };
}

// ---- player actions ----
function playCard(state, { cardId, chosenSuit }, rng = Math.random) {
  if (state.phase !== 'playing') return invalid(state, 'NOT_PLAYING');
  const idx = state.currentPlayer;
  const card = state.players[idx].hand.find((c) => c.id === cardId);
  if (!card) return invalid(state, 'CARD_NOT_IN_HAND');
  if (state.drawnCardId && card.id !== state.drawnCardId) return invalid(state, 'ONLY_DRAWN_CARD');
  if (!R.isLegalPlay(state, card)) return invalid(state, 'ILLEGAL_CARD');
  if (R.isJack(card) && !SUITS.includes(chosenSuit)) return invalid(state, 'JACK_NEEDS_SUIT');

  const s = clone(state);
  const player = s.players[idx];
  player.hand = player.hand.filter((c) => c.id !== cardId);
  s.discardPile.push(card);
  s.chosenSuit = R.isJack(card) ? chosenSuit : null;
  s.drawnCardId = null;
  s.lastEvent = { type: 'PLAY', playerId: player.id, card, chosenSuit: s.chosenSuit };

  if (R.isSevenOfHearts(card)) { endRound(s, idx, 'SEVEN_OF_HEARTS'); return s; }
  if (player.hand.length === 0) { endRound(s, idx, 'EMPTY_HAND'); return s; }

  if (R.isTwo(card)) s.pendingDraw += RULES.twoPenalty;
  if (R.isAceOfSpades(card)) s.pendingDraw += RULES.aceOfSpadesPenalty;
  s.currentPlayer = nextActive(s, idx, R.isEight(card) ? 2 : 1); // an 8 skips one player
  return s;
}

function drawCard(state, rng = Math.random) {
  if (state.phase !== 'playing') return invalid(state, 'NOT_PLAYING');
  if (state.drawnCardId) return invalid(state, 'ALREADY_DRAWN');
  const s = clone(state);
  const player = s.players[s.currentPlayer];

  if (s.pendingDraw > 0) {                       // take the whole penalty, turn ends
    const drawn = takeFromPile(s, s.pendingDraw, rng);
    player.hand.push(...drawn);
    s.lastEvent = { type: 'PENALTY_DRAW', playerId: player.id, count: drawn.length };
    s.pendingDraw = 0;
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
  const playable = R.isLegalPlay(s, drawn[0]);
  s.lastEvent = { type: 'DRAW', playerId: player.id, card: drawn[0], playable };
  if (playable) s.drawnCardId = drawn[0].id;     // player may play it or pass
  else s.currentPlayer = nextActive(s, s.currentPlayer);
  return s;
}

// After drawing a playable card, the player may choose to keep it and end the turn.
function passTurn(state) {
  if (state.phase !== 'playing') return invalid(state, 'NOT_PLAYING');
  if (!state.drawnCardId) return invalid(state, 'MUST_DRAW_FIRST');
  const s = clone(state);
  s.lastEvent = { type: 'PASS', playerId: s.players[s.currentPlayer].id };
  s.drawnCardId = null;
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