/**
 * dom-mutation-discipline.test.js — R-2.3 baseline lock.
 *
 * Doctrine R-2.3 forbids direct DOM-class/visibility mutations outside
 * FSM-dispatched render paths. Enforcing that semantically in a grep is
 * brittle (every hit needs to prove it's called from renderAll), so this
 * test instead freezes the current hit count per production file. New
 * mutations fail the build; cleanups require updating the baseline with
 * a comment explaining which site went away.
 *
 * Pattern precedent: timer-discipline.test.js (RT-60 / SR-6.3).
 * Program ref: SR-8.2 / audit caveat C-4.
 *
 * Allowed mutations today are all idempotent class/style syncs driven by
 * coordinator render state (FSM-backed collapsibles, stale tint, debug-flag
 * footer). Audit each baseline bump against that pattern before landing.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PANEL_DIR = resolve(__dirname, '..');

const stripNonCode = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  .replace(/`(?:\\.|[^`\\])*`/g, '``')
  .replace(/"(?:\\.|[^"\\])*"/g, '""')
  .replace(/'(?:\\.|[^'\\])*'/g, "''");

const MUTATION_PATTERN = /classList\.toggle\(|\.style\.display\s*=|\.hidden\s*=/g;

// Baseline captured 2026-04-15 post-SR-6.17. All current hits are FSM-backed
// idempotent syncs (collapsible .open, stale tint, diagnostics-footer display).
// To decrease: delete the site, then decrement the number and note why below.
// To increase: route through FSM dispatch instead (this test blocks the add).
const BASELINE = {
  'side-panel.js': 19,
  'render-street-card.js': 3,
  'render-tiers.js': 1,
};

describe('R-2.3 / SR-8.2 — DOM-mutation discipline (baseline lock)', () => {
  for (const [rel, allowed] of Object.entries(BASELINE)) {
    it(`${rel} has no more than ${allowed} class/display/hidden mutations`, () => {
      const src = readFileSync(resolve(PANEL_DIR, rel), 'utf8');
      const code = stripNonCode(src);
      const hits = code.match(MUTATION_PATTERN) || [];
      expect(hits.length).toBeLessThanOrEqual(allowed);
    });
  }
});
