# Gate 1 Entry — 2026-08-01 — Voice Reasoning Notes (VRN)

**Feature working name:** Voice Reasoning Notes (VRN) — free-form spoken reasoning capture with an exact game-state snapshot attached
**Audit ID:** `entry-vrn-2026-08-01`
**Proposed by:** Founder, 2026-08-01 ("expand the poker voice recorder to accept my generalized notes, not just look for the syntax match on cards")
**Backlog ticket:** [pending — to be filed]
**Gate:** 1 (Entry) — mandatory
**Next gate:** **Gate 2 (Blind-Spot Roundtable, REQUIRED)** — new surface + YELLOW verdict, both independently triggering.
**Status:** **YELLOW**

---

## Feature summary (as proposed)

The existing Voice Card Entry lane accepts only card syntax. `parseTranscript` returns `null`
unless it parses ≥1 card (`src/utils/voiceCardEntry/parser.js:224`), and the raw transcript never
escapes the hook — `lastTranscriptRef` (`src/hooks/useVoiceCardEntry.js:102`) is function-local and
dies with the recognition session. Any non-card speech becomes an `Unknown token` warning and is
discarded.

The founder wants to narrate his reasoning while a hand is live. The stated purpose is not
transcription — it is a feedback loop: *"reading through a hand in realtime, while you can see the
state exactly, can enable us to get a pretty close feedback loop on what's sound poker and what's
fallacy."*

The distinguishing property versus the existing voice-memo sync lane (`chronicle/voice/`) is
**state attachment**. The memo lane captures words. VRN captures words bound to the exact state
they were uttered about — street, board, hero cards, pot, seats live, action sequence so far. A
claim with its conditioning set attached is evidence; a claim without it is a diary entry. The
founder also cannot run both lanes concurrently (one microphone), which independently forces the
capture in-app.

**Founder decisions taken at intake (binding):**

| ID | Statement |
|---|---|
| **F1** | Graders are: state fact-check, engine-divergence log, claim→outcome scoring. **Soundness/fallacy critique as a verdict is excluded** — it is `assistant-asserted` under `.claude/context/POKER_AXIOMS.md` and may nominate, never register. |
| **F2** | Capture happens both live mid-hand and in a post-hand pass, on one surface. |
| **F3** | Trigger is a second, distinct button. Not a mode toggle on the existing PTT, not a gesture overload. |
| **F4** | *(added mid-session 2026-08-01)* The capture affordance stays present and continuous — "the button ideally stays present in such a way I can kind of click through the hand and talk about it without interruption. so maybe it goes in hand review as well." **HandReplay is a target surface.** |

**What F4 changes — the central design consequence.** A note is not a single utterance bound to a
single snapshot. It is a **narration session with a segment timeline**: recording stays open while
the founder navigates, and each speech segment is bound to whatever state was current when it was
spoken. Stepping through streets in HandReplay and villains acting during a live hand are the same
mechanism — the context under the microphone changes, and the record follows it.

This is strictly better than the single-snapshot model it replaces. It also reorders the phasing:
**HandReplay narration is the safer and richer lane and should ship first** (see §Observation 5).

**Relationship to the axiom register (2026-08-01).** `POKER_AXIOMS.md` admits `founder` provenance
and refuses `assistant-asserted`. Live spoken reasoning is founder-provenance claim intake produced
as a byproduct of playing — the highest-volume admissible channel the register has. This is the
strategic reason the feature is worth more than its UX cost.

---

## Output 1 — Scope classification

**Primary classification:** **Surface addition.** VRN adds a new affordance (second PTT), new
persisted data (`reasoningNotes` on the hand record), and a new review surface (note list with
grader output). It is not a surface-bound fix and not a system-coherence audit.

**Secondary classifications:**

- **Cross-domain feature.** Capture is a hand-entry-domain act; grading is a session-review and
  drills-and-study act. The feature spans three JTBD domains, which is itself a YELLOW signal —
  see §Output 3.
