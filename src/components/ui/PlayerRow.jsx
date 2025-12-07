/**
 * PlayerRow.jsx - Single player row in the player table
 *
 * Extracted from PlayersView.jsx for better maintainability.
 */

import React from 'react';

/**
 * Get description summary from player data
 * @param {Object} player - Player object
 * @returns {string} Description summary
 */
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

/**
 * Format relative time from timestamp
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted relative time
 */
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

/**
 * PlayerRow - Single row in the player table
 *
 * @param {Object} props
 * @param {Object} props.player - Player data object
 * @param {number|null} props.assignedSeat - Seat number if assigned, null otherwise
 * @param {boolean} props.isSelecting - Whether a seat is currently selected for assignment
 * @param {Function} props.onDragStart - Drag start handler
 * @param {Function} props.onDragEnd - Drag end handler
 * @param {Function} props.onClick - Click handler (for seat assignment)
 * @param {Function} props.onEdit - Edit button handler
 * @param {Function} props.onDelete - Delete button handler
 */
export const PlayerRow = ({
  player,
  assignedSeat,
  isSelecting,
  onDragStart,
  onDragEnd,
  onClick,
  onEdit,
  onDelete
}) => {
  const isAssigned = assignedSeat !== null;

  return (
    <tr
      className={`transition-colors ${
        isAssigned ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
      } ${isSelecting ? 'cursor-pointer' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
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
              onEdit();
            }}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
};

export default PlayerRow;
