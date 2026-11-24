# 502 game contract

This document describes the current implementation in `src/logic/`, state
management, and bot scheduling. Standard-rule sources:
[Rules](https://502-game.vercel.app/rules) and
[FAQ](https://502-game.vercel.app/faq).

The engine uses plain CommonJS JavaScript and immutable state transitions.
Successful actions clone state with `JSON.parse(JSON.stringify(state))`.
Invalid actions return `{ ...state, lastEvent: { type: 'INVALID', reason } }`.
Before a game exists, the reducer keeps `null` on invalid input rather than
exposing a partial game object to screens. There are no broad catch blocks.

## Cards, players, constants and points

Cards are `{ id, rank, suit }`; IDs use rank plus uppercase suit initial, e.g.
`7H`, `AS`, `10C`. Player IDs are `p0`, `p1`, etc. Seating indices are numbers.

`constants.js` exports:

- `SUITS`: `['spades', 'hearts', 'diamonds', 'clubs']`.
- `RANKS`: `['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']`.
- `RULES`: `{ handSize: 7, minPlayers: 2, maxPlayers: 6, eliminationScore: 502,
  twoPenalty: 2, aceOfSpadesPenalty: 5 }`.
- `CARD_POINTS`: rank defaults. Use `cardPoints` for suit-specific overrides.

| Cards | Points each |
| --- | --- |
| 7 of Hearts and Ace of Spades | 100 |
| Any 2, 8, Jack | 30 |
| Other Aces | 20 |
| 10, Queen, King | 10 |
| 3, 4, 5, 6, other 7s, 9 | 5 |

## State and UI mock

The reducer's exported `initialState` is `null`. A started game has all fields
shown below. This short mock is for rendering, not full-deck simulation:

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
  roundResult: null,
  winnerId: null,
  lastEvent: {
    type: 'PLAY', playerId: 'p1',
    card: { id: '8H', rank: '8', suit: 'hearts' },
    chosenSuit: null, skippedId: null,
  },
};
```

- `players`: all seats, including eliminated players. `score` is cumulative.
- Piles are Card arrays; their **last element** is drawn or is the top discard.
- `currentPlayer` and `roundStarter`: seat indices. `round` starts at 1.
- `phase`: `playing`, `roundOver`, or `gameOver`.
- `pendingDraw`: nonnegative number; 2s accumulate, Ace penalties stay at five.
- `pendingType`: `null`, `two`, or `ace`.
- `pendingSkip`: boolean; the current player may counter with an 8 or accept.
- `chosenSuit`: null or a suit demanded by a Jack.
- `winnerId`: null during play/roundOver; overall surviving player ID at gameOver.
- `lastEvent`: null in the internal initial base, otherwise an event below.
- `roundResult`: null during play, otherwise the following shape:

```js
const roundResult = {
  endedBy: 'p0',
  winnerId: 'p0', // actual round winner for BOTH ending reasons
  reason: 'SEVEN_OF_HEARTS', // or 'EMPTY_HAND'
  points: { p0: 20, p1: 30 }, // points added, for players active this round
  eliminatedIds: [], // newly eliminated players only
};
```

There is no drawn-card waiting field or rank-demand state. Round start/end
clear `pendingDraw`, `pendingType`, `pendingSkip`, and `chosenSuit` to
`0`, `null`, `false`, and `null`. They also discard obsolete rank-demand fields
from legacy snapshots. Start clears the previous result and overall winner.
End retains hands for inspection; next round empties eliminated players' hands.

## Exported logic functions

Every optional `rng` defaults to `Math.random` and must return values in `[0, 1)`.
Seeded RNGs make shuffles, including terminal-penalty reshuffles, replayable.

### `engine.js`

| Function | Arguments and behavior |
| --- | --- |
| `createGame(playerConfigs, rng?)` | 2–6 `{ name: string, isBot? }` configurations. Assigns IDs, coerces bot flags, zeros scores and deals round 1. Invalid count/configurations return `INVALID_PLAYERS`, not an exception. |
| `startRound(prev, rng?)` | Low-level initialization: clones a game, increments round, shuffles/deals, resets pending state and chooses the starter. Does not validate phase; normal callers use `nextRound`. No active players returns `NO_ACTIVE_PLAYERS`. Missing players returns `INVALID_STATE`. |
| `playCard(state, action = {}, rng?)` | `action` contains `cardId` and optional `chosenSuit`. Plays current player's card, applies effects and may finish/scoring the round. A Jack requires a valid suit. Legacy rank demands are rejected, not executed. Uses RNG if a final penalty requires reshuffling. |
| `drawCard(state, rng?)` | Takes all owed cards, or one normal card, then ends turn. A pending skip forbids drawing. |
| `passTurn(state)` | Accepts a pending skip only, clears it and advances clockwise without drawing. |
| `nextRound(state, rng?)` | Valid only from `roundOver`; calls `startRound`. |
| `restartGame(state, rng?)` | Recreates the game using all player names and bot flags. Resets scores, eliminations, hands, round and results; valid from any normal phase. Missing players returns `INVALID_STATE`. |
| `nextActive(state, from, steps = 1)` | Finds the seat `steps` valid active seats clockwise from `from`. Returns `-1` if no valid active player exists or index/step arguments are invalid. `from = -1` searches from before seat 0. With `steps = 0`, valid arguments and at least one valid active player, returns the supplied `from` unchanged; it does not independently verify that the `from` seat is active. |

For `nextActive()`, a valid active player must satisfy every requirement:

- A non-null, non-array object.
- A non-empty string `id`.
- A string `name`.
- A boolean `isBot`.
- An array `hand`.
- A finite numeric `score`.
- `eliminated === false`.

Malformed entries and sparse-array holes are unavailable seats during traversal.
The malformed-seat skipping guarantee applies to `nextActive()` only. Other
engine operations are not guaranteed to handle arbitrary malformed player
records or corrupted saved-game state.

If the undealt deck contains no permitted opening card, `startRound` returns
`NO_OPENING_CARD` against the unchanged prior state. It never accepts a forbidden
card after a retry limit. No automatic redeal rule is invented. A failed initial
START_GAME leaves reducer state null; a caller can retry starting the game.

### `rules.js`

| Function | Arguments and result |
| --- | --- |
| `isTwo(card)` | Whether rank is 2. |
| `isAceOfSpades(card)` | Whether card is Ace of Spades. |
| `isEight(card)` | Whether rank is 8. |
| `isJack(card)` | Whether rank is Jack. |
| `isSevenOfHearts(card)` | Whether card is 7 of Hearts. |
| `isSpecial(card)` | Whether card is 2, 8, Jack, Ace of Spades or 7H. Classification only; does not by itself define opening legality. |
| `isOpeningCard(card)` | Whether card can open under the current policy: rejects every Ace, 2, Jack, 7H, and legacy opening 8s. False for a missing card. |
| `topCard(state)` | Last discard, or undefined if state/pile is absent or empty. |
| `activeSuit(state)` | Suit demand, otherwise top-card suit, otherwise null. Does not encode penalty restrictions. |
| `isLegalPlay(state, card)` | False for a missing card or top discard. Otherwise checks penalty, skip, wild cards, suit demand, then normal suit/rank matching in that order. Does not check card ownership or phase. |
| `getPlayableCards(state, playerIndex)` | Legal cards in hand order. Empty unless playing and this is the current non-eliminated seat with a hand. |

The card-identity predicates expect a Card object. The engine does not attempt
to validate arbitrary corrupted saved games, cyclic objects, or invalid RNGs.

### `deck.js` and `scoring.js`

| Function | Arguments and result |
| --- | --- |
| `createDeck()` | Fresh 52-card deck in suit/rank order. |
| `shuffle(cards, rng?)` | Fisher–Yates shuffled array copy; card objects are not cloned. |
| `cardPoints(card)` | Points from the table, including suit-specific overrides. |
| `handPoints(hand)` | Sum of card points; empty hand returns zero. |

### `bot.js`

`chooseBotMove(state)` is called during a valid playing turn. Returns
`{ type: 'PLAY_CARD', cardId, chosenSuit? }`, `{ type: 'DRAW' }`, or
`{ type: 'PASS' }`; never dispatches or mutates state.

1. Get legal cards; keep 7H separate. Pending restrictions exclude Jack and 7H.
2. With another legal card, counter pending draw/skip using the first card in
   hand order. Otherwise threaten a next active player holding at most three
   cards with the first playable 2, Ace of Spades or 8.
3. Otherwise shed the highest-point non-7H legal card; ties keep hand order.
4. Play 7H only when it is the sole legal option and remaining hand points are
   at most 20. This is a bot heuristic, not a game legality restriction.
5. If nothing selected, PASS on pending skip, otherwise DRAW.
6. A Jack names the most-held remaining suit excluding that Jack. Ties prefer
   the table suit if it is tied for maximum; otherwise SUITS order. Empty hand
   uses table suit. No table suit falls back to the first suit.

## State management, actions and timer lifecycle

`gameReducer(state = initialState, action)` and `initialState` are CommonJS
exports from `state/gameReducer.js`.

| Action | Payload and transition |
| --- | --- |
| `START_GAME` | `{ type, players }`; calls createGame. Invalid starts preserve existing state and report the reason; before initialization they preserve null. |
| `PLAY_CARD` | `{ type, cardId, chosenSuit? }`; forwards these fields. A non-null legacy rank demand reports `JACK_NEEDS_SUIT`. |
| `DRAW` | `{ type }`; calls drawCard, which ends the turn. |
| `PASS` | `{ type }`; calls passTurn to accept a skip. |
| `NEXT_ROUND` | `{ type }`; roundOver starts the next round; gameOver restarts a fresh game; playing is unchanged. |
| `RESTART` | `{ type }`; calls restartGame from any non-null game phase. |

Unknown string action types are no-ops. Null, non-object, array, missing-type or
non-string-type actions produce INVALID_ACTION against an existing game.
Before initialization malformed actions preserve null. Normal actions other
than START_GAME also preserve null until a game exists.

`GameContext.js` exports `GameProvider({ children })` and `useGame()`.
The provider uses the reducer and returns a stable guarded dispatch function.
`useGame()` returns `{ state, dispatch }`, throwing if outside a GameProvider.

`guardedDispatch.js` exports `createGuardedDispatch(dispatch, getState)`.
It returns a dispatcher attaching `expectedState: getState()` when omitted;
explicit snapshots are preserved. The provider's getter reads the latest
committed state. Batched double actions share a snapshot, so only the first
can change it. The reducer ignores an action with a snapshot that is not
reference-equal to its state, without changing lastEvent. Raw direct reducer
callers remain compatible without snapshots; they do not gain automatic
deduplication. Deferred callers must capture their original snapshot explicitly.
Malformed actions are forwarded for reducer validation.

`hooks/useBotTurns.js` default-exports `useBotTurns()`, called once by the screen.
It uses layout-effect cleanup to cancel when state changes or on unmount.
`hooks/scheduleBotTurn.js` exports
`scheduleBotTurn(state, dispatch, schedule = setTimeout, cancel = clearTimeout)`.
It schedules only a playing, non-eliminated bot, waits 900 ms, chooses and
forwards PLAY_CARD/DRAW/PASS with an explicit expectedState. Returns a cleanup
function, or undefined if no bot is eligible. Cleanup cancels the timer and
marks the callback inactive. Each callback can fire only once. Stale actions
are rejected by the reducer even before cleanup. Human elimination does not
stop bot turns; Next Round remains a manual screen action.

## Events and invalid reasons

`lastEvent` is one event, not a history array. Terminal plays emit ROUND_END
instead of PLAY; their mandatory penalty draws are already included in hands,
round points and cumulative scores, not emitted as a separate intermediate event.

| Type | Complete fields |
| --- | --- |
| PLAY | `{ type: 'PLAY', playerId, card, chosenSuit: suit-or-null, skippedId: playerId-or-null }` |
| DRAW | `{ type: 'DRAW', playerId, card }` |
| PENALTY_DRAW | `{ type: 'PENALTY_DRAW', playerId, count }`; actual number obtained. |
| SKIP | `{ type: 'SKIP', playerId }`; player accepted skip. |
| DRAW_EMPTY | `{ type: 'DRAW_EMPTY', playerId }` |
| ROUND_START | `{ type: 'ROUND_START', round }` |
| ROUND_END | `{ type: 'ROUND_END', endedBy, winnerId, reason, points, eliminatedIds }` |
| INVALID | `{ type: 'INVALID', reason }` |

PLAY.skippedId is populated when an 8 immediately skips a player without an 8.
Otherwise it is null, including when the next player has a countering 8.

| Reason | Meaning |
| --- | --- |
| NOT_PLAYING | Play/draw/pass outside playing phase. |
| INVALID_STATE | Missing players, invalid/eliminated current seat, missing hand/draw pile/top discard, or invalid round/restart state. |
| NO_ACTIVE_PLAYERS | Navigation has no active seat; round or turn action is rejected. |
| INVALID_ACTION | Malformed play payload or reducer action. |
| INVALID_PLAYERS | Invalid game configurations or count outside 2–6. |
| NO_OPENING_CARD | No allowed opener remains after dealing; no state is partially committed. |
| CARD_NOT_IN_HAND | Missing/unowned card ID. |
| ILLEGAL_CARD | Card violates the ordered legal-play rules. |
| JACK_NEEDS_SUIT | Jack lacks a valid suit, or legacy rank demand was supplied. |
| SKIP_PENDING | Draw attempted while skip is pending. |
| NOTHING_TO_PASS | PASS without pending skip. |
| ROUND_NOT_OVER | Direct engine nextRound outside roundOver. |

Turn functions first validate phase and basic turn state. playCard then validates
payload, ownership, legality and Jack suit, in that order. The reducer checks
malformed actions, then stale snapshots before executing its action branches.

## Standard rules and explicit interpretations

- Play clockwise with 2–6 players; deal seven to each active seat. First-round
  starter is seat 0 in a normal new game. Elimination removes seats from turns.
- Reject opening 2s, Jacks, every Ace and 7H, placing them at the deck bottom.
- Penalties come first: only a 2 answers pending twos; only an Ace answers an
  Ace penalty; only an 8 counters a skip. Jack and 7H cannot bypass these.
- On an ordinary turn, Jack and 7H are wild. Otherwise follow a suit demand or
  match the discard by suit/rank. Jack demands a suit only. Other plays clear it;
  drawing or accepting a skip does not clear an unanswered suit demand.
- Each 2 adds two. Ace of Spades starts exactly five; any Ace passes exactly
  five, never adding five. Other Aces have no independent attack effect.
- An 8 offers the next active seat a counter if they have an 8, otherwise skips
  them immediately. Accepting costs the turn, not cards; Draw is forbidden.
- Drawing takes a full penalty or one ordinary card and always ends the turn.
  Reshuffle all discards except top when needed. If cards truly run out, draw
  as many as possible; ordinary DRAW_EMPTY still advances the turn.
- A legal 7H immediately wins the round, even with cards left. Otherwise an
  empty hand wins. A final 2 applies the full accumulated draw before scoring;
  a final Ace attack/counter applies five. No counter is allowed after going
  out. A terminal 8 does not create another response turn.
- Score every active player's remaining hand after mandatory draws. The round
  winner scores leftovers too, but cannot be eliminated that round. Protection
  lasts one round, not permanently. Others at 502 or higher are eliminated.
- With one survivor, finish game and set overall winnerId. Otherwise preserve
  round results until Next Round. Restart resets everyone, including eliminated
  players. Scores never decrease because of protection.
- Next starter uses the lowest previous-round points among active players,
  not cumulative totals. No winner-start override is added when a 7H winner
  took more points. Equal points retain first seat as the existing deterministic
  tie convention; missing historical points default to zero for old/manual states.

Unverified/reference limitations:

1. **Opening 8:** the reference's explicit rejection list omits 8. No reference
   game source exists in this project to settle that omission. Existing 8
   rejection is retained and tested as legacy behavior, not verified standard.
2. **Winner protection versus all-cross fallback:** the reference also mentions
   lowest total winning if everyone crosses 502. This conflicts with eliminating
   a protected round winner. This implementation prioritizes the task's explicit
   unconditional winner protection: the protected winner remains and all other
   threshold-crossing players leave. That priority needs reference-owner
   confirmation; no alternative lowest-total override is silently applied.
3. **Equal previous-round points:** seat-order tie-breaking is retained as an
   implementation convention, not claimed as a published tie rule.
4. **No available opener:** reference gives no recovery rule when all undealt
   cards are forbidden openers. Report INVALID/NO_OPENING_CARD and let the caller
   retry; no automatic redeal or forced forbidden opening is invented.
5. **Frozen UI boundary:** existing DebugScreen rank buttons remain untouched.
   They now report INVALID/JACK_NEEDS_SUIT; suit buttons remain functional.
   Removing those buttons/display labels is a separate UI-owner change.

Manual phone validation is still needed for rapid input, bot timers during
Restart/Next Round/unmount, eliminated-human spectator flow and Jack suit buttons.
