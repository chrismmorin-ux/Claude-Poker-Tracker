# Guide to: ⌀

**Every slot empty.** This is the maximally general element of the guide lattice — the guide
you get when every qualifier has been removed. Because the slot rule (§0.2) says a word may
only leave a title if the guide carries what it marginalized over, and because this document
has no children to marginalize, it inherits no authority from below. **It is authored, and it
says so.** Every other guide in this repo must be derived; this one may not be, and that
exemption is the single privilege the root holds.

> **Status:** v1, 2026-08-16 · **Program:** `prog-guide-authority` · **Governing rulings:** founder, 2026-08-16
> **Standard of Record:** [VOCABULARY.md](../standard-of-record/VOCABULARY.md) — terms below are registered there, not coined here.

---

## §0 Standing

### §0.1 What a Guide is

> **A Guide is a VIEW, not a record.**

It renders four things at a stated conditioning set: a **Strategy Card** (the rule set), an
**Occupancy** measure (where the time goes), a **Resolution** verdict per node (forced or
chosen), and a **Census** (what was looked at, including what was not). The record underneath
is the Decision Atom set. If answering a new question about a guide requires re-running rather
than re-viewing, the record was the wrong shape — not the guide.

This matters for a reason that is easy to lose: a Guide is not a new artefact class competing
with the Result Card. It is a *reading* of one. Its authority is the replication manifest of
the cards it views, and it has no other source.

### §0.2 The title is the conditioning set — and the slot rule

A guide's title is its **Disclaimer** written longhand. The slots are the estimand:

```
Guide to: playing <GAME> <POSITION> holding <SUBJECT> against <FIELD> at <GEOMETRY>
```

Any slot may be left open. **An open slot is a marginalization, and marginalization is not
free.**

> **THE SLOT RULE.** A word may leave a guide's title only if the guide carries
> **(a)** the set of guides it marginalizes over, and **(b)** the **Weighting** it did so
> under — `frequency` or `uniform`, per the register.

The reason is mechanical, not stylistic. "Guide to QQ" is not a shorter version of "Guide to
QQ against a tight-passive opponent." It is *an average over opponent types, weighted by how
often each is faced* — and that weighting is a substantive empirical claim about the field.
Delete the word without carrying the weighting and the general statement wears the specific
statement's credibility while resting on an unstated and unmeasured assumption.

That is the WS-291 mechanism, which this repo already paid for once: *nothing forced two
numbers onto the same axis, so a wrong number never had to meet a right one.* Deleting a
qualifier is a faster route to it than inventing a bad instrument, and the output reads **more**
authoritative rather than less. The slot rule exists to make the deletion expensive.

**An unnamed slot is worse than an open one.** If a guide never mentions stack depth, the
reader supplies 100bb unconsciously and no mark anywhere says the claim was marginalized.
Every slot the form does not have is a blind spot by construction — which is why "what slots
are missing?" is a standing question in the program's blind-spot protocol rather than a
one-time design task.

### §0.3 The lattice runs bottom-up

**The specific is authoritative. The general is the marginal.** A guide at a less-specific
conditioning set is *derived by re-marginalizing its children*, never authored and then
specialized. A hierarchy level whose stated figures do not reproduce when the marginalization
is re-run is a finding, not a rounding difference.

This inverts the direction of the repo's subclass doctrine, and the inversion is deliberate
rather than an oversight — the two answer different questions:

| | Direction | Question it answers |
|---|---|---|
| Range-engine subclasses (DEC-025 Amd 1) | Child shrinks toward parent | *Estimation under sparse data* — what do I believe about a cell I have 3 observations of? |
| Guide lattice (here) | Parent is the marginal of children | *Marginalization of a measured joint* — what is true across cells I have measured? |

They coexist because they are not the same operation. Where they meet — a cell with **n=0** —
the founder ruled on 2026-08-16 in favour of the Census:

> **An n=0 cell reports `unexamined`. It does not inherit the general guide's value.**

The guide gets visibly holey. That is the intended outcome: the holes become the work queue,
and a guide that claims to have looked everywhere has not looked.

### §0.4 The standing block — declared as data, never as prose

