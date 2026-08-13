# Challenge 2026-08-13 — Phase 2 — CROSS-CRITIQUE (orchestrator)

Run: run-domain-correctness-challenge-2026-08-13. Inputs: six phase-1 lens outputs (this directory's `phase-1/`).
Contested load-bearing claims were verified against source by the orchestrator before ruling (files read: `gameTreeDepth2.js` rake sites, depth-3 return path, `computeRiverCheckEV` head; `check-required-equity-seam.mjs` via two lenses' independent reads).

## Contamination disclosure (named unprompted)

- The dispatch brief named WS-436/450/451/432/431 as scoping pointers. Every lens focused there — intended, but it means "the rest of the engine surface is quiet" CANNOT be concluded from this run.
- FIND-109 (mobile wall-clock residual) and DEC-036 / SYSTEM_MODEL §2.3 (`onFastResult` unwired) pre-exist in repo docs/memory that lenses read. The four-lens convergence on mobile calibration and the two-lens convergence on `onFastResult` are therefore partly INHERITED, not independent. What is genuinely new is marked per-item below.
- `.claude/rules/` and CLAUDE.md files carry the repo's own anti-pattern vocabulary; lenses quoting doctrine back ("shipped-but-inert", "labels are outputs") is uptake, not evidence. Rulings below rest on file:line mechanisms, not vocabulary.

## Verdicts on contested claims

1. **CONFIRMED (senior-engineer KC2), with a severity nuance.** `gameTreeDepth2.js` uses the `rakedShowdownPot` seam at lines 487/491/639/652 and the inline idiom `pot − estimateRake(pot, …)` at lines 1555/1607/1706/1712 — same quantity, two idioms, same file, same commit that declared "the one seam." The two are numerically equivalent today (rakePerBranch.test's exact-reconstruction assertions would fail otherwise), so this is a **consistency/regression defect**, not a wrong number now. The river functions are the site WS-378 already proved gets missed by "it lives in gameTreeDepth2.js so it's covered" reasoning — same blind spot, new concern.

2. **PARTIALLY REFUTED (failure-engineer HR4).** No double-raking: the depth-3 comment at `gameTreeDepth2.js:1441-1444` and the branch structure show rake applied once per terminal branch, on the pot that branch reaches. The valid residue is narrower than claimed: (a) a capped/tiered rake config has no test through the chained depth-3 path; (b) rake on a flop/turn-terminal "showdown" pot is an artifact of the branch-terminal approximation (real hands reach river) — an approximation-fidelity question, not a dealer-behavior error. Keep as test-gap + doc item, not a HIGH.

3. **REFRAMED (senior-engineer HR2 — WS-450/451 YAML "drift").** Not drift: both items are claimed by live session ses-20260813-1429 which authored the fix commits and has not yet run its closure ceremony. A lens without session-registry context read normal in-flight coordination as corruption. Killed as a finding. (The kernel that survives: item status lags commits with nothing marking "fix committed, closure pending.")

4. **UPGRADED (product-ux KC1 + performance KC2, `onFastResult`).** This is recall of DEC-036/SYSTEM_MODEL §2.3 — but both lenses independently re-verified at HEAD call sites (`computeHelpers.js:251`, `useActionAdvisor.js:59-70`, full-repo grep), converting a doc claim into a verified current fact, and the challenge adds the consequence that matters: with the logical clock now actually running refinement (WS-432), the single awaited answer got SLOWER on slow devices, so the unwired fast path is no longer cosmetic debt — it is the only mitigation for performance KC1 and it is dead. The two findings are one system: **the logical clock removed the wall-clock bound (verified: `isBudgetExceeded` at `gameTreeEvaluator.js:1004-1005` is the only refinement gate; every remaining `Date.now()` is reporting-only) and the mechanism built to protect perceived latency has no production caller.**

5. **CONFIRMED AS NUANCED (product-ux KC4).** "WS-450/451 fixes live in the phase least likely to finish" is only half-true: WS-450's caller's-price fix also landed in the depth-1 mandatory phase (`gameTreeEvaluator.js:734-742` per performance HR1) and in `actionClassifier`, which DOES always run. The depth-2/3 portions (and all of WS-451's per-branch rake) are budget-dependent. Severity stands for WS-451, halves for WS-450.

## What each lens missed (selected)

- **systems-architect** missed that the seam-gate precedent it recommends copying (`check-required-equity-seam.mjs`) is itself defeatable (failure KC3: textual pattern, unverified ALLOW annotations) and scoped to 3 dirs that exclude `handAnalysis/` (failure KC1). A `check-rake-seam.mjs` cloned from it inherits those holes.
- **senior-engineer** flagged the regex blind spots but not the ALLOW-comment escape hatch (failure-engineer got it), and misread the WS-450/451 claim state (verdict 3).
- **failure-engineer** overclaimed HR4 (verdict 2) and did not notice its own KC1/KC2 (handAnalysis unraked, ungated) interacts with security KC3: hindsight-vs-live disagreement is exactly the kind of thing a bumped ENGINE_VERSION would let the founder date.
- **performance-engineer** treats the under-billed workMeter (KC3) as compounding KC1; strictly it partially OFFSETS it on slow devices (under-billing means less work charged... no — under-billing means MORE real work fits in the same unit budget, lengthening wall-clock further; direction confirmed, it compounds). Its calibration-rule finding (KC3) is the run's cleanest process catch: dated inside the review window, checkable, unambiguous.
- **security-engineer** KC5 overlaps WS-361 (already open) — corroboration, not new. KC1/KC2/KC3 are the strongest unique findings in the run.
- **product-ux-engineer** hand-identity risk (advice has no handNumber; extension stamps at receipt) is genuinely new and live-table realistic; nobody else looked at the transport layer.

## Convergence clusters → candidate findings (for facilitator)

- **C1. Silent fallback constants indistinguishable from measurement** (security KC2 + failure KC5 + senior KC5; partially pre-filed as FIND-120/WS-458): extend to `villainRequiredEquity` fallbacks (0.75 / 1/3, untested branches) and `computeFilteredEquity` 0.5 / EV 0. NEW surface beyond WS-458's.
- **C2. The seam-gate pattern needs hardening as a class**: AST-or-fixture self-test, verify-the-annotation, ROOTS += handAnalysis/liveAdvisor parity, plus a sibling `check-rake-seam` and unifying the two rake idioms (verdict 1). (senior KC1 + failure KC1/KC3 + systems KC1/LME2.)
- **C3. Hindsight coach disagrees with the live engine by construction** (failure KC1/KC2): unraked + convention-by-accident breakeven in `handAnalysis/`, no cross-check test live-vs-replay. Directly attacks the founder's hand-recreation capability bar.
- **C4. Latency truth on the target device** (performance KC1/KC3 + product-ux KC2/KC3/KC4 + systems KC4): no wall-clock bound, no mobile calibration, no telemetry (latency data computed then discarded), `onFastResult` dead, `isComputing` dropped, D-pill conflates attempted/completed. One program of work, several tickets.
- **C5. Provenance integrity** (security KC1/KC3 + security HR2): rake.tier surfaced nowhere; ENGINE_VERSION never bumped across three algorithm-shape changes (+ no gate tying bumps to engine paths); venue:'live' string coincidence.
- **C6. Cross-hand/within-street advice identity** (product-ux HR1/HR2 + concern 2): no handNumber on payload, receipt-time stamping, no in-flight signal, uncancelled bursts.
- **C7. Cross-cutting option threading has no contract** (systems KC1/KC2 + senior KC3): rakeConfig/workMeter by-hand through ~10 sites; FIND-113 shape recurs by construction. Evaluation-context object + forwarding gates.
- **C8. Style display fork** (systems KC3 + security KC4): corroborates open WS-447; adds `useCitedDecisions` re-entry + caveat-badge gap — route as scope additions to WS-447, not a new item.
- **C9. Sizing/legality** (failure KC4 + HR3): WS-402 residual on candidate pricing; min-raise increment illegality; `villainRequiredEquity` canonical raise size ignores effectiveStack. Partially open elsewhere — dedupe against WS-402.
- **C10. Recalibration discipline** (performance KC3): re-run rule violated by WS-436 A1-A4 / WS-450 / WS-451; static COMBO_EVAL_COST under-bills; no version bump on REFINEMENT_CLOCK_VERSION.

Dedupe notes for facilitator: FIND-118/WS-456, FIND-119/WS-457, FIND-120/WS-458 already cover senior KC4/HR1/part-of-KC5 (senior said so itself). WS-361, WS-447, WS-402, FIND-109 are open and overlap C4/C8/C9 — additions go into those where the item exists.
