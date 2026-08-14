/**
 * deviationMap.mjs — the exploit map, derived from the blinds outward (WS-333 Part E).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE CLAIM.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Per geometry cell, indifference is computable from `s` alone — that is the whole point of
 * the identity in `unexploitableFloor.js`. Measure how far the pool deviates from it per
 * cell, weight by how often the cell actually arrives, and **the deviation map IS the
 * exploit map** — derived from one identity rather than assembled from separate heuristics.
 *
 * A cell where the pool continues LESS than the floor is a cell where a bluff auto-profits.
 * A cell where it continues MORE is one where value bets get paid and bluffs do not. Neither
 * conclusion is asserted here; the map emits the signed deviation and its frequency weight,
 * and what to DO about it is the game tree's job (weakness and exploit are separate layers —
 * `exploitEngine/CLAUDE.md`).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EMITS A RESULT CARD AND NOT A REPORT OF ITS OWN.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * ADR-009 binds every comparative claim to a Result Card, and this is a comparative claim:
 * pool behaviour against a derived baseline. Emitting a bespoke JSON shape would be a second
 * comparison path — the exact duplication the ADR rejected when it chose to extend FSA rather
 * than build a standalone tournament harness.
 *
 * FSA's divergence instrument (Phase 3) does not exist yet, so this does NOT compute a
 * divergence between two surfaces. It computes a deviation from a derived floor, which is a
 * different and simpler object, and hands it over in the standard envelope so that when
 * Phase 3 lands it consumes this rather than re-deriving it.
 */

import { buildResultCard } from '../../src/utils/standardOfRecord/resultCard.js';
import { buildReplicationManifest } from '../../src/utils/standardOfRecord/manifest.js';
import { deriveFloor } from '../../src/utils/exploitEngine/unexploitableFloor.js';

/** Continuation = anything that is not a fold. */
const CONTINUE_ACTIONS = new Set(['call', 'raise', 'check', 'bet']);

/** Representative bet-to-pot ratio for each size bucket, used to derive the cell's floor. */
const BUCKET_MIDPOINT = {
  '0-33': 0.20, '33-66': 0.50, '66-100': 0.80, '100-150': 1.25, '150+': 2.00,
};

/**
 * Build the frequency-weighted deviation map.
 *
 * @param {Array} observations - EVAL-half observations carrying geometry coordinates
 * @param {object} [opts]
 * @param {object|null} [opts.rakeConfig] - reported separately for live vs online
 * @param {number} [opts.minCellN=100] - well-sampled floor; thin cells are FLAGGED, not dropped
 */
export const buildDeviationMap = (observations, { rakeConfig = null, minCellN = 100 } = {}) => {
  const cells = new Map();

  for (const obs of observations) {
    // Only decisions FACING a bet have a defensive floor — there is nothing to defend
    // against when nobody has bet.
    if (obs.facingAction !== 'bet' && obs.facingAction !== 'raise') continue;
    const s = BUCKET_MIDPOINT[obs.sizeBucket];
    if (!Number.isFinite(s)) continue;

    const key = [obs.sizeBucket, obs.sprBand ?? '?', obs.closesAction ?? '?'].join('|');
    let cell = cells.get(key);
    if (!cell) {
      cells.set(key, (cell = {
        cell: key,
        sizeBucket: obs.sizeBucket,
        sprBand: obs.sprBand ?? null,
        closesAction: obs.closesAction ?? null,
        s,
        n: 0,
        continued: 0,
      }));
    }
    cell.n++;
    if (CONTINUE_ACTIONS.has(obs.action)) cell.continued++;
  }

  const total = [...cells.values()].reduce((a, c) => a + c.n, 0);

  const rows = [...cells.values()].map((c) => {
    // The floor for this cell's geometry. Pot normalised to 1 so the cell is scale-free:
    // `s` is the only argument the identity needs, which is what makes cells poolable.
    const floor = deriveFloor({
      toCallBB: c.s,
      potBeforeCallBB: 1 + c.s,
      betBB: c.s,
      street: 'flop',
      isIP: c.closesAction === 'true',
      closesAction: c.closesAction === 'true' ? true : c.closesAction === 'false' ? false : null,
      rakeConfig,
      // POKER_THEORY 14.2: a rate without its opportunity count cannot be compared.
      opportunityCount: c.n,
      conditioningSet: `facing a bet, size ${c.sizeBucket}, SPR ${c.sprBand}, closes=${c.closesAction}`,
    });

    const observedContinuation = c.n > 0 ? c.continued / c.n : null;
    const requiredContinuation = floor?.requiredContinuation ?? null;
    const deviation = observedContinuation !== null && requiredContinuation !== null
      ? observedContinuation - requiredContinuation
      : null;
    const frequency = total > 0 ? c.n / total : 0;

    return {
      ...c,
      observedContinuation,
      requiredContinuation,
      deviation,
      frequency,
      // FREQUENCY-WEIGHTED. A spot arriving once per 10,000 hands must not count the same
      // as one that arrives every orbit — that weighting is what makes a deviation
      // convertible to money rather than just true.
      weightedDeviation: deviation === null ? null : deviation * frequency,
      thin: c.n < minCellN,
      // The reading, stated as an observation about the POOL — never as hero advice.
      reads: deviation === null ? null
        : deviation < 0 ? 'pool under-defends this geometry'
          : 'pool over-defends this geometry',
    };
  }).sort((a, b) => Math.abs(b.weightedDeviation ?? 0) - Math.abs(a.weightedDeviation ?? 0));

  const wellSampled = rows.filter((r) => !r.thin);
  const volume = wellSampled.reduce((a, r) => a + Math.abs(r.weightedDeviation ?? 0), 0);

  return {
    cells: rows,
    totalDecisions: total,
    wellSampledCells: wellSampled.length,
    thinCells: rows.length - wellSampled.length,
    minCellN,
    // The single number: total frequency-weighted absolute deviation from the derived floor
    // over well-sampled cells. NOT an EV figure — converting it to money needs the game
    // tree, and claiming otherwise would be the kind of unearned number ADR-009 exists to
    // stop.
    deviationVolume: volume,
  };
};

