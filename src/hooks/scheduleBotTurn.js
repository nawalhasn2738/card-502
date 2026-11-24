const { chooseBotMove } = require('../logic/bot');

function scheduleBotTurn(state, dispatch, schedule = setTimeout, cancel = clearTimeout) {
  const player = state?.players?.[state.currentPlayer];
  if (state?.phase !== 'playing' || !player || player.eliminated || player.isBot !== true) return;
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
