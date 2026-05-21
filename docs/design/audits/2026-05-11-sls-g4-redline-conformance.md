# Audit — Shape Language Gate 4 Red-Line Conformance Matrix

**ID:** `2026-05-11-sls-g4-redline-conformance`
**Type:** Gate 4 — conformance test catalog
**Project:** [Shape Language](../../projects/poker-shape-language.project.md)
**Closes:** WS-180 (SPR-074) accept criterion #3
**Status:** Design-only (catalog binds future enforcement); enforcement fires when Stream B/D code lands

---

## Purpose

This audit is the **aggregate** red-line conformance test catalog for SLS Gate 4. It enumerates, per surface and per red line, the binding enforcement target.

Each surface doc carries its own inline per-surface red-line table (under §"Red-line compliance"). This catalog is the rolled-up view across all five SLS-impacted surfaces, with **enforcement-method per cell** and the **specific test file / CI grep target / dispatch assertion** that future Stream B/D code must satisfy.

Per the Gate 3 Q5 verdict + binding decision-memo Pattern 3 ("Gate 4 enumerates red-line checks as boolean conformance matrix per surface"), this catalog is the deliverable that closes that pattern.

**Enforcement-method decision (SPR-074 D3, ratified upfront):** **Hybrid per-red-line**. CI-grep for syntactic violations (forbidden field names, forbidden copy strings, forbidden imports); DOM/render assertion for behavioral violations (mode gating, mute exclusion, dispatch behavior). The matrix specifies which method per cell. Tests get written when surfaces ship src/ (Stream B/D); the catalog binds *what* gets tested *where* and *how*.

---

## The 9 binding red lines (canonical numbering)

Sourced from [`2026-04-23-blindspot-shape-language-adaptive-seeding.md`](2026-04-23-blindspot-shape-language-adaptive-seeding.md) §"the eight red lines" + [`shape-language-study-home.md`](../surfaces/shape-language-study-home.md) §"Red-line compliance" canonical numbering. Red lines #1-#8 are verbatim from the Gate 2 audit; #9 is the Q4-verdict derivation ("Mastery never displayed as a score") that the SLS embed elevated to a peer red line at SPR-073.

| # | Name | Origin |
|---|---|---|
| 1 | Opt-in enrollment required | Gate 2 audit #1 |
| 2 | Full transparency screen | Gate 2 audit #2 |
| 3 | Durable override (skip / declare-mastery respected; single-tap) | Gate 2 audit #3 |
| 4 | Three-way reversibility (per-descriptor / global / incognito) | Gate 2 audit #4 |
| 5 | No streaks, no shame, no engagement-pressure, no notifications | Gate 2 audit #5 |
| 6 | Flat lesson index always accessible | Gate 2 audit #6 |
| 7 | No gamified-infantile language | Gate 2 audit #7 |
| 8 | No cross-surface contamination | Gate 2 audit #8 |
| 9 | Mastery never displayed as a score | Q4 verdict + SLS embed §9 |

---

## Surfaces in scope

Five surfaces are bound by this matrix:

1. **[study-home.md](../surfaces/study-home.md)** — cross-project parent surface (renders flat index, transparency footer, intent-mode router)
2. **[shape-language-study-home.md](../surfaces/shape-language-study-home.md)** — SLS embed inside study-home (three-intent body regions)
3. **[shape-skill-map.md](../surfaces/shape-skill-map.md)** — transparency screen (Settings-routed)
4. **[lesson-runner.md](../surfaces/lesson-runner.md)** — drill / lesson surface (three variants)
5. **[shape-language-enrollment.md](../journeys/shape-language-enrollment.md)** — enrollment journey

A sixth surface (Settings → Shape Language sub-panel) is implicitly in scope as the host of shape-skill-map; conformance for the sub-panel itself is delegated to the contained surface.

---

## Conformance matrix — per surface × per red line × enforcement method

Legend:
- **CI-grep** — `scripts/check-sls-redlines.cjs` static analysis; fails CI on forbidden pattern match
- **DOM-assert** — `__tests__/redlines.test.jsx` render/dispatch assertion; fails test on violation
- **Hybrid** — both methods, each catching a different sub-rule
- **N/A** — red line does not apply to this surface (and the doc must explicitly say so; absence is not exemption)
- **Structural** — the surface's design makes violation impossible (e.g., Reference variant has no write affordances); doc must explain the structural guarantee

