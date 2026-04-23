# Line Audit — 2026-04-22 — `sb-vs-bb-srp-oop-paired-k77` (formerly `co-vs-bb-srp-oop-paired-k77`)

**Line:** `sb-vs-bb-srp-oop-paired-k77` — SB vs BB · SRP · Paired K♠7♦7♣
**File:** `src/utils/postflopDrillContent/lines.js` (`LINE_SB_VS_BB_SRP_OOP_PAIRED` constant)
**Auditor:** Claude (main) + elevated-standard web-research validation (per 2026-04-22 project charter)
**Method:** Seven-dimension expert walkthrough. External-validation queries against GTO Wizard, Upswing, PokerCoaching, SplitSuit.
**Status:** Closed 2026-04-22 — LSW-F3 shipped all 4 findings (A1 position rename Option A CO→SB chosen, A2 turn sizing 50%→33% with pot cascade 18.1→15.1, A3 terminal pot reconciliation comments, A4 bundled with A1).

---

## Executive summary

**Verdict: YELLOW.** The line's *strategy content* is solver-aligned and externally confirmed — 33% cbet on paired K77 is canonical ([60.2% dominant solver frequency](https://www.getcoach.poker/articles/heads-up-poker-a-strategic-guide-to-winning-one-on-one/)), turn double-barrel on brick with TPTK is right, and river thin-value at 33% is correct. But the line has a **load-bearing position mismatch**: hero is declared as `CO` in `setup`, and CO is **unambiguously IP** over BB in postflop action order ([every source confirms](https://www.pokertube.com/article/who-goes-first-in-poker)); yet the flop prompt says "Hero acts OOP", the summary says "hero in CO but BB defended so hero is OOP" (nonsensical), and every decision node has `villainAction: null` (hero acts first) — which is an OOP action flow, not IP.

This is a genuine authoring error. The teaching content reads as OOP-hero (small cbet OOP with nut advantage on paired board is a real teaching spot), suggesting the author intended **SB vs BB** (where SB is OOP) but mistyped `CO`. The fix is a 2-line `setup` change (position: CO → SB; villain vs-field CO → SB) plus prompt cleanup, not a strategy rewrite. The `correct` flag on every decision is unaffected.

**Four findings produced.** 1 P1 (position mismatch), 3 P3 (turn-sizing canon, `villainAction: null` ambiguity, terminal reuse pot drift). No P0 blocker. Zero category-C engine findings.

**Routing:** 1 Stream F3 content-fix bundle (4 items, S-effort, all bundleable). Line is **blocked on F3 shipping before LSW-B2 widening** because the position mismatch would propagate wrong position-dependent content (`correctByArchetype` archetype labeling would carry forward the IP/OOP confusion). This is a stricter gate than A1 or A2.

---

## Scope

- **Nodes audited:** 8 total (3 decision + 5 terminal)
- **Decision nodes:** `flop_root`, `turn_brick`, `river_after_barrel`
- **Terminal nodes:** `terminal_thin_value_paired`, `terminal_checkback_paired`, `terminal_overbet_river_paired`, `terminal_oversized_paired`, `terminal_turn_check_paired`
- **Frameworks referenced:** `range_advantage`, `whiff_rate`, `range_morphology`
- **Heroes:** CO (declared) open vs BB flat, effStack 100bb, SRP, paired K-high rainbow board, brick-brick runout (2♥ / 4♦)
- **Pot-type:** SRP. Preflop pot = 2.5 (CO open) + 2.5 (BB call) + 0.5 (SB dead) = 5.5bb ✓ reconciles with `flop_root.pot = 5.5`.
- **Note on node count:** BACKLOG entry said "3 nodes (2 decision)". Actual content is 8 nodes (3 decision + 5 terminal). Discrepancy logged in BACKLOG update.
- **Out of scope:** engine EV values (RT-108 drift test); UI rendering (covered by surface audits).

---

## Cross-node observations

