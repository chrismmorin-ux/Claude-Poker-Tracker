---
version: '2.5'
last_verified: 2026-07-22
verified_by: cwos-domain-correctness-sweep-2026-07-22
verification_protocol: "/pulse run domain-correctness baseline"
review_cadence_days: 90
next_review: 2026-09-18
governing_program: prog-domain-correctness
governance_yaml: .claude/workstream/programs/prog-domain-correctness.yaml
changelog:
  - date: 2026-08-16
    version: '2.5'
    change: "WS-445: added §17 — A LABEL IS A FOUNDATION CLAIM, AND IT SHIPS WITH ITS EVIDENCE TIER. §7.1 and exploitEngine/CLAUDE.md have forbidden label-shaped decision inputs in four separately documented forms, with worked examples, for months. Measured at HEAD 2026-08-16: a fresh-context survey found 49 label families and an AST harvest found 145 label-shaped constructs across 506 files, 42 of 128 keyed tables (33%) module-private. Prose was tried and did not work, so §17 ships as mechanism: `src/utils/standardOfRecord/labelLedger.js` (data), `docs/standard-of-record/LABEL-AND-FOUNDATION-LEDGER.md` (prose, bound to the module by an exact-order drift test), and `scripts/standardOfRecord/check-label-ledger.mjs` (blocking gate, wired into smart-test-runner.sh AND ci.yml in the same commit — FIND-086's lesson that a gate in no pipeline buys nothing). THE REFRAMING WS-436 FORCED: removing the six style labels cost nothing (ΔLL −0.00076 over 10,147 paired decisions, n.s.; advice-parity at exactly n=0 changed decisions) but the continuous full-resolution replacement was significantly WORSE (ΔLL −0.00691, t=−5.64) — so discretisation was never the defect, the same-source seed was. A label is therefore a claim about PROVENANCE, and §17 binds that the claim be stated and ranked. Three evidence tiers: MEASURED (a Result Card exists), BOUNDED (a bound whose method is from a closed set, rendered with a ≤/≥ glyph), UNMEASURED (NO EV figure, ranked by reach). The unmeasured guard is a SHAPE not a rule — buildUnmeasuredReach mints no EV key, so the field is undefined rather than null and there is no slot for a future relaxation to unlock. Five foundation statuses rather than two, because `measured-refuted` is a distinct fact from `undeclared`: FOLD_CURVE_STREET_MODS (villainModelData.js:412, read foldEquityCalculator.js:329) was measured, NOT supported (Brier flop 0.23668 → 0.23723) and still ships — a defensible call at ~5e-4, recorded in v2.3, but previously discoverable only by reading one docblock. Blind-spot rule inverted deliberately: a ledger with ZERO unmeasured rows or ZERO open instrument gaps FAILS its own self-check, because the naive direction rewards relabelling. Known limits stated in §17.3 rather than papered over: threshold-as-label (getSPRZone manufactures its zones from SPR_BAND_EDGES with no string literal at the decision site) is inherited and NOT closed; runtime-assembled and storage-read labels are invisible. Seed rows: REALIZATION_TABLE (30 cells, every showdown EV, no provenance — and already carrying THREE separately-filed instrument tickets, WS-404/407/498, none referencing the others), BUCKET_MIDPOINT (deviationMap.mjs:42, unprovenanced and inside the MEASUREMENT path where it sets the floor every deviation cell is scored against), FOLD_CURVE_STREET_MODS, plus ACTION_TAU_FRACTION and handhqReferencePool as strong-row counter-examples. 140 of 145 constructs remain EXCLUDED:not-yet-triaged, owned by WS-445, expiring at 90 days."
  - date: 2026-08-12
    version: '2.4'
    change: "WS-436: the six classifyStyle labels are no longer engine decision inputs anywhere — §7.4's hierarchy loses its style tier (now: decision model → continuous shrunk posteriors → population, two SEPARATE pipelines consumed mutually exclusively), and §11.1's fold-curve resolution loses FOLD_CURVE_PARAMS[style] (personalized || population; the fit regularises toward the measured population shape). Measured basis, 10,147 paired corpus decisions (online 2009 — transferred, not measured, for live): the style-conditioned Dirichlet seed carried ZERO villain-action information (ΔLL −0.00076 vs population, n.s.), and the continuous shrunk-posterior seed built to replace it was REFUTED as significantly worse (ΔLL −0.00691, t=−5.64) — the label was a lossy quantisation of stats computed from the SAME hands the model's buckets count, so any same-source seed double-counts; §7.4 now states that generalised rule. Deleted from code: STYLE_PRIORS, STYLE_STEEPNESS_MULT, STYLE_RAISE_PARAMS, STYLE_BET_CENTER, STYLE_FOLD_DEFAULTS, computeFoldCurveForStyle + per-style FOLD_CURVE_PARAMS (all founder estimates; the three depth-2 tables had been dormant their whole life behind a never-threaded sampleSize ramp). Replacements are continuous with exact n=0 population identities, asserted by test: villainFoldLevel (A1), aggFreq multiplicative raise-mass transfer, shrunk.cbet inverse-ratio bet-center transfer, and a mutually-exclusive villainFoldLevel tier-2 in the depth-2 model blend. The engine's playerStats struct no longer carries a style field at all. The clustering evidence (k=2, silhouette 0.343; 21.1% Unknown fallthrough; docs/research/player-archetypes-empirical-2026-07-26.md) stands as the partition refutation; display categorization is greenfielded separately (WS-447). Evidence: .claude/workstream/evidence/ws436-baseline.md §4a-4b."
  - date: 2026-08-05
    version: '2.3'
    change: "WS-283: added §11.1a — THE FOLD CURVE'S SHAPE IS MEASURED, ITS LEVEL IS NOT. `POPULATION_CURVE` was a founder estimate and was wrong in two ways that a base-rate correction cannot reach. (1) `logisticFoldResponse` returns `baseFold` at `fraction === midpoint` and nowhere else, while every caller passes an UNCONDITIONAL fold rate — so the midpoint must be the sizing at which the field's conditional fold rate equals its unconditional one. That is 0.35x pot, measured; it shipped at 0.75x, above 71% of all real bets, so the model subtracted from the base at nearly every sizing that occurs and the error changed SIGN with bet size. The docblock had meanwhile claimed `baseFold` was the rate at half pot — a stated contract the code contradicted for the life of the parameter. (2) `maxDelta` bounds the TOTAL swing, and at 0.25 the curve could span 25 points of fold rate while the field spans ~78 (6.4% fold at 0.03x pot, 84.2% at 2.0x) — no other parameter could compensate for a ceiling below the signal. Refitted by Brier minimisation on POOL players days 1-11 (k=98,273/n=178,174) and scored on EVAL players days 12-23 (k=178,794/n=318,347), a two-level structural leakage guard: maxDelta 0.25->0.95, midpoint 0.75->0.35, steepnessUp/Down 4.0/2.0->6.5/0.75. Residual-vs-sizing slope on the hold-out, intercept calibrated out so only shape is scored, +0.1409 -> +0.0078; Brier 0.24054 -> 0.23530; the ticket's 33-66% bucket +6.1pp -> -2.0pp on 202,261 decisions. ONLY THE SHAPE MOVED: the corpus is online cash July 2009 and the founder plays live 9-handed 1/2-1/3, so under the ratified WS-259 separation an online-mined gradient may inform a live model while an online base rate may not — POPULATION_PRIORS.bet.fold and STAT_PRIORS.foldToCbet are untouched, and with the base pinned at the live 0.45 estimate the shape correction closes about half the 17.3pp bucket error, the rest being the live/online level gap this corpus may not close. Also records that the WS-273 harness's flat prediction was NOT the fold curve: `queryActionDistribution` takes no bet-size argument, so its prediction is sizing-independent by construction and no curve change can move its lift. Two copies of the old midpoint were found downstream: `preflopFoldResolver` had linearised the pot-fraction->pot-odds change of variables at 0.75, which tripled the preflop response and clamped squeeze fold-through (now applies the map exactly, `f = r/(1-2r)`, deleting the constant); `gameTreeEquity.multiwayFoldPct`'s `betFraction = 0.75` default is reachable only from tests and is recorded, not fixed. NULL RESULT recorded rather than acted on: FOLD_CURVE_STREET_MODS refit per street returns the same shape on all three, and the shipped multipliers make the hold-out worse (~5e-4) — values unchanged, poker-theory justification withdrawn. Result Card RC-WS283-FOLD-CURVE-SHAPE-2026-08-05; hold-out pinned as a fixture in `foldCurveShape.test.js`, four assertions of which fail against the previous constants."
  - date: 2026-08-05
    version: '2.2'
    change: "WS-366: extended §2.1's support boundaries with a third — THE SUPPORT MAY SOFTEN A SHAPE, IT MAY NOT RE-DECIDE ONE. WS-302 established that `withEquitySupport` preserves range WIDTH; measured now, it was not preserving the shape. `softContinuationWeights` derives its logistic sharpness from `TAU_FRACTION × IQR of the scores`, a statistic measured for the POSTFLOP caller whose scores are per-combo equities across a continuing range and are roughly symmetric. Preflop the scores are a range SHAPE concentrated at the top of the field, so both quartiles sit inside the folded tail: on the LATE 3-bet prior the shape ran 0 to 0.935 with an IQR of 0.012, giving tau = 0.0037 and a logistic that was a STEP rather than a soft boundary. A step saturates everything above it, and the mean-pin puts that step where the grid's own WIDTH says — so a WIDE grid lost its entire tier structure and a NARROW one kept its. Section 5.8's deliberately-uncapped `limpReraise` prior therefore shipped its 1.00/0.25 doctrine tiers as 1.00/~0.83, a 4:1 gap delivered as 1.18:1. The section 2.5.3 carve divides the parent by the ratio between sibling shapes, so what then decided each cell was WHERE EACH SIBLING'S STEP FELL — a function of range width, not of doctrine. Measured at LATE, zero observations, carved `limpReraise`: 88 at 0.0370 against QQ at 0.0202 (1.8x the wrong way), with AKo, AQs, AJs and AQo also above QQ and KK four places below AKo; same signature at MIDDLE, SB and BB and in carved `cold3Bet`; worst at LATE because SUBCLASS_SPLIT.threeBet.LATE.limpReraise = 0.06 is the thinnest split, so the shape term carries the most of the apportionment. A villain who limp-reraises being put on 88 as readily as on QQ inverts the one preflop line whose entire doctrinal content is 'this range contains monsters', and it is the trait (`trapsPreflop`) that tells the exploit layer the range is uncapped. FIX: the sharpness is DERIVED from `SUPPORT_BANDWIDTH`, the only width this section names — tau = SUPPORT_BANDWIDTH x (S_max - S_min), which is one smoothing bandwidth of equity transported onto the score axis (a monotone smoothed shape covers its full range across the full equity spread, so one bandwidth spans SUPPORT_BANDWIDTH of that range; the equity spread cancels). The logistic must not resolve finer than the Nadaraya-Watson smoother that produced its scores, nor coarser. Nothing is tuned and nothing is per-position. Consistency check, not a second derivation: on a symmetric score distribution 0.3 x IQR is 0.15 x range for a uniform and 0.06 x range for a Gaussian at n = 1326, so 0.12 is the same sharpness regime the postflop caller measured, computed from a statistic that survives skew. Scope: only the preflop caller moves — `softContinuationWeights` gains an explicit `tau` option and postflop keeps its separately-measured ACTION_TAU_FRACTION. Range width is BIT-IDENTICAL after the change at every position x action, and every live cell stays strictly positive (the WS-302 converse: `bayesianUpdater` multiplies, so a restored ordering bought by zeroing the tail would be the worse bug). Ordering after: QQ+ lead the carved `limpReraise` and `cold3Bet` grids at every position. Two honesty notes. (1) The 1.00/0.25 tier gap is NOT fully restored and cannot be at the shipped PRIOR_SUPPORT_LAMBDA = 0.8, where four fifths of the prior IS the support — the tier body now ships at 0.22-0.28 against QQ at 0.87, but the cell immediately below the boundary is legitimately smoothed upward by SUPPORT_BANDWIDTH doing its declared job. The residual gap is a lambda statement, and lambda was deliberately not moved. (2) Within QQ+ the carved ordering is no longer pinned to AA: section 5.8's prior gives every QQ+ cell weight 1.00, so where the child's tier is flat and the parent's is a ramp the share rises exactly as the parent falls — at lambda 0 the doctrine separates AA from KK in the carve by 1.4%, which a frequency update consumes. That within-tier order was never a doctrine claim and the test that pinned it has been re-anchored to 'a premium leads'."
  - date: 2026-08-05
    version: '2.1'
    change: "WS-337: added §16 — THE EQUITY OPERATOR IS ANTISYMMETRIC. E(a,b)+E(b,a)=1 makes S = M - 1/2 exactly skew-symmetric (measured: max|M+M^T-1| = 0, BIT-EXACT on both of two independently seeded 20,000-board builds), which forces three theorems rather than three modelling choices: no real eigen-axes, a canonical decomposition into at most 84 two-dimensional rotation planes (each one rock-paper-scissors cycle with a magnitude), and 169 odd so one dimension has no partner. Promotes the decomposition from a research script to a first-class object: src/utils/pokerCore/equityOperator.js (construction + the exact arithmetic) and equitySkew.js (the shipped artifact reader), with the intransitivity map committed as a 169-cell grid in data/equitySkewDecomposition.js indexed exactly like every range grid. Three corrections to the exploratory measurement it builds on: (1) the transitive/intransitive split is now the exact ORTHOGONAL projection (potential f = Sw = average equity - 1/2, no fitted scalar, Pythagoras residual < 2e-15) rather than a scalar fitted to a unit-normalised strength vector under a different inner product — 74.01/25.99 weighted, 75.28/24.72 unweighted; (2) plane AXIS loadings are basis-arbitrary and are no longer reported, only plane magnitudes and per-class radii, which are the invariants; (3) plane significance is now a MEASURED threshold — two seeds give a statistically exact noise replica (S_A-S_B)/2, whose top singular value 1.353e-3 admits 28 of 84 planes (99.93% of skew energy). Records two honesty corrections to the ticket's own framing: at 13 planes the mean reconstruction error is 1.07pp but the MAX is 16.18pp, and the intransitivity map spans only 7.14-11.52pp (ratio 1.61), so 'the trash is a pure strength ladder' is NOT supported — the map licenses a ranking, not a partition. buildCompressionClaim refuses in CODE any claim reporting energy share without reconstruction error and the transitive/intransitive split. The 169-grid remains authoritative; low-dimensional coordinates ship as an additional lens carrying their measured residual, and the estimation claim (log-loss vs the 169-cell ladder on HandHQ under the two-level split) is NOT YET RUN and therefore unknown rather than favourable."
  - date: 2026-07-30
    version: '2.0'
    change: "WS-276 (SPR-161): added §12 — HERO'S RANGE, AND WHAT VILLAIN THINKS IT IS. The engine priced every villain fold/call decision from `1 - combo.heroEquity`, i.e. that villain combo's equity against hero's EXACT TWO CARDS, so villains were modelled as able to see hero's hand. The anecdote that motivated the ticket (a villain folding a made straight to a BTN 3-bettor's river shove) understates the defect: measured on a river board, equity against a known holding is DEGENERATE — exactly 0, 0.5 or 1 — so the model gave every opponent flawless knowledge of whether they were beaten, erring in BOTH directions (AT top pair 0.000 → 0.393 vs a perceived range; A9 two pair 1.000 → 0.583). Any weakness inferred from those predictions inherited the bias. Fix: a parallel per-combo field `villainEquityVsPerceived` computed against hero's perceived range, with `heroEquity` retained for hero's own EV; one builder (heroRangeBuilder.js) seeded from the §2.5 population prior for hero's line and narrowed by the same `narrowByBoard` villain ranges use, so §3.6.1's never-zero guarantee applies for free. Evidence enters as an observed frequency shrunk by n/(n+PRIOR_WEIGHT) per §6.5 — never as an image label (§7.1/§7.2) — and is per-villain. ZERO observation history is the load-bearing case, not a degraded one: a typical BTN 3-bet + three barrels contains the Broadway combos regardless of what anyone watched. Also adds §12.4 bluff:value construction from sizing (s/(1+2s); half pot 3:1, pot 2:1, 2x overbet 1.5:1) shipped as a BASELINE the exploitative deviation is measured against, never a prescription (WS-310 Layer A discipline). Records two boundaries honestly: §12.5 recursion stops at level 2 deliberately, and §12.6 v1 corrects the CURRENT node only — depth-2/3 future-street branches retain a residual omniscience bias because a perceived range at a future node needs hero's strategy there, which WS-301's breached timing budget cannot absorb. River decisions are fully corrected. Measured cost: flop 1.67x, turn 1.94x, river 1.03x. §12.7 records that the motivating shove was read-dependent and NOT balanced-correct, and forbids tuning the model until it agrees folding a straight was right."
  - date: 2026-07-28
    version: 1.9
    change: "WS-291 (SPR-158): added §3.6.1 — A RANGE NEVER ASSIGNS ZERO, binding. `narrowByBoard` implemented the §6.5 likelihood P(action|hand) as a hard 1/0 quantile cut (keep the top `continuationRate` by equity, zero the rest), re-applied every street and again inside each depth-2/3 evaluation. Measured against revealed showdown hands on two independent sites: coverage of the hand actually held decayed 89% → 71% → 56% flop-to-river and 72% → 58% → 47% under chaining; facing a RAISE it retained 10.8% of combos and missed the true hand 45% of the time, so the engine could not represent a bluff-raise at all and hero systematically OVER-FOLDED to raises (§4.2 makes bluff-catching depend on exactly that frequency). Replaced by a logistic of per-combo equity whose mean is pinned to the observed continuation rate — severity unchanged in aggregate, but 'unlikely' replaces 'impossible'. After: coverage ~94% flat by street, 94% facing a raise, ~89% flat under chaining. Floor (0.05) and softness were SWEPT against the discrimination metric, not chosen. Third instance of the same threshold-instead-of-posterior shape after §11.5 (WS-285) and §7.6/AP-RL-01. Records two open residuals honestly: preflop ranges still hard-zero 30–37% of the grid (WS-302), and the check branch plus deep chaining remain close to information-free (WS-303)."
  - date: 2026-05-01
    version: 1.0
    change: "Frontmatter header added (FIND-003 / WS-118). Doc content unchanged. Subsequent edits MUST bump `version` and add a changelog entry recording what changed and why."
  - date: 2026-06-19
    version: 1.1
    change: "Added §10 Tournament Theory & ICM (chips≠dollars, Malmuth-Harville, risk premium as a derived quantity, push/fold as $EV, M-ratio as descriptor not driver, multi-table approximation honesty, satellite inversion, anti-patterns). Governs the new src/utils/icmEngine/. Tournament-strategy program kickoff; prior doc was cash-only."
  - date: 2026-06-20
    version: 1.2
    change: "domain-correctness delta run reconciled two theory-vs-code drifts: §6.5 PRIOR_WEIGHT corrected ~5 → ~10 (FIND-013; matches populationPriors.js + all sibling docs), and added §11 Implemented Engine Algorithms documenting the personalized fold-curve hierarchy, SPR zones + continuous sizing multiplier, and rake-adjusted EV (FIND-012; code was ahead of the doc). No code changes."
  - date: 2026-07-22
    version: 1.3
    change: "domain-correctness sweep (run-sweep-2026-07-22 / FIND-034 / WS-257): added §6.5a documenting the 3-tier empirical prior hierarchy shipped in WS-235 (founder estimate → segmented pool aggregate via poolBaseline.js → per-villain Read), incl. the live/online segmentation rule, the leave-one-out guard, and the pseudocount-cap semantics. Doc-only; code was ahead of the doc."
  - date: 2026-07-25
    version: 1.4
    change: "WS-263 (WS-262 mass-data follow-up #1): §6.5a rewritten Three-Tier → Four-Tier — imported HandHQ Reference tier (SRC-011, online numeric-stake segments only, nearest-stake by log distance, per-villain seat-bucket lookup) inserted between founder estimate and founder-observed pool. Flat POOL_PRIOR_MAX_PSEUDOCOUNT=200 removed (WS-262 refuted it ~20× too confident); replaced by measured per-stat prior weights PER_STAT_PRIOR_WEIGHT (10–35) from between-player overdispersion — the 'hierarchical τ² future upgrade' the previous version promised is now delivered. Code + doc landed same session."
  - date: 2026-07-25
    version: 1.5
  - date: 2026-07-26
    version: 1.6
    change: "WS-256 pre-close review: §2.5.3 rewritten. The shrinkage rule now binds in TWO dimensions — the split estimated conditionally against n_parent (not the scenario-wide N), and the subclass GRID carved out of the parent's grid rather than built independently. Fixes a defect where children exceeded their own parent (limpReraise[QQ]=1.00 vs threeBet[QQ]=0.58; Σ children > parent in 151/169 cells) and one observation swung a range ~300%. Adds the measured guarantees (containment; 23.3% single-observation shift, inside AS-2's 25% band) and records the cost of containment: parent priors predate the taxonomy and are narrower than the union of their children, so a child's shape is expressed only within the parent's support. Ratified as DEC-025 Amendment 1."
  - date: 2026-07-25
    version: 1.5
    change: "WS-256: added §2.5 Derived Preflop Line Taxonomy — the founder's cold-3bet-vs-3bet doctrine generalized into sequence-state-derived line classes (openFirstIn/isoRaise; cold3Bet/squeeze/limpReraise), expected range shape per class, the hierarchical sparse-data shrinkage rule (subclass prior = parent posterior × doctrine split, mirroring §6.5a), and the per-decision-point extraction rule that keeps limp-reraise hands counted in the limp range per §5.8. Records the founder decision to merge blind3Bet into cold3Bet (the position dimension already carries posted money) with the straddle residual noted; §2.5.5 flags the facing-3-bet tree as unmodeled (WS-270, high priority). Doc authored ahead of the code per the ticket's design-first gate."
  - date: 2026-07-26
    version: 1.8
    change: "WS-274 (SPR-155): preflop advice now derives from the ACTUAL table. §2.1 amended — position opening charts are demoted to the unobserved-seat prior; the canonical path resolves each live seat behind hero through the §6.5a hierarchy. Adds §11.4 deriving the fold-through chain rule and naming its mean-field card-removal approximation honestly (it is strictly better than the independence product and strictly weaker than an exact joint). Motivating defect: `preflopAdvisor` reduced the seats behind hero to a COUNT and priced every one of them with an invented constant (85% fold facing a 3-bet, 70% facing a squeeze, 4% 3-bet rate), so opening 76s from the hijack produced identical advice against three nits and three loose-passive callers — while the app held a full model for each of those seats. Also records that INV PFA-EC-002's raise-pressure claim moved from a ×0.85 multiplier on the finished Bayesian posterior (a label overriding observed data) into the PRIOR, where observations can outvote it."
  - date: 2026-07-26
    version: 1.7
    change: "WS-256 (SPR-154): §3.4 rewritten Three Motivations → Four. PROTECTION / EQUITY DENIAL added as a first-class betting motive — it is neither value (which profits from a CALL) nor a bluff (which is BEHIND); it profits from hands with live equity folding while the bettor is ahead. Adds §3.4.1 reconciling protection's size-UP rule with §4.1's thin-value-sizes-DOWN rule (they optimize different terms of §6.1 — call-equity vs denial), and §3.4.2 making expressibility of protection BINDING on any motive classifier, because a missing category misfiles rather than blanks. Inducing recorded as the inverse fifth motive. Adds §8 mistake #14. Found by asking the open completeness question by hand, not by the code-vs-doc sweep — the code faithfully implemented an incomplete doc, which is the structural gap WS-272 exists to close. Motivating defect: weaknessDetector flagged correct wet-board protection bets as 'C-bets unprofitably on wet boards' and 'Over-values medium hands'."
---

# Poker Theory Reference — Mandatory Reading for Analysis Edits

Read this file before modifying ANY file in `exploitEngine/` or `rangeEngine/`. This is not optional.

> **Drift policy.** This doc is canonical doctrine. If an engine implements a formula, threshold, or algorithm that doesn't appear here — or vice versa — that's drift. Either update this doc with an ADR-backed citation or open a finding. The `prog-domain-correctness` baseline + sweep protocols cross-check engine code against this file every 14 days; the `last_verified` field above must advance on each pass.

---

## 1. Fundamental Concepts

### 1.1 Ranges, Not Hands
Expert players think in ranges — the set of all hands a player could hold given their actions. A player who opens from UTG could have AA-TT, AK-AJ, KQs — not "probably AK." Every analysis in this app operates on ranges, never individual hands.

### 1.2 Expected Value (EV)
Every poker decision has an EV: the average profit/loss if the decision is repeated infinitely. EV = Σ(probability_i × outcome_i). A +EV play is profitable long-term even if it loses this particular hand.

### 1.3 Equity
The probability of winning the pot at showdown. Equity changes with each street as more cards are revealed. Pre-flop, AA has ~85% equity vs a random hand but only ~65% vs a calling range.

### 1.4 Equity Realization
Not all equity is captured. Factors that reduce realization:
- **Position**: OOP (out of position) players realize less equity (act first, less information)
- **Suitedness**: Suited hands realize more (flush draws provide protection and win big pots)
- **Connectedness**: Connected hands realize more (straight draws provide outs)
- **Stack depth**: Deeper stacks allow more equity realization (more decisions = more skill edge)
- **Multiway**: Equity realization drops in multiway pots (harder to bluff, more opponents to beat)

**Impact on ranges**: This is why suited connectors are in wider ranges than their raw equity suggests — they realize equity well. And why offsuit disconnected hands (K7o) are folded despite reasonable equity — they realize poorly.

### 1.5 Pot Odds and Implied Odds
**Pot odds**: What the pot offers for a call. Calling $10 into $30 = 3:1 odds. Need 25% equity to break even.

**Implied odds**: Expected future winnings beyond the current pot. A set-mining call needs ~15:1 implied odds (you hit a set ~1 in 8 times, need to win 15x your call when you do). This justifies calling with small pairs despite bad immediate pot odds.

**Reverse implied odds**: When you can make a hand that LOSES a big pot. Top pair weak kicker has reverse implied odds — when you hit, better hands also hit.

---

## 2. Preflop Theory

### 2.1 Position-Based Opening Ranges
Ranges widen dramatically with position because later positions have:
- Fewer players left to act (lower chance of running into a premium)
- Positional advantage postflop (act last = more information)

**These charts are the UNOBSERVED-SEAT PRIOR, not the answer (WS-274).** They describe
what a typical unknown player opens. When the app knows who is actually sitting behind
hero — and at a live table it usually does — the canonical path resolves each of those
seats through the §6.5a fidelity hierarchy and computes hero's opening decision from the
fold-through those specific seats produce. A chart cannot encode that opening 76s from
the hijack is a different decision with three loose-passive callers behind than with
three nits, because no chart knows the table. See §11.4.

