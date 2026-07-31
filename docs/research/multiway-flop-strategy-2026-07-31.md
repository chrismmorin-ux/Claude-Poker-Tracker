# Multiway flop strategy — measured benchmarks for 9-handed live play

Date: 2026-07-31 · Read-only study, no production code changed
Computed with this repo's own engines: `pokerCore/monteCarloEquity.js` (`handVsRangesMW`),
`pokerCore/handEvaluator.js`, `rangeEngine/populationPriors.js`,
`exploitEngine/foldEquityCalculator.js`, `exploitEngine/handhqReferencePool.js` (SRC-011).

> **The question.** In a 6-way flop, when is "hit or fold" actually correct? When does a
> drawing hand *gain* from extra players instead of losing? Is a bet into five players ever
> a bluff? And is limping behind as cheap as it feels?
>
> **The short answer.** All four founder intuitions hold, and the numbers are sharper than
> expected. The multiway break-even is **16.7%**, and almost every flop holding lands either
> far above it or far below it — the middle is nearly empty. That is what makes hit-or-fold
> a real strategy rather than a simplification.

---

## 0. The one number to memorize

**Six-way, your fair share of the pot is 16.7%.** Every benchmark below is stated as a
multiple of that. Five-way it is 20%, four-way 25%, three-way 33%, heads-up 50%.

This is not the *calling* threshold (that comes from pot odds and is usually lower — see §6).
It is the reference line that tells you whether a holding is an asset or a liability.

---

## 1. Method, and what it can't tell you

**Equities** come from `handVsRangesMW`, the repo's multiway Monte Carlo, run to 20,000
trials with a 0.15% convergence band. Each opponent is drawn from an independent range grid;
this is the conditional-independence-given-board assumption already recorded in
POKER_THEORY §6, and card removal between opponents remains unmodelled (WS-281).

**Three field-width assumptions** are reported, because the answer moves with them:

| Field | Composition | Grid widths |
|---|---|---|
| `popLimp` | EP/MP/MP/LP limp priors + BB any-two | 32/32/32/32/100 |
| `anyTwo` | five uniform any-two ranges | 100 × 5 |
| `raised` | EP open + MP/LP/SB/BB cold-call priors | 16/26/35/29/31 |

A real live 6-way limped pot sits between `popLimp` and `anyTwo`. The `raised` field is the
tighter, more punishing case. **Where the two disagree, the doc reports both** — the
qualitative conclusions hold under all three, which is the point of running all three.

**Flop-holding classification** is structural (not a solver label), priority-ordered:

```
MADE_BIG > BIG_DRAW > STRONG_PAIR > WEAK_PAIR > GUTSHOT > AIR
```

`MADE_BIG` = two pair, set, trips, straight, flush, boat+. `BIG_DRAW` = any 4-flush hero
participates in, or 8+ straight outs. `STRONG_PAIR` = top pair or overpair. Priority means a
flush draw that is *also* middle pair is counted as `BIG_DRAW` — deliberately, because
multiway the draw is the part that pays.

The classifier was validated against known combinatorics before use: pocket pair flops a set
or better **12.0%** (canonical 11.8%), a suited hand flops a 4-flush **10.9%** (canonical
10.94%), AK flops a pair or better **31.9%** (canonical 32.4%). Labels on §4's named
scenarios were machine-checked, not asserted.

**What this does not model:** implied odds, reverse implied odds, position, stack depth, rake,
multi-street play, or equity *realization*. Every number here is raw showdown equity if the
hand were checked down. Section 7 says where that matters most.

---

## 2. "Hit or fold" — the bimodality is real

For each hand, all 19,600 flops were enumerated for frequency; equity was then measured on a
sampled subset within each bucket. Six-way, versus the `popLimp` field:

### 76s — the offsuit-connector-style hand the founder described

| Flop bucket | Frequency | 6-way equity | × fair share |
|---|---|---|---|
| MADE_BIG (two pair+) | 5.6% | **58.3%** | 3.5× |
| BIG_DRAW (FD or 8+ outs) | 19.1% | **31.5%** | 1.9× |
| STRONG_PAIR (top pair) | 3.0% | 21.1% | 1.3× |
| WEAK_PAIR | 22.9% | 19.2% | 1.2× |
| GUTSHOT | 11.8% | 16.5% | 0.99× |
| AIR | 37.6% | **5.6%** | 0.34× |

Read the first and last rows together. **24.7% of flops give 76s at least 1.9× its fair
share; 37.6% give it a third of its fair share.** There is essentially no band where the
hand is worth a close decision — the gutshot row sits *exactly* on the break-even line at
0.99×, and everything else is far above or far below.

