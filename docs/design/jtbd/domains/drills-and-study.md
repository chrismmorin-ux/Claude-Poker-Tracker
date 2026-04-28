# JTBD Domain — Drills and Study

Jobs around learning and concept mastery, typically off-table.

**Primary personas:** [Scholar](../../personas/core/scholar-drills-only.md), [Apprentice](../../personas/core/apprentice-student.md), [Rounder](../../personas/core/rounder.md) (occasional), any off-table session.

**Surfaces:** `PreflopDrillsView`, `PostflopDrillsView`.

---

## DS-43 — 10-minute quick drill on today's weak concept

> When I have 10 minutes, I want a quick drill targeted at today's weakness or concept, so study is efficient.

- Partial: Explorer + Line Study ship; routing to weakness-targeted drills is DISC-12 (skill map).

## DS-44 — Correct-answer reasoning (not just score)

> When I miss a drill, I want to see *why* the correct answer is correct, so I learn.

- Active (baseline); depth varies by drill mode.

## DS-45 — Custom drill from own hand history

> When I want to study a specific spot I actually faced, I want a drill built from my own history, so practice is relevant.

- State: **Proposed** (DISC-13).

## DS-46 — Spaced repetition for key charts

> When mastering preflop charts, I want spaced repetition on cards / scenarios I've missed, so retention is real.

- State: **Proposed**.

## DS-47 — Skill map / mastery grid

> When progressing, I want a skill grid showing concept mastery (preflop by position × postflop by texture × ICM × etc.), so I know what to practice.

- State: **Proposed** (DISC-12).

## DS-48 — Understand villain's range composition as the decision driver

> When studying a specific decision, I want to see villain's range decomposed by hand-type groups with per-group weight and my equity vs each, so my decision reasoning is range-vs-range not hand-vs-hand.

- State: **Active** (2026-04-22) — served by `bucket-ev-panel-v2` P1 primitive post-Path-2 restructure.
- Doctrine: first-principles decision modeling (`POKER_THEORY.md §7`, `feedback_first_principles_decisions.md`).
- Measures of success: student can name the largest group in villain's range on any studied decision; student's hypothesized correct action agrees with the weighted-total EV on ≥80% of drills after concept internalization.

## DS-49 — See weighted-total EV decomposition for a decision

> When studying a specific decision, I want to see the arithmetic — `Σ(villain-bucket weight × my EV vs bucket) = total EV per action` — so the correct answer is traceable, not asserted.

- State: **Active** (2026-04-22) — served by `bucket-ev-panel-v2` P2 primitive (`WeightedTotalTable`).
- Distinct from DS-44 ("correct-answer reasoning"), which is neutral on hero-first vs range-first framing; DS-49 specifically requires the arithmetic be visible as terms, not just as a final EV number.
- Measures of success: student can identify which villain group contributes the largest EV term for the correct action; student can explain why the same hand action shifts EV between archetypes when shown the table.

## DS-50 — Walk a hand line branch-by-branch with consequences shown

> When studying a multi-street scenario, I want to walk the decision tree node-by-node and see every branch's rationale, so I learn the whole-hand pattern, not just isolated spots.

- State: **Active** — served by Line Study (`LineWalkthrough` + `LineNodeRenderer` + `LineBranchBreadcrumb`), shipped 2026-04-20.
- Promoted from implicit on 2026-04-22 (previously listed only in `postflop-drills.md` as "line-study JTBD, implicit"). Atlas-explicit now.

## DS-51 — Understand villain's range shape on any flop before deciding

> When studying a board texture, I want the full breakdown of villain's range vs the flop (made hands / draws / whiff), so I internalize the range shape, not just individual hand equities.

- State: **Active** — served by Explorer mode (`RangeFlopBreakdown` + `ContextPicker` + `BoardPicker`) + Line Study's per-node decomposition.
- Promoted from implicit on 2026-04-22 (previously listed only in `postflop-drills.md` as "range-shape recognition, implicit"). Atlas-explicit now.
- Distinct from DS-48: DS-51 is hero-range-agnostic ("what does villain's range look like here?"); DS-48 is hero-anchored ("given my hand, what does villain have that I need to beat?").

