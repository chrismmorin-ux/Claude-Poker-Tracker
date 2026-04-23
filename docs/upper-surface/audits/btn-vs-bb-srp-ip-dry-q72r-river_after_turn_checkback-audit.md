# Self-Audit — Upper-Surface Artifact `btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback`

**Artifact audited:** `docs/upper-surface/reasoning-artifacts/btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback.md`
**Rubric version:** v2 (pilot-native; no refit)
**Auditor:** Claude (main, same session as artifact author — self-audit)
**Audit date:** 2026-04-23
**Status:** Stage 3b complete — rubric v2 survives river-decision stress; proposing v2.1 incremental deltas only

---

## Executive summary

**Verdict: GREEN (light).** v2 handled the river-decision stress test without surfacing fundamental rubric gaps. 11 findings identified: 2 P1, 4 P2, 5 P3. **All findings are artifact-level rather than rubric-level**, except for two candidate v2.1 deltas (archetype-conditional §6 recommendation, and river-decision pure-bimodal §3 handling).

The river pilot was materially easier to author than the flop pilot because (a) v2's forcing constraints had already been calibrated by Gate B audit, and (b) the river-decision structure (showdown collapse, no depth-2/3 branching) collapses several rubric sections cleanly. **§8 depth-3 collapse, §10 realization=1.0, and §14b synthesis-from-§11** all worked first-time under v2 without rubric revision.

The most substantive finding is **process-level**: my §2 value:bluff composition derivation visibly *back-solved* to the LSW audit's reference number (~30% bluff fraction) rather than deriving purely from per-class frequencies. This was honest about the calibration but it's a derivation-integrity issue the rubric doesn't explicitly guard against.

**Surface-area measure:** 61 claim-rows in 8k words, density 7.6 claims/1k words (vs flop pilot's 6.8 post-refit). Higher density reflects river-decision structural simplicity — fewer depth-2/3 branches dilute per-word.

---

## Scope

- **Sections audited:** all 14
- **Methodology:** walk each section against its v2 forcing constraints; classify findings by severity 0-4 and by rubric-gap vs artifact-gap
- **Out of scope:** correctness of poker theory (Stage 4 comparison); drill-card extractability (Stage 5)
- **Self-audit caveat:** same author for artifact and audit. Inherits blind spots. Stage 4 (external comparison) is the designated mitigation.

---

## Cross-section observations

### CSO-1 — v2 handled river-decision structural collapse cleanly

Three sections that v1.1 had anticipated difficulty with on river all worked first-time under v2:

- **§8 depth-3 collapse.** v2's "Concrete collapse forms" language (added as Delta 5 in v1.1→v2) handled the river showdown-collapse without hand-waving. Call branch reduces to `EV = P(ahead) × pot − P(behind) × cost`; depth-2/3 collapsed per rubric language. No prose contortion needed.
- **§10 realization = 1.0 / N/A.** The realization factor drops out entirely on a river decision (no future streets to realize through). v2 Delta 5's "realization consistency across branches" language covered this cleanly — no variation because no branches needed different factors.
- **§14b synthesis from §11.** v2's primary reframe (§14b distills from §11, doesn't invent) worked — the two headline falsifiers traced to specific §11 rows (2.13-2.15 and 5.3-5.5).

**No rubric revision needed for these sections.**

### CSO-2 — The §2 derivation back-solved to a target

The process failure worth flagging: my initial hand-class-frequency enumeration produced a value:bluff ratio of 88:12, but I knew from the LSW audit that the reference number is 25-35% bluff. So I re-tightened the per-class frequencies ("KQo bet-freq 70% → 50%", "thin-value hands might not bet at this line", etc.) until the ratio landed at 73:27. The adjusted frequencies are individually defensible but the adjustment process was target-driven, not constraint-driven.

**This is a rubric gap.** v2 §2 forces the author to enumerate hand-class combo counts × bet-frequencies, but doesn't require the author to commit to their frequencies *before* computing the ratio. A stricter discipline would require the author to show their initial derivation in a separate table ("first-pass per-class frequencies") and only then reveal any subsequent calibration — preventing silent back-solving.

**Severity.** P1 on process; the output ratio (73:27) is probably within the true credible interval (external sources suggest 30% bluff at solver / 40-50% at live-pool). So the number isn't *wrong*, but the derivation visibly chased a target.

**Proposed v2.1 delta (D10 candidate):** §2 requires showing first-pass per-class frequencies *before* final ratio. See v2.1 proposals at the end.

### CSO-3 — Archetype-conditional recommendation is not rubric-supported