/**
 * Wrap the map in a Result Card.
 *
 * Note what is NOT claimed: `estimand` says deviation-from-floor, not EV. The map measures
 * how far the pool sits from an indifference baseline; turning that into dollars requires
 * the game tree and is a different measurement with a different card.
 */
export const deviationMapResultCard = ({
  map, stamp, dealBookId, fieldId, surfaceId = 'derived-floor-ws333', rakeLabel = 'none',
}) => {
  const manifest = buildReplicationManifest(stamp);
  return buildResultCard({
    resultCardId: `RC-deviation-map-${rakeLabel}-${String(stamp.dealBookHash).replace('sha256:', '').slice(0, 8)}`,
    match: { surfaceId, dealBookId, fieldId },
    estimand:
      'Frequency-weighted deviation of observed pool continuation frequency from the '
      + 'MDF-derived unexploitable floor, per geometry cell (bet-to-pot bucket x SPR band x '
      + 'action-closes). A deviation, NOT an EV figure — converting it to money requires the '
      + 'game tree and is a separate measurement.',
    treatment:
      'per-geometry-cell continuation frequency vs derived floor · one-decision horizon · '
      + 'EVAL-half observations · thin cells flagged, never dropped',
    metrics: {
      kind: 'deviation-map', // WS-434: dispatches to SOR_SCHEMAS['metrics.deviation-map']
      deviationVolume: map.deviationVolume,
      totalDecisions: map.totalDecisions,
      wellSampledCells: map.wellSampledCells,
      thinCells: map.thinCells,
      minCellN: map.minCellN,
      topCells: map.cells.slice(0, 10).map((c) => ({
        cell: c.cell, n: c.n, thin: c.thin,
        observed: c.observedContinuation, floor: c.requiredContinuation,
        deviation: c.deviation, weighted: c.weightedDeviation, reads: c.reads,
      })),
    },
    // Players, never hands — decisions inside one player are not independent.
    clusterUnit: 'players',
    admissibility: {
      admissible: map.wellSampledCells > 0,
      blockers: map.wellSampledCells > 0 ? [] : [{
        code: 'NO_WELL_SAMPLED_CELLS',
        detail: `Every geometry cell is below the ${map.minCellN}-decision bar. The map is `
          + 'shaped correctly and says nothing.',
      }],
      warnings: map.thinCells > map.wellSampledCells ? [{
        code: 'MOSTLY_THIN',
        detail: `${map.thinCells} of ${map.cells.length} cells are thin. The volume figure is `
          + 'dominated by well-sampled cells and does not describe the tail.',
      }] : [],
      clusters: map.wellSampledCells,
    },
    manifest,
  });
};
