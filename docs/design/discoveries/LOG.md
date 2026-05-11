# Discoveries Log

Chronological index of all discoveries. Latest first.

---

## 2026-04-21 — Blind-spot audit on TableView (DCOMP-W1-S1)

Four discoveries surfaced by the Gate-2 blind-spot roundtable on TableView. Each has a dedicated file with personas, JTBD, tier, effort, WSJF.

- [2026-04-21-push-fold-widget.md](./2026-04-21-push-fold-widget.md) — Push/Fold verdict widget (≤15bb). State: CAPTURED. Tier: Pro. WSJF: ~21.
- [2026-04-21-briefing-badge-nav.md](./2026-04-21-briefing-badge-nav.md) — Seat badge → review-queue navigation. State: CAPTURED. Tier: Free+. WSJF: ~80 (cheap fix).
- [2026-04-21-decision-tree-fate.md](./2026-04-21-decision-tree-fate.md) — DecisionTreeView revive / retire / fold-in decision. State: CAPTURED. Tier: Pro or n/a. Owner decision needed.
- [2026-04-21-sidebar-tournament-parity.md](./2026-04-21-sidebar-tournament-parity.md) — Sidebar tournament-overlay parity (Hybrid / Online MTT Shark personas). State: CAPTURED. Tier: Pro. WSJF: ~5.6. May expand Wave 5 scope.

## 2026-04-21 — Session 1b engine run

Initial 20-item gap list surfaced by Session 1b engine expansion. Captured as one aggregated file, with individual break-outs deferred until triage.

- [2026-04-21-initial-gap-list.md](./2026-04-21-initial-gap-list.md) — 20 features across Pro / Studio / Sidebar-Lite / Platform tiers.

---

## Format for future entries

```
## YYYY-MM-DD — [source: audit-id / engine-run / user feedback]

- [YYYY-MM-DD-<name>.md](./YYYY-MM-DD-<name>.md) — Short title. State: [state]. Tier: [tier]. Priority: [score].
```

---

## State summary

| State | Count |
|-------|-------|
| SURFACED | 0 |
| CAPTURED | 4 (W1-S1 audit discoveries retain CAPTURED pending owner scoring) |
| SCORED | 4 (W1-S1 audit discoveries carry WSJF scores) |
| REVIEWED | 0 |
| QUEUED | 7 (DCOMP-H1 triage promoted 7 of the Session 1b gap-list items; individual break-out files deferred) |
| ARCHIVED | 11 (DCOMP-H1 triage — capture preserved; revisit when calculus shifts) |
| IMPLEMENTED | 0 |
| REJECTED | 1 (DCOMP-H1 triage — DISC-17 mixed-games) |
| RE-OPENED | 1 (DISC-03 voice input → WS-181 VCE — see 2026-05-11 entry below) |

---

## 2026-05-11 — DISC-03 re-opened as WS-181 Voice Card Entry (VCE)

DISC-03 (voice input for live entry — REJECTED 2026-04-22) is RE-OPENED with constrained scope:

- **Original rejection rationale (2026-04-22):** "PWA voice-capture APIs unreliable across Chrome / Safari / Android variants; low-confidence benefit at M-effort. Re-open if platform capabilities mature + user demand surfaces."
- **Re-open trigger (2026-05-11):** Owner-driven demand + scope narrowed from "all live entry" (actions + cards) to "board + villain showdown cards only" (R2 binding) + ship-or-drop framing (R3 binding) + Web Speech only (R1 binding, no Whisper / no cloud).
- **Governance artifacts:**
  - Gate 1 audit: [`audits/2026-05-11-entry-vce.md`](../audits/2026-05-11-entry-vce.md) — verdict YELLOW
  - Gate 2 roundtable: [`roundtables/2026-05-11-blindspot-vce.md`](../roundtables/2026-05-11-blindspot-vce.md) — verdict YELLOW with 4 CRITICAL/HIGH findings for Gate 4
- **Ticket:** [`WS-181`](../../../.claude/workstream/queue/WS-181.yaml)
- **State:** RE-OPENED (was REJECTED). Final disposition determined by /decide ADR post-Gate-5 live-table validation (SHIP / KEEP-OFF / DROP).

---

## Change log

- 2026-04-21 — Created Session 1b.
- 2026-04-22 — DCOMP-H1 triage. 20 items from the 2026-04-21 gap-list classified into QUEUED (7) / ARCHIVED (11) / REJECTED (2). Rationale + per-item detail in `2026-04-21-initial-gap-list.md` triage-summary section. The 4 W1-S1-surfaced discoveries were NOT re-triaged (they already carry WSJF scores from their blind-spot audit; they await owner decision on scope/tier).
- 2026-05-11 — DISC-03 RE-OPENED as WS-181 (Voice Card Entry, board + showdown only, ship-or-drop). REJECTED count 2 → 1. RE-OPENED count 0 → 1.
