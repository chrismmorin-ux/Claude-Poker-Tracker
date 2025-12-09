/**
 * HistoryView.test.jsx - Tests for history view component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HistoryView } from '../HistoryView';

// Mock persistence functions
vi.mock('../../../utils/persistence', () => ({
  getAllHands: vi.fn(() => Promise.resolve([])),
  loadHandById: vi.fn(() => Promise.resolve(null)),
  deleteHand: vi.fn(() => Promise.resolve()),
  clearAllHands: vi.fn(() => Promise.resolve()),
  getHandCount: vi.fn(() => Promise.resolve(0)),
  getHandsBySessionId: vi.fn(() => Promise.resolve([])),
  getAllSessions: vi.fn(() => Promise.resolve([])),
  getSessionHandCount: vi.fn(() => Promise.resolve(0)),
}));

import {
  getAllHands,
  loadHandById,
  deleteHand,
  clearAllHands,
  getHandCount,
  getHandsBySessionId,
  getAllSessions,
  getSessionHandCount,
} from '../../../utils/persistence';

describe('HistoryView', () => {
  const defaultProps = {
    scale: 1,
    setCurrentScreen: vi.fn(),
    dispatchGame: vi.fn(),
    dispatchCard: vi.fn(),
    dispatchPlayer: vi.fn(),
    dispatchSession: vi.fn(),
    STREETS: ['preflop', 'flop', 'turn', 'river', 'showdown'],
    showError: vi.fn(),
    currentSessionId: null,
  };

  const mockHand = {
    handId: 1,
    timestamp: Date.now() - 3600000, // 1 hour ago
    sessionId: null,
    gameState: {
      currentStreet: 'flop',
      mySeat: 5,
      seatActions: {
        preflop: { 3: ['open'] },
      },
    },
    cardState: {
      communityCards: ['A♠', 'K♥', 'Q♦', '', ''],
      holeCards: ['A♥', 'A♦'],
      holeCardsVisible: true,
      allPlayerCards: {},
    },
    seatPlayers: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock implementations
    getAllHands.mockResolvedValue([]);
    getHandCount.mockResolvedValue(0);
    getAllSessions.mockResolvedValue([]);
    getHandsBySessionId.mockResolvedValue([]);
    getSessionHandCount.mockResolvedValue(0);
  });

  describe('rendering', () => {
    it('renders title', async () => {
      render(<HistoryView {...defaultProps} />);
      expect(screen.getByText('Hand History')).toBeInTheDocument();
    });

    it('renders back to table button', async () => {
      render(<HistoryView {...defaultProps} />);
      expect(screen.getByText(/Back to Table/)).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      getAllHands.mockImplementation(() => new Promise(() => {})); // Never resolves
      render(<HistoryView {...defaultProps} />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows empty state when no hands', async () => {
      getAllHands.mockResolvedValue([]);
      getHandCount.mockResolvedValue(0);

      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No hands saved yet')).toBeInTheDocument();
      });
    });
  });

  describe('with hands data', () => {
    beforeEach(() => {
      getAllHands.mockResolvedValue([mockHand]);
      getHandCount.mockResolvedValue(1);
    });

    it('displays hand count', async () => {
      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1 of 1 total/)).toBeInTheDocument();
      });
    });

    it('displays hand street badge', async () => {
      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('flop')).toBeInTheDocument();
      });
    });

    it('displays Load button for each hand', async () => {
      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Load')).toBeInTheDocument();
      });
    });

    it('displays Delete button for each hand', async () => {
      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
    });

    it('shows Clear All button when hands exist', async () => {
      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Clear All')).toBeInTheDocument();
      });
    });
  });

  describe('session filter', () => {
    it('shows session filter dropdown', async () => {
      getAllSessions.mockResolvedValue([
        { sessionId: 1, startTime: Date.now(), venue: 'Test Casino', handCount: 5 },
      ]);

      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('All Sessions')).toBeInTheDocument();
      });
    });

    it('shows Current Session option when currentSessionId provided', async () => {
      render(<HistoryView {...defaultProps} currentSessionId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Current Session')).toBeInTheDocument();
      });
    });
  });

  describe('interactions', () => {
    it('calls setCurrentScreen when back button clicked', async () => {
      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Back to Table/));
      expect(defaultProps.setCurrentScreen).toHaveBeenCalledWith('table');
    });

    it('calls loadHandById when Load clicked', async () => {
      getAllHands.mockResolvedValue([mockHand]);
      getHandCount.mockResolvedValue(1);
      loadHandById.mockResolvedValue(mockHand);

      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Load')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Load'));

      await waitFor(() => {
        expect(loadHandById).toHaveBeenCalledWith(1);
      });
    });

    it('dispatches hydrate actions after loading hand', async () => {
      getAllHands.mockResolvedValue([mockHand]);
      getHandCount.mockResolvedValue(1);
      loadHandById.mockResolvedValue(mockHand);

      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Load')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Load'));

      await waitFor(() => {
        expect(defaultProps.dispatchGame).toHaveBeenCalled();
        expect(defaultProps.dispatchCard).toHaveBeenCalled();
      });
    });

    it('navigates to table after loading hand', async () => {
      getAllHands.mockResolvedValue([mockHand]);
      getHandCount.mockResolvedValue(1);
      loadHandById.mockResolvedValue(mockHand);

      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Load')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Load'));

      await waitFor(() => {
        expect(defaultProps.setCurrentScreen).toHaveBeenCalledWith('table');
      });
    });
  });

  describe('delete functionality', () => {
    beforeEach(() => {
      getAllHands.mockResolvedValue([mockHand]);
      getHandCount.mockResolvedValue(1);
      // Mock window.confirm
      vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('confirms before deleting hand', async () => {
      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Delete'));

      expect(window.confirm).toHaveBeenCalled();
    });

    it('calls deleteHand when confirmed', async () => {
      deleteHand.mockResolvedValue();

      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Delete'));

      await waitFor(() => {
        expect(deleteHand).toHaveBeenCalledWith(1);
      });
    });

    it('does not delete when cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Delete'));

      expect(deleteHand).not.toHaveBeenCalled();
    });
  });

  describe('clear all functionality', () => {
    beforeEach(() => {
      getAllHands.mockResolvedValue([mockHand]);
      getHandCount.mockResolvedValue(1);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('confirms before clearing all', async () => {
      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Clear All')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Clear All'));

      expect(window.confirm).toHaveBeenCalled();
    });

    it('calls clearAllHands when confirmed', async () => {
      clearAllHands.mockResolvedValue();

      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Clear All')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Clear All'));

      await waitFor(() => {
        expect(clearAllHands).toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    it('calls showError when load fails', async () => {
      getAllHands.mockResolvedValue([mockHand]);
      getHandCount.mockResolvedValue(1);
      loadHandById.mockRejectedValue(new Error('Load failed'));

      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Load')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Load'));

      await waitFor(() => {
        expect(defaultProps.showError).toHaveBeenCalled();
      });
    });
  });

  describe('multiple hands', () => {
    const multipleHands = [
      { ...mockHand, handId: 1, timestamp: Date.now() - 1000 },
      { ...mockHand, handId: 2, timestamp: Date.now() - 2000, gameState: { ...mockHand.gameState, currentStreet: 'turn' } },
      { ...mockHand, handId: 3, timestamp: Date.now() - 3000, gameState: { ...mockHand.gameState, currentStreet: 'river' } },
    ];

    beforeEach(() => {
      getAllHands.mockResolvedValue(multipleHands);
      getHandCount.mockResolvedValue(3);
    });

    it('displays all hands', async () => {
      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/3 of 3 total/)).toBeInTheDocument();
      });
    });

    it('shows correct number of Load buttons', async () => {
      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        const loadButtons = screen.getAllByText('Load');
        expect(loadButtons.length).toBe(3);
      });
    });

    it('shows correct number of Delete buttons', async () => {
      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        const deleteButtons = screen.getAllByText('Delete');
        expect(deleteButtons.length).toBe(3);
      });
    });
  });

  describe('action summary', () => {
    it('shows action count for hands with actions', async () => {
      getAllHands.mockResolvedValue([mockHand]);
      getHandCount.mockResolvedValue(1);

      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1 actions/)).toBeInTheDocument();
      });
    });

    it('shows No actions for empty hands', async () => {
      const emptyHand = {
        ...mockHand,
        gameState: { ...mockHand.gameState, seatActions: {} },
      };
      getAllHands.mockResolvedValue([emptyHand]);
      getHandCount.mockResolvedValue(1);

      render(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No actions')).toBeInTheDocument();
      });
    });
  });
});
