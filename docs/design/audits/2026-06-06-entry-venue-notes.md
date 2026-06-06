# Gate 1 — Entry — 2026-06-06 — Sessions View Improvement (Phase 1: Venues with notes)

**Date:** 2026-06-06
**Project:** Sessions View Improvement (4-phase)
**Author:** Claude (main)
**Format:** Per `docs/design/LIFECYCLE.md` Gate 1 (Entry) — scope classification, personas, JTBD, gap analysis.
**Verdict:** 🟢 **GREEN** for Phase 1 — proceed to Gate 4 + implementation in-session. Phases 2–4 each get their own Gate-1 check when built.

---

## Project summary

Owner-requested broad lift of the Sessions view across four phases (sequenced, each shippable):

1. **Phase 1 — Venues with notes** *(this audit)* — let the owner attach a free-text note to each custom venue (rake details, table feel, parking, comps, etc.).
2. Phase 2 — Insights band (totals, $/hr, breakdowns, bankroll graph; folds in the bottom Bankroll widget).
3. Phase 3 — Past-sessions list upgrade (sort / search / month grouping + session-detail drill-down).
4. Phase 4 — Active-session flow + whole-view visual polish.

Owner ratifications (2026-06-06): venue model **restructured to objects** `customVenues: [{ name, notes }]` (owner chose the explicit shape over an additive notes map, accepting that built-in venues — Online / Horseshoe / Wind Creek — do not get notes in this phase); bottom Bankroll widget **folds into the Phase-2 Insights band**.

## Scope classification (Phase 1)

- **New surface?** No new routed view. Edits: `VenuesManager` (Settings) gains per-venue notes; `SessionForm` shows the selected venue's note as a hint; `SessionCard` shows a note indicator.
- **New interaction modality?** No — reuses existing text-input / textarea idioms.
- **New persistent state class?** Mild — `customVenues` entry shape changes from `string` to `{ name, notes }`. No new IDB store and **no IDB version bump** (settings persist as a singleton blob); legacy string entries are normalized-on-read in the settings reducer's `LOAD`/`HYDRATE` paths.
- **Cross-product impact?** None. Settings ↔ session-creation ↔ session-history only.

## Personas served

- **[Chris](../personas/core/chris-live-player.md)** (primary) — sole user; customizes venues today via `VenuesManager`. Wants to record venue-specific context he otherwise forgets between visits.
- **post-session-chris / between-hands-chris** (secondary) — sees the note when picking a venue for a new session and on past-session rows.

## JTBD served

- **Primary:** "When I add or revisit a venue, capture what I need to remember about it (rake, table conditions, logistics) so it's in front of me next time I play there."
- **Secondary:** "When I start a session at a venue, surface what I noted about it without digging."

## Gap analysis

| Dimension | Finding |
|---|---|
| Existing surface covers this? | 🟡 `VenuesManager` exists but stores bare names — no note field anywhere. Extension, not greenfield. |
| Persona coverage | 🟢 Existing Chris persona covers it; no new persona. |
| Interaction novelty | 🟢 Plain text inputs; established idiom. |
| Data model | 🟡 Entry-shape change (string → object). Backward-compatible via normalize-on-read; no IDB bump. Tests assuming string arrays updated in same change. |
| Cognitive-load risk | 🟢 Notes are optional; absent notes render nothing. |

**Net:** GREEN. The only YELLOW cells are the (well-contained) data-shape change and the pre-existing-but-extended surface — neither introduces novel architecture or cross-product reach.

## Gate 2 disposition

Not triggered for Phase 1 — no new surface, no new persona, no new modality, blast radius is three small edits + a reducer-shape change with a normalize-on-read safety net. Phases 2–4 (new Insights surface, new detail drill-down) will be re-evaluated for Gate 2 at their own Gate-1 checks.

## Verdict

🟢 **GREEN → proceed to Gate 4 + Gate 5 in-session.** Surface spec appended to `docs/design/surfaces/settings-view.md` (VenuesManager notes) and `docs/design/surfaces/sessions-view.md` (venue-note hint/indicator) same session.
