# Blind-Spot Roundtable — 2026-04-26 — Table-Build Surface

**Type:** Gate 2 Blind-Spot audit (design lifecycle per `docs/design/LIFECYCLE.md`)
**Trigger:** Gate 1 verdict **🔴 RED** (see [`audits/2026-04-26-entry-table-build.md`](./2026-04-26-entry-table-build.md)) — new situational persona (Cold-Read Chris) + 3 new data shapes (stability flags + ethnicity tag array + clothing-as-seat-observation) + cross-surface journey absorbing picker + create-from-query path + assignment grid.
**Voices:**
- **Product/UX** (lead, Stages A/C/E)
- **Autonomy skeptic** (Stages A/B/E — red-line check on stability inference + duplicate-detection scoring)
- **Senior engineer** (Stage D + schema migration / ranking / DCOMP coordination / test churn)
- **Failure engineer** (Stage C/D — interruption survival, merge edge cases, infer-then-override loops)

**Artifacts read:**
- [`audits/2026-04-26-entry-table-build.md`](./2026-04-26-entry-table-build.md)
- [`personas/situational/cold-read-chris.md`](../personas/situational/cold-read-chris.md) (drafted alongside Gate 1)
- [`surfaces/player-picker.md`](../surfaces/player-picker.md), [`player-editor.md`](../surfaces/player-editor.md), [`players-view.md`](../surfaces/players-view.md), [`seat-context-menu.md`](../surfaces/seat-context-menu.md)
- [`audits/2026-04-22-players-view.md`](./2026-04-22-players-view.md) (DCOMP-W4-A1 RED)
- [`jtbd/domains/player-management.md`](../jtbd/domains/player-management.md) (PM-01..09 baseline)
- [`personas/core/chris-live-player.md`](../personas/core/chris-live-player.md) (autonomy red lines #1–#9)
- `src/utils/persistence/database.js` (current IDB v21; 5 EAL stores in v19; 2 PRF stores in v20)
- Memory: EAL Phase 6 B3 status (anchorObservations + anchorObservationDrafts + perceptionPrimitives stores live)

**Status:** Draft — pending owner ratification.

---

## Executive summary

**Verdict: 🟡 YELLOW.** The Gate 1 RED was driven by two structural gaps (new persona, new data shapes); both are tractable through Gate 3 + Gate 4 work without a fundamental rethink. But four roundtable findings shift the design before Gate 4 starts:

1. **Autonomy red-line #3 applies to feature-stability inference.** Auto-promoting a `today` feature to `always` after N sessions is the system forming a durable opinion about a villain. User-overridden stability flags must be **sticky against re-inference** — same sticky-override pattern as the EAL Phase 6 anchor lifecycle.
2. **Duplicate-detection scoring is opaque inference; merge UI must show evidence, not confidence.** A "85% match" number is the wrong primitive. The Possible-Matches panel must render the *specific overlapping features* (name prefix matched, ethnicity matched, skin+hair stable-feature matched) so Chris can verify, not trust.
3. **Schema migration is v22, not v14.** Gate 1 was written from a stale baseline (CLAUDE.md said v13; actual is v21 — EAL Phase 6 added 5 stores at v19, PRF Phase 5 added 2 at v20, telemetry-consent at v21). Migration interleave with EAL is real and load-bearing for Gate 4.
4. **DCOMP-W4-A1 in-flight backlog must be re-scoped, not just "coordinated."** F1 (Clear All Seats) and F3 (per-seat Clear) target the seat-assignment grid that Table-Build absorbs; shipping them before Table-Build = wasted work. F2 (Delete Player), F5 (row actions), F6 (seat Clear touch target on the grid), F7 (Clear All Seats height), F8 (filter persist) split: F2 + F5 + F8 ship to surviving database-browser shell; F1 + F3 + F6 + F7 are obviated.

Plus three smaller findings:
5. Newcomer first-session is also a Cold-Read situation — concept-load of stability flags will overwhelm. Smart defaults + progressive disclosure required.
6. Mid-build interruption (phone sleep, dealer pitches early, urgent seat-swap) must preserve the entire table-build state, not just the in-flight player draft.
7. Online HUD does NOT need a Table-Build counterpart (online seats auto-populate from WebSocket capture); cross-product scope is correctly main-app-only.

Gate 3 is **conditionally required** — narrow scope (3 JTBDs to author + persona ratification + 1 schema-delta document + 1 ranking-algorithm spec). Not the full 6-item scope of Shape Language.

---

## Feature summary

A new "Table-Build" surface absorbing the search/match path of `PlayerPickerView`, the create-from-query path of `PlayerEditorView`, and the seat-assignment grid of `PlayersView` into one landscape-optimized screen. Live candidate list always visible while the user types name fragment, picks features, or types ethnicity tags. "Create new" is a continuation past zero matches on the same screen. Three new data shapes — per-feature stability flags (`always` / `today` / `unknown`), ethnicity tag arrays, clothing-as-seat-observation — re-shape the underlying ranking algorithm so a new beard or new haircut does not displace partial-name + stable-feature matches. Possible-Matches panel before save offers manual merge with stat preservation. Cold-Read Chris (new situational persona, drafted alongside Gate 1) is the primary user.

---

## Stage A — Persona sufficiency

**Output: ⚠️ Patch needed (Cold-Read Chris drafted; 2 amendments + 1 cross-check pending).**

### Findings

**Cold-Read Chris is the right primary persona.** The 5–15-minute, multi-seat, mixed match-or-create, two-handed window at session start is genuinely distinct from Seat-Swap (10–60s) and Between-Hands (30–90s). The drafted persona at `cold-read-chris.md` covers it. (Product/UX)

**Newcomer first-session is also a Cold-Read.** A first-time-app-user at any table is by definition Cold-Read Chris on every seat — but with **zero player database**, **no developed observation vocabulary**, and **no familiarity with the stability-flag concept**. The stability-flag swatch UI as drafted will overwhelm. Two paths: (a) hide stability-override controls behind a "more options" affordance until user has saved ≥1 player; (b) accept the cost and rely on smart defaults to make the first session usable without overrides. Recommend (a). (Product/UX + Failure engineer)

**Ringmaster fast-path is a real concern.** Ringmaster's home-game database is regular-heavy; matches dominate, creates are rare. The drafted Cold-Read surface exposes feature-creation chrome (full AvatarFeatureBuilder visible by default) before the user has typed past zero matches. For Ringmaster, this is wasted screen real estate. Recommendation: **single surface, adaptive layout** — feature-creation chrome collapses to a slim header until the user explicitly enters create mode (by typing past zero matches OR tapping "create new") rather than two separate modes. (Product/UX)

**Owner-as-skeptic is the autonomy lens; no separate skeptic persona.** Same resolution as Shape Language and EAL — Chris is the skeptic. No new persona for autonomy. (Autonomy skeptic)

**No new core persona needed.** Cold-Read is situational, derived from core Chris. Ringmaster, Seat-Swap, Between-Hands, Post-Session all stay. (Product/UX)

### Cross-voice resolution

Three amendments before Gate 4:

1. **Persona ratification:** owner reads `cold-read-chris.md` end-to-end and confirms (or amends) the **stability-flag default table** + **clothing-promotion rule** + **time-budget assumptions**. These are load-bearing for ranking.
2. **Newcomer cross-check:** add a paragraph to `cold-read-chris.md` "Constraints" section noting that first-session-of-Newcomer is the worst-case ergonomics — feature-stability override controls must be progressively disclosed, not always visible.
3. **Ringmaster harmonization:** decide single-surface-adaptive vs. mode-toggle for Ringmaster fast-path. Recommend single-surface-adaptive (one design, one test surface, one mental model for Chris).

### Recommended follow-ups

- [ ] **Gate 3:** owner ratifies `cold-read-chris.md` defaults table + clothing-promotion rule.
- [ ] **Gate 3:** amend `cold-read-chris.md` with newcomer-cross-check paragraph.
- [ ] **Gate 4 constraint:** feature-creation chrome collapses to slim header until user enters create mode; full AvatarFeatureBuilder reveals on demand.
- [ ] **Explicit non-goal:** no separate "Ringmaster mode" toggle; surface is adaptive by default.

---

## Stage B — JTBD coverage

**Output: ⚠️ Expansion needed (3 JTBDs to add, 1 boundary question to resolve, 0 to retire).**

### Findings

**PM-10/11/12 as drafted are well-shaped, with one boundary concern.**

- **PM-10 (cold-read at session start, mixed match-or-create flow).** Add to `player-management.md`. Owns the umbrella of the surface. Distinct from PM-05 (batch-assign generic) by specifying the mixed-mode + unified-surface constraints. (Product/UX)
- **PM-11 (detect potential duplicates on save and offer manual merge).** Add. Owns the Possible-Matches panel. Highest autonomy-sensitivity of the three — requires explicit no-silent-auto-merge constraint. (Product/UX + Autonomy)
- **PM-12 (capture today-only observations without polluting the player record).** Add — but **boundary question:** does this belong in `player-management.md` or in EAL's domain?

**Boundary question on PM-12.** EAL's Phase 6 B3 layer just landed `anchorObservations` + `anchorObservationDrafts` + `perceptionPrimitives` stores. The conceptual pattern of "ephemeral per-instance observation that may promote to a sticky annotation after repeat-occurrence" is *exactly* the EAL pattern. Two paths:

- **(a) Reuse:** extend EAL's `anchorObservations` with a new `category: 'clothing'` discriminator. Lower schema cost (no new store, no v22 store-creation migration). Higher conceptual coupling (clothing-as-anchor-observation forces a question: is a vest a "perception primitive"? Probably no — it's a recognition-aid, not an exploit signal).
- **(b) Parallel:** new `seatClothingObservations` store with EAL-mirrored API (the same store/wrapper pattern Phase 6 B3 established). Higher schema cost. Cleaner domain separation — EAL is exploit-engine territory; clothing is player-recognition territory. They don't share semantics, only an architectural pattern.