**And the prior has SUPPORT EVERYWHERE — no cell is zero (WS-302).** A chart names the
hands a player *usually* opens. Read literally as a prior it also said the other 30-37%
of the grid was **impossible**, which is a different and much stronger claim. It is also
unfalsifiable: `bayesianUpdater` updates ranges as `prior[i] * ratio`, a pure
multiplication, so a cell that starts at zero can never be moved off zero by any amount
of frequency evidence. A starting belief of zero is not a prior, it is a permanent
verdict.

The hands the charts excluded are exactly the ones a live 9-handed player shows up with
off-chart — a limped 84s from early position, a defended K3o in the blinds. Measured
against revealed showdown hands, those exclusions were the entire residual gap in range
coverage once WS-291 fixed the postflop side.

Every position × action prior now carries positive weight on all 169 cells, ranked by
per-combo preflop equity (`pokerCore/preflopEquityTable.js`) rather than flat, so 22
outranks K3o outranks 72o. **Range width is unchanged** — the support is blended in at
equal combo-weighted mean, so a rate derived from observation is not silently rescaled.
Implementation: `withEquitySupport` in `rangeEngine/populationPriors.js`.

Two boundaries hold this in place:
- **Structural zeros stay zero.** A grid that is *identically* zero describes a scenario
  that cannot occur, not a range with holes — BB has no voluntary no-raise action, so it
  cannot limp (`rangeEngine/CLAUDE.md` §5). Support fills holes in a range; it must never
  invent a range for an impossible scenario.
- **Narrow ranges stay narrow.** The floor self-limits to 90% of the grid's own width, so
  the ~1%-wide 3-bet prior floors near 0.001, not 0.05. §2.3's "a 3-bet from a typical
  live player is almost always a monster" survives — 72o becomes rare, not plausible.
- **The support may soften a shape; it may not RE-DECIDE one (WS-366).** Unchanged width is
  not the same as unchanged shape, and for two years it was not. `softContinuationWeights`
  sets its logistic sharpness from a fraction of the **IQR of the scores**, which is the
  right statistic postflop, where the scores are per-combo equities across a continuing
  range. A preflop prior is a *range shape* concentrated at the top of the field, so both
  quartiles fall inside the folded tail: measured on the LATE 3-bet prior the shape ran
  0 → 0.935 with an IQR of 0.012, giving `tau = 0.0037` and a logistic that was a **step**.
  A step saturates everything above it, and its position tracks the grid's own WIDTH
  (the mean is pinned to it) — so a wide grid lost its whole tier structure while a narrow
  one kept its. §5.8's deliberately-wide `limpReraise` prior shipped its 1.00 / 0.25 tiers
  as 1.00 / ~0.83, and the §2.5.3 carve — which divides the parent by the ratio between
  sibling shapes — then let a sibling's *step position* decide the cell. Measured at LATE,
  zero observations, carved `limpReraise`: **88 at 0.0370 against QQ at 0.0202**, with AKo,
  AQs, AJs and AQo also above QQ; the same signature at MIDDLE, SB and BB, and in carved
  `cold3Bet`. The sharpness is now DERIVED from `SUPPORT_BANDWIDTH`, the smoother's own
  declared resolution: `tau = SUPPORT_BANDWIDTH × (S_max − S_min)`, one bandwidth of equity
  transported onto the score axis. The logistic must not resolve finer than the smoother
  that produced its scores, nor coarser. Range width is bit-identical after the change at
  every position × action; the ordering is not. See `supportTau` in `populationPriors.js`.

Typical full-ring ranges (9-handed):
| Position | Open Range | ~% of hands |
|----------|-----------|-------------|
| UTG | 77+, ATs+, KQs, AJo+ | ~12% |
| UTG+1 | 66+, A9s+, KJs+, ATo+, KQo | ~14% |
| MP1 | 55+, A8s+, KTs+, QJs, ATo+, KJo+ | ~17% |
| MP2 | 44+, A5s+, K9s+, QTs+, J9s+, ATo+, KJo+ | ~20% |
| HJ | 33+, A4s+, K8s+, Q9s+, J9s+, T9s, 98s, ATo+, KTo+, QJo | ~24% |
| CO | 22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, A9o+, KTo+, QTo+, JTo | ~30% |
| BTN | 22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, A7o+, K9o+, Q9o+, J9o+, T9o | ~40% |
| SB | ~35% (tighter than BTN due to OOP) | ~35% |
| BB | Defends vs raises ~40-50% | ~40-50% |

### 2.2 The Limping Problem (Live Poker)
GTO says never limp from any position. But live low-stakes players limp frequently:
- **Why they limp**: See cheap flops with speculative hands, trap with premiums, avoid committing chips
- **What limp ranges typically contain**: small pairs, suited connectors, suited aces, random suited hands, occasionally premiums (traps)
- **Why it matters for exploits**: Limp ranges are usually WEAK (but not always capped). The exploit is to iso-raise for value, but ONLY after confirming the range is capped (no premiums).

### 2.3 3-Betting Theory
A 3-bet (re-raise preflop) is typically either:
- **Value 3-bet**: QQ+, AK — expecting to be called by worse
- **Bluff 3-bet (light 3-bet)**: A5s, 76s — fold equity + playability if called
- **Polarized range**: value + bluffs, no medium hands (GTO approach)
- **Linear/merged range**: value + good hands, no bluffs (exploit approach vs stations)

Live low-stakes: most players 3-bet only premiums (QQ+, AK). A 3-bet from a typical player is almost always a monster. This is exploitable — fold non-premium hands to their 3-bet.

**The prior did not contain AK, for five years (WS-304, binding).** Measured at `PRIOR_SUPPORT_LAMBDA = 0` — the shipped prior's own shape, before WS-302's support — the EARLY 3-bet prior read `AA=1.0000 KK=0.7159 QQ=0.4318 JJ=0.1477 AKs=0.0057 AKo=0.0000`. AKo ranked **157th of 169**. A villain who 3-bet and turned over AK was, per the model, holding a hand they could not have had — one of the two holdings this very section names.

The cause was the ordering the branch thresholded on, not the threshold: `(rank1 + rank2 + 8·isPair + 2·suited) / 32`, a rank sum with two fudge terms and only **33 levels for 169 hand classes**. It scored AKs at 0.781 against a threshold of 0.78 (clearing by 0.001, hence 0.0057) and AKo at 0.719 (not clearing at all). The same score ranked **22 (0.250) below K3o (0.375)** — a pair's entire pair bonus was worth less than one rank step at the top of the deck — which put small pairs outside the cold-call prior while K3o sat inside it. And because 33 levels cannot separate 169 classes, distinct thresholds selected *identical* hand sets: `cold3Bet` (0.81) and `squeeze` (0.79) both selected exactly {AA,KK,QQ,JJ}, so the two shapes §2.5.2 calls different were the same shape.

Three rules follow, and they bind:

1. **Hand strength in the priors is the combo-weighted equity percentile** of the class, from `pokerCore/preflopEquityTable.EQUITY_VS_OPEN` — measured, not asserted. A percentile is uniform on combos, so a threshold `t` means exactly "the top (1 − t) of the field" and a linear ramp from `t` to 1 has combo-weighted mean `(1 − t)/2`. That identity is what lets a threshold be *derived* rather than tuned. Do not reintroduce a hand-rolled strength score anywhere in `rangeEngine/`.
2. **The 3-bet value core is derived from the combinatorics of the hand set named above.** QQ+ is 18 combos and AK is 16, so the live-pool value 3-bet range is 34/1326 = 2.56% of the field; a ramp over the top 5% has mean 2.50%. The branch's own long-standing comment ("top 3-5%") independently lands in the same band, and 5% rather than 3% because AKo enters the measured equity prefix only at 3.47% — the tight end of the band excludes it. `THREE_BET_TOP_FRACTION = 0.05` in `populationPriors.js`. The old thresholds gave 1.04% and 1.55% — **narrower than the hand set this section names**, which is the arithmetic reason AK had to fall off the bottom.
3. **Position scaling reads the declared frequency, not a position label.** The old code branched on `position === 'LATE' || position === 'BB'`, which left SB on EARLY's tight threshold while `FACED_RAISE_FREQUENCIES` declares SB 3-betting at 0.12 — twice EARLY, equal to LATE — and §2.5.2 calls the blind 3-bet wider and more merged. The foot now scales by that declared ratio (§7.2: a position-conditioned prior is sanctioned; a position-conditioned *decision* is not).

**Named approximation, stated because it is load-bearing.** All-in equity does not encode equity realization (§1.4), so this ordering ranks AKo just *below* TT and JJ, where doctrine ranks AK above both — AK realizes far better against a raiser's calling range than a mid pair does, and the table cannot see it. It is still the right instrument, because the error it makes is one rank position and the error it replaces was a hundred and fifty. Falsifier: regenerate `EQUITY_VS_OPEN` with realization weighting and re-run the WS-293 support sweep; if the argmax moves sharply, the realization information is real and this ordering is the wrong basis.

Also fixed by the same change: §2.3's own named light 3-bets. The bluff tail was gated on `0.40 < s < 0.60`, and **76s scored 0.344 — the doctrine's own example was outside the tail the code comment cited it for**. On the equity ordering both A5s and 76s sit inside it.

### 2.4 Squeeze Plays
A squeeze is a 3-bet when facing a raise + one or more callers. It's more powerful than a standard 3-bet because:
- The initial raiser's range is wide (they opened, not super strong)
- The caller(s) showed passive interest (unlikely to have premiums)
- More dead money in the pot = better risk-to-reward

### 2.5 Derived Preflop Line Taxonomy

**The doctrine (founder, 2026-07-22):** *"A cold 3-bet and a 3-bet are different — a cold 3-bet usually indicates a stronger and maybe slightly more polar range than a 3-bet."*

Generalized: **a derived action tag must be descriptive enough to distinguish decision contexts with different range implications.** "Raise facing a raise" is not one decision — it is at least three, and lumping them averages over spots whose fold/continue economics diverge. §2.3's "a 3-bet from a typical player is almost always a monster" is really a statement about *cold* 3-bets; it is materially weaker for blind 3-bets and materially stronger for limp-reraises.

#### 2.5.1 The classes

Tags are **derived from sequence state** — prior investment, callers between, raise count, posted blinds. They are never hand-labeled and never inferred from position alone. This is §7.1 applied to line classification: **the tag is an output of the action sequence, not an input to the model.**

Two independent decision trees (§4 of `rangeEngine/CLAUDE.md`), each with a retained parent aggregate and derived subclasses:

**No raise faced** — `fold | limp | open`
| Tag | Sequence-state condition |
|---|---|
| `openFirstIn` | raise; no raise faced; **no limpers ahead** |
| `isoRaise` | raise; no raise faced; **≥1 limper ahead** |

**Facing a raise** — `fold | coldCall | threeBet`
| Tag | Sequence-state condition |
|---|---|
| `coldCall` | call facing a raise; no prior voluntary investment |
| `cold3Bet` | raise facing a raise; **no callers between** raiser and seat |
| `squeeze` | raise facing a raise; **≥1 caller between** (§2.4) |
| `limpReraise` | raise facing a raise; seat **voluntarily limped earlier this hand** |

`limpReraise` takes precedence over `cold3Bet` / `squeeze`. `open` and `threeBet` are retained as **aggregate parents** — their meaning is exactly the union of their subclasses, unchanged from the pre-taxonomy definition.

#### 2.5.2 Expected range shape per class

Live-population doctrine, **not GTO**. Ordered strongest/narrowest to widest:

| Class | Shape | Why |
|---|---|---|
| `cold3Bet` | **Strongest, slightly polar.** | No money invested and players still to act behind. Re-raising into that with a marginal hand has poor implied odds, so the live pool does it only with genuine value plus a thin bluff tail. |
| `squeeze` | **Polar and leveraged.** | Dead money and a capped caller range make the bluff side profitable, so the range splits: real value + more bluffs than a cold 3-bet, with the medium region hollowed out (§2.4). |
| `blind3Bet` (= `cold3Bet` from SB/BB) | **Wider and more merged.** | Money is already posted, so the price to continue is discounted and the equity threshold drops. Medium hands stay in — the range is merged rather than polar. |
| `limpReraise` | **Uncapped.** | The passive line was chosen deliberately to trap (§5.8). This range is never treated as capped, and a single observation makes the *limp* range permanently uncapped too. |
| `isoRaise` | **Wider than `openFirstIn`, value-tilted.** | Raising over limpers targets a known-weak capped range rather than folding out the field (§5.7), so it correctly includes hands too weak to open first-in. |

**Why `blind3Bet` is not its own class.** The distinguishing factor — posted money — is already carried by the position dimension: ranges are stored per position × class, and a 3-bet from SB or BB with no callers between *is* a blind 3-bet by definition. A separate class would leave `SB.cold3Bet` permanently empty and split the same observations twice. The wider/merged blind shape is expressed as the **prior for `SB.cold3Bet` / `BB.cold3Bet`**, which is where it belongs. (Founder decision, 2026-07-25 / WS-256.)

*Known residual:* a **straddler** who 3-bets also has posted money but is not SB/BB, so their line is classed as a plain `cold3Bet`. Straddles are recorded (`sequenceUtils.getStraddler`) but not yet threaded into the taxonomy.

#### 2.5.3 Sparse-data rule: subclasses shrink toward their parent

Splitting a class divides the same observations across more buckets. **New subclasses MUST shrink hierarchically toward their parent** — never toward an independent flat prior. The shrinkage binds in **two dimensions**, and omitting either one breaks the taxonomy.

**1. The split — how often.** Estimate the subclass share *conditionally, against the parent's own occurrences*:

```
splitPost_sub = (SUBCLASS_PRIOR_WEIGHT · SPLIT[position][sub] + n_sub) / (SUBCLASS_PRIOR_WEIGHT + n_parent)
```

The denominator is **`n_parent`, the number of times the parent action actually occurred** — not the scenario-wide opportunity count `N`. A fold is not an opportunity to observe *which kind* of 3-bet happened, and counting it as one lets one squeeze in 40 spots move the estimate ~4×. `SUBCLASS_PRIOR_WEIGHT` then reads exactly like `PRIOR_WEIGHT`: ~10 virtual 3-bets before observed data dominates the doctrine split.

**2. The grid — which hands.** The subclass grid is **carved out of the parent's grid**, never built beside it:

```
share_sub(h)   = splitPost_sub · prior_sub(h) / Σ_siblings (splitPost_sib · prior_sib(h))
ranges[sub][h] = ranges[parent][h] · share_sub(h) · totalShare      totalShare = min(1, Σ splitPost)
```

`prior_sub(h)` is the doctrine prior used **as-is**. `getPopulationPrior` returns a per-hand *propensity* — the same semantics every grid in this engine carries — not a distribution over hands. Normalizing it by its own total would divide each cell by the range's breadth, penalizing wide ranges everywhere; that made the deliberately uncapped `limpReraise` range *less* likely at AA than the narrow `squeeze` range, inverting §2.5.2.

`totalShare < 1` exactly when some parent observations carry no subclass — the unmodelled 4-bet tree (§2.5.5). That residual is not a fudge factor; it is WS-270's slice, left with the parent.

This mirrors the `poolBaseline.js` hierarchical philosophy (§6.5a): a thin subclass reproduces its parent's behavior, and only accumulating evidence pulls it away.

**What the scheme guarantees** (measured 2026-07-26, asserted by test):
1. **Containment.** Per cell, every child ≤ its parent and Σ children ≤ parent — a squeeze *is* a 3-bet. Re-enforced at normalization (`crossRangeConstraints` Pass B) so showdown anchoring cannot break it. Where the parent is 0, every child is 0.
2. A **zero-observation** subclass still carries its parent-derived share — it degrades to the parent, never to a flat guess and never to zero.
3. The split posterior lies **strictly between** the doctrine split and the raw rate `n_sub / n_parent`, and is **prior-dominated while `n_parent ≤ SUBCLASS_PRIOR_WEIGHT`** — the 50/50 crossover at 10, matching §6.5 for `PRIOR_WEIGHT`.
4. **One observation shifts the subclass's share of its parent by <25%** (measured 23.3% at n_parent=5), satisfying DEC-025 AS-2. Two shift it 44.6%. Heavy evidence does override the doctrine split.
5. **The carve does not REORDER the doctrine (WS-366).** QQ+ outrank every cell of the AQ/88 band in every carved subclass at every position. This is not free and did not hold until WS-366: `share_sub(h)` divides by the sibling sum, so the ratio between two sibling *shapes* decides the cell, and any mechanism that flattens one sibling's shape more than another's — there, a logistic sharp enough to be a step, whose position tracked each grid's own width — will reorder the parent it was supposed to be carved from. **A carve that can reorder its parent is not a carve.** Asserted per position on the CARVED grid, never on the standalone prior: the standalone `limpReraise` prior at EARLY held its ordering throughout, which is precisely why the defect survived from WS-256 to WS-366.

**The anti-pattern this rule exists to prevent** — and the actual WS-256 review defect: deriving each subclass grid from an independent prior and shrinking only the frequency. That produced `limpReraise[QQ] = 1.00` against `threeBet[QQ] = 0.58`, subclass mass summing above the parent in **151/169 cells**, and a ~300% range swing from a single observation.

**Known cost of containment:** a child can only place weight where its parent already has some. The parent priors predate the taxonomy, so a subclass's doctrine shape is expressed *relative to* the parent's support, not beyond it — e.g. the `squeeze` bluff tail cannot appear at hands the parent `threeBet` prior scores 0. Subclasses therefore differ most in *how much* of each hand they claim. Widening the parent priors to the true union of their children is the open follow-up (see DEC-025 amendment).

`SPLIT[position][*]` sums to 1.0 across a parent's subclasses and is a **founder estimate** (author-estimate trust, Field-frame) carrying the same provenance discipline as `FACED_RAISE_FREQUENCIES` — not a measured dataset. Per the WS-263 precedent these weights should eventually be *measured* from between-player overdispersion rather than assumed.

#### 2.5.4 One hand can yield several decision points

A seat that limps and later re-raises made **two** decisions in two different game states, and both are real: the limp (no-raise tree) and the re-raise (facing-raise tree). The extractor therefore emits one record **per decision point**, not per hand.

Consequence that must be preserved: the limp-reraise hand **stays counted in the `limp` range**. Removing trapped hands from the limp range would make that range look capped — the exact inverse of §5.8, which holds that any limp-reraise makes the range permanently uncapped. Reclassifying rather than adding would silently manufacture the "limp range is capped" exploit the trait detector exists to suppress.

Limp-call and limp-fold remain in the **sub-action tree** (`subActionExtractor.js`), not the facing-raise tree: there *is* prior investment, so they are not cold calls, and folding them into `coldCall` would corrupt its definition.

#### 2.5.5 What is NOT yet modeled

**Facing a 3-bet is a third decision tree and does not exist yet.** A 4-bet is currently invisible to the range classes, exactly as limp-reraise was before this section. This matters out of proportion to its frequency: 4-bet pots are large before the flop is dealt and SPR is low, so a misread has no later street on which to be recovered, and whether a villain's 4-bet range is polarized or pure QQ+/AK value is the difference between stacking off and folding — paid at maximum pot size. Tracked at high priority as **WS-270**; `overCall` (calling behind an existing caller) is deferred with it.

---

## 3. Postflop Theory

### 3.1 Board Texture Classification
| Texture | Example | Implications |
|---------|---------|-------------|
| Dry | K♠ 7♦ 2♣ | Few draws, range advantage to preflop raiser, small bets effective |
| Wet | J♥ T♥ 9♦ | Many draws, equities run closer, check more, size up when betting |
| Paired | 8♠ 8♦ 3♣ | Trips unlikely (need specific hand), checking range strengthens |
| Monotone | Q♠ 8♠ 4♠ | Flush possible, drastically narrows continuing ranges |
| Broadway-heavy | A♠ K♦ J♣ | Hits wide opening ranges, penalizes speculative hands |
| Low-connected | 7♠ 6♦ 5♣ | Hits limping ranges, IP range may miss entirely |

### 3.2 Range Advantage vs Nut Advantage
**Range advantage**: one player's overall range is stronger on this board.
- Preflop raiser has range advantage on A-K-x, K-Q-x boards (their opening range hits)
- Caller/limper has range advantage on 6-5-4, 8-7-3 boards (speculative hands hit)

**Nut advantage**: one player can have the absolute nuts more often.
- BB can have 72o on a 7-7-2 board (they defend wide). Raiser can't.
- Raiser can have AA/KK on any board. Limper usually can't (unless trapping).

**These can diverge.** On 7♠ 6♦ 5♣: raiser has range advantage (overpairs, AK), but caller has nut advantage (straight with 89, 84, sets of 77/66/55). This changes optimal strategy.

### 3.3 Continuation Betting (C-Bet)
The preflop aggressor bets the flop. Theory:
- **High c-bet frequency (>65%)**: Likely betting range is wide and includes air. Exploit: call/raise more.
- **Low c-bet frequency (<45%)**: Gives up with air, only bets value. Exploit: fold non-premiums to their flop bet.

### 3.4 Why Players Bet — The Four Motivations

> **`falsified 1×` — this list has been too small before. Do not read it as closed.**
> It said *three* motivations until WS-256 found that protection / equity denial is neither value
> nor bluff and had no home, and a fifth (inducing) was recorded as its inverse in the same pass.
> The failure mode is specific and is why the marker sits on the claim rather than in an archive:
> **a missing category does not produce a blank, it produces a misfile** — the classifier scored
> correct protection bets as "over-values medium hands." If you are here to check whether a bet
> motive is expressible, the prior is that the list is incomplete, not that it is complete.

Every bet is motivated by one or more of the following. Each is distinguished by **what it profits from** — not by bet size, and not by hand strength alone. Two motives can share a bet; the sizing implication comes from whichever dominates.

1. **Value**: Profits from being **called by worse**. The bet is +EV because the calling range contains enough hands with less equity. A value bet is correct when hero's hand has >50% equity **against the opponent's calling range** (not their full range).

2. **Bluff / Fold Equity**: Profits from **better hands folding**. The bet targets the opponent's folding range — hands that currently have more equity than hero's but will surrender the pot. +EV when the fold rate exceeds the breakeven threshold: `foldPct > betSize / (pot + betSize)`.

3. **Protection / Equity Denial**: Profits from **hands with live equity folding, while the bettor is already ahead**. This is not value (value wants a call) and not a bluff (a bluff is behind). The bettor holds a made hand that is currently best but **vulnerable** — top pair on J♥T♥9♦, an overpair on a two-tone connected board — and the profit comes from charging or folding out the flush and straight draws that would otherwise realize their equity for free. Checking surrenders that equity; the bet reclaims it.

4. **Information** (rare, situational): Bet to observe the response and narrow the opponent's range. A "probe bet" can reveal whether villain's range is strong or weak from their reaction. Least common, and usually secondary to one of the first three.

