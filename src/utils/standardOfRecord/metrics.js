/**
 * metrics.js — the Result Card `metrics` validator (WS-434).
 *
 * The union dispatch over the shapes declared in metricsSchemas.js. Wired into
 * `resultCardProblems` beside `manifestProblems`, with the SAME asymmetry the
 * disclaimerRegisterVersion check established (manifest.js): VALIDATION TIGHTENS HERE;
 * PARSING DOES NOT. `checkAgainstSchema(card, SOR_SCHEMAS.resultCard)` still sees `metrics`
 * as a bare required object, so every card committed before this validator existed stays
 * LEGIBLE to the auditor and the fault-register flagger — it is invalid to PUBLISH and
 * still readable to AUDIT. Their stored `resultCardProblems: []` verdicts were computed
 * under the old rules, the documented stale-verdict situation
 * (DISCLAIMER-AND-FAULT-REGISTER.md).
 *
 * ONE DELIBERATE INVERSION OF checkAgainstSchema's PERMISSIVENESS. For every other object,
 * unknown extra fields are allowed — a newer producer must not break an older reader. For
 * the metrics block of a card being PUBLISHED, unknown top-level keys are REJECTED: the
 * producer and the schema live in one repo and are co-versioned, so strictness costs
 * nothing at publish time, and it is the only mechanism that forces a new key to be
 * DECLARED (with its unit, and a version bump) before it is emitted. Without it the
 * registry rots into an under-declared subset — the exact drift this ticket closes.
 * Readers still use checkAgainstSchema and stay permissive.
 */

import { SOR_SCHEMAS, checkAgainstSchema } from './schemas.js';
import { METRICS_KINDS } from './metricsSchemas.js';

export { METRICS_KINDS };

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Problems with a canonical `{k, n, rate, conditional}` value, beyond field presence/type.
 *
 * The semantic half of the shape: `rate` is k/n and NULL exactly when n is 0. A 0/0
 * reported as 0 would read as a measured absence; a rate that disagrees with its own k/n
 * is a pre-multiplied or stale copy — either way the object is not what it claims to be.
 */
export const conditionedRateProblems = (value, { label = 'conditioned rate' } = {}) => {
  const problems = checkAgainstSchema(value, SOR_SCHEMAS['metrics.shared.conditioned-rate'], { label });
  if (problems.length) return problems;

  const { k, n, rate, conditional } = value;
  if (!Number.isFinite(k) || k < 0) problems.push(`${label}.k must be a finite non-negative count, got ${k}`);
  if (!Number.isFinite(n) || n < 0) problems.push(`${label}.n must be a finite non-negative count, got ${n}`);
  if (Number.isFinite(k) && Number.isFinite(n) && k > n) {
    problems.push(`${label}: k (${k}) exceeds n (${n}) — a numerator larger than its conditioning population is not a rate`);
  }
  if (n === 0) {
    if (rate !== null) {
      problems.push(`${label}.rate must be NULL when n is 0 (got ${rate}) — a 0/0 reported as a number reads as a measured absence`);
    }
  } else if (Number.isFinite(k) && Number.isFinite(n)) {
    if (!Number.isFinite(rate) || Math.abs(rate - k / n) > 1e-9) {
      problems.push(`${label}.rate (${rate}) does not equal k/n (${k}/${n} = ${k / n}) — a rate that disagrees with its own counts is a stale or pre-multiplied copy`);
    }
  }
  if (typeof conditional === 'string' && !/P\(.+\|.+\)/.test(conditional)) {
    problems.push(
      `${label}.conditional "${conditional}" does not state its conditioning set — it must contain a `
      + 'P(event | conditioning) statement, because the denominator a number travels without is the '
      + 'denominator its reader invents',
    );
  }
  return problems;
};

