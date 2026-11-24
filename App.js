import DebugScreen from './src/screens/DebugScreen';
import { GameProvider } from './src/state/GameContext';

export default function App() {
  return (
    <GameProvider>
      <DebugScreen />
    </GameProvider>
  );
}

