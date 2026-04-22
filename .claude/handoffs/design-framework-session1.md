# Handoff — Design Framework Session 1 + 1b

**Session:** 2026-04-21
**Owner this session:** Claude (main)
**Status:** CLOSED — Session 1 scaffolding + Session 1b engine expansion both shipped

## What this session is doing

Building the scaffold for a reusable design artifact system at `docs/design/`. No source code is touched this session. Output is ~18 markdown files spanning personas, JTBD atlas, heuristics, templates, and an evidence ledger.

## Files I own (do NOT edit in parallel)

**Creating this session (all new, no conflicts expected):**

- `docs/design/README.md`
- `docs/design/METHODOLOGY.md`
- `docs/design/personas/_template.md`
- `docs/design/personas/core/chris-live-player.md`
- `docs/design/personas/situational/mid-hand-chris.md`
- `docs/design/personas/situational/between-hands-chris.md`
- `docs/design/personas/situational/post-session-chris.md`
- `docs/design/personas/situational/seat-swap-chris.md`
- `docs/design/jtbd/_template.md`
- `docs/design/jtbd/ATLAS.md`
- `docs/design/jtbd/domains/player-management.md`
- `docs/design/heuristics/nielsen-10.md`
- `docs/design/heuristics/poker-live-table.md`
- `docs/design/heuristics/mobile-landscape.md`
- `docs/design/surfaces/_template.md`
- `docs/design/surfaces/CATALOG.md`
- `docs/design/journeys/_template.md`
- `docs/design/audits/_template.md`
- `docs/design/evidence/LEDGER.md`

**Updating:**

- `.claude/STATUS.md` (add active session entry + design framework to project health)
- `.claude/projects/design-framework.md` (created this session)

## Scope boundary

- NO edits to `src/**/*`
- NO edits to tests
- NO edits to existing docs outside `docs/design/`
- NO dependency changes

## Next session

## Session 1 — final state

All 19 scaffold files shipped under `docs/design/` (verified via directory listing 2026-04-21). No source code touched. STATUS.md updated. `.claude/projects/design-framework.md` is the project lifecycle file.

## Session 1b — engine expansion (same day)

Three research agents (market, feature-inventory, product-strategist) ran in parallel to expand the framework for multi-user design. Net new content:

- **personas/** expanded: 1 README + 14 new core personas + 6 new cross-persona situational sub-personas = 21 new persona files (on top of existing Chris persona + 4 Chris-specific situational).
- **tiers/** added: README + template + 4 tier files (Free / Plus / Pro / Studio) + sidebar-lite alt track = 7 files.
- **products/** added: README + main-app + sidebar-extension = 3 files.
- **features/** added: README + INVENTORY (14 shipped + 5 WIP + 20 proposed) + template = 3 files.
- **discoveries/** added: README + template + LOG + initial gap list with 20 items = 4 files.
- **jtbd/** expanded: ATLAS rewritten with 14 domains and ~90 JTBDs; 13 new domain files (mid-hand-decision, hand-entry, session-management, session-review, tournament-specific, drills-and-study, coaching, social-group, multi-device-sync, subscription-account, data-export-integration, cross-cutting, onboarding).
- **Updates:** README (directory map + status), METHODOLOGY (principles + steps), evidence LEDGER (3 new ENGINE-* entries citing agent outputs), project file (Session 1/1b lifecycle), STATUS.md.

Total new files Session 1 + 1b: ~58 in `docs/design/` + lifecycle files.

## Key design decisions logged

1. **Persona set fixed at 15.** Chris (reference) + 14 end-user archetypes. Each archetype is PROTO / unverified.
2. **Situational sub-personas split between Chris-specific and cross-persona.** Four Chris-specific (mid-hand, between-hands, seat-swap, post-session) + six cross-persona (bubble-decision, final-table-play, push-fold-short-stack, study-block, coach-review-session, home-game-settle).
3. **Tier dimension is expressive, not enforced.** No tier code exists; framework documents what tiers would gate if they did. Four tiers + one alt-track (sidebar-lite).
4. **Products are separated into two lines.** Main app (React/Vite web) vs. sidebar extension (Chrome MV3). Tiering applies independently per product line.
5. **Discovery pipeline captures missing features.** Audits that find gaps create discoveries (not open hopes). Discoveries have persona + JTBD + tier + effort + priority score and flow to BACKLOG.
6. **JTBD atlas covers ~90 jobs across 14 domains.** Session 1 only fully documented player-management (PM-01..09); Session 1b added domain files for the other 13.

## Areas flagged for owner review before Session 2

1. **15-persona roster** — any archetypes to remove, merge, or rename? Any missing?
2. **Tier dollar placeholders** — $19 / $49 / $149 are synthesized from market data. If real pricing is in mind, swap.
3. **20-item discovery list** — aggregated for triage. Owner may want to break some into individual discovery files with priority scoring now, or wait.
4. **Core persona Chris assumptions A1–A6** — still PROTO. Any assumption owner confirms should flip to VERIFIED.

## Next session scope

Session 2 will apply the framework to the player-selection surfaces:
- `src/components/views/TableView/SeatContextMenu.jsx`
- `src/components/views/PlayerPickerView/*`
- `src/components/views/PlayerEditorView/*`

Session 2 will produce:
- `docs/design/surfaces/seat-context-menu.md`
- `docs/design/surfaces/player-picker.md`
- `docs/design/surfaces/player-editor.md`
- `docs/design/journeys/player-selection.md`
- `docs/design/audits/2026-XX-XX-player-selection.md`

Two known issues (context menu ordering, landscape scroll) should appear as specific findings with evidence links; do not shortcut the audit to implement them early.
