# Surface — Lesson Runner (Shape Language drill / lesson)

**ID:** `lesson-runner`
**Code paths:** (none yet — design-only at Gate 4)
- *Planned:* `src/components/views/LessonRunnerView/LessonRunnerView.jsx` (single shell)
- *Planned:* `src/components/views/LessonRunnerView/ReferenceVariant.jsx` (read-only walkthrough body)
- *Planned:* `src/components/views/LessonRunnerView/DeliberateVariant.jsx` (graded drill body)
- *Planned:* `src/components/views/LessonRunnerView/DiscoverVariant.jsx` (graded drill body w/ seeder context)
- *Planned:* `src/utils/skillAssessment/shapeLanguage/drillOutcome.js` — pure `recordDrillOutcome(descriptorMastery, observation) → mutation`

**Route / entry points:**
- *Planned:* `SCREEN.LESSON_RUNNER` + route params `{ descriptorId, intent: 'reference' | 'deliberate' | 'discover' }`
- Reference variant: opens from [shape-language-study-home.md](./shape-language-study-home.md) flat-index click in Reference mode; opens from [shape-skill-map.md](./shape-skill-map.md) row "view lesson" affordance.
- Deliberate variant: opens from `shape-language-study-home` Deliberate-mode schedule "Drill" button per row.
- Discover variant: opens from `shape-language-study-home` Discover-mode seeder card "Start drill" button.
- Closes to: previous surface via back (preserves intent on study-home).

**Last reviewed:** 2026-05-11

---

## Purpose

The execution surface for descriptor learning. Renders one descriptor's lesson + drill flow under one of three intent modes (Reference / Deliberate / Discover). Single shell with three variant bodies; intent flows in via route param, not modal toggle (per [study-home.md](./study-home.md) three-intent taxonomy: "three modes are routes, not toggles").

The body shape differs across intents — Reference is a read-only walkthrough of descriptor definition + example glyphs; Deliberate/Discover are graded drills that write `RECORD_DRILL_OUTCOME` per [shape-mastery.md](../contracts/shape-mastery.md). Discover adds seeder-context affordances ("Not this one" / "Mute") on top of the Deliberate drill body.

This surface is the third authored for SLS Gate 4. It is the only surface where the `RECORD_DRILL_OUTCOME` writer fires — meaning every other surface in the SLS system either reads `shapeMastery` posteriors (skill-map, study-home embed, seeder ranking) or writes a *different* writer (enrollment seeds declarations; skill-map recalibrates / unmutes / resets). Drill outcomes route only through here.

## JTBD served

