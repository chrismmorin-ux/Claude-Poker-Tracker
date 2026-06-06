# Gate 1 — Entry — 2026-06-06 — Sessions View Improvement (Phase 3: list sort/search/grouping + detail)

**Date:** 2026-06-06
**Project:** Sessions View Improvement (4-phase)
**Author:** Claude (main)
**Format:** Per `docs/design/LIFECYCLE.md` Gate 1 (Entry).
**Verdict:** 🟢 **GREEN** — proceed to Gate 4 + implementation in-session.

---

## Feature summary

Upgrades the past-sessions list with: sort (newest / biggest win / longest),
free-text search (venue / stake / goal), optional month grouping, and a
**Session Detail** drill-down modal (full stats, venue note, goal/notes, rebuy
timeline, and the session's hands — each opening in HandReplayView). Sort and
grouping persist to localStorage like the existing Live/Online filter.

## Scope classification

- **New surface?** One new modal (`SessionDetailModal`) within `sessions-view`;
  the rest are controls added to the existing Past Sessions header.
- **New interaction modality?** No — text input, a `<select>`, a toggle, a modal.
  Hand→replay reuses the existing `setReplayHand` + `SCREEN.HAND_REPLAY` path
  (same as the Review Queue).
- **New persistent state class?** No — pure derivation; sort/group prefs in
  localStorage. No IndexedDB change. Hands lazy-loaded via existing
  `getHandsBySessionId`.
- **Cross-product impact?** None.

## Personas served

- **post-session-chris** (primary) — reviews history; wants to find a specific
  session fast and drill into one for full context + its hands.

## JTBD served

- **Primary:** "Find the session I'm thinking of (by venue/stake/when) and open
  it to see everything that happened, including the hands."
- **Secondary:** "Sort my history by what matters right now (recent, biggest
  win, longest grind) and group it by month."

## Gap analysis

| Dimension | Finding |
|---|---|
| Existing surface covers this? | 🟡 List was newest-first only, no search/sort/detail. Extension. |
| Persona coverage | 🟢 Existing post-session persona; no new persona. |
| Interaction novelty | 🟢 Standard controls + a modal; replay-open reused. |
| Data model | 🟢 Pure derivation + lazy hand fetch; no IDB change. |
| Cognitive-load risk | 🟢 Controls only appear when past sessions exist; detail is opt-in. |

**Net:** GREEN. No new architecture/data/cross-product reach.

## Verdict

🟢 **GREEN → proceed.** `sessions-view` surface updated. Verified via Playwright
(portrait): controls render, search filters, sort orders, detail modal opens with
full stats + hands + close.
