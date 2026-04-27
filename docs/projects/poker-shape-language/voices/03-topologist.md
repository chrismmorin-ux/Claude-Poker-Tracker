# Topologist: Shape-descriptor proposals

## Where my lens points

My first question is always: *what is the underlying space, and what structure does it actually carry?* Before we call something a "saddle" I need a smooth (or at least C²) function on a manifold and a critical point with a non-degenerate Hessian of mixed signature. Before we call something a "basin" I need a Lyapunov-like function and ideally a flow whose ω-limit set is the alleged attractor. Before we call the 13×13 range matrix "Euclidean" I need to ask what the metric is — because combinatorially it is a *graph* (edges along rank or suitedness), not ℝ¹³² with the Frobenius norm. Loose language is fine as pedagogy, but it becomes dangerous the moment the owner starts reasoning *from* the metaphor: e.g., computing "gradients" on a lattice where gradient is undefined, or expecting continuity across a board-texture transition that is genuinely a stratification boundary.

## Rigor-check on the 5 seeds

**1. Range geometry on 13×13 (oval / barbell / triangle).** The 13×13 matrix is **not a manifold**. It is a product of two totally ordered finite sets (rank × rank) with a Z/2 fold identifying (i,j) suited-vs-offsuit cells. "Oval" is a visual Gestalt, not a topological object. The correct term is **weighted subset of a finite poset**, and the useful invariants are (a) **support** (which cells are non-zero), (b) **sublevel-set filtration** by weight (which recovers a persistence diagram over a discrete filtration), and (c) **connectedness in the rank-adjacency graph** (does the range form a single "blob" or multiple components?). "Barbell" specifically is a claim that Betti-0 of the weight-thresholded range is 2 and that the two components are separated in rank — a testable, falsifiable claim.

**2. Equity saddle surface over (board texture × hero holding).** This is the most abused metaphor in the seed list. "Board texture" is not a differentiable variable — it is a categorical projection of a 3–5-card combinatorial object onto a low-dimensional feature space (wet/dry, connectedness, paired). You cannot take a Hessian across "wetness." What you *can* do: fix a board, vary one hero holding along a continuous parameter (e.g., kicker rank as ordinal), and look at equity as a function. Even then, equity over the holding-space is piecewise-constant on a finite set, so "saddle" requires smoothing or embedding. The honest object here is a **bifibration**: equity is a function on the total space of a bundle whose base is the stratified space of boards and whose fiber over each board is the 1326-combo simplex. **Saddles can exist fiber-wise** (equity-vs-bet-size for a fixed board), not across the base.

**3. EV-ridge over bet-size.** A 1D function has maxima, minima, and inflection points — it does **not** have ridges or saddles. A ridge requires ≥2 parameters where the function is a local max along one direction and regular (or a longer plateau) along the orthogonal. If we add a second axis (say, bet-size × villain-fold-aggressiveness, or bet-size × board-runout), *then* "ridge" becomes meaningful: a 1-dimensional submanifold of local maxima in the 2D parameter plane. Without the second axis, the right word is **mode** or **local maximum**, and the right descriptor is the **graph of EV(b)** with its critical points and their indices.

