// @vitest-environment jsdom
/**
 * @file Tests for PrivacySection — Settings privacy toggle.
 * Per WS-165 / SPR-036.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PrivacySection } from '../PrivacySection';
import { SETTINGS_ACTIONS } from '../../../../constants/settingsConstants';

afterEach(() => cleanup());

const baseSettings = (override = {}) => ({
  privacy: { photoCaptureEnabled: false, ...override },
});

describe('PrivacySection — render', () => {
  it('renders with photoCaptureEnabled=false by default', () => {
    render(<PrivacySection settings={baseSettings()} dispatchSettings={() => {}} />);
    expect(screen.getByTestId('settings-privacy-section')).toBeDefined();
    expect(screen.getByTestId('settings-privacy-photo-capture-on').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('settings-privacy-photo-capture-off').getAttribute('aria-pressed')).toBe('true');
  });

  it('marks Enabled aria-pressed=true when on', () => {
    render(<PrivacySection settings={baseSettings({ photoCaptureEnabled: true })} dispatchSettings={() => {}} />);
    expect(screen.getByTestId('settings-privacy-photo-capture-on').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('settings-privacy-photo-capture-off').getAttribute('aria-pressed')).toBe('false');
  });

  it('handles missing settings.privacy gracefully (renders disabled)', () => {
    render(<PrivacySection settings={{}} dispatchSettings={() => {}} />);
    expect(screen.getByTestId('settings-privacy-photo-capture-off').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('PrivacySection — dispatch', () => {
  it('clicking Enabled dispatches SET_PRIVACY_PHOTO_CAPTURE_ENABLED with enabled=true', () => {
    const dispatch = vi.fn();
    render(<PrivacySection settings={baseSettings()} dispatchSettings={dispatch} />);
    fireEvent.click(screen.getByTestId('settings-privacy-photo-capture-on'));
    expect(dispatch).toHaveBeenCalledWith({
      type: SETTINGS_ACTIONS.SET_PRIVACY_PHOTO_CAPTURE_ENABLED,
      payload: { enabled: true },
    });
  });

  it('clicking Disabled dispatches SET_PRIVACY_PHOTO_CAPTURE_ENABLED with enabled=false', () => {
    const dispatch = vi.fn();
    render(<PrivacySection settings={baseSettings({ photoCaptureEnabled: true })} dispatchSettings={dispatch} />);
    fireEvent.click(screen.getByTestId('settings-privacy-photo-capture-off'));
    expect(dispatch).toHaveBeenCalledWith({
      type: SETTINGS_ACTIONS.SET_PRIVACY_PHOTO_CAPTURE_ENABLED,
      payload: { enabled: false },
    });
  });
});
