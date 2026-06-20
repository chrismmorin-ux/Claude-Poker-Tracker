# Audit — 2026-06-20 — Entry — Short-Stack Push/Fold Verdict

**Scope:** Below ~15bb effective preflop (tournament), replace the equity-threshold advice tag with a binary SHOVE / FOLD / CALL verdict computed from first principles (fold-equity + equity-vs-calling-range + ICM-adjusted required equity), plus a reason line + effective-stack ladder. New `src/utils/pushFoldEngine/` + `PushFoldPanel` in CommandStrip.
**Auditor:** Claude (main), session 2026-06-20.
**Method:** LIFECYCLE.md Gate 1.
**Status:** **GREEN** — implements the captured discovery + an existing persona/JTBD; §10.4 doctrine already governs the theory. Proceed to implementation.
**Builds on:** the ICM foundation (`src/utils/icmEngine/`, commit 7507af0) — first consumer.

---

## Executive summary

The push/fold verdict was fully scoped in `docs/design/discoveries/2026-04-21-push-fold-widget.md` (CAPTURED) and the `push-fold-short-stack` situational persona. The current `LiveAdviceBar` equity tag (`eq≥0.55=VALUE`) is "the wrong model" at push/fold depth (blind-spot audit 2026-04-21 §C3). This builds the verdict the persona needs. No new persona, no new JTBD — MH-07 (short-stack push/fold with ICM) and TS-43 (ICM-adjusted decision) are already Active and this is their primary serving surface.

## Scope classification

**Surface-bound refinement + new engine.** Replaces the advice tag below threshold with a new `PushFoldPanel` (the `LiveAdviceBar` yields by receiving `actionAdvice=null`). New non-UX `pushFoldEngine/`. No new routed view. MVP is **tournament main-app only** (the one mode with both chip stacks and ICM); online/sidebar + manual-cash stack input are follow-ons.

## Personas check — all in cast, no new persona

| Persona | Role | In cast? |
|---|---|---|
| push-fold-short-stack (situational) | primary — demands <1s binary verdict, ICM auto-applied, no stack input | ✅ |
| circuit-grinder | primary (live MTT push/fold) | ✅ |
| online-mtt-shark, hybrid-semi-pro | follow-on (online path) | ✅ |

## JTBD check — already Active

- **MH-07** short-stack push/fold with ICM (Active; this is the surface that makes it usable).
- **TS-43** ICM-adjusted decision at the bubble (Active; push/fold is a primary serving surface).

No new JTBD.

## Gap analysis output — GREEN

| Dimension | Status | Notes |
|---|---|---|
| Persona coverage | GREEN | push-fold-short-stack + circuit-grinder in cast |
| JTBD coverage | GREEN | MH-07, TS-43 already Active |
| Heuristic pre-check | GREEN | Binary verdict (persona: no mixed strategies); reads effStack from state (persona: never ask the user); cached for <1s (persona budget) |
| Cross-surface | GREEN | Replaces the advice tag in CommandStrip; LiveAdviceBar untouched (yields on null advice). Online/sidebar deferred |
| Doctrine | GREEN | POKER_THEORY §10.4 (Push/Fold Is a $EV Decision) already authored; verdict driven by $EV/equity, never M-ratio labels (§10.3/§10.5) |

## Required follow-ups

- [ ] Update the discovery `2026-04-21-push-fold-widget.md` → BUILT on completion; surface note.
- [ ] Follow-ons (separate): online/sidebar render path, manual-cash hero-stack input, full Nash chart on long-press, bounty-adjusted EV.

## Change log

- 2026-06-20 — Created. GREEN. Implements DISC-2026-04-21-push-fold-widget; first ICM-foundation consumer.
