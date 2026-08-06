# Published strategy material, graded on whether it can be encoded as a scoreable arm

Date: 2026-08-05 · Program: `methodology-integrity` · **Availability survey — no ticket claimed**
Precedent this follows: POKER_THEORY **§11.9** · `scripts/backtest/teachableArmsProbe.mjs` · `scripts/backtest/run-teachable-arms.mjs`
**Paired deliverable — the harness this feeds:** `docs/standard-of-record/DECLARED-ARM-SCORING-SPEC.md` (WS-425) · `scripts/backtest/strategyArm.mjs`. *That* document answers "which harness, at what cost"; **this one answers "what material exists, in what form."** Read §8 against its §1.
Sites this bears on: `scripts/backtest/equilibriumPost.mjs:54` (`EQUILIBRIUM_POST = null`) · `src/utils/pokerCore/rangeMatrix.js:200` (`PREFLOP_CHARTS`) · `src/utils/pokerCore/boardTexture.js`
Open queue items this speaks to: **WS-237** (relabel "GTO-approximate" charts as published-reference, stamp provenance — this document supplies the provenance and the answer is *there is none*) · **WS-114** (multiway postflop corpus gap — §8 establishes the gap is not procurable)
All sources accessed **2026-08-05**. **No Result Card**: this document makes no comparative claim about any surface
in this repo. It is an availability survey. Nothing in it has been run against anything.

> **BINDING CAVEAT, REPEATED AT EVERY NUMBER BELOW.** Every figure in this document is a
> **third party's assertion, or a third party's solve of a game that is not the founder's game**.
> None of it was measured by this repo, on this repo's corpus, or in the founder's game. A published
> strategy here is **an ARM, not a source of doctrine**: it gets encoded as a decision rule, run
> against the same decision set through the same estimator as everything else, and scored in our
> currency. *Whether the author is right is not the question. What their rule is worth on our data is.*
>
> Founder's standing constraint, verbatim: *"they use language we should only look to and quantify,
> not to set a standard for. our standard needs to be as organic as it possibly can."* This document
> extracts **predicates and numbers**. It imports **no taxonomies, category names, or conceptual
> frames**. See §6 for the list of what was deliberately left outside.

---

## Verdict, up front

**1. There is no credible published equilibrium baseline for the founder's game, and there will not be one.**
Not because nobody has solved it — because **nobody can**. Every open-source solver in existence
(`postflop-solver`, `TexasSolver`) is **two-player postflop only**. Every commercial solution
library that covers "live" tops out at **8-max**, prices rake at a single stated structure, and is
paywalled behind a subscription with no data export at the free tier. The one genuine 6-player
superhuman agent, **Pluribus**, was **deliberately withheld** and remains so. `equilibriumPost.mjs`
is correct to return `null`, and this survey did not find the thing that would let it stop.

**But the frame is obtainable in a narrower form than the ticket assumed, and cheaply.**
`b-inary/postflop-solver` is AGPL-3.0, callable as a Rust library, and it is *the same engine* that
produced the postflop half of PokerBench. It supports **bunching effects for up to four folded
players**, which is exactly the 9-handed card-removal correction the repo would otherwise have to
invent. What it cannot do is rake or multiway pots. So the honest statement is: **a heads-up,
rake-free, postflop equilibrium for named spots is computable by us in-house today; a 9-handed live
raked equilibrium is not obtainable by anyone.** SRC-013 should be re-scoped to the first, or stay null.

**2. One artefact matches the founder's table size, is free, is grade A, and is legible: RangeConverter's
9-max 100bb Live Cash chart set.** An 18-page PDF, retrieved and read in full, with **exact per-seat
RFI frequencies** (UTG 10.09% … BTN 40.49% … SB 46.36% at a 3.0bb open), legible grids, and coverage of
facing-an-RFI and facing-a-3-bet as well. It is **9-handed — not 8, not 6** — which nothing else free
is. Its two holes are that the solver is unnamed and **the rake is unstated** (the same vendor names
rake on its 6-max charts). An early pass in this survey graded it "images, blocked" and **that was
wrong**; the correction is recorded at §2.6 because the error is instructive.

It also arrives with the **only independent convergence found anywhere in this survey**: Upswing's
separate "Live Cash 9-Handed" chart gives **UTG 10.2% / BTN 40.8%** against RangeConverter's
**10.09% / 40.49%**. Two vendors, neither naming a solver, agreeing to 0.3 points at both ends — against
a 45% spread among the free text charts.

**3. The largest artefact found is not a chart at all. It is a labelled decision set.**
**PokerBench** (arXiv:2501.08328, Apache-2.0, HuggingFace `RZ412/PokerBench`) is **571,000 poker
decisions with solver-derived action labels and a full structured game-state schema**. Preflop labels
come from **GTO Wizard** (named), postflop from **WASM-Postflop** (named, = `postflop-solver`).
6-max, 100bb, no rake. It is the only source that is simultaneously (a) free, (b) machine-readable,
(c) provenance-complete on solver identity, and (d) large. Its defects are severe and specific —
argmax-only, no rake, 6-max — and all four are §3-nameable parameters.

**4. Every "GTO preflop chart" that is free and transcribable has NO provenance whatsoever, and they
contradict each other flatly.** Three sites publish complete text-notation ranges. None names a
solver. None names a rake model. None gives a date. And their 9-handed UTG opening ranges span
**8.6% to 12.5%** — the widest is 45% wider than the narrowest — and disagree in *shape* in a way no
solver would produce (§2.9, widths computed, not quoted). They are encodable at
grade A and worth **nothing** as authority — which is precisely why running them as arms is the right
treatment. They are `Declared` surfaces in this repo's vocabulary, and the Standard of Record already
has the slot.

**5. The recurring collapse is real and it has a name: Doug Polk.** `lucidgto.com` → `upswingpoker.com`
→ `lucidpoker.com` is a live 301-chain, and Doug Polk is the named founder at the end of it. Upswing
Poker and Lucid are **one source, not two**. The postflop corpus collapses further, to **five
lineages** — Chen & Ankenman, Janda, one PioSolver configuration worked by one author, Lucid, and
Flynn/Mehta/Miller — and six sites publishing an identical MDF table cite **nobody**, including each
other. (§5.)

**6. Postflop, the inversion: what encodes cleanest teaches least.** Every grade-A postflop item found
(MDF/alpha, river bluff:value, required equity, geometric sizing, multiway defence, SPR stack-off
equity) is **true by construction** — arithmetic the repo mostly already has, in two places with
better-stated premises. Every item that would actually test the engine — c-bet frequency by texture,
sizing by texture, barrel frequency, value thresholds — is **exactly what the field cannot specify**.
The variable the corpus reasons with most and defines least is **"nut advantage"**, which is the
single load-bearing term in the one real c-bet table anyone published. (§2.10, D8.)

**7. The most valuable postflop number is one that contradicts the doctrine built on it.** w34z3l's
HM2/PT4 database gives fold-to-c-bet at **39% on drawy boards and 43% on dry** — four points apart,
against a field that prescribes bet sizing off texture. It is one of only **two** measured-from-hands
claims in the entire postflop survey (both without sample sizes). **The repo can falsify or confirm it
today** from its own 10.6M-decision fold-vs-size curves split by `wetScore`, and that is a better use
of it than adopting it. (§2.15.)

**8. THE FINDING THAT MATTERS MOST, and it is about the field rather than about any source in it.**
The repo's Suspected-Fault Register ranks first the entry that **the founder's game is live 9-handed
$1/$2–$1/$3 while the corpus is online 2009 — so any live claim anchored on it is transferred, not
measured.** This survey establishes that **the same fault runs through the entire published field,
including the authors who put "Live" in the title:**

- The best live-targeted author (**Selbrede**) states his sample **to the hand — 6,000,000 —** for
  every *online* figure and **never once** for a *live* one, and one article describes his live basis
  as *"just a few hundred live hand histories"*.
- The best-sampled live dataset (**Hand2Note, 1,023,168 hands**) is **streamed $2/5-and-up winners**,
  not the $1/$2 population.
- The one genuinely live-measured full-ring corpus (**Red Chip**) is **paywalled with no disclosed n,
  ever**.
- The most numerically dense source (**Fitzgerald**) is **online MTT** with a HUD.
- The book titled *Exploitative Play in **Live** Poker* has **tournament hands in every worked
  example**.
- The only stat-by-stat full-ring table (**BlackRain79**) is **online micro**, and its values are
  **targets, not measurements**.
- **No published live postflop population statistic of any kind exists.** No live fold-to-cbet, no
  live WTSD, no live AF. Not at $1/$2, not at any stake.
- **No peer-reviewed live cash population study exists at all.**

**Two numbers in the entire corpus are backed by a stated live sample**: Doug Hull's 310 hours of
personal results, and Jonathan Little's *"5 documented sessions (20.8 hours)"*. Everything genuinely
live is unsampled assertion; everything well-sampled is online.

**The consequence for this repo is specific and it cuts two ways.** It is not that the repo is behind
the field — **the repo's 21.6M-hand corpus, its stated provenance, its census of unexamined cells and
its register of suspected faults put it materially ahead of everything surveyed.** But it also means
**no published source can be used to check the repo's live transfer**, because none of them measured
it either. The transfer gap cannot be closed by reading. It can only be closed by the founder's own
`Field` (SRC-014, live 1/3) accumulating — which makes that accumulation more load-bearing than this
document's entire source list.

---

## 0. The grading rubric, and why it has two axes

The ticket asked for one grade. One grade cannot carry this material, because the two things that
matter here come apart completely — the most perfectly encodable sources found are the ones with the
worst provenance. So every source below carries **two** marks.

### Axis 1 — ENCODABILITY (the requested A–D)

| Grade | Definition |
|---|---|
| **A** | Fully specified. Every input is an observable this repo already computes; every output is a number. Encodes with **no interpretation**. |
| **B** | Specified with gaps that a **stated assumption** can close. The assumption is recorded in §3 as a **named parameter**, so the arm's sensitivity to it can be swept and reported rather than buried. |
| **C** | **Directional only** — "bet bigger on wet boards". Encodable only by inventing the thresholds, which makes it **our arm wearing their name**. If encoded at all it must be labelled as ours. |
| **D** | **Unencodable.** Recorded, never discarded (§4). A prescription that cannot be turned into a predicate is a finding *about the prescription*. |

### Axis 2 — PROVENANCE (this document's addition)

| Mark | Definition |
|---|---|
| **P1** | Solver **named**, configuration stated (stack depth, rake, bet abstraction, format), artefact reproducible. |
| **P2** | Solver named OR sample stated, but configuration incomplete. |
| **P3** | Asserted "from solvers" or "from experience" with nothing checkable. Author known. |
| **P4** | Anonymous. No author, no method, no date. |

**A/P4 is the modal cell in this survey**, and that combination is the whole reason the arm treatment
exists: a rule can be perfectly precise and completely unwarranted, and the only way to find out
which it is, is to score it.

---

## 1. The graded source table

**41 sources graded. Tally by primary encodability grade: A = 23 · B = 12 · C = 3 · D = 3.**

**That tally is misleading on its own and the two-axis rubric is why.** Of the 23 grade-A sources,
**7 are mathematical identities** (true by construction, teaching nothing — §8), **4 are solver
*engines* rather than baselines**, and **11 carry provenance P3 or P4** (no solver named, or no author
at all). **Exactly one source in the survey is grade A on encodability, free, matched to the founder's
9-handed table, and legible: S28.** Read the two columns together or the table lies.

| # | Source | Population | Basis | Enc. | Prov. | What it yields |
|---|---|---|---|---|---|---|
| S1 | **PokerBench** — Zhuang et al., arXiv:2501.08328, Jan 2025; HF `RZ412/PokerBench`, Apache-2.0 | Online **6-max**, 100bb, **no rake stated** | **Solver-derived**: preflop = GTO Wizard; postflop = WASM-Postflop (`postflop-solver`, Discounted CFR, γ=3.0) | **A** | **P2** | 571k labelled decisions + structured state schema. §2.1 |
| S2 | **`b-inary/postflop-solver`** — AGPL-3.0, dev suspended Oct 2023 | **2-player postflop only**, no rake | Solver **engine**, not a baseline | **A** (as a generator) | **P1** | The route to a *narrow* SRC-013. §2.2 |
| S3 | **`bupticybee/TexasSolver`** — AGPL-3.0 + commercial | **2-player**, 1–2 bets + allin, no rake | Solver engine; "result aligned with piosolver", 0.275% accuracy benchmark, JSON strategy dump | **A** (as a generator) | **P1** | Second route to a narrow SRC-013. §2.2 |
| S4 | **GTO Wizard — "Classic (Live Cash)"**, blog post 2024-06-18 | **8-max live cash**, 100/125/150/175/200/250/300bb | Solver-derived; **engine not named** | **B** | **P2** | The only *live-configured* rake model found: **10%, 2bb cap**. Paywalled, images only. §2.3 |
| S5 | **GTO Wizard — straddle solutions**, same post | **8-max single straddle (0.5/1/2)**, 50–1000bb, ±0.5bb ante | Solver-derived; engine not named | **B** | **P2** | Rake structures NL400/NL100/NL25; opens 4x–7x. Paywalled. §2.3 |
| S6 | **Pokerati preflop charts** — pokerati.com | **Live 9-handed full ring**, 100bb & 200bb | **Asserted**: "advanced poker solvers and input from professional players". No solver, no rake, no date. | **A** | **P4** | **Complete 9-handed text ranges, both depths.** The only one found. §2.4 |
| S7 | **Preflop Wizard blog** — preflopwizard.app | **9-max/"live"** 100bb, and 6-max 100bb | Asserted "GTO". No solver, no rake, no date, no author. | **A** | **P4** | Complete 9-max RFI + 3-bet ranges; 6-max BB defence. §2.5 |
| S8 | **RangeConverter free charts** | **9-max 100bb full ring**; **8-max straddle 200bb** | Solver-derived, **engine not named**; rake **named by site** (100z, 500z, GG 200NL) | **B** | **P2** | Frequencies "rounded to 50%" for memorability. PDF images. §2.6 |
| S9 | **FreeBetRange library** | 6-max & 9-max NLHE cash | **HoldemResources Calculator (HRC)** — solver named | **B** | **P2** | Images only; account required. §2.6 |
| S10 | **Upswing / Lucid (Doug Polk)** | Lucid "Live Cash" = **150bb, straddle preflop, with/without rake**; **NOT 9-handed**. Upswing publishes a "Live Cash 9-Handed" chart image. | Solver-derived, engine not named. "100M+ solved hands" | **C** free / **B** paid | **P3** | Exports GTO+/Flopzilla format — **the only machine-readable export found** — but paid. §2.7, §5 |
| S11 | **Sklansky–Malmuth hand groups** — *Hold'em Poker for Advanced Players*, 2+2 | **Live full ring**, pre-2000 era | **Asserted** from experience | **A** in principle | **P3** | **Blocked**: withdrawn from the open web at 2+2's request. §4 |
| S12 | **Pluribus** — Brown & Sandholm, *Science* 2019 | **6-player** NLHE — the closest format match in existence | Solver-derived (blueprint + real-time search) | **D** | — | **Strategy never released.** §4 |
| S13 | **DeepFold "complete guide"** — deepfold.co | 6-max 100bb | Asserted | **C** | **P4** | Ranges given as *prose descriptions* ("Add Axs, Kxs, lower SCs") not notation. §2.8 |

### Postflop sources

| # | Source | Population | Basis | Enc. | Prov. | What it yields |
|---|---|---|---|---|---|---|
| S14 | **Upswing "GTO C-Bet Quiz Answers"** — author uncredited, undated | Online **6-max**, SRP, raiser vs BB. Stakes/era/depth unstated. | **Solver-derived, PioSolver** | **A** (within its 10 boards) / **C** between them | **P2** | **The only published c-bet frequency table keyed to named boards.** §2.10 |
| S15 | **Upswing podcast ep4** — Gary Blackwood + Mike Brady, undated | Online cash 6-max, 100bb, HU postflop | Solver-derived, engine unnamed | **B** | **P3** | C-bet frequency by texture *class*. §2.11 |
| S16 | **Upswing ep24 (c-betting OOP)** — Brady + Blackwood | CO/HJ vs BTN, 6-max | Solver-derived | **B** | **P3** | Implies a **~49% equity range-check boundary**. §2.11 |
| S17 | **Upswing "Overbet Flop Tips"** — Dan B., 2024-04-12 | **Lucid GTO**, cash 100bb | Solver-derived | **A** | **P2** | **Four complete multi-street geometric sizing schedules.** §2.12 |
| S18 | **Upswing "Mechanics of C-Betting" (Phemo)** — Leo Song-Carrillo, 2025-10-24 | **Lucid**, BB vs BTN SRP, 50bb, board 9♣5♦3♥ | Solver-derived | **A** | **P2** | **The only published fold-elasticity curve vs bet size.** §2.13 |
| S19 | **Upswing "Check-Raising Strategies"** — Dan B., 2019-09-17 | **PioSolver**, online $1/$2 6-max | Solver-derived | **A** | **P2** | Check-raise frequency **as a function of c-bet size**. §2.14 |
| S20 | **Red Chip "C-Bets & Delayed C-Bets"** — Adam "w34z3l" Jones et al., 2017-09-12 | **Unstated pool**, online | **MEASURED** — Holdem Manager 2 / PokerTracker 4 database. **No sample size.** | **B** | **P3** | **39% fold drawy / 43% fold dry.** The most consequential number in the survey. §2.15 |
| S21 | **MDF / alpha corpus** — 6+ sites, incl. PokerCoaching (Jonathan Little, 2024-08-27), CoinPoker (Daugherty, 2024-11-06) | Universal (identity) | **Mathematical identity** | **A** | n/a | Complete MDF table, unanimous. §2.16 |
| S22 | **Janda via Upswing "Bluff-to-Value Ratio"** — Dan B., 2019-02-01, relaying Janda (2013) p.144 via Ryan Fee | Theoretical, polarized range, 75% pot | **Derived from theory** | **A** | **P2** | Street-by-street value shares **34.3% / 49% / 70%**. §2.17 |
| S23 | **Upswing multiway defence** — George Mathias, 2018-03-16 | Any n, any bet size | **Mathematical identity**: `fold_i = alpha^(1/(n−1))` | **A** | n/a | **The most directly reusable formula found for a 9-handed game.** §2.18 |
| S24 | **GTO Wizard blog corpus** — Tombos21, Andrew Brokos, Barry Carter, et al., 2022–2026 | Online 6-max cash + MTT, various depths | Solver-derived, engine unnamed | **B** singletons / **D** for the aggregate reports | **P2** | Per-board singletons; **aggregate tables are IMAGES**. §2.19 |
| S25 | **Red Chip SPR material** — SplitSuit + Zac Shaw, 2017-08-22, sourced to Flynn/Mehta/Miller *Professional NLHE* | **LIVE $2/$5** — the only live-populated numeric material found | **Asserted** from experience | **C** | **P3** | SPR commitment landmarks. §2.20 |
| S27 | **Upswing "Kanu7" series** — one solver run by **Alex Millar**, written up by Mike Brady across 4 articles, Dec 2019 – Jan 2020 | Online 6-max | Solver-derived, engine unnamed | **A** | **P2** | **The only aggregate c-bet/check-raise frequency table that survives text extraction.** §2.19 |
| S26 | **PokerSkill / BeyondGTO / RiverOdds** | — | — | **D** | **P4** | **Arithmetically wrong.** Recorded as errata. §4/D13 |

### Live low-stakes full-ring sources

