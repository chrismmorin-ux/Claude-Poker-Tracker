# Gate 1 Entry — 2026-04-26 — Table-Build Surface

**Feature working name:** Table-Build Surface
**Proposed by:** Chris (owner) — 2026-04-26 conversation: *"we need to improve our players and players search. Ideally they embed into the same thing, and get its own layout. It currently is badly optimized for landscape view, and it's more a disconnected button list than a good method to enter/search. The text entry also perverts the screen and you have to do it blind."*
**Gate:** 1 (Entry) — mandatory
**Next gate:** 2 (Blind-Spot Roundtable) — required per verdict below
**Status:** OPEN — this document is the Gate 1 artifact; no code written.

---

## Feature summary (as proposed)

A new "Table-Build" surface that absorbs the create-from-query path of `PlayerEditorView`, the search/match path of `PlayerPickerView`, and the seat-fill loop of `PlayersView`'s assignment grid into **one landscape-optimized screen**. The user types a name fragment, picks features, types ethnicity tags — and the candidate list narrows live, in place, without occlusion by the virtual keyboard. "Create new" is a continuation past zero matches on the same screen, not a separate route.

Three load-bearing additions to the data model and ranking system make the surface coherent rather than cosmetic:

1. **Per-feature stability flags** — every visual feature carries `always` / `today` / `unknown`, with smart defaults per feature/sub-type. Search ranking weights `always` features highest, `today` features lowest. A new beard or new haircut does not displace a partial-name + stable-feature match from the top of the candidate list.
2. **Ethnicity as expanding tag array** — replaces the current fixed enum with a free-text input + curated autocomplete (Irish, Serbian, Punjabi, Greek, etc.). Stored as `string[]`. Abbreviations rendered where intuitive.
3. **Clothing as per-seat-per-session observation** — vest, chain, jersey, today's hat live on the seat-observation, not the player record. Promotes to a sticky `always` feature after repeat-observation across sessions.

Plus one safety mechanism:

4. **Possible-matches panel before save** — when stable-feature + partial-name overlap with an existing record crosses threshold, candidates surface above the save button. Tap → side-by-side compare → manual merge into the existing record (stats + range profile + hand history preserved). No silent auto-merge.

Owner intent: *"sitting down at a new table for the first time, maybe recognizing some players. He must be able to gracefully start entering features... A new beard or haircut shouldn't stop 'John W' from jumping to the top of the list, given partial name match and skin/hair match."*

---

## Critical scope-shifting discoveries

Three realities shape what "table-build" means today.

### Discovery 1 — Three existing surfaces overlap; this is not greenfield

`docs/design/surfaces/player-picker.md`, `player-editor.md`, and `players-view.md` are all in production. They were authored separately in DCOMP Wave 0–4 and serve overlapping JTBDs (PM-02, PM-03, PM-05, PM-09 appear across all three). Table-build is not adding a fourth surface from scratch — it is **rebuilding the entry/search/create loop** on top of (or replacing) the picker + the create-from-query half of the editor + the assignment-grid half of `PlayersView`.

**Implication:** the surface artifact resulting from Gate 4 must explicitly resolve which existing surfaces table-build supersedes vs. coexists with. Editor (edit-existing path) and `PlayersView` (database browser, post-session edits, bulk operations) have legitimate independent uses; picker and create-from-query do not — they should fold into table-build.

### Discovery 2 — DCOMP-W4-A1 already documents the landscape pain at this surface

The 2026-04-22 audit on `players-view` returned a RED verdict with 4 P0 destructive-action issues plus F8 confirming the filter row consumes 209px / **29% of the 1600×720 reference viewport** before any list content appears. The picker side is similar — filter chips are smaller but still consume a meaningful header band, and the keyboard occlusion the owner describes ("the text entry also perverts the screen and you have to do it blind") is a structural property of stacking input above results in landscape.

