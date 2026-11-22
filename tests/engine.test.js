// Run with:  node --test tests/engine.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDeck } = require('../src/logic/deck');
const { handPoints } = require('../src/logic/scoring');
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
  const d = createDeck();
  assert.equal(d.length, 52);
  assert.equal(new Set(d.map((x) => x.id)).size, 52);
});

test('new game deals 7 each and the first table card is not special', () => {
  const s = E.createGame([{ name: 'A' }, { name: 'B' }, { name: 'C' }], seeded());
  s.players.forEach((p) => assert.equal(p.hand.length, 7));
  assert.equal(s.drawPile.length, 52 - 21 - 1);
  const top = s.discardPile[0];
  assert.ok(!['2', '8', 'J'].includes(top.rank));
});

test('legal move: match suit or rank, otherwise illegal', () => {
  const s = setup({ hands: [[c('5', 'hearts'), c('9', 'clubs'), c('K', 'spades')], [c('3', 'clubs')]], top: c('9', 'hearts') });
  const ids = getPlayableCards(s, 0).map((x) => x.id);
  assert.deepEqual(ids.sort(), ['5H', '9C']);
  assert.equal(E.playCard(s, { cardId: 'KS' }).lastEvent.reason, 'ILLEGAL_CARD');
});

test('playing a normal card advances the turn', () => {
  const s = setup({ hands: [[c('5', 'hearts'), c('6', 'clubs')], [c('3', 'clubs')], [c('4', 'clubs')]], top: c('9', 'hearts') });
  const n = E.playCard(s, { cardId: '5H' });
  assert.equal(n.currentPlayer, 1);
  assert.equal(n.discardPile.at(-1).id, '5H');
});

test('a 2 gives a 2-card penalty, 2s stack, and the victim draws it all', () => {
  const s = setup({ hands: [[c('2', 'hearts'), c('9', 'clubs')], [c('2', 'clubs'), c('4', 'spades')], [c('7', 'clubs')]], top: c('9', 'hearts') });
  let n = E.playCard(s, { cardId: '2H' });
  assert.equal(n.pendingDraw, 2);
  assert.equal(E.playCard(n, { cardId: '4S' }).lastEvent.reason, 'ILLEGAL_CARD'); // only a 2 can answer
  n = E.playCard(n, { cardId: '2C' });
  assert.equal(n.pendingDraw, 4);
  const before = n.players[2].hand.length;
  n = E.drawCard(n);
  assert.equal(n.players[2].hand.length, before + 4);
  assert.equal(n.pendingDraw, 0);
  assert.equal(n.currentPlayer, 0);
});

test('Ace of Spades forces a 5-card draw', () => {
  const s = setup({ hands: [[c('A', 'spades'), c('9', 'clubs')], [c('3', 'clubs')]], top: c('4', 'spades') });
  let n = E.playCard(s, { cardId: 'AS' });
  assert.equal(n.pendingDraw, 5);
  n = E.drawCard(n);
  assert.equal(n.players[1].hand.length, 6);
});

test('an 8 skips the next player (and in a 2-player game plays again)', () => {
  const three = setup({ hands: [[c('8', 'hearts'), c('9', 'clubs')], [c('3', 'clubs')], [c('4', 'clubs')]], top: c('9', 'hearts') });
  assert.equal(E.playCard(three, { cardId: '8H' }).currentPlayer, 2);
  const two = setup({ hands: [[c('8', 'hearts'), c('9', 'clubs')], [c('3', 'clubs')]], top: c('9', 'hearts') });
  assert.equal(E.playCard(two, { cardId: '8H' }).currentPlayer, 0);
});

test('Jack needs a suit; the chosen suit must then be matched', () => {
  const s = setup({ hands: [[c('J', 'hearts'), c('9', 'clubs')], [c('5', 'diamonds'), c('6', 'clubs')]], top: c('9', 'hearts') });
  assert.equal(E.playCard(s, { cardId: 'JH' }).lastEvent.reason, 'JACK_NEEDS_SUIT');
  const n = E.playCard(s, { cardId: 'JH', chosenSuit: 'diamonds' });
  assert.equal(n.chosenSuit, 'diamonds');
  assert.deepEqual(getPlayableCards(n, 1).map((x) => x.id), ['5D']);
});

