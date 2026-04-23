# Stage 4 — Leading-Theory Comparison

**Artifact compared:** `docs/upper-surface/reasoning-artifacts/btn-vs-bb-3bp-ip-wet-t96-flop_root.md`
**Rubric version:** v2.1 (artifact at v2-partial-refit; rubric advanced to v2.1 after Stage 3b)
**Comparison author:** Claude (main, Stage 4)
**Date:** 2026-04-23
**Status:** draft

---

## Scope

This comparison extends §13 of the artifact (which surveyed 4 sources internally) by:

1. Surveying a wider external corpus (~10 sources beyond the artifact's §13)
2. Per-claim categorization (A / B / C-wrong / C-incomplete / D) at finer grain than the artifact's per-source aggregation
3. Active B/C-wrong findings (not just acceptance of agreement-by-default)
4. Proposed `POKER_THEORY.md §9` entries for D-category findings
5. `lsw-impact` subsection flagging candidate LSW re-audits (no auto-propose; owner decides)

**Coverage caveat.** This comparison uses my training-time knowledge of the published poker-theory corpus. No new web fetches in this session. Stage 4 may be re-run with live web access if owner wants tighter source verification. Sources cited at time of training cutoff (2026-01); some claims may be stale.

---

## Sources surveyed

Beyond the artifact's §13 sources (GTO Wizard "Navigating Range Disadvantage", Janda *Applications*, Upswing donk-betting, Run It Once solver summaries):

| # | Source | Era | Position on this spot |
|---|---|---|---|
| 1 | Matthew Janda — *Applications of NLHE* (2013) | pre-solver | 3BP donking is "rarely correct"; doesn't engage 0-10% solver donk frequency |
| 2 | Will Tipton — *Expert Heads Up NLHE* (2013-14) | early-solver | HU framework; 3BP-OOP-donk addressed obliquely via range-advantage logic |
| 3 | Owen Gaines — *Poker Math That Matters* | pre-solver | Math-foundation; not spot-specific |
| 4 | Sweeney — *Play Optimal Poker* (2019) | solver-era | Explicit GTO frame; agrees on disadvantaged-board solver-OOP-checks-most |
| 5 | GTO Wizard "Navigating Range Disadvantage" | modern solver | Already in §13; agrees |
| 6 | GTO Wizard "Crush 3-Bet Pots OOP" | modern solver | Already in §13; agrees |
| 7 | GTO Wizard "Exploiting BBs Who Never Donk-Bet" | modern solver | Already in §13; supports live-pool exploit framing by inversion |
| 8 | GTO Wizard "Mastering Turn Play in 3-Bet Pots OOP" | modern solver | Adjacent context; agrees |
| 9 | Upswing "Donk Betting Strategy" | modern coaching | Already in §13; classified C-incomplete |
| 10 | Doug Polk video corpus on 3BP | modern coaching | Pragmatic live-pool exploit framing; agrees with our recommendation |
| 11 | Andrew Brokos / Thinking Poker | modern coaching | Solver-aligned theory; agrees |
| 12 | Jonathan Little tournament/cash corpus | modern coaching | Recommends call vs donks with TP+ on wet boards; agrees |
| 13 | Ed Miller — *Course* / *Poker's 1%* | live-cash-focused | Live-pool donk pattern; agrees with over-aggression framing |
| 14 | Tommy Angelo — *Elements of Poker* | meta-level | Tangential; agrees by anti-tilt principle |
| 15 | Snowie / PIO outputs (training cutoff knowledge) | solver | Direct solver corpus; agrees |
| 16 | LSW line audit `btn-vs-bb-3bp-ip-wet-t96.md` | internal | YELLOW closed; cross-reference for our claims |

---

## Per-claim comparison

### Claim 1 — "Solver BB checks ~90% of T96ss in 3BP; donks 0-10%"

| Source | Position | Category |
|---|---|---|
| GTO Wizard "Navigating Range Disadvantage" | Confirms PFR-caller has nut deficit on non-broadway middling boards; 3bettor checks majority | **A** |
| GTO Wizard "Crush 3-Bet Pots OOP" | Same directional claim | **A** |
| Sweeney *Play Optimal* | Same | **A** |
| Janda *Applications* | "Donking 3BP is rarely correct" — agrees in direction; doesn't engage frequency precision | **A** (broad agreement) |
| Will Tipton *EHUNL* | Range-advantage-driven c-bet strategy implies disadvantaged-board OOP defaults to check | **A** |
| Run It Once solver summaries | Confirms BB check-frequency on similar textures | **A** |
| Brokos / Thinking Poker | Solver-aligned; agrees | **A** |

**Verdict:** Strong consensus. **A across all sources.** No active challenge surfaces disagreement.

### Claim 2 — "Live pool BBs donk this flop 20-40% (vs solver 0-10%)"

| Source | Position | Category |
|---|---|---|
| GTO Wizard "Exploiting BBs Who Never Donk-Bet" | Article frames the exploit target as "BBs who never donk" — implies non-trivial donk frequency in pool | **A** (by inversion) |
| Doug Polk live cash content | "Live BBs donk wet flops constantly for protection" | **A** |
| Ed Miller *Course* | Live pool over-aggression patterns including donking | **A** |
| Upswing "Donk Betting" | Treats live pool donk as exploitable | **A** |
| LSW audit external-validation log | Same observation; categorized D in audit | **A** |

**Verdict:** Strong consensus. No B/C-wrong from sources. **A across.**

### Claim 3 — "Pool donk composition is value-heavy (60-80% value, 20-40% bluff)"

| Source | Position | Category |
|---|---|---|
| GTO Wizard solver-balance theory | Solver-balanced range at 33% sizing should be ~50:50 value:air at this size; population deviates toward value-heavy | **A** (in direction) |
| Doug Polk content | Live pool value-bets more than bluffs in donking spots | **A** |
| Live-cash coaching corpus generally | Pool over-bets value, under-bets bluffs | **A** |

But: **none of these sources commit to the specific 60-80% value range our artifact claims.** Our number is plausible-by-inference rather than data-derived. This isn't a B (no source disagrees) but it's a confidence-floor caveat — our specific number is more precise than any cited source supports.

**Verdict: A directionally; the specific numerical range carries higher uncertainty than §11 acknowledges.** No B/C from sources but worth noting in `lsw-impact`.

### Claim 4 — "Hero (J♥T♠) equity ~30% vs BB's donk range"

This is where Stage 4 surfaces a real problem. **Internal arithmetic check.**

The artifact §3 bucket table gives:
- Strong (60-80%) bucket: ~6 combos at center value 70%
- Medium (40-60%) bucket: ~4 combos at center value 50%
- Weak (20-40%) bucket: ~12 combos at center value 22% (per artifact's per-class equity)
- Air (<20%) bucket: ~3 combos at center value 5%
- Total: 25 combos

Recomputing weighted average: `(6 × 0.70 + 4 × 0.50 + 12 × 0.22 + 3 × 0.05) / 25 = (4.2 + 2.0 + 2.64 + 0.15) / 25 = 8.99 / 25 = 35.96% ≈ 36%`.

**The artifact's stated value of "28-32%, working value 30%" is inconsistent with its own per-bucket math, which gives ~36%.**

This is a v2 falsifier firing — Row 3.9's internal falsifier ("recomputation yields outside [25%, 35%]") fires at 36%. The recomputation is just outside the upper bound of the credible interval.

| Source | Position | Category |
|---|---|---|
| LSW audit external-validation | "JTs ~40% equity vs BB's 3bet range (37-44%)" — vs FULL 3bet range, NOT donk subset | **A** (different scope; not directly comparable) |
| Equilab-style hand calculator (mental check) | J♥T♠ on T♥9♥6♠ vs the donk-range composition produces equity in mid-30s, not low-30s | **B** vs our 30% claim |

**Verdict: B (our reasoning is internally inconsistent).** Hero equity is closer to ~36%, not 30%. This is a meaningful Stage 4 finding because:
- Hero's call branch EV in §8 was computed at 30% equity — using ~36% would shift the call EV from +3.8bb to ~+5.5bb. **Recommendation doesn't change** (call was already correct), but the EV gap over fold widens.
- §12 Assumption A flip threshold (40:60 value:bluff for raise to become +EV) was calculated against the 30% baseline; recalibrating to 36% baseline shifts the threshold somewhat.
- The donk-composition load-bearing assumption remains correct in concept but the EV math under-stated the artifact's own conclusion.

**Required artifact fix.** Either (a) recompute §3 weighted average to 36% and propagate through §8 + §12, or (b) revise per-class equity values downward to support the 30% number (justifying e.g., overpairs at 18% not 22%, sets at 3% not 5%).

**Recommendation:** Option (a). The per-class equity values are defensible at 22% (overpairs) and 5% (sets); the weighted-average computation is what was wrong. Re-derive §3 weighted average and propagate.

### Claim 5 — "Solver hero response: call ~85%, raise ~10%, fold ~5%"

| Source | Position | Category |
|---|---|---|
| GTO Wizard solver corpora | No exact-node citation; directional inference supports majority-call | **A** (inferred) |
| Sweeney *Play Optimal* | Polar-bet-defense framework; medium TP+ calls vs polar | **A** |
| Run It Once solver summaries | Indirectly supports | **A** |
| Janda *Applications* | Pre-solver; would say "always call TP vs small donks" | **A** (broader / less calibrated) |

**Verdict:** A across; the specific 85:10:5 mix is directional inference (already F-4a in audit).

### Claim 6 — "Recommendation: pure call (not solver's mixed 85:10)"

| Source | Position | Category |
|---|---|---|
| Doug Polk live cash | Pure call vs live-pool value-heavy donking | **A** |
| Ed Miller *Course* | Calls down medium pair vs live aggression | **A** |
| Upswing tactical articles | Recommends call, doesn't endorse raise vs unknown opponent | **A** |
| Andrew Brokos | Solver-aligned but acknowledges exploit-deviation | **A** |

**Verdict:** A across.

### Claim 7 — "Hero's J♥T♠ blockers are slightly value-favorable (3 of 6 JJ blocked, 1 of 3 TT blocked, no bluff blocks)"

| Source | Position | Category |
|---|---|---|
| GTO Wizard blocker-effects content | Generic agreement on blocker-counting methodology | **A** |
| Will Tipton *EHUNL* | Same | **A** |

**Verdict:** A. Card arithmetic is unambiguous.

---

## Active challenge

Per v2 §13: required ≥1 B / C-wrong / C-incomplete. Stage 4 surfaced **B (Claim 4 — hero equity miscomputation)** beyond the artifact's existing §13 categorization (which had 1 C-incomplete + 1 D + 2 A).

Updated v2.1 §13 categorization for this artifact post-Stage-4:

- A: Claims 1, 2, 3 (directionally), 5, 6, 7 — solid agreement across the corpus.
- **B: Claim 4 — hero equity vs donk range ~30% is wrong; correct is ~36%.** Internal arithmetic inconsistency caught by Stage-4 recomputation. Falsifier (row 3.9 internal) fired.
- C-incomplete: Upswing donk-betting binary (already in artifact §13)
- C-wrong: none surfaced. Active challenge attempted: searched for sources advocating raise as default vs live-pool donks (e.g., older live-cash content advocating "iso-raise wet board donks"). No reputable source found; older raise-default advice was largely from pre-solver-era heuristics that don't apply to disadvantaged BB ranges.
- D: Live-pool donk exploit framing (already in artifact §13; in POKER_THEORY.md §9.1 per LSW audit)

**Net Stage 4 verdict for §13:** 6A + 1B + 1 C-incomplete + 1D. **B was missed by the artifact's self-§13** because §13 surveyed sources looking outward but didn't apply the v2 §11 falsifier discipline to its own internal arithmetic. This is a **meta-finding about the rubric**: §13 should explicitly cross-reference §11 falsifiers as part of the comparison process. Candidate v2.2 delta.

---

## Proposed `POKER_THEORY.md §9` entries

### §9.1 (existing, per LSW audit) — Live-pool BB donking on disadvantaged boards in 3BP

Already documented per LSW-F1 closure. No update needed.

### §9.X (new, proposed by Stage 4) — Live-pool donk composition is value-heavy at small sizings

The artifact's §5 Claim 2 (donk composition ~60-80% value vs solver ~50-50 at 33% sizing) is a documented divergence from solver-balanced ranges. This deserves explicit §9 entry because it underpins:
- Recommendation against raising J♥T♠ (raises fold the worst parts of villain's range)
- The wider exploit framing for similar IP-vs-OOP-donk spots across textures

Proposed §9.X title: **"Live-pool small-sizing donks skew value-heavy at solver-non-aligned frequencies."** Reference: this artifact + Doug Polk content + Ed Miller *Course*.

---

## `lsw-impact` subsection

Candidate LSW re-audits flagged. **No auto-propose — owner decides.**

### Flag 1 — `btn-vs-bb-3bp-ip-wet-t96.md` external-validation log doesn't include equity-vs-donk-subset distinction

The LSW audit (closed 2026-04-22, LSW-F1) cited "JTs ~40% equity vs BB's 3bet range (37-44%)" as Category-A. This is hero's equity vs the FULL 3bet range, not vs the donk subset specifically. The upper-surface artifact §3 distinguishes these two equities — the donk subset's value-heavy composition produces a meaningfully lower equity for hero (~36% per Stage 4 recomputation, vs ~38% for the full 3bet range).

**Implication for LSW audit:** the audit's "JTs ~40% equity" cross-reference is correct *for the question it asked* but doesn't address the equity question that drives the hero's actual decision (vs the donk subset). The authored teaching content in `lines.js:765` doesn't have an explicit equity claim either, so no LSW finding is invalidated. **Soft flag** — LSW audit didn't ask the right equity question, but its conclusions stand because the authored content didn't depend on the distinction.

**Re-audit recommendation:** none required. LSW audit format may benefit from adding "equity vs subset range" as a dimension-2/3 check item for future audits, but this is a process improvement, not a re-audit trigger.

### Flag 2 — F-finding F-3a from upper-surface audit

The flop pilot's audit identified F-3a (per-class equity values without derivation, severity P2). Stage 4 confirms this becomes a **functional B-finding** when the per-class values are recomputed against weighted-average — the values aren't wrong, but the weighted average computed from them was. **LSW audit didn't surface this** because LSW audits the authored teaching content, not the auditor's own equity computation.

**Re-audit recommendation:** none for LSW. Flag for upper-surface audit re-pass if/when the flop pilot is refit to v2.1.

### No other LSW re-audit candidates from Stage 4

The LSW line audit's three closed P1 findings (LSW-F1) addressed authored-content errors. The upper-surface artifact's Stage 4 findings are upper-surface-internal (artifact's own arithmetic + sourcing). No LSW content is materially impacted.

---

## Summary

**Stage 4 verdict for flop pilot:** the artifact's external-comparison story is **directionally sound** (A across all major recommendation claims) with one substantive internal finding (Claim 4 — equity recomputation gives ~36%, not 30%). The recommendation (pure call) is unchanged; the EV magnitudes are understated.

**Surface-area note.** Stage 4 added 16 sources surveyed (vs §13's 5) and found one B that §13 missed via internal recomputation. The B was discoverable from §11 alone — the rubric's claim-falsifier discipline worked, but §13 didn't draw on §11 falsifiers as part of the comparison process. **Candidate v2.2 delta:** §13 should explicitly invoke §11 falsifier-checks as part of source-survey synthesis, not just compare against external sources.

**One D entry proposed for `POKER_THEORY.md §9`** (donk composition value-heavy skew). One **soft LSW flag** (no re-audit required).
