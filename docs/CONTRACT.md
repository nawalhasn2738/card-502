# Game contract

This describes the current CommonJS modules in `src/logic/` and
`src/state/gameReducer.js`. Functions read plain JavaScript objects. Engine
actions return new state without mutating their input. Invalid game actions
return a shallow copy of state with only `lastEvent` replaced. They do not
throw for the rule violations listed below. Callers must supply a valid state
and correctly shaped arguments; this is not a general input-validation API.

## Shared types and exported constants

`Card = { id: string, rank: Rank, suit: Suit }`.
Deck IDs use rank plus uppercase suit initial, for example `7H`, `AS`, `10C`.
Player IDs are `p0`, `p1`, etc., in seating order.

`src/logic/constants.js` exports:

- `SUITS`: `['spades', 'hearts', 'diamonds', 'clubs']`.
- `RANKS`: `['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']`.
- `RULES`: `{ handSize: 7, minPlayers: 2, maxPlayers: 6,
  eliminationScore: 502, twoPenalty: 2, aceOfSpadesPenalty: 5 }`.
- `CARD_POINTS`: rank defaults listed below. Use `cardPoints(card)` to include
  the two suit-specific overrides.

## Full state shape

The reducer's exported `initialState` is `null`. Once started, state is:

```ts
type Player = {
  id: string;
  name: string;
  isBot: boolean;
  hand: Card[];
  score: number;                 // cumulative penalty points
  eliminated: boolean;
};

type RoundResult = {
  endedBy: string;               // player ID whose play ended the round
  winnerId: string | null;       // endedBy for EMPTY_HAND; null for SEVEN_OF_HEARTS
  reason: 'EMPTY_HAND' | 'SEVEN_OF_HEARTS';
  points: { [playerId: string]: number }; // points added this round
  eliminatedIds: string[];       // newly eliminated players only
};

type GameState = {
  players: Player[];
  drawPile: Card[];              // draw from the array's LAST element
  discardPile: Card[];           // top discard is the LAST element
  currentPlayer: number;        // seat index, not player ID
  roundStarter: number;         // starting seat for this round
  round: number;                // starts at 1 in a returned game
  phase: 'playing' | 'roundOver' | 'gameOver';
  pendingDraw: number;          // accumulated draw penalty; normally 0
  pendingType: null | 'two' | 'ace';
  pendingSkip: boolean;         // current player can counter an 8 or accept skip
  chosenSuit: Suit | null;      // outstanding Jack suit demand
  chosenRank: Rank | null;      // outstanding Jack rank demand
  roundResult: RoundResult | null;
  winnerId: string | null;      // overall game winner, separate from round winner
  lastEvent: LastEvent | null;
};
```

Only one of `chosenSuit` and `chosenRank` is non-null in engine-produced states.
There is no drawn-card waiting state: drawing immediately ends the turn.
Round start and round end reset all five pending/demand fields to
`0`, `null`, `false`, `null`, `null`, respectively.
Round start also clears `roundResult` and overall `winnerId`.
Round end preserves hands for inspection; eliminated players receive no cards
when the next round starts.

## Exported functions

### `src/logic/engine.js`

Optional `rng` arguments default to `Math.random`. Supply a function returning
a number in `[0, 1)` for reproducible shuffles and reshuffles.

| Function | Arguments and result |
| --- | --- |
| `createGame(playerConfigs, rng?)` | `playerConfigs` is 2–6 `{ name, isBot? }` objects. Assigns IDs, coerces `isBot` to boolean, resets scores/elimination, and deals round 1. Returns state. Throws `Error('Players must be between 2 and 6')` for an invalid player count. |
| `startRound(prev, rng?)` | Low-level round initializer: clones existing state, increments round, builds/shuffles a fresh deck, deals active players, resets pending fields/results and selects the starter. Returns state. Does not validate phase; normally call `nextRound`. Requires active players. |
| `playCard(state, { cardId, chosenSuit?, chosenRank? } = {}, rng?)` | Plays a card from the current player's hand. A Jack needs exactly one valid demand; the other may be omitted or null. Non-Jacks clear both demands. Returns updated state or `INVALID`. The current implementation accepts but does not use `rng`. |
| `drawCard(state, rng?)` | Draws the full pending penalty or one card, reshuffling if needed, then advances the turn. Cannot draw while a skip is pending. Returns state or `INVALID`. |
| `passTurn(state)` | Accepts a pending skip, clears `pendingSkip`, and advances the turn. Returns state or `INVALID`; this is not a general pass action. |
| `nextRound(state, rng?)` | Starts the next round only from `roundOver`; otherwise returns `INVALID`. |
| `restartGame(state, rng?)` | Creates a fresh round-1 game using all existing players' names and bot flags, including eliminated players. Resets scores, elimination, hands, results, and pending fields. Works from any game phase. |
| `nextActive(state, from, steps = 1)` | Returns the seat index `steps` active seats clockwise from seat `from`, skipping eliminated players and wrapping around. Does not change state. Requires at least one non-eliminated player. |

