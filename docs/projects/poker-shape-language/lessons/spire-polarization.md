---
descriptorId: spire-polarization
title: Spires & Polarization
catalogPosition: 3
priorityTier: P0
surfaceEmbeds:
  - hand-replay-view
authoredAt: 2026-05-16
authoredAtSprint: SPR-084
authoredFor: WS-042
prototypes:
  - flat
  - left-heavy
  - right-heavy
  - dumbbell
relatedDescriptors:
  - equity-distribution-curve
  - silhouette
versionLineage:
  version: 1
  authored_at: 2026-05-16
  amended_at: null
  amendment_reason: null
---

## Exposition

Spire and Polarization are two named classifiers on the same underlying data — the [equity-distribution curve](equity-distribution-curve.md). Both live in the same descriptor row and fire together, which is why they share a lesson.

**Spire** asks one yes/no question: *does villain's range have a small but visible tower of nutted combos sitting on top of an otherwise medium-to-weak range?* If yes, Spire fires and reports a width — how thin or wide that top-end value tower is. A thin spire (width 1) means a small set of bombs (a few sets, a few straights). A wider spire (width 2+) means the value region is broader (two-pair-plus, multiple sets, draws-now-getting-there). The spire is the *uncapped* signature — its presence means villain's range cannot be eliminated of the strongest hands.

**Polarization** asks where the *mass* of the range sits along the curve. Four prototype shapes — **Flat**, **Left-heavy**, **Right-heavy**, **Dumbbell** — cover the configurations that show up at the table. Flat is "no clear shape, mass roughly evenly spread." Left-heavy is "mostly weak combos" (villain is here with mostly air or draws). Right-heavy is "mostly strong combos" (villain has narrowed to value, often after multiple raises). Dumbbell is "heavy on both ends, light in the middle" — the polarized signature, with value + bluffs and no medium.

The two classifiers are independent: a range can be Dumbbell + Spire (heavy on both ends, with a thin spike at the top — the polarized 3-bet range), or Left-heavy + No Spire (mostly weak combos, no nuts — capped flop-call range), or Right-heavy + Spire (mostly strong with a thin nut spike — committed river range), or Flat + No Spire (recreational opener). Each combination tells a different story about what villain's range actually is.

Reading both labels together is faster than reading the curve itself. Once you've practiced the four polarization shapes and the spire/no-spire binary, you can name villain's range geometry in less than a second from any hand-replay surface that shows you the curve.

## Worked example

Each combination shows up in a different strategic context. The labels here are descriptive, not prescriptive — Spire firing doesn't tell you to fold or call, it tells you the range has uncapped strength.

**Flat + No Spire — recreational caller's flop range.**
The curve is approximately horizontal across all 8 buckets, with no spike at the top. Villain has a wide, undifferentiated range — mostly mid-strength hands with no clear value-or-bluff structure. Where you'll see this: loose-passive players in early orbits, flop calls from BB at a recreational table.

**Left-heavy + No Spire — passive caller's flop range vs strong board.**
Mass concentrated in the low-equity end (buckets 0-3), nothing at the top. Villain called preflop, called the flop, but has no nutted combos in their range — the spire is absent because the action didn't include a raise. Where you'll see this: passive flat-calls of preflop opens that connect weakly with the board, BB defense ranges on dynamic boards where villain mostly missed.

**Right-heavy + No Spire — committed range after multi-street pressure.**
Mass concentrated in the high-equity buckets (4-7), no thin spike on top. Villain raised, raised again, and called your raise — by the river they've narrowed to value-and-near-value only. The spire is absent because the range is wide-value (multiple two-pair-plus hands all densely packed in the top buckets), not a single small cluster of nuts. Where you'll see this: river spots where villain has shown extensive aggression and called your aggression in turn.

**Dumbbell + Spire — polarized 3-bet range.**
Heavy mass at both bucket 0 (the bluff combos — villain has the worst hands at this point in the hand) and bucket 7 (the value combos — premium pairs and AK), with a clear empty middle. A thin spire on top tells you the value portion is concentrated in the very strongest combos, not the second-tier. Where you'll see this: solver-derived 3-bet ranges in deep-stack cash, polarized 4-bet defenses.

