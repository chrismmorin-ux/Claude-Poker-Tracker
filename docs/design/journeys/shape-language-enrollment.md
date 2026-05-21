# Journey — Shape Language Enrollment

**ID:** `shape-language-enrollment`
**Last reviewed:** 2026-05-11

---

## Purpose

End-to-end path for a user to opt in to Shape Language adaptive lesson seeding. Realizes the Gate 3 verdicts: single master toggle (Q2) + optional skippable Q7 self-declaration seed + automatic landing on the Shape Language Study Home embed in the user's chosen intent mode. The journey is **deliberately frictionless to skip** — the autonomy red lines forbid placement-quiz friction at first-launch, and the default behavior for an unconfirmed user is "don't enroll, expose the flat index in Reference mode anyway."

This journey is registered with the [study-home.md](../surfaces/study-home.md) embed contract; the parent home routes the user here when they take an enrollment action from the Shape Language Deliberate or Discover mode body.

---

## Primary JTBD

- `ON-87` — Cold-start descriptor seeding (Active, SLS). The user's first encounter with the adaptive Shape Language layer; the journey establishes initial posterior + mute state before the first Deliberate/Discover surface renders.

## Secondary JTBD along the journey

- `JTBD-SE-01` — Session-entry intent setting (the journey ends by routing the user into a chosen intent mode).
- `DS-47` — Skill map / mastery grid (Proposed) — the Q7 declaration seed populates the initial mastery map; the user sees it on first transparency-screen open.

## Personas

Primary:
- [Chris (live player)](../personas/core/chris-live-player.md) — expert user; primary beneficiary of the Q7 self-declaration seed (avoids being treated as a novice).
- [scholar-drills-only](../personas/core/scholar-drills-only.md) — primary canonical adaptive-learner; takes the journey from the default novice path without the Q7 seed.

Secondary:
- [Apprentice](../personas/core/apprentice-student.md) — may be guided through this journey by a coach.
- [Newcomer](../personas/core/newcomer.md) — likely takes Reference-only path; may never enroll.

---

## Entry triggers

The journey starts on **explicit user action**, never on first launch or app open. Three valid triggers:

1. **From Study Home flat-index entry** — user clicks the Shape Language entry while in Deliberate or Discover mode (Reference mode opens lessons in read-only without triggering enrollment).
2. **From Settings → Shape Language → Enable** — explicit toggle in Settings surface.
3. **From a per-descriptor lesson** — user reads a Shape Language descriptor lesson in Reference mode and taps "Enroll in adaptive learning" if shown.

Each trigger leads into Step 1 below. The user can abort at any step; abort returns them to the entry surface unchanged.

---

## Exit conditions

- **Success — Enrolled with seed declarations:** Master toggle on; Q7 seed declarations recorded; user lands on Shape Language Study Home embed in chosen intent mode.
- **Success — Enrolled without seed declarations:** Master toggle on; Q7 skipped; charter-default hydration (`alpha=1,beta=1` per descriptor); user lands on Shape Language Study Home embed.
- **Abort at Step 1:** User declines master toggle; returns to entry surface; no state changes; no nudge to re-prompt.
- **Abort at Step 2 (Q7):** User taps skip; charter defaults persist; treated as Success-without-seed-declarations.
- **Resume after partial enrollment:** Not applicable — the journey is short enough that partial state is not persisted. The user either completes or returns to entry surface.

---

## Steps

| # | Surface | Action | State change | Time target |
|---|---------|--------|--------------|-------------|
| 1 | enrollment-master-toggle | Show consent copy + single master toggle | None until user taps "Enable" → `shapeMasteryEnrolled = true` | 15–30s |
| 2 | enrollment-declaration-seed | Show all 10 descriptors as a checkbox list with "Skip (recommended for new users)" as dominant default | If user checks any: posterior `alpha=8,beta=2` + `userMuteState='already-known'` for each checked; if skipped: charter defaults | 30–60s (or 1 tap to skip) |
| 3 | shape-language-study-home | Land user in their previously-chosen intent mode (default: Discover for newly-enrolled) | `currentIntent` may be initialized | 0s (route) |

Total target time for primary path: **~45–90s if user provides Q7 seeds; ~15–20s if they skip Q7.**

---

## Step 1 detail — Master toggle

