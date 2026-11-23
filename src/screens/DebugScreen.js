import { useEffect, useState } from 'react';
import { Button, Pressable, ScrollView, Text } from 'react-native';
import useBotTurns from '../hooks/useBotTurns';
import { SUITS } from '../logic/constants';
import { getPlayableCards, isJack, topCard } from '../logic/rules';
import { useGame } from '../state/GameContext';

const PLAYERS = [{ name: 'Naval' }, { name: 'Bot 1', isBot: true }, { name: 'Bot 2', isBot: true }];
const cardLabel = (card) => card ? `${card.rank} of ${card.suit}` : 'None';

export default function DebugScreen() {
  const { state, dispatch } = useGame();
  const [selectedJack, setSelectedJack] = useState(null);
  useBotTurns();
  useEffect(() => {
    dispatch({ type: 'START_GAME', players: PLAYERS });
  }, [dispatch]);

  function sendAction(action) {
    setSelectedJack(null);
    dispatch(action);
  }

  if (!state) return <Text>Starting game...</Text>;
  const player = state.players[state.currentPlayer];
  const isBotTurn = player.isBot === true;
  const playableIds = new Set(getPlayableCards(state, state.currentPlayer).map((card) => card.id));
  const isOver = state.phase === 'roundOver' || state.phase === 'gameOver';
  const winnerId = state.phase === 'gameOver' ? state.winnerId : state.roundResult?.winnerId;
  const winner = state.players.find((entry) => entry.id === winnerId);

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: 48 }}>
      <Text>Phase: {state.phase} | Round: {state.round}</Text>
      <Text>Current player: {player.name}</Text>
      <Text>Top discard: {cardLabel(topCard(state))}</Text>
      <Text>chosenSuit: {state.chosenSuit ?? 'None'}</Text>
      <Text>pendingDraw: {state.pendingDraw}</Text>
      {isBotTurn && state.phase === 'playing' && <Text>Bot is thinking...</Text>}
      <Text>Hand (playable cards are bold):</Text>
      {player.hand.map((card) => (
        <Pressable
          key={card.id}
          accessibilityRole="button"
          accessibilityState={{ disabled: isBotTurn }}
          disabled={isBotTurn}
          style={{ paddingVertical: 10 }}
          onPress={() => {
            if (isJack(card)) setSelectedJack(card.id);
            else sendAction({ type: 'PLAY_CARD', cardId: card.id });
          }}
        >
          <Text style={{ fontWeight: playableIds.has(card.id) ? 'bold' : 'normal' }}>{cardLabel(card)}</Text>
        </Pressable>
      ))}
      {selectedJack && !isBotTurn && (
        <>
          <Text>Choose a suit for the Jack:</Text>
          {SUITS.map((suit) => (
            <Button key={suit} title={suit} onPress={() => sendAction({
              type: 'PLAY_CARD', cardId: selectedJack, chosenSuit: suit,
            })} />
          ))}
        </>
      )}
      <Button title="Draw" disabled={isBotTurn} onPress={() => sendAction({ type: 'DRAW' })} />
      <Button title="Pass" disabled={isBotTurn} onPress={() => sendAction({ type: 'PASS' })} />
      <Button title="Next Round" onPress={() => sendAction({ type: 'NEXT_ROUND' })} />
      <Button title="Restart" onPress={() => sendAction({ type: 'RESTART' })} />
      <Text>lastEvent: {JSON.stringify(state.lastEvent)}</Text>
      {isOver && (
        <>
          <Text>{state.phase === 'gameOver' ? 'Game' : 'Round'} winner: {winner?.name ?? 'None'}</Text>
          <Text>Scores:</Text>
          {state.players.map((entry) => (
            <Text key={entry.id}>{entry.name}: {entry.score}{entry.eliminated ? ' (eliminated)' : ''}</Text>
          ))}
        </>
      )}
    </ScrollView>
  );
}