Every Guide carries a fenced ` ```guide-standing ` JSON block. The monitor
(`scripts/standardOfRecord/check-guide-ledger.mjs`) reads **that**, not the surrounding
prose. Grepping prose for "weighting" would pass on the word appearing in a sentence that
*disclaims* it, and the repo's own doctrine is that a classifier of this kind ships as data
plus a checker, never as prose.

Every one of the five slots must be **present**, explicitly `null` when open. An omitted
slot is worse than an open one and the monitor treats it as its own violation
(`UNDECLARED SLOT`): a reader supplies the default unconsciously and nothing anywhere marks
the claim as marginalized.

This document's own standing — conditioning empty, nothing marginalized, no inheritance
claimed:

```guide-standing
{
  "conditioning": {
    "game": null,
    "position": null,
    "subject": null,
    "field": null,
    "geometry": null
  },
  "marginalizes_over": [],
  "weighting": null,
  "authority": "authored-root",
  "census": {
    "observed-zero": 0,
    "unexamined": 6,
    "dropped": 0
  }
}
```

`authority: authored-root` is the **one** privilege in the whole form: this document is
authored rather than derived, because it has no children to marginalize. The monitor caps
it at exactly one document — a second authored root would be the slot rule with an opt-out,
and §6 records that this exemption is the live risk to `AS-733`.

---

## §1 Occupancy

> **Occupancy** — the measure over the situations the subject actually lives through, given a
> Field. Not the situations it *could* meet; the ones it *does*, weighted by frequency.

This is the section a chart does not have, and its absence is what makes a chart a chart. A
policy says what to do at a node. Occupancy says which nodes you will stand at, and how often,
which is a property of the subject **and the population it is played into**. Two players with
identical strategies have different occupancy measures if their tables differ.

That is why a Guide can be proprietary in a way a chart never can. It is also why every
occupancy figure carries a Field stamp, and why an occupancy figure sourced from the 2009
online corpus is **transferred, not measured**, and must say so.

### §1.1 This document's own occupancy

Where does the time of a person *using* this standard actually go — across authoring a guide
and reading one?

| Node | Occupancy | Basis |
|---|---|---|
| Authoring §1 Occupancy | `unexamined` | never measured |
| Authoring §3 Decision Load | `unexamined` | never measured |
| Reading §0.2 the slot rule | `unexamined` | never measured |
| Resolving an n=0 cell | `unexamined` | never measured |
| Everything else | `unexamined` | never measured |

**Every row is `unexamined`, and that is the correct output.** No one has instrumented guide
authoring or guide reading in this repo. Under §0.3's ruling, the honest report is that the
measure does not exist — not an estimate, not an inherited default, not a plausible guess.

The alternative was available and was rejected on purpose: this table could have been filled
with confident-looking percentages that no instrument produced, and it would have read as
authoritative. That it does not is the standard demonstrating its own discipline in the first
place a reader can check it.

---

## §2 Resolution

> A node is **resolved** when the correct action is forced — the alternatives separate by more
> than the measurement can confuse them. It is **unresolved** when the choice is genuinely
> live: the measurement declines to separate the options, and something outside the node has
> to decide.

The word is inherited, not coined: `hand-class-99-TT-JJ.md` §6 already labels a spot
`UNRESOLVED` when its interval cannot separate bet from check, and states plainly that *"that
label is a result, not a gap."* A Guide adopts the same reading. **Most occupied nodes are
resolved**, and saying so is the point — it is what lets a guide say "the strategy here is
mostly automatic" and mean something falsifiable.

Resolution requires an indifference criterion. Postflop, the neutral-zone machinery exists
(POKER_THEORY §15.2, exercised in the 99/TT/JJ study §6). **Preflop it does not**, and that gap
is on the program's build list rather than papered over with a threshold.

### §2.1 This document's own resolution

| Authoring decision | Verdict | Why |
|---|---|---|
| Which sections a guide has | **resolved** | Forced by §4's required list. No choice available. |
| Whether a dropped slot needs a Weighting | **resolved** | Forced by §0.2. The rule admits no exception. |
| What an n=0 cell reports | **resolved** | Founder ruling, 2026-08-16. |
| **Which slots the title schema has at all** | **UNRESOLVED** | §0.2 names the danger and does not close it. The current five slots were authored in one session. |
| **How specific a cell may get before it is useless** | **UNRESOLVED** | Split the lattice finely enough and every cell is `unexamined`. No stopping rule exists. |
| **Whether prose can be forced without becoming ceremony** | **UNRESOLVED** | The founder asked for "prose-forced maximal description." The failure mode is a warrant tag on every sentence. |

---

## §3 Decision Load

> **Decision Load** — the occupancy-weighted mass of *unresolved* nodes. The part of the
> subject that is actually a decision rather than an execution.

This is the content of "playing TT" as distinct from "the TT chart." It is what fills the
founder's sentence *"the rough decisions mostly come from bluffcatcher, which arise when XYZ
line happens."*

**The structural claim the form rests on** (registered as `AS-730`, status `proposed`):

> Decision load is **not** proportional to occupancy. A subject's genuinely-chosen decisions
> concentrate in nodes it occupies relatively rarely; the nodes it occupies most often are
> disproportionately forced.

If that is false — if load tracks occupancy linearly — then a Guide collapses into a chart with
prose around it and this whole form has no reason to exist. It is stated here, before any Guide
has been emitted, so that it can fail publicly. Its falsifier, threshold and control case are in
`prog-guide-authority.yaml`.

### §3.1 This document's own decision load

Load is `occupancy × unresolved`, and §1.1 reports every occupancy row as `unexamined`.
**Therefore this document's decision load is `unexamined`, and cannot be computed.**

It is worth sitting with that rather than routing around it. The three unresolved authoring
decisions in §2.1 are real and consequential; what is missing is any measure of *how much they
cost*, because nothing has measured where guide-authoring effort goes. The unresolved list is
not the load. The load is the unresolved list weighted by occupancy, and half of that product
does not exist yet.

---

## §4 Required sections

A Guide is well-formed when it carries, in this order:

| § | Section | Required content |
|---|---|---|
| 0 | **Standing** | A ` ```guide-standing ` JSON block (§0.4) — all five slots present, `marginalizes_over`, `weighting`, `authority`, `census` counts. Machine-read; prose alongside it is commentary |
| 1 | **Occupancy** | The measure over nodes, with Field stamp; `unexamined` where absent |
| 2 | **Resolution** | Per occupied node: resolved or unresolved, with the criterion named |
| 3 | **Decision Load** | Occupancy-weighted unresolved mass — the actual content |
| 4 | **Residual clause** | The declared fallback for states the named rules do not reach |
| 5 | **Census** | Coverage, with `observed-zero` / `unexamined` / `dropped` kept distinct |
| 6 | **Falsifiers** | Claim → how it dies |

