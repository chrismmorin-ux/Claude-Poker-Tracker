# Handoff — LSW-A2 Audit `btn-vs-bb-srp-ip-dry-q72r`

**Session:** 2026-04-22, Claude (main)
**Claim:** LSW-A2 (marked COMPLETE draft — awaits owner review)
**Duration:** single session, audit-only (no code changes)

## What shipped

1. **Audit file:** `docs/design/audits/line-audits/btn-vs-bb-srp-ip-dry-q72r.md` (650+ lines, A1-shape mirrored).
2. **BACKLOG updates:**
   - LSW-A2 marked `COMPLETE (DRAFT — awaits owner review)` with full summary.
   - New entry `LSW-F2` (P2, NEXT) — 6 P2/P3 findings bundled for single-commit ship.
3. **Task tracking:** 11 TaskCreate items walked through in-session (claim → scaffold → 6 external-validation rounds → writeup → F2 routing → handoff).

## Verdict

**GREEN (light).** Every one of the 6 `correct` flags is solver-aligned and externally confirmed. No P0/P1 blockers. The line is **cleaner than A1**:
- A1 (T96 3BP) had 3 P1 content errors (reversed nut-advantage premise, pot-odds math error, pot-accounting cascade) that blocked Stream B widening.
- A2 (Q72r SRP) has 1 P2 + 5 P3 — none shipping-blocking. Widening can proceed with or without F2 shipping first.

## Findings (6 total)

| # | Finding | Severity | Category | Effort |
|---|---------|----------|----------|--------|
| 1 | L-flop_root-F1 — BB 3bet range live-pool acknowledgment | P2 | D (with B-risk if unlabeled) | S |
| 2 | L-flop_root-F2 — `capped_range_check` framework drop | P3 | structural | S |
| 3 | L-turn_checked_back-F1 — pot-odds "~30%" → "~27%" | P3 | B | S |
| 4 | L-river_after_turn_checkback-F1 — "99 blocks 99" rewrite | P3 | B | S |
| 5 | L-river_after_flop_checkback-F1 — 50% sizing canon | P3 | B (owner preference) | S |
| 6 | L-terminals-F1 — pot 16.0 doesn't reconcile | P3 | structural | S |

Plus 1 POKER_THEORY.md §9.2 entry queued (D1 — BB live-pool flat range).

## External validation

**10 queries issued across 6 decision nodes (≥1 per node).** Breakdown: 7 A (no disagreement), 2 B (our content wrong — both minor), 1 D (intentional live-pool divergence, partially unacknowledged). Charter rule "zero-query audits fail review" satisfied.

Sources (14 citations in audit file): GTO Wizard (7), Upswing (3), Somuchpoker, PokerListings, PokerCoaching (2), Betting Data Lab.

**Strongest external validation:** `river_after_turn_checkback` CALL — GTO Wizard's "Calling Down Over-Bluffed Lines in Lower Limits" directly supports the authored answer. "If you find yourself on the river facing a bet with a bluff catcher… you should most likely close your eyes and call again. Yes, even with bottom pair!"

## Bucket-teaching queue (for LSW-B2)

Three HIGH-leverage river widening targets on Q72r — order by student-value:

1. **`river_after_turn_checkback`** — canonical polar-bluff-catch archetype flip. vs FISH/NIT: fold; vs REG/PRO: call. Strongest externally-validated spot in the roster so far. **DEPENDS ON LSW-F2-A4** (copy fix) first.
2. **`river_after_barrel`** — thin-value sizing flip. vs FISH/STATION: widen bet sizing; vs REG: 33%; vs NIT: check back. High leverage.
3. **`turn_checked_back`** — call-vs-probe archetype flip. Solid but less threshold-sensitive than the river nodes.

Two PARTIAL nodes (flop_root, turn_brick, river_after_flop_checkback) — archetype split exists on sizing preference, not bet/check binary. Defer to a later sizing-teaching upgrade.

## What did NOT ship (per plan)

Per the session plan (`C:\Users\chris\.claude\plans\warm-inventing-shell.md`), same-session LSW-F2 ship was **explicitly scoped** to "only if ≥3 category-B P0/P1 findings land." Only 2 category-B findings landed (both P3), and they aren't threshold-blocking — so F2 is deferred to its own session per plan.

This preserves the plan's "one audit-per-session rhythm" rule.

## Files touched

- **Created:** `docs/design/audits/line-audits/btn-vs-bb-srp-ip-dry-q72r.md`
- **Modified:** `.claude/BACKLOG.md` (LSW-A2 status COMPLETE + new LSW-F2 entry)
- **Not modified:** `src/utils/postflopDrillContent/lines.js` (no content fixes shipped); `.claude/context/POKER_THEORY.md` (§9.2 entry queued for LSW-F2); `.claude/STATUS.md` (update included in this handoff closing)

## Owner review needed

- Review `docs/design/audits/line-audits/btn-vs-bb-srp-ip-dry-q72r.md` — especially the D1 (BB live-pool framing) call. If owner accepts the live-pool framing acknowledgment fix (LSW-F2-A1), close the audit; if owner prefers a solver-current BB range rewrite, escalate to a content-rework ticket.
- LSW-F2-A5 is an **owner-preference** P3 (50% vs 33% river thin-value sizing on `river_after_flop_checkback`). Either choice is defensible. Flag for owner to pick in F2 shipping session.

## Suggested next batch

**Charter order: LSW-A3** (`co-vs-bb-srp-oop-paired-k77`). K77 is smaller (3 nodes, 2 decisions per the BACKLOG accept-criteria line) — should complete faster than A2. It's one of the two HU lines G4-IMPL migrated to v3 without an audit (Q72r was the other — now audited). Same charter-driven audit-first rationale applies.

Alternatively: ship LSW-F2 if owner approves in-session — S-effort bundle, ~30 min of edits + drift check.

## Verification trail

- Audit file read end-to-end: ✓
- 10 external web queries completed: ✓ (7 A / 2 B / 1 D)
- Sources documented with permanent citations: ✓
- Bucket-teaching queue populated: ✓
- Severity rubric applied per finding: ✓
- Prioritized fix list with ID/effort/priority: ✓
- Verdict assignment per rubric: ✓ (GREEN-light because zero P0/P1)
- BACKLOG status updates: ✓
- POKER_THEORY.md §9.2 entry queued (but not written — ships with LSW-F2)

No code changes; no test run required. Build state preserved from prior session (clean post-Commit 5).
