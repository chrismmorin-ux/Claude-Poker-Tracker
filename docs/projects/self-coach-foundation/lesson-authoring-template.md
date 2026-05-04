# Lesson authoring template — SCF

**Created:** 2026-05-02 (SCF Gate 4 / WS-012 / SPR-020)
**Audience:** SCF Gate 5 ongoing lesson authors. Phase 2+ contributors.
**Substrate:** Markdown files in `docs/projects/self-coach-foundation/lessons/{conceptId}.md`. YAML front-matter + Markdown body.

**Sibling docs:**
- [Lesson card surface — `surfaces/lesson-card.md`](../../design/surfaces/lesson-card.md) (the surface that consumes this content)
- [Gate 4 audit — `audits/2026-05-02-gate4-design-self-coach-foundation.md`](../../design/audits/2026-05-02-gate4-design-self-coach-foundation.md) §SCF-G4-S3 + §SCF-G4-LESSONS
- [`anti-patterns.md`](anti-patterns.md) (AP-SCF-01..06)
- [`copy-discipline.md`](copy-discipline.md) (CD-1..5 + CI-lint forbidden-string list)

---

## Why this template exists

Lesson cards are the unit the curriculum-spine ranks. Authors fill the schema below for each concept; the SelfCoachView Curriculum section renders them. Per the owner's architectural binding ("drills + tests overlap; don't maintain two parallel learning environments"), lesson exposition prose should reuse content from existing `drillContent/lessons.js` or `postflopDrillContent/lessons.js` where a concept has drill backing — Markdown lesson files are the SCF schema OVERLAY around already-authored content, not a fresh re-authoring of pedagogy.

This template is the contract. Authors write Markdown lesson files; CI-lint + Gate 5 PR review validate against this template's checklist.

---

## File format

Each lesson is a single Markdown file at `docs/projects/self-coach-foundation/lessons/{NNN}-{conceptId}.md` where `NNN` is a 3-digit sequence number for ordering.

YAML front-matter at the top declares the schema; Markdown body follows.

```markdown
---
conceptId:        cbet-defense
title:            Cbet Defense Fundamentals
tier:             3
leakTagIds:       ['flop-cbet-defense-overfold', 'flop-cbet-defense-underdefend']
frameworkIds:     ['range_decomposition', 'board_tilt']
test_substrate:   drill
exposition_source:
  module:         postflopDrillContent/lessons.js
  lesson_id:      range-decomposition
citation:
  source:         POKER_THEORY.md §5.5
  source_line:    null
versionLineage:
  version:        1
  authored_at:    2026-05-02
  amended_at:     null
  amendment_reason: null
---

## Exposition

(Pedagogical core — ~300-500 words of prose; CD-1..5 compliant.)

When facing a c-bet on a dry flop like K72r, the question isn't whether to fold
sometimes — it's whether your fold rate is calibrated to villain's bluff
frequency...

## Worked example

(1-2 worked examples — hand-vs-hand or scenario form.)

Hero (BB) defends 65s vs CO open. Flop K72r, CO cbets 33% pot. Hero's pot odds
require ~22% equity to call profitably. 65s on K72r has ~12% raw equity but...

## Success criteria

(What does "internalized" look like — observable terms, not graded outcomes.)

Internalized when the user can compute defending range MDF for half-pot,
two-thirds pot, and pot-sized cbet sizings within 10 seconds at the table,
without reaching for paper or the app.
```

---

## Required field reference

