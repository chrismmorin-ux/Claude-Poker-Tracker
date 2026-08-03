/**
 * layerProbes.js — score ONE layer against its own ground truth, independently (WS-324).
 *
 * `stack.js` declares what a surface is made of. This module is what makes the declaration
 * pay: each layer with a truth source in `LAYER_GROUND_TRUTH` gets a probe that scores THAT
 * LAYER ALONE, without reference to whether the recommendation downstream of it was any good.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY LAYER-LOCAL SCORING IS THE WHOLE POINT.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * WS-291 was a falsified range model on the live recommendation path that survived unmeasured
 * for the life of the project. Its symptoms were at layer 5 (bad advice); its fault was at
 * layer 1 (range). Scoring only the composition cannot separate those — a good action can be
 * reached through a wrong range, and a bad action can be reached through a right one. Only a
 * probe that ignores everything downstream can say "the range itself is wrong".
 *
 * `scripts/backtest/rangeCalibrationProbe.mjs` is the existing worked example of exactly this
 * for the range layer. This module generalises it to the other three and moves the shape
 * inside `src/` so the app can ask the question, not only a script.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE REFUSALS ARE THE LOAD-BEARING PART.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Every probe can decline, and every declination says WHY. This follows `holdingTruth`'s
 * convention exactly: a caller must never be able to mistake "we refuse to answer" for
 * "nothing was shown", because those average differently and one of them is a category error.
 *
 *   `hypothesized`     the layer was produced down a counterfactual branch. Scoring it against
 *                      what actually happened measures a road not travelled. This is the
 *                      holdingKnowledge rule (WS-292), inherited rather than re-derived.
 *   `no-ground-truth`  the layer has no truth source AT ALL — `LAYER_GROUND_TRUTH.action` is
 *                      null. Distinct from "not yet wired": no future plumbing makes an action
 *                      distribution scoreable against itself.
 *   `not-revealed`     truth exists for this layer in principle, but not for this decision.
 *   `unscoreable`      a data problem (card collision, empty range), not a model result.
 *                      Averaging it in as a zero would understate the model.
 *   `missing-value`    the layer emitted nothing to score.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE DOES NOT DO.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * It does not compare two surfaces, and it does not attribute divergence to a layer — that is
 * `layerAttribution.js`, and it needs a divergence measure `d` this module never touches. A
 * probe answers "is this layer right?", not "which layer explains the difference between these
 * two?". Keeping them apart is what stops a probe score being quietly reused as an attribution.
 *
 * It also does not FIT anything. `holdingKnowledge/CLAUDE.md` is explicit that choosing a
 * per-player width by reading a calibration table is precisely what WS-291 and WS-303 had to
 * undo — a constant picked by taste where a measurement belonged. Probes measure; sweeps fit.
 */

import { brierScore, logLoss } from '../exploitEngine/calibrationMetrics';
import { scoreCoverage } from '../holdingKnowledge/coverage';
import { isPurelyObserved } from '../holdingKnowledge/provenance';
import { LAYER_GROUND_TRUTH, isStackLayer, STACK_LAYERS } from './stack.js';

/** Why a probe declined. Named, because an unexplained null is indistinguishable from a zero. */
export const PROBE_REFUSALS = Object.freeze({
  HYPOTHESIZED: 'hypothesized',
  NO_GROUND_TRUTH: 'no-ground-truth',
  NOT_REVEALED: 'not-revealed',
  UNSCOREABLE: 'unscoreable',
  MISSING_VALUE: 'missing-value',
});

const refuse = (layer, reason, detail = {}) => Object.freeze({
  refused: true, layer, reason, ...detail,
});

const scored = (layer, fields) => Object.freeze({ refused: false, layer, ...fields });

/** The emission for one layer of an atom, or null. */
export const emissionFor = (atom, layer) => (
  (atom?.layers ?? []).find((e) => e?.layer === layer) ?? null
);

