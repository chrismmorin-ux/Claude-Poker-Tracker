# Persona — Chris, Live Player

**Type:** Core
**Evidence status:** Proto — partially verified
**Last reviewed:** 2026-04-21
**Owner review:** Pending

---

## Snapshot

Chris owns and directs this project. He is a live poker player using the app at the table to compensate for the memory and pattern-recognition limits humans hit across a 9-handed game. He is not a software engineer; Claude is the sole developer. When Chris uses the app, he is also generating the feedback that shapes it — which means every awkward tap at a real table becomes a design signal.

---

## Context

- **Environment:** Live poker rooms. Variable lighting, often dim. Other players and a dealer at the table. Ambient noise. Interruptions (dealer shuffle, player arrivals/departures, food delivery, bathroom breaks).
- **Device:** Samsung Galaxy A22 landscape is the primary target device (1600x720 CSS pixels after Android's chrome). Other phones in portrait or landscape are possible. Tablet use is plausible but not primary.
- **Session shape:** 3–6 hour live poker sessions. Bursty usage — active for ~60s per hand, mostly idle between. ~30 hands per hour.
- **Available attention:** Split between cards, chips, opponents, dealer, and app. App cannot demand sustained focus; it must survive half-second glances.
- **Available hands:** Often one-handed. Dominant hand is sometimes on chips, cards, or a drink. Thumb reach in landscape is the binding constraint.

---

## Goals

- **Remember what the app told him earlier** — advice, villain reads, prior hand context — without scrolling back.
- **Log what just happened fast** — pre-flop actions, bet sizes, villain's behavior — within the time he'd otherwise spend on social chatter.
- **Get better decisions than he'd make unaided** — especially in marginal spots where equity, SPR, and opponent tendencies all matter.
- **Trust the app enough to rely on it in real money situations** — false confidence is worse than uncertainty.
- **Extend the app himself** — he directs Claude but wants to understand and verify changes.

## Frustrations

- **Dense displays that require more than a half-second glance** — the sidebar rebuild program (2026-04-12 → 2026-04-16) was triggered by this. [EVID-2026-04-12-SIDEBAR-S1-S5]
- **Destructive actions adjacent to common actions** — misclicks at the table cost time and data. [EVID-2026-04-21-CLEAR-PLAYER]
- **Forms that don't fit the landscape viewport** — data entry that cuts off or refuses to scroll. [EVID-2026-04-21-LANDSCAPE-SCROLL]
- **State that disappears unexpectedly** — losing hand data to phone sleep or accidental navigation.
- **Overly generic advice** — recommendations that ignore bucket-by-player context. [EVID: memory `feedback_reasoning_quality.md`, `feedback_first_principles_decisions.md`]

## Non-goals

- **Pretty for its own sake.** Visuals that don't shave time or reduce error are wasted effort.
- **Onboarding flows.** He knows the app; any first-run friction is pure cost.
- **Cross-device sync as a primary use case.** Single-device single-user is the default path; sync is a nice-to-have (currently PAUSED in backlog).

---

## Constraints specific to this persona

- **Time pressure:** Varies wildly by situation. See situational sub-personas for calibrated ranges.
- **Error tolerance:** Very low during hands, moderate between hands, high post-session.
- **Visibility tolerance:** Primary actions must be obvious within the thumb-reach arc. Secondary actions can be one tap away. Destructive actions need visual distinction + cost-of-misclick proportionate to impact.
- **Recovery expectation:** Undo within 5s for reversible actions (retro-link undo toast is a good pattern). No recovery needed for clearly-labeled destructive actions; but misclicks on benign-looking buttons that destroy data are the worst failure mode.

---

## Skill-state attribute (for adaptive-learning features)

Chris's skill evolves over time across multiple domains (Shape Language descriptors, preflop ranges, postflop decision rules, villain-modeling intuition). Features that track user skill must model it as a **per-domain attribute** — never as a single global level.

Shape per descriptor or topic:
- `level` — discrete mastery band (taxonomy per Gate 3 R1; 3–5 ordinal values).
- `confidence` — Bayesian credible interval on the level estimate.
- `lastValidatedAt` — timestamp of most recent evidence (drill / self-declaration / in-app usage).
- `trendDirection` — improving / stable / plateaued / decaying.
- `userMuteState` — `none` / `already-known` / `not-interested`.

Write-side rules:
- **Reference-mode** interactions do not write to this attribute (look-up is not assessment).
- **Deliberate** and **Discover** modes write per explicit intent gating — assert on `currentIntent` at the reducer boundary.
- User self-declaration is a **distinct signal** from behavioral observation; neither overrides the other arithmetically (see I-AE-7 signal-separation rule in `src/utils/assumptionEngine/CLAUDE.md`).

Read-side rules:
- **Temporal decay computed on read**, not written, to avoid timer-driven write storms.
- Transparency screens expose user-declaration and behavioral-observation **independently** — never a fused score.

Architectural basis: proposed shared `src/utils/skillAssessment/` module serves both user-skill and villain-skill inference. See `docs/projects/poker-shape-language.project.md` and `feedback_skill_assessment_core_competency.md` in memory.

---

## Observation-capture attribute (for Exploit Anchor Library + calibration features)

Chris may be in **capture mode** — reviewing a hand and tagging a pattern he noticed (a villain tell, a recurring spot, a deviation worth remembering). Capture is a distinct persona-action with its own budget and ergonomic constraints, not a sub-case of consuming advice.

Shape:
- `observation_capture_active` — boolean; default `false`. True only while the Tier 0 capture affordance is open.
- `observation_enrollment_state` — `enrolled` / `not-enrolled` (per Q1 verdict: global toggle for the calibration loop; per-anchor granularity deferred to Phase 2).
- `observation_incognito_default` — `contribute` / `do-not-contribute` (per Q2 verdict: opt-out; observations contribute to calibration by default, per-observation toggle always available).

Write-side rules:
- **Capture writes are user-originated only.** System-generated `anchorObservation` records (emitted by the matcher when an anchor fires in live play) are a separate write path and do not depend on `observation_capture_active`.
- **Draft persistence is non-negotiable.** Capture modal must persist draft to IDB on game-state change (next-hand-starts, phone sleep, navigation) and auto-dismiss without loss. Same constraint as live-surface freshness.
- **Capture framing is note-taking, never self-evaluation.** Button copy is "Tag pattern" / "Note this hand" — forbidden copy: "How did this hand go?", "Rate your play", "Score this decision." Autonomy red line #7 (editor's-note tone) enforces this at the copy-discipline level.

Read-side rules:
- **Capture UI never fires unprompted.** No banner, toast, or proactive surface ever suggests "want to tag this hand?" The affordance exists where Chris looks for it (HandReplayView ReviewPanel Section G) and nowhere else.
- **Persona-action budgets:** `between-hands-chris` ≤10s (capture must be one-tap with auto-dismiss); `post-session-chris` generous (can accept two-step tag + free-text flow); `mid-hand-chris` excluded (no capture affordance on live surfaces).
- **Cognitive budget during capture is reduced** — tagging IS the focus. The app should not compete with capture for attention (no toasts, no banner refreshes, no live-surface updates that pull focus).

Architectural basis: `docs/projects/exploit-anchor-library.project.md` §Gate 1 personas; `docs/projects/exploit-anchor-library/schema-delta.md` §AnchorObservation; `docs/projects/exploit-anchor-library/gate3-owner-interview.md` Q1 + Q2 + Q3.

---

## Autonomy constraint (applies to every feature)

The app may not form persistent opinions about Chris's skill without an explicit enrolled-state toggle. Using the app is not consent to be modeled. Recommendations are hypotheses, not verdicts. Overrides are durable and do not trigger adversarial re-inference.

The **9 red lines** promoted from two Gate 2 blind-spot audits (`docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md` established 1–8; `docs/design/audits/2026-04-24-blindspot-exploit-anchor-library.md` added #9) to persona-level constraints that bind every feature:

1. **Opt-in enrollment required** — no silent skill inference.
2. **Full transparency on demand** — the system must be able to show what it thinks and why.
3. **Durable overrides** persist without algorithmic rebuttal.
4. **Reversibility** — user can reset, delete, or practice in incognito mode at any time.
5. **No streaks, shame, or engagement-pressure** notifications or visual pressure.
6. **Flat access** — adaptivity sets order, never gates content behind skill-state.
7. **Editor's-note tone** — no gamified-infantile language.
8. **No cross-surface contamination** — study-mode inference stays in study mode; live surfaces render only classifier-fired descriptor tags (headless seeding).
9. **Incognito observation mode non-negotiable** (2026-04-24, Exploit Anchor Library) — per-observation toggle: "contribute to calibration" defaults to `contribute` (per Q2), but a one-tap "incognito" toggle is always visible on the capture modal. Three reasons an observation should not contribute: (a) it doesn't fit any anchor's triggers and would pollute the calibration data, (b) it's tentative and owner wants time to see if it recurs, (c) sensitive-context segregation (e.g., a specific villain owner doesn't want tracked). Per-tag granularity is non-negotiable even when global enrollment is `enrolled`.

Any feature amendment that requires weakening one of these triggers **persona-level review**, not just surface-level.

---

## Related JTBD

- See [JTBD Atlas](../../jtbd/ATLAS.md) for the full list.
- Most relevant this session: `player-management` domain jobs.
- Adaptive-learning JTBDs that apply (2026-04-23): `DS-52` retention, `DS-53` edge-case probe, `DS-54` exploration override, `DS-55` resumption, `DS-56` calibration, `ON-87` cold-start descriptor seeding.
- Exploit Anchor Library JTBDs that apply (2026-04-24): `DS-57` capture-the-insight (Tier 0 observation capture), `DS-58` validate-confidence-matches-experience (Calibration Dashboard), `DS-59` retire-advice-that-stopped-working (lifecycle override).

## Related situational sub-personas

- [Mid-hand Chris](../situational/mid-hand-chris.md) — 3–30 second decision window under table pressure.
- [Between-hands Chris](../situational/between-hands-chris.md) — 30–90 seconds for logging + lightweight reads.
- [Seat-swap Chris](../situational/seat-swap-chris.md) — player leaves, new one sits, needs fast reassignment.
- [Post-session Chris](../situational/post-session-chris.md) — off-table review, depth over speed.

---

## Proto-persona caveat

Marked PROTO until owner confirms or refines. Key assumptions:

- **[A1]** Primary use context is live in-person poker rooms (not online). Basis: exploit engine designed for 9-handed live play; memory notes "live poker hand tracker"; Samsung A22 landscape target. Verify by owner statement.
- **[A2]** Session length 3–6 hours typical. Basis: industry norm for live sessions. Verify by owner statement or session-length data from IndexedDB.
- **[A3]** One-handed operation is the binding ergonomic constraint during hands. Basis: live-table reality. Verify by owner report of which hand holds phone vs. chips/cards.
- **[A4]** Chris uses the app across both cash and tournament play. Basis: presence of Tournament context and Online view in codebase. Verify by usage breakdown.
- **[A5]** Stakes / bankroll size unknown; does not drive design directly but would shape "trust the advice" threshold. Not worth verifying unless a design question hinges on it.
- **[A6]** No other humans use the app. Basis: single-user app design; memory notes "AI is sole developer." Verify by owner statement.

Any A1–A6 that turns out false should flag re-review of Frustrations + Constraints sections.

---

## Change log

- 2026-04-21 — Created in Session 1 of design-framework project. Proto-status; awaiting owner confirmation of assumptions.
- 2026-04-23 — Added **Skill-state attribute** + **Autonomy constraint** sections. Output of Gate 3 for Poker Shape Language adaptive-seeding project. Skill-state attribute shape mirrors `assumptionEngine/` posterior conventions (Bayesian, on-read decay, signal separation). Autonomy constraint promotes 8 Gate 2 red lines to persona-level invariants. See `docs/projects/poker-shape-language/gate3-decision-memo.md`.
- 2026-04-24 — Added **Observation-capture attribute** section. Autonomy constraint red lines expanded from 8 → 9 (added #9 incognito observation mode). DS-57/58/59 added to Related JTBD list. Output of Gate 3 for Exploit Anchor Library project. Capture framing (note-taking, never self-evaluation) and per-observation incognito toggle are the load-bearing autonomy-enforcement patterns. See `docs/projects/exploit-anchor-library/gate3-owner-interview.md`.
