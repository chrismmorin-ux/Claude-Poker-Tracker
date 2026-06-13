// @vitest-environment jsdom
/**
 * @file Tests for AnchorCalibrationResetSection — Settings global library-reset
 * danger zone (WS-221 / SPR-126, red line #4b).
 *
 * Container component: mocks the two context hooks (useAnchorLibrary / useToast)
 * but runs the real useLibraryReset orchestrator + real RetirementConfirmModal,
 * so the begin → 2-tap confirm → dispatch path is exercised end-to-end.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AnchorCalibrationResetSection } from '../AnchorCalibrationResetSection';
import { ANCHOR_LIBRARY_ACTIONS } from '../../../../constants/anchorLibraryConstants';
import { FORBIDDEN_PATTERNS } from '../../../../utils/anchorLibrary/retirementCopy';

// ─── Context mocks ──────────────────────────────────────────────────────────
const mockAnchorLibrary = vi.fn();
const mockToast = vi.fn();

vi.mock('../../../../contexts/AnchorLibraryContext', () => ({
  useAnchorLibrary: () => mockAnchorLibrary(),
}));
vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: () => mockToast(),
}));

const buildAnchors = (n) => {
  const dict = {};
  for (let i = 0; i < n; i += 1) {
    dict[`anchor:${i}`] = { id: `anchor:${i}`, archetypeName: `Anchor ${i}`, status: 'active', operator: {} };
  }
  return dict;
};

const setupLibrary = ({ anchorCount = 2, isReady = true, dispatch = vi.fn() } = {}) => {
  const anchors = buildAnchors(anchorCount);
  mockAnchorLibrary.mockReturnValue({
    anchors,
    selectAllAnchors: () => Object.values(anchors),
    dispatchAnchorLibrary: dispatch,
    isReady,
  });
  return dispatch;
};

const buildToastDouble = () => ({
  addToast: vi.fn(),
  showInfo: vi.fn(),
  showError: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  mockToast.mockReturnValue(buildToastDouble());
});

afterEach(() => cleanup());

describe('AnchorCalibrationResetSection — render', () => {
  it('renders the danger-zone section + reset button + count hint', () => {
    setupLibrary({ anchorCount: 3 });
    render(<AnchorCalibrationResetSection />);
    expect(screen.getByTestId('settings-anchor-calibration-reset-section')).toBeInTheDocument();
    expect(screen.getByTestId('settings-anchor-calibration-reset-button')).toBeInTheDocument();
    expect(screen.getByTestId('settings-anchor-calibration-reset-count').textContent).toBe('3 anchors');
  });

  it('singular count hint reads "1 anchor"', () => {
    setupLibrary({ anchorCount: 1 });
    render(<AnchorCalibrationResetSection />);
    expect(screen.getByTestId('settings-anchor-calibration-reset-count').textContent).toBe('1 anchor');
  });
});

describe('AnchorCalibrationResetSection — disabled states', () => {
  it('disables the button when the library is empty', () => {
    setupLibrary({ anchorCount: 0 });
    render(<AnchorCalibrationResetSection />);
    expect(screen.getByTestId('settings-anchor-calibration-reset-button')).toBeDisabled();
  });

  it('disables the button until the library has hydrated (!isReady)', () => {
    setupLibrary({ anchorCount: 3, isReady: false });
    render(<AnchorCalibrationResetSection />);
    expect(screen.getByTestId('settings-anchor-calibration-reset-button')).toBeDisabled();
  });

  it('enables the button when ready and anchors exist', () => {
    setupLibrary({ anchorCount: 2 });
    render(<AnchorCalibrationResetSection />);
    expect(screen.getByTestId('settings-anchor-calibration-reset-button')).not.toBeDisabled();
  });
});

describe('AnchorCalibrationResetSection — confirm flow', () => {
  it('clicking the button opens the 2-tap destructive confirm modal', () => {
    setupLibrary({ anchorCount: 2 });
    render(<AnchorCalibrationResetSection />);
    fireEvent.click(screen.getByTestId('settings-anchor-calibration-reset-button'));
    const modal = screen.getByTestId('retirement-modal');
    expect(modal).toBeInTheDocument();
    expect(modal.getAttribute('data-destructive')).toBe('true');
    // Confirm is gated until the checkbox is ticked.
    expect(screen.getByTestId('retirement-modal-confirm').getAttribute('data-confirm-disabled')).toBe('true');
  });

  it('checking the box + confirming dispatches LIBRARY_CALIBRATION_RESET with a timestamp', () => {
    const dispatch = setupLibrary({ anchorCount: 2 });
    render(<AnchorCalibrationResetSection />);
    fireEvent.click(screen.getByTestId('settings-anchor-calibration-reset-button'));
    fireEvent.click(screen.getByTestId('retirement-modal-destructive-checkbox'));
    fireEvent.click(screen.getByTestId('retirement-modal-confirm'));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const call = dispatch.mock.calls[0][0];
    expect(call.type).toBe(ANCHOR_LIBRARY_ACTIONS.LIBRARY_CALIBRATION_RESET);
    expect(typeof call.payload.timestamp).toBe('string');
  });

  it('cancelling closes the modal without dispatching', () => {
    const dispatch = setupLibrary({ anchorCount: 2 });
    render(<AnchorCalibrationResetSection />);
    fireEvent.click(screen.getByTestId('settings-anchor-calibration-reset-button'));
    fireEvent.click(screen.getByTestId('retirement-modal-cancel'));
    expect(screen.queryByTestId('retirement-modal')).not.toBeInTheDocument();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('AnchorCalibrationResetSection — AP-06 (graded-work refusal)', () => {
  it('section copy contains no FORBIDDEN_PATTERNS strings', () => {
    setupLibrary({ anchorCount: 2 });
    render(<AnchorCalibrationResetSection />);
    const text = screen.getByTestId('settings-anchor-calibration-reset-section').textContent || '';
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(text, `forbidden pattern ${pattern} in section copy`).not.toMatch(pattern);
    }
  });

  it('the opened confirm modal copy is also AP-06-clean', () => {
    setupLibrary({ anchorCount: 2 });
    render(<AnchorCalibrationResetSection />);
    fireEvent.click(screen.getByTestId('settings-anchor-calibration-reset-button'));
    const text = screen.getByTestId('retirement-modal').textContent || '';
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(text, `forbidden pattern ${pattern} in modal copy`).not.toMatch(pattern);
    }
  });
});
