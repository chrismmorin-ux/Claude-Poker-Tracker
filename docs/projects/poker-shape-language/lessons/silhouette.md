---
descriptorId: silhouette
title: The 13×13 Alphabet — Range Silhouette
catalogPosition: 1
priorityTier: P0
surfaceEmbeds:
  - hand-replay-view
authoredAt: 2026-05-15
authoredAtSprint: SPR-082
authoredFor: WS-041
prototypes:
  - oval
  - barbell
  - triangle
  - comb
  - cloud
relatedDescriptors:
  - equity-distribution-curve
  - spire-polarization
  - contour-tree
versionLineage:
  version: 1
  authored_at: 2026-05-15
  amended_at: null
  amendment_reason: null
---

## Exposition

The Range Silhouette is the gestalt shape of a player's preflop range when you visualize it on the 13×13 hand grid. Five prototype shapes — **Oval**, **Barbell**, **Triangle**, **Comb**, **Cloud** — cover the geometries that show up at a live 1/2 table. Each prototype's underlying morphology has a one-word alias from the SLS Gate 2 roundtable: *condensed*, *polarized*, *linear*, *capped*, *merged*.

Recognizing the silhouette is a perception task, not a reading task. The 13×13 cell-by-cell weight grid is the underlying data; the silhouette is the at-a-glance pattern your eye and pattern-recognition pick up before you've read any individual cell. Reading the heatmap takes seconds; reading the silhouette takes a fraction of a second.

The five prototypes are *descriptive labels*, not *strategic prescriptions*. A villain with a Triangle range isn't "better" or "worse" than one with a Barbell range — they're playing differently. Strategic decisions still derive from equity, pot odds, SPR, and players-remaining; the silhouette is a label that helps you describe what you're looking at, faster.

When the math is ambiguous — two prototype shapes fit the input nearly equally well — the classifier reports a **compound** label (e.g., `barbell + cloud`). This is the principled response: a flipping single-label classifier (Barbell one frame, Cloud the next, as the range shifts incrementally) is worse than a stable compound. Compound is not failure; it's honest reporting that the range sits between two named shapes.

## Worked example

Five canonical glyphs — one per prototype. Each example range is illustrative; real player ranges in your data may differ in weight magnitudes but the silhouette shape persists.

**1. Oval (condensed) — UTG-style tight open.**
Range: `66+, A9s+, A5s, KTs+, QTs+, JTs, T9s, 98s, AQo+`. Mass clusters at the strong corner (premium pairs + premium broadways). The silhouette is a compact oval — small footprint, high density at the top. Where you'll see this: tight early-position opens, conservative range constructions, full-stack early-tournament-stage play.

**2. Barbell (polarized) — value + bluffs 3-bet range.**
Range: `AA, KK, QQ, AKs, AKo, A5s, A4s, A3s, A2s, 76s, 65s, 54s`. Two clusters: premium value at top-right (AA-QQ, AKs, AKo), speculative bluffs at suited-connectors and suited-low-aces. The middle (KQ, AJ, KJ, AT-A6) is empty. Where you'll see this: solver-derived 3-bet ranges, polarized 4-bet defenses, and players who consciously construct two-mode ranges for board-coverage reasons.

**3. Triangle (linear) — BTN-style steal range.**
Range: BTN GTO open (`22+, A2s+, K2s+, Q2s+, J6s+, T6s+, 96s+, 85s+, 75s+, 64s+, 53s+, 43s, 32s, A2o+, K7o+, Q8o+, J8o+, T8o+, 97o+, 87o, 76o`). Mass forms a wedge from the strong corner, tapering monotonically down to weak suited connectors. Continuous, no gaps. Where you'll see this: late-position opens, wide cold-calls in deep-stack cash games, recreational "play a lot of hands" stylings.

**4. Comb (capped) — suited-aces-only flat call from SB.**
Range: `A2s, A3s, A4s, A5s, A6s, A7s, A8s, A9s, ATs, AJs, AQs, AKs`. Mass concentrated in one row of the suited triangle; offsuit triangle is empty. The silhouette looks like a comb: tall vertical strokes against an empty background. Where you'll see this: niche cold-call constructions, suited-trapping ranges, and players whose flop play is suited-only by preference.

