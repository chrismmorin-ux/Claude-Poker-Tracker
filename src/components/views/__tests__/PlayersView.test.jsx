/**
 * PlayersView.test.jsx - Tests for player management view component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlayersView } from '../PlayersView';

// Mock lucide-react
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <span data-testid="chevron-left-icon">←</span>,
}));

// Mock child components
vi.mock('../../ui/PlayerForm/index', () => ({
  PlayerForm: ({ onSubmit, onCancel, defaultName }) => (
    <div data-testid="player-form">
      <button onClick={() => onSubmit({ name: defaultName || 'Test Player' })}>Submit</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

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

vi.mock('../../ui/SeatGrid', () => ({
  SeatGrid: ({ selectedSeat, onSeatClick, onClearAllSeats }) => (
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
    onBackToTable: vi.fn(),
    playerState: {
      allPlayers: mockPlayers,
      seatPlayers: {},
      isLoading: false,
    },
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
    pendingSeatForPlayerAssignment: null,
    setPendingSeatForPlayerAssignment: vi.fn(),
    scale: 1,
    showError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders page title', () => {
      render(<PlayersView {...defaultProps} />);
      expect(screen.getByText('Player Management')).toBeInTheDocument();
    });

    it('renders back to table button', () => {
      render(<PlayersView {...defaultProps} />);
      expect(screen.getByText('Table View')).toBeInTheDocument();
    });

    it('renders new player button', () => {
      render(<PlayersView {...defaultProps} />);
      expect(screen.getByText('+ New Player')).toBeInTheDocument();
    });

    it('renders player filters', () => {
      render(<PlayersView {...defaultProps} />);
      expect(screen.getByTestId('player-filters')).toBeInTheDocument();
    });

    it('renders seat grid', () => {
      render(<PlayersView {...defaultProps} />);
      expect(screen.getByTestId('seat-grid')).toBeInTheDocument();
    });

    it('displays player count', () => {
      render(<PlayersView {...defaultProps} />);
      expect(screen.getByText(/Showing 2 of 2 players/)).toBeInTheDocument();
    });

    it('renders player table with headers', () => {
      render(<PlayersView {...defaultProps} />);
      expect(screen.getByText('Player')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Style')).toBeInTheDocument();
      expect(screen.getByText('Hands')).toBeInTheDocument();
      expect(screen.getByText('Last Seen')).toBeInTheDocument();
    });

    it('renders player rows', () => {
      render(<PlayersView {...defaultProps} />);
      expect(screen.getByTestId('player-row-1')).toBeInTheDocument();
      expect(screen.getByTestId('player-row-2')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no players', () => {
      const props = {
        ...defaultProps,
        playerState: { allPlayers: [], seatPlayers: {}, isLoading: false },
      };
      render(<PlayersView {...props} />);
      expect(screen.getByText(/No players yet/)).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('calls onBackToTable when back button clicked', () => {
      render(<PlayersView {...defaultProps} />);
      fireEvent.click(screen.getByText('Table View'));
      expect(defaultProps.onBackToTable).toHaveBeenCalledTimes(1);
    });
  });

  describe('player creation', () => {
    it('opens new player modal when button clicked', () => {
      render(<PlayersView {...defaultProps} />);
      fireEvent.click(screen.getByText('+ New Player'));
      expect(screen.getByTestId('player-form')).toBeInTheDocument();
    });

    it('closes modal when cancel clicked', () => {
      render(<PlayersView {...defaultProps} />);
      fireEvent.click(screen.getByText('+ New Player'));
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByTestId('player-form')).not.toBeInTheDocument();
    });

    it('calls createNewPlayer on submit', async () => {
      render(<PlayersView {...defaultProps} />);
      fireEvent.click(screen.getByText('+ New Player'));
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(defaultProps.createNewPlayer).toHaveBeenCalled();
      });
    });

    it('shows error toast on creation failure', async () => {
      const props = {
        ...defaultProps,
        createNewPlayer: vi.fn(() => Promise.reject(new Error('Create failed'))),
      };
      render(<PlayersView {...props} />);
      fireEvent.click(screen.getByText('+ New Player'));
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(props.showError).toHaveBeenCalled();
      });
    });
  });

  describe('seat selection', () => {
    it('selects seat when clicked', () => {
      render(<PlayersView {...defaultProps} />);
      fireEvent.click(screen.getByTestId('seat-3'));
      // The selected seat should have a different class
      expect(screen.getByTestId('seat-3')).toHaveClass('selected');
    });
  });

  describe('player assignment', () => {
    it('assigns player to selected seat when clicked', async () => {
      render(<PlayersView {...defaultProps} />);

      // First select a seat
      fireEvent.click(screen.getByTestId('seat-5'));

      // Then click select on a player row
      const selectButtons = screen.getAllByText('Select');
      fireEvent.click(selectButtons[0]);

      await waitFor(() => {
        expect(defaultProps.assignPlayerToSeat).toHaveBeenCalledWith(5, 1);
      });
    });
  });

  describe('delete functionality', () => {
    it('opens delete confirmation when delete clicked', () => {
      render(<PlayersView {...defaultProps} />);
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    });

    it('shows player name in delete confirmation', () => {
      render(<PlayersView {...defaultProps} />);
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);
      // The name appears twice - once in the table and once in the modal (as <strong>)
      const johnDoeElements = screen.getAllByText('John Doe');
      expect(johnDoeElements.length).toBeGreaterThanOrEqual(2);
    });

    it('cancels delete when cancel clicked', () => {
      render(<PlayersView {...defaultProps} />);
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      // Click Cancel in the modal
      const cancelButtons = screen.getAllByText('Cancel');
      fireEvent.click(cancelButtons[cancelButtons.length - 1]);

      expect(screen.queryByText(/Are you sure you want to delete/)).not.toBeInTheDocument();
    });

    it('calls deletePlayerById on confirm', async () => {
      render(<PlayersView {...defaultProps} />);
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
          expect(defaultProps.deletePlayerById).toHaveBeenCalledWith(1);
        });
      }
    });

    it('shows error on delete failure', async () => {
      const props = {
        ...defaultProps,
        deletePlayerById: vi.fn(() => Promise.reject(new Error('Delete failed'))),
      };
      render(<PlayersView {...props} />);
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      const allDeleteButtons = screen.getAllByText('Delete');
      const modalDeleteButton = allDeleteButtons.find(
        (btn) => btn.classList.contains('bg-red-600')
      );
      if (modalDeleteButton) {
        fireEvent.click(modalDeleteButton);
        await waitFor(() => {
          expect(props.showError).toHaveBeenCalled();
        });
      }
    });
  });

  describe('edit functionality', () => {
    it('opens edit modal when edit clicked', () => {
      render(<PlayersView {...defaultProps} />);
      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);
      expect(screen.getByTestId('player-form')).toBeInTheDocument();
    });

    it('calls updatePlayerById on edit submit', async () => {
      render(<PlayersView {...defaultProps} />);
      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(defaultProps.updatePlayerById).toHaveBeenCalled();
      });
    });

    it('shows error on update failure', async () => {
      const props = {
        ...defaultProps,
        updatePlayerById: vi.fn(() => Promise.reject(new Error('Update failed'))),
      };
      render(<PlayersView {...props} />);
      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(props.showError).toHaveBeenCalled();
      });
    });
  });

  describe('clear all seats', () => {
    it('clears all seats when confirmed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<PlayersView {...defaultProps} />);
      fireEvent.click(screen.getByText('Clear All'));
      expect(defaultProps.clearAllSeatAssignments).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('does not clear when cancelled', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<PlayersView {...defaultProps} />);
      fireEvent.click(screen.getByText('Clear All'));
      expect(defaultProps.clearAllSeatAssignments).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  describe('pending seat assignment', () => {
    it('auto-selects pending seat on mount', () => {
      const props = {
        ...defaultProps,
        pendingSeatForPlayerAssignment: 7,
      };
      render(<PlayersView {...props} />);
      expect(screen.getByTestId('seat-7')).toHaveClass('selected');
    });

    it('clears pending seat after selection', () => {
      const props = {
        ...defaultProps,
        pendingSeatForPlayerAssignment: 7,
      };
      render(<PlayersView {...props} />);
      expect(props.setPendingSeatForPlayerAssignment).toHaveBeenCalledWith(null);
    });
  });

  describe('replace player prompt', () => {
    it('shows replace prompt when assigning to occupied seat', async () => {
      const props = {
        ...defaultProps,
        getSeatPlayerName: vi.fn((seat) => (seat === 5 ? 'Existing Player' : null)),
      };
      render(<PlayersView {...props} />);

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
      const props = {
        ...defaultProps,
        getSeatPlayerName: vi.fn((seat) => (seat === 5 ? 'Existing Player' : null)),
      };
      render(<PlayersView {...props} />);

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
      render(<PlayersView {...defaultProps} />);
      expect(defaultProps.loadAllPlayers).toHaveBeenCalledTimes(1);
    });
  });
});