- **Strategy content is solver-aligned everywhere.** Cbet 33% on paired K77 is the canonical solver answer (60.2% frequency; check 32.9%; 67% 6.2% per HUNL 100bb solver). Turn small-bet-for-value on brick paired-board runouts is right. River 33% thin-value vs villain's pair-heavy range is textbook. Nothing in the `correct` flag tree requires revision.
- **Position labeling is consistently wrong.** The line is authored as an **OOP-hero line** (hero acts first every street per `villainAction: null`; flop prompt "Hero acts OOP"; summary "hero in CO but BB defended so hero is OOP"). But `setup.hero.position = 'CO'` and CO is unambiguously IP vs BB. The action flow IS internally self-consistent AS OOP-hero — so the fix is "correct the position declaration," not "rewrite the line."
- **The intended matchup is almost certainly SB vs BB.** SB is OOP vs BB (SB acts first postflop in HU between SB and BB when BTN is folded). The "paired-board small-cbet-OOP with nut advantage" teaching is a real and common SB vs BB spot. All of the line's copy content works for SB vs BB unchanged; the only edits are the `setup.hero.position` and `villains[0].vs` fields and one line of summary copy.
- **Two sub-frames could also fix this** (alternatives to consider if owner rejects SB): (a) flip the entire line to IP-hero CO by changing `villainAction: null` → `{ kind: 'check' }` on all 3 decision nodes and rewriting the "Hero acts OOP" prompt → "Villain checks to PFR. Hero acts IP." This preserves the `CO` label but rewrites the action flow. (b) Keep hero as CO, re-declare as OOP by claiming a non-standard table seating — this is strained and should not be pursued.
- **No pot-accounting cascades.** All 5 terminal pot values reconcile with their parent decision nodes' authored sizings.
- **Two terminals are reused across paths**, same A1/A2 pattern. `terminal_checkback_paired` reached from `flop_root → check` (pot 5.5) AND `river_after_barrel → check` (pot 18.1). `terminal_overbet_river_paired` reached from `turn_brick → overbet` (pot 9.1) AND `river_after_barrel → 75%` (pot 18.1). But the terminal pots are all declared as 18.1 for the river-shared terminals, which is **only correct for the river-parent path**. Flop-parent reaching `terminal_checkback_paired` with `pot: 18.1` is incorrect.
- **BB check-raise response is not modeled.** External research flagged that BB's optimal response to paired-flop small cbets involves "a lot of check-raising." Our line assumes BB calls the flop cbet (proceeds to `turn_brick`). This is a *scope* limitation, not a content error — the node we do model is modeled correctly. Flag for future widening (Stream B/E rolling polish) if check-raise response is desired.

---

## Node-by-node findings

### `flop_root` — flop · hero (declared CO, intended SB) acts first on K♠7♦7♣

