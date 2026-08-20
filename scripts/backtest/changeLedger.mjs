/**
 * changeLedger.mjs — the per-branch, EV-denominated decomposition of the difference between
 * two runs on an IDENTICAL decision set. (WS-537; SCORED-READOUT-SPEC §9, View 6)
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *  NET IS NEVER PUBLISHED WITHOUT GROSS. That is the whole reason this module exists, and
 *  `netPublishProblems` below is the enforcement — not a convention a reader is trusted to
 *  remember.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE IT CLOSES. `depthAblationReport` emits a scalar `deltaBB` and, beside it,
 * flip counts already decomposed by street. The committed card shows the shape of the
 * problem exactly: `flipShareByStreet {flop 0.0072, turn 0.039, river 0.80}` beside a
 * single aggregate `depthDeltaBB: -0.4711`. The behaviour is known to be almost entirely a
 * river phenomenon and the EV figure cannot say so. Worse, a change that helps the flop and
 * hurts the river by the same amount prints the SAME NET as a change that did nothing —
 * two opposite findings, one number, and the difference invisible for exactly as long as
 * nobody looked.
 *
 *   NET   = Σ_b Δ_b     — equal to the headline delta BY CONSTRUCTION (asserted, not hoped)
 *   GROSS = Σ_b |Δ_b|   — total movement regardless of sign
 *
 * `GROSS / |NET|` near 1 means the change moved the tree one way. A large ratio means it
 * REDISTRIBUTED, so a NET near zero is a CANCELLATION and not an absence of effect.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE DECOMPOSITION, AND WHERE IT DEPARTS FROM THE SPEC'S FORMULA — read this before
 * changing the arithmetic.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * §9.3 writes the row as `Δ_b = deltaBB_b × (n_b / n) × opportunitiesPerHand × 100`. That
 * form is EXACT for a plain count-weighted mean and is NOT exact for the estimator the
 * headline actually uses. `pairedDelta` (and `estimateEdge`) are SELF-NORMALIZED: the
 * headline is
 *
 *     Δ = Σ_d w^B_d R_d / W_B  −  Σ_d w^A_d R_d / W_A ,   W_X = Σ_d w^X_d
 *
 * and the normalizers are GLOBAL. A per-branch WIS value re-normalizes inside the branch by
 * W_A,b and W_B,b, so `Σ_b deltaBB_b × (n_b/n)` does not return Δ — it returns a different
 * number that happens to look like one, which is precisely the class of error ADR-009
 * exists to close. The accept criterion ("NET equals the headline paired delta BY
 * CONSTRUCTION, asserted in a test, not by inspection") is the binding requirement, so this
 * module decomposes the headline by per-decision CONTRIBUTION at the global normalizers:
 *
 *     c_d = w^B_d R_d / W_B  −  w^A_d R_d / W_A          Σ_d c_d = Δ,  identically
 *     Δ_b = Σ_{d ∈ b} c_d
 *
 * The spec's `deltaBB_b` still ships, under the name `localDeltaBB`, labelled a DIAGNOSTIC:
 * it is the branch's own paired WIS delta ("what happened inside this branch"), it is the
 * interpretable per-branch number, and it does NOT sum to anything. Both are on the row
 * because they answer different questions and a reader who conflates them gets a wrong
 * total. Reporting only the interpretable one and calling its sum the headline would be the
 * WS-291 mechanism with extra steps.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * GROSS IS PARTITION-DEPENDENT, AND THAT IS CARRIED AS DATA.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Refining the partition can only increase GROSS (splitting a branch splits a sum of signed
 * contributions into parts whose absolute values sum to at least |the whole|), while NET is
 * invariant. So `GROSS/|NET|` is comparable across two ledgers ONLY at the same partition.
 * `partition {axes, branchCount, keyCompleteness}` rides on every ledger so a consumer
 * cannot compare two ratios computed over different axis sets without seeing that it did.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * REFUSAL, AND THE ONE INVARIANT IT MUST NOT BREAK.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * A change-ledger cell is a COMPARATIVE claim — a number someone could act on ("the river
 * lost 0.4 bb") or cite. `.claude/rules/sparsity-refuse-or-shrink.md` therefore says REFUSE,
 * never shrink: the refusal is named, carries its reason, and keeps `observed-zero`,
 * `unexamined` and `dropped` distinct, because a zero is three facts and not one.
 *
 * BUT A REFUSAL GOVERNS QUOTATION, NOT INCLUSION. A refused branch still contributes its
 * Δ_b to NET and to GROSS. Dropping refused branches from the totals would silently break
 * the sum identity and hide exactly the mass the instrument was built to surface — the
 * offsetting movement is often in the thin branches. `quotable` is a property of the row;
 * the totals are over every row.
 *
 * Branch level is ALWAYS emitted (WS-537 accept criteria). The CELL — the audit-level
 * refinement, the full situation key plus carried geometry — is gated on power, and this
 * module refuses to invent the bar: with no `cellGate` supplied the cell table reports its
 * own unavailability rather than picking a threshold, which would be a hidden editorial cut
 * (the argument RULE 7d already makes in §9bis.2).
 */

