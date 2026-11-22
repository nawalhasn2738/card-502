const { RULES } = require('./constants');

// ---- card identity helpers ----
const isTwo = (c) => c.rank === '2';
const isAceOfSpades = (c) => c.rank === 'A' && c.suit === 'spades';
const isEight = (c) => c.rank === '8';
const isJack = (c) => c.rank === 'J';
const isSevenOfHearts = (c) => c.rank === '7' && c.suit === 'hearts';
const isSpecial = (c) =>
  isTwo(c) || isAceOfSpades(c) || isEight(c) || isJack(c) || isSevenOfHearts(c);

// ---- table helpers ----
const topCard = (state) => state.discardPile[state.discardPile.length - 1];

// The suit that must be matched: the suit named by a Jack, or the top card's suit.
const activeSuit = (state) => state.chosenSuit || topCard(state).suit;

// Can this card be played right now (ignoring whose turn it is)?
function isLegalPlay(state, card) {
  if (state.pendingDraw > 0) return isTwo(card); // only a 2 can stack on a penalty
  if (isSevenOfHearts(card) && !RULES.sevenOfHeartsNeedsMatch) return true;
  return card.suit === activeSuit(state) || card.rank === topCard(state).rank;
}

// Cards the given player may play right now. Used by the UI (highlighting) and bots.
function getPlayableCards(state, playerIndex) {
  if (state.phase !== 'playing' || playerIndex !== state.currentPlayer) return [];
  const hand = state.players[playerIndex].hand;
  // After drawing, only the drawn card may be played.
  const pool = state.drawnCardId ? hand.filter((c) => c.id === state.drawnCardId) : hand;
  return pool.filter((c) => isLegalPlay(state, c));
}

module.exports = {
  isTwo, isAceOfSpades, isEight, isJack, isSevenOfHearts, isSpecial,
  topCard, activeSuit, isLegalPlay, getPlayableCards,
};