test('7 of Hearts wins the round instantly and others score their hands', () => {
  const s = setup({ hands: [[c('7', 'hearts'), c('9', 'clubs')], [c('A', 'spades'), c('K', 'clubs')], [c('5', 'clubs')]], top: c('9', 'hearts') });
  const n = E.playCard(s, { cardId: '7H' });
  assert.equal(n.phase, 'roundOver');
  assert.equal(n.roundResult.reason, 'SEVEN_OF_HEARTS');
  assert.equal(n.players[1].score, handPoints([c('A', 'spades'), c('K', 'clubs')]));
  assert.equal(n.players[0].score, 0);
});

test('emptying your hand ends the round', () => {
  const s = setup({ hands: [[c('5', 'hearts')], [c('3', 'clubs')]], top: c('9', 'hearts') });
  const n = E.playCard(s, { cardId: '5H' });
  assert.equal(n.roundResult.reason, 'EMPTY_HAND');
});

test('reaching 502 eliminates a player; last player left wins the game', () => {
  const s = setup({ hands: [[c('5', 'hearts')], [c('K', 'clubs')]], top: c('9', 'hearts') });
  s.players[1].score = 500;
  const n = E.playCard(s, { cardId: '5H' });
  assert.ok(n.players[1].eliminated);
  assert.equal(n.phase, 'gameOver');
  assert.equal(n.winnerId, 'p0');
});

test('next round re-deals, skips eliminated players; restart resets everything', () => {
  const s = setup({ hands: [[c('5', 'hearts')], [c('K', 'clubs')], [c('3', 'clubs')]], top: c('9', 'hearts') });
  s.players[1].score = 500;
  const over = E.playCard(s, { cardId: '5H' });
  assert.equal(over.phase, 'roundOver');
  const next = E.nextRound(over, seeded(5));
  assert.equal(next.phase, 'playing');
  assert.equal(next.players[1].hand.length, 0);
  assert.equal(next.players[0].hand.length, 7);
  assert.notEqual(next.currentPlayer, 1);
  const fresh = E.restartGame(next, seeded(9));
  assert.deepEqual(fresh.players.map((p) => p.score), [0, 0, 0]);
  assert.equal(fresh.round, 1);
});

test('drawing a playable card lets you play it or pass; unplayable ends the turn', () => {
  const s = setup({ hands: [[c('9', 'clubs')], [c('3', 'clubs')]], top: c('9', 'hearts') });
  s.drawPile = [c('4', 'diamonds'), c('6', 'hearts')]; // last element is drawn first
  let n = E.drawCard(s);                       // draws 6H, playable by suit
  assert.equal(n.drawnCardId, '6H');
  assert.equal(n.currentPlayer, 0);
  assert.equal(E.drawCard(n).lastEvent.reason, 'ALREADY_DRAWN');
  assert.equal(E.playCard(n, { cardId: '9C' }).lastEvent.reason, 'ONLY_DRAWN_CARD'); // 9C would match by rank
  n = E.passTurn(n);
  assert.equal(n.currentPlayer, 1);
  const m = E.drawCard({ ...s, drawPile: [c('4', 'diamonds')] }); // 4D not playable
  assert.equal(m.currentPlayer, 1);
});

test('empty draw pile reshuffles the discard pile but keeps the top card', () => {
  const s = setup({ hands: [[c('9', 'clubs')], [c('3', 'clubs')]], top: c('9', 'hearts') });
  s.drawPile = [];
  s.discardPile = [c('2', 'clubs'), c('3', 'diamonds'), c('4', 'spades'), c('9', 'hearts')];
  const n = E.drawCard(s, seeded());
  assert.equal(n.discardPile.length, 1);
  assert.equal(n.discardPile[0].id, '9H');
  assert.equal(n.players[0].hand.length, 2);
  assert.equal(n.drawPile.length, 2);
});

test('invalid actions never crash and never change the game', () => {
  const s = setup({ hands: [[c('5', 'hearts')], [c('3', 'clubs')]], top: c('9', 'hearts') });
  assert.equal(E.playCard(s, { cardId: 'ZZ' }).lastEvent.reason, 'CARD_NOT_IN_HAND');
  assert.equal(E.passTurn(s).lastEvent.reason, 'MUST_DRAW_FIRST');
  assert.equal(E.nextRound(s).lastEvent.reason, 'ROUND_NOT_OVER');
  assert.throws(() => E.createGame([{ name: 'solo' }]));
});