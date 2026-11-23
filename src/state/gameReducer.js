const engine = require('../logic/engine');

// There is no game until the user starts one.
const initialState = null;

// Translate UI actions into engine calls. All game rules stay in the engine.
function gameReducer(state = initialState, action) {
  if (action.type === 'START_GAME') {
    return engine.createGame(action.players);
  }

  // Ignore game actions until a game exists.
  if (state === null) return state;

  switch (action.type) {
    case 'PLAY_CARD':
      return engine.playCard(state, {
        cardId: action.cardId,
        chosenSuit: action.chosenSuit,
      });
    case 'DRAW':
      return engine.drawCard(state);
    case 'PASS':
      return engine.passTurn(state);
    case 'NEXT_ROUND':
      return engine.nextRound(state);
    case 'RESTART':
      return engine.restartGame(state);
    default:
      // Unknown actions leave the current game unchanged.
      return state;
  }
}

module.exports = { gameReducer, initialState };
