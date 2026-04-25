/**
 * getSchemaVersionChange.test.js — unit coverage for describeChange +
 * evaluateCheck4 + getSchemaVersionChange (with gitShow injection).
 *
 * Strategy: pure helpers (`describeChange` / `evaluateCheck4`) test against
 * fixture pairs; `getSchemaVersionChange` tests inject a mock gitShow so we
 * never invoke real git from the test runner.
 *
 * The 5-branch decision tree per spec §Check 4 is exhaustively covered.
 */

import { describe, test, expect } from 'vitest';
import {
  describeChange,
  evaluateCheck4,
  getSchemaVersionChange,
} from '../getSchemaVersionChange.js';

const cleanManifest = {
  cardId: 'PRF-MATH-AUTO-PROFIT',
  schemaVersion: 1,
  bodyMarkdown: 'Bet B into pot P; rake-agnostic 100bb effective.',
  generatedFields: {},
  sourceUtils: [],
  proseOnlyEdit: false,
};

describe('describeChange — diff detection', () => {
  test('returns exists:false when prior is null', () => {
    const c = describeChange({ prior: null, current: cleanManifest });
    expect(c.exists).toBe(false);
  });

  test('detects no-diff for identical pair', () => {
    const c = describeChange({ prior: cleanManifest, current: cleanManifest });
    expect(c.exists).toBe(true);
    expect(c.diff.anyDiff).toBe(false);
    expect(c.bumped).toBe(false);
    expect(c.decremented).toBe(false);
  });

  test('detects bodyMarkdown diff', () => {
    const next = { ...cleanManifest, bodyMarkdown: 'different body; rake-agnostic 100bb effective.' };
    const c = describeChange({ prior: cleanManifest, current: next });
    expect(c.diff.bodyMarkdownDiffers).toBe(true);
    expect(c.diff.anyDiff).toBe(true);
    expect(c.diff.generatedFieldsDiffer).toBe(false);
    expect(c.diff.sourceUtilsDiffer).toBe(false);
  });

  test('detects generatedFields diff (key-order invariant)', () => {
    const a = { ...cleanManifest, generatedFields: { a: '1', b: '2' } };
    const b = { ...cleanManifest, generatedFields: { b: '2', a: '1' } };
    const same = describeChange({ prior: a, current: b });
    expect(same.diff.generatedFieldsDiffer).toBe(false);

    const c = { ...cleanManifest, generatedFields: { a: '1', b: 'changed' } };
    const diff = describeChange({ prior: a, current: c });
    expect(diff.diff.generatedFieldsDiffer).toBe(true);
  });

  test('detects sourceUtils diff', () => {
    const next = {
      ...cleanManifest,
      sourceUtils: [{ path: 'src/utils/pokerCore/x.js', hash: 'sha256:abc', fn: 'a' }],
    };
    const c = describeChange({ prior: cleanManifest, current: next });
    expect(c.diff.sourceUtilsDiffer).toBe(true);
    expect(c.diff.anyDiff).toBe(true);
  });

  test('detects schemaVersion bumped', () => {
    const next = { ...cleanManifest, schemaVersion: 2, bodyMarkdown: 'updated body; rake-agnostic 100bb effective.' };
    const c = describeChange({ prior: cleanManifest, current: next });
    expect(c.bumped).toBe(true);
    expect(c.decremented).toBe(false);
  });

  test('detects schemaVersion decremented', () => {
    const prior = { ...cleanManifest, schemaVersion: 5 };
    const c = describeChange({ prior, current: { ...cleanManifest, schemaVersion: 4 } });
    expect(c.decremented).toBe(true);
    expect(c.bumped).toBe(false);
  });

  test('proseOnlyEdit propagates from current.proseOnlyEdit:true', () => {
    const next = { ...cleanManifest, bodyMarkdown: 'typo fix; rake-agnostic 100bb effective.', proseOnlyEdit: true };
    const c = describeChange({ prior: cleanManifest, current: next });
    expect(c.proseOnlyEdit).toBe(true);
  });
});