**Surface (transient):** `enrollment-master-toggle` — single-screen modal or routed view.

**Anatomy:**
```
+---------------------------------------------------+
| Enable Shape Language adaptive learning?          |
|---------------------------------------------------|
| Shape Language uses a Bayesian skill model to     |
| recommend which descriptors to practice next.     |
| You can:                                          |
|   • Turn this off any time in Settings.           |
|   • Mute individual descriptors with "already     |
|     know this" at any drill.                      |
|   • Browse all lessons without enrolling.         |
|                                                   |
| Skill data stays on your device.                  |
|                                                   |
|              [Enable]     [Not now]               |
+---------------------------------------------------+
```

**Copy invariants:**
- No "free trial" / "try it" / "limited time" framing.
- No "you'll get better faster" promises (per AP-PIO autonomy-skeptic refusals — engagement-pressure ban).
- "Not now" is the secondary CTA, equal-weight visual to "Enable." Per red line #1, declining is a first-class option, not a dim path.
- Explicit list of override paths (mute, off-toggle, flat-index access). The user sees the autonomy they retain before deciding.

**On "Enable":** dispatch `ENROLL_SHAPE_MASTERY` → reducer flips `shapeMasteryEnrolled = true` → proceed to Step 2.
**On "Not now":** return to entry surface; zero state change. The journey is dropped; future triggers re-enter at Step 1.

---

## Step 2 detail — Declaration seed (Q7 self-declaration)

**Surface (transient):** `enrollment-declaration-seed` — single-screen.

**Anatomy:**
```
+---------------------------------------------------+
| Know any of these already? (optional)             |
|---------------------------------------------------|
| Tick descriptors you can identify quickly. We'll  |
| skip these when suggesting practice. You can      |
| change this any time in Settings.                 |
|                                                   |
|  [ ] Silhouette — overall range shape            |
|  [ ] Saddle — bimodal distribution               |
|  [ ] Spire — narrow concentrated polarization    |
|  [ ] Basin — wide flat distribution              |
|  [ ] Ridgeline — sharp boundary                  |
|  [ ] Sankey — multi-street flow                  |
|  [ ] (...4 advanced descriptors collapsed)        |
|                                                   |
|       [Skip — recommended for new users]          |
|       [Continue]                                  |
+---------------------------------------------------+
```

**Copy invariants:**
- "Skip" is the **dominant CTA** by visual weight, not "Continue." Per Q7 verdict + autonomy-skeptic refusal of placement quizzes.
- "(optional)" in the title; not "Required to continue."
- No scoring language ("rate yourself"); no levels ("beginner / intermediate"). Just a binary "know it well enough to suggest skipping."
- The 4 advanced descriptors are collapsed by default (one tap to expand). Reduces the visual count for skim-skip; users with expertise expand and tick.

**On "Continue" with selections:** for each ticked descriptor `d`, dispatch `SEED_DESCRIPTOR_DECLARATION(d, { alpha: 8, beta: 2, userMuteState: 'already-known' })`. Proceed to Step 3.
**On "Continue" with no selections:** identical effect to skip (no seeds applied).
**On "Skip":** charter defaults persist (`alpha=1,beta=1` per descriptor; `userMuteState='none'`). Proceed to Step 3.

**Time-on-screen target:**
- Skip path: ≤5s (read title, see skip is dominant, tap).
- Engaged path: 30–60s (read each descriptor name, tap relevant boxes).
- If user spends >90s on this screen, the design failed — friction is too high. Telemetry not in scope for v1 but a metric to consider at Phase 5+.

---

## Step 3 detail — Land user in study mode

**Surface:** `shape-language-study-home` (the embed inside parent study-home).

**Behavior:**
- Default `currentIntent` for newly-enrolled user: **Discover** (the mode where the adaptive seeder gives them a starting recommendation immediately).
- If the user enrolled from a non-Discover entry (e.g., Settings → Enable while not in Study Home), `currentIntent` is preserved from their last visit, defaulting to Reference for first-ever opens.
- Seeder rec computed from initial posteriors:
  - If Q7 declarations were made: seeder picks the highest-decay-weighted descriptor among the non-declared ones. If all 10 were declared, shows "You've muted every descriptor. Recalibrate any in Settings."
  - If Q7 was skipped: per charter, seeder shows **Silhouette unconditionally** as the first rec (broadest surface coverage; shallowest curve; matches charter Decisions Log 2026-04-23).