## DS-52 — Retention maintenance (don't let mastery decay silently)

> When I have declared or demonstrated mastery on a descriptor / concept, I want the system to gently surface retention opportunities as decay accumulates, so I don't develop false confidence in skills that have rusted.

- State: **Active** (pending Poker Shape Language Gate 4).
- **Autonomy constraint:** no push notifications, no streaks, no shame. Retention surfacing is a passive in-app affordance — "last validated N weeks ago" with a recalibrate action — triggered on read, never on timer.
- **Decay profile:** procedural-memory literature supports a gentler decay curve than FSRS defaults (pattern-recognition skills decay closer to bike-riding than to vocabulary). Monthly check-in is the baseline, not 7/21/60-day FSRS spacing.
- **Served by:** proposed decay-aware transparency screen + welcome-back surface (returning-after-break situational persona).
- Doctrine basis: `feedback_skill_assessment_core_competency.md` (memory); `docs/projects/poker-shape-language/gate3-decision-memo.md` §Q3.
- Distinct from DS-46 (spaced repetition for charts, Proposed): DS-46 is declarative-memory-targeted (preflop chart memorization); DS-52 is procedural-memory-targeted (pattern recognition / concept application) and applies across all adaptive-learning surfaces.

## DS-53 — Edge-case probe (defend against mastery illusion)

> When I reach stable fluency on the median case of a concept, I want the system to occasionally surface unusual / edge cases, so I don't develop false mastery from only practicing the obvious.

- State: **Active** (pending Poker Shape Language Gate 4).
- **Autonomy constraint:** edge-case probes are offered, not forced. User can dismiss any probe; dismissal is a legitimate signal, not evasion to be re-inferred against.
- **Mechanism:** the seeder weights "corner cases of a mastered descriptor" higher in Discover-mode rotation once a descriptor reaches Reliable or Mastered.
- **Served by:** Discover-mode recommender (proposed in Stream D of Poker Shape Language).
- Anti-pattern defended: filter-bubble / mastery-illusion from over-personalization. Documented failure mode in BKT + adaptive-learning literature; see `docs/projects/poker-shape-language/gate2-voices/02-market-lens.md`.

## DS-54 — Exploration override (choose a different concept without losing progress)

> When the system recommends a concept I don't want to study right now, I want to explicitly pick a different one — without being treated as "avoiding weakness."

