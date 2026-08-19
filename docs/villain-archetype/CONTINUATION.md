# Villain conduct cards — continuation prompt

Copy everything below the line into a new session.

---

We are building a **purely descriptive model of individual poker villains** — what rules are in
their head — from the HandHQ corpus. No exploits yet.

## Read this before trusting anything below

**The working tree is the truth; this document is a pointer.** The previous continuation prompt
was out of date and I acted on stale facts from it for the first hour — it described schema v8,
34 rules and an opening ladder that the corrected instrument does not reproduce. Run the
procedure and read what it prints before believing any number here.

**The corpus is online 2009 and the founder's game is live 9-handed 1/2–1/3.** Every rate is
*transferred, not measured*. Say so when reporting one. Both villains profiled so far are
**six-max** (4–6 seats, zero nine-handed hands), so the gap is a format gap as well as a
population gap.

## Where things stand, measured

| | villain 1 | villain 2 |
|---|---|---|
| id | `SO0Om/HLLvkJps9pZmbgqQ` | `jSCaL6Fm4lAiTDVH2dFATQ` |
| hands / decisions | 2,704 / 3,386 | 7,403 / 9,442 |
| rules · coverage · accuracy | 25 · 100% · 83.5% | 45 · 100% · 78.8% |
| **stale?** | **YES — re-run first** | current (schema v12) |

Villain 1 has not been re-profiled since the last round of instrument fixes. **Re-run it before
comparing anything.**

Published dossiers (same URL redeploys):
- villain 1 — https://claude.ai/code/artifact/415ae668-1e45-4ddb-b315-84c816cac4b4
- villain 2 — https://claude.ai/code/artifact/255303c4-cb0b-486b-8057-32ee19cf3bc8

Both are **behind the current instrument** and need rebuilding.

## Run it

```bash
MAX_FILES=2000 VILLAIN=<id> OUT=.tmp-arch/profiles-x node scripts/villainArchetype/profileVillain.mjs
VILLAIN=<id> OUT=.tmp-arch/chart-specs-x.json node scripts/villainArchetype/buildChartSpecs.mjs
SPECS=.tmp-arch/chart-specs-x.json OUT=.tmp-arch/range-charts-x.json node scripts/villainArchetype/buildRangeCharts.mjs
MAX_FILES=2000 VILLAIN=<id> OUT=.tmp-arch/leaves-x node scripts/villainArchetype/dumpLeaf.mjs
PROFILE=... CHARTS=... EXPLAIN=... CHARACTER=... TITLE="..." OUT=...html node scripts/villainArchetype/buildDossier.mjs
TSV=<profile>.tsv node scripts/villainArchetype/detectability.mjs
node scripts/villainArchetype/__checks__/positionOf.check.mjs
node scripts/villainArchetype/__checks__/handStrength.check.mjs
node scripts/villainArchetype/__checks__/mixTest.check.mjs
```

`MAX_FILES` exists to make a run **quick, never to make it possible** — the loader streams in two
passes and holds only one villain's hands. The full local corpus is 1,756 files.

## The instrument

- `loadVillain.mjs` — the ONE corpus loader. Three scripts each re-typed a naive version and each
  inherited a 4 GB OOM; that is why it is a module.
- `decisionLabeler.mjs` — one labelled row per decision. **Schema v12, 90 columns.**
- `handStrength.mjs` — what his range can MAKE and DRAW to, per decision.
- `rangeInference.mjs` — what his ACTION proves, when his cards are never shown.
- `induceCore.mjs` — the single induction. Bonferroni-corrected G-test on every split.
- `mixTest.mjs` — mix / hidden-cond / needs-cards verdicts.
- `profileVillain.mjs` — **THE PROCEDURE**: LOAD → GATE → ENUMERATE → INDUCE → WRINKLES → EMIT.
- `buildDossier.mjs` + `templates/dossier.html` — the canonical artifact, shape-validated.
- `detectability.mjs` + `behaviourRegistry.json` — 128 behaviours, and whether we could find them.
- `__checks__/` — corpus-free known-answer tests. Run them; they have caught real bugs.

**Gates fail the run.** Every one corresponds to a bug that actually shipped. Add a gate every
time something new gets through — that instruction has paid for itself repeatedly.

## Bugs fixed this session — do not reintroduce

Each was found by an agent reading data or by a gate, never by reasoning:

1. **The loader retained the whole corpus** → OOM at 4 GB, so every early figure came from a
   **6.8% slice**, and the villain ranked #1 in that slice is not the corpus's top villain.
2. **`positionOf` named two seats the same thing** — `i === n-3 → HJ` was tested before
   `i === 2 → UTG`, so at five-handed the first voluntary actor was called the hijack. Pooled
   `HJ@5` 4.8% with `HJ@6` 12.2%.
3. **`isAllInBet` compared a cumulative raise-to against a remaining stack** → too many spots
   looked forced.
4. **`investedSoFar` double-counted the posted blind** for a blind who then raised. I first
   refuted this with a weaker test than the one that catches it; the agent was right.
5. **`bet_x_pot` was the hero's price, not the aggressor's bet** — algebraically identical to
   `price_pct`, so two columns held one fact and **the bet size was absent from the schema**.
6. **`facing` had no postflop raise vocabulary** — a bet into him and a raise of his own bet were
   the same string.
