const { CARD_POINTS, ACE_OF_SPADES_POINTS } = require('./constants');

function cardPoints(card) {
  if (card.rank === 'A' && card.suit === 'spades') return ACE_OF_SPADES_POINTS;
  return CARD_POINTS[card.rank];
}

function handPoints(hand) {
  return hand.reduce((sum, card) => sum + cardPoints(card), 0);
}

module.exports = { cardPoints, handPoints };