import { weightFor, wisValue, DEFAULT_WEIGHT_CAP } from './ipsEstimator.mjs';
import {
  IDENTITY_AXES, CARRIED_AXES, HERO_AXIS, axisOf as axisOfKey,
} from '../../src/utils/pokerCore/situationKey.js';

export const CHANGE_LEDGER_SCHEMA_VERSION = 1;

/**
 * The reporting unit — `street × facingAction × isIP`, three of `situationKey`'s seven
 * identity axes. A PROJECTION of the cell, never a parallel taxonomy (VOCABULARY.md:90).
 *
 * Ordered here as the spec writes it, not as `IDENTITY_AXES` orders them: this array is a
 * projection specification, not the wire format, and the wire format is append-only for
 * reasons that do not apply to a report key.
 */
export const BRANCH_AXES = Object.freeze(['street', 'facingAction', 'isIP']);

/**
 * The audit unit — the full identity key plus the geometry the row carries.
 *
 * Imported from `situationKey.js` rather than transcribed, for the reason WS-435 gives at
 * `pairedDelta`: a restated constant is a constant that drifts. `handClass` is deliberately
 * absent — it is the QUERY, not the bucket, and `situationKey.js` says so at its definition.
 */
export const CELL_AXES = Object.freeze([...IDENTITY_AXES, ...CARRIED_AXES.filter(
  (a) => a !== 'source' && a !== 'pool',
), 'sizeBucket', 'playersInPot']);

/**
 * The value written into a key position whose axis this row does not carry.
 *
 * NOT a bucket the data fell into — a statement that the axis was unavailable. It is
 * spelled distinctly so a branch key can never be mistaken for a measured `oop`, and so
 * `keyCompleteness` can count it.
 */
export const UNKNOWN_AXIS = 'unknown';

/**
 * Refusal classes, kept distinct per `.claude/rules/sparsity-refuse-or-shrink.md`.
 *
 *   observed-zero — the question was asked and the answer is a measured zero.
 *   unexamined    — the question could not be asked at this n.
 *   dropped       — rows existed and the estimator could not score them.
 *
 * Collapsing these into one "no data" would lose the distinction that decides whether a
 * branch is a finding or a work item.
 */
export const REFUSAL_CLASSES = Object.freeze({
  OBSERVED_ZERO: 'observed-zero',
  UNEXAMINED: 'unexamined',
  DROPPED: 'dropped',
});

/**
 * Minimum DISCORDANT decisions before a cell may be quoted.
 *
 * The bar is on discordance, not on `n`, because discordance is the honest denominator for a
 * DIFFERENCE — `pairedDelta`'s own docblock makes this argument at the aggregate level ("two
 * arms that agree exactly on a decision contribute an identical weight to both sides and
 * cancel; n would still count them"). A cell of 400 decisions where the arms agreed on 398 of
 * them is a 2-decision result wearing a large n.
 *
 * 30 is a JUDGEMENT CALL, deliberately named and exported rather than inlined, and it is the
 * same convention `MIN_CLUSTERS_FOR_CI` cites for cluster-robust inference. It is NOT paired
 * with a cluster bar here — the caller supplies that from its own `MIN_CLUSTERS_FOR_CI`
 * import, so there is exactly one definition of the cluster bar in the repo and this module
 * cannot drift from it. Moving this number is a `/decide`, not an edit.
 *
 * EXPECT IT TO REFUSE ALMOST EVERYTHING at the sample sizes this harness reaches. That is the
 * correct outcome, not a failure of the gate: an empty cell table is the honest report, and
 * per `.claude/rules/sparsity-refuse-or-shrink.md` the holes it leaves visible become the
 * work queue. The BRANCH level is what is always available.
 */
export const CELL_MIN_DISCORDANT = 30;

/** Closed enum of per-row refusal codes. A refusal that does not name its reason is a shrug. */
export const REFUSAL_CODES = Object.freeze({
  NO_PAIRED_DECISIONS: 'no-paired-decisions',
  ARMS_AGREE_EVERYWHERE: 'arms-agree-on-every-decision',
  BELOW_DISCORDANCE_BAR: 'below-discordance-bar',
  BELOW_CLUSTER_BAR: 'below-cluster-bar',
});

/** Wholesale refusals — the ledger itself could not be built, so no NET may be published. */
export const LEDGER_REFUSALS = Object.freeze({
  NO_SCORABLE_DECISIONS: 'no-scorable-decisions',
  DEGENERATE_WEIGHTS: 'degenerate-weights',
  IDENTITY_VIOLATED: 'net-does-not-equal-headline',
});

