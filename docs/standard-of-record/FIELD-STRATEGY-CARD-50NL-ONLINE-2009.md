# The FIELD's Strategy Card — 50NL online, July 2009

> ### This is not one villain. It is 350 players averaged together.
> Read §0.1 before anything else.

**Date:** 2026-08-17 · **Program:** `prog-strategy-of-record`
**Register:** [VOCABULARY.md](VOCABULARY.md) · **Design record:** [villain-strategy-inference-2026-08-17.md](../research/villain-strategy-inference-2026-08-17.md)
**Status:** **PROSE SPECIMEN — not a loadable `.card.js`.** See §6.

> A **Strategy Card** is a declared, enclosed, warranted rule set. This is the **Field's** card
> — the register term for *who occupies the other seats*. It states what the opposition
> does **in aggregate**. It is written here as prose because the executable form cannot be
> authored yet: its largest branch does not exist (§5), and it has no per-villain form
> at all (§0.1).

---

## §0.1 THE POOLING — read this first

**Every number in this document is 350 players added together.**

`mineLikelihoodTables` (`teachableArmsProbe.mjs:193`) walks every pool player and increments
one global counter — `counts4[vAction][cls]++`. There is no player key anywhere in the table.

| | PokerStars | Full Tilt |
|---|---|---|
| Pool players | 350 | 350 |
| Showdown-revealed decisions | 3,762 | 5,732 |
| **Decisions per player** | **10.7** | **16.4** |

**About eleven revealed decisions per player.** That is not enough to characterise anyone, so
pooling was not a modelling preference — it is the only thing the sample supports. The same
starvation is recorded independently as `medianRevealedPerPlayer: 13`
(`per-player-width-2026-08-05.result-card.json`).

**It is also pooled across strata.** §3 measures two poles — 76.7% tight/foldy and 23.3%
loose/sticky — with materially different fold-to-3bet (85.4% vs 66.4%) and fold-to-cbet
(57.6% vs 49.2%). Rules 1–4 are a frequency-weighted blend of both. **No player in the corpus
is described by this card.** It describes the average of a population that is measurably not
homogeneous.

**A per-villain card does not exist and cannot be authored today.** That is the entire point of
WS-527: recovering holdings on folded hands raises per-villain evidence from ~11 revealed
decisions to every decision the player made. Until then, "what does *this* villain do" has no
answer in this repo, and any document claiming one would be this card wearing a name.

---

## §0 Domain, and what this card refuses

**Declared domain.** Postflop decisions (flop onward, board ≥ 3 cards) by players drawn from
the HandHQ July-2009 50NL pool, PokerStars and Full Tilt, **conditional on the hand having
reached showdown**. Heads-up and multiway pooled. Positions pooled. Bet sizings pooled. **Players pooled (§0.1).**

**Outside the domain this card ABSTAINS EXPLICITLY**, and the abstentions are counted, because
a card that quietly returns nothing looks identical to a card that had no opinion:

| Branch | Status | Why |
|---|---|---|
| **Folding** | `unexamined` — **the entire branch** | Folded hands never reveal. `foldRevealRate: 0`. |
| Preflop | `unexamined` | Card's domain starts at the flop. |
| Position splits | `unexamined` | Pooled; no per-position table mined. |
| Sizing / SPR splits | `unexamined` | Pooled; geometry mined but not conditioned on here. |
| Multiway vs heads-up | `unexamined` | Pooled. |
| River vs flop vs turn | `unexamined` | Pooled across streets. |
| Live 9-handed 1/2–1/3 | `unexamined` | Different population entirely. **Transferred, never measured.** |
| **Any individual villain** | `unexamined` | **350 players pooled at ~11 decisions each. See §0.1.** |

**The fold abstention is the important one.** Folding is the majority of what a villain does, and
this card says nothing about it. Everything below describes a villain who is still in the hand.

---

## §1 What the villain does — in his words

Each rule states the villain's own implicit policy, then the number behind it. `n` is the count
of showdown-revealed decisions on PokerStars (n = 3,762 total). Full Tilt (n = 5,732) agrees
within ~2pp on every row.

> **Voice note.** The rules are written in the first person because that is how a policy reads.
> The "I" is **the field's average member** — a statistical construct, not a person.

### Rule 1 — "If I raise, I have it."

> *"I don't raise without a hand."*

**P(raise | strong) = 12.2%** (n=208) · **medium 3.2%** (n=47) · **weak 1.0%** (n=6)
Base rate 6.9%. Strong hands raise **1.76×** the base rate; weak hands **0.15×**.

**Warrant:** `read` — a claim about a population number, falsifiable against the corpus.

**The inverse, which is what you actually use at the table:** when this villain raises,
**79.7% of the time he is strong**, 18.0% medium, **2.3% weak**. Six bluff-raises in 3,762
decisions.

### Rule 2 — "If I'm weak, I check and hope."

> *"Nothing here. I'll take a free card."*

**P(check | weak) = 71.8%** (n=412) · medium 56.8% (n=844) · strong 35.0% (n=595)
Base rate 49.2%. Weak hands check **1.46×** base; strong hands **0.71×**.

**Warrant:** `fear` — this is the founder's standing reading, and the repo's doctrine is that
fear is declared rather than hidden inside an `equity` rule whose arithmetic does not support
it. A weak hand checking 72% of the time is not an equity calculation; it is a player
unwilling to be raised.

**Inverse:** a check is **45.6% medium, 32.1% strong, 22.3% weak.** A check is the *least*
informative action this villain takes — it is the only one whose posterior stays close to the
prior.

### Rule 3 — "I bet when I like my hand, but I bet a lot anyway."

**P(bet | strong) = 31.8%** (n=541) · medium 20.7% (n=308) · weak 17.2% (n=99)
Base rate 25.2%. **The spread is narrow — 1.26× down to 0.68×.**

**Warrant:** `read`.

**Inverse:** a bet is **57.1% strong, 32.5% medium, 10.4% weak.**

**This is the softest rule on the card, and that is the finding.** Betting separates hand
classes far less than raising does. Corroborated independently: c-bet frequency is
**57.0% vs 56.7%** across the pool's two poles — *how often someone c-bets carries almost no
type information* (`player-archetypes-empirical-2026-07-26.md`).

### Rule 4 — "I call with anything I can talk myself into."

**P(call | strong) = 21.0%** (n=358) · medium 19.3% (n=287) · weak 9.9% (n=57)
Base rate 18.7%. **Strong and medium are nearly indistinguishable** — 1.13× vs 1.04×.

**Warrant:** `read`.

**Inverse:** a call is **51.0% strong, 40.9% medium, 8.1% weak.** Calling separates strong from
medium *worse than any other action on this card*.

---

## §2 The residual clause

> **For every state inside the domain that Rules 1–4 do not reach, the villain is assumed to
> act at the pooled base rate for that action, independent of his holding.**

Base rates: check 49.2%, bet 25.2%, call 18.7%, raise 6.9%.

The residual's share is a headline metric — *how much of the money comes from the part nobody
designed.* It is **not computed here**, because computing it requires the EV attribution this
card is not yet wired into. `unexamined`.

---

## §3 Which villain — the strata

The pool is a **continuum with one dominant axis**, not a set of types: k-means over six
canonical stats, 1,390 players, **silhouette 0.3428 at k=2** — twice as good as any other k,
inertia falling with no elbow. Discrete archetype names are therefore refused here; the register
term is **Stratum**.

| Pole | Share | vpip | pfr | 3bet | foldTo3Bet | cbet | foldToCbet |
|---|---|---|---|---|---|---|---|
| Tight / foldy | 76.7% | 19.9% | 12.3% | 3.6% | 85.4% | 57.0% | 57.6% |
| Loose / sticky | 23.3% | 40.5% | 19.6% | 5.8% | 66.4% | 56.7% | 49.2% |

**The separating axis is looseness and stickiness together.** The loose pole also folds far less
to 3-bets (66% vs 85%) and to c-bets (49% vs 58%).

**Rules 1–4 above are pooled across both poles.** Splitting them by stratum is `unexamined`.

**A warning carried from the same study:** the six authored `classifyStyle` archetypes do **not**
match this structure. Cluster purity **0.63 / 0.44**; TAG is 54% of the pool and spans both
poles; **21% of players fall through all six buckets**; the natural loose group is shattered
across four labels. `Fish = vpip > 40` cuts through the loose centroid of **40.5%**. Do not use
those labels as the group level for this card.

---

## §4 What it costs to write it this way

This card is 12 numbers. The engine is not. The gap is measurable and has been measured —
Δlog P(true holding) vs uniform, one narrowing step, same decisions, held-out players:

| Arm | PS (n=3,703) | FTP (n=5,403) |
|---|---|---|
| A0 — no narrowing | 0.5445 | 0.6976 |
| A2 — legacy 20-number table | 0.5975 | 0.7500 |
| **A3 — this card's 12 numbers** | **0.6147** | **0.7596** |
| A4 — A3 + check position (15 numbers) | 0.6179 | 0.7624 |
| A1 — engine, as shipped | 0.6762 | 0.8105 |

**This card recovers 53.3% (PS) and 54.9% (FTP) of the engine's gain over no narrowing.**
Writing the villain's strategy in twelve human numbers costs roughly **46% of the narrowing
signal**.

A4's three extra numbers buy ~0.003 nats — **near-zero**. Adding detail in this basis is not
what closes the gap; a different basis might be.

---

## §5 The load-bearing defect

Every number on this card is conditioned on **the hand having reached showdown**, and reaching
showdown is *downstream of the action taken*. That is a collider. Conditioning on it deletes
exactly the cases where the action worked — **a bluff that takes the pot is never shown.**

So Rule 1's "2.3% of raises are weak" is not the villain's bluff-raise frequency. It is his
**caught** bluff-raise frequency. The true rate is higher by an unknown factor, and the factor
is larger for actions that win more often without showdown — which is to say, larger exactly
where it matters most.

The same defect explains the missing fold branch: `ACTIONS4 = ['raise','call','check','bet']`
(`teachableArmsProbe.mjs:63`) has no `fold` because a folder never shows.

**More corpus does not fix this.** 12.9M hands makes these numbers tighter, not truer. What
fixes it is inferring holdings on hands that never reached showdown — WS-526/WS-527.

**The showdown-conditioned class prior is itself contaminated:** strong 45.2%, medium 39.5%,
weak 15.3%. That is *not* the composition of a villain's range. It is the composition of the
hands he took to showdown.

---

## §6 Census — and why this is prose

| Rows | Count |
|---|---|
| `observed-zero` | 0 |
| `unexamined` | 9 (fold branch, preflop, position, sizing/SPR, multiway, street, stratum split, residual share, **per-villain identity**) |
| `dropped` | 0 |

**Why this is not a loadable `.card.js`.** The executable form requires *total coverage inside
the declared domain* and a residual clause with a computed share. This card's largest branch —
folding — is `unexamined` rather than declared, so its coverage is not total and the loader
would reject it. That rejection is correct and the file is not being forced past it.

**Why it is not a Guide either.** `docs/guides/GUIDE-STANDARD.md` §0.3: the lattice runs
bottom-up — *the specific is authoritative, the general is the marginal.* This card marginalizes
over position, geometry, street and stratum, and **the children it would marginalize over do not
exist.** Publishing it under `docs/guides/` would be authority borrowed by deletion, which is the
exact failure `prog-guide-authority` was created to stop.

It becomes a Guide when its children are measured. It becomes a `.card.js` when the fold branch
is inferred.

---

## §7 Provenance

Numbers read directly from `docs/standard-of-record/data/teachable-arms-{ps,ftp}.json`
(`a3Table`, `arms`) and `docs/research/player-archetypes-empirical-2026-07-26.md`, 2026-08-17.
Inverse conditionals computed from the same tables' `actionTotals`.

**No Result Card backs the teachable-arms figures.** The data files carry tables, arm scores and
counts but no replication manifest — `teachableArmsProbe.mjs` imports `buildResultCard` but no
card is committed. Until WS-532 emits one, §1 and §4 have provenance but no manifest, and this
document says so rather than implying otherwise.
