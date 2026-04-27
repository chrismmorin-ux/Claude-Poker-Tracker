# Poker Shape Language — Theory Roundtable

**Date:** 2026-04-23

**Context:** The owner runs a live poker tracker + exploit engine for 9-handed cash and tournaments, used on a mobile screen (1600×720) in-session and in study mode. He thinks in pictures — "this range is an oval," "this spot is a saddle," "the turn is a basin of rivers" — and he wants a **descriptor language**: a small, shared vocabulary of visual/geometric shapes he can see in the app and re-picture at the table. These are descriptors, not engine inputs — a cognitive prosthesis for pattern recognition, not a new computation layer. The five seeds he brought (range geometry on 13×13, equity saddle surface, EV-ridge over bet size, stacked preflop ranges with narrowing edges, flop→turn basin landscape) were deliberately rough. This roundtable's job is to harden them — keep what works, rename what's misnamed, kill what's beautiful-but-unreadable, and pick a short list to build.

## Roster

- [01 — Solver Cartographer](voices/01-solver-cartographer.md): what existing pro tools already ship, and what the unfilled gaps are.
- [02 — Information Designer](voices/02-information-designer.md): retinal channels, Munzner effectiveness, Tufte data-ink, mobile ergonomics.
- [03 — Topologist](voices/03-topologist.md): what the underlying space actually is — manifold, stratified space, poset, Markov chain.
- [04 — Cognitive Scientist](voices/04-cognitive-scientist.md): chunkability, prototype alphabets, radiology-gist, working-memory at hand #647.
- [05 — Poker Coach](voices/05-poker-coach.md): does the student reach for this word at the table when frozen?
- [06 — Scientific Viz](voices/06-scientific-viz.md): contour trees, Morse-Smale, horizon plots, persistence — topology-preserving abstraction over sample-faithful render.

## Consolidated Descriptor Catalog

Merged across voices; variants listed in Notes. Ratings are this facilitator's judgment after reading all six, not averaged self-scores. Difficulty is L/M/H based on data availability in the codebase plus rendering complexity.