/**
 * Float tolerance on the NET-equals-headline identity.
 *
 * The identity is exact in real arithmetic; the only slack is summation order, since
 * `Σ_d c_d` and `V_B − V_A` accumulate the same terms differently. Anything above this is
 * not rounding — it is two different decision sets, which is the failure the assertion is
 * there to catch.
 */
const IDENTITY_EPSILON = 1e-9;

/** Below this a weight difference is float noise, not discordance. Matches `pairedDelta`. */
const DISCORDANCE_EPSILON = 1e-12;

const round4 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? null : Number(x.toFixed(4)));

/** The axes `axisOfKey` will accept. Calling it with anything else throws by design. */
const KEYABLE = new Set([...IDENTITY_AXES, HERO_AXIS]);

/**
 * Read one axis off a decision row.
 *
 * THE AXES DO NOT ALL LIVE IN ONE PLACE, and pretending they do is how a branch key ends up
 * silently half-formed. `heroEvTask.mjs:468-476` puts `street`/`facingAction`/`texture`/
 * `posCategory`/`sizeBucket`/`playersInPot`/`wentToShowdown` inside `slices`, while `isIP`,
 * `isAgg`, `contextAction` and `situationKey` sit at the TOP LEVEL of the same row
 * (`:454-457`), and `sprBand`/`sBucket`/`closesAction` sit inside `geometry` (`:321-338`).
 * The hole-map artifact documents the consequence — "`slices` — 5 axes … `isAgg` and `isIP`
 * [absent] on the scored rows" (`holeMapHtml.mjs:560-562`).
 *
 * FOURTH LOOKUP, AND IT IS THE ONE THAT SAVES THE PARTITION: the row also carries
 * `situationKey` (`heroEvTask.mjs:454`), which encodes all seven identity axes including
 * `isIP`. Reading it through `situationKey.axisOf` — never by index, which is the defect
 * that module exists to replace — recovers the axis on any row where the flat field is
 * absent but the key is present. Accepting `unknown` without trying the key would be
 * accommodating a limitation the data does not actually impose.
 *
 * WHAT IS DELIBERATELY NOT DONE: `deviationMap.mjs:91` reconstructs `isIP` as
 * `closesAction === 'true'`. That is a DIFFERENT PROPERTY — `decisionGeometry.mjs:164` and
 * `decisionGeometryClosure.test.js:171` both say so, and SB/BB are both OOP while differing
 * on closure. A branch key built from it would be silently mis-partitioned, which is worse
 * than an honest `unknown`.
 *
 * `slices` is consulted FIRST so the projection agrees with every other slice consumer in
 * this directory (`evCost.mjs:154`, `run-hole-map.mjs:437`, `run-river-flip-replicate:149`).
 */
const readAxis = (d, axis) => {
  const fromSlices = d?.slices?.[axis];
  if (fromSlices !== undefined && fromSlices !== null) return String(fromSlices);
  const top = d?.[axis];
  if (top !== undefined && top !== null) return String(top);
  const geo = d?.geometry?.[axis];
  if (geo !== undefined && geo !== null) return String(geo);
  if (typeof d?.situationKey === 'string' && KEYABLE.has(axis)) {
    const fromKey = axisOfKey(d.situationKey, axis, null);
    if (fromKey !== null && fromKey !== undefined) return String(fromKey);
  }
  return UNKNOWN_AXIS;
};

/**
 * The branch key. `street|facingAction|isIP`.
 *
 * A MISSING AXIS NEVER DROPS THE DECISION. Two alternatives were available and both are
 * wrong: dropping the row breaks `Σ_b Δ_b = Δ` — the one property the whole instrument
 * rests on — and folding it into a neighbouring branch marginalizes over the axis without
 * saying so, which is the Slot rule violation VOCABULARY.md:105 names ("an unnamed slot is
 * worse than an open one"). The row keys to `unknown` in that position, still carries its
 * full contribution into NET and GROSS, and is counted in `keyCompleteness`.
 *
 * NOTE ON `isIP`'s DOMAIN: it is a STRING here, `'ip'` / `'oop'` — `heroPolicy.mjs:330`
 * converts with `ctx.isIP === 'ip'` and `poolBestResponse.mjs:252` flips it as a string.
 * Coercing it to a boolean would produce `true` for the literal `'oop'`.
 */
export const branchKeyOf = (d) => BRANCH_AXES.map((a) => readAxis(d, a)).join('|');

/** The cell key — the audit-level refinement. Same missing-axis discipline. */
export const cellKeyOf = (d) => CELL_AXES.map((a) => readAxis(d, a)).join('|');

/**
 * Default policy accessors: pull the two arms out of `piOursByArm` by id.
 *
 * The alternate call shape — explicit `basePolicyOf` / `testPolicyOf` — exists because
 * hero-EV's headline is `V(π_ours) − V(π_pool)`, which is the SAME paired two-arm contrast
 * with the field as the base arm. Giving that a second code path would be the second
 * comparison path ADR-009 forbids; it is one function with two ways of naming the arms.
 */
