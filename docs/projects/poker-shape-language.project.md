---
id: poker-shape-language
name: Poker Shape Language — Descriptor Curriculum + Adaptive Lesson Seeding
status: active
priority: P2
created: 2026-04-23
backlog-id: SLS
---

# Project: Poker Shape Language — Descriptor Curriculum + Adaptive Lesson Seeding

## Quick Start for New Sessions

1. Read ALL files in `.claude/handoffs/` — check for file conflicts.
2. Read this file — find the current phase (marked with `<- CURRENT`).
3. Read the "Context Files" for the active phase.
4. Create/update your handoff file in `.claude/handoffs/`.
5. Execute the checklist items.
6. Update this file and handoff when done.

---

## Overview

A visual/geometric descriptor language for poker, plus an adaptive lesson system that seeds where the owner is in learning each descriptor. Two work fronts run under this charter:

1. **The descriptor language itself** — a catalog of named shapes (Silhouette, Saddle, Spire, Basin, Ridgeline, Sankey, and companions) that describe ranges, equity, EV, and flow. Each descriptor gets a classifier (shipped in-codebase), a lesson (authored docs + UI), and one or more surface embeds (HandReplay, SessionsView, PresessionDrillView, LiveAdviceBar — with explicit constraints on which descriptor shows where). Full catalog in `docs/projects/poker-shape-language/roundtable.md`.

2. **Adaptive lesson seeding** — the system infers per-descriptor skill-state from drill outcomes, recognition-latency signals, and explicit self-assessment; orders/suggests lessons accordingly; respects a hard autonomy contract (opt-in enrollment, full transparency, durable overrides, incognito drill mode, no streaks/shame/engagement-pressure). The Gate 2 blind-spot audit (2026-04-23) is **RED** until the autonomy contract is honored in the design spec.

This project is deliberately study-mode-first. Live-table surfaces render only descriptor *badges* when classifiers fire — the seeding algorithm itself is headless on live surfaces. This is a structural constraint, not a tuning choice.

**Relationship to other projects:**
- Builds on `exploit-deviation` (villain models, assumption engine — IDB v17 baseline)
- Adjacent to `line-study-slice-widening` (line audits surface where descriptor classifiers would help)
- Downstream of `presession-drill` (drill infrastructure is the host surface for shape-recognition drills)

---

## Acceptance Criteria (overall)

- All 10 top-6+advanced descriptors have (a) a lesson document, (b) a classifier module with tests, (c) at least one surface embed.
- Skill-state model persisted in IDB with full transparency screen + opt-in enrollment gate.
- Autonomy red lines honored: opt-in, transparency screen, durable overrides, incognito drill mode, no streaks/shame, flat lesson index always accessible.
- No descriptor surfaces on a live surface (LiveAdviceBar, SizingPresetsPanel) without a classifier firing — seeding algorithm is headless on live surfaces.
- IDB migration v17 → v18 shipped additively (`shapeMastery`, `shapeLessons` stores); no retrofit of existing stores.
- No regression on existing ~5400 tests.

---

## Context Files

Read these before starting any phase:

- `CLAUDE.md` — project-level rules, design-program guardrail.
- `docs/projects/poker-shape-language/roundtable.md` — theory roundtable catalog (shape descriptors).
- `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md` — Gate 2 RED audit (mandatory for any design work).
- `docs/projects/poker-shape-language/gate3-triage.md` — Gate 3 research scope.
- `docs/design/LIFECYCLE.md` — gates.
- `docs/design/ROUNDTABLES.md` — roundtable template.
- `docs/design/personas/core/chris-live-player.md` + `scholar-drills-only.md` — primary personas (both need skill-state attribute amendment).
- `docs/design/heuristics/nielsen-10.md`, `poker-live-table.md`, `mobile-landscape.md`.
- `.claude/context/SYSTEM_MODEL.md` — persistence, reducer, context patterns.
- `.claude/context/POKER_THEORY.md` — **mandatory** before editing any classifier.

---

## Streams

Six streams. Stream A (design gates) runs first and gates Streams B–E on per-descriptor basis. Stream F (lesson content) can run in parallel with Stream A once Gate 4 spec lands.

