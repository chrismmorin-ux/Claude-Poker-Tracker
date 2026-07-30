/**
 * sync-paths.js — cloud-sync folder detection (OneDrive / Dropbox / iCloud /
 * Google Drive).
 *
 * A git repo living inside a cloud-synced folder corrupts silently: the sync
 * client rewrites files under .git/ while git holds them open. This is a named
 * fleet incident class, not a hypothetical.
 *
 * Two consumers share this list so it cannot drift:
 *   - DEV-INV-002 (device-health) — flags already-registered repos, severity critical
 *   - cwos-adopt-install.js — refuses to adopt INTO such a path (WS-503)
 */

'use strict';

const path = require('path');

// Each pattern anchors the folder name between path separators, so a repo NAMED
// "dropbox-clone" or "my-onedrive" is not mistaken for the real thing.
//
// OneDrive needs the optional " - Tenant" suffix: commercial OneDrive names the
// folder "OneDrive - Contoso", which a bare "onedrive\" substring test misses —
// and that is the most common corporate layout (WS-503).
const SYNC_PATTERNS = [
  { name: 'OneDrive',     re: /[\\/]onedrive( - [^\\/]*)?[\\/]/ },
  { name: 'Dropbox',      re: /[\\/]dropbox([\\/]|$)/ },
  { name: 'iCloud',       re: /[\\/]icloud[^\\/]*[\\/]/ },
  { name: 'Google Drive', re: /[\\/]google drive([\\/]|$)/ },
  { name: 'Google Drive', re: /[\\/]my drive([\\/]|$)/ },
];

// Retained for evidence/reporting (DEV-INV-002 lists what it checked).
const SYNC_PREFIXES = SYNC_PATTERNS.map(p => p.re.source);

/** Human-facing service name for a matched pattern source. */
function serviceName(matched) {
  const hit = SYNC_PATTERNS.find(p => p.re.source === matched);
  if (hit) return hit.name;
  const s = String(matched || '').toLowerCase();
  if (s.includes('onedrive')) return 'OneDrive';
  if (s.includes('dropbox')) return 'Dropbox';
  if (s.includes('icloud')) return 'iCloud';
  if (s.includes('drive')) return 'Google Drive';
  return 'a cloud-sync service';
}

/**
 * Trailing separator is appended so a path that IS the sync root (".../OneDrive")
 * matches the same way a path inside it does.
 *
 * @param {string} p filesystem path
 * @returns {string|null} the matched pattern source, or null when the path is clean
 */
function matchesSyncPath(p) {
  const raw = String(p || '');
  if (!raw) return null;
  const n = (raw.endsWith('\\') || raw.endsWith('/') ? raw : raw + path.sep).toLowerCase();
  for (const { re } of SYNC_PATTERNS) {
    if (re.test(n)) return re.source;
  }
  return null;
}

module.exports = { SYNC_PATTERNS, SYNC_PREFIXES, matchesSyncPath, serviceName };
