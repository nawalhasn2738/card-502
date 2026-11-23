const engine = require('../logic/engine');
const initialState = null;
function gameReducer(state = initialState, action) {
  // Ignore queued input/timers from a state that has already been replaced.
  if ('expectedState' in action && action.expectedState !== state) return state;
  if (action.type === 'START_GAME') return engine.createGame(action.players);
  if (!state) return state;
  switch (action.type) {
    case 'PLAY_CARD': return engine.playCard(state, {
      cardId: action.cardId,
      chosenSuit: action.chosenSuit,
      chosenRank: action.chosenRank,
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
