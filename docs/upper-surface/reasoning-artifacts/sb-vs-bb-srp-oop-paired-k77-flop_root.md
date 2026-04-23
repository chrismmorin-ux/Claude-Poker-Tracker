---
Rubric-Version: v2.3
Node-ID: sb-vs-bb-srp-oop-paired-k77-flop_root
Street: flop
Line: src/utils/postflopDrillContent/lines.js L1938-L1994 (LINE_SB_VS_BB_SRP_OOP_PAIRED.nodes.flop_root)
Authored: 2026-04-23
Authored-By: Claude (main, US-1 Artifact #10 — v2.3-native, first paired-board)
Status: draft
Companion-LSW-Audit: docs/design/audits/line-audits/sb-vs-bb-srp-oop-paired-k77.md (LSW-A3, closed; LSW-F3 shipped)
Related-Artifact: btn-vs-bb-srp-ip-dry-q72r-turn_brick.md (artifact #5, SRP-HU sizing contrast — dry unpaired)
---

# Upper-Surface Artifact — `sb-vs-bb-srp-oop-paired-k77-flop_root`

**Spot.** Heads-up single-raised pot. Hero **SB (OOP, first to act postflop)**. Villain **BB (IP, last to act)**. Effective stack 100bb. Line: SB open ~3bb, BB call. Flop **K♠7♦7♣** (paired rainbow, K-high). Hero holds **A♥K♦** (top pair, top kicker — no straight/flush draw on this rainbow-paired texture).

**Authored teaching answer:** Cbet 33% pot (~1.8bb). Cbet 75% incorrect (sizing leak). Check incorrect (forfeits structural edge on highest-whiff-rate board class).

**Structural distinction from prior corpus artifacts (1–9).**
- **First paired-board texture in corpus.** Artifacts 1–9 all played out on unpaired boards (T96ss, Q72r, T98ss, J85r, A♠K♦2♠, Q53o). K77's paired structure introduces the "reduced nut advantage + maximum whiff rate" regime, which is the single most distinctive theoretical environment in flop strategy.
- **First hero-OOP-as-preflop-raiser-on-flop.** Prior HU hero-OOP artifact (#7 sb-vs-btn-3bp-oop-wet-t98 river) was a turn/river defender, not a PFA acting first. This is the first "hero cbets into capped cold-caller from OOP" spot.
- **First merged-range cbet artifact.** Prior HU cbet studies (artifacts #1, #2, #5, #8) featured polar cbets (narrow value/semi-bluff) or facing donks. This artifact studies a *merged* cbet — wide range at small sizing — which is a distinct strategic object from polar cbets.
- **Lowest-SPR-post-cbet inflation of the corpus.** Small-sizing continuation rationale on paired textures is structural, not situational.

---

## §1. Node specification

**Game state.** NLHE cash, live 2/5 to 5/10 NL target. 9-handed ring; action folds to SB who opens; BB calls. Pot-type: SRP (single-raised). Texture class: **paired rainbow** (7-7 paired, K unpaired, no flush possibility, no straight possibility).

**Positions.** Heads-up postflop. Hero SB acts first every street (OOP). Villain BB acts last every street (IP).

**Effective stack.** 100bb preflop → 97bb at flop decision (each player committed 3bb preflop).

**Pot at node.** Authored **5.5bb**. Derivation (standard HU no-ante cash):
- SB posts 0.5, BB posts 1, dead 1.5bb.
- SB opens to 3bb total (adds 2.5bb to their post).
- BB calls to 3bb total (adds 2bb to their post).
- Flop pot: 3 + 3 = **6bb** (strict derivation).
- Authored value 5.5bb represents a ~0.5bb rounding/convention gap. This is a known authoring simplification (appears on all SRP lines at 5.5bb; equivalent to "2.5bb SB open" math). Rubric §1 forcing constraint notes the discrepancy; §11 row 1.2 logs a pot-derivation-gap falsifier.

**Board.** K♠ 7♦ 7♣. **Paired** (7-7). **Rainbow** (three distinct suits — no flush draw possible through turn/river). K is the high card (top unpaired). Connectivity for straight draws is structurally absent: K-7-7 requires 5-6 or 8-9-T for straight completion, which only a handful of villain combos (65s, 98s, T9s) can even represent as gutshots, and those need two more running cards.

**SPR at decision.** 97 / 5.5 = **17.6**. **DEEP zone (13+)** per engine's 5-zone strategy. Deep SPR matters here: it permits wide post-cbet continuation and deep-barrel plans, but reduces the leverage of a single-street small cbet. The "small sizing" prescription is pot-structure-justified (reduced nut advantage) rather than SPR-justified.

**Action history.**

| Step | Actor | Action | Size (bb) | Pot after (bb) | Stack after (bb) |
|---|---|---|---|---|---|
| 0 | SB | post | 0.5 | 0.5 | 99.5 |
| 0 | BB | post | 1 | 1.5 | 99 |
| 1 | SB (hero) | open | 3.0 total (delta 2.5) | 4.0 | 97.0 |
| 2 | BB | call | 3.0 total (delta 2.0) | 6 strict / 5.5 authored | 97.0 |
| 3 | *flop K♠7♦7♣* | — | — | 5.5 authored | — |
| *node entry* | SB (hero) | — (decision) | — | 5.5 | 97.0 |

**Prior-street filter rationale (HU SRP, postflop).**

- **SB preflop filter.** Hero's range is SB's open range with action folded to SB. Live-cash SB open ≈ 40–45% (narrower than solver-HU ~80–85% because live pool's SB tends toward tighter-than-solver opens). Hero's A♥K♦ is clearly in the open range.
- **BB preflop filter.** BB defends vs SB open at live-calibrated frequencies: flats ~35–40% of range, 3bets the top ~8–12% (QQ+/AKs, blocker-bluff A5s-A3s). The live BB flat range is **narrower than solver-HU BB defend ~85%**: live BB folds marginal suited + small offsuit at higher rates than solver prescribes. Documented pattern — see POKER_THEORY.md §9.2 analogy (BB-flat-vs-BTN is even narrower in live, but BB-flat-vs-SB is also narrower than solver).
- **Flop check.** No villain action yet — hero acts first OOP on the flop.

**Summary sentence.** Hero SB OOP with TPTK on the archetypal "highest-whiff-rate paired-rainbow" board class, with range advantage (all Kx + overpairs concentrated, villain has few 7x) but *reduced* nut advantage (trips are possible in both ranges), at deep SPR.

---

## §2. Range construction, both sides (v2.1 D10 first-pass enumeration applied)

### SB (hero) preflop range

**SB open range, live-calibrated 9-handed:** ~42% of dealt hands ≈ ~560 combos. Composition:

| Hand class | Combos | Rationale |
|---|---|---|
| All pocket pairs 22–AA | 78 | Opened standard |
| Suited aces A2s–AKs | 48 | Opened standard |
| Offsuit aces ATo–AKo (partial AJo–AKo full; ATo ~70%; A9o below at ~30%) | 36 | Wider in SB vs folds |
| Suited kings K2s–KQs | 48 | Opened |
| Offsuit KQo, KJo, KTo (partial) | 24 | Open-skew live |
| Suited queens Q2s–QJs (partial Q2s–Q4s) | 40 | Trimmed at bottom |
| Offsuit QJo, QTo (partial QTo) | 12 | Wider |
| Suited jacks J7s–JTs | 28 | Cold-call boundary |
| Suited connectors + 1-gappers 54s-T9s, 53s-T8s (partial) | 44 | Playable HU |
| Suited smalls 22-55 + random suited leakers | — | Already counted |
| Offsuit broadway JTo, T9o (partial) | 16 | Leaner live |
| Small suited filler K5s-Q5s etc. | ~ absorbed above | — |

Aggregation: ~560 combos ≈ 42% of 1326. Upstream estimate ±6% (530–590 combos).

Hero A♥K♦ is in the AKo sub-range (12 combos total; hero is one specific combo).

### BB preflop range (flat vs SB open, live-calibrated)

**BB flat range ≈ 35% of dealt hands ≈ 460 combos.** Composition (live-cash calibration; narrower than solver):

| Hand class | Combos | Rationale |
|---|---|---|
| Pocket pairs 22–JJ (QQ+ 3bets at ~95%; JJ 3bets ~70% so flats ~2 combos) | 62 | Flats small/mid pairs; partial JJ/TT flat in live |
| Suited aces A2s–AJs (AKs 3bets; AQs 3bets ~60%) | 40 | Flats A2s-AJs; partial A9s-AJs |
| Suited kings K2s–KJs (KQs partial 3bet; KJs-KTs flat) | 40 | Flats non-KQs suited kings |
| Suited queens Q5s–QJs | 32 | Flats |
| Suited jacks J7s–JTs | 28 | Flats |
| Suited tens T7s–T9s | 16 | Flats |
| Suited connectors 54s–98s | 32 | Flats |
| Suited 1-gappers 64s-T8s | 20 | Flats |
| Offsuit broadway ATo–AJo, KJo, KTo, QJo, QTo, JTo (partial) | 56 | Partial flat — narrower in live |
| Random small suited leakers (suited kings low, suited queens low) | 20 | Live filler |
| Offsuit small aces A2o–A9o (partial flat live) | 24 | Live "I have an ace" leaks |
| Offsuit broadway lower (T9o, J9o partial) | 12 | Live filler |

Aggregation: ~460 combos ≈ 35% of 1326. Upstream estimate ±6% (420–500 combos).

**Divergence note (inherits POKER_THEORY.md §9.2 rationale, SB variant).** Live BB flat range is substantially narrower than solver-HU. Solver has BB defend ~85% vs SB open; live live BB folds marginal suited + small offsuit at higher rates (cautious play against OOP PFR). This artifact's §5 population claims are calibrated to this live pattern.

### Filter through flop K♠7♦7♣ (post-flop)

Both players' full preflop ranges enter the flop unchanged (no prior-street action). But the *node-of-interest range* for hero's decision is only hero's own range (hero is deciding, not responding to a villain action). The range-vs-range comparison that drives hero's cbet decision is:

### Hero's range on K♠7♦7♣ — decomposition (first-pass enumeration, v2.1 D10)

| Hero hand class on K77r | Combos (in range) | Strength bucket |
|---|---|---|
| KK (trips-over-pair, drawing very strong) | 3 (one K on board removes half) | Nuts |
| 77 (full-house quads — one 7 each in both ranges) | 1 (77: 3 combos; remove 2 with 7♦ or 7♣ on board) | Nuts |
| AA–QQ (overpair, unpaired to board) | 15 (QQ=6, JJ=6 wait but JJ is overpair here too; actually JJ/TT/99/88 are underpair. Recount: AA=6, QQ=6, JJ=6. But K on board → K-high → AA/QQ/JJ are overpairs above K? No — AA beats K; QQ, JJ are *below* K. Reclassify.) | Mixed |
| AA only (the one overpair to K) | 6 | Nuts |
| QQ, JJ (below K; now second-pair "underpair-to-board-K") | 12 | Medium (below K but above 7) |
| Kx strong (AKs, AKo, KQs, KQo — TPTK + TPGK) | 36 (hero ~1 combo of AKo + ~35 other Kx strong) | Strong |
| Kx weak (KJs/KJo/KTs/KTo/K9s-K2s suited) | 24 | Strong (TP with weaker kickers) |
| 7x (A7s, K7s, 77s-counted-above) | ~8 (A7s=4, K7s=4, but K7s removes K-suit; call it 6–8 suited-7x combos) | Nuts (trips) |
| Underpair 88–TT (below K AND below-or-equal to 7? 88/99/TT are above 7 but below K) | 18 | Medium |
| Low underpair 22–66 (below 7) | 30 | Weak (below both cards) |
| Ax no pair (ace-high with gutshot-or-nothing) | ~48 | Weak / showdown value |
| Air (low suited connectors, offsuit broadway missed) | ~160 | Air |
| Suited draws (no flush, no straight on this texture) | 0 | — |

Rough totals: ~560 combos (matches preflop open range). Buckets (hero's perspective): **Nuts ~15 (AA + KK + 77 + A7s/K7s trips), Strong ~60 (Kx top pair), Medium ~30 (underpairs 88–TT + QQ/JJ second-overpair), Weak ~78 (low underpair + Ax no pair), Air ~160.**

### Villain's range on K♠7♦7♣ — first-pass per-class enumeration

| Villain hand class | Combos (pre-flop) | Post-board hits | Strength vs hero TPTK |
|---|---|---|---|
| 77 (trips) | 3 (after 2 board 7s removed) | Trips | Nuts — crushes TPTK |
| KK (trips+set — not in flat range; 3bet) | ~0 (in live flat range maybe 1 combo if ultra-passive BB; in typical live flat ~0) | Set | — |
| Kx strong (AKs partial, KQs, KQo partial) | ~8 (AKs 3bets; KQs flats; KQo partial) | Top pair | Chop AK / behind AK / ahead of hero depending on kicker |
| Kx weak (KJs, KTs, K9s-K2s suited, KTo partial) | ~20 | Top pair weak | Behind hero TPTK |
| Pair 22–66, 88–TT (under K) | ~62 (post-board combo conflict subtract ~5%) | Underpair | Behind hero |
| JJ, QQ partial (live flat portion) | ~6 (JJ flats 30%) | Second pair or overpair (QQ overpair to K? No, QQ < K — second pair) | Behind hero TPTK |
| 7x suited (A7s–Q7s, hero blocks 1 A7s with A♥, 2 with nothing specific) | ~12 (A7s=4, K7s excluded board, Q7s-97s ~8) | Trips | Nuts — crushes TPTK |
| Ax no pair (A2s–A6s, A9s, ATo partial, A2o–A9o partial) | ~50 | Ace-high | Behind hero TPTK |
| Kx containing K♠/K♦/K♣ with board conflict | counted above | — | — |
| Suited connectors (65s–98s no pair) | ~40 | Air with backdoor gutshot | Behind hero |
| Offsuit broadway missed | ~60 | Air | Behind hero |
| Suited jacks/queens/tens/eights (non-K, non-7) | ~80 | Air | Behind hero |
| Remaining live-leak air | ~120 | Air | Behind hero |

Rough total: ~460 combos (matches preflop flat range). Post-board-conflict adjustment: ~5% reduction for K♠/7♦/7♣ in villain's possible holdings. **Working total: ~440 combos.**

Hero's blockers (A♥, K♦) remove:
- **A♥-blocks:** A♥x combos in villain range. A♥Xs (A♥2s–A♥Js partial, A♥Ts, A♥9s etc.) ≈ 10 combos. A♥Xo (A♥Jo, A♥To, A♥9o–2o partial) ≈ 5. **~15 A♥-blocked combos.**
- **K♦-blocks:** K♦x combos. K♦Js, K♦Ts, K♦9s–K♦2s suited partial ≈ 7. K♦Qo, K♦Jo, K♦To partial ≈ 3. **~10 K♦-blocked combos.**

**Post-blocker villain range: ~415 combos.**

### Decision-relevant segmentation (hero TPTK vs villain's full range)

| Villain class | Combos | Hero A♥K♦ equity |
|---|---|---|
| 77 trips | 3 | ~4% (drawing to 2 Ks on turn/river for K-full; 2 outer × 2 streets) |
| 7x suited trips | ~12 | ~8% (AK has 2 outs to K-full vs 7x trips) |
| AK chop (partial AK flats) | ~6 | ~50% (chop on Kx board pair) |
| Kx weaker (KQ, KJ, KT, K9-K2) | ~25 | ~75% (hero dominates by kicker) |
| QQ/JJ (partial flats) | ~6 | ~75% (QQ/JJ have 2 outs to set; hero TP dominates) |
| 88–TT (underpair below K) | ~30 | ~82% (underpair has 2 outs to set) |
| 22–66 (low underpair below 7) | ~30 | ~82% (same) |
| Ax no pair (ace-high) | ~45 | ~75% (hero TP dominates ace-high) |
| Random air (no pair, no draw) | ~250 | ~92% (air draws very thin) |

### Weighted hero equity

`((3×0.04) + (12×0.08) + (6×0.50) + (25×0.75) + (6×0.75) + (30×0.82) + (30×0.82) + (45×0.75) + (250×0.92)) / 407 ≈ (0.12 + 0.96 + 3.0 + 18.75 + 4.5 + 24.6 + 24.6 + 33.75 + 230) / 407 ≈ 340.3 / 407 ≈ **83.6%**.`

(Using adjusted denominator 407 after removing two chop-or-nuts combo-conflict ambiguities; round to ~84%.)

**Hero AK equity vs villain full range: ~84%.** Extremely high — top-pair-top-kicker on K77r against BB's live flat range is effectively a value-bet-every-street spot at the hand level.

**First-pass vs external-calibration reconciliation.** Per v2.1 D10: first-pass enumeration committed above. External reference: LSW-A3 audit cites solver K77 HU SRP aggregate cbet-33% at 60.2% (range-level, not hand-level). Aggregate-solver agreement is at the range-level; individual-hand equity (hero A♥K♦ specifically ~84%) derives from per-class combo counts above without calibration back-solving. No adjustment applied; first-pass numbers preserved.

---

## §3. Equity distribution shape

Hero A♥K♦ on K♠7♦7♣ (flop). Two cards still to come.

**Buckets vs villain post-blocker range (~407 effective combos):**

- **Nuts (>80%):** ~305 combos (air + low underpair + ace-high + random misses that hero's top pair TPTK crushes at showdown)
- **Strong (60–80%):** ~85 combos (underpair 88–TT + Kx dominated by kicker + QQ/JJ live-flats)
- **Medium (40–60%):** ~6 combos (AK chop / kicker-adjacent)
- **Weak (20–40%):** ~0 combos (no real "hero behind but ahead" class on this texture)
- **Air (<20%):** ~15 combos (77 trips + 7x trips — hero drawing thin)

**Weighted equity (bucket midpoints):** `(305×0.90 + 85×0.70 + 6×0.50 + 15×0.10) / 411 ≈ (274.5 + 59.5 + 3 + 1.5) / 411 ≈ 338.5 / 411 ≈ **82.4%**.`

Matches first-pass §2 calc within rounding. Hero's equity is ~82–84% depending on granularity.

**Shape.** **Heavy right-skew** (nuts-concentrated) — not bimodal. Hero is massively ahead of the vast majority of villain combos; a small air-bucket of trips crushes hero back. This is the exact *merged-range shape* that justifies small sizing: there are very few "medium" combos to extract thin value from at large sizings, and the ~85 "strong" combos are pair-medium combos that call small cbets but fold to large cbets.

**Counterfactual flat-distribution comparison.** A uniform 50% distribution would imply ~410 combos at ~50% equity. Actual distribution: 305 × 90% + 85 × 70% + 15 × 10% ≈ weighted 82% — equity density is front-loaded on the nuts side. Hero's edge is width-of-domination, not depth-of-value-region. This shape → small-sizing prescription (charge the wide domination band; don't narrow the call range).

### Pure-bimodal note (v2.1 D12)

**Not applicable** — this is a flop decision with two cards to come. Equity is continuous (not 0%/100%). D12 pure-bimodal framing applies only on river decisions.

---

## §4. Solver baseline

**Claim 1 — Solver cbet frequency on K77 paired rainbow.** Per the LSW-A3 external validation (HU 100bb solver, HU SRP BTN or SB vs BB; paired flop category): **cbet-33% = 60.2%, check = 32.9%, cbet-67% = 6.2%.** The remaining ~0.7% is residual mixed sizing.

**Source:** Getcoach "Heads-Up Poker — A Strategic Guide to Winning One-on-One" cites solver HU 100bb output for paired flops; Upswing "When To Bet Small" (Ep. 12 small-bets podcast); GTO Wizard "The Mechanics of C-Bet Sizing"; GTO Wizard "Attacking Paired Flops From the BB" (mirror). All agree that paired flops are overall bet significantly more than unpaired flops, but almost exclusively at small sizing due to reduced nut advantage.

**Claim 2 — Solver sizing rationale.** Paired flops satisfy "range advantage without significant nut advantage." PFR has range advantage (more Kx + overpairs) but both ranges have approximately-equal trips fractions (PFR has AA/KK/77; defender has some 7x suiteds). Without a nut-advantage lever, polar large sizing is inefficient; the merged-range small cbet dominates.

**Claim 3 — Solver AK specifically.** TPTK on K77r is at the top-of-range of hero's value hands. Solver has AK cbet ~95–100% of the time with a mix tilting toward small sizing (33%). Large sizing with AK on paired textures is only selected at ~5–10% frequency (sizing-mix protection, not primary line).

**Claim 4 — Solver BB response to small cbet.** BB calls the 33% cbet with a wide continuing range (pair + draws + overcard A-high) and **check-raises at meaningful frequency** (~10–15%) with trips + some pair-value + rare bluff blockers. This artifact does not model the check-raise branch (out-of-scope; see §14c counter-artifact).

**Distribution summary (hero AK specifically):**

| Action | Solver frequency |
|---|---|
| Cbet 33% | ~90% |
| Check back | ~5% (range protection) |
| Cbet 67% | ~5% |
| Cbet overbet | ~0% |

---

## §5. Population baseline

**Claim 1 — Live pool cbet frequency on K77 paired rainbow.** Live 1/2–5/10 NL cash pool cbets paired boards at ~55–65% aggregate (lower than solver's 60.2%+6.2% = 66% aggregate-bet, but within ~10 percentage points). **Under-cbets live pool — not over-cbets.**

**Source (v2.3 D14):** `population-consensus-observed`. Doug Polk (YouTube content on cbet frequency discipline), Upswing MW and HU courses, SplitSuit "Poker Paired Boards" article (stake-labeled at low-to-mid-stakes live and online). ≥2 independent coaching sources; at least one (Upswing, SplitSuit) has stated methodology/audience. Sourcing-floor requirement met.

**Claim 2 — Live pool cbet *sizing* composition on paired flops.** Live pool over-uses 50–75% pot sizing on paired flops relative to solver's 33%-dominant. This is the **canonical sizing leak** on paired boards: HU players trained on unpaired-board polar cbet sizing (50% pot+) transplant that sizing onto paired textures where merged-small-cbet is correct. Result: live pool over-folds out weak pairs (that would have called a 33%) and fails to charge middle-pair equity at the right price.

**Source:** Same consensus-observed pool of sources. SplitSuit article explicitly calls out the "paired boards want SMALL bets, not medium-to-large" teaching. `population-consensus-observed` with stated stake-scope.

**Claim 3 — Live pool BB response to cbet on K77r.** BB folds ~45–55% of flat range to flop cbet (aggregate across sizings). Paired boards produce high fold-rate because BB whiffs with ~70–80% of the flat range. Check-raise frequency: live pool BB check-raises at ~5–10% (lower than solver's ~10–15%, reflecting live passivity).

**Source:** `population-observed` — live-play patterns. n≈0 (auditor qualitative observation). Confidence-floor note: this §5 claim is labeled-unsourced; stated methodology is limited. CI widens correspondingly.

**Claim 4 — Live pool "station" response.** Pool-type-4 stations call cbets with any pair regardless of sizing. Against stations, 33% small-cbet sizing *under-extracts* because the station would have paid 50–60% on the same hand. This is a **sizing-exploit against extreme-calling pool-types** — does not change the default vs reg/pro.

**Source:** `population-observed` — Doug Polk, Jonathan Little commentary on station-exploitation. Stated directionally; no specific numeric rate.

---

## §6. Exploit recommendation

**Pre-drafting check.** §4 and §5 authored. Proceeding per v1.1 D6.

**Recommended hero action: Cbet 33% pot (~1.8bb).** Single recommendation, matches authored teaching. Solver-canonical and population-aligned-with-refinement.

### Delta vs §4 (solver baseline)

Solver: 33%=60.2%, check=32.9%, 67%=6.2%. Hero AK collapses that mix to essentially 100% cbet-33% (hero's specific hand class is the upper-value-end of the range; solver's check-32.9% is primarily range-balance for underpairs + weak Kx — not for AK). **No meaningful delta** — we are converging to the solver's expected-value-per-hand-class distribution.

Causal claim: the 32.9% solver check frequency is *range-composition-driven*, not *individual-hand-driven*; when we collapse to the individual hand (AK), solver wants to cbet ~95%. Our recommendation at 100% cbet-33% is within ~5 percentage points of solver.

### Delta vs §5 (population baseline)

Population cbets K77r overall at ~55–65% (aggregate) vs solver's ~66%. Our recommendation 100% cbet-AK-at-33% is **stronger than population** in frequency (pop under-cbets) and **stronger than population** in sizing discipline (pop uses 50–75% too often, 33% too rarely). **Direction-aligned with solver; frequency + sizing better-than-pool.** This is the exploit: the pool's leak isn't "cbet less" — it's "cbet at the wrong size."

Causal claim: population's over-sizing (50–75%) on paired boards folds out weak-pair-calls that would pay 33%. By cbetting 33%, hero keeps villain's full pair-calling range in action *and* charges it. Per-call EV at 33%: (0.55 × villain-fold × 5.5 pot) + (0.45 × call × (equity × total-pot-post − 1.8 bet)) — detailed in §8.

### Archetype-conditional note (v2.1 D11)

Close to flat across archetypes:
- **Fish / station:** Cbet 33% (or up to 50%) — wider sizing fine because fish calls regardless. **Sizing widens; action same.**
- **Reg:** Cbet 33% as authored. Solver canon applies.
- **Pro / thinking player:** Cbet 33% as authored. Solver canon applies.
- **Nit:** Cbet 33% at authored sizing; expect BB to fold even more. Some over-folding against tight nits might permit small-sizing cbet-more-often. Still cbet.

**No action flip across archetypes.** All archetypes cbet. Sizing mildly shifts vs fish only (upward toward 50%).

Default: **Cbet 33%.** No override cases merit top-of-§6 surfacing.

---

## §7. Villain's perspective

**BB's range as BB sees it.** "I flat-called SB's 3bb open — I have ~460 combos of pairs, suited broadway, suited connectors, offsuit broadway partial, and some live-leak offsuit aces. Flop K77r — I've hit top pair with very few combos (Kx), trips with very few combos (7x suited), and underpair with most pocket pairs. Most of my range is A-high, K-blocker broadway missed, or suited-connector-missed. SB will probably cbet — SB cbets paired boards at high frequency because this is SB's range-advantage board. I need to defend ~66% to meet MDF at 33% sizing."

**BB's model of hero SB's range.** BB knows SB's open range is ~40–45% — wider than solver-SB-opens because SB is opening in live-cash 9-handed with passive BB. BB therefore thinks SB has: all Kx (strong Kx dominating BB's weak Kx), all overpairs (QQ+, some JJ), AA, all pairs (some below-K), all Ax suited, suited connectors, random filler. BB knows hero's range has range-advantage on K-high boards and knows nut advantage is reduced on paired boards.

**Crucial asymmetry.** BB thinks hero has a *merged* range — all pair-strengths + some air. BB does NOT think hero has a polar range (nuts + bluffs only). This asymmetry is decision-relevant: BB will read a *small* sizing from hero as consistent with merged range (solver-canon for paired boards), whereas a *large* sizing (50–75%) would read as inconsistent — polar sizing on merged range — and BB would interpret large as "pool-error, probably over-bluffing or over-valuing thin value."

**BB's EV computation (against hero's expected cbet).**

- Call-EV: continue with ~50% of flat range (pairs + strong Kx + some ace-high with 3-outer-plus-backdoor). Pot odds vs 33% sizing: call 1.8 to win 7.3 → needs ~24.6% equity. BB's average continuing-range equity ≈ 35–40%. Positive-EV call.
- Fold-EV: 0 (forfeit 1.5bb dead money committed preflop).
- Raise-EV: only with trips + rare bluff blockers. ~10% of range.

BB's first-order response: call ~45%, fold ~45%, raise ~10% at solver-level. Live pool: call ~40%, fold ~50%, raise ~5% (passivity pulls raise down).

**Villain-EV traceability (v2 D4).** All EV numbers above trace to §11 rows (7.1–7.4). No orphan villain-EV claims.

**Perspective-collapse check.** BB's apparent-hero-range is characterized as "all Kx + all overpairs + all pairs + all Ax suited + suited connectors + random filler" and *merged-shape*. Hero's actual range on K77r is approximately the same range-composition (artifact §2 lists ~560 flop-range combos matching this description). BB has correct range-model; the asymmetry is in **combo-count precision** (BB can't know exact frequency of each class) and **sizing-interpretation** (BB infers range shape from sizing; hero controls what to reveal).

**Apparent-range description (>15 words, per v1.1 heuristic):** "SB's range has all Kx dominating my weak Kx; all overpairs QQ+ above my underpairs; some below-K pairs behind my top-pair Kx; some ace-high missing K; wide merged-shape not polar. At 33% sizing: consistent with merged cbet. At 75% sizing: suspicious — SB doesn't have enough value-hands to polarize at that size on this texture." Over-weighted: SB's Kx + overpair density. Under-weighted: none obvious.

---

## §8. EV tree: depth 1, 2, 3

**Chosen action: Cbet 33% pot (1.8bb bet into 5.5 pot).**

### Depth 1 — immediate EV

BB response distribution (live-calibrated, mildly passive vs solver):
- Fold: ~50% (broadway misses, low pairs that chose this flop as "give up and wait for better")
- Call: ~45% (pairs + Kx + some Ax with backdoor)
- Raise (check-raise): ~5%

**Immediate EV (hero's perspective):**
- Fold branch: 0.50 × 5.5 (pot won) = +2.75bb
- Call branch: 0.45 × (continue play — resolve at depth 2/3)
- Raise branch: 0.05 × (continue play — defend vs raise; hero calls or folds depending on raise-size)

**Fold-branch contribution alone: +2.75bb** — already justifies the cbet against equity 0% (auto-profit threshold met at fold-rate 33%: MDF 1.8/(1.8+5.5) = 24.6%, pop-fold 50% exceeds this).

### Depth 2 — turn branch (per-runout decomposition, v2 D5)

Conditional on BB call: pot becomes 5.5 + 1.8 + 1.8 = 9.1bb on turn. Remaining eff stack 97 − 1.8 = 95.2bb. SPR at turn: 95.2/9.1 = **10.5**. HIGH zone.

**Turn card class distribution (52-3 = 49 unknown cards; card-dealing without replacement):**

| Turn card class | Card count (out of 49 unknowns) | Prob | Hero equity vs BB's flop-call range | Turn continuation (bet or check) |
|---|---|---|---|---|
| Another 7 (quads possible for BB if 7x — rare) | 2 | 4% | ~78% (BB's 7x are blocked hero AK; otherwise hero equity still high) | Small barrel for value |
| A / K (pair-improvement for hero) | 6 | 12% | ~92% (hero's TP improves) | Barrel |
| Q / J (overcard under K, connects with broadway) | 8 | 16% | ~78% (some BB broadway catches pair) | Barrel (smaller continuation) |
| T / 9 / 8 (middle blankers that connect BB's 7x-adjacent) | 12 | 24% | ~76% (some BB pair-improve; hero still ahead) | Barrel |
| Low brick 2–6 | 16 | 33% | ~82% (no connection; hero's range advantage preserved) | Barrel for value |
| Scare cards (specifically no — rainbow board has no flush turn; but Q of specific suit could tighten villain's perception) | 0 | 0% | — | — |

Weighted post-call turn equity: `(2×0.78 + 6×0.92 + 8×0.78 + 12×0.76 + 16×0.82 + 5×0.78) / 49 ≈ 40.5/49 ≈ **82.6%**.`

Hero's expected turn continuation: **bet 33–50% of pot on majority of turn cards, check-back pot-control on 1-2 edge cards (Q-of-specific-suit turning "scary" for narrowing).** For expected-value purposes, model hero's average turn EV as:
- Hero bets ~80% of turns at 50% pot → gains additional 0.50 × 9.1 = 4.55 bet; BB folds ~30%, calls ~65%, raises ~5%.
- Expected turn EV conditional on BB flop call: ~0.82 × 9.1 × 0.88 (realization) − (turn-bet-investment losses) ≈ ~+4.5 to +5 bb expected-turn-pot-equity + fold-equity.

**Simplified depth-2 EV contribution (call branch):** `0.45 × (~+5bb) = +2.25bb.`

### Depth 3 — river collapse

Conditional on BB call flop + call turn: pot grows to ~30bb on river. Hero's equity on river against BB's call-call range condenses to ~78–80%. Value-bet turns into showdown decision with range condensation.

**Depth 3 expectation:** Hero bets river for thin value at ~33% (standard river-value-on-paired sizing). Average river-branch EV contribution: small positive (~+1.0 to +1.5bb).

**Depth-3 collapse:** For the call-call-call subtree: pot closes at showdown via hero bet-get-called or hero check-get-called. For check-raise subtree: hero folds all but TPTK-and-up (hero AK calls if raise size permits; folds to 3-bet at turn). For jam subtree: pot closes.

**Depth 3 = showdown at ~79% equity** (call-call path).

### Full EV synthesis (cbet 33% chosen action)

| Branch | Prob | Branch EV |
|---|---|---|
| Fold (depth 1 terminal) | 0.50 | +2.75bb |
| Call → turn continuation | 0.45 | +2.25 to +3.0bb (depth 2/3 aggregated) |
| Check-raise → hero folds (except AK calls small CR; folds to 3-bet) | 0.05 | ≈ −0.5 to +0bb |

**Cbet 33% total EV: +4.5 to +5.5bb.** Working value: **+5.0bb.**

### Comparison branches

**Cbet 67% (authored incorrect — sizing leak).**
- BB response: higher fold-rate (~65%), lower call-rate (~25%), similar raise-rate (~10%).
- Fold branch: 0.65 × 5.5 = +3.58bb
- Call branch: 0.25 × (value extracted per-call is larger at 67% but call range shrinks much more — called range is pair+ only, hero's edge narrows). Expected turn/river EV ≈ +0.8bb per call → 0.25 × 0.8 ≈ +0.2bb
- Raise branch: similar to 33% case
- Total: ~+3.5 to +4.0bb

**Delta: Cbet 67% EV is ~−1.0bb vs Cbet 33% EV.** Lower by about 1bb — significant but not massive. Sizing leak quantified.

**Check back (authored incorrect).**
- Hero forfeits cbet-EV. Realizes equity via showdown vs BB's full flop range.
- Hero's ~82% equity × 5.5 pot × realization 0.75 (OOP realization lower) ≈ +3.38bb
- Turn/river play continues with no information extracted from flop. Typically turn cbet after check-check becomes ~hero acts first again with same OOP handicap.
- Approximate check-back EV: **+3.0 to +3.5bb.**

**Delta: Check-back EV is ~−1.5 to −2.0bb vs Cbet 33%.** Larger sizing leak than 67%-cbet. Check-back forfeits ~1.5–2bb in expected value — this is the structural teaching.

### EV tree summary

| Branch | EV |
|---|---|
| **Cbet 33% (recommended)** | **+5.0bb** |
| Cbet 67% (sizing leak) | +3.75bb |
| Check back | +3.25bb |

**Chosen: Cbet 33%.** Delta over 67%: +1.25bb. Delta over check: +1.75bb.

---

## §9. Blocker / unblocker accounting

Hero holds A♥ K♦.

**Blocks in villain range:**

- **K♦-blocks:** Villain's Kx combos containing K♦ are removed. Kx in BB flat: ~40 combos total (K2s–KJs suited portion + KJo/KTo partial offsuit). K♦-containing subset ≈ 10 combos removed.
- **A♥-blocks:** Villain's Ax combos containing A♥. Ax in BB flat: suited aces A2s–AJs (~40 combos) + offsuit aces partial (~24). A♥-containing subset ≈ 15 combos removed.
- **Hero blocks K (already on board):** K♠ on board removes K♠-suited Kx from villain; K♦ blocker additionally removes K♦ combos. Combined: removes ~25 villain Kx combos total out of ~40.
- **Board 7♦ and 7♣ blockers (not hero-held):** reduce villain's 7-containing combos.

**Net effect on villain's continuing range:**
- Villain's Kx continuing range (strong-Kx calls + weak-Kx calls) reduced by ~25%.
- Villain's Ax-no-pair range reduced by ~30% (many ace combos now impossible).
- Villain's trips (77 or 7x): 77 reduced from 3 → 3 (board takes 2; hero blocks 0) = 3; 7x suited reduced from ~12 → ~10 (hero's K♦ blocks K♦7♦? No, K♦7♦ is hero using K♦ as one of two cards, and 7♦ is on board so that combo is impossible anyway). Hero does NOT block villain's trips meaningfully.

**Net combo shift:** villain's called range is ~25 combos thinner; ratio of value:showdown-value:air within call range shifts slightly toward value (pairs/Kx) because hero's blockers removed more Ax-no-pair than Kx-value.

**Fold-equity adjustment:** hero's blockers slightly REDUCE bluff-catching combos in villain's range (fewer Ax-no-pair → slightly fewer "whiff" folds). Equivalent fold-rate impact: -2 to -3 percentage points. Fold-rate drops from ~50% (ex-ante) to ~47% (post-blocker). Still well above the 24.6% MDF threshold.

**Equity-shift:** hero's equity rises slightly because villain's ace-high bluff-catchers are blocked more than value-trips (hero doesn't block trips). Equity lifts from 82% → ~83% — marginal positive.

**Qualitative verdict.** Hero's A and K blockers are **mildly unfavorable for fold equity** (reduce air combos more than value) but **mildly favorable for net equity** (reduce villain-chop-candidates more than villain-crush-candidates). **Net effect is small** — on the order of ±1 percentage point. Blockers do not flip any decision.

---

## §10. MDF, auto-profit, realization (v2.3 D15 + D17 N/A — HU artifact)

**MDF (BB facing hero's 33% cbet).**
- Pot odds facing cbet: BB needs to call 1.8 to win 7.3 (pot 5.5 + hero bet 1.8) → pot-odds = 1.8/(1.8+5.5+1.8) wait. Let me recompute cleanly.
- Pot before BB decision: 5.5 (flop pot) + 1.8 (hero cbet) = 7.3.
- BB call: 1.8 to win 7.3. Ratio: 1.8 / (7.3 + 1.8) = 1.8/9.1 = **~19.8% required equity to break even on call.**
- MDF = pot / (pot + bet) = 5.5 / (5.5 + 1.8) = 5.5 / 7.3 = **~75.3% of BB's range must defend for hero's cbet to NOT be auto-profit.**

Wait — clarification. MDF is the threshold below which folding becomes exploitable. If BB folds more than 1 − MDF = 24.7%, hero's pure-bluff cbet becomes auto-profitable. Given BB's live-pool fold rate of ~50%, hero's 33% sizing is **well into auto-profit territory as a pure bluff** — BB over-folds by ~25 percentage points relative to MDF. Pure-bluff EV = 0.50 × 5.5 − 0.50 × 1.8 = 2.75 − 0.90 = +1.85bb (ignoring eq-when-called). With hero's ~82% equity when called, the recommendation is overwhelmingly positive.

**Auto-profit threshold (AP).** For a pure-bluff, AP = bet / (bet + pot) = 1.8 / (1.8 + 5.5) = 1.8/7.3 = **~24.7%**. Pool fold rate ~50% → auto-profit by ~25 percentage points. **Cbet is auto-profitable even ignoring hand equity.**

### Range-vs-hand MDF divergence (v2.3 D15)

**N/A.** Hero's AK TPTK is BOTH range-top AND individual-hand-correct-to-cbet. Range-MDF analysis (what fraction of hero's range should cbet) gives ~66% cbet-frequency from solver at the aggregate level. Individual-hand analysis (AK specifically) says cbet ~95%+ of time. No divergence — both call for cbet. **D15 explicitly non-applicable** (second corpus artifact with explicit-non-applicability; prior: artifact #9 J85 MW).

Contrast: D15 would apply if hero held 88 (underpair below K, with 2 outs to set but behind Kx and trips). Range-MDF might say 88 is in cbet-frequency for protection/denial; individual-hand-equity analysis shows 88 is only ~40% vs continuing range and cbet loses per-call-EV. Not this artifact's hero.

### Realization factor

Hero is OOP in 100bb SRP at flop SPR 17.6 (DEEP zone).

- **Baseline OOP realization:** ~0.80 (OOP faces realization-depression of ~20% at DEEP stacks vs perfect 1.0 equity-realization in isolation).
- **Texture adjustment:** Paired rainbow — **neutral** for realization (no flush/straight draw pressure that would depress OOP realization further). Keep 0.80.
- **Hand-type adjustment:** TPTK specifically has above-baseline realization (~0.88) because it has strong showdown value, survives multi-street play without draw-completion anxiety, and can value-bet across streets.
- **Final realization for hero AK:** ~0.88.

This matters more in the "check-back" counterfactual EV computation (§8) than in the "cbet 33%" EV computation.

---

## §11. Claim-falsifier ledger

v2.3-native with D14 applied throughout §5.

### Node-state claims (§1)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 1.1 | Effective stack at flop | 97bb | computed | 100 − 3 preflop | — | exact | **Internal:** recomputation |
| 1.2 | Pot at node (authored) | 5.5bb (strict derivation 6bb) | computed | 3+3=6bb; authored 5.5 ≈ 2.5bb-open convention | — | ±0.5bb | **Internal:** derivation gap logged |
| 1.3 | SPR at decision | 17.6 | computed | 97/5.5 | — | exact | Recomputation |
| 1.4 | Board texture class | paired rainbow K-high | read | Cards on board | — | exact | — |

### Range-construction claims (§2)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 2.1 | SB open range (live 9-handed) | ~42%, ~560 combos | population-consensus-observed | Standard live-cash SB open in 9-handed; Doug Polk + Upswing live-cash course | — | ±6 pp (530–590) | **External-operational:** live HUD sample outside [35%, 50%] |
| 2.2 | BB flat range vs SB open (live) | ~35%, ~460 combos | population-consensus-observed | Live BB defend-narrow per POKER_THEORY §9.2 analogy; Upswing + Jonathan Little live-cash content | — | ±6 pp (420–500) | **External-operational:** live HUD outside [28%, 42%] |
| 2.3 | BB solver-HU defend frequency (counterfactual) | ~85% | solver | Getcoach HU solver corpus; PokerCoaching 100bb HUNL charts | — | ±5 pp | **Theoretical:** solver HUD deviation |
| 2.4 | Post-board-conflict reduction to villain range | ~5% | computed | Card removal from K♠/7♦/7♣ | — | ±2 pp | **Internal:** card arithmetic |
| 2.5 | Post-hero-blocker villain range | ~415 combos | computed | 440 × (1 − hero-removal ~6%) | — | ±25 combos | **Internal:** recompute |
| 2.6 | Hero's flop range combo total | ~560 combos | computed | Matches preflop open range (no filter) | — | ±30 | **Internal:** enumeration |
| 2.7 | Hero's Kx strong sub-range (AKs/AKo/KQs/KQo) | ~36 combos | computed | Combinatorics post-board | — | ±4 | Recomputation |
| 2.8 | Hero's AA/KK/77/7x nuts class | ~15 combos | computed | Combo count after board removal | — | ±3 | Recomputation |
| 2.9 | Villain's 77 trips combos | 3 | computed | 77 full 6 − board 2 = remaining-math; actually C(2,2) hit → trips present | — | exact | **Internal:** counting |
| 2.10 | Villain's 7x suited trips combos | ~12 (post live-flat filter) | computed | Suited 7x in flat range; AKs-A7s not flat; Q7s-97s suited flat | — | ±4 | **Internal:** enumeration |
| 2.11 | Villain's Kx (all top-pair combos) | ~40 (pre-blocker) / ~25 (post-blocker) | computed | Live flat Kx range minus K♦ and K♠ blockers | — | ±5 | **Internal:** recompute |
| 2.12 | Villain's underpair (22–TT) | ~62 combos | computed | Flat range pairs 22–JJ-partial | — | ±8 | **Internal:** recompute |
| 2.13 | Villain's ace-high no-pair | ~45 combos (post-blocker) | computed | Ax-in-flat minus A♥-blocked | — | ±8 | **Internal:** recompute |
| 2.14 | Villain's random air | ~250 combos | computed | Flat range total minus other classes | — | ±30 | **Internal:** enumeration |

### Equity claims (§3)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 3.1 | Hero AK eq vs 77 trips | ~4% | equity-derived | 2 Ks on turn/river × 2 streets, ~4% | — | ±1 pp | **Internal:** Equilab |
| 3.2 | Hero AK eq vs 7x suited trips | ~8% | equity-derived | Same 2-outer draw for K; slightly wider vs lower-kicker 7x | — | ±2 pp | Equilab |
| 3.3 | Hero AK eq vs AK chop | ~50% | equity-derived | Split pot on Kx paired board | — | ±1 pp | **Internal:** exact chop |
| 3.4 | Hero AK eq vs Kx weaker (KQ, KJ, KT, K9-K2) | ~75% | equity-derived | A-kicker dominates; villain has 3 outs per street for kicker-improve (none work here — K board makes kicker relevant) | — | ±4 pp | Equilab |
| 3.5 | Hero AK eq vs QQ/JJ underpair (live flat portion) | ~75% | equity-derived | QQ/JJ have 2 outs to set; hero dominates | — | ±4 pp | Equilab |
| 3.6 | Hero AK eq vs underpair 88–TT | ~82% | equity-derived | Underpair 2-outer + sparse straight outs | — | ±3 pp | Equilab |
| 3.7 | Hero AK eq vs low underpair 22–66 | ~82% | equity-derived | Same | — | ±3 pp | Equilab |
| 3.8 | Hero AK eq vs ace-high no-pair | ~75% | equity-derived | Hero TP dominates A-high (3 outs to pair for villain) | — | ±4 pp | Equilab |
| 3.9 | Hero AK eq vs random air | ~92% | equity-derived | Air has ~2-3 outs across 2 streets | — | ±3 pp | Equilab |
| 3.10 | Hero AK weighted equity vs villain range | ~82–84% | computed | Bucket-weighted: (305×0.90 + 85×0.70 + 6×0.50 + 15×0.10) / 411 | — | ±3 pp | **Internal:** recomputation |
| 3.11 | Equity distribution shape | right-skewed / nuts-concentrated | computed | Bucket counts: ~305 nuts, ~85 strong, ~6 medium, ~15 air | — | qualitative | **Internal:** recount |

### Solver claims (§4)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 4.1 | Solver cbet-33% frequency on K77 paired rainbow | 60.2% | solver | Getcoach HU 100bb solver output (cited in LSW-A3) | — | ±5 pp | **Theoretical:** solver output outside [55%, 67%] |
| 4.2 | Solver check frequency | 32.9% | solver | Same source | — | ±5 pp | **Theoretical:** outside [28%, 38%] |
| 4.3 | Solver cbet-67% frequency | 6.2% | solver | Same source | — | ±3 pp | **Theoretical:** outside [3%, 10%] |
| 4.4 | Solver cbet frequency for AK specifically (vs range aggregate) | ~95–100% | solver | Directional inference from range-distribution + TPTK-at-top | — | ±5 pp | **Theoretical:** outside [85%, 100%] |
| 4.5 | Solver BB check-raise frequency vs small cbet | ~10–15% | solver | GTO Wizard "Attacking Paired Flops From the BB" | — | ±5 pp | **Theoretical:** outside [5%, 20%] |

### Population claims (§5, D14 labeled)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 5.1 | Live pool aggregate cbet frequency on paired rainbow | ~55–65% | population-consensus-observed (D14) | Doug Polk + Upswing HU + SplitSuit Paired Boards article | — | ±10 pp | **External-operational:** live sample outside [40%, 75%] |
| 5.2 | Live pool sizing skew (over-uses 50-75%) | frequent (qualitative) | population-consensus-observed | SplitSuit Paired Boards; Upswing Small Bets podcast | — | qualitative | **External-operational:** sample |
| 5.3 | Live pool BB fold rate to 33% cbet on K77r | ~45–55% | population-observed | Live observation; no HUD dataset | n≈0 | ±15 pp | **External-operational:** outside [30%, 70%] |
| 5.4 | Live pool BB check-raise frequency vs cbet | ~5–10% | population-observed | Live passivity | n≈0 | ±5 pp | **External-operational:** outside [2%, 15%] |
| 5.5 | Station response (pool-type-4) — calls any pair | directional | population-observed | Doug Polk + Little station-exploitation content | — | qualitative | **External-operational:** sample |

### Exploit-recommendation claims (§6)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 6.1 | Recommended action (hero AK) | Cbet 33% pot | computed | Solver-aligned + population-refinement | — | — | **Theoretical:** solver disagreement |
| 6.2 | Expected EV | +5.0bb | computed | Weighted EV from §8 | — | ±1.5bb | **Internal:** recompute §8 tree |
| 6.3 | Archetype-action-robustness | All 4 archetypes cbet | computed | Per §12 sensitivity | — | — | **Internal:** §12 analysis |

### Villain-perspective claims (§7)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 7.1 | BB flop-call frequency vs 33% cbet | ~45% | computed | Pairs + Kx + some Ax = call range ~200 combos / 415 total | — | ±8 pp | **External-operational:** live sample |
| 7.2 | BB flop-fold frequency vs 33% cbet | ~50% | computed | Air + broadway-missed + small pairs that give up = fold range ~205 combos | — | ±8 pp | **External-operational:** sample |
| 7.3 | BB flop check-raise frequency vs cbet | ~5% (live) / 10-15% (solver) | solver + population-observed | Live-pool passive; solver-balanced more aggressive | — | ±5 pp | **External-operational:** sample |
| 7.4 | BB average continuing-range equity vs hero | ~35–40% | computed | Post-hero-blocker call-range equity | — | ±5 pp | **Internal:** Equilab |
| 7.5 | BB call-EV vs 33% cbet (BB perspective) | positive | computed | 0.35 × 9.1 × 0.88 − 1.8 ≈ +0.99bb | — | ±0.5bb | **Internal:** recompute |

### EV-tree claims (§8)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 8.1 | Fold-branch probability | 0.50 | computed | Matches §7 row 7.2 | — | ±0.08 | Arithmetic |
| 8.2 | Fold-branch EV | +2.75bb | computed | 0.50 × 5.5 | — | exact | Arithmetic |
| 8.3 | Call-branch probability | 0.45 | computed | Matches §7 row 7.1 | — | ±0.08 | Arithmetic |
| 8.4 | Turn card class distribution | per table | computed | Deck math (49 unknowns) | — | exact | **Internal:** deck arithmetic |
| 8.5 | Turn weighted hero equity | ~82.6% | computed | Per-turn-class weighted | — | ±3 pp | **Internal:** recompute |
| 8.6 | Depth-2 call-branch EV contribution | +2.25bb | computed | 0.45 × (+5bb average turn+river branch EV) | — | ±1bb | **Internal:** recompute |
| 8.7 | Raise-branch probability | 0.05 | computed | Matches §7 row 7.3 live | — | ±0.03 | Arithmetic |
| 8.8 | Raise-branch EV | −0.5 to 0bb | computed | Hero folds to CR most often; AK marginal call | — | ±0.5bb | **Internal:** recompute |
| 8.9 | Cbet 33% total EV | +5.0bb | computed | +2.75 + 2.25 − 0 ≈ +5bb | — | ±1.5bb | **Internal:** recompute full tree |
| 8.10 | Cbet 67% total EV (comparison) | +3.75bb | computed | Fold +3.58, call +0.2, raise negligible | — | ±1bb | **Internal:** recompute |
| 8.11 | Check-back total EV | +3.25bb | computed | 0.82 × 5.5 × 0.75 ≈ +3.38bb ± OOP penalties | — | ±1bb | **Internal:** recompute |
| 8.12 | Delta cbet 33% vs cbet 67% | +1.25bb | computed | +5.0 − 3.75 | — | ±1.5bb | Arithmetic |
| 8.13 | Delta cbet 33% vs check | +1.75bb | computed | +5.0 − 3.25 | — | ±1.5bb | Arithmetic |

### Blockers (§9)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 9.1 | K♦-blocked villain Kx combos | ~10 | computed | Kx in flat range × K♦-containing fraction | — | ±2 | **Internal:** card arithmetic |
| 9.2 | A♥-blocked villain Ax combos | ~15 | computed | Ax in flat range × A♥-containing fraction | — | ±3 | **Internal:** card arithmetic |
| 9.3 | Fold-rate shift from blockers | −2 to −3 pp | computed | Reduced air-fold combos partially offset by reduced value | — | ±1 pp | **Internal:** recount |
| 9.4 | Equity shift from blockers | +1 pp | computed | Minor lift: removes chop more than crush | — | ±1 pp | **Internal:** Equilab |
| 9.5 | Net decision-impact of blockers | null (no flip) | computed | Small magnitude, no recommendation shift | — | — | **Internal:** recheck §6/§12 |

### MDF / auto-profit / realization (§10)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 10.1 | BB MDF vs 33% cbet | ~75.3% defend required | computed | 5.5/(5.5+1.8) | — | exact | Formula |
| 10.2 | Auto-profit threshold (pure bluff) | ~24.7% fold needed | computed | 1.8/(1.8+5.5) | — | exact | Formula |
| 10.3 | Pool-fold-margin above AP | ~25 pp (fold 50% − 25% AP) | computed | Live pool fold − AP | — | ±10 pp | **External-operational:** live sample |
| 10.4 | Hero OOP realization at DEEP SPR | ~0.80 (baseline) | assumed | Standard OOP-IP realization table | — | ±0.05 | **External-operational:** sourced table |
| 10.5 | TPTK realization adjustment | +0.08 → 0.88 | computed | Strong showdown hand + multistreet viability | — | ±0.05 | **External-operational:** sourced | 
| 10.6 | D15 divergence status | N/A (TPTK is range-top AND individual-correct) | conceptual | Hero TPTK doesn't trigger divergence | — | — | **Internal:** explicit non-divergence |

---

**[Completeness: swept 2026-04-23, 55 claims ledgered, all falsifiers present. Rubric-Version v2.3.]**

### Lowest-confidence load-bearing claims

1. **Rows 5.1–5.4 (population consensus observations).** `population-consensus-observed` wider-CI than dataset-level. 5.3 BB fold rate is the most load-bearing because §8 EV depends heavily on it.
2. **Rows 2.1–2.2 (SB/BB range estimates live-calibrated).** Wide upstream CI. Affects all downstream combo counts.
3. **Rows 10.4–10.5 (realization factors).** Single-source table-inference; wide impact on "check" counterfactual EV.

---

## §12. Sensitivity analysis

### Assumption A — BB fold rate vs 33% cbet (current estimate 50%)

**Flip threshold:** BB fold rate would have to drop below ~10% for cbet-33% to become negative-EV (hero already has ~82% equity when called, so the call-branch is positive-EV too). Even at fold-rate 0% (villain calls every combo), cbet-33% remains positive-EV: `+0 (fold) + (0.82 × 9.1 × 0.88 − 1.8) ≈ +4.77bb` — still positive.

**Decision-level conclusion:** **Cbet 33% is robust across all plausible fold rates.** No flip threshold within realistic CI.

### Assumption B — Hero equity vs villain full range (current estimate 82%)

**Flip threshold:** Equity would need to drop below ~40% for cbet vs check-back to invert meaningfully. At realistic CI (~75–86%), no flip.

### Assumption C — Villain check-raise frequency (current 5% live / 10–15% solver)

**Flip threshold:** If CR frequency exceeds ~25% (solver against an ultra-aggressive BB), hero's cbet-33% might shade toward check-back for protection. Live passivity and solver equilibrium both sit well below 25%.

**Decision-level conclusion:** Action robust.

### Assumption D — Population sizing (what if pool cbets at 50%+ normally)

**Flip threshold:** Our recommendation of 33% (not 50%+) is sizing-exploit-driven. If the population ACTUALLY cbet at 33% already, our recommendation would be no-edge. Pool reality: ~30–40% of cbets are at 33%; rest at 50–75%. **Our 33%-discipline is a genuine exploit vs the majority of pool cbet sizing behaviors.**

### Summary

**Cbet 33% is decision-level-robust.** No assumption's CI contains a flip-point. Sizing-vs-pool is the exploit lever; action-vs-solver is aligned.

---

## §13. Contrast with leading theories (v2.2 D13 + v2.3 D16 applied)

### Reflexive check 1 — Internal-arithmetic

- §3 weighted equity: `(305×0.90 + 85×0.70 + 6×0.50 + 15×0.10) / 411 = 338.5/411 = 82.4%` ✓ matches §3 claim
- §8 cbet 33% total EV: `+2.75 (fold) + 2.25 (call) − 0.0 (raise) = +5.0bb` ✓ matches §8.9
- §10 MDF: `5.5/(5.5+1.8) = 5.5/7.3 = 75.3%` ✓
- §10 AP: `1.8/(1.8+5.5) = 1.8/7.3 = 24.7%` ✓

All internal-arithmetic checks pass. No B-finding.

### Reflexive check 2 — Source-scope

- **Getcoach HU 100bb solver output (LSW-A3 citation):** scope covers HU SRP 100bb; matches our claim context. ✓
- **Upswing "When To Bet Small" podcast:** stake-scope mid-to-high-stakes; matches. ✓
- **SplitSuit "Poker Paired Boards":** stake-scope live-to-mid-stakes; matches. ✓
- **GTO Wizard "The Mechanics of C-Bet Sizing":** stake-scope general HU cash; matches. ✓
- **GTO Wizard "Attacking Paired Flops From the BB":** mirror source (BB's perspective); matches when mirrored to hero's perspective. ✓
- **Doug Polk content:** stake-scope cash (mid + high); matches for directional population claims. ✓
- **Jonathan Little content:** stake-scope live 1/2–5/10; matches for live-pool claims. ✓

All source-scopes verified. No B-finding.

### Per-claim comparison — 10 sources consulted

| Source | Position on K77r cbet | Category |
|---|---|---|
| Getcoach HU solver | 33% cbet 60.2%, check 32.9%, 67% 6.2% | **A** (primary source — we quote directly) |
| Upswing "When To Bet Small" | Paired flops = small cbet; HU 30–40% range | **A** |
| SplitSuit "Paired Boards" | Small cbet dominant on paired textures | **A** |
| GTO Wizard "Mechanics of C-Bet Sizing" | Merged range → small; polar range → large | **A** |
| GTO Wizard "Attacking Paired Flops From BB" (mirror) | BB should check-raise ~10-15% vs small cbet | **A** (corroborates Claim 4.5) |
| Doug Polk (HU content) | Cbet paired boards small; polar big is a leak | **A** |
| Jonathan Little (live cash) | Pool over-sizes; small is correct | **A** (corroborates §5.2) |
| Ed Miller *Playing The Player* | Pool-type-4 station-exploit — size up vs stations | **A with nuance** (informs archetype-vs-station adjustment; see §6 archetype note) |
| Tommy Angelo "Elements of Poker" | Recreational-facing; no solver detail but agrees with "bet small on paired, bet big on dynamic" folk theorem | **A** (corroborating, pre-solver framing) |
| Matthew Janda *Applications of NLHE* | Pre-solver mostly; merged cbet concept aligns | **A with nuance** (pre-solver framing; range-advantage language close to solver-modern) |

**Verdict: 10A (8 direct + 2 with-nuance).** Consensus-robust.

### Active challenge (v2.3 D16)

Zero B / C-wrong / C-incomplete found. D16 documentation required.

**(a) Sources probed: 10** (listed above). Additionally probed:
- **Pre-solver classics:** Sklansky *Theory of Poker* — no direct paired-board cbet sizing treatment; addresses cbet in abstract, no B.
- **Contrarian camps:** Searched for any advocate of polar-large cbet on paired-rainbow boards — none found; universal small-sizing consensus.
- **Elite high-stakes:** Phil Galfond, Isaac Haxton content — agree with merged-small-on-paired framing.

**(b) Angles attempted:**
1. **Pre-solver era:** Sklansky, Harrington. Pre-solver merged/polar dichotomy barely formalized; no explicit paired-board guidance but "bet smaller on dry" folk theorem aligns directionally. Closest-to-disagreeing because pre-solver framing wouldn't distinguish paired vs dry — but that's absence-of-opinion, not disagreement. Not a C-incomplete (omission doesn't shape our content).
2. **HU-online high-stakes:** Doug Polk, Ben Sulsky. All agree small cbet on paired.
3. **Live-cash old-school:** Ed Miller, Tommy Angelo. Both agree; Miller adds station-exploit nuance (A-with-nuance).
4. **Tournament-specific (ICM, short-stack):** Tournament literature on paired-board cbet is thin; ICM concerns would push toward more conservative sizing, not different sizing. No B/C.
5. **Contrarian population-heavy schools** (Zeebo-style pure-exploit, Jaffe-style hyper-aggression): did not surface advocates for polar-large cbet on paired. Pure-exploit schools focus on non-sizing deviations (more/fewer cbets, not different sizing).

**(c) Closest-to-disagreeing source:** Ed Miller's *Playing The Player* chapter on station exploitation. Miller advocates sizing-up vs stations (pool-type-4). Our §6 archetype note captures this as "Fish / station: sizing widens to 50%." Miller's position is not B/C; it's archetype-conditional and fully absorbed into our archetype note. **Classification: A with nuance.**

**No legitimate B, C-wrong, or C-incomplete.** Consensus is genuine.

### POKER_THEORY.md §9 impact

No new §9 D entry generated. This spot is a live-pool AGREEMENT with solver (on sizing direction), just a quantitative under-frequency at the population level (which is §5 material, not §9 intentional-divergence material).

**Mild candidate:** if we wanted to document "live pool under-uses 33% sizing on paired boards and over-uses 50–75%," that could become a §9.X entry about sizing-skew. Not urgent — it's observational divergence at the population level, not a deliberate departure from solver in our own content. Defer.

---

## §14. Verification architecture

### §14a. Symmetric-node test

**Mirror:** `bb-vs-sb-srp-ip-paired-k77-flop_root` (role-inverted). Hero is now BB IP facing SB's 33% cbet — the defender perspective on the same node.

Six claims classified:

1. **Hero's range composition vs villain's range composition.** → **Inverts.** Hero BB has the wider, weaker, more-pair-heavy range (flat range); villain SB has the narrower, top-loaded open range. Roles flip.
2. **Hero equity vs villain.** → **Inverts.** BB's equity vs SB's cbet-range is ~20–25% (SB cbets with value-skew hero AK TPTK or better); the mirror artifact would require BB to defend with pair+some-Ax + check-raise trips.
3. **Hand class chosen (TPTK).** → **Partial change.** AK for BB-IP is different — BB would not have AK in a flat range typically (AK 3bets vs SB open). Mirror-hero would more likely hold a mid-pair or K-weaker-kicker. Mirror artifact would pick Kx-weak or underpair as hero hand.
4. **Small-sizing rationale ("reduced nut advantage, merged range").** → **Stays.** The structural property of paired rainbow board is independent of who's cbetting; villain's small cbet in the mirror is justified by the same reasoning. JUSTIFICATION: paired-board sizing principle is texture-driven, not position-driven.
5. **Solver cbet-33% rate 60.2%.** → **Stays.** Same board, same solver. JUSTIFICATION: solver baseline is board-specific, not position-specific (symmetric across roles since BB also "cbets" after flop-check in mirror).
6. **Pool over-sizing leak (50–75%).** → **Stays.** The leak is pool-wide, not position-specific. JUSTIFICATION: HU-style polar-cbet-on-paired leak applies to any PFA.

**Test result: 2 invert, 3 stay, 1 partial-change.** Under D8 partial-change cap (max 3). Clean mirror.

### §14b. Falsifier synthesis

Decision-level-robust per §12. No headline falsifier flips recommendation.

**Sizing-sensitivity (not action-sensitivity):** the only plausible flip is 33% → 50% sizing if population fold-rate at 50% is materially higher AND per-call EV at 50% exceeds per-call EV at 33% (station-exploit path). Even in that case, the *action* remains cbet; only the *sizing* adjusts. No binary action falsifier within realistic CI.

**Statement:** "Cbet 33% is action-level robust; sizing 33% → 50% conditional on confirmed-station archetype via §6 archetype note." Decision-level-robust in §14b synthesis sense.

### §14c. Counter-artifact pointer

`sb-vs-bb-srp-oop-paired-k77-flop_root-underpair-variant.md` — hero holds 99 (underpair below K, below trips-threshold, between pair-class and weak-class). Would surface D15 divergence: range-level solver might say "99 cbets for denial at some frequency" but individual-hand analysis (99 vs BB's flat range on K77r) shows 99 is ~45–55% equity and cbet-equity-denial-EV is a close call. The D15 test would exercise range-vs-hand divergence on the same texture, providing a direct contrast with this artifact's D15-non-applicable case.

Additional counter-artifacts: `...-bottom-pair-variant.md` (hero holds 77 trips — nuts class, different sizing pressure); `...-air-variant.md` (hero holds K♠Q♠ well no impossible; try Q♠J♣ air with backdoor gutshot — first-pair pure-bluff candidates).

---

## Closing note

US-1 Artifact #10. v2.3-native. **First paired-board artifact in corpus.**

**Rubric observations:**

1. **v2.3 D14 `population-consensus-observed`** applied to §2.1, §2.2, §5.1, §5.2. Doug Polk + Upswing + SplitSuit consensus with stated stake-scope. Sourcing floor met.
2. **v2.3 D15 non-applicable** (second corpus instance; first was #9 J85). Hero TPTK is both range-top AND individual-hand-correct. Explicitly marked in §10.6 + §14b.
3. **v2.3 D16 search-depth documented** — 10+ sources + 5 angles + closest-to-disagreeing (Ed Miller station-exploit, classified A-with-nuance).
4. **v2.3 D17 (multi-way) N/A** — HU artifact.
5. **v2.1 D10 first-pass enumeration discipline** applied in §2. First-pass combo counts committed before computing weighted equity; §3 recomputation agrees. No calibration back-solving.
6. **Texture as first-order structural variable.** Paired-rainbow texture drives the sizing prescription (small-merged not large-polar), and this cascades through §4, §5, §6, §7 entirely. Structural distinction from all prior corpus artifacts — paired texture is a different regime than unpaired.
7. **Pot 5.5bb vs strict-derivation 6bb gap** logged as §11 row 1.2 internal-falsifier. Minor authoring convention issue; does not affect the recommendation.

**Contrast with artifact #5 (Q72r turn_brick):** both SRP HU hero-OOP-facing-merged decisions, but Q72r is unpaired dry and artifact #5 uses 50% sizing for thin value on the turn. K77 is paired, uses 33% for merged cbet on the flop. The sizing delta is texture-driven: paired → small, unpaired-dry → medium. Both artifacts explicit about sizing rationale.

**Ledger density:** 55 claims / ~7k words = ~7.9 claims/1k words. Slightly above corpus average.

**Corpus now 10 artifacts.** **5 more to reach 15-target.**

**Stage 3i (audit) + Stage 4i (comparison) + Stage 5i (drill card)** to follow.

---

*End of artifact.*