const armAccessor = (armId) => (d) => d?.piOursByArm?.[armId];

/**
 * Build the change ledger.
 *
 * @param {Array}  decisions              rows carrying piPool, netBB, playerId and the arms
 * @param {Object} opts
 * @param {string} opts.baseArm           arm id into `piOursByArm` (arm A)
 * @param {string} opts.testArm           arm id into `piOursByArm` (arm B)
 * @param {Function} [opts.basePolicyOf]  alternative to baseArm — (d) => action distribution
 * @param {Function} [opts.testPolicyOf]  alternative to testArm
 * @param {number} [opts.weightCap]       MUST match the headline's cap or the sets differ
 * @param {number|null} [opts.headlineDeltaBB]  the figure NET must equal, 4dp, from the
 *                                        producer's own estimator. Omitted → no assertion,
 *                                        and the ledger says the identity was not checked.
 * @param {number|null} [opts.opportunitiesPerHand]  factor 2 of the bb/100-hands scaling.
 *                                        Null refuses the scaled column rather than
 *                                        inventing a denominator.
 * @param {Object|null} [opts.cellGate]   {minClusters, minDiscordant}. Null → no cell table.
 */
export const buildChangeLedger = (decisions, {
  baseArm = null,
  testArm = null,
  basePolicyOf = null,
  testPolicyOf = null,
  baseLabel = null,
  testLabel = null,
  weightCap = DEFAULT_WEIGHT_CAP,
  headlineDeltaBB = undefined,
  opportunitiesPerHand = null,
  cellGate = null,
} = {}) => {
  const getA = basePolicyOf ?? (baseArm ? armAccessor(baseArm) : null);
  const getB = testPolicyOf ?? (testArm ? armAccessor(testArm) : null);
  if (!getA || !getB) {
    throw new Error('buildChangeLedger: name two arms — either {baseArm, testArm} or {basePolicyOf, testPolicyOf}');
  }

  const rows = [];
  const skipped = {};
  const droppedByBranch = {};
  const keyCompleteness = Object.fromEntries(BRANCH_AXES.map((a) => [a, { known: 0, unknown: 0 }]));

  // PASS 1 — admit rows on EXACTLY the rules `pairedDelta` admits them on, using the same
  // `weightFor`. This is what makes the identity hold "by construction" rather than by
  // coincidence: a re-implemented filter is a second chance to disagree.
  for (const d of decisions ?? []) {
    const branch = branchKeyOf(d);
    for (const a of BRANCH_AXES) {
      const v = readAxis(d, a);
      keyCompleteness[a][v === UNKNOWN_AXIS ? 'unknown' : 'known']++;
    }

    const a = getA(d);
    const b = getB(d);
    const bump = (reason) => {
      skipped[reason] = (skipped[reason] || 0) + 1;
      droppedByBranch[branch] = (droppedByBranch[branch] || 0) + 1;
    };
    if (!a || !b) { bump('missing-arm'); continue; }
    const wa = weightFor({ ...d, piOurs: a }, { weightCap });
    const wb = weightFor({ ...d, piOurs: b }, { weightCap });
    if (!wa.ok) { bump(`base:${wa.reason}`); continue; }
    if (!wb.ok) { bump(`test:${wb.reason}`); continue; }

    rows.push({
      branch,
      cell: cellKeyOf(d),
      wA: wa.w,
      wB: wb.w,
      net: wa.net,
      playerId: d.playerId,
    });
  }

  const refuse = (code, detail) => ({
    schemaVersion: CHANGE_LEDGER_SCHEMA_VERSION,
    available: false,
    refusal: { code, detail },
    baseArm: baseArm ?? baseLabel, testArm: testArm ?? testLabel,
    n: rows.length,
    skipped,
    // The partition census survives a refusal — it is the diagnosis, not decoration.
    partition: { axes: [...BRANCH_AXES], branchCount: 0, keyCompleteness },
    net: null, gross: null, redistributionRatio: null, netShareOfGross: null,
    branches: [], cells: { available: false, reason: 'ledger refused' },
  });

  if (rows.length === 0) {
    return refuse(LEDGER_REFUSALS.NO_SCORABLE_DECISIONS,
      'No decision was scorable under BOTH arms, so there is nothing to decompose. A NET '
      + 'computed over an empty paired set is vacuous and must not be published.');
  }

  let WA = 0; let WB = 0;
  for (const r of rows) { WA += r.wA; WB += r.wB; }
  if (!(WA > 0) || !(WB > 0)) {
    return refuse(LEDGER_REFUSALS.DEGENERATE_WEIGHTS,
      `Total importance weight is zero on one arm (base ${WA}, test ${WB}). The self-normalized `
      + 'value is undefined there, so neither the headline nor its decomposition exists.');
  }

  // PASS 2 — the per-decision contribution at the GLOBAL normalizers. See the header for
  // why these normalizers and not the branch's own.
  const byBranch = new Map();
  const byCell = new Map();
  let net = 0;

  const bucketOf = (map, key) => {
    let bk = map.get(key);
    if (!bk) {
      bk = { key, n: 0, discordantN: 0, players: new Set(), delta: 0, rows: [] };
      map.set(key, bk);
    }
    return bk;
  };

  for (const r of rows) {
    const c = (r.wB * r.net) / WB - (r.wA * r.net) / WA;
    net += c;
    const discordant = Math.abs(r.wA - r.wB) > DISCORDANCE_EPSILON;
    for (const [map, key] of [[byBranch, r.branch], [byCell, r.cell]]) {
      const bk = bucketOf(map, key);
      bk.n++;
      if (discordant) bk.discordantN++;
      bk.players.add(r.playerId);
      bk.delta += c;
      bk.rows.push(r);
    }
  }

  // The identity, checked against the estimator's own arithmetic before anything is
  // reported. `stat` here is byte-for-byte `pairedDelta`'s statistic.
  const vA = wisValue(rows.map((r) => ({ w: r.wA, net: r.net })));
  const vB = wisValue(rows.map((r) => ({ w: r.wB, net: r.net })));
  const direct = (vA !== null && vB !== null) ? vB - vA : null;
  const internalDrift = direct === null ? null : Math.abs(net - direct);

  const scale = opportunitiesPerHand === null || opportunitiesPerHand === undefined
    ? null
    : opportunitiesPerHand * 100;

  const rowFor = (bk, gate) => {
    const clusters = bk.players.size;
    let refusal = null;
    if (bk.n === 0) {
      refusal = { class: REFUSAL_CLASSES.UNEXAMINED, code: REFUSAL_CODES.NO_PAIRED_DECISIONS,
        detail: 'no decision in this branch was scorable under both arms' };
    } else if (bk.discordantN === 0) {
      // A MEASURED ZERO, not an absence. The two arms assigned identical weights to every
      // decision here, so the branch's contribution is exactly zero and that is a finding:
      // the change did not reach this branch. Filed `observed-zero` precisely so it cannot
      // be read as `unexamined`.
      refusal = { class: REFUSAL_CLASSES.OBSERVED_ZERO, code: REFUSAL_CODES.ARMS_AGREE_EVERYWHERE,
        detail: `all ${bk.n} decisions carry identical weights on both arms; the contribution is a measured zero` };
    } else if (gate && bk.discordantN < gate.minDiscordant) {
      refusal = { class: REFUSAL_CLASSES.UNEXAMINED, code: REFUSAL_CODES.BELOW_DISCORDANCE_BAR,
        detail: `${bk.discordantN} discordant decision(s) is below the ${gate.minDiscordant} bar` };
    } else if (gate && clusters < gate.minClusters) {
      refusal = { class: REFUSAL_CLASSES.UNEXAMINED, code: REFUSAL_CODES.BELOW_CLUSTER_BAR,
        detail: `${clusters} contributing player(s) is below the ${gate.minClusters}-cluster bar` };
    }

    // The branch's OWN paired WIS delta — the spec's `deltaBB_b`. Interpretable, and it
    // does NOT sum to NET. Labelled on the row so the two cannot be confused.
    const lA = wisValue(bk.rows.map((r) => ({ w: r.wA, net: r.net })));
    const lB = wisValue(bk.rows.map((r) => ({ w: r.wB, net: r.net })));

    return {
      key: bk.key,
      parts: bk.key.split('|'),
      // Δ_b — the contribution. Sums to NET, always, refused or not.
      deltaBB: round4(bk.delta),
      deltaBB100: scale === null ? null : round4(bk.delta * scale),
      absDeltaBB: round4(Math.abs(bk.delta)),
      shareOfGross: null, // filled once GROSS is known
      // deltaBB_b — the DIAGNOSTIC. Does not sum. See the header.
      localDeltaBB: (lA !== null && lB !== null) ? round4(lB - lA) : null,
      localDeltaIsDiagnostic: true,
      n: bk.n,
      discordantN: bk.discordantN,
      players: bk.players.size,
      droppedN: droppedByBranch[bk.key] ?? 0,
      quotable: refusal === null,
      refusal,
    };
  };

  const gate = cellGate && Number.isFinite(cellGate.minDiscordant) && Number.isFinite(cellGate.minClusters)
    ? cellGate
    : null;

  // GROSS IS ACCUMULATED FROM THE EXACT CONTRIBUTIONS, NOT FROM THE ROUNDED ROW VALUES.
  // The rows round `Δ_b` to 4dp for display; summing that column gives a number that is off
  // by up to half a unit in the last place per branch, and NET does not have that error
  // because it comes from the unrounded sum. Two totals that must be read against each other
  // have to be computed on the same footing, or `GROSS/|NET|` acquires a bias that grows with
  // branch count — worst exactly where the partition is finest and the ratio matters most.
  let gross = 0;
  for (const bk of byBranch.values()) gross += Math.abs(bk.delta);

  const branches = [...byBranch.values()]
    .map((bk) => {
      const row = rowFor(bk, gate);
      row.shareOfGross = gross > 0 ? round4(Math.abs(bk.delta) / gross) : null;
      return row;
    })
    .sort((x, y) => Math.abs(y.deltaBB ?? 0) - Math.abs(x.deltaBB ?? 0));

  const netR = round4(net);
  const grossR = round4(gross);

  // THE DETECTOR. `GROSS/|NET|` is what §9.3 asks for and it is unbounded by design — a
  // ratio in the hundreds is the instrument working, not overflowing. It is undefined at
  // NET exactly 0, which is the MOST extreme redistribution reachable and must not print as
  // an absent measurement, so `netShareOfGross` (its bounded reciprocal, 0 at total
  // cancellation and 1 at pure one-way movement) is reported beside it and is always
  // defined. Two spellings of one quantity, so the zero case has a number.
  const redistributionRatio = Math.abs(net) > 0 && gross > 0 ? Number((gross / Math.abs(net)).toFixed(2)) : null;
  const netShareOfGross = gross > 0 ? round4(Math.abs(net) / gross) : null;

  const identity = {
    headlineDeltaBB: headlineDeltaBB === undefined ? null : headlineDeltaBB,
    netBB: netR,
    // The float check against the estimator's own statistic, always run.
    internalDriftBB: internalDrift === null ? null : Number(internalDrift.toExponential(3)),
    internalAgrees: internalDrift !== null && internalDrift < IDENTITY_EPSILON,
    // The check against the producer's published headline, run only when one was supplied.
    checkedAgainstHeadline: headlineDeltaBB !== undefined && headlineDeltaBB !== null,
    agrees: null,
    tolerance: IDENTITY_EPSILON,
  };
  if (identity.checkedAgainstHeadline) {
    identity.agrees = identity.internalAgrees && netR === round4(headlineDeltaBB);
  } else {
    identity.agrees = identity.internalAgrees;
  }

  if (!identity.agrees) {
    // NOT a warning. If NET does not reproduce the headline, the two are over different
    // decision sets and every branch row is a decomposition of a different number than the
    // one printed above it — which is worse than having no ledger.
    return {
      ...refuse(LEDGER_REFUSALS.IDENTITY_VIOLATED,
        `NET ${netR} does not equal the headline ${headlineDeltaBB ?? '—'} `
        + `(internal drift ${identity.internalDriftBB}). The ledger and the headline are not over `
        + 'the same decision set; neither may be published until they are.'),
      identity,
      n: rows.length,
    };
  }

  const cells = gate
    ? (() => {
      const all = [...byCell.values()].map((bk) => rowFor(bk, gate));
      const quotable = all.filter((c) => c.quotable)
        .sort((x, y) => Math.abs(y.deltaBB ?? 0) - Math.abs(x.deltaBB ?? 0));
      return {
        available: true,
        gate: { ...gate },
        totalCells: all.length,
        quotableCells: quotable.length,
        // RULE 7d's argument, applied here: the refused cells are COUNTED by reason rather
        // than deleted, so an empty cell table reads as "nothing cleared the bar" and not as
        // "nothing was there". The holes are the work queue.
        refusedByCode: all.filter((c) => !c.quotable).reduce((acc, c) => {
          acc[c.refusal.code] = (acc[c.refusal.code] || 0) + 1; return acc;
        }, {}),
        rows: quotable,
      };
    })()
    : {
      available: false,
      reason: 'no cell power gate was supplied. A bar this module invented would be a hidden '
        + 'editorial decision about what is worth attention (RULE 7d), so the audit level '
        + 'refuses rather than guesses. Pass {minClusters, minDiscordant}.',
    };

  return {
    schemaVersion: CHANGE_LEDGER_SCHEMA_VERSION,
    available: true,
    refusal: null,
    baseArm: baseArm ?? baseLabel,
    testArm: testArm ?? testLabel,
    n: rows.length,
    players: new Set(rows.map((r) => r.playerId)).size,
    discordantN: rows.reduce((s, r) => s + (Math.abs(r.wA - r.wB) > DISCORDANCE_EPSILON ? 1 : 0), 0),
    skipped,
    // ── the two totals, and NEITHER travels without the other ────────────────────────────
    net: { deltaBB: netR, deltaBB100: scale === null ? null : round4(net * scale) },
    gross: { deltaBB: grossR, deltaBB100: scale === null ? null : round4(gross * scale) },
    redistributionRatio,
    netShareOfGross,
    // WS-410 Stage 2: both factors of the bb/100-hands scaling, separately, never only the
    // product. Null carries its reason — an absent census is not an opportunity count of 1.
    scaling: {
      opportunitiesPerHand: opportunitiesPerHand ?? null,
      unavailableReason: opportunitiesPerHand === null || opportunitiesPerHand === undefined
        ? 'no opportunity census supplied; the bb/100-hands column is refused rather than '
          + 'derived from the scored subset (coverageCensus.attachOpportunityCount forbids it)'
        : null,
    },
    identity,
    partition: { axes: [...BRANCH_AXES], branchCount: branches.length, keyCompleteness },
    branches,
    cells,
  };
};

