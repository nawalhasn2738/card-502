// Presentation helpers for cards. These describe cards for display only; the
// rules themselves live in src/logic and are never re-implemented here.
import { SUITS } from '../logic/constants';
import { cardPoints } from '../logic/scoring';
import { colors } from './theme';

export const SUIT_SYMBOL = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
export const SUIT_NAME = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
const RANK_NAME = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };

export const isRedSuit = (suit) => suit === 'hearts' || suit === 'diamonds';
export const suitColor = (suit) => (isRedSuit(suit) ? colors.cardRed : colors.cardBlack);

export const shortLabel = (card) => (card ? `${card.rank}${SUIT_SYMBOL[card.suit]}` : '');
export const longLabel = (card) =>
  card ? `${RANK_NAME[card.rank] ?? card.rank} of ${SUIT_NAME[card.suit]}` : '';

// Small badge shown on power cards so players learn them at a glance.
export function powerBadge(card) {
  if (!card) return null;
  if (card.rank === '7' && card.suit === 'hearts') return { label: 'WIN', tone: 'gold' };
  if (card.rank === 'A' && card.suit === 'spades') return { label: '+5', tone: 'red' };
  if (card.rank === '2') return { label: '+2', tone: 'red' };
  if (card.rank === '8') return { label: 'SKIP', tone: 'blue' };
  if (card.rank === 'J') return { label: 'WILD', tone: 'gold' };
  return null;
}

export const pointsOf = (card) => cardPoints(card);

const RANK_ORDER = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_ORDER = ['spades', 'hearts', 'clubs', 'diamonds']; // alternate colours

// Display order for the human hand: grouped by suit, then rank. This only
// changes how the hand is drawn, never the hand stored in game state.
export function sortForDisplay(hand) {
  return [...hand].sort((a, b) =>
    SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit) ||
    RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));
}

export function suitCounts(hand, excludeId) {
  const counts = Object.fromEntries(SUITS.map((s) => [s, 0]));
  hand.forEach((c) => { if (c.id !== excludeId) counts[c.suit] += 1; });
  return counts;
}
