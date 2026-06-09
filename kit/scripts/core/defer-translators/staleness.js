'use strict';

/**
 * staleness — translates a staleness violation into plain language.
 *
 * Input detail shape (from cwos-staleness violations[i]):
 *   { file, type: 'stale'|'no_last_updated_header'|'missing_required_file',
 *     days_since?, max_days?, message }
 *
 * Output:
 *   plain_text — what's wrong, no token-prefix, no SLA jargon
 *   suggested_action — a concrete next step
 *   override_cost — 'high' when the file is load-bearing (referenced by an
 *     active AS-N tag or named in invariants), else 'medium'
 *   override_warning — populated when override_cost is 'high'
 *
 * The high-cost branch is heuristic for v1: any file under system/ is treated
 * as load-bearing. Future iteration can read system/intention.md AS-N refs +
 * invariants.md to be more precise.
 */

function translate(detail) {
  const d = detail || {};
  const file = d.file || 'a tracked file';

  if (d.type === 'missing_required_file') {
    return {
      plain_text: `The required file ${file} is missing.`,
      suggested_action: `Create ${file} (see system/staleness-sla.yaml for what it tracks).`,
      override_cost: 'high',
      override_warning: `Running anyway means the engine has no record of ${file}.`,
    };
  }

  if (d.type === 'no_last_updated_header') {
    return {
      plain_text: `${file} has no parseable "Last updated:" header, so freshness can't be verified.`,
      suggested_action: `Add a "Last updated: YYYY-MM-DD" line near the top of ${file}.`,
      override_cost: 'low',
      override_warning: '',
    };
  }

  // type === 'stale' (or unspecified)
  const days = d.days_since;
  const max = d.max_days;
  const ageClause = (typeof days === 'number' && typeof max === 'number')
    ? `is ${days} days old (target: refresh every ${max} days).`
    : 'is older than its refresh target.';
  const loadBearing = isLoadBearing(file);

  return {
    plain_text: `${file} ${ageClause}`,
    suggested_action: `Update its "Last updated:" header in ${file} (or retire the doc if it's no longer active).`,
    override_cost: loadBearing ? 'high' : 'medium',
    override_warning: loadBearing
      ? `Running anyway means the engine treats ${file} as current — risky if the doc has drifted.`
      : '',
  };
}

function isLoadBearing(file) {
  if (typeof file !== 'string') return false;
  return file.startsWith('system/') || /\binvariant/i.test(file) || /-plan\.md$/i.test(file);
}

module.exports = { translate, isLoadBearing };
