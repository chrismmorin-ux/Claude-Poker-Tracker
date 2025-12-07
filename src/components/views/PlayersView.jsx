/**
 * PlayersView.jsx - Player management view
 *
 * Displays all players with search, filter, and CRUD operations.
 * Pattern follows SessionsView.jsx structure.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { PlayerForm } from '../ui/PlayerForm';
import { PlayerFilters } from '../ui/PlayerFilters';
import { PlayerRow } from '../ui/PlayerRow';
import { SeatGrid } from '../ui/SeatGrid';
import { LIMITS } from '../../constants/gameConstants';

/**
 * PlayersView component
 * @param {Object} props
 * @param {Function} props.onBackToTable - Callback to return to table view
 * @param {Object} props.playerState - Player state from reducer
 * @param {Function} props.createNewPlayer - Create new player function
 * @param {Function} props.updatePlayerById - Update player function
 * @param {Function} props.deletePlayerById - Delete player function
 * @param {Function} props.loadAllPlayers - Load all players function
 * @param {Function} props.assignPlayerToSeat - Assign player to seat function
 * @param {Function} props.clearSeatAssignment - Clear seat assignment function
 * @param {Function} props.getSeatPlayerName - Get player name for seat function
 * @param {Function} props.isPlayerAssigned - Check if player is assigned
 * @param {Function} props.getPlayerSeat - Get seat number for player
 * @param {Function} props.clearAllSeatAssignments - Clear all seat assignments
 * @param {number|null} props.pendingSeatForPlayerAssignment - Seat waiting for player assignment
 * @param {Function} props.setPendingSeatForPlayerAssignment - Clear pending seat
 * @param {number} props.scale - Scale factor for responsive design
 */
