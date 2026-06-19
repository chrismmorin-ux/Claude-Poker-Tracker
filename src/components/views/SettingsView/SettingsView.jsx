import React, { useCallback } from 'react';
import { useSettings, useAuth, useUI, useToast } from '../../../contexts';
import { AccountSection } from '../../ui/AccountSection';
import { EmailVerificationBanner } from '../../ui/EmailVerificationBanner';
import { DisplaySettings } from './DisplaySettings';
import { GameDefaults } from './GameDefaults';
import { VenuesManager } from './VenuesManager';
import { GameTypesManager } from './GameTypesManager';
import { DataAndAbout } from './DataAndAbout';
import { ErrorLogPanel } from './ErrorLogPanel';
import { RefresherSettings } from './RefresherSettings';
// PIO G5 child F (WS-165 / SPR-036, 2026-05-04) — privacy controls.
import { PrivacySection } from './PrivacySection';
// EAL WS-222 (2026-06-12) — anchor-calibration enrollment opt-in (red line #1).
import { AnchorCalibrationSection } from './AnchorCalibrationSection';
// EAL WS-221 (2026-06-13) — global anchor-library calibration reset (red line #4b).
import { AnchorCalibrationResetSection } from './AnchorCalibrationResetSection';
// VCE (WS-181, 2026-05-11) — voice card entry spike behind a feature flag.
import { VoiceCardEntrySection } from './VoiceCardEntrySection';
// Owner-only sandbox tab (2026-05-05) — gated by email; renders nothing
// for non-owner accounts. Houses prototypes + dev affordances.
import { AdminSection } from './AdminSection';

export const SettingsView = ({ scale }) => {
  const { showSuccess, showError, showWarning, addToast } = useToast();
  const { setCurrentScreen, SCREEN } = useUI();
  const { user, isAuthenticated, isInitialized: authInitialized, sendVerificationEmail } = useAuth();
  const {
    settings,
    isLoading,
    updateSetting,
    resetSettings,
    restoreSettings,
    allVenues,
    allGameTypes,
    allGameTypeKeys,
    addCustomVenue,
    removeCustomVenue,
    setVenueNote,
    addCustomGameType,
    removeCustomGameType,
    dispatchSettings,
  } = useSettings();

  const handleShowToast = useCallback((message, type) => {
    if (type === 'success' && showSuccess) showSuccess(message);
    else if (type === 'error' && showError) showError(message);
    else if (type === 'warning' && showWarning) showWarning(message);
    else if (type === 'info' && showSuccess) showSuccess(message);
  }, [showSuccess, showError, showWarning]);

  const handleNavigateToLogin = useCallback(() => {
    setCurrentScreen(SCREEN.LOGIN);
  }, [setCurrentScreen, SCREEN]);

  const handleNavigateToSignup = useCallback(() => {
    setCurrentScreen(SCREEN.SIGNUP);
  }, [setCurrentScreen, SCREEN]);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-gray-900 overflow-y-auto">
      {/* Portrait-native fluid layout (2026-06-06) — no 1600×720 ScaledContainer
          so settings fields (venue notes, game defaults) stay legible on a phone.
          h-[100dvh] (arbitrary value — Tailwind 3.3.6 has NO h-dvh/min-h-dvh utility,
          those are inert) so overflow-y-auto scrolls within the body-locked viewport
          (html/body/#root are height:100dvh; overflow:hidden). */}
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <button
            onClick={() => setCurrentScreen(SCREEN.TABLE)}
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 min-h-[44px] rounded-lg font-medium transition-colors"
          >
            Back to Table
          </button>
        </div>

        {/* Email Verification Banner */}
        {authInitialized && isAuthenticated && user && !user.emailVerified && (
          <EmailVerificationBanner
            user={user}
            onSendVerification={sendVerificationEmail}
            onShowToast={handleShowToast}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {authInitialized && (
            <AccountSection
              onNavigateToLogin={handleNavigateToLogin}
              onNavigateToSignup={handleNavigateToSignup}
              onShowToast={handleShowToast}
            />
          )}

          <DisplaySettings settings={settings} updateSetting={updateSetting} />

          <GameDefaults
            settings={settings}
            updateSetting={updateSetting}
            allVenues={allVenues}
            allGameTypes={allGameTypes}
            allGameTypeKeys={allGameTypeKeys}
          />

          <VenuesManager
            settings={settings}
            addCustomVenue={addCustomVenue}
            removeCustomVenue={removeCustomVenue}
            setVenueNote={setVenueNote}
          />

          <GameTypesManager
            settings={settings}
            addCustomGameType={addCustomGameType}
            removeCustomGameType={removeCustomGameType}
          />

          <DataAndAbout
            settings={settings}
            updateSetting={updateSetting}
            resetSettings={resetSettings}
            restoreSettings={restoreSettings}
            showWarning={showWarning}
            showSuccess={showSuccess}
            showError={showError}
            addToast={addToast}
          />

          <RefresherSettings />

          <PrivacySection
            settings={settings}
            dispatchSettings={dispatchSettings}
          />

          <AnchorCalibrationSection
            settings={settings}
            dispatchSettings={dispatchSettings}
          />

          <AnchorCalibrationResetSection />

          <VoiceCardEntrySection
            settings={settings}
            dispatchSettings={dispatchSettings}
          />

          <ErrorLogPanel showSuccess={showSuccess} />

          {/* Owner-only — renders nothing for non-owner accounts. */}
          <AdminSection />
        </div>
      </div>
    </div>
  );
};

