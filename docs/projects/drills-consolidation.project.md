---
id: drills-consolidation
name: Drills Consolidation — Unified Study view driven by persona + jobs-to-be-done
status: proposed
priority: P2
created: 2026-04-20
backlog-id: DC
---

# Project: Drills Consolidation

## Status

**Proposed.** Not yet approved to execute. This doc is the design pass requested on 2026-04-20.

**Blocking dependency:** Line Study (active, Phase 4 of 6). This proposal sequences all execution after Line Study closes. Restructuring the container mid-flight would churn LS without benefit.

---

## The Problem

Two separate views — `PreflopDrillsView` (8 tabs) and `PostflopDrillsView` (6 tabs) — have grown incrementally. Five tab names (Explorer, Estimate Drill, Framework Drill, Library, Lessons) appear in both views and mean the same verb on each side. The user has to pick *verb* first on one side, then flip to the other view to get the same verb on the other street. 14 tabs across two views is tab-bar overload at 1600×720 and fragments an index (Lessons, Library) that should be one surface.

The underlying issue is that the nav is organized by **mode** (what the screen does), with **street** (preflop vs postflop) as the top-level axis. Persona research says the user's jobs-to-be-done decompose cleaner the other way around — job first, street as a filter inside.

---

## Persona

**Single-user app** — the owner trains for 9-handed live poker, uses the same app in session (exploit engine) and between sessions (drills). Non-technical; AI is the sole developer. Study time is limited and interrupted; the drills have to be *findable fast* and *resumable* without hunting through tabs.

Relevant facts from memory:
- Non-technical owner, needs plain-English visibility
- 9-handed live, multiway-heavy
- Uses the app for both live capture and post-session review
- Values: recognition > recall, live-game usability, mobile 1600×720

---

## Jobs-To-Be-Done

Five jobs the user actually has when they open the drills. The current 14 tabs collapse to these:

| Job | User says to themselves… | Today's surfaces serving this |
|-----|--------------------------|-------------------------------|
| **Learn** (passive) | "Teach me the concept behind X" | Preflop Lessons, Postflop Lessons, Preflop Shape (catalog navigation), Preflop Math (calculators as reference) |
| **Explore** (free-form) | "Let me play with numbers / poke a scenario" | Preflop Explorer, Postflop Explorer |
| **Drill** (graded) | "Quiz me — I want to build intuition" | Preflop Recipe, Preflop Estimate, Preflop Framework, Postflop Estimate, Postflop Framework |
| **Walk a line** (narrative) | "Walk me through a full hand with branches" | Postflop Line (being built now) |
| **Browse** (curated) | "Show me good examples I can skim" | Preflop Library, Postflop Library |

Five jobs. One view. Street is a filter inside each job, not a top-level split.

---

## Current Inventory (what each mode actually does)

### Preflop side

| Mode | File | What it is | Job bucket |
|------|------|------------|------------|
| Shape | `ShapeMode.jsx` | Hero-POV catalog browser — pick your hand, see every lane it can face with calibrated equity bands + modifier deltas. Click a sample villain → exact equity | Learn |
| Recipe Drill | `RecipeMode.jsx` | 4-step composable drill: shape → lane → modifiers → equity. Each step graded independently. Persists to `preflopDrills` IDB store with `drillType: 'recipe'` | Drill |
| Explorer | `ExplorerMode.jsx` | Free-form hand-vs-hand. Pick two hands → exact equity + framework chips | Explore |
| Estimate Drill | `EstimateMode.jsx` | Single-guess equity drill | Drill (subset of Recipe) |
| Framework Drill | `FrameworkMode.jsx` | Multi-select: which frameworks apply to this matchup | Drill |
| Library | `LibraryMode.jsx` | Curated matchups grouped by framework | Browse |
| Lessons | `LessonsMode.jsx` | Prose/formula/example pages | Learn |
| Math | `MathMode.jsx` | 5-calculator toolkit (pair-up, flush, straight coverage, pot odds, run-it-twice) — reuses calculators from `LessonCalculators.jsx` | Learn |

### Postflop side

| Mode | File | What it is | Job bucket |
|------|------|------------|------------|
| Line | `LineMode.jsx` (being built) | Branching multi-street hand walkthrough with SPI-ranked picker | **Walk a line** (own top-level) |
| Explorer | `ExplorerMode.jsx` | Free-form range-vs-board. Pick contexts + flop → hand-type breakdown | Explore |
| Estimate Drill | `EstimateMode.jsx` | "What % of this range is top-pair+?" single guess | Drill |
| Framework Drill | `FrameworkMode.jsx` | Multi-select: which frameworks apply to this scenario | Drill |
| Library | `LibraryMode.jsx` | Curated scenarios grouped by framework | Browse |
| Lessons | `LessonsMode.jsx` | Prose/formula/example pages | Learn |