Every statement of consequence carries a **Warrant** — `equity` \| `structure` \| `read` \|
`fear`. `fear` is legal and its legality is load-bearing: outlaw it and fear does not leave the
guide, it hides inside an `equity` claim whose arithmetic does not support it, where nothing can
find it.

### §4bis Residual clause (this document's)

States this standard does not reach: guides that are not about a subject at all (a guide to a
*process*, a guide to a *decision*); guides whose subject is continuous rather than classed;
and any artefact making a conditioned claim that lives outside `docs/guides/`. The last is a
known scope hole — scope was drawn around a directory, and a directory is not a claim boundary.
It is a standing question in the program's blind-spot protocol.

---

## §5 Census

| Row | Status | Reason |
|---|---|---|
| Guide authoring occupancy | `unexamined` | never instrumented |
| Guide reading occupancy | `unexamined` | never instrumented |
| Whether the five title slots are sufficient | `unexamined` | authored in one session, never tested against a real guide |
| Whether AS-730 holds | `unexamined` | no Guide has been emitted at a complete conditioning set |
| Whether this document validates against its own grammar | `unexamined` | no validator exists |
| Preflop indifference criterion | `unexamined` | machinery is postflop-only |

**Six rows, all `unexamined`, zero `observed-zero`.** Nothing here has been looked at and found
empty; it has simply not been looked at. Collapsing those two into one number is the failure the
Census exists to prevent, and a standard that blurred them in its own coverage record would have
no standing to demand the distinction elsewhere.

---

## §6 Falsifiers

| Claim | How it dies |
|---|---|
| **"Decision load is not proportional to occupancy"** (§3, `AS-730`) | Rank correlation between per-node occupancy and per-node unresolved mass above 0.8 across three hand classes. Must be computed on **nodes**, not hands — a hand-level correlation would be dominated by deal frequency and would not test the claim. **The load-bearing one: if this dies, the form dies with it.** |
| "Every useful general statement is a weighted marginal of specific ones" (§0.3, `AS-731`) | One clearly-true, clearly-useful general claim shown not to be a weighted marginal of anything. Suspicion worth holding: claims about the *shape* of the distribution across cells may resist marginalization entirely. |
| "Visible holes become the work queue" (§0.3, `AS-732`) | More than 20 standing `unexamined` rows with fewer than 3 queue items referencing them, across two sweeps. Then the ruling is decorative. |
| "The form is self-describing without special-casing" (`AS-733`) | This document needing an exemption clause to validate against its own grammar. **Partially at risk already** — the header claims one privilege for the root (it is authored, not derived). Whether that is a legitimate base case or a disguised exemption is exactly what the first validator run decides. |
| "A Guide is a view, not a record" (§0.1) | A question about a guide that requires re-running rather than re-viewing. Then the atom set is the wrong shape. |
| "Occupancy is what makes a Guide non-generic" (§1) | Two subjects with materially different occupancy measures producing materially identical Guides. Then occupancy is not doing the work claimed for it. |

**Largest untested gap:** no Guide has ever been emitted at a complete conditioning set. Every
claim in this document is a claim about a form that has been instantiated zero times. The first
real instance is the first genuine test, and it should be expected to change this file.

---

## Change log

- 2026-08-16 — v1 authored. Founder directives: the guide form becomes a program with
  blind-spot detection; naming to be deliberate; the title-slot lattice with authority
  propagating through deletion. Two rulings taken: program named `prog-guide-authority`
  (authority earned by conditioning, not borrowed by deletion), and n=0 cells report
  `unexamined` rather than inheriting (holes become the work queue). Four terms registered in
  VOCABULARY.md rather than coined here; `Disclaimer`, `Strategy Card`, `Warrant`, `Weighting`,
  `Census` and `Residual clause` all pre-existed and were inherited unchanged.
