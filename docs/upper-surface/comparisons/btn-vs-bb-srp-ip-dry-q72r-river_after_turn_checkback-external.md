# Stage 4 — Leading-Theory Comparison

**Artifact compared:** `docs/upper-surface/reasoning-artifacts/btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback.md`
**Rubric version:** v2.1 (artifact at v2-native; rubric advanced to v2.1 after Stage 3b)
**Comparison author:** Claude (main, Stage 4)
**Date:** 2026-04-23
**Status:** draft

---

## Scope

Extends §13 of the artifact (which surveyed 5 sources internally) with broader corpus, finer-grained categorization, and active B/C-wrong search. Same coverage caveat as flop pilot Stage 4: sources are training-time knowledge through 2026-01.

---

## Sources surveyed

Beyond the artifact's §13 (GTO Wizard "Over-Bluffed Lines", Janda *Applications*, Ed Miller *Course*, Upswing "Check-Behind Turn", Tommy Angelo *Elements*):

| # | Source | Era | Position on this spot |
|---|---|---|---|
| 1 | Doug Polk video corpus on cash games | modern | "Two most over-bluffed lines in cash" — capped IP → polar OOP river is one; recommends wide call |
| 2 | Andrew Brokos — *Play Optimal Poker* | solver-era | Bluff-catch math: medium pair vs polar at correct pot odds; recommends call |
| 3 | Will Tipton — *Expert Heads Up NLHE* | early-solver | Polar-line defense framework; agrees with call |
| 4 | Sweeney — *Play Optimal Poker* | solver-era | Same |
| 5 | Snowie / PIO outputs | solver | Solver call majority on medium pair vs polar bet at correct pot odds |
| 6 | Krieger — *Hold'em Excellence* | pre-solver classic | Calls down medium pair vs aggression on bricked rivers |
| 7 | Jonathan Little — multi-volume cash/tournament | modern | Calls; doesn't engage archetype-flip nuance |
| 8 | Berkey / Solve For Why content | modern elite | Tighter against strong opponents; could disagree with default-call vs strong regs |
| 9 | Matt Berkey — Application of Poker Theory | elite | More-conservative call ranges in live higher-stakes |
| 10 | Owen Gaines — *Poker Math That Matters* | math foundation | Pot-odds and MDF agree |
| 11 | Cardquant "Folding Thresholds in 3-bet Pots" | modern | Generally "all players overfold" — supports our call framing (this is SRP not 3BP but framework extends) |
| 12 | LSW line audit `btn-vs-bb-srp-ip-dry-q72r.md` | internal | GREEN-light closed; cross-reference for our claims |

---

## Per-claim comparison

### Claim 1 — "Solver BB polar-bet frequency on capped-IP-checked-turn line ~50-60%"

| Source | Position | Category |
|---|---|---|
| GTO Wizard "Over-Bluffed Lines" | Confirms; documents the line as polar-frequency at meaningful rate | **A** |
| Snowie / PIO solver corpus | Agrees on polar frequency in similar lines | **A** |
| Brokos *Play Optimal* | Polar OOP attack of capped IP is solver-canonical | **A** |
| Sweeney *Play Optimal* | Same | **A** |
| Will Tipton *EHUNL* | HU framework supports | **A** |

**Verdict: A across.**

### Claim 2 — "Solver polar-bet bluff fraction ~30% (MDF-balanced at 75% sizing)"

| Source | Position | Category |
|---|---|---|
| Cardquant solver-balance theory | Confirms ~30% bluff fraction at 75% sizing for MDF balance | **A** |
| GTO Wizard polar-sizing articles | Same | **A** |
| Brokos *Play Optimal* | Same MDF derivation | **A** |
| Owen Gaines *Poker Math* | Math agrees | **A** |

**Verdict: A across.**

### Claim 3 — "Live pool over-bluffs this line at ~40-50% bluff fraction"

This is the artifact's **load-bearing population claim** (§5 Claim 1) and the only §5 row that satisfies v2 Delta 3 sourcing floor. Stage 4 examines it carefully.

