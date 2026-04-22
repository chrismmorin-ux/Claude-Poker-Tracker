# Handoff — Design Compliance Wave 1 Session 3 (Gate 4 Heuristic Audit)

**Session:** 2026-04-21
**Owner this session:** Claude (main)
**Project:** `.claude/projects/design-compliance.md` → DCOMP-W1
**Status:** CLOSED — Gate 4 heuristic audit on TableView shipped. Draft pending owner review before Gate 5 implementation.

---

## Scope delivered

Gate 4 per LIFECYCLE.md — formal heuristic audit on TableView, now with an expanded framework (4 new JTBDs, 2 new situational personas, canonical hand-schema contract, cross-surface journey all added in W1-S2). Zero source code touched.

## Files touched

**Created:**
- `docs/design/audits/2026-04-21-table-view.md` — the audit file, 12 findings, 4 observations, 4 open questions, prioritized fix list, copy-paste backlog proposals.
- `.claude/handoffs/design-compliance-wave1-session3.md` — this file

**Edited:**
- `docs/design/surfaces/table-view.md` — Known issues reference the new audit + sequencing note
- `.claude/BACKLOG.md` — DCOMP-W1 progress update

**No source code changed.**

## Method

- Dispatched `product-ux-engineer` agent with an explicit exclusion list (the 6 carry-forward findings from Gate-2 blind-spot) and instructions to find NOVEL findings only. Target 3–6; it returned 6.
- Verified all 3 code claims that drove severity-3 ratings by direct file read: `SizingPresetsPanel.jsx:58-66`, `CommandStrip.jsx:133-172`, `ControlZone.jsx:54-74`, `PotDisplay.jsx`, `LiveAdviceBar.jsx:171-199`.
- Synthesized 6 carry-forward + 6 novel = **12 findings** total.
- Re-scored each finding's severity against the 4 primary situational personas (mid-hand-chris, between-hands-chris, ringmaster-in-hand, newcomer-first-hand).

## Findings summary

**12 findings, 4 at severity 3 (P1), 6 at severity 2 (P2), 2 at severity 1 (P3).** No severity-4.

### P1 (candidate for immediate Gate 5 implementation)

- **F1** — `window.confirm` on Reset Hand at `CommandStrip.jsx:254`. Replace with existing toast+undo pattern. ~S effort.
- **F2** — Orbit tap-ahead silently folds multiple seats with only post-hoc toast. Add preview-count badge. ~M effort.
- **F3** — Sizing preset long-press opens editor with no indication of which slot is being edited (all 4 buttons share the same handler with no `slotIndex` argument). Thread slot index through. ~S effort.
- **F4** — LiveAdviceBar 20s-60s "fading" state has no explicit label; opacity-only signal is below glance threshold for mid-hand-chris. Add AGING badge. ~S effort.

### P2

- F5 undo-toast duration constant (5s vs 6s mismatch)
- F6 recent-players list scroll/count affordance
- F7 orbit strip horizontal scroll no affordance (wrap layout alt)
- F8 recent-players row `min-h-[40px]` below 44px floor
- F9 PotDisplay inline edit keyboard interrupt on the felt
- F10 Reset Hand / Next Hand vertical proximity (compounds with F1 post-fix)

### P3

- F11 rename `useOnlineAnalysisContext` (developer clarity)
- F12 RangeDetailPanel reopen-last affordance

### Sequencing dependency flagged

F1 and F10 are **coupled**: fixing F1 (removing `window.confirm`) INCREASES the severity of F10 (proximity). Audit recommends shipping F1 and F10 together, or at minimum F10 before F1 ships alone.

## Observations without fixes (4)

- CardSelectorPanel Clear Board / Clear Hole with no undo — candidate for future audit.
- Street tab backward nav without guard — open state-machine question.
- FoldCurveTooltip clipping risk in narrow viewports — blocked on Playwright.
- TableView at 598 LOC (ARCH-003) — structural decomposition, separate track.

## Open questions (4, owner input needed)

1. Does the 20s fade threshold (F4) reflect when a recompute would change the verdict?
2. Is Reset Hand used at all? Telemetry would clarify F1/F10 tradeoff.
3. Does the SeatContextMenu recent list actually overflow in practice?
4. Does ringmaster-in-hand exist as a real use case (PROTO persona, no Chris observation yet)?

## What comes next

- **Owner review** of the audit draft. Four P1 fixes can ship immediately after approval.
- **Gate 5 (implementation)** on the 4 P1 findings — est. 1 session (all P1 are S or M effort; F2 is M, rest are S). Visual verification on reference device required since Playwright remains unavailable.
- **P2/P3 findings** queued for subsequent sessions — not blocking.
- **Parallel:** ShowdownView + SessionsView audits can be dispatched without additional Gate-2 roundtables (surface-bound, no new-interaction / no new-persona — per LIFECYCLE bypass policy). Each is 1 session.

## Long-term leverage

The framework expansions from W1-S2 (contracts/ primitive, ringmaster-in-hand + newcomer-first-hand personas, MH-10/MH-11/HE-17 JTBDs) were load-bearing on this audit:
- **F4 severity** was calibrated against newcomer-first-hand's inability to interpret opacity — that persona did not exist 24 hours ago.
- **F1 + F2 severity** was calibrated against ringmaster-in-hand's "non-modal-everything" requirement — same.
- **F9 pot correction** findings cite `MH-11`, which did not exist as a JTBD 24 hours ago.

The Gate 3 investment paid off in Gate 4 directly. Framework-level work IS audit-quality work.

## Closed

1 task completed. Wave 1 Session 3 delivers the formal audit that unblocks Gate 5 P1 implementation.
