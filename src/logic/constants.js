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

  // ---- ASSUMPTIONS: verify these against the original game ----
  // 1. While a draw penalty is pending, ONLY a 2 can be played (stacking) or you draw it all.
  // 2. The 7 of Hearts must still match by suit/rank to be played.
  sevenOfHeartsNeedsMatch: true,
};

// ---- TODO VERIFY: card point values used when a round ends ----
// Open the original site's score-calculator page and copy its exact values here.
const CARD_POINTS = {
  A: 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, J: 10, Q: 10, K: 10,
};
const ACE_OF_SPADES_POINTS = 50;

module.exports = { SUITS, RANKS, RULES, CARD_POINTS, ACE_OF_SPADES_POINTS };