/**
 * storage-warning.test.js — WS-515 founder-visible permanent-loss warning.
 *
 * Permanent hand loss was reported only to `errors.report`, which nobody reads,
 * and the quota throw that causes it was swallowed entirely. The founder's first
 * evidence that hands were missing would have been a short session in the corpus
 * months later, with no way to tell it from a session that really was short.
 */

import { describe, it, expect } from 'vitest';
import { buildStorageWarning, JOURNAL_LOW_HEADROOM_HANDS } from '../render-orchestrator.js';

const healthy = { quotaFailures: 0, dropped: 0, estRemainingHands: 5000, entries: 12 };

describe('WS-515 — permanent hand loss is visible', () => {
  it('says nothing when storage is healthy', () => {
    expect(buildStorageWarning(healthy)).toBe('');
  });

  it('says nothing when health is unknown — unknown is not evidence of loss', () => {
    expect(buildStorageWarning(null)).toBe('');
    expect(buildStorageWarning(undefined)).toBe('');
  });

  it('reports hands that have no durable copy', () => {
    const w = buildStorageWarning({ ...healthy, quotaFailures: 3 });
    expect(w).toMatch(/Storage full/);
    expect(w).toMatch(/3 hands have NO durable copy/);
  });

  it('reports hands permanently dropped', () => {
    const w = buildStorageWarning({ ...healthy, dropped: 12 });
    expect(w).toMatch(/12 hands permanently dropped/);
  });

  it('reports both kinds of loss together when both happened', () => {
    const w = buildStorageWarning({ ...healthy, quotaFailures: 2, dropped: 5 });
    expect(w).toMatch(/NO durable copy/);
    expect(w).toMatch(/permanently dropped/);
  });

  it('gets the singular right — a warning that reads wrong reads as noise', () => {
    expect(buildStorageWarning({ ...healthy, quotaFailures: 1 })).toMatch(/1 hand have NO|1 hand has NO|1 hand /);
    expect(buildStorageWarning({ ...healthy, dropped: 1 })).toMatch(/1 hand permanently dropped/);
  });

  it('warns BEFORE loss when headroom runs low', () => {
    const w = buildStorageWarning({ ...healthy, estRemainingHands: 50 });
    expect(w).toMatch(/nearly full/);
    expect(w).toMatch(/about 50 more hands/);
  });

  it('does not nag while headroom is ample', () => {
    expect(buildStorageWarning({ ...healthy, estRemainingHands: JOURNAL_LOW_HEADROOM_HANDS })).toBe('');
  });

  it('prioritises actual loss over the headroom hint', () => {
    // If hands are already gone, saying "nearly full" would understate it.
    const w = buildStorageWarning({ ...healthy, quotaFailures: 4, estRemainingHands: 10 });
    expect(w).toMatch(/NO durable copy/);
    expect(w).not.toMatch(/nearly full/);
  });

  it('does not warn on unlimited storage, where estRemainingHands is null', () => {
    expect(buildStorageWarning({ ...healthy, estRemainingHands: null })).toBe('');
  });
});
