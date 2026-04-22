/**
 * OnlineView.jsx — Online play view for Ignition integration
 *
 * Thin orchestrator composing SeatGrid, SeatDetailPanel, and VillainProfileModal.
 * All analysis, advisor, and extension push logic runs at app-root level so
 * advice flows even when this view isn't active.
 */

import React, { useState, useCallback, useRef } from 'react';
import { useSyncBridge, useOnlineSession, useAnalysisContext } from '../../../contexts';
import { useToast } from '../../../contexts/ToastContext';
import { ScaledContainer } from '../../ui/ScaledContainer';
import VillainProfileModal from '../../ui/VillainProfileModal';
import { SeatGrid } from './SeatGrid';
import { SeatDetailPanel } from './SeatDetailPanel';

export const OnlineView = ({ scale }) => {
  const {
    isExtensionConnected, versionMismatch, dismissVersionMismatch,
    importedCount, syncError, importFromJson,
  } = useSyncBridge();

  const {
    selectedSessionId, setSelectedSessionId, onlineSessions, loadSessions,
  } = useOnlineSession();

  const { tendencyMap, handCount, isLoading, advice } = useAnalysisContext();
  const { showError } = useToast();

  const [selectedSeat, setSelectedSeat] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [expandedRec, setExpandedRec] = useState(null);
  const [recsExpanded, setRecsExpanded] = useState(false);
  const [isImporting, setIsImporting] = useState(false); // W4-A3-F6
  const fileInputRef = useRef(null);

  // File import handler — W4-A3-F6 loading state + disabled button during work.
  const handleFileImport = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      await importFromJson(text);
      loadSessions();
    } catch (err) {
      showError(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  }, [importFromJson, loadSessions, showError]);

  const selectedSeatData = selectedSeat ? tendencyMap[selectedSeat] : null;

  return (
    <ScaledContainer scale={scale}>
      <div style={{ padding: '12px', maxWidth: 1600, color: '#e0e0e0' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h1 style={{ fontSize: 18, fontWeight: 'bold', color: '#d4a847', margin: 0 }}>
            Online Play
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: isExtensionConnected ? '#22c55e' : '#6b7280',
              }} />
              <span style={{ color: '#9ca3af' }}>
                {isExtensionConnected ? 'Extension connected' : 'Extension not detected'}
              </span>
            </div>
            <span style={{ color: '#d4a847', fontWeight: 'bold', fontSize: 14 }}>
              {importedCount} hands
            </span>
          </div>
        </div>

        {versionMismatch && (
          <div style={{ background: '#78350f', padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 8, color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Extension version mismatch — update the extension or reload the page</span>
            <div style={{ display: 'flex', gap: 6, marginLeft: 12, flexShrink: 0 }}>
              <button
                onClick={() => window.location.reload()}
                style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
              >
                Reload Page
              </button>
              <button
                onClick={dismissVersionMismatch}
                style={{ background: 'transparent', color: '#fbbf24', border: '1px solid #fbbf24', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
              >
                Continue Anyway
              </button>
            </div>
          </div>
        )}

        {syncError && (
          <div style={{ background: '#7f1d1d', padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 8, color: '#fca5a5' }}>
            Sync error: {syncError}
          </div>
        )}

        {/* Session selector */}
        {onlineSessions.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {onlineSessions.map(s => (
              <button
                key={s.sessionId}
                onClick={() => { setSelectedSessionId(s.sessionId); setSelectedSeat(null); }}
                style={{
                  padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: s.sessionId === selectedSessionId ? 'bold' : 'normal',
                  background: s.sessionId === selectedSessionId ? '#d4a847' : '#374151',
                  color: s.sessionId === selectedSessionId ? '#1a1a2e' : '#9ca3af',
                }}
              >
                Table {s.tableId?.slice(-6) || s.sessionId} ({s.handCount || 0}h)
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {handCount === 0 && !isLoading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
            <div style={{ fontSize: 16, marginBottom: 8 }}>
              {isExtensionConnected ? 'Waiting for hands...' : 'No online data yet'}
            </div>
            <div style={{ fontSize: 12, marginBottom: 16 }}>
              {isExtensionConnected
                ? 'Play hands on Ignition and they will appear here automatically.'
                : 'Install the Poker Session Notes extension and play on Ignition, or import a hand file below.'
              }
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              style={{
                background: '#374151', color: '#d4a847', border: '1px solid #4b5563',
                padding: '8px 16px', borderRadius: 6, cursor: isImporting ? 'wait' : 'pointer', fontSize: 13,
                opacity: isImporting ? 0.6 : 1,
                minHeight: 44,
              }}
            >
              {isImporting ? 'Importing…' : 'Import from File'}
            </button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileImport} style={{ display: 'none' }} />
          </div>
        )}

        {/* Main content */}
        {handCount > 0 && (
          <>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
              {handCount} hands analyzed {isLoading && '(updating...)'}
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

            {/* Import button (even with data) */}
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                style={{
                  background: '#374151', color: '#9ca3af', border: '1px solid #4b5563',
                  padding: '6px 12px', borderRadius: 4, cursor: isImporting ? 'wait' : 'pointer', fontSize: 11,
                  opacity: isImporting ? 0.6 : 1,
                  minHeight: 44,
                }}
              >
                {isImporting ? 'Importing…' : 'Import from File'}
              </button>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileImport} style={{ display: 'none' }} />
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
