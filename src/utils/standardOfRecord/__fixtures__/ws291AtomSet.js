/**
 * ws291AtomSet.js — a pinned atom set that reproduces the SHAPE of the WS-291 fault (WS-324).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE QUOTING ANY NUMBER THAT COMES OUT OF THIS FIXTURE.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * This is a MECHANISM TEST ON A SYNTHETIC FIXTURE. It exists to prove one thing: that layer
 * attribution localizes a layer-1 fault to the RANGE layer rather than to the recommendation
 * that fault eventually corrupted.
 *
 * It is **NOT** a measurement of the real WS-291 fault, and no number produced from it may be
 * cited as one. The magnitudes below are chosen to make the mechanism legible, not mined from
 * the corpus. A real measurement would need a versioned Deal Book, a registered Field, and a
 * complete replication manifest — i.e. a Result Card under ADR-009. This is none of those, and
 * saying so here is cheaper than un-saying it after the number has been quoted.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE FAULT THIS ENCODES.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * WS-291 was a falsified range model on the live recommendation path. It survived unmeasured
 * for the life of the project because its symptoms appeared at layer 5 (bad advice) while its
 * fault sat at layer 1 (range), and nothing scored the layers independently.
 *
 * So the fixture is built to that exact shape:
 *
 *   surface A ("before")  — range layer WRONG. Every layer downstream is CORRECT GIVEN ITS INPUT.
 *   surface B ("after")   — range layer right. Downstream layers identical to A's.
 *
 * Because only `layerFns.range` differs between the two sides, a correct attribution MUST put
 * essentially all of the divergence on `range` and essentially none on `action` — even though
 * `action` is where the divergence is VISIBLE. An attribution that blames `action` has failed
 * in precisely the way that let WS-291 hide.
 *
 * `TWO_FAULT_*` is the companion case where equity is wrong as well, so the decomposition has
 * something non-degenerate to split and telescoping and Shapley have room to disagree.
 */

import { buildDecisionAtom, buildLayerEmission, buildAtomSetManifest } from '../decisionAtom.js';

/** The toy stack, shared by both surfaces so only the declared fault differs. */
const equityFromRange = (w) => 0.9 - 0.5 * w;
const foldFromEquity = (e) => Math.min(0.95, Math.max(0.05, 1.15 - e));
const evFromFoldAndEquity = (p, e) => (p * 1.0) + ((1 - p) * ((e * 3.2) - 1.6));
const actionFromEv = (v) => {
  const bet = 1 / (1 + Math.exp(-2.2 * v));
  return { bet, check: 1 - bet };
};

/** The six decisions, across three situations so the by-situation decomposition is non-trivial. */
const DECISIONS = Object.freeze([
  { atomId: 'atom-001', situationKey: 'flop|btn|srp|dry', trueW: 0.55, believedW: 0.22 },
  { atomId: 'atom-002', situationKey: 'flop|btn|srp|dry', trueW: 0.60, believedW: 0.28 },
  { atomId: 'atom-003', situationKey: 'turn|co|3bp|wet', trueW: 0.45, believedW: 0.20 },
  { atomId: 'atom-004', situationKey: 'turn|co|3bp|wet', trueW: 0.50, believedW: 0.26 },
  { atomId: 'atom-005', situationKey: 'river|bb|srp|paired', trueW: 0.65, believedW: 0.35 },
  { atomId: 'atom-006', situationKey: 'river|bb|srp|paired', trueW: 0.70, believedW: 0.40 },
]);

/**
 * Build one atom by running the toy stack forward from a range width.
 *
 * `valueKind: 'full'` throughout — attribution runs on exactly-substitutable rows only, and a
 * fixture that quietly shipped compressed values would exercise the wrong code path.
 */
