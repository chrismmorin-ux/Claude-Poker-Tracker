/**
 * DEV-BP-008 — Dev Drive (Windows 11 ReFS) configured for repo root.
 *
 * Reads volumes via PowerShell. If no ReFS volume exists, this is a soft
 * miss — Dev Drive provides ~10× build speed for dev workloads.
 */

'use strict';

const { ok, violate, unknown } = require('../lib/detector-base');
const { isWin32, tryPsJson } = require('../lib/win-shell');

module.exports = {
  id: 'DEV-BP-008',
  rule_type: 'best_practice',
  description: 'Dev Drive (Windows 11 ReFS) configured for repo root',
  platforms: ['win32'],
  default_severity: 'low',

  async run(_ctx) {
    if (!isWin32()) return unknown({}, 'Non-Windows platform');

    const volumes = tryPsJson(
      "Get-Volume | Where-Object { $_.DriveLetter } | Select-Object DriveLetter, FileSystemType, FileSystemLabel"
    );
    if (volumes == null) return unknown({}, 'Get-Volume read failed');

    const list = Array.isArray(volumes) ? volumes : [volumes];
    const refs = list.filter(v => v && /refs/i.test(v.FileSystemType || ''));
    const evidence = {
      total_volumes: list.length,
      refs_volumes: refs.map(v => ({ drive: v.DriveLetter, fs: v.FileSystemType, label: v.FileSystemLabel })),
    };

    if (refs.length > 0) {
      return ok(evidence, `Dev Drive(s) present: ${refs.map(v => `${v.DriveLetter}:`).join(', ')}`);
    }
    return violate(
      'low',
      evidence,
      `No Dev Drive (ReFS volume) detected — Windows 11 supports a faster dev-tuned drive type`
    );
  },
};
