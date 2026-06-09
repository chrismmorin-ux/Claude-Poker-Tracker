'use strict';

/**
 * defer-translators — per-token plain-language renderers for cwos-frame's
 * readiness=defer surface. Closes FIND-127 (WS-291).
 *
 * Each translator module exports `translate(detail) → { plain_text,
 * suggested_action, override_cost }`. This index dispatches by reason type
 * and composes the founder-facing `readiness_human` block:
 *
 *   {
 *     bullets: [plain_text-with-action per reason],
 *     options: [refresh, run-anyway, come-back-later]
 *   }
 *
 * Forward-compat: a reason type with no registered translator is rendered
 * via the generic fallback (plain wrapper, no token-prefix words). The
 * INV-defer-surface-no-machine-strings invariant flags missing translators
 * so unknown types are caught at check-time, not at founder-render-time.
 */

const staleness = require('./staleness');
const session = require('./session');
const engineRule = require('./engine-rule');

const TRANSLATORS = {
  staleness: staleness.translate,
  session: session.translate,
  'engine-rule': engineRule.translate,
};

const KNOWN_TYPES = Object.keys(TRANSLATORS);

function translateOne(reason) {
  if (!reason || typeof reason !== 'object') {
    return genericFallback({ machine_text: String(reason || '') });
  }
  const t = TRANSLATORS[reason.type];
  if (typeof t === 'function') {
    try {
      const out = t(reason.detail || {});
      return normalize(out, reason);
    } catch (_) {
      return genericFallback(reason);
    }
  }
  return genericFallback(reason);
}

function normalize(out, reason) {
  const plain = (out && out.plain_text) || stripTokenPrefix(reason.machine_text || '');
  const action = (out && out.suggested_action) || '';
  const cost = (out && out.override_cost) || 'medium';
  const warning = (out && out.override_warning) || '';
  return {
    plain_text: plain,
    suggested_action: action,
    override_cost: cost,
    override_warning: warning,
  };
}

function genericFallback(reason) {
  return {
    plain_text: stripTokenPrefix(reason && reason.machine_text || ''),
    suggested_action: '',
    override_cost: 'medium',
    override_warning: '',
  };
}

function stripTokenPrefix(s) {
  if (!s) return '';
  return s.replace(/^(staleness|session|engine-rule)\s*:\s*/i, '');
}

/**
 * Compose the founder-facing readiness_human block from a list of structured
 * reasons. Returns { bullets, options }.
 *
 *   reasons: Array<{ type, machine_text, detail }>
 *
 * Bullet shape: each bullet is one plain-language sentence + its own
 * suggested action on the next line. Options are the three OUTCOME-labeled
 * choices the founder picks between. When any reason has override_cost='high'
 * the run-anyway option carries the strongest warning of the group.
 */
function composeReadinessHuman(reasons) {
  const safe = Array.isArray(reasons) ? reasons : [];
  const translated = safe.map(translateOne);

  const bullets = translated.map((t) => {
    if (t.suggested_action) {
      return `${t.plain_text} → ${t.suggested_action}`;
    }
    return t.plain_text;
  });

  const highCostWarnings = translated
    .filter((t) => t.override_cost === 'high' && t.override_warning)
    .map((t) => t.override_warning);

  const runAnyway = {
    label: 'Run anyway and accept lower-quality result',
    outcome: 'The engine runs ignoring the prerequisite. Output may miss context.',
    action: 'Re-invoke with --just-run',
  };
  if (highCostWarnings.length > 0) {
    runAnyway.override_cost = 'high';
    runAnyway.override_warning = highCostWarnings.join(' ');
  } else {
    runAnyway.override_cost = pickHighestCost(translated);
  }

  const options = [
    {
      label: 'Refresh the stale file',
      outcome: 'Address the prerequisite, then re-invoke. Engine runs against fresh inputs.',
      action: bullets.length > 0
        ? translated.map((t) => t.suggested_action).filter(Boolean).join(' ')
        : '',
    },
    runAnyway,
    {
      label: "Don't run; come back later",
      outcome: 'Engine doesn\'t run. No tokens spent. Pick this up when you have time to address the prerequisite.',
      action: '',
    },
  ];

  return { bullets, options };
}

function pickHighestCost(translated) {
  const order = { high: 3, medium: 2, low: 1 };
  let best = 'low';
  for (const t of translated) {
    if ((order[t.override_cost] || 0) > (order[best] || 0)) best = t.override_cost;
  }
  return best;
}

module.exports = {
  translateOne,
  composeReadinessHuman,
  TRANSLATORS,
  KNOWN_TYPES,
};
