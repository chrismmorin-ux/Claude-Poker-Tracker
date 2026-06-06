// @vitest-environment jsdom
/**
 * ReviewQueuePanel.test.jsx — "Tagged ⭐" Review Queue (WS-190).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('lucide-react', () => ({
  Star: () => <span data-testid="star-icon">★</span>,
}));

vi.mock('../../../../utils/errorHandler', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), action: vi.fn() },
}));

const getTaggedHands = vi.fn();
vi.mock('../../../../utils/persistence/index', () => ({
  getTaggedHands: (...args) => getTaggedHands(...args),
}));

import { ReviewQueuePanel } from '../ReviewQueuePanel';

beforeEach(() => {
  getTaggedHands.mockReset();
});

describe('ReviewQueuePanel', () => {
  it('renders nothing while empty', async () => {
    getTaggedHands.mockResolvedValue([]);
    const { container } = render(<ReviewQueuePanel onOpenHand={vi.fn()} />);
    await waitFor(() => expect(getTaggedHands).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="review-queue-panel"]')).toBeNull();
  });

  it('renders a row per tagged hand with the count badge', async () => {
    getTaggedHands.mockResolvedValue([
      { handId: 1, handDisplayId: 'S1-H4', reviewTag: { tagged: true, taggedAt: 200 } },
      { handId: 2, handDisplayId: 'S1-H2', reviewTag: { tagged: true, taggedAt: 100 } },
    ]);
    render(<ReviewQueuePanel onOpenHand={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('review-queue-panel')).toBeTruthy());
    expect(screen.getAllByTestId('review-queue-row')).toHaveLength(2);
    expect(screen.getByText('S1-H4')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // count badge
  });

  it('calls onOpenHand with the hand id + record on row tap', async () => {
    const hand = { handId: 7, handDisplayId: 'H7', reviewTag: { tagged: true, taggedAt: 1 } };
    getTaggedHands.mockResolvedValue([hand]);
    const onOpenHand = vi.fn();
    render(<ReviewQueuePanel onOpenHand={onOpenHand} />);
    await waitFor(() => expect(screen.getByTestId('review-queue-row')).toBeTruthy());
    fireEvent.click(screen.getByTestId('review-queue-row'));
    expect(onOpenHand).toHaveBeenCalledWith(7, hand);
  });

  it('passes an explicit userId through to getTaggedHands', async () => {
    getTaggedHands.mockResolvedValue([]);
    render(<ReviewQueuePanel onOpenHand={vi.fn()} userId="userX" />);
    await waitFor(() => expect(getTaggedHands).toHaveBeenCalledWith('userX'));
  });
});
