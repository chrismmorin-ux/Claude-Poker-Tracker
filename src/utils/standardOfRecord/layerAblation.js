/**
 * layerAblation.js — "what if layer 3 had been correct?", answered from stored atoms (WS-324).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS MODULE IS TINY, AND WHY ITS IMPORT LIST IS TESTED.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * `decisionAtom.js` states the cost asymmetry this whole apparatus exists for: capturing a
 * field costs bytes, NOT capturing it costs a re-run — and by then the engine has moved, so the
 * re-run does not reproduce the old number and the comparison being attempted is lost entirely.
 * The loss is total, not partial.
 *
 * An ablation that reached for the live engine would walk straight into that. So this module
 * imports ONLY from its own directory — `./stack.js`, `./decisionAtom.js`, `./schemas.js` — and
 * `__tests__/layerAblation.test.js` asserts that import list by reading this file. A comment
 * saying "does not touch the engine" is a promise; a test that reads the imports is a fact.
 * Same argument as `scripts/backtest/decisionGeometry.mjs` being "small on purpose, and shared
 * on purpose", one scale up.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT SUBSTITUTION CAN AND CANNOT ANSWER WITHOUT EVALUATING ANYTHING.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * CAN: replace a layer's recorded value and read what the atom then says about THAT LAYER.
 *      Every value involved is recorded, so nothing is computed and nothing can drift.
 *
 * CANNOT: propagate that replacement to the action distribution. Layer 4 was evaluated at
 *      layer 3's ORIGINAL output; its value at the substituted input exists in no atom. Getting
 *      it requires evaluating layer 4 — which is `layerAttribution.js`'s pinned-replay path, and
 *      is deliberately not here.
 *
 * `substitutionReach` returns exactly which layers a given substitution can and cannot speak to,
 * so a caller asking a question this module cannot answer is TOLD, rather than handed a number
 * that quietly stopped being about the substitution two layers ago.
 */

import { STACK_LAYERS, layerIndex, isStackLayer } from './stack.js';
import { buildLayerEmission, VALUE_KINDS } from './decisionAtom.js';
import { StandardOfRecordError } from './schemas.js';

/** The emission for one layer, or null. */
export const emissionFor = (atom, layer) => (
  (atom?.layers ?? []).find((e) => e?.layer === layer) ?? null
);

/**
 * Replace ONE layer's value, returning a new atom. Never mutates — same rule as `holdingKnowledge`
 * handles, and for the same reason: an ablation that edited its input in place would corrupt the
 * baseline it is being compared against.
 *
 * The substituted emission is stamped `substituted: true` with its origin. An ablated atom that
 * looked identical to a recorded one is the kind of thing that gets written to disk once and
 * then quoted forever as a measurement.
 */
export const substituteLayer = (atom, layer, value, {
  valueKind = 'full', origin = 'ablation', assumptions = null,
} = {}) => {
  if (!isStackLayer(layer)) {
    throw new StandardOfRecordError(`layerAblation: unknown layer "${layer}"`, { layer });
  }
  if (!VALUE_KINDS.includes(valueKind)) {
    throw new StandardOfRecordError(
      `layerAblation: valueKind must be ${VALUE_KINDS.join(' | ')}, got "${valueKind}"`,
      { layer, valueKind },
    );
  }
  const existing = emissionFor(atom, layer);
  if (!existing) {
    throw new StandardOfRecordError(
      `layerAblation: atom does not declare layer "${layer}", so there is nothing to substitute. `
      + 'Substituting into an undeclared layer would invent a stack the surface never had.',
      { layer, atomId: atom?.atomId },
    );
  }

  const replacement = {
    ...buildLayerEmission({
      layer,
      value,
      valueKind,
      provenance: existing.provenance,
      assumptions: assumptions ?? existing.assumptions ?? [],
    }),
    substituted: true,
    substitutedFrom: origin,
  };

  return Object.freeze({
    ...atom,
    layers: Object.freeze((atom.layers ?? []).map((e) => (e.layer === layer ? Object.freeze(replacement) : e))),
    ablated: Object.freeze({ layer, origin }),
  });
};

/**
 * What a substitution at `layer` can honestly speak to, without evaluating anything.
 *
 * @returns {{substituted, answerable: string[], unanswerable: string[], reason}}
 *   `answerable` is the substituted layer itself. `unanswerable` is every layer downstream,
 *   because each was evaluated at the ORIGINAL input.
 */
export const substitutionReach = (layer) => {
  if (!isStackLayer(layer)) {
    throw new StandardOfRecordError(`layerAblation: unknown layer "${layer}"`, { layer });
  }
  const i = layerIndex(layer);
  return Object.freeze({
    substituted: layer,
    answerable: Object.freeze([layer]),
    unanswerable: Object.freeze(STACK_LAYERS.slice(i + 1)),
    reason: STACK_LAYERS.slice(i + 1).length === 0
      ? null
      : `layers ${STACK_LAYERS.slice(i + 1).join(', ')} were evaluated at "${layer}"'s original `
        + 'value; their value at the substituted input is recorded nowhere. Use '
        + 'layerAttribution.decomposeByLayer* with PINNED layer functions to propagate.',
  });
};

/**
 * Substitute one layer across many atoms.
 *
 * `replacementFor` is a function of the atom rather than a constant, because the interesting
 * ablations are per-decision — "what if the range had been the one that actually showed down"
 * is a different replacement for every row.
 */
export const ablateLayer = ({ atoms = [], layer, replacementFor, origin = 'ablation' } = {}) => {
  if (typeof replacementFor !== 'function') {
    throw new StandardOfRecordError(
      'layerAblation.ablateLayer: `replacementFor(atom)` is required — a constant replacement is '
      + 'almost never the question being asked, so it must be stated explicitly as one.',
    );
  }
  const out = [];
  const skipped = [];
  for (const atom of atoms) {
    const value = replacementFor(atom);
    if (value === undefined) { skipped.push(atom.atomId); continue; }
    out.push(substituteLayer(atom, layer, value, { origin }));
  }
  return Object.freeze({
    layer,
    atoms: Object.freeze(out),
    n: out.length,
    skipped: Object.freeze(skipped),
    reach: substitutionReach(layer),
  });
};

/**
 * The exactly-substitutable subset: atoms whose layer value was recorded FULL.
 *
 * A compressed summary cannot be substituted exactly — that is what "compressed" means. Reporting
 * the subset size beside the manifest's recorded `fullSampleRate` is how a caller can tell a low
 * sampling rate from a crashed run from a filter that dropped rows. `decisionAtom.js` refuses to
 * infer that rate for exactly this reason; inferring it here would reintroduce the ambiguity one
 * module downstream.
 */
export const exactlyAblatable = (atoms, layer, manifest = null) => {
  const exact = (atoms ?? []).filter((a) => emissionFor(a, layer)?.valueKind === 'full');
  return Object.freeze({
    layer,
    exact: Object.freeze(exact),
    n: exact.length,
    nTotal: (atoms ?? []).length,
    // RECORDED, never inferred from how many full values happen to be present.
    fullSampleRate: manifest?.fullSampleRate ?? null,
  });
};