/**
 * THE PUBLISH GUARD. Returns the problems that must stop a NET from being published alone.
 *
 * Callers push these into their existing `resultCardProblems` channel — the one that already
 * means "this figure is not replicable and must not be quoted" and that already reaches the
 * rendered page. That is deliberate: a new refusal channel is a channel nobody reads.
 *
 * @param {Object|null} ledger  the output of `buildChangeLedger`
 * @param {Object} opts
 * @param {number|null} opts.netBB  the NET this producer is about to publish
 * @param {string} opts.field       the metrics key that carries it, so the message is actionable
 */
export const netPublishProblems = (ledger, { netBB = null, field = 'the headline delta' } = {}) => {
  if (netBB === null || netBB === undefined) return [];
  if (!ledger) {
    return [`${field} is a NET with no change ledger beside it. NET is never published without `
      + 'GROSS (VOCABULARY.md "Change ledger"): a NET near zero is indistinguishable from "nothing '
      + 'changed" and "large gains exactly cancelled large losses" until GROSS separates them.'];
  }
  if (ledger.available === false) {
    return [`${field} is a NET and its change ledger REFUSED (${ledger.refusal?.code}): `
      + `${ledger.refusal?.detail} Until the decomposition exists this figure must not be quoted.`];
  }
  if (ledger.gross?.deltaBB === null || ledger.gross?.deltaBB === undefined) {
    return [`${field} is a NET whose ledger produced no GROSS. Refusing the pair.`];
  }
  return [];
};

