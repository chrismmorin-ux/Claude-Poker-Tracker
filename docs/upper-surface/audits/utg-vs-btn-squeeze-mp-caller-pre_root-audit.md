# Self-Audit — `utg-vs-btn-squeeze-mp-caller-pre_root`

**Artifact audited:** `docs/upper-surface/reasoning-artifacts/utg-vs-btn-squeeze-mp-caller-pre_root.md`
**Rubric version:** v2.3 (artifact v2.3-native)
**Auditor:** Claude (main)
**Date:** 2026-04-23
**Status:** Stage 3g complete — verdict GREEN (light); one light v2.3.x candidate (D18 — order-of-action in multi-way preflop)

---

## Executive summary

**Verdict: GREEN (light).** First v2.3-native artifact. Tests v1.1 D3 preflop-exception + v2.3 D17 multi-way extensions + v2.3 D14 `population-consensus-observed` source-type + v2.3 D16 search-depth documentation. **All v2.3 deltas applied in authoring; all worked as designed.**

**9 findings: 0 P1, 3 P2, 6 P3.** No fundamental gaps. One candidate for future v2.4 delta (D18 — order-of-action semantics in multi-way).

**Headline:** v2.3 rubric is mature enough to support preflop + multi-way + squeeze-geometry artifacts without ad-hoc extensions. **First corpus artifact where NO new rubric candidate was triggered.** (D18 is weak; optional.)

---

## Cross-section observations

### CSO-1 — v1.1 D3 preflop-exception works

§2 applied D3 cleanly. "At each step" interpreted as "decision-space at node-entry (4bet/call/fold with respective range compositions)" rather than prior-street filters. No confusion; no rubric violation. **D3 validated.**

### CSO-2 — v2.3 D17 applied in authoring, not retrofitted

§2 combined-villain-range with inclusion-exclusion, §7 two-villain subsections + joint synthesis, §8 scenario-grouping (5 scenarios), §10 per-villain + joint MDF. **Each was authored FROM the D17 language rather than ad-hoc and then formalized.** This is the intended lifecycle for rubric deltas.

### CSO-3 — New MW-preflop dimension surfaces: order-of-action

§7 flagged that MP1's action happens AFTER hero's decision, BEFORE BTN's final response. This creates a conditional-decision-tree where hero's 4bet makes MP1's next move (overcall/cold-4bet/fold) the input to BTN's final decision. v2.3 D17 §7 joint-synthesis covers this implicitly but doesn't formalize "order of action" as a dedicated forcing constraint.

**Candidate v2.4 D18:** §7 multi-way sub-clause — "For multi-way artifacts where villains have sequential action (not simultaneous), the joint-synthesis must explicitly map the order-of-action and document each villain's decision as conditional on prior villains' visible actions." Light rubric addition.

---

## Section-by-section findings

### §1. Node specification

- **F-1a — Pot 20.5 authored 20 rounding** (severity 1, P3, carry-over pattern)
  - Same as artifact #5 pot-derivation-gap. Line 8 authored pot=20 but correct is 20.5.
  - Fix: acknowledge as authoring rounding.
  - Severity P3, effort S. Backlog: `US-A7-F1a`.

### §2. Range construction

- **F-2a — UTG open range revised from 14% to ~9% mid-artifact** (severity 2, P2)
  - §2 opens with "14% live / 12% solver" estimate, then revises to ~9% when computing combo-count (119 combos from hand-class table ≈ 9%).
  - Fix: pick one estimate and commit (preferred: 9% matches computed combo-count).
  - Severity P2, effort S. Backlog: `US-A7-F2a`.

- **F-2b — MP1 flat range estimate 70 combos (~5.3%) lacks sourcing-rigor** (severity 2, P2)
  - MP1 flat-vs-UTG-open range estimates from author's reasoning; no coaching-source cites specifically (MP1-vs-UTG is less-covered than BTN-vs-UTG).
  - Fix: add v2.3 D14 `population-consensus-observed` labeling if multiple sources concur; otherwise keep at `population-observed` with wider CI.
  - Severity P2, effort S. Backlog: `US-A7-F2b`.

### §3. Equity distribution

- **F-3a — "Post-blocker BTN range ~43 combos" derivation loose** (severity 1, P3)
  - §3 table uses "~43 combos post-blocker" but §2's enumeration shows 38 value + 16 bluff = 54 pre-blocker, minus ~7-8 blocker = ~46 post-blocker. Slight mismatch ~3 combos.
  - Fix: reconcile counts between §2 and §3.
  - Severity P3, effort S. Backlog: `US-A7-F3a`.

### §4. Solver baseline

- **F-4a — Multi-way + preflop solver claims are doubly-inferential** (severity 1, P3)
  - §4 claims for MW-preflop-squeeze are less-rigorously-sourced than HU-postflop (literature gap). Carried "directional inference" pattern.
  - Fix: acknowledge inference bounds; no rewrite.
  - Severity P3. Backlog: `US-A7-F4a`.

### §5. Population baseline

- **F-5a — `population-consensus-observed` (D14) applied correctly** (severity 0, positive)
  - §5 rows 5.1, 5.2, 5.3 use the new D14 source-type label. First artifact to use D14 in authoring.
  - Fix: none. Positive validation of D14.

### §6. Exploit recommendation

- **Clean.** Single-action 4bet recommendation. Deltas vs §4/§5 derived. No archetype flip. No findings.

### §7. Villain's perspective — two villains + joint synthesis

