// @vitest-environment jsdom
/**
 * @file SettingsTab tests — owner-tier radio + signal toggle dispatch +
 * signal-weight slider snap-to-step.
 *
 * SPR-042 / WS-159 (2026-05-06).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

let mockDispatchSettings;
let mockSettings;

vi.mock('../../../../contexts', () => ({
  useSettings: () => ({
    settings: mockSettings,
    dispatchSettings: mockDispatchSettings,
  }),
}));

import { SettingsTab } from '../SettingsTab';

beforeEach(() => {
  mockDispatchSettings = vi.fn();
  mockSettings = {
    selfCoach: {
      signalToggles: { enableLeak: true, enableDrill: true, enableTest: true, enableRecent: true },
      signalWeights: { W_leak: 0.5, W_drill: 0.3, W_test: 0.15, W_recent: 0.05 },
      ownerTier: null,
    },
  };
});
afterEach(() => cleanup());

describe('SettingsTab — owner-tier radio', () => {
  it('renders 7 radio options (unset + 6 tier values)', () => {
    render(<SettingsTab />);
    expect(screen.getByTestId('self-coach-owner-tier-unset')).toBeDefined();
    expect(screen.getByTestId('self-coach-owner-tier-novice')).toBeDefined();
    expect(screen.getByTestId('self-coach-owner-tier-live-rec')).toBeDefined();
    expect(screen.getByTestId('self-coach-owner-tier-studied-amateur')).toBeDefined();
    expect(screen.getByTestId('self-coach-owner-tier-part-time-grinder')).toBeDefined();
    expect(screen.getByTestId('self-coach-owner-tier-serious-grinder')).toBeDefined();
    expect(screen.getByTestId('self-coach-owner-tier-pro')).toBeDefined();
  });

  it('selecting a tier dispatches SET_SELF_COACH_OWNER_TIER', () => {
    render(<SettingsTab />);
    const radio = screen.getByTestId('self-coach-owner-tier-studied-amateur').querySelector('input[type="radio"]');
    fireEvent.click(radio);
    expect(mockDispatchSettings).toHaveBeenCalledWith({
      type: 'SET_SELF_COACH_OWNER_TIER',
      payload: { tier: 'studied-amateur' },
    });
  });

  it('selecting (unset) dispatches null tier', () => {
    mockSettings.selfCoach.ownerTier = 'pro';
    render(<SettingsTab />);
    const radio = screen.getByTestId('self-coach-owner-tier-unset').querySelector('input[type="radio"]');
    fireEvent.click(radio);
    expect(mockDispatchSettings).toHaveBeenCalledWith({
      type: 'SET_SELF_COACH_OWNER_TIER',
      payload: { tier: null },
    });
  });

  it('current owner-tier renders as checked radio', () => {
    mockSettings.selfCoach.ownerTier = 'live-rec';
    render(<SettingsTab />);
    const liveRec = screen.getByTestId('self-coach-owner-tier-live-rec').querySelector('input[type="radio"]');
    expect(liveRec.checked).toBe(true);
  });
});

describe('SettingsTab — signal toggles', () => {
  it('renders 4 toggle controls', () => {
    render(<SettingsTab />);
    expect(screen.getByTestId('self-coach-signal-toggle-enableLeak')).toBeDefined();
    expect(screen.getByTestId('self-coach-signal-toggle-enableDrill')).toBeDefined();
    expect(screen.getByTestId('self-coach-signal-toggle-enableTest')).toBeDefined();
    expect(screen.getByTestId('self-coach-signal-toggle-enableRecent')).toBeDefined();
  });

  it('clicking Off on enableLeak dispatches SET_SELF_COACH_SIGNAL_TOGGLE with enabled:false', () => {
    render(<SettingsTab />);
    fireEvent.click(screen.getByTestId('self-coach-signal-toggle-enableLeak-off'));
    expect(mockDispatchSettings).toHaveBeenCalledWith({
      type: 'SET_SELF_COACH_SIGNAL_TOGGLE',
      payload: { name: 'enableLeak', enabled: false },
    });
  });

  it('clicking On on enableLeak dispatches enabled:true', () => {
    mockSettings.selfCoach.signalToggles.enableLeak = false;
    render(<SettingsTab />);
    fireEvent.click(screen.getByTestId('self-coach-signal-toggle-enableLeak-on'));
    expect(mockDispatchSettings).toHaveBeenCalledWith({
      type: 'SET_SELF_COACH_SIGNAL_TOGGLE',
      payload: { name: 'enableLeak', enabled: true },
    });
  });

  it('current toggle state reflects aria-pressed correctly', () => {
    mockSettings.selfCoach.signalToggles.enableTest = false;
    render(<SettingsTab />);
    const onBtn = screen.getByTestId('self-coach-signal-toggle-enableTest-on');
    const offBtn = screen.getByTestId('self-coach-signal-toggle-enableTest-off');
    expect(onBtn.getAttribute('aria-pressed')).toBe('false');
    expect(offBtn.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('SettingsTab — signal weight sliders', () => {
  it('renders 4 sliders with discrete step', () => {
    render(<SettingsTab />);
    const slider = screen.getByTestId('self-coach-signal-weight-W_leak-slider');
    expect(slider).toBeDefined();
    expect(slider.getAttribute('step')).toBe('0.1');
    expect(slider.getAttribute('min')).toBe('0');
    expect(slider.getAttribute('max')).toBe('1');
  });

  it('slider value reflects current weight', () => {
    render(<SettingsTab />);
    const slider = screen.getByTestId('self-coach-signal-weight-W_leak-slider');
    expect(Number(slider.value)).toBe(0.5);
  });

  it('changing slider dispatches SET_SELF_COACH_SIGNAL_WEIGHT with snapped value', () => {
    render(<SettingsTab />);
    const slider = screen.getByTestId('self-coach-signal-weight-W_leak-slider');
    fireEvent.change(slider, { target: { value: '0.7' } });
    expect(mockDispatchSettings).toHaveBeenCalledWith({
      type: 'SET_SELF_COACH_SIGNAL_WEIGHT',
      payload: { name: 'W_leak', weight: expect.any(Number) },
    });
    const call = mockDispatchSettings.mock.calls[0][0];
    expect(call.payload.weight).toBeCloseTo(0.7, 5);
  });

  it('snaps an off-step input value to 0.1 grid', () => {
    render(<SettingsTab />);
    const slider = screen.getByTestId('self-coach-signal-weight-W_drill-slider');
    fireEvent.change(slider, { target: { value: '0.43' } });
    const call = mockDispatchSettings.mock.calls[0][0];
    expect(call.payload.weight).toBeCloseTo(0.4, 5);
  });

  it('clamps over-1 input to max 1', () => {
    render(<SettingsTab />);
    const slider = screen.getByTestId('self-coach-signal-weight-W_test-slider');
    fireEvent.change(slider, { target: { value: '5.0' } });
    const call = mockDispatchSettings.mock.calls[0][0];
    expect(call.payload.weight).toBe(1);
  });

  it('clamps below-0 input to min 0', () => {
    render(<SettingsTab />);
    const slider = screen.getByTestId('self-coach-signal-weight-W_recent-slider');
    fireEvent.change(slider, { target: { value: '-0.3' } });
    const call = mockDispatchSettings.mock.calls[0][0];
    expect(call.payload.weight).toBe(0);
  });

  it('renders the current weight value next to each slider', () => {
    render(<SettingsTab />);
    expect(screen.getByTestId('self-coach-signal-weight-W_leak-value').textContent).toMatch(/0\.50/);
    expect(screen.getByTestId('self-coach-signal-weight-W_drill-value').textContent).toMatch(/0\.30/);
    expect(screen.getByTestId('self-coach-signal-weight-W_test-value').textContent).toMatch(/0\.15/);
    expect(screen.getByTestId('self-coach-signal-weight-W_recent-value').textContent).toMatch(/0\.05/);
  });
});
