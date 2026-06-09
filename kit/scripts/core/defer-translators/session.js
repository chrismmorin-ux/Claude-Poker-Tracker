'use strict';

/**
 * session — translates a session-recovery defer into plain language.
 *
 * Input detail shape (from cwos-session-recovery isSessionHealthy):
 *   { stale_session_ids: string[], message: string }
 *
 * Output:
 *   plain_text — N session(s) past the heartbeat timeout, no token-prefix
 *   suggested_action — run /session-end (the founder-facing command)
 *   override_cost — 'low'; running anyway is safe but the stale session
 *     remains in the index (cosmetic, not load-bearing for the engine output)
 */

function translate(detail) {
  const d = detail || {};
  const ids = Array.isArray(d.stale_session_ids) ? d.stale_session_ids : [];
  const n = ids.length;

  if (n === 0) {
    return {
      plain_text: 'A previous session is still marked active past its heartbeat timeout.',
      suggested_action: 'Run /session-end to close it cleanly.',
      override_cost: 'low',
      override_warning: '',
    };
  }

  const noun = n === 1 ? 'session is' : `sessions are`;
  const list = n <= 3 ? ids.join(', ') : `${ids.slice(0, 2).join(', ')} +${n - 2} more`;

  return {
    plain_text: `${n} previous ${noun} still marked active past the heartbeat timeout (${list}).`,
    suggested_action: 'Run /session-end (or `node kit/scripts/cwos-session-recovery.js --auto`) to close them.',
    override_cost: 'low',
    override_warning: '',
  };
}

module.exports = { translate };
