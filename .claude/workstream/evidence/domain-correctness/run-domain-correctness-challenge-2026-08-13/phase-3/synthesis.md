# Challenge 2026-08-13 — Phase 3/4 — FACILITATOR SYNTHESIS

Run: run-domain-correctness-challenge-2026-08-13 (protocol: challenge, engine: eng-engine)
Facilitator dispatched with all six phase-1 outputs + phase-2 cross-critique; performed its own
source-verification pass on every HIGH-ranked claim. Verbatim output below.

Filed from this synthesis: FIND-127..136 → WS-466..475. Amendments applied: WS-281, WS-447.
Amendments PENDING (files locked by live session ses-20260813-1429 at filing time; apply on its close):
WS-451 (capped-rake test through chained depth-3 before closure), WS-454 (take both halves of the
depthReached display fix — its deferred "FIND-075/084 items" do not exist), WS-458 (extend scope to
villainRequiredEquity fallbacks 1/3 & 0.75 + untested branches), WS-461 (add SYSTEM_MODEL §5.2
gameTreeDepth2 "Low priority" staleness to its edit list).

---

# Phase 3–4 Facilitator Synthesis
**Run:** `run-domain-correctness-challenge-2026-08-13` · protocol: CHALLENGE ("assume the engine is wrong until proven otherwise") · 6 lenses + orchestrator cross-critique · facilitator read-only

**Facilitator's own verification pass.** I re-read source for every claim I ranked HIGH or above rather than relaying it: the dual rake idiom, the seam-gate internals, `onFastResult` call sites, the `handAnalysis` formulas and rake absence, `villainRequiredEquity`'s fallbacks, `ENGINE_VERSION`'s git history, the advice payload shape, and `LiveAdviceBar`'s staleness logic. **One phase-1 claim was refuted by that pass and the cross-critique had passed it through unexamined — see Disagreement D4.** Contamination disclosure: my window contained the cross-critique's rulings before I read the lenses' raw text, so my agreement with those rulings is a weak signal; the file:line checks are the strong one.

## 1. Consensus

**C-1. Absence is systematically indistinguishable from measurement — five instances, one mechanism.** *(security KC1/KC2, failure KC5, senior KC5, systems DA-1 — four lenses, independently arrived, genuinely new as a unified class.)* Verified:
- `foldEquityCalculator.js:395,399` — missing pot geometry returns flat `1/3` (raise) or prices a `0.75` bet fraction.
- `potCalculator.js:447` — `!rakeConfig → return 0`; rakeResolver's `tier:'unknown'` and `tier:'none'` collapse to the same number.
- `gameTreeEquity.js:882,912` → `0.5`; `gameTreeDepth2.js:496,658` → EV `0` on zero weight.
- `gameTreeEvaluator.js:1428` — `depthReached` is "a stage started", not "a stage finished".
- `runtimeVersions.js` — `ENGINE_VERSION` unchanged across three algorithm-shape changes.

**C-2. The enforcement gate built this week is weaker than the guarantee its commit message states.** (senior KC1 + failure KC3.) `check-required-equity-seam.mjs:21-23`: 3-dir ROOTS, defeatable single-line regex, ALLOW annotation strings disable the check unverified, no self-test fixture.

**C-3. Cross-cutting engine concerns threaded by hand through ~10 call sites, no structural enforcement — third instance of one shape** (rakeConfig, workMeter; FIND-113 is the in-repo proof it already failed once).

**C-4. The live delivery path is unmeasured and the mechanism built to protect it is dead.** (4 lenses; partly inherited from FIND-109/DEC-036 but re-verified at HEAD.) `onFastResult`: zero production callers. New consequence: with WS-432's clock actually letting refinement run, the single awaited answer got SLOWER on slow devices — the unwired fast path is now the only mitigation and it is dead.

**C-5. The style label is dead in the engine and alive on the founder's screen.** (Corroborates WS-447.)

**C-6. Two same-day structural EV changes landed on the never-validated depth-2/3 path.** (Corroborates WS-361.)

## 2. Disagreements and forced resolutions

- **D1** depth-3 double-rake: REFUTED (rake once per terminal branch, `gameTreeDepth2.js:1441-1444`); residue = capped-config test gap + branch-truncation artifact → AMEND WS-451, MEDIUM-LOW.
- **D2** WS-450/451 YAML "drift": killed — in-flight coordination by live session ses-20260813-1429 read as corruption by a session-blind lens. Kernel (no "fix committed, closure pending" state marker) flagged for founder, no ticket.
- **D3** workMeter under-billing COMPOUNDS mobile latency (more real work fits the same unit budget → longer wall clock).
- **D4** "`isComputing` dropped by its only consumer": REFUTED in general form — `ExtensionPanel.jsx:67,308` consumes AND renders it. Survives narrowed: the live TableView has no in-flight game-tree signal (`CommandStrip.jsx:88`; `LiveAdviceBar.jsx:177` reads the equity hook's different flag; staleness `:184-187` can't fire within-street).
- **D5** WS-450's fix also landed in mandatory depth-1 (`gameTreeEvaluator.js:734-742`) — severity stands for WS-451, halves for WS-450.
- **D6** don't clone the defeatable gate — harden the class first, then generate the rake sibling (one item).
- **D7** compounded unvalidated depth-2 → corroboration of WS-361 only.

## 3. Unknowns — each with the instrument that settles it

