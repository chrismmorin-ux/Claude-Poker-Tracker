---
version: '1.0'
status: specification — not yet implemented
authored: 2026-08-18
governing_program: prog-domain-correctness
supersedes_nothing: true
---

# Villain Archetype Engine — the context an engine needs to do this properly

**What this document is.** The v0 machinery in `scripts/villainArchetype/` works and is
wrong in ways that are now *named*. This is the specification for the engine that replaces
it: what a rule may say, how a rule is tested, how archetypes branch, and what the engine
must report when it finds nothing. It is written to be fed to an engine, so it states
requirements rather than history.

**The founder's brief, verbatim, because every requirement below traces to a clause of it:**

> "I don't yet see what I know to be true at the table emerging in the rulesets, and I need
> to trust the process is good and can adapt into the shapes we need it."

That is the acceptance test. Not coverage, not parsimony — whether a person who plays this
game reads the output and recognises the players.

---

## 1. Why v0 does not produce table truth — the diagnosis, measured

**The rules are stats wearing a costume.** All ten v0 contexts are marginal frequencies
re-voiced in the first person. `I enter 13% of pots when nobody has come in` **is VPIP**.
`I continue against a raise 11% of the time` **is fold-to-preflop-raise**. Restating a
marginal in the first person changes nothing about what it can express, and the founder's
instruction was to change the unit, not the phrasing.

**A marginal frequency cannot express any of the things a player actually knows.** Every
example the founder gave is conditional, sequential, size-dependent, hand-class-dependent,
or opponent-dependent. Not one is a marginal:

| Founder's example | What it needs that a marginal lacks |
|---|---|
| "calls up to a pot-sized bet with top pair when holding at least Q kicker" | bet-size **ceiling** × hand-class × kicker **floor** |
| "limps all suited hands" | hand-class predicate over an unobserved range |
| "I slow play top/middle set when setmining" | hand class × prior-street role × **sequence** |
| "I range cbet except low connected boards" | near-universal rule with a **named exception set** |
| "I fold top pair to river aggression on dynamic runouts" | street × hand class × **runout history** |
| "I overcall against aggressive archetypes" | **the opponent's archetype as an input** |
| "20% of this archetype will mix limping with AA and AK" | a **sub-rule living inside an exception set** |

**Exceptions are discarded, and they are the most informative decisions in the sample.**
Measured on villain `SO0Om/HLLvkJps9pZmbgqQ` (1,544 hands): the rule
`I always raise when I enter first — I never limp` is 91/94. The three contradicting
decisions had **cards never shown**, so trap-limping and noise are indistinguishable — and
they imply opposite exploits. v0 printed "never" and dropped them.

**Signal is visibly present in fields the language cannot hold.** In the same villain's
raise-over-limper decisions the *sizing* is 2.00x pot against one limper and 1.71x against
two — a sizing rule hiding inside a frequency rule. v0 records only the frequency.

**None of this is a data limitation.** Every field needed above is already on the labelled
decision (`scripts/villainArchetype/decisionLabeler.mjs`) or derivable from it. The
limitation is the rule language, and the rule language is ours.

---

## 2. The data budget, stated honestly and once

Any rule the engine proposes must be checkable against this. Measured, not assumed.

| Fact | Value | Consequence for rule design |
|---|---|---|
| Hole cards visible | **4.70% of seat-hands**, showdown only | Hand-class rules are **pooled-only** at the villain level |
| Folds revealed | **never** | No rule may claim the *composition* of a folding range from observation |
| Amounts, blinds, stacks, board, button | **100% of decisions** | Price, SPR, sizing, texture, opponent count are always available |
| Player identity | **stable** (4,073 ids / 28,699 hands, max 1,087) | Per-villain accumulation is sound |
| Population | online 50NL, 2009 | Every rate is **transferred, not measured** for a live 1/2–1/3 game |

**The asymmetry that biases every hand-class rule, and it runs one way:** a seat reaches
showdown by *continuing*. Revealed hands over-represent hands that connected. A range fitted
on revealed hands is the range that **continued**, never the range that **acted**. Every
composition figure is a floor on the off-chart tail, never a ceiling.

