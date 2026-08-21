/**
 * @file detectWithRules — the leak-matching loop, with no opinion about where rules come from.
 *
 * WHY THIS IS SPLIT OUT (2026-08-21).
 *
 * `heroLeakDetector.js` builds its registry with `import.meta.glob`, which is a Vite
 * transform. In plain Node that expression is `undefined`, so the module throws a TypeError
 * DURING EVALUATION — `detectHeroLeaks` cannot even be imported, let alone called. That made
 * every leak rule unreachable from any node-side instrument, including the session-review
 * runner, which needs exactly these rules to locate spot classes in a played session.
 *
 * The obvious fixes were both worse:
 *   - Reimplementing the loop in the runner gives two copies of the matching logic, and the
 *     repo has been bitten repeatedly by two objects that are supposed to agree with nothing
 *     forcing them to meet.
 *   - Replacing the glob with a hand-maintained barrel file would kill the property
 *     `skillAssessment/CLAUDE.md` calls principle #1 — "rules are content, not code", adding a
 *     rule is adding a file and the detector never changes.
 *
 * So the LOOP lives here and takes its rules as an argument. The browser keeps its glob
 * registry; Node passes an explicit array. One implementation, two ways of finding the rules.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHAT A FIRED RULE MEANS — AND WHAT IT DOES NOT
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * A rule fires by comparing hero's frequency against a SOLVER baseline, and every one of the
 * 32 entries in `solverBaselines.js` carries `source: 'hardcoded'` — they are estimates
 * attributed to solver software, not anything measured from a table the founder has played.
 *
 * That makes a fired rule a LOCATOR, not a verdict. It says "this spot class is worth pricing";
 * it does not say hero was wrong. Under this repo's own frame (ADR-009 pier posts) an
 * equilibrium reference is the LOWER post, and deliberately deviating from it toward a field's
 * exploitable tendency is the entire point of the system — so scoring that deviation as a leak
 * inverts the objective. Callers that report money must price the spot against Pool Best
 * Response and treat these hits as the shortlist of where to look.
 */

/** Rules read one of two parallel bucket families; a rule must never see the wrong one. */
export const BUCKET_TYPES = Object.freeze({ ACTION: 'action', DECISION: 'decision' });

/**
 * Run leak rules against accumulator output.
 *
 * @param {object} accumulatorOutput  - Output of `accumulateHeroDecisions()`.
 * @param {Array<{rule: object}>|Array<object>} rules - Registry entries or bare rule objects.
 * @param {object}   [options]
 * @param {function}  options.baselineLookup - Required. Resolves a baseline key to a baseline.
 * @param {function} [options.now] - () => ms. Injected so output can be byte-stable; the rules
 *   themselves stamp `Date.now()` internally, which a Result Card hash cannot tolerate.
 * @returns {Array<object>} fired leaks, empty if none
 */
export const detectWithRules = (accumulatorOutput, rules, options = {}) => {
  if (!accumulatorOutput?.buckets) return [];
  const lookupBaseline = options.baselineLookup;
  if (typeof lookupBaseline !== 'function') {
    throw new TypeError(
      'detectWithRules: options.baselineLookup is required. It is not defaulted on purpose — '
      + 'a caller that silently got the hardcoded solver table would be reporting a comparison '
      + 'it never chose to make.',
    );
  }

  // Accept either registry entries ({ path, rule }) or bare rule objects.
  const normalized = (rules || [])
    .map((r) => (r && typeof r === 'object' && 'rule' in r ? r.rule : r))
    .filter(Boolean);

  // Deterministic iteration, so two runs over the same session produce the same order.
  const ordered = [...normalized].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const actionRules = ordered.filter((r) => (r.bucketType ?? BUCKET_TYPES.ACTION) === BUCKET_TYPES.ACTION);
  const decisionRules = ordered.filter((r) => r.bucketType === BUCKET_TYPES.DECISION);

  const fired = [];

  const run = (buckets, ruleSet) => {
    for (const bucket of Object.values(buckets || {})) {
      for (const rule of ruleSet) {
        if (!rule.matchesBucket(bucket.situationKey)) continue;
        const baseline = lookupBaseline(rule.solverBaselineKey(bucket.situationKey));
        const leak = rule.detect(bucket, baseline);
        if (leak) fired.push(leak);
      }
    }
  };

  run(accumulatorOutput.buckets, actionRules);
  if (decisionRules.length) run(accumulatorOutput.decisionBuckets, decisionRules);

  return fired;
};

/**
 * Strip the wall-clock stamp the rules bake in.
 *
 * Every rule file sets `lastUpdatedAt: Date.now()` on the object it returns, so two runs over
 * identical input differ byte-for-byte. That is fine for a UI and fatal for anything hashed
 * into a Result Card manifest, where a changing hash would falsely signal that the underlying
 * measurement changed.
 */
export const stabilizeLeaks = (leaks, stampedAt) => (leaks || []).map(
  ({ lastUpdatedAt, ...rest }) => ({ ...rest, stampedAt }),
);