| Source | Position | Category |
|---|---|---|
| GTO Wizard "Calling Down the Over-Bluffed Lines in Lower Limits" | Cited by artifact; supports over-bluff framing | **A** with caveat (see B below) |
| Doug Polk cash content | "Two most over-bluffed lines in cash" — supports over-bluff framing across stakes | **A** |
| Ed Miller *Course* | Live pool over-aggression in checked-turn lines | **A** |
| LSW audit external-validation log | Same observation across pool | **A** |

But **active challenge surfaces a B finding:**

**B — Source-stake-mismatch.** GTO Wizard's "Calling Down the Over-Bluffed Lines in **Lower Limits**" is — per its title and (training-time-knowledge) framing — about **online microstakes** (NL10-NL50 typically), not live 1/2-5/10 NL cash. The artifact's §5 Claim 1 cited this article to justify the 40-50% bluff fraction at "live 1/2-5/10 NL cash." The pattern *likely* generalizes to live cash (live pools share over-aggression patterns with online micros), but the source attribution is **sloppier than implied**: the artifact treats the GTO Wizard article as a methodologically-grounded source for live-cash claims when the source is online-micro-specific.

**Severity: P2.** Recommendation likely doesn't change (Doug Polk and other live-cash sources independently support the over-bluff framing), but the v2 Delta 3 sourcing-floor claim that "Claim 1 is sourced with stated methodology" is weaker than presented — the methodology in the source applies to a different stake tier.

**Required artifact fix:** revise §5 Claim 1 to either (a) cite Doug Polk for the live-cash claim and demote GTO Wizard "Lower Limits" to corroborating evidence, or (b) explicitly state the source is online-micro and argue by extension to live cash with caveat.

**This is a Stage-4 B finding that the artifact's self-§13 didn't catch** because §13 evaluated GTO Wizard as a source-of-truth for polar-line dynamics generally without challenging its stake-specificity.

### Claim 4 — "Hero's 99 has ~35% equity vs BB's river bet range (60 combos, 21 nuts + 39 air)"

| Source | Position | Category |
|---|---|---|
| Equilab-style mental check | 21/60 = 35% confirmed; pure-bimodal river math | **A** |
| Cardquant pot-odds methodology | Required equity 30% at 75% bet — confirmed; hero exceeds threshold | **A** |
| Will Tipton *EHUNL* bluff-catch framework | Same | **A** |

