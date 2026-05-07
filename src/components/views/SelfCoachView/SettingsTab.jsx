/**
 * @file SettingsTab — owner-tier radio + signal toggles + signal weight
 * sliders for SelfCoachView.
 *
 * Three sub-sections, each in its own self-contained block (matches the
 * pattern at src/components/views/SettingsView/PrivacySection.jsx).
 *
 * Per Phase-5a Gate 1 / Gate 4 update — cadence-reminder controls
 * deferred to Phase-5b.
 *
 * SPR-042 / WS-159 (2026-05-06).
 */

import React from 'react';
import { OwnerTierRadio } from './OwnerTierRadio';
import { SignalToggleControls } from './SignalToggleControls';
import { SignalWeightSliders } from './SignalWeightSliders';

export const SettingsTab = () => {
  return (
    <div data-testid="self-coach-settings-tab" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <OwnerTierRadio />
      <SignalToggleControls />
      <SignalWeightSliders />
    </div>
  );
};