**Frequency is the instrument that escapes this.** A range rule carries a combinatorial
measure; the villain's frequency in that spot is measured on *all* decisions. A villain
entering 13% refutes an 8% opening range with no card ever shown. **Frequency falsifies
size; showdowns discriminate shape.** Both are required and neither substitutes.

---

## 3. Rule shapes the language MUST express

A rule is a testable claim about what a player does in a named situation. The engine may not
emit a rule shape not on this list without also emitting the shape's definition.

### 3.1 Threshold rules — floors and ceilings

The founder's core shape, and the one a rate cannot express.

```
CEILING   I call up to <X> of pot, and fold above it
FLOOR     I need at least <Y> kicker to continue
BAND      I continue between <A> and <B> required equity, and fold outside
```

A ceiling is **not** a frequency. `folds to bets 66%` averages over every price and describes
no decision. `calls up to 0.75x pot and folds above` predicts each decision separately and is
refutable by a single counter-example at the wrong price.

**Fitting:** bin decisions by the conditioning variable, find the crossing point, and report
the **sharpness** of the crossing. A soft crossing is itself a finding: it means the player
is not thresholding on that variable, which is a different player from one who is.

### 3.2 Hand-class rules

Classes must be the ones players use, not grid indices: `pocket pairs` (and `small` /
`medium` / `premium` splits), `suited connectors`, `suited gappers`, `weak aces` (Ax below
some kicker), `broadways`, `offsuit junk`, and postflop `top pair` / `second pair` /
`overpair` / `set` / `draw` / `air`, each with a kicker where one applies.

```
I <action> with <hand class> when <condition>
I play <class A> and <class B> THE EXACT SAME WAY        <- see §4, negative findings
```

### 3.3 Multi-conditional rules

Conjunctions over the labelled decision's fields, with a stated maximum arity so the search
cannot overfit silently. Every added condition must **pay for itself** (§5).

```
I call a bet up to 0.75x pot WITH top pair AND kicker >= Q EVEN IF a flush is possible
```

### 3.4 Sequence rules

Claims about a *line*, not a node. These are invisible to any per-node aggregation, and the
range engine's own doctrine aggregates nodes independently (`rangeEngine/CLAUDE.md` §4) —
correct for estimating a range, unable to express a path.

```
I bet the flop and give up the turn when called
I check-raise the flop only when I checked the previous street as the aggressor
I slowplay a set on the flop when I entered as a caller
```

### 3.5 Sizing rules

Sizing is an action attribute already on the record and currently unused.

```
I bet <fraction> of pot on the flop regardless of hand
I size up against multiple opponents        <- measured in the v0 villain: 2.00x vs 1 limper, 1.71x vs 2
```

Sizing rules are especially valuable because they are **hand-class-independent** and
therefore fully observable — they escape the 4.7% card budget entirely.

### 3.6 Opponent-conditional rules — and the bootstrap they require

```
I overcall against <aggressive archetype> relative to my own baseline
I overfold facing a raise from <nitty archetype>
```

**This is circular by construction and the circularity is resolvable, not fatal.** Rules that
reference archetypes require archetypes that were defined by rules. The engine must run it as
a fixed-point iteration:

1. Assign provisional archetypes using **opponent-independent rules only**.
2. Admit opponent-conditional rules, using the provisional labels of the *other* seats.
3. Re-assign every villain under the enlarged rule set.
4. Repeat until assignments are stable.

**Report the trajectory, not only the fixed point.** If assignments keep moving, the
archetypes are not identifiable from this data and saying so is the finding. Note also the
distinction the previous measurement did *not* establish: multiple villain types were shown
to **exist**; that one player's type **shifts another's decision** is exactly what this step
tests for the first time.

### 3.7 Correlation and merge rules

Two rules that are secretly one must be detected and merged, or the ruleset inflates while
describing nothing new.

```
MERGE     <rule A> and <rule B> fire on the same decisions (phi > threshold) -> one rule
IMPLIED   <rule A> fires only where <rule B> fires -> A is a special case of B
```

---

## 4. The exception protocol — non-negotiable

