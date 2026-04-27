# Information Designer: Shape-descriptor proposals

## Where my lens points

First question I ask any descriptor: **which retinal channel is doing the work, and is that channel the most effective one available for the data type?** Munzner's effectiveness ranking is non-negotiable — position on a common scale dominates, followed by length, angle/slope, area, then color luminance, then color hue, then texture/shape (Munzner, *Visualization Analysis & Design*, Ch. 5). Second question: **what is the data-ink ratio** (Tufte) — can a glance distinguish signal from decoration? Third: **is the descriptor a type or a token?** A type (the idiom: "ridgeline") can be learned once and reused across thousands of spots; a token (a specific picture) cannot. We want types. Fourth: **what does the descriptor NOT say?** Every encoding suppresses dimensions — name them so the owner knows when to reach for a different shape.

## Proposals

### 1. Range Ridgeline (preflop position stack)

- **Definition (one line):** Per-position hand-strength densities stacked vertically with partial overlap, so the owner sees how range shape narrows from UTG down to BB.
- **What it describes:** The seed-4 "stacked preflop ranges with narrowing edges." Re-encoded: *density of combos vs. hand-strength index*, one ridge per position, aligned on a shared x-axis.
- **Visual form:** **Ridgeline plot** (a.k.a. joyplot), invented by Wilkinson for climate data, popularized by Joy Division's *Unknown Pleasures* cover and by the `ggridges` package (Wilke, *Fundamentals of Data Visualization*).
- **Retinal channels used:** Position on common x-axis (hand-strength percentile) — the *strongest* channel. Shape silhouette encodes range-composition. Vertical position encodes categorical position (UTG/MP/CO/BTN/SB/BB). NOT used: hue (saves it for villain-overlay), area (densities normalize).
- **Data source in-codebase:** `rangeEngine/` weighted 13×13 → projected onto a hand-strength index (e.g., preflop equity vs. random) → kernel density per position.
- **Mobile screen viability (1600×720):** Excellent. Six ridges at ~80 px tall with 30 px overlap fits in a 660×600 panel. Tufte's small-multiples logic is preserved because ridges share the same x-axis.
- **Self-rating:** precision 4 (density, not combo-exact) / legibility 5 (one idiom, learn once) / data coverage 3 (one scalar per range) / uniqueness 4 (not the usual 13×13 grid)
- **Prior art / citation:** [Ridgeline plot — Wikipedia](https://en.wikipedia.org/wiki/Ridgeline_plot); [ggridges / Data-to-Viz](https://www.data-to-viz.com/graph/ridgeline.html); Wilkinson *The Grammar of Graphics*.

### 2. Equity Horizon Strip (bet-size EV curve, compact)

- **Definition (one line):** EV of hero's candidate action across bet-size fractions rendered as a horizon chart — a 1D function compressed into colored bands so many spots can be compared at a glance.
- **What it describes:** Re-encoding of seed-3 ("EV-ridge over bet-size"). A ridge is evocative but wastes vertical real estate; a horizon chart preserves the peak-finding task while reclaiming the page.
- **Visual form:** **Horizon chart** (Heer, Kong, Agrawala, CHI 2009 — "Sizing the Horizon").
- **Retinal channels used:** Position (x = bet-size fraction), luminance (band density = EV magnitude), hue (two-color divergent: +EV vs −EV around the break-even). NOT used: area as magnitude (avoided — horizon uses *layered* area).
- **Data source in-codebase:** Game-tree depth-1/2 EV output per sizing (already computed in `gameTreeEvaluator.js`; `LiveAdviceBar` consumes a subset).
- **Mobile screen viability (1600×720):** Outstanding. A horizon band is ~40 px tall; 16 spots fit in a scrollable column. This is the one idiom in the list *specifically designed* for dense time-series-like data on small screens.
- **Self-rating:** precision 5 (exact EV readable) / legibility 3 (requires a one-time explanation of the folding trick) / data coverage 4 (full EV curve, not just peak) / uniqueness 5 (no poker tool uses this)
- **Prior art / citation:** [Heer et al., *Sizing the Horizon*](https://idl.cs.washington.edu/files/2009-TimeSeries-CHI.pdf); Panopticon Software's financial dashboards.

### 3. Board-Texture Shot Chart (equity hexbin on 13×13)

- **Definition (one line):** The 13×13 starting-hand grid rendered as a hexbin, each cell colored by hero's equity vs. villain's estimated range on the current board — size of hex = combo count remaining, color = equity vs. median.
- **What it describes:** Replaces the ad-hoc "condensed oval / polarized barbell / capped triangle" shape vocabulary with a *single* idiom that *produces* the oval/barbell/triangle visually, rather than naming them abstractly. Shape emerges from data.
- **Visual form:** **Hexagonal binning shot chart**, the Goldsberry/CourtVision idiom (MIT Sloan 2012), adapted to a 13×13 discrete grid.
- **Retinal channels used:** Position (grid is a matrix — pocket pairs on diagonal, suited above, offsuit below — the canonical poker convention, so reading cost is zero for a poker player), area (combo count — 4 unsuited, 12 offsuit, 6 pair), luminance + divergent hue (equity delta). NOT used: orientation.
- **Data source in-codebase:** Per-combo equity distributions already produced by `computeComboEquityDistribution()` (memory: Game Tree Session 5). This is *free* output of existing engines.
- **Mobile screen viability (1600×720):** Very good. 13×13 cells at 28 px each = 364 px square — fits comfortably and is already the app's mental model.
- **Self-rating:** precision 5 (combo-exact) / legibility 5 (grid is familiar) / data coverage 5 (every combo, every equity) / uniqueness 3 (grid exists; hexbin+equity overlay is new)
- **Prior art / citation:** [Goldsberry, *CourtVision* MIT Sloan 2012](https://www.kirkgoldsberry.com/); [BallR hex shot charts](https://toddwschneider.com/posts/ballr-interactive-nba-shot-charts-with-r-and-shiny/).

### 4. Street-Transition Sankey (equity migration flop→turn→river)

- **Definition (one line):** Combos flow across three columns (flop, turn, river) with ribbon width = combo count and color = equity bucket (nuts / strong / marginal / air), so the owner watches *where* his range goes when a card lands.
- **What it describes:** Reframes seed-5 ("equity basins") into *migration* rather than *attractors*. Basins answer "where does a combo end up"; a Sankey answers "which combos flowed from strong to air on the turn" — the actionable question when deciding to barrel.
- **Visual form:** **Sankey diagram**, originating from Sankey's 1898 steam-engine efficiency drawings, canonical today in energy-flow and personal-finance dashboards.
- **Retinal channels used:** Position (x = street, y = equity bucket), length/width (ribbon thickness = combo count), hue (equity bucket — divergent scale). NOT used: area as absolute count (widths are proportional), shape.
- **Data source in-codebase:** Game-tree depth-2/3 combo distributions at each street (existing); bucketing already present in `villainDecisionModel.js`.
- **Mobile screen viability (1600×720):** Fair. Sankey needs horizontal room; three columns at 500 px wide fits landscape, but ribbon labels compete for space. Keep nodes ≤ 5 per stage per Sankey best-practice guidance.
- **Self-rating:** precision 3 (bucketed, not per-combo) / legibility 4 (one-time learning) / data coverage 4 (transitions are the answer) / uniqueness 5 (no poker tool does this)
- **Prior art / citation:** [SankeyMATIC](https://sankeymatic.com/); [ProjectionLab cash-flow Sankeys](https://projectionlab.com/cash-flow); Sankey Matrix Master financial-flow best practices.

## Critique of the seeds

- **Seed 1 (range ovals/barbells/triangles):** the shape names are *diagnoses*, not encodings. They rely on *shape* — Bertin's weakest retinal variable for quantitative data. Better: let shape *emerge* from an underlying hexbin/heatmap encoding (Proposal 3), then name the emergent silhouette informally.
- **Seed 2 (equity saddle surface over board × holding):** 3D surfaces are notoriously hard to read — occlusion + perspective distortion destroy position precision (Munzner, Ch. 6). On a 1600×720 mobile screen, 3D is a trap. Either flatten to a 2D heatmap with contours, or pick two sparklines — both beat a saddle.
- **Seed 3 (EV ridge over bet-size):** the *ridge* metaphor is fine but spends a whole axis on a scalar. A horizon chart (Proposal 2) gets the same peak-finding task in 1/4 the vertical space.
- **Seed 4 (stacked preflop ranges with narrowing edges, Sankey-like):** this is correct instinct — but the right idiom depends on whether you want *shape* (Proposal 1 ridgeline) or *flow* (Proposal 4 Sankey). Don't conflate.
- **Seed 5 (flop→turn equity basins):** "basin" is a landscape metaphor (attractor). That's a *dynamical-systems* framing — suggests the viewer should feel gravity pulling combos to a fixed point. But poker isn't deterministic; it's *stochastic migration*. Sankey is truer to the physics.

## What I'd most want another persona to pressure-test

Two things. (1) **Cognitive load during live play.** My proposals are optimized for *fast reading by a trained eye* — but the owner is at a live table, glancing. A cognitive-psych or HCI voice should test whether even a ridgeline demands more focal attention than he can spare mid-hand, and recommend which of the four belongs to pre-session study vs. live HUD. (2) **Semantic fidelity.** A poker-theory voice should verify that my hexbin+equity idiom doesn't *hide* the thing a range-advantage framework cares about — e.g., nut-share, capped-vs-uncapped. If the idiom is pretty but erases the concept, it fails.

Sources:
- [Ridgeline plot — Wikipedia](https://en.wikipedia.org/wiki/Ridgeline_plot)
- [Data-to-Viz: Ridgeline plot](https://www.data-to-viz.com/graph/ridgeline.html)
- [Heer, Kong, Agrawala — Sizing the Horizon (CHI 2009)](https://idl.cs.washington.edu/files/2009-TimeSeries-CHI.pdf)
- [Kirk Goldsberry — CourtVision / SprawlBall](https://www.kirkgoldsberry.com/)
- [BallR: Interactive NBA Shot Charts](https://toddwschneider.com/posts/ballr-interactive-nba-shot-charts-with-r-and-shiny/)
- [SankeyMATIC builder](https://sankeymatic.com/)
- [ProjectionLab — Cash-flow Sankey diagrams](https://projectionlab.com/cash-flow)
- [SankeyMaster — Sankey design best practices](https://sankeymaster.com/unraveling-financial-flows-the-practical-guide-to-sankey-diagrams-in-finance/)
- [Axis Maps — Bertin's Visual Variables guide](https://www.axismaps.com/guide/visual-variables)
- [Visual Variable — Wikipedia (Bertin's seven)](https://en.wikipedia.org/wiki/Visual_variable)
- [Munzner — Marks and Channels (Ch. 5)](https://www.oreilly.com/library/view/visualization-analysis-and/9781466508910/K14708_C005.xhtml)
- [Wilke — Fundamentals of Data Visualization (violin/ridge)](https://clauswilke.com/dataviz/boxplots-violins.html)
- [Landscaper — Loss-landscape topological analysis](https://arxiv.org/html/2602.07135v2)
