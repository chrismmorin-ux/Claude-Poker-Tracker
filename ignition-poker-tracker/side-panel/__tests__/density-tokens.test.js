/**
 * density-tokens.test.js — Doctrine v8 R-1.12 + INV-DENSITY-1/2/4 lint gates.
 *
 * Asserts the §VI density typography ladder introduced 2026-04-29 (Gate 5
 * PR-1, FM-DENSITY-1 fix):
 *   - 3 tokens exist: --type-display / --type-body / --type-meta-stat
 *   - All values use rem units (INV-DENSITY-1)
 *   - Values form the canonical 3-tier ladder ratio (INV-DENSITY-2)
 *   - The previously-shipping 9px stale-badge font literal at
 *     side-panel.html:74 has been migrated onto var(--type-meta-stat)
 *     (FM-DENSITY-1 closure — WCAG SC 1.4.4 violation cleared)
 *
 * Doctrine source: docs/SIDEBAR_DESIGN_PRINCIPLES.md §1 R-1.12 +
 *                  docs/design/surfaces/sidebar-shell-spec.md §VI.
 *
 * Future Gate 5 PRs will extend this file (or a parallel
 * `density-registry.test.js`) with the full INV-DENSITY-1..5 suite once
 * the broader ladder migration sweeps the remaining ~132 inline px font
 * literals onto the ladder tokens.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { TOKENS } from '../../shared/design-tokens.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PANEL_HTML = resolve(__dirname, '..', 'side-panel.html');

describe('§VI density typography ladder — token-level invariants', () => {
  const REQUIRED_TIERS = ['type-display', 'type-body', 'type-meta-stat'];

  it('declares all 3 ladder tiers in TOKENS', () => {
    for (const tier of REQUIRED_TIERS) {
      expect(TOKENS[tier], `missing token --${tier}`).toBeDefined();
    }
  });

  it('every ladder tier value uses rem units (INV-DENSITY-1)', () => {
    for (const tier of REQUIRED_TIERS) {
      expect(
        TOKENS[tier],
        `--${tier} must end in 'rem' per INV-DENSITY-1; got ${TOKENS[tier]}`,
      ).toMatch(/rem$/);
    }
  });

  it('ladder values form the canonical 3-tier order display > body > meta-stat (INV-DENSITY-2)', () => {
    const display = parseFloat(TOKENS['type-display']);
    const body = parseFloat(TOKENS['type-body']);
    const meta = parseFloat(TOKENS['type-meta-stat']);
    expect(display).toBeGreaterThan(body);
    expect(body).toBeGreaterThan(meta);
  });

  it('--type-meta-stat is at least 0.6875rem (~11px — clears WCAG SC 1.4.4 floor)', () => {
    const meta = parseFloat(TOKENS['type-meta-stat']);
    expect(meta).toBeGreaterThanOrEqual(0.6875);
  });
});

describe('FM-DENSITY-1 — stale-badge WCAG SC 1.4.4 violation closure', () => {
  it('side-panel.html .stale-badge no longer declares font-size: 9px', () => {
    const html = readFileSync(PANEL_HTML, 'utf8');
    const staleBadgeRule = html.match(/\.stale-badge\s*\{[\s\S]*?\}/);
    expect(staleBadgeRule, '.stale-badge CSS rule not found').not.toBeNull();
    expect(
      staleBadgeRule[0],
      '.stale-badge must NOT use the sub-WCAG 9px literal',
    ).not.toMatch(/font-size\s*:\s*9px/);
  });

  it('side-panel.html .stale-badge font-size uses var(--type-meta-stat)', () => {
    const html = readFileSync(PANEL_HTML, 'utf8');
    const staleBadgeRule = html.match(/\.stale-badge\s*\{[\s\S]*?\}/);
    expect(staleBadgeRule[0]).toMatch(/font-size\s*:\s*var\(--type-meta-stat\)/);
  });
});
