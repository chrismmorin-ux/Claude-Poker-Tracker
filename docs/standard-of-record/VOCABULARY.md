# The Standard of Record — vocabulary register

> **Status:** LIVE REGISTER — established 2026-08-02 (WS-322)
> **Governing decision:** [ADR-009](../adr/ADR-009-standard-of-record.md) · DEC-033
> **Program:** `prog-strategy-of-record`
> **Code:** `src/utils/standardOfRecord/`

This file exists so the next session does not reinvent these terms. If you are about to coin a
word for one of the things below, use the word below instead. If you need a word for something
not below, add it here in the same change.

---

## Why there is a standard at all

The project kept discovering that deep faults went unmeasured for long periods. WS-291 — a
falsified range model sitting on the live recommendation path — survived for the life of the
project. The mechanism was not carelessness. It was that **nothing forced two numbers onto the
same axis.** Each session invented its own instrument, its own slice, its own horizon and its
own units, so a wrong number never had to meet a right one.

**The rule:** any artefact making a *comparative* claim about strategy, model quality, or EV
must resolve to a **Result Card**.

**Proportionality.** This binds *comparative claims*, not every number. A debug count or an
exploratory check is not a claim. The trigger is **a number someone could act on or cite**.

---

## The terms

| Term | Meaning |
|---|---|
| **Surface** | A function from game state to action distribution. Over the space of game states, that function is a surface. FSA's term, unchanged. |
| **Surface kind** | `Equilibrium` \| `Field` \| `Read` \| `Declared`. See the naming note below — the field is `surface_kind`, **not** `surface_class`. |
| **Stack** | The ordered layers composing a surface: `range → equity → foldProbability → ev → action`. A surface may OMIT layers; it may not REORDER them, because "the first layer at which two stacks separate" is only meaningful against a fixed order. (WS-324) |
| **Layer** | One element of a Stack — itself a function over game states, with its own inputs, its own named assumptions, and its own ways of being wrong. |
| **Layer Probe** | Scores ONE layer against its own ground truth (`range` → revealed holding, `equity` → realized showdown, `foldProbability` → observed fold, `ev` → realized chips), independently of whether the recommendation downstream was any good. `action` has no ground truth and its probe refuses permanently. Probes refuse `hypothesized`-basis input, inheriting the holdingKnowledge rule. (WS-324) |
| **Layer Attribution** | Decomposes a divergence between two surfaces BY LAYER — which step of the reasoning made them differ — orthogonally to FSA's decomposition BY SITUATION. Both sum to the same total. **Takes `d` as a required argument and never chooses one**: a decomposition of a divergence is not a definition of one, so FSA Phase 3 still owns `d`. (WS-324) |
| **Layer Ablation** | Substituting a layer's recorded value to ask "what if this layer had been correct?". Evaluation-free, and therefore able to speak only to the substituted layer — every layer downstream was evaluated at the ORIGINAL input. Propagating requires layer functions **pinned** to the atom set's engine commit and replayed from its seeds, never the live engine. (WS-324) |
| **Strategy Card** | A declared, enclosed, warranted rule set — i.e. a `Declared` surface. |
| **Deal Book** | A versioned, seeded, content-hashed hand set: a corpus slice or a generated set. |
| **Field** | Who occupies the other seats. |
| **Match** | Strategy Card × Deal Book × Field → Result Card. |
| **Result Card** | The standardized scorecard plus its replication manifest. |
| **Decision Atom** | One row per decision. **Aggregates are VIEWS over atoms, never the record.** |
| **Census** | The coverage record, *including contexts hit zero times*. |
| **Ladder** | The persistent comparison across all Result Cards. |
| **Warrant** | Why a rule says what it says: `equity` \| `structure` \| `read` \| `fear`. |
| **Residual clause** | A Card's declared fallback for states its named rules do not reach. |
| **Pier post** | One of the two references a strategy is *located between*, and neither is ours: the **upper post** is Pool Best Response, the **lower post** is Equilibrium. The point of defining them by the population and the equilibrium is that a strategy's position survives an engine upgrade — improve the engine and the raw bb figure moves, but the posts do not. (WS-331) |
| **Pool Best Response (PBR)** | The max-EV response to the mined Field — the **upper pier post**, and the answer to "how much was there to win here at all?". A `Declared` surface (`pool-best-response`), because it is an authored rule that consumes a Field, not a description of one. Held out by construction: fit on POOL, evaluated on EVAL, refused otherwise. **Maximally exploitable by construction and never to be played** — being a best response is exactly what makes it counterable for free. (WS-331) |
| **Exploitation efficiency** | A strategy's edge over the Field as a fraction of PBR's edge over the Field — *of the money available beyond playing like the field, how much did we get*. A ratio of **edges**, never of raw values: raw values are dominated by the Field's own baseline and would sit near 1.0 for any two strategies. Not clamped — below 0 (loses to the field) and above 1 (beat the one-step ceiling) are both real readings. A standard Result Card field. (WS-331) |
| **Exploitation premium** | `EV(PBR) − EV(Equilibrium)` — how much money exists *specifically because the pool is bad*, as opposed to because hero plays solid poker. Currently **unavailable** and reported as such: the lower post (SRC-013) does not exist, and chart-derived substitutes are refused by a throw, not a warning. (WS-331) |
| **Position** | What a strategy resolves to instead of a number: exploitation efficiency (x) plus its own exploitability (y). The builder **refuses a bare scalar**. Only the Field's y is measured today — it *is* PBR's edge, by construction; every other surface's needs the WS-326 simulator and ships `null` with that reason. (WS-331) |
| **Disclaimer** | The standing statement of the **estimand** — what was substituted, over what horizon, against which opponents, on which population, in what units, with what cluster unit. Not boilerplate and not modesty: it is what a Result Card MEANS, and `DISCLAIMER_TREATMENT` is it in one reusable line. (WS-330) |
| **Suspected-Fault Register** | The **ranked** list of where the fault most likely is. Each entry carries a mechanism, a site, what it contaminates, a **falsifier**, and a status. Ranked by **expected damage = probability × contamination breadth** (founder, 2026-08-04) with both components shown — not by probability alone, which buries the unlikely-but-total entries. A flat caveat list is read once and ignored; a register with falsifiers is a work queue. (WS-330) |
| **Fault site** | Where a fault lives: a Stack layer, or one of `corpus` \| `instrument` \| `statistics` \| `process`. Not every fault is layer-local — a stale corpus is not a bug in the equity layer — and forcing one into a layer slot means it gets looked for where it is not. (WS-330) |
| **Contamination** | Which results an entry would taint. Carried **twice**: as prose for a human, and as a `matches(card)` predicate over fields a Result Card already carries. The predicate ships WITH the entry so a new card is classified the moment it exists — asking card authors to declare their own exposure is the pattern that rotted three times already. (WS-330) |
| **`suspect-pending-review`** | The flag a Result Card carries once a fault it depended on is **confirmed**. It does **not** mean the card is wrong — it means the conclusion rested on something now shown to be faulty and nobody has re-checked it. The action it asks for is a re-check, not a retraction. This is the retroactive invalidation trail WS-291 did not have. (WS-330) |
| **Register version** | `FR-1+<content hash>`, stamped into every `manifest.disclaimerRegisterVersion`. The hash is what makes it honest: edit any entry and the version changes whether or not anyone remembered to bump anything. Same argument as stamping `contentHash` in the Strategy Card loader. (WS-330) |
| **Equity operator** | The 169x169 all-in preflop equity matrix `M` read as an operator on the range grid, indexed by `rangeIndex` so it and every range grid share one coordinate system. Engine-independent: a property of the deck, not of this repo's model. `src/utils/pokerCore/equityOperator.js`. (WS-337) |
| **Skew part** | `S = M - 1/2`. **Exactly** skew-symmetric, because `E(a,b) + E(b,a) = 1`. Everything below is a theorem about skew operators, so the antisymmetry residual is the premise and is asserted, never assumed. (WS-337) |
| **Rotation plane** (cyclic plane) | One of the canonical 2-D invariant blocks of `S` (Youla / real Schur form), with a magnitude `sigma_k`. A rotation in range space is a cycle, so each plane is one rock-paper-scissors structure with a size attached. 169 is odd, so there are at most 84. **The plane and its magnitude are the invariants; the two axes inside it are an arbitrary basis choice and must never be used to rank hands.** (WS-337) |
| **Strength ladder** (transitive part) | The orthogonal projection of `S` onto `{S_ij = f_i - f_j}` — the matrices a pure ranking can produce. Not a fitted model: the potential is exactly `f = S w` = average equity minus 1/2. A purely transitive game is already **rank 2**, which is why a low-rank finding means nothing without the split. (WS-337) |
| **Intransitive residual** | `R = S - T`, orthogonal to every strength ladder. The part that makes poker a game rather than a ranking. Measured at 25.99% of skew energy, and far *less* compressible than the whole operator. (WS-337) |
| **Intransitivity map** | Per hand class, the RMS cyclic edge it carries against a randomly drawn opponent hand, in percentage points — the equity no strength ladder can express. A committed 169-cell grid, not a number in a ticket. (WS-337) |
| **Compression claim** | A claim that `k` planes suffice. Must carry **energy share AND reconstruction error AND the transitive/intransitive split**, plus boards, seeds, basis and the plane threshold. `buildCompressionClaim` refuses an incomplete one in code — energy share alone flatters every low-rank claim, and "low rank" restates "there is a strength ladder" without the split. **Deliberately NOT a Result Card:** a Match is `Surface x Deal Book x Field`, and this claim has no surface, no strategy and no opponent population — it is a property of the deck. Minting a Card would mean inventing a `fieldId` for a measurement that has no field. Scoring the basis *against* the 169-cell grid on corpus data would be a comparative claim about model quality and **does** need one. (WS-337) |
| **Noise replica** | `(S_A - S_B)/2` from two independently seeded builds: statistically identical noise to the signal matrix `(S_A + S_B)/2`, and therefore a **measured** floor for what counts as a significant plane. A plane count without one is a taste judgement wearing a number. (WS-337) |

