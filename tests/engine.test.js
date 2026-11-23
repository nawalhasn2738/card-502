// Run with:  node --test tests/engine.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDeck } = require('../src/logic/deck');
const { handPoints, cardPoints } = require('../src/logic/scoring');
const { SUITS, RANKS } = require('../src/logic/constants');
const R = require('../src/logic/rules');
const { getPlayableCards } = require('../src/logic/rules');
const E = require('../src/logic/engine');

function seeded(seed = 1) { // small deterministic random generator for repeatable tests
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const c = (rank, suit) => ({ id: rank + suit[0].toUpperCase(), rank, suit });

// Build a controlled state: hands, top card, whose turn.
function setup({ hands, top, current = 0, extra = {} }) {
  const s = E.createGame(hands.map((_, i) => ({ name: 'P' + i })), seeded());
  s.players.forEach((p, i) => { p.hand = hands[i]; });
  s.discardPile = [top];
  s.currentPlayer = current;
  Object.assign(s, extra);
  return s;
}


test('deck has 52 unique cards', () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map((card) => card.id)).size, 52);
});

test('30 seeds deal seven cards and start player 0 with a non-special discard', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = E.createGame(Array.from({ length: 2 + seed % 5 }, (_, i) => ({ name: `P${i}` })), seeded(seed));
    s.players.forEach((p) => assert.equal(p.hand.length, 7));
    assert.equal(s.currentPlayer, 0);
    assert.equal(R.isSpecial(R.topCard(s)), false, `seed=${seed}`);
    assert.equal(s.drawPile.length, 51 - s.players.length * 7);
    assert.equal('drawnCardId' in s, false);
    assertReset(s);
  }
});

function assertReset(s) {
  assert.equal(s.pendingDraw, 0);
  assert.equal(s.pendingType, null);
  assert.equal(s.pendingSkip, false);
  assert.equal(s.chosenSuit, null);
  assert.equal(s.chosenRank, null);
}

test('every rank and suit has the original point value', () => {
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const special100 = (rank === '7' && suit === 'hearts') || (rank === 'A' && suit === 'spades');
      const expected = special100 ? 100 : ['2', 'J', '8'].includes(rank) ? 30
        : rank === 'A' ? 20 : ['10', 'Q', 'K'].includes(rank) ? 10 : 5;
      assert.equal(cardPoints(c(rank, suit)), expected, `${rank} ${suit}`);
    }
  }
  assert.equal(handPoints([]), 0);
  assert.equal(handPoints([c('A', 'spades'), c('7', 'hearts'), c('2', 'clubs')]), 230);
});

test('suit or rank matching, turn advance, and current-player filtering', () => {
  const s = setup({ hands: [[c('5', 'hearts'), c('9', 'clubs'), c('K', 'spades')], [c('3', 'clubs')]], top: c('9', 'hearts') });
  assert.deepEqual(getPlayableCards(s, 0).map((card) => card.id), ['5H', '9C']);
  assert.deepEqual(getPlayableCards(s, 1), []);
  assert.deepEqual(getPlayableCards({ ...s, phase: 'roundOver' }, 0), []);
  assert.equal(E.playCard(s, { cardId: 'KS' }).lastEvent.reason, 'ILLEGAL_CARD');
  const n = E.playCard(s, { cardId: '5H' });
  assert.equal(n.currentPlayer, 1);
  assert.equal(R.topCard(n).id, '5H');
  assert.deepEqual(n.lastEvent, { type: 'PLAY', playerId: 'p0', card: c('5', 'hearts'), chosenSuit: null, chosenRank: null, skippedId: null });
});

test('2s stack and only a 2 counters, except the always-legal 7 of hearts', () => {
  const s = setup({ hands: [[c('2', 'hearts'), c('9', 'clubs')], [c('2', 'clubs'), c('A', 'spades'), c('J', 'clubs')], [c('4', 'clubs')]], top: c('9', 'hearts') });
  let n = E.playCard(s, { cardId: '2H' });
  assert.equal(n.pendingDraw, 2);
  assert.equal(n.pendingType, 'two');
  assert.equal(E.playCard(n, { cardId: 'AS' }).lastEvent.reason, 'ILLEGAL_CARD');
  assert.equal(E.playCard(n, { cardId: 'JC', chosenSuit: 'clubs' }).lastEvent.reason, 'ILLEGAL_CARD');
  n = E.playCard(n, { cardId: '2C' });
  assert.equal(n.pendingDraw, 4);
  const count = n.players[2].hand.length;
  n = E.drawCard(n, seeded());
  assert.equal(n.players[2].hand.length, count + 4);
  assert.equal(n.lastEvent.type, 'PENALTY_DRAW');
  assert.equal(n.lastEvent.count, 4);
  assert.equal(n.pendingDraw, 0);
  assert.equal(n.pendingType, null);
  assert.equal(n.currentPlayer, 0);
});

