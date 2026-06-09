'use strict';

/**
 * engine-rule — translates an engine-readiness-registry rule failure.
 *
 * Input detail shape (built by cwos-frame.js inferReadiness from the rule
 * + engine + target):
 *   { engine, rule_check, rule_program?, rule_path?, rule_glob?, rule_min?,
 *     reason }
 *
 * The rule.reason text in the registry is already curated by the kit author,
 * but it leaks engineer vocabulary ("baseline_run", "min_count"). This
 * translator wraps each check type in plain language and produces a concrete
 * next action grounded in the check's specifics.
 *
 * override_cost is 'high' for engine-rule defers by default — these are
 * per-engine prerequisites the kit author marked as load-bearing for the
 * engine's output validity.
 */

function translate(detail) {
  const d = detail || {};
  const engine = d.engine || 'this engine';

  if (d.rule_check === 'baseline_run') {
    const program = d.rule_program || 'the target program';
    return {
      plain_text: `${engine} wants at least one prior baseline run for ${program} before it has enough history to compare against.`,
      suggested_action: `Run ${engine} once with mode=baseline (or use --just-run this once to seed the baseline).`,
      override_cost: 'medium',
      override_warning: `Running anyway means the engine has nothing to compare against — the output is a snapshot, not a delta.`,
    };
  }

  if (d.rule_check === 'min_count') {
    const min = d.rule_min || 1;
    const glob = d.rule_glob || 'the expected files';
    return {
      plain_text: `${engine} expects at least ${min} ${glob} to exist before its analysis is meaningful.`,
      suggested_action: `Add the missing items, or pick a different engine that fits the current state.`,
      override_cost: 'high',
      override_warning: `Running anyway means the engine analyzes a partial set — patterns it finds may not generalize.`,
    };
  }

  if (d.rule_check === 'file_exists') {
    const p = d.rule_path || 'a required file';
    return {
      plain_text: `${engine} needs ${p} to exist before it can run.`,
      suggested_action: `Create ${p} (often this is system/intention.md or a similar grounding doc).`,
      override_cost: 'high',
      override_warning: `Running anyway means the engine has no grounding context — output may be unfocused.`,
    };
  }

  // Unknown check type — fall back to the curated rule.reason text.
  return {
    plain_text: d.reason || `${engine} has a prerequisite that hasn't been met.`,
    suggested_action: 'Address the prerequisite, or use --just-run to override.',
    override_cost: 'high',
    override_warning: 'Running anyway means a kit-author-marked prerequisite is being skipped.',
  };
}

module.exports = { translate };
