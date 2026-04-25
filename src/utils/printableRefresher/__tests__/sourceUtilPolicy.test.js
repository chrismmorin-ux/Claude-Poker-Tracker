/**
 * sourceUtilPolicy.test.js — unit coverage for validateSourceUtils +
 * WHITELIST_REGEXES + BLACKLIST_REGEXES.
 *
 * The end-to-end "every manifest's sourceUtils is policy-clean" assertion lives
 * in `contentDrift.test.js` (Check 2). These tests cover the validator's logic
 * across passing + failing fixtures so the policy itself stays exercised even
 * when the manifest registry is small.
 */

import { describe, test, expect } from 'vitest';
import {
  WHITELIST_REGEXES,
  BLACKLIST_REGEXES,
  validateSourceUtils,
} from '../sourceUtilPolicy.js';

const baseManifest = {
  cardId: 'TEST-CARD',
  bodyMarkdown: 'rake-agnostic 100bb effective; pure pot-odds derivation.',
  sourceUtils: [],
};

describe('sourceUtilPolicy — regex shape', () => {
  test('exposes 3 whitelist regexes', () => {
    expect(WHITELIST_REGEXES).toHaveLength(3);
    WHITELIST_REGEXES.forEach((re) => expect(re).toBeInstanceOf(RegExp));
  });

  test('exposes 7 blacklist regexes (per charter)', () => {
    expect(BLACKLIST_REGEXES).toHaveLength(7);
    BLACKLIST_REGEXES.forEach((re) => expect(re).toBeInstanceOf(RegExp));
  });
});

describe('sourceUtilPolicy — validateSourceUtils', () => {
  test('empty sourceUtils is the spec-blessed pass-through case (auto-profit)', () => {
    const r = validateSourceUtils({ ...baseManifest, sourceUtils: [] });
    expect(r.valid).toBe(true);
    expect(r.violations).toEqual([]);
  });

  test('whitelisted pokerCore path passes', () => {
    const r = validateSourceUtils({
      ...baseManifest,
      sourceUtils: [{ path: 'src/utils/pokerCore/preflopCharts.js', hash: 'sha256:abc', fn: 'computeOpenRange' }],
    });
    expect(r.valid).toBe(true);
  });

  test('whitelisted gameTreeConstants path passes', () => {
    const r = validateSourceUtils({
      ...baseManifest,
      sourceUtils: [{ path: 'src/constants/gameTreeConstants.js', hash: 'sha256:abc', fn: 'POPULATION_FOLD_RATES' }],
    });
    expect(r.valid).toBe(true);
  });

  test('whitelisted POKER_THEORY.md path passes', () => {
    const r = validateSourceUtils({
      ...baseManifest,
      sourceUtils: [{ path: '.claude/context/POKER_THEORY.md', hash: 'sha256:abc', fn: 'section-3-1' }],
    });
    expect(r.valid).toBe(true);
  });

  test('blacklisted villainDecisionModel fails with clear violation', () => {
    const r = validateSourceUtils({
      ...baseManifest,
      sourceUtils: [{ path: 'src/utils/exploitEngine/villainDecisionModel.js', hash: 'sha256:abc', fn: 'computeFold' }],
    });
    expect(r.valid).toBe(false);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].kind).toBe('blacklist-match');
    expect(r.violations[0].detail).toContain('villainDecisionModel.js');
  });

  test('blacklisted assumptionEngine namespace fails', () => {
    const r = validateSourceUtils({
      ...baseManifest,
      sourceUtils: [{ path: 'src/utils/assumptionEngine/index.js', hash: 'sha256:abc', fn: 'derive' }],
    });
    expect(r.valid).toBe(false);
    expect(r.violations[0].kind).toBe('blacklist-match');
  });

  test('blacklisted anchorLibrary namespace fails', () => {
    const r = validateSourceUtils({
      ...baseManifest,
      sourceUtils: [{ path: 'src/utils/anchorLibrary/retirementEvaluator.js', hash: 'sha256:abc', fn: 'evaluate' }],
    });
    expect(r.valid).toBe(false);
    expect(r.violations[0].kind).toBe('blacklist-match');
  });

  test('blacklisted CalibrationDashboardView fails', () => {
    const r = validateSourceUtils({
      ...baseManifest,
      sourceUtils: [{ path: 'src/components/views/CalibrationDashboardView/index.jsx', hash: 'sha256:abc', fn: 'render' }],
    });
    expect(r.valid).toBe(false);
    expect(r.violations[0].kind).toBe('blacklist-match');
  });

  test('non-whitelisted non-blacklisted path produces whitelist-miss violation', () => {
    const r = validateSourceUtils({
      ...baseManifest,
      sourceUtils: [{ path: 'src/utils/handAnalysis/heroAnalysis.js', hash: 'sha256:abc', fn: 'analyze' }],
    });
    expect(r.valid).toBe(false);
    expect(r.violations[0].kind).toBe('whitelist-miss');
  });

  test('multiple violations are enumerated, not short-circuited', () => {
    const r = validateSourceUtils({
      ...baseManifest,
      sourceUtils: [
        { path: 'src/utils/exploitEngine/villainDecisionModel.js', hash: 'sha256:abc', fn: 'a' },
        { path: 'src/utils/anchorLibrary/x.js', hash: 'sha256:def', fn: 'b' },
      ],
    });
    expect(r.valid).toBe(false);
    expect(r.violations).toHaveLength(2);
  });

  test('bodyMarkdown reference to blacklisted symbol is rejected even when sourceUtils is clean', () => {
    const r = validateSourceUtils({
      ...baseManifest,
      bodyMarkdown: 'rake-agnostic 100bb effective; see villainDecisionModel for per-villain calibration.',
      sourceUtils: [],
    });
    expect(r.valid).toBe(false);
    expect(r.violations[0].kind).toBe('blacklist-body-reference');
  });

  test('bodyMarkdown reference to assumptionEngine is rejected', () => {
    const r = validateSourceUtils({
      ...baseManifest,
      bodyMarkdown: 'rake-agnostic 100bb effective; assumptionEngine derives priors.',
    });
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.kind === 'blacklist-body-reference')).toBeTruthy();
  });

  test('blacklist + body-reference combine into multiple violations', () => {
    const r = validateSourceUtils({
      ...baseManifest,
      bodyMarkdown: 'see anchorLibrary for retirement state.',
      sourceUtils: [{ path: 'src/utils/anchorLibrary/x.js', hash: 'sha256:abc', fn: 'a' }],
    });
    expect(r.valid).toBe(false);
    expect(r.violations.length).toBeGreaterThanOrEqual(2);
  });

  test('missing sourceUtils field treated as empty (graceful default)', () => {
    const r = validateSourceUtils({ cardId: 'X', bodyMarkdown: 'rake-agnostic 100bb' });
    expect(r.valid).toBe(true);
  });
});
