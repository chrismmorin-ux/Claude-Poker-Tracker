/**
 * stack.js — the STACK: what an action surface is made of, declared (WS-324).
 *
 * FSA compares surfaces at the top — action distribution against action distribution — and
 * decomposes the difference BY SITUATION. That localizes divergence in game-state space and
 * says nothing about WHICH STEP OF THE REASONING produced it. A wrong recommendation traces
 * no further than "the engine said so".
 *
 * An action surface is a COMPOSITION of intermediate surfaces:
 *
 *   range -> equity -> fold-probability -> EV -> action
 *
 * Each intermediate is itself a function over game states — a surface in exactly FSA's sense,
 * with its own inputs, its own assumptions, and its own ways of being wrong. The ordered set
 * is the STACK; each element is a LAYER.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THE ORDER IS PART OF THE VOCABULARY AND NOT A CALLER'S CHOICE.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * The question this module exists to make answerable is "given two surfaces that diverge,
 * what is the FIRST layer at which their stacks separate?" First is only meaningful against
 * a fixed order. If each surface declared its own ordering, two stacks could disagree about
 * which of their layers came earlier, and "first divergent layer" would stop being a fact
 * about the surfaces and start being a fact about who authored them.
 *
 * So `STACK_LAYERS` is ordered, frozen, and shared. A surface may OMIT layers (a Declared
 * card that maps situation straight to action has no equity layer), but it may not REORDER
 * them. `validateStack` enforces exactly that: subset, yes; permutation, no.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT THEORETICAL.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * WS-291 was a falsified range model sitting on the live recommendation path and it survived
 * UNMEASURED FOR THE LIFE OF THE PROJECT. It is a layer-1 fault (range) that manifested as
 * layer-5 symptoms (bad advice). Nothing scored the layers independently, so nothing could
 * localize it. `holdingKnowledge` (WS-292) closed exactly one such join — belief vs truth for
 * a holding. This generalizes that move to every layer.
 *
 * The precedent for the shape is in-repo: `scripts/backtest/decisionGeometry.mjs`, which is
 * "small on purpose, and shared on purpose... deriving it three times would be three chances
 * to disagree about what 'the pot' means at a node". Same argument, one scale up.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * It does not compare stacks, and it does not attribute divergence to a layer. Attribution
 * needs a divergence measure `d`, and FSA's open question #2 — KL versus EV-difference,
 * "decide in Phase 3, measure both" — is unanswered. `surfaceRegistry.js` refuses to build a
 * comparison path for the same reason, and ADR-009 guarantees there is only ever ONE such
 * path. Adding attribution here would create the second one AND settle the open question by
 * default rather than by measurement. It arrives with Phase 3, not before.
 */

/**
 * The ordered layer vocabulary. Index IS the position in the composition.
 *
 * A surface declares a SUBSET of these in this ORDER. `action` is the only layer every
 * surface must have — it is what makes the thing a surface at all under FSA's definition
 * (a function from game state to action distribution).
 */
export const STACK_LAYERS = Object.freeze([
  'range',
  'equity',
  'foldProbability',
  'ev',
  'action',
]);

/** Position of a layer in the canonical order, or -1. */
export const layerIndex = (layer) => STACK_LAYERS.indexOf(layer);

export const isStackLayer = (layer) => STACK_LAYERS.includes(layer);

/**
 * The layer every surface must declare. A surface without an action layer does not emit an
 * action distribution, which is what a surface IS.
 */
export const TERMINAL_LAYER = 'action';

/**
 * What ground truth each layer can be scored against, when any exists.
 *
 * Recorded here rather than inside the probes because it is a property of the LAYER — the
 * fact that a range is scoreable against a revealed holding does not belong to whichever
 * module happens to do the scoring. `layerProbes.js` reads this; it does not redefine it.
 *
 * `null` means no ground truth exists for that layer in this repo today. That is a real
 * state and must be distinguishable from "not yet wired" — a layer with no truth source
 * cannot be probed, and a probe claiming otherwise would be inventing a number.
 */
export const LAYER_GROUND_TRUTH = Object.freeze({
  range: 'revealedHolding',
  equity: 'realizedShowdown',
  foldProbability: 'observedFoldFrequency',
  ev: 'realizedChips',
  action: null,
});

