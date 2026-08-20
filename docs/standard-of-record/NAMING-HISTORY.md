# Naming history — what the model has been called, and what each name could not hold

> **Status:** LIVE — established 2026-08-20
> **Companion to:** [VOCABULARY.md](VOCABULARY.md) (the register of terms in force)
> **Method:** commit chronology, first-appearance dates of every engine directory, the
> 74-term register, the ADR log, and the shipped signature of `conductCard.js`. Dates are
> from git. Where only WS-number ordering was available, it says so.

This file exists because a naming exercise on 2026-08-19/20 found that **the project's
top-level self-description is three eras stale**, and — more consequentially — that **the
register lags the code rather than leading it.** The second finding overturned the first
version of this document. Both are recorded below, the refutation included, because the
refutation is the more useful half.

---

## 1. The eight namings

Each state gets the minimal description, then the thing that matters: what the central
noun is, and **what argument it takes.**

| # | Era | Minimal description | Central noun | Its argument |
|---|---|---|---|---|
| **S0** | 2025-12 | *"React-based hand tracker for live 9-handed poker games."* | **hand** | none — an event |
| **S1** | 2026-03-05 | *"Hand tracker and exploit engine… builds Bayesian player models, surfaces maximally exploitative plays."* | **weakness → exploit** | villain |
| **S2** | 2026-03→06 | A game tree that prices a decision in chips. `decisionTreeBuilder`, `foldEquityCalculator`, `unexploitableFloor`, `gameTreeDepth2` | **EV** | (decision, game state) |
| **S3** | 2026-07-26 | The engine becomes an object of measurement. `scripts/backtest/`, `calibrationMetrics`, `poolBaseline`, `handhqReferencePool`, `modelAudit` | **estimate** | + uncertainty, + corpus |
| **S4** | 2026-08-02 | Every comparative claim resolves to a Result Card. Surface / Stack / Layer / Divergence / Deal Book / Field / Warrant / Manifest | **claim** | Match = Card × Deal Book × Field |
| **S5** | WS-337 (ordinal) | The game has structure with no player in it. Equity operator, skew part, rotation plane, strength ladder, **intransitive residual** (25.99% of skew energy) | **operator** | *argument removed* — the game alone |
| **S6** | WS-331/350 (ordinal) | The money is decomposed by where it comes from. Pier posts, Pool Best Response, exploitation efficiency/premium, Stratum, Leak, Hole Map, fold gap | **edge** | the Field |
| **S7** | 2026-08-18/19 | What one player *did*, in his own terms; and what a human can be handed. Conduct Card, Mix, Guide, Slot rule, Occupancy, Decision Load, `unexamined` | **subject** | his own occupancy |

**S5 is the informative exception.** It is the only era that *removes* an argument —
isolating the game's structure with no player in it — and it produced the single sharpest
number in the project (the intransitive residual, "far less compressible than the whole
operator"). Argument-removal is a move in the repertoire, not a regression.

---

## 2. The frozen name

`CLAUDE.md`'s Purpose sentence — *"Live poker hand tracker and exploit engine for 9-handed
games. Records actions, builds Bayesian player models, and surfaces maximally exploitative
plays"* — was written **2026-03-05 (`febe9cf6`) and is byte-identical today.** The only edit
in five and a half months was a governance clause appended 2026-07-26.

It contains three nouns the register has since retired or bounded:

- **"exploit"** → S6 replaced it with **Leak**, and forbids the S1 usage explicitly: leak is
  reported *per stratum, never per player*, because at 35–51 observations a per-player
  ranking of leak is a ranking of noise.
- **"player models"** → S6 replaced named types with **Stratum**, "the replacement for a
  named archetype", which requires separability evidence or it gets no row.
- **"maximally exploitative"** → S6 makes maximal exploitation a **pier post** (Pool Best
  Response), not a goal; and the distance from equilibrium that would give it meaning — the
  **exploitation premium** — is currently *unavailable and reported as such*.

The sentence is the most-read line in the repo. It orients every session to March.

---

## 3. Limitations embedded in the labels

Read off what the words cannot take as an argument. These are claims about the **register**,
and §4 corrects how far they extend to the code.

### 3.1 `Surface = game state → action distribution` is memoryless and single-agent
The load-bearing definition of the whole Standard of Record. No term in 74 names the field's
counter-adjustment. The system caught the symptom without minting the noun — the **fold gap**
entry says it outright: *"an upper bound that decays with use… against an adapting defender
the rate falls toward the required one."* A quantity that decays under an unnamed mechanism
can be disclaimed but not tracked.

### 3.2 `buildConductCard` takes `subjectId` and nothing else
Verified in `src/utils/standardOfRecord/conductCard.js`. No opponent argument, no hero
argument, no time index. The register calls this the defining property — *"carries no
baseline and no observer."* But conduct is a best response to a perceived opponent, so a card
pooled across opponents is structurally the same conditioning error as the 2026-08-19
fold-rate-pooled-over-raise-sizes miss, where the conditioning error was ~5× the statistical
error and opposite in sign. The bound the register does carry — **conduct occupancy bound** —
guards a different failure (best-responding outside the subject's Occupancy).

### 3.3 Nothing in the register takes time
Occupancy, Field, Stratum, Deal Book, Conduct Card — all static. The top-ranked entry of the
Suspected-Fault Register is a *population-transfer* problem (online-2009 corpus vs live-2026
game) and it lives as a **Disclaimer**, i.e. as prose. See §4: the queue is ahead of the
register here.

### 3.4 "Engine"
An engine produces output on demand. Everything from S3 onward is measurement and refusal —
`unexamined`, `model-suspect`, `INELIGIBLE.*`, `suspect-pending-review`, the Suspected-Fault
Register, probes that "refuse permanently." The late vocabulary is overwhelmingly
**vocabulary for ignorance**, which "engine" has no slot for. That is why the ignorance terms
arrived late and one at a time.

---

## 4. The refutation — the register lags the code

The first version of this document projected four empty cells to build. **Three of the four
were already ticketed, and one was already shipped.** Recorded unhedged:

| Projected as absent | Actual state |
|---|---|
| Appraisal (Conduct Card × a standard) | **WS-551** — held-out log-loss, walk-forward split, "two cards of the same villain can be ranked". Already the object. |
| Drift / time | **WS-554** — *"an archetype is a TRAJECTORY through surface space. A Conduct Card is a point on it."* Better framed than the projection. |
| Villain's model of hero | **WS-276, status `done`** — perceived range and level-2 construction shipped. What is genuinely absent is *adaptation over time*, not the level-2 construct. |
| Hero's own conduct | `exploitEngine/heroSelfObservation.js` **exists and nothing reads it** (WS-311). The data exists; its expression as a Conduct Card does not. |

**So the generative finding is the inverse of the hypothesis: the register is a lagging
indicator of the engine.** Measured — count of files mentioning the concept in `src/utils/`
plus the queue, against entries in the register:

| Concept | Register entries | Files in code + queue |
|---|---|---|
| equity/line **realization** | 0 | 67 |
| **poolBaseline** | 0 | 35 |
| **perceived range** | 0 | 19 |
| **held-out** scoring | 0 | 18 |
| **importance weight** | 0 | 12 |
| **trajectory** (of a subject) | 0 | 11 |
| hero **self-observation** | 0 | 2 |

`realization` is the sharpest case: a first-class POKER_THEORY §1.4 concept, load-bearing on
every EV number the engine produces, named in 67 files, and **absent from the register that
exists to stop two numbers from evading each other.**

### Why this matters more than the frozen Purpose line
The Standard of Record was created because *"nothing forced two numbers onto the same axis,
so a wrong number never had to meet a right one."* An object that ships without a register
term is exactly that condition, one level up: it cannot be compared because it has no name to
be compared under. **The WS-291 mechanism recurs at the level of the register itself.**

---

## 5. The trajectory, and its law

Read the argument column downward: **each era adds one argument to a function that was
previously nullary** — with S5 running it in reverse to isolate the player-free part.

Second reading, stronger: **each era disaggregates a noun the previous era treated as atomic,
and the hidden content is always a conditioning set.** "Exploit" split into
`range → equity → foldProbability → ev → action` (the Stack). "Player type" split into
Stratum. "Chart" split into policy + Occupancy + Decision Load.

The generative law is already written down. **The second-argument rule** (founder,
2026-08-18) says an object is individuated by which argument it takes:
a **Conduct Card** takes none, an **Appraisal** takes a standard, a **Read** takes hero.
That rule is the trajectory describing itself.

### The argument lattice, as it actually stands

| Argument | Object | Status |
|---|---|---|
| game state | Surface | built |
| a second surface | Divergence, Layer Attribution/Ablation | built — already second-order |
| the Field | edge, Occupancy, Stratum | built |
| the subject's own play | Conduct Card | built 2026-08-19 |
| a standard | **Appraisal** | named 2026-08-18, unbuilt — **WS-551** |
| the subject over time | *(trajectory)* | unregistered, ticketed — **WS-554** |
| hero, as perceived | perceived range (level-2) | shipped **WS-276**, unregistered |
| **hero's own play, as a card** | *(hero Conduct Card)* | data exists, object does not — **WS-584** |
| **hero, as the second argument** | **Read** | named, unbuilt, unticketed — **WS-585** |
| **hero's own trajectory, prescribed** | **Lesson / Lesson Ledger** | §6 — **WS-587 / WS-588** |
| **the field's adaptation** | *(no name)* | absent from register, code and queue |

### The skip-ahead
Do not wait for era 8 to arrive one noun per week. **Apply the second-argument rule
exhaustively** — the lattice above is finite and checkable, and the remaining empty cells
fall out of it directly. The register reconciliation (**WS-586**) is what keeps the lattice
honest, because the exercise that produced this file only worked because the register could
be read as a list.

**One sentence:** the model has climbed from *the event*, through *the value*, through *the
claim about the value*, to *the subject* — and it is one step from becoming reflexive, where
hero is measured by the same machinery as villain.

---

## 6. S8 — the Lesson: the reflexive era, and the first object whose subject is the founder

Founder, 2026-08-20: *the proprietary lessons-tracking system — a session-locked reflection
naming the most valuable **non-poker** activity (drill, etc.) suggested.*

This is **S8**, and it is not an add-on to the trajectory — it is the argument the lattice was
converging on. Every object through S7 answers *what is true at the table*. A Lesson answers
*what hero should do away from it*, which is the first output of this system whose subject is
the founder and whose execution happens off the felt.

### The terms

- **Lesson** — a **pre-registered, session-locked prescription**: one spot, the measured gap
  at it, the off-table activity that addresses it, its **expected EV recovery in bb/100**, and
  its **falsifier** — the measurement that would show it worked. Written at session close and
  never edited; a revision is a *new* Lesson that supersedes, so the ledger records what was
  actually believed at the time.
- **Lesson Ledger** — the persistent record across sessions, with each Lesson's later score.
  The analogue of **Ladder**, whose subject is hero rather than a strategy.
- **Recovery** — realized EV change at the Lesson's spot, measured as **Divergence** between
  hero's Conduct Card at the time the Lesson was written and the next one, *restricted to that
  spot*. Scored, never asserted.
- **Activity** — the executable form. A Lesson names a drill, a range-study block, a hand
  review — something hero can actually do — not a fact he should know.

### What it inherits, and cannot escape

1. **It is an Appraisal, so it binds to a Result Card.** "The *most* valuable activity" is a
   comparative claim, and ADR-009 permits exactly one comparison path. A Lesson does **not**
   get its own card type; it resolves to a Result Card with a declared `metrics` variant. The
   second-argument rule already settled this — only Conduct Card, which makes no comparative
   claim, gets a form of its own.
2. **It requires the hero Conduct Card (WS-584).** "The gap at this spot" is
   `Divergence(hero Strategy Card, hero Conduct Card)` — what hero says he does against what he
   did. There is no other way to state it inside the register, and `heroSelfObservation.js`
   already produces the raw material.
3. **Ranking is an n problem and must refuse.** The register forbids per-player leak ranking
   at 35–51 observations because a ranking of measured leak would be a ranking of noise. Hero
   has more data about himself than about any villain, but a *single session* does not. A
   Lesson carries its own n and **emits nothing rather than inventing a ranking** — the same
   discipline as `unexamined` in a Census.
4. **Value is Occupancy-weighted, and concentrates where Decision Load does.** A spot hero
   misplays badly but stands at twice an hour is worth less than a small error at a node he
   occupies constantly. AS-730 says load concentrates in *relatively rarely occupied* nodes —
   so the ranking quantity is `gap × Occupancy`, and neither factor alone.
5. **The teachable form may differ from the engine's, if it is scored.** Standing founder rule:
   a novel method hero can execute beats a right answer he cannot. A Lesson's Activity is
   scored on the same metric as the engine's own recommendation, never exempted from it.

### Why the session lock is the load-bearing part

Without it this is a suggestion engine, and suggestion engines are unfalsifiable — they get
re-read in the light of what happened. Locking the Lesson at session close, with its falsifier
written *before* the next session is played, makes the whole apparatus scoreable: over a
season the Lesson Ledger answers **did our own advice make money**, which is the same question
the hero-EV instrument asks of the engine, pointed at the founder instead.

That is the reflexive closure: **hero becomes a subject measured by the machinery built to
measure villains, and the system's advice about itself becomes a claim like any other.**
