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

  /**
   * Chrome's stop() does not merely stop: it finalizes the audio captured so
   * far and delivers it through onresult, THEN fires onend. Modelling only the
   * "stops listening" half is what let the tail-loss bug live untested.
   */
  stop() {
    if (!this.started) return;
    this.started = false;
    if (this.pendingFinal !== undefined && this.pendingFinal !== null) {
      const text = this.pendingFinal;
      this.pendingFinal = null;
      this.emit(text);
    }
    if (this.onend) this.onend();
  }

  /** Simulate a final transcript arriving. */
  emit(transcript, confidence = 0.9) {
    if (!this.onresult) return;
    this.onresult({
      resultIndex: 0,
      results: [Object.assign([{ transcript, confidence }], { isFinal: true, length: 1 })],
    });
  }

  /** Simulate in-flight speech the engine has heard but not yet settled. */
  emitInterim(transcript) {
    if (!this.onresult) return;
    this.onresult({
      resultIndex: 0,
      results: [Object.assign([{ transcript, confidence: 0 }], { isFinal: false, length: 1 })],
    });
  }

  /**
   * Speech the engine is holding and will only finalize when stop() is called —
   * exactly the state a long uninterrupted stretch of narration sits in.
   */
  holdUntilStop(transcript) {
    this.pendingFinal = transcript;
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

describe('useSpeechCapture — the tail of a session must survive', () => {
  it('REGRESSION: keeps the result stop() finalizes instead of dropping it', () => {
    const onSessionEnd = vi.fn();
    const { result } = renderHook(() => useSpeechCapture({ onSessionEnd }));

    act(() => { result.current.start(); });
    act(() => { instances[0].emit('utg limps in'); });
    // Everything said since the last pause is still inside the engine. Tearing
    // down before it answers used to discard all of it.
    act(() => { instances[0].holdUntilStop('so I size up to punish the limp'); });

    act(() => { result.current.stop(); });
    act(() => { vi.advanceTimersByTime(2000); });

    expect(onSessionEnd).toHaveBeenCalledTimes(1);
    const [segments] = onSessionEnd.mock.calls[0];
    expect(segments.map((s) => s.text)).toEqual([
      'utg limps in',
      'so I size up to punish the limp',
    ]);
  });

  it('delivers the session exactly once even when the grace timer also fires', () => {
    const onSessionEnd = vi.fn();
    const { result } = renderHook(() => useSpeechCapture({ onSessionEnd }));

    act(() => { result.current.start(); });
    act(() => { instances[0].emit('kings here'); });
    act(() => { result.current.stop(); });
    act(() => { vi.advanceTimersByTime(5000); });

    expect(onSessionEnd).toHaveBeenCalledTimes(1);
  });

  it('retains unfinalized speech when there is no time to wait (tab hidden)', () => {
    const onSessionEnd = vi.fn();
    const { result } = renderHook(() => useSpeechCapture({ onSessionEnd }));

    act(() => { result.current.start(); });
    act(() => { instances[0].emitInterim('both of them are short enough to feel priced in'); });

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const [segments, meta] = onSessionEnd.mock.calls[0];
    expect(segments.map((s) => s.text)).toEqual([
      'both of them are short enough to feel priced in',
    ]);
    // Never scored by the engine, and possibly clipped — both must be legible
    // to a grader rather than passed off as a settled sentence.
    expect(segments[0].confidence).toBeNull();
    expect(segments[0].interrupted).toBe(true);
    expect(meta.interrupted).toBe(true);
  });

  it('does not double-count interim speech that later goes final', () => {
    const onSessionEnd = vi.fn();
    const { result } = renderHook(() => useSpeechCapture({ onSessionEnd }));

    act(() => { result.current.start(); });
    act(() => { instances[0].emitInterim('he calls'); });
    act(() => { instances[0].emit('he calls off his last twelve big blinds'); });
    act(() => { result.current.stop(); });

    const [segments] = onSessionEnd.mock.calls[0];
    expect(segments.map((s) => s.text)).toEqual([
      'he calls off his last twelve big blinds',
    ]);
  });

  it('keeps interim speech the engine never settled before auto-restarting', () => {
    const onSessionEnd = vi.fn();
    const { result } = renderHook(() => useSpeechCapture({ onSessionEnd }));

    act(() => { result.current.start(); });
    act(() => { instances[0].emitInterim('the hijack is getting a great price'); });
    act(() => { instances[0].endNaturally(); });          // Chrome ends without finalizing
    act(() => { instances[instances.length - 1].emit('so his range is wide'); });
    act(() => { result.current.stop(); });

    const [segments] = onSessionEnd.mock.calls[0];
    expect(segments.map((s) => s.text)).toEqual([
      'the hijack is getting a great price',
      'so his range is wide',
    ]);
  });
});

describe('useSpeechCapture — an auto-end is not a deliberate stop', () => {
  it('REGRESSION: reports the silence ceiling as interrupted, with a reason', () => {
    const onSessionEnd = vi.fn();
    const { result } = renderHook(() => useSpeechCapture({ onSessionEnd, silenceMs: 1000 }));

    act(() => { result.current.start(); });
    act(() => { instances[0].emit('thinking about the sizing'); });
    act(() => { vi.advanceTimersByTime(3000); });

    expect(onSessionEnd).toHaveBeenCalledTimes(1);
    const [, meta] = onSessionEnd.mock.calls[0];
    expect(meta.interrupted).toBe(true);
    expect(meta.reason).toBe('silence');
  });

  it('REGRESSION: reports the length ceiling as interrupted, with a reason', () => {
    const onSessionEnd = vi.fn();
    const { result } = renderHook(() =>
      useSpeechCapture({ onSessionEnd, maxMs: 2000, silenceMs: 60000 }),
    );

    act(() => { result.current.start(); });
    act(() => { instances[0].emit('long breakdown'); });
    act(() => { vi.advanceTimersByTime(3000); });

    const [, meta] = onSessionEnd.mock.calls[0];
    expect(meta.interrupted).toBe(true);
    expect(meta.reason).toBe('max-duration');
  });

  it('reports a deliberate stop as NOT interrupted', () => {
    const onSessionEnd = vi.fn();
    const { result } = renderHook(() => useSpeechCapture({ onSessionEnd }));

    act(() => { result.current.start(); });
    act(() => { instances[0].emit('done'); });
    act(() => { result.current.stop(); });

    const [, meta] = onSessionEnd.mock.calls[0];
    expect(meta.interrupted).toBe(false);
    expect(meta.reason).toBe('stopped');
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