/**
 * The WS-410 Stage 2 both-factors rule, generic across kinds: the product never travels
 * without both of its factors. `composeOverallEv` (scripts/backtest/overallEv.mjs) already
 * makes the product inseparable from its factors at composition time; this is the same
 * rule enforced at the card boundary, so a future producer that bypasses the composer is
 * still caught.
 */
export const overallEvFactorProblems = (metrics, { label = 'resultCard.metrics' } = {}) => {
  if (!isPlainObject(metrics)) return [];
  if (!('overallEvBB100' in metrics) || metrics.overallEvBB100 === null) return [];
  const problems = [];
  for (const factor of ['edgeBB', 'opportunitiesPerHand']) {
    if (!Number.isFinite(metrics[factor])) {
      problems.push(
        `${label}.overallEvBB100 is present but factor ${label}.${factor} is ${metrics[factor]} — the `
        + 'product never travels without BOTH factors beside it (WS-410 Stage 2 / POKER_THEORY §14.2: '
        + 'the decomposition exists to expose the change that improves the rate while shrinking the '
        + 'opportunities). Compose via overallEv.composeOverallEv',
      );
    }
  }
  return problems;
};

/**
 * Problems with a Result Card `metrics` block, as strings. Empty means valid to publish.
 *
 * @param {Object} metrics - the card's metrics value
 * @param {Object} [opts]
 * @param {string} [opts.label]
 */
export const metricsProblems = (metrics, { label = 'resultCard.metrics' } = {}) => {
  if (!isPlainObject(metrics)) return [`${label} must be an object`];

  if (typeof metrics.kind !== 'string' || !metrics.kind) {
    return [
      `${label}.kind is required to PUBLISH — one of ${Object.keys(METRICS_KINDS).join(' | ')}. `
      + 'Legacy cards without it stay READABLE (checkAgainstSchema does not recurse into metrics); '
      + 'they are invalid to publish — the disclaimerRegisterVersion asymmetry (manifest.js). '
      + 'Declare a new kind in metricsSchemas.js rather than emitting an undeclared shape',
    ];
  }

  const schemaName = METRICS_KINDS[metrics.kind];
  if (!schemaName) {
    return [
      `${label}.kind "${metrics.kind}" is not a registered metrics kind. Registered: `
      + `${Object.keys(METRICS_KINDS).join(' | ')}. New estimand family ⇒ declare a new variant in `
      + 'metricsSchemas.js (own SOR_SCHEMA_VERSIONS entry, every field with a unit and a note) — '
      + 'that declaration is what puts the shape under the additive-only gate',
    ];
  }

  const fields = SOR_SCHEMAS[schemaName];
  const problems = checkAgainstSchema(metrics, fields, { label });

  // Strict top-level key check — publish-side only; see the module docblock.
  const declared = new Set(fields.map((f) => f.name));
  for (const key of Object.keys(metrics)) {
    if (!declared.has(key)) {
      problems.push(
        `${label}.${key} is not declared in ${schemaName} (metricsSchemas.js). Declare it — with its `
        + 'unit, its note, and a version bump — before emitting it. An emitted-but-undeclared key is '
        + 'exactly the unguarded drift WS-434 closed',
      );
    }
  }

  // One level of shape recursion for fields that bind to a registered sub-schema.
  for (const f of fields) {
    if (!f.shape) continue;
    const value = metrics[f.name];
    if (value === null || value === undefined) continue; // presence/type already reported above
    const sub = SOR_SCHEMAS[f.shape];
    if (!sub) {
      problems.push(`${label}.${f.name} declares shape "${f.shape}" which is not a registered SOR_SCHEMAS entry`);
      continue;
    }
    if (f.shape === 'metrics.shared.conditioned-rate') {
      problems.push(...conditionedRateProblems(value, { label: `${label}.${f.name}` }));
    } else {
      problems.push(...checkAgainstSchema(value, sub, { label: `${label}.${f.name}` }));
    }
  }

  problems.push(...overallEvFactorProblems(metrics, { label }));
  return problems;
};