**Implication:** DCOMP-W4-A1's P0 fixes (toast+undo on Clear All Seats, deferred-delete on Delete Player, toast+undo on per-seat Clear) **should not block** table-build, but **should not be wasted** either. If table-build replaces `PlayersView`'s seat-fill grid entirely, F1/F3 become moot in the new surface — their fixes still need to land in the surviving database-browser surface, but the design effort spent on them shouldn't be duplicated. Coordination with the DCOMP-W4-A1 backlog items is required.

### Discovery 3 — Schema impact is non-trivial; three new data shapes

- **Stability flags** add a sub-property to every feature in `avatarFeatures`. Schema delta: `{ skin: { id: 'medium', stability: 'always' }, hair: { styleId: 'short-curly', styleStability: 'always', colorId: 'brown', colorStability: 'always' }, ... }` instead of the current flat `{ skin: 'medium', hair: 'short-curly', ... }`. IDB migration required; legacy records assumed `stability: 'always'` on read.
- **Ethnicity tag array** replaces `ethnicity: string` with `ethnicityTags: string[]`. Migration: split the existing single-value enum into a one-element array. Curated suggestion list lives in a new constant module.
- **Clothing-as-seat-observation** is a new entity. Best modeled as a per-seat-per-session record on the seat-assignment, not on the player. The Exploit Anchor Library's `anchorObservation` infrastructure (Phase 6 B3 — recently completed per memory) is conceptually analogous: a per-hand observation that may promote to a sticky annotation after repeat-occurrence. Worth examining whether the same store/wrappers can be reused, or whether a parallel `seatClothingObservations` store is cleaner.

**Implication:** Gate 4 must produce a schema-delta document alongside the surface artifact. IDB migration is a v14+ bump. Fresh test coverage required for migration + ranking algorithm.

### Discovery 4 — Search ranking is the load-bearing algorithm, not the layout

The owner's pain point ("a new beard or haircut shouldn't stop 'John W' from jumping to the top of the list") is fundamentally a ranking problem, not a layout problem. The current `scorePlayerMatch` (per `surfaces/player-picker.md` "Known behavior notes") is opaque to the user and does not distinguish stable features from ephemeral ones. Even a perfectly-laid-out screen with the wrong ranker fails the persona.

**Implication:** Gate 4 design effort must include ranking-algorithm specification, not just layout specification. A worked example with 5–10 sample queries against a sample player database, showing expected top-3 candidates per query, belongs in the spec.

### Discovery 5 — Avatar features are blank on every seeded player

DCOMP-W4-A1 F13: every seed player renders the "S" monogram because seed data doesn't populate `avatarFeatures`. This means the visual-recognition channel that table-build is fundamentally about has **never actually been exercised in dev** for the existing surfaces. Any user testing of table-build on dev seed data without the F13 fix will be misleading — the candidate list will look empty-of-features regardless of how good the ranking is.

**Implication:** F13 (seed avatarFeatures) is a Phase 0 prerequisite for table-build's design verification. Cheap to fix; blocks meaningful Playwright walks.

---

## Output 1 — Scope classification

**Primary classification:** **Cross-surface journey change + surface addition.**

- **Cross-surface:** absorbs/replaces functionality currently spread across three surfaces (picker, editor's create path, players-view's assignment grid).
- **Surface addition:** the unified Table-Build surface itself is new.

**Secondary classification considerations:**

- **New interaction patterns:** stability-flag overrides, expanding ethnicity tag input, possible-matches-merge UI — none of these exist anywhere in the codebase. Per LIFECYCLE table, this triggers Gate 2 even ignoring the persona discovery.
- **Schema impact:** stability flags + ethnicity tag array + clothing-as-seat-observation. IDB v14+ migration. Migration tests required.
- **Cross-surface ripples:** SeatContextMenu's "Find Player" / "Create New Player" entries need rerouting; PlayerPickerView's `BatchSeatRibbon` pattern carries forward but in a redesigned shell; PlayerEditorView's edit-existing path remains separately routable.
- **Persona-stress:** primary persona (Cold-Read Chris) does not exist in the current cast — this is a new situational persona authored alongside this Gate 1 doc.

**Drills Consolidation HOLD:** not applicable. This is the player-management domain, not study/drills.

