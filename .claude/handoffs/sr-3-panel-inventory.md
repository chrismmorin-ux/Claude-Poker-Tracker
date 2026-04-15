# Session Handoff: sr-3-panel-inventory

**Status:** COMPLETE — All 6 groups resolved. Owner verdict on Group 6 (2026-04-12): **by-zone batching** for SR-4 (~6 sessions: Z0 → Z1 → Z2 → Z3 → Z4 → Zx). SR-4 now NEXT. | **Written:** 2026-04-12

## Next session: read this first

Before doing anything:

1. Read `.claude/STATUS.md` — current state.
2. Read this handoff (you're doing it).
3. Read `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — **doctrine is at v2** (UX-model reframe applied). Pay attention to §11 amendment log.
4. Read `docs/SIDEBAR_PANEL_INVENTORY.md` — 48 rows, Groups 1–5 verdicts recorded, glance-pathway section added.

Do NOT re-open Groups 1–5 unless the owner explicitly requests it. The UX-reframe at the end of the prior session was the major outstanding item; everything else is resolved.

## Order of operations for this session

### Step 1 — Walk owner through Group 6 (SR-4 batching strategy)

The remaining decision before SR-3 closes. Options:

- **By-zone batching** — one SR-4 session per zone (Z0 chrome → Z1 table read → Z2 decision → Z3 street card → Z4 deep analysis → Zx overrides). 5–6 sessions, easier review.
- **By-merge-group batching** — group elements that share drill-down patterns or data sources (e.g., all range-slot elements together, all tournament elements together). Fewer rework loops.
- **Single-session batching** — all 48 elements in one long spec-writing session. Fastest but harder to review.

**My default recommendation:** **by-zone.** Each session produces a self-contained deliverable the owner can review. Aligns with R-1.1 (fixed zones) — per-zone specs reinforce the zone as a mental unit.

If owner prefers different, record verdict in inventory.

### Step 2 — Close SR-3

After Group 6 verdict recorded:
- Inventory gate: all items ✅.
- Update `.claude/BACKLOG.md` — SR-3 REVIEW → COMPLETE; SR-4 BLOCKED → NEXT.
- Update `.claude/STATUS.md` — remove SR-3 from active, add SR-3 to Recently Completed.
- Update this handoff — PARTIAL-REVIEW → COMPLETE. Mark final.

### Step 3 (optional) — SR-4 kickoff

If time allows, begin SR-4 per-element spec authoring:
- Create `docs/sidebar-specs/` directory.
- Write a spec index (the standardized drill-down vocabulary from inventory §Glance Pathways).
- Write the first zone batch per the batching decision.
- Otherwise, write an SR-4 kickoff handoff for a fresh session.

## What has been done (prior session)

### Corpus extension (S1 → S13)
- 8 new corpus builders in `ignition-poker-tracker/test/replay/recorder.js` (buildS6…buildS13).
- 8 new signatures in `signatures.js`.
- 8 new test files (`s6-…test.js` through `s13-…test.js`).
- Replayer's `collectSnapshot()` extended with status/action-bar/tournament/recovery/no-table/street-progress regions + hero-folded derivation.
- `.jsonl` + `.yml` corpus files written to `.claude/projects/sidebar-rebuild/corpus/` via `scripts/dump-corpus.mjs` (one-shot serializer).
- Browser harness `corpus-data.js` imports all 13.
- `scripts/screenshot-corpus.mjs` captures all 13.
- Determinism: all 13 produce identical hashes across runs. Full extension test suite: **1,306 tests passing, 35 files, no regressions.**

### Screenshot capture
- `.claude/projects/sidebar-rebuild/screenshots/{S1..S13}/*.png` — every inventory row cites ≥1 frame.
- Key new evidence: S6 invariant badge visible; S7 stale tint + "Stale 12s" badge; S10 tournament bar with M 8.5 + NEAR BUBBLE + full detail panel; S11 observer mode (grayed cards + OBSERVING badge + scouting panel); S12 river active; S13 check indicators on seats.

### Inventory expansion (42 → 48 rows)
Six new elements surfaced during screenshot capture:
- 0.9 Pipeline health strip (PROBE → BRIDGE → FILTER → PORT → PANEL)
- 1.10 Seat check-mark indicator for checked streets
- X.4a/b/c Recovery banner sub-components
- X.5b–X.5h Tournament detail panel (7 sub-rows)
- X.6 Observer scouting panel
- X.7 OBSERVING badge on board

### Groups 1–5 decisions recorded
See `docs/SIDEBAR_PANEL_INVENTORY.md` for full detail. Summary:
- **Group 1 (8 duplicates):** 7 deletes/merges + 1 override (fold% kept, villain pills kept; seat style badges deleted).
- **Group 2 (2 dev affordances):** both behind debug flag.
- **Group 3 (range slot):** fixed-height single slot with hero-preflop / villain-postflop / placeholder modes; Rule V formalized.
- **Group 4 (corpus extension):** Full coverage — all 8 new corpora shipped.
- **Group 5 (8 architectural items):** all resolved in inventory §Cross-cutting resolutions.

### Doctrine v2 amendment (2026-04-12)
The owner clarified the sidebar's use pattern is **targeted glance with spatial memory**, not simultaneous scan. This invalidated R-1.2's ≤5-metric cap (which came from dashboard-reading research). Three amendments applied per R-11 process:
- **R-1.2 revised** — remove ≤5 cap; require spatial-stability + glance test.
- **R-1.3 rationale reinforced** — explain that reflow breaks glance pathways for all neighbours.
- **R-1.5 added** — every element declares a glance pathway (remembered location / default summary / drill-down affordance / expansion location).

Group 1–3 decisions were audited under v2 and all survive. Doctrine amendment log is in `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §11.

## Files modified this session

| File | Summary |
|---|---|
| `ignition-poker-tracker/test/replay/recorder.js` | +8 builder functions |
| `ignition-poker-tracker/test/replay/signatures.js` | +8 matcher functions |
| `ignition-poker-tracker/test/replay/replayer.js` | collectSnapshot extended |
| `ignition-poker-tracker/test/replay/replay-determinism.mjs` | CORPUS_IDS extended to S13 |
| `ignition-poker-tracker/test/replay/s{6..13}-*.test.js` | 8 new test files |
| `ignition-poker-tracker/side-panel/replay-harness/corpus-data.js` | +8 builder imports |
| `ignition-poker-tracker/scripts/screenshot-corpus.mjs` | corpus ID loop extended |
| `ignition-poker-tracker/scripts/dump-corpus.mjs` | NEW — one-shot .jsonl/.yml writer |
| `.claude/projects/sidebar-rebuild/corpus/S{6..13}-*.{jsonl,yml}` | 16 new files |
| `.claude/projects/sidebar-rebuild/screenshots/S{6..13}/*` | 8 new directories |
| `docs/SIDEBAR_DESIGN_PRINCIPLES.md` | v2 amendments (R-1.2, R-1.3, R-1.5) |
| `docs/SIDEBAR_PANEL_INVENTORY.md` | 48 rows, Groups 1–5 verdicts, glance pathway section, Group 1–3 audit, UX-reframe section |
| `.claude/STATUS.md` | SR-3 status, doctrine version |
| `.claude/BACKLOG.md` | SR-3 REVIEW status; SR-2 amendment note |
| `.claude/handoffs/sr-3-panel-inventory.md` | this file |

## Files next session may modify

- `docs/SIDEBAR_PANEL_INVENTORY.md` — Group 6 verdict only.
- `.claude/BACKLOG.md` + `.claude/STATUS.md` — SR-3 → COMPLETE, SR-4 → NEXT transitions.
- `.claude/handoffs/` — close this handoff; possibly open sr-4 handoff.
- `docs/sidebar-specs/*` — if SR-4 starts in same session.

## Gotchas / things not to break

1. **Doctrine is at v2.** Any spec written must cite v2 rule numbers. Prior session work was done under v1 for Groups 1–3 but audited and re-approved under v2. Do not re-edit those verdicts.
2. **IIFE constraint in replay tests.** One corpus per test file. If any future corpus is added, follow the same pattern.
3. **Fake clock mocks `Date.now()`.** S6 (invariant badge 30s decay) and S7 (stale advice 10s threshold) both depend on this. Do not revert to real Date.now() in tests.
4. **`collectSnapshot()` hash impact.** The replayer's snapshot schema was extended; S1–S5 hashes changed from their prior baselines but remain deterministic. If you ever compare hashes to an older baseline, recompute first.
5. **Rule V seat-selection rule** is already formalized in inventory — SR-4 range-slot spec must cite it.
6. **Stale advice (row 1.8) fires the `.stale` class only after a render.** If writing corpus-like tests, push a no-op nudge after 10s elapses to force re-render.

## SR-3 Status: PARTIAL-REVIEW
