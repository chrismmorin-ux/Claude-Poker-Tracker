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
let mockOpenSettings;
let mockSync;
let mockErrorCount;
let mockSaveFailures;

vi.mock('../../../contexts', () => ({
  useUI: () => ({ setCurrentScreen: mockSetCurrentScreen, openSettings: mockOpenSettings }),
  useSyncBridge: () => mockSync,
}));

vi.mock('../../../utils/errorLog', () => ({
  getErrorCountForBuild: () => mockErrorCount,
}));

vi.mock('../../../utils/persistenceHealth', () => ({
  getPersistenceFailureCount: () => mockSaveFailures,
}));

import { HealthIndicator } from '../HealthIndicator';

beforeEach(() => {
  mockSetCurrentScreen = vi.fn();
  mockOpenSettings = vi.fn();
  mockErrorCount = 0;
  mockSaveFailures = 0;
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
    // Not setCurrentScreen(SETTINGS): the Error Log is the 11th panel down a
    // single long scroll and starts collapsed, so landing at the top of
    // Settings reads as though the tap did nothing.
    expect(mockOpenSettings).toHaveBeenCalledWith('errorLog');
    expect(mockSetCurrentScreen).not.toHaveBeenCalled();
  });

  it('singularizes a single error', () => {
    mockErrorCount = 1;
    render(<HealthIndicator />);
    expect(screen.getByTestId('health-indicator').textContent).toMatch(/1 error logged/);
  });
});

// Persistence failures used to be entirely silent: the four hooks caught init
// errors, continued, and the app looked completely normal while saving nothing.
// At a live table that surfaces when the session is already gone.
describe('HealthIndicator — save failures', () => {
  it('warns that nothing is being saved', () => {
    mockSaveFailures = 1;
    render(<HealthIndicator />);

    expect(screen.getByTestId('health-indicator').textContent).toMatch(/not saving/i);
  });

  it('outranks a sync fault — losing the live session beats re-importable hands', () => {
    mockSaveFailures = 1;
    Object.assign(mockSync, { versionMismatch: true, syncError: 'boom' });

    render(<HealthIndicator />);

    const text = screen.getByTestId('health-indicator').textContent;
    expect(text).toMatch(/not saving/i);
    expect(text).not.toMatch(/mismatch/i);
  });

  it('outranks logged errors', () => {
    mockSaveFailures = 1;
    mockErrorCount = 4;

    render(<HealthIndicator />);

    expect(screen.getByTestId('health-indicator').textContent).toMatch(/not saving/i);
  });

  it('routes to the error log, where the E307 detail is', () => {
    mockSaveFailures = 1;
    render(<HealthIndicator />);

    fireEvent.click(screen.getByTestId('health-indicator'));
    expect(mockOpenSettings).toHaveBeenCalledWith('errorLog');
  });

  it('stays silent when persistence is healthy', () => {
    mockSaveFailures = 0;
    const { container } = render(<HealthIndicator />);
    expect(container.firstChild).toBeNull();
  });
});
