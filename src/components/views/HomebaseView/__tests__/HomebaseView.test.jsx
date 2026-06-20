// @vitest-environment jsdom
/**
 * @file HomebaseView tests — tiles render, route correctly, and the Live Table
 * tile copy reflects active-session state.
 *
 * Plan shimmying-moseying-lantern (2026-06-19). Surface: homebase-view.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SCREEN } from '../../../../constants/uiConstants';

let mockSetCurrentScreen;
let mockHasActiveSession;
let mockCurrentSession;

vi.mock('../../../../contexts', () => ({
  useUI: () => ({ setCurrentScreen: mockSetCurrentScreen }),
  useSession: () => ({ hasActiveSession: mockHasActiveSession, currentSession: mockCurrentSession }),
}));

// HomebaseDashboard is tested separately; stub it so these tests isolate the launcher.
vi.mock('../HomebaseDashboard', () => ({
  HomebaseDashboard: () => <div data-testid="homebase-dashboard-stub" />,
}));

import { HomebaseView } from '../HomebaseView';

beforeEach(() => {
  mockSetCurrentScreen = vi.fn();
  mockHasActiveSession = false;
  mockCurrentSession = null;
});
afterEach(() => cleanup());

describe('HomebaseView', () => {
  it('renders the primary and secondary tiles', () => {
    render(<HomebaseView scale={1} />);
    expect(screen.getByText('Live Table')).toBeDefined();
    expect(screen.getByText('Online')).toBeDefined();
    expect(screen.getByText('Stats')).toBeDefined();
    expect(screen.getByText('Sessions')).toBeDefined();
    expect(screen.getByText('Players')).toBeDefined();
    expect(screen.getByText('Hand Review')).toBeDefined();
    expect(screen.getByText('Self Coach')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('shows "Live Table" / "Start a live session" when no session is active', () => {
    mockHasActiveSession = false;
    render(<HomebaseView scale={1} />);
    expect(screen.getByText('Live Table')).toBeDefined();
    expect(screen.getByText('Start a live session')).toBeDefined();
    expect(screen.queryByText('Resume Session')).toBeNull();
  });

  it('shows "Resume Session" with context when a recent session is active', () => {
    mockHasActiveSession = true;
    mockCurrentSession = { startTime: Date.now() - 60 * 60 * 1000, handCount: 23 }; // 1h ago
    render(<HomebaseView scale={1} />);
    expect(screen.getByText('Resume Session')).toBeDefined();
    expect(screen.getByText(/Active ·/)).toBeDefined();
    expect(screen.getByText(/23 hands/)).toBeDefined();
    expect(screen.queryByText('Live Table')).toBeNull();
  });

  it('reframes a stale active session as "Unfinished Session" (Resume must not lie)', () => {
    mockHasActiveSession = true;
    mockCurrentSession = { startTime: Date.now() - 2 * 24 * 60 * 60 * 1000, handCount: 5 }; // 2 days ago
    render(<HomebaseView scale={1} />);
    expect(screen.getByText('Unfinished Session')).toBeDefined();
    expect(screen.getByText(/tap to finish/)).toBeDefined();
    expect(screen.queryByText('Resume Session')).toBeNull();
  });

  it('routes each tile to the correct screen', () => {
    render(<HomebaseView scale={1} />);

    fireEvent.click(screen.getByText('Live Table'));
    expect(mockSetCurrentScreen).toHaveBeenCalledWith(SCREEN.TABLE);

    fireEvent.click(screen.getByText('Online'));
    expect(mockSetCurrentScreen).toHaveBeenCalledWith(SCREEN.ONLINE);

    fireEvent.click(screen.getByText('Stats'));
    expect(mockSetCurrentScreen).toHaveBeenCalledWith(SCREEN.STATS);

    fireEvent.click(screen.getByText('Sessions'));
    expect(mockSetCurrentScreen).toHaveBeenCalledWith(SCREEN.SESSIONS);

    fireEvent.click(screen.getByText('Players'));
    expect(mockSetCurrentScreen).toHaveBeenCalledWith(SCREEN.PLAYERS);

    fireEvent.click(screen.getByText('Hand Review'));
    expect(mockSetCurrentScreen).toHaveBeenCalledWith(SCREEN.HISTORY);

    fireEvent.click(screen.getByText('Self Coach'));
    expect(mockSetCurrentScreen).toHaveBeenCalledWith(SCREEN.SELF_COACH);

    fireEvent.click(screen.getByText('Settings'));
    expect(mockSetCurrentScreen).toHaveBeenCalledWith(SCREEN.SETTINGS);
  });

  it('routes the Live Table tile to TABLE even when resuming', () => {
    mockHasActiveSession = true;
    mockCurrentSession = { startTime: Date.now() - 60 * 60 * 1000, handCount: 3 };
    render(<HomebaseView scale={1} />);
    fireEvent.click(screen.getByText('Resume Session'));
    expect(mockSetCurrentScreen).toHaveBeenCalledWith(SCREEN.TABLE);
  });
});