**Senior engineer voice prefers (b).** Coupling player-management to EAL means an EAL schema change forces a player-management migration. They are independent product domains; couple architecturally (use the same store/wrapper *pattern*) but not via shared store. Confirm at Gate 3 with explicit cost-benefit.

**No JTBDs to retire.** PM-01..09 all continue to serve. PM-09 (find by visual features) is *re-implemented* by Table-Build but not retired — it lives on in the surviving `PlayersView` database browser too.

### Recommended follow-ups

- [ ] **Gate 3:** author PM-10/11/12 in `jtbd/domains/player-management.md` with personas, success criteria, failure modes, surfaces, related-JTBDs.
- [ ] **Gate 3 decision:** clothing-observation reuse vs. parallel store. Recommend parallel — confirm with senior-engineer cost analysis.
- [ ] **Gate 4 constraint:** PM-11 Possible-Matches panel never auto-merges. Always user-confirmed. Always shows the *evidence* for the proposed match (overlapping features), not just a confidence score.

---

## Stage C — Situational stress test

**Output: ⚠️ Targeted adjustments (5 specific situations need design constraints; no fundamental mismatches).**

### Findings — per situational persona × variant

**Cold-Read Chris × new venue (all 7 seats are creates).** Critical-path scenario. ~10 min budget. Feature-creation chrome must be one-tap-deep to first feature; AvatarFeatureBuilder full-form is unrealistic. **Need:** "save with 3+ stable features captured" as the green-light state for save-and-next; user can return Post-Session-Chris for depth. (Product/UX)

