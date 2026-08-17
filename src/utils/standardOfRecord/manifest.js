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
 * The value each registered field takes when the caller supplies nothing.
 *
 * BOUND TO `MANIFEST_SCHEMA` BY TEST — a field registered in schemas.js with no entry here
 * fails at authoring time, which is the only moment anyone is looking.
 *
 * `undefined` is a DELIBERATE default for the required fields, not an oversight. See the note
 * on `manifestProblems` below: the semantic checks are written against a manifest whose keys
 * are all PRESENT, an omitted argument arriving as a present key holding `undefined`. Making
 * these `null` instead would change which check fires and what it says.
 */
export const MANIFEST_DEFAULTS = Object.freeze({
  engineCommit: undefined,
  engineDirty: undefined,
  dealBookHash: undefined,
  fieldVersion: null,
  partition: null,
  seeds: undefined,
  unseededSources: undefined,
  constants: undefined,
  disclaimerRegisterVersion: null,
  knownDivergences: [],
  // WS-504. HOW the cap drew this sample across the corpus directories.
  fileSelection: null,
});

/**
 * Build a replication manifest.
 *
 * The field list lives in ONE place — `MANIFEST_SCHEMA` in schemas.js. Read it there; it
 * carries each field's type, its `since` version, and the note explaining why it exists.
 * Defaults for omitted fields are `MANIFEST_DEFAULTS` above.
 *
 * WHY THIS IS SCHEMA-DRIVEN AND NOT A HAND-WRITTEN DESTRUCTURE (WS-504). It used to name ten
 * parameters and rebuild the object from them, so the producer carried a SECOND copy of the
 * field list that nothing bound to the first. `fileSelection` was registered in
 * `MANIFEST_FIELDS`, snapshotted into `schema-baseline.json` and asserted by `schemas.test.js`
 * — and silently dropped here, so the Result Card that IS the claim under ADR-009 carried no
 * record of how its sample was drawn. A registry whose producer can disagree with it is not a
 * registry.
 *
 * WHY NOT A BARE `{...input}` PASSTHROUGH, which would also have fixed that. Unknown extra
 * fields are deliberately allowed by `checkAgainstSchema` (schemas.js) so a newer producer
 * cannot break an older reader, and `manifestProblems` adds no key-set check — so nothing
 * anywhere would catch `fileSelectoin` on its way into a published artifact. Iterating the
 * schema fixes the dropped-field defect without opening that one.
 *
 * @param {Object} input - keyed by the names in MANIFEST_SCHEMA
 */
export const buildReplicationManifest = (input = {}) => {
  const manifest = {};
  for (const field of MANIFEST_SCHEMA) {
    const supplied = input[field.name];
    const fallback = MANIFEST_DEFAULTS[field.name];
    // Cloned, so two manifests built in one process cannot share a mutable default.
    manifest[field.name] = supplied !== undefined
      ? supplied
      : (Array.isArray(fallback) ? [...fallback] : fallback);
  }
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
