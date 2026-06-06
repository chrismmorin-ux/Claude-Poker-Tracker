# Gate 1 — Entry — 2026-06-06 — Sessions View Improvement (Phase 2: Insights band)

**Date:** 2026-06-06
**Project:** Sessions View Improvement (4-phase)
**Author:** Claude (main)
**Format:** Per `docs/design/LIFECYCLE.md` Gate 1 (Entry).
**Verdict:** 🟢 **GREEN** — proceed to Gate 4 + implementation in-session.

---

## Feature summary

A compact insights band at the top of the Sessions view that turns the raw
session list into an at-a-glance performance read: total profit/loss, $/hr
win-rate, sessions/hands counts, win %, best/worst session, plus breakdowns by
stake and by venue, and a small cumulative-bankroll graph over time. All values
are derived from existing session records — no new persistent state. The band
respects the existing Live/Online/All filter so the stats scope with the list.
The pinned bottom-left Bankroll widget is folded into this band (owner-ratified
2026-06-06) so lifetime P&L has a single source of truth.

## Scope classification

- **New surface?** No new routed view — a new section within `sessions-view`,
  plus a hand-rolled SVG chart component. No charting dependency added.
- **New interaction modality?** No — read-only display; optional point hover/tap
  on the chart reuses standard affordances.
- **New persistent state class?** No — pure derivation over existing session
  records (`src/utils/sessionStats/sessionAnalytics.js`). No IDB change.
- **Cross-product impact?** None.

## Personas served

- **post-session-chris / between-hands-chris** (primary) — wants a fast read of
  how things are going without scanning every row.
- **[Chris](../personas/core/chris-live-player.md)** — sole user; lifetime
  bankroll + venue/stake breakdowns inform where to play.

## JTBD served

- **Primary:** "When I open Sessions, show me how I'm doing overall — am I up,
  at what rate, and where — without me adding it up by hand."
- **Secondary:** "Tell me which stakes/venues are actually profitable for me."

## Gap analysis

| Dimension | Finding |
|---|---|
| Existing surface covers this? | 🟡 Only a single lifetime-bankroll number (`BankrollDisplay`) exists; no rate, breakdowns, or trend. Extension. |
| Persona coverage | 🟢 Existing personas; no new persona. |
| Interaction novelty | 🟢 Read-only; hand-rolled SVG mirrors Range Lab's equity histogram precedent. |
| Data model | 🟢 Pure derivation; no IDB change; tip already subtracted (mirrors `calculateTotalBankroll`). |
| Cognitive-load risk | 🟡 Density — must stay scannable. Tiered typography + tabular-nums; band is collapsible if it crowds. |

**Net:** GREEN. No new architecture, no new data, no cross-product reach.

## Gate 2 disposition

Not triggered — no new persona/modality, read-only over existing data, contained
to one view. Escalate only if the chart's interaction grows beyond hover/tap.

## Verdict

🟢 **GREEN → proceed.** Surface spec updated in `docs/design/surfaces/sessions-view.md`.
