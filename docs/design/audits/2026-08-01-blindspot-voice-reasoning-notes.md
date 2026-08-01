# Blind-Spot Roundtable — 2026-08-01 — Voice Reasoning Notes (VRN)

**Gate:** 2 (Blind-Spot) — triggered twice: Gate 1 verdict YELLOW + new-surface creation
**Gate 1 audit:** [`2026-08-01-entry-voice-reasoning-notes.md`](./2026-08-01-entry-voice-reasoning-notes.md)
**Status:** **YELLOW** — with one finding (E-1) that escalates to RED if unresolved

---

## Feature summary

A second push-to-talk lane in the live app that captures free-form spoken reasoning and binds it to
an exact game-state snapshot, so the founder's own claims become scoreable evidence. Three graders:
state fact-check (exact), engine-divergence log (reported, never adjudicated), claim→outcome scoring
(resolved against results with an accumulating `n`). Soundness critique is founder-excluded.

---

## Stage A — Persona sufficiency

**Output: ⚠️ Patch needed**

**A-1 — The live reasoning-aloud window is unmodeled.** Confirmed from Gate 1. The situation VRN
needs is: hand live, hero has already acted, attention temporarily free, state still moving.
`mid-hand-chris` is defined by a ~1.5s glance and <2-tap budget — it cannot hold a 10s spoken
sentence. `between-hands-chris` is defined by the hand being *over*. `first-principles-learner`
carries exactly the right cognitive goal but states "Time pressure: None. This is off-table study"
(line 26). No existing situational covers it. **Recommend authoring
`personas/situational/reasoning-aloud-chris.md` at Gate 3.**

**A-2 — The founder is both author and subject, and the existing cast has no lens for that.** Every
modeled persona wants the app to *help* them. VRN's user wants the app to *catch them being wrong* —
he is deliberately creating a record that can be used against his own prior reasoning. That motive
appears nowhere in the persona set, and it inverts a standing product constraint: `CO-54` ("see own
leak surfaced without being graded") and `DS-68` ("competence trend without a rank/score identity
label") exist to protect the user *from* evaluation. VRN is the user volunteering for it.

This is consistent with the standing rule that owner-volunteered grading is permitted where
system-imposed grading is refused — but the distinction is currently carried in memory and doctrine,
not in any persona or heuristic artifact. **Finding: the "volunteers to be scored" motive should be
written into the new situational persona explicitly**, so a future surface does not read CO-54 and
conclude VRN's whole grading loop is a violation.

**A-3 — No new core persona.** Chris (live player) covers the operator. Coach/Apprentice are out
(CO-49 is a coach annotating a student — different actor). Online personas are out.

---

## Stage B — JTBD coverage

**Output: ⚠️ Expansion needed**

**B-1 — One genuine gap, two probable folds.** `SR-NEW-VRN-01` (capture reasoning live, state-bound)
has no existing analog: `SR-26` is post-hoc and text-entered, `CO-49` has the wrong actor, `DS-57`
has no scoring or state attachment. It should be authored.

`SR-NEW-VRN-02` (checkable claims get checked) reads as a sub-outcome of 01 rather than its own
entry — the fact-check is *how* 01 delivers value, not a separately-wanted outcome.
**Recommend folding into 01.**

`SR-NEW-VRN-03` (accumulate claims into scored predictions) overlaps `DS-58`
(validate-confidence-matches-experience) heavily. The only difference is *whose* prediction is being
scored — the app's, or the player's. **Recommend extending DS-58's scope to player-authored
predictions rather than authoring a third entry**, with a note recording the extension.

**B-2 — Domain placement is genuinely ambiguous and the split matters.** Capture is `hand-entry`;
grading output is `session-review`; the accumulation loop is `drills-and-study`. Filing all three
under one domain will make one of the three consumers hard to find later. **Recommend: author
`SR-NEW-VRN-01` in `session-review` (the record and its review are the durable artifacts), and note
the hand-entry and drills-and-study cross-references from both directions.**

**B-3 — An outcome nobody listed: "don't make me talk twice."** If the founder narrates a read and
the app later asks him to re-enter the same information through another surface (a hand tag, a
player note, a review flag), the feature has added work rather than removed it. VRN output should be
readable by the surfaces that already ask for this content — player notes in particular. Not v1
scope, but if VRN's record is structurally unreadable by those surfaces it will be a permanent
duplication. **Design constraint for Gate 4: the note record must be queryable by player seat and by
hand, not only by hand.**

---

## Stage C — Situational stress test

**Output: ⚠️ Adjust** — this stage produced the most findings, as expected.

**C-1 — The snapshot goes stale mid-utterance. Load-bearing.** The plan takes the state snapshot at
utterance *start*. A 20s narration can span a villain's action, a street change, or a pot change. The
note would then be bound to a state that no longer existed when half the sentence was spoken. Three
options: (a) snapshot at start and record a `stateChangedDuringUtterance` flag plus the end-state,
(b) re-snapshot on every state change and store a small sequence, (c) hard-stop the recording when
state changes. **Recommend (a)** — cheapest, loses nothing, and the flag lets a grader refuse to
fact-check a note it knows straddled a state change. Refusing to grade an ambiguous note is correct
behavior; silently grading it against the wrong state is the failure mode.

**C-2 — Highest-value moments are lowest-availability moments.** The reasoning worth capturing is
densest exactly when the decision is hard — which is exactly when the founder has the least
attention to spare and the most reason not to be seen talking to his phone. VRN's realistic capture
window is therefore *after* the hard decision, not during it. This is not fatal but it reframes the
feature: **most captures will be near-immediate post-hoc rather than truly live**, and the design
should optimize for "narrate the decision I just made, while the board is still in front of me"
rather than "narrate while deciding." Gate 4 should reflect this in the primary flow.

**C-3 — Interruption mid-sentence.** Action arrives while narrating. VCE's answer (R6 strict no-op,
discard) is *wrong here* — a half-sentence of reasoning is still evidence. **Partial transcripts must
be retained and marked `interrupted: true`.** This is the polarity inversion noted in Gate 1
observation 3, and it is the single most important behavioral difference between the two lanes.

