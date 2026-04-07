# Program: UI Quality

Status: GREEN
Owner: eng-engine (product-ux-engineer + performance-engineer personas)
Last assessed: 2026-04-07
Last verified against code: 2026-04-07

---

## Health Criteria

| Metric | Green | Yellow | Red | Current |
|--------|-------|--------|-----|---------|
| All views render at 1600x720 | No overflow/clipping | Minor clipping | Broken layout | Green (last visual check 2026-04-04) |
| Touch targets >= 44px | All interactive elements | 1-2 undersized | Many undersized | Green |
| Action buttons use ACTIONS.* constants | 100% | Missing for new action | Hardcoded strings | 100% |
| Design tokens in designTokens.js | All colors centralized | 1-2 inline colors | Many inline | Centralized |
| Advice staleness indicator | Active (badge + fade) | — | Missing | Active (RT-18) |
| Reset Hand confirmation guard | Present | — | Missing | Present (RT-14) |
| Components > 600 lines | 0 | 1 | 2+ | 1 (TableView 594 — ARCH-003 watch) |

## Active Backlog Items

- HE-2a: Prominent next-to-act display
- HE-2b: Preflop Quick Entry mode
- HE-2c: Showdown simplification
- 12.4: Table-level exploit aggregation
- ARCH-003: TableView at 594 lines (trigger: >700)

## Milestone Gates

| Gate | Status | Criteria |
|------|--------|---------|
| Hand entry UX | OPEN | HE-2a/2b/2c complete — streamlined flow for live play |
| Table-level exploits | OPEN | Aggregate tendencies shown in TableView (12.4) |
| Component size | PASSED | No component > 700 lines (ARCH-003 threshold) |

## Auto-Backlog Triggers

| Condition | Backlog Template | Priority |
|-----------|-----------------|----------|
| Inline hex color outside designTokens.js | "Inline color in [file] — move to designTokens.js" | P2 |
| Component exceeds 700 lines | "ARCH-003 triggered: [component] at [N] lines — split" | P1 |
| Action without ACTIONS.* constant | "Action [name] missing from gameConstants.js ACTIONS" | P1 |
| New view without scale prop handling | "View [name] missing responsive scaling" | P1 |

## History

| Date | Status | Notes |
|------|--------|-------|
| 2026-04-06 | GREEN | Initial assessment. Staleness indicator active, confirmation guards in place, design tokens centralized. Hand entry UX improvements pending. |
| 2026-04-07 | GREEN | R4 roundtable. Orbit strip touch targets reported at 36px (below 44px threshold) — tracked via RT-34. window.confirm() modal for Reset Hand noted as UX concern under live-game stress. UNDO_BATCH edge cases tracked (RT-34). |
