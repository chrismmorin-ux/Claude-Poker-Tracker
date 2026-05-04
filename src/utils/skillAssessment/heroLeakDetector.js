/**
 * @file Hero-leak detector — registry pattern over leakRules/.
 *
 * Auto-loads all rules from leakRules/ via Vite's import.meta.glob (matches
 * the existing pattern from heroState/loadTemplates.js + cardRegistry.js).
 * Iterates rules against accumulator buckets, returns array of fired leaks.
 *
 * Adding a new rule = creating a new file in leakRules/ + adding solver
 * baselines if needed. No detector code changes.
 *
 * Per CLAUDE.md anti-pattern: rules MUST be independent. Each rule's detect()
 * reads only from its accumulator bucket + solver baseline; never from other
 * rules' fired-state.
 */

import { getSolverBaseline } from './solverBaselines.js';

// Auto-load all rule files. Excludes _template.js (not a real rule).
const ruleModules = import.meta.glob('./leakRules/*.js', { eager: true });

const REGISTRY = (() => {
  const out = [];
  for (const [path, mod] of Object.entries(ruleModules)) {
    if (path.endsWith('/_template.js')) continue;
    if (!mod?.rule) {
      // eslint-disable-next-line no-console
      console.warn(`[skillAssessment] Rule file ${path} does not export a 'rule' object; skipping`);
      continue;
    }
    out.push({ path, rule: mod.rule });
  }
  // Sort for deterministic iteration (stable test snapshots).
  out.sort((a, b) => a.rule.id.localeCompare(b.rule.id));
  return out;
})();

/**
 * Iterate all registered leak rules against the accumulator buckets, return
 * the array of fired leaks (CD-5-compliant claim objects).
 *
 * @param {object} accumulatorOutput - Output of accumulateHeroDecisions().
 * @param {object} [options]
 * @param {function} [options.baselineLookup] - Override (test injection).
 * @returns {Array<object>} - Fired leaks; empty if none.
 */
export const detectHeroLeaks = (accumulatorOutput, options = {}) => {
  if (!accumulatorOutput?.buckets) return [];
  const lookupBaseline = options.baselineLookup || getSolverBaseline;

  const fired = [];
  for (const bucket of Object.values(accumulatorOutput.buckets)) {
    for (const { rule } of REGISTRY) {
      if (!rule.matchesBucket(bucket.situationKey)) continue;
      const baselineKey = rule.solverBaselineKey(bucket.situationKey);
      const baseline = lookupBaseline(baselineKey);
      const leak = rule.detect(bucket, baseline);
      if (leak) fired.push(leak);
    }
  }
  return fired;
};

/**
 * Diagnostic: list all registered rule IDs (for tests + catalog sync).
 */
export const listRegisteredRules = () => REGISTRY.map(({ rule }) => rule.id).sort();

/**
 * Diagnostic: get rule by id (for tests).
 */
export const getRuleById = (id) => {
  const entry = REGISTRY.find(({ rule }) => rule.id === id);
  return entry ? entry.rule : null;
};
