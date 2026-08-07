# Hand Review — AKs squeeze, 4-way all-in (2026-08-07)

**Game:** 1/3 live, 9-handed, BTN straddle $7.
**Hero:** CO, $750, A♠K♠.
**Harness:** `src/test/aksSqueezeHandEval.test.js` (run heavy parts with `HAND_EVAL=1`).
All numbers below come from the app's own engines — `bestFiveFromSeven` exact
board enumeration (1,086,008 boards, no sampling) and `handVsRangesMW`
(150k-trial Monte Carlo, CI ±0.2%).

## The hand

| Order | Seat | Action | Amount |
|---|---|---|---|
| 1 | BTN | straddle | 7 |
| 2 | SB | fold | — |
| 3 | BB | call | 7 |
| 4–5 | UTG, UTG+1 | fold | — |
| 6 | MP ($45) | raise (all-in) | 45 |
| 7 | LJ | fold | — |
| 8 | HJ ($395) | call | 45 |
| 9 | **Hero (CO)** | **raise** | **200** |
| 10 | BTN ($1000+) | raise (all-in) | — |
| 11 | BB | fold | — |
| 12 | HJ | call (all-in) | 395 |
| 13 | Hero | call (all-in) | 750 |

Showdown: MP 6♥4♥ (straight), HJ 5♣5♦ (set), BTN K♥K♦, hero missed.

## Pot structure

Dead money $8 (SB $1 + BB $7). Three pot layers:

| Pot | Size | Contested by | Actual winner |
|---|---|---|---|
| Main | $188 | all four | MP (straight) |
| Side 1 | $1,050 | HJ, hero, BTN | HJ (set) |
| Side 2 | $710 | hero, BTN | BTN (KK) |
| **Total** | **$1,948** | | |

Note the shape: the money you were really playing for ($1,760 of the $1,948)
was against HJ and BTN only. MP's straight cost you only a share of $188.

## Exact all-in equity (cards face up)

| Matchup | Hero equity |
|---|---|
| AKs vs KK | 34.1% |
| AKs vs 55 | 48.0% |
| AKs vs 64s | 62.3% |

Four-way, per pot layer (exact, all 1,086,008 boards):

| Pot | Hero equity | Hero expected $ |
|---|---|---|
| Main ($188) | 27.2% | $51 |
| Side 1 ($1,050) | 31.1% | $327 |
| Side 2 ($710) | 37.8% | $268 |
| **Total** | | **$646** |

Expected dollars, all players: BTN $1,031 · hero $646 · HJ $242 · MP $29.
MP's 64s was a 15% shot at the main pot that got there; HJ's 55 was a ~23%
shot at side 1.

**Cards face up, the final call was still correct.** At the decision point you
had $200 in and faced $550 more. Even knowing you were up against KK + 55 +
64s, calling returned $646 expected vs $550 — **+$96 per trial**. Folding
would have burned equity. Over the whole hand you expected to lose ~$104
(net of your $750), but that loss was locked in by the card matchup, not by
any decision you controlled at the end.

## Decision-time analysis (what you actually knew)

Modeled ranges: MP $45 jam over the straddle = wide shortstack shove
(22+, A2s+, A8o+, K9s+, broadways, suited connectors — his real 64s is
*wider* than this, which only helps you). HJ flat of $45 = pairs +
broadways. BTN's 5-bet jam range is the swing variable:

| BTN jam range | Hero eq (side 2) | Expected winnings | Call EV ($550 to call) |
|---|---|---|---|
| Ultra-tight: KK+ | 23.1% | $398 | **−$152** |
| Standard: QQ+, AK | 42.0% | $634 | **+$84** |
| Wide: TT+, AQs+, AKo | 45.7% | $712 | **+$162** |

**Verdict on the call:** correct against any realistic straddler. The only
world where folding is right is a player who straddles the button and then
5-bet jams *exclusively* KK/AA. Button straddlers are self-selected action
players; their jam range over a squeeze is at least QQ+/AK and often wider
(JJ, AQs, occasionally worse "straddle tilt" hands). Vs the standard range
you were roughly flipping for the biggest pot layer (42% heads-up vs BTN)
with big dead-money overlay.

**Verdict on the squeeze:** also correct, and the sizing was good.
- Dead money: $105 ($15 pot + two $45 all-in-ish commitments) before you act.
- AKs crushes the ranges actually in the pot: 62% vs MP's real hand class,
  48% vs HJ's pair-heavy call range.
- $200 into $105 folds out the straddler's junk while keeping his worse
  broadways in bad shape, and it *mathematically commits you* — after the
  jam you needed $550/$1,948 worth of coverage and had it vs everything but
  exactly KK+. Being committed with AKs in a 4-way dead-money pot is a
  feature, not a bug. (A smaller squeeze, e.g. $135, would invite HJ + BTN
  multiway flops where AK realizes poorly; a jam for $750 is also fine and
  ends the hand cleaner, at the cost of folding out hands you dominate.)

## The "AK wins in the long run" feeling, quantified

AK does not win this *spot* in the long run — it wins the *decision tree*.
Conditional on the worst branch (straddler wakes up with a 5-bet and two
players call off), you average about **−$100 to −$116 per occurrence** even
played perfectly, because AKs is ~34% against the top of a jamming range
and the branch only occurs when someone has that top. But that branch is
rare; in the common branches your squeeze picks up $105 uncontested or gets
it in as a 60%+ favorite against the shortstack. The line was +EV where it
was decided; the outcome landed in the paid-for tail. You won all three
layers ~27% of the time here — this was the other 73%.

One results-independent note: you lost the *minimum-decision* version of
the hand. The two biggest layers went to hands (set, KK) that were always
getting the money in; no alternative line kept your stack while staying
+EV.

## Record-entry notes

The hand record above was built and validated through the real reducer
pipeline (straddle entry, all-in flags, per-pot winner attribution
`pot: 0/1/2`, revealed villain cards). Board cards were not recorded — only
outcomes were known. To enter it on-device: set dealer = straddler's seat,
record the straddle first (it must precede all preflop actions), then the
13 betting actions in table order, then assign the three pot winners.

⚠️ Do **not** try to merge this hand in via Settings → import: `importAllData`
clears all existing data first (full restore, not a merge).
