import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { BarChart3 } from 'lucide-react';
import { VENUES, GAME_TYPES, GAME_TYPE_KEYS } from '../../constants/sessionConstants';

/**
 * Get the position name for a seat relative to the dealer
 * Factors in absent seats when calculating positions
 *
 * @param {number} seat - The seat number to get position for
 * @param {number} dealerSeat - The dealer button seat
 * @param {Set<number>} absentSeats - Set of absent seat numbers
 * @param {number} numSeats - Total number of seats at the table
 * @param {boolean} abbreviated - Whether to return abbreviated position name
 * @returns {string} - Position name (Button, Small Blind, etc.)
 */
const getPositionName = (seat, dealerSeat, absentSeats, numSeats, abbreviated = false) => {
  if (!seat || !dealerSeat) return '';

  // Get the next active seat after a given seat
  const getNextActiveSeat = (fromSeat) => {
    let nextSeat = fromSeat;
    for (let i = 0; i < numSeats; i++) {
      nextSeat = (nextSeat % numSeats) + 1;
      if (!absentSeats.has(nextSeat)) {
        return nextSeat;
      }
    }
    return fromSeat; // Fallback if all seats are absent
  };

  // If the highlighted seat is absent, show "Absent"
  if (absentSeats.has(seat)) {
    return abbreviated ? 'ABS' : 'Absent';
  }

  // Button is always the dealer
  if (seat === dealerSeat) {
    return abbreviated ? 'BTN' : 'Button';
  }

  // Small blind is first active seat after dealer
  const sbSeat = getNextActiveSeat(dealerSeat);
  if (seat === sbSeat) {
    return abbreviated ? 'SB' : 'Small Blind';
  }

  // Big blind is first active seat after SB
  const bbSeat = getNextActiveSeat(sbSeat);
  if (seat === bbSeat) {
    return abbreviated ? 'BB' : 'Big Blind';
  }

  // Count active seats to determine positions
  // UTG is first to act preflop (after BB)
  // Then UTG+1, MP, Lojack, Hijack, Cutoff (clockwise before Button)

  // Build array of active seats in order from UTG to Cutoff
  const activeSeats = [];
  let currentSeat = getNextActiveSeat(bbSeat);

  while (currentSeat !== dealerSeat) {
    activeSeats.push(currentSeat);
    currentSeat = getNextActiveSeat(currentSeat);
    if (activeSeats.length > numSeats) break; // Safety check
  }

  const seatIndex = activeSeats.indexOf(seat);
  if (seatIndex === -1) return '';

  const totalMiddleSeats = activeSeats.length;

  // Position naming based on number of active seats between BB and Button
  // Standard 9-handed positions: UTG, UTG+1, MP, LJ, HJ, CO (6 seats between BB and BTN)
  if (totalMiddleSeats === 1) {
    return abbreviated ? 'CO' : 'Cutoff';
  } else if (totalMiddleSeats === 2) {
    const positions = abbreviated ? ['HJ', 'CO'] : ['Hijack', 'Cutoff'];
    return positions[seatIndex];
  } else if (totalMiddleSeats === 3) {
    const positions = abbreviated ? ['LJ', 'HJ', 'CO'] : ['Lojack', 'Hijack', 'Cutoff'];
    return positions[seatIndex];
  } else if (totalMiddleSeats === 4) {
    const positions = abbreviated ? ['MP', 'LJ', 'HJ', 'CO'] : ['Middle Position', 'Lojack', 'Hijack', 'Cutoff'];
    return positions[seatIndex];
  } else if (totalMiddleSeats === 5) {
    const positions = abbreviated ? ['UTG+1', 'MP', 'LJ', 'HJ', 'CO'] : ['UTG+1', 'Middle Position', 'Lojack', 'Hijack', 'Cutoff'];
    return positions[seatIndex];
  } else if (totalMiddleSeats >= 6) {
    // Full table: UTG, UTG+1, MP, LJ, HJ, CO
    const positions = abbreviated
      ? ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO']
      : ['Under the Gun', 'UTG+1', 'Middle Position', 'Lojack', 'Hijack', 'Cutoff'];
    if (seatIndex < positions.length) {
      return positions[seatIndex];
    }
    // More than 6 middle seats - use Early Position for extra seats
    return abbreviated ? 'EP' : 'Early Position';
  }

  return '';
};

