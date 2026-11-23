
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

// Suit demand, or the table suit when there is no suit demand.
const activeSuit = (state) => state.chosenSuit || topCard(state).suit;

// Can this card be played right now (ignoring whose turn it is)?
function isLegalPlay(state, card) {
  if (isSevenOfHearts(card)) return true;
  if (state.pendingDraw > 0) return state.pendingType === 'two' ? isTwo(card) : card.rank === 'A';
  if (state.pendingSkip) return isEight(card);
  if (isJack(card)) return true;
  if (state.chosenSuit) return card.suit === state.chosenSuit;
  if (state.chosenRank) return card.rank === state.chosenRank;
  return card.suit === topCard(state).suit || card.rank === topCard(state).rank;
}

// Cards the given player may play right now. Used by the UI (highlighting) and bots.
function getPlayableCards(state, playerIndex) {
  if (state.phase !== 'playing' || playerIndex !== state.currentPlayer) return [];
  const hand = state.players[playerIndex].hand;
  return hand.filter((c) => isLegalPlay(state, c));
}

module.exports = {
  isTwo, isAceOfSpades, isEight, isJack, isSevenOfHearts, isSpecial,
  topCard, activeSuit, isLegalPlay, getPlayableCards,
};
