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

## Rules

- **No engine imports**: These files must never import from `exploitEngine/` or `rangeEngine/`
- **No player data**: These are card/board/range utilities — no player-specific logic
- **Internal imports OK**: Files here may import from each other (e.g., `handEvaluator` imports `cardParser`)
