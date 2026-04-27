# Handoff — Poker Shape Language · Session 1 (Theory RT + Gates 1+2 + Gate 3 decision memo + persona/JTBD authoring)

**Session:** 2026-04-23, Claude (main) — single continuous session, owner-driven
**Project:** `docs/projects/poker-shape-language.project.md`
**Phase:** Gates 1+2+3 CLOSED; Gate 4 kickoff unblocked (8 carry-forwards enumerated)
**Status:** DRAFT — pending owner ratification of 7 decision-memo verdicts before Gate 4 design work

---

## What this session produced

**22 artifacts.** All design + project-docs + memory layer; zero application code touched.

| # | Artifact | Path | Role |
|---|----------|------|------|
| 1 | Theory roundtable output | `docs/projects/poker-shape-language/roundtable.md` | NEW — 10-descriptor catalog from 6-persona RT |
| 2–7 | Theory RT voices | `voices/01..06-*.md` | NEW — Solver Cartographer, Info Designer, Topologist, Cognitive Scientist, Poker Coach, SciViz |
| 8 | Gate 2 Blind-Spot audit | `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md` | NEW — RED verdict |
| 9–12 | Gate 2 voices | `gate2-voices/01..04-*.md` | NEW — Product/UX, Market, Senior Engineer, Autonomy skeptic |
| 13 | Gate 3 triage | `gate3-triage.md` | NEW |
| 14 | **Gate 3 decision memo** | `gate3-decision-memo.md` | NEW — 7 verdicts (6 clear + 1 lean), skillAssessment 3-phase migration |
| 15 | Project charter | `docs/projects/poker-shape-language.project.md` | NEW — 11-phase plan + Decisions Log with 14 entries |
| 16 | Chris persona amendment | `docs/design/personas/core/chris-live-player.md` | UPDATED — skill-state attribute + autonomy-constraint sections |
| 17 | Scholar persona amendment | `docs/design/personas/core/scholar-drills-only.md` | UPDATED — skill-state attribute + streak-deferral flag |
| 18 | Returning-after-break situational | `docs/design/personas/situational/returning-after-break.md` | NEW — ≥28-day gap persona |
| 19 | DS-52..56 | `docs/design/jtbd/domains/drills-and-study.md` | UPDATED — 5 new JTBDs |
| 20 | ON-87 | `docs/design/jtbd/domains/onboarding.md` | UPDATED — cold-start descriptor seeding |
| 21 | JTBD atlas | `docs/design/jtbd/ATLAS.md` | UPDATED — domain index + DS + ON rows + change log |
| 22 | Memory — core competency | `memory/feedback_skill_assessment_core_competency.md` | NEW — principle + application guidance |
| + | Handoff (this file) | `.claude/handoffs/shape-language-session1.md` | UPDATED |

---

## Why this project exists

Owner asked for a visual/geometric descriptor language for poker, then for adaptive lesson seeding on top of it, "well-thought through from a design perspective." Mid-session, owner reframed: **skill assessment (user or villain) is a core competency of the app.** This changed the project's architectural center — user-skill modeling should share infrastructure with existing villain modeling, not be a one-off.

---

## Gates closed this session

### Gate 1 (Entry) — YELLOW-leaning-RED, inline
Cast lacks skill-state dimension; JTBD atlas thin on adaptive-learning. Triggered Gate 2.

### Gate 2 (Blind-Spot) — RED, 4-voice audit
Top-3 structural risks: autonomy violation via implicit modeling; live-surface contamination (must be headless); state-model + IDB v17→v18 migration. 8 autonomy red lines established as non-negotiable for Gate 4.

### Gate 3 (Research + authoring) — ~75% complete

**Decision memo** (`gate3-decision-memo.md`) resolved 7 owner-interview questions with evidence + verdict + confidence:

| # | Question | Verdict | Confidence |
|---|----------|---------|------------|
| Q1 | Unified Study Home | A — cross-project surface artifact | High |
| Q2 | Opt-in granularity | C — hybrid (master + per-descriptor mute) | High |
| Q3 | Retention aggression | B — gentle, passive, no notifications | High |
| Q4 | Self-assessment vs data | LEAN C — user wins silently, data transparent | Medium |
| Q5 | Incognito default | C — mode-determined (Reference never grades) | High |
| Q6 | Skill-model portability | A — always included + D as secondary | High |
| Q7 | Cold-start expert bypass | B — self-declaration seed, skippable | High |

Cross-cutting findings:
- **Three-intent taxonomy** (Reference / Deliberate / Discover) did most of the work — Q2/Q3/Q5/Q7 all resolved via mode-gating. Implication: `currentIntent` should be a first-class reducer field; Reference-mode mastery writes = bug.
- **Procedural memory** is load-bearing for Q3 — Shape recognition decays like bike-riding, not Spanish vocabulary. FSRS-90 defaults over-tuned.
- **Red lines eliminated options decisively** — Q3-A, Q4-B, Q7-C all fail a red line without further analysis. Design space smaller than it looked.
- **Assumption Engine patterns port directly to user-skill** — I-AE-7 signal separation, style-prior override, on-read decay all reusable.

**Architectural proposal:** `src/utils/skillAssessment/` module with 3-phase migration:
- Phase A (additive, no refactor): Shape Language Stream D imports from new module; villain code untouched.
- Phase B (villain delegation): `assumptionEngine/` delegates Bayesian core.
- Phase C (invariant unification): ESLint guard on shared module.

