const test = require('node:test');
const assert = require('node:assert/strict');
const { gameReducer } = require('../src/state/gameReducer');
const { scheduleBotTurn } = require('../src/hooks/scheduleBotTurn');
const { createActionGuard } = require('../src/state/actionGuard');
const c = (rank, suit) => ({ id: `${rank}-${suit}`, rank, suit });
const fresh = () => gameReducer(null, { type: 'START_GAME', players: [
  { name: 'Nawal' }, { name: 'Bot 1', isBot: true }, { name: 'Bot 2', isBot: true },
] });

function clock() {
  let callback;
  let cleared = false;
  return {
    schedule(fn, delay) { assert.equal(delay, 900); callback = fn; return 123; },
    cancel(id) { assert.equal(id, 123); cleared = true; },
    fire() { callback(); },
    get cleared() { return cleared; },
  };
}

test('rapid human actions share a cooldown across renders and action types', () => {
  let time = 0;
  const allow = createActionGuard(() => time);
  assert.equal(allow(), true);
  time = 100;
  assert.equal(allow(), false);
  time = 349;
  assert.equal(allow(), false);
  time = 350;
  assert.equal(allow(), true);
});

test('queued duplicate card and Draw actions cannot affect the following state', () => {
  for (const type of ['PLAY_CARD', 'DRAW']) {
    const state = fresh();
    state.players[0].hand = [c('5', 'hearts'), c('6', 'clubs')];
    state.discardPile = [c('9', 'hearts')];
    state.drawPile = [c('4', 'clubs')];
    const action = { type, cardId: '5-hearts', expectedState: state };
    const next = gameReducer(state, action);
    assert.notEqual(next, state);
    assert.notEqual(next.lastEvent.type, 'INVALID');
    assert.equal(gameReducer(next, action), next);
  }
});

test('bot scheduling is one-shot and cleanup cancels even an already queued callback', () => {
  const state = fresh();
  state.currentPlayer = 1;
  const timer = clock();
  const actions = [];
  const cleanup = scheduleBotTurn(state, (action) => actions.push(action), timer.schedule, timer.cancel);
  timer.fire();
  timer.fire();
  assert.equal(actions.length, 1);
  cleanup();
  assert.equal(timer.cleared, true);
  const cancelled = clock();
  const stop = scheduleBotTurn(state, (action) => actions.push(action), cancelled.schedule, cancelled.cancel);
  stop();
  cancelled.fire();
  assert.equal(actions.length, 1);
});

test('bot timers are not scheduled for humans or ended games', () => {
  const state = fresh();
  const never = () => assert.fail('timer must not be scheduled');
  scheduleBotTurn(null, never, never);
  scheduleBotTurn(state, never, never);
  state.currentPlayer = 1;
  for (const phase of ['roundOver', 'gameOver']) {
    state.phase = phase;
    scheduleBotTurn(state, never, never);
  }
});

test('Restart and Next Round reject stale bot callbacks even before effect cleanup', () => {
  for (const type of ['RESTART', 'NEXT_ROUND']) {
    const state = fresh();
    state.currentPlayer = 1;
    const timer = clock();
    let current = state;
    const stop = scheduleBotTurn(state, (action) => {
      current = gameReducer(current, action);
    }, timer.schedule, timer.cancel);
    if (type === 'NEXT_ROUND') current = { ...state, phase: 'roundOver' };
    current = gameReducer(current, { type });
    const replaced = current;
    timer.fire();
    assert.equal(current, replaced);
    stop();
    assert.equal(timer.cleared, true);
  }
});

test('Restart fully resets mid-round and both end-screen actions start playable games', () => {
  for (const phase of ['playing', 'roundOver', 'gameOver']) {
    for (const type of phase === 'playing' ? ['RESTART'] : ['RESTART', 'NEXT_ROUND']) {
      const state = fresh();
      state.phase = phase;
      state.players[0].score = 510;
      state.players[0].eliminated = true;
      state.pendingDraw = 6;
      state.pendingType = 'two';
      state.pendingSkip = true;
      state.chosenSuit = 'clubs';
      state.chosenRank = 'A';
      state.winnerId = phase === 'gameOver' ? 'p1' : null;
      const next = gameReducer(state, { type });
      assert.equal(next.phase, 'playing');
      assert.equal(next.pendingDraw, 0);
      assert.equal(next.chosenSuit, null);
      assert.equal(next.pendingType, null);
      assert.equal(next.pendingSkip, false);
      assert.equal(next.chosenRank, null);
      assert.equal('drawnCardId' in next, false);
      assert.equal(next.roundResult, null);
      if (type === 'RESTART' || phase === 'gameOver') {
        assert.equal(next.round, 1);
        assert.equal(next.winnerId, null);
        next.players.forEach((p) => {
          assert.equal(p.score, 0);
          assert.equal(p.eliminated, false);
          assert.equal(p.hand.length, 7);
        });
        const deck = [...next.drawPile, ...next.discardPile, ...next.players.flatMap((p) => p.hand)];
        assert.equal(new Set(deck.map((card) => card.id)).size, 52);
      } else {
        assert.equal(next.round, state.round + 1);
        assert.equal(next.players[0].score, 510);
        assert.equal(next.players[0].hand.length, 0);
      }
    }
  }
});

