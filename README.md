# 502 Card Game

An Expo / React Native implementation of 502 with a pure JavaScript game engine,
computer players, shared game state, and a temporary phone debugging screen.

The current app starts a three-player game with **Nawal**, **Bot 1**, and **Bot 2**.
The project uses Expo SDK 58, React 19.3, and React Native 0.88.1.

## Run locally

Install the locked dependencies and start Expo:

```sh
npm ci
npm start
```

Use the Expo terminal instructions to open the app on your phone. The project
also provides `npm run android`, `npm run ios`, and `npm run web` commands;
platform-specific runtime requirements still apply.

When adding an Expo/native package, use `npx expo install <package>` to resolve a
compatible version. See [AGENTS.md](AGENTS.md) for the project's Expo documentation
and development requirements.

## Implemented gameplay

- One 52-card deck, 2–6 players, seven cards per active player.
- Match the top discard by suit or rank. Drawing always ends the turn.
- Twos stack penalties by two. The Ace of Spades starts a fixed five-card
  penalty; any Ace can pass it on without increasing it.
- Eights skip the next active player, who can counter with an eight or accept
  the skip. Accepting a skip does not draw cards.
- Jacks are wild and demand a suit only.
- Pending penalties take priority: only a two, Ace, or eight can answer its
  corresponding pending action. Jacks and the 7 of Hearts cannot bypass it.
- A legal 7 of Hearts wins the round immediately. Its player's remaining hand
  is scored, and the round winner is protected from elimination for that round.
- Going out on a penalty card forces the next player to take the penalty before
  scoring, including accumulated twos. There is no final counter opportunity.
- Round starters are selected using the previous round's points, not cumulative
  scores. The first round starts with seat 0.
- Players reach elimination at 502 total points, subject to round-winner
  protection. Restart restores all players and resets scores and hands.

| Cards | Points |
| --- | --- |
| 7 of Hearts, Ace of Spades | 100 |
| Two, eight, Jack | 30 |
| Other Aces | 20 |
| Ten, Queen, King | 10 |
| Three, four, five, six, other sevens, nine | 5 |

## Engine and state safety

The engine returns new states without mutating its inputs. Rejected actions use
`lastEvent: { type: 'INVALID', reason }`.

Active-seat traversal skips null, sparse, malformed, and eliminated records.
Current-player validation uses the same requirements: an object with a nonempty
string ID, string name, boolean bot flag, array hand, finite numeric score, and
`eliminated === false`. Unknown pending penalty types reject every card.
These checks are targeted safeguards, not validation of arbitrary saved games.

The context's stable dispatch wrapper supplies an `expectedState` snapshot when
omitted. The reducer rejects stale snapshots, preventing queued actions from
consuming subsequent turns. Direct reducer callers should supply snapshots when
they need this protection; deferred actions must retain their original snapshot.

Bot turns wait 900 ms. Timers are one-shot, cancelled on state changes/unmount,
and carry explicit snapshots so stale callbacks cannot change a restarted game
or a later round. Human elimination does not stop eligible bot turns.

## Debug screen

The temporary screen provides playable-card highlighting, Draw, Accept skip,
Next Round, and Restart. It also shows player hand counts, scores, pile sizes,
pending actions, round results, and the eight most recent events.

The engine is suit-only for Jacks. The existing screen still includes legacy
rank-demand buttons; those requests return `INVALID/JACK_NEEDS_SUIT`.
Use the suit buttons when testing a Jack.

## Tests and checks

```sh
npm run test:logic
```

The suite covers rules, scoring, malformed-state validation, reducer transitions,
guarded dispatch, and fake-timer integration. It includes **500 seeded full bot
games**, with 2–6 players and a 20,000-move limit per game. Simulations check
accepted actions, card conservation, independent scoring and penalty outcomes,
round starters, and a single surviving winner. Failures include the seed.

Run the focused dispatch/timer integration tests with:

```sh
node --test --test-name-pattern="^integration:" tests/state.test.js
```

The integration tests use real reducer/dispatch/scheduler interactions with
simulated commits. They do not mount `GameProvider` or `useBotTurns`: no compatible
project-local React test renderer or DOM test environment is installed. Device
testing remains necessary for actual React/native lifecycles and rapid input.

Project checks specified in AGENTS.md are:

```sh
npx expo lint
npx tsc --noEmit
```

ESLint configuration/tooling and TypeScript checking are not currently configured
as a working local check setup. Previous attempts were blocked by unavailable
package downloads; a passing logic suite is not a substitute for those checks.

## Code map

| Path | Responsibility |
| --- | --- |
| `src/logic/` | CommonJS engine, legal moves, scoring, deck, and bot strategy |
| `src/state/` | Reducer, context, guarded dispatch, and input cooldown |
| `src/hooks/` | Bot scheduling and React lifecycle integration |
| `src/screens/DebugScreen.js` | Temporary phone testing interface |
| `tests/engine.test.js` | Engine/scoring/validation regressions |
| `tests/bot.test.js` | Bot decisions and 500-game stress test |
| `tests/state.test.js` | Reducer, dispatch, timer, and integration regressions |
| [docs/CONTRACT.md](docs/CONTRACT.md) | Full state, APIs, actions, events, and rule interpretations |

## Unverified rule details and limitations

- Opening eights remain rejected as legacy behavior; this is not verified as a
  published standard rule. Every Ace, two, Jack, and 7 of Hearts is rejected.
- Round-winner protection takes precedence over the reference's ambiguous
  all-players-crossing-502 fallback. Equal previous-round points use seat order.
- If no permitted opener remains after dealing, the engine reports
  `NO_OPENING_CARD`; it does not invent an automatic redeal rule.
- Phone verification is still needed for rapid taps, bot thinking during
  Restart/Next Round, unmount cleanup, and eliminated-human spectator flow.

See the [contract](docs/CONTRACT.md) for the exact interpretation and scope of
each safeguard before changing rules or integrating a new screen.