**Persona + JTBD authoring (shipped):**
- `chris-live-player.md` — skill-state attribute + autonomy-constraint sections (8 red lines promoted to persona-level invariants)
- `scholar-drills-only.md` — skill-state attribute; streak-gamification flagged as opt-in-only per red line #5
- `returning-after-break.md` — new situational (≥28-day gap; welcome-back surface fires once; recalibrate-or-skip equal weight; no shame / streak-loss language)
- DS-52 Retention maintenance (Active)
- DS-53 Edge-case probe (Active)
- DS-54 Exploration override (Active — NON-NEGOTIABLE per red line #3)
- DS-55 Resumption after break (Active)
- DS-56 Calibration check (Proposed — partially subsumed by DS-53)
- ON-87 Cold-start descriptor seeding (Active)
- ATLAS.md updated: DS-43..56, ON-82..87, change-log entry

**Memory updated:**
- `feedback_skill_assessment_core_competency.md` — cross-feature infrastructure principle
- `MEMORY.md` — index entry added

---

## Files I Own (this session)

Created or updated — zero application code touched.

Created:
- `docs/projects/poker-shape-language/` (full directory)
- `docs/projects/poker-shape-language.project.md`
- `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md`
- `docs/design/personas/situational/returning-after-break.md`
- `.claude/handoffs/shape-language-session1.md` (this file)
- `~/.claude/.../memory/feedback_skill_assessment_core_competency.md`

Updated:
- `docs/design/personas/core/chris-live-player.md` (add 2 sections + change log)
- `docs/design/personas/core/scholar-drills-only.md` (add skill-state section + flag streak + change log)
- `docs/design/jtbd/domains/drills-and-study.md` (add DS-52..56 + constraints + change log)
- `docs/design/jtbd/domains/onboarding.md` (add ON-87 + change log)
- `docs/design/jtbd/ATLAS.md` (domain index + DS row + ON row + change log)
- `~/.claude/.../memory/MEMORY.md` (index entry)
- `.claude/BACKLOG.md` (SLS project section)
- `.claude/STATUS.md` (new top entry for this session)

**Parallel-safe with:** LSW, exploit-deviation, HRP (PAUSED), DCOMP-W4. No file overlap.

**Coordination notes for future sessions:**
- **Q1 verdict introduces cross-project surface** `docs/design/surfaces/study-home.md` — authored by first consuming project's Gate 4 (likely Shape Language). Range Lab, Presession Drills, HRP each get "embed spec" referencing parent surface rather than duplicating layout.
- **skillAssessment module Phase B** will touch `src/utils/assumptionEngine/` — coordinate with any active exploit-deviation session before Phase B lands. Phase A is additive only; no coordination needed.
- **`currentIntent` reducer field** is a new state shape. Add to STATE_SCHEMA.md when implementing.

---

## Owner review requests

Three items.

### 1. Ratify the 7 decision-memo verdicts

6 clear winners + 1 lean. Q4 is the only one I'd flag for a second look — "user wins silently, data transparent" is medium-confidence; poker-Dunning-Kruger literature is genuine counter-evidence. If you want to re-open Q4, now is cheaper than at Gate 4. Everything else is high-confidence with defensible prior art.

### 2. Approve the skillAssessment 3-phase migration

Phase A is safe (additive only, ships with this project's Stream D, no villain code change). Phase B and C are cross-project and would be tracked separately — they happen after Phase A proves the shared API in production. Approve the direction; the when-to-start-Phase-B decision can wait.

### 3. Gate 2 re-run — DONE (GREEN)

Single-voice re-run shipped: `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding-rerun.md`. Every original ❌ verdict maps to a concrete Gate 3 artifact. GREEN at framework level; 8 Gate-4 carry-forwards enumerated as explicit spec items. Gate 3 CLOSED. Ready for Gate 4 kickoff pending owner ratification.

---

## Next Session: Gate 4 kickoff — Shape Language design spec

**Read first (Quick Start):**
1. `.claude/handoffs/` — check for conflicts.
2. This handoff.
3. `docs/projects/poker-shape-language.project.md` — active phase = Gate 4.
4. `docs/projects/poker-shape-language/gate3-decision-memo.md` — the verdicts that shape Gate 4.
5. `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md` — the red lines that constrain Gate 4.

**Expected Gate 4 outputs:**
- `docs/design/surfaces/study-home.md` — unified cross-project study home (Q1 verdict artifact). First consumer authors it; Shape Language = first consumer.
- `docs/design/surfaces/shape-language-study.md` — Shape Language-specific embed into study-home.
- `docs/design/surfaces/shape-skill-map.md` — transparency screen (Q4 verdict: show declaration + data in parallel, never fused).
- `docs/design/surfaces/lesson-runner.md` — per-descriptor lesson surface.
- `docs/design/journeys/shape-language-enrollment.md` — opt-in enrollment + expert-bypass seed flow (Q2 + Q7 verdicts).
- Interaction spec with the 8 autonomy red lines enumerated as a conformance checklist.
- Contract doc for cross-surface skill-state reads.

Expected 2-3 sessions. After Gate 4, Stream D (skill-state foundation) starts — first real code.

---

## Change log

- 2026-04-23 — Session 1 extended. Gate 3 decision memo + persona amendments + situational + JTBDs + ATLAS shipped. Ready for Gate 2 re-run + Gate 4 kickoff.
- 2026-04-23 — Session 1 final. Gate 2 re-run shipped GREEN. Gate 3 CLOSED. Gate 4 kickoff unblocked.
