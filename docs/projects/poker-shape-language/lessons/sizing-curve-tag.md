---
descriptorId: sizing-curve-tag
title: The Sizing Landscape — Sizing Curve Tag
catalogPosition: 4
priorityTier: P0
surfaceEmbeds:
  - hand-replay-view
authoredAt: 2026-05-16
authoredAtSprint: SPR-084
authoredFor: WS-042
prototypes:
  - ridge
  - plateau
  - cliff
  - ramp
relatedDescriptors:
  - equity-distribution-curve
  - spire-polarization
versionLineage:
  version: 1
  authored_at: 2026-05-16
  amended_at: null
  amendment_reason: null
---

## Exposition

The Sizing Curve Tag is a one-word label that compresses the shape of an EV-vs-bet-size curve into something you can read in a fraction of a second. Four prototype shapes — **Ridge**, **Plateau**, **Cliff**, **Ramp** — cover the configurations that show up in real game-tree EV output. The full curve is a study artifact; the tag is what travels to the table.

The classifier operates on the EV-per-sizing array produced by the game tree (per-fraction expected value for each candidate bet size). It looks at three statistics — peak prominence, monotonicity, and top-cluster width — to decide which prototype best fits. A sharp interior peak with monotone falloff on both sides is a **Ridge**. A wide top with EV roughly constant across a range of sizes is a **Plateau**. A monotone non-increasing curve (EV best at the smallest size, falling as you bet bigger) is a **Cliff**. A monotone non-decreasing curve (EV best at the largest size, rising as you bet bigger) is a **Ramp**.

Recognizing the tag is faster than reading the full sizing curve. Once you've practiced the four prototypes, you can name the optimal sizing region — "this is a Ridge spot, optimal sizing is right around 0.6 pot" or "this is a Cliff, smallest sizing is best" — directly from the tag without re-reading the chart.

Like the other Shape Language descriptors, the tag is **descriptive, not prescriptive**. Ridge doesn't mean "always bet that size" — it means "the EV curve has a sharp interior peak." The strategic implication (whether to take the peak sizing at all, whether the peak EV is positive, whether the spot is bluff-friendly enough that the peak even matters) is computed downstream by the game-tree evaluator. The tag is a label on the *shape* of the curve, not on the *decision* you should make.

When the math is ambiguous — two prototype shapes fit the input nearly equally well — the classifier returns a **compound** label (e.g., `ridge + plateau`). This mirrors the silhouette classifier's behavior: a flipping single-label classifier (Ridge one frame, Plateau the next as the curve shifts) is worse than a stable compound. Compound is honest reporting that the curve sits between two named shapes.

## Worked example

Four canonical sizing-curve shapes — what they look like and where you'll see them.

**1. Ridge — sharp interior peak.**
EV array: `[0.0, 0.2, 1.0, 0.3, 0.1]` across sizings `[0.25, 0.5, 0.75, 1.0, 1.5]` pot. The peak at the third sizing (0.75 pot) dominates; smaller sizings leave money on the table and larger sizings push villain to fold value. Where you'll see this: medium-strength value bets on coordinated boards where overbet sizing thins villain's calling range too aggressively.

**2. Plateau — wide flat top.**
EV array: `[0.2, 0.9, 1.0, 0.95, 0.85, 0.3]` across sizings. The top 60-80% of the curve clusters near the peak — multiple sizings produce nearly the same EV. Where you'll see this: monotone-board value bets where villain calls with the same range across a wide sizing band, or polarized ranges where the sizing axis is less load-bearing than the bet/check axis.

**3. Cliff — monotone non-increasing.**
EV array: `[1.0, 0.7, 0.4, 0.1, -0.2]` across sizings. EV is best at the smallest size and drops as you bet bigger. Where you'll see this: thin value bets where villain folds equity faster than you gain pot equity at larger sizings, or bluffs where villain's calling threshold is well below the betsize.

**4. Ramp — monotone non-decreasing.**
EV array: `[0.0, 0.3, 0.6, 1.0]` across sizings. EV is best at the largest size and rises with bet size. Where you'll see this: nutted-value spots vs sticky callers (the largest sizing extracts most), or bluffs on boards where larger sizing dramatically lifts villain's fold rate.

## Success criteria

After working through this lesson, you should be able to:

- Look at any EV-vs-sizing curve and name its prototype (Ridge / Plateau / Cliff / Ramp, or compound) within a second.
- Understand that compound labels indicate the curve sits between two prototypes, not that the classifier failed.
- Use the tag descriptively when talking through a hand — "this is a Ridge spot, peak around 0.75 pot" — without conflating the shape label with a strategic action recommendation.
- Recognize that the underlying EV computation (game tree evaluator) is what produces the curve; the Sizing Curve Tag is a presentation layer that summarizes the shape for table-speed reading.

The lesson does NOT teach you *which sizing to pick* in a given spot — that's downstream strategic work. It teaches you to *recognize* the shape of the sizing-EV curve when it appears in your replay surface.

## Drill spots

The following drill spots are authored for the future LessonRunnerView Deliberate and Discover variants (per `docs/design/surfaces/lesson-runner.md`). Each spot presents an EV array and asks which prototype it matches.

- **Spot 1.** EV-by-fraction: `[(0.25, 0.0), (0.5, 0.2), (0.75, 1.0), (1.0, 0.3), (1.5, 0.1)]`. Correct prototype: ridge. Reasoning: sharp peak at fraction 0.75 with monotone falloff on both sides; peak prominence dominates.

- **Spot 2.** EV-by-fraction: `[(0.25, 0.2), (0.5, 0.9), (0.75, 1.0), (1.0, 0.95), (1.5, 0.85), (2.0, 0.3)]`. Correct prototype: plateau. Reasoning: top three sizings (0.5/0.75/1.0/1.5) cluster within 15% of the peak — flat-topped shape with falloff only at the extremes.

- **Spot 3.** EV-by-fraction: `[(0.25, 1.0), (0.5, 0.7), (0.75, 0.4), (1.0, 0.1)]`. Correct prototype: cliff. Reasoning: monotone decreasing across all 4 sizings; peak at the smallest fraction.

- **Spot 4.** EV-by-fraction: `[(0.25, 0.0), (0.5, 0.3), (0.75, 0.6), (1.0, 1.0)]`. Correct prototype: ramp. Reasoning: monotone increasing across all 4 sizings; peak at the largest fraction.

- **Spot 5.** EV-by-fraction: `[(0.5, 1.0), (0.75, 1.0), (1.0, 1.0), (1.5, 1.0)]`. Correct prototype: plateau (degenerate flat). Reasoning: span below FLAT_EV_THRESHOLD — sizing has effectively no impact on EV, the entire curve is at the peak.

- **Spot 6.** EV-by-fraction: `[(0.25, 0.0), (0.5, 0.5), (0.75, 1.0), (1.0, 0.5), (1.5, 0.0)]`. Correct prototype: ridge or compound (ridge+plateau). Reasoning: symmetric tent shape — interior peak is sharp enough for ridge but the top region is wider than a thin spike. May classify as compound depending on calibration; either is a correct reading.

- **Spot 7.** EV-by-fraction: `[(0.25, 0.5), (0.5, 1.0), (0.75, 0.8), (1.0, 0.6), (1.5, 0.4), (2.0, 0.2)]`. Correct prototype: cliff (with a small initial rise). Reasoning: after the first ramp segment (0.25 → 0.5), the rest is a monotone drop covering 5/5 adjacent pairs — cliff dominates, with a minor compound risk against ramp on the very first pair.
