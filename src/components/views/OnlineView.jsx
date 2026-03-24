/**
 * OnlineView.jsx — Online play view for Ignition integration
 *
 * Shows sync status, per-seat stats with exploits, and briefings.
 * Data flows from the extension via useSyncBridge → IndexedDB → useOnlineAnalysis.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts';
import useSyncBridge from '../../hooks/useSyncBridge';
import useOnlineAnalysis from '../../hooks/useOnlineAnalysis';
import useLiveActionAdvisor from '../../hooks/useLiveActionAdvisor';
import { getHandsBySource } from '../../utils/persistence/handsStorage';
import { getAllSessions } from '../../utils/persistence/sessionsStorage';
import { GUEST_USER_ID } from '../../utils/persistence/database';
import { SEAT_ARRAY } from '../../constants/gameConstants';
import { ScaledContainer } from '../ui/ScaledContainer';
import { TendencyStats } from '../ui/TendencyStats';
import { ExploitBadges } from '../ui/ExploitBadges';

// Style colors matching the extension's stats-engine
const STYLE_COLORS = {
  Fish: { bg: '#dc2626', text: '#fff' },
  LAG:  { bg: '#ea580c', text: '#fff' },
  TAG:  { bg: '#2563eb', text: '#fff' },
  Nit:  { bg: '#6b7280', text: '#fff' },
  LP:   { bg: '#d97706', text: '#fff' },
  Reg:  { bg: '#7c3aed', text: '#fff' },
  Unknown: { bg: '#374151', text: '#9ca3af' },
};

// Confidence tier dot colors
const TIER_DOT = {
  confirmed:   '#22c55e',  // green
  supported:   '#eab308',  // yellow
  speculative: '#6b7280',  // gray
};

// Data quality tier labels + colors
const QUALITY_CONFIG = {
  none:        { label: 'no data',    color: '#ef4444' },
  speculative: { label: 'early',      color: '#f97316' },
  developing:  { label: 'developing', color: '#eab308' },
  established: { label: 'solid',      color: '#22c55e' },
};

const getQualityTier = (n) =>
  n === 0 ? 'none' : n < 10 ? 'speculative' : n < 30 ? 'developing' : 'established';

export const OnlineView = ({ scale }) => {
  const { user } = useAuth();
  const userId = user?.uid || GUEST_USER_ID;

  const {
    isExtensionConnected, versionMismatch, importedCount, syncError,
    importFromJson, liveHandState, pushExploits, pushAdvice,
  } = useSyncBridge(userId);

  // Track online sessions
  const [onlineSessions, setOnlineSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const fileInputRef = useRef(null);

  // Load online sessions
  const loadSessions = useCallback(async () => {
    try {
      const allSessions = await getAllSessions(userId);
      const online = allSessions.filter(s => s.source === 'ignition');
      setOnlineSessions(online);
      // Auto-select most recent
      if (online.length > 0 && !selectedSessionId) {
        setSelectedSessionId(online[online.length - 1].sessionId);
      }
    } catch (_) {}
  }, [userId, selectedSessionId]);

  // Load sessions on mount and after imports
  React.useEffect(() => {
    loadSessions();
  }, [loadSessions, importedCount]);

  // Analysis pipeline for selected session
  const { tendencyMap, handCount, isLoading } = useOnlineAnalysis(selectedSessionId, userId);

  // Push exploit data to extension when analysis updates or connection established
  useEffect(() => {
    pushExploits(tendencyMap, handCount);
  }, [tendencyMap, handCount, pushExploits, isExtensionConnected]);

  // Live action advisor — runs getActionAdvice() against primary villain
  const { advice } = useLiveActionAdvisor(liveHandState, tendencyMap);

  // Push action advice to extension when advice updates or connection established
  useEffect(() => {
    pushAdvice(advice);
  }, [advice, pushAdvice, isExtensionConnected]);

  // File import handler
  const handleFileImport = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importFromJson(text);
      loadSessions();
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
    e.target.value = '';
  }, [importFromJson, loadSessions]);

  const seatEntries = Object.entries(tendencyMap).sort((a, b) => Number(a[0]) - Number(b[0]));
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
          <div style={{ background: '#78350f', padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 8, color: '#fbbf24' }}>
            Extension version mismatch — update the extension to match the app
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
              style={{
                background: '#374151', color: '#d4a847', border: '1px solid #4b5563',
                padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
              }}
            >
              Import from File
            </button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileImport} style={{ display: 'none' }} />
          </div>
        )}

        {/* Seat grid */}
        {handCount > 0 && (
          <>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
              {handCount} hands analyzed {isLoading && '(updating...)'}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 6,
              marginBottom: 12,
            }}>
              {SEAT_ARRAY.map(seat => {
                const seatStr = String(seat);
                const data = tendencyMap[seatStr];
                const isSelected = selectedSeat === seatStr;
                const hasData = data && data.sampleSize > 0;

                return (
                  <div
                    key={seat}
                    onClick={() => hasData && setSelectedSeat(isSelected ? null : seatStr)}
                    style={{
                      background: '#16213e',
                      border: `1px solid ${isSelected ? '#d4a847' : '#2a2a4a'}`,
                      borderRadius: 6,
                      padding: '8px',
                      cursor: hasData ? 'pointer' : 'default',
                      opacity: hasData ? 1 : 0.35,
                      transition: 'border-color 0.2s',
                    }}
                  >
                    {/* Seat header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 'bold', color: '#9ca3af' }}>
                        Seat {seat}
                      </span>
                      {data?.style && (
                        <span style={{
                          fontSize: 9, fontWeight: 'bold', padding: '1px 5px', borderRadius: 3,
                          backgroundColor: STYLE_COLORS[data.style]?.bg || '#374151',
                          color: STYLE_COLORS[data.style]?.text || '#9ca3af',
                        }}>
                          {data.style}
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    {hasData ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span style={{ color: '#6b7280' }}>VPIP</span>
                          <span style={{ fontWeight: 'bold', color: data.vpip > 40 ? '#ef4444' : data.vpip < 15 ? '#22c55e' : '#e0e0e0' }}>
                            {data.vpip}%
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span style={{ color: '#6b7280' }}>PFR</span>
                          <span style={{ fontWeight: 'bold', color: '#e0e0e0' }}>{data.pfr}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span style={{ color: '#6b7280' }}>AF</span>
                          <span style={{ fontWeight: 'bold', color: '#e0e0e0' }}>
                            {data.af === null ? '—' : data.af === Infinity ? '∞' : data.af?.toFixed(1)}
                          </span>
                        </div>
                        <div style={{ fontSize: 9, color: '#4b5563', textAlign: 'right', marginTop: 2 }}>
                          {data.sampleSize}h
                          {data.exploits?.length > 0 && (
                            <span style={{ color: '#d4a847', marginLeft: 4 }}>
                              {data.exploits.length} exploit{data.exploits.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: '#4b5563', textAlign: 'center', paddingTop: 8 }}>—</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected seat detail panel */}
            {selectedSeatData && (
              <div style={{
                background: '#16213e',
                border: '1px solid #d4a847',
                borderRadius: 8,
                padding: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 'bold', color: '#d4a847', margin: 0 }}>
                    Seat {selectedSeat}
                    {selectedSeatData.style && (
                      <span style={{
                        fontSize: 10, fontWeight: 'bold', padding: '2px 6px', borderRadius: 3, marginLeft: 8,
                        backgroundColor: STYLE_COLORS[selectedSeatData.style]?.bg || '#374151',
                        color: STYLE_COLORS[selectedSeatData.style]?.text || '#9ca3af',
                      }}>
                        {selectedSeatData.style}
                      </span>
                    )}
                  </h3>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>
                    {selectedSeatData.sampleSize} hands
                    {(() => {
                      const q = QUALITY_CONFIG[getQualityTier(selectedSeatData.sampleSize || 0)];
                      return q ? <span style={{ fontSize: 10, marginLeft: 4, color: q.color }}>({q.label})</span> : null;
                    })()}
                  </span>
                </div>

                {/* Early estimate warning */}
                {(selectedSeatData.sampleSize || 0) < 10 && selectedSeatData.exploits?.length > 0 && (
                  <div style={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic', marginBottom: 6 }}>
                    Early estimate — play standard until more data
                  </div>
                )}

                {/* Exploits */}
                {selectedSeatData.exploits?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <h4 style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' }}>Exploits</h4>
                    {selectedSeatData.exploits.slice(0, 8).map((exploit, i) => {
                      const dotColor = TIER_DOT[exploit.tier] || TIER_DOT.speculative;
                      const opacity = Math.max(0.5, Math.min(1, (exploit.scoring?.worthiness || 0.5) * 1.5));
                      return (
                        <div key={i} style={{
                          fontSize: 12, padding: '4px 8px', marginBottom: 3,
                          background: '#0d1117', borderRadius: 4, borderLeft: '2px solid #d4a847',
                          display: 'flex', alignItems: 'center', gap: 6, opacity,
                        }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                            backgroundColor: dotColor,
                          }} title={exploit.tier || 'speculative'} />
                          <span>{exploit.label || exploit.description || 'Exploit detected'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Weaknesses */}
                {selectedSeatData.weaknesses?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <h4 style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' }}>Weaknesses</h4>
                    {selectedSeatData.weaknesses.slice(0, 5).map((w, i) => (
                      <div key={i} style={{
                        fontSize: 12, padding: '4px 8px', marginBottom: 3,
                        background: '#0d1117', borderRadius: 4, borderLeft: '2px solid #ef4444',
                      }}>
                        {w.label || w.description || 'Weakness detected'}
                      </div>
                    ))}
                  </div>
                )}

                {/* Briefings */}
                {selectedSeatData.briefings?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' }}>Briefings</h4>
                    {selectedSeatData.briefings.slice(0, 3).map((b, i) => (
                      <div key={i} style={{
                        fontSize: 12, padding: '6px 8px', marginBottom: 4,
                        background: '#0d1117', borderRadius: 4,
                        borderLeft: '2px solid #22c55e',
                        lineHeight: 1.4,
                      }}>
                        {b.briefing || b.label || 'Briefing available'}
                      </div>
                    ))}
                  </div>
                )}

                {selectedSeatData.exploits?.length === 0 && selectedSeatData.weaknesses?.length === 0 && (
                  <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', padding: 8 }}>
                    {selectedSeatData.sampleSize < 20
                      ? `Need ${20 - selectedSeatData.sampleSize} more hands for exploit detection`
                      : 'No exploits detected — player appears balanced'
                    }
                  </div>
                )}
              </div>
            )}

            {/* Import button (even with data) */}
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: '#374151', color: '#9ca3af', border: '1px solid #4b5563',
                  padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 11,
                }}
              >
                Import from File
              </button>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileImport} style={{ display: 'none' }} />
            </div>
          </>
        )}
      </div>
    </ScaledContainer>
  );
};
