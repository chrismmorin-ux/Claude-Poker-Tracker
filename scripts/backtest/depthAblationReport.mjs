/**
 * depthAblationReport.mjs — what does the depth-2/3 refinement subsystem change? (WS-334 AC5)
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *  THIS IS NOT A KEEP/DELETE VERDICT ON DEPTH-2. THE DELETE OPTION IS OFF THE TABLE.
 *  Founder ruling, WS-334 decision_flags, 2026-08-03. A null result here is a statement
 *  about the INSTRUMENT, not about depth-2 — the engine is not in a verified state, and a
 *  "no difference" measured on an unverified substrate is a fact about the substrate.
 *  Wherever this module could be read as a verdict it says so instead.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * WHAT WAS MISSING AND WHY IT MATTERED. WS-334's AC5 asked for the accuracy delta between
 * depth-1-only and depth-2-enabled advice, measured through the calibration harness "rather
 * than argued". It was measured ad hoc instead, with `dumpGameTreeEV`: per-action EV
 * percentage changes on eight hand-picked scenarios (call +26.7%, raise +18.0%,
 * check -11.7%, 1 of 8 top-action flips). Those are the engine's own EV numbers moving,
 * expressed as percentages of themselves. They are not on any scale another result can be
 * compared to, and they carry no manifest, so nobody can re-derive them. That is exactly the
 * `Incomparable numbers` failure ADR-009 exists to close.
 *
 * WHICH HARNESS THIS IS, precisely — because "the WS-273 harness" names two things.
 *
 *   - WS-273 as shipped (`run.mjs` -> `runner.mjs`) scores VILLAIN ACTION PREDICTION:
 *     log-loss and calibration of pi(villain action | state). Depth-2/3 does not touch that
 *     quantity AT ALL. It refines HERO's EV over hero's options; the villain model it
 *     consumes is identical either way. Run against that harness, a depth ablation is
 *     guaranteed to return exactly zero, for a reason that has nothing to do with depth-2.
 *     A metric that cannot fail is not evidence (`FAULT-degenerate-signal`).
 *   - WS-287 extended that harness with a HERO-EV arm (`run-hero-ev.mjs` ->
 *     `heroEvRunner.mjs`), reusing its corpus reader, partition, leakage guard and
 *     walk-forward checkpointing — "reuses the villain-side harness rather than standing up
 *     a second pipeline". That arm scores the RECOMMENDATION against realized chips, and it
 *     is the only instrument in the repo that can see a depth-2 change at all.
 *
 * So this runs through the hero-EV arm. Every figure below comes out of `estimateEdge`, the
 * same estimator the headline, the baselines, the control and PBR already go through. ADR-009
 * forbids a second comparison path and this is not one: the ablation enters as one more
 * `piOurs` remap, exactly as PBR does.
 *
 * THE CONTRAST IS PAIRED, AND THAT IS THE WHOLE DESIGN. Both arms are evaluated at the SAME
 * decision, in the same pass, against the same realized outcome and the same propensity
 * denominator. The population term cancels identically:
 *
 *     edge(depth2) - edge(depth1) = (V_2 - V_pool) - (V_1 - V_pool) = V_2 - V_1
 *
 * so the delta is free of the between-player variance that dominates either level on its own
 * — the term `heroEvReport.MIN_CLUSTERS_FOR_CI` exists because it moved the edge across runs
 * at fixed n. The delta is therefore the figure this instrument resolves BEST, and the two
 * absolute edges are the figures it resolves worst.
 *
 * TWO FAMILIES OF NUMBER, AND THEY ANSWER DIFFERENT QUESTIONS.
 *
 *   1. ADVICE DIVERGENCE — how often, and how far, refinement moved the recommendation.
 *      Outcome-free. It needs no corpus outcomes, no propensities, and no confidence
 *      interval, so it is well determined at a sample size where the EV delta is not. If
 *      this is zero the EV delta MUST be zero and says nothing.
 *   2. THE EV DELTA — whether the movement was toward money, in bb on the hero-EV scale.
 *      This is the one that needs players, and the one to distrust first.
 *
 * Reporting only (2) would let "the advice never changed" and "the advice changed and it did
 * not help" print the same number, which are opposite findings.
 */

import {
  estimateEdge, weightFor, wisValue, clusterBootstrapCI,
  TREATMENT, DEFAULT_BOOTSTRAP_SEED, DEFAULT_WEIGHT_CAP,
  DEFAULT_BOOTSTRAP_RESAMPLES, DEFAULT_BOOTSTRAP_ALPHA, Z_DETECT, Z80_POWER,
} from './ipsEstimator.mjs';
import { MIN_CLUSTERS_FOR_CI } from './heroEvReport.mjs';
import {
  buildChangeLedger, netPublishProblems, renderChangeLedgerLines, changeLedgerMetricsFields,
  CELL_MIN_DISCORDANT,
} from './changeLedger.mjs';
import { buildResultCard, resultCardProblems } from '../../src/utils/standardOfRecord/resultCard.js';
import { buildReplicationManifest } from '../../src/utils/standardOfRecord/manifest.js';

