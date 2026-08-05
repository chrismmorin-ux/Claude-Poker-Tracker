/**
 * divergence.js — `d`. THE one comparison path (WS-350, FSA Phase 3).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE IS, AND WHY THERE IS EXACTLY ONE OF IT.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * ADR-009 guarantees that every surface — `Equilibrium`, `Field`, `Read`, `Declared` — is
 * scored by the SAME instrument, and that no second comparison path is permitted. WS-322 and
 * WS-324 both honoured that by building none: `surfaceRegistry.js` refuses to compare, and
 * `layerAttribution.js` takes `d` as a required argument with no default so that a
 * DECOMPOSITION of a divergence could ship without becoming a DEFINITION of one.
 *
 * This module is that definition, and it is the only one. `__tests__/divergence.test.js`
 * carries a repo-wide scan asserting no second path was introduced.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * FSA OPEN QUESTION #2 IS ANSWERED BY MEASURING, NOT BY ARGUING. BOTH CANDIDATES SHIP.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * "KL versus EV-difference — decide in Phase 3, MEASURE BOTH." So both are here, both are
 * computed on the SAME divergence volume, and neither is privileged in code. What the caller
 * must supply is a PRE-REGISTRATION naming which one is primary, recorded before the run and
 * stamped into the Result Card. `measureBoth` refuses without it.
 *
 * The refusal is the point. Computing both and then reporting whichever agrees with the prior
 * finding is indistinguishable, in the output, from having chosen honestly. Pre-registration is
 * the only thing that makes the two distinguishable after the fact.
 *
 *   kl            KL(A ‖ B) over the action distribution, in NATS. Asks: how differently do
 *                 these two surfaces BEHAVE? Scale-free. Blind to stakes: swapping two actions
 *                 that are worth the same money scores maximally.
 *
 *   ev-difference |EV_A − EV_B| in the atom's EV units. Asks: how much MONEY separates them?
 *                 Blind to behaviour: two surfaces that never agree on an action but always
 *                 agree on its value score zero.
 *
 * THEY ARE NOT ON THE SAME SCALE and no figure may difference them. `comparableByMagnitude` is
 * literally `false` in the payload. What CAN be compared is their ORDERING over surfaces, which
 * is why `rankSurfaces` exists and why a disagreement there is a finding about the estimand
 * rather than a tie to be broken by preference.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE KL FLOOR IS A LOAD-BEARING CONSTANT AND IS TREATED AS ONE.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * `heroPolicy.mjs` applies NO smoothing — "a zero here is a real statement". Correct there, and
 * it means KL(A‖B) is infinite at exactly the decisions that matter most: the ones where the
 * argmax flipped. A floor is therefore unavoidable, and its value SETS THE MAGNITUDE of the
 * headline number: a flipped decision contributes ≈ ln(1/floor) nats, which is a quantity chosen
 * by taste. That is `FAULT-constants-by-taste` sitting inside the instrument itself.
 *
 * So: the floor is exported, it must be stamped into `manifest.constants`, and `klFloorSweep`
 * exists to produce the margin-to-flip entry `fragility.buildMargin` wants. A KL figure
 * published without its floor swept is not a measurement, it is a setting.
 *
 * EV-difference has no equivalent knob, which is itself a fact about the two candidates and is
 * reported as one.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * "THE SAME DIVERGENCE VOLUME" IS ENFORCED, NOT ASSUMED.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * A decision enters the volume only if BOTH measures are computable on it. Scoring KL on the
 * decisions that had action distributions and EV-difference on the decisions that had EVs would
 * put the two numbers on two different sets, and the comparison would then be measuring the
 * sets. `geometryAblation.mjs` states the same rule for arms; this is it for measures.
 * Exclusions are COUNTED BY REASON and returned, never dropped.
 */

import { StandardOfRecordError } from './schemas.js';
import { pairAtoms, pairedMeanCI, mean } from './layerAttribution.js';

/** The two candidates FSA named. Not an extension point — a third would be a second path. */
export const DIVERGENCE_MEASURES = Object.freeze(['kl', 'ev-difference']);

/**
 * How situations are weighted into the total. These answer DIFFERENT QUESTIONS and the Result
 * Card must say which one it measured (WS-350 decision flag).
 *
 *   frequency  every DECISION counts once. What a player actually faces at the table.
 *   uniform    every SITUATION counts once, whatever its frequency. Surfaces rare-but-severe
 *              divergence that frequency weighting buries under the common spots.
 *
 * Both are computed on every run. Neither is a default; the card declares its primary.
 */