---

## Output 2 — Personas identified

### In scope

| Persona | Role | Core/Situational | Status |
|---|---|---|---|
| [Chris (owner)](../personas/core/chris-live-player.md) | Primary user | Core | Existing |
| [Cold-Read Chris](../personas/situational/cold-read-chris.md) | Sitting at a new table, populating seats himself | Situational — primary | **New (this session)** |
| [Seat-Swap Chris](../personas/situational/seat-swap-chris.md) | Mid-session reassignment / single-seat swap | Situational — secondary | Existing |
| [Between-Hands Chris](../personas/situational/between-hands-chris.md) | Follow-up edits on a player just created | Situational — secondary | Existing |
| [Ringmaster](../personas/core/ringmaster-home-host.md) | Home-game host, similar batch-assign pattern with regular-heavy database | Core | Existing |
| [Post-Session Chris](../personas/situational/post-session-chris.md) | Post-session cleanup of records created in haste | Situational — tertiary | Existing |

### Out of scope (explicitly excluded)

- [Mid-Hand Chris](../personas/situational/mid-hand-chris.md) — Table-Build is not a live-decision surface.
- [Newcomer](../personas/core/newcomer.md) — Cold-Read assumes an established workflow.
- All study / drill personas — wrong domain.

### Persona-sufficiency check

> *"Does our current cast actually cover this feature, or do we need a new persona?"*

**Answer: 🔴 RED — Cold-Read Chris is a new situational persona that did not exist before this session.**

The closest existing personas are Seat-Swap Chris (single-seat post-arrival/departure) and Between-Hands Chris (10-second window). Neither covers the **5–15-minute, multi-seat, mixed match-or-create, two-handed window at session start.** Ringmaster has a related pattern but a fundamentally different database shape (regulars dominate; creates are rare).

The new persona has been authored alongside this Gate 1 doc at `personas/situational/cold-read-chris.md`. Gate 2 must validate the persona, particularly the **stability-flag default table** (load-bearing for ranking) and the **clothing-promotion rule** (today→always after ≥2 sessions).

---

## Output 3 — JTBD identified

### Already served (existing surfaces; will be re-served by Table-Build)

- **JTBD-PM-02** assign a known player to a seat
- **JTBD-PM-03** create a new player and assign to seat
- **JTBD-PM-05** batch-assign players to seats at session start
- **JTBD-PM-06** retroactively link prior hands to a new player
- **JTBD-PM-09** find a player by visual features

### Proposed (new — flagged for Gate 3 authoring if Gate 2 confirms)

1. **JTBD-PM-10 (proposed)** — *Cold-read a table at session start with mixed match-or-create flow*

   > When I sit down at a new table and need to populate 5–8 seats over 5–15 minutes, with some faces I half-recognize and most I'm seeing for the first time, I want a single landscape-optimized surface where I can fluidly match recognized players, create new ones, and capture stable + ephemeral features per seat — without context-switching between picker, editor, and database views.

   - Personas: Chris, Cold-Read Chris (primary), Ringmaster (secondary).
   - Distinct from PM-05 (batch-assign) which is the umbrella job; PM-10 specifies the **mixed-mode** sub-job and the unified-surface constraint.

2. **JTBD-PM-11 (proposed)** — *Detect potential duplicates on save and offer manual merge*

   > When I'm about to save a new player whose stable features and partial name overlap with an existing record above some threshold, I want the surface to surface those candidates with a side-by-side compare and a manual-merge action that preserves stats, range profile, and hand history of the surviving record — so I don't silently create a duplicate I'll have to clean up later.

   - Personas: Chris, Cold-Read Chris (primary), Post-Session Chris (secondary — for cleanup of pre-merge duplicates).
   - Distinct from the existing in-line duplicate-name warning in `PlayerEditorView` (`NameSection`), which fires on name only and does not offer merge. PM-11 fires on stable-feature-plus-name composite score AND offers stat-preserving merge.

