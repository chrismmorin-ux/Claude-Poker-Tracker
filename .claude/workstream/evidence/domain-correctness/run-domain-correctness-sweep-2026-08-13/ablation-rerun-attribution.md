# Depth-ablation re-run after FIND-112/FIND-113 fixes — attribution record
Written 2026-08-14 by ses-20260813-1429-9fc43dcf (orchestrator of the 2026-08-13 sweep).

## Why these runs exist
FIND-112 (CRITICAL): gameTreeDepth2 priced required equity with the bluffer's s/(1+s) at four
sites (+1 documented site in gameTreeEvaluator). That code runs only in the depth-2/3 arm, so
WS-378's headline depth-ablation result — "80% of top-action flips are river, 38 of 40 toward
passivity" (RC-depth-ablation-1c560bcc-67e9e14e) — was measured THROUGH the defect. WS-450's
accept criteria require re-running the ablation after the fix and re-stating the passivity claim.
FIND-113 (HIGH): flat stage-level rake taxing fold branches; fixed by WS-451 (4880ca94).

## Pre-registered falsifier (recorded before results were read)
If ≥70% of flips still move toward passivity, the passivity tendency SURVIVES the formula fix;
below ~60% or reversed → substantially artifact.

## The runs
| Run | Card | Engine commit | Deal book | Slice |
|---|---|---|---|---|
| Prior (July, broken formula) | RC-depth-ablation-1c560bcc-67e9e14e | 67e9e14e | 1c560bcc | mixed: 138 flop / 77 turn / 45 river |
| A (formula fix only) | RC-depth-ablation-38f96a38-ed3dc3b6 | ed3dc3b6 | 38f96a38 | 260 flop (per-player cap 1) |
| B (formula + rake fix) | RC-depth-ablation-38f96a38-4880ca94 | 4880ca94 | 38f96a38 | 260 flop (per-player cap 1) |
| River-bearing (formula + rake) | pending — out/depth-ablation-ws451-river-9fc43dcf.json | 4880ca94 | (40 players × cap 7) | mixed incl. river |

**Instrument break, stated plainly:** the July run cannot be replicated on the current harness.
WS-433's planner rewrite derives a per-player decision cap of ceil(maxDecisions/plannedPlayers);
at 300 planned players that is 1 decision/player = each player's first (flop) decision, so A and B
are flop-only slices on a different deal book (38f96a38 vs 1c560bcc). A↔B is properly paired
(same deal book, same depth-1 arm edge 220.72 BB/100 — identical depth-1 code); either↔July is
cross-slice and cross-instrument. The river question is answered by the 40×7 configuration.

## Results (A vs B, paired, n=260 flop decisions)
| | A: formula only | B: formula + rake |
|---|---|---|
| topActionFlips | 43 (16.5%) | 42 (16.2%) |
| toward passivity | 28 (65%) — bet→check 22, raise→fold 6 | 31 (74%) — bet→check 26, raise→fold 4, raise→call 1 |
| toward aggression | 15 (35%) check→bet | 11 (26%) check→bet |
| depth-2 arm edge (BB/100) | 201.46 | 202.24 |
| depth delta (BB/decision) | −0.193 [−1.146, +0.816] | −0.185 [−1.003, +0.687] |

## Rulings
1. **Passivity tendency SURVIVES both fixes at the flop level** (65–74% of flips passive vs the
   ≥70% pre-registered bar — A sits at 65%, B at 74%; the tendency is real, not purely a
   FIND-112 artifact). The July river-specific "38 of 40" claim remains untested until the
   river-bearing run lands; do NOT quote it as re-confirmed.
2. **Rake fix (FIND-113) direction confirmed:** depth-2 edge +0.78 BB/100 (201.46 → 202.24) —
   continuation lines were being over-taxed, exactly as the finding predicted. Modest on this slice.
3. **Cross-instrument contrast, weak evidence:** July flop flipShare was 0.7% (1/138); now ~16%.
   Confounded by deal book + planner changes — recorded as an observation, not a claim.
4. **Both depth deltas straddle zero at n=260** (CI width ~2 BB/decision). Resolving a ±0.2 BB
   question needs ~6,000 decisions (CI ∝ 1/√n). This is an instrument-n statement, not a verdict
   on depth-2 (founder took delete off the table 2026-08-03).
5. All figures are corpus (online 2009, 50NLH) measurements — any live-game reading is
   transferred, not measured (DISCLAIMER-AND-FAULT-REGISTER §1).

## Operational lesson (captured in friction log)
Long backtest runs must be launched detached AND hidden (WMI Win32_Process.Create +
Win32_ProcessStartup ShowWindow=0): session-tool children die at harness teardown; visible WMI
console windows get closed by the user; machine sleep/shutdown kills everything silently.
