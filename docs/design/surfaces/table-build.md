# Surface — Table-Build

**ID:** `table-build`
**Code paths (planned — Gate 5 will verify):**
- `src/components/views/TableBuildView/TableBuildView.jsx` — root
- `./FeatureColumn.jsx` — left column: stability-flagged feature swatches (collapsible to slim header)
- `./CandidateColumn.jsx` — center column: input + live-narrowing candidate list + Possible-Matches panel
- `./PreviewColumn.jsx` — right column: in-flight player preview + seat-progress indicator + save-and-next
- `./PossibleMatchesPanel.jsx` — inline panel above save when dedupe threshold crossed
- `./MergeCompareSheet.jsx` — side-by-side compare → manual merge
- `./EthnicityTagInput.jsx` — autocomplete chip input (~120-entry curated list + free-text fallback)
- `./StabilityFlagOverride.jsx` — per-feature `always / today / unknown` toggle with `(auto)` suffix when inferred
- `./RotateToLandscapeBanner.jsx` — portrait-detected affordance (no degraded portrait layout)
- `src/hooks/useTableBuild.js` — orchestration
- `src/hooks/useDuplicateDetection.js` — calibrated scoring + evidence rendering
- `src/hooks/useTableBuildPersistence.js` — build-state persistence (separate from per-player draft autosave)
- `src/utils/playerMatching/scorePlayerMatch.js` — stability-aware ranking (replaces existing player-picker version)
- `src/utils/persistence/seatClothingObservationsStore.js` — new store wrapper (parallel to EAL `anchorObservationsStore`)
- `src/reducers/tableBuildReducer.js` — build state reducer
- `src/contexts/TableBuildContext.jsx` — provider

**Route / entry points:**
- `SCREEN.TABLE_BUILD` (new route, registered via `uiReducer` + `ViewRouter`)
- Opens from: `SeatContextMenu` → "Open Table-Build" (the absorbed entry collapsing what were "Find Player…" + "Create New Player"), with `pickerContext.seat` set; or from session-start auto-open when a fresh session has no assigned seats.
- Closes to: `closeTableBuild()` → previous screen (usually TableView). Also closes on user-explicit "Done" when the build is complete (all seats Chris cares about are assigned).

**Product line:** Main app (no sidebar counterpart — online seats auto-populate from WebSocket capture).
**Tier placement:** Free+ (core player-management flow). Plus+ unlocks unlimited player records (existing 50-player Free cap on source data carries through).
**Last reviewed:** 2026-04-26

---

## Purpose

A single landscape-optimized surface absorbing the search/match path of `PlayerPickerView`, the create-from-query path of `PlayerEditorView`, and the seat-assignment grid of `PlayersView`. Built for **Cold-Read Chris** — sitting at a table at session start, populating 5–8 seats over 5–15 minutes, mixing recognition of regulars with creation of strangers. Live candidate list always visible while the user types name fragments, picks features, or types ethnicity tags. "Create new" is a continuation past zero matches on the same screen — not a separate route. Stable-vs-ephemeral feature stability flags drive search ranking that survives appearance changes (a new beard does not displace partial-name + stable-feature matches). Possible-Matches panel before save offers manual merge with full stat preservation.

---

## JTBD served

Primary:
- `JTBD-PM-10` cold-read at session start with mixed match-or-create flow
- `JTBD-PM-11` detect potential duplicates on save and offer manual merge
- `JTBD-PM-12` capture today-only observations without polluting the player record
- `JTBD-PM-02` assign a known player to a seat
- `JTBD-PM-03` create a new player and assign to seat
- `JTBD-PM-05` batch-assign players to seats at session start (the umbrella job; PM-10 is the persona-action variant)
- `JTBD-PM-09` find a player by visual features

Secondary:
- `JTBD-PM-06` retroactively link prior hands (automatic post-save when seatContext present, retains existing semantics)
- `JTBD-PM-04` swap the player on a seat (Seat-Swap-Chris handoff edge case — see Stage C constraints below)

## Personas served

- [Cold-Read Chris](../personas/situational/cold-read-chris.md) — **primary**. The persona this surface is authored for.
- [Chris (live player)](../personas/core/chris-live-player.md) — core anchor.
- [Ringmaster (home host)](../personas/core/ringmaster-home-host.md) — primary co-tenant; database is regular-heavy so match dominates, but the same surface serves with adaptive disclosure (no separate "Ringmaster mode" — confirmed at Gate 3).
- [Seat-Swap Chris](../personas/situational/seat-swap-chris.md) — secondary; mid-build handoff edge case.
- [Between-Hands Chris](../personas/situational/between-hands-chris.md) — secondary; follow-up edits to a player just created.
- [Newcomer](../personas/core/newcomer.md) — first-session worst case; progressive-disclosure rules below ensure stability-flag UI does not overwhelm.

