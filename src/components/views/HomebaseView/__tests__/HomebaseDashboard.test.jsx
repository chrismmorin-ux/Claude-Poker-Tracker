// @vitest-environment jsdom
/**
 * @file HomebaseDashboard — skeleton→data, study queue, recent sessions, empty
 * state, and the "since your last visit" re-orientation band (Lapsed Returner).
 * Plan shimmying-moseying-lantern, Phase D.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import { SCREEN } from '../../../../constants/uiConstants';

let mockSession;
let mockCoach;
let mockLastVisit;
const mockStampVisit = vi.fn();

vi.mock('../../../../contexts', () => ({
  useSession: () => mockSession,
  useAuth: () => ({ userId: 'u1' }),
}));
vi.mock('../../../../hooks/useSelfCoachMastery', () => ({
  useSelfCoachMastery: () => mockCoach,
}));
vi.mock('../../../../utils/lastVisit', () => ({
  getLastVisit: () => mockLastVisit,
  stampVisit: (...a) => mockStampVisit(...a),
}));
// Keep InsightsBand real but lightweight — it returns null with no completed sessions.

import { HomebaseDashboard } from '../HomebaseDashboard';

const completed = (over = {}) => ({
  sessionId: Math.random().toString(36).slice(2),
  startTime: Date.now() - 3 * 3600000,
  endTime: Date.now() - 3600000,
  isActive: false,
  buyIn: 100,
  cashOut: 150,
  handCount: 40,
  venue: 'Bellagio',
  gameType: '2/5',
  ...over,
});

beforeEach(() => {
  mockStampVisit.mockClear();
  mockLastVisit = {};
  mockSession = { allSessions: [], loadAllSessions: vi.fn().mockResolvedValue([]), isLoading: false };
  mockCoach = { loading: false, composites: [] };
});
afterEach(() => cleanup());

describe('HomebaseDashboard', () => {
  it('stamps the visit on mount', async () => {
    render(<HomebaseDashboard onNavigate={vi.fn()} />);
    await waitFor(() => expect(mockStampVisit).toHaveBeenCalled());
  });

  it('shows an empty state when there are no completed sessions', async () => {
    render(<HomebaseDashboard onNavigate={vi.fn()} />);
    expect(await screen.findByTestId('dashboard-empty')).toBeDefined();
  });

  it('shows recent sessions when sessions exist', async () => {
    mockSession = {
      allSessions: [completed({ venue: 'Aria' }), completed({ venue: 'Wynn' })],
      loadAllSessions: vi.fn().mockResolvedValue([]),
      isLoading: false,
    };
    render(<HomebaseDashboard onNavigate={vi.fn()} />);
    const recent = await screen.findByTestId('recent-sessions');
    expect(within(recent).getByText(/Aria/)).toBeDefined();
  });

  it('shows the study-queue count and routes to Self Coach', async () => {
    mockCoach = { loading: false, composites: [{ compositeScore: 0.5 }, { compositeScore: 0 }, { compositeScore: 0.2 }] };
    const onNavigate = vi.fn();
    render(<HomebaseDashboard onNavigate={onNavigate} />);
    const queue = await screen.findByTestId('study-queue');
    expect(queue.textContent).toMatch(/2 concepts to work on/);
    fireEvent.click(queue);
    expect(onNavigate).toHaveBeenCalledWith(SCREEN.SELF_COACH);
  });

  it('shows "since your last visit" for a returning player (gap > 3 days)', async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 3600000;
    mockLastVisit = { lastVisitAt: eightDaysAgo, lastSeenWhatsNewId: undefined };
    mockSession = {
      allSessions: [completed({ endTime: Date.now() - 24 * 3600000 })], // played during the gap
      loadAllSessions: vi.fn().mockResolvedValue([]),
      isLoading: false,
    };
    render(<HomebaseDashboard onNavigate={vi.fn()} />);
    expect(await screen.findByTestId('since-last-visit')).toBeDefined();
    expect(screen.getByText(/New in the app/)).toBeDefined();
  });

  it('does NOT show "since your last visit" for a frequent user (recent gap)', async () => {
    mockLastVisit = { lastVisitAt: Date.now() - 3600000, lastSeenWhatsNewId: '2026-06-homebase-dashboard' };
    render(<HomebaseDashboard onNavigate={vi.fn()} />);
    await screen.findByTestId('study-queue'); // ensure rendered
    expect(screen.queryByTestId('since-last-visit')).toBeNull();
  });
});