---

## Variations

### Variation A — Re-enrollment after disenrollment

Pattern: user enrolled previously, disenrolled, and now wants back in.

Behavior: re-entering at Step 1 shows additional copy line: "Your previous skill data is preserved. You can clear it or keep building from it." Two-checkbox option appears with Continue:
- [x] Keep previous skill data (default)
- [ ] Start fresh (clears `shapeMastery` + resets `userMuteState`)

Step 2 is skipped if re-enrolling with kept data (the data IS the seed); shown if "Start fresh" was checked.

### Variation B — Coach-assigned enrollment (Apprentice persona)

Pattern: an apprentice's coach has shared a recommended-descriptors list (future feature; not v1).

Currently: identical to default journey. Q7 seed reflects the apprentice's own self-assessment, not the coach's.

**Out of scope for v1.** Listed here to document the design space for coach-share at a later gate; do not implement in Stream D.

### Variation C — Cold-start from Settings (not Study Home)

Pattern: user enrolls from Settings, never having opened Study Home.

Behavior: Step 3 lands the user at Settings's "Shape Language" sub-panel (showing their fresh transparency screen) instead of at Study Home. The user can navigate to Study Home from there or anywhere else. Trade-off: less aggressive routing into the study surface; preserves user's settings-task focus.

---

## Failure / abort paths

- **Abort at Step 1 ("Not now"):** Return to entry surface. Zero state change. The journey is droppable; no penalty for declining.
- **Abort at Step 2 ("Skip"):** Treated as success-without-seed. Charter defaults persist. User lands in Study Home Discover mode.
- **Navigate away mid-Step-1:** User backs out of the modal/route. Treated identically to "Not now"; no enrollment.
- **Navigate away mid-Step-2:** User backs out after enrolling but before deciding on seeds. Master toggle is on; charter defaults persist; user can re-trigger Q7 from Settings → Shape Language → "Re-do declaration seeds."

---

## Observations

- **The Q7 seed is not a quiz.** Phrasing matters: "Know any of these already?" with dominant Skip — not "Rate your skill" with required selection. Per autonomy-skeptic verdict (Q7) + cold-start recommender literature (frictionless onboarding > better priors).
- **The 10 descriptors are presented flat, not ranked.** Showing them in catalog order (Silhouette first, advanced descriptors collapsed) avoids implying difficulty levels — there are no levels in this system per Q4 verdict (no fused scores).
- **No declared-already-known descriptor is **inaccessible** as a result of the seed.** Per red line #6, the flat lesson index always exposes every descriptor regardless of mute. The seed only affects Discover-mode ranking + the suggested practice schedule.
- **Re-enrollment (Variation A) is non-destructive by default.** Previous data is preserved unless explicit "Start fresh" is chosen. This matches Q6 verdict (skill model is user data; preserved through export/re-import).
- **No telemetry in v1.** Engagement metrics (time-on-screen, skip rate, declarations per user) are interesting at scale but the v1 cohort is N=1. Add at Phase 5+ if needed.

---

## Linked audits

- `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding-rerun.md` — Gate 2 GREEN re-run (binding red lines).
- `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md` — Gate 2 RED original (autonomy concerns surfaced here).

---

## Cross-references

- [study-home.md](../surfaces/study-home.md) — parent surface that this journey routes into.
- [shape-language-study-home.md](../surfaces/shape-language-study-home.md) — the embed the user lands on at Step 3.
- [shape-mastery.md](../contracts/shape-mastery.md) — contract that defines the state shape this journey mutates.
- `docs/projects/poker-shape-language/gate3-decision-memo.md` Q2 + Q7 verdicts (master toggle + self-declaration seed).
- `docs/projects/poker-shape-language/gate2-voices/04-autonomy-skeptic.md` — autonomy red lines this journey is bound to.

---

## Change log

- 2026-05-11 — Created at SPR-073 (Shape Language Gate 4, WS-039). Implements Q2 + Q7 verdicts. Step 2 declaration seed is skip-by-default per Q7; default landing is Discover mode for new enrollments per charter Decisions Log 2026-04-23.