**Dumbbell + No Spire — bluff-heavy semi-polarized range.**
Heavy on both ends but the top end is wider (multiple value combos, no thin nut spike). The polarization is real but the value half is balanced across buckets 5-7, not concentrated in 7. Where you'll see this: turn polarization on dynamic boards where villain's value range includes multiple two-pair / sets / straights / flushes — many hands at high equity, not just a thin top cluster.

## Success criteria

After working through this lesson, you should be able to:

- Look at an equity-distribution curve and name both the Polarization label (Flat / Left-heavy / Right-heavy / Dumbbell) and the Spire status (yes/no, plus rough width) within a second.
- Recognize that Spire and Polarization are independent — a range can fire either, both, or neither.
- Understand that Spire is the **uncapped signature**: its presence means villain's range cannot be eliminated of the strongest combos, which has strategic implications you compute downstream (not here).
- Distinguish Dumbbell from Left-heavy / Right-heavy: Dumbbell requires heavy mass on **both** extremes and an empty middle; Left/Right-heavy just requires lopsided distribution.
- Use the combined label as a one-clause description of villain's range geometry: "Dumbbell with a thin spire" or "Left-heavy, no spire" — faster than reading the curve itself.

The lesson does NOT teach you *what to do* given a particular shape — that's downstream strategic work derived from equity, pot odds, and SPR. It teaches you to *recognize* the shape when it appears in your replay surface.

## Drill spots

The following drill spots are authored for the future LessonRunnerView Deliberate and Discover variants (per `docs/design/surfaces/lesson-runner.md`). Each spot presents a per-combo equity distribution and asks for both labels.

- **Spot 1.** Range: BTN GTO open on Qh7s2d flop, hero JsJh. Correct: Left-heavy + No Spire. Reasoning: hero's JJ overpairs most of villain's BTN range (which is mostly weak-to-medium broadways and small pairs); villain's set combos (QQ, 77, 22) are 9 of ~250 combos — too few to spike the top bucket.

- **Spot 2.** Range: "AA, KK, AKs, AKo, 76s, 65s, 54s, 87s" on 9c8h2d flop, hero TT. Correct: Dumbbell + Spire (thin). Reasoning: villain's range is polarized into value (AA, KK have ~85% equity vs TT) and straight-draw bluffs (76s-87s have ~25%). Spire fires because AA + KK at top bucket are ~6/22 combos = 27% top fraction.

- **Spot 3.** Range: "any two suited" on Jh9c4d flop, hero AdKd. Correct: Flat + No Spire. Reasoning: hero's AK has ~45% equity vs a wide suited-only range; equity is spread across buckets with no clear concentration. No nutted combos dominate.

- **Spot 4.** Range: "AA only" on Jh9c4d flop, hero KK. Correct: Right-heavy + Spire (width 1). Reasoning: single-combo range collapses entirely into the top bucket — 100% of mass at heroEq ≈ 0.10 (villain eq 0.90). Trivially right-heavy with the thinnest possible spire.

- **Spot 5.** Range: BB defense on Jh7d2c flop, hero AcKd. Correct: Flat + No Spire. Reasoning: BB defense range is uniformly wide; on this dry low board, hero's AK has similar equity (~50%) against most of villain's combos, with no clear nut cluster.

- **Spot 6.** Range: "22-99, JTs, T9s, 98s, 87s, 76s" on AhKsQs flop, hero AcAd. Correct: Left-heavy + No Spire. Reasoning: hero's set of aces crushes villain's range; almost all combos give villain low equity (< 20%), with no top cluster — pairs and connectors are all behind, no straights complete yet.

- **Spot 7.** Range: solver-derived turn raise range on Jh7d2c-Qh, hero AcKd. Correct: Right-heavy + Spire (width 2). Reasoning: villain raised the turn — their range narrows to value-and-near-value (sets, two-pair, AK with backdoor flush draws); top two buckets carry > 50% of the weight and the spire is wider than a thin spike because the value distribution covers multiple high-equity hand classes.