/**
 * The single place the hypothesized refusal is decided.
 *
 * Two independent routes to the same category error, and both must close:
 *   - the ATOM's truth was recorded against a hypothesized branch (`decisionAtom.buildAtomTruth`);
 *   - the LAYER's own provenance went through a hypothesized narrowing (`holdingKnowledge`).
 *
 * A probe that checked only one would refuse the obvious case and silently score the subtle one.
 */
export const hypothesizedRefusal = (atom, emission) => {
  if (atom?.truth?.basis === 'hypothesized') return true;
  const prov = emission?.provenance;
  if (prov && typeof prov.hypothesizedNarrowings === 'number' && !isPurelyObserved(prov)) return true;
  return false;
};

/** Shared preamble every probe runs before it looks at a value. */
const gate = (atom, layer) => {
  if (!isStackLayer(layer)) {
    return refuse(layer, PROBE_REFUSALS.MISSING_VALUE, { detail: `unknown layer "${layer}"` });
  }
  if (LAYER_GROUND_TRUTH[layer] === null) {
    return refuse(layer, PROBE_REFUSALS.NO_GROUND_TRUTH, {
      detail: `no ground truth exists for the "${layer}" layer — this is a permanent property `
        + 'of the layer, not a wiring gap.',
    });
  }
  const emission = emissionFor(atom, layer);
  if (!emission) return refuse(layer, PROBE_REFUSALS.MISSING_VALUE, { detail: 'layer emitted nothing' });
  if (hypothesizedRefusal(atom, emission)) return refuse(layer, PROBE_REFUSALS.HYPOTHESIZED);
  return { emission };
};

/**
 * RANGE — believed range vs the hand actually held.
 *
 * Delegates the scoring itself to `holdingKnowledge/coverage.scoreCoverage`, which owns this
 * join for the repo. Re-deriving it here would be a second chance to disagree about what
 * "covered" means, which is the failure `decisionGeometry.mjs` exists to prevent one scale down.
 *
 * THE SIGNAL IS `logLift`, NOT `covered`. Per `holdingKnowledge/CLAUDE.md`: on the engine as it
 * ships, `covered` is always true — WS-302's priors seed every cell and WS-291's floor keeps
 * survivors positive — so it discriminates nothing. It is reported because it is the metric
 * that matters the instant anyone reintroduces a hard cut, not because it is informative today.
 *
 * @param {Object} atom
 * @param {Object} [accessors] - DI, per the repo's utils convention. The board is not a declared
 *   atom field, so the way to reach it is stated rather than assumed.
 */
export const probeRange = (atom, {
  boardOf = (a) => a?.carried?.board ?? null,
  deadCardsOf = (a) => a?.carried?.deadCards ?? [],
} = {}) => {
  const g = gate(atom, 'range');
  if (g.refused) return g;

  const revealed = atom?.truth?.revealed ?? null;
  if (!revealed) return refuse('range', PROBE_REFUSALS.NOT_REVEALED);

  const range = g.emission.value;
  if (!range) return refuse('range', PROBE_REFUSALS.MISSING_VALUE, { detail: 'no range vector' });

  const s = scoreCoverage(range, boardOf(atom), revealed, deadCardsOf(atom));
  if (!s) return refuse('range', PROBE_REFUSALS.UNSCOREABLE);

  return scored('range', {
    groundTruth: LAYER_GROUND_TRUTH.range,
    signal: s.logLift,
    logLift: s.logLift,
    covered: s.covered,
    weightOfTruth: s.weightOfTruth,
    uniformWeight: s.uniformWeight,
    retainedFraction: s.retainedFraction,
    liveCombos: s.liveCombos,
  });
};

/**
 * A scalar probability scored against a binary realization.
 *
 * Reuses `calibrationMetrics.brierScore`/`logLoss` by lifting the scalar into the two-outcome
 * distribution those functions take. The lift is deliberate: it keeps `LOG_LOSS_FLOOR` owned by
 * one module, so a clamp change lands everywhere at once instead of in three places that drift.
 */
