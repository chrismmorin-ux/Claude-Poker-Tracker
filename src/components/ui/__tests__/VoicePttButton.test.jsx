/**
 * VoicePttButton.test.jsx — PTT widget tests
 *
 * Covers:
 *   - Renders with proper accessible label.
 *   - Idle / listening visual state via data-state.
 *   - Disabled state when supported=false OR permissionStatus='denied'.
 *   - PointerDown → onHoldStart fires; PointerUp → onHoldEnd fires.
 *   - Disabled button does not fire callbacks.
 *   - 56×56 DOM-px sizing (Gate 2 E-7 binding).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import VoicePttButton from '../VoicePttButton';

function press(el, x = 0, y = 0) {
  el.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }),
  );
}
function release(el, x = 0, y = 0) {
  el.dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }),
  );
}

describe('VoicePttButton — rendering', () => {
  it('renders with default label and idle state', () => {
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
    expect(btn.getAttribute('aria-label')).toBe('Hold to speak board cards');
    expect(btn.getAttribute('data-state')).toBe('idle');
  });

  it('honors custom label and testId', () => {
    render(
      <VoicePttButton
        supported
        permissionStatus="granted"
        isListening={false}
        onHoldStart={() => {}}
        onHoldEnd={() => {}}
        label="custom"
        testId="custom-id"
      />,
    );
    const btn = screen.getByTestId('custom-id');
    expect(btn.getAttribute('aria-label')).toBe('custom');
  });

  it('renders 56×56 DOM-px (E-7 binding)', () => {
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

describe('VoicePttButton — interaction', () => {
  it('pointerdown fires onHoldStart, pointerup fires onHoldEnd', () => {
    const onHoldStart = vi.fn();
    const onHoldEnd = vi.fn();
    render(
      <VoicePttButton
        supported
        permissionStatus="granted"
        isListening={false}
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

  it('does NOT fire callbacks when permissionStatus="denied"', () => {
    const onHoldStart = vi.fn();
    const onHoldEnd = vi.fn();
    render(
      <VoicePttButton
        supported
        permissionStatus="denied"
        isListening={false}
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

  it('pointercancel also fires onHoldEnd (release path)', () => {
    const onHoldEnd = vi.fn();
    render(
      <VoicePttButton
        supported
        permissionStatus="granted"
        isListening
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
