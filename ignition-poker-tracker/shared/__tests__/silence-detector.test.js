/**
 * silence-detector.test.js — WS-516.
 *
 * THE TEST THAT MATTERS is 'escalates through every threshold AFTER capture has
 * been running'. Against the pre-fix code that path was unreachable: the
 * detector early-returned on `gameWsMessageCount > 0`, a monotonic counter never
 * reset anywhere, so the guard was permanently true from the first game message
 * onward. Every pre-existing test exercised only the zero-message path — the one
 * path the broken guard still allowed through — which is why the defect shipped.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateSilence,
  isRecordableGap,
  SILENCE_THRESHOLDS,
  GAP_MIN_MS,
} from '../silence-detector.js';

const T0 = 1_000_000;
const base = {
  now: T0,
  probeReady: true,
  captureStartedAt: T0 - 600_000,
  probeReadyAt: T0 - 600_000,
  lastWsMessageAt: T0,
  captureEverStarted: true,
  prevLevel: null,
};

describe('WS-516 — silence detection is a recency question', () => {
  it('escalates through every threshold AFTER capture has been running', () => {
    // The regression. Capture ran and produced messages; then the socket died.
    // Pre-fix this produced nothing at all, at any elapsed time, forever.
    const lastMsg = T0;
    let prevLevel = null;
    const seen = [];

    for (const t of SILENCE_THRESHOLDS) {
      const v = evaluateSilence({
        ...base,
        now: lastMsg + t.afterMs,
        lastWsMessageAt: lastMsg,
        captureEverStarted: true,
        prevLevel,
      });
      expect(v.escalated).toBe(true);
      seen.push(v.level);
      prevLevel = v.level;
    }

    expect(seen).toEqual(['info', 'warning', 'stale', 'dead']);
  });

  it('raises recovery at stale and dead even though capture had been running', () => {
    const lastMsg = T0;
    const stale = evaluateSilence({
      ...base, now: lastMsg + 60_000, lastWsMessageAt: lastMsg, prevLevel: 'warning',
    });
    expect(stale.level).toBe('stale');
    expect(stale.recoveryNeeded).toBe(true);

    const dead = evaluateSilence({
      ...base, now: lastMsg + 300_000, lastWsMessageAt: lastMsg, prevLevel: 'stale',
    });
    expect(dead.level).toBe('dead');
    expect(dead.recoveryNeeded).toBe(true);
  });

  it('a capture that never started raises the SAME levels', () => {
    // Both problems raise; only the wording differs.
    const started = evaluateSilence({
      ...base, now: T0 + 60_000, lastWsMessageAt: T0, captureEverStarted: true, prevLevel: null,
    });
    const never = evaluateSilence({
      ...base, now: T0 + 60_000, lastWsMessageAt: null, probeReadyAt: T0,
      captureEverStarted: false, prevLevel: null,
    });
    expect(never.level).toBe(started.level);
    expect(never.recoveryNeeded).toBe(started.recoveryNeeded);
  });

  it('words the two situations differently — they need different actions', () => {
    const stopped = evaluateSilence({
      ...base, now: T0 + 60_000, lastWsMessageAt: T0, captureEverStarted: true, prevLevel: null,
    });
    const never = evaluateSilence({
      ...base, now: T0 + 60_000, lastWsMessageAt: null, probeReadyAt: T0,
      captureEverStarted: false, prevLevel: null,
    });
    expect(stopped.message).not.toBe(never.message);
    expect(stopped.message).toMatch(/stopped/i);
    expect(stopped.message).toMatch(/NOT being recorded/i);
    expect(never.message).not.toMatch(/stopped/i);
  });

  it('does not re-alert while sitting at the same level', () => {
    const v = evaluateSilence({
      ...base, now: T0 + 70_000, lastWsMessageAt: T0, prevLevel: 'stale',
    });
    expect(v.level).toBe('stale');
    expect(v.escalated).toBe(false);
    expect(v.recoveryNeeded).toBe(false);
  });

  it('clears when traffic resumes, and reports the clear exactly once', () => {
    const resumed = evaluateSilence({
      ...base, now: T0 + 1_000, lastWsMessageAt: T0 + 500, prevLevel: 'dead',
    });
    expect(resumed.level).toBeNull();
    expect(resumed.cleared).toBe(true);

    const stillAlive = evaluateSilence({
      ...base, now: T0 + 2_000, lastWsMessageAt: T0 + 1_900, prevLevel: null,
    });
    expect(stillAlive.cleared).toBe(false);
  });

  it('reports the gap start as the last observed activity', () => {
    const v = evaluateSilence({
      ...base, now: T0 + 300_000, lastWsMessageAt: T0, prevLevel: null,
    });
    expect(v.gapFrom).toBe(T0);
    expect(v.silenceMs).toBe(300_000);
  });

  it('measures recency from the LAST message, not from capture start', () => {
    // A long, healthy session must not read as silent just because it is old.
    const v = evaluateSilence({
      ...base,
      now: T0 + 3_600_000,
      captureStartedAt: T0,
      probeReadyAt: T0,
      lastWsMessageAt: T0 + 3_600_000 - 1_000,
      prevLevel: null,
    });
    expect(v.level).toBeNull();
    expect(v.silenceMs).toBe(1_000);
  });

  it('never lets a message count influence the level', () => {
    // The defect, pinned directly: the verdict must be identical whether or not
    // capture has ever started, for the same recency.
    const withCount = evaluateSilence({
      ...base, now: T0 + 300_000, lastWsMessageAt: T0, captureEverStarted: true, prevLevel: null,
    });
    const withoutCount = evaluateSilence({
      ...base, now: T0 + 300_000, lastWsMessageAt: T0, captureEverStarted: false, prevLevel: null,
    });
    expect(withCount.level).toBe(withoutCount.level);
    expect(withCount.silenceMs).toBe(withoutCount.silenceMs);
    expect(withCount.escalated).toBe(withoutCount.escalated);
  });

  describe('probe never attached', () => {
    it('warns once after 5s and does not repeat', () => {
      const first = evaluateSilence({
        ...base, probeReady: false, now: T0, captureStartedAt: T0 - 6_000, prevLevel: null,
      });
      expect(first.level).toBe('no_probe');
      expect(first.probeStalled).toBe(true);

      const second = evaluateSilence({
        ...base, probeReady: false, now: T0 + 5_000, captureStartedAt: T0 - 6_000, prevLevel: 'no_probe',
      });
      expect(second.escalated).toBe(false);
    });

    it('stays quiet inside the first 5s', () => {
      const v = evaluateSilence({
        ...base, probeReady: false, now: T0, captureStartedAt: T0 - 1_000, prevLevel: null,
      });
      expect(v.escalated).toBe(false);
      expect(v.probeStalled).toBe(false);
    });
  });

  describe('isRecordableGap', () => {
    it('records a gap at or past the stale threshold', () => {
      expect(isRecordableGap(T0, T0 + GAP_MIN_MS)).toBe(true);
      expect(isRecordableGap(T0, T0 + 300_000)).toBe(true);
    });

    it('ignores ordinary quiet between hands', () => {
      expect(isRecordableGap(T0, T0 + 15_000)).toBe(false);
      expect(isRecordableGap(T0, T0)).toBe(false);
    });

    it('ignores malformed input', () => {
      expect(isRecordableGap(null, T0)).toBe(false);
      expect(isRecordableGap(T0, undefined)).toBe(false);
    });
  });
});
