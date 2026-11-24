const test = require('node:test');
const assert = require('node:assert/strict');
const { chooseBotMove } = require('../src/logic/bot');
const E = require('../src/logic/engine');
const { getPlayableCards } = require('../src/logic/rules');
const { SUITS } = require('../src/logic/constants');

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const c = (rank, suit) => ({ id: `${rank}-${suit}`, rank, suit });
function setup(hand, extra = {}) {
  const state = E.createGame([{ name: 'A' }, { name: 'B' }, { name: 'C' }], seeded(1));
  state.players[0].hand = hand;
  state.players[1].hand = [c('3', 'clubs'), c('4', 'clubs'), c('5', 'clubs'), c('6', 'clubs')];
  state.discardPile = [c('9', 'hearts')];
  return Object.assign(state, extra);
}
const play = (cardId) => ({ type: 'PLAY_CARD', cardId });

test('bot draws when stuck', () => {
  assert.deepEqual(chooseBotMove(setup([c('K', 'clubs')])), { type: 'DRAW' });
});

test('bot counters pending 2s with the first 2, or draws without one', () => {
  const extra = { pendingDraw: 4, pendingType: 'two' };
  assert.deepEqual(chooseBotMove(setup([c('A', 'spades'), c('2', 'clubs'), c('2', 'hearts')], extra)), play('2-clubs'));
  assert.deepEqual(chooseBotMove(setup([c('A', 'spades'), c('J', 'clubs')], extra)), { type: 'DRAW' });
});

test('bot counters an Ace penalty with the first Ace, not the highest-value Ace', () => {
  const state = setup([c('A', 'clubs'), c('A', 'spades'), c('2', 'hearts')], { pendingDraw: 5, pendingType: 'ace' });
  assert.deepEqual(chooseBotMove(state), play('A-clubs'));
});

test('bot sheds the highest-point playable card and keeps hand order on ties', () => {
  const state = setup([c('K', 'hearts'), c('2', 'hearts'), c('8', 'hearts')]);
  assert.deepEqual(chooseBotMove(state), play('2-hearts'));
  state.discardPile = [c('9', 'spades')];
  state.players[0].hand = [c('K', 'spades'), c('A', 'spades')];
  assert.deepEqual(chooseBotMove(state), play('A-spades'));
});

test('bot threatens a short next active hand, skipping eliminated seats and wrapping', () => {
  const state = setup([c('J', 'clubs'), c('8', 'hearts')]);
  state.players[1].eliminated = true;
  state.players[1].hand = [];
  state.players[2].hand = [c('3', 'clubs')];
  assert.deepEqual(chooseBotMove(state), play('8-hearts'));
  state.currentPlayer = 2;
  state.players[2].hand = [c('J', 'clubs'), c('8', 'hearts')];
  assert.deepEqual(chooseBotMove(state), play('8-hearts'));
});

test('Jack demands only the majority suit excluding itself; empty hand uses table suit', () => {
  const state = setup([c('J', 'hearts'), c('3', 'clubs'), c('4', 'clubs'), c('5', 'hearts')]);
  assert.deepEqual(chooseBotMove(state), { ...play('J-hearts'), chosenSuit: 'clubs' });
  state.players[0].hand = [c('J', 'clubs')];
  assert.deepEqual(chooseBotMove(state), { ...play('J-clubs'), chosenSuit: 'hearts' });
});

test('7 of hearts is played only when it is the sole legal option and leftovers total at most 20', () => {
  for (const hand of [[c('7', 'hearts')], [c('7', 'hearts'), c('A', 'clubs')]]) {
    assert.deepEqual(chooseBotMove(setup(hand)), play('7-hearts'));
  }
  assert.deepEqual(chooseBotMove(setup([c('7', 'hearts'), c('A', 'clubs'), c('3', 'clubs')])), { type: 'DRAW' });
  assert.deepEqual(chooseBotMove(setup([c('7', 'hearts'), c('3', 'hearts')])), play('3-hearts'));
  assert.deepEqual(chooseBotMove(setup([c('7', 'hearts'), c('2', 'clubs')], { pendingDraw: 2, pendingType: 'two' })), play('2-clubs'));
});

test('pending skip plays the first 8; without a chosen card the bot accepts the skip', () => {
  assert.deepEqual(chooseBotMove(setup([c('7', 'hearts'), c('8', 'clubs'), c('8', 'spades')], { pendingSkip: true })), play('8-clubs'));
  assert.deepEqual(chooseBotMove(setup([c('7', 'hearts'), c('A', 'spades')], { pendingSkip: true })), { type: 'PASS' });
  assert.deepEqual(chooseBotMove(setup([c('K', 'clubs')], { pendingSkip: true })), { type: 'PASS' });
});

