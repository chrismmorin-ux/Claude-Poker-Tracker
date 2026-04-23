# JTBD Domain — Session Review

Jobs performed *after* a session (or between sessions) to review, filter, replay, and annotate what happened.

**Primary personas:** [Rounder](../../personas/core/rounder.md), [Coach](../../personas/core/coach.md), [Apprentice](../../personas/core/apprentice-student.md), [Hybrid](../../personas/core/hybrid-semi-pro.md), [Analyst](../../personas/core/analyst-api-user.md), [Post-session Chris](../../personas/situational/post-session-chris.md).

**Surfaces:** `HandReplayView`, `AnalysisView`, `StatsView`, `SessionsView`.

---

## SR-23 — Highlight worst-EV spots

> When reviewing, I want the worst-EV spots automatically highlighted, so I fix leaks without scanning every hand.

## SR-24 — Filter by street / position / opponent-style

> When reviewing, I want to filter hands by street, position, or opponent style, so I find patterns.

## SR-25 — Replay at own pace with range overlay

> When replaying, I want to step through hands at my own pace and see the range overlay at each decision, so I rebuild my thinking.

## SR-26 — Flag disagreement + add reasoning

> When I disagree with the app's analysis, I want to flag it and add my own reasoning, so the model learns (and I document my thinking).

- State: **Proposed**.

## SR-27 — Shareable replay link for coach

> When a coach reviews my hands, I want to share a replay link instead of screen-recording, so the handoff is clean.

- State: **Proposed** (DISC-07).

## SR-88 — Similar-spot search across history

> When analyzing a specific decision, I want to find all similar spots in my history (e.g., "turn check-raise on paired board, 40bb deep"), so my reads are informed by real data.

- State: **Proposed** (DISC-11).

---

## Played-Hand Review Protocol (HRP) — SR-28..34

Added 2026-04-23 per HRP Gate 2 Blind-Spot Roundtable. HRP closes the depth gap between the theoretical programs (Upper-Surface reasoning artifacts, LSW line-study) and the replay surface by making `HandReplayView` a **consumer** of the theoretical library. See `../../audits/2026-04-23-entry-played-hand-review-protocol.md` (Gate 1) and `../../audits/2026-04-23-blindspot-played-hand-review-protocol.md` (Gate 2).

### SR-28 — Deep-review a flagged hand against upper-surface theoretical ground-truth

> When reviewing a flagged hand, I want to see what theory says about each decision point — claim-falsifier ledger, counterfactual EV tree, and drill-card distillation from the linked upper-surface / LSW analog — so I can articulate *why* each action was good or bad, not just that it was.

- State: **Active** (pending HRP Gate 4 + SPOT-KEY spike).
- Primary personas: Post-Session Chris, Apprentice, Coach-review-session.
- Surfaces: `HandReplayView/ReviewPanel`, new hand-review modal.
- Success criterion: hero can articulate the theoretical reasoning after closing the modal; coach can point at specific claims during a shared-screen review.
- Failure modes: modal too dense (mitigated by progressive disclosure), jargon wall (mitigated by inline glossary), false precision when match confidence is low (mitigated by SR-29 confidence indicator).

### SR-29 — Know whether a theoretical analog exists for the spot being reviewed, and see what to do when it does not

> When I open a decision point in review, I want to know whether the theoretical library covers this spot — and if it does, how closely it matches — so I can trust what I'm reading or know to treat it as approximate.

- State: **Active** (gated on HRP-SPOT-KEY engine spike).
- Distinct failure mode from SR-28: the *empty state*. Majority of real-world played spots will have no exact theoretical analog. UX must surface this honestly.
- Match confidence levels: Strong (all ~8 dimensions agree), Partial (differs on one dimension, with reason), None (no analog).
- Empty-state CTA: "No theoretical analog exists for this spot" — v1 offers "copy spot-key to clipboard"; v2+ loops into SR-32 (nominate).
- Depends on: canonical spot-key extractor + upper-surface + LSW corpus index.

