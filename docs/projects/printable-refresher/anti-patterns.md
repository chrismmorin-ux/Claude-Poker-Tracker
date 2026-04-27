# Anti-pattern refusal list — Printable Refresher

**Date:** 2026-04-24 (Gate 4)
**Project:** `docs/projects/printable-refresher.project.md`
**Audience:** Gate 4 surface designers, Gate 5 card authors, Phase 2+ personalization contributors.
**Parent gates:** Gate 2 — `docs/design/audits/2026-04-24-blindspot-printable-refresher.md` §Voice 4 (Autonomy). Gate 2 re-run — `docs/design/audits/2026-04-24-blindspot-printable-refresher-rerun.md` §Stage E (ratified for Gate 4).

---

## Why this list exists

The Printable Refresher carries a novel autonomy risk the rest of the product does not: **printed-advice permanence.** A laminated card printed on 2026-04-24 carrying a calibrated exploit stays on the felt even after the underlying anchor retires in-app. The app cannot update paper. This inverts the direction of algorithmic update — the owner's future self has to defend against the owner's past self's printed advice — and makes every framing drift that slips through Gate 5 authoring durable in physical form.

The Gate 2 Voice 4 audit enumerated 11 print-medium anti-patterns, 8 of which are PRF-specific. This document catalogs all 11 with autonomy-rationale citations plus the EAL-inherited set that applies transitively wherever refresher surfaces intersect with anchor / calibration surfaces.

**Rule for amendments.** If a future designer wants to introduce an item on this list, it triggers **persona-level review** (not feature-level review) per `docs/design/personas/core/chris-live-player.md` §Autonomy constraint. The owner and at least one Gate-2-voice equivalent must sign off. Default answer is no.

---

## PRF-specific anti-patterns (from Gate 2 Voice 4 — refused explicitly)

### AP-PRF-01 — "Card leaderboard" (default sort by biggest edge)

**Refused.** Printable Refresher default sort is **theoretical order** (preflop → math → postflop → exceptions) OR **alphabetical by card ID** — never "biggest edge first."

**Why.** Sort-by-edge creates an implicit ranking of cards that fakes a universal ordering where none exists (an equity card has no "edge" comparable to a preflop card). Over time, "low-edge" cards feel second-class and the owner stops printing them. Library becomes a highlight reel of top-3, destroying flat access.

**Red line violated:** #5 (no engagement-pressure), #6 (flat access).

**Allowed alternative.** Owner can explicitly sort by card-class / alphabetical / last-printed-at / pinned-first via a sort menu. Default sort is value-neutral.

---

### AP-PRF-02 — "Card of the day" auto-surface

**Refused.** The app never proactively surfaces "today's card" / "card to review before session" / rotating-selection banners.

**Why.** Proactive card-surfacing is graded-work in push-notification form. It implies the system knows which card matters today, which inverts the Reference-mode contract (the owner decides what to reference). It also creates engagement-pressure — the owner feels obligated to check the app to "see today's card."

**Red line violated:** #5 (no engagement-pressure), #15 (no proactive print-output).

**Allowed alternative.** Owner opens the refresher surface deliberately when they want to print or review. Card catalog is static + owner-sortable.

---

### AP-PRF-03 — "Print streak" visualization

**Refused.** No "3 days in a row printing," "7-day streak," "last printed X days ago" counters.

**Why.** Streaks are the canonical engagement-pressure pattern from consumer apps (Duolingo, Snapchat). They convert a Reference feature (used when needed) into an obligation feature (used to protect the streak). Paper permanence makes this worse — the owner could feel pressure to re-print to maintain a streak even when their existing laminate is current.

**Red line violated:** #5 (no streaks — direct violation by name), #14 (no mastery/streak tracking).

