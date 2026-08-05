/**
 * layerAttribution.js — which LAYER made two surfaces diverge, and by how much (WS-324).
 *
 * FSA decomposes divergence BY SITUATION: where in the game two surfaces differ. This module
 * adds the orthogonal decomposition — BY LAYER: which step of the reasoning made them differ.
 * Both decompose the same total. Together they answer "where and why" instead of "where".
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * `d` IS INJECTED. THIS MODULE NEVER CHOOSES ONE.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * FSA open question #2 — KL versus EV-difference, "decide in Phase 3, measure both" — is
 * unanswered, and ADR-009 guarantees exactly ONE comparison path exists. So `d` arrives as a
 * required argument with no default, exactly as `basis` does in `holdingKnowledge`: defaulting
 * it would settle an open question by accident and create the second comparison path the ADR
 * forbids. What this module adds is a DECOMPOSITION of whatever `d` yields, not a new `d`.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THREE INSTRUMENTS, AND THE HONEST LIMIT OF EACH. READ THIS BEFORE QUOTING A NUMBER.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * An atom records each layer's value AT THE INPUT IT ACTUALLY GOT. Feeding surface A's equity
 * function surface B's range is a NEW function evaluation that exists in no atom. That single
 * fact splits the problem in two, and pretending otherwise is how a decomposition that does not
 * sum silently gets quoted as if it did.
 *
 *   1. `localizeByLayer`   — EVALUATION-FREE. Compares A's and B's recorded layer values in each
 *                            layer's OWN space. Needs no layer functions and cannot invoke an
 *                            engine, because it never evaluates anything. Answers "where do the
 *                            stacks first separate, and by how much there".
 *                            **DOES NOT SUM TO THE TOTAL** — composition is not additive, and a
 *                            localization is not a decomposition. Stated in the return value as
 *                            `sumsToTotal: false` so a caller cannot assume otherwise.
 *
 *   2. `decomposeByLayerTelescoping` — evaluates hybrids along the ONE canonical layer order.
 *                            Sums to the total exactly. Path-dependent: whichever layer comes
 *                            first absorbs the interaction between layers.
 *
 *   3. `decomposeByLayerShapley`     — evaluates hybrids over ALL subsets. Sums to the total
 *                            exactly (Shapley efficiency) and is order-independent, so no layer
 *                            is credited for interaction merely by its position.
 *
 * (2) and (3) both need `layerFns`, which MUST be pinned to the atom set's recorded engine
 * commit and replayed from its stored seeds. That is not a weaker form of "the engine is not
 * invoked" — it is the thing that requirement was protecting: `decisionAtom.js` states the cost
 * asymmetry plainly, that by the time the question is asked the live engine has moved and a
 * re-run no longer reproduces the old number. A pinned replay does. The live engine does not.
 *
 * `attributionGap(telescoping, shapley)` is the finding, not the error term: it measures how
 * much interaction the canonical ordering was absorbing.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * ADMISSIBILITY, INHERITED RATHER THAN REINVENTED.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * From `scripts/backtest/geometryAblation.mjs`, which states both rules and the incidents that
 * produced them:
 *
 *   PAIRED, ON THE SAME DECISIONS. Every quantity is differenced PER DECISION and then averaged.
 *   Scoring arms on their own decision sets measures the decisions, not the arms.
 *
 *   NO SPAN NORMALISATION. `reporter.mjs:217` records that the first ablation divided deltas by
 *   `(none − full)` assuming full context was the ceiling; the data refuted it, the span went
 *   negative, and the fractions inverted. Raw deltas against an explicit reference, always.
 *
 *   A share whose paired 95% CI includes zero is reported `n.s.`, never as a small attribution.
 */

import { STACK_LAYERS, layerIndex } from './stack.js';
import { StandardOfRecordError } from './schemas.js';

