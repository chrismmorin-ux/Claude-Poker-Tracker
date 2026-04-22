# Audit — 2026-04-22 — stats-view

**Scope:** Surface — `stats-view`
**Auditor:** Claude (main) via code inspection at 1600×720 reference
**Method:** Direct Gate-4 heuristic audit. No Gate-2 — no novel product line or new persona class beyond the already-integrated review personas.
**Status:** Draft.

---

## Executive summary

**Verdict: YELLOW.** Read-only view (no destructive actions — no P0 risk). Main concerns: touch-target compliance across seat-selector + position/action toggles, dual-source labeling asymmetry between session-scoped stats and cross-session range profile (flagged by surface artifact), and missing confidence/sample-size cues so a 3-hand seat renders identically to a 300-hand seat. 0 P0, 3 P1, 3 P2, 3 P3.

---

## Findings

### F1 — Touch targets below ≥44×44 across seat selector + toggles

- **Severity:** 3 (P1)
- **Heuristics violated:** H-ML06
- **Evidence:**
  - `StatsView.jsx:127` Back to Table: `px-4 py-2` — ~40px.
  - `StatsView.jsx:209` seat-selector button (rounded-full): `px-3 py-1` — ~28px.
  - `StatsView.jsx:247, 263` grid position + action toggles: `px-2 py-1 text-xs` — ~28px.
- **Recommended fix:** `min-h-[44px] px-4` normalization across the 3 button classes. Small visual cost for significant touch-accuracy gain on the Chris / Post-session-chris reference-device use case.
- **Effort:** S — 3 class edits.
- **Proposed backlog item:** `DCOMP-W2-A3-F1 — StatsView touch targets ≥44×44` (P1)

### F2 — No confidence / sample-size cue on stats

- **Severity:** 3 (P1)
- **Heuristics violated:** H-N1 (visibility of system status — reliability of a stat is part of its state), H-PLT-01 (glance-readable but currently misleadingly so)
- **Evidence:** Surface artifact line 111 flags. Code: `StatsView.jsx` renders VPIP / PFR / 3bet etc. without sample-count annotation. A seat with 3 hands and VPIP=33% (1 of 3) visually reads identical to a seat with 300 hands and VPIP=33% (100 of 300) — very different reliability.
- **Recommended fix:** Two approaches:
  - **Minimum:** show hand count next to the stat (e.g., "VPIP 33% · n=3") with the stat dimmed (opacity-60) when n < 10.
  - **Stronger:** render a confidence bar / credible-interval tick based on Bayesian posterior (the codebase already has `bayesianConfidence.js`). Dim stats below a min-confidence threshold.
- **Effort:** S (minimum — annotate n + opacity rule) → M (Bayesian CI rendering).
- **Proposed backlog item:** `DCOMP-W2-A3-F2 — Sample-size + confidence rendering on stats` (P1)

### F3 — Dual-source labeling asymmetry not surfaced

