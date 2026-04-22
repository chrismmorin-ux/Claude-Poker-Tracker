# Handoff — Design Compliance Wave 1 Session 1

**Session:** 2026-04-21
**Owner this session:** Claude (main)
**Project:** `.claude/projects/design-compliance.md` → DCOMP-W1
**Roadmap:** `docs/design/ROADMAP.md` (Wave 1 — Core Table Surfaces)
**Status:** CLOSED — Gate-2 blind-spot roundtable on TableView shipped; owner triage required before proceeding to heuristic audit.

---

## Scope

First session of Wave 1. Per the roadmap, Gate 2 (blind-spot roundtable) is **RECOMMENDED** for TableView before the formal heuristic audit. This session runs that roundtable.

Wave 1 overall is 6–8 sessions: 3 audits (table-view, showdown-view, sessions-view) + implementation of P1 findings.

## What I did

Dispatched two parallel independent sub-agents per the ROUNDTABLES.md template:
- **product-ux-engineer** on Stages A (Persona sufficiency), B (JTBD coverage), C (Situational stress test), E (Heuristic pre-check).
- **systems-architect** on Stage D (Cross-product / cross-surface).

Synthesized their outputs, verified factual claims by direct code grep (3 claims verified: `window.confirm` at `CommandStrip.jsx:254`, `min-h-[40px]` at `SeatContextMenu.jsx:83`, phantom JTBD-TS-01/03 at `bubble-decision.md:57–58`), and produced the final audit file.

## Files I touched

Created:
- `docs/design/audits/2026-04-21-blindspot-table-view.md` — the roundtable output

Edited:
- `.claude/handoffs/design-compliance-wave1-session1.md` — this file

**No source code changed.**

## Key findings (verdict: YELLOW)

- **Stage A ⚠️** — 2 situational-persona gaps (ringmaster-in-hand, newcomer-first-hand)
- **Stage B ⚠️** — 2 new JTBDs needed (live hand-flag, pot validation); 1 framework defect (phantom JTBD-TS-01/03 in bubble-decision.md cites IDs absent from atlas)
- **Stage C ❌** — 4 situational mismatches; most severe is `window.confirm()` on Reset Hand (mid-hand-chris explicitly forbids modal interrupts)
- **Stage D ⚠️** — 5 cross-surface ripples: implicit persisted-hand schema; broken briefing-badge → review-queue nav loop; `autoOpenNewSession` as leaky reducer state; no sidebar tournament-overlay parity; orphaned F-W5 blocking MH-10 drill-in
- **Stage E ⚠️** — 5 heuristic pre-violations: `window.confirm`, inconsistent undo windows, 40px touch target, orbit-strip scroll indicator missing, ambiguous advice-source naming

All findings are evidence-linked (code lines verified where claimed).

## Why YELLOW not RED

Core personas + JTBDs cover TableView's surface area. Gaps are patch-scale, not structural. But there are enough of them — and the `window.confirm` finding alone is severe enough — that the formal heuristic audit should not start until owner triages the open questions.

## Open questions for owner (blocking Gate 3 / Gate 4 progression)

1. Author 2 new situational personas + 2 new Active JTBDs now (Gate 3), or defer until H1 triage?
2. Fix phantom JTBD-TS-01/03 inline now, or route via H1?
3. Treat PushFold widget (C3) as a discovery vs. bundle with audit findings?
4. Cross-product tournament overlay (D4) — expand Wave 5 or spawn its own project?

## What comes next

Blocked on owner triage. Once answered:

- **If Gate 3 needed:** author the 2 situational personas + 2 JTBDs (≈1 session).
- **Then Gate 4 (heuristic audit):** `audits/2026-04-22-table-view.md` with the carry-forward findings formalized into severity-scored, JTBD-linked audit findings per `METHODOLOGY.md`. Estimate: 1 session.
- **Then Gate 5 (implementation):** ship P1 fixes (`window.confirm` → toast+undo, touch-target bumps, etc.). Estimate: 1–2 sessions.

Wave 1 sessions-view + showdown-view audits can be dispatched in parallel once TableView is underway.

## Closed

1 task completed. Roundtable output is immutable per METHODOLOGY.md §Handoff; all future TableView work references the audit ID.
