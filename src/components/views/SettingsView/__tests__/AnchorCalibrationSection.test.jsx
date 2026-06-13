// @vitest-environment jsdom
/**
 * @file Tests for AnchorCalibrationSection — Settings enrollment toggle.
 * Per WS-222 / SPR-124. Mirrors PrivacySection.test.jsx + adds the AP-06
 * DOM assertion (graded-work refusal) since this copy lives under
 * calibrationCopy.js FORBIDDEN_PATTERNS enforcement.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AnchorCalibrationSection } from '../AnchorCalibrationSection';
import { SETTINGS_ACTIONS } from '../../../../constants/settingsConstants';
import { FORBIDDEN_PATTERNS } from '../../../../utils/anchorLibrary/calibrationCopy';

afterEach(() => cleanup());

const baseSettings = (observationEnrollment = 'not-enrolled') => ({
  anchorCalibration: { observationEnrollment },
});

describe('AnchorCalibrationSection — render', () => {
  it('renders not-enrolled by default', () => {
    render(<AnchorCalibrationSection settings={baseSettings()} dispatchSettings={() => {}} />);
    expect(screen.getByTestId('settings-anchor-calibration-section')).toBeDefined();
    expect(screen.getByTestId('settings-anchor-calibration-enroll-on').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('settings-anchor-calibration-enroll-off').getAttribute('aria-pressed')).toBe('true');
  });

  it('marks Enrolled aria-pressed=true when enrolled', () => {
    render(<AnchorCalibrationSection settings={baseSettings('enrolled')} dispatchSettings={() => {}} />);
    expect(screen.getByTestId('settings-anchor-calibration-enroll-on').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('settings-anchor-calibration-enroll-off').getAttribute('aria-pressed')).toBe('false');
  });

  it('handles missing settings.anchorCalibration gracefully (renders not-enrolled)', () => {
    render(<AnchorCalibrationSection settings={{}} dispatchSettings={() => {}} />);
    expect(screen.getByTestId('settings-anchor-calibration-enroll-off').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('AnchorCalibrationSection — dispatch (single write path)', () => {
  it('clicking Enrolled dispatches SET_ANCHOR_CALIBRATION_ENROLLMENT with enrolled', () => {
    const dispatch = vi.fn();
    render(<AnchorCalibrationSection settings={baseSettings()} dispatchSettings={dispatch} />);
    fireEvent.click(screen.getByTestId('settings-anchor-calibration-enroll-on'));
    expect(dispatch).toHaveBeenCalledWith({
      type: SETTINGS_ACTIONS.SET_ANCHOR_CALIBRATION_ENROLLMENT,
      payload: { enrollmentState: 'enrolled' },
    });
  });

  it('clicking Not enrolled dispatches SET_ANCHOR_CALIBRATION_ENROLLMENT with not-enrolled', () => {
    const dispatch = vi.fn();
    render(<AnchorCalibrationSection settings={baseSettings('enrolled')} dispatchSettings={dispatch} />);
    fireEvent.click(screen.getByTestId('settings-anchor-calibration-enroll-off'));
    expect(dispatch).toHaveBeenCalledWith({
      type: SETTINGS_ACTIONS.SET_ANCHOR_CALIBRATION_ENROLLMENT,
      payload: { enrollmentState: 'not-enrolled' },
    });
  });
});

describe('AnchorCalibrationSection — AP-06 DOM-assertion (graded-work refusal)', () => {
  it('rendered textContent contains no FORBIDDEN_PATTERNS strings', () => {
    render(<AnchorCalibrationSection settings={baseSettings()} dispatchSettings={() => {}} />);
    const text = screen.getByTestId('settings-anchor-calibration-section').textContent || '';
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
  });
});
