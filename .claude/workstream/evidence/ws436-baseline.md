# WS-436 Stage-0 baseline evidence

Recorded 2026-08-08 (session ses-20260808-0250-3e298c5d), before any engine behavior change
beyond the documented Stage-A0 plumbing. Baseline code state: HEAD `02bcb309` + commit
`d3cf5993` (Stage A0 — additive shrunk emission, modelAudit parity, multiway gate fix).

## 1. modelAudit / production parity fix — VERIFIED

- Defect: both audit model constructions (`modelAudit.js` rolling checkpoint + profile
  builder) built the villain model WITHOUT `style`, while production
  (`analysisPipeline.js:116`) builds WITH it. The audit was scoring a configuration
  production never runs and was structurally blind to any change in the style-conditioned
  Dirichlet priors — a prerequisite fix for measuring WS-436's villain-model half.
- Fix verified per WS-309 discipline: parity test **fails against the pre-fix code**
  (reverted in place → 1 failed), passes post-fix (7/7). Test:
  `modelAudit.test.js` — "audit/production model-construction parity (WS-436 baseline)".

## 2. facingAggressionFrequency fixture — GREEN at baseline

`npx vitest run src/utils/exploitEngine/__tests__/facingAggressionFrequency.test.js`
→ 11/11 passed (4.55 s), at Stage-A0 state. This fixture (48 decisions × 4 prices,
monotone raise share in price) is the standing WS-283/WS-402 regression guard; Stage A2+
must keep it green under BOTH `villainParamSource` configurations and report the shape.

## 3. probeFrequency baseline — the pre-change action mix

Command: `node scripts/backtest/probeFrequency.mjs --label ws436-baseline
--out out/ws436-freq-baseline.json --max-files 300 --max-players 300 --max-decisions 130`
(paired-by-seed protocol; artifact: `out/ws436-freq-baseline.json`).

```
FACING AGGRESSION (bet|raise), n=47 of 130 scored [ws436-baseline]
  ws436-baseline : fold 10.2%  call  6.6%  raise 83.2%
  pool           : fold 48.7%  call 36.2%  raise 15.2%
  observed       : fold 44.7%  call 46.8%  raise  8.5%

ESS (self-normalised IPS, weight cap 20)
  ALL 130 → 40.4 (31.1%) · flop 63 → 35.0% · turn 50 → 35.8% · river 17 → 32.8%
```

Corroboration: matches the WS-403 published post-fix table (fold 10.9 / call 6.8 /
raise 82.3, ESS 29.9%) within slice noise — the instrument is reading the same engine.

Contamination check (probe launched while Stage-A0 edits were in the working tree):
the probe path (`heroPolicy.mjs`) uses `buildPlayerStats` with a null-stats villain and
`opponentModels: []`; the Stage-A0 edits on that path add only an unread `shrunk: null`
field, and `buildOpponentModels` (the gate fix) is not on the path. The measured
quantities are pre-change semantics. NOTE for the paired run: this baseline, like the
whole harness today, feeds `style: null` villains — the styled-villain feed
(B-instrument) is what makes the label channel measurable at all.

## 4. Corpus caveat (standing)

HandHQ online 2009, 50NLH. The founder's game is live 1/2–1/3 — any live reading of
these numbers is transferred, not measured.

## 4a. B1 — the style-label Dirichlet channel, measured (2026-08-12, session ses-20260812-1343-dabcbfdf)

Instrument: `dump-records.mjs --arms priors` (new `priorSource` model-build axis in
`runner.mjs`; arms share profile + summary + decisions, differ only in what seeds
`buildActionPriors`). Run at pre-A4 HEAD (`0457b9a3` + B1 harness edits, engine src
untouched), 300 players / 300 hands cap, `out/pool-reference.json` regenerated with the
WS-373 weighting stamp. Artifact: `out/ws436-priors-records.json` (3 arms x 10,147
decisions — the same decision count as every WS-285-era run on this configuration).

