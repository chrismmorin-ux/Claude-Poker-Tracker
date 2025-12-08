import React from 'react';
import PropTypes from 'prop-types';

/**
 * CollapsibleSidebar - Collapsible navigation sidebar for TableView
 * Shows navigation buttons (Stats, History, Sessions, Players) in a vertical sidebar
 * Can be collapsed to show only icons, or expanded to show full buttons
 */
export const CollapsibleSidebar = ({
  isCollapsed,
  onToggle,
  onNavigate,
  SCREEN,
  BarChart3,
}) => {
  const navItems = [
    { screen: SCREEN.STATS, label: 'Stats', icon: <BarChart3 size={20} />, color: 'bg-blue-600 hover:bg-blue-700' },
    { screen: SCREEN.HISTORY, label: 'History', icon: '📚', color: 'bg-purple-600 hover:bg-purple-700' },
    { screen: SCREEN.SESSIONS, label: 'Sessions', icon: '🎯', color: 'bg-orange-600 hover:bg-orange-700' },
    { screen: SCREEN.PLAYERS, label: 'Players', icon: '👥', color: 'bg-teal-600 hover:bg-teal-700' },
  ];

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

      {/* Navigation Items */}
      <div className="flex-1 flex flex-col gap-2 p-2 pt-4">
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
  SCREEN: PropTypes.object.isRequired,
  BarChart3: PropTypes.elementType.isRequired,
};