- **U-1** wall-clock cost per evaluation on the founder's phone: name the device (3 conflicting names on record), persist `treeMetadata.latency` to IDB, n=50 postflop decisions across ≥2 sessions, p50/p90/max by street × wetness.
- **U-2** COMBO_EVAL_COST drift since 2026-08-07: re-run `calibrate-refinement-units.mjs` at HEAD, diff constants — one run.
- **U-3** is `totalWeight === 0` reachable from a real hand: replay all stored hands + corpus partition through `gameTreeContext`, count hits. Zero → make it throw; non-zero → mandatory no-read state.
- **U-4** live-vs-hindsight disagreement rate: scripted grid + replay all stored hands through both; metric = verdict flips + mean EV gap at 1/2, 1/3 rake.
- **U-5** has an illegal min-raise ever been offered: scan stored hands, recompute `heroActionBuilder.js:129` vs legal minimum.
- **U-6** cross-hand mis-stamping: retroactively unknowable (payload carries no identity — that IS the finding); forward instrument = handNumber + receipt-time mismatch counter, expected zero.
- **U-7** share of multiway fold estimates produced by the `[0.01,0.95]` clamp: counter at `gameTreeEvaluator.js:665-668` over the scored corpus, split by active-opponent count.
- **Scope gap:** every lens was pointed at the WS-436/450/451/432/431 wave. Quiet elsewhere is an artifact of scoping — rangeEngine/ narrowing, preflop path, weaknessDetector unexamined this run.

## 4. Ranked findings (dispositions as filed)

| # | Sev | Title | Filed as |
|---|-----|-------|----------|
| F-1 | HIGH | ENGINE_VERSION never bumped — retroactively unrecoverable provenance | FIND-127 / WS-466 |
| F-2 | HIGH | Hindsight coach: unraked, unseamed second implementation, invisible to the gate | FIND-128 / WS-467 |
| F-3 | HIGH | No wall-clock bound + onFastResult dead + zero device measurement (owns FIND-109, FIND-076; includes F-13 cancellation) | FIND-129 / WS-468 |
| F-4 | HIGH | Seam gate guarantee is a commit-message claim (includes F-10 dual rake idiom; hardened-class-then-sibling) | FIND-130 / WS-469 |
| F-5 | HIGH | Advice carries no hand identity; extension stamps at receipt | FIND-131 / WS-470 |
| F-7 | MEDIUM | Live TableView has no in-flight compute signal (surface parity with ExtensionPanel) | FIND-132 / WS-471 |
| F-9 | MEDIUM | Refinement clock re-calibration rule violated in-window; no gate ties calibration to hot-path changes | FIND-133 / WS-472 |
| F-11 | MEDIUM | Candidate generation can emit illegal/degenerate sizes | FIND-134 / WS-473 |
| F-12 | MEDIUM | Cross-cutting evaluation options have no contract (FIND-113 recurs by construction) | FIND-135 / WS-474 |
| S-1 | HIGH (structural) | First-class "unmeasured" value + gate forbidding plausible constants on no-read paths (removes the whole C-1 class) | FIND-136 / WS-475 |
| F-6 | M-H | villainRequiredEquity fallbacks + untested branches | AMEND WS-458 (pending, locked) |
| F-8 | MEDIUM | depthReached attempted-vs-completed at the only rendering surface | AMEND WS-454 (pending, locked) |
| F-14 | MEDIUM | Multiway clamp share unmeasured in 9-handed | AMEND WS-281 (applied) |
| F-15 | LOW-MED | Capped rake untested through chained depth-3 | AMEND WS-451 (pending, locked) |
| F-16 | LOW | SYSTEM_MODEL §5.2 stale on gameTreeDepth2 | AMEND WS-461 (pending, locked) |
| — | — | WS-447 additions: useCitedDecisions villainStyle re-entry, caveat badge, measurement in spec | AMEND WS-447 (applied) |

Corroboration only (no new items): WS-452 (rake tier unread — independently re-derived), FIND-118/WS-456, FIND-119/WS-457, WS-361, WS-402, WS-447/448, venue:'live' coincidence → WS-452.

## 6. Structural improvements (build list)

S1 unmeasured-value primitive + literal-return gate (filed WS-475, highest leverage). S2 checker toolkit (in WS-469). S3 live-vs-replay agreement harness (in WS-467). S4 live-path observability as permanent instrument (in WS-468). S5 provenance versioning as build property (in WS-466; extend to REFINEMENT_CLOCK_VERSION in WS-472 and the SOR export-shape coupling). S6 required evaluation context (WS-474).

## 7. Verdict on the challenge question

**Held up:** the most serious accusation (depth-3 double-rake) was refuted; the rake arithmetic is right twice over (two idioms agree); the hindsight formula is algebraically correct for its convention; the WS-432 reproducibility fix is real (FIND-051 re-ruling holds — `isBudgetExceeded` is the only gate, every remaining Date.now() reporting-only); villainRequiredEquity's happy path is correct, pinned, and lands in the mandatory depth-1 phase.

**Did not hold:** (1) absence looks exactly like measurement in five places — one mechanism, the run's headline, a reproducibility failure before an accuracy one; (2) the enforcement layer promises more than it delivers; (3) a correct number delivered late or attributed to the wrong hand is a wrong number, and nothing measures either; (4) the same real decision is graded two different ways by two parts of the same app.

**Limit:** scoped to the recent wave; no conclusion about the rest of the engine surface.