**4. Stacked preflop→flop→turn→river ranges with narrowing edges.** This is actually the cleanest case for rigorous topology. Each action induces a Bayesian restriction map on the combo simplex; stacking streets yields a **filtration** (or more precisely, a sequence of inclusions of supports running *backwards* — ranges only shrink under conditioning). This is exactly the setup for **persistent homology over a filtration**: which combo-clusters are born, which die as conditioning tightens, and what is the persistence of each feature? ([Ravishanker & Chen 2021](https://wires.onlinelibrary.wiley.com/doi/abs/10.1002/wics.1548); [arXiv:2405.04796](https://arxiv.org/abs/2405.04796).)

**5. Flop→turn equity basin-landscape with nuts/brick/villain-nuts as attractors.** "Attractor" presupposes a **dynamical system** — a flow or a map iterating in time. Street-to-street is a one-step stochastic transition, not a flow, and "villain nuts" isn't a fixed point of any dynamics we've written down; it's a *terminal state* of a random walk over runouts. The correct framing is a **random walk on the equity distribution** where nuts/brick are **absorbing states** of a Markov chain, not basins of a gradient descent. The *landscape* metaphor is salvageable if we replace it with a **potential function** (e.g., −log P(reach nuts | current state)), in which case "basin of attraction" is well-defined for the gradient flow of that potential.

## Proposals

### 1. Range Persistence Diagram (street-filtered)
- **Definition (one line):** The persistence diagram of the sublevel-set filtration of villain's weighted combo-measure as conditioning tightens across streets.
- **Mathematical object:** A persistence module over the filtration {R_preflop ⊇ R_flop ⊇ R_turn ⊇ R_river}, with birth/death pairs in the product order.
- **What it describes:** Which *hand-clusters* (e.g., "broadway offsuit", "middling pairs") survive narrowing, which die early. A cluster with long persistence is a durable read; one that dies on the flop was a preflop illusion.
- **Visual form:** A persistence diagram (birth on x-axis = street-of-appearance; death on y-axis = street-of-elimination) with diagonal = ephemeral; far-off-diagonal = structurally important.
- **Data source in-codebase:** Per-combo weights at each street from the Bayesian range engine; hand-clusters as a pre-specified cover of the 1326 combos.
- **Self-rating:** precision 5 / legibility 3 / data coverage 5 / uniqueness 5
- **Prior art / citation:** Persistent homology of time-indexed measures ([Ravishanker 2021](https://wires.onlinelibrary.wiley.com/doi/abs/10.1002/wics.1548); [Frontiers in Physics TDA markets paper](https://www.frontiersin.org/journals/physics/articles/10.3389/fphy.2021.572216/full)).

### 2. Morse–Bott Decomposition of the EV(bet-size, villain-type) Surface
- **Definition (one line):** The critical set of EV over the 2D parameter (bet-fraction × villain-calling-frequency), stratified by Morse index.
- **Mathematical object:** Morse–Bott function on a compact 2-manifold-with-boundary; critical set = 1-dim submanifolds (ridges of optimal sizing) + isolated saddles (indifference points between value-bet and bluff-catch regimes).
- **What it describes:** The *shape* of the exploit surface: where a small change in villain-type produces a cliff in optimal sizing (index-1 saddle = decision knife-edge) vs where it is robust (Morse-Bott ridge = wide plateau of near-optimal sizes).
- **Visual form:** 2D heatmap with overlaid critical-manifold curves color-coded by index.
- **Data source in-codebase:** Existing EV-curves across bet sizes; villainDecisionProfile parameterization.
- **Self-rating:** precision 5 / legibility 4 / data coverage 4 / uniqueness 4
- **Prior art / citation:** [Morse-Bott theory](https://en.wikipedia.org/wiki/Morse_theory); [Akhtiamov et al. on loss-landscape Morse structure](https://proceedings.mlr.press/v197/akhtiamov23a.html).

### 3. Fiber-Bundle over Board-Texture Strata
- **Definition (one line):** The decision problem as a fibered stratified space: base = poset of board-texture strata, fiber = hero-range simplex, with singularities at stratum boundaries (paired / three-flush / four-straight transitions).
- **Mathematical object:** Thom–Mather stratified space; advice is a section of the bundle that may be **discontinuous across strata** but smooth within each.
- **What it describes:** Why advice *should* jump when a turn card pairs the board — it is crossing a stratum boundary, not a bug. Explains the difference between smooth recalibration (within-stratum) and regime change (cross-stratum).
- **Visual form:** A dendrogram of textures with fiber-cards at each leaf showing intra-stratum advice surfaces.
- **Data source in-codebase:** Board texture classification + per-texture tendency statistics.
- **Self-rating:** precision 5 / legibility 2 / data coverage 4 / uniqueness 5
- **Prior art / citation:** [Thom–Mather stratified spaces](https://en.wikipedia.org/wiki/Topologically_stratified_space); [Towards Stratified Space Learning (2025)](https://link.springer.com/article/10.1007/s44007-025-00183-9).

### 4. Hand Trajectory as Path in Combo-Simplex (with homotopy class)
- **Definition (one line):** A played hand is a continuous path from the preflop range to a singleton combo; its homotopy class relative to the stratification is the hand's "line."
- **Mathematical object:** Path in the fibered stratified space of §3; homotopy class relative to the terminal strata.
- **What it describes:** Two hands with identical actions but different board-texture transitions are in *different homotopy classes* — a mathematically precise formalization of "same line, different story."
- **Visual form:** Sankey-like trajectory overlaid on the stratified base.
- **Data source in-codebase:** Hand timelines + board-texture labels per street.
- **Self-rating:** precision 4 / legibility 3 / data coverage 5 / uniqueness 4
- **Prior art / citation:** Path-space and homotopy in TDA ([Wikipedia TDA overview](https://en.wikipedia.org/wiki/Topological_data_analysis)).

## Where loose metaphor is acceptable vs where it's harmful

"Basin" as pedagogy is fine: it conveys "states that flow toward an outcome" even without a literal gradient flow, and the cost of imprecision is only a footnote. **"Saddle" is dangerous** — it implies a quantitative curvature claim (mixed-sign Hessian, index-1 critical point) that the owner will, reasonably, extrapolate into "small moves in one direction help, small moves in the other hurt." If the underlying function is piecewise-constant or discontinuous, that extrapolation is false, and the owner will trust advice that doesn't exist. Likewise **"manifold" over a stratified space** hides the exact phenomenon that makes poker interesting: the *discontinuities* (paired board, four-flush, all-in threshold) are not bugs — they are the strata. Erasing them erases the structure. The rule: metaphors that overstate *smoothness* are the harmful ones; metaphors that overstate *flowy-ness* (basin, ridge in 1D) are usually harmless.

## What I'd most want another persona to pressure-test

The **stratified-space / fiber-bundle** proposal. It is mathematically the right object but cognitively the most demanding. I want the cognitive-science or UX voice to tell me whether the human owner can *see* strata at the table, or whether we need to collapse the fiber-bundle picture into something more ergonomic (e.g., "texture card flip") that preserves the discontinuity intuition without the category theory. If we can't make stratification legible, I'd rather give up the formalism than ship a descriptor nobody uses.

---

Sources consulted:
- [Persistent homology for time series (Ravishanker & Chen, WIREs 2021)](https://wires.onlinelibrary.wiley.com/doi/abs/10.1002/wics.1548)
- [Persistent homology of featured time series (arXiv 2405.04796)](https://arxiv.org/abs/2405.04796)
- [TDA and financial market phase shifts (Frontiers in Physics 2021)](https://www.frontiersin.org/journals/physics/articles/10.3389/fphy.2021.572216/full)
- [Morse theory (Wikipedia)](https://en.wikipedia.org/wiki/Morse_theory)
- [Connectedness of loss landscapes via Morse theory (Akhtiamov et al., PMLR 2023)](https://proceedings.mlr.press/v197/akhtiamov23a.html)
- [Thom–Mather stratified space (Wikipedia)](https://en.wikipedia.org/wiki/Topologically_stratified_space)
- [Towards Stratified Space Learning (La Matematica, 2025)](https://link.springer.com/article/10.1007/s44007-025-00183-9)
- [Topological data analysis (Wikipedia)](https://en.wikipedia.org/wiki/Topological_data_analysis)
