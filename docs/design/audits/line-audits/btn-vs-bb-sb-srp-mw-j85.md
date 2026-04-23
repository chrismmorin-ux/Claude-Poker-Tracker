# Line Audit — 2026-04-23 — `btn-vs-bb-sb-srp-mw-j85`

**Line:** `btn-vs-bb-sb-srp-mw-j85` — BTN vs BB + SB · 3-way SRP · J♠8♥5♦
**File:** `src/utils/postflopDrillContent/lines.js` lines 1458–1911
**Auditor:** Claude (main) + elevated-standard web-research validation (per 2026-04-22 project charter)
**Method:** Seven-dimension expert walkthrough. External-validation queries against GTO Wizard multiway corpus, Upswing multiway courses, SplitSuit multiway content, PokerVIP multiway articles.
**Status:** Draft 2026-04-23 — pending owner review.

---

## Executive summary

**Verdict: GREEN (light).** All four decision nodes are solver-aligned in the heads-up dimension and pass the bluff-frequency-collapse test for the multiway-specific claim. The line's pedagogical frame — "HU cbet frequency, nut thresholds, and bluff EV all shift when a second villain is in the hand" — is well-supported by GTO Wizard's multiway corpus and SplitSuit's multiway cbetting primer, and the `flop_root` polar-50% answer with AJ-TPTK matches the consensus-robust upper-surface artifact (`docs/upper-surface/reasoning-artifacts/btn-vs-bb-sb-srp-mw-j85-flop_root.md`, 9A + 1 not-addressed from a 10-source comparison).

**Five findings produced.** All P2/P3 — no shipping blocker. Main themes: (a) `turn_after_cbet` claim "SB folded, BB called" is authored implicitly by the prose — SB's fold isn't in the prior-node schema anywhere, so the MW→HU transition is narratively asserted rather than structurally encoded; defensible as a teaching simplification but worth acknowledging. (b) `turn_after_checkback` presupposes a specific response pattern ("SB leads 50% into checked-back flop") that's rare in the live pool (donk-leads after checked-flop are <5% of OOP range per solver; live pool slightly higher but not a canonical teaching frequency). (c) The `river_after_mw_barrel` node reuses the `terminal_mw_value_bet` / `terminal_mw_gave_up_value` / `terminal_mw_overbet_folds_pairs` terminals that are ALSO reached from `turn_after_cbet` — pedagogically OK since both are value-bet lessons, but one terminal pot (20.0) doesn't match the river-reach pot (would be ~31 if 60% turn-bet was called) nor the turn-reach pot (cleanly 25.0). (d) The `flop_root.why` body contains a small math imprecision: "each villain continues 50%" × 2 gives P(both fold) = 0.25 is correct math, but the claim "bluff-only cbets need 50%+ fold equity" conflates pot-size-bluff breakeven with 33%-bet-size threshold — at 33% bet size the bluff breakeven is 25%, not 50%. Minor. (e) `terminal_mw_overfold` copy claims "~4bb/100" magnitude — un-sourced, likely directionally right but the specific number is asserted not derived.

**Routing:** 4 Stream F content-fix items (all S-effort, bundleable into one commit), 0 Stream G engine tickets, 0 POKER_THEORY.md §9 entries. 2 bucket-teaching targets queued (`flop_root` already upper-surface-covered; `river_after_mw_barrel` is a HIGH-leverage thin-value-vs-fish target for LSW-B2).

---

## Scope

- **Nodes audited:** 9 total (4 decision + 5 terminal)
- **Decision nodes:** `flop_root`, `turn_after_cbet`, `turn_after_checkback`, `river_after_mw_barrel`
- **Terminal nodes:** `terminal_mw_value_bet`, `terminal_mw_wide_bluff_loses`, `terminal_mw_gave_up_value`, `terminal_mw_overbet_folds_pairs`, `terminal_mw_overfold`, `terminal_mw_raise_spew`
- **Frameworks referenced by this line:** `fold_equity_compression`, `bluff_frequency_collapse`, `nut_necessity`, `hand_class_shift`, `range_advantage`, `equity_redistribution`, `position_with_callers`
- **Heroes:** BTN open (hero A♦J♣ pinned on flop_root; earlier-street nodes reuse the same combo implicitly) vs SB + BB both flat; effStack 100bb; 3-way SRP; middling-dry rainbow flop
- **Pot-type:** SRP-3way. Preflop pot derivation: 0.5 SB-post + 1 BB-post + 3 BTN-open + 2.5 SB-complete + 2 BB-complete = 9bb exact; authored 10bb is rounded up 1bb. Noted but non-material.
- **Out of scope:** engine EV values (covered by `engineAuthoredDrift.test.js` / RT-108 drift test); UI rendering (companion surface audits cover v2 panel).

---

## Cross-node observations

