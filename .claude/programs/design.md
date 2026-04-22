# Program: Design

Status: ACTIVE (supersedes UI Quality program — 2026-04-21)
Owner: `/eng-engine` roundtable + product-ux-engineer persona
Charter: [docs/design/PROGRAM.md](../../docs/design/PROGRAM.md)
Lifecycle gates: [docs/design/LIFECYCLE.md](../../docs/design/LIFECYCLE.md)
Blind-spot roundtables: [docs/design/ROUNDTABLES.md](../../docs/design/ROUNDTABLES.md)
Framework root: [docs/design/README.md](../../docs/design/README.md)
Last assessed: 2026-04-21
Last verified against code: 2026-04-21

---

## What this program governs

**Every UX-touching change** — new views, new widgets, material behavior changes, destructive action additions, layout refactors. The program is load-bearing infrastructure: it does not catch UX regressions after they ship; it prevents them from entering development.

## The anti-pattern it exists to prevent

> "Feature X went to production, the design phase was skipped, and we assumed existing personas covered it."

This happens when:
- A feature spec jumps from idea to code without explicit design phase.
- Existing personas / JTBD are treated as complete rather than questioned per feature.
- The "primary user" lens is used even when a feature serves an entirely different cast.
- Blind spots in the design framework (missing personas, missing JTBDs) are invisible until production reveals them.

**The Design Program prevents all four by gating every UX change through explicit stages.**

---

## Health Criteria

**Governance metrics** (what the design program is responsible for):

| Metric | Green | Yellow | Red | Current |
|--------|-------|--------|-----|---------|
| UX-touching PRs linked to audit or design spec | 100% | 80–99% | <80% | Baseline establishing 2026-04-21 |
| Surface artifacts for active views | 100% of views in CATALOG | 1–2 gaps | 3+ gaps | 3 of ~14 (Session 2 — player-selection). Seat-context-menu, Player-Picker, Player-Editor documented; 11 views pending. |
| PROTO personas > 180 days without verification pass | 0 | 1–2 | 3+ | 15 of 15 personas are PROTO as of 2026-04-21 (Session 1b). Baseline; escalate after 6 months. |
| Discovery LOG items in CAPTURED > 60 days | 0 | 1–3 | 4+ | 20 items captured 2026-04-21; triage deadline 2026-06-20 |
| JTBD domains without any served surface | 0 | 1–2 | 3+ | 5 domains with 0 surface artifacts (subscription-account, coaching, social-group, multi-device-sync, onboarding) — tracked, not blockers |
| Audit findings open > 60 days from audit date | 0 | 1–3 | 4+ | 0 (player-selection audit fully implemented Sessions 3+4) |
| Blind-spot roundtable cadence | Last <90 days | 90–180 days | >180 days | 0 conducted — first one scheduled for next major surface |

**Execution indicators** (absorbed from retired UI Quality program, 2026-04-06 onwards):

| Metric | Green | Yellow | Red | Current |
|--------|-------|--------|-----|---------|
| All views render at 1600×720 | No overflow/clipping | Minor clipping | Broken layout | Green (2026-04-04 visual check) |
| Touch targets ≥ 44 DOM-px on interactive rows | All | 1–2 undersized | Many undersized | Player-selection compliant (Session 3); other surfaces not audited |
| Action buttons use `ACTIONS.*` constants | 100% | Missing for new action | Hardcoded strings | 100% |
| Design tokens in `designTokens.js` | All colors centralized | 1–2 inline colors | Many inline | Centralized |
| Advice staleness indicator | Active (badge + fade) | — | Missing | Active (RT-18) |
| Reset Hand confirmation guard | Present | — | Missing | Present (RT-14) |
| Components > 600 lines | 0 | 1 | 2+ | 1 (TableView 594 — ARCH-003 watch) |
| Bucket/EV displays with sampleSize caveat | All | 1 missing | Multiple missing | Not yet implemented — RT-115 (REVIEW) adds guard pattern |
| Authored content with verified EV claims | All claims in snapshot-diff CI | Partial | None | None (RT-108 REVIEW establishes the CI gate) |

---

## Status

**ACTIVE**. Program established 2026-04-21 by upgrading and subsuming the prior UI Quality program. Design framework at `docs/design/` is the load-bearing infrastructure the program enforces.

**Current posture**: baselining. Most metrics are being established. Expect YELLOW-to-GREEN transition once the first blind-spot roundtable is conducted on a non-player-selection surface and surface-artifact coverage improves.

---

## Active Backlog Items

Inherited from UI Quality (now all framed as execution-indicator work):

