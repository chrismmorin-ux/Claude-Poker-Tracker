# Guide to: the straddle structure — Wind Creek Southland 1/3 NL (optional $6–15, UTG priority) and 1/3/6 mandatory, preflop, all seats

**Status: the structural half is exact and usable at the table today. The behavioural half has
never been measured and every one of its cells is `unexamined`.** That split is the honest
state of knowledge, not a staging decision — see §5.

This is the first Guide emitted at a real conditioning set. `GUIDE-STANDARD.md §6` predicted
that the first instance would be the first genuine test of the form and should be expected to
change it. It did, immediately: see §4.

---

## §0 Standing

```guide-standing
{
  "conditioning": {
    "game": "NLHE 1/3, Wind Creek Chicago Southland, 9-handed, $100-500 buy-in; two structures: optional straddle $6-15 with UTG priority over BTN, and 1/3/6 mandatory UTG straddle",
    "position": null,
    "subject": "the straddle structure itself (forced money that carries no range information)",
    "field": null,
    "geometry": "preflop, before any voluntary action"
  },
  "marginalizes_over": ["position", "field", "stack size within the $100-500 band", "straddle size within $6-15 where not stated"],
  "weighting": "uniform",
  "authority": "derived-structure",
  "census": {
    "observed-zero": 1,
    "unexamined": 11,
    "dropped": 0
  }
}
```

`position: null` and `field: null` are open on purpose. This Guide is about the *structure*,
which is prior to both — every seat and every field meets the same pot geometry. Filling those
slots is what a child Guide does.

**`weighting: "uniform"` is true but understates, and the understatement is a finding about the
form.** §2.1's results are not *marginalized* over position and field — they are **invariant**
to them. Dead money, governing blind, effective depth and required fold equity at a given
multiple are pot geometry; they take the same value at every seat against every field. An
invariant quantity returns the same answer under *any* weighting, so `uniform` is not false —
but it invites a reader to ask what frequency-weighting would give, and the answer is "the same
number", which the form cannot say.

`check-guide-ledger.mjs:250` admits only `frequency` and `uniform`. There is no `invariant`.
So a claim that holds identically across a dropped slot must currently disguise itself as an
average over that slot. `GUIDE-STANDARD.md §6` predicted the first real instance would change
the file; this is the change it asks for. The invariance is stated as a falsifiable claim in §6
rather than left in the standing block where nothing can check it.

---

## §1 Occupancy

> Occupancy — the nodes the subject actually lives through, weighted by frequency, given a Field.

| Node | Occupancy | Basis |
|---|---|---|
| 1/3/6 mandatory — every hand dealt | **1.000** | `structure` — mandatory, by house rule |
| 1/3 optional — a straddle is posted | `unexamined` | never instrumented |
| 1/3 optional — the straddle size chosen, given one is posted | `unexamined` | never instrumented |
| 1/3 optional — UTG straddles, blocking a BTN straddle | `unexamined` | never instrumented |
| Table-collective straddling (the ">3 straddlers" regime) | `unexamined` | founder-reported, never counted |
| Any straddled node, in the 2009 online corpus | **`observed-zero`** | measured: 1,750,645 hands, max 2 posted blinds, zero exceptions |

**The `observed-zero` row is the load-bearing one.** It is not `unexamined`. We looked at the
entire corpus and found none — FTP and PokerStars did not offer straddles in 2009. No amount of
corpus mining will ever produce a straddled hand, so the behavioural half of this Guide cannot
be filled from the corpus **at any n, ever**. It can only come from live capture or simulation.

**Field stamp:** none of the behavioural rows carries a Field, because none has been measured.
Any figure later imported from the 2009 online corpus into a straddled node is **transferred,
not measured**, and doubly so: that corpus is a different population *and* a different structure.

---

## §2 Resolution

### 2.1 Resolved — pure pot geometry, warrant `structure`

Exact. No behavioural input, no estimation, no Field. $300 stack (mid-band).

| S (straddle) | dead money | governing blind | dead ÷ blind | depth in governing blinds | need @2× | need @3× | SPR after 3× + one call |
|---|---|---|---|---|---|---|---|
| **$0** (no straddle) | $4 | $3 | 1.333 | **100** | 60.0% | 69.2% | 13.23 |
| **$6** | $10 | $6 | **1.667** | **50** | **54.5%** | **64.3%** | 7.05 |
| $8 | $12 | $8 | 1.500 | 38 | 57.1% | 66.7% | 5.31 |
| $10 | $14 | $10 | 1.400 | 30 | 58.8% | 68.2% | 4.22 |
| **$12** | $16 | $12 | **1.333** | **25** | 60.0% | 69.2% | 3.47 |
| **$15** | $19 | $15 | **1.267** | **20** | **61.2%** | **70.3%** | 2.71 |

Three exact results follow. Each is closed-form arithmetic on the blind structure and carries
warrant `structure`.

*(An earlier draft added "and none of them is in published live doctrine". That was an
assertion about a literature nobody here has surveyed, carrying no warrant, and it is removed.
Whether these are novel is `unexamined` and recorded as such in §5.)*

**R1 — the $12 crossover.** `dead ÷ governing blind` equals the unstraddled 1.333 at exactly
**S = $12**. Below $12 a straddle *raises* relative dead money; above $12 it *lowers* it. At $15
the straddle is **worse than not straddling** on steal pricing (61.2% vs 60.0% required at 2×).
Derivation: `(4 + S)/S = 4/3 ⟹ S = 12`.

**R2 — the two levers diverge.** Dead money is non-monotone in S (peaks at the minimum
straddle); depth is strictly monotone (collapses without limit). So **$6 is the dead-money
lever and $15 is the depth lever**, and they are not the same instrument. A player who
straddles $15 "for more action" has bought a 20-blind game and *given back* fold equity.

**R3 — the game is half as deep as every chart assumes.** A $300 buy-in is 100 BB unstraddled
and **50 governing blinds** at $6, **20** at $15. `PREFLOP_CHARTS`
(`src/utils/pokerCore/rangeMatrix.js:275-285`) are position-keyed 169-cell grids carrying **no
depth, pot, or open-size parameter at all**. Every chart in this repo is being read at a depth
it does not model.

### 2.2 Mandatory vs optional — a selection difference, warrant `structure`

| | 1/3/6 mandatory | 1/3 optional |
|---|---|---|
| straddler's **cards** | uniform | uniform |
| straddler's **player type** | a random seat | **selected — action players** |

A straddle is uninformative about the hand in both games. In the **optional** game it is highly
informative about the *player*, because posting one is a voluntary act taken by a self-selecting
subset. In the **mandatory** game that selection is stripped out entirely.

Consequence: the mandatory game is the clean case for measuring straddle behaviour, and the
optional game is where a read is available *for free* before any card is dealt.

### 2.3 Unresolved — every behavioural quantity

| Node | Status | Criterion that would resolve it |
|---|---|---|
| Fold-to-open by seat, in a straddled pot | `unexamined` | ≥40 players × ≥40 decisions per (seat, size) cell |
| Straddle-defence frequency and range | `unexamined` | same |
| Whether the field adjusts open sizes to S | `unexamined` | within-player, across S |
| Whether regulars misapply 100bb ranges at 20 governing blinds | `unexamined` | showdown ranges by depth band |
| Isolation frequency against a straddler | `unexamined` | live capture |

---

## §3 Decision Load

> Occupancy-weighted unresolved mass.

In **1/3/6 the occupancy of the straddled node is 1.000** — every hand. Multiply that by §2.3,
where every behavioural cell is unresolved, and the decision load of this structure is
**maximal**: the most frequent node in the founder's home game is the one with the least
evidence behind it.

That is the finding of this Guide. Not that the straddle is complicated — that it is
**universal and unmeasured at the same time**, which is the worst combination available.

The structural half (§2.1) does discharge part of that load, and it discharges the part that
does not need data: sizing, pricing, and depth are answerable today.

---

## §4 Residual clause