### Observations

1. **Five names duplicate across sides** (Explorer / Estimate / Framework / Library / Lessons). The shells are near-identical; only the content adapter differs.
2. **Shape and Math are mis-labeled as drill tabs.** Shape is interactive catalog navigation (no grading, no persistence). Math is a calculator toolkit (no grading). Both belong in **Learn**.
3. **Recipe is a superset of Estimate** on the preflop side. Estimate's single guess = Recipe's step 4. The two could collapse to one drill with a "quick mode / composed mode" toggle, *or* stay as two drills with different question shapes — design choice, not a forced merge.
4. **Line is multi-street by nature** but lives under Postflop because that's where it was built. It should be top-level.
5. **Library + Lessons are content stores, not modes.** Fragmenting them by street splits the index a user most needs to search across.

---

## Proposed Structure

### One entry point

Replace the two floating buttons in `SessionsView` ("Preflop Drills", "Postflop Drills") with a single **Study** button. `SCREEN.PREFLOP_DRILLS` and `SCREEN.POSTFLOP_DRILLS` consolidate to `SCREEN.STUDY`.

### Five top-level tabs

```
┌─ Study ───────────────────────────────────────────────────────┐
│                                                               │
│ [ Learn ] [ Explore ] [ Drill ] [ Line Study ] [ Browse ]     │
│                                                               │
│ + street filter chip where applicable (Preflop / Postflop)    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

| Tab | Hosts (from current) | Internal nav |
|-----|----------------------|--------------|
| **Learn** | Preflop Lessons, Postflop Lessons, Preflop Shape catalog, Math toolkit | Left rail = unified lesson + catalog + calculator index. Filters: street, framework, content-type (prose / catalog / calculator). Unified search across all content. |
| **Explore** | Preflop Explorer, Postflop Explorer | Street toggle at top. Same two-pane layout (picker left, breakdown right) — only the picker+breakdown content differs per street. |
| **Drill** | Preflop Recipe, Preflop Estimate, Preflop Framework, Postflop Estimate, Postflop Framework | Drill-picker landing screen: grid of cards, each showing name + 1-line description + recent streak. Click into one → existing drill UI unchanged. Shared scheduler + persistence contract across all five. |
| **Line Study** | Postflop Line (as-is) | No change — LineMode moves up a level, stays structurally identical. |
| **Browse** | Preflop Library, Postflop Library | One unified library index. Filter by street + framework + tag. Each card opens the same detail surface as today (matchup for preflop, scenario for postflop). |

### Tab count: 14 → 5.

### What doesn't change

- Every mode's **inner UI and computation** stays byte-identical. This is a shell restructuring, not a feature rewrite.
- Persistence stores stay split (`preflopDrills`, `postflopDrills` IDB stores) — no schema migration required.
- `drillType` enum (recipe / estimate / framework / line) unchanged.
- `scenarioLibrary`, `lessons`, `frameworks`, `shapes`, `scheduler` util files unchanged.

### What does change

- `SessionsView.jsx` — one button instead of two
- `uiConstants.js` — `SCREEN.STUDY` replaces two old constants (old values kept as aliases during transition)
- New container: `src/components/views/StudyView/StudyView.jsx` (top-level shell)
- New folder: `src/components/views/StudyView/Learn/`, `Drill/`, `Browse/` — thin wrappers that host the existing Mode components
- `PreflopDrillsView.jsx` and `PostflopDrillsView.jsx` — deleted after migration (their 14 child Mode components move into StudyView with zero internal changes)
- Cross-street search/filter logic — new, small

---

## Mapping Table (current → proposed)

| Current location | New location |
|------------------|--------------|
| PreflopDrills → Shape | Study → Learn → Catalog (preflop) |
| PreflopDrills → Recipe Drill | Study → Drill → "Preflop: Compose equity" |
| PreflopDrills → Explorer | Study → Explore → Preflop |
| PreflopDrills → Estimate Drill | Study → Drill → "Preflop: Guess equity" |
| PreflopDrills → Framework Drill | Study → Drill → "Preflop: Identify frameworks" |
| PreflopDrills → Library | Study → Browse → street=Preflop |
| PreflopDrills → Lessons | Study → Learn → Lessons (street=Preflop filter) |
| PreflopDrills → Math | Study → Learn → Calculators |
| PostflopDrills → Line | Study → Line Study |
| PostflopDrills → Explorer | Study → Explore → Postflop |
| PostflopDrills → Estimate Drill | Study → Drill → "Postflop: Guess %" |
| PostflopDrills → Framework Drill | Study → Drill → "Postflop: Identify frameworks" |
| PostflopDrills → Library | Study → Browse → street=Postflop |
| PostflopDrills → Lessons | Study → Learn → Lessons (street=Postflop filter) |

---

## Open Design Questions

These should be resolved before Phase 1 starts, not in the doc:

1. **Default tab on open.** Line Study is probably the highest-value default (newest, most engaging), but Drill may be the one the owner reaches for most often. Owner to decide based on actual usage after Line Study ships.
2. **Recipe vs Estimate fate.** Keep both as separate drills in the Drill picker, or collapse Estimate into Recipe with a "quick equity only" toggle? Leaning *keep both* — they're different pedagogical beats and cost nothing to keep separate.
3. **Browse unification depth.** Just put both libraries in one tab with a street filter (simple), or merge them into a single ranked index that treats matchups and scenarios as peer items (harder, better)? Leaning *simple* for v1.
4. **Does Shape stay inside Learn, or get promoted to its own tab?** Shape is semantically a catalog — Learn is the right home. But it's heavy enough (8 shapes × multiple lanes each × click-through to exact equity) that it might deserve its own rail. Resolve after Phase 1 scaffold is up.
5. **Math vs "Calculators".** Name is weak. "Math" reads like a drill but isn't. Propose renaming to **Calculators** on migration.
6. **What happens to the old SCREEN constants?** Keep as aliases that redirect to the new one, delete after one release, or delete immediately. Recommend delete immediately since this is a single-user app.

---

## Phased Migration Plan

All phases execute **after Line Study closes** (Phase 6 of line-study). Do not start Phase 1 while LS is active — scaffolding the new container changes the file LS is actively editing (`PostflopDrillsView.jsx`).

### Phase 0 — Decision & Approval
**Trigger:** Line Study Phase 6 closes OR owner explicitly approves mid-flight.
**Deliverable:** Owner reviews this doc, resolves the 6 open questions, approves phase sequencing. No code.

### Phase 1 — Shell Scaffold (dark-merge)
**Goal:** New `StudyView` exists, routes wired, but entry point still points to old views.
- Create `src/components/views/StudyView/StudyView.jsx` with 5-tab chrome (Learn / Explore / Drill / Line Study / Browse), each rendering a "migration pending" placeholder.
- Add `SCREEN.STUDY = 'study'` to `uiConstants.js`; keep old constants.
- Add hidden dev-only route access so the owner can preview the shell.
- Tests: chrome renders, tab switching works, 1600×720 layout clean.
- **Files:** `StudyView.jsx` (new), `uiConstants.js` (edit).
- **Visual verification:** dev server, hidden dev route, confirm 5 tabs render.

### Phase 2 — Explore Tab (thinnest risk)
**Goal:** Port Explore because both sides have clean two-pane UIs and no persistence to worry about.
- Create `StudyView/ExploreTab.jsx` with street toggle.
- Import existing `PreflopDrillsView/ExplorerMode` and `PostflopDrillsView/ExplorerMode` unchanged.
- No new tests — existing behavior unchanged, just re-hosted.
- **Files:** `ExploreTab.jsx` (new).
- **Visual verification:** toggle between streets, confirm both Explorers work identically to today.

### Phase 3 — Drill Tab
**Goal:** Unified Drill picker + hosts for all 5 drill modes.
- Create `StudyView/DrillTab.jsx` with drill-picker grid (card per drill with streak stat).
- Host: Recipe, Preflop Estimate, Preflop Framework, Postflop Estimate, Postflop Framework — all unchanged, just re-parented.
- Cross-drill recent-activity summary at top of picker.
- Tests: picker renders 5 cards with correct streaks, click-through routes to the right mode.
- **Files:** `DrillTab.jsx`, `DrillPickerCard.jsx` (new).
- **Visual verification:** each of 5 drills reachable, grading works end-to-end for each.

### Phase 4 — Learn Tab
**Goal:** Unified Learn surface with Lessons + Shape catalog + Calculators.
- Create `StudyView/LearnTab.jsx` with left rail = unified index, filters (street, type).
- Host: Preflop Lessons, Postflop Lessons, Shape, Math (renamed Calculators).
- Unified search box across all Learn content.
- Tests: index filters correctly, every lesson/catalog/calculator still reaches its detail view.
- **Files:** `LearnTab.jsx`, `LearnIndex.jsx` (new).
- **Visual verification:** search + filter work, every piece of content from old Lessons/Shape/Math pages reachable.

### Phase 5 — Line Study Tab (cheapest)
**Goal:** Move LineMode up a level.
- Create `StudyView/LineStudyTab.jsx` that hosts the existing `LineMode.jsx` unchanged.
- Tests: unchanged — LineMode owns its own tests.
- **Files:** `LineStudyTab.jsx` (new, 1-line wrapper).

### Phase 6 — Browse Tab
**Goal:** Unified Library (preflop matchups + postflop scenarios) with street filter.
- Create `StudyView/BrowseTab.jsx` with unified card grid.
- Host: both Library modes, unified filter chips.
- Tests: both streets reachable, filter combinations correct, every old Library entry still opens.
- **Files:** `BrowseTab.jsx`, `BrowseIndex.jsx` (new).
- **Visual verification:** every matchup and scenario from old Libraries reachable.

### Phase 7 — Cutover & Cleanup
**Goal:** Flip entry point, delete old views.
- `SessionsView`: replace two buttons with one "Study" button.
- Delete `PreflopDrillsView.jsx`, `PostflopDrillsView.jsx`, `SCREEN.PREFLOP_DRILLS`, `SCREEN.POSTFLOP_DRILLS`.
- Delete old view directory scaffolds; move orphaned Mode components (which are now only imported by StudyView tabs) into sensible StudyView sub-folders.
- Update `SYSTEM_MODEL.md` §1 component map; `v122` → `v123+1` bump.
- Update STATUS.md, BACKLOG.md, CLAUDE.md (if any references).
- Final test suite: ~5,760 → ~5,760 (no net test change — migration is structural).
- **Visual verification:** every single drill, lesson, library entry, calculator, line, and shape reachable from new shell; old routes 404 or auto-redirect.

### Total size estimate
- **~10 new files** (1 container + 5 tabs + ~4 small index/picker components)
- **~2 deleted files** (old view scaffolds)
- **~14 moved files** (Mode components re-parented, zero internal changes)
- **Tests:** net-zero (migration is structural, existing tests continue to cover Mode behavior)
- **Rough effort:** 2–3 focused sessions, or one long session + polish pass

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Active Line Study work conflicts with PostflopDrillsView edits | High if started now | Gate Phase 1 on LS closure. |
| Persistence assumptions break when Mode components move folders | Low | Modes don't import from their parent; re-parenting is safe. Verify with grep before each phase. |
| Unified Lessons search degrades performance | Low | Lessons are small (< 20 pages total); linear search is fine. |
| Regression in a specific drill's grading flow | Medium | Each drill re-parented in a separate phase; visual + persistence verification after each. |
| Owner dislikes new IA after seeing it | Medium | Phase 1 ships a hidden preview route. Owner reviews before committing further phases. Phased structure means we can stop after any phase without breakage. |

---

## Files This Project Would Touch

### New
- `src/components/views/StudyView/StudyView.jsx`
- `src/components/views/StudyView/LearnTab.jsx`
- `src/components/views/StudyView/ExploreTab.jsx`
- `src/components/views/StudyView/DrillTab.jsx`
- `src/components/views/StudyView/LineStudyTab.jsx`
- `src/components/views/StudyView/BrowseTab.jsx`
- `src/components/views/StudyView/LearnIndex.jsx`
- `src/components/views/StudyView/BrowseIndex.jsx`
- `src/components/views/StudyView/DrillPickerCard.jsx`

### Edited
- `src/components/views/SessionsView/SessionsView.jsx` (button consolidation, final phase)
- `src/constants/uiConstants.js` (add STUDY, eventually remove PREFLOP_DRILLS/POSTFLOP_DRILLS)
- `src/components/views/ViewRouter.jsx` (route wiring — not yet verified, check during Phase 1)
- `SYSTEM_MODEL.md` (architecture component map, final phase)
- `CLAUDE.md` (version bump + surface rename, final phase)

### Deleted (Phase 7)
- `src/components/views/PreflopDrillsView/PreflopDrillsView.jsx` (container)
- `src/components/views/PostflopDrillsView/PostflopDrillsView.jsx` (container)

### Moved (Phase 7, no internal changes)
- All current Mode components migrate into `StudyView/` sub-folders keyed by job bucket, not street.

---

## Explicitly Out of Scope

- Redesigning the internals of any individual drill or lesson
- Adding new drill types or question generators
- Changing persistence schemas
- Changing the shapes catalog, frameworks catalog, or scenario library
- Merging Recipe and Estimate into one drill
- Any visual redesign beyond what the new nav shell requires
- Multiway line content (that lives in Line Study phases 5–6)

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-20 | Sequence after Line Study closes | Restructuring the container mid-flight would churn LS without benefit. Migration is reversible; half-shipped LS isn't. |
| 2026-04-20 | Job-based nav, not street-based | JTBD analysis: 5 jobs × 2 streets = cleaner than 2 streets × 7 modes. Discovery follows intent, not material. |
| 2026-04-20 | Shell restructure only; no Mode internal changes | Maximum user value at minimum risk. Each Mode is already battle-tested. |
| 2026-04-20 | Single "Study" entry point | Two buttons on SessionsView for a single-user app is clutter. |