| # | Source | Population | Basis | Enc. | Prov. | What it yields |
|---|---|---|---|---|---|---|
| **S28** | **RangeConverter "9 max 100bb LIVE Cash GTO Ranges"** — free 18-page PDF, 11.2 MB | **9-handed full ring, 100bb, labelled live cash** | Solver-derived, **engine unnamed**, **rake NOT stated** | **A** | **P2** | ⭐ **The best encodable artefact in the entire survey.** Exact RFI frequencies for all 8 seats + vs-RFI + vs-3bet. §2.21 |
| S29 | **Jonathan Little / PokerCoaching — full-ring cash 100bb** | Full-ring/8-max, 100bb. Live-vs-online **unstated** | Solver-derived, engine unattributed | **A** | **P3** | **Readable text ranges for 7 positions.** §2.22 |
| S30 | **Steve Selbrede** — *Donkey Poker* Vols 1–3, PokerNews column | **LIVE Las Vegas $1/$2 and $2/$5, full ring**, ~2015–17 | **ASSERTED (live n never stated)**; MEASURED for his online set (6M hands) | **A** on the rules / **C** on the population stats | **P3** | **The only published live $1/$2 population numbers that exist.** §2.23 |
| S31 | **Hand2Note Live Poker Database** | **LIVE streamed/broadcast, $2/$5–$100/$200. No $1/$2.** 2024–26 | **MEASURED — 1,023,168 hands / 37,894 players / 19 channels** | **B** | **P1** | The only live dataset anywhere with a stated n. §2.24 |
| S32 | **Doug Hull — personal $1/$2 records** | **LIVE $1/$2, Mirage LV**, one player | **MEASURED — 310 hours / 136 sessions** | **A** for what it is | **P1** | **The only published per-hour SD for live $1/$2.** §2.24 |
| S33 | **Ed Miller — *The Course*** (2015) | **LIVE $1/$2–$5/$10** US card rooms, full ring | **ASSERTED** — no database, no solver, no sample | **B** | **P3** | Positional open frequencies + one fully enumerated range. §2.25 |
| S34 | **Ed Miller — *Poker's 1%*** (2014) | **None** — frequency theory, not a population claim | **DERIVED** from indifference algebra | **B** | **P3** | The "defend ~70%" rule. §2.25 |
| S35 | **Alex Fitzgerald — *The Myth of Poker Talent*** | **ONLINE tournaments** (HM2 + Flopzilla, explicit) | **ASSERTED from an online HH database**, n never stated | **A** | **P3** | **The most numerically dense source found.** §2.26 |
| S36 | **Alex Fitzgerald — *Exploitative Play in Live Poker*** (2018) | Titled live; **every worked example is a tournament hand** | Asserted, informed by online HH databases | **B** | **P3** | Board classes + stack bands + fold-equity targets. §2.26 |
| S37 | **Doug Hull — *Poker Plays You Can Use*** | **LIVE $1/$2**, Mirage / Hollywood / charity | Hand examples; equities via **Flopzilla** | **A** on set-mining / **B** on the flop table | **P3** | 16-flop decision table; **least-copied, most live-native author found.** §2.27 |
| S38 | **SplitSuit / James Sweeney** | Live $1/$2 focus; author's basis is **online full ring** | **ASSERTED**, no sample | **A** on the models / **C** on ranges | **P3** | Live HUD sampling model, SPR bands, sizing formulas. §2.28 |
| S39 | **BlackRain79** | **ONLINE micro NL2–NL25**, ~2014–19. **Never live.** | Asserted; *"millions of hands"*, **never counted** | **A** on form / **C** on provenance | **P3** | **The only stat-by-stat full-ring vs 6-max split found.** §2.29 |
| S40 | **Upswing straddle/ante deltas** — Dan B., 2025-04-18 | 8-max, mandatory straddle + 0.5bb ante | Solver-derived, engine unnamed | **A** on the deltas | **P3** | **Four quantified straddle deltas + the opposing-sign mechanism.** §2.30 |
| S41 | **Red Chip — *How To Dominate Live*** (Kat Martin, 2025) | Live low-stakes full ring | **MEASURED — sample never stated, ever** | **D** as published | **P4** | Paywalled. §4/D15 |

---

## 2. Transcribed data

Everything in this section is **verbatim** from the source. Transcription defects are flagged inline
rather than silently corrected, because a defect is information about the encoding cost.

### 2.1 S1 — PokerBench: the labelled decision set

**This is the highest-value artefact in the survey.** It is not a chart. It is 571,000 rows of
`(game state → solver-preferred action)`.

| Split | Rows |
|---|---|
| Preflop train | 60,000 |
| Preflop test | 1,000 |
| Postflop train | 500,000 |
| Postflop test | 10,000 |

**Preflop CSV schema** — `prev_line`, `hero_pos`, `hero_holding`, `correct_decision`, `num_players`,
`num_bets`, `available_moves`, `pot_size`

**Postflop CSV schema** — `preflop_action`, `board_flop`, `board_turn`, `board_river`,
`aggressor_position`, `postflop_action`, `evaluation_at`, `available_moves`, `pot_size`,
`hero_position`, `holding`, `correct_decision`

**Provenance, quoted from the paper (arXiv:2501.08328v2):**
- Preflop: *"we use the GTO strategies from GTOWizard for the pre-flop game"*
- Postflop: *"WASM-Postflop to solve GTO strategies for the post-flop game"*

**Configuration:** 6-max, 100bb. **No rake model stated anywhere** in the paper, the README, or the
dataset card. Bet-size abstraction not stated.

**Two construction filters that are load-bearing and must be carried into any arm built on this:**
1. Preflop restricted to *"scenarios where a maximum of two raises have happened in the pre-flop betting round"*.
2. Hole cards filtered to *"action lines that choose one dominant action with greater than 50% probability"*.

**Filter 2 is the important one.** PokerBench is **not an equilibrium strategy** — it is the **argmax
of an equilibrium strategy, restricted to the spots where the argmax is unambiguous**. Every mixed
node has been deleted. As an arm this is a *purified* policy, and it will differ from equilibrium in a
direction that is systematic, not random: it will look more decisive than equilibrium is. This must
be stated on any card it produces. It also means PokerBench **cannot** serve as `EQUILIBRIUM_POST`
even if the rake and format problems were solved — a purified argmax is a `Declared` surface, not an
`Equilibrium` one.

Postflop scenarios are organised into **11 board texture categories** (categories themselves not
enumerated in the retrievable text — see §4). Turn cards selected as those *"that would continue to
cover the most new ground"*.

### 2.2 S2/S3 — the two open-source solvers, and exactly what they can and cannot do

This is the material bearing directly on `equilibriumPost.mjs`.

| | `b-inary/postflop-solver` (S2) | `bupticybee/TexasSolver` (S3) |
|---|---|---|
| Players **in the pot** | **2** | **2** |
| Streets | postflop (flop/turn/river) | multi-street |
| Algorithm | **Discounted CFR, γ = 3.0** | CFR variant not stated |
| Accuracy claim | none stated | *"Result aligned with piosolver"*, **0.275%** benchmark accuracy |
| Speed benchmark | *"surpasses paid solvers such as PioSOLVER and GTO+"* | 172s vs piosolver 242s, 6 threads, spr=10 |
| **Rake** | **not supported** | **not supported** |
| Multiway | **no** | **no** |
| **Bunching effects** | **YES — "up to four folded players (6-max game)"** | not stated |
| Output | Rust library API (Cargo dep) | **JSON strategy dump** |
| Licence | **AGPL-3.0-or-later** | **AGPL-3.0** + commercial option |
| Status | **development suspended Oct 2023** | active |
| Is it the PokerBench engine? | **YES** — it is the engine behind WASM Postflop | no |

**The bunching-effects support in S2 is the single most under-appreciated finding in this survey.**
Card removal from folded players is precisely the correction a 9-handed game needs and a 6-max solve
omits, and it is already implemented in a free library. It is capped at four folded players (6-max),
so a 9-handed table with eight folds is still out of reach — but it is the direction, and it is free.

**Neither solver models rake.** For a $1/$2–$1/$3 live game where rake is the dominant tax
(the repo has already measured 12.3 bb/100 at $1/$2 vs 6.7 bb/100 at $2/$5 — see
`live-winrate-benchmarks.md` §6), a rake-free equilibrium is a different game. Any premium computed
against one must say so.

**AGPL-3.0 is a real constraint** and should reach `legal-safety` before any linking decision. Running
the binary offline to *generate a data artefact* is not the same act as linking the library into
shipped code.

### 2.3 S4/S5 — GTO Wizard live cash: the only stated live rake model found

Published 2024-06-18. **Paywalled; charts are images; solver engine never named.** Recorded because
the *configuration* is quotable even though the ranges are not.

**"Classic (Live Cash)" — 8-max:**
- *"8-max LIVE CASH; 168 NEW Situations (PREFLOP)"*
- Stack depths: **100bb, 125bb, 150bb, 175bb, 200bb, 250bb, 300bb**
- Rake structures: **"ChipEV (no rake), Live Rake (10%, 2bb CAP)"**
- Opening sizes: **2x, 2.5x, 3x, 4x, 5x, 7x**

**Straddle — 8-max:**
- *"8-max Single Straddle (0.5/1/2)"*, stack depths **50bb to 1000bb**
- Rake structures: **ChipEV (no rake), NL400, NL100, NL25**
- Opening sizes: **4x, 5x, 6x, 7x**
- Ante variant: *"8-max Single Straddle w/ Ante (0.5/1/2)+0.5bb; 384 NEW Situations"*

**The `Live Rake (10%, 2bb CAP)` figure is the single most useful number in this section**, and it is
usable *independently of the ranges* — it is a rake model a solver vendor was willing to publish as
representative of live play, and this repo can adopt it as a **named parameter** (§3, `P-RAKE-LIVE`)
without importing a single range.

**8-max, not 9-max.** The founder's game is 9-handed. Even the best-configured live product on the
market is one seat short.

### 2.4 S6 — Pokerati: complete 9-handed live ranges, both depths

**The only complete, free, text-notation, explicitly-9-handed chart set found in this entire survey.**
Provenance **P4**: the site claims *"we analyzed all of the most common situations using advanced
poker solvers and sought input from professional poker players"* and names no solver, no rake, no
date, and no author. It credits no external source and links to none.

Self-described format, quoted: *"Usually played with deeper stacks and nine players per table, live
ring games have made a huge comeback in recent years."*

#### Live full ring, 200bb — RFI

| Position | Range (verbatim) |
|---|---|
| UTG | `88+, A4s+, JTs, AQ+` |
| UTG+1 | `77+, A4s+, JTs+, AQ+, KQ` |
| UTG+2 | `66+, A3s+, K9s+, JTs+, AJ+, KQ, 87s, 76s, 65s` |
| LJ | `66+, A3s+, K9s+, QTs+, J9s+, T8s+, 87s, 76s, 65s, 54s, AT+, KQ` |
| HJ | `55+, A2s+, K8s+, Q9s+, J9s+, T8s+, 98s, 87s, 65s, 54s, AT+, KJ+, QJ` |
| CO | `22+, A2s+, K4s+, Q8s+, J8s+, T7s+, 97s+, 86s+, 76s+, 65s+, 54s+, A9+, JT+` |
| BTN | `22+, A2s+, K2s+, Q2s+, J5s+, T5s+, 96s+, 85s+, 75s+, 64s+, 53s+, A4+, K8s+, Q9+, J9+, T8+, 98+` |
| SB | `22+, A2s+, K2s+, Q2s+, J5s+, T5s+, 96s+, 85s+, 75s+, 64s+, 53s+, A4+, K8+, Q9+, J9+, T8+, 98+` |

> **TRANSCRIPTION DEFECT, left uncorrected, and it is expensive.** BTN 200bb contains `K8s+` in the
> *offsuit* tail of the list (between `A4+` and `Q9+`), where SB 200bb — otherwise character-identical
> in that tail — has `K8+`. Almost certainly a typo. **The two readings differ by 4.5 percentage
> points of range width: `K8s+` → 39.1% (518 combos), `K8+` → 43.6% (578 combos).** One character
> moves the BTN opening range by more than the entire published UTG range is wide. It is flagged, not
> fixed: **an arm built on this must decide, and the decision must be a named parameter, not a silent
> edit** (§3, `P-POKERATI-BTN`). Note also that BTN and SB 200bb are otherwise *identical* — a solver
> would never produce that, since SB is out of position against the BB and BTN is not.

#### Live full ring, 100bb — RFI

| Position | Range (verbatim) |
|---|---|
| UTG | `88+, A4s+, JTs+, AQ, KQ` |
| UTG+1 | `77+, A4s+, K9s+, JTs+, AJ+, KQ` |
| UTG+2 | `66+, A3s+, K9s+, JTs+, AJ+, KQ` |
| LJ | `66+, A3s+, K8s+, Q9s+, J9s+, T9s, AT+, KJ+, QJ` |
| HJ | `55+, A2s+, K6s+, Q9s+, J9s+, T8s+, AT+, KT+, QT+` |
| CO | `44+, A2s+, K4s+, Q6s+, J8s+, T8s+, 97s+, 87s+, 76s+, 54s+, A9+, JT+` |
| BTN | `22+, A2s+, K2s+, Q3s+, J5s+, T6s+, 96s+, 86s+, 76s+, 65s+, 54s+, A4+, K8+, Q9+, J9+, T8+` |
| SB | `22+, A2s+, K2s+, Q2s+, J3s+, T5s+, 96s+, 85s+, 75s+, 64s+, 53s+, A3+, K7+, Q8+, J8+, T8+, 98+` |

> **A second defect, structural.** UTG 100bb reads `AQ, KQ` (not `AQ+`), which as written excludes AK
> from an UTG opening range at 100bb. Either the `+` was dropped or the chart is wrong. Named
> parameter `P-POKERATI-UTG` (§3).

**Note the direction of the depth effect.** Pokerati's ranges get *tighter* going from 100bb to 200bb
in early position (`88+, A4s+, JTs+, AQ, KQ` → `88+, A4s+, JTs, AQ+`) and *wider* in late position.
That is a plausible shape and a genuinely testable one.

### 2.5 S7 — Preflop Wizard: 9-max ranges, and the disagreement

Provenance **P4**. No solver, no rake, no date, no author. Free, text notation, complete.

#### 9-max / "live", 100bb — RFI (percentages as published)

| Position | Published % | Range (verbatim) |
|---|---|---|
| UTG | ~11% | `22+, ATs+, KTs+, QTs+, JTs, AJo+, KQo` |
| MP | ~13% | `22+, A9s+, KTs+, QTs+, J9s+, T9s, 98s, AJo+, KQo` |
| HJ | ~17% | `22+, A7s+, K9s+, Q9s+, J9s+, T9s, 98s, ATo+, KJo+` |
| CO | ~24% | `22+, A2s+, K8s+, Q9s+, J8s+, T8s+, 97s+, 87s, 76s, A9o+, KTo+, QJo` |
| BTN | ~40% | `22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, A2o+, K8o+, Q9o+, J9o+, T9o` |
| SB | ~30% | `22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 76s, 65s, A2o+, K9o+, QTo+, JTo` |

