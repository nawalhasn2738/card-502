const engine = require('../logic/engine');
const initialState = null;
// Before a game exists there is no event-bearing state to update. Keep null so
// malformed startup input cannot expose a partial game to existing screens.
const invalid = (state, reason) => state === null ? state : { ...state, lastEvent: { type: 'INVALID', reason } };
function gameReducer(state = initialState, action) {
  if (!action || typeof action !== 'object' || Array.isArray(action) || typeof action.type !== 'string') {
    return invalid(state, 'INVALID_ACTION');
  }
  // Ignore queued input/timers from a state that has already been replaced.
  if ('expectedState' in action && action.expectedState !== state) return state;
  if (action.type === 'START_GAME') {
    const next = engine.createGame(action.players);
    return next.lastEvent.type === 'INVALID' ? invalid(state, next.lastEvent.reason) : next;
  }
  if (!state) return state;
  switch (action.type) {
    case 'PLAY_CARD':
      // Reject obsolete UI/API rank demands; never silently drop them.
      if (action.chosenRank != null) return invalid(state, 'JACK_NEEDS_SUIT');
      return engine.playCard(state, {
      cardId: action.cardId,
      chosenSuit: action.chosenSuit,
    });
    case 'DRAW': return engine.drawCard(state);
    // PASS accepts an 8's pending skip; the engine validates pendingSkip.
    case 'PASS': return engine.passTurn(state);
    case 'NEXT_ROUND':
      if (state.phase === 'gameOver') return engine.restartGame(state);
      return state.phase === 'roundOver' ? engine.nextRound(state) : state;
    case 'RESTART': return engine.restartGame(state);
    default: return state;
  }
}
module.exports = { gameReducer, initialState };