Primary:
- `DS-46` — Spaced repetition for descriptor recognition (**Proposed**) — the drill body executes the repetition
- `DS-47` — Skill map / mastery grid (**Proposed**) — drill outcomes are the data source for posterior updates that shape-skill-map renders
- `DS-54` — Exploration override (**Active — non-negotiable** per red line #3) — Discover variant's "Not this one" / "Mute" affordances live in this surface
- `JTBD-SE-01` — Adaptive seeder rec (entry from `shape-language-study-home` Discover mode → arrives in Discover variant)

Secondary:
- `ON-87` — Cold-start descriptor seeding (Active) — first-launch enrollment journey routes into Discover variant for the seeded starter descriptor
- **Red line #4 instantiation (incognito)** — Deliberate + Discover variants both render the incognito toggle inline (header position); reference variant is structurally incognito (no writes possible)

## Personas served

Primary:
- [scholar-drills-only](../personas/core/scholar-drills-only.md) — primary drill consumer (Deliberate variant)
- [study-block](../personas/situational/study-block.md) — extended drill session (Deliberate variant; multiple descriptors in sequence via study-home schedule)
- [Chris (live player)](../personas/core/chris-live-player.md) between sessions (Reference variant for quick refresh; Deliberate for scheduled drill)
- [presession-preparer](../personas/situational/presession-preparer.md) (Discover variant arrival via seeder when tonight-adjacent scoping fires)

Secondary:
- [Apprentice](../personas/core/apprentice-student.md) — coach-assigned drill (Deliberate variant)
- [returning-after-break](../personas/situational/returning-after-break.md) — post-decay drill (Discover variant arrival)

Refused (per red line #8):
- [mid-hand-chris](../personas/situational/mid-hand-chris.md) — this surface NEVER opens while a hand is live. No entry path from TableView / OnlineView / LiveAdviceBar exists by design.

---

## Three-variant body shapes

The shell is the same — header (descriptor name + back) + body (variant-specific) + footer (variant-specific). The reducer reads `currentIntent` from the URL/route param and asserts at writer entry (per I-SM-3) that Reference variant cannot dispatch `RECORD_DRILL_OUTCOME` even if the body somehow tries.

### Reference variant — read-only walkthrough

```
+--------------------------------------------------------+
| ← back                                                 |
|                                                         |
| Silhouette                              [Reference]    |
|--------------------------------------------------------|
| Definition                                              |
| {descriptor.definition}                                 |
| (~2-3 sentences from descriptor catalog)               |
|                                                         |
| Example glyphs                                          |
| [glyph 1]   [glyph 2]   [glyph 3]                      |
| (3-5 worked examples — board+hero pairs with annotation)|
|                                                         |
| Why this descriptor                                     |
| {descriptor.pedagogy}                                   |
| (~3-5 sentences on what this descriptor captures and    |
|  when it's load-bearing)                                |
|                                                         |
| Related descriptors                                     |
| - Saddle (pairs with Silhouette in cbet-defense)        |
| - Ridgeline (visually similar; key distinguisher: ...)  |
|--------------------------------------------------------|
| Footer                                                  |
| (No buttons. Read-only surface. Back nav only.)        |
+--------------------------------------------------------+
```

**Variant invariants:**
- No drill prompts. No "answer correct/wrong" UI.
- No incognito toggle in footer (variant is structurally incognito).
- Footer has no write affordances (no `[Start drill]`, no `[Mute]`, no `[Mark as already known]`).
- Touching this surface dispatches **nothing** — `RECORD_DRILL_OUTCOME` is structurally impossible; `lastInteractedAt` may update if and only if the project ratifies it as a Reference-mode write (current verdict: it does **not** — Reference is fully ephemeral per red line #4 "incognito is non-negotiable" and red line #1 "Outside enrolled state, drill interactions are ephemeral and produce no skill inference").

### Deliberate variant — graded drill

```
+--------------------------------------------------------+
| ← back        [Incognito: OFF — drill writes]   [Deliberate]|
|--------------------------------------------------------|
| Saddle drill — spot 1 of 6                              |
|                                                         |
| Board: 7♥ 4♥ 2♠                                         |
| Hero: Q♠ J♠                                             |
|                                                         |
| Question: Is this a saddle?                             |
| [Yes — it's a saddle]   [No — not a saddle]             |
|--------------------------------------------------------|
| Footer                                                  |
| [Toggle incognito mid-drill]   [End drill early]        |
+--------------------------------------------------------+
```

**After answer (correct or wrong):**

```
+--------------------------------------------------------+
| Saddle drill — spot 1 of 6           ✓ Correct          |
|                                                         |
| Board: 7♥ 4♥ 2♠   Hero: Q♠ J♠                          |
|                                                         |
| Yes — this is a saddle.                                 |
| Reasoning: {descriptor.spot_reasoning[1]}               |
| (1-2 sentences explaining why this spot fits saddle)    |
|                                                         |
| [Next spot →]                                           |
+--------------------------------------------------------+
```

**Variant invariants:**
- Incognito toggle visible in header. Per-session state. Per red line #4: must be available mid-drill, not just at drill start.
- Drill outcome writes via `RECORD_DRILL_OUTCOME` happen at drill *completion* (all spots answered), not per-spot. Per-spot answers buffer in component-local state; on completion, a single dispatch sends the aggregated `{ correct, total, durationMs }` observation. **Exception:** if user taps `[End drill early]`, the partial drill writes only if `correct >= ceil(total/2)`; otherwise discards (do not penalize abandonment per red line #5).
- If incognito is ON at drill completion, no write fires. A footer indicator confirms "no model update this session" (per [shape-language-study-home.md](./shape-language-study-home.md) Deliberate-mode behavior).
- Feedback after each answer is **factual + pedagogical**, never affective. "✓ Correct" or "✗ Not quite — reasoning: ..." — never "Great job!" or "Don't worry!" (red line #7).

### Discover variant — graded drill with seeder context

Identical to Deliberate variant body, plus:

```
+--------------------------------------------------------+
| ← back        [Incognito: OFF]              [Discover]  |
|                                                         |
| Saddle drill (from seeder — lowest confidence)          |
| [Not this one]    [Mute "already-known"]                |
|                                                         |
| (then identical drill body to Deliberate)               |
+--------------------------------------------------------+
```

**Variant-specific affordances:**
- Header shows seeder rationale: "from seeder — {reason}" where reason is one factual line from `useShapeMasterySeederRanking()` rationale (lowest confidence / longest gap / declared starter).
- `[Not this one]` — opens skip-disambiguation popover with two options: "Already know this" → `RECORD_SKIP_DISAMBIGUATION(descriptorId, 'already-known')` + route back to `shape-language-study-home` Discover mode for next rec. "Not today" → `RECORD_SKIP_DISAMBIGUATION(descriptorId, 'not-today')` + same routing.
- `[Mute "already-known"]` — single tap; dispatches `MUTE_DESCRIPTOR(descriptorId, 'already-known')` immediately and routes back. Per red line #3 ("single tap").
- These affordances are visible **only before the user starts answering**. After spot 1's answer is submitted, the seeder-context bar collapses; only the drill body + incognito toggle remain visible. This prevents mid-drill mute-and-bail.

**Variant invariants:**
- All Deliberate variant invariants hold.
- Skip-disambiguation MUST be a single tap to the popover (per red line #3 "single tap"). The popover itself has two clearly-labeled buttons, no nested confirmation.
- Mute affordance MUST NOT prompt confirmation (per red line #3).

---

## Anatomy summary across variants

| Element | Reference | Deliberate | Discover |
|---|---|---|---|
| Header: descriptor name | ✓ | ✓ | ✓ |
| Header: intent label | "Reference" | "Deliberate" | "Discover" |
| Header: seeder rationale | ✗ | ✗ | ✓ (one-line, factual) |
| Header: incognito toggle | ✗ | ✓ | ✓ |
| Body: definition + glyphs | ✓ (primary content) | ✗ | ✗ |
| Body: drill prompt | ✗ | ✓ | ✓ |
| Body: per-answer feedback | ✗ | ✓ | ✓ |
| Body: pre-start skip/mute bar | ✗ | ✗ | ✓ |
| Footer: write affordances | ✗ | "End drill early" | "End drill early" |
| Footer: navigation back | ✓ | ✓ | ✓ |
| **Writers fired** | none | `RECORD_DRILL_OUTCOME` (on completion) | `RECORD_DRILL_OUTCOME`, `RECORD_SKIP_DISAMBIGUATION`, `MUTE_DESCRIPTOR` |

---

## State

- **Read from `shapeMastery` (via `useShapeMastery(descriptorId)`):** the per-descriptor record. Used to render seeder rationale in Discover variant + display current `userMuteState` (informational only).
- **Read from session-scoped state:** `sessionIncognito: boolean`. Toggled mid-drill via header toggle.
- **Read from drill content source:** `descriptor.spots: { board, hero, isInstance, reasoning }[]` — sourced from `docs/projects/poker-shape-language/descriptors/{descriptorId}.md` (planned Markdown content directory, populated at Stream B).
- **Component-local state:**
  - `currentSpotIndex: number` — which of N spots is active
  - `answers: { spotIndex: 'yes' | 'no' }[]` — per-spot answer buffer
  - `drillStartedAt: number` — ms timestamp for duration calc
- **Mutations dispatched:**
  - Reference: **none**
  - Deliberate: `RECORD_DRILL_OUTCOME(descriptorId, { correct, total, durationMs })` on completion or partial-credit early-end; `TOGGLE_SESSION_INCOGNITO(boolean)` from header
  - Discover: all of Deliberate's writes plus `RECORD_SKIP_DISAMBIGUATION(descriptorId, 'already-known' | 'not-today')` and `MUTE_DESCRIPTOR(descriptorId, 'already-known')`
- **Mutations NOT dispatched:**
  - **Never:** `SEED_DESCRIPTOR_DECLARATION` (enrollment journey only); `RECALIBRATE_DESCRIPTOR` / `RESET_SHAPE_MASTERY` / `DISENROLL_SHAPE_MASTERY` (skill-map only); `UNMUTE_DESCRIPTOR` (skill-map only); `ENROLL_SHAPE_MASTERY` (enrollment only)
  - **Reference variant specifically:** zero dispatches per I-SM-3 (reducer entry rejects all writers when `currentIntent === 'reference'`)
- **Environment assumptions:** `shapeMasteryReducer` mounted; user is enrolled (`enrolled === true`) for Deliberate + Discover variants — if reached while not enrolled, redirect to enrollment journey. Reference variant is **not enrollment-gated** (it's the always-available read-only path per red line #6 — "flat lesson index always accessible").

## Props / context contract

```
LessonRunnerView({ descriptorId: string, intent: 'reference' | 'deliberate' | 'discover' })
  // Route param plumbing; reads intent from URL on mount; persists intent
  // for the lifetime of this surface (no in-surface mode-switch button).
```

The shell dispatches to variant components based on `intent`:

```
{ intent === 'reference' && <ReferenceVariant descriptorId={...} /> }
{ intent === 'deliberate' && <DeliberateVariant descriptorId={...} /> }
{ intent === 'discover' && <DiscoverVariant descriptorId={...} /> }
```

Variant components use scoped hooks: `useShapeMastery(descriptorId)`, `useShapeMasterySeederRanking()` (Discover only), `useSessionIncognito()` (Deliberate + Discover only).

## Key interactions

### Reference variant
- **Tap back:** routes to study-home with intent persisted; no dispatch.
- (No other interactive elements.)

### Deliberate variant
- **Tap [Yes / No] on a spot:** buffers answer in component-local state; advances to next spot; no dispatch yet.
- **Drill completion (last spot answered):** single dispatch `RECORD_DRILL_OUTCOME(descriptorId, { correct, total, durationMs })` UNLESS `sessionIncognito === true`; route to completion screen ("Drill complete — N/N correct"). Per red line #5: completion copy is factual ("4/5 correct"), not affective ("Great job!").
- **Tap [End drill early]:** if `answeredCount >= ceil(total/2)`, dispatch `RECORD_DRILL_OUTCOME` with partial counts (per "abandonment is not penalized" — partial completion writes the partial data); otherwise discard and route back.
- **Tap [Toggle incognito mid-drill]:** dispatches `TOGGLE_SESSION_INCOGNITO`. Header indicator updates. Affects whether the eventual completion write fires.

### Discover variant
- All Deliberate interactions, plus:
- **Tap [Not this one] (pre-first-answer only):** opens popover with [Already know this] + [Not today].
  - **Tap [Already know this]:** dispatch `RECORD_SKIP_DISAMBIGUATION(descriptorId, 'already-known')` (which the reducer maps to `userMuteState='already-known'; declaredLevel='known'` per shape-mastery contract); route back to study-home Discover.
  - **Tap [Not today]:** dispatch `RECORD_SKIP_DISAMBIGUATION(descriptorId, 'not-today')` (which the reducer maps to `userMuteState='not-interested'`, transient); route back.
- **Tap [Mute "already-known"] (pre-first-answer only):** dispatch `MUTE_DESCRIPTOR(descriptorId, 'already-known')`; route back. Single tap; no confirm.

### Cross-variant
- **Touch the back button:** route to study-home with intent persisted. No dispatch from the back action itself.
- **Touch a deep-link to a different descriptor:** route param changes; component remounts; same variant logic applies.

---

## Red-line compliance (this surface's slot in the SPR-074 conformance matrix)

| Red line | This surface's compliance | Enforcement |
|---|---|---|
| **#1 — Opt-in enrollment required** | Deliberate + Discover variants gated on `enrolled === true`; redirect to enrollment if reached unenrolled. Reference variant is intentionally **NOT** gated (red line #6 — flat lesson index always accessible). | **DOM-assert** (render test): Deliberate variant when not enrolled redirects (no body renders); Reference variant when not enrolled still renders. |
| **#2 — Full transparency** | N/A directly (transparency surface is skill-map); but this surface contributes to transparency by writing observations that surface there. Drill completion screen shows what got written: "4/5 correct → posterior updated from α=5 β=3 to α=9 β=4" (factual, inspectable). | **DOM-assert**: completion screen render test asserts the "posterior updated from X to Y" string is present when non-incognito. |
| **#3 — Durable override** | Discover variant `[Not this one]` + `[Mute]` are single-tap. No confirmation modal. Skip-disambiguation has exactly 2 buttons, no nesting. After mute, no nag re-prompts re-show this descriptor. | **DOM-assert**: Discover variant render test asserts `[Not this one]` + `[Mute]` present pre-first-answer; clicking either fires expected dispatch with no confirm modal interception. **CI-grep**: forbid "still want to mute" / "are you sure you want to skip" copy strings. |
| **#4 — Three-way reversibility — incognito** | Incognito toggle visible in Deliberate + Discover variant header. Toggleable mid-drill. Reference variant is structurally incognito (no writes possible). Footer indicator confirms current state. | **DOM-assert**: Deliberate + Discover variant render tests assert toggle present and state-reflective. **DOM-assert**: when toggle is ON at completion, render test asserts no `RECORD_DRILL_OUTCOME` dispatch fires; footer renders "no model update this session" copy. |
| **#5 — No streaks/shame/engagement-pressure/notifications** | Completion screen is factual ("4/5 correct"). No streak counters. No "X days in a row" framing. No notifications emitted from this surface. Early-end is not punished (partial-credit write or discard, no shame copy). | **CI-grep**: forbidden strings — `currentStreak`, `consecutiveCorrect`, "Great job", "Don't worry", "Keep it up", "You're on a", "streak". **DOM-assert**: completion render test asserts no element with class matching `/streak\|celebration\|reward/`. |
| **#6 — Flat lesson index always accessible** | Reference variant is unconditionally accessible via the flat-index click path from study-home. This surface honors that path. | **DOM-assert**: Reference variant route test asserts surface renders for any of the 10 descriptors regardless of enrollment / mute / declaration state. |
| **#7 — No gamified-infantile language** | Drill feedback is editor's-note tone: "✓ Correct" / "✗ Not quite — {reasoning}". No badges, no celebration animations, no mascots, no emoji rewards. | **CI-grep**: forbidden strings list (same as skill-map's #7 — "great job", "🎉", etc.). **DOM-assert**: completion + per-answer feedback render tests assert no image/svg with badge-class. |
| **#8 — No cross-surface contamination** | This surface's source files MUST NOT import from `src/components/views/TableView/**`, `src/components/views/OnlineView/**`, or `src/utils/exploitEngine/**`. Drill outcomes write only to `shapeMastery`; no side-channel into live-table state. | **CI-grep**: imports check (same pattern as skill-map's #8); plus a route-table assertion that NO live surface registers `LessonRunner` as a sub-route. |
| **#9 — Mastery never displayed as a score** | Drill completion shows correct-count + posterior parameter update; never a fused "your mastery: 0.65" rendering. Per-spot feedback shows correct/wrong, not a running score. No leaderboard / percentile / level UI. | **CI-grep**: forbidden strings — `masteryScore`, `fusedMastery`, "your mastery: ", "your level: ", "percentile". **DOM-assert**: completion render test asserts posterior is rendered as α + β (or "N correct / M total"), never as a single 0-1 score. |

Aggregate matrix lives at [`docs/design/audits/2026-05-11-sls-g4-redline-conformance.md`](../audits/2026-05-11-sls-g4-redline-conformance.md).

---

## I-SM-3 Reference-mode reducer enforcement

The reducer entry asserts on `currentIntent` for ALL writer actions per [shape-mastery.md](../contracts/shape-mastery.md) **I-SM-3**. This surface's Reference variant **structurally cannot** emit a writer that succeeds — even if a bug causes the body to dispatch `RECORD_DRILL_OUTCOME`, the reducer no-ops because `currentIntent === 'reference'`.

This is defense-in-depth:
1. **Surface design:** Reference variant has no UI affordances that dispatch writers. Body renders read-only content.
2. **Route discipline:** the `intent` route param maps to `studyHomeReducer.currentIntent`. Reference variant arrives with `currentIntent === 'reference'`.
3. **Reducer enforcement:** `shapeMasteryReducer` short-circuits all writers when `currentIntent === 'reference'`.

Tests for each layer:
- (1) DOM-assert no write-affordance elements in Reference variant.
- (2) Route test asserts `currentIntent === 'reference'` after navigating to Reference variant URL.
- (3) Reducer unit test: dispatch every writer action while `currentIntent === 'reference'`; assert state unchanged.

---

## Known behavior notes

- **Partial-completion partial-write.** Per red line #5, abandoning a drill mid-flow must not be punished. The compromise: if ≥50% of spots answered, write the partial result (real data, not penalized); else discard. The reducer treats the partial write identically to a full write at the math level — posterior gets `correct` and `total - correct` increments to α and β.
- **Per-spot answers buffer.** Reasons not to dispatch per-spot: (1) drill metric is a session-level signal (correct/total), not a sequence; (2) per-spot dispatches would multiply re-renders and the seeder/skill-map would see flickering posteriors mid-drill (poor UX + violates the "factual, not affective" copy invariant — a mid-drill "your posterior dropped to 5±4" is shame-coded).
- **Discover-mode pre-start affordances are time-bounded.** After spot 1's answer, `[Not this one]` + `[Mute]` collapse. Reason: post-engagement, the autonomy-affordance is `[End drill early]` (different shape; partial write semantics differ from skip).
- **Reference variant has no completion event.** It's read-only browsing; the user leaves via back. No "you finished reading" signal. Per red line #1's "Outside enrolled state, drill interactions are ephemeral" applied analogously: Reference reads are ephemeral too.
- **Seeder rationale rendering is one-line, factual, sourced.** Discover variant header shows exactly the same rationale string that `useShapeMasterySeederRanking()` returns — no embellishment. If the rationale is "lowest confidence (5/8 correct)", the header shows that verbatim; no "we recommend this" wrapper copy.

## Known issues

None — design-only at Gate 4. Implementation issues emerge at Stream B (drill content authoring) + Stream D (writer dispatch + reducer integration) code phases.

---

## Test coverage

- *Planned:* `src/components/views/LessonRunnerView/__tests__/LessonRunnerView.test.jsx` — shell routing + intent-variant dispatch.
- *Planned:* `__tests__/ReferenceVariant.test.jsx` — DOM assertion: no write affordances; no dispatch fires from any interaction.
- *Planned:* `__tests__/DeliberateVariant.test.jsx` — per-spot buffer + completion dispatch + incognito-gates-write.
- *Planned:* `__tests__/DiscoverVariant.test.jsx` — pre-start skip/mute + post-engagement collapse + seeder rationale rendering.
- *Planned:* `__tests__/redlines.test.jsx` — DOM assertions per the red-line table above.
- *Planned:* `src/reducers/__tests__/shapeMasteryReducer.test.js` — I-SM-3 short-circuit assertions (all 9 writers no-op when `currentIntent === 'reference'`).
- *Planned:* `scripts/check-sls-redlines.cjs` — CI-grep boolean table.
- *Planned:* Visual verification at 1600×720 of all three variants; portrait-native deferred to Stream B/D Gate 5 visual review.

---

## Cross-references

- [shape-mastery.md](../contracts/shape-mastery.md) — read/write API; `RECORD_DRILL_OUTCOME` + `RECORD_SKIP_DISAMBIGUATION` + `MUTE_DESCRIPTOR` all dispatched from here.
- [shape-language-study-home.md](./shape-language-study-home.md) — primary entry point (all three variants).
- [shape-skill-map.md](./shape-skill-map.md) — consumer of the posterior this surface updates.
- [study-home.md](./study-home.md) — grandparent surface; declares "three modes are routes, not toggles".
- [`docs/projects/poker-shape-language.project.md`](../../projects/poker-shape-language.project.md) — Stream B (drill content authoring) + Stream D (reducer/store) ship the code path.
- [`docs/projects/poker-shape-language/gate3-decision-memo.md`](../../projects/poker-shape-language/gate3-decision-memo.md) §Q3 (decay on read) + §Q5 (incognito as in-mode toggle) + §Q7 (Reference is the never-graded path).
- [`docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md`](../audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md) §"eight red lines" — original source of red lines #1-#8.
- [`docs/design/audits/2026-05-11-sls-g4-redline-conformance.md`](../audits/2026-05-11-sls-g4-redline-conformance.md) — aggregate test catalog.
- `lesson-card.md` — related SCF-mode surface (textual lesson + opt-in test affordance, lives inside SelfCoachView); deliberately separate from this SLS-mode active-drill surface.

---

## Change log

- 2026-05-11 — Created at SPR-074 (Shape Language Gate 4 close-out, WS-180). Shared-shell-with-intent-as-route-param IA ratified upfront (D2=A). Three variant bodies (Reference / Deliberate / Discover). Only surface in SLS that writes `RECORD_DRILL_OUTCOME`. I-SM-3 reducer-entry assertion documented as defense-in-depth alongside surface-design + route-discipline layers.
