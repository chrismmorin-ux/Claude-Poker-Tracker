# Villain conduct cards — continuation prompt

Copy everything below the line into a new session.

---

We are building a **purely descriptive model of individual poker villains** — what rules are in
their head — from the HandHQ corpus. No exploits yet.

## Read this before trusting anything below

**The working tree is the truth; this document is a pointer.** Two successive versions of this
prompt have now sent a session acting on stale or wrong facts. Run the procedure and read what it
prints before believing any number here.

**The corpus is online 2009 and the founder's game is live 9-handed 1/2–1/3.** Every rate is
*transferred, not measured*. Say so when reporting one. Both villains profiled so far are
**six-max or shorter**, so the gap is a format gap as well as a population gap. (The corpus does
contain nine-handed tables — `seat_count = 9` records exist. Neither profiled villain sat at one.)

## What the last session refuted — do not reintroduce these

Each was stated as settled in the previous version of this document, and each is false:

1. **"Nothing records who won the pot. That is the single highest-value addition available and it
   is not a modelling problem, it is an extraction one."** FALSE, twice over.
   `scripts/backtest/handOutcome.mjs` (WS-287) had already shipped and derives the award — 2,703
   of villain 1's 2,704 hands, zero-sum residual 0.0000bb. Separately, the raw PHH records carry a
   `winnings = [...]` line that nothing had ever read. The claim was true of the raw file's *hole
   cards* and false of the pipeline's *outcome*, and nothing forced the two statements to meet.
   Wiring it moved the detectability census from **60 blind to 25**.

2. **"Villain 2 is nearly 2x more aggressive when a draw bricks than when it completes — 31.0% vs
   17.6%."** NOT SEPARATED. With intervals attached: 17.6% [13.3–22.9] against 31.0% [19.1–46.0].
   They overlap. It is a direction to test, not a measured difference, and the dossier now says so
   in those words. Villain 1 points the same way (33.3% [14–61] vs 20.0% [12–31]) and also does not
   separate.

3. **"Villain 1 is stale — re-run it before comparing anything."** Its headline numbers were
   current: the re-run reproduced 25 rules · 100% coverage · 83.5% accuracy exactly.

## Where things stand, measured

| | villain 1 | villain 2 |
|---|---|---|
| id | `SO0Om/HLLvkJps9pZmbgqQ` | `jSCaL6Fm4lAiTDVH2dFATQ` |
| hands / decisions | 2,704 / 3,386 | 7,403 / 9,442 |
| rules · coverage · accuracy | 25 · 100% · 83.5% | 45 · 100% · 78.8% |
| unresolved rules | 1 (hidden-cond) | 2 (1 hidden-cond, 1 needs-cards) |
| detectability | 66 detectable · 37 partial · 25 blind | same (it is a property of the instrument) |

