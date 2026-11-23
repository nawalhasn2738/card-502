import { useEffect, useRef, useState } from 'react';
import { createActionGuard } from '../state/actionGuard';
import { Button, Pressable, ScrollView, Text, View } from 'react-native';
import useBotTurns from '../hooks/useBotTurns';
import { SUITS, RANKS } from '../logic/constants';
import { getPlayableCards, isJack, topCard } from '../logic/rules';
import { useGame } from '../state/GameContext';

const PLAYERS = [{ name: 'Nawal' }, { name: 'Bot 1', isBot: true }, { name: 'Bot 2', isBot: true }];
const cardLabel = (card) => card ? `${card.rank} of ${card.suit}` : 'None';

export default function DebugScreen() {
  const { state, dispatch } = useGame();
  const [selectedJack, setSelectedJack] = useState(null);
  const actionGuard = useRef(null);
  if (!actionGuard.current) actionGuard.current = createActionGuard();
  useBotTurns();
  useEffect(() => {
    dispatch({ type: 'START_GAME', players: PLAYERS });
  }, [dispatch]);

  function sendAction(action) {
    if (!actionGuard.current()) return;
    setSelectedJack(null);
    dispatch({ ...action, expectedState: state });
  }

  if (!state) return <Text>Starting game...</Text>;
  const player = state.players[state.currentPlayer];
  const isBotTurn = player.isBot === true;
  const controlsDisabled = isBotTurn || state.phase !== 'playing';
  const playableIds = new Set(getPlayableCards(state, state.currentPlayer).map((card) => card.id));
  const isOver = state.phase === 'roundOver' || state.phase === 'gameOver';
  const winnerId = state.phase === 'gameOver' ? state.winnerId : state.roundResult?.winnerId;
  const winner = state.players.find((entry) => entry.id === winnerId);
  const endedBy = state.players.find((entry) => entry.id === state.roundResult?.endedBy);

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: 48 }}>
      <Text>Phase: {state.phase} | Round: {state.round}</Text>
      <Text>Current player: {player.name}</Text>
      <Text>Top discard: {cardLabel(topCard(state))}</Text>
      <Text>chosenSuit: {state.chosenSuit ?? 'None'}</Text>
      <Text>chosenRank: {state.chosenRank ?? 'None'}</Text>
      <Text>pendingDraw: {state.pendingDraw}</Text>
      <Text>pendingType: {state.pendingType ?? 'None'}</Text>
      <Text>pendingSkip: {String(state.pendingSkip)}</Text>
      {state.players.some((entry) => !entry.isBot && entry.eliminated) && (
        <Text>You were eliminated. Watch the bots continue, or tap Restart.</Text>
      )}
      {isBotTurn && state.phase === 'playing' && <Text>Bot is thinking...</Text>}
      <Text>Hand (playable cards are bold):</Text>
      {player.hand.map((card) => (
        <Pressable
          key={card.id}
          accessibilityRole="button"
          accessibilityState={{ disabled: controlsDisabled }}
          disabled={controlsDisabled}
          style={{ paddingVertical: 10 }}
          onPress={() => {
            if (isJack(card)) setSelectedJack(card.id);
            else sendAction({ type: 'PLAY_CARD', cardId: card.id });
          }}
        >
          <Text style={{ fontWeight: playableIds.has(card.id) ? 'bold' : 'normal' }}>{cardLabel(card)}</Text>
        </Pressable>
      ))}
      {selectedJack && !controlsDisabled && (
        <>
          <Text>Choose a suit or a rank for the Jack:</Text>
          {SUITS.map((suit) => (
            <Button key={suit} title={suit} onPress={() => sendAction({
              type: 'PLAY_CARD', cardId: selectedJack, chosenSuit: suit,
            })} />
          ))}
          <Text>Or demand a rank:</Text>
          <ScrollView horizontal>
            <View style={{ flexDirection: 'row' }}>
              {RANKS.map((rank) => (
                <Button key={rank} title={rank} onPress={() => sendAction({
                  type: 'PLAY_CARD', cardId: selectedJack, chosenRank: rank,
                })} />
              ))}
            </View>
          </ScrollView>
        </>
      )}
      <Button title="Draw" disabled={controlsDisabled || state.pendingSkip} onPress={() => sendAction({ type: 'DRAW' })} />
      {state.pendingSkip && (
        <Button title="Accept skip" disabled={controlsDisabled} onPress={() => sendAction({ type: 'PASS' })} />
      )}
      <Button title="Next Round" disabled={!isOver} onPress={() => sendAction({ type: 'NEXT_ROUND' })} />
      <Button title="Restart" onPress={() => sendAction({ type: 'RESTART' })} />
      <Text>lastEvent: {JSON.stringify(state.lastEvent)}</Text>
      {isOver && (
        <>
          <Text>Round reason: {state.roundResult?.reason}</Text>
          <Text>Ended by: {endedBy?.name ?? 'None'}</Text>
          <Text>Round winner: {state.players.find((entry) => entry.id === state.roundResult?.winnerId)?.name ?? 'None'}</Text>
          {state.phase === 'gameOver' && <Text>Game winner: {winner?.name ?? 'None'}</Text>}
          <Text>Scores:</Text>
          {state.players.map((entry) => (
            <Text key={entry.id}>
              {entry.name}: round points {state.roundResult?.points[entry.id] ?? 0}, total {entry.score}
              {entry.eliminated ? ' (eliminated)' : ''}
            </Text>
          ))}
        </>
      )}
    </ScrollView>
  );
}