/**
 * THE CARD BLOCK. The ledger, projected onto the flat top-level keys a Result Card's
 * `metrics` declares (`metrics.hero-ev` v3 / `metrics.depth-ablation` v4).
 *
 * ONE COMPOSITION PATH, ON PURPOSE. Two producers emit this block and a third will; if each
 * hand-wrote the projection, `changeLedgerGrossBB` would eventually mean `gross.deltaBB` on
 * one card and something adjacent on another, and the two would be compared anyway because
 * the key name is identical. That is the second-comparison-path failure ADR-009 exists to
 * prevent, in miniature. `metricsProblems` names this function in its refusal text so the
 * next author is pointed here rather than at the keys.
 *
 * A NULL OR REFUSED LEDGER YIELDS ALL NULLS RATHER THAN AN OMITTED BLOCK. The keys are
 * declared `required: false`, so omission would also validate — but a card that simply lacks
 * the keys is indistinguishable from a card minted before v3 existed, while an explicit run
 * of nulls says "this run had a ledger slot and could not fill it". The producer-side guard
 * (`netPublishProblems`) is what stops that state from coexisting with a real headline; this
 * function's job is only to be honest about it.
 *
 * FLATTENED, NOT NESTED. The fault-register matchers are regexes over TOP-LEVEL metrics key
 * names (`faultRegister.js`), so a nested `changeLedger: {...}` object would be invisible to
 * every one of them — the exact reason `atoms-instrument` tolerates its one duplicate flat
 * scalar beside the structured shape.
 *
 * @param {Object|null} ledger  the output of `buildChangeLedger`
 */