test('human elimination leaves two bots able to start and play the next round', () => {
  let state = fresh();
  state.currentPlayer = 1;
  state.players[0].score = 500;
  state.players[0].hand = [c('K', 'clubs')];
  state.players[1].hand = [c('7', 'hearts')];
  state.players[2].hand = [c('3', 'clubs')];
  state.discardPile = [c('9', 'hearts')];
  state = gameReducer(state, { type: 'PLAY_CARD', cardId: '7-hearts' });
  assert.equal(state.players[0].eliminated, true);
  assert.equal(state.phase, 'roundOver');
  state = gameReducer(state, { type: 'NEXT_ROUND' });
  assert.equal(state.players[state.currentPlayer].isBot, true);
  const timer = clock();
  const before = state;
  scheduleBotTurn(state, (action) => { state = gameReducer(state, action); }, timer.schedule, timer.cancel);
  timer.fire();
  assert.notEqual(state, before);
  assert.notEqual(state.lastEvent.type, 'INVALID');
  assert.notEqual(state.currentPlayer, 0);
});

test('a duplicate 8 cannot play twice even when the same player keeps the turn', () => {
  const state = gameReducer(null, { type: 'START_GAME', players: [{ name: 'Nawal' }, { name: 'Bot', isBot: true }] });
  state.players[0].hand = [c('8', 'hearts'), c('8', 'clubs'), c('3', 'clubs')];
  state.players[1].hand = [c('4', 'clubs')];
  state.discardPile = [c('9', 'hearts')];
  const next = gameReducer(state, { type: 'PLAY_CARD', cardId: '8-hearts', expectedState: state });
  assert.equal(next.currentPlayer, 0);
  assert.equal(next.players[0].hand.length, 2);
  assert.equal(gameReducer(next, { type: 'PLAY_CARD', cardId: '8-clubs', expectedState: state }), next);
});

test('Restart cancels the old timer and allows exactly one fresh bot move', () => {
  let state = fresh();
  state.currentPlayer = 1;
  const oldTimer = clock();
  let dispatches = 0;
  const dispatch = (action) => { dispatches++; state = gameReducer(state, action); };
  const cleanup = scheduleBotTurn(state, dispatch, oldTimer.schedule, oldTimer.cancel);
  state = gameReducer(state, { type: 'RESTART' });
  cleanup();
  const restarted = state;
  oldTimer.fire();
  assert.equal(dispatches, 0);
  assert.equal(state, restarted);
  assert.equal(state.currentPlayer, 0);
  state.players[0].hand = [c('5', 'hearts'), c('3', 'clubs')];
  state.discardPile = [c('9', 'hearts')];
  state = gameReducer(state, { type: 'PLAY_CARD', cardId: '5-hearts' });
  assert.equal(state.players[state.currentPlayer].isBot, true);
  const newTimer = clock();
  const stop = scheduleBotTurn(state, dispatch, newTimer.schedule, newTimer.cancel);
  newTimer.fire();
  newTimer.fire();
  assert.equal(dispatches, 1);
  assert.notEqual(state.lastEvent.type, 'INVALID');
  stop();
});

test('a scheduled bot can accept a skip and advance to the next active player', () => {
  let state = fresh();
  state.currentPlayer = 1;
  state.pendingSkip = true;
  state.players[1].hand = [c('K', 'clubs')];
  const timer = clock();
  scheduleBotTurn(state, (action) => {
    assert.equal(action.type, 'PASS');
    state = gameReducer(state, action);
  }, timer.schedule, timer.cancel);
  timer.fire();
  assert.equal(state.pendingSkip, false);
  assert.equal(state.currentPlayer, 2);
  assert.deepEqual(state.lastEvent, { type: 'SKIP', playerId: 'p1' });
});
