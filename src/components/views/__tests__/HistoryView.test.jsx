// @vitest-environment jsdom
/**
 * HistoryView.test.jsx - Tests for history view component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { ToastProvider } from '../../../contexts/ToastContext';
import { HistoryView } from '../HistoryView';

// Mock persistence functions
vi.mock('../../../utils/persistence/index', () => ({
  getAllHands: vi.fn(() => Promise.resolve([])),
  loadHandById: vi.fn(() => Promise.resolve(null)),
  deleteHand: vi.fn(() => Promise.resolve()),
  clearAllHands: vi.fn(() => Promise.resolve()),
  getHandCount: vi.fn(() => Promise.resolve(0)),
  getHandsBySessionId: vi.fn(() => Promise.resolve([])),
  getAllSessions: vi.fn(() => Promise.resolve([])),
  getSessionHandCount: vi.fn(() => Promise.resolve(0)),
  GUEST_USER_ID: 'guest',
}));

// Mock context hooks
const mockDispatchGame = vi.fn();
const mockDispatchCard = vi.fn();
const mockDispatchPlayer = vi.fn();
const mockDispatchSession = vi.fn();
const mockSetCurrentScreen = vi.fn();

vi.mock('../../../contexts', () => ({
  useGame: () => ({ dispatchGame: mockDispatchGame }),
  useCard: () => ({ dispatchCard: mockDispatchCard }),
  usePlayer: () => ({ dispatchPlayer: mockDispatchPlayer }),
  useSession: () => ({
    currentSession: null,
    dispatchSession: mockDispatchSession,
  }),
  useUI: () => ({ setCurrentScreen: mockSetCurrentScreen }),
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
} from '../../../utils/persistence/index';

const renderWithToast = (ui) => render(<ToastProvider>{ui}</ToastProvider>);

describe('HistoryView', () => {
  const defaultProps = {
    scale: 1,
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

  afterEach(() => {
    cleanup();
  });

  // Helper to wait for loading to complete
  const waitForLoad = async () => {
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  };

  describe('rendering', () => {
    it('renders title', async () => {
      renderWithToast(<HistoryView {...defaultProps} />);
      await waitForLoad();
      expect(screen.getByText('Hand History')).toBeInTheDocument();
    });

    it('renders back to table button', async () => {
      renderWithToast(<HistoryView {...defaultProps} />);
      await waitForLoad();
      expect(screen.getByText(/Back to Table/)).toBeInTheDocument();
    });

    it('shows loading state initially', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      getAllHands.mockImplementation(() => new Promise(() => {})); // Never resolves
      const { unmount } = renderWithToast(<HistoryView {...defaultProps} />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      unmount();
      consoleSpy.mockRestore();
    });

    it('shows empty state when no hands', async () => {
      getAllHands.mockResolvedValue([]);
      getHandCount.mockResolvedValue(0);

      renderWithToast(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No Hands Saved')).toBeInTheDocument();
      });
    });
  });

  describe('with hands data', () => {
    beforeEach(() => {
      getAllHands.mockResolvedValue([mockHand]);
      getHandCount.mockResolvedValue(1);
    });

    it('displays hand count', async () => {
      renderWithToast(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1 of 1 total/)).toBeInTheDocument();
      });
    });

    it('displays hand street badge', async () => {
      renderWithToast(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('flop')).toBeInTheDocument();
      });
    });

    it('displays Load button for each hand', async () => {
      renderWithToast(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Load')).toBeInTheDocument();
      });
    });

    it('displays Delete button for each hand', async () => {
      renderWithToast(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
    });

    it('shows Clear All button when hands exist', async () => {
      renderWithToast(<HistoryView {...defaultProps} />);

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

      renderWithToast(<HistoryView {...defaultProps} />);
      await waitForLoad();

      expect(screen.getByText('All Sessions')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls setCurrentScreen when back button clicked', async () => {
      renderWithToast(<HistoryView {...defaultProps} />);
      await waitForLoad();

      fireEvent.click(screen.getByText(/Back to Table/));
      expect(mockSetCurrentScreen).toHaveBeenCalled();
    });

    it('calls loadHandById when Load clicked', async () => {
      getAllHands.mockResolvedValue([mockHand]);
      getHandCount.mockResolvedValue(1);
      loadHandById.mockResolvedValue(mockHand);

      renderWithToast(<HistoryView {...defaultProps} />);
      await waitForLoad();

      await act(async () => {
        fireEvent.click(screen.getByText('Load'));
      });

      await waitFor(() => {
        expect(loadHandById).toHaveBeenCalledWith(1);
      });
    });

    it('dispatches hydrate actions after loading hand', async () => {
      getAllHands.mockResolvedValue([mockHand]);
      getHandCount.mockResolvedValue(1);
      loadHandById.mockResolvedValue(mockHand);

      renderWithToast(<HistoryView {...defaultProps} />);
      await waitForLoad();

      await act(async () => {
        fireEvent.click(screen.getByText('Load'));
      });

      await waitFor(() => {
        expect(mockDispatchGame).toHaveBeenCalled();
        expect(mockDispatchCard).toHaveBeenCalled();
      });
    });

    it('navigates to table after loading hand', async () => {
      getAllHands.mockResolvedValue([mockHand]);
      getHandCount.mockResolvedValue(1);
      loadHandById.mockResolvedValue(mockHand);

      renderWithToast(<HistoryView {...defaultProps} />);
      await waitForLoad();

      await act(async () => {
        fireEvent.click(screen.getByText('Load'));
      });

      await waitFor(() => {
        expect(mockSetCurrentScreen).toHaveBeenCalled();
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
      renderWithToast(<HistoryView {...defaultProps} />);
      await waitForLoad();

      await act(async () => {
        fireEvent.click(screen.getByText('Delete'));
      });

      expect(window.confirm).toHaveBeenCalled();
    });

    it('calls deleteHand when confirmed', async () => {
      deleteHand.mockResolvedValue();

      renderWithToast(<HistoryView {...defaultProps} />);
      await waitForLoad();

      await act(async () => {
        fireEvent.click(screen.getByText('Delete'));
      });

      await waitFor(() => {
        expect(deleteHand).toHaveBeenCalledWith(1);
      });
    });

    it('does not delete when cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderWithToast(<HistoryView {...defaultProps} />);
      await waitForLoad();

      await act(async () => {
        fireEvent.click(screen.getByText('Delete'));
      });

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
      renderWithToast(<HistoryView {...defaultProps} />);
      await waitForLoad();

      await act(async () => {
        fireEvent.click(screen.getByText('Clear All'));
      });

      expect(window.confirm).toHaveBeenCalled();
    });

    it('calls clearAllHands when confirmed', async () => {
      clearAllHands.mockResolvedValue();

      renderWithToast(<HistoryView {...defaultProps} />);
      await waitForLoad();

      await act(async () => {
        fireEvent.click(screen.getByText('Clear All'));
      });

      await waitFor(() => {
        expect(clearAllHands).toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    it('shows error toast when load fails', async () => {
      getAllHands.mockResolvedValue([mockHand]);
      getHandCount.mockResolvedValue(1);
      loadHandById.mockRejectedValue(new Error('Load failed'));

      renderWithToast(<HistoryView {...defaultProps} />);
      await waitForLoad();

      await act(async () => {
        fireEvent.click(screen.getByText('Load'));
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to load hand. Please try again.')).toBeInTheDocument();
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
      renderWithToast(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/3 of 3 total/)).toBeInTheDocument();
      });
    });

    it('shows correct number of Load buttons', async () => {
      renderWithToast(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        const loadButtons = screen.getAllByText('Load');
        expect(loadButtons.length).toBe(3);
      });
    });

    it('shows correct number of Delete buttons', async () => {
      renderWithToast(<HistoryView {...defaultProps} />);

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

      renderWithToast(<HistoryView {...defaultProps} />);

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

      renderWithToast(<HistoryView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No actions')).toBeInTheDocument();
      });
    });
  });
});
