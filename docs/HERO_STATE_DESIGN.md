# Hero State Primitive — Design

> **Status:** Draft v0.1 (2026-05-02). Owner-initiated, not yet ratified into a workstream.
> **Purpose:** Defines a hero-perspective synthesis primitive that classifies "where I am, what's my plan" into canonical archetypes and exposes plan-by-branch articulation. Consumed by the live advisor, PRF playbook cards, HandReplay review, and the SCF leak detector.

---

## 1. Motivation

The codebase computes a lot about a decision point — equity vs villain range, branch EVs, polarization, SPR zone, board texture, range/nut advantage — but those quantities are scattered across `rangeEngine`, `gameTreeEvaluator`, `villainProfileBuilder`, and `decisionAccumulator`. None of them produce a **hero-perspective narrative**: a coherent "here's a really good way to think about this position" frame with conditional branch plans.

Three reasons to build this as a **primitive** rather than a presentation layer:

1. **Reuse.** The same frame should drive live in-game annotations, pre-session refresher cards, post-hand replay, and the SCF (Self-Coach Foundation) leak detector. A presentation-only wrapper would force every consumer to roll its own composition logic and they'd drift.
2. **Skill-assessment baseline.** Per the skill-assessment-as-core-competency stance, hero's actual play needs to be measured against a canonical reference. Without a primitive, every consumer rolls its own reference.
3. **Composition with existing primitives.** HeroState rides on top of the existing game-state machine — at each decision node, the hero has a frame derived from the same inputs the advisor uses. No new transition graph required; we add a perspective node on the existing graph.

## 2. Position in the architecture

```
Game state (street, actions, pot, stacks, board)
    │
    ├── rangeEngine ──────────→ hero range, villain range
    │
    ├── villainProfileBuilder ─→ villain range shape, tendency posterior
    │
    ├── gameTreeEvaluator ─────→ branch EVs, sizing curves
    │
    └── HeroState (this doc) ──→ archetype classification
                                  hand-in-range context
                                  equity decomposition by range part
                                  plan tree (primary + branches)
                                  sizing rationale
                                  tendency-adjusted deltas
                                  narrative (rendered)
                                  │
                                  ├──→ Live advisor (OnlineView seat annotation)
                                  ├──→ PRF playbook cards (pre-session)
                                  ├──→ HandReplay review (post-hand)
                                  └──→ SCF leak detector (canonical baseline)
```

HeroState is **derived**, not stored. Re-derive on every state transition (street advance, opponent action, position change). Cache by decision-key hash if perf demands.

## 3. Data shape (strawman)

```js
HeroState = {
  // ── Identity ──────────────────────────────────────────────
  archetypeId: string,            // e.g., "FLOP_3BP_HU_OOP_CBET"
  archetypeFamily: enum,          // PREFLOP_OPEN | PREFLOP_VS_OPEN | FLOP_HU_CBET | ...

  // ── Coarse axes (situation) ───────────────────────────────
  situation: {
    street: 'preflop' | 'flop' | 'turn' | 'river',
    actionContext: enum,          // OPEN | VS_OPEN | 3BET | VS_3BET | SQUEEZE | VS_SQUEEZE
                                  // | CBET | VS_CBET | BARREL | VS_BARREL | PROBE | DONK | VS_DONK
    positionClass: enum,          // EP | MP | HJ | CO | BTN | SB | BB
    inPosition: boolean | null,   // null preflop until closing action resolved
    playersRemaining: number,
    sprZone: enum,                // MICRO | LOW | MEDIUM | HIGH | DEEP
    pot: number,
    effStack: number,
    rake: { pct, cap, noFlopNoDrop } | null,
  },

  // ── Fine axes (hand-in-context) ───────────────────────────
  handContext: {
    hand: [card, card],
    handClass: enum,              // TOP_OF_RANGE | MIDDLE_OF_RANGE | BOTTOM | DRAW | AIR | BLOCKER
    handStrength: enum,           // PREMIUM | OVERPAIR | TPTK | TP_WEAK_KICKER
                                  // | MIDDLE_PAIR | UNDERPAIR | DRAW_STRONG | DRAW_WEAK
                                  // | AIR_BLOCKER | AIR
    rangeAdvantage: 'hero' | 'villain' | 'neutral',
    nutAdvantage: 'hero' | 'villain' | 'neutral',
    boardTexture: enum | null,    // DRY | DYNAMIC | PAIRED | MONOTONE | TWO_TONE | CONNECTED
                                  // | HIGH | LOW | ACE_HIGH (preflop = null)
  },

  // ── Equity decomposition ──────────────────────────────────
  equity: {
    overall: number,              // hero hand vs full villain range
    vsRangeParts: {
      vsValue: number,            // hero hand vs villain's value combos
      vsBluff: number,            // ... vs bluffs / capped floats
      vsDraw: number,             // ... vs draws
      vsAir: number,              // ... vs air
    },
    realization: number,          // R(equity) given position, SPR, hand class
    realizedEquity: number,       // overall * realization
  },

  // ── Plan tree ─────────────────────────────────────────────
  plan: {
    primary: {
      action: enum,               // FOLD | CHECK | CALL | BET | RAISE
      sizing: number | null,      // bb (preflop) or % of pot (postflop)
      sizingRationale: string,    // "thin value vs capped range, charge draws"
      ev: number,                 // EV of primary in bb
    },
    branches: [
      {
        trigger: string,          // "if villain raises >2.5x"
        action: enum,
        sizing: number | null,
        rationale: string,
        ev: number,
      },
      // ...
    ],
    rangeConfig: {
      tight: { hands: [...], bias: 'value-heavy', triggers: [...] },
      wide: { hands: [...], bias: 'balanced', triggers: [...] },
    } | null,
  },

  // ── Tendency-adjusted deltas ──────────────────────────────
  adjustments: [
    {
      condition: 'villain is calling station',
      delta: { sizingMultiplier: 1.3, polarize: true, bluffFreq: 0.3 },
      rationale: 'inelastic to size, bluffs lose EV, value bet thinner',
    },
    // ...
  ],

  // ── Narrative (rendered template output) ──────────────────
  narrative: {
    headline: string,             // "AJo on HJ — standard open"
    body: string,                 // multi-paragraph, references computed values
    branchSummary: string,        // "If called from BTN, tighten on flop. If 3bet from blinds, fold."
  },
}
```

**Open question:** should `archetypeId` be a stable enum (authorable templates) or a derived hash (more flexible)? Lean enum — narratives need stable IDs to bind templates to.

## 4. Shape taxonomy

### 4.1 Authorship principle

Each archetype is a **parametric narrative template** that interpolates computed values from the `HeroState` object. The template is hand-authored once per archetype. Adjustments stack on top via the `adjustments` array, **not** by spawning new archetypes. This caps the catalog at ~25 archetypes (humanly authorable) instead of cartesian-exploding.

If two templates only differ in tendency response, they share an archetype with two adjustment entries.
If two templates differ in plan structure (different action set, different branches), they're different archetypes.

### 4.2 Preflop archetypes (v1: 8)

| ID | Trigger | Coarse axes |
|---|---|---|
| `PF_OPEN_RFI` | Hero opens unopened pot | OPEN, position=EP/MP/HJ/CO/BTN |
| `PF_VS_OPEN_BB` | Hero in BB facing single open | VS_OPEN, BB |
| `PF_VS_OPEN_SB` | Hero in SB facing single open | VS_OPEN, SB |
| `PF_VS_OPEN_IP` | Hero IP cold-call vs single open | VS_OPEN, IP, position≥CO |
| `PF_3BET` | Hero 3bets a single open | 3BET |
| `PF_SQUEEZE` | Hero 3bets open + caller(s) | SQUEEZE |
| `PF_VS_3BET` | Hero opened, faces 3bet | VS_3BET |
| `PF_LIMP_NAV` | Hero acts after 1+ limpers | LIMP_NAV |

### 4.3 Flop archetypes (v1: 10)

| ID | Trigger | Coarse axes |
|---|---|---|
| `FLOP_SRP_HU_IP_CBET` | Single-raised pot, HU, IP, hero cbet decision | CBET, IP, SRP |
| `FLOP_SRP_HU_OOP_CBET` | SRP HU OOP cbet decision | CBET, OOP, SRP |
| `FLOP_SRP_HU_IP_VS_CBET` | SRP HU IP facing cbet | VS_CBET, IP, SRP |
| `FLOP_SRP_HU_OOP_VS_CBET` | SRP HU OOP facing cbet | VS_CBET, OOP, SRP |
| `FLOP_3BP_HU_IP_CBET` | 3bet pot HU IP cbet | CBET, IP, 3BP |
| `FLOP_3BP_HU_OOP_CBET` | 3bet pot HU OOP cbet | CBET, OOP, 3BP |
| `FLOP_3BP_VS_CBET_IP` | 3bet pot facing cbet IP | VS_CBET, IP, 3BP |
| `FLOP_3BP_VS_CBET_OOP` | 3bet pot facing cbet OOP | VS_CBET, OOP, 3BP |
| `FLOP_MULTIWAY` | 3+ players to flop | MULTIWAY |
| `FLOP_VS_DONK` | Hero faces a donk lead | VS_DONK |

