# What live low-stakes winrates actually are — and where the 20 bb/hour anchor came from

Date: 2026-08-05 · Program: `methodology-integrity` · Ticket: **WS-417**
Sites under test: `docs/standard-of-record/SCORED-READOUT-SPEC.md:747` · `scripts/backtest/holeMap.mjs:22`
All sources accessed **2026-08-05**. No Result Card: this document makes no comparative claim about
any surface in this repo — it is external evidence gathering, and every figure in it is
**transferred, not measured**, in exactly the sense the Suspected-Fault Register's top-ranked entry means.

> **CAVEAT, BINDING, REPEATED AT EVERY NUMBER.** Nothing below was measured by this repo, on this
> repo's corpus, or in the founder's game. Every winrate here is a **third party's realised result in
> a different room, at a different stake, against a different field**, and most of them are estimates
> with no sample at all. They are quantities to look at and convert — never a standard to set.

---

## Verdict, up front

**The units-error hypothesis is REFUTED. "20 bb per hour" is a real, literal, named, circulating
figure in live poker, and it was almost certainly transcribed correctly.**

It traces to **Marc Goone's $100/hour challenge**: 300 hours of live **$5/$5** with a $1,000 buy-in
cap at Hustler Casino, Los Angeles, August–December 2024. At $5/$5, $100/hour *is* 20 bb/hour. He
finished at **$89.61/hour before the jackpot rebate — 18 bb/hour — and about $110/hour after it,
which is 22 bb/hour.** The nearest independent event is Chris Murray's ("persuadeo") **100 hours of
$1/$3** in Las Vegas over the same summer, framed explicitly as chasing *"the Marc Goone target of
20 bbs/hr"*, finishing at **$56.38/hour = 18.8 bb/hour**.

So the anchor is not a units slip. It is a **real number, achieved, and published.**

**And it is still the wrong scale test**, for four reasons that survive its being true:

1. **It is the top of the documented distribution, not "what good players make."** Every source that
   is not one of those two challenges puts a strong live low-stakes regular at **8–12 bb/hour**, and
   the industry press covering Goone's own challenge said flatly that *"winning about 10 bb per hour"*
   is *"widely accepted"* as the maximum for skilled players — which is why the challenge was
   newsworthy. The best-specified long sample in the entire record — **1,200 hours / 36,000 hands at
   $2/$5, with hands, pace and both units stated** — comes in at **7.5 bb/hour** (§2.1, R2). The
   anchor is **2× the consensus ceiling and 2.7× the best-documented long sample**.
2. **It was achieved at $5/$5 in California, and about half the gap is the fee structure, not skill.**
   Hustler's collection schedule was recovered from its filing with the California Bureau of Gambling
   Control: a **flat per-hand fee that cannot legally be a percentage** and does not scale with pot
   size. Against a Las Vegas $1/$3 room's 10%-capped rake plus jackpot drop, the differential is
   **11–14 bb/100 ≈ 3.3–5.6 bb/hour** (§6.1). **Transferred onto the founder's rake structure, Goone's
   17.9 bb/hour becomes ≈12.3–14.6 bb/hour** — just above the strong-regular band, not double it.
3. **The samples are thin and the dispersion needed to price them has never been measured for live
   poker.** Goone's 300-hour 95% interval runs **[13.6, 22.2]** if live dispersion matches the online
   full-ring convention and **[8.6, 27.2]** if it matches the (asserted) live figures — so whether
   300 hours even establishes that he beat 10 bb/hour **depends on a quantity nobody has measured**
   (§5). Both challenge figures are **realised**, not EV-adjusted, and both were published *because*
   they succeeded. Separately, the best population study on record finds that a player's winrate over
   one period explains **2–5% of the variance** in their winrate over the next, even among players
   with 1,000+ hands (§7).
4. **It is a TOTAL REALISED rate and the Hole Map's number is an INCREMENTAL MODELLED CEILING.**
   That objection was already correct in the Gate 2 adjudication and none of this evidence touches it.

**One arithmetic correction to the review that filed WS-417.** It converted the anchor at the repo's
own 25 hands/hour to get 80 bb/100. That is right *given* 25 — but **25 is the lowest figure in the
literature and the only measured figure is 40** (Selbrede, four Las Vegas cardrooms, ~1,000 hands
counted). At 40 hands/hour the anchor is **50 bb/100**, not 80. So the anchor is less extreme than the
review computed, and **the repo's own pace constant is doing 60% of the work in that computation** —
which is a second finding, independent of the anchor.

**One further caution before the band.** Of ~30 player results gathered, exactly **one** is confirmed
to match the founder's game on both stake *and* table size — a **543-hour break-even at $1/$2 full
ring** (§2.1, F1). Everything else is inferred to be 9-handed from venue convention. The band below
is therefore a band over a literature that is *not* demonstrably about the founder's game.

**The defensible band**, for a good player in a live 9-handed $1/$2–$1/$3 game, stated as a band
because a point estimate is not supportable:

| | bb/hour | bb/100 @25 h/hr | bb/100 @30 h/hr | bb/100 @40 h/hr | $/hr @ $1/$2 | $/hr @ $1/$3 |
|---|---|---|---|---|---|---|
| **The drop line** (what every seat pays — not a skill claim) | −6 to −12 | −20 to −29 | −20 to −29 | −20 to −29 | −$12 to −$23 | −$18 to −$35 |
| **Competent winner** | 3–5 | 12–20 | 10–17 | 7.5–12.5 | $6–$10 | $9–$15 |
| **Strong regular** (the consensus band) | 8–12 | 32–48 | 27–40 | 20–30 | $16–$24 | $24–$36 |
| **Documented ceiling** (2 sources, both sample-limited, one at a higher stake) | 18–22 | 72–88 | 60–73 | 45–55 | $36–$44 | $54–$66 |

Selection-bias-corrected (§7), the honest reading of the **documented ceiling** row as a
*sustainable* rate is **10–16 bb/hour**, not 18–22.

---

## 1. Provenance: the anchor has a name, and the name changes the question

The repo's own Gate 2 adjudication said the anchor *"has a source but no evidence"* — the founder
said it, and nothing backs it. The evidence exists; it is just outside the repo.

**Marc Goone** is a live cash coach (co-founder of Hungry Horse Poker, a for-profit coaching
business). In August 2024 he began a filmed challenge to win **$100/hour at $5/$5 with a $1,000
buy-in cap** at Hustler Casino in Los Angeles, targeting ~250 hours.

| Report | Date | Hours | Result |
|---|---|---|---|
| GipsyTeam | 30 Oct 2024 | "just under 150" | **$115/hour** |
| Pokerati (Tadas Peckaitis) | 26 Nov 2024 | "over 200" | "about $100 per hour", stated as **20 bb/hour** |
| Pokerati (Tadas Peckaitis) | 3 Jan 2025 | **300** | **$89.61/hour before jackpot payouts = 18 bb/hour**; "closer to $110/hour after accounting for rakeback" |

Goone's own statement on the sample, quoted by GipsyTeam:

> "I know it's not big enough to definitively say that this hourly is doable, but you can observe a
> lot in those hours from showdowns. … I'm not going to play a thousand hours; I would probably shoot
> myself. … The point isn't that these samples are representative; the point is that this stuff works."

And the framing Pokerati puts around it, which is the single most useful sentence in this entire
research pass:

> winning about 10 bb per hour is "widely accepted" as the maximum for skilled players, making
> Goone's 20 bb goal "a task few poker players would even consider."

**The 20 is a stretch goal set deliberately at double the consensus ceiling.** Adopting it as the
denominator of a scale test imports a marketing target as a norm.

**Chris Murray (persuadeo)** ran the parallel event at the founder's actual stake — $1/$3 — over
100 hours at Wynn, Aria and Red Rock, March–August 2024, explicitly against *"the Marc Goone target
of 20 bbs/hr"*. He finished **$56.38/hour = 18.8 bb/hour**, and wrote that he *"would probably
revert to something closer to say, 15 bbs/hour over another, say, two-hundred hours."*

His career self-report is the longest-sample number found anywhere in this pass:

> "for ten years and many thousands of hours my win rate in low stakes (1/2 to 5/10) has been 12/bb hour"

**12 bb/hour over thousands of hours, across a stake range**, from the same author whose 100-hour
sprint produced 18.8. The gap between his own two figures — 12 lifetime vs 18.8 over 100 hours — is
the sample-size effect and the selection effect, visible inside a single person.

---

## 2. The sourced table

**Quality grades**, defined here rather than borrowed:

| Grade | Meaning |
|---|---|
| **A** | A measured study of the game itself — stated sample, stated method, published table. |
| **B** | A player result with a stated sample ≥100 hours, stated stake and venue, but incomplete method (rake/tip/EV treatment unstated). |
| **C** | A specific number from a named practitioner or publisher, offered as guidance, **with no sample behind it**. |
| **D** | A number in secondary media with neither sample nor named practitioner, or internally inconsistent. |
| **X** | **Anecdote** — a real number whose sample is too small to constrain anything (<50 hours). Recorded, not discarded, and never aggregated. |