### `src/logic/rules.js`

| Function | Arguments and result |
| --- | --- |
| `isTwo(card)` | Whether `card.rank === '2'`. |
| `isAceOfSpades(card)` | Whether the card is the Ace of Spades. |
| `isEight(card)` | Whether `card.rank === '8'`. |
| `isJack(card)` | Whether `card.rank === 'J'`. |
| `isSevenOfHearts(card)` | Whether the card is the 7 of Hearts. |
| `isSpecial(card)` | Whether the card is a 2, 8, Jack, Ace of Spades, or 7 of Hearts. Used for the first discard. |
| `topCard(state)` | Last element of `discardPile`; undefined for an empty pile. Normal games have a top discard. |
| `activeSuit(state)` | `chosenSuit` if present, otherwise the top discard's suit. This helper alone does not capture rank demands or penalties. |
| `isLegalPlay(state, card)` | Boolean legality under the ordered rules below. Does not check phase, card ownership, or whose turn it is. |
| `getPlayableCards(state, playerIndex)` | Legal cards in that seat's hand, preserving hand order. Returns `[]` unless phase is `playing` and `playerIndex === currentPlayer`. |

### `src/logic/bot.js`

`chooseBotMove(state)` returns an action for the current player during
`playing`: `{ type: 'PLAY_CARD', cardId, chosenSuit? }`, `{ type: 'DRAW' }`, or
`{ type: 'PASS' }`. It does not dispatch, delay, or mutate state.

Strategy:

1. Separate the playable 7 of Hearts from other playable cards.
2. If other cards exist, counter a draw/skip with the first one in hand order.
   Otherwise, if the next active player has at most three cards, play the first
   playable 2, Ace of Spades, or 8. If none qualifies, play the highest-point
   playable non-7-of-Hearts card; ties keep hand order.
3. If the 7 of Hearts is the only legal option, play it only when the remaining
   hand totals at most 20 points.
4. With no selected card, accept a pending skip with `PASS`; otherwise `DRAW`.
5. A Jack always demands a suit, never a rank: choose the most-held suit after
   excluding that Jack. Prefer the table suit if tied for maximum; otherwise
   the first maximum in `SUITS` order. With no remaining cards, use table suit.

### Other logic exports

| Module/function | Arguments and result |
| --- | --- |
| `deck.createDeck()` | Returns all 52 distinct card objects in suit/rank order. |
| `deck.shuffle(cards, rng = Math.random)` | Returns a shuffled copy of the array using Fisher–Yates; does not clone card objects or mutate the input array. |
| `scoring.cardPoints(card)` | Returns the card's penalty points, including suit-specific overrides. |
| `scoring.handPoints(hand)` | Returns the sum of `cardPoints` for a card array; empty hand is 0. |
| `gameReducer(state = initialState, action)` | Maps the actions below to engine calls; returns state or null. |

## Reducer actions

Every action may carry `expectedState`, the exact state object it was created
against. If this property exists and is not reference-equal to current state,
the reducer returns current state unchanged, without an event. This rejects
stale queued taps and bot timers. Do not serialize or clone this reference.

| Action | Payload and behavior |
| --- | --- |
| `START_GAME` | `{ type, players: [{ name, isBot? }, ...] }`; calls `createGame`, including when state is null. |
| `PLAY_CARD` | `{ type, cardId, chosenSuit?, chosenRank? }`; forwards these three fields to `playCard`. |
| `DRAW` | `{ type }`; calls `drawCard`. Drawing ends the turn. |
| `PASS` | `{ type }`; calls `passTurn` to accept a skip. |
| `NEXT_ROUND` | `{ type }`; from `roundOver`, calls `nextRound`; from `gameOver`, starts a fresh game via `restartGame`; during `playing`, leaves state unchanged. |
| `RESTART` | `{ type }`; calls `restartGame` in any non-null phase. |

Before a game exists, actions other than `START_GAME` leave null unchanged.
Unknown action types leave state unchanged. Reducer `NEXT_ROUND` behavior is
deliberately broader than direct engine `nextRound` behavior.

## `lastEvent` union

Events describe the most recent engine action, not a history array. The UI may
keep its own history. IDs below are player IDs, and `card` is a full Card object.

| Type | Complete fields |
| --- | --- |
| `PLAY` | `{ type: 'PLAY', playerId, card, chosenSuit: Suit \| null, chosenRank: Rank \| null, skippedId: string \| null }` |
| `DRAW` | `{ type: 'DRAW', playerId, card }` |
| `PENALTY_DRAW` | `{ type: 'PENALTY_DRAW', playerId, count }`; count is the number actually obtained, possibly fewer than the penalty if cards run out. |
| `SKIP` | `{ type: 'SKIP', playerId }`; player accepted the pending skip. |
| `DRAW_EMPTY` | `{ type: 'DRAW_EMPTY', playerId }`; no drawable cards remain after attempting a reshuffle. |
| `ROUND_START` | `{ type: 'ROUND_START', round }` |
| `ROUND_END` | `{ type: 'ROUND_END', endedBy, winnerId, reason, points, eliminatedIds }`; same result fields as `roundResult`, flattened into the event. |
| `INVALID` | `{ type: 'INVALID', reason }`; reasons listed below. |