export const DEPTH_ABLATION_SCHEMA_VERSION = 1;

/**
 * The estimand. Two instruments only corroborate each other if they name the same quantity,
 * and `resultCardProblems` refuses a card that cannot state one.
 */
export const DEPTH_ABLATION_ESTIMAND =
  'Paired within-decision difference in expected hand value for hero (bb, attributed at the '
  + 'decision level) between two configurations of the SAME surface: depth-1-only advice '
  + '(refinementBudgetMs=0, the configuration that shipped in production for the life of the '
  + 'project) and depth-2/3-enabled advice. NOT a per-decision increment, NOT a winrate, and '
  + 'NOT a keep/delete verdict on the depth-2 subsystem.';

/**
 * How to read the number, appended to the hero-EV treatment rather than replacing it.
 *
 * The added clause is the one a reader most needs: the contrast is WITHIN a decision, so the
 * between-player variance that dominates either absolute edge is differenced away, and the
 * delta is better determined than either level it is computed from.
 */
export const DEPTH_ABLATION_TREATMENT =
  `${TREATMENT} · PAIRED contrast: both arms evaluated at the same decision, same outcome, `
  + 'same propensity denominator, so the population term cancels exactly';

/**
 * The standing statement this card must be read under. It is not modesty; it is what the
 * number MEANS, and the top-ranked entry of the suspected-fault register is the first line.
 */
export const DEPTH_ABLATION_SCOPE = Object.freeze([
  'FAULT-population-mismatch (register rank 1). The corpus is HandHQ ONLINE cash, July 2009, '
  + "numeric stakes (SRC-011/012). The founder's game is LIVE 9-handed 1/2-1/3. Those are "
  + 'distinct populations and this repo never merges them, so ANY live reading of this figure '
  + 'is TRANSFERRED, not measured.',
  'NOT A VERDICT. The delete option for depth-2 was taken off the table by the founder on '
  + '2026-08-03. A delta indistinguishable from zero is a statement about this instrument on '
  + 'an engine that is not in a verified state, not evidence against the subsystem.',
  'THE ENGINE GRADES ITS OWN HOMEWORK (FAULT-self-grading-circularity). Depth-2 is scored by '
  + 'realized chips, which is an outside check — but WHICH action it recommends comes from the '
  + 'same arithmetic under suspicion in WS-361.',
  'ONE-DECISION HORIZON. The value of PLAYING depth-2 advice through a whole hand is not '
  + 'measured. Reading this as a winrate overstates it by roughly the decisions-per-hand factor.',
]);

const bumpKey = (o, k) => { o[k] = (o[k] || 0) + 1; };

const argmax = (dist) => {
  let best = null; let bestP = -Infinity;
  for (const [a, p] of Object.entries(dist ?? {})) {
    if (p > bestP) { bestP = p; best = a; }
  }
  return best;
};

/** Total variation distance between two action distributions over their union of support. */
const totalVariation = (a, b) => {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  let s = 0;
  for (const k of keys) s += Math.abs((a?.[k] ?? 0) - (b?.[k] ?? 0));
  return s / 2;
};

/**
 * Family 1 — how much did refinement move the ADVICE? Outcome-free by construction.
 *
 * This runs over every decision the pass produced, including ones the EV estimator later
 * drops for a zero propensity: whether the advice moved is a property of the engine, not of
 * whether the 2009 field happened to take an action we can reweight.
 */
export const adviceDivergence = (decisions, { baseArm, testArm, epsilon = 1e-9 } = {}) => {
  let n = 0;
  let identical = 0;
  let flips = 0;
  let tvSum = 0;
  let tvMax = 0;
  const flipsBySlice = {};
  const nBySlice = {};
  const flipPairs = {};

  for (const d of decisions) {
    const a = d.piOursByArm?.[baseArm];
    const b = d.piOursByArm?.[testArm];
    if (!a || !b) continue;
    n++;
    const tv = totalVariation(a, b);
    tvSum += tv;
    if (tv > tvMax) tvMax = tv;
    if (tv <= epsilon) identical++;
    const ta = argmax(a);
    const tb = argmax(b);
    const street = d.slices?.street ?? 'unknown';
    bumpKey(nBySlice, street);
    if (ta !== tb) {
      flips++;
      bumpKey(flipsBySlice, street);
      bumpKey(flipPairs, `${ta}->${tb}`);
    }
  }

  return {
    n,
    identicalShare: n ? Number((identical / n).toFixed(4)) : null,
    topActionFlips: flips,
    topActionFlipShare: n ? Number((flips / n).toFixed(4)) : null,
    meanTotalVariation: n ? Number((tvSum / n).toFixed(4)) : null,
    maxTotalVariation: n ? Number(tvMax.toFixed(4)) : null,
    flipPairs,
    byStreet: Object.fromEntries(
      Object.keys(nBySlice).map((s) => [s, {
        n: nBySlice[s],
        flips: flipsBySlice[s] ?? 0,
        flipShare: Number(((flipsBySlice[s] ?? 0) / nBySlice[s]).toFixed(4)),
      }]),
    ),
  };
};