**Every rule ships with its exception set. A rule that reports a rate and discards its
counter-examples is rejected by the engine, not merely flagged.**

For each rule the engine emits:

- `k / n` and the fired/not-fired split.
- **Every contradicting decision**, with all observable fields.
- A verdict on the exception set, from a closed list:
  - `resolved-subrule` — the exceptions share a condition; the sub-rule is stated and becomes a candidate **sub-archetype** (§5.3). *This is the founder's "20% of this archetype will mix limping with AA and AK".*
  - `resolved-noise` — the exceptions are consistent with the rule's own error rate under an explicit null, and the null is named.
  - `unresolvable-here` — the discriminating fact was never observable. **The engine must say what would resolve it and where that evidence would come from.** For per-villain card scarcity the answer is normally: pool the exception set across every member of the archetype, where showdowns accumulate.

**"Never" and "always" are claims about the exception set, not shorthand for a high rate.**
An absolute is only permitted when the exception set is empty, or when it is `resolved-noise`
with the null stated. `I never limp (91/94)` is a rejected sentence.

### Negative findings are outputs, not silence

The founder asked for *"a definitive statement that 'They play them the exact same' that
assures me we have looked into it."*

When the engine searches a distinction and does not find one, it must **say so, naming the
distinction searched and the power it had**:

```
SEARCHED: does this archetype play suited connectors differently from small pairs
          in the same spot?  n = 412 decisions.
FOUND:    no difference detectable. Continue rate 34% vs 36%, and the sample would
          have detected a gap of 9pp or more.
```

A silent absence is indistinguishable from a search never run, and the repo already has a
gate built on that principle (`labelLedger` fails its own self-check if it reports zero
unmeasured rows). **The blind-spot rule is inverted deliberately: a ruleset with no negative
findings and no unresolved exceptions FAILS review**, because the naive direction rewards
looking less.

---

## 5. Rule quality — how a rule is beaten by a better rule

The founder's requirement: *"every rule is appropriately descriptive that it can be tested
against a better rule."* A rule is therefore never accepted on plausibility. It is accepted
because it beat the alternatives on a stated scoreboard.

### 5.1 The scoreboard

Every rule is scored by **held-out predictive log-loss on the villain's own decisions**, with
a walk-forward split (early hands fit, later hands score) — never by how well it fits the
hands it was built from. The repo's own leakage doctrine applies: corpus-mined priors leak
into corpus backtests by construction, so a rule mined from a villain's hands must be scored
on hands it never saw.

A candidate rule replaces an incumbent when it **beats it out of sample**. Ties go to the
simpler rule.

### 5.2 Parsimony, enforced not hoped for

Total ruleset cost = predictive loss + a complexity penalty per rule and per condition. This
is what makes "maximally describe with minimal ruleset" an optimisation rather than an
aspiration. A condition that does not pay for itself out of sample is **removed**, and its
removal is reported.

### 5.3 The three-way branch, with the thresholds exposed

When a villain is tested against an archetype, exactly one of these fires:

| Outcome | Condition | What is emitted |
|---|---|---|
| **member** | follows every shared rule within 1.96 sd | joins; the archetype refits (μ, σ) |
| **sub-archetype** | diverges on exactly one rule | the divergent rule is named and becomes the sub-type's defining rule |
| **new archetype** | diverges on ≥ 2 rules | a new ruleset is built from this villain |
| **outlier** | diverges on ≥ 2 rules **and** no other villain joins it after the full pass | reported as an outlier, never as an archetype of one |

`1.96 sd`, `exactly one`, `≥ 2` are **tunable thresholds and must be exposed as such**. The
engine reports how the partition changes as they move. A partition that survives only at one
threshold setting is not a partition.

**Archetypes must adjust their own rulesets under test.** When a villain fails membership on
one rule, the engine tries *relaxing or re-conditioning that rule* before splitting — because
the rule may simply be stated at the wrong granularity. A split is only correct once the
archetype has been given the chance to restate the rule and still failed. This is the
difference between discovering a subtype and manufacturing one.

### 5.4 Ordering must not determine the partition

