# Situational Persona — Newcomer First Hand

**Type:** Situational (derived from [Newcomer](../core/newcomer.md))
**Evidence status:** PROTO — inferred; no first-hand telemetry yet
**Last reviewed:** 2026-04-21
**Owner review:** Pending
**Surfaced:** [Blind-spot audit 2026-04-21 table-view §A2](../../audits/2026-04-21-blindspot-table-view.md)

---

## Snapshot

A Newcomer reaches TableView for the first time while cards are being dealt at a real table. They have no mental model of:
- Right-click seat menu (desktop-native pattern in a mobile-first app).
- The orbit strip (what does "orbit" even mean to someone who hasn't played 10K hands?).
- Absent-seat toggle ("why are some seats greyed out?").
- The advice freshness indicator (what does stale look like vs. current?).

They need to **record this hand correctly now** even though they do not yet know what the app does. Success looks like: action recorded accurately, advice read and considered, zero mystery controls activated.

---

## Situation trigger

- First real use of TableView during an actual (not demo) hand.
- Exits when: persona crosses the "I know where the common controls are" threshold — typically 5-10 hands into the session.

## Context (deltas from core persona)

- **Time pressure:** Same as [Mid-Hand Chris](./mid-hand-chris.md) — 3-30 seconds per action.
- **Attention:** Split between learning the interface and playing the hand. Neither gets enough.
- **Hand availability:** Same as any live player — often one-handed.
- **Cognitive load:** *Higher* than mid-hand-chris. Mid-hand Chris has muscle memory; Newcomer has none. Every control is a conscious evaluation.
- **Emotional load:** Moderate to high — impostor syndrome, worry about fumbling in front of other players, fear of making a miskey that corrupts data.

## Goals

- **Tap the correct action for the current street** without guessing what the buttons mean.
- **Read the advice** and understand whether it's trustworthy *without* knowing the full confidence/staleness vocabulary.
- **Undo a mistake** without learning a new pattern (undo should "just work").
- **Discover recovery paths** — if the app is in a weird state (wrong seat selected, wrong street active), find the way back to a clean state.

## Frustrations (JTBD-killers for this situation)

- Right-click as a hidden entry point. On a touch device, "right-click" is long-press — the Newcomer doesn't know this.
- Unlabeled or minimally-labeled controls. The orbit strip, dealer drag, action history grid: all legible to a veteran, opaque to a first-use Newcomer.
- No "help" / "what is this" tooltip affordance.
- Advice with technical jargon (SPR, MDF, range, equity) without a plain-English gloss.

## Non-goals

- Deep strategy understanding. The Newcomer's core persona's "first-hover jargon explanations" (JTBD-ON-83 Proposed) is the follow-up job.
- GTO-correct play. Satisfaction = "I used the app without breaking anything and had fun."

---

## Constraints

- **Time budget per interaction:** Effectively < 3s (same as mid-hand) but amplified by hesitation cost.
- **Error tolerance:** Higher than mid-hand-chris — Newcomer expects to make mistakes. Undo must be obvious, not clever.
- **Visibility tolerance:** Wants MORE help than Mid-Hand Chris would — labels, tooltips, confirmations. The design tension is that these same affordances are noise for the veteran.
- **Recovery expectation:** If the app gets into a weird state, a Newcomer will conclude "I broke it" and may abandon the session. Graceful recovery is non-negotiable.

---

## Related JTBD

- `JTBD-HE-11` one-tap action entry (acute: labels must be unambiguous)
- `JTBD-HE-12` undo (acute: recovery is a conscious path, not a muscle-memory)
- `JTBD-MH-01` see the recommended action (acute: trust is still being earned)
- `JTBD-MH-10` plain-English "why" (primary — this is the Newcomer's gateway to strategic learning)
- `JTBD-ON-82` 90-second product tour (Proposed — the PREREQUISITE to this situation)
- `JTBD-ON-83` first-hover jargon explanations (Proposed — the IN-SITUATION aid)

## Related core persona

- [Newcomer](../core/newcomer.md) — primary

---

## What a surface must offer this persona

1. **Unambiguous primary-action labels.** Fold / Check / Call / Bet / Raise visible as text, not only icons.
2. **Plain-English advice reasoning on-demand.** Tap the rec → one-sentence why.
3. **Help-discovery affordance.** A "?" anywhere, or first-session tour hooks (JTBD-ON-82).
4. **Undo visible on every destructive action.** Not just a toast that disappears in 5 seconds.
5. **Graceful empty / weird states.** "No active session" explains how to start one; "no advice yet" explains what's computing.
6. **No hidden gestures.** Right-click / long-press should have a visible equivalent button.

## What a surface must NOT do

- Hide primary actions behind a menu that requires context-awareness to open.
- Show advice that references concepts (SPR, MDF, range) without a plain-English gloss.
- Assume the user has seen a tour.
- Punish exploratory taps — a Newcomer will tap everything to learn.

---

## Proto-persona caveat

- **[A1]** No Newcomer has been observed using this app. All claims are inferred from the persona definition + standard UX heuristics for first-use.
- **[A2]** The "5-10 hands" threshold for exiting the situation is a guess. Verify by onboarding telemetry once instrumented.
- **[A3]** The Newcomer persona itself is PROTO — verifying this situational persona is blocked on verifying the core one.

---

## Related design decisions

- **Tour feature (ON-82):** If ON-82 ships, it becomes the designed path into this situation and the persona collapses into "post-tour Newcomer" — which is almost just Mid-Hand Chris with less muscle memory. If ON-82 doesn't ship, this persona's needs are load-bearing on TableView's default-state design.
- **Help-discoverability:** This persona argues for a persistent help affordance, which mid-hand-chris argues against (visual noise). The design resolution is likely a hideable help layer toggled once per user, not always-visible help.

---

## Change log

- 2026-04-21 — Created. Closes Stage A gap from `audits/2026-04-21-blindspot-table-view.md`.
