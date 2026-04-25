/**
 * contentDrift.test.js — the load-bearing PRF CI gate.
 *
 * Implements all 6 checks from `docs/projects/printable-refresher/content-drift-ci.md`.
 * Phase 5 sequencing reached completion at S4 (this file's final form):
 *   - S2: Check 1 (contentHash recomputation) + Check 6 (lineage-footer completeness).
 *   - S3: Check 2 (source-util whitelist/blacklist) + Check 3 (CD forbidden-string grep).
 *   - S4 (current): Check 4 (schemaVersion bump discipline + proseOnlyEdit escape hatch)
 *                   + Check 5 (markdown-vs-generated placeholder resolution; hardcoded-
 *                              numeric warning emits via console.warn but does not fail).
 *                   + RT-108 escape-hatch wiring on Check 1 — clearer error messages
 *                     for the bumped-but-stale-hash case via getSchemaVersionChange.
 *
 * Spec: docs/projects/printable-refresher/content-drift-ci.md
 */

import { describe, test, expect } from 'vitest';
import { manifests, manifestEntries } from '../cardRegistry.js';
import {
  computeSourceHash,
  derive7FieldLineage,
  isStubContentHash,
  printFooter,
} from '../lineage.js';
import { validateSourceUtils } from '../sourceUtilPolicy.js';
import { validateCopyDiscipline } from '../copyDisciplinePatterns.js';
import { getSchemaVersionChange, evaluateCheck4 } from '../getSchemaVersionChange.js';

const MANIFESTS_DIR_REL = 'src/utils/printableRefresher/manifests';

function manifestRelPathFor(cardId) {
  const entry = manifestEntries.find((e) => e.manifest.cardId === cardId);
  return entry ? `${MANIFESTS_DIR_REL}/${entry.filename}` : null;
}

const PLACEHOLDER_REGEX = /\{\{([\w.-]+(?:\[[^\]]+\])?)\}\}/g;

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

    test('manifest.contentHash equals computeSourceHash(manifest) (with RT-108 escape-hatch messaging)', async () => {
      const recomputed = await computeSourceHash(m);
      if (recomputed === m.contentHash) {
        expect(recomputed).toBe(m.contentHash);
        return;
      }

      // Hash mismatches. Inspect git context to produce an actionable message.
      const change = getSchemaVersionChange(m, { manifestRelPath: manifestRelPathFor(m.cardId) });
      if (change.exists && change.bumped) {
        throw new Error(
          `Content drift on ${m.cardId} (RT-108 escape hatch): schemaVersion bumped from ` +
          `${change.prior.schemaVersion} to ${m.schemaVersion} but contentHash was not updated. ` +
          `Run: node scripts/refresher-compute-hash.js ${m.cardId} ` +
          `→ updates manifest.contentHash to recomputed ${recomputed}. ` +
          `(Stored: ${m.contentHash}.)`
        );
      }
      throw new Error(
        `Content drift on ${m.cardId}: stored contentHash is ${m.contentHash} ` +
        `but recomputed value is ${recomputed}. ` +
        `Either bump schemaVersion + run scripts/refresher-compute-hash.js (intentional re-version), ` +
        `or revert the source-util change.`
      );
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

describe('contentDrift CI — Check 4 (schemaVersion bump discipline)', () => {
  describe.each(manifests.map((m) => [m.cardId, m]))('%s', (_cardId, m) => {
    test('passes schemaVersion-bump + proseOnlyEdit decision tree', () => {
      const change = getSchemaVersionChange(m, { manifestRelPath: manifestRelPathFor(m.cardId) });
      const result = evaluateCheck4(change);
      if (!result.pass) {
        throw new Error(
          `schemaVersion-bump discipline violation on ${m.cardId}: ${result.reason}\n` +
          `See docs/projects/printable-refresher/content-drift-ci.md §Check 4 for the 5-branch decision tree.`
        );
      }
      expect(result.pass).toBe(true);
    });
  });
});

describe('contentDrift CI — Check 5 (markdown-vs-generated placeholder resolution)', () => {
  describe.each(manifests.map((m) => [m.cardId, m]))('%s', (_cardId, m) => {
    test('every {{placeholder}} in bodyMarkdown resolves via generatedFields', () => {
      const body = String(m.bodyMarkdown || '');
      const generatedFields = m.generatedFields || {};
      const placeholders = [...body.matchAll(PLACEHOLDER_REGEX)].map((mm) => mm[1]);
      const unresolved = placeholders.filter((p) => {
        const baseKey = p.split('[')[0];
        return !(baseKey in generatedFields);
      });
      if (unresolved.length > 0) {
        throw new Error(
          `Markdown-vs-generated violation on ${m.cardId}: ` +
          `bodyMarkdown references placeholder(s) [${unresolved.join(', ')}] ` +
          `but generatedFields does not declare them. ` +
          `Either add the entry to generatedFields (with a resolvable path#fn reference) ` +
          `or replace the placeholder with prose. ` +
          `See docs/projects/printable-refresher/content-drift-ci.md §Check 5.`
        );
      }
      expect(unresolved).toEqual([]);
    });

    test('hardcoded numerics in bodyMarkdown emit warnings (soft gate, not failure)', () => {
      // Spec §Check 5: WARN, not fail. We pass any time, but log to console.warn
      // so reviewers can see hardcoded numbers that could have been generated.
      const body = String(m.bodyMarkdown || '');
      const generatedFields = m.generatedFields || {};
      const theoryCitation = String(m.theoryCitation || '');
      const hasGenerated = Object.keys(generatedFields).length > 0;
      const hasTheoryCitation = theoryCitation.trim().length > 0;
      const numerics = [...body.matchAll(/\b\d+(?:\.\d+)?%/g)];
      if (numerics.length > 0 && !hasGenerated && !hasTheoryCitation) {
        // eslint-disable-next-line no-console
        console.warn(
          `[Check 5 soft-warn] ${m.cardId}: bodyMarkdown contains ${numerics.length} hardcoded numeric value(s) ` +
          `with neither generatedFields nor theoryCitation backing. ` +
          `Author should justify (worked example / glossary) or migrate to a generated placeholder.`
        );
      }
      expect(true).toBe(true);
    });
  });
});
