// @vitest-environment jsdom
/**
 * SessionDetailModal.test.jsx — Phase 3 Sessions View Improvement (2026-06-06).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionDetailModal } from '../SessionDetailModal';

const handsBySessionMock = vi.fn();
vi.mock('../../../../utils/persistence/index', () => ({
  __esModule: true,
  getHandsBySessionId: (id) => handsBySessionMock(id),
}));

const HOUR = 3600000;
const session = (overrides = {}) => ({
  sessionId: 'sess-1',
  startTime: new Date('2026-06-01T18:00:00').getTime(),
  endTime: new Date('2026-06-01T22:00:00').getTime(),
  venue: 'Bellagio',
  gameType: '2/5',
  buyIn: 500,
  rebuyTransactions: [],
  cashOut: 980,
  tipAmount: 20,
  handCount: 110,
  goal: 'Work on 3-betting',
  notes: 'Ran good early',
  isActive: false,
  ...overrides,
});

beforeEach(() => {
  handsBySessionMock.mockReset();
  handsBySessionMock.mockResolvedValue([]);
});

describe('SessionDetailModal', () => {
  it('renders header, P&L, and stats', async () => {
    render(<SessionDetailModal session={session()} onClose={vi.fn()} onOpenHand={vi.fn()} />);
    expect(screen.getByText(/Bellagio/)).toBeInTheDocument();
    // P&L = 980 - 500 - 0 - 20 = +460
    expect(screen.getByText('+$460.00')).toBeInTheDocument();
    expect(screen.getByText('Work on 3-betting')).toBeInTheDocument();
    expect(screen.getByText('Ran good early')).toBeInTheDocument();
    await waitFor(() => expect(handsBySessionMock).toHaveBeenCalledWith('sess-1'));
  });

  it('shows the venue note when provided', () => {
    render(
      <SessionDetailModal session={session()} venueNote="soft 2/5" onClose={vi.fn()} onOpenHand={vi.fn()} />
    );
    expect(screen.getByText('soft 2/5')).toBeInTheDocument();
  });

  it('renders the rebuy timeline', () => {
    render(
      <SessionDetailModal
        session={session({ rebuyTransactions: [{ amount: 200 }, { amount: 100 }] })}
        onClose={vi.fn()}
        onOpenHand={vi.fn()}
      />
    );
    // "Rebuys" appears as both a stat-tile label and the timeline header.
    expect(screen.getAllByText('Rebuys').length).toBeGreaterThanOrEqual(2);
    // Unique per-rebuy rows (no timestamps → "Rebuy N").
    expect(screen.getByText('Rebuy 1')).toBeInTheDocument();
    expect(screen.getByText('Rebuy 2')).toBeInTheDocument();
  });

  it('lists hands and opens one on click', async () => {
    handsBySessionMock.mockResolvedValue([
      { handId: 1, handDisplayId: 'Hand #1' },
      { handId: 2, handDisplayId: 'Hand #2' },
    ]);
    const onOpenHand = vi.fn();
    render(<SessionDetailModal session={session()} onClose={vi.fn()} onOpenHand={onOpenHand} />);

    await waitFor(() => expect(screen.getByText('Hand #1')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Hand #2'));
    expect(onOpenHand).toHaveBeenCalledWith(2, { handId: 2, handDisplayId: 'Hand #2' });
  });

  it('shows an empty hands state when there are none', async () => {
    handsBySessionMock.mockResolvedValue([]);
    render(<SessionDetailModal session={session()} onClose={vi.fn()} onOpenHand={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText('No hands recorded for this session.')).toBeInTheDocument()
    );
  });

  it('closes on backdrop click and on the X button', () => {
    const onClose = vi.fn();
    render(<SessionDetailModal session={session()} onClose={onClose} onOpenHand={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('session-detail-modal'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not close when clicking inside the modal body', () => {
    const onClose = vi.fn();
    render(<SessionDetailModal session={session()} onClose={onClose} onOpenHand={vi.fn()} />);
    fireEvent.click(screen.getByText(/Bellagio/));
    expect(onClose).not.toHaveBeenCalled();
  });
});