const buildAtom = ({ atomId, situationKey, w, surfaceId, equityShift = 0 }) => {
  const equity = equityFromRange(w) + equityShift;
  const fold = foldFromEquity(equity);
  const ev = evFromFoldAndEquity(fold, equity);
  const action = actionFromEv(ev);

  return buildDecisionAtom({
    atomId,
    situationKey,
    carried: { sprBand: 'mid', playersRemaining: 2, pool: 'fixture' },
    surfaceId,
    action,
    ruleId: 'fixture-rule',
    warrant: 'empirical',
    layers: [
      buildLayerEmission({ layer: 'range', value: w, valueKind: 'full', assumptions: ['continueFraction'] }),
      buildLayerEmission({ layer: 'equity', value: equity, valueKind: 'full', assumptions: [] }),
      buildLayerEmission({ layer: 'foldProbability', value: fold, valueKind: 'full', assumptions: [] }),
      buildLayerEmission({ layer: 'ev', value: ev, valueKind: 'full', assumptions: ['rakeIgnored'] }),
      buildLayerEmission({ layer: 'action', value: action, valueKind: 'full', assumptions: [] }),
    ],
    seeds: { deal: 1, rollout: 2 },
  });
};

/** Surface A — the falsified range model. Layer 1 wrong, everything downstream correct. */
export const ATOMS_BEFORE = Object.freeze(DECISIONS.map((dcn) => buildAtom({
  atomId: dcn.atomId, situationKey: dcn.situationKey, w: dcn.believedW, surfaceId: 'sfc-before',
})));

/** Surface B — the corrected range model. */
export const ATOMS_AFTER = Object.freeze(DECISIONS.map((dcn) => buildAtom({
  atomId: dcn.atomId, situationKey: dcn.situationKey, w: dcn.trueW, surfaceId: 'sfc-after',
})));

/**
 * Pinned layer functions for the two surfaces.
 *
 * ONLY `range` differs. That is the whole content of the fixture: the downstream layers are the
 * SAME FUNCTION on both sides, so any attribution that assigns them a share is reporting
 * something that is not there.
 *
 * In production these are pinned to the atom set manifest's engine commit and replayed from its
 * stored seeds. Here they are closed-form, which is what makes the expected answer knowable.
 */
const rangeOf = (_carry, atom) => atom.layers.find((l) => l.layer === 'range').value;

export const layerFns = Object.freeze({
  // The range layer reads its width from whichever atom the hybrid took it from — that is how
  // the per-decision value reaches the chain instead of being baked into a closure.
  range: { A: rangeOf, B: rangeOf },
  equity: { A: (w) => equityFromRange(w), B: (w) => equityFromRange(w) },
  foldProbability: { A: (e) => ({ e, p: foldFromEquity(e) }), B: (e) => ({ e, p: foldFromEquity(e) }) },
  ev: { A: ({ e, p }) => evFromFoldAndEquity(p, e), B: ({ e, p }) => evFromFoldAndEquity(p, e) },
  action: { A: (v) => actionFromEv(v), B: (v) => actionFromEv(v) },
});

/** Companion case: equity is ALSO wrong, so two layers carry blame and the split is non-degenerate. */
export const ATOMS_TWO_FAULT = Object.freeze(DECISIONS.map((dcn) => buildAtom({
  atomId: dcn.atomId, situationKey: dcn.situationKey, w: dcn.believedW,
  surfaceId: 'sfc-two-fault', equityShift: -0.12,
})));

export const layerFnsTwoFault = Object.freeze({
  ...layerFns,
  equity: { A: (w) => equityFromRange(w) - 0.12, B: (w) => equityFromRange(w) },
});

/** Manifest for the set. `fullSampleRate: 1` — every row here carries full intermediates. */
export const ATOM_SET_MANIFEST = buildAtomSetManifest({
  atomSetId: 'ws291-fixture',
  surfaceId: 'sfc-before',
  fullSampleRate: 1,
  atomCount: DECISIONS.length,
});

/** A divergence measure for tests ONLY. Not a candidate for FSA's `d` — see layerAttribution.js. */
export const testD = (outA, outB) => {
  if (!outA || !outB) return 0;
  const keys = new Set([...Object.keys(outA), ...Object.keys(outB)]);
  let s = 0;
  for (const k of keys) s += Math.abs((outA[k] ?? 0) - (outB[k] ?? 0));
  return s / 2;   // total variation distance
};

/** Layer-space distance for `localizeByLayer`, again test-only. */
export const testDLayer = (a, b, layer) => {
  if (layer === 'action') return testD(a, b);
  if (Number.isFinite(a) && Number.isFinite(b)) return Math.abs(a - b);
  return 0;
};

export { DECISIONS };
