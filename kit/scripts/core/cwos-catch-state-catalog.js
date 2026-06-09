/**
 * cwos-catch-state-catalog — disambiguation pair catalog (WS-300, ADR-040 Decision #5).
 *
 * Single source of truth for "when two engines could plausibly route a
 * candidate, which one wins?" Each pair is a deterministic predicate over
 * conversation signals. When neither side of the predicate fires (or both
 * fire in conflict), the result is `ambiguous` and the classifier escalates
 * to LLM fallback (per ADR-040's anti-LLM-first stance — rule-tier wins
 * when it can; LLM is the safety net).
 *
 * **Anti-pattern guarded:** ADR-040 prohibits "hand-tuned per-engine rules
 * sprawled across the codebase." Every catch-state-aware disambiguation MUST
 * resolve through this module — `INV-disambiguation-catalog-single-source`.
 *
 * The 5 pairs (per WS-300 + ADR-040 Decision #5):
 *   1. decision-enhance vs plan-enhance
 *   2. decision-enhance vs design-critique
 *   3. plan-enhance vs sprint-enhance
 *   4. eng-engine vs design-critique
 *   5. refactor-prep vs migration-prep vs upgrade-prep (3-way)
 *
 * Public API:
 *   disambiguate(engineA, engineB, input) → engineId | 'ambiguous'
 *   listPairs() → array of { engines: [...], description }
 *
 * Input shape (matches cwos-catch-state.js classify input):
 *   {
 *     turnText: string,           // most recent founder turn
 *     conversationText: string,   // last N turns concatenated (N=5)
 *     activeEngineContext: string|null,
 *     ...
 *   }
 */

'use strict';

// ─── Helper: case-insensitive whole-word match ─────────────────────────────

function hasAny(text, patterns) {
  if (!text) return false;
  const t = text.toLowerCase();
  return patterns.some((p) => (p instanceof RegExp ? p.test(t) : t.indexOf(p.toLowerCase()) !== -1));
}

// ─── Pair 1: decision-enhance vs plan-enhance ─────────────────────────────
// decision-enhance: founder is choosing between two paths (binary tradeoff).
// plan-enhance: founder is sequencing work (multi-step decomposition).
// Signal: presence of sequencing vocab tilts toward plan-enhance; presence of
// binary tradeoff vocab tilts toward decision-enhance.
function disambiguateDecisionVsPlan(input) {
  const text = (input.conversationText || input.turnText || '').toLowerCase();
  const planSignals = hasAny(text, [
    /\bbreak (?:this|it|down|the work)\b/,
    /\bsequenc(?:e|ing)\b/,
    /\bsteps? (?:to|for)\b/,
    /\b(?:scope|plan|map out) the (?:work|migration|rollout)\b/,
    /\border of operations\b/,
    /\bwhat'?s the order\b/,
  ]);
  const decisionSignals = hasAny(text, [
    /\b(?:should i|should we) (?:choose|pick|use|go with)\b/,
    /\b(?:x or y|x vs y|or which one)\b/,
    /\b(?:tradeoff|trade[- ]?off)\b/,
    /\b(?:which is better)\b/,
  ]);
  if (planSignals && !decisionSignals) return 'plan-enhance';
  if (decisionSignals && !planSignals) return 'decision-enhance';
  return 'ambiguous';
}

// ─── Pair 2: decision-enhance vs design-critique ─────────────────────────
// decision-enhance: choosing between paths/options.
// design-critique: evaluating an existing design artifact for soundness.
// Signal: a target artifact (design doc, mockup, spec) tilts toward critique;
// pure choice phrasing without a target tilts toward decision-enhance.
function disambiguateDecisionVsCritique(input) {
  const text = (input.conversationText || input.turnText || '').toLowerCase();
  const critiqueSignals = hasAny(text, [
    /\b(?:review|critique|audit|evaluate|assess) (?:my|our|this) (?:design|spec|mockup|plan|approach)\b/,
    /\bwhat'?s wrong with\b/,
    /\bis (?:this|the) design (?:right|sound|sensible)\b/,
    /\bdoes (?:this|my) (?:design|spec|approach) hold up\b/,
  ]);
  const decisionSignals = hasAny(text, [
    /\b(?:should i|should we) (?:choose|pick|go with)\b/,
    /\b(?:option a|option b|approach 1|approach 2)\b/,
    /\b(?:x or y|x vs y)\b/,
  ]);
  if (critiqueSignals && !decisionSignals) return 'design-critique';
  if (decisionSignals && !critiqueSignals) return 'decision-enhance';
  return 'ambiguous';
}