/** Required-argument guard. Mirrors the `basis` discipline — no defaults for load-bearing inputs. */
const requireD = (d) => {
  if (typeof d !== 'function') {
    throw new StandardOfRecordError(
      'layerAttribution: `d` (the divergence measure) is required and has no default. FSA open '
      + 'question #2 — KL versus EV-difference — is undecided, and ADR-009 permits exactly one '
      + 'comparison path. Supplying a default here would settle that question by accident.',
    );
  }
};

const requireLayerFns = (layerFns, fnName) => {
  if (!layerFns || typeof layerFns !== 'object') {
    throw new StandardOfRecordError(
      `layerAttribution.${fnName}: \`layerFns\` is required. This instrument evaluates hybrid `
      + 'stacks, which no atom records. Pin them to the atom set manifest\'s engine commit and '
      + 'replay from its stored seeds — never bind the live engine, which has moved since. If '
      + 'you need an evaluation-free answer, use `localizeByLayer` instead.',
    );
  }
};

// ── paired statistics: one owner, so a CI rule cannot drift between call sites ──────────

export const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/**
 * Paired mean with a 95% CI. `admissible` is false when the interval straddles zero.
 *
 * Normal approximation, matching the bake-off's existing convention. n < 2 yields a null
 * interval and `admissible: false` — one observation is not evidence of a difference.
 */
export const pairedMeanCI = (xs) => {
  const n = xs.length;
  const m = mean(xs);
  if (n < 2) return { mean: m, n, sd: null, ci: null, admissible: false };
  const varr = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(varr);
  const half = 1.96 * (sd / Math.sqrt(n));
  const ci = [m - half, m + half];
  return { mean: m, n, sd, ci, admissible: ci[0] > 0 || ci[1] < 0 };
};

// ── shared plumbing ────────────────────────────────────────────────────────────────────

const emissionFor = (atom, layer) => (atom?.layers ?? []).find((e) => e?.layer === layer) ?? null;

const defaultOutputOf = (atom) => atom?.action ?? null;

/**
 * Pair two atom sets on `atomId`, keeping only decisions present in BOTH.
 *
 * Unpaired rows are COUNTED and returned, never dropped silently — an attribution computed over
 * a set that quietly shrank is measuring the shrinkage.
 */
export const pairAtoms = (atomsA, atomsB) => {
  const byId = new Map((atomsB ?? []).map((b) => [b.atomId, b]));
  const pairs = [];
  let unpairedA = 0;
  for (const a of atomsA ?? []) {
    const b = byId.get(a.atomId);
    if (b) { pairs.push([a, b]); byId.delete(a.atomId); } else { unpairedA += 1; }
  }
  return { pairs, unpairedA, unpairedB: byId.size };
};

/**
 * Keep only pairs where BOTH sides carry FULL intermediates for every layer under study.
 *
 * `decisionAtom.js` stores compressed summaries for every decision and full values for a
 * recorded fraction. Exact substitution needs the full value. Mixing an exact row and an
 * approximate row into one mean produces a number whose conditioning set cannot be stated, so
 * the two are separated here and the subset size is reported rather than inferred.
 */
export const exactPairsOnly = (pairs, layers) => {
  const isFull = (atom) => layers.every((l) => emissionFor(atom, l)?.valueKind === 'full');
  const exact = pairs.filter(([a, b]) => isFull(a) && isFull(b));
  return { exact, dropped: pairs.length - exact.length };
};

/** Layers actually declared by both atoms, in canonical order. */
const sharedLayers = (a, b) => STACK_LAYERS.filter(
  (l) => emissionFor(a, l) && emissionFor(b, l),
);

// ── 1. localization: evaluation-free ───────────────────────────────────────────────────

/**
 * Per-layer divergence in each layer's OWN space, from recorded values alone.
 *
 * @param {Function} dLayer - (valueA, valueB, layer) => number. Injected for the same reason `d`
 *   is: the right distance between two range vectors is not this module's to decide.
 * @returns {{sumsToTotal: false, layers: {...}, firstDivergentLayer: string|null, n}}
 *
 * `sumsToTotal` is literally `false` in the payload. A localization tells you WHERE the stacks
 * separate; it cannot tell you how much of the final divergence that separation accounts for,
 * because propagating a layer's error through the layers above it is exactly the evaluation
 * this instrument refuses to do. Encoding that in the return value stops the number being
 * quoted as a share.
 */
