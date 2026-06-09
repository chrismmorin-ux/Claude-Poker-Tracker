/**
 * DEV-INV-001 — Free space on the OS drive ≥ 15 GB.
 *
 * Reads Get-Volume for the drive hosting the user profile.
 * Threshold: 15 GB free.
 */

'use strict';

const { ok, violate, unknown } = require('../lib/detector-base');
const { isWin32, psJson } = require('../lib/win-shell');

const THRESHOLD_GB = 15;

module.exports = {
  id: 'DEV-INV-001',
  rule_type: 'invariant',
  description: 'Free space on the OS drive ≥ 15 GB',
  platforms: ['win32'],
  default_severity: 'critical',

  async run(_ctx) {
    if (!isWin32()) return unknown({}, 'Non-Windows platform — skipping');

    let volumes;
    try {
      volumes = psJson("Get-Volume | Where-Object { $_.DriveLetter -eq 'C' } | Select-Object DriveLetter, Size, SizeRemaining");
    } catch (err) {
      return unknown({ error: err.message }, `Failed to read C: drive — ${err.message}`);
    }
    if (!volumes) return unknown({}, 'Get-Volume returned no data');

    // ConvertTo-Json may emit a single object (not array) when there's one match
    const vol = Array.isArray(volumes) ? volumes[0] : volumes;
    if (!vol || vol.Size == null || vol.SizeRemaining == null) {
      return unknown({ raw: vol }, 'C: drive volume info missing Size or SizeRemaining');
    }

    const sizeGb = +(vol.Size / 1024 / 1024 / 1024).toFixed(2);
    const freeGb = +(vol.SizeRemaining / 1024 / 1024 / 1024).toFixed(2);
    const freePct = +((vol.SizeRemaining / vol.Size) * 100).toFixed(2);
    const evidence = { drive: 'C:', size_gb: sizeGb, free_gb: freeGb, free_pct: freePct, threshold_gb: THRESHOLD_GB };

    if (freeGb < THRESHOLD_GB) {
      return violate(
        'critical',
        evidence,
        `C: drive has ${freeGb} GB free (${freePct}%), below the ${THRESHOLD_GB} GB invariant threshold`
      );
    }
    return ok(evidence, `C: drive has ${freeGb} GB free (${freePct}%) — above ${THRESHOLD_GB} GB threshold`);
  },
};