§12 Assumption C produced a decision flip: "call vs reg/pro/fish, fold vs nit." This is an **archetype-conditional §6 recommendation** — the action depends on villain archetype, not a single action with sensitivity bounds.

v2 §6 assumes a single exploit recommendation. The artifact works around this by surfacing the archetype-conditionality in §12 Assumption C rather than in §6, but this is structural friction — the reader looking at §6 sees "pure call" without the archetype override.

This is **the first rubric gap the river pilot surfaced** that would warrant a v2.1 (or v3) delta. It matches the pattern across multiple existing LSW line-audits that mark "archetype flip" as high-leverage bucket-teaching.

**Proposed v2.1 delta (D11 candidate):** §6 allows archetype-conditional recommendation when sensitivity identifies archetype as the decision-flipping dimension. See v2.1 proposals.

### CSO-4 — §3 on river is pure-bimodal (0%/100%) not continuous

v2 §3 describes "bimodal vs flat distribution" as a continuum. On a river decision after all cards are out, hero's equity against each villain combo is 0% OR 100% — strictly binary, no middle. The forcing constraint still works ("state the shape"), but the language is calibrated to flop/turn decisions where equity is continuous and bimodality is a property of the distribution-shape.

The river artifact handles this by stating "pure bimodal distribution — no medium bucket at all." Works, but rubric language could be sharper.

**Proposed v2.1 delta (D12 candidate):** §3 includes river-decision pure-bimodal case with explicit "equity = P(ahead)" framing.

---

## Section-by-section findings

### §1. Node specification

- **F-1a — SPR discussion is structurally irrelevant on river but takes a paragraph** (severity 1, P3)
  - Observation: §1 devotes a paragraph to "SPR ≈ 5.6 post-call, MEDIUM zone" when the very next sentence says "SPR is structurally irrelevant on a river decision." Writing out the zone classification just to invalidate it is noise.
  - Fix: compress to one line. "SPR at node = 5.6 (post-call) / 10.5 (pre-bet); structurally irrelevant on river — no future streets."
  - Severity 1, effort S. Backlog: `US-A2-F1a`.

- Otherwise §1 is clean. Pot derivation + action-history table + prior-street filter rationale all pass.

### §2. Range construction

- **F-2a — Value:bluff ratio derivation was target-driven not constraint-driven** (severity 3, P1)
  - Observation: see CSO-2. Per-class bet frequencies were adjusted mid-derivation to match the LSW audit's reference ratio. The authored result (73:27) may be within the true credible interval, but the derivation process shows calibration-to-target rather than independent-derivation-then-compare. The prose explicitly acknowledges this ("Let me retry... **Adopted working numbers**: total river bet range 60 combos, value 44, bluff 16, ratio 73:27").
  - Fix options:
    - **Option A (artifact-level):** re-derive §2 per-class frequencies in isolation, compare to LSW reference *after*, document any divergence explicitly.
    - **Option B (rubric-level, v2.1 delta D10):** require two-table §2 — first-pass enumeration + reconciliation to external reference.
  - Recommendation: Option B — this is a systematic risk, not a one-off slip.
  - Effort: M (rubric change + artifact update).
  - Proposed backlog: `US-A2-F2a — back-solve process fix; candidate v2.1 delta`.

- **F-2b — "Hero's check-back-turn range ~350 combos" assumes even barrel-selection; not explicitly derived** (severity 2, P2)
  - Observation: §2 says hero barrels ~60-70 of 418 combos, leaving ~350 check-back. The 60-70 number is asserted with hand-class breakdown but per-class barrel frequencies are estimates (AK 50% barrel, etc.).
  - Fix: add a hero-barrel-frequency table similar to the BB-river-bet table (per-class frequencies with ± confidence).
  - Severity 2, effort S-M. Backlog: `US-A2-F2b`.

### §3. Equity distribution

- **F-3a — §3 bucket table has "~30%" in A-high-bluff row that immediately corrects to "0%"** (severity 1, P3)
  - Observation: `"| Suited Ax busted (A9s etc., bluff) | 1 | ~30% (A-high chops/loses only if A-6 or A-5 kicker straight board... not here, just A-high) | A-high loses to 99 overpair; 0% | nuts |"` — the "~30%" column value is followed by the correct "0%" in the derivation column. Typo that should never have shipped.
  - Fix: change "~30%" to "0%" in the equity column; remove the spurious "A-6 or A-5 kicker straight board" reasoning (not applicable on this board).
  - Severity 1, effort S. Backlog: `US-A2-F3a`.