### The four surface kinds

Three of the five surfaces FSA registers are the *same kind of object measured on different
populations*, which is why comparing the Fields to each other **is** the live-vs-online transfer
question.

| Kind | Origin | What it is |
|---|---|---|
| `Equilibrium` | imported | What an unexploitable opponent does. SRC-013 — **does not exist yet**, and is left unavailable rather than faked. |
| `Field` | observed | What a population does. SRC-011/012 (HandHQ, 2009, online), SRC-005 (Ignition, current), SRC-014 (live 1/3). |
| `Read` | fitted | What our model believes *this* villain does. |
| `Declared` | **authored** | What someone said they would do, on purpose, with reasons. **The sixth surface, added by WS-322.** |

The first three are observed, fitted, or imported. None could be *declared* — that absence was
the gap ADR-009 closes.

### The four warrants

| Warrant | Settled by | Note |
|---|---|---|
| `equity` | arithmetic over hand equity vs a range | |
| `structure` | arithmetic over pot odds, SPR, position, who is left to act | |
| `read` | **a falsifiable claim about a population number** | Should state the claim, so it can be scored. |
| `fear` | the author, admitting it | See below. |

**Why `fear` is legal.** The instinct is to disallow it. But **you can only measure what authors
will admit to** — outlaw the warrant and fear does not leave the card, it hides inside an
`equity` rule whose arithmetic does not support it, where nothing can find it. Declared, it
becomes measurable: *how much of this card's EV comes from rules its own author labelled fear?*