| Field | Type | Required | Description |
|---|---|---|---|
| `conceptId` | string | yes | kebab-case stable ID matching filename. Once set, never changes (renaming requires migration). |
| `title` | string | yes | Human label rendered as lesson card heading. |
| `tier` | 1\|2\|3\|4\|5\|6 | yes | SCF-G3-TIERMAP tier. Must be one of the 6 enumerated values. |
| `leakTagIds[]` | string[] | yes | Situation-key tags this lesson addresses (from heroLeakDetector taxonomy). Empty array allowed for foundational lessons (Tier 1 pot-odds doesn't tie to a single situation key). |
| `frameworkIds[]` | string[] | yes | Drill linkage. Populated when `test_substrate: 'drill'`; MUST reference valid IDs from `drillContent/frameworks.js` or `postflopDrillContent/frameworks.js`. Empty array when `test_substrate: 'pending'`. |
| `test_substrate` | 'drill'\|'pending' | yes | Gates the `Test myself on this concept` button. Default `'pending'` for new authoring; flip to `'drill'` ONLY after confirming 1:1 framework match (audit checklist below). |
| `exposition_source` | object\|null | optional | If lesson reuses existing drill module exposition, reference the source. Avoids re-authoring pedagogy. |
| `citation.source` | string | yes | Canonical source. Usually `POKER_THEORY.md §X.X` or analogous. |
| `citation.source_line` | integer\|null | optional | Specific line in source if applicable. |
| `successCriteria` | markdown | yes | What "internalized" looks like in observable terms. NOT a graded outcome. |
| `versionLineage.version` | integer | yes | Increments on amendment. v1 starts at 1. |
| `versionLineage.authored_at` | date | yes | ISO date authored. |
| `versionLineage.amended_at` | date\|null | optional | ISO date last amended. |
| `versionLineage.amendment_reason` | string\|null | optional | One-line description of amendment. |
| `cd5_exempt` | null | always null | NEVER set on lesson card itself. Only the test-result-display surface manifest carries this flag. |

---

## Markdown body sections

Three required sections in order:

### 1. `## Exposition`

The pedagogical core. ~300-500 words of prose. Authored against CD-1..5:

- **CD-1 (factual, not imperative)** — describe observed conditions + computational chains, not direct orders. ✗ "You should fold less here." → ✓ "Observed fold rate at this sizing: X%. Solver baseline: Y%."
- **CD-2 (no self-evaluation framing)** — never "did you handle this?" / "rate your decision". ✓ "The decision is a function of equity vs pot odds + position + range advantage."
- **CD-3 (no engagement copy)** — no streaks, no motivational copy, no urgency.
- **CD-4 (labels as outputs, never inputs)** — decompose villain-style labels to game-state inputs. ✗ "vs fish you should overfold" → ✓ "vs villains with VPIP ≥ 35 + observed `foldToBet(half-pot)` ≤ 30%, the EV calculation is..."
- **CD-5** — N/A directly (lesson is prose, not claim). Worked examples cite sample-size + situation-key when computing observed rates.

If reusing exposition from `drillContent/lessons.js` or `postflopDrillContent/lessons.js`, copy the prose body and cite via `exposition_source` field. Don't re-author.

### 2. `## Worked example`

1-2 concrete worked examples. Hand-vs-hand (preflop) or scenario (postflop) form. Walk through the math + reasoning step-by-step.

Reuse worked examples from existing drill modules where applicable (cite via `exposition_source`).

### 3. `## Success criteria`

What does "internalized" look like in OBSERVABLE terms? NOT a graded outcome.

✓ Good: "Internalized when the user can compute MDF for half-pot, pot-sized, and overbet sizings within 10 seconds at the table."

✗ Bad: "Internalized when the user scores 80% on the cbet defense quiz." (graded framing — fails CD-2)

✗ Bad: "Internalized when the user feels confident at the table." (subjective; not observable)

---

## Audit checklist (pre-merge Gate 5 review)

Authors verify each item before marking the lesson PR ready for review.

### Schema validity
- [ ] `conceptId` is unique across all lessons (filename matches; no collision)
- [ ] `title` is set
- [ ] `tier` is one of [1, 2, 3, 4, 5, 6]
- [ ] `leakTagIds[]` is set (empty array allowed for foundational concepts)
- [ ] `frameworkIds[]` is set; if `test_substrate: 'drill'`, contains at least one valid framework ID; if `test_substrate: 'pending'`, is empty array
- [ ] `test_substrate` is `'drill'` or `'pending'`
- [ ] `citation.source` is set
- [ ] `successCriteria` is set in observable terms (NOT graded)
- [ ] `versionLineage.version` is integer ≥ 1
- [ ] `versionLineage.authored_at` is ISO date
- [ ] `cd5_exempt` is null (NEVER set on lesson card)

### Test substrate validity
- [ ] If `test_substrate: 'drill'`: each frameworkId in `frameworkIds[]` exists in `drillContent/frameworks.js` or `postflopDrillContent/frameworks.js` (Gate 5 validation: `lessonCardSchema.test.js`)
- [ ] If `test_substrate: 'drill'`: framework's matchup library or scenario library has at least 5 entries scoped to the framework (so 5-question quiz can pick from the pool)

### CD-1..5 compliance
- [ ] `## Exposition` body has no imperative copy (no "should" / "must" / "always" / "never" + hero verb)
- [ ] `## Exposition` body has no self-evaluation framing (no "did you" / "how did you" / "rate your")
- [ ] `## Exposition` body has no engagement copy (no streaks, motivational copy, urgency, gamification)
- [ ] If villain-style labels appear (Fish/Nit/LAG/TAG/Station/Maniac), they decompose to game-state inputs nearby — not used as decision inputs
- [ ] `## Worked example` cites sample size + situation key for any observed-rate claims

### AP-SCF-01..06 compliance
- [ ] No graded-work-framing in lesson body (AP-SCF-01)
- [ ] No villain-archetype prescription in lesson body (AP-01 EAL-inherited)
- [ ] No mastery score field in `successCriteria` (AP-SCF-05)
- [ ] No streak / engagement-pressure framing (AP-SCF-06)

### 9 autonomy red lines compliance
- [ ] Red line #1 (opt-in): lesson does not require user enrollment beyond visiting the lesson card
- [ ] Red line #2 (transparency): citation + exposition_source visible
- [ ] Red line #6 (flat access): lesson does not gate content behind tier (any user can open any lesson regardless of declared tier)
- [ ] Red line #7 (editor's-note tone): no gamified-infantile language

### Gate 5 PR review
- [ ] Two-pair human review pass (CD walkthrough + AP walkthrough + red lines walkthrough by reviewer)
- [ ] CI-lint forbidden-string grep passes (build-time check; see `copy-discipline.md` CI-lint section)

---

## Worked example: lesson 001 (pot-odds)

Full file authored at `docs/projects/self-coach-foundation/lessons/001-pot-odds.md`. Schema:

```yaml
---
conceptId:        pot-odds
title:            Pot Odds & Break-Even Equity
tier:             1
leakTagIds:       []                      # foundational; no specific situation key
frameworkIds:     ['decomposition']
test_substrate:   drill
exposition_source:
  module:         drillContent/lessons.js
  lesson_id:      pot-odds
citation:
  source:         POKER_THEORY.md §3.2
  source_line:    null
versionLineage:
  version:        1
  authored_at:    2026-05-02
  amended_at:     null
  amendment_reason: null
---

## Exposition
(reused from drillContent/lessons.js #pot-odds — see exposition_source)

## Worked example
(reused from drillContent/lessons.js #pot-odds)

## Success criteria
Internalized when the user can compute break-even equity for half-pot,
pot-sized, 1.5×, and 2× bet sizes within 5 seconds without scratch paper.
```

Audit checklist verdict: all items ✓. `test_substrate: 'drill'` because `drillContent/frameworks.js#decomposition` exists and `drillContent/matchupLibrary.js` has pot-odds-relevant matchups in the practical_math category. `successCriteria` is observable (5-second mental math target).

---

## Worked example: lesson 006 (polarization-vs-linear, gap concept)

Authored after Gate 4 v1 ships; coverage gap. Schema:

```yaml
---
conceptId:        polarization-vs-linear
title:            Polarization vs Linear Sizing
tier:             3
leakTagIds:       ['flop-cbet-sizing-tell', 'turn-double-barrel-sizing-tell']
frameworkIds:     []                      # no existing drill framework
test_substrate:   pending                 # gated until Gate 4 v2 / Gate 5 research
citation:
  source:         POKER_THEORY.md §6.3
  source_line:    null
versionLineage:
  version:        1
  authored_at:    2026-05-XX               # Gate 5 ongoing
  amended_at:     null
  amendment_reason: null
---

## Exposition
(authored fresh — no existing drill backing to reuse)

## Worked example
(authored fresh)

## Success criteria
Internalized when the user can categorize a sizing decision as polarized or
linear given range shape + board texture within 10 seconds at the table.
```

`Test myself on this concept` button is rendered DISABLED in v1; tap surfaces factual placeholder ("Test substrate not yet defined for this concept — see Gate 4 v2 / Gate 5"). The lesson body still ships and is fully readable.

When Gate 4 v2 / Gate 5 research determines the right test substrate (e.g., authors a new postflop framework for polarization-vs-linear sizing), the lesson is amended:
- `frameworkIds[]` populated with the new framework ID
- `test_substrate: 'pending'` → `'drill'`
- `versionLineage.version` increments to 2
- `versionLineage.amended_at` set
- `versionLineage.amendment_reason` set ("test substrate added per Gate 5 SR-XXX")

The lesson body content does NOT change at this amendment — only the test affordance is enabled.

---

## Reference lessons (Gate 4 v1 ships these 5)

Lessons 001-005 are authored at SCF Gate 4 as the v1 reference set:

1. **001-pot-odds.md** — Tier 1 (novice). `test_substrate: 'drill'`. Reuses `drillContent/lessons.js#pot-odds`.
2. **002-range-vs-range-thinking.md** — Tier 3 (studied-amateur). `test_substrate: 'drill'`. Reuses `postflopDrillContent/lessons.js#range-decomposition`.
3. **003-board-texture.md** — Tier 3 (studied-amateur). `test_substrate: 'drill'`. Reuses `postflopDrillContent/lessons.js#board-tilt + #capped-ranges`.
4. **004-blocker-effects-preflop.md** — Tier 4 (part-time-grinder; preflop scope). `test_substrate: 'drill'`. Reuses `drillContent/lessons.js#straight-coverage + #flush-contention + #broadway-vs-middling`.
5. **005-capped-vs-uncapped-ranges.md** — Tier 5 (serious-grinder). `test_substrate: 'drill'`. Reuses `postflopDrillContent/lessons.js#capped-ranges`.

All 5 reuse exposition from existing drill modules (per the owner's architectural binding). Lesson cards add the SCF schema overlay (tier / leakTagIds / citation / successCriteria / versionLineage / test_substrate) but do NOT re-author pedagogical content.

Lessons 006+ author at Gate 5 ongoing. Pace ~1-3 lessons per session. Tier 6 lessons may permanently retain `test_substrate: 'pending'` if Gate 4 v2 / Gate 5 research determines no test shape is appropriate at the user's tier.

---

## Change log

- 2026-05-02 — Created (SCF Gate 4 / WS-012 / SPR-020). Schema authored per Gate 4 §SCF-G4-S3 lesson card spec. Audit checklist (28 items across 5 categories) reflects CD-1..5 + AP-SCF-01..06 + 9 autonomy red lines + schema validity + test substrate validity + Gate 5 PR review. Reference lesson worked examples (001 drill-backed; 006 pending) demonstrate both tracks. Reuse-from-existing-drill-content pattern explicit per architectural binding.
- 2026-05-03 — v1 framework SHIPPED (SCF Gate 5 / WS-147 / SPR-032). 2 reference lessons live: `001-cbet-defense.md` (binds `hero-ip-cbet-overfold` rule) + `002-bb-defense.md` (binds `hero-bb-defense-width` rule). Loader at `src/utils/skillAssessment/lessonRegistry.js` (`import.meta.glob` of `lessons/*.md`). Renderer at `src/components/views/LessonDetailView.jsx`. Drill-this affordance in HandReplay HeroCoachingCard now navigates to LessonDetailView (was console.log stub). Schema deviation: both shipped lessons use `test_substrate: pending` since framework binding is deferred to WS-148 / WS-149 (not yet wired to drill substrate). Both lessons cite POKER_THEORY.md sections (§6.2 MDF + auto-profit; §4.3 BB defense). Full spec from this doc reused verbatim — no schema extensions.
- 2026-05-04 — Concept-kind architecture + filename convention (SCF Gate 5 / WS-148 / SPR-033). Three concept kinds introduced: `general-skill` (coarse, drill-backed), `rule-anchored-umbrella` (one per leak rule; lesson body enumerates sub-concepts), `rule-anchored-specific` (leaf concept; one per baseline-distinct situation-key region per the granularity floor). Lesson filenames are now `{conceptId}.md` (no numeric prefix) — collision-free + scales to high granularity. The 2 lessons from SPR-032 reframed as cluster umbrellas (`cbet-defense-cluster.md`, `bb-defense-cluster.md`); leak rules' `relatedConceptId` re-pointed to the umbrellas. The 5 G4 reference lessons renamed (dropped `001-`..`005-` prefixes) but content unchanged. Sub-concept lesson files (11 leaf concepts under the 2 umbrellas) are queued for WS-149 ongoing authoring; registering the IDs in `src/utils/skillAssessment/tierConceptMap.js` is sufficient to establish the floor. See `tierConceptMap.js` + `src/utils/skillAssessment/CLAUDE.md` §Concept-kind architecture.
