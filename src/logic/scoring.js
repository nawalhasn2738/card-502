const { CARD_POINTS } = require('./constants');

function cardPoints(card) {
  if ((card.rank === 'A' && card.suit === 'spades') ||
      (card.rank === '7' && card.suit === 'hearts')) return 100;
  return CARD_POINTS[card.rank];
}

function handPoints(hand) {
  return hand.reduce((sum, card) => sum + cardPoints(card), 0);
}

module.exports = { cardPoints, handPoints };
