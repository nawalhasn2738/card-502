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
      assert.equal('chosenRank' in next, false);
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

test('null and malformed reducer actions preserve the game and report INVALID', () => {
  const state = fresh();
  const before = JSON.stringify(state);
  for (const action of [null, undefined, false, 42, 'DRAW', [], {}, { type: 2 }]) {
    assert.deepEqual(gameReducer(state, action), { ...state, lastEvent: { type: 'INVALID', reason: 'INVALID_ACTION' } });
  }
  for (const players of [undefined, null, [], [null, {}], [{ name: 'Only' }]]) {
    assert.deepEqual(gameReducer(state, { type: 'START_GAME', players }), { ...state, lastEvent: { type: 'INVALID', reason: 'INVALID_PLAYERS' } });
  }
  assert.equal(JSON.stringify(state), before);
  assert.equal(gameReducer(null, null), null);
  assert.equal(gameReducer(null, { type: 'START_GAME', players: null }), null);
});

test('context dispatch supplies missing snapshots and preserves explicit stale snapshots', () => {
  const { createGuardedDispatch } = require('../src/state/guardedDispatch');
  let state = fresh();
  let committed = state;
  const queue = [];
  const dispatch = createGuardedDispatch((action) => queue.push(action), () => committed);
  dispatch({ type: 'DRAW' });
  dispatch({ type: 'DRAW' });
  assert.equal(queue[0].expectedState, committed);
  state = gameReducer(state, queue.shift());
  const once = state;
  state = gameReducer(state, queue.shift());
  assert.equal(state, once);
  committed = state;
  const oldState = fresh();
  dispatch({ type: 'RESTART', expectedState: oldState });
  assert.equal(queue[0].expectedState, oldState);
  assert.equal(gameReducer(state, queue.shift()), state);
  dispatch(null);
  assert.equal(gameReducer(state, queue.shift()).lastEvent.reason, 'INVALID_ACTION');
});

test('reducer rejects obsolete rank buttons and accepts a suit demand', () => {
  const state = fresh();
  state.players[0].hand = [c('J', 'clubs'), c('3', 'hearts')];
  const bad = gameReducer(state, { type: 'PLAY_CARD', cardId: 'J-clubs', chosenRank: 'A' });
  assert.equal(bad.lastEvent.reason, 'JACK_NEEDS_SUIT');
  assert.deepEqual(bad.players, state.players);
  const good = gameReducer(state, { type: 'PLAY_CARD', cardId: 'J-clubs', chosenSuit: 'hearts' });
  assert.equal(good.chosenSuit, 'hearts');
  assert.equal('chosenRank' in good, false);
});

test('bot scheduling ignores an eliminated current player and missing seats', () => {
  const state = fresh();
  state.currentPlayer = 1;
  state.players[1].eliminated = true;
  const never = () => assert.fail('must not schedule a malformed/eliminated turn');
  scheduleBotTurn(state, never, never);
  scheduleBotTurn({ phase: 'playing', players: [] }, never, never);
});

// Integration coverage below runs the production dispatcher, reducer and bot
// scheduler together. Explicit commits model batching; this is NOT a React mount.
function integrationGame({ currentPlayer = 0, finalBotCard = false } = {}) {
  const { createDeck } = require('../src/logic/deck');
  const state = fresh();
  const hands = [
    [c('5', 'hearts'), c('6', 'clubs')],
    finalBotCard ? [c('K', 'hearts')] : [c('K', 'hearts'), c('4', 'clubs')],
    [c('9', 'clubs'), c('3', 'diamonds')],
  ];
  // Use real deck IDs and account for every card exactly once.
  const deck = createDeck();
  const card = (entry) => deck.find((x) => x.rank === entry.rank && x.suit === entry.suit);
  state.players.forEach((player, index) => { player.hand = hands[index].map(card); });
  state.discardPile = [card(c('9', 'hearts'))];
  const used = new Set([...state.players.flatMap((player) => player.hand), ...state.discardPile].map((entry) => entry.id));
  const drawn = card(c('3', 'spades'));
  state.drawPile = [...deck.filter((entry) => !used.has(entry.id) && entry.id !== drawn.id), drawn];
  state.currentPlayer = currentPlayer;
  state.lastEvent = { type: 'ROUND_START', round: 1 };
  return state;
}

function integrationStore(initial) {
  const { createGuardedDispatch } = require('../src/state/guardedDispatch');
  let reduced = initial;
  let committed = initial;
  const queue = [];
  const transitions = [];
  const dispatch = createGuardedDispatch((action) => queue.push(action), () => committed);
  function reduceOne() {
    assert.ok(queue.length, 'expected a queued action');
    const action = queue.shift();
    const before = reduced;
    reduced = gameReducer(reduced, action);
    transitions.push({ action, before, after: reduced });
  }
  return {
    dispatch, queue, transitions, reduceOne,
    commit() { committed = reduced; },
    flush() { while (queue.length) reduceOne(); committed = reduced; },
    get state() { return reduced; },
    get committed() { return committed; },
  };
}