export const PlayersView = ({
  onBackToTable,
  playerState,
  createNewPlayer,
  updatePlayerById,
  deletePlayerById,
  loadAllPlayers,
  assignPlayerToSeat,
  clearSeatAssignment,
  getSeatPlayerName,
  isPlayerAssigned,
  getPlayerSeat,
  clearAllSeatAssignments,
  pendingSeatForPlayerAssignment,
  setPendingSeatForPlayerAssignment,
  scale = 1,
  showError
}) => {
  // State
  const [showNewPlayerModal, setShowNewPlayerModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [deletingPlayer, setDeletingPlayer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterBuild, setFilterBuild] = useState('');
  const [filterEthnicity, setFilterEthnicity] = useState('');
  const [filterFacialHair, setFilterFacialHair] = useState('');
  const [filterHat, setFilterHat] = useState(''); // '', 'yes', 'no'
  const [filterSunglasses, setFilterSunglasses] = useState(''); // '', 'yes', 'no'
  const [sortBy, setSortBy] = useState('lastSeen'); // 'lastSeen', 'name', 'handCount'
  const [lastCreatedPlayerId, setLastCreatedPlayerId] = useState(null);
  const [showPendingAssignmentPrompt, setShowPendingAssignmentPrompt] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(null); // Seat selected for assignment
  const [draggedPlayerId, setDraggedPlayerId] = useState(null);
  const [showReplacePrompt, setShowReplacePrompt] = useState(false);
  const [replacePromptData, setReplacePromptData] = useState(null); // { playerId, targetSeat }

  // Load players on mount
  useEffect(() => {
    loadAllPlayers();
  }, [loadAllPlayers]);

  // Auto-select seat when navigating from context menu
  useEffect(() => {
    if (pendingSeatForPlayerAssignment && !selectedSeat) {
      setSelectedSeat(pendingSeatForPlayerAssignment);
      setPendingSeatForPlayerAssignment(null);
    }
  }, [pendingSeatForPlayerAssignment, selectedSeat, setPendingSeatForPlayerAssignment]);

  // Handle pending seat assignment when a new player is created
  useEffect(() => {
    if (lastCreatedPlayerId && pendingSeatForPlayerAssignment) {
      setShowPendingAssignmentPrompt(true);
    }
  }, [lastCreatedPlayerId, pendingSeatForPlayerAssignment]);

  // Filtered and sorted players
  const filteredPlayers = useMemo(() => {
    let result = [...playerState.allPlayers];

    // Filter by search term (name or nickname)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.nickname && p.nickname.toLowerCase().includes(term))
      );
    }

    // Filter by style tag
    if (filterTag) {
      result = result.filter(p =>
        p.styleTags && p.styleTags.includes(filterTag)
      );
    }

    // Filter by gender
    if (filterGender) {
      result = result.filter(p => p.gender === filterGender);
    }

    // Filter by build
    if (filterBuild) {
      result = result.filter(p => p.build === filterBuild);
    }

    // Filter by ethnicity
    if (filterEthnicity) {
      result = result.filter(p => p.ethnicity === filterEthnicity);
    }

    // Filter by facial hair
    if (filterFacialHair) {
      result = result.filter(p => p.facialHair === filterFacialHair);
    }

    // Filter by hat
    if (filterHat === 'yes') {
      result = result.filter(p => p.hat === true);
    } else if (filterHat === 'no') {
      result = result.filter(p => !p.hat);
    }

    // Filter by sunglasses
    if (filterSunglasses === 'yes') {
      result = result.filter(p => p.sunglasses === true);
    } else if (filterSunglasses === 'no') {
      result = result.filter(p => !p.sunglasses);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'lastSeen') {
        return (b.lastSeenAt || 0) - (a.lastSeenAt || 0);
      } else if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'handCount') {
        return (b.handCount || 0) - (a.handCount || 0);
      }
      return 0;
    });

    return result;
  }, [playerState.allPlayers, searchTerm, filterTag, filterGender, filterBuild, filterEthnicity, filterFacialHair, filterHat, filterSunglasses, sortBy]);

  // Handlers
  const handleCreatePlayer = async (playerData) => {
    try {
      const playerId = await createNewPlayer(playerData);
      setShowNewPlayerModal(false);
      setLastCreatedPlayerId(playerId);

      // If a seat is selected, assign the new player to it
      if (selectedSeat) {
        const currentPlayerInSeat = getSeatPlayerName(selectedSeat);
        if (currentPlayerInSeat) {
          // Seat is occupied, show replace prompt
          setReplacePromptData({ playerId, targetSeat: selectedSeat });
          setShowReplacePrompt(true);
        } else {
          // Seat is empty, assign directly
          assignPlayerToSeat(selectedSeat, playerId);
          // Auto-advance to next empty seat
          const nextSeat = findNextEmptySeat(selectedSeat + 1);
          setSelectedSeat(nextSeat);
        }
      }

      // Clear search and filters
      setSearchTerm('');
      setFilterTag('');
      setFilterGender('');
      setFilterBuild('');
      setFilterEthnicity('');
      setFilterFacialHair('');
      setFilterHat('');
      setFilterSunglasses('');
    } catch (error) {
      showError(`Failed to create player: ${error.message}`);
    }
  };

  const handleAssignPendingPlayer = () => {
    if (lastCreatedPlayerId && pendingSeatForPlayerAssignment) {
      assignPlayerToSeat(pendingSeatForPlayerAssignment, lastCreatedPlayerId);
      setShowPendingAssignmentPrompt(false);
      setLastCreatedPlayerId(null);
      setPendingSeatForPlayerAssignment(null);
    }
  };

  const handleDismissPendingAssignment = () => {
    setShowPendingAssignmentPrompt(false);
    setLastCreatedPlayerId(null);
    setPendingSeatForPlayerAssignment(null);
  };

  // Find next empty seat (using LIMITS.NUM_SEATS instead of hardcoded 9)
  const findNextEmptySeat = (startSeat = 1) => {
    for (let i = 0; i < LIMITS.NUM_SEATS; i++) {
      const seat = ((startSeat - 1 + i) % LIMITS.NUM_SEATS) + 1;
      if (!getSeatPlayerName(seat)) {
        return seat;
      }
    }
    return null; // All seats occupied
  };

  const handleSeatClick = (seat) => {
    setSelectedSeat(seat);
  };

  const handlePlayerClick = (playerId) => {
    if (!selectedSeat) return;

    // Check if the selected seat is already occupied
    const currentPlayerInSeat = getSeatPlayerName(selectedSeat);
    if (currentPlayerInSeat) {
      // Seat is occupied, show replace prompt
      setReplacePromptData({ playerId, targetSeat: selectedSeat });
      setShowReplacePrompt(true);
      return;
    }

    // Seat is empty - check if player is already assigned to another seat
    const currentSeat = getPlayerSeat(playerId);
    if (currentSeat && currentSeat !== selectedSeat) {
      // Move player from current seat to new seat
      clearSeatAssignment(currentSeat);
    }

    assignPlayerToSeat(selectedSeat, playerId);

    // Auto-advance to next empty seat
    const nextSeat = findNextEmptySeat(selectedSeat + 1);
    if (nextSeat) {
      setSelectedSeat(nextSeat);
    } else {
      setSelectedSeat(null); // All seats filled
    }
  };

  const handleDragStart = (playerId) => {
    setDraggedPlayerId(playerId);
  };

  const handleDragEnd = () => {
    setDraggedPlayerId(null);
  };

  const handleDrop = (seat) => {
    if (!draggedPlayerId) return;

    const currentPlayerInSeat = getSeatPlayerName(seat);

    if (currentPlayerInSeat) {
      // Seat is occupied, show replace prompt
      setReplacePromptData({ playerId: draggedPlayerId, targetSeat: seat });
      setShowReplacePrompt(true);
    } else {
      // Seat is empty, assign directly
      const currentSeat = getPlayerSeat(draggedPlayerId);
      if (currentSeat) {
        clearSeatAssignment(currentSeat);
      }
      assignPlayerToSeat(seat, draggedPlayerId);
    }

    setDraggedPlayerId(null);
  };

  const handleSeatDragStart = (seat) => {
    const playerId = playerState.seatPlayers[seat];
    if (playerId) {
      setDraggedPlayerId(playerId);
    }
  };

  const handleSeatDragEnd = () => {
    setDraggedPlayerId(null);
  };

  const handleConfirmReplace = () => {
    if (replacePromptData) {
      const { playerId, targetSeat } = replacePromptData;
      const currentSeat = getPlayerSeat(playerId);

      // Clear old assignment
      if (currentSeat) {
        clearSeatAssignment(currentSeat);
      }

      // Clear target seat and assign new player
      clearSeatAssignment(targetSeat);
      assignPlayerToSeat(targetSeat, playerId);

      setShowReplacePrompt(false);
      setReplacePromptData(null);
    }
  };

  const handleCancelReplace = () => {
    setShowReplacePrompt(false);
    setReplacePromptData(null);
  };

  const handleClearAllSeats = () => {
    if (confirm('Clear all seat assignments? This will not delete any players.')) {
      clearAllSeatAssignments();
      setSelectedSeat(null);
    }
  };

  const handleEditPlayer = async (playerData) => {
    try {
      await updatePlayerById(editingPlayer.playerId, playerData);
      setEditingPlayer(null);
    } catch (error) {
      showError(`Failed to update player: ${error.message}`);
    }
  };

  const handleDeletePlayer = async () => {
    try {
      await deletePlayerById(deletingPlayer.playerId);
      setDeletingPlayer(null);
    } catch (error) {
      showError(`Failed to delete player: ${error.message}`);
    }
  };

  // Get unique style tags from all players for filter dropdown
  const allStyleTags = useMemo(() => {
    const tags = new Set();
    playerState.allPlayers.forEach(p => {
      if (p.styleTags) {
        p.styleTags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  }, [playerState.allPlayers]);

  return (
    <div className="w-full h-full bg-gray-100 overflow-auto">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToTable}
              className="flex items-center gap-1 px-3 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            >
              <ChevronLeft size={18} />
              Table View
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Player Management</h1>
          </div>

          <button
            onClick={() => setShowNewPlayerModal(true)}
            className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors font-medium"
          >
            + New Player
          </button>
        </div>

        {/* Search, Sort, and Filters */}
        <PlayerFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sortBy={sortBy}
          setSortBy={setSortBy}
          filterGender={filterGender}
          setFilterGender={setFilterGender}
          filterBuild={filterBuild}
          setFilterBuild={setFilterBuild}
          filterEthnicity={filterEthnicity}
          setFilterEthnicity={setFilterEthnicity}
          filterFacialHair={filterFacialHair}
          setFilterFacialHair={setFilterFacialHair}
          filterHat={filterHat}
          setFilterHat={setFilterHat}
          filterSunglasses={filterSunglasses}
          setFilterSunglasses={setFilterSunglasses}
          filterTag={filterTag}
          setFilterTag={setFilterTag}
          allStyleTags={allStyleTags}
        />

        {/* Stats */}
        <div className="mt-3 text-sm text-gray-600">
          Showing {filteredPlayers.length} of {playerState.allPlayers.length} players
        </div>
      </div>

      {/* Seat Management Section */}
      <SeatGrid
        selectedSeat={selectedSeat}
        getSeatPlayerName={getSeatPlayerName}
        onSeatClick={handleSeatClick}
        onClearSeat={clearSeatAssignment}
        onClearAllSeats={handleClearAllSeats}
        onSeatDragStart={handleSeatDragStart}
        onSeatDragEnd={handleSeatDragEnd}
        onDrop={handleDrop}
      />

      {/* Player List */}
      <div className="p-4">
        {filteredPlayers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              {playerState.allPlayers.length === 0
                ? 'No players yet. Click "New Player" to create one.'
                : 'No players match your search criteria.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Style</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Hands</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Last Seen</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPlayers.map(player => (
                  <PlayerRow
                    key={player.playerId}
                    player={player}
                    assignedSeat={getPlayerSeat(player.playerId)}
                    isSelecting={!!selectedSeat}
                    onDragStart={() => handleDragStart(player.playerId)}
                    onDragEnd={handleDragEnd}
                    onClick={() => selectedSeat && handlePlayerClick(player.playerId)}
                    onEdit={() => setEditingPlayer(player)}
                    onDelete={() => setDeletingPlayer(player)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Player Modal */}
      {showNewPlayerModal && (
        <PlayerForm
          onSubmit={handleCreatePlayer}
          onCancel={() => setShowNewPlayerModal(false)}
          scale={scale}
          defaultName={searchTerm}
        />
      )}

      {/* Edit Player Modal */}
      {editingPlayer && (
        <PlayerForm
          onSubmit={handleEditPlayer}
          onCancel={() => setEditingPlayer(null)}
          scale={scale}
          initialData={editingPlayer}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingPlayer && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setDeletingPlayer(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-[90vw] max-w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Delete Player</h2>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete <strong>{deletingPlayer.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingPlayer(null)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePlayer}
                className="px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Assignment Prompt */}
      {showPendingAssignmentPrompt && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={handleDismissPendingAssignment}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-[90vw] max-w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Assign to Seat?</h2>
            <p className="text-gray-700 mb-6">
              Would you like to assign the newly created player to Seat {pendingSeatForPlayerAssignment}?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDismissPendingAssignment}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                No, Skip
              </button>
              <button
                onClick={handleAssignPendingPlayer}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors font-medium"
              >
                Yes, Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace Prompt */}
      {showReplacePrompt && replacePromptData && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={handleCancelReplace}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-[90vw] max-w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Replace Player?</h2>
            <p className="text-gray-700 mb-6">
              Seat {replacePromptData.targetSeat} is already occupied by{' '}
              <strong>{getSeatPlayerName(replacePromptData.targetSeat)}</strong>.
              Replace them with the dragged player?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelReplace}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReplace}
                className="px-4 py-2 text-white bg-orange-600 rounded hover:bg-orange-700 transition-colors font-medium"
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
