// @vitest-environment jsdom
/**
 * @file HealthIndicator — silent when healthy, surfaces a tappable pill on a
 * genuinely actionable fault, routes to the right place. Plan
 * shimmying-moseying-lantern, Phase C.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SCREEN } from '../../../constants/uiConstants';

let mockSetCurrentScreen;
let mockSync;
let mockErrorCount;

vi.mock('../../../contexts', () => ({
  useUI: () => ({ setCurrentScreen: mockSetCurrentScreen }),
  useSyncBridge: () => mockSync,
}));

vi.mock('../../../utils/errorLog', () => ({
  getErrorCount: () => mockErrorCount,
}));

import { HealthIndicator } from '../HealthIndicator';

beforeEach(() => {
  mockSetCurrentScreen = vi.fn();
  mockErrorCount = 0;
  mockSync = { isExtensionConnected: true, syncError: null, versionMismatch: false, lastSyncTime: null };
});
afterEach(() => cleanup());

describe('HealthIndicator', () => {
  it('renders nothing when everything is healthy (silent)', () => {
    const { container } = render(<HealthIndicator />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('health-indicator')).toBeNull();
  });

  it('stays silent for a live-only user with no extension (never synced)', () => {
    mockSync = { isExtensionConnected: false, syncError: null, versionMismatch: false, lastSyncTime: null };
    const { container } = render(<HealthIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('warns "Extension offline" only after it has synced before, routing to Online', () => {
    mockSync = { isExtensionConnected: false, syncError: null, versionMismatch: false, lastSyncTime: Date.now() - 1000 };
    render(<HealthIndicator />);
    const pill = screen.getByTestId('health-indicator');
    expect(pill.textContent).toMatch(/Extension offline/);
    fireEvent.click(pill);
    expect(mockSetCurrentScreen).toHaveBeenCalledWith(SCREEN.ONLINE);
  });

  it('shows a sync problem and routes to Online', () => {
    mockSync = { isExtensionConnected: true, syncError: 'boom', versionMismatch: false, lastSyncTime: Date.now() };
    render(<HealthIndicator />);
    expect(screen.getByTestId('health-indicator').textContent).toMatch(/Sync problem/);
    fireEvent.click(screen.getByTestId('health-indicator'));
    expect(mockSetCurrentScreen).toHaveBeenCalledWith(SCREEN.ONLINE);
  });

  it('shows version mismatch (takes priority) and routes to Online', () => {
    mockSync = { isExtensionConnected: true, syncError: null, versionMismatch: true, lastSyncTime: Date.now() };
    render(<HealthIndicator />);
    expect(screen.getByTestId('health-indicator').textContent).toMatch(/version mismatch/i);
  });

  it('shows logged errors and routes to Settings', () => {
    mockErrorCount = 3;
    render(<HealthIndicator />);
    expect(screen.getByTestId('health-indicator').textContent).toMatch(/3 errors logged/);
    fireEvent.click(screen.getByTestId('health-indicator'));
    expect(mockSetCurrentScreen).toHaveBeenCalledWith(SCREEN.SETTINGS);
  });

  it('singularizes a single error', () => {
    mockErrorCount = 1;
    render(<HealthIndicator />);
    expect(screen.getByTestId('health-indicator').textContent).toMatch(/1 error logged/);
  });
});