That is the founder's hypothesis, confirmed: the hand gets "sucked in" because when it
connects it connects hard, and when it misses the fold is trivially easy.

### 76o — the same shape, one notch worse

| Bucket | Frequency | 6-way equity |
|---|---|---|
| MADE_BIG | 4.8% | 55.8% |
| BIG_DRAW | 11.7% | 23.7% |
| AIR | 43.1% | 4.8% |

Offsuit costs **7.5 points of big-draw frequency** (19.1% → 11.7%) and 6 points of equity
when it does draw (31.5% → 23.7%). The bimodal shape survives; the good half just gets
rarer and thinner. **Offsuit connectors are a weaker version of the same strategy, not a
different one** — which is why they are playable at the right price and never at a bad one.

### The comparison that matters: "top pair" is not one thing

| Hand | 6-way equity with top pair | × fair share |
|---|---|---|
| AKo | **52.4%** | 3.1× |
| KQo | 48.0% | 2.9× |
| A9o | 41.8% | 2.5× |
| K7o | 38.9% | 2.3× |
| T9s | 33.8% | 2.0× |
| 76s | **21.1%** | 1.3× |

Same label, a 2.5× spread. **Top pair with a connector is a marginal holding six-way; top
pair with a big ace is a value hand.** Any rule of the form "continue with top pair" is
wrong in both directions at once.

---

## 3. Which hands *keep* their equity as the field grows

This is the core mechanism behind the founder's "the more callers the better" intuition.
Retention = 6-way equity ÷ heads-up equity, on the same board. `raised` field:

| Holding | Heads-up | 6-way | Retention |
|---|---|---|---|
| Top set | 94.6% | 79.4% | **84%** |
| Flopped straight + flush draw | 93.8% | 73.9% | 79% |
| Bottom set | 88.8% | 63.3% | 71% |
| Combo draw (FD + open-ender, 15 outs) | 60.6% | 42.7% | **70%** |
| Second-nut flush draw (bare) | 54.3% | 36.3% | 67% |
| Two pair | 86.5% | 56.6% | 65% |
| **Nut flush draw (bare)** | 56.8% | **36.6%** | **64%** |
| Top pair top kicker | 86.3% | 51.3% | 59% |
| Bare open-ender | 39.2% | 22.4% | 57% |
| Overpair JJ on a low board | 72.1% | 34.5% | 48% |
| Bare gutshot | 28.9% | 13.4% | 46% |
| Top pair weak kicker | 73.4% | 30.6% | **42%** |
| Second pair good kicker | 57.6% | 15.4% | **27%** |
| Air (two overcards) | 31.7% | 10.3% | 32% |
| Air (nothing) | 15.3% | 2.8% | 18% |

**Nutted hands and nut-ish draws retain 64–84%. One-pair hands retain 27–59%.** The gap is
the whole strategy. A draw's equity is a physical count of outs — the field cannot take those
cards away. A one-pair hand's equity is the probability nobody else has connected, and that
probability decays geometrically with every extra player.

### The ordering inverts, and here is where

Nut flush draw versus top pair weak kicker, `raised` field:

| Opponents | 1 | 2 | 3 | **4** | 5 |
|---|---|---|---|---|---|
| Top pair weak kicker | 73.4 | 58.0 | 47.3 | 37.9 | 30.6 |
| Nut flush draw | 56.8 | 45.4 | 41.1 | **38.4** | **36.6** |

**The crossover is at four opponents — a five-way pot.** Heads-up, top pair is worth 16.6
points more than the nut flush draw. Six-way, the nut flush draw is worth 6 points more.

Against second pair the crossover arrives at **two opponents**: three-way, the nut flush draw
(45.4%) has already passed second pair with a good kicker (38.4%), and by six-way it is
36.6% against 15.4% — better than 2:1.

**Benchmark: in a 5-way-or-larger pot, a nut draw outranks any single-pair hand you hold.**
Play them in that order.

---

## 4. Betting the nut draw multiway — why more callers is genuinely better

The founder's claim: with a nut draw on a wet board you *want* callers. This is provable in
one line from POKER_THEORY §6.1.

Assume zero fold equity (the honest multiway assumption — see §5). Betting `b` into pot `P`
with `k` callers:

```
EV(bet)   = e × (P + b(k+1)) − b
EV(check) = e × P
EV(bet) − EV(check) = b × ( e(k+1) − 1 )
```