// ─── Pair 3: plan-enhance vs sprint-enhance ──────────────────────────────
// plan-enhance: scoping a multi-step initiative (longer horizon, broader).
// sprint-enhance: tightening an active-or-imminent sprint plan (shorter horizon).
// Signal: explicit "sprint" / "this batch" / "next sprint" tilts to sprint-enhance;
// abstract scoping vocab tilts to plan-enhance.
function disambiguatePlanVsSprint(input) {
  const text = (input.conversationText || input.turnText || '').toLowerCase();
  const sprintSignals = hasAny(text, [
    /\b(?:this|the next|the upcoming) sprint\b/,
    /\b(?:tighten|refine|adjust) (?:this|the) (?:sprint|batch)\b/,
    /\bsprint (?:items|plan|composition)\b/,
    /\bspr-\d+\b/,
  ]);
  const planSignals = hasAny(text, [
    /\bplan (?:the|this|out) (?:initiative|workstream|migration|rollout)\b/,
    /\b(?:scope|map out) the (?:work|effort)\b/,
    /\bbreak (?:this|it) down\b/,
  ]);
  if (sprintSignals && !planSignals) return 'sprint-enhance';
  if (planSignals && !sprintSignals) return 'plan-enhance';
  return 'ambiguous';
}

// ─── Pair 4: eng-engine vs design-critique ───────────────────────────────
// eng-engine: adversarial roundtable on code/program (engineering health).
// design-critique: focused critique of a design artifact (often pre-build).
// Signal: target type — code/program tilts to eng-engine; design doc/mockup
// tilts to design-critique. Vocabulary cues sharpen the choice.
function disambiguateEngVsCritique(input) {
  const text = (input.conversationText || input.turnText || '').toLowerCase();
  const engSignals = hasAny(text, [
    /\b(?:audit|review) (?:the|this) (?:codebase|module|system|program)\b/,
    /\b(?:find|surface) (?:bugs|risks|failure modes|invariants)\b/,
    /\b(?:reliability|performance|security|architecture) (?:audit|review)\b/,
    /\bprog-[a-z-]+\b/,
  ]);
  const critiqueSignals = hasAny(text, [
    /\b(?:review|critique) (?:my|our|this) (?:design|spec|mockup|wireframe)\b/,
    /\bdesign[- ]critique\b/,
    /\bbefore (?:i|we) build\b/,
  ]);
  if (engSignals && !critiqueSignals) return 'eng-engine';
  if (critiqueSignals && !engSignals) return 'design-critique';
  return 'ambiguous';
}

// ─── Pair 5: refactor-prep vs migration-prep vs upgrade-prep ─────────────
// 3-way disambiguation. Signal:
//   refactor-prep: changing internal structure, same external behavior
//   migration-prep: moving data/config/users between systems
//   upgrade-prep: bumping a dependency / framework / language version
function disambiguateRefactorMigrationUpgrade(input) {
  const text = (input.conversationText || input.turnText || '').toLowerCase();
  const upgradeSignals = hasAny(text, [
    /\bupgrad(?:e|ing) (?:from|to)\b/,
    /\bbump (?:the )?(?:version|dependency)\b/,
    /\b(?:node|python|go|react|next\.?js) \d+(?:\.\d+)?\b/,
    /\b(?:framework|library|runtime) upgrade\b/,
  ]);
  const migrationSignals = hasAny(text, [
    /\bmigrat(?:e|ion|ing)\b.*\b(?:from|to)\b/,
    /\bmove (?:data|users|content) (?:from|to)\b/,
    /\bdata migration\b/,
    /\b(?:cutover|cut[- ]over|switchover)\b/,
  ]);
  const refactorSignals = hasAny(text, [
    /\brefactor(?:ing)?\b/,
    /\b(?:restructur|reorganiz)(?:e|ing|ation)\b/,
    /\bextract (?:a |the )?(?:module|function|component)\b/,
    /\b(?:simplify|clean up) (?:the |this )?(?:code|module|structure)\b/,
  ]);
  // Score = number of signal categories firing.
  const fired = [
    upgradeSignals && 'upgrade-prep',
    migrationSignals && 'migration-prep',
    refactorSignals && 'refactor-prep',
  ].filter(Boolean);
  if (fired.length === 1) return fired[0];
  return 'ambiguous';
}

