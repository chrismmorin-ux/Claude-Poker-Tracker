/**
 * zone-shell.test.js — SR-6.8 + SR-6.17 enforcement.
 *
 * SR-6.8 (orig): 6 zone containers with min-heights; CSS lint forbids
 *   display:none on any .zone-* selector.
 * SR-6.17: zones host real content now. #hud-content-v2 wrapper is deleted.
 *   Z0 lives at body top-level (always-visible chrome). Z1-Z4 + Zx live
 *   inside #hud-content (gated by hasTableHands). Migrated content elements
 *   are pinned to their target zone container.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = resolve(__dirname, '..', 'side-panel.html');
const html = readFileSync(HTML_PATH, 'utf8');

const extractStyleBlock = (src) => {
  const m = src.match(/<style>([\s\S]*?)<\/style>/);
  return m ? m[1] : '';
};

// Slice the HTML from a given zone container open to its matching close.
// Simple balanced-<div> scanner — good enough for our hand-authored markup.
const sliceZone = (src, zoneId) => {
  const openRe = new RegExp(`<div[^>]*id="${zoneId}"[^>]*>`);
  const openMatch = src.match(openRe);
  if (!openMatch) return '';
  const start = openMatch.index + openMatch[0].length;
  let depth = 1;
  let i = start;
  const TAG_RE = /<(\/?)div\b[^>]*>/g;
  TAG_RE.lastIndex = start;
  let tag;
  while ((tag = TAG_RE.exec(src)) !== null) {
    if (tag[1]) depth--; else depth++;
    if (depth === 0) return src.slice(start, tag.index);
    i = TAG_RE.lastIndex;
  }
  return src.slice(start);
};

describe('SR-6.8 zone shell — HTML', () => {
  it('deletes the #hud-content-v2 wrapper (SR-6.17)', () => {
    expect(html).not.toMatch(/id="hud-content-v2"/);
  });

  it('keeps the #hud-content wrapper as the single content shell', () => {
    expect(html).toMatch(/id="hud-content"/);
  });

  for (const z of ['z0', 'z1', 'z2', 'z3', 'z4', 'zx']) {
    it(`defines zone container .zone-${z} (#zone-${z})`, () => {
      expect(html).toMatch(new RegExp(`id="zone-${z}"`));
      expect(html).toMatch(new RegExp(`class="zone zone-${z}"`));
    });
  }
});

describe('SR-6.8 zone shell — CSS height contracts', () => {
  const css = extractStyleBlock(html);

  for (const z of ['z0', 'z1', 'z2', 'z3', 'z4', 'zx']) {
    it(`declares min-height on .zone-${z}`, () => {
      const re = new RegExp(`\\.zone-${z}\\s*\\{[^}]*min-height\\s*:`);
      expect(css).toMatch(re);
    });
  }
});

describe('SR-6.8 zone shell — R-1.3 slot-reservation lint', () => {
  const css = extractStyleBlock(html);

  it('no CSS rule targeting a .zone-* selector sets display:none', () => {
    const RULE_RE = /([^{}]*)\{([^}]*)\}/g;
    const violations = [];
    let m;
    while ((m = RULE_RE.exec(css)) !== null) {
      const selector = m[1];
      const body = m[2];
      if (/\.zone-[a-z0-9]+/i.test(selector) && /display\s*:\s*none/i.test(body)) {
        violations.push(selector.trim());
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('SR-6.17 zone placement — Z0 lives outside #hud-content', () => {
  it('zone-z0 is not a descendant of #hud-content', () => {
    const hudSlice = sliceZone(html, 'hud-content');
    expect(hudSlice).not.toMatch(/id="zone-z0"/);
  });

  it('zone-z0 contains the status bar', () => {
    const z0 = sliceZone(html, 'zone-z0');
    expect(z0).toMatch(/class="status-bar"/);
  });

  it('zone-z0 contains the pipeline-health strip', () => {
    const z0 = sliceZone(html, 'zone-z0');
    expect(z0).toMatch(/id="pipeline-health"/);
  });
});

describe('SR-6.17 zone placement — content zones live inside #hud-content', () => {
  const hudSlice = sliceZone(html, 'hud-content');

  for (const z of ['z1', 'z2', 'z3', 'z4', 'zx']) {
    it(`zone-${z} is inside #hud-content`, () => {
      expect(hudSlice).toMatch(new RegExp(`id="zone-${z}"`));
    });
  }
});

describe('SR-6.17 zone placement — migrated content IDs', () => {
  const cases = [
    ['zone-z1', ['seat-arc']],
    ['zone-z2', ['action-bar', 'context-strip', 'cards-strip', 'plan-panel']],
    ['zone-z3', ['tournament-bar', 'tournament-detail', 'street-progress', 'street-card']],
    ['zone-zx', ['between-hands', 'app-launch-prompt']],
    ['zone-z4', ['more-analysis-btn', 'more-analysis-content', 'model-audit-btn', 'model-audit-content']],
  ];

  for (const [zoneId, ids] of cases) {
    for (const id of ids) {
      it(`#${id} is a descendant of #${zoneId}`, () => {
        const zoneSlice = sliceZone(html, zoneId);
        expect(zoneSlice).toMatch(new RegExp(`id="${id}"`));
      });
    }
  }
});
