/**
 * useVoiceCardEntry.test.js — hook lifecycle tests
 *
 * Covers:
 *   - Web Speech detection (supported / unsupported).
 *   - 300ms hold threshold (E-3): below threshold = no recognition.
 *   - R6 strict no-op: blank transcript, low confidence, short duration → result=null.
 *   - Permission status: 'denied' suppresses startHold.
 *   - Error path: 'not-allowed' → permissionStatus='denied'.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVoiceCardEntry, _VCE_INTERNAL } from '../useVoiceCardEntry';

// ─── Web Speech mock ────────────────────────────────────────────────────────

class MockSpeechRecognition {
  constructor() {
    this.continuous = false;
    this.interimResults = false;
    this.maxAlternatives = 1;
    this.lang = '';
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this._started = false;
  }
  start() {
    this._started = true;
    MockSpeechRecognition._lastInstance = this;
  }
  stop() {
    this._started = false;
  }
  // Test helpers (not part of real Web Speech API)
  __fireResult(transcript, confidence) {
    if (this.onresult) {
      this.onresult({
        results: [[{ transcript, confidence }]],
      });
    }
  }
  __fireError(code) {
    if (this.onerror) this.onerror({ error: code });
  }
  __fireEnd() {
    if (this.onend) this.onend();
  }
}

function installWebSpeechMock() {
  globalThis.window.SpeechRecognition = MockSpeechRecognition;
}
function removeWebSpeechMock() {
  delete globalThis.window.SpeechRecognition;
  delete globalThis.window.webkitSpeechRecognition;
}

// Permission mock
function installPermissionMock(state = 'granted') {
  globalThis.navigator.permissions = {
    query: vi.fn(async () => ({
      state,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  };
}
function removePermissionMock() {
  delete globalThis.navigator.permissions;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVoiceCardEntry — environment detection', () => {
  beforeEach(() => {
    removeWebSpeechMock();
  });

  it('reports supported=false when neither SpeechRecognition nor webkit alias is present', () => {
    const { result } = renderHook(() => useVoiceCardEntry());
    expect(result.current.supported).toBe(false);
  });

  it('reports supported=true when SpeechRecognition is defined', () => {
    installWebSpeechMock();
    const { result } = renderHook(() => useVoiceCardEntry());
    expect(result.current.supported).toBe(true);
  });

  it('reports supported=true via webkitSpeechRecognition alias', () => {
    globalThis.window.webkitSpeechRecognition = MockSpeechRecognition;
    const { result } = renderHook(() => useVoiceCardEntry());
    expect(result.current.supported).toBe(true);
    delete globalThis.window.webkitSpeechRecognition;
  });
});

describe('useVoiceCardEntry — hold-threshold (E-3 300ms)', () => {
  beforeEach(() => {
    installWebSpeechMock();
    installPermissionMock('granted');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeWebSpeechMock();
    removePermissionMock();
  });

  it('does not start recognition when release happens before 300ms', () => {
    const { result } = renderHook(() => useVoiceCardEntry());

    act(() => result.current.startHold());
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.release());
    // recognition never started → no listening state
    expect(result.current.isListening).toBe(false);
    expect(result.current.result).toBe(null);
    expect(MockSpeechRecognition._lastInstance?._started).not.toBe(true);
  });

  it('starts recognition after exactly 300ms hold', () => {
    const { result } = renderHook(() => useVoiceCardEntry());

    act(() => result.current.startHold());
    act(() => vi.advanceTimersByTime(_VCE_INTERNAL.HOLD_THRESHOLD_MS));
    expect(result.current.isListening).toBe(true);
    expect(MockSpeechRecognition._lastInstance._started).toBe(true);
  });
});

describe('useVoiceCardEntry — release + parse flow (R6 gate)', () => {
  beforeEach(() => {
    installWebSpeechMock();
    installPermissionMock('granted');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeWebSpeechMock();
    removePermissionMock();
  });

  function startAndSpeak(result, transcript, confidence, durationMs = 2000) {
    act(() => result.current.startHold());
    act(() => vi.advanceTimersByTime(_VCE_INTERNAL.HOLD_THRESHOLD_MS));
    act(() => MockSpeechRecognition._lastInstance.__fireResult(transcript, confidence));
    act(() => vi.advanceTimersByTime(durationMs));
    act(() => result.current.release());
    act(() => MockSpeechRecognition._lastInstance.__fireEnd());
  }

  it('parses a valid utterance to a cards payload', () => {
    const { result } = renderHook(() => useVoiceCardEntry({ confidenceThreshold: 0.5 }));
    startAndSpeak(result, 'ace of hearts jack of spades', 0.9, 1500);
    expect(result.current.result).not.toBe(null);
    expect(result.current.result.cards).toEqual(['A♥', 'J♠']);
  });

  it('returns result=null on blank transcript (R6 gate)', () => {
    const { result } = renderHook(() => useVoiceCardEntry({ confidenceThreshold: 0.5 }));
    startAndSpeak(result, '', 0.9, 1500);
    expect(result.current.result).toBe(null);
  });

  it('returns result=null on low confidence (R6 gate)', () => {
    const { result } = renderHook(() => useVoiceCardEntry({ confidenceThreshold: 0.9 }));
    startAndSpeak(result, 'ace of hearts', 0.5, 1500);
    expect(result.current.result).toBe(null);
  });

  it('returns result=null on short duration (R6 gate)', () => {
    const { result } = renderHook(() => useVoiceCardEntry({ confidenceThreshold: 0.5 }));
    startAndSpeak(result, 'ace of hearts', 0.9, 300);
    expect(result.current.result).toBe(null);
  });
});

describe('useVoiceCardEntry — permission denied path', () => {
  // NOTE: these tests use real timers because waitFor() polls real time;
  // mixing it with vi.useFakeTimers() deadlocks.
  beforeEach(() => {
    installWebSpeechMock();
  });

  afterEach(() => {
    removeWebSpeechMock();
    removePermissionMock();
  });

  it('startHold is a no-op when permissionStatus === "denied"', async () => {
    installPermissionMock('denied');
    const { result } = renderHook(() => useVoiceCardEntry());
    await waitFor(() => expect(result.current.permissionStatus).toBe('denied'));

    act(() => result.current.startHold());
    // Wait past the 300ms hold threshold in real time
    await new Promise((r) => setTimeout(r, _VCE_INTERNAL.HOLD_THRESHOLD_MS + 50));
    expect(result.current.isListening).toBe(false);
  });

  it('"not-allowed" error from recognition flips permissionStatus to denied', async () => {
    installPermissionMock('granted');
    const { result } = renderHook(() => useVoiceCardEntry());
    await waitFor(() => expect(result.current.permissionStatus).toBe('granted'));

    act(() => result.current.startHold());
    // Wait past the hold threshold so recognition starts
    await new Promise((r) => setTimeout(r, _VCE_INTERNAL.HOLD_THRESHOLD_MS + 50));
    expect(MockSpeechRecognition._lastInstance._started).toBe(true);

    act(() => MockSpeechRecognition._lastInstance.__fireError('not-allowed'));

    expect(result.current.error).toBe('not-allowed');
    expect(result.current.permissionStatus).toBe('denied');
  });
});

describe('useVoiceCardEntry — reset', () => {
  beforeEach(() => {
    installWebSpeechMock();
    installPermissionMock('granted');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeWebSpeechMock();
    removePermissionMock();
  });

  it('reset() clears result and error', () => {
    const { result } = renderHook(() => useVoiceCardEntry({ confidenceThreshold: 0.5 }));

    act(() => result.current.startHold());
    act(() => vi.advanceTimersByTime(_VCE_INTERNAL.HOLD_THRESHOLD_MS));
    act(() => MockSpeechRecognition._lastInstance.__fireResult('ace of hearts', 0.9));
    act(() => vi.advanceTimersByTime(1500));
    act(() => result.current.release());
    act(() => MockSpeechRecognition._lastInstance.__fireEnd());

    expect(result.current.result).not.toBe(null);

    act(() => result.current.reset());
    expect(result.current.result).toBe(null);
    expect(result.current.error).toBe(null);
  });
});