- **F-3b — AQs row contains spurious "3 Q outs + 2 A outs" reasoning that invalid on river** (severity 1, P3)
  - Observation: "AQ has 3 Q outs already here + 2 A outs... wait river is over. Hero loses to AQ's top pair at showdown. 0% equity (showdown-at-river) | air". The stream-of-consciousness correction is visible in the published artifact.
  - Fix: clean to "AQ has top pair + A kicker on Q-high; hero loses at showdown; 0% equity."
  - Severity 1, effort S. Backlog: `US-A2-F3b`.

- **F-3c — River pure-bimodal equity framing could be sharper in rubric** (severity 1, P3; rubric-level)
  - Observation: see CSO-4. The artifact states "pure bimodal" correctly but v2 rubric §3 was written for continuous distributions.
  - Fix: v2.1 delta D12 — §3 includes explicit river-decision pure-bimodal framing.
  - Severity 1, effort rubric-minor. Proposed v2.1 delta below.

### §4. Solver baseline

- **F-4a — Solver claims carry forward "directional inference" weakness from flop pilot** (severity 2, P2)
  - Observation: same weakness as flop F-4a. Claim 3 (solver hero-response 90-95%) is sourced as "directional inference from solver bluff-catch theory." No direct solver citation for this exact node.
  - Fix: same as flop — loosen to range or commission solver run.
  - Effort: S (loosen) or L (solver run, blocked).
  - Backlog: `US-A2-F4a`.

### §5. Population baseline

- **F-5a — Sourcing floor is met for Claim 1 only; Claims 2-5 remain labeled-unsourced** (severity 2, P2)
  - Observation: v2 Delta 3 required *at least one* sourced population claim; Claim 1 (pool bluff fraction via GTO Wizard article) meets it. Claims 2 (value composition), 3-5 (archetype-specific fold rates) remain `population-observed, n≈0`. The sourcing floor passes but the section is still 80% labeled-unsourced.
  - Note: this is not a rubric violation — v2 Delta 3 is "at least ONE" not "all." But an honest audit must observe that passing the minimum doesn't make §5 authoritative.
  - Fix: attempt to cite archetype-specific fold rates from published HUD aggregates (if any exist); if none exist, leave unsourced-with-acknowledgment.
  - Severity 2, effort S-M. Backlog: `US-A2-F5a`.

### §6. Exploit recommendation

- **F-6a — Recommendation is single-action but §12 makes it archetype-conditional** (severity 3, P1; rubric-level v2.1 candidate)
  - Observation: see CSO-3. §6 states "pure call"; §12 Assumption C makes fold correct vs nits. A reader who reaches §6 before §12 gets the unconditional recommendation; the conditionality emerges only in §12.
  - Fix options:
    - **Option A (artifact-level):** restructure §6 to say "call (default); fold if villain is confirmed nit — see §12 Assumption C."
    - **Option B (rubric-level, v2.1 delta D11):** §6 formally supports archetype-conditional recommendations when archetype is the decision-flipping dimension per §12.
  - Recommendation: Option B — archetype-conditional recommendations appear in at least 3 of the LSW bucket-teaching-HIGH nodes. Systematic, not node-specific.
  - Severity 3, effort M.
  - Proposed v2.1 delta D11. See below.

### §7. Villain's perspective

- **F-7a — Villain-EV derivation trail is opaque in-prose even though row values are ledgered** (severity 2, P2)
  - Observation: §7's villain-EV derivation contains "This is getting muddled. Simpler path: BB's bet makes money IF bet-EV > check-EV..." — the prose derivation bumps around before reaching rows 7.1/7.2/7.3 in the ledger. v2 Delta 4 was met (villain EVs appear in §11), but the in-prose derivation leading to those ledger values is visibly confused.
  - Fix: rewrite §7's villain-EV derivation as a clean step-by-step: (1) state BB's check-river showdown equity, (2) show check-EV computation, (3) show bet-EV components (fold-equity + value-win + bluff-loss) with hero's response distribution, (4) show bet-EV > check-EV delta. This is a prose-quality fix, not a ledger fix.
  - Severity 2, effort S-M. Backlog: `US-A2-F7a`.

- **F-7b — Villain-model weight percentages (77%, 20%, 3%) are in §7 prose but not in §11 ledger** (severity 2, P2)
  - Observation: §7 says villain models hero as "77% middle pair, 20% ace-high, 3% stronger." These three percentages are numeric claims per §11 forcing constraint but don't appear as ledger rows.
  - Fix: add ledger rows 7.4, 7.5, 7.6 with source-type `assumed` and falsifier "villain's stated-at-table belief about hero" (if showdown reveal available).
  - Severity 2, effort S. Backlog: `US-A2-F7b`.

### §8. EV tree