export const localizeByLayer = ({ atomsA, atomsB, dLayer, threshold = 0 } = {}) => {
  if (typeof dLayer !== 'function') {
    throw new StandardOfRecordError('layerAttribution.localizeByLayer: `dLayer` is required.');
  }
  const { pairs, unpairedA, unpairedB } = pairAtoms(atomsA, atomsB);

  const perLayer = {};
  for (const [a, b] of pairs) {
    for (const layer of sharedLayers(a, b)) {
      const v = dLayer(emissionFor(a, layer).value, emissionFor(b, layer).value, layer);
      if (Number.isFinite(v)) (perLayer[layer] ??= []).push(v);
    }
  }

  const layers = Object.fromEntries(
    Object.entries(perLayer).map(([layer, xs]) => [layer, { ...pairedMeanCI(xs), layer }]),
  );

  const firstDivergentLayer = STACK_LAYERS.find(
    (l) => layers[l] && layers[l].admissible && Math.abs(layers[l].mean) > threshold,
  ) ?? null;

  return Object.freeze({
    instrument: 'localization',
    sumsToTotal: false,
    evaluationFree: true,
    n: pairs.length,
    unpairedA,
    unpairedB,
    layers: Object.freeze(layers),
    firstDivergentLayer,
  });
};

// ── hybrid evaluation, used by both decompositions ─────────────────────────────────────

/**
 * Evaluate the hybrid stack that takes the layers in `subset` from B and the rest from A.
 *
 * Forward composition: each layer's function is applied to the PREVIOUS layer's hybrid output,
 * which is why this cannot come from recorded values — the input is new. `layerFns[layer].A`
 * and `.B` must be pinned; see the header.
 */
export const evaluateHybrid = ({ atomA, atomB, subset, layerFns, layers }) => {
  let carry = null;
  for (const layer of layers) {
    const side = subset.has(layer) ? 'B' : 'A';
    const fn = layerFns[layer]?.[side];
    if (typeof fn !== 'function') {
      throw new StandardOfRecordError(
        `layerAttribution: layerFns.${layer}.${side} is missing. Every layer under study needs a `
        + 'pinned function for BOTH surfaces; a hybrid with a hole in it is not evaluable.',
        { layer, side },
      );
    }
    carry = fn(carry, side === 'B' ? atomB : atomA, { layer, subset });
  }
  return carry;
};

/** v(S) per the header: divergence of the hybrid's output from A's own output. Anchored at v(∅)=0. */
const valueOfSubset = ({ atomA, atomB, subset, layerFns, layers, d, outputOf }) => {
  if (subset.size === 0) return 0;
  const hybridOut = evaluateHybrid({ atomA, atomB, subset, layerFns, layers });
  return d(outputOf(atomA), hybridOut);
};

// ── 2. telescoping decomposition ───────────────────────────────────────────────────────

/**
 * Add layers along the ONE canonical order; each layer's share is the successive difference.
 *
 * Sums to the total exactly by telescoping. Path-dependent by construction — that is the
 * property `attributionGap` measures against Shapley, not a defect to hide.
 */