test('500 seeded full bot games finish within 20000 moves with legal actions and one winner', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const count = 2 + (seed - 1) % 5;
    let moves = 0;
    try {
      const rng = seeded(seed);
      let state = E.createGame(Array.from({ length: count }, (_, i) => ({ name: `Bot ${i}`, isBot: true })), rng);
      while (state.phase !== 'gameOver' && moves < 20000) {
        const previous = state;
        const before = JSON.stringify(state);
        const action = state.phase === 'roundOver' ? { type: 'NEXT_ROUND' } : chooseBotMove(state);
        assert.equal(JSON.stringify(state), before, 'bot mutated input state');
        if (action.type === 'PLAY_CARD') {
          const card = getPlayableCards(state, state.currentPlayer).find((entry) => entry.id === action.cardId);
          assert.ok(card, 'bot selected an illegal card');
          // Independent reference constraints, not just the shared rules helper.
          if (previous.pendingDraw > 0) {
            assert.equal(card.rank, previous.pendingType === 'two' ? '2' : 'A');
          } else if (previous.pendingSkip) assert.equal(card.rank, '8');
          if (card.rank === 'J') {
            assert.ok(SUITS.includes(action.chosenSuit));
            assert.equal('chosenRank' in action, false);
          }
        }
        switch (action.type) {
          case 'NEXT_ROUND': state = E.nextRound(state, rng); break;
          case 'PLAY_CARD': state = E.playCard(state, action, rng); break;
          case 'DRAW': state = E.drawCard(state, rng); break;
          case 'PASS': state = E.passTurn(state); break;
          default: assert.fail(`Unexpected action ${JSON.stringify(action)}`);
        }
        moves++;
        assert.notEqual(state.lastEvent.type, 'INVALID', `${JSON.stringify(action)}: ${JSON.stringify(state.lastEvent)}`);
        const allCards = [...state.drawPile, ...state.discardPile, ...state.players.flatMap((p) => p.hand)];
        assert.equal(allCards.length, 52, 'card conservation');
        assert.equal(new Set(allCards.map((card) => card.id)).size, 52, 'unique cards');
        if (state.pendingType === 'ace') assert.equal(state.pendingDraw, 5, 'Aces never stack');
        if (state.lastEvent.type === 'ROUND_END') {
          const finisher = previous.players[previous.currentPlayer];
          assert.equal(state.roundResult.winnerId, finisher.id);
          assert.equal(state.players[previous.currentPlayer].eliminated, false, 'round winner is protected');
          for (const player of state.players) {
            const old = previous.players.find((p) => p.id === player.id);
            if (old.eliminated) { assert.equal(player.score, old.score); continue; }
            const points = player.hand.reduce((sum, card) => {
              const special100 = (card.rank === '7' && card.suit === 'hearts') || (card.rank === 'A' && card.suit === 'spades');
              return sum + (special100 ? 100 : ['2', '8', 'J'].includes(card.rank) ? 30
                : card.rank === 'A' ? 20 : ['10', 'Q', 'K'].includes(card.rank) ? 10 : 5);
            }, 0);
            assert.equal(state.roundResult.points[player.id], points, 'independent hand scoring');
            assert.equal(player.score, old.score + points);
          }
          const played = finisher.hand.find((card) => card.id === action.cardId);
          const penalty = played.rank === '2' ? previous.pendingDraw + 2
            : played.rank === 'A' && (played.suit === 'spades' || previous.pendingType === 'ace') ? 5 : 0;
          if (finisher.hand.length === 1 && penalty) {
            let victim = (previous.currentPlayer + 1) % previous.players.length;
            while (previous.players[victim].eliminated) victim = (victim + 1) % previous.players.length;
            assert.equal(state.players[victim].hand.length,
              previous.players[victim].hand.length + Math.min(penalty, previous.drawPile.length + previous.discardPile.length),
              'mandatory final penalty before scoring');
          }
        }
        if (action.type === 'NEXT_ROUND') {
          const active = previous.players.map((p, index) => ({ ...p, index })).filter((p) => !p.eliminated);
          const expected = active.reduce((best, p) => previous.roundResult.points[p.id] < previous.roundResult.points[best.id] ? p : best);
          assert.equal(state.currentPlayer, expected.index, 'starter uses previous-round points');
        }
      }
      assert.equal(state.phase, 'gameOver', 'game exceeded 20000 moves');
      const survivors = state.players.filter((player) => !player.eliminated);
      assert.equal(survivors.length, 1, 'expected exactly one survivor');
      assert.ok(state.winnerId, 'winnerId must be set');
      assert.equal(state.winnerId, survivors[0].id, 'winner must be the sole survivor');
    } catch (error) {
      error.message = `seed=${seed}, players=${count}, moves=${moves}: ${error.message}`;
      throw error;
    }
  }
});

test('bot never selects Jack or 7H to cancel a draw penalty or skip', () => {
  for (const extra of [{ pendingDraw: 4, pendingType: 'two' }, { pendingDraw: 5, pendingType: 'ace' }, { pendingSkip: true }]) {
    // Small leftovers used to make 7H attractive even under the bot threshold.
    const seven = setup([c('7', 'hearts'), c('3', 'clubs')], extra);
    const jack = setup([c('J', 'hearts'), c('3', 'clubs')], extra);
    const expected = { type: extra.pendingSkip ? 'PASS' : 'DRAW' };
    assert.deepEqual(chooseBotMove(seven), expected);
    assert.deepEqual(chooseBotMove(jack), expected);
  }
});