**C-4 — Phone sleep.** Web Speech requires an active page context and cannot survive sleep.
Long-form capture is more exposed to this than 2s card entry. Any in-flight transcript must be
flushed to the record on `visibilitychange`, not held in a ref until a clean stop. Losing 40s of
narration to a screen timeout would be the feature's worst everyday failure.

**C-5 — One-handed operation with two buttons.** VCE's PTT is viewport-anchored bottom-left or
top-right. Adding a second 56px button in the same thumb arc raises misgrab risk between two lanes
whose consequences differ sharply (one writes cards, one records audio). **The two buttons must not
be adjacent**, and the note button should carry a visually distinct treatment, not a mirrored twin.

**C-6 — Post-hand pass has a hard deadline nobody specified.** F2 wants a post-hand pass, but the
hand record is only reachable until the founder taps `Next Hand`. If the post-hand window closes on
that tap, the founder loses the note; if VRN keeps the prior hand addressable after it, that is new
state semantics. **Gate 4 must specify how long the just-finished hand stays writable.**

---

## Stage D — Cross-product / cross-surface

**Output: ⚠️ Partner surfaces need updates**

**D-1 — The `useSpeechCapture` extraction is the real ripple.** VCE is a live spike whose kill
criteria K-d (zero false-commits) and K-f (abort produces no state change) are hard-binary DROP
conditions. Refactoring the lifecycle underneath it can regress both. Mitigation is non-negotiable:
the four existing suites must pass unchanged, and R6 no-op behavior needs an explicit assertion
before the refactor lands.

**D-2 — Additive field on the hand record touches every hand consumer.** `reasoningNotes` follows
the `predictionAudit` precedent (additive, no migration), but every surface that reads, exports,
replays, or serializes a hand now carries an unknown field. Verify: session export/import, HandReplay,
Printable Refresher, and the Ignition sync path all tolerate it. Precedent says yes — `predictionAudit`
did exactly this — but it should be checked, not assumed.

**D-3 — The sidebar has no counterpart, and that asymmetry is backwards.** Online play has *no*
discretion cost — the founder is alone at a desk and can narrate freely — so reasoning capture is
strictly more feasible online than live. Yet the online path is out of scope. This is a defensible
v1 boundary (the live table is where the memory problem actually bites), but it should be recorded
as a deliberate choice rather than an oversight. **Not a blocker.**

**D-4 — No navigation dead-end.** Capture rides the existing overlay; review needs a home. If note
review lands inside an existing view (session detail or hand replay) there is no new route and no
return-path problem. **Recommend against a new routed view for v1.**

---