export const decomposeByLayerTelescoping = ({
  atomsA, atomsB, d, layerFns, outputOf = defaultOutputOf, exactOnly = true,
} = {}) => {
  requireD(d);
  requireLayerFns(layerFns, 'decomposeByLayerTelescoping');

  const { pairs, unpairedA, unpairedB } = pairAtoms(atomsA, atomsB);
  const layers = pairs.length ? sharedLayers(pairs[0][0], pairs[0][1]) : [];
  const { exact, dropped } = exactOnly ? exactPairsOnly(pairs, layers) : { exact: pairs, dropped: 0 };

  const perLayer = Object.fromEntries(layers.map((l) => [l, []]));
  const totals = [];

  for (const [a, b] of exact) {
    const running = new Set();
    let previous = 0;
    for (const layer of layers) {
      running.add(layer);
      const v = valueOfSubset({
        atomA: a, atomB: b, subset: new Set(running), layerFns, layers, d, outputOf,
      });
      perLayer[layer].push(v - previous);
      previous = v;
    }
    totals.push(previous);
  }

  const shares = Object.fromEntries(
    layers.map((l) => [l, { ...pairedMeanCI(perLayer[l]), layer: l }]),
  );

  return Object.freeze({
    instrument: 'telescoping',
    sumsToTotal: true,
    evaluationFree: false,
    orderIndependent: false,
    n: exact.length,
    droppedNonExact: dropped,
    unpairedA,
    unpairedB,
    total: mean(totals),
    shares: Object.freeze(shares),
  });
};

// ── 3. Shapley decomposition ───────────────────────────────────────────────────────────

const factorial = (n) => { let f = 1; for (let i = 2; i <= n; i += 1) f *= i; return f; };

const countBits = (m) => { let c = 0; let x = m; while (x) { c += x & 1; x >>>= 1; } return c; };

/**
 * Shapley value per layer, computed over the subset lattice.
 *
 * Enumerating the 2^L subsets is equivalent to averaging over all L! orderings and far cheaper:
 * L is at most 5, so this is 32 evaluations per decision rather than 120 permutations. Sums to
 * the total exactly by the efficiency axiom, and is order-independent by construction.
 *
 * Note this is a genuine Shapley value, not the leave-one-out approximation in
 * `citedDecision/attribution.js` — that module's own header records that its contributions sum
 * only APPROXIMATELY, which would not satisfy the identity this decomposition has to hold.
 * Leave-one-out is right there because it runs at runtime over 2^n assumptions; this runs
 * offline over 5 layers.
 */
export const decomposeByLayerShapley = ({
  atomsA, atomsB, d, layerFns, outputOf = defaultOutputOf, exactOnly = true,
} = {}) => {
  requireD(d);
  requireLayerFns(layerFns, 'decomposeByLayerShapley');

  const { pairs, unpairedA, unpairedB } = pairAtoms(atomsA, atomsB);
  const layers = pairs.length ? sharedLayers(pairs[0][0], pairs[0][1]) : [];
  const L = layers.length;
  const { exact, dropped } = exactOnly ? exactPairsOnly(pairs, layers) : { exact: pairs, dropped: 0 };

  const perLayer = Object.fromEntries(layers.map((l) => [l, []]));
  const totals = [];

  for (const [a, b] of exact) {
    // Cache v(S) for all 2^L subsets, keyed by bitmask.
    const v = new Array(1 << L);
    for (let mask = 0; mask < (1 << L); mask += 1) {
      const subset = new Set(layers.filter((_, i) => mask & (1 << i)));
      v[mask] = valueOfSubset({ atomA: a, atomB: b, subset, layerFns, layers, d, outputOf });
    }

    layers.forEach((layer, i) => {
      let phi = 0;
      for (let mask = 0; mask < (1 << L); mask += 1) {
        if (mask & (1 << i)) continue;             // subsets NOT containing this layer
        const s = countBits(mask);
        const weight = (factorial(s) * factorial(L - s - 1)) / factorial(L);
        phi += weight * (v[mask | (1 << i)] - v[mask]);
      }
      perLayer[layer].push(phi);
    });

    totals.push(v[(1 << L) - 1]);
  }

  const shares = Object.fromEntries(
    layers.map((l) => [l, { ...pairedMeanCI(perLayer[l]), layer: l }]),
  );

  return Object.freeze({
    instrument: 'shapley',
    sumsToTotal: true,
    evaluationFree: false,
    orderIndependent: true,
    n: exact.length,
    droppedNonExact: dropped,
    unpairedA,
    unpairedB,
    total: mean(totals),
    shares: Object.freeze(shares),
  });
};

