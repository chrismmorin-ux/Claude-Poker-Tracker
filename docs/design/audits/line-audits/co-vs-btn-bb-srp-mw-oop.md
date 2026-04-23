# Line Audit — 2026-04-23 — `co-vs-btn-bb-srp-mw-oop`

**Line:** `co-vs-btn-bb-srp-mw-oop` — CO vs BTN + BB · 3-way SRP · Q♥5♠3♦ — hero OOP
**File:** `src/utils/postflopDrillContent/lines.js` lines 2219–2283
**Auditor:** Claude (main) + elevated-standard web-research validation (per 2026-04-22 project charter)
**Method:** Seven-dimension expert walkthrough. External-validation queries against GTO Wizard multiway corpus, Upswing multiway courses, SplitSuit multiway cbetting, PokerVIP sandwiched-position content.
**Status:** Draft 2026-04-23 — pending owner review.

---

## Executive summary

**Verdict: GREEN (light).** Both decision nodes (`flop_root`, `turn_after_cbet`) have solver-consensus answers. The `flop_root` polar-50% cbet with AQ TPTK is the consensus-robust recommendation from the upper-surface artifact (`docs/upper-surface/reasoning-artifacts/co-vs-btn-bb-srp-mw-oop-flop_root.md`, 6A + 1 C-incomplete from a 7-source survey, where the C-incomplete is the solver-preferred-33%-sizing shade — still-cbet, just possibly 33% over 50%). The spot — **hero OOP sandwiched between BB OOP-behind and BTN IP-behind on dry Q-high** — is a rare positional configuration (BTN cold-calls CO + BB defends, leaving CO sandwiched), but it IS a real structural pattern in live cash where BTN flats wider than solver recommends. Teaching value is real.

**Seven findings produced.** All P2/P3 — no shipping blocker. Main themes: (a) the `flop_root.prose` narrates "BB checks, hero CO acts first OOP" but the schema has no BB-action encoded — CO acts first OOP in the 3-way, with BB OOP-behind and BTN IP-behind, and BB doesn't pre-act. This is a misnarration of positional order that changes the interpretation of "sandwiched." (b) Pot 10bb at flop is not derivable from standard 2.5bb open (gives 8bb — see scope). (c) `turn_after_cbet.pot = 25` has the same issue as J85's turn_after_cbet (authored assumes MW stayed MW but prose says one villain folded). (d) The line narrates hero with A♠Q♣ (TPTK) specifically in the `prompt`, but the `flop_root` node does NOT pin `heroView` like JT6 / Q72r / K77 do — the pinned-combo teaching is implicit, not structural. Low priority for content but a consistency gap. (e) Single framework on `turn_after_cbet` (`nut_necessity`) for a node teaching value-extraction-from-capped-range + sizing-vs-range-shape. (f) `position_with_callers` cited on `flop_root` but hero acts FIRST (not sandwiched between acted-villain and to-act-villain in any traditional sense — both villains are "behind" hero in action order on the flop, so this is position-with-**two**-callers-behind which is even more specific than `position_with_callers`). (g) Terminal copy on `terminal_overbet_mw_oop` is generic "Condensed villain range punishes overbets" — same as the MW companion line's terminal.

**Routing:** 4 Stream F content-fix items (S-effort bundleable), 0 Stream G engine tickets, 0 POKER_THEORY.md §9 entries. 1 MEDIUM-leverage bucket-teaching target (`turn_after_cbet` for thin-value-vs-fish sizing shift).

---

## Scope

- **Nodes audited:** 7 total (2 decision + 5 terminal)
- **Decision nodes:** `flop_root`, `turn_after_cbet`
- **Terminal nodes:** `terminal_thin_value_mw_oop`, `terminal_wide_cbet_oop_mw`, `terminal_checkback_oop_mw`, `terminal_checkback_mw_oop_turn`, `terminal_overbet_mw_oop`
- **Frameworks referenced by this line:** `bluff_frequency_collapse`, `position_with_callers`, `hand_class_shift`, `nut_necessity`
- **Heroes:** CO open (hero A♠Q♣ implicit; not structurally pinned) vs BTN cold-call IP + BB defend OOP-behind. effStack 100bb. 3-way SRP on dry high-card rainbow board Q♥5♠3♦.
- **Pot-type:** SRP-3way. Preflop pot derivation at 2.5bb open: 0.5 SB + 1 BB-post + 2.5 CO + 2.5 BTN + 1.5 BB-complete = **8bb**. Authored 10bb. At 3bb open the derivation would be 0.5 + 1 + 3 × 2 + 2 = 10.5 — consistent with the upper-surface artifact's "authored 10bb rounded" note. Likely the author-intended open size is 3bb, unstated.
- **Out of scope:** engine EV values (covered by `engineAuthoredDrift.test.js` / RT-108 drift test); UI rendering.

---

## Cross-node observations

