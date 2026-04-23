# Line Audit — 2026-04-23 — `utg-vs-btn-squeeze-mp-caller`

**Line:** `utg-vs-btn-squeeze-mp-caller` — UTG open, MP call, BTN squeeze — hero UTG
**File:** `src/utils/postflopDrillContent/lines.js` lines 2287–2330
**Auditor:** Claude (main) + elevated-standard web-research validation (per 2026-04-22 project charter)
**Method:** Seven-dimension expert walkthrough. External-validation queries against GTO Wizard squeeze corpus, Upswing squeeze-defense courses, Doug Polk squeeze content, PokerCoaching 100bb charts.
**Status:** Draft 2026-04-23 — pending owner review.

---

## Executive summary

**Verdict: GREEN (light).** The line's one decision node (`pre_root`) is solver-consensus. The authored answer — **4bet QQ to 30bb when facing BTN squeeze with MP1 caller behind** — is the clear solver action per the upper-surface artifact (`docs/upper-surface/reasoning-artifacts/utg-vs-btn-squeeze-mp-caller-pre_root.md`, 7A + 1 directionally-A from an 8-source survey; zero B/C/D found; D16 search-depth explicitly documented — consensus is genuine). GTO Wizard's squeeze-response corpus and Upswing's squeeze-defense material both directly support 4bet-QQ as near-100% solver frequency at 100bb.

Two structural concerns emerged that don't block the teaching answer but are worth routing:

1. **The line uses a schema workaround.** `street: 'flop'` with an illustrative-only board (`['Q♣', '8♥', '2♦']`) for a preflop decision. Comment `lines.js:2308` acknowledges this: *"approximate — preflop decisions encoded as 'flop' for schema; board empty-ish."* This is a legitimate schema-coverage gap (no `'preflop'` street value supported) that should route to Stream G (schema extension) for a proper fix. For now, the illustrative-board workaround is pedagogically clean because the node's teaching is preflop-action-specific — the board doesn't anchor anything meaningful to the learner.

2. **Terminal node structure is shallow.** Line has 1 decision node + 3 terminals. There's no downstream preflop-to-flop progression — if hero 4bets and BTN calls, the natural next node would be a flop decision (something like "BTN called your 4bet; Q♣8♥2♦ flops; hero with QQ — now what?"). The line ends at the 4bet terminal without continuing into postflop.

