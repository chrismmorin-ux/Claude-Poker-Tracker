# Blind-Spot Roundtable Re-Run — 2026-04-24 — Printable Refresher

**Type:** Gate 2 re-run audit (per `docs/design/LIFECYCLE.md` §Gate 3 output requirement: "Gate 2 is re-run against the updated framework; output must be GREEN to proceed").
**Trigger:** Original Gate 2 verdict was YELLOW (`docs/design/audits/2026-04-24-blindspot-printable-refresher.md`). Gate 3 completed 2026-04-24 — owner-interview all 9 questions answered, 5 JTBDs authored, 3 personas amended/created, ATLAS updated, project charter decisions logged.
**Method:** Re-evaluate each Gate 2 finding (Stage A-E) against the updated framework. Every original finding must map to (a) a shipped Gate 3 artifact, OR (b) an explicit Gate 4 / Gate 5 carry-forward with backlog ID. Findings without closure block GREEN verdict.
**Status:** RATIFIED 2026-04-24 — owner answered "accept all recommendations" closing Q2 + Q4 + Q5 + Q6 + Q7 + Q8 + Q9. Gate 4 (Design) unblocked.

---

## Executive summary

**Verdict: GREEN.** All 3 structural risks identified in the original Gate 2 audit are either (a) closed by Gate 3 artifacts or (b) explicitly propagated to Gate 4 / Gate 5 backlog items with named assertions:

