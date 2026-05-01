#!/usr/bin/env python3
"""
Synthesize the 4-agent domain-correctness baseline audit into FIND-*.yaml + WS-*.yaml.

Inputs are hand-curated from the agent reports (kept inline for traceability).
Run from repo root. Writes:
  .claude/workstream/findings/FIND-001..N.yaml
  .claude/workstream/findings-index.yaml (updated)
  .claude/workstream/queue/WS-116..WS-120.yaml  (auto-promoted top 5)
  .claude/workstream/queue-index.yaml (updated)
  .claude/workstream/programs/prog-domain-correctness.yaml (last_run + history + health)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from datetime import date

REPO = Path(__file__).resolve().parents[1]
FINDINGS_DIR = REPO / ".claude" / "workstream" / "findings"
QUEUE_DIR = REPO / ".claude" / "workstream" / "queue"
PROG_FILE = REPO / ".claude" / "workstream" / "programs" / "prog-domain-correctness.yaml"
FINDINGS_INDEX = REPO / ".claude" / "workstream" / "findings-index.yaml"
QUEUE_INDEX = REPO / ".claude" / "workstream" / "queue-index.yaml"

TODAY = date.today().isoformat()
RUN_ID = "run-domain-correctness-baseline-2026-05-01"
PROGRAM = "domain-correctness"
ENGINE = "eng-engine"
PROTOCOL = "baseline"

# Canonical finding records — derived from the 4 agent reports, deduped.
FINDINGS: list[dict] = [
    # ====== HIGH ======
    {
        "title": "Credible intervals computed but never consumed in any UI surface",
        "severity": "HIGH",
        "category": "bayesian-confidence",
        "problem_class": "Bayesian confidence representation",
        "description": (
            "tendencyCalculations.js:343-358 builds `intervals = { vpip, pfr, threeBet, "
            "cbet, foldToCbet, foldTo3Bet }` via credibleInterval(...) and returns them on "
            "the stat object. A repository-wide grep for `credibleInterval`, `ciLower`, "
            "`ciUpper`, or `intervals.vpip` against `src/components/` returns zero matches. "
            "Sample-size uncertainty is computed but the user only sees point estimates."
        ),
        "affected_files": [
            "src/utils/tendencyCalculations.js",
            "src/components/views/PlayerAnalysisPanel.jsx",
            "src/components/views/OnlineView.jsx",
            "src/components/views/HandReplay/**",
        ],
        "recommended_fix": (
            "Wire `stats.intervals.{stat}.lower/upper` through the props chain into "
            "PlayerAnalysisPanel, OnlineView seat annotations, and HandReplay ReviewPanel "
            "so the user sees the credible band, not just the mean."
        ),
        "theory_citation": "POKER_THEORY.md §6.5; RANGE_ENGINE_DESIGN.md §4.6",
        "agent_corroboration": ["range-equity-audit (F1)"],
    },
    {
        "title": "Hard 0.5 value/bluff cutoff over noisy 500-trial Monte Carlo",
        "severity": "HIGH",
        "category": "equity-calculation",
        "problem_class": "Equity calculation correctness",
        "description": (
            "replayAnalysis.js:24-30 returns `handEquity > 0.5 ? 'value' : 'bluff'` over "
            "equities computed by `handVsRange(..., { trials: 500 })`. 500 trials at p≈0.5 "
            "gives ~±4.4% margin of error at 95% — easily flips the verdict for borderline "
            "equities. The classifier is presented to the user as authoritative."
        ),
        "affected_files": [
            "src/utils/handAnalysis/replayAnalysis.js",
        ],
        "recommended_fix": (
            "Either raise trial count to ≥3000 or return a banded classification "
            "(`'value' | 'thin' | 'bluff'`) centered on 0.5 ± MoE; plumb the MoE into "
            "the classifier so confidence reflects sample size."
        ),
        "theory_citation": "POKER_THEORY.md §4.1, §6.4",
        "agent_corroboration": ["range-equity-audit (F2)"],
    },
    {
        "title": "POKER_THEORY.md missing freshness header — drift cannot be tracked",
        "severity": "HIGH",
        "category": "theory-drift",
        "problem_class": "Theory-spec drift",
        "description": (
            "POKER_THEORY.md begins immediately with §1; no `last verified` or `version` "
            "field at the top. Without a freshness anchor, the program's drift-detection "
            "protocol cannot determine whether the doctrine has been reviewed against the "
            "code recently. The doctrine itself is comprehensive (538 lines, 9 sections, "
            "13 mistake-prevention bullets) but undated."
        ),
        "affected_files": [
            ".claude/context/POKER_THEORY.md",
        ],
        "recommended_fix": (
            "Add a frontmatter header: `last verified: <date>`, `verified-by: <session>`, "
            "`version: <n>`, and a `changelog:` block tracking deltas."
        ),
        "theory_citation": "prog-domain-correctness.yaml problem_class 'Theory-spec drift'",
        "agent_corroboration": ["theory-drift-anti-pattern-sweep"],
    },
    {
        "title": "preflopAdvisor.js: PFR/VPIP-ratio scaling stacks on style-conditioned prior",
        "severity": "HIGH",
        "category": "first-principles",
        "problem_class": "First-principles decision modeling",
        "description": (
            "preflopAdvisor.js:147-154 applies a style-conditioned multiplier "
            "(priorMean *= styleFoldRate / popFoldRate) gated on `dataSourceWhenNoObserved "
            "!== 'model'`. preflopAdvisor.js:158-162 then unconditionally applies "
            "`pfrRatio > 0.5 ? *= 0.90 : pfrRatio < 0.3 ? *= 1.08`. Both adjustments encode "
            "the same passive-vs-aggressive opener signal — the very stats that classify "
            "the style. This is double-counting forbidden by POKER_THEORY.md §7.4."
        ),
        "affected_files": [
            "src/utils/exploitEngine/preflopAdvisor.js",
        ],
        "recommended_fix": (
            "Gate the PFR-ratio block under the same `dataSourceWhenNoObserved !== 'model'` "
            "guard AND skip when the style adjustment was already applied. Use one or the "
            "other as the fold-prior modifier, never both in the same fallback path."
        ),
        "theory_citation": "POKER_THEORY.md §7.4 (single-source rule); exploitEngine/CLAUDE.md anti-pattern",
        "agent_corroboration": ["first-principles-audit (F4)", "game-tree-villain-audit (F2)"],
    },
    {
        "title": "postflopNarrower.adaptMultipliers: style stacks with AF/VPIP/cbet/foldToCbet stat adjustments",
        "severity": "HIGH",
        "category": "first-principles",
        "problem_class": "First-principles decision modeling",
        "description": (
            "postflopNarrower.js:495-591 (`adaptMultipliers`): lines 511-561 apply "
            "AF/foldToCbet/cbet/threeBet/VPIP adjustments. Lines 570-590 then apply "
            "Fish/LAG/Nit/LP style adjustments, gated only on `hasObservedAdjustments`. "
            "When `seedMultipliers` (villainModel) is present, AF/VPIP/cbet adjustments "
            "still fire at 0.5 dampening — they are dampened, not skipped. Style and stats "
            "are then both consumed, double-counting the same signal."
        ),
        "affected_files": [
            "src/utils/exploitEngine/postflopNarrower.js",
        ],
        "recommended_fix": (
            "When `seedMultipliers` is provided (villain model is the higher-fidelity "
            "source), skip the AF/VPIP/cbet/threeBet/foldToCbet stat adjustments entirely "
            "instead of dampening them at 0.5. The model already reflects these stats."
        ),
        "theory_citation": "POKER_THEORY.md §7.4; exploitEngine/CLAUDE.md anti-pattern (no double-counting)",
        "agent_corroboration": ["first-principles-audit (F1)"],
    },
    # ====== MEDIUM ======
    {
        "title": "STYLE_FOLD_DEFAULTS raw lookup in multiway opponent fold rate",
        "severity": "MEDIUM",
        "category": "first-principles",
        "problem_class": "First-principles decision modeling",
        "description": (
            "gameTreeEquity.js:574-575 (`multiwayFoldPct`): when no villainModel exists, "
            "fold rate is read directly from `STYLE_FOLD_DEFAULTS[opp.playerStats.style]` "
            "with no consideration of bet size, pot odds, board texture, or villain equity "
            "vs hero's bet. Style label drives the rate alone."
        ),
        "affected_files": ["src/utils/exploitEngine/gameTreeEquity.js"],
        "recommended_fix": (
            "Compute opponent fold rate from a logistic on (range vs hero's bet equity "
            "ratio) using style only as a Bayesian prior on logistic steepness, the same "
            "way `getLogisticSteepness` does in gameTreeDepth2."
        ),
        "theory_citation": "POKER_THEORY.md §7.1, §7.5",
        "agent_corroboration": ["first-principles-audit (F2)"],
    },
    {
        "title": "STYLE_FOLD_DEFAULTS raw lookup in preflop decisionTreeBuilder",
        "severity": "MEDIUM",
        "category": "first-principles",
        "problem_class": "First-principles decision modeling",
        "description": (
            "decisionTreeBuilder.js:55-58 (`computeFoldPct`) Priority 2 fallback returns a "
            "style-keyed constant with zero game-state dependence (no equity, no pot odds, "
            "no position, no raise count). The villain-model branch above handles the "
            "high-fidelity case; this fires whenever the model is absent."
        ),
        "affected_files": ["src/utils/exploitEngine/decisionTreeBuilder.js"],
        "recommended_fix": (
            "Replace the raw lookup with `estimatePreflopFoldPct(stats, 'raise', "
            "posContext, null)` from preflopAdvisor.js — already integrates positional "
            "matchup + style prior + PFR/VPIP scaling."
        ),
        "theory_citation": "POKER_THEORY.md §7.1; sub-CLAUDE.md anti-pattern",
        "agent_corroboration": ["first-principles-audit (F3)"],
    },
    {
        "title": "No exact-enumerate fast path in handVsRange analysis-layer callers",
        "severity": "MEDIUM",
        "category": "equity-calculation",
        "problem_class": "Equity calculation correctness",
        "description": (
            "All four call sites in handAnalysis/replayAnalysis.js + handAnalysis/"
            "hindsightAnalysis.js unconditionally use Monte Carlo with 500-1000 trials. "
            "Project memory states `exactEnumerateEquity()` exists for ≤20 combos on "
            "turn/river. These analysis-layer callers never short-circuit to it."
        ),
        "affected_files": [
            "src/utils/handAnalysis/hindsightAnalysis.js",
            "src/utils/handAnalysis/replayAnalysis.js",
        ],
        "recommended_fix": (
            "Pre-compute villain-range combo count and remaining-board cards; route to "
            "`exactEnumerateEquity()` when feasible (≤20 combos AND turn/river)."
        ),
        "theory_citation": "POKER_THEORY.md §1.3; RANGE_ENGINE_DESIGN.md §14",
        "agent_corroboration": ["range-equity-audit (F3)"],
    },
    {
        "title": "assessEV produces categorical +EV/-EV verdict without confidence gating",
        "severity": "MEDIUM",
        "category": "bayesian-confidence",
        "problem_class": "Bayesian confidence representation",
        "description": (
            "replayAnalysis.js:36-82 (`assessEV`) uses hard thresholds (`valuePct > 50`, "
            "`valuePct < 25 && drawPct < 20`) to produce verdict labels. No `dataQuality` "
            "or sample-size check before the verdict is returned; small-sample range "
            "estimates produce confident-looking labels."
        ),
        "affected_files": ["src/utils/handAnalysis/replayAnalysis.js"],
        "recommended_fix": (
            "Gate the verdict on the underlying range profile's `handsProcessed` (or "
            "`confidence`); below threshold, return `verdict: 'unknown'` with reason "
            "'insufficient data'."
        ),
        "theory_citation": "POKER_THEORY.md §6.5; RANGE_ENGINE_DESIGN.md §8.2-8.3",
        "agent_corroboration": ["range-equity-audit (F4)"],
    },
    {
        "title": "PIP 'active tier' count uses hard 0.3 cutoff without uncertainty propagation",
        "severity": "MEDIUM",
        "category": "first-principles",
        "problem_class": "Range estimation correctness",
        "description": (
            "rangeEngine/pipCalculator.js:70, 78-91 (`countActiveTiers`): "
            "`WEIGHT_THRESHOLD = 0.3` and `if (w > WEIGHT_THRESHOLD) count++` — a binary "
            "indicator over Float64 weights. PIP delta is `playerTiers - gtoTiers` with no "
            "credible-interval, no sample-size attribution, no confidence label."
        ),
        "affected_files": ["src/utils/rangeEngine/pipCalculator.js"],
        "recommended_fix": (
            "Compute per-position confidence (bucket via `bayesianSampleConfidence` of "
            "`noRaiseFaced + facedRaise`) and attach `{ pips, confidence }`; render the "
            "delta with a confidence badge in `formatPips`."
        ),
        "theory_citation": "RANGE_ENGINE_DESIGN.md §5.3-5.4, §4.6",
        "agent_corroboration": ["range-equity-audit (F6)"],
    },
    {
        "title": "detectPositionallyAware uses raw frequentist ratios with min-N=5 gate",
        "severity": "MEDIUM",
        "category": "bayesian-confidence",
        "problem_class": "Range estimation correctness",
        "description": (
            "rangeEngine/traitDetector.js:119-142: gates on `earlyOpp < 5 || lateOpp < 5`, "
            "then computes `Math.round((earlyOpens / earlyOpp) * 100)` and triggers when "
            "`lateOpenPct > earlyOpenPct * 1.5`. With n=5 and one extra open, the percentage "
            "moves 20%+ — false positives from MC-level noise. No Beta posterior comparison "
            "of the two rates."
        ),
        "affected_files": ["src/utils/rangeEngine/traitDetector.js"],
        "recommended_fix": (
            "Replace with `bayesianDeviationTest` (or pairwise `betaPosterior`-difference "
            "probability) requiring posterior P(LP > 1.5×EP) > 0.85; move the 5-hand floor "
            "into the prior as STAT_PRIORS."
        ),
        "theory_citation": "POKER_THEORY.md §6.5; rangeEngine/CLAUDE.md ('no z-tests')",
        "agent_corroboration": ["range-equity-audit (F7)"],
    },
    {
        "title": "Theory drift: rake/SPR-zones/personalized-fold-curves implemented in code, undocumented in POKER_THEORY.md",
        "severity": "MEDIUM",
        "category": "theory-drift",
        "problem_class": "Theory-spec drift",
        "description": (
            "Engines implement (a) `villainRangeShapeSizing` + `fitFoldCurveParams` "
            "personalized fold-curve hierarchy (foldEquityCalculator.js:155, "
            "gameTreeSizingHelpers.js:54), (b) 5-zone SPR strategy (MICRO/LOW/MEDIUM/HIGH/"
            "DEEP) wired across the game tree, (c) rake-adjusted EV threading "
            "(estimateRake, rakeConfig in foldEquityCalculator.js:149-180). POKER_THEORY.md "
            "is silent on the algorithm hierarchies and zone boundaries actually used. "
            "Code is AHEAD of the theory doc, not behind."
        ),
        "affected_files": [
            ".claude/context/POKER_THEORY.md",
            "src/utils/exploitEngine/gameTreeSizingHelpers.js",
            "src/utils/exploitEngine/foldEquityCalculator.js",
            "src/utils/potCalculator.js",
        ],
        "recommended_fix": (
            "Add three sections to POKER_THEORY.md: (a) Personalized Fold Curve "
            "Hierarchy (personalized > explicit > style > defaults), (b) 5-zone SPR "
            "strategy with zone boundaries and decision rules per zone, (c) Rake-adjusted "
            "EV pipeline. Alternative: keep POKER_THEORY.md as principles and create a "
            "separate `ENGINE_ALGORITHMS.md` catalog."
        ),
        "theory_citation": "POKER_THEORY.md §3.5, §6 (gaps); memory: project_rake_spr_antes",
        "agent_corroboration": ["theory-drift-anti-pattern-sweep (D1, D2)"],
    },
    {
        "title": "PRIOR_WEIGHT numeric drift: code has 10, POKER_THEORY.md §6.5 says ~5",
        "severity": "MEDIUM",
        "category": "theory-drift",
        "problem_class": "Theory-spec drift",
        "description": (
            "POKER_THEORY.md §6.5 specifies `bayesianUpdater.js uses ~5 virtual observations "
            "as prior weight`. Actual constant in rangeEngine/populationPriors.js:57 is "
            "`PRIOR_WEIGHT = 10`. Numeric mismatch — either the doc is stale or the constant "
            "drifted; either way the two should agree."
        ),
        "affected_files": [
            ".claude/context/POKER_THEORY.md",
            "src/utils/rangeEngine/populationPriors.js",
        ],
        "recommended_fix": (
            "Decide whether the correct value is 5 or 10 (consider revisiting the empirical "
            "calibration). Update both the code and POKER_THEORY.md to agree. Add a brief "
            "rationale in the doc for the chosen value."
        ),
        "theory_citation": "POKER_THEORY.md §6.5",
        "agent_corroboration": ["theory-drift-anti-pattern-sweep (D3)"],
    },
    # ====== LOW ======
    {
        "title": "gameTreeContext.styleFallback shifts equity ANCHORS by villain style",
        "severity": "LOW",
        "category": "first-principles",
        "problem_class": "First-principles decision modeling",
        "description": (
            "gameTreeContext.js:235-241: `styleFallback[b] = BUCKET_EQUITY_ANCHORS[b] * "
            "(1 + (popFold - styleFold) * 0.3)` — bucket EQUITY anchors (a property of "
            "cards on a board) are scaled by villain's style fold tendency. Equity is a "
            "function of cards; folding tendency belongs in fold-rate computation."
        ),
        "affected_files": ["src/utils/exploitEngine/gameTreeContext.js"],
        "recommended_fix": (
            "Use unscaled `BUCKET_EQUITY_ANCHORS` as the static fallback; apply style "
            "stickiness only inside fold-rate computation in gameTreeDepth2 "
            "`comboActionProbabilities`."
        ),
        "theory_citation": "POKER_THEORY.md §1.3, §7.4",
        "agent_corroboration": ["first-principles-audit (F5)"],
    },
    {
        "title": "bayesianSampleConfidence advertises Beta priors but ignores them",
        "severity": "LOW",
        "category": "bayesian-confidence",
        "problem_class": "Bayesian confidence representation",
        "description": (
            "bayesianConfidence.js:241-262 signature is `(n, priorAlpha=1, priorBeta=1)` "
            "and JSDoc says 'effective sample size (prior + observed)' but the body ignores "
            "both params and returns `f(n) = 0.10 + 0.83 * (1 - exp(-n / 12))`. Used by "
            "decisionAccumulator.js:497 and elsewhere — the priors don't participate."
        ),
        "affected_files": ["src/utils/exploitEngine/bayesianConfidence.js"],
        "recommended_fix": (
            "Either remove the unused params + update JSDoc, or make confidence a function "
            "of effective `n_eff = n + α + β` so prior strength meaningfully participates."
        ),
        "theory_citation": "POKER_THEORY.md §6.5",
        "agent_corroboration": ["range-equity-audit (F5)"],
    },
    {
        "title": "updateScenarioRanges scales prior grid by single ratio rather than per-cell update",
        "severity": "LOW",
        "category": "first-principles",
        "problem_class": "Range estimation correctness",
        "description": (
            "rangeEngine/bayesianUpdater.js:116-124: effective frequency is computed once "
            "per (position, action) then applied uniformly: "
            "`ranges[action][i] = Math.min(1.0, prior[i] * ratio)`. When observed freq "
            ">> prior freq, all in-prior cells saturate to 1.0 and lose relative ordering. "
            "No per-cell credible interval to defend against this."
        ),
        "affected_files": ["src/utils/rangeEngine/bayesianUpdater.js"],
        "recommended_fix": (
            "Track per-cell observation counts (or maintain Beta(α,β) per cell when "
            "showdowns exist) so showdown anchors don't get washed out by frequency "
            "rescaling."
        ),
        "theory_citation": "RANGE_ENGINE_DESIGN.md §4.5",
        "agent_corroboration": ["range-equity-audit (F8)"],
    },
    {
        "title": "Texture preservation comment claims L3 dropping but code keeps texture at L1-L3",
        "severity": "LOW",
        "category": "documentation",
        "problem_class": "Theory-spec drift",
        "description": (
            "villainDecisionModel.js:148-161 comment says 'Texture preserved through L3 "
            "(3 levels)' but `buildHierarchyPatterns` keeps texture at L1, L2, L3 and drops "
            "it at L4. Comment is correct in intent but ambiguous in phrasing — a reader "
            "could misinterpret."
        ),
        "affected_files": ["src/utils/exploitEngine/villainDecisionModel.js"],
        "recommended_fix": (
            "Tighten comment to: 'Texture preserved at L1, L2, L3; dropped at L4' to remove "
            "ambiguity."
        ),
        "theory_citation": "memory: project_game_tree_session2.md",
        "agent_corroboration": ["game-tree-villain-audit (F1)"],
    },
    {
        "title": "multiwayFoldPct correlation adjustment direction may overshoot ceiling",
        "severity": "LOW",
        "category": "first-principles",
        "problem_class": "Game tree EV correctness",
        "description": (
            "gameTreeEquity.js:580-586: for overbet (betFraction=2.0) with 2 opponents, "
            "correlationAdj=1.05 INCREASES allFoldPct above the independent product. The "
            "information-cascade interpretation is theoretically defensible but currently "
            "boosts BOTH the cascade AND the betFraction effect on each opponent's fold "
            "(already inside the per-opponent product for personalized villain models)."
        ),
        "affected_files": ["src/utils/exploitEngine/gameTreeEquity.js"],
        "recommended_fix": (
            "Confirm with simulation that the cascade boost doesn't push fold rates above "
            "realistic ceilings; document the empirical basis or cap at independent product "
            "× small bonus."
        ),
        "theory_citation": "memory: project_game_tree_tier1.md (24.4)",
        "agent_corroboration": ["game-tree-villain-audit (F4)"],
    },
    {
        "title": "Double-tightening through depth-3 may over-narrow continuing range",
        "severity": "LOW",
        "category": "first-principles",
        "problem_class": "Villain decision model fidelity",
        "description": (
            "gameTreeDepth2.js:818-819, 901-906: `tightenRatesForContinuation(callingRates, "
            "'call')` cascades correctly across turn→river depth-3, but the chained "
            "turnCallingRates → riverCallingRates pattern double-tightens. If villain has "
            "already been forced through one tightening on the turn (called the flop bet), "
            "tightening again for the next street on top of the explicit street-conditional "
            "model output may over-narrow."
        ),
        "affected_files": ["src/utils/exploitEngine/gameTreeDepth2.js"],
        "recommended_fix": (
            "Audit that double-tightening through depth-3 doesn't push villain's range "
            "below the actual continuing range observed in turn-after-flop-call situation "
            "keys (the hierarchy queries should already provide street-conditional rates)."
        ),
        "theory_citation": "POKER_THEORY.md §3.6; memory: project_villain_model_assumptions_fix.md",
        "agent_corroboration": ["game-tree-villain-audit (F5)"],
    },
    {
        "title": "Polarization overbet candidate produces near-duplicate 1.5x and 2.0x sizings",
        "severity": "LOW",
        "category": "first-principles",
        "problem_class": "Game tree EV correctness",
        "description": (
            "Two parallel polarization-overbet paths exist: heroActionBuilder.js:166-170 "
            "adds 2x pot when nutAdvantage>0.3 + heroEquity>0.55 + polarization>0.4; "
            "villainRangeShapeSizing in gameTreeSizingHelpers.js:92-95 adds 1.5x/2.0x when "
            "villain range is `capped`. Both can fire and add three near-duplicate "
            "large-bet candidates. Dedup on `Math.abs(targetSize - existing) < potSize * "
            "0.10` may miss the 1.5x↔2.0x pair (gap = 0.5×pot)."
        ),
        "affected_files": [
            "src/utils/exploitEngine/heroActionBuilder.js",
            "src/utils/exploitEngine/gameTreeSizingHelpers.js",
        ],
        "recommended_fix": (
            "Consolidate the overbet construction so a single decision rule produces 1 "
            "overbet candidate; downstream EV evaluation already handles ranking."
        ),
        "theory_citation": "POKER_THEORY.md §3.5, §5.7",
        "agent_corroboration": ["game-tree-villain-audit (F6)"],
    },
    {
        "title": "Block-bet candidate added unconditionally without villain-range check",
        "severity": "LOW",
        "category": "first-principles",
        "problem_class": "Game tree EV correctness",
        "description": (
            "heroActionBuilder.js:173-180: block-bet (0.25x pot) is added whenever hero has "
            "river-equity 0.35-0.55. Block-betting is correct only when villain's checking "
            "range has bluff-catchers AND would otherwise bet bigger; vs a calling station, "
            "0.25x leaves value on the table."
        ),
        "affected_files": ["src/utils/exploitEngine/heroActionBuilder.js"],
        "recommended_fix": (
            "Generation is fine; rely on the EV evaluator to suppress when context unfit. "
            "Confirm `evaluateHeroAction` ranks 0.25x below 0.5x against weak-calling-range "
            "villains via `eqVsCallRange × (potAfterCall − rake)`."
        ),
        "theory_citation": "POKER_THEORY.md §4.1 (thin value sizing)",
        "agent_corroboration": ["game-tree-villain-audit (F7)"],
    },
]

EFFORT_BY_SEVERITY = {"HIGH": "M", "MEDIUM": "M", "LOW": "S"}

# Severity -> priority_score floor.  prog-domain-correctness has priority_floor: 27.
PRIORITY_BY_SEVERITY = {"HIGH": 30.0, "MEDIUM": 22.0, "LOW": 15.0}


def slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:60]


def yaml_quote(s: str) -> str:
    s = s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
    return f'"{s}"'


def yaml_block_scalar(s: str, indent: int = 2) -> str:
    pad = " " * indent
    body = "\n".join(pad + line for line in s.splitlines() or [s])
    return "|\n" + body


def render_finding(find_id: str, item: dict) -> str:
    L = []
    L.append(f'id: "{find_id}"')
    L.append(f"title: {yaml_quote(item['title'])}")
    L.append(f"severity: {item['severity']}")
    L.append(f"status: open")
    L.append(f'category: "{item["category"]}"')
    L.append(f'program: "{PROGRAM}"')
    L.append(f'problem_class: "{item["problem_class"]}"')
    L.append("source:")
    L.append(f'  engine: "{ENGINE}"')
    L.append(f'  protocol: "{PROTOCOL}"')
    L.append(f'  run_id: "{RUN_ID}"')
    L.append(f'  date: "{TODAY}"')
    L.append("description: " + yaml_block_scalar(item["description"], indent=2))
    L.append("affected_files:")
    for f in item["affected_files"]:
        L.append(f'  - "{f}"')
    L.append("recommended_fix: " + yaml_block_scalar(item["recommended_fix"], indent=2))
    L.append(f"theory_citation: {yaml_quote(item['theory_citation'])}")
    L.append("agent_corroboration:")
    for a in item["agent_corroboration"]:
        L.append(f'  - "{a}"')
    L.append(f'dedup_key: "{ENGINE}-{PROGRAM}-{slug(item["title"])}"')
    L.append(f'created_at: "{TODAY}"')
    L.append(f'updated_at: "{TODAY}"')
    L.append('promoted_to: ""')
    return "\n".join(L) + "\n"


def render_work_item(ws_id: str, find_id: str, item: dict) -> str:
    L = []
    L.append(f'id: "{ws_id}"')
    L.append(f"title: {yaml_quote(item['title'])}")
    L.append(f'legacy_id: "{find_id}"')
    L.append("type: finding")
    L.append("status: backlog")
    L.append('claimed_by: ""')
    L.append("claimed_at: null")
    L.append("completed_at: null")
    L.append(f"priority_score: {PRIORITY_BY_SEVERITY[item['severity']]}")
    L.append(f'priority_label: "P0"')
    L.append(f'category: "{PROGRAM}"')
    L.append('capability: "governance"')
    L.append(f'program: "{PROGRAM}"')
    L.append("description: " + yaml_block_scalar(item["description"], indent=2))
    L.append("accept_criteria:")
    L.append(f"  - {yaml_quote(item['recommended_fix'])}")
    L.append(f'effort: "{EFFORT_BY_SEVERITY[item["severity"]]}"')
    L.append("files_involved:")
    for f in item["affected_files"]:
        L.append(f'  - "{f}"')
    L.append("blocked_by: []")
    L.append("blocked_by_legacy: []")
    L.append("enables: []")
    L.append('sprint_id: ""')
    L.append("decision_flags: []")
    L.append("source:")
    L.append(f'  engine: "{ENGINE}"')
    L.append(f'  finding_id: "{find_id}"')
    L.append(f'  run_id: "{RUN_ID}"')
    L.append('  origin: "auto-promoted-from-finding"')
    L.append("auto_expires: false")
    L.append(f'created_at: "{TODAY}"')
    L.append(f'updated_at: "{TODAY}"')
    return "\n".join(L) + "\n"


def write_findings_index(items: list[tuple[str, dict]]) -> str:
    L = ["# Findings Index — fast-scan summary of all findings",
         "# Rebuild from: findings/FIND-*.yaml",
         "# Updated by /engine (via cwos-reconcile)",
         "",
         f'last_updated: "{TODAY}"',
         f"finding_count: {len(items)}",
         "findings:"]
    for fid, item in items:
        L.append(f'  - id: "{fid}"')
        L.append(f"    title: {yaml_quote(item['title'])}")
        L.append(f'    engine: {ENGINE}')
        L.append(f"    severity: {item['severity']}")
        L.append(f"    status: open")
        L.append(f'    program: "{PROGRAM}"')
        L.append(f'    dedup_key: "{ENGINE}-{PROGRAM}-{slug(item["title"])}"')
        L.append(f'    created_at: "{TODAY}"')
    return "\n".join(L) + "\n"


def append_to_queue_index(new_items: list[tuple[str, dict]]) -> None:
    text = QUEUE_INDEX.read_text(encoding="utf-8")
    # Update item_count; append new entries before EOF.
    new_count = 115 + len(new_items)
    text = re.sub(r"^item_count: \d+", f"item_count: {new_count}", text, count=1, flags=re.M)
    text = re.sub(r"^last_updated: \"[^\"]+\"", f'last_updated: "{TODAY}"', text, count=1, flags=re.M)

    addition = []
    for ws_id, item in new_items:
        addition.append(f'  - id: "{ws_id}"')
        addition.append(f"    title: {yaml_quote(item['title'])}")
        addition.append(f'    legacy_id: "auto-promoted-from-{ws_id}"')
        addition.append(f"    status: backlog")
        addition.append(f"    priority_score: {PRIORITY_BY_SEVERITY[item['severity']]}")
        addition.append(f'    priority_label: "P0"')
        addition.append(f'    category: "{PROGRAM}"')
        addition.append(f'    capability: "governance"')
        addition.append(f'    program: "{PROGRAM}"')
        addition.append(f'    type: finding')
        addition.append(f'    effort: "{EFFORT_BY_SEVERITY[item["severity"]]}"')
        addition.append(f'    claimed_by: ""')
        addition.append(f'    sprint_id: ""')
    if not text.endswith("\n"):
        text += "\n"
    text += "\n".join(addition) + "\n"
    QUEUE_INDEX.write_text(text, encoding="utf-8")


def update_program_yaml(num_findings: int, num_promoted: int) -> None:
    text = PROG_FILE.read_text(encoding="utf-8")
    # Update last_run_by_protocol.baseline (multiline replace).
    text = re.sub(
        r'  baseline: \{ date: null, engine: null, run_id: null, result: null \}',
        f'  baseline: {{ date: "{TODAY}", engine: "{ENGINE}", run_id: "{RUN_ID}", '
        f'result: "{num_findings} findings ({num_promoted} HIGH auto-promoted to queue); engines mostly compliant on 9 anti-patterns; theory-doc drift identified" }}',
        text, count=1
    )
    # Update findings_open + work_items_open + health_score + maturity reflection.
    text = re.sub(r"^findings_open: 0$", f"findings_open: {num_findings}", text, count=1, flags=re.M)
    text = re.sub(r"^work_items_open: 0$", f"work_items_open: {num_promoted}", text, count=1, flags=re.M)

    # Compute health using the formula in kit/templates/system/health-scoring.md (approximate).
    # Baseline-only ceiling for critical-tier program = 6 (rigor: baseline=6, sweep=7, challenge=8, blind_spot=9, full=10).
    # finding_health = max(0, 1 - (open_critical * 0.4) - (open_high * 0.2) - (open_medium * 0.1)) — no critical, 5 high, 8 medium = 1 - 1.0 - 0.8 = 0 (clamped)
    # protocol_currency: only baseline run (1 of 5 protocols, 0.20)
    # problem_class_coverage: 9 problem classes, baseline checked roughly 6 (~0.67)
    # maturity_progress: 2/4 = 0.5
    # raw = 0.0 * 0.35 + 0.2 * 0.25 + 0.67 * 0.25 + 0.5 * 0.15 = 0 + 0.05 + 0.1675 + 0.075 = 0.29
    # earned = 0.29 * 6 = ~1.74 -> round to 2
    # health_score = min(2, ceiling=6) = 2.
    # But we just landed 5 HIGH findings — hard cap: 3+ HIGH -> max 6.
    # Effective ceiling stays 6, score 2.

    text = re.sub(r"^health_score: 0$", "health_score: 2", text, count=1, flags=re.M)
    text = re.sub(r"^health_ceiling: 0$", "health_ceiling: 6", text, count=1, flags=re.M)
    text = re.sub(
        r'^health_ceiling_reason: "[^"]*"$',
        f'health_ceiling_reason: "Baseline run completed {TODAY}. Baseline-only rigor caps ceiling at 6; raise via sweep + challenge + blind_spot. Score 2/6 driven by 5 open HIGH findings (finding_health component near 0)."',
        text, count=1, flags=re.M
    )
    # Append protocol history entry under evidence.protocol_history (which is `[]` initially).
    text = re.sub(
        r"^  protocol_history: \[\]$",
        (
            f"  protocol_history:\n"
            f"    - date: \"{TODAY}\"\n"
            f"      protocol: baseline\n"
            f"      engine: {ENGINE}\n"
            f"      run_id: \"{RUN_ID}\"\n"
            f"      findings: {num_findings}\n"
            f"      work_items: {num_promoted}\n"
            f"      result: \"4-agent roundtable; engines clean on 9 anti-patterns; 5 HIGH findings around credible-interval UI propagation, MC trial counts, theory-doc freshness, and 2 specific style+stat double-counts\"\n"
            f"      health_score: 2"
        ),
        text, count=1, flags=re.M
    )
    # Update maturity.current_gaps.
    text = re.sub(
        r'^  current_gaps: "First /pulse run domain-correctness baseline not yet executed[^"]*"$',
        f'  current_gaps: "Baseline complete {TODAY}. Next steps: close 5 HIGH findings (WS-116..120), then run sweep (raises ceiling to 7). Anti-pattern grep automation at delta cadence still missing."',
        text, count=1, flags=re.M
    )
    # health_updated_at (add if not present after health_score)
    if "health_updated_at:" not in text:
        text = re.sub(
            r"^health_score: 2$",
            f"health_score: 2\nhealth_updated_at: \"{TODAY}\"",
            text, count=1, flags=re.M
        )
    text = re.sub(r'^updated_at: "2026-05-01"$', f'updated_at: "{TODAY}"', text, count=1, flags=re.M)
    PROG_FILE.write_text(text, encoding="utf-8")


def main() -> None:
    FINDINGS_DIR.mkdir(parents=True, exist_ok=True)
    items_with_ids: list[tuple[str, dict]] = []
    for n, item in enumerate(FINDINGS, start=1):
        find_id = f"FIND-{n:03d}"
        items_with_ids.append((find_id, item))
        (FINDINGS_DIR / f"{find_id}.yaml").write_text(render_finding(find_id, item), encoding="utf-8")

    FINDINGS_INDEX.write_text(write_findings_index(items_with_ids), encoding="utf-8")

    # Promote top 5 (the 5 HIGH severity findings, which are first in the list).
    promoted = items_with_ids[:5]
    new_queue_items = []
    for n, (find_id, item) in enumerate(promoted, start=116):
        ws_id = f"WS-{n:03d}"
        (QUEUE_DIR / f"{ws_id}.yaml").write_text(
            render_work_item(ws_id, find_id, item), encoding="utf-8"
        )
        # Patch the FIND yaml to record promotion.
        find_path = FINDINGS_DIR / f"{find_id}.yaml"
        ftext = find_path.read_text(encoding="utf-8")
        ftext = ftext.replace('promoted_to: ""', f'promoted_to: "{ws_id}"')
        find_path.write_text(ftext, encoding="utf-8")
        new_queue_items.append((ws_id, item))

    append_to_queue_index(new_queue_items)
    update_program_yaml(num_findings=len(items_with_ids), num_promoted=len(promoted))

    print(f"Wrote {len(items_with_ids)} findings to {FINDINGS_DIR}")
    print(f"Auto-promoted {len(promoted)} HIGH findings to {QUEUE_DIR}: WS-116..WS-{115+len(promoted):03d}")
    print(f"Updated findings-index, queue-index, prog-domain-correctness.yaml")


if __name__ == "__main__":
    main()
