# Surface — Voice Reasoning Notes (VRN)

**ID:** `voice-reasoning-notes`
**Status:** Gate 4 authored 2026-08-01 — Phase 1 (replay lane) cleared for implementation. Live-table lane BLOCKED pending Gate 2 finding E-1.
**Gate 1 audit:** [`audits/2026-08-01-entry-voice-reasoning-notes.md`](../audits/2026-08-01-entry-voice-reasoning-notes.md) — YELLOW
**Gate 2 roundtable:** [`audits/2026-08-01-blindspot-voice-reasoning-notes.md`](../audits/2026-08-01-blindspot-voice-reasoning-notes.md) — YELLOW, RED-escalation on E-1
**Parent surface (Phase 1):** [`hand-replay-view`](./hand-replay-view.md) — new section in `ReviewPanel.jsx`
**Sibling surface:** [`hand-replay-observation-capture`](./hand-replay-observation-capture.md) — see §Relationship

---

## Purpose

Capture the founder's own spoken reasoning bound to the exact game state it was uttered about, so
his claims become scoreable evidence rather than recollection. Under `.claude/context/POKER_AXIOMS.md`
the founder's reasoning carries admissible `founder` provenance while assistant reasoning does not —
VRN is the highest-volume admissible intake channel the register can have.

**Non-goals (explicit):**
- **Not a verdict surface.** Nothing here tells the founder his reasoning was sound or fallacious.
  Graders are exact, comparative, or outcome-scored — never opinion. (F1)
- **Not a transcription feature.** The state binding is the product; the words alone are what the
  voice-memo lane already does.
- **Not a card or action input.** The lane never dispatches to `cardReducer` or `gameReducer`.
- **Not an axiom-register writer.** Registration stays a founder act.

---

## Founder ratifications (binding)

| ID | Statement |
|---|---|
| **F1** | Graders: state fact-check, engine-divergence log, claim→outcome scoring. Soundness/fallacy critique excluded. |
| **F2** | Capture live mid-hand and in a post-hand pass, on one surface. |
| **F3** | A second, distinct button — not a mode toggle, not a gesture overload. |
| **F4** | The affordance stays present and continuous: "click through the hand and talk about it without interruption." HandReplay is a target surface. |

---

## The core model — narration session with a segment timeline

A note is **not** an utterance bound to one snapshot. It is a session:

```
NarrationSession
  ├─ segment 1  "he's repping the flush but he'd have raised the turn with it"
  │              └─ context: { street: 'river', actionIndex: 11, board: [...], pot: 240, ... }
  ├─ [context marker — founder stepped back to the turn]
  ├─ segment 2  "actually on the turn his sizing is small for a draw"
  │              └─ context: { street: 'turn', actionIndex: 8, board: [...], pot: 96, ... }
  └─ ...
```

Recording stays open while the founder navigates. Each speech segment is stamped with whatever
state was current when it was spoken. **Replay step-through and live villain actions are the same
mechanism** — the context under the microphone moves, and the record follows it. This supersedes the
stale-snapshot problem (Gate 2 C-1) by designing it out.

Phase 1 sources context from `useReplayState` (`src/hooks/useReplayState.js:203`), which already
computes `currentActionIndex`, `currentStreet`, `communityCardsAtPoint`, `potAtPoint`,
`currentActionEntry`, `visibleActions`, and `seatStates` at the replay cursor. No new derivation is
needed for the replay lane.

---

## Relationship to `hand-replay-observation-capture` (AnchorObservation)

Both live in `ReviewPanel.jsx` and both capture founder input during review. They are **siblings, not
one feature** — VRN is a distinct record class:

| | AnchorObservation | VRN note |
|---|---|---|
| Shape | Point flag: ≥1 required tag + ≤280-char note | Session: unbounded segment timeline |
| Binding | Optional street/action anchor | Per-segment context, automatic |
| Downstream | Anchor-library calibration | Fact-check / divergence / claim ledger |
| Mutability | Immutable post-capture | Append-only correction (Gate 2 E-5) |

Forcing narration into a tagged 280-char note would destroy the property that makes it useful.

**Inherited constraints** — VRN adopts the sibling surface's tone rules even where its scoring loop
is a deliberate carve-out:
- **AP-09 (capture framing).** No "How did this hand go?", no "Rate this play". Ship copy is
  descriptive: "Talk through this hand."
