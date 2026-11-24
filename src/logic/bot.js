const { SUITS } = require('./constants');
const { nextActive } = require('./engine');
const { getPlayableCards, isSevenOfHearts, isTwo, isAceOfSpades, isEight, isJack, topCard } = require('./rules');
const { cardPoints, handPoints } = require('./scoring');

function highestPoints(cards) {
  return cards.reduce((best, card) => cardPoints(card) > cardPoints(best) ? card : best);
}

function jackSuit(state, jack) {
  const hand = state.players[state.currentPlayer].hand.filter((card) => card.id !== jack.id);
  const counts = SUITS.map((suit) => hand.filter((card) => card.suit === suit).length);
  // Prefer the table suit on ties, including when the Jack is the last card.
  let suit = topCard(state)?.suit || SUITS[0];
  for (const candidate of SUITS) {
    if (counts[SUITS.indexOf(candidate)] > counts[SUITS.indexOf(suit)]) suit = candidate;
  }
  return suit;
}

// Call during the playing phase. Ties keep hand order for deterministic decisions.
function chooseBotMove(state) {
  const playable = getPlayableCards(state, state.currentPlayer);
  const seven = playable.find(isSevenOfHearts);
  const others = playable.filter((entry) => !isSevenOfHearts(entry));
  let card;
  if (others.length) {
    if (state.pendingDraw > 0 || state.pendingSkip) card = others[0];
    else {
      const next = state.players[nextActive(state, state.currentPlayer)];
      const special = others.find((entry) => isTwo(entry) || isAceOfSpades(entry) || isEight(entry));
      card = next && next.hand.length <= 3 && special ? special : highestPoints(others);
    }
  } else if (seven) {
    const remaining = state.players[state.currentPlayer].hand.filter((entry) => entry.id !== seven.id);
    if (handPoints(remaining) <= 20) card = seven;
  }
  if (!card) return { type: state.pendingSkip ? 'PASS' : 'DRAW' };
  const action = { type: 'PLAY_CARD', cardId: card.id };
  if (isJack(card)) action.chosenSuit = jackSuit(state, card);
  return action;
}

module.exports = { chooseBotMove };
