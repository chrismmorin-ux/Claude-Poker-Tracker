# Board Geometry as an Instructional Vocabulary — Theory Spec

> **Status:** Exploration / thinking artifact (2026-05-19). No code. This is the theory
> input a Gate-1 design entry would consume if we decide to build it.
> **Author intent:** Test whether a *geometric* description of boards — straight floors,
> flush-state progression, dimensional dominance — has instructional value for teaching how
> Hero manipulates range across streets, and specify it in terms of **existing engine
> primitives** so it never duplicates or contradicts them.

---

## 0. The first-principles contract (read first)

This document proposes a **vocabulary**, not a decision mechanism. Per POKER_THEORY.md §7 and
the project's standing doctrine (*"labels are outputs of computation, not inputs to it"*), every
construct below is a **derived descriptor**:

- It is **computed from the cards** (and, where noted, from the already-computed per-combo
  strength table).
- It feeds **teaching prose and, at most, priors** — never an EV, fold-rate, or plan computation.
- It is the same class of object as the **HSP archetype IDs** (presentation only) and the
  **river strength-tier distribution** (a name for a region of computed equity space).

The moment a geometry name short-circuits the equity/range math (`if (board.floor === 'high')
overbet()`), it becomes the exact anti-pattern the engine is built to refuse. The enforcement
section (§10) makes this concrete.

---

## 1. The core reframe: a board has three strength axes

Every made hand in hold'em comes from exactly one of three structural relations between hole
cards and board:

| Axis | Relation | Hands |
|------|----------|-------|
| **Rank-matching** | hole rank == board rank | pair, two pair, trips, full house, quads |
| **Rank-adjacency** ("the number system") | hole ranks extend a board run | straights |
| **Suit-matching** | hole suit == board suit majority | flushes |

The owner's intuition — *"number systems matter X less on certain boards"* — is precise once
stated this way:

> **On any given board, the three axes compete for the variance in hand strength. The share
> carried by the rank-adjacency (straight) axis shrinks as the suit axis or the pair axis takes
> over.**

- `K♠ 7♦ 2♣` (rainbow, disconnected, unpaired): only the rank-matching axis is live. Strength ≈
  "did you pair, how high." **Effectively one-dimensional.**
- `Q♠ J♠ 9♠` (monotone, connected): all three axes live *and ordered* (flush > straight > two
  pair). **Maximally three-dimensional.**
- `8♠ 8♦ 3♣` (paired): the rank-matching axis dominates and casts a **"boat shadow"** —
  straights and flushes that arrive later can be counterfeited, so their effective value is
  demoted even before they exist.

This is measurable, not poetic — see §6.

---

## 2. Straight geometry — the "floor", "ceiling", and "two-way"

### 2.1 Definitions (board-centric, computable)

A **straight window** is one of the 10 five-rank runs `A2345, 23456, …, TJQKA`. (These already
exist as `ALL_STRAIGHTS` in `straightCombos.js`.) A window is **live** on a board iff it contains
**≥ 3 board ranks** — because Hero holds only two cards, so a straight needs three of its five
ranks already on the felt.

From the set of live windows we define:

- **Straight floor** = the lowest card rank appearing in the lowest live window. Below the floor,
  a hole card is **straight-dead**: it can pair, never straighten using the board. *This is the
  owner's "2,3,4 can't make a downward straight," generalized — every board has a floor rank, and
  everything beneath it contributes zero to the adjacency axis.*
