# Program: UI Quality

Status: RED
Owner: eng-engine (product-ux-engineer + performance-engineer personas)
Last assessed: 2026-04-09 (R6)
Last verified against code: 2026-04-09

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

- RT-37: Next Hand confirmation guard (data loss prevention)
- RT-36: React.memo for high-frequency components
- ARCH-003: TableView at 594 lines (trigger: >700)
- RT-43 (P1): Unified render scheduler + single-owner state store (root cause fix)
- RT-44 (P1): Fix renderKey fingerprint (subsumed by RT-43)
- RT-45 (P1): STREET_RANK guard + hand-number binding
- RT-51 (P1): Message-level integration test harness
- RT-48 (P2): Stale advice visual indicator
- RT-49 (P2): Preserve section collapse state across renders
- RT-52 (P2): Tournament timer detached DOM fix
- RT-53 (P2): Render _contextStale visual indicator
- RT-54 (P2): Community cards + villain profile in renderKey

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
| 2026-04-07 | GREEN | R5 roundtable. Zero React.memo across component tree (RT-36). Next Hand has no confirmation guard (RT-37). Exploit badge popovers lack viewport-aware positioning. All existing UI quality metrics remain GREEN. |
| 2026-04-09 | RED | R6 roundtable. Extension sidebar display-thrashing: 4+ render paths bypass coordination, renderKey drops exploit updates, stale advice displayed as current after SW restart, section collapse state destroyed on every push. User reports sidebar unusable. 4 P1 + 2 P2 findings. |
| 2026-04-11 | RED | R7 roundtable. Root cause identified: dual state ownership (module vars vs coordinator) — not fixable by adding more sync. RT-43 scope expanded to include single-owner state store. 6 new findings (RT-51 through RT-56): message-level test harness, tournament timer detached DOM, stale indicator visual no-op, renderKey missing community cards, dead panel functions, _receivedAt NaN. |
| 2026-04-20 | YELLOW | Drills Consolidation Roundtable. Product/UX concerns on proposed `StudyView` consolidation: JTBD decomposition misfires for Line Study (promoted to peer tab but content-sparse), street filter adds mandatory decision step with no specified default, two-button SessionsView entry surfaces street intent before navigation (lost on collapse to one button), chrome budget at 1600×720 not arithmetic'd anywhere in design doc, Learn tab proposed to host ShapeMode two-pane layout inside its own three-column shell (likely overcrowded). Performance concerns: postflop ExplorerMode `handTypeBreakdown` has no setTimeout yield (unlike preflop), street-toggle re-renders will fire it sync (~15-35ms on Helio G80). 5 UX-specific findings (RT-92/93/97/98/99) pending review. No code-state regression from prior YELLOW. |
