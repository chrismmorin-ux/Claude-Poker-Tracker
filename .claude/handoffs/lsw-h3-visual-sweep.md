# Handoff: LSW-H3 — Visual verification sweep (surface-audit closeout + B1 unblock)

**Status:** COMPLETE (2026-04-22)
**Started:** 2026-04-22
**Closed:** 2026-04-22
**Owner:** Claude (main)
**Project:** `docs/projects/line-study-slice-widening.project.md`
**Backlog item:** LSW-H3
**Origin audit:** `docs/design/audits/line-audits/btn-vs-bb-3bp-ip-wet-t96-surface.md`

---

## Delivered

- 12 evidence screenshots at 1600×720 in `docs/design/audits/line-audits/evidence/lsw-h3-00..11-*.png`:
  - `00` — line picker baseline
  - `01–04` — 4 remaining JT6 decision nodes (`turn_after_call`, `river_brick_v_calls`, `river_checkback`, `turn_brick_v_checkraises`)
  - `05–11` — 7 other-line flop roots (Q72r, K77, T98, AK2, J85mw, Q53mw, UTG-squeeze pre_root)
- Surface audit appendix filled in (`btn-vs-bb-3bp-ip-wet-t96-surface.md` — "Appendix — LSW-H3 visual-verification sweep" section replaces the placeholder).
- Per-line feasibility checklist mapped to LSW-B1's acceptance criteria.
- 3 new findings (H3-F1..F3) surfaced and routed.
- `LSW-H3` marked COMPLETE in BACKLOG; `LSW-B1` blockers updated (H3 removed, G6 added for MW lines); `LSW-G6` opened (MW bucket-EV engine, blocker for MW B1).
- STATUS.md updated.

## Key findings

- **All 11 walked nodes render cleanly.** No S1/S3/S7 surface defects fire — because only JT6 `flop_root` has `heroHolding` today, the `BucketEVPanel` doesn't render on the other 10 nodes. Feasibility work is pre-authoring scaffolding for B1.
- **F1 content-fix corrections verified live** on `river_checkback` (30% pot-odds math) and `turn_brick_v_checkraises` (184bb pot, 74.8/258.4 math).
- **B1 scope split:** 4 HU flop roots unblocked (Q72r, K77, T98, AK2); 2 MW flop roots blocked on LSW-G6; 1 preflop node skipped.
- **New ticket LSW-G6** — `BucketEVPanel` MW bucket-EV engine — needed before MW lines can widen.

## Next-session pointers

- **LSW-B1** — partial authoring now possible. Two lanes: (a) ship 4 HU flop roots in a single commit using the H3 feasibility checklist (Q72r / K77 / T98 / AK2 — T98 is the highest-SPI target); (b) wait for A2..A8 audits per-line if owner prefers audit-before-widen consistency.
- **LSW-G6** — MW bucket-EV engine — single session, medium effort. Unblocks J85 + Q53 MW widening.
- **LSW-A2** — audit `btn-vs-bb-srp-ip-dry-q72r` (longest line, 15 nodes / 6 decisions). May revise the H3 checklist's Q72r recommendation.
- **LSW-G4** — villain-first paradigm roundtable (no code) — still open from surface audit S5.

---

## Scope

Visual verification sweep at 1600×720 via Playwright. Per surface-audit closure plan + LSW-H3 acceptance:

1. **4 remaining decision nodes on `btn-vs-bb-3bp-ip-wet-t96`:**
   - `turn_after_call`
   - `river_brick_v_calls`
   - `river_checkback`
   - `turn_brick_v_checkraises` (renamed from `river_brick_v_checkraises` in LSW-F1)
2. **1 flop root per other line (7 total):**
   - `btn-vs-bb-srp-ip-dry-q72r`
   - `co-vs-bb-srp-oop-paired-k77`
   - `sb-vs-btn-3bp-oop-wet-t98`
   - `utg-vs-btn-4bp-deep`
   - `btn-vs-bb-sb-srp-mw-j85`
   - `co-vs-btn-bb-srp-mw-oop`
   - `utg-vs-btn-squeeze-mp-caller` (`pre_root` per B1 tier table)

Per node: 1 evidence screenshot + 1 appendix paragraph covering (a) which of S1/S3/S7 still fires post-H1, (b) infeasible `bucketCandidates` for the pinned combo if any, (c) `bucketCandidates` delta required before LSW-B1 authors `heroHolding` on that node.

**Deliverables:**
- Evidence screenshots in `docs/design/audits/line-audits/evidence/`
- Appendix section appended to `btn-vs-bb-3bp-ip-wet-t96-surface.md`
- Per-line feasibility checklist LSW-B1 can consume
- No code changes

---

## Files I Own (this session)

- `docs/design/audits/line-audits/btn-vs-bb-3bp-ip-wet-t96-surface.md` (appending to)
- `docs/design/audits/line-audits/evidence/*.png` (new files only)
- `.claude/handoffs/lsw-h3-visual-sweep.md` (this file)
- `.claude/BACKLOG.md` (close LSW-H3 + B1 blocker update)
- `.claude/STATUS.md` (session update)

## Files I Will NOT Touch

- `src/utils/postflopDrillContent/lines.js` — content authoring (widening) is LSW-B1's job, not this sweep.
- Any file under `src/` — H3 is strictly a visual-verification pass.

---

## Method

- `npm run dev` in background.
- Playwright MCP: `browser_resize 1600×720`; navigate PostflopDrills → Line tab → pick line → walk to target node via `browser_click` on branch choices or state-tracker retry-from-breadcrumb.
- For decision nodes: reveal bucket-EV panel + toggle archetypes as relevant (abbreviated: Reg only unless surface defect depends on archetype).
- Screenshot at each node → `evidence/<line-id>-<node-id>-h3-<NN>-<label>.png`.

---

## Status log

*Populated during session.*
