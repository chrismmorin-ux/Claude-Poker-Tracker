# WS-442 — Domain merge of the three surviving orphan branches (round 3)

Session: ses-20260814-1721-cadf8459 · Sprint: SPR-182 · Date: 2026-08-14
Method: three parallel greenfield exploration agents (branches 1+2 vs HEAD; branch-3
salvage map; topology/docs/tests), per dispatch-dont-assert. Every verdict below carries
the checking agent's file:line evidence; none was asserted from session context.

Integration line: `ws-292-holding-knowledge` = `origin/main` = `881b960e` at session start.
Both WS-307 branches fork from merge-base `98033551`; branch 3 forks from `86c0e387`.

## The ticket's framing, corrected

1. **"Branch 2 is the more evolved WS-307 line" — FALSE.** WS-307 landed at HEAD via a
   third independent line (`f650531c` carried it co-resident; `bf1495ea` re-diagnosis)
   and then evolved through WS-303 → WS-276 → WS-292 → WS-334 → WS-378 → WS-402 → WS-403
   → WS-436, each step corpus-measured. HEAD is the surviving line.
2. **"WS-314/WS-315 still backlog with no reimplementation" (scope_update) — FALSE at
   authoring time.** HEAD `03f6c42a` (2026-08-05) reimplemented WS-314's core (per-size
   `crVillainResponse` pricing, strictly dominating the branch's constant re-basing);
   HEAD `62a6601f` (2026-08-05) reimplemented WS-315's score (excess-over-base-rate in
   `rangeSegmenter.computeBlockerScore`, better than the branch's raw share). The
   `recovered_work_note`s were written 2026-08-07, two days after those landed.
3. **"Re-express against HEAD holdingKnowledge API" — non-task.** Both salvage commits
   predate the branch's holdingKnowledge work; their diffs reference no holdingKnowledge
   symbol.
4. **"POKER_THEORY 7.4a missing" — partially stale.** Its core rule is at HEAD as §13.3.
   Genuinely missing were its two corollaries (hidden clamp, saturation) — now ported
   into §13.3. Its residual disclosure describes the pre-WS-276 omniscient-villain world
   and its headline example ("a range that cannot fold") is refuted by branch 2's own
   `0c25ec20`; neither was ported.

## Per-commit disposition

### Branch 1 — origin/claude/run-next-w3ojfs (5 commits)

