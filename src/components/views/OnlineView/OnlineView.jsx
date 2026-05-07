/**
 * OnlineView.jsx — Online play view for Ignition integration
 *
 * Thin orchestrator composing SeatGrid, SeatDetailPanel, and VillainProfileModal.
 * All analysis, advisor, and extension push logic runs at app-root level so
 * advice flows even when this view isn't active.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useSyncBridge, useOnlineSession, useAnalysisContext } from '../../../contexts';
import { useToast } from '../../../contexts/ToastContext';
import { ScaledContainer } from '../../ui/ScaledContainer';
import VillainProfileModal from '../../ui/VillainProfileModal';
import VersionMismatchModal from '../../ui/VersionMismatchModal';
import { writeReloadFlag } from '../../../utils/versionMismatchStorage';
import { SeatGrid } from './SeatGrid';
import { SeatDetailPanel } from './SeatDetailPanel';

export const OnlineView = ({ scale }) => {
  const {
    isExtensionConnected, versionMismatch, dismissVersionMismatch, dismissedDespiteMismatch,
    extProtocolVersion, extManifestVersion, appProtocolVersion,
    postReloadStatus, clearPostReloadStatus,
    importedCount, syncError, importFromJson,
  } = useSyncBridge();

  const {
    selectedSessionId, setSelectedSessionId, onlineSessions, loadSessions,
  } = useOnlineSession();

  const { tendencyMap, handCount, isLoading, advice } = useAnalysisContext();
  const { showError, showSuccess } = useToast();

  const [selectedSeat, setSelectedSeat] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [expandedRec, setExpandedRec] = useState(null);
  const [recsExpanded, setRecsExpanded] = useState(false);
  const [isImporting, setIsImporting] = useState(false); // W4-A3-F6
  const [showReloadConfirm, setShowReloadConfirm] = useState(false); // WS-076
  const fileInputRef = useRef(null);

  // WS-076: react to post-reload version-mismatch verification.
  // 'recovered' → versions now match; toast and clear the flag.
  // 'still-mismatched' → versions still differ post-reload; auto-open modal
  //   so the user sees the diagnostic without clicking "Reload Page" first.
  useEffect(() => {
    if (postReloadStatus === 'recovered') {
      showSuccess('Extension protocol now in sync — hand imports resumed');
      clearPostReloadStatus();
    } else if (postReloadStatus === 'still-mismatched') {
      setShowReloadConfirm(true);
    }
  }, [postReloadStatus, showSuccess, clearPostReloadStatus]);

  const handleReloadConfirm = useCallback(() => {
    writeReloadFlag({
      extProtocolVersion,
      extManifestVersion,
      appProtocolVersion,
    });
    window.location.reload();
  }, [extProtocolVersion, extManifestVersion, appProtocolVersion]);

  const handleReloadCancel = useCallback(() => {
    setShowReloadConfirm(false);
    // If the modal was auto-opened by 'still-mismatched', clear the status
    // so it doesn't reopen on re-render.
    if (postReloadStatus === 'still-mismatched') clearPostReloadStatus();
  }, [postReloadStatus, clearPostReloadStatus]);

  // File import handler — W4-A3-F6 loading state + disabled button during work.
  const handleFileImport = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      await importFromJson(text);
      loadSessions();
      showSuccess('Hand file imported');
    } catch (err) {
      showError(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  }, [importFromJson, loadSessions, showError, showSuccess]);

  const selectedSeatData = selectedSeat ? tendencyMap[selectedSeat] : null;

  return (
    <ScaledContainer scale={scale}>
      <div className="p-3 max-w-[1600px] text-[#e0e0e0]">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-lg font-bold m-0 text-[#d4a847]">
            Online Play
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <div
                className={`w-2 h-2 rounded-full ${isExtensionConnected ? 'bg-green-500' : 'bg-gray-500'}`}
              />
              <span className="text-gray-400">
                {isExtensionConnected ? 'Extension connected' : 'Extension not detected'}
              </span>
              {versionMismatch && dismissedDespiteMismatch && (
                <button
                  onClick={() => setShowReloadConfirm(true)}
                  title="Extension version mismatch — advice suppressed. Click to review."
                  data-testid="version-mismatch-pip"
                  className="bg-transparent border-none p-0 ml-0.5 cursor-pointer flex items-center text-amber-400"
                  aria-label="Extension version mismatch — advice suppressed. Click to review."
                >
                  <AlertTriangle size={14} />
                </button>
              )}
            </div>
            <span className="text-[#d4a847] font-bold text-sm">
              {importedCount} hands
            </span>
          </div>
        </div>

        {versionMismatch && !dismissedDespiteMismatch && (
          <div
            className="bg-amber-900 px-2.5 py-1.5 rounded-md text-xs mb-2 text-amber-400 flex items-center justify-between"
            data-testid="version-mismatch-banner"
          >
            <span>Extension version mismatch — update the extension or reload the page</span>
            <div className="flex gap-1.5 ml-3 shrink-0">
              <button
                onClick={() => setShowReloadConfirm(true)}
                className="bg-amber-600 text-white border-none rounded px-2 py-0.5 text-[11px] cursor-pointer"
              >
                Reload Page
              </button>
              <button
                onClick={dismissVersionMismatch}
                className="bg-transparent text-amber-400 border border-amber-400 rounded px-2 py-0.5 text-[11px] cursor-pointer"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        )}

        <VersionMismatchModal
          isOpen={showReloadConfirm}
          onConfirm={handleReloadConfirm}
          onCancel={handleReloadCancel}
          extProtocolVersion={extProtocolVersion}
          extManifestVersion={extManifestVersion}
          appProtocolVersion={appProtocolVersion}
          postReloadStatus={postReloadStatus}
        />

        {syncError && (
          <div className="bg-red-900 px-2.5 py-1.5 rounded-md text-xs mb-2 text-red-300">
            Sync error: {syncError}
          </div>
        )}

        {/* Session selector */}
        {onlineSessions.length > 1 && (
          <div className="flex gap-1.5 mb-2.5 flex-wrap">
            {onlineSessions.map(s => (
              <button
                key={s.sessionId}
                onClick={() => { setSelectedSessionId(s.sessionId); setSelectedSeat(null); }}
                className={`px-2.5 py-1 rounded border-none cursor-pointer text-[11px] ${s.sessionId === selectedSessionId ? 'font-bold bg-[#d4a847] text-[#1a1a2e]' : 'font-normal bg-gray-700 text-gray-400'}`}
              >
                Table {s.tableId?.slice(-6) || s.sessionId} ({s.handCount || 0}h)
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {handCount === 0 && !isLoading && (
          <div className="text-center px-5 py-10 text-gray-500">
            <div className="text-base mb-2">
              {isExtensionConnected ? 'Waiting for hands...' : 'No online data yet'}
            </div>
            <div className="text-xs mb-4">
              {isExtensionConnected
                ? 'Play hands on Ignition and they will appear here automatically.'
                : 'Install the Poker Session Notes extension and play on Ignition, or import a hand file below.'
              }
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className={`bg-gray-700 text-[#d4a847] border border-gray-600 px-4 py-2 rounded-md text-[13px] min-h-11 ${isImporting ? 'cursor-wait opacity-60' : 'cursor-pointer opacity-100'}`}
            >
              {isImporting ? 'Importing…' : 'Import from File'}
            </button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileImport} className="hidden" />
          </div>
        )}

        {/* Main content */}
        {handCount > 0 && (
          <>
            <div className="text-xs text-gray-500 mb-1.5">
              {handCount === 1 ? '1 hand analyzed' : `${handCount} hands analyzed`} {isLoading && '(updating...)'}
            </div>

            <SeatGrid
              tendencyMap={tendencyMap}
              selectedSeat={selectedSeat}
              onSelectSeat={setSelectedSeat}
              handCount={handCount}
            />

            {selectedSeatData && (
              <SeatDetailPanel
                selectedSeat={selectedSeat}
                selectedSeatData={selectedSeatData}
                advice={advice}
                expandedRec={expandedRec}
                setExpandedRec={setExpandedRec}
                recsExpanded={recsExpanded}
                setRecsExpanded={setRecsExpanded}
                onOpenProfile={() => setProfileModalOpen(true)}
              />
            )}

            {/* Import button (even with data) — F9: size unified with empty-state button (px-4 py-2 text-[13px] rounded-md) */}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className={`bg-gray-700 text-gray-400 border border-gray-600 px-4 py-2 rounded-md text-[13px] min-h-11 ${isImporting ? 'cursor-wait opacity-60' : 'cursor-pointer opacity-100'}`}
              >
                {isImporting ? 'Importing…' : 'Import from File'}
              </button>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileImport} className="hidden" />
            </div>
          </>
        )}
      </div>

      {/* Villain Profile Modal */}
      <VillainProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        playerName={'Seat ' + selectedSeat}
        villainProfile={selectedSeatData?.villainProfile}
        playerId={selectedSeat}
      />
    </ScaledContainer>
  );
};