**A fifth, inverse motive — inducing.** Checking, or betting deliberately small, to profit from **villain betting**: it invites a bluff from a range that would have folded to a bet. It is the mirror image of the four above (all of which profit from villain's call or fold), which is why it does not collapse into "information."

#### 3.4.1 Protection sizes UP — and why that does not contradict §4.1

§4.1 holds that **thin value bets should be smaller** (a larger size folds out the worse hands you wanted to call). Protection runs the opposite way: **against a draw-heavy continuing range, size up.** There is no contradiction, because the two are optimizing different terms:

- Thin value maximizes the **call-equity term** — you need the worse hands to stay in, so you price them in.
- Protection maximizes the **denial term** — you need the live draws to fold or to pay a bad price, so you charge them.

The discriminator is what the opponent's continuing range is made of. Against a range of worse **made** hands, size down (thin value). Against a range of **draws**, size up (protection). On a wet board holding a vulnerable made hand, protection usually dominates — which is why the same hand strength warrants a small bet on K72r and a large one on JT9ss.

#### 3.4.2 Consequence for classification (binding)

Because a missing category does not produce a blank but a **misfile**, any code that classifies a bet by motive MUST be able to express protection. A villain correctly protecting a vulnerable made hand on a wet board otherwise gets scored as either:

- **thin value** — which makes them look like a player who over-values medium hands, or
- **a bluff** — which makes them look like a player who over-bluffs.

Both are false leaks. Both point hero's counter-strategy the wrong way, and both accumulate into the villain model as evidence for a weakness that does not exist. **Betting a vulnerable made hand on a draw-heavy board is correct play, not a leak** — see §5.2's rule that a deviation is only a weakness if it loses EV.

**Multiway amplification:** equity denial is worth MORE with more opponents, because there are more live draws to deny. The heads-up framing of this section understates protection in exactly the spots the app is most used (§6 is heads-up throughout — see the multiway spine work).

#### 3.4.3 The value test needs REALISED equity — restricting to the callers is not enough (WS-312, binding)

Motive 1 above requires ">50% equity **against the opponent's calling range**". That is correct and
**incomplete**, and the gap shipped a live misfile twice.

There are two different quantities that both answer to the name "equity against the calling range":

| quantity | what it is | for a flush draw on A♠K♦6♠ |
|---|---|---|
| **all-in vs callers** | share of the pot hero ends up winning, runouts included | **0.49** |
| **realised vs callers** | share of the calling combos hero beats **right now** | **0.02** |

A first fix scored the thin-value gate on the *first* row and left the defect untouched: Q♠J♠ — a
second-nut flush draw beating **nothing** — arrived at 0.4929, cleared the 0.45 thin-value floor, and
was reported to the founder as *"Thin value bet — 52% equity, marginally +EV when called."*

**Why restricting the range does not help.** All-in equity carries the draw's outs, and the hands
that call are **precisely the made hands the draw is drawing against**. Filtering to the callers
changes *which range* the equity is measured against, not *which kind of equity it is*. The outs
survive the filter, so the number stays high for exactly the hands the test is supposed to exclude.

**The test is the RATIO, not either number.** `realised / all-in` is near 1 for a made hand and near
0 for a draw. Compare that ratio to a floor (`REALISED_VALUE_FLOOR`, `actionClassifier.js`); do not
substitute one quantity for the other, which would silently re-tier hands against a ladder calibrated
for a different scale. A ratio **above 1** is normal and means "not drawing" — top pair beats more of
the calling range now than it still will by the river, because it gets outdrawn.

**Corollary — a draw's call branch is often +EV, so profitability cannot gate the bluff family.** The
old ladder read `isCallProfitable` to open the value family and `!isCallProfitable` to open the bluff
family. A draw with a marginally profitable call branch therefore satisfied neither bluff branch and
had nowhere to land but thin value. **A semi-bluff must be reachable on a profitable call branch** —
the profit comes from the outs, which is what makes it a semi-bluff rather than value.

**Sizing is why this is not cosmetic.** Thin value sizes DOWN to keep worse hands in (§4.1); a
semi-bluff sizes UP to charge the draw and maximise fold equity (§6.1's denial term). Same hand,
opposite advice — the same inversion §3.4.2 records for protection-vs-thin-value. And because the
classifier also labels HERO's action class, a semi-bluff logged as thin value teaches the wrong
lesson back into the weakness model.

**Critical insight (unchanged)**: The same bet size can serve different motivations for different players. A half-pot bet can be a value bet, a bluff, a protection bet, or a blocker bet. A 2x pot bet can be a polarized bluff, a vulnerable hand charging draws, or an overbet with the nuts maximizing extraction. The motivation is determined by the player's tendencies, their hand, and the opponent's range composition — NOT by the size alone.

### 3.5 Bet Sizing — What It Does and Doesn't Tell Us
Bet sizing and range shape interact, but the relationship is **mediated by context** — it is not a direct mapping.

**What GTO solvers show (theoretical baseline)**:
- On dry/static boards (K-7-2 rainbow): small bets at high frequency (range advantage, few draws to deny equity)
- On wet/dynamic boards (J-T-9 two-tone): large bets at low frequency (equities run closer, need to charge draws)
- Nut advantage enables overbetting (opponent can never hold the best hands)
- Multiple bet sizes coexist in solver solutions — small for merged portions, large for polarized portions

**What it does NOT tell us about a specific player**:
- A half-pot bet is NOT necessarily linear. The player may always bet half-pot regardless of hand strength.
- A 2x pot overbet is NOT necessarily polarized. The player may overbet only their strongest hands (purely linear).
- Sizing-to-strength correlation is **player-specific** and must be calibrated by showdown data.

**How showdown data calibrates sizing reads**:
Each showdown reveals {bet_size_pct, street, hand_shown}. Over multiple showdowns, patterns emerge:
- **Positive correlation** (large bets = strong, small bets = weak): sizing is a reliable tell — exploit by folding to large bets with marginal hands and calling down vs small bets.
- **No correlation** (size doesn't predict strength): sizing is either balanced or random — ignore it and focus on frequency-based reads.
- **Inverse correlation** (small bets = strong, large bets = bluff): the player is trying to be tricky — exploit by calling large bets and folding to small ones.

Without showdown data, bet sizing is an unreliable signal. With showdown data, it can be the most exploitable tell a player has.

### 3.6 Postflop Range Narrowing
Each action narrows the range:
- **Bet**: Makes weak hands less likely (they would check). Range is weighted toward value + bluffs.
- **Check**: Makes some strong hands less likely (they would bet for value). Range is weighted toward medium hands + traps.
- **Raise**: Makes medium hands less likely (they would just call). Range is weighted toward strong value + bluffs.
- **Call**: Makes air (would fold) and the nuts (would raise) less likely. Range is weighted toward medium + draws.

This narrowing is cumulative across streets. By the river, ranges are very defined.

#### 3.6.1 A range NEVER assigns zero (WS-291, binding)

Read "removes" above as **down-weights**, never **eliminates**. A narrowed range may make a
holding very unlikely. It may not declare it impossible.

**The rule.** `P(action | combo)` is a probability in `(0, 1]`, never a 1/0 indicator. Every
combo the caller's prior admits keeps positive weight after narrowing, at or above a floor
(`MIN_CONTINUATION_WEIGHT`). The one legitimate zero is a **fold** — that removes the seat
from the pot, which is a fact about the hand, not a claim about what they could hold.

**Why it is a rule and not a preference.** §6.5 gives the form
`P(hand | action) ∝ P(action | hand) × P(hand)`. A hard cut implements the likelihood as an
indicator, and multiplying a prior by zero is irreversible: no volume of later evidence can
lift a combo off zero. So the error is not "a bit overconfident" — it is **unfalsifiable in
the wrong direction**. A model that assigns probability zero to an event that then occurs
has been refuted, not merely miscalibrated. RANGE_ENGINE_DESIGN.md §4.3 states the same
constraint from the design side ("every hand has a weight in EVERY action range", with
`P(limp | AA) = 0.05` as its rare-but-not-zero illustration).

**What it cost, measured.** `narrowByBoard` sorted combos by equity, kept the top
`continuationRate` fraction and zeroed the rest. Scored against revealed showdown hands
across two independent sites (`docs/research/range-calibration-2026-07-28.md`):

| | before | after |
|---|---|---|
| coverage, flop → turn → river | 89% → 71% → 56% | **~94% flat** |
| coverage facing a **raise** | 55% (10.8% of combos retained) | **93%** |
| chained ×3, as depth-2/3 re-applies it | 72% → 58% → 47% | **~87–89% flat** |

The decay was **compounding**: each street re-applied the cut to a range already cut, so by
the river the model excluded villain's actual hand nearly half the time, and the deep
branches that produce the multi-street plan were evaluated against a range that excluded it
more often than it contained it.

**The specific poker failure this produced.** *The engine could not represent a bluff-raise.*
A bluff-raise is by definition a bottom-equity combo, so "keep the top N% by equity" cannot
hold one — facing a raise the model retained 10.8% of combos and believed raising ranges
were near-pure value. The consequence is directional and always the same way: **hero
over-folds to raises**, because §4.2 makes bluff-catching depend entirely on villain's bluff
frequency in exactly that spot, and the model had set it near zero by construction.

**The correct form.** Score each combo (equity for bet/call/raise; a U-shape for check,
because weak hands check *and* the strongest hands check to trap), then map scores to
probabilities through a logistic whose **mean is pinned to the observed continuation rate**.
The aggregate stays exactly where the evidence put it; only the boundary softens. Softness
and floor are **swept against the discrimination metric**, not chosen by taste.

**Where this generalises.** This is the third time the same shape has been found in this
engine: a threshold standing in for a posterior. §11.5 records it in the villain context
hierarchy (WS-285), §7.6/AP-RL-01 forbids the bucket-label version, and this is the range
version. Any `if (x >= K) keep else discard` in an inference path is the same defect wearing
different clothes. Let the posterior self-weight.

> **Known residual, stated rather than implied (2026-07-28).** Coverage plateaus at ~88–94%,
> not 100%, because the **preflop** range still hard-zeros 30–37% of the grid — the same
> defect one layer up, tracked as WS-302. Until that lands, *unconditional* discrimination
> measures preflop assignment rather than narrowing. And narrowing still **degrades with
> depth** (+0.25 → +0.14 → −0.07 over three applications) while the **check** branch — the
> most common action there is — scores *worse than uniform*. Tracked as WS-303. All
> measured, none fixed by this rule.

### 3.7 Polarization by Street
- **Flop**: Ranges are wide, strategies can be mixed
- **Turn**: Ranges narrow, bets become more polarized
- **River**: Ranges maximally narrow, bets are fully polarized (nuts or bluff)

The bet SIZE should generally increase across streets as ranges polarize: small flop bet → medium turn bet → large river bet. But this is a consequence of range evolution across streets, not a rule about what any individual bet size "means."

---

## 4. Value Betting and Bluff Catching

### 4.1 Value Betting Theory
A value bet is +EV when hero's hand has **>50% equity against the opponent's calling range**. This is the critical threshold — not equity against their full range.

> **Multiway (WS-277).** The >50% rule is the **one-caller specialization**. Against
> k callers hero must beat all of them, so the bar is `0.5^(1/k)` on pairwise
> equity — 71% vs two callers, 79% vs three (§6.4). Everything below about thin
> value is stated heads-up and gets strictly harder as the field grows: the
> thin-value band is the first thing to disappear multiway, not the last.

**Thin value betting**: Betting a hand that barely clears the >50% threshold. Second pair, weak top pair, or middle pair can be thin value bets against opponents who call with worse.

**Sizing for thin value**: Thin value bets should be SMALLER. A nutted hand maximizes EV with a large bet (extracts maximum from calling range). A thin value hand maximizes EV with a small bet (keeps worse hands in the calling range that would fold to a larger size). This is counterintuitive but solver-confirmed.

**Thin value vs player type**:
- Against calling stations: thin value is highly profitable. Their calling range is so wide that even marginal hands clear the >50% threshold. Bet wider for value, bet smaller to keep them calling.
- Against nits: thin value is dangerous. Their calling range is narrow and strong. Only bet with hands that beat their tight continuing range.

**Common value bet mistakes** (weaknesses to detect):
- Betting too large with thin value (pricing out the worse hands you want to call)
- Betting too thin against opponents whose calling range is stronger than estimated
- Not value betting at all with medium-strength hands against stations (leaving money on the table)
- Overvaluing hand strength without considering what the opponent calls with

### 4.2 Bluff Catching Theory
A **bluff catcher** is a hand that beats all bluffs in the opponent's range but loses to all value hands. It exists purely to catch bluffs.

**The bluff catching decision framework**:
1. Calculate pot odds from the bet you're facing
2. Estimate opponent's bluff-to-value ratio in this specific spot
3. If opponent bluffs more often than pot odds require → call all bluff catchers
4. If opponent bluffs less often than pot odds require → fold all bluff catchers
5. Against a balanced opponent → you're indifferent (call at MDF)

**Exploitative bluff catching adjustments**:
- Against a value-heavy bettor (under-bluffs): fold ALL bluff catchers, even at MDF. MDF is the baseline, not the mandate.
- Against a bluff-heavy bettor (over-bluffs): call ALL bluff catchers, even beyond MDF.
- **Blockers matter**: A hand that blocks the opponent's value range (e.g., holding A♥ when they could have the nut flush) is a better bluff catcher than one that blocks their bluffing range.

**Connection to pot odds**: Facing a half-pot bet, you need the opponent to be bluffing >25% of the time to profitably call. Facing a pot-size bet, you need >33%. Facing a 2x pot bet, you need >40%. These thresholds determine whether bluff catching is profitable against a specific player's tendencies.

> **Multiway (WS-277) — stated as a KNOWN GAP, not a solved one.** The framework
> above is heads-up. Two things change with players still to act behind:
> 1. **Hero must beat every caller, not one.** A bluff catcher that beats the
>    bettor's bluffs can still be drawing near-dead to a third player who called
>    or is yet to act. The §6.4 `0.5^(1/k)` bar applies to calling too.
> 2. **Calling risks a squeeze from behind.** The heads-up call/fold framework
>    has no term for a player still to act raising over the top, which turns a
>    marginal call into a fold-out-of-position for a larger amount.
>
> Item 1 falls out of the §6.4 threshold and is implemented. **Item 2 is NOT
> modelled** — deliberately deferred at WS-277's scope ceiling, tracked as
> WS-282. Until it ships, bluff-catch advice multiway with players behind should
> be read as an upper bound on how often calling is right.

---

## 5. Weakness Detection and Exploit Theory

### 5.1 The Three-Phase Pipeline
This app follows a three-phase pipeline from data to action:

```
Phase 1: ANALYSIS          Phase 2: WEAKNESS DETECTION       Phase 3: EXPLOIT GENERATION
─────────────────          ──────────────────────────         ─────────────────────────
"What does this             "Where do they make               "What specific action
player do?"                 -EV decisions?"                   punishes this weakness?"

Range estimation            Deviation from optimal            Counter-strategy with
Frequency tracking          Pot odds mistakes                 action thresholds
Trait detection              Sizing-strength leaks             Confidence tiers
Showdown anchoring           Structural imbalances             Consequence weighting
```

**Analysis** answers "what is this player's range and tendencies?"
**Weakness detection** answers "where does this player's strategy create -EV situations for them?"
**Exploit generation** answers "what specific action do I take to capitalize on this weakness?"

These are different questions. A weakness exists whether or not we can exploit it. An exploit is only valid if it targets a real weakness.

### 5.2 What Is a Weakness?
A weakness is a point in a player's strategy where they consistently make decisions with negative expected value relative to an optimal (or even reasonable) alternative. Weaknesses exist at specific decision points — they are not global labels.

**Categories of weakness**:

| Category | Definition | Example |
|----------|-----------|---------|
| **Range weakness** | Range deviates from optimal in a specific spot | Opens 35% from UTG (GTO: ~12%) |
| **Frequency weakness** | Action frequency creates auto-profit for opponents | Folds to 3-bets 80% (breakeven defense: ~55-60%) |
| **Sizing weakness** | Bet sizing correlates with hand strength | Always bets large with value, small with bluffs |
| **Structural weakness** | Position/lineup misalignment | Equally aggressive IP and OOP |
| **Awareness weakness** | Fails to adjust to board/opponent/situation | Same c-bet frequency on dry and wet boards |

**Critical distinction**: A weakness is NOT simply "different from GTO." GTO is the baseline for detecting deviations, but a deviation is only a weakness if it creates situations where the player loses EV. Playing tighter than GTO from EP is a small deviation but may not be exploitable. Folding 80% to 3-bets is a large deviation that creates massive auto-profit opportunities.

### 5.3 From Weakness to Exploit
An exploit is a specific counter-strategy that targets a detected weakness. The connection must be explicit:

| Weakness | Why It's -EV for Them | Exploit | Why It's +EV for Us |
|----------|----------------------|---------|---------------------|
| Folds to c-bets >65% | Surrenders equity with hands that should continue | C-bet wider (any two cards on dry boards) | Their fold rate exceeds our breakeven bluff threshold |
| Never 3-bets light | 3-bet range is only premiums, transparent | Fold non-premiums to their 3-bet; steal more vs their opens | We avoid paying off their value range; we steal their blind equity |
| Calls too wide postflop | Puts money in with hands below the equity threshold | Value bet thinner, never bluff | Their calling range includes hands we beat; our bluffs gain nothing |
| Bet sizing tells (large=value) | Reveals hand strength through sizing | Fold bluff catchers to large bets, call down vs small bets | We fold when behind and call when ahead |
| Limp range is capped | Cannot have premiums in passive line | Iso-raise aggressively for value | Their range cannot punish our aggression |

**Every exploit must trace back to a specific weakness with a quantified threshold.** "Villain is fishy" is not an exploit. "Villain folds to c-bets 72% of the time, exceeding the 50% breakeven threshold for pot-sized c-bets, so c-bet 100% on dry boards" is an exploit.

### 5.4 GTO vs Exploitative — When to Use Each
**GTO** (Game Theory Optimal): unexploitable strategy. Correct against perfect opponents. In live low-stakes, almost no one plays GTO — pure GTO leaves money on the table.

**Exploitative**: deviates from GTO to maximally punish opponent mistakes. More profitable against imperfect opponents but can be counter-exploited.

**This app is exploitative by design.** We identify weaknesses in opponent strategies and generate specific counter-strategies. GTO is our BASELINE for detecting weaknesses, not our recommendation.

### 5.5 Player Type Exploits

| Type | VPIP | PFR | AF | Primary Weaknesses | Exploit |
|------|------|-----|-----|-------------------|---------|
| Nit/TAG tight | <18% | ~15% | >2 | Overfolds preflop, range too narrow | Steal blinds, fold to aggression, 3-bet bluff (they fold too much) |
| TAG solid | 18-25% | 14-20% | 1.5-2.5 | Few exploitable weaknesses | Small edges, position-dependent, respect their aggression |
| LAG loose-aggressive | 25-35% | 18-28% | >2 | Overbluffs, range too wide in aggro spots | Call down lighter, trap with premiums, let them bluff |
| Fish passive | 30-50% | <10% | <1 | Calls too much, doesn't extract value, plays fit-or-fold | Value bet relentlessly, don't bluff, isolate preflop |
| Calling station | 35-55% | <12% | <0.8 | Calls with hands below equity threshold | Value bet thin, NEVER bluff, bet bigger for value |
| Maniac | 40%+ | 25%+ | >3 | Puts money in with insufficient equity constantly | Call down with marginal hands, trap, let them hang themselves |

### 5.6 Fold Equity Exploits
**When villain folds too much** (overfolds):
- Bluffing becomes profitable. If they fold > `betSize / (pot + betSize)`, our bluffs are auto-profitable.
- C-bet wider on dry boards. 3-bet light preflop. Barrel turn after flop c-bet.
- The risk: if they adjust, our bluffs start losing.

**When villain folds too little** (underfolds / calling station):
- Bluffing is burning money. Every bluff loses.
- Value bet wider and bigger. Bet with medium-strength hands they'd fold to a good player.
- The benefit: guaranteed profit on value bets they should fold.

### 5.7 Range-Based Exploits
**Capped range**: Cannot contain the best hands. Exploit: bet big (they can't have the nuts to punish you).
- Example: Limper's range on A-K-7. They didn't raise preflop → unlikely to have AA, KK, AK. Their range is capped.
- CAUTION: Only reliable with sample size. Some players limp premiums (traps).

**Uncapped range**: Can contain the nuts. Respect it — don't overbet or bluff relentlessly.
- Example: 3-bettor on any board. They 3-bet preflop → can have AA, KK. Range is uncapped.

**Wide, unbalanced range**: Contains too many weak hands relative to strong ones.
- Example: Player with 45% VPIP. Most of their range is junk.
- Exploit: any reasonable hand has good equity. Value bet aggressively.

### 5.8 The Trap Problem
Some players deliberately play strong hands passively to trap:
- Limp AA → wait for a raise → limp-reraise all-in
- Check-call with a set → check-raise the turn

**The danger**: If we assume passive action = weak range and always iso-raise or bluff, we walk into traps repeatedly.

**How this app handles it**: The `traitDetector` looks for showdown premiums in passive lines and limp-reraises. If detected, the `generateExploits` trait modifier:
1. Suppresses "limp-range-capped" exploits
2. Adds caution notes to iso-raise recommendations
3. Downgrades confidence on passive-line exploits

### 5.9 Showdown Data as Ground Truth
Showdown observations are the most valuable data point for weakness detection. Each showdown reveals:

1. **What they held** — confirms or refutes our range estimate
2. **How they played it** — reveals their strategy with that specific hand strength
3. **What size they bet** — calibrates sizing-to-strength correlation for this player
4. **Whether their bet was +EV** — did they value bet correctly? Did they bluff at the right frequency?

**Using showdowns to detect weaknesses**:
- If they show down a bluff after a large bet, and we see this repeatedly → sizing weakness (large bets = bluffs)
- If they show down thin value after calling a large bet → they call too wide (frequency weakness)
- If they show down premiums after limping → trap detection (range is uncapped)
- If they show down weak hands after betting for value → they overvalue their hand strength (value bet mistake)

**Pot odds mistakes revealed by showdowns**:
- A villain who value bets $50 into a $100 pot with a marginal hand is offering us 3:1. If our equity vs their hand exceeds 25%, calling is profitable. Showdown data tells us whether their "value bets" are actually profitable for them or whether they're giving us correct odds to call.
- A villain who bluffs $200 into a $100 pot needs us to fold >66% of the time. If showdown data shows they bluff at this sizing frequently, we should call down — their bluff frequency likely exceeds the rate at which we need to catch them.

---

## 6. Mathematical Foundations

> **§6.1–6.4 are stated in N-player form (WS-277, 2026-07-26).** The app's purpose
> is 9-handed live poker, where a large share of pots are multiway; a heads-up
> spine with multiway patches bolted on top makes every new multiway feature
> re-derive its own correction. So each formula below is written for N opponents
> with the **heads-up case as the N=1 specialization**, not as the base case.
> Every N=1 expression reduces to the classic textbook formula exactly, and that
> identity is asserted by test (`__tests__/multiwayDecisionMath.test.js`).
>
> **Shared assumption, stated once.** All four treat opponents' holdings as
> conditionally independent GIVEN the shared board. This is the same
> justification `multiwayFoldPct` already carries, and the same reason no
> separate correlation coefficient appears: board texture enters through each
> opponent's own fold rate and equity, so a correlation term on top would
> double-count it (§7.4, FIND-030). The named residual is **card removal**
> between opponents' ranges — second-order, unmodelled, UNMEASURED as of
> 2026-07-26 (WS-281 prices it through the WS-273 harness).

### 6.1 Fold Equity Formula
```
k = expected callers      (k = 1 heads-up)
F = P(ALL opponents fold) (fold-through, not one opponent's fold rate)

EV(bet) = F × pot + (1 - F) × (heroEquity × (pot + (k+1)×bet) - bet)
```
This has TWO terms: the fold-equity term AND the call-equity term. Both matter. A value bet is profitable primarily from the call-equity term. A bluff is profitable primarily from the fold-equity term.

Multiway changes both terms. `F` compounds — it is the product of the individual fold rates, so fold equity **decays geometrically** with each extra player, which is why bluffing largely collapses multiway. The called pot **grows** by one bet per caller, which is why semi-bluffs and value hands gain multiway even as pure bluffs lose. A pure bluff (heroEquity = 0) is indifferent to `k`: it never wins the called pot.

`k` is recovered from `F` and the opponent count by inverting `F = f^N`:
`E[k | called] = N(1 - F^(1/N)) / (1 - F)`, which is exactly 1 when N = 1.
Implementation: `expectedCallers` / `calcFoldEquity` in `foldEquityCalculator.js`.

### 6.2 Minimum Defense Frequency (MDF)
```
breakeven b = bet / (pot + bet)
per-defender MDF = 1 - b^(1/N)          (N defenders)
N = 1  →  1 - b = pot / (pot + bet)      (the classic formula)
```
Against a half-pot bet heads-up: MDF = 66.7% (villain must defend 2/3 of range). Pot-size: 50%. 2x pot: 33%.

**Defense DIVIDES across the field.** MDF exists to hold `P(everyone folds) ≤ b`. With N defenders folding independently that constraint is `(1-d)^N ≤ b`, so each individual defends far less while the field collectively meets the same bar. Against a 3/4-pot bet: one defender must continue 57%, but each of three defenders needs only 25%. **Applying the heads-up MDF per-player multiway over-defends badly** — it demands the field collectively defend far past the point that denies the bettor an auto-profit.

If the field folds more than `b`, our bluffs auto-profit. This is the mathematical basis for bluff-frequency exploits. But MDF is a theoretical baseline, not a mandate — exploitative play deliberately deviates from MDF when we know an opponent's bluff-to-value ratio.

### 6.3 Breakeven Bluff Frequency
```
Breakeven = bet / (pot + bet)      — independent of N
```
This tells us the minimum **fold-through** rate needed for a bluff to be profitable. Half-pot bluff needs 33% folds. Pot-size bluff needs 50% folds. 2x pot bluff needs 66% folds.

The threshold does not move with N — but the quantity compared against it does. The required rate is on `F`, the probability **everyone** folds, and `F` collapses multiway: three opponents each folding 60% fold through only 21.6% of the time, well under the 33% a half-pot bluff needs. Same bluff, same sizing, profitable heads-up and badly -EV three-way. That is the multiway bluff collapse in one line.

### 6.4 Value Bet Threshold
```
EV(value bet) > 0 when: e > 0.5^(1/k)

  e = PAIRWISE equity vs ONE caller's continuing range
  k = number of callers

  k=1 → 0.500   k=2 → 0.707   k=3 → 0.794   k=4 → 0.841
```
Heads-up, a value bet is correct when we win more than half the time against the hands that call. The calling range is always stronger than the full range (weak hands fold), so we need more equity than we'd need against their full range.

**Multiway, hero must beat the BEST of the callers, not an average one.** With pairwise equity `e` against each continuing range, hero wins with probability `e^k`, so the threshold is `0.5^(1/k)`. The bar rises steeply, and the heads-up rule therefore **systematically over-values thin bets multiway** — a real money leak in the exact spot live 9-handed players face most often. Thin value is the band that collapses fastest: its 45% heads-up floor becomes 77% against three callers.

**This requires a pairwise equity input.** `gameTreeContext` computes `heroEquity` via `exactEquityTwoHands` against the primary villain's narrowed range, which is pairwise — correct for this formula. Passing an equity already taken against the whole field would apply the multiway discount twice (§7.4). The generalization is `multiwayEquityThreshold(target, k) = target^(1/k)`, which applies to every rung of the classifier ladder, not just 0.50.

### 6.5 Bayesian Updates for Ranges
```
P(hand | action) = P(action | hand) × P(hand) / P(action)
```
- P(hand): prior probability (from population or accumulated data)
- P(action | hand): likelihood of this action with this hand
- P(action): normalizing constant (overall frequency of this action)

With small samples, the prior dominates. With large samples, the likelihood dominates. This is why our `bayesianUpdater.js` uses ~10 virtual observations as prior weight (`PRIOR_WEIGHT = 10` in `rangeEngine/populationPriors.js`): a player needs ~10 real observations before their data outweighs the population prior, and at ~10 hands the blend is roughly 50/50. The same pseudocount-10 convention is mirrored across the Beta-Binomial machinery (`STAT_PRIORS` in `bayesianConfidence.js`, the assumption-engine priors). At ~30+ hands the data dominates.

### 6.5a Four-Tier Empirical Prior Hierarchy (pool baseline)

Since WS-235 (2026-06-21), the six scalar stat priors (vpip, pfr, threeBet, cbet, foldToCbet, foldTo3Bet) are no longer a single static founder estimate. WS-263 (2026-07-25) added an imported reference tier. The resolved prior a villain's stats shrink toward is a **four-tier hierarchy** (`exploitEngine/poolBaseline.js`):

```
founder estimate    Beta(α₀, β₀), pseudocount α₀+β₀ = 10 — STAT_PRIORS, the subjective prior
      ↓ conjugate blend, capped at the per-stat prior weight
imported reference  HandHQ online aggregates (SRC-011, 12.9M imported hands) — ONLINE
      ↓             numeric-stake segments only; Reference-class yardstick
pool aggregate      founder-observed empirical Field layer — real observed hands from the
      ↓             villain's own segment; its mean DOMINATES the reference as n grows
per-villain Read    the deviation the exploit rules act on (per-villain update, unchanged)
```

Each pool stage is an exact conjugate Beta-Binomial update of the prior entering it: pool successes k over n observed decisions give `Beta(α₀+k, β₀+(n−k))` while n is under the stage's cap. Load-bearing rules:

1. **Segmentation — different populations are never pooled.** Baselines are computed per segment (`segmentKey`: live vs online source × stake label). Online (Ignition) and live 1/2 are different populations; a villain shrinks only toward the baseline of its own segment, and the founder estimate is the per-segment fallback. (WS-260, 2026-07-22, closed both known wiring defects: online sessions now record real stakes from the captured wire blinds — with a one-time backfill re-keying legacy 'NL Holdem' sessions from their stored hands — and `segmentKey` canonicalizes free-text stake labels read-side via `canonicalStakeLabel`, so cosmetic variants like '1/2' / '$1/$2' / '1/2 NL' resolve to one segment. Residual: online sessions whose hands never captured blinds stay in the legacy segment and fall back to the founder estimate; online tournament hands carry no format marker and are labeled by majority blinds — a wire-side format flag is a noted follow-up.)
2. **Leave-one-out — non-negotiable.** The baseline a given villain shrinks toward EXCLUDES that villain's own hands (`resolveStatPriors` `excludePlayerId`). Shrinking a villain toward a pool containing itself is circular and biases every Read toward the mean. Same rule as "derived values are outputs, never self-referential inputs."
3. **Per-stat pseudocount caps bound confidence, not the mean — and they are MEASURED.** `PER_STAT_PRIOR_WEIGHT` (vpip 10 · foldTo3Bet 10 · cbet 13 · pfr 21 · foldToCbet 22 · threeBet 35) caps each pool stage's contribution to the prior's *strength* so a well-sampled villain can still override it; the pool *mean* still converges fully to the observed pool rate (the cap rescales α, β around the exact uncapped mean). The weights are the between-player overdispersion estimate the former flat cap only approximated: method-of-moments N_eff = mean(1−mean)/sd_between² − 1 over players with n ≥ 30, measured on the WS-262 HandHQ corpus (`docs/research/mass-pool-data-2026-07-25.md`). The former `POOL_PRIOR_MAX_PSEUDOCOUNT = 200` was refuted as ~20× too confident and removed; `PRIOR_WEIGHT = 10` was validated (vpip). The caps apply to both the imported-reference and founder-pool stages, live and online alike.
4. **Imported reference is online-only, nearest-stake, seat-bucketed, and always subordinate (WS-263).** The HandHQ table (SRC-011; 25NL–1000NL, 6-max + full-ring, July 2009) serves ONLY `online/<numeric-stake>` segments — `resolveReferenceCounts` is the single choke point enforcing the founder-ratified live/online separation, and legacy non-numeric online segments (`online/nl-holdem`) conservatively get nothing. Stakes match by log distance with ties to the lower (softer) stake, so micro segments below the 25NL floor use 25NL. The villain's table-size bucket (≤6 dealt in → 6-max, ≥7 → full-ring; the two differ on every stat) is a reference-*lookup* dimension picked from observed dealt-in tallies — `segmentKey` itself stays 2D (founder decision 2026-07-25). Unknown table size → pooled counts. Because the founder-observed pool blends last with its uncapped-n mean, founder data overrides the reference as it accumulates; the reference never masquerades as observed pool data. Staleness (2009 era) is self-limiting: the per-stat weights make it a deliberately weak prior.

Safe degradation: a thin or empty LIVE segment reproduces the static founder estimate verbatim; an online numeric-stake segment starts from the imported reference instead of the bare founder estimate. Scope (v1): only the six scalar proportions above; range-grid priors and preflop fold/limp/open trees (`rangeEngine/populationPriors.js`) remain on the founder estimate. See `poolBaseline.js` header and `bayesianConfidence.js` provenance comment for the implementation contract.

### 6.6 Combo Counting
- Pocket pairs: 6 combos each (AA = A♠A♥, A♠A♦, A♠A♣, A♥A♦, A♥A♣, A♦A♣)
- Suited hands: 4 combos each (AKs = A♠K♠, A♥K♥, A♦K♦, A♣K♣)
- Offsuit hands: 12 combos each (AKo = 16 total - 4 suited = 12)
- Total: 1326 unique 2-card combinations, mapped to 169 classes (13×13 grid)

Board cards remove combos. If A♠ is on the board, AA goes from 6 to 3 combos, and all A♠Xs lose their suited combos.

---

## 7. First-Principles Decision Modeling

> **The forces this section defers to are enumerated in [`POKER_AXIOMS.md`](./POKER_AXIOMS.md).**
> §7 says what NOT to use as a decision input (labels) and points at the causes underneath —
> but it never lists them. The axiom register does, and requires every entry to make a
> prediction scoreable against the corpus, with a named falsifier. Read it before adding a new
> "compute it from game state" rule, so the rule is grounded in a stated force rather than an
> unstated intuition.

### 7.1 Every Decision Derives from Game State, Not Labels

A villain's fold/call/raise decision is the OUTPUT of a decision process with these inputs:
1. **Equity vs perceived range** — how likely they are to win at showdown
2. **Pot odds** — `betSize / (pot + betSize)` determines the equity threshold for profitable calling
3. **Implied odds** — future streets' profit potential (f(draw outs, SPR, streets remaining))
4. **Players remaining to act** — risk of facing further aggression
5. **Stack-to-pot ratio (SPR)** — commitment level and maneuverability

**No decision is because of a label.** A player in EP doesn't fold more "because they're in EP" — they fold more because there are 7 players behind who might have strong hands, their opening range is already narrow, and continuing OOP with marginal hands has negative implied odds. The label "EP" is a proxy for these factors, not a cause.

### 7.2 Position Labels Are Proxies, Not Causes

When modeling villain behavior, never use position labels (EP/MP/LP/BB) as direct lookup keys for fold rates, calling rates, or aggression. Instead, compute from the actual game state:
- **Players remaining to act** (not "EP" vs "LP")
- **Whether this player has positional advantage on remaining streets** (not "IP" vs "OOP" as a binary label — UTG+1 can be IP vs the UTG opener, CO can be OOP vs BTN)
- **The player's range given their action sequence** (not "EP range is tight")

Position labels can serve as **priors** in a Bayesian framework — they encode typical behavior patterns. But they must never be the final answer, and they must yield to computed game-state factors when those are available.

### 7.3 Bucket Labels Are Relative Approximations

Hand strength buckets (nuts/strong/marginal/draw/air) are **relative to the current range**, not absolute. A top pair is "strong" when villain's range is wide (45% VPIP player) but "marginal" when villain's range is narrow (12% VPIP nit). The same hand shifts buckets depending on who you're against.

When per-combo equity is available (as it is in depth-2/3 evaluation), use the exact equity value rather than the bucket label. A combo with 0.68 equity against hero's hand should not be treated the same as one with 0.52 equity just because both are classified as "strong."

Bucket labels are acceptable for:
- Range-level aggregation (what % of villain's range is air?)
- Display and narrative (describing ranges to the user)
- Situations where per-combo equity is unavailable

Bucket labels are NOT acceptable for:
- Per-combo action probability computation (use equity ratio instead)
- Fold/call/raise rate lookups (use logistic of equity ratio instead)

### 7.4 Style Labels Must Not Double-Count

A player's style (Fish/Nit/LAG/TAG) is a **categorization derived from their stats** (VPIP, PFR, AF). Using the style label to apply adjustments AND the underlying stats to apply separate adjustments double-counts the same behavioral information.

**The hierarchy (pick ONE per adjustment; the style tier is GONE as of WS-436):**
1. **Villain decision model** — personalized from this player's observed decision buckets (highest fidelity)
2. **Observed aggregate stats, continuously** — the shrunk Beta posteriors (`villainFoldLevel`,
   `shrunk.aggFreq`, `shrunk.cbet`), which self-degrade to the population prior at n=0
3. **Population priors** — what a typical unknown 1/2 player would do

There is no label tier. WS-436 removed the six `classifyStyle` labels as engine inputs,
on measurement: the style-conditioned Dirichlet seed carried zero villain-action
information over 10,147 paired corpus decisions (ΔLL −0.00076, n.s.), and a
full-resolution continuous seed in its place was significantly WORSE (ΔLL −0.00691,
t = −5.64) — because the label was a lossy quantisation of stats computed from the SAME
hands the model's buckets count. That measurement generalises the double-counting rule
below: a prior seed and an evidence stream drawn from the same observations may not both
enter one estimate, whatever the seed's resolution. Tiers 1 and 2 are therefore SEPARATE
PIPELINES (decision buckets vs aggregate stats), consumed mutually exclusively per
estimate, never blended.

When a higher-fidelity source is present, lower-fidelity redundant adjustments MUST NOT stack on top. The villain model already encodes the sticky player's tendency to call too much — applying a stats-derived modifier on top double-counts it.

**Example of wrong (quadruple-counting, as the pre-WS-436 engine risked it):**
- Style fold ratio: Fish folds less (from the deleted STYLE_PRIORS)
- AF adjustment: low AF → folds less (AF is why they're classified Fish)
- VPIP adjustment: high VPIP → folds less (VPIP is why they're classified Fish)
- Villain model: observed fold rate is low (from same hands used for classification)
- All four encode: "This player folds less." Applied multiplicatively, a legitimate 30% fold rate becomes 23%.

**Example of correct (single-counting):**
- Villain model with situation-level evidence? Use model. Skip stats adjustments.
- No bucket evidence but shrunk posteriors exist? Use `villainFoldLevel` / the continuous
  transfers. (They self-degrade — no threshold gate is needed or permitted, §11.4/§11.5.)
- No data at all? The shrunk posteriors ARE the population priors at n=0; the same code
  path serves both.

### 7.5 Computed vs Lookup — Decision Framework

Before adding any constant, multiplier, or lookup table, ask:

| Question | If Yes | If No |
|----------|--------|-------|
| Can this be computed from equity + pot odds + SPR? | Compute it | Consider lookup |
| Is the needed input (equity, pot size, etc.) available at the call site? | Compute it | Thread the input, then compute |
| Does a villain model or observed stat already capture this? | Don't add another adjustment | Add as lowest-priority fallback |
| Is this a position/IP/OOP adjustment? | Derive from players-remaining and range width | Don't use position label |
| Is this a per-bucket rate? | Use per-combo equity if available | Bucket label acceptable for range-level |
| Is this a range-narrowing decision (turn/river)? | Compute per-combo equity update conditional on villain's action profile + board card (see AP-RL-01 §7.6) | Defer narrowing until per-combo derivation is available |

### 7.6 Range Narrowing: Per-Combo Derivation, Not Bucket Heuristics (AP-RL-01)

**Anti-pattern statement (AP-RL-01):** Range-narrowing decisions (how villain's range shrinks turn → river given a betting line) MUST be computed from first principles — per-combo equity update conditional on villain's action profile + board card revealed — NOT from bucket-label heuristics.

This is the most exposed surface for the label-shortcut anti-pattern: the implementation feels harmless ("on the turn, narrow to TPGK+") but encodes assumptions that hide real divergences. A particular combo might be in the TPGK+ bucket but villain's action profile assigns it 5% bet-bet frequency — different from the bucket average of 60%. The whole purpose of range-narrowing is to surface those divergences; bucket-shortcut destroys it.

**Origin:** Authored 2026-05-20 (SPR-094 / WS-207) as the binding anti-pattern from Range Lab Gate 2 Blind-Spot Roundtable Stage B (B-G3) + Stage E (E-A11). Range Lab DS-54 (per-street range evolution) is the primary implementation surface this binds; the doctrine generalizes to any range-narrowing implementation in the codebase.

**Wrong (forbidden):**
```js
// On the turn, narrow to TPGK+ since villain bet again.
const narrowed = villainRange.filter(combo => combo.bucket >= TPGK_BUCKET);
```
This uses a bucket label as the input to the narrowing decision. The bucket boundary is arbitrary relative to villain's actual action-conditional behavior.

**Wrong (also forbidden — masquerading version):**
```js
// Look up per-bucket bet-bet frequency.
const narrowed = villainRange.map(combo => ({
  combo,
  posteriorWeight: combo.priorWeight * POP_BET_BET_RATES[combo.bucket],
}));
```
Same anti-pattern — bucket-keyed lookup instead of per-combo derivation. The per-bucket rate is an aggregate over an arbitrary partition; combos within the bucket have variance the rate hides.

**Right (required):**
```js
// On the turn, recompute each combo's posterior conditional on villain's bet-bet line.
const narrowed = villainRange.map(combo => {
  const equity = computeEquityVsHeroRange(combo, board, heroRange);
  const betBetFrequency = villainActionProfile(combo, equity, potSize, spr).betBetFreq;
  const posteriorWeight = combo.priorWeight * betBetFrequency;
  return { combo, posteriorWeight };
});
```
Per-combo derivation: equity is computed from cards, frequency is derived from equity + game state, posterior is computed multiplicatively. No bucket label appears in the narrowing path.

**When bucket labels ARE acceptable** (consistent with §7.3):
- **Display**: "39% of villain's posterior range is in the TPGK+ bucket" — the bucket label is a name for an aggregate, applied AFTER per-combo narrowing.
- **Range-level summaries**: total combo count in each bucket, percentage breakdown.
- **Range-level fallback**: when per-combo equity is genuinely unavailable (e.g., partial-information game like online with unknown villain). In those cases, bucket-driven narrowing is the least-bad approximation — but must be flagged in the implementation and surfaced to the user as a low-confidence path.

**When bucket labels are NOT acceptable** (binding):
- **Per-combo narrowing decisions** — use per-combo posterior multiplicative update.
- **Frequency-weighted equity computations** — weight by per-combo derived frequency, not by bucket-average.
- **DS-54 multi-street evolution** — the entire feature value is surfacing per-combo divergence from bucket averages.

**Enforcement mechanisms:**
1. **Gate 4 surface spec binding (WS-055):** the Range Lab surface spec MUST document AP-RL-01 in the DS-54 implementation discipline section.
2. **CI lint pattern (deferred to engineering Phase 0+):** grep against forbidden patterns in `src/utils/rangeEngine/` + Range Lab narrowing implementation files. Forbidden: `[bucket === 'TPGK']` switches inside narrowing logic, `POP_NARROWING_RATES[bucket]` lookups, any per-bucket-keyed frequency table consulted during narrowing. Allowed: per-combo equity computation + frequency derivation + posterior multiplicative update.
3. **Engine sub-directory CLAUDE.md cross-reference:** `src/utils/rangeEngine/CLAUDE.md` lists AP-RL-01 in its Anti-patterns section.
4. **Project doc cross-reference:** `docs/projects/range-lab.project.md` Gate 2 audit section cites AP-RL-01 as a binding doctrine.

**Why this is a separate subsection (not just an example under §7.3):** §7.3 says "bucket labels are NOT acceptable for per-combo action probability computation." AP-RL-01 extends that to *range narrowing*, which is a distinct operation — narrowing computes a *posterior* over the range, not an action probability. The two concepts are mechanically similar (multiplicative Bayesian update conditional on observation) but semantically distinct (action prob = forward inference; range narrowing = backward inference given observed action). Making AP-RL-01 explicit prevents engineers from reading §7.3 and concluding "but range narrowing is different."

---

## 8. Common Mistakes This Document Prevents

1. **Treating equity as a percentage to compare**: 55% equity is NOT "barely winning." It's a significant edge that compounds over hundreds of hands.

2. **Ignoring position in exploit generation**: An exploit valid for EP is often wrong for LP and vice versa.

3. **Assuming folding = weakness**: Folding is often correct. A tight player who folds 80% of hands isn't weak — they're waiting for good hands. The exploit is to steal their blinds, not to assume they're bad.

4. **Conflating "plays too many hands" with "bad player"**: A LAG who plays 30% of hands with aggression can be very strong. The exploit is different from a fish who plays 30% passively.

5. **Treating postflop strength as static**: A hand's strength changes with every card. Top pair on the flop can become a marginal hand on a completing-straight-draw turn.

6. **Using mean equity when distributions matter**: Against a polarized range (nuts or bluff), your middle-strength hand has ~50% equity on average but wins 0% vs their value and 100% vs their bluffs. The DISTRIBUTION matters for decision-making.

7. **Assuming bet sizing directly reveals range shape**: A half-pot bet does NOT necessarily mean "linear range" and a 2x pot bet does NOT necessarily mean "polarized." Sizing-to-strength correlation is player-specific, mediated by board texture and street, and must be calibrated by showdown data. Without showdowns, sizing is an unreliable signal. With showdowns, it can become the most exploitable tell a player has.

8. **Skipping from analysis to exploit without identifying the weakness**: "Player has high VPIP" is an observation. "Player calls with hands below the equity threshold" is the weakness. "Value bet thin, never bluff" is the exploit. Each phase requires the previous one. Generating exploits without first identifying the specific -EV decision is how incorrect recommendations get produced.

9. **Treating MDF as a mandate rather than a baseline**: MDF tells us the theoretically correct defense frequency. But exploitative play deliberately deviates from MDF. Against a player who never bluffs, folding 100% to their bets is correct even though MDF says defend. Against a player who always bluffs, calling 100% is correct even though MDF says fold some.

10. **Using position labels as decision drivers**: "EP folds more" is an observed correlation, not a cause. EP folds more because of players remaining to act, narrow ranges, and OOP disadvantage — all computable from game state. Never use `if (position === 'EP') foldRate *= 1.05`. Instead, compute from the factors that CAUSE the fold rate difference. (See §7.2)

11. **Using bucket labels instead of per-combo equity**: When the game tree evaluates individual combos, it has exact equity. Using `POP_CALLING_RATES['air'] = 0.08` when the combo's actual equity is 0.12 and pot odds are 0.25 discards information. The logistic `f(equity / potOdds)` is always more precise than a bucket lookup. (See §7.3)

12. **Double-counting style and stats**: Style IS stats. A "Fish" is defined by VPIP>40 + PFR<10. Applying a Fish multiplier AND a VPIP>40 multiplier AND a low-AF multiplier counts the same signal 3×. Each behavioral dimension should be counted exactly once — use the highest-fidelity source available and skip the rest. (See §7.4)

13. **Treating IP/OOP as a binary structural fact**: IP/OOP is contextual — UTG+1 is IP vs UTG but OOP vs everyone else. The advantage comes from acting last (better information, free cards, equity realization), not from a label. Whether a player is IP depends on who they're against in the current hand, not their seat number.

14. **Reading a protection bet as a leak**: Betting a vulnerable made hand on a draw-heavy board is *correct play* — the profit is equity denial, not a call from worse (§3.4). A classifier that can only express value / bluff will file it as thin value (→ "over-values medium hands") or as a bluff (→ "over-bluffs"), inventing a weakness the player does not have and pointing hero's counter-strategy the wrong way. Before flagging aggression with medium-strength hands, ask whether the board gives the opposing range live draws. On a dry static board the same line IS over-valuing; on a wet board it is protection. **Board texture is the discriminator, and omitting it turns a correct play into a false read.** (See §3.4.2)

---

## 9. Documented Divergences

This section catalogs places where our authored content or engine defaults intentionally depart from solver baseline to teach — or serve — live-pool realities. Each entry names the content, the divergence, and the justification. Entries are added via the LSW-A* audit stream when external validation surfaces a category-D disagreement (external source disagrees but our position is deliberate).

### 9.1 Live-pool donk framing in 3BP on non-broadway middling boards

**Content:** `btn-vs-bb-3bp-ip-wet-t96` Line Study line + any future line where BB donks in 3BP on middling non-broadway boards (T96, T98, 987, 876, etc.).

**Divergence:** In solver-baseline (per GTO Wizard "Navigating Range Disadvantage as the 3-Bettor"), BB checks most of this texture in 3BP OOP: PFR caller (BTN) has more sets, two-pair, and suited-connector straight combos — BTN has nut advantage, not BB. Our authored line has BB donking at 33% frequency on T96ss.

**Justification:** This is a common live-pool tendency (888poker + PokerNews "Donk Betting in Small-Stakes Live NL"). Our target student is a live-pool player who will face the spot many times per session. Teaching the response to the live-pool donk has real EV for them; insisting on solver-pure BB behavior would mean not teaching this spot at all.

**How it is surfaced to the student:** The line's `why` section on `flop_root` explicitly labels BB's donk as a live-pool deviation, not a principled nut-advantage play. Students internalize "this is how you respond when BB donks — a real live-pool pattern," not "BB should donk here."

**Originating audit:** LSW-A1 (`docs/design/audits/line-audits/btn-vs-bb-3bp-ip-wet-t96.md`), category-D finding D1.

### 9.2 Live-pool BB flat-call range in BTN-vs-BB SRPs

**Content:** `btn-vs-bb-srp-ip-dry-q72r` Line Study line + any future BTN-vs-BB SRP line that references BB's flat range composition.

**Divergence:** Modern solver (per [PokerCoaching 100bb HUNL charts](https://poker-coaching.s3.amazonaws.com/tools/preflop-charts/100bb-hunl-cash-game-charts.pdf) and [Betting Data Lab — 3bet Range Strategy](https://betting-data-lab.com/poker-3bet-range-strategy-for-cash-games-what-actually-works/)) has BB 3bet TT+/AJs+/AQo+ vs BTN opens with polarization (QQ 3bets 98% across positions, JJ/TT majority 3bet, AK/AQ/AJs majority 3bet, blocker bluffs). Our authored `flop_root.why` on the Q72r line assumes BB flats QQ-TT (3bets only KK+/AA). This is an older live-pool convention, not solver-current.

**Justification:** Live pool at 2/5–5/10 cash flats QQ-TT much more often than solver recommends, especially vs button opens where stack preservation and set-mining incentives push the flat frequency up. The line's target student is a live-cash player; teaching them to expect the wider flat range composition matches the table they actually sit at.

**How it is surfaced to the student:** The line's `why` section on `flop_root` explicitly labels the BB flat-range assumption as the live-stakes convention ("live cash flats QQ-TT much more often than solver, which 3bets QQ+/JJ/TT+"). The "nut advantage" framing is tightened to "modest, not strong" to reflect that if BB flats QQ, both players have 3 QQ combos on the flop (tied on top set).

**Originating audit:** LSW-A2 (`docs/design/audits/line-audits/btn-vs-bb-srp-ip-dry-q72r.md`), category-D finding.

### 9.3 SB flat-call of BTN 3-bet

**Content:** `sb-vs-btn-3bp-oop-wet-t98` Line Study line + any future line where SB defends a 3bet via flat call.

**Divergence:** Modern solver ([888 Poker — SB vs BB 3bets Strategy](https://www.888poker.com/magazine/sb-vs-bb-3bets-strategy); [Upswing — React to Preflop 3-Bets](https://upswingpoker.com/vs-3-bet-pre-flop-position-strategy-revealed/)) has SB essentially never flat-call a BTN 3bet — the correct preflop action is 3bet-or-fold almost exclusively. Structural reasons: SB plays OOP vs polar range from a vulnerable seat; flat-calling signals weakness and invites BB squeeze exposure.

**Justification:** Live pool at 2/5 and below flats 3bets with QQ-TT and AKs/AQs more often than solver (especially in tougher games where 4-betting light gets run over by nits). The T98 line exists to teach overpair discipline on wet flops — a high-frequency live spot — and the SB-flat-3bet pathway is the only way to construct that spot in an SRP/3BP framing. Without the live-pool flat, we'd have no "AA OOP in 3BP on wet board" teaching node at all.

**How it is surfaced to the student:** The line's `flop_root.prose` section (first paragraph) explicitly labels the SB-flat-3bet as "a live-pool pathway (modern solver has SB 3bet-or-fold vs BTN 3bets; SB barely flats)." Students internalize "this is how you defend AA on wet 3BP flops when the preflop pathway did put you OOP — the response matters more than the rare pathway."

**Originating audit:** LSW-A4 (`docs/design/audits/line-audits/sb-vs-btn-3bp-oop-wet-t98.md`), category-D finding D2.

### 9.4 Live-pool small-sizing donk composition skews value-heavy

**Content:** Any line where BB (or OOP) donks at small sizing (25-50% pot) on flop or turn — initial reference: `btn-vs-bb-3bp-ip-wet-t96` `flop_root` and analogous IP-vs-OOP donk spots on wet/connected boards.

**Divergence:** Solver-balanced polar ranges at small sizings should be approximately 50:50 value:bluff (or wider on bluff side at small sizings to maintain pot-odds balance). Population observed composition at live 1/2-5/10 NL cash skews systematically value-heavy: ~60-80% value / 20-40% bluff. Pool donks overpairs and middle-pair value at solver-non-aligned frequencies; pool donks blocker-bluffs (A-high blockers) less than solver prescribes.

**Justification:** This composition skew is the load-bearing exploit in IP-vs-OOP-donk lines. Hero's response (call-wider for value-catching, raise-less because raise folds out the bluff region we beat) depends on knowing the actual composition diverges from solver-balanced. Teaching against the solver-balanced range produces under-defends (over-folds vs the value-heavy actual range) and over-raises (folds out the bluffs we dominate).

**How it is surfaced to the student:** Upper-surface artifacts cite the value-heavy composition explicitly in §5 (population baseline) with composition tables (e.g., `btn-vs-bb-3bp-ip-wet-t96-flop_root.md` §2.10-2.16). The §6 exploit recommendation traces the deviation-from-solver to this composition rather than to a "raise more" or "fold more" rule of thumb.

**Originating audit:** Stage 4 leading-theory comparison for `btn-vs-bb-3bp-ip-wet-t96-flop_root` (`docs/upper-surface/comparisons/btn-vs-bb-3bp-ip-wet-t96-flop_root-external.md`), proposed §9.X entry.

### 9.5 Live-pool over-bluffs the capped-IP-checked-turn → polar-OOP-river-bet pattern

**Content:** Any line where IP signals capped range via checking (back) the turn, and OOP responds with polar river aggression — initial reference: `btn-vs-bb-srp-ip-dry-q72r` `river_after_turn_checkback` and analogous SRP/3BP river-after-turn-checkback structures.

**Divergence:** Solver-balanced polar bet ranges at 75% sizing should be approximately 70:30 value:bluff (matches MDF-balance). Population at live 1/2-5/10 NL cash bluffs this exact pattern at materially higher rates — ~55-60% value / 40-50% bluff. The pool's over-bluff stems from misreading hero's capped-checked-turn signal as universally weak and over-attacking with polar aggression that maintains too-many bluff combos for solver-balance.

**Justification:** This is one of the highest-leverage exploitable patterns in live cash. Hero's response (call medium pair vs polar river bets; default-call across reg/pro/fish; archetype-override only vs confirmed nits) depends on the over-bluff calibration. The exploit framing is well-documented in coaching content (Doug Polk's "two most over-bluffed lines in cash"; GTO Wizard "Calling Down the Over-Bluffed Lines in Lower Limits" though stake-scope of source is online-micro per Stage 4 finding).

**How it is surfaced to the student:** Upper-surface artifact `btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback.md` §5 Claim 1 establishes the over-bluff baseline; §6 default recommendation cashes the exploit; §12 Assumption C surfaces the nit-archetype-override as the only fold case. Drill-card surface (`docs/upper-surface/drill-cards/...`) names the headline falsifier (sample showing bluff fraction ≤22%) at the recommendation site.

**Originating audit:** Stage 4 leading-theory comparison for `btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback` (`docs/upper-surface/comparisons/btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback-external.md`), proposed §9.X entry.

### 9.6 Schema-encoding: preflop decisions encoded as `street: 'flop'`

> **Note — this is NOT a solver-theory divergence.** Entries 9.1–9.5 catalog places where our authored *poker content* intentionally departs from solver baseline. This entry is a different category: a **data-model encoding workaround**. The poker content of the affected line is correct; only its representation in the Line schema is a workaround. It lives here because WS-090's acceptance criteria named §9.x, and because it is the kind of latent divergence the domain-correctness program exists to keep visible.

**Content:** The `utg-vs-btn-squeeze-mp-caller` Line (`src/utils/postflopDrillContent/lines.js`) — its `pre_root` node and the three terminal nodes it branches to (`terminal_4bet_qq_squeeze`, `terminal_call_squeeze_caller_behind`, `terminal_overfold_qq`). This is currently the **only** preflop-decision Line in the catalog.

**Divergence:** The Line teaches a *preflop* squeeze decision (Hero UTG with QQ facing a BTN squeeze, deciding 4bet / call / fold). The Line schema's `STREETS` enum (`src/utils/postflopDrillContent/lineSchema.js`) only admits `'flop' | 'turn' | 'river'` — there is no `'preflop'` street kind. To pass validation, each preflop node is encoded with `street: 'flop'` and a **fabricated illustrative board** (`['Q♣','8♥','2♦']`) that exists solely to satisfy the validator's rule that a `'flop'` node carry exactly three board cards (`validateNode`, board-length check). The board does not correspond to the preflop decision being taught.

**Why this is low-harm (and therefore documented, not fixed):**
- The fabricated board is **computationally inert**: `pre_root` declares no `heroView` / `villainRangeContext` / `comboPlans`, so `BucketEVPanelV2` and the equity/bucket engine never run on it. No EV or range math reads the fake board.
- The board is **not rendered as a board visual** — `LineNodeRenderer` renders `node.street` as a small text label but does not paint `node.board` for these nodes. The only user-visible artifact is the street label reading "FLOP" during the preflop decision; the decision prompt ("BTN squeezes to 13bb. Hero UTG with QQ") keeps the context unambiguous to the student.

**Why not extend the schema:** Adding a first-class `'preflop'` street kind would touch ~14 `.street`/`STREETS` consumer sites across `postflopDrillContent/` and `PostflopDrillsView/` (board-geometry, narrowing, breadcrumbs, renderers), several on the live drill surface — an L–XL change with real regression risk. That cost only amortizes once **multiple** preflop Lines exist; today there is one. Building first-class preflop support for a single Line is premature (WS-090 decision, 2026-06-13, Option A).

**Follow-up trigger:** When a **second** preflop-decision Line is authored, revisit the schema-extension path (add `'preflop'` to `STREETS`; `validateNode` expects `board.length === 0` for it; migrate the encoded nodes; audit the ~14 consumers; add tests). Until then, the workaround is self-documenting via the `SCHEMA-WORKAROUND(WS-090)` markers in `lineSchema.js` and `lines.js` (greppable).

**Originating audit:** WS-090 (`LSW-G-PreflopEnc`), domain-correctness program; surfaced in the LSW surface audit as H3-F2.

---

## 10. Tournament Theory & ICM

**Mandatory before editing `src/utils/icmEngine/` or any tournament decision logic.** Everything above §10 is cash-game doctrine where a chip is worth a fixed amount of money. Tournaments break that assumption. This section governs tournament strategy the way §1–§9 govern cash.

### 10.1 Chips Are Not Dollars

In a cash game, a chip is worth its face value — winning a 100-chip pot is worth exactly 100 chips of expected money, always. **In a tournament, chips have non-linear monetary value.** You cannot re-buy your tournament life (in a freezeout), and the prize pool is fixed and paid by finishing position, not by chip count. Consequences:

- **Chips won are worth less than chips lost.** Doubling your stack does NOT double your equity in the prize pool; busting takes you to $0 (or the next pay tier). This asymmetry is the entire basis of tournament strategy.
- The correct unit for every tournament decision is **$EV (dollar expected value)**, not **chip-EV**. A play can be chip-EV-positive (gains chips on average) but $EV-negative (loses real money on average) — and you must fold it. Calling an all-in on the bubble with a chip-EV +0.5bb edge is frequently a large $-losing mistake.

### 10.2 The Independent Chip Model (ICM)

ICM maps `{ chip stacks } + { payout ladder } → { $EV per player }`. The standard model is **Malmuth-Harville**:

- **P(player i finishes 1st) = stack_i / total_chips.** (Probability of winning ∝ share of chips in play.)
- For each possible 1st-place finisher, recurse over the remaining field to assign 2nd place (renormalizing by the remaining chips), then 3rd, and so on down to the number of paid places.
- **$EV_i = Σ_place P(i finishes in place) × payout[place].**

Properties the engine MUST reproduce (these are the correctness tests):
- **Σ $EV_i === total prize pool** (conservation — no money created or destroyed).
- **The chip leader's $EV is LESS than their proportional chip share** of the prize pool; **a short stack's $EV is MORE than its proportional chip share.** This is the mathematical signature of ICM — if your model doesn't show it, it's wrong.
- Equal stacks → equal $EV.

**Cost:** exact Malmuth-Harville is factorial in field size. It is exact and cheap at a **final table** (≤9 players) — which is where ICM pressure is largest. For larger modeled fields, cap the recursion / modeled stack count and flag the result approximate (see §10.7). Do NOT silently run an unbounded recursion.

### 10.3 Risk Premium / Bubble Factor — A Derived Quantity, Never a Label

The **risk premium** (a.k.a. bubble factor) is how much MORE raw equity you need than the chip-EV pot odds suggest, before a call/shove is +$EV. It is **computed from ICM**, never looked up from a label:

- Compute hero's $EV at the current stack.
- Compute hero's $EV in each outcome of the gamble: **win** → $EV at the larger (post-double-up) stack; **lose** → $EV at 0 (or the locked next pay tier).
- The break-even equity that makes calling +$EV is higher than the chip-EV break-even by the risk premium. Near the bubble / a big pay jump, the premium is large (you risk your tournament life for chips worth little); deep-stacked early or once the money is locked behind you, it approaches 1 (chip-EV ≈ $EV).

**Forbidden:** deriving tournament aggression from the M-ratio *zone label* ("we're in the Shove/Fold zone, so shove"). M-ratio and bubble-distance zones are **descriptive outputs**, not decision inputs — exactly parallel to §7.2 (position labels). The decision derives from $EV (ICM) + equity + stacks + payouts + players-remaining. M-ratio is a proxy for stack depth; use the actual effective stack and ICM.

### 10.4 Push/Fold Is a $EV Decision

At short stacks (≈ ≤ 15–20bb effective), play collapses to shove-or-fold preflop (no room to play postflop). The correct shove/call ranges come from **$EV**, not a chart label:
- **Chip-EV push/fold** (Nash equilibrium / SAGE) is the baseline — correct when chips ≈ dollars (early MTT, or once on a steep enough payout it's locked).
- **ICM-adjusted push/fold** tightens the calling range (and sometimes the shoving range) by the risk premium near pay jumps. The calling range tightens more than the shoving range because the caller risks busting to win chips, while the shover often has fold equity.

The current app uses the cash equity-threshold label (`eq ≥ 0.55 = VALUE`) at all depths — that is the wrong model below ~15bb and must be replaced by push/fold $EV when that work lands.

**ICM in the postflop game tree (WS-251, the exact slice).** Preflop all-in jams are ICM-aware in `pushFoldEngine`. The postflop game tree (`gameTreeEvaluator.js`) now also discounts **committed (effectively all-in) stack-offs** by the risk premium: `icmAdjustedEV = chipEV − (β−1)·P(lose)·atRiskChips`, applied via `computeCommittedIcmTax` when an optional `icmContext` (`{stacks, heroIndex, payouts, villainIndex}`) is supplied. This form is *exact* only when chips-won ≈ chips-risked, so it is gated to actions risking ≥85% of the effective stack, heads-up. **Still chip-EV (deferred):** partial-pot postflop bets (needs §10.6-flagged approximation) and multiway committed spots. Cash games pass no `icmContext` → identity (β ≤ 1 → zero tax).

### 10.5 M-Ratio Is a Descriptor, Not a Decision Driver

M-ratio (Harrington) = `stack / (sb + bb + antes per orbit)` — a stack-depth descriptor. It usefully *describes* urgency, but like every label in §7 it must NOT be a direct decision input. Two players with the same M can face very different correct decisions depending on ICM (bubble vs. deep field), position, and the payout ladder. Compute from $EV and effective stack; let M *describe* the situation to the user, not drive the math.

### 10.6 Multi-Table Approximation Honesty

Exact ICM requires **every remaining player's stack.** The app only directly observes the stacks at hero's table (`chipStacks`) plus a `playersRemaining` count.

- **Final table** (`playersRemaining === seated players`): the observed stacks ARE the full field → ICM is **exact**. This is where ICM matters most.
- **Pre-final / multi-table**: the unseen field must be **approximated** (e.g. bucket the unknown players at the average remaining stack). The result is a genuine estimate and MUST be flagged `isApproximate` to the user and in any persisted value. Do NOT present an approximated ICM number as if it were exact.

This mirrors §5's evidence-honesty stance: surface the confidence/approximation, never a falsely-precise figure.

### 10.7 Satellite Payout Inversion

In a **satellite** (flat payout — the top N all win an identical seat/ticket, everyone else gets nothing), ICM strategy *inverts*: once you have enough chips to lock a seat, **additional chips are worth nothing** and survival dominates — you fold hands that are massively chip-EV-positive because they cannot improve your $EV but can bust you. The engine's payout ladder representation must support flat/identical payouts so this falls out of the ICM math automatically rather than needing a special case.

### 10.8 Anti-Patterns (tournament-specific)

- **DO NOT use chip-EV for tournament decisions near the money.** Chip-EV ≈ $EV only deep-stacked early or when the pay structure behind you is locked. Otherwise compute $EV via ICM.
- **DO NOT drive aggression from M-ratio / bubble-distance zone labels.** They are descriptors (§10.3, §10.5). Compute from $EV.
- **DO NOT present approximated multi-table ICM as exact** (§10.6). Flag it.
- **DO NOT assume a chip is a chip for the DECISION.** (It still is for splitting a *pot* — side-pot math is chip-level and unchanged; ICM changes the call/fold/shove *decision*, not pot resolution.)
- **DO NOT special-case satellites with ad-hoc rules** — represent flat payouts in the ladder and let ICM produce the survival strategy (§10.7).

### 10.9 Governance

The `src/utils/icmEngine/` engine is governed by this section under `prog-domain-correctness`, the same as `exploitEngine/`/`rangeEngine/`. Its sub-directory `CLAUDE.md` lists the anti-patterns above; the domain-correctness baseline/sweep cross-checks ICM code against §10.

---

## 11. Implemented Engine Algorithms

This section documents algorithm hierarchies and parameter schemes that exist in the
engine code but were previously undocumented here (FIND-012 / WS-243). These are
**implementations of the principles above**, recorded so the doc does not lag the code.
None of them override the first-principles doctrine in §7 — note in particular that the
SPR *zones* are descriptive labels while the *decision math* uses a continuous function
(§11.2), exactly as §7 requires.

### 11.1 Personalized Fold-Curve Hierarchy

When estimating how a villain's fold frequency responds to bet size, the engine resolves
fold-curve parameters (`maxDelta`, `steepness` / `steepnessUp` / `steepnessDown`,
`midpoint`) from the **highest-fidelity source available**, never stacking lower tiers on
top (this is the §7.4 no-double-counting rule applied to fold curves):

1. **Personalized** — `fitFoldCurveParams(foldCurveData)` fits the curve from THIS villain's
   observed bet-facing data when enough exists (`villainModelData.js`).
2. **Explicit params** — caller-supplied `steepness` / `midpoint` / `maxDelta` overrides.
3. **Population default** — `FOLD_CURVE_PARAMS.default`.

(The former style tier — `FOLD_CURVE_PARAMS[style]`, six `computeFoldCurveForStyle`
scalings whose multipliers were self-declared unmeasured founder estimates — was removed
by WS-436: the label channel measured as zero villain-action information on 10,147 paired
corpus decisions, and personalisation never rescales a measured curve's shape (§11.1b).
The personalized fit now regularises toward the population shape; its LEVEL is the
villain's own observed fold rate.)

Resolved in `foldEquityCalculator.js` `findOptimalBetSize`: `personalizedFoldCurve ||
FOLD_CURVE_PARAMS.default`. The fold response itself is a
logistic in bet fraction (`logisticFoldResponse`), consistent with §3.5 (small bets barely
move fold%, medium bets steepest, overbets bimodal) — not a linear scaling.

#### 11.1a The shape is MEASURED; the level is not (WS-283)

Tier 4 — `POPULATION_CURVE` — was a founder estimate until WS-283 fitted it against the
HandHQ corpus. **Only the shape changed.** `POPULATION_PRIORS.bet.fold` and
`STAT_PRIORS.foldToCbet` are untouched, and that division is the point: the corpus is
online cash July 2009 and the founder plays live 9-handed 1/2–1/3, so under the ratified
live/online separation (WS-259) an online-mined *gradient* may inform a live model while an
online *base rate* may not. `baseFold` still comes from the §6.5a hierarchy; the curve only
says how that rate moves when the price changes.

| | before | after (fitted) |
|---|---|---|
| `maxDelta` | 0.25 | **0.95** |
| `midpoint` | 0.75 | **0.35** |
| `steepnessUp` / `steepnessDown` | 4.0 / 2.0 | **6.5 / 0.75** |
| `steepness` (symmetric fallback) | 3.0 | **1.0** |

**Two defects, both of shape, neither fixable by a base-rate correction.**

1. **`baseFold` was anchored 0.40 pot-fractions too high.** `logisticFoldResponse` returns
   `baseFold` exactly at `fraction === midpoint` and nowhere else, while every caller hands
   it an *unconditional* fold rate. `midpoint` must therefore be the sizing at which the
   field's *conditional* fold rate equals its *unconditional* one — a measurable quantity,
   not a free knob. It is 0.35× pot. Anchored at 0.75 on a curve with a steep left limb,
   the model subtracted from the base at every sizing below 0.75×, and **71% of real bets
   are below 0.75× pot**. This is why the measured error changed SIGN with sizing rather
   than being a constant offset.
2. **`maxDelta` capped the swing below the signal.** It bounds the total achievable swing,
   so at 0.25 the curve could span 25 points of fold rate across all sizings while the
   field spans ~78 (6.4% fold at 0.03× pot, 84.2% at 2.0×). No setting of `midpoint` or
   `steepness` could have fitted that — the ceiling itself was the defect.

**Measurement.** Fit on POOL players, days 1–11 (k=98,273 / n=178,174); scored on EVAL
players, days 12–23 (k=178,794 / n=318,347). Two-level structural leakage guard — player
partition *and* walk-forward in time — because a corpus-mined constant scored on the corpus
that produced it measures memorisation (§14, `scripts/backtest/partition.mjs`). Residual
versus sizing on the hold-out, intercept calibrated out so only shape is scored:

```
n-weighted slope of (observed − predicted) on bet fraction:   +0.1409  →  +0.0078
Brier, same 316,178 decisions:                                 0.24054 →  0.23530
```

**Consequences elsewhere, both from the same root — a copy of the old midpoint.**
`preflopFoldResolver` had linearised the pot-fraction → pot-odds change of variables at the
old midpoint (`1 / 0.16`); carrying that forward tripled the preflop response and drove
squeeze fold-through into its clamp. It now applies the map *exactly*
(`f = r / (1 − 2r)`, displacement taken relative to `REFERENCE_POT_ODDS`), which needs no
constant and can never be steeper than the postflop curve it comes from.
`gameTreeEquity.multiwayFoldPct` still defaults `betFraction = 0.75`; both production call
sites pass an explicit fraction, so it is reachable only from tests — recorded, not fixed.

**What was NOT established.** `FOLD_CURVE_STREET_MODS` refit independently per street
returns essentially the same shape on flop, turn and river, and applying the shipped
multipliers on top of the fitted curve is *worse* on the hold-out (flop 0.23668 → 0.23723,
river 0.22844 → 0.22885). The effect is ~5e-4, an order of magnitude under the
population-curve correction, so the values are left alone and the poker-theory
justification they carried is withdrawn rather than inverted. The per-style curves
(`computeFoldCurveForStyle`) that were still unmeasured at WS-283 were DELETED by
WS-436 — see §7.4.

**Residual the fit does not remove.** Below ~0.15× pot the curve still over-predicts
folding by 3–13 points. A bounded logistic in raw pot fraction cannot reach a 6% floor.
The principled fix is to re-express the curve in the *price* villain is offered,
`s / (1 + 2s)` (§6.2) — the variable §11.4 already uses preflop — but that is a
functional-form change with a much wider blast radius and was deliberately not taken.

#### 11.1b A fitted curve has an AXIS and an ANCHOR, and both were wrong for a raise (WS-402)

§11.1a fitted the curve. WS-402 found that the EV path was **evaluating it on a different
variable from the one it was fitted on**, with a **different curve from the one fitted for
the action**, from an **anchor the base estimate never had** — three errors that compound
and all push the same way. Together they made the engine raise **91.9%** of the time facing
aggression, against a pool that raises 12.5% and a hero who raised 10.5% (n=86 scored corpus
decisions). Nothing else can make a raise dominate for hero's *entire* range at once: only a
term that is independent of hero's cards can, and `pFold × pot` is that term.

**1 — the axis.** `mine-fold-vs-sizing.mjs` defines the fitted axis as
`owed / (potIncludingFacedBet − owed)`. Facing a bet of `b` into `P` that is `b/P`, which is
what `betFraction` already was. **Facing a raise to `R` over villain's bet `B` it is
`(R − B) / (P + 2B)`** — villain's already-posted bet is in the pot and is not part of what
they must call. `heroActionBuilder` labels a raise `increment / (P + B)`, omitting `B` from
the denominator. On `P=100, B=65` with a 54 raise on top, the fitted axis reads **0.235** and
the engine fed the curve **0.327** — a 39% overstatement, landing exactly where `steepnessUp`
(6.5) is steepest. This is the same asymmetry §6.2 and `villainRequiredEquity` already carry,
in the same direction, for the same reason.

**2 — the curve.** `POPULATION_CURVE` is fitted on seats facing a live **bet**;
`fit-fold-curve.mjs` says so in its own conditioning-set header and reports the raise
population only as a footnote. Facing a raise is a different population and its response is
measurably different — the marginal is **0.4242** against 0.5616, and the shipped bet curve
leaves a residual slope of +0.0522 on it. That refit was measured and never merged, so hero's
raises were priced with hero's-bets' instrument. `POPULATION_CURVE_RAISE` is that refit
(`scripts/foldCurve/fit-raise-curve.mjs`, same corpus / form / partition / split):

| | facing a BET | facing a RAISE |
|---|---|---|
| marginal fold (hold-out) | 0.5616 | **0.4242** |
| `maxDelta` | 0.95 | **0.65** |
| `midpoint` | 0.35 | **0.40** |
| `steepnessUp` / `steepnessDown` | 6.5 / 0.75 | **8 / 3.25** |
| hold-out Brier | 0.23530 | **0.21754** (bet curve on the same rows: 0.22007) |
| hold-out residual slope | +0.0078 | **−0.0367** (bet curve: +0.0522) |

The field discriminates on price much harder facing a raise: it folds far less to a small one
and keeps folding more as the raise grows, where its response to a large *bet* flattens.
**No per-style scaling is applied to the raise curve** — `computeFoldCurveForStyle`'s
multipliers are explicitly unmeasured founder estimates, and attaching them to a freshly
measured curve would be §7.4 stacking. Personalisation for raises enters through the LEVEL,
inside `estimateFoldPct`.

**3 — the anchor.** §11.1a establishes that `midpoint` is *the sizing at which the field's
conditional fold rate equals its unconditional one*, i.e. `baseFold` must be UNCONDITIONAL.
Since WS-307 it is not: `estimateFoldPct`'s per-combo branch prices every combo against
`villainRequiredEquity`, which reads pot geometry, so its output is already **a fold rate at
a sizing** — for a raise, at the representative `R = 3B`, which is a fitted-axis fraction of
0.565. Handing that to a curve anchored at 0.35 counts the sizing response **twice**, from an
origin the estimate never had. The estimate now reports the anchor it does have
(`meta.sizingFraction`) and is moved along the curve as `base + d(s) − d(s₀)`.

**Measured, against the pool's realized fold-to-raise rate by sizing bucket**
(`out/fold-vs-sizing.json`, n=145,430 raise-facing decisions), sweeping eight raise sizes on
three spots — mean absolute error of the engine's `pFold`:

```
spot                       shipped   structural-only   fixed
flop A♠K♦6♠  P=100 B=65     0.129        0.071         0.041
flop J♥T♥9♦  P=120 B=80     0.177        0.077         0.070
turn A♠7♥2♦9♣ P=200 B=120   0.369        0.256         0.259
```

The bias is **positive in every cell**: the engine over-estimated folding at every sizing it
was checked at. Inflated fold equity does not make the engine timid, it makes it **reckless**
(§13.3), and it inflates the WEAKEST hands most, because a hand with no showdown value is
priced almost entirely off the fold branch.

**What this did NOT fix, stated so it is not mistaken for fixed.** The residual — largest on
the third row — is a **level** error, not a shape error. WS-402 named two causes for it and
declared them coupled and of opposite sign. §11.1c settles that.

The `check-raise` path — which prices its fold rate structurally through `crVillainResponse`
and never touches the curve — is the "structural-only" column above, and was already the better
of the two paths before this ticket.

#### 11.1c The compensator hypothesis was falsifiable, and it is false (WS-403)

WS-402's hand-off said the truncated per-combo continue probability had been *compensating*
for an over-strong `buildRepresentedHeroRange`, so neither could be corrected alone. That
claim makes a prediction: **change the represented range, and what lifting the ceiling does
must change too.** Crossing {represented range} × {ceiling} and recomputing the fold estimate
from the same per-combo distribution (`scripts/backtest/probeCeilingInteraction.mjs`), the
ceiling delta is the same across every candidate range, including one polarised at §12.4's
balanced bluff share:

| represented range | Δ fold, ceiling 0.80 → 0.96 |
|---|---|
| shipped (equity-monotone) | A♠K♦6♠ −0.096 · J♥T♥9♦ −0.084 · turn −0.043 |
| polarised (balanced bluffs) | A♠K♦6♠ −0.103 · J♥T♥9♦ −0.108 · turn −0.041 |

The two terms are close to independent. Three further corrections follow, and each is a
methodological one rather than a poker one:

**A sensitivity is not an error.** The 27–48 point swing was measured between "hero represents
a raise" and "hero represents NOTHING" — an un-narrowed uniform grid, i.e. the null. A
load-bearing input is supposed to be load-bearing. At the canonical anchor the shipped estimate
sits on the pool's own rate on two of three spots (0.489 vs ~0.485, 0.535 vs ~0.49) and is 24
points high on the turn only. **The residual is a property of one spot.**

**A conditional may only be compared to a marginal on SLOPE.** `probeFoldSizingResponse`'s own
header says so — the engine's estimate is conditioned on this range and this board, the pool's
is a population marginal over all of them — and then its BIAS column was quoted as level
evidence for the compensation story. This is §11.5's selection-effect rule in a new costume:
scoring two things on different conditioning sets measures the sets.

**The docblock's direction claim was right and was refuted against the wrong pair.** It said
the uniform seed carries more trash than hero's true preflop range, so the represented range is
if anything weaker — the conservative direction. Measured, seeding the identical likelihood
from a real LATE-open prior makes the range **stronger** (nuts 0.100→0.187, air 0.290→0.126 on
A♠K♦6♠) and the fold estimate **higher** (0.489→0.666 / 0.535→0.540 / 0.713→0.767). What WAS
false in that docblock is its statement of the mechanism: `narrowByBoard` has not read
`ACTION_MULTIPLIERS` since WS-291 — it scores combos by `computeComboEquity` and pins the mean
weight to `DEFAULT_CONTINUATION_RATES[action]`. That false claim had been copied into two other
files and aimed the next ticket at constants that are not on the path. It is now asserted by
test rather than described.

**So the ceiling was applied on its own merits**, at all four sites that ask the question, from
`villainModelData.continueProbability`. Paired on 130 corpus decisions, facing aggression went
`fold 6.2 / call 3.8 / raise 90.0` to `fold 10.9 / call 6.8 / raise 82.3` against a pool at
`48.7 / 36.2 / 15.2`, with ESS up 33.8 → 38.9 on every slice. The pool is the population being
exploited and not the target; 82% is still not a read, and what remains is not this constant.

Lifting it also surfaced an inversion the old cap had hidden: `comboActionProbabilities`
applied the villain-model stickiness shift to a finished distribution and then renormalised, so
once `pFold` hit its clamp a **stickier** villain came out calling **less** (`pCall` 0.8301 /
0.8363 / 0.8431 for model fold rates 0.20 / 0.30 / 0.40). §7.4's rule that a label may shape a
prior but never scale a posterior has an arithmetic sibling: an adjustment must move mass that
exists, or the renormalisation decides its sign.

**Measured effect on the frequency, and the honest limit of it.** On a 48-decision fixture
spanning four prices (`facingAggressionFrequency.test.js`), the pre-fix engine raised **48/48
at every price with zero folds**; post-fix it raises 43/48, folds appear, and the raise share
falls monotonically as villain's price rises (8/8 at 0.30× pot → 6/8 at 1.75×). Price
sensitivity is restored; the aggregate share is still high, and that residual is items 1 and 2
above rather than anything left in the curve.

### 11.2 SPR Zones (Descriptive) + Continuous Sizing Multiplier (Decision)

Stack-to-pot ratio is classified into five **descriptive** zones (`getSPRZone`,
`gameTreeConstants.js`):

| Zone | SPR | Strategic meaning |
|------|-----|-------------------|
| MICRO | 0–2 | Pure commit-or-fold; any bet commits the stack |
| LOW | 2–4 | Commit-or-fold with some sizing choice; one bet ≈ commits |
| MEDIUM | 4–8 | One-street-to-commit; one more bet → pot-committed |
| HIGH | 8–13 | Two-street play; standard multi-street patterns |
| DEEP | 13+ | Full multi-street planning; positional advantage amplified |

**These zone labels are for description/UX only.** The actual fold-sizing decision uses a
**continuous** function, `sprMidpointMultiplier(spr) = clamp(0.50 + log2(max(spr,1)) ·
0.15, 0.65, 1.20)`, which scales the fold-curve midpoint (lower SPR → folds at smaller bet
fractions because the pot is already committed). This continuous form deliberately
**replaced** an earlier zone-based lookup table — per §7, the boundary labels must not be
the computation. Only active when effective stack is known (online/extension play).

### 11.3 Rake-Adjusted EV

Live/online pots are raked, which lowers the realized value of contested pots and shifts
bluff/value thresholds. `estimateRake(potSize, rakeConfig, street)` (`potCalculator.js`):

- `rakeConfig = { pct: 0–1, cap: $, noFlopNoDrop: boolean }`.
- Returns `min(potSize · pct, cap)`; returns `0` preflop when `noFlopNoDrop` is set (the
  standard live "no flop, no drop" rule); `0` when `rakeConfig` is absent.
- Applied to the **showdown pot** (`potSize + betSize · 2`) inside `findOptimalBetSize`, so
  the fold-equity EV (`calcFoldEquity`) nets out the rake hero pays when called to showdown.

**THE GATE IS THE FLOP, NOT THE SHOWDOWN (corrected 2026-08-14, FIND-137).** This section
previously read *"it never affects fold-equity from villain folding (no showdown, no drop)"* —
which renamed a real rule into a different one. The live rule is **no FLOP, no drop**: once a
flop is dealt the house takes the drop however the hand ends. **A flop bet that takes the pot
down uncontested is raked.** Confirmed by the founder in his own games (live 9-handed 1/2–1/3,
Chicago-area rooms: no preflop rake, postflop folded pots raked) and by an independent external
check. Immediate-rake jurisdictions (California, some AC rooms) are **deliberately out of
scope** — founder ruling 2026-08-14 — and `estimateRake` cannot express them.

`estimateRake` has always had the correct gate (`street === 'preflop' && noFlopNoDrop`,
`potCalculator.js:448`). The error was never in the function; it was in this paragraph and in
the call sites that read it.

So the correct shape is **per-branch rake on the pot each branch actually reaches**:

```
fold branch      pays P            raked on P          (hero's uncalled bet is returned first)
called branch    pays P + 2B       raked on P + 2B
```

A single flat `estimateRake` subtracted from a blended fold+call+raise average uses one pot for
branches that reach different pots. Under a 10%/$6 cap plus a $2 drop those amounts differ at
small pots and coincide once both clear the cap.

Rake reduces the EV of marginal value bets and thin calls, **and it reduces the fold branch
too** — so the auto-profit threshold of §6.3 sits ABOVE `bet/(pot+bet)` on every postflop
street. Worked at a Chicago-area 1/3 structure (10% to $6 plus $2 drop): a $20 bet into $30
needs **44.4%** fold-through, not 40.0%; $40 into $60 needs **43.5%**; $133 into $200 needs
**40.9%**. Largest at small pots, where the flat drop dominates.

Direction, stated because it decides which way the engine errs: omitting it **inflates fold
equity**, and inflated fold equity makes the engine **reckless, not timid** (§13.4). Same family
as the WS-365 blocker double-count and the WS-402 raise-axis miscount.

**Not yet implemented at HEAD** — `foldEquityCalculator.js:168`, `:210-211` and
`gameTreeDepth2.js:1699` still pay the fold branch untaxed. WS-451 carries the fix. Until it
lands, any postflop bluff EV this engine reports is optimistic by the amounts above.

This is a refinement of the §6.1 fold-equity formula, not a replacement.

### 11.4 Preflop Fold-Through — Per-Seat Resolution and the Chain Rule (WS-274)

Hero's open only wins the blinds uncontested if **every** live seat behind folds. Before
WS-274 that probability was `f^n` for a single invented `f` — 0.85 per seat facing a
3-bet, 0.70 per caller facing a squeeze, with re-raise risk a flat `0.04 · n`. The seats
behind hero were carried as a COUNT, so a table of nits and a table of calling stations
produced identical advice while the app held a full model for each seat.

**Resolution — one choke point.** `exploitEngine/preflopFoldResolver.js` resolves every
seat, in front of hero or behind, through the §6.5a fidelity hierarchy: villain decision
model → the seat's own observed `facedRaisePreflop` counts, Beta-blended against → the
segment pool baseline → founder estimate / position table. **Position labels are legal
only at that last tier** (§7.2 permits them as priors, never as the answer), and this is
now the single place in the preflop path that may consult one.

Two consequences of doing it there rather than at the call sites:

- **Sizing enters as price, not as a multiplier.** A seat's fold response is a logistic
  in the required equity to call, `c / (p + c)` — the §7.1 decision input — replacing
  additive nudges like `+ (multiplier − 2.5) · 0.05`. The postflop fold curves are fitted
  in pot-fraction units around a 0.75 midpoint and do NOT transfer to preflop opens of
  1.5–3.5× pot, so only the curve's SLOPE is carried over, via the change of variables
  `d(potOdds)/df = 1/(1+2f)²`. WS-283 governs the curve's absolute calibration.
- **No observation cutoff.** A seat with three observed hands contributes three
  observations against the prior's pseudocount; the Beta posterior self-weights. A
  minimum-N gate would be a threshold label, the same anti-pattern in another costume
  (founder decision, 2026-07-26). The gate exists only on the NARRATIVE — advice will not
  say "3 tight seats behind" off four hands.

**Fold-through — chain rule, with its approximation named.** Fold-through is

```
P(all fold) = P(f₁) · P(f₂ | f₁) · P(f₃ | f₁, f₂) · …
```

which is exact by construction, not a fitted correlation term — consistent with FIND-030
rejecting a correlation coefficient on `multiwayFoldPct` as texture double-counting.

Each conditional term is where the honesty is owed. Seats that fold were holding weak
cards, so those cards leave the pool and later seats are richer in strong hands and fold
slightly less: folding through three players is **harder** than `f³`. `foldThroughPerCombo`
computes each term per combo — fold probability is the equity-ratio logistic of §7.3, never
a bucket lookup, with the logistic's centre fitted per seat so the range-weighted mean
reproduces that seat's resolved aggregate rate (the refinement rides on the data, it does
not overrule it). After each seat, card availability is reduced by the probability that
seat held each card **given it folded**.

That last step is a **mean-field update, not an exact joint**. The exact conditional would
enumerate C(50,2)·C(48,2)·… card assignments and is not computable at a live decision. So
the model is strictly better than assuming independence and strictly weaker than exact —
state it that way, and do not describe the result as an exact chain rule without the
qualifier.

**MEASURED SIZE OF THE EFFECT (2026-07-26).** Card removal is real and correctly signed,
and it is **small**. Against the naive independence product, per-seat rates held equal:

| Seats behind | Fold rate 0.50 | 0.75 | 0.90 |
|---|---|---|---|
| 1 | 0.00% | 0.00% | 0.00% |
| 2 | 0.21% | 0.07% | 0.01% |
| 3 | 0.62% | 0.20% | 0.04% |
| 5 | 2.02% | 0.67% | 0.14% |
| 8 | — | 1.80% | 0.38% |

Relative shift in fold-through; the largest absolute movement across the grid is 0.18
percentage points. That is well inside the sampling error on the fold rates themselves —
a villain with 30 observed hands carries several points of uncertainty on its own rate.

Record this plainly: the per-combo path is the more correct model and it costs ~4ms for a
full table, but the quantity it recovers is second-order next to the inputs feeding it.
The first-order wins in WS-274 came from resolving each seat's rate individually at all,
not from the coupling between them. This is the measurement WS-281 was filed to obtain —
the approximation is now priced rather than merely named.

At one seat behind, the per-combo and aggregate paths agree exactly (there is nothing to
condition on), which is asserted by test as a calibration identity.

Per-combo equity comes from `pokerCore/preflopEquityTable.js`, a generated 5 × 169 table
of hand-class equity against hero's population opening range. **Hero's side of that table
is a placeholder**: the engine has no model of hero's strategy nor of what villain believes
hero holds (WS-276). Resolving hero's side to 169 × 169 would be false precision until that
lands.

Degradation is load-bearing. With no hero cards there is no deck to condition on, and the
independence product is the honest answer. With no seat data at all, every seat resolves to
the same population prior the pre-WS-274 code used, so a cold table reproduces the old
structure rather than inventing a different one.

### 11.5 Villain Context Hierarchy — Shrinkage, Not a Threshold (WS-285)

`queryActionDistribution` answers "what will this villain do here?" by looking up their past
decisions in a matching context. Contexts are nested from `facingAction` alone out to the
full six-dimensional spot, and the question is how to combine them.

**The answer is shrinkage.** Every level contributes, each one serving as the prior for the
next narrower one, scaled to a parent-constraint weight `W = 10`. A thin contextual cell
barely moves off the villain's pooled behaviour; a deep one dominates it. There is no
threshold at which specificity switches on. This is the same staged conjugate construction
as §6.5a — founder estimate → imported reference → pool aggregate → per-villain read, each
stage priming the next — applied to context instead of to population.

**Dimension order is MEASURED** (`HIERARCHY_ORDER`), broad → specific:

```
facingAction  →  isAgg  →  isIP  →  texture  →  street  →  posCategory
```

Ranked as single-dimension arms against a pooled baseline on 10,147 paired decisions:
`isAgg` −0.0167 · `isIP` −0.0081 · **pooled 0** · `street` +0.0096 · `texture` +0.0132 ·
`posCategory` +0.0153. Street, texture and position are each **worse than pooling on their
own**. Whatever survives fallback longest should be the dimension that beats pooling.

**Measured result** (paired, same decisions, HandHQ 50NL July 2009):

| Arm | log-loss | accuracy | vs old ladder | vs pure pooling |
|---|---|---|---|---|
| shrinkage W10 + measured order | **0.7582** | **58.7%** | −0.0350 (t=−10.7) | −0.0201 (t=−7.4) |
| pool everything by facingAction | 0.7783 | 55.0% | −0.0149 (t=−10.8) | — |
| reorder alone (keep the gate) | 0.7858 | 54.2% | −0.0074 (t=−5.4) | *loses to pooling* |
| old six-level gate | 0.7932 | 52.2% | — | +0.0149 |
| old gate, `min-n` raised to 25 | 0.8239 | 48.6% | +0.0307 (t=+15.0) | worse |

**Order and shrinkage are complements, not substitutes.** Reordering alone gains 0.0074;
shrinkage alone gains 0.0172; together they gain 0.0350 — more than the sum. The gate can
only *choose* one level, so a good ordering just changes which single level wins. Shrinkage
lets every level speak, which is only worth something once the levels nearest the root are
the informative ones. Neither fix alone beats pooling; both together beat it decisively.

**The gain scales with the read, and is never negative.** By villain depth: established
(≥30 obs) −0.0528 and 52.9% → 61.6% accuracy; developing −0.0152; speculative (<10 obs)
−0.0026. Live per-villain samples are far smaller than the corpus's, so expect the modest
end of that range at the table — but the change is safe when thin and compounds as reads
accumulate, which is the correct shape for a live tool.

#### The fallback-level table is a SELECTION EFFECT — do not cite it as evidence

The engine reports log-loss by which level a decision resolved at, and it rises
monotonically as the ladder falls back (level-1 0.737 → level-6 0.801 → prior 0.909). That
looks like specificity paying for itself. **It is not evidence of anything.**

*Different decisions reach different levels.* A decision that reaches level-1 is one with
many observations in a narrow cell, and those decisions are inherently more predictable. The
table compares **easy decisions to hard ones**, not one method to another. It ranks the
spots, not the ladder.

The same error in another costume: the `flat` arm (a single fully-specific level with no
fallback) scored −3.98%, which was read as "the ladder is load-bearing." It shows that
over-specificity *without* fallback is bad. It says nothing about whether the ladder beats
**pooling**, because no pooled arm existed until WS-285 ran one — and pooling won.

**The general rule: to compare two methods, score both on the SAME decisions and difference
them per decision.** Any comparison across different decision sets is measuring the decisions.
This is why `dump-records.mjs` emits index-paired per-decision records rather than scorecards.

#### On admissibility of corpus evidence (founder decision, 2026-07-27)

This hierarchy was fitted on online 2009 50NL, and §6.5a forbids sharing priors across the
live/online boundary. That rule binds prior **values** — base rates are population-specific.
It does not bind **estimator structure**: at what sample depth contextual splitting beats
pooling is a bias-variance question governed by sample depth, not by pool tendencies. Live
per-villain samples are *smaller*, which pushes the same direction harder, so the finding
errs conservative for live. Values stay segregated; structure may be fitted anywhere,
provided the direction of the error is stated.

### 11.6 A Range Never Assigns Zero — Narrowing Is Reweighting, Not Elimination (WS-291)

**Rule.** Postflop narrowing multiplies a range by `P(action | combo)`. That factor is a
**probability**, never an indicator. A range may make a holding very unlikely; it may not
declare it impossible.

This is not new doctrine. `RANGE_ENGINE_DESIGN.md` §4.3 has always required it —

> *"We CANNOT exclude a hand from a range just because we saw it in another range … every
> hand has a weight in EVERY action range."* — with `P(limp | AA) = 0.05`, "rare but not zero"

— and §6.5 has always stated the form, `P(hand | action) ∝ P(action | hand) × P(hand)`.
`narrowByBoard` nonetheless implemented `P(action | hand)` as a hard top-N quantile cut
until 2026-07-28, zeroing everything below the line and re-applying the cut each street.

**Why it matters, measured.** Scored against 8,996 revealed showdown hands on two
independent sites (`docs/research/range-calibration-2026-07-28.md`), the cut assigned
probability **zero to the hand actually held** 11% of the time on the flop, 29% on the turn
and **44% on the river**; `gameTreeDepth2` re-narrows within one evaluation, reaching 53%.
A model that says an observed event was impossible is falsified, not miscalibrated.

**The consequence is directional, and it is the expensive kind.** "Keep the top N% by
equity" cannot represent a **bluff-raise**, because a bluff is a bottom-equity combo. Facing
a raise the old cut retained 10.8% of combos and missed villain's real hand ~40% of the
time, so the engine modelled raising ranges as near-pure value — and hero **over-folds to
raises**. §4.2 makes bluff-catching depend entirely on villain's bluff frequency in exactly
that spot.

**Three properties any replacement must hold.**

1. **Never zero.** A floor keeps every live combo above zero (`MIN_CONTINUATION_WEIGHT`).
   Only the *caller's* prior may zero a cell — a preflop range that never contained the
   hand — and that exclusion belongs upstream, not here.
2. **The likelihood is independent of the prior it multiplies.** Calibrating the threshold
   on the input range makes `P(action | combo)` depend on what else the range holds: pass a
   range of nothing but quads and mean-preservation drives `P(raise | quads)` down to the
   population raise rate. Calibrate against every combo live on the board.
3. **The aggregate continuation rate is preserved.** `continuationRate` comes from observed
   behaviour; smoothing the boundary must not silently move how often villain continues.

**What the fix bought, and what it did not.** Coverage stopped decaying by street (89/71/56
→ 94/94/94) and the chained decay vanished entirely (72/58/47 → 87/87/87). But the softness
sweep showed the equity ordering earns only **~0.05 nats over not narrowing at all**, and
every setting sharper than ~0.30 loses to switching narrowing off. Same shape as §11.5: an
elaborate mechanism, never measured, barely beating the trivial alternative. Treat the
narrowing's *value* as small and provisional; treat "never zero" as settled.

> ## ✅ RESOLVED — §11.7 STRATIFIED BY TABLE SIZE, AND IT HOLDS (2026-08-01)
>
> §11.7–§11.9 were originally measured **pooled across table sizes**. That concern is now
> settled by measurement, and two claims made along the way were wrong. Both are recorded here
> because the corrections are more instructive than the confirmation.
>
> **FALSE ALARM #1 — "the corpus is two-thirds heads-up."** It is not, and never was.
> The raw `.phhs` files do contain many true 2-seat hands (PS especially), but
> `phhAdapter.toAppHand` skips `n === 2` outright (`SKIP_REASONS.HEADS_UP`,
> `phhAdapter.mjs:268`), present since the original harness commit (WS-273, `6f8b0b8`). No
> heads-up hand has ever reached a measurement. The error was reading the corpus **directory**
> instead of the **ingestion path** — two different questions.
>
> **The real confound was narrower: 6-max and 9-max pooled together.** Now measured separately.
>
> ### The stratified result — 4 cells, 2 sites × 2 strata
>
> **Cost of narrowing a CHECK** (`tau 0.3` vs narrowing off):
>
> | | FTP | PS |
> |---|---|---|
> | 6-max | −0.181 (n=2176) | −0.161 (n=5195) |
> | 9-max | −0.169 (n=2101) | −0.159 (n=3481) |
>
> **§11.7's central claim survives stratification in every cell.** Narrowing a check subtracts
> information regardless of table size, at a strikingly consistent −0.16 to −0.18.
>
> **The shipped `ACTION_TAU_FRACTION.check = 1.0` is validated in all four cells**, recovering
> 68% / 61% / 75% / 72% of the available gain. `raise` and `call` optimise at 0.3 in all four,
> also as shipped. **No engine change is warranted by stratification.**
>
> **FALSE ALARM #2 — "a bet is more informative at 9-max, so 0.3 is optimal there."** Claimed
> from FTP alone; **PS contradicts it.** FTP 9-max prefers tau 0.3 by 0.011; PS 9-max prefers
> 0.6 by 0.004. Both margins are noise. Honest reading: **bet's optimum is flat across
> [0.3, 0.6] and the two sites pick opposite sides.** The "more informative at 9-max" direction
> does replicate (+0.227 FTP, +0.074 PS) but the magnitude does not — direction only.
>
> ### The methodological lesson, which cost three retractions in one session
>
> A single-site result is a **hypothesis**. Two sites agreeing is a **finding**. Three separate
> claims this session were asserted from one site and then contradicted by the second: the trap
> amplitude, the check-back medium-weighting, and the bet/table-size effect above. Do not report
> a one-site number as established.
>
> §11.8 and §11.9 have **not** been re-run stratified. Their magnitudes remain pooled-population
> numbers; treat accordingly until someone does for them what this block did for §11.7.

### 11.7 How Much a Range Narrows Should Equal How Much the Action Says (WS-303)

§11.6 measured the narrowing's value **in aggregate** and found it small. Splitting that
aggregate by action shows why it looked small: it is an average over four numbers that do
not share a sign.

One global `TAU_FRACTION` controlled softness for every villain action. Swept 0.3 → 20
through the WS-293 probe, every arm scored on the SAME decisions, two independent sites,
250 files / 350 players each (FTP n=1,667 · PS n=1,253 check decisions). Read **tau = 20 as
narrowing switched OFF** — at that softness every combo takes the target mean, so the
posterior is just the prior. Mean log P of the hand villain actually held, vs uniform:

| tau | bet (FTP/PS) | check | raise | call |
|---|---|---|---|---|
| 0.3 | +.710 / +.666 | **+.134 / +.218** | +1.176 / +1.118 | +.647 / +.772 |
| 1.0 | +.697 / +.637 | +.260 / +.321 | +.970 / +.857 | +.575 / +.718 |
| 20 (off) | +.578 / +.512 | **+.324 / +.367** | +.639 / +.523 | +.469 / +.601 |

What narrowing is **worth** per action — on minus off, consistent on both sites:

| action | value of narrowing | reading |
|---|---|---|
| raise | **+0.54 / +0.60** | by far the most informative thing a villain does |
| call | +0.18 / +0.17 | informative |
| bet | +0.15 / +0.16 | mildly informative |
| **check** | **−0.19 / −0.15** | **narrowing a check SUBTRACTS information** |

**The poker fact underneath.** A raise is tightly coupled to the holding: villain needs a
reason. A check is the *default* when nothing suggests otherwise — villain checks with air,
with medium hands controlling the pot, with monsters trapping, and mostly because it was
their turn and nothing recommended betting. Equity is close to independent of checking. So
an equity-shaped read of a check is not merely weak, it is **confidently wrong**, and
"reads it worse than not reading it at all" is the measurable form of that.

**A sharper mechanism, founder-supplied, UNDER TEST — do not treat as settled.** "Checks are
low-information" predicts no particular shape and so cannot be falsified. The founder's
account does better: a player afraid of getting stacked makes game-time errors that push
**middling made hands** into the checking and calling parts of his range — hands he would
otherwise bet, checked because betting opens a raise he cannot face. Those hands are neither
air nor traps. They land exactly where the U-shape assigns the LOWEST check probability.

Two consequences worth carrying beyond this branch:

1. **Frequency right, composition wrong.** *"You still get 100% of the checks from this
   guy."* The action's marginal rate is fine — which is why mean-pinning to the observed
   `continuationRate` measures correctly while discrimination goes negative. When a
   likelihood is calibrated on frequency and still scores badly, suspect **shape**, not rate.
2. **Fear is game state, not a label.** "Afraid of getting stacked" is a statement about how
   much of the stack is at risk — SPR and effective depth. Drift into passive lines should
   therefore scale with commitment threat and is **computable**. A correction keyed on SPR is
   first-principles; one keyed on a "scared player" tag is §7.1 in a new costume.

**Falsifiable prediction:** the check branch's deficit should CONCENTRATE in the middle
quintiles of the range's equity distribution, with the tails roughly right. If it is spread
evenly, or sits at a tail, the mechanism is refuted and flattening remains the honest fix.
Measured by quintile-slicing villain check decisions, both sites — record the result here
before promoting any of this from hypothesis to finding. If confirmed, the correct fix is to
**reshape** the middle (keyed on commitment threat), not to flatten the whole curve; the
shipped tau of 1.0 is a blunt proxy that raises the middle by raising everything.

This is the same lesson as §11.5 and §13.3 in a new costume: **a mechanism applied at one
strength everywhere, where the right strength is a property of the situation.** Softness is
now per action (`ACTION_TAU_FRACTION`), check at 1.0 and the rest at 0.3.

**Why 1.0, and a correction that matters.** 1.0 recovers about two thirds of the gain. An
earlier draft of this section claimed it did so "while leaving usable amplitude in the U",
on the reasoning that the U keeps its ordering at any tau and only loses amplitude. **That
is false**, and the arithmetic says so. The trap term's steepest slope is
`TRAP_LIFT · 0.25 · span / (iqr · tauFraction)`; the weak term `−equity` has constant slope
−1. A local rise at the top — which is what trapping *is* — survives only while

    tauFraction  <  0.1875 · (span / iqr)

Measured flop equity distributions give span/iqr ≈ 3.0–3.5, so the critical value is ≈
0.55–0.65. §11.6 recorded the same boundary from the other direction ("at 0.60 the U-shape
collapses"). **At 1.0 the check score is monotonically non-increasing in equity.** On
A♠7♥2♦, AA takes check-weight 0.183 while KQo takes 0.721.

So the choice was never "how much U to keep" — it is **U or no U**, and what ships is
*capping*: a check monotonically lowers strong holdings.

That leaves WS-303's fourth accept criterion — "a villain who slowplays must still be
representable" — unmet at the shipped setting, and no tau satisfies both it and the q4
repair. **The criterion was refuted rather than tuned against**: §11.8 went and measured
whether the slowplayer exists before deciding whether to build a channel for one, and the
archetype does not separate from noise. The mechanism is kept **dormant, not deleted** —
below the critical softness `TRAP_LIFT`/`TRAP_SHARE` still produce a representable slowplay,
so the channel remains buildable the day a separating axis is found. The boundary derived
above is now **asserted rather than described** (`postflopNarrower.test.js` test 4 computes
`0.1875 · span/iqr` from a real board's equity mix — it measures 0.597, inside the predicted
0.55–0.65 — then checks capping above it and trapping below it). That test is green and
fails if `TRAP_LIFT` is removed. Do not restore the rise by default without an axis that
clears its control.

**Where the damage actually is — quintile-sliced, both sites.** Bucketing each decision by
where villain's true hand sat in the equity distribution of their range, value of narrowing
(sharp minus off):

| | q1 weak | q2 | q3 | q4 | q5 strong |
|---|---|---|---|---|---|
| FTP | +0.36 | +0.20 | −0.22 | **−0.58** | −0.32 |
| PS | +0.36 | +0.18 | −0.26 | **−0.53** | −0.27 |

The model reads "villain checks weak hands" *well* (q1, q2 gain). It loses from the middle
up, worst at **q4** — the 60–80th percentile, the only quintile that goes worse-than-uniform
at the sharp setting, on both sites. q3, the literal middle, is one of the better-read
buckets. That locus is not arbitrary: the U's minimum sits just below the `TRAP_SHARE = 0.10`
boundary, i.e. the top of q4. **The model's most confident claim about checking is "hands
this strong don't check", and that is exactly where players check most.** Flattening to 1.0
fixes it (−0.393 → +0.069 FTP, −0.202 → +0.233 PS) but leaves q5 short of not-narrowing —
the residual is the trap bump itself.

**The bet branch is the mirror image, and the bigger number.** `scoreCombosForAction` scores
bet/call/raise as pure equity, monotone increasing, with no bluff term at all — so the
narrower drives P(bet | air) to the floor while villains bluff anyway. Value of narrowing at
q1: **−1.19 (FTP) / −1.24 (PS)**, the largest error in the table. The check branch carries a
trap bump it should not have; the bet branch is missing a bluff bump it should. (q1 bet n =
88 / 55 — the thinnest cells; re-measure before acting.)

**The structural answer, not yet built.** Trappiness and bluffiness are **per-villain
measurables, not global constants**. `traits.trapsPreflop` already exists and already bumps
`check.nuts` in `adaptMultipliers` — but that is the legacy multiplier path; this soft-weight
path has no per-villain channel at all. Default monotone (fast-play dominates) and restore
the rise only on evidence for that villain. Whether that is buildable depends on whether the
slowplay archetype is separable from noise at realistic per-player sample — which requires
`P(check | strong)`, NOT `P(strong | showdown)`; a nit produces the latter without ever
slowplaying, and showdown selection inflates the former for everyone.

### 11.8 The Slowplayer Is Not Separable — But the Check-Back Is (WS-303, measured)

Before building a per-villain trap channel, we asked whether the archetype exists. 347,580
hands, FTP + PS, 700 player-site rows, 14,595 flop decisions, 2,942 with a revealed holding.
Per-player rates shrunk Beta-Binomial with leave-one-out population priors, pseudocount 10.

**Two independent analyses, same answer: no.**

1. **Overdispersion.** Under one common rate, Pearson χ² over players has E[χ²] = df. Excess
   variance is the only non-circular evidence that distinct player types exist.

   | axis | χ²/df | verdict |
   |---|---|---|
   | P(check \| strong) | **1.005** (z = +0.06) | indistinguishable from one population |
   | P(bet \| air) | 1.129 (z = +1.42) | not significant |
   | P(bet \| marginal) | 1.136 (z = +1.74) | not significant |
   | flop bet frequency — **control** | **1.859** (z = +15.5) | **large real heterogeneity** |

   The control is what makes this credible: the method detects player differences easily —
   between-player SD is ≈ 9pp on bet frequency against roughly ≈ 2pp on the slowplay
   conditional. **Players differ enormously in how often they bet and not detectably in
   whether they slowplay strong hands specifically.**

2. **Cross-axis correlation.** If "slowplays strong hands" and "never bluffs" were one trait,
   they would co-vary. Across players with evidence on both axes the correlation is **0.036**.
   Margin sweep for clearing population on both axes at once: margin 0.10 → **0 players**;
   0.05 → 2 of 700. Single-axis counts are far larger (54 and 33). The *joint* requirement is
   what evaporates — exactly what a zero correlation predicts.

Selecting the tail and reporting its mean looks convincing (37.7% vs 17.8%) and is circular.
The tail is sampling noise. The closest empirical matches also contradict the other half of
the description — they show up with **fewer** nuts and **more** air, i.e. calling down light
rather than trapping monsters.

**Do not build a per-villain trap channel *on this evidence*.** At the observation density
available it would fit noise. This is a claim about ONE axis at ONE sample size — it is not a
claim that player types do not exist, and must not be quoted as one. **The control axis in
the table above is the refutation of that broader reading**: aggression frequency separates
decisively. The method finds real archetypes easily when the axis carries enough
observations. Build archetypes there.

**What actually predicts whether an axis separates: observations per player, not whether the
trait is real.** Aggression frequency is observed on every flop a player sees. `P(check |
strong)` requires a showdown that reveals a strong hand — **median 2 spots per player**,
against the ~30 a shrunk estimate needs before it can move off population. An axis with 2
observations per player will return χ²/df ≈ 1 whether or not the underlying type exists. So
this is a **weak-power null, not proof of absence**, and the ordering of the table is at
least as much a ranking of *measurability* as of reality.

**The cross-axis correlation cannot carry the weight put on it.** At ~2 observations per
player the measured per-player slowplay rate is nearly pure noise, and noise correlates ≈ 0
with everything — **attenuation predicts 0.036 whether the trait is real or not**. The
correlation is consistent with the null; it is not evidence for it.

**Showdown selection, and it runs one way.** Players who bet and take it down never reveal,
so the corpus over-represents passive lines and inflates `P(check | strong)` **for everyone**
— a population-wide artifact, not an individual's tell.

**This instrument is blind to STATE, and much of what a live player sees is state.** A corpus
study measures a *stable rate averaged over months*. A player who is drunk, on tilt, or who
has just been bluffed twice by hero and is now looking you up, is a **state that switches
within a session** — averaging him across a corpus deletes exactly that signal, and would do
so even if the effect were enormous. Live observation of such players is therefore **not in
conflict with this table**; it is outside what the table can see. Detecting state needs a
different instrument: within-session, change-point-shaped, keyed on recent history at this
table — not a per-player rate mined from a corpus. Do not cite §11.8 against it.

**Independent corroboration, from a source that is not the corpus.** The RT-108 drift CI
snapshots `narrowByBoard` output for every authored drill node. WS-303 moved **15 of 15
check nodes and 0 of 8 bet nodes** — confirming `ACTION_TAU_FRACTION` is the only cause and
that bet/call are bit-identical — and flipped **5 nodes from `isCapped: false` to `true`**.
Those drill lessons were written from poker reasoning, months earlier, with no sight of the
HandHQ mining; one of them states outright that after villain checks, *"villain's range is
capped and weak"*. The engine had been computing the opposite, because the trap bump kept nut
weight in the checking range. So the corpus measurement and the hand-authored teaching text
converge on the same claim from independent directions. Note the drift test is doing its job
here, not complaining: an authored lesson that contradicts the engine is a real defect, and
this one resolved in the lesson's favour.

**And "does the type exist" is the wrong question anyway — ask what it ADDS.** Overdispersion
tests whether a type is distinguishable *in isolation*. What actually matters is whether
conditioning on it predicts better **given the axes that already work**: a type that is
largely a blend of aggression frequency and board texture may be perfectly real and still add
nothing. That is an **incremental-value** test — score with and without the archetype, on the
SAME decisions, difference per decision (§11.5) — and it is the test to run before building
any archetype channel, including this one. A positive answer justifies the channel even where
the overdispersion test was underpowered.

### 11.9 Diagnostic, not a result — A Fifteen-Number Rule Recovers ~56% of the Engine (Delta-log against revealed hole cards — not an EV claim; see SCORED-READOUT-SPEC §8.2) (WS-303, measured)

**Currency and population, before any number in this section (WS-437).** Every figure here is
measured in Δlog vs uniform against revealed hole cards — a *narrowing-information*
**diagnostic, not a result** (SCORED-READOUT-SPEC §8.2 / Amendment 1). It prices nothing; no
EV or bb/100 claim may be anchored on it. Population: online 6–9-handed cash, 2009 (HandHQ
FTP + PS) — per HC-011 (`system/constraints.md`), for the founder's live 9-handed 1/2–1/3
game every figure here is **transferred, not measured** (fault-register top entry,
`FAULT-population-mismatch`). The source artifacts are version-controlled at
`docs/standard-of-record/data/teachable-arms-ftp.json` / `teachable-arms-ps.json`; the share
transform is computed by `shareOfEngineEdge` (`scripts/backtest/teachableArmsProbe.mjs`), the
published percentages are asserted against those committed artifacts in
`scripts/__tests__/teachableArms.test.js`, and a persisted `run-teachable-arms.mjs` run emits
an ADR-009 Result Card (`teachableArmsResultCard`) stamped with the fault-register version.

Founder doctrine: the **teachable** model may differ from the **engine** model, provided it is
run against the population corpus and scored on the same metric on the same decisions. A
teaching rule that cannot be scored is prose. So candidate rules were scored as arms.

**Leakage control (load-bearing).** A3/A4 have parameters estimated from this corpus, so
scoring them on the decisions they were fit to would make them win by construction. Players
are split POOL/EVAL by FNV-1a hash, independently per site; likelihood tables are mined
**only** from POOL; every arm is scored **only** on EVAL, and all five arms must produce a
valid score before any decision counts — so every arm's mean is over one identical decision
set. PS 3,762 mined / 3,703 scored; FTP 5,732 / 5,403.

| arm | numbers to memorise | FTP | PS |
|---|---|---|---|
| A0 no narrowing | 0 | — | — |
| A2 legacy 20-number bucket table | 20 | 46.4% | 40.2% |
| A3 measured likelihood ratios | 12 | 54.9% | 53.3% |
| **A4 = A3 + check-back/check-OOP split** | **15** | **57.3%** | **55.7%** |
| A1 engine as shipped | — | 100% | 100% |

(share of the engine's edge over not narrowing, in Δlog vs uniform — computed by
`shareOfEngineEdge`, asserted against the committed artifacts). Ordering replicates on both
sites. **A rule a human can hold in their head recovers just over half the engine's narrowing
edge on players it was never fitted to** (Delta-log against revealed hole cards — not an EV
claim; see SCORED-READOUT-SPEC §8.2). The remaining ~44% is per-combo enumeration, texture and
equity quantiles — implementation, not teachable content.

**The table (ratio to base rate). Only quote cells that replicate:**

| action | FTP strong / med / weak | PS strong / med / weak | replicates? |
|---|---|---|---|
| bet | 1.24 / 0.85 / 0.69 | 1.26 / 0.82 / 0.68 | **near-identical** |
| check-back | **0.61** / 1.26 / 1.48 | **0.60** / 1.36 / 1.23 | strong cell rock-solid; med/weak ordering INVERTS |
| check-OOP | **0.79** / 1.07 / 1.44 | **0.76** / 1.07 / 1.55 | rock-solid |
| call | 1.18 / 0.96 / 0.56 | 1.13 / 1.04 / 0.53 | weak cell solid |
| raise | 1.48 / 0.73 / 0.30 | 1.76 / 0.46 / 0.15 | direction only — magnitude differs, weak cell n=18/6 |

What survives replication: **a bet barely moves the read** (1.25 / 0.83 / 0.68 across 1,400+
observations); **a call mostly rules out air**; **a check-back roughly halves strong hands
(0.60) while an OOP check barely dents them (0.78)**; a raise is the strongest signal but
teach its direction, not its digit.

**A LARGE CONDITIONAL EFFECT CAN PRODUCE A SMALL AGGREGATE GAIN.** §11.8's headline —
P(check|strong) 10.3% IP vs 34.3% OOP — is a 3.3× difference, yet adding the split (A4 vs A3)
buys only **2–3 points**. No contradiction: the 10.3/34.3 figure conditions on *strong hands*,
which are a minority of the class mix, while Δlog averages over everything. Do not read a big
conditional as a big edge without computing the aggregate. This is a general caution and it
applies to every "huge tell" claim in poker.

**NOT COMPARABLE TO §11.7 / §11.8.** This probe models each player's OWN decision (symmetric
"acting seat" across all corpus players). §11.7/§11.8 used an asymmetric hero-vs-villain
construction that, by design, could never observe a street-CLOSING check — a check-back leaves
no subsequent decision to hang the observation on, which is why an earlier run reported
check-back n=0 across every class. Same `narrowByBoard`, same defaults, **different decision
population**. Do not mix the two tables' numbers.

**Limitations:** single-street likelihoods only — §11.7 shows chaining the same likelihood
destroys information, so nothing here licenses multiplying these across streets; thin cells as
marked; showdown selection inflates P(check|strong) population-wide.

---

**The finding that IS large, and needs no new data.**

| | P(check \| strong made hand) | n |
|---|---|---|
| **IP — check-back (closes the action)** | **10.3%** | 428 |
| **OOP — check first to act** | **34.3%** | 565 |

A check-back caps hard: barely one in ten comes from a strong made hand. An OOP check is three
times weaker evidence — it can be a check-raise setup or a plan to lead later. `narrowByBoard`
takes only an action string and **pools these into one `'check'`**, so its likelihood is a
compromise between 10% and 34%. Splitting on position is almost certainly worth more than any
tuning of `ACTION_TAU_FRACTION.check`, and costs only threading position into the narrower.
Also note `P(strong | showdown) = 33.8%` exceeds `P(check | strong) = 24.0%`: most strong hands
at showdown were **bet**, not checked — fast-play is dominant, as §11.7 assumed.

**Chaining — the answer was an off-by-one, not a tempering constant.** Successive
re-narrowings degrade badly: depth 1/2/3 = +.524/+.404/+.179 (FTP), +.472/+.314/+.051 (PS).
Softening each successive application (tau × κ^(k−1)) repairs it almost completely — at
κ=5, +.524/+.508/+.500 and +.472/+.446/+.435. **That tempering was deliberately NOT shipped.**
The probe's chain re-applies the *identical* likelihood to the *identical* board, which is
pure double-counting, and `gameTreeDepth2` contained exactly one instance of that: down the
flop→turn→river line villain takes **two** actions (calls the flop bet, calls the turn bet)
and the code applied **three** narrowings, the extra one firing when the turn card was
dealt. Dealing a card is not an action. Removing it is the correct fix; tempering would have
been a constant tuned to hide a miscount, and would also have damped the *legitimate*
distinct-street evidence that remains. Depth-2 already had this right — it narrows once and
carries the range across runouts unchanged. **The invariant: one narrowing per villain
action, never one per street transition.** A test counts them.

**Honest caveat on the ticket's own numbers.** WS-303 reported the check branch at −0.082
(FTP) / −0.095 (PS) and coverage at 84–86%. Neither reproduced: coverage is 100% everywhere
post-§11.6 (the floor guarantees it) and check measures positive against a uniform grid. The
*qualitative* claim — narrowing a check is harmful — reproduced on both sites at 5× sample.
The figures did not. Re-measure before quoting any of the older numbers.

---

## 12. Hero's Range, and What Villain Thinks It Is (WS-276)

### 12.1 Two different equity questions wore one number

The engine answers "what is the best action with THIS hand, HERE." It never constructed
hero's range at a node — and, sharper, it priced **every villain fold/call decision from
`1 - combo.heroEquity`**: that villain combo's equity against hero's *exact two cards*.

Villains were modelled as if they could see hero's hand.

Two distinct quantities had collapsed into one:

| Quantity | Means | Correct consumer |
|---|---|---|
| `heroEquity` | hero's actual cards vs this villain combo | **hero's own EV** — hero knows their cards |
| `villainEquityVsPerceived` | this villain combo vs hero's *perceived range* | **villain's decision** — villain does not |

A villain's decision derives from their equity against their **perception** of hero's
range (§7.1 — every decision derives from game state, and what villain can observe *is*
their game state). Hero's actual holding is not available to them and must not enter.

### 12.2 The defect's true shape: it made every opponent play perfectly

The anecdote that motivated this (a villain folding a made straight) understates it.
Measured on a river board, villain equity computed against hero's known cards is
**degenerate — exactly 0, 0.5, or 1**. There is no uncertainty left on the river once the
opponent's cards are fixed. So the model handed every villain flawless knowledge of
whether they were beaten:

| Villain holding | Omniscient | Vs perceived range |
|---|---|---|
| AT — top pair, does not know it is beaten | 0.000 | 0.393 |
| A9 — two pair, does not know it is good | 1.000 | 0.583 |
| T8 — straight | 1.000 | 0.923 |

The error runs in **both directions**: villains folded too readily with losing hands and
called too readily with winning ones. Any weakness inferred from those predictions
inherited the bias.

### 12.3 Constructing the perceived range

One builder (`exploitEngine/heroRangeBuilder.js`), seeded from the population prior for
hero's preflop line (§2.5 vocabulary) and narrowed street by street through hero's visible
actions with the **same `narrowByBoard`** villain ranges use. Reusing it is what makes
§3.6.1's never-zero guarantee apply to hero's range for free.

**Evidence is a shrunk frequency, never a label.** A villain's read on hero enters as an
observed continuation rate with a count, shrunk toward the population rate by
`n / (n + PRIOR_WEIGHT)` — §6.5's update rule, unchanged. There is deliberately no branch
anywhere in the module that reads a style, image or archetype string. "Hero is a nit" is a
*derived output* of the observation history, never an input to it (§7.1, §7.2).

**Per-villain, because observation is.** A player who sat down twenty minutes ago has seen
almost nothing; crediting them with a session of reads is wrong in the direction that
matters.

**Zero history is the load-bearing case, not a degraded one.** With no observations the
perceived range is the population baseline for hero's line — and a typical BTN 3-bet
followed by three barrels contains the Broadway combos regardless of what anyone has
watched. That baseline alone is what gives a river shove fold equity where the omniscient
model gave it exactly none.

### 12.4 Bluff:value construction from sizing

Once hero has a range, the question a player actually asks becomes answerable: *at this
sizing, how many bluffs does my value count support?* For a bet of `s` times pot, villain
is indifferent when hero's betting range is

```
bluff share  = s / (1 + 2s)          bluff combos = value combos x s / (1 + s)
```

so half pot supports 3:1 value:bluff, pot 2:1, and a 2x overbet 1.5:1. Bigger bets support
*more* bluffs, because villain is priced into a tighter calling range.

**This is a baseline, not a prescription** — the same discipline as WS-310's Layer A. The
deliverable is the **deviation**: against a villain who over-folds hero carries more bluffs
than balance permits, against a station fewer. Balance is a cost against opponents who do
not observe (§5.4). The balanced figure must never be rendered without the deviated one
beside it.

### 12.5 The recursion boundary — level 2, deliberately

Hero models villain modelling hero. **We stop there.** There is no "villain models hero
modelling villain" and no fixed point.

Why: against the live-pool opponents this app targets, level-3 reasoning is not present in
the opponent, so modelling it adds cost and error for no signal.

What would justify going deeper: evidence from the prediction ledger that a recurring
opponent's responses are better explained by them adjusting to hero's adjustments than by
their base tendencies.

### 12.6 Scope boundary — current node only, in v1

The perceived range corrects villain decisions **at the decision node**. The depth-2/3
refinement evaluates villain decisions on hypothetical future boards and still drives them
from equity against hero's actual cards.

This is knowingly left in place, not overlooked. A perceived range at a future node
requires hero's *strategy* at that node — what hero would do with each hand on a card not
yet dealt — which is a strictly larger object, and building it per sampled runout inside
the depth-2 loop is the multiplication WS-301's breached timing budget cannot absorb.

Consequence, stated plainly: **flop and turn decisions retain a residual bias** toward
villain knowing hero's hand on future streets. **River decisions — no future street — are
fully corrected.** Measured cost of the correction: flop 1.67x, turn 1.94x, river 1.03x on
the per-combo distribution.

**"River decisions are fully corrected" was FALSE for eleven weeks, and the boundary is why
(WS-378).** The claim was true of the depth-1 path and of `foldEquityCalculator`, which was
the only call site of `villainDecisionEquity` in the engine. It was not true of
`riverPerCombo` — the refinement stage that actually fires on the river, because
`needsDepth2: street !== 'river'` means depth-2 never runs there. `computeRiverCheckEV` and
`computeRiverBetEV` re-derived villain's decision from `1 - heroEquity` and were read as
covered by *this* boundary, which they never were: **the river IS the current decision
node.** The boundary covers hypothetical FUTURE streets reached from a flop or turn
decision — `computePerComboEV` / `computePerComboCheckEV` — and nothing else.

Measured cost of the gap before it was closed (`RC-river-flip-replicate-1c560bcc-f3320904`,
45 corpus river decisions, 8 seeds each): the top action flipped in **all 8 seeds on 32 of
45**, and **34 of 34 directions ran toward passivity** (bet→check 27, raise→fold 6,
raise→call 1). Both terms of the defect push the same way, which is why the pull was
one-directional rather than noisy: villain folded every worse hand to hero's bet, and hero's
check line collected bets it always won. Both estimators now resolve villain's decision
through `villainDecisionEquity` against the range hero represents by taking THIS action.

The general lesson is about the boundary's PHRASING, not its substance. "Current node vs
future street" is a correct distinction that was read as "depth-1 vs depth-2", and those are
not the same partition on a street where depth-2 does not run.

### 12.7 What this does NOT license

The motivating hand's shove was **read-dependent and not balanced-correct**. Against an
opponent calling correctly it is a losing shove. The model now represents the mechanism —
hero's range contains straight-beating hands where it previously contained none — but at
~92% equity the villain is still calling on any sane pot odds, and the engine should keep
saying so. Do not tune the perceived range until it agrees that folding a straight was
right; that would be fitting one anecdote and discarding §5.2.

---

## 13. Bluff Candidate Selection, and the Price of a Bluff (WS-307)

§6.1–6.3 give the fold-equity formula, MDF and the auto-profit threshold — everything
about *whether a bluff at this price shows a profit*. None of it says **which hand to
bluff with**. That gap produced a real defect, so it is closed here.

### 13.1 Suitability falls as showdown value rises

A bluff's cost is the showdown equity it throws away. So the ranking of bluff candidates
runs opposite to hand strength:

| Hero's hand | Showdown value | Bluff suitability |
|---|---|---|
| Air with no draw | none | **premium** — nothing is surrendered |
| A made hand that beats **nothing** in villain's range | none | **premium** |
| A weak draw | some (its outs) | good — but it can win by hitting |
| A marginal made hand that beats *part* of the range | real | **poor** — bluffing folds out the hands it beats |
| A strong made hand | high | not a bluff; bet it for value (§4.1) |

The row that surprises people is the second. **A made hand with zero showdown value is a
BETTER bluff than a draw**, because the draw still has equity to realise and the made hand
has none. Bottom pair on a board where every hand in villain's range beats it is not "a
made hand, therefore not a bluff" — it is air wearing a pair, and treating the pair as a
reason not to bluff is exactly backwards.

The corollary that has bitten this codebase: **never gate bluff generation on hero equity.**
A `heroEquity >= X` pre-gate suppresses precisely the zero-showdown-value hands that make
the best bluffs. FIND-029 removed one such gate for this reason; do not reintroduce it in
another costume.

### 13.2 Suitability is hero-side; profitability is villain-range-side. Both must clear.

These are two independent gates and the engine must apply both:

- **Suitability (hero-side)** — does this hand give up little by bluffing? §13.1.
- **Profitability (villain-range-side)** — *can this range fold?* A bluff needs a fold-out
  target. Against a range containing the nuts at high frequency (definitively uncapped,
  §5.5) the fold-out target may not exist at any sizing.

A hand can be a perfect bluff candidate and still be a losing bluff, because the range in
front of it cannot fold. That is not a contradiction; it is the two gates doing their jobs.

Worked, from the defect that motivated this section — hero 3♠3♦ on Q♥J♥T♠ facing 75 into
100, villain holding `AA,KK,QQ,JJ,TT,AKs,AKo,AQs,AQo`:

```
villain hand   combos   hero beats        can it fold to a raise?
AA, KK             12          0          maybe — overpair + backdoors
QQ / JJ / TT        9          0          no — a set
AKs / AKo          16          0          no — BROADWAY, the nuts
AQs / AQo          12          0          rarely — top pair + gutshot
TOTAL              49          0
```

Suitability: perfect — 0 of 49, hero surrenders nothing. Profitability: absent — 25 of 49
(51%) never fold and 33% is the stone nuts, so the fold rate a raise needs cannot be
produced. **The raise is a legitimate candidate at the wrong price.** Any diagnosis that
calls the raise itself wrong will send an implementer to the wrong fix.

### 13.3 A population marginal must not outweigh the conditional in front of you

The defect was never in the decision to consider a raise. It was in the fold estimate,
three ways, and all three are the same error — **a constant standing where game state
belongs** (the FIND-040 family, §7.1):

1. The EV path priced bet/raise branches from `queryActionDistribution`, which is indexed
   on street/texture/position and **never sees range composition**. With no villain model
   it returned `POPULATION_PRIORS[facing]` verbatim, so the answer to "how often does a
   33%-nuts range fold?" was the constant `0.55`.
2. `estimateFoldPct` blended its per-combo enumeration `(seg×1 + 0.45×10)/11`. A
   *structural* computation over every combo has no sample size and can never accumulate,
   so the prior outvoted it 10:1 **forever**. Measured over nine spots, a genuine
   0.220–0.817 signal was compressed to 0.429–0.595 — the range read survived as ~9% of
   the answer, and the engine's fold estimate was very nearly constant everywhere.
3. Villain's required equity used `s/(1+s)` where `s/(1+2s)` belongs — see §13.4.

**The rule.** A prior is for when you cannot compute. When the state in front of you
*determines* the answer, compute it. Shrinkage toward a prior is correct for an observed
frequency, which accumulates evidence and eventually outvotes its prior; it is wrong for a
structural computation, which never can. This is §11.5's "let the posterior self-weight"
applied to a quantity that has no `n`.

**Corollary — a clamp can be a hidden prior** (WS-307 parallel line, recovered via WS-442).
The per-combo estimator inherited `scaledLogistic`'s default bounds on call probability,
`[0.10, 0.80]`, which imposed a **floor of 0.20 on every fold estimate derived from it** —
no range, however strong, could report below 20% folds. A bound that decides the answer is
not a sanity guard; it is the model, and it must be justified and swept like one. That is
how the ceiling was eventually closed: WS-403 replaced it with the pool-measured
`CONTINUE_PROB_CEILING = 0.986` (`villainModelData.js`, read by all four ask-sites). The
floor's asymptote remains unmeasured — no sizing drives villain's required equity near 1 in
the corpus — so it stands as a declared bound, not a measured one.

**Corollary — check what saturation destroys** (same recovered line). Freeing a probability
to approach its bounds can erase a signal computed underneath it. When fold% nears 1, bet
EV collapses to `pot × foldPct` for *every* sizing, so all sizings converge and sizing
advice becomes noise. A fix that makes one number right can flatten another; when moving a
bound, check what the newly-reachable region does to every quantity computed downstream of
the bounded one.

### 13.4 Two formulas that look alike and are not

```
s / (1 + s)      BLUFFER's breakeven fold frequency   (§6.3)
s / (1 + 2 s)    CALLER's required equity — pot odds  (§1.5, §6.2)
```

They differ because **the caller's own call is part of the pot they win**. At a pot-sized
bet the first says 50% and the second says 33%.

Facing a raise, the money villain has *already bet* is in the pot and is not part of what
they must call. With pot `P`, villain's bet `B`, hero raising **to** `R`:

```
villain calls  R - B   to win   P + B + R      ->   required equity = (R - B) / (P + 2R)

P=100, B=75, R=225  ->  150 / 550 = 0.273        (the old constant: 0.500)
```

Using the bluffer's formula for the caller's decision demanded roughly **double** the
equity, which pushed hands that are comfortably priced in — sets on a coordinated board —
into the folding group. That **inflates** hero's fold equity, which is what makes a bad
bluff look good. Correcting it reproduces the combinatorics above: sets and AK fold ~20%,
AA/KK ~66%, AQ ~75%.

Note the direction of the error. An over-tight required-equity number does not make the
engine timid — it makes it *reckless*, because every villain hand it wrongly folds is a
hand hero's bluff gets paid by.

### 13.5 The fold estimate is priced against hero's REPRESENTED range

Villain folding to hero's raise is a villain decision, so §12 governs it: it derives from
villain's equity against the range **hero's action represents**, never against hero's
actual cards.

This matters most in exactly the spot §13.1 describes. When hero bluffs with a
zero-showdown-value hand, every combo in villain's range beats hero's actual cards — so an
`1 - heroEquity` model concludes **nobody folds**, and the better the bluff candidate the
more hopeless the bluff appears. The model inverts the rule.

Measured, holding hero's 3♠3♦ and the board fixed and changing only the villain range:

| villain range | priced vs hero's cards | priced vs represented range |
|---|---|---|
| uncapped, nutted | 0.22 fold — *raise still ranked first* | **0.44 fold — fold ranked first** ✓ |
| capped, weak | 0.32 fold — *raise wrongly killed* | **0.70 fold — raise ranked first** ✓ |

Both directions are load-bearing. **A fix that suppresses both spots has encoded "don't
bluff with made hands", which is §13.1 backwards.** Assert the converse, always.

---

## 14. The Hand Is the Denominator (founder, 2026-07-31)

Every rate in this engine currently divides by something different. `P(check | strong)`
divides by showdowns that revealed strength; VPIP divides by hands dealt in; fold-to-cbet
divides by times a cbet was faced; the hero-EV edge divides by scored decisions. Each is
defensible alone. **Together they are not commensurable, and most of this document's hard
lessons are that incommensurability surfacing in a new costume.**

§11.8's showdown-selection artifact, §11.5's fallback-level selection effect, the WS-303
check-branch sign flip, and the 2026-07-31 hero-EV run where 600 decisions came from three
players are all one problem: **a denominator nobody chose, doing work nobody audited.**

### 14.1 One currency: events per 100 hands

Normalise every quantity to **hands at the table**. A rate becomes a frequency —
*occurrences per 100 hands* — and three things follow immediately.

**Showdown scarcity splits into two estimable factors.** Instead of one contaminated
conditional, `P(strong ∧ showdown)` per hand factors as

```
P(reach showdown)  ×  P(strong | showdown)
```

The selection bias stops being a hidden property of the denominator and becomes an explicit
term. §11.8 had to warn in prose that showdown reveals inflate `P(check | strong)` *for
everyone*; per-hand, that inflation is a number.

**Evidential weight becomes computable rather than assumed.** A showdown observation and a
tendency observation are currently combined with no principled relative weight. Per-hand
their weights are simply their rates, so "how much should a rare showdown move the posterior
against a common tendency" has an arithmetic answer instead of a constant.

**And it is the same object the Five-Surface Atlas needs.** FSA weights divergence by
`P(situation)` to convert it into EV. Per-hand frequency **is** `P(situation)`. Changing the
per-hand frequencies changes the environment — table size, stack depth, pool aggression —
and every downstream number re-derives without touching the divergence function. Two
independent lines of reasoning arriving at the same structure is the reason to trust it.

### 14.2 The decomposition that makes it work

"Hands at the table" is the right *currency* but the wrong *opportunity count* for most
quantities: a BB-defence stat's natural denominator is hands in the BB facing an open, not
all hands. Keep both:

```
events per 100 hands  =  opportunities per 100 hands  ×  rate | opportunity
```

The left side is comparable across every quantity in the engine. The right side keeps each
quantity's own conditioning set intact, satisfying the standing rule that **numbers carry
their conditional**. And the split is structurally identical to FSA's *frequency ×
divergence* — which is why one instrument can serve both.

This also makes a whole class of error visible. A change that improves `rate | opportunity`
while shrinking `opportunities` may be worth nothing; today those move in different units
and nothing forces the comparison.

### 14.3 Two honest limits — do not let this section overclaim

**It gives the right UNIT for variance, not a perfect simulation of it.** Per-hand
normalisation is why bb/100 is the standard unit and it supplies a well-defined resampling
object. But hands within a session are **not independent** — same opponents, same table
dynamic, same tilt state — so bootstrapping over hands understates variance for exactly the
reason bootstrapping over decisions did on 2026-07-31 (600 decisions, 3 players, a CI that
looked excellent because it had three clusters to resample). Cluster over sessions or
players; let hands be the unit *inside* the cluster, never the cluster itself.

**It LOCALISES the unobserved rather than correcting it.** Inferring a true frequency from
observed showdowns requires an assumption about `P(strong | no showdown)`, which is by
construction never seen. That is still a large gain — one explicit, named, estimable unknown
beats a bias smeared invisibly across every conditional — but the resulting number is
*modelled*, not measured, and must be labelled as such wherever it is displayed. A corrected
figure that reads as an observed one is §11.5's fallback-level table all over again.

### 14.4 What this binds

- Any new rate ships with its opportunity count, or it cannot be compared to anything.
- Any figure derived through an unobserved-completion assumption is stamped as modelled.
- Variance claims name their cluster unit. "Bootstrapped" without naming the cluster is not
  a variance claim.
- FSA's frequency weighting (`P(situation)`) and this section's opportunity rate are the
  same quantity and must be computed once, not twice.

---

## 15. All Possible Hands Is the Other Denominator (founder, 2026-07-31)

§14 made *hands at the table* the common denominator for **frequency**. This is its companion
on the other axis: *all possible hands on this board* as the common denominator for
**strength**. Together they give any (situation, holding) two coordinates in units that mean
the same thing everywhere — which is the concrete anchor two standards can be forced to meet
across.

### 15.1 The transform, and the correction that makes it possible

The construction: take every legal two-card combination against a board, score them all,
and locate a holding by its **rank within that universe**. The board is not a filter applied
to a range — it is the thing that *defines* the universe, and a range is a subset embedded
in it.

**The correction, and it is load-bearing: the ordering is BOARD-CONDITIONAL, and no global
monotone embedding across boards exists.** AK beats 22 on an ace-high board and loses to it
on a deuce-high one; equity ordering genuinely inverts. Any construction that assumes one
fixed order over all hands is wrong on its second board.

What survives is the **normalisation**. A percentile — rank within *this* board's universe —
is board-invariant precisely because it is normalised, even though the underlying order is
not. So the map is 1-1 and only-increasing **conditional on a board**, and comparability
across boards comes from the normalisation rather than from the ordering. That distinction
is the whole trick, and it is why the primitive already in the repo
(`pokerCore/handEvaluator.comboStrengthPercentile`) is the right one: it enumerates the full
board-conditioned universe and returns a normalised rank.

### 15.2 Slope, and the width of the neutral zone

Plot EV against percentile and two things stop being metaphors:

```
slope            dEV / d(percentile)
neutral zone     { p : |EV(bet | p) − EV(check | p)| < ε }
```

**Slope** answers "is the ground tilted toward an action here". Steep means the correct play
is sensitive to the exact holding; flat means the whole region plays the same way and the
decision is regional, not per-combo.

**The neutral zone's WIDTH is computed, not asserted** — it is the interval where the two
branches are within ε of each other. "How wide should the showdown-value region be" has
therefore always been a measurable question, answered by the range in front of you rather
than by a rule of thumb.

Deformations of that curve — stretching, sagging, shrivelling, widening — under different
villain ranges are then literal and inspectable, not descriptive language.

Both are compositions of functions this repo already has: `comboStrengthPercentile` for the
x-axis, `computePerComboEV` / `computePerComboCheckEV` for the y-axis. Nothing new is
required to produce the curve; the pieces have simply never been joined.

### 15.3 Two pillars, and do not collapse them

There is a real distinction between:

- **Equilibrium-optimal** — the solver's unexploitable strategy. Pool-independent.
- **Statistically-supported-optimal** — the line that maximises EV against the population
  actually sitting at the table.

They are different curves over the same percentile axis, and **the gap between them IS the
exploitative edge.** Collapsing them erases the exact quantity the Five-Surface Atlas exists
to measure (§FSA: Equilibrium vs the three Fields). "The statistics always win" is true of
the second pillar; it is not a statement about the first.

Note the practical asymmetry the founder identifies: study moves a player up a ladder —
never deviating from a preflop range, then no open-limping, then 3-betting, then c-betting
as a range, then board-selective c-betting — while most of the pool never studies directly
and adapts only where it has been visibly exploited. That predicts a population strung out
along a *measurable* axis rather than clustered at equilibrium, which is a testable claim and
is filed as one. Every rung of that ladder is a HIGH-FREQUENCY observable (limp rate, 3-bet
rate, c-bet rate), which is exactly the property §11.8's slowplay axis lacked and the control
axis had.

#### 15.3.1 The rungs separate; the LADDER barely does (WS-320, measured)

`RC-study-ladder-c0043f8b`, engine `cb08203`, Deal Book `handhq-allsites-allstakes-c0043f8b`
(sha256:c0043f8b…), register `FR-1+a6bbfb7d1491`. Artifacts: `.artifacts/study-ladder.card.json`
and `.artifacts/study-ladder.json`; instrument in `scripts/backtest/separability.mjs`, axes in
`ladderAxes.mjs`, runner `run-study-ladder.mjs`.

**What it ran on.** 1,756 `.phhs` files — FTP + PS, 50NL, July 2009 (SRC-012) — 1,070,493
converted hands, 59,848 player-site rows. This is the WHOLE locally materialised corpus, and it
is ~3x the hand count §11.8 used. Scored on the EVAL half of a 50/50 FNV-1a player partition
against a common rate mined from the POOL half, so no player contributed to the rate they were
tested against. Shrinkage is Beta-Binomial, leave-one-out, pseudocount 10 — §11.8's method
unchanged. Primary floor: ≥20 observations per player.

| axis | k/n | rate | obs/player (median) | χ²/df | z | SD between players | split-half reliability | verdict |
|---|---|---|---|---|---|---|---|---|
| limp rate | 281,655 / 2,242,995 | 12.6% | 51 | **26.461** | +2239.7 | **14.5pp** | 0.83 | separates |
| 3-bet rate | 46,410 / 1,158,562 | 4.0% | 43.5 | **2.118** | +81.2 | **2.1pp** | 0.33 | separates (thinly) |
| c-bet rate | 100,303 / 149,477 | 67.1% | 35 | **4.540** | +100.3 | **12.6pp** | 0.62 | separates |
| flop bet frequency — **control** | 206,852 / 569,000 | 36.4% | 37 | **4.314** | +201.2 | 11.6pp | 0.60 | separates |
| flop bet freq, non-aggressor — disjoint control | 106,549 / 419,523 | 25.4% | 34 | 4.578 | +192.3 | 11.9pp | 0.62 | separates |

**The founder's prediction was right about power.** All three rungs clear the bar the slowplay
axis could not, and for the stated reason: median observations per player are 35–51 here against
§11.8's **median 2**. The hypothesis that high-frequency observables would have the power the
showdown-gated conditional lacked is confirmed.

**χ²/df IS NOT COMPARABLE ACROSS RUNS AND MUST NOT BE QUOTED AS IF IT WERE.** It scales with
observations per player, so the control reading 4.314 here against 1.859 in §11.8 is more data,
not a different pool. The comparable quantity is the **between-player SD**: §11.8 measured ≈9pp
on this control, this run measures 11.6pp. Those agree. Every verdict above is read against the
control **from this same run**, per the standing rule.

**Limp rate is the strongest behavioural axis this repo has measured.** SD 14.5pp against the
control's 11.6pp, reliability 0.83 — it re-measures on the same player across time better than
aggression frequency does. **3-bet rate is the weakest**: statistically overdispersed (z = +81)
but only **2.1pp** of between-player spread — the same magnitude §11.8 assigned to the
*non-separating* slowplay conditional — and reliability 0.33. Significance is not size; at a
million hands a 2pp trait is detectable and still nearly useless to condition on.

**Cross-axis: c-betting is NOT just aggression re-expressed.** Against the overlapping control
r = 0.674, but that pair is a subset relation and guaranteed by construction. Against the
**disjoint** control (flop bets where the actor was not the preflop raiser) r = 0.180 — so
c-bet frequency carries something general aggression does not. This is the check that decides
whether an axis adds anything, and it is why the disjoint control exists.

**But the rungs do not co-vary enough to be one trait.** All three pairwise signs point the way
the ladder predicts, and all three magnitudes are small: limp×3-bet r = −0.093 (ρ = −0.182,
disattenuated −0.177, n = 10,487); limp×c-bet r = −0.138 (−0.193 disattenuated, n = 1,607);
3-bet×c-bet r = +0.187 (+0.413 disattenuated, n = 1,607). Disattenuation uses each axis's own
Spearman-Brown-corrected split-half reliability, so §11.8's attenuation objection is answered in
numbers rather than conceded in prose.

**Ordering: 82.5% of players are Guttman-nested — and 77.8% would be anyway.** Over the 1,607
players measurable on all three rungs, 1,325 show a nested pattern. The tempting reading is
"82.5% against a 50% chance baseline". **That reading is wrong and the artifact is instructive.**
Each rung's acquired/not split is at its own population median, but the three-rung intersection
is SELECTED — a player with enough c-bet spots to measure is a player who raises preflop, and
those players limp far less than the median. Marginals in the intersection are 90.5% / 68.6% /
50.0%, not 50/50. Independent habits with *those* marginals already nest 77.8% of the time. The
excess actually attributable to ordering is **+4.7 points**, not +32.

**So: a ladder of rungs, not a ladder of players.** Each rung is real, measurable, and (except
3-bet) carries usable between-player spread. The claim that they are *stages of one underlying
trait acquired in order* is only weakly supported — |ρ| ≤ 0.19 raw, ≤ 0.41 disattenuated, and
+4.7 points of nesting. **The 101 pattern — low limp, low 3-bet, high c-bet — is the largest
violation class at 172 players**, which is a coherent real player (the passive-preflop /
aggressive-flop reg), not noise. Per the standing distinction §11.8 drew: this is closer to
"independent habits, which is a different and still useful finding" than to a ladder. That
changes what may be built — a **per-axis segmentation** is earned; a **single latent
study-level score** is not.

**Nothing here licenses deleting anything.** A weak ladder is a fact about the ladder.

**LIVE IS UNMET, NOT ANSWERED.** The accept criterion asked for the live pool (SRC-014)
separately. No live sample was reachable: SRC-014 lives in the app's IndexedDB, not on disk, so
a node harness cannot see it. Every figure above is **online 2009 50NL — transferred, not
measured**, against a live 9-handed 1/2–1/3 game. This is the top-ranked suspected-fault entry
and it bites hardest exactly where the headline is strongest: **open-limping is far more common
live than online**, so the limp axis is the one whose transfer is least safe. Re-running this
instrument on live hands is the falsifier.

### 15.4 What this binds

- A strength claim states its universe. "Top 10%" is meaningless without the board that
  defines the denominator.
- Percentile, not raw strength or hand identity, is the cross-board coordinate. Any code
  comparing holdings across boards must go through the normalised form.
- Region claims cite a measured width. "It has showdown value" is a claim about an interval
  and should carry one.
- Equilibrium and statistically-supported curves are reported separately, never averaged.

---

## 16. The Equity Operator Is Antisymmetric, and Its Cycles Are Measurable (WS-337)

Heads-up all-in equity is not a table of numbers. It is an **operator** `M` on the 169-class
grid, `M[i][j]` = equity of class `i` against class `j`, and it satisfies

```
E(a, b) + E(b, a) = 1        exactly, by the definition of a showdown
```

so `S = M - 1/2` is **exactly skew-symmetric**. This is a property of the deck, not of this
repo's engine: a different engine, or a corrected one, produces the same operator. The founder's
standing caveat that the engine is not accuracy-validated therefore does not reach anything in
this section.

Measured 2026-08-05 on two independently seeded 20,000-board builds:
`max |M[i][j] + M[j][i] - 1| = 0` — **bit-exact, both seeds**, not merely small. Reproduce with
`scripts/research/build-equity-matrix.mjs` then `scripts/research/spectrum.py`. Code:
`src/utils/pokerCore/equityOperator.js` (construction plus the arithmetic that is exact) and
`equitySkew.js` (the shipped decomposition).

### 16.1 What antisymmetry forces — three theorems, not three choices

1. **`S` has no real eigen-axes.** There is no "principal hand class" of this operator, and
   eigenvectors of `S` are not principal components. Reporting them as such is a category error.
2. **`S` decomposes canonically into 2-D rotation planes** (Youla / real Schur form), each with a
   magnitude `sigma_k`. A rotation in range space *is* a cycle. Each plane is one
   rock-paper-scissors structure with a size attached. **That is the intransitivity of preflop
   poker, in a basis, with a number on it.**
3. **169 is odd**, so at least one dimension has no partner: **at most 84 planes**, ever.

**DO NOT SYMMETRISE.** `(S + S^T)/2` is identically zero — symmetrising this operator to make a
familiar tool apply destroys 100% of its content, not some of it. (Forming `S^T S = -S^2` is a
*different* operation and is correct: that is the Gram operator, and its eigenspaces **are**
`S`'s invariant planes. The distinction is easy to lose and expensive to lose.)

**DO NOT RANK HANDS BY A PLANE AXIS.** Inside a rotation plane the basis is arbitrary — if
`(u, v)` spans it, so does any rotation of them. The invariants are the plane's magnitude and
each class's **radius** in it, `sqrt(u^2 + v^2)`. A table of "plane 3, axis A, top loadings" is a
table of a basis choice, not of the operator.

### 16.2 The transitive / intransitive split — a projection, with no fitted parameter

A game is transitive exactly when `S_ij = f_i - f_j` for some potential `f` — a pure strength
ladder. Those matrices form a **linear subspace**, so the transitive part of `S` is the orthogonal
**projection** onto it, and the split obeys Pythagoras. Solving the least squares in the
combo-frequency inner product gives, with no free parameter:

```
f = S w  =  (equity against a random hand) - 1/2
```

The strength ladder is therefore not a model somebody chose and fitted; it *is* the projection,
and its potential happens to be exactly average equity.

| Inner product | Transitive (ladder) | Intransitive residual |
|---|---|---|
| Combo-frequency weighted | **74.01%** | **25.99%** |
| Unweighted (169 classes equal) | 75.28% | 24.72% |

Pythagoras residual `< 2e-15` in both, which is what makes these a variance decomposition rather
than a fit. **The load-bearing consequence:** a pure strength ladder is already **rank 2**, so
"few planes explain most of `S`" is no news on its own. The part that makes poker a *game*
resists compression far harder than the whole does — **9** planes for 90% of the residual's
energy and **21** for 99%, against **3** and **13** for the full operator.

### 16.3 What a compression claim about this operator must carry — binding

Three numbers, always together. `buildCompressionClaim` in `equityOperator.js` **refuses** to
construct a claim missing any of them; this is enforced in code rather than left to review.

| | Why it alone is not enough |
|---|---|
| **Energy share** | A ratio of squared magnitudes. It flatters every low-rank claim. |
| **Reconstruction error** | The honest half — how wrong the reconstructed equities actually are. |
| **Transitive / intransitive split** | Without it, "low rank" restates "there is a strength ladder". |

Plus, per the Standard of Record: the number of boards, every seed, the basis, and the
**threshold** used to call a plane significant. Measured (2 x 20,000 boards, seeds 20260803 and
987654321, combo-frequency-weighted basis):

| planes | coords/class | cumulative energy | mean err | max err |
|---|---|---|---|---|
| 1 | 2 | 81.5% | 5.64 pp | 38.83 pp |
| 3 | 6 | 92.3% | 3.47 pp | 24.76 pp |
| 6 | 12 | 95.7% | 2.51 pp | 21.76 pp |
| 13 | 26 | 98.8% | 1.07 pp | **16.18 pp** |
| 20 | 40 | 99.4% | 0.61 pp | 9.86 pp |
| 30 | 60 | 99.8% | 0.26 pp | 2.88 pp |

**Read the max column.** "13 coordinates reproduce class-vs-class equity to about 1pp" is true of
the *mean* and false of the worst matchup by a factor of fifteen. Any claim that a
low-dimensional basis is sufficient for range estimation must be made against the max, or scored
directly against the 169-cell grid.

**The significance threshold is measured, not chosen.** Two independent board seeds give
`Sbar = (S_A + S_B)/2` (signal) and `D = (S_A - S_B)/2` — a statistically exact **noise replica**,
since both carry noise of the same variance. `sigma_1(D) = 1.353e-3` is therefore the level below
which a plane cannot be distinguished from board sampling. **28 of the 84 planes clear it**,
carrying 99.93% of the skew energy (99.96% of the skew *norm*). Of the intransitive residual's own
84 planes, **38** clear its noise floor of `4.58e-4`. The familiar "3 / 6 / 13 planes" figures are
*energy-share cuts* and answer a different question; quote which one you mean.

### 16.4 The intransitivity map — where cyclic structure can exist at all

Per class, the RMS cyclic edge it carries against a randomly drawn opponent hand: the part of its
equity that **no** strength ladder can express. Shipped as a 169-cell grid in
`src/utils/pokerCore/data/equitySkewDecomposition.js`, indexed exactly like every range grid, and
read via `intransitivityFor(hand)` / `intransitivityGrid()`.

| | classes | value |
|---|---|---|
| **Most cyclic** | AKo, AKs, KQo, AQo, AA, AQs, KJo, KQs, QJo, AJo, AJs, KTo, KJs, QTo | 9.8 – 11.5 pp |
| **Least cyclic** | T2s, 92s, T3s, 93s, J3s, J2s, T4s, J4s, 82s, J5s, A5s, Q3s | 7.1 – 7.3 pp |

Per-class sampling noise is ~0.12 pp (max 0.18 pp), so all 169 values clear their own noise by
more than 10x. The ordering is real, and cyclic structure does concentrate in the big-ace /
broadway cluster — i.e. in exactly the hands that populate raising ranges.

**But state the spread honestly.** The range is 7.144 – 11.518 pp, a ratio of **1.61**. The least
cyclic hand in the deck still carries 62% of the most cyclic hand's cyclic magnitude. **"The trash
is a pure strength ladder" is not supported by the measurement** — nothing in the 169 grid is
close to purely transitive, and partitioning the grid into "cyclic" and "ladder" regions would
draw a line where the data shows a gentle gradient. What the map licenses is a *ranking*; a 1.6x
spread does not license a threshold rule.

### 16.5 Confirmed cycles, and one locator that does not work

Genuine intransitive triples exist in the raw matrix, not merely in a model of it:
`22 > AKo (53.1%) > JTs (59.3%) > 22 (53.3%)`; also `22 > AQo > QTs > 22` and
`22 > AJo > JTs > 22`.

**A recorded failure, so it is not re-proposed.** The heuristic that classes ~120 degrees apart in
the top *residual* plane form raw-matrix triples finds none, and is invalid **by construction**:
it uses residual angles to predict raw-matrix cycles while the transitive component — 74% of the
structure — is added back in and swamps them. The rotation-plane decomposition is untouched by
this (it is a theorem); the locator is wrong. A valid locator must search the residual operator.

### 16.6 What this binds

- Any comparative claim about compressing this operator goes through `buildCompressionClaim` and
  carries all three numbers plus its threshold, boards and seeds. A claim reporting only energy
  share is refused in code, not in review.
- **This measurement is not a Result Card, and that is deliberate** (ADR-009). A Match is
  `Surface x Deal Book x Field`; this has no surface, no strategy and no opponent population —
  it is a property of the deck. Inventing a `fieldId` for a fieldless measurement is exactly the
  shape-fitting the standard exists to stop. The instant this basis is scored *against* the
  169-cell ladder on corpus data, that **is** a comparative claim about model quality and it
  resolves to a Result Card like everything else.
- Never symmetrise `S`; never rank hands by a single plane axis; never quote a plane count without
  the threshold that produced it. **A near-zero eigenvalue is a decision about a threshold, not a
  fact about poker.**
- The **169-cell grid remains authoritative.** Low-dimensional plane coordinates ship as an
  ADDITIONAL lens (`projectOntoPlanes`) that always returns its measured residual alongside.
  Nothing in the estimation path may treat them as a replacement until the basis has been scored
  against the shipped 169-cell grid on corpus data under the two-level split (POOL/EVAL **and**
  walk-forward, corpus-mined priors structurally excluded from the eval fold). **That test has not
  been run**, so the estimation claim in WS-337 is currently *unknown*, not *favourable*.

---

## 17. A Label Is a Foundation Claim, and It Ships With Its Evidence Tier (WS-445)

Founder directive, 2026-08-08, mid-WS-436: *"we are going to need to look at each place where we
use a label and the foundation of data and make sure its all in order and properly listed
somewhere such that we can rank the estimated impact."*

### 17.1 The label was never the problem — the foundation under it was

§7.1 forbids position labels, bucket labels and style labels as decision inputs, and
`exploitEngine/CLAUDE.md` documents the anti-pattern in four separate forms with worked
examples. **A survey at HEAD on 2026-08-16 found 49 label families anyway, and an AST harvest
found 145 label-shaped constructs across 506 files.** A rule that is only written down is not a
control. That measurement is the entire argument for this section existing as mechanism rather
than as more prose.

WS-436's result is what reframes the problem. Removing the six style labels cost nothing —
ΔLL −0.00076 over 10,147 paired decisions, n.s., and advice-parity at exactly n=0 changed
decisions. But the continuous, full-resolution replacement built to take their place was
**significantly worse** (ΔLL −0.00691, t=−5.64). Discretisation was not the defect. The defect
was that the channel was seeded from the same observations the model's buckets already counted.

**So a label is not primarily a resolution problem. It is a claim about where a number came
from**, and the discipline this section binds is that the claim must be stated and ranked.

### 17.2 Three tiers, and the one that carries no number

Engine-improvement work is spoken of in **absolute EV** — bb/100, NET with GROSS beside it. But
most of the label surface has never been measured, and forcing an EV figure onto an unmeasured
row produces the failure WS-445's own ticket named: *a list of unmeasured guesses wearing EV
units.*

The ladder is therefore **MEASURED** (a Result Card exists), **BOUNDED** (an analytic bound whose
method comes from a closed set, rendered with a `≤`/`≥` glyph so it never reads as an estimate),
and **UNMEASURED** (no EV figure at all, ranked against other unmeasured rows by *reach*).

The guard is a **shape, not a rule**: `buildUnmeasuredReach` mints no EV key, so the field is
`undefined` rather than `null` — there is no slot to fill and nothing for a future relaxation to
unlock.

### 17.3 Two honest limits — do not let this section overclaim

**The enumeration is bounded, not total.** The largest known hole is *threshold-as-label*:
`getSPRZone` manufactures `micro`/`low`/`medium`/`high`/`deep` from `SPR_BAND_EDGES = [2,4,8,13]`
with no string literal at the decision site, so the harvest sees every consumer of `micro` and
none of its manufacture. `exploitEngine/CLAUDE.md` already named threshold-as-label as a fourth
anti-pattern; this section does not close it. Labels assembled at runtime or read from storage
are likewise invisible.

**A ledger row is not a verdict on a table.** `FOLD_CURVE_STREET_MODS` is `measured-refuted` and
still shipping, and that is a *defensible* call — the effect is ~5e-4, an order of magnitude
below the population-curve correction, and tuning on a difference that small would be the
error. What the ledger changes is that the decision was previously discoverable only by reading
one docblock in one file.

### 17.4 What this binds

- Every discrete key standing between game state and a numeric engine parameter is a row in
  `LABEL_LEDGER`. A label-shaped input absent from it fails `check-label-ledger.mjs` at merge —
  the ledger is the closed enumeration of that surface, not a sample of it.
- A row states its **foundation** — founder estimate, mined corpus, fitted curve, or structural
  computation — and that foundation's measurement status. *"It is in the code and the tests are
  green"* is not a foundation.
- An **UNMEASURED** row carries no EV figure and cannot be given one. Unmeasured rows rank
  against each other by **reach**, never against measured rows by number.
- An UNMEASURED row **names the instrument that would measure it**, with a ticket. An entry with
  no instrument is a complaint, not a ledger row — the same bar `falsifier` clears in the fault
  register, and for the same reason: a surface nobody can settle re-emits at rank 1 forever.
- A **BOUNDED** row names its method from a closed set and its direction. `≤ 0.9 bb/100` and
  `0.9 bb/100` are different claims and are never rendered the same way.
- A foundation **measured and NOT SUPPORTED** is a distinct status from one nobody measured, and
  the ledger keeps them apart. Collapsing `measured-refuted` into "unmeasured" erases the
  measurement; collapsing it into "measured" launders it.
- Promotion up the evidence ladder **requires recorded evidence**, and so does resolution — with
  a note stating what the resolution does *not* cover. A row does not become MEASURED because
  someone re-read the docblock, and rows are append-only: a deleted construct moves to
  `resolved` carrying its commit, and never disappears.
- **Reach is counted, not claimed.** A row's read-site count is harvested from source.
- **An empty improvement list is a blind spot, not a finish line.** A ledger with zero unmeasured
  rows, or zero open instrument gaps, FAILS its own self-check. *A ledger with nothing left to
  instrument is not a finished ledger; it is a ledger that stopped asking.*
- Widening the engine widens the ledger. A new directory feeding an engine parameter joins
  `ROOTS` in the change that creates it — a scope hole is to be recorded, never taken as an
  exemption.