| # | Descriptor | Originator(s) | What it describes | Visual form | Data source | Precision | Legibility | Data coverage | Uniqueness | Difficulty | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Range Silhouette** (Morphology Glyph) | Solver, Cognitive, Coach | Thresholded 13×13 matrix collapsed into a small alphabet — Oval, Barbell, Triangle, Comb, Cloud — capturing morphology (condensed / polarized / linear / capped / merged) | 40-px matrix thumbnail; cells ≥ weight threshold filled, rest dimmed | `rangeEngine/` weighted 13×13 + topology classifier | 4 | 5 | 5 | 3 | L | Solver calls this "morphology glyph" (GTO Wizard lexicon); Cognitive calls it the "5-prototype alphabet." Same descriptor. |
| 2 | **Range Contour Tree** ("range skeleton") | SciViz, Topologist | Merge tree of the 13×13 weighted matrix — leaves = weight maxima, joins = saddles, branch length = persistence. The machinery behind the silhouette. | 60×80 px dendrogram beside the matrix | rangeEngine matrix → merge-tree algorithm | 5 | 3 | 4 | 5 | M | Topologist's "persistence diagram" is the same data rendered differently. Feeds the silhouette classifier; exposing the tree itself is a study-mode feature. |
| 3 | **Range Ridgeline** (position stack) | Info Designer | Per-position hand-strength densities (UTG→BB) stacked with partial overlap on a shared x-axis | Joyplot, 6 ridges × ~80 px | rangeEngine projected to preflop-equity scalar, KDE per seat | 4 | 5 | 3 | 4 | L | Complements the Sankey ribbon. Ridgeline is SHAPE-per-position; ribbon is FLOW-between-positions. Different questions. |
| 4 | **Narrowing Ribbon** (range Sankey) | Solver (seed 4), Info Designer, Topologist | Combo flow across positions or streets — ribbon width = combos retained under conditioning, color = equity bucket | Sankey, 3–5 columns | range engine + per-action survival sets | 3 | 3 | 3 | 5 | M-H | Topologist frames this as a filtration / persistence module; Info Designer as preflop-migration Sankey. Same object. Owner's seed 4 survives here. |
| 5 | **Equity-Distribution Curve** ("hockey stick") | Solver | Sorted per-combo equity vs range percentile, hero and villain overlaid | 2D line chart | `computeComboEquityDistribution()` already emits this | 5 | 5 | 5 | 1 | L | Table-stakes in every solver tool. Not unique but essential; without it the other shapes have no baseline. |
| 6 | **Spire** | Coach | Small cluster of nutted combos sitting atop an otherwise medium/weak range — the "uncapped" signature | Thin vertical tower at the 90–100% bucket of the equity curve | per-combo equity distribution, top-bucket count | 4 | 5 | 5 | 4 | L | Pairs with #5 — Spire is a classifier *on top of* the hockey stick curve. One word, yes/no question. |
| 7 | **Polarization Bar** | Cognitive | 1D horizontal bar showing equity-mass distribution: Flat, Left-Heavy, Dumbbell | 8-bucket horizontal bar | per-combo equity bucketed | 4 | 5 | 5 | 3 | L | A sibling to #5 but compressed to a glance-read prototype. Legibility > precision. |
| 8 | **Saddle** | Coach | Spot where hero equity is high vs part of villain's range and low vs another — no single action dominates; way-ahead/way-behind | Heatmap strip with visible trough over (villain sub-range × hero holding) | equity vs top-30% and bottom-30% of villain range | 5 | 3 | 4 | 5 | M | Coach claims this IS the right word. Topologist says the math is abused across categorical texture but valid *fiber-wise* (fixed board, continuous parameter). They agree on where it lives — they disagree on what it spans. Resolution: see Tensions §. |
| 9 | **EV Horizon Strip** | Info Designer, SciViz | EV as function of bet size rendered as horizon chart; optionally stacked across streets | Layered-area horizon band, ~40 px per street | game tree EV per sizing in `gameTreeEvaluator.js` | 5 | 3 | 4 | 5 | M | Both voices converge on horizon over raw ridge render. Requires one-time learning but dominates small-screen real estate. |
| 10 | **Sizing Curve Tag** (Ridge/Plateau/Cliff) | Coach | Classifier on the EV-vs-sizing curve: sharp peak (Ridge), flat top (Plateau), monotone drop (Cliff), monotone rise (Ramp) | Text tag + thumbnail curve | same as #9 — classifier on top | 4 | 5 | 5 | 4 | L | Coach's insight: the *label* travels to the table; the *full curve* is study-only. This is the cheap table-usable form of #9. |
| 11 | **Basin** (runout volatility) | Coach, Info Designer (reshaped), SciViz | Turn→river equity landscape showing where hero's equity is stable vs where rivers lift or crater it. Coach's word for "cliffy runout." | 1D equity-vs-river-card profile with peaks, flats, sinkholes | per-combo equity iterated over 44 rivers | 5 | 3 | 4 | 5 | M | Coach's shape-word, wrapped around data the app already has. Topologist correctly notes "basin" is dynamical-systems vocab with no flow here — but blesses it as *pedagogy*. Sankey migration (Info Designer #4) is the *honest* render; Basin is the *memorable name*. Ship both: Sankey for study, Basin label for table. |
| 12 | **Equity Basin Map** (Morse-Smale) | SciViz | 2D Morse-Smale cell decomposition of per-combo equity over (board-texture × hero-holding) | 120×120 colored cell map with ridge lines | boardTexture + per-combo equity | 5 | 2 | 5 | 5 | H | The rigorous form of Saddle + Basin combined. Powerful but failed the mobile/chunkability test for three voices. Lives as a desktop study artifact, if at all. |
| 13 | **Street-Transition Sankey** | Info Designer, Topologist | Combos flow across flop→turn→river, ribbon width = combo count, color = equity bucket (nuts / strong / marginal / air) | 3-column Sankey | depth-2/3 combo distributions per street | 3 | 4 | 4 | 5 | M | Topologist's path-in-stratified-space and Info Designer's migration Sankey are the same picture. This is the owner's seed 5 reshaped into honest physics (stochastic migration, not attractor flow). |
| 14 | **Decision Kite** | Cognitive | Triangle glyph with three vertices scaled to pot-odds, hero equity, villain fold% — named as Fat Kite / Thin Kite / Inverted | 24-px triangle | game-tree `potOdds`, `heroEquity`, `foldPct` at the current node | 3 | 4 | 5 | 5 | L | Collapses a 4D EV computation to one peripheral gestalt. Risk: three-vertex glyphs can be ambiguous at thumbnail; but the alphabet is only three names. |
| 15 | **Villain Stat Persistence Barcode** | SciViz | Horizontal barcode of villain stats; bar length = credible-interval width (stability), darkness = magnitude, ordered by persistence | 10–15 stacked 6-px bars | `bayesianConfidence.js` credible intervals | 4 | 4 | 4 | 4 | L | Directly encodes sample-size uncertainty, which the app already computes but does not display. Under-exploited surface. |
| 16 | **Fiber Bundle over Board-Texture Strata** | Topologist | Decision surface as a stratified space — base = poset of textures, fiber = range simplex; advice smooth within a stratum, discontinuous across | Dendrogram of textures with fiber-cards at leaves | board texture classifier + per-texture tendencies | 5 | 2 | 4 | 5 | H | The *correct* mathematical object for why advice jumps when the turn pairs. But nobody outside the topologist will read this. The intuition survives as a UX pattern: a "texture card flip" animation when a stratum boundary is crossed. The formalism does not ship. |
| 17 | **Hand Trajectory / Homotopy Path** | Topologist | Played hand as a path from preflop range to singleton combo; homotopy class = "same line, different story" | Sankey-like overlay on stratified base | hand timelines + per-street texture | 4 | 3 | 5 | 4 | M | Beautiful reframing of the existing replay view. Ship as study artifact — "compare hands with the same bet line but different textures." |