### SR-30 — See the counterfactual EV tree for a past decision, with runout-class breakdown

> When reviewing a decision, I want to see what would have happened if I'd taken the alternative action — the depth-2/3 EV tree with per-runout-class breakdown — so I understand not just what was best but why the alternative was worse.

- State: **Active** (consumes existing `gameTreeEvaluator.js` output).
- Pedagogical rationale: retrieval practice research (Roediger/Karpicke) shows that contrasting the chosen action against its alternatives is where transfer to future play happens. Not optional.
- Scope: top-3 alternative actions shown by default; full tree on expand.
- Already-computed: depth-2/3 output exists in the engine and is currently discarded at the UI boundary. HRP surfaces, does not recompute.

### SR-31 — Flag a played hand for deep review and find it again in the queue

> When I want to come back to a hand later, I want to flag it and find it again without scanning every hand in the session — and without losing the flag when I re-sort or filter.

- State: **Active**.
- Producer side: HE-17 (flag hand for post-session review mid-recording) — existing.
- Consumer side (new with HRP): HandBrowser flag filter, flag indicator on hand card, "last reviewed" column.
- Flag types (Stage B roundtable): `'review'` (default — "I want to think about this"), `'disagree'` (overlaps SR-26), `'coach'` (share with coach — overlaps SR-27).
- Undo required (matches DCOMP wave-1 destructive-action undo pattern).

### SR-32 — Nominate a played hand for inclusion in the theoretical corpus

> When I find a played spot with no theoretical analog — or an analog that contradicts solver output — I want to nominate it for authoring in the theoretical library, so my learning compounds into the library instead of being lost.

- State: **Proposed** (HRP v1 deferred; architected-for via SR-29 spot-key surfacing).
- Rationale: closes the loop between HRP (consumer) and LSW / Upper-Surface authoring (producer). Without it, HRP is one-way and hero's discoveries are discarded.
- v1 placeholder: "copy spot-key + known variables to clipboard" with LSW queue paste instructions.
- v2+: in-app submission queue; authoring-queue triage by LSW/Upper-Surface program.

### SR-33 — Dispute a cited claim against a played hand's evidence

> When a ledger row says "villain folds 60%" and my evidence in this specific hand contradicts it, I want to flag the specific claim, so upper-surface / LSW calibration incorporates real-world signal.

- State: **Proposed** (HRP v1 deferred).
- Granularity: claim-level (~60 rows per artifact), not decision-level (where SR-26 sits).
- Overlaps: SR-26 (flag disagreement + reasoning) is the decision-level cousin.
- Requires confirm dialog (H-N05 error prevention) — hero must see the claim detail before filing dispute.

### SR-34 — Re-review a previously reviewed hand on a spaced-retrieval schedule

> When I reviewed a hand last week, I want the app to remind me to re-review it — and hide my prior notes by default so I can re-test myself on the spot — because deliberate-practice research says spaced retrieval is where skill sticks.

- State: **Proposed** (HRP v1 architected-for via `hand.reviewState` schema field).
- Distinct surfacing signal from SR-23 (worst-EV) — "last reviewed N days ago, due" is a retention-based signal, not a learning-gap signal.
- UX constraint: prior notes hidden by default on re-review, reveal-on-tap (deliberate-practice doctrine).
- Requires: review-timestamp per hand, configurable spaced-repetition interval.

---

## Domain-wide constraints

- Review surfaces should show what the app knew *at decision time* vs. what's knowable in hindsight.
- Shareable links require auth + permissions (currently not present).
- HRP additions (SR-28..34): match-confidence must be honestly communicated; linked-artifact audit state must propagate; jargon requires inline glossary; density requires progressive disclosure.

## Change log

- 2026-04-21 — Created Session 1b.
- 2026-04-23 — Added SR-28..34 as Gate 3 output of Played-Hand Review Protocol (HRP) project. 4 Active (SR-28, SR-29, SR-30, SR-31) + 3 Proposed (SR-32, SR-33, SR-34). See `../../audits/2026-04-23-blindspot-played-hand-review-protocol.md`.