**5. Cloud (merged) — recreational 50%-of-hands caller.**
Range: a random or near-uniform half of the 13×13 grid with mass scattered across all rank-sum levels. Mass is diffuse, no dominant cluster, no clear cutoff. Where you'll see this: recreational players who "play any two suited", loose passive callers, players whose action-frequency is much more about VPIP than hand selection.

## Success criteria

After working through this lesson, you should be able to:

- Look at any villain range matrix and name its silhouette prototype (or compound, if ambiguous) within a second.
- Understand that compound labels indicate the range sits between two named shapes, not that the classifier is broken or uncertain.
- Use the silhouette descriptively when talking through a hand — "their range looked like a Barbell with bluffs at A2s-A5s and 76s-54s" — without confusing the label with a strategic recommendation.
- Recognize that the silhouette is the visual / pattern-recognition layer; the underlying merge-tree machinery (Range Contour Tree, advanced descriptor #2 in the catalog) is what computes the classification, and is exposed separately in study mode for deeper analysis.

The lesson does NOT teach you which silhouette to *adopt* for your own play — that's downstream strategic work. It teaches you to *recognize* silhouettes when they appear in your or your opponents' ranges.

## Drill spots

The following drill spots are authored for the future LessonRunnerView Deliberate and Discover variants (per `docs/design/surfaces/lesson-runner.md`). Each spot presents a range and asks which silhouette prototype it matches.

- **Spot 1.** Range: "66+, A9s+, A5s, KTs+, QTs+, JTs, T9s, 98s, AQo+". Correct prototype: oval. Reasoning: tight UTG open — small range, concentrated at the strong corner, no bluff cluster, continuous wedge from the top down to the cutoff.

- **Spot 2.** Range: "AA, KK, QQ, AKs, AKo, A5s, A4s, A3s, A2s, 76s, 65s, 54s". Correct prototype: barbell. Reasoning: two clusters with a gap — premium value at top (AA-QQ + AKs/AKo) and speculative bluffs at the bottom (low suited aces + small suited connectors), nothing in the middle (no AJ, KQ, AT, KJ).

- **Spot 3.** Range: "22+, A2s+, K2s+, Q2s+, J6s+, T6s+, 96s+, 85s+, 75s+, 64s+, 53s+, 43s, 32s, A2o+, K7o+, Q8o+, J8o+, T8o+, 97o+, 87o, 76o". Correct prototype: triangle. Reasoning: wide BTN open — mass forms a continuous wedge from the strong corner down to the weakest suited connectors, no gaps, monotonically tapering.

- **Spot 4.** Range: "A2s, A3s, A4s, A5s, A6s, A7s, A8s, A9s, ATs, AJs, AQs, AKs". Correct prototype: comb. Reasoning: suited-only range with no pairs and no offsuit cells — the silhouette is a single vertical row in the suited triangle, all other rows and the offsuit half are empty.

- **Spot 5.** Range: "A2s, A3s, A4s, A5s, JTs, T9s, 98s, 87s, 76s, 65s, 54s, 43s, 32s". Correct prototype: comb. Reasoning: suited-aces + suited-connectors construction — entirely suited cells, no pairs, no offsuit. Visually two strokes in the suited triangle (the Ax row and the connector diagonal).

- **Spot 6.** Range: "uniform-50pct". Correct prototype: cloud. Reasoning: diffuse mass with no concentration anywhere, premium fraction barely above the universe average, very high entropy, no clear wedge or cluster. Recreational-player merged range. (This spot's range is a special token, not a poker-notation string — the renderer constructs the uniform 0.5 grid programmatically.)

- **Spot 7.** Range: "TT+, AKs, AKo, AQs, AQo, KQs". Correct prototype: oval. Reasoning: very tight premium-only open — mass entirely at top-right corner of the grid, low spread, high concentration, monotonic wedge with no gaps below the cutoff.