**Allowed alternative.** Printing a batch writes `printBatches[batchId].printedAt` for staleness-diff. That field is consulted by the in-app staleness banner (red line #10) but never rendered as a counter, timer, or streak.

---

### AP-PRF-04 — "Mastery score" per card

**Refused.** No scalar "mastery" / "proficiency" / "familiarity" score per card or per class.

**Why.** Cards are reference material, not drills (red line #14). A mastery score frames the card as an assessment artifact, which invites comparison (across cards, across sessions) and slides into graded-work. The refresher deliberately does not track view-counts or print-counts (red line #14 structural); any surface score is derived from data the app refuses to collect.

**Red line violated:** #14 (no completion/mastery/streak tracking — direct violation), AP-04 inheritance.

**Allowed alternative.** None. If the owner wants to practice a card's content, the refresher redirects to the drill surface via explicit intent-switch (red line #17). The drill surface is where skill-state lives; the refresher stays Reference-mode.

---

### AP-PRF-05 — "Retired cards you might reconsider" nudges

**Refused.** Suppressed / hidden card classes are durable. The system does NOT surface them for owner reconsideration.

**Why.** Proactive un-suppression nudges are algorithmic rebuttal of the owner's override — red line #3 prohibits this unambiguously. Paper permanence adds a second-order violation: if the owner suppressed a class because they found its content confusing, a "you might want to reconsider" prompt could pressure them back into printing content they rejected, which would then live permanently on their laminate.

**Red line violated:** #3 (durable overrides), #13 (owner-suppression is durable indefinitely — direct violation), AP-05 inheritance.

**Allowed alternative.** Suppressed classes remain visible in the catalog flat-access view (red line #6) with "Suppressed" status tag. Owner can un-suppress via the same flow they'd use to suppress — a deliberate action on the class entry. The system never initiates.

---

### AP-PRF-06 — "Your refresher accuracy" graded-work framing

**Refused.** No in-app surface shows "how well you're using your refresher," "your refresher accuracy," "your card-read alignment with solver," or any framing that evaluates the owner's consumption of reference material.

**Why.** Cards are reference material, not assessment sheets. Grading the owner on reference-consumption is the note-taking-as-self-evaluation error Voice 3 flagged. It also slides into copy-discipline violation CD-2 (no self-evaluation framing). The refresher is a place the owner looks things up; the moment it grades the lookup, it has become a drill.

**Red line violated:** #7 (editor's-note tone), #14 (no mastery tracking), AP-06 inheritance (graded-work trap).

**Allowed alternative.** If the owner wants to test themselves on card content, explicit intent-switch to drill surface (red line #17). Drill surface has its own calibration mechanics; refresher does not.

---

### AP-PRF-07 — Cross-surface contamination

**Refused.** Refresher activity never mutates Live Advice state, Calibration Dashboard state, Anchor Library state, or any other surface's state. Conversely, no cross-surface data auto-tailors the printable catalog.

**Why.** Red line #16 is structurally bidirectional. Allowing refresher activity to leak outward would violate Reference-mode write-silence (red line #11). Allowing cross-surface data to leak inward would violate the "never personalized by play data without explicit opt-in" clause of red line #16. Per-villain calibration specifically — if it leaked onto a laminated card, Voice 3's F6 calibration-segregation doctrine fails and we ship a permanent wrong-answer vector.

**Red line violated:** #8 (no cross-surface contamination), #11 (Reference-mode write-silence), #16 (cross-surface segregation bidirectional).

**Allowed alternative.** Per Phase 2+ (PRF-P2-PE) an explicit opt-in gesture may enable a personalization mode where play data tailors the catalog — with default OFF and red line #16 compliance reviewed at Phase 2 design gate. Phase 1 refuses all cross-surface flow.

---

### AP-PRF-08 — Engagement notifications (default-on)

**Refused as default behavior.** No default-on push / email / badge-counter notifications for: "new card available," "your cards may be stale," "time to re-print," "rake changed — your cards updated."

**Why.** Notifications are the hardest engagement-pressure pattern to remove once shipped (user base calibrates to them). Paper permanence adds a specific hazard: a "time to re-print" nudge implies the system can tell when the owner's laminate is stale — which only works via cross-surface leakage or per-user inference, both of which violate red lines #11 + #16.

**Red line violated:** #5 (no engagement-pressure), #15 (no proactive print-output).

**Allowed alternative.** Opt-in toggle at `userRefresherConfig.notifications = { staleness: boolean }` (default `false`). If owner explicitly opts in, a passive in-app banner shows staleness count on next in-app visit — still no push, still no badge, still no "days since" counter.

---

### AP-PRF-09 — Auto-personalized print pack

**Refused.** No "your personalized pack tonight based on villain X" / "your personalized preflop chart based on rake change" / "your customized math tables based on recent hands" features.

**Why.** Personalization via play data is cross-surface contamination (red line #16) promoted to a UX feature. Even with opt-in gesture, the paper permanence risk is severe — a personalized card printed for "villain X tonight" becomes a permanent per-villain laminate once villain X is out of the owner's pool. This is the printable analog of why per-villain calibration cannot live on paper (Voice 3 F6).

**Red line violated:** #16 (bidirectional segregation).

**Allowed alternative.** Phase 2+ explicit-opt-in personalization is deferred to a dedicated Gate 4 design pass (PRF-P2-PE). Phase 1 refuses all auto-personalization.

---

### AP-PRF-10 — Watermark-based social engagement

**Refused.** No QR codes linking to "rate this card," no "Printed by Chris · share with your study group" social-proof framing, no "Tag this card to help others" affordances.

**Why.** The lineage footer is factual utility — version + source + assumptions — not a social affordance. Converting it into an engagement surface (QR / share / rate) slides into community-graded-work (the owner's card gets judged by other users) and exports engagement-pressure to the paper medium where it cannot be undone without re-printing.

**Red line violated:** #5 (no engagement-pressure), #7 (editor's-note tone — factual, not social).

**Allowed alternative.** Lineage footer stays informational. If the owner wants to share a card, they physically hand it to someone (paper's native affordance). No app-mediated sharing.

---

### AP-PRF-11 — Card-view analytics surfaced to owner

**Refused.** No "you've viewed this card 47 times," "this is your most-viewed card," "you haven't opened this card in 30 days."

**Why.** View-count surfacing is graded-work framing (the owner is being measured on their reference-consumption). Red line #14 forbids view-count tracking even internally; this item reinforces the structural refusal at the UI layer.

**Red line violated:** #14 (no mastery/streak tracking — direct).

**Allowed alternative.** None. If view-counts are tracked at all for internal bug diagnosis, they remain invisible in UI and are purged on owner-initiated reset.

---

## EAL-inherited anti-patterns (apply transitively)

Where refresher surfaces intersect with anchor / calibration surfaces (e.g., a card citing a POKER_THEORY §9 divergence backed by an EAL anchor), the EAL anti-pattern set applies transitively. These are enumerated in `docs/projects/exploit-anchor-library/anti-patterns.md`:

| EAL ID | Pattern | Relevance to PRF |
|---|---|---|
| AP-01 | Anchor leaderboard | Already mirrored in AP-PRF-01 (card leaderboard). |
| AP-02 | "Your top exploit tonight" auto-surfacing | Mirrored in AP-PRF-02 (card of the day). |
| AP-03 | Anchor streak | Mirrored in AP-PRF-03 (print streak). |
| AP-04 | Calibration score | Mirrored in AP-PRF-04 (mastery score). |
| AP-05 | Retired-anchors-you-might-reconsider | Mirrored in AP-PRF-05 (retired cards). |
| AP-06 | "Your calibration accuracy" graded-work | Mirrored in AP-PRF-06 (refresher accuracy). |
| AP-07 | Cross-surface calibration leakage onto live surfaces | Mirrored in AP-PRF-07 + explicitly blacklisted in F6 source-util enforcement. |
| AP-08 | Signal fusion (user declaration + behavioral observation arithmetically fused) | Applies if a card ever cites a composite signal. PRF F5 (pure/exception provenance unambiguous) prevents this at the card level. |
| AP-09 | Capture framing for observation ("how did this hand go?") | Not directly applicable — refresher does not capture observations. Subsumed by red line #11 (no write-path exists). |

**Inheritance rule.** When a PRF card cites an EAL-derived fact (e.g., a POKER_THEORY §9 divergence audit), the card inherits the parent anti-pattern register. Violations at the card level fail PRF-G5-RL regardless of whether the violating pattern is PRF-specific or EAL-inherited.

---

## Relationship to copy-discipline

Anti-patterns are **feature refusals** (what the app cannot do). Copy-discipline (`copy-discipline.md`) is **language refusals** (how the app cannot talk). Both are necessary; each fails independently. A card can satisfy anti-pattern refusals and still fail CD-1..5 at the prose level; a card can satisfy CD-1..5 and still ship an AP-PRF-04 mastery score if the content authors slip.

The CI enforcement is layered:
- **Anti-patterns** are enforced at **structural-surface review** — Gate 4 spec reviews + Gate 5 merge-review catch them.
- **Copy-discipline** is enforced at **content-build CI** — forbidden-string grep in `copy-discipline.md` §CI-lint section; blocks Gate 5 authoring PRs on violation.

---

## Change log

- **2026-04-24 — Shipped.** 11 PRF-specific anti-patterns authored from Voice 4 Gate 2 audit; EAL-inherited register enumerated with mapping; amendment-rule escalation path documented (persona-level review required).