**Pre-registered tripwire HELD**: `priors:style-labels` is record-identical to `shipped`
(paired Δ exactly 0.00000) — both build with the label at this HEAD, so the pairing
instrument verifies itself.

**The channel's measured value — indistinguishable from zero, sign toward removal**:

| paired vs shipped | logLoss | acc | paired ΔLL | t | 95% CI |
|---|---|---|---|---|---|
| priors:population | 0.75743 | 58.4% | −0.00076 | −0.95 | [−0.00232, +0.00081] |

Divergent-only (the label seed changes the prediction on 7,269 of 10,147 = 71.6%):
ΔLL −0.00106 ± 0.00218, t = −0.95. By prediction source, the largest effects are at
`shrinkage-L5` (−0.00907) and the pure-`prior` exit (−0.00813, n=155) — both NEGATIVE,
i.e. population better exactly where the style prior has the most influence. No source
shows a label benefit.

Scale anchor: the smallest effect this instrument has been acted on is the WS-285 ladder
reorder at 0.0149 — ~20x the top of this CI. Conclusion: the six-label Dirichlet seed
carries no measurable villain-action information on this corpus; its removal (A4) is
measured-safe for the villain-model half. Standing caveat §4 applies: online 2009 corpus,
transferred not measured for the live game.

## 4b. A4's first design REFUTED by the instrument, and the correction (2026-08-12)

The A4 stage as planned seeded the model's Dirichlet priors from the villain's own shrunk
posteriors (`villainPriorDistributions`: foldToCbet → bet.fold, cbet → none.bet, aggFreq →
raise mass, exact n=0 population identities). Built, tested green (2,976 tests), then run
on the SAME instrument and decisions as §4a:

| post-A4 paired vs shipped(=continuous) | logLoss | paired ΔLL | t | verdict |
|---|---|---|---|---|
| priors:population | 0.75743 | **−0.00691** | **−5.64** | population BETTER |
| priors:style-labels | 0.76434 | +0.00000 | — | tripwire holds (labels ignored) |

The continuous seed is significantly WORSE than population — where the style seed was
merely uninformative (§4a). Mechanism, confirmed by the direction and magnitude: the
shrinkage ladder's broadest level already contains the villain's pooled decisions, and
`shrunk.foldToCbet`/`cbet`/`aggFreq` are computed from the SAME hands — the seed injects
evidence the buckets then re-apply. The label seed was a lossy 6-way quantisation of the
same channel (bounded double-count ⇒ neutral); full-resolution injection made the defect
measurable. The explorer's pre-registered caveat ("seeding the ladder with a posterior
derived from an overlapping observation set double-counts the same hands") was correct.

**Correction shipped**: `buildActionPriors(boardTexture)` is population-seeded, period —
the measured-best configuration (0.75743). `villainPriorDistributions` deleted with a
tombstone note requiring any future villain-conditioned seed to beat the population arm
on this instrument first. `foldEstimates` = population prior + bucket counts (single
pipeline). Depth-2's model blend gained an evidence gate (confidence > 0) plus a
mutually-exclusive tier-2 fallback through `villainFoldLevel` for bucket-less villains —
the stats pipeline and bucket pipeline never both fire, so the same hands are never
counted twice. Verification: third paired run at corrected HEAD must show all three arms
record-identical (artifact `out/ws436-priors-records-corrected.json`).

Per-villain personalisation is therefore carried ENTIRELY by: (1) bucket evidence through
the ladder (villain-prediction path), and (2) `villainFoldLevel` + the A3 aggFreq/cbet
transfers at game-tree leaf sites (advice path) — one pipeline per path, never both.

## 4c. B4 — the paired before/after advice measurement (2026-08-12)

