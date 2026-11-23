const engine = require('../logic/engine');
const initialState = null;
function gameReducer(state = initialState, action) {
  if (action.type === 'START_GAME') return engine.createGame(action.players);
  if (!state) return state;
  switch (action.type) {
    case 'PLAY_CARD': return engine.playCard(state, action);
    case 'DRAW': return engine.drawCard(state);
    case 'PASS': return engine.passTurn(state);
    case 'NEXT_ROUND': return engine.nextRound(state);
    case 'RESTART': return engine.restartGame(state);
    default: return state;
  }
}
module.exports = { gameReducer, initialState };
