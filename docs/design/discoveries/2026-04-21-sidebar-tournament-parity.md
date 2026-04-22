# Discovery — Sidebar Tournament-Overlay Parity

**ID:** `DISC-2026-04-21-sidebar-tournament-parity`
**State:** CAPTURED
**Surfaced during:** [blind-spot audit 2026-04-21 table-view §D4](../audits/2026-04-21-blindspot-table-view.md)
**Date surfaced:** 2026-04-21
**Last updated:** 2026-04-21

---

## The gap

Feature F-10 (Tournament Dashboard — ICM pressure, M-ratio guidance, blind timer) is tagged `main` in `features/INVENTORY.md`. But the [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) persona explicitly spans both product lines, and [Online MTT Shark](../personas/core/online-mtt-shark.md) is sidebar-primary with tournament as a core use case. A Hybrid user playing an online MTT through the extension gets *none* of the main-app's tournament context — no ICM pressure, no M-ratio, no level timer integration. The framework-level symptom is: **INVENTORY has single-product tags but the personas are multi-product.** The feature-level symptom is: online MTT players are unserved for tournament awareness.

## Evidence

- `features/INVENTORY.md` — F-10 tagged `main`
- `personas/core/hybrid-semi-pro.md` — persona spans main+sidebar
- `personas/core/online-mtt-shark.md` — sidebar-primary, tournament-critical
- [blind-spot audit 2026-04-21 table-view D4](../audits/2026-04-21-blindspot-table-view.md)
- `surfaces/online-view.md` — does not reference tournament context

---

## Personas affected

| Persona | Role | JTBD unblocked |
|---------|------|----------------|
| [Online MTT Shark](../personas/core/online-mtt-shark.md) | primary | TS-35, TS-36, TS-37, TS-43, TS-44 |
| [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) | primary (when online MTTing) | TS-35, TS-37, TS-43, TS-44 |
| [bubble-decision situational](../personas/situational/bubble-decision.md) | primary at bubble, online context | TS-43, TS-44 |
| [Multi-Tabler](../personas/core/multi-tabler.md) | secondary (mostly cash; MTT satellite is secondary use) | TS-35 |

## JTBD(s) enabled

- `JTBD-TS-35` ICM-pressure indicator at bubble (online context)
- `JTBD-TS-37` stack-depth strategy zone updated live (online context)
- `JTBD-TS-43` ICM-adjusted decision at bubble (online context)
- `JTBD-TS-44` pay-jump proximity indicator (online context)
- `JTBD-TS-36` BB-ante vs per-player antes (sidebar capture pipeline needs to handle both)

---

## Proposed tier

**Tier:** Pro / Sidebar-Lite
**Rationale:** Tournament awareness is a Pro feature in the main app; online tournament MTTers are a canonical Pro-tier / Sidebar-Lite persona. Cross-product parity should preserve tier.
**Alternatives considered:** Leave online MTT users to consult the main app via a different monitor / device — rejected because the personas explicitly play single-device online.

## Product line

- **Sidebar** (primary — the gap is on this product line)
- **Platform** consideration: the tournament context itself (`TournamentContext`) is main-app only; surfacing it to the sidebar requires extending the sync bridge.

## Related surfaces

- `sidebar/Z0` (Chrome) — tournament chip / level badge
- `sidebar/Z2` (Decision) — ICM-corrected action
- `sidebar/Z4` (Deep Analysis) — pay-jump + stack-depth analysis
- `online-view.md` — main-app mirror where imported online tournaments are viewable
- `sessions-view.md` — "Online Sessions tab" connection gap (separate but related)

---

## Priority score

- `personas_covered`: 4
- `jtbd_criticality`: 3–4 (bubble decisions are high-stakes)
- `tier_fit_factor`: 1.0 (on-tier Pro)
- **Raw priority:** 4 × 3.5 × 1.0 = **14**

## Effort estimate

- **Tier:** L
- **Rough breakdown:**
  - Detect tournament vs cash in sidebar capture (~0.5 session)
  - Extract level / blind / ante from Ignition hand metadata (~0.5-1 session)
  - Render Z0 badge + Z2 ICM corrections (~1 session)
  - Stack-depth zone indicator in Z0 / Z2 (~0.5 session)
  - Tests + visual verification (~1 session)
- **Dependencies:** TS-43 / TS-44 JTBDs (just added — done). Payout-structure import (DISC-04, unresolved — ICM correction quality depends on this).

## WSJF

- Effort in weeks: ~2-3
- WSJF: 14 / 2.5 = 5.6

---

## Sketch of solution

1. **Sidebar capture:** parse Ignition-sent metadata for tournament format (level, blinds, ante, players remaining, payout structure where available).
2. **Sync bridge:** thread tournament state into `useSyncBridge` → `useOnlineAnalysisContext`.
3. **Z0 badge:** small "T L12 15m" chip showing tournament + level + time to next level.
4. **Z2 ICM overlay:** when tournament is detected, LiveRecommendations include the ICM-adjusted verdict alongside chip-EV.
5. **Z4 Deep Analysis:** pay-jump proximity + stack-depth zone.

Framework-level follow-up: **amend `features/INVENTORY.md` product-line tags to allow `main+sidebar` explicitly.** Currently the allowed tags are `main / sidebar / both / platform`, but `both` is underused — the convention of tagging cross-product features as `main` with a follow-up discovery is how this gap went undocumented.

## Risks / open questions

- Does Ignition (or the extension) actually expose full tournament metadata in the captured payload? Needs verification at the capture layer.
- ICM calculation requires payout structure. If payout is missing, does the sidebar show TS-35 (pressure) without TS-43 (corrected action)? Graceful degradation spec needed.
- **Wave 5 scope expansion:** this discovery argues Wave 5 (sidebar integration) must address cross-product persona parity proactively, not as a documentation exercise.

---

## Status log

- 2026-04-21 — SURFACED during blind-spot-audit 2026-04-21 table-view.
- 2026-04-21 — CAPTURED. Owner decision needed on whether to expand Wave 5 scope or spawn separate project.

## Change log

- 2026-04-21 — Created.