---

## Anatomy

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [← Back] Table-Build · Seat 4 of 8 filled                            [Done]      │ ← top bar (z20)
├──────────────────────────────────────────────────────────────────────────────────┤
│ ┌─ FeatureColumn ──────┐ ┌─ CandidateColumn ──────────────┐ ┌─ PreviewColumn ─┐ │
│ │ ▾ Pick what stands   │ │ 🔍 [first-name fragment…]   [X]│ │  [avatar 80px]  │ │
│ │   out                │ │ ─────────────────────────────  │ │   Mike R. (new) │ │
│ │ Skin   [● ● ● ● ●]   │ │ ┌──────────────────────────┐   │ │   medium / heavy│ │
│ │ Build  [● ● ●]       │ │ │ 🧑 Mike R.  (Irish)      │   │ │   Irish · brown │ │
│ │ Hair   [styles → ]   │ │ │   medium · heavy · brown │   │ │                 │ │
│ │ Color  [● ● ● ● ●]   │ │ │   seen 6d ago · 47 hands │   │ │   ▸ Today-look  │ │
│ │ Beard  [styles → ]   │ │ └──────────────────────────┘   │ │     [vest]      │ │
│ │ Eye    [styles → ]   │ │ ┌──────────────────────────┐   │ │     [+ add]     │ │
│ │ Glass. [styles → ]   │ │ │ 🧑 Michael S. (Polish)   │   │ │                 │ │
│ │ Hat    [styles → ]   │ │ │   light · medium · blnd  │   │ │ ┌─ Possible ─┐  │ │
│ │ Ethni. [chips +tag]  │ │ │   seen 19d ago · 11 hands│   │ │ │ matches:   │  │ │
│ │ ▸ More options       │ │ └──────────────────────────┘   │ │ │ Mike R.    │  │ │
│ │   (stability flags)  │ │ ┌──────────────────────────┐   │ │ │ name+skin+ │  │ │
│ │                      │ │ │ + Create new: "Mike"     │   │ │ │ ethnicity  │  │ │
│ │                      │ │ └──────────────────────────┘   │ │ │ [Compare]  │  │ │
│ │                      │ │                                │ │ └────────────┘  │ │
│ │                      │ │                                │ │ [Save & next →] │ │
│ └──────────────────────┘ └────────────────────────────────┘ └─────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
                          ↑ virtual keyboard rises here without occluding above
