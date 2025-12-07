/**
 * PlayersView.jsx - Player management view
 *
 * Displays all players with search, filter, and CRUD operations.
 * Pattern follows SessionsView.jsx structure.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { PlayerForm } from '../ui/PlayerForm';
import {
  ETHNICITY_OPTIONS,
  BUILD_OPTIONS,
  GENDER_OPTIONS,
  FACIAL_HAIR_OPTIONS
} from '../../constants/playerConstants';
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
  scale = 1
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
      alert(`Failed to create player: ${error.message}`);
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
      alert(`Failed to update player: ${error.message}`);
    }
  };

  const handleDeletePlayer = async () => {
    try {
      await deletePlayerById(deletingPlayer.playerId);
      setDeletingPlayer(null);
    } catch (error) {
      alert(`Failed to delete player: ${error.message}`);
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

  // Format relative time
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      const date = new Date(timestamp);
      return date.toLocaleDateString();
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  // Build description summary
  const getDescriptionSummary = (player) => {
    const parts = [];
    if (player.ethnicity) parts.push(player.ethnicity);
    if (player.gender) parts.push(player.gender);
    if (player.build) parts.push(player.build);
    if (player.facialHair && player.facialHair !== 'Clean-shaven') parts.push(player.facialHair);
    if (player.hat) parts.push('Hat');
    if (player.sunglasses) parts.push('Sunglasses');
    return parts.length > 0 ? parts.join(', ') : 'No description';
  };

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

        {/* Search and Sort */}
        <div className="mt-4 flex gap-3 items-center">
          {/* Search */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or nickname..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
          >
            <option value="lastSeen">Last Seen</option>
            <option value="name">Name</option>
            <option value="handCount">Hand Count</option>
          </select>
        </div>

        {/* Physical Feature Filters */}
        <div className="mt-3 grid grid-cols-7 gap-2">
          {/* Gender */}
          <select
            value={filterGender}
            onChange={(e) => setFilterGender(e.target.value)}
            className="px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">All Genders</option>
            {GENDER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Build */}
          <select
            value={filterBuild}
            onChange={(e) => setFilterBuild(e.target.value)}
            className="px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">All Builds</option>
            {BUILD_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Ethnicity */}
          <select
            value={filterEthnicity}
            onChange={(e) => setFilterEthnicity(e.target.value)}
            className="px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">All Ethnicities</option>
            {ETHNICITY_OPTIONS.map(eth => (
              <option key={eth} value={eth}>{eth}</option>
            ))}
          </select>

          {/* Facial Hair */}
          <select
            value={filterFacialHair}
            onChange={(e) => setFilterFacialHair(e.target.value)}
            className="px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">All Facial Hair</option>
            {FACIAL_HAIR_OPTIONS.map(fh => (
              <option key={fh} value={fh}>{fh}</option>
            ))}
          </select>

          {/* Hat */}
          <select
            value={filterHat}
            onChange={(e) => setFilterHat(e.target.value)}
            className="px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Hat?</option>
            <option value="yes">Wears Hat</option>
            <option value="no">No Hat</option>
          </select>

          {/* Sunglasses */}
          <select
            value={filterSunglasses}
            onChange={(e) => setFilterSunglasses(e.target.value)}
            className="px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Sunglasses?</option>
            <option value="yes">Wears Sunglasses</option>
            <option value="no">No Sunglasses</option>
          </select>

          {/* Style Tag */}
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">All Styles</option>
            {allStyleTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="mt-3 text-sm text-gray-600">
          Showing {filteredPlayers.length} of {playerState.allPlayers.length} players
        </div>
      </div>

      {/* Seat Management Section */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Current Seat Assignments</h2>
          <button
            onClick={handleClearAllSeats}
            className="px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700 transition-colors font-medium"
          >
            Clear All Seats
          </button>
        </div>
        <div className="grid grid-cols-9 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(seat => {
            const playerName = getSeatPlayerName(seat);
            const isSelected = selectedSeat === seat;
            return (
              <div
                key={seat}
                className={`border-2 rounded-lg p-3 text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border-yellow-400 bg-yellow-50 ring-4 ring-yellow-400 scale-110'
                    : playerName
                    ? 'border-blue-500 bg-blue-50 hover:bg-blue-100'
                    : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}
                draggable={!!playerName}
                onClick={() => handleSeatClick(seat)}
                onDragStart={() => handleSeatDragStart(seat)}
                onDragEnd={handleSeatDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(seat);
                }}
              >
                <div className="text-xs font-semibold text-gray-600 mb-1">
                  Seat {seat}
                </div>
                {playerName ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-sm font-semibold text-blue-800 truncate w-full" title={playerName}>
                      {playerName}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearSeatAssignment(seat);
                      }}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">
                    {isSelected ? 'Click player below' : 'Empty'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {selectedSeat && (
          <div className="mt-2 text-sm text-green-700 font-medium text-center">
            Seat {selectedSeat} selected - Click a player below to assign
          </div>
        )}
      </div>

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
                {filteredPlayers.map(player => {
                  const assignedSeat = getPlayerSeat(player.playerId);
                  const isAssigned = assignedSeat !== null;

                  return (
                    <tr
                      key={player.playerId}
                      className={`transition-colors ${
                        isAssigned ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                      } ${selectedSeat ? 'cursor-pointer' : ''}`}
                      draggable
                      onDragStart={() => handleDragStart(player.playerId)}
                      onDragEnd={handleDragEnd}
                      onClick={() => selectedSeat && handlePlayerClick(player.playerId)}
                    >
                      {/* Player */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {/* Seat Number Badge */}
                          {isAssigned && (
                            <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded font-bold text-sm flex-shrink-0">
                              {assignedSeat}
                            </div>
                          )}
                          {/* Avatar */}
                          {player.avatar ? (
                            <img
                              src={player.avatar}
                              alt={player.name}
                              className="w-10 h-10 rounded-full object-cover border border-gray-300 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold flex-shrink-0">
                              {player.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {/* Name */}
                          <div>
                            <div className="font-semibold text-gray-800">{player.name}</div>
                            {player.nickname && (
                              <div className="text-xs text-gray-500">"{player.nickname}"</div>
                            )}
                          </div>
                        </div>
                      </td>

                    {/* Description */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600">
                        {getDescriptionSummary(player)}
                      </div>
                    </td>

                    {/* Style Tags */}
                    <td className="px-4 py-3">
                      {player.styleTags && player.styleTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {player.styleTags.slice(0, 2).map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {player.styleTags.length > 2 && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                              +{player.styleTags.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    {/* Hand Count */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{player.handCount || 0}</div>
                    </td>

                    {/* Last Seen */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600">{formatRelativeTime(player.lastSeenAt)}</div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPlayer(player);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingPlayer(player);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
