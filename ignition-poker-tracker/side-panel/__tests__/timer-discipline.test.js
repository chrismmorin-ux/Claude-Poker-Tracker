/**
 * timer-discipline.test.js — enforces RT-60 / SR-6.3 invariant.
 *
 * side-panel.js and render-street-card.js must not contain bare
 * `setTimeout(...)` / `setInterval(...)` calls. All timer scheduling flows
 * through RenderCoordinator (via scheduleTimer / registerTimer) so a table
 * switch or destroy cancels every in-flight callback.
 *
 * The sole owners of the primitives are render-coordinator.js (the DI seam)
 * and the test harnesses that inject fakes into the coordinator.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PANEL_DIR = resolve(__dirname, '..');

/**
 * Strip line and block comments plus string/template literals so grep matches
 * only reflect executable code. Keeps the discipline test from tripping on
 * `"setTimeout"` in prose or a comment referencing the old API.
 */
const stripNonCode = (src) => src
  // Block comments
  .replace(/\/\*[\s\S]*?\*\//g, '')
  // Line comments
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  // Template literals (greedy but line-local is fine for our two files)
  .replace(/`(?:\\.|[^`\\])*`/g, '``')
  // Single/double-quoted strings
  .replace(/"(?:\\.|[^"\\])*"/g, '""')
  .replace(/'(?:\\.|[^'\\])*'/g, "''");

const BARE_TIMER = /\b(?:setTimeout|setInterval)\s*\(/g;

const FORBIDDEN_FILES = [
  'side-panel.js',
  'render-street-card.js',
];

describe('RT-60 / SR-6.3 — bare timer invariant', () => {
  for (const rel of FORBIDDEN_FILES) {
    it(`${rel} contains zero bare setTimeout/setInterval calls`, () => {
      const src = readFileSync(resolve(PANEL_DIR, rel), 'utf8');
      const code = stripNonCode(src);
      const hits = code.match(BARE_TIMER) || [];
      expect(hits).toEqual([]);
    });
  }
});