`PLAY.skippedId` is set only when an 8 immediately skips the next active player
because that player holds no 8. If they hold an 8, it remains null and
`pendingSkip` becomes true. A round-ending play produces `ROUND_END` instead
of `PLAY`. Its reason is `SEVEN_OF_HEARTS` or `EMPTY_HAND`.

All invalid-action reasons, in validation order within each function:

| Function | Reasons and conditions |
| --- | --- |
| `playCard` | `NOT_PLAYING`: phase is not playing. `CARD_NOT_IN_HAND`: card ID is absent from current hand. `ILLEGAL_CARD`: rules reject the card. `JACK_NEEDS_DEMAND`: a legal Jack lacks exactly one valid suit/rank demand, or has an additional non-null demand. |
| `drawCard` | `NOT_PLAYING`: phase is not playing. `SKIP_PENDING`: skip must be countered or accepted. |
| `passTurn` | `NOT_PLAYING`: phase is not playing. `NOTHING_TO_PASS`: no pending skip. |
| `nextRound` | `ROUND_NOT_OVER`: phase is not roundOver. |

## Card points

| Cards | Points each |
| --- | --- |
| 7 of Hearts, Ace of Spades | 100 |
| Any 2, Jack, or 8 | 30 |
| Other Aces | 20 |
| 10, Queen, King | 10 |
| 3, 4, 5, 6, other 7s, 9 | 5 |

## Game rules

- Play clockwise with 2–6 players, seven cards each. Eliminated seats are skipped.
  The first discard cannot be special. Round 1 starts at seat 0; later rounds
  start with the active player with the lowest cumulative score, ties by seat.
- Legality is checked in this order: 7 of Hearts is always legal; a draw penalty
  allows only a 2 for `pendingType === 'two'`, otherwise an Ace; a pending skip
  allows only an 8; a Jack is wild; then match a suit demand, or rank demand;
  otherwise match the top discard by suit or rank.
- Each 2 stacks two penalty cards and sets type `two`. Ace of Spades starts five
  with type `ace`; any Ace stacks five on an Ace penalty. Other Aces played
  without an Ace penalty have no effect.
- An 8 offers the next active player a counter if they hold an 8. Playing it
  passes the skip onward under the same rule; `PASS` accepts the skip. A player
  with no 8 is skipped immediately. In a two-player game this can return the
  turn to the player who played the 8.
- A Jack demands exactly one suit or rank. Another Jack can replace a demand;
  a non-Jack play clears both. Drawing or accepting a skip leaves demands intact.
- Drawing takes the whole pending penalty, or one ordinary card, and always
  advances the turn. It is forbidden during a pending skip. Empty draw piles
  reshuffle the discard pile except its top card; an exhausted deck still ends
  the turn. Taking a penalty clears `pendingDraw` and `pendingType`.
- The 7 of Hearts ends the round immediately, before the empty-hand check.
  Otherwise an empty hand ends it. Terminal plays apply no further penalty/skip.
- Every player active at round end adds their leftover hand points, including
  the 7-of-Hearts player. An empty-hand winner adds zero. Already eliminated
  players are absent from the round's points map and are not scored again.
- Scores of 502 or more eliminate players. If all active players cross the
  threshold, the lowest total survives, ties by seat. Scores are not reduced.
  One survivor ends the game and sets overall `winnerId`; otherwise another
  round is available. A 7-of-Hearts round has no round winner even if that round
  also determines an overall game winner.

## Small UI mock

This abbreviated two-player snapshot is for rendering, not full-deck simulation.
The current player can answer the pending 8 with `8C` or accept the skip.

```js
const mockState = {
  players: [
    { id: 'p0', name: 'Nawal', isBot: false,
      hand: [{ id: '8C', rank: '8', suit: 'clubs' }],
      score: 35, eliminated: false },
    { id: 'p1', name: 'Bot 1', isBot: true,
      hand: [{ id: 'KD', rank: 'K', suit: 'diamonds' }],
      score: 60, eliminated: false },
  ],
  drawPile: [{ id: '3S', rank: '3', suit: 'spades' }],
  discardPile: [{ id: '8H', rank: '8', suit: 'hearts' }],
  currentPlayer: 0,
  roundStarter: 0,
  round: 1,
  phase: 'playing',
  pendingDraw: 0,
  pendingType: null,
  pendingSkip: true,
  chosenSuit: null,
  chosenRank: null,
  roundResult: null,
  winnerId: null,
  lastEvent: {
    type: 'PLAY', playerId: 'p1',
    card: { id: '8H', rank: '8', suit: 'hearts' },
    chosenSuit: null, chosenRank: null, skippedId: null,
  },
};
```
