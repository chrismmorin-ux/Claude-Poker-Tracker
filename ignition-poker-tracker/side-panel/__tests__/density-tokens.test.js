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

// =========================================================================
// V-density §VI typography ladder sweep — PR-15 (2026-04-30)
// =========================================================================
// PR-15 migrated all sidebar render-path consumers from the legacy
// 6-name --font-{micro,xs,sm,base,md,lg} tokens to the canonical 3-tier
// --type-{display,body,meta-stat} ladder per shell-spec §VI.1. Value-
// preserving at root 16px (--type-meta-stat = 0.6875rem = 11px;
// --type-body = 0.875rem = 14px); the rem mandate per §VI.2 closes the
// V-1 (c) accessibility gap (px ignores user OS-level font preferences +
// browser zoom; rem respects per WCAG 2.1 SC 1.4.4 AA).

describe('V-density §VI typography ladder sweep — PR-15 sidebar source files', () => {
  const SOURCE_FILES = [
    'side-panel.html',
    'side-panel.js',
    'render-orchestrator.js',
    'render-tiers.js',
    'render-street-card.js',
  ];

  for (const file of SOURCE_FILES) {
    it(`${file} contains zero var(--font-*) references (sweep complete)`, () => {
      const src = readFileSync(resolve(__dirname, '..', file), 'utf8');
      // After PR-15 the canonical 3-tier ladder owns every font-size site
      // in the sidebar render path. Reintroducing a --font-* reference
      // re-fragments the closed §VI.1 register and re-opens the
      // R-1.12 INV-DENSITY-1/2 enforcement gap.
      const matches = src.match(/var\(--font-/g) || [];
      expect(matches).toEqual([]);
    });
  }
});

// =========================================================================
// V-density §VI px literal tail — PR-16 (2026-04-30)
// =========================================================================
// PR-16 closes the §VI.2 grandfathered allowlist by migrating the 5
// remaining px-literal font-size sites to the canonical 3-tier ladder:
//   .invariant-badge        10px → --type-meta-stat (FM-DENSITY-2)
//   .seat-sample-unknown    11px → --type-meta-stat
//   .ab-action-word         24px → --type-display
//   .pp-toggle .affordance-chevron  10px → ladder default 11px (override deleted)
//   #pipeline-msg-counters inline   10px → --type-meta-stat

describe('V-density §VI px literal tail — PR-16 closes the grandfathered allowlist', () => {
  // Strip out CSS / HTML / JS comments so prose describing the migration
  // doesn't trip the literal scan.
  const stripComments = (src) => src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  const html = readFileSync(PANEL_HTML, 'utf8');
  const stripped = stripComments(html);

  it('side-panel.html declares zero `font-size: <N>px` literals (sweep + tail complete)', () => {
    const matches = stripped.match(/font-size\s*:\s*[0-9]+px/g) || [];
    expect(matches).toEqual([]);
  });

  it('.invariant-badge migrated to var(--type-meta-stat)', () => {
    const rule = html.match(/\.invariant-badge\s*\{[\s\S]*?\}/);
    expect(rule[0]).toMatch(/font-size\s*:\s*var\(--type-meta-stat\)/);
    expect(rule[0]).not.toMatch(/font-size\s*:\s*10px/);
  });

  it('.seat-sample-unknown migrated to var(--type-meta-stat)', () => {
    const rule = html.match(/\.seat-sample-unknown\s*\{[\s\S]*?\}/);
    expect(rule[0]).toMatch(/font-size\s*:\s*var\(--type-meta-stat\)/);
  });

  it('.ab-action-word migrated to var(--type-display)', () => {
    const rule = html.match(/\.ab-action-word\s*\{[\s\S]*?\}/);
    expect(rule[0]).toMatch(/font-size\s*:\s*var\(--type-display\)/);
  });

  it('.pp-toggle .affordance-chevron has no font-size override (consumes ladder default)', () => {
    // The PR-11 introduced override is deleted in PR-16; the canonical
    // .affordance-chevron rule now owns the chevron's font-size for every
    // context. INV-AFFORD-3 + INV-DENSITY-2 both satisfied by the closed
    // 6-shape register's single font-size declaration.
    const rule = html.match(/\.pp-toggle \.affordance-chevron\s*\{[\s\S]*?\}/);
    expect(rule[0]).not.toMatch(/font-size\s*:/);
  });

  it('#pipeline-msg-counters inline style migrated to var(--type-meta-stat)', () => {
    expect(html).toMatch(/id="pipeline-msg-counters"\s+style="[^"]*font-size:var\(--type-meta-stat\)/);
  });
});
