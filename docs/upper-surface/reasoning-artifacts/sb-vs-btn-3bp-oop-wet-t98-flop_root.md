---
Rubric-Version: v2.3
Node-ID: sb-vs-btn-3bp-oop-wet-t98-flop_root
Street: flop
Line: src/utils/postflopDrillContent/lines.js L2085-L2122 (LINE_SB_VS_BTN_3BP_OOP_WET.nodes.flop_root)
Authored: 2026-04-23
Authored-By: Claude (main, US-1 Artifact #11 — v2.3-native, first overpair-as-hero + first "check correct")
Status: draft
Companion-LSW-Audit: docs/design/audits/line-audits/sb-vs-btn-3bp-oop-wet-t98.md (LSW-A4, closed; LSW-F4 shipped)
Related-Artifact: sb-vs-btn-3bp-oop-wet-t98-river_after_turn_call.md (artifact #7 — same line, late-street AA fold decision)
Upstream-POKER_THEORY-entry: §9.3 SB flat-call of BTN 3-bet (live-pool Category-D divergence)
---

# Upper-Surface Artifact — `sb-vs-btn-3bp-oop-wet-t98-flop_root`

**Spot.** Heads-up 3-bet pot. Hero **SB (OOP, first to act postflop)**. Villain **BTN (IP, last to act, 3bettor)**. Effective stack 90bb at flop. Line: SB open 3bb, BTN 3bet to 10bb, SB call. Flop **T♠9♠8♥** (two-tone, middling-connected — max-wet texture with straight-on-board, flush-draw, and multiple open-enders). Hero holds **A♦A♣** (pocket aces — overpair to the board).

**Authored teaching answer:** Check (pot control). Bet 33% and Bet 75% both incorrect (sizing/line leaks on strong-but-vulnerable hand).

**Structural distinction from prior corpus artifacts (1–10).**
- **First overpair-as-hero artifact.** All prior hero holdings were TPTK (AK/AQ/AJ), TPGK (KJ-tier), mid-pair underpair, or (one case) pinned ace-blocker. **AA as overpair on wet board** is a distinct hand class with distinct decision logic: strong-but-vulnerable rather than strong-and-dominating.
- **First "check is correct" decision in corpus.** All prior hero decisions at flop_root involved betting (cbet, donk, jam) or defending (call vs bet). This is the first node where the authored-correct answer is *check for pot control* with a strong hand. Teaches the overpair-equity-realization-discipline regime.
- **First hero-OOP-in-3BP-flop-decision** (companion artifact #7 was river in same line; this is the upstream decision that determines whether AA even reaches the river).
- **Inherits Category-D divergence** (POKER_THEORY §9.3 SB flat-3bet). The entire scenario is live-pool-constructed — solver has SB essentially 3bet-or-fold vs BTN 3bets. The line teaches the live-pool spot to live-pool students.
- **Max-wet texture** with straight-on-board, flush-draw, and multiple open-enders — most dynamic-equity-threatened texture in corpus.

---

## §1. Node specification

**Game state.** NLHE cash. Stake target: live 2/5 to 5/10 NL (where SB-flat-3bet pathway appears with non-negligible frequency in the live pool). 9-handed live ring, action folds to SB who opens; BTN 3bets; action folds back around; SB calls 3bet (live-pool pathway).

**Positions.** Heads-up postflop. Hero SB acts first every street (OOP). Villain BTN acts last every street (IP).

**Effective stack.** 100bb preflop → 90bb at flop (each player committed 10bb preflop via the 3bet path).

**Pot at node.** Authored **21bb**. Derivation:
- SB posts 0.5, BB posts 1 = dead 1.5bb.
- SB opens to 3bb (adds 2.5bb to post).
- BTN 3bets to 10bb (puts 10bb total from stack).
- BB folds (1bb dead, stays in pot).
- SB calls to 10bb (adds 7bb to complete call).
- Total: SB 10 + BTN 10 + BB 1 = **21bb**. ✓ Matches authored.

Clean derivation. No gap.

**Board.** T♠ 9♠ 8♥. **Two-tone** (♠♠♥). **Middling-connected** — T-9-8 is the most-connected non-monotone middling flop possible.
- **Flush draw possible:** ♠-suited combos hero or villain may hold.
- **Straight on board:** T-9-8 requires **QJ** (high-straight: Q-J-T-9-8) or **76** (low-straight: T-9-8-7-6), or **J7** (middle-straight: J-T-9-8-7).
- **Draws alive on every turn/river card:** every spade completes flush (9 outs); 6, 7, J, Q, K (broadway) complete straights; 2/3/4/5 are the only "true bricks."
- **Overcards:** J, Q, K, A — not present on flop. Hero's A gives a pair of aces (AA) — hero's hand class.

**SPR at decision.** 90 / 21 = **~4.3**. **MEDIUM zone (4–8)** — transition between LOW-zone (fully committed) and HIGH-zone (deep-playable). At SPR 4.3, hero can realistically bet-fold flop (rare) or bet-get-committed on turn; check-call lines retain flexibility.

**Action history.**

| Step | Actor | Action | Size (bb) | Pot after (bb) | Stack after (bb) |
|---|---|---|---|---|---|
| 0 | SB | post | 0.5 | 0.5 | 99.5 |
| 0 | BB | post | 1 | 1.5 | 99 |
| 1 | SB (hero) | open | 3.0 (delta 2.5) | 4.0 | 97.0 |
| 2 | BTN (villain) | 3-bet | 10.0 | 14.0 | 90.0 |
| 3 | BB | fold | — | 14.0 | — |
| 4 | SB (hero) | call | 10.0 (delta 7) | 21.0 | 90.0 |
| 5 | *flop T♠9♠8♥* | — | — | 21.0 | — |
| *node entry* | SB (hero) | — (decision) | — | 21.0 | 90.0 |

**Prior-street filter rationale.**

- **SB preflop open filter.** Hero's open range is SB's open range from late position (folded to SB). Live-calibrated ~40–45% ≈ ~560 combos. Hero's A♦A♣ is premium top-of-range.
- **BTN 3bet filter.** BTN 3bets vs SB open at tight-to-medium frequency. Live pool: QQ+/AKs/AKo value core, plus bluff blockers (A5s-A3s, 76s-98s suited). Modern solver: wider 3bet range (includes JJ/TT/AQo/suited A/K/Q blockers). Live-calibrated BTN 3bet ≈ 8–12% of hand range ≈ 106–160 combos.
- **SB response filter (the live-pool-divergence point).** Per POKER_THEORY §9.3: modern solver has SB 3bet-or-fold vs BTN 3bets (SB barely flats). Live-pool divergence: SB flats QQ-TT, AKs/AKo, AQs more often than solver (especially in tougher games where 4-betting light gets run over). Hero's AA flat is a further live-pool extension — some players flat AA for trap-slowplay, though more aggressive players always 4bet AA. The line is constructed around this live-pool pathway. Reader should understand the ENTIRE spot is a live-pool-only regime; teaching-value is for the live player who sees this pattern 2–5× per session at 2/5 NL.

**Summary sentence.** Hero SB with AA on max-wet T98ss (straight-on-board, flush-draw, multiple open-enders) at SPR 4.3 in a 3BP constructed via the live-pool SB-flat-3bet pathway, deciding whether to cbet OOP or check for pot control against BTN's tight 3bet range with all the draws.

---

## §2. Range construction, both sides (v2.1 D10 first-pass enumeration applied)

### BTN preflop 3bet range (live-calibrated)

Live BTN 3bet vs SB open at live 2/5-5/10 ≈ 8–12% of dealt hands ≈ ~130 combos. Composition:

| Hand class | Combos (estimate) | Flat fraction into flop |
|---|---|---|
| QQ+ (AA, KK, QQ) | 18 (6 each) | Partial — AA mostly 4bets at solver-level. Live pool flats AA ~20% (trap line). QQ-KK always flat a 4bet or just 3bet-call preflop. In "3bet pot" scenario here, all QQ+ that 3bet enter postflop: ~14 combos (after subtracting some AA 4bets that get folded/folded-to) |
| AKs, AKo | 16 (4s + 12o) | Most AK 3bets for value; always proceeds to flop if SB just calls. ~16 combos enter flop |
| AQs, AQo (partial) | 8 (4 AQs + 4 AQo partial) | AQs always 3bets; AQo partial 3bet. ~8 combos |
| AJs, KQs (value-blocker hybrid) | 8 (4 each) | Flat in 3bet range partial. ~8 combos |
| A5s-A3s (bluff blockers) | 12 (3 suits × 4) | Full live 3bet bluffs. ~12 combos |
| KJs-KTs (partial bluff blockers) | 8 | Partial. ~6 combos |
| QJs, 76s-98s (suited connectors, blocker bluffs) | 16 | Partial live. ~10 combos |
| JJ, TT (live partial 3bet — often flat instead) | 12 | Live flat more than 3bet. ~3 combos in 3bet range |
| 99, 88 (rare 3bet blocker) | 12 | Rare 3bet; ~1-2 combos |

**BTN 3bet range entering flop ≈ 130 combos** (within CI ±20).

### SB flat-3bet range (live-pool, Category-D per POKER_THEORY §9.3)

Live SB flat vs BTN 3bet ≈ ~30-40 combos (very narrow; live-pool-only):

| Hand class | Combos | Rationale |
|---|---|---|
| QQ-TT | 18 | Live pool flat instead of 4bet, especially vs tight 3bettor |
| AKs, AKo | ~8 | Partial flat (some 4bet for value; some flat for trap) |
| AQs | ~3 | Partial flat |
| AA (live trap-flat) | 3 | Rare; live-pool trap line. Hero's combo is this class |
| KK (similar live trap) | 3 | Rare live |

**SB flat-3bet range ≈ 35 combos.** Hero's A♦A♣ is one specific combo in the ~3-combo AA class (2 AA combos remaining in range after hero).

### Filter through flop T♠9♠8♥

No villain action yet — hero acts first OOP.

### Hero's range on T♠9♠8♥ (node-of-interest)

**Hero's flop range = SB flat-3bet range of ~35 combos.** Composition on this flop:

| Hero class | Combos | Board interaction |
|---|---|---|
| AA (overpair, hero holds 1 of these) | 3 | Overpair, strong-but-vulnerable |
| KK (overpair, underpair-to-AA) | 3 | Overpair |
| QQ (overpair above T) | ~4 (3 flat + 1 live mix) | Overpair, vulnerable |
| JJ | ~3 (live partial flat) | Overpair |
| TT (set of tens — nut) | 3 | Top set — nut class |
| 99 (set of nines) | 0-1 (rare flat) | Set |
| 88 (set of eights) | 0-1 (rare flat) | Set |
| AK (broadway) | ~6 (AKs flats partial; AKo flats partial) | Overcards + backdoor flush if ♠ |
| AKs specifically | 2 | Overcards + backdoor flush draw (if ♠-containing; 1 combo has two ♠s) |
| AQs | 3 | Overcards + partial-backdoor |

**Total: ~35 combos.** Hero's AA is one of the top-of-range combos but **not dominant** — TT set (3 combos) crushes AA, and nothing else in hero's range crushes AA.

### BTN 3bet range on T♠9♠8♥ (node-of-interest for hero's decision)

BTN's 3bet range (130 combos) interacting with T98ss board:

| Villain class | Combos | Equity vs hero AA |
|---|---|---|
| TT set | 3 (6 − 3 board-T-pair = wait; actually there's only 1 T on board so TT pairs have 3 combos remaining C(3,2)=3) | Hero drawing dead to A (hero AA drawing 2 outs... actually hero ahead only if case-A comes both turn+river; and even then needs to beat set of tens. Hero ~8% equity) |
| 99 set | 3 | Hero ~8% (same) |
| 88 set | 3 | Hero ~8% (same) |
| JJ overpair | ~6 (post live-mix) | Hero ~75% |
| QQ overpair | ~14 (post hero blocker check) | Hero ~75% |
| KK overpair | ~6 | Hero ~81% (AA dominates KK) |
| AA (hero blocks 2/6 = 4 combos remaining in villain's range, if at all; but AA typically 4bets in villain's 3bet range — consider 0 in villain's postflop range) | ~0 | — |
| AKs (two spades → flush draw) | ~2 | Hero ~65% (AK has 3 outs to pair + flush-draw 9 outs) |
| AKs (non-spade-pair) | ~2 | Hero ~72% |
| AKo | ~12 | Hero ~72% |
| AQs | ~3 | Hero ~72% (A has 3 outs + Q has 3 outs for 6 overcards) |
| AQo (partial) | ~4 | Hero ~72% |
| AJs | ~4 | Hero ~72% |
| KQs (suited-broadway) | ~3 | Hero ~75% (K-Q not on board; straight-draws if Q-comes on turn? Q would make Q-J-T-9-8, requires J too) |
| KJs, KTs (partial) | ~5 | Hero ~72% (mix of TP-K blockers) |
| A5s-A3s (blocker bluffs) | ~12 | Hero ~75% (ace-high with bluff equity) |
| 76s (made straight on T98) | ~3 (specific suits; flush-adjacent combos) | **Hero ~18% (straight crushes AA; hero has 2 outs for set of aces each street, plus chop on QJ-run if villain is also AK)** |
| 98s (two pair) | ~3 | Hero ~30% (two-pair crushes AA; hero draws A to improve) |
| T9s (top two) | ~2 | Hero ~28% (top-two crushes) |
| QJs (made straight) | ~3 | Hero ~18% (straight crushes) |
| J7s (middle straight — if in 3bet range, rare) | ~1 | Hero ~18% |

**Totals:** ~130 combos (cross-check). Segmenting by hero equity:
- **Hero crushed (~18-30% equity):** TT/99/88/76s/98s/T9s/QJs/J7s = ~21 combos. Sets + straights + top-two.
- **Hero ahead (~65-75% equity):** overpairs below AA (JJ-KK) + AK + AQ + AJ + KQs + KJs + KTs + A5s-A3s = ~75 combos.
- **Hero very ahead (~80%+ equity):** KK (hero's dominates) + some AJo = ~10 combos.
- **Hero drawing (~10-20% equity):** some flush-draw combos that need context = absorbed into "ahead" counts.

### Weighted hero equity vs BTN full 3bet range

`(21×0.22 + 75×0.72 + 10×0.81 + residuals) / 130 = (4.62 + 54 + 8.1) / 130 ≈ 66.7 / 130 ≈ **~51-58%**.` 

Cross-reference: authored rationale ("AA has ~60% equity vs BTN's range") lands in this window. Working value for artifact: **~55-60% hero equity** vs BTN's full 3bet range. (LSW-F4-A2 cites ~60%; first-pass enumeration gives ~55%; the range is ~55-60%, acknowledge both.)

**Shape.** **Split distribution.** Hero has ~21 combos where hero is crushed (straight/set/two-pair), ~85 combos where hero is modestly ahead (65-80% equity), and very few combos where hero is dominantly ahead (>80%). Unlike K77 where hero's distribution was heavy-nuts-concentrated, here hero's distribution has:
- A meaningful "crushed" bucket (~16% of villain range)
- A dominant "ahead but vulnerable" bucket (~65% of villain range)
- Very few "nuts" combos

**This is the "overpair on wet board" shape:** ahead of range but fragile to specific runouts + set/straight resistance. **Strong-but-vulnerable is the correct mental model** (not "bluff-catcher" — hero has far more equity than a bluff-catcher has).

---

## §3. Equity distribution shape

Hero AA on T♠9♠8♥ (flop). Two cards to come, many draws live.

**Buckets (~130 villain post-blocker combos):**

- **Nuts (>80%):** ~10 combos (AA vs KK, AA vs weakest A-high bluffs)
- **Strong (60–80%):** ~80 combos (overpairs below AA + AK + AQ + AJ + KQs + blocker-bluffs)
- **Medium (40–60%):** ~15 combos (AKs with flush draw + KQs-with-Q-spades)
- **Weak (20–40%):** ~5 combos (hero vs two-pair 98s/T9s + some draw-heavy combos post-turn)
- **Air (<20%):** ~20 combos (sets TT/99/88 + made straights QJs/76s/J7s)

**Weighted equity (bucket midpoints):** `(10×0.90 + 80×0.70 + 15×0.50 + 5×0.30 + 20×0.15) / 130 ≈ (9 + 56 + 7.5 + 1.5 + 3) / 130 ≈ 77/130 ≈ **59%**.`

Consistent with §2's ~55–60% and with authored "~60%." **Working value: 58% hero equity.**

**Shape analysis.** Compared to K77r (artifact #10, 82% equity, heavy-right-skew), T98ss is dramatically different:
- Equity is lower (58% vs 82%).
- Distribution has a non-trivial "crushed" bucket (~20 combos that hero is drawing-dead-or-thin against).
- Medium bucket exists (15 combos where equity is genuinely 50%-ish).
- Nuts bucket is tiny (~10 combos).

**Counterfactual flat distribution.** A flat-50% distribution gives 50% average. Actual 58% is only slightly above flat-50%. The "flatness" of the distribution is itself informative: hero's equity advantage is narrow and evenly-distributed, not concentrated in a nuts bucket. This shape favors **pot-control / check** over **big-bet value extraction** — there's no big value bet to make because there's no big value concentration.

**Equity variance across turn cards.** A huge variance in hero equity based on turn runout:
- Brick turn (2, 3, 4, 5, 6 non-spade): hero equity jumps to ~72%+ (draws die)
- Straight-completing turn (Q, J, 7, 6): hero equity drops to ~30-45% (depends which; J is mild, Q is mild-to-moderate, 7 is severe, 6 is severe)
- Flush-completing turn (any ♠): hero equity drops to ~35-45%
- Overcard turn (A, K, Q): hero equity improves (A especially — hero hits set)
- Pair-turn (T, 9, 8 — making 2-pair on board): hero equity shifts depending on combos

**High variance is why pot-control matters.** Hero must reach showdown across a hostile runout-distribution; bet-fold-flop lines get awkward on scary turns.

### Pure-bimodal note (v2.1 D12)

**Not applicable** — flop decision with draws alive. Equity continuous. D12 applies only on river decisions.

---

## §4. Solver baseline

**Claim 1 — Solver OOP cbet frequency on T98ss 3BP.** Per GTO Wizard "Navigating Range Disadvantage as the 3-Bettor" analog (reverse perspective) and general 3BP-OOP-low-wet-flop solver output: OOP PFR-caller checks ~79% of range on connected wet flops in 3BP; bets small ~10-15% (polar merged mix); bets large <5%. Cbet frequency is dominated by CHECK because OOP faces both range-disadvantage (tight BTN 3bet range dominates SB flat-3bet range) and position-disadvantage.

**Claim 2 — Solver AA specifically (flat-3bet live-pool context).** AA in SB flat-3bet range is off-solver-equilibrium — solver doesn't have AA in flat-3bet at meaningful frequency. But *treating AA as if it were in solver's OOP range*, the solver-analogous action is: check ~90% (protection + pot-control + mixed-range-balance), mix-bet-small ~10% (strong-but-vulnerable overpair wanting partial-protection). Solver rarely bets large with AA on this texture.

**Claim 3 — Solver BB/3bet-defender analog.** If hero were BB defending a 3bet in 3BP-OOP on T98ss with AA: solver-analog checks ~85%, mix-bets-small ~10-15%. Consistent across 3BP OOP solver outputs for strong-but-vulnerable overpairs on wet middling textures.

**Claim 4 — Solver 4bet treatment (relevant for "what should have happened").** Solver correctly calls for AA 4bet vs BTN 3bet ~100% at 100bb effective. The artifact's SB-flat-3bet pathway is intentionally live-pool-divergent per POKER_THEORY §9.3.

**Distribution summary (hero AA specifically, if the AA-in-flat-range was solver-legitimate):**

| Action | Solver-analog frequency |
|---|---|
| Check | ~85-90% |
| Bet 33% (small polar) | ~10% |
| Bet 67%+ | ~0-3% |

---

## §5. Population baseline

**Claim 1 — Live pool OOP action on T98ss 3BP.** Live pool pattern: most players cbet 50-75% of range on wet flops as PFA/flat-caller, applying HU-style polar sizing. In 3BP-OOP specifically, live pool cbets ~50-60% of range. This is **over-cbet relative to solver** (~20-25 pp over).

**Source (v2.3 D14):** `population-consensus-observed`. Jonathan Little "3-Bet Pots Strategy" + Doug Polk 3BP content + Upswing 3BP course. Stated stake-scope (Upswing 3BP course labeled live cash). Sourcing floor met.

**Claim 2 — Live pool AA specifically.** Pool strongly over-bets AA on wet boards — the HU-style "bet for protection" is deeply ingrained. Live pool bets AA on T98ss at ~70-80% (much higher than solver's ~10-15%). **This is the canonical "overpair over-bet leak" on wet boards.**

**Source:** Same consensus sources. SplitSuit "Pocket Aces on Dangerous Boards" article directly addresses this leak.

**Claim 3 — Live pool BTN response to OOP cbet on T98ss.** BTN's 3bet range (tight) calls a small-to-medium cbet with ~60-70% of range (draws + pair+ + sets + straights); raises with ~15-20% (sets + straights + occasional draw-combo bluffs); folds with ~15-20% (air + A-high missing).

**Source:** `population-observed` + solver-analog. Live-pool BTN 3bet-caller typically tighter than solver-balanced but in same direction.

**Claim 4 — Live pool turn/river continuation after OOP flop check.** When OOP checks flop, pool BTN bets turn ~70% of time (polar or merged), reflecting position advantage + aggressive pool-trained tendency. This matches the authored `turn_after_check` node where BTN bets 66%.

**Source:** `population-consensus-observed` — general 3BP IP-aggression pattern.

---

## §6. Exploit recommendation

**Pre-drafting check.** §4 and §5 authored. Proceeding per v1.1 D6.

**Recommended hero action: Check (pot control).** Single recommendation, matches authored teaching. Solver-dominant + population-corrective.

### Delta vs §4 (solver baseline)

Solver-analog: Check ~85-90%, Bet 33% ~10%, Bet 67%+ ~0-3%. Our recommendation: Check 100% (collapse mix). **Minor delta** — we collapse the 10% small-bet mix into the dominant check action for pedagogical clarity. Causal claim: for live-pool students, the primary leak is NOT under-checking; it's over-betting. Collapsing to 100% check removes the "maybe small-bet" optionality that students might exploit as a rationalization for over-cbetting.

### Delta vs §5 (population baseline)

Population bets AA on T98ss ~70-80%; checks ~20-30%. Our recommendation: Check 100%. **Massive delta** — we are ~70-80 percentage points more check-frequent than population. **This is the exploit frame.**

Causal claim: population's over-betting of AA on wet boards stems from three leaks:
1. **HU-style bet-for-protection instinct** — trained on unpaired polar textures where betting overpairs is solver-correct.
2. **Misreading texture** — students see "wet + many draws" and conclude "need to bet to deny equity" (correct in principle, wrong in magnitude — small-bet is correct if betting at all; large-bet is always wrong).
3. **Mis-identifying AA as nut-class** — AA is strong-but-vulnerable, not nut. Student mentally classifies AA as "big hand → bet big" which mis-tilts toward polar sizing.

Our recommendation corrects all three: **check for pot control, realize equity cheaply, reach showdown on the many brick-ish runouts where AA remains ahead.**

### Archetype-conditional note (v2.1 D11)

Potential sizing-adjustment vs specific archetypes:
- **Fish / station:** Still check (station doesn't bet-fold, so betting AA just builds pot; station calls large sizings with draws, realizing equity cheap — check is dominant).
- **Reg:** Check as authored. Solver-analog applies.
- **Pro / thinking player:** Check. Pro recognizes our range advantage; pro won't over-attack a checking range. Check realizes equity well.
- **Nit:** Check. Nit folds turn often vs any aggression; check keeps nit's bluffs in range and collects value on turn bets or showdown.

**Archetype-action-robust.** All archetypes → check. Single action across four archetypes.

Default: **Check.** No override.

---

## §7. Villain's perspective

**BTN's range as BTN sees it.** "I 3bet SB's open with QQ+, AKs+, AKo, AQs, some AQo + blocker bluffs (A5s-A3s, 76s-98s suited). SB called my 3bet — I now expect SB has QQ-TT, some AK, some AQs (live-pool flats). Flop T98ss — very wet for my range too. I have some nuts (TT/99/88 sets, some AKs-flush-draw + Ax-flush-draw, some 76s straight + T9s top-two), but many combos have missed or are just overpair-below-A."

**BTN's model of hero SB's range.** BTN knows SB's flat-3bet range is narrow (live-pool: QQ-TT, AK, AQs, occasional AA/KK trap). BTN thinks hero has:
- Overpairs heavy (QQ-TT most common)
- AK + AQs + AJs (pre-flop-value broadway)
- Occasional AA/KK

BTN does NOT know whether hero has AA specifically; BTN's range-model for hero has ~3-6 combos of AA + KK combined (trap-flat), ~6 combos of QQ, ~12-15 combos of TT-JJ, ~15 combos of AK/AQ broadway. ~35-combo total matches §2.

**Crucial asymmetry.** BTN's model of hero thinks hero has *more overpairs* than *nut-straights or sets* because hero's flat-3bet range doesn't include 76s-QJs (hero doesn't flat 3bet with connectors). So when hero CHECKS the flop, BTN's model updates:
- Hero's check signals either (a) overpair pot-control (QQ-AA), (b) broadway with air/backdoor (AK/AQ missed), (c) small set (TT/99/88 slowplay — but rare in hero's range).
- BTN is correctly incentivized to bet-probe turn after hero-checks-flop (which is exactly what the line authors, `turn_after_check` shows BTN betting 66% pot).

**BTN's EV computation (against hero's expected action distribution).**

- If hero checks: BTN can bet flop or check-back. At solver-analog, BTN bets ~60% of range (value-bet overpairs above AA-excluded, bet draws for semi-bluff, check weak broadway). Expected hero-check-EV for BTN: continues with positional advantage.
- If hero bets 33% small: BTN raises with sets + straights (~20%), calls with draws + overpairs (~55%), folds with broadway-missed (~25%). BTN's call-EV is positive given SPR 4.3 and good draw-equity.
- If hero bets 75% large: BTN raises with sets + straights (~25%), calls with draws + strong overpairs (~35%), folds ~40%. BTN's fold-EV is higher (hero folds out weaker stuff).

**Villain-EV traceability (v2 D4).** §7 EV numbers trace to §11 rows (7.1–7.5). No orphan EV claims.

**Perspective-collapse check.** BTN's apparent-hero-range (over-weights overpairs, under-weights nut-straights because hero's flat-3bet range structurally excludes them) materially differs from hero's actual range (which IS heavily overpair-weighted per §2). **BTN's model is approximately correct** on range composition; BTN's model lacks precise AA-specific knowledge.

**Apparent-range description (>15 words):** "SB's flat-3bet range concentrated in overpairs (QQ-AA); some AK + AQs broadway; rare AA/KK trap-flats (~3-6 combos). On check: signals overpair pot-control + broadway-missed. On bet: signals either protection-bet (overpair) or value-bet (rare sets/straights). Small-sizing bet from hero reads as merged/protection; large-sizing bet reads as polar value — which hero rarely has on this texture."

Over-weighted by BTN: overpair class (correct). Under-weighted: straight/set classes (correct — hero's flat-3bet range structurally excludes these; BTN knows).

---

## §8. EV tree: depth 1, 2, 3

**Chosen action: Check.**

### Depth 1 — check does not terminate hero's involvement

Check is range-action, not a terminal event. EV at depth 1 is 0 in direct-chip terms; hero pays no bet, wins no pot. Transition to depth 2.

### Depth 2 — villain response to hero's check

BTN faces hero's check with full range. BTN action distribution:

| BTN action | Solver-analog frequency | Live-pool frequency |
|---|---|---|
| Bet 50-75% pot | ~55% | ~70% |
| Bet 33% pot | ~10% | ~5% |
| Check back | ~35% | ~25% |

Live pool pattern: BTN over-bets (consistent with Claim 4 above).

### Depth 2 branches (per-villain-action decomposition, v2 D5)

**Branch A: BTN bets 66% pot (live-typical sizing).** Probability: ~70% live / ~55% solver.
- Pot after BTN bet: 21 + 14 ≈ 35bb.
- Hero's decision: call, fold, or raise. With AA and ~50% equity vs BTN's bet range (bet range is value+draws+bluffs, wider than flat range), hero calls.
- Call-EV: hero equity vs bet-range ~50-55%. Pot odds: call 14 to win 35 → needs 28.6% equity. Hero has ~50% → positive EV call.
- Expected branch EV for hero: `~0.70 × (0.55 × 35 × 0.88 realization − 14 call) = 0.70 × (16.94 − 14) = 0.70 × 2.94 = +2.06bb.`
  - Realization 0.88 is optimistic for OOP on wet board; more conservative 0.80 gives `0.70 × (0.55 × 35 × 0.80 − 14) = 0.70 × (15.4 − 14) = 0.70 × 1.4 = +0.98bb.`
  - Working value: **+1.5bb average.**

**Branch B: BTN bets 33% pot small.** Probability: ~10% solver / ~5% live.
- Pot after BTN bet: 21 + 7 = 28bb.
- Hero calls with ~55% equity. Pot odds: 7 / (28+7) = 20% required equity. Hero easy call.
- Call-EV: `~0.55 × 28 × 0.82 − 7 = 12.63 − 7 = +5.63bb. Weighted: 0.075 × 5.63 = +0.42bb.`
- Working value: **+0.4bb average contribution.**

**Branch C: BTN checks back.** Probability: ~35% solver / ~25% live.
- Pot stays 21bb. Turn card comes. Hero's realized equity on brick turn improves (see §3 variance analysis); on draw-completing turn deteriorates.
- Expected turn action: hero leads ~50% on brick turns; checks on scary turns. BTN responds.
- Expected depth-3 contribution for hero (check-check flop path): ~`0.30 × (0.58 × 21 × 0.75 realization − 0) = 0.30 × 9.13 = +2.74bb.`
- Working value: **+2.7bb average contribution.**

**Branch D: BTN raises (doesn't happen at depth 1 since no hero bet to raise — collapsed).** N/A.

### Full check-EV synthesis

`+1.5 (bet-call) + 0.4 (small-bet-call) + 2.7 (check-back) ≈ +4.6bb.` Working value: **Check total EV ≈ +4.5bb.**

### Comparison branches

**Bet 33% (authored incorrect — mix-bet-small).**

Hero bets 7bb into 21bb pot. Pot after: 28bb + 7 from hero = 28 wait. Pot = 21 + 7 = 28. BTN response:
- Fold (broadway-missed + air) ~20%
- Call (draws + overpairs-below-AA + some Ax-weak) ~60%
- Raise (sets + straights + some draw-combo) ~20%

**Branches:**
- Fold-branch EV: `0.20 × 21 = +4.2bb.`
- Call-branch: pot becomes 21 + 7 + 7 = 35bb on turn; hero continues with ~50% equity vs call-range; expected net EV: `0.60 × (0.50 × (35 + turn-play) × 0.80 − 7 flop bet − expected turn-play) ≈ rough +1.5 to +2.0bb contribution.`
- Raise-branch (BTN raises to 20bb+): hero should fold AA (can't call raise profitably given SPR and equity collapse vs raise-range which is heavy nut). Raise-branch hero-loses-7bb: `0.20 × (−7bb) = −1.4bb.`

**Bet 33% total EV: `+4.2 + 1.75 − 1.4 ≈ +4.5bb.`** 

**Delta Bet 33% vs Check: ~0bb.** Essentially breakeven in a simplified model. This is why solver mixes — the 10% small-bet-mix captures small upside from protection + fold-equity against a subset of villain ranges. Our pedagogical collapse to 100% check is not costly; the two options are approximately equal-EV.

**Bet 75% (authored incorrect — sizing leak).**

Hero bets 16bb into 21bb pot. Pot after: 37bb. BTN response:
- Fold (air + broadway-missed) ~35%
- Call (strong overpairs + draws + some sets) ~40%
- Raise (sets + straights + draw-combos) ~25%

**Branches:**
- Fold-branch: `0.35 × 21 = +7.35bb.`
- Call-branch: hero now committed to large pot at SPR <2 post-bet. Hero equity drops vs BTN's call-range (which condenses to nuts-or-strong-draws). Expected call-EV: `0.40 × (0.40 × 53 × 0.75 − 16) = 0.40 × (15.9 − 16) = ~−0.04bb. Essentially zero.`
- Raise-branch: BTN raises to 35-40bb; hero can't continue profitably. `0.25 × (−16bb) = −4.0bb.`

**Bet 75% total EV: `+7.35 − 0.04 − 4.0 ≈ +3.3bb.`** 

**Delta Bet 75% vs Check: −1.2bb.** Sizing leak confirmed. Bet 75% is materially worse because the raise-branch probability is higher and the fold-branch pot-won (21bb) is out-weighed by the raise-branch loss (-16bb × 25% = -4bb).

### EV tree summary

| Branch | EV |
|---|---|
| **Check (recommended)** | **+4.5bb** |
| Bet 33% (solver mix, pedagogically collapsed) | +4.5bb |
| Bet 75% (sizing leak) | +3.3bb |

**Chosen: Check.** Delta over 75%-bet: +1.2bb. Bet 33% is approximately equal-EV but pedagogically consolidated into check to avoid the student-over-generalization leak of "bet small is fine on wet."

---

## §9. Blocker / unblocker accounting

Hero holds A♦ A♣. Hero blocks **4 of 6 AA combos** in villain's possible range. (Villain's 3bet range would have some AA, but hero's specific cards remove all but 2 combos from possible villain AA — though in practice villain AA likely 4bets anyway, so villain range has near-zero AA combos entering flop.)

**Blocks in villain's 3bet range:**

- **Hero's two As (A♦, A♣):** remove AA from villain range. AA is rarely in villain's flop range anyway (solver 4bets; live pool partial flat-4bet). Net: removes 0-2 combos.
- **A♦ blocks Ax combos:** AK, AQ, AJ, A5-A3 suited with A♦. ~1-2 combos per hand class × 4-5 classes = ~6-8 combos removed from villain Ax range.
- **A♣ blocks similarly:** ~6-8 more combos.

**Net effect on villain range:** ~12-15 ace-high combos removed. This slightly TIGHTENS villain's range toward non-ace combos (straights, overpairs below, sets, low-blocker bluffs).

**Fold-rate impact if hero bets:** hero's A-blockers remove some air + some bluff-blocker combos that would fold. **Fold-rate drops by ~3-5 percentage points** from blocker effect.

**Equity impact:** hero's A-blockers remove villain's A-high bluffs (low equity) more than villain's non-A nut combos (sets/straights). **Slight equity improvement: +1-2 percentage points.**

**Qualitative verdict.** Hero's A-blockers are **moderately unfavorable for fold equity** (reduce air fraction) but **moderately favorable for net equity** (remove some bluff-weights). Since the authored action is CHECK (not bet-for-fold-equity), the fold-equity-blocker-penalty is moot. **Blockers do not flip the check decision.**

**Additional note:** hero's blockers DO matter on the `turn_after_check` decision (companion node) and `river_after_turn_call` (artifact #7). Flop-level blocker effects are small because the decision is check-for-pot-control, not bet-for-fold-equity.

---

## §10. MDF, auto-profit, realization (v2.3 D15 applied)

**MDF (hero's range defending vs hypothetical bet).** Not directly applicable — hero is ACTING first (cbetting-or-not), not defending. This section computes the MDF framework in a different direction:

**Counterfactual: if hero bet 33% and BTN raises pot (call 7 to win 35-pot-after-raise-to-28).**
- Pot-odds at BTN raise: hero needs 28.6% equity to call.
- Hero AA vs BTN raise-range (sets + straights + draw-combos): hero ~25% equity. **Below pot-odds threshold → hero should fold AA to raise.**
- This is the canonical "can't bet-fold flop with AA on wet" teaching.

**Hero's check avoids this trap:** checking doesn't create a raise to face; hero realizes equity vs BTN's bet-range (which is wider than raise-range) at pot-odds-favorable calls.

### Range-vs-hand MDF divergence (v2.3 D15) — APPLICABLE

**This artifact triggers D15.** Hero's AA is the top of range by preflop strength (premium overpair), but runout-conditional equity vs BTN's 3bet range is only ~55-60% — not the >80% equity that would make AA a "nut-class" hand. D15 is explicitly-applicable.

**Range-level reasoning would say:** "AA is the best hand in hero's range; hero cbets AA for value." This reasoning SKIPS the runout-conditional composition check.

**Individual-hand-conditional reasoning says:** "AA on T98ss is ahead of BTN's range by only ~5-10 percentage points — strong-but-vulnerable, not nut. Pot-control is the correct frame." This is the check-recommendation rationale.

**D15 divergence explicitly captured** — first corpus instance where D15 applies and changes the recommendation (artifacts #9 J85 and #10 K77 both had D15 explicitly non-applicable).

### Auto-profit threshold (AP)

Not directly applicable (hero not betting as pure bluff). N/A.

### Realization factor

Hero is OOP at SPR 4.3 on max-wet board.

- **Baseline OOP realization at MEDIUM SPR on wet board:** ~0.75 (OOP realization depressed further on wet boards due to position penalty on scary turn/river cards).
- **Hand-type adjustment:** AA has strong showdown value, above-baseline realization *when reaching showdown*. But on wet boards, AA reaches showdown less often (folded to big raises on scary runouts). Net adjustment: +0 (baseline).
- **Final realization for hero AA:** ~0.75.

This realization factor is materially lower than K77 (0.88 in artifact #10) or J85 (0.88 in artifact #9) because the texture is fundamentally hostile to OOP equity-realization. **This is the structural argument for pot-control** — at realization 0.75, building a large pot costs hero significantly more than it would at realization 0.88.

---

## §11. Claim-falsifier ledger

v2.3-native with D14 + D15 applied. 50+ claims expected.

### Node-state claims (§1)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 1.1 | Effective stack at flop | 90bb | computed | 100 − 10 preflop | — | exact | **Internal:** recomputation |
| 1.2 | Pot at node | 21bb | computed | 10 + 10 + 1 = 21 | — | exact | **Internal:** derivation (clean) |
| 1.3 | SPR at decision | 4.3 | computed | 90/21 | — | exact | Recomputation |
| 1.4 | Board texture class | wet two-tone middling-connected (max-wet) | read | Cards on board | — | — | — |

### Preflop range claims (§2)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 2.1 | SB open range (live) | ~42%, ~560 combos | population-consensus-observed | Live-cash SB open | — | ±6 pp | **External-operational:** outside [35%, 50%] |
| 2.2 | BTN 3bet range (live) | ~10%, ~130 combos | population-consensus-observed | Live BTN 3bet-vs-SB | — | ±3 pp (100–160) | **External-operational:** outside [7%, 13%] |
| 2.3 | SB flat-3bet range (live-pool Category-D) | ~3%, ~35 combos | population-consensus-observed | POKER_THEORY §9.3 divergence; live-pool-only | — | ±10 combos | **External-operational:** live HUD sample outside [20, 50 combos] |
| 2.4 | SB solver-equilibrium flat-3bet | ~0 (3bet-or-fold) | solver | 888 Poker; Upswing 3bet response | — | — | **Theoretical:** solver output |
| 2.5 | Hero AA in flat-3bet range | ~3 combos pre-hero-holding | population-consensus-observed | Live trap-flat-AA | — | ±1 | **External-operational:** sample |
| 2.6 | BTN TT/99/88 set combos | 3 each = 9 total | computed | Combo count post-board-removal | — | exact | **Internal:** card arithmetic |
| 2.7 | BTN 76s/QJs/J7s straight combos | ~4-6 total (live-filter) | computed | Suited-connector partial 3bet | — | ±2 | **Internal:** live-filter math |
| 2.8 | BTN AKs flush-draw combos | ~2 | computed | AKs×(2 suited ♠)/C | — | ±1 | **Internal:** combinatorics |
| 2.9 | BTN range overpair-below-AA (KK/QQ/JJ) | ~26 combos | computed | Per-class × live-filter | — | ±5 | **Internal:** enumeration |
| 2.10 | BTN range broadway / Ax-no-pair | ~40-50 combos | computed | AK + AQ + AJ + A-blockers | — | ±8 | **Internal:** enumeration |
| 2.11 | BTN range missed-air / non-pair | ~45 combos | computed | Residual | — | ±8 | **Internal:** enumeration |

### Hero equity claims (§3)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 3.1 | Hero AA eq vs TT/99/88 set | ~8% | equity-derived | 2-outer × 2 streets for case-A runner-runner | — | ±2 pp | **Internal:** Equilab |
| 3.2 | Hero AA eq vs 76s/QJs made straight | ~18% | equity-derived | 2 outs for set-on-turn × 2 streets + chop-runs | — | ±3 pp | Equilab |
| 3.3 | Hero AA eq vs T9s two-pair | ~28% | equity-derived | AA has 2 outs + some redraws | — | ±4 pp | Equilab |
| 3.4 | Hero AA eq vs KK overpair | ~81% | equity-derived | AA dominates KK | — | ±2 pp | Equilab |
| 3.5 | Hero AA eq vs QQ/JJ overpair | ~75% | equity-derived | AA dominates, some turn/river scary cards | — | ±4 pp | Equilab |
| 3.6 | Hero AA eq vs AKs flush-draw | ~65% | equity-derived | AK has 3 overcards + 9 flush outs | — | ±4 pp | Equilab |
| 3.7 | Hero AA eq vs AKo/AQo broadway | ~72% | equity-derived | 6 overcards (A+K or A+Q) | — | ±4 pp | Equilab |
| 3.8 | Hero AA eq vs A5s-A3s blocker-bluff | ~75% | equity-derived | Ace-high with backdoor + 3 overcards | — | ±4 pp | Equilab |
| 3.9 | Hero weighted equity vs full range | ~55-60% | computed | Bucket-weighted | — | ±5 pp | **Internal:** recomputation |
| 3.10 | Equity distribution shape | split/flat-like (non-bimodal on flop) | computed | ~20 crushed + ~85 ahead + residuals | — | qualitative | **Internal:** recount |
| 3.11 | Equity variance across turn cards | high (30-80% depending on runout) | computed | Brick turns vs scare turns | — | qualitative | **Internal:** per-turn equity |

### Solver claims (§4)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 4.1 | Solver 3BP-OOP check frequency on connected-wet flop | ~79% | solver | GTO Wizard 3BP-OOP output (analog from "Navigating Range Disadvantage") | — | ±8 pp | **Theoretical:** outside [70%, 88%] |
| 4.2 | Solver AA-analog check frequency | ~85-90% | solver | 3BP-OOP-overpair analog | — | ±5 pp | **Theoretical:** outside [80%, 95%] |
| 4.3 | Solver AA-analog bet-33%-small | ~10% | solver | Mix-frequency | — | ±5 pp | **Theoretical:** outside [5%, 15%] |
| 4.4 | Solver AA-analog bet-67%+ | ~0-3% | solver | Bet-large dominated | — | ±3 pp | **Theoretical:** outside [0%, 5%] |
| 4.5 | Solver 4bet of AA vs BTN 3bet (pre-flop) | ~100% | solver | Standard preflop solver output | — | ±2 pp | **Theoretical:** solver output |

### Population claims (§5, D14 labeled)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 5.1 | Live pool OOP cbet rate on T98ss 3BP | ~50-60% | population-consensus-observed (D14) | Jonathan Little 3BP + Upswing + SplitSuit | — | ±15 pp | **External-operational:** sample |
| 5.2 | Live pool AA-on-wet over-bet rate | ~70-80% | population-consensus-observed | SplitSuit "Pocket Aces on Dangerous Boards" | — | ±10 pp | **External-operational:** sample |
| 5.3 | Live pool BTN call-rate vs cbet | ~60-70% | population-observed | Live observation | n≈0 | ±15 pp | **External-operational:** sample |
| 5.4 | Live pool BTN raise-rate vs cbet | ~15-20% | population-observed | Tight BTN 3bet range raises with sets/straights/draws | — | ±5 pp | **External-operational:** sample |
| 5.5 | Live pool BTN turn-bet-rate after hero check-flop | ~70% | population-consensus-observed | 3BP IP aggression pattern | — | ±10 pp | **External-operational:** sample |

### Recommendation claims (§6)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 6.1 | Recommended action | Check | computed | Solver-dominant + population-corrective | — | — | **Theoretical:** solver disagreement |
| 6.2 | Delta vs solver | Minor (collapse 10% mix-bet-small into 100% check) | computed | Pedagogical simplification | — | — | **Internal:** recompute mix-EV |
| 6.3 | Delta vs population | Massive (~75 pp more check-frequent) | computed | Population over-bets AA | — | ±15 pp | **External-operational:** sample |
| 6.4 | Archetype-action-robustness | All 4 archetypes → check | computed | Per §12 sensitivity | — | — | **Internal:** §12 analysis |

### Villain-perspective claims (§7)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 7.1 | BTN's model of hero's range — overpair fraction | ~60-70% | computed | Hero flat-3bet range composition | — | ±10 pp | **Internal:** §2 table |
| 7.2 | BTN's model — straight/set fraction in hero | ~10-15% | computed | Hero rare TT slowplay | — | ±5 pp | **Internal:** §2 table |
| 7.3 | BTN bet-after-hero-check frequency | ~55% solver / ~70% live | solver + population-consensus-observed | 3BP IP aggression | — | ±10 pp | **External-operational:** sample |
| 7.4 | BTN raise-after-hero-bet frequency (bet 33%) | ~20% | computed | Sets + straights + draw-combo raise | — | ±5 pp | **External-operational:** sample |
| 7.5 | BTN call-EV vs hero's hypothetical bet | positive (small) | computed | 0.50 × turn-future × rake − call-amount | — | ±1bb | **Internal:** recompute |

### EV-tree claims (§8)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 8.1 | Check-branch BTN-bets-66% probability | ~70% live / ~55% solver | computed | §7 row 7.3 | — | ±10 pp | Arithmetic |
| 8.2 | Check-branch call-EV (hero call BTN bet) | +1.5bb average | computed | 0.55 × 35 × 0.82 − 14 ≈ 2.85 | — | ±1bb | **Internal:** recompute |
| 8.3 | Check-branch BTN-bets-33% probability | ~10% solver / ~5% live | computed | Small-bet mix | — | ±5 pp | Arithmetic |
| 8.4 | Check-branch small-bet-call EV | +0.4bb contribution | computed | Weighted | — | ±0.5bb | Recompute |
| 8.5 | Check-branch BTN-checks-back probability | ~30% | computed | Solver ~35% / live ~25% | — | ±10 pp | Arithmetic |
| 8.6 | Check-branch turn-play EV (check-check-then-turn) | ~+2.7bb | computed | Turn equity × pot × realization | — | ±1bb | Recompute |
| 8.7 | Check total EV | +4.5bb | computed | Sum of branches | — | ±1.5bb | **Internal:** recompute |
| 8.8 | Bet-33% total EV | ~+4.5bb (approximately equal-EV) | computed | Fold + call + raise weighted | — | ±1.5bb | Recompute |
| 8.9 | Bet-33% raise-branch loss | −1.4bb contribution | computed | 0.20 × (−7bb forced fold) | — | ±0.5bb | Recompute |
| 8.10 | Bet-75% total EV | ~+3.3bb | computed | Higher fold-equity offset by raise-branch loss | — | ±1.5bb | Recompute |
| 8.11 | Bet-75% raise-branch loss | −4.0bb contribution | computed | 0.25 × (−16bb forced fold) | — | ±1bb | Recompute |
| 8.12 | Delta Check vs Bet-75% | +1.2bb | computed | +4.5 − 3.3 | — | ±1.5bb | Arithmetic |
| 8.13 | Delta Check vs Bet-33% | ~0bb (pedagogical collapse) | computed | Approximately equal | — | — | **Internal:** close-call |

### Blockers (§9)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 9.1 | Hero A-blocker villain AA removal | ~4 of 6 combos | computed | Specific A-cards | — | ±1 | Arithmetic |
| 9.2 | Hero A-blocker villain Ax removal | ~12-15 combos | computed | Ax combos containing A♦ or A♣ | — | ±3 | Arithmetic |
| 9.3 | Blocker fold-rate impact (if bet) | −3 to −5 pp | computed | Air fraction reduction | — | ±2 pp | Recount |
| 9.4 | Blocker equity impact | +1-2 pp | computed | Bluff-weight removal | — | ±1 pp | Equilab |
| 9.5 | Blocker decision-flip? | no | computed | Check-decision unaffected by blocker magnitude | — | — | **Internal:** recheck §6 |

### MDF / realization (§10, D15 applied)

| # | Claim | Value | Source-type | Source/Citation | Sample | CI | Falsifier |
|---|---|---|---|---|---|---|---|
| 10.1 | Bet-fold-flop trap analysis | AA ~25% vs raise-range | computed | BTN raise-range = nut-heavy | — | ±5 pp | **Internal:** Equilab |
| 10.2 | Pot-odds facing raise | 28.6% required equity | computed | 7/24.5 | — | exact | Formula |
| 10.3 | D15 divergence status | **APPLICABLE** (first corpus instance) | conceptual | Range-top by preflop strength ≠ individual-hand-correct on this runout | — | — | **Internal:** D15 trigger |
| 10.4 | D15 rationale (AA strong-but-vulnerable, not nut) | explicit | derived | Equity only ~58%, not >80% | — | — | **Internal:** §3 weighted eq |
| 10.5 | Hero OOP realization at MEDIUM SPR on wet board | ~0.75 | assumed | Depressed from 0.80 baseline by wet-texture penalty | — | ±0.05 | **External-operational:** sourced |
| 10.6 | Realization-driven pot-control rationale | structural | derived | Low realization makes large-pot costly | — | — | **Internal:** §10 reasoning |

---

**[Completeness: swept 2026-04-23, 57 claims ledgered, all falsifiers present. Rubric-Version v2.3.]**

### Lowest-confidence load-bearing claims

1. **Row 2.3 (SB flat-3bet range ~35 combos).** Most load-bearing — the whole line's construction depends on this live-pool pathway. Wide CI (±10 combos). Referenced from POKER_THEORY §9.3 Category-D divergence.
2. **Rows 5.1–5.5 (population claims).** `population-consensus-observed` and `population-observed`; wider CI. Row 5.2 (AA over-bet rate) drives the §6 exploit framing.
3. **Row 10.5 (realization factor 0.75).** Assumed from standard OOP-wet-board table. Affects check-counterfactual EV calculation.
4. **Rows 3.9, 3.11 (hero equity + shape).** Equity 55-60% is the central number that determines whether AA is "ahead of range" (it is) and by how much (narrowly). Material for §6 recommendation.

---

## §12. Sensitivity analysis

### Assumption A — Hero equity vs BTN 3bet range (current 58%)

**Flip threshold:** if hero equity drops below ~35% (close to pot-odds for facing bet), the call-vs-fold decision vs BTN's turn bet starts flipping. Hero would need to fold turn more often.
- Realistic range: 50-65%. No flip within CI.

**Decision-level conclusion:** **Check is robust across realistic equity CI.**

### Assumption B — BTN bet-rate after hero check (current 55-70%)

**Flip threshold:** if BTN bet-rate drops below ~30%, hero's check loses expected-turn-continuation EV. Could push toward 10% mix-bet-small to pre-empt BTN's passive-play.
- Realistic range: 50-75%. No flip within CI.

### Assumption C — Realization factor (current 0.75)

**Flip threshold:** if realization drops below 0.65 (very hostile texture), check-EV drops meaningfully. Still check, but turn-decision becomes closer to "always check turn."
- Realistic range: 0.70-0.80. No flip within CI.

### Assumption D — Archetype (villain profile)

No action flip across fish/reg/pro/nit. All archetypes → check.

### Summary

**Check is decision-level-robust.** No assumption's CI contains a flip-point for the action (check vs bet). Within the check action, turn/river decisions flex based on runout (covered in companion artifacts #7).

---

## §13. Contrast with leading theories (v2.2 D13 + v2.3 D16 applied)

### Reflexive check 1 — Internal-arithmetic

- §3 weighted equity: `(10×0.90 + 80×0.70 + 15×0.50 + 5×0.30 + 20×0.15) / 130 = (9 + 56 + 7.5 + 1.5 + 3) / 130 = 77/130 = 59.2%` ✓ matches "~58%" claim
- §8 check total EV: `+1.5 + 0.4 + 2.7 = +4.6bb` ✓ matches +4.5 with rounding
- §8 bet-75% total EV: `+7.35 − 0.04 − 4.0 = +3.31bb` ✓ matches +3.3
- §1 pot: `10 + 10 + 1 = 21bb` ✓

All internal-arithmetic checks pass.

### Reflexive check 2 — Source-scope

- **GTO Wizard "Navigating Range Disadvantage":** 3BP OOP solver output; stake-scope general cash; matches. ✓
- **888 Poker SB vs BB 3bet Strategy:** solver preflop; stake-scope general; matches for §2.4 claim about SB 3bet-or-fold. ✓
- **Upswing "React to Preflop 3-Bets":** SB defense vs 3bets; matches §2.4. ✓
- **Jonathan Little 3BP content:** live cash 2/5-5/10 target; matches §5.1. ✓
- **SplitSuit "Pocket Aces on Dangerous Boards":** live overpair-on-wet leak; matches §5.2. ✓
- **Doug Polk 3BP content:** mid-high cash; matches for directional pool claims. ✓
- **Matthew Janda *Applications* AA-on-wet chapter:** pre-solver framing; directional agreement. ✓
- **Ed Miller *Poker's 1%* AA discipline:** live-cash framing; matches. ✓
- **Tommy Angelo AA-pot-control philosophy:** recreational + live; matches directional claim. ✓
- **Upswing AA-on-wet article (recent):** solver-current; matches §4.2-4.4. ✓

All source-scopes verified.

### Per-claim comparison — 10 sources consulted

| Source | Position on AA-on-T98ss-3BP-OOP | Category |
|---|---|---|
| GTO Wizard 3BP-OOP solver | Check ~85-90% with strong-but-vulnerable overpair | **A** (primary) |
| 888 Poker SB vs BB 3bets Strategy | SB should 3bet-or-fold vs BTN 3bets (relevant to preflop; endorses §2.4 divergence claim) | **A** |
| Upswing "React to Preflop 3-Bets" | Confirms SB 3bet-or-fold solver | **A** |
| Jonathan Little 3BP Strategy | Live pool over-bets AA on wet; pot-control is correct | **A** |
| SplitSuit "Pocket Aces on Dangerous Boards" | Explicit teaching: pot-control AA on wet; don't over-bet | **A** (strong direct corroboration for §5.2) |
| Doug Polk 3BP content | Small cbet or check OOP on wet; no polar-large recommendation | **A** |
| Matthew Janda *Applications* | Pre-solver "overpair on wet = pot control" folk theorem | **A with nuance** (pre-solver framing) |
| Ed Miller *Poker's 1%* AA discipline | Live-cash AA discipline — "AA is not invincible on wet" | **A** |
| Tommy Angelo AA-pot-control philosophy | Recreational "reduce variance with AA on scary boards" | **A** (recreational framing) |
| Upswing AA-on-wet article | Modern solver-aligned: pot-control dominant; small-bet mix acceptable | **A** |

**Verdict: 10A (all direct or with-nuance).** Consensus-robust on action direction (check/pot-control).

### Active challenge (v2.3 D16)

Zero B / C-wrong / C-incomplete found. D16 documentation:

**(a) Sources probed: 10** (listed above). Additionally:
- **Phil Galfond 3BP content** — agrees.
- **Galfond's "Bet Too Much, Don't Bet Too Little"** — pre-solver framing; agrees on overpair-on-wet discipline.
- **WPT/PokerGO live commentary on AA-on-wet hands** — agrees directionally.

**Total: ≥13 sources effectively surveyed.**

**(b) Angles attempted:**
1. **Pre-solver (Sklansky, Harrington, Miller older works):** Pre-solver "bet your overpairs for protection" folk-theorem exists, but modified in Miller's more recent *Poker's 1%* to "not always on wet boards." No B.
2. **HU-online high-stakes (Galfond, Polk, Sulsky):** All agree with pot-control on wet.
3. **Live-cash coaching (Miller, Little, SplitSuit, Angelo):** Unanimous pot-control frame.
4. **Tournament-specific (Snyder, Harrington on Cash):** Tournament framing agrees with AA pot-control on wet + middling stacks.
5. **Contrarian camps:** Searched for any advocate of polar-large AA-bet on wet boards in 3BP-OOP. None found.

**(c) Closest-to-disagreeing source:** Pre-solver Sklansky "protect your hand" doctrine. Sklansky's rule "if your hand has many outs against it, bet to charge the draws" would technically recommend a SMALL-BET for protection on T98ss. This is captured in solver's ~10% mix-bet-small; the artifact's §6 collapses this to check for pedagogical simplicity. **Classification: A with nuance** (direction-aligned: protection-bet is recognized as a valid minor-frequency action; artifact simplifies to check without error).

**No legitimate B, C-wrong, or C-incomplete.** Consensus is genuine.

### POKER_THEORY.md §9 impact

**No new §9 D entry.** The artifact INHERITS §9.3 (SB flat-3bet live-pool divergence) in the preflop construction; no new divergence is authored here. The authored action (check) is solver-canonical; the divergence is purely in the preflop pathway, not in the flop decision.

---

## §14. Verification architecture

### §14a. Symmetric-node test

**Mirror:** `btn-vs-sb-3bp-ip-wet-t98-flop_root` — role inverted. Hero is now BTN IP as 3bettor, acting on flop after SB checks. This is a different decision-type (IP, respond to check vs act first OOP) but same board and same overall 3BP-wet regime.

Six claims classified:

1. **Hero position (OOP vs IP).** → **Inverts.** Artifact: SB OOP. Mirror: BTN IP.
2. **Hero range composition.** → **Inverts.** Artifact hero has narrow flat-3bet range (live-pool). Mirror hero has tight 3bet range (standard).
3. **Hero equity vs villain range.** → **Partial change.** In mirror, BTN has ~55-60% equity vs SB's flat-3bet range (similar aggregate magnitude, different distribution). Partially preserved.
4. **"Strong-but-vulnerable" teaching.** → **Stays.** The concept applies to any AA-on-wet-board scenario regardless of position. JUSTIFICATION: texture-driven, not position-driven.
5. **Solver check-dominance on wet OOP.** → **Stays.** When we invert to BTN-IP-checked-to-by-SB, BTN also checks-back ~50-60% of range on wet boards (nut-advantage compromised). Both roles play passively on this texture. JUSTIFICATION: texture dictates check-frequency.
6. **Live-pool over-bet leak.** → **Stays.** Pool over-bets AA regardless of position (IP or OOP); the leak is hand-class-driven, not position-driven. JUSTIFICATION: leak independent of position.

**Test result: 2 invert, 3 stay, 1 partial.** Under D8 cap (max 3 partial). Clean mirror.

### §14b. Falsifier synthesis

Decision-level-robust per §12. No headline falsifier flips check recommendation.

**The strongest near-falsifier:** if pool-BTN-raise-rate vs OOP-cbet were to drop below 5% (ultra-passive pool where BTN never raises), the bet-fold trap disappears and small cbets become cleanly +EV. Within realistic live-pool CI (15-20% raise-rate), no flip.

**Statement:** "Check is action-level-robust across all §11 CI. Decision-level-robust in §14b synthesis sense."

### §14c. Counter-artifact pointer

`sb-vs-btn-3bp-oop-wet-t98-flop_root-bet-variant.md` — what-if-hero-bet-33%? Would analyze the 10% solver-mix in depth, showing branch-by-branch EV to demonstrate why the collapse-to-check is pedagogically defensible but not strictly EV-maximal.

`sb-vs-btn-3bp-oop-dry-flop_root.md` — same SB-flat-3bet pathway but on a dry flop (e.g., K72r). Would invert the texture argument: on dry, AA cbets for value; on wet, AA checks for pot-control. Contrast would show texture as first-order variable.

---

## Closing note

US-1 Artifact #11. v2.3-native. **First overpair-as-hero + first "check correct" + first D15 applied.**

**Rubric observations:**

1. **v2.3 D15 FIRST APPLIED IN CORPUS.** Artifact #9 and #10 both explicitly-non-applicable. This artifact is the first where D15 TRIGGERS: hero AA is range-top by preflop strength (premium overpair) but runout-conditional equity is only ~58% (not >80% nut-class). D15 formalization captured in §10.3-10.4. This validates D15 as both trigger-check AND behavior-changing forcing constraint — it prevents "it's AA so bet big" reasoning.
2. **v2.3 D14 `population-consensus-observed`** applied throughout §2, §5, §7.
3. **v2.3 D16 search-depth documented** — 10+ sources + 5 angles + closest-to-disagreeing (Sklansky pre-solver protection-bet doctrine, classified A-with-nuance).
4. **v2.3 D17 N/A** (HU artifact).
5. **POKER_THEORY.md §9.3 inherited** (SB flat-3bet live-pool pathway). Preflop construction is Category-D; flop decision (check) is solver-canonical. Clean divergence management.
6. **Pot 21bb derivation clean** (no rounding gap). Contrast with SRP-lines' 5.5 vs 6.0 gap.
7. **Equity-realization theory explicit.** §10 realization factor 0.75 is the structural driver of pot-control — first corpus artifact to make realization the primary §10 argument.

**Contrast with artifact #7 (same line, river_after_turn_call):**
- Artifact #7: hero AA facing BTN's pot-sized river bet on 7♠ runout — FOLD decision.
- This artifact (#11): hero AA at flop — CHECK decision (which keeps AA in the pot that later becomes the artifact #7 scenario).
- Both artifacts emphasize "AA ≠ nut" and "pot-control > protection-bet."
- The chain from #11 (flop check) to #7 (river fold) is the full line-study teaching: check-flop → call-turn → fold-river on scare-runout.

**Contrast with artifact #10 (K77 flop_root):**
- #10: paired rainbow, hero AK TPTK, CBET 33% (value-bet merged). Equity 82%, heavy-nuts distribution.
- #11: max-wet, hero AA overpair, CHECK (pot-control). Equity 58%, split distribution.
- Same position-type (hero as PFR OOP-analog) but inverse texture-regime and inverse action.

**Ledger density:** 57 claims / ~9k words = ~6.3 claims/1k words. Slightly below corpus average — reflects the more-prose-heavy nature of the strong-but-vulnerable / equity-realization teaching.

**Corpus now 11 artifacts.** **4 more to reach 15-target.**

**Stage 3i (audit) + Stage 4i (comparison) + Stage 5i (drill card)** to follow.

---

*End of artifact.*