### Red line #1 — Opt-in enrollment required

| Surface | Enforcement | Test target |
|---|---|---|
| study-home | DOM-assert | Render test: when no project is enrolled, transparency footer is hidden and intent-mode router defaults to Reference. |
| shape-language-study-home | DOM-assert | Render test: when `enrolled === false`, only Reference-mode body renders; Deliberate + Discover tabs disabled or hidden. |
| shape-skill-map | DOM-assert (route gate) | Route test: when `enrolled === false` and user navigates to skill-map URL, `<Navigate to={enrollmentRoute} />` fires. |
| lesson-runner (Reference variant) | Structural | Reference variant is NOT enrollment-gated (per red line #6 — flat lesson index always accessible). Doc explicitly states this. |
| lesson-runner (Deliberate variant) | DOM-assert | Route test: when not enrolled, Deliberate variant redirects to enrollment. |
| lesson-runner (Discover variant) | DOM-assert | Route test: same as Deliberate. |
| shape-language-enrollment | Structural | This IS the enrollment surface — opt-in IS the surface's purpose. |

### Red line #2 — Full transparency screen

| Surface | Enforcement | Test target |
|---|---|---|
| study-home | DOM-assert | Render test: transparency footer renders "Skill data: Shape Language" link when enrolled. |
| shape-language-study-home | DOM-assert | Render test: footer link to skill-map renders when enrolled. |
| shape-skill-map | **DOM-assert (primary anchor)** | Render test: all 10 descriptor rows present; each row has composition block when expanded; W_drill + declared rendered side-by-side per Q4. |
| lesson-runner | DOM-assert | Completion-screen render test: "posterior updated from α=X β=Y to α=X' β=Y'" string present when non-incognito. |
| shape-language-enrollment | DOM-assert | Step 3 render test: declared-known seed list visible before "Continue" tap. |

### Red line #3 — Durable override (single-tap, respected, no nag)

| Surface | Enforcement | Test target |
|---|---|---|
| study-home | N/A | Override affordances live on per-project surfaces; doc states this delegation. |
| shape-language-study-home | Hybrid | DOM-assert: Discover-mode `[Mute]` is single-tap (no confirm modal interception). CI-grep: forbid "are you sure you want to mute" / "still want to skip" copy strings. |
| shape-skill-map | Hybrid | DOM-assert: `[Recalibrate]` (confirm-modal acceptable for destructive) + `[Unmute]` (single-tap, no confirm). CI-grep: forbid nag-prompt re-asks on muted descriptors. |
| lesson-runner (Discover variant) | Hybrid | DOM-assert: `[Not this one]` + `[Mute]` pre-first-answer are single-tap (skip-disambiguation has 2 buttons, no nested confirm). CI-grep: forbid "still want" / "are you sure you want to skip". |
| lesson-runner (Reference + Deliberate variants) | Structural | No override affordances render (single-descriptor surface; override affordances live on skill-map + Discover variant). |
| shape-language-enrollment | DOM-assert | Step 3 "Skip" affordance is single-tap (always offered; no "are you sure"). |

### Red line #4 — Three-way reversibility (per-descriptor reset / global reset / incognito)

| Surface | Enforcement | Test target |
|---|---|---|
| study-home | N/A | Reversibility affordances live on per-project surfaces. |
| shape-language-study-home | DOM-assert | Render test: incognito toggle visible in Deliberate-mode header; Settings-link visible for per-descriptor + global resets. |
| shape-skill-map | DOM-assert (primary anchor) | Render test: `[Recalibrate]` × 10 (per descriptor) + `[Start fresh]` (global) + `[Toggle incognito for next session]` (incognito) all present in single page. |
| lesson-runner (Deliberate + Discover) | DOM-assert | Variant render test: incognito toggle visible in header; toggleable mid-drill. When ON at completion, render test asserts no `RECORD_DRILL_OUTCOME` dispatch fires + "no model update this session" copy renders. |
| lesson-runner (Reference variant) | Structural | Variant is structurally incognito (no writers exist). Doc states this. |
| shape-language-enrollment | DOM-assert | Step 1 master-toggle is reversible; Step 2 seed list editable before final "Continue"; "Skip" path always offered. |

### Red line #5 — No streaks, no shame, no engagement-pressure, no notifications

| Surface | Enforcement | Test target |
|---|---|---|
| study-home | Hybrid | CI-grep: forbid `currentStreak`, `consecutiveCorrect`, `daysActive`, "X days in a row", "you missed", "🔥" (fire emoji = streak idiom). DOM-assert: no element with class matching `/streak\|reward\|celebration/`. |
| shape-language-study-home | Hybrid | Same CI-grep list. DOM-assert: welcome-back banner is one-time-per-session (reducer asserts `welcomeBackDismissed` flag); banner copy is factual ("It's been N weeks") not framed ("don't break your streak"). |
| shape-skill-map | Hybrid | Same CI-grep list. DOM-assert: no streak rendering anywhere; decay rendered as factual "N days ago" not "you've been slacking". |
| lesson-runner | Hybrid | Same CI-grep list. DOM-assert: completion copy is factual ("4/5 correct"); no badges / celebrations / mascots; partial-completion is not punished (50%-threshold partial write, no shame copy). |
| shape-language-enrollment | Hybrid | Same CI-grep list. DOM-assert: copy is editor's-note tone ("Enable Shape Language" not "Start your journey!"). |
| **Notifications check (all surfaces)** | CI-grep | Forbid `requestNotificationPermission` / `Notification.requestPermission` / `new Notification(` in any file under `src/components/views/StudyHomeView/**` + `src/components/views/SettingsView/ShapeSkillMapPanel/**` + `src/components/views/LessonRunnerView/**`. |

### Red line #6 — Flat lesson index always accessible

| Surface | Enforcement | Test target |
|---|---|---|
| study-home | DOM-assert | Render test: flat index renders regardless of `currentIntent`, regardless of any project's enrollment state. |
| shape-language-study-home | DOM-assert | Render test: flat-index entry "Shape Language → 10 descriptor lessons + skill map" renders when not enrolled (entry registers in study-home parent's index unconditionally). |
| shape-skill-map | N/A | Skill-map IS gated on enrollment per #1; the flat-index path is via study-home + lesson-runner Reference variant. Doc states the delegation. |
| lesson-runner (Reference variant) | DOM-assert | Route test: surface renders for any of 10 descriptors regardless of enrollment / mute / declaration. |
| lesson-runner (Deliberate + Discover) | N/A | These variants are enrollment-gated per #1; flat-index path uses Reference variant. |
| shape-language-enrollment | DOM-assert | "Skip" path routes to study-home Reference mode → flat index → any descriptor lesson in Reference variant. |

### Red line #7 — No gamified-infantile language

| Surface | Enforcement | Test target |
|---|---|---|
| **All 5 surfaces (uniform check)** | CI-grep | Forbidden strings list: "great job", "you've earned", "level up", "🎉", "🏆", "you're doing great", "keep it up", "awesome", "fantastic", "amazing!", "way to go". Applied to all `.jsx` files under the 5 surface code-path roots. |
| **All 5 surfaces (DOM)** | DOM-assert | Render tests assert no `<img>` with class matching `/badge\|trophy\|medal/` + no emoji character (codepoint range U+1F300-U+1FAFF) in copy strings within descriptor row bodies / completion screens / footer affordances. |

### Red line #8 — No cross-surface contamination

| Surface | Enforcement | Test target |
|---|---|---|
| **All 5 surfaces (uniform check)** | CI-grep (imports) | Source files under `src/components/views/StudyHomeView/**`, `src/components/views/SettingsView/ShapeSkillMapPanel/**`, `src/components/views/LessonRunnerView/**` MUST NOT import from `src/components/views/TableView/**`, `src/components/views/OnlineView/**`, `src/utils/exploitEngine/**`. |
| **Route-table check** | DOM-assert | App router test: assert NO live surface (TableView / OnlineView / LiveAdviceBar / SizingPresetsPanel) registers `LessonRunner` / `ShapeSkillMap` / `StudyHome` as sub-route or modal. |
| **Sidebar extension** | CI-grep | Source files under `ignition-poker-tracker/src/**` MUST NOT import from `src/components/views/StudyHomeView/**` or `src/utils/skillAssessment/**`. Sidebar is mastery-agnostic per red line #8 + Gate 2 audit. |
| **Descriptor badges on live surfaces (positive check)** | DOM-assert | If live surfaces render any Shape Language descriptor badge, it must be sourced from a *classifier* output (e.g., `boardTexture.shapeTagsFired`), NEVER from `shapeMastery` posteriors. Render test asserts the badge data attribute traces to classifier source, not mastery selector. |

### Red line #9 — Mastery never displayed as a score

| Surface | Enforcement | Test target |
|---|---|---|
| **All 5 surfaces (uniform check)** | CI-grep | Forbidden field names + copy strings: `masteryScore`, `fusedMastery`, `confidenceLevel`, `overallLevel`, "your mastery: ", "your level: ", "percentile", "mastery: 0.", "your score: ". Applied to all `.jsx` + `.js` files under the 5 surface code-path roots. |
| **All 5 surfaces (DOM)** | DOM-assert | Render tests assert posterior renderings are either (a) α/β + credible interval, or (b) correct/total counts, or (c) qualitative "N drills, last validated X days ago" — **never** a single 0-1 score or 0-100 percentile or "level N of M" rank. |
| **Q4 separation rendering (shape-skill-map specifically)** | DOM-assert | Skill-map expanded-row render test asserts BOTH `W_drill` row AND `declared` row visible side-by-side (never collapsed into a single line). |
| **Reducer-level (shape-mastery contract)** | Static + unit | `ShapeMasteryState` TypeScript / JSDoc type definition has NO field named `masteryScore` / `fusedMastery`. Reducer unit test asserts no action ever sets such a field. |

---

## Aggregate enforcement plan

### CI-grep script — `scripts/check-sls-redlines.cjs` (planned)

Single Node.js script (CommonJS, matches MPMF AP-* precedent). Reads a configured set of:
- **Forbidden strings** (literal substrings to grep across `src/**/*.{js,jsx}` + `ignition-poker-tracker/src/**`)
- **Forbidden imports** (from-target × to-target pairs)
- **Forbidden field names** (looking for identifier declarations matching forbidden names)
- **Allowed exceptions** (per-rule allowlist for test files, etc.)

Output: per-rule pass/fail; failing rules list offending file:line:match. Exits non-zero on any failure.

Companion JSON config: `scripts/sls-redlines.config.json` enumerates the corpus from this catalog.

CI hook: `npm test` invokes the script as a pre-step OR a dedicated `npm run check-sls-redlines` script + GitHub Actions step (TBD at Stream B/D ship).

### DOM-assert test files (planned per surface)

- `src/components/views/StudyHomeView/__tests__/redlines.test.jsx`
- `src/components/views/StudyHomeView/embeds/__tests__/ShapeLanguageEmbed.redlines.test.jsx`
- `src/components/views/SettingsView/ShapeSkillMapPanel/__tests__/redlines.test.jsx`
- `src/components/views/LessonRunnerView/__tests__/redlines.test.jsx` (covers all 3 variants)
- `src/components/views/StudyHomeView/journeys/__tests__/ShapeLanguageEnrollment.redlines.test.jsx`

Each file has one `describe` per red line and one `test` per surface×red-line cell that is `DOM-assert` or `Hybrid` in this matrix.

### Reducer-level unit tests (planned)

- `src/reducers/__tests__/shapeMasteryReducer.redlines.test.js` — covers reducer-level enforcement of I-SM-1 through I-SM-9 from [shape-mastery.md](../contracts/shape-mastery.md). The contract invariants and this conformance matrix overlap; the matrix's red-line cells that say "reducer assertion" delegate to that test file.

### Route-table check (planned)

- `src/__tests__/route-isolation.test.js` — single test that walks the app's full route table and asserts the cross-surface-contamination invariant (no live-surface registers a Shape Language surface as sub-route or modal; no sidebar import).

---

## Cell counts

| Red line | Surfaces × cells | CI-grep cells | DOM-assert cells | Structural cells | N/A cells |
|---|---|---|---|---|---|
| #1 | 7 | 0 | 5 | 2 | 0 |
| #2 | 5 | 0 | 5 | 0 | 0 |
| #3 | 7 | 0 | 0 | 2 | 1 (study-home — delegated) |
| (#3 cont) Hybrid cells | | | | | 4 |
| #4 | 7 | 0 | 5 | 1 | 1 |
| #5 | 5 + 1 notif | 6 | 0 | 0 | 0 |
| (#5 cont) Hybrid cells | | | | | 5 |
| #6 | 7 | 0 | 4 | 0 | 3 |
| #7 | 2 (uniform) | 1 | 1 | 0 | 0 |
| #8 | 4 (uniform + targeted) | 2 | 2 | 0 | 0 |
| #9 | 4 (uniform + targeted) | 1 | 2 | 0 | 0 |
| (#9 cont) Reducer | | | | | 1 |

**Total binding cells:** 9 red lines × 5 surfaces ≈ 45 cells; some marked N/A (delegated) or Structural (design-guaranteed). Approximate breakdown: ~15 pure CI-grep, ~20 pure DOM-assert, ~9 Hybrid (both methods), ~5 Structural, ~7 N/A with explicit delegation rationale.

Hybrid + DOM-assert dominate on rules #3, #4, #5 (behavioral). CI-grep dominates on #7, #8, #9 (syntactic + import-graph). This matches the SPR-074 D3 ratification — the right tool for each rule.

---

## What this catalog does NOT do

- **Does not implement the tests.** Implementation lands at Stream B/D code phase. This catalog is the spec the implementations must satisfy.
- **Does not author the CI-grep script.** Script + config implementation are Stream B/D scope (or earlier, if a pre-implementation CI-grep skeleton is useful).
- **Does not test pure poker theory.** That's [POKER_THEORY.md](../../../C:/Users/chris/.claude/projects/C--Users-chris-OneDrive-Desktop-Claude-Poker-Tracker/POKER_THEORY.md) territory + domain-correctness program scope.
- **Does not enumerate every possible test.** Surface-level functional tests (drill mechanics, decay math, posterior updates) are scoped to their respective surface specs + reducer/util test files; this catalog covers **red-line conformance specifically**.

---

## Sign-off

This catalog binds the SPR-074 close-out of SLS Gate 4. All five surfaces' per-surface red-line tables align with this aggregate. Future surface additions to SLS (e.g., extended advanced-descriptor surfaces, opt-in test surfaces) MUST add a row to each red line table in this matrix in the same commit that adds the surface — drift is the bug class this catalog prevents.

Authored by SPR-074 (WS-180) 2026-05-11. Closes SLS Gate 4 alongside [shape-skill-map.md](../surfaces/shape-skill-map.md) + [lesson-runner.md](../surfaces/lesson-runner.md). Stream A row G4 in [`docs/projects/poker-shape-language.project.md`](../../projects/poker-shape-language.project.md) flips from [~] (partial; SPR-073 foundation) to [x] (closed; SPR-074 catalog) on this audit's existence.

---

## Cross-references

- [shape-language-study-home.md](../surfaces/shape-language-study-home.md) — surface §"Red-line compliance"
- [shape-skill-map.md](../surfaces/shape-skill-map.md) — surface §"Red-line compliance" (this surface's slot)
- [lesson-runner.md](../surfaces/lesson-runner.md) — surface §"Red-line compliance" (3 variants)
- [shape-language-enrollment.md](../journeys/shape-language-enrollment.md) — journey §"Red-line compliance" (assumed present; if not, SPR-074 amends)
- [study-home.md](../surfaces/study-home.md) — grandparent surface
- [shape-mastery.md](../contracts/shape-mastery.md) — I-SM-1 through I-SM-9 reducer-level invariants
- [`2026-04-23-blindspot-shape-language-adaptive-seeding.md`](2026-04-23-blindspot-shape-language-adaptive-seeding.md) — original Gate 2 RED verdict + 8 red lines source
- [`2026-04-23-blindspot-shape-language-adaptive-seeding-rerun.md`](2026-04-23-blindspot-shape-language-adaptive-seeding-rerun.md) — Gate 2 GREEN re-run; red lines promoted to persona invariants
- [`docs/projects/poker-shape-language/gate3-decision-memo.md`](../../projects/poker-shape-language/gate3-decision-memo.md) — Q1-Q7 verdicts + Pattern 3 conformance-matrix decision

---

## Change log

- 2026-05-11 — Created at SPR-074 (Shape Language Gate 4 close-out, WS-180). Hybrid per-red-line enforcement ratified upfront (D3=A). Aggregates per-surface red-line tables across 5 surfaces × 9 red lines. Closes accept criterion #3 of WS-180; closes Gate 4 of SLS project.
