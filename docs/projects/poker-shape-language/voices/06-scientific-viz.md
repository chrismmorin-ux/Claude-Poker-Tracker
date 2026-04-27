# Scientific Visualization Specialist: Shape-descriptor proposals

## Where my lens points

When I see poker data, I ask: where is the scalar field, where are the critical points (maxima, minima, saddles), what is the topology of the level sets, and what is the cheapest rendering that preserves that topology? I don't trust a pretty render — I trust a render whose visual features correspond to mathematically-defined structural features (peaks, ridges, basins, persistence). On a 1600×720 mobile glance-read, my bias is toward **topology-preserving abstractions** (contour trees, Reeb graphs, persistence barcodes) over **sample-faithful renders** (volume rendering, raw 3D surfaces) — because the abstraction is legible at 200×200 px; the render is not.

## Structural parallels between poker data and scientific data I've rendered

The weighted 13×13 range matrix is a **2D discrete scalar field on a lattice** — topologically identical to a 2D CFD pressure slice or an MRI slab. Per-combo equity across the board-runout space is a **high-dimensional scalar field** that, conditioned on board texture, reduces to a 2D field over (hero-holding × villain-holding-class) — exactly the regime the Morse-Smale complex was built for. EV-vs-bet-size is a **1D function with a single critical point** (the optimal sizing), naturally a horizon-plot target. Hand timelines are **trajectories through a decision state space** — streamlines, essentially. Bayesian credible intervals on villain stats are an **uncertainty field** identical in structure to climate-ensemble forecasts. Flop→turn equity evolution is a **time-varying scalar field over a combinatorial domain** — the same data type as unsteady flow.

## Techniques that transfer (and don't) to mobile poker UX