function integrationTimers() {
  let nextId = 0;
  const active = new Map();
  const callbacks = new Map();
  const cancelled = [];
  return {
    active, callbacks, cancelled,
    schedule(callback, delay) {
      assert.equal(delay, 900);
      const id = ++nextId;
      active.set(id, callback);
      callbacks.set(id, callback);
      return id;
    },
    cancel(id) { cancelled.push(id); active.delete(id); },
    fire(id, evenIfCancelled = false) {
      const callback = evenIfCancelled ? callbacks.get(id) : active.get(id);
      active.delete(id);
      if (callback) callback();
    },
  };
}

function scheduleIntegrationBot(store, timers) {
  return scheduleBotTurn(store.committed, store.dispatch, timers.schedule, timers.cancel);
}

test('integration: guarded dispatch rejects a second uncommitted turn and accepts the latest state', () => {
  const initial = integrationGame();
  const store = integrationStore(initial);
  const dispatch = store.dispatch;
  dispatch({ type: 'DRAW' });
  dispatch({ type: 'DRAW' });
  assert.equal(store.queue[0].expectedState, initial);
  assert.equal(store.queue[1].expectedState, initial);
  store.reduceOne();
  const first = store.state;
  assert.equal(store.committed, initial, 'commit has not occurred yet');
  assert.equal(first.currentPlayer, 1);
  assert.deepEqual(first.players.map((p) => p.hand.length), [3, 2, 2]);
  assert.equal(first.players[0].hand.at(-1).id, '3S');
  assert.equal(first.drawPile.length, initial.drawPile.length - 1);
  assert.deepEqual(first.lastEvent, { type: 'DRAW', playerId: 'p0', card: { id: '3S', rank: '3', suit: 'spades' } });
  store.reduceOne();
  assert.equal(store.state, first, 'second queued draw cannot consume the bot turn');
  store.commit();
  assert.equal(store.committed, first);
  assert.equal(store.dispatch, dispatch);
  dispatch({ type: 'PLAY_CARD', cardId: 'KH' });
  assert.equal(store.queue[0].expectedState, first);
  store.flush();
  const second = store.state;
  assert.equal(second.currentPlayer, 2);
  assert.deepEqual(second.players.map((p) => p.hand.length), [3, 1, 2]);
  assert.equal(second.lastEvent.type, 'PLAY');
  assert.equal(second.lastEvent.playerId, 'p1');
  assert.equal(second.lastEvent.card.id, 'KH');
  assert.equal(second.discardPile.at(-1).id, 'KH');
  dispatch({ type: 'DRAW', expectedState: initial });
  assert.equal(store.queue[0].expectedState, initial);
  store.flush();
  assert.equal(store.state, second);
  assert.equal(store.dispatch, dispatch);
  for (const malformed of [null, undefined, false, 42, [], {}, { type: 7 }]) {
    assert.doesNotThrow(() => { dispatch(malformed); store.flush(); });
    assert.deepEqual(store.state.players, second.players);
    assert.equal(store.state.currentPlayer, 2);
    assert.deepEqual(store.state.lastEvent, { type: 'INVALID', reason: 'INVALID_ACTION' });
  }
});

test('integration: one bot timer dispatches one guarded reducer move and cleanup remains safe', () => {
  const initial = integrationGame({ currentPlayer: 1 });
  const store = integrationStore(initial);
  const timers = integrationTimers();
  const cleanup = scheduleIntegrationBot(store, timers);
  assert.equal(timers.active.size, 1);
  assert.equal(timers.callbacks.size, 1);
  assert.equal(store.queue.length, 0);
  const [id] = timers.active.keys();
  timers.fire(id);
  assert.equal(timers.active.size, 0);
  assert.equal(store.queue.length, 1);
  assert.deepEqual(store.queue[0], { type: 'PLAY_CARD', cardId: 'KH', expectedState: initial });
  timers.fire(id, true); // emulate a scheduler invoking the same callback twice
  assert.equal(store.queue.length, 1);
  store.flush();
  assert.equal(store.transitions.length, 1);
  assert.equal(store.state.currentPlayer, 2);
  assert.deepEqual(store.state.players.map((p) => p.hand.length), [2, 1, 2]);
  assert.equal(store.state.lastEvent.type, 'PLAY');
  assert.equal(store.state.lastEvent.playerId, 'p1');
  assert.equal(store.state.discardPile.at(-1).id, 'KH');
  assert.doesNotThrow(() => { cleanup(); cleanup(); });
  assert.equal(timers.active.size, 0);
  timers.fire(id, true);
  assert.equal(store.queue.length, 0);
});