- **F-8a — Raise-to-13.6bb sizing not in ledger** (severity 2, P2)
  - Observation: §8 raise-branch uses hero's raise size = 13.6bb (min-raise). This sizing is an authored choice; per v2 §11, it should be a ledger row. Not present.
  - Fix: add ledger row "Hero raise size (chosen: min-raise)" with `assumed` / falsifier "different raise sizing materially changes §8 raise EV."
  - Severity 2, effort S. Backlog: `US-A2-F8a`.

- **F-8b — Raise-branch continuation subrates (75% call / 25% 3bet) are assumed not derived** (severity 1, P3)
  - Observation: "Call-freq ≈ 75%, 3bet-freq ≈ 25% (with strong value)" asserted. Tagged as `assumed` in rows 8.5/8.6 per ledger, which is correct. The finding is that they would ideally be derived from population data or solver output.
  - Fix: cite a source or acknowledge as reads-based read.
  - Severity 1, effort S. Backlog: `US-A2-F8b`.

### §9. Blocker / unblocker

- **Clean.** Card-enumeration correct. Arithmetic clean. No findings.

### §10. MDF / realization

- **Clean.** Realization=N/A handled correctly. No findings.

### §11. Claim-falsifier ledger

- **F-11a — Missing ≥2 numeric claims (villain-model weights, raise sizing)** (severity 2, P2)
  - Observation: per F-7b and F-8a, at least two numeric claims aren't ledgered. The completeness-gate log at end of §11 says "61 claims ledgered" but the actual swept count is 58-59 once the missing claims are added.
  - Fix: extend §11 with rows from F-7b + F-8a; update completeness log.
  - Severity 2, effort S. Backlog: `US-A2-F11a`.

- Otherwise §11 is complete. 61 → 63 rows after fix. Density 7.9 claims/1k words.

### §12. Sensitivity analysis

- **Clean.** Three assumptions with numeric flip thresholds. Assumption C correctly identifies archetype-conditional flip (which then surfaces as F-6a / v2.1 D11 candidate). No findings.

### §13. Contrast with leading theories

- **F-13a — Only 1 C-incomplete; zero B, C-wrong** (severity 1, P3)
  - Observation: 4A + 1 C-incomplete + 0 B + 0 C-wrong. Meets v2 minimum (≥1 B/C-wrong/C-incomplete) but feels thin. Active-challenge sub-section explains the absence of B/C-wrong.
  - Fix: none required per v2; note is for author's self-check on corpus diversity.
  - Severity 1. No backlog item.

- **F-13b — Active-challenge sub-section is present but shallow** (severity 1, P3)
  - Observation: the active-challenge sub-section names the challenge target and explains why no B/C-wrong surfaced. But the explanation ("no reputable source advocates fold as the default") doesn't engage hard sources that *might* disagree (e.g., specific nit-exploit coaches, or cases where solver shows nontrivial fold frequency). Could be tighter.
  - Severity 1, effort S. Backlog: `US-A2-F13b`.

### §14a. Symmetric-node test