- RT-37: Next Hand confirmation guard (data loss prevention)
- RT-36: React.memo for high-frequency components
- ARCH-003: TableView at 594 lines (trigger: >700)
- RT-43 (P1): Unified render scheduler + single-owner state store
- RT-44 (P1): Fix renderKey fingerprint (subsumed by RT-43)
- RT-45 (P1): STREET_RANK guard + hand-number binding
- RT-51 (P1): Message-level integration test harness
- RT-48 (P2): Stale advice visual indicator
- RT-49 (P2): Preserve section collapse state across renders
- RT-52 (P2): Tournament timer detached DOM fix
- RT-53 (P2): Render _contextStale visual indicator
- RT-54 (P2): Community cards + villain profile in renderKey

Design governance work (new):

- DES-G1 (P2): Run first blind-spot roundtable on next-scheduled non-player-selection surface.
- DES-G2 (P3): Triage 20-item initial discovery list (`docs/design/discoveries/2026-04-21-initial-gap-list.md`).
- DES-G3 (P3): Schedule quarterly PROTO-persona reality check (first pass 2026-10-21).

---

## Milestone Gates

| Gate | Status | Criteria |
|------|--------|---------|
| Design framework scaffold | PASSED | 75 files across `docs/design/` (Sessions 1 + 1b, 2026-04-21) |
| First audit cycle complete | PASSED | Player-selection: 3 surfaces + journey + audit + 11 findings all implemented (Sessions 2–4) |
| Design program established | PASSED | This file + CLAUDE.md integration (2026-04-21) |
| First non-player-selection audit | OPEN | Any second surface audited via framework |
| First blind-spot roundtable | OPEN | On a new feature proposal before implementation |
| Persona validation pass | OPEN | Move ≥5 of 15 personas from PROTO to VERIFIED via observation or structured interview |
| Surface CATALOG coverage | OPEN | All routed views have surface artifacts (currently 3 of ~14) |

---

## Auto-Backlog Triggers

**Inherited from UI Quality:**

| Condition | Backlog Template | Priority |
|-----------|-----------------|----------|
| Inline hex color outside `designTokens.js` | "Inline color in [file] — move to `designTokens.js`" | P2 |
| Component exceeds 700 lines | "ARCH-003 triggered: [component] at [N] lines — split" | P1 |
| Action without `ACTIONS.*` constant | "Action [name] missing from `gameConstants.js`" | P1 |
| New view without scale prop handling | "View [name] missing responsive scaling" | P1 |

**New (design governance):**

| Condition | Backlog Template | Priority |
|-----------|-----------------|----------|
| PR touches `src/components/views/**` without linked audit-id or design-spec-id in description | "Design-gate skipped for [PR]: no audit or spec linked" | P1 |
| New `SCREEN.*` constant added without corresponding `docs/design/surfaces/*.md` | "New screen [name] missing surface artifact" | P1 |
| Discovery in CAPTURED state > 60 days | "Triage stale discovery: [DISC-id]" | P2 |
| Persona in PROTO state > 180 days | "Validate or downgrade PROTO persona: [persona-id]" | P2 |
| JTBD domain with 0 served surfaces AND referenced by ≥1 discovery | "Empty domain [X] has active demand — add surface artifact" | P2 |
| Blind-spot roundtable not run in 180 days | "Schedule blind-spot roundtable — [months] overdue" | P3 |

Trigger enforcement is advisory today (checklist + roundtable). Future work may formalize via git hooks or CI.

---

## Relationship to other programs

- **Security program**: continues independently. Security findings can surface as design issues (e.g., trust-boundary crossings visible in surface artifacts), but Security has its own governance.
- **Engine Accuracy program**: continues independently. Exploit-engine correctness is orthogonal to design.
- **Test Health program**: continues independently. Design audits link to test coverage but don't own it.
- **Retired: UI Quality program** (`ui-quality.md`) — superseded 2026-04-21. Its tactical metrics absorbed into the "Execution indicators" section above. Its history is preserved below and in the retired file itself.

---

## History

### Pre-upgrade (as "UI Quality" program)

| Date | Status | Notes |
|------|--------|-------|
| 2026-04-06 | GREEN | Initial assessment. Staleness indicator active, confirmation guards in place, design tokens centralized. |
| 2026-04-07 | GREEN | R4 roundtable. Orbit strip touch targets at 36px (RT-34). |
| 2026-04-07 | GREEN | R5 roundtable. Zero React.memo (RT-36). Next Hand no confirmation guard (RT-37). |
| 2026-04-09 | RED | R6 roundtable. Extension sidebar display-thrashing; 4 P1 + 2 P2 findings. |
| 2026-04-11 | RED | R7 roundtable. Dual state ownership; 6 new findings. |
| 2026-04-20 | YELLOW | Drills Consolidation Roundtable. 5 UX findings. |

### Post-upgrade (as "Design" program)

| Date | Status | Notes |
|------|--------|-------|
| 2026-04-21 | ACTIVE | Program upgraded. Design framework (75 files across `docs/design/`) established as load-bearing infrastructure. Player-selection audit cycle closed: 11 findings, all implemented across Sessions 2–4. Lifecycle gates + blind-spot roundtable templates authored. Next: run first roundtable on next new-feature proposal. |
