# Situational Sub-Persona — Stepped Away From Hand

**Type:** Situational (cross-persona)
**Applies to:** [Chris (live player)](../core/chris-live-player.md), [Rounder](../core/rounder.md), [Circuit Grinder](../core/circuit-grinder.md), [Hybrid Semi-Pro](../core/hybrid-semi-pro.md), [Apprentice](../core/apprentice-student.md), [Weekend Warrior](../core/weekend-warrior.md) (occasional) — any live-venue player in an off-hand window.
**Evidence status:** PROTO-verified by owner self-report 2026-04-24 (venue policies at Wind Creek, Homewood, Horseshoe Hammond, Rivers Des Plaines); not yet observed in practice.
**Last reviewed:** 2026-04-24
**Owner review:** Chris answered Gate 3 Q3 2026-04-24 (`docs/projects/printable-refresher/gate3-owner-interview.md` §Q3)

---

## Snapshot

The user is **at a live-poker venue, in an off-hand window** — a physical span of minutes when they are neither in an active hand nor fully away from the game. Four canonical contexts:

1. **Stepped-away between hands** — folded early, stood up, walking near the table (bathroom, rail, water, snack, chip-rack run).
2. **Seat-waiting queue** — signed up for a list, waiting in the poker room for a seat to open.
3. **Tournament scheduled break** — 15-min break between levels.
4. **Pre-session at venue** — walked in, ordering chips, scouting tables, settling in before first hand.

(Post-session at venue — stepping out, reviewing at the rail — is included as a 5th context but low-value; `post-session-chris` covers most of it.)

**Why this is a distinct situation:** during active hands, casino policy at Chris's primary venues (Wind Creek / Homewood / Horseshoe Hammond / Rivers Des Plaines) prohibits any reference material that interrupts the hand. During the four windows above, **all reference affordances are permitted** — phone, paper, notes, conversation. This is the only at-venue situation where the app (or paper) can act as a study tool rather than a play-aid. The Printable Refresher's primary use case lives here, not at `mid-hand-chris` or `between-hands-chris` (which is seated + in-session and still governed by house rules on active attention).

Distinct from:
- **`mid-hand-chris`** — at table, 1.5s decision window, cannot reference anything. OFF-limits.
- **`between-hands-chris`** — at table seated, 30–90s interstice. Phone OK for villain checks, but venue policy + social norms discourage deep reference reading.
- **`presession-preparer`** — home / car / transit pre-session. Same cognitive mode, different physical context (not at venue).
- **`post-session-chris`** — post-cashout at home / transit. Deep review; generous time budget.

This persona is the **at-the-venue-but-off-hand** counterpart to `presession-preparer`. Time windows overlap the presession-preparer's 5/15/30-min variants.

---

## Situation triggers

### Stepped-away between hands
- User folds / not dealt in / sits out one hand; stands up.
- Walks to rail / bathroom / snack / chip-rack / water cooler.
- Typical window: 2–10 min depending on hands-folded queue + social pace.
- Exits when user returns to seat.

### Seat-waiting queue
- User signs up on the wait-list at a busy poker room.
- Typical window: 15–90 min at peak hours; 5–20 min off-peak.
- Exits when called to a seat.

### Tournament scheduled break
- Scheduled break between levels (usually every 2 hours in live MTT, 15 min each).
- Deterministic window: 15 min almost always.
- Exits at level-resume clock.

### Pre-session at venue
- User has arrived, purchased chips, not yet seated.
- Typical window: 5–30 min depending on seat-assignment delay.
- Exits at first hand dealt.

**Detection note:** the app cannot auto-detect this situation (no geofence, no seat-attendance signal). Explicit user-entry is the mechanism — owner opens the Printable Refresher in-app, system respects that the user has elected a reference-mode window. No trigger-based banner surfacing.

---

## Context (deltas from core personas)

- **Time pressure:** Low (variable 5 min to 90+ min). User can tune depth to window length.
- **Attention:** Focused; not simultaneously playing. Possibly mildly adrenalized (anticipation) during seat-waiting or pre-session.
- **Cognitive load:** Light to moderate. All cycles available in principle; in practice some ambient social / environmental load (room noise, rail chatter, passing traffic).
- **Device / medium:** Phone primary. Paper (laminated cards) equal-weight permitted — **this is the situation the Printable Refresher was designed for.** Both media can be used together (paper on the rail, phone for drill-down).
- **Mood:** Anticipatory (pre-session / seat-wait) or neutral (tournament break, stepped-away-mid-session). Not typically tilted; if tilted, user has stepped away deliberately and the tone constraint from `returning-after-break` applies — no shame, no engagement pressure.
- **Posture:** Often standing or walking (stepped-away, rail), sometimes seated (seat-waiting, tournament break). Design for variable posture — one-handed use with reduced fine motor control during walking is plausible.

---

## Primary need

