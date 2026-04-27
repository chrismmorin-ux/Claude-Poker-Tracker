# Poker Coach: Shape-descriptor proposals

## Where my lens points
When a student freezes at the table, it's almost never because they don't know the math — it's because they can't *picture* the range. The students who jump a level are the ones who stop reciting "polarized" as vocabulary and start *seeing* the barbell in their head when villain overbets the river. So I watch for the moment a metaphor locks in — and I watch for the gap where a student keeps gesturing with their hands because no word exists yet. The descriptors that stick are the ones a student can redraw on a napkin between hands; the ones that die are the ones that need a chart to explain.

## Shape vocabulary already in the community
The shape-lexicon is richer than outsiders think, but it's fragmented across platforms. Upswing and GTO Wizard own **polarized** (nuts + bluffs, missing middle — picture a barbell), **linear / merged** (top-down continuous hierarchy — picture a staircase), **condensed** (mostly medium hands, extremes trimmed — picture a blob), **capped** (upper limit missing — picture a sawed-off top), and **uncapped** (Red Chip/SplitSuit emphasize this one — the tower still has its spire). GTO Wizard coined **range morphology** itself as the study of these shapes, and their **equity buckets** (0-25 / 25-50 / 50-75 / 75+) has become shorthand on Twitter for "what does this range *look* like." Downstream of those: **range advantage** (whose average is higher) vs **nut advantage** (who has more of the top combos) — Upswing and PokerCoaching.com treat these as orthogonal axes, which is already a two-dimensional shape concept. **Static vs dynamic boards** (Tournament Poker Edge, 888) is the texture dimension. Less formalized but alive in forum/Twitter vernacular: "**spiky**" range (Qing Yang-style — a few strong combos sticking up out of otherwise weak holdings), "**flat**" equity distribution (no one has much advantage), "**mountain**" / "**cliff**" equity curves (GTO Wizard's equity-distribution graphs have trained people to describe the plot shape itself), and "**equity realization**" / "**equity denial**" (Upswing, Red Chip) — conceptual but crying out for a visual word.

## Proposals (2-4 descriptors, table-usability-filtered)