- State: **Active** (pending Poker Shape Language Gate 4) — **non-negotiable** per Gate 2 autonomy red line #3.
- **Mechanism:** every Discover-mode recommendation carries a "pick something else" affordance. User's picked alternative is a first-class signal equal in standing to accepting the recommendation; the "dismissed" concept is NOT re-scored as "avoided."
- **Disambiguation at skip time:** one-tap resolves "already know" (mute flag, suppresses future recs) vs "not today" (session-scoped, no write). Matches Q2 hybrid enrollment pattern.
- **Served by:** Discover-mode surface + the "don't show me again" queue (owner's proposal 2026-04-23, accepted).
- Structural defense of autonomy: without DS-54, adaptive seeding is paternalistic by construction.

## DS-55 — Resumption after break (reassess, don't resume)

> When I return to the app after ≥28 days away, I want a one-time welcome surface that acknowledges likely decay on descriptors I haven't touched and offers fast recalibration — without resetting my progress or shaming the gap.

- State: **Active** (pending Poker Shape Language Gate 4).
- **Autonomy constraint:** welcome-back surface is one-time per gap event, dismissable, equal visual weight on "recalibrate" and "skip." No notifications ever.
- **Mechanism:** on first Deliberate / Discover entry after `now - lastValidatedAt >= 28 days` on any descriptor, surface fires. Dismissal is session-durable + persists past session for the same gap event.
- **Served by:** welcome-back surface + decay-aware transparency screen.
- **Persona:** [returning-after-break](../../personas/situational/returning-after-break.md) (situational).

## DS-56 — Calibration check (blind probe after self-reported fluency)

> When I have declared "I know this" on a concept, I want the option (not obligation) to run a blind probe later that checks whether my self-assessment matches current performance, so I can catch Dunning-Kruger gaps in my own self-model.

- State: **Proposed** — partially subsumed by DS-53 (edge-case probe) at the seeder level; listed separately because the **user-facing framing** differs ("check my self-assessment" is a distinct JTBD from "show me unusual cases"). Revisit after Gate 4 research on whether these deserve distinct surfaces or collapse into one probe mechanism.
- **Autonomy constraint:** user-initiated only. The system does NOT autonomously run calibration probes as a gotcha; the probe is offered in the transparency screen as an explicit affordance.
- **Decision memo note:** DS-56 was flagged in Q4 analysis as optional — the transparency screen showing user-declaration and drill-data independently (Q4 verdict) already exposes self-calibration misalignment. DS-56 is the user's escape hatch when they want to stress-test their own claim.

## DS-57 — Capture-the-insight (flag a pattern without losing focus)

> When I notice a pattern at the table or during review — a villain tell, a recurring spot, a deviation I want to remember — I want to flag it in one tap and return to what I was doing, so the insight isn't lost before I can revisit it off-table.

- State: **Active** (pending Exploit Anchor Library Gate 4).
- **Autonomy constraint:** capture is note-taking, never self-evaluation. Button copy is "Tag pattern" / "Note this hand" — never "How did this hand go?" or "Rate your play." Private-by-default; captured observations contribute to the calibration loop only if the user has opted into enrollment (Q1 verdict: global toggle). Per-observation incognito toggle is always available (autonomy red line #9).
- **Mechanism:** Tier 0 `anchorObservation` record. HandReplayView gains Section G in `ReviewPanel.jsx` with a one-tap "Tag this hand" affordance; modal supports fixed-enum tags (hybrid vocabulary per schema §AnchorObservation) + optional free-text + optional street/action anchor. Modal auto-dismisses on game-state change with draft preserved to IDB (`between-hands-chris` ≤10s budget constraint). `post-session-chris` is the generous-budget capture host.
- **Served by:** HandReplayView Tier 0 capture (Stream D) + `anchorObservations` IDB store (v18) + `mid-hand-chris` explicit exclusion (no capture affordance on live surfaces — capture lives in review / between-hands contexts only).
- **Standalone value:** even if no observation ever promotes to a candidate anchor (Phase 2 Tier 1), capture closes the notebook-app / memory-loss failure mode. The capture affordance is the highest-priority single JTBD for Exploit Anchor Library.
- Distinct from **DS-44** (correct-answer reasoning): DS-44 is system-generated post-drill feedback; DS-57 is user-originated observation of a pattern the system did not surface. Distinct from **HE-17** (flag hand for post-session review mid-recording): HE-17 is hand-level ("come back to this"); DS-57 is observation-level ("this specific pattern in this hand").
- Doctrine basis: `feedback_skill_assessment_core_competency.md`; `docs/projects/exploit-anchor-library/gate3-owner-interview.md` Q1 (global enrollment) + Q2 (opt-out incognito default); Gate 2 audit §Stage E red line #9.

## DS-58 — Validate-confidence-matches-experience (observed-vs-predicted transparency)

> When the system tells me "villain X overfolds to river overbets on scare-complete boards," I want to see whether my actual observations confirm or contradict that predicted rate — so I can trust the advice (or withdraw trust) on evidence, not authority.

- State: **Active** (pending Exploit Anchor Library Gate 4).
- **Autonomy constraint:** framing is **model-accuracy**, never **observation-accuracy**. The dashboard evaluates the system's prediction against observed data; it does NOT evaluate the user's observations against the system's prediction. Copy discipline: "Model's predicted rate" ✓ / "Your observation accuracy" ✗. Transparency screen is always accessible (red line #2); Q3 verdict selected **long-press activation** over default-visible to reduce cognitive density on the Library view while keeping the data one tap away.
- **Mechanism:** per-anchor Calibration Dashboard view shows observed rate / predicted rate (`referenceRate`) / credible interval / evidence list / sparkline of firings over time / trend arrow / retirement state. Global view shows library health — which anchors drifting, which primitives at risk. No scalar "calibration score" (anti-pattern refused per Gate 2 Stage E).
- **Served by:** `CalibrationDashboardView` (Stream D) + Tier 2 `anchorCalibrationMetrics` per-anchor × per-style × per-street + perception-primitive validity posterior (Stream E).
- **Served persona:** `post-session-chris` primary; `presession-preparer` gets a filter view **without drift/trend data** (Gate 2 Stage C decision — drift visibility pre-session introduces decision-hesitation).
- Distinct from **DS-49** (weighted-total EV decomposition): DS-49 is pre-decision arithmetic traceability (per-bucket EV terms); DS-58 is post-hoc population-level model audit (does the anchor's claim hold?). Distinct from **MH-12** (live-cited assumption trust bridge): MH-12 is in-moment "why should I trust this claim?"; DS-58 is cumulative "does this claim still hold over many firings?"
- Doctrine basis: `docs/projects/exploit-deviation/calibration.md` (inherited two-tier framework); Gate 2 audit §Stage E graded-work-trap concern.

## DS-59 — Retire-advice-that-stopped-working (lifecycle override)

> When an exploit's edge has closed — observed rate has converged to the GTO baseline — I want the system to proactively flag the anchor for retirement; and when I've decided I no longer trust or want to use an exploit, I want to retire it durably, without the system second-guessing my decision.

- State: **Active** (pending Exploit Anchor Library Gate 4).
- **Autonomy constraint:** retirement is **durable** — no algorithmic rebuttal, no "retired anchors you might reconsider" nudges (anti-pattern refused). Three-way override vocabulary: **retire** (archive with status `retired`), **suppress** (hide from live surface but keep in library), **reset** (drop accumulated observations and restart Tier 2 calibration from priors). User can always reverse any of these from the Anchor Library flat-access view (red line #6). Retirement state-change takes effect at session-close by default, with "retire now" option — **no mid-session surprise state transitions** (Nielsen H-N05 error prevention).
- **Mechanism (system-initiated):** Tier 3 auto-retirement. Retirement condition: observed-rate credible interval overlaps GTO baseline (`retirementCondition.method: ci-overlap`). Status transitions `active → expiring → retired`. Override-aware: if user set durable override before auto-retirement fires, auto-transition respects the override.
- **Mechanism (user-initiated):** per-anchor action on Calibration Dashboard OR Anchor Library card. Retire action is explicit (two-tap with confirmation), undo via durable entry in retirement journey log.
- **Served by:** retirement evaluator (Stream E, runs per session-close) + Calibration Dashboard override surface (Stream D) + `journeys/anchor-retirement.md` (Gate 4).
- Distinct from **DS-54** (exploration override): DS-54 is in-the-moment "pick a different concept to study right now"; DS-59 is lifecycle-level "this advice has stopped working, retire it from the active library." Distinct from **MH-13** (dismiss/downrank a live-cited assumption silent override): MH-13 is single-cite-in-one-hand override; DS-59 is anchor-level persistent retirement.
- Doctrine basis: `docs/projects/exploit-anchor-library/schema-delta.md` §retirementCondition; Gate 2 audit §Stage E red line #3 (durable overrides) + #5 (no re-authoring nudges).

## DS-60 — Carry-the-reference-offline (physical laminated study artifact)

> When I'm at a live-poker venue in an off-hand window — stepped away from the table, waiting for a seat, on a tournament break, or otherwise not in an active hand — I want a physical laminated artifact carrying the highest-leverage decision scaffolds, so I can reinforce preparation and review without reaching for the phone and without violating house rules.

- State: **Active** (pending Printable Refresher Gate 4).
- **Primary situation:** [stepped-away-from-hand](../../personas/situational/stepped-away-from-hand.md) — four canonical contexts: stepped-away between hands, seat-waiting queue, tournament scheduled break, pre-session at venue.
- **Primary personas:** [Chris](../../personas/core/chris-live-player.md), [Rounder](../../personas/core/rounder.md), [Circuit Grinder](../../personas/core/circuit-grinder.md) (tournament breaks), [Hybrid Semi-Pro](../../personas/core/hybrid-semi-pro.md). Secondary: [Apprentice](../../personas/core/apprentice-student.md) (coach-curated pack), [Scholar](../../personas/core/scholar-drills-only.md) (study-from-home variant).
- **Autonomy constraint:** **Reference-mode** only (three-intent taxonomy per Shape Language Gate 3). Reading a card — paper OR in-app — does NOT mutate skill-state, does NOT feed Discover-mode recommender, does NOT flow to live-advice state (red lines #8, #11, #16 — see `docs/design/audits/2026-04-24-blindspot-printable-refresher.md`). No push notifications, no card-of-the-day, no auto-personalized pack default.
- **Casino-policy grounding:** owner self-report 2026-04-24 — primary venues (Wind Creek, Homewood, Horseshoe Hammond, Rivers Des Plaines) prohibit reference material that interrupts a hand. Paper is permitted in off-hand windows only. Design excludes mid-hand glance as a driving use case.
- **Mechanism:** Printable Refresher surface generates print-optimized laminated cards (index-card / pocket-card / full-page variants). Content derives from `pokerCore/` utils + POKER_THEORY.md sections + population-baseline data. **Per-villain calibration data is blacklisted from printable output** (source-util whitelist at content-drift CI).
- **Served by:** `PrintableRefresherView` (Phase 5) + `src/utils/printableRefresher/` + print CSS + lineage pipeline (PRF-NEW-2) + staleness-diff pipeline (PRF-NEW-3).
- **Distinct from:**
  - **DS-46** (spaced repetition for charts) — DS-46 is declarative-memory drill; DS-60 is reference-mode lookup. Complementary, not overlapping.
  - **DS-47** (skill map / mastery grid) — DS-47 is mastery-visibility; DS-60 is content-delivery. Distinct.
  - **SE-01** (tonight's watchlist) — SE-01 is villain-specific preparation; DS-60 is generic-principles reference. Some synergy in pre-session-at-venue context; separately authored.
- Doctrine basis: `docs/projects/printable-refresher.project.md` §Working principles (1: high-accuracy-or-nothing; 2: anti-labels-as-inputs; 3: situation-qualified; 5: print-first, view-second); Gate 2 audit §Stage B (Voice 2 refinement — primary situation rewritten per casino-policy evidence); Gate 3 Q3 owner interview 2026-04-24.

## DS-61 — Export-the-personal-codex (owner-authored content into printable form)

> When I've built up a private library of exploit anchors, decision rules, or corrections from my own play, I want to print them as a personal codex alongside the generic reference, so the printed artifact reflects MY game, not just GTO baseline.

- State: **Active** (pending Printable Refresher Phase 2+ — Phase 1 is engine-derived content only).
- **Primary persona:** [Chris](../../personas/core/chris-live-player.md). Secondary: [Rounder](../../personas/core/rounder.md) who builds up personal reads.
- **Autonomy constraint:** **opt-in only.** Default OFF. Phase 1 printable corpus is engine-derived + theoretical; personal-codex export is an explicit owner gesture ("include my EAL anchors in this print batch"). Rationale: red line #16 (no cross-surface contamination) + Reference-mode purity (personalization crosses into Deliberate-mode territory; default-off preserves intent separation). Anti-pattern AP-PRF-9 refuses auto-personalized print packs.
- **Content sources:**
  - User-owned EAL anchors (`exploitAnchors` store, status: active OR expiring — retired anchors excluded unless explicitly re-included).
  - SR-32-nominated corpus entries (if implemented).
  - Owner-ratified population-baseline deviations (POKER_THEORY §9 entries the owner has ratified against their personal play data).
  - Owner free-text notes from `userRefresherConfig.customNotes` (280-char cap, inherited from EAL observation-capture ergonomics).
- **Mechanism:** "Include personal codex" checkbox in Print Controls (Phase 2+). When checked, export pipeline reads user-owned content + injects into print batch with distinct visual styling (e.g., owner-badge on card header, different accent hue from population-baseline cards). Lineage footer distinguishes `source: owner-codex` from `source: pokerCore/...`.
- **Incognito support:** owner can mark any codex entry as `incognito: true` in in-app view, preventing it from ever entering any print batch (inherits EAL red line #9 incognito observation mode to print context).
- **Served by:** `PrintableRefresherView` Phase 2+ + `exploitAnchors` store integration + personal-codex filter logic in print export.
- **Distinct from:**
  - **DS-57** (capture-the-insight) — DS-57 is user-originated observation flagging; DS-61 is export of those observations plus other owner-ratified content into printable form. DS-61 is the export companion to DS-57.
  - **DS-60** (carry-reference-offline) — DS-60 is the physical-reference-artifact JTBD; DS-61 is a specific *content source* option within that artifact. DS-61 does not exist without DS-60.
  - **DE-72** (raw JSON/CSV export) — DE-72 is data-portability; DS-61 is print-artifact personalization. Distinct purposes.
- Doctrine basis: `docs/projects/printable-refresher.project.md` §Risks (risk #7 skill-state contamination + personalization default OFF); Gate 2 audit Stage B Voice 2 §Missing JTBDs PRF-NEW-5; Gate 3 Q7 owner interview (pending ratification — recommendation Phase 2+ opt-in, default OFF).

---

## Domain-wide constraints

- Drill time-pressure should be off by default — this isn't mid-hand.
- Explanatory content should be surface-level by default with drill-deeper paths (Scholar > Apprentice depth curve).
- **Adaptive-learning constraints (2026-04-23):** all DS-52..56 operate under the 8 autonomy red lines (see `docs/design/personas/core/chris-live-player.md` §"Autonomy constraint"). Skill-state mutation rules follow `feedback_skill_assessment_core_competency.md` + `docs/projects/poker-shape-language/gate3-decision-memo.md`: Reference-mode does not write; Deliberate / Discover do; user declaration and behavioral observation are distinct signals, never fused arithmetically.
- **Exploit Anchor Library constraints (2026-04-24):** DS-57 / DS-58 / DS-59 operate under the **9 autonomy red lines** (8 inherited + 1 new: incognito observation mode — see `docs/projects/exploit-anchor-library.project.md` §Acceptance Criteria + `anti-patterns.md`). Additional anchor-specific rules: (a) capture framing is note-taking never self-evaluation; (b) Calibration Dashboard copy is model-accuracy never observation-accuracy; (c) retirement is durable with no re-authoring nudges; (d) anchor badge on live surfaces shows `archetypeName + confidence dial` only — no calibration state (cross-surface contamination red line).

## Change log

- 2026-04-21 — Created Session 1b.
- 2026-04-22 — Added DS-48 / DS-49 / DS-50 / DS-51 (LSW-J1). DS-48 + DS-49 open new first-principles-teaching outcomes served by `bucket-ev-panel-v2`. DS-50 + DS-51 promote outcomes previously marked "implicit" in `surfaces/postflop-drills.md` to explicit atlas entries.
- 2026-04-23 — Added DS-52 (retention), DS-53 (edge-case probe), DS-54 (exploration override — non-negotiable), DS-55 (resumption after break), DS-56 (calibration check, Proposed). Output of Gate 3 for Poker Shape Language adaptive-seeding project. See `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md` (Gate 2) + `docs/projects/poker-shape-language/gate3-decision-memo.md` (Gate 3 decision memo).
- 2026-04-24 — Added DS-57 (capture-the-insight), DS-58 (validate-confidence-matches-experience), DS-59 (retire-advice-that-stopped-working). Output of Gate 3 for Exploit Anchor Library project. DS-57 is the highest-priority single JTBD for the project (standalone-valuable even if Tier 1 candidate promotion never ships). See `docs/design/audits/2026-04-24-blindspot-exploit-anchor-library.md` (Gate 2) + `docs/projects/exploit-anchor-library/gate3-owner-interview.md` (Q&A log).
