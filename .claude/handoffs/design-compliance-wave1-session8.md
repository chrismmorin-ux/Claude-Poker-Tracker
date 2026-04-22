# Handoff — Design Compliance Wave 1 Session 8 (TV-F7 Orbit Wrap-Layout)

**Session:** 2026-04-21
**Owner this session:** Claude (main)
**Project:** `.claude/projects/design-compliance.md` → DCOMP-W1
**Plan:** `C:\Users\chris\.claude\plans\twinkling-seeking-valiant.md` (Session 8 — M effort, visual verification critical)
**Status:** CLOSED — TV-F7 shipped. **All TableView findings now closed.**

---

## Scope delivered

The one remaining M-effort layout change on TableView. Small code change, bigger-than-usual visual-verification risk because the orbit strip is on the live-entry primary path.

### Code change (1 file, 2 small edits)

**`src/components/views/TableView/CommandStrip.jsx`** — TV-F7

Old (orbit strip block):
- `<div className="... flex gap-1 overflow-x-auto">` — horizontal scroll fallback when seats didn't fit.
- Per-button `flexShrink: 0` — buttons never compressed.

New:
- `<div className="... flex flex-wrap gap-1">` — buttons wrap to a second row when they don't fit.
- Per-button `flexShrink: 1` — buttons compress slightly before wrap triggers, packing more per row.

That's the entire change plus comments explaining the rationale.

### Why flex-wrap instead of grid

The plan proposed two options. Flex-wrap is:
- Smaller footprint (2 line changes vs a layout rewrite).
- Preserves existing per-button sizing + F2 badge positioning.
- Less jittery on intermediate widths per the plan's assessment.

Grid with `auto-fit` would work but requires adjusting per-button style. Not worth the larger blast radius for this audit finding.

### F2 badge compatibility

F2 preview-count badges (shipped S4) use `position: absolute; top: -6; right: -4`. Absolute positioning is relative to the nearest `position: relative` ancestor — the button itself (`.relative` class). Wrap doesn't affect badge positioning.

## Tests

- TableView subtree: **86/86 passing** (4 test files unchanged — no assertions on orbit-strip layout).

## Visual verification pending

Playwright MCP still unavailable. Owner checklist:

- [ ] At **reference viewport** (1600×720 or Samsung A22 landscape): 9-seat preflop orbit strip fits one row; no visible change from prior.
- [ ] At **narrow viewport** (e.g., 900×400): orbit strip wraps to 2 rows instead of horizontally scrolling. Every seat button visible + tappable.
- [ ] F2 "+N" badges correctly positioned top-right of each button after wrap.
- [ ] Tap-ahead (tap a downstream seat) still auto-folds intermediate unacted seats + F2 badge count matches.

## What comes next

**Only SV-F2 (P1, tip field) remains.** Per plan, S9 is a dedicated session because it's a schema change + multiple call sites + backward-compat concerns. After S9, S10 = DCOMP-W1 close.

## Closed

2 tasks completed. **DCOMP-W1: 16 of 17 findings shipped.**
