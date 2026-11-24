const { SUITS, RANKS } = require('./constants');

// A card is a plain object: { id: '7H', rank: '7', suit: 'hearts' }
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: rank + suit[0].toUpperCase(), rank, suit });
    }
  }
  return deck;
}

// Fisher-Yates shuffle. Returns a NEW array. `rng` can be swapped for tests.
function shuffle(cards, rng = Math.random) {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = { createDeck, shuffle };