- **Line premise is structurally niche but real.** "BTN cold-calls CO open + BB defends" is a specific 3-way configuration. At live cash (1/2–5/10 NL), BTN flats CO opens ~13% of hands (narrower than solver's suggested 3bet-heavier strategy); BB defends ~30-45% facing 2.5bb raise. The 3-way frequency at live cash is real but low single-digit %. The line is teaching a **specific MW positional pattern** that rewards OOP discipline; this positioning is defensible.
- **Positional order in the `prose` is inverted.** `flop_root.prose` says "hero CO acts first OOP after BB checks" — but in the action order on the flop, CO is the first-to-act OOP player (seat order post-button: SB → BB → UTG → ... → HJ → CO → BTN). CO acts **first on the flop** before both BB and BTN. BB doesn't "check first" — the post-flop action begins with CO. "Sandwiched" in this line means "OOP with IP-villain behind AND OOP-villain behind," not "acting between two others."
- **The line's "sandwiched" framing is accurate when understood as "two live opponents both with decisions to make after hero acts."** BB can check-behind or check-raise; BTN can call, raise, or fold IP. Hero's cbet bets into double-uncertainty. This is what upper-surface §1 labeled "sandwiched" and it IS a real structural feature even if the prose phrasing ("BB checks, hero acts first") is slightly wrong about who acts first.
- **Hero combo not pinned structurally.** Unlike JT6 (`heroView.combos: ['J♥T♠']`), Q72r (`heroView.combos: ['A♠Q♣']`), K77 (`heroView.combos: ['A♥K♦']`), T96 3BP flop_root (`heroView.combos: ['J♥T♠']`), this line's `flop_root` has no `heroView` or `heroHolding` — the specific combo (A♠Q♣) is only mentioned in the decision `prompt` string. Consistency gap; widening opportunity. See L-flop_root-F4.

---

## Node-by-node findings

### `flop_root` — flop · hero CO acts first OOP on Q♥5♠3♦

- **1. Setup:** Authored `pot: 10`. Derivation at 2.5bb open: 8bb. At 3bb open: 10.5bb (≈ 10). Likely 3bb open assumed. Minor rounding.
- **2. Villain action:** `villainAction: null` — correct: hero acts first (no prior villain action on the flop). The `prose` narration "BB checks" is wrong about temporal order; BB has NOT yet acted when hero decides. See L-flop_root-F1.
- **3. `correct` flag:** Cbet 50% polar correct ✓ — matches upper-surface 6A consensus (solver prefers 33% slightly; 50% is within acceptable mix + chosen as pedagogical simplification — upper-surface §6 documented the deviation). Cbet 33% wide false ✓ — wide cbets 3-way OOP burn EV; bluffs die at MW fold-equity compression. Check false ✓ — gives up nut advantage on dry high-card where CO has range-advantage structurally.
- **4. Frameworks:** `bluff_frequency_collapse`, `position_with_callers`, `hand_class_shift` — all three are pedagogically apt but `position_with_callers` is mis-applied here: the canonical usage (per `turn_after_checkback` in J85) is "caller BEHIND you in the current street's action order." On the flop in this line, BOTH BB and BTN are behind hero — so it's "position-with-callers-behind" but doubled. Framework technically applies but is more directly on-point at later streets. See L-flop_root-F2.
- **5. Copy:**
  - Prompt: ✓ clean but references specific combo (A♠Q♣) that isn't pinned structurally. See L-flop_root-F4.
  - Rationales: ✓ all three branches are well-reasoned. The `polar value-focused` framing is precise; the `wide cbet` rationale correctly names the EV-realization + bluff-death dynamic; the `check` rationale correctly invokes the nut-advantage-forfeit cost.
  - `prose` section: **positional order wrong** — see L-flop_root-F1.
  - `adjust` section: ✓ "BTN flat vs CO is polar: pocket pairs + suited broadways/connectors" is accurate range-description; "range-bet small works; BTN folds a lot" directly contradicts the `correct: true` answer of 50% polar. The adjust-vs-tight-BTN reads as a consideration that could flip toward 33% sizing in the specific archetype case. See L-flop_root-F3.
- **6. Bucket-teaching readiness:** PARTIAL. AQ TPTK is action-robust across archetypes per upper-surface §12. Archetype-sensitivity at SIZING level (33% vs 50%) — upper-surface §13 flagged solver's 33%-preference as C-incomplete. Sizing-teaching opportunity, but binary action/inaction is stable. Medium leverage.
- **7. External validation:** 3 queries issued. 2 A, 1 C-incomplete.

#### 7a. External-validation log for `flop_root`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "MW OOP cbet with TPTK on dry high-card is solver-canonical" | "multiway 3-way CO PFR cbet Q53 rainbow OOP sandwiched position with callers behind" | [GTO Wizard — 10 Tips for Multiway Pots](https://blog.gtowizard.com/10-tips-multiway-pots-in-poker/); [GTO Wizard — 3-Way Solving](https://blog.gtowizard.com/now_live_3_way_solving_nodelocking_2_0_and_50k_icm_ft_sims/); [SplitSuit — Continuation Betting In Multi-Way Pots](https://www.splitsuit.com/cb-in-multi-way-pots) | MW cbet with TPTK is solver-canonical with high frequency (upper-surface §4 Claim 2: ~95%+ with TPTK on Q53r 3-way IP; OOP discounted by ~5-10% for realization-loss but still cbet-dominant). Sizing preference in MW OOP = 33% per solver, 50% per authored. Both cbet. | **A** (action); **C-incomplete** (sizing 33% solver preference) |
| 2 | "Sandwiched-OOP dynamic with IP-behind + OOP-behind" | "multiway sandwiched position OOP caller behind IP behind postflop" | [PokerVIP — Mistakes in Multi-Way Pots](https://www.pokervip.com/strategy-articles/texas-hold-em-no-limit-advanced/mistakes-in-multi-way-pots); [GTO Wizard — 10 Tips](https://blog.gtowizard.com/10-tips-multiway-pots-in-poker/) | "Sandwiched player has to respect nut ratio of player left to act; raising when live opponent is behind exposes hero to squeeze from stronger range." Authored `adjust` section (tight BTN) aligns. | **A** |
| 3 | "BTN cold-call range vs CO open at live cash is ~13%" | "BTN cold call CO open range live cash 100bb preflop" | [GTO Wizard — Should You Ever Cold Call a 3-Bet?](https://blog.gtowizard.com/should-you-ever-cold-call-a-3-bet/); [Upswing — Playing Calls From the Button](https://blog.gtowizard.com/playing-calls-from-the-button-in-cash-games/) | BTN flats CO opens with polar range: pairs 22-JJ (some 3bet), suited broadways/connectors, suited aces (some 3bet). Live pool ~13% matches. Solver prefers 3bet-heavy BTN vs CO; live pool flats more. | **A** |

#### Findings on `flop_root`

- **L-flop_root-F1 — `prose` narrates "hero CO acts first OOP after BB checks" but CO acts first, BB hasn't acted** (Dimension 5)
  - **Severity:** 2 (P2). Misleading about positional order; student may mis-apply the lesson to a different spot.
  - **Observation:** `lines.js:2246` — prose reads: "3-way on dry Q53r. Hero CO acts first OOP after BB checks." Post-flop action order in hold'em starts from the first-active-player-left-of-button-post-flop — that's SB (or BB if SB out) → BB → UTG → ... → CO → BTN. In this 3-way (CO + BTN + BB alive), BB is first to act, then CO, then BTN. **BB acts first**, not CO. The `prose` has it inverted.
  - **Wait — re-check:** SB folded preflop (per upper-surface §1 action history). BB is the first OOP player; BB acts before CO. BB's check happens first; then CO acts (second to act); BTN acts last (in position).
  - **So who's "first"?** BB is. Hero CO acts SECOND (after BB checks, before BTN decides).
  - The authored prose is **ambiguous**: "hero CO acts first OOP after BB checks" could be read as "hero acts first among the OOP players **whose decision matters** — BB already checked, so CO is the first with a real choice." This IS accurate as a practical description (once BB has checked, CO has the next decision to make), but it misleads about the positional action order at the table.
  - **Recommended fix:** Revise prose to explicitly name the order: "3-way on dry Q53r. BB checks first (OOP, range-wide on this texture). Hero CO acts second. BTN is IP and still to act behind. This is the 'sandwiched' configuration: OOP villain behind us-ish (BB has already acted, won't act again until next street) + IP villain ahead-in-next-decision."
  - **Effort:** S — one-paragraph rewrite.
  - **Risk:** None.
  - **Proposed backlog item:** `LSW-F-Q53-F1 — flop_root positional-order clarification`.

- **L-flop_root-F2 — `position_with_callers` framework is less on-point on flop than on turn** (Dimension 4)
  - **Severity:** 1 (P3). Framework is valid but more directly-relevant at later streets.
  - **Observation:** `lines.js:2244 frameworks: ['bluff_frequency_collapse', 'position_with_callers', 'hand_class_shift']`. `position_with_callers` canonically applies when hero has a decision with a live opponent yet-to-act on the same street — at flop in this line that's BTN (who is IP and acts after hero). So the framework IS on-point, but J85's `turn_after_checkback` uses the same framework for a tighter positional dynamic (sandwiched between actor + to-act) that fits more cleanly.
  - **Recommended fix:** Keep on `flop_root` as it does apply. Could add to `turn_after_cbet` for the turn decision (though turn is HU, so framework doesn't apply there). No action needed — flagging for awareness only.
  - **Effort:** 0 — observation, not a fix.
  - **Proposed backlog item:** (none).

- **L-flop_root-F3 — `adjust` section's "range-bet small works; BTN folds a lot" contradicts the `correct: true` Cbet 50% branch** (Dimension 5)
  - **Severity:** 2 (P2). Teaches two contradictory answers within the same node.
  - **Observation:** `lines.js:2247` — adjust section reads: "Against tight BTN flats... Broadways rarely hit Q53 hard. Range-bet small works; BTN folds a lot." This suggests cbet 33% wide is GOOD vs tight BTN — but `branches[1]` (Cbet 33% pot wide) is flagged `correct: false` with rationale "Wide cbets OOP 3-way burn EV." The adjust contradicts the branch's correct flag.
  - **Recommended fix:** Either (a) update adjust to clarify that vs-tight-BTN the polar 50% still wins because BTN folds at 50% too — not a case for switching to 33% wide; or (b) update `correctByArchetype` on the 33% branch to mark it `correct` vs confirmed tight-BTN archetype. Recommend (a) — the adjust is describing villain tendency, not prescribing hero sizing shift; the language just isn't explicit about that.
  - **Effort:** S — rewrite adjust section last sentence: "…range-bet 50% still works here (BTN folds a lot to any cbet size); the question is whether the extra value from larger sizing outweighs the occasional call from broadway-pairs. Polar 50% slightly preferred for extraction."
  - **Risk:** None.
  - **Proposed backlog item:** `LSW-F-Q53-F2 — flop_root adjust-vs-branch contradiction`.

- **L-flop_root-F4 — Hero combo A♠Q♣ mentioned in `prompt` but not structurally pinned via `heroView`** (Dimension 3, 6, structural)
  - **Severity:** 1 (P3). Consistency gap with other audited lines.
  - **Observation:** `lines.js:2250 prompt: 'Hero CO acts first OOP with A♠Q♣.'` — combo is in the prompt string but the node has no `heroView` or legacy `heroHolding`. Compared to JT6/Q72r/K77 which ALL have `heroView.combos`, this is a consistency gap.
  - **Recommended fix:** In the Stream B1 widening pass for this line, author `heroView.combos: ['A♠Q♣']` with `bucketCandidates: ['topPairStrong', 'overpair', 'air']` (AQ on Q53r is top-pair-top-kicker). Widening is the canonical way to resolve; no content fix needed before widening.
  - **Effort:** S — will be handled by Stream B1.
  - **Proposed backlog item:** (covered by existing Stream B1 widening plan — recommend this line's flop_root join the B1 tier when unblocked).

---

### `turn_after_cbet` — turn · 8♣ brick · one villain folded, hero still with MW-turned-HU

- **1. Setup:** Authored `pot: 25`. Derivation from `flop_root` pot 10 + hero 50% cbet (5bb) + one-villain-call (5bb) + one-villain-fold (0) = **20bb**, not 25. **Same 5bb drift class as J85's `turn_after_cbet`.** Alt: if BOTH villains called, pot = 10 + 5 × 3 = 25bb, but prose says "one villain called, one folded." See L-turn_after_cbet-F1.
- **2. Villain action:** ✓ Hero faces no villain action on turn (checked to). Effectively HU on the turn per prose.
- **3. `correct` flag:** Bet 60% correct ✓ — TPTK remains ahead of the continuing range (weak Qx, second pair). Check false ✓ (gives up value; villain range is weak). Overbet false ✓ (folds out weaker Qx we target).
- **4. Frameworks:** `nut_necessity` — single framework. **Thin** for a node teaching thin-value-extraction + sizing-vs-range-shape. See L-turn_after_cbet-F2.
- **5. Copy:**
  - Prompt: ✓ clean but terse ("Hero's turn play?" — less informative than the other nodes' prompts).
  - Rationales: ✓ all three are reasoned but terse (each one-sentence). Acceptable for a turn node but compresses vs the other lines' rationale-density.
  - `prose` section: ✓ "Effectively HU after flop" correctly narrates the transition.
- **6. Bucket-teaching readiness:** MEDIUM. Classic MW-turned-HU thin-value spot. Archetype-sensitivity at sizing (smaller vs station, larger vs reg for protection). Low bet/check flip leverage; moderate sizing-teaching opportunity.
- **7. External validation:** 2 queries issued. 2 A.

#### 7a. External-validation log for `turn_after_cbet`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "MW-turned-HU turn value bet with TPTK vs capped calling range" | "multiway to heads up turn transition TPTK value bet capped" | [GTO Wizard — 10 Tips for Multiway Pots](https://blog.gtowizard.com/10-tips-multiway-pots-in-poker/); [SplitSuit — Continuation Betting In Multi-Way Pots](https://www.splitsuit.com/cb-in-multi-way-pots) | When MW collapses to HU via fold, standard HU post-cbet turn dynamics apply on the new street. TPTK value on brick turn vs capped calling range is canonical. | **A** |
| 2 | "Overbet vs condensed range is value-own" | "overbet condensed pair-heavy range turn brick folds worse pairs" | [Upswing — Bet Size Strategy](https://upswingpoker.com/bet-size-strategy-tips-rules/); [GTO Wizard — Mechanics of C-Bet Sizing](https://blog.gtowizard.com/the-mechanics-of-c-bet-sizing/) | Canon: match sizing to range-shape. Condensed ranges punish overbets. Rationale accurate. | **A** |

#### Findings on `turn_after_cbet`

- **L-turn_after_cbet-F1 — Pot value drift (`pot: 25` but reach gives 20 with one villain folded)** (Dimension 1)
  - **Severity:** 2 (P2). Same math-hygiene class as J85 F1 / A1 class.
  - **Observation:** `lines.js:2262 pot: 25`. Parent `flop_root` pot 10 + hero cbet 5 + one-villain-call 5 + one-villain-fold 0 = 20. Authored 25. If both-villains-called, pot = 25, but prose explicitly says one folded.
  - **Recommended fix:** Update pot to 20 OR revise prose to "both villains called." Recommend **update pot to 20** since the turn narrative intent is MW-to-HU transition (more common and more pedagogically rich).
  - **Effort:** S — pot value + terminal cascade.
  - **Risk:** Terminal pots inherit — `terminal_thin_value_mw_oop.pot = 25` (matches current but would need update); `terminal_checkback_mw_oop_turn.pot = 25` (same); `terminal_overbet_mw_oop.pot = 25` (same). All 3 terminals inherit flop-cascade.
  - **Proposed backlog item:** `LSW-F-Q53-F3 — turn_after_cbet pot reconciliation (25 → 20) + terminal cascade`.

- **L-turn_after_cbet-F2 — Single framework `nut_necessity` is thin** (Dimension 4)
  - **Severity:** 1 (P3). Node teaches multiple concepts but cites one framework.
  - **Observation:** `lines.js:2264 frameworks: ['nut_necessity']`. Node teaches value-extraction, sizing-vs-range-shape, and (implicitly) MW-to-HU transition. One framework.
  - **Recommended fix:** Defer to framework-inventory review. Same class as J85 F2 / A2 F1. LOW priority.
  - **Effort:** S.
  - **Proposed backlog item:** `LSW-F-Q53-F4 — turn_after_cbet framework citation` (LOW priority).

---

### Terminals — light walk

#### `terminal_thin_value_mw_oop` — ✓ mostly clean
Pot 25.0. Will need update to 20 if L-turn_after_cbet-F1 ships. Copy ("Handling the MW-to-HU transition correctly is key") is accurate but generic.

#### `terminal_wide_cbet_oop_mw` — ✓ clean
Pot 10.0 matches `flop_root`. Copy ("Bluffs die, equity unrealized") is terse but hits the teaching point.

#### `terminal_checkback_oop_mw` — ✓ clean
Pot 10.0 matches `flop_root`. Copy ("Nut advantage forfeit") is crisp.

#### `terminal_checkback_mw_oop_turn` — ✓ mostly clean
Pot 25.0. Will need update to 20 if L-turn_after_cbet-F1 ships.

#### `terminal_overbet_mw_oop` — ✓ mostly clean
Pot 25.0. Will need update to 20 if L-turn_after_cbet-F1 ships. Copy is generic "Condensed villain range punishes overbets" — functionally identical to J85's `terminal_mw_overbet_folds_pairs`. Acceptable boilerplate.

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority | Category |
|---|---------|----------|--------|----------|----------|
| 1 | L-flop_root-F1 — positional-order prose clarification | 2 | S | P2 | B |
| 2 | L-flop_root-F3 — adjust-vs-branch contradiction | 2 | S | P2 | B |
| 3 | L-turn_after_cbet-F1 — pot drift (25 → 20) + terminal cascade | 2 | S | P2 | B |
| 4 | L-flop_root-F4 — hero combo not structurally pinned | 1 | S | P3 | structural |
| 5 | L-turn_after_cbet-F2 — thin framework citation | 1 | S | P3 | structural |
| 6 | L-flop_root-F2 — position_with_callers framework relevance | 0 | 0 | — | observation |

---

## Bucket-teaching queue (flows into Stream B / C)

For the 2 decision nodes on this line:

| Node | Hero combo (v1) | Proposed `bucketCandidates` | Proposed `correctByArchetype` split | Rationale |
|------|-----------------|------------------------------|--------------------------------------|-----------|
| `flop_root` | A♠Q♣ | `topPairStrong, overpair, air, secondPair` | bet50%:{all:T}; sizing shift 33% vs fish/station for value-extraction | MEDIUM leverage — sizing flip not action flip. Ship in LSW-B1 when unblocked. |
| `turn_after_cbet` | A♠Q♣ | `topPairStrong, overpair, secondPair, air` | bet60%:{all:T}; sizing subtle | Low leverage; skip for now. |

0 HIGH-leverage targets on this line; 1 MEDIUM. Line is a lower-priority LSW-B widening candidate than Q72r or T96.

---

## Category-D documented divergences

No category-D findings surfaced on this line. The line is solver-anchored with the documented C-incomplete on sizing-preference (solver's 33% vs authored's 50%) — upper-surface §13 already documented this as a pedagogical simplification, not a live-pool divergence. No POKER_THEORY.md §9 entry required.

---

## Accuracy verdict

**GREEN (light).** Zero P0/P1 blockers. Three P2 findings (positional-order prose, adjust-vs-branch contradiction, pot drift) are all math-hygiene + clarity items — they don't teach wrong principles but do create friction for the careful student. Two P3 items.

**Bucket-teaching readiness:** 1 MEDIUM-leverage target (`flop_root` sizing-teaching). Lower priority than Q72r or T96 for LSW-B widening, but higher than AK2 (which has 0 targets).

**Strongest external validation:** Upper-surface artifact's 6A / 1 C-incomplete consensus across 7 sources (C-incomplete is the solver-33%-preference — still-cbet, different sizing). Spot is well-covered in modern MW literature.

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
- [GTO Wizard — 3-Way Solving](https://blog.gtowizard.com/now_live_3_way_solving_nodelocking_2_0_and_50k_icm_ft_sims/)
- [GTO Wizard — Playing Calls From the Button in Cash Games](https://blog.gtowizard.com/playing-calls-from-the-button-in-cash-games/)
- [GTO Wizard — Should You Ever Cold Call a 3-Bet?](https://blog.gtowizard.com/should-you-ever-cold-call-a-3-bet/)
- [GTO Wizard — Mechanics of C-Bet Sizing](https://blog.gtowizard.com/the-mechanics-of-c-bet-sizing/)
- [GTO Wizard — C-Betting OOP in 3-Bet Pots](https://blog.gtowizard.com/c-betting-oop-in-3-bet-pots/)
- [SplitSuit — Continuation Betting In Multi-Way Pots](https://www.splitsuit.com/cb-in-multi-way-pots)
- [SplitSuit — C-Betting Bluffs On Multi-Way Flops](https://www.splitsuit.com/betting-bluffs-multi-way-flops)
- [PokerVIP — Mistakes in Multi-Way Pots](https://www.pokervip.com/strategy-articles/texas-hold-em-no-limit-advanced/mistakes-in-multi-way-pots)
- [Upswing — Bet Size Strategy: 8 Rules](https://upswingpoker.com/bet-size-strategy-tips-rules/)
- [PokerNews — Multiway Poker Strategy Using GTO Wizard's New AI Solver](https://www.pokernews.com/strategy/struggling-in-multiway-pots-gto-wizard-shows-the-answer-51069.htm)
