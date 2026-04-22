import React, { useCallback } from 'react';
import { ScaledContainer } from '../../ui/ScaledContainer';
import { LAYOUT } from '../../../constants/gameConstants';
import { useSettings, useAuth, useUI, useToast } from '../../../contexts';
import { AccountSection } from '../../ui/AccountSection';
import { EmailVerificationBanner } from '../../ui/EmailVerificationBanner';
import { DisplaySettings } from './DisplaySettings';
import { GameDefaults } from './GameDefaults';
import { VenuesManager } from './VenuesManager';
import { GameTypesManager } from './GameTypesManager';
import { DataAndAbout } from './DataAndAbout';
import { ErrorLogPanel } from './ErrorLogPanel';

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
    addCustomGameType,
    removeCustomGameType,
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
      <ScaledContainer scale={scale}>
        <div
          className="bg-gray-900 flex items-center justify-center"
          style={{ width: `${LAYOUT.TABLE_WIDTH}px`, height: `${LAYOUT.TABLE_HEIGHT}px` }}
        >
          <div className="text-white text-xl">Loading settings...</div>
        </div>
      </ScaledContainer>
    );
  }

  return (
    <ScaledContainer scale={scale}>
      <div
        className="bg-gray-900 overflow-y-auto p-6"
        style={{ width: `${LAYOUT.TABLE_WIDTH}px`, height: `${LAYOUT.TABLE_HEIGHT}px` }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <button
            onClick={() => setCurrentScreen(SCREEN.TABLE)}
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg font-medium transition-colors"
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

        <div className="grid grid-cols-2 gap-6">
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

          <ErrorLogPanel showSuccess={showSuccess} />
        </div>
      </div>
    </ScaledContainer>
  );
};

