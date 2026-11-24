import { createContext, useContext, useLayoutEffect, useReducer, useRef } from 'react';
import { gameReducer, initialState } from './gameReducer';
import { createGuardedDispatch } from './guardedDispatch';

const GameContext = createContext(undefined);
export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const stateRef = useRef(state);
  useLayoutEffect(() => { stateRef.current = state; }, [state]);
  const guardedDispatch = useRef(null);
  if (!guardedDispatch.current) {
    guardedDispatch.current = createGuardedDispatch(dispatch, () => stateRef.current);
  }
  // Stable identity preserves existing effects that depend on dispatch.
  return <GameContext.Provider value={{ state, dispatch: guardedDispatch.current }}>{children}</GameContext.Provider>;
}
export function useGame() {
  const game = useContext(GameContext);
  if (game === undefined) throw new Error('useGame must be used inside GameProvider');
  return game;
}