/**
 * Family 2 — the paired EV delta, with a cluster bootstrap over PLAYERS.
 *
 * Built out of `ipsEstimator`'s own primitives (`weightFor`, `wisValue`,
 * `clusterBootstrapCI`) rather than a fresh estimator, so it cannot disagree with the arms
 * printed beside it. The one thing it does differently is resample BOTH weights together
 * inside a single bootstrap draw — a delta of two independently-bootstrapped intervals would
 * throw away the pairing that makes this the well-determined figure, and would report an
 * interval several times too wide.
 *
 * A decision enters only when BOTH arms are scorable. `pi_ours = 0` is scorable and
 * meaningful (our policy would never take the observed action, so the hand carries no
 * evidence and contributes weight zero); `pi_pool = 0` is not, and is dropped identically for
 * both arms because the denominator is shared.
 */
export const pairedDelta = (decisions, {
  baseArm, testArm,
  weightCap = DEFAULT_WEIGHT_CAP,
  // WS-435: imported from their definition sites, never transcribed — these were the
  // literal values 2000 / 0.05 restated inline, which is the drift the constants exist
  // to prevent.
  resamples = DEFAULT_BOOTSTRAP_RESAMPLES,
  alpha = DEFAULT_BOOTSTRAP_ALPHA,
  seed = DEFAULT_BOOTSTRAP_SEED,
} = {}) => {
  const rows = [];
  const byPlayer = new Map();
  const skipped = {};

  for (const d of decisions) {
    const a = d.piOursByArm?.[baseArm];
    const b = d.piOursByArm?.[testArm];
    if (!a || !b) { bumpKey(skipped, 'missing-arm'); continue; }
    const wa = weightFor({ ...d, piOurs: a }, { weightCap });
    const wb = weightFor({ ...d, piOurs: b }, { weightCap });
    if (!wa.ok) { bumpKey(skipped, `${baseArm}:${wa.reason}`); continue; }
    if (!wb.ok) { bumpKey(skipped, `${testArm}:${wb.reason}`); continue; }
    const rec = { wA: wa.w, wB: wb.w, net: wa.net, playerId: d.playerId };
    rows.push(rec);
    let bucket = byPlayer.get(d.playerId);
    if (!bucket) byPlayer.set(d.playerId, (bucket = []));
    bucket.push(rec);
  }

  if (rows.length === 0) {
    return {
      treatment: DEPTH_ABLATION_TREATMENT, baseArm, testArm,
      n: 0, players: 0, skipped, note: 'no paired scorable decisions',
      deltaBB: null, deltaCiLowBB: null, deltaCiHighBB: null,
    };
  }

  const stat = (chunk) => {
    const vA = wisValue(chunk.map((r) => ({ w: r.wA, net: r.net })));
    const vB = wisValue(chunk.map((r) => ({ w: r.wB, net: r.net })));
    return (vA !== null && vB !== null) ? vB - vA : null;
  };

  const delta = stat(rows);
  const ci = clusterBootstrapCI(byPlayer, stat, { resamples, alpha, seed });

  // How much of the paired sample actually carries information about the DIFFERENCE. Two arms
  // that agree exactly on a decision contribute an identical weight to both sides and cancel;
  // n would still count them. This is the honest denominator for the delta specifically, and
  // it is a different number from either arm's own ESS.
  let discordant = 0;
  for (const r of rows) if (Math.abs(r.wA - r.wB) > 1e-12) discordant++;

  return {
    treatment: DEPTH_ABLATION_TREATMENT,
    baseArm,
    testArm,
    n: rows.length,
    players: byPlayer.size,
    discordantN: discordant,
    discordantShare: Number((discordant / rows.length).toFixed(4)),
    deltaBB: delta === null ? null : Number(delta.toFixed(4)),
    deltaCiLowBB: ci ? Number(ci.lo.toFixed(4)) : null,
    deltaCiHighBB: ci ? Number(ci.hi.toFixed(4)) : null,
    ciResamples: ci?.resamples ?? 0,
    excludesZero: ci ? (ci.lo > 0 || ci.hi < 0) : null,
    // WS-435: the smallest delta THIS paired sample could have resolved, in the same bb
    // as the delta beside it. THE SEPARATOR IS POWER, NOT SAMPLE SIZE — a straddling
    // interval at an MDE above the effect being hunted is a statement about the
    // instrument, not the effect.
    deltaMdeDetectBB: ci ? Number((Z_DETECT * ci.sd).toFixed(4)) : null,
    deltaMdePower80BB: ci ? Number(((Z_DETECT + Z80_POWER) * ci.sd).toFixed(4)) : null,
    skipped,
  };
};