- **New data class, not just a new input.** Unlike VCE — which produces the same card objects the
  tap picker produces and is therefore input-layer-only with zero downstream ripple — VRN creates a
  *new kind of record* that later analysis reads. Its downstream surface area is larger than VCE's
  by construction.
- **Scope expansion past two ratifications.** WS-181 **R2** locks the voice lane to board + villain
  showdown cards. **DEC-021** re-ratified R2 out to action sequences and the hand tree. VRN is
  neither cards nor actions. A `/decide` ADR is required before Gate 5.

**NOT a card-entry change.** The note lane is read-only against `cardReducer` and `gameReducer`.
The load-bearing safety property is that a note containing "queen of hearts" cannot inject a card.
**NOT an action-entry change.** DEC-021's hand-tree work is separate and unaffected.
**NOT engine code.** Zero writes into `exploitEngine/`, `rangeEngine/`, `pokerCore/`. The
divergence grader *reads* engine output; it never feeds back into it.
**NOT an axiom-register writer.** Nothing in VRN may write into `POKER_AXIOMS.md`. Registration
stays a founder act (provenance rule, 2026-08-01).

---

## Output 2 — Personas identified

### In scope

| Persona | Role | Source |
|---|---|---|
| [Chris (live player)](../personas/core/chris-live-player.md) | Sole verified user; the only speaker | Core |
| [Between-Hands Chris](../personas/situational/between-hands-chris.md) | **Primary** for the post-hand pass (F2) — the 20–30s gap before the next deal | Situational |
| [Mid-Hand Chris](../personas/situational/mid-hand-chris.md) | **Primary** for live capture (F2). Tightest constraint in the feature — see stress note below | Situational |
| [Post-Session Chris](../personas/situational/post-session-chris.md) | Secondary — reads grader output after the session | Situational |
| [First-Principles Learner](../personas/situational/first-principles-learner.md) | Secondary, as a *cognitive-goal lens* — see gap below | Situational |

### Out of scope (explicit)

| Persona | Why excluded |
|---|---|
| Coach / Apprentice / Scholar | VRN is first-person self-capture. CO-49 (coach annotates student streets with voice) is a different actor and a different surface. |
| Multi-Tabler, Online MTT Shark | Online capture is automatic; narrating aloud while multi-tabling is not a coherent situation. |
| Newcomer-First-Hand | Flag OFF by default; a novice should not encounter it. |
| Ringmaster (home host) | Not excluded on principle, but hosting duties compete for exactly the attention VRN needs. Not a target. |

### Persona sufficiency check (Stage A pre-roundtable)

**The cast covers the operator, but not the situation.** Two specific gaps:

1. **`first-principles-learner` explicitly assumes no time pressure** — "Time pressure: None. This
   is off-table study, ~20-60 min per session" (line 26). VRN asks for exactly that persona's
   *cognitive* goal (articulating reasoning aloud, comparing it to ground truth) under exactly the
   conditions the persona excludes (live, timed, at the table). The persona's own exit criterion is
   *"the learner can articulate the range-first reasoning aloud"* — VRN instruments that
   articulation. This is a real situational gap, not a labeling quibble.

2. **`mid-hand-chris` is defined by a ~1.5s glance budget and a <2-tap action budget.** Speaking a
   sentence of reasoning is a 5–15s act. VRN live-capture either violates the persona's constraints
   or requires a sub-situation where hero has already acted and is waiting on others — attention is
   free, but the hand is still live and the state is still moving. VCE's Gate 1 flagged a similar
   "board-reveal moment" ambiguity and resolved it as a clarifying note on `between-hands-chris`;
   that resolution does **not** transfer here, because VRN's live case is specifically *during*
   others' action, not between hands.

**Initial reading:** one new situational persona is likely warranted — provisionally
*"reasoning-aloud Chris"* / *"narrating-the-hand Chris"* — capturing a live, low-decision-pressure,
high-cognitive-availability window. Stage A ratifies or rejects. **This is the strongest YELLOW
signal in the audit.**