const scoreBinary = (p, happened, { positive, negative }) => {
  const dist = { [positive]: p, [negative]: 1 - p };
  const actual = happened ? positive : negative;
  return {
    predicted: p,
    realized: happened ? 1 : 0,
    brier: brierScore(dist, actual),
    logLoss: logLoss(dist, actual),
  };
};

/**
 * EQUITY — predicted equity vs what the showdown actually returned.
 *
 * A chop is 0.5, which is why the realization is read as a number rather than a boolean: a
 * split pot is genuinely half a win and rounding it either way biases the layer's score.
 */
export const probeEquity = (atom, {
  showdownResultOf = (a) => a?.outcome?.showdownResult ?? null,
} = {}) => {
  const g = gate(atom, 'equity');
  if (g.refused) return g;

  const predicted = g.emission.value;
  if (!Number.isFinite(predicted)) {
    return refuse('equity', PROBE_REFUSALS.MISSING_VALUE, { detail: 'equity is not a finite number' });
  }
  const realized = showdownResultOf(atom);
  if (!Number.isFinite(realized)) return refuse('equity', PROBE_REFUSALS.NOT_REVEALED);
  if (realized < 0 || realized > 1) {
    return refuse('equity', PROBE_REFUSALS.UNSCOREABLE, {
      detail: `showdownResult must be in [0,1] (0 loss, 0.5 chop, 1 win), got ${realized}`,
    });
  }

  // Brier against a fractional realization is the squared error directly; the binary lift
  // would misread a chop as a wrong call rather than as a half-win.
  const error = predicted - realized;
  return scored('equity', {
    groundTruth: LAYER_GROUND_TRUTH.equity,
    signal: -(error ** 2),
    predicted,
    realized,
    error,
    brier: error ** 2,
  });
};

/**
 * FOLD PROBABILITY — predicted P(fold) vs whether the seat actually folded.
 *
 * Genuinely binary, unlike equity, so it takes the log-loss lift. Log-loss is the right primary
 * here for the reason `calibrationMetrics` gives: it punishes confident wrongness sharply, and a
 * confidently wrong fold estimate is the one that actually costs money downstream in the EV layer.
 */
export const probeFoldProbability = (atom, {
  foldedOf = (a) => a?.outcome?.folded ?? null,
} = {}) => {
  const g = gate(atom, 'foldProbability');
  if (g.refused) return g;

  const predicted = g.emission.value;
  if (!Number.isFinite(predicted) || predicted < 0 || predicted > 1) {
    return refuse('foldProbability', PROBE_REFUSALS.MISSING_VALUE, {
      detail: 'foldProbability must be a finite number in [0,1]',
    });
  }
  const folded = foldedOf(atom);
  if (typeof folded !== 'boolean') return refuse('foldProbability', PROBE_REFUSALS.NOT_REVEALED);

  const s = scoreBinary(predicted, folded, { positive: 'fold', negative: 'continue' });
  return scored('foldProbability', {
    groundTruth: LAYER_GROUND_TRUTH.foldProbability,
    signal: -s.logLoss,
    ...s,
  });
};

/**
 * EV — predicted EV vs the chips actually realized.
 *
 * READ THIS BEFORE USING THE NUMBER. An EV is an EXPECTATION and a realization is ONE DRAW from
 * a distribution whose variance dwarfs the mean at any realistic n. So the accuracy of a single
 * row says nothing, and `meanError` across many rows is a BIAS test, not an accuracy test.
 * `meanAbsError` is reported alongside but must not be read as "how wrong the EV layer is" — most
 * of it is variance that no correct model could remove. This is the same caution
 * `holdingKnowledge/CLAUDE.md` applies to per-player fits off small n.
 */