test('Ace of Spades starts five, any Ace counters to ten, and a 2 cannot counter', () => {
  const s = setup({ hands: [[c('A', 'spades'), c('3', 'clubs')], [c('A', 'hearts'), c('2', 'clubs')], [c('4', 'clubs')]], top: c('9', 'spades') });
  let n = E.playCard(s, { cardId: 'AS' });
  assert.equal(n.pendingDraw, 5);
  assert.equal(n.pendingType, 'ace');
  assert.equal(E.playCard(n, { cardId: '2C' }).lastEvent.reason, 'ILLEGAL_CARD');
  n = E.playCard(n, { cardId: 'AH' });
  assert.equal(n.pendingDraw, 10);
  assert.equal(n.pendingType, 'ace');
  n = E.drawCard(n, seeded());
  assert.equal(n.lastEvent.count, 10);
  assert.equal(n.players[2].hand.length, 11);
  assert.equal(n.pendingType, null);
  const normal = setup({ hands: [[c('A', 'clubs'), c('3', 'clubs')], [c('4', 'clubs')]], top: c('9', 'clubs') });
  assert.equal(E.playCard(normal, { cardId: 'AC' }).pendingDraw, 0);
});

test('8 skips a player with no 8, including heads-up and eliminated seats', () => {
  for (const count of [2, 3]) {
    const hands = [[c('8', 'hearts'), c('9', 'clubs')], [c('3', 'clubs')]];
    if (count === 3) hands.push([c('4', 'clubs')]);
    const n = E.playCard(setup({ hands, top: c('9', 'hearts') }), { cardId: '8H' });
    assert.equal(n.currentPlayer, count === 2 ? 0 : 2);
    assert.equal(n.pendingSkip, false);
    assert.equal(n.lastEvent.skippedId, 'p1');
  }
  const s = setup({ hands: [[c('8', 'hearts'), c('9', 'clubs')], [], [c('3', 'clubs')]], top: c('9', 'hearts') });
  s.players[1].eliminated = true;
  const n = E.playCard(s, { cardId: '8H' });
  assert.equal(n.currentPlayer, 0);
  assert.equal(n.lastEvent.skippedId, 'p2');
});

test('8 holder may counter to pass on the skip, or accept; Draw is rejected', () => {
  const s = setup({ hands: [[c('8', 'hearts'), c('9', 'clubs')], [c('8', 'clubs'), c('3', 'hearts')], [c('8', 'diamonds'), c('4', 'clubs')]], top: c('9', 'hearts') });
  const waiting = E.playCard(s, { cardId: '8H' });
  assert.equal(waiting.currentPlayer, 1);
  assert.equal(waiting.pendingSkip, true);
  assert.equal(waiting.lastEvent.skippedId, null);
  assert.deepEqual(getPlayableCards(waiting, 1).map((card) => card.id), ['8C']);
  assert.equal(E.drawCard(waiting).lastEvent.reason, 'SKIP_PENDING');
  const counter = E.playCard(waiting, { cardId: '8C' });
  assert.equal(counter.currentPlayer, 2);
  assert.equal(counter.pendingSkip, true);
  const accepted = E.passTurn(counter);
  assert.equal(accepted.pendingSkip, false);
  assert.equal(accepted.currentPlayer, 0);
  assert.deepEqual(accepted.lastEvent, { type: 'SKIP', playerId: 'p2' });
  assert.equal(E.playCard(waiting, { cardId: '3H' }).lastEvent.reason, 'ILLEGAL_CARD');
});

