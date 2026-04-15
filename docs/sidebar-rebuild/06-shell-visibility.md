# 06 — Shell Visibility Model (SR-6.17 Design Memo)

**Status:** DRAFT — awaiting owner approval
**Author:** Claude, 2026-04-15
**Unblocks:** All-zone DOM migration → SR-7 cutover
**Doctrine refs:** R-1.3 (no-reflow / slot reservation), R-2.4 (hand-scoped clears), R-5.1 (three-channel seat modifiers)

---

## 1. Problem

`#hud-content-v2` (SR-6.8) was authored with `class="hidden"` and is toggled by `renderAll` based on `hasTableHands`. The legacy container `#hud-content` is toggled by the same predicate. Only `#no-table` + `#pipeline-health` are shown in the no-table state.

Consequences that block SR-6.17:

1. **Z0 content has no zone home.** Status bar, pipeline-health strip, no-table hint, and the diag footer must render in the *no-table* state, but they currently sit **outside** both `#hud-content` and `#hud-content-v2`. Migrating them into `.zone-z0` would make them disappear whenever `hasTableHands` is false — i.e., the exact moment Z0 is most useful.
2. **Zx X.3 has no zone home.** X.3 is the "no active table detected" prompt. Same symptom.
3. **Z1–Z4 are hidable as a block, but not independently.** R-1.3 requires each zone to reserve its slot (min-height) even when empty. Today a single `hidden` class wipes all four slots at once when there's no table, violating the no-reflow invariant on the transition table-present → no-table.
4. **Legacy parity is fragile.** Any DOM moved into `#hud-content-v2` is hidden on the flag-off (legacy) path, so we can't migrate incrementally — each zone PR would have to double-write DOM until SR-7 cutover.

---

## 2. Options considered

### Option A — Leave Z0/Zx outside the v2 shell