| SHA | Content | Verdict |
|---|---|---|
| `8d3cb9fe` | `rangeConditionedFoldPct` + log-odds level/deviation + `FOLD_ESTIMATE_LOGISTIC` | **SUPERSEDED.** HEAD skips the population blend entirely when per-combo data exists (`foldEquityCalculator.js:640-657`); truncation replaced by pool-measured `CONTINUE_PROB_CEILING = 0.986` (`villainModelData.js`, four ask-sites); EV wiring at `gameTreeEvaluator.js:632-660` adds the WS-402 sizing-axis correction the branch lacks; branch's raise-only scoping (`RANGE_CONDITIONED_ACTIONS`) superseded in the opposite direction — HEAD conditions BOTH bet and raise because WS-276/WS-378 removed the omniscience input the branch cited as its reason to exclude `bet`. |
| `869347ed` | POKER_THEORY §7.4a + two corollaries | **PARTIAL — SALVAGED.** Core rule duplicated by HEAD §13.3. The two corollaries ported into §13.3 (this session). §7.4a's §7.4 context is the pre-WS-436 four-tier hierarchy (style tier included) — merging it would have resurrected a measured deletion (ΔLL −0.00076 n.s. over 10,147 paired decisions). NOT merged. |
| `162e4930`, `26155d8a`, `f9affe36` | CWOS bookkeeping | Dropped (session-local state, superseded by HEAD's event log). |

### Branch 2 — origin/claude/poker-multiway-flop-strategy-1514n2 (17 commits)

| SHA | Content | Verdict |
|---|---|---|
| `354ff0a0` | WS-307 fix (its own version) | **SUPERSEDED and inferior**: routes the fold estimate through `comboActionProbabilities`, whose villain-model blend HEAD later measured as INVERTED (WS-403 `shiftFoldMass` fix). |
| `0c25ec20` | "the fold model is clairvoyant" correction | **SUPERSEDED analytically** — HEAD internalised it with more measurement (§12, `villainDecisionEquity`, AT 0.000→0.393 / A9 1.000→0.583). Historical interest only. |
| `00e8bdec` | clairvoyance-leak scan | **SUPERSEDED** — HEAD fixed the exact list (`villainDecisionEquity` consumed at `gameTreeDepth2.js:1576,1686`, `foldEquityCalculator.js:585`; ground-truth census 6/6). |
| `3d660d67` | perceived hero range behind `engineFlags.js` (dark) | **SUPERSEDED** — HEAD ships the same idea un-flagged on the production path (`heroRangeBuilder.js`, `computeVillainEquityVsPerceived`). The dark-flag delivery is the exact "correct and unreachable" failure HEAD spent WS-378 recovering from. |
| `77cdae2b` | perf: `comboStrengthPercentile` sort | **N/A** — optimises a path that does not exist at HEAD (single caller, off the hot path). |
| `e1d1fc11` | per-action perceived ranges at depth-1 (≈3× foldBet/foldRaise separation) | **PARTIAL — FILED as WS-477.** HEAD deliberately builds ONE represented range at depth-1 (`gameTreeContext.js:288-300`); per-action separation exists only at river refinement (WS-378). Branch's measurement is a data point against HEAD's choice; code not mergeable (built on the discarded heroPerceivedRange architecture). |
| `0c0f4886` | bluff component via NUT-BLOCKING weighting | **PARTIAL — FILED as WS-478.** The only novel engine idea on either branch. HEAD tested generic polarisation and declined (`probeCeilingInteraction.mjs`: ±0.11, no consistent sign) but never tested the nut-blocking selection criterion specifically. |
| `ddee0ad4` | research doc | **CHERRY-PICKED** (4033f16a). |
| `2cb597bc` | field-size scaling lesson + `benchmark` section kind | **CHERRY-PICKED** (931bc255). |
| `ee4cec33` | Study Home v1 | **CHERRY-PICKED** (cdc47580); WS-440 dirty-tree overlap on `CollapsibleSidebar.jsx` resolved — the pick's scroll fix subsumes WS-440's hunk on the same container; WS-440's `UIContext` export re-applied uncommitted. |
| `63fbb34d` | drill tab-label fix | **CHERRY-PICKED** (7defa008). |
| remaining | CWOS bookkeeping / session state | Dropped. |
| NOT landed | `heroPerceivedRange.js`+test (competes with HEAD's `perceivedHeroRange`), `rangeConditionedFoldEquity.test.js`, `heroRangeConfig.js`, `engineFlags.js`, `pokerCore/rangeSampling.js` | Superseded architecture; name-collision hazards recorded by the topology agent. |

### Branch 3 — origin/claude/run-next-t4w44x (10 commits)

| SHA | Content | Verdict |
|---|---|---|
| `12d6f4ec`, `c87ae3ee`, `b5f8c0c1`, `f7d617b8` | competing WS-292 holdingKnowledge (`pokerCore/holdingKnowledge.js`, `holdingKnowledgeAt`) | **SUPERSEDED** — HEAD's `src/utils/holdingKnowledge/` (openHolding/narrowHolding/holdingBelief/holdingTruth + BASIS provenance) is live at 8 consuming modules; WS-292 is `done`. |
| `63036b62` | WS-314 check-raise fix | **PARTIAL — hunks B+C SALVAGED this session** (fold-equity guard: `crReliesOnFoldEquity = bestCRCallEV < 0` ⇒ requires a reliable read, mirroring `bestResponseToAggression`'s DEC-022 guard at `gameTreeEquity.js:1087`; plus the never-filter-to-empty results filter). Hunk A (constant re-basing) superseded by HEAD `03f6c42a`'s per-size pricing; only its constant-alignment survived (CR fallback now bound to `MODEL_CONFIDENCE_THRESHOLD` + `POPULATION_PRIORS.raise.fold`). |
| `b8797690` | WS-315 blocker ranking + WS-318 rule (c) | **PARTIAL.** Tie-break sort SALVAGED this session (`makeEvBlockerComparator`: EV decides outside 1%-of-pot epsilon, `blockerScore` (HEAD's `excess` semantics) breaks ties within — the missing consumer for the score HEAD computes and never read). `computeBlockerScore`/gate hunks superseded by `62a6601f` (better signature and excess-over-base-rate semantics). WS-318 rule-(c) code NOT landed — founder decision 2026-08-14: evidence-only into WS-318.yaml; code lands when WS-362 revives the dead weakness-match path. |
| remaining | CWOS bookkeeping | Dropped. |

## What landed at HEAD this session

- 4 cherry-picks: `4033f16a`, `931bc255`, `cdc47580`, `7defa008` (visual pass verified:
  Study Home renders per spec at 1600×720, grouped nav reachable, tab labels distinct).
- Engine salvage (ENGINE_VERSION v124→v125): WS-314 guard + WS-315 tie-break, with
  behavioural tests (`checkRaiseFoldEquityGuard.test.js` — bug-direction test verified to
  FAIL on the pre-fix engine; `blockerTieBreak.test.js` — comparator mechanism + the
  never-re-prices invariant).
- POKER_THEORY §13.3 gains the two §7.4a corollaries.

## Follow-ups filed

- **WS-477** — per-action fold conditioning at depth-1 (branch-2 e1d1fc11 evidence).
- **WS-478** — nut-blocking bluff component for the represented range (branch-2 0c0f4886
  evidence + HEAD's probeCeilingInteraction counter-evidence; adoption must clear the
  ground-truth bar).
- **WS-479** — disposition of `integrate/orphans-20260807` (100% of the deploy-freshness
  RED: all 78 stranded commits belong to it; reachable from nothing; the 2026-08-07
  landing sequence "merge integrate/orphans → WS-442 → land main" stalled before its
  second step). Founder decision 2026-08-14: file, not fold into SPR-182.

## Branch deletion

`origin/claude/run-next-w3ojfs`, `origin/claude/poker-multiway-flop-strategy-1514n2`,
`origin/claude/run-next-t4w44x` deleted after: all cherry-picks landed, salvage landed,
this report committed, WS-318.yaml carries the branch-only founder rule-(c) record with
its measured impact. Every accept criterion maps to a row above.
