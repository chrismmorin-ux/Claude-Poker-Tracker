/**
 * VoiceNarrationSection.test.jsx — VRN capture control.
 *
 * THE REGRESSION THIS FILE EXISTS FOR (reported from live use 2026-08-01):
 * recording "turns on and then off very quickly, even when I don't move my
 * pressed finger", producing only fragments.
 *
 * Cause: the control rendered a SEPARATE Stop button once recording began. That
 * button mounted in the same position under the still-pressed finger, so the
 * pointerup ending the starting hold dispatched a click straight onto it and
 * stopped the session on finger-lift.
 *
 * Fix: one button across both states, plus suppression of the click that
 * completes the starting hold. The tests below pin both halves — a hold must
 * survive its own release.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VoiceNarrationSection } from '../VoiceNarrationSection';

// Hoisted so the module factory can reach them.
const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  removeNote: vi.fn(),
  isRecording: false,
}));

vi.mock('../../../hooks/useVoiceReasoningNote', () => ({
  useVoiceReasoningNote: () => ({
    supported: true,
    permissionStatus: 'granted',
    isRecording: mocks.isRecording,
    segmentCount: 0,
    error: null,
    isSaving: false,
    notes: [],
    start: mocks.start,
    stop: mocks.stop,
    removeNote: mocks.removeNote,
  }),
}));

const HOLD_MS = 400;

const setup = (props = {}) =>
  render(
    <VoiceNarrationSection
      handId={1}
      buildContext={() => ({ street: 'flop' })}
      source="replay"
      enabled
      {...props}
    />,
  );

// The browser fires pointerdown -> pointerup -> click. Reproducing all three is
// the whole point: the bug lived in the click that follows the release.
const holdThenRelease = (btn, holdMs) => {
  fireEvent.pointerDown(btn);
  act(() => { vi.advanceTimersByTime(holdMs); });
  fireEvent.pointerUp(btn);
  fireEvent.click(btn);
};

beforeEach(() => {
  vi.useFakeTimers();
  mocks.start.mockClear();
  mocks.stop.mockClear();
  mocks.isRecording = false;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('VoiceNarrationSection — hold to start', () => {
  it('starts recording once the hold threshold passes', () => {
    setup();
    const btn = screen.getByTestId('vrn-start-button');
    fireEvent.pointerDown(btn);
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    expect(mocks.start).toHaveBeenCalledTimes(1);
  });

  it('does NOT start on a short tap — an accidental press cannot open a hot mic', () => {
    setup();
    const btn = screen.getByTestId('vrn-start-button');
    holdThenRelease(btn, HOLD_MS - 100);
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('does not start when the pointer leaves before the threshold', () => {
    setup();
    const btn = screen.getByTestId('vrn-start-button');
    fireEvent.pointerDown(btn);
    act(() => { vi.advanceTimersByTime(HOLD_MS - 100); });
    fireEvent.pointerLeave(btn);
    act(() => { vi.advanceTimersByTime(500); });
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('does not stop on a bare click while idle', () => {
    setup();
    fireEvent.click(screen.getByTestId('vrn-start-button'));
    expect(mocks.stop).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });
});

describe('VoiceNarrationSection — the release must not end the session', () => {
  it('REGRESSION: releasing the starting hold does not stop recording', () => {
    const { rerender } = setup();
    const btn = screen.getByTestId('vrn-start-button');

    fireEvent.pointerDown(btn);
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    expect(mocks.start).toHaveBeenCalledTimes(1);

    // Recording is now live; the control re-renders in its recording state while
    // the finger is still down — exactly the moment the old build broke.
    mocks.isRecording = true;
    rerender(
      <VoiceNarrationSection handId={1} buildContext={() => ({})} source="replay" enabled />,
    );

    fireEvent.pointerUp(screen.getByTestId('vrn-stop-button'));
    fireEvent.click(screen.getByTestId('vrn-stop-button'));

    expect(mocks.stop).not.toHaveBeenCalled();
  });

  it('a LATER deliberate tap does stop recording', () => {
    const { rerender } = setup();
    const btn = screen.getByTestId('vrn-start-button');

    fireEvent.pointerDown(btn);
    act(() => { vi.advanceTimersByTime(HOLD_MS); });

    mocks.isRecording = true;
    rerender(
      <VoiceNarrationSection handId={1} buildContext={() => ({})} source="replay" enabled />,
    );

    // The release that started it — absorbed.
    fireEvent.pointerUp(screen.getByTestId('vrn-stop-button'));
    fireEvent.click(screen.getByTestId('vrn-stop-button'));
    expect(mocks.stop).not.toHaveBeenCalled();

    // A separate, later tap — honoured.
    fireEvent.click(screen.getByTestId('vrn-stop-button'));
    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });

  it('STALE-FLAG REGRESSION: a missed release-click must not swallow the next Stop tap', () => {
    // Found in browser verification 2026-08-01. A one-shot boolean armed at
    // start is consumed by whatever click arrives next. If the release-click
    // never reaches the button — finger drifted off, pointer-capture quirk — the
    // flag stays armed and eats the founder's next genuine Stop tap, so the
    // first press of Stop appears to do nothing.
    const { rerender } = setup();
    const btn = screen.getByTestId('vrn-start-button');

    fireEvent.pointerDown(btn);
    act(() => { vi.advanceTimersByTime(HOLD_MS); });

    mocks.isRecording = true;
    rerender(
      <VoiceNarrationSection handId={1} buildContext={() => ({})} source="replay" enabled />,
    );

    // Release happens, but its click lands somewhere other than the button.
    fireEvent.pointerUp(screen.getByTestId('vrn-stop-button'));

    // Suppression window lapses without ever being consumed.
    act(() => { vi.advanceTimersByTime(1000); });

    // The founder's first deliberate Stop tap must work.
    fireEvent.click(screen.getByTestId('vrn-stop-button'));
    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });

  it('absorbs the release-click regardless of how long the hold lasted', () => {
    // The suppression window is anchored to the release, not to start, so a long
    // deliberate hold still hands off cleanly.
    const { rerender } = setup();
    const btn = screen.getByTestId('vrn-start-button');

    fireEvent.pointerDown(btn);
    act(() => { vi.advanceTimersByTime(HOLD_MS); });

    mocks.isRecording = true;
    rerender(
      <VoiceNarrationSection handId={1} buildContext={() => ({})} source="replay" enabled />,
    );

    act(() => { vi.advanceTimersByTime(6000); });   // finger held for 6 more seconds

    fireEvent.pointerUp(screen.getByTestId('vrn-stop-button'));
    fireEvent.click(screen.getByTestId('vrn-stop-button'));
    expect(mocks.stop).not.toHaveBeenCalled();
  });

  it('uses one button element across both states rather than swapping controls', () => {
    const { rerender } = setup();
    const idle = screen.getByTestId('vrn-start-button');

    mocks.isRecording = true;
    rerender(
      <VoiceNarrationSection handId={1} buildContext={() => ({})} source="replay" enabled />,
    );

    // Same DOM node, relabelled — not a fresh element mounted under the finger.
    const recording = screen.getByTestId('vrn-stop-button');
    expect(recording).toBe(idle);
    expect(screen.queryByTestId('vrn-start-button')).toBeNull();
  });
});

describe('VoiceNarrationSection — gating', () => {
  it('renders nothing when the flag is off', () => {
    setup({ enabled: false });
    expect(screen.queryByTestId('voice-narration-section')).toBeNull();
  });

  it('renders nothing without a hand to attach to', () => {
    setup({ handId: null });
    expect(screen.queryByTestId('voice-narration-section')).toBeNull();
  });
});