/**
 * Admissibility, on the same rules `heroEvReport.assessAdmissibility` applies — including the
 * same 30-cluster bar, imported rather than re-declared so the two cannot drift.
 *
 * ONE RULE IS DELIBERATELY DIFFERENT, and the difference is the point of a paired design:
 * `TOO_FEW_CLUSTERS` blocks quoting the ABSOLUTE arms but is a WARNING on the delta and on
 * advice divergence. The bar exists because between-player variance dominates an absolute
 * edge; the pairing differences that term away, and advice divergence never contained it.
 * Applying a bar to a quantity it was not derived for would suppress the one figure this run
 * can honestly report — and `FAULT-degenerate-signal` cuts both ways.
 */
export const assessDepthAdmissibility = (run, delta, divergence, control) => {
  const blockers = [];
  const warnings = [];
  const clusters = delta.players ?? 0;

  if (run.complete === false) {
    blockers.push({
      code: 'INCOMPLETE_RUN',
      detail: `Run did not finish (${run.decisionsScored ?? delta.n} decisions scored). EVAL `
        + 'players are processed sequentially, so a partial is a biased subsample of the first '
        + 'players, not a random one.',
    });
  }
  if (!delta.n) {
    blockers.push({ code: 'NO_DECISIONS', detail: 'No paired decisions were scored; every figure is vacuous.' });
  }
  if (clusters < 2) {
    blockers.push({
      code: 'NO_CI_POSSIBLE',
      detail: `Only ${clusters} contributing player(s). A cluster bootstrap needs at least 2.`,
    });
  }
  if (control && control.n && (control.edgeBB === null || Math.abs(control.edgeBB) >= 1e-6)) {
    blockers.push({
      code: 'CONTROL_DRIFT',
      detail: `Control scored ${control.edgeBB} bb against itself; it must be 0. The estimator is `
        + 'manufacturing signal and no figure in this report means anything.',
    });
  }
  if (divergence && divergence.n && divergence.identicalShare === 1) {
    blockers.push({
      code: 'ARMS_IDENTICAL',
      detail: 'The two arms produced identical advice on every decision, so the EV delta is '
        + 'zero by construction and measures nothing. Either the refinement budget was not '
        + 'threaded through to the engine, or refinement changed no recommendation on this '
        + 'slice. Check which before reading anything else.',
    });
  }

  if (clusters < MIN_CLUSTERS_FOR_CI && clusters >= 2) {
    warnings.push({
      code: 'TOO_FEW_CLUSTERS_FOR_LEVELS',
      detail: `${clusters} contributing players is below the ${MIN_CLUSTERS_FOR_CI}-cluster bar. `
        + 'The two ABSOLUTE arm edges must not be quoted. The PAIRED delta and the advice '
        + 'divergence are still readable: the pairing differences away the between-player '
        + 'variance the bar exists to guard, and divergence never contained it.',
    });
  }
  if (delta.n && delta.discordantShare !== undefined && delta.discordantShare < 0.05) {
    warnings.push({
      code: 'LOW_DISCORDANCE',
      detail: `Only ${(delta.discordantShare * 100).toFixed(1)}% of paired decisions have `
        + 'different importance weights across the two arms. The delta is being carried by a '
        + 'small subset; treat its interval as optimistic.',
    });
  }

  return {
    admissible: blockers.length === 0,
    blockers,
    warnings,
    clusters,
    minClustersForCI: MIN_CLUSTERS_FOR_CI,
    // Named separately from `admissible` because they are different questions and a consumer
    // that conflates them will quote an absolute edge off a 4-player run — which has already
    // happened once in this repo (heroEvReport, 2026-07-31).
    absoluteArmsQuotable: blockers.length === 0 && clusters >= MIN_CLUSTERS_FOR_CI,
    complete: run.complete !== false,
  };
};

/**
 * Constants this run depends on that are NOT reachable through the loader.
 *
 * EMPTY SINCE WS-432 (2026-08-07). The one entry it held was `MAX_STAGE_SHARE`, a
 * module-local `const` inside `gameTreeEvaluator.js` that could not be read through the
 * harness loader and was therefore recorded as a `knownDivergence` with `agrees: null` —
 * a value transcribed from source and verified by nothing. WS-432 moved the constant to
 * `src/utils/exploitEngine/refinementWork.js` exactly so it could be READ:
 * `replicationStamp.collectConstants` now stamps it into `constants` from its definition
 * site, and the manifest floor (`REQUIRED_CONSTANTS`) refuses a card without it. The
 * function is kept (returning []) so the divergence channel stays wired for the next
 * constant that ends up unreachable.
 */
export const unreadableConstants = () => [];

/**
 * Randomness the depth-2 arm cannot seed, ON TOP of the hero-EV chain already named in
 * `replicationStamp.HERO_EV_UNSEEDED_SOURCES`.
 *
 * EMPTY SINCE WS-432 (2026-08-07) — and an empty array is a POSITIVE claim of
 * bit-reproducibility for the depth-2 arm, which is now true and gate-verified.
 */
