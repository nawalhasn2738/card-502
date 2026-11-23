const { chooseBotMove } = require('../logic/bot');

function scheduleBotTurn(state, dispatch, schedule = setTimeout, cancel = clearTimeout) {
  if (state?.phase !== 'playing' || state.players[state.currentPlayer].isBot !== true) return;
  let active = true;
  const timer = schedule(() => {
    if (!active) return;
    active = false;
    dispatch({ ...chooseBotMove(state), expectedState: state });
  }, 900);
  return () => {
    active = false;
    cancel(timer);
  };
}
module.exports = { scheduleBotTurn };
