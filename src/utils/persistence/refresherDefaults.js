/**
 * refresherDefaults.js — default singleton for `userRefresherConfig` store.
 *
 * The PRF migration seeds this default at store-create time (not lazy-on-read)
 * so that W-URC-1 + W-URC-2 read-then-modify the singleton without needing a
 * "does the singleton exist?" branch on every call.
 *
 * Phase 1 structural defaults per `idb-migration.md` §Seeding:
 *   - cardVisibility: {} — no per-card overrides at first launch
 *   - suppressedClasses: [] — no class suppressed
 *   - printPreferences.pageSize: 'letter' (Q4 default)
 *   - printPreferences.cardsPerSheet: 12 (Q4 default — 12-up)
 *   - printPreferences.colorMode: 'auto' (browser/printer-managed)
 *   - printPreferences.includeLineage: true (red line #12 lineage-mandatory)
 *   - printPreferences.includeCodex: false (Phase 1 structural; AP-PRF-09 + Q7;
 *                                            W-URC-1 validator rejects any patch
 *                                            attempting to set true at v1)
 *   - notifications.staleness: false (AP-PRF-08 opt-in default OFF)
 *   - lastExportAt: null
 *
 * Spec: docs/projects/printable-refresher/idb-migration.md §Seeding
 */

export const REFRESHER_CONFIG_SINGLETON_ID = 'singleton';
export const REFRESHER_CONFIG_SCHEMA_VERSION = 1;

export function buildDefaultRefresherConfig() {
  return {
    id: REFRESHER_CONFIG_SINGLETON_ID,
    schemaVersion: REFRESHER_CONFIG_SCHEMA_VERSION,
    cardVisibility: {},
    suppressedClasses: [],
    printPreferences: {
      pageSize: 'letter',
      cardsPerSheet: 12,
      colorMode: 'auto',
      includeLineage: true,
      includeCodex: false,
    },
    notifications: {
      staleness: false,
    },
    lastExportAt: null,
  };
}