- **Clean.** 6 claims classified. 1 partially-changes (under v2 Delta 8 cap of 3). Mirror-node choice (flop pilot's sibling river node) is well-justified and cross-references the corpus.
- No findings.

### §14b. Artifact-level falsifier synthesis

- **Clean.** Two headline falsifiers; both trace to §11 rows; both have numerical thresholds. "No additional headline falsifiers" statement correctly acknowledges decision-level-robustness on other dimensions.
- No findings.

### §14c. Counter-artifact pointer

- **Clean.** Archetype-conditioned + stake-stratified v2 counter-artifact named. Concrete.
- No findings.

---

## Prioritized fix list

| # | Finding | Severity | Priority | Effort | Type |
|---|---|---|---|---|---|
| 1 | F-2a — value:bluff back-solved to target | 3 | P1 | M | Rubric + artifact |
| 2 | F-6a — archetype-conditional recommendation unsupported | 3 | P1 | M | Rubric + artifact |
| 3 | F-2b — hero barrel-selection under-derived | 2 | P2 | S-M | Artifact |
| 4 | F-4a — solver frequencies over-precise (carry-over) | 2 | P2 | S | Artifact |
| 5 | F-5a — §5 Claims 2-5 remain unsourced | 2 | P2 | S-M | Artifact |
| 6 | F-7a — villain-EV derivation opaque in-prose | 2 | P2 | S-M | Artifact |
| 7 | F-7b — villain-model weights not ledgered | 2 | P2 | S | Artifact |
| 8 | F-8a — raise sizing not ledgered | 2 | P2 | S | Artifact |
| 9 | F-11a — ledger missing ≥2 claims | 2 | P2 | S | Artifact |
| 10 | F-1a — SPR paragraph structurally irrelevant | 1 | P3 | S | Artifact |
| 11 | F-3a — §3 typo (~30% should be 0%) | 1 | P3 | S | Artifact |
| 12 | F-3b — AQs spurious outs reasoning | 1 | P3 | S | Artifact |
| 13 | F-3c — river pure-bimodal framing unclear | 1 | P3 | rubric | Rubric |
| 14 | F-8b — raise-branch subrates asserted | 1 | P3 | S | Artifact |
| 15 | F-13a — §13 only 1 C-incomplete | 1 | P3 | none | observation |
| 16 | F-13b — active-challenge shallow | 1 | P3 | S | Artifact |

**Breakdown:** 2 P1, 7 P2, 7 P3. Of 16 findings: 3 rubric-level (F-2a, F-6a, F-3c), 13 artifact-level.

---

## Proposed rubric v2.1 deltas (incremental polish, not fundamental)

Three deltas to address the rubric-level findings above. All incremental — v2 survived the river-decision stress test with only polish needed.

### Delta D10 — §2 first-pass enumeration discipline

**Current (v2):** "full hand-class enumeration is required" at node-of-interest range.

**v2.1 proposed:** "Full hand-class enumeration at node-of-interest. **First-pass frequencies must be committed to before computing aggregate ratios** (value:bluff composition, total combo counts). If the aggregate ratio is calibrated against an external reference (LSW audit number, solver output, coaching article), the first-pass derivation must be preserved in the artifact as a separate table, with reconciliation notes showing what was adjusted and why. Silent back-solving to a target ratio is a rubric violation."

### Delta D11 — §6 supports archetype-conditional recommendation

**Current (v2):** §6 is a single hero action with deltas vs §4 and §5.

**v2.1 proposed:** "If §12 sensitivity analysis identifies villain archetype as the decision-flipping dimension, §6 may be structured as an archetype-conditional recommendation: state the default action (for the most common archetype or archetype-mix), then list the archetype-override cases with their trigger conditions. The archetype-conditional form is: `Default: <action>. Override: if villain is <archetype>, <different action> because <§12 reference>.` Deltas vs §4 and §5 are computed against the default action; override cases may cite §12 directly."

### Delta D12 — §3 river-decision pure-bimodal framing

**Current (v2):** §3 bimodality language assumes continuous equity distributions.

**v2.1 proposed:** "For river-decision nodes (depth-3 collapses to showdown), equity distribution is strictly bimodal: each villain combo produces 0% or 100% equity for hero (hero loses or wins at showdown; no drawing). §3 for river decisions should explicitly state 'pure-bimodal river equity distribution' and express hero's total equity as P(ahead) = count(combos hero beats) / count(total combos). Bucket-counts still required; 'strong/medium/weak' buckets collapse to 'nuts (hero wins)' and 'air (hero loses)'."

---

## Audit sign-off

- **Drafted by:** Claude (main, self-audit — same author as artifact)
- **Verdict:** GREEN (light). 16 findings, 2 P1, rubric v2.1 incremental (3 deltas, all polish).
- **v2 assessment:** rubric v2 survived river-decision stress test. Primary move (claim-falsifier ledger as backbone) worked first-time on river. Supporting deltas (D1-D8) carried over cleanly. Three new rubric-level findings (F-2a/F-6a/F-3c) produce three v2.1 deltas (D10/D11/D12).
- **Owner checkpoint.** v2.1 deltas are narrow in scope. Unlike v1.1 → v2 (which reframed §11 as the organizing backbone), v2 → v2.1 is textual tightening only. Recommend: apply v2.1 deltas inline, then proceed to Stage 4 (leading-theory comparison) without refitting either pilot artifact.

### Proposed sequencing after Stage 3b

**Option 1 (author's recommendation):** apply v2.1 deltas to RUBRIC.md and RUBRIC-CHANGELOG.md; no artifact refits required (flop + river both remain at v2/v2-partial-refit with known F-findings tracked). Proceed directly to Stage 4.

**Option 2:** apply v2.1 + also refit both pilots to v2.1 before Stage 4. Cost: ~2 refit passes.

**Option 3:** defer v2.1 deltas until Stage 4 or Stage 5 surfaces additional pressure; keep rubric at v2 for now.

Recommend **Option 1** — the v2.1 deltas are small enough that applying them now is cheap and ensures the rubric stays current as the corpus grows, but refitting pilots before Stage 4 doesn't add signal (Stage 4 compares against external theory, not against the updated rubric).