### 4.3.1 classifyArchetype implementation policy (WS-141 plan-mode resolutions, 2026-05-03)

`src/utils/heroState/classifyArchetype.js` (shipped 2026-05-03 by WS-141) implements the §4.2–§4.3 catalog as a pure function. Two ambiguities surfaced when implementing the catalog; both resolved by founder via AskUserQuestion.

**potType source.** The `Situation` typedef (`src/utils/heroState/types.js`) gained an additive `potType: 'SRP' | '3BP' | '4BP' | 'LIMPED' | null` field. classifier reads pot structure from `axes.potType` rather than re-deriving it from action history. WS-142 orchestrator computes potType from preflop action sequence and writes it onto the Situation object.

**4BP fallback.** The flop catalog has SRP and 3BP archetypes but no dedicated 4BP archetypes. 4BP situations route to the same archetype IDs as 3BP for narrative-template purposes — the lower-SPR mechanical adjustments come from `sprZone` in the Plan, not from a separate archetype family. So a 4-bet pot CBET IP returns `FLOP_3BP_HU_IP_CBET`, etc.

**Closest-match fallback policy** (documented for WS-138/139 narrative authors so they understand which inputs map to their templates):
- `VS_SQUEEZE` preflop → `PF_VS_3BET` (no dedicated VS_SQUEEZE archetype in v1; both share "hero opened, faces re-raise from a capped opening range")
- `OPEN` from SB or BB → `PF_OPEN_RFI` (rare in 9-handed; single fallback satisfies "always return a valid id" accept criterion)
- Other postflop actionContexts on flop (`BARREL` is structurally a turn cbet — shouldn't appear; `PROBE` and bare `DONK` are rare) → CBET-equivalent archetype with the same `(potType, inPosition)` axes
- `playersRemaining >= 3` postflop → `FLOP_MULTIWAY` overrides all other axes (per §7.4: HU range-vs-range reasoning breaks multiway)
- Postflop actionContext that leaks into preflop (callsite bug) → `PF_OPEN_RFI` defensive fallback

### 4.4 Turn archetypes (v2: 12)

Authored 2026-05-22 by WS-151 (HSP-A3). Mirrors the §4.3 flop catalog's discipline: **pot type (SRP / 3BP) is a primary axis** on the continuation lines, because 3-bet-pot turns run at much lower SPR with tighter, more polarized ranges than single-raised-pot turns — a genuinely different decision, the same reason the flop split SRP from 3BP. Founder ratified the pot-type split (vs a flatter 8-entry action+position-only catalog) via AskUserQuestion 2026-05-22.

| ID | Trigger | Coarse axes |
|---|---|---|
| `TURN_SRP_BARREL_IP` | SRP, hero cbet flop, second-barrel decision turn IP | BARREL, IP, SRP |
| `TURN_SRP_BARREL_OOP` | SRP, hero cbet flop, barrel turn OOP | BARREL, OOP, SRP |
| `TURN_SRP_VS_BARREL_IP` | SRP, hero called flop, facing turn barrel IP | VS_BARREL, IP, SRP |
| `TURN_SRP_VS_BARREL_OOP` | SRP, hero called flop, facing turn barrel OOP | VS_BARREL, OOP, SRP |
| `TURN_3BP_BARREL_IP` | 3BP, hero cbet flop, barrel turn IP | BARREL, IP, 3BP |
| `TURN_3BP_BARREL_OOP` | 3BP, hero cbet flop, barrel turn OOP | BARREL, OOP, 3BP |
| `TURN_3BP_VS_BARREL_IP` | 3BP, hero called flop, facing turn barrel IP | VS_BARREL, IP, 3BP |
| `TURN_3BP_VS_BARREL_OOP` | 3BP, hero called flop, facing turn barrel OOP | VS_BARREL, OOP, 3BP |
| `TURN_PROBE` | Flop checked through, hero leads turn OOP into capped range | PROBE, OOP |
| `TURN_DELAYED_CBET` | Hero checked back flop IP, bets turn | CBET, IP (delayed) |
| `TURN_MULTIWAY` | 3+ players to the turn | MULTIWAY |
| `TURN_VS_DONK` | Hero (prior-street aggressor) faces a turn donk lead | VS_DONK |

Families (8, mirroring the flop's family grouping): `TURN_SRP_BARREL`, `TURN_SRP_VS_BARREL`, `TURN_3BP_BARREL`, `TURN_3BP_VS_BARREL`, `TURN_PROBE`, `TURN_DELAYED_CBET`, `TURN_MULTIWAY`, `TURN_VS_DONK`.

**Check-raise is a branch, not an archetype** — facing a barrel, the raise/check-raise line lives inside the relevant `VS_BARREL` template's branch summary (as on the flop, where there is no standalone `FLOP_CHECK_RAISE`). This keeps the catalog routed on the same `(potType, action, position)` axes as the flop.

#### 4.4.1 Turn implementation policy (WS-151, 2026-05-22)

**ID format.** Position is the suffix throughout (`TURN_SRP_BARREL_IP`), unlike the flop catalog's minor internal inconsistency (`FLOP_SRP_HU_IP_CBET` vs `FLOP_3BP_VS_CBET_IP`). The turn IDs are uniform; no `HU` token (multiway is its own archetype, so all barrel/vs-barrel IDs are heads-up by construction).

**Scope boundary — this ticket authored the taxonomy table + the 12 narrative templates only** (`docs/design/hero-state-templates/turn/*.md`). The following land with **WS-153** (classifyArchetype turn/river extension), deliberately deferred so the test suite stays green:

- `ARCHETYPE_IDS` + `ARCHETYPE_FAMILIES` in `src/utils/heroState/types.js` are **not yet extended** with the turn entries. Adding them now would fail `classifyArchetype.test.js` (`reached.size === ARCHETYPE_IDS.length` — every ID must be reachable, but the classifier still throws `NotImplementedError` for turn) and `loadTemplates.test.js` ("loads all 18").
- `loadTemplates.js`'s `import.meta.glob` matches `{preflop,flop}/*.md` only — the new `turn/` directory is intentionally invisible to the loader until WS-153 extends the glob and the enum together.
- `classifyArchetype.js` continues to throw for turn states (design §4.4 was a v2 stub; WS-153 implements the routing using the `(potType, actionContext, inPosition, playersRemaining)` axes above, with the same closest-match fallback discipline as §4.3.1).

**4BP fallback (inherited from §4.3.1).** 4-bet-pot turns route to the `3BP` archetype IDs; lower-SPR mechanics come from `sprZone` in the Plan, not from a separate 4BP family.

**First-principles guard (binding).** Archetype IDs are OUTPUTS of classification, never INPUTS to plan computation. Every numeric in these templates is a `{{slot}}` — sizings, equities, and SPR-zone references interpolate from `plan.*` / `equity.*` / `situation.*` at render time. The pot-type and position axes are derived from game state (preflop action history → `potType`; closing action → `inPosition`), never asserted from the label.

### 4.5 River archetypes (v2: 14)

Authored 2026-05-30 by WS-152 (HSP-A4). Mirrors §4.4 turn discipline — **pot type (SRP / 3BP) is a primary axis** on continuation lines — and adds **two river-distinctive sizing archetypes** (`RIVER_BLOCK_BET`, `RIVER_VS_BLOCK_BET`) because the small-lead game-theoretic regime is structurally distinct from polarized bet sizing (different MDF math, different bluff-frequency optimum, different raise-as-bluff response). Founder ratified the 14-entry catalog (vs a 12-entry strict mirror or the original ticket's 8-entry sketch) via AskUserQuestion 2026-05-30.

| ID | Trigger | Coarse axes |
|---|---|---|
| `RIVER_SRP_BET_IP` | SRP, hero bets river IP | BET, IP, SRP |
| `RIVER_SRP_BET_OOP` | SRP, hero bets river OOP | BET, OOP, SRP |
| `RIVER_SRP_VS_BET_IP` | SRP, hero faces river bet IP | VS_BET, IP, SRP |
| `RIVER_SRP_VS_BET_OOP` | SRP, hero faces river bet OOP | VS_BET, OOP, SRP |
| `RIVER_3BP_BET_IP` | 3BP, hero bets river IP | BET, IP, 3BP |
| `RIVER_3BP_BET_OOP` | 3BP, hero bets river OOP | BET, OOP, 3BP |
| `RIVER_3BP_VS_BET_IP` | 3BP, hero faces river bet IP | VS_BET, IP, 3BP |
| `RIVER_3BP_VS_BET_OOP` | 3BP, hero faces river bet OOP | VS_BET, OOP, 3BP |
| `RIVER_PROBE` | Flop + turn both checked through, hero leads river OOP into capped range | PROBE, OOP |
| `RIVER_DELAYED_BET` | Hero checked back turn IP, bets river | BET, IP (delayed) |
| `RIVER_MULTIWAY` | 3+ players to the river | MULTIWAY |
| `RIVER_VS_DONK` | Hero (prior-street aggressor) faces a river donk lead | VS_DONK |
| `RIVER_BLOCK_BET` | OOP small lead on river (~25–40% pot) for thin value + bluff-catch induce | BET, OOP, small-sizing |
| `RIVER_VS_BLOCK_BET` | Facing a small river lead (~25–40% pot) | VS_BET, IP-or-OOP, small-sizing |

Families (10): `RIVER_SRP_BET`, `RIVER_SRP_VS_BET`, `RIVER_3BP_BET`, `RIVER_3BP_VS_BET`, `RIVER_PROBE`, `RIVER_DELAYED_BET`, `RIVER_MULTIWAY`, `RIVER_VS_DONK`, `RIVER_BLOCK_BET`, `RIVER_VS_BLOCK_BET`.

**No separate `RIVER_BLUFF_CATCHER` or `RIVER_THIN_VALUE` archetype.** Per §4.1 ("if two templates only differ in tendency/hand-class response, they share an archetype"), bluff-catching is a `handClass: BLUFF_CATCHER` frame inside `RIVER_*_VS_BET_{IP,OOP}` body content, and thin-value is a `handClass: THIN_VALUE` frame inside `RIVER_*_BET_{IP,OOP}` with the sizing slot doing the work. Adding hand-class-driven archetypes would proliferate the catalog without changing the decision tree.

**Why `BLOCK_BET` / `VS_BLOCK_BET` ARE separate** despite the above rule: block-betting is not a hand-class variant of the `BET_OOP` line — it's a structurally different decision regime. The small sizing changes the raise-as-bluff incentive for villain, changes the MDF threshold dramatically (defending ~80%+ of range vs ~55% facing 2/3 pot), and reshapes hero's range construction (block-bet range is value-heavy with select induce-bluffs; full-pot OOP range is polarized to nuts + air). Different decision tree → different archetype.

**Check-raise is a branch, not an archetype** — facing a river bet, the raise/check-raise line lives inside `RIVER_*_VS_BET_*`'s branch summary, mirroring the turn discipline.

#### 4.5.1 River implementation policy (WS-152, 2026-05-30)

**ID format.** Position is the suffix throughout (`RIVER_SRP_BET_IP`), matching §4.4's uniform turn-IDs convention. No `HU` token — multiway is its own archetype. The two `BLOCK_BET` archetypes carry no position suffix: `RIVER_BLOCK_BET` is OOP by definition (small lead is OOP), and `RIVER_VS_BLOCK_BET` covers both positions because the sizing-response math is dominated by the small-bet pot-odds regime rather than position.

**Scope boundary — this ticket authored the taxonomy table + the 14 narrative templates only** (`docs/design/hero-state-templates/river/*.md`). The following land with **WS-153** (`classifyArchetype` turn/river extension), deliberately deferred so the test suite stays green:

- `ARCHETYPE_IDS` + `ARCHETYPE_FAMILIES` in `src/utils/heroState/types.js` are **not yet extended** with the river entries. Adding them now would fail `classifyArchetype.test.js` (`reached.size === ARCHETYPE_IDS.length` — every ID must be reachable, but the classifier still throws `NotImplementedError` for river) and `loadTemplates.test.js` ("loads all 18").
- `loadTemplates.js`'s `import.meta.glob` matches `{preflop,flop}/*.md` only — both the `turn/` directory (WS-151) and the new `river/` directory (this ticket) are intentionally invisible to the loader until WS-153 extends the glob and the enum together.
- `classifyArchetype.js` continues to throw for river states (design §4.5 was a v2 stub; WS-153 implements the routing using `(potType, actionContext, inPosition, playersRemaining)` axes plus prior-street action-history reconstruction for the block-bet detection and the PROBE/DELAYED_BET history conditions, with the same closest-match fallback discipline as §4.3.1 + §4.4.1).

**Block-bet detection (WS-153 prep note).** `RIVER_BLOCK_BET` and `RIVER_VS_BLOCK_BET` route on `sizingFraction <= 0.40` (sizing as fraction of pot). Sizing comes from action history; the threshold is a classifier policy decision that WS-153 will ratify. Above 40%, route to `RIVER_*_BET_OOP` / `RIVER_*_VS_BET_*` instead.

**4BP fallback (inherited from §4.3.1).** 4-bet-pot rivers route to the `3BP` archetype IDs; lower-SPR mechanics come from `sprZone` in the Plan, not from a separate 4BP family.

**First-principles guard (binding).** Archetype IDs are OUTPUTS of classification, never INPUTS to plan computation. Every numeric in these templates is a `{{slot}}` — sizings, equities, and SPR-zone references interpolate from `plan.*` / `equity.*` / `situation.*` at render time. Pot-type, position, and sizing-fraction axes are derived from game state (preflop action history → `potType`; closing action → `inPosition`; bet amount + pot → sizing-fraction → block-bet routing), never asserted from the label.

**River-specific theory binding (POKER_THEORY companion).** At the river, equity per villain combo is binary (cards are deterministic — see memory `feedback_river_equity_is_showdown_outcome.md`). Templates reference `equity.vsRangeParts.{vsValue, vsBluff, vsDraw, vsAir}` for the 4-class role decomposition vs the public board (bluff-catchers fold into `vsValue` when villain defends — see `equityVsRangeParts.js` role mapping), NOT a runout-variance metric. Bluff-catching narratives lean on this decomposition + the bluff-to-value ratio implicit in `equity.vsRangeParts`.

## 5. Worked examples

These three examples seed the narrative voice. Numbers are illustrative — final templates will pull from `equity` and `plan.*.ev` at render time.

### 5.1 Example A — AJo, HJ, RFI

**Inputs:** Hero AJo on HJ, 100bb effective, 6-handed, $1/$2 cash, 5%/$5 rake.

**HeroState (key fields):**
- `archetypeId`: `PF_OPEN_RFI`
- `situation`: { street: preflop, actionContext: OPEN, positionClass: HJ, playersRemaining: 4, sprZone: DEEP, pot: 4.5, effStack: 200 }
- `handContext`: { hand: AJo, handClass: TOP_OF_RANGE, handStrength: PREMIUM_LITE, rangeAdvantage: 'hero' (vs BTN/blinds preflop) }
- `equity.overall`: ~62% vs random; ~52% vs likely BTN call range
- `plan.primary`: { action: BET, sizing: 2.5bb, sizingRationale: "standard open, balances range cost; bigger sizes leak EV vs blinds", ev: +0.4bb }
- `plan.branches`:
  - "called from BTN" → tight cbet config on dynamic boards, wide on dry (range advantage)
  - "3bet from BTN/SB" → call (AJo profitable IP; 4bet only vs known light 3bettors)
  - "3bet from BB" → fold (BB 3bet ranges are AQ+/JJ+ heavy)
- `plan.rangeConfig`:
  - tight = top-15% (TT+, AQ+, KQs, suited broadways)
  - wide = top-22% adds suited connectors and small pairs

**Narrative:**
> **AJo on HJ — standard open.**
>
> We're planning to open 2.5bb. Premium-lite hand at the top of our HJ range; dominates BTN flatting range and has equity vs blind defends. If called from the BTN we'll have a tight-vs-wide flop configuration: tighten on dynamic Q/J/T-high boards where their flat range connects, widen on A-high or rainbow low boards where we own the range advantage. If 3-bet from BTN or SB we call IP. If 3-bet from BB we usually fold — BB 3-bet range is heavy on AQ+/JJ+ which dominates us.

### 5.2 Example B — 99 on 782r, 3bet pot OOP

**Inputs:** Hero 99 in SB after 3-betting CO open, CO called. Flop 7♠8♦2♣ (rainbow). SPR ~3 (MEDIUM).

**HeroState (key fields):**
- `archetypeId`: `FLOP_3BP_HU_OOP_CBET`
- `situation`: { street: flop, actionContext: CBET, positionClass: SB, inPosition: false, playersRemaining: 2, sprZone: MEDIUM }
- `handContext`: { hand: 99, handClass: TOP_OF_RANGE, handStrength: OVERPAIR, rangeAdvantage: 'hero' (3-bet pot, dry low board), nutAdvantage: 'hero', boardTexture: DRY }
- `equity.vsRangeParts`:
  - vs value (TT-AA, sets 77/88): ~22% — dominated
  - vs broadway floats (AK/AQ/KQ): ~78% — winning
  - vs random call range: ~64%
- `plan.primary`: { action: BET, sizing: 33% pot, sizingRationale: "small bet — range and nut advantage; small size gets value from broadways and protects vs runouts; large size folds out everything we beat", ev: +0.7bb }
- `plan.branches`:
  - "called" → villain range now has pairs (44–77, JJ–TT) and suited broadways with backdoors. Turn barrel on equity-shifters (any A/K/Q). Check-call low blanks.
  - "raised" → villain raise range here is tight (77/88, occasional 76s/65s bluffs). Fold vs nits; call once vs bluffy villain.
- `adjustments`:
  - "calling station" → sizing → 50%, drop bluffs, value-bet thinner on turn
  - "nit" → 33% cbet still works, but fold to flop raise without protest

**Narrative:**
> **99 on 782r 3-bet pot OOP — value bet small.**
>
> We have an overpair on a dry low board in a 3-bet pot OOP, with both range and nut advantage. Villain doesn't have much top pair (CO 3-bet calling range skips most A8/A7/A2 type hands) — we win against their broadway floats (AK/AQ ~78%) but are dominated by their pp (TT-AA ~22%). We can bet 33% with a plan to call once vs a raise from a bluffy villain, or fold vs a nit. Against an uncapped range — i.e., when villain's call could include sets and overpairs — be tighter with our bluff frequency in this spot, and don't barrel for value on Q/J/T turns where their range now beats us.

### 5.3 Example C — SB facing CO open

**Inputs:** Hero in SB, 100bb, CO opens 2.5bb.

**HeroState (key fields):**
- `archetypeId`: `PF_VS_OPEN_SB`
- `situation`: { street: preflop, actionContext: VS_OPEN, positionClass: SB, playersRemaining: 1 (BB to act) }
- `handContext`: depends on hand; archetype is hand-class-agnostic at the headline level

**Narrative (template, hand-class-conditioned):**
> **SB vs CO open — tighten + 3-bet polarize.**
>
> We're in the small blind facing a CO open. We have to tighten up to compensate for being OOP postflop, and we plan to 3-bet most hands we play — flatting in the SB sandwiches us between the opener and a live BB. With AJ+/TT+ at the top of our range, a 4.5x raise size frontloads our equity, gets value from CO's continuing range (TT+/AK), and folds out marginal hands that would call a smaller 3-bet. Mix in suited Axs and small pairs as bluff/protection — good blockers, set-mining equity, can felt postflop without dominating regret.

## 6. Integration points

| Consumer | What it uses | When it runs |
|---|---|---|
| Live advisor (`OnlineView`) | `narrative.headline` + `plan.primary` + top-1 adjustment | Each hero turn |
| PRF playbook cards | Static archetype templates rendered with placeholder values | Pre-session (PRF view) |
| HandReplay review | Full HeroState rendered side-by-side with hero's actual action | Post-hand replay |
| SCF leak detector (workstream D) | `plan.primary.action` as canonical baseline; deviation → leak candidate | Post-hand batch |

## 7. Open questions

1. **Granularity / catalog growth.** 18 archetypes (8 preflop + 10 flop) for v1. Turn + river deferred. Is 18 enough to validate the framework? Probably yes — one preflop spot + one flop spot per major axis combination covers the common path. Will need 8–12 more for turn/river.
2. **Adjustment composition.** ~~When multiple tendencies fire (e.g., "calling station AND short-stacked"), do deltas multiply, sum, or take precedence by rank? Needs a `composeAdjustments(list) → final delta` rule. Suggest precedence-by-magnitude with explicit conflict resolution per axis.~~ **RESOLVED 2026-06-04 (WS-155 / SPR-105) — composeAdjustments shipped at `src/utils/heroState/composeAdjustments.js` with explicit per-axis rules, each derived from poker theory rather than code convenience. See §7.2.1 below.**

### §7.2.1 — Composition rules (resolution, WS-155)

Each `AdjustmentDelta` axis composes by a distinct rule chosen for poker-theory reasons, not symmetry or convenience. `composeAdjustments(Adjustment[]) → ComposedDelta` is a pure function consumed by `buildHeroState` and exposed as `HeroState.composedDelta` alongside the pre-composition `adjustments[]` (consumers can read either).

| Axis | Rule | Derivation |
|------|------|------------|
| `sizingMultiplier` | **Multiplicative, clamped to [0.6, 2.0]** with `clamped:true` flag when bounds engage | Sizing changes compound when multiple tendencies point the same direction (calling-station + over-folds-river both → larger value sizing); pure-additive composition under-weights cumulative effect, pure-precedence discards smaller real effects. Clamp prevents leaving the locally-linear regime — above 2× pot the fold-to-bet curve is bimodal (snap-fold or snap-call) per POKER_THEORY §3.5; below 0.6× the hand should generally check rather than block-bet for an ill-defined reason (matches the RIVER_BLOCK_BET threshold at §4.5.1). |
| `polarize` | **OR (any-fires-wins)** | Polarization is a range-construction decision, not an intensity dial. If ANY firing tendency creates a structural reason to polarize (sticky caller, capped range, asymmetric fold-equity), polarized construction wins — there is no symmetric "anti-polarize" force that would cancel it. |
| `bluffFreq` | **MIN-wins (most-conservative)** | Bluffing has asymmetric loss: false-positive bluff into a sticky player costs ~pot; false-negative (failed bluff) costs ~edge. When one signal says "villain calls too much" and another says "villain folds too much," the calling-station signal must dominate because its worst-case error is larger. Direct application of minimax-regret reasoning. |
| `actionOverride` | **Precedence by severity; conservatism tiebreak** | actionOverride is the most consequential adjustment — it discards the gameTree's primary recommendation. Only the strongest-confidence tendency should be allowed to overrule the equity-grounded plan. At equal severity, the less-aggressive action has lower max-regret (checking back is recoverable; an erroneous raise commits chips). Action conservatism order: `fold < check < call < bet < raise`. |

**Output shape (`ComposedDelta`):**
```
{
  sizingMultiplier: number,    // 1.0 default; clamped [0.6, 2.0]
  polarize: boolean,           // false default
  bluffFreq: number|null,      // null when no firing adjustment specifies
  actionOverride: string|null, // null when no override fires
  clamped: boolean,            // true when sizingMultiplier hit ceiling/floor
  contributingCount: number,   // adjustments with ≥1 non-default delta field
}
```

The `clamped` flag is a transparency contract — surfaces showing `composedDelta` (e.g., HandReplay's HeroStateSection) MUST surface a UI hint when `clamped: true` so the founder can see that multiple tendencies stacked beyond the model's modeled regime. Silent clamping would mask a model boundary.

**Per-vulnerability delta producer:** populated by `WEAKNESS_TO_DELTA` map in `src/utils/exploitEngine/villainProfileBuilder.js`. v1 maps the 8 load-bearing vulnerability classes (`sit-overcalls-river`, `sit-folds-to-pressure`, `sit-cbets-wet-unprofitable`, `sit-checks-dry-underbet`, `sit-slowplays-strong`, `sit-weak-showdowns`, `sit-overvalues-medium`, `pf-folds-to-3bet-high`). Unmapped vulnerabilities ship `delta: {}` — they remain Adjustment entries with rationale text but no numeric contribution to composition (informational reads, not numeric levers). Future tickets extend the map as new vulnerability classes emerge.

**First-principles guard:** composedDelta is itself an OUTPUT of composition over Adjustment[] (POKER_THEORY §7); it is never an input to the gameTreeEvaluator. Plans come from equity / SPR / pot odds / players remaining. The composedDelta is a CONSUMER-FACING summary of how villain tendencies should *bias* the rendered plan — consumers (HandReplay, SCF leak detector, future live coach) decide how to apply the bias.

### §7.4 — Multiway model (resolution, WS-154 / SPR-106)

Multiway pots (3+ players postflop) invalidate the HU range-vs-range frame the rest of the HSP catalog uses. Resolution lands as four coordinated changes, none of which require new engine primitives — the multiway EV math already ships in `gameTreeEvaluator` and reaches HSP via `buildHeroState.js:510` (`numOpponents = max(1, playersRemaining - 1)`).

#### §7.4.1 — Archetype taxonomy (3-way potType split + catch-all)

`FLOP_MULTIWAY` is retained as a catch-all and three new sub-archetypes route by `potType`:

| ID | Trigger | Typical hero role descriptor |
|---|---|---|
| `FLOP_MULTIWAY_SRP` | `playersRemaining >= 3` AND `potType === 'SRP'` | `PFR_LEADING` / `CALLER_PFR_BEHIND` / `CALLER_PFR_ACTED` |
| `FLOP_MULTIWAY_3BP` | `playersRemaining >= 3` AND `potType ∈ {'3BP', '4BP'}` (rare) | `PFR_LEADING` / `CALLER_PFR_ACTED` |
| `FLOP_MULTIWAY_LIMPED` | `playersRemaining >= 3` AND `potType === 'LIMPED'` | `LIMPER` |
| `FLOP_MULTIWAY` (catch-all) | `playersRemaining >= 3` AND `potType` null / unknown | `null` (descriptor not derivable) |

All four IDs map to the existing `FLOP_MULTIWAY` archetype family (no new entry in `ARCHETYPE_FAMILIES`). Authoring discipline: each sub-archetype gets its own template body that narrates the structural differences (capped 3BP callers vs uncapped limp ranges vs mid-capped SRP callers), while shared multiway pedagogy (equity dilution, cascading fold equity, value-heavy mode) repeats across all four.

**Why three and not five.** The spec pre-figured five archetypes (potType × hero-role). Three SRP-hero-role bodies would share ~90% of their prose — the hero-role distinction is fundamentally a one-sentence reframe, not a distinct narrative voice (per CONVENTIONS.md "1 archetype = 1 voice"). Splitting by potType captures the load-bearing range-shape difference; the hero-role axis lives in a new descriptor slot.

**`situation.multiwayHeroRole` descriptor slot** — additive to the `Situation` typedef:
- `'PFR_LEADING'` — hero was preflop aggressor, multiple opponents called → hero leads the flop
- `'CALLER_PFR_BEHIND'` — hero called preflop; PFR (someone else) has not yet acted on flop
- `'CALLER_PFR_ACTED'` — hero called preflop; PFR has bet or checked on flop
- `'LIMPER'` — no preflop raise (limped pot)
- `null` — HU (descriptor not applicable)

Derived in `buildHeroState.deriveMultiwayHeroRole(gameState)` from `actionSequence` + `heroSeat` + already-derived `potType`. The descriptor is an **OUTPUT** of game-state derivation — same first-principles guard as `archetypeId` itself (POKER_THEORY §7).

**Turn / river deferral.** `TURN_MULTIWAY` and `RIVER_MULTIWAY` remain single archetypes in v2. Multiway hands are bet-out by turn ~70% of the time; pot-type discrimination on later streets serves a rarer scenario. Template frontmatter carries a `v3_TODO` note covering the future split if observed multiway-turn/river usage proves common.

#### §7.4.2 — Already-shipped multiway primitives (HSP relies on, doesn't reinvent)

These formulas already exist in `src/utils/exploitEngine/` and flow into HSP plans via `buildHeroState.js:510`'s `numOpponents` pass-through. Documented here to make explicit what HSP depends on rather than build atop a hidden contract.

| Quantity | Formula | Module:line |
|---|---|---|
| Equity realization discount (multiway) | `r *= Math.pow(0.85, numOpponents - 1)` when no per-opponent AF data; per-opponent AF discount (e.g., AF > 2.5 → ×0.80) when `opponentModels` available | `gameTreeEquity.adjustedRealization:31` |
| Fold equity (all opponents fold) | `P(all fold) = ∏ P(opponent_i folds)` with bet-size × N correlation adjustment | `gameTreeEquity.multiwayFoldPct:569` |
| Bluff-frequency optimum (multiway) | Derived from `multiwayFoldPct` × pot odds at gameTreeEvaluator depth-2; **no hardcoded multiplier** | `gameTreeEvaluator.evaluateBluffEV` (via `multiwayFoldPct`) |
| Range narrowing (multiway) | `rangeSegmenter` is multiway-agnostic (board-conditional only); per-villain conditioning deferred to v3 (would live in `src/utils/exploitEngine/`, not heroState/) | `rangeSegmenter.segmentRange` |

#### §7.4.3 — Role partition limitation (the new `equity.vsRangeParts` multiway behavior)

`equity.vsRangeParts` requires HU semantics — the 4-class role partition (`vsValue/vsBluff/vsDraw/vsAir`) describes ONE villain's range shape given their action context, style, and polarization (see §9.3 decision table). Multiway has N villains with N action contexts; no defensible function signature for "role partition vs the field." When `playersRemaining >= 3`:

- `equity.vsRangeParts`: `null` (signals degraded state to consumers — UI must render this honestly)
- `equity.overall`: populated (MC equity vs the supplied villain range; caller may pass union or HU-narrowed range)
- `equity.realization`: populated (multiway-discounted by 0.85^(n-1) per §7.4.2)

`equityVsRangeParts.js` previously threw on `actionContext === 'MULTIWAY'`. The throw is lifted as of WS-154 — the function now returns `{vsValue: null, vsBluff: null, vsDraw: null, vsAir: null, overall: <computed>, strengthBreakdown: null}` when the multiway flag is set. The real guard (gating on `playersRemaining < 3`) lives upstream in `buildHeroState.js:519`, replacing the dead-code `actionContext !== 'MULTIWAY'` check.

Per-pair villain-range conditioning (villain₂'s range given villain₁'s prior call action) is a `rangeSegmenter` / `postflopNarrower` extension, NOT a `heroState/` job. Deferred to v3; current `gameTreeEvaluator` multiway math is sufficient for HSP-quality narrative output.

#### §7.4.4 — First-principles guard (binding — POKER_THEORY §1.4 + §7 + AP-RL-01)

- Multiway **bluff-frequency reduction** DERIVES from `∏ fold rates × pot odds` (already implemented at `multiwayFoldPct`). No `if (multiway) bluffFreq *= 0.5` shortcut.
- Multiway **equity discount** DERIVES from `0.85^(n-1)` realization (or per-opponent AF when `opponentModels` available). No archetype-keyed sizing lookup.
- `archetypeId`, `multiwayHeroRole`, `potType` are all **OUTPUTS** of game-state derivation; templates only RENDER them. No `if (archetypeId === 'FLOP_MULTIWAY_3BP') sizing *= 0.7` is anywhere in the code path.
- Templates contain **no hardcoded numerics** per CONVENTIONS.md — all sizings, equities, player counts, and realization values come from slots (`{{plan.primary.sizing}}`, `{{equity.realization}}`, `{{situation.playersRemaining}}`).

3. **Narrative authorship workflow.** Hand-authored templates with parametric slots, or LLM-generated at runtime against the HeroState object? Hand-authored gives stability + auditability + offline-capable; LLM handles long tail. Lean: hand-author the v1 archetype list; revisit LLM augmentation later.
4. **Multiway extension.** ~~Multiway invalidates HU range-vs-range reasoning. `FLOP_MULTIWAY` is a stub — multiway needs its own template family with sequential-decision modeling. Defer detail.~~ **RESOLVED 2026-06-04 (WS-154 / SPR-106) — see §7.4 below. Three-archetype split by potType (`FLOP_MULTIWAY_SRP` / `_3BP` / `_LIMPED`) + `multiwayHeroRole` descriptor slot for the hero-PFR-vs-caller axis. `equityVsRangeParts` MULTIWAY throw lifted (returns null role partition; `overall` remains populated against the union range). Plans are already multiway-correct via `gameTreeEvaluator` (which threads `numOpponents` through `adjustedRealization` 0.85^(n-1) and `multiwayFoldPct` ∏ formula). Per-pair villain-range conditioning deferred to v3. TURN_MULTIWAY / RIVER_MULTIWAY remain single archetypes (v3_TODO).**
5. **Range-engine alignment.** ~~`equity.vsRangeParts` requires the rangeEngine to expose villain range partitioned by class (value / draw / bluff / air). Need to audit whether this exists or whether a `villainRangePartitioner.js` is a prerequisite.~~ **RESOLVED 2026-05-03 (WS-137 audit) — see §9 for full report. Verdict: REJECT building a standalone `villainRangePartitioner.js`; the strength partition + per-bucket equity is fully solved by `src/utils/exploitEngine/rangeSegmenter.js`. ACCEPT building a thin role-translator (`src/utils/heroState/equityVsRangeParts.js`) that translates the existing 5-class strength partition (`nuts/strong/marginal/draw/air`) into HSP's 4-class role partition (`vsValue/vsBluff/vsDraw/vsAir`) using villain action context + style. New WS ticket created for the translator module.**
6. **Caching.** Re-derive per state transition vs cache by decision-key hash. Likely cache, since HeroState is non-trivial and SCF needs deterministic comparison across replay sessions.
7. **First-principles guard.** Per `POKER_THEORY.md` §7 and `exploitEngine/CLAUDE.md`: archetype IDs must be **outputs** of the classification process, not inputs to plan computation. The plan tree comes from equity / SPR / pot odds / players remaining — never `if (archetypeId === 'PF_VS_OPEN_SB') sizing = 4.5x`. Templates are presentation; plans are computed.

## 8. Proposed next steps

1. **Audit rangeEngine** — does it already partition villain range by class? If not, build `villainRangePartitioner.js` first.
2. **Author the 8 preflop archetype templates** as standalone markdown — nail the narrative voice before code.
3. **Author the 10 flop archetype templates** — same.
4. **Specify `HeroState`** as a TypeScript-style type in `src/utils/heroState/types.js` (no runtime yet).
5. **Implement `classifyArchetype(gameState, heroHand, villainModel) → archetypeId`.**
6. **Implement `buildHeroState(...) → HeroState`** — wires existing primitives (rangeEngine, gameTree, villainProfileBuilder).
7. **Wire to first consumer** — recommend HandReplay review (lowest risk, no live perf concern, full visibility into template quality).
8. **Promote to workstream** — provisionally **HSP (Hero State Primitive)**. Slots into the master plan as a foundational dependency for SCF (workstream D — leak-to-lesson loop needs canonical "correct frame" reference).

---

**Authoring conventions** (for adding archetypes later):
- Headline: 5–10 words, action-oriented, hand + spot + verb.
- Body: 3–5 sentences. Lead with range/nut advantage frame. State equity decomposition by villain range part. Give primary action + sizing rationale. Branch on key triggers. Close with one tendency-aware caveat.
- No hardcoded numbers in template — interpolate from `equity.*` and `plan.*.ev`.
- Voice: first-person plural ("we"), pedagogical, concise.

---

## 9. Range-engine alignment audit (WS-137 / HSP-G1, 2026-05-03)

Resolution of the open question raised in §7.5: **does the rangeEngine already partition villain range by class, or is a new `villainRangePartitioner.js` module a prerequisite?**

### 9.1 Audit findings (the 4 questions from WS-137)

**Q1 — Does any module already expose villain range partitioned by class?**

**YES, partially.** `src/utils/exploitEngine/rangeSegmenter.js` (already shipped, ~700 LoC, ~6,500 lines of associated tests across the engine) exposes:

| Function | Does | Output |
|---|---|---|
| `segmentRange(range, board, deadCards, boardTexture)` | Strategic partition | 5-bucket `nuts / strong / marginal / draw / air` with per-bucket counts, weight sums, and percentages |
| `segmentToRanges(segResult)` | Per-bucket sub-range materialization | `{ nuts: Float64Array(169), strong: ..., ... }` — handles multi-bucket-per-cell via proportional weight splitting |
| `enrichWithEquity(segResult, heroCards, options)` | Per-bucket hero equity | `{ bucketEquities: { nuts: 0.18, strong: 0.42, ... }, overallEquity: 0.55 }` — Monte Carlo, default 500 trials per bucket |
| `classifyHandType(c1, c2, board, boardCtx)` | Fine 24-entry display taxonomy | Hand-type strings (`topPairGood`, `nutFlushDraw`, `oesd`, `airBackdoorCombo`, `air`, …) parallel to the 5-bucket strategic classification |

The 5-bucket partition `BUCKETS = ['nuts', 'strong', 'marginal', 'draw', 'air']` is the **strategic vocabulary** used throughout the game tree (`gameTreeConstants.BUCKET_NAMES`, `gameTreeSizingHelpers.villainRangeShapeSizing`, `gameTreeDepth2`). Reusing it preserves consistency with the existing engine.

**Q2 — If not, what's the gap, and what would `villainRangePartitioner.js` look like?**

The gap is **not partitioning** (rangeSegmenter already does that comprehensively) — it's **role-conditioning**. HSP's `equity.vsRangeParts` schema asks for `vsValue / vsBluff / vsDraw / vsAir`, which is a 4-class role classification: what is the villain DOING with this hand given their action sequence and style? The existing partition is strength-only.

The mapping from strength → role depends on:

| Villain action context | Polarized style | Linear style |
|---|---|---|
| Aggressor (bet/raise) | `marginal` → `vsBluff` (capped floats); `nuts/strong` → `vsValue`; `air` → `vsBluff` (intentional bluffs); `draw` → `vsDraw` | `marginal` → `vsValue` (thin value); `nuts/strong` → `vsValue`; `air` → `vsAir`; `draw` → `vsDraw` |
| Defender (call/check) | `marginal` → `vsValue` (bluff-catchers have showdown value); `nuts/strong` → `vsValue`; `air` → `vsAir`; `draw` → `vsDraw` | Same as polarized for defenders (defending ranges aren't structurally different on this axis) |

This is an aggregation-and-relabeling step on top of the existing strength buckets — not a new partitioning algorithm. Building a separate `villainRangePartitioner.js` that re-implements partitioning would duplicate `rangeSegmenter.js`. The right shape is a thin **role-translator**.

**Q3 — Are partition boundaries computable from current outputs?**

**YES, fully.** The translator needs:

1. `rangeSegmenter.segmentRange()` output (already produced by every postflop game-tree consumer)
2. Villain's current action context (already in game state — fed via the `actionContext` axis HSP already requires for archetype classification)
3. Villain's style + polarization signal — already computable via:
   - `villainProfileBuilder.getStyle()` → `'Fish' | 'Nit' | 'LAG' | 'TAG' | null`
   - `gameTreeEquity.computePolarization(buckets)` → polarization score
   - `gameTreeSizingHelpers.villainRangeShapeSizing(buckets, heroEquity, street)` → already classifies range shape as `air-heavy / value-heavy / draw-heavy / capped / polarized`

No new infrastructure is needed; just composition of existing primitives.

**Q4 — What classes are needed at what street?**

| Street | Available role classes | Notes |
|---|---|---|
| Preflop | `vsValue`, `vsMarginal` (replaces `vsBluff`+`vsDraw`), `vsAir` | No board → no draws; no "bluffs" in the postflop sense (preflop "bluff" steals reduce to opening-range width). For HSP v1, treat preflop equity as a single `overall` value computed against the full preflop range and skip `vsRangeParts`. The existing `rangeEngine` already handles preflop range shaping per position. |
| Flop | All 4 (`vsValue`, `vsBluff`, `vsDraw`, `vsAir`) | Full HSP partition. |
| Turn | All 4 | Same as flop. Draw class shrinks (rivered cards realize/miss). |
| River | `vsValue`, `vsBluff` (bluff-catchers replaces draws), `vsAir` | No draws on river. HSP schema keeps the `vsDraw` key but it returns `null` (already supported by the typedef). |

The HSP `EquityVsRangeParts` typedef in `src/utils/heroState/types.js` already documents that values may be null when the partition has zero weight — no schema change needed.

### 9.2 Verdict

**REJECT** building a standalone `villainRangePartitioner.js` module. Building one would duplicate `rangeSegmenter.js` and bifurcate the strategic vocabulary across the codebase.

**ACCEPT** building a thin role-translator at `src/utils/heroState/equityVsRangeParts.js`. It composes existing primitives (rangeSegmenter + villainProfileBuilder + gameTreeEquity) and emits HSP's 4-class role partition. ~80 LoC + tests for v1; lives in `heroState/` (not `rangeEngine/` or `exploitEngine/`) because role-conditioning depends on action+style which is downstream of both engines.

### 9.3 Module API spec — `src/utils/heroState/equityVsRangeParts.js`

Per the WS-137 founder directive ("most sophisticated but consistent with our engine"), the spec preserves rangeSegmenter's strength vocabulary internally and exposes a clean role-classified surface for HSP consumers.

```js
/**
 * Compute hero hand equity vs villain range, decomposed into the HSP 4-class
 * role partition (vsValue / vsBluff / vsDraw / vsAir).
 *
 * Reuses rangeSegmenter's strength partition (nuts/strong/marginal/draw/air)
 * + per-bucket equity, then translates strength → role using villain's
 * action context, style, and range polarization signal.
 *
 * @param {object} args
 * @param {[number, number]} args.heroCards         - Encoded hero cards.
 * @param {Float64Array} args.villainRange          - Narrowed 169-cell range
 *                                                    (postflop: post action-conditioning via
 *                                                    postflopNarrower; preflop: from rangeEngine).
 * @param {number[]} args.board                     - 3-5 encoded board cards (preflop: empty array).
 * @param {('preflop'|'flop'|'turn'|'river')} args.street
 * @param {string} args.actionContext               - One of ACTION_CONTEXTS. Determines whether
 *                                                    villain is aggressor (CBET/BARREL/3BET/...)
 *                                                    or defender (VS_CBET/VS_BARREL/VS_3BET/...).
 * @param {object|null} args.villainStyle           - { style, polarization, capped }
 *                                                    style: 'Fish'|'Nit'|'LAG'|'TAG'|null
 *                                                    polarization: 0..1 (from gameTreeEquity.computePolarization)
 *                                                    capped: boolean (from rangeShapeSizing.capped)
 * @param {{trials?: number, fullRange?: Float64Array, equityFn?: function}} [args.options]
 *
 * @returns {Promise<{
 *   vsValue: number|null,
 *   vsBluff: number|null,
 *   vsDraw: number|null,
 *   vsAir: number|null,
 *   overall: number,
 *   strengthBreakdown: object  // raw rangeSegmenter output for debugging / display
 * }>}
 *   - Each role-bucket equity is a weighted average of the strength-bucket equities
 *     that map to it. null when the role partition has zero weight in this state
 *     (e.g., vsDraw on river; vsBluff/vsDraw preflop).
 *   - overall: hero equity vs full villain range (single accurate run).
 *   - strengthBreakdown: the underlying segResult + per-strength equities, for
 *     debugging, display layers (e.g., HandReplay panel that wants the 24-entry
 *     hand-type taxonomy), and SCF deviation tracking.
 *
 * Implementation outline:
 *   1. (preflop short-circuit): if street === 'preflop', compute overall vs
 *      villainRange and return { vsValue: null, vsBluff: null, vsDraw: null,
 *      vsAir: null, overall, strengthBreakdown: null }.
 *   2. const segResult = segmentRange(villainRange, board, deadCards, boardTexture)
 *   3. const { bucketEquities, overallEquity } = await enrichWithEquity(segResult, heroCards, options)
 *   4. const roleMapping = translateStrengthToRole(segResult, actionContext, villainStyle)
 *      // returns: { vsValue: ['nuts','strong'], vsBluff: ['marginal','air'], vsDraw: ['draw'], vsAir: [] }
 *      // (membership lists; 'marginal' moves between vsValue/vsBluff per the table in §9.1 Q2)
 *   5. For each role bucket: aggregate the member strength buckets' equities
 *      weighted by their weightSum:
 *          vsValueEquity = Σ(bucketEquity[s] × weightSum[s] for s in roleMapping.vsValue) / Σ(weightSum[s])
 *      Return null if total weight is zero.
 *   6. Return { vsValue, vsBluff, vsDraw, vsAir, overall: overallEquity, strengthBreakdown: { segResult, bucketEquities } }
 */
export const computeEquityVsRangeParts = async (args) => { ... };

/**
 * Pure mapping function: strength buckets → role buckets given action + style.
 * Extracted as standalone export for unit testability — no async, no equity.
 *
 * @param {object} segResult       - Output of rangeSegmenter.segmentRange()
 * @param {string} actionContext   - One of ACTION_CONTEXTS
 * @param {object|null} villainStyle - { style, polarization, capped }
 *
 * @returns {{
 *   vsValue: { buckets: string[], totalWeight: number },
 *   vsBluff: { buckets: string[], totalWeight: number },
 *   vsDraw:  { buckets: string[], totalWeight: number },
 *   vsAir:   { buckets: string[], totalWeight: number }
 * }}
 *   - buckets: list of strength-bucket names contributing to this role
 *   - totalWeight: sum of segResult.buckets[s].weightSum for s in buckets
 *
 * Decision table (mirrors §9.1 Q2):
 *   isAggressor = actionContext in {OPEN, 3BET, SQUEEZE, CBET, BARREL, PROBE, DONK}
 *   isPolarized = villainStyle?.polarization >= 0.5 OR
 *                 (segResult.buckets.nuts.pct + segResult.buckets.air.pct) > 60
 *   marginalRole =
 *     !isAggressor                 ? 'vsValue' :       // defenders: marginal is bluff-catcher (showdown value)
 *     isPolarized                  ? 'vsBluff' :       // aggressor + polarized: marginal is capped float
 *                                    'vsValue';        // aggressor + linear: marginal is thin value
 *   airRole =
 *     isAggressor && isPolarized   ? 'vsBluff' :       // aggressor polarized: air = intentional bluffs
 *                                    'vsAir';          // otherwise: air is just air
 *
 *   vsValue   ← ['nuts', 'strong'] + (marginalRole === 'vsValue' ? ['marginal'] : [])
 *   vsBluff   ← (marginalRole === 'vsBluff' ? ['marginal'] : []) +
 *               (airRole === 'vsBluff' ? ['air'] : [])
 *   vsDraw    ← ['draw']  // drop on river (segResult.buckets.draw.weightSum === 0 there)
 *   vsAir     ← (airRole === 'vsAir' ? ['air'] : [])
 */
export const translateStrengthToRole = (segResult, actionContext, villainStyle) => { ... };
```

**Test surface (proposed for the new ticket):**
- `translateStrengthToRole`: pure-function table tests covering all 4 quadrants of (aggressor × polarized) and both BB-defender + non-BB-defender cases. ≥12 cases.
- `computeEquityVsRangeParts`: integration tests mocking `enrichWithEquity` to verify role-equity aggregation math (weighted averages across multiple strength buckets, null handling for empty roles, river vsDraw=null).
- Preflop short-circuit test (returns null for all role partitions).
- Capped-villain-range test (overall preserved, vsValue=null because nuts/strong both empty).

**Implementation effort estimate:** S (small) — ~80–120 LoC + ~150 LoC tests. Lives entirely in `src/utils/heroState/`. No changes to rangeEngine, exploitEngine, or pokerCore. New WS ticket created as a child of WS-136.

#### 9.3.1 Implementation clarifications (WS-144 plan-mode resolutions, 2026-05-03)

Two ambiguities surfaced when implementing the spec; both resolved by founder via AskUserQuestion in WS-144 plan mode. The §9.3 spec is otherwise authoritative — these clarifications fill the gaps it did not name.

**Q1 — `villainIsAggressor` mapping.** The §9.3 decision-table sketch wrote `isAggressor = actionContext in {OPEN, 3BET, SQUEEZE, CBET, BARREL, PROBE, DONK}`, but `ACTION_CONTEXTS` distinguishes parallel `OPEN`/`VS_OPEN`, `CBET`/`VS_CBET`, etc. The role-translation table semantically conditions on **villain's** role. Resolution: `villainIsAggressor = actionContext.startsWith('VS_')`. VS_* contexts mean hero is facing villain's bet → villain is the aggressor → use the aggressor row of the decision table. Bare names (`OPEN`, `CBET`, `BARREL`, `PROBE`, `DONK`, `3BET`, `SQUEEZE`) → hero is the aggressor → villain is the defender → use the defender row.

**Q2 — `LIMP_NAV` and `MULTIWAY` handling.** Neither appears in the §9.3 aggressor list. Resolution:
- `LIMP_NAV` → defender row (no aggressor yet in the action history; villain limped, no one has bet).
- `MULTIWAY` → `computeEquityVsRangeParts` throws `Error('equityVsRangeParts: MULTIWAY not supported in v1 (design doc §7.4). Pass HU-narrowed range or compute per-villain.')`. Pure `translateStrengthToRole` does not throw — only the async caller-facing surface guards. Caller (WS-142 orchestrator) is responsible for either narrowing to HU or skipping `vsRangeParts` entirely.

### 9.4 Downstream impact

- **WS-142 (HSP-B2 buildHeroState)** previously listed WS-137 as a blocker because it needed to know whether the partitioner module would ship before B2. With this verdict, WS-142's dep on WS-137 is satisfied, and WS-142 gains a new dep on the role-translator ticket (created below).
- **No changes** to the existing rangeEngine or exploitEngine consumers. The role-translator is a pure addition in heroState/.
- **No changes** to the HeroState schema in `src/utils/heroState/types.js` (already shipped via WS-140). The 4-class `EquityVsRangeParts` typedef already documents the null-on-river behavior.

## 10. buildHeroState orchestrator (WS-142, 2026-05-03)

`src/utils/heroState/buildHeroState.js` implements the §3 + §6 + §7 orchestrator that composes the HSP primitives + existing engines into a complete `HeroState` object. Two implementation policies were resolved during plan-mode and bind future work.

### 10.1 Failure-mode policy (two-tier)

- **Required (throw if missing/invalid):** `gameState`, `heroHand`. No HeroState is meaningful without these.
- **Optional (soft-degrade with null fields):** `villainProfile`, `villainRange`, `villainModel`. When missing, `equity.vsRangeParts: null`, `adjustments: []`, and `plan.primary: null` (no plan computation without villain data).

This matches how `rangeEngine` and `gameTreeEvaluator` already handle missing villain data — the consumer can detect the degraded state by checking which fields are null. Templates render against the partial HeroState; unresolved slots render as `{{path}}` placeholders rather than empty strings, so authors can spot degraded sections in rendered output.

### 10.2 Caching (deferred for v1)

No cache. `buildHeroState` re-derives the full HeroState every call. Caller can cache by decision-key hash if perf measurements warrant. Documented in module header per WS-142 accept criterion ("decided + documented OR explicitly deferred with rationale"). Rationale: zero invalidation surface for v1; measure first, optimize later.

### 10.3 Composition order (parallel where safe)

`evaluateGameTree` and `computeEquityVsRangeParts` fire in parallel via `Promise.all`. Both internally call `segmentRange` + `enrichWithEquity` — minor duplicate work, but keeping the modules independent is the cleaner v1 contract. The orchestrator does NOT modify other modules; perf optimization (sharing segmentation between the two paths) is a future micro-optimization once measurements support it.

Preflop short-circuits: `computeEquityVsRangeParts` is not called preflop (no role partition); only `evaluateGameTree` runs.

### 10.4 Template loading + helpers

Templates are bundled at build time via Vite's `import.meta.glob` (matches the established pattern in `src/utils/printableRefresher/cardRegistry.js:16`):

```js
import.meta.glob('../../../docs/design/hero-state-templates/{preflop,flop}/*.md',
                 { eager: true, query: '?raw', import: 'default' });
```

Three small helpers ship alongside the orchestrator:

| Helper | Scope | Swap-out trigger |
|---|---|---|
| `parseFrontmatter.js` (~50 LoC) | YAML scalars + `\|` literal blocks + `- item` arrays per CONVENTIONS.md | When templates need anchors/merges/tags/nested objects → swap to `js-yaml` |
| `loadTemplates.js` (~50 LoC) | `import.meta.glob` + section parser (`## Headline / ## Body / ## Branch summary`) | When section structure expands beyond 3 sections, or templates move out of `docs/design/hero-state-templates/` |
| `interpolateTemplate.js` (~50 LoC) | `{{path.to.field}}` + `{{list[*].x}}` (joined-with-newlines) + `{{list[N].x}}` indexed | When templates need conditional sections, partials, or richer iteration → swap to `mustache.js` / `handlebars` |

Each helper is hand-rolled to avoid a production dep on `js-yaml` (~150 KB) or `mustache.js` (~10 KB) for a bounded use case. CONVENTIONS.md keeps frontmatter + slot syntax simple by design.

### 10.5 First-principles guard verification

The orchestrator is a pure routing function over situation axes. Plan / EV / sizing come exclusively from `gameTreeEvaluator` (delegated to `evaluateGameTree`). The classifier emits `archetypeId`, the orchestrator passes it through to template selection — and that's the only place archetypeId is used in the pipeline. No conditional logic is gated on archetypeId in plan computation. A regression test (`buildHeroState.test.js > first-principles guard`) explicitly verifies that swapping the engine's recommendation (CBET → CHECK) flows through to `plan.primary.action` without the orchestrator overriding based on the archetype label.

### 10.6 Downstream

- **WS-143 (HandReplay first-consumer wire)** — UNBLOCKED. Wires `buildHeroState` output to the existing `HandReplayView`/`ReviewPanel`. Requires Design Gate 1+4 (cross-program, design + domain-correctness).
- **WS-013 (SCF Gate 5 leak-rule wiring)** — unblocks once WS-143 ships. The leak detector compares hero's actual play to `plan.primary` from the HeroState as the canonical baseline (Master Plan §D Phase 5).
- **No changes** to existing engine consumers — WS-142 is a pure addition in `heroState/`.

## 11. WS-143 first-consumer wire (HandReplay, 2026-05-03)

`src/components/views/HandReplayView/HeroStateSection.jsx` (shipped WS-143 / SPR-029) is the first consumer of HeroState. Renders inside the existing `ReviewPanel` between `HeroCoachingCard` (line 191) and `VillainAnalysisSection` (line 194). Active only on hero-action steps.

### 11.1 Render placement (decision #1)

**Inline between HeroCoachingCard + VillainAnalysisSection** (collapsible, default expanded). Picked over alternatives ("new top-level Frame section" or "replace HeroCoachingCard") to minimize layout disruption + keep both representations of the canonical reasoning available (HeroCoachingCard surfaces EV verdict + alternatives; HeroStateSection adds the canonical narrative frame).

### 11.2 Side-by-side comparison style (decision #2)

**Side-by-side neutral panels** — canonical narrative panel + hero's actual action panel. Picked over "annotated single panel with deviation badge" because the badge framing edges toward graded copy unless carefully neutralized. Side-by-side with neutral alignment labels honors `chris-live-player.md` autonomy red line #5 (no shame / engagement-pressure) by default.

Alignment label kinds (from `heroStateReplayUtils.js::detectAlignment`):
- `aligned` — actual action verb matches `plan.primary.action`; sizing within ±25% → "Aligned with canonical line + sizing." Otherwise "Action aligned; sizing differs (canonical X)."
- `deviation` — different action verb → "Different line from canonical (canonical: X)."
- `unknown` — no canonical baseline available (e.g., soft-degraded HSP) → "No canonical baseline available."

Forbidden copy tested: `wrong / missed / score / streak / level up / master / grade / great job / well done / excellent`.

### 11.3 Persistence (decision #3)

**Rederive on each replay view** — no IDB schema change for v1. `buildHeroState()` runs from a `useEffect` in `HeroStateSection` whenever `currentActionEntry` changes. Aligns with §10.2 caching deferral. Future: if perf measurements warrant, cache by decision-key hash (hand-id + actionIndex + heroSeat) — tracked but no ticket yet.

### 11.4 Surface impact

`docs/design/surfaces/hand-replay-view.md` updated with:
- New `HeroStateSection` in Anatomy diagram + dedicated §"HeroStateSection (HSP HandReplay wire, 2026-05-03)"
- JTBDs served list grew: added CO-54, CO-55, CO-56, SR-28, SR-29 (existing CO-57 deferred to SCF v2 per SCF G3)
- Last-reviewed date bumped to 2026-05-03
- Change log entry

### 11.5 Helper modules introduced

| File | Scope | Notes |
|---|---|---|
| `heroStateReplayUtils.js::reconstructGameStateAt` | Derive minimal HSP gameState from a HandReplay step | Handles preflop / flop / turn / river boards; sums pot from blinds + visibleActions; counts active players; derives effStack from heroSeat's start stack minus their spent amount |
| `heroStateReplayUtils.js::detectAlignment` | Neutral alignment label for canonical-vs-actual panels | Pure function; always returns `{label, kind}` with no graded copy. Tested against forbidden copy list |
| `HeroStateSection.jsx::CanonicalPanel` | Renders narrative.headline + plan.primary + narrative.body + narrative.branchSummary | Markdown-style rendering via `whitespace-pre-line` + plain text (no rich markdown parser; templates use simple text formatting) |
| `HeroStateSection.jsx::ActualPanel` | Renders actual action + alignment label | Purple accent for "Your Action" header to visually distinguish from indigo Canonical |

### 11.6 Downstream

- **WS-013 (SCF Gate 5 leak-rule wiring)** — fully unblocked. Compares hero's actual action against `HeroState.plan.primary` from the rendered HeroStateSection. Adds leak-fired badges inside the existing `HeroCoachingCard` per SCF G4 spec — coexists with HSP narrative; does not modify it.
- **No changes** to live-table surfaces. HSP narrative renders ONLY inside HandReplayView (autonomy red line #8).
- **No new IDB schema migration.** v20 unchanged.
