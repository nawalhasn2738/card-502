import { useEffect } from 'react';
import { chooseBotMove } from '../logic/bot';
import { useGame } from '../state/GameContext';

export default function useBotTurns() {
  const { state, dispatch } = useGame();
  useEffect(() => {
    if (state?.phase !== 'playing' || state.players[state.currentPlayer].isBot !== true) return;
    const timer = setTimeout(() => dispatch(chooseBotMove(state)), 900);
    return () => clearTimeout(timer);
  }, [state, dispatch]);
}