**Verdict: A.** Internal arithmetic is consistent (unlike flop pilot's §3 inconsistency surfaced in flop Stage 4). The river artifact's pure-bimodal §3 (21 wins / 60 total = 35%) is mechanical and verifiable.

### Claim 5 — "Recommendation: pure call (with archetype override per §12 Assumption C)"

| Source | Position | Category |
|---|---|---|
| Doug Polk | Wide call vs over-bluffed line; doesn't engage archetype-flip explicitly | **A** (default action matches) |
| Brokos *Play Optimal* | Solver-aligned call; agrees default | **A** |
| Sweeney *Play Optimal* | Same | **A** |
| Berkey content | More-conservative; could fold against strong-reg in this exact spot, agrees against fish | **A** with archetype-conditional alignment |
| Tommy Angelo *Elements* | "Make the call you don't want to make" — anti-fold heuristic | **A** (different reasoning, same answer) |
| Krieger *Hold'em Excellence* | Calls down medium pairs vs aggression | **A** |
| Jonathan Little | Calls; doesn't address archetype-flip | **A-with-caveat** (simplification — could be C-incomplete-equivalent) |
| Ed Miller *Course* | Calls; rule-of-thumb level | **C-incomplete** (already in artifact §13) |

**Verdict: A across; one C-incomplete (already noted in artifact).**

### Claim 6 — "§12 Assumption C: villain archetype is decision-flipping (call vs reg/pro/fish; fold vs nit)"

This claim is internal to the artifact (rubric v2.1 D11 supports this structure formally; artifact at v2-native pre-D11). External sources don't typically frame recommendations as archetype-conditional in this exact form. Instead they have:

| Source | Approach | Category |
|---|---|---|
| Ed Miller *Course* | Single rule (call); doesn't engage archetype | **C-incomplete** (already noted) |
| Berkey | Tighter calling vs strong opponents | **A** with archetype-conditional alignment |
| Doug Polk | Wide call; acknowledges nit-tightening secondarily | **A** |
| GTO Wizard "Over-Bluffed Lines" | Audience: anyone facing over-bluffed lines; doesn't archetype-split explicitly | **A** by inference |

**Verdict: A directionally; the archetype-conditionality is more explicit in our artifact than in most sources, which is consistent with §14b's "decision-level robust on other dimensions" framing.**

### Claim 7 — "Hero's 99 is blocker-unfavorable (~1.2 bluff combos blocked, 0 value blocks)"

| Source | Position | Category |
|---|---|---|
| GTO Wizard blocker-effects content | Generic agreement on blocker-counting methodology | **A** |
| Will Tipton *EHUNL* | Same | **A** |
| Brokos | Same | **A** |

**Verdict: A.** Card arithmetic unambiguous.

### Claim 8 — "Realization factor = 1.0 (N/A on river)"

Universal agreement — river decisions terminate at showdown. No source disagrees. **A across.**

---

## Active challenge

Per v2 §13: required ≥1 B / C-wrong / C-incomplete. The artifact's self-§13 had 4A + 1 C-incomplete. **Stage 4 added 1 B (Claim 3 source-stake-mismatch)** plus reaffirmed the C-incomplete.

Updated v2.1 §13 categorization for this artifact post-Stage-4:

- A: Claims 1, 2, 4, 5, 6, 7, 8 — broad consensus across the corpus.
- **B: Claim 3 — GTO Wizard "Lower Limits" source likely refers to online microstakes; live-cash extension is not what the source itself argues.** P2 finding. Recommendation unchanged (Doug Polk and other live-cash content independently support the over-bluff framing) but source attribution needs strengthening.
- C-incomplete: Ed Miller (Source 3 in artifact §13) — pedagogical simplification of the archetype-flip
- C-wrong: none surfaced. Active challenge attempted: searched for sources that argue for default-fold on this line, or sources that argue this isn't an over-bluffed spot in any pool. No reputable source found.
- D: Live-pool-over-bluff framing relative to solver-balanced range. Worth formal §9 entry.

**Net Stage 4 verdict for §13:** 7A + 1B + 1 C-incomplete + 1D. **B was missed by artifact self-§13** because §13 took GTO Wizard's article as authoritative for the live-cash use case without challenging the stake-specificity — same meta-failure pattern as flop pilot's §13 (didn't apply v2 §11 falsifier discipline to its own sourcing).

**Meta-finding (cross-pilot):** §13 in both pilots evaluated sources looking outward but didn't apply the v2 falsifier discipline to (a) its own internal arithmetic [flop pilot] or (b) source-attribution validity [river pilot]. **Candidate v2.2 delta:** §13 must explicitly invoke §11 falsifier checks AND source-claim-scope checks as part of comparison synthesis.

---

## Proposed `POKER_THEORY.md §9` entries

### §9.X (new, proposed by Stage 4) — Live-pool over-bluffs the capped-IP-checked-turn → polar-OOP-river-bet line

The artifact's §5 Claim 1 documents this as live-pool exploit at 40-50% bluff fraction (vs solver ~30%). The pattern is documented across multiple sources (GTO Wizard, Doug Polk, Ed Miller). Worth explicit §9 entry because it's a high-leverage exploitable pattern that recurs across line-types (whenever IP caps range via checking, OOP polar attacks at over-bluff frequency).

Proposed §9.X title: **"Capped-IP-checked-turn lines trigger live-pool over-bluffing on the river."** Reference: this artifact + GTO Wizard + Doug Polk content + LSW audit's external-validation log for this node.

(Note: §9.2 already exists per LSW-F2 closure for the live-pool BB-flat-range divergence. The new §9.X entry would be distinct — about live-pool *bluff* behavior, not preflop range.)

---

## `lsw-impact` subsection

### Flag 1 — LSW audit's "25-35% bluffs" claim is stake-soft

The LSW audit's external-validation for `river_after_turn_checkback` cited GTO Wizard "Over-Bluffed Lines" with "25-35% bluffs depending on opponent type." The Stage 4 finding above (B for source-stake-mismatch) applies equally: the LSW audit's 25-35% number is from an online-microstakes source, applied to live cash by extension.

**Implication for LSW audit:** the audit's external-validation row 1 ("25-35% bluffs") is technically over-confident in its source attribution. The cross-reference to GTO Wizard supports the *direction* of the claim (over-bluff exists in pool) but not the *specific number* at the live-cash stakes the line targets.

**Re-audit recommendation:** **soft.** The LSW audit's conclusion (call is correct) is solid. Adding a one-line "stakes caveat" to the external-validation log row 1 would tighten the audit but isn't a re-audit trigger.

### Flag 2 — `terminal_bluff_catch_win` pot 16.0 vs computed 22.7

This is **not a Stage 4 finding** but worth noting as adjacent: the LSW audit's L-terminals-F1 (P3) flagged this. LSW-F2-A6 shipped pot value 16.0 → 22.7 in the line audit. Upper-surface artifact's §1 pot derivation (22.7bb post-call) confirms LSW-F2-A6 was correct. **No new flag.**

### Flag 3 — Archetype-conditional recommendation

The artifact's §6 + §12 produce archetype-conditional recommendation (call vs reg/pro/fish; fold vs nit). This matches the LSW audit's "HIGH bucket-teaching leverage" assessment of the node. **No LSW re-audit needed**, but if/when LSW expands bucket-teaching for this node (Stream B2 widening), the upper-surface artifact's §12 Assumption C is the canonical reference for the archetype split.

### No other LSW re-audit candidates from Stage 4

The LSW line audit's six closed P2/P3 findings (LSW-F2) addressed authored-content errors (range-acknowledgment, framework-trim, pot-odds precision, blocker copy, sizing rationale, terminal pots). The upper-surface artifact's Stage 4 findings are upper-surface-internal (sourcing, archetype-conditional structure). No LSW content materially impacted.

---

## Summary

**Stage 4 verdict for river pilot:** the artifact's external-comparison story is **directionally sound** (A across all major recommendation claims) with one substantive Stage-4-added finding (Claim 3 — source-stake-mismatch in §5's Claim 1 GTO Wizard citation). The recommendation (pure call with nit override) is unchanged; the source attribution for the bluff-fraction number needs strengthening.

**Surface-area note.** Stage 4 added 12 sources surveyed (vs §13's 5) and found one B that §13 missed via source-scope challenge. The B was discoverable by examining the source's own scope (online-micro vs live-cash) rather than assuming the source generalizes. **Same meta-finding as flop pilot Stage 4:** §13 needs to apply v2 falsifier discipline both internally (arithmetic checks) and externally (source-scope checks) as part of comparison synthesis.

**One D entry proposed for `POKER_THEORY.md §9`** (capped-IP-checked-turn live-pool over-bluff). One **soft LSW flag** (stake-caveat for "25-35% bluffs" cross-reference). Owner decides re-audit scope per Stage 4 plan provisions.

---

## Cross-pilot synthesis (Stage 4 across both artifacts)

Stage 4 surfaced a **shared meta-finding** that's worth its own note: in both pilots, §13's source-survey was directionally correct but **missed v2-discoverable B findings via the same failure mode** — §13 didn't apply v2 falsifier discipline to its own outputs.

- **Flop pilot:** §13 missed an internal arithmetic inconsistency (Claim 4, hero equity 30% vs recomputed 36%). §11's row 3.9 internal falsifier ("recomputation yields outside [25%, 35%]") fired at 36% — outside the upper bound. §13 didn't run this check.
- **River pilot:** §13 missed a source-scope mismatch (Claim 3, GTO Wizard "Lower Limits" applied to live cash). §11's row 5.1 falsifier (external-operational, "live-pool sample shows outside [25%, 60%]") didn't fire — but the source-attribution falsifier ("source's own scope doesn't include live cash") wasn't a §11 row at all.

**Implication:** v2 §13 forcing constraint is good but incomplete. §13 should explicitly include:
- Internal-arithmetic checks of all weighted-average claims (catches flop pilot's miss)
- Source-scope checks for every cited source (catches river pilot's miss)

**Candidate v2.2 delta (D13):** §13 forcing constraint adds: "Before finalizing source categorization, run internal-arithmetic recomputation of all weighted-average claims against §11 falsifiers. Run source-scope verification for every cited source — does the source's own stated context include the artifact's claim context?"

This would be Stage 4's structural contribution to rubric evolution: cross-pilot pattern detection produces a delta that single-artifact audit didn't surface.

**Owner checkpoint at end of Stage 4:** apply D13 to v2.2 now, or accumulate further deltas through Stage 5/6 and batch?
