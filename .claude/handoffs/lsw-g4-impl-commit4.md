# Handoff: LSW-G4-IMPL Commit 4 — LSW-B1 line migration (Q72r + K77)

**Status:** COMPLETE (2026-04-22)
**Started:** 2026-04-22
**Owner:** Claude (main)
**Project:** `docs/projects/line-study-slice-widening.project.md`
**Backlog item:** LSW-G4-IMPL (+ partial LSW-B1)
**Preceding handoff:** `lsw-g4-impl-commit3.md`

---

## Scope

Fourth of 6 commits in the v2 migration. Migrates **2 of 4** HU flop roots per the LSW-H3 feasibility checklist and the aliases seeded in Commit 2.5. The other 2 HU lines (T98, AK2) stay on v1 pending G4-TD-3 `archetypeRanges.js` authoring.

## Delivered

### Modified files (1)

- `src/utils/postflopDrillContent/lines.js`:
  - **Q72r** `flop_root` (lines 40-45 area): added `heroView: { kind: 'single-combo', combos: ['A♠Q♣'], bucketCandidates: ['topPairGood'], classLabel: 'top pair, top kicker' }` + `villainRangeContext: { baseRangeId: 'btn_vs_bb_srp_bb_flat' }` + `decisionKind: 'standard'` + `decisionStrategy: 'pure'`.
  - **K77** `flop_root` (lines ~1870 area): added `heroView: { kind: 'single-combo', combos: ['A♥K♦'], bucketCandidates: ['topPairGood'], classLabel: 'top pair, top kicker (paired board)' }` + `villainRangeContext: { baseRangeId: 'co_vs_bb_srp_bb_flat' }` + `decisionKind: 'standard'` + `decisionStrategy: 'pure'`.

### Unchanged

- Engine (v1 + v2 parallel, untouched).
- Schema validator (v3 accepts both migrated nodes; migration guard enforces no-dual-authored).
- Panel components (v1 + v2 both shipped in Commit 3).
- Line content outside the two flop_root nodes.
- Tests (all pass unchanged — schema validation covers the new v3 fields automatically).

## Verification

- [x] **Targeted tests** — full drillContent + PostflopDrillsView regression: **455/455 passing** (unchanged; additive migration).
- [x] **Production build** — `npm run build` clean, `✓ built in 9.22s`.
- [x] **Q72r v2 render** (`docs/design/audits/evidence/lsw-g4-impl-commit4-q72r-v2.png`) — DECISION SURFACE v2 header · variant V1 · villain-first decomposition expanded showing AQ dominating 5 regions: DOMINATING Backdoor Straight Draw Only 36.3%/93%eq · DOMINATING Middle Pair 20.9%/82%eq · DOMINATING Backdoor Combo (BDFD+BDSD) 13.7%/92%eq · DOMINATING Air 10.1%/89%eq · DOMINATING Top Pair Strong Kicker 5.8%/89%eq. Pedagogically sharp — AQ on Q72r rainbow crushes BB's defend range almost entirely; only Q-higher makes it close.
- [x] **K77 v2 render** (`docs/design/audits/evidence/lsw-g4-impl-commit4-k77-v2.png`) — DECISION SURFACE v2 header · variant V2 (hero-first, villainAction null) · villain-first decomposition showing: DOMINATING Underpair (below board) 72.6%/97%eq · DOMINATING Two Pair 17.0%/82%eq · CRUSHED Trips 10.0%/9%eq · CRUSHED Premium (SF/Quads/Boat) 0.4%/2%eq. Paired-board "small cbet prints" pedagogy reads cleanly from the row distribution.

## Lines NOT migrated this commit

- **T98** (`sb-vs-btn-3bp-oop-wet-t98`) — requires `sb_vs_btn_3bp_btn_range` alias + BTN's 3bet-vs-SB range authored in `archetypeRanges.js` THREEBET_RANGES. **Blocked on G4-TD-3.**
- **AK2** (`utg-vs-btn-4bp-deep`) — requires `utg_vs_btn_4bp_btn_call` alias + BTN's call-of-4bet range. Not in `archetypeRanges.js` CALL_RANGES yet (4bp-call is a new action vs the existing open/call/threeBet/fourBet/limp set). **Blocked on G4-TD-3.**
- **J85mw** (`btn-vs-bb-sb-srp-mw-j85`) — MW line, **blocked on LSW-G6** (MW bucket-EV engine).
- **Q53mw** (`co-vs-btn-bb-srp-mw-oop`) — MW, **blocked on LSW-G6**.
- **UTG-squeeze** (`utg-vs-btn-squeeze-mp-caller`) — preflop `pre_root`; explicitly out of scope for bucket-ev-panel-v2 (different surface).

## Known observations from the two rendered lines