- **1. Setup:** **✗ Position mismatch.** `setup.hero.position: 'CO'` + `villains[0] = { position: 'BB', action: 'call', vs: 'CO' }` declares CO vs BB. CO is IP vs BB postflop ([The Pokertube — Who Goes First in Poker](https://www.pokertube.com/article/who-goes-first-in-poker); all position-order sources). But `villainAction: null` + flop prompt "Hero acts OOP" treats hero as OOP. See L-setup-F1.
- **2. Villain action:** `villainAction: null` — hero acts first. Consistent with OOP-hero framing, inconsistent with declared CO position. See L-flop_root-F1.
- **3. `correct` flag:** Cbet 33% ✓ **canonical** ([solver 60.2% dominant choice on paired flops](https://www.getcoach.poker/articles/heads-up-poker-a-strategic-guide-to-winning-one-on-one/); [Upswing — Small Bets](https://upswingpoker.com/podcast/ep12-small-bets/)). Cbet 75% false ✓ (sizing leak — polar sizing on merged range). Check false ✓ (forfeits structural edge on highest-whiff-rate board class).
- **4. Frameworks:** `range_advantage` ✓, `whiff_rate` ✓ both apt.
- **5. Copy:**
  - Prompt: "Hero acts OOP. Cbet or check?" — **inconsistent with declared position.** See L-setup-F1.
  - Rationales: ✓ solid. "High-whiff paired boards want wide small cbets" is a precise, solver-backed claim.
  - `why` section: ✓ content accurate — BB has few 7x combos (suited only, rare), hero has all Kx + overpairs. Claim holds for SB vs BB *and* CO vs BB.
  - Summary copy: *"hero in CO but BB defended so hero is OOP on a paired board"* — **semantically null.** CO vs BB has a fixed IP/OOP assignment regardless of which player "defended." See L-setup-F1.
- **6. Bucket-teaching readiness:** PARTIAL. AKo on K77 is TPTK across every archetype — no clean flip on the bet/check binary. Sizing could flip at the edges (vs station: bet 50% to build pot bigger; vs nit: check back some frequency). Lower leverage than Q72r's river nodes.
- **7. External validation:** 2 queries. 1 A, 1 B.

#### 7a. External-validation log for `flop_root`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "33% cbet on K77 paired board is canonical" | paired board K77 cbet strategy PFR high whiff rate small sizing 33% BB defense SRP 100bb | [Upswing — When To Bet Small](https://upswingpoker.com/podcast/ep12-small-bets/); [GTO Wizard — Mechanics of C-Bet Sizing](https://blog.gtowizard.com/the-mechanics-of-c-bet-sizing/); [Getcoach — HU Strategic Guide](https://www.getcoach.poker/articles/heads-up-poker-a-strategic-guide-to-winning-one-on-one/); [SplitSuit — Paired Boards](https://www.splitsuit.com/poker-paired-boards-textures) | Solver on paired flops (HU 100bb): check 32.9%, bet 33% = **60.2%**, bet 67% = 6.2%. Paired flops have "range advantage without significant nut advantage" → 33% is the sweet spot. "BB's optimal response to a small c-bet on paired flops involves a lot of check-raising." | **A** (cbet sizing confirmed); **informational** (BB check-raise branch not modeled — scope limitation, not content error) |
| 2 | "CO is OOP vs BB in SRP postflop" | CO vs BB position single raised pot in position out of position postflop who acts first | [The Pokertube — Who Goes First in Poker](https://www.pokertube.com/article/who-goes-first-in-poker); [Pokerdeals — Postflop Poker](https://pokerdeals.com/strategy/getting-your-head-around-postflop-poker); [New Game Network — Poker Positions](https://www.newgamenetwork.com/casinos/poker/positions/) | "In CO vs BB SRP postflop, action starts left of button and moves clockwise, so button acts last on flop/turn/river. **BB acts first postflop. CO is IP.**" No source supports CO as OOP vs BB in any standard HU or 6max ruleset. | **B** (our line is wrong — CO is IP, not OOP) |

#### Findings on `flop_root`

- **L-setup-F1 — Position mismatch: hero declared CO (IP) but line action flow + copy treat hero as OOP** (Dimension 1, 5, Cat B)
  - **Severity:** 3 (P1). Line-wide semantic error. Student who understands position will see the inconsistency and lose trust in the content; student who doesn't will internalize the wrong position-behavior mapping. Multiple surfaces of the mismatch:
    - `lines.js:1882` `setup.hero.position: 'CO'`
    - `lines.js:1883` `villains[0].vs: 'CO'`
    - `lines.js:1876–1879` summary: *"hero in CO but BB defended so hero is OOP"* (semantically null — "BB defended" doesn't flip position)
    - `lines.js:1880` tags: `['hu', 'srp', 'oop', 'paired', 'dry']` — `'oop'` tag inconsistent with CO
    - `lines.js:1936` prompt: *"Hero acts OOP. Cbet or check?"*
    - `lines.js:1894` `villainAction: null` (hero acts first — OOP action order)
  - **Observation:** The line is *internally self-consistent* as an OOP-hero line, but the position declaration is wrong. Modern solver resources [unanimously describe](https://www.pokertube.com/article/who-goes-first-in-poker) CO as IP over BB in HU-style SRPs: postflop action starts to the left of the button and moves clockwise; BB acts first because BB is immediately left of SB (who folded preflop in this HU snapshot).
  - **Recommended fix:** Two equally valid options:

    **Option A (RECOMMENDED) — change hero position to SB.** SB is OOP vs BB postflop (SB acts first in SB vs BB HU when BB calls an SB open). Edit:
    - `setup.hero.position`: `'CO'` → `'SB'`
    - `villains[0].vs`: `'CO'` → `'SB'`
    - Line id: `co-vs-bb-srp-oop-paired-k77` → `sb-vs-bb-srp-oop-paired-k77`
    - Constant name: `LINE_CO_VS_BB_SRP_OOP_PAIRED` → `LINE_SB_VS_BB_SRP_OOP_PAIRED`
    - Title: `CO vs BB · SRP · Paired K♠7♦7♣` → `SB vs BB · SRP · Paired K♠7♦7♣`
    - Summary: `"Single-raised pot, hero in CO but BB defended so hero is OOP on a paired board."` → `"Single-raised pot, SB open and BB defended. SB is OOP on a paired board — classic small-cbet teaching spot."`
    - Other copy: no change needed (all rationales/why sections are position-content-agnostic; they reference "hero's range" and "BB's range" not CO/SB specifically).
    - `engineAuthoredDrift` snapshot: regenerate (node-id path changes).
    - Drift-test key rebuilds if the snapshot uses line-id.

    **Option B — keep CO but flip action flow to IP-hero.** Edit:
    - `villainAction` on all 3 decision nodes: `null` → `{ kind: 'check' }`
    - Flop prompt: `"Hero acts OOP. Cbet or check?"` → `"Villain checks. Hero acts IP. Cbet or check?"`
    - Tags: drop `'oop'`, add `'ip'`
    - Summary: rewrite to `"Single-raised pot, hero CO acts IP after BB checks on paired board."`
    - No id/constant rename.
    - Drift snapshot unchanged.

  - **Recommendation:** Option A. Reason: paired-board small-cbet teaching is slightly higher-leverage from the OOP position (OOP cbet has less equity realization to fall back on, so correct sizing matters more); and the existing `why` section's claim of "Nut advantage clearly hero" is stronger for a tighter opener (SB) than a wider opener (CO). Option B is mechanical but loses the pedagogical advantage of the OOP framing that the original author evidently intended.
  - **Effort:** S — ~6 edits in lines.js + id rename + drift snapshot regeneration.
  - **Risk:** Low-medium. The id change will propagate to `engineAuthoredDrift.test.js` baseline (needs regeneration via `UPDATE_DRILL_DRIFT_SNAPSHOT=true`) and any test that hard-references the line id (grep `co-vs-bb-srp-oop-paired-k77` — one match in `src/` per normal library usage, likely nowhere else).
  - **Proposed backlog item:** `LSW-F3-A1 — K77 position mismatch: re-label hero CO → SB`.

- **L-flop_root-F1 — `villainAction: null` is semantically ambiguous** (Dimension 1, tied to L-setup-F1)
  - **Severity:** 1 (P3). If hero is OOP (as authored action flow implies and Option A fixes), `villainAction: null` is fine — there is no villain action yet to respond to. If hero is IP (Option B fix), `villainAction` should be `{ kind: 'check' }` to explicitly represent BB's check-to-PFR. Ships with whichever option is chosen in L-setup-F1.
  - **Recommended fix:** Bundled with L-setup-F1 Option A (no edit needed) or Option B (change to `{ kind: 'check' }`).
  - **Effort:** Zero (Option A) or S (Option B, 3 edits).
  - **Proposed backlog item:** Bundled with LSW-F3-A1.

---

### `turn_brick` — turn · 2♥ brick after flop cbet called

- **1. Setup:** ✓ pot 9.1 reconciles with flop 5.5 + hero cbet 1.8 + BB call 1.8 = 9.1.
- **2. Villain action:** `villainAction: null` — hero acts first. Consistent with OOP-hero framing (tied to L-setup-F1).
- **3. `correct` flag:** Bet 50% ✓ correct (continuing value with TPTK on low-SPR paired board, charging middle pairs and weak Kx). Check false ✓. Overbet false ✓.
- **4. Frameworks:** `range_morphology` ✓.
- **5. Copy:**
  - Prompt: ✓ clean
  - Rationales: ✓ solid. "Charge villain's middle pairs and weak Kx" is concrete and specific.
  - `why` section: ✓ clean.
- **6. Bucket-teaching readiness:** PARTIAL. AKo continues to bet across archetypes. Minor sizing-flip potential (smaller vs station, larger vs nit for protection) but low leverage.
- **7. External validation:** 1 query. 1 A (with sizing nuance).

#### 7a. External-validation log for `turn_brick`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | "50% pot turn barrel on paired-board brick with TPTK is correct" | turn double barrel paired K77 flop brick 2 IP PFR continuation bet solver frequency small sizing | [Upswing — Turn Barreling on Bricks](https://upswingpoker.com/c-bet-turn-barreling-bricks/); [GTO Wizard — Attacking Paired Flops](https://blog.gtowizard.com/attacking-paired-flops-from-the-bb/); [Upswing — Paired Boards as Preflop Raiser](https://upswingpoker.com/paired-flops-preflop-raiser/) | "Paired flops are bet significantly more often than unpaired flops, however, they tend to only be bet for small sizing. This is mostly due to preflop equity advantage but reduced nut advantage from trips being in both players' ranges." Solver continues value hands on brick turns; **small sizing dominant.** 50% is **upper-end of acceptable**; 33% would be more canonical. | **A** (bet correct, small bet is right frame); **sizing nit** — 50% is defensible but 33% more canonical on paired textures. |

#### Findings on `turn_brick`

- **L-turn_brick-F1 — 50% turn sizing is upper-end of paired-board canon; 33% would match solver** (Dimension 5)
  - **Severity:** 1 (P3). Not wrong — 50% is acceptable. But if the line is meant to *teach* paired-board sizing habits, 33% is the textbook-default for continued small sizing on paired textures (the same principle that drove the flop 33%).
  - **Observation:** `lines.js:1958` — correct branch is `Bet 50% pot`. Canon for paired-board small-sizing teaching is 33% continuing sizing.
  - **Recommended fix (optional, defer to owner):** Change 50% → 33%. Update the rationale to explicitly tie turn sizing back to flop sizing rationale ("Same small-sizing logic as flop — paired board's reduced nut advantage means we don't want to price out the middle pairs we're ahead of"). OR keep 50% with an explicit rationale sentence explaining the sizing step-up.
  - **Effort:** S either way.
  - **Proposed backlog item:** `LSW-F3-A2 — turn_brick sizing canon choice` (LOW priority, owner preference).

---

### `river_after_barrel` — river · 4♦ brick after turn barrel called

- **1. Setup:** ✓ pot 18.1 reconciles with turn 9.1 + hero turn bet 4.5 + BB call 4.5 = 18.1.
- **2. Villain action:** `villainAction: null` — tied to L-setup-F1.
- **3. `correct` flag:** Bet 33% thin value ✓ canonical (targets weak Kx and middle pocket pairs that call small). Check false ✓. Bet 75% false ✓ (folds out weak pairs we beat).
- **4. Frameworks:** `range_morphology` ✓.
- **5. Copy:**
  - Prompt: ✓ clean
  - Rationales: ✓ solid and concrete.
  - `prose` section: ✓ clean.
- **6. Bucket-teaching readiness:** HIGH LEVERAGE. Archetype flip:
  - vs FISH / STATION: bet 25-33%, wider thin-value range (stations call with any pair)
  - vs REG: 33% as authored
  - vs NIT: check back (tight calling range condensed to Kx, against which AKo only chops or wins thin)
- **7. External validation:** 0 new queries — covered by Q72r A2's thin-value-vs-condensed-range validation (same principle applies).

#### 7a. External-validation log for `river_after_barrel`

Inherits from [LSW-A2 audit `river_after_barrel` query](./btn-vs-bb-srp-ip-dry-q72r.md#7a-external-validation-log-for-river_after_barrel) — thin-value 33% with TPTK against condensed pair-heavy range is canonical ([Somuchpoker Thin Value](https://somuchpoker.com/poker-term/mastering-thin-value-bets-poker-expert-guide); [PokerListings Thin Value Spots](https://www.pokerlistings.com/strategy/top-5-thin-value-spots)). Same conclusion on K77 brick runout.

#### Findings on `river_after_barrel`

- ✓ **No new findings.** Node is clean on the strategy dimension; the sole pending issue is tied to L-setup-F1 (position mismatch propagates `villainAction: null` semantics).

---

### Terminals — light walk

- **`terminal_thin_value_paired`** — pot 18.1. Reached only from `river_after_barrel → 33%`. ✓ clean.
- **`terminal_checkback_paired`** — pot 18.1. Reached from `flop_root → check` AND `river_after_barrel → check`. **Flop-parent reach is incorrect pot value:** flop-parent pot is 5.5, river-parent pot is 18.1. The terminal declares 18.1 which is only right for the river path. See L-terminals-F1.
- **`terminal_overbet_river_paired`** — pot 18.1. Reached from `turn_brick → overbet` (turn-parent pot 9.1) AND `river_after_barrel → 75%` (river-parent pot 18.1). Same pot-drift issue. Flag as part of L-terminals-F1.
- **`terminal_oversized_paired`** — pot 5.5. Reached only from `flop_root → cbet 75%`. ✓ clean.
- **`terminal_turn_check_paired`** — pot 9.1. Reached only from `turn_brick → check`. ✓ clean.

#### Findings on terminals

- **L-terminals-F1 — `terminal_checkback_paired` + `terminal_overbet_river_paired` pot values only match one of their two parent paths** (Dimension 1, structural)
  - **Severity:** 1 (P3). A student who folds to the flop cbet (falling through `flop_root → check`) then reads "pot 18.1" on the terminal will see a pot value that doesn't match their decision. Low impact because the terminal copy is path-agnostic ("Missed value. Villain checks = weak; bet cleans up the pot.").
  - **Observation:** `lines.js:1984` and `lines.js:1985`. `terminal_checkback_paired` has `pot: 18.1` from the river parent; `flop_root → check → terminal_checkback_paired` arrives with pot 5.5. Similarly for `terminal_overbet_river_paired`.
  - **Recommended fix:** Either (a) split into `terminal_flop_checkback_paired` + `terminal_river_checkback_paired` with correct pot values and path-specific copy; or (b) keep shared terminals but omit the `pot` field if schema permits nullability, or set pot to the most-common-reach-path value and add a comment acknowledging the multi-path drift. Same pattern as A1's `terminal_river_overbet_spew` handling — per schema constraints pot is required, so Option (b) with comment is lightest.
  - **Effort:** S — 2 numeric or structural edits.
  - **Proposed backlog item:** `LSW-F3-A3 — K77 terminal pot reconciliation`.

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority | Category |
|---|---------|----------|--------|----------|----------|
| 1 | L-setup-F1 — Position mismatch: re-label hero CO → SB (Option A recommended) | 3 | S | **P1** | B |
| 2 | L-turn_brick-F1 — 50% turn sizing → 33% canonical | 1 | S | P3 | B (owner preference) |
| 3 | L-terminals-F1 — terminal pot reconciliation | 1 | S | P3 | structural |
| 4 | L-flop_root-F1 — `villainAction: null` ambiguity | 1 | S | P3 | structural (bundled with F1) |

**One P1 finding.** Unlike A2 (which was GREEN-light and could proceed to widening without F2), **K77 is YELLOW and requires F3 shipping before LSW-B1/B2 widening** because the position mismatch would pollute any `correctByArchetype` authoring with wrong position-dependent archetype mapping (a "fish OOP" defense is different from a "fish IP" defense; the archetype split would have to be re-authored after fixing).

---

## Bucket-teaching queue (flows into Stream B / C)

For the 3 decision nodes:

| Node | Hero combo | Proposed `bucketCandidates` | Proposed `correctByArchetype` split | Leverage |
|------|------------|------------------------------|--------------------------------------|----------|
| `flop_root` | A♥K♦ (TPTK, authored) | `topPairGood, overpair, middlePair, weakDraw, air` | cbet33%:{all:T} — **no clean flip on bet/check** | PARTIAL. Archetype leverage is on sizing, not bet/check binary. Lower priority than Q72r's river nodes. |
| `turn_brick` | A♥K♦ | `topPairGood, overpair, middlePair, weakDraw, air` | bet:{all:T}; sizing flip — 33% vs station, 50% vs reg, 60% vs nit | PARTIAL. Sizing teaching candidate. |
| `river_after_barrel` | A♥K♦ | `topPairGood, twoPair, trips, overpair, weakKicker, air` | bet33%:{fish:T,reg:T}; check:{nit:T}; sizing widens vs station to 25%, condenses vs nit (check back entirely) | **HIGH LEVERAGE.** Same archetype-flip pattern as Q72r's `river_after_barrel` — thin-value-sizing-by-archetype. |

**One HIGH-leverage target** (`river_after_barrel`, thin-value archetype flip). Two PARTIAL (sizing-only flips). Less leveraged than Q72r overall (only 1 HIGH vs Q72r's 3).

**Pre-widening gate:** All of the above is blocked on L-setup-F1 shipping first. Once position is fixed, Stream B2 can author archetype splits cleanly.

---

## Category-C engine findings (deferred pending solver access)

**None.** Engine behavior for AKo on K77 paired board maps cleanly to `topPairGood` bucket with canonical equity. No obvious engine-prior miscalibration surfaced.

---

## Documented divergence (for POKER_THEORY.md §9)

**None.** The line does not introduce a live-pool-vs-solver divergence (unlike A1's donk premise or A2's BB flat range). The authored strategy is pure solver canon; the only error is a declarative/setup error (position), not a content-vs-solver intentional disagreement.

---

## Accuracy verdict

**YELLOW.** One P1 finding (position mismatch) blocks Stream B widening on this line until F3 ships. Three P3 findings are optional polish. The underlying *strategy teaching* is clean; this is a setup/framing error, not a content error.

**Specifically:** Fixing L-setup-F1 via Option A (re-label CO → SB) preserves all the teaching content and unblocks widening with minimal effort. This is a ~15-minute S-effort change that drops the line back to GREEN.

---

## Review sign-off

- **Drafted by:** Claude (main, session 2026-04-22)
- **Reviewed by:** [owner pending]
- **Closed:** [pending — tied to LSW-F3 ship decision]

---

## Change log

- 2026-04-22 — Draft (external-validation methodology applied per 2026-04-22 project charter standard).

---

## Sources (web research citations)

- [Upswing — When To Bet Small](https://upswingpoker.com/podcast/ep12-small-bets/)
- [Upswing — Turn Barreling on Bricks](https://upswingpoker.com/c-bet-turn-barreling-bricks/)
- [Upswing — Paired Boards as Preflop Raiser](https://upswingpoker.com/paired-flops-preflop-raiser/)
- [GTO Wizard — The Mechanics of C-Bet Sizing](https://blog.gtowizard.com/the-mechanics-of-c-bet-sizing/)
- [GTO Wizard — Defending vs BB Check-Raise on Paired Flops](https://blog.gtowizard.com/defending-vs-bb-check-raise-on-paired-flops/)
- [GTO Wizard — Attacking Paired Flops From the BB](https://blog.gtowizard.com/attacking-paired-flops-from-the-bb/)
- [SplitSuit — Paired Boards & Textures](https://www.splitsuit.com/poker-paired-boards-textures)
- [Getcoach — Heads-Up Poker Strategic Guide](https://www.getcoach.poker/articles/heads-up-poker-a-strategic-guide-to-winning-one-on-one/)
- [The Pokertube — Who Goes First in Poker](https://www.pokertube.com/article/who-goes-first-in-poker)
- [Pokerdeals — Postflop Poker](https://pokerdeals.com/strategy/getting-your-head-around-postflop-poker)
- [New Game Network — Poker Positions](https://www.newgamenetwork.com/casinos/poker/positions/)
