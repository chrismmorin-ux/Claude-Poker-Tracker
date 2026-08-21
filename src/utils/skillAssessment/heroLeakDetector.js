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
// The matching loop lives in its own module so plain Node can run it. This file keeps the
// `import.meta.glob` registry, which is Vite-only and is what made the whole tree
// unimportable outside the browser. See detectWithRules.js for the full reasoning.
import { detectWithRules } from './detectWithRules.js';

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
 * The loop itself is `detectWithRules` — shared with the node-side session-review runner so
 * there is exactly one implementation of rule matching. This function's only job is to supply
 * the browser's glob-built registry and the default solver-baseline lookup.
 *
 * @param {object} accumulatorOutput - Output of accumulateHeroDecisions().
 * @param {object} [options]
 * @param {function} [options.baselineLookup] - Override (test injection).
 * @returns {Array<object>} - Fired leaks; empty if none.
 */
export const detectHeroLeaks = (accumulatorOutput, options = {}) => detectWithRules(
  accumulatorOutput,
  REGISTRY,
  { baselineLookup: options.baselineLookup || getSolverBaseline },
);

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
