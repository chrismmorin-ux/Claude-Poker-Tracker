# Surface — Lesson Card

**ID:** `lesson-card`
**Code paths:**
- `src/components/views/SelfCoachView/CurriculumSection/LessonCardItem.jsx` (Phase 5; collapsed list item)
- `src/components/views/SelfCoachView/CurriculumSection/LessonCardDetail.jsx` (Phase 5; expanded detail)
- Lesson content source: `docs/projects/self-coach-foundation/lessons/{conceptId}.md` (Markdown YAML-front-matter authoring; Gate 5 wires a content loader)

**Route / entry points:**
- Inline within SelfCoachView Curriculum section (collapsed); tap `Open` → expands to detail panel within the same section.
- Deep-link from HRV inline-leak `Drill this` affordance navigates to SelfCoachView Curriculum section scrolled to the matching lesson card.

**Last reviewed:** 2026-05-02 (created at SCF Gate 4)

---

## Purpose

A discrete unit of pedagogy authored against a single concept. Renders prose exposition + worked example + drill linkage + opt-in-test affordance + citation + version lineage. Lesson cards are the building block of the Curriculum section ranked list and the substrate for Gate 5 ongoing authoring.

The lesson-card surface is a TEMPLATE INSTANTIATION: each Markdown lesson file in `docs/projects/self-coach-foundation/lessons/` produces one lesson-card render at runtime. The schema is enforced; authors fill fields per the template (`docs/projects/self-coach-foundation/lesson-authoring-template.md`).

## JTBD served

Primary:
- **CO-55** *learn-next-concept-im-ready-for* — lesson cards are the unit the Curriculum section ranks.

Secondary:
- **CO-54** *see-leak-without-being-graded* — `leakTagIds[]` field links lesson to specific situation keys; HRV inline annotation `Drill this` deep-links to matching lesson card.

## Personas served

- [chris-live-player](../personas/core/chris-live-player.md) in self-coach mode.
- [study-block](../personas/situational/study-block.md).
- [post-session-chris](../personas/situational/post-session-chris.md).

---

## Anatomy

**Collapsed (list-item state in Curriculum section):**

```
• {title}                                  [ Open ] [ Test myself on this ]
  {drilled-state}                          ← e.g., "Drilled (last: 2026-04-28; 5 sessions)" or "Not yet drilled"
```

**Expanded (detail state — opened via `Open`):**

```
┌──────────────────────────────────────────────┐
│ {title}                                       │
│ Tier: {tier}                                  │
│ ─────────────────────────────────────────     │
│                                               │
│ {exposition.body}                             │
│ (~300-500 words of prose — pedagogical core)  │
│                                               │
│ Worked example                                │
│ {exposition.worked_example}                   │
│ (1-2 worked examples, hand-vs-hand or         │
│  scenario form)                               │
│                                               │
│ Success criteria                              │
│ {successCriteria}                             │
│                                               │
│ Source: {citation.source}                     │
│         {citation.source_line ?? ''}          │
│                                               │
│ Drilled: {drilled-state}                      │
│ Last opened: {lastOpenedAt}                   │
│                                               │
│ [ Test myself on this concept ]               │
│ [ Close ]                                     │
└──────────────────────────────────────────────┘
```

**Disabled `Test myself` button (test_substrate: 'pending') — tap behavior:**

```
ⓘ Test substrate not yet defined for this concept —
  see Gate 4 v2 / Gate 5.
```

Factual placeholder. Does not feel like a graded "you can't be tested yet" verdict (compliant with AP-SCF-04 spirit); reads as factual roadmap copy.

## State

- **Source:** static Markdown content from `docs/projects/self-coach-foundation/lessons/`. Loaded at SelfCoachView mount via Phase 5 content loader.
- **Per-lesson runtime state:**
  - `drilledState` — derived from `userSettings.perDomainMastery[conceptId]` (drilled / not yet drilled + lastDrilledAt + drillCount).
  - `testHistoryCount` — derived from `userSettings.perDomainMastery[conceptId].testResults[]` length.
  - `expanded` — local UI state (collapsed | expanded).
- Writes: NONE directly. `Test myself` button delegates to drill engine; drill engine writes `frameworkAccuracy` + `testResults[]`.

## Props / context contract

- `conceptId: string` — kebab-case stable ID; matches lesson Markdown filename.
- `expanded: boolean` — render mode flag.
- `onOpen: () => void` — toggle to expanded.
- `onClose: () => void` — toggle to collapsed.
- `onLaunchTest: (conceptId, frameworkIds) => void` — entry to drill engine in opt-in-test mode.

## Key interactions

1. **Tap `Open`** — expands the card to detail render.
2. **Tap `Test myself on this concept`**:
   - `test_substrate: 'drill'` → invokes `onLaunchTest(conceptId, frameworkIds)` → drill engine in opt-in-test mode → 5 questions → factual result modal → return to lesson card.
   - `test_substrate: 'pending'` → tap surfaces factual placeholder copy inline; no engine invocation.
3. **Tap `Close`** (expanded state) — collapses back to list-item state.
4. **Deep-link entry** (from HRV inline annotation `Drill this`) — auto-expands the matching lesson card on SelfCoachView mount.

---

## Schema (required fields)

Authored as YAML front-matter at the top of each `lessons/{conceptId}.md` file:

