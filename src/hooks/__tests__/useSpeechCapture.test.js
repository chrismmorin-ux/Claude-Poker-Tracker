// @vitest-environment jsdom
/**
 * useSpeechCapture.test.js — long-form Web Speech lifecycle.
 *
 * THE REGRESSION THIS FILE EXISTS FOR (reported from live use 2026-08-01):
 * narration captured only short fragments.
 *
 * Chrome ends continuous recognition on its own after a pause — routinely,
 * several times inside one narration. The original restart path called
 * `start()` again on the instance that had just ended, which throws
 * InvalidStateError; the fallback then swallowed its own failure and returned,
 * leaving `isRecording` true with no live microphone. The session looked alive
 * and captured nothing more.
 *
 * Fix: always build a FRESH instance on restart, treat a failed restart as
 * retryable rather than terminal, and only concede after repeated failures.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechCapture } from '../useSpeechCapture';

let instances = [];
let failNextStarts = 0;

class MockRecognition {
  constructor() {
    this.continuous = false;
    this.interimResults = false;
    this.maxAlternatives = 1;
    this.lang = '';
    this.started = false;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.onspeechstart = null;
    instances.push(this);
  }

  start() {
    if (failNextStarts > 0) {
      failNextStarts -= 1;
      throw new Error('InvalidStateError');
    }
    this.started = true;
  }

  stop() {
    this.started = false;
  }

  /** Simulate a final transcript arriving. */
  emit(transcript, confidence = 0.9) {
    if (!this.onresult) return;
    this.onresult({
      resultIndex: 0,
      results: [Object.assign([{ transcript, confidence }], { isFinal: true, length: 1 })],
    });
  }

  /** Simulate Chrome ending recognition on its own. */
  endNaturally() {
    if (this.onend) this.onend();
  }
}

const live = () => instances.filter((i) => i.started);

beforeEach(() => {
  instances = [];
  failNextStarts = 0;
  vi.useFakeTimers();
  global.window.SpeechRecognition = MockRecognition;
});

afterEach(() => {
  vi.useRealTimers();
  delete global.window.SpeechRecognition;
});

describe('useSpeechCapture — session survives Chrome auto-ending recognition', () => {
  it('REGRESSION: builds a FRESH instance on restart rather than reusing the dead one', () => {
    const { result } = renderHook(() => useSpeechCapture({ onSessionEnd: vi.fn() }));

    act(() => { result.current.start(); });
    expect(instances).toHaveLength(1);
    const first = instances[0];

    act(() => { first.endNaturally(); });

    // A second instance exists and is running; the dead one was not restarted.
    expect(instances.length).toBeGreaterThan(1);
    expect(live()).toHaveLength(1);
    expect(live()[0]).not.toBe(first);
    expect(result.current.isRecording).toBe(true);
  });

  it('stays recording across several natural ends', () => {
    const onSessionEnd = vi.fn();
    const { result } = renderHook(() => useSpeechCapture({ onSessionEnd }));

    act(() => { result.current.start(); });
    for (let i = 0; i < 5; i++) {
      act(() => { instances[instances.length - 1].endNaturally(); });
    }

    expect(result.current.isRecording).toBe(true);
    expect(onSessionEnd).not.toHaveBeenCalled();
  });

  it('keeps segments spoken before and after a restart in one session', () => {
    const onSessionEnd = vi.fn();
    const { result } = renderHook(() => useSpeechCapture({ onSessionEnd }));

    act(() => { result.current.start(); });
    act(() => { instances[0].emit('he bets small on the turn'); });
    act(() => { instances[0].endNaturally(); });
    act(() => { instances[instances.length - 1].emit('that sizing is a draw'); });
    act(() => { result.current.stop(); });

    expect(onSessionEnd).toHaveBeenCalledTimes(1);
    const [segments] = onSessionEnd.mock.calls[0];
    expect(segments.map((s) => s.text)).toEqual([
      'he bets small on the turn',
      'that sizing is a draw',
    ]);
  });

  it('retries after a failed restart instead of dying on the first failure', () => {
    const onSessionEnd = vi.fn();
    const { result } = renderHook(() => useSpeechCapture({ onSessionEnd }));

    act(() => { result.current.start(); });
    failNextStarts = 1;                       // the immediate restart throws
    act(() => { instances[0].endNaturally(); });

    expect(onSessionEnd).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(300); });  // backoff retry succeeds
    expect(live()).toHaveLength(1);
    expect(result.current.isRecording).toBe(true);
  });

  it('concedes only after repeated restart failures, and reports it interrupted', () => {
    const onSessionEnd = vi.fn();
    const { result } = renderHook(() => useSpeechCapture({ onSessionEnd }));

    act(() => { result.current.start(); });
    act(() => { instances[0].emit('a partial thought'); });

    failNextStarts = 99;                      // every restart fails
    for (let i = 0; i < 6; i++) {
      act(() => {
        const last = instances[instances.length - 1];
        if (last.onend) last.onend();
        vi.advanceTimersByTime(300);
      });
      if (onSessionEnd.mock.calls.length) break;
    }

    expect(onSessionEnd).toHaveBeenCalled();
    const [segments, meta] = onSessionEnd.mock.calls[0];
    // The words already spoken survive — this lane loses evidence, never data.
    expect(segments.map((s) => s.text)).toEqual(['a partial thought']);
    expect(meta.interrupted).toBe(true);
  });
});

describe('useSpeechCapture — retention polarity', () => {
  it('keeps a low-confidence segment (no floor)', () => {
    const onSessionEnd = vi.fn();
    const { result } = renderHook(() => useSpeechCapture({ onSessionEnd }));

    act(() => { result.current.start(); });
    act(() => { instances[0].emit('muttered read', 0.04); });
    act(() => { result.current.stop(); });

    const [segments] = onSessionEnd.mock.calls[0];
    expect(segments).toHaveLength(1);
    expect(segments[0].confidence).toBe(0.04);
  });

  it('stamps each segment with the context current when it was spoken', () => {
    const onSessionEnd = vi.fn();
    let street = 'flop';
    const { result } = renderHook(() =>
      useSpeechCapture({ onSessionEnd, captureContext: () => ({ street }) }),
    );

    act(() => { result.current.start(); });
    act(() => { instances[0].emit('on the flop he checks'); });
    street = 'turn';                                   // founder steps forward
    act(() => { instances[0].emit('now the turn bricks'); });
    act(() => { result.current.stop(); });

    const [segments] = onSessionEnd.mock.calls[0];
    expect(segments.map((s) => s.context.street)).toEqual(['flop', 'turn']);
  });

  it('delivers the session as interrupted when the tab is hidden mid-narration', () => {
    const onSessionEnd = vi.fn();
    const { result } = renderHook(() => useSpeechCapture({ onSessionEnd }));

    act(() => { result.current.start(); });
    act(() => { instances[0].emit('half a thought'); });

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(onSessionEnd).toHaveBeenCalledTimes(1);
    const [segments, meta] = onSessionEnd.mock.calls[0];
    expect(segments).toHaveLength(1);
    expect(meta.interrupted).toBe(true);
  });
});