export const DIVERGENCE_WEIGHTINGS = Object.freeze(['frequency', 'uniform']);

/**
 * The probability floor under KL. LOAD-BEARING — see the header. Stamp it in
 * `manifest.constants.KL_FLOOR` and sweep it with `klFloorSweep` before publishing a KL figure.
 *
 * 1e-6 gives a flipped decision ≈ 13.8 nats. The value is a choice, which is why it is swept.
 */
export const KL_FLOOR = 1e-6;

/** KL is asymmetric. The direction is part of the definition and travels with every figure. */
export const KL_DIRECTION = 'KL(reference || candidate)';

/** Why a decision could not enter the divergence volume. Counted, never silently dropped. */
export const VOLUME_EXCLUSIONS = Object.freeze({
  NO_ACTION: 'no-action-distribution',
  NO_EV: 'no-ev',
  DEGENERATE_ACTION: 'degenerate-action-distribution',
  UNPAIRED: 'unpaired',
});

// ── the output shape both measures read ────────────────────────────────────────────────

/**
 * The ONE output shape `d` consumes. Both measures read this same object; that is what keeps
 * them on the same volume rather than on two shapes that could silently cover different rows.
 *
 * `ev` is nullable because a surface may genuinely have no EV layer (a Declared card that maps
 * situation straight to action). Null is a real answer and produces an EV-difference exclusion,
 * which is different from — and must not average with — an EV-difference of zero.
 */
export const buildSurfaceOutput = ({ action = null, ev = null } = {}) => Object.freeze({
  action: action ? Object.freeze({ ...action }) : null,
  ev: Number.isFinite(ev) ? ev : null,
});

/** Read a surface output off an atom. The atom's `action` IS the distribution; `ev` is a layer. */
export const outputOfAtom = (atom) => buildSurfaceOutput({
  action: atom?.action ?? null,
  ev: (atom?.layers ?? []).find((e) => e?.layer === 'ev')?.value ?? null,
});

// ── the two measures ───────────────────────────────────────────────────────────────────

const normalizeDist = (dist) => {
  if (!dist || typeof dist !== 'object') return null;
  const keys = Object.keys(dist);
  if (keys.length === 0) return null;
  let total = 0;
  for (const k of keys) {
    const v = dist[k];
    if (!Number.isFinite(v) || v < 0) return null;
    total += v;
  }
  if (!(total > 0)) return null;
  const out = {};
  for (const k of keys) out[k] = dist[k] / total;
  return out;
};

/**
 * KL(a ‖ b) in nats over the union of both supports, with `floor` substituted for zeros in b.
 *
 * Zeros in `a` contribute nothing (0·ln0 = 0 by convention and by limit). Zeros in `b` are what
 * the floor is for, and are exactly the flipped-argmax decisions the whole exercise cares about.
 *
 * Returns NaN — never 0 — when either side is not a usable distribution. A zero would say "these
 * surfaces agree", which is the opposite of "we could not tell".
 */
export const klDivergence = (a, b, { floor = KL_FLOOR } = {}) => {
  const p = normalizeDist(a);
  const q = normalizeDist(b);
  if (!p || !q) return NaN;
  let s = 0;
  for (const k of new Set([...Object.keys(p), ...Object.keys(q)])) {
    const pk = p[k] ?? 0;
    if (pk <= 0) continue;
    const qk = Math.max(q[k] ?? 0, floor);
    s += pk * Math.log(pk / qk);
  }
  // Floored q no longer sums to 1, so a tiny negative is arithmetically possible where the two
  // distributions are identical and both carry zeros. Clamp at 0 — KL is non-negative by
  // definition and reporting -1e-17 as a divergence would be noise dressed as a direction.
  return s < 0 && s > -1e-12 ? 0 : s;
};

/**
 * |EV_a − EV_b| in the atom's EV units.
 *
 * ABSOLUTE, not signed. The estimand is "how far apart are these two surfaces", and a signed
 * quantity would let a decision where A is better cancel a decision where B is better, reporting
 * two surfaces that disagree everywhere as identical. The signed version is a DIFFERENT
 * estimand — "which surface is better" — and that is what `estimateEdge` in the hero-EV arm
 * already measures. Conflating them is how a divergence figure gets read as an edge.
 */
export const evDifference = (a, b) => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return Math.abs(a - b);
};

/**
 * The measure named, as a function of two surface outputs. This is the `d` that
 * `layerAttribution` requires and never chooses.
 */