| # | Source | Number | Units | Sample | Stake / format | Date | How measured | Grade |
|---|---|---|---|---|---|---|---|---|
| 1 | Marc Goone challenge, via Pokerati 2026-01-03 | **$89.61/hr** (18 bb/hr); **~$110/hr** (22 bb/hr) incl. rakeback | $/hr, bb/hr | **300 hours** (~9,000 hands @30 h/hr) | $5/$5 NLHE, $1,000 cap, Hustler Casino LA, 9-handed | Aug–Dec 2024 | Realised money, filmed/self-reported; **rake & tip treatment unstated**; headline conflates poker EV with a jackpot/rakeback rebate; not EV-adjusted | **B** |
| 2 | Marc Goone, via GipsyTeam 2024-10-30 | **$115/hr** (23 bb/hr) | $/hr | "just under 150 hours" | as above | Oct 2024 | as above — **interim figure, superseded by #1** | B |
| 3 | Chris Murray (persuadeo), "100 Hours of One-Three, Conclusion" | **$56.38/hr = 18.8 bb/hr** | $/hr, bb/hr | **100 hours** (~3,000 hands @30) | **$1/$3** NLHE, Wynn / Aria / Red Rock, Las Vegas | Mar–Aug 2024, pub. 2024-08-18 | Realised; per-session ledger; SD computed ($292); rake/tips not stated as deducted; not EV-adjusted | **B** |
| 4 | Chris Murray, same article | **22 bb/hr** ($110/hr) | bb/hr | subset of the same period, **hours unstated** | $2/$5 | 2024 | Realised; no separate sample stated | **X** |
| 5 | Chris Murray, "So You Want to Play 100 Hours…" | **12 bb/hr** | bb/hr | **"ten years and many thousands of hours"** — no ledger published | $1/$2 to $5/$10 **mixed** | pub. 2024-05-05 | Self-report, unverifiable, mixed stakes (so "bb" is not one unit) | **C** |
| 6 | Chris Murray, same | $42/hr = 14 bb/hr = **"46 bbs/100 hands"** | $/hr, bb/hr, bb/100 | **48 hours ≈ 1,440 hands** (his own count, @30 h/hr) | $1/$3, $500 cap | 2024 | Realised; he states it as "only 14.4 100-hand units of information" | **X** |
| 7 | Chris Murray, same | historical **$36/hr = 12 bb/hr** | $/hr | unstated | $1/$3 | pre-2024 | Self-report | C |
| 8 | Commenter "MN" on persuadeo.nl | **10 BB/hr** ($30/hr) | bb/hr | **125 hours** | $1/$3 | 2023 | Anonymous self-report with sample stated | **C** |
| 9 | Same commenter | **27.5 BB/hr** | bb/hr | **107 hours** | $0.5/$1 **home game** | 2023 | Anonymous; home game — different population entirely | C |
| 10 | "teepack", CardsChat thread | **$42.50/hr = 14.2 bb/hr**, later decaying to **~$5/hr = 1.7 bb/hr** | $/hr | **17 hours** ($723), then more | $1/$3 | Jul 2023 | Realised; no rake/tip deduction stated. **Included precisely because it decayed** | **X** |
| 11 | Steve Selbrede, PokerNews, "The Impact of Rake in Low-Stakes Cash Games" | **40 hands/hour**, **8.78 players/hand**, **$2.164 rake/hand**, **$50.39 avg pot**, **$9.86 rake/player/hour** | various | **~1,000 hands, 4 Las Vegas cardrooms**, various times/days | $1/$2 and $2/$5 NLHE | 2019-02-06 | **Measured** hand-by-hand observation; the only real dataset in this table | **A** |
| 12 | Selbrede, same | *"the average Vegas $1/$2 player loses nearly $10 per hour, or 5 big blinds per hour, entirely due to the rake"* | $/hr, bb/hr | derived from #11 | $1/$2 | 2019 | Calculated from measured inputs. **Rake only** — excludes jackpot drop and tips | **A** |
| 13 | Selbrede, same | *"Tom Terrific, an extremely good player earning **$20 per hour**"* (= 10 bb/hr) | $/hr | none — illustrative | $1/$2 | 2019 | Asserted as the worked example's premise | **C** |
| 14 | James "SplitSuit" Sweeney, "How Much Can I Win Playing Live Poker?" | $1/$2 **~$20/hr = 10 bb/hr**; $2/$5 **~$40/hr = 8 bb/hr**; $5/$10 **~$75/hr = 7.5 bb/hr** — all described as the **top** of the spectrum | $/hr | none | live NLHE | undated | Estimate/guidance. Notes rake structure can make a game unbeatable | **C** |
| 15 | Nathan Williams (BlackRain79), "What is a Good Poker Hourly Rate?" | $1/$2 **$20/hr** (10 bb/hr); $2/$5 **$50/hr** (10); $5/$10 **$90/hr** (9); $10/$20 **$170/hr** (8.5); $25/$50 **$350/hr** (7) | $/hr | none for live; he says *"I have never cared what my hourly is"* | live NLHE | 2018, upd. 2026 | Estimate | **C** |
| 16 | PokerCharts, "BB Per Hour: The Only Honest Way to Measure Live Poker Results" | recreational winner **3–5 bb/hr**; strong regular **8–12 bb/hr**; *"above 15 bb/hour over hundreds of hours are rare"*; live pace **25–30 h/hr**; live SD **60–100 bb per hour** | bb/hr | none — explicitly no user-base data cited | live NLHE | undated | Assertion by a live-tracking product | **C** |
| 17 | ManageBankroll, "BB/Hour in Poker" | consistent winners **5–10 bb/hr**; >10 = crushing; *"absolute elite … 15–20 BB/hour over large samples"*; separately, the very best at $1/$2 and $2/$5 make **~10 bb/hr**; $2/$5 pro at 10 bb/100 ≈ **$13.50/hr**; 100k hands @27 h/hr ≈ **3,700 hours** | bb/hr, bb/100 | none | live NLHE | undated | Assertion. **Internally inconsistent** — "very best ≈ 10" and "elite 15–20" in one article. Page returned HTTP 429 on direct fetch; figures are from the search index, not a page read end to end | **D** |
| 18 | Pokerati (Tadas Peckaitis) | *"winning about 10 bb per hour"* is *"widely accepted"* as the **maximum for skilled players** | bb/hr | none | live low stakes | 2024-11-26 | Editorial assertion — but it is the framing the challenge was written against | **C** |
| 19 | Arved Klöhn, PokerListings, "How to Beat Variance in Poker" | worked example: live $1/$2 at **$50 per 100 hands (25 bb/100)** with **SD $238/100 hands (119 bb/100)**; 30–35 hands/hour | bb/100 | **hypothetical** | live $1/$2 | upd. 2026-07-24 | Explicitly a constructed example, not a measurement. Its **SD** is the most useful part | **D** |
| 20 | Various winrate reference pages (HisHands, Beasts of Poker et al.) | live cash **0–30 bb/100 typical, 30+ exceptional**; *"not uncommon for a live 2/5 player who is breaking even to beat the games by 20BB/100"* | bb/100 | none | live NLHE | 2026 | Assertion, no source | **D** |
| 21 | PracticalWebTools, "Win Rate Calculator Guide 2026" | table: live $1/$2 achievable **3–6 bb/100**, elite **10+**; but a worked example of a live $2/$5 regular at **30 bb/100 = $45/hr** over 500 hours | bb/100 | none | live NLHE | 2026-01-29 | **Self-contradictory by a factor of 3–5** between its own table and its own example. Included as evidence of how confused the secondary literature is | **D** |
| 22 | Primedope variance calculator | NLHE **full ring SD 60–80 bb/100** (online, from PokerTracker/HM2 databases); at SD 90, **100,000 hands → ±1.8 bb/100** at 95% | bb/100 | tracker databases, size unstated | **online** full ring | undated | Tracker-derived. **Online** — live SD is higher (see #16, #19) | **B** |
| 23 | ThePokerBank, "Poker Winrates" | 1–4 bb/100 great; 5–9 amazing; **10+ "very, very few"**; 60 hands/hr full ring | bb/100 | none | **online only** | undated | Assertion. Included only to mark the online/live gap | C |
| 24 | Hand2Note "Live Poker Database" | winning TAGs average **51 EV bb/100** ($2/$5: 95 · $5/$10: 56 · $25/$50: 37 · $100/$200: 49); live VPIP/PFR 31/20, 3-bet 13%; flops 45% HU / 24% 3-way / 31% 4+ | bb/100 | **242 players, ~500,000 hands** (~2,000 each) | live NLHE $2/$5–$100/$200 | 2025-07-28 | **The only live per-player database found.** EV-adjusted. **Its bb/100 figures must be discarded**: the cohort is selected on *being winning TAGs*, ~2,000 hands each is below the 1,471-hand threshold at which skill even dominates luck (#25), and 51 bb/100 is an order of magnitude above any plausible sustained figure. The **structural** stats are usable | **D** (winrate) / **B** (structure) |
| 25 | Potter van Loon, van den Assem & van Dolder, *PLoS ONE* 10(3):e0115479 | **32%** of players finished ahead after rake (**37.5%** before rake); unweighted mean **−104 bb/100** vs hands-weighted **−6.6 bb/100**; rake drag **16 bb/100** unweighted, **6.6** weighted; past→future winrate **R² = 0.022–0.049** among ≥1,000-hand players; top vs bottom percentile separates after **1,471 hands** | bb/100, % | **611,484 players · 76.9M hands · 456M player-hands** | **online** NLHE cash, BB $0.25/$2/$10, avg 5.9 players/hand | Oct 2009 – Sep 2010 | Peer-reviewed; full distribution published; both raked and unraked reported. **Online, 2009–10** — same era and modality as this repo's own corpus, so it does not relieve the transfer problem | **A** |
| 26 | Dr. Randal Heeb, expert testimony, *United States v. DiCristina*, 886 F. Supp. 2d 164 (E.D.N.Y. 2012) | **28%** of $5/$10 players had a positive result over a year (**37%** rake added back); under cross: *"10 percent to 20 percent of the players in any given game are good enough to win consistently … represented by the top 6 to 8 percent of players"* | % | **415,000,000 hands**, PokerStars | **online** NLHE cash, $5/$10 (figures), Apr 2010 – Mar 2011 | 2012 | Sworn expert analysis; the only PokerStars population data ever made public, and only via litigation. Player count not stated | **A** |
| 27 | Tom Boshoff (GTO Wizard), population report | raw post-rake winners **22.5–30.4%** by stake; **Bayesian-shrunk true winners 7.5–20.1%** (NL100: **28.8% → 9.0%**); regulars (5,000+ hands) ~50% post-rake winners. **NL100 regulars (n=2,181): 23.6% ≥5 bb/100 · 7.2% ≥10 bb/100 · 0.69% ≥20 bb/100** | % , bb/100 | undisclosed hand count; per-stake player counts undisclosed | **online** 6-max NLHE, NL10–NL500 | ~2025 | PokerTracker 4 population report + Bayesian shrinkage (prior mean = rake, between-player SD 8 bb/100, *"pessimistic by design"*). **Site, dates and n undisclosed** — the method is stated, the sample is not | **B** |
| 28 | Jim James, Automatic Poker, "What Percentage of Poker Players Win?" | **30%** profitable after rake; **5% >10 bb/100**, 13% at 3–10, 12% at 0–3, 23% below −10 | % | **609 players, each ≥10,000 hands** | **online** NLHE+PLO mixed, NL10–NL200, Winning Poker Network | 2018-12-19 | Own Hold'em Manager database; rake deducted, pre-rakeback. Single author, no external citation, date range of hands unstated | **B** |
| 29 | multipotentialmike, "Poker variance denoising" | **σ = 97.2 bb/100** | bb/100 | **150,000+ hands**, own parsed database | **online** NL2 Zoom 6-max, PokerStars | undated (pre-2026) | **The only standard deviation in this entire pass computed from hands rather than asserted.** Micro-stakes fast-fold — transfer to live is unestablished | **B** |

### 2.1 Individual tracked samples — the amateur half of the record

The §2 table is dominated by coaches and publishers. A separate sweep of r/poker (recovered via the
PullPush archive API and the Wayback Machine; 2+2 is Cloudflare-gated and unrecoverable) found
individual players posting tracked results with stated hours. These are **lower-profile and therefore
less selection-filtered** than the challenge results, which makes them more useful, not less.

| # | Player / post | Rate + units | Sample | Stake | Method flags | Grade |
|---|---|---|---|---|---|---|
| **R2** | `104ksvg`, "Live poker graph: 36k hands of 2/5 NLH (1200 hours)", 2023-01-06 | **7.5 bb/hr ($37.50/hr)** overall; first 500 h **2.8 bb/hr**; last 700 h **11.9 bb/hr** | **1,200 hours ≈ 36,000 hands**, over 2 years, one casino | $2/$5, $1k cap | **The best-specified source in the entire study** — states both units at one stake, states hands, states pace (30 h/hr), gives its own error bar (±3 bb/hr). **Fails the 9-handed filter**: *"only 8max tables, which are often playing at 6 or 7 handed"* | **B+** |
| R4 | `PoopingRobe`, "1000 hours of live 1/2 NLH", ~Apr 2025 | **not stated by the author**; commenters read **$33/hr "after the rake"** and **$45/hr** off the graph | **1,000 hours**, ~30k hands (commenter estimate) | **$1/$2**, $500 cap, frequent $5 straddle | **Time collection, $12/hr, paid separately** — and the thread never resolves whether $33–45 is gross or net of it. ~$10k in tips/meals tracked in a separate field. Includes a *"almost 200hr break even streak"* | C |
| R5 | `lolfunctionspace`, "2500 hours live poker", 2025-05-31 | *"live poker can be beat for 30–40 bb/100"*; a commenter computes *"averaging $25k per year"* | **386 sessions, 2,505 hours, ~60,000 hands** | **$1/$2 to $25/$25/$50** — disqualifying spread | **The most explicit deduction statement found anywhere:** *"I estimate $40/session in booze/drinks paid in chips, which comes out to about 15k. Tips, I estimate another 15k. So add 30k to this graph."* The graph is **net** of ~$30k | C |
| R6 | `davoarid`, "Just passed 300 hours of live $1-$2", 2023-08-03 | *"**My win rate is 24 BBs per hour**"* (= $48/hr) | **300 hours**; hands unstated | **$1/$2** | No dollar cross-check; never says whether "BB" is big blind or big bet. **Extreme for the stake** — above every challenge figure, at the lowest stake, on the shortest sample | X |
| R3 | `Research_Greedy`, "40bb/100 winrate in 630 hours", 2024-07-30 | **40 bb/100** | **630 hours ≈ 12,600 hands** (his own 20 h/hr) | **€2/€5** | **Rake stated: 5%, €15 cap (3bb).** **Self-declared sample exclusion:** *"I didn't share my 5/10 stats but in the first month I also had a 20k upswing in 5/10"* | C |
| R8 | `magicmarkh` (comment) | **12.59 BB/hr, 50.37 bb/100, 55% winning sessions** | **2,000 tracked hours** (implies ~25 hands/hr) | *"everything from 1–$10 blinds"* | Two units internally consistent, but **neither maps to a single big-blind size**. Explicitly declines to give a dollar hourly | C |
| R7 | `FickleIntroduction17`, "2000 hours / 2 years", 2024-12-01 | **$53/hr — for a 425-hour sub-sample only** (confirmed by the author); overall rate is image-only | **2,000 hours** | *"mostly 1/2"* | Winning-session rate only **51–53%**. *"when I started tracking I was mostly a break even player"* | C |
| R1 | `It-was-suited`, "1000 Hours of Live Poker Results", 2021-09-09 | **$52/hr** | ~1,000 hours, Oct 2019 → Sep 2021; hands unstated | $1/$2 → $2/$5 → Texas $2/$5 | **Self-flagged twice:** *"the $52/hr includes over 500 hours of results at stakes I wouldn't even consider playing anymore"*; skewed by one $13k session in a game that *"plays like $25/$50"* | X |
| R13 | `Zephyr520`, "800 hours at 1/2 live NLHE", 2017-09-04 | image only | **800 hours** | *"all casino 1/2–1/3"* | **Tips quantified and held OUT** (~$1,600, *"about $2/hr"*). **Anti-favourable selection, self-declared:** *"I don't ever game select… those games are pretty bad with a lot of nits and promo grinders"* | C |
| R10 | `sisyphusPB23`, 2023-07-18 | **−$7,951 over 475 hours ≈ −$16.7/hr** | **475 hours / ~13 months** | *"mostly 1/2 and 2/5"* + $100–500 tournaments | **A stated-size LOSING sample.** Contaminated by tournaments in the same figure | C |
| R11 | `awesome5185`, "First 500 hours live results", 2025-01-01 | image only; commenters read *"slightly above break even"* | **500 hours**, *"strictly as a rec"* | $2/$5 → $5/$5/$10 | **First-person account of the bb-denomination failure this document is about:** *"my BB/hour doesn't line up with my dollar profit at all"* — because his blind size moved mid-sample | C |
| R9 | `Odd-Housing-4243`, "first 500 hours of 1-2 Live NLH", 2025-03-21 | image only | **500 hours / 5 months** | $1/$2 Georgia, $400 buy-in | **Not clean NLHE:** the games *"feature Double Board PLO bomb pots, and [have] a round of PLO per orbit"* | X |
| R12 | `BluffaloSam`, "My First 1,000 Hours", 2024-12-04 | image only | **1,000 hours / ~15 months** | *"almost all… 1/3 and 2/5"* | **Contaminated:** the author is a vlogger running a publicised $100→$100k challenge across the sample; also mixes HKD 10/20 | X |

Two more, from the forum half of the same sweep, both matching the founder's stake and both negative:

| # | Player | Rate + units | Sample | Stake | Why it matters | Grade |
|---|---|---|---|---|---|---|
| **F1** | **Aaron Soto** (CardsChat) | **−$350** ≈ **−$0.64/hr** — break-even | **543 hours** | **$1/$2, stated FULL RING** | **The only sample in this entire study confirmed at the founder's stake AND table size.** It is a break-even result over 543 hours | **B** |
| F2 | `batcavepoker` | **−5.33 bb/hr** | 2022 season; hours to be confirmed | **$1/$3** | A stated-size losing sample at the founder's other stake | C |

**F1 deserves its own sentence.** The one result in this document that matches the founder's game on
both stake and table size is a **543-hour break-even**. That is not evidence that the game is
unbeatable — 543 hours resolves nothing (§5) — but it is the closest thing here to a like-for-like
comparison, and it sits ~19 bb/hour below the anchor.

**What R2 does to the picture.** It is the longest sample anywhere with hands, hours, stake, pace and
both units stated — and it lands at **7.5 bb/hour at $2/$5**, i.e. at or just below the bottom of the
consensus "strong regular" band, from a player who tracked 1,200 hours at one casino. Against it,
20 bb/hour is not 2× the consensus; it is **2.7× the best-documented long sample in the record.**

### 2.2 Three findings from the individual samples that change how §2 must be read

1. **The 9-handed constraint is effectively unverifiable.** Across roughly thirty sources in this
   entire study, exactly **two state table size** — and the better-specified of them (R2) is **8-max
   playing 6–7 handed**. Every other "live 9-handed" attribution in this document, including for the
   two challenge results, is **inferred from venue convention, not stated**. The founder's game is
   9-handed; almost nothing here is confirmed to be.
2. **Non-stationarity is the rule, and the sources say so themselves.** R2 splits its own continuous
   1,200 hours into **2.8 then 11.9 bb/hour — a 4.25× swing inside one sample**. R7's headline $53/hr
   covers 425 hours inside a 2,000-hour sample. R1 says half his hours are at stakes he no longer
   plays and one session skews the total. R11 reports his bb/hour and his dollar profit diverging
   because his blinds moved. **Treating any figure in this document as a stationary per-hour parameter
   contradicts the source's own text.** This is the same result §5.2 reaches from the population data,
   arrived at independently from individual ledgers.
3. **Rake and tip treatment finally appears — in four places, and it moves the numbers materially.**
   R3 (5%, €15 cap), R4 ($12/hr time collection, *unresolved in-thread* whether the quoted rate is
   gross or net of it), R5 (~$30k of tips and drinks **netted into** a 2,505-hour graph, so his gross
   rate is higher than plotted), R13 (~$2/hr tips held **out**). Across both halves of the study there
   is not one mention of **jackpot drop or EV-adjustment** in any player result. Every figure in this
   document is realised money.
   **But the player's silence is not the end of the enquiry** — §6.1 recovers the fee structure from
   the *venue* for every named room, including Goone's, from the regulator's own filing. **A missing
   methodology field is sometimes a lookup, not a limit.**

---

## 3. The three-currency conversion, and the hands-per-hour hinge

```
bb/100  =  bb/hour × (100 / H)          H = hands per hour
$/hour  =  bb/hour × (big blind in $)
```

**The big-blind ambiguity is real and it bites.** At $1/$2 the big blind is $2; at $1/$3 it is $3.
The same bb/hour figure is worth **50% more dollars at $1/$3**. Sources #8 and #10 quote $1/$3 in
dollars; #13, #14, #15 quote $1/$2 in dollars; nobody flags the difference.

**H is the hinge, and it is not measured.** This is the single most important methodological finding
after the provenance:

| H | Provenance | Grade | 1 bb/hr = |
|---|---|---|---|
| **40** | Selbrede — *measured*, ~1,000 hands, 4 Las Vegas rooms, auto-shuffler | **A** | 2.50 bb/100 |
| 30–35 | Counted home/casino sessions, 10-handed with auto-shuffler (PokerChipForum thread) | B | 2.86–3.33 |
| 29–30 | Counted sessions, hand-shuffled | B | 3.33–3.45 |
| 25–30 | Upswing, PokerPro ("call it 27"), PokerCharts, SplitSuit — **all assert, none cites** | C | 3.33–4.00 |
| **25** | **`DEFAULT_HANDS_PER_HOUR` in `holeMap.mjs:403`** — the bottom of the unsourced convention | — | **4.00** |

**The repo currently uses the lowest number in the literature, and it is the one with nothing behind
it.** Choosing 25 over Selbrede's measured 40 inflates every bb/100 figure by **60%**. This is not a
rounding concern: it is the difference between reading the anchor as 50 bb/100 and reading it as
80 bb/100.

Nobody has measured shot-clock effects on cash-game pace, and no source separates 8- vs 9- vs
10-handed with data. The one quantified comparison found is auto-shuffler vs hand-shuffle at
**+0 to +5 hands/hour**.

### Every headline figure in all three currencies

At the founder's stake, 9-handed, across the credible pace range:

| Figure | bb/hr | bb/100 @25 | bb/100 @30 | bb/100 @40 | $/hr @$1/$2 | $/hr @$1/$3 |
|---|---|---|---|---|---|---|
| Goone, 300 h, $5/$5, pre-rebate | 17.9 | 71.7 | 59.7 | 44.8 | $35.84 | $53.76 |
| Goone, incl. rakeback | 22.0 | 88.0 | 73.3 | 55.0 | $44.00 | $66.00 |
| persuadeo, 100 h, $1/$3 | 18.8 | 75.2 | 62.6 | 47.0 | $37.60 | **$56.38** (actual) |
| persuadeo, career, mixed | 12.0 | 48.0 | 40.0 | 30.0 | $24.00 | $36.00 |
| persuadeo's own projection over +200 h | 15.0 | 60.0 | 50.0 | 37.5 | $30.00 | $45.00 |
| "MN", 125 h, $1/$3 | 10.0 | 40.0 | 33.3 | 25.0 | $20.00 | **$30.00** (actual) |
| Consensus strong regular | 8–12 | 32–48 | 27–40 | 20–30 | $16–24 | $24–36 |
| Consensus "very best at $1/$2" | 10 | 40 | 33.3 | 25 | **$20** (actual) | $30 |
| Recreational winner (PokerCharts) | 3–5 | 12–20 | 10–17 | 7.5–12.5 | $6–10 | $9–15 |
| Selbrede's average player, rake alone | −5 | −20 | −16.7 | **−12.5** (his basis) | **−$10** (actual) | −$15 |
| **The anchor, as written** | **20** | **80** | **66.7** | **50** | **$40** | **$60** |

**The bb/hour and bb/100 literatures reconcile once converted.** "Strong regular = 8–12 bb/hour"
(#16) lands at 27–40 bb/100 at 30 hands/hour, which sits exactly at the top of "live cash is 0–30
bb/100, 30+ exceptional" (#20). Two independent conventions agreeing after conversion is a reason to
trust the band. The anchor sits at **roughly twice it** on every row.

---

### 3.1 One structural live-vs-online contrast worth keeping — and its handling rule

Source #24's **winrate** figures are discarded (§2, grade D — cohort selected on being winning TAGs).
Its **structural** figures survive that objection, because they describe how the game is shaped rather
than how well anyone played it, and they bear directly on this repo's transfer problem:

| | Live (Hand2Note, 242 players, ~500k hands, $2/$5–$100/$200) | Online reference |
|---|---|---|
| VPIP / PFR | **31 / 20** | — |
| 3-bet | **13%** | 8–10% |
| Flops seen heads-up | **45%** | — |
| 3-way | **24%** | — |
| **Four or more players** | **31%** | — |

**Handling rule, binding.** These are quantities from a **selected cohort**, not a Field description.
They may be used to *ask* whether this repo's online-2009 corpus differs structurally from live play —
the 31% four-plus-way flop rate is a pointed question for any engine calibrated on a corpus where
multiway frequency differs — but they may **not** be imported as population parameters, seeded into a
prior, or cited as "the live field does X". A Field in this repo is measured or it does not exist.

---

## 4. Methodology metadata (reported, not adopted)

Recorded because it changes what the numbers mean, not because the repo takes on any of these framings:

- **Rakeback is not poker EV.** Goone's headline "$110/hour" folds a jackpot/promotional rebate into
  a poker winrate. The poker figure is **$89.61**. A rebate is a function of hours seated and money
  raked, not of strategy quality — it does not belong in a benchmark used to scale a strategy edge.
- **Every player figure here is REALISED, none is EV-adjusted.** Not one source says which. Over 100–300
  hours the two diverge by more than the whole quantity being measured (§5).
- **Rake and tip treatment is unstated in every player result.** Live results are normally logged as
  chips-off-the-table, which nets rake automatically but usually **excludes tips paid** — so most
  reported figures are, if anything, mildly overstated relative to true take-home.
- **Goone's game had a $1,000 cap at $5/$5 (200 bb).** persuadeo notes a separate deep game with a
  "minimum 200 bb buy-in" and says explicitly the depth *"greatly affect[s] risk/reward and thus win
  rate"*, and that it "does not compare to typical 1/3 games outside of Texas." Effective stack depth
  is a condition on both headline numbers.
- **Both challenges were run by professional coaches with businesses attached.** Goone's is the
  marketing artefact of Hungry Horse Poker; he says so himself.
- **Selbrede's rake is from a superseded schedule.** His measured $2.164/hand is a **$4-cap** 2019
  observation. Posted 2025–26 Las Vegas schedules run **$5–$7 caps with $1–$2 promo drops**. The
  current-conditions analogue is his *modelled* $6-cap row at $2.72/hand, which is not measured.

---

## 5. What these samples can actually support — check the arithmetic yourself

Standard error on a winrate over `T` hours is `σ_hr / √T`, with `σ_hr = σ_100 × √(H/100)`.

### 5.1 σ for live NLHE has never been measured — and the ordering everyone assumes is unsourced

This is a finding in its own right, and it was arrived at by looking for the opposite.

| Figure | Format | Provenance |
|---|---|---|
| **97.2 bb/100** | online NL2 Zoom **6-max** | **The only σ anywhere computed from a hand database** (#29): 150,000+ hands, author's own parser |
| 60–80 bb/100 | NLHE **full ring** | Primedope, GamblingCalc, LimpLab — all assert; the only stated provenance is *"can be found in PokerTracker or HEM"* |
| 75–120 bb/100 | NLHE **6-max** | same three calculators |
| 119 bb/100 | live $1/$2 | Klöhn worked example (#19) — an illustration, not a measurement |
| 149 bb/100 | live | Primedope worked example — same author |
| 60–100 bb **per hour** | live cash | PokerCharts (#16), asserted → at H=30 that is 110–183 bb/100 |
| ~97 bb/hour (~177 bb/100 @H=30) | live $1/$3 | Implied by persuadeo's computed SD of **$292** (#3). Unit is ambiguous in the source |

Two corrections that matter:

1. **Every published "live SD" traces to one author.** Arved Klöhn wrote the Primedope calculator, the
   Primedope examples page and the PokerListings article; GamblingCalc and LimpLab are near-copies of
   the Primedope numbers. The apparent multi-site consensus is one person's estimates replicated, and
   his *live* figures appear only inside tutorial worked examples.
2. **The common intuition — "live full ring is higher-variance than online 6-max" — has no source, and
   the calculator consensus runs the other way** (full ring 60–80 *below* 6-max 75–120). Live games
   are looser and deeper, which argues up; live games are also more passive and see fewer big pots per
   hand, which argues down. **Nobody has measured it.** This document therefore carries three cases and
   does not pick one.

Carrying σ₁₀₀ = **70** (full-ring convention), **100** (the one measured figure), **150** (the live
illustrations and persuadeo's implied value), at H=30 → σ_hr = 38.3, 54.8, 82.2.

| Claim | Hours | Point est. | 95% CI @σ=70 | @σ=100 | @σ=150 |
|---|---|---|---|---|---|
| Goone | 300 | 17.9 bb/hr | [13.6, 22.2] | [11.7, 24.1] | [8.6, 27.2] |
| persuadeo | 100 | 18.8 bb/hr | [11.3, 26.3] | [8.1, 29.5] | [2.7, 34.9] |
| "MN" | 125 | 10.0 bb/hr | [3.3, 16.7] | [0.4, 19.6] | [−4.4, 24.4] |
| teepack | 17 | 14.2 bb/hr | [−4.0, 32.4] | [−11.8, 38.4] | [−24.9, 53.3] |

**Read these honestly, in both directions.** At the low and middle σ, Goone's 300 hours **does**
establish that he beat 10 bb/hour — the interval excludes it. At the high σ it does not. **Which is
true depends on a quantity nobody has measured**, so the challenge neither proves nor fails to prove
the thing it was framed against; it is simply not decidable from the published record. persuadeo's
100 hours is weaker in every case and at the high σ cannot distinguish 18.8 bb/hour from ~3.

**How much would be needed** (T hours at H=30):

| Question | σ=70 | σ=100 | σ=150 |
|---|---|---|---|
| Resolve a rate to ±5 bb/hr (95%) | 225 h | 461 h | 1,038 h |
| Resolve a rate to ±2 bb/hr (95%) | 1,409 h | 2,883 h | 6,490 h |
| Reject "10 bb/hr" if the truth is 20 (95%, 80% power) | 115 h | 235 h | 530 h |

At 30 hands/hour, **2,883 hours is ~86,000 hands** and 6,490 hours is ~195,000 — the same answer the
online literature gives independently ("100,000 hands for ±1.8 bb/100" at σ=90, #22). The two
conventions agree, and they say the same thing about live poker: **a winrate at live pace takes years
of full-time play to establish.** ManageBankroll's own arithmetic agrees — 100,000 hands at 27
hands/hour is **~3,700 hours**.

**So: "300 hours proves 20 bb/hour is achievable" is a defensible claim about the point estimate and
an undecidable one about the rate.** 300 hours is adequate to separate 20 from 10 if live σ is at the
tight end and inadequate if it is not, and the deciding quantity is unmeasured.

**And the general form of the error, stated plainly.** At σ = 90 bb/100, 100,000 hands buys a 95%
interval of ±1.8 bb/100, and resolving a difference of **1 bb/100** to significance needs **over
2,000,000 hands**. At live pace that is on the order of **70,000 hours** — several lifetimes. Any
source in §2 or §2.1 asserting that a few hundred hours establishes a winrate is wrong by three to
four orders of magnitude, and the check is one line of arithmetic that none of them performed.

### 5.2 The harder result: a past winrate barely predicts a future one

The largest peer-reviewed study (#25) regressed each player's second-period winrate on their first,
restricted to the 20,632 players with **≥1,000 hands in each period**. It found **R² = 0.022**
(standard measure) and **R² = 0.049** (t-statistic measure). Every skill proxy the authors had,
combined, reached **R² = 0.033 / 0.081**.

**Past winrate explains 2–8% of future winrate variance among high-volume players.** It also found
that the *top decile* of period-1 performers (+34.7 bb/100 pre-rake) regressed to roughly **+5 bb/100**
in period 2 — the period-1 spread was mostly luck. And that the top and bottom percentiles only
separate reliably after **1,471 hands**, which at 30 hands/hour is ~49 live hours.

This bounds what any published winrate — including both challenge results, and including any figure
this repo ever measures on the founder — can be asked to carry.

---

## 6. The drop line — the one quantity the founder can measure himself

Sum over all nine seats of net result = **−(rake + jackpot drop + tips)**. That identity is exact and
it is the only zero in this document that is not transferred.

From Selbrede's measured $1/$2 figures (grade A) — 8.78 players/hand, $2.164 rake/hand, $0.71 jackpot
at a $1 drop:

| Component | Per player per 100 hands | bb/100 @ $1/$2 |
|---|---|---|
| Rake | $24.65 | **12.3** |
| Jackpot drop ($1) | $8.09 | **4.0** |
| Dealer tips @ $1 per pot won (71% of hands raked) | $8.09–$11.39 | **4.0–5.7** |
| **Total** | **$40.8–$44.1** | **20.3–22.0 bb/100** |

At the **2025–26 posted schedules** ($5–$6 cap, $2 drop), using Selbrede's modelled $6-cap row: rake
15.5 + jackpot 7.6 + tips 4.0–5.7 = **27–29 bb/100**.

In the other currencies: **6.1–8.7 bb/hour at H=30; 8.1–11.6 bb/hour at H=40; $12–$23/hour at $1/$2.**

Two consequences that matter here:

1. **The rake tax is stake-dependent in big blinds, which is why Goone's number does not transfer
   down.** Selbrede measured $2.92 rake/hand at $2/$5 on a $153 average pot — that is **6.65 bb/100**
   per player, against **12.3 bb/100** at $1/$2. The same gross edge is worth roughly **5–6 bb/100
   less** at the founder's stake purely from the drop, before any consideration of field softness
   (which pushes the other way) or the fact that California flat-collection rooms charge **~28 bb/100
   at $1/$2** and Texas seat rental **~14 bb/100 at $1/$3 (at H=30)** — structures that differ from
   each other by 2× and respond differently to pace.
2. **The conservation check is weaker than it looks, and should not be oversold.** For hero at
   +80 bb/100 with a table-level drop of ~179 bb per 100 hands, the other ~7.8 seats must average
   about **−33 bb/100**; at hero +40 bb/100 they must average about **−28 bb/100**. The two scenarios
   are only 5 bb/100 apart per opponent, so conservation does **not** discriminate between a 10 bb/hour
   and a 20 bb/hour hero. It does say something else worth saying: if three of the nine seats are
   break-even regulars, the five recreational seats must each absorb **~−52 bb/100**, which is a
   $200 buy-in every eight hours, every session, forever.

**This is the post the founder should actually measure.** His room's rake schedule, jackpot drop and
his own tipping are all observable in one session with a notebook. It is the only number in this
document that would be *his*, not transferred.

---

### 6.1 The venues publish what the players do not — and it explains half the gap

**The cross-cutting complaint in §2.2 was wrong in an important way.** It is true that not one player
in this study states their rake, tips, jackpot or seat rental. But **the venues publish it**, and every
strong source names its venue. The parameter is recoverable even when the author never gave it.

| Venue | Source | Recovered | Status |
|---|---|---|---|
| **Hustler Casino**, Gardena CA — Goone's $5/$5 | Approved game rules filed with the **California Bureau of Gambling Control** (`oag.ca.gov/system/files/media/hustler-casino.pdf`, 362 pp.) | **No Limit/Pot Limit, Max Buy-In $500–$2,500**: a flat fee in up to three drops — **Fee #1 from the small blind before cards, Fee #2 from the pot after the flop, Fee #3 after the turn**, all scaled by player count, *"If the action does not progress past the flop or the turn then the corresponding collection rates will not be collected."* Fee components run **$1 / $2–$4 / $0–$1** → **≈$3–$6 per hand** | **Recovered — primary regulatory document** |
| — | Same filing, statutory recital | *"no fee may be calculated as a fraction or percentage of wagers made or winnings earned… Flat fees on each wager may be assessed at different collection rates, but no more than three collection rates may be established per table"* (Cal. Penal Code §337j(f)) | **Recovered** |
| **Wynn** — persuadeo's $1/$3 | PokerNews Vegas rake comparison, 2023, upd. 2025-05-03 | **$5 max rake**, $1.50/hr comps | Recovered |
| **Aria** — persuadeo's $1/$3 | same | **$7 max rake**, $2/hr comps | Recovered |
| **Red Rock** — persuadeo's $1/$3 | same | **$5 max rake**, $1/hr comps | Recovered |
| Vegas general | same | *"Most rooms set the rake at roughly 10% of the pot and take out the rake in $1 increments up to the cap"*; "no flop, no drop"; jackpot drops *"oftentimes an extra $2 per hand once a certain threshold is reached"* | Recovered |
| **Selbrede's four rooms** | rooms **unnamed** in the source | — | **Not recoverable** |
| **SplitSuit's reader's game** | room unnamed; he quotes it as 10% capped at **$25** and calls normal 10%/$4–$5 | — | Partially recoverable |
| **Aaron Soto (F1)** | room unnamed | — | **Not recoverable** |

**The structural fact this uncovers.** California cardrooms **cannot charge a percentage rake at all** —
the collection is a flat per-hand fee that **does not scale with pot size or with the blinds**. Nevada
rake is 10% capped, so at low stakes the cap binds on most hands and the drop is a large fraction of
a big blind. These are not the same instrument, and the difference runs the founder's way at $5/$5.

**Derived restatement, net of the recoverable drop.** *This is my derivation, not any author's.*
Assumptions stated: 8.78 players/hand and $1/pot dealer toke (Selbrede, measured); a $1/$3 average pot
~1.5× Selbrede's measured $50.39 at $1/$2, so the $5 cap binds often, giving an effective ~$4.0–$4.5
rake plus ~$1.50 jackpot; Hustler collection ~$4–$5/hand once no-flop-no-drop is allowed for.

| | drop per hand | in bb | per seat, bb/100 | + tips | **total bb/100** |
|---|---|---|---|---|---|
| **Goone's game** — Hustler $5/$5, flat collection | $4–$5 | 0.8–1.0 bb | 9.1–11.4 | 1.6 | **10.7–13.0** |
| **persuadeo's game** — Vegas $1/$3, 10% capped $5 + jackpot | $5.5–$6.0 | 1.83–2.0 bb | 20.9–22.8 | 2.7 | **23.6–25.5** |
| **The founder's other stake** — Vegas-style $1/$2 (Selbrede measured) | $2.87 | 1.44 bb | 16.3 | 4.0–5.7 | **20.3–22.0** |

**The differential is 11–14 bb/100 — about 3.3–5.6 bb/hour depending on pace.**

### 6.2 Does the rake structure explain the Goone gap? About half of it — and that changes the reading

The gap to be explained is Goone's **17.9 bb/hour at $5/$5** against the consensus $1/$3 strong-regular
band of **8–12 bb/hour**: a gap of roughly **6–10 bb/hour**. The recovered drop differential accounts
for **3.3–5.6 bb/hour** of it.

> **Goone's realised rate, transferred onto a Las Vegas $1/$3 rake structure, is approximately
> 12.3–14.6 bb/hour** — not 18, and not 20.

**That lands just above the top of the strong-regular band rather than at double it**, and it lands
inside the **10–16 bb/hour** window that §7.3 reaches independently by correcting for selection. Two
unrelated routes — a venue-published fee schedule and a measured publication-bias factor — converge on
the same number. That convergence is the most load-bearing result in this document.

**What it does to the anchor.** Roughly **half** the apparent distance between the anchor and the
credible band is not skill at all; it is the fact that the anchor was earned in a jurisdiction where
the house may not take a percentage, at a stake where a flat fee is cheap in big blinds. The remaining
half is skill, selection and sample, in unknown proportion. **A benchmark that silently carries a
foreign fee structure is not a benchmark; it is a currency conversion nobody performed.**

---

## 7. Selection bias — direction, mechanism, and size

**Direction: upward, and severely — but not total, and the exception is worth stating precisely.**
Every source in the §2 coach-and-publisher table is a self-selected winner. The **individual** ledgers
in §2.1 are not: of roughly thirty player results across the whole study, **four report a losing or
break-even outcome with a stated sample** — R10 (−$7,951 over 475 hours), R11 (~break-even over 500
hours), and two from the forum sweep (a 543-hour $1/$2 full-ring sample at −$350, and a 2022 $1/$3
sample at −5.33 bb/hour).

**Four in thirty is itself the measurement.** If the true winner fraction at live low stakes is
anywhere near the 7.5–20% the online population studies find (§7.1), a representative sample of
thirty tracked players would contain roughly **24–28 losers**, not four. The published record is
inverted relative to the population by roughly an order of magnitude.

### 7.1 The size of the bias has been measured — three times, on online data

No live population distribution exists (§7.4). But three independent online datasets measure the
gap between *who reports a winrate* and *who actually has one*, and they agree:

| Dataset | Realised winners | True / consistent winners | Ratio |
|---|---|---|---|
| **PLoS ONE**, 611,484 players, 76.9M hands, 2009–10 (#25) | **32%** post-rake (37.5% pre-rake) | not estimated; but past→future R² = 0.022–0.049 | — |
| **Heeb, *DiCristina***, 415M PokerStars hands, 2010–11 (#26) | **28%** at $5/$10 (37% pre-rake) | *"top 6 to 8 percent"* — sworn, under cross | **~4×** |
| **GTO Wizard population report**, NL10–NL500, ~2025 (#27) | 22.5–30.4% (NL100: **28.8%**) | Bayesian-shrunk **7.5–20.1%** (NL100: **9.0%**) | **3.2×** at NL100, 3.4× at NL10, 1.5× at NL500 |
| **Automatic Poker**, 609 players each ≥10,000 hands (#28) | **~30%** post-rake | not estimated | — |

The GTO Wizard report per stake — Bayesian post-rake winners / pre-rake winners / rake in bb/100:
**NL10** 7.5 / 53.2 / −9.1 · **NL25** 8.6 / 42.0 / −7.4 · **NL100** 9.0 / 43.2 / −7.3 ·
**NL200** 12.8 / 43.8 / −6.0 · **NL500** 20.1 / 51.1 / −3.8. The pre-rake column is the one to sit
with: **around 43–53% of players beat the game before the rake at every stake**, and the rake is what
converts a near-coin-flip into a 3-in-10 outcome.

Its full distribution for players with ≥10,000 hands (#28) is the shape underneath all of this:
**5% above 10 bb/100 · 13% at 3–10 · 12% at 0–3 · 21% at 0 to −3 · 26% at −3 to −10 · 23% below −10.**

**Two bias factors, measured on one population with one method — and they must NOT be multiplied.**
Volume filtering roughly **doubles** the apparent winner fraction (100+ hands: 22.5–30.4% → 5,000+
hands: roughly half); noise inflates it **3.2×** (NL100 raw 28.8% vs Bayesian 9.0%). The populations
overlap, so composing them would double-count. *Caution recorded from the source: two fetch passes of
that report returned different figures for the regulars cohort (49.2%/70.8% vs 53%/89.3%) — no precise
regulars number should be quoted from it.*

**Three datasets, fifteen years apart, four different sites: realised winners overstate true winners
by roughly 3–4×.** That is the selection-bias multiplier, and it is measured rather than argued.

A fourth measurement makes the *reporting* half of it explicit: a PokerScout/Doug Polk survey found
**54% of players self-classify as long-term winners** against a measured true rate around 9–20%. The
gap between what players say and what the databases show is a factor of three to six.

Two more numbers from #25 that bear directly on how the figures in §2 should be read:

- **Unweighted mean −104 bb/100 vs hands-weighted mean −6.6 bb/100** — a ~16× difference, because
  profitability and volume are positively related and the median player in that sample played **71
  hands**. Any population statistic changes meaning entirely depending on which mean is quoted.
- **58.9% of players played fewer than 100 hands; the top 1% by volume played 58.5% of all hands.**
  The people who generate the hands are not the people who make up the population.

### 7.2 The mechanisms

Four distinct mechanisms, which compound:

1. **The population mean is negative by construction.** §6: every seat pays 20–29 bb/100 before any
   skill differential. Selbrede states the consequence plainly — *"the average Vegas $1/$2 player
   loses nearly $10 per hour, or 5 big blinds per hour, entirely due to the rake"* (rake alone;
   the full drop is roughly double that). **The median seated player is a loser and always will be.**
2. **Publication is conditioned on success.** Nobody launches a filmed "can I make $100/hour"
   challenge and publishes the graph when it goes badly. Both grade-B sources here are results that
   were reported *because* they cleared a bar. With SE ≈ 3–6 bb/hour at 300 hours, conditioning
   publication on "impressive" adds roughly **+0.5 to +1.5 SE**, i.e. **+2 to +8 bb/hour** of pure
   publication effect before any skill is involved.
3. **Realised, not EV-adjusted.** An upward run is preserved intact in a realised figure. Neither
   challenge reports an all-in-adjusted line. Over 100–300 hours the divergence is on the order of the
   whole quantity.
4. **Self-report inflation.** Independent of everything above, one live-tracking publisher notes that
   *"even honest poker players tend to distort the truth about their poker results"* — an assertion,
   recorded as one, but consistent with mechanisms 1–3.

### 7.3 Sizing it, and the shape of the upper tail

**Where in the distribution does 20 bb/hour sit?** The one published upper-tail shape is #27's NL100
online 6-max regulars — players already filtered to **5,000+ hands**, n = 2,181:

| Threshold | Share of *regulars* |
|---|---|
| ≥5 bb/100 | 23.6% |
| ≥10 bb/100 | 7.2% |
| **≥20 bb/100** | **0.69%** |

That is a different game (online, 6-max, NL100) and the thresholds are bb/**100**, not bb/hour — the
live equivalents in bb/100 are several times larger because live pace is several times slower. It is
included for the **shape**: the tail falls off by roughly a factor of three per doubling. Applying
that shape to the live band, if 8–12 bb/hour is the top few percent, **18–22 bb/hour is a small
fraction of that few percent** — which is exactly why one coach's 300-hour run at it made the
poker press.

**A cruder anchor from this document's own numbers:** the population mean at live $1/$2 is about
**−6 to −9 bb/hour** (the drop, §6, at H=30–40, before any skill differential), and the best
documented result is **+18 bb/hour**. Under the measured 3–4× realised-to-true multiplier, the
strong-regular band of 8–12 bb/hour is where roughly the top **7–10%** of seated players live, and
20 bb/hour is not a band at all — it is an individual.

**Bias-corrected reading.** Take Goone's 17.9, apply the publication effect (+0.5 to +1.5 SE, i.e.
2–7 bb/hour at his sample size), keep the rakeback excluded because it is not poker, and transfer
down two stake levels at a cost of 1–2 bb/hour in extra drop: **a sustainable elite rate at live low
stakes is 10–16 bb/hour**, and a strong regular is **8–12**. persuadeo, unprompted, projects his own
reversion to **15**. Three independent routes to the same place.

**A survivorship-uncorrected number is not a benchmark**, and the 20 is uncorrected twice over —
once for selection, once for sample.

### 7.4 The second layer: the published set is not a sample of winners, it is a sample of winners *who publish*

Everything in §7.1–7.3 corrects for one thing: **winners publish more than losers.** That factor is
measurable and was measured (3–4×). It is not the larger problem.

The sharper problem is that **publishing is correlated with playing a different game**, and the 3–4×
factor does **not** correct for it — that factor was computed on *tracker populations*, where nobody
had a channel. These are two distinct corrections, stacked, and only the first is quantifiable.

Four mechanisms, all pushing reported rates **upward**:

1. **A player with an audience is not playing the founder's game.** Streamed or filmed tables, curated
   line-ups, elevated stakes, straddles, and bomb pots. Goone's own game is described as carrying
   *"plenty of straddles and PLO double-board bomb pots"* — and note that Hustler's own regulatory
   filing (§6.1) lists **Double Board Omaha** as an approved game with its own collection schedule, so
   that is a structural feature of the room, not a one-off. A table with a straddle on is playing
   deeper in big-blind terms and faster; a table with bomb pots is not playing NLHE.
2. **Content is the income.** A vlogger's or coach's poker rate need not be their livelihood. That
   changes stake selection, session length, and risk tolerance in ways a grinder's does not — and it
   removes the constraint that makes a losing month matter.
3. **A challenge is a performance.** *"Can I make $100/hour"* commits the player publicly to a target
   before the sample begins. That is a reporting incentive stacked on top of a play incentive, and it
   operates on which sessions get counted, when the challenge is declared finished, and whether a
   rebate gets folded into the headline (it did — §4).
4. **The silent winning regular is invisible, and is the more representative population.** Someone
   beating $1/$3 for 8 bb/hour has no reason to post, no channel to post on, and an active reason not
   to: their edge depends on the game staying as it is. **The best-informed people in this population
   are the ones structurally least likely to appear in it.**

**This layer cannot be quantified from anything found here, and no attempt is made to.** Its direction
is known (upward), its size is not, and it is **additive to** the 3–4× factor rather than included in
it. The honest statement is that the published live record is biased upward by a measured factor of
3–4× *plus* an unmeasured amount, and that the second term is plausibly the larger of the two.

**This is the strongest single argument for §8.3's ordering** — the drop line is a venue-published
fact requiring **no self-report at all**, which makes it the one quantity in this entire study immune
to both layers.

### 7.5 What does not exist, and why that is itself the answer

- **No live cash-game population winrate distribution has ever been published**, in any form, by any
  operator, regulator, tracking site or researcher. The only per-player live database found anywhere
  (#24) is 242 players pre-selected for *being winning TAGs*.
- **No poker operator has ever published a winner-fraction breakdown.** The PokerStars data in #26
  reached the public only because a criminal defence team put it in evidence.
- **The folk figure "10–15% of players are long-term winners" has no traceable original study.** It
  was searched for specifically. The nearest anchor is Heeb's *"10 percent to 20 percent"* concession
  under cross-examination in *DiCristina* — **oral testimony, not a computed statistic**, and it
  postdates the folk claim. Every other instance traces to someone filtering their own tracker
  database with no sample stated. **Do not cite it.**
- **The three best population datasets are online, 2009–2011** — the same era and modality as this
  repo's own HandHQ corpus. So the external evidence **reinforces rather than relieves** the
  transferred-not-measured problem. There is no live population number waiting to be found; there is
  an absence.

That absence is the strongest single argument in this document against any external winrate serving
as this repo's scale test.

---

## 8. Recommendation: what the repo should use as a scale test

### 8.1 Retire 20 bb/hour as *the* scale test — but record why, because it is not "wrong"

WS-417's accept criteria offer three outcomes: evidenced, corrected, or retired. This research
supports a fourth shape that the ticket's framing did not anticipate, and it should be recorded
precisely:

> **EVIDENCED AND STILL UNFIT.** The figure is real (Marc Goone, 300 h, $5/$5, $89.61/hr = 18 bb/hr;
> persuadeo, 100 h, $1/$3, 18.8 bb/hr). It is not a units error and the "$40/hr at $1/$2" correction
> should **not** be applied. It is unfit as a scale test because it is a *total realised* rate at a
> *higher stake* from the *top of a selection-biased distribution* with a 95% interval spanning a
> factor of two — measured against an *incremental modelled transferred ceiling*.

Recording it as "corrected to $/hr" would put a false statement in the repo. Recording it as
"unevidenced" would too. The honest disposition is **evidenced, cited, and demoted from denominator
to context.**

### 8.2 Prefer the post the repo already owns

ADR-009 already defines the right object. **Pool Best Response is the upper pier post**, and
**exploitation efficiency** is a hole's share of the edge PBR captures on the same corpus. That
quantity is measured on the same data, in the same units, on the same axis, and it survives an engine
upgrade — which is the entire reason the pier posts were defined that way.

**A Hole Map row's scale test should be its share of PBR's edge, not its share of a stranger's
winrate.** An external winrate can appear as a transferred sanity ceiling carrying the same
`transferNote` machinery the pace conversion already carries — never as the denominator.

### 8.3 If an external post is wanted anyway, use a three-post ladder in bb/100, never a point

In the repo's native currency (POKER_THEORY §14.1: events per 100 hands; `overallEvBB100` in bb/100),
at a **stated** pace, each post labelled by kind:

| Post | bb/100 @25 | bb/100 @30 | bb/100 @40 | Kind | Best grade behind it |
|---|---|---|---|---|---|
| **Drop line** — what every seat pays | 20–29 | 20–29 | 20–29 | **Measurable by the founder**, pace-independent | **A** (Selbrede) + posted schedules |
| **Strong regular** | 32–48 | 27–40 | 20–30 | Transferred, consensus of 4 named practitioners | **C** |
| **Documented ceiling** | 72–88 | 60–73 | 45–55 | Transferred, 2 events, sample-limited, selection-selected, one at a higher stake | **B** |

The drop line is first deliberately, and §6.1 and §7.4 together make the case stronger than it was
when this section was drafted:

- **It requires no self-report, so it is immune to both selection layers.** Every winrate in this
  document is filtered twice — once by winners publishing more than losers (measured, 3–4×) and once
  by publishers playing a different game (unmeasurable, §7.4). A posted fee schedule is filtered by
  neither. It is the only quantity here with that property.
- **It is published by the venue whether or not any player mentions it**, as §6.1 demonstrates by
  recovering Goone's from the California regulator's own files after every player source omitted it.
- **It is pace-independent in bb/100**, unlike every bb/hour figure in the study.
- **It answers the founder's actual question better than a winrate does.** *"Is +0.35 bb when it
  occurs a fifth of a good player's edge or a rounding error?"* — the drop line is the thing a hole
  has to beat before it is worth anything at all, and it is a fact about his room rather than a claim
  about a stranger.

### 8.4 Say it plainly: no single number should serve as the scale test

The founder's question is legitimate and the instinct behind it is right. But a scale test is a
ratio, and **both** of its parts are currently soft:

- The **denominator** varies by 2× across the credible band (8–22 bb/hour) and its best-documented
  value carries a 95% interval of roughly [7, 29].
- The **conversion** varies by 60% across the credible hands-per-hour range (25 measured-by-nobody
  vs 40 measured-by-Selbrede).

A ratio with ±60% in the denominator and ±50% in the numerator does not discriminate "a fifth of a
good player's edge" from "a rounding error" — which is exactly what it was introduced to do. The
honest instrument prints the **band** and lets the row fall where it falls.

There is also a reason that has nothing to do with uncertainty: **a scale test presumes the thing it
scales against is a stationary parameter, and the sources say it is not** (§2.2). The best-specified
ledger in the record splits its own continuous 1,200 hours into 2.8 then 11.9 bb/hour. A player's
"rate" is not a constant of the player; it is a property of a stretch of time, a room, a stake and a
lineup, all of which move. Denominating a hole against one is denominating against a moving object.

And there is a harder reason, from §7.4: **there is no live population winrate distribution to
calibrate against — not a scarce one, an absent one.** No operator, regulator, tracking site or
researcher has ever published one. Every candidate scale test is therefore either a transferred
online figure from 2009–11 (the same era and modality as this repo's own corpus, so it does not
relieve the transfer problem) or a handful of self-published elite results. **The honest answer to
"what single number should the scale test be" is that there is no such number, and building the
instrument as though there were is how a transferred figure acquires the authority of a measured
one.**

### 8.5 Two concrete code changes this research supports

1. **`DEFAULT_HANDS_PER_HOUR = 25` (`holeMap.mjs:403`) is the lowest figure in the literature and the
   one with no measurement behind it.** The only measured value found is **40** (Selbrede, ~1,000
   hands, 4 Las Vegas rooms). Either raise it and cite, or — better — make it a **range** and print
   bb/hour at both ends. The current comment, *"Live 9-handed is roughly this"*, should carry the
   citation and the fact that the convention is unsourced.
2. **If the bb/hour column survives, it must not print a single pace.** WS-417's second decision flag
   already floats dropping bb/hour entirely in favour of the pace-free bb/100 figure. This research
   strengthens that option: bb/hour existed *only* to satisfy the scale test, and the scale test does
   not survive contact with its own evidence in the form it was written.

---

## 9. Vocabulary NOT adopted

Per the founder's constraint — *"they use language we should only look to and quantify, not to set a
standard for. our standard needs to be as organic as it possibly can."* — the following were
encountered and **deliberately left outside the repo**. Their absence is a decision, not an oversight.

**Tier and label vocabulary — not imported:**
- "recreational winner", "strong regular", "crusher", "crushing the game", "elite", "the absolute
  pinnacle", "achievable vs elite" tables. *Used in §2 and §8 only as quoted source language inside
  quotation marks, never as a repo category.* The repo's own population unit is the **Stratum** —
  a quantile interval on a separability-proven axis — precisely because named tiers re-import
  thresholds the data cuts through.
- "$100/hour challenge", "prop bet", "the Goone target" as goal shapes.

**Metric framings — not imported:**
- **bb/hour as a primary unit.** The repo's currency is per-100-hands (§14.1). bb/hour is a
  presentation conversion carrying a pace assumption, and this document treats it as such throughout.
- **"BB" (big bet, = 2 big blinds)**, the legacy limit-hold'em notation. Encountered as a live
  ambiguity risk; never used. All "bb" here is one big blind.
- **"true win rate"** — a source-side term implying a single knowable scalar. The repo already has
  the better object: an estimate with an interval and a stated sample.
- **"rakeback" folded into a winrate.** Recorded as methodology metadata in §4; explicitly refused as
  part of any EV figure.
- Rules of thumb like *"20–30k hands already gives you a decent idea of your bb/100"* — arithmetic
  contradicts them (§5) and they are not adopted.
- **"Critical repetition frequency"** (Fiedler & Rock) — a named threshold for when skill dominates
  luck. The *quantity* it points at (~1,000–1,500 hands) is used in §5/§7 via the PLoS measurement;
  the term and the concept are not adopted, because this repo already expresses the same idea as a
  standard error against a stated σ, which carries its assumptions visibly.
- **"Regular" / "TAG" / "skill percentile"** as population units. Used in §2 and §7 only as quoted
  source language. The repo's population unit is the **Stratum**, which requires separability
  evidence from the same run before it gets a row.
- **"Rakeback"** and **"equity rake"** as accounting categories. The quantities are used; the
  categories are not imported into the EV pipeline.

**Domain claims — not imported, at all:**
- Every strategic claim attached to a number was discarded and only the number kept. Specifically
  refused: Pokerati's characterisation of the low-stakes field (*"call too much preflop, squeeze with
  polar ranges, significantly under-4-bet"*); Goone's sizing doctrine (*"choose a bet size where your
  opponent will raise off their strong stuff and call with their weak stuff"*); any source's account
  of what "the biggest leak at $1/$2" is. **These are Field claims. This repo measures its Field on
  its own corpus or it does not have one.** Importing another author's field description as doctrine
  is the exact mechanism ADR-009 exists to prevent.
- **"Leak"** already has a binding definition in this repo (per-stratum, two ranked definitions,
  never a bare per-player ranking). External usages of the word encountered in this pass are a
  different object and are not merged with it.
- **"Game selection"** as a strategy category. It is load-bearing in the sources' explanations of
  their own results (and is noted in §7 as a *bias mechanism*), but it is not adopted as a concept
  the engine reasons about.
- **"Variance"** used loosely as a synonym for bad luck. Used here only in its statistical sense.

---

## 10. Sources

All accessed **2026-08-05**.

**Grade A — measured**
- Steve Selbrede, "The Impact of Rake in Low-Stakes Cash Games", PokerNews, 2019-02-06 — https://www.pokernews.com/strategy/the-impact-of-rake-in-low-stakes-cash-games-33298.htm
- R. J. Potter van Loon, M. J. van den Assem & D. van Dolder, "Beyond Chance? The Persistence of Performance in Online Poker", *PLoS ONE* 10(3):e0115479, 2015 — https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0115479 · https://pmc.ncbi.nlm.nih.gov/articles/PMC4346402/
- *United States v. DiCristina*, 886 F. Supp. 2d 164 (E.D.N.Y. 2012), Weinstein J. — expert analysis of 415M PokerStars hands (Heeb) and the opposing reading (DeRosa) — https://www.govinfo.gov/content/pkg/USCOURTS-nyed-1_11-cr-00414/pdf/USCOURTS-nyed-1_11-cr-00414-1.pdf

**Grade B — player results with stated samples**
- Tadas Peckaitis, "Is Live Poker Still Beatable in 2025? Here Is the Truth!", Pokerati, 2025-01-03 (Goone's final 300-hour figures) — https://pokerati.com/2025/01/is-live-poker-still-beatable-in-2025-here-is-the-truth/
- Tadas Peckaitis, "Can Marc Goone Win $100 per Hour at Low-Stakes?", Pokerati, 2024-11-26 — https://pokerati.com/2024/11/can-marc-goone-win-100-per-hour-at-low-stakes/
- "Marc Goone Hits $115 an Hour in Low Stakes Challenge", GipsyTeam, 2024-10-30 — https://www.gipsyteam.com/news/30-10-2024/marc-goone-hits-115-an-hour-in-low-stakes-challenge
- Chris Murray (persuadeo), "100 Hours of One-Three, Conclusion", Out of Position, 2024-08-18 — https://persuadeo.nl/100-hours-of-one-three-conclusion/
- Chris Murray, "100 Hours of One-Three, Part II", 2024-05-29 — https://persuadeo.nl/100-hours-of-one-three-part-ii/
- Chris Murray, "So You Want to Play 100 Hours of One-Three", 2024-05-05 — https://persuadeo.nl/so-you-want-to-play-100-hours-of-one-three/
- Primedope cash-game variance calculator (SD conventions, sample-size arithmetic) — https://www.primedope.com/poker-variance-calculator/
- Tom "Tombos21" Boshoff (GTO Wizard), population report with Bayesian shrinkage, ~2025, via GipsyTeam 2025-12-12 — https://www.gipsyteam.com/news/12-12-2025/number-of-winning-cash-game-players *(primary GTO Wizard article not locatable Aug 2026; site, dates and hand count undisclosed)*
- Jim James, "What Percentage of Poker Players Win?", Automatic Poker, 2018-12-19 — https://automaticpoker.com/lifestyle/what-percentage-of-poker-players-win/
- multipotentialmike, "Poker variance denoising" — the only σ computed from a hand database — https://multipotentialmike.org/poker_variance_denoising
- Hand2Note, "Online vs Live Poker Insights" (live per-player database) — https://hand2note.com/Blog/Databases/online-vs-live-poker-insights
- J. Hergueux & G. Smagghue, learning-in-poker panel (91,439 players, >85M hands, Adda52, 2015–18) — https://www.research-collection.ethz.ch/server/api/core/bitstreams/f86128bb-b912-4095-a5d5-cbad6f784241/content
- S. D. Levitt & T. J. Miles, "The Role of Skill Versus Luck in Poker", *J. Sports Economics* 15(1), 2014 — **tournaments, not cash**; checked and not used for winrates — https://pricetheory.uchicago.edu/levitt/Papers/WSOP2011.pdf

**Grade C — named practitioners, no sample**
- James "SplitSuit" Sweeney, "How Much Can I Win Playing Live Poker?" — https://www.splitsuit.com/how-much-can-i-win-playing-live-poker
- Nathan Williams (BlackRain79), "What is a Good Poker Hourly Rate?", 2018, updated 2026 — https://www.blackrain79.com/2018/06/good-poker-hourly-rate.html
- "BB Per Hour: The Only Honest Way to Measure Live Poker Results", PokerCharts — https://pokercharts.com/en/blog/bb-per-hour-the-honest-way-to-measure-live-results
- Alton Hardin, "Understanding Win Rates in Poker", MicroGrinder, updated 2022-08-24 (bb vs BB notation) — https://microgrinder.com/poker-strategy-articles/introduction-to-win-rates/
- "Poker Winrates | What Is A Good Win Rate?", ThePokerBank (online reference point) — https://www.thepokerbank.com/strategy/other/winrate/
- CardsChat, "What's an acceptable win/rate at $1/$3?", Jul 2023 — https://www.casino.us/cardschat/live-poker-75/whats-acceptable-win-rate-at-1-527596/
- Bart Hanson, "Winrate in correlation to time played", Crush Live Poker, 2013-05-28 (checked — contains no numbers) — https://crushlivepoker.com/articles/winrate-in-correlation-to-time-played

**Grade D — secondary, unsourced or self-contradictory**
- ManageBankroll, "BB/Hour in Poker: What's a Good Win Rate?" — https://managebankroll.com/blog/what-is-bb-per-hour-poker-win-rate-explained *(HTTP 429 on direct fetch; figures taken from the search index, not a page read end to end — treat accordingly)*
- Arved Klöhn, "How to Beat Variance in Poker Live and Online", PokerListings, updated 2026-07-24 — https://www.pokerlistings.com/poker-strategies/cash-game-nl-holdem/variance-and-poker-pt-1-how-good-cash-game-players-outrun-luck
- PracticalWebTools, "Win Rate Calculator Guide 2026", 2026-01-29 — https://practicalwebtools.com/blog/win-rate-calculator-guide-2026

**Individual tracked ledgers (§2.1)** — r/poker, recovered via the PullPush archive API and the
Wayback Machine (direct Reddit fetches are blocked). Prefix each with `https://www.reddit.com/r/poker`:
- R1 `/comments/pl4ml8/` · R2 `/comments/104ksvg/` · R3 `/comments/1efw79z/` · R4 `/comments/1kaaazg/`
- R5 `/comments/1kzpxrz/` · R6 `/comments/15h4lc0/` · R7 `/comments/1h3vkf9/` · R8 + R9 `/comments/1iu1vrm/`
- R10 `/comments/152pbm8/` · R11 `/comments/1hrc5v3/` · R12 `/comments/1enf4ul/` · R13 `/comments/6xyfys/`

**Hands per hour**
- Selbrede (above) — the only measured figure, 40 h/hr
- "Cash Game — Hands Per Hour", Poker Chip Forum, 2023-01-30 (counted sessions: 29, 30, 30–35) — https://www.pokerchipforum.com/threads/hands-per-hour.100585/
- Geoffrey Fisk, Upswing Poker, 2020-02-05 (asserts 25–30) — https://upswingpoker.com/hands-per-hour-live-poker-vs-online/
- Akila, PokerPro, 2026-07-22 (asserts 25–30, "call it 27") — https://pokerpro.tools/articles/how-many-hands-per-hour-live-poker
- Jim James, Automatic Poker, 2019-02-01 (asserts 20–30 live; his *online* figures are measured from his own HM database) — https://automaticpoker.com/poker-basics/how-many-hands-per-hour-in-poker/

**Rake, jackpot drop, tips, and time collection**
- Ashley Adams, "Let's Look at the Rake (and Time Charges)", PokerNews, 2017-08-07 — https://www.pokernews.com/strategy/lets-look-at-the-rake-and-time-charges-28692.htm
- Brandon Bloom, "Comparing Rake Across Las Vegas Poker Rooms", PokerNews, 2023-07-31, upd. 2025-05-03 — https://www.pokernews.com/news/2023/07/comparing-rake-across-las-vegas-poker-rooms-44211.htm
- **Hustler Casino approved game rules and collection schedules**, filed with the California Bureau of Gambling Control, 362 pp. — https://oag.ca.gov/system/files/media/hustler-casino.pdf *(the primary regulatory source for Goone's venue; No Limit/Pot Limit collection schedule at pp. 161/231–232, statutory recital of Cal. Penal Code §337j(f) at p. 70. Index of all California cardroom filings: https://oag.ca.gov/gambling/cardroomlist)*
- California Bureau of Gambling Control approved collection schedule, Kings Card Club (GEGA-004248/004250), Apr 2015 — https://oag.ca.gov/system/files/media/kings-casino.pdf *(second regulatory source; flat per-hand collection, no percentage permitted)*
- Barry Carter, "Rake & Rakeback Explained", GTO Wizard, 2024-07-23 (Texas seat rental) — https://blog.gtowizard.com/rake-rakeback-explained-optimize-your-poker-earnings/
- "Live Poker in Texas", Pokerfuse, 2026-02-09 — https://pokerfuse.com/live-poker/united-states/poker-in-texas/
- Will Shillibier & Tyler Boyer, "The Complete Guide to Tipping in Poker", PokerNews, 2026-01-09 — https://www.pokernews.com/news/2026/01/the-complete-guide-to-tipping-in-poker-49978.htm
- Earl Burton, "The Great Poker Tipping Survey of 2020", Cardplayer Lifestyle, 2020-03-15 *(n ≈ 24, author states it is "not completely scientific")* — https://cardplayerlifestyle.com/poker-lifestyle/to-tip-or-not-to-tip-the-great-poker-tipping-survey-of-2020/
- Jonathan Little, "Why most players lose at poker – the rake", 2016-06-13 — https://jonathanlittlepoker.com/rake/

**Checked and deliberately NOT used** — recorded so a future session does not re-open them:
- **Fiedler & Rock (2009)**, "Quantifying Skill in Games" — SSRN and publisher both HTTP 403 in Aug
  2026. It establishes a "critical repetition frequency" of ~1,000 hands; it does **not** report a
  winner fraction or a winrate distribution, and search engines conflate it with #25's 32%.
- **Levitt, Miles & Rosenfield (2013)**, 101 Geo. L.J. 581 — PDF 403; the one figure recoverable at
  second hand ("one in six players was profitable without controlling for the rake", ~16.7%) is a
  large outlier against every other pre-rake figure (30–37.5%) and its sample is not described.
- **Croson/Fishman/Pope (2008)**, **Meyer et al. (2013)**, **DeDonno & Detterman (2008)**,
  **Schoenberg** — all checked; none contains a population winrate distribution.
- **Selbrede, *The Statistics of Poker*** — 6,000,000 hands, but **online** full ring, and it reports
  strategy frequencies rather than variance.

**Searched for and NOT FOUND** — the absences are load-bearing (§7.4):
- Any **live** cash-game population winrate distribution, from any operator, regulator, tracking site
  or researcher. **None exists.**
- Any live-poker result set published as a ledger or graph with >1,000 hours. None.
- Any **measured** live-NLHE standard deviation. Every σ in §5 is asserted, derived, or online.
- Any cash-game shot-clock pace trial. None published.
- Any source separating live pace by table size (8 vs 9 vs 10) with data. None.
- ~~Any player reporting a losing lifetime live winrate with a stated sample~~ — **CORRECTED: four
  exist** (§7). They surfaced only in the individual-ledger sweep, not in any coach or publisher
  source. The original "none" reflected which half of the record had been searched, which is the
  bias operating on the researcher as well as on the sources.
- Any 2+2 forum data. **Cloudflare-gated and absent from the search index** — unrecoverable by the
  methods available here, and a known hole in this document's coverage.
- Any source stating **table size** other than the two named in §2.2. The 9-handed filter cannot be
  applied to this literature.
- Aggregate winrate distributions from live bankroll-tracker apps. None of the major apps publish
  cross-user aggregates. SharkScope's winner/loser graphics cover opt-in **tournament** players only
  — itself an instance of the bias being measured.