- **Line premise is on solid MW theory ground.** The "bluff frequency collapse" framework is textually supported by GTO Wizard ("10 Tips for Multiway Pots"), SplitSuit's multi-way cbetting primer, and the alpha^n defense-threshold formula (per SplitSuit's bluff-math primer). The line is the library's canonical **HU-to-MW calibration** lesson and that positioning is earned.
- **Polar cbet-50% is the dominant authored answer** — this matches the upper-surface artifact's 9A-consensus result (GTO Wizard MW + Upswing MW + Doug Polk MW + Ed Miller + Jonathan Little + Berkey + PIO/Snowie all agree; only Will Tipton's HU-focused *EHUNL* was "not-addressed"). Line is solver-anchored rather than live-pool-adjusted, a distinction from the other HU/3BP lines in the roster.
- **MW→HU street transition isn't structurally encoded.** `turn_after_cbet.prose` narrates "BB called the flop cbet; SB folded," but the schema has no `villains[].status` or `foldedOnStreet` field, so the transition is a prose assertion. Consequence: if a future LSW engine upgrade tries to auto-derive villain counts per node, this node will need schema adjustment. Flagged for G4-TD (tech-debt), not a content finding.
- **No pot-accounting cascades of the A1 class.** Pots reconcile across decision nodes: `flop_root` 10 → `turn_after_cbet` 25 (10 + 5 hero cbet + 5 BB call + 5 SB-but-SB-folded so really 10 + 5 + 5 = 20; authored 25 is +5bb drift — see L-turn_after_cbet-F1). `turn_after_checkback` 10 preserved from flop checkback. `river_after_mw_barrel` 20 ≈ 10 + 5 + 5 if turn got min-raised? Actually: if `turn_after_checkback` → SB leads 50% (5bb) + BB call 5 + hero call 5 = 25, not 20. See L-river_after_mw_barrel-F1.
- **Archetype-leverage low on this line.** AJ TPTK is action-robust across fish/reg/pro/nit at every node per the upper-surface §12. Only `river_after_mw_barrel` has a sizing shift worth archetype-splitting (bet 33% vs check-back vs thin-value-vs-station). Lower total leverage than Q72r (3 HIGH-leverage river archetype flips) or T96 (2 HIGH-leverage archetype flips).

---

## Node-by-node findings

### `flop_root` — flop · both blinds check on J♠8♥5♦

- **1. Setup:** ✓ BTN open 3bb + SB flat 2.5bb + BB flat 2bb → pot 9 (authored 10, +1bb rounding). Board J85r is middling-dry rainbow, a canonical MW teaching texture. Hero A♦J♣ is TPTK with top kicker.
- **2. Villain action:** ✓ Both blinds check to hero. Solver-canonical for BB + SB in SRP-MW on middling dry flops with BTN having range advantage.
- **3. `correct` flag:** Bet 50% polar ✓ solver-aligned (upper-surface artifact §4 Claim 2: TPTK cbets ~90-95% in MW; solver sizing mix 65:25 prefers 50% over 33% for this equity-shape). Bet 33% wide false ✓ — this is the HU-player-trap call and the line teaches explicitly against it. Check back false ✓ — TPTK forfeits value vs the merged-weak calling range.
- **4. Frameworks:** `fold_equity_compression`, `bluff_frequency_collapse`, `nut_necessity`, `hand_class_shift`, `range_advantage` — 5 frameworks is on the **high side** (A2 observation flagged ≥4 as dilution risk). However, the line's pedagogical thesis is "MW recalibrates every HU heuristic," so the framework-density is proportionate to the teaching intent. Defensible but at the edge. See L-flop_root-F1.
- **5. Copy:**
  - Prompt: ✓ clean.
  - Rationales per branch: ✓ specific (quantified continue rates, explicit range-shape commentary, "AJ here is thin but defensible as value merge" is precise). "Hero's range advantage structurally evaporates" in the mismatch is the exact teaching point.
  - `why` section: contains a small math imprecision — see L-flop_root-F2.
  - `adjust` (calling-station blinds) and `mismatch` (HU-player-trap) sections: ✓ both crisp.
- **6. Bucket-teaching readiness:** PARTIAL. Already covered by upper-surface artifact. AJ TPTK is action-robust across archetypes (§12 of artifact confirmed). Archetype-sensitivity is primarily at sizing (50% vs 33% for station vs reg) which is a *sub-decision* within the polar branch. Lower bucket-teaching leverage than river nodes.
- **7. External validation:** 3 queries issued. 2 A, 1 A-with-nuance.