export const divergenceFn = (measure, { floor = KL_FLOOR } = {}) => {
  if (!DIVERGENCE_MEASURES.includes(measure)) {
    throw new StandardOfRecordError(
      `divergence: measure must be one of ${DIVERGENCE_MEASURES.join(' | ')}, got "${measure}". `
      + 'A third measure would be the second comparison path ADR-009 forbids.',
      { measure },
    );
  }
  if (measure === 'kl') return (outA, outB) => klDivergence(outA?.action, outB?.action, { floor });
  return (outA, outB) => evDifference(outA?.ev, outB?.ev);
};

/** Units, carried with every figure so two measures cannot be differenced by accident. */
export const MEASURE_UNITS = Object.freeze({
  kl: 'nats',
  'ev-difference': 'EV units of the atom (engine chips unless the card states otherwise)',
});

// ── pre-registration ───────────────────────────────────────────────────────────────────

/**
 * Declare, BEFORE the run, which measure is primary.
 *
 * `rationale` is required and is not ceremony: a pre-registration nobody can argue with is a
 * choice made by taste wearing a timestamp. The same objection `probabilityBasis` answers in the
 * fault register.
 */
export const preRegisterPrimary = ({ primary, rationale, at, weighting } = {}) => {
  if (!DIVERGENCE_MEASURES.includes(primary)) {
    throw new StandardOfRecordError(
      `divergence: pre-registered primary must be one of ${DIVERGENCE_MEASURES.join(' | ')}, `
      + `got "${primary}"`,
      { primary },
    );
  }
  if (!DIVERGENCE_WEIGHTINGS.includes(weighting)) {
    throw new StandardOfRecordError(
      `divergence: pre-registered weighting must be one of ${DIVERGENCE_WEIGHTINGS.join(' | ')}, `
      + `got "${weighting}". Frequency-weighted and unweighted answer different questions and a `
      + 'card that does not say which it measured cannot be read.',
      { weighting },
    );
  }
  if (!rationale || typeof rationale !== 'string') {
    throw new StandardOfRecordError(
      'divergence: a pre-registration needs a `rationale`. A choice nobody can argue with is a '
      + 'constant chosen by taste with a timestamp on it.',
    );
  }
  if (!at) {
    throw new StandardOfRecordError(
      'divergence: a pre-registration needs `at` — the point of it is that it precedes the run, '
      + 'and a registration with no time cannot establish that.',
    );
  }
  return Object.freeze({
    primary,
    weighting,
    rationale,
    at,
    secondary: DIVERGENCE_MEASURES.filter((m) => m !== primary),
    klFloor: KL_FLOOR,
    klDirection: KL_DIRECTION,
  });
};

// ── the same-volume measurement ────────────────────────────────────────────────────────

/**
 * Both measures, on the SAME paired decisions, under BOTH weightings.
 *
 * @param {Object} params
 * @param {Array} params.atomsA - the REFERENCE surface's atoms
 * @param {Array} params.atomsB - the CANDIDATE surface's atoms
 * @param {Object} params.preRegistration - from `preRegisterPrimary`. Required.
 * @param {Function} [params.outputOf] - atom -> surface output
 * @param {number} [params.floor] - KL floor; defaults to the stamped constant
 *
 * @returns {{volume, byMeasure, primary, comparableByMagnitude: false}}
 */
