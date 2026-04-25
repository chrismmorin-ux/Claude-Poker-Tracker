/**
 * contentDrift.test.js — the load-bearing PRF CI gate.
 *
 * Implements the 6 checks from `docs/projects/printable-refresher/content-drift-ci.md`.
 * Per Phase 5 sequencing this file ships incrementally:
 *   - S2: Check 1 (contentHash recomputation, with stub-prefix hard-fail guard) +
 *         Check 6 (lineage-footer 7-field completeness).
 *   - S3 (this commit): Check 2 (source-util whitelist/blacklist) +
 *                       Check 3 (CD forbidden-string grep).
 *   - S4: Check 4 (schemaVersion bump discipline with proseOnlyEdit escape hatch) +
 *         Check 5 (markdown-vs-generated precedence).
 *
 * The schemaVersion-bump escape hatch in Check 1 (RT-108) requires git access
 * and is wired in S4 alongside Check 4. Until then a hash mismatch is hard-fail.
 *
 * Spec: docs/projects/printable-refresher/content-drift-ci.md
 */

import { describe, test, expect } from 'vitest';
import { manifests } from '../cardRegistry.js';
import {
  computeSourceHash,
  derive7FieldLineage,
  isStubContentHash,
  printFooter,
} from '../lineage.js';
import { validateSourceUtils } from '../sourceUtilPolicy.js';
import { validateCopyDiscipline } from '../copyDisciplinePatterns.js';

describe('contentDrift CI — Check 1 (contentHash vs recomputation)', () => {
  describe.each(manifests.map((m) => [m.cardId, m]))('%s', (_cardId, m) => {
    test('contentHash is not a stub placeholder (must be recomputed before merge)', () => {
      const stub = isStubContentHash(m.contentHash);
      if (stub) {
        throw new Error(
          `Card ${m.cardId} ships with a stub contentHash (${m.contentHash}). ` +
          `Stubs MUST be recomputed via computeSourceHash() before merge to main. ` +
          `Run: node -e "import('./src/utils/printableRefresher/lineage.js').then(({computeSourceHash}) => computeSourceHash(JSON.parse(require('fs').readFileSync('${m.cardId.toLowerCase()}.json'))).then(console.log))"`
        );
      }
      expect(stub).toBe(false);
    });

    test('manifest.contentHash equals computeSourceHash(manifest)', async () => {
      const recomputed = await computeSourceHash(m);
      if (recomputed !== m.contentHash) {
        throw new Error(
          `Content drift on ${m.cardId}: stored contentHash is ${m.contentHash} ` +
          `but recomputed value is ${recomputed}. ` +
          `Either bump schemaVersion + update contentHash (intentional re-version), ` +
          `or revert the source-util change. ` +
          `(S4 wires the schemaVersion-bump escape hatch; until then any drift is hard-fail.)`
        );
      }
      expect(recomputed).toBe(m.contentHash);
    });
  });
});

describe('contentDrift CI — Check 6 (lineage-footer completeness, red line #12)', () => {
  describe.each(manifests.map((m) => [m.cardId, m]))('%s', (_cardId, m) => {
    const lineage = derive7FieldLineage(m, { engineVersion: 'test', appVersion: 'test' });

    test('field [1] cardIdSemver is non-empty string', () => {
      expect(typeof lineage.cardIdSemver).toBe('string');
      expect(lineage.cardIdSemver.trim().length).toBeGreaterThan(0);
    });

    test('field [2] generationDate is non-empty ISO8601 string', () => {
      expect(typeof lineage.generationDate).toBe('string');
      expect(lineage.generationDate.trim().length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(lineage.generationDate))).toBe(false);
    });

    test('field [3] sourceUtilTrail is non-empty string', () => {
      expect(typeof lineage.sourceUtilTrail).toBe('string');
      expect(lineage.sourceUtilTrail.trim().length).toBeGreaterThan(0);
    });

    test('field [4] engineAppVersion is non-empty string', () => {
      expect(typeof lineage.engineAppVersion).toBe('string');
      expect(lineage.engineAppVersion.trim().length).toBeGreaterThan(0);
    });

    test('field [5] theoryCitation is non-empty string', () => {
      expect(typeof lineage.theoryCitation).toBe('string');
      expect(lineage.theoryCitation.trim().length).toBeGreaterThan(0);
    });

    test('field [6] assumptionBundle is non-empty string', () => {
      expect(typeof lineage.assumptionBundle).toBe('string');
      expect(lineage.assumptionBundle.trim().length).toBeGreaterThan(0);
    });

    test('field [7] bucketDefinitionsCited is null OR non-empty string', () => {
      if (lineage.bucketDefinitionsCited !== null) {
        expect(typeof lineage.bucketDefinitionsCited).toBe('string');
        expect(lineage.bucketDefinitionsCited.trim().length).toBeGreaterThan(0);
      }
    });
  });
});

describe('contentDrift CI — Check 2 (source-util whitelist + blacklist)', () => {
  describe.each(manifests.map((m) => [m.cardId, m]))('%s', (_cardId, m) => {
    test('passes source-util policy', () => {
      const result = validateSourceUtils(m);
      if (!result.valid) {
        const detail = result.violations
          .map((v) => `  • [${v.kind}] ${v.detail}`)
          .join('\n');
        throw new Error(
          `Source-util violation on ${m.cardId}:\n${detail}\n` +
          `Per charter §Source-util whitelist/blacklist + Voice 3 F4/F6, calibration / ` +
          `assumption / per-villain utilities must not ship on paper. Refactor to source ` +
          `from src/utils/pokerCore/ + src/constants/gameTreeConstants.js + ` +
          `.claude/context/POKER_THEORY.md, or redirect the card to an on-screen surface.`
        );
      }
      expect(result.valid).toBe(true);
    });
  });
});

describe('contentDrift CI — Check 3 (CD forbidden-string grep)', () => {
  describe.each(manifests.map((m) => [m.cardId, m]))('%s', (_cardId, m) => {
    test('passes CD-1..CD-5 copy discipline', () => {
      const lineage = derive7FieldLineage(m, { engineVersion: 'test', appVersion: 'test' });
      const renderedFooter = printFooter(lineage);
      const result = validateCopyDiscipline(m, renderedFooter);
      if (!result.valid) {
        const detail = result.violations
          .map((v) => `  • [${v.rule}] ${v.label}\n    excerpt: ${v.excerpt}`)
          .join('\n');
        throw new Error(
          `Copy-discipline violation on ${m.cardId}:\n${detail}\n` +
          `See docs/projects/printable-refresher/copy-discipline.md for rules. ` +
          `Adding/removing patterns requires persona-level review per amendment rule.`
        );
      }
      expect(result.valid).toBe(true);
    });
  });
});