| Stream | Status | Description | Gate |
|--------|--------|-------------|------|
| A | [x] G1 [x] G2 [x] G3 [ ] G4 [ ] G5 | Design lifecycle gates 1–5 | **Gate 3 CLOSED** (decision memo + persona amendments + situational persona + JTBDs + ATLAS + Gate 2 re-run GREEN — `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding-rerun.md`). Gate 4 kickoff unblocked; 8 carry-forwards enumerated. |
| B | [ ] | Classifier modules — 10 descriptors, each with tests | Per-descriptor; waits on Gate 4 spec for that descriptor |
| C | [ ] | Lesson content — markdown docs first, React viewer later | Authoring can run parallel with Stream B once Gate 4 lands |
| D | [ ] | Skill-state model — reducer, persistence (IDB v17→v18), context, transparency screen | Gate 4 design spec |
| E | [ ] | Surface embeds — HandReplay, SessionsView, PresessionDrillView, LiveAdviceBar, SizingPresetsPanel | Per-embed after Stream B classifier for that descriptor ships |
| F | [ ] | Drill-card authoring for PresessionDrillView | Parallel with Stream C once lesson for descriptor exists |

---

## Stream A — Design lifecycle gates <- CURRENT STREAM

### Completed
- **Gate 1 (Entry)** — 2026-04-23, inline. Scope: surface addition + cross-surface journey change + new state dimension (skill_state). Output: YELLOW-leaning-RED. Gaps: `chris-live-player` silent on skill-state; JTBD atlas thin on adaptive-learning outcomes.
- **Gate 2 (Blind-Spot)** — 2026-04-23. 4-voice roundtable (Product/UX, Market, Senior Engineer, Autonomy skeptic). Output: **RED**. Artifact: `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md`.

### Gate 3 — In progress (2026-04-23)

**Completed this session:**
- Decision memo (`docs/projects/poker-shape-language/gate3-decision-memo.md`) resolving all 6 research threads (R1-R6) and 7 owner-interview questions (Q1-Q7) with verdicts + confidence + Gate-4 implications. 6 clear winners + 1 lean; skillAssessment 3-phase migration architecture specified.
- Persona amendments: `chris-live-player.md` (+ skill-state attribute + autonomy-constraint sections); `scholar-drills-only.md` (+ skill-state attribute + streak-deferral flag).
- New situational persona: `returning-after-break.md`.
- JTBDs authored: DS-52 (retention), DS-53 (edge-case probe), DS-54 (exploration override — non-negotiable), DS-55 (resumption), DS-56 (calibration check, Proposed), ON-87 (cold-start seeding/expert bypass).
- ATLAS.md updated: DS-43..56, ON-82..87, change-log entry.

**Outstanding before Gate 3 → Gate 4 handoff:**
- **Gate 2 re-run** shipped GREEN — `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding-rerun.md`. Gate 3 CLOSED.
- **Owner ratification** of the 7 decision-memo verdicts (especially Q4 — "LEAN C, medium confidence" — may deserve re-open).
- **Gate 3 triage status** — R1-R6 resolved-by-memo; triage superseded by decision memo.

### Gate 4 — Next (carry-forwards enumerated in re-run §"Gate 4 spec carry-forwards")

1. `surfaces/study-home.md` authorship (Q1 — cross-project surface artifact)
2. presession-preparer vs adaptive-seeding ordering in study-home spec
3. Transparency screen design validation (Q4 medium-confidence; declaration-vs-data must be legibly visible)
4. Copy-tone validation — red line #7 enforcement
5. Enrollment journey spec — Q2 hybrid + Q7 self-declaration-seed
6. Incognito-mode surface — Q5 mode-determined default
7. Welcome-back surface — DS-55 + returning-after-break persona
8. 8-red-line conformance checklist per surface spec

Expected 2-3 sessions.

### Then: Gate 4 (Design spec)
- Author `surfaces/shape-language-study-home.md` + `surfaces/shape-skill-map.md` + `surfaces/lesson-runner.md`.
- Author `journeys/shape-language-enrollment.md` (opt-in flow).
- Author interaction spec with autonomy red lines enumerated + tested against in-app.
- Contract doc for cross-surface skill-state reads.

### Then: Gate 5 (Implementation)
Per Stream B/C/D/E — commits reference surface-id or spec-id.

---

