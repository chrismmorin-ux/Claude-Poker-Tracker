# Surface — Shape Language Study Home (embed)

**ID:** `shape-language-study-home`
**Code paths:** (none yet — design-only at Gate 4)
- *Planned:* `src/components/views/StudyHomeView/embeds/ShapeLanguageEmbed.jsx`
- *Planned:* `src/utils/skillAssessment/` (shared module from gate3-decision-memo §architectural-proposal)
- *Planned:* `src/utils/skillAssessment/shapeLanguage/skillFacade.js` (user-skill consumer)

**Route / entry points:**
- Renders inside `study-home` surface's intent-mode body region (see [study-home.md](./study-home.md))
- Flat-index entry registered in study-home: "Shape Language → 10 descriptor lessons + skill map"

**Last reviewed:** 2026-05-11

---

## Purpose

The Shape Language project's embed into the cross-project [Study Home](./study-home.md). Renders the three intent-mode body regions specific to Shape Language (descriptor lookup in Reference, enrolled curriculum in Deliberate, adaptive seeder in Discover) and registers the flat-index entry point that surfaces all 10 descriptors as a permanent read-access list. The embed binds the Gate 3 decision-memo verdicts to concrete UI behavior; the parent home enforces the cross-cutting invariants (intent-mode router, red-line compliance, transparency-footer visibility).

This embed is one of four planned for Study Home; it is the first authored because Shape Language is the first project to reach Gate 4 after Study Home itself was authorized (Q1 verdict at SLS Gate 3).

## JTBD served

Primary:
- `DS-46` — Spaced repetition for descriptor recognition (**Proposed** → Deliberate mode renders the per-descriptor schedule; passive welcome-back on session open after decay threshold crosses)
- `DS-47` — Skill map / mastery grid (**Proposed** → per-descriptor mastery posterior visible in transparency screen)
- `JTBD-SE-01` — Adaptive seeder rec at session entry (Discover mode body)
- `ON-87` — Cold-start descriptor seeding (first-launch enrollment journey — see [shape-language-enrollment.md](../journeys/shape-language-enrollment.md))

Secondary:
- Per-descriptor lesson surfaces accessed via flat index (this embed routes; lessons render on their own surfaces — see [lesson-runner.md](./lesson-runner.md))

## Personas served

Primary:
- [scholar-drills-only](../personas/core/scholar-drills-only.md) — descriptor curriculum is canonical territory.
- [study-block](../personas/situational/study-block.md) — extended descriptor session.

Secondary:
- [Chris (live player)](../personas/core/chris-live-player.md) — opens between sessions to refresh a descriptor before play (Reference mode).
- [Apprentice](../personas/core/apprentice-student.md) — coach-assigned descriptor focus.

---

## Three-intent behavior

Per parent surface contract (`study-home.md` §three-intent taxonomy), this embed declares behavior for each intent mode:

### Reference mode (always available, no enrollment required)

**What renders:** Flat index of all 10 Shape Language descriptors as cards: Silhouette, Saddle, Spire, Basin, Ridgeline, Sankey, + 4 advanced (per `docs/projects/poker-shape-language/roundtable.md` catalog). Each card shows: descriptor name, one-line definition, example glyph. Click → opens the descriptor lesson surface in read-only mode.

**Skill-state writes:** **None.** Reference-mode lesson opens dispatch `SET_INTENT('reference')` before route change; the lesson surface asserts on intent and refuses to write to `shapeMastery` from this entry path.

**Empty state:** Always populated (10 descriptors are static catalog).

### Deliberate mode (enrolled users only)

**What renders:**
- **Today's schedule:** Per-descriptor "last validated N days/weeks ago" (Q3 verdict: gentle passive surfacing; computed on read from `shapeMastery.lastValidatedAt`). Cards ordered by `userMuteState !== 'already-known'` first, then by decay weight (oldest validation first).
- **Welcome-back banner** (one-time per session, after ≥28 days gap, dismissable): "It's been [N] weeks. Recalibrate any descriptors that feel rusty, or resume where you left off." Two CTAs: "Recalibrate" (opens one drill) and "Resume" (dismisses banner; lands on schedule). Per Q3 verdict.
- **Footer affordances:** Settings shortcut to per-descriptor mute / recalibrate; transparency screen link.

**Skill-state writes:** **Yes** by default; the user can toggle session-incognito via header tap (Q5 verdict). Incognito state persists per-session; transparency screen shows "last session was incognito (no model update)."

**Empty state:** If user enrolled with no Q7 self-declarations and no completed drills, shows "Pick a descriptor to start with — Silhouette is the recommended first" with link to lesson-runner.

### Discover mode (enrolled users only)