export const changeLedgerMetricsFields = (ledger) => {
  const usable = ledger && ledger.available !== false;
  return {
    changeLedgerNetBB: usable ? ledger.net.deltaBB : null,
    changeLedgerGrossBB: usable ? ledger.gross.deltaBB : null,
    changeLedgerNetBB100: usable ? ledger.net.deltaBB100 : null,
    changeLedgerGrossBB100: usable ? ledger.gross.deltaBB100 : null,
    changeLedgerRedistributionRatio: usable ? ledger.redistributionRatio : null,
    changeLedgerNetShareOfGross: usable ? ledger.netShareOfGross : null,
    changeLedgerBranchCount: usable ? ledger.partition.branchCount : null,
    // The partition's own completeness, carried so a small GROSS cannot be read as "the change
    // did not redistribute" when it may mean "the axes that would have separated it were
    // unavailable and their rows pooled into one bucket". Copied, not referenced: a card is an
    // artifact and must not share mutable structure with the report object beside it.
    changeLedgerKeyCompleteness: usable
      ? Object.fromEntries(Object.entries(ledger.partition.keyCompleteness).map(([a, c]) => [a, { ...c }]))
      : null,
  };
};

const bb = (x) => (x === null || x === undefined ? '—' : Number(x).toFixed(4));
const pctOf = (x) => (x === null || x === undefined ? '—' : `${(x * 100).toFixed(1)}%`);