## Stream B — Classifier modules (per-descriptor)

Shipped per-descriptor. Order (SPI-proxy — highest pedagogical value × lowest implementation cost first):

| # | Descriptor | Priority | Notes |
|---|------------|----------|-------|
| 1 | Range Silhouette | P0 | 5-prototype alphabet classifier on weighted 13×13. Merge-tree backing. |
| 2 | Spire + Polarization Bar | P0 | Two classifiers on equity-distribution curve. |
| 3 | Sizing Curve Tag | P0 | Ridge/Plateau/Cliff/Ramp on EV-vs-bet-size. |
| 4 | Saddle | P1 | Way-ahead/way-behind detector; threshold-driven. |
| 5 | Basin + Street-Transition Sankey | P1 | Basin label on river-equity variance; Sankey is render not classifier. |
| 6 | Range Ridgeline + Narrowing Ribbon | P2 | Study-surface render. No classifier; computed views only. |
| 7 | Range Contour Tree (advanced) | P2 | Backs Silhouette classifier. Expose in study only. |
| 8 | Equity Basin Map (advanced) | P3 | Desktop-only study artifact. |
| 9 | Hand Trajectory / Homotopy (advanced) | P3 | Replay-mode comparison feature. |

---

## Stream C — Lesson content (10 lessons)

Each lesson is a markdown file at `docs/projects/poker-shape-language/lessons/NN-slug.md` with fixed structure: Definition → Your-Data Example → Recognition Drills → Where You'll See This → Prior Art.

Curriculum order (pedagogical):

1. The 13×13 Alphabet (Silhouette)
2. Reading the Hockey Stick (Equity-Distribution Curve)
3. Spires & Polarization
4. The Sizing Landscape (Horizon + Tag)
5. The Saddle Configuration
6. Runout Basins & Migration (Basin + Sankey)
7. Preflop Flow (Ridgeline + Ribbon)
8. Why the Silhouette Looks That Way (Contour Tree)
9. The Basin Map (Morse-Smale)
10. Same Line, Different Story (Homotopy)

---

## Stream D — Skill-state model

Per Senior Engineer voice (Gate 2):
- IDB v17 → v18 additive: `shapeMastery` store (compound key `[userId, descriptorId]`, schemaVersion, alpha/beta posteriors) + `shapeLessons` store.
- Three-piece state split: **mastery** / **lesson-progress** / **recommendation** — never conflated.
- Context provider hoisted at PokerTracker root; selectors per surface.
- Cold-start: all descriptors hydrate at `alpha=1, beta=1`. First recommendation is Range Silhouette unconditionally. Switch to adaptive after 3 interactions.
- Writer registry enumerable (mirrors `villainAssumptions` pattern from Exploit Deviation).
- Transparency screen reads from the same selectors that drive recommendations — no separate "debug" path.

---

## Stream E — Surface embeds

Per-descriptor × per-surface matrix specified in Gate 4. Live-surface constraint enforced:
- **LiveAdviceBar** / **SizingPresetsPanel**: render only classifier-fired descriptor badges. Headless seeding.
- **HandReplay**: full retrospective display — classifiers + mastery tooltip.
- **SessionsView**: post-session review surface — Sankey + Silhouette aggregate stats.
- **PresessionDrillView**: primary drill host (Stream F).
- **New ShapeLanguageStudyView**: lesson runner + skill map + transparency screen.

---

## Stream F — Drill-card authoring

Drill cards plug into PresessionDrillView. Per-descriptor: 2-3 recognition drills ("name this silhouette", "tag this curve", etc.). Authored only after the lesson and classifier for that descriptor ship.

---

## Phases