### Spire
- **Definition (one line):** The small cluster of nutted combos sticking up out of villain's otherwise medium/weak range — the "uncapped" signature.
- **What it describes:** The *height* of nut-advantage regardless of range-advantage. Villain flatted preflop on the BTN? Their range is a blob *with a spire* of sets and straights on T98. The spire is what makes overbetting them dangerous and what makes big river bets credible from them.
- **Visual form:** 1D equity-distribution curve with a thin vertical tower at the 90-100% equity bucket. Like a plateau with a radio antenna.
- **Will a student use this at the table?** Yes — "does villain have a spire here?" is a yes/no question they can answer in 3 seconds. Replaces the clunky "is their range uncapped?" which students say but don't feel.
- **Data source in-codebase:** per-combo equity distribution → count combos in the top equity bucket; flag as "spire" when that count is small (< ~8% of range) but non-zero.
- **Self-rating:** precision 4 / legibility 5 / data coverage 5 / uniqueness 4
- **Prior art / citation:** Builds on Red Chip / SplitSuit "uncapped range" (https://www.splitsuit.com/capped-ranges-in-poker) and GTO Wizard equity buckets (https://blog.gtowizard.com/the-magic-of-equity-buckets/). The *word* spire appears informally on poker Twitter but isn't canonical.

### Saddle
- **Definition (one line):** A board+holding combination where hero's equity is high vs one part of villain's range and low vs another — no single action is right against the whole range.
- **What it describes:** The mixed-strategy zone. AQ on Q72r vs a fish: crushes their Qx and 7x, dominated by their slowplayed sets. That's a saddle — you're great one direction, terrible the other, and flat in the middle. Students intuit this ("I'm good vs some of his range") but have no word for it, so they freeze.
- **Visual form:** 2D equity surface over (villain sub-range × hero holding) — a saddle in the mathematical sense, high edges and a low middle. On the app: a heatmap strip with a visible trough.
- **Will a student use this at the table?** Yes, if we brand it cleanly. "This is a saddle spot — don't pot-commit" is a phrase a student can deploy. It also gives them *permission* to play small, which they need.
- **Data source in-codebase:** equity saddle surface from the seed list + board texture classifier; flag when hero equity vs top 30% of villain range differs from equity vs bottom 30% by more than ~35 points.
- **Self-rating:** precision 5 / legibility 4 / data coverage 4 / uniqueness 5
- **Prior art / citation:** No existing shape-word. Related concepts: "reverse implied odds" (Upswing https://upswingpoker.com/raw-equity-vs-realized-equity/), "way ahead / way behind" (Ed Miller's old Small Stakes Hold'em, 2004). Both describe the phenomenon verbally; neither gives it a shape.

### Ridge (of EV)
- **Definition (one line):** The narrow peak in the bet-size-vs-EV curve where the best sizing lives, with EV falling off on both sides.
- **What it describes:** Bet-sizing sensitivity. Some spots have a flat EV plateau (any reasonable size works, just bet); others have a sharp ridge (half-pot wins, 2/3 pot bleeds fold equity from weaker calls, overbet gets only nuts). Coaches say "sizing matters here" but it's binary. A ridge-vs-plateau distinction is what students actually need.
- **Visual form:** 2D line plot — EV on y-axis, bet-size-as-fraction-of-pot on x-axis. Ridge = sharp inverted V. Plateau = flat top. Cliff = monotone decline past some threshold.
- **Will a student use this at the table?** Partially. "Ridge spot, get the size right" is usable. The full curve is classroom-only; the *label* travels.
- **Data source in-codebase:** EV curves across bet sizes — already computed by game tree. Classify curve shape (ridge / plateau / cliff / ramp) as a derived tag on the sizing presets panel.
- **Self-rating:** precision 4 / legibility 4 / data coverage 5 / uniqueness 4
- **Prior art / citation:** CardRunnersEV visualizes these curves (https://www.cardrunnersev.com/) but doesn't name the shapes. GTO Wizard's c-bet sizing article (https://blog.gtowizard.com/the-mechanics-of-c-bet-sizing/) describes the phenomenon without the shape-word.

### Basin (equity landscape, turn→river)
- **Definition (one line):** The attractor zone on the turn where most rivers leave hero's equity roughly unchanged, with a few "escape" rivers that launch equity up (nut cards) or drop it off a cliff (villain-nut cards).
- **What it describes:** Runout volatility. A draw-heavy turn is a wide basin with steep cliffs — "what river card am I praying for / dreading?" is the student's real question. A stable turn is a deep narrow basin — most rivers don't matter. This tells you whether to barrel now or delay.
- **Visual form:** The owner's seed — a 1D equity-vs-river-card landscape with wells (bricks), peaks (hero's nuts), and sinkholes (villain's nuts).
- **Will a student use this at the table?** The word *basin* will. The full visualization is study-mode. At the table they'll ask "is this a cliffy runout?" which is the useful compression.
- **Data source in-codebase:** per-combo equity distribution iterated over all 44 turn→river cards; tag rivers as peaks / bricks / sinkholes.
- **Self-rating:** precision 5 / legibility 3 / data coverage 4 / uniqueness 5
- **Prior art / citation:** Closest existing concept is GTO Wizard's equity-distribution graphs across streets (https://blog.gtowizard.com/range-morphology/) and the "scare card" vocabulary (universal, but binary — a card either is or isn't a scare card; basin gives you the full landscape).

## Critique of the seeds — which survive contact with students?

**Range geometry on 13×13 (condensed oval / polarized barbell / capped triangle):** Survives but only as classroom scaffolding. Students already know "polarized" and "capped" as words; the *shapes on the 13×13* actually hurt at the table because the grid is backwards from how ranges feel — pocket pairs down the diagonal, suited up-right, offsuit down-left. Experienced coaches avoid the matrix for beginners for this reason. Keep for study mode, drop for live play.

**Equity saddle surface over (board texture × hero holding):** This is gold — becomes my **Saddle** proposal. The seed is correct; it just needs a one-word handle.

**EV-ridge over bet-size:** Strong — becomes my **Ridge** proposal. The seed already names the shape well.

**Stacked preflop ranges with narrowing edges:** Beautiful for study, dead at the table. Students don't think about preflop as "narrowing edges" in the moment — they think in buckets (opens, 3-bets, calls). Use this for the replay/post-session review surface, not for live advice.

**Flop→turn equity basin-landscape:** Becomes my **Basin** proposal. The shape-word is what's missing from the seed; the concept is right.

## The metaphor-shaped hole I see
The single biggest unmet need is a **word for equity volatility across runouts** — a way to say "my equity is stable here" vs "my equity is a coin flip on every turn card." Coaches describe this every lesson ("this turn is huge for hero" / "this runout doesn't change much") and it drives half of all barrel vs check-back decisions, but there's no canonical shape-word. "Basin" above is my proposal. The deeper concept is something like **equity variance across the card-space** — the analog of volatility in finance. Students feel it viscerally (the "oh no, any heart kills me" moment), so the word would land instantly if it's right. "Cliffy" and "stable" are the lay descriptors I'd test as the two poles.

## What I'd most want another persona to pressure-test
The visualization designer / information architect. My proposals are named well (I think) but the *rendering* matters — a Saddle heatmap that looks like a rainbow vomited on the screen will fail no matter how good the label is. I need someone who'll ask "what's the minimum ink to convey a saddle in the peripheral vision of a player at a table?" Specifically: Basin and Saddle both risk becoming pretty-but-unreadable chart-porn. Ridge and Spire are more robust to bad rendering because they compress to a single tag. Someone should challenge whether Saddle and Basin survive as table-usable, or whether they're classroom-only and I'm kidding myself.

## Sources
- [Range Morphology — GTO Wizard](https://blog.gtowizard.com/range-morphology/)
- [Polarized Ranges vs Linear (Merged) Ranges — Upswing Poker](https://upswingpoker.com/polarized-vs-linear-ranges/)
- [The Magic of Equity Buckets — GTO Wizard](https://blog.gtowizard.com/the-magic-of-equity-buckets/)
- [Interpreting Equity Distributions — GTO Wizard](https://blog.gtowizard.com/interpreting-equity-distributions/)
- [What Are Capped Ranges In Poker — SplitSuit](https://www.splitsuit.com/capped-ranges-in-poker)
- [Capped Ranges — Thinking Poker](https://www.thinkingpoker.net/articles/capped-ranges/)
- [Hand Reading for Beginners: Capped vs Uncapped — PokerStars Learn](https://www.pokerstars.com/poker/learn/strategies/hand-reading-for-beginners-capped-vs-uncapped-ranges/)
- [Mastering Range Advantage — PokerCoaching.com](https://pokercoaching.com/blog/range-advantage/)
- [Nut Range Advantage Module — Upswing Poker](https://upswingpoker.com/sneak-peak-new-lab-module-nut-range-advantage/)
- [Positional, Range, and Nut Advantages — Upswing Poker](https://upswingpoker.com/nut-range-positional-advantage/)
- [Practical Range Advantage — SplitSuit](https://www.splitsuit.com/practical-range-advantage)
- [Equity Realization — Upswing Poker](https://upswingpoker.com/equity-realization-explained/)
- [Equity Denial — Upswing Poker](https://upswingpoker.com/equity-denial-poker-strategy/)
- [Raw Equity vs Realized Equity — Upswing Poker](https://upswingpoker.com/raw-equity-vs-realized-equity/)
- [Equity Realization — Red Chip Poker](https://redchippoker.com/equity-realization/)
- [Equity Distributions Guide — PLO Poker Coaching](https://www.plopokercoaching.com/articles/demystifying-poker-equity-distribution-a-comprehensive-players-guide)
- [The Mechanics of C-Bet Sizing — GTO Wizard](https://blog.gtowizard.com/the-mechanics-of-c-bet-sizing/)
- [CardRunnersEV](https://www.cardrunnersev.com/)
- [Board Texture — MasterClass](https://www.masterclass.com/articles/what-is-board-texture-in-poker)
- [Static and Dynamic Board Textures — Tournament Poker Edge](https://www.tournamentpokeredge.com/static-and-dynamic-board-textures-in-poker/)
- [Poker Board Textures — 888poker](https://www.888poker.com/magazine/poker-board-textures)
- [Preflop Range Morphology — GTO Wizard](https://blog.gtowizard.com/preflop-range-morphology/)
