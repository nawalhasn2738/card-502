import { createContext, useContext, useReducer } from 'react';
import { gameReducer, initialState } from './gameReducer';

const GameContext = createContext(undefined);
export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>;
}
export function useGame() {
  const game = useContext(GameContext);
  if (game === undefined) throw new Error('useGame must be used inside GameProvider');
  return game;
}
