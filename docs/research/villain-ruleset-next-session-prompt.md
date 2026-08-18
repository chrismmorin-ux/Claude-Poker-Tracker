# Continuation prompt — villain ruleset evaluation

Copy everything below the line into a new session.

---

We are building a **pure descriptive model of individual poker villains** — what rules are in
their head — from the HandHQ corpus (online 50NL, 2009, 9-handed). No exploits yet. The corpus
is online and historical; my game is live 9-handed 1/2–1/3, so every rate is **transferred, not
measured**, and you should say so when reporting one.

## What already exists — read these first

- `.claude/context/VILLAIN-ARCHETYPE-ENGINE.md` — the engine spec (rule shapes, the exception
  protocol, negative findings, archetype branching, the inference layer).
- `scripts/villainArchetype/decisionSchema.mjs` — **schema v8**, the ONE record shape. Fields are
  grouped `situation` (the only ones a rule may condition on), `action` (the target), `outcome`
  (never conditionable — it is the future).
- `scripts/villainArchetype/profileVillain.mjs` — **THE PROCEDURE**. One command, same steps,
  any villain: LOAD → GATE → ENUMERATE → INDUCE → WRINKLES → EMIT.
- `scripts/villainArchetype/induceCore.mjs` — the single induction implementation.
- `scripts/villainArchetype/ruleCatalogue.mjs` — 34 candidate rules written as poker prose.

Run it: `MAX_FILES=120 node scripts/villainArchetype/profileVillain.mjs`
Second villain: add `RANK=2`. Specific villain: `VILLAIN=<id>`.

## Current state, measured

Villain 1 = `SO0Om/HLLvkJps9pZmbgqQ` — 1,544 hands, 1,937 decisions.
**34 rules · 100% coverage · 83.0% in-sample accuracy · 6 wrinkles · 4 rules with CI wider than 30pp.**
Villain 2 = `jSCaL6Fm4lAiTDVH2dFATQ` — 1,263 hands, 1,562 decisions, 28 rules, 100% coverage, 77.3%.

His positional opening ladder, induced not written: EP 9.7% · HJ 9.0% · SB 12.9% · CO 14.7% · BTN 21.0%.

## Standing rules for this work — these came from corrections, do not re-learn them

1. **Score as DESCRIPTION, not generalisation.** In-sample, 100% coverage is required and
   reachable by construction. Do not import a majority-class baseline — "if the price is worse
   than X he folds" is a rule, not a freebie to beat. What carries information is **rule count**
   (compression), not accuracy.
2. **The feature set must be everything the villain could see.** If he acts on it, it is a column.
3. **Over-enumerate.** Position exists as seat name, seats off the button, players still to act,
   players already acted, is-blind, is-late, acts-after-the-aggressor, blind-vs-blind. Redundancy
   is deliberate — correlation picks the framing, not us.
4. **Street-aware collapse.** Six position labels preflop; postflop they are only in-position vs
   out-of-position. Six labels postflop fragment the data chasing one binary in six costumes.
5. **The residue of a rule is his RANGE in that spot.** Never round it away.
6. **A wrinkle is a leaf whose residue is too big to be a range.** Expand the surface, re-run,
   expand again, until there are no wrinkles — only confidence intervals.
7. **Every agent that reads a hand must state the WHY**, not the surface description. An agent
   already wrote "a genuine bluff/semi-bluff with only a small pocket pair" and my aggregation
   dropped it. Do not lose the causal statement.

## Three bugs that shipped this session — the gates exist because of them

Each was caught by me pushing back on a wrong-looking result, not by the code. `profileVillain.mjs`
now **exits non-zero** before inducing any rule if a gate fails. Add a gate every time something
new gets through.

- Price owed was the size of the BET, not what the seat owed → limped pots read "nothing to call".
- "Invested so far" used the hand's FINAL total → fed the model the future.
- "What he paid" summed only CALLS → a 25bb check-RAISE counted as zero.
- `texture.paired` was undefined (field is `isPaired`) → **paired boards fired 0 times in 1,937 rows.**

## Findings that are settled, and one that is refuted

- **He bluffs.** Shown: check-raise to 25bb with an underpair (77) on 3♣4♠8♠. "Never bluffs" is
  refuted; do not resurrect it.
- **The set hypothesis is refuted.** 2 of 14 shown pairs made a set; AA/KK×4/QQ×2/TT×3/JJ reached
  showdown unimproved.
- **His ranges are not charts.** Right width, wrong composition — AJo forced into a 9.7% EP range,
  76s into a 14.7% CO range.
- **Shown hands are survivor-filtered.** Only 11% of hands he voluntarily played reached a shown
  showdown. They are a floor on range width, never the range.
- **River bluffcatch ceiling:** faces 14 river bets — calls 67% of small (<0.4x), 57% of medium,
  33% of pot, **0% of overbets**. Never raised a river in 14 chances. n is thin; treat as provisional.

---

# YOUR TASK, in this order

## 1. Full evaluation of villain 1, and a visual

Run the procedure on villain 1. Then produce **an Artifact** — a villain dossier — that answers,
for a non-technical reader:

- **What the ruleset says he does**, in the first person, rule by rule, with each rule's sample
  size and confidence interval.
- **What it explains and what it does not.** Coverage is 100% by construction, so that number
  alone is not the story — show the *wrinkles* (leaves no rule resolves) and the *thin* rules
  (CI wider than 30pp) as first-class content, not a footnote.
- **His ranges**, by entry type (open by position / iso-raise / 3-bet / call a raise / BB free
  look), with the width measured and the shown hands marked as hard constraints. State plainly
  that composition beyond the shown hands is an assumed ordering, not evidence.
- **What we still cannot see** — the hole cards on 95.3% of decisions, and what that costs.

Before writing the artifact, load the `artifact-design` skill. Verify it renders (light and dark)
before publishing.

## 2. Then introduce villain 2

Only after villain 1's evaluation is done and I have seen it. Run the same procedure unchanged on
villain 2, then lay the two rulesets **side by side**:

- Which rules do they share, within overlapping confidence intervals?
- Which rule does villain 2 diverge on — one rule (sub-archetype), or two or more (a new archetype)?
- Before splitting them, try **restating the failing rule** at a different granularity. A split is
  only correct once the archetype has been given the chance to re-condition and still failed.
- Report the ordering control: archetype boundaries measured earlier were NOT stable under shuffled
  order, so do not present two archetypes as discrete until that is re-checked.

Do not build the range-inference layer yet unless I ask. 15 of the 34 catalogued rules are blocked
on it, and it is the obvious next build after villain 2.