Both dossiers are current at **dossier shape v4** and published (same URL redeploys):
- villain 1 — https://claude.ai/code/artifact/415ae668-1e45-4ddb-b315-84c816cac4b4
- villain 2 — https://claude.ai/code/artifact/255303c4-cb0b-486b-8057-32ee19cf3bc8

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
node scripts/villainArchetype/__checks__/handOutcome.check.mjs
```

`MAX_FILES` exists to make a run **quick, never to make it possible** — the loader streams in two
passes and holds only one villain's hands, and skips pass 1 entirely when the villain is named.
The full local corpus is 1,756 files.

## The instrument

- `loadVillain.mjs` — the ONE corpus loader. Also attaches the realized hand outcome.
- `enrichDecisions.mjs` — the ONE enrichment: assumed strength arm, back-propagated street deltas,
  terminal-action inference. Shared by `profileVillain` and `dumpLeaf` so the leaves a reader is
  handed are the leaves the dossier induced.
- `decisionLabeler.mjs` — one labelled row per decision. **Schema v13, 94 columns.**
- `handStrength.mjs` — what his range can MAKE and DRAW to, per decision.
- `rangeInference.mjs` — what his ACTION proves. Fold exclusions, showdown-anchored priors, the
  draw contrast.
- `induceCore.mjs` — the single induction. Bonferroni-corrected G-test on every split.
- `mixTest.mjs` — mix / hidden-cond / needs-cards verdicts, now in ONE correction family.
- `profileVillain.mjs` — **THE PROCEDURE**: LOAD → ENRICH → GATE → ENUMERATE → INDUCE → EMIT.
- `buildDossier.mjs` + `templates/dossier.html` — the canonical artifact, shape-validated at v4.
- `detectability.mjs` + `behaviourRegistry.json` — 128 behaviours, and whether we could find them.
- `__checks__/` — corpus-free known-answer tests. Run them; they have caught real bugs.

**Gates fail the run.** Every one corresponds to a bug that actually shipped.

## Bugs fixed last session — do not reintroduce

1. **`hand-outcome` was declared absent in prose and never tested.** See above.
2. **`profileVillain` ran its own copy of `loadVillain`** — the module written *because* that copy
   carried a 4GB OOM into a second script. The procedure was the one caller it did not govern, so
   the outcome attachment landed in a function it never called, and every named run scanned the
   corpus twice to rank players it then discarded.
3. **`rangeInference.annotate()` was computed on every run and discarded** — bound to a local
   nothing read. A full pass paid for, nothing rendered.
4. **`dumpLeaf` never enriched, so it induced a DIFFERENT ruleset from the profile.** Four of
   villain 2's nine explanation-needing rules had no leaf with the same population, and two pairs
   of distinct rules collided onto one file. The "nothing unexplained may ship" gate could
   therefore be satisfied by an explanation of a different spot.
5. **`mixTest` corrected one side of a comparison and not the other.** Observable features were
   Bonferroni-corrected over ~84 tests; the card test was uncorrected; the two were then compared
   to pick one verdict. A leaf where `suit_max` separated at raw p=0.012 was labelled "only his
   cards resolve it" on a card test at p=0.032 — the *stronger* evidence lost. That biased the
   instrument toward the one verdict that says more corpus cannot help.
6. **Four new gates passed on ZERO rows** while the thing they check had never run. A gate that
   clears an empty set is not a gate.
7. **Three hardcoded numbers on the page had drifted from the record** — "eighteen statements"
   beside a page reporting 25 rules, "schema v9" beside runs on v12, "Two rules are unresolved"
   beside one. All now read from the profile.
8. `mixTest.mjs` used a NUL as a Map key separator, so **git treated it as binary** and would not
   diff the file that decides every verdict.

## Standing rules — these came from founder corrections

1. **Use the canonical measure.** `comboStrengthPercentile` (POKER_THEORY §15.1) is the strength
   axis: board-conditional, normalised, comparable across boards.
2. **Made hand and draw are separate dimensions.** A single ladder has to lie about one of them.
3. **Over-enumerate.** A rule can ignore a column; it can never recover one never emitted.
4. **Feed the strength buckets to the agents.** Confirmed: the induction picked up `str_pct_top10`,
   `str_fd`, `str_nutdraw`, `str_hit_clean` without being told to.
5. **If you cannot explain something, dispatch an agent and force it to explain.** Enforced —
   `buildDossier` REFUSES to build if an unresolved or too-thin rule has no dispatched explanation.
   This paid off directly last session: analysts given one leaf each and nothing else **falsified
   two "needs-cards" verdicts**, naming observable separators the induction had rejected. One of
   them survived a permutation test over all 844 candidate splits.
6. **The shape is a schema, not a habit.** `SECTIONS` + `DOSSIER_SHAPE_VERSION`.
7. **A fold is evidence.** The terminal action says what he did NOT hold, on every hand rather than
   the 7–9% that reach a showdown.
8. **Every figure on the page is READ from the record, never typed.** Three violations of this
   shipped and all three had drifted. If you find yourself typing a number into the template, that
   is the bug.

## Settled findings

- **He bluffs.** Check-raise to 25bb with an underpair. Do not resurrect "never bluffs".
- **His ranges are not charts.** Ordering refuted on 5 of 15 charts (villain 1) and 11 of 18
  (villain 2).
- **Rule count is sample size, not complexity** — 7.4 vs 3.8 rules per 1,000 decisions.
- **Accuracy is degenerate** — lift over the majority class is 13.3pp vs 13.4pp for two very
  different players.
- **The two villains are one policy at two settings**, not two archetypes: a constant +0.44
  log-odds shift explains 15 matched spots (Q=15.15, df=14, p=0.37).
- **When villain 2 bets, 71% of shown hands are top pair or better and 10% is air** (n=156).
- **A fold facing a bet excludes a measurable slice of his range, and it compounds down the
  streets** — villain 1: flop 10.6%, turn 29.6%, river 44.7%. Villain 2: 10.1% / 24.6% / 41.6%.
  Card-free and assumption-free.

## Open questions

- **The `UTG@5` cell.** He opens 4.8% there against 12.5% from the same seat role at six-handed.
  **Likely a data-partition artifact — partition by date and table before quoting it.**
- **The recorded `winnings` field, reconciled but not closed.** It is the pot won net of the
  returned uncalled bet. Against the derived award it agrees exactly on 410 hands and differs by a
  4–5% capped amount on 566 — and the split is clean: 409 of the 410 agreeing hands never saw a
  flop, and all 566 differing hands did. That is no-flop-no-drop, so **the residual is rake, and
  rake is therefore RECOVERABLE from the corpus rather than modelled** (`handOutcome` currently
  requires it be passed in and reported as modelled, POKER_THEORY §11.3).
  **The pre-registered falsifier fired**: 12 of 988 hands show a small NEGATIVE residual, which
  rake cannot produce. All 12 are uncontested preflop pots with a single derived winner matching
  the recorded one. Unexplained. Settle that before using recovered rake for anything.
- **The residual `everything else` leaf is heterogeneous.** On villain 2 it pools 17 heads-up
  4-bet decisions, 5 multiway rows and 3 postflop rows — prices of 16–46% and SPRs of 0.4–2.5 in
  one bucket. Any rate quoted for it is a mixture.

## Do next, in order

1. **Extract the recovered rake** and settle the 12 negative-residual hands. Two things fall out:
   a real rake series instead of a modelled one, and an independent check on every derived award.
2. **Score behaviours against the outcome now that it exists.** 35 behaviours moved out of `blind`
   solely because of it; nothing yet consumes `won` / `net_bb`. "Does he fold too much on the turn"
   is a frequency question until it meets what folding earned him, and then it is a leak.
3. **Re-dispatch explainers for the leaves whose verdicts changed** and for villain 1's five, whose
   explanations predate the correction.
4. **Join the EV axis to the percentile axis** (POKER_THEORY §15.2) for bluffcatch thresholds and
   thin value. The doc says the pieces exist and *"have simply never been joined"* — still true.
5. **Range capping and telegraphing** — derivable from his own action sequence.
6. **Split the residual leaf** before quoting any rate from it.

## Committing

This repo runs concurrent sessions and the git index is shared state. **Stage and commit in one
motion, or commit from a worktree.** An earlier session lost 30 files of this work into a commit
titled `WS-573: file the two backtest-integrity defects HomeBase declined` because a concurrent
session consumed the index while these files were staged.

`git log --oneline --follow scripts/villainArchetype/` is the honest way to find this work.
