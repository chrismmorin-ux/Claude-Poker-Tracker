# Gate 2 Voice 4 — Autonomy + Trust Skeptic — Printable Refresher

**Date:** 2026-04-24
**Voice:** Autonomy skeptic + trust-lineage advocate
**Stages owned:** Stage E (autonomy red-line audit)

## Summary

**Verdict: ❌ as currently sketched — fixable via 8 new PRF-specific red lines + copy discipline.** The Printable Refresher introduces a structurally novel autonomy risk — **printed-advice permanence** — that the 9 inherited red lines (Shape Language 2026-04-23 #1–8, EAL 2026-04-24 #9) do not cover. A laminated card printed on 2026-04-24 carrying a calibrated exploit stays on the felt even after the underlying anchor retires in-app. The app cannot update paper. This converts every printed recommendation into an implicit override of any future retirement — which is a quiet inversion of red line #3 (durable override) weaponized *against* the owner's future self. Load-bearing mitigation: **lineage-mandatory + staleness-diffed-in-app + Reference-mode write-silence enforced at the reducer boundary**.

## Red line compliance check

| # | Red line | Status | Mitigation if at-risk |
|---|----------|--------|-----------------------|
| 1 | Opt-in enrollment — no silent skill inference | **AT-RISK** | Printing activity (cards opened, cards printed, cards re-printed) must not feed any skill-inference signal. Reference-mode write-silence (Shape Language Gate 3 three-intent taxonomy) enforced — dispatch `currentIntent: 'Reference'` on all refresher surfaces; reducer asserts no `shapeMastery` / `villainAssumption` mutation under that intent. |
| 2 | Full transparency on demand | **AT-RISK** | Paper cannot surface "why." Requires **in-app lineage drilldown** per card (PRF-NEW-2) that is one-tap-discoverable from the card ID printed on the laminate. |
| 3 | Durable overrides | **AT-RISK (novel)** | Owner's in-app "suppress this card class" action must be durable indefinitely and survive engine updates. Suppression also implies **re-print suppression** — a suppressed class never re-appears in a future print-batch even after app version bump. |
| 4 | Reversibility (reset / delete / incognito) | **AT-RISK** | In-app: per-card reset, global print-history reset, incognito view-mode (no print-history logged). Physical laminate: irreversible — mitigated by PRF-NEW-3 staleness surfacing + owner-controlled re-print cadence. |
| 5 | No streaks / shame / engagement-pressure | **AT-RISK** | Forbid "cards mastered / cards remaining," "days since last print," "re-print reminder" push. See AP-PRF-1..4, AP-PRF-8. |
| 6 | Flat access | PASS | All card classes always visible in in-app view; adaptivity never gates a class from printable output. Newcomer-threshold gates *default-print-set*, not *accessibility*. |
| 7 | Editor's-note tone | **AT-RISK (highest)** | Paper amplifies tone errors — a laminated "YOU MUST FOLD HERE" lives forever. See copy-discipline §. |
| 8 | No cross-surface contamination | **AT-RISK (novel)** | Refresher-view MUST NOT feed Live Advice / sidebar. Reference-mode segregation enforced at reducer. Reciprocally, printing a card MUST NOT be readable by exploitEngine as "owner values this exploit" — printEvents are write-silent into skill-state. |
| 9 | Incognito observation mode (EAL) | PASS (inherited) | Not directly applicable — refresher does not capture observations. But the `currentIntent: 'Reference'` assertion subsumes the same protection: no write-path exists. |

## Proposed new PRF-specific red lines

**#10 — Printed-advice permanence requires in-app staleness surfacing.** Every card printed carries `printedAt` stamp (owner-entered at print time) + engine-version-at-print. In-app per-card view shows diff-since-print. If ≥ N% of cards in a printed batch have diffs, in-app banner surfaces ("3 of 15 cards in your 2026-04-24 batch are stale — re-print recommended"). **No push notifications** — passive surfacing only. (Closes permanence-vs-retirement gap.)

**#11 — Reference-mode write-silence at reducer boundary.** Refresher surfaces (PrintableRefresherView, per-card detail view, in-app preview) dispatch `currentIntent: 'Reference'`. The shared `skillAssessment/` reducer (per `feedback_skill_assessment_core_competency.md`) asserts at the boundary that no posterior update, no drill-completion signal, and no observation-capture write occurs under this intent. First surface to crystallize the Reference-mode contract — test coverage at Gate 5 is non-negotiable.

**#12 — Lineage-mandatory on every card.** Every printable card carries a footer: `v1.0 / 2026-04-24 / src/utils/pokerCore/preflopCharts.js / POKER_THEORY.md §3.2 / rake: $5 cap $1/$2 / 100bb eff / BB-ante`. No anonymous content. (Closes trust asymmetry — PRF-NEW-2.)

**#13 — Owner-suppression is durable indefinitely.** Owner-ratified "never print this card class" action is persisted in IDB and survives engine/version bumps. Like anchor retirement (EAL red line analog). System never surfaces "you might want to reconsider printing X."

**#14 — No completion / mastery / streak tracking on cards — even digital.** Refreshers are not drills. Forbidden: per-card view-count visualizations, "cards studied today," "days streak." Even if tracked internally for bug diagnosis, never surfaced. (Closes graded-work-in-reference trap.)

**#15 — No proactive print-output.** The app never auto-generates "your personalized print pack tonight." Printing is 100% owner-initiated. No "card of the day," no pre-session auto-print. Newcomer-threshold gate prevents "just print everything" firehose.

**#16 — Cross-surface segregation bidirectional.** (a) Refresher-view activity never mutates live-advice state. (b) Live-play data (`activeSession`, villain observations, drill outcomes) never auto-tailors the printable set. The printable corpus is owner-curated + engine-derived from theoretical utils, **never personalized by play data** without explicit opt-in (deferred to Phase 2 if at all).

**#17 — Intent-switch mandatory for drill-pairing.** If a future feature pairs a printed card with a drill ("test yourself on this card"), the pairing requires explicit intent-switch from Reference → Deliberate. No automatic "tap card → now you're being graded." Button copy: "Drill this card" (explicit), never "Review this card" (ambiguous).

## Copy-discipline rules

**CD-1 — Factual, not imperative.** "Solver baseline: fold. Exceptions: SPR ≥ 8 IP vs VPIP ≥ 45." ✓ / "You must fold here." ✗ / "Always fold." ✗

**CD-2 — No self-evaluation framing.** Cards are reference material, not assessment sheets. Forbidden: "Grade your play," "How did you do?", "Score your decision here," "Check your answer."

**CD-3 — No engagement copy.** Forbidden: "You've mastered 3/15 cards!", "Keep it up!", "Your refresher streak: 7 days." Cards carry poker content only — no motivational or status copy.

**CD-4 — Labels as outputs, never inputs.** Per `feedback_first_principles_decisions.md` + root CLAUDE.md — forbidden: "vs Fish, always iso-3bet." Required: "When villain has VPIP ≥ 45, PFR ≤ 10, and SPR ≥ 8, iso-3bet OOP gains X bb/100 via implied-odds realization gap (derivation below)."

**CD-5 — Assumptions explicit.** Every chart declares: stakes, rake structure, effective-stack assumption, field default-range assumption. No chart is context-free. (Enforces working principle 3 + supports PRF-NEW-2 trust-the-sheet.)

## Anti-pattern refusal list

Inherited from EAL (AP-01..AP-09) + Shape Language Gate 2 refusals apply as persona-level constraints. Print-specific additions:

- **AP-PRF-1 — "Card leaderboard"** (default sort by "biggest edge") — refused. Default sort: theoretical order (preflop → math → postflop) or alphabetical. Owner explicit sort menu available.
- **AP-PRF-2 — "Card of the day" auto-surface** — refused. No proactive push.
- **AP-PRF-3 — "Print streak"** (days in a row printing / studying) — refused (red line #5).
- **AP-PRF-4 — "Mastery score" per card** — refused (red line #14 + AP-04 scalar-score inheritance).
- **AP-PRF-5 — "Retired cards you might reconsider"** — refused. Suppression is durable (red line #13, mirrors AP-05).
- **AP-PRF-6 — "Your refresher accuracy"** graded-work framing — refused (CD-2 + AP-06 inheritance).
- **AP-PRF-7 — Cross-surface contamination** — refused (red lines #8, #16).
- **AP-PRF-8 — Engagement notifications** ("re-print reminder," "new card available") — refused by default; opt-in only with explicit "notify me when my cards go stale" flag (off by default).
- **AP-PRF-9 — NEW — Auto-personalized print pack.** Refused. "Your personalized pack tonight based on villain X" is personalization-via-play-data which violates red line #16. Phase 2 at earliest, and only with explicit opt-in gesture.
- **AP-PRF-10 — NEW — Watermark-based engagement** ("Printed by Chris · v1.0 · Share with friends"). Refused. Lineage footer is factual utility, not social affordance. No share prompts, no QR codes to "rate this card."
- **AP-PRF-11 — NEW — Card-view analytics surfaced to owner** ("you've viewed this card 47 times"). Refused. View-counts are not self-evaluation data; if tracked for debug, never surfaced. (red line #14)

## Trust-the-sheet (PRF-NEW-2) — lineage spec

Every card footer (in-app view AND printed artifact) carries:

1. **Card ID + semantic version:** `PRF-PREFLOP-OPEN-CO-100BB v1.2`
2. **Generation date:** `Generated 2026-04-24`
3. **Source util path:** `src/utils/pokerCore/preflopCharts.js#computeOpenRange`
4. **Engine version:** `engine v2.47 / app v123`
5. **Theory citation:** `POKER_THEORY.md §3.2 (equity-realization) + §4.1 (rake-adjusted EV)`
6. **Assumption bundle:** `stakes: $1/$2 cash · rake: 5% cap $5 no-flop-no-drop · eff stack: 100bb · field: standard 9-handed live`
7. **Bucket definitions cited:** `villain-style-buckets.md §Nit / §TAG / §Fish` (if card uses style descriptors in exception clauses)

**In-app drilldown:** tapping the card ID opens a side panel showing the full derivation (util source + theory section inline + worked example at the stated assumptions). Parity with existing villain-model transparency.

## Know-stale (PRF-NEW-3) — staleness surfacing spec

**Mechanism:**
1. Owner enters **print-date** per batch in-app when printing ("Printed 2026-04-24, 15 cards"). Persisted in IDB `printBatches` store.
2. Each card in a printed batch snapshots `engineVersion` + `sourceHash` at print time.
3. In-app per-card view computes diff: current engine output vs print-time snapshot. Shows: "No changes since print" / "Math unchanged; exception clause updated 2026-05-01" / "Stale: rake assumption changed 2026-05-15 — re-print recommended."
4. Batch-level banner on Refresher home: "Your 2026-04-24 batch: 12 of 15 cards current, 3 stale." Not red, not pushy — informational.

**Anti-nag constraints:**
- **No push notifications.** Staleness is passive — owner sees it on next in-app visit, not via interrupt.
- **No badge counter on app icon.**
- **No "X days since re-print" counter.** Absence of re-print is not a failure state.
- **Owner-controlled cadence.** "Re-print this batch" is a button, never a nag. System suggests, owner decides.
- **Suppression is durable.** Owner can say "don't flag this card as stale" — respected indefinitely (red line #13).

## Stage verdict signal

- **Stage E (autonomy):** ❌ as currently sketched. Fixable — the charter's working principles 1/6 gesture at the right infrastructure (lineage + staleness surfacing) but the 9 inherited red lines are insufficient to cover print permanence. Addition of red lines #10–#17 + copy-discipline CD-1..5 + AP-PRF-1..11 makes this **⚠️ pending Gate 4 ratification**.

## Recommended follow-ups for Gate 3 / Gate 4

- [ ] Gate 3: owner interview — confirm print-date-entry ergonomics (per-card vs per-batch); ratify AP-PRF-8 opt-in default (notifications off); ratify red line #16 "personalization deferred to Phase 2."
- [ ] Gate 4: charter §Working Principles expands to incorporate red lines #10–#17 as Acceptance Criteria (non-placeholder, testable).
- [ ] Gate 4: surface spec `surfaces/printable-refresher.md` asserts `currentIntent: 'Reference'` at mount; reducer-boundary test at Gate 5.
- [ ] Gate 4: copy-guidance doc at `docs/projects/printable-refresher/copy-discipline.md` enumerates CD-1..5 with examples.
- [ ] Gate 4: anti-pattern refusal list at `docs/projects/printable-refresher/anti-patterns.md` (mirrors EAL precedent).
- [ ] Gate 4: lineage-footer spec — every card mock-up at design phase shows the 7-field footer.
- [ ] Gate 4: IDB schema for `printBatches` store (write-silent under Reference intent; owner-initiated writes only).
- [ ] Gate 5: in-app test assertions for red lines #10–#17. Particularly reducer-boundary write-silence test (#11) and durable-suppression test (#13).
- [ ] Gate 5: snapshot test — every card's worked example tests against engine util output; drift fails CI (RT-108 pattern inherited from EAL + SLS).