**What renders:**
- **Seeder rec:** Single descriptor card chosen by adaptive seeder (next-best per the Bayesian posterior; see [shape-mastery.md](../contracts/shape-mastery.md) for ranking math). Card shows: descriptor, why-this-rec rationale (one factual line: "lowest confidence" / "longest since validation" / "your declared starter"), and primary CTA "Start drill."
- **Skip-time disambiguation:** When user skips ("Not this one"), single follow-up asks "Already know this?" → if yes, sets `userMuteState='already-known'` + recompute next rec; if no, sets `userMuteState='not-today'` + recompute. Per Q2 verdict.
- **Mute affordance:** Per-card "Mute this" action (single tap) → sets `userMuteState='already-known'` and recomputes seeder. Revocable in transparency screen (per Q2 verdict).

**Skill-state writes:** **Yes** for drill outcomes; **mute writes** when user takes mute affordance; recompute-on-read decay is read-only.

**Empty state:** If all descriptors are muted, shows "You've muted every descriptor. Recalibrate any in Settings."

### Cross-mode notes

- **Intent persistence:** Mode persists across leaving and re-entering Study Home until explicit change. Settings carries default-intent preference (default: Reference).
- **No notifications.** Per red line #5; binding for this embed too. Welcome-back is in-app open-time only.
- **No streaks.** Per red line #5. No "X days in a row" badges anywhere in this embed.

---

## Anatomy

### Inside study-home flat-index region

```
+---------------------------------------------------+
| Shape Language     [enrolled] [2 muted]           |
| 10 descriptors: Silhouette, Saddle, Spire,        |
| Basin, Ridgeline, Sankey, + 4 advanced            |
+---------------------------------------------------+
```

### Inside study-home intent-mode body (Deliberate mode example)

```
+---------------------------------------------------+
| Shape Language — Deliberate                       |
|---------------------------------------------------|
| [Welcome back banner if applicable]               |
|                                                   |
| Today's schedule:                                 |
|   Silhouette — 8 days since validated [Drill]     |
|   Saddle — 14 days since validated [Drill]        |
|   Spire — 30 days since validated [Drill]         |
|   (...descriptors ordered by decay, muted hidden) |
|                                                   |
| [Settings: mute / recalibrate / transparency]     |
+---------------------------------------------------+
```

### Inside study-home intent-mode body (Discover mode)

```
+---------------------------------------------------+
| Shape Language — Discover                         |
|---------------------------------------------------|
| Suggested: Saddle                                 |
|   Why: lowest confidence (5/8 correct, 14 days)  |
|   [Start drill]   [Not this one]   [Mute]         |
|                                                   |
| [Settings: mute / recalibrate / transparency]     |
+---------------------------------------------------+
```

---

## State

- **Read from `shapeMastery` (via shared `skillAssessment/` module, see [shape-mastery.md](../contracts/shape-mastery.md)):** per-descriptor posterior, `lastValidatedAt`, `userMuteState`. Read at render; never written from rendering path (separation-of-signals invariant per Gate 3 Pattern 2 / I-AE-7 analog).
- **Mutations dispatched:** `SET_INTENT(mode)`, `START_DESCRIPTOR_DRILL(descriptorId)`, `MUTE_DESCRIPTOR(descriptorId, reason)`, `UNMUTE_DESCRIPTOR(descriptorId)`, `TOGGLE_SESSION_INCOGNITO(boolean)`.
- **Mutations NOT dispatched from this embed:** drill outcomes themselves write through the [lesson-runner](./lesson-runner.md) surface. Decay is **read-time only** (Q3 verdict) — no decay-write action exists.
- **Environment assumptions:** `studyHomeReducer` is mounted; `shapeMasteryReducer` is mounted; `skillAssessment` module is loaded.

## Props / context contract

- `currentIntent: 'reference' | 'deliberate' | 'discover'` — provided by `studyHomeReducer`.
- `shapeMastery: ShapeMasteryState` — read via `useShapeMastery()` hook (selector pattern from skillAssessment module).
- `sessionIncognito: boolean` — read from local session-scoped state; toggled in-mode.
- `dispatch: (action) => void` — for the 5 mutations listed above.

## Key interactions

- **Click descriptor in flat index (Reference mode):** route to lesson surface with `intent='reference'` — read-only render; no write actions emitted.
- **Click "Drill" (Deliberate mode):** route to lesson-runner with descriptorId + `intent='deliberate'`; drill outcomes write to `shapeMastery` unless session-incognito is on.
- **Click "Start drill" (Discover mode):** identical to Deliberate's drill entry; the difference is that the seeder is the source of the descriptorId.
- **Click "Not this one" (Discover mode):** opens skip-disambiguation; outcome flips `userMuteState` and recomputes seeder rec.
- **Click "Mute" (Discover mode):** immediate `MUTE_DESCRIPTOR(id, 'already-known')`; seeder recomputes; no further confirmation.
- **Toggle session-incognito (Deliberate mode header):** dispatches `TOGGLE_SESSION_INCOGNITO`; affects all subsequent drill writes in this session.

---

## Red-line compliance