test('Jack is wild and demands exactly one valid suit or rank', () => {
  const s = setup({ hands: [[c('J', 'clubs'), c('3', 'clubs')], [c('5', 'diamonds'), c('9', 'clubs'), c('5', 'hearts'), c('J', 'spades')]], top: c('9', 'hearts') });
  for (const demand of [{}, { chosenSuit: 'clubs', chosenRank: '5' }, { chosenSuit: 'bad' }, { chosenRank: '1' }, { chosenSuit: 'clubs', chosenRank: 'bad' }, { chosenRank: '5', chosenSuit: 'bad' }]) {
    assert.equal(E.playCard(s, { cardId: 'JC', ...demand }).lastEvent.reason, 'JACK_NEEDS_DEMAND');
  }
  const suit = E.playCard(s, { cardId: 'JC', chosenSuit: 'diamonds' });
  assert.equal(suit.chosenRank, null);
  assert.deepEqual(getPlayableCards(suit, 1).map((card) => card.id), ['5D', 'JS']);
  const rank = E.playCard(s, { cardId: 'JC', chosenRank: '5' });
  assert.equal(rank.chosenSuit, null);
  assert.deepEqual(getPlayableCards(rank, 1).map((card) => card.id), ['5D', '5H', 'JS']);
  const normal = E.playCard(rank, { cardId: '5H' });
  assert.equal(normal.chosenRank, null);
  assert.equal(normal.chosenSuit, null);
  const wild = E.playCard(suit, { cardId: 'JS', chosenRank: 'A' });
  assert.equal(wild.chosenRank, 'A');
  assert.equal(wild.chosenSuit, null);
});

test('7 of hearts overrides penalties, skips and demands; everyone scores leftovers', () => {
  for (const extra of [{}, { pendingDraw: 10, pendingType: 'ace' }, { pendingDraw: 4, pendingType: 'two' }, { pendingSkip: true }, { chosenSuit: 'clubs' }, { chosenRank: 'A' }]) {
    const s = setup({ hands: [[c('7', 'hearts'), c('A', 'spades')], [c('2', 'clubs')]], top: c('9', 'clubs'), extra });
    const n = E.playCard(s, { cardId: '7H' });
    assert.equal(n.phase, 'roundOver');
    assert.deepEqual(n.roundResult, { endedBy: 'p0', winnerId: null, reason: 'SEVEN_OF_HEARTS', points: { p0: 100, p1: 30 }, eliminatedIds: [] });
    assert.deepEqual(n.players.map((p) => p.score), [100, 30]);
    assertReset(n);
  }
});

test('emptying the hand wins with zero points, including a last special', () => {
  for (const card of [c('5', 'hearts'), c('2', 'hearts'), c('8', 'hearts'), c('J', 'hearts'), c('A', 'spades')]) {
    const s = setup({ hands: [[card], [c('K', 'clubs')]], top: c('9', card.suit) });
    const n = E.playCard(s, { cardId: card.id, chosenSuit: 'clubs' });
    assert.equal(n.roundResult.reason, 'EMPTY_HAND');
    assert.equal(n.roundResult.winnerId, 'p0');
    assert.deepEqual(n.roundResult.points, { p0: 0, p1: 10 });
    assertReset(n);
  }
});

test('502 eliminates players and the sole survivor wins the game', () => {
  const s = setup({ hands: [[c('5', 'hearts')], [c('K', 'clubs')]], top: c('9', 'hearts') });
  s.players[1].score = 492;
  const n = E.playCard(s, { cardId: '5H' });
  assert.equal(n.players[1].score, 502);
  assert.equal(n.players[1].eliminated, true);
  assert.equal(n.phase, 'gameOver');
  assert.equal(n.winnerId, 'p0');
  assert.deepEqual(n.roundResult.eliminatedIds, ['p1']);
});

test('everyone crossing 502 leaves the lowest total alive, ties use first seat', () => {
  for (const scores of [[510, 500, 520], [500, 500, 500]]) {
    const s = setup({ hands: [[c('7', 'hearts'), c('3', 'clubs')], [c('4', 'clubs')], [c('5', 'clubs')]], top: c('9', 'spades') });
    s.players.forEach((p, i) => { p.score = scores[i]; });
    const n = E.playCard(s, { cardId: '7H' });
    const winnerIndex = scores[1] < scores[0] ? 1 : 0;
    assert.equal(n.phase, 'gameOver');
    assert.equal(n.winnerId, `p${winnerIndex}`);
    assert.equal(n.players.filter((p) => !p.eliminated).length, 1);
    assert.equal(n.players[winnerIndex].score, 505);
  }
});