- **Q72r** hero-acts-after-villain-check (`villainAction.kind = 'check'`) routes to V1 via `selectVariant({villainFirst: Boolean(villainAction)})` because any villainAction is truthy. Pedagogically this is a hero-first decision (villain's check opens action); V1 vs V2 both share the same primitive stack so the render is identical. A future refinement could distinguish "villain committed" (bet/donk/raise) from "villain deferred" (check) in the `villainFirst` boolean — logged as tech-debt note but not a v1-ship blocker.
- **K77** renders correctly as V2 (`villainAction = null`, hero-first).
- Both lines' decompositions surface the domination teaching immediately without a reveal gate — the Path 2 restructure payoff is visible across multiple lines now, not just the canary.

## Files I Own (this session)

- `src/utils/postflopDrillContent/lines.js` (Q72r + K77 flop_root edits)
- `docs/design/audits/evidence/lsw-g4-impl-commit4-q72r-v2.png` (new)
- `docs/design/audits/evidence/lsw-g4-impl-commit4-k77-v2.png` (new)
- `.claude/handoffs/lsw-g4-impl-commit4.md` (this file)
- BACKLOG + STATUS updates

## Next-session pointers

**Commit 5 — v1 mechanical deletion** (the final commit). Grep-based criterion:

```bash
rg -l "heroHolding|byBucket|PinnedComboRow|BucketEVTable|DominationMapDisclosure|InapplicableDisclosure" src/
```

Should return empty (modulo deprecation notices or schema-guard references). Files to delete or trim:
- `src/components/views/PostflopDrillsView/BucketEVPanel.jsx` (v1 panel — whole file).
- `src/components/views/PostflopDrillsView/panels/PinnedComboRow.jsx` (v1 primitive).
- `src/components/views/PostflopDrillsView/panels/BucketEVTable.jsx` (v1 primitive).
- `src/components/views/PostflopDrillsView/panels/BucketRow.jsx` (v1 primitive, used only by v1 BucketEVTable).
- `src/components/views/PostflopDrillsView/panels/InapplicableDisclosure.jsx` (v1 primitive).
- `src/components/views/PostflopDrillsView/panels/DominationMapDisclosure.jsx` (v1 primitive; v2 ships VillainRangeDecomposition as replacement).
- `src/components/views/PostflopDrillsView/__tests__/BucketEVPanel.test.jsx` (v1 tests — fully retire).
- `src/components/views/PostflopDrillsView/LineNodeRenderer.jsx` — strip the `heroHolding` / v1 branch.
- `src/utils/postflopDrillContent/lineSchema.js` — can optionally deprecate `validateHeroHolding` + the legacy path (or keep for back-compat during the dual-path window that's now closing).

**Critical for Commit 5:** before deletion, audit every live-rendered node to confirm migration. Currently:
- Live via v2: JT6 flop_root (migrated Commit 3), Q72r flop_root (Commit 4), K77 flop_root (Commit 4) = **3 of 3 HU flop roots that can migrate now**.
- Still on v1: JT6 non-root nodes (turn_after_call, river_brick_v_calls, river_checkback, turn_brick_v_checkraises + 7 terminals), Q72r non-root nodes, K77 non-root nodes, T98 all nodes, AK2 all nodes, MW lines, UTG-squeeze.

**This means Commit 5 cannot be a pure grep-based delete yet** — many nodes still reference `heroHolding`-aware patterns (via the terminals + non-root rendering). Commit 5 will need:
- **Sub-commit 5a:** keep v1 primitive files but mark the v1 panel code path inert (a conditional render that never fires) — or deprecate `validateHeroHolding` so new `heroHolding` authoring is rejected going forward.
- **Sub-commit 5b (delete v1 files):** blocked on LSW-B2 + LSW-B3 completing the turn + river migrations OR on the existing v2-v1 fallback continuing for non-v3 nodes indefinitely.

Recommended alternative to Commit 5 as originally scoped: **defer v1 deletion** until LSW-B2/B3 migrate the rest of the content. For now, the v1 + v2 coexistence is the stable state — v2 renders where `heroView` is present, v1 renders everywhere else. The dual-path is already present and tested. The user-visible Path 2 goal (villain-first rendering on migrated lines) is achieved.

**Alternative Commit 5 (recommended for owner decision):** write a deprecation notice + add a content audit script that runs in CI ensuring no new `heroHolding`-only nodes are authored. Treat the v1 code as legacy-support until LSW-B2/B3 finish their content migrations. Clean deletion then becomes trivial at a later point.

## Tech-debt / follow-ups

- **G4-TD-1 (carried forward)** — call-kind EV modeling in `computeDecomposedActionEVs`. Applies to all migrated lines including Q72r + K77 now.
- **G4-TD-2 (carried forward)** — `recommendation.authoredReason` override path.
- **G4-TD-3 (carried forward)** — `archetypeRanges.js` authoring for `BTN_vs_SB` 3bet + `BTN_vs_UTG_4bet_call`. Unblocks T98 + AK2 migration.
- **G4-TD-4 (new this commit)** — `selectVariant` hero-first/villain-first boolean should distinguish check (deferred-to-hero) from bet/donk/raise (villain-committed). Currently any villainAction truthiness = villainFirst. Cosmetic for v1 ship since V1 and V2 share the same primitive stack.
