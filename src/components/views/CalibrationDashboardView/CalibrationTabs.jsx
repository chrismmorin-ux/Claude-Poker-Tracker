/**
 * CalibrationTabs — inline tab bar for `CalibrationDashboardView`.
 *
 * Three tabs: Predicates / Anchors / Primitives. Default = Anchors per Gate 4
 * spec line 148-150. Inline implementation (no shared `<Tabs>` component) —
 * matches SelfCoachView/AnalysisView precedent. Active-tab state is owned by
 * `useCalibrationDashboard` (localStorage-persisted).
 *
 * EAL Phase 6 — WS-169 / SPR-066.
 */

import React from 'react';

const TABS = Object.freeze([
  { id: 'predicates', label: 'Predicates' },
  { id: 'anchors', label: 'Anchors' },
  { id: 'primitives', label: 'Primitives' },
]);

export const CalibrationTabs = ({ activeTab, onChange }) => {
  return (
    <div
      data-testid="calibration-tabs"
      role="tablist"
      aria-label="Calibration dashboard sections"
      style={{
        display: 'flex',
        gap: '0.25rem',
        marginBottom: '0.75rem',
        borderBottom: '1px solid #1f2937',
        paddingBottom: '0.25rem',
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`calibration-panel-${tab.id}`}
            data-testid={`calibration-tab-${tab.id}`}
            onClick={() => {
              if (typeof onChange === 'function') onChange(tab.id);
            }}
            style={{
              minHeight: 44,
              padding: '0.5rem 0.875rem',
              background: isActive ? '#374151' : 'transparent',
              color: isActive ? '#e5e7eb' : '#9ca3af',
              border: '1px solid',
              borderColor: isActive ? '#4b5563' : 'transparent',
              borderRadius: '0.25rem 0.25rem 0 0',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: isActive ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default CalibrationTabs;