```

**Layout grid (1600×720 reference):**
- Top bar: 56px tall, full width, z20 sticky.
- Body: three columns at fixed widths optimized for landscape thumb-reach.
  - FeatureColumn: 320px (left).
  - CandidateColumn: 720px (center, widest — hosts the input + result list + create-from-query CTA + Possible-Matches inline panel).
  - PreviewColumn: 560px (right — preview + seat-progress + today-look capture + save-and-next).
- Total: 1600px wide, 664px content height (top bar deducted from 720px).
- Virtual keyboard region: bottom ~280px in landscape. The CandidateColumn is laid out so input + candidate-header + first 4 candidate rows stay above the keyboard fold.

**FeatureColumn collapsed state (Ringmaster fast-path):**
- When the user has **not** typed past zero matches AND hasn't tapped any feature swatch, FeatureColumn collapses to a 56px slim header showing "Pick what stands out (or just type a name)." Tapping the header expands.
- Once FeatureColumn is expanded the first time in a session, it stays expanded for the rest of the build.

**Newcomer progressive disclosure:**
- For the first ≥3 saved players in the user's database, the per-feature stability-flag override controls (`▸ More options`) are hidden. Smart defaults (per-feature stability-default table from `cold-read-chris.md`) drive everything. After 3 saves, the override controls become available.

---

## State

- **From context (`useTableBuild`):** the new context wraps a reducer whose state is `{ buildSession, currentSeat, draftPlayer, candidates, possibleMatches, mergeFlow, todayLook, progress }`.
  - `buildSession` — `{ id, sessionId, startedAt, completedSeats: number[], pendingSeats: number[] }`. Persisted via `useTableBuildPersistence` so phone sleep / mid-hand-pitch / Seat-Swap-handoff don't lose progress.
  - `currentSeat` — number, derived from `pickerContext.seat` on entry; advances on Save & next.
  - `draftPlayer` — mirror of `usePlayerDraft` shape, extended with stability-flagged features per schema-delta.
  - `candidates` — top-N by `scorePlayerMatch`, recomputed synchronously on every keystroke / feature-tap / ethnicity-tag-add.
  - `possibleMatches` — `Array<{ candidate, evidenceList }>` when `findPossibleMatches(draft, allPlayers)` returns ≥1 above threshold 0.45.
  - `mergeFlow` — `{ stage: 'idle' | 'compare' | 'merging' | 'committed' | 'undoable', sourceId, targetId, preMergeSnapshot }`.
  - `todayLook` — array of clothing-observations being captured for `currentSeat` this session.
  - `progress` — `{ assignedSeatCount, totalTargetSeats, hasUnsavedDraft }`.
- **From context (`usePlayer`):** `allPlayers`, `assignPlayerToSeat`, `linkPlayerToPriorHandsInSession`, `undoRetroactiveLink`, `mergePlayerRecords` (new — see Section "Merge UI detail").
- **From context (`useSession`):** `currentSession`.
- **From context (`useUI`):** `pickerContext` (`{ seat, batchMode }`), `closeTableBuild`, `openPlayerEditor` (still used for opening edit-existing path on a saved record).
- **Local (via `useTableBuild`):** input focus, scroll position, expanded/collapsed state of FeatureColumn, keyboard-up detection.

## Props / context contract

- `scale: number` (default 1) — viewport scale factor.

## Key interactions

1. **Mount:** `useScreenFocusManagement` autofocuses the name input. `useTableBuild` reads any prior buildSession from `useTableBuildPersistence` and rehydrates progress + draft + todayLook. If `pickerContext.batchMode` was set on entry, current behavior is preserved.

2. **Type in name input:** synchronous candidates re-rank via `scorePlayerMatch` (see Section "Ranking algorithm summary"). Top 3 surface in CandidateColumn, sorted descending. Sticky "+ Create new: \"<query>\"" CTA always visible at the bottom of the candidate list.

3. **Tap a feature swatch (Skin / Build / Hair / etc.):** updates `draftPlayer.avatarFeatures.<feature>`. If the feature has a per-sub-type stability default (e.g., glasses sub-type "clear-frame" defaults `always`; "sunglasses" defaults `today`), the default is applied. Candidates re-rank live; PreviewColumn avatar updates.

4. **Type in ethnicity tag input:** autocomplete from the curated ~120-entry list (Gate 3 Q7). Show 6 suggestions per keystroke. Free-text submission always permitted (chip created with whatever the user typed). Chip removal via 44×44 X button. Tags stored in `draftPlayer.ethnicityTags` array.

5. **Tap a candidate result:** `handlePickPlayer` → assign seat → fire retro-link → undo toast (8s) → buildSession `completedSeats` adds the seat → `currentSeat` advances to next pending seat → CandidateColumn input clears, FeatureColumn resets, draftPlayer cleared. Save & next is implicit on candidate-tap (no extra confirm).

6. **Tap "+ Create new" CTA:** finalizes draftPlayer in-place. If `findPossibleMatches(draft, allPlayers)` returns ≥1 above threshold, the Possible-Matches panel appears in PreviewColumn (NOT a navigate-away). User must explicitly tap "Save & next" or "Compare" to advance.

7. **Tap "Compare" on a Possible-Matches candidate:** opens `MergeCompareSheet` overlay (right-side sheet, full-height, dismissible). Side-by-side rendering of draft vs. existing record. User taps "Merge into Mike R." → merge commits → 12s toast+undo → buildSession progress advances → sheet auto-closes. See Section "Merge UI detail" for the merge semantics.

8. **Tap "Save & next →":** if Possible-Matches panel is empty (no overlap above 0.45) AND `draftPlayer` has ≥3 stable features captured (the green-light state from Gate 2 Stage C) AND name is non-empty (or auto-name fallback applied), commit a new player record + assign to seat + retro-link + undo toast (8s) → advance.
   - If <3 stable features: button shows in muted state with hint copy "Pick at least 3 stable features (or override defaults)."
   - If Possible-Matches panel non-empty: button shows in cautionary state with hint copy "Possible duplicate — review before saving."

9. **Tap a today-look chip in PreviewColumn:** opens a small popover with clothing-observation categories (vest, jersey, hat, sunglasses, chain, etc. — small fixed list per Gate 1 spec; freeform text supported). Selection writes to `seatClothingObservations` store keyed by `sessionId + seatNumber + playerId` (or pending-playerId placeholder if pre-save). Per JTBD-PM-12, today-look does NOT touch the player record's stable feature set.

10. **Stability-flag override (after 3+ players saved):** tap the `▸ More options` toggle on FeatureColumn → reveal per-feature `[always / today / unknown]` chip selectors. Default is the per-sub-type default; user can override. Override sets `stability.source = 'user'` per schema. Once user-set, the schema-aware re-inference path skips this feature on this player record (autonomy red-line #3 sticky).

11. **Rotate detection (portrait):** on viewport orientation change to portrait (height > width), render `RotateToLandscapeBanner` covering the canvas with a clear instruction to rotate. Layout is NOT rendered in portrait. (Gate 3 Q8 verdict.)

12. **Tap Done in top bar:** if `progress.assignedSeatCount === progress.totalTargetSeats` OR user confirms "Finish with N seats unassigned," surface closes → routes to TableView. buildSession is marked `completed` (no longer rehydrated on re-entry).

13. **Tap Back in top bar:** does NOT close the build session — it just navigates away. buildSession persists. Re-entering the surface (via SeatContextMenu → "Open Table-Build" or session-start auto-open) rehydrates the in-progress build.

14. **Phone sleep / app backgrounded mid-build:** all state persists via `useTableBuildPersistence` (debounced write to a new `tableBuildSession` IDB store). On resume, full state restores including draftPlayer fields, todayLook chips, progress indicator.

15. **Mid-hand interruption (dealer pitches before build done):** Table-Build surface remains in pending state. User navigates to TableView via Back; logs hand 1; returns to Table-Build via SeatContextMenu → "Open Table-Build" → resume on `currentSeat`. Retro-link semantics preserved (existing `linkPlayerToPriorHandsInSession` runs on subsequent assigns).

16. **Seat-Swap handoff (seat 6 already filled, mid-build, player leaves + new player sits):** Cold-Read flow yields. User exits Table-Build via Back, uses SeatContextMenu Clear/Find on seat 6, then re-enters Table-Build. buildSession's `completedSeats` reflects the cleared seat (now back to pending); `progress.assignedSeatCount` updates. todayLook on already-built seats survives the yield.

---

## Design constraints (load-bearing — do not relax without re-running Gate 2)

These are the constraints accumulated through Gates 1, 2, 3. Every Gate 4 design choice is anchored here. Any code change touching this surface must verify these still hold.

### C1 — Layout chrome ≤25% of 1600×720 viewport

Top bar (56px) + FeatureColumn slim header when collapsed (56px) sums to ~16% of vertical space; expanded FeatureColumn does NOT consume vertical space (it's a left column). CandidateColumn input row + candidate-list-header sums to ~88px / ~13% of vertical. Total chrome: ~13% in collapsed state, ~16% with FeatureColumn expanded. Well under the 25% ceiling. **DCOMP-W4-A1 F8** explicitly flagged the 29% chrome on PlayersView's filter row as a regression — Table-Build does not repeat that pattern.

### C2 — Input + 4 candidate rows above keyboard fold simultaneously

In landscape with virtual keyboard up (~280px bottom), the CandidateColumn must render: name input row (44px) + candidate-list-header row (~24px) + at least 4 candidate rows (~80px each) = ~388px. Available height above keyboard = 720 - 56 (top bar) - 280 (keyboard) = 384px. **This is the load-bearing layout dimension.** Visual regression test must verify this holds at 1600×720 with simulated keyboard overlay.

### C3 — Adaptive disclosure on FeatureColumn

FeatureColumn collapses to 56px slim header on mount until: user types past zero matches OR taps any feature swatch. This protects Ringmaster's match-dominant flow from feature-creation chrome it doesn't need.

### C4 — Newcomer progressive disclosure on stability flags

Per-feature stability-flag override controls (`▸ More options`) are hidden for the first ≥3 saved players. Smart defaults handle everything until the user has demonstrated familiarity. Threshold reached at 3 saves: override controls become available silently (no announcement, no banner).

### C5 — Possible-Matches panel renders evidence, never a confidence number

The panel displays the matched-features list per `findPossibleMatches`'s `evidenceList` output (e.g., "Name prefix matches: 'Mike'", "Stable features matched: skin (medium), build (heavy), ethnicity (Irish)"). The internal score (`≥0.45`) is NEVER rendered to the user. Gate 2 Stage E autonomy finding — autonomy red-line #2 (full transparency on demand) applied to dedupe.

### C6 — Merge action emits 12s toast+undo

Merge commit captures pre-merge snapshot of both records into session-scoped cache. Undo within 12s restores both records pristine. This mirrors SessionsView-F1 deferred-delete + EAL Phase 6 sticky-override pattern. Auto-merge never fires.

### C7 — Save-and-next green-light: ≥3 stable features captured

The save action requires `stableFeatureCount(draftPlayer) >= 3` to enter the bright (committable) state. Below threshold, button is muted with hint copy. This forces minimum-viable cross-session recognition data without bloating per-seat capture time.

### C8 — All interactive controls ≥44×44 at scale 1.0

Stability-flag override chips, ethnicity tag chip-removers, Possible-Matches Compare/Merge buttons, save-and-next button, today-look chips, FeatureColumn swatches: all DOM-render at ≥44×44 px at scale=1.0. Mobile-Landscape ML06 compliance verified at Gate 5 via Playwright DOM measurement.

### C9 — Build state persistence (separate from per-player draft)

buildSession (progress, completedSeats, currentSeat) persists in a NEW `tableBuildSession` IDB store. The in-flight `draftPlayer` continues to use the existing `playerDrafts` store + `usePlayerDraft` autosave. todayLook persists in the new `seatClothingObservations` store immediately (per-tap). Three persistence layers, each cleanly scoped.

### C10 — Merge confirmation never navigates away

`MergeCompareSheet` is an overlay sheet inside Table-Build, not a route change. After merge commits or undoes, focus returns to CandidateColumn input. buildSession progress advances inline.

### C11 — Stability-flag user overrides are sticky against re-inference

Schema records `stability.source = 'inferred' | 'user'` per feature. The promotion-eligibility check (N=2 sessions for `today→always`) skips features with `source === 'user'`. Once Chris explicitly sets a beard's stability to `today`, the auto-promoter never overrides. Mirrors EAL Phase 6 sticky-override pattern. Autonomy red-line #3 (durable overrides) applied.

### C12 — Cross-product scope: main-app only

No Ignition extension counterpart. Online seats auto-populate from WebSocket capture; the Cold-Read pattern doesn't apply to online play. Documented in code as: when entry is attempted from an online context (which it cannot be — no entry point exists), assert + log.

---

## Stability flag schema

Specified in detail at `docs/projects/table-build/schema-delta.md` Section 3. Summary here for surface-design context only:

Each feature in `avatarFeatures` carries:
```
{
  value: '<namespaced-feature-id>',
  stability: {
    value: 'always' | 'today' | 'unknown',
    source: 'inferred' | 'user'
  }
}
```

Per-feature stability defaults from `cold-read-chris.md`:

| Feature | Default stability | Notes |
|---|---|---|
| Skin tone | `always` | Rarely overridden |
| Build | `always` | Rarely overridden |
| Gender (male default) | `always` | — |
| Ethnicity tags | `always` | Stored separately as `string[]` |
| Hair color | `always` | Possible override (dye) |
| Hair style | `always` | Possible override (haircut) |
| Beard presence | `today` until repeat-observed in N=2 sessions | Promotes |
| Beard variant | `today` until repeat-observed | — |
| Eye color | `always` | — |
| Glasses (clear-frame sub-type) | `always` | "Clear glasses are likely always worn" — owner |
| Glasses (sunglasses sub-type) | `today` | — |
| Glasses (tinted / prescription sub-type) | `unknown` | User decides |
| Hat | `today` | — |

**`always (auto)` rendering:** when `stability.source === 'inferred'` AND `stability.value === 'always'`, the chip renders the bare word with `(auto)` suffix — `always (auto)` — so the user knows it's a system inference, not their explicit choice. One tap to demote (which sets `source = 'user'` and the demotion is sticky).

---

## Ranking algorithm summary

Specified in detail at `docs/projects/table-build/schema-delta.md` Section 4. Summary here:

```
score = 0.35 * jaroWinkler(query.namePrefix, candidate.name)
      + 0.20 * (ethnicityOverlap(query.tags, candidate.tags) > 0 ? 1 : 0)
      + 0.15 * stableMatch('skin',  query, candidate)
      + 0.15 * stableMatch('build', query, candidate)
      + 0.10 * stableHairColorMatch(query, candidate)
      + 0.05 * stableEyeColorMatch(query, candidate)