This table is the embed's slot in the per-surface conformance matrix formalized at [`2026-05-11-sls-g4-redline-conformance.md`](../audits/2026-05-11-sls-g4-redline-conformance.md). Each row maps to a binding test target.

| Red line | This embed's compliance |
|---|---|
| **#1 — Opt-in enrollment** | Reference mode requires no enrollment. Deliberate/Discover gate on `shapeMasteryEnrolled === true`; the master toggle lives in [shape-language-enrollment.md](../journeys/shape-language-enrollment.md). |
| **#2 — Transparency screen** | Transparency-footer link is always visible when enrolled; per-descriptor mastery posterior + `lastValidatedAt` + `userMuteState` exposed there (not in this embed body). |
| **#3 — Durable overrides** | "Mute" affordance is single-tap from Discover; revocable in Settings. Per-descriptor reset is also in Settings. No nag prompts to re-enroll a muted descriptor. |
| **#4 — Incognito non-negotiable** | Reference mode is structurally incognito. Deliberate has explicit in-mode incognito toggle. Discover inherits same toggle. |
| **#5 — No streaks/shame/engagement-pressure** | No streak counters anywhere. Welcome-back copy is factual ("It's been N weeks"), one-time per session, dismissable. No "you missed" framing. |
| **#6 — Flat lesson index always accessible** | Flat index registered in study-home is unconditional; lists all 10 descriptors regardless of enrollment or mute state. |
| **#7 — No surprise notifications** | This embed emits zero notifications. Welcome-back is in-app, on user-initiated open only. |
| **#8 — Recalibrate is a single click** | Per-descriptor recalibrate from transparency screen is single click; resets posterior + clears mute. |
| **#9 — Mastery never displayed as a score** | No "your level: 7/10" rendering. Cards show `lastValidatedAt` and (optionally) confidence-band visual, not a single mastery score. Per Q4 verdict (separation of signals). |

The matrix lives in the test catalog at [`2026-05-11-sls-g4-redline-conformance.md`](../audits/2026-05-11-sls-g4-redline-conformance.md); each row gets DOM-asserted (forbidden-string CI grep + render-assertion) or runtime-toggled (assert on dispatch).

---

## Known behavior notes

- **Decay is read-time only** (Q3 verdict). The "8 days since validated" rendering is computed at render via `applyTemporalDecay()` from the shared skillAssessment module. No write happens during rendering.
- **Q4 separation of signals binds the schedule sort.** When user-declared and data disagree on a descriptor, the declared signal governs ordering, but data-derived `lastValidatedAt` is what surfaces in the "N days" label. Both signals visible in transparency screen.
- **Welcome-back banner is one-time-per-session.** Reducer sets a session-scoped `welcomeBackDismissed` flag on first dismissal; resets at next session.
- **Discover seeder ordering math:** per [shape-mastery.md](../contracts/shape-mastery.md) §ranking — lowest confidence + longest validation gap + non-muted + non-declared-already-known. Tie-breaker: descriptor catalog order.

## Known issues

None — design-only at Gate 4. Implementation surfaces bugs at Stream B/D code phases.

---

## Test coverage

- *Planned:* `src/components/views/StudyHomeView/embeds/__tests__/ShapeLanguageEmbed.test.jsx`
- *Planned:* Red-line conformance test matrix per the [SPR-074 catalog](../audits/2026-05-11-sls-g4-redline-conformance.md) (one assertion per row above); tests land at Stream B/D code phase.
- *Planned:* Visual verification of the three intent-mode bodies at 1600×720 once Phase 5 ships.

---

## Cross-references

- [study-home.md](./study-home.md) — parent cross-project surface.
- [shape-mastery.md](../contracts/shape-mastery.md) — read-API contract for the `shapeMastery` state this embed consumes.
- [shape-language-enrollment.md](../journeys/shape-language-enrollment.md) — enrollment journey (master toggle + Q7 self-declaration seed).
- [shape-skill-map.md](./shape-skill-map.md) — transparency-screen-side mastery grid that this embed links to. Authored at SPR-074.
- [lesson-runner.md](./lesson-runner.md) — drill / lesson surface where descriptor learning actually happens. Authored at SPR-074.
- `docs/projects/poker-shape-language/gate3-decision-memo.md` — Q1-Q7 verdicts that this embed implements.
- `docs/projects/poker-shape-language/roundtable.md` — descriptor catalog source.

---

## Change log

- 2026-05-11 — Created at SPR-073 (Shape Language Gate 4, WS-039). First registered embed into [study-home.md](./study-home.md). Binds Gate 3 Q1-Q7 verdicts to concrete intent-mode behavior. shape-skill-map.md + lesson-runner.md deferred to SPR-074.
- 2026-05-11 — Amended at SPR-074 (WS-180). Cross-references to shape-skill-map.md + lesson-runner.md updated from "Planned" to live links; conformance-matrix references point at the now-shipped audit doc.