**Betting beats checking whenever `e > 1/(k+1)` — exactly your fair share of the field.**
Confirmed numerically against `calcFoldEquity`:

| Callers | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Min equity for betting to beat checking | 50.0% | 33.3% | 25.0% | 20.0% | **16.7%** |

The bar *falls* as the field grows, and it falls faster than a nut draw's equity does. A bare
nut flush draw at **36.6% six-way clears the 16.7% bar by more than 2×.** Heads-up the same
draw at 36.6% would be a losing bet. This is the single cleanest statement of the founder's
inverse case, and it is why a wet connected board with a nutted draw is a betting spot rather
than a checking one.

With fold equity added back (each opponent folding at rate `f`, expected callers recovered via
the repo's `expectedCallers` inversion), betting a 60%-pot bet needs:

| Per-player fold rate | 1 opp | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 40% | 0% | 32.3% | 31.5% | 28.0% | 24.5% |
| 55% | 0% | 17.7% | 29.2% | 29.6% | 27.8% |
| 70% | 0% | 0% | 8.7% | 23.1% | 26.9% |

The requirement flattens out in the mid-to-high 20s once the field is 4+ — that is the
practical number. **A draw worth ~28%+ against the field is a bet six-way; below that,
check and take the free card.** A bare open-ender (22.4%) fails this; a nut flush draw
(36.6%) passes comfortably; a 15-out combo draw (42.7%) passes overwhelmingly.

Note the "nut" part is doing less work than intuition suggests: bare nut FD 36.6% versus bare
second-nut FD 36.3% — only 0.3 points of *equity* difference. The nut card's value is almost
entirely in the **later streets** this model does not price: you can stack off on the turn and
river without reverse implied odds. Treat nuttedness as a licence to build the pot, not as an
equity bonus.

---

## 5. Betting into five players — the bluff collapse, measured

The founder's claim: someone betting into five players is probably not bluffing, because a
bluff needs to fold out five separate players and the product is tiny. This is exactly right,
and the size of the effect can be stated precisely.

A bluff needs the pot to fold **through everyone**. That probability compounds:

**Required per-player fold rate to break even** (from §6.3 — the break-even fold-through is
sizing-dependent but field-size-independent; what changes is what each player must contribute):

| Sizing | Need fold-through | 1 opp | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| 1/3 pot | 25.0% | 25.0% | 50.0% | 63.0% | 70.7% | 75.8% |
| 1/2 pot | 33.3% | 33.3% | 57.7% | 69.3% | 76.0% | **80.3%** |
| 2/3 pot | 40.0% | 40.0% | 63.2% | 73.7% | 79.5% | 83.3% |
| Pot | 50.0% | 50.0% | 70.7% | 79.4% | 84.1% | 87.1% |

**A half-pot bluff into five players needs every one of them to fold 80.3% of the time.**

Now the empirical anchor. From the repo's imported HandHQ reference pool (SRC-011, 12.9M
hands), **full-ring** segments:

| Stake | fold-to-c-bet | c-bet rate | decisions |
|---|---|---|---|
| 0.1/0.25 | 55.2% | 60.0% | 574,682 |
| 0.25/0.5 | 57.0% | 60.3% | 121,272 |
| 0.5/1 | 56.6% | 55.8% | 99,111 |
| 1/2 | 55.9% | 59.0% | 124,421 |
| 2/4 | 54.8% | 60.2% | 74,756 |
| 3/6 | 53.5% | 59.6% | 30,795 |
| 5/10 | 53.8% | 59.6% | 32,157 |
| **Pooled** | **55.5%** | **59.5%** | **1,057,194** |

Remarkably flat across a 40× stake range. The repo's founder-estimate live prior is 45%, i.e.
live players fold *less* — which only makes the conclusion stronger.

**At 55.5% per player, the fold-through against five is 0.555⁵ = 5.3%.** A half-pot bluff
needs 33.3%. **It is short by a factor of 6.3.** Even at the wildly optimistic 70% per-player
fold rate, five-way fold-through is 16.8% — still half of what a half-pot bluff requires.

Fold-through by field size, for reference:

| Per-player fold | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 45% | 45.0% | 20.3% | 9.1% | 4.1% | **1.8%** |
| 55% | 55.0% | 30.3% | 16.6% | 9.2% | **5.0%** |
| 65% | 65.0% | 42.3% | 27.5% | 17.9% | 11.6% |
| 75% | 75.0% | 56.3% | 42.2% | 31.6% | 23.7% |
| 85% | 85.0% | 72.2% | 61.4% | 52.2% | 44.4% |

**Two exploits fall out of this table.**