// ── by situation: FSA's decomposition, same total ──────────────────────────────────────

/**
 * Group the same paired divergence by `situationKey`.
 *
 * Weighted by each situation's share of decisions so the parts sum to the overall mean — the
 * identity `decompositionsAgree` asserts against the by-layer total.
 */
export const decomposeBySituation = ({
  atomsA, atomsB, d, outputOf = defaultOutputOf,
} = {}) => {
  requireD(d);
  const { pairs, unpairedA, unpairedB } = pairAtoms(atomsA, atomsB);

  const bySituation = new Map();
  const all = [];
  for (const [a, b] of pairs) {
    const key = a.situationKey;
    const value = d(outputOf(a), outputOf(b));
    if (!Number.isFinite(value)) continue;
    if (!bySituation.has(key)) bySituation.set(key, []);
    bySituation.get(key).push(value);
    all.push(value);
  }

  const N = all.length;
  const shares = Object.fromEntries(
    [...bySituation.entries()].map(([key, xs]) => [key, {
      situationKey: key,
      n: xs.length,
      weight: N ? xs.length / N : 0,
      meanWithin: mean(xs),
      // Share of the OVERALL mean, so shares sum to `total`.
      share: N ? (xs.length / N) * mean(xs) : 0,
    }]),
  );

  return Object.freeze({
    instrument: 'situation',
    sumsToTotal: true,
    n: N,
    unpairedA,
    unpairedB,
    total: mean(all),
    shares: Object.freeze(shares),
  });
};

// ── the identity, and the gap ──────────────────────────────────────────────────────────

const sumShares = (decomposition) => Object.values(decomposition.shares)
  .reduce((s, v) => s + (v.share ?? v.mean ?? 0), 0);

/**
 * Both decompositions must sum to the same total. Criterion #4, checked rather than asserted.
 *
 * Returns the numbers as well as the verdict so a failure is diagnosable instead of just false.
 */
export const decompositionsAgree = (byLayer, bySituation, tolerance = 1e-9) => {
  const layerSum = sumShares(byLayer);
  const situationSum = sumShares(bySituation);
  return {
    layerSum,
    situationSum,
    layerTotal: byLayer.total,
    situationTotal: bySituation.total,
    agree: Math.abs(layerSum - situationSum) <= tolerance
      && Math.abs(layerSum - byLayer.total) <= tolerance
      && Math.abs(situationSum - bySituation.total) <= tolerance,
  };
};

/**
 * How much interaction the canonical ordering absorbed.
 *
 * THE GAP IS THE FINDING, not an error term. A layer whose telescoping share is large and whose
 * Shapley share is small was being credited for interaction it merely stood in front of.
 */
export const attributionGap = (telescoping, shapley) => Object.freeze({
  perLayer: Object.freeze(Object.fromEntries(
    Object.keys(shapley.shares).map((l) => [l, {
      layer: l,
      telescoping: telescoping.shares[l]?.mean ?? null,
      shapley: shapley.shares[l]?.mean ?? null,
      gap: (telescoping.shares[l]?.mean ?? 0) - (shapley.shares[l]?.mean ?? 0),
    }]),
  )),
  totalTelescoping: telescoping.total,
  totalShapley: shapley.total,
  // Both sum to the same total, so the gaps must cancel. A non-zero sum is a bug, not a finding.
  totalsMatch: Math.abs(telescoping.total - shapley.total) <= 1e-9,
});

/** The first layer carrying an admissible non-trivial share. The measured half of divergence. */
export const firstMeasuredDivergence = (decomposition, threshold = 0) => STACK_LAYERS.find((l) => {
  const s = decomposition.shares?.[l];
  return s && s.admissible && Math.abs(s.mean) > threshold;
}) ?? null;