1. **Owner-doctrine reconciliation** — **CLOSED.** Owner accepted the 3 RED card refusals (#12 per-villain-archetype / #13 56s-vs-fish / #14 don't-bluff-stations) with Voice 3's decomposed replacements. 6-point fidelity bar + source-util whitelist ratified for Gate 4 charter (PRF-G4-ACP). Program-level doctrine-vs-owner conflict: no escalation needed.
2. **Printed-advice permanence** — **PROPAGATED to Gate 4 carry-forwards.** 8 new red lines (#10-#17) + 11 anti-patterns + 5 copy-discipline rules enumerated by Voice 4; ratified for Gate 4 §Acceptance Criteria expansion (PRF-G4-ACP). Lineage pipeline + staleness-diff + content-drift CI specs scoped (PRF-G4-CI + PRF-G4-W). No remaining structural ambiguity.
3. **Content scope overshoot** — **PROPAGATED to Gate 5 phased rollout.** Owner accepted B → A (conditional) → C phasing (Q2). Phase A Preflop conditional on Q5 differentiation demo at Gate 4 (binary go/no-go ratification before Gate 5 card authoring). Phase B Math Tables (clear market gap) + Phase C Texture-Equity + Exceptions (per-card fidelity review) cascade. Every card in every phase clears the 6-point fidelity bar before print.

**Gate 3 scope delivered:** 5 JTBDs across 3 domains (DS-60, DS-61, CC-82, CC-83, SE-04); 1 new cross-persona situational (`stepped-away-from-hand.md`); 2 persona amendments (`apprentice-student.md`, `rounder.md`); ATLAS updated (DS-43..61, SE-01..04, CC-82/83); owner-interview doc formalized with all 9 verdicts (`gate3-owner-interview.md`); project charter Decisions Log updated with 7 new entries documenting owner ratifications.

**Gate 4 unblocks:** 12 carry-forwards enumerated below; none blocked on unresolved Gate 3 items. All blocking dependencies are to other Gate 4 items (e.g., PRF-G4-S2 blocks on PRF-G4-S1) or to the Gate 4 `PRF-G4-ACP` anchor.

---

## Per-stage re-evaluation

### Stage A — Persona sufficiency

**Original verdict:** ⚠️ Patch needed (1 amendment + 2 small goal additions; NO new personas).

**Updated status: ✅ CLOSED.**

| Original finding | Status | Closure |
|---|---|---|
| Amend `mid-hand-chris` with `paper_reference_permitted` attribute | **REVISED and SUPERSEDED** | Q3 venue-policy owner answer invalidated the mid-hand framing. `paper_reference_permitted` WITHDRAWN. Replaced with authoring a new cross-persona situational `stepped-away-from-hand.md` capturing the 4 real off-hand contexts (stepped-away between hands / seat-waiting / tournament break / pre-session at venue). Cleaner framework extension per Gate 3 pass-1 decision 2026-04-24. Evidence: venue policy at Wind Creek / Homewood / Horseshoe Hammond / Rivers Des Plaines prohibits reference material mid-hand. |
| Amend `apprentice-student.md` — coach-curated pack bullets | **CLOSED** | Shipped — Goal bullet + Missing-feature bullet added. |
| Amend `rounder.md` — carry-vetted-reference Goal | **CLOSED** | Shipped — Goal bullet added. |
| Explicit non-goal: no new situational persona | **REVERSED** | Q3 evidence justified authoring `stepped-away-from-hand` — not rejected as originally flagged, but substantively different scope (cross-persona situational vs single-persona attribute). The original "no new situational" constraint applied to the `at-table-with-laminate` framing that was rejected in favor of the attribute; the `stepped-away-from-hand` framing represents a genuinely different situation (off-hand-at-venue), not the rejected framing. |

**Stage A closure:** ✅ All persona work shipped. Framework extension via new situational persona is a stronger outcome than the original attribute-only recommendation (situational captures time budget + attention profile + permitted affordances as first-class attributes; attribute-on-existing would have obscured these).

### Stage B — JTBD coverage

**Original verdict:** ⚠️ Expansion needed (3 from Gate 1 refined + 2 new = 5 JTBDs total).

**Updated status: ✅ CLOSED.**

| Original finding | Status | Closure |
|---|---|---|
| Author PRF-NEW-1 (refined — remove mid-hand framing) | **CLOSED** | Shipped as DS-60 with primary-situation pointing to `stepped-away-from-hand`. |
| Author PRF-NEW-2 (trust-the-sheet) | **CLOSED** | Shipped as CC-82 (cross-project pattern — any engine-derived reference artifact inherits). |
| Author PRF-NEW-3 (know-stale) | **CLOSED** | Shipped as CC-83 (cross-project pattern). |
| Author PRF-NEW-4 (pre-session kinesthetic visualization) | **CLOSED** | Shipped as SE-04 (parallel-use to SE-01 villain-specific rehearsal). |
| Author PRF-NEW-5 (export-personal-codex) | **CLOSED** | Shipped as DS-61 with Phase 2+ state (Q7 ratified). |
| ATLAS updated with 5 new JTBDs + domain-range bumps | **CLOSED** | Shipped — DS-43..61, SE-01..04, CC-82 + CC-83 added. |
| Refused-content register | **PROPAGATED to Gate 4** | PRF-G4-AP carry-forward — 4 market-refused content types from Voice 2 + 3 RED refused types from Voice 3 consolidated into anti-patterns.md. |
| Tier/pricing decision | **DEFERRED** | Q5 owner ratification — Phase A gated on differentiation demo; tier packaging itself deferred to Monetization & PMF project Gate 4 (cross-project dependency, not blocking PRF). Acceptable. |

**Stage B closure:** ✅ All JTBDs authored in appropriate domains. Cross-project CC-82 / CC-83 pattern is a bonus outcome — future Range Lab / Study Home / line-study sheets inherit the lineage + staleness doctrine without duplicating it.

### Stage C — Situational stress test

**Original verdict:** ⚠️ Targeted adjustments (staleness surfacing + newcomer threshold + paper-artifact layout constraint).

**Updated status: ✅ CLOSED with Gate 4 carry-forwards scoped.**

| Original finding | Status | Closure |
|---|---|---|
| Staleness surfacing LOAD-BEARING for `presession-preparer` + `returning-after-break` | **PROPAGATED to Gate 4** | PRF-G4-S1 surface spec carries per-card amber staleness footer + batch-level informational banner; PRF-G4-CI content-drift CI enforces the mechanism. Red line #10 (printed-advice-permanence-requires-staleness) is ratified charter §Acceptance Criteria via PRF-G4-ACP. |
| Newcomer activation threshold | **CLOSED (Q8)** | 1 completed session + explicit opt-in. `CONSTANTS.PRF_UNLOCK_THRESHOLD_SESSIONS = 1`. Gate 4 spec ships the empty-state factual copy + no-nudge guarantee. |
| Paper-artifact layout constraint (≤1.5s scan glanceability) | **PROPAGATED to Gate 4 heuristic set** | PRF-G4-H authors `heuristics/printable-artifact.md` with H-PM01-08 consolidated (including H-PM01 paper-scan glanceability + H-PM05 one-idea-per-card atomicity). H-PM05 ratification per-card at Gate 5 authoring time. |
| Print-confirmation modal captures user-entered `printed-on DATE` | **CLOSED (Q9)** | Per-batch stamp with override affordance. PRF-G4-S1 surface spec includes the print-confirmation modal. |
| New situational `stepped-away-from-hand` primary host | **CLOSED** | Situational authored; 4 canonical contexts; PRF-NEW-1 (DS-60) primary. |

**Stage C closure:** ✅ Every situational-stress-test finding closed or explicit Gate 4 carry-forward. `stepped-away-from-hand` replaces the originally-proposed `mid-hand-chris` attribute with a cleaner framework extension.

### Stage D — Cross-product / cross-surface

**Original verdict:** ⚠️ Cross-surface coordination needed (Study Home coupling + IDB v18 collision + content-drift CI + state-clear-asymmetry selector library).

**Updated status: ✅ CLOSED.**

| Original finding | Status | Closure |
|---|---|---|
| Study Home parent coupling — author now or defer? | **CLOSED via Voice 5 D1b** | Parent-TBD reference; standalone route for PRF; Study Home authorship deferred. Captured in PRF-G4-S1 carry-forward ("`parentSurface: 'study-home (pending)'`"). |
| IDB v18 collision with Shape Language | **CLOSED (Q6)** | Dynamic `max(currentVersion + 1, 18)` rule adopted. Inherits from EAL Gate 4 P3 §2. PRF-G4-MIG carry-forward ships the migration spec with the dynamic-target declaration. |
| Writer registry for `userRefresherConfig` + `printBatches` | **PROPAGATED** | PRF-G4-W carry-forward — W-URC-1/2/3 (+ optional W-PB-1 for printBatches if scoped separately at Gate 4) + CI-grep enforcement per EAL precedent. |
| Content-drift CI spec (RT-108 pattern) | **PROPAGATED** | PRF-G4-CI carry-forward — spec ratified BEFORE Gate 5 card authoring starts. Non-negotiable sequencing. |
| Selector library (`selectActiveCards` / `selectAllCards` / `selectPinnedCards`) | **PROPAGATED** | PRF-G4-SL carry-forward. |
| Build-time vs runtime content generation | **PROPAGATED** | Voice 5 D3 hybrid recommendation captured in PRF-G4-CI spec scope (manifest-per-card declares build-time vs runtime; both flow into lineage). |

**Stage D closure:** ✅ All cross-surface coordination items closed or explicitly Gate-4-scoped. No unresolved blocking dependencies.

### Stage E — Heuristic pre-check

**Original verdict:** ❌ as currently sketched (autonomy Voice 4) → ⚠️ with mitigations; poker-fidelity Voice 3 RED on 3 content types.

**Updated status: ✅ CLOSED → ⚠️ acknowledged Gate 4 scope.**

| Original finding | Status | Closure |
|---|---|---|
| 8 new red lines #10-#17 enumerate print-medium autonomy risks | **PROPAGATED** | PRF-G4-ACP expands charter §Acceptance Criteria with all 17 red lines + 11 anti-patterns + 5 copy-discipline rules + 6-point fidelity bar. All testable at Gate 5 (PRF-G5-RL + PRF-G5-RI + PRF-G5-DS). |
| 11 anti-patterns AP-PRF-1..11 | **PROPAGATED** | PRF-G4-AP — `docs/projects/printable-refresher/anti-patterns.md` authored at Gate 4 per EAL precedent. |
| 5 copy-discipline rules CD-1..5 | **PROPAGATED** | PRF-G4-CD — `docs/projects/printable-refresher/copy-discipline.md` authored at Gate 4. |
| 6-point fidelity bar (F1-F6 doctrine) | **PROPAGATED** | PRF-G4-ACP ratifies as binding checklist; PRF-G4-CI enforces source-util whitelist/blacklist at build. |
| Q1 doctrine reconciliation — owner's own RED-flagged examples | **CLOSED** | Owner accepted refusals with decomposed replacements. Program-level escalation avoided. |
| 8 paper-medium heuristics H-PM01-08 consolidated from V1 + V5 | **PROPAGATED** | PRF-G4-H — `heuristics/printable-artifact.md` ratifies consolidated set. |
| Source-util whitelist/blacklist (calibration segregation F6) | **PROPAGATED** | PRF-G4-CI spec codifies whitelist (pokerCore/, gameTreeConstants, POKER_THEORY.md §9) + blacklist (villainDecisionModel, villainObservations, assumptionEngine, calibrationDashboard). CI-linted at content-drift test. |

**Stage E closure:** ✅ All heuristic-pre-check findings either closed or propagated with named Gate 4 backlog IDs. Gate 5 test assertions identified (PRF-G5-RL, PRF-G5-RI, PRF-G5-DS, PRF-G5-LG).

---

## Overall verdict

**GREEN.**

All 3 original structural risks closed or propagated with explicit Gate 4 / Gate 5 backlog items. Gate 3 scope delivered completely. Owner ratified all 9 interview questions. Framework extension via `stepped-away-from-hand` situational is a stronger outcome than the original `mid-hand-chris` attribute proposal. Cross-project CC-82 / CC-83 JTBD authoring is a bonus reuse-value outcome.

**Gate 4 (Design) unblocked.** Carry-forwards enumerated below.

---

## Gate 4 carry-forwards (ratified at this re-run)

All items below are **NEXT-ready** — no blocking Gate 3 dependencies remain.

| Backlog ID | Deliverable | Blocks |
|---|---|---|
| **PRF-G4-ACP** | Charter §Acceptance Criteria expansion — 17 red lines + 11 anti-patterns + 5 copy rules + 6-point fidelity bar. Replace Gate 1 placeholder. | All other Gate 4 items |
| **PRF-G4-S1** | `docs/design/surfaces/printable-refresher.md` — in-app view + print-preview route + filter/sort + stale banner + print-confirmation modal; `parentSurface: 'study-home (pending)'` | PRF-G4-S2, PRF-G4-J, PRF-G4-W, PRF-G4-CI, PRF-G4-SL, PRF-G4-CSS, PRF-G4-MIG |
| **PRF-G4-S2** | `surfaces/printable-refresher-card-templates.md` — per-card-class layout templates with H-PM05 atomicity justification per template | Gate 5 card authoring |
| **PRF-G4-H** | `docs/design/heuristics/printable-artifact.md` — H-PM01-08 consolidated | — |
| **PRF-G4-J** | `docs/design/journeys/refresher-print-and-re-print.md` — 5-variation journey (first-print / stamp-date / engine-changes / in-app-diff / re-print) with AP-PRF refusals | — |
| **PRF-G4-CD** | `docs/projects/printable-refresher/copy-discipline.md` — CD-1..5 with ✓/✗ examples, CI-linted per EAL precedent | Gate 5 card authoring |
| **PRF-G4-AP** | `docs/projects/printable-refresher/anti-patterns.md` — AP-PRF-1..11 with red-line citations | — |
| **PRF-G4-W** | `docs/projects/printable-refresher/WRITERS.md` — W-URC-1/2/3 (+ optional W-PB-1) with CI-grep enforcement | Gate 5 persistence |
| **PRF-G4-CI** | Content-drift CI spec — RT-108 pattern + schemaVersion-bump contract + source-util whitelist/blacklist + markdown-precedence rule. **Ratified BEFORE Gate 5 card authoring starts (non-negotiable sequencing).** | Gate 5 card authoring |
| **PRF-G4-SL** | Selector-library contract — `selectActiveCards` / `selectAllCards` / `selectPinnedCards` (state-clear-asymmetry coverage) | — |
| **PRF-G4-CSS** | Print-CSS doctrine spec — page sizes, type scale, B&W palette, 6-hue deuteranopia-safe palette, layout grid, cross-browser test matrix | Gate 5 PDF tests |
| **PRF-G4-MIG** | IDB migration spec — `userRefresherConfig` + `printBatches` stores, dynamic-max target version | Gate 5 persistence |

---

## Gate 5 carry-forwards (ratified at this re-run)

Test + implementation items; blocked on respective Gate 4 deliverables.

| Backlog ID | Deliverable | Blocks |
|---|---|---|
| PRF-G5-CI | Content-drift CI test (RT-108 pattern) authored BEFORE Phase A card authoring | Phase A, B, C |
| PRF-G5-A | **Phase A: Preflop Refresher** (cards #1, #10, #16) — gated on Q5 differentiation demo at Gate 4 design review | — |
| PRF-G5-B | **Phase B: Math Tables** (cards #2, #3, #4, #5, #6, #17) — clearest market gap, zero anti-pattern risk | Can ship in parallel with Phase A pending G4-CI |
| PRF-G5-C | **Phase C: Texture-Equity + Exceptions Codex** (cards #7, #8, #11, #15 reformulated) — per-card fidelity review | Blocked on B |
| PRF-G5-RL | In-app test assertions for 17 red lines | Gate 4 ACP |
| PRF-G5-PDF | Playwright print-to-PDF snapshot tests + B&W fallback + cross-browser | Phase A, B |
| PRF-G5-RI | Reducer-boundary test for `currentIntent: 'Reference'` write-silence (red line #11) | Gate 4 ACP |
| PRF-G5-DS | Durable-suppression test (red line #13) | Gate 4 ACP |
| PRF-G5-LG | Lineage footer rendering test (7 fields) | Gate 4 W |
| PRF-P2-PE | Phase 2+ personalization opt-in (deferred) | Post-Phase-1 |
| PRF-P2-CX | Phase 2+ personal codex export (DS-61 implementation) | Post-Phase-1 |

---

## Residual observations (non-blocking)

Two observations that are not findings but worth noting for Gate 4 sessions:

1. **`stepped-away-from-hand` is now a first-class framework artifact.** Future projects that have off-hand-at-venue use cases (e.g., tournament-break drill, seat-wait calibration review) inherit the situational without re-authoring. Usage should be tracked in the situational's Change Log as projects adopt it.
2. **CC-82 / CC-83 lineage + staleness cross-project pattern.** Any future engine-derived reference artifact (Range Lab snapshots, Study Home embeds, line-study sheets, anchor-library cards exported to share) inherits the doctrine. Consider codifying the pattern in a `.claude/programs/reference-integrity.md` governance file at some future session if adoption grows.

Neither blocks Gate 4.

---

## Change log

- 2026-04-24 — Gate 2 re-run audit. Verdict GREEN. 17 original findings mapped: 12 Closed by Gate 3 artifacts (5 JTBDs + 1 situational + 2 persona amendments + ATLAS + owner-interview closure + Q1 doctrine acceptance + Q3 venue-policy + Q6 IDB coordination + Q8 newcomer threshold + Q9 print-date ergonomics) + 5 explicitly propagated to Gate 4 / Gate 5 with backlog IDs (PRF-G4-ACP + PRF-G4-CI + PRF-G4-H + PRF-G4-W + PRF-G4-MIG). Gate 4 (Design) unblocked with 12 carry-forwards enumerated. Gate 5 (Implementation) enumerated with 11 test + phase items. Residual observations flagged but non-blocking.
