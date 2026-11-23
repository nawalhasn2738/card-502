// All game settings live here, so rule fixes are one-line changes.

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const RULES = {
  handSize: 7,              // from the original site
  minPlayers: 2,            // from the original site
  maxPlayers: 6,            // from the original site
  eliminationScore: 502,    // from the original site
  twoPenalty: 2,            // a 2 makes the next player draw 2 (stacks)
  aceOfSpadesPenalty: 5,    // Ace of Spades makes the next player draw 5

};

const CARD_POINTS = {
  A: 20, '2': 30, '3': 5, '4': 5, '5': 5, '6': 5, '7': 5,
  '8': 30, '9': 5, '10': 10, J: 30, Q: 10, K: 10,
};

module.exports = { SUITS, RANKS, RULES, CARD_POINTS };