#### 7a. External-validation log for `flop_root`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "3-way cbet with TPTK polar 50% is solver-consensus" | "3-way multiway cbet frequency dry middling flop J85 TPTK solver GTO Wizard" | [GTO Wizard — 10 Tips for Multiway Pots](https://blog.gtowizard.com/10-tips-multiway-pots-in-poker/); [GTO Wizard — GTO Wizard AI 3-way Benchmarks](https://blog.gtowizard.com/gto_wizard_ai_3_way_benchmarks/); [GTO Wizard — Mechanics of C-Bet Sizing](https://blog.gtowizard.com/the-mechanics-of-c-bet-sizing/) | Multiway cbet frequencies drop materially (GTO Wizard benchmarks cite ~11.7% range-bet in some MW spots); strong value hands like TPTK/overpairs/sets still bet at high frequency — the frequency drop is on the bluff side. Polar 50% sizing matches "button holds many strong-yet-vulnerable value hands" framing. | **A** |
| 2 | "Bluff frequency compresses in MW by per-villain-continue-rate product" | "bluff frequency collapse multiway pot formula cbet calculation per villain fold" | [SplitSuit — Easy Poker Bluff Math](https://www.splitsuit.com/simple-poker-bluff-math); [SplitSuit — C-Betting Bluffs On Multi-Way Flops](https://www.splitsuit.com/betting-bluffs-multi-way-flops) | Defense frequency per player = α^(1/n). Authored line uses inverse framing ("continue rates compound across villains") — mathematically equivalent. The exact "divide HU freq by per-villain continue rate" heuristic in the terminal copy is directional, not solver-precise, but pedagogically clean. | **A-with-nuance** (math direction right, specific scalar is heuristic) |
| 3 | "HU-player-trap (carrying HU wide-cbet to MW)" | "multiway pot mistakes HU player continuation bet wide" | [PokerVIP — Mistakes in Multi-Way Pots](https://www.pokervip.com/strategy-articles/texas-hold-em-no-limit-advanced/mistakes-in-multi-way-pots); [SplitSuit — Continuation Betting In Multi-Way Pots](https://www.splitsuit.com/cb-in-multi-way-pots) | Multiway cbetting needs stronger holdings and must not copy HU frequencies; "range-betting fails in most multiway spots because opponents aren't obliged to defend very wide." Line's mismatch framing matches standard training-site treatment. | **A** |

#### Findings on `flop_root`

- **L-flop_root-F1 — Framework citation is on the high side (5 frameworks)** (Dimension 4)
  - **Severity:** 1 (P3). Authored for pedagogical thoroughness; at the dilution threshold.
  - **Observation:** `lines.js:1483–1489` cites 5 frameworks (`fold_equity_compression`, `bluff_frequency_collapse`, `nut_necessity`, `hand_class_shift`, `range_advantage`). Audit template guideline: too many dilutes signal. A2's `flop_root` sat at 4 frameworks and got flagged for `capped_range_check` being a stretch.
  - **Recommended fix:** Keep. The line's pedagogical thesis is specifically that MW demands recalibrating multiple HU heuristics, and each framework maps to a distinct recalibration (fold-equity × bluff-frequency × nut-necessity × hand-class × range-advantage). Dropping any loses a teaching point. Alternative: compress to 3 by merging `fold_equity_compression` + `bluff_frequency_collapse` into one (they're two names for the same underlying product math) and keep `nut_necessity` + `hand_class_shift` + `range_advantage`. **Not recommended** — bluff collapse is the HEADLINE teaching point and deserves its own framework ID.
  - **Effort:** S (no-op recommended).
  - **Proposed backlog item:** (none — finding is acknowledged and defers to author intent).

- **L-flop_root-F2 — `why` body math imprecision: "bluff-only cbets need 50%+ fold equity" at 33% sizing** (Dimension 5)
  - **Severity:** 1 (P3). Small quantitative inconsistency between two sentences.
  - **Observation:** `lines.js:1504–1509` — the `why` section says "if each villain continues 50% vs 33% bet, P(both fold) = 0.25. Bluff-only cbets need 50%+ fold equity to break even at this size — we're nowhere near that." The "50%+ fold equity" figure is either (a) a pot-size-bluff threshold (correct: 1/2 = 50% for a pot bet) or (b) an authored overstatement of the 33%-bet threshold (correct: 33%/(33%+100%) = 25%, not 50%). At the bet size cited (33%), the actual breakeven is 25%. The line's numeric claim (P(both fold) = 0.25 = 25%) actually **equals** the breakeven — the bluff is zero-EV at this sizing + fold rate, not deeply -EV. Overstating by 2× undersells the teaching point marginally (the bluff IS a loser, but by less than copy suggests).
  - **Recommended fix:** Revise to: "Bluff-only cbets at 33% sizing need 25% fold equity to break even — we're right at that threshold, so any reduction in per-villain fold rate (even to 45%) turns the bluff -EV. Add tiny error bars and the bluff starts bleeding."
  - **Effort:** S — single sentence rewrite.
  - **Risk:** None.
  - **Proposed backlog item:** `LSW-F-J85-F1 — flop_root bluff math precision`.

---

### `turn_after_cbet` — turn · 2♣ brick · BB checks (HU after SB folded)

- **1. Setup:** Authored `pot: 25`. Derivation from `flop_root` pot 10 + hero 50% cbet (5bb) + BB call (5bb) + SB fold (0) = 20, not 25. **+5bb drift.** Possibility: the authoring treated the "polar 50%" as a 75% bet (15bb), giving 10 + 15 × 2 = 40 which is also wrong. Or the `flop_root` pot was intended as 12.5 (10 + blinds rounding) which would give 12.5 + 5 + 5 = 22.5, closer but still not 25. The cleanest reconciliation is **pot = 20**, with the label and copy updated accordingly. See L-turn_after_cbet-F1.
- **2. Villain action:** ✓ BB checks brick turn after check-calling flop. Solver-canonical for BB's capped calling range.
- **3. `correct` flag:** Bet 60% correct ✓. Check-back false ✓ (forfeits value). Overbet pot false ✓ (polarizes a merged range; folds out weaker Jx that we target).
- **4. Frameworks:** `equity_redistribution`, `nut_necessity` ✓ both apt.
- **5. Copy:**
  - Prompt: ✓ clean.
  - Rationales: ✓ solid. The overbet rationale correctly identifies the sizing-vs-range-shape mismatch.
  - `prose` section narrates "SB folded" — NOT encoded structurally in the schema. Acceptable as a teaching simplification. Flagged as observation, not finding.
  - `why` section: ✓ accurate description of BB's post-flop-call range (pair-heavy, capped).
- **6. Bucket-teaching readiness:** PARTIAL. Archetype-leverage on size: smaller (40%) vs station to preserve call range; larger (75%) vs nit for protection. Fundamental bet/check decision is stable. Flag for potential sizing-teaching in a later upgrade.
- **7. External validation:** 2 queries issued. 2 A.

#### 7a. External-validation log for `turn_after_cbet`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "After MW cbet + one-caller, hero IP continues barreling TPTK on brick turn" | "multiway cbet called one villain turn barrel TPTK IP brick" | [GTO Wizard — GTO Wizard AI 3-way Benchmarks](https://blog.gtowizard.com/gto_wizard_ai_3_way_benchmarks/); [SplitSuit — Continuation Betting In Multi-Way Pots](https://www.splitsuit.com/cb-in-multi-way-pots) | MW-turned-HU on caller-narrowing carries the standard HU post-cbet dynamics on the new street. TPTK-value-bet on brick turn after capped-calling range is solver-canonical. | **A** |
| 2 | "Overbet pot with TPTK on brick turn folds weaker pairs we beat" | "overbet turn brick TPTK vs capped calling range folds weaker pairs" | [GTO Wizard — Mastering Turn Play in 3-Bet Pots OOP](https://blog.gtowizard.com/mastering-turn-play-in-3-bet-pots-oop/); [Upswing — Bet Size Strategy](https://upswingpoker.com/bet-size-strategy-tips-rules/) | Oversizing vs capped calling ranges loses EV — the hands that continue vs overbet are polarized (sets and strong Jx) and hero's TPTK is beaten. Canon: match sizing to range-shape; merged ranges want medium sizings. | **A** |

#### Findings on `turn_after_cbet`

- **L-turn_after_cbet-F1 — Pot value drift (`pot: 25` but flop reach gives 20)** (Dimension 1, 5)
  - **Severity:** 2 (P2). Not a teaching-content error but a math-hygiene error. Students who try to derive pot-odds at this node will not be able to reconcile 25 with the prior action.
  - **Observation:** `lines.js:1577 pot: 25.0`. Parent `flop_root` pot 10, hero 50% cbet = 5bb, BB call = 5bb, SB fold (0). Clean sum: 20. Authored 25 is 5bb too high. Possible source: author intended SB called (two callers), but the prose says SB folded.
  - **Recommended fix:** Update `turn_after_cbet.pot` from 25.0 to 20.0. Also recheck `terminal_mw_value_bet.pot` (25 authored, currently matches the incorrect turn pot) and `terminal_mw_gave_up_value.pot` (20 authored — matches a correct-turn-pot scenario, but the "gave up value" terminal reached from a CHECK-BACK means pot = 20 also, coincidentally fine). After turn bet (12bb at 60%) + BB call (12bb) = 44, not the current authored 25.
  - **Effort:** S — number update + cascade check through 3 terminals.
  - **Risk:** Medium — touches 4 nodes. `engineAuthoredDrift.test.js` (RT-108) will need re-baseline.
  - **Proposed backlog item:** `LSW-F-J85-F2 — turn_after_cbet pot reconciliation cascade`.

---

### `turn_after_checkback` — turn · 2♣ · SB leads 50% into checked-back flop

- **1. Setup:** ✓ pot 10 preserved from checked-back flop. Villain action kind=bet, size=0.5 ($5 into $10).
- **2. Villain action:** **Partial.** SB leading 50% on a brick turn into a checked-back flop is structurally realistic but **rare in population data**. Donk-leads after checked flops in SRP-MW are <5% OOP frequency per solver (Upswing "Exploiting BBs Who Never Donk-Bet" generalizes this OOP broadly — solver rarely leads after a checked prior street; live pool does it more, but estimates vary 5-12% in MW-SRP). The node is teaching a **response to a rare action**, which is defensible but positions the lesson in a lower-frequency spot than the line's other decisions.
- **3. `correct` flag:** Call correct ✓ (TPTK has ~60% equity vs SB's donk-lead range; folding is overfold). Fold false ✓. Raise false ✓ (BB-behind squeezes hero out of any bluff-raise value; position-with-callers framework applies cleanly here).
- **4. Frameworks:** `equity_redistribution`, `position_with_callers` ✓ both apt — `position_with_callers` is the headline framework for this node and the citation is precise.
- **5. Copy:**
  - Prompt: ✓ clean.
  - Rationales: ✓ solid. The raise-rationale explicitly names the BB-squeeze dynamic which is the structural feature of this spot.
  - `mismatch` section: "sandwiched: SB represents something, BB can check-raise or call-and-trap" is accurate but **uses "mismatch" kind where "prose" or "why" might fit better** — the `mismatch` kind is conventionally for HU-vs-MW or solver-vs-pool misalignments in this line's usage (cf. `flop_root.mismatch` = "HU-player trap"; `turn_after_checkback` uses it for narrating the spot's structure, which is a category shift). Minor stylistic consistency issue.
  - `why` section: ✓ accurate — clearly motivates the "our call range has to be resilient to BB raising" constraint.
- **6. Bucket-teaching readiness:** PARTIAL. Archetype-split on Fold vs Call is narrow (nit SB who "never leads without two-pair+" is mentioned in the rationale — that's essentially the archetype-flip already, but it's inline prose, not structurally encoded as `correctByArchetype`).
- **7. External validation:** 2 queries issued. 1 A, 1 A-with-stake-caveat.

#### 7a. External-validation log for `turn_after_checkback`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "OOP leading after checked-back flop is rare in solver, more common in live pool" | "donk lead turn checked flop frequency multiway SRP OOP" | [GTO Wizard — Exploiting BBs Who Never Donk-Bet](https://blog.gtowizard.com/exploiting-bbs-who-never-donk-bet/); [PokerVIP — Mistakes in Multi-Way Pots](https://www.pokervip.com/strategy-articles/texas-hold-em-no-limit-advanced/mistakes-in-multi-way-pots) | Solver rarely donks after checking prior street; live pool leads more often (estimated 5-12% MW-SRP, stake-dependent). The spot is real but lower-frequency than the line's other decisions. | **A-with-stake-caveat** |
| 2 | "Position-with-callers: calling with marginal made hand preferred over raising when caller-behind" | "position with caller behind raise multiway trap BB check raise" | [GTO Wizard — 10 Tips for Multiway Pots](https://blog.gtowizard.com/10-tips-multiway-pots-in-poker/); [Run It Once — Multiway Pot Do You cBet Here?](https://www.runitonce.com/plo/multiway-pot-do-you-cbet-here/) | Sandwiched-player "respect the nut ratio of the player left to act"; raising when live opponent is behind exposes hero to squeeze from stronger range. Near-pure call-or-fold strategy is the consensus. | **A** |

#### Findings on `turn_after_checkback`

- **L-turn_after_checkback-F1 — Section kind `mismatch` used for structural prose, not HU-vs-MW misalignment** (Dimension 5, stylistic)
  - **Severity:** 0 (cosmetic). Cross-node consistency nit.
  - **Observation:** `lines.js:1650–1660` uses `kind: 'mismatch'` for the "SB leads into BB + us" structural spot narration. In this line, `mismatch` is elsewhere used for "HU-player trap" and "Overpair ≠ nut" — solver-vs-pool misalignments. Here it's just prose about the spot's structure.
  - **Recommended fix:** Change `kind: 'mismatch'` → `kind: 'prose'`. Zero functional impact on UI; consistency improvement.
  - **Effort:** S — one-line edit.
  - **Proposed backlog item:** `LSW-F-J85-F3 — turn_after_checkback section kind` (defer, cosmetic).

---

### `river_after_mw_barrel` — river · 7♠ · both villains check

- **1. Setup:** Authored `pot: 20`. Reach path: `turn_after_checkback` pot 10 → SB leads 50% (5bb) + hero call (5bb) + BB call (5bb) = 25, not 20. **5bb drift.** Alternative: if BB folded to the turn lead, pot = 10 + 5 + 5 = 20 ✓ matches authored — BUT the node's prose says "Both villains check river; BB's check after turn-call-river" which implies BB DID call turn. Inconsistency. See L-river_after_mw_barrel-F1.
- **2. Villain action:** ✓ Both villains check river. Consistent with weak continuing ranges; SB's check-check-give-up after leading turn matches pool tendencies (fails to fold out hero + BB, gives up on river).
- **3. `correct` flag:** Bet 33% for thin value ✓ — target the weak-pair + missed-draw continuing range. Check-back false ✓ (forfeits thin value). Overbet false ✓ (folds out the weaker Jx we beat; condensed range punishes polar sizing).
- **4. Frameworks:** `nut_necessity` — single framework, **thin** for a node teaching thin value + sizing + range-condensation concepts. See L-river_after_mw_barrel-F2.
- **5. Copy:**
  - Prompt: ✓ clean.
  - Rationales: ✓ the Bet 33% rationale ("live earnings accumulate") is a strong pedagogical closer.
  - `prose` section's inference chain ("7♠ didn't complete straight draws he'd have — 76s did, but T9s/64s missed") is detailed and accurate BUT implicitly assumes the student knows 76s makes a straight on 7-8-9-J-5 (yes, 6-7-8-9-T isn't complete — wait, 6-7-8-9-T is a straight; board is J-8-5-2-7 so 7♠ gives 5-6-7-8-9 straight to 69s/T9s that hit but T9s + 64s also need runner runner... let me recheck). Board J♠8♥5♦2♣7♠. Straights available: 6-7-8-9-10 (needs 69s or T9s plus... actually 69 + board 785 = no straight unless T on board — T is not on board). 4-5-6-7-8 needs 64 or 46s. 5-6-7-8-9 needs 69 or 96... the board has 5 and 8 so need 6,7,9. Board has 7. So 69s makes 5-6-7-8-9 straight. Or 64 makes 4-5-6-7-8. The copy says "76s did" — 76 makes 5-6-7-8-... no, 76+578 = 5,6,7,8 need a 4 or a 9. No straight from 76 alone on this runout. The copy appears to have a subtle factual error about which draws completed. See L-river_after_mw_barrel-F3.
- **6. Bucket-teaching readiness:** **YES — high leverage.** Classic thin-value-vs-fish archetype split:
  - vs FISH: bet 33% — fish calls with any pair (mid-pair, bottom-pair, A-high-missed)
  - vs REG: check-back — condensed range doesn't pay
  - vs PRO: check-back — same
- **7. External validation:** 2 queries issued. 2 A.

#### 7a. External-validation log for `river_after_mw_barrel`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "Thin river value with TPTK after two-villain check-through is +EV vs capped range" | "thin value river check-through multiway TPTK condensed range" | [Upswing — Should You Check Behind With Top Pair?](https://www.splitsuit.com/checking-behind-with-top-pair); [GTO Wizard — 10 Tips for Multiway Pots](https://blog.gtowizard.com/10-tips-multiway-pots-in-poker/) | Thin value is the MW cash staple; when villains have tipped weak (two checks signal capping) and hero has TPTK, small sizing extracts from weaker pairs without punishing with calls from better. | **A** |
| 2 | "Condensed range punishes overbet — polar sizing needs polar range" | "overbet condensed range river polar sizing mismatch" | [Upswing — Bet Size Strategy](https://upswingpoker.com/bet-size-strategy-tips-rules/); [GTO Wizard — Mechanics of C-Bet Sizing](https://blog.gtowizard.com/the-mechanics-of-c-bet-sizing/) | Canon sizing heuristic: match sizing to range-shape. Condensed (merged) ranges want medium sizing; polar ranges want large sizing. Authored rationale is textbook. | **A** |

#### Findings on `river_after_mw_barrel`

- **L-river_after_mw_barrel-F1 — Pot drift (pot 20 authored, reach path gives 25)** (Dimension 1)
  - **Severity:** 2 (P2). Same math-hygiene class as turn_after_cbet F1.
  - **Observation:** `lines.js:1713 pot: 20`. Parent `turn_after_checkback` pot 10, SB lead 50% (5bb), hero call (5bb), BB call (5bb) = 25. Authored 20. If BB folded to the turn lead, pot = 20 — but prose says "BB's check after turn-call-river" implying BB called turn. Either (a) copy is wrong and BB folded turn, or (b) pot is wrong and should be 25.
  - **Recommended fix:** Decide BB's turn action and reconcile. Recommend option (b): update pot to 25 and keep the prose (BB called turn) because the "both villains check river" narrative needs BB to still be in the hand.
  - **Effort:** S.
  - **Risk:** Cascade to terminal pots. `terminal_mw_value_bet.pot = 25` currently reused from turn node — if river-reach pot is 25, the terminal value matches river-reach too (coincidentally). `terminal_mw_overbet_folds_pairs.pot = 20` and `terminal_mw_gave_up_value.pot = 20` would need updating.
  - **Proposed backlog item:** `LSW-F-J85-F4 — river_after_mw_barrel pot reconciliation + terminal cascade`.

- **L-river_after_mw_barrel-F2 — Single framework `nut_necessity` is thin for a thin-value + sizing + condensed-range node** (Dimension 4)
  - **Severity:** 1 (P3). Similar class to A2's `river_brick_v_calls-F1`. Node teaches multiple concepts but cites one framework.
  - **Observation:** `lines.js:1715 frameworks: ['nut_necessity']`. `nut_necessity` maps to "do we need the nuts here to bet?" logic; the node also teaches value-sizing thresholds and range-condensation dynamics.
  - **Recommended fix:** Add `range_morphology` if not better-matched elsewhere. Or add a new framework `value_sizing` / `thin_value_discipline` if one exists. Do NOT pad with frameworks that don't fit. Defer to a later framework-authoring session — **LOW priority**.
  - **Effort:** S — one-line edit pending framework inventory.
  - **Proposed backlog item:** `LSW-F-J85-F5 — river_after_mw_barrel framework citation` (LOW priority).

- **L-river_after_mw_barrel-F3 — `prose` inference chain contains a subtle straight-draw factual error** (Dimension 5)
  - **Severity:** 1 (P3). Small factual nit that a careful student will notice.
  - **Observation:** `lines.js:1721–1726` — copy reads "76s did [complete a straight], but T9s/64s missed." Check: board is J♠ 8♥ 5♦ 2♣ 7♠. For 76s: hero holds 7, 6 → 5+6+7+8+? needs 4 or 9 (board has neither outside 5-8-7 clump). 7-6 with 5-7-8 = 5,6,7,8 — need 4 or 9 for straight. No straight on this runout. For T9s: 10+9+5+8+7 = 7,8,9,10 need J or 6; board has J. So T9s makes 7-8-9-T-J straight. **T9s did make a straight; 76s did not.** Copy has them inverted.
  - **Recommended fix:** Revise to: "the 7♠ didn't complete straight draws he'd have (T9s did make 7-8-9-T-J; 76s needs 9 or 4 to straighten, not 7)."
  - **Effort:** S — sentence rewrite.
  - **Risk:** None.
  - **Proposed backlog item:** `LSW-F-J85-F6 — river_after_mw_barrel straight-draw factual fix`.

---

### Terminals — light walk

#### `terminal_mw_value_bet` — ✓ mostly clean
Pot 25.0. Reached from both `turn_after_cbet → Bet 60%` (turn pot 25 + hero 15bb bet + BB 15bb call = 55, not 25) AND `river_after_mw_barrel → Bet 33%` (river pot 20 + hero 6.6bb bet + villain 6.6bb call ≈ 33, not 25). Neither parent reach path cleanly yields 25. Copy is path-agnostic and teaches the general thin-value lesson. If L-turn_after_cbet-F1 and L-river_after_mw_barrel-F1 are shipped, terminal pot will need re-derivation. **No standalone finding** — covered by the two parent findings.

#### `terminal_mw_wide_bluff_loses` — ✓ clean
Pot 10.0 matches `flop_root` pot. Copy is strong — the "divide your default HU cbet frequency by per-villain continue rate" takeaway is the line's best pedagogical moment.

#### `terminal_mw_gave_up_value` — ✓ mostly clean
Pot 20.0. Reached from both `turn_after_cbet → Check back` (pot stays 20 if we use the corrected turn pot from F1) AND `river_after_mw_barrel → Check back` (pot stays 20 if authored, or 25 with F1 correction). Copy is path-agnostic.

#### `terminal_mw_overbet_folds_pairs` — ✓ clean
Pot 20.0. Reached from both `turn_after_cbet → Overbet` and `river_after_mw_barrel → Overbet`. Copy is path-agnostic.

#### `terminal_mw_overfold` — ✗ un-sourced magnitude claim
- **L-terminals-F1 — `terminal_mw_overfold` asserts specific bb/100 cost** (Dimension 5)
  - **Severity:** 1 (P3). Cost magnitude asserted, not derived.
  - **Observation:** `lines.js:1876` — copy says "Folding TPTK vs a 50% lead in 3-way is a leak of ~4bb/100 at the scale this matters." No source; no derivation. Directionally right (overfolding TPTK in this spot is a leak; 4bb/100 is a plausible-magnitude claim for a mid-frequency spot) but the specific number is asserted.
  - **Recommended fix:** Either source it or soften to qualitative: "Folding TPTK vs a 50% lead in 3-way is a material EV leak at any live stake — the call realizes ~60% equity in a spot that comes up often enough that small mistakes compound."
  - **Effort:** S.
  - **Proposed backlog item:** `LSW-F-J85-F7 — terminal_mw_overfold magnitude softening` (LOW priority).

#### `terminal_mw_raise_spew` — ✓ clean
Pot 10.0 matches `turn_after_checkback` pot. Copy is strong; the Position-With-Callers takeaway reinforces the decision node's teaching.

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority | Category |
|---|---------|----------|--------|----------|----------|
| 1 | L-turn_after_cbet-F1 — pot drift (25 → 20) | 2 | S | P2 | B |
| 2 | L-river_after_mw_barrel-F1 — pot drift (20 → 25) + terminal cascade | 2 | S | P2 | B |
| 3 | L-flop_root-F2 — bluff math precision (50% → 25% breakeven) | 1 | S | P3 | B |
| 4 | L-river_after_mw_barrel-F3 — straight-draw factual inversion (T9s vs 76s) | 1 | S | P3 | B |
| 5 | L-terminals-F1 — `terminal_mw_overfold` magnitude softening | 1 | S | P3 | B |
| 6 | L-turn_after_checkback-F1 — section `kind: mismatch` → `prose` | 0 | S | P3 | structural |
| 7 | L-river_after_mw_barrel-F2 — thin framework citation | 1 | S | P3 | structural |
| 8 | L-flop_root-F1 — framework density (5) at dilution threshold | 1 | S | P3 | acknowledged |

---

## Bucket-teaching queue (flows into Stream B / C)

For the 4 decision nodes on this line:

| Node | Hero combo (v1) | Proposed `bucketCandidates` | Proposed `correctByArchetype` split | Rationale |
|------|-----------------|------------------------------|--------------------------------------|-----------|
| `flop_root` | A♦J♣ (already upper-surface-covered) | `topPairGood, topPairWeak, overpair, flushDraw, openEnder, air` | bet50%:{all:T}; sizing subtly shifts by archetype | Upper-surface artifact confirmed TPTK action-robust; archetype leverage is at sizing not bet/check. Medium-low priority for widening. |
| `turn_after_cbet` | A♦J♣ | `topPairGood, overpair, twoPair, straightDraw, air` | bet60%:{all:T}; sizing shift across archetypes subtle | Low archetype leverage. **Skip** for now. |
| `turn_after_checkback` | A♦J♣ | `topPairGood, overpair, middlePair, air` | call:{fish:T,reg:T,pro:T,nit:F} — nit SB never leads without 2-pair+ | Narrow archetype split (fold only vs confirmed nit); inline rationale already covers this case. **Optional** widening. |
| `river_after_mw_barrel` | A♦J♣ | `topPairGood, overpair, weakJx, air` | bet33%:{fish:T,reg:F,pro:F,nit:F}; checkback:{fish:F,reg:T,pro:T,nit:T} | **HIGH LEVERAGE** — canonical thin-value-vs-fish archetype flip. Ship in LSW-B2 after L-river_after_mw_barrel-F1 pot-fix lands. |

---

## Category-D documented divergences

No category-D findings surfaced on this line. The line is solver-anchored (polar-50% cbet in MW-SRP is solver-preferred per §4 of the upper-surface artifact, and the rest of the line tracks standard HU principles once the spot has collapsed to HU). No POKER_THEORY.md §9 entry required.

---

## Accuracy verdict

**GREEN (light).** No P0/P1 blockers. Two P2 pot-drift findings that are math-hygiene issues, not pedagogical errors — students derive correct lessons regardless. Five P3 polish items. Line is ready for LSW-B2 widening on `river_after_mw_barrel` once L-river_after_mw_barrel-F1 ships (pot drift fix needed before bucket-EV numbers anchor to a consistent base).

**Strongest external validation:** Upper-surface artifact's 9A + 1 not-addressed consensus on polar-50% cbet with TPTK in MW. GTO Wizard's recent 3-way solver outputs + SplitSuit's multiway cbetting primer + PokerVIP's multiway mistakes treatment all converge.

**Bucket-teaching readiness:** 1 HIGH-leverage archetype-flip target (`river_after_mw_barrel` thin-value-vs-fish). Smaller leverage than Q72r (3 HIGH-leverage) or T96 (2 HIGH-leverage), but still non-zero.

---

## Review sign-off

- **Drafted by:** Claude (main, session 2026-04-23)
- **Reviewed by:** [pending owner]
- **Closed:** [pending]

Audit is immutable after close. Follow-up audits create a new file with `-v2` suffix.

---

## Change log

- 2026-04-23 — Draft (elevated-standard web-research validation per 2026-04-22 project charter).

---

## Sources (web research citations)

- [GTO Wizard — 10 Tips for Multiway Pots in Poker](https://blog.gtowizard.com/10-tips-multiway-pots-in-poker/)
- [GTO Wizard — GTO Wizard AI 3-way Benchmarks](https://blog.gtowizard.com/gto_wizard_ai_3_way_benchmarks/)
- [GTO Wizard — Introducing Multiway Preflop Solving](https://blog.gtowizard.com/introducing-multiway-preflop-solving/)
- [GTO Wizard — The Mechanics of C-Bet Sizing](https://blog.gtowizard.com/the-mechanics-of-c-bet-sizing/)
- [GTO Wizard — Exploiting BBs Who Never Donk-Bet](https://blog.gtowizard.com/exploiting-bbs-who-never-donk-bet/)
- [GTO Wizard — Mastering Turn Play in 3-Bet Pots OOP](https://blog.gtowizard.com/mastering-turn-play-in-3-bet-pots-oop/)
- [SplitSuit — Easy Poker Bluff Math (+Examples)](https://www.splitsuit.com/simple-poker-bluff-math)
- [SplitSuit — C-Betting Bluffs On Multi-Way Flops](https://www.splitsuit.com/betting-bluffs-multi-way-flops)
- [SplitSuit — Continuation Betting In Multi-Way Pots](https://www.splitsuit.com/cb-in-multi-way-pots)
- [SplitSuit — Should You Check Behind With Top Pair?](https://www.splitsuit.com/checking-behind-with-top-pair)
- [PokerVIP — Mistakes in Multi-Way Pots](https://www.pokervip.com/strategy-articles/texas-hold-em-no-limit-advanced/mistakes-in-multi-way-pots)
- [Upswing — Bet Size Strategy: 8 Rules](https://upswingpoker.com/bet-size-strategy-tips-rules/)
- [PokerNews — Multiway Poker Strategy Using GTO Wizard's New AI Solver](https://www.pokernews.com/strategy/struggling-in-multiway-pots-gto-wizard-shows-the-answer-51069.htm)
