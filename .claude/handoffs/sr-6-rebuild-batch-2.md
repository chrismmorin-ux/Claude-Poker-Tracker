# Session Handoff: sr-6-rebuild-batch-2

**Status:** CLOSED 2026-04-13 — 22 fixtures shipped; suite 1314 → 1534; replay determinism stable. Next handoff: `.claude/handoffs/sr-6-rebuild-batch-3.md`. | **Written:** 2026-04-13

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. `docs/sidebar-rebuild/05-architecture-delta.md` §4.3 — the list of ~19 corpus gaps identified during the SR-5 audit.
4. `.claude/handoffs/sr-6-rebuild-batch-1.md` — what SR-6.1 shipped (settings flags; do not re-introduce flags).
5. `ignition-poker-tracker/side-panel/__tests__/fixtures.js` — current 16-scenario corpus; new fixtures append here.
6. `ignition-poker-tracker/side-panel/replay-harness/` — replay determinism harness; new fixtures must produce deterministic hashes.

## Scope

Author the ~19 missing corpus fixtures so downstream SR-6 zone PRs (6.10–6.15) regression-test against a complete scenario set. This is spec → fixture work, not render code.

**Gap sources (from 05-architecture-delta.md §4.3 + zone batches):**

- **Z0:** 1 gap — boot-race `— captured` placeholder (unknown hands count).
- **Z1:** 1 gap — occupied-zero seat (player present, 0 hands → `—` placeholder on ring).
- **Z3:** 3 gaps — villain-postflop with range grid (3.6), multiway seat selector (3.11), no-aggressor placeholder on flop/turn (3.12).
- **Z4:** 4 gaps — RT-61 auto-expand before/after, no-plan path (advice without handPlan), 4.2-only (more analysis without model audit), debug-flag OFF with no audit row.
- **Zx:** 12 gaps — X.4c re-enable timer path, X.5 overlay placements (a/b/c variants), X.5d/e/f in-zone priority cases, X.6 observer takeover of Z2 slot, X.7 observer with tournament, X.1 between-hands strict predicate (connected + idle vs disconnected + mid-hand).

Cross-check against `docs/sidebar-specs/*.md` per-batch corpus-gap callouts. Each gap references the spec row it covers — use that to name the fixture.

**Out of scope for SR-6.2:**
- Any render code change. Fixtures may reveal bugs; file them as SR-6.x items, do NOT patch inside this PR.
- Changing existing fixtures. Only add new ones.
- Anything gated by `sidebarRebuild` flag = true. Flag stays false; fixtures exercise the legacy path so we have baseline hashes before SR-6.8 flips DOM structure.

## Acceptance gates

1. **Determinism** — `npm run replay:determinism` produces stable hash for each new fixture (run twice, compare).
2. **Spec coverage** — every gap in §4.3 has a fixture or a written justification for why it's merged into an existing one.
3. **Naming** — fixtures named after the spec row they cover (e.g. `z1_occupiedZeroSeat`, `z3_multiwaySelector`, `zx_observerWithTournament`).
4. **No regressions** — full suite `npm test` passes (currently 1314).

## Files this session will modify

- `ignition-poker-tracker/side-panel/__tests__/fixtures.js` — add new scenarios.
- `ignition-poker-tracker/test/replay/` — add per-scenario replay tests if the pattern calls for it (match existing S1–S11 structure).
- `ignition-poker-tracker/side-panel/replay-harness/` — fixtures surface automatically, but verify screenshots match expectations.

## Files this session must NOT modify

- `shared/settings.js`, `shared/constants.js` settings keys — sealed by SR-6.1.
- `side-panel/render-coordinator.js` `settings` slot — sealed.
- `side-panel/side-panel.js` settings boot/observer — sealed.
- Any SR-4 spec doc under `docs/sidebar-specs/`.
- Doctrine, inventory, audit.

## Known gotchas

- **Fixtures drive the harness AND the test suite.** Both consume `fixtures.js` — adding a fixture without screenshot verification means the harness UI gets a scenario with unchecked output.
- **Observer scenarios (Zx/X.6–X.7)** require `foldedSeats` including the hero; make sure `heroSeat` is in the folded list for those fixtures.
- **Tournament fixtures** need both `lastGoodTournament` and a live context with `tournamentLevelInfo` — missing the latter hides the raw fallback row.
- **Do not inline expected DOM strings** in fixtures. Keep them state-only; assertions live in the test files.

## Closeout checklist

- [ ] All ~19 gap entries either fixture-added or justified-as-merged
- [ ] Replay determinism passes
- [ ] Full suite passes
- [ ] Harness screenshots sanity-checked
- [ ] STATUS.md updated (SR-6.2 → COMPLETE, SR-6.3 → NEXT)
- [ ] BACKLOG.md updated (SR-6.2 → COMPLETE, SR-6.3 unblocked)
- [ ] Next handoff at `.claude/handoffs/sr-6-rebuild-batch-3.md` for SR-6.3 (RT-60 timer sweep)
- [ ] This handoff closed

## Why this ships next

SR-6.3 (timer sweep), SR-6.4 (renderKey completion), SR-6.5 (FSM authoring), and the zone PRs all need complete fixtures to verify "no-regression under flag off" before they start changing render paths. Ordering SR-6.2 second — right after the flag lands — means every subsequent PR runs its acceptance-gate tests against a mature corpus instead of racing fixtures alongside render changes.