- **F-7a — Order-of-action dimension surfaced as structurally-new** (severity 2, P2; candidate D18)
  - §7 notes MP1 acts after hero, before BTN's final response. This creates conditional-decision-tree dynamics that §7's joint-synthesis addresses implicitly. More rigorous treatment would require a dedicated rubric forcing constraint.
  - Fix: **candidate v2.4 D18** — formalize order-of-action documentation in MW §7.
  - Severity P2, effort rubric-minor. Backlog: D18 candidate (light).

### §8. EV tree — scenario-grouping (D17)

- **F-8a — Scenario B sub-branch iteration visible in prose** (severity 1, P3)
  - §8 Scenario B contained mid-derivation iteration (first pass had −17.7bb contribution, refined to −0.23bb after sub-branch weighting). Similar to artifact #4's §3 iteration and artifact #5's §8 iteration.
  - Fix: clean final prose; keep iteration-trail as separate D13-audit note.
  - Severity P3, effort S. Backlog: `US-A7-F8a`.

- **F-8b — Call branch EV given as rough estimate only** (severity 2, P2)
  - §8 call-branch: "rough estimate ~+3-4bb." Should receive the same scenario-grouping treatment as 4bet-branch.
  - Fix: enumerate call-branch scenarios (MP1 overcall/fold × BTN barrel-and-check-down patterns).
  - Severity P2, effort M. Backlog: `US-A7-F8b`.

### §9. Blocker / unblocker

- **F-9a — "KQs bluff-subset blocked 1-2" precision loose** (severity 1, P3)
  - §9 says "1-2 combos blocked" — could be precise: KQs at ~50% squeeze-bluff-freq × 4 preflop combos = 2 in range; hero blocks half → 1 combo blocked. Exact value 1.
  - Fix: tighten.
  - Severity P3, effort S. Backlog: `US-A7-F9a`.

### §10. MDF

- **F-10a — Per-villain + joint MDF (D17) applied correctly** (severity 0, positive)
  - §10 presents per-villain MDF + joint MDF per D17. Joint MDF correctly identified as decision-relevant. D17 validated.

- **F-10b — D15 range-vs-hand note applied preemptively (positive)** (severity 0, positive)
  - §10 explicitly notes D15 doesn't apply to QQ (clearly in defend-range) but flags the adjacent case for JJ/TT. Preemptive acknowledgment.

### §11. Ledger

- **Clean.** 50 rows, falsifiers present. D14 labels correctly applied. No findings.

### §12. Sensitivity

- **Clean.** Three assumptions, numeric thresholds. Decision-robust across archetype. No findings.

### §13. Contrast

- **F-13a — D16 applied correctly** (severity 0, positive)
  - §13 zero-B/C Active-challenge + 3-part search-depth documentation per D16. First artifact to use D16 in authoring.
  - Fix: none. Positive validation of D16.

### §14a. Mirror

- **F-14a-a — Mirror `btn-vs-mp-squeeze-utg-caller-pre_root` hypothetical** (severity 1, P3)
  - Same pattern as artifact #5: mirror not in lines.js; acceptable but less rigorous.
  - Severity P3. Backlog: `US-A7-F14a-a`.

### §14b. Falsifier synthesis

- **Clean.** Decision-level-robust correctly declared. No action-level falsifiers. No findings.

### §14c. Counter-artifact pointer

- **Clean.** Two counter-artifacts named (archetype-stratified + JJ-variant). No findings.

---

## Prioritized fix list

| # | Finding | Severity | Priority | Effort | Type |
|---|---|---|---|---|---|
| 1 | F-2a — UTG open range estimate revised mid-artifact | 2 | P2 | S | Artifact |
| 2 | F-2b — MP1 flat range sourcing | 2 | P2 | S | Artifact |
| 3 | F-7a — order-of-action formalization (D18 candidate) | 2 | P2 | rubric | Rubric (light) |
| 4 | F-8b — call branch scenario-grouped | 2 | P2 | M | Artifact |
| 5 | F-1a — pot 20.5 vs authored 20 | 1 | P3 | S | Artifact |
| 6 | F-3a — post-blocker combo count reconciliation | 1 | P3 | S | Artifact |
| 7 | F-4a — MW+preflop solver inferential (carry) | 1 | P3 | S | Artifact |
| 8 | F-8a — Scenario B iteration prose | 1 | P3 | S | Artifact |
| 9 | F-9a — KQs block precision | 1 | P3 | S | Artifact |
| 10 | F-14a-a — mirror hypothetical | 1 | P3 | S | Artifact |

**Breakdown:** 0 P1, 4 P2, 6 P3. All artifact-level polish + one light rubric candidate.

---

## Rubric-candidate running tally

**Post-v2.3 candidates:**
- **D18** (order-of-action in multi-way §7): 1 data point (artifact #7). **Light candidate** — could batch later if more MW-sequential artifacts surface it.

That's it. **v2.3 absorbed most pending candidates; v2.4 hasn't accumulated enough for immediate batching.**

---

## Audit sign-off

- **Verdict:** GREEN (light). 10 findings; 0 P1, 4 P2, 6 P3.
- **v2.3 assessment:** all four new deltas (D14-D17) exercised successfully in authoring. Rubric is mature for corpus scaling.
- **Novel observations:** order-of-action in multi-way preflop (D18 candidate, light) is the only new rubric consideration.
- **Corpus status:** 7 artifacts (3 HU-postflop pilots + 4 v2.2/v2.3-native). Diversity spans pot types, streets, positions, hand classes, MW, preflop.
- **Next step:** Stage 4g + Stage 5g complete chain.