**Amended after F4.** The gap above applies to the **live-table lane only**. F4 adds HandReplay
narration, and that lane is *well covered by the existing cast*: `post-session-chris` and
`study-block` supply the time-and-attention shape, and `first-principles-learner` fits without
strain — its stated exit criterion is *"the learner can articulate the range-first reasoning aloud"*
(line 21), which is literally what replay narration instruments, under exactly the unpressured
off-table conditions the persona assumes. The persona gap is therefore **narrower than first
assessed**: it is a live-table gap, not a feature-wide one, and it does not block the replay lane.

---

## Output 3 — JTBD identified

### Existing JTBDs the feature touches

The atlas covers substantially more of this than expected. Adjacent entries, and why each is not
sufficient:

| JTBD | Domain | Relationship |
|---|---|---|
| **`SR-26`** Flag disagreement + add reasoning | session-review | **Closest existing entry.** But SR-26 is *post-hoc review* of a recorded hand, text-entered, initiated from a replay. VRN is *live*, spoken, and the state is captured rather than reconstructed. VRN's T2 divergence grader is effectively SR-26 automated and moved earlier. |
| **`CO-57`** Self-rate confidence on a line before seeing the verdict | coaching | Same shape as VRN's T3 claim ledger — a commitment recorded before the answer is known. But CO-57 is a *drill* affordance with a coach-domain actor and a scalar rating, not free-form live speech. |
| **`DS-58`** Validate-confidence-matches-experience (observed-vs-predicted) | drills-and-study | The scoring loop VRN's T3 produces. DS-58 assumes the predictions come from the app's own confidence display, not from the player's mouth. |
| **`DS-57`** Capture-the-insight (flag a pattern without losing focus) | drills-and-study | Captures the *urgency* need — record without breaking focus — but is study-context and does not imply state attachment or scoring. |
| **`CO-49`** Annotate streets with voice/text | coaching | Voice annotation exists in the atlas, but with a **coach** annotating a **student's** hand. Different actor, different surface, no scoring loop. |
| **`SR-33`** Dispute a cited claim against a played hand's evidence | session-review | The inverse direction — player disputes the app. VRN records the player's claim so it can be disputed *by evidence*. Complementary. |
| **`HE-16`** Voice input for action calls | hand-entry | State: Proposed. Shares the modality only. VRN must not silently absorb HE-16's scope. |
| **`CO-54`** See own leak surfaced without being graded | coaching | **Constraint, not a served outcome.** CO-54 plus the founder's standing refusal of system-imposed grading is precisely why F1 excludes soundness critique. VRN must surface evidence, never a verdict on the player. |
| **`DS-68`** Competence trend, evidence-based, without a rank/score identity label | drills-and-study | Same constraint. T3's rollup must report claim accuracy with `n`, never a skill rank. |

### Proposed new JTBD (candidates for Gate 2 ratification)

The gap the atlas genuinely has: **no entry covers capturing the player's own reasoning, live, as
scoreable evidence.** SR-26 is post-hoc, CO-49 has the wrong actor, DS-57 has no scoring.

| Candidate | Statement |
|---|---|
| **`SR-NEW-VRN-01`** Capture my reasoning while the hand is live | "When I'm forming a read or committing to a line, I want to say why out loud and have it recorded against the exact state I'm looking at — so my reasoning is preserved as evidence rather than as a memory I'll reconstruct wrongly later." |
| **`SR-NEW-VRN-02`** Have my checkable claims checked | "When I assert something the app can verify exactly — outs, pot odds, players left — I want to be told when I'm wrong, without being told what to think about the parts it can't verify." |
| **`SR-NEW-VRN-03`** Accumulate my own claims into scored predictions | "When I repeat a read across many hands ('this player never folds here'), I want it resolved against outcomes and accumulated with a sample size — so my own doctrine earns or loses standing on evidence." |

