/**
 * manifest.js — the replication manifest, assembled and checked.
 *
 * ADR-009's decision in one object: a comparative claim must name the engine commit, the
 * corpus/Deal Book hash, the Field version, the partition, EVERY SEED, and every load-bearing
 * constant the result depends on. This module builds that object and refuses to build a
 * partial one.
 *
 * WHY THE CONSTANTS ARE INJECTED RATHER THAN IMPORTED HERE. The repo rule is that utils take
 * their constants as parameters, and it matters more than usual in this case: the whole point
 * of stamping `PRIOR_WEIGHT` is to record the value THE RUN ACTUALLY USED. A manifest module
 * that imported the constant itself would record the value at manifest-build time, which is
 * the same number right up until the day it is not — a sweep, an override, a stale bundle —
 * and on that day the manifest would confidently record a value the run never saw. So the
 * caller reads the definition sites and passes what it read. `scripts/backtest/replicationStamp.mjs`
 * is that caller for the measurement harness.
 *
 * THE SAME ARGUMENT APPLIES TO SEEDS. `ipsEstimator` and `evCost` both default to
 * `0x9e3779b9`, deterministically, and neither writes it anywhere. A default that is never
 * recorded is not reproducible — it is reproducible-by-luck, and it stops being reproducible
 * the first time someone changes a default and reruns an old comparison.
 */

import { MANIFEST_SCHEMA, StandardOfRecordError, checkAgainstSchema } from './schemas.js';
import { REGISTER_VERSION_PATTERN, isRegisterVersionShape } from './faultRegister.js';

/**
 * The constants ADR-009 names as the MINIMUM set. A manifest missing any of these is refused.
 *
 * "Minimum" is doing real work here — a run that depends on a constant not on this list must
 * still stamp it. The list is a floor, not a schema.
 */
export const REQUIRED_CONSTANTS = Object.freeze([
  'PRIOR_WEIGHT',
  'ACTION_TAU_FRACTION',
  'MIN_CONTINUATION_WEIGHT',
  // WS-432. The refinement configuration is load-bearing for any engine-derived figure:
  // after WS-334 the budget is the difference between two materially different engines, and
  // under the logical clock (refinementWork.js) these three fully determine which
  // refinement stages complete. `REFINEMENT_BUDGET_MS` is the ONE canonical key — an
  // object keyed by arm id for multi-arm runs (the `_DEPTH1/_DEPTH2` vs `_FAST/_FULL`
  // suffix collision on the pre-WS-432 cards is exactly what a canonical key prevents).
  'REFINEMENT_BUDGET_MS',
  'MAX_STAGE_SHARE',
  'REFINEMENT_UNITS_PER_MS',
  // FIND-090 (WS-432 scope extension). VOCABULARY.md has stated since WS-336 that KL_FLOOR
  // is stamped into manifest.constants as a rule; only layerAblation actually did it — the
  // WS-322 shadow-constant class recurring. Canonical site: standardOfRecord/divergence.js.
  'KL_FLOOR',
]);

/**
 * Build a replication manifest.
 *
 * @param {Object} input
 * @param {string} input.engineCommit - git rev-parse HEAD
 * @param {boolean} input.engineDirty - uncommitted changes present at run time
 * @param {string} input.dealBookHash - content hash of the hand set
 * @param {string|null} input.fieldVersion
 * @param {string|null} input.partition - POOL/EVAL stamp + walk-forward prefix
 * @param {Object} input.seeds - every seed used, by name
 * @param {Array} input.unseededSources - randomness the run could not seed; [] claims determinism
 * @param {Object} input.constants - load-bearing constants, read from their definition sites
 * @param {string} input.disclaimerRegisterVersion - `registerVersion()` from faultRegister.js
 * @param {Array} [input.knownDivergences] - see below
 */
export const buildReplicationManifest = ({
  engineCommit,
  engineDirty,
  dealBookHash,
  fieldVersion = null,
  partition = null,
  seeds,
  unseededSources,
  constants,
  disclaimerRegisterVersion = null,
  knownDivergences = [],
} = {}) => {
  const manifest = {
    engineCommit,
    engineDirty,
    dealBookHash,
    fieldVersion,
    partition,
    seeds,
    unseededSources,
    constants,
    disclaimerRegisterVersion,
    knownDivergences,
  };
  const problems = manifestProblems(manifest);
  if (problems.length) {
    throw new StandardOfRecordError(
      `replication manifest is incomplete:\n  - ${problems.join('\n  - ')}`,
      { problems },
    );
  }
  return manifest;
};

/**
 * Problems with a manifest, as strings. Empty means complete.
 *
 * Separate from the builder so WS-329's scanner can check an EXISTING artifact without
 * rebuilding it — the check and the construction must not be able to disagree.
 */
