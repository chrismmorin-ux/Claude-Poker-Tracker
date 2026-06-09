/**
 * DEV-INV-008 — PATH length < 80% of platform limit.
 *
 * Reads User and Machine PATH env vars; concatenates with a separator;
 * compares total length against the Windows 2047-char ceiling.
 * Threshold: 80% of 2047 = 1638 chars.
 */

'use strict';

const { ok, violate, unknown } = require('../lib/detector-base');
const { isWin32, ps } = require('../lib/win-shell');

const PLATFORM_LIMIT = 2047;
const THRESHOLD_PCT = 80;

module.exports = {
  id: 'DEV-INV-008',
  rule_type: 'invariant',
  description: 'PATH length < 80% of platform limit',
  platforms: ['win32'],
  default_severity: 'medium',

  async run(_ctx) {
    if (!isWin32()) return unknown({}, 'Non-Windows platform — skipping');

    let userPath, machinePath;
    try {
      userPath = ps("[System.Environment]::GetEnvironmentVariable('PATH','User')");
      machinePath = ps("[System.Environment]::GetEnvironmentVariable('PATH','Machine')");
    } catch (err) {
      return unknown({ error: err.message }, `Failed to read PATH — ${err.message}`);
    }

    const combined = `${machinePath || ''};${userPath || ''}`;
    const length = combined.length;
    const pct = +((length / PLATFORM_LIMIT) * 100).toFixed(1);
    const entries = combined.split(';').filter(s => s.length > 0);
    const evidence = {
      user_path_len: (userPath || '').length,
      machine_path_len: (machinePath || '').length,
      combined_length: length,
      platform_limit: PLATFORM_LIMIT,
      pct_of_limit: pct,
      threshold_pct: THRESHOLD_PCT,
      entry_count: entries.length,
    };

    if (pct >= THRESHOLD_PCT) {
      return violate(
        'medium',
        evidence,
        `PATH at ${length} chars (${pct}% of ${PLATFORM_LIMIT}) — at or above ${THRESHOLD_PCT}% threshold`
      );
    }
    return ok(evidence, `PATH at ${length} chars (${pct}% of ${PLATFORM_LIMIT}) — below ${THRESHOLD_PCT}% threshold`);
  },
};