**Cold-Read Chris × familiar venue (4 matches + 3 creates).** Most common scenario. Match phase must be ≤30s per match; create phase tolerates ~60s. Surface must visibly distinguish match-success-with-undo from create-with-features-captured. (Product/UX)

**Cold-Read Chris × handoff to Seat-Swap mid-build.** Edge case: Chris is mid-build (3 of 7 seats filled) when seat 6 — already filled — has player leave + new player sit. Surface must allow Cold-Read flow to *yield* to Seat-Swap (seat-context-menu Clear/Find) without losing build state. **Specifically:** the in-flight player draft (per `usePlayerDraft` autosave) survives, AND any not-yet-saved seat-clothing-observations on already-built seats survive, AND the build-progress indicator ("seat 6 of 8 filled") updates correctly when seat 6 is force-cleared. (Failure engineer)

**Cold-Read Chris × phone-sleep mid-build.** Phone sleeps after 2 minutes. Chris has filled 4 seats with full avatar features, has 1 in-progress with name + skin + ethnicity captured but not saved, and 3 more to do. On wake: build state restores, in-flight draft restored (existing PEO-2 autosave), but is the *progress* (4 of 8) restored, or does Chris see a fresh-looking surface and think he has to start over? **Need:** explicit table-build state persistence, not just per-player-draft autosave. (Failure engineer)

