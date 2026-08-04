# Poker Core — Shared Infrastructure

Pure poker utilities with zero dependencies on `rangeEngine/` or `exploitEngine/`. Both engines import from here; this directory imports from neither.

## Files

| File | Purpose |
|------|---------|
| `cardParser.js` | Card string ↔ integer encoding (e.g., "Ah" ↔ 0) |
| `rangeMatrix.js` | 13×13 grid utilities, GTO preflop charts, combo math |
| `handEvaluator.js` | 5-card hand ranking (high card through straight flush) |
| `boardTexture.js` | Board wetness/connectedness/pairing classification |
| `monteCarloEquity.js` | Monte Carlo hand-vs-range equity calculation (moved from exploitEngine/ in RT-35) |
| `situationKey.js` | THE canonical definition of "a spot" — axis names, wire order, weakness matching (WS-317) |
| `holdingKnowledge.js` | The belief/truth join: inferred range + revealed holding + narrowing provenance (WS-292) |

## Rules

- **No engine imports**: These files must never import from `exploitEngine/` or `rangeEngine/`
- **No player data**: These are card/board/range utilities — no player-specific logic
- **Internal imports OK**: Files here may import from each other (e.g., `handEvaluator` imports `cardParser`)

## Revealed cards are a scoring channel (WS-292)

A hand that reached showdown may be used to **grade** an inference and never to **edit** one.
Correcting a range using the holding it is meant to be scoring produces a model that reports
excellent calibration however bad it is — FIND-038 is that shape already shipped, where
`sizingTells` claimed showdown confirmation while correlating against the model's own
`avgSegmentation`.

`holdingKnowledge.js` enforces this structurally: revealed cards are held in a module-private
WeakMap, so they survive neither destructuring, spread, nor JSON, and `revealedHolding()` is
the only way to reach them. **Grep that name when reviewing** — every call is a place ground
truth enters a computation, and a new one on a live recommendation path is the failure the
module exists to prevent. `gameTreeContext` is guarded by test: its record can never carry a
holding, because showdown is later than the decision hero is being advised on.
