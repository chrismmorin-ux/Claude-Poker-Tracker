# Persona — The Scholar (Drills-Only Study User)

**Type:** Core (end-user archetype)
**Evidence status:** PROTO — unverified
**Last reviewed:** 2026-04-21

---

## Snapshot

Doesn't even play that much. Loves solving poker as a puzzle. Range-geek, GTO-curious. Would rather do 30 minutes of drills on the subway than play a session. Wants daily streak, clear explanations, spaced repetition, and a sense of mastery progression.

## Context

- **Venue:** None — study only.
- **Format:** All.
- **Skill:** Improving to advanced, purely through study.
- **Volume:** 10–30 hrs/month study.
- **Device:** Phone + desktop.
- **Intent:** Study and mastery.
- **Role:** Hobbyist learner.

## Goals

- Daily drill streak. *(Deferred: gamification mechanics require explicit opt-in per Gate 2 red line #5 — no streaks / shame / engagement-pressure in default behavior. Scholar's streak preference is an opt-in mode, not a default. See `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md`.)*
- Master preflop charts for any format.
- Understand postflop frequencies in detail.
- Feel fluency — know they're improving objectively.

## Frustrations

- GTO Wizard is expensive and overwhelming for their use case.
- Most apps don't *teach* — they only score.
- Want explanations, not just verdicts.

## Non-goals

- Live play tools.
- HUD / sidebar.
- Session tracking.

---

## Constraints

- **Time pressure:** None.
- **Error tolerance:** High.
- **Visibility tolerance:** High for explanations.
- **Complexity tolerance:** High for intellectual depth.

---

## Related situational sub-personas

- [Daily drill habit](../situational/study-block.md)
- [Rabbit-hole exploration](../situational/study-block.md) — same file, different triggers.

## Related JTBD

- `JTBD-DS-*` drills and study (primary domain)
- `JTBD-ON-*` onboarding (will use explanatory tooltips heavily)

## Product line

- **Main app, drills module.** No sidebar.

## Tier fit

- **Plus (Regular) ~$19/mo**.
- Free tier may be enough for the casual Scholar — a pricing test.

---

## Missing-feature needs

- [DISC] Spaced repetition for charts.
- [DISC] Skill map / mastery tracker.
- [DISC] Custom drill from own hand history (if they occasionally play).
- [DISC] Daily streak + gentle gamification. *(Opt-in only; defaults off per autonomy red lines.)*

---

## Skill-state attribute (for adaptive-learning features)

Scholar's skill evolves per-domain (preflop ranges, postflop frequencies, Shape Language descriptors, ICM intuition). Model skill as a **per-domain attribute** with the same shape used for Chris Live Player:

- `level` — discrete mastery band.
- `confidence` — Bayesian credible interval.
- `lastValidatedAt` — timestamp of most recent evidence.
- `trendDirection` — improving / stable / plateaued / decaying.
- `userMuteState` — `none` / `already-known` / `not-interested`.

Scholar's attribute carries the **same invariants** as Chris's (Reference-mode does not write; Deliberate/Discover do; user declaration is distinct from behavioral signal; decay on read). Full shape and rationale: `docs/design/personas/core/chris-live-player.md` §"Skill-state attribute."

**Scholar differs from Chris** in engagement preferences (Scholar welcomes streak / coverage / mastery-progression telemetry), but all opt-in-only per red line #5. The skill-state attribute itself is identical.

## Proto caveats

- **[S1]** $15–30/mo WTP. Basis: training-site subscription equivalent (Run It Once Essentials). Verify.

---

## Change log

- 2026-04-21 — Created Session 1b.
- 2026-04-23 — Added **Skill-state attribute** section (inherits Chris's invariants). Flagged streak-gamification goal as opt-in-only per Gate 2 red line #5. Output of Gate 3 of Poker Shape Language adaptive-seeding project. See `docs/projects/poker-shape-language/gate3-decision-memo.md`.