/**
 * A layer's share of the total, as a FRACTION — but only from an instrument that sums (WS-350).
 *
 * `localizeByLayer` returns `sumsToTotal: false` in its payload precisely so a caller cannot
 * read its per-layer numbers as shares of anything. Honouring that has to be mechanical, so this
 * throws on a non-summing decomposition rather than dividing two numbers that are not in the
 * same space. A localization's `range` figure is in range-width units and its `action` figure is
 * in nats; their ratio is not a share, it is a category error with a decimal point.
 */
export const shareOfTotal = (decomposition, layer) => {
  if (decomposition?.sumsToTotal !== true) {
    throw new StandardOfRecordError(
      `layerAttribution.shareOfTotal: instrument "${decomposition?.instrument}" reports `
      + 'sumsToTotal: false, so its per-layer numbers are not shares of the total and dividing '
      + 'them by it would invent one. Use decomposeByLayerTelescoping or decomposeByLayerShapley, '
      + 'which require pinned layer functions and actually sum.',
      { instrument: decomposition?.instrument, layer },
    );
  }
  const s = decomposition.shares?.[layer];
  if (!s) return null;
  const total = decomposition.total;
  if (!Number.isFinite(total) || total === 0) return null;
  return (s.share ?? s.mean ?? 0) / total;
};

/**
 * WS-350 AC4, in one object: WHICH layer, and HOW MUCH of the divergence it accounts for.
 *
 * The two halves come from different instruments on purpose, and the payload keeps them apart:
 *
 *   `structuralLayer`  from `stack.firstStructuralDivergence` — one surface has an equity layer
 *                      and the other does not. Needs no measurement and no `d`.
 *   `localizedLayer`   from `localizeByLayer` — the first layer whose RECORDED values differ
 *                      admissibly. Evaluation-free, and therefore carries NO share.
 *   `measuredLayer`    from a SUMMING decomposition — the first layer with an admissible share,
 *                      WITH that share. Requires pinned layer functions.
 *
 * A structural separation is upstream of any measured one: if the two surfaces do not even have
 * the same layers, the first place they differ is where a layer is missing, and no quantity is
 * needed to know it. So `firstLayer` prefers structural, then localized, then measured — and
 * `firstLayerFrom` names which instrument answered, because "we could not measure it" and "there
 * was nothing to measure" must not read the same.
 */
export const attributeFirstLayer = ({
  structuralDivergence = null,
  localization = null,
  decomposition = null,
  threshold = 0,
} = {}) => {
  const localizedLayer = localization
    ? (localization.firstDivergentLayer ?? null)
    : null;
  const measuredLayer = decomposition
    ? firstMeasuredDivergence(decomposition, threshold)
    : null;

  let firstLayer = null;
  let firstLayerFrom = null;
  if (structuralDivergence) { firstLayer = structuralDivergence; firstLayerFrom = 'structural'; }
  else if (localizedLayer) { firstLayer = localizedLayer; firstLayerFrom = 'localization'; }
  else if (measuredLayer) { firstLayer = measuredLayer; firstLayerFrom = 'decomposition'; }

  const share = (decomposition && measuredLayer)
    ? shareOfTotal(decomposition, measuredLayer)
    : null;

  return Object.freeze({
    firstLayer,
    firstLayerFrom,
    structuralLayer: structuralDivergence,
    localizedLayer,
    measuredLayer,
    // NULL when no summing instrument was available. Explicitly not "0" and not "unknown share
    // of a known layer" — a share needs a decomposition that sums, and saying so is the whole
    // reason `localizeByLayer` carries `sumsToTotal: false`.
    shareOfTotal: share,
    shareInstrument: decomposition?.instrument ?? null,
    shareAvailable: share !== null,
    shareUnavailableReason: share === null
      ? 'no summing decomposition was supplied — a share requires layer functions PINNED to the '
        + 'atom set\'s engine commit and replayed from its seeds, which an evaluation-free '
        + 'localization deliberately does not have'
      : null,
  });
};

export { layerIndex };
