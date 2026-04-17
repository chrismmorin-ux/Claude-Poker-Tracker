// @vitest-environment jsdom
/**
 * PlayersView.test.jsx - Tests for player management view component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../contexts/ToastContext';
import { PlayersView } from '../PlayersView';

// Mock lucide-react
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <span data-testid="chevron-left-icon">←</span>,
  Users: () => <span data-testid="users-icon">U</span>,
  AlertCircle: () => <span>!</span>,
  CheckCircle: () => <span>✓</span>,
  Info: () => <span>i</span>,
  AlertTriangle: () => <span>⚠</span>,
  X: () => <span>×</span>,
}));

// Mock child components.
// (PEO-4: PlayerForm directory deleted — editor moved to SCREEN.PLAYER_EDITOR.)

vi.mock('../../ui/PlayerFilters', () => ({
  PlayerFilters: ({ searchTerm, setSearchTerm }) => (
    <div data-testid="player-filters">
      <input
        data-testid="search-input"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search players"
      />
    </div>
  ),
}));

vi.mock('../../ui/PlayerRow', () => ({
  PlayerRow: ({ player, assignedSeat, isSelecting, onClick, onEdit, onDelete }) => (
    <tr data-testid={`player-row-${player.playerId}`}>
      <td>{player.name}</td>
      <td>{assignedSeat || 'Unassigned'}</td>
      <td>
        <button onClick={onClick} disabled={!isSelecting}>Select</button>
        <button onClick={onEdit}>Edit</button>
        <button onClick={onDelete}>Delete</button>
      </td>
    </tr>
  ),
}));

vi.mock('../../ui/SeatAssignmentGrid', () => ({
  SeatAssignmentGrid: ({ selectedSeat, onSeatClick, onClearAllSeats }) => (
    <div data-testid="seat-grid">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((seat) => (
        <button
          key={seat}
          data-testid={`seat-${seat}`}
          onClick={() => onSeatClick(seat)}
          className={selectedSeat === seat ? 'selected' : ''}
        >
          Seat {seat}
        </button>
      ))}
      <button onClick={onClearAllSeats}>Clear All</button>
    </div>
  ),
}));

// Mock player context - must be before component import
const mockPlayerContext = {
  allPlayers: [],
  seatPlayers: {},
  createNewPlayer: vi.fn(() => Promise.resolve(100)),
  updatePlayerById: vi.fn(() => Promise.resolve()),
  deletePlayerById: vi.fn(() => Promise.resolve()),
  loadAllPlayers: vi.fn(),
  assignPlayerToSeat: vi.fn(),
  clearSeatAssignment: vi.fn(),
  getSeatPlayerName: vi.fn(() => null),
  isPlayerAssigned: vi.fn(() => false),
  getPlayerSeat: vi.fn(() => null),
  clearAllSeatAssignments: vi.fn(),
};

const mockUIContext = {
  setCurrentScreen: vi.fn(),
  SCREEN: { TABLE: 'table', PLAYERS: 'players', PLAYER_EDITOR: 'playerEditor' },
  openPlayerEditor: vi.fn(),
};

const mockSessionContext = {
  currentSession: { sessionId: 42 },
};

vi.mock('../../../contexts', () => ({
  usePlayer: () => mockPlayerContext,
  useUI: () => mockUIContext,
  useSession: () => mockSessionContext,
  useTendency: () => ({ tendencyMap: {}, isLoading: false, refresh: vi.fn(), patchTendency: vi.fn() }),
}));

// Mock persistence to suppress IndexedDB not supported warnings
vi.mock('../../../utils/persistence/index', () => ({
  getAllHands: vi.fn(() => Promise.resolve([])),
  getHandsBySessionId: vi.fn(() => Promise.resolve([])),
  savePlayer: vi.fn(() => Promise.resolve()),
  deletePlayer: vi.fn(() => Promise.resolve()),
  getAllPlayers: vi.fn(() => Promise.resolve([])),
  GUEST_USER_ID: 'guest',
}));

// Mock usePlayerFiltering hook
vi.mock('../../../hooks/usePlayerFiltering', () => ({
  usePlayerFiltering: (players) => ({
    filteredPlayers: players,
    allStyleTags: ['TAG', 'LAG'],
    searchTerm: '',
    setSearchTerm: vi.fn(),
    sortBy: 'name',
    setSortBy: vi.fn(),
    filterTag: null,
    setFilterTag: vi.fn(),
    filterGender: null,
    setFilterGender: vi.fn(),
    filterBuild: null,
    setFilterBuild: vi.fn(),
    filterEthnicity: null,
    setFilterEthnicity: vi.fn(),
    filterFacialHair: null,
    setFilterFacialHair: vi.fn(),
    filterHat: null,
    setFilterHat: vi.fn(),
    filterSunglasses: null,
    setFilterSunglasses: vi.fn(),
    clearFilters: vi.fn(),
  }),
}));

const renderWithToast = (ui) => render(<ToastProvider>{ui}</ToastProvider>);

describe('PlayersView', () => {
  const mockPlayers = [
    {
      playerId: 1,
      name: 'John Doe',
      styleTags: ['TAG'],
      handCount: 10,
      lastSeenAt: Date.now() - 3600000,
    },
    {
      playerId: 2,
      name: 'Jane Smith',
      styleTags: ['LAG'],
      handCount: 5,
      lastSeenAt: Date.now() - 7200000,
    },
  ];

  const defaultProps = {
    scale: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock context with test data
    mockPlayerContext.allPlayers = mockPlayers;
    mockPlayerContext.seatPlayers = {};
    mockPlayerContext.createNewPlayer.mockImplementation(() => Promise.resolve(100));
    mockPlayerContext.updatePlayerById.mockImplementation(() => Promise.resolve());
    mockPlayerContext.deletePlayerById.mockImplementation(() => Promise.resolve());
    mockPlayerContext.getSeatPlayerName.mockImplementation(() => null);
    mockPlayerContext.isPlayerAssigned.mockImplementation(() => false);
    mockPlayerContext.getPlayerSeat.mockImplementation(() => null);
  });

  describe('rendering', () => {
    it('renders page title', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      expect(screen.getByText('Player Management')).toBeInTheDocument();
    });

    it('renders back to table button', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      expect(screen.getByText('Table View')).toBeInTheDocument();
    });

    it('renders new player button', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      expect(screen.getByText('+ New Player')).toBeInTheDocument();
    });

    it('renders player filters', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      expect(screen.getByTestId('player-filters')).toBeInTheDocument();
    });

    it('renders seat grid', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      expect(screen.getByTestId('seat-grid')).toBeInTheDocument();
    });

    it('displays player count', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      expect(screen.getByText(/Showing 2 of 2 players/)).toBeInTheDocument();
    });

    it('renders player table with headers', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      expect(screen.getByText('Player')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Style')).toBeInTheDocument();
      expect(screen.getByText('Hands')).toBeInTheDocument();
      expect(screen.getByText('Last Seen')).toBeInTheDocument();
    });

    it('renders player rows', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      expect(screen.getByTestId('player-row-1')).toBeInTheDocument();
      expect(screen.getByTestId('player-row-2')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no players', () => {
      mockPlayerContext.allPlayers = [];
      renderWithToast(<PlayersView {...defaultProps} />);
      expect(screen.getByText('No Players Yet')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('navigates to table when back button clicked', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      fireEvent.click(screen.getByText('Table View'));
      expect(mockUIContext.setCurrentScreen).toHaveBeenCalledWith('table');
    });
  });

  describe('player creation (PEO-4: routes to fullscreen editor)', () => {
    it('opens PlayerEditor in create mode when button clicked', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      fireEvent.click(screen.getByText('+ New Player'));
      expect(mockUIContext.openPlayerEditor).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'create',
      }));
    });

    it('threads selected seat into editorContext.seatContext', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      fireEvent.click(screen.getByTestId('seat-5'));
      fireEvent.click(screen.getByText('+ New Player'));
      expect(mockUIContext.openPlayerEditor).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'create',
        seatContext: expect.objectContaining({ seat: 5, sessionId: 42 }),
      }));
    });

    it('uses null seatContext when no seat is selected', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      fireEvent.click(screen.getByText('+ New Player'));
      expect(mockUIContext.openPlayerEditor).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'create',
        seatContext: null,
      }));
    });
  });

  describe('seat selection', () => {
    it('selects seat when clicked', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      fireEvent.click(screen.getByTestId('seat-3'));
      // The selected seat should have a different class
      expect(screen.getByTestId('seat-3')).toHaveClass('selected');
    });
  });

  describe('player assignment', () => {
    it('assigns player to selected seat when clicked', async () => {
      renderWithToast(<PlayersView {...defaultProps} />);

      // First select a seat
      fireEvent.click(screen.getByTestId('seat-5'));

      // Then click select on a player row
      const selectButtons = screen.getAllByText('Select');
      fireEvent.click(selectButtons[0]);

      await waitFor(() => {
        expect(mockPlayerContext.assignPlayerToSeat).toHaveBeenCalledWith(5, 1);
      });
    });
  });

  describe('delete functionality', () => {
    it('opens delete confirmation when delete clicked', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    });

    it('shows player name in delete confirmation', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);
      // The name appears twice - once in the table and once in the modal (as <strong>)
      const johnDoeElements = screen.getAllByText('John Doe');
      expect(johnDoeElements.length).toBeGreaterThanOrEqual(2);
    });

    it('cancels delete when cancel clicked', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      // Click Cancel in the modal
      const cancelButtons = screen.getAllByText('Cancel');
      fireEvent.click(cancelButtons[cancelButtons.length - 1]);

      expect(screen.queryByText(/Are you sure you want to delete/)).not.toBeInTheDocument();
    });

    it('calls deletePlayerById on confirm', async () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      // Find and click the Delete button in the modal (the one with red styling)
      const allDeleteButtons = screen.getAllByText('Delete');
      const modalDeleteButton = allDeleteButtons.find(
        (btn) => btn.classList.contains('bg-red-600')
      );
      if (modalDeleteButton) {
        fireEvent.click(modalDeleteButton);
        await waitFor(() => {
          expect(mockPlayerContext.deletePlayerById).toHaveBeenCalledWith(1);
        });
      }
    });

    it('shows error on delete failure', async () => {
      mockPlayerContext.deletePlayerById.mockImplementation(() => Promise.reject(new Error('Delete failed')));
      renderWithToast(<PlayersView {...defaultProps} />);
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      const allDeleteButtons = screen.getAllByText('Delete');
      const modalDeleteButton = allDeleteButtons.find(
        (btn) => btn.classList.contains('bg-red-600')
      );
      if (modalDeleteButton) {
        fireEvent.click(modalDeleteButton);
        await waitFor(() => {
          expect(screen.getByText(/Failed to delete player/)).toBeInTheDocument();
        });
      }
    });
  });

  describe('edit functionality (PEO-4: routes to fullscreen editor)', () => {
    it('opens PlayerEditor in edit mode when edit clicked', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);
      expect(mockUIContext.openPlayerEditor).toHaveBeenCalledWith({
        mode: 'edit',
        playerId: 1,
      });
    });
  });

  describe('clear all seats', () => {
    it('clears all seats when confirmed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderWithToast(<PlayersView {...defaultProps} />);
      fireEvent.click(screen.getByText('Clear All'));
      expect(mockPlayerContext.clearAllSeatAssignments).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('does not clear when cancelled', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderWithToast(<PlayersView {...defaultProps} />);
      fireEvent.click(screen.getByText('Clear All'));
      expect(mockPlayerContext.clearAllSeatAssignments).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  // PEO-4: the "pending seat" cross-view nav feature was deleted when
  // SeatContextMenu was rewired to route directly to PlayerEditorView with
  // seatContext. No replacement tests live here; seat→editor wiring is tested
  // in SeatContextMenu + TableView handler specs.

  describe('replace player prompt', () => {
    it('shows replace prompt when assigning to occupied seat', async () => {
      mockPlayerContext.getSeatPlayerName.mockImplementation((seat) => (seat === 5 ? 'Existing Player' : null));
      renderWithToast(<PlayersView {...defaultProps} />);

      // Select occupied seat
      fireEvent.click(screen.getByTestId('seat-5'));

      // Try to assign player
      const selectButtons = screen.getAllByText('Select');
      fireEvent.click(selectButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Replace Player/)).toBeInTheDocument();
      });
    });

    it('shows existing player name in replace prompt', async () => {
      mockPlayerContext.getSeatPlayerName.mockImplementation((seat) => (seat === 5 ? 'Existing Player' : null));
      renderWithToast(<PlayersView {...defaultProps} />);

      fireEvent.click(screen.getByTestId('seat-5'));
      const selectButtons = screen.getAllByText('Select');
      fireEvent.click(selectButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Existing Player')).toBeInTheDocument();
      });
    });
  });

  describe('load on mount', () => {
    it('calls loadAllPlayers on mount', () => {
      renderWithToast(<PlayersView {...defaultProps} />);
      expect(mockPlayerContext.loadAllPlayers).toHaveBeenCalledTimes(1);
    });
  });
});