test('next round starts lowest-score active seat, ties use first seat, and resets effects', () => {
  const s = setup({ hands: [[c('3', 'clubs')], [], [c('4', 'clubs')]], top: c('9', 'hearts'), extra: { phase: 'roundOver', pendingDraw: 4, pendingType: 'two', pendingSkip: true, chosenSuit: 'clubs', chosenRank: 'A' } });
  s.players[1].eliminated = true;
  s.players[0].score = 100;
  s.players[2].score = 50;
  const n = E.nextRound(s, seeded(5));
  assert.equal(n.currentPlayer, 2);
  assert.equal(n.players[1].hand.length, 0);
  assert.equal(n.players[0].hand.length, 7);
  assertReset(n);
  s.players[0].score = 50;
  assert.equal(E.nextRound(s, seeded()).currentPlayer, 0);
  const restarted = E.restartGame(n, seeded(9));
  assert.deepEqual(restarted.players.map((p) => p.score), [0, 0, 0]);
  restarted.players.forEach((p) => { assert.equal(p.hand.length, 7); assert.equal(p.eliminated, false); });
  assert.equal(restarted.round, 1);
  assert.equal(restarted.currentPlayer, 0);
  assertReset(restarted);
});

test('drawing always ends the turn, even a playable card, preserving an unanswered demand', () => {
  const s = setup({ hands: [[c('9', 'clubs')], [c('3', 'clubs')]], top: c('J', 'hearts'), extra: { chosenRank: '6' } });
  s.drawPile = [c('6', 'hearts')];
  const n = E.drawCard(s);
  assert.equal(n.currentPlayer, 1);
  assert.equal(n.players[0].hand.length, 2);
  assert.deepEqual(n.lastEvent, { type: 'DRAW', playerId: 'p0', card: c('6', 'hearts') });
  assert.equal(n.chosenRank, '6');
  assert.equal('drawnCardId' in n, false);
  assert.equal(E.passTurn(n).lastEvent.reason, 'NOTHING_TO_PASS');
});

test('empty draw pile reshuffles discard but retains the top; exhausted deck ends turn', () => {
  const s = setup({ hands: [[c('9', 'clubs')], [c('3', 'clubs')]], top: c('9', 'hearts') });
  s.drawPile = [];
  s.discardPile = [c('2', 'clubs'), c('3', 'diamonds'), c('4', 'spades'), c('9', 'hearts')];
  const n = E.drawCard(s, seeded());
  assert.deepEqual(n.discardPile, [c('9', 'hearts')]);
  assert.equal(n.drawPile.length, 2);
  assert.equal(n.players[0].hand.length, 2);
  s.discardPile = [c('9', 'hearts')];
  const empty = E.drawCard(s);
  assert.equal(empty.lastEvent.type, 'DRAW_EMPTY');
  assert.equal(empty.currentPlayer, 1);
});

function frozen(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
}

test('valid actions do not mutate input state', () => {
  const s = frozen(setup({ hands: [[c('5', 'hearts'), c('3', 'clubs')], [c('4', 'clubs')]], top: c('9', 'hearts') }));
  const before = JSON.stringify(s);
  E.playCard(s, { cardId: '5H' });
  E.drawCard(s, seeded());
  E.restartGame(s, seeded());
  E.passTurn(frozen({ ...s, pendingSkip: true }));
  E.nextRound(frozen({ ...s, phase: 'roundOver' }), seeded());
  const ending = frozen(setup({ hands: [[c('7', 'hearts'), c('3', 'clubs')], [c('4', 'clubs')]], top: c('9', 'clubs') }));
  E.playCard(ending, { cardId: '7H' });
  assert.equal(JSON.stringify(s), before);
});

test('invalid actions never throw and only replace lastEvent', () => {
  const s = frozen(setup({ hands: [[c('5', 'hearts'), c('K', 'clubs')], [c('3', 'clubs')]], top: c('9', 'hearts') }));
  for (const [state, action, reason] of [
    [s, () => E.playCard(s, { cardId: 'ZZ' }), 'CARD_NOT_IN_HAND'],
    [s, () => E.playCard(s), 'CARD_NOT_IN_HAND'],
    [s, () => E.playCard(s, { cardId: 'KC' }), 'ILLEGAL_CARD'],
    [s, () => E.passTurn(s), 'NOTHING_TO_PASS'],
    [s, () => E.nextRound(s), 'ROUND_NOT_OVER'],
    ...['roundOver', 'gameOver'].flatMap((phase) => {
      const over = frozen({ ...s, phase });
      return [
        [over, () => E.playCard(over, { cardId: '5H' }), 'NOT_PLAYING'],
        [over, () => E.drawCard(over), 'NOT_PLAYING'],
        [over, () => E.passTurn(over), 'NOT_PLAYING'],
      ];
    }),
  ]) {
    const result = action();
    assert.deepEqual(result, { ...state, lastEvent: { type: 'INVALID', reason } });
  }
});
