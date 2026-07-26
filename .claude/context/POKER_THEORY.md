---
version: 1.6
last_verified: 2026-07-22
verified_by: cwos-domain-correctness-sweep-2026-07-22
verification_protocol: "/pulse run domain-correctness baseline"
review_cadence_days: 90
next_review: 2026-09-18
governing_program: prog-domain-correctness
governance_yaml: .claude/workstream/programs/prog-domain-correctness.yaml
changelog:
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

### 3.4 Why Players Bet — The Three Motivations
Every bet, by any player in any spot, is motivated by one or more of:

1. **Value**: Get called by hands with worse equity. The bet is +EV because the calling range contains enough worse hands. A value bet is correct when hero's hand has >50% equity **against the opponent's calling range** (not their full range).

2. **Bluff / Fold Equity**: Get better hands to fold. The bet targets the opponent's folding range — hands that currently have more equity than hero's hand but will surrender the pot. A bluff is +EV when the fold rate exceeds the breakeven threshold: `foldPct > betSize / (pot + betSize)`.

3. **Information** (rare, situational): Bet to observe the response and narrow the opponent's range. A "probe bet" or "blocking bet" can reveal whether villain has a strong or weak range based on their reaction. This is the least common motivation and is usually secondary to value or fold equity.

**Critical insight**: The same bet size can serve different motivations for different players. A half-pot bet can be a value bet, a bluff, or a blocker bet. A 2x pot bet can be a polarized bluff, a value bet with a vulnerable hand seeking protection, or an overbet with the nuts maximizing extraction. The motivation is determined by the player's tendencies and their hand, NOT by the size alone.

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
- **Bet**: Removes weak hands (would check). Range is value + bluffs.
- **Check**: Removes some strong hands (would bet for value). Range includes medium hands + traps.
- **Raise**: Removes medium hands (would just call). Range is strong value + bluffs.
- **Call**: Removes air (would fold) and the nuts (would raise). Range is medium + draws.

This narrowing is cumulative across streets. By the river, ranges are very defined.

### 3.7 Polarization by Street
- **Flop**: Ranges are wide, strategies can be mixed
- **Turn**: Ranges narrow, bets become more polarized
- **River**: Ranges maximally narrow, bets are fully polarized (nuts or bluff)

The bet SIZE should generally increase across streets as ranges polarize: small flop bet → medium turn bet → large river bet. But this is a consequence of range evolution across streets, not a rule about what any individual bet size "means."

---

## 4. Value Betting and Bluff Catching

### 4.1 Value Betting Theory
A value bet is +EV when hero's hand has **>50% equity against the opponent's calling range**. This is the critical threshold — not equity against their full range.

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

### 6.1 Fold Equity Formula
```
EV(bet) = foldPct × pot + (1 - foldPct) × (heroEquity × (pot + 2×bet) - bet)
```
This has TWO terms: the fold-equity term AND the call-equity term. Both matter. A value bet is profitable primarily from the call-equity term. A bluff is profitable primarily from the fold-equity term.

### 6.2 Minimum Defense Frequency (MDF)
```
MDF = pot / (pot + bet)
```
Against a half-pot bet: MDF = 66.7% (villain must defend 2/3 of range)
Against a pot-size bet: MDF = 50%
Against a 2x pot bet: MDF = 33%

If villain folds more than (1 - MDF), our bluffs auto-profit. This is the mathematical basis for bluff-frequency exploits. But MDF is a theoretical baseline, not a mandate — exploitative play deliberately deviates from MDF when we know an opponent's bluff-to-value ratio.

### 6.3 Breakeven Bluff Frequency
```
Breakeven = bet / (pot + bet)
```
This tells us the minimum fold rate needed for a bluff to be profitable. Half-pot bluff needs 33% folds. Pot-size bluff needs 50% folds. 2x pot bluff needs 66% folds.

### 6.4 Value Bet Threshold
```
EV(value bet) > 0 when: heroEquity_vs_callingRange > 0.50
```
A value bet is correct when we win more than half the time against the hands that call. The calling range is always stronger than the full range (weak hands fold), so we need more equity than we'd need against their full range.

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

**The hierarchy (pick ONE per adjustment):**
1. **Villain decision model** — personalized from this player's observed actions (highest fidelity)
2. **Observed aggregate stats** — foldToCbet, AF, VPIP from this player's data
3. **Style-conditioned parameters** — Fish/Nit/LAG structural model (logistic steepness, raise thresholds)
4. **Population priors** — what a typical unknown 1/2 player would do

When a higher-fidelity source is present, lower-fidelity redundant adjustments MUST NOT stack on top. The villain model already encodes the Fish's tendency to call too much — applying a Fish steepness modifier on top double-counts it.

**Example of wrong (quadruple-counting):**
- Style fold ratio: Fish folds less (from STYLE_PRIORS)
- AF adjustment: low AF → folds less (AF is why they're classified Fish)
- VPIP adjustment: high VPIP → folds less (VPIP is why they're classified Fish)
- Villain model: observed fold rate is low (from same hands used for classification)
- All four encode: "This player folds less." Applied multiplicatively, a legitimate 30% fold rate becomes 23%.

**Example of correct (single-counting):**
- Villain model present with confidence ≥ 0.3? Use model. Skip style/AF/VPIP adjustments.
- No model but observed foldToCbet with N ≥ 5? Use observed stat. Skip style.
- No observed data? Use style-conditioned logistic. Skip AF/VPIP (they're the inputs to the style).

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
3. **Style-conditioned** — `FOLD_CURVE_PARAMS[style]` (Fish/Nit/LAG/… defaults).
4. **Population default** — `FOLD_CURVE_PARAMS.default`.

Resolved in `foldEquityCalculator.js` `findOptimalBetSize`: `personalizedFoldCurve ||
FOLD_CURVE_PARAMS[style] || FOLD_CURVE_PARAMS.default`. The fold response itself is a
logistic in bet fraction (`logisticFoldResponse`), consistent with §3.5 (small bets barely
move fold%, medium bets steepest, overbets bimodal) — not a linear scaling.

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

Rake reduces the EV of marginal value bets and thin calls; it never affects fold-equity
from villain folding (no showdown, no drop). This is a refinement of the §6.1 fold-equity
formula, not a replacement.