export const DEPTH_ABLATION_UNSEEDED_SOURCES = Object.freeze([
  // WS-393 CLOSED THE FIRST ENTRY THAT USED TO SIT HERE. The six `stratifiedSample` calls in
  // `gameTreeDepth2.js` and `miniRolloutEquity`'s raw `Math.random` now take a board-derived
  // deterministic rng, so depth-2 no longer carries sampling noise the depth-1 arm does not.
  //
  // The entry is REMOVED rather than reworded, because this array is a positive claim and a
  // stale entry is as wrong as a missing one — it would tell a reader to discount a difference
  // that is now real. Its removal is recorded here rather than in the diff alone, since a
  // reader comparing a WS-393 card against an earlier one needs to know the list SHRANK for a
  // reason and not because someone tidied it.
  //
  // WS-432 CLOSED THE SECOND (2026-08-07): `REFINEMENT_CLOCK_UNSEEDED_SOURCE`, the
  // wall-clock refinement budget imported from `replicationStamp.mjs`. The logical
  // work-unit clock (`refinementWork.js`, 'logical-v1') makes stage completion a pure
  // function of the inputs, so the dependence the entry declared no longer exists. Same
  // removal discipline as above; the retirement note lives at the old definition site in
  // `replicationStamp.mjs`.
]);

/**
 * Assemble the report and its Result Card.
 *
 * Mirrors `heroEvReport.buildCardFor`: returns `{ resultCard, resultCardProblems }` rather
 * than throwing, so a run that produced a real measurement still writes its artifact when the
 * stamp is incomplete, and the problems list says exactly why it is not quotable.
 */
