# Handoff — Design Compliance Wave 0 Session 1

**Session:** 2026-04-21
**Owner this session:** Claude (main)
**Project:** `.claude/projects/design-compliance.md` → DCOMP-W0
**Roadmap:** `docs/design/ROADMAP.md` (Wave 0)
**Status:** CLOSED — 6 of 11 remaining surfaces brought to Tier A

---

## Scope

Batch-author surface artifacts for 6 of the 11 main-app surfaces that were at `○` in `surfaces/CATALOG.md`. Tier A baseline only — no audits, no code changes, no fix work. Purely documentation of current state.

Completed this session:
- `table-view` (598 LOC, ARCH-003 threshold — flagged)
- `showdown-view` (350 LOC, two-mode surface — card-select / summary)
- `sessions-view` (419 LOC — online/live split flagged)
- `stats-view` (296 LOC — dual-source data flagged)
- `players-view` (509 LOC — parallel to picker-flow flagged)
- `settings-view` (132 LOC — platform surface, multiple paused features noted)

Remaining for Session 2 of Wave 0:
- `analysis-view`
- `hand-replay-view`
- `tournament-view`
- `online-view`
- `preflop-drills`
- `postflop-drills`

## Files I touched (docs only — no source changes)

Created:
- `docs/design/surfaces/table-view.md`
- `docs/design/surfaces/showdown-view.md`
- `docs/design/surfaces/sessions-view.md`
- `docs/design/surfaces/stats-view.md`
- `docs/design/surfaces/players-view.md`
- `docs/design/surfaces/settings-view.md`

Edited:
- `docs/design/surfaces/CATALOG.md` — flipped 6 entries from `○` to `●` + change-log entry
- `.claude/STATUS.md` — Wave 0 session 1 progress entry
- `.claude/handoffs/design-compliance-wave0-session1.md` — this file

## Tier A acceptance check

Every artifact includes (per ROADMAP Tier A criteria):
- ✓ ID + code paths
- ✓ Route / entry points
- ✓ Purpose paragraph
- ✓ JTBDs served (primary + secondary, linked to atlas)
- ✓ Personas served (linked to core + situational persona files)
- ✓ Anatomy (ASCII diagram for non-trivial layouts)
- ✓ State / context contract
- ✓ Key interactions
- ✓ Known behavior notes + known issues + potentially missing
- ✓ Test coverage pointer
- ✓ Related surfaces
- ✓ Change log

## INVENTORY reconciliation

All 6 surfaces map to already-documented features in `features/INVENTORY.md`:
- `table-view` → F-01 (Live Table Interface) + F-02 (Exploit Advice)
- `showdown-view` → F-03 (Showdown Resolution)
- `sessions-view` → F-04 (Session & Bankroll Tracking)
- `stats-view` → F-13 (Statistics Dashboard) + F-06 (Player Tendency Statistics)
- `players-view` → F-05 (Player Database & Recognition)
- `settings-view` → F-14 (Settings & Account)

No INVENTORY edits needed — per-feature detail already exists from Session 1b engine run.

## Notable flags captured (for future audit work)

Captured in each artifact's "Known issues" / "Potentially missing" but not actioned:
- **table-view** — ARCH-003 (598 / 700 LOC threshold), legacy RT-36/RT-37/RT-43 items, advice-freshness UI gap
- **showdown-view** — Next Hand is irreversible with no confirmation
- **sessions-view** — online imports not visually separated from live sessions; DE-71 (tax export) and F-P14 (multi-currency) not served
- **stats-view** — dual-source (session vs cross-session) data labelling unclear; no confidence / sample-size cues
- **players-view** — parallel to picker flow (two surfaces for PM-05); no bulk operations; F-P02 / F-P10 not served
- **settings-view** — F-W3 (Firebase Cloud Sync) paused surface is dormant; F-P19 accessibility not served

These will surface formally in Wave 1 / 4 audits, not as work in this wave.

## What comes next

- **DCOMP-W0 session 2** — 6 more artifacts (analysis-view, hand-replay-view, tournament-view, online-view, preflop-drills, postflop-drills). Same batch-author pattern. ~1 session.
- After W0 closes: DCOMP-W1 (core-table surfaces audit + P1 fix) becomes unblocked. TableView is the first Gate-2 roundtable candidate.
- **H1** (discovery-triage hygiene) can run in parallel at any point.

## Verification

No source code changed. No tests run (nothing to test). The only verifiable artifact is markdown correctness:
- `grep -n "^|" docs/design/surfaces/CATALOG.md` shows 6 `●` entries in the routed-views table that were previously `○`.
- Each new file linked-checks against `docs/design/personas/**` and `docs/design/jtbd/**` (verified by eye; all referenced files exist).

## Closed

All 6 tasks in this session completed. Project is ready for W0 session 2 whenever the owner wants to continue.
