/**
 * drillTabLabels.test.js — cross-view drill tab label discipline.
 *
 * Per audits/2026-07-31-entry-drill-tab-label-collision.md.
 *
 * THE RULE: a tab label names its OBJECT; the street comes from the view the tab
 * lives in. A cross-view collision is a defect only when the two tabs operate on
 * DIFFERENT objects — that's a name withholding information. `Lessons` collides
 * on purpose (same object, street differs) and is the sole allowed exception.
 *
 * These read the source rather than importing the views, because the views pull
 * in the whole drill engine (and jsdom/IDB setup) to assert six string literals.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const readTabs = (rel) => {
  const src = readFileSync(join(here, '..', rel), 'utf8');
  const block = src.slice(src.indexOf('const TABS = ['), src.indexOf('];', src.indexOf('const TABS = [')));
  return [...block.matchAll(/\{\s*id:\s*'([^']+)',\s*label:\s*'([^']+)'\s*\}/g)]
    .map((m) => ({ id: m[1], label: m[2] }));
};

const PREFLOP = readTabs('PreflopDrillsView/PreflopDrillsView.jsx');
const POSTFLOP = readTabs('PostflopDrillsView/PostflopDrillsView.jsx');

/** The one collision that is correct: same object, street supplied by the view. */
const ALLOWED_SHARED_LABELS = new Set(['Lessons']);

describe('drill tab labels', () => {
  it('parses both TABS arrays', () => {
    expect(PREFLOP.length).toBeGreaterThanOrEqual(6);
    expect(POSTFLOP.length).toBeGreaterThanOrEqual(5);
  });

  it.each([['preflop', PREFLOP], ['postflop', POSTFLOP]])(
    '%s labels are unique within the view', (_name, tabs) => {
      const labels = tabs.map((t) => t.label);
      expect(new Set(labels).size).toBe(labels.length);
    },
  );

  it('shares no label across the two views except the allowed exception', () => {
    const preLabels = new Set(PREFLOP.map((t) => t.label));
    const shared = POSTFLOP.map((t) => t.label).filter((l) => preLabels.has(l));
    const unexpected = shared.filter((l) => !ALLOWED_SHARED_LABELS.has(l));
    expect(
      unexpected,
      `cross-view label collision: ${unexpected.join(', ')}. A label must name its `
      + 'object — see audits/2026-07-31-entry-drill-tab-label-collision.md.',
    ).toEqual([]);
  });

  it('keeps the internal ids stable — they key persistence and openDrills deep-links', () => {
    // Renaming a LABEL is free. Renaming an ID orphans persisted drill records and
    // breaks every Study Home card, which routes by id (WS-231 F-DRILL-03 discipline).
    expect(PREFLOP.map((t) => t.id)).toEqual(
      ['shape', 'recipe', 'explorer', 'estimate', 'framework', 'library', 'lessons', 'math'],
    );
    expect(POSTFLOP.map((t) => t.id)).toEqual(
      ['line', 'explorer', 'estimate', 'framework', 'library', 'lessons'],
    );
  });

  it('does not restate the street in a label — the view header already carries it', () => {
    for (const { label } of [...PREFLOP, ...POSTFLOP]) {
      expect(label).not.toMatch(/\b(pre-?flop|post-?flop)\b/i);
    }
  });

  it('keeps Study Home tab-name copy in sync with the real labels', () => {
    // The hub enumerates tab names in its card meta lines. Those strings went stale
    // the moment these labels changed; this catches the next time.
    const hub = readFileSync(join(here, '..', 'StudyHomeView/StudyHomeView.jsx'), 'utf8');
    const metas = [...hub.matchAll(/meta="([^"]*·[^"]*)"/g)].map((m) => m[1]);
    expect(metas.length).toBeGreaterThan(0);
    const allLabels = new Set([...PREFLOP, ...POSTFLOP].map((t) => t.label));
    for (const meta of metas) {
      for (const name of meta.split('·').map((x) => x.trim())) {
        expect(allLabels.has(name), `Study Home names "${name}", which is not a tab label`).toBe(true);
      }
    }
  });
});
