/**
 * OnlineView.jsx — Online play view for Ignition integration
 *
 * Thin consumer of OnlineSessionContext — all analysis, advisor, and
 * extension push logic runs at app-root level so advice flows even
 * when this view isn't active.
 */

import React, { useState, useCallback, useRef } from 'react';
import { useSyncBridge, useOnlineSession, useOnlineAnalysis2 } from '../../contexts';
import { SEAT_ARRAY } from '../../constants/gameConstants';
import { ScaledContainer } from '../ui/ScaledContainer';
import VillainProfileModal from '../ui/VillainProfileModal';
import { SegmentationBar } from '../ui/SegmentationBar';
import { ObservationPanel } from '../ui/ObservationPanel';
import { VillainModelCard } from '../ui/VillainModelCard';

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

// Maturity badge colors (matches VillainModelCard)
const MATURITY_COLORS = {
  deep:       { bg: '#166534', text: '#86efac' },
  individual: { bg: '#365314', text: '#a3e635' },
  typed:      { bg: '#854d0e', text: '#fde047' },
  coarse:     { bg: '#9a3412', text: '#fdba74' },
  unknown:    { bg: '#374151', text: '#9ca3af' },
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

// Data quality explanations for recommendation reliability
const QUALITY_DETAIL = {
  none:        'No player data — using population defaults only',
  speculative: 'Very early — play standard, reads may be noise',
  developing:  'Building profile — core stats reliable, exploits may shift',
  established: 'Solid read — exploits and recommendations are calibrated',
};

// Board texture pill colors
const TEXTURE_PILLS = {
  wet:       { bg: '#1e3a5f', color: '#60a5fa' },
  dry:       { bg: '#3b2f1a', color: '#d4a847' },
  medium:    { bg: '#1a2e2e', color: '#6ee7b7' },
  paired:    { bg: '#3b2a1a', color: '#fb923c' },
  flushDraw: { bg: '#1a2e3b', color: '#67e8f9' },
  monotone:  { bg: '#1a1a3b', color: '#a78bfa' },
};

// Action-specific accent colors for recommendation cards
const ACTION_ACCENT = {
  fold:  '#dc2626',
  check: '#0891b2',
  call:  '#2563eb',
  bet:   '#16a34a',
  raise: '#ea580c',
};

// Prediction source → human label
const PRED_SOURCE_LABEL = {
  'level-1': 'exact match',
  'level-2': 'street match',
  'level-3': 'broad match',
  'level-4': 'broad match',
  'level-5': 'broad match',
  'level-6': 'general',
  prior: 'population estimate',
};

export const OnlineView = ({ scale }) => {
  const {
    isExtensionConnected, versionMismatch, dismissVersionMismatch,
    importedCount, syncError, importFromJson,
  } = useSyncBridge();

  const {
    selectedSessionId, setSelectedSessionId, onlineSessions, loadSessions,
  } = useOnlineSession();

  const { tendencyMap, handCount, isLoading, advice } = useOnlineAnalysis2();

  const [selectedSeat, setSelectedSeat] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [expandedRec, setExpandedRec] = useState(null);
  const [recsExpanded, setRecsExpanded] = useState(false);
  const fileInputRef = useRef(null);

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

                    {/* Stats / Headline */}
                    {hasData ? (
                      <>
                        {data.villainProfile && data.villainProfile.maturity !== 'unknown' ? (
                          <>
                            {/* Headline-based display */}
                            <div style={{
                              fontSize: 10, color: '#e0e0e0', lineHeight: 1.3,
                              overflow: 'hidden', display: '-webkit-box',
                              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                              minHeight: 26,
                            }}>
                              {data.villainProfile.headline}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                              <span style={{
                                fontSize: 8, padding: '1px 4px', borderRadius: 2, fontWeight: 'bold',
                                background: MATURITY_COLORS[data.villainProfile.maturity]?.bg || '#374151',
                                color: MATURITY_COLORS[data.villainProfile.maturity]?.text || '#9ca3af',
                              }}>
                                {data.villainProfile.maturityLabel}
                              </span>
                              <span style={{ fontSize: 9, color: '#4b5563' }}>
                                {data.sampleSize}h
                                {data.exploits?.length > 0 && (
                                  <span style={{ color: '#6b7280', marginLeft: 3 }}>
                                    {data.exploits.length}e
                                  </span>
                                )}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Fallback: VPIP/PFR/AF stats */}
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
                        )}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 'bold', color: '#d4a847', margin: 0 }}>
                      Seat {selectedSeat}
                    </h3>
                    {selectedSeatData.style && (
                      <span style={{
                        fontSize: 10, fontWeight: 'bold', padding: '2px 6px', borderRadius: 3,
                        backgroundColor: STYLE_COLORS[selectedSeatData.style]?.bg || '#374151',
                        color: STYLE_COLORS[selectedSeatData.style]?.text || '#9ca3af',
                      }}>
                        {selectedSeatData.style}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>
                    {selectedSeatData.sampleSize} hands
                    {(() => {
                      const q = QUALITY_CONFIG[getQualityTier(selectedSeatData.sampleSize || 0)];
                      return q ? <span style={{ fontSize: 10, marginLeft: 4, color: q.color }}>({q.label})</span> : null;
                    })()}
                  </span>
                </div>

                {/* Data quality explanation */}
                {(() => {
                  const tier = getQualityTier(selectedSeatData.sampleSize || 0);
                  const detail = QUALITY_DETAIL[tier];
                  return detail ? (
                    <div style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic', marginBottom: 6 }}>
                      {detail}
                    </div>
                  ) : null;
                })()}

                {/* Villain Model Summary */}
                {selectedSeatData.villainProfile && selectedSeatData.villainProfile.maturity !== 'unknown' && (
                  <VillainModelCard
                    villainProfile={selectedSeatData.villainProfile}
                    currentStreet={advice?.currentStreet}
                    villainStyle={selectedSeatData.style}
                    onViewFullProfile={() => setProfileModalOpen(true)}
                  />
                )}

                {/* Decision-organized observations (profile layer) */}
                {selectedSeatData.observations?.length > 0 && (
                  <ObservationPanel observations={selectedSeatData.observations} />
                )}

                {/* Live Recommendations (collapsible when profile exists) */}
                {advice && String(advice.villainSeat) === selectedSeat && (() => {
                  const hasProfile = selectedSeatData.villainProfile && selectedSeatData.villainProfile.maturity !== 'unknown';
                  const isCollapsed = hasProfile && !recsExpanded;
                  const topRec = advice.recommendations?.[0];

                  return (
                    <div style={{ marginBottom: 10 }}>
                      {/* Collapsible header */}
                      <div
                        onClick={() => hasProfile && setRecsExpanded(!recsExpanded)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          marginBottom: isCollapsed ? 0 : 6,
                          cursor: hasProfile ? 'pointer' : 'default',
                          userSelect: 'none',
                        }}
                      >
                        <h4 style={{ fontSize: 11, color: '#d4a847', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {hasProfile && (
                            <span style={{ marginRight: 4, fontSize: 9 }}>{isCollapsed ? '\u25BC' : '\u25B2'}</span>
                          )}
                          Live Recommendations
                        </h4>
                        {/* Collapsed summary: top rec action + EV */}
                        {isCollapsed && topRec && (
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>
                            Best: <span style={{
                              fontWeight: 'bold', textTransform: 'uppercase',
                              color: ACTION_ACCENT[topRec.action.toLowerCase()] || '#e0e0e0',
                            }}>{topRec.action}</span>
                            <span style={{
                              marginLeft: 4, fontWeight: 'bold',
                              color: topRec.ev > 0 ? '#22c55e' : topRec.ev === 0 ? '#6b7280' : '#ef4444',
                            }}>
                              {topRec.ev >= 0 ? '+' : ''}{topRec.ev.toFixed(1)} EV
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Full recommendations (shown when expanded or no profile) */}
                      {!isCollapsed && (
                        <>
                          {/* Situation + Hero Equity row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: '#9ca3af' }}>
                              {advice.situationLabel || advice.situation}
                              {advice.heroAlreadyActed && (
                                <span style={{ fontSize: 9, color: '#6b7280', fontStyle: 'italic', marginLeft: 4 }}>(review)</span>
                              )}
                            </span>
                            <span style={{
                              fontSize: 13, fontWeight: 'bold',
                              color: advice.heroEquity >= 0.5 ? '#22c55e' : '#ef4444',
                            }}>
                              {Math.round(advice.heroEquity * 100)}% equity
                            </span>
                          </div>

                          {/* Board texture pills */}
                          {advice.boardTexture && (
                            <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                              {[
                                { key: 'texture', show: true, label: advice.boardTexture.texture },
                                { key: 'paired', show: advice.boardTexture.isPaired, label: 'paired' },
                                { key: 'flushDraw', show: advice.boardTexture.flushDraw, label: 'flush draw' },
                                { key: 'monotone', show: advice.boardTexture.monotone, label: 'monotone' },
                              ].filter(p => p.show).map(p => {
                                const pill = TEXTURE_PILLS[p.key] || TEXTURE_PILLS.medium;
                                return (
                                  <span key={p.key} style={{
                                    fontSize: 9, padding: '1px 6px', borderRadius: 3, fontWeight: 'bold',
                                    background: pill.bg, color: pill.color,
                                  }}>
                                    {p.label}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Segmentation bar (postflop only) */}
                          {advice.segmentation?.buckets && (
                            <div style={{ marginBottom: 6 }}>
                              <SegmentationBar buckets={advice.segmentation.buckets} size="sm" />
                            </div>
                          )}

                          {/* Recommendation cards */}
                          {advice.recommendations?.slice(0, 3).map((rec, i) => {
                            const isTop = i === 0;
                            const isPositive = rec.ev > 0;
                            const vr = rec.villainResponse;
                            const actionColor = ACTION_ACCENT[rec.action.toLowerCase()] || '#9ca3af';
                            const isExpanded = expandedRec === i || isTop;

                            return (
                              <div key={rec.action + i} style={{
                                padding: '6px 8px', marginBottom: 3, borderRadius: 4,
                                background: '#0d1117',
                                borderLeft: `3px solid ${actionColor}`,
                              }}>
                                {/* Action + EV with bar */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                  <span style={{
                                    fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase',
                                    color: isTop ? actionColor : '#e0e0e0',
                                  }}>
                                    {isTop ? '\u2605 ' : ''}{rec.action}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{
                                      fontSize: 12, fontWeight: 'bold',
                                      color: isPositive ? '#22c55e' : rec.ev === 0 ? '#6b7280' : '#ef4444',
                                    }}>
                                      EV: {rec.ev >= 0 ? '+' : ''}{rec.ev.toFixed(1)}
                                    </span>
                                    {/* EV magnitude bar */}
                                    <div style={{
                                      width: 36, height: 3, background: '#374151', borderRadius: 2,
                                    }}>
                                      <div style={{
                                        width: `${Math.min(100, Math.abs(rec.ev) * 8)}%`,
                                        height: '100%', borderRadius: 2,
                                        background: isPositive ? '#22c55e' : '#ef4444',
                                      }} />
                                    </div>
                                  </div>
                                </div>

                                {/* Sizing line */}
                                {rec.sizing && (
                                  <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>
                                    Size: {Math.round(rec.sizing.betFraction * 100)}% pot (${rec.sizing.betSize.toFixed(0)})
                                    {' | '}Fold%: {Math.round(rec.sizing.foldPct * 100)}%
                                  </div>
                                )}

                                {/* Villain response — expandable for non-top recs */}
                                {vr && vr.fold && isExpanded && (
                                  <div style={{ fontSize: 10, color: '#4b8bbf', marginBottom: 2 }}>
                                    V: folds {Math.round(vr.fold.pct * 100)}%
                                    {' \u00B7 '}calls {Math.round(vr.call.pct * 100)}%
                                    {' \u00B7 '}raises {Math.round(vr.raise.pct * 100)}%
                                  </div>
                                )}
                                {vr && vr.check && !vr.fold && isExpanded && (
                                  <div style={{ fontSize: 10, color: '#4b8bbf', marginBottom: 2 }}>
                                    V: checks {Math.round(vr.check.pct * 100)}%
                                    {' \u00B7 '}bets {Math.round(vr.bet.pct * 100)}%
                                  </div>
                                )}
                                {/* Collapsed summary for non-top recs */}
                                {vr && !isExpanded && (
                                  <div
                                    onClick={() => setExpandedRec(i)}
                                    style={{ fontSize: 10, color: '#4b5563', cursor: 'pointer', marginBottom: 2 }}
                                  >
                                    {vr.fold
                                      ? `V: folds ${Math.round(vr.fold.pct * 100)}% \u00B7 calls ${Math.round(vr.call.pct * 100)}%`
                                      : vr.check
                                        ? `V: checks ${Math.round(vr.check.pct * 100)}% \u00B7 bets ${Math.round(vr.bet.pct * 100)}%`
                                        : null}
                                    <span style={{ color: '#4b8bbf', marginLeft: 4 }}>{'\u25BC'}</span>
                                  </div>
                                )}

                                {/* Model prediction confidence */}
                                {rec.villainPrediction && isExpanded && (
                                  <div style={{ fontSize: 9, color: '#4b5563', marginBottom: 2 }}>
                                    Model: {rec.villainPrediction.source === 'prior'
                                      ? 'population estimate'
                                      : `${Math.round(rec.villainPrediction.effectiveN)} obs (${PRED_SOURCE_LABEL[rec.villainPrediction.source] || rec.villainPrediction.source})`}
                                  </div>
                                )}

                                {/* Reasoning */}
                                {isExpanded && (
                                  <div style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>
                                    {rec.reasoning}
                                  </div>
                                )}

                                {/* Collapse toggle for expanded non-top recs */}
                                {!isTop && isExpanded && expandedRec === i && (
                                  <div
                                    onClick={() => setExpandedRec(null)}
                                    style={{ fontSize: 9, color: '#4b8bbf', cursor: 'pointer', textAlign: 'right', marginTop: 2 }}
                                  >
                                    {'\u25B2 Less'}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Data quality note */}
                          {advice.dataQuality && (
                            <div style={{ fontSize: 9, color: '#4b5563', marginTop: 4, textAlign: 'right' }}>
                              {advice.dataQuality.confidenceNote}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Legacy exploits (shown when no observations or as supplement) */}
                {(!selectedSeatData.observations?.length) && selectedSeatData.exploits?.length > 0 && (
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

                {/* Legacy weaknesses (shown when no observations) */}
                {(!selectedSeatData.observations?.length) && selectedSeatData.weaknesses?.length > 0 && (
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

                {/* Briefings (always shown as supplement) */}
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