**Widths recomputed independently** (combo count / 1326, standalone parser, not the repo's — so this
is a check *on* the repo's parser as much as on the source):

| Position | Published % | **Computed %** | Combos |
|---|---|---|---|
| UTG | ~11% | **12.5%** | 166 |
| MP | ~13% | **13.7%** | 182 |
| HJ | ~17% | **16.7%** | 222 |
| CO | ~24% | **22.8%** | 302 |
| BTN | ~40% | **40.6%** | 538 |
| SB | ~30% | **33.6%** | 446 |

Five of six agree within ~1.5 points; **SB is off by 3.6 points** and UTG by 1.5. The chart is
internally coherent but its own stated percentages are approximations, not the ranges' true widths.
Encode from the **range strings**, never from the stated percentages.

#### 9-max 3-bet ranges (verbatim)

| Position | Range |
|---|---|
| UTG | `QQ+, AKs, AKo` |
| MP | `QQ+, AKs, AKo, AQs` |
| HJ | `JJ+, AQs+, AKo — bluffs: A5s, 65s` |
| CO | `TT+, AJs+, AQo, AKo — bluffs: A5s-A4s, 76s` |
| BTN | `TT+, AJs+, AQo — bluffs: A5s-A2s, K5s, 76s, 65s` |
| SB | `QQ+, AKs, AQs, AKo — bluffs: A5s, A4s` |

> The 3-bet ranges are stated **without a frequency** on the bluff component. A solver 3-bets `A5s`
> at some mixed frequency; this chart says only "bluffs: A5s". Encoding requires assuming a
> frequency — named parameter `P-3BET-BLUFF-FREQ` (§3).

#### 6-max BB defence vs open (approximate, verbatim)

| vs | Published % | Range |
|---|---|---|
| UTG | ~33% | `22+, A2s–ATs, K8s+, Q9s+, J9s+, T9s, 98s, 87s, KJo+, QJo` |
| HJ | ~37% | adds `K7s, Q8s, J8s, T8s, 97s, 87s, 76s, KTo` |
| CO | ~43% | adds `K4s+, Q7s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, JTo` |
| BTN | ~53% | adds `K2s+, Q4s+, J6s+, T6s+, 95s+, 85s+, 74s+, 64s+, Q9o+, J9o+` |

6-max 3-bet from BB: `QQ+, AKs, AKo, AQs — plus bluffs like A5s-A2s, K5s, 76s, 65s`.

#### 6-max RFI (for the conflict analysis in §2.9)

| Position | Range (verbatim) |
|---|---|
| UTG | `22+, ATs+, AJo+, KQs, KJs, QJs, JTs, T9s` |
| HJ | `22+, A9s+, ATo+, KQo, QTs+, JTs, T9s, 98s` |
| CO | `22+, A2s+, A8o+, K9s+, KTo+, Q9s+, QTo+, J9s+, JTo, T8s+, 97s+, 87s, 76s, 65s` |
| BTN | `22+, A2s+, A2o+, K2s+, K7o+, Q4s+, Q9o+, J7s+, J9o+, T7s+, T9o, 96s+, 86s+, 75s+, 65s, 54s` |
| SB | `22+, A2s+, A4o+, K4s+, K9o+, Q7s+, QTo+, J8s+, JTo, T8s+, 97s+, 87s, 76s, 65s, 54s` |

Also published, MTT 8-max with 1bb ante: 40bb UTG `22+, ATs+, KTs+, QTs+, JTs, T9s, AJo+, KQo`;
60bb CO `22+, A4s+, K8s+, Q9s+, J9s+, T8s+, 97s+, 87s, A9o+, KTo+, QJo`.

### 2.6 S8/S9 — solver-named but image-locked

**RangeConverter** free set: 14 charts. Relevant cells: **9-max 100bb full ring**; **8-max straddle
200bb deep**; 6-max at 100z and 500z rake; heads-up at 500z and GG 200NL. Solver **not named**.
The site states action frequencies are *"rounded to the nearest 50%"* for memorability — meaning
**the published charts are a deliberate simplification of the solver output, not the output**. That
is exactly the §11.9 "teachable rule" transformation, applied by the vendor, undocumented in
magnitude. The rounding is `P-RC-ROUNDING` (§3).

> **CORRECTION, and it upgrades this source substantially.** An initial pass concluded these charts
> were image-locked and graded them **B, blocked**. That was wrong. **The 9-max 100bb Live Cash PDF
> was retrieved in full and read**: the grids are legible and the per-seat frequencies are printed as
> exact numbers. **It is grade A and it is the best artefact in this survey.** It is now carried as
> **S28** and transcribed in §2.21. The lesson generalises: *"the charts are images"* is a statement
> about a fetch method, not about a source, and it was wrong here.

**FreeBetRange**: the only site in the survey that **names its solver** — *"all ranges in the Library
are calculated with the HoldemResources Calculator (HRC)"*. HRC is a genuine equilibrium solver
(primarily push/fold and preflop ICM). Charts are images and require an account. The 9-max article
itself contains **zero** text notation. **B/P2, blocked on extraction.**

### 2.7 S10 — Upswing / Lucid

Upswing's `/charts/` page carries a chart labelled **"Live Cash 9-Handed"** — the format match this
survey most wants — alongside "ClubWPT Gold (8-max with straddle)", "Online 6-Max", and "Tournament
8-Handed (with ante)". It is **SVG images only**; no text notation is extractable. One frequency
figure survives conversion: **"Raise 18.5% | Fold 81.5%"** for a UTG position. That single number is
the only quantitative content recoverable from Upswing's free chart surface.

**Lucid** (Doug Polk) covers Online Cash 6-max, Heads-Up Cash, **Live Cash**, Tournaments, Spins.
Live Cash = **150bb with or without rake**, plus **preflop for straddle games**. **9-handed full ring
is explicitly not covered** and is not on the stated roadmap. Solver engine not disclosed; claims
"100+ Million Solved Hands", new sims every 2 weeks. **Exports ranges in GTO+ and Flopzilla format**
— the **only machine-readable range export identified in this survey** — behind a paid tier
($29 first month, then $49/month). Free basic tier exists.

### 2.8 S13 — DeepFold, and what a C looks like

Included as the calibration example for grade **C**. DeepFold publishes a table with position,
frequency, and a "range description" — but the description is prose, not notation:

| Position | Frequency | "Range description" (verbatim) |
|---|---|---|
| UTG | ~14% | `All pairs 77+, AJ+, KQs, suited connectors 65s+` |
| MP | ~17% | `Add 55-66, KJs, QJs, JTs, T9s, 76s` |
| CO | ~25% | `Add Axs, Kxs, lower SCs, Q9s+, J9s+` |
| BTN | ~45% | `Most suited cards, broadways offsuit, 22-44` |
| SB | ~35% | `Limp/raise mix; tighter than BTN` |

`Most suited cards` is not a predicate. `lower SCs` is not a predicate. `Limp/raise mix` names two
actions with no frequency. **Encoding this means choosing the boundary ourselves at every line**, and
the resulting arm would be ours with DeepFold's name on it. The *percentages* are salvageable as
targets (`P-DEEPFOLD-WIDTH`, §3) — one could construct a range of the stated width by equity ordering
and score that — but then the arm tests "does a 14%-wide UTG range beat a 11%-wide one", which is a
real question and **not** a test of DeepFold.

Its BB-defence table is more concrete and closer to **B**:

| Open from | BB calls | BB 3-bets | BB folds |
|---|---|---|---|
| UTG | ~32% | ~6% | ~62% |
| MP | ~38% | ~7% | ~55% |
| CO | ~48% | ~10% | ~42% |
| BTN | ~58% | ~15% | ~27% |

These are **frequencies without compositions** — they say how often, never with what. That is the
exact failure mode POKER_THEORY §11.7 names: *"Frequency right, composition wrong."* A frequency-only
prescription can be encoded as a **width target** and nothing more.

### 2.9 The conflicts, presented and not averaged

**Conflict 1 — UTG opening range, 9-handed, 100bb.** Three sources, three answers, and they are not
close.

All widths below are **computed**, not quoted (combo count / 1326).

| Source | UTG range | Width | Combos |
|---|---|---|---|
| **This repo**, `PREFLOP_CHARTS.UTG` | `66+,A9s+,A5s,KTs+,QTs+,JTs,T9s,98s,AQo+` | **10.1%** | 134 |
| **S7** Preflop Wizard (9-max) | `22+, ATs+, KTs+, QTs+, JTs, AJo+, KQo` | **12.5%** | 166 |
| **S6** Pokerati (live 9-h, 100bb, as written) | `88+, A4s+, JTs+, AQ, KQ` | **8.6%** | 114 |
| **S6** Pokerati (same, reading `AQ` as `AQ+`) | `88+, A4s+, JTs+, AQ+, KQ` | **9.5%** | 126 |
| **S6** Pokerati (live 9-h, **200bb**) | `88+, A4s+, JTs, AQ+` | **8.3%** | 110 |

The widest is **45% wider than the narrowest**. Worse, the **shapes are incompatible in a way no
solver would produce**:

- This repo's chart **drops** `22`–`55` but **keeps** `T9s` and `98s`.
- Preflop Wizard **keeps** all pairs down to `22` but **drops** `T9s` and `98s`.
- Pokerati **keeps** `A4s`–`A9s` (a weak-ace block) from UTG at 9-handed, which is a shape most
  published UTG advice explicitly rejects, while cutting all pairs below `88`.

A solver's UTG range shrinks roughly monotonically in equity-realisation order. **None of these three
does.** Each has been hand-simplified along a different axis, and each simplification is
undocumented. **These are three `Declared` surfaces, and the only way to rank them is to score them.**
That is the whole thesis of this document, visible in one table.

**Conflict 2 — UTG opening range, 6-max, 100bb.**

| Source | UTG range |
|---|---|
| **S7** Preflop Wizard | `22+, ATs+, AJo+, KQs, KJs, QJs, JTs, T9s` |
| **S13** DeepFold | `77+, AJ+, KQs, 65s+` (~14%) |
| Pokerati | `77+, A2s+, K5s+, Q9s+, JTs+, AT+, KJ+, QJ+` |

Pokerati opens **`A2s+` from UTG at 6-max** — every suited ace. Preflop Wizard opens `ATs+`. DeepFold
opens no suited ace below `AJ`. These are three different games. **Not averaged. Recorded.**

**Conflict 3 — direction of the stack-depth effect.** Pokerati's live full-ring UTG range gets
*tighter* from 100bb → 200bb; GTO Wizard's live-cash product offers seven depths from 100bb to 300bb
without publishing the direction. No free source states the depth gradient as a rule. **Unresolved.**

### 2.10 S14 — the only c-bet frequency table keyed to named boards

PioSolver, NLHE 6-max, single-raised pot, raiser vs BB. Stakes, era, and stack depth **unstated**.

| Board | Spot | C-bet % | Source's stated reason |
|---|---|---|---|
| Q♠Q♦7♠ | BTN vs BB | **92%** | range adv ~56%, trips concentration |
| A♦8♦4♣ | BTN vs BB | **54%** | top pairs not vulnerable |
| K♦7♦6♣ | CO vs BB | **61%** | top pairs moderately vulnerable |
| 8♠7♥6♦ | CO vs BB | **63%** | range adv ~51%, value + protection |
| A♦K♥Q♠ | CO vs BB | **76%** | range adv ~57% + nut adv |
| J♦9♠7♠ | MP vs BB | **44%** | "lacking in the nut department" |
| K♥K♦5♣ | MP vs BB | **100%** | range adv ~59% |
| A♥K♥Q♣ | BTN vs BB | **82%** | range + nut adv |
| T♠7♦6♦ | BTN vs BB | **34%** | range adv ~53%, no nut adv |
| 7♥7♦7♣ | BTN vs BB | **100%** | range adv ~57% |

**The encoding blocker is visible inside the table.** Row 1 (~56% range equity → **92%** c-bet) versus
row 9 (~53% → **34%**). Three points of range advantage cannot carry a 58-point frequency swing. The
source's own reconciling variable is **"nut advantage"** — and *nut advantage is never quantified
anywhere in the entire surveyed corpus*. So this is **grade A for these ten rows and grade C for
everything between them**: no interpolation rule exists, and inventing one makes the arm ours.

**This is the highest-value missing primitive found in the postflop survey.** The repo *can* compute
top-of-range mass; the literature cannot, and therefore cannot tell it what to do with it.

### 2.11 S15/S16 — c-bet frequency by texture class, and an implied equity boundary

Blackwood + Brady, Upswing. Cash, 100bb, no ante, heads-up postflop, solver unnamed.

| Texture class | Examples given | C-bet frequency (verbatim) |
|---|---|---|
| High paired | A-A-3, K-K-Q, J-J-8, T-T-2 | *"c-bet virtually always"* |
| Disconnected single broadway | K-7-2 | *"bet small with your entire range"* (100%) |
| Double broadway | K-Q-4, A-J-6, Q-T-2 | *"very frequently, but not quite always"* |
| Connected single broadway | Q-6-5, J-4-2, K-5-3 | **"around 70% of the time on average"** |
| A-high | A-8-5, A-6-2 | **"around 70% of the time on average"** |
| Middling/connected | 9-8-4(FD), 8-6-3, 7-6-2 | **"averaging around 55-60%"** |
| Low connected, MP | 7-5-3 | *"virtually never"* |
| Low connected, UTG vs BB | 5-4-3 | **"should actually be 0%"** |
| Low connected, CO vs BB | 6-4-3 | **"around 20%"** |

**The classes are named by EXAMPLE, not by predicate** — which is exactly the gap `boardTexture.js`
would have to close. Named parameter `P-TEXTURE-CLASS` (§3): the closing assumption must be *ours*
and labelled as such — e.g. *(broadway rank count, paired y/n, max rank gap, flush-draw present)*.

**S16 — an equity boundary the source never states as a rule.** Range-check 100% OOP with:
nine-high-and-below unpaired; most ten-high. Equities given: **9-8-6 → 48.7%**; **7-3-2r → 47.2%**;
K-9-8 → range check *despite* an equity edge. Middling (Q-9-2, Q-7-3, K-6-4, A-high) →
**"only c-betting about 35% of the time on average."** Taken together this implies
**"check entire range OOP below ~49% range equity"** — a clean, encodable predicate that **no source
states**. Recorded as a derived reading, not a quotation.

### 2.12 S17 — four complete multi-street geometric sizing schedules

Lucid GTO, NLHE cash 100bb, flop pot ~6bb. Pot size given at every node, so these encode with no
interpretation:

| # | Flop | Turn | River |
|---|---|---|---|
| 1 | **33%** (2bb into 6bb) | **135%** (13.5bb into 10bb) | **220%** |
| 2 | **75%** (4.5bb into 6bb) | **135%** (20bb into 15bb) | **135%** |
| 3 | **75%** | **75%** (11bb into 15bb) | **215%** |
| 4 | **135%** (8bb into 6bb) | **100%** (22bb into 22bb) | **~100%** |

**Flush-draw presence as a concrete sizing predicate with concrete outputs** (same article):
Q♦T♣2♣ (two-tone) → small bet **13%**, **overbet 32%**. Q♥T♦2♣ (rainbow) → **overbet 14%**.

Per-hand-class flop betting frequencies on Q♦T♣2♣: sets / two-pair / TP+2nd-kicker / TP+FD /
combo-draws **100%** · flush draws **50%** · open-enders **50%** · gutshots **75%** (K9/J8/98) but
**25%** (AK/AJ) · bottom pairs **75%** · backdoors **75%** · BDSD+overcard **25%**.

**Geometric sizing itself is A-grade and computable**; the *deviation* from it is C-grade. Benchmarks
where the solver departs: 742r geometric 110.4% → solver uses **150%** · AK6r geometric 115.8% →
**125–200%** · QJ26r turn geometric 108.5% → **200%**, BB folds ~67%. The stated motivation is
"equity denial", unquantified.

**Size bands** (S17-adjacent, Dan B. 2019-09-27): flop small = **25–33%** pot, flop big = **≥66%**;
turn/river small = **66–75%**, big = **≥90%**; *"you are usually not incentivized to bet less than
66% of the pot"* on turn/river.

**Range-shape → size mapping** (George Mathias, 2018-02-02, 6-max cash $5/$10 100bb, **ASSERTED, no
solver, no sample**): condensed → **25–40%** · polarized → **66–75%** · in-between → **50–60%** ·
wet/dynamic → **66–80%**. GTO Wizard supplies the only numeric bucket boundaries found for
"polarized": **best hands >75% equity plus trash <33% equity**, and *"a perfectly polarized range
will always use the geometric bet size."*

**How much simplification costs — load-bearing for the repo's own encoding tolerance.** GTO Wizard
(Tombos21, 2023-08-21): Dynamic Sizing loses **0.05% pot** vs the best single size and **0.30% pot**
vs an 8-size strategy; captures **99.7%** / **99.95%** of EV; finds a near-optimal size (<0.25% loss)
**95% of the time**. Brokos (2024-03-04): restricting to one flop size costs **~0.02bb ≈ 2bb/100**;
*"multiple sizes matter most on the river."* Optimal fixed sizes named: **50% pot OOP, 75–100% pot IP.**
This directly informs how much a teachable simplification of *our* sizing can cost before it matters.

### 2.13 S18 — the only published fold-elasticity curve

Lucid, BB vs BTN SRP, **50bb effective, board 9♣5♦3♥**:

| C-bet size | BB folds | BB raises | BB calls |
|---|---|---|---|
| **30% pot** | **29%** | **19%** | **51%** |
| **70% pot** | **45%** | — | — |
| **133% pot** | "folding predominant" | — | — |

At 70%, *"~125 additional combos"* fold (22, 44, T6s, J6s, Q6s; AJo indifferent). At 133%, 66/77/some
5x/3x fold.

**This is fold% as a function of bet size at fixed board and fixed SPR — the exact shape the repo's
fold curve is fit to** (`POPULATION_FOLD_RATE`, WS-283, Brier-minimised on n=318,347). It is the only
published curve of that shape found. Three points at one board is thin, but it is a **direct external
comparand for a curve the repo currently fits with an unfitted level.**

**Corroborating fold-vs-size points** from GTO Wizard, scattered singletons: Spin&Go 25bb SB — J♥J♠9♠
1.3bb → **~27% fold equity**; 9♥7♠3♦ 108% pot → **~60% BB folds**. Song-Carrillo MTT 50bb A♠8♥7♦ vs
75% pot — **BB folds 61% vs UTG, 60% vs BTN**, where MDF at 75% pot is 57% (see §2.16).

### 2.14 S19 — check-raise frequency as a function of bet size

PioSolver, online $1/$2 6-max. Board **J♥8♠4♥**:

| Facing | BB check-raise |
|---|---|
| **66% pot c-bet** | **8.66%** |
| **33% pot c-bet** | **12.65%** |

*"1.5 times more often than versus a big bet."* Also: **check-raise 80% with trips, call 20%**; a
stated **2 bluffs : 1 value** flop check-raise ratio (see errata — the article's own combo counts do
not close).

Other check-raise numbers, all singletons: GTO **BB check-raise 22.5%**, and facing one, continue
~66% / fold ~34% / 3-bet ~6% ($1/$2 6-max, $200 eff). Turn CR composition: ~50% of KJ (OESD), ~20%
QJo, 20% QT, 100% J9. GTO Wizard (K♦7♥5♥ BB vs BTN, MTT cEV): blank turn 2♣ 30bb vs pot bet →
**CR 2% (~8.5 combos)**; wet turn 8♦ 30bb vs 67% pot → **CR 11% (~40 combos)**, ~50% of CR range two
pair, BTN barrel range **52% draws / 48% non-draws**; removing the CR option at 100bb costs
**0.2% pot = 1.82bb/100**. Nodelock: forcing BTN to c-bet 100% makes BB's check-raise
*"nearly triple"* off an 11% baseline.

### 2.15 S20 — the measured fold-to-c-bet number, and why it matters more than anything else here

Adam "w34z3l" Jones, Red Chip Poker, 2017-09-12. Stated source: **Holdem Manager 2 / PokerTracker 4
database.** **No sample size, no stakes, no pool, no era.** One of only **two** measured-from-hands
claims in the entire postflop survey.

> *"hardly any difference between the folding frequency… on a wet board texture and a dry board
> texture and in both scenarios it's going to be somewhere around the 40% mark"*

**39% folds on drawy texture. 43% folds on dry.** Four points.

Set against the folk belief of ~70% dry / ~10% wet, and against the entire sizing doctrine in §2.12
which keys size off texture. **If this number is right, the texture axis that the published corpus
rests on barely moves the observable it is supposed to move.**

**A second collision inside the same author's own work.** In a 2018 article he gives the exploit
ladder: *"if our opponent folds more than 40% to a two thirds pot bet, we are generating automatic
profit"* (= alpha at 2/3 pot, correct); folds ~45% → mild over-fold; **~60% → "c-betting anything is
going to be the highest EV"**; **80%+ → c-bet nearly everything.** **His measured population (~40%)
sits exactly on his own indifference threshold (40%).** Either reading is publishable and they point
opposite ways. Presented, not resolved.

**This is the single most falsifiable published claim in the corpus against a live 9-handed
population**, and the repo already has the instrument: it holds fold-vs-size curves per street on
**10.6M decisions** (`mass-pool-data-2026-07-25.md`), and could split them by `wetScore` tomorrow.

### 2.16 S21 — MDF / alpha: fully solved, and the caveat that matters

Identities, unanimous across six-plus independent sources (all differences are rounding):

```
MDF   = Pot / (Pot + Bet)
alpha = Bet / (Bet + Pot)        MDF = 1 − alpha
caller's required equity = Bet / (Pot + 2×Bet)
EV(bluff) = (Fold% × Pot) − (Call% × Bet)
```

| Bet ×pot | alpha | MDF |
|---|---|---|
| 0.10 | 9% | 91% |
| 0.25 | 20% | 80% |
| 0.33 | 25% | 75% |
| 0.50 | 33.3% | 66.7% |
| 0.67 | 40% | 60% |
| 0.75 | 42.85% | 57.15% |
| 1.00 | 50% | 50% |
| 1.25 | 56% | 44% |
| 1.50 | 60% | 40% |
| 2.00 | 66.7% | 33.3% |

**Already resident in this repo** as `Required fold` (`s/(1+s)` for a bet, `R/(R+P+B)` for a raise),
with the zero-equity premise already named. Recorded to establish that **the published corpus adds
nothing here that the repo does not already have, correctly, with a better-stated premise.**

**The one caveat worth importing, from GTO Wizard (Tombos21), and it is important:**

> *"These numbers only work for the initial bet! MDF and Alpha change facing a raise, and cannot be
> determined with bet size as a pot% alone."*

Worked: bet 5 into 10 → alpha 33%, MDF 67%; villain raises to 15 → **alpha 50%, MDF 50%** — the
numbers detach from raise-as-%-of-pot entirely. **The repo already handles this correctly** (a
separate raise formula, and a facing-a-**raise** fold-curve arm fit separately and *never merged*
with the facing-a-bet curve). Recorded because it independently confirms a decision the repo made on
its own and shows the failure mode is common enough that a solver vendor writes warnings about it.

Also: *"MDF assumes bluffs have no equity"* — identical premise to the repo's `Required fold`.
*"Defend closer to MDF in position, over-fold out of position"*; *"BB over-folds vs BTN c-bets across
all sizes 20-200%."*

**MDF is an upper bound, not a prescription — and solvers violate it.** Two independent confirmations:
A♠8♥7♦ vs 75% pot, MDF 57%, solver **folds 60–61%**; A♠K♠Q♥ 25bb vs 67% c-bet, MDF requires 60%, BB
continues **~37%** (12% raise + 25% call). Red Chip's *current* published position (w34z3l, Jan 2026)
is that MDF should **not** be encoded as a rule at all: *"GTO solutions frequently involve defense
frequencies that violate MDF… and yet GTO solutions are generally understood as being
unexploitable."*

One extra numeric layer, solver and config unnamed → **B**: *"bluffs on the flop and turn typically
have 10-20% equity"*, so actual solver fold frequency runs **~5-10 points above MDF**: 33% pot →
30-35% fold · 50% → 35-40% · 75% → 45-50% · 125% → 55-60%.

### 2.17 S22 — Janda's street-by-street value shares

Janda, *Applications of No-Limit Hold'em* (2013) p.144, relayed via Ryan Fee to Upswing.

> **ATTRIBUTION CAVEAT, and it matters.** **Janda's own tables did not surface on the open web.**
> What is reachable is Upswing's relay, which cites p.144 and reproduces the derivation. A separate
> pass found that *every* ratio circulating in the field is a restatement of the same toy game —
> the AKQ / clairvoyance game — traceable through Janda to **Chen & Ankenman** and ultimately to
> **von Neumann poker**. So the numbers below are **second-hand and their upstream is a toy game, not
> a hold'em solve.** They are correct arithmetic about a simplified game. Whether they describe
> hold'em is a separate claim, and nobody reachable makes it with evidence. Obtaining Janda's actual
> multi-street tables requires the book.

| Street | Ratio | Value share |
|---|---|---|
| Flop | **2:1 bluffs to value** | **34.3%** |
| Turn | **1:1** | **49%** |
| River | **1:2 bluff to value** | **70%** |

Derivation, verbatim and verifiable: assuming **75% pot on every street** with a perfectly polarized
range, *"70 percent of our river bets need to be value bets"* → *"the turn must be bet 70 percent of
the time"* → *"34.3 percent of our flop bets should be value bets."* **0.7³ = 0.343.** ✓

**General river rule recoverable and A-grade:** bluff fraction of a polarized betting range =
`b/(1+2b)`, where `b` = bet/pot. Reproduces 30% at 0.75-pot and 38% at an overbet.

**Bluff-catch indifference table** (river only), which is the same column read the other way:

| Bet | Value:Bluff | Bluff% | Indifference equity |
|---|---|---|---|
| 1/3 pot | 4:1 | 20% | 20% |
| 1/2 | 3:1 | 25% | 25% |
| 2/3 | 2.5:1 | 29% | 29% |
| 3/4 | 2.33:1 | 30% | 30% |
| pot | 2:1 | 33% | 33% |
| 1.5× | 5:3 | 37.5% | 37.5% |
| 2× | 3:2 | 40% | 40% |

**Binding assumptions, none negotiable, and NOT ONE SOURCE MENTIONS THE LAST TWO:** river only ·
bluffs exactly 0% equity · value hands beat the entire bluff-catching range · call closes the action
(no raise branch) · **no rake** · **no card removal**.

**The repo's corpus contradicts the prescription directly.** Measured: called big-river bets are
**76–83% two-pair-or-better and ≤7% air** — *"pool bluff share ~⅕ of equilibrium"* — and river fold
rates run **12–16 points past bluff-breakeven** (fold 71.5% vs pot–1.5×, 76.0% vs overbet). Janda's
70% value share describes a balanced range. The measured field is at roughly **93–95%** value. **This
is the clearest available demonstration of why a published prescription is an arm and not a
standard**, and it is why the imperative is refused in §6 while the identity is adopted.

**Value-bet side is thin and B at best.** The only value threshold anyone states, given identically by
two independent sources (Greg Walker, thepokerbank; Shawn Altbaum, GGPoker 2026-03-02): **value bet
if you beat the calling range more than 50%.** Grade **B** — it holds only if villain never raises;
that is a named assumption (`P-VALUE-NO-RAISE`, §3). One worked instance: Q♥T♥ wins **~56%** vs the
calling range at a 2/3-pot bet.

**Range-advantage scale** (Dan B., PioSolver — no other published version found): **"55% is considered
a decent-sized range advantage. 62% is massive."** Maximum published: **~75%/25%** (3-bettor IP on
A♠Q♥J♠).