| Phase | Stream | Description | Accept Criteria |
|-------|--------|-------------|-----------------|
| 1 | A | Gate 1 + Gate 2 | 2026-04-23 — DONE |
| 2 | A | Gate 3 — research + persona/JTBD | Triage scope closed; 6 research items resolved; 2 personas amended; 1 situational authored; 5 JTBDs added |
| 3 | A | Gate 4 — surface + journey + spec | 3 surfaces authored; enrollment journey authored; interaction spec with red-line tests |
| 4 | D | Skill-state foundation | IDB v18 migration + reducer + context + transparency screen functional |
| 5 | B+C | First descriptor: Silhouette | Classifier shipped + lesson authored + HandReplay embed |
| 6 | B+C | Foundation descriptors (2–4) | Equity Curve, Spire/Polarization, Sizing Tag — all shipped end-to-end |
| 7 | B+C | Saddle + Basin/Sankey | Advanced classifiers + lessons + session-review integration |
| 8 | B+C | Ridgeline + Ribbon | Study-mode preflop-flow view (new surface) |
| 9 | B+C | Advanced (8–10) | Contour Tree + Basin Map + Homotopy |
| 10 | F | Drill integration | Each descriptor has ≥2 drill cards in PresessionDrillView |
| 11 | — | Closeout | All acceptance criteria met; MEMORY.md entry closed |

Phases 5–9 are partially parallelizable per-descriptor — Silhouette can ship end-to-end while Spire is mid-author.

---

## Files This Project Touches

### New artifacts
- `docs/projects/poker-shape-language/` (this directory) — roundtable, voices, gate-triage, lessons, surface artifacts
- `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md` (Gate 2)
- `docs/design/surfaces/shape-language-study-home.md` (Gate 4)
- `docs/design/surfaces/shape-skill-map.md` (Gate 4)
- `docs/design/surfaces/lesson-runner.md` (Gate 4)
- `docs/design/journeys/shape-language-enrollment.md` (Gate 4)
- `docs/design/personas/situational/returning-after-break.md` (Gate 3)

### Existing to amend
- `docs/design/personas/core/chris-live-player.md` — add skill_state attribute + autonomy-constraint paragraph (Gate 3)
- `docs/design/personas/core/scholar-drills-only.md` — add skill_state attribute (Gate 3)
- `docs/design/jtbd/domains/cross-cutting.md` or a new `adaptive-learning.md` — add DS-52..56 + ON-87 (Gate 3)

### Code (Phase 4+)
- `src/utils/shapeLanguage/` (new dir) — classifier modules, skill-state utilities
- `src/reducers/shapeSkillReducer.js` (new)
- `src/contexts/ShapeSkillContext.jsx` (new)
- `src/utils/persistence/database.js` — v17 → v18 migration
- `src/components/views/ShapeLanguageStudyView/` (new)
- Embeds threaded into: `HandReplay/`, `SessionsView/`, `PresessionDrillView/`, `LiveAdviceBar/`, `SizingPresetsPanel/`

---

## Session Log

