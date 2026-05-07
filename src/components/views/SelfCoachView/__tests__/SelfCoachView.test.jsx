// @vitest-environment jsdom
/**
 * @file SelfCoachView shell tests — render, tab switching, back nav.
 *
 * SPR-042 / WS-159 (2026-05-06).
 */

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

let mockSetCurrentScreen;

vi.mock('../../../../contexts', () => ({
  useUI: () => ({
    setCurrentScreen: mockSetCurrentScreen,
    SCREEN: { TABLE: 'table' },
    openLessonDetail: vi.fn(),
  }),
  useSettings: () => ({
    settings: {
      selfCoach: {
        signalToggles: { enableLeak: true, enableDrill: true, enableTest: true, enableRecent: true },
        signalWeights: { W_leak: 0.5, W_drill: 0.3, W_test: 0.15, W_recent: 0.05 },
        ownerTier: null,
      },
    },
    dispatchSettings: vi.fn(),
  }),
}));

vi.mock('../../../../utils/skillAssessment/conceptMastery', () => ({
  listAllConceptMastery: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../../utils/skillAssessment/lessonRegistry', () => ({
  getLesson: vi.fn().mockReturnValue(null),
}));

import { SelfCoachView } from '../SelfCoachView';

beforeEach(() => {
  mockSetCurrentScreen = vi.fn();
});
afterEach(() => cleanup());

describe('SelfCoachView shell', () => {
  it('renders the view container with role=main', () => {
    render(<SelfCoachView scale={1} />);
    expect(screen.getByTestId('self-coach-view')).toBeDefined();
  });

  it('renders both tabs in the tab bar', () => {
    render(<SelfCoachView scale={1} />);
    expect(screen.getByTestId('self-coach-tab-curriculum')).toBeDefined();
    expect(screen.getByTestId('self-coach-tab-settings')).toBeDefined();
  });

  it('defaults to Curriculum tab', () => {
    render(<SelfCoachView scale={1} />);
    const curriculum = screen.getByTestId('self-coach-tab-curriculum');
    expect(curriculum.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('self-coach-curriculum-tab')).toBeDefined();
    expect(screen.queryByTestId('self-coach-settings-tab')).toBeNull();
  });

  it('switches to Settings tab on click', () => {
    render(<SelfCoachView scale={1} />);
    fireEvent.click(screen.getByTestId('self-coach-tab-settings'));
    const settings = screen.getByTestId('self-coach-tab-settings');
    expect(settings.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('self-coach-settings-tab')).toBeDefined();
    expect(screen.queryByTestId('self-coach-curriculum-tab')).toBeNull();
  });

  it('switches back to Curriculum tab', () => {
    render(<SelfCoachView scale={1} />);
    fireEvent.click(screen.getByTestId('self-coach-tab-settings'));
    fireEvent.click(screen.getByTestId('self-coach-tab-curriculum'));
    expect(screen.getByTestId('self-coach-curriculum-tab')).toBeDefined();
  });

  it('back button dispatches SCREEN.TABLE', () => {
    render(<SelfCoachView scale={1} />);
    fireEvent.click(screen.getByTestId('self-coach-back'));
    expect(mockSetCurrentScreen).toHaveBeenCalledWith('table');
  });
});