**(a) Believe the bettor.** A player betting into four or five opponents is making a play that
is only profitable with a real hand. This is not a read about the player; it is a constraint
on which bets can be profitable at all. Weight their range to value hard, and drop your
bluff-catching frequency accordingly. Against a bet into five, a marginal one-pair hand is
not a bluff-catcher — §3 already showed second pair is worth 15.4% six-way, and it is worth
less than that against a range that has announced itself.

**(b) Do not be that player.** Hero's own bluff frequency into a multiway field should be
approximately zero. This is the leak the repo already tracks as
`skillAssessment/leakRules/heroMultiwayBluffFrequency.js`; the numbers above are its
justification.

### The counterweight: defence divides, so don't over-fold

MDF divides across the field. Required continuation **per defender**:

| Sizing | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 1/3 pot | 75.0% | 50.0% | 37.0% | 29.3% | 24.2% |
| 1/2 pot | 66.7% | 42.3% | 30.7% | 24.0% | 19.7% |
| 2/3 pot | 60.0% | 36.8% | 26.3% | 20.5% | 16.7% |
| Pot | 50.0% | 29.3% | 20.6% | 15.9% | 12.9% |

Against a half-pot bet five-way you personally need to continue only **19.7%** of your range —
not the 66.7% the heads-up rule demands. Applying heads-up MDF per-player multiway is a large,
common, and expensive error in the opposite direction. The field collectively meets the bar;
you individually contribute a fifth of it.

**Reconciling (a) with this:** the bettor's range is value-heavy *and* you only owe 20%
defence. Both push the same way — fold your weak holdings, and defend with the top fifth of
your range, which multiway means **nutted hands and nut-ish draws**, not one-pair
bluff-catchers.

---

## 6. Pot odds — why "priced in" is usually true

Required equity to call, as the pot grows with each caller ahead of you:

| Sizing | 0 callers ahead | 1 | 2 | 3 |
|---|---|---|---|---|
| 1/3 pot | 19.9% | 16.6% | 14.2% | 12.5% |
| 1/2 pot | 25.0% | 20.0% | 16.7% | 14.3% |
| 3/4 pot | 30.0% | 23.1% | 18.8% | 15.8% |
| Pot | 33.3% | 25.0% | 20.0% | 16.7% |

**Every callers-ahead column drops the bar by 3–7 points.** Facing a half-pot bet with two
callers already in, you need 16.7% — a bare open-ender (22.4%) is priced in, a bare gutshot
(13.4%) is not, and air (2.8–10.3%) is never close.

This is the mathematical content of "our equity is priced in to call": the pot laid by a
multiway field routinely drops the requirement to the 12–17% band, which is exactly where the
draw buckets sit and exactly where the air buckets do not. The `GUTSHOT` row in §2 sitting at
0.99× fair share is the same fact from the other direction — gutshots are the genuine
coin-flip decisions, resolved by price rather than by rule.

---

## 7. Limping behind

The founder's claim: at a passive table you can limp behind at virtually no cost, because
you're unlikely to get raised and you see a cheap flop.

### The price is good and gets better with each limper

Hero invests 1bb into a pot of (m limpers + 1.5 blinds):

| Limpers ahead | Pot before hero | Odds | Required equity | Fair share on flop |
|---|---|---|---|---|
| 1 | 2.5bb | 2.5:1 | 28.6% | 33.3% |
| 2 | 3.5bb | 3.5:1 | 22.2% | 25.0% |
| 3 | 4.5bb | 4.5:1 | 18.2% | 20.0% |
| 4 | 5.5bb | 5.5:1 | 15.4% | 16.7% |
| 5 | 6.5bb | 6.5:1 | 13.3% | 14.3% |

**Required equity is below fair share in every row.** On raw equity alone, any two cards are
priced in to limp behind. That is a real effect and it is why the play feels free.

### But the raise risk is where it actually lives

Computed from the repo's own `NO_RAISE_FREQUENCIES` priors — the product of (1 − open rate)
over every seat still to act:

| Hero seat | Seats behind | P(raised behind), population | P(raised behind), passive table |
|---|---|---|---|
| UTG+2 | 6 | **75.2%** | 47.4% |
| HJ | 4 | 64.9% | 37.9% |
| CO | 3 | 48.3% | 26.1% |
| BTN | 2 | **24.0%** | **12.0%** |

*("Passive table" halves every seat's open rate — the founder's stated read.)*