/**
 * Render the ledger. GROSS is printed on the SAME LINE as NET, not below it — a total that
 * has to be scrolled to is a total that gets quoted without its partner, which is the same
 * argument `renderPiers` makes for putting the PBR warning above the ceiling.
 */
export const renderChangeLedgerLines = (ledger) => {
  const L = [];
  L.push('  CHANGE LEDGER — WHERE did the change move money?  (WS-537 · spec §9)');
  L.push('  ' + '─'.repeat(90));
  if (!ledger) {
    L.push('    *** NO CHANGE LEDGER — a NET printed above has no GROSS beside it ***');
    L.push('');
    return L;
  }
  if (ledger.available === false) {
    L.push(`    *** REFUSED (${ledger.refusal?.code}) ***`);
    L.push(`    ${ledger.refusal?.detail}`);
    L.push('');
    return L;
  }

  L.push(`    NET ${bb(ledger.net.deltaBB).padStart(10)} bb      GROSS ${bb(ledger.gross.deltaBB).padStart(10)} bb`
    + `      GROSS/|NET| ${ledger.redistributionRatio === null ? '— (NET is exactly 0)' : ledger.redistributionRatio}`);
  L.push(`    |NET|/GROSS ${pctOf(ledger.netShareOfGross)}  — 100% means the change moved the tree ONE WAY;`);
  L.push('    near 0% means it REDISTRIBUTED and a small NET is a CANCELLATION, not an absence of effect.');
  if (ledger.scaling.unavailableReason) {
    L.push(`    bb/100 hands: not computed — ${ledger.scaling.unavailableReason}`);
  } else {
    L.push(`    × opportunitiesPerHand ${ledger.scaling.opportunitiesPerHand} × 100  →  `
      + `NET ${bb(ledger.net.deltaBB100)} · GROSS ${bb(ledger.gross.deltaBB100)} bb/100 hands`);
  }
  L.push(`    identity: NET === headline ${ledger.identity.agrees ? 'HOLDS' : '*** VIOLATED ***'}`
    + `  (drift ${ledger.identity.internalDriftBB}, tol ${ledger.identity.tolerance})`);
  L.push('');
  L.push(`    per BRANCH (${ledger.partition.axes.join(' × ')}) — ${ledger.partition.branchCount} branches`);
  L.push(`      ${'branch'.padEnd(34)} ${'Δ_b bb'.padStart(10)} ${'|Δ|/GROSS'.padStart(10)} ${'n'.padStart(6)} ${'disc'.padStart(6)} ${'plyr'.padStart(5)}  note`);
  for (const b of ledger.branches) {
    L.push(`      ${String(b.key).padEnd(34)} ${bb(b.deltaBB).padStart(10)} ${pctOf(b.shareOfGross).padStart(10)} `
      + `${String(b.n).padStart(6)} ${String(b.discordantN).padStart(6)} ${String(b.players).padStart(5)}  `
      + (b.quotable ? `local ${bb(b.localDeltaBB)} (diagnostic)` : `${b.refusal.class}: ${b.refusal.code}`));
  }
  // The refused rows are STILL IN THE TOTALS above. Stated, because a reader who assumes
  // otherwise will not be able to reconcile the column with GROSS.
  const refused = ledger.branches.filter((b) => !b.quotable).length;
  if (refused) {
    L.push(`      (${refused} branch row(s) refused for quotation — their Δ_b still enters NET and GROSS,`);
    L.push('       because removing them would break the sum identity and hide the offsetting mass.)');
  }
  for (const [axis, c] of Object.entries(ledger.partition.keyCompleteness)) {
    if (c.unknown) {
      L.push(`      ! axis "${axis}" was UNAVAILABLE on ${c.unknown} of ${c.known + c.unknown} rows — those`);
      L.push(`        rows key to "${UNKNOWN_AXIS}" in that position rather than being dropped or pooled.`);
    }
  }
  L.push('');
  if (ledger.cells.available) {
    L.push(`    per CELL (audit unit, power-gated at ≥${ledger.cells.gate.minDiscordant} discordant `
      + `and ≥${ledger.cells.gate.minClusters} players): ${ledger.cells.quotableCells} of `
      + `${ledger.cells.totalCells} cells clear the bar`);
    for (const c of ledger.cells.rows.slice(0, 10)) {
      L.push(`      ${String(c.key).slice(0, 60).padEnd(60)} ${bb(c.deltaBB).padStart(10)} bb  n=${c.n}`);
    }
    if (!ledger.cells.quotableCells) {
      L.push(`      none. Refused: ${JSON.stringify(ledger.cells.refusedByCode)} — an empty cell table`);
      L.push('      means nothing cleared the power bar, NOT that nothing was there.');
    }
  } else {
    L.push(`    per CELL: not produced — ${ledger.cells.reason}`);
  }
  L.push('');
  return L;
};