**Initial reading:** SR-NEW-VRN-01 is clearly distinct and warranted. SR-NEW-VRN-02 may be a
sub-outcome of SR-NEW-VRN-01 rather than its own entry. SR-NEW-VRN-03 is close enough to DS-58 that
Gate 2 Stage B should test whether it is a new entry or an extension of DS-58's scope to
player-authored predictions. Domain placement is itself an open question — these span session-review
and drills-and-study.

### Not served (explicit non-goals)

- **HE-15** post-session hand entry from memory — VRN attaches to hands the app already recorded.
- **HE-16** voice for actions — unchanged, still Proposed.
- **SR-32** nominate a hand for the theoretical corpus — adjacent, could consume VRN output later.

---

## Output 4 — Gap analysis

| Dimension | Status | Detail |
|---|---|---|
| **Personas** | 🔴 Situational gap | `first-principles-learner` explicitly excludes time pressure; `mid-hand-chris`'s 1.5s budget cannot hold a spoken sentence. Live reasoning-aloud is an unmodeled situation. Likely needs a new situational persona. |
| **JTBD** | ⚠️ 1–3 new entries | SR-NEW-VRN-01 warranted; 02 and 03 may fold into 01 and DS-58. Domain placement unresolved (session-review vs drills-and-study). |
| **Surfaces** | ⚠️ New surface required | Capture affordance can ride the existing overlay, but note review + grader output has no home today. New surface artifact required. |
| **Heuristics** | ⚠️ H-PLT04 tension, worse than VCE's | Speaking full sentences of strategy aloud at a live table is materially less discreet than speaking three card names, and the content is self-incriminating in a way card names are not (announcing reads about specific opponents, within earshot). VCE's "opt-in flag lowers this to owner-chosen" mitigation is weaker here. Stage E must take this seriously. |
| **Tech path** | ⚠️ Web Speech free-form accuracy | Closed card grammar snaps mishearings to valid cards; free-form prose has no such error correction. Mitigating asymmetry: a garbled note remains readable, a garbled card corrupts the hand. Acceptable, but accuracy expectations must be set at Gate 4. |
| **Data model** | ⚠️ New persisted class | First app-created record whose value is *evidentiary* rather than functional. Retention, correction, and deletion semantics need specification — a note the founder later disagrees with is still evidence about what he thought at the time. |
| **Governance** | ⚠️ Two ratifications exceeded | WS-181 R2 and DEC-021 both scope the voice lane to cards/actions. `/decide` ADR required before Gate 5. |

### Overall verdict: **YELLOW**

**Rationale:** No dimension is fully unmodeled (which would be RED) — the personas exist as a cast,
the JTBD atlas has close neighbours, and the surfaces are extendable. But the situational-persona
gap is real rather than cosmetic, three JTBD candidates are in play across two domains, the
discretion heuristic tension is worse than VCE's, and two prior ratifications are exceeded. That is
comfortably past the YELLOW threshold.

**Gate 2 is doubly triggered:** new-surface creation triggers it independently of the verdict.

---

## Required follow-ups (Gate 2 inputs)

1. **Gate 2 Blind-Spot Roundtable** — REQUIRED. Five stages per ROUNDTABLES.md. Priority stages:
   - **Stage A:** ratify or reject a new situational persona for live reasoning-aloud. Highest-value
     question in the roundtable.
   - **Stage B:** ratify SR-NEW-VRN-01; decide 02/03 fate and domain placement.
   - **Stage C:** stress Mid-Hand Chris against a 5–15s spoken utterance while others act. Does the
     abort path hold when action arrives mid-sentence?
   - **Stage D:** verify zero ripple to the card lane after the `useSpeechCapture` extraction; verify
     no sidebar/online impact.
   - **Stage E:** H-PLT04 discretion under sentence-length speech about identifiable opponents;
     H-N05 error prevention on the card-contamination path.
2. **File the work item** — no ticket exists yet.
3. **`/decide` ADR** for the scope expansion past WS-181 R2 and DEC-021.
4. **Gate 4 surface artifact** at `docs/design/surfaces/voice-reasoning-notes.md`.
5. **Decide note-retention semantics** — can a note be edited or deleted, and if so does the
   original survive? Evidentiary records and user-owned content pull in opposite directions here.

