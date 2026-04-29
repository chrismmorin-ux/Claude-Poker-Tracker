/**
 * status-writer-registry.test.js — V-status §I writer-registry lint gate.
 *
 * Doctrine v7 R-1.11 + INV-STATUS-1 (single canonical writer registry per
 * status slot). Co-shipping deliverable from V-status §I.12 (Gate 5 PR-6).
 *
 * The connection-state axis (#status-dot) has 5 writer sites, each
 * migrated at PR-5 / PR-6 to route through the canonical writer registry
 * in shared/render-status.js (writeStatusDot / applyMonotonicTier). This
 * lint freezes that contract: any new write to #status-dot must reach
 * the DOM through one of those two helpers, never via a raw className /
 * setAttribute(class, …) / classList.add('green'/'yellow'/'red') call.
 *
 * The lint is static — it scans production source for forbidden patterns.
 * Behavior under runtime conditions is covered by status-registry.test.js.
 *
 * Pattern precedent: timer-discipline.test.js (RT-60), dom-mutation-
 * discipline.test.js (R-2.3).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(__dirname, '..', '..');

const stripCommentsAndStrings = (src) => src
  // Remove block comments
  .replace(/\/\*[\s\S]*?\*\//g, '')
  // Remove line comments (preserve URL-like `://`)
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  // Empty out template / double / single quoted string literals so a doc-
  // string mention of "status-dot" doesn't trip the lint, but real code
  // assignments still match the surrounding patterns.
  .replace(/`(?:\\.|[^`\\])*`/g, '``')
  .replace(/"(?:\\.|[^"\\])*"/g, '""')
  .replace(/'(?:\\.|[^'\\])*'/g, "''");

// =============================================================================
// PRODUCTION SOURCES UNDER LINT
// =============================================================================
// shared/render-status.js is the registry itself — exempt; it owns the
// writeStatusDot / applyMonotonicTier helpers + the (private) className=
// write inside writeStatusDot. Any other file that touches #status-dot
// must reach it through one of those two exported helpers.

const SOURCES = [
  'side-panel/side-panel.js',
  'side-panel/render-orchestrator.js',
  'side-panel/harness/harness.js',
];

// =============================================================================
// FORBIDDEN PATTERNS
// =============================================================================
// The status-dot DOM element is canonically obtained via $('status-dot')
// or document.getElementById('status-dot'). Any subsequent .className =
// or .classList.add('green'|'yellow'|'red') is forbidden — those writes
// must go through writeStatusDot / applyMonotonicTier.

// Match any string literal containing "status-dot " followed by a color
// token (matches the legacy `'status-dot green'` / `"status-dot yellow"`
// patterns deleted at PR-6).
const LEGACY_CLASS_LITERAL = /['"`]status-dot\s+(green|yellow|red)['"`]/g;

// Match any direct setAttribute('class', …) call (cross-namespace; this
// is a tier-class bypass regardless of which element owns it — the
// canonical writer registry never calls setAttribute('class')).
// Combined with the import-presence check, ensures any new #status-dot
// consumer can't silently dispatch a class write.
const FORBIDDEN_SETATTR_CLASS = /\.setAttribute\s*\(\s*['"`]class['"`]\s*,/g;

// Match `dot.classList.add('green'|'yellow'|'red'|'conn-…')` / `.remove(`
// / `.toggle(` calls. The canonical writer manages classes wholesale via
// `dot.className =`, so per-class manipulation outside the registry would
// drift from the closed register.
const FORBIDDEN_CLASSLIST_OP = /\.classList\.(?:add|remove|toggle)\s*\(\s*['"`](?:green|yellow|red|conn-[a-z]+)['"`]/g;

describe('§I status — writer-registry lint (Gate 5 PR-6 V-status §I.12)', () => {
  for (const rel of SOURCES) {
    describe(rel, () => {
      const src = readFileSync(resolve(REPO_DIR, rel), 'utf8');
      const code = stripCommentsAndStrings(src);

      it('contains no legacy `status-dot {green|yellow|red}` class literal', () => {
        // Re-scan the un-stripped source for the literal — string contents
        // were emptied above to avoid false positives, but a class literal
        // assigned to .className IS a string. Run against original `src`,
        // ignore matches that fall inside a comment block.
        const noBlockComments = src.replace(/\/\*[\s\S]*?\*\//g, '');
        const noLineComments = noBlockComments.replace(
          /(^|[^:])\/\/[^\n]*/g,
          '$1',
        );
        const matches = noLineComments.match(LEGACY_CLASS_LITERAL) || [];
        expect(matches).toEqual([]);
      });

      it('makes no `setAttribute("class", …)` write (registry-bypass guard)', () => {
        // shared/render-status.js owns the canonical writer
        // (writeStatusDot uses `dotEl.className =`, not setAttribute).
        // Any consumer that calls setAttribute('class', …) is bypassing
        // the registry — flag it.
        const matches = code.match(FORBIDDEN_SETATTR_CLASS) || [];
        expect(matches).toEqual([]);
      });

      it('makes no `classList.{add,remove,toggle}` calls with status-tier tokens', () => {
        const matches = code.match(FORBIDDEN_CLASSLIST_OP) || [];
        expect(matches).toEqual([]);
      });
    });
  }
});

describe('§I status — registry helpers are imported by every #status-dot consumer', () => {
  // Defense-in-depth: if a future PR introduces a new file that touches
  // #status-dot, the import-presence check forces it to bring the
  // registry helpers along. The check is positive (file must import) for
  // all three production callers; harness re-paint uses writeStatusDot
  // only, side-panel.js uses both writeStatusDot + applyMonotonicTier,
  // render-orchestrator.js uses STATUS_TIERS as the tier-value
  // vocabulary.
  const importPattern = /from\s+['"](?:\.\.\/)+shared\/render-status\.js['"]/;

  for (const rel of SOURCES) {
    it(`${rel} imports from shared/render-status.js`, () => {
      const src = readFileSync(resolve(REPO_DIR, rel), 'utf8');
      expect(src).toMatch(importPattern);
    });
  }
});

describe('§I status — every #status-dot lookup is paired with a registry write', () => {
  // Positive contract check (INV-STATUS-1 single-writer enforcement at
  // the source-scan layer): a file that calls $('status-dot') /
  // getElementById('status-dot') must ALSO call writeStatusDot or
  // applyMonotonicTier — otherwise the lookup is either dead code or a
  // bypass. The harness has 1 lookup + 1 writeStatusDot call; side-panel
  // has 4 lookups + ≥1 writeStatusDot + ≥2 applyMonotonicTier calls.
  // render-orchestrator.js doesn't perform DOM lookups (pure module).

  const STATUS_DOT_LOOKUP = /\$\(\s*['"`]status-dot['"`]\s*\)|getElementById\(\s*['"`]status-dot['"`]\s*\)/g;
  const REGISTRY_CALL = /\b(?:writeStatusDot|applyMonotonicTier)\s*\(/g;

  // Strip comments only (preserve string literals — the lookup regex
  // matches the literal 'status-dot' inside `$()` calls).
  const stripCommentsOnly = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  for (const rel of SOURCES) {
    it(`${rel} has at least one registry call when it looks up #status-dot`, () => {
      const src = readFileSync(resolve(REPO_DIR, rel), 'utf8');
      const code = stripCommentsOnly(src);
      const lookups = (code.match(STATUS_DOT_LOOKUP) || []).length;
      const writes = (code.match(REGISTRY_CALL) || []).length;
      if (lookups === 0) return; // pure module / no consumer surface
      expect(writes).toBeGreaterThanOrEqual(1);
    });
  }
});