export const measureBoth = ({
  atomsA, atomsB, preRegistration, outputOf = outputOfAtom, floor = KL_FLOOR,
} = {}) => {
  if (!preRegistration?.primary) {
    throw new StandardOfRecordError(
      'divergence.measureBoth: a pre-registration is REQUIRED. Both measures are computed either '
      + 'way; what the pre-registration establishes is that the primary was named before the '
      + 'numbers were seen. Without it, an honest run and a run that reported whichever measure '
      + 'agreed with the prior finding produce identical output.',
    );
  }

  const { pairs, unpairedA, unpairedB } = pairAtoms(atomsA, atomsB);
  const dKl = divergenceFn('kl', { floor });
  const dEv = divergenceFn('ev-difference');

  const rows = [];
  const excluded = {};
  const bump = (k) => { excluded[k] = (excluded[k] ?? 0) + 1; };

  for (const [a, b] of pairs) {
    const outA = outputOf(a);
    const outB = outputOf(b);
    const kl = dKl(outA, outB);
    const ev = dEv(outA, outB);

    // THE SAME VOLUME. A row missing either measure is excluded from BOTH, and counted.
    if (!Number.isFinite(kl)) { bump(VOLUME_EXCLUSIONS.NO_ACTION); continue; }
    if (!Number.isFinite(ev)) { bump(VOLUME_EXCLUSIONS.NO_EV); continue; }
    rows.push({ atomId: a.atomId, situationKey: a.situationKey, kl, ev });
  }
  if (unpairedA + unpairedB > 0) excluded[VOLUME_EXCLUSIONS.UNPAIRED] = unpairedA + unpairedB;

  const bySituation = new Map();
  for (const r of rows) {
    if (!bySituation.has(r.situationKey)) bySituation.set(r.situationKey, []);
    bySituation.get(r.situationKey).push(r);
  }

  const forMeasure = (key) => {
    const xs = rows.map((r) => r[key]);
    // Uniform: the mean of the per-situation means, so a situation seen once counts as much as
    // one seen four hundred times. Deliberately NOT the same number as the frequency mean.
    const perSituation = [...bySituation.values()].map((rs) => mean(rs.map((r) => r[key])));
    return Object.freeze({
      frequency: Object.freeze({ ...pairedMeanCI(xs), weighting: 'frequency' }),
      uniform: Object.freeze({ ...pairedMeanCI(perSituation), weighting: 'uniform' }),
      units: MEASURE_UNITS[key === 'kl' ? 'kl' : 'ev-difference'],
      max: xs.length ? Math.max(...xs) : null,
      zeroRows: xs.filter((x) => x === 0).length,
    });
  };

  return Object.freeze({
    instrument: 'divergence',
    // Stated in the payload, not only in prose: nats and chips do not difference.
    comparableByMagnitude: false,
    preRegistration,
    klFloor: floor,
    klDirection: KL_DIRECTION,
    volume: Object.freeze({
      n: rows.length,
      nPaired: pairs.length,
      nSituations: bySituation.size,
      excluded: Object.freeze({ ...excluded }),
      sameVolume: true,
    }),
    byMeasure: Object.freeze({
      kl: forMeasure('kl'),
      'ev-difference': forMeasure('ev'),
    }),
    rows: Object.freeze(rows),
  });
};

// ── ranking, and the disagreement that is the finding ──────────────────────────────────

/**
 * Rank candidate surfaces by divergence from ONE reference, under BOTH measures.
 *
 * THE NAMED RISK OF THE TICKET. If the two measures order the candidates differently, that
 * disagreement is a fact about the estimand — the two are answering different questions about
 * the same pair — and it is reported as the headline, never resolved by preference.
 *
 * @param {Object} params
 * @param {Array} params.referenceAtoms
 * @param {Array<{surfaceId, atoms}>} params.candidates - two or more, or there is no ranking
 * @param {Object} params.preRegistration
 */
export const rankSurfaces = ({
  referenceAtoms, candidates = [], preRegistration, outputOf = outputOfAtom, floor = KL_FLOOR,
} = {}) => {
  if (candidates.length < 2) {
    throw new StandardOfRecordError(
      `divergence.rankSurfaces: ranking needs at least two candidates, got ${candidates.length}. `
      + 'With one candidate there is no order for the two measures to disagree about, and '
      + 'reporting "they agree" from a single pair would be a claim the data cannot make.',
      { candidates: candidates.length },
    );
  }

  const measured = candidates.map((c) => ({
    surfaceId: c.surfaceId,
    result: measureBoth({
      atomsA: referenceAtoms, atomsB: c.atoms, preRegistration, outputOf, floor,
    }),
  }));

  const orderUnder = (measure, weighting) => [...measured]
    .sort((x, y) => y.result.byMeasure[measure][weighting].mean
      - x.result.byMeasure[measure][weighting].mean)
    .map((m) => m.surfaceId);

  const orders = {};
  for (const measure of DIVERGENCE_MEASURES) {
    for (const weighting of DIVERGENCE_WEIGHTINGS) {
      orders[`${measure}/${weighting}`] = orderUnder(measure, weighting);
    }
  }

  // The comparison the ticket names: the two MEASURES, at the pre-registered weighting.
  const w = preRegistration.weighting;
  const klOrder = orders[`kl/${w}`];
  const evOrder = orders[`ev-difference/${w}`];
  const agree = klOrder.length === evOrder.length && klOrder.every((s, i) => s === evOrder[i]);

  // Which surfaces actually swapped, so a disagreement is nameable rather than just true.
  const swaps = [];
  if (!agree) {
    for (const s of klOrder) {
      const i = klOrder.indexOf(s);
      const j = evOrder.indexOf(s);
      if (i !== j) swaps.push({ surfaceId: s, klRank: i + 1, evRank: j + 1 });
    }
  }

  const perSurface = Object.fromEntries(measured.map((m) => [m.surfaceId, m.result]));

  return Object.freeze({
    instrument: 'divergence-ranking',
    weighting: w,
    orders: Object.freeze(orders),
    klOrder: Object.freeze(klOrder),
    evOrder: Object.freeze(evOrder),
    // THE HEADLINE when false. Never resolved by preference — see the module header.
    ranksAgree: agree,
    swaps: Object.freeze(swaps),
    // Whether the order is an order of SIGNAL or an order of NOISE. See below.
    pairwiseSeparation: pairwiseSeparation({ perSurface }),
    perSurface: Object.freeze(perSurface),
  });
};

