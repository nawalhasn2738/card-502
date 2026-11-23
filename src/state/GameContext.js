import { createContext, useContext, useReducer } from 'react';
import { gameReducer, initialState } from './gameReducer';

// Share one game between all components inside the provider.
const GameContext = createContext(undefined);

export function GameProvider({ children }) {
  // The reducer sends each action to the engine and stores its returned state.
  const [state, dispatch] = useReducer(gameReducer, initialState);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

// Components use this hook to read the game and send actions.
export function useGame() {
  const game = useContext(GameContext);

  // A clear error helps catch a missing provider during development.
  if (game === undefined) {
    throw new Error('useGame must be used inside GameProvider');
  }

  return game;
}
