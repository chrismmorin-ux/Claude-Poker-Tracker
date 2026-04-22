# Handoff — Design Framework Session 2

**Session:** 2026-04-21
**Owner this session:** Claude (main)
**Status:** CLOSED — draft audit delivered; pending owner review

---

## What this session is doing

Applying the framework (Session 1 + 1b) to the player-selection experience. Three surfaces + one journey + one audit artifact. No source code edits (Session 3 handles fixes).

## Files I own this session

**Creating:**

- `docs/design/surfaces/seat-context-menu.md`
- `docs/design/surfaces/player-picker.md`
- `docs/design/surfaces/player-editor.md`
- `docs/design/journeys/player-selection.md`
- `docs/design/audits/2026-04-21-player-selection.md`

**May update:**

- `docs/design/discoveries/LOG.md` — if new discoveries surface
- `docs/design/discoveries/<new-discovery-files>.md` — individual break-outs if audit surfaces specific missing features
- `docs/design/evidence/LEDGER.md` — append audit-time observations
- `docs/design/surfaces/CATALOG.md` — move three surfaces from ○ to ●
- `.claude/STATUS.md`, `.claude/projects/design-framework.md`

## Scope boundary

- NO edits to `src/**/*`
- NO edits to tests
- Session 3 owns all fixes

## Final output

All 5 artifacts shipped:

- `docs/design/surfaces/seat-context-menu.md`
- `docs/design/surfaces/player-picker.md`
- `docs/design/surfaces/player-editor.md`
- `docs/design/journeys/player-selection.md`
- `docs/design/audits/2026-04-21-player-selection.md`

Also updated: `surfaces/CATALOG.md` (3 surfaces moved ○ → ●), `evidence/LEDGER.md` (new EVID-2026-04-21-AUDIT-SURFACE-CODE-READ entry).

## Audit summary (11 findings, 4 P1)

| # | Finding | Severity | Effort |
|---|---------|----------|--------|
| F1 | Clear Player buried at bottom when seat occupied (owner-reported) | 3 | S |
| F2 | No undo for Clear Player (asymmetric with retro-link undo) | 3 | S |
| F3 | Menu not state-aware (bundled with F1) | 2 | — |
| F4 | Touch targets < 44px at scale < 0.5 | 3 | S |
| F5 | Filter chip panel pushes results below fold on short viewports | 2 | S |
| F6 | Picker does not flag duplicate-to-multiple-seats | 2 | M |
| F7 | Player Editor landscape scroll failure (owner-reported) | 3 | M |
| F8 | AvatarFeatureBuilder always-expanded overwhelms Newcomer | 2 | S/M |
| F9 | Density asymmetry: PhysicalSection collapsible, AvatarFeatureBuilder not | 1 | XS |
| F10 | Swap-Player flow implicit; no direct action | 2 | M |
| F11 | Destructive adjacency (bundled with F1) | 2 | — |

**P1 (4 items) recommended for Session 3:** F1+F3+F11 (menu reorder), F2 (undo), F4 (touch targets), F7 (landscape scroll — reproduction first).

**P2 (4 items) recommended for Session 4+.** F5, F6, F8+F9, F10.

## Open questions (pre-Session-3)

1. **What does `assignPlayerToSeat` do when seat is already assigned?** Silent overwrite / reject / warn? F10 severity depends on this.
2. **Does retro-link follow a player across a re-assign?** Data-integrity concern beyond UX.
3. **Does batch mode survive the editor round-trip when CreateFromQueryCTA is tapped?** Unverified.

These should be answered early in Session 3 via code reading before implementing fixes.

## Next session

Session 3 implements P1 fixes in priority order with visual verification on 900×400 and smaller viewports. Tests added for each. No P2 items unless P1 is blocked.