**Cold-Read Chris × dealer pitches cards before build done.** Most common interruption. Dealer pitches at hand 1 with seats 5–7 unbuilt. Chris must abandon Table-Build and start logging hand 1 actions. **Need:** Table-Build state persists; can be re-entered post-hand to finish remaining seats with PEO-1 retro-link semantics intact. (Failure engineer)

**Cold-Read Chris × duplicate-merge mid-build.** Mid-build edge case. Chris is on seat 4, types "Mike", possible-matches panel surfaces "Mike R" (existing). Chris taps to compare, decides it's the same person, merges. Merge commits → seat 4 now assigned to existing Mike R → retro-link fires for any same-session prior hands attributed to seat 4 → undo toast appears. Build progress advances to seat 5. **Need:** merge UI does not unmount the Table-Build surface; merge confirmation lands as inline panel + advances the build, doesn't navigate away. (Product/UX + Failure engineer)

**Newcomer × first session.** Inherits all Cold-Read behaviors but with zero player database, zero observation vocabulary, no stability-flag familiarity. The drafted surface must hide stability-flag override chrome behind progressive disclosure for first ≥3 saved players. (Product/UX, picked up from Stage A finding)

**Mid-Hand Chris × Table-Build is excluded.** Surface is not reachable mid-hand. SeatContextMenu's "Find Player" / "Create New Player" entries route to Table-Build, but mid-hand the SeatContextMenu itself is the wrong UI — that's an existing constraint preserved. (Product/UX)

**Post-Session Chris × Table-Build review.** Post-session review of newly-created records uses the surviving `PlayerEditorView` (edit-existing path) and `PlayersView` (database browser). Table-Build is not re-entered post-session; today-features captured during session are reviewed via Post-Session-Chris flow if the rule from Gate 1 question 4 is option (b) (review prompt). (Product/UX)

### Recommended follow-ups

- [ ] **Gate 4 constraint:** "save with 3+ stable features captured" is the green-light save-and-next state.
- [ ] **Gate 4 constraint:** Table-Build state (build progress + per-seat clothing observations + in-flight draft) persists across phone sleep, mid-hand interruption, and Seat-Swap handoff.
- [ ] **Gate 4 constraint:** merge confirmation is inline-panel within Table-Build, never a navigate-away.
- [ ] **Gate 4 constraint:** stability-flag override controls progressively disclosed for first ≥3 saved players (Newcomer accommodation).
- [ ] **Gate 4 spec:** Table-Build state schema (separate from per-player draft) — what's persisted, where, eviction semantics.

---

## Stage D — Cross-product / cross-surface

**Output: ⚠️ Substantial — schema interleave with EAL/PRF + DCOMP-W4-A1 backlog re-scope + one cross-product confirmation.**

### Findings (Senior engineer + Product/UX)

**Schema migration is v22, not v14.** Gate 1 cited v14 from a stale CLAUDE.md baseline. Actual current state: IDB v21 (verified `src/utils/persistence/database.js:53`). EAL Phase 6 added 5 stores at v19. PRF Phase 5 added 2 stores at v20. Telemetry-consent at v21. Table-Build is v22+. **No conflict with EAL or PRF roadmap** (both are in stabilization, not adding stores). **Migration affects two existing data shapes:**