export const buildDepthAblationReport = (run, {
  baseArm = 'depth1',
  testArm = 'depth2',
  weightCap = DEFAULT_WEIGHT_CAP,
  // WS-537. Factor 2 of the bb/100-hands scaling, from a coverage census over the Deal Book.
  // Null (the default) REFUSES the scaled column rather than deriving a denominator from the
  // scored subset — the substitution `coverageCensus.attachOpportunityCount` structurally
  // forbids for `overallEvBB100` and which is no more legitimate here.
  opportunitiesPerHand = null,
} = {}) => {
  const d = run.decisions ?? [];
  const opts = { weightCap };

  const armEdges = {};
  for (const arm of (run.config?.depthArms ?? [])) {
    armEdges[arm.id] = estimateEdge(
      d.filter((x) => x.piOursByArm?.[arm.id]).map((x) => ({ ...x, piOurs: x.piOursByArm[arm.id] })),
      { ...opts, label: `engine advice @ refinementBudgetMs=${arm.refinementBudgetMs ?? 'engine default'}` },
    );
  }

  // The control. Scoring the behaviour policy against itself must give exactly zero; if it
  // ever drifts the estimator is manufacturing signal and nothing else on the page means
  // anything. Printed every run for the same reason `heroEvReport` prints it every run.
  const control = estimateEdge(
    d.map((x) => ({ ...x, piOurs: x.piPool })),
    { ...opts, label: 'control: population-typical (must be 0)' },
  );

  const divergence = adviceDivergence(d, { baseArm, testArm });
  const delta = pairedDelta(d, { baseArm, testArm, weightCap });
  const admissibility = assessDepthAdmissibility(run, delta, divergence, control);

  // ─────────────────────────────────────────────────────────────────────────────────────
  // WS-537 — THE CHANGE LEDGER. `delta.deltaBB` above is a NET, and this report has been
  // publishing it alone for the life of the instrument. The card that ships beside this code
  // shows exactly what that costs: `flipShareByStreet {flop 0.0072, turn 0.039, river 0.80}`
  // beside a single `depthDeltaBB: -0.4711`. The advice movement was already known to be a
  // river phenomenon and the EV figure could not say so — and a change that helped one street
  // while hurting another by the same amount would have printed the same NET as no change.
  //
  // The ledger is handed the headline it must reproduce, so the identity is CHECKED rather
  // than assumed; a mismatch refuses the ledger outright, which then refuses the card below.
  // Same `weightCap` as `pairedDelta` above, deliberately — a different cap is a different
  // decision set and the identity would (correctly) fail.
  // ─────────────────────────────────────────────────────────────────────────────────────
  const changeLedger = buildChangeLedger(d, {
    baseArm,
    testArm,
    weightCap,
    headlineDeltaBB: delta.deltaBB,
    opportunitiesPerHand,
    // The cluster half of the gate comes from `heroEvReport`'s single definition; only the
    // discordance half is this module's. See CELL_MIN_DISCORDANT for why the bar is on
    // discordance and not on n.
    cellGate: { minClusters: MIN_CLUSTERS_FOR_CI, minDiscordant: CELL_MIN_DISCORDANT },
  });

  // THE PUBLISH REFUSAL. Not a warning printed near the number — an entry in the same
  // `resultCardProblems` channel that already means "this figure must not be quoted", so a
  // NET that lost its GROSS reaches a reader through the mechanism they already read.
  const netProblems = netPublishProblems(changeLedger, {
    netBB: delta.deltaBB,
    field: 'metrics.depthDeltaBB',
  });

  const stamp = run.replicationStamp ?? null;
  let card = { resultCard: null, resultCardProblems: ['no replication stamp on the run — this figure cannot be replicated and must not be quoted.'] };
  if (netProblems.length) {
    // NO CARD. The publish path that emits NET alone is refused, and refusing means the card
    // is not minted — not that it is minted with a note attached. `netPublishProblems` returns
    // [] when there is no headline to protect, so this fires only when a real `depthDeltaBB`
    // exists and its decomposition does not: an identity violation or degenerate weights,
    // both of which mean the headline itself is over a decision set nobody can name.
    card = { resultCard: null, resultCardProblems: netProblems };
  } else if (stamp) {
    try {
      const manifest = buildReplicationManifest({
        ...stamp,
        knownDivergences: [...(stamp.knownDivergences ?? []), ...unreadableConstants()],
      });
      const resultCard = buildResultCard({
        resultCardId: `RC-depth-ablation-${String(stamp.dealBookHash).replace('sha256:', '').slice(0, 8)}-${String(stamp.engineCommit).slice(0, 8)}`,
        match: {
          // ONE surface, TWO configurations. The card names the surface and the estimand names
          // the contrast — inventing a second surface id for a configuration of the first
          // would make the Ladder treat them as different objects, which is precisely what a
          // paired ablation is claiming they are not.
          surfaceId: run.surfaceId ?? 'engine-read',
          dealBookId: run.dealBook?.dealBookId ?? null,
          fieldId: run.fieldId ?? 'pool-mined-behavior-policy',
        },
        estimand: DEPTH_ABLATION_ESTIMAND,
        treatment: DEPTH_ABLATION_TREATMENT,
        metrics: {
          kind: 'depth-ablation', // WS-434: dispatches to SOR_SCHEMAS['metrics.depth-ablation']
          // ── the headline, on ONE scale: bb of hero hand value ────────────────────────
          depthDeltaBB: delta.deltaBB,
          depthDeltaCiLowBB: delta.deltaCiLowBB,
          depthDeltaCiHighBB: delta.deltaCiHighBB,
          depthDeltaExcludesZero: delta.excludesZero,
          // WS-435: a null without its MDE is not a result — the card carries the
          // smallest delta this run could have resolved, on the same bb scale.
          depthDeltaMdeDetectBB: delta.deltaMdeDetectBB ?? null,
          depthDeltaMdePower80BB: delta.deltaMdePower80BB ?? null,
          // WS-537 (v4) — GROSS BESIDE NET, ON THE CARD. `depthDeltaBB` above is a NET and
          // this instrument published it alone for its whole life; `flipShareByStreet` below
          // has been decomposing the ADVICE movement by street since v1 while the EV figure
          // stayed a scalar, so the card said "river 0.80" and "-0.4711" and could not connect
          // them. metricsProblems now REJECTS a depth-ablation card carrying the first of
          // these without changeLedgerGrossBB, so this line is not optional decoration.
          ...changeLedgerMetricsFields(changeLedger),
          // ── the absolute arms. NOT quotable below the cluster bar; see admissibility ──
          edgeBaseArmBB: armEdges[baseArm]?.edgeBB ?? null,
          edgeTestArmBB: armEdges[testArm]?.edgeBB ?? null,
          // ── advice divergence: outcome-free, well determined at this n ────────────────
          topActionFlipShare: divergence.topActionFlipShare,
          // BY STREET, ON THE CARD ITSELF. The aggregate flip share is the least informative
          // form of this measurement — the whole finding is WHERE the flips are, and a
          // breakdown that lives only in the run artifact is a breakdown the Ladder and the
          // fault matchers cannot see. Same argument WS-328 makes for capture shipping with
          // its reader.
          flipShareByStreet: Object.fromEntries(
            Object.entries(divergence.byStreet ?? {}).map(([s, v]) => [s, v.flipShare]),
          ),
          flipCountByStreet: Object.fromEntries(
            Object.entries(divergence.byStreet ?? {}).map(([s, v]) => [s, { flips: v.flips, n: v.n }]),
          ),
          // WS-434 Stage 2: the same counts in the canonical conditioned-rate vocabulary.
          // Emitted BESIDE flipCountByStreet forever — legacy readers key on the old name.
          flipByStreetConditioned: Object.fromEntries(
            Object.entries(divergence.byStreet ?? {}).map(([s, v]) => [s, {
              k: v.flips,
              n: v.n,
              rate: v.n ? v.flips / v.n : null,
              conditional: `P(top action flips between arms | street = ${s}, paired decision)`,
            }]),
          ),
          flipDirections: { ...(divergence.flipPairs ?? {}) },
          meanTotalVariation: divergence.meanTotalVariation,
          maxTotalVariation: divergence.maxTotalVariation,
          identicalShare: divergence.identicalShare,
          // ── denominators ─────────────────────────────────────────────────────────────
          n: delta.n,
          discordantN: delta.discordantN ?? null,
          players: delta.players,
          divergenceN: divergence.n,
          controlEdgeBB: control.edgeBB,
          // The card carries its own refusal so a reader who reaches for it out of context
          // still meets it. `notAVerdict` is a field, not prose in a doc nobody opens.
          notAVerdict: true,
        },
        clusterUnit: 'players',
        admissibility,
        manifest,
        // WS-431: by-hash reference to the decision record (set by run-depth-ablation.mjs
        // before this builder runs), same contract as heroEvReport.buildCardFor.
        decisionRecord: run.decisionRecord ?? null,
      });
      card = { resultCard, resultCardProblems: [] };
    } catch (err) {
      card = {
        resultCard: null,
        resultCardProblems: [err?.message || String(err), ...resultCardProblems({ manifest: { ...stamp } })],
      };
    }
  }

  return {
    schemaVersion: DEPTH_ABLATION_SCHEMA_VERSION,
    baseArm,
    testArm,
    scope: [...DEPTH_ABLATION_SCOPE],
    treatment: DEPTH_ABLATION_TREATMENT,
    estimand: DEPTH_ABLATION_ESTIMAND,
    divergence,
    delta,
    // WS-537 — the per-branch decomposition of `delta`. Sits BESIDE the delta rather than
    // inside it so a consumer that reads `delta.deltaBB` cannot get the NET without the
    // ledger being on the same object; `renderDepthAblationReport` prints them adjacently
    // for the same reason.
    changeLedger,
    armEdges,
    control,
    admissibility,
    resultCard: card.resultCard,
    resultCardProblems: card.resultCardProblems,
    provenance: {
      sources: ['SRC-012', 'SRC-015'],
      corpus: 'HandHQ online cash, July 2009, numeric stakes',
      partition: run.integrity?.behaviorPolicy?.partition ?? null,
      rakeModelled: run.config?.rakeIsModelled ?? null,
      complete: run.complete !== false,
    },
    generatedFrom: {
      config: run.config,
      counters: run.counters,
      integrity: run.integrity,
      runtimeMs: run.runtimeMs ?? null,
    },
  };
};

