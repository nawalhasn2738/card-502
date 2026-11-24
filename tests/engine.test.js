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
    assert.equal(R.isOpeningCard(R.topCard(s)), true, `seed=${seed}`);
    assert.ok(!['2', 'J', 'A'].includes(R.topCard(s).rank), `seed=${seed}`);
    assert.notEqual(R.topCard(s).id, '7H', `seed=${seed}`);
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
  assert.equal('chosenRank' in s, false);
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
  assert.deepEqual(n.lastEvent, { type: 'PLAY', playerId: 'p0', card: c('5', 'hearts'), chosenSuit: null, skippedId: null });
});

test('2s stack and only a 2 counters', () => {
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

test('Ace of Spades starts five, any Ace passes five unchanged, and a 2 cannot counter', () => {
  const s = setup({ hands: [[c('A', 'spades'), c('3', 'clubs')], [c('A', 'hearts'), c('2', 'clubs')], [c('4', 'clubs')]], top: c('9', 'spades') });
  let n = E.playCard(s, { cardId: 'AS' });
  assert.equal(n.pendingDraw, 5);
  assert.equal(n.pendingType, 'ace');
  assert.equal(E.playCard(n, { cardId: '2C' }).lastEvent.reason, 'ILLEGAL_CARD');
  n = E.playCard(n, { cardId: 'AH' });
  assert.equal(n.pendingDraw, 5);
  assert.equal(n.pendingType, 'ace');
  n = E.drawCard(n, seeded());
  assert.equal(n.lastEvent.count, 5);
  assert.equal(n.players[2].hand.length, 6);
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

test('Jack is wild and demands a suit only; rank demands are rejected', () => {
  const s = setup({ hands: [[c('J', 'clubs'), c('3', 'clubs')], [c('5', 'diamonds'), c('9', 'clubs'), c('5', 'hearts'), c('J', 'spades')]], top: c('9', 'hearts') });
  for (const demand of [{}, { chosenSuit: 'clubs', chosenRank: '5' }, { chosenSuit: 'bad' }, { chosenRank: '1' }, { chosenSuit: 'clubs', chosenRank: 'bad' }, { chosenRank: '5', chosenSuit: 'bad' }]) {
    assert.equal(E.playCard(s, { cardId: 'JC', ...demand }).lastEvent.reason, 'JACK_NEEDS_SUIT');
  }
  const suit = E.playCard(s, { cardId: 'JC', chosenSuit: 'diamonds' });
  assert.equal('chosenRank' in suit, false);
  assert.deepEqual(getPlayableCards(suit, 1).map((card) => card.id), ['5D', 'JS']);
  const normal = E.playCard(suit, { cardId: '5D' });
  assert.equal('chosenRank' in normal, false);
  assert.equal(normal.chosenSuit, null);
  const wild = E.playCard(suit, { cardId: 'JS', chosenSuit: 'spades' });
  assert.equal(wild.chosenSuit, 'spades');
});

test('7 of hearts is wild on a normal turn and everyone scores leftovers', () => {
  for (const extra of [{}, { chosenSuit: 'clubs' }]) {
    const s = setup({ hands: [[c('7', 'hearts'), c('A', 'spades')], [c('2', 'clubs')]], top: c('9', 'clubs'), extra });
    const n = E.playCard(s, { cardId: '7H' });
    assert.equal(n.phase, 'roundOver');
    assert.deepEqual(n.roundResult, { endedBy: 'p0', winnerId: 'p0', reason: 'SEVEN_OF_HEARTS', points: { p0: 100, p1: 30 }, eliminatedIds: [] });
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
    assert.equal(n.roundResult.points.p0, 0);
    assert.equal(n.roundResult.points.p1, handPoints(n.players[1].hand));
    assert.equal(n.players[1].hand.length, card.rank === '2' ? 3 : card.id === 'AS' ? 6 : 1);
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

test('explicit winner protection takes precedence when everyone crosses 502', () => {
  for (const scores of [[510, 500, 520], [500, 500, 500]]) {
    const s = setup({ hands: [[c('7', 'hearts'), c('3', 'clubs')], [c('4', 'clubs')], [c('5', 'clubs')]], top: c('9', 'spades') });
    s.players.forEach((p, i) => { p.score = scores[i]; });
    const n = E.playCard(s, { cardId: '7H' });
    const winnerIndex = 0;
    assert.equal(n.phase, 'gameOver');
    assert.equal(n.winnerId, `p${winnerIndex}`);
    assert.equal(n.players.filter((p) => !p.eliminated).length, 1);
    assert.equal(n.players[winnerIndex].score, scores[0] + 5);
  }
});

test('next round starts lowest previous-round points active seat, ties use first seat, and resets effects', () => {
  const s = setup({ hands: [[c('3', 'clubs')], [], [c('4', 'clubs')]], top: c('9', 'hearts'), extra: { phase: 'roundOver', pendingDraw: 4, pendingType: 'two', pendingSkip: true, chosenSuit: 'clubs', chosenRank: 'A' } });
  s.players[1].eliminated = true;
  s.players[0].score = 100;
  s.players[2].score = 50;
  s.roundResult = { points: { p0: 10, p1: 0, p2: 5 } };
  const n = E.nextRound(s, seeded(5));
  assert.equal(n.currentPlayer, 2);
  assert.equal(n.players[1].hand.length, 0);
  assert.equal(n.players[0].hand.length, 7);
  assertReset(n);
  s.roundResult.points.p0 = 5;
  assert.equal(E.nextRound(s, seeded()).currentPlayer, 0);
  const restarted = E.restartGame(n, seeded(9));
  assert.deepEqual(restarted.players.map((p) => p.score), [0, 0, 0]);
  restarted.players.forEach((p) => { assert.equal(p.hand.length, 7); assert.equal(p.eliminated, false); });
  assert.equal(restarted.round, 1);
  assert.equal(restarted.currentPlayer, 0);
  assertReset(restarted);
});

test('drawing always ends the turn, even a playable card, preserving an unanswered demand', () => {
  const s = setup({ hands: [[c('9', 'clubs')], [c('3', 'clubs')]], top: c('J', 'hearts'), extra: { chosenSuit: 'hearts' } });
  s.drawPile = [c('6', 'hearts')];
  const n = E.drawCard(s);
  assert.equal(n.currentPlayer, 1);
  assert.equal(n.players[0].hand.length, 2);
  assert.deepEqual(n.lastEvent, { type: 'DRAW', playerId: 'p0', card: c('6', 'hearts') });
  assert.equal(n.chosenSuit, 'hearts');
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

test('7H winner is scored and protected at and above 502, then checked next round', () => {
  for (const score of [402, 450, 550]) {
    const s = setup({ hands: [[c('7', 'hearts'), c('A', 'spades')], [c('3', 'clubs')]], top: c('9', 'hearts') });
    s.players[0].score = score;
    const n = E.playCard(frozen(s), { cardId: '7H' });
    assert.equal(n.roundResult.winnerId, 'p0');
    assert.equal(n.roundResult.points.p0, 100);
    assert.equal(n.players[0].score, score + 100);
    assert.equal(n.players[0].eliminated, false);
    assert.equal(n.phase, 'roundOver');
    let next = E.nextRound(n, seeded());
    assert.equal(next.currentPlayer, 1);
    next.players[1].hand = [c('3', 'hearts')];
    next.players[0].hand = [c('4', 'clubs')];
    next.discardPile = [c('9', 'hearts')];
    next = E.playCard(next, { cardId: '3H' });
    assert.equal(next.players[0].eliminated, true);
    assert.equal(next.winnerId, 'p1');
  }
});

test('7H protected winner becomes game winner if all other players are eliminated', () => {
  const s = setup({ hands: [[c('7', 'hearts'), c('A', 'spades')], [c('K', 'clubs')]], top: c('9', 'clubs') });
  s.players[0].score = 450;
  s.players[1].score = 500;
  const n = E.playCard(s, { cardId: '7H' });
  assert.equal(n.phase, 'gameOver');
  assert.equal(n.winnerId, 'p0');
  assert.deepEqual(n.roundResult.eliminatedIds, ['p1']);
});

test('final 2 and final counter 2 force the full penalty before scoring without a response', () => {
  for (const pending of [0, 2, 4, 6]) {
    const s = setup({ hands: [[c('2', 'hearts')], [c('2', 'clubs')], [c('K', 'clubs')]], top: c('9', 'hearts'),
      extra: { pendingDraw: pending, pendingType: pending ? 'two' : null } });
    const draw = ['3', '4', '5', '6', '7', '9', '10', 'Q'].map((rank) => c(rank, 'spades'));
    s.drawPile = draw.slice(0, pending + 2);
    const n = E.playCard(frozen(s), { cardId: '2H' });
    assert.equal(n.phase, 'roundOver');
    assert.equal(n.players[1].hand.length, 1 + pending + 2);
    assert.ok(n.players[1].hand.some((card) => card.id === '2C'), 'victim cannot counter');
    const expected = 30 + (pending + 2 <= 6 ? (pending + 2) * 5 : 50);
    assert.equal(n.roundResult.points.p1, expected);
    assert.equal(n.players[1].score, expected);
    assert.equal(n.roundResult.points.p0, 0);
    assertReset(n);
  }
});

test('final Ace of Spades and final counter Ace force exactly five before scoring', () => {
  for (const ace of [c('A', 'spades'), c('A', 'hearts'), c('A', 'diamonds'), c('A', 'clubs')]) {
    const s = setup({ hands: [[ace], [c('2', 'clubs')]], top: c('9', 'spades'),
      extra: { pendingDraw: ace.id === 'AS' ? 0 : 5, pendingType: ace.id === 'AS' ? null : 'ace' } });
    s.drawPile = ['3', '4', '5', '6', '9'].map((rank) => c(rank, 'spades'));
    const n = E.playCard(frozen(s), { cardId: ace.id });
    assert.equal(n.players[1].hand.length, 6);
    assert.equal(n.roundResult.points.p1, 55);
    assert.equal(n.players[1].score, 55);
    assert.equal(n.roundResult.winnerId, 'p0');
    assertReset(n);
  }
});

test('terminal penalty reshuffles before scoring and never draws the top discard', () => {
  const s = setup({ hands: [[c('2', 'hearts')], [c('K', 'clubs')]], top: c('9', 'hearts') });
  s.drawPile = [];
  s.discardPile = [c('3', 'spades'), c('4', 'spades'), c('9', 'hearts')];
  const n = E.playCard(s, { cardId: '2H' }, seeded(4));
  assert.deepEqual(n.discardPile, [c('2', 'hearts')]);
  assert.equal(n.players[1].hand.length, 3);
  assert.equal(n.roundResult.points.p1, 20);
  assert.equal(n.players[1].hand.some((card) => card.id === '2H'), false);
});

test('Jack and 7H cannot bypass any penalty or skip in engine or highlighting', () => {
  for (const extra of [{ pendingDraw: 4, pendingType: 'two' }, { pendingDraw: 5, pendingType: 'ace' }, { pendingSkip: true }]) {
    const s = frozen(setup({ hands: [[c('7', 'hearts'), c('J', 'clubs'), c('3', 'hearts')], [c('4', 'clubs')]], top: c('9', 'hearts'), extra }));
    assert.deepEqual(getPlayableCards(s, 0), []);
    for (const cardId of ['7H', 'JC', '3H']) {
      const n = E.playCard(s, { cardId, chosenSuit: 'clubs' });
      assert.deepEqual(n, { ...s, lastEvent: { type: 'INVALID', reason: 'ILLEGAL_CARD' } });
    }
  }
});

test('all Aces including Ace of Spades counter an Ace penalty at a fixed five', () => {
  for (const suit of SUITS) {
    const s = setup({ hands: [[c('A', suit), c('3', 'clubs')], [c('4', 'clubs')]], top: c('A', 'spades'),
      extra: { pendingDraw: 5, pendingType: 'ace' } });
    const n = E.playCard(s, { cardId: c('A', suit).id });
    assert.equal(n.pendingDraw, 5);
    assert.equal(n.pendingType, 'ace');
    assert.equal(n.lastEvent.type, 'PLAY');
  }
});

test('starter uses last-round points even if cumulative leader or round winner differs', () => {
  const s = setup({ hands: [[c('3', 'clubs')], [c('4', 'clubs')], [c('5', 'clubs')]], top: c('9', 'hearts'),
    extra: { phase: 'roundOver', roundResult: { endedBy: 'p0', winnerId: 'p0', reason: 'SEVEN_OF_HEARTS', points: { p0: 100, p1: 5, p2: 10 }, eliminatedIds: [] } } });
  s.players[0].score = 100;
  s.players[1].score = 300;
  s.players[2].score = 10;
  assert.equal(E.nextRound(frozen(s), seeded()).currentPlayer, 1);
});

test('every Ace is rejected on opening; opening 8 rejection is retained but unverified', () => {
  for (const suit of SUITS) {
    for (const rank of ['A', '2', 'J']) assert.equal(R.isOpeningCard(c(rank, suit)), false);
    assert.equal(R.isOpeningCard(c('8', suit)), false, 'legacy opening-8 policy, not verified standard');
  }
  assert.equal(R.isOpeningCard(c('7', 'hearts')), false);
  assert.equal(R.isOpeningCard(c('7', 'clubs')), true);
  // Independent expectations avoid using the engine's opening predicate as oracle.
  for (let seed = 1; seed <= 200; seed++) {
    const n = E.createGame([{ name: 'A' }, { name: 'B' }], seeded(seed));
    assert.ok(!['A', '2', 'J', '8'].includes(n.discardPile[0].rank), `seed=${seed}`);
    assert.notEqual(n.discardPile[0].id, '7H', `seed=${seed}`);
  }
});

test('no-active cases terminate and preserve state with an INVALID event', () => {
  const s = setup({ hands: [[], []], top: c('9', 'hearts') });
  s.players.forEach((p) => { p.eliminated = true; });
  frozen(s);
  assert.equal(E.nextActive(s, 0), -1);
  for (const fn of [() => E.startRound(s), () => E.drawCard(s), () => E.passTurn(s), () => E.playCard(s, null)]) {
    assert.deepEqual(fn(), { ...s, lastEvent: { type: 'INVALID', reason: 'NO_ACTIVE_PLAYERS' } });
  }
  assert.equal(E.nextActive({ players: [] }, -1), -1);
  assert.equal(E.nextActive(null, 0), -1);
});

test('null/malformed play payloads and absent discards fail safely without mutation', () => {
  const s = frozen(setup({ hands: [[c('5', 'hearts')], [c('4', 'clubs')]], top: c('9', 'hearts') }));
  for (const action of [null, false, 3, 'bad', []]) {
    assert.deepEqual(E.playCard(s, action), { ...s, lastEvent: { type: 'INVALID', reason: 'INVALID_ACTION' } });
  }
  for (const discardPile of [undefined, []]) {
    const broken = { ...s, discardPile };
    for (const card of [c('7', 'hearts'), c('J', 'clubs'), c('5', 'hearts')]) assert.equal(R.isLegalPlay(broken, card), false);
    assert.equal(R.activeSuit(broken), null);
    assert.equal(E.playCard(broken, { cardId: '5H' }).lastEvent.reason, 'INVALID_STATE');
  }
  assert.equal(R.isLegalPlay(null, null), false);
  assert.equal(E.createGame(null).lastEvent.reason, 'INVALID_PLAYERS');
  assert.equal(E.createGame([null, {}]).lastEvent.reason, 'INVALID_PLAYERS');
  assert.equal(E.startRound(null).lastEvent.reason, 'INVALID_STATE');
});

test('an undealt pile with no legal opener reports INVALID instead of accepting a special', () => {
  const deck = createDeck();
  const special = deck.filter((card) => ['A', '2', 'J', '8'].includes(card.rank) || card.id === '7H');
  const first = special.slice(0, 10);
  const target = [...first, ...deck.filter((card) => !first.some((entry) => entry.id === card.id))];
  // Construct exact Fisher-Yates choices for a six-player deal leaving ten specials.
  const working = deck.slice();
  const choices = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.findIndex((card) => card.id === target[i].id);
    choices.push((j + 0.5) / (i + 1));
    [working[i], working[j]] = [working[j], working[i]];
  }
  const s = setup({ hands: Array.from({ length: 6 }, () => []), top: c('9', 'hearts'), extra: { phase: 'roundOver' } });
  const before = JSON.stringify(s);
  const n = E.startRound(s, () => choices.shift());
  assert.deepEqual(n, { ...s, lastEvent: { type: 'INVALID', reason: 'NO_OPENING_CARD' } });
  assert.equal(JSON.stringify(s), before);
});

test('malformed-state: nextActive skips null, sparse and malformed seats in normal turn order', () => {
  const [first, second, third] = E.createGame([{ name: 'A' }, { name: 'B' }, { name: 'C' }], seeded()).players;
  const eliminated = { ...third, eliminated: true };
  const state = { players: [null, first, undefined, {}, eliminated, second, false, 'seat', [], { eliminated: false }] };
  frozen(state);
  assert.equal(E.nextActive(state, -1), 1);
  assert.equal(E.nextActive(state, 1), 5);
  assert.equal(E.nextActive(state, 5), 1);
  assert.equal(E.nextActive(state, 0), 1);
  assert.equal(E.nextActive(state, 1, 2), 1);
  assert.equal(E.nextActive(state, 1, 3), 5);
  assert.equal(E.nextActive(state, 1, 0), 1);
  const sparse = { players: Array(4) };
  sparse.players[2] = first;
  assert.equal(E.nextActive(sparse, -1), 2);
  assert.equal(E.nextActive(sparse, 2), 2);
});

test('malformed-state: nextActive returns minus one when no valid active seat exists', () => {
  const player = E.createGame([{ name: 'A' }, { name: 'B' }], seeded()).players[0];
  const malformed = [null, undefined, false, 17, 'player', [], {}, { eliminated: false },
    { ...player, hand: null }, { ...player, id: null }, { ...player, eliminated: null },
    { ...player, name: null }, { ...player, isBot: null }, { ...player, score: NaN }];
  for (const players of [[], [null], Array(3), malformed, [...malformed, { ...player, eliminated: true }]]) {
    assert.equal(E.nextActive({ players }, -1), -1);
    assert.equal(E.nextActive({ players }, 0), -1);
    assert.equal(E.nextActive({ players }, 0, 10), -1);
  }
});

test('malformed-state: unknown pending types reject every card in rules, highlighting and engine', () => {
  for (const extra of [{ pendingType: null }, {}, { pendingType: 'unknown' }, { pendingType: '' },
    { pendingType: 2 }, { pendingType: {} }]) {
    const deck = createDeck();
    const s = setup({ hands: [deck.filter((card) => !['9H', '3C'].includes(card.id)), [c('3', 'clubs')]],
      top: c('9', 'hearts'), extra: { pendingDraw: 4, ...extra } });
    if (!('pendingType' in extra)) delete s.pendingType;
    s.drawPile = [];
    const before = JSON.stringify(s);
    frozen(s);
    for (const card of deck) assert.equal(R.isLegalPlay(s, card), false, `type=${JSON.stringify(extra)} card=${card.id}`);
    assert.deepEqual(getPlayableCards(s, 0), []);
    for (const card of s.players[0].hand) {
      assert.deepEqual(E.playCard(s, { cardId: card.id, chosenSuit: 'clubs' }),
        { ...s, lastEvent: { type: 'INVALID', reason: 'ILLEGAL_CARD' } }, `type=${JSON.stringify(extra)} card=${card.id}`);
    }
    assert.equal(JSON.stringify(s), before);
  }
});

test('turn validation: malformed current players return INVALID_STATE for play, draw and pass', () => {
  const base = setup({ hands: [[c('8', 'hearts'), c('3', 'clubs')], [c('4', 'clubs')]], top: c('9', 'hearts') });
  const player = base.players[0];
  const malformed = [null, undefined, [], {}, false, 42, 'player',
    { ...player, id: '' }, { ...player, id: null }, { ...player, id: 0 },
    { ...player, name: null }, { ...player, name: 0 },
    { ...player, isBot: null }, { ...player, isBot: 'false' },
    { ...player, hand: null }, { ...player, hand: {} },
    { ...player, score: NaN }, { ...player, score: Infinity },
    { ...player, score: -Infinity }, { ...player, score: '0' },
    { ...player, eliminated: true }, { ...player, eliminated: null },
    { ...player, eliminated: 0 }];
  for (const field of ['id', 'name', 'isBot', 'hand', 'score', 'eliminated']) {
    const missing = { ...player };
    delete missing[field];
    malformed.push(missing);
  }
  const actions = [
    ['play', (state) => E.playCard(state, { cardId: '8H' })],
    ['draw', (state) => E.drawCard(state, seeded())],
    ['pass', (state) => E.passTurn(state)],
  ];
  for (const [index, record] of malformed.entries()) {
    for (const [name, action] of actions) {
      const state = { ...base, players: [record, base.players[1]], pendingSkip: name === 'pass' };
      // Keep another valid active seat so this checks current-seat validation,
      // preserving the existing NO_ACTIVE_PLAYERS precedence separately.
      const before = structuredClone(state);
      frozen(state);
      let result;
      assert.doesNotThrow(() => { result = action(state); }, `${name}, record=${index}`);
      assert.deepEqual(result, { ...state, lastEvent: { type: 'INVALID', reason: 'INVALID_STATE' } }, `${name}, record=${index}`);
      assert.deepEqual(state, before, `${name} mutated input, record=${index}`);
    }
  }
});

test('turn validation: complete valid current players still play, draw and accept skips', () => {
  const state = setup({ hands: [[c('8', 'hearts'), c('3', 'clubs')], [c('4', 'clubs')]], top: c('9', 'hearts') });
  state.drawPile = [c('5', 'spades')];
  frozen(state);
  const played = E.playCard(state, { cardId: '8H' });
  assert.equal(played.lastEvent.type, 'PLAY');
  assert.equal(played.players[0].hand.length, 1);
  const drawn = E.drawCard(state);
  assert.equal(drawn.lastEvent.type, 'DRAW');
  assert.equal(drawn.players[0].hand.length, 3);
  assert.equal(drawn.currentPlayer, 1);
  const passed = E.passTurn(frozen({ ...state, pendingSkip: true }));
  assert.deepEqual(passed.lastEvent, { type: 'SKIP', playerId: 'p0' });
  assert.equal(passed.pendingSkip, false);
  assert.equal(passed.currentPlayer, 1);
});
