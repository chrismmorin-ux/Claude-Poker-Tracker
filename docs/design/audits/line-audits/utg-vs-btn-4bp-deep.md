# Line Audit — 2026-04-23 — `utg-vs-btn-4bp-deep`

**Line:** `utg-vs-btn-4bp-deep` — UTG vs BTN · 4BP · A♠K♦2♠
**File:** `src/utils/postflopDrillContent/lines.js` lines 2176–2215
**Auditor:** Claude (main) + elevated-standard web-research validation (per 2026-04-22 project charter)
**Method:** Seven-dimension expert walkthrough. External-validation queries against GTO Wizard 4bet-pot corpus, Upswing 4bet-pot strategy, SplitSuit AK-on-Axx articles.
**Status:** Draft 2026-04-23 — pending owner review.

---

## Executive summary

**Verdict: GREEN (light).** This is the smallest line in the library (1 decision node + 3 terminals) and the most structurally simple. The authored answer — **jam with AK on AK2ss at low 4BP SPR** — is solver-consensus (per upper-surface artifact `docs/upper-surface/reasoning-artifacts/utg-vs-btn-4bp-deep-flop_root.md`, 10A from a 10-source survey). GTO Wizard's 4BP corpus and SplitSuit's AK-postflop primer both directly support the jam. One pedagogically-material issue surfaced: the line's title says "deep" but it's explicitly a **low-SPR** line (4BP at ~100bb starts with SPR ~0.8) — "deep" in the ID connotes the opposite of the actual teaching point and confuses the student who comes in expecting 200bb+ stack depth. Secondary: the authored pot (55bb) is too high for a standard 4BP at 100bb effStack — derivation gives ~45bb, not 55bb — which inflates the "low SPR" framing but makes hero's committed fraction look different than it actually is.

**Three findings produced.** 1 P2 (title/ID misnomer "deep"), 1 P2 (pot accounting), 1 P3 (single-framework citation for a teaching-rich node).

**Routing:** 2 Stream F content-fix items (S-effort, bundleable), 0 Stream G engine tickets, 0 POKER_THEORY.md §9 entries (no category-D divergence — line is solver-anchored). 0 HIGH-leverage bucket-teaching targets (jam is action-robust across archetypes; archetype-split not high-leverage here).

---

## Scope

- **Nodes audited:** 4 total (1 decision + 3 terminal)
- **Decision nodes:** `flop_root`
- **Terminal nodes:** `terminal_jam_4bp_correct`, `terminal_bet_50_4bp`, `terminal_checkback_4bp`
- **Frameworks referenced by this line:** `range_morphology`, `capped_range_check`
- **Heroes:** UTG open + 4bet vs BTN 3bet + 4bet-call. Scenario per setup comment (`lines.js:2185`): hero opens, BTN 3bets, UTG 4bets, BTN calls. effStack 100bb. Flop A♠K♦2♠ (two-tone, high-card).
- **Pot-type:** 4bp. Preflop pot derivation at 100bb effStack with standard 4bet sizing (UTG open 3bb → BTN 3bet ~10bb → UTG 4bet ~22-25bb → BTN call) = 0.5 SB + 1 BB + 22 UTG + 22 BTN ≈ **45.5bb**. Authored 55.0 is +~10bb. Possible source: author assumed a larger 4bet size (e.g., UTG 4bet to 27bb). Non-material to the teaching point but worth reconciling.
- **Out of scope:** engine EV values (covered by `engineAuthoredDrift.test.js` / RT-108 drift test); UI rendering.

---

## Cross-node observations

- **Line premise is solver-consensus.** Upper-surface artifact §13 found 10A / 0B / 0C / 0D across 10 sources (GTO Wizard 4BP corpus, Upswing, SplitSuit, Doug Polk, Jonathan Little, Matt Berkey, Ed Miller, Janda, Sklansky, Tipton). Jam-with-TPTK at low 4BP SPR is one of the least-controversial spots in modern NL theory.
- **"Deep" in the line ID is misleading.** "Deep" in poker convention means 200bb+ stacks (sometimes 150bb+). 100bb is standard; 4BP at 100bb has ~0.8 SPR which is **low-SPR**, not deep. The id `utg-vs-btn-4bp-deep` and title include "deep" twice — the learner who selects this line expecting a deep-stack lesson (overbet threats, multiple-street leverage, slow-play temptations) will instead find a low-SPR commit-or-fold spot.
- **No pot-accounting cascades** beyond the single node's pot value (which terminals all inherit). Pot is wrong but consistently wrong — the error doesn't propagate as drift across nodes.
- **Archetype leverage is low.** Jam is +EV across all villain archetypes per §12 of the upper-surface artifact. The only archetype-sensitivity is on BTN's 4bet-call range composition (tight nit keeps KK/AK; loose fish keeps more Ax). Either way, jam dominates.

