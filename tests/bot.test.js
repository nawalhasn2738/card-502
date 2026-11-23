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
function setup(hand, top = c('9', 'hearts')) {
  const state = E.createGame([{ name: 'A' }, { name: 'B' }, { name: 'C' }], seeded(1));
  state.players[0].hand = hand;
  state.players[1].hand = [c('3', 'clubs')];
  state.discardPile = [top];
  return state;
}

test('bot makes only legal moves through 200 seeded bot rounds without mutating state', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = seeded(seed);
    const players = Array.from({ length: 2 + seed % 5 }, (_, i) => ({ name: `Bot ${i}`, isBot: true }));
    let state = E.createGame(players, rng);
    let moves = 0;
    while (state.phase === 'playing' && moves < 10000) {
      const before = JSON.stringify(state);
      const action = chooseBotMove(state);
      assert.equal(JSON.stringify(state), before, `mutation in seed ${seed}`);
      assert.deepEqual(chooseBotMove(state), action);
      const playable = getPlayableCards(state, state.currentPlayer);
      if (action.type === 'PLAY_CARD') {
        const card = playable.find((entry) => entry.id === action.cardId);
        assert.ok(card, `illegal card in seed ${seed}`);
        if (state.drawnCardId) assert.equal(action.cardId, state.drawnCardId);
        if (card.rank === 'J') assert.ok(SUITS.includes(action.chosenSuit));
        state = E.playCard(state, action, rng);
      } else {
        assert.deepEqual(action, { type: 'DRAW' });
        assert.equal(playable.length, 0);
        assert.equal(state.drawnCardId, null);
        state = E.drawCard(state, rng);
      }
      assert.notEqual(state.lastEvent.type, 'INVALID', `invalid action in seed ${seed}`);
      moves++;
    }
    assert.notEqual(state.phase, 'playing', `round did not finish in seed ${seed}`);
    assert.ok(state.roundResult.winnerId);
  }
});

test('500 seeded full bot games finish within 5000 moves with exactly one winner', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const playerCount = 2 + (seed - 1) % 5;
    const context = `seed=${seed}, players=${playerCount}`;
    try {
      const rng = seeded(seed);
      const players = Array.from({ length: playerCount }, (_, i) => ({
        name: `Bot ${i}`, isBot: true,
      }));
      let state = E.createGame(players, rng);
      let moves = 0;
      // Count round transitions too, so the limit bounds the entire simulation.
      while (state.phase !== 'gameOver' && moves < 5000) {
        const action = state.phase === 'roundOver'
          ? { type: 'NEXT_ROUND' }
          : chooseBotMove(state);
        switch (action.type) {
          case 'NEXT_ROUND': state = E.nextRound(state, rng); break;
          case 'PLAY_CARD': state = E.playCard(state, action, rng); break;
          case 'DRAW': state = E.drawCard(state, rng); break;
          case 'PASS': state = E.passTurn(state); break;
          default: assert.fail(`Unexpected action: ${JSON.stringify(action)}`);
        }
        moves++;
        assert.notEqual(state.lastEvent.type, 'INVALID',
          `${context}, move=${moves}, action=${JSON.stringify(action)}, event=${JSON.stringify(state.lastEvent)}`);
      }
      assert.equal(state.phase, 'gameOver', `${context}: exceeded 5000 moves`);
      const survivors = state.players.filter((player) => !player.eliminated);
      assert.equal(survivors.length, 1, `${context}: expected exactly one surviving winner`);
      assert.equal(state.winnerId, survivors[0].id, `${context}: winner must be the sole survivor`);
      assert.equal(state.players.filter((player) => player.id === state.winnerId).length, 1,
        `${context}: winner must identify exactly one player`);
    } catch (error) {
      error.message = `${context}: ${error.message}`;
      throw error;
    }
  }
});

test('bot prioritizes the playable 7 of hearts over specials and high cards', () => {
  const state = setup([c('K', 'hearts'), c('2', 'hearts'), c('7', 'hearts')]);
  assert.deepEqual(chooseBotMove(state), { type: 'PLAY_CARD', cardId: '7-hearts' });
});

test('bot draws when stuck, including when a draw penalty cannot be stacked', () => {
  const state = setup([c('K', 'clubs')]);
  assert.deepEqual(chooseBotMove(state), { type: 'DRAW' });
  state.players[0].hand = [c('A', 'spades')];
  state.pendingDraw = 2;
  assert.deepEqual(chooseBotMove(state), { type: 'DRAW' });
});

test('bot always plays the waiting drawn card ahead of other priorities', () => {
  const state = setup([c('7', 'hearts'), c('3', 'hearts')]);
  state.drawnCardId = '3-hearts';
  assert.deepEqual(chooseBotMove(state), { type: 'PLAY_CARD', cardId: '3-hearts' });
});

test('Jack chooses the most held suit excluding itself, with table suit as fallback', () => {
  const state = setup([c('J', 'hearts'), c('3', 'clubs'), c('4', 'clubs'), c('5', 'hearts')]);
  assert.deepEqual(chooseBotMove(state), { type: 'PLAY_CARD', cardId: 'J-hearts', chosenSuit: 'clubs' });
  state.players[0].hand = [c('J', 'clubs')];
  state.discardPile = [c('J', 'diamonds')];
  assert.equal(chooseBotMove(state).chosenSuit, 'diamonds');
  state.players[0].hand = [c('J', 'clubs'), c('3', 'hearts'), c('4', 'diamonds')];
  assert.equal(chooseBotMove(state).chosenSuit, 'diamonds');
});

test('bot prefers each disruptive special against a short next active hand', () => {
  for (const special of [c('2', 'spades'), c('8', 'spades'), c('A', 'spades')]) {
    const state = setup([c('K', 'spades'), special], c('9', 'spades'));
    assert.equal(chooseBotMove(state).cardId, special.id);
  }
});

test('bot skips eliminated seats, wraps around, and otherwise sheds the most points', () => {
  const state = setup([c('2', 'hearts'), c('K', 'hearts')]);
  state.players[1].eliminated = true;
  state.players[1].hand = [];
  state.players[2].hand = [c('3', 'clubs')];
  assert.equal(chooseBotMove(state).cardId, '2-hearts');
  state.players[2].hand = [c('3', 'clubs'), c('4', 'clubs'), c('5', 'clubs'), c('6', 'clubs')];
  assert.equal(chooseBotMove(state).cardId, 'K-hearts');
  state.currentPlayer = 2;
  state.players[2].hand = [c('2', 'hearts'), c('K', 'hearts')];
  assert.equal(chooseBotMove(state).cardId, '2-hearts');
  state.players[2].hand = [c('K', 'spades'), c('A', 'spades')];
  state.players[0].hand = Array(4).fill(c('3', 'clubs'));
  state.discardPile = [c('9', 'spades')];
  assert.equal(chooseBotMove(state).cardId, 'A-spades');
});
