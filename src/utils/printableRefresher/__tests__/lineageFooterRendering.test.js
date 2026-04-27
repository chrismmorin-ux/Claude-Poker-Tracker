/**
 * lineageFooterRendering.test.js — PRF-G5-LG test scaffold.
 *
 * Per-manifest integration test: derive7FieldLineage + printFooter for every
 * manifest in the registry and assert all 7 fields render correctly per
 * red line #12 (lineage-mandatory).
 *
 * Mirror of `verifyCatchesDrift.test.js` Check 6 at the per-manifest registry
 * level. The verifyCatchesDrift file uses fixture manifests; this file
 * exercises the actual `cardRegistry.manifests`.
 *
 * PRF Phase 5 — Session 15 (PRF-G5-LG).
 */

import { describe, test, expect } from 'vitest';
import { manifests } from '../cardRegistry.js';
import { derive7FieldLineage, printFooter } from '../lineage.js';

const RUNTIME_FIXTURE = { engineVersion: 'v4.7.2-test', appVersion: 'v123-test' };

describe('PRF-G5-LG — lineage footer rendering at the registry level', () => {
  test('registry has at least 1 manifest to exercise', () => {
    expect(manifests.length).toBeGreaterThan(0);
  });

  describe.each(manifests.map((m) => [m.cardId, m]))('%s', (_cardId, m) => {
    const lineage = derive7FieldLineage(m, RUNTIME_FIXTURE);
    const footer = printFooter(lineage);
    const lines = footer.split('\n');

    test('renders exactly 7 numbered lines', () => {
      expect(lines).toHaveLength(7);
      lines.forEach((line, idx) => {
        expect(line, `line[${idx}] should start with [${idx + 1}]`).toMatch(new RegExp(`^\\[${idx + 1}\\] `));
      });
    });

    test('field [1] cardIdSemver renders cardId + version', () => {
      expect(lines[0]).toContain(m.cardId);
      expect(lines[0]).toMatch(/v\d+/);
    });

    test('field [2] generationDate renders an ISO8601 timestamp', () => {
      expect(lines[1]).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    test('field [3] sourceUtilTrail renders something non-empty', () => {
      const trail = lines[2].slice('[3] '.length);
      expect(trail.trim().length).toBeGreaterThan(0);
    });

    test('field [4] engineAppVersion renders both engine + app versions', () => {
      expect(lines[3]).toContain('engine');
      expect(lines[3]).toContain('app');
      // RUNTIME_FIXTURE values present
      expect(lines[3]).toContain('v4.7.2-test');
      expect(lines[3]).toContain('v123-test');
    });

    test('field [5] theoryCitation renders the manifest citation', () => {
      expect(lines[4]).toContain(m.theoryCitation);
    });

    test('field [6] assumptionBundle renders stable-stringified assumptions', () => {
      const bundle = lines[5].slice('[6] '.length);
      expect(bundle.trim().length).toBeGreaterThan(0);
      // Should be JSON-shaped
      expect(bundle).toMatch(/^\{/);
      expect(bundle).toMatch(/\}$/);
    });

    test('field [7] bucketDefinitionsCited renders null-marker or non-empty string', () => {
      const field = lines[6].slice('[7] '.length);
      if (m.bucketDefinitionsCited === null) {
        expect(field).toContain('(no bucket definitions cited)');
      } else {
        expect(field.trim().length).toBeGreaterThan(0);
      }
    });

    test('lineage object has exactly 7 named fields (no extras, no missing)', () => {
      expect(Object.keys(lineage).sort()).toEqual([
        'assumptionBundle',
        'bucketDefinitionsCited',
        'cardIdSemver',
        'engineAppVersion',
        'generationDate',
        'sourceUtilTrail',
        'theoryCitation',
      ]);
    });
  });
});

describe('PRF-G5-LG — lineage footer fallback paths', () => {
  test('engineAppVersion uses unknown markers when runtime not supplied', () => {
    const m = manifests[0];
    const lineage = derive7FieldLineage(m); // no runtime arg
    expect(lineage.engineAppVersion).toMatch(/unknown/);
  });

  test('printFooter is deterministic for fixed input', () => {
    const m = manifests[0];
    const lineage = derive7FieldLineage(m, RUNTIME_FIXTURE);
    const a = printFooter(lineage);
    const b = printFooter(lineage);
    expect(a).toBe(b);
  });
});