States this Guide does not reach: straddle sizes outside $6–15; re-straddles; games where the
BTN straddle is permitted without UTG priority; and any node after the first voluntary action
(this Guide's geometry slot ends there).

**And one the standard itself does not reach.** `GUIDE-STANDARD.md §4bis` places "guides whose
subject is continuous rather than classed" outside the standard's scope. **Straddle size is
continuous** ($6–15). This Guide therefore sits partly in the standard's own declared scope
hole, and it discretises S to a six-point lattice to stay inside the form. The lattice is a
presentational choice, not a measured structure — R1's crossover is exact and does not depend
on it. This is the first instance the standard predicted would change it.

---

## §5 Census

| Row | Status | Reason |
|---|---|---|
| Straddled hands in the 2009 corpus | `observed-zero` | measured; 1,750,645 hands, max 2 posted blinds |
| Straddle posting frequency, 1/3 optional | `unexamined` | never instrumented |
| Straddle size distribution | `unexamined` | never instrumented |
| Fold-to-open in a straddled pot | `unexamined` | no data source exists |
| Straddle-defence range | `unexamined` | no data source exists |
| Field adjustment of open size to S | `unexamined` | no data source exists |
| Isolation frequency vs a straddler | `unexamined` | no data source exists |
| Regulars' depth misapplication | `unexamined` | no data source exists |
| Table-collective straddling regime | `unexamined` | founder-reported only |
| Rake interaction at $6 cap / $20 drop threshold | `unexamined` | structure known, effect uncomputed |
| Whether R1-R3 are novel vs published live doctrine | `unexamined` | no literature survey has been done by anyone here |
| Whether the form can express invariance | `unexamined` | `check-guide-ledger.mjs:250` admits only `frequency`/`uniform`; no `invariant` value exists |

**One `observed-zero`, eleven `unexamined`, zero `dropped`.** The distinction is doing real work
here: the corpus row is a measured absence that closes a door permanently, while the other nine
are open doors nobody has walked through.

---

## §6 Falsifiers

| Claim | How it dies |
|---|---|
| **R1 — the $12 crossover** (`structure`) | Arithmetic: show `(4+S)/S = 4/3` at any S ≠ 12. Dies only if the blind structure is not 1/3. |
| **R2 — dead money non-monotone, depth monotone** (`structure`) | Same. Both are closed-form in S. |
| **R3 — charts carry no depth parameter** (`structure`) | Find a depth, pot, or open-size argument in `rangeMatrix.js` `PREFLOP_CHARTS`. |
| **"The corpus can never supply a straddled hand"** (`structure`) | One hand in the 1,756-file corpus with three or more non-zero posted blinds. Scanned: zero. |
| **"Mandatory strips the player-type selection"** (`structure`) | Show straddlers in a mandatory game differ from non-straddlers — impossible by construction, since there are none. Dies only if the house rule is misreported. |
| **"$15 is worse than not straddling on steal pricing"** (`structure`) | 61.2% > 60.0% is arithmetic; dies if the comparison should be made at equal *dollar* risk rather than equal multiple of the governing blind. **This is the live one** — the choice of denominator is a modelling decision, not a fact, and it is the assumption most likely to be wrong in this document. |
| **"Decision load is maximal here"** (§3) | Measure occupancy of other 1/3 nodes and find one both more frequent and less resolved. |
| **"§2.1 is invariant to position and field, not marginalized over them"** (§0) | Exhibit one seat, or one Field, at which dead money, governing blind, effective depth, or required fold equity at a fixed multiple of the governing blind takes a different value. If none exists the claim holds and the standing block's `uniform` is an artefact of the form, not of the arithmetic. |

**Largest untested gap:** every behavioural claim a player would actually want — how wide to
defend a straddle, how much to isolate, whether regulars misplay the depth — is `unexamined`,
and no existing data source can resolve any of them. The three named routes are live capture
(currently drops the straddler's decision — `predictionAudit/reconstruct.js:330-333`),
simulation (currently impossible — the mined policy contains zero preflop decisions,
`decisionAccumulator.js:289`), and direct play.

---

## Change log

- **2026-08-20** — created. First Guide emitted at a real conditioning set. Structural spine
  exact; behavioural half entirely `unexamined`. Exposed two gaps in `GUIDE-STANDARD.md` on
  first contact: a continuous subject (§4bis) and no way to declare invariance (§0).
