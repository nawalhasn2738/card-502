import { useEffect } from 'react';
import { scheduleBotTurn } from './scheduleBotTurn';
import { useGame } from '../state/GameContext';

export default function useBotTurns() {
  const { state, dispatch } = useGame();
  useEffect(() => {
    // Forward every bot action (PLAY_CARD, DRAW, or PASS) through the same
    // cancellable timer. Drawing already ends the turn in the engine.
    return scheduleBotTurn(state, dispatch);
  }, [state, dispatch]);
}