Protocol: worktree at `d3cf5993` (A0; engine src sha256 `8c0913bb9507bb37`) with the
B-instrument scripts overlaid vs final HEAD; six + four paired `probeFrequency` runs
(depth-1, 300 files / 300 players / 130 decisions, seeded per decision), shared
villain feeds (v1: 2,500 POOL villains @100-hand prefix, 20.0% decision coverage;
v2: 6,000 @60, 35.4% coverage — the coverage counter is printed per run, which is
what caught v1's thinness). Compared with `diffProbeRuns.mjs`, paired-on-divergent.

| contrast (paired n=130) | divergent | meanTV(div) |
|---|---|---|
| FALSIFIER #1: after styled vs stats (v2 feed) | **0** | — |
| label channel, old engine: before styled vs stats (v2) | 9 (≈1 in 5 fed) | 0.100 |
| engine change at population: before vs after, null | **0** | — |
| engine change under feed: before vs after, stats (v2) | **0** | — |

Continuity: before-null and after-null both reproduce the recorded §3 baseline
facing-aggression mix EXACTLY (fold 10.2 / call 6.6 / raise 83.2, same 47-decision
slice). Determinism: `verify-ws433-determinism.mjs` ALL GATES PASS at corrected HEAD;
cross-process run-hero-ev pair under the stats feed — first attempt REFUSED by
`diffHeroEvRuns` because a docs commit landed between the two runs (engineCommit
mismatch; the tool was right, the protocol error was mine; the run/measurement
sections were byte-identical), re-paired at one commit: IDENTICAL, sha256 a7ec0682151cdc0a…, and the second run reproduced the first B run byte-for-byte — determinism held across four executions.

Reading: the label channel WAS live on the old advice path (a fifth of fed decisions
moved, one combo's argmax each) and carried no measurable prediction information
(§4a); the removal is ADVICE-PARITY — the n=0 population identities designed into
every replacement hold end-to-end (0 of 130 decisions changed), and no fed decision's
argmax moved either. Absolute-EV delta on the measured set: exactly 0 (no advice
changed ⇒ no EV changed). Result Card: RC-STYLE-COLLAPSE-2026-08-12
(docs/research/ws436-style-collapse-2026-08-12.result-card.json), the WS-445 ledger's
first measured row. Argmax-instrument caveat: EV shifts that flip no combo's best
action are invisible here; the EV channel is pinned live by villainFeed.test.js.
Corpus caveat §4 stands: online 2009, transferred not measured for live.

## 4d. PRE-REGISTRATION — the three untried channels (2026-08-12, written BEFORE the runs)

Founder direction: "lets run them." Falsifiers stated before any result exists.

**(1) Pole-prior rung** (`priors:pole-soft`, `priors:pole-hard` arms). Hypothesis under
test AS THE CORRECTION: a k=2 group-level prior mined from OTHER POOL players' decisions
beats the population seed for thin-history villains — partial pooling toward the pole,
which the refuted own-stats seed was not (different data source; the only own-hands
contribution is the ASSIGNMENT, bounded). Decision rule, pre-registered: the arm must
beat `shipped` (population seed) with paired ΔLL CI excluding 0 on the ~10,147-decision
instrument. CI including 0 ⇒ the ladder already carries everything the pole knows and
the model-side rung is CLOSED by measurement. A significantly NEGATIVE result ⇒ recorded
unhedged as a second same-family refutation. Expected failure mode to watch: the
assignment (from own shrunk stats) re-imports a bounded double-count — if pole-hard
underperforms pole-soft materially, that is the threshold cliff, not the pole idea.

**(2) Quantization cost** (`stats-bin3` / `stats-bin5` probe arms). Question: how much of
the continuous advice channel survives a head-sized readout? Instrument: paired advice
probe at HEAD, binned shrunk stats vs continuous, TV on the advised distribution over the
same 130 seeded decisions (fed subset ~46). Pre-registered reading: bin3 divergence ≈ 0
⇒ a 3-level readout is near-lossless (good news for the table channel / WS-447); large
divergence concentrated at bin boundaries ⇒ quantization is costly and the readout needs
more resolution exactly where the report says. No pass/fail — this run MEASURES a cost,
it does not gate a ship.

**(3) Within-player drift.** Founder lifecycle hypothesis, longitudinal form: does a
player move along the dial across their own history? Test: paired first-half vs
second-half (vpip, foldToCbet) per POOL player, overdispersion of the paired deltas
against binomial expectation, magnitude compared to the between-player SDs (14.5pp /
12.6pp scale anchors). Pre-registered honesty clause: if the adapter carries no usable
temporal field, the split is within-HISTORY not within-SESSION, and the result will be
labeled as answering that weaker question.

## 4e. RESULTS of the three §4d channels (2026-08-12, same session)

**(1) Pole prior — WON, per the pre-registered rule.** `mine-pole-priors.mjs` on 300
POOL players (deterministic 2-means on shrunk (vpip, foldToCbet)): pole A "loose"
90 players (vpip 0.433), pole B "tight" 210 (vpip 0.216) — the split is carried
almost entirely by LOOSENESS (ftc 0.482 vs 0.472), consistent with the one-axis
finding. Scored via the `actionPriorsSeed` measurement seam on the paired instrument
(4 arms × 10,147 decisions, `out/ws436-pole-records.json`):

| paired vs shipped(=population) | logLoss | acc | ΔLL | t | 95% CI | verdict |
|---|---|---|---|---|---|---|
| priors:pole-hard | 0.75411 | 59.8% | −0.00332 | −2.80 | [−0.0056, −0.0010] | **BETTER** |
| priors:pole-soft | 0.75421 | 59.8% | −0.00323 | −2.75 | [−0.0055, −0.0009] | **BETTER** |

CI excludes 0 ⇒ the rung EARNS a production path (the §4b tombstone bar is met: this
is the first villain-conditioned seed to beat the population arm, and it did it with
OTHER players' data — group-mean partial pooling, no same-source double-count; the
assignment is walk-forward clean, train-prefix stats only). Hard ≈ soft ⇒ no cliff
penalty at this pole separation. Scale: ~4× the style-label CI top, ~22% of the
ladder-reorder effect. Shipping it is a separate decision (artifact loading in
production, assignment at analysisPipeline, live re-fit trigger) — not done here.

**(2) Quantization — a 3-bin readout is NEAR-LOSSLESS at the advice level.** bin3
diverged from continuous on 1 of 130 paired decisions (one river, one combo's argmax);
bin5 on 5 of 130 — both ≤4%, within noise of each other. Pre-registered reading
applies: a head-sized 3-level read per stat preserves the advice channel on this
instrument (argmax caveat stands: sub-flip EV shifts invisible). Direct input to
WS-447's display design.

**(3) Drift — the looseness dial MOVES SLOWLY; the stickiness dial does not.**
160 POOL players, halves paired by (day, arrival) (`out/player-drift.json`):
vpip meanZ² = 1.37 (real drift), driftSd ≈ 5.0pp ≈ 43% of the between-player SD
(11.4pp), direction-neutral; foldVsBet meanZ² = 0.98 (NO drift beyond noise, n=78);
day-level vpip χ²/df = 0.97 (no session-scale swings at ≥15 hands/day resolution —
short tilt bursts below that bin size would be invisible). Practical: looseness reads
age on a weeks timescale (recency-weighting has measurable value); stickiness reads
effectively do not age. `phhAdapter` now carries `_backtest.day` (the foldCurve miner
had been re-parsing files to get it).

Standing caveat §4 applies to all three: online 2009, transferred not measured for live.

## 5. Deferred from Stage 0 (land with B-instrument, where their prerequisites exist)

- Villain-prediction baseline (`priors:style-labels` vs `priors:population`): requires
  the prior-source arm in dump-records — does not exist yet; building it is B-instrument
  scope.
- Determinism gate (run-hero-ev twice + `diffHeroEvRuns` exit 0): gates the B-instrument
  byte-identical check; run there where it protects the arm-axis change directly.
