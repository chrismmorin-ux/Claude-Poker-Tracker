# Solver Cartographer: Shape-descriptor proposals

## Where my lens points

I live inside aggregate reports, EV grids, and frequency trees. The vocabulary pros already read fluently is narrow: 13x13 matrices, equity-distribution curves ("hockey stick" vs "diagonal"), manhattan graphs of flop-by-flop frequencies, and color-graded runout strips. The owner's seed list conflates things that already have names (polarized barbell, condensed oval) with things that are genuinely novel (basin-landscapes across streets). My job is to name what's named, flag what's conventionally rendered differently, and point at the two or three shapes pros *want* but nobody draws well — especially anything that crosses a *street boundary* or couples *villain-profile uncertainty* to board geometry. Those are the unfilled gaps.

## Proposals

### Equity-distribution curve (the "hockey stick")

- **Definition (one line):** Sorted per-combo equity plotted against range percentile, hero vs villain overlaid on the same axes.
- **What it describes:** Shape of a range's strength distribution — linear (diagonal), polarized (low flat + vertical tail = hockey stick), condensed (high flat), capped (plateau with no upper tail).
- **Visual form:** 2D line chart, X = range percentile 0-100%, Y = equity 0-100%, two curves. The *gap* between curves = range advantage; the *tail separation* at the top 10% = nut advantage.
- **Data source in-codebase:** `computeComboEquityDistribution()` already emits per-combo equity for both hero and villain ranges at depth-1. Sort descending, plot.
- **Self-rating:** precision **5** (it IS the range, not a proxy) / legibility **5** (pros read these instantly) / data coverage **5** (we already compute it) / uniqueness **1** (every serious solver renders this — PeakGTO, PocketSolver, GTO Wizard all ship it).
- **Prior art:** [GTO Wizard — Interpreting Equity Distributions](https://blog.gtowizard.com/interpreting-equity-distributions/); [PocketSolver equity chart](https://www.pocketsolver.com/); [Upswing — Equity Distribution](https://upswingpoker.com/equity-distribution/). This is the single most-used shape in modern solver study.

### Range-morphology glyph on 13x13 (owner's seed #1, renamed and precise)

- **Definition (one line):** Four canonical silhouettes on the 13x13 matrix — **linear wedge** (top-left triangle filled gradient), **polarized barbell** (top-left cluster + scattered bluff pixels bottom-right), **condensed oval** (dense oval around the AK/QQ-TT region), **capped plateau** (filled block truncated at the upper-right edge).
- **What it describes:** Range *morphology* — the established pro term. GTO Wizard has published articles literally titled "Preflop Range Morphology" and "Range Morphology" using exactly these four labels.
- **Visual form:** Standard 13x13 grid with weight-intensity fill; the *silhouette* (not the cell values) is the descriptor.
- **Data source in-codebase:** `rangeEngine/` weighted 13x13 matrices. Add a classifier: `classifyMorphology(matrix) -> {linear|polarized|merged|condensed|capped, confidence}`.
- **Self-rating:** precision **4** (morphology is a real axis but shape categories are fuzzy at the edges) / legibility **5** (every Flopzilla/GTO Wizard user reads 13x13 instantly) / data coverage **5** / uniqueness **2** (the matrix is universal; the silhouette-as-label is *almost* novel — pros talk about morphology but nobody ships a one-glance silhouette classifier).
- **Prior art:** [GTO Wizard — Preflop Range Morphology](https://blog.gtowizard.com/preflop-range-morphology/); [GTO Wizard — Range Morphology](https://blog.gtowizard.com/range-morphology/); [Flopzilla matrix viewer](https://www.flopzilla.com/); [SplitSuit — range shapes 5%/30%](https://www.splitsuit.com/poker-ranges-reading). The owner's "oval/barbell/triangle" vocabulary maps cleanly onto these. Rename seed #1 to **morphology glyph** and adopt the four-term taxonomy.

### Runout-cluster strip (the "manhattan bar")

- **Definition (one line):** All 49 turn cards (or 1755 flops) laid out as a sorted horizontal strip, each column a card, height/color = frequency or EV of a chosen action.
- **What it describes:** How hero's strategy fragments or clusters across runouts — which turn cards collapse into "same plan," which are outliers. Directly answers "what cards change the plan?"
- **Visual form:** Horizontal bar chart, cards sorted by the plotted metric, color-banded by cluster membership (runout clustering groups strategically-equivalent cards). GTO Wizard calls the interactive version the **manhattan graph**.
- **Data source in-codebase:** Not yet computed — we'd need to solve or estimate strategy per turn card. Depth-2 game tree on each of 49 turns is feasible but expensive. A cheap proxy: equity-vs-villain-range per turn, already computable from `computeComboEquityDistribution()` rolled forward one street.
- **Self-rating:** precision **4** (cluster boundaries are solver-dependent) / legibility **4** (pros read manhattan graphs fluently; non-pros find them dense) / data coverage **2** (we'd need to extend to per-turn solves) / uniqueness **1** (standard in GTO Wizard, Poker Scientist pioneered the clustering).
- **Prior art:** [GTO Wizard — Aggregate Reports](https://help.gtowizard.com/aggregate-reports-guide/) (the "manhattan graph" at the bottom of the page); [Poker Scientist — Runouts Clustering](https://intercom.help/poker-scientist/en/articles/4732981-runouts-clustering); [GTO+ turn/river aggregate reports](https://www.gtoplus.com/turnriver/).

### Stacked range-narrowing ribbon (owner's seed #4, genuinely under-rendered)

- **Definition (one line):** Preflop ranges for each seat (UTG through BB) stacked vertically as 13x13 silhouettes with edges connecting consecutive positions, edge thickness = combos retained after the position's action filter.
- **What it describes:** How the range *narrows* as action folds around — a Sankey-like flow across positions. Pros visualize this mentally but no mainstream tool draws it.
- **Visual form:** 9 stacked mini-matrices (or silhouettes) + a Sankey flow between them; the narrowing edges are the novel bit.
- **Data source in-codebase:** Position-conditioned range profiles (`rangeProfiles` IndexedDB store + `rangeEngine/`). We already have per-position opening ranges; we do not yet have the *flow* computed (combos in seat N's range that survive to seat N+1's action).
- **Self-rating:** precision **4** (flow semantics need care: "survive" means what — didn't-fold? didn't-3bet?) / legibility **3** (Sankey diagrams are cognitively heavier than solver users expect) / data coverage **3** (need to compute transition ranges per action) / uniqueness **5** (I haven't seen this shipped anywhere — GTO Wizard shows position ranges *separately*; nobody connects them with a flow visual).
- **Prior art:** Closest analog is GTO Wizard's position-by-position preflop chart switcher, which is *discrete*, not a flow. No direct prior art for the ribbon rendering. ([GTO Wizard preflop ranges by position](https://blog.gtowizard.com/preflop-range-morphology/) — discrete, not connected.)

## Critique of the seeds

**Seed #1 (range geometry on 13x13)** is strong but misnamed — rename to **morphology glyph** and adopt the four-canonical-silhouette taxonomy (linear/polarized/condensed/capped/merged) pros already use. "Oval/barbell/triangle" are fine colloquial labels but will cost precision against existing literature.

**Seed #2 (equity saddle surface over board texture x hero holding)** is beautiful but I'm skeptical. A saddle surface implies a continuous 2D parameterization of *board texture*, and texture is fundamentally discrete/categorical (dry-paired, wet-connected, etc.). What pros actually render is (a) equity vs a single runout axis as a bar or (b) an EV grid with texture classes on one axis. A saddle surface risks being beautiful-but-unreadable — the central failure mode the owner explicitly warned against.

**Seed #3 (EV-ridge over bet-size)** is strong and already exists in GTO+/GTO Wizard's dynamic sizing output as a 1D EV curve over sizing. Calling it a "ridge" adds nothing unless we're plotting EV(sizing) x (some second axis) — in which case the second axis is what matters and needs naming. As drawn it's just an **EV-sizing curve**.

**Seed #4 (stacked preflop ranges with narrowing edges)** is the most novel thing on the list. Nobody ships this. Keep it, formalize the "narrowing edge" semantics.

**Seed #5 (flop->turn equity basins with attractors)** is the most speculative. "Basin-landscape with nuts/brick/villain-nuts as attractors" is a compelling metaphor but borrows from dynamical-systems vocabulary in a way that may not survive first contact with actual data. I'd want to see one worked example before committing. If it works, it's genuinely new; if it doesn't, it's the classic trap of a shape that's memorable but not accurate.

## What I'd most want another persona to pressure-test

Three things I suspect but can't verify alone:

1. **Is the morphology glyph classifier stable?** If I show a player the same situation twice with slightly different villain stats, does the classifier flip between "polarized" and "merged"? A behavioral-science persona should stress-test whether the categories *feel* stable under real-world input noise.
2. **Does the narrowing ribbon actually teach anything the per-position matrix doesn't?** A pedagogy/UX persona should challenge whether the flow visual adds signal over just scrolling through 9 matrices — especially for a non-technical owner at a live table.
3. **Can seed #5's basin metaphor be grounded?** A mathematician/topology persona should say whether "attractor" has a defensible definition here (local maxima of expected equity retention across runouts?) or whether it's metaphor-all-the-way-down. If the latter, kill it — the owner's own rule is "beautiful but unreadable = failure."

Sources:
- [GTO Wizard — Interpreting Equity Distributions](https://blog.gtowizard.com/interpreting-equity-distributions/)
- [GTO Wizard — Preflop Range Morphology](https://blog.gtowizard.com/preflop-range-morphology/)
- [GTO Wizard — Range Morphology](https://blog.gtowizard.com/range-morphology/)
- [GTO Wizard — Aggregate Reports guide](https://help.gtowizard.com/aggregate-reports-guide/)
- [GTO Wizard — Dynamic Sizing](https://blog.gtowizard.com/dynamic-sizing-a-gto-breakthrough/)
- [PioSOLVER — Feature Overview](https://piosolver.com/docs/feature_overview/)
- [PioSOLVER — Meaning of numbers](https://piosolver.com/docs/viewer/numbers_in_piosolver/)
- [Flopzilla](https://www.flopzilla.com/)
- [SplitSuit — Flopzilla range shapes](https://www.splitsuit.com/flopzilla)
- [SplitSuit — Poker Ranges & Range Reading](https://www.splitsuit.com/poker-ranges-reading)
- [Upswing — Equity Distribution](https://upswingpoker.com/equity-distribution/)
- [PeakGTO — Equity Graphs](https://pokercoaching.com/blog/introducing-equity-graphs-in-peakgto/)
- [PocketSolver](https://www.pocketsolver.com/)
- [Poker Scientist — Runouts Clustering](https://intercom.help/poker-scientist/en/articles/4732981-runouts-clustering)
- [GTO+ — Turn and river aggregate reports](https://www.gtoplus.com/turnriver/)
- [PokerRanger 2](https://upswingpoker.com/poker-tools-software/pokerranger/)
- [Upswing — Poker Game Tree](https://upswingpoker.com/poker-game-tree/)