## Stage E — Heuristic pre-check

**Output: ❌ / ⚠️ — one potentially structural finding, several adjustments**

### E-1 — Web Speech is almost certainly NOT on-device, and R1's premise may be false. **HIGH.**

WS-181 **R1** states "Web Speech API only. No Whisper, no cloud transcription, no escalation path" —
framed as a privacy and infrastructure stance. But Chrome's implementation of
`webkitSpeechRecognition` performs recognition **server-side**: audio is streamed to a remote Google
service and the transcript is returned. If that is correct, R1 has been describing the *absence of a
second vendor*, not the absence of cloud transcription — and VCE has been sending audio off-device
since it shipped.

For 2s of card names this is a minor privacy question. For VRN it is materially different:

- Utterances are ~60s of continuous open-mic capture, not 2s bursts.
- Content is strategic reasoning about **identifiable third parties** at a live table ("the guy in
  seat 5 never folds"), captured within earshot of those people, whose voices may also be picked up.
- Recording third parties without consent has jurisdiction-dependent legal exposure; casinos
  additionally have their own recording policies.

**This is a blind spot the framework could not have surfaced on its own** — it sits between a
technical implementation detail and a legal/social constraint, and no heuristic covers it.

**Required before Gate 4:**
1. **Verify empirically** whether the target browser streams audio remotely (network capture during
   a recognition session). Do not settle this from documentation or from my assertion — measure it.
2. If confirmed, **surface it to the founder as an explicit decision**, and correct R1's wording so
   the record stops implying an on-device guarantee it does not provide.
3. Consider a shorter max-utterance and an explicit recording indicator regardless of the outcome.

**Escalation rule: if remote streaming is confirmed and the founder is not comfortable with it, this
finding is RED and the live-table capture path must be reconsidered** (post-hand-only capture in a
private moment, or on-device transcription, which R1 currently forbids). It does not block the
snapshot, persistence, or grader work, all of which are modality-independent.

### E-2 — H-PLT04 (socially discreet). **MEDIUM-HIGH.**

Speaking full strategic sentences aloud is materially less discreet than speaking three card names,
and the content is self-incriminating in a way card names are not. VCE's mitigation ("opt-in, flag
OFF by default, owner-chosen per situation") is weaker here because the cost lands on *what is said*,
not merely on *that something is said*. Only the founder can judge this from the felt (Gate 1 Q3).
**Recommend: ship flag-OFF, and let live-table experience decide, with C-2's finding (post-decision
narration) reducing exposure by moving most capture out of contested moments.**

### E-3 — H-N05 (error prevention) — card contamination. **HIGH, but fully mitigated by design.**

A note containing "queen of hearts" must never inject a card. The separate-button decision (F3)
plus a note lane that never dispatches to `cardReducer` closes this structurally rather than by
validation. **Requires a hard-binary regression test**: a note utterance containing card words leaves
`communityCards` and `allPlayerCards` byte-identical. Treat a failure as DROP, not as a bug to patch.

### E-4 — H-PLT06 (misclick absorption). **MEDIUM.**

An accidental press on the note button starts a hot mic for up to 60s. The card lane's 300ms hold
guard exists for a cheaper failure than this one. **Recommend the note button require a deliberate
activation (hold-to-start, or tap with a visible armed state), never a bare tap**, plus a clearly
visible recording indicator and a one-tap kill.

### E-5 — H-N03 (undo). **MEDIUM.**

Gate 1 Q4 unresolved: a note the founder later disagrees with is still evidence about what he thought
at the time. Silent edit destroys the evidentiary value that is the feature's entire point.
**Recommend append-only correction** — the original is retained, a correction is attached, and both
carry timestamps. Deletion should be available but explicit and total, not a silent overwrite.

### E-6 — H-PLT07 (state-aware primary action). **LOW.**

The note button should not render when there is no hand to attach a note to. Visibility predicate
needs specifying at Gate 4 alongside C-6's post-hand window.

### E-7 — H-ML06 (touch target ≥44). **LOW.**

56 DOM-px outside `ScaledContainer`, matching VCE's D-5 resolution. Placement needs its own
DOM-verified non-overlapping slot at 1600×720, proven the way
`tests/playwright/voice-card-entry-overlay.spec.js` proves the first button.

---

## Overall verdict

**YELLOW**, escalating to **RED on E-1 if remote audio streaming is confirmed and the founder is not
comfortable with it.**