The incremental process is order-dependent by construction: the first villain founds the
first archetype. **Shuffled-order runs are a required control, reported every time.**

Already measured on v0: archetype count (20–25) and coverage (79–89%) reproduce under
shuffling, but the boundary between the two largest archetypes does not — 33%+30% ordered
versus 32%+13%, 41%+15%, 28%+19% shuffled. **Those two are one continuum, not two clusters,
and the engine must not present them as discrete.** Any partition whose *boundaries* move
under shuffling is reported as a gradient with the unstable boundary named.

---

## 6. What the engine emits

For each archetype:

1. **The ruleset, in the first person**, each rule carrying: k/n, its exception set with a
   verdict, its out-of-sample score, and the rules it beat.
2. **Coverage**: what share of villains it claims, at the stated confidence, with σ per rule.
3. **Sub-archetypes**, each named by its divergent rule and its share of the parent.
4. **Negative findings**: every distinction searched and not found, with the power of the search.
5. **Unresolved exceptions**, with what would resolve each.
6. **Stability**: how coverage and boundaries move under shuffled order and threshold changes.

For the population:

7. **Total coverage** and the **outlier set** — villains no archetype claims. A growing
   outlier set is the signal that the rule language is missing a shape, and it is the
   engine's own falsifier.

---

## 7. Standing constraints inherited from the repo

These are not negotiable by this engine and are listed so it cannot violate them innocently.

- **Labels are outputs, never inputs** (POKER_THEORY §7.1). A rule may not condition on a
  position label, a style bucket, or an archetype *name* as a causal input. Opponent-archetype
  conditioning (§3.6) is permitted because the archetype is itself defined by decision rules
  and is re-derived each iteration — it is a summary of decisions, not a label applied to a
  player.
- **Villain decisions derive from equity, pot odds, SPR and players remaining.** Every rule
  condition must be one of these or a directly observable feature of the decision.
- **Every number carries its conditioning set and its inverse conditional.** A rule's rate is
  meaningless without the set of decisions it was measured over.
- **A subclass is carved from its parent** (DEC-025 Amd 1). A sub-archetype shrinks toward its
  parent; it is never fitted independently.
- **Any comparative claim resolves to a Result Card** (ADR-009). "This ruleset predicts better
  than that one" is a comparative claim.
- **The corpus is online 2009; the founder's game is live 9-handed 1/2–1/3.** Transferred, not
  measured. Say so on every output.

---

## 8. Acceptance test — the table truths this must be able to express

**This section is deliberately incomplete and is the highest-value input the founder can
supply.** The engine is not accepted because coverage is high. It is accepted when it
expresses and tests the things the founder already knows are true at the table.

Seeded from the founder's own words so far — each must be expressible as a rule, testable
against the corpus, and refutable:

- [ ] "I open top X hands, being JJ+, AQo+, ATs+" — range rule, size from frequency, shape from showdowns
- [ ] "Calls when equity > 75%" — threshold rule on equity
- [ ] "Calls up to a pot-sized bet with top pair holding at least Q kicker, even with a straight or flush on board" — ceiling × hand class × kicker floor × board texture
- [ ] "Limps all suited hands" — hand-class rule
- [ ] "Follows preflop charts strictly" — conformance of shape to a named chart
- [ ] "3-bet bluffs some hands" — a frequency with a composition claim
- [ ] "Slow plays top/middle set when setmining" — hand class × entry role × sequence
- [ ] "Checks out of position every time" — near-absolute with exception set
- [ ] "Range c-bets except low connected boards" — near-absolute with a *named board* exception
- [ ] "Bluffcatches if villain has too much air in their range" — opponent-range-conditional
- [ ] "Folds top pair to river aggression on dynamic runouts" — street × hand class × runout
- [ ] "Overcalls against aggressive archetypes" — opponent-archetype-conditional
- [ ] "Mixes limping with AA and AK" — sub-rule inside an exception set

**FOUNDER: the list above is thirteen items drawn from two messages. The real list is the
one in your head, and it is the missing input — not more corpus, not more compute.** Every
item added here becomes a shape the engine must express and a test it must pass.