```

`stableMatch` returns 1 only when both query and candidate features have `stability.value === 'always'`. Today-features contribute zero weight to cross-session ranking — this is what makes "John W still ranks top despite a new beard" work.

Top 3 candidates surface in CandidateColumn. Ties break by recency of last-played-with.

---

## Possible-Matches panel detail

Fires when `findPossibleMatches(draft, allPlayers)` returns ≥1 candidate above score threshold 0.45.

**Render shape:**

```
┌─ Possible matches ──────────────────────┐
│ Mike R. — last seen 2026-04-19, 47 hands│
│   Name prefix matches: "Mike"           │
│   Stable features matched: skin, build, │
│     ethnicity (Irish)                   │
│   Stable features differ: hair color    │
│     (your: brown / record: dark blond)  │
│   Today-look (informational): hat       │
│     (your: visor)                       │
│ [Compare]  [Not the same — Save new]    │
└─────────────────────────────────────────┘
```

The score `0.45` does not appear. Only the **evidence list** (which weights matched, which differed) is rendered. "Today-look (informational)" is shown but explicitly contributes zero weight — the rendering note is for the user's own recognition aid.

Top 3 candidates rendered if 3+ above threshold. Sort descending by score.

---

## Merge UI detail

`MergeCompareSheet` is a right-side overlay sheet (full-height, ~640px wide), opened via tap on "Compare" in the Possible-Matches panel.

**Compare layout:**
- Left half: draft (the player about to be saved).
- Right half: existing record (the candidate).
- Each field rendered side-by-side: name, ethnicity tags, stable features, today-look, last-played date, hands count, range profile preview, notes.
- Differences highlighted (left vs. right).

**Merge action:** "Merge into <existing>" (visually primary on right side).
- Captures `preMergeSnapshot` of both records into session-scoped `mergeUndoCache`.
- `mergePlayerRecords(sourceId, targetId, conflictResolutions)` runs:
  - All hands in `hands` store with `playerId === sourceId` reattributed to `targetId`.
  - Range profile: target's profile preserved (existing record wins on stat continuity); source's range profile data **discarded** (no merge of profile internals — Chris uses target's history as canonical).
  - Stable features: conflict-resolved per `conflictResolutions` (UI lets Chris pick "use draft" or "use existing" per differing field). Defaults: keep existing for stable-features-that-match; ask Chris on differing ones.
  - todayLook: source's `seatClothingObservations` for current session reattributed to `targetId`.
  - Source player record: deleted (deferred — held in `mergeUndoCache` for 12s).
  - Seat 4 assigned to `targetId`.
  - Retro-link fires for any same-session prior hands.

**Toast: "Merged into Mike R. — Undo (12s)."**
- Undo restores source record from `mergeUndoCache`, reattributes hands back, restores source's todayLook, clears seat assignment back to draft state, returns user to CandidateColumn with draft preserved.

**`MergeCompareSheet` auto-closes on commit OR explicit dismiss. Never navigates away from Table-Build.**

---

## Build state persistence spec

A new IDB store `tableBuildSession` (created in v22 migration per schema-delta) holds:

```
{
  id: <buildSessionId>,
  sessionId: <currentSessionId>,
  startedAt: <timestamp>,
  completedSeats: <seatNumber[]>,
  pendingSeats: <seatNumber[]>,
  currentSeat: <seatNumber>,
  draftPlayerId: <id reference into playerDrafts store, if any>,
  status: 'in-progress' | 'completed' | 'abandoned'
}
```

Debounced write (400ms) on every state change. Read on Table-Build mount. Marked `completed` on user-explicit Done. Auto-marked `abandoned` if a new session starts without completion.

Three independent persistence layers kept clean:
- `tableBuildSession` (this surface's progress)
- `playerDrafts` (existing in-flight per-player draft autosave — unchanged)
- `seatClothingObservations` (today-look per seat, written on each tap)

---

## Layout responsive behavior

**Landscape (width > height):** primary supported orientation. Three-column layout as anatomy above.

**Portrait (height > width):** NOT a supported layout. `RotateToLandscapeBanner` covers the canvas with a clear "Rotate to landscape to build a table" message + an icon. Detection via `window.matchMedia('(orientation: portrait)')`. No degraded portrait layout. Per Gate 3 Q8: cost-of-second-layout exceeds value-of-portrait-support for this persona.

**Smaller viewports (< 1600 wide):** at scale<1.0, three columns proportionally compress. Below ~1280 wide, FeatureColumn auto-collapses to slim header (existing C3 behavior, just triggered earlier). Below ~960 wide, layout falls back to vertical stack — FeatureColumn collapses to top sheet, CandidateColumn full width, PreviewColumn collapses to bottom sheet. **This fallback is provided for robustness only — it is NOT a v1 design target.**

---

## Accessibility / touch targets

- All interactive controls ≥44×44 at scale 1.0 per C8.
- FeatureColumn swatches: 44×44 with 8px gap.
- Ethnicity tag chips: 44px tall, X-button 44×44 hit region (icon may be smaller visually but hit-padding extends).
- CandidateColumn rows: 80px tall total; full row tappable.
- "Compare" / "Merge" buttons in panel: 44px tall, ≥120px wide.
- Save & next button: 56px tall, full PreviewColumn width.
- ARIA: every input has `aria-label`; every chip-button has `aria-pressed`; CandidateColumn list is `role="listbox"` with `role="option"` rows; Possible-Matches panel is `role="region"` with descriptive `aria-label`.

---

## Autonomy assertions (Gate 5 in-app tests)

These tests must pass before Table-Build can ship. Each maps to an autonomy red-line application surfaced at Gate 2 Stage E.

1. **Sticky stability override (red-line #3):** simulate user demoting a feature from `always` to `today`. Run `simulateThreeMoreSessionsObservingFeature()`. Assert: feature stability remains `today` (user override sticky); auto-promoter does not re-fire.

2. **Evidence-not-confidence in Possible-Matches (red-line #2):** render a Possible-Matches panel with score=0.62. Assert: DOM contains evidence-list strings ("Name prefix matches", "Stable features matched"); DOM does NOT contain the score number (0.62, 62%, etc.) anywhere visible.

3. **Auto-merge never fires:** simulate save action with score=0.95 dedupe match. Assert: panel surfaces, save action does NOT auto-commit, user input required.

4. **Merge undo restores both records:** commit merge → tap undo within 12s. Assert: source record restored pristine (hands re-attributed, todayLook restored, range profile preserved); target record reverted to pre-merge state; seat assignment returns to draft.

5. **Build state persists across sleep simulation:** populate buildSession with 4 of 8 seats + in-flight draft. Trigger sleep + wake (or remount). Assert: `progress.assignedSeatCount === 4`, draft fields intact, `currentSeat` correct.

6. **Layout chrome ≤25% Playwright assertion:** at 1600×720 with virtual-keyboard-equivalent overlay (bottom 280px masked), verify input row + candidate-list-header + at least 4 candidate rows are within visible area.

7. **Newcomer progressive disclosure:** with 0 saved players, verify `▸ More options` toggle is NOT in DOM. After saving 3 players, verify it IS in DOM.

8. **Portrait redirect:** at 720×1600 (portrait), verify `RotateToLandscapeBanner` covers the canvas; main layout NOT rendered.

---

## Known issues

None — surface is pre-implementation. Section reserved for post-Gate-5 audit findings.

## Potentially missing (deliberate v1 scope cuts — defer to v2 evaluation)

- **Photo upload** — explicitly out of scope per Cold-Read Chris non-goals (social cost too high to photograph players). Existing `ImageUploadSection` in `PlayerEditorView` survives for the edit-existing path.
- **Bulk operations on saved records** — delete-many, export-many — survive in `PlayersView`; not Table-Build's job.
- **Cross-venue linker** (deduplication across venue records) — feature gap from `players-view.md`'s "Potentially missing" list; carries forward unaddressed.
- **AI image-recognition for matching** — not in scope; ranking is feature-based, not visual-similarity-based.
- **Mobile-portrait support** — explicitly deferred to v2 per Gate 3 Q8 evidence (population-level portrait dominates, but task class flips it for at-rest sustained-attention contexts; rotate-prompt provides graceful degradation).

---

## Test coverage plan

- **Unit:** TableBuildView component tests covering each column independently + integration test for the three-column composition + reducer tests for tableBuildReducer.
- **Hook:** useTableBuild orchestration tests + useDuplicateDetection scoring tests (≥10 fixture queries from schema-delta Section 4) + useTableBuildPersistence rehydration tests.
- **Integration:** end-to-end flow from SeatContextMenu entry → assign-known → assign-known-with-merge → create-new-with-features → save-and-next → done. Plus interruption variants from Stage C of Gate 2.
- **Migration:** fixture-based v21→v22 tests per schema-delta Section 6 (≥8 cases).
- **Visual regression:** Playwright walks at 1600×720 verifying layout dimensions, chrome %, touch-target sizes, evidence-rendered-no-score on Possible-Matches.
- **Autonomy assertions:** the 8 tests above (Section "Autonomy assertions").

Estimated test churn (per Gate 2 Stage D): +50–100 test cases. ~12-18 existing test files affected (~6 fully replaced, ~6 trimmed, ~3-6 new).

---

## Related surfaces

| Surface | Relationship | Action |
|---|---|---|
| [`player-picker`](./player-picker.md) | **Absorbed.** Search/match path → Table-Build. | Mark superseded; archive code paths after Gate 5. |
| [`player-editor`](./player-editor.md) | **Partially absorbed.** Create-from-query path → Table-Build. Edit-existing path **survives** (entered from PlayersView row → "Edit"). | Update artifact: mark create-from-query absorbed, retain edit path. |
| [`players-view`](./players-view.md) | **Partially absorbed.** Seat-assignment grid → Table-Build. Database browser + bulk operations **survive**. | Update artifact: mark seat-grid absorbed, retain browser + bulk ops. |
| [`seat-context-menu`](./seat-context-menu.md) | **Entry point updated.** "Find Player…" + "Create New Player" entries collapse to "Open Table-Build". | Update artifact: single entry. |
| [`table-view`](./table-view.md) | Renders seat avatars including today-look chips from `seatClothingObservations`. | Visual integration; no logic change. |

---

## Migration coordination (DCOMP-W4-A1) — ratified 2026-04-26

The 2026-04-22 audit on `players-view` produced 8 backlog findings. Reality check at Gate 4 ratification: **F1 / F2 / F3 / F6 already shipped** (Batches A + B, commits `0715034` + `38b334b`) — Table-Build will eventually replace those code paths but the safety improvements landed in the interim. Updated disposition:

| Finding | Current status | Verdict | Action |
|---|---|---|---|
| F1 — Clear All Seats native confirm → toast+undo | ✅ COMPLETE (Batch A) | Replaced by Table-Build post-Gate-5 | No action — work shipped |
| F2 — Delete Player modal → deferred-delete | ✅ COMPLETE (Batch B) | Survives in database browser | No action — work shipped |
| F3 — Per-seat Clear silent commit → toast+undo | ✅ COMPLETE (Batch A) | Replaced by Table-Build post-Gate-5 | No action — work shipped |
| F5 — Row action targets (Range/Edit/Delete) | NEXT (P1) | Survives in database browser | Keep NEXT — independent ship |
| F6 — Per-seat Clear touch target | ✅ COMPLETE (Batch A) | Replaced by Table-Build post-Gate-5 | No action — work shipped |
| F7 — Clear All Seats button height | NEXT (P2) | In absorbed seat-grid; not worth shipping | **PAUSE** in BACKLOG |
| F8 — Filter persist + collapse | NEXT (P2) | Survives + becomes Table-Build's filter design | Keep NEXT — independent ship; informs Table-Build |
| F13 — Seed avatarFeatures in dev data | NEXT (P3) | Phase 0 prerequisite for Table-Build dev verification | **PROMOTE to P0 / Phase 0** |

**Net actions in `.claude/BACKLOG.md`:** F7 status → PAUSED with Table-Build supersession note. F13 promoted to P0/Phase 0. F5 + F8 unchanged (current NEXT status correct). F1/F2/F3/F6 require no backlog action — already complete.

---

## Schema migration

Specified in detail at [`docs/projects/table-build/schema-delta.md`](../../projects/table-build/schema-delta.md). Summary:

- IDB v21 → v22 (no conflict with EAL or PRF roadmaps).
- Three changes:
  1. Versioned stability-flagged `avatarFeatures` (with backwards-compat read on legacy flat shape).
  2. `ethnicity: string` → `ethnicityTags: string[]` (one-element migration; legacy field deprecated-but-readable for v22).
  3. New `seatClothingObservations` store mirroring EAL `anchorObservations` pattern.
- Migration test suite: ≥8 fixture cases per schema-delta Section 6.

---

## Cross-references

- **Gate 1:** [`audits/2026-04-26-entry-table-build.md`](../audits/2026-04-26-entry-table-build.md) (verdict 🔴 RED)
- **Gate 2:** [`audits/2026-04-26-blindspot-table-build.md`](../audits/2026-04-26-blindspot-table-build.md) (verdict 🟡 YELLOW)
- **Gate 3 research:** [`docs/projects/table-build/gate3-research.md`](../../projects/table-build/gate3-research.md) (six recommendations, ratified by owner 2026-04-26)
- **Persona:** [`personas/situational/cold-read-chris.md`](../personas/situational/cold-read-chris.md)
- **JTBDs:** PM-10/11/12 in [`jtbd/domains/player-management.md`](../jtbd/domains/player-management.md)
- **Schema:** [`docs/projects/table-build/schema-delta.md`](../../projects/table-build/schema-delta.md)

---

## Change log

- 2026-04-26 — Created. Gate 4 Design deliverable. All design constraints (C1–C12) accumulated through Gates 1, 2, 3 are inline. Pre-implementation; no Known-issues yet. Pending: schema-delta finalization (background agent in flight) + owner authorization of DCOMP-W4-A1 backlog re-scope before any Phase 0 work begins.