- **Severity:** 3 (P1)
- **Heuristics violated:** H-N1 (visibility of system status — user doesn't know which stat is session-scope vs cross-session)
- **Evidence:** Surface artifact lines 100-101: "Range profile comes from cross-session data... Session-level stats come from this session only... Source-of-truth asymmetry between the two halves of the view — not surfaced to the user."
- **Observation:** A seat with 3 hands this session and a 300-hand cross-session history shows 3-hand session frequencies and 300-hand range profile with no signal that they're different scopes. If the user is trying to answer "what's this villain doing THIS session," the range profile misleads.
- **Recommended fix:** Label each panel with its scope.
  - Session stats block: "Session stats · {hand-count} hands this session"
  - Range profile block: "Historical range profile · {cross-session-hand-count} hands all-time (this session: {N})"
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W2-A3-F3 — Dual-source scope labeling` (P1)

### F4 — Filter-by-position at view level missing (surface-artifact gap)

- **Severity:** 2 (P2)
- **Evidence:** Surface artifact line 112. Selection today is seat-only; no "show me all seats playing LATE position" view.
- **Recommended fix:** Add a position-filter chip row below the seat selector. Filters the seat-selector to only show seats whose player is currently in the chosen position-group. Low-frequency feature; defer unless Rounder feedback prioritizes.
- **Effort:** M.
- **Proposed backlog item:** `DCOMP-W2-A3-F4 — Position-group filter across seats` (P2)

### F5 — Empty state (no active session) has small touch target

- **Severity:** 2 (P2)
- **Heuristics violated:** H-ML06
- **Evidence:** Surface artifact line 98. Empty state likely has a "start a session" prompt; inherits same touch-target issue as F1.
- **Recommended fix:** Bundle with F1's systematic pass.
- **Proposed backlog item:** Folded into F1.

### F6 — No export affordance (DE-72)

- **Severity:** 2 (P2)
- **Evidence:** Surface artifact line 113. No export of current-seat range profile.
- **Recommended fix:** Add a small Export button in the range-profile panel header. Output: JSON of current seat's range profile + sample-count metadata + scope label. Matches A2-F9 single-hand export pattern.
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W2-A3-F6 — Export current seat's range profile` (P2)

### F7 — No test file

- **Severity:** 1 (P3)
- **Evidence:** Surface artifact line 122.
- **Recommended fix:** Add `StatsView.test.jsx` covering: empty state, single-seat select, dual-source scope labeling (once F3 ships), sample-count annotations (once F2 ships). Low urgency since `useSessionStats` + `RangeGrid` are tested separately.
- **Effort:** M (several render tests).
- **Proposed backlog item:** `DCOMP-W2-A3-F7 — StatsView test file` (P3)

### F8 — Skill-map / mastery surfacing (DS-47)

- **Severity:** 1 (P3)
- **Evidence:** Surface artifact line 114. Natural home for self-review feature.
- **Recommended fix:** Not urgent; this is a Plus-tier discovery feature (DISC-12 ARCHIVED per H1). Note as pointer.
- **Proposed backlog item:** Pointer to DISC-12.

### F9 — 13×13 RangeGrid position-action toggles use small text

- **Severity:** 1 (P3)
- **Heuristics violated:** H-PLT-03 (dim-light readable), H-ML02
- **Evidence:** `StatsView.jsx:247, 263` — `text-xs` on position + action toggles.
- **Recommended fix:** Bundle with F1 systematic pass — bump to `text-sm` when increasing touch height.
- **Proposed backlog item:** Folded into F1.

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | F1 — Touch targets ≥44×44 (bundles F5 + F9) | 3 | S | P1 |
| 2 | F2 — Sample-size + confidence rendering | 3 | S-M | P1 |
| 3 | F3 — Dual-source scope labeling | 3 | S | P1 |
| 4 | F4 — Position-group filter | 2 | M | P2 |
| 5 | F6 — Range-profile export | 2 | S | P2 |
| 6 | F7 — StatsView test file | 1 | M | P3 |
| 7 | F8 — Skill-map (DISC-12 pointer) | 1 | — | discovery |

---

## Backlog proposals

```
- [P1] [DCOMP-W2-A3 F1] StatsView touch targets ≥44×44 systematic pass (bundles empty-state + grid toggles)
- [P1] [DCOMP-W2-A3 F2] Sample-size annotation + confidence dimming on session stats
- [P1] [DCOMP-W2-A3 F3] Dual-source scope labeling (session-stats vs cross-session range profile)
- [P2] [DCOMP-W2-A3 F4] Position-group filter across seats
- [P2] [DCOMP-W2-A3 F6] Export current seat's range profile
- [P3] [DCOMP-W2-A3 F7] StatsView test file coverage
```

---

## Observations without fixes

- The 5×2 seat-selector grid matches the session's 9-seat reality cleanly — keep.
- Empty-state (no active session) with BarChart3 icon is a clean pattern — keep.
- Read-only constraint (no writes) keeps StatsView simple and safe — keep.

## Review sign-off

- **Drafted by:** Claude (main), session 2026-04-22
- **Reviewed by:** [owner] on [date]
- **Closed:** [date]

## Change log

- 2026-04-22 — Draft.
