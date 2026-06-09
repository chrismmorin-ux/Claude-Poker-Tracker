/**
 * DEV-BP-003 — docker_data.vhdx within 2× actual data size.
 *
 * Reads the VHDX file size on disk. If Docker is available, queries
 * `docker system df` for actual usage and computes the ratio. If Docker
 * isn't running, only the file size is reported (with a note).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { ok, violate, unknown } = require('../lib/detector-base');

const VHDX_PATH = path.join(
  process.env.LOCALAPPDATA || '',
  'Docker', 'wsl', 'disk', 'docker_data.vhdx'
);
const RATIO_THRESHOLD = 2.0;

function dockerDfBytes() {
  try {
    const out = execSync('docker system df --format "{{json .}}"', {
      encoding: 'utf8', timeout: 10_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (!out) return null;
    let total = 0;
    for (const line of out.split('\n')) {
      try {
        const obj = JSON.parse(line);
        // "Size" field is a string like "12.34GB" — parse to bytes
        const sizeStr = obj.Size || '0';
        total += parseSizeStr(sizeStr);
      } catch { /* skip line */ }
    }
    return total;
  } catch {
    return null;
  }
}

function parseSizeStr(s) {
  const m = /^([\d.]+)\s*(B|KB|MB|GB|TB)?$/i.exec(s);
  if (!m) return 0;
  const num = parseFloat(m[1]);
  const unit = (m[2] || 'B').toUpperCase();
  const mult = { B: 1, KB: 1024, MB: 1024**2, GB: 1024**3, TB: 1024**4 }[unit];
  return num * mult;
}

module.exports = {
  id: 'DEV-BP-003',
  rule_type: 'best_practice',
  description: 'docker_data.vhdx within 2× actual data size',
  platforms: ['win32'],
  default_severity: 'medium',

  async run(_ctx) {
    if (!fs.existsSync(VHDX_PATH)) {
      return ok({ vhdx_exists: false, vhdx_path: VHDX_PATH }, 'Docker VHDX not present');
    }
    const stat = fs.statSync(VHDX_PATH);
    const vhdxBytes = stat.size;
    const vhdxGb = +(vhdxBytes / (1024 ** 3)).toFixed(2);

    const usageBytes = dockerDfBytes();
    const evidence = {
      vhdx_path: VHDX_PATH,
      vhdx_gb: vhdxGb,
      docker_actual_usage_gb: usageBytes != null ? +(usageBytes / (1024 ** 3)).toFixed(2) : null,
      ratio_threshold: RATIO_THRESHOLD,
    };

    if (usageBytes == null) {
      // Can't compute ratio; flag as best-practice violation only if VHDX is large
      if (vhdxGb > 20) {
        return violate(
          'medium',
          evidence,
          `Docker VHDX is ${vhdxGb} GB but Docker is not queryable for actual usage — likely large reclamation opportunity`
        );
      }
      return ok(evidence, `Docker VHDX ${vhdxGb} GB (Docker not queryable)`);
    }

    const ratio = usageBytes > 0 ? vhdxBytes / usageBytes : Infinity;
    evidence.ratio = +ratio.toFixed(2);
    if (ratio > RATIO_THRESHOLD) {
      return violate(
        'medium',
        evidence,
        `Docker VHDX (${vhdxGb} GB) is ${evidence.ratio}× actual usage (${evidence.docker_actual_usage_gb} GB) — Optimize-VHD can reclaim space`
      );
    }
    return ok(evidence, `Docker VHDX ${vhdxGb} GB / usage ${evidence.docker_actual_usage_gb} GB (ratio ${evidence.ratio})`);
  },
};