7. **`faced_agg_prev` counted the posted big blind as aggression.**
8. **`to_act_after` / `acted_before` were seat order, not action state.**
9. **`boardTexture.flushDraw` is `maxSuitFreq >= 3`** — three to a suit ON THE BOARD — so it read
   `no` on all 1,320 two-tone rows, where a hand actually holds a flush draw.
10. **The leaf dumps were unparseable** — `facing` contains spaces, so a whitespace split shifted
    every column and read `ACTION` as a constant. There is now a `.tsv` twin.

## Standing rules — these came from founder corrections

1. **Use the canonical measure.** `comboStrengthPercentile` (POKER_THEORY §15.1) is the strength
   axis: board-conditional, normalised, comparable across boards. I invented a parallel taxonomy
   instead and was corrected. `computeBoardPercentileTable` makes it affordable, verified to zero
   divergence.
2. **Made hand and draw are separate dimensions.** Bottom pair is a made hand and beats a naked
   draw; a hand can be both. A single ladder has to lie about one of them.
3. **Over-enumerate.** *"The agents should be able to clearly see the full picture for each
   position and spot, thrust upon them, overenumerated, back propagated, forced to be precisely
   labeled."* A rule can ignore a column; it can never recover one never emitted.
4. **Feed the strength buckets to the agents.** *"They will find it if it is included alongside
   the rest of the data."* Confirmed: the induction picked up `str_pct_top10`, `str_fd`,
   `str_nutdraw`, `str_hit_clean` without being told to.
5. **If you cannot explain something, dispatch an agent and force it to explain.** This is
   enforced — `buildDossier` REFUSES to build if an unresolved or too-thin rule has no dispatched
   explanation.
6. **The shape is a schema, not a habit.** `SECTIONS` + `DOSSIER_SHAPE_VERSION`. An undeclared
   section fails the build; a required section that declares itself empty fails too.
7. **A fold is evidence.** The terminal action says what he did NOT hold, on every hand rather
   than the 7–9% that reach a showdown.

## Settled findings

- **He bluffs.** Check-raise to 25bb with an underpair. Do not resurrect "never bluffs".
- **His ranges are not charts.** Ordering refuted on 5 of 15 charts (villain 1) and 11 of 18
  (villain 2).
- **Rule count is sample size, not complexity** — 7.4 vs 3.8 rules per 1,000 decisions.
- **Accuracy is degenerate** — lift over the majority class is 13.3pp vs 13.4pp for two very
  different players.
- **The two villains are one policy at two settings**, not two archetypes: a constant +0.44
  log-odds shift explains 15 matched spots (Q=15.15, df=14, p=0.37). Greenfield agent, and it
  overturned three things I had reported.
- **Villain 2 is nearly 2x more aggressive when a draw bricks than when it completes** — 31.0%
  vs 17.6%. No range model, no cards.
- **When villain 2 bets, 71% of shown hands are top pair or better and 10% is air** (n=156).

## Open questions

- **The `UTG@5` cell.** He opens 4.8% there against 12.5% from the same seat role at six-handed.
  Tests of BOTH the seat-label and the structural hypothesis fail (p=0.007, p=0.013) while the
  two six-handed cells are identical (p=0.93). His five-handed CO and BTN are normal. Nothing
  recorded explains it. **Likely a data-partition artifact — partition by date and table before
  quoting it.**
- **47% of enumerated behaviours are BLIND**, and **43 of those 60 die on one missing capability:
  `hand-outcome`.** Nothing records who won the pot. That is the single highest-value addition
  available and it is not a modelling problem, it is an extraction one.

## Do next, in order

1. **Re-run villain 1** on the current instrument; its numbers above are stale.
2. **Wire two sections into the dossier shape** and bump `DOSSIER_SHAPE_VERSION`:
   the **detectability census** (what the instrument could not have found) and the
   **terminal-action inference** (fold exclusions, showdown-anchored priors, the draw contrast).
3. **Rebuild and republish both dossiers** — pass the existing `url` so the links survive.
4. **Extract `hand-outcome`** from the corpus. It unblocks 43 behaviours; nothing else comes close.
5. **Join the EV axis to the percentile axis** (POKER_THEORY §15.2) for bluffcatch thresholds and
   thin value. The doc says the pieces exist and *"have simply never been joined"* — still true.
6. **Range capping and telegraphing** — derivable from his own action sequence.

## Committed — but read the commit titles carefully

All of it is committed. **The history is mislabelled and you should not be surprised by it:**

- `6ebc1f39` is titled **"WS-573: file the two backtest-integrity defects HomeBase declined"** and
  contains **30 files of villain-archetype work**. A concurrent session in this repo committed
  while this session had those files staged, and consumed the index. Content verified intact —
  schema v12, the `positionOf` ordering fix, `computeBoardPercentileTable`, `rangeInference`.
  Not rewritten: amending another session's commit is destructive and it may already be built on.
- `bef79a14` is the real tail — three stale known-answer expectations that named enum values the
  nut-end refactor deleted.

`git log --oneline --follow scripts/villainArchetype/` is the honest way to find this work.

**The lesson, since it will recur:** this repo runs concurrent sessions, and the git index is
shared state between them. Stage and commit in one motion, or commit from a worktree.