- **Straight ceiling** = the highest card rank in the highest live window.
- **Directionality**: `up-only`, `down-only`, or **`two-way`** (live windows exist both below and
  above the board's rank core). Two-way boards are the straight-dense ones.
- **Straight-density** = count of live windows (0–4 in practice). The board-centric "rundown
  intensity" that the codebase does **not** currently compute.

### 2.2 Worked examples

| Board | Live windows (by low card) | Floor | Ceiling | Direction | Density |
|-------|----------------------------|-------|---------|-----------|---------|
| `K Q J` | `9TJQK`, `TJQKA` | **9** | A | up-only | 2 |
| `8 7 6` | `45678`, `56789`, `6789T` | **4** | T | **two-way** | 3 |
| `A 5 4` | `A2345`, `23456`, `34567` | **A(low)** | 7 | down-only | 3 |
| `K 7 2` | *(none — no window holds 3)* | — | — | none | 0 |

### 2.3 Why it teaches

The rank line has **two walls — the wheel (A-5) and Broadway (T-A) — and straights cannot wrap.**
Therefore:

> **Edge boards (A-K-Q, or 3-2-A) are straight-sparse; middle boards (T-9-8, 8-7-6) are
> straight-dense, because they sit in the center of the line and straights run both ways.**

That asymmetry is the structural driver of *nut advantage* (POKER_THEORY §3.2). On `7-6-5` the
caller can hold the straights and sets (nut advantage) while the raiser keeps overpairs (range
advantage) — the textbook divergence. Knowing the **floor** tells Hero instantly whether the
bottom of either range is straight-dead, which is the same question as "is this range capped on
the adjacency axis."

---

## 3. Flush geometry — a dimensional collapse across streets

The monotone → 4-flush → 5-flush progression is the suit axis **progressively eating the other
two**:

| Flush-state | Board | What it does to strength |
|-------------|-------|--------------------------|
| `rainbow` | 3 suits | Suit axis dead. Strength is rank-only. |
| `twoTone` | 2 of a suit | Suit axis is a *draw* axis; nut-flush card is a future blocker. |
| `threeFlush` (monotone flop) | 3 of a suit | One suited card = draw, two = made. Continuing ranges compress hard; **A-of-suit becomes a dominant blocker.** |
| `fourFlush` (turn) | 4 of a suit | A *single* suited card = made flush. The range **bifurcates on "do you hold the suit."** Nut-flush card is king. |
| `flush` (5-flush river) | 5 of a suit | Board plays. Strength **collapses to one dimension**: the rank of your single relevant suit card. Pairs and straights are noise. |

The 5-flush river is the cleanest instance of the river-equity doctrine in the project memory:
*on a deterministic river, strength is a tier distribution over a single ordered axis, not a
variance metric.* All leverage is **suit-blocker** leverage.

### 3.1 Flush floor / ceiling (currently missing)

By analogy to the straight floor: on a flush-live board, the relevant question is **where Hero's
suit card sits in the surviving flush order** — nut / second / weak / dead. The engine detects
`nutFlush / secondFlush / weakFlush` per *hand* (`classifyHandType`) but exposes no **board-level
flush floor/ceiling** ("the lowest flush card that still beats the board" / "how blocker-friendly
is this flush suit"). That is the suit-axis analogue of the straight floor and belongs in the
descriptor.

---

## 4. Pair geometry — the boat shadow

A paired board makes the rank-matching axis dominant and **suppresses the other two before they
arrive**: any straight or flush completed later can lose to a full house. The engine knows
`isPaired` / `isTrips`; it does **not** quantify the suppression (which rank is paired, how much
of the playable range it removes — `A A 7` makes `A7` nearly unplayable). The descriptor should
carry a `pairState` ∈ {`unpaired`, `paired-low`, `paired-high`, `trips`} and flag the boat shadow
so prose can say *"draws here are discounted — the board can already be a boat."*

---

## 5. Geometry → leverage → line (the instructional payload)

This is the part with teaching value. Hero **cannot choose the board.** What Hero does:

1. **Geometry decides which player the board favors** — range advantage vs nut advantage
   (§3.2). The geometry vector is a sharper lens on this than the 6-bucket texture table.
2. **The geometry sets the *size of the lever*; Hero's line (bet/check/raise across streets) is
   the lever that cashes it.**

Three canonical mappings:

| Geometry | Favors | Leverage | Line that cashes it |
|----------|--------|----------|---------------------|
| **High floor, low dimensionality** (`A-K-Q` rainbow: floor 9, straight up-only, suit dead, pair-only) | Raiser owns range **and** nuts | Range-bet leverage | Small c-bet at high frequency; everything below the floor and unpaired is villain's pure give-up region (the §3.5 small-bet-on-dry pattern). |
| **Low floor, two-way, suit-live** (`7-6-5` two-tone: floor 3, density 3, flush draw) | Range adv → raiser; **nut adv → caller** (divergence) | Polarization / capped-vs-uncapped | As PFR: check more, size up when betting (can't rep the nuts cheaply). As caller: apply pressure with the nut-heavy straight/set region the raiser structurally lacks. |
| **5-flush river** (dimension collapsed to suit rank) | Whoever holds the higher suit card | **Blocker-only** leverage | Build the line around suit-blocker bluffs and suit-blocker thin value; "hand strength" off-suit is irrelevant. (Directly the river strength-tier distribution.) |

The through-line: **range manipulation is real, but it operates through the *line*, and the board
geometry determines how much that line can extract.** You don't bias the board; you bias which
boards you apply which line to, sized to the leverage the geometry hands you.

---

## 6. Dimensional dominance — the unifying metric

Define a per-board **axis-liveness vector** `[pair, straight, flush]` and an **effective
dimensionality** scalar (count of live axes, 1–3):

- `K 7 2` rainbow → `[1, 0, 0]`, dim **1**.
- `7 6 5` two-tone → `[1, 1, 1*]` (flush as draw), dim **~2.5**.
- `Q J 9` monotone → `[1, 1, 1]`, dim **3**.

**Operational definition using existing primitives** (no new equity math): enumerate the range
(`enumerateCombos`), and for each combo read which relation gives it its strength via
`classifyHandType` + `detectDraws`. Measure how much of the spread in the existing
`computeBoardStrengthTable` percentile is attributable to flush-holding vs straight-holding vs
pairing. The **share carried by the straight axis is exactly the owner's "how much the number
system matters here."** A coarse v1 can ship the liveness vector; a richer v2 can ship the true
variance decomposition.

---

## 7. Cross-street evolution — teaching the transition

Geometry is not static; it **evolves with each card**, and the transition is the high-value
teaching moment:

- A flush card landing on a rainbow board **collapses the rank axis** — strength that was about
  top pair is now about "do you hold the suit."
- A board-pairing turn **switches on the boat shadow**, demoting every draw.
- A blank that extends a run **raises straight-density**, shifting nut advantage.

This ties directly to polarization-by-street (§3.7) and to the per-combo range-narrowing
discipline (AP-RL-01, §7.6): narrowing is *backward inference given the observed line*, and the
geometry transition is *the forward change in the strength landscape* the narrowing reacts to.
Teaching them together — "the turn collapsed the dimension, here's how the range narrows in
response" — is the payload that the single static `boardTexture` label cannot deliver.

---

## 8. Grounding: concept → existing primitive or gap

| Concept | Existing primitive | Status |
|---------|--------------------|--------|
| Coarse texture (dry/wet/mono/paired) | `boardTexture.analyzeBoardTexture()` | ✅ keep, descriptor sits **above** it |
| Highest straight on board | `buildBoardContext().bestStraightHigh` | ✅ |
| Straight windows (10 canonical) | `straightCombos.ALL_STRAIGHTS` | ✅ reuse |
| Per-combo straight/flush completion | `postflopNarrower.detectDraws()` | ✅ |
| Board-relative 5-tier strength | `handEvaluator.computeBoardStrengthTable()` | ✅ (river-equity memory) |
| Per-combo equity | `gameTreeEquity.computeComboEquityDistribution()` | ✅ |
| Flush suit | `buildBoardContext().flushSuit` | ✅ |
| Rank/suit constants, wheel handling | `gameConstants.RANKS`, `cardParser`, evaluator wheel logic | ✅ |
| **Straight floor + directionality** | — | ❌ **new (pure, derived)** |
| **Board-centric straight-density** | — | ❌ **new** |
| **Flush floor/ceiling (blocker-friendliness)** | per-hand only (`classifyHandType`) | ❌ **new at board level** |
| **Dimensional-dominance vector** | — | ❌ **new** |
| **Pair-suppression / boat-shadow quantification** | `isPaired`/`isTrips` only (boolean) | ❌ **new** |

Every "new" item is computable from the cards plus the already-shipped enumeration and strength
table. None requires new equity simulation.

---

## 9. Where it lives (presentation-only)

A new derived field on `HeroState`:

```
boardGeometryDescriptor: {
  flushState:    'rainbow'|'twoTone'|'threeFlush'|'fourFlush'|'flush'|null,
  straightFloor: rank|null,         // null = straight-dead board
  straightCeiling: rank|null,
  straightDirection: 'up'|'down'|'two-way'|'none',
  straightDensity: 0..4,
  flushFloor:    rank|null,         // lowest suit card still beating the board
  pairState:     'unpaired'|'paired-low'|'paired-high'|'trips',
  axisLiveness:  [pair, straight, flush],   // 0..1 each
  effectiveDimensionality: 1..3,
}  // OUTPUT ONLY. Computed in buildHeroState() Step 4. Never read by EV/plan.
```

Computed in `buildHeroState()` alongside `buildHandContext()`, declared in template
`slotsUsed[]`, surfaced in prose via `{{boardGeometryDescriptor.*}}`. It is **never** read by
`gameTreeEvaluator`, `equityVsRangeParts`, or `classifyArchetype`.

---

## 10. Enforcement / anti-patterns

1. **Descriptor is sink-only.** No file in `exploitEngine/` or `rangeEngine/` may import the
   descriptor. (Greppable: the descriptor module exports nothing those packages consume.)
2. **No geometry name as a decision key.** Forbidden: `if (geom.straightFloor > X) raiseMore()`,
   `FOLD_RATES[geom.flushState]`. Same class as the §10/§13 mistakes in POKER_THEORY.md and
   AP-RL-01. Leverage is *computed* from equity + pot odds + SPR; geometry only *names* the
   region for the human.
3. **Descriptor must agree with the engine, not override it.** If the descriptor says
   "two-way straight-dense" but the strength table shows the caller has no straight combos, the
   strength table wins and the descriptor is the bug.
4. **Priors only, downstream of computed factors.** If geometry ever informs a *prior* (e.g.,
   default sizing suggestion absent player data), it must yield to any observed/computed factor —
   the §7.4 fidelity hierarchy.

---

## 11. Open questions for a Gate-1 entry

1. **Does the vocabulary earn its keep in prose?** The cheapest test: hand-write the descriptor
   for ~6 canonical boards and see whether the resulting template sentences teach more than the
   current single `boardTexture` label. (Do this before any build.)
2. **Effective-dimensionality definition** — ship the coarse liveness vector first, or invest in
   the variance decomposition immediately?
3. **Flush floor on partial info** — online/unknown-villain spots may lack the per-combo basis;
   does the descriptor degrade gracefully to a coarse flush-state?
4. **Cross-street transition surfacing** — is the transition ("the turn collapsed the dimension")
   a HandReplay artifact, a drill, or both?
5. **Persona fit** — which persona/JTBD does the geometry vocabulary serve? (Gate-1 gap question.)

---

## 12. Relationship to existing doctrine

- **Extends** POKER_THEORY.md §3.1 (board texture) with a finer, computed, evolving layer — does
  not replace it.
- **Consistent with** §3.2 (range vs nut advantage): geometry is a sharper lens on the same split.
- **Bound by** §7 (first-principles) and AP-RL-01 (§7.6): descriptor is output, never input.
- **Operationalizes** the river-equity memory (strength-tier distribution) as the 5-flush /
  dimensional-collapse case.
- **Sibling to** the HSP archetype system: a presentation-only name for a region of computed
  space.