export const probeEv = (atom, {
  realizedChipsOf = (a) => a?.outcome?.realizedChips ?? null,
} = {}) => {
  const g = gate(atom, 'ev');
  if (g.refused) return g;

  const predicted = g.emission.value;
  if (!Number.isFinite(predicted)) {
    return refuse('ev', PROBE_REFUSALS.MISSING_VALUE, { detail: 'ev is not a finite number' });
  }
  const realized = realizedChipsOf(atom);
  if (!Number.isFinite(realized)) return refuse('ev', PROBE_REFUSALS.NOT_REVEALED);

  const error = predicted - realized;
  return scored('ev', {
    groundTruth: LAYER_GROUND_TRUTH.ev,
    signal: -Math.abs(error),
    predicted,
    realized,
    error,
  });
};

/**
 * ACTION — always refuses.
 *
 * Present rather than absent on purpose. A missing probe reads as "not built yet"; an explicit
 * refusal reads as "there is nothing here to build", which is the true statement.
 */
export const probeAction = (atom) => refuse('action', PROBE_REFUSALS.NO_GROUND_TRUTH, {
  detail: 'an action distribution has no ground truth to be scored against — it IS the output.',
});

/** The probe for each layer, by name. */
export const LAYER_PROBES = Object.freeze({
  range: probeRange,
  equity: probeEquity,
  foldProbability: probeFoldProbability,
  ev: probeEv,
  action: probeAction,
});

/** Layers that can actually be probed — the four with a truth source. */
export const PROBEABLE_LAYERS = Object.freeze(
  STACK_LAYERS.filter((l) => LAYER_GROUND_TRUTH[l] !== null),
);

/** Score one atom's layer with the right probe. */
export const probeAtomLayer = (atom, layer, accessors = {}) => {
  const probe = LAYER_PROBES[layer];
  if (!probe) return refuse(layer, PROBE_REFUSALS.MISSING_VALUE, { detail: `no probe for "${layer}"` });
  return probe(atom, accessors);
};

const meanOf = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/**
 * Score one layer across many atoms.
 *
 * REFUSALS ARE COUNTED BY REASON, NEVER DROPPED. `analyze_records.py` §0 and the `skipReason`
 * field both make the same point: a skip is data. An aggregate that reported only `n` scored
 * would hide the difference between a layer nobody can measure and a layer that measures well —
 * and those have opposite implications for whether the surface should be trusted.
 *
 * @returns {{layer, groundTruth, n, refusedCount, refusals, meanSignal, rows}}
 */
export const probeLayerOverAtoms = ({ layer, atoms = [], accessors = {} } = {}) => {
  const rows = [];
  const refusals = {};
  let refusedCount = 0;

  for (const atom of atoms) {
    const r = probeAtomLayer(atom, layer, accessors);
    if (r.refused) {
      refusedCount += 1;
      refusals[r.reason] = (refusals[r.reason] ?? 0) + 1;
    } else {
      rows.push(r);
    }
  }

  const signals = rows.map((r) => r.signal).filter(Number.isFinite);
  return Object.freeze({
    layer,
    groundTruth: LAYER_GROUND_TRUTH[layer] ?? null,
    n: rows.length,
    refusedCount,
    refusals: Object.freeze({ ...refusals }),
    meanSignal: meanOf(signals),
    rows: Object.freeze(rows),
  });
};

/**
 * Run every probeable layer over the same atoms.
 *
 * ON THE SAME ATOMS is the discipline `geometryAblation.mjs` states and the fallback-level table
 * in `calibrationMetrics` is the recorded example of violating: scoring each layer on whatever
 * subset it happens to cover measures the subsets, not the layers.
 */
export const probeAllLayers = ({ atoms = [], accessors = {} } = {}) => Object.freeze(
  Object.fromEntries(
    PROBEABLE_LAYERS.map((layer) => [layer, probeLayerOverAtoms({ layer, atoms, accessors })]),
  ),
);
