const { SUITS } = require('./constants');
const { nextActive } = require('./engine');
const { getPlayableCards, isSevenOfHearts, isTwo, isAceOfSpades, isEight, isJack, topCard } = require('./rules');
const { cardPoints } = require('./scoring');

function highestPoints(cards) {
  return cards.reduce((best, card) => cardPoints(card) > cardPoints(best) ? card : best);
}

function jackSuit(state, jack) {
  const hand = state.players[state.currentPlayer].hand.filter((card) => card.id !== jack.id);
  const counts = SUITS.map((suit) => hand.filter((card) => card.suit === suit).length);
  // Prefer the table suit on ties, including when the Jack is the last card.
  let suit = topCard(state).suit;
  for (const candidate of SUITS) {
    if (counts[SUITS.indexOf(candidate)] > counts[SUITS.indexOf(suit)]) suit = candidate;
  }
  return suit;
}

// Call during the playing phase. Ties keep hand order for deterministic decisions.
function chooseBotMove(state) {
  const playable = getPlayableCards(state, state.currentPlayer);
  let card = state.drawnCardId
    ? playable.find((entry) => entry.id === state.drawnCardId)
    : null;
  if (!card && playable.length === 0) return { type: 'DRAW' };
  if (!card) card = playable.find(isSevenOfHearts);
  if (!card) {
    const next = state.players[nextActive(state, state.currentPlayer)];
    const specials = playable.filter((entry) => isTwo(entry) || isAceOfSpades(entry) || isEight(entry));
    card = highestPoints(next.hand.length <= 3 && specials.length ? specials : playable);
  }
  const action = { type: 'PLAY_CARD', cardId: card.id };
  if (isJack(card)) action.chosenSuit = jackSuit(state, card);
  return action;
}

module.exports = { chooseBotMove };
