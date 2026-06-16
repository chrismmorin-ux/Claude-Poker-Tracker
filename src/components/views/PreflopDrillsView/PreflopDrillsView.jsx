/**
 * PreflopDrillsView.jsx — top-level view for the preflop equity trainer.
 *
 * Entered from the floating button in SessionsView. Offers four modes:
 *   - Explorer (v1):         pick two hands, see exact equity + frameworks.
 *   - Estimate Drill (v2):   guess equity, system reveals truth + frameworks.
 *   - Framework Drill (v2):  pick which frameworks apply; system grades.
 *   - Library (v2):          browse curated matchups by framework.
 *
 * v1 ships Explorer only; other tabs are placeholders wired for v2.
 */

import React, { useState, useRef, useCallback } from 'react';
import { ScaledContainer } from '../../ui/ScaledContainer';
import { useUI } from '../../../contexts';
import { DrillTabGuardProvider, confirmTabSwitch } from '../drillCommon/DrillTabGuard';
import { ExplorerMode } from './ExplorerMode';
import { EstimateMode } from './EstimateMode';
import { FrameworkMode } from './FrameworkMode';
import { LibraryMode } from './LibraryMode';
import { LessonsMode } from './LessonsMode';
import { ShapeMode } from './ShapeMode';
import { RecipeMode } from './RecipeMode';
import { MathMode } from './MathMode';

const TABS = [
  { id: 'shape',     label: 'Shape' },
  { id: 'recipe',    label: 'Recipe Drill' },
  { id: 'explorer',  label: 'Equity Lookup' },
  { id: 'estimate',  label: 'Estimate Drill' },
  { id: 'framework', label: 'Framework Drill' },
  { id: 'library',   label: 'Library' },
  { id: 'lessons',   label: 'Lessons' },
  { id: 'math',      label: 'Math' },
];

export const PreflopDrillsView = ({ scale }) => {
  const { setCurrentScreen, SCREEN } = useUI();
  const [activeTab, setActiveTab] = useState('shape');

  // Tab-switch guard (WS-229 F-DRILL-02): active-drill modes report unsaved progress
  // into progressRef; confirm before a switch that would discard it.
  const progressRef = useRef(false);
  const requestTab = useCallback((id) => {
    if (id === activeTab) return;
    if (!confirmTabSwitch(progressRef.current)) return;
    progressRef.current = false;
    setActiveTab(id);
  }, [activeTab]);

  return (
    <ScaledContainer scale={scale}>
      <DrillTabGuardProvider progressRef={progressRef}>
      <div className="w-full h-full bg-gray-900 flex flex-col" style={{ width: 1600, height: 720 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-6 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Preflop Drills</h1>
            <p className="text-sm text-gray-400 mt-1">
              Exact preflop equity trainer — build the mental model before the table builds it for you.
            </p>
          </div>
          <button
            onClick={() => setCurrentScreen(SCREEN.SESSIONS)}
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            ← Back to Sessions
          </button>
        </div>

        {/* Tabs */}
        <div className="px-8 border-b border-gray-800">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => requestTab(t.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                  activeTab === t.id
                    ? 'bg-gray-800 text-white border-t border-l border-r border-gray-700'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mode content */}
        <div className="flex-1 px-8 pt-6 pb-6 overflow-hidden">
          {activeTab === 'shape' && <ShapeMode />}
          {activeTab === 'recipe' && <RecipeMode />}
          {activeTab === 'explorer' && <ExplorerMode />}
          {activeTab === 'estimate' && <EstimateMode />}
          {activeTab === 'framework' && <FrameworkMode />}
          {activeTab === 'library' && <LibraryMode />}
          {activeTab === 'lessons' && <LessonsMode />}
          {activeTab === 'math' && <MathMode />}
        </div>
      </div>
      </DrillTabGuardProvider>
    </ScaledContainer>
  );
};