**This is the finding that qualifies the intuition.** The compounding that kills multiway
bluffs also compounds against limping behind from early and middle position: with six seats
still to act you get raised three times out of four at a normal table, and still nearly half
the time at a passive one. The 1bb you limped is dead every one of those times, and you're
choosing between folding it and playing a bloated pot out of position.

**From the button the intuition is exactly right** — 24% at a normal table, 12% at a passive
one, with position guaranteed for the rest of the hand. From the cutoff it is defensible at
26% on a genuinely passive table. From anywhere earlier it is not a cheap play, it is a
disguised one.

### Benchmark: limp behind when all three hold

1. **Position:** CO or BTN. Two or three seats behind, not four or more.
2. **Read:** the seats behind are demonstrably passive — the founder's premise, and the thing
   that moves 48% to 26%. The app already tracks per-seat open rates; use them rather than
   the table's general feel.
3. **Hand shape:** a hand whose flop distribution is bimodal (§2) — suited connectors, suited
   aces, small pairs, offsuit connectors at the wider end. These are the hands that convert a
   cheap flop into a big pot. **Not** offsuit broadways and weak aces: K7o's air bucket is
   58.9% of flops at 10.6% equity, and its "top pair" bucket is only 38.9% six-way — it makes
   second-best hands, which is the opposite of what a cheap multiway flop is for.

**The important caveat.** The price table above is raw equity, and multiway equity
*realization* is well below 1 for weak hands — that is POKER_THEORY §1.4, and it is exactly
why the "any two cards are priced in" reading is a trap. Hands that cannot fold when they hit
second-best, or cannot get paid when they hit big, do not collect the equity the table
credits them with. The bimodality requirement in (3) is what makes realization high enough
for the price to be real.

---

## 8. Table card

Six-way, fair share is **16.7%**.

| Situation | Benchmark |
|---|---|
| Continue multiway | Need ~2× fair share (33%+). Below 1× (16.7%), fold. |
| Two pair or better | 3.4–4.8× fair share. Always continuing, usually betting. |
| Nut / nut-ish draw | 2.2–2.6× fair share. Bet it — more callers is better. |
| Combo draw (13+ outs) | 4.4× fair share. Play it like a made hand. |
| Top pair, big kicker | 3.1× fair share. Value, but one street at a time. |
| Top pair, weak kicker | 1.8× fair share. Pot control. Not a stack-off. |
| Second pair | 0.9× fair share. Below break-even. Fold to real aggression. |
| Bare open-ender | 1.3× fair share. Call if priced (needs ~15–20%). |
| Bare gutshot | 0.8× fair share. Price-only, and the price is rarely there. |
| Air | 0.2–0.6× fair share. Fold. This is the 40% of flops hit-or-fold is built for. |
| Betting a draw beats checking when | equity > 1/(callers+1); practically **~28%+** four-way or wider |
| Bluffing into 4+ | Needs 76–80% folds each. Population folds 55.5%. **Never.** |
| Facing a bet into 4+ | Range is value-heavy. You owe only ~20% defence. Fold marginal pairs. |
| Limp behind | CO/BTN only. Raise risk: BTN 24% / CO 48% (12% / 26% if passive). |
| Draws overtake one-pair hands at | **5-way** vs top-pair-weak-kicker; **3-way** vs second pair |

---

## 9. Limitations, stated plainly

- **One street, no realization.** All equities are showdown equity if checked down. Implied
  and reverse-implied odds are unmodelled, which *understates* nut draws and *overstates*
  weak one-pair hands. Both biases push the same direction as the conclusions, so the
  qualitative results are conservative — but the specific percentages are not stack-off
  advice.
- **Card removal between opponents is unmodelled** (POKER_THEORY §6, WS-281). Second-order;
  unmeasured as of this writing.
- **Field composition is a prior, not a read.** The `popLimp` field is built from population
  priors, not from any specific table. The app resolves live seats through the §6.5a
  hierarchy; these numbers are the unobserved-seat baseline. A table of five known calling
  stations is a different calculation and the app can do it — this study says what to expect
  before you have the reads.
- **The empirical fold-to-c-bet anchor is online 2009 data** (SRC-011), aggregated across all
  field sizes rather than conditioned on multiway. The repo's live prior (45%) is lower, and
  the true multiway-specific number is likely lower still — every direction of that error
  strengthens §5's conclusion rather than weakening it.
- **§2 equities are sampled**, not enumerated (10 flops per bucket per hand, 4,000 trials).
  Frequencies in the same tables *are* full 19,600-flop enumerations and are exact. Treat the
  bucket equities as ±2–3 points; the §4 named scenarios were run at 20,000 trials and are
  tighter.
