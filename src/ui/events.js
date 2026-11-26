// Turns engine events and pending state into short, friendly UI text.
// Read-only: everything here describes state produced by the engine.
import { SUIT_NAME, SUIT_SYMBOL, shortLabel } from './cards';
import { findPlayer } from './players';
import { topCard } from '../logic/rules';

const who = (state, id, humanId) => (id === humanId ? 'You' : findPlayer(state, id)?.name ?? 'Someone');

const INVALID_TEXT = {
  ILLEGAL_CARD: 'That card can’t be played right now',
  JACK_NEEDS_SUIT: 'Pick a suit for your Jack',
  SKIP_PENDING: 'Play an 8 or accept the skip',
  NOTHING_TO_PASS: 'There is no skip to accept',
  CARD_NOT_IN_HAND: 'That card is no longer in your hand',
  NOT_PLAYING: 'The round is over',
};

// Returns { text, tone, card } or null when the event needs no toast.
export function describeEvent(event, state, humanId) {
  if (!event || !state) return null;
  switch (event.type) {
    case 'PLAY': {
      const name = who(state, event.playerId, humanId);
      const c = event.card;
      if (event.skippedId) {
        const skipped = event.skippedId === humanId ? 'you' : who(state, event.skippedId, humanId);
        return { text: `${name} skipped ${skipped}`, tone: 'blue', card: c };
      }
      if (c.rank === 'J') return { text: `${name} called ${SUIT_SYMBOL[event.chosenSuit]} ${SUIT_NAME[event.chosenSuit]}`, tone: 'gold', card: c };
      if (c.rank === '2') return { text: `${name} played ${shortLabel(c)} · penalty now +${state.pendingDraw}`, tone: 'red', card: c };
      if (c.rank === 'A' && state.pendingType === 'ace') {
        return { text: `${name} ${c.suit === 'spades' ? 'played the Ace of Spades · +5' : 'passed the +5 on'}`, tone: 'red', card: c };
      }
      if (c.rank === '8' && state.pendingSkip) return { text: `${name} played an 8 · counter or be skipped`, tone: 'blue', card: c };
      if (event.playerId === humanId) return null; // your own plain plays are obvious
      return { text: `${name} played ${shortLabel(c)}`, tone: 'neutral', card: c };
    }
    case 'DRAW':
      if (event.playerId === humanId) return { text: `You drew ${shortLabel(event.card)}`, tone: 'neutral', card: event.card };
      return { text: `${who(state, event.playerId, humanId)} drew a card`, tone: 'neutral' };
    case 'PENALTY_DRAW': {
      const name = who(state, event.playerId, humanId);
      return { text: `${name} took ${event.count} card${event.count === 1 ? '' : 's'}`, tone: 'red' };
    }
    case 'SKIP':
      return { text: `${who(state, event.playerId, humanId)} ${event.playerId === humanId ? 'were' : 'was'} skipped`, tone: 'blue' };
    case 'DRAW_EMPTY':
      return { text: 'No cards left to draw · turn passes', tone: 'neutral' };
    case 'ROUND_START': {
      const starter = state.players[state.currentPlayer];
      const starts = starter?.id === humanId ? 'You start' : `${starter?.name} starts`;
      return { text: `Round ${event.round} · ${starts}`, tone: 'gold' };
    }
    case 'INVALID':
      return { text: INVALID_TEXT[event.reason] ?? 'That move isn’t allowed', tone: 'red' };
    default:
      return null;
  }
}

// What the human may do right now, in one line.
export function turnHint(state, playableCount) {
  const top = topCard(state);
  if (state.pendingDraw > 0 && state.pendingType === 'two') {
    return playableCount ? `Stack a 2, or take ${state.pendingDraw} cards` : `No 2 to stack · take ${state.pendingDraw} cards`;
  }
  if (state.pendingDraw > 0 && state.pendingType === 'ace') {
    return playableCount ? 'Pass it on with an Ace, or take 5 cards' : 'No Ace to pass it on · take 5 cards';
  }
  if (state.pendingSkip) {
    return playableCount ? 'Counter with an 8, or accept the skip' : 'No 8 to counter · accept the skip';
  }
  if (!playableCount) return 'Nothing matches · draw a card';
  if (state.chosenSuit) return `Play a ${SUIT_SYMBOL[state.chosenSuit]}, a Jack or the 7♥ · or draw`;
  return `Match ${SUIT_SYMBOL[top?.suit] ?? ''} or ${top?.rank ?? ''} · or draw`;
}
