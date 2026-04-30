// @vitest-environment jsdom
/**
 * affordance-registry.test.js — Doctrine v6 R-1.10 + INV-AFFORD-1..5 lint gates
 * for the §IV affordance vocabulary resolved at SHC Gate 4 (2026-04-28) and
 * implemented at Gate 5 PR-2 (2026-04-29).
 *
 * Asserts:
 *   - Closed 6-shape enumeration (V-affordance §IV.1) — chevron / underline /
 *     pill / circle / divider / decorative-glyph
 *   - Closed 4-glyph decorative registry (V-affordance §IV.7) — ★ ♦ ● →
 *   - Chevron direction vertical-only (INV-AFFORD-3) — `▾` collapsed,
 *     `▴` expanded
 *   - renderChevron() emits `data-affordance="chevron"` ARIA pattern is
 *     declared via parent attrs (not the chevron span itself —
 *     INV-AFFORD-4 makes the parent header the click target)
 *   - affordanceAttrs() rejects shapes outside the closed enumeration
 *   - installAffordanceListener() dispatches click events through the
 *     registry, intercepts via event delegation (V-affordance §IV.8 single-
 *     delegated-listener pattern preventing handler-on-detached-element race)
 *
 * Doctrine source: docs/SIDEBAR_DESIGN_PRINCIPLES.md §1 R-1.10.
 * Shell-spec source: docs/design/surfaces/sidebar-shell-spec.md §IV.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  AFFORDANCE_SHAPES,
  PILL_SUB_FORM_CHIP,
  DECORATIVE_GLYPHS,
  CHEVRON_GLYPHS,
  renderChevron,
  affordanceAttrs,
  installAffordanceListener,
} from '../../shared/render-affordance.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PANEL_DIR = resolve(__dirname, '..');

describe('§IV affordance — closed 6-shape enumeration (V-affordance §IV.1)', () => {
  it('exposes exactly 6 shape names', () => {
    expect(Object.keys(AFFORDANCE_SHAPES)).toHaveLength(6);
  });

  it('the 6 shapes are chevron / underline / pill / circle / divider / decorative-glyph', () => {
    const values = Object.values(AFFORDANCE_SHAPES).sort();
    expect(values).toEqual(
      ['chevron', 'circle', 'decorative-glyph', 'divider', 'pill', 'underline'].sort(),
    );
  });

  it('exposes the chip non-interactive sub-form (disambiguates pill double-use)', () => {
    expect(PILL_SUB_FORM_CHIP).toBe('chip');
  });

  it('AFFORDANCE_SHAPES is frozen (closed enumeration)', () => {
    expect(Object.isFrozen(AFFORDANCE_SHAPES)).toBe(true);
  });
});

describe('§IV affordance — decorative-glyph registry (V-affordance §IV.7)', () => {
  it('contains exactly 4 entries (closed registry per shell-spec §IV.7)', () => {
    expect(Object.keys(DECORATIVE_GLYPHS)).toHaveLength(4);
  });

  it('contains the canonical ★ ♦ ● → glyphs', () => {
    const glyphs = Object.values(DECORATIVE_GLYPHS).map((e) => e.glyph).sort();
    expect(glyphs).toEqual(['→', '★', '♦', '●'].sort());
  });

  it('DECORATIVE_GLYPHS is frozen', () => {
    expect(Object.isFrozen(DECORATIVE_GLYPHS)).toBe(true);
  });
});

describe('§IV affordance — chevron direction vertical-only (INV-AFFORD-3)', () => {
  it('collapsed glyph is `▾`', () => {
    expect(CHEVRON_GLYPHS.COLLAPSED).toBe('▾');
  });

  it('expanded glyph is `▴`', () => {
    expect(CHEVRON_GLYPHS.EXPANDED).toBe('▴');
  });

  it('CHEVRON_GLYPHS is frozen (no horizontal chevrons may be added)', () => {
    expect(Object.isFrozen(CHEVRON_GLYPHS)).toBe(true);
  });
});

describe('renderChevron — canonical chevron emit', () => {
  it('emits an aria-hidden span with the .affordance-chevron class', () => {
    const html = renderChevron();
    expect(html).toMatch(/^<span class="affordance-chevron"/);
    expect(html).toContain('aria-hidden="true"');
  });

  it('emits the `▾` collapsed glyph by default (INV-AFFORD-3)', () => {
    expect(renderChevron()).toContain('▾');
  });

  it('appends .open modifier class when open=true', () => {
    expect(renderChevron({ open: true })).toContain('class="affordance-chevron open"');
  });

  it('threads through an id when provided', () => {
    expect(renderChevron({ id: 'my-chevron' })).toContain(' id="my-chevron"');
  });

  it('does NOT emit data-affordance attrs (parent owns the click target per INV-AFFORD-4)', () => {
    // The parent header row must be the click target (≥44×44 floor); the
    // chevron span itself is decorative-only.
    expect(renderChevron()).not.toContain('data-affordance');
    expect(renderChevron()).not.toContain('role=');
  });
});

describe('affordanceAttrs — declares parent click-target binding', () => {
  it('emits data-affordance + data-affordance-target + role="button"', () => {
    const attrs = affordanceAttrs({ shape: 'chevron', target: 'tourney-bar' });
    expect(attrs).toContain('data-affordance="chevron"');
    expect(attrs).toContain('data-affordance-target="tourney-bar"');
    expect(attrs).toContain('role="button"');
  });

  it('emits aria-expanded when expanded prop is provided', () => {
    expect(
      affordanceAttrs({ shape: 'chevron', target: 't', expanded: true }),
    ).toContain('aria-expanded="true"');
    expect(
      affordanceAttrs({ shape: 'chevron', target: 't', expanded: false }),
    ).toContain('aria-expanded="false"');
  });

  it('omits aria-expanded when expanded is undefined', () => {
    expect(affordanceAttrs({ shape: 'chevron', target: 't' })).not.toContain('aria-expanded');
  });

  it('throws when shape is not in the closed enumeration', () => {
    expect(() => affordanceAttrs({ shape: 'badge', target: 't' })).toThrow(
      /not in closed enumeration/,
    );
  });

  it('throws when target is missing', () => {
    expect(() => affordanceAttrs({ shape: 'chevron', target: '' })).toThrow(
      /non-empty string/,
    );
  });
});

describe('installAffordanceListener — single delegated click listener', () => {
  const makeRoot = () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    return root;
  };

  it('dispatches to the registry handler when [data-affordance][data-affordance-target] is clicked', () => {
    const root = makeRoot();
    const handler = vi.fn();
    const registry = new Map([['tourney-bar', handler]]);
    installAffordanceListener(root, registry);

    root.innerHTML = '<div data-affordance="chevron" data-affordance-target="tourney-bar"><span class="affordance-chevron">▾</span></div>';
    root.querySelector('span').click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.any(Event),
      expect.any(HTMLElement),
      'tourney-bar',
    );
  });

  it('does nothing when the click target does not have a data-affordance ancestor', () => {
    const root = makeRoot();
    const handler = vi.fn();
    const registry = new Map([['tourney-bar', handler]]);
    installAffordanceListener(root, registry);

    root.innerHTML = '<div><span>not an affordance</span></div>';
    root.querySelector('span').click();

    expect(handler).not.toHaveBeenCalled();
  });

  it('does nothing when the target is not in the registry', () => {
    const root = makeRoot();
    const handler = vi.fn();
    const registry = new Map([['tourney-bar', handler]]);
    installAffordanceListener(root, registry);

    root.innerHTML = '<div data-affordance="chevron" data-affordance-target="unregistered"><span>x</span></div>';
    root.querySelector('span').click();

    expect(handler).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe function that detaches the listener', () => {
    const root = makeRoot();
    const handler = vi.fn();
    const registry = new Map([['t', handler]]);
    const unsubscribe = installAffordanceListener(root, registry);

    unsubscribe();

    root.innerHTML = '<div data-affordance="chevron" data-affordance-target="t"><span>x</span></div>';
    root.querySelector('span').click();

    expect(handler).not.toHaveBeenCalled();
  });

  it('throws when root is not an EventTarget', () => {
    expect(() => installAffordanceListener(null, new Map())).toThrow(/EventTarget/);
  });

  it('throws when registry is not a Map', () => {
    const root = makeRoot();
    expect(() => installAffordanceListener(root, {})).toThrow(/Map/);
  });
});

// =========================================================================
// V-affordance §IV.10 #2 — chevron-class collapse regression pin (PR-11)
// =========================================================================
// Ensures the 4 legacy chevron CSS classes never resurface. Reintroducing
// any of them re-fragments the closed §IV.1 6-shape register and reopens
// the D-4 forensics gap that PR-11 closed.

describe('V-affordance §IV.10 #2 — chevron-class collapse (PR-11)', () => {
  const html = readFileSync(resolve(PANEL_DIR, 'side-panel.html'), 'utf8');
  const sidePanelJs = readFileSync(resolve(PANEL_DIR, 'side-panel.js'), 'utf8');

  // Strip JS comments so a leftover `// .pp-chevron migrated to ...` note
  // doesn't trip the literal scan.
  const stripJsComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  // Strip HTML comments + CSS comments + leftover prose-in-CSS-block notes
  // so explanatory text describing the migration doesn't trip the literal scan.
  const stripHtmlPropose = (src) => src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const LEGACY_CLASSES = ['pp-chevron', 'collapsible-chevron', 'deep-chevron', 'tourney-bar-chevron'];

  for (const klass of LEGACY_CLASSES) {
    it(`side-panel.html has no .${klass} CSS rule or class attribute`, () => {
      const stripped = stripHtmlPropose(html);
      // Match either `.foo {` (CSS rule) or `class="foo"` / `class="... foo ..."`
      // (class attribute usage). Both are forbidden post-PR-11.
      const cssRule = new RegExp(`\\.${klass}\\s*[\\{\\.\\,\\s\\:]`);
      const classAttr = new RegExp(`class="(?:[^"]*\\s)?${klass}(?:\\s[^"]*)?"`);
      expect(cssRule.test(stripped)).toBe(false);
      expect(classAttr.test(stripped)).toBe(false);
    });

    it(`side-panel.js never emits class="${klass}" in templates`, () => {
      const stripped = stripJsComments(sidePanelJs);
      // Template-literal usage like `class="${klass}"` or string concat
      // building `<span class="..."`. Conservative scan: any literal
      // string token containing the class name is flagged.
      const literalUsage = new RegExp(`class\\s*=\\s*["'][^"']*\\b${klass}\\b[^"']*["']`);
      expect(literalUsage.test(stripped)).toBe(false);
    });
  }

  it('side-panel.html declares the 3 new affordance bindings (pp-toggle / more-analysis / model-audit)', () => {
    expect(html).toMatch(/data-affordance-target="pp-toggle"/);
    expect(html).toMatch(/data-affordance-target="more-analysis"/);
    // Model-audit's static HTML is dynamically inserted via MODEL_AUDIT_BTN_HTML;
    // the parallel binding lives in side-panel.js.
    expect(sidePanelJs).toMatch(/data-affordance-target="model-audit"/);
  });

  it('side-panel.js registers handlers for all 4 affordance-target keys', () => {
    // The 4 keys: tourney-bar (PR-2), pp-toggle / more-analysis / model-audit (PR-11).
    const stripped = stripJsComments(sidePanelJs);
    expect(stripped).toMatch(/affordanceRegistry\.set\(\s*['"]tourney-bar['"]/);
    expect(stripped).toMatch(/affordanceRegistry\.set\(\s*['"]pp-toggle['"]/);
    expect(stripped).toMatch(/affordanceRegistry\.set\(\s*['"]more-analysis['"]/);
    expect(stripped).toMatch(/affordanceRegistry\.set\(\s*['"]model-audit['"]/);
  });

  it('side-panel.js no longer wires per-element click handlers for the 3 migrated targets', () => {
    // The PR removed: ppToggle.addEventListener / moreAnalysisBtn.addEventListener
    // / wireModelAuditClick + dataset.maWired marker.
    const stripped = stripJsComments(sidePanelJs);
    expect(stripped).not.toMatch(/ppToggle\.addEventListener\s*\(\s*['"]click['"]/);
    expect(stripped).not.toMatch(/moreAnalysisBtn\.addEventListener\s*\(\s*['"]click['"]/);
    expect(stripped).not.toMatch(/wireModelAuditClick/);
    expect(stripped).not.toMatch(/dataset\.maWired/);
  });
});