**A "thin value = 55%+" rule does not exist in the published literature.** If the repo wants one it is
the repo's own margin-for-raise-risk adjustment and must be labelled as such.

### 2.18 S23 — the multiway defence formula: the single most reusable result for a 9-handed game

George Mathias, Upswing, 2018-03-16. Pot-sized bet:

| Players on flop | Fold each | Defend each |
|---|---|---|
| 2 | 50% | **50%** |
| 3 | 71% | **29%** |
| 4 | 79% | **21%** |
| 5 | 84% | **16%** |
| 6 | 87% | **13%** |

**The generating rule verifies exactly:** `fold_i = alpha^(1/(n−1))`, `alpha = bet/(pot+bet)`. At
alpha = 0.5: .707 / .794 / .841 / .871 — reproduces every row. **Generalizes to any bet size and any
n**, and it is the **only closed-form multiway result in the entire survey.**

Given that the founder's game is 9-handed and routinely three- and four-way, and given that §8
establishes the rest of the published corpus is heads-up, **this one formula is arguably worth more
to this repo than every chart in §2.4–§2.5 combined.**

**Solver-side multiway numbers — rare, so all captured:**
- **8-max symmetric 100bb cEV**, LJ vs BB+SB over a 20-flop subset: LJ's checking frequency **+11%
  multiway vs heads-up**; the **pot-sized c-bet collapses from 18% HU usage to 1.3%**; SB checks ~90%,
  **donks 9.8%**, primarily 33% pot.
- **CO-BTN-BB, T♠7♥4♠, vs a ¼-pot c-bet**: heads-up BTN folds ~10% / calls ~73% / raises ~17%;
  **3-way BTN folds ~31% / calls ~39% / raises ~30%.** On K72r 3-way: BTN raises ~16%, calls ~54%,
  **BB folds ~68% after BTN calls**; T74tt → BB folds ~45%; at ½-pot → BB folds ~70%.
- 3-way nodelock: CO c-bets **23% vs GTO BB → 31% vs an excessively loose BB**; BTN raises **13% → 19%.**

**And the concession, from the source itself:** *"exact optimal defend frequencies in multi-way pots
are a matter of debate, and are still undiscovered."*

### 2.19 S24 — GTO Wizard's blog: singletons, and the images problem

**The highest-value target in the postflop survey is largely unencodable from its public writing.**
Its aggregate reports — the actual frequency tables — render as **solver screenshots**. Every MDF
cheat sheet, pot-odds table, and aggregate flop grid reached was an **image**, with the surrounding
prose qualitative (*"bets small at high frequency"*, *"checks quite often"*). The A-grade data is real
and sits behind the paid product.

What survives text extraction, all per-board singletons rather than tables:

| Spot | Config | Numbers |
|---|---|---|
| UTG vs BTN cold-caller | NL50 6-max 100bb | **check 72% / c-bet 28% across all flops**. Q♠9♥6♦r and 4♠3♥2♦r → check entire range; K♠Q♥6♦r → **c-bet 100% for 1/3 pot**; K♠4♥3♦r → **c-bet 100% for 2/3 pot** |
| UTG vs BTN cold-call | NL500 6-max 100bb | c-bet *"about ⅓ of the time across all flops"*; BTN checks back *"more than ½"* |
| BTN aggregate | 20bb chip-EV MTT | **78% across all boards**; AT7m range-bets small, 654r checks >50%, AQ7r large sizes |
| BTN vs BB, 30bb | MTT | 6♥3♦2♣ **62.5%** · J♥7♦5♣ **~60%** · K♥4♥4♦ **42.8%** (at 100bb: **47.4%**). BB baseline check-raise on 6♥3♦2♣ = **11%** |
| UTG OOP 40bb | MTT | A♠J♥6♦ **~70%+** · 9♥8♦6♦ **~35%** |
| CO vs BTN 30bb | MTT | 9♥6♥6♦ *"roughly half their range for half the pot"*; T♥3♥2♦ *"check their entire range"* |
| **BTN sizing split** (spot unstated) | aggregate report | **pot-size 17.5% / small downbet 36.9% / check 45.7%** — the only text-extractable GTOW aggregate |

**The one aggregate frequency table that survives extraction** — Upswing's "Kanu7" series
(Dec 2019 – Jan 2020), **one solver run by Alex Millar, written up by Mike Brady across four
articles**. Encoding all four encodes **one source**, not four:

| Statistic | All flops | Monotone flops |
|---|---|---|
| C-bet frequency | **62%** | **51%** |
| Check-raise frequency | **25%** | **13%** |
| Turn probe | **31%** | — |

**Texture → size case study** (Barry Carter, 2024-07-09, BB vs BTN SRP 100bb cash) — **and it
contradicts "bet bigger on wet"**:

| Board | Predominant size | BB folds | BB continues | Note |
|---|---|---|---|---|
| Q♥Q♣6♦ (dry paired) | **33% pot** | **37%** | raise 24% / call 39% | 16.8% of continuing range nutted |
| K♥J♥7♦ (wet) | **75% and 125%** | **62%** | call 32% / raise 5% | |
| Q♦J♦T♦ (monotone, super-wet) | **33% pot** | **37%** | call 53% / raise 9% | 29.4% of continuing range has 60%+ equity |

The monotone board takes the **small** size, matching Upswing's own monotone guidance (Mathias 2017:
**"small bet size (<50% pot) across all streets"**) and GTOW's monotone article (BTN flops a flush
**5%**, BB **6%**; fourth heart on turn **~20%**). **Direct conflict with the doctrine in §2.12.
Presented, not averaged.**

**Turn/barrel numbers, all singletons:** 3-bet pot 5♠5♥2♣ 100bb → **67% pot turn then 67% pot shove**;
at 40bb → **25-50% pot, "virtually never shoves"**. K♠8♥4♦ with Q♠ turn 100bb → UTG bets *"barely 40%
of range"* with an overbet, top pair strictly checks.

**Probes and donks** (MTT 40/100bb): J♠5♣3♦ UTG-opener → **BB donks ~18% across all turns**;
BTN-opener → **~7%**. J♠5♣3♦3♥ 40bb → **~40%**. K♠7♦5♥ 40bb **~16%** vs 100bb **~11%**. Sizing:
*"donk bets should be small, often 20% of the pot or so."* Turn probing (Cash6m500z 100bb, CO vs BTN
3-bet, 6♥5♥4♦): baseline BTN c-bets **>80%** at equilibrium; A♣ turn → CO bets **~13% of range at
125% pot**.

**Position dominates texture — the cleanest demonstration found** (Leo Song-Carrillo, 2026-02-06,
Lucid, MTT). Baseline **60-70%** after an open-raise. **Same flop Q♥J♦5♣, three different openers:
CO vs BTN 25bb → ~33% · LJ vs BTN → 54% · UTG vs BTN → 82%.** A 49-point swing from the opener's
position alone, on one board. Also: HJ vs BB on 7♦6♦5♣ — **BB leads 42%, checks 58%**; HJ K7s on
8♦6♦2♣ — **BB check-raises 24%, calls 48%, folds 29%**.

