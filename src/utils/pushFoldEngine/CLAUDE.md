# Push/Fold Engine — Domain Rules

**MANDATORY**: read `.claude/context/POKER_THEORY.md` **§10.4 (Push/Fold Is a $EV Decision)** (and §10.3/§10.5 on labels) before editing. Governed by `prog-domain-correctness`.

## What this is
Binary SHOVE / FOLD / CALL verdicts for short stacks (≤15bb effective), computed from first principles: fold-equity + equity-vs-range + ICM-adjusted required equity (via `icmEngine`). A decision layer above `icmEngine` + `pokerCore` equity + population ranges.

## Files
| File | Does |
|------|------|
| `effectiveStack.js` | Effective stack in BB (`min(hero, villain)/bb`); read from state, never user-input |
| `pushFold.js` | `computeCallVerdict` (rigorous: equity vs ICM-adjusted pot odds) + `computeShoveVerdict` ($EV jam; chip-EV when no payouts) |

## Anti-patterns (do not regress)
- **DO NOT drive the verdict from M-ratio / icmPressure zone labels.** They are descriptors (§10.3/§10.5). Compute from $EV / equity / stacks / payouts. Zone labels are for the eff-stack *ladder display* only.
- **DO NOT show mixed strategies.** Push/fold is binary (persona rule).
- **DO NOT require the user to input the effective stack.** Read it from state; no source → no verdict.
- **DO NOT hardcode a Nash/SAGE chart as truth.** Compute + cache. The villain CALLING range (shove case) is a population model assembled by the caller — a documented approximation; the CALL-vs-shove case is exact (equity vs ICM pot odds).
- **DO NOT use chip-EV near the money.** ICM-adjust via `computeRiskPremium` whenever a payout ladder exists (§10.4).

## Correctness signatures (tests)
- Premium hands SHOVE at 10bb; trash FOLDS.
- CALL-vs-shove respects pot odds (chip-EV) and tightens under ICM near the bubble (required equity rises).
- Graceful chip-EV-only when no payouts.