- **AP-06 (graded-work trap).** The founder has opted into scoring (F1), which is the standing
  exception to system-imposed grading. But grader output is **display-separated** from capture: the
  capture control never shows accuracy, deltas, or scores. Same structural split the sibling uses
  between capture and the Calibration Dashboard.
- **Red line #5** — no streaks, no capture counts, no engagement pressure.
- **Red line #7** — editor's-note tone. No "Great read!" No praise, no scolding.

---

## Phase 1 — off-table lanes (this gate clears)

### Two mounts, one control

The founder narrates from two different screens, and both are cleared:

| Surface | Mount | Stepping granularity | `source` |
|---|---|---|---|
| `HandReplayView` / `ReviewPanel.jsx` | below the playback transport | action-by-action | `'replay'` |
| `AnalysisView` / `HandReviewPanel.jsx` | top of the Walkthrough column | street-by-street | `'review'` |

`VoiceNarrationSection` lives in `src/components/ui/` and is **surface-agnostic** — the caller
supplies a `buildContext` function, so the control never learns how a given surface represents its
cursor. Each mount sits beside that surface's own stepping controls, so the founder can hold to
start and then navigate while talking (F4).

**The two surfaces have different granularity, and the record says which.** HandReplayView steps
action-by-action, so the pot is exact at the cursor. The Hand Review walkthrough steps
street-by-street, so "the pot" is ambiguous unless the moment is named. Every snapshot from that
surface carries `potBasis`:

- `'street-start'` — blinds plus every action on prior streets (nothing focused)
- `'action'` — pot through the focused action, inclusive (an action was clicked)

This follows the standing rule that a number travels with its conditional. A grader reading `pot`
without reading `potBasis` is reading a different quantity than the one recorded.

Both mounts are persistent — they render whenever a hand is loaded, independent of whether notes
exist. Neither may disturb its surface's existing step-through controls (Gate 2 D-1 amendment), and
neither may sit adjacent to the Anchor Observation button in a way that invites misgrab (Gate 2 C-5
— the two controls have sharply different consequences). On `ReviewPanel` the Anchor button is at
the far bottom of the panel; on `HandReviewPanel` it is absent entirely.

### Control states

| State | Behavior |
|---|---|
| Idle | "🎙 Talk through this hand" — ≥44×44 DOM-px (H-ML06) |
| Armed→Recording | Deliberate activation only (Gate 2 E-4): press-and-hold to start, or tap with a confirming armed state. **Never a bare tap** — an accidental press opens a hot mic. |
| Recording | Persistent, visible indicator. Segment count ticks as speech is captured. One-tap kill, always reachable. |
| Stopped | Session written; note appears in the list below. |

Recording **survives navigation** — stepping streets, selecting villains, and toggling reveals do not
stop it. That is the F4 requirement, and it is what makes the segment timeline meaningful.

### Data written

Additive `reasoningNotes: []` on the hand record, written via `updateTx(STORE_NAME, handId, ...)` —
the same pattern as `src/utils/persistence/predictionAuditWriter.js:109`. Additive field, no IDB
migration, note lives on the hand (DEC-021 one-source-of-truth).

```js
{
  id,                    // stable local id
  createdAt,             // ms epoch
  source: 'replay',      // 'replay' | 'live'
  segments: [
    {
      text,              // transcript for this segment
      confidence,        // Web Speech confidence, retained even when low
      startedAt, endedAt,
      interrupted,       // true if the session was cut mid-segment (Gate 2 C-3)
      context: {         // state at the moment this segment was spoken
        street, actionIndex, board, pot,
        heroCards, seatsLive, actionsSoFar,
        stacks: null,    // NOT tracked in the live cash path — never inferred
      },
    },
  ],
  corrections: [],       // append-only (Gate 2 E-5); originals never overwritten
  graders: {},           // populated later; absent means "not yet run", not "passed"
}
```

**Retention polarity is the inverse of VCE's.** VCE gates hard and returns strict no-ops because its
failure mode is data corruption. VRN's failure mode is lost evidence. Therefore:
- **No confidence floor.** Low-confidence prose is retained.
- **Partial transcripts retained** and marked `interrupted: true`.
- **Flush on `visibilitychange`** so a screen timeout cannot eat a narration (Gate 2 C-4).
- Only a genuinely empty session (zero segments with text) is a no-op.

**Queryable by seat as well as by hand** (Gate 2 B-3) so player-note surfaces can consume VRN output
later instead of asking the founder to say the same thing twice.

### Grader display

