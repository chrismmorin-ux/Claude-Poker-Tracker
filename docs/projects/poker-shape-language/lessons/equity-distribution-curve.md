---
descriptorId: equity-distribution-curve
title: Reading the Hockey Stick — Equity-Distribution Curve
catalogPosition: 2
priorityTier: P0
surfaceEmbeds:
  - hand-replay-view
authoredAt: 2026-05-16
authoredAtSprint: SPR-084
authoredFor: WS-042
relatedDescriptors:
  - spire-polarization
  - silhouette
versionLineage:
  version: 1
  authored_at: 2026-05-16
  amended_at: null
  amendment_reason: null
---

## Exposition

The Equity-Distribution Curve is the sorted picture of *how much equity each combo in a range has* against a fixed opponent (you, on a fixed board). Sort every combo by equity, plot equity on the y-axis vs the cumulative weight on the x-axis, and you get a curve. The shape of that curve is the named **hockey-stick**: a long flat run at low-medium equity, then a sharp upward kink at the right edge for the strongest combos.

The curve is a *data structure*, not a label. Other descriptors classify the curve — **Spire** asks "is there a thin tower of nutted combos on the right edge?", **Polarization** asks "where is the mass concentrated along the curve?", and the **Saddle** descriptor asks about bimodal high-vs-low splits on a single board. The hockey stick is what those classifiers look at.

Reading the curve is a perception task that pays off across every postflop spot. The shape tells you what *kinds* of combos are in villain's range without you having to enumerate them: a tall left half means the range is mostly drawing dead or close to it; a tall right half means the range is mostly value; a long flat middle with a sharp right edge is the eponymous hockey stick — most of villain's range is medium-weak with a small set of monsters at the top.

The curve also exposes what equity calculators show as a single number — your equity-vs-range — as the **weighted area under the curve**. Two ranges with the same single-number equity can have radically different curves: 35% equity against a flat distribution is a different strategic problem than 35% against a hockey stick. The curve says which one you're in.

## Worked example

Five canonical curve shapes — what they look like and where you see them at the table.

**1. Flat — village idiot's open.**
Curve is a near-horizontal line across the whole range; villain has roughly the same equity in every combo. Recreational player who plays "any two cards above a king" — there's no premium-vs-bluff structure, just a wide blob of medium equity. Where you'll see this: loose-passive callers, especially in early-orbit recreational lineups.

**2. Hockey stick — solver-derived c-bet range.**
Long flat run at medium equity (the c-bet bluff portion of the range), then a sharp upward kink at the right edge for the value combos. The "stick" is the bluff segment, the "blade" is the value spike. Where you'll see this: any range constructed deliberately with value + bluff segmentation, especially solver-style c-bet ranges on dynamic boards.

**3. Dumbbell — polarized 3-bet range.**
Tall on both ends, low in the middle. Lots of weight at the bottom of the equity distribution (the bluff combos), lots at the top (the premium value combos), nothing in between. Where you'll see this: solver-derived 3-bet ranges, polarized 4-bet defenses, players consciously playing two-mode ranges.

**4. Left-heavy — passive caller's flop range.**
Mass concentrated at the low-equity end of the curve, slow rise into medium, no value spike at the right edge. Villain is in this spot with mostly draws and marginal made hands — the missing right edge tells you they don't have the nuts often. Where you'll see this: passive-style calls of preflop raises that then call a flop bet without raising.

**5. Right-heavy with no left tail — committed range.**
Mass entirely at the high-equity end of the curve, no bluffs, no medium spread. Villain raised, raised again, and called your raise — by the river their range has narrowed to value only. Where you'll see this: deep-line spots where villain's actions have plausibly capped them at the top.

## Success criteria

After working through this lesson, you should be able to:

- Look at a sorted equity curve and name its shape — flat, hockey stick, dumbbell, left-heavy, right-heavy — within a second.
- Understand that the curve is the *substrate* on which Spire + Polarization classifiers fire. If the curve has a sharp right-edge kink, Spire fires; if the mass distribution is bimodal, Polarization labels it Dumbbell.
- Use the weighted area under the curve as the same number as "equity-vs-range" — the single-number equity is just the integral of this curve.
- Avoid the trap of trusting the single equity number when the curve is bimodal — 50% equity against a dumbbell range is a fundamentally different problem than 50% against a flat range.

The lesson does NOT teach you *what to do* given a particular curve shape — that's downstream strategic work. It teaches you to *recognize* the curve when you see it in study or in a hand-replay surface.

## Drill spots

The following drill spots are authored for the future LessonRunnerView Deliberate and Discover variants (per `docs/design/surfaces/lesson-runner.md`). Each spot presents a per-combo equity distribution and asks which curve shape it matches.

- **Spot 1.** Range: "uniform-50pct" on AhKsQs flop, hero AcAd. Correct curve: hockey stick. Reasoning: hero's AA dominates the wide range; most villain combos have low equity (under 30%), but the small subset that includes KK, QQ, AK, AQ have very high equity vs AA on this board (sets and two-pair) — sharp upward right edge.

- **Spot 2.** Range: "AA, KK, AKs, AKo, 76s, 65s, 54s, 87s" on 9c8h2d flop, hero TT. Correct curve: dumbbell. Reasoning: villain's range is polarized into value (AA, KK have ~85% equity vs TT) and bluffs (76s-87s have ~25% equity, mostly straight draws). Middle of the curve is empty.

- **Spot 3.** Range: "22, 33, 44, 55, 66, 77, 88, 99" on Jh9c4d flop, hero AdKd. Correct curve: left-heavy. Reasoning: villain's range is all weak pairs; hero has 2 overcards + backdoor. Most combos give villain ~55-65% equity, but there's no clear left or right cluster — mass piles into the medium-low band.

- **Spot 4.** Range: BTN GTO open on Qh7s2d flop, hero JsJh. Correct curve: hockey stick. Reasoning: hero's JJ has medium equity vs most BTN combos (overpair to second pair on the board), but villain's set combos (QQ, 77, 22) crush the overpair. Most weight is at medium equity, value spike at the top.

- **Spot 5.** Range: "any two suited", board 5h4h3h, hero JdTd. Correct curve: right-heavy. Reasoning: with a one-card flush + one-card straight on the board, hero's hand has near-zero equity vs most suited combos. Villain's range here is mostly flushed + straighted, so the curve is shifted right — minimal low-equity combos remain.

- **Spot 6.** Range: "AA only" on any flop, hero KK. Correct curve: vertical spike (right-edge only). Reasoning: single-combo range; the curve is a single point. The shape is degenerate, but it's the limit of the "right-heavy with no left tail" shape — used here as the trivial reference for recognizing committed/narrowed-to-value ranges.

- **Spot 7.** Range: BB defense from a small raise on Js7d2c flop, hero AcKd. Correct curve: flat. Reasoning: BB defense is uniformly wide, and most BB-defense combos have similar equity vs AK on this dry low board — mostly weak pairs and mid-suited connectors. No spike at the top; the curve is close to horizontal.