test('integration: cleanup before firing suppresses callbacks and repeated scheduling leaks no timers', () => {
  const initial = integrationGame({ currentPlayer: 1 });
  const store = integrationStore(initial);
  const timers = integrationTimers();
  for (let cycle = 0; cycle < 20; cycle++) {
    const cleanup = scheduleIntegrationBot(store, timers);
    assert.equal(timers.active.size, 1);
    const [id] = timers.active.keys();
    cleanup();
    assert.equal(timers.active.size, 0);
    timers.fire(id, true); // even an already-queued cancelled callback is inert
    assert.equal(store.queue.length, 0);
  }
  assert.equal(timers.cancelled.length, 20);
  assert.equal(store.state, initial);
  assert.equal(store.transitions.length, 0);
  const cleanup = scheduleIntegrationBot(store, timers);
  assert.equal(timers.active.size, 1);
  for (const id of timers.callbacks.keys()) timers.fire(id, true);
  assert.equal(store.queue.length, 1, 'only the newest uncancelled timer dispatches');
  store.flush();
  assert.equal(store.state.currentPlayer, 2);
  assert.equal(store.state.lastEvent.type, 'PLAY');
  cleanup();
  assert.equal(timers.active.size, 0);
});

test('integration: human, missing, eliminated and ended turns schedule no bot timer', () => {
  const human = integrationGame();
  const eliminated = integrationGame({ currentPlayer: 1 });
  eliminated.players[1].eliminated = true;
  const missing = { ...human, currentPlayer: 99 };
  const cases = [human, missing, eliminated, null,
    { ...human, players: [] }, { ...human, phase: 'roundOver', currentPlayer: 1 },
    { ...human, phase: 'gameOver', currentPlayer: 1 }];
  for (const state of cases) {
    const store = integrationStore(state);
    const timers = integrationTimers();
    assert.equal(scheduleIntegrationBot(store, timers), undefined);
    assert.equal(timers.active.size, 0);
    assert.equal(timers.callbacks.size, 0);
    assert.equal(store.queue.length, 0);
    assert.equal(store.state, state);
  }
});

test('integration: a bot callback after Restart preserves its stale snapshot and cannot alter the new game', () => {
  const initial = integrationGame({ currentPlayer: 1 });
  const store = integrationStore(initial);
  const timers = integrationTimers();
  const cleanup = scheduleIntegrationBot(store, timers);
  const [id] = timers.active.keys();
  store.dispatch({ type: 'RESTART' });
  store.flush();
  const restarted = store.state;
  assert.notEqual(restarted, initial);
  assert.equal(restarted.round, 1);
  assert.equal(restarted.currentPlayer, 0);
  assert.deepEqual(restarted.players.map((p) => p.hand.length), [7, 7, 7]);
  assert.deepEqual(restarted.players.map((p) => p.score), [0, 0, 0]);
  assert.deepEqual(restarted.lastEvent, { type: 'ROUND_START', round: 1 });
  // Intentionally delay cleanup to exercise the reducer's race defense.
  timers.fire(id);
  assert.equal(store.queue.length, 1);
  assert.equal(store.queue[0].expectedState, initial, 'guard must not replace the timer snapshot with the latest state');
  store.flush();
  assert.equal(store.state, restarted);
  assert.equal(store.transitions.at(-1).before, restarted);
  assert.equal(store.transitions.at(-1).after, restarted);
  cleanup();
  timers.fire(id, true);
  assert.equal(store.queue.length, 0);
  assert.equal(timers.active.size, 0);
});

test('integration: a bot callback after real round completion and NEXT_ROUND cannot alter the next round', () => {
  const initial = integrationGame({ currentPlayer: 1, finalBotCard: true });
  const store = integrationStore(initial);
  const timers = integrationTimers();
  const cleanup = scheduleIntegrationBot(store, timers);
  const [id] = timers.active.keys();
  store.dispatch({ type: 'PLAY_CARD', cardId: 'KH' });
  store.flush();
  const ended = store.state;
  assert.equal(ended.phase, 'roundOver');
  assert.equal(ended.roundResult.winnerId, 'p1');
  assert.deepEqual(ended.roundResult.points, { p0: 10, p1: 0, p2: 10 });
  store.dispatch({ type: 'NEXT_ROUND' });
  assert.equal(store.queue[0].expectedState, ended);
  store.flush();
  const nextRound = store.state;
  assert.equal(nextRound.phase, 'playing');
  assert.equal(nextRound.round, 2);
  assert.equal(nextRound.currentPlayer, 1);
  assert.deepEqual(nextRound.players.map((p) => p.hand.length), [7, 7, 7]);
  assert.deepEqual(nextRound.players.map((p) => p.score), [10, 0, 10]);
  assert.deepEqual(nextRound.lastEvent, { type: 'ROUND_START', round: 2 });
  timers.fire(id); // still old callback; no synthetic phase mutation in this test
  assert.equal(store.queue[0].expectedState, initial);
  store.flush();
  assert.equal(store.state, nextRound);
  cleanup();
  assert.equal(timers.active.size, 0);
  const newCleanup = scheduleIntegrationBot(store, timers);
  assert.equal(timers.active.size, 1);
  const [newId] = timers.active.keys();
  timers.fire(newId);
  assert.equal(store.queue[0].expectedState, nextRound);
  store.flush();
  assert.notEqual(store.state, nextRound);
  assert.notEqual(store.state.lastEvent.type, 'INVALID');
  newCleanup();
  assert.equal(timers.active.size, 0);
});