## The Five Seeds — Final Verdict

**Seed 1: Range geometry on 13×13 (oval / barbell / triangle) — RESHAPED.** Survives as **Range Silhouette** (#1), renamed to match pro lexicon (morphology glyph) and anchored in a discrete 5-prototype alphabet (Oval, Barbell, Triangle, Comb, Cloud). Cognitive Scientist's chunkability argument is the decisive win: the 13×13 heatmap is a reading task; the silhouette is a perception task. The Topologist's objection (13×13 isn't a manifold, "oval" isn't a topological object) is satisfied by Range Contour Tree (#2) backing the classifier — the shape *emerges* from a merge-tree computation.

**Seed 2: Equity saddle surface over board texture × hero holding — RESHAPED, narrowly.** Topologist is right that a Hessian across categorical texture is abuse — you can't take a derivative across "wetness." Info Designer and Cognitive Scientist pile on: 3D surfaces are mobile-hostile and have no prototype vocabulary. What survives is **Saddle** (#8) as the *label* for the way-ahead/way-behind phenomenon — used within a single board, not across texture classes. Coach's naming instinct is preserved; Topologist's constraint is preserved. The full Morse-Smale **Equity Basin Map** (#12) is kept as a rigorous desktop form for advanced study, not a live surface.

**Seed 3: EV-ridge over bet-size — RESHAPED.** "Ridge" is mathematically wrong for a 1D function (Topologist: a ridge needs ≥2 parameters). The work of the seed is done by **EV Horizon Strip** (#9) — same peak-finding, one-quarter the vertical pixels — and by **Sizing Curve Tag** (#10) — the compressed label Coach argues actually travels to the table. Both Info Designer and SciViz converged independently on horizon plots.

**Seed 4: Stacked preflop ranges with narrowing edges — SURVIVES, split in two.** Solver's reading is right: nobody ships this. It becomes **Range Ridgeline** (#3) for the shape-per-position question and **Narrowing Ribbon** (#4) for the flow-between-positions question. Info Designer's call not to conflate them is correct. Topologist's filtration-homology framing is the mathematical backing for the ribbon; it does not need to surface in UX.

**Seed 5: Flop→turn equity basin-landscape with nuts/brick/villain-nuts as attractors — RESHAPED.** "Attractor" presupposes a dynamical system, and street-to-street is a one-step stochastic transition, not a flow (Topologist). Info Designer nails it: poker isn't deterministic; it's stochastic migration, and Sankey is truer to the physics. Ships as **Street-Transition Sankey** (#13) for the honest render, with **Basin** (#11) as the pedagogical label Coach can use at the table when asking "is this a cliffy runout?"

## Tensions Surfaced

**T1. Saddle: mathematically abused or perceptually right?** Topologist: "saddle across categorical board texture" is an illegal Hessian claim and will mislead the owner into trusting advice that doesn't exist. Coach: "saddle" is the single best word for way-ahead/way-behind; students freeze because they have no name for this configuration, and the geometric metaphor unlocks them. **Winner: Coach, conditionally.** The word ships. The surface does not span board texture — Saddle describes a configuration on a *fixed* board where hero equity bifurcates across villain's range (Topologist's "fiber-wise saddle" is legal). Topologist's constraint is preserved in the spec, Coach's label is preserved in the UI.

**T2. Heatmap vs named alphabet on 13×13.** Info Designer: let shape *emerge* from an underlying hexbin/heatmap encoding, then name the emergent silhouette informally. Cognitive Scientist: heatmaps with 64 weight levels fail all four chunkability tests at hand #647; force the silhouette to a discrete 5-name alphabet. **Winner: Cognitive Scientist.** The lived reality of playing poker at a live table is not the lived reality of reading a solver aggregate report in study mode. The descriptor is the discrete silhouette; the heatmap underneath is implementation. Study mode can expose the heatmap via tap; live mode shows only the silhouette tag.

**T3. Contour tree vs pictogram as primary render.** SciViz: compute the merge tree — two ranges that render identically as heatmaps can have radically different merge trees; don't eyeball shapes. Cognitive Scientist: a dendrogram has no prototype vocabulary; the barbell pictogram is faster. **Winner: Cognitive Scientist foreground, SciViz backing.** The merge tree computes the classification; the pictogram displays it. Long-press or study-mode reveals the tree. This is how radiology already works: gist in 200 ms, detailed scan on second look.

**T4. Basin as attractor language.** Topologist: "attractor" requires a flow; street transitions are a Markov chain with absorbing states; the landscape metaphor overstates smoothness/determinism. Info Designer: Sankey migration is truer to the physics. Coach: the *word* basin is what students actually need for equity-volatility-across-runouts. **Winner: split.** Ship the Sankey as the rendered artifact (honest physics). Ship "Basin" as the label/classifier (it answers the right question). Topologist's warning about metaphors that overstate smoothness is real, but Coach's counter — that the metaphor-shaped hole around equity volatility is the single biggest unmet need — outweighs it. We'll call a cliff a cliff and a basin a basin, and the Sankey will show the owner the actual combo flow.

**T5. Is stratification legible at the table?** Topologist's fiber-bundle proposal is mathematically the correct object for "why advice jumps when the board pairs." But Topologist himself invites pressure-testing: can the owner *see* strata at the table? Cognitive Scientist's framework answers: no. A dendrogram of texture classes with fiber-cards at leaves is a four-channel display with no prototype vocabulary. **Winner: collapse to a UX pattern.** The intuition ships as a "texture flip" event — when the turn crosses a stratum boundary (board pairs, fourth suit lands, straight completes), the app emits a visible state change (flash, icon, regime-label shift). The formalism does not.

**T6. Morphology glyph: stable under noise?** Solver asked: does the classifier flip between Polarized and Merged under small input noise? Cognitive Scientist's chunkability framework says the alphabet *must* be stable under noise or it fails Gestalt closure. Resolution: the classifier ships with a confidence value; ambiguous ranges display a dual-silhouette (e.g., "Barbell / Merged") rather than forcing a single label. This cost is borne gladly — the failure mode of a flipping silhouette is worse than a brief compound label.

## Top 6 Descriptors to Pursue

**1. Range Silhouette (morphology glyph)** — *Quick win + strategic.*
One-line: Thresholded 13×13 range collapsed into a 5-prototype alphabet (Oval, Barbell, Triangle, Comb, Cloud).
Why #1: Data is already computed (`rangeEngine/` matrices). Cognitive primitives survive at hand #647. Vocabulary aligns with existing pro lexicon (GTO Wizard morphology). Delivers a named, verbalizable tag on every villain in the sidebar.
Sketch: Add `classifyMorphology(matrix) → {label, confidence}` in rangeEngine; render as 40-px silhouette component beside each villain in `OnlineView` / sidebar; pair with the existing Bayesian range display.
Dependencies: merge-tree classifier (desk-mode artifact #2 can be deferred).

**2. Spire + Polarization Bar (equity-distribution shape pair)** — *Quick win.*
One-line: Does villain have a spire? Is the range Flat, Left-Heavy, or a Dumbbell?
Why #2: Already-computed `computeComboEquityDistribution()` output; two one-word classifiers; directly answers "can villain credibly overbet this river?" Lives as a pair because Spire classifies the top-end and Polarization classifies the mass distribution — together they replace verbose "range is polarized and uncapped" prose with two icons.
Sketch: `classifyEquityShape(distribution)` → `{polarization, hasSpire, spireWidth}`; render as 2 small icons + 8-bucket horizontal bar in the villain card.
Dependencies: none.

**3. Sizing Curve Tag (Ridge / Plateau / Cliff / Ramp)** — *Quick win.*
One-line: Four-way classification of the EV-vs-bet-size curve shape per sizing decision.
Why #3: Game tree already emits the EV-sizing curves; what's missing is the label. Coach argues the *label* travels to the table even when the full curve does not. Cheapest high-value descriptor in the catalog.
Sketch: `classifySizingCurve(evByFraction)` → enum; tag in `SizingPresetsPanel`; expose the full horizon strip (#9) on tap.
Dependencies: none.

**4. Saddle (way-ahead/way-behind flag)** — *Strategic.*
One-line: Classifier that fires when hero equity vs top-30% of villain's range differs from equity vs bottom-30% by > 35 points — with a one-line guidance ("don't pot-commit, play small").
Why #4: Fills Coach's explicit metaphor-shaped hole. Uses data already in the pipeline. Turns a named phenomenon (Ed Miller's way-ahead/way-behind, Upswing's reverse implied odds) into a visible tag. The topologist's constraint keeps it scoped to fixed-board within-stratum computation, not a fake Hessian across texture.
Sketch: New module `saddleDetector.js`; consumed in `LiveAdviceBar` and replay HeroCoachingCard; emits a single tag + threshold explanation.
Dependencies: per-combo equity already available via game tree.

**5. Street-Transition Sankey + Basin label** — *Strategic.*
One-line: The honest flop→turn→river combo-migration render, with a one-word table-mode label (Basin: Wide/Narrow/Cliffy).
Why #5: Owner's seed 5 resurrected as honest physics. Coach's metaphor-shaped hole (equity volatility across runouts) gets both a visual and a name. Legible in study mode as the Sankey, glance-readable at the table as the Basin tag.
Sketch: Sankey in `HandReplay` / post-session review surface using depth-2/3 combo distributions; Basin tag in live advice surface computed from per-river equity variance and tail-extremes.
Dependencies: uses existing depth-2/3 outputs; Sankey rendering library (lightweight, mobile-OK per best-practice guidance — keep ≤ 5 nodes per column).

**6. Range Ridgeline + Narrowing Ribbon** — *Strategic, study-mode first.*
One-line: Two connected visualizations of preflop flow — ridgeline for shape-per-seat, ribbon for flow-between-seats.
Why #6: Owner's seed 4, preserved as the most novel thing on the list per Solver. Lives in study mode / session review where the cognitive load is acceptable. Genuinely not shipped by any competitor. Lower table-mode value than the others, but highest differentiation when the owner is reviewing.
Sketch: Ridgeline in a new `PreflopStudyView` component; ribbon as a second tab on the same view, showing combo flow under a chosen action trajectory.
Dependencies: needs a preflop-equity scalar projection (cheap) and transition-range computation per action (medium).

## What Got Cut

- **Range Contour Tree as a first-class display** — Ships internally as the classifier for #1. The visible dendrogram lives as a desktop study artifact, not a primary descriptor. Dendrograms have no prototype vocabulary.
- **EV Horizon Strip as standalone surface** — Folded into #3. The classification tag captures 80% of the value at 20% of the UI investment; the full strip surfaces on tap.
- **Equity Basin Map (Morse-Smale)** — Beautiful-but-doomed. Three voices flagged mobile/legibility; the 2D cell map failed Cognitive Scientist's chunkability test and Coach's table-usability test. Kept in the back of the drawer for a possible desktop study tool.
- **Fiber Bundle over Board-Texture Strata** — The math is correct, the UX is unshippable. Intuition survives as a "texture flip" UX pattern — a visible regime-change signal when the board crosses a stratum boundary — but the dendrogram-of-textures does not ship.
- **Hand Trajectory / Homotopy Path** — Elegant but redundant with the existing replay view. Useful reframing for a future "compare two hands with the same action line but different textures" feature; not its own descriptor.
- **Decision Kite** — Closest call on the cut line. Clever collapse of four variables to one gestalt, and Cognitive Scientist's prototype argument is strong. Cut for top 6 only because the three-vertex glyph is the *most* ambiguous of the small-alphabet candidates at thumbnail scale and because the same decision information is already conveyed by #3 and #4 combined. Revisit if #3+#4 land and we find the live surface still feels dense rather than organized.
- **Villain Stat Persistence Barcode** — Cut from top 6, not from the roadmap. Directly useful — shows which villain reads are stable vs noisy — but orthogonal to the shape-language charter; it's an uncertainty display, not a range-shape descriptor. Track separately.
- **Raw Equity-Distribution Curve (hockey stick)** — Essential baseline, zero uniqueness. Ship as the substrate for Spire and Polarization Bar (#6 in top 6 technically depends on this curve existing in the UI), not as a named descriptor.

## Open Questions for the Owner

1. **Study-mode vs live-mode prioritization.** The top 6 has a mix. If you can only ship *one* surface in the next quarter, is it the live-table sidebar (tags: silhouette, spire, saddle, sizing tag) or the post-session review (Sankey + ridgeline)? These are different engineering investments.
2. **Do we introduce new vocabulary to you, or leverage what the community already uses?** Spire is community-informal. Saddle is new-with-precedent. Basin is metaphor-backed. Silhouette / Barbell / Triangle are established. The shared framing is: how much willingness do you have to teach yourself (and any future collaborator) a small set of new words?
3. **Mobile-only, or also desktop study view?** Several descriptors (Range Contour Tree, Equity Basin Map, full Horizon Strip) are desktop-appropriate but mobile-hostile. Is a "study surface" at desktop resolution in-scope, or is 1600×720 the only target?
4. **Which existing surfaces do you want to retrofit first?** The sidebar (`OnlineView`) is the obvious candidate for Silhouette + Spire + Saddle. But `HandReplay`'s HeroCoachingCard, the `SizingPresetsPanel`, and `PresessionDrillView` are all candidates. We can retrofit one vs build a new "ShapeLanguage" view.
5. **Ambiguity handling: dual-label or force-a-single-tag?** When the morphology classifier is uncertain (Barbell vs Merged), do you want a compound label ("Barbell / Merged, 55-45") or a forced single label with a confidence dot? The first is honest; the second is chunkable. Pick your failure mode.
6. **How aggressive on the Saddle flag?** The threshold (Δ > 35 equity points between top-30% and bottom-30% of villain range) is a judgment call. Too loose and the flag fires on every hand; too tight and the useful "don't pot-commit" moments get missed. Do you want conservative (fires rarely, always useful) or loose (fires often, teaches you to notice)?

## Appendix: Vocabulary Decisions

Where voices used different names for the same object, the project canonical name is listed first; aliases follow.

- **Range Silhouette** — aliases: Morphology Glyph (Solver), 5-Prototype Alphabet (Cognitive). Canonical name Silhouette preserves the owner's geometric intuition without dropping the pro lexicon. The prototype set is named (Oval, Barbell, Triangle, Comb, Cloud).
- **Range Contour Tree** — aliases: Range Skeleton (SciViz), Range Persistence Diagram (Topologist). Same underlying object; the dendrogram form is canonical for any surfacing of it.
- **Range Ridgeline** — no conflicting aliases (Info Designer solo); the ggridges / joyplot / Wilkinson idiom.
- **Narrowing Ribbon** — aliases: Stacked Preflop Sankey (Solver, Info Designer), Range Filtration (Topologist). Ribbon is canonical; Sankey is the render family.
- **Equity-Distribution Curve** — aliases: Hockey Stick, Equity Curve. Equity-Distribution Curve is canonical; "hockey stick" is an informal shape-name inside it.
- **Spire** — no aliases (Coach solo). The word for the top-end sub-structure on the equity curve.
- **Polarization Bar** — sibling to Equity-Distribution Curve; no aliases.
- **Saddle** — aliases: Way-Ahead/Way-Behind (community), Reverse Implied Odds (Upswing). Saddle is the project shape-word; the others remain as conceptual precedents.
- **EV Horizon Strip** — aliases: EV Ridge (owner seed), EV-Sizing Curve (Solver). Horizon Strip is the canonical render; "EV ridge" is retired (Topologist's 1D-function objection is fatal for the word "ridge").
- **Sizing Curve Tag** — taxonomy: Ridge / Plateau / Cliff / Ramp. "Ridge" survives here as a specific tag-value (peaked curve), not as a name for the whole surface.
- **Street-Transition Sankey** — aliases: Equity Migration (Info Designer), Path in Stratified Space (Topologist). Sankey is canonical for the render.
- **Basin** — aliases: Equity Volatility Landscape, Runout Landscape. Basin is the project label; kept distinct from Equity Basin Map (the Morse-Smale study artifact, archived).
- **Texture Flip** — the UX-pattern survivor of Fiber Bundle over Strata. Describes the visible state-change moment when the board crosses a texture stratum.
