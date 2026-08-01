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

## Phase 1 — replay lane (this gate clears)

### Placement

New section in `ReviewPanel.jsx`, adjacent to but distinct from Section G (Anchor Observations).
Persistent — renders whenever a hand is loaded in replay, independent of whether notes exist.
**Must not disturb the existing step-through controls** (Gate 2 D-1 amendment), and must not sit
adjacent to the Anchor Observation button in a way that invites misgrab (Gate 2 C-5 — the two
buttons have sharply different consequences).

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

**[VRN-1] Touch target renders at 27.1 visual-px on HandReplayView — pre-existing surface
condition, not introduced by VRN.** Measured 2026-08-01 via Playwright at the reference viewport:
the VRN start button and the existing `🏷 Tag pattern` button both render **27.1px** tall despite
both declaring `min-h-[44px]`. ReviewPanel sits inside a scale transform of roughly 0.62, so every
control in the panel is below the H-ML06 ≥44 visual-px floor.

VRN's control was deliberately left matching its neighbour rather than special-cased — making one
button in the panel bigger than the rest would trade a heuristic violation for an inconsistency,
and the right fix is panel-wide. VCE solved the equivalent problem by placing its PTT *outside*
`ScaledContainer` (D-5); the same treatment is the likely resolution here, but it affects the whole
ReviewPanel and belongs to that surface's owner, not to this feature.

**Verified working 2026-08-01:** Settings toggle renders and persists; the narration section mounts
under the playback transport on HandReplayView when the flag is on and a hand is loaded;
`Tag pattern` sits at the far bottom of the panel, satisfying the Gate 2 C-5 non-adjacency
requirement with a wide margin.

---

## Change log

- 2026-08-01 — Authored at Gate 4. Phase 1 (replay lane) cleared. Live lane blocked on Gate 2 E-1 +
  Gate 3 persona work. Session/segment-timeline model adopted per founder requirement F4.