3. **JTBD-PM-12 (proposed)** — *Capture today-only observations (clothing, today's hat, sunglasses) without polluting the player record*

   > When I want to note that a player is wearing a vest today, or has a sunglasses-on-today read, I want those observations to live on the per-seat-per-session record — visible during this session for recognition, decaying or re-prompting at session end so they don't permanently distort the player's stable feature record.

   - Personas: Chris, Cold-Read Chris (primary), Seat-Swap Chris (secondary — same observation pattern on mid-session arrivals).
   - Architectural reuse candidate: Exploit Anchor Library's `anchorObservation` infrastructure (Phase 6 B3) is conceptually analogous (per-hand observation, may promote to sticky annotation after repeat-occurrence). Worth evaluating whether to reuse the store/wrapper pattern or author a parallel `seatClothingObservations` store.

### JTBD-coverage check

> *"Does any proposed outcome not map to an existing JTBD?"*

**Answer: 🟡 YELLOW — 3 proposed additions to `player-management.md`. None requires a new domain.**

PM-10 is the umbrella for the persona-action; PM-11 and PM-12 are surface-agnostic enough that they could also serve a future redesigned Seat-Swap flow. None forces a new domain file.

---

## Output 4 — Gap analysis verdict

| Dimension | Verdict | Notes |
|---|---|---|
| Personas | 🔴 **RED** | Cold-Read Chris is a new situational persona; authored alongside this doc but pending Gate 2 validation |
| JTBD | 🟡 YELLOW | 3 proposed additions to `player-management.md` (PM-10/11/12). No new domain. |
| Interaction pattern | 🟡 YELLOW | Stability-flag swatch overrides + expanding ethnicity tag input + possible-matches-merge UI are all new patterns |
| Surface structure | 🟡 YELLOW | Cross-surface journey change: absorbs/replaces picker + create-from-query path + assignment grid. Resolution of which surfaces remain independent is a Gate 4 deliverable. |
| Schema | 🔴 **RED** | Stability flags on every feature + ethnicity tag array + clothing-as-seat-observation. IDB v14+ migration. Three new data shapes. |
| Search ranking | 🟡 YELLOW | Stable-vs-ephemeral weighted ranking is a new algorithm, not a layout change. Worked-example specification required at Gate 4. |
| Cross-surface ripples | 🟡 YELLOW | SeatContextMenu rerouting; PlayerEditorView edit-path retention; DCOMP-W4-A1 P0 fixes coordination |
| DCOMP coordination | 🟡 YELLOW | Avoid duplicating effort with DCOMP-W4-A1 F1/F3 if their target surfaces are absorbed by Table-Build |
| Dev-data prerequisite | 🟡 YELLOW | DCOMP-W4-A1 F13 (seed avatarFeatures) is a Phase 0 prerequisite for meaningful Playwright walks |

### Overall Gate 1 verdict: 🔴 **RED**

Two RED dimensions (new persona, schema delta) plus six YELLOW dimensions. Gate 2 (Blind-Spot Roundtable) is **required**. Gate 3 (Research) likely required to:

- formally author Cold-Read Chris into the persona library (already drafted; needs roundtable validation)
- author PM-10/11/12 as `Proposed` JTBDs in `player-management.md`
- specify schema-delta + migration plan
- specify ranking algorithm with worked examples

---

## Recommended Gate 2 (Blind-Spot Roundtable) scope

Five stages to run as one session, ideally before any spec is written.

- **Stage A — Persona sufficiency.** Validate Cold-Read Chris as authored. Specifically: is the time budget (5–15 min) right? Is the stability-flag default table calibrated correctly? Should Ringmaster share Table-Build or get a fast-path variant? Is Newcomer's first cold-read meaningfully different from Cold-Read Chris's, or covered?
- **Stage B — JTBD coverage.** Validate PM-10/11/12 framings. Particularly: does PM-12 belong here, or is it actually an Exploit-Anchor-Library extension? Is PM-11's "manual merge" the right product call, or should there be a tier of severity (auto-merge for high-confidence, prompt for medium, ignore for low)?
- **Stage C — Situational stress.** Walk Cold-Read Chris through the surface in three variants: (1) new venue, all 7 seats are creates; (2) familiar venue, 4 matches + 3 creates; (3) mid-session arrival of a new player while another seat just departed (handoff between Cold-Read and Seat-Swap). Where do cognitive load + landscape constraint + virtual-keyboard occlusion interact?
- **Stage D — Cross-surface / cross-system.**
  - Schema migration: IDB v14 bump compatibility with EAL Phase 6 (currently active per memory). Does Table-Build's migration interleave cleanly with EAL's planned IDB work?
  - SeatContextMenu rerouting: do "Find Player" + "Create New Player" entries collapse to a single "Open Table-Build" entry? Or keep separate intents?
  - PlayersView future: if its assignment-grid is absorbed, what survives — database browser only, or also the bulk-edit/delete operations the DCOMP audit P2/P3 findings deferred?
  - DCOMP-W4-A1 backlog coordination: do F1/F3 ship to the surviving `PlayersView` shell even though Table-Build supersedes the use case?
- **Stage E — Heuristic pre-check.**
  - **Nielsen's "match between system and real world":** stability flags use vocabulary the user actually thinks in (always/today/unknown). Verify with the persona that this maps to mental model.
  - **Mobile-Landscape ML06:** 44px touch targets on every stability-flag override control + tag input + merge-action button.
  - **Poker-Live-Table:** none of Table-Build is mid-hand; PLT heuristics on glanceability are weaker constraints here, but the surface should still respect "no destructive action without undo" (merge is a destructive-by-omission action — undoing a merge needs to be possible).
  - **9 red lines (autonomy):** stability flags inferred from observation must be **user-overridable, not silently re-inferred** if the user demotes a feature from `always` to `today`. This is red line #3 (durable overrides) applied to feature-stability inference.

---

## Required follow-ups (blocking Gate 4)

- [ ] **Gate 2 — Blind-Spot Roundtable** — author at `audits/2026-04-XX-blindspot-table-build.md` covering all five stages above. Verdict drives Gate 3 scope.
- [ ] **Gate 3 — Research (conditional on Gate 2 verdict)** — likely required given two RED dimensions:
  - Author PM-10/11/12 as `Proposed` in `jtbd/domains/player-management.md`.
  - Validate stability-flag default table by walking the persona through 10 sample players.
  - Examine EAL's `anchorObservation` infrastructure for clothing-observation reuse vs. parallel-store decision.
  - Define duplicate-detection threshold formula (stable-feature score × name-prefix score weighting).
- [ ] **Gate 4 — Design** — surface artifact at `surfaces/table-build.md` (new) + updates to `surfaces/player-picker.md`, `player-editor.md`, `players-view.md` documenting absorption/coexistence. Schema delta document. Ranking algorithm spec with worked examples. Layout spec resolving keyboard-occlusion (likely 3-column landscape: features-left / input+candidates-center / preview+actions-right, with virtual-keyboard rising to cover the bottom strip without occluding center column).
- [ ] **Phase 0 prerequisite (engineering, post-Gate 4):** DCOMP-W4-A1 F13 — seed `avatarFeatures` in dev data so visual-recognition channel can be tested.
- [ ] **DCOMP-W4-A1 coordination decision:** confirm whether F1/F3 still ship to surviving `PlayersView` (database browser shell) or are obviated by Table-Build's superseding the assignment-grid use case.

---

## Open questions for owner (before Gate 2)

1. **Surface-survival decision.** Of `PlayerPickerView`, `PlayerEditorView`, `PlayersView`, which **fully absorb** into Table-Build vs. **survive** as independent surfaces? Recommended split:
   - **Absorb:** PlayerPickerView (entire), PlayerEditorView's create-from-query path, PlayersView's seat-assignment grid.
   - **Survive:** PlayerEditorView (edit-existing-record path, opened from PlayersView row), PlayersView (database browser + bulk operations only).
   Confirm or amend.

2. **Ringmaster fast-path.** Ringmaster's batch-assign at home games is regular-heavy (matching dominates). Should Table-Build expose a "matches-only" mode that hides feature-creation chrome until the user types past zero matches, or treat Ringmaster and Cold-Read identically?

3. **Stability inference rule.** A feature observed across N consecutive sessions auto-promotes from `today` to `always`. What is N? Default proposal: **2 sessions** (matches your earlier "this guy always wears the chain" heuristic). Or do you want the promotion to require manual confirmation?

4. **Today-feature lifetime at session end.** When a session ends, what happens to `today` features captured during it?
   - (a) Silently clear at session-end.
   - (b) Surface a Post-Session-Chris review prompt: "3 today-features observed — promote, demote, or discard."
   - (c) Auto-promote to `unknown` (neither stable nor ephemeral); user can resolve later in Post-Session-Chris flow.

5. **Duplicate-detection threshold.** Where on the spectrum should the "Possible matches" panel fire?
   - **Aggressive:** any stable-feature overlap fires; high noise but catches more duplicates.
   - **Calibrated:** weighted score (stable-feature × name-prefix × ethnicity-overlap) crosses configurable threshold.
   - **Conservative:** name-prefix match required + ≥2 stable feature matches; minimal noise but more silent duplicates pass through.
   Recommendation: Calibrated, with the threshold itself a Gate 3 research deliverable (walk persona through 20 sample saves, tune to balance false-positive vs false-negative).

6. **Clothing-observation architectural reuse.** EAL's `anchorObservation` infrastructure (Phase 6 B3, recently completed) is conceptually analogous to per-seat clothing observations. Two paths:
   - (a) **Reuse:** extend EAL's stores to support a "clothing" anchor type. Lower schema cost; couples player-management to EAL.
   - (b) **Parallel:** new `seatClothingObservations` store mirroring EAL's pattern. Higher schema cost; cleaner domain separation.
   Owner preference?

7. **Ethnicity curated suggestion list.** Who curates the autocomplete list, and at what granularity? Initial recommendation: ~50 entries covering major regional/national/cultural tags Chris is likely to encounter at the venue. Owner-editable. Confirm — or do you want the list to seed from Chris's existing ethnicity-enum values plus a starter set?

8. **Mobile-portrait scope.** Table-Build is fundamentally a 1600×720 landscape surface (Cold-Read Chris is at the table). Is mobile-portrait a v1 requirement, or landscape-only acceptable for v1?

---

## Links

- Feature lifecycle: [`docs/design/LIFECYCLE.md`](../LIFECYCLE.md)
- Methodology: [`docs/design/METHODOLOGY.md`](../METHODOLOGY.md)
- Roundtable template: [`docs/design/ROUNDTABLES.md`](../ROUNDTABLES.md)
- New situational persona authored alongside this doc: [`personas/situational/cold-read-chris.md`](../personas/situational/cold-read-chris.md)
- Existing surfaces affected:
  - [`surfaces/player-picker.md`](../surfaces/player-picker.md)
  - [`surfaces/player-editor.md`](../surfaces/player-editor.md)
  - [`surfaces/players-view.md`](../surfaces/players-view.md)
  - [`surfaces/seat-context-menu.md`](../surfaces/seat-context-menu.md)
- Prior audit on absorbed surface: [`audits/2026-04-22-players-view.md`](./2026-04-22-players-view.md) — DCOMP-W4-A1 RED verdict; F8 confirms 29% landscape filter-row consumption
- JTBD domain affected: [`jtbd/domains/player-management.md`](../jtbd/domains/player-management.md)
- Reference for clothing-observation reuse evaluation: `docs/projects/exploit-anchor-library.project.md` (Phase 6 B3 architecture)

---

## Change log

- 2026-04-26 — Created. Authored from owner conversation 2026-04-26. Verdict RED — new persona (Cold-Read Chris) + RED schema dimension (stability flags + ethnicity tag array + clothing-as-seat-observation) trigger Gate 2 + likely Gate 3. Cold-Read Chris persona authored alongside this doc as Gate 1 input.
