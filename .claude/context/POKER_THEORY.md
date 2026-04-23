# Poker Theory Reference — Mandatory Reading for Analysis Edits

Read this file before modifying ANY file in `exploitEngine/` or `rangeEngine/`. This is not optional.

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

With small samples, the prior dominates. With large samples, the likelihood dominates. This is why our `bayesianUpdater.js` uses ~5 virtual observations as prior weight.

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