**Declared, then audited.** Declaring invites honesty but catches only the honest. The
counterpart is a derived test — an `equity`-warranted rule that deviates toward passive in the
MEDIUM band with no arithmetic justification is behaving like fear regardless of its label.
`warrant.derivedVerdict` is the slot that test writes into. WS-322 ships the slot; **WS-327
ships the detector.** `null` means *not yet audited*, which is a different fact from *audited
and agreed*.

---

## Naming, resolved

- **`surface_kind`, not `surface_class`.** `docs/provenance/data-source-registry.md` already
  uses `surface_class:` on all fifteen SRC entries to mean something else entirely —
  `internal_db | vendor_api | derived | reference_data`, i.e. what kind of *store* a source is.
  That register is promoted and shipped first, so the new axis takes the new name. Founder
  decision, 2026-08-02.
- **`surface`** keeps FSA's meaning in measurement code. The **UX** meaning stays scoped to
  `docs/design/surfaces/`. No third meaning.
- **`MDF`** is **Mass Data Field** (SRC-012 raw / SRC-011 aggregates). `MDA` is retired for the
  pool — it already means Market Dynamics Analysis in the governance layer. Note the separate
  collision: MDF also means *minimum defense frequency* in POKER_THEORY §6.2; context
  disambiguates, and measurement code should prefer "Mass Data Field" spelled out.
- **Geometry cells may be named as vocabulary and never branched on as inputs.** A geometry-cell
  name used as a decision input is `if (position === 'EP')` in new clothes.

---

## Schema versions

All schemas are **ADDITIVE-ONLY**, the same discipline as the IDB migration rule. Fields are
appended, never removed and never retyped; an obsolete field is marked `deprecated` and left in
place so an existing reader gets `null` rather than a crash.

| Object | Version | Defined in |
|---|---|---|
| Strategy Card | 1 | `src/utils/standardOfRecord/schemas.js` |
| Decision Atom | 1 | ″ |
| Coverage Census | 1 | ″ |
| Deal Book manifest | 1 | ″ |
| Field manifest | 1 | ″ |
| Result Card | 1 | ″ |
| Fault entry | 1 | ″ (WS-330) |

Enforced by `src/utils/standardOfRecord/__tests__/schemas.test.js`, which pins a baseline of
every shipped field. The companion CI grep gate — modelled on `scripts/check-idb-additive.sh` —
is **WS-329's**, which is where the standard becomes binding.

---

## The replication manifest

Every Result Card carries one. Each field is here because its absence would make the number
unreplicable.

| Field | Why |
|---|---|
| `engineCommit` | **Nothing in the repo captured this before WS-322.** Every prior published figure names the code that produced it only by implication. |
| `engineDirty` | A dirty tree means the commit does *not* identify the code that ran. |
| `dealBookHash` | A path or a file *count* cannot detect that the corpus changed underneath a rerun. |
| `fieldVersion` | Which opponent model, at which version. |
| `partition` | POOL/EVAL split and the walk-forward prefix. |
| `seeds` | Every seed **actually used**. A default that is never recorded is reproducible-by-luck. |
| `unseededSources` | Randomness the run could **not** seed. An empty array is a *positive claim* of bit-reproducibility. |
| `constants` | Minimum set: `PRIOR_WEIGHT`, `ACTION_TAU_FRACTION`, `MIN_CONTINUATION_WEIGHT`. A floor, not a schema — stamp whatever else a run depends on. |
| `knownDivergences` | Where a stamped value is known to have a shadow copy elsewhere. `agrees: null` means the shadow could not be read, which is not the same as disagreement. |
| `disclaimerRegisterVersion` | Which [suspected-fault register](DISCLAIMER-AND-FAULT-REGISTER.md) the run stood under. **A card without one is invalid** — confirming a fault later could not otherwise tell which prior results it invalidates. One deliberate asymmetry: the schema field stays optional so `checkAgainstSchema` can still *parse* a legacy card, because the flagger has to open an old card in order to flag it. Validation tightens; reading does not. (WS-330) |

### Transfer risk: rake-driven conclusions (WS-333)

Rake enters the derived floor via `estimateRake` with no-flop-no-drop honoured, and the
steal-vs-defend asymmetry is emitted as an explicit quantity. **It does not transfer between
pools.** Measured on the same spot (BB defending 1.5 into 4bb vs a 2.5x BTN open, 100bb):

| Pool | Rake config | Extra equity the defender needs |
|---|---|---|
| Live 1/2 | 10%, $8 cap | **+4.8pp** |
| Online corpus (SRC-012) | 5%, $3 cap | **+2.3pp** |

A rake-driven conclusion measured on the 2009 online corpus therefore understates the live
effect by roughly half. Any claim of this shape must state which pool it was measured on.

**Second limit, larger:** rake is **inert on the live app path** — `liveHandState.rakeConfig`
is read (`useLiveActionAdvisor.js:162`) and never written, and `GAME_TYPES[ONE_TWO].rake` is
never mapped into an engine config, so `estimateRake` returns 0 on every live decision. The
corpus instrument applies rake; the live advisor does not. Filed separately, not fixed in
WS-333.

### AS-711 (geometry pooling) — first measurement, 2026-08-02

`scripts/backtest/run-geometry-ablation.mjs`, 4,132 paired EVAL decisions, 50NLH:

- **Street contribution +0.0164 log-loss, CI [0.0063, 0.0265] — excludes zero.** Adding
  `street` back to a geometry ladder made prediction **worse**. Street helped in **0 of 14**
  well-sampled cells. AS-711 is **not refuted** and is mildly supported.
- **But no arm admissibly beat `ctrl:pooled`** (facing-action only) at this sample —
  geometry-only had the lowest log-loss (0.7507 vs 0.7620 pooled) with a CI touching zero.
  So the dimensions have not yet collectively earned their place, which echoes WS-285's
  finding that street, texture and posCategory were each worse than pooling.
- **One site.** POKER_THEORY's standing rule applies: *a single-site result is a hypothesis;
  two sites agreeing is a finding.* Re-run on FTP before treating this as settled.

**Known limit, stated rather than implied.** The hero-EV instrument is **not bit-reproducible**:
`heroPolicy → evaluateGameTree → handVsRange` reaches `pokerCore/monteCarloEquity`, which calls
`Math.random()`. Two runs over the same Deal Book with identical seeds agree to within Monte
Carlo noise, not exactly. Do not read a small difference between two Result Cards as a change.

---

## What WS-322 deliberately did NOT build

**No comparison path.** FSA Phase 3 — the divergence instrument — does not exist in code; Phase 1
(the situation key, `src/utils/pokerCore/situationKey.js`) is the only phase that does. ADR-009's
guarantee is that `Declared` is scored by the *same* instrument as the other four and that no
second path is permitted. From here, the way to honour that is to build **no comparison at all**:
register the surfaces, define the interface Phase 3 will consume, stop. Building one now would
create the second path the ADR forbids, and would do it before FSA's open question #2 — *what is
the divergence function `d`?* KL versus EV-difference, "decide in Phase 3, measure both" — has
been answered.

Also not built here, and owned elsewhere: the Decision Atom **store** and the Census
**computation** (WS-328), the population simulator (WS-326), the 169-cell Entry Map (WS-323),
stack-registration refusal (WS-324), the derived-fear detector (WS-327), and flipping the
invariant from advisory to enforcing (WS-329).

---

## Using it

```js
import { loadStrategyCard, evaluateCard } from '@/utils/standardOfRecord';

const card = await loadStrategyCard(myCardObject);  // throws on anything malformed
const out  = evaluateCard(card, situation);
// { action: {call: 0.7, ...}, ruleId, warrant, residual, abstained, reason }
```

A Card is a **plain JS module exporting a data object** (`*.card.js`) rather than YAML — the repo
has no YAML parser, and a Card must load in the browser as well as the Node harness. Adding a
runtime dependency to parse a format we control was the worse trade. `rationale` is a *required
field* rather than a comment for the same reason: prose that matters should be data, and it is
hashed with the rest of the card.

**The loader rejects; it does not warn.** Missing residual clause, a positional string key, an
axis outside the situation key, a warrant outside the enum, a distribution that does not sum to
1, a duplicate rule id, a schema version from the future. There are no legacy Cards to
grandfather, so a malformed card is a bug at the author, today.

See `src/utils/standardOfRecord/__fixtures__/` for a valid card and a deliberately unenclosed one.