**Transfer well (mobile-viable):**
- Contour trees / merge trees as abstracted topology summaries ([Heine et al. 2016](https://geovis.umiacs.io/publication/heine-2016-topology/heine-2016-topology.pdf))
- Horizon plots for stacked 1D functions ([Cubism.js](https://square.github.io/cubism/), [Perin et al. IHG](https://www.aviz.fr/Research/IHG))
- Persistence barcodes for "how many real features survive at threshold X" ([Ghrist 2008](https://www2.math.upenn.edu/~ghrist/preprints/barcodes.pdf))
- Glyph-based encoding with sortable shape primitives ([Chung et al. Glyph Sorting](https://people.cs.nott.ac.uk/blaramee/research/glyphDesign/sorting/chung13glyphSorting.pdf))
- Perceptually uniform colormaps — Viridis / Cividis, colorblind-safe ([Viridis](https://cran.r-project.org/web/packages/viridis/vignettes/intro-to-viridis.html))
- Small multiples of identical-scaffold panels

**Do NOT transfer (kill on mobile):**
- Volume rendering (occlusion + rotation = cognitive load, useless at 200 px)
- Raw LIC vector-field textures (beautiful, unreadable at thumbnail scale)
- 3D Morse-Smale complex rendering (only the 2D projection survives)
- Parallel coordinates with more than ~4 axes (crossing clutter)
- Streamline bundling in 3D (the owner's "stacked ranges with narrowing" works in 2D only)

## Proposals (2-4 descriptors, mobile-viable SciViz-grounded)

### Range Contour Tree ("range skeleton")
- **Definition (one line):** The merge tree of the weighted 13×13 range matrix, drawn as a small dendrogram beside the matrix.
- **What it describes:** How many *distinct weight-clusters* the range contains, how they merge as you lower the weight threshold, and the persistence of each cluster. This answers "is the range a polarized barbell, a linear tilt, a condensed core, or noise?"
- **Visual form:** Merge tree / contour tree ([TTK](https://topology-tool-kit.github.io/)) — a small 60×80 px dendrogram where leaves = local maxima of weight, internal nodes = saddle-joins, leaf height = persistence. Paired with a viridis 13×13 matrix.
- **Why this technique:** The merge tree captures *exactly* the question a player is asking ("is this range really bimodal or is it just two blobs of noise?") because persistence filters noise automatically. Two ranges that render identically as heatmaps can have radically different merge trees.
- **Mobile viability:** Extremely high. Merge tree is a tiny 2D diagram; it was literally invented for print-scale analysis.
- **Data source in-codebase:** Weighted 13×13 range matrix (rangeEngine output).
- **Self-rating:** precision 5 / legibility 4 / data coverage 4 / uniqueness 5
- **Prior art / citation:** [Heine et al., A Survey of Topology-based Methods in Visualization](https://geovis.umiacs.io/publication/heine-2016-topology/heine-2016-topology.pdf); [TTK Topology ToolKit](https://topology-tool-kit.github.io/); merge trees for 2D scalar fields ([Carr et al.](https://link.springer.com/chapter/10.1007/978-3-540-33265-7_6)).

### EV Horizon Strip
- **Definition (one line):** A horizon-plot band showing EV as a function of bet size, one row per street (flop/turn/river), stacked.
- **What it describes:** Where the EV ridge peaks, how sharp it is, and how the optimum shifts street-by-street.
- **Visual form:** Horizon plot with 2 bands (positive / negative EV), 12–16 px tall per street ([Cubism.js](https://square.github.io/cubism/) convention).
- **Why this technique:** Horizon graphs allocate `S/N·2·B` pixels per graph and dominate small-multiples line charts for small vertical space — Perin et al. showed B=2 is optimal in cramped layouts ([Interactive Horizon Graphs](https://www.aviz.fr/Research/IHG)). Exactly the regime of a mobile sidebar.
- **Mobile viability:** Optimal. Horizon plots were designed for this exact constraint (many metrics, few vertical pixels).
- **Data source in-codebase:** Game-tree EV-curves across bet sizes, already computed per street in gameTreeEvaluator.
- **Self-rating:** precision 4 / legibility 5 / data coverage 3 / uniqueness 4
- **Prior art / citation:** [Heer, Kong, Agrawala — Sizing the Horizon](https://idl.cs.washington.edu/files/2009-HorizonGraph-CHI.pdf); [Cubism.js](https://square.github.io/cubism/); [Perin et al. IHG](https://www.aviz.fr/Research/IHG).

### Equity Basin Map (Morse-Smale Cells on Board Texture × Hero Holding)
- **Definition (one line):** A 2D Morse-Smale cell decomposition of per-combo equity, over (board-texture axis × hero-holding axis), drawn as a colored region map with ridge/valley lines overlaid.
- **What it describes:** The "equity landscape" — which holdings are *attractors* (local maxima) on a given texture class, which are *saddles* (ambiguous — blocker-dependent), and which are *basins* (dominated). Directly answers the seed "flop→turn equity basin with attractors."
- **Visual form:** Morse-Smale complex rendering — filled 2-cells (basins), 1-cells (ridges as dark lines), 0-cells (peaks as dots). Thumbnail-scale (120×120 px).
- **Why this technique:** Morse-Smale complexes preserve the gradient structure of a scalar field and partition the domain into piecewise-monotonic regions ([Gyulassy 2008](https://www.cs.jhu.edu/~misha/ReadingSeminar/Papers/Gyulassy08.pdf)). Equity *is* a gradient structure (EV flows toward the peak). The cell boundaries have direct poker meaning: ridges = "this holding is at the boundary of dominating/dominated."
- **Mobile viability:** Good in 2D projection. Full 3D MS-complex is mobile-hostile; the 2D cell map is a static colored diagram with dark ridge lines.
- **Data source in-codebase:** Per-combo equity distributions + boardTexture classification.
- **Self-rating:** precision 5 / legibility 3 / data coverage 5 / uniqueness 5
- **Prior art / citation:** [Gyulassy, A Practical Approach to Morse-Smale Complex Computation](https://www.cs.jhu.edu/~misha/ReadingSeminar/Papers/Gyulassy08.pdf); [Topological Landscape Ensembles (Harvey et al.)](https://www.researchgate.net/publication/220505854_Topological_Landscape_Ensembles_for_Visualization_of_Scalar-Valued_Functions).

### Villain Stat Persistence Barcode
- **Definition (one line):** A horizontal barcode where each bar = a behavioral stat, length = posterior credible-interval width, darkness = magnitude, ordered by persistence (most robust on top).
- **What it describes:** Which villain stats are *stable reads* (narrow intervals, high persistence) vs *noise* (wide intervals, will disappear at tighter confidence). Directly encodes sample-size uncertainty.
- **Visual form:** Persistence barcode ([Ghrist 2008](https://www2.math.upenn.edu/~ghrist/preprints/barcodes.pdf)) — 10–15 stacked horizontal bars, 6 px tall each.
- **Why this technique:** Barcodes were designed to show *which features survive scale change* — exactly the question Bayesian credible intervals answer for behavioral stats. Stable reads have long bars; noisy ones are short. One glance tells you what to trust.
- **Mobile viability:** Extremely high. Barcode format was designed for static journal figures at small scale.
- **Data source in-codebase:** Bayesian credible intervals on villain tendency stats (already computed in bayesianConfidence.js).
- **Self-rating:** precision 4 / legibility 5 / data coverage 4 / uniqueness 4
- **Prior art / citation:** [Ghrist, Barcodes: The Persistent Topology of Data](https://www2.math.upenn.edu/~ghrist/preprints/barcodes.pdf); [Bubenik, Persistence Landscapes](https://www.jmlr.org/papers/volume16/bubenik15a/bubenik15a.pdf).

## Critique of the seeds — which SciViz technique would I use for each

1. **Range geometry on 13×13 (oval/barbell/triangle):** The seed is right in spirit but underspecified — "oval" is not a mathematical object. The correct tool is the **contour tree / merge tree** of the weighted matrix (proposal 1 above). Oval = 1 leaf, barbell = 2 leaves with long joining edge, triangle = 1 leaf with asymmetric saddle structure. Don't eyeball shapes — compute the tree.
2. **Equity saddle surface over (board × hero):** Correct intuition, wrong rendering. A literal 3D saddle is mobile-hostile. The same data is legible as a **Morse-Smale cell map** (proposal 3) — you still see the saddle (it's the 1-cell between two basins) but in 2D.
3. **EV-ridge over bet-size:** One-dimensional function, one critical point. A ridge render is overkill; a **horizon plot** (proposal 2) gives you the peak location, width, and street-by-street shift in a fraction of the pixels.
4. **Stacked preflop ranges with narrowing edges:** The owner is describing a **Sankey diagram with uncertainty bands**, not a SciViz object. LIC and streamline bundling are wrong here — too dense, no critical-point structure to preserve. Use a simple flow diagram with band width = range size and transparency = confidence. SciViz has nothing special to contribute.
5. **Flop→turn equity basin-landscape with attractors:** This IS a Morse-Smale complex ([Gyulassy 2008](https://www.cs.jhu.edu/~misha/ReadingSeminar/Papers/Gyulassy08.pdf)), and the "attractors" are literally the 0-cells (local maxima). The owner has independently reinvented 40 years of topology-based viz. Render it as proposal 3.

## What I'd most want another persona to pressure-test

Two things. First: **are merge trees and Morse-Smale complexes legible to a non-scientist in 2 seconds?** I'm biased toward mathematically correct abstractions; a cognitive-science or UX persona may show me that a "barbell" pictogram — while imprecise — is actually faster to read than a dendrogram, and that the right answer is a hybrid (pictogram foreground, merge tree on long-press). Second: **does the persistence barcode survive when a player has 40 stats, each with a different natural scale?** Normalizing CI width across VPIP (0–1), aggression frequency (0–∞), and sizing tells (categorical) is non-trivial, and a statistician persona may find that the barcode leaks its perceptual uniformity under heterogeneous stat types — in which case we need a glyph-based alternative ([Chung et al.](https://people.cs.nott.ac.uk/blaramee/research/glyphDesign/sorting/chung13glyphSorting.pdf)) instead.
