/**
 * DEV-INV-006 — LongPathsEnabled = 1.
 *
 * Reads HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled.
 * If unset or 0, deep node_modules paths fail silently.
 */

'use strict';

const { ok, violate, unknown } = require('../lib/detector-base');
const { isWin32, tryPs } = require('../lib/win-shell');

module.exports = {
  id: 'DEV-INV-006',
  rule_type: 'invariant',
  description: 'LongPathsEnabled = 1 (Windows registry)',
  platforms: ['win32'],
  default_severity: 'high',

  async run(_ctx) {
    if (!isWin32()) return unknown({}, 'Non-Windows platform — skipping');

    const out = tryPs(
      "(Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem' -Name LongPathsEnabled -ErrorAction Stop).LongPathsEnabled"
    );

    if (out === null) {
      // Either the key doesn't exist or read failed — both interpreted as DEFAULT (off = 0)
      return violate(
        'high',
        { value: null, interpreted_as: 0, registry_path: 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem\\LongPathsEnabled' },
        'LongPathsEnabled registry value is unset (default = 0); deep paths will fail silently'
      );
    }

    const value = parseInt(out, 10);
    if (value === 1) {
      return ok({ value: 1 }, 'LongPathsEnabled = 1');
    }
    return violate(
      'high',
      { value, registry_path: 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem\\LongPathsEnabled' },
      `LongPathsEnabled = ${value}; deep paths will fail silently`
    );
  },
};