/**
 * Build one layer descriptor.
 *
 * @param {Object} params
 * @param {string} params.layer - one of STACK_LAYERS
 * @param {string[]} params.inputs - what this layer consumes. Named, because a layer whose
 *   inputs are unstated cannot be substituted in an ablation.
 * @param {string} params.outputType - the shape it emits ('rangeVector' | 'scalar' | ...).
 * @param {string[]} params.assumptions - NAMED assumptions, not prose. These are what a probe
 *   scores against and what a fault register points at. A layer with no declared assumptions
 *   is legal and means "this layer assumes nothing beyond its inputs" — a positive claim,
 *   which is why the empty array must be explicit rather than absent.
 */
export const buildLayer = ({ layer, inputs = [], outputType = null, assumptions = [] } = {}) => {
  if (!isStackLayer(layer)) {
    throw new Error(
      `stack: layer "${layer}" is not one of ${STACK_LAYERS.join(' | ')}`,
    );
  }
  return Object.freeze({
    layer,
    inputs: Object.freeze([...inputs]),
    outputType,
    assumptions: Object.freeze([...assumptions]),
    groundTruth: LAYER_GROUND_TRUTH[layer],
  });
};

/**
 * Check a declared stack. Returns a list of problems rather than throwing.
 *
 * Same convention as `checkAgainstSchema` in schemas.js: the validator reports, the caller
 * decides fatality. `buildSurfaceEntry` treats any problem as fatal; tooling that wants to
 * survey the repo's stacks does not have to.
 */
export const stackProblems = (stack) => {
  const problems = [];
  if (!Array.isArray(stack)) return ['stack must be an array of layer descriptors'];
  if (stack.length === 0) return ['stack must declare at least one layer'];

  let previousIndex = -1;
  const seen = new Set();

  for (const [i, entry] of stack.entries()) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push(`stack[${i}] must be a layer descriptor object`);
      continue;
    }
    const { layer } = entry;
    if (!isStackLayer(layer)) {
      problems.push(`stack[${i}].layer "${layer}" is not one of ${STACK_LAYERS.join(' | ')}`);
      continue;
    }
    if (seen.has(layer)) {
      problems.push(`stack declares layer "${layer}" more than once`);
      continue;
    }
    seen.add(layer);

    const idx = layerIndex(layer);
    if (idx < previousIndex) {
      problems.push(
        `stack declares "${layer}" after "${STACK_LAYERS[previousIndex]}", but the canonical `
        + `order is ${STACK_LAYERS.join(' -> ')}. A subset is allowed; a reordering is not, `
        + 'because "the first layer at which two stacks separate" is only meaningful against '
        + 'a fixed order.',
      );
    }
    previousIndex = Math.max(previousIndex, idx);

    if (!Array.isArray(entry.inputs)) {
      problems.push(`stack[${i}].inputs must be an array (a layer whose inputs are unstated cannot be substituted in an ablation)`);
    }
    if (!Array.isArray(entry.assumptions)) {
      problems.push(`stack[${i}].assumptions must be an array (empty is a positive claim and must be explicit)`);
    }
  }

  if (!seen.has(TERMINAL_LAYER)) {
    problems.push(
      `stack must declare the "${TERMINAL_LAYER}" layer — a surface that emits no action `
      + 'distribution is not a surface under FSA\'s definition.',
    );
  }

  return problems;
};

/** True when a stack is well-formed. */
export const isValidStack = (stack) => stackProblems(stack).length === 0;

/**
 * The first layer at which two stacks structurally separate, or null when they declare the
 * same layers in the same order.
 *
 * NOTE what this does and does not answer. It compares DECLARATIONS — the layers a surface
 * says it has — not VALUES. Two surfaces with identical stacks can still diverge, and
 * localizing that divergence to a layer requires a divergence measure this module refuses to
 * define (see the header). This function answers the cheap structural half: if one surface
 * has no equity layer and the other does, they separate at `equity` and no measurement is
 * needed to know it.
 */
export const firstStructuralDivergence = (stackA, stackB) => {
  const layersOf = (s) => new Set((Array.isArray(s) ? s : []).map((e) => e?.layer));
  const a = layersOf(stackA);
  const b = layersOf(stackB);
  for (const layer of STACK_LAYERS) {
    if (a.has(layer) !== b.has(layer)) return layer;
  }
  return null;
};
