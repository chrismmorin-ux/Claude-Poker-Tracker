// @vitest-environment jsdom
/**
 * @file ErrorLogPanel — reachability from the health pill.
 *
 * The panel sits 11 sections down a single long Settings scroll and starts
 * collapsed. "Tap to view" on the health pill routed to Settings and stopped
 * there, so the founder arrived with the errors still hidden and no indication
 * of where to look.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

let mockUi;
let mockErrors;

vi.mock('../../../../contexts', () => ({
  useUI: () => mockUi,
}));

vi.mock('../../../../utils/errorLog', () => ({
  getRecentErrors: () => mockErrors,
  getErrorCount: () => mockErrors.length,
  clearErrorLog: vi.fn(),
  exportErrorLog: () => '{}',
}));

import { ErrorLogPanel } from '../ErrorLogPanel';

const makeError = (over = {}) => ({
  id: 'err-1',
  timestamp: Date.now() - 60_000,
  code: 'E401',
  message: 'Failed to fetch dynamically imported module',
  stack: null,
  context: { view: 'Player Finder' },
  ...over,
});

beforeEach(() => {
  mockErrors = [makeError()];
  mockUi = { settingsFocus: null, clearSettingsFocus: vi.fn() };
  // jsdom has no layout engine.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ErrorLogPanel', () => {
  it('shows the error count while still collapsed', () => {
    mockErrors = [makeError({ id: 'a' }), makeError({ id: 'b' })];
    render(<ErrorLogPanel showSuccess={vi.fn()} />);

    // The badge is the only cue the panel holds anything. Loading the count
    // lazily on expand meant it read as empty until you had already found it.
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('stays collapsed when Settings is opened from primary nav', () => {
    render(<ErrorLogPanel showSuccess={vi.fn()} />);
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
  });

  describe('arriving from the health pill', () => {
    beforeEach(() => {
      mockUi = { settingsFocus: 'errorLog', clearSettingsFocus: vi.fn() };
    });

    it('opens the log without a second tap', () => {
      render(<ErrorLogPanel showSuccess={vi.fn()} />);
      expect(screen.getByText(/Failed to fetch/)).toBeInTheDocument();
    });

    it('scrolls itself into view', () => {
      render(<ErrorLogPanel showSuccess={vi.fn()} />);
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it('consumes the intent so a later Settings visit does not jump here', () => {
      render(<ErrorLogPanel showSuccess={vi.fn()} />);
      expect(mockUi.clearSettingsFocus).toHaveBeenCalledTimes(1);
    });
  });
});
