---
name: reframe-engine
description: Generative structural fan-out — many mathematically-native lenses propose REFRAMINGS of a domain object, each carrying a falsifier and a cost. Produces candidate jumps, not critiques.
---

# reframe-engine

**Generative, not evaluative.** Every other engine in this repo critiques an artifact that already exists. This one produces **candidate reframings**: "X is currently treated as A; it is really B; here is what becomes computable; here is the number that kills it."

## Why this engine exists

The roundtable engines (`eng-engine`, `corrective-plan`, `design-critique`, `research-review`) all take an artifact and attack it. Pointed at an unmeasured idea they produce critique of an unmeasured idea, which is how runs come back generic.

The originating case: range space was treated as 169 loose numbers for the life of the project. Noticing that equity is an **antisymmetric bilinear form** — and that antisymmetry forces a decomposition into rotation planes — took one observation and produced a measurable consequence within an afternoon. That jump was structural, not evaluative. No existing engine could have produced it, because none of them are staffed to think that way and none of them are asked to generate.

## Persona set

Deliberately **not** "poker expert." The founder's framing is mathematical and the personas must match it.

| Persona | Lens |
|---|---|
| `game-theorist` | Antisymmetry, intransitivity, best-response operators, exploitability |
| `geometer-topologist` | What kind of object is this; coordinates, invariants, dimension, quotients |
| `operator-analyst` | Write the pipeline as operators; spectra, fixed points, perturbation |
| `information-theorist` | Sufficient statistics, compression with residual, the human-at-a-table channel |
| `estimation-theorist` | Identifiability, sample complexity, basis, leakage |
| `research-scientist` | The adversary — attacks every proposal, demands falsifiers |

## Binding rules

These are not style preferences. They come from measured failures in this project.

1. **Arbitrability first.** A claim a number can settle outranks a claim an argument can settle. Rank all output this way.
2. **Every proposal carries a falsifier** — the specific measurement that would kill it, and roughly what it costs. No falsifier, no promotion.
3. **Every proposal is labelled engine-dependent or engine-free.** This repo's engine is **not accuracy-validated**. A measurement routed through it measures agreement with an unvalidated model, not truth. Engine-free proposals (pure combinatorics, algebra, corpus counts) rank above engine-dependent ones of equal merit, and engine-dependent results must be labelled as conditional on the engine wherever they are reported.
4. **No compression is a replacement.** Reframings that project or reduce are ADDITIONAL lenses carrying measured residuals. Standing founder rule: never delete articulable flexibility for a null result.
5. **Report the pessimistic metric.** Energy share flatters; reconstruction error is honest. Give both.
6. **A pure strength ladder is rank 2.** Any "low rank" finding must show it is not just the transitive backbone rediscovered.
7. **Labels are outputs, never inputs.** Position/bucket/style labels may not enter a decision computation (POKER_THEORY §7).

## Procedure

**Phase 0 — Scope.** Name the object under reframing and its current representation, by file and line. If the founder gave a seed idea, restate it as the object it is about.

**Phase 1 — Divergent fan-out (parallel).** Each persona independently proposes **3–5 reframings** of the object. They do not see each other's output. Diversity is the product; overlap is waste.

**Phase 2 — Cross-critique (parallel).** Each proposal goes to `research-scientist` plus one persona from a different lens. Two questions only: *is the structure real?* and *is the falsifier actually decisive?* Proposals surviving both advance.

**Phase 3 — Cheapness pass.** For every survivor, state the cheapest experiment that resolves it and its rough cost. Anything resolvable in under a day is flagged **RESOLVE-NOW**.

**Phase 4 — Synthesis.** Rank by (arbitrability x consequence) / cost. Output:
- **RESOLVE-NOW** — cheap and decisive; run before filing anything
- **PROMOTE** — worth a queue item, with the falsifier written into accept_criteria
- **PARK** — real but not yet arbitrable; record the blocking measurement
- **REJECTED** — with the reason, so it is not re-proposed

## Execution

Use the `Workflow` tool — this is an explicit multi-agent fan-out and the founder opts in by invoking this engine. Default scale is one round of 6 personas x 3–5 proposals, cross-critique, synthesis. For "be exhaustive," add a loop-until-dry outer round (stop after 2 consecutive rounds producing nothing new) and a 3-voter adversarial verify on each survivor.

## Output

Written to `.claude/workstream/engines/runs/reframe-<slug>-<date>.md`. Promotions become `WS-*.yaml` items via `/workstream`, each carrying its falsifier in `accept_criteria` and its engine-dependence in `status_note`.

## When NOT to run this

- On a narrow, well-scoped implementation question. This engine widens; it does not decide.
- Before a cheap decisive measurement that is already available. Measure first — the engine is far better-posed once a worked example with a real number exists.