describe('evaluateCheck4 — 5-branch decision tree', () => {
  test('not-in-head (first commit) → PASS', () => {
    const r = evaluateCheck4({ exists: false, reason: 'not-in-head' });
    expect(r.pass).toBe(true);
    expect(r.reason).toMatch(/first-commit/i);
  });

  test('decremented → FAIL', () => {
    const c = describeChange({
      prior: { ...cleanManifest, schemaVersion: 5 },
      current: { ...cleanManifest, schemaVersion: 4 },
    });
    const r = evaluateCheck4(c);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/decremented|monotonic/i);
  });

  test('no-diff + same-version → PASS', () => {
    const c = describeChange({ prior: cleanManifest, current: cleanManifest });
    const r = evaluateCheck4(c);
    expect(r.pass).toBe(true);
  });

  test('diff + bumped → PASS (intentional re-version)', () => {
    const next = { ...cleanManifest, schemaVersion: 2, bodyMarkdown: 'changed; rake-agnostic 100bb effective.' };
    const c = describeChange({ prior: cleanManifest, current: next });
    const r = evaluateCheck4(c);
    expect(r.pass).toBe(true);
    expect(r.reason).toMatch(/intentional re-version/i);
  });

  test('bumped + no-diff → PASS (over-bumping is harmless)', () => {
    const next = { ...cleanManifest, schemaVersion: 2 };
    const c = describeChange({ prior: cleanManifest, current: next });
    const r = evaluateCheck4(c);
    expect(r.pass).toBe(true);
  });

  test('diff + same-version + proseOnlyEdit:true + bodyMarkdown-only → PASS with warning', () => {
    const next = {
      ...cleanManifest,
      bodyMarkdown: 'typo fix; rake-agnostic 100bb effective.',
      proseOnlyEdit: true,
    };
    const c = describeChange({ prior: cleanManifest, current: next });
    const r = evaluateCheck4(c);
    expect(r.pass).toBe(true);
    expect(r.warning).toBe(true);
  });

  test('diff + same-version + proseOnlyEdit:true + generatedFields diff → FAIL (escape hatch misuse)', () => {
    const next = {
      ...cleanManifest,
      generatedFields: { x: 'newRef' },
      proseOnlyEdit: true,
    };
    const c = describeChange({ prior: cleanManifest, current: next });
    const r = evaluateCheck4(c);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/escape hatch misuse/i);
  });

  test('diff + same-version + proseOnlyEdit:true + sourceUtils diff → FAIL (escape hatch misuse)', () => {
    const next = {
      ...cleanManifest,
      sourceUtils: [{ path: 'src/utils/pokerCore/x.js', hash: 'sha256:abc', fn: 'a' }],
      proseOnlyEdit: true,
    };
    const c = describeChange({ prior: cleanManifest, current: next });
    const r = evaluateCheck4(c);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/escape hatch misuse/i);
  });

  test('diff + same-version + no proseOnlyEdit → FAIL (schemaVersion bump required)', () => {
    const next = { ...cleanManifest, bodyMarkdown: 'changed; rake-agnostic 100bb effective.' };
    const c = describeChange({ prior: cleanManifest, current: next });
    const r = evaluateCheck4(c);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/schemaVersion bump|proseOnlyEdit/i);
  });
});

describe('getSchemaVersionChange — git wrapper with injection', () => {
  test('returns exists:false / no-rel-path when manifestRelPath omitted', () => {
    const r = getSchemaVersionChange(cleanManifest, {});
    expect(r.exists).toBe(false);
    expect(r.reason).toBe('no-rel-path');
  });

  test('returns exists:false / not-in-head when gitShow returns null', () => {
    const r = getSchemaVersionChange(cleanManifest, {
      manifestRelPath: 'fake/path.json',
      gitShow: () => null,
    });
    expect(r.exists).toBe(false);
    expect(r.reason).toBe('not-in-head');
  });

  test('returns exists:false / parse-error when gitShow returns non-JSON', () => {
    const r = getSchemaVersionChange(cleanManifest, {
      manifestRelPath: 'fake/path.json',
      gitShow: () => 'this is not valid JSON {',
    });
    expect(r.exists).toBe(false);
    expect(r.reason).toBe('parse-error');
  });

  test('returns full change descriptor when gitShow returns valid prior JSON', () => {
    const r = getSchemaVersionChange(
      { ...cleanManifest, schemaVersion: 2 },
      {
        manifestRelPath: 'fake/path.json',
        gitShow: () => JSON.stringify(cleanManifest),
      }
    );
    expect(r.exists).toBe(true);
    expect(r.bumped).toBe(true);
    expect(r.prior.schemaVersion).toBe(1);
    expect(r.current.schemaVersion).toBe(2);
  });
});
