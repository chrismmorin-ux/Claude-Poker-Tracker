# Cognitive Scientist: Shape-descriptor proposals

## Where my lens points
I ask: *what will the owner still recognize on hand #647 of a four-hour session, when working memory is fried and he has 8 seconds to act?* That forces two linked questions — (a) is the shape a **discrete prototype** the visual system can chunk in one fixation, or a continuous surface that demands re-parsing every time; and (b) are its **diagnostic features** aligned with the decisions they must drive? Beauty, resolution, and information density are cognitive costs, not benefits, under time pressure.

## What makes a poker shape chunkable
The convergent finding across Chase & Simon's chess chunking, Gobet's template theory, Klein's RPD, and the radiology gist literature is: experts don't store rich pictures — they store **small, schematic, prototype-anchored templates** with 3–5 diagnostic features and a few variable slots. A shape becomes chunkable when it (i) has a small vocabulary of **discrete prototypes** the perceiver can name (Chase & Simon's ~4 pieces/chunk, Cowan's 4±1 working-memory slots); (ii) differs from neighboring prototypes along **one or two category-diagnostic dimensions** that perceptual learning has sharpened (Goldstone's differentiation + category-boundary enhancement); (iii) obeys **Gestalt grouping** (proximity, continuity, closure) so the whole can be seen in a single fixation as gist, not parsed piecewise — the same holistic/peripheral capture that radiologists use in the first 200 ms before foveal scanning; and (iv) has a **verbal name that co-activates with the image** (Paivio dual-coding) so the shape can be rehearsed in inner speech between hands. Continuous surfaces with many retinal channels fail all four tests.

## Proposals (chunkability-filtered)

### 1. Range Silhouette (the 13×13 as a 5-prototype alphabet)
- **Definition (one line):** The thresholded 13×13 weighted range matrix collapsed into one of a small set of named silhouettes — Oval, Barbell, Triangle, Comb, Cloud.
- **What it describes:** The shape of a player's holdings entering a decision (preflop open, 3-bet cold-call, flop float).
- **Visual form:** A ~40px matrix thumbnail with cells at or above a weight threshold filled, everything else dimmed. No gradient, no heatmap, just silhouette.
- **Why it's chunkable:** This is the direct analog of Chase & Simon's chess chunk — a small patterned cluster of discrete cells. The 5-name alphabet is below Cowan's 4±1 working-memory limit for active use and well inside the ~50k chunks Gobet shows experts can learn over time. The diagnostic feature is topological (connected vs split vs linear), which perceptual learning research says unitizes faster than quantitative features. Crucially the name is verbalizable ("he's on a barbell"), enabling dual-coding.
- **Data source in-codebase:** `rangeEngine/` weighted 13×13 matrices → threshold at weight ≥ 0.3 → topology classifier (connected components, pair diagonal presence, off-diagonal spread).
- **Self-rating:** precision **3** / legibility **5** / data coverage **5** / uniqueness **4** — legibility is maximal because silhouettes are the closest thing in this domain to the chess-board chunks whose chunkability is empirically established; the cost is precision (collapses weight information).
- **Prior art / citation:** Chase & Simon (1973) chunks; Gobet & Simon (1996) templates; Goldstone (1998) unitization.

### 2. Polarization Bar (capped / linear / polarized)
- **Definition (one line):** A single horizontal bar showing equity distribution of a range against a reference, with three named shapes — Flat, Left-Heavy, Dumbbell.
- **What it describes:** Whether the range is capped (no nuts), linear (value-weighted), or polarized (nuts + air, thin middle) — the structural property that drives bet-sizing choice.
- **Visual form:** One bar, ~8 buckets, colored by equity tier. The only thing the eye needs to judge is: is mass in the middle, on the left, or split at the ends?
- **Why it's chunkable:** A one-dimensional shape with three prototypical silhouettes is near the theoretical floor for chunk grain — it is the poker analog of a face-profile category (convex/concave/notched). Klein's RPD literature shows fireground and medical experts match situations to prototypes in ~1 second when the feature space is this compressed. Gestalt closure does the rest: the eye completes "dumbbell" from the two ends.
- **Data source in-codebase:** per-combo equity distribution → bucketed histogram → three-prototype classifier (moment-2 vs moment-4).
- **Self-rating:** precision **4** / legibility **5** / data coverage **5** / uniqueness **4** — a shape this simple will still be recognizable at hand #647 precisely because it has only three prototypes and one retinal channel (horizontal mass distribution).
- **Prior art / citation:** Klein (1998) RPD prototype matching; Goldstone & Hendrickson (2010) categorical perception; Miller (1956) / Cowan (2001) chunk limits.

### 3. Decision Kite (pot-odds × equity × fold-equity, as a 3-vertex polygon)
- **Definition (one line):** A triangle whose three vertices are scaled to pot-odds required, hero equity vs called range, and villain fold%, with a named shape — Fat Kite (easy call/bet), Thin Kite (marginal), Inverted (fold).
- **Visual form:** A small triangle glyph, ~24px, where shape gist comes from relative vertex lengths; the three named prototypes are discriminable peripherally.
- **What it describes:** The collapsed decision geometry at a node — reducing a four-dimensional EV computation to one gestalt.
- **Why it's chunkable:** Three-vertex polygons are one of the most strongly chunked visual forms in the shape-perception literature — curvature/angle landmarks at vertices act as diagnostic features and perceptual-learning research shows these become unitized rapidly. The constraint to three named shapes keeps the alphabet inside working-memory limits. The verbal labels ("fat kite") make it dual-codable.
- **Data source in-codebase:** game tree evaluator outputs (potOdds, heroEquity, foldPct) at the current decision node.
- **Self-rating:** precision **3** / legibility **4** / data coverage **5** / uniqueness **5** — unique in that no standard poker display collapses these three into one gestalt; legibility slightly lower than the first two because three vertices is more to parse than one silhouette, but still well below cognitive-load ceilings.
- **Prior art / citation:** shape-perception curvature/landmark research (Greene 2007; hierarchical IT representations); Paivio dual-coding; Klein RPD.

## Critique of the seeds — which are doomed by cognitive load?

- **Equity saddle surface over (board texture × hero holding) — DOOMED.** A 2D continuous surface with elevation is four retinal channels (x, y, height, color). The radiology gist literature shows experts extract gist from *familiar* 2D images in ~200 ms only because they've seen thousands of category prototypes; a saddle surface has no such prototype vocabulary and the owner would have to re-parse it every hand. No discrete alphabet, no Gestalt closure, no verbal name. It is the canonical "beautiful but unreadable" failure.
- **Flop→turn equity basin-landscape — DOOMED for the same reason plus animation load.** Adding the temporal dimension turns it into a four-channel dynamic display. Nothing in the expert-perception literature suggests humans chunk dynamic landscapes; RPD requires a static gestalt to match a template.
- **EV-ridge over bet-size — SALVAGEABLE but only if collapsed.** A raw EV-vs-bet-size curve is continuous and memoryless. It becomes chunkable only if reduced to ~3 named ridge shapes (Monotone / Peaked / Plateau) with the argmax marked. As drawn in the seed it's a reading task, not a perception task.
- **Stacked preflop ranges with narrowing edges — HIGH COGNITIVE LOAD.** The owner's intuition (nested funnel) is correct in spirit but the execution as stacked translucent bands fails Gestalt figure/ground — the eye can't tell which band is which under the 1600×720 table-side viewing condition. Could be rescued as a single Sankey-thinned "narrowing silhouette" but only one street at a time.
- **Range geometry on 13×13 (seed #1) — STRONGEST SEED, but only if named and alphabetized.** Raw "oval vs barbell vs triangle" is exactly right; the failure mode is letting the matrix stay continuous (heatmap with 64 weight levels). Force it into 5 silhouettes with names. See proposal #1.

## What I'd most want another persona to pressure-test
A **visual-designer** persona needs to tell me whether the Range Silhouette survives at 40px on a phone, in tournament lighting, during a long session with eye fatigue — because my legibility ratings assume clean perceptual conditions that the literature doesn't directly address for poker. And a **poker-theorist** persona needs to tell me whether my 5-prototype silhouette alphabet actually carves range-space at its real joints, or whether I've created a pretty taxonomy that loses the decisions that matter (e.g., does "Oval" collapse two strategically distinct range shapes into one chunk?). Chunkability is worthless if the chunks aren't diagnostic of the right choices.

## Sources
- [Chase & Simon (1973), Perception in Chess](https://andymatuschak.org/prompts/Chase1973.pdf)
- [Gobet & Simon (1996), Templates in chess memory](https://pubmed.ncbi.nlm.nih.gov/8812020/)
- [Gobet (1998), Expert memory: comparison of four theories](https://cognitivearchaeologyblog.wordpress.com/wp-content/uploads/2015/11/1996-gobet.pdf)
- [Miller (1956), Magical Number Seven](https://labs.la.utexas.edu/gilden/files/2016/04/MagicNumberSeven-Miller1956.pdf)
- [Cowan (2001/2005), Magical number four in working memory](https://pubmed.ncbi.nlm.nih.gov/15724362/)
- [Goldstone (1998), Perceptual learning](https://pubmed.ncbi.nlm.nih.gov/9496632/)
- [Goldstone & Hendrickson (2010), Categorical perception](https://wires.onlinelibrary.wiley.com/doi/10.1002/wcs.26)
- [Klein (1998), Recognition-Primed Decision model](https://www.gary-klein.com/rpd)
- [Kundel et al. / Drew et al., Holistic gist perception in radiology](https://pmc.ncbi.nlm.nih.gov/articles/PMC6603246/)
- [Sheridan & Reingold, Holistic processing in medical image perception](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2017.01620/full)
- [Paivio, Dual-coding theory](https://en.wikipedia.org/wiki/Dual-coding_theory)
- [de Groot, Thought and Choice in Chess](https://www.chessprogramming.org/Adriaan_de_Groot)
