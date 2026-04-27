# Situational Sub-Persona — Returning After Break

**Type:** Situational (cross-persona)
**Applies to:** Chris Live Player, Scholar, Apprentice, Rounder, Circuit Grinder — any persona that enrolled in adaptive-learning features and was then away for ≥3 weeks
**Evidence status:** PROTO — authored Gate 3 of Poker Shape Language project (2026-04-23); not yet observed in practice
**Last reviewed:** 2026-04-23

---

## Snapshot

The user has been away from deliberate study for **≥28 days** and is returning. The skill model's last-validated timestamps are stale; recognition latency has drifted; confidence in descriptor / concept identification may be overstated relative to current performance. The user is often aware of the gap ("let me get back into it") but the system must neither treat them as a novice nor re-run a placement quiz — both violate durable overrides or autonomy red lines.

The characteristic moment: first `Deliberate` or `Discover` mode entry after the gap. The welcome-back surface fires **once**.

---

## Situation trigger

- First `Deliberate` or `Discover` mode entry where `now - lastValidatedAt >= 28 days` across any descriptor with prior write history.
- System detects via per-descriptor staleness, computed **on read** — no background job.
- Exits when: welcome-back surface dismissed, one recalibration completed, OR user opts explicitly to resume without recalibration.
- **Does not re-fire** for the remainder of the session (dismissal is session-durable) and does not re-fire every session until user re-enrolls via a fresh gap.

## Context

- **Time pressure:** None.
- **Attention:** Focused but re-orienting. User may be rusty on recent app conventions (new descriptor, new surface since last visit).
- **Cognitive load:** Low — not simultaneously playing.
- **Device:** Phone or desktop.
- **Emotional framing:** Potentially apologetic ("I've been slacking"). System must NOT reinforce that frame — red line #5 forbids shame / streak-loss framing.

## Primary need

- **Honest acknowledgment that skills may have decayed without tone of failure.** Not *"You haven't studied in a month"* (shame). Yes: *"Welcome back. Some descriptors haven't been practiced in a while — want a quick recalibration?"*
- **Skippable re-entry path.** Red line #6: flat access. User can skip straight to any lesson without recalibrating, and the skip button is equal visual weight to the recalibrate button.
- **One-time surface, not nag.** Fires once per gap event. User's choice persists.

## Secondary needs

- **Transparency on what's decayed.** Stale-descriptor list sorted by staleness, each with a one-tap recalibrate action per descriptor.
- **Single-descriptor re-validation.** One drill on one descriptor, pass/fail, skill-state updates, exit cleanly. Under 2 minutes.
- **Mute preservation.** `userMuteState: 'already-known'` set before the gap survives the gap. Recalibration does not silently reset mutes.

## What a surface must offer

1. **Welcome-back surface on gap detection** — non-modal, dismissable, one-time per gap event.
2. **Stale-descriptor list** sorted by staleness, with one-tap recalibrate affordance per descriptor.
3. **Skip button** prominent, equal visual weight to "recalibrate all" or per-descriptor recalibrate.
4. **Decay-aware transparency screen** — each descriptor shows "last validated N weeks ago" with a recalibrate action (separate from the welcome-back surface; persistent, not one-time).

## What a surface must NOT do

- **Push notifications** (red line #5).
- **Reset the skill model** automatically (red line #3 — durable overrides survive gaps).
- **Force recalibration** before access to lessons (red line #6 — flat access).
- **Shame the gap** ("We missed you!" / streak-loss language / flame-emoji / "Don't break the chain").
- **Re-fire the welcome-back** within the same session after dismissal, or in subsequent sessions after the user acknowledged the gap (explicit dismissal is durable).
- **Over-surface** — if 50 descriptors are stale, show top 5 and "see all" — don't wall the user with a long list.

---

## Related JTBD

- `JTBD-DS-55` Resumption after break (primary)
- `JTBD-DS-52` Retention maintenance (surfaces the decay state)
- `JTBD-DS-54` Exploration override (user can opt out of recalibration without consequence)
- `JTBD-CC-01` Undo a recent destructive action (applies if recalibration is mis-invoked)

## Related core personas

- [Chris, Live Player](../core/chris-live-player.md) — primary
- [Scholar](../core/scholar-drills-only.md) — primary (gap is more conspicuous; Scholar's streak preference must not auto-re-engage)
- [Apprentice](../core/apprentice-student.md) — secondary

## Related autonomy red lines

This persona exists largely to defend red lines **#3 (durable override)** and **#5 (no engagement pressure)** during a moment when tools historically default to aggressive re-engagement (Duolingo's "missed days" prompts, Anki's "due card" floods, Khan Academy's streak-recovery screens). The welcome-back surface is the point of maximum temptation to re-engage aggressively — every design choice here must trade short-term re-engagement for long-term autonomy.

## Missing features

- [DISC] Welcome-back surface with gap-detection trigger (post-Gate 4).
- [DISC] Decay-aware transparency screen (post-Gate 4).
- [DISC] One-tap single-descriptor recalibration (post-Gate 4).

---

## Proto caveats

- **[R1]** 28-day threshold is a starting point. Shorter (14 days) may trigger too eagerly; longer (42 days) may miss Scholars who prefer weekly review but skipped a month. Verify against first real gap observations.
- **[R2]** Welcome-back surface fires only for users who previously enrolled. Pre-enrollment users hitting a gap get no surface — their experience is covered by `newcomer-first-hand` or the standard cold-start flow.
- **[R3]** Gap detection is per-descriptor, not global. A user who maintained Silhouette but let Saddle go stale sees only Saddle in the welcome-back. Global-gap heuristics reserved for Gate 4 research.

---

## Change log

- 2026-04-23 — Created Gate 3 of Poker Shape Language adaptive-seeding project. Proto-status; awaiting first returning-gap observation in practice. Pairs with `JTBD-DS-55` (resumption after break) in `docs/design/jtbd/domains/drills-and-study.md`.