/**
 * Can the candidates actually be TOLD APART, under each measure? Paired, on the same decisions.
 *
 * WHY A RANKING IS NOT ENOUGH ON ITS OWN. `rankSurfaces` sorts point estimates, and sorting
 * always produces an order — including when the quantities being sorted are indistinguishable.
 * Two candidates whose per-decision difference has a CI straddling zero have been ORDERED but
 * not SEPARATED, and reporting "the measures disagree" from two such orders would be reporting a
 * disagreement between two coin flips.
 *
 * So this is the admissibility test for the ORDER, not for either mean: it differences the two
 * candidates PER DECISION and takes a paired CI, exactly the rule `layerAttribution` and
 * `geometryAblation` already state. A measure whose `admissible` is false has not established
 * its own ranking, and the card must say so beside the ranking rather than under it.
 *
 * Operates on the `perSurface` block — which carries per-decision `rows` — so it can be applied
 * to a stored run without re-measuring anything.
 */
export const pairwiseSeparation = ({ perSurface = {} } = {}) => {
  const ids = Object.keys(perSurface);
  const out = {};
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const [a, b] = [ids[i], ids[j]];
      const byId = new Map((perSurface[b].rows ?? []).map((r) => [r.atomId, r]));
      const dKl = [];
      const dEv = [];
      for (const r of perSurface[a].rows ?? []) {
        const o = byId.get(r.atomId);
        if (!o) continue;
        dKl.push(r.kl - o.kl);
        dEv.push(r.ev - o.ev);
      }
      out[`${a} vs ${b}`] = Object.freeze({
        pair: Object.freeze([a, b]),
        n: dKl.length,
        // Signed on purpose: the SIGN is the order, so a separation payload that dropped it
        // would establish that the two differ without saying which way.
        kl: Object.freeze({ ...pairedMeanCI(dKl), differenceOf: `${a} - ${b}` }),
        'ev-difference': Object.freeze({ ...pairedMeanCI(dEv), differenceOf: `${a} - ${b}` }),
        rowsDiffering: Object.freeze({
          kl: dKl.filter((x) => Math.abs(x) > 1e-12).length,
          'ev-difference': dEv.filter((x) => Math.abs(x) > 1e-12).length,
        }),
      });
    }
  }
  return Object.freeze(out);
};

// ── the floor, swept ───────────────────────────────────────────────────────────────────

/**
 * Sweep the KL floor and report where — if anywhere — the ranking reverses.
 *
 * Feeds `fragility.buildMargin`. A KL figure whose ranking flips inside a plausible floor range
 * is a setting, not a measurement, and the card has to say so. `sweptRange` is returned so a
 * null flip point is readable: "does not flip" means nothing without knowing where you looked.
 */
export const klFloorSweep = ({
  referenceAtoms, candidates = [], preRegistration, outputOf = outputOfAtom,
  floors = [1e-9, 1e-8, 1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2],
} = {}) => {
  const points = floors.map((floor) => {
    const r = rankSurfaces({ referenceAtoms, candidates, preRegistration, outputOf, floor });
    return { floor, klOrder: r.klOrder, ranksAgree: r.ranksAgree };
  });
  const baseline = points.find((p) => p.floor === KL_FLOOR) ?? points[0];
  const sameOrder = (a, b) => a.length === b.length && a.every((s, i) => s === b[i]);
  const flipped = points.find((p) => !sameOrder(p.klOrder, baseline.klOrder));
  return Object.freeze({
    floors: Object.freeze(floors),
    sweptRange: Object.freeze([Math.min(...floors), Math.max(...floors)]),
    baselineFloor: baseline.floor,
    baselineOrder: Object.freeze(baseline.klOrder),
    flipsAt: flipped ? flipped.floor : null,
    points: Object.freeze(points.map((p) => Object.freeze({ ...p, klOrder: Object.freeze(p.klOrder) }))),
  });
};
