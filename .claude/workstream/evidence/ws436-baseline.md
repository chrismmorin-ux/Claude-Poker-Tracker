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

## 5. Deferred from Stage 0 (land with B-instrument, where their prerequisites exist)

- Villain-prediction baseline (`priors:style-labels` vs `priors:population`): requires
  the prior-source arm in dump-records — does not exist yet; building it is B-instrument
  scope.
- Determinism gate (run-hero-ev twice + `diffHeroEvRuns` exit 0): gates the B-instrument
  byte-identical check; run there where it protects the arm-axis change directly.