```yaml
conceptId:        string         # kebab-case stable ID matching filename
title:            string         # human label
tier:             1 | 2 | 3 | 4 | 5 | 6   # SCF-G3-TIERMAP tier
leakTagIds:       string[]       # situation-key tags this lesson addresses
frameworkIds:     string[]       # drill linkage; empty for test_substrate: pending
test_substrate:   'drill' | 'pending'
exposition:
  body:           markdown       # ~300-500 words; pedagogical core; CD-1..5 compliant
  worked_example: markdown       # 1-2 worked examples
citation:
  source:         string         # e.g., "POKER_THEORY.md §5.5"
  source_line:    integer | null
successCriteria:  markdown       # what does "internalized" look like; observable terms
versionLineage:
  version:        integer        # increments on amendment
  authored_at:    date
  amended_at:     date | null
  amendment_reason: string | null
cd5_exempt:       null           # NEVER set on lesson card itself; only on test-result-display surface
```

**Shape rules.**
- `tier` MUST be one of 6 enumerated values.
- `frameworkIds[]` populated when `test_substrate: 'drill'`; MUST reference valid framework IDs from `drillContent/frameworks.js` or `postflopDrillContent/frameworks.js`. Empty when `test_substrate: 'pending'`.
- `leakTagIds[]` may be empty for foundational lessons (Tier 1 pot-odds doesn't tie to a single situation key).
- `cd5_exempt` is NEVER set on the lesson card itself. It applies only to the test-result-display surface (the modal shown after a 5-question quiz completes). Lesson card body is bound by full CD-1..5 with no exemption.
- `versionLineage.version` increments on amendment. Amendment surfaces factual diff in change log; never as "concept reset" or "remastered" framing (per AP-SCF-05).

## Anti-pattern compliance

| AP | Verdict |
|----|----|
| AP-SCF-01 (graded-work-framing on system-imposed) | Compliant. Lesson card body is system-imposed surface; no grading vocabulary. |
| AP-SCF-04 (small-sample claim) | N/A. Lesson is content, not claim. |
| AP-SCF-05 (mastery score) | Compliant. `drilledState` is binary + last-drilled-at; no progress %; no completion badge. |
| AP-SCF-06 (streak / engagement-pressure) | Compliant. `drillCount` shown factually ("5 sessions") not as streak ("5 day streak"). |
| AP-08 (signal fusion) | Compliant. Lesson card displays drill state + test history independently; not fused. |

## Copy-discipline compliance

- **CD-1 (factual, not imperative)** — lesson body authored as observation + computation; "should" / "must" / "always" + hero verb forbidden.
- **CD-2 (no self-evaluation framing)** — lesson body never asks "did you handle this?" / "rate your decision"; success criteria authored in observable terms ("able to compute X within 5 seconds"), not graded outcomes.
- **CD-3 (no engagement copy)** — no motivational copy, no "great progress!", no streaks.
- **CD-4 (labels as outputs, never inputs)** — exposition decomposes labels to game-state inputs. CD-4 walkthrough is part of authoring template audit checklist.
- **CD-5 (assumptions explicit)** — N/A directly (lesson is prose, not claim). Worked examples cite sample-size + situation-key when computing observed rates.

---

## Known behavior notes

- **`test_substrate: 'pending'` is the v1 default for 14 of 19 SCF-G3-TIERMAP concepts** per Gate 4 §SCF-G4-COVERAGE. Authors must NOT silently flip a lesson to `test_substrate: 'drill'` without confirming a 1:1 framework match; the audit checklist in `lesson-authoring-template.md` enforces this.
- **Markdown content reuse from drill modules** — the 5 reference lessons (001-005) reuse exposition prose from `drillContent/lessons.js` and `postflopDrillContent/lessons.js`. This is intentional per the owner's "drills + tests overlap; don't maintain two parallel learning environments" binding (Gate 4 architectural overlap §). Lesson cards are the SCF schema overlay around already-validated drill content.
- **Lessons 006-019** author against the same template in Gate 5 ongoing authoring. Tier 6 lessons may permanently retain `test_substrate: 'pending'` if Gate 4 v2 / Gate 5 research determines no test shape is appropriate at the user's tier.

## Known issues

(None — surface is spec'd at SCF Gate 4; first audit findings will land at Gate 5 implementation review.)

## Potentially missing

- **Lesson cross-references** — e.g., "See also: range-vs-range thinking (Tier 3)" inline links between lessons. v2 if useful.
- **Owner-amendable success criteria** — owner edits success criteria inline (e.g., narrows from "compute within 5 seconds" to "compute within 3 seconds" as their own personal mastery target). Not in v1.

---

## Test coverage

- Schema validation at Gate 5: `lessonCardSchema.test.js` — every lesson Markdown file parses + passes schema.
- `frameworkIds[]` validity at Gate 5: each ID exists in `drillContent` or `postflopDrillContent` framework registries.
- Component-level tests at Gate 5: `LessonCardItem.test.jsx`, `LessonCardDetail.test.jsx`.
- Markdown content audit at Gate 5: CI-lint forbidden-string grep over each lesson body + worked example + success criteria (per `copy-discipline.md` CI-lint section).

## Related surfaces

- `self-coach-view` — parent (lesson cards live in Curriculum section).
- `skill-assessment-test` — sibling (`Test myself` button delegates here).
- `postflop-drills` / `preflop-drills` — substrate (drill engine in opt-in-test mode).
- `leak-distillation` — `leakTagIds[]` map to situation keys produced by the leak-distillation pipeline.

---

## Change log

- 2026-05-02 — Created (SCF Gate 4 / WS-012 / SPR-020). Schema authored per Decision 5 (inline-handled with rationale per Gate 4 §SCF-G4-S3). Reuses exposition prose from existing drill modules per owner architectural binding. 5 reference lessons (001-005) cover Tier 1, 3, 4, 5; gap concepts (10 of 19 in TIERMAP) ship in Gate 5 ongoing with `test_substrate: 'pending'`.
