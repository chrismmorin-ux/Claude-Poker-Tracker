DOMAIN AUDIT — Claude-Poker-Tracker, 2026-07-22
Spec status: DRAFT generated (16 rules: 10 artifact + 6 model) — docs/domain-spec.draft.md pending founder promotion
Protocol: sweep (window ecd20b8..5aa1419)

## 1. Phase 0b summary

**Takeaway:** The engine's poker-correctness rulebook was reconstructed from code and doctrine — it's strongly domain-shaped, with no busywork rules to prune.

- **Rule counts (post cross-check):**
  - Artifact-derived (from code): 9 High + 1 Medium = 10
  - Model-level (from intent/counterfactual): 4 Medium + 2 Low = 6
  - **model_level_count: 6**
- **Confidence shifts:** Two rules downgraded during cross-check — PRIOR_WEIGHT pseudocount consistency (High → Medium, "hygiene not decision-correctness"); study-section/live-engine coherence (Medium → Low, "not mechanically checkable as stated"). One kept with note — live/online pool separation (poolBaseline.js already implements it; promote or close, don't carry as speculative).
- **Cross-check outcome:** 0 removed / 2 downgraded / 1 kept-with-note. Zero rules had `enforcement_mechanism: none`, so **governance-candidates: 0** (no file emitted).
- **Unique source files cited (10):** `src/utils/exploitEngine/gameTreeDepth2.js`, `foldEquityCalculator.js`, `gameTreeEvaluator.js`, `bayesianConfidence.js`, `postflopNarrower.js`, `generateExploits.js`; `src/utils/rangeEngine/populationPriors.js`; `src/utils/pokerCore/monteCarloEquity.js`; `src/utils/potCalculator.js`; `src/utils/icmEngine/riskPremium.js`; plus doctrine `.claude/context/POKER_THEORY.md` and `system/intention.md`.

## 2. Sweep drift summary

**Takeaway:** The month of engine changes (commit 5aa1419) is CLEAN — every one of the 8 touched files got *more* theoretically correct, not less. Nothing regressed.

- **Verdict: CLEAN** across all 8 files in window ecd20b8..5aa1419.
- **What improved:**
  - **FIND-030 fixed** — `gameTreeEquity.js:633-655` multiway fold math replaced an ad-hoc "correlation adjustment" fudge factor with the exact conditional-independence product (0.60 × 0.45² = 0.1215, now tested).
  - **FIND-032 fixed** — `villainProfileBuilder.js` un-stubbed sizing-tells using a real showdown Pearson correlation (bet-fraction vs shown strength, gated |r|≥0.35), calibrated per POKER_THEORY §3.5.
  - New empirical pool-baseline (`poolBaseline.js`) correctly segments live vs online, never pools them, with a leave-one-out guard and honestly-documented pseudocount cap.
- **3 new drift findings:**
  - **[MEDIUM] Doctrine lag** — `.claude/context/POKER_THEORY.md:374-382` §6.5 still describes the old 2-tier prior model; code is now 3-tier (founder → pool → per-villain). A reader following the doc never learns the pool layer exists.
  - **[MEDIUM] Fragile prior swap** — `src/utils/exploitEngine/statRules.js:35-54`: `runWithStatPriors` is correct only while everything stays synchronous; a future `await` inside the wrapped rules would silently leak one villain's priors into another's read. Safety net is a comment, not a guard.
  - **[LOW] Naming scope-creep risk** — `src/utils/exploitEngine/villainProfileBuilder.js:508-523`: `SIZING_TELL_EXPLOIT` is display-only today but shaped like the removed WEAKNESS_EXPLOIT_MAP anti-pattern; risks a future contributor wiring it into exploit-scoring.

## 3. Top findings

**Takeaway:** Nothing is on fire. The highest-value action is a founder decision (promote the spec); the rest are cheap hardening before launch.

1. **[ACTION] Promote the draft spec** — `docs/domain-spec.draft.md` (16 rules) awaits founder review. Promotion turns on true drift-detection for every future run. Highest leverage, blocks nothing else.
2. **[MEDIUM] Update doctrine to 3-tier priors** — `.claude/context/POKER_THEORY.md:374-382`. Copy-forward from the `poolBaseline.js` header; low effort, closes a doc-vs-code gap in the section code actually cites (`betaMath.js:168`).
3. **[MEDIUM] Guard the prior swap** — `src/utils/exploitEngine/statRules.js:35-54`. Two-line "throw if fn returns a thenable" makes a latent cross-player prior leak fail loud instead of silent.
4. **[LOW] Comment the sizing-tell map** — `src/utils/exploitEngine/villainProfileBuilder.js:508-523`. One-line "display narrative only" note prevents future misuse.

## 4. Constitutional risks

**Takeaway:** No finding creates make-work. The two rules that *could* have — the cross-check already defused.

- **PRIOR_WEIGHT hygiene cadence** — downgraded to Medium because enforcing pseudocount identity across files on a recurring 14-day cadence is engineering hygiene, not decision-correctness; a 5-vs-10 difference barely moves any real villain's exploit output. Correctly demoted so it doesn't compete with the equity/rake/ICM rules for review priority.
- **Study-section / live-engine reconciliation** — downgraded to Low because "does not rest on contradicting assumptions" has no bounded canonical-spot list and no equivalence test; left as-is it would manufacture exactly the unbounded recurring compliance work the audit is meant to avoid. Held until scoped.
- The remaining findings (doc copy-forward, 2-line guard, 1-line comment) are all bounded, one-time, and root-cause — no self-aggrandizing complexity.

## 5. Convergence path

**Takeaway:** Three concrete, cheap actions close the highest-leverage gaps. (a) is a founder decision; (b) and (c) are a single small dev sprint.

- **(a) Founder reviews + promotes `docs/domain-spec.draft.md`.** This is the keystone — with no promoted spec, every run falls back to doctrine-drift review instead of true spec-drift detection. Promotion unlocks Phase 1 on all future runs. *Founder action, ~30 min review.*
- **(b) Copy-forward the 3-tier prior hierarchy into POKER_THEORY.md §6.5.** Content already exists nearly verbatim in the `poolBaseline.js` header; fold into the next domain-correctness sprint. *Closes the doc-drift finding; verify against `poolBaseline.js:75-81` segmentation + leave-one-out at `:206-212`.*
- **(c) Add the thenable guard in `statRules.js:35-54`.** `throw if runWithStatPriors' fn returns a thenable` — converts a silent future cross-player prior leak into a loud failure. *Pairs with a test asserting the throw; complements the synchronous call pattern at `usePlayerTendencies.js:104-112`.*

## 6. Open questions for the founder

**Takeaway:** Three genuine judgment calls only you can settle — none block launch.

1. **Is live/online pool separation a binding product goal, or an implementation detail?** `poolBaseline.js` already keeps them separate (WS-235), but `intention.md` never states it. Confirm as a goal → promote the rule with the code citation; otherwise → close the open question. Don't leave it as a permanent "speculative Low."
2. **Should study-section ↔ live-engine coherence be a real check, or dropped?** It's a plausible product-trust goal but currently unmeasurable. Worth it only if you'll define a bounded set of canonical spots to check against — otherwise drop it rather than carry an unenforceable rule.
3. **Does the PRIOR_WEIGHT reconciliation belong in the spec at all?** Or is a lightweight note in the sweep cadence enough? It has drifted once (~5 vs ~10, fixed 2026-06-20), so it's a real recurring risk — but hygiene-severity, not decision-correctness. Your call on whether it earns a spec line.

---

### Draft Artifacts Generated (Phase 0b)
- Domain rules drafted: 16 (10 artifact + 6 model) across all 9 problem-class buckets
- Source files cited: 10 unique source files + 2 doctrine docs
- Confidence breakdown: 9 High, 5 Medium, 2 Low
- Governance candidates: 0

Review them with: cat docs/domain-spec.draft.md
Then: cat DRAFTS.md  # for promotion instructions

Promote with: mv docs/domain-spec.draft.md docs/domain-spec.md

Phase 1 (rule-vs-code drift vs promoted spec): Skipped — drafts pending founder promotion. The sweep protocol's drift focus ran instead over commit window ecd20b8..5aa1419 (see phase-1/sweep-drift.yaml): verdict CLEAN, 3 new findings (2 medium, 1 low).

### Contract Alignment (ADR-038)
- mode: honored (default `decide` — audit/scoring output; no engine_intent_recorded event found in look-back, defaults applied)
- stretch: honored (false — loaded state honored; no system/ re-reads)
- success_shape: honored — sweep stamp + drift verdict + draft spec + findings delivered
- scope_ceiling: complied — no ceiling declared; items skipped: none

---

## ADDENDUM — Challenge protocol (same day, 2026-07-22)

After this synthesis, the gate cascade surfaced the overdue CHALLENGE protocol; a focused adversarial pass ran over the post-2026-06-20 surface. Full output: `../challenge-2026-07-22.yaml`.

**Held up:** pool-baseline conjugate math (no double-counting), exact-mean cap rescaling, leave-one-out keying, multiway independence product, FIND-029 confirmed fixed, fold-hierarchy unregressed.

**Landed:** FIND-037 HIGH (online sessions hardcode gameType — all Ignition play collapses into one pool segment → WS-260); FIND-038 HIGH (sizingTells circular — strengthOrdinal uses the model's own avgSegmentation, never handShown, while UI claims "confirmed by showdowns" → WS-261); FIND-039 MEDIUM (free-text live stake labels fragment segments → bundled into WS-260). FIND-030 closed (verified fixed in 5aa1419).

**Revised top findings order:** WS-260 + WS-261 (the two HIGHs) now outrank the doc-drift and guard items from the sweep. The draft-spec promotion (WS-259) remains the structural keystone.

**Kit observation (not a domain finding):** the canonical health score stays clamped at 2 because health-scoring.js `isStale()` gives the one-time baseline protocol a default 30-day cadence — permanently stale after 60 days. Gate logic (cwos-next) does not share this rule. Unlock: re-run baseline, or founder sets explicit `cadence_days` on baseline (founder-owned content field). Candidate for prog-kit-quality routing.