/**
 * CollapsibleSidebar - Collapsible navigation sidebar for TableView
 * Shows navigation buttons (Stats, History, Sessions, Players) in a vertical sidebar
 * Displays highlighted seat and position info at the top
 * Can be collapsed to show only icons, or expanded to show full buttons
 */
export const CollapsibleSidebar = ({
  isCollapsed,
  onToggle,
  onNavigate,
  onSeatChange,
  SCREEN,
  selectedPlayers,
  dealerButtonSeat,
  absentSeats,
  numSeats,
  hasActiveSession,
  currentSessionVenue,
  currentSessionGameType,
  updateSessionField,
}) => {
  // Local editing state for venue and game type
  const [editingVenue, setEditingVenue] = useState(false);
  const [editingGameType, setEditingGameType] = useState(false);

  const navItems = [
    { screen: SCREEN.STATS, label: 'Stats', icon: <BarChart3 size={20} />, color: 'bg-blue-600 hover:bg-blue-700' },
    { screen: SCREEN.HISTORY, label: 'Hand History', icon: '📚', color: 'bg-purple-600 hover:bg-purple-700' },
    { screen: SCREEN.SESSIONS, label: 'Sessions', icon: '🎯', color: 'bg-orange-600 hover:bg-orange-700' },
    { screen: SCREEN.PLAYERS, label: 'Players', icon: '👥', color: 'bg-teal-600 hover:bg-teal-700' },
  ];

  // Get highlighted seat info
  const highlightedSeat = selectedPlayers.length === 1 ? selectedPlayers[0] : null;
  const positionName = highlightedSeat
    ? getPositionName(highlightedSeat, dealerButtonSeat, absentSeats, numSeats, isCollapsed)
    : '';

  // Navigate to previous seat (wrapping around)
  const handlePrevSeat = () => {
    if (!highlightedSeat) return;
    const prevSeat = highlightedSeat === 1 ? numSeats : highlightedSeat - 1;
    onSeatChange(prevSeat);
  };

  // Navigate to next seat (wrapping around)
  const handleNextSeat = () => {
    if (!highlightedSeat) return;
    const nextSeat = highlightedSeat === numSeats ? 1 : highlightedSeat + 1;
    onSeatChange(nextSeat);
  };

  return (
    <div
      className={`absolute left-0 top-0 h-full bg-black bg-opacity-60 flex flex-col transition-all duration-300 z-40 ${
        isCollapsed ? 'w-14' : 'w-36'
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="w-full py-3 px-2 bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg flex items-center justify-center"
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? '▶' : '◀'}
      </button>

      {/* Seat Position Display - Top of sidebar */}
      <div className={`flex flex-col items-center py-4 border-b border-gray-600 ${isCollapsed ? 'px-1' : 'px-2'}`}>
        {highlightedSeat ? (
          <>
            <div className={`text-white font-bold ${isCollapsed ? 'text-lg' : 'text-2xl'}`}>
              {isCollapsed ? highlightedSeat : `Seat ${highlightedSeat}`}
            </div>
            {positionName && (
              <div className={`text-yellow-400 font-semibold text-center leading-tight ${isCollapsed ? 'text-xs' : 'text-sm'}`}>
                {positionName}
              </div>
            )}
            {/* Seat Navigation Buttons - only when expanded */}
            {!isCollapsed && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handlePrevSeat}
                  className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded font-bold text-sm"
                  title="Previous seat"
                >
                  ◀
                </button>
                <button
                  onClick={handleNextSeat}
                  className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded font-bold text-sm"
                  title="Next seat"
                >
                  ▶
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={`text-gray-400 text-center ${isCollapsed ? 'text-xs' : 'text-sm'}`}>
            {isCollapsed ? '—' : 'No seat selected'}
          </div>
        )}
      </div>

      {/* Session Info - when active session exists */}
      {hasActiveSession && (
        <div className={`flex flex-col gap-2 py-3 border-b border-gray-600 ${isCollapsed ? 'px-1' : 'px-2'}`}>
          {/* Venue */}
          <div className="flex flex-col">
            {!isCollapsed && (
              <div className="text-gray-400 text-xs mb-1">Venue</div>
            )}
            {editingVenue && !isCollapsed ? (
              <select
                value={currentSessionVenue || ''}
                onChange={(e) => {
                  updateSessionField('venue', e.target.value);
                  setEditingVenue(false);
                }}
                onBlur={() => setEditingVenue(false)}
                className="px-2 py-1 text-sm bg-gray-700 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                autoFocus
              >
                {VENUES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            ) : (
              <button
                onClick={() => !isCollapsed && setEditingVenue(true)}
                className={`text-left text-green-400 font-medium hover:text-green-300 transition-colors ${isCollapsed ? 'text-xs text-center' : 'text-sm'}`}
                title={isCollapsed ? `Venue: ${currentSessionVenue}` : 'Click to change venue'}
              >
                {isCollapsed ? '📍' : (currentSessionVenue || 'Set venue')}
              </button>
            )}
          </div>

          {/* Game Type */}
          <div className="flex flex-col">
            {!isCollapsed && (
              <div className="text-gray-400 text-xs mb-1">Game</div>
            )}
            {editingGameType && !isCollapsed ? (
              <select
                value={GAME_TYPE_KEYS.find(key => GAME_TYPES[key].label === currentSessionGameType) || ''}
                onChange={(e) => {
                  const gameTypeLabel = GAME_TYPES[e.target.value]?.label;
                  if (gameTypeLabel) {
                    updateSessionField('gameType', gameTypeLabel);
                  }
                  setEditingGameType(false);
                }}
                onBlur={() => setEditingGameType(false)}
                className="px-2 py-1 text-sm bg-gray-700 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                autoFocus
              >
                {GAME_TYPE_KEYS.map((key) => (
                  <option key={key} value={key}>{GAME_TYPES[key].label}</option>
                ))}
              </select>
            ) : (
              <button
                onClick={() => !isCollapsed && setEditingGameType(true)}
                className={`text-left text-green-400 font-medium hover:text-green-300 transition-colors ${isCollapsed ? 'text-xs text-center' : 'text-sm'}`}
                title={isCollapsed ? `Game: ${currentSessionGameType}` : 'Click to change game type'}
              >
                {isCollapsed ? '🎰' : (currentSessionGameType || 'Set game')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Spacer to push nav items to bottom */}
      <div className="flex-1" />

      {/* Navigation Items - Bottom of sidebar */}
      <div className="flex flex-col gap-2 p-2 pb-4">
        {navItems.map(({ screen, label, icon, color }) => (
          <button
            key={screen}
            onClick={() => onNavigate(screen)}
            className={`${color} text-white rounded-lg flex items-center gap-2 transition-all ${
              isCollapsed ? 'px-2 py-3 justify-center' : 'px-3 py-3'
            }`}
            title={isCollapsed ? label : undefined}
          >
            <span className="text-lg">{icon}</span>
            {!isCollapsed && <span className="font-semibold text-sm">{label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

CollapsibleSidebar.propTypes = {
  isCollapsed: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onNavigate: PropTypes.func.isRequired,
  onSeatChange: PropTypes.func.isRequired,
  SCREEN: PropTypes.object.isRequired,
  selectedPlayers: PropTypes.arrayOf(PropTypes.number).isRequired,
  dealerButtonSeat: PropTypes.number.isRequired,
  absentSeats: PropTypes.instanceOf(Set).isRequired,
  numSeats: PropTypes.number.isRequired,
  hasActiveSession: PropTypes.bool,
  currentSessionVenue: PropTypes.string,
  currentSessionGameType: PropTypes.string,
  updateSessionField: PropTypes.func,
};
