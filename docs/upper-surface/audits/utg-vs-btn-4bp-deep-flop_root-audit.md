# Self-Audit — `utg-vs-btn-4bp-deep-flop_root`

**Artifact audited:** `docs/upper-surface/reasoning-artifacts/utg-vs-btn-4bp-deep-flop_root.md`
**Rubric version:** v2.2 (artifact v2.2-native)
**Auditor:** Claude (main, self-audit)
**Date:** 2026-04-23
**Status:** Stage 3e complete — verdict GREEN (light); two rubric candidates reinforced

---

## Executive summary

**Verdict: GREEN (light).** Artifact #5 stress-tests v2.2 on 4BP + low-SPR + range-concentration + jam-correct + UTG-OOP + top-two-pair. **8 findings identified: 0 P1, 3 P2, 5 P3.** All artifact-level polish.

**Highlights.**
1. **v2.2 D13 fired inline during §8 EV-tree construction** for the second time in corpus (first was artifact #4 §3). Initial bet-50% calculation appeared to beat jam; iteration corrected QQ/JJ-fold-assumption; final result matches authored teaching. **D13-in-§8 is a new variant** — prior firings were in §3. Pattern: D13 discipline catches errors in any section with arithmetic density.
2. **§13 zero-B/C-finding + Active-challenge sub-section explicitly written** per v2 Delta 7 rubric. This is the first artifact where §13 invokes the "no-disagreement-found" escape hatch with full documentation — validates the clause's design. Reinforces v2.3 D16 candidate (consensus-check search depth documentation).
3. **Ledger density 5.9 claims/1k words** — lowest in corpus so far (flop: 6.8; river: 7.6; artifact #3: 9.2; artifact #4: 6.9). 4BP's narrow ranges and 2-street filter chain produce leaner claim inventory.
4. **First artifact where realization collapses via commitment** (not showdown). §10 realization = N/A at low SPR. v2 language handles this cleanly via depth-2/3 commit-collapse framing.

---

## Scope and methodology

- Sections audited: all 14
- Methodology: walk against v2.2 forcing constraints
- Out of scope: theory correctness (Stage 4e); drill-card extractability (Stage 5e)
- **Note:** no LSW line audit exists for line 6 (`utg-vs-btn-4bp-deep`) per the LSW program. This artifact was authored without LSW cross-reference — a deviation from prior artifacts (pilots + artifact #3/#4 all had LSW audits to cross-reference). §13 sourcing and §14a mirror don't suffer, but audit scope is slightly narrower.

---

## Cross-section observations

### CSO-1 — Inline D13 firing in §8 (second instance in corpus)

§8 contains visible iteration in the bet-50% EV calculation. First pass: +49bb, beating jam's +23bb. Second pass: re-examined QQ/JJ fold-frequency vs flop-bet-27bb — discovered the first-pass assumed QQ/JJ call flop, but at solver-reg level they should fold (27bb required equity 25%; QQ/JJ equity vs AK top-two is ~15%). Re-corrected: bet-50% falls to +17bb, matching authored teaching jam-is-correct.

This is the **second D13-inline-firing** after artifact #4's §3 equity iteration. Pattern:
- Artifact #4: D13 in equity-bucketing (§3) — initial 43%, iterated to 58%, settled at 33%.
- Artifact #5: D13 in EV-tree arithmetic (§8) — initial +49bb for bet-50%, iterated to +17bb for solver-reg case.

Both iterations happened *during authoring*, not as post-hoc audit. **D13 as inline discipline is producing real catches on ~50% of artifacts in this corpus sample (2 of 4 v2.2-native artifacts).**

### CSO-2 — §13 "no B/C found" with explicit Active-challenge is working as designed

Per v2 Delta 7: if §13 produces no B/C-incomplete/C-wrong, artifact must add Active-challenge sub-section stating (a) sources probed, (b) claim attempted to challenge, (c) why attempt failed.

Artifact #5 §13 invoked this clause for the first time in corpus with full documentation. The clause is doing what it was designed to do: prevent "hidden consensus avoidance" where §13 silently fails to find challenges because the author didn't try. Artifact #5 tried (8 sources + pre-solver classics), found consensus, documented the search. **This is the honest-consensus path.**

**Meta-implication for v2.3 D16 (candidate):** D16 would formalize the "search-depth documentation" requirement even when B/C IS found — useful for patterns where B/C is found but the depth isn't documented. Currently D16 is batched; artifact #5 reinforces the case.

### CSO-3 — Missing LSW audit for line 6 is a corpus gap

Line 6 (`utg-vs-btn-4bp-deep`) has no LSW audit. Our artifact authored without LSW cross-reference. **This is the first artifact without LSW pairing.** Implications:

- Stage 4e (comparison) cannot cite LSW external-validation entries.
- §9.4+ in POKER_THEORY.md isn't invoked (no D-divergence on this line).
- The artifact stands on its own; if authored content differs from LSW-audit-quality would have caught, we may ship undetected errors.

**Recommendation:** flag this line for future LSW audit scheduling. Low priority since the spot is solver-consensus-robust (per §13), but completeness of corpus-audit-coverage is a quality dimension.

---

## Section-by-section findings

### §1. Node specification

- **F-1a — Pot derivation discrepancy with authored value (55 vs computed 56-57.5)** (severity 2, P2)
  - §1 notes a ~2.5bb gap between authored pot (55) and computed pot (56-57.5 from 4BP math). Attributed to authoring convention; preserved without forced reconciliation.
  - Fix: either correct lines.js authored value, or document the convention explicitly as "pot snapshot pre-blind-reconciliation."
  - Severity P2, effort S (coordinates with lines.js + authoring). Backlog: `US-A5-F1a`.

### §2. Range construction

- **F-2a — UTG 4bet range first-pass sum (~34) reconciled to ~30 combos aggregate** (severity 1, P3)
  - First-pass D10 enumeration summed to ~34; aggregate per-opens × frequency produced ~30 (consistent with solver 4bet-at-~16%-of-UTG-open). Reconciled down by 4 combos without specifying which classes were adjusted — per D10 discipline should either preserve first-pass OR document reconciliation.
  - Fix: add reconciliation note: "QQ 4bet freq dropped from 85% → 75% on re-examination (solver-tighter)."
  - Severity P3, effort S. Backlog: `US-A5-F2a`.

- **F-2b — Blocker arithmetic on AK is imprecise (±1 combo)** (severity 1, P3)
  - §2/§9 show AK preflop 16 combos → hero-blocks "6-7 unique combos." The overlap on A♦K♣ (hero's specific combo) and suited-vs-offsuit accounting is imprecise.
  - Fix: explicit card-by-card enumeration of BTN's AK combos minus hero's A♦ and K♣. Precise count (likely 9 or 10 remaining).
  - Severity P3, effort S. Backlog: `US-A5-F2b`.

### §3. Equity distribution

- **F-3a — Hero equity vs sets (~10%) is estimate, not derived** (severity 2, P2)
  - Rows 3.1, 3.2 state "~10% equity" for hero AK vs AA-set or KK-set. Derivation: "2-outer + runner-runner quads." Not precisely computed.
  - Fix: cite Equilab run or compute: AK vs AA on A-K-2, needs K to make boat (3 Ks) + hero's own A-K pair + runner outs. Detailed: hero has 4 K outs on turn (3 Ks remaining after board's K♦) and 4 A outs (3 remaining) — but these help hero boat up only if board pairs. ~9.5% Monte-Carlo by rough count. Value "~10%" is close but derivation should cite.
  - Severity P2, effort S. Backlog: `US-A5-F3a`.

### §4. Solver baseline

- **F-4a — "Solver jam frequency ~90%" is directional inference (carry-over)** (severity 1, P3)
  - Same F-4a pattern from pilots + artifact #3. No specific PIO/GTO-Wizard hand-citation for this exact spot.
  - Fix: tighten language or commission solver run.
  - Severity P3, effort S. Backlog: `US-A5-F4a`.

### §5. Population baseline

- **F-5a — Population sources are consensus-level, not dataset-level (carry-over from D14 candidate)** (severity 2, P2)
  - Doug Polk + Upswing + PIO extrapolation. Same D14 candidate trigger (population-consensus-observed source-type).
  - Fix: pending v2.3 D14 adoption.
  - Severity P2. Batch with D14.

### §6. Exploit recommendation

- **Clean.** Archetype-conditional correctly declined per v2.1 D11 (no archetype action-flip). No findings.

### §7. Villain's perspective

- **F-7a — Villain's perspective section notes near-perfect-information but doesn't deeply explore implications** (severity 1, P3)
  - §7 observes "this spot is near-perfect-information in both directions." This is a corpus-novel observation (unlike pilot's asymmetric-information and river-pilot's execution-gap). Section could elaborate: what does "near-perfect-info" mean for exploit theory? Does it mean solver-play is truly optimal and deviation is rare? Or is the narrow exploit at the QQ/JJ-call-station edge (§5) the actual expression of imperfect-info?
  - Fix: extend §7 with "near-perfect-info exploit framing" subsection linking to §5 Claim 3.
  - Severity P3, effort S. Backlog: `US-A5-F7a`.

### §8. EV tree

- **F-8a — D13 iteration visible in prose (inline discipline)** (severity 1, P3)
  - Observation: §8 contains two full bet-50% EV calculations with explicit note that first pass was wrong. Similar to artifact #4's §3-iteration prose. Transparent + educational but could be consolidated.
  - Fix: clean to final calculation + short "Note: first-pass assumed QQ/JJ call flop, corrected per D13 check" annotation.
  - Severity P3, effort S. Backlog: `US-A5-F8a`.

- **F-8b — Bet-50% EV range (+17 to +30bb) has wide CI** (severity 2, P2)
  - Observation: depending on QQ/JJ-call-rate, bet-50% spans +17bb to +30bb. Jam is +23bb. So bet-50% *could* beat jam in live-pool-over-call scenarios. §6 uses solver-robust reasoning (take minimum of sizing choices; jam wins at worst case) — defensible, but the live-pool optimum could be bet-50%.
  - Fix: add §6 sub-note "if villain is confirmed loose-station, bet-50% EV may exceed jam by ~6bb; acceptable sizing override if confidence is high."
  - Severity P2, effort S. Backlog: `US-A5-F8b`.

### §9. Blocker / unblocker

- **F-9a — 44% fold-equity post-blocker is the MOST blocker-favorable in corpus** (severity 0, positive finding)
  - Observation: shift from 33% to 44% fold equity is +11pp, larger than any prior artifact. Jam EV gains ~11bb from blocker alone.
  - Fix: none. Positive finding worth highlighting in §9 and closing note.

### §10. MDF / realization

- **F-10a — Low-SPR commitment-collapse of realization is novel** (severity 0, positive)
  - §10 realization N/A at jam; first artifact where realization drops out via commitment rather than showdown. Novel pattern.
  - Fix: none.

### §11. Claim-falsifier ledger

- **Clean.** 44 rows with falsifiers. Completeness log present. D13 iteration documented in load-bearing-claims summary. No findings.

### §12. Sensitivity

- **Clean.** Three assumptions with numeric thresholds. Single-action-per-§6 correctly identified. No findings.

### §13. Contrast with leading theories

- **F-13a — Zero B/C findings invoked Active-challenge clause; documented per v2 Delta 7** (severity 0, positive-design-validation)
  - Observation: §13 explicitly writes Active-challenge sub-section when no B/C surfaced. First instance in corpus; validates clause.
  - Fix: none. Worth annotating this as a rubric-validation success.

- **F-13b — Consensus-robust spot offers opportunity to propose v2.3 D16 adoption** (severity 1, P3)
  - D16 candidate (search-depth documentation) gains a second supporting data point. Artifact #3 was consensus-robust; artifact #5 is. Batch trigger approaching.
  - Fix: when batching v2.3 deltas, include D16.

### §14a. Symmetric-node test

- **F-14a-a — Mirror-node `btn-vs-utg-4bp-deep-flop_root` doesn't exist as a separate line** (severity 1, P3)
  - Observation: the mirror node isn't in lines.js; hypothetical. Classification exercise proceeds based on structural inference. Acceptable but less rigorous than prior artifacts where mirrors were existing nodes.
  - Fix: acknowledge mirror is hypothetical in §14a prose.
  - Severity P3, effort S. Backlog: `US-A5-F14a-a`.

- Otherwise clean. 6 classifications, under D8 cap. Test passes.

### §14b. Falsifier synthesis

- **Clean.** One sizing-sensitivity headline falsifier; action-robust declared correctly. No findings.

### §14c. Counter-artifact pointer

- **Clean.** Two counter-artifacts named. No findings.

---

## Prioritized fix list

| # | Finding | Severity | Priority | Effort | Type |
|---|---|---|---|---|---|
| 1 | F-1a — pot derivation gap | 2 | P2 | S | Artifact / lines.js |
| 2 | F-3a — set-equity derivation cite | 2 | P2 | S | Artifact |
| 3 | F-5a — consensus sourcing (D14 batch) | 2 | P2 | rubric | Rubric |
| 4 | F-8b — bet-50% sizing-override caveat | 2 | P2 | S | Artifact |
| 5 | F-2a — UTG 4bet range reconciliation note | 1 | P3 | S | Artifact |
| 6 | F-2b — blocker arithmetic precision | 1 | P3 | S | Artifact |
| 7 | F-4a — solver directional inference carry | 1 | P3 | S | Artifact |
| 8 | F-7a — near-perfect-info exploit framing | 1 | P3 | S | Artifact |
| 9 | F-8a — D13 iteration prose consolidation | 1 | P3 | S | Artifact |
| 10 | F-13b — D16 batch trigger approaching | 1 | P3 | rubric | Rubric |
| 11 | F-14a-a — mirror hypothetical | 1 | P3 | S | Artifact |

**Breakdown:** 0 P1, 4 P2, 7 P3. All artifact-level polish or rubric-batch candidates. **No fundamental rubric gaps.**

---

## Rubric-candidate status (running batch)

- **D14** (`population-consensus-observed` source-type): triggered by artifact #3 F-5a, reinforced by artifact #4 F-5a, artifact #5 F-5a. **3 data points.**
- **D15** (range-vs-hand MDF divergence): triggered by artifact #4 F-10a. **1 data point.**
- **D16** (§13 consensus-check search-depth documentation): triggered by artifact #4 F-13a, reinforced by artifact #5 F-13a+b. **2 data points.**

**Batch trigger approaching (5 candidates).** Current 3 deltas + 2 reinforcements. When next artifact surfaces a new rubric-candidate or strengthens an existing to ~3 data points, batch-apply v2.3.

---

## Audit sign-off

- **Drafted by:** Claude (main, self-audit)
- **Verdict:** GREEN (light). 11 findings; 0 P1, 4 P2, 7 P3. All artifact-level polish.
- **v2.2 assessment:** survived 4BP + low-SPR + range-concentration + jam-correct + UTG-OOP + top-two-pair stress tests. D13 inline-firing pattern reinforced. §13 Active-challenge clause validated with zero-B/C output.
- **Novel findings:** (a) blockers most-favorable-in-corpus (+11pp fold-equity shift); (b) realization commitment-collapse (first in corpus); (c) near-perfect-information both sides (first in corpus).
- **Next step:** Stage 4e comparison + Stage 5e drill card.