- **Quick, correct, context-specific reference** — user wants to reinforce or look up something specific (a preflop range they're shaky on, an auto-profit threshold they forgot, a villain-model heuristic). Not study-from-scratch (that's `study-block`).
- **Paper-compatible.** The refresher's physical laminated card is the default affordance. User may cross-reference the in-app view on phone for lineage drill-down, but the primary interaction is visual scan of paper.
- **No session-mutation.** Reading the refresher (paper or in-app) does NOT write to skill-state or live-advice state. Reference-mode write-silence is structurally enforced (red line #11).

## Secondary needs

- **Staleness awareness.** If a printed card is out of date relative to current engine output, the in-app view per-card must surface this. Owner sees the staleness state when opening the app; paper cannot self-disclose (H-PM07).
- **Seamless mode-switch to Deliberate.** If owner decides to drill a card's content, an explicit intent-switch ("Drill this card") is available — never an automatic graded evaluation (red line #17).

---

## Frustrations (JTBD killers for this situation)

- **Forced multi-tap navigation to the card I want.** Between-hands window may be 2 min. If reaching a specific card requires filter + scroll + select + confirm, the window closes. Filter/sort must be fast; pinned-cards must be 1-tap.
- **In-app view competes with paper.** If the in-app view is not a strict superset of the print artifact — or if lineage-drilldown requires leaving the refresher view — the paper wins and the in-app is unused.
- **Push notifications during the window.** Any notification ("you haven't printed in 30 days!") during an off-hand window is maximally intrusive — owner is in the most reference-receptive state of the entire day, and an interrupt breaks the context. (Defense: red line #5, AP-PRF-8.)
- **Anxiety-inducing framing on cards.** Pre-session / seat-waiting moods are anticipatory. Copy tone on cards matters — factual / structural / neutral, never imperative or evaluative (CD-1, CD-2).
- **Engagement-pressure copy on the app home.** "You haven't reviewed Card X in 2 weeks!" = shame. Forbidden (red line #5 + AP-PRF-3).

---

## Non-goals

- **Not a drill surface.** Drilling lives in `study-block` (generic) or `presession-preparer` (applied). Reference-mode is look-up, not test.
- **Not a play-aid surface.** LiveAdviceBar / sidebar / seat-context-menu serve play-aid. Refresher must not leak into those surfaces (red line #8 cross-surface segregation).
- **Not a personalization surface by default.** Phase 1 content is engine-derived / theoretical. Personal-codex export (PRF-NEW-5) is Phase 2+ opt-in (red line #16).
- **Not a social surface.** No share affordance, no "text this card to coach," no watermarks. (AP-PRF-10 refused.)

---

## Constraints

- **Time budget per interaction:** 30 sec (quick glance at a single card) to 15 min (deep pre-session review). Design for the short end — the long end is fine automatically.
- **Error tolerance:** Moderate. Misclicks on filter/sort chrome frustrate; printing the wrong batch is expensive (consumes ink + lamination pouch).
- **Visibility tolerance:** High — user has chosen the window deliberately and welcomes depth.
- **Recovery expectation:** Pre-print PDF preview is mandatory (H-N03 — paper has no undo; software-side safety net is the preview). In-app-only interactions are freely reversible.

---

## Related JTBD

### Printable Refresher primary
- `JTBD-PRF-NEW-1` (DS-60 proposed) — Carry-the-reference-offline (primary)
- `JTBD-PRF-NEW-2` (CC-82 proposed) — Trust-the-sheet
- `JTBD-PRF-NEW-3` (CC-83 proposed) — Know-my-sheet-is-stale
- `JTBD-PRF-NEW-4` (SE-04 proposed) — Pre-session visualization (especially relevant to pre-session-at-venue context)

### Drills and Study (tangential)
- `JTBD-DS-44` Correct-answer reasoning (if card surfaces a concept user wants to understand deeper)
- `JTBD-DS-50` Walk a hand line branch-by-branch (if refresher links back to study)

### Session Review (post-session-at-venue context only)
- `JTBD-SR-28` Deep-review flagged hand — if post-cashout and reviewing against printed card

---

## What a surface must offer this persona

1. **Fast card retrieval.** Pinned-cards at-top, filter-by-card-class, recent-print-history — all one-tap.
2. **Paper-first layout.** In-app view is a strict superset of print; print artifact works standalone with lineage footer.
3. **Per-card staleness indicator.** Amber footer on drifted cards, informational batch banner at refresher home. No push.
4. **Pre-print PDF preview.** Mandatory software-side safety net (H-N03 paper-no-undo).
5. **Lineage drill-down one-tap.** "Where does this number come from?" opens source-util + theory-section + assumption-bundle modal.
6. **Intent-switch to drill on-demand.** "Drill this card" button explicitly switches to Deliberate mode (red line #17).
7. **Silent write-silence.** Reading a card never mutates skill-state. Reducer-boundary assertion on `currentIntent: 'Reference'`.
8. **Socially-discreet paper layout.** Small cards, no bright color blocks visible across the rail (H-PM08 + H-PLT04 inheritance).

---

## What a surface must NOT do

- **Push notifications.** Never during off-hand window (maximally intrusive; red line #5 + AP-PRF-8 inheritance).
- **Card-of-the-day auto-surface.** User has chosen the window; system does not choose the card (AP-PRF-2).
- **Mastery / streak / completion tracking surfaced.** Refresher is reference, not drill (red line #14 + AP-PRF-3/4/6).
- **Cross-surface contamination.** Reading a card during seat-wait must not alter LiveAdviceBar state when owner sits down (red line #8 + #16).
- **Auto-personalized pack.** Phase 1 content is population-baseline; personalization is explicit owner gesture in Phase 2+ (red line #16 + AP-PRF-9).
- **Graded framing.** "How did you do on this card?" / "Rate your confidence." Refresher is not an assessment surface (CD-2).
- **Venue-detection heuristics.** No geofence; no "you're near Horseshoe Hammond, here's tonight's pack." User explicitly opens the refresher; system respects the gesture without surveillance.

---

## Related core personas

- [Chris, Live Player](../core/chris-live-player.md) — primary (owner confirmed 2026-04-24).
- [Rounder](../core/rounder.md) — primary (second persona most at-venue).
- [Circuit Grinder](../core/circuit-grinder.md) — primary for tournament-break context.
- [Hybrid Semi-Pro](../core/hybrid-semi-pro.md) — primary for mixed-venue (live + online).
- [Apprentice](../core/apprentice-student.md) — secondary (coach-curated pack carried to venue).
- [Weekend Warrior](../core/weekend-warrior.md) — tertiary (less reference-dependent).

---

## Related situational sub-personas

- [Presession-Preparer](./presession-preparer.md) — parallel situation in pre-session, off-venue. Cognitive mode identical; physical context differs.
- [Mid-hand-chris](./mid-hand-chris.md) — EXPLICITLY complementary and mutually exclusive — the two situations together partition the "at-venue during session" time into {in-hand / off-hand} halves. Paper reference permitted in this persona; prohibited in mid-hand-chris.
- [Between-hands-chris](./between-hands-chris.md) — at-table 30-90s seated interstice — distinct from this persona (stepped-away is walking / off-chair / off-table). Phone-only for between-hands; phone+paper for stepped-away.
- [Returning-after-break](./returning-after-break.md) — if user has been away from the app for ≥28 days AND returns at a venue in this situation, welcome-back surface fires once on first refresher open (inherits `returning-after-break` defenses).

## Related autonomy red lines

This persona is the **primary use context** for Reference-mode write-silence (red line #11) and cross-surface segregation (red line #8 + #16). The off-hand window is when the boundary between "study" and "play" is most porous temporally — user is physically at the venue, about to play or mid-pause in playing. Reference-mode surfaces must structurally refuse to mutate live-advice state in this window, because any data leakage would compound (stepped-away-glance triggers live-advice shift → user returns to hand and sees advice shifted → interpretable as surveillance).

## Missing features

- [DISC] Pinned-cards-at-top filter for fast retrieval (Gate 4).
- [DISC] Paper-optimized print-preview PDF export (Gate 4).
- [DISC] Per-card staleness amber footer (Gate 4 + Gate 5).
- [DISC] Intent-switch "Drill this card" button (deferred until drill pairing ships).

---

## Proto caveats

- **[SAFH-1]** Four canonical contexts (stepped-away-between-hands, seat-waiting, tournament break, pre-session-at-venue) may not be exhaustive. Post-session-at-venue noted as low-value 5th context; may warrant own treatment if evidence surfaces. Verify against first real at-venue observations.
- **[SAFH-2]** Time window ranges (2-10 min stepped-away, 5-90 min seat-waiting, 15 min tournament break, 5-30 min pre-session) are owner-reported 2026-04-24 and cover his primary venues. Other venues may differ. Verify if app ships outside Wind Creek / Homewood / Horseshoe Hammond / Rivers Des Plaines population.
- **[SAFH-3]** Venue-policy claim ("paper permitted off-hand, prohibited in-hand") is owner-reported for his 4 primary venues. WSOP / Venetian / Commerce / Aria / online-specific venues may have different policies. If app user-base expands, re-survey.
- **[SAFH-4]** No auto-detection — explicit user-entry only. If owner later requests geofence-based detection, that's a Phase 2+ scope expansion with autonomy review (no silent location tracking).

---

## Change log

- 2026-04-24 — Created Gate 3 of Printable Refresher project. Replaces Voice 1's originally-proposed `paper_reference_permitted` attribute on `mid-hand-chris` (withdrawn per Q3 owner interview — paper is NOT permitted mid-hand in owner's primary venues). Situational persona is cross-persona (applies to Chris + Rounder + Circuit Grinder + Hybrid + Apprentice); named for the activity, not the subject. Primary evidence: Gate 3 Q3 owner self-report 2026-04-24 (`docs/projects/printable-refresher/gate3-owner-interview.md` §Q3). Pairs with JTBD PRF-NEW-1 (DS-60 proposed — Carry-the-reference-offline).