// ─── Catalog registry ───────────────────────────────────────────────────

const PAIRS = [
  {
    engines: ['decision-enhance', 'plan-enhance'],
    description: 'binary tradeoff (decision-enhance) vs work decomposition (plan-enhance)',
    fn: disambiguateDecisionVsPlan,
  },
  {
    engines: ['decision-enhance', 'design-critique'],
    description: 'choosing between paths (decision-enhance) vs evaluating an artifact (design-critique)',
    fn: disambiguateDecisionVsCritique,
  },
  {
    engines: ['plan-enhance', 'sprint-enhance'],
    description: 'long-horizon scoping (plan-enhance) vs sprint-level tightening (sprint-enhance)',
    fn: disambiguatePlanVsSprint,
  },
  {
    engines: ['eng-engine', 'design-critique'],
    description: 'adversarial code/program audit (eng-engine) vs design artifact critique (design-critique)',
    fn: disambiguateEngVsCritique,
  },
  {
    engines: ['refactor-prep', 'migration-prep', 'upgrade-prep'],
    description: '3-way: structural change, system-to-system move, or version bump',
    fn: disambiguateRefactorMigrationUpgrade,
  },
];

function findPair(engineA, engineB, engineC) {
  const want = new Set([engineA, engineB, engineC].filter(Boolean));
  for (const p of PAIRS) {
    const have = new Set(p.engines);
    if (have.size !== want.size) continue;
    let match = true;
    for (const e of want) if (!have.has(e)) { match = false; break; }
    if (match) return p;
  }
  return null;
}

/**
 * Disambiguate between 2-3 engine candidates using the catalog.
 *   disambiguate(engineA, engineB, input)             → engine | 'ambiguous'
 *   disambiguate(engineA, engineB, engineC, input)    → engine | 'ambiguous'
 *
 * Returns 'ambiguous' when:
 *   - the (engineA, engineB[, engineC]) tuple isn't in the catalog
 *   - the catalog predicate finds no decisive signal
 *
 * Callers MUST handle the 'ambiguous' return by escalating to LLM fallback;
 * never silently default to one engine. (ADR-040 Decision #5.)
 */
function disambiguate(engineA, engineB, ...rest) {
  // Last argument is input; preceding args are engines.
  const input = rest[rest.length - 1];
  const engineC = rest.length > 1 ? rest[0] : null;
  const pair = findPair(engineA, engineB, engineC);
  if (!pair) return 'ambiguous';
  const result = pair.fn(input || {});
  if (!result || result === 'ambiguous') return 'ambiguous';
  // Defensive: predicate returned an engine NOT in the pair → treat as ambiguous.
  if (!pair.engines.includes(result)) return 'ambiguous';
  return result;
}

function listPairs() {
  return PAIRS.map((p) => ({ engines: p.engines.slice(), description: p.description }));
}

module.exports = {
  disambiguate,
  listPairs,
  // Exported for tests + INV-disambiguation-catalog-single-source enforcement.
  PAIRS,
  findPair,
  // Individual predicates exposed for fixture-level testing.
  disambiguateDecisionVsPlan,
  disambiguateDecisionVsCritique,
  disambiguatePlanVsSprint,
  disambiguateEngVsCritique,
  disambiguateRefactorMigrationUpgrade,
};
