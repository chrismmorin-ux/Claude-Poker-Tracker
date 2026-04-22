# Handoff: LSW-A1 + LSW-F1 — Audit + content fixes for `btn-vs-bb-3bp-ip-wet-t96`

**Status:** COMPLETE (both audit + fixes shipped same session)
**Started:** 2026-04-22
**Closed:** 2026-04-22
**Owner:** Claude (main)

---

## Delivered

- `docs/design/audits/line-audits/btn-vs-bb-3bp-ip-wet-t96.md` — full audit, YELLOW verdict, 10 findings, 11 web-research queries (5 A, 4 B, 2 D), bucket-teaching queue for Stream B2.
- `.claude/BACKLOG.md` — LSW-A1 marked COMPLETE-DRAFT; LSW-F1 opened with 10 sub-items (A1..A10); LSW-G1 + LSW-G2 parked deferred with solver-access blocker.
- This handoff.

## Key findings (TL;DR)

- **Verdict: YELLOW.** 3 P1 content errors block Stream B widening on this line until fixed:
  1. The "BB has nut advantage on T96ss" premise is reversed — GTO Wizard data shows BTN has nut advantage on non-broadway middling boards; the donk is a real live-pool tendency dressed in principled language.
  2. `river_checkback` pot-odds math error: 25% claimed, 30% correct for a 75% bet. Internal inconsistency.
  3. Pot-accounting cascade across `river_brick_v_checkraises` + 2 child terminals.
- **Category-C (engine) findings deferred:** 2 candidates (topPair equity overstatement, fish multiplier insufficiency) blocked on solver access.
- **Category-D divergence:** the entire line is live-pool-framed, not solver-pure. Once F1 ships, document in POKER_THEORY.md §11.

## LSW-F1 — shipped same-session (2026-04-22)

Owner approved the LSW-F1 plan inline and fixes shipped same-day in a single commit. Summary of what landed:

- **A1** — flop_root `why` section rewritten to frame BB's donk as live-pool exploit, not nut-advantage-driven. References POKER_THEORY.md §9.1.
- **A2** — Raise-branch rationale expanded with sub-archetype nuance ("calling-station donker" vs tighter fish).
- **A3** — "TPTK-ish" → "top-pair-strong-kicker" across both flop_root rationales.
- **A5** — `river_checkback` pot-odds math corrected: 25% → 30% for 75% pot bet; formula cited explicitly.
- **A6** — Node `river_brick_v_checkraises` → `turn_brick_v_checkraises` (2 string changes).
- **A7** — Pot-accounting reconciled across the check-raise node and 2 child terminals: node pot 108 → 184; prompt "90bb total" → "112bb total"; why-section math "47bb to win 155bb → ~30%" → "~75bb to call into ~184bb pot → ~29%"; `terminal_correct_fold_cr.pot` 108 → 184; `terminal_called_cr_light.pot` 200 → 258.
- **A8** — New terminal `terminal_river_overfold_bluffcatch` authored (bluff-catch-fold pedagogy); `river_checkback → Fold` rerouted from the shared `terminal_flop_overfold` to the new terminal.
- **A9** — `terminal_flop_raise_folds_weak.pot` 50 → 38.5 (raise-called state, aligned with copy) with comment. (Plan originally proposed removing pot, but schema validates `pot` as required number.)
- **A10** — `terminal_river_overbet_spew.pot` kept at 78 (most-common reach) with a comment documenting the multi-path ambiguity. Same schema constraint as A9.
- **D1** — POKER_THEORY.md §9 "Documented Divergences" section created; §9.1 documents the live-pool donk framing as intentional divergence.
- **A4 deferred** per audit's own guidance.

### Tests / build

- Postflop-drill suite: 311/311 green.
- `engineAuthoredDrift` snapshot regenerated (node-key rename).
- Full suite: 6257/6258 (1 pre-existing precisionAudit flake unchanged).
- `npm run build`: clean.

## Next-session pointers

- **LSW-A2** — audit `btn-vs-bb-srp-ip-dry-q72r` (15 nodes, 6 decisions, longest line). 1-2 sessions.
- **LSW-B2 unblocked on this line** — bucket-teaching widening on `river_brick_v_calls` (thin-value-vs-fish flip) and `river_checkback` (bluff-catch flip) can now ship, since the pot-odds math the bucket-EV panel computes against is correct.
- **LSW-G1 / G2 still deferred** on solver access.
**Project:** `docs/projects/line-study-slice-widening.project.md`
**Backlog item:** LSW-A1
**Audit output:** `docs/design/audits/line-audits/btn-vs-bb-3bp-ip-wet-t96.md`

---

## Files I Own (this session)

- `docs/design/audits/line-audits/btn-vs-bb-3bp-ip-wet-t96.md` (new — being authored)
- `.claude/handoffs/lsw-a1-btn-vs-bb-3bp-wet-t96.md` (this file)

## Files I Read (reference only — not editing)

- `src/utils/postflopDrillContent/lines.js` lines 669–1295 (the JT6 line)
- `src/utils/postflopDrillContent/lineSchema.js` (for `resolveBranchCorrect` fallback contract)
- `.claude/context/POKER_THEORY.md` (prior, not evidence per elevated audit standard)
- `docs/design/audits/line-audits/_TEMPLATE.md` (template structure)

## Files I Will NOT Touch

- `src/utils/postflopDrillContent/lines.js` — audit is read-only; content fixes route to Stream F in a later session.
- Any file in `src/utils/exploitEngine/` — engine changes route to Stream G in a later session.

## Audit method

Per elevated standard (2026-04-22): POKER_THEORY.md is prior, not evidence. Every decision node receives ≥1 external web-research query per non-obvious claim. Categorize A/B/C/D per query.

## Scope

12 nodes (5 decision + 7 terminal). Decision nodes: `flop_root`, `turn_after_call`, `river_brick_v_calls`, `river_checkback`, `river_brick_v_checkraises`.

## Open questions for next session

(To be populated if any uncategorizable-at-time queries surface — e.g., need a reg to eyeball with a solver subscription.)