const bb = (x) => (x === null || x === undefined ? '—' : Number(x).toFixed(4));
const pctOf = (x) => (x === null || x === undefined ? '—' : `${(x * 100).toFixed(1)}%`);

export const renderDepthAblationReport = (r) => {
  const L = [];
  L.push('');
  L.push('═'.repeat(96));
  L.push('  DEPTH ABLATION — what does the depth-2/3 refinement subsystem change?  (WS-334 AC5)');
  L.push('═'.repeat(96));
  L.push('');
  L.push('  *** INFORMATION ONLY. NOT a keep/delete verdict on depth-2. The delete option was');
  L.push('      taken off the table by the founder on 2026-08-03. ***');
  L.push('');
  L.push(`  TREATMENT: ${r.treatment}`);
  L.push('');
  L.push('  1. DID THE ADVICE MOVE?  (outcome-free — needs no chips, no propensities, no CI)');
  L.push('  ' + '─'.repeat(92));
  const dv = r.divergence;
  L.push(`    decisions compared            ${dv.n}`);
  L.push(`    advice byte-identical         ${pctOf(dv.identicalShare)}`);
  L.push(`    top-action flipped            ${dv.topActionFlips} (${pctOf(dv.topActionFlipShare)})`);
  L.push(`    mean total-variation distance ${bb(dv.meanTotalVariation)}   max ${bb(dv.maxTotalVariation)}`);
  if (Object.keys(dv.flipPairs ?? {}).length) {
    L.push(`    flip directions               ${JSON.stringify(dv.flipPairs)}`);
  }
  for (const [street, s] of Object.entries(dv.byStreet ?? {})) {
    L.push(`      ${String(street).padEnd(10)} n=${String(s.n).padStart(5)}  flips ${String(s.flips).padStart(4)} (${pctOf(s.flipShare)})`);
  }
  L.push('');

  L.push('  2. DID THE MOVEMENT MAKE MONEY?  (bb of hero hand value, PAIRED)');
  L.push('  ' + '─'.repeat(92));
  const dl = r.delta;
  if (!dl.n) {
    L.push('    No paired scorable decisions — nothing to report.');
  } else {
    const ci = dl.deltaCiLowBB === null ? 'CI —' : `[${bb(dl.deltaCiLowBB)}, ${bb(dl.deltaCiHighBB)}]`;
    L.push(`    delta (${r.testArm} − ${r.baseArm})   ${bb(dl.deltaBB).padStart(9)} bb   ${ci.padStart(22)}`);
    L.push(`    n=${dl.n}  players=${dl.players}  decisions where the arms differ: ${dl.discordantN} (${pctOf(dl.discordantShare)})`);
    L.push(`    interval excludes zero: ${dl.excludesZero === null ? '—' : dl.excludesZero}`);
    // WS-435: the MDE prints ALWAYS, not only on a null — near-null readers need it too.
    L.push(`    min detectable effect (this run): detect ${bb(dl.deltaMdeDetectBB)} bb · 80% power ${bb(dl.deltaMdePower80BB)} bb`);
    if (dl.excludesZero === false) {
      L.push(`    NULL RESULT — this instrument could not resolve effects smaller than ${bb(dl.deltaMdePower80BB)} bb`);
      L.push('    (80% power). A smaller real effect and no effect print identically here;');
      L.push('    the separator is POWER, not sample size.');
    }
    if (Object.keys(dl.skipped ?? {}).length) L.push(`    unscorable: ${JSON.stringify(dl.skipped)}`);
  }
  L.push('');

  // WS-537 — printed IMMEDIATELY after the NET above, never further down the page. A GROSS
  // the reader has to scroll to is a GROSS that gets separated from its NET the first time
  // someone quotes the delta, which is the same argument `renderPiers` makes for putting the
  // PBR warning above the ceiling.
  if (dl.n) L.push(...renderChangeLedgerLines(r.changeLedger ?? null));

  L.push('  3. THE ABSOLUTE ARMS  (each vs population-typical play — read only if quotable below)');
  L.push('  ' + '─'.repeat(92));
  for (const [id, a] of Object.entries(r.armEdges ?? {})) {
    if (!a.n) { L.push(`    ${id.padEnd(10)} no scorable decisions`); continue; }
    const ci = a.edgeCiLowBB === null ? 'CI —' : `[${bb(a.edgeCiLowBB)}, ${bb(a.edgeCiHighBB)}]`;
    L.push(`    ${id.padEnd(10)} ${bb(a.edgeBB).padStart(9)} bb  ${ci.padStart(22)}  n=${String(a.n).padStart(5)} ESS=${String(a.ess).padStart(7)} players=${a.players}`);
  }
  L.push('');

  const ctrl = r.control;
  if (ctrl.n) {
    const ok = ctrl.edgeBB !== null && Math.abs(ctrl.edgeBB) < 1e-6;
    L.push(`  CONTROL ${ok ? 'OK' : '*** FAILED ***'} — population-typical scored against itself: edge ${bb(ctrl.edgeBB)} bb`);
    if (!ok) L.push('    The estimator is producing signal from nothing; NO figure above is trustworthy.');
  } else {
    L.push('  CONTROL NOT RUN — no decisions were scored.');
  }
  L.push('');

  const adm = r.admissibility;
  L.push('  ADMISSIBILITY');
  L.push('  ' + '─'.repeat(92));
  L.push(`    contributing players ${adm.clusters} (absolute-arm bar: ${adm.minClustersForCI})`);
  L.push(`    paired delta + divergence quotable : ${adm.admissible}`);
  L.push(`    absolute arm edges quotable        : ${adm.absoluteArmsQuotable}`);
  for (const b of adm.blockers) L.push(`      BLOCKER ${b.code}: ${b.detail}`);
  for (const w of adm.warnings) L.push(`      ! ${w.code}: ${w.detail}`);
  L.push('');

  L.push('  STANDARD OF RECORD (ADR-009)');
  L.push('  ' + '─'.repeat(92));
  if (r.resultCard) {
    const m = r.resultCard.manifest;
    L.push(`    Result Card ${r.resultCard.resultCardId}`);
    L.push(`    engine ${m.engineCommit.slice(0, 12)}${m.engineDirty ? '  *** DIRTY TREE — the commit does not identify the code that ran ***' : ''}`);
    L.push(`    deal book ${r.resultCard.match.dealBookId}  ${String(m.dealBookHash).slice(0, 24)}…`);
    L.push(`    register  ${m.disclaimerRegisterVersion}`);
    L.push(`    cluster unit ${r.resultCard.clusterUnit}   seeds ${JSON.stringify(m.seeds)}`);
    if (m.unseededSources.length) {
      L.push(`    NOT bit-reproducible — ${m.unseededSources.length} unseeded source(s):`);
      for (const s of m.unseededSources) L.push(`      - ${s.source} (${s.mechanism})`);
    }
  } else {
    L.push('    *** NO RESULT CARD — this figure is not replicable and must not be quoted ***');
    for (const p of (r.resultCardProblems ?? [])) L.push(`      - ${p}`);
  }
  L.push('');
  L.push('  SCOPE — read every line before quoting any number above');
  L.push('  ' + '─'.repeat(92));
  for (const s of r.scope) {
    L.push(`    · ${s.replace(/(.{1,88})(\s|$)/g, '$1\n      ').trim()}`);
  }
  L.push('═'.repeat(96));
  return L.join('\n');
};
