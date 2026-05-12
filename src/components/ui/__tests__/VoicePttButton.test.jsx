/**
 * VoicePttButton.test.jsx — PTT widget tests
 *
 * Covers:
 *   - Renders with proper accessible label + scope label ("BOARD", "V3", etc.).
 *   - Idle / listening visual state via data-state.
 *   - Disabled state when supported=false OR permissionStatus='denied'.
 *   - PointerDown → onHoldStart fires; PointerUp → onHoldEnd fires (hold mode).
 *   - Click → onTapToggle fires (tap mode).
 *   - 56×56 DOM-px sizing (Gate 2 E-7 binding).
 *   - Inline "Listening…" label flips from scopeLabel during recording.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VoicePttButton from '../VoicePttButton';

function press(el, x = 0, y = 0) {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
}
function release(el, x = 0, y = 0) {
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
}

describe('VoicePttButton — rendering', () => {
  it('renders with default BOARD scope label', () => {
    render(
      <VoicePttButton
        supported
        permissionStatus="granted"
        isListening={false}
        onHoldStart={() => {}}
        onHoldEnd={() => {}}
      />,
    );
    const btn = screen.getByTestId('voice-ptt-button');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('data-scope-label')).toBe('BOARD');
    expect(btn.getAttribute('aria-label')).toMatch(/board/i);
    expect(btn.getAttribute('data-state')).toBe('idle');
  });

  it('renders per-villain scope label', () => {
    render(
      <VoicePttButton
        supported
        permissionStatus="granted"
        isListening={false}
        scopeLabel="V5"
        onHoldStart={() => {}}
        onHoldEnd={() => {}}
      />,
    );
    const btn = screen.getByTestId('voice-ptt-button');
    expect(btn.getAttribute('data-scope-label')).toBe('V5');
  });

  it('renders 56×56 DOM-px (E-7)', () => {
    render(
      <VoicePttButton
        supported
        permissionStatus="granted"
        isListening={false}
        onHoldStart={() => {}}
        onHoldEnd={() => {}}
      />,
    );
    const btn = screen.getByTestId('voice-ptt-button');
    expect(btn.style.width).toBe('56px');
    expect(btn.style.height).toBe('56px');
  });

  it('inline label shows scopeLabel idle, "Listening…" active', () => {
    const { rerender } = render(
      <VoicePttButton
        supported
        permissionStatus="granted"
        isListening={false}
        scopeLabel="BOARD"
        onHoldStart={() => {}}
        onHoldEnd={() => {}}
      />,
    );
    expect(screen.getByTestId('voice-ptt-button-label').textContent).toBe('BOARD');
    rerender(
      <VoicePttButton
        supported
        permissionStatus="granted"
        isListening
        scopeLabel="BOARD"
        onHoldStart={() => {}}
        onHoldEnd={() => {}}
      />,
    );
    expect(screen.getByTestId('voice-ptt-button-label').textContent).toBe('Listening…');
  });
});

describe('VoicePttButton — visual state', () => {
  it('data-state="listening" when isListening=true', () => {
    render(
      <VoicePttButton
        supported
        permissionStatus="granted"
        isListening
        onHoldStart={() => {}}
        onHoldEnd={() => {}}
      />,
    );
    expect(screen.getByTestId('voice-ptt-button').getAttribute('data-state')).toBe('listening');
  });

  it('data-state="denied" when permissionStatus="denied"', () => {
    render(
      <VoicePttButton
        supported
        permissionStatus="denied"
        isListening={false}
        onHoldStart={() => {}}
        onHoldEnd={() => {}}
      />,
    );
    expect(screen.getByTestId('voice-ptt-button').getAttribute('data-state')).toBe('denied');
  });

  it('data-state="unsupported" when supported=false', () => {
    render(
      <VoicePttButton
        supported={false}
        permissionStatus="granted"
        isListening={false}
        onHoldStart={() => {}}
        onHoldEnd={() => {}}
      />,
    );
    expect(screen.getByTestId('voice-ptt-button').getAttribute('data-state')).toBe('unsupported');
  });
});

describe('VoicePttButton — hold mode interaction', () => {
  it('pointerdown fires onHoldStart, pointerup fires onHoldEnd', () => {
    const onHoldStart = vi.fn();
    const onHoldEnd = vi.fn();
    render(
      <VoicePttButton
        supported
        permissionStatus="granted"
        isListening={false}
        activationMode="hold"
        onHoldStart={onHoldStart}
        onHoldEnd={onHoldEnd}
      />,
    );
    const btn = screen.getByTestId('voice-ptt-button');
    press(btn);
    expect(onHoldStart).toHaveBeenCalledTimes(1);
    release(btn);
    expect(onHoldEnd).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire callbacks when supported=false', () => {
    const onHoldStart = vi.fn();
    const onHoldEnd = vi.fn();
    render(
      <VoicePttButton
        supported={false}
        permissionStatus="granted"
        isListening={false}
        activationMode="hold"
        onHoldStart={onHoldStart}
        onHoldEnd={onHoldEnd}
      />,
    );
    const btn = screen.getByTestId('voice-ptt-button');
    press(btn);
    release(btn);
    expect(onHoldStart).not.toHaveBeenCalled();
    expect(onHoldEnd).not.toHaveBeenCalled();
  });

  it('pointercancel also fires onHoldEnd', () => {
    const onHoldEnd = vi.fn();
    render(
      <VoicePttButton
        supported
        permissionStatus="granted"
        isListening
        activationMode="hold"
        onHoldStart={() => {}}
        onHoldEnd={onHoldEnd}
      />,
    );
    const btn = screen.getByTestId('voice-ptt-button');
    press(btn);
    btn.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
    expect(onHoldEnd).toHaveBeenCalledTimes(1);
  });
});

describe('VoicePttButton — tap mode interaction', () => {
  it('click fires onTapToggle (hold callbacks suppressed in tap mode)', () => {
    const onTapToggle = vi.fn();
    const onHoldStart = vi.fn();
    const onHoldEnd = vi.fn();
    render(
      <VoicePttButton
        supported
        permissionStatus="granted"
        isListening={false}
        activationMode="tap"
        onTapToggle={onTapToggle}
        onHoldStart={onHoldStart}
        onHoldEnd={onHoldEnd}
      />,
    );
    const btn = screen.getByTestId('voice-ptt-button');
    fireEvent.click(btn);
    expect(onTapToggle).toHaveBeenCalledTimes(1);
    // Pointer events do NOT trigger hold callbacks in tap mode
    press(btn);
    release(btn);
    expect(onHoldStart).not.toHaveBeenCalled();
    expect(onHoldEnd).not.toHaveBeenCalled();
  });

  it('tap mode aria-label changes when listening', () => {
    const { rerender } = render(
      <VoicePttButton
        supported
        permissionStatus="granted"
        isListening={false}
        activationMode="tap"
        scopeLabel="BOARD"
        onTapToggle={() => {}}
      />,
    );
    expect(screen.getByTestId('voice-ptt-button').getAttribute('aria-label')).toMatch(/tap to speak/i);
    rerender(
      <VoicePttButton
        supported
        permissionStatus="granted"
        isListening
        activationMode="tap"
        scopeLabel="BOARD"
        onTapToggle={() => {}}
      />,
    );
    expect(screen.getByTestId('voice-ptt-button').getAttribute('aria-label')).toMatch(/tap to stop/i);
  });
});