---

## Observations without fixes (carried forward)

1. **Phase 1 has standalone value and should ship alone.** Capture + snapshot + persist starts
   accruing corpus immediately; all three graders are analysis over stored data and can be run
   retroactively over everything Phase 1 captured. Building a grader first would have nothing to
   grade. This ordering is a finding, not a preference.
2. **The graders can only check what the app tracks.** Pot is derived from `actionSequence`
   (`src/contexts/GameContext.jsx:34`); per-seat stacks are not tracked in the live cash path (only
   the tournament and extension paths carry them). So "I'm getting 3-to-1" is checkable and "he's
   got 40 big blinds" is not, in cash. The snapshot must record `null` for untracked fields and the
   fact-checker must skip what it cannot verify. A grader that checks a claim against a guessed
   value is worse than no grader.
3. **VRN inverts VCE's error economics.** VCE's failure mode is data corruption (wrong card written
   to a hand), which is why R6 gates hard on confidence and returns strict no-ops. VRN's failure mode
   is lost evidence — a discarded transcript. The correct gate polarity is therefore *opposite*:
   retain aggressively, including low-confidence prose. Do not inherit VCE's confidence floor.
4. **This is the first feature whose primary consumer is the axiom register rather than the player.**
   Worth stating plainly at Gate 2 so the discretion cost is weighed against the right benefit.
5. **F4 reorders the phasing: HandReplay narration should ship before live-table capture.** The
   replay lane is strictly safer and strictly richer:
   - **Safer** — no live-table discretion cost (H-PLT04), no third-party audio near the microphone,
     no time pressure, no interruption path. Gate 2's E-1 and E-2 findings, which are the two that
     could block the feature, apply to the live lane and *not* to replay at home.
   - **Richer** — the founder can walk a whole hand node by node and narrate each decision against
     the state the app is already displaying. That produces denser, better-conditioned claims than
     snatched live utterances, which C-2 predicts will be sparse and post-hoc anyway.
   - **Same machinery** — segment timeline, snapshot binding, persistence, and all three graders are
     shared. The live lane becomes a second mount point plus the constraints Gate 2 Stage C names,
     not a separate feature.

   The original plan put live capture in Phase 1 because it was the founder's framing. F4 makes
   replay the better first target, and it lets the corpus start accumulating without waiting on the
   E-1 privacy measurement.

---

## Open questions (Gate 2 inputs)

1. **Q1:** Does live reasoning-aloud warrant a new situational persona, or can `between-hands-chris`
   stretch to cover it with a clarifying note? *Initial reading: new persona. The window VRN needs —
   hand live, hero already acted, attention free — is neither between-hands nor mid-hand-decision.*
2. **Q2:** Is SR-NEW-VRN-03 distinct from DS-58, or an extension of it to player-authored
   predictions? *Initial reading: extension. Stage B verifies.*
3. **Q3:** Does speaking strategy aloud about identifiable opponents at a live table cross H-PLT04
   from "tension" into "violation"? *Stage E. This may be the question that constrains the feature
   most, and the founder is the only person who can answer it from the felt.*
4. **Q4:** What happens to a note when the founder later disagrees with it? Editable, immutable, or
   append-only correction? *Bears directly on evidentiary value.*
5. **Q5:** Should live capture be silently retained and surfaced only post-hand, or is immediate
   fact-check feedback wanted at the table? *Plan currently assumes T1 immediate, T2/T3 deferred.*

---

## Prioritized fix list

Gate 1 audits produce framework-level follow-ups, not graded UX findings. See §Required follow-ups.

---

## Review sign-off

- **Drafted by:** Claude (main, session 2026-08-01)
- **Reviewed by:** [pending — founder]
- **Closed:** [pending]

Audit is immutable after close. Follow-up audits create new files.

---

## Change log

- 2026-08-01 — Draft. Verdict YELLOW. Gate 2 required (new surface + verdict, both triggering).
