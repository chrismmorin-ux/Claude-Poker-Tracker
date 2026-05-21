/**
 * stale-context-writer-discipline.test.js — WS-107 single-writer
 * baseline lock for `staleContext`.
 *
 * Per WS-107 (SPR-057): `staleContext` is owned exclusively by
 * `_staleContextTick` in side-panel.js. Before this fix, the push
 * handler also wrote `staleContext` (dual-writer oscillation per
 * RT-83). Consolidating to a single owner closes the oscillation
 * surface and makes the lifecycle reasoned per `evaluateStaleContext`
 * (shared/stale-context-tick.js).
 *
 * This baseline lock prevents regression: any new direct write of
 * `coordinator.set('staleContext', ...)` to side-panel.js must be
 * justified (and probably belongs inside the tick, not at a new
 * call site).
 *
 * Pattern precedent: dom-mutation-discipline.test.js (R-2.3 baseline
 * lock); timer-discipline.test.js (RT-60 / SR-6.3).
 *
 * To raise the baseline: justify the new writer site in this header
 * AND verify that the writer doesn't undo the WS-107 single-owner
 * invariant. To lower: delete a writer (great!) and decrement.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PANEL_DIR = resolve(__dirname, '..');

// Strip comments only — keep string literals intact because the discipline
// pattern matches the literal `'staleContext'` identifier. The full
// stripNonCode pattern (used in dom-mutation-discipline.test.js) collapses
// strings to empty, which would defeat this check.
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const STALE_CONTEXT_WRITE_PATTERN = /coordinator\.set\(\s*['"]staleContext['"]/g;

// Post-WS-107: 3 writes, all inside _staleContextTick
//   - full-clear branch  (age > 120s)
//   - set-stale branch   (60s < age <= 120s, not currently stale)
//   - clear-stale branch (age <= 60s, currently stale) — ADDED in WS-107
//
// Pre-WS-107: 4 writes (the 3 above with no clear-stale, plus a fresh-clear
// at handleLiveContextPush:547 which bypassed the tick).
const BASELINE = {
  'side-panel.js': 3,
};

describe('WS-107 — staleContext single-writer discipline (baseline lock)', () => {
  for (const [rel, allowed] of Object.entries(BASELINE)) {
    it(`${rel} has exactly ${allowed} direct staleContext writes (all inside _staleContextTick)`, () => {
      const src = readFileSync(resolve(PANEL_DIR, rel), 'utf8');
      const code = stripComments(src);
      const hits = code.match(STALE_CONTEXT_WRITE_PATTERN) || [];
      expect(hits.length).toBe(allowed);
    });
  }

  it('handleLiveContextPush does NOT write staleContext directly (push-driven dual-writer removed)', () => {
    const src = readFileSync(resolve(PANEL_DIR, 'side-panel.js'), 'utf8');
    const code = stripComments(src);

    // Find the function body of handleLiveContextPush. The function is
    // declared as `const handleLiveContextPush = (message) => {`. Walk
    // forward matching braces to extract the body.
    const declIdx = code.indexOf('const handleLiveContextPush');
    expect(declIdx, 'handleLiveContextPush should still exist').toBeGreaterThan(-1);
    const openBrace = code.indexOf('{', declIdx);
    expect(openBrace).toBeGreaterThan(-1);

    let depth = 0;
    let endIdx = -1;
    for (let i = openBrace; i < code.length; i++) {
      if (code[i] === '{') depth += 1;
      else if (code[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    expect(endIdx, 'handleLiveContextPush should have a closing brace').toBeGreaterThan(openBrace);

    const body = code.slice(openBrace, endIdx + 1);
    const violations = body.match(STALE_CONTEXT_WRITE_PATTERN) || [];
    expect(violations.length).toBe(0);
  });
});
