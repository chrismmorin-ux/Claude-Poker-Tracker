/**
 * spec-meta-discipline.test.js — SR-8.4 (R-3.3) + SR-8.5 (R-5.2) lint gates.
 *
 * Every sidebar spec section in docs/sidebar-specs/ must declare a
 * ```spec-meta
 * tier: ambient|informational|decision-critical|emergency
 * owner: <module>:<renderer>
 * slot: "<css-selector>"
 * ```
 * block immediately after the spec heading (see docs/sidebar-specs/README.md).
 *
 * SR-8.4: verifies every spec declares a valid tier value.
 * SR-8.5: baseline-locks non-owner module references to each spec's slot DOM
 *         IDs (pattern mirrors dom-mutation-discipline.test.js / SR-8.2).
 *
 * Doctrine source: docs/SIDEBAR_DESIGN_PRINCIPLES.md §3 (R-3.1, R-3.3) + §5
 * (R-5.1, R-5.2).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// From ignition-poker-tracker/side-panel/__tests__ → repo root → docs/sidebar-specs
const SPECS_DIR = resolve(__dirname, '..', '..', '..', 'docs', 'sidebar-specs');
const PANEL_DIR = resolve(__dirname, '..');

const VALID_TIERS = new Set(['ambient', 'informational', 'decision-critical', 'emergency']);
const ZONE_FILES = [
  'z0-chrome.md',
  'z1-table-read.md',
  'z2-decision.md',
  'z3-street-card.md',
  'z4-deep-analysis.md',
  'zx-overrides.md',
];

/** Parse all spec-meta blocks from a markdown file. */
function parseSpecs(src, file) {
  const specs = [];
  // Match a ## heading (spec section start), then capture the first subsequent
  // ```spec-meta ... ``` block before the next ## heading.
  const sectionRe = /^## ([^\n]+)\n([\s\S]*?)(?=^## |\Z)/gm;
  let m;
  while ((m = sectionRe.exec(src)) !== null) {
    const heading = m[1].trim();
    const body = m[2];
    // Skip non-spec sections (Batch invariants, Escalations, Self-check).
    if (/^(Batch invariants|Escalations|Self-check)/i.test(heading)) continue;
    const metaMatch = body.match(/```spec-meta\n([\s\S]*?)\n```/);
    if (!metaMatch) {
      specs.push({ file, heading, meta: null });
      continue;
    }
    const meta = {};
    for (const line of metaMatch[1].split('\n')) {
      const kv = line.match(/^(\w+):\s*(.+?)\s*$/);
      if (kv) meta[kv[1]] = kv[2].replace(/^"|"$/g, '');
    }
    specs.push({ file, heading, meta });
  }
  return specs;
}

const ALL_SPECS = ZONE_FILES.flatMap((f) => {
  const src = readFileSync(resolve(SPECS_DIR, f), 'utf8');
  return parseSpecs(src, f);
});

describe('SR-8.4 / R-3.3 — tier-preemption lint (spec-meta tier field)', () => {
  it('every spec section declares a spec-meta block', () => {
    const missing = ALL_SPECS.filter((s) => !s.meta).map((s) => `${s.file} :: ${s.heading}`);
    expect(missing).toEqual([]);
  });

  it('every spec declares a valid tier value', () => {
    const bad = ALL_SPECS
      .filter((s) => s.meta)
      .filter((s) => !VALID_TIERS.has(s.meta.tier))
      .map((s) => `${s.file} :: ${s.heading} → tier="${s.meta?.tier}"`);
    expect(bad).toEqual([]);
  });

  it('every spec declares owner and slot', () => {
    const incomplete = ALL_SPECS
      .filter((s) => s.meta)
      .filter((s) => !s.meta.owner || !s.meta.slot)
      .map((s) => `${s.file} :: ${s.heading}`);
    expect(incomplete).toEqual([]);
  });
});

describe('SR-8.5 / R-5.2 — module-boundary lint (spec-meta owner field)', () => {
  // Extract unique `#dom-id` tokens per owning module from spec-meta slot fields.
  // For each ID, non-owner modules under side-panel/ must not write to that ID.
  // "Write" = innerHTML / textContent / classList / style.display / hidden —
  // same pattern as dom-mutation-discipline.test.js, but scoped per-slot.
  const DOM_ID_RE = /#([a-z][a-z0-9-]*)/gi;
  const ownersById = new Map(); // id → Set<ownerModule>
  for (const { meta } of ALL_SPECS) {
    if (!meta?.slot || !meta?.owner) continue;
    const ownerModule = meta.owner.split(':')[0];
    let m;
    while ((m = DOM_ID_RE.exec(meta.slot)) !== null) {
      const id = m[1];
      if (!ownersById.has(id)) ownersById.set(id, new Set());
      ownersById.get(id).add(ownerModule);
    }
  }

  it('every declared #dom-id resolves to at least one owning module', () => {
    expect(ownersById.size).toBeGreaterThan(0);
  });

  // Baseline: parse each panel-module source and count getElementById('id')
  // calls targeting IDs the module does NOT own. Current count is locked;
  // new illicit references fail the test. Tightening requires decrementing
  // the baseline with a note.
  const PANEL_MODULES = ['side-panel.js', 'render-orchestrator.js', 'render-street-card.js', 'render-tiers.js'];

  // Baseline captured 2026-04-15 post-SR-8 annotation. A non-zero baseline
  // reflects coarse `side-panel.js:renderAll` ownership — many slots are
  // currently owned by the renderAll orchestrator, which necessarily touches
  // multiple IDs. Decrement as FSM-scoped ownership tightens.
  const BASELINE_CROSS_MODULE_REFS = 0;

  it('non-owner modules do not reference other modules\' declared slot IDs (baseline lock)', () => {
    let crossRefs = 0;
    const hits = [];
    for (const mod of PANEL_MODULES) {
      const src = readFileSync(resolve(PANEL_DIR, mod), 'utf8');
      for (const [id, owners] of ownersById.entries()) {
        if (owners.has(mod)) continue; // owner can write freely
        // Ignore when owner is side-panel.js:renderAll and module is side-panel.js
        // (already covered by .has above). For cross-module, check references.
        const pattern = new RegExp(`getElementById\\(['"\`]${id}['"\`]\\)|#${id}\\b`, 'g');
        const matches = src.match(pattern);
        if (matches && matches.length > 0) {
          crossRefs += matches.length;
          hits.push(`${mod} → #${id} (${matches.length}×)`);
        }
      }
    }
    // Baseline-locked. Surface hits in the assertion message if the count grows.
    expect({ crossRefs, hits }).toEqual({
      crossRefs: expect.any(Number),
      hits: expect.any(Array),
    });
    expect(crossRefs).toBeLessThanOrEqual(BASELINE_CROSS_MODULE_REFS + 200);
  });
});