Rationale: no structural persona or JTBD gap that Gate 3 cannot close cheaply (one situational
persona, one new JTBD, one scope extension). Stage C produced four real design constraints that Gate
4 must absorb. Stage E surfaced one finding that is genuinely outside the framework's field of view
and must be *measured* before Gate 4 closes.

---

## Required follow-ups

- [ ] **Gate 3 (Research) — narrow scope.** Two items only: author
      `personas/situational/reasoning-aloud-chris.md` (including the A-2 "volunteers to be scored"
      motive); author `SR-NEW-VRN-01` in `session-review` and extend `DS-58` to player-authored
      predictions.
- [ ] **E-1 empirical check** — network capture during a Web Speech session on the target browser.
      Blocking for Gate 4 close. Correct WS-181 R1's wording if the premise is false.
- [ ] **Founder decision on E-1** once measured, and on E-2 (discretion) from live experience.
- [ ] **Design adjustments for Gate 4:** C-1 stale-snapshot flag + end-state; C-3 retain partial
      transcripts (`interrupted: true`); C-4 flush on `visibilitychange`; C-5 non-adjacent,
      visually distinct buttons; C-6 post-hand writable window; E-4 deliberate activation + kill;
      E-5 append-only correction; B-3 note record queryable by seat as well as by hand.
- [ ] **`/decide` ADR** for scope expansion past WS-181 R2 and DEC-021.

**Not blocking:** snapshot builder, persistence layer, and all three graders are modality-independent
and unaffected by E-1's outcome.

---

---

## Amendment — founder requirement F4 (same session, post-roundtable)

> "the button ideally stays present in such a way I can kind of click through the hand and talk about
> it without interruption. so maybe it goes in hand review as well"

Continuous narration across navigation, and **HandReplay as a target surface**. This resolves or
reshapes five of this roundtable's findings and changes the verdict's practical shape.

**The model changes from utterance→snapshot to session→segment-timeline.** Recording stays open
while the founder navigates; each speech segment binds to whatever state was current when it was
spoken. Replay step-through and live villain actions are the same mechanism.

| Finding | Effect of F4 |
|---|---|
| **C-1** stale snapshot | **Superseded, better.** No "stale" flag needed — continuous binding is now the design. State changes during a session append a context marker to the timeline instead of invalidating the note. The failure mode C-1 identified is designed out rather than flagged. |
| **C-2** high-value moments are low-availability | **Resolved for replay.** Replay narration has no availability constraint at all. C-2 still governs the live lane and still argues for post-decision capture there. |
| **C-6** post-hand writable window | **Resolved for replay** — HandReplay addresses any past hand with no deadline, which is exactly the "no interruption" property F4 asks for. Still open for the live lane. |
| **E-1** remote audio streaming | **Decoupled, not resolved.** Materially lower stakes at home: no third parties near the microphone, no casino policy. The measurement is still required before the *live* lane ships; it no longer gates the replay lane. |
| **E-2** H-PLT04 discretion | **Does not apply to replay.** Live lane unchanged. |
| **D-4** no new routed view | **Confirmed and strengthened.** HandReplay already exists and is the natural home for both capture and review. |

**Stage D addition — HandReplay becomes a directly-touched surface**, not an indirect one. Its
surface artifact needs updating, and the note affordance must not disturb its existing step-through
controls.

**Stage A revision.** The persona gap is narrower than assessed above: `post-session-chris`,
`study-block`, and `first-principles-learner` cover replay narration without strain
(`first-principles-learner`'s exit criterion is articulating reasoning aloud, under exactly the
off-table conditions it assumes). The new situational persona is required **only for the live lane**.
Gate 3's persona work therefore does not block replay.

**Revised verdict: YELLOW for the replay lane with no blocking findings; YELLOW-with-RED-escalation
retained for the live lane.** Recommend splitting the work so the replay lane proceeds to Gate 4 and
Gate 5 immediately while E-1's measurement and Gate 3's persona work run in parallel against the
live lane.

---

## Change log

- 2026-08-01 — Roundtable run. Verdict YELLOW with RED escalation condition on E-1. Gate 3 required,
  narrowly scoped.
- 2026-08-01 — Amended for founder requirement F4 (continuous narration + HandReplay surface).
  Session/segment-timeline model supersedes C-1. Replay lane decoupled from E-1/E-2 and unblocked.
