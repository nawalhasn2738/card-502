
// ---- card identity helpers ----
const isTwo = (c) => c.rank === '2';
const isAceOfSpades = (c) => c.rank === 'A' && c.suit === 'spades';
const isEight = (c) => c.rank === '8';
const isJack = (c) => c.rank === 'J';
const isSevenOfHearts = (c) => c.rank === '7' && c.suit === 'hearts';
const isSpecial = (c) =>
  isTwo(c) || isAceOfSpades(c) || isEight(c) || isJack(c) || isSevenOfHearts(c);
// Every Ace is rejected on opening. Opening 8 rejection is retained legacy
// behavior; the published opening-card list does not verify it.
const isOpeningCard = (c) => !!c && !isSpecial(c) && c.rank !== 'A';

// ---- table helpers ----
const topCard = (state) => state?.discardPile?.[state.discardPile.length - 1];

// Suit demand, or the table suit when there is no suit demand.
const activeSuit = (state) => state?.chosenSuit || topCard(state)?.suit || null;

// Can this card be played right now (ignoring whose turn it is)?
function isLegalPlay(state, card) {
  if (!card || !topCard(state)) return false;
  if (state.pendingDraw > 0) {
    if (state.pendingType === 'two') return isTwo(card);
    if (state.pendingType === 'ace') return card.rank === 'A';
    return false;
  }
  if (state.pendingSkip) return isEight(card);
  if (isSevenOfHearts(card)) return true;
  if (isJack(card)) return true;
  if (state.chosenSuit) return card.suit === state.chosenSuit;
  return card.suit === topCard(state).suit || card.rank === topCard(state).rank;
}

// Cards the given player may play right now. Used by the UI (highlighting) and bots.
function getPlayableCards(state, playerIndex) {
  if (state?.phase !== 'playing' || playerIndex !== state.currentPlayer) return [];
  const player = state.players?.[playerIndex];
  if (!player || player.eliminated || !Array.isArray(player.hand)) return [];
  const hand = player.hand;
  return hand.filter((c) => isLegalPlay(state, c));
}

module.exports = {
  isTwo, isAceOfSpades, isEight, isJack, isSevenOfHearts, isSpecial, isOpeningCard,
  topCard, activeSuit, isLegalPlay, getPlayableCards,
};