---

## Node-by-node findings

### `flop_root` — flop · BTN checks on A♠K♦2♠

- **1. Setup:** Pot authored 55. Derivation at 100bb standard 4bet math (open 3, 3bet 10, 4bet 22, call delta 12): 0.5 + 1 + 22 × 2 = 45.5bb. Authored 55bb implies ~27bb 4bet sizing (which would be a larger-than-standard 4bet — typical is 22-26bb in 100bb cash). Non-material to the jam recommendation (SPR ~0.83 at 45.5 pot vs 100-22 = 78 stack vs ~0.7 at 55 pot vs 73 stack — both in MICRO-zone), but the absolute numbers don't reconcile cleanly.
- **2. Villain action:** ✓ BTN checks the 4BP flop. Solver-consistent — on Axx flops the 4-bettor (hero UTG) has range advantage and BTN (4bet-caller) checks close to 100% of range per GTO Wizard's 4BP IP corpus.
- **3. `correct` flag:** Jam correct ✓ — "low SPR + range concentration + value merge, villain must call with worse Ax" is the textbook teaching. Bet 50% false ✓ (27bb bet commits hero anyway without all-in threat — loses leverage). Check back false ✓ (slow-play leak; villain rarely improves on turn; wastes value-merge from BTN's Ax-and-worse-hands continuing range).
- **4. Frameworks:** `range_morphology`, `capped_range_check` — both apt. `capped_range_check` maps cleanly to BTN's post-4bet-call range being capped below hero's AA/KK/AK.
- **5. Copy:**
  - Prompt: ✓ clean.
  - Rationales: ✓ all three branches are well-reasoned. The Jam rationale is crisp ("fold equity + value merge"). The Bet 50% rationale names the structural leverage-loss precisely ("commits us anyway without the all-in threat").
  - `prose` section: ✓ "Ranges are extremely narrow" framing is accurate. Hero UTG 4bet range (QQ+/AK) + BTN 4bet-call range (QQ-KK/AK/AKs/AQs) matches GTO Wizard + Upswing range charts.
  - `why` section: ✓ range-concentration math is accurate. Hero has ALL AA/KK/AK combos (minus whatever BTN 3bets + calls 4bet with); BTN lacks AA and much of KK, has QQ + AK + occasional AQs.
- **6. Bucket-teaching readiness:** **NO.** Jam is action-robust across all villain archetypes (fish/reg/pro/nit) per upper-surface §12. Archetype doesn't flip the answer at any reasonable cut. Skip for Stream B/C widening.
- **7. External validation:** 3 queries issued. 3 A.

#### 7a. External-validation log for `flop_root`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "Jam with AK on AK2ss at 4BP low-SPR is solver-canonical" | "4-bet pot low SPR AK2ss flop jam AK top pair top kicker range concentration" | [GTO Wizard — C-Betting IP in 3-Bet Pots](https://blog.gtowizard.com/c-betting-ip-in-3-bet-pots/); [Upswing — How to Play Top Pair Top Kicker in Cash Games](https://upswingpoker.com/top-pair-top-kicker/); [SplitSuit — Folding Top Pair With AK?](https://www.splitsuit.com/folding-top-pair-with-ace-king) | "TPTK with SPR 3 or less → comfortable-taking-it-to-the-felt as pure default"; "AK flops top pair 29% of the time and is always top-pair-top-kicker on Axx/Kxx"; "TPTK at SPR 10+ getting it all-in is bad, at SPR 3 it's effectively the nuts." Jam is supported directly. | **A** |
| 2 | "BTN checks range-wide on Axx in 4BP after calling 4bet" | "4-bet pot IP villain checks flop A-high BTN caller" | [GTO Wizard — 4-Bet Pots OOP as the Preflop Caller](https://blog.gtowizard.com/4-bet-pots-oop-as-the-preflop-caller/); [GTO Wizard — IP 4-Betting in Deep-Stacked Cash Games](https://blog.gtowizard.com/ip-4-betting-in-deep-stacked-cash-games/) | "In 4-bet pots the preflop aggressor enjoys significant range advantage postflop"; Ax flops favor the aggressor whose range includes AA/KK/AK vs caller's QQ-lite-ax. BTN (caller) checks high-frequency on Axx. | **A** |
| 3 | "At low SPR, 50%-pot sizing is strictly worse than jam for value + fold-equity merge" | "4-bet pot 50 percent flop bet low SPR commit jam leverage" | [GTO Wizard — 4 Tips That Will Improve Your Postflop Results in 4-Bet Pots](https://upswingpoker.com/postflop-4-bet-pots-strategy/); [Upswing — 4-Bet Pots OOP article referenced by GTO Wizard](https://blog.gtowizard.com/4-bet-pots-oop-as-the-preflop-caller/) | "The 4-bettor's continuation bets are consistently small, with all configurations showing a preference for half-pot or less" — this is general 4BP; at deep stacks. At SPR < 1 the half-pot-bet commits hero anyway while losing the all-in's maximum-fold-equity + value-merge threat. Authored rationale is accurate. | **A** |

#### Findings on `flop_root`

- **L-flop_root-F1 — Line ID + title include "deep" but line is a low-SPR 4BP (not deep-stack)** (Dimension 1, 5, structural)
  - **Severity:** 2 (P2). Misleads learner at selection time about the teaching content.
  - **Observation:** `lines.js:2176 LINE_UTG_VS_BTN_4BP_DEEP`, `id: 'utg-vs-btn-4bp-deep'`, `title: 'UTG vs BTN · 4BP · A♠K♦2♠'`. Body of line is explicitly about **low-SPR 4BP play** (flop authored "SPR ~0.8", `tags: ['hu', '4bp', 'low-spr', 'high-card', 'ace-high']`). "Deep" in poker convention means 200bb+. At 100bb effStack, 4BP is low-SPR, not deep.
  - **Recommended fix:** Rename line ID + constant + title. Options:
    - Option A (simplest): drop "deep" → `utg-vs-btn-4bp-low-spr` / `LINE_UTG_VS_BTN_4BP_LOW_SPR` / `title: 'UTG vs BTN · 4BP Low-SPR · A♠K♦2♠'`.
    - Option B (specific hand): `utg-vs-btn-4bp-ak2ss` / `LINE_UTG_VS_BTN_4BP_AK2SS` / `title: 'UTG vs BTN · 4BP · AK2 two-tone'`.
  - **Effort:** S for the rename + nextId-reference check. Will require regenerating `engineAuthoredDrift.test.js` baseline.
  - **Risk:** Low — single line. Grep for `utg-vs-btn-4bp-deep` and `LINE_UTG_VS_BTN_4BP_DEEP` to catch references.
  - **Proposed backlog item:** `LSW-F-AK2-F1 — rename "deep" → "low-spr" (or hand-specific)`.

- **L-flop_root-F2 — Pot value drift (`pot: 55` but standard 4bet math gives ~45.5)** (Dimension 1)
  - **Severity:** 2 (P2). Same math-hygiene class as J85 / A1 findings.
  - **Observation:** `lines.js:2195 pot: 55.0`. Standard 100bb 4BP preflop pot = blinds + both-players-4bet-contribution. At UTG-open-3bb, BTN-3bet-10bb, UTG-4bet-22-26bb, BTN-call: pot ≈ 0.5 + 1 + 22 + 22 = 45.5 to 53.5bb depending on 4bet sizing. Authored 55 implies UTG-4bet-to-27bb which is on the large side but not unheard of. Non-material to the jam teaching but not cleanly derived.
  - **Recommended fix:** Either (a) update pot to 45.0 and document "standard 22bb 4bet size," or (b) keep pot at 55 and update copy to reference "UTG 4bet to 27" explicitly in the `prose` section so math reconciles. Recommend (a) for clarity.
  - **Effort:** S — single pot value + cascade through 3 terminals (all inherit flop_root pot value).
  - **Risk:** Terminal cascades. `engineAuthoredDrift.test.js` re-baseline needed.
  - **Proposed backlog item:** `LSW-F-AK2-F2 — 4BP pot reconciliation (55 → 45)`.

- **L-flop_root-F3 — Two frameworks cited for a node teaching three-plus concepts** (Dimension 4)
  - **Severity:** 1 (P3). Node teaches range-concentration, low-SPR commitment, AND value-merge-vs-capped-range — three distinct concepts — but cites two frameworks.
  - **Observation:** `lines.js:2197 frameworks: ['range_morphology', 'capped_range_check']`. Missing conceptual coverage on the SPR/low-SPR zone logic (arguably `board_tilt` or `spr_zone` if one exists; otherwise defer).
  - **Recommended fix:** Defer to framework-inventory review. If no `spr_zone` or equivalent exists, leave. Do NOT pad with ill-fitting frameworks.
  - **Effort:** S — framework inventory pending.
  - **Proposed backlog item:** `LSW-F-AK2-F3 — framework citation review` (LOW priority, pending inventory).

---

### Terminals — light walk

#### `terminal_jam_4bp_correct` — ✓ clean
Pot 55.0 matches `flop_root` pot (if F2 ships, this inherits the correction). Copy is strong: "Range concentration + low SPR = commit all chips with top of range on flop" is the line's headline takeaway in one sentence.

#### `terminal_bet_50_4bp` — ✓ clean
Pot 55.0. Copy crisply names the structural leverage-loss: "half-committed without plan."

#### `terminal_checkback_4bp` — ✓ clean
Pot 55.0. Copy: "With the top of range in 4BP, jam for value. Check-back wastes bet-call EV." Accurate.

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority | Category |
|---|---------|----------|--------|----------|----------|
| 1 | L-flop_root-F1 — rename line: "deep" misleads; should be "low-spr" or hand-specific | 2 | S | P2 | structural |
| 2 | L-flop_root-F2 — pot value drift (55 → 45) | 2 | S | P2 | B |
| 3 | L-flop_root-F3 — framework citation review | 1 | S | P3 | structural |

---

## Bucket-teaching queue (flows into Stream B / C)

For the 1 decision node on this line:

| Node | Hero combo (v1) | Proposed `bucketCandidates` | Proposed `correctByArchetype` split | Rationale |
|------|-----------------|------------------------------|--------------------------------------|-----------|
| `flop_root` | A?K? (hero's 4bet-range combo; suit-specific TBD) | `topPairGood, twoPair (AK hits both top-pair levels), overpair (AA/KK), air (rare in this range)` | jam:{all:T} | **NO high leverage** — jam is action-robust across all archetypes. Skip for Stream B/C widening. |

0 HIGH-leverage archetype-flip targets on this line. Widening would be spent on lower-leverage sizing-teaching (hero's 4bet-range composition across Ax / KK+ / QQ) rather than branch-correctness splits. Defer indefinitely.

---

## Category-D documented divergences

No category-D findings surfaced on this line. The line is solver-anchored; no POKER_THEORY.md §9 entry required.

---

## Accuracy verdict

**GREEN (light).** Zero P0/P1. Two P2 (naming + pot math). One P3 (framework). Line is ready to ship content-wise. The only material work is the line-rename decision (user-facing impact: students selecting "deep 4BP" expecting 200bb+ won't be misled).

**Bucket-teaching readiness:** Zero HIGH-leverage targets on this line. Recommend skipping LSW-B1 for this line OR authoring only the pinned-combo `heroView` without `correctByArchetype` (flat `correct: true` for jam across all archetypes).

**Strongest external validation:** Upper-surface artifact's 10A / 0B / 0C / 0D consensus across 10 sources. This spot is among the least-controversial in modern NL theory.

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

- [GTO Wizard — 4-Bet Pots OOP as the Preflop Caller](https://blog.gtowizard.com/4-bet-pots-oop-as-the-preflop-caller/)
- [GTO Wizard — IP 4-Betting in Deep-Stacked Cash Games](https://blog.gtowizard.com/ip-4-betting-in-deep-stacked-cash-games/)
- [GTO Wizard — OOP 4-Betting in Deep-Stacked Cash Games](https://blog.gtowizard.com/oop-4-betting-in-deep-stacked-cash-games/)
- [GTO Wizard — C-Betting IP in 3-Bet Pots](https://blog.gtowizard.com/c-betting-ip-in-3-bet-pots/)
- [GTO Wizard — Stack-to-pot ratio](https://blog.gtowizard.com/stack-to-pot-ratio/)
- [GTO Wizard — Navigating Range Disadvantage as the 3-Bettor](https://blog.gtowizard.com/navigating-range-disadvantage-as-the-3-bettor/)
- [Upswing — How to Play Top Pair Top Kicker in Cash Games](https://upswingpoker.com/top-pair-top-kicker/)
- [Upswing — 4 Tips That Will Improve Your Postflop Results in 4-Bet Pots](https://upswingpoker.com/postflop-4-bet-pots-strategy/)
- [Upswing — Stack-to-Pot Ratio: 3 Hands That Highlight This Crucial Poker Concept](https://upswingpoker.com/stack-to-pot-ratio-poker-hands/)
- [Upswing — Checking Flop With Top Pair: When Should You Do It?](https://upswingpoker.com/when-to-check-top-pair/)
- [SplitSuit — Folding Top Pair With AK? In 2025](https://www.splitsuit.com/folding-top-pair-with-ace-king)
- [SplitSuit — How Does Ace King Hit The Flop In 2026?](https://www.splitsuit.com/how-does-ace-king-hit-flops)
- [SplitSuit — Hero-Folding AK In A 3Bet Pot In 2025](https://www.splitsuit.com/hero-fold-ace-king-postflop)
