# ICM Engine — Domain Rules

**MANDATORY**: Before editing ANY file here, read `.claude/context/POKER_THEORY.md` **§10 (Tournament & ICM)**. This engine implements that doctrine; it is governed by `prog-domain-correctness` exactly like `exploitEngine/`/`rangeEngine/`.

## What this engine is
Converts `{ chip stacks } + { payout ladder } → { $EV per player }` (Malmuth-Harville), and derives hero's **risk premium / bubble factor** — the extra equity needed before an all-in is +$EV. This is the math behind tournament strategy: **tournament chips are not dollars** (§10.1).

## Files
| File | Does | Does NOT |
|------|------|----------|
| `malmuthHarville.js` | Exact ICM $EV (`computeIcmEquity`); proportional fallback for oversized fields | Assemble stacks or model decisions |
| `buildIcmStacks.js` | Assemble the modeled field from live tournament state; flag exact vs approximate vs too-large | Compute $EV |
| `riskPremium.js` | Risk premium / bubble factor + ICM-required equity for an all-in | Build trees or pick opponents (caller supplies the spot) |

## Anti-patterns (§10.8 — do not regress)
- **DO NOT use chip-EV for tournament decisions near the money.** Use ICM $EV. Chip-EV ≈ $EV only deep early or when the pay structure behind hero is locked.
- **DO NOT drive output from M-ratio / bubble-distance zone labels.** They are descriptors (§10.3, §10.5). Compute from $EV / stacks / payouts / players-remaining — parallel to the §7 position-label rule.
- **DO NOT present approximated multi-table ICM as exact.** `buildIcmStacks` returns `isApproximate` / `tooLarge`; consumers MUST surface that and never show a falsely-precise figure (§10.6).
- **DO NOT special-case satellites.** Represent flat/identical payouts in the ladder and let ICM produce the survival strategy (§10.7).
- **DO NOT confuse the pot with the decision.** A chip is still a chip for splitting a *side pot* (that math is unchanged); ICM changes the call/fold/shove *decision*, not pot resolution.

## Correctness signatures (the tests assert these)
- `Σ computeIcmEquity === Σ payouts` (conservation).
- Chip leader's $EV `<` proportional chip share; short stack's `>` its share (the ICM tax — if absent, the model is wrong).
- Equal stacks → equal $EV.
- Risk premium / bubble factor rises approaching the bubble and pay jumps.