Separate section from the capture control (AP-06 structural split). Phase 1 renders the note text and
its per-segment context only — `graders: {}` is empty and no grading UI ships until Phase 2.

---

## Phase 2+ — graders

| Tier | Module | Output |
|---|---|---|
| T1 fact-check | `utils/voiceReasoning/factCheck.js` | agree / disagree / **not-checkable** |
| T2 divergence | `utils/voiceReasoning/divergence.js` | disagreement recorded, both rationales, no verdict |
| T3 claim ledger | `utils/voiceReasoning/claimLedger.js` | claim resolved against outcome, accumulating `n` |

**Binding rule for T1:** a grader must skip what it cannot verify. Per-seat stacks are not tracked in
the live cash path, so SPR and stack-depth claims are `not-checkable` there. Checking a claim against
an inferred value is worse than not checking it.

**Binding rule for T3:** report claim accuracy with its `n` and its conditioning set. Never a skill
rank, never an identity label (DS-68, red line #5).

---

## Live-table lane — BLOCKED

Not cleared by this gate. Requires:
1. **Gate 2 E-1 measured** — whether the target browser streams audio to a remote service during
   recognition. Materially different stakes at a live table: ~60s open mic, strategic content about
   identifiable third parties, whose voices may also be captured. Measure it; do not settle it from
   documentation.
2. **Founder decision on E-1 and on E-2** (H-PLT04 discretion, answerable only from the felt).
3. **Gate 3 persona work** — `personas/situational/reasoning-aloud-chris.md`, including the
   "volunteers to be scored" motive (Gate 2 A-2).
4. **Gate 2 C-6** — how long the just-finished hand stays writable.
5. **`/decide` ADR** for scope expansion past WS-181 R2 and DEC-021.

None of these block Phase 1: replay narration happens at home, and the snapshot, persistence, and all
three graders are modality-independent.

---

## Test coverage plan

| Layer | Coverage |
|---|---|
| `useSpeechCapture` | Continuous mode, segment accumulation, silence/max stops, `visibilitychange` flush, permission + unsupported paths, abort semantics |
| Snapshot builder | Correct binding to the replay cursor; **untracked fields return `null`, never inferred** |
| Session assembly | Segment ordering, context markers on navigation, `interrupted` flag, empty-session no-op |
| Writer | Round-trip through fake-indexeddb; append-only corrections; per-seat query |
| **Contamination (hard binary)** | A narration containing card words leaves `communityCards` and `allPlayerCards` byte-identical. **Failure is DROP, not a patch.** |
| Placement (Playwright) | 1600×720, no overlap with step-through controls or the Anchor Observation button |

---

## Known issues

**[VRN-3] FIXED 2026-08-01 — the tail of every session was discarded, and an auto-end was
indistinguishable from a deliberate stop.** Reported from the first real capture: *"I think the
second, more in-depth one got cut off at some point."* Two independent causes.

1. **Teardown outran the engine's last result.** `SpeechRecognition.stop()` does not merely stop
   listening — it finalizes the audio already captured and delivers it through `onresult`,
   *asynchronously*. Session teardown detached `onresult` **before** calling `stop()`, so that final
   result landed on a null handler and was lost. With `interimResults` off there was no local copy
   either, so **everything said since the last pause was dropped from every session**. During a long
   uninterrupted stretch — which is what an in-depth breakdown is — the engine holds a lot before it
   settles, so the loss was not a trailing word but potentially the whole closing argument.
   Fix: on the paths where waiting is possible (deliberate stop, silence ceiling, length ceiling),
   leave `onresult` attached, call `stop()`, and close out on `onend` with a bounded 1.2s fallback.
   Delivery is guarded so the two paths cannot double-fire.
2. **In-flight speech had no local copy at all.** `interimResults` is now ON, with the pending
   partial held in a ref and committed on close. This is the only thing that can save the tail on
   paths that *cannot* wait — tab hidden, unmount, permission revoked, mic dropped — and it also
   covers Chrome auto-ending without finalizing before a restart. A flushed partial is stored with
   `confidence: null` (the engine never scored it) and `interrupted: true` (it may be clipped), so a
   grader never reads it as a settled sentence.

**Reporting defect, same report, same root complaint — "I *think* it got cut off."** Sessions ending
on the silence timer or the length ceiling were delivered as `interrupted: false`, i.e. recorded as
deliberate stops. A truncated note was byte-indistinguishable from a finished one and the founder had
no way to tell. Now every close carries an `endReason` (`stopped` | `silence` | `max-duration` |
`hidden` | `unmounted` | `restart-failed` | engine error code), persisted on the note and surfaced
twice: an immediate notice at the control, and a line on the expanded note. Both ceilings now
correctly report `interrupted: true`.

Length ceiling also raised 5min → 10min: a full preflop-through-showdown breakdown runs past five
minutes, and hitting the ceiling truncated a narration mid-thought. The 45s silence timer is what
ends a session in practice; the ceiling remains a runaway-mic backstop.

Regression tests pin both truncation paths, exactly-once delivery, interim/final de-duplication, and
the interrupted-vs-stopped distinction — with a mock whose `stop()` models Chrome's finalize-then-end
behaviour rather than only the "stops listening" half, which is what let this live untested.

**[VRN-2] FIXED 2026-08-01 — recording died on finger-lift, capturing only fragments.** Reported
from live use: *"sometimes it turns on and then off very quickly, even when I don't move my pressed
finger."* Two independent causes, both producing the same symptom:

1. **Button swap under the held finger.** Reaching the hold threshold started recording, which
   unmounted the Start button and mounted a separate Stop button *in the same position, under the
   still-pressed finger*. The pointerup ending the hold dispatched its click onto that new element
   and stopped the session immediately. Fix: **one button across both states** — same DOM node,
   state changes only its label — plus suppression of the click emitted by the starting hold's
   release.
2. **Restart path silently stranded the session.** Chrome ends continuous recognition on its own
   after a pause, several times inside one narration. The restart called `start()` again on the
   instance that had just ended (throws `InvalidStateError`), and the fallback swallowed its own
   failure and returned — leaving `isRecording` true with no live microphone. Fix: **always build a
   fresh instance**, treat a failed restart as retryable with backoff, and concede only after
   repeated failures (delivering the session marked `interrupted` so the words already spoken
   survive).

**Third defect, found during browser verification of the fix itself and corrected before ship:**
the first version suppressed the release-click with a one-shot boolean armed at start. That flag is
consumed by whatever click arrives next — so if the release-click missed the button, it stayed armed
and silently swallowed the founder's next genuine Stop tap. Replaced with a window anchored to the
actual `pointerup` that expires on its own, which cannot get stuck and works regardless of hold
duration. Regression tests pin all three failure modes.

Silence tolerance also raised 20s → 45s: narrating a hand means reading the screen between thoughts,
and a pause is thinking, not finishing.

**[VRN-1] Touch target renders at 27.1 visual-px on both mounts — pre-existing app-wide condition,
not introduced by VRN.** Measured 2026-08-01 via Playwright at the reference viewport. The button's
computed `min-height` **is** 44px and its `offsetHeight` **is** 44 — the style applies correctly.
The shortfall is entirely an ancestor `transform: scale(0.615125)`, which renders it at 27.07
visual-px, below the H-ML06 ≥44 floor. The existing `🏷 Tag pattern` button measures identically on
ReviewPanel, confirming this is the panel scaling rather than anything specific to this control.

VRN's control was deliberately left matching its neighbour rather than special-cased — making one
button in the panel bigger than the rest would trade a heuristic violation for an inconsistency,
and the right fix is panel-wide. VCE solved the equivalent problem by placing its PTT *outside*
`ScaledContainer` (D-5); the same treatment is the likely resolution here, but it affects the whole
ReviewPanel and belongs to that surface's owner, not to this feature.

**Verified working 2026-08-01:** Settings toggle renders and persists. The narration section mounts
on **both** surfaces when the flag is on and a hand is loaded — under the playback transport on
HandReplayView, and at the top of the Walkthrough column on the Hand Review screen (above the
street content, so it stays put as streets change). `Tag pattern` sits at the far bottom of
ReviewPanel, satisfying the Gate 2 C-5 non-adjacency requirement with a wide margin.

---

## Change log

- 2026-08-01 — Authored at Gate 4. Phase 1 (replay lane) cleared. Live lane blocked on Gate 2 E-1 +
  Gate 3 persona work. Session/segment-timeline model adopted per founder requirement F4.
- 2026-08-01 — Second mount added on the Hand Review walkthrough (`AnalysisView`) at founder
  request. `VoiceNarrationSection` moved to `src/components/ui/` and made surface-agnostic via a
  caller-supplied `buildContext`; `source` widened to `'replay' | 'review' | 'live'`. New
  `handReviewSnapshot.js` binds street-level context and introduces `potBasis` so a street-granular
  pot carries its own conditional.