- **`players` store records:** `avatarFeatures` flat → versioned with stability flags. Migration: assume `stability: 'always'` on every legacy feature. Backwards-compat read path on legacy records returns flat-schema-equivalent.
- **`players` store records:** `ethnicity: string` → `ethnicityTags: string[]`. Migration: split single-value enum into one-element array; empty/null → empty array.
- **New store:** `seatClothingObservations` (parallel pattern to EAL `anchorObservations`, per Stage B finding). Indexed on `sessionId`, `seatNumber`, `playerId`.

**DCOMP-W4-A1 backlog re-scope is non-trivial.** The 2026-04-22 audit produced 8 findings across the three target surfaces. Table-Build absorption changes which findings are still load-bearing:

| Finding | Current target | Table-Build verdict | Action |
|---|---|---|---|
| F1 — Clear All Seats native confirm → toast+undo | PlayersView seat-grid | **Obviated** (grid absorbed) | **Pause**; re-evaluate post-Table-Build |
| F2 — Delete Player modal → deferred-delete | PlayersView (database browser) | **Survives** | **Ship** independently |
| F3 — Per-seat Clear silent commit → toast+undo | PlayersView seat-grid | **Obviated** | **Pause** |
| F5 — Row action targets (Range/Edit/Delete) | PlayersView database browser | **Survives** | **Ship** independently |
| F6 — Per-seat Clear touch target | PlayersView seat-grid | **Obviated** | **Pause** |
| F7 — Clear All Seats button height | PlayersView seat-grid | **Obviated** | **Pause** |
| F8 — Filter persist + collapse | PlayersView database browser | **Survives** | **Ship** independently (becomes Table-Build's filter design too) |
| F13 — Seed avatarFeatures (dev-ergonomics) | Dev seed data | **Phase 0 prerequisite for Table-Build** | **Ship first** — blocks Table-Build dev verification |

**Recommendation:** owner authorizes pause of F1/F3/F6/F7 pending Table-Build Gate 4 surface artifact. Ship F13 immediately as Phase 0. Ship F2/F5/F8 on independent schedule (they survive in either world). Document the pause in `.claude/BACKLOG.md` with Table-Build as the unblocking item.

**SeatContextMenu rerouting.** Current menu entries: "Find Player…" → PlayerPickerView; "Create New Player" → PlayerEditorView (create mode). Post-Table-Build: both collapse to "Open Table-Build" (single entry, with state of the menu's seat as `pickerContext.seat`). The existing seat-context-menu surface artifact needs Gate 4 update. (Product/UX)

**Online HUD parallel — not needed.** The Ignition extension auto-populates seats from WebSocket capture; online players have anonymous-username identifiers, not visual features. The Cold-Read pattern doesn't apply to online play. **Cross-product scope is correctly main-app-only.** No sidebar Table-Build counterpart. (Senior engineer + Product/UX)

**Existing PlayerEditor edit-existing path survives.** Opened from `PlayersView` row → "Edit". Same `usePlayerDraft` autosave semantics. Table-Build does not absorb this — Post-Session Chris's deep-edit JTBD is served by the existing editor. **No churn on the edit-existing path.** Test surface for `PlayerEditorView` "edit" mode preserved. (Senior engineer)

**Test churn estimate.** Table-Build absorbs: PlayerPickerView (`__tests__/*.test.jsx` — ~5 component test files); PlayerEditorView's create-from-query path (subset of `usePlayerEditor` hook tests + integration tests); PlayersView's seat-assignment grid + bulk-assign integration. Estimated: ~12-18 existing test files affected, of which ~6 fully replaced (picker + create-path), ~6 trimmed (editor + players-view shed assignment-grid coverage), ~3-6 new (Table-Build component + integration + ranking algorithm + merge UI). Net: +50–100 test cases. (Senior engineer)

### Recommended follow-ups

- [ ] **Gate 3:** schema-delta document at `docs/projects/table-build/schema-delta.md` covering migration spec, store creation, backwards-compat read path.
- [ ] **Gate 3 decision:** ratify clothing-observation as parallel `seatClothingObservations` store (vs. EAL reuse).
- [ ] **Gate 4:** owner authorization to pause DCOMP-W4-A1 F1/F3/F6/F7 backlog items pending Table-Build delivery.
- [ ] **Gate 4 (Phase 0):** ship F13 (seed avatarFeatures) immediately. Standalone work, ~30 LOC + test data.
- [ ] **Gate 4:** independent schedules for DCOMP-W4-A1 F2/F5/F8 — these survive the absorption.
- [ ] **Gate 4:** update `surfaces/seat-context-menu.md` for "Open Table-Build" entry collapse.
- [ ] **Gate 4:** confirm cross-product scope main-app-only; document the Ignition no-counterpart decision in surface artifact.
- [ ] **Gate 5:** test churn budget acknowledged in implementation plan.

---

## Stage E — Heuristic pre-check

**Output: ⚠️ Specific adjustments needed (5 targeted constraints; one autonomy red-line application; no structural incompatibility).**

### Findings

**Nielsen H-N3 (user control and freedom) + H-N5 (error prevention) on merge.** Manual merge with stat preservation is the right pattern, but **merge is destructive-by-omission**: the non-surviving record is deleted (or its data reassigned). Per H-N3 + Wave-1-established pattern, merge needs **toast+undo (12s)** with a session-scoped cache of the pre-merge state, just like SessionsView's deferred-delete pattern. (Product/UX + Failure engineer)

**Nielsen H-N6 (recognition over recall) on stability flags.** The user-facing vocabulary (`always` / `today` / `unknown`) maps cleanly to mental model — these are everyday English words, not jargon. **Verify with persona ratification at Gate 3.** Alternative phrasings ("permanent" / "this session" / "not sure") tested against Cold-Read Chris's voice would catch any mismatch. (Product/UX)

**Mobile-Landscape ML06 (touch targets ≥44px).**
- Stability-flag override controls (`always/today/unknown` toggle per feature) need 44×44 minimum.
- Ethnicity tag input chip-removers need 44×44.
- Possible-Matches panel "Compare" + "Merge" actions need 44×44.
- Save-and-next button needs 44×44 (high-frequency primary action; this is the Cold-Read Chris primary tap).
At standard scale (1.0 on 1600×720), all controls must DOM-render at ≥44px. (Product/UX)

**Mobile-Landscape ML02 (information density vs. chrome).** DCOMP-W4-A1 F8 flagged 209px / 29% chrome on PlayersView's filter row. Table-Build's three-column layout (features-left / input+candidates-center / preview+actions-right) must keep chrome ≤25% of viewport. Specifically: input + candidate-list-header + first 4 candidate rows must be visible above the keyboard fold simultaneously in 1600×720 with virtual keyboard up. **This is the load-bearing layout constraint** — not a polish item. (Product/UX)

**Poker-Live-Table PLT-04 (no native dialogs in live play).** Merge confirmation is *not* a native dialog (per Stage C — inline panel). Possible-Matches panel is *not* a modal (inline above save button). Save-and-next is *not* gated by a confirm. **Heuristic clean** if the Stage C constraints hold. (Product/UX)

**Autonomy red line #3 (durable overrides) applied to feature-stability inference.** This is the most important Stage E finding. The drafted feature includes auto-promotion (today→always after N=2 consecutive sessions). User overrides of stability flags MUST be **sticky against re-inference**:

- If Chris explicitly sets a beard's stability to `today` and the auto-promoter would have set it to `always` (because observed across 3 sessions), the explicit `today` setting persists.
- If Chris demotes an auto-promoted feature back to `today`, the system does not re-promote it next session. The override is durable.
- This mirrors the EAL Phase 6 sticky-override pattern (autonomy red line #3 applied to anchor lifecycle in `chris-live-player.md`).

**Implementation:** stability flag is stored as `{ value: 'today' | 'always' | 'unknown', source: 'inferred' | 'user' }`. Re-inference path checks `source === 'user'` and skips. Same shape as EAL anchor `status` field. (Autonomy skeptic + Senior engineer)

**Autonomy red line #2 (full transparency on demand) applied to duplicate-detection.** The drafted Possible-Matches panel must show the *specific overlapping features* that triggered the panel — not a confidence number. Render as a list:

> Possible match: Mike R. (last seen 2026-04-19, 47 hands)
> - Name prefix matches: "Mike"
> - Stable features matched: skin (medium), build (heavy), ethnicity (Irish)
> - Stable features differ: hair color (your: brown / record: dark blond)
> - Today features (informational only): hat (your: visor)

This is autonomy-honest. A confidence score is not. Chris validates via evidence, not trust. (Autonomy skeptic — strongest finding of the roundtable)

**Heuristic compatibility check on the unified surface concept.** The Cold-Read flow's "live candidate list narrows as user types/picks features" is a well-established interaction pattern (autocomplete, faceted search). Nothing structurally novel from a heuristic standpoint. The novelty is the *content* of the ranking + the stability-flag overlay, not the interaction shape. **Heuristic clean overall.** (Product/UX)

### Recommended follow-ups

- [ ] **Gate 4 constraint:** merge action emits a 12s toast+undo with session-scoped pre-merge state cache (SessionsView F1 pattern).
- [ ] **Gate 4 constraint:** stability flag schema includes `source: 'inferred' | 'user'`; re-inference path respects `source === 'user'`.
- [ ] **Gate 4 constraint:** Possible-Matches panel renders evidence (matched-features list), not confidence scores.
- [ ] **Gate 4 constraint:** all Table-Build interactive controls ≥44×44 at scale 1.0.
- [ ] **Gate 4 constraint:** layout chrome ≤25% of 1600×720 viewport; input + candidate-header + 4 candidate rows above keyboard fold simultaneously.
- [ ] **Gate 4 spec:** verify stability-flag vocabulary (`always / today / unknown`) at owner ratification; offer phrasings table for comparison if owner pushes back.
- [ ] **Autonomy assertion at Gate 5:** in-app test that user-set stability flag survives ≥3 sessions of opposite-direction inference signal.

---

## Overall verdict

**🟡 YELLOW.**

The Gate 1 RED dimensions (new persona, new schema shapes) are tractable. None of the Stage A–E findings shifts the feature concept; they shape the design constraints for Gate 4. The autonomy applications (red lines #2 and #3 to inference + transparency) are the strongest signal — they don't block, but they fundamentally shape what "good" looks like at Gate 4.

Three structural risks worth top-billing:

1. **Stability-inference autonomy contract.** Without sticky user-overrides + evidence-based duplicate-detection UI, Table-Build slides into silent-modeling territory. Gate 4 must specify `source: 'inferred' | 'user'` and evidence-rendering Possible-Matches.
2. **DCOMP-W4-A1 backlog re-scope.** F1/F3/F6/F7 must be paused before someone builds them and wastes the work. Owner action item before any Phase 0 starts.
3. **Test churn.** ~12–18 test files affected. Plan for it in implementation budget.

Top-3 required Gate 3 items (narrow scope):
- Owner ratification of `cold-read-chris.md` stability-flag defaults + clothing-promotion rule.
- Author PM-10/11/12 in `player-management.md`.
- Author schema-delta document at `docs/projects/table-build/schema-delta.md` (migration spec + ranking algorithm worked examples + clothing-observation parallel-store rationale).

---

## Required follow-ups

### Gate 3 — Research / framework patches

- [ ] **Persona:** owner ratifies `personas/situational/cold-read-chris.md`. Particularly: stability-flag default table, clothing-promotion rule (N=? sessions), today-feature lifetime at session end (silent / review prompt / auto-unknown), ethnicity curated suggestion list source.
- [ ] **Persona amendment:** add newcomer-cross-check paragraph to `cold-read-chris.md` Constraints.
- [ ] **JTBDs:** author PM-10 / PM-11 / PM-12 in `jtbd/domains/player-management.md` with full shape (statement, dimensions, personas, success criteria, failure modes, related JTBDs).
- [ ] **Schema-delta:** author at `docs/projects/table-build/schema-delta.md`. Includes: stability-flag versioned `avatarFeatures` schema with backwards-compat read path; ethnicity-tag-array migration; `seatClothingObservations` store creation (parallel pattern to EAL); IDB v22 migration spec with test cases; ranking-algorithm worked examples (≥10 sample queries × candidate-pool fixtures showing expected top-3).
- [ ] **Boundary decision:** ratify clothing-observation as parallel store (vs. EAL `anchorObservations` reuse). Senior-engineer cost analysis attached.

### Gate 4 — Design constraints (pre-loaded)

- [ ] Surface artifact at `surfaces/table-build.md` (new). Must specify:
  - Three-column landscape layout with chrome ≤25% of viewport.
  - Keyboard-occlusion-aware: input + candidate-header + 4 candidate rows visible above keyboard fold simultaneously.
  - Adaptive disclosure: feature-creation chrome collapses to slim header until create mode entered.
  - Newcomer progressive disclosure: stability-flag overrides hidden for first ≥3 saved players.
  - Possible-Matches panel: inline above save, evidence-rendered (matched-features list, no confidence numbers).
  - Merge action: 12s toast+undo, session-scoped pre-merge cache.
  - Save-and-next green-light: ≥3 stable features captured.
  - All interactive controls ≥44×44 at scale 1.0.
  - Build state persistence (separate from per-player draft) — survives phone sleep, mid-hand interruption, Seat-Swap handoff.
  - Merge confirmation inline; never navigate away from Table-Build.
- [ ] **Updates to existing surface artifacts:**
  - `surfaces/player-picker.md`: marked superseded by Table-Build; absorbed.
  - `surfaces/player-editor.md`: create-from-query path absorbed; edit-existing path survives.
  - `surfaces/players-view.md`: seat-assignment grid absorbed; database-browser + bulk-operations survive.
  - `surfaces/seat-context-menu.md`: "Find Player" + "Create New Player" entries collapse to "Open Table-Build".
- [ ] **Backlog action:** owner authorizes pause of DCOMP-W4-A1 F1/F3/F6/F7 in `.claude/BACKLOG.md`. F2/F5/F8 ship independent. F13 ships as Phase 0 prerequisite.
- [ ] **Cross-product confirmation:** document main-app-only scope in surface artifact (Ignition no-counterpart rationale).

### Gate 5 — Implementation assertions

- [ ] **In-app autonomy test:** user-set stability flag survives ≥3 sessions of opposite-direction inference signal.
- [ ] **In-app autonomy test:** Possible-Matches panel never renders a confidence score; only evidence-list.
- [ ] **In-app autonomy test:** merge action fires toast+undo; undo restores both records pristine.
- [ ] **Persistence test:** Table-Build state survives phone-sleep simulation + mid-hand-interruption simulation.
- [ ] **Layout regression test:** Playwright check at 1600×720 with virtual-keyboard-equivalent overlay confirms input + 4 candidate rows above fold.
- [ ] **Migration test:** v21 → v22 migration on fixture players records with various legacy `avatarFeatures` shapes + various `ethnicity` enum values; verify all read paths work.

---

## Open questions remaining for owner (carry-over from Gate 1, plus 1 new)

The 8 Gate 1 open questions remain in scope. The roundtable surfaced one additional decision:

9. **Stability-flag vocabulary.** Default proposal: `always` / `today` / `unknown`. Alternative phrasings: `permanent` / `this session` / `not sure`. Or: `sticky` / `today only` / `?`. Plain-English wins on H-N6 (recognition over recall); owner preference shapes the canonical labels rendered everywhere.

---

## Anti-patterns avoided

Per ROUNDTABLES.md anti-pattern check:

- **Boilerplate pass:** ❌ — substantive findings in every stage; verdict is YELLOW with concrete adjustments.
- **Rubber-stamping:** ❌ — autonomy red-line application (#2 + #3) is a non-trivial Gate 4 constraint, not a polish observation.
- **Post-implementation:** ❌ — Gate 2 ran before any Table-Build code or surface artifact was written.
- **One-stage pass:** ❌ — five stages, each with at least one finding.
- **Persona-only, forgetting situational:** ❌ — Stage C produced 5 specific situations × constraint pairings, the strongest section.

---

## Change log

- 2026-04-26 — Drafted same session as Gate 1. Verdict YELLOW. Channels Product/UX + Autonomy + Senior engineer + Failure engineer voices. Pending owner ratification.