export const manifestProblems = (manifest) => {
  // The semantic checks run BEFORE the schema check and short-circuit it, because the generic
  // "must be array, got undefined" the schema produces is true and useless. A builder sets
  // every key from its destructured parameters, so an omitted argument arrives as a PRESENT
  // key holding undefined — which reads to the schema as a type error rather than a missing
  // field, and silently loses the field's note. These messages are the ones worth reading.
  if (!Array.isArray(manifest?.unseededSources)) {
    return [
      'manifest.unseededSources must be an array. An empty array is a POSITIVE CLAIM that the ' +
      'run is bit-reproducible; omitting the field would make that claim by accident',
    ];
  }

  const problems = checkAgainstSchema(manifest, MANIFEST_SCHEMA, { label: 'manifest' });
  if (problems.length) return problems;

  if (!manifest.engineCommit || typeof manifest.engineCommit !== 'string') {
    problems.push('manifest.engineCommit must name a real commit');
  }
  if (!manifest.dealBookHash || !String(manifest.dealBookHash).startsWith('sha256:')) {
    problems.push(
      'manifest.dealBookHash must be a sha256 content hash — a path or a file count cannot ' +
      'detect that the corpus changed underneath a rerun',
    );
  }
  if (!manifest.seeds || typeof manifest.seeds !== 'object') {
    problems.push('manifest.seeds must be an object (empty is legal, absent is not)');
  }
  for (const name of REQUIRED_CONSTANTS) {
    if (!manifest.constants || manifest.constants[name] === undefined) {
      problems.push(
        `manifest.constants.${name} is missing — ADR-009 names it in the minimum constant set`,
      );
    }
  }

  // WS-330. A card that cannot name the register version it stood under cannot be
  // retroactively flagged when one of that register's entries is confirmed — which is the
  // entire mechanism WS-291 needed and did not have.
  //
  // NOTE THE DELIBERATE ASYMMETRY with the field descriptor, which stays `required: false`.
  // Validation tightens here; PARSING does not, because `checkAgainstSchema` is what the
  // flagger uses to open an existing card, and a rule that made legacy cards unreadable would
  // mean the cards most likely to be contaminated are exactly the ones the mechanism cannot
  // open. A card missing this is invalid to PUBLISH and still legible to AUDIT.
  // WS-353 FOLLOW-UP — THE PRESENCE CHECK WAS NOT THE WHOLE CHECK.
  //
  // The rule above was `if (!manifest.disclaimerRegisterVersion)`. That does reject `null`, `''`
  // and an absent key — but it accepts ANY non-empty string: `'unknown'`, `'v1'`, a hand-typed
  // near-miss, a placeholder somebody meant to replace. The stamp has exactly one job, which is
  // to be JOINED back to a register version when a fault is confirmed so the results that stood
  // on it can be found. A string that cannot be joined does none of that while passing the check
  // — and is strictly worse than `null`, because `null` states that the card cannot name its
  // register while an unjoinable string asserts that it can.
  //
  // The shape lives in `faultRegister.js` beside the function that mints it, so the checker
  // cannot drift from the producer.
  if (!manifest.disclaimerRegisterVersion) {
    problems.push(
      'manifest.disclaimerRegisterVersion is missing — every Result Card must name the '
      + 'suspected-fault register version it was produced under, or confirming a fault later '
      + 'cannot tell which prior results it invalidates. Stamp `registerVersion()` from '
      + 'src/utils/standardOfRecord/faultRegister.js',
    );
  } else if (!isRegisterVersionShape(manifest.disclaimerRegisterVersion)) {
    problems.push(
      `manifest.disclaimerRegisterVersion "${manifest.disclaimerRegisterVersion}" is not a `
      + `register version — it must match ${REGISTER_VERSION_PATTERN} (epoch + 12-hex content `
      + 'hash). A value that cannot be joined back to a register version is worse than no value: '
      + 'it claims the card can be traced when it cannot. Stamp `registerVersion()` from '
      + 'src/utils/standardOfRecord/faultRegister.js rather than writing the field by hand',
    );
  }
  return problems;
};

/**
 * Record a place where a stamped value is known to disagree with a copy elsewhere in the tree.
 *
 * The live case: `exploitEngine/foldEquityCalculator.js:563` declares a LOCAL
 * `const PRIOR_WEIGHT = 10` that shadows the canonical one in
 * `rangeEngine/populationPriors.js:66`. Today they hold the same value, so nothing is wrong
 * yet — and that is exactly the condition under which a divergence becomes invisible. Stamping
 * the canonical value and recording the shadow beats silently picking one, because the day the
 * two drift apart the manifest will already say where to look.
 */
export const knownDivergence = ({ name, canonical, shadowAt, shadowValue, note }) => ({
  name,
  canonical,
  shadowAt,
  shadowValue,
  // THREE-VALUED ON PURPOSE. `null` means the shadow could not be read at all — which is the
  // live case, because the `foldEquityCalculator` copy is module-local and not exported. A
  // boolean here would have to pick between claiming agreement we did not verify and claiming
  // a disagreement we did not observe, and both are assertions nothing checked. That is the
  // failure mode this whole standard exists to remove, so it would be a poor place to commit it.
  agrees: shadowValue === null || shadowValue === undefined ? null : canonical === shadowValue,
  note: note ?? null,
});
