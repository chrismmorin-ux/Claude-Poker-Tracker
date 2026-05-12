/**
 * useVoiceCardEntry.test.js — hook lifecycle tests
 *
 * Covers:
 *   - Web Speech detection (supported / unsupported).
 *   - LOW-LATENCY behavior: startHold begins recognition immediately;
 *     release before 300ms aborts (no parse); release after 300ms commits.
 *   - R6 strict no-op: blank transcript, low confidence, short duration → result=null.
 *   - Permission status: 'denied' suppresses startHold + tapToggle.
 *   - Tap-toggle mode: tap once starts; tap again stops + commits.
 *   - Reset clears result + error.
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
    this.onspeechstart = null;
    this.onspeechend = null;
    this._started = false;
  }
  start() {
    this._started = true;
    MockSpeechRecognition._lastInstance = this;
  }
  stop() {
    this._started = false;
  }
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

// Stub navigator.vibrate so the hook's haptic calls don't throw.
function installVibrateMock() {
  globalThis.navigator.vibrate = vi.fn();
}
function removeVibrateMock() {
  delete globalThis.navigator.vibrate;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVoiceCardEntry — environment detection', () => {
  beforeEach(() => {
    removeWebSpeechMock();
  });

  it('reports supported=false when Web Speech is unavailable', () => {
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

describe('useVoiceCardEntry — hold mode: low-latency activation', () => {
  beforeEach(() => {
    installWebSpeechMock();
    installPermissionMock('granted');
    installVibrateMock();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    removeWebSpeechMock();
    removePermissionMock();
    removeVibrateMock();
  });

  it('starts recognition IMMEDIATELY on startHold (not after 300ms)', () => {
    const { result } = renderHook(() => useVoiceCardEntry());
    act(() => result.current.startHold());
    // Recognition began on the same tick — isListening true before 300ms threshold.
    expect(result.current.isListening).toBe(true);
    expect(MockSpeechRecognition._lastInstance._started).toBe(true);
  });

  it('release BEFORE 300ms aborts: no result + no commit', () => {
    const { result } = renderHook(() => useVoiceCardEntry());
    act(() => result.current.startHold());
    expect(result.current.isListening).toBe(true);
    // Fire a result mid-hold (simulating early speech)
    act(() => MockSpeechRecognition._lastInstance.__fireResult('ace of hearts', 0.9));
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.release());
    act(() => MockSpeechRecognition._lastInstance.__fireEnd());
    // Even though valid speech was captured, sub-300ms release is treated as
    // an accidental press — strict no-op.
    expect(result.current.result).toBe(null);
  });

  it('release AFTER 300ms commits: result populated', () => {
    const { result } = renderHook(() => useVoiceCardEntry({ confidenceThreshold: 0.5 }));
    act(() => result.current.startHold());
    act(() => vi.advanceTimersByTime(_VCE_INTERNAL.HOLD_THRESHOLD_MS + 100));
    act(() => MockSpeechRecognition._lastInstance.__fireResult('ace of hearts jack of spades', 0.9));
    act(() => vi.advanceTimersByTime(1500));
    act(() => result.current.release());
    act(() => MockSpeechRecognition._lastInstance.__fireEnd());
    expect(result.current.result).not.toBe(null);
    expect(result.current.result.cards).toEqual(['A♥', 'J♠']);
  });
});

describe('useVoiceCardEntry — R6 strict no-op gate', () => {
  beforeEach(() => {
    installWebSpeechMock();
    installPermissionMock('granted');
    installVibrateMock();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    removeWebSpeechMock();
    removePermissionMock();
    removeVibrateMock();
  });

  function holdAndSpeak(result, transcript, confidence, durationMs) {
    act(() => result.current.startHold());
    act(() => vi.advanceTimersByTime(_VCE_INTERNAL.HOLD_THRESHOLD_MS + 50));
    act(() => MockSpeechRecognition._lastInstance.__fireResult(transcript, confidence));
    act(() => vi.advanceTimersByTime(durationMs));
    act(() => result.current.release());
    act(() => MockSpeechRecognition._lastInstance.__fireEnd());
  }

  it('blank transcript → null', () => {
    const { result } = renderHook(() => useVoiceCardEntry({ confidenceThreshold: 0.5 }));
    holdAndSpeak(result, '', 0.9, 1500);
    expect(result.current.result).toBe(null);
  });

  it('low confidence → null', () => {
    const { result } = renderHook(() => useVoiceCardEntry({ confidenceThreshold: 0.9 }));
    holdAndSpeak(result, 'ace of hearts', 0.5, 1500);
    expect(result.current.result).toBe(null);
  });

  it('short total duration → null', () => {
    const { result } = renderHook(() => useVoiceCardEntry({ confidenceThreshold: 0.5 }));
    // Total duration counted from startHold to release. We push past 300ms
    // to get past the hold gate, but the parser still gets a short duration
    // if we don't add time before release.
    act(() => result.current.startHold());
    act(() => vi.advanceTimersByTime(_VCE_INTERNAL.HOLD_THRESHOLD_MS + 50));
    act(() => MockSpeechRecognition._lastInstance.__fireResult('ace of hearts', 0.9));
    // Only +50ms duration after results → ~400ms total — still passes R6 (>= 500 needed).
    // To test the short-duration gate, we need < 500ms total.
    // Recompute: startHold → 350ms → release. Total duration 350ms < 500ms.
    act(() => result.current.release());
    act(() => MockSpeechRecognition._lastInstance.__fireEnd());
    // 350ms total < R6 500ms gate → null.
    expect(result.current.result).toBe(null);
  });
});

describe('useVoiceCardEntry — tap-toggle mode', () => {
  beforeEach(() => {
    installWebSpeechMock();
    installPermissionMock('granted');
    installVibrateMock();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    removeWebSpeechMock();
    removePermissionMock();
    removeVibrateMock();
  });

  it('first tap starts recognition', () => {
    const { result } = renderHook(() => useVoiceCardEntry({ activationMode: 'tap' }));
    act(() => result.current.tapToggle());
    expect(result.current.isListening).toBe(true);
    expect(MockSpeechRecognition._lastInstance._started).toBe(true);
  });

  it('second tap stops + commits', () => {
    const { result } = renderHook(() => useVoiceCardEntry({ activationMode: 'tap', confidenceThreshold: 0.5 }));
    act(() => result.current.tapToggle());
    act(() => MockSpeechRecognition._lastInstance.__fireResult('ace of hearts', 0.9));
    act(() => vi.advanceTimersByTime(1500));
    act(() => result.current.tapToggle()); // stop
    act(() => MockSpeechRecognition._lastInstance.__fireEnd());
    expect(result.current.result).not.toBe(null);
    expect(result.current.result.cards).toEqual(['A♥']);
  });

  it('startHold is a no-op in tap mode', () => {
    const { result } = renderHook(() => useVoiceCardEntry({ activationMode: 'tap' }));
    act(() => result.current.startHold());
    expect(result.current.isListening).toBe(false);
  });

  it('tapToggle is a no-op in hold mode', () => {
    const { result } = renderHook(() => useVoiceCardEntry({ activationMode: 'hold' }));
    act(() => result.current.tapToggle());
    expect(result.current.isListening).toBe(false);
  });
});

describe('useVoiceCardEntry — permission denied path', () => {
  beforeEach(() => {
    installWebSpeechMock();
    installVibrateMock();
  });
  afterEach(() => {
    removeWebSpeechMock();
    removePermissionMock();
    removeVibrateMock();
  });

  it('startHold is a no-op when permissionStatus === "denied"', async () => {
    installPermissionMock('denied');
    const { result } = renderHook(() => useVoiceCardEntry());
    await waitFor(() => expect(result.current.permissionStatus).toBe('denied'));
    act(() => result.current.startHold());
    await new Promise((r) => setTimeout(r, _VCE_INTERNAL.HOLD_THRESHOLD_MS + 50));
    expect(result.current.isListening).toBe(false);
  });

  it('"not-allowed" error flips permissionStatus to denied', async () => {
    installPermissionMock('granted');
    const { result } = renderHook(() => useVoiceCardEntry());
    await waitFor(() => expect(result.current.permissionStatus).toBe('granted'));
    act(() => result.current.startHold());
    act(() => MockSpeechRecognition._lastInstance.__fireError('not-allowed'));
    expect(result.current.error).toBe('not-allowed');
    expect(result.current.permissionStatus).toBe('denied');
  });
});

describe('useVoiceCardEntry — reset', () => {
  beforeEach(() => {
    installWebSpeechMock();
    installPermissionMock('granted');
    installVibrateMock();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    removeWebSpeechMock();
    removePermissionMock();
    removeVibrateMock();
  });

  it('reset() clears result and error', () => {
    const { result } = renderHook(() => useVoiceCardEntry({ confidenceThreshold: 0.5 }));
    act(() => result.current.startHold());
    act(() => vi.advanceTimersByTime(_VCE_INTERNAL.HOLD_THRESHOLD_MS + 50));
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

describe('useVoiceCardEntry — haptic vibration on transitions', () => {
  let vibrateSpy;
  beforeEach(() => {
    installWebSpeechMock();
    installPermissionMock('granted');
    vibrateSpy = vi.fn();
    globalThis.navigator.vibrate = vibrateSpy;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    removeWebSpeechMock();
    removePermissionMock();
    delete globalThis.navigator.vibrate;
  });

  it('vibrates on recognition start (activate envelope)', () => {
    const { result } = renderHook(() => useVoiceCardEntry());
    act(() => result.current.startHold());
    expect(vibrateSpy).toHaveBeenCalledWith(_VCE_INTERNAL.HAPTIC_ACTIVATE);
  });

  it('vibrates on recognition end (deactivate envelope)', () => {
    const { result } = renderHook(() => useVoiceCardEntry({ confidenceThreshold: 0.5 }));
    vibrateSpy.mockClear();
    act(() => result.current.startHold());
    act(() => vi.advanceTimersByTime(_VCE_INTERNAL.HOLD_THRESHOLD_MS + 50));
    act(() => MockSpeechRecognition._lastInstance.__fireResult('ace of hearts', 0.9));
    act(() => vi.advanceTimersByTime(1500));
    act(() => result.current.release());
    act(() => MockSpeechRecognition._lastInstance.__fireEnd());
    expect(vibrateSpy).toHaveBeenCalledWith(_VCE_INTERNAL.HAPTIC_DEACTIVATE);
  });

  it('vibrates on error (error envelope)', () => {
    const { result } = renderHook(() => useVoiceCardEntry());
    act(() => result.current.startHold());
    vibrateSpy.mockClear();
    act(() => MockSpeechRecognition._lastInstance.__fireError('not-allowed'));
    expect(vibrateSpy).toHaveBeenCalledWith(_VCE_INTERNAL.HAPTIC_ERROR);
  });
});