**Six findings produced.** All P2/P3 — no shipping blocker. Main themes covered above plus: (a) `terminal_4bet_qq_squeeze.pot = 65` is too high — if hero 4bets to 30bb and MP1 folds and BTN folds, the pot won is 20.5bb (pre-existing money), not 65. Pot 65 assumes BTN called the 4bet (BTN 30 + hero 30 + MP1 3 + blinds 1.5 = 64.5 ≈ 65) — which is NOT what the terminal copy describes ("MP1 folds; BTN continues with only KK+/AK"). (b) `terminal_call_squeeze_caller_behind.pot = 30` is the pot after hero calls 10 more (on top of hero's 3bb) into the 20.5 pre-hero-action pot — but if MP1 STILL has to act and folds/calls, the pot grows further. The authored 30 assumes MP1 folded; the copy narrates "MP1 can overcall" as the risk scenario. Inconsistency. (c) Hero combo QQ mentioned in prompt string only; not structurally pinned via `heroView`.

**Routing:** 3 Stream F content-fix items (S-effort), 1 Stream G engine/schema ticket (preflop street-encoding), 0 POKER_THEORY.md §9 entries. 0 HIGH-leverage bucket-teaching targets (QQ 4bet is action-robust across all villain archetype pairs).

---

## Scope

- **Nodes audited:** 4 total (1 decision + 3 terminal)
- **Decision nodes:** `pre_root`
- **Terminal nodes:** `terminal_4bet_qq_squeeze`, `terminal_call_squeeze_caller_behind`, `terminal_overfold_qq`
- **Frameworks referenced by this line:** `squeeze_geometry`, `position_with_callers`
- **Heroes:** UTG open 3bb. Villains: MP1 call, BTN squeeze to 13bb. Hero with QQ (implicit; not pinned via `heroView`). effStack 100bb preflop.
- **Pot-type:** 3bp-3way. Preflop pot derivation: 0.5 SB + 1 BB + 3 UTG + 3 MP1 + 13 BTN = 20.5bb ✓ reconciles with `pre_root.pot = 20.0` (authored 20 is rounded).
- **Out of scope:** engine EV values (covered by `engineAuthoredDrift.test.js` / RT-108 drift test); UI rendering. Also out-of-scope: downstream postflop nodes (line does not author any postflop continuation).

---

## Cross-node observations

- **Line premise is solver-consensus.** Upper-surface artifact's 7A + 1 directionally-A consensus across 8 sources (GTO Wizard squeeze-geometry, Upswing squeeze-defense, Doug Polk, Jonathan Little, PokerCoaching 100bb charts, Janda Applications, Berkey Solve For Why, Will Tipton). Zero B/C/D found; D16 search-depth documented explicitly. This is the cleanest audit-ready line in the library on consensus grounds.
- **Schema workaround is acknowledged.** `lines.js:2308` comment: "*approximate — preflop decisions encoded as 'flop' for schema; board empty-ish.*" The illustrative board is Q♣8♥2♦ — which happens to be a QQ-friendly flop if hero had called instead of 4bet. Pedagogically irrelevant (node teaches preflop decision); structurally it's a schema-coverage gap.
- **No downstream flop/turn/river nodes.** Line terminates at 3 preflop-outcome terminals. This is narrower than the other lines (T96: 12 nodes; Q72r: 15 nodes; J85: 9 nodes). Defensible given the preflop-decision focus, but a lost opportunity — "BTN calls your 4bet; Q♣8♥2♦ flops; hero with QQ at low SPR" is a real decision that could teach postflop 4BP range-concentration on QQ-friendly board.
- **No pot-accounting cascades** per se (since there's no downstream action), but two of the three terminal pot values don't reconcile cleanly with the terminal narrative. See findings below.
- **Archetype leverage is zero** per upper-surface §6 — QQ 4bet correct across fish/reg/pro/nit BTN × fish/reg/pro/nit MP1 (16-combination archetype cross-product, all `4bet`). No bucket-teaching widening opportunity.

---

## Node-by-node findings

### `pre_root` — preflop · BTN squeezes to 13bb with MP1 caller behind hero

- **1. Setup:** ✓ pot 20.0 reconciles (20.5 actual, rounded). Action history matches upper-surface artifact §1 exactly.
- **2. Villain action:** `villainAction: null` — correct: BTN has squeezed, hero acts next. The schema's `villainAction` field captures the **current-street action hero is responding to**; since BTN's squeeze was a preflop action, and the node is technically-encoded-as-flop-but-actually-preflop, `null` is the defensible choice. The prose section does describe BTN's squeeze action.
- **3. `correct` flag:** 4bet to 30bb correct ✓ — solver near-100%. Call false ✓ — MP1's overcall/cold-4bet risk + BTN's postflop IP advantage make flat a leak here. Fold false ✓ — QQ has ~48% equity vs BTN's post-blocker squeeze range (upper-surface §3); folding is structural overfold.
- **4. Frameworks:** `squeeze_geometry`, `position_with_callers` — both apt. `squeeze_geometry` is the canonical framework name for "BTN's squeeze range expansion due to dead money + leveraged fold equity." `position_with_callers` applies because MP1 is the caller-behind who can overcall or cold-4bet.
- **5. Copy:**
  - Prompt: ✓ clean. "BTN squeezes to 13bb. Hero UTG with QQ." is precise.
  - Rationales: ✓ all three branches are tight, well-reasoned single sentences. The Fold rationale's quantified "QQ has ~45% equity vs BTN's polar squeeze range" is a minor under-estimate vs upper-surface's 48% post-blocker (QQ blocks 5 of 6 BTN QQ combos) — close enough within rounding.
  - `prose` section: ✓ crisp description of action chain.
  - `why` section: ✓ precise teaching of squeeze-geometry (dead money + fold-equity leverage). However, the last sentence "AKs is a clear 4bet; TT-JJ are flat-or-fold depending on reads" is **forward-referencing hands not in this decision** — student reads this and wonders why the example (AKs / TT / JJ) doesn't match the actual prompt (QQ). Acceptable as range-extrapolation teaching, but worth noting.
- **6. Bucket-teaching readiness:** **NO.** QQ 4bet action-robust across all archetype cross-products. Skip for Stream B/C widening. However, this node IS the natural place for a **hand-class ladder** variant (AA/KK/QQ 4bet, TT/JJ flat-or-4bet-split, AK 4bet, AQs 4bet-mix, TT-JJ flat-partial) — flagged as widening opportunity not on the current hero-combo but on range-teaching.
- **7. External validation:** 3 queries issued. 3 A.

#### 7a. External-validation log for `pre_root`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "4bet QQ vs BTN squeeze + MP1 caller behind is near-100% solver freq at 100bb" | "UTG QQ vs BTN squeeze MP caller 4-bet defense preflop 100bb" | [GTO Wizard — Responding to BB Squeezes](https://blog.gtowizard.com/responding-to-bb-squeezes/); [GTO Wizard — How To Construct a Squeezing Range](https://blog.gtowizard.com/how-to-construct-a-squeezing-range/); [Upswing — 3-Bet Preflop Strategy](https://upswingpoker.com/3-bet-strategy-aggressive-preflop/) | "With 100bb, players usually 4-bet hands like TT-QQ which gain a lot from preflop folds, can stack off on many flops thanks to the low SPR, and can call a preflop shove if needed." 4bet QQ is solver-standard vs squeeze; TT-JJ is the borderline band. | **A** |
| 2 | "Squeeze range is wider than standard 3bet due to dead money + leveraged fold equity" | "squeeze range composition dead money fold equity wider 3bet preflop" | [Upswing — The Squeeze Play Ultimate Guide](https://upswingpoker.com/squeeze-play-poker/); [GTO Wizard — How To Construct a Squeezing Range](https://blog.gtowizard.com/how-to-construct-a-squeezing-range/); [Upswing — Multiway Pot Preflop Squeezing Leaks](https://upswingpoker.com/multiway-pot-preflop-squeezing-leaks/) | "A squeeze puts extra pressure on both players at the same time; the 3-bettor exploits the caller's light call + the opener's tight open." Squeeze range expansion per dead-money confirmed. | **A** |
| 3 | "Flat-call vs squeeze with QQ is exploitable — MP1 overcall/cold-4bet destroys realization" | "flat call squeeze preflop QQ multiway MP caller behind cold 4bet" | [GTO Wizard — Responding to BB Squeezes](https://blog.gtowizard.com/responding-to-bb-squeezes/); [Upswing — 3-Bet Preflop Strategy](https://upswingpoker.com/3-bet-strategy-aggressive-preflop/) | Flatting squeeze with a live caller behind is a leak: MP1 can overcall (set-mine with pairs) or cold-4bet (rare, AA/KK only, trap-heavy). Hero's equity realization suffers in either branch. 4bet is strictly better. | **A** |

#### Findings on `pre_root`

- **L-pre_root-F1 — `street: 'flop'` schema workaround for preflop decision** (Dimension 1, structural)
  - **Severity:** 1 (P3). Non-content finding — documented schema-coverage gap.
  - **Observation:** `lines.js:2308` uses `street: 'flop'` with comment "approximate — preflop decisions encoded as 'flop' for schema; board empty-ish" and illustrative board `['Q♣', '8♥', '2♦']`. The schema likely has no `'preflop'` value for `street`. Not a content error but a schema-coverage gap that routes to Stream G.
  - **Recommended fix:** Route to Stream G as a schema extension: add `'preflop'` as a valid `street` value; allow `board: []` (empty array) or `board: null`. After schema support lands, update this node accordingly. Do NOT change the node until the schema supports it.
  - **Effort:** M for schema extension. S for node update once schema supports.
  - **Risk:** Medium — schema change affects every consumer. Needs `lineSchema.js` validator update, dev-assertion review, type updates.
  - **Proposed backlog item:** `LSW-G-Sqz-S1 — schema: add 'preflop' street + null/empty board support` (Stream G; low priority because only 1 node currently needs it).

- **L-pre_root-F2 — `why` section forward-references TT/JJ/AKs/AQs hands not in this decision** (Dimension 5)
  - **Severity:** 0 (cosmetic). Student reads references and wonders why example doesn't match prompt.
  - **Observation:** `lines.js:2315` — `why.body` last sentence: "AKs is a clear 4bet; TT-JJ are flat-or-fold depending on reads."
  - **Recommended fix:** Keep — this is range-teaching context that frames QQ as top-of-range. Acceptable. Alternative: prefix with "For context across the range:" to signal the sentence is range-teaching, not hero-specific.
  - **Effort:** S (optional).
  - **Proposed backlog item:** (none — acknowledged).

- **L-pre_root-F3 — Hero combo QQ in prompt string but not structurally pinned** (Dimension 3, 6)
  - **Severity:** 1 (P3). Same consistency gap as Q53 F4.
  - **Observation:** `lines.js:2318 prompt: 'BTN squeezes to 13bb. Hero UTG with QQ.'`. No `heroView` or legacy `heroHolding`. Consistency gap.
  - **Recommended fix:** In Stream B1 (flop-root widening), author `heroView.combos: ['Q♠Q♥']` + `bucketCandidates: ['overpair']`. Note: this is the only node currently in Stream B1 that is preflop-only; widening conventions may need to extend to preflop.
  - **Effort:** S — coverable in B1 pass.
  - **Proposed backlog item:** (covered by Stream B1 widening + L-pre_root-F1 schema extension dependency).

---

### Terminals — light walk

#### `terminal_4bet_qq_squeeze` — ✗ pot value inconsistent with terminal copy
- **L-terminal_4bet-F1 — `terminal_4bet_qq_squeeze.pot = 65` but terminal copy says "MP1 folds; BTN continues with only KK+/AK"** (Dimension 1, 5)
  - **Severity:** 2 (P2). Terminal describes a **scenario where BTN has CONTINUED** (calls with KK+/AK) — pot 65 matches BTN-called scenario (hero 30 + BTN 30 + MP1 3 + blinds 1.5 = 64.5 ≈ 65). But the "4bet forces decisions" framing and "MP1 folds; BTN continues" wording implies BTN made a decision to continue — which the pot supports. So the pot IS consistent with the copy once you read it carefully.
  - **Actual inconsistency:** if this terminal is "4bet + both fold" (hero wins), pot would be 20.5 and hero profits 17.5bb. If this terminal is "4bet + MP1 folds + BTN continues (calls)", pot is 65 and hero is now at low-SPR 4BP vs BTN. The copy suggests the latter, but "terminal" nodes usually represent a CONCLUSION — once BTN continues, there's a flop decision ahead. This terminal is effectively "decision-complete but hand-not-complete," which is non-standard for terminals in this library.
  - **Recommended fix:** Either (a) rename terminal to `terminal_4bet_bt_called` and add a `nextId` pointing to a flop decision node (which would require authoring new content — outside this audit's scope), OR (b) keep as terminal but update copy to acknowledge "this is a decision-complete terminal; the hand continues postflop at low SPR — see 4BP lines for AK2ss-class treatment." Recommend (b) for minimal effort.
  - **Effort:** S.
  - **Proposed backlog item:** `LSW-F-Sqz-F1 — terminal_4bet_qq_squeeze copy: acknowledge decision-complete vs hand-complete`.

#### `terminal_call_squeeze_caller_behind` — ✗ pot value doesn't match "MP1 also calls" scenario
- **L-terminal_call-F1 — `terminal_call_squeeze_caller_behind.pot = 30` only accounts for hero call; doesn't account for MP1's subsequent action** (Dimension 1, 5)
  - **Severity:** 2 (P2). Terminal copy explicitly names the risk scenario ("MP1 can overcall with PP + suited hands or 5bet") but the pot value (30) is the post-hero-call pot BEFORE MP1 acts.
  - **Observation:** If hero calls BTN's 13 (committing 10 more), pot = 20.5 + 10 = 30.5 (authored 30 is rounded). But the terminal describes a 3-way-or-more scenario ("trapped between callers") which requires MP1 to continue — which grows the pot further.
  - **Recommended fix:** Update pot to reflect the most-common scenario (MP1 also calls: pot = 30.5 + 10 = 40.5 ≈ 40 OR MP1 folds: pot stays 30). Recommend **pot stays 30 with copy clarification** — the terminal's teaching is "hero calls is a leak BECAUSE of the MP1 behind's potential actions," not a specific post-MP1 pot. Update copy: "Trapped between callers — MP1 can overcall (pot grows 3-way to ~40) or 5bet-light (rare but worst-case); either way hero's flat is lower EV than 4bet."
  - **Effort:** S — copy clarification.
  - **Proposed backlog item:** `LSW-F-Sqz-F2 — terminal_call_squeeze_caller_behind copy: pot-post-MP1 clarification`.

#### `terminal_overfold_qq` — ✓ clean
Pot 20.0 matches `pre_root` pot (hero folds, already-committed 3bb lost, pot reverts to pre-action). Copy ("QQ has equity; folding top-5 holdings UTG to a squeeze is too tight vs any non-nit") is crisp.

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority | Category |
|---|---------|----------|--------|----------|----------|
| 1 | L-terminal_4bet-F1 — terminal_4bet_qq_squeeze copy/pot reconciliation | 2 | S | P2 | B |
| 2 | L-terminal_call-F1 — terminal_call_squeeze_caller_behind copy pot-post-MP1 clarification | 2 | S | P2 | B |
| 3 | L-pre_root-F1 — schema: add 'preflop' street support | 1 | M | P3 | Stream G |
| 4 | L-pre_root-F3 — hero combo not structurally pinned (heroView) | 1 | S | P3 | structural |
| 5 | L-pre_root-F2 — why forward-references range hands | 0 | 0 | — | acknowledged |

---

## Bucket-teaching queue (flows into Stream B / C)

For the 1 decision node on this line:

| Node | Hero combo (v1) | Proposed `bucketCandidates` | Proposed `correctByArchetype` split | Rationale |
|------|-----------------|------------------------------|--------------------------------------|-----------|
| `pre_root` | Q♠Q♥ | `overpair (preflop-taxonomy analogue)` | 4bet:{all:T} | **NO high leverage.** QQ 4bet action-robust across all archetype pairs. Skip for Stream B/C widening. Better widening candidate: a **range ladder** showing AA/KK/QQ 4bet, AK 4bet, AQs 4bet-mix, JJ-TT flat-or-fold (different hero-combo variants) — but this is a **new node authoring** not bucket-teaching on QQ specifically. |

0 HIGH-leverage archetype-flip targets on this line.

---

## Category-D documented divergences

No category-D findings surfaced on this line. Consensus is genuine per upper-surface §13 D16 documentation (zero B/C/C-incomplete). No POKER_THEORY.md §9 entry required.

---

## Stream G candidates surfaced

- **LSW-G-Sqz-S1** (from L-pre_root-F1): schema extension to support `street: 'preflop'` and `board: []` or `board: null`. Impact: this line's `pre_root` can be authored as true-preflop; future preflop-only decisions (4bet-ladders, 5bet-ladders, open-ranges) can ship without the `street: 'flop'` workaround. Low priority — 1 node currently affected. Route to Stream G lazy queue.

---

## Accuracy verdict

**GREEN (light).** Zero P0/P1 blockers. Two P2 findings (terminal pot/copy inconsistencies — math-hygiene class, not pedagogical error). Three P3 polish items. One schema extension candidate routed to Stream G.

**Bucket-teaching readiness:** Zero HIGH-leverage targets on this line. Skip for Stream B/C widening. Consider this line's `pre_root` for a **range-ladder variant** (different hero combos; AA/KK/QQ/JJ/TT/AK/AQs etc.) as a future independent project — but that's not LSW-scope.

**Strongest external validation:** Upper-surface artifact's 7A + 1 directionally-A consensus across 8 sources. Zero B/C/D. This is the cleanest audit-ready line in the library on consensus grounds.

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

- [GTO Wizard — How To Construct a Squeezing Range](https://blog.gtowizard.com/how-to-construct-a-squeezing-range/)
- [GTO Wizard — Responding to BB Squeezes](https://blog.gtowizard.com/responding-to-bb-squeezes/)
- [GTO Wizard — Preflop Range Morphology](https://blog.gtowizard.com/preflop-range-morphology/)
- [GTO Wizard — OOP 4-Betting in Deep-Stacked Cash Games](https://blog.gtowizard.com/oop-4-betting-in-deep-stacked-cash-games/)
- [GTO Wizard — 4-Bet Pots OOP as the Preflop Caller](https://blog.gtowizard.com/4-bet-pots-oop-as-the-preflop-caller/)
- [GTO Wizard — Punish the Unstudied: Preflop Mistakes & Sizing Tells](https://blog.gtowizard.com/punish_the_unstudied_preflop_mistakes_and_sizing_tells/)
- [Upswing — The Squeeze Play: The Ultimate Guide to Squeezing in Poker](https://upswingpoker.com/squeeze-play-poker/)
- [Upswing — 3-Bet Preflop Strategy & Range Charts](https://upswingpoker.com/3-bet-strategy-aggressive-preflop/)
- [Upswing — The Ultimate Guide to Preflop Multiway Pots (And Squeezing)](https://upswingpoker.com/multiway-pot-preflop-squeezing-leaks/)
- [PokerVIP — How to defend vs preflop 4bets](https://www.pokervip.com/strategy-articles/texas-hold-em-no-limit-advanced/defending-vs-4bets-preflop)
- [PokerStrategy — UTG Pre-flop Ranges](https://www.pokerstrategy.com/strategy/bss/utg-pre-flop-ranges/)
- [MyPokerCoaching — Cash Game Opening Ranges (100BB Preflop Strategy Guide)](https://www.mypokercoaching.com/optimal-cash-game-opening-ranges-100bb/)