| Date | Session | Stream | Work Done |
|------|---------|--------|-----------|
| 2026-04-23 | Claude (main) | A | Theory roundtable (6 personas) → `roundtable.md` with 10-descriptor catalog + top-6. Gate 1 inline (YELLOW-leaning-RED). Gate 2 blind-spot roundtable (4 voices) → RED verdict audit. Project charter authored. Gate 3 triage authored. Zero code changes. |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-23 | Study-mode first; live surfaces render only classifier-fired badges | UX lead's Stage C ❌ finding: live-sidebar seeding is structural mismatch with mid-hand-chris, not a tuning issue. Seeding algorithm headless on live surfaces. |
| 2026-04-23 | No `skeptical-learner` persona — autonomy is a cross-cutting constraint | Autonomy skeptic's position: the owner IS the skeptic; modeling him as a persona would create fiction. Instead amend `chris-live-player` with an autonomy-constraint paragraph. |
| 2026-04-23 | Extend personas with `skill_state_per_descriptor` attribute, no new core persona | Avoids atlas bloat; Product/UX "new core persona" proposal overlapped too heavily with Chris + Scholar. |
| 2026-04-23 | Streak-formation out of scope; no `streak-habitualist` persona | Autonomy red line #5. Building for that user creates future-user-drift; today's owner does not want it. |
| 2026-04-23 | IDB migration is additive v17 → v18 (not retrofit) | Senior engineer voice; mirrors `villainAssumptions` pattern from Exploit Deviation (2026-04-21). |
| 2026-04-23 | Cold-start hydrates all descriptors at alpha=1,beta=1; first rec is Silhouette unconditionally | Senior engineer voice; avoids placement-test dropoff (Market lens) and autonomy violation of silent assessment (Autonomy voice). |
| 2026-04-23 | Incognito drill mode is non-negotiable | Autonomy red line #4. Owner can practice without being graded. |
| 2026-04-23 | **Skill assessment is a core competency of the app** — applies to user AND villain | Owner direction. Memory: `feedback_skill_assessment_core_competency.md`. Shared `src/utils/skillAssessment/` module with 3-phase migration (A: additive user-skill; B: villain delegation; C: invariant unification). Bayesian core, credible intervals, on-read decay, signal separation are shared; domain-specific adapters differ. |
| 2026-04-23 | **3 study intents (Reference / Deliberate / Discover)** as first-class reducer state, not UI modes | `currentIntent` is a reducer field; mastery-mutation actions assert on it. Reference-mode writes = bug. Simplifies Q3/Q5/Q7 decisions. |
| 2026-04-23 | **"Don't show me again" as third override semantic** beyond "know this" and "not today" | Owner proposal. Builds a dismissed-queue the user can revisit later. Defends autonomy red line #3 (durable overrides) + fills safety-valve role when system picks miss. Distinct from mastery increment and session skip. |
| 2026-04-23 | **"Get better at poker" is cross-project theme**, not a Shape Language feature | Owner direction. Shape Language / Range Lab / Presession Drills / HRP recent-mistake flags all feed one unified Study Home surface. Decision memo Q1 verdict: Option A (cross-project surface artifact at `docs/design/surfaces/study-home.md`), not umbrella project. Authored by first consuming project's Gate 4. |
| 2026-04-23 | **Q2 opt-in: hybrid (master toggle + per-descriptor mute)** | Decision memo Q2 verdict. One-tap disambiguation at skip time: "already know" (mute) vs "not today" (session). Transparency screen exposes recalibrate-descriptor action. |
| 2026-04-23 | **Q3 retention: gentle/passive, no notifications** | Decision memo Q3 verdict. Monthly passive check-in; welcome-back fires once per gap event; decay computed on read. FSRS-aggressive disqualified by procedural-memory evidence + red line #5. Option C (none) leaves mastery-illusion failure mode unaddressed. |
| 2026-04-23 | **Q4 disagreement: user wins silently, data shown transparently** (lean, medium confidence) | Decision memo Q4 verdict. Medical-decision-aid consensus pattern. Transparency screen shows both signals in parallel, never fused. Poker-DK evidence is real counter-evidence — re-open if ambiguity emerges in practice. |
| 2026-04-23 | **Q5 incognito default: mode-determined (Reference never grades)** | Decision memo Q5 verdict. Three-intent taxonomy determines the default, not a modal flag. Chess.com rated-vs-custom precedent. |
| 2026-04-23 | **Q6 portability: always included in standard export + separate study-data-only button** | Decision memo Q6 verdict. Skill-model data IS user data. Existing Gate 2 export-writer audit (senior engineer) folds `shapeMastery` + `shapeLessons` + villainAssumptions + rangeProfiles into one pass. |
| 2026-04-23 | **Q7 cold-start: self-declaration seed, skippable, prominent-default skip** | Decision memo Q7 verdict. Expert bypass via one screen of checkboxes + prominent Skip. Checked descriptors get `alpha=8,beta=2` + `userMuteState='already-known'`. Unchecked hydrate at charter default `alpha=1,beta=1`. Placement quiz disqualified by autonomy + market-lens evidence. |

---

## Closeout Checklist

Before marking project complete:

- [ ] Gates 1–5 all closed for adaptive-seeding + each descriptor's surface embed.
- [ ] Every P0/P1 Gate 2 finding either shipped or explicitly waived.
- [ ] 10 lessons authored, 10 classifiers shipped (or explicitly deferred with reasoning).
- [ ] IDB v18 migration tested; existing-user cold-start path verified.
- [ ] Transparency screen renders skill-state + evidence + next-lesson rationale.
- [ ] Autonomy red lines verified via checklist: opt-in enrollment, durable overrides, incognito mode, no streaks/shame, flat lesson index accessible, no cross-surface contamination.
- [ ] No live-surface regressions under `mid-hand-chris` / `seat-swap-chris` situational walkthroughs.
- [ ] All tests green; no drift in existing suites.
- [ ] STATUS.md updated.
- [ ] MEMORY.md closed-summary entry.
- [ ] Handoff file marked COMPLETE.
