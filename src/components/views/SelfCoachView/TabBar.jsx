/**
 * @file TabBar — Curriculum / Settings tab switcher for SelfCoachView.
 *
 * Local view-state tabs (not in uiReducer). Button-pair pattern with
 * aria-pressed mirrors the toggle pattern from PrivacySection.jsx:44-70.
 */

import React from 'react';

const TABS = [
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'settings', label: 'Settings' },
];

export const TabBar = ({ activeTab, onSelect }) => {
  return (
    <div
      role="tablist"
      aria-label="Self-Coach tabs"
      data-testid="self-coach-tabbar"
      style={{ display: 'flex', gap: '0.5rem' }}
    >
      {TABS.map(({ id, label }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-pressed={active}
            data-testid={`self-coach-tab-${id}`}
            onClick={() => onSelect(id)}
            style={{
              minHeight: 44,
              padding: '0.5rem 1rem',
              background: active ? '#7c3aed' : '#1f2937',
              color: active ? '#ffffff' : '#d1d5db',
              border: '1px solid #374151',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: active ? 600 : 500,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