- Only `Z1–Z4` migrate into `#hud-content-v2`.
- `#no-table`, `#pipeline-health`, `#status-bar`, `#diag-footer` remain siblings of the shell.
- **Pros:** smaller edit; no visibility-model rewrite.
- **Cons:** weakens the "6 zones, one shell" mental model from SR-4; splits Z0 DOM across two containers; violates R-1.3 still (Z0 height isn't slot-reserved anywhere); future Zx overlay rules can't address "above Z0" vs "above Z1" uniformly.

### Option B — Always-show shell, per-zone self-managed visibility ✓

- `#hud-content-v2` drops its own `hidden` toggle entirely — it is always shown once `sidebarRebuild` is on.
- Each `.zone-z*` renders its own content at all times. **Min-heights are always reserved** (R-1.3). Content inside may be empty or render zone-specific empty-state (e.g., Z0 renders pipeline-health + no-table hint; Zx renders X.3 when appropriate).
- `hasTableHands === false` no longer hides the shell; instead it is an input to each zone's render function.
- **Pros:** matches R-1.3 exactly (no zone ever collapses to 0px); uniform mental model ("six slots, always present, content varies"); enables independent Zx overlay rules; matches the handoff's preferred recommendation.
- **Cons:** larger edit; requires each zone-render function to handle the no-table case explicitly.

**Recommendation: Option B.** The doctrine cost of Option A is permanent; the engineering cost of Option B is paid once.

---

## 3. Per-zone visibility contract (Option B)

Each `.zone-z*` is always rendered with its reserved min-height. Content varies by `hasTableHands` and by live state.

| Zone | Slot height | No-table state | Between-hands | Mid-hand |
|------|-------------|----------------|---------------|----------|
| **Z0** (chrome) | 72px | status-bar + pipeline-health + no-table hint | status-bar + (health strip hidden) | status-bar |
| **Z1** (table read) | 204px | *empty* (min-height reserved) | seat arc (vacancies visible) | seat arc + villain pills |
| **Z2** (decision) | 150px | *empty* | B1 fix: blank | headline + SPR + board |
| **Z3** (street card) | 300px | *empty* | between-hands card | street-adaptive content |
| **Z4** (deep analysis) | 24px | collapsed chevron row (no content) | chevron row | chevron row; expands on click |
| **Zx** (overlay) | 0–N px | X.3 "no active table" overlay (replaces empty Z0–Z4 content? see below) | X.6/X.7 observer badge, etc. | X.1/X.4 recovery banners |

### Zx placement question (resolve during implementation)

X.3 "no active table detected" is a full-panel message, not an overlay on top of content. Two sub-options:

- **X.3 lives in Z0**, shown only when `!hasTableHands`. Z1–Z4 reserve empty slots below. Matches the Zx-overrides batch ruling that X.3 is "Z0-level content".
- **X.3 lives in Zx**, rendered across the span of Z1–Z4. Cleaner for a long prompt, but couples Zx to zone geometry.

**Recommended:** X.3 in Z0 (per the Zx batch). Z1–Z4 reserve empty slots below with min-heights — this is *deliberately* visible to the user as "the HUD is ready, table just isn't connected yet", which matches the sidebar's purpose.

---

## 4. Migration plan (implementation session, post-approval)

Ordered to preserve flag-off parity at every step.

1. **Shell unlock.** Remove `renderAll`'s `hudV2.hidden` toggle for the no-table branch; `#hud-content-v2` is shown iff `settings.sidebarRebuild === true`. Legacy `#hud-content` still owns flag-off. No DOM moves yet — flag-off path unchanged.
2. **Z0 migration.** Move status-bar + pipeline-health + no-table hint + diag-footer DOM into `#zone-z0`. Clone structure to `#hud-content` legacy slots kept intact until SR-7 (so flag-off is unaffected). Actually — these chrome elements are *shared* between flag-on and flag-off. Resolution: **leave them as siblings of `#main-content` for now**, and declare Z0's "slot" is satisfied by the existing chrome. Treat Z0 as a virtual zone whose height is contributed by the status-bar + pipeline-health strip above `#hud-content-v2`. Update the CSS `min-height: 72px` on `.zone-z0` to `0` since the slot is filled externally.
   - *Alternative:* physically move the chrome inside `#hud-content-v2 > .zone-z0`, and hide the outside copies when `sidebarRebuild` is on. Heavier but cleaner long-term. Decide at implementation time.
3. **Z1 migration.** Move `#seat-arc` into `#zone-z1`. Flag-off leaves the legacy DOM in `#hud-content`. Requires dual-mount OR a move-based approach; **use move** (`appendChild`) on boot based on flag, so only one copy exists.
4. **Z2 migration.** Move `#action-bar` + `#context-strip` + `#cards-strip` + `#street-progress` into `#zone-z2`.
5. **Z3 migration.** Move `#street-card` + `#between-hands` + `#plan-panel` + `#app-launch-prompt` into `#zone-z3`.
6. **Z4 migration.** Move `#more-analysis-*` + `#model-audit-*` into `#zone-z4`.
7. **Zx migration.** Move `#recovery-banner` + tournament-bar/detail into `#zone-zx` (overlay slot). `#tournament-bar` is a slim inline element — may stay in Z0 or move to Zx depending on Zx-batch ruling. Verify against `docs/sidebar-specs/zx-overrides.md` X.5.
8. **Flag-on harness sweep.** Walk all 16+ fixtures with `settings.sidebarRebuild = true`. Diff against flag-off snapshots; resolve deltas.
9. **Update tests.** `zone-shell.test.js` currently pins the 6 empty containers; extend to assert Z0–Z4 have expected children after migration. `z0-chrome.test.js` extends to assert chrome lives in `.zone-z0` (if we take the physical-move approach).

**Sizing:** steps 1+2 are ~S; 3–7 are each ~S–M; 8+9 are ~M. Full session = L. The ordering above means flag-off stays green at every step.

---

## 5. Risk register

| Risk | Mitigation |
|------|------------|
| Chrome elements (status-bar, pipeline-health) moved into shell break flag-off | Keep dual-mount for Z0 chrome OR gate the physical-move on the flag at boot; default to move-on-boot-if-flag-on. |
| Harness (flag defaults false) misses flag-on regressions | Add `sidebarRebuild: true` variant to harness boot; run all 16 fixtures under both flag states in CI. |
| R-1.3 reflow regression from Z4's 24px → expanded transition | Already handled via `max-height` transition in existing CSS; verify Z4 chevron-row reserves 24px when collapsed AND doesn't reflow zones below it. |
| `#main-content` is the scroll container today; moving chrome in/out may alter scrollable area | Keep `#main-content` as the scroll parent; the physical-move is *within* it. |
| `clearForTableSwitch` references element IDs by `getElementById`; moves don't change IDs | Safe — IDs stable. But verify no CSS selectors use structural descendant paths (e.g., `#hud-content > #street-card`). |

---

## 6. Out of scope

- SR-7 cutover (flag default → true, legacy `#hud-content` deletion).
- `render-tiers.js` deletion (SR-6.16 decision: retain).
- Any Z4 content restructuring (SR-6.14 shipped the split; no changes here).

---

## 7. Decisions needed from owner before implementation

1. **Approve Option B** (recommended) vs Option A (leave Z0/Zx outside shell).
2. **Z0 chrome:** physical move into `.zone-z0` (cleaner, bigger diff) vs virtual (leave chrome outside shell, set `.zone-z0 { min-height: 0 }`). Recommend **physical move** for doctrine cleanliness, but willing to do virtual if diff-size is a concern.
3. **X.3 placement:** Z0 (recommended) vs Zx.
4. **Legacy path at each step:** approve the move-on-boot-by-flag approach (one DOM copy, location depends on flag).

Once approved, implementation is one session at ~L.
