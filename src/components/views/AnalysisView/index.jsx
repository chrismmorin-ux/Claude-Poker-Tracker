import React, { useState } from 'react';
import { ScaledContainer } from '../../ui/ScaledContainer';
import { LAYOUT } from '../../../constants/gameConstants';
import { useUI } from '../../../contexts';
import { PlayerAnalysisPanel } from './PlayerAnalysisPanel';
import { HandReviewPanel } from './HandReviewPanel';

const TABS = [
  { id: 'player', label: 'Player Analysis' },
  { id: 'review', label: 'Hand Review' },
];

export const AnalysisView = ({ scale, initialTab = 'player' }) => {
  const { setCurrentScreen, SCREEN } = useUI();
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <ScaledContainer scale={scale}>
      <div className="bg-gray-900 overflow-y-auto p-6" style={{ width: `${LAYOUT.TABLE_WIDTH}px`, height: `${LAYOUT.TABLE_HEIGHT}px` }}>
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white">Analysis</h2>
            {/* Tab bar */}
            <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-gray-700 text-indigo-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setCurrentScreen(SCREEN.TABLE)} className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg font-medium transition-colors">
            Back to Table
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'player' ? <PlayerAnalysisPanel /> : <HandReviewPanel />}
      </div>
    </ScaledContainer>
  );
};
