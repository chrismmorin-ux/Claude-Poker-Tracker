/**
 * @file SelfCoachView — Self-Coach surface (Phase-5a slice).
 *
 * 2-tab IA (Curriculum / Settings) per docs/design/surfaces/self-coach-view.md
 * Phase-5a slice (WS-159 / SPR-042, 2026-05-06).
 *
 * Curriculum: tier-grouped concept tree with inline composition inspector.
 * Settings: owner-tier radio + signal toggles + signal weight sliders.
 *
 * Per chris-live-player.md autonomy red lines #5 + #8:
 *   - No streak / level-up / shame copy. Owner-volunteered grading only.
 *   - Source-util-policy whitelisted; never imported by live-table surfaces.
 *
 * Per feedback_scf_learning_state_not_tier_rank.md:
 *   - Rank labels (novice .. pro) render ONLY inside the owner-tier radio.
 *   - Tier indicators elsewhere stay numeric ("Tier 3").
 *   - Descriptor renders as a sentence, not a label.
 *
 * Phase-5b+ deferred: Hero-leaks aggregation, Tests-history-and-browse,
 * cadence-reminder controls.
 */

import React, { useState } from 'react';
import { useUI } from '../../../contexts';
import { CurriculumTab } from './CurriculumTab';
import { SettingsTab } from './SettingsTab';
import { TabBar } from './TabBar';

export const SelfCoachView = ({ scale: _scale }) => {
  const { setCurrentScreen, SCREEN } = useUI();
  const [activeTab, setActiveTab] = useState('curriculum');

  return (
    <div
      className="self-coach-view"
      role="main"
      data-testid="self-coach-view"
      style={{
        // Bounded height + scroll so content past the fold scrolls instead of
        // clipping under the body lock (was minHeight:100dvh → clipped). 2026-06-19.
        height: '100dvh',
        overflowY: 'auto',
        background: '#0f172a',
        color: '#e5e7eb',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid #1f2937',
        }}
      >
        <button
          type="button"
          onClick={() => setCurrentScreen(SCREEN.TABLE)}
          aria-label="Back to table"
          data-testid="self-coach-back"
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '0.5rem 0.75rem',
            background: '#1f2937',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            margin: 0,
            color: '#f3f4f6',
          }}
        >
          Self Coach
        </h1>
      </header>

      <TabBar activeTab={activeTab} onSelect={setActiveTab} />

      <div data-testid="self-coach-tab-body" style={{ marginTop: '1rem' }}>
        {activeTab === 'curriculum' ? <CurriculumTab /> : <SettingsTab />}
      </div>
    </div>
  );
};
