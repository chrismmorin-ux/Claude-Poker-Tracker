# The Disclaimer and the Suspected-Fault Register

> **Status:** LIVE REGISTER — established 2026-08-04 (WS-330)
> **Governing decision:** [ADR-009](../adr/ADR-009-standard-of-record.md) · DEC-033
> **Program:** `prog-strategy-of-record`
> **Code:** `src/utils/standardOfRecord/faultRegister.js` — the entries are DATA, not prose
> **Version epoch:** `FR-1` (the full version is the epoch plus a content hash; see §5)

Every Result Card stamps the version of this register it was produced under. That stamp is what
lets a fault confirmed *tomorrow* find the results that depended on it *yesterday*.

---

## 1. What this system can honestly say today

*Plain language. If you read one section, read this one.*

**What it does.** The engine watches a hand, builds a picture of what each opponent is likely
holding, and works out which of your options makes the most money against that picture. To check
whether it is any good, we replay old recorded hands, swap in what the engine would have done at
one decision, and add up the difference.

**What that number is.** It is the value of **one swapped decision**, averaged across a lot of
hands, measured in big blinds. It is not a winrate. If you read it as "the engine makes me X
big blinds per hundred hands," you are overstating it by roughly the number of decisions in a
hand.

**Who it was measured against.** Online players, six- and nine-handed, from **July 2009**. Your
game is **live 9-handed 1/2 and 1/3**. Those are different populations, and this repo's own
standing rule is that they are never merged. So any claim about your live game that leans on
this data is **carried over, not measured**. That is the single biggest reason to be careful
with a number from this system.

**Three more things worth knowing before you act on a figure.**

- **The engine grades its own homework.** It picks the play its model says is best, and we
  mostly score that play using the same model. When the model is wrong in a consistent
  direction, it will rate its own advice highly *because* it is wrong. Real chips won and lost
  are the only outside check, and they are noisy.
- **The opponents don't fight back.** In most of our tests the other players do the same thing
  no matter how you play. That flatters any aggressive strategy, because nobody ever adjusts to
  it. Real opponents do.
- **Rake is guessed.** The old hand records don't include it, so every money figure assumes a
  rake schedule. Live 1/2 rake is roughly twice as punishing as the 2009 online rake, and it
  moves close decisions.

**What to do with all this.** Treat a figure from this system as *a strong hint about direction,
a weak claim about size, and no claim at all about your specific game until it has been measured
on live data.* Where the engine says one option is far better than another, that gap is probably
real. Where it says one option is slightly better, that is inside the fog.

**And the honest part:** the list in §3 is not a list of things we think are fine. It is a
ranked list of where we think this is most likely to be **wrong**, with — for each one — the
specific measurement that would settle it. Nothing on that list has been quietly dropped.

---

## 2. The Disclaimer — the estimand, stated precisely

The technical form of §1. This is what a Result Card means when it says what it measured.
Reusable verbatim as a card's `treatment` string.

| Component | Statement |
|---|---|
| **Substitution** | ONE hero decision is replaced by the surface under test; the rest of the hand plays out as recorded. A per-decision substitution, not a strategy played end to end. |
| **Horizon** | One decision. The value of playing a whole strategy is NOT measured. Reading a per-decision edge as a winrate overstates it by roughly the decisions-per-hand factor. |
| **Opponents** | Whoever occupied the other seats in the recorded hand, or the modelled Field when a simulator supplies them. In the second case **the opponents ARE our model of people**, so a fault in the population model is invisible inside the result. |
| **Population** | Online 6-max and full-ring, July 2009 (SRC-011 / SRC-012, the Mass Data Field). The founder's game is LIVE 9-handed 1/2–1/3, a **distinct** population. Live claims anchored here are TRANSFERRED, not measured. |
| **Units** | Big blinds per decision unless the card states otherwise. Rake is MODELLED — the corpus records none — so every figure carries an assumed schedule. |
| **Cluster unit** | Sessions or players, **never hands**. Hands are not independent within a session, so a hand-clustered interval is narrower than the data supports (POKER_THEORY §14.3). |
| **Hole cards** | Advice is RANGE-MARGINALIZED. Results are the value of the advice averaged over hands hero COULD hold, not the hand hero HELD — a weaker claim than a cards-known instrument, and the strongest this corpus supports. |

---

## 3. The Suspected-Fault Register

**How this is ranked.** By **expected damage = probability × contamination breadth**, founder
decision 2026-08-04. Not by probability alone: population mismatch is near-certain but its
damage is bounded and understood, while an unclosed leakage channel is unlikely and would
invalidate everything. Ranking by likelihood alone buries exactly the entry you most need to
see. Both components are shown so you can tell which one is carrying a row.

**Breadth is measured, not asserted** — it is the share of existing Result Cards an entry
actually contaminates, blended with a declared prior under pseudocount shrinkage
(`BREADTH_PRIOR_WEIGHT = 10`, matching `PRIOR_WEIGHT` elsewhere in the repo). There are very few
Result Cards today, so **the figures below are currently prior-driven** and will move as the
Ladder fills. `rankFaults()` returns `evidenceWeight` per row, which is how much of the blend is
evidence rather than assertion; today it is ~0.

**Status vocabulary:** `untested` · `partially-supported` · `confirmed` · `retired`.
Confirming or retiring an entry **requires recorded evidence** — enforced in code, not by
convention. Entries never quietly disappear.

<!-- RANKED-REGISTER:BEGIN -->

| # | Fault | Site | P | Breadth | Exp. damage | Status |
|---|---|---|---|---|---|---|
| 1 | `FAULT-population-mismatch` — live claims anchored on an online corpus | corpus | 0.95 | 0.90 | **0.855** | untested · **falsifier blocked** |
| 2 | `FAULT-temporal-staleness` — July 2009, sixteen years of drift | corpus | 0.90 | 0.85 | **0.765** | untested · **falsifier blocked** |
| 3 | `FAULT-modelled-rake` — the corpus records none, so every figure assumes a schedule | instrument | 0.90 | 0.80 | **0.720** | untested |
| 4 | `FAULT-static-field-overstatement` — a Field that never adapts inflates aggression | instrument | 0.85 | 0.70 | **0.595** | untested |
| 5 | `FAULT-masked-hole-cards` — range-marginalized advice, not cards-known | range | 0.99 | 0.50 | **0.495** | untested |
| 6 | `FAULT-self-grading-circularity` — the engine graded by its own arithmetic | instrument | 0.80 | 0.60 | **0.480** | untested |
| 7 | `FAULT-precision-overstatement` — ESS, not n, is the honest denominator | statistics | 0.75 | 0.60 | **0.450** | untested |
| 8 | `FAULT-horizon-bias` — a one-decision edge read as a winrate | instrument | 0.60 | 0.70 | **0.420** | untested |
| 9 | `FAULT-monte-carlo-irreproducibility` — the hero-EV instrument is not bit-reproducible | instrument | 1.00 | 0.40 | **0.400** | partially-supported |
| 10 | `FAULT-constants-by-taste` — any unswept constant is a suspected fault by default | process | 0.70 | 0.50 | **0.350** | untested |
| 11 | `FAULT-stat-definition-mismatch` — `foldTo3Bet` counts folds facing ANY preflop raise | foldProbability | 1.00 | 0.30 | **0.300** | **confirmed** |
| 12 | `FAULT-showdown-selection` — showdown-conditional quantities are a selected set | statistics | 0.85 | 0.35 | **0.297** | untested |
| 13 | `FAULT-model-opponent-bias` — the simulator's opponents are our model of people | instrument | 0.70 | 0.40 | **0.280** | untested |
| 14 | `FAULT-rake-inert-on-live-path` — `estimateRake` returns 0 on every live decision | instrument | 1.00 | 0.25 | **0.250** | partially-supported |
| 15 | `FAULT-hand-clustering` — hands are not independent within a session | statistics | 0.50 | 0.45 | **0.225** | partially-supported |
| 16 | `FAULT-multiway-approximation` — multiway equity and fold correlation are approximated | equity | 0.90 | 0.20 | **0.180** | untested |
| 17 | `FAULT-degenerate-signal` — a metric that cannot fail is not evidence | instrument | 0.60 | 0.30 | **0.180** | untested |
| 18 | `FAULT-leakage-unclosed-channel` — corpus-mined priors leaking into corpus backtests | process | 0.15 | 1.00 | **0.150** | untested |

<!-- RANKED-REGISTER:END -->

**Read the bottom of that table as carefully as the top.** `FAULT-leakage-unclosed-channel`
ranks last because it is *unlikely* — three channels are closed and enforced. Its breadth is
**1.00**: if a fourth channel is open, every backtested figure in this repo is inflated in the
same direction, and nothing would look anomalous. That is the row where a low rank means "we
think we closed it," not "it would not matter."

### When a falsifier cannot be run (WS-352)

The rank-1 entry's falsifier was **run on 2026-08-05 and found unrunnable**. It names two arms —
the same estimand on SRC-012 (online 2009) and on SRC-014 (the founder's live 1/3 pool). The
SRC-012 arm is measurable today. The SRC-014 arm is not, for three separate reasons, each
recorded as a `falsifierBlockers` entry in the module:

1. ~~**SRC-014 has no positive identity.**~~ **CLEARED 2026-08-05 (WS-368 accept criterion 7).** See below.
2. **SRC-014 is unreachable by the harness.** It is browser IndexedDB on the founder's device
   with no export path; SRC-012 is scored by node scripts over an on-disk corpus root. No harness
   can currently read both arms.
3. **No volume floor is stated.** The falsifier turns on whether two intervals overlap, and
   SRC-014 is the smallest source by orders of magnitude — so a null result would be unreadable,
   indistinguishable between "transfer holds" and "the live arm had no power."

The entry therefore stays **`untested`**. It was not confirmed, and it was not retired. Being
unable to run a test is not a result, and **a null result is never grounds for weakening or
deleting an entry** — so the entry's wording, probability, and breadth are unchanged.

This is now enforced rather than merely intended: an entry **may not be `confirmed` or `retired`
while it declares a blocker**. Settling an entry whose named test cannot be run means something
*easier* was substituted, which is the move this apparatus exists to prevent. Blockers are hashed
into the register version, so clearing one is a recorded change and not a quiet edit.

`blockedFalsifiers()` exposes the list, because "nobody got round to it" and "it cannot be done,
and here is what would change that" route to **different work** — the first to an analyst, the
second to whoever owns the ingest path. A queue that cannot tell them apart re-emits an unrunnable
item at rank 1 forever.

### Clearing one blocker is not settling an entry (WS-368 AC-7)

Blocker 1 above is **cleared**. WS-368 (commit `3befa26d`) gave every hand a positive provenance
identity: a closed set `{live, ignition, import, unknown}` in
`src/utils/persistence/handProvenance.js`, stamped **at construction** on every write path, with
the stamp spread after the payload so a caller cannot forge one. `getHandsBySource('live')` is now
a real selector — the exact capability the blocker said did not exist.

Three things this **does not** do, all recorded in the entry's `clearedBlockers[0].note` rather
than left to a reader's memory:

- **Blockers 2 and 3 still hold.** There is no export path from browser IndexedDB reachable by the
  node harness that scores SRC-012, and no volume floor has been stated. The entry stays
  **blocked**, stays **`untested`**, and still may not be confirmed or retired.
- **The mechanism is not the data.** Migration v28 stamps every pre-existing row `unknown`, never
  `live`, because those rows are genuinely ambiguous and a guess would manufacture the very
  population the falsifier is supposed to measure. So the selectable live set starts **empty** and
  grows only from hands played after 2026-08-05.
- **Clearing is evidence-gated, like confirming.** `clearFalsifierBlocker` requires the blocker
  text verbatim, at least one piece of recorded evidence, and a `note` stating what the clearance
  does *not* cover. The cleared blocker is **preserved**, not deleted — `clearedBlockers` is hashed
  into the register version alongside `falsifierBlockers`, so a reader of an old Result Card can
  see not only that the register moved but which way and on whose authority.

`registerVersion()`: `FR-1+e3867c10fc2a` → `FR-1+8c4e65578ca2`. Existing card stamps are untouched
— they correctly record what they were produced under.

### The matcher read the disclaimer instead of the dependency (WS-369)

`isLiveFacing` was a regex — `/\blive\b|1\/2|1\/3|9-handed/` — over a haystack containing the
card's `estimand` and `treatment`. So this entry fired on the WS-293 range-calibration card
**because that card's own treatment string says** "any claim about live 9-handed 1/2-1/3 is
TRANSFERRED, not measured", a sentence its emitting module repeats three times on purpose. A card
with the same Deal Book, the same Field and the same partition, whose prose omits those words,
matched nothing at all.

The detector was **inverted with respect to its own risk**: it penalised disclosure and was blind
to silence, and the cheapest route to a clean register report was to delete the honest sentence.

It now keys on what the card **depends on** — Deal Book, Field and partition identity, resolved
to a population by `cardPopulation` — and never on its prose. Unknown provenance counts as
live-facing, so an unnamed source cannot buy the exemption a deleted sentence used to. The
disclosing card **still matches**, correctly: disclosure does not make the dependency go away.
What changed is that it no longer matches *for the wrong reason*, and the silent card no longer
escapes. `contaminationDisclosure()` splits a matched set into disclosed and silent — a reporting
axis on top of the match, never a filter applied to it.

`registerVersion()`: `FR-1+8c4e65578ca2` → `FR-1+746d7b4aaea4`, from adding `matchesOn` to the
hashed body. **Finding, reported rather than acted on:** the corrected matcher flags **one
existing Result Card the old one missed** — `RC-depth-ablation-1c560bcc-67e9e14e`, a paired depth
contrast on the 2009 corpus whose prose never says "live". Seven of seven known cards now match,
where six did before. Prior stamps are **not** re-minted and no card is re-scored; deciding what
that means for those results is the confirm/retire machinery's job, and it requires evidence.

Four more matchers had the same shape and had a structural basis available, so they were repaired
in the same change: `FAULT-rake-inert-on-live-path` (the second consumer of `isLiveFacing`),
`FAULT-temporal-staleness`, `FAULT-model-opponent-bias` and `FAULT-static-field-overstatement`
(both narrowed from the prose haystack to the Field identity), and
`FAULT-self-grading-circularity` (whose "realized" escape clause read the prose, so a card could
buy exemption with a word while reporting nothing but model EV — it now reads metric keys only).

Five remain prose matchers and are **declared rather than hidden**, listed by `proseMatchers()`
with the standing warning: horizon, stat-definition, masked hole cards, showdown selection and
multiway. Each turns on a property of the *instrument* that no structural field on the Result Card
carries, so making them structural is a card-schema change and not this ticket. Note that
`FAULT-horizon-bias` has the inversion in its purest form — its own mechanism says the fault
fires where a downstream reader **drops** the treatment string, which is exactly the card its
matcher cannot see. `registerSelfCheck()` cannot help here: it reports a matcher that matches
nothing and one that matches everything, and a matcher that matches **the wrong cards** looks
healthy to both.

> **Note on the figures above.** The table is computed with **no card set**, so its breadth column
> is pure prior. Six Result Cards now exist; against them this entry's *observed* breadth is 3/6
> and its `evidenceWeight` 0.375. Deciding which cards constitute the canonical set for a
> published ranking is a separate, unmade decision.

### The rank-2 falsifier could not be run either, and what it produced instead (WS-353)

`FAULT-temporal-staleness` says the corpus is old and the population has moved. Its falsifier is:
*fit the same priors on SRC-005 (Ignition, current) and compare against the 2009 values cell by
cell.* It was **run on 2026-08-05 and found unrunnable**. The 2009 arm is already in hand — it
*is* `HANDHQ_REFERENCE_STAKES`. All three blockers are on the SRC-005 arm:

1. **SRC-005 has no artefact any harness can read.** Two export paths exist and neither yields the
   hands. The extension popup export dumps the volatile *capture buffer*, and the only artefact it
   has ever produced on this machine (2026-06-19) contains **zero hands**. The app's
   `exportAllData` / `downloadBackup` is a founder-driven browser download with no on-disk
   instance and no node-side adapter from an app hand record to a mined `(k, n)` cell.
2. **"Cell by cell" presupposes an index both arms share, and they do not.** The 2009 values are
   7 stakes × {6max, full} × 6 stats pooled over six networks. SRC-005 is one network at the
   founder's stake, recorded in the provenance registry as 0.02/0.05 — *below* the mined 25NL
   floor. Every per-cell gap would carry a stake step and a site step alongside the era step, and
   none of the three separates.
3. **No per-cell gap is readable without a null, and the only null this corpus supplies is
   nineteen days long.** See below.

**The nineteen-day null — a real measurement of a smaller question.** The corpus records
`day/month/year` on every hand, so the pool's cells can be blocked by day and the **same
population** differenced against itself across the span it actually covers. That was done, using
the *unchanged* mining function that produced the shipped 2009 cells, and it is recorded as
`WITHIN_CORPUS_DRIFT_2009`:

| | |
|---|---|
| Span | PS 2009-07-01…07-20 (20 days, contiguous); FTP 2009-07-01…07-19 (10 days, non-contiguous) — **19 days** |
| Scope | **50NL only** — one of the seven stakes the 2009 cells cover, and the only one materialized on disk |
| Cells | 24 (2 sites × {6max, full} × 6 stats), 1,065,871 hands; per-cell denominators 41,941 → 2,172,157 |
| Cluster unit | **days**, never hands |
| Fitted drift over the span | median **0.40 pp**, max **2.58 pp**; 4 of 24 cells' day-clustered intervals exclude zero |
| Daily overdispersion vs binomial | median **χ²/df = 4.35**, max **36.3** (VPIP) |
| Weekday/weekend gap | up to **0.95 pp** — comparable to the whole nineteen-day fitted drift |

**What that licenses:** a floor. The same population, same stake, same month moves a cell by up to
2.58 pp, and *who is logged in on a given day* moves it more than sampling does. **A cross-era
per-cell gap under roughly one point is inside what this population does with no era change at
all**, and must not be quoted as drift.

**What it does not license: anything about 2026.** Nineteen days is not sixteen years, and the
slope is *refuted by its own extrapolation* — carried linearly over the 6,230 days to 2026-08-05
the median slope gives 132 pp of change and the maximum gives 895 pp, both impossible for a
proportion. This is why the measurement is **not** recorded as the entry's `evidence`: that field
gates confirmation and retirement, and a three-week number must never be able to settle a
sixteen-year question. It sits beside the entries in the hashed register body instead, so moving
the null moves the version.

The entry therefore stays **`untested`** — not confirmed, not retired, wording and probability and
breadth unchanged.

> **Two for two.** The top two entries by expected damage are both `corpus` entries, and both of
> their falsifiers are now blocked on the arm naming a population the founder actually plays.
> That is the pattern `blockedFalsifiers()` exists to make countable: the register's most damaging
> claims are precisely the ones the repo currently has no second population to score.

**Mechanisms, falsifiers, and evidence live in the code**, one per entry, in
`src/utils/standardOfRecord/faultRegister.js`. They are there rather than here because each
entry also ships a `matches(card)` predicate — the machine form of its contamination claim — and
a claim whose prose and whose code live in different files will drift.

### Why each entry ships a matcher instead of asking cards to declare exposure

The obvious design gives every Result Card an `exposures` list. It is also the design that
fails: it asks every future card author to remember a field. This repo has watched that rot
three times — `predictionAudit` captured and never read, `perceivedHeroRange` shipped behind a
parameter no call site passed, WS-284. So the predicate ships **with** the entry, and a new card
is classified the moment it exists by code written when the fault was described.

### The register is held to its own standard

`FAULT-degenerate-signal` says a metric that cannot fail is not evidence. A matcher that flags
every card, or no card, has exactly that defect. `registerSelfCheck()` reports every matcher's
discrimination for that reason.

It **reports rather than rejects**: temporal staleness genuinely does apply to every
corpus-derived card, and outlawing the honest statement would push it somewhere nothing can find
it — the same argument the vocabulary makes for why the `fear` warrant is legal.

---

## 4. What happens when an entry is confirmed

This is the mechanism, and it is the reason this is a module and not a page of caveats.

1. Someone runs an entry's **falsifier** and it comes back positive.
2. `confirmFault({ faultId, evidence, cards })` — **evidence is required and non-empty**; a hunch
   may not invalidate prior work.
3. Every Result Card the entry's matcher selects is returned flagged **`suspect-pending-review`**,
   naming the fault and what it contaminates.
4. The register's content hash changes, so its version changes, so every card stamped *after*
   the change is distinguishable from every card stamped before it.

**`suspect-pending-review` does not mean "wrong."** It means the card's conclusion rested on
something that has now been shown to be faulty, and nobody has yet checked whether the
conclusion survives. The action it asks for is a re-check, not a retraction.

**Why this exists.** WS-291 — a falsified range model on the live recommendation path — was
wrong for the life of the project. When it was finally caught there was no way to know **what it
had tainted**, so every figure published under it stayed published. Step 3 above is the step
that was missing.

Retirement runs the same way (`retireFault`) and carries the same evidence bar in the other
direction: an entry may not be tidied away because it is inconvenient. A retired entry stays in
the register with the evidence that settled it, so "we looked and it was fine" stays
distinguishable from "nobody ever wrote it down."

---

## 5. Versioning

The version stamped into `manifest.disclaimerRegisterVersion` is `FR-1+<12 hex chars>` — the
hand-set **epoch**, plus a **content hash** over the register body.

The hash is what makes it honest. Edit any entry's probability, status, evidence, or prose and
the version changes whether or not anyone remembered to bump anything. This is the same argument
`strategyCard` makes for stamping `contentHash` in the loader rather than trusting the author's
copy: a version someone has to remember to change is a version that will be wrong exactly when
it matters.

The hash still excludes each entry's `matches` predicate — a function has no stable
serialization, and hashing its source would make a whitespace change look like a semantic one.

**But it hashes `matchesOn`, the declared list of card fields that predicate reads (WS-369).**
The original exclusion was half right. "A function cannot be serialised stably" is decisive
against hashing the *source*; it is not an argument against hashing the *claim*. And there is a
claim: `falsifierBlockers` is hashed because it states what the register can **settle**, and what
a matcher reads states what the register can **see** — the same kind of fact about the same old
card. WS-369 is the proof. A matcher moved from reading the card's prose to reading its
dependencies, the contamination set changed, and under the old body the version would not have
moved by one character. Two cards stamped `FR-1+8c4e65578ca2` could have been screened by
opposite predicates with nothing in either card recording which — and the dangerous direction is
silent *under*-matching, because that shrinks the list `confirmFault` hands back.

`matchesOn` is drawn from a closed vocabulary (`MATCHABLE_CARD_FIELDS`), so a typo cannot pass
for a declaration, and it is bound to behaviour rather than trusted: every entry that does not
declare a prose field is asserted invariant under scrambling `estimand` and `treatment`. It moves
when the semantics move and not when the whitespace does.

**A Result Card without a register version is invalid** (`manifestProblems` rejects it). One
deliberate asymmetry: the schema field stays optional so `checkAgainstSchema` can still *parse*
a legacy card. The flagger has to be able to open an old card in order to flag it, and a rule
that made legacy cards unreadable would lock the mechanism out of exactly the cards most likely
to be contaminated. **Validation tightens; reading does not.**

**And the version must have the right *shape*, not merely be present (WS-353 follow-up).** The check used
to be truthiness, which rejects `null`, `''` and an absent key but accepts any non-empty string —
`'unknown'`, `'v1'`, a hand-typed near-miss. The stamp exists for one purpose, to be **joined**
back to a register version when a fault is confirmed, and a value that cannot be joined is worse
than none: `null` says the card cannot name its register, while `'unknown'` claims it can. The
pattern (`REGISTER_VERSION_PATTERN`, `FR-<epoch>+<12 lowercase hex>`) lives in `faultRegister.js`
beside the function that mints it, so the checker cannot drift from the producer, and it matches
any epoch — a validator pinned to `FR-1` would reject every card minted the day after a bump.

**Cards produced before WS-330 are not back-filled.** `out/hero-ev-pbr.json`'s
`RC-hero-ev-2d765568-c56405ee` carries `disclaimerRegisterVersion: null`; it was written on
2026-08-04 at 00:14 from engine commit `c56405ee`, and WS-330 — which added *both* the
requirement and the stamp — landed at 11:42 that day. Its stored `resultCardProblems: []` is a
verdict computed under the old rules; re-run `resultCardProblems` on it today and it is rejected.
The register version that run stood under is genuinely unrecoverable, so nothing plausible is
written into the field, for the same reason migration v28 stamps ambiguous hands `unknown` rather
than `live`. The card stays invalid-to-publish, stays legible to audit, and is **regenerated by
re-running the harness**, not patched.

---

## 6. The register as a work queue

`scripts/standardOfRecord/emit-fault-items.mjs` turns the top-ranked entries into queue items,
each carrying its **falsifier as the accept criterion** — because an entry nobody can settle is
not work, and a falsifier is exactly a statement of what would settle it.

```bash
node scripts/standardOfRecord/emit-fault-items.mjs            # dry run — prints, writes nothing
node scripts/standardOfRecord/emit-fault-items.mjs --top 3 --write
```

Bounded on purpose: dry-run by default, `--top` defaults to 3, `retired` entries are never
emitted, and emission dedupes on the `fault_id` field stamped into each queue YAML — so
re-running produces nothing new. An 18-entry register that filed 18 tickets would swamp `/next`
composition, and a work queue that buries the queue is not one.

---

## 7. Adding an entry

Add it to `SUSPECTED_FAULTS` in `faultRegister.js` with all of: `mechanism` (the *path* by which
it goes wrong — "the model may be off" is a worry, not an entry), `contaminates`, a `matches`
predicate, `matchesOn`, a `falsifier`, a `probability` **with its basis stated**, and a
`priorBreadth`. `buildFaultEntry` refuses anything less.

**Write the matcher against what the card DEPENDS ON.** Its Deal Book, its Field, its partition —
structural facts it already carries. Do **not** read `estimand` or `treatment` to infer them: a
card's disclaimer is the author's account of the work, its identity is the work's inputs, and
matching on the first is how WS-369's inversion happened. `matchesOn` must name the fields the
predicate actually reads, from `MATCHABLE_CARD_FIELDS`; naming `estimand` or `treatment` is legal
but marks the entry a prose matcher, which `proseMatchers()` counts and warns about. Where a
matcher cannot tell — unknown provenance — **match**. An exemption bought by omission is the same
defect as a match triggered by wording, pointed the other way.

If the falsifier **cannot be run today**, add `falsifierBlockers` — one non-empty string per
blocker, each naming what blocks it *and* what would unblock it (`UNBLOCKED BY: …`). A bare
"blocked" routes to nobody. Do not put "we could not measure it" in `evidence`: that field gates
confirmation and retirement and must keep meaning *a measurement exists*.

When a blocker later stops being true, **clear it with `clearFalsifierBlocker`** rather than
deleting the string. It demands the blocker text verbatim, at least one piece of recorded
evidence, and a `note` stating what the clearance does *not* cover; the cleared blocker moves to
`clearedBlockers`, which is hashed alongside `falsifierBlockers`. Clearing does **not** touch
`status` — clearing the last blocker makes the falsifier runnable, it does not run it.

Then update §3's table — a test asserts the table lists exactly the module's fault IDs in ranked
order, so the two cannot drift.

Entries should come from faults **observable in the repo**, not from imagination. Every opening
entry points at something real: a code fact, a documented measurement, a confirmed semantic
mismatch, or a structural property of the instrument.