**Range-bet (100% c-bet) lookup list** (Dan B., 2021-02-09, **heads-up only** — *"multiway pots are a
different beast"*), all at ~1/3 pot. SRP: K♥7♠2♦ CO vs BB · K♠Q♥3♣ SB vs BB · Q♠Q♣A♣ HJ vs BB ·
K♠K♥Q♣ SB vs BB · A-7-6 and A-9-3 SB vs BB. 3-bet pots: K♥8♠4♦ IP · Q♠6♠2♦ BTN vs CO · A♠Q♥J♠ BTN vs
CO (*"biggest equity advantage that you can find… around 75% to 25%"*) · K♥J♣2♠ SB vs CO · A♥K♣K♠ SB
vs BTN.

### 2.20 S25 — SPR: the only live-populated numeric material in the entire survey

**GTO Wizard (Brokos, 2022-11-17) — equity required to stack off, by SPR:**

| SPR | Equity needed |
|---|---|
| 1 | **33%** |
| 2 | **40%** |
| 5 | **43%** |
| 16 | all top pairs and nut flush draws indifferent |

*"Above SPR 4, stacking off with a single pair, no matter how strong, starts to get dicey."*

**Red Chip (SplitSuit + Zac Shaw, 2017-08-22, LIVE $2/$5 cash — sourced to Flynn/Mehta/Miller,
*Professional No-Limit Hold'em*):** SPR ≤2 commit with top pair · **SPR 2 = "the fulcrum"** · SPR
1–1.5 shipping fine · SPR 3–4 medium commitment · SPR >6 *"don't worry about it"* · SPR 10 not
committed. Upswing (Ben Ward, 2018-06-15) gives the same 2/5/10 landmarks **uncited**.

**SPR thresholds are numeric and observable — but every prescription attached to them is a hand-class
verdict, never a bet size or a frequency.** They tell you *whether to stack off with top pair*, which
is not a `π(a|s)`. Encodable only as a filter on an existing policy, not as a policy.

This matters to the repo for a specific reason: POKER_THEORY §11.7 records the founder's mechanism
that **fear pushes medium hands into passive lines**, and that *"'afraid of getting stacked' is a
statement about how much of the stack is at risk — SPR and effective depth"*, and is therefore
**computable**. The SPR literature is the closest published material to that mechanism, and it
supplies **thresholds without frequencies** — which is precisely the half the repo does not need.

---

### 2.21 S28 — RangeConverter 9-max 100bb Live Cash: the best artefact found ⭐

`rangeconverter.com/downloads/9-max-100bb-Poker-Charts-No-Limit-Texas-Holdem-Cash` — **free, 18-page
PDF, 11.2 MB, retrieved and read in full.**

**Population:** **9-handed full ring, 100bb, labelled live cash.** **Solver: unnamed** (*"GTO poker
solvers"*; the vendor sells PioSolver/MonkerSolver ranges elsewhere). **Rake assumptions NOT
stated** — a real gap, and a notable one, since the same vendor *does* name the rake structure on its
6-max charts. *"Mixed strategies rounded to the nearest 50%."*

**Coverage — 16 chart pages:** RFI for all 8 opening seats · facing-a-raise for EP/MP, LJ, HJ, CO,
BTN, SB, BB · RFI-vs-3bet for UTG, UTG+1, MP, LJ, HJ, CO, BTN, SB.

**Exact RFI frequencies at a 3.0bb open:**

| Seat | Raise | Fold |
|---|---|---|
| UTG | **10.09%** | 89.92% |
| UTG+1 | **11.44%** | 88.57% |
| MP | **13.29%** | 86.71% |
| LJ | **15.80%** | 84.20% |
| HJ | **19.76%** | 80.24% |
| CO | **25.62%** | 74.38% |
| BTN | **40.49%** | 59.51% |
| SB | **46.36%** | 53.64% |

**UTG RFI grid, transcribed from the chart (10.09%):** pairs **88+** · suited aces **A8s+** plus
**A5s, A4s**, with **A7s and A6s at 50%** · suited kings **KTs+** with **K9s at 50%** and **K5s at
50%** · **QJs**, **QTs at 50%** · **JTs** · offsuit **AQo+**, **KQo at 50%**. Everything else folds.

**Why this is the best artefact in the survey:** 9-handed (not 8, not 6) · 100bb · live-labelled ·
free · every seat · **frequencies exact rather than approximated** · grids legible · and it covers the
two *derived* situations (vs RFI, vs 3-bet) that no other free source covers at all. **It is the only
item found that is simultaneously grade A, free, and matched to the founder's table size.**

**The honest caveats, both material:** the solver is unnamed, and **the rake is unstated** — which
matters precisely because live 10%-capped rake is not the online rake these solves may assume, and
the vendor's willingness to name rake elsewhere makes the silence here conspicuous.

A companion **8-max Straddle, No Ante, 100-straddle (= 200bb)** set exists at the same site.

**Independent corroboration, and it is close.** Upswing's separate "Live Cash 9-HANDED" chart
(*"for casino/card room use"*) gives **UTG raise 10.2% @ 3bb** and **BTN raise 40.8% @ 3bb**, against
RangeConverter's **10.09%** and **40.49%**. Two chart sets, different vendors, neither naming a
solver, agreeing to within 0.3 points at both ends of the positional range. **That is mild but real
corroboration** — and it is the only instance of independent convergence found anywhere in this
survey. It also sits in sharp contrast to the free *text* charts of §2.9, which disagree by 45%.

### 2.22 S29 — Jonathan Little: readable full-ring text ranges

Free and text-legible. Full-ring/8-max **CASH 100bb**. Solver unnamed (PeakGTO is the house solver
but is not attributed to these charts); **live-vs-online unstated; no sample.**

| Pos | % | Range (verbatim) |
|---|---|---|
| UTG | 11.4% | `77+, A3s+, K9s+, QTs+, JTs, T9s, AQo+, KQo` |
| UTG+1 | 13.2% | `77+, A3s+, K8s+, QTs+, JTs, T9s, AJo+, KQo` |
| LJ | 15.7% | `66+, A2s+, K7s+, QTs+, JTs, T9s, ATo+, KJo+` |
| HJ | 19.6% | `55+, A2s+, K5s+, Q9s+, J9s+, T9s, ATo+, KTo+, QJo` |
| CO | 26.1% | `44+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, 54s, A8o+, KTo+, QTo+, JTo` |
| BTN | 40.3% | `22+, A2s+, K2s+, Q3s+, J5s+, T6s+, 96s+, 86s+, 76s, 65s, 54s, A3o+, K8o+, Q9o+, J9o+, T9o` |
| SB | 73.9% | `22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 84s+, 73s+, 63s+, 52s+, 42s+, A2o+, K2o+, Q3o+, J5o+, T6o+, 96o+, 86o+, 75o+, 65o, 54o` |

**These track S28's frequencies closely** (11.4 vs 10.09 · 13.2 vs 13.29 · 15.7 vs 15.80 · 19.6 vs
19.76 · 26.1 vs 25.62 · 40.3 vs 40.49) at every seat **except SB (73.9% vs 46.36%)**, where they
disagree by a factor of 1.6. That is not a rounding difference — it is a different strategic
assumption about whether SB opens wide (raise-or-fold) or narrow. **Presented, not resolved.**

**His downloadable 14-page PDF is genuinely 9-handed** (UTG…BB, RFI + facing-RFI + vs-3bet) but
states verbatim: *"The charts assume 100 big blind effective stacks **with an ante in play**. They
apply to roughly 50 big blind stacks and larger."* **The ante disqualifies it as a live $1/$2 chart**
— live $1/$2 has no ante, and the ante is exactly the term that widens ranges. Sizings, verbatim:
*"IP: 2.5bb open, 3-bet 3× the raise, 4-bet 2.5× the 3-bet. OOP: 3.5bb open, 3-bet 3.5×, 4-bet
2.75×."* Grids are images.

**His actual live-specific artefact** — *Small Stakes Cash Games Preflop Charts*, explicitly
*"$1/$2, $1/$3 & $2/$5"*, explicitly *"Exploitative, Not GTO"* — is **the closest published thing to
this survey's exact target, and every range is an image behind an email opt-in.**

> **And the disclosure that must travel with his live material:** his live course *Beat Small Stakes
> Cash Games* states its empirical basis verbatim as **"5 documented sessions (20.8 hours, +$2,499)"**
> — roughly 500 hands. Recorded not as a criticism but as a provenance fact, because it is the kind
> of number that vanishes between the course page and the chart.

### 2.23 S30 — Selbrede: the only published live $1/$2 population numbers in existence

**Population:** LIVE, Las Vegas, **$1/$2 and $2/$5, full ring**, ~2015–2017.

> **THE PROVENANCE ASYMMETRY, AND IT IS THE MOST IMPORTANT FACT IN THIS SECTION.** Every article
> touching his **online** set quantifies it to the hand — **6,000,000 hands, NL50/NL100, a
> 130,000-player database, top 2,000 by volume vs 119,000 others.** Every article quoting a **live
> Vegas** figure gives **no n, no card rooms, no years.** One article describes the live basis as
> *"just a few hundred live hand histories"* across *"four Vegas card rooms"*. A reviewer of Vol 1
> states the book *"utilizes online poker hands to apply to live games which play similarly but not
> the same."* **The author is rigorous about sample size exactly where the data is online, and silent
> exactly where it is live.**

**Live Vegas $1/$2 population, verbatim:**

| Statistic | Live $1/$2 | (his online comparator) |
|---|---|---|
| VPIP | **35%** (one article says 37%) | — |
| PFR | **6.0–6.1%** | — |
| CPFR (call a preflop raise) | **56.4%** | — |
| 3-bet | **0.8%** | — |
| Preflop call range | **28.0%** | 15.3% |
| Average opening raise | **4.6 BB** | 2.3 BB |
| **Average players per flop** | **4.0** | 2.7 |
| Flops seeing 5+ players | **27%** | — |
| Position-awareness ratio (LP-VPIP / overall) | **1.0** — *identical range from every seat* | 1.2 (his stated optimum: 1.93) |
| Limp survival rate | **~73%** (**~80%** with passive blinds) | — |

EP/MP limping range **[6.1–35]**; limp-calling range **[6.1–22.7]** (Flopzilla percentile notation).

**Prescriptions, verbatim:**
- Recommended live line **VPIP/PFR 18/9** (vs his online optimum 15/12)
- BTN vs **1 limper**: profitable raising range **27.6% = `22+, A2+, KT+, QJ`** — *a second figure in
  the same article gives 33.6%*, unreconciled
- BTN vs **4 limpers**: **13.4%**
- **Sizing: "4× BB plus one additional BB for each limper"** → $8 / $10 / $12 / $14 / $16 for 0–4 limpers
- Heuristic: **CO facing X limpers ≈ BTN facing X+1 limpers**
- BB vs single limper with 22: MEV check **$2.37**, MEV raise-to-$10 **$2.55** (Δ **+$0.18**); fold
  equity **43.6%**; showdown equity when called **45.4%**
- BTN vs single limper with 22: MEV limp **−$0.38**, MEV raise **+$0.63**
- **Straddle tax ≈ 1.2 BB, versus ≈ 0.9 BB for both blinds combined** — *the straddle costs more than
  both blinds together*
- Position value **≈ 13 BB / 100 dealt** (BTN vs UTG); skill + position **≈ $0.80 per button** at Vegas $1/$2
- Set-mining: **12% chance of flopping a set or better**
- Online only: **"Never donk bet on the flop online"** (donking 14% of the time *"more than
  quintuples our loss"*) — and **explicitly left unresolved for live** (D-list)

**Grades split by content type.** **A** on the isolation thresholds, the sizing formula, the
structural priors (4.0 players/flop, 27% of flops 5+, 28% call range, 4.6bb average open, 73/80% limp
survival) and the straddle tax — every input observable, every output a number. **C** on VPIP 35 /
PFR 6.1 / CPFR 56.4, because **no n means a prior of unknown weight**: encode with a deliberately weak
weight, per the repo's own measured overdispersion result (effective prior weights ≈ vpip 10 · cbet
13 · pfr 21). **D** on live donk-betting.

**His by-seat "Donkey Games Starting Hand Chart" (the 18/9 grid) is book-locked and was not
recoverable.**

**The structural priors are worth more to this repo than the prescriptions.** *4.0 players per flop
and 27% of flops five-way* is a statement about the **shape of the game** the founder plays, and it
is the number that most directly indicts the heads-up published corpus (§8).

### 2.24 S31/S32 — the only two live samples with stated n

**S31 — Hand2Note Live Poker Database.** **MEASURED.** Population: **live streamed/broadcast** games
(YouTube stream → hand-history conversion; the Hustler Casino Live / Live at the Bike class),
**$2/$5 through $100/$200 — no $1/$2**, 2024–2026. **Sample: 1,023,168 hands / 37,894 players / 19
channels**; analysis subset **242 TAG players, ~500,000 hands**. The method captures **every hole card
including preflop folds**.

- Winning-TAG stats: **VPIP/PFR 31/20** (some cuts 33/20 or 37/21) · **AF 1.6** · **WWSF 40%** ·
  **3-bet 13%** · **fold-to-3bet 26%** · **call-vs-4bet 40%**
- **Players on flop: 2-way 45% / 3-way 24% / 4+ 31%**
- Win rate by stake (242 TAGs): $2–5 **95 bb/100** (52k hands) · $5–10 **56** (105k) · $10–25 **41**
  (38k) · $25–50 **37** (123k) · $50–100 **35** (58k) · $100–200 **49** (56k). Overall **51 EV bb/100
  ≈ 15 bb/hr**
- Stack-depth win rates (≤$5/10): 0–300bb **57 bb/100** (var 50) · 300–600 **67** (66) · 600–1000
  **98** (87) · 1000–2000 **78** (114) · 2000+ **113** (379)
- **Structure, directly load-bearing:** **straddle present in 85% of $2/5–$5/10 games and 65% of
  higher stakes; antes in 40% of lower and 80% of higher; straddle ≈ 2× variance, ante ≈ 1.5×; live
  variance overall "10 times higher" than online**
- Hands/hour: **live 20–25** (online 60–100/table)

**Grade B.** Hard, observable, n stated — but the published cuts are **winning TAGs in streamed $2/5+
games**, not the $1/$2 population. **Named closing assumption** (`P-H2N-TRANSFER`, §3): *streamed
$2/5 TAG behaviour is an upper bound on $1/2 reg behaviour, and the $1/2 population is looser and more
passive by roughly the Selbrede live-vs-online delta.* Positional range grids exist on the Help page
as **images only**; a manual screenshot would upgrade this to A.

**S32 — Doug Hull's personal live $1/$2 records.** **MEASURED**, live $1/$2, Mirage Las Vegas, **one
player**: **$12,000 / 310 hours / $39 per hour = 19.5 bb/hr · 136 sessions · 67% winning / 31% losing
/ 2% breakeven · average session 2.25 hrs · average win $88 · SD $208/hour, $293/session.** He calls
it *"a small sample size."*

**This is the only published per-hour standard deviation for live $1/$2 found anywhere**, and it is
directly usable as a variance prior. It is **not** a population statistic — it is one player. Note it
sits at 19.5 bb/hr, i.e. within the same band as the Goone/Murray challenge results already recorded
in `live-winrate-benchmarks.md`, and far above that document's 8–12 bb/hr consensus — the same
selection effect, arriving from a third direction.

### 2.25 S33/S34 — Ed Miller

**S33 — *The Course* (2015).** Population: live **$1/$2, $2/$5, $5/$10**, US card rooms, full ring.
**Sample: none — asserted from experience.** No database, no solver cited.

- **Opening frequencies by seat: EP ~14%, CO ~22%, BTN ~33%.** His Card Player column (2016-10-11)
  gives *"out of position ~15%"*, *"button ~35%"*, CO/LJ between.
- **The only Miller range published in standard notation anywhere on the web (CO, 22%):**
  `22+; A2s+, K7s+, Q9s+, JTs-43s, J9s-53s; ATo+, KJo+` — composition **27% pairs / 49% suited /
  25% offsuit broadway**; hits the flop (weak pair+ or gutshot+) **64.9%**
- *"Most small-stakes players bluff less frequently than one-third of the time"*; at $1/$2–$2/$5 a big
  turn or river bet means the hand represented
- Barreling breakevens: **½ pot → 33%, ¾ pot → 43%, pot → 50%** *(this is alpha — see §5 Collapse 6)*
- **Deep = 300 BB or more**
- Red Chip articles: a ⅓-pot flop/turn bet needs *"more than 25 percent"* folds; 3-bet the blinds
  *"at least 20 percent of the time"* vs a steal, where a steal is *"a raise made with at least 25
  percent of all hands"*, with **99+, AJ+, KQ+**, small pairs, **K-8s, A-3s**, suited connectors — and
  explicitly **not** KT/QJ/JT
- Card Player 2016-11-26: *"bet 70 percent of the time in this situation"* (one specific $2/$5 turn
  spot, $1,500 stacks)

**Grade B.** The positional frequencies are real numbers and the CO range is fully enumerated.
**Named closing assumption** (`P-MILLER-EXPAND`, §3): *expand and contract the CO combo list along an
equity-percentile ranking to hit 14% / 22% / 33% at the other seats.* Once you do that it is **Miller's
shape on our grid**, and the card must say so. Skills 2–3, 5–7, 9–10 are **C to D** — prose.

**S34 — *Poker's 1%* (2014).** **Population: none.** It is frequency theory derived from indifference
algebra (a bettor with any two cards must not profit), **not from a solver and not from data**. One
reviewer characterises the headline number as *"a directional truth, not a precise GTO value."*

- Core rule: **defend ~70% of your range on the flop, ~70% again on the turn**
- Worked example: preflop calling range **12.7% = 168 combos** → flop defence target **118 combos** →
  turn defence target **76 of 109**; a typical player folds **57%** on the turn (over-folding);
  *"gross folding mistakes"* band **50–60%**; **14 combos** of value+bluff raises; bet line
  $15 / $30 / $65 into $37 → $97 with $500 stacks

**Grade B**, with the assumption that 70% corresponds to roughly half-pot sizings (`P-MILLER-70`, §3).
**It is not a live prescription and must not be labelled one** — the book makes no population claim at
all. Note it is also the upstream of Red Chip's 60%-barrel rule via Janda (§5).

### 2.26 S35/S36 — Fitzgerald: the densest source, and the wrong population

**S35 — *The Myth of Poker Talent*.** **Population: ONLINE tournaments.** The methodology is explicit
and visible in the published extract: **Holdem Manager 2 "Tournament Reports" → Quick Filters →
"Check Raise Flop"**, then **Flopzilla**. The foreword credits *"his statistical database work and
HUD analysis"* and *"huge sample sizes of decisions and outcomes"* — **with no number given anywhere.**

**The most numerically dense source in the entire survey:**

- **Target predicate: opponent opens ≥20% AND c-bets ≥75% → check-raise.** *"You can guess that he's
  part of the 95% of players that open a greater than 20% range."*
- **Check-raise sizing 80–100% of pot** out of position
- **Air arithmetic:** you hit the board **33%**; typical c-bet frequency **75–80%**; **33/80 = 0.4125
  → 58.75% air.** If he also checks back small value: value = **25%** of a 75% range → *"nothing
  two-thirds of the time"*
- **>80%** of surveyed players check back small/medium showdown value
- Worked breakeven: check-raise 30,600 into 63,150 → needs **48.46%**; villain must defend **51.55%**;
  "any pair or any draw" on that board = **51.6%** — i.e. *exactly* breakeven, so any fold beyond it
  is profit
- **Blocker math: 12 combos of each Ax vs 4 of each pair.** On J-7-3 vs a 21% c-betting range, villain
  defends middle-pair-or-better **46.8%** — **49.0% if you hold a bare ace.** *"You would be better off
  here if the dealer did not deal you a hand."* Sole exception: the ace that blocks the nut flush draw.
- Preferred check-raise holdings: **broadways** (no Ax blocking, clean overcards), **small pairs**,
  **backdoor flush draws**; avoid bare aces
- **Fold-c-bet-to-raise is unusable — sample *"usually close to three hands."*** *"0 out of 3 should
  convince you to fold when you're on the fence, but if everything else lines up you should not be
  dissuaded."* — **a published small-sample warning, and a good one**
- Win-rate frame: a good MTT rate is **5 BB/100**; folding every BB costs **100 BB/100 from that seat**
- *"He's likely to have missed 60% of the time. That's true for most boards."*

**Grade A** on the opponent-qualification predicate, the sizing rule, the blocker arithmetic, and the
small-sample warning. **The population caveat is severe: this is online MTT.** Encode it as an arm and
let the backtest say whether it transfers — which is exactly the treatment this document argues for.

**S36 — *Exploitative Play in Live Poker* (D&B Poker, Dec 2018).** Titled live; the author is an
**online tournament** pro; the publisher describes his basis as **hand-history database analysis**;
**every worked example in the sample extract is a tournament hand.** He references a live database
once — and reports it had **so few 3-bets that *"the note taker considered not keeping the stat
anymore."*** **Sample: none stated.**

- Call BB raises **up to 2.75× BB; up to 3.25× with antes**
- *"Any player opening from the lojack or later these days is statistically more likely to be opening
  20%+ of the hands than not"*
- A typical c-bettor's no-pair-no-draw holdings = **50–60% of range**
- **Board classes to attack:** one high card + two low cards with a draw (K-3-6) · low boards (2-3-6,
  7-5-4) · coordinated boards (10-9-8). **Avoid:** two-Broadway-with-a-ten (K-10-x, Q-10-x) and
  ace-high. Q-J-3 marginal; *"chicken boards"* (3-3-2r) only at the right stack depth
- Fold-equity claims: **"secured a fold 70% of the time"** on the good textures; bet/folding **60%+**;
  opponent has nothing **as much as 70%** on low boards
- Stacks: **25–35 BB** for tournament check-raise bluffing; **25–40 BB** the sweet spot; at 23 BB a 3×
  c-bet raised to **7.9×** forces the jam; a flop 3-bet risks **20–25% of stack**
- River excerpt: 50bb start, 3× open, 4× flop, 10× turn (vs *"traditional 7×"*), pot 34×, stack 33× —
  *"12 big blinds is more than what aces make on average"*

**Grade B.** Board classes and stack bands are observable; the two load-bearing inputs — *"opens too
much"*, *"c-bets too much"* — are only partly quantified here. **Named closing assumption**
(`P-FITZ-QUALIFY`, §3): *import the explicit 20%-open / 75%-c-bet thresholds from S35 to close the gap.*
That makes S35 and S36 **one arm, not two.**

### 2.27 S37 — Doug Hull's flop decision table

Population: live **$1/$2** — Mirage, Hollywood Casino, a charity game. Every hand carries
`$1-$2 | Action | Hand | Starting Stack` with seat labels and villain-type labels. Equities computed
in **Flopzilla**, *"rounded to nearest 5%"*.

**The 16-flop decision table**, three columns per board — *our equity vs his range / % of his range
that "hits" / our equity vs his hit-range*:

| Board class | Our eq vs range | % of his range that hits | Our eq vs hit-range |
|---|---|---|---|
| bet-for-value | **85** | **45** | **75** |
| semi-bluff | **75** | **40** | **60** |
| standard c-bet | **45** | **35** | **15** |
| hard-to-hit board | **55** | **25** | **25** |
| bluff-catcher | **60** | **55** | **45** |
| bluff-catcher | **45** | **70** | **30** |
| bluff-catcher | **60** | **55** | **50** |
| bad board | **35** | **60** | **25** |
| bad board | **35** | **45** | **25** |

**"Hits" is defined verbatim** — *set, two pair, pocket pair below top pair, middle pair, flush draw,
OESD, gutshot* — which is a **concrete, encodable predicate** and one of very few in the live corpus.

Other numbers: a CO calling range labelled **25%** that *"hits this flop about 20% of the time. Half
of those times with an overpair, a third of the time with just top pair"*; *"only 10% of the time does
he have a hand strong enough to bet here"*. Villain-holding table: **trip aces 25% / underpair 20% /
air 55%**. Sizing *"one-third to one-half the pot"* to mimic a value bettor. Combinatorics: vs an
AK-ish range, *"almost 45% of the time he does not hold an Ace… suited combinations only, then 65%."*

**Set-mining, with the only stated derivation in the corpus** (separate article, **1,000
simulations**): vs a nit, mutual hits **7%**, mutual misses **39%**, villain-only **50%**, hero-only
**4%**; **~80% equity when the set connects**; *"7.33 bad flops for every good flop"* → **set-mine
multiplier ≈ 15×**.

Podcast: *"raising the button something like 50% of the time if it's folded to you"*; nit 3-bet range
**QQ+**, fold AK to it.

**Grade A** on the set-mining rule. **Grade B** on the flop table: it publishes all three equity
columns for 16 boards and **never states the bet/check cut**. Inventing that cut makes it our rule
(`P-HULL-CUT`, §3). **Ranges are highlighted grid cells; the highlighting is not text-extractable, so
the actual hand sets are unrecoverable from the PDF.**

**Hull is the least-copied and most live-native author in the corpus** — his examples appear nowhere
else, which under §5's shared-origin analysis makes him disproportionately valuable.

### 2.28 S38 — SplitSuit: the live HUD sampling model

Live $1/$2 focus, **no sample stated anywhere**, asserted. Candid about provenance: *"I played a lot of
full ring online, so I have a solid understanding of stat ranges per player type."*

**The live HUD sampling model — genuinely useful, unique, and grade A**, because it is a statement
about *observability* rather than about strategy: **~5 hands per hour per player; ~33 hands/hour
observed at the table; 1 hour → VPIP/PFR only; 2+ hours → low-frequency stats like 3-bet.** Worked:
VPIP 12% from 4 actions in 33 opportunities; 3-bet 1.5% from 1 action in 2 hours. Reliability ladder:
**40 hands = broad idea, 100 = good, 300+ = great**.

This is directly relevant to the repo, which already refuses per-player leak rankings at 35–51
observations per player because *"a ranking of measured leak is a ranking of noise"*. **SplitSuit's
model is the same conclusion reached independently from the table side, and it quantifies the arrival
rate.**

Other content: player classification **TAG full ring ≈15% VPIP** (6-max ≈20%) · **nit <10% FR** ·
**fish 40%+**. 3-bet map: **KK+ = 0.9%**, **QQ+/AK = 2.6%**, **TT+/AQ+ = 4.7%**; a 12/8 nit → **1.2%**
3-bet; a 27/23 LAG → **9.6%**. Sizing: 3-bet **IP 2.5–3× the open, OOP 3–4×, <40BB 2.2–2.5×**; vs
limpers **"3bb + 1× per limper"**; value ≈ **90% pot**, bluff ≈ **½ pot**, default **⅔ pot**.
**SPR: <3 auto-stack-off with top pair or better; 3–6 situational; >6 not a default stack-off**;
SRP SPR ≈13; 3-bet pot 3.5–5. Rates/rake: live **20–30 hands/hr**; live rake **10% capped $5, or
$5+$1**; $1/$2 → **$20/hr = 10bb/hr**, $2/$5 → **$40/hr = 8bb/hr**, $5/$10 → **$50/hr = 5bb/hr**;
bankroll 20–30 buy-ins. Small pairs (guest author): **25× rule**, flop a set **≈12%**, breakeven
**8.5×**, stop below **20bb**.

> **⚠ Internal inconsistency, recorded.** SplitSuit publishes **three mutually inconsistent
> early-position opening ranges on three current pages for the same population**:
> `77+/ATs+/KJs+/QJs/AKo`, `TT+, AQ+, AJs+`, and `88+, AQ+, AJs+, KQs`. **The first is roughly twice
> the width of the second.** No page cites another; none states stack depth or table size. **An
> encoder picking one is picking arbitrarily** — so all three, or none.

**Grade A** on the sampling model, SPR bands, sizing formulas, and the range→% map. **Grade C** on the
opening ranges, for the reason above.

### 2.29 S39 — BlackRain79: the only full-ring vs 6-max stat split found

**Population: ONLINE micro NL2–NL25, PokerStars/888 era ~2014–2019. Never live.** Sample claimed as
*"millions and millions of hands"* in PokerTracker — **no count, no date range, no site breakdown,
ever.**

His HUD table carries a **separate full-ring column** — the only stat-by-stat FR/6-max split found
anywhere in the survey:

| Stat | 6-max | **Full Ring** |
|---|---|---|
| VPIP / PFR | 20 / 17 | **15 / 12** |
| AF | 3 | **3** |
| 3Bet% | 7 | **6** |
| Fold to 3Bet | 65 | **70** |
| ATS | 35 | **30** |
| Fold to Steal | 70 | **75** |
| Flop / Turn / River CBet | 70 / 50 / 50 | **70 / 50 / 50** |
| Fold to Flop / Turn / River CBet | 60 / 40 / 40 | **60 / 40 / 40** |
| WTSD% | 27 | **25** |

> **⚠ These are his TARGET values for a good winning reg — NOT measured population means.** That
> distinction is not prominent on the page, and it is **the likeliest way this table gets misused as a
> prior.** Note also that the postflop rows are *identical* across formats, which is a strong tell that
> they were not measured per-format.

Also: **VPIP >40 = fish**; **AF ≥3 = LAG**; **fold-to-3bet ≥60% → attack from LP**; VPIP−PFR gap
*"roughly 3 points"*; archetype lines **24/2** (loose-passive) and **56/5** (whale). He concedes the
FR-vs-6max question honestly elsewhere: *"I do not have all of the data."*

**Grade A on form, C on provenance.** Every cell is a HUD-observable number; the population is wrong
and the values are prescriptive rather than descriptive.

### 2.30 S40 — the straddle deltas, and the only stated opposing-sign mechanism

Dan B., Upswing, 2025-04-18. ClubWPT Gold = **8-max with a mandatory straddle + 0.5bb ante.**

| Quantity | Without | With straddle + ante | Δ |
|---|---|---|---|
| LJ RFI | **18.5%** | **~21%** | **+2.5 pts** |
| CO defence vs HJ open | **10.5%** | **14.2%** | **+3.7 pts (~40% relative)** |
| Price to call facing a 3-bet | **30.3%** | **28.5%** | **−1.8 pts** |

**The mechanism, stated explicitly, and this is the encodable part:** *the ante **loosens** (dead
money), the straddle **tightens** (for players outside the blinds) — the two effects **oppose each
other**.* SB tightens significantly; BB calls more.

**Grade A** on the four quantified deltas and the two mechanism signs; **B** overall (no stack depth,
no solver named). This matters because Hand2Note measures **straddles present in 85% of $2/5–$5/10
live games** — so a straddle correction is not an edge case in live play, it is the default, and this
is the only quantified one found.

## 3. The named parameters every B source needs

This is the §3 the ticket asked for, and its purpose is mechanical: **a gap closed by an unrecorded
assumption is indistinguishable, in the output, from a gap that was never there.** Each parameter
below is a value an encoder MUST choose, given a name so it can be swept and its sensitivity
reported rather than absorbed into the arm's score.

The repo already has the pattern: `KL_FLOOR` is stamped into `manifest.constants` and **swept** into
a `fragility` margin, because *"a KL figure published without its floor swept is a setting, not a
measurement."* Every parameter below is the same kind of object.

| Parameter | Source | The gap | Suggested default | Why it matters |
|---|---|---|---|---|
| **`P-PB-PURITY`** | S1 PokerBench | Labels are the **argmax** of a mixed strategy, filtered to `>50%` dominance. The mixing is deleted. | Encode as a **deterministic** policy and declare it. | An argmax policy is more decisive than equilibrium **by construction**. Any KL against a mixed reference inherits this bias with a known sign. Do **not** treat as `Equilibrium`. |
| **`P-PB-RAKE`** | S1 | No rake model stated. | Assume **ChipEV (zero rake)**. | Zero rake widens every marginal open and every thin call. Against a $1/$2 live game (repo-measured 12.3 bb/100) this is the largest single distortion in the artefact. |
| **`P-PB-FORMAT`** | S1 | 6-max, 100bb. Founder plays 9-handed. | Map 6-max positions onto `getRangePositionCategory` and **declare positions unmapped** rather than inventing UTG+1/UTG+2. | This is the repo's #1 ranked fault (transfer) applied to a *format* axis rather than the usual live/online axis. |
| **`P-PB-DEPTH`** | S1 | 100bb only. | Score only decisions where effective stack ∈ a stated band around 100bb; **census** the excluded rows. | Silently scoring 40bb decisions with a 100bb policy would put the depth mismatch inside the arm's score. |
| **`P-PB-TEXTURE`** | S1 | 11 board-texture categories, not enumerated in retrievable text. | **Re-derive texture from `board_flop`/`board_turn`/`board_river` via `analyzeBoardTexture`.** Do not attempt to recover their categories. | Re-deriving keeps the texture axis *ours*, which is what the founder constraint requires anyway. |
| **`P-RAKE-LIVE`** | S4 GTO Wizard | The only published live rake model: **10%, 2bb cap**. | Adopt as the named live rake parameter. | Usable **entirely independently of GTO Wizard's ranges**, which are paywalled. This is the one number in this survey that can be lifted with a clear conscience: it is a *market fact about card rooms*, not a strategy claim. Still transferred — verify against the founder's actual room. |
| **`P-RC-ROUNDING`** | S8 RangeConverter | Frequencies *"rounded to 50%"* by the vendor. Magnitude of the distortion undocumented. | Unknown. **Do not encode until quantified.** | The vendor has already applied a §11.9-style teachable simplification and not said how much was lost. Scoring it measures *their* simplification, attributed to their solver. |
| **`P-POKERATI-BTN`** | S6 | `K8s+` vs `K8+` in the BTN 200bb offsuit tail. | Encode **both**, report both. | Worth **4.5 points of range width** (39.1% vs 43.6%). Too large to guess. |
| **`P-POKERATI-UTG`** | S6 | UTG 100bb reads `AQ, KQ` — as written this **excludes AK from an UTG opening range**. | Encode **both** `AQ,KQ` (8.6%) and `AQ+,KQ` (9.5%). | If the arm scores better with AK excluded, the chart is not what anyone thinks it is. |
| **`P-3BET-BLUFF-FREQ`** | S7 | 3-bet bluff components are listed as hands (`bluffs: A5s, 65s`) with **no frequency**. | Sweep {100%, 50%, 33%}. | A solver 3-bets `A5s` at a mixed frequency; the chart states presence only. The bluff frequency is the entire difference between a linear and a polarised 3-bet range. |
| **`P-DEEPFOLD-WIDTH`** | S13 | Ranges given as prose ("Most suited cards"), percentages given exactly. | Build a range of the stated width by equity ordering. | **Explicitly makes this OUR arm.** It tests "is a 14%-wide UTG range better than an 11%-wide one" — a real and useful question that is **not a test of DeepFold**, and the card must say so. |
| **`P-SOLVER-RAKE`** | S2/S3 | Neither open-source solver models rake. | Solve at ChipEV; declare. | Combined with `P-SOLVER-PLAYERS` this bounds what an in-house SRC-013 could ever claim. |
| **`P-SOLVER-PLAYERS`** | S2/S3 | Both are **2-player**. | Restrict any generated equilibrium to heads-up-by-the-flop spots; **census** everything multiway as `unexamined`, with reason. | The repo's census already distinguishes `observed-zero` / `unexamined` / `dropped`. Multiway is `unexamined`, and must never read as `observed-zero`. |
| **`P-SOLVER-BUNCHING`** | S2 | Bunching supported for ≤4 folded players; a 9-handed table has up to 7. | Enable bunching at its 4-player maximum; declare the shortfall. | Partial correction, honestly stated, beats none. |
| **`P-NUT-ADVANTAGE`** | S14 | The variable that reconciles S14's ten c-bet frequencies (92% at ~56% equity vs 34% at ~53%) is **"nut advantage"**, and **it is never quantified anywhere in the corpus**. | Define it ourselves: top-of-range mass above a stated equity percentile. **Label it ours.** | **The highest-value missing primitive in the postflop survey.** Without it, S14 encodes as ten points with no interpolation rule, and any curve drawn through them is our curve. |
| **`P-TEXTURE-CLASS`** | S15 | Texture classes are named **by example** ("K-7-2", "9-8-4(FD)"), never by predicate. | Map to `analyzeBoardTexture` outputs: *(broadway rank count, paired, max rank gap, flush-draw present)*. Declare the mapping. | This is `boardTexture.js` doing the source's work for it. The arm then tests **our** classifier carrying **their** frequencies — state that on the card. |
| **`P-CBET-INTERPOLATE`** | S14/S15 | Ten named boards, or nine named classes. Everything between is undefined. | Nearest-class assignment, **no interpolation**; census every board that lands in no class as `unexamined`. | Interpolating would silently convert a grade-A ten-row table into a grade-C surface while it still reads as PioSolver's. |
| **`P-VALUE-NO-RAISE`** | S22 | *"Value bet if you beat the calling range >50%"* holds **only if villain never raises**. | Encode as stated; report the raise frequency at each scored node alongside. | The threshold is exactly 50% only in a no-raise game. With a raise branch the true threshold is above 50% and depends on the raise frequency — which the repo measures and the source does not. |
| **`P-RIVER-PREMISES`** | S22 | The bluff-catch indifference table assumes: river only · bluffs exactly 0% equity · value beats the *whole* catching range · call closes action · **no rake** · **no card removal**. **Not one source mentions the last two.** | Encode with all six declared. | Rake and card removal are both first-order at $1/$2. A river table that ignores both is a different game, and the repo's own `Required fold` already names the zero-equity premise the same way. |
| **`P-W34Z3L-SAMPLE`** | S20 | **39% drawy / 43% dry** fold-to-c-bet, from an HM2/PT4 database with **no sample size, no stakes, no pool, no era**. | **Do not encode as a prior. Encode as a hypothesis to falsify** against the repo's own 10.6M-decision fold-vs-size curves split by `wetScore`. | It is one of only two measured claims in the whole postflop survey, and it contradicts the doctrine built on top of it. The repo can test it directly — which is far more valuable than adopting it. |
| **`P-JANDA-BALANCE`** | S22 | Janda's 34.3% / 49% / 70% value shares describe a **balanced** range. | Adopt the **arithmetic** (`b/(1+2b)`); refuse the **imperative**. | The repo's corpus measures the field at roughly **93–95% value** on called big river bets vs Janda's 70%. Encoding the prescription would score "how balanced are we", which is not the question. |
| **`P-MDF-RAISE`** | S21 | MDF/alpha *"only work for the initial bet"* — facing a raise they detach from raise-as-%-of-pot. | Already handled correctly in-repo (separate raise formula; facing-a-raise fold arm fit separately and never merged). | Recorded as **external confirmation of a decision the repo already made**, not as a change. |
| **`P-RC-RAKE`** | **S28** | The 9-max live-cash chart set **does not state its rake**, while the same vendor names rake on its 6-max charts. | Sweep against `P-RAKE-LIVE` (10%/2bb cap) and ChipEV. | Live 10%-capped rake is not the online rake these solves may assume, and the vendor's selective silence is conspicuous. The best artefact in the survey has this one hole. |
| **`P-SELBREDE-WEIGHT`** | S30 | Live $1/$2 population stats (VPIP 35, PFR 6.1, CPFR 56.4) with **no n stated, ever**, from an author who states n precisely for all his online work. | Encode as a prior with a **deliberately weak** weight. | The repo has *measured* effective prior weights from between-player overdispersion (vpip ≈10, cbet ≈13, pfr ≈21). Selbrede's live numbers deserve **less** than those, not more, because the sample is unknown rather than small. |
| **`P-H2N-TRANSFER`** | S31 | 1.02M measured hands — but of **winning TAGs in streamed $2/5+ games**, not the $1/$2 population. | *Streamed $2/5 TAG behaviour is an upper bound on $1/2 reg behaviour; the $1/2 population is looser and more passive by roughly the Selbrede live-vs-online delta.* | The only live dataset with a stated n, and it is measuring the wrong tail of the wrong stake. Naming the assumption is what keeps it usable. |
| **`P-MILLER-EXPAND`** | S33 | Miller publishes **one** enumerated range (CO, 22%) and three frequencies (14/22/33%). | Expand/contract the CO combo list along an equity-percentile ranking to hit the other frequencies. | The result is **Miller's shape on our grid**. The card must say so — otherwise a chart we built reads as Miller's. |
| **`P-MILLER-70`** | S34 | "Defend ~70% flop and turn" is derived from indifference algebra with **no stated bet size**. | Assume it corresponds to roughly half-pot sizings. | Without a size the rule is not a predicate: MDF at half-pot is 66.7%, at ¾-pot 57.1%. The 70% only means something once a size is pinned. |
| **`P-FITZ-QUALIFY`** | S35/S36 | The live book's two load-bearing inputs (*"opens too much"*, *"c-bets too much"*) are unquantified there. | Import the explicit **≥20% open / ≥75% c-bet** thresholds from *The Myth of Poker Talent*. | This makes S35 and S36 **one arm, not two** — and the imported thresholds come from an **online MTT** database, which must ride on the card. |
| **`P-HULL-CUT`** | S37 | The 16-flop table publishes all three equity columns and **never states the bet/check cut**. | Choose a cut; sweep it. | Inventing the cut is inventing the rule. The table is otherwise the most concrete live-native artefact found. |
| **`P-SETMINE-MULT`** | S37 + others | Set-mining multiplier published as **15×** (Hull, from 1,000 simulations — the only stated derivation), **25×** (SplitSuit/Peckaitis, asserted, states breakeven 8.5×), **20×** (Miller, asserted). | **Encode all three as separate arms.** | A 15× rule and a 25× rule **disagree by 67% on the same decision**, and no source cites or reconciles with another. Averaging would manufacture a consensus that does not exist. |
| **`P-SPLITSUIT-EP`** | S38 | **Three mutually inconsistent EP opening ranges on three current pages** for the same population; the widest is ~2× the narrowest. | Encode all three, or none. | Picking one is picking arbitrarily, and the arm would carry the author's name while reflecting the encoder's coin-flip. |
| **`P-BR79-PRESCRIPTIVE`** | S39 | The FR/6-max HUD table is **target values for a good reg**, not measured population means — and the postflop rows are identical across formats. | Never use as a Field prior. Usable only as a `Declared` opponent model. | This is the single likeliest misuse in the whole survey: a clean-looking stat table that reads as a measurement and is a recommendation. |
| **`P-SIMPLIFY-TOLERANCE`** | S17 | How much a size simplification may cost before it matters. | Published anchors: single-size restriction ≈ **0.02bb (~2bb/100)**; Dynamic Sizing captures **99.7%** of EV. | Gives the repo an external yardstick for its own teachable simplifications — §11.9's 15-number rule recovered ~56% of the engine's *narrowing* edge; this says a sizing simplification costs far less. Different quantities; do not conflate. |

---

## 4. The D list — what the field prescribes but cannot specify

**Recorded, never discarded.** A prescription that cannot be turned into a predicate is a finding
*about the prescription*. The pattern in this list is sharper than any individual entry: **the
published material is most confident exactly where it is least specifiable.**

### D1 — Pluribus, and the shape of the hole

The only superhuman **6-player** NLHE agent ever built (Brown & Sandholm, *Science*, 2019). Format
match closer than anything else in existence. **Strategy never released**; contemporaneous coverage
was explicit that the concern was the online-poker economy. There is no artefact, no chart, no API,
no weights. **Unencodable, permanently, and it is the closest thing to what this repo wants.**

### D2 — "Level 2 / Level 3 thinking"

Recurs across the live-strategy literature. No observable distinguishes a level; no prediction
follows from a level assignment. It cannot generate a predicate over game state because it is a
predicate over an *unobservable mental state of the opponent*, inferred from the very actions it is
supposed to explain. Grade **D** by construction, not by underspecification.

### D3 — "Play the player, not the cards"

Universal, and unencodable as stated. The repo's `Read` surface is precisely the operationalisation
of this — a fitted per-villain model — and its existence shows the prescription is *directionally
right and informationally empty*. Recorded because its absence from an encodable list is not an
oversight.

### D4 — Sklansky–Malmuth hand groups: encodable but legally blocked

Groups 1–8 constitute a complete 169-cell partition with positional action rules — **structurally a
grade-A arm**, and the only fully-specified *live full-ring* hand classification in the poker canon.
It is **withdrawn from the open web at 2+2 Publishing's request**; one surveyed source states this
explicitly. This is a **licensing** blocker, not a specification one, and the distinction matters:
D2 and D3 could never be encoded, D4 could be encoded tomorrow from a purchased copy. Its population
(live full ring, pre-2000, asserted from experience, no sample) is a separate and severe problem —
but it is the *only* canonical source whose target population actually matches the founder's.

### D5 — "Live players are more passive / more attached to their hands / play more straightforward"

The universal live-vs-online claim, and the one this repo most needs to be true or false with a
number attached. **No surveyed source attaches one.** It is asserted everywhere and quantified
nowhere. This is the same absence `live-winrate-benchmarks.md` §7.4 already recorded from the
winrate direction, arriving from the strategy direction and looking identical.

### D6 — Every "adjust versus a bad player" prescription

The live literature's core content, and it collapses without exception into "widen against loose,
tighten against tight" with no threshold on either side. Encodable only by inventing every number,
at which point it is our arm with their name on it (**grade C at best, D as written**). The
underlying quantity is real and the repo already computes it per-villain; the *prescriptions* add
nothing to it.

### D7 — Bet-sizing "feel"

Sizing advice that terminates in "depending on the situation", "against this opponent", or "use your
judgement". Recorded as a class rather than per-instance because the instances are numerous and
identical.

### D8 — Nut advantage

The variable that reconciles the only real c-bet frequency table found (§2.10) is **never quantified
anywhere in the corpus.** Sources reason with it constantly — *"lacking in the nut department"*,
*"range + nut adv"* — and none defines it. **The highest-value missing primitive in the entire
survey**, and one the repo could define for itself.

### D9 — Multiway c-bet frequency and sizing

*"Smaller"*, *"fewer bluffs"*, *"c-bet more vs the blinds"*, with **zero numbers**. Upswing concedes
in print that *"exact optimal defend frequencies in multi-way pots are a matter of debate, and are
still undiscovered."* **This directly blocks the 9-handed goal**, and it is the postflop mirror of the
structural absence in §8. The lone exception — the closed-form multiway defend formula (§2.18) — is a
*defence* rule, not an *aggression* rule.

### D10 — Delayed c-bet frequency

A near-total failure. Four separate Upswing sources (glossary, Lucid article, quiz, podcast ep4)
publish **not one frequency**. GTO Wizard adds none. The only number found anywhere is a 6-point
deviation from an **unpublished baseline**. A named, universally-taught line with no published
frequency at all.

### D11 — Turn-card favourability, overbet triggers, and "bet bigger on wet"

Three separate prescriptions that share one failure: concrete boards are named, then the rule
terminates in an unquantified judgement — *"very good for your opponent's range"*, *"the bigger your
nut advantage, the larger you can go"*, *"bet bigger on wet boards"*. **"Wet" is never defined
numerically on any surveyed site.** And the doctrine may be *false*, not merely vague: w34z3l's
database says wet and dry fold at the same ~40% (§2.15), and GTO Wizard's own monotone case takes the
**small** size (§2.19).

Related: Ryan Fee's foundational and widely-linked `continuation-bet-c-bet-strategy-position/` (2017)
**contains literally zero numbers**. Red Chip's bet-sizing article states outright: *"We never know
the exact amount we need to bet."*

### D12 — MDF as a decision rule (a source arguing against its own encodability)

Red Chip's **current** published position (w34z3l, Jan 2026) is that MDF should **not** be encoded as
`if X do Y`: *"GTO solutions frequently involve defense frequencies that violate MDF… and yet GTO
solutions are generally understood as being unexploitable."* Two 2026 Red Chip pages on MDF contain
**zero numbers, by design**. Recorded because it is the only instance in the survey of a source
arguing its own material out of encodability — and it is right to.

### D13 — Arithmetically wrong sources (S26)

**Three sites propagate the identical error: alpha substituted for the bluff fraction.**
- **PokerSkill** — value:bluff column reads ½ pot "1:2", ¾ "3:4", pot "1:1", 2× "2:1". Correct:
  1:3, 3:7, 1:2, 2:3. The column is literally `alpha : (1−alpha)`. MDF/alpha columns are fine; the
  ratio column is **D**.
- **BeyondGTO** — states `Value:Bluff = Bet Size : Pot`, concludes 75bb into 100bb → *"3 value :
  4 bluff"* (43% bluffs). Correct is 30%. Table is non-monotonic and self-contradicting. **D.**
- **RiverOdds** — gives two different numbers for a pot-size bet (50.0% and 33.3%) in the same row. **D.**

**Mandatory validation gate before ingesting any ratio: check it against `B/(P+2B)`.** That one test
separates every correct source from every wrong one in this corpus.

**A fourth error, in a grade-A source, and the most likely to be inherited silently:** Upswing's
river-bluffing article (Dan B., 2021-04-06) **mislabels alpha as MDF** — it computes
`33/(50+33) = 39.7%` and calls it MDF. That is **alpha**; MDF is its complement, **60.3%**. The
article is otherwise sound, which is exactly what makes the error dangerous.

**Internal arithmetic that does not close inside otherwise A-list sources** — these are not junk
sites, which is the point:
- `check-raising-strategies` — 2:1 stated, 26 value → 42 bluffs (should be 52).
- `paired-boards-strategy` — 30% call + 30% check-raise = 60% defend vs a 33% c-bet, where MDF is 75%.
- `thin-value-bet-poker-strategy` — states 57% MDF at a 67.8%-pot bet; the formula gives 59.6%.
- `floating-poker-float-strategy` — *"MDF 33% vs half-pot"*; that is alpha. MDF is 67%.
- `reckless-player-mastering-turn-probes` — 49%/53% and 66%/43% bluff-fraction pairs never reconciled.

**Every number ingested must be re-derived, including from grade-A sources.**

### D15 — The one live-measured full-ring corpus, paywalled with a sample nobody has ever stated

Red Chip Poker's *How To Dominate Live* (Kat Martin, 2025-10-28) — 14 lessons including *General Live
Tendencies, Autoprofit Aggressor, Autoprofit Defender, River Defense Variables, Donk Bet Exploit,
Multiway Preflop*. Explicitly **measured**. The complete methodological disclosure, verbatim:

> *"a unique dataset comprised of no-limit hold'em hand histories played at live tables."*

**No count. No venue. No stakes. No years. No collection method.** Public numbers: none except
*"$50/month"*.

**This is the most consequential negative result in the survey.** The field's one live-measured
full-ring corpus — the exact thing this repo's #1 fault says it lacks — exists, is being sold, and has
never had its sample size stated by anyone.

### D16 — Live full-ring opening ranges by position

**Not one live-specific enumerated chart is freely published with readable contents.** Little's are
images behind an email gate; Red Chip's are inside a paid app; Selbrede's by-seat grid is book-locked;
Miller publishes exactly **one** seat; SplitSuit publishes **three contradictory** versions and
enumerates nothing past middle position. **The best available substitute is a GTO 9-max chart (S28)
whose live applicability is an assumption, not a finding.**

### D17 — Range adjustment for limpers

**The thing that defines live $1/$2, and almost nobody quantifies it.** Every live source says raise
bigger. Only **SplitSuit** and **Selbrede** give sizing formulas (`3bb + 1× per limper`,
`4bb + 1bb per limper`). **Only Selbrede gives a range adjustment at all** (33.6% → 13.4% across
1→4 limpers). Everyone else is silent.

### D18 — Multiway postflop, in the live literature specifically

Red Chip sells a course on it; the free page has zero numbers. **No published multiway postflop
threshold exists anywhere in the live corpus** — despite **4.0 players per flop** being, on the live
literature's own measurement, the defining structural fact of the game. This is D9 arriving from the
live side and looking identical.

### D19 — "Nit", "fish", "reg", "LAG", "station" as decision inputs

Used as decision inputs by **every single live source**; defined numerically by only two
(BlackRain79: VPIP>40, AF≥3; SplitSuit: <10% FR, 40%+). **Hull labels a villain "Nit" or "ABC player"
in every hand in his book and never defines either.** This is the archetype problem the repo already
replaced with `Stratum` (§6), observed in its native habitat: a label doing load-bearing work with no
threshold behind it.

### D20 — Live donk-betting

Selbrede solves it **for online** (*"Never donk bet on the flop online"* — donking 14% of the time
*"more than quintuples our loss"*), explicitly states the live answer differs, and **stops**. A rare
case of a source correctly identifying a transfer gap and declining to cross it.

### D21 — The 11 PokerBench board-texture categories

Stated to exist, **not enumerated** in retrievable text. Unencodable *as their categories*.
Sidestepped rather than blocked: the CSV carries raw board columns, so texture is re-derivable
through `analyzeBoardTexture` (`P-PB-TEXTURE`). Recorded because "we could not recover their
categories" and "their categories do not matter" are different facts and only the second is
comfortable.

---

## 5. Shared-origin map

The ticket warned that a parallel investigation found four to five sites presenting one person's
worked examples as consensus. **Confirmed, and the collapse is larger than expected.**

### Collapse 1 — Upswing / Lucid / Doug Polk (verified by live HTTP redirect)

```
lucidgto.com  --301-->  upswingpoker.com/lucid-gto-trainer/  --301-->  lucidpoker.com
```

Both redirects were followed and observed on 2026-08-05. Doug Polk is named as Lucid's founder;
Upswing Poker was co-founded by Doug Polk and Ryan Fee; Upswing image assets still appear on Lucid
pages. **Upswing Poker, Lucid GTO, and Lucid Poker are ONE SOURCE.** Any survey citing "Upswing says
X and Lucid confirms X" is citing Doug Polk twice. Note also that Upswing's editorial output (Mike
Brady, Ryan Fee, Doug Polk) is the upstream of a large fraction of the c-bet-sizing and
bluff-to-value material that circulates as generic advice.

### Collapse 2 — PokerBench inherits GTO Wizard's preflop and `postflop-solver`'s postflop

PokerBench (S1) is **not independent** of GTO Wizard (S4/S5) on the preflop half, nor of
`postflop-solver` (S2) on the postflop half. Any agreement between PokerBench's preflop labels and a
GTO Wizard chart is **identity, not corroboration**. This is the most consequential collapse in the
survey, because PokerBench is the artefact most likely to be encoded first.

### Collapse 3 — the WASM-Postflop / Desktop Postflop / PokerBench engine chain

`b-inary/postflop-solver` is the engine behind **WASM Postflop**, **Desktop Postflop**
(`dylan-chong/desktop-postflop`, a Tauri port), and **PokerBench's postflop labels**. Four
apparently distinct artefacts, **one CFR implementation**. If that implementation has a bug or a
systematic abstraction artefact, it is present in all four and no amount of cross-checking among them
would reveal it.

### Collapse 4 — the anonymous chart sites are unattributable and possibly not independent

S6 (Pokerati), S7 (Preflop Wizard), and S13 (DeepFold) all claim solver derivation, all decline to
name a solver, and none credits any external source. Their numbers **disagree** (§2.9), which is
weak evidence *against* a single shared origin — but it is equally consistent with three independent
hand-simplifications of the same upstream solver output, each simplified along a different axis.
**Unresolvable from the open web.** Treat as three sources of unknown independence, never as
corroboration.

### Collapse 5 — the postflop corpus reduces to FIVE lineages

Nearly every number in §2.10–§2.20 traces to one of five upstreams:

1. **von Neumann poker → Chen & Ankenman, *The Mathematics of Poker* (2006) → Janda** — "alpha" as
   `bet/(bet+pot)`, from the [0,1] and clairvoyance (AKQ) toy games; the idea predates Chen &
   Ankenman in Sklansky's *Theory of Poker*. **Every bluff:value ratio circulating in the field is a
   restatement of this one toy game.** The chain is the deepest collapse in the survey: what reads as
   a body of poker knowledge is one 1928 result, re-derived.
   **"Minimum Defense Frequency" as a named, tabulated concept is a solver-era (post-2015) coinage —
   and not one of the ten MDF pages read cites any source at all.** Six sites publishing an identical
   table with zero citations between them is not six confirmations.
2. **Janda (2013) → Ryan Fee → Upswing (2019)** — the entire street-by-street bluff:value framework,
   plus (via Ed Miller's *Poker's 1%*) Red Chip's 60%-barrel rule. Bluffaces and GTO Wizard's
   *"⅓ ½ ⅔ rule"* are downstream restatements. **Four apparently separate sources, one origin.**
3. **PioSolver, 6-max, ~$1/$2 online, 100bb, BTN-or-CO vs BB** — nine Upswing articles, **all by
   Dan B.**, 2018–2021. One author, one solver, one spot.
   3b. **The "Kanu7" aggregate series** (Upswing, Dec 2019 – Jan 2020) is **one solver run by Alex
   Millar, written up by Mike Brady across four articles.** Four citations, one run.
   3c. **The GTO Wizard blog is two authors, not a corpus** — Andrew Brokos wrote 16 of the articles
   fetched and Tombos21 wrote nearly all the theory pieces. Citing "GTO Wizard" repeatedly is citing
   two people repeatedly.
4. **Lucid Poker GTO Trainer** — the Upswing 2024–2026 cluster (Dan B. + Song-Carrillo). *The tool
   changed; the population did not.* And per Collapse 1, Lucid **is** Upswing.
5. **Flynn/Mehta/Miller, *Professional No-Limit Hold'em*** — SPR thresholds on both Red Chip and
   Upswing. SplitSuit cites it; Upswing gives the same 2/5/10 landmarks **uncited**.

**The "33% pot small c-bet"** appears in six-plus Upswing articles by four authors **with no shared
citation** — house doctrine, most plausibly from the Polk/Fee curriculum. Blackwood's
*"Some players use 25% pot, I use 33% pot"* is the only admission anywhere in the corpus that the
number is a **convention rather than a result**.

**Downstream restatements adding nothing new:** About-Poker, SeekerStart, CoinPoker, PokerSkill,
LearnPokerWithMe, Bluffaces, jarvispoker, BeyondGTO, RiverOdds, PokerExplore.

### Collapse 6 — arithmetic wearing five names (the biggest trap in the live corpus)

The *"your bluff must work X% of the time"* family recurs everywhere with a **different X**, and in
every case X is just `bet/(bet+pot)`:

| Source | Stated | Bet size |
|---|---|---|
| Ed Miller (Red Chip) | *"more than 25 percent"* | ⅓ pot |
| w34z3l | *"more than 40%"* | ⅔ pot |
| SplitSuit | *"33%"* | ½ pot |
| Ed Miller (*The Course*) | 33 / 43 / 50 | ½ / ¾ / pot |
| Fitzgerald | 48.46% | near-pot raise |

**Reading across sites you see five coaches agreeing. They are agreeing with algebra, not with each
other, and none of it is evidence about any population.** Encoding any of these as a
"source-attributed rule" would be **encoding a tautology with a name attached** — which is worse than
encoding nothing, because the name creates the appearance of external corroboration.

### Collapse 7 — genuinely divergent constants presented as settled (the set-mining multiplier)

The inverse failure, and equally important:

| Source | Multiplier | Basis |
|---|---|---|
| Doug Hull | **15×** | **1,000 simulations — the only stated derivation** |
| SplitSuit / Peckaitis | **25×** | asserted (states breakeven is 8.5×) |
| Ed Miller | **20×** | asserted |
| folklore | 10×–30× | — |

**A 15× rule and a 25× rule disagree by 67% on the same decision.** No source cites another; none
reconciles. **Encode the disagreement as three arms, not a winner** (`P-SETMINE-MULT`, §3).

### Collapse 8 — the one place the numbers ARE identical, and it is not measurement

**"Full ring TAG = 15% VPIP / 12% PFR"** appears **verbatim** in:
- **BlackRain79** (2017 HUD table, 2019 PFR article), claiming his own PokerTracker database
- **SplitSuit** (*"TAG Full Ring: ~15% VPIP"*), claiming his own online experience
- bracketed by **Poker Copilot's** full-ring winning-reg band **11/8–16/14**
- and, decisively, called ***"the online optimum"* by Selbrede**, who derived it from **6M hands**

**Four sources, three claiming independent bases, one number.** The likely upstream is **mid-2000s
online full-ring orthodoxy** — the 2+2 / Sklansky–Miller *No Limit Hold'em: Theory and Practice* /
PokerTracker era — **not convergent measurement.** The same pattern holds for **21/18 in 6-max** and
for **"never limp"**, which Hull, BlackRain79 and SplitSuit each present as their own teaching device.

**And note the one dataset that does NOT match it:** Hand2Note's measured winning live TAGs come in at
**31/20–33/20**, not 15/12. A genuine measurement diverging sharply from the folk consensus is
evidence *for* the measurement and *against* the consensus being one.

### Collapse 9 — the live low-stakes canon is Ed Miller's frame with other people's constants

The named upstream author for the live low-stakes frame is **Ed Miller** — but through **vocabulary**,
not numbers:
- Red Chip's flagship live course names two of fourteen lessons *"Autoprofit Aggressor"* and
  *"Autoprofit Defender"*
- w34z3l's entire c-bet article is built on *"generating automatic profit"*
- Miller is himself a **Red Chip coach**, and Red Chip is where **SplitSuit, Hull and w34z3l all
  published**
- Miller co-wrote *STOP! 10 Things Good Poker Players Don't Do* (2015) **with James Sweeney (SplitSuit),
  Doug Hull, and Christian Soto**

**The live low-stakes canon is Ed Miller's conceptual frame populated by other authors' unmeasured
constants.** Separately, the summary-site cluster (`smartpokerstudy.com`, `smartpokerstrategy.com`,
`bookey.app`, `sobrief.com`) all restate Miller — and **Sky Matsuhashi's 2016 podcast page is the only
place on the open web reproducing a single one of Miller's ranges in standard notation.** Any site
quoting *The Course*'s ranges is **quoting Matsuhashi quoting Miller.**

### Collapse 10 — the two genuinely independent live sources, and they should be weighted accordingly

| Source | Why independent |
|---|---|
| **Hand2Note** (S31) | Broadcast-conversion method nobody else uses; **its winning-player 31/20–33/20 does NOT match the 15/12 lineage**, which is itself evidence it is a real measurement rather than a restatement. |
| **Doug Hull** (S32/S37) | Seat-labelled, venue-labelled, Flopzilla-computed $1/$2 hands that **appear nowhere else in the corpus**. The least-copied author found. |

### What is genuinely independent

| Cluster | Independent of |
|---|---|
| GTO Wizard / PokerBench-preflop | everything except each other |
| `postflop-solver` / WASM / Desktop Postflop / PokerBench-postflop | everything except each other |
| TexasSolver | genuinely independent — its own C++ CFR implementation, benchmarked against PioSOLVER |
| HoldemResources Calculator (via FreeBetRange) | genuinely independent |
| Upswing / Lucid | one source |
| Pokerati / Preflop Wizard / DeepFold | unknown, assume dependent |

**Practical consequence: there are at most FOUR independent solver lineages reachable from the free
web** — GTO Wizard, `postflop-solver`, TexasSolver, HRC — and only two of those (`postflop-solver`,
TexasSolver) can be run by us to produce a reproducible artefact.

---

## 6. Vocabulary NOT adopted

Recorded so a later session does not mistake **absence for oversight**. Every term below was
encountered repeatedly in the surveyed material and **deliberately left outside**. The founder's
constraint is the governing one: *"they use language we should only look to and quantify, not to set
a standard for. our standard needs to be as organic as it possibly can."*

### Terms encountered and refused

| Term | Where it recurs | Why refused |
|---|---|---|
| **"GTO"** as a property of a chart | Every single source in this survey | It is used to mean "solver-derived", "approximately solver-derived", "simplified from a solver", and "we think this is good". The repo already has the precise word: a chart is a **`Declared` surface**, and an equilibrium is an **`Equilibrium` surface** which we do not have. Calling a chart GTO is exactly the substitution `equilibriumPost.mjs` throws on. |
| **"Exploitative" vs "GTO" as a binary** | PokerCoaching, Upswing, most sites | The repo's frame is **pier posts** — a strategy is *located between* Pool Best Response and Equilibrium, on a continuum, with a measured `exploitation efficiency`. A binary discards the position. |
| **"Polarized" / "linear" / "condensed" / "merged"** range | Upswing, GTO Wizard, Janda-derived material | These name range *shapes* by eye. The repo has measured, coordinate-free machinery for range shape (equity quantiles, the `intransitivity map`, `rotation planes`). Importing a four-way visual taxonomy would put a label where a distribution already is. |
| **"Wet" / "dry" board** as a *category* | Universal | `boardTexture.js` computes a continuous `wetScore` and only then thresholds it. The published usage is a category with no definition; adopting the word invites treating the threshold as given rather than as a parameter. **`wetScore` is ours and stays ours.** |
| **"Range advantage" / "nut advantage"** | GTO Wizard, Upswing | Both are real quantities, and both already exist here as things computed rather than named — equity distribution comparison and top-of-range mass. Naming them imports the habit of asserting them by inspection. |
| **"Fish" / "reg" / "nit" / "TAG" / "LAG" / "calling station" / "whale"** | Every live-strategy source | Player **archetypes**. The repo has explicitly replaced these with **`Stratum`** — a quantile interval on a *measured, separability-proven* behavioural axis, each carrying its own separability evidence or getting no row. The pool measured as a continuum (`bestK = 2`, silhouette 0.343). Discrete type names re-import thresholds the data cuts through. **This is the single most-refused import in the survey.** |
| **"Level 1 / Level 2 / Level 3 thinking"** | Ed Miller, Alex Fitzgerald, live literature broadly | An unfalsifiable ladder. Nothing observable distinguishes the levels; no prediction follows. Grade D by construction. |
| **"Balance" as a goal** | Janda and all downstream | Balance is a property of an equilibrium strategy. Against a measured, exploitable Field it is a *cost*, and the repo's whole purpose is the premium over playing balanced. The repo's word is `exploitability`, measured, on the y-axis of a `Position`. |
| **"Bluff-to-value ratio"** as a prescriptive target | Janda and all downstream | The **arithmetic** (`alpha = s/(1+s)`) is adopted — it is already in the repo as `Required fold`, exact, with the zero-equity premise named. The **prescription** ("therefore bluff at this ratio") is not: it is the balanced-play recommendation, and against a field measured to fold 12–16 points past bluff-breakeven the correct ratio is not the equilibrium one. **Adopt the identity, refuse the imperative.** |
| **"MDF" / "minimum defence frequency"** | Universal | Already resident: the repo performed an `MDA → MDF` rename deliberately. Named here only to record that it was **already ours before this survey**, and its arrival in a published source is not new evidence. |
| **"Standard" bet sizing** (⅓ / ½ / ⅔ / pot) | Universal | The sizes are usable as a **grid**; the word "standard" is not. It asserts a population fact ("this is what people do") that this repo can *measure* and has — `sizeBucketFor` exists and the corpus has fold-vs-size curves on 10.6M decisions. |
| **"Blocker"** | Universal | Already resident and computed per-combo. Recorded to prevent re-import as a heuristic ("you have the ace of spades so bluff") where enumeration already exists. |
| **"Equity realisation" / "R factor"** | Solver-adjacent material | The repo has `REALIZATION_TABLE` and `preflopFlopEV.js` (7 archetypes replacing flat realization). Importing the published scalar would *replace* a measured structure with a constant. |
| **"Board texture category" names** (e.g. PokerBench's 11) | S1 | Not adopted; **re-derived** via `P-PB-TEXTURE`. Their categories are an abstraction choice made for a different purpose. |
| **"Population tendency"** as a claim | Live-strategy sources generally | The repo's word is **`Field`**, with an id, a population, and a sample. An unsourced "population tendency" is an assertion with a statistical costume. |

### The frame most strongly refused

**The idea that a published chart is a *baseline* to be deviated from.** Every source surveyed
presents its chart as the reference and its exploitative adjustments as departures. That framing
makes the chart authoritative by grammar rather than by evidence. **In this repo a published chart is
an arm**: it enters the ladder at the same door as everything else, it is scored on the same decision
set through the same estimator, and it earns whatever position it earns. This is not a stylistic
preference — it is the WS-291 mechanism, which survived the life of the project precisely because
nothing forced two numbers onto the same axis.

### Terms *adopted*, and the justification for each

Short list, because it should be short. Each is a **measurable quantity or an arithmetic identity**,
not a frame:

| Adopted | As what | Justification |
|---|---|---|
| **Live rake 10% / 2bb cap** (S4) | The `P-RAKE-LIVE` parameter | A market fact about card rooms, not a strategy claim. Still transferred; verify against the founder's room. |
| **`alpha = s/(1+s)`** | Already present as `Required fold` | Arithmetic. Ours independently. |
| Stack depths **100/125/150/175/200/250/300bb**, open sizes **2x–7x** (S4) | A sampling **grid** | A list of values to evaluate at, carrying no claim. |
| Range **strings** in standard notation | Data | A 169-cell function written down. The notation is a serialisation format, not a taxonomy. |

---

## 7. Searched for and NOT FOUND — the absences are load-bearing

- **Any equilibrium solution for a pot with more than two players.** Not free, not paid, not
  academic. `postflop-solver` and `TexasSolver` are both 2-player. Multiway equilibrium NLHE is an
  open computational problem, not a procurement problem.
- **Any published solver solution for a 9-handed table.** The maximum found anywhere, at any price,
  is **8-max** (GTO Wizard, RangeConverter straddle, Upswing ClubWPT). Upswing's "Live Cash 9-Handed"
  chart image is the sole 9-handed *artefact*, and it is images with no configuration disclosed.
- **Pluribus's strategy.** The only superhuman 6-player agent ever built. Withheld by CMU/Facebook
  in 2019 and never released. Confirmed 2026-08-05.
- **Any open-source solver that models rake.** Neither `postflop-solver` nor `TexasSolver` supports
  it. For a $1/$2 live game this is not a detail.
- **Any free, machine-readable range export.** Lucid exports GTO+/Flopzilla format but only on a paid
  tier. Every free chart set found is either images (S4, S5, S8, S9, S10) or prose (S13). The three
  free text-notation sets (S6, S7, and Pokerati's 6-max) are HTML tables, transcribable but not
  downloadable as data.
- **A named solver behind any free chart set.** Exactly one site names its solver (FreeBetRange /
  HRC) and that site's charts are images behind a signup.
- **A stated rake model on any free chart set.** Zero. RangeConverter names rake *labels*
  ("100z", "500z", "GG 200NL") without the underlying percentages or caps.
- **Sklansky–Malmuth's hand groups in full.** Removed from the open web at 2+2 Publishing's request;
  one source states this explicitly. The only fully-specified *live full-ring* hand classification in
  the poker canon is **copyright-blocked from transcription**. (Encodable from the physical book;
  that is a purchase decision, not a research one.)
- **PokerBench's 11 board-texture category definitions.** The paper states there are 11 and does not
  enumerate them in the retrievable text. Without them, PokerBench's postflop rows cannot be mapped
  onto `boardTexture.js` by category — only by re-deriving texture from the raw board columns, which
  the CSV does provide (`board_flop`, `board_turn`, `board_river`). **Not blocking; re-derive.**
- **PokerBench's rake model.** Absent from paper, README, and dataset card. Most likely none.
- **Any source giving the direction of the stack-depth gradient on opening ranges as a rule.**
- **`AHTOOOXA/poker-charts`'s range data.** The repository's `gtowizard-gg-rc.ts` contains
  `// TODO: Add GTOWizard GG R&C chart data` and an empty object. A promising-looking lead that is
  empty. Recorded so nobody follows it twice.
- **Any published LIVE full-ring postflop frequency, of any kind, anywhere.** Zero. Not one c-bet
  frequency, fold-to-c-bet rate, check-raise rate, or barrel rate published for a live 9-handed game
  at any stakes. The nearest live-populated numeric material in the entire postflop survey is a set of
  **SPR commitment landmarks** for $2/$5 (§2.20), which are hand-class verdicts, not frequencies.
- **Any published postflop frequency for the founder's actual stake ($1/$2–$1/$3 live).** Zero.
- **A quantitative definition of "nut advantage".** Reasoned with constantly, defined nowhere. (D8.)
- **Any numeric definition of "wet".** Used as a sizing predicate by most of the corpus, defined by
  none of it. (D11.)
- **A published delayed-c-bet frequency.** Four separate sources on the term, zero frequencies. (D10.)
- **A published "thin value" threshold.** The only value threshold anyone states is `>50% vs the
  calling range`. No "55%+" rule exists in the reachable literature despite being widely believed.
- **Any mention of rake or card removal in the river bluff-catch tables.** Six-plus sources publish
  the indifference table; **not one** names either premise, both of which are first-order at $1/$2.
- **More than TWO measured-from-hands claims in the entire postflop survey.** w34z3l's ~40%
  fold-to-c-bet (no sample size, no stakes, no pool, no era) and one *"~56% unmade hands"* figure from
  a PokerStars $0.02/$0.05 Zoom "mass data analysis" (**sample size not stated**). Everything else is
  solver output or assertion.
- **GTO Wizard's aggregate reports as text.** They exist and they are the A-grade frequency tables the
  survey most wanted; they render as **images**. `mdf-alpha`, `what-are-pot-odds`,
  `aggregate-flop-strategy-sb-c-betting-in-srp`, `how-to-analyze-turn-textures` — all image-borne.
  **This is the one identified route to A-grade aggregate postflop data that text extraction cannot
  reach**, and it is recoverable by browser screenshot + read if the founder wants it pursued.
- **Any published live fold-to-cbet, WTSD, AF, or ANY live POSTFLOP population statistic.** Every
  generic HUD-benchmark page checked (Poker Copilot, PokerJudge, mypokercoaching, chipy,
  pokerlistings, freebetrange) carries **online archetype tables only**. **The live population's
  postflop behaviour is unpublished.** Clean negative result.
- **A stated sample size for any live population statistic other than Hand2Note's and Doug Hull's.**
  Selbrede's live n: never stated. Red Chip's live corpus n: never stated. Fitzgerald's n: never
  stated. Miller's: none claimed. BlackRain79's: *"millions and millions"*, never counted.
- **Any peer-reviewed live cash population study.** arXiv and Semantic Scholar returned only
  skill-vs-luck legal/economic papers (Levitt & Miles 2011; Croson/Fishman/Pope; Potter van Loon et
  al.; ETH 2022) and a hand-history **file-format** spec (Kim, PHH, 2023 — 10,088 hands across 11
  variants, useful as an encoding standard, not as data). **No academic literature on live population
  behaviour exists.**
- **Poker Detox / Nick Howard population statistics.** Six search attempts across two engines. Nothing
  locatable; their material appears to live entirely inside paid coaching. **Unconfirmed-absent**, not
  confirmed-absent.
- **2+2 forums: BLOCKED.** `forumserver.twoplustwo.com` sits behind Cloudflare and returned **403 to
  every route**, including with a browser user-agent, and has no Wayback snapshot. **Two specific
  threads are known-relevant and unread**: *"[LOW] The Course by Ed Miller — RFI ranges"* (would settle
  whether Miller publishes a full chart) and the *Donkey Poker* thread (would likely settle Selbrede's
  live sample). **A real browser session would clear this**, and it is the single highest-value
  unblocking action available.
- **Reddit: BLOCKED** at the tool level on every mirror. One indexed thread worth noting: a live $2/$5
  player's **1,200 hours ≈ 36,000 hands → 30 hands/hr**, which brackets against Hand2Note's 20–25 and
  SplitSuit's ~33.
- **Selbrede's by-seat "Donkey Games Starting Hand Chart"** (the 18/9 grid). Book-locked.
- **Jonathan Little's live-specific $1/$2–$2/$5 charts.** *"Exploitative, Not GTO"* — **the closest
  published artefact to this survey's exact target**, and every range is an image behind an email
  opt-in.
- **Hand2Note's positional range grids.** Images on the Help page. **A manual screenshot would upgrade
  S31 from B to A** and is cheap.
- **Web search capacity.** This session exhausted its 200-call web-search budget partway through, and
  DuckDuckGo's HTML endpoint subsequently served a CAPTCHA. Later work proceeded by direct URL fetch
  only. **Coverage of the postflop and live-specific literature is therefore less exhaustive than the
  preflop and solver coverage**, and this is a known hole in this document rather than a finding of
  absence.

---

## 8. Which sources are cheapest to encode first, and why

**Nothing here has been encoded.** A parallel task is determining which harness can accept a strategy
arm and at what cost; this section states only what is *available* and in what shape, ranked by the
work between here and a scored arm.

> **THE PARALLEL TASK HAS LANDED, AND IT DEFINES "ENCODABLE" PRECISELY.**
> `scripts/backtest/strategyArm.mjs` + `run-strategy-arms.mjs`, specified in
> `docs/standard-of-record/DECLARED-ARM-SCORING-SPEC.md` (WS-425), establish the interface a
> published strategy must satisfy — and it is **narrower than this survey assumed**:
>
> ```
> policyAt({ ctx, hand, geo, responses }) -> { covered: true, actions: {a: p} }
>                                          | { covered: false }
> ```
>
> **Two consequences reshape the grading above.**
>
> **(a) Partial coverage is first-class, so grade C is less fatal than §0 implies.** A source that
> speaks to *only ten boards* (S14) or *only RFI* (S28) is not a defective arm — it is an arm that
> **abstains**, and abstention is an explicit branch with three fallback modes, each measuring a
> different quantity. `coveredShare` is stamped; the paired delta's `discordantN` is the honest
> denominator. **This is exactly what `P-CBET-INTERPOLATE` was reaching for**, and the harness
> already enforces it: a source that says nothing about a decision must be allowed to say nothing,
> rather than be extended by an encoder's guess.
>
> **(b) The unit is an action distribution, not a range.** A preflop chart is a `π(a|s)` over
> {raise, fold} at an RFI node — which S28, S6, S7 and S29 all supply directly. A *frequency without
> a composition* (§2.8's DeepFold BB-defence table) does **not** satisfy the interface at all, which
> confirms the grade-C assignment from the interface side rather than from taste.

Note the landing zone in the repo's own vocabulary, because it already exists and nothing new is
needed: **a published strategy encoded as an arm is a `Declared` surface — a Strategy Card.** It
carries `warrant` values per rule, a `residual clause` for states its rules do not reach, and it
resolves to a `Result Card` against a versioned Deal Book and Field, on the Ladder, like everything
else. The `Declared` kind was added by WS-322 precisely because the first three kinds (`Equilibrium`,
`Field`, `Read`) could not represent *"what someone said they would do, on purpose, with reasons."*
**That is exactly what a published chart is.**

### Rank 1 — S28 RangeConverter 9-max 100bb Live Cash (best artefact, and near-zero cost)

**Why first, on every axis at once.** It is the only item in the survey that is simultaneously
**9-handed** (not 8, not 6), **100bb**, **live-labelled**, **free**, **grade A**, and **legible** —
with per-seat frequencies printed as exact numbers rather than approximated, and with the two
*derived* situations (facing an RFI, facing a 3-bet) that no other free source covers at all. Its
population matches the founder's table size on the axis the repo ranks as its **#1 fault**.

Encoding cost is transcription of 16 chart pages, of which the 8 RFI frequencies are already in §2.21
and one full grid (UTG) is already transcribed. It becomes a drop-in alternative to `PREFLOP_CHARTS`
scored through the identical path.

**It also arrives with corroboration, which nothing else here does.** Upswing's independent "Live Cash
9-Handed" chart gives **UTG 10.2%** and **BTN 40.8%** against RangeConverter's **10.09%** and
**40.49%** — two vendors, neither naming a solver, agreeing to within 0.3 points at both ends. Against
the 45% spread among the free *text* charts (§2.9), that convergence is worth noticing.

**Prerequisite:** `P-RC-RAKE` — the rake is unstated, and the same vendor names it on their 6-max
charts. Sweep against `P-RAKE-LIVE` (10%, 2bb cap) and ChipEV. That is the one hole in the best
artefact found, and it is a sweep, not a blocker.

### Rank 2 — the free 9-handed text charts as a disagreement set (S6, S7, S29, plus the repo's own)

**Why second:** cost is near zero (they are already transcribed in §2.4, §2.5, §2.22) and encoding
them turns a single measurement into **a comparison across five mutually incompatible 9-handed charts
on one identical decision set**: the repo's `PREFLOP_CHARTS`, Pokerati, Preflop Wizard, Jonathan
Little, and RangeConverter. Their UTG widths span **8.6% to 12.5%** among the P4 sources, and their
*shapes* are incompatible in ways no solver would produce.

**The point is not to find the winner. It is that five points on one axis, scored identically, is a
measurement of how much the choice of published chart is worth at all** — and that number is a
property of the founder's game that nothing currently measures. If the spread in score turns out to be
small, the entire preflop-chart literature is worth less than one line of code, and that is worth
knowing.

Prerequisites: `P-POKERATI-BTN` and `P-POKERATI-UTG` (encode both readings, not a silent edit),
`P-3BET-BLUFF-FREQ` for Preflop Wizard's 3-bet extension.

### Rank 2b — S30 Selbrede's structural priors and isolation rules (highest live-specific value)

**Why alongside Rank 2:** these are not ranges, they are the **shape of the game**, and they are the
only published numbers of their kind. **4.0 players per flop · 27% of flops five-way · 28% preflop
call range · 4.6bb average open · 73%/80% limp survival · straddle tax 1.2bb vs 0.9bb for both blinds
combined.** Plus a fully-specified isolation rule (`27.6%` vs 1 limper → `13.4%` vs 4) and a sizing
formula (`4bb + 1bb per limper`) — both grade A.

**These are worth more to this repo than any chart**, because they describe the multiway, limp-heavy
structure that the entire rest of the published corpus (§8) does not model at all. Encode the *rules*
at grade A; encode the *population stats* (VPIP 35 / PFR 6.1 / CPFR 56.4) at a **deliberately weak**
prior weight per `P-SELBREDE-WEIGHT`, because the author states his sample precisely for every online
figure and never once for a live one.

### Rank 3 — S1 PokerBench (highest value, materially higher cost, and the only real solver content)

**Why third despite being the most valuable artefact in the survey:** it is the only source that is
simultaneously free, machine-readable, large (571k rows), and provenance-complete on **solver
identity** (GTO Wizard preflop, WASM-Postflop postflop — both named). Apache-2.0. It is the only
material here that could carry a claim about *solver-derived* play at all.

**Why it is not first:** the cost is real and structural.
1. **Its decision set is not ours.** It is a set of solver-labelled *scenarios*, not our corpus
   decisions. Using it as an arm means either fitting a policy to it and applying that policy to our
   decisions, or restricting to spots that overlap. Both are engineering, not transcription.
2. **6-max, and the founder plays 9-handed** (`P-PB-FORMAT`).
3. **No rake** (`P-PB-RAKE`).
4. **Argmax-only** (`P-PB-PURITY`) — the mixing is deleted, so it is a *purified* policy that will
   look more decisive than equilibrium in a systematic direction.

**And it explicitly cannot serve as `EQUILIBRIUM_POST`.** A purified argmax filtered to `>50%`
dominance is a `Declared` surface, not an `Equilibrium` one. Feeding it to `exploitationPremium` would
produce a number reading as "money the pool's mistakes are worth" that actually measures "how far the
pool sits from a filtered argmax of a rake-free 6-max solve" — **the FSA Finding F3 mechanism
exactly**, in a more convincing costume than `PREFLOP_CHARTS` manages. `refuseChartsAsEquilibrium`
should gain `PokerBench`, `GTOWizard`, and `postflop-solver` as forbidden substrings **before**
anyone encodes it, not after.

### Rank 4 — S2 `postflop-solver`, run in-house (the only route to any real equilibrium)

**Not a transcription job — a compute job**, and therefore last on cost and first on what it would
prove. AGPL-3.0, callable as a Rust library, Discounted CFR at γ=3.0, benchmarked above PioSOLVER and
GTO+, and **the same engine that produced PokerBench's postflop labels** (so it is not independent
of Rank 3 — see §5 Collapse 3).

**What it could actually deliver:** a *heads-up, rake-free, postflop* equilibrium for named spots,
with **bunching enabled for up to four folded players** — which is the 9-handed card-removal
correction the repo would otherwise have to invent, already implemented and free.

**What it can never deliver:** multiway equilibrium (2 players only), and rake (unsupported). For a
$1/$2 live game where the repo has already measured rake at 12.3 bb/100, a rake-free equilibrium is a
different game and must be declared as one.

**Therefore, the recommendation on SRC-013 is a re-scope, not a wait.** `EQUILIBRIUM_POST = null` is
correct *for the post as currently defined* — "the equilibrium of the founder's 9-handed raked live
game" — and this survey found nothing that changes that and established that nothing exists. But a
**narrower post that is honestly labelled** is computable in-house: *"the heads-up rake-free postflop
equilibrium of these named spots, bunching-corrected to four folds."* That is a real lower post for a
real, restricted question. It should be introduced as a **new source id with its own scope
statement**, never by relaxing SRC-013 — because a post that quietly widens its own scope is the
identical failure to a chart standing in for an equilibrium.

**AGPL-3.0 should reach `legal-safety` before any linking decision.** Running the binary offline to
generate a data artefact and linking the library into shipped code are different acts with different
consequences.

### Postflop: the identities are free, and they are the wrong arms

A crucial asymmetry, and it should govern the postflop encoding order.

**The postflop material that encodes cleanest is the material that will teach you least.** MDF/alpha,
the river bluff:value table, required equity, geometric sizing, the multiway defend formula, the SPR
stack-off equities — all grade **A**, all trivially encodable, and **all true by construction.**
Scoring them measures arithmetic. The repo already has most of them (`Required fold`, the raise
formula, the separate facing-a-raise fold arm) and in at least two places states their premises
*better* than the published sources do.

**The postflop material that would actually test the engine — c-bet frequency by texture, sizing by
texture, barrel frequency, value thresholds — is precisely what the field cannot specify.** That
inversion is the central postflop finding, and it is worth more than any individual number in §2.

**Four genuinely testable exceptions, ranked, and these are the postflop arms worth encoding:**

| Rank | Arm | Why |
|---|---|---|
| **P1** | **S20's 39%/43% wet-vs-dry fold rate** | **Not as an arm — as a hypothesis to falsify.** It is one of only two measured claims in the postflop corpus, it contradicts the entire sizing doctrine built on top of it, and **the repo can test it directly today**: fold-vs-size curves on 10.6M decisions, split by `wetScore`. Cheapest high-value postflop work available, and it needs no encoding at all — only a slice. |
| **P2** | **S18's fold-elasticity curve** (29%/45%/"predominant" at 30/70/133% pot, one board, 50bb) | The only published curve of the shape the repo's own fold curve takes. A direct external comparand for a curve whose **shape is fit but whose level is not** (`POPULATION_FOLD_RATE = 0.45`, unfitted under the live/online separation). Three points at one board is thin — but it is three points more than existed. |
| **P3** | **S14's 10-board PioSolver c-bet table** | A real solver output at named boards. Encodes at grade A **for those ten boards only**; `P-CBET-INTERPOLATE` forbids filling the gaps. Its value is as a *spot check* on ten boards, not as a policy. |
| **P4** | **S19's check-raise size-dependence** (8.66% vs 66% pot, 12.65% vs 33% pot) | A frequency stated as a **function of an observable the repo already computes** (`sizeBucketFor`). Two points, one board, but the *direction* is a testable claim about the field. |

**S23's multiway defend formula (`fold_i = alpha^(1/(n−1))`) sits outside this ranking** because it is
not an arm — it is a closed-form identity, immediately usable, and it is the only result in the entire
survey built for a table with more than two players in the pot. Adopt the arithmetic; it costs nothing.

**Do not encode** the Janda value shares as a prescription (`P-JANDA-BALANCE` — the repo's own corpus
already measures the field at ~93–95% value against Janda's 70%, so the arm would score "how balanced
are we", which is not the question), the texture→size doctrine (S24's own monotone case contradicts
it), or anything from S26 (arithmetically wrong).

**And re-derive every number before ingesting it, including from grade-A sources.** Five otherwise
reputable articles contain internal arithmetic that does not close (D13). The gate is one line:
check every ratio against `B/(P+2B)`.

### Registry landing — one SRC id per encoded source, no exceptions

Each source encoded gets **its own entry in `docs/provenance/data-source-registry.md`**, with the
population, basis, and provenance mark from §1 copied in verbatim. This is not ceremony: SRC-009's
entry is the precedent — population priors that turned out to be *"the FOUNDER'S INFORMED ESTIMATE of
the live 1/2 pool (not a dataset)"* and carried a "GTO-approximate"-adjacent framing for the life of
the project until someone wrote the origin down. A P4 chart imported without its own id will read as
reference data within one session of arriving.

**Every one of these sources is `trust_tier` reference-class at best**, most are author-estimate, and
none is a measured baseline of the founder's pool. WS-237 is the open ticket for exactly this on
`PREFLOP_CHARTS`; this document supplies its answer, which is that the chart's provenance is **not
recoverable** — no solver, no rake, no date, no author was ever recorded, and none of the published
chart sets that resemble it record theirs either.

### Not recommended for encoding

| Source | Why not |
|---|---|
| **S9 FreeBetRange** | Best provenance of any chart site (**HRC named**) but images behind a signup. Cost is manual transcription of image charts, which is the highest-error, lowest-yield work available. **Revisit only if HRC output can be obtained as data.** |
| **S39 BlackRain79's HUD table** | The cleanest-looking stat table in the survey, and **the values are prescriptive targets for a good reg, not measured population means** — with postflop rows identical across formats, which is a tell they were never measured per-format. `P-BR79-PRESCRIPTIVE`. **The single likeliest misuse available.** Usable only as a `Declared` opponent model, never as a Field prior. |
| **S41 Red Chip live course** | Paywalled, sample never stated. Nothing to encode. Recorded as D15. |
| **Any "your bluff must work X%" rule** | It is `bet/(bet+pot)` with an author's name on it (§5 Collapse 6). Encoding it would attach a name to a tautology and manufacture the appearance of external corroboration. |
| **S10 Upswing / Lucid** | The one genuinely machine-readable range export found (GTO+/Flopzilla format) — **paid**, and **not 9-handed**. Lucid's Live Cash is 150bb 6-max-derived. If a subscription is ever bought for another reason, the export makes this Rank 2-cheap; on its own it does not justify one. |
| **S13 DeepFold** | Prose, not predicates. Encodable only as a width target, which makes it ours (`P-DEEPFOLD-WIDTH`). Useful as a **width-sweep control arm**, not as a source. |
| **S11 Sklansky–Malmuth** | Copyright-blocked from transcription; encodable from a purchased copy. A purchase decision, not a research one. |

### The single biggest gap between what is published and what this repo needs

**The published corpus has no answer for a multiway pot, and multiway is the founder's normal case.**

Every artefact in this survey — every solver, every chart, every frequency — describes a **two-player
pot**. `postflop-solver`: 2 players. `TexasSolver`: 2 players. GTO Wizard, RangeConverter, Lucid: 8-max
*tables* solved as heads-up-by-the-flop *pots*. Preflop charts are RFI-vs-field and collapse to a
heads-up defence problem the moment anyone continues. At a live 9-handed $1/$2 table with three and
four callers routinely, **the entire published corpus is describing a game the founder is not playing**,
and this is not a transfer problem that better data would fix — multiway NLHE equilibrium is an open
computational problem.

The repo already knows this in one place: `equilibriumPost.mjs` returns `null` and says why. This
survey's contribution is to establish that **the null is not a procurement failure**. Nobody has it.
The nearest reachable substitutes are (a) `postflop-solver`'s bunching correction, which models
folded players' *cards* but not their *decisions*, and (b) the repo's own measured `Field`, which is
the only object in the entire landscape that is actually multiway.

**The corollary is uncomfortable and worth stating plainly.** If the published corpus is heads-up and
the founder's game is multiway, then the value of encoding these arms is *not* that one of them might
be right. It is that **scoring them establishes, in this repo's own currency, how much a heads-up
prescription is worth in a multiway game** — and that number is a property of the founder's game that
nothing currently measures. That is a better reason to do the work than "let's see if Pokerati's
chart is good."
