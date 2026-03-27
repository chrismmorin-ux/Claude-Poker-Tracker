/**
 * VillainModelCard.jsx — Compact inline villain decision profile
 *
 * Renders the villain's decision model in poker-native language.
 * Designed for the OnlineView detail panel — compact by default,
 * expandable for vulnerabilities, awareness, and showdown history.
 */

import React, { useState } from 'react';

// Villain style → border accent color
const STYLE_BORDER = {
  Fish: '#dc2626', LAG: '#ea580c', TAG: '#2563eb',
  Nit: '#6b7280', LP: '#d97706', Reg: '#7c3aed',
  Unknown: '#374151',
};

// Maturity → badge color
const MATURITY_COLORS = {
  deep:       { bg: '#166534', text: '#86efac' },
  individual: { bg: '#365314', text: '#a3e635' },
  typed:      { bg: '#854d0e', text: '#fde047' },
  coarse:     { bg: '#9a3412', text: '#fdba74' },
  unknown:    { bg: '#374151', text: '#9ca3af' },
};

// Confidence → dot color
const CONF_DOT = (c) =>
  c >= 0.6 ? '#22c55e' : c >= 0.3 ? '#eab308' : c >= 0.1 ? '#f97316' : '#4b5563';

// Severity → bar color
const SEV_COLOR = (s) =>
  s >= 0.7 ? '#ef4444' : s >= 0.4 ? '#eab308' : '#22c55e';

const STREETS = ['preflop', 'flop', 'turn', 'river'];
const STREET_SHORT = { preflop: 'Pre', flop: 'Flop', turn: 'Turn', river: 'River' };

export const VillainModelCard = ({ villainProfile, currentStreet, villainStyle, onViewFullProfile }) => {
  const [expanded, setExpanded] = useState(false);

  if (!villainProfile || villainProfile.maturity === 'unknown') return null;

  const {
    headline, maturity, maturityLabel, streets,
    aggressionResponse, awareness, vulnerabilities,
    showdownAnchors, decisionModelDescription,
  } = villainProfile;

  const matColor = MATURITY_COLORS[maturity] || MATURITY_COLORS.unknown;
  const borderColor = STYLE_BORDER[villainStyle] || STYLE_BORDER.Unknown;

  return (
    <div style={{
      background: '#0d1117', borderLeft: `3px solid ${borderColor}`,
      borderRadius: 4, padding: '8px 10px', marginBottom: 8,
    }}>
      {/* Row 1: Headline + maturity badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: '#e0e0e0', fontWeight: 'bold', flex: 1 }}>
          {headline || 'Unknown player'}
        </span>
        <span style={{
          fontSize: 9, padding: '1px 6px', borderRadius: 3, fontWeight: 'bold',
          background: matColor.bg, color: matColor.text, whiteSpace: 'nowrap', marginLeft: 8,
        }}>
          {maturityLabel}
        </span>
      </div>

      {/* Row 2: Street tendencies */}
      {streets && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
          {STREETS.map(s => {
            const st = streets[s];
            if (!st) return null;
            const isCurrent = s === currentStreet;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: CONF_DOT(st.confidence), flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 10,
                  color: isCurrent ? '#e0e0e0' : '#6b7280',
                  fontWeight: isCurrent ? 'bold' : 'normal',
                }}>
                  <span style={{ color: isCurrent ? '#d4a847' : '#9ca3af', marginRight: 2 }}>
                    {STREET_SHORT[s]}:
                  </span>
                  {st.tendency}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Row 3: Aggression response + expand toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {aggressionResponse && (
          <div style={{ fontSize: 10, color: '#9ca3af', display: 'flex', gap: 12, flex: 1 }}>
            <span>
              Facing bet: <span style={{ color: '#e0e0e0' }}>
                {aggressionResponse.facingBet.summary}
                {aggressionResponse.facingBet.foldPct != null && (
                  <span style={{ color: '#6b7280' }}> ({Math.round(aggressionResponse.facingBet.foldPct * 100)}%)</span>
                )}
              </span>
            </span>
            <span>
              Facing raise: <span style={{ color: '#e0e0e0' }}>
                {aggressionResponse.facingRaise.summary}
                {aggressionResponse.facingRaise.foldPct != null && (
                  <span style={{ color: '#6b7280' }}> ({Math.round(aggressionResponse.facingRaise.foldPct * 100)}%)</span>
                )}
              </span>
            </span>
          </div>
        )}
        <span
          onClick={() => setExpanded(!expanded)}
          style={{
            fontSize: 10, color: '#4b8bbf', cursor: 'pointer',
            marginLeft: 8, whiteSpace: 'nowrap', userSelect: 'none',
          }}
        >
          {expanded ? '\u25B2 Less' : '\u25BC More'}
        </span>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div style={{ marginTop: 8, borderTop: '1px solid #1e293b', paddingTop: 6 }}>
          {/* Decision model description */}
          {decisionModelDescription && (
            <div style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic', marginBottom: 6 }}>
              {decisionModelDescription}
            </div>
          )}

          {/* Vulnerabilities */}
          {vulnerabilities?.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, fontWeight: 'bold' }}>
                Vulnerabilities
              </div>
              {vulnerabilities.slice(0, 4).map((v, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 10, marginBottom: 2, color: '#e0e0e0',
                }}>
                  {/* Severity bar */}
                  <div style={{ width: 24, height: 3, background: '#374151', borderRadius: 2, flexShrink: 0 }}>
                    <div style={{
                      width: `${Math.round((v.severity || 0) * 100)}%`,
                      height: '100%', borderRadius: 2,
                      background: SEV_COLOR(v.severity || 0),
                    }} />
                  </div>
                  <span>{v.label}</span>
                  {v.exploitHint && (
                    <span style={{ color: '#4b8bbf', fontStyle: 'italic', fontSize: 9 }}>
                      — {v.exploitHint}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Awareness */}
          {awareness && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: 10 }}>
              {[
                { key: 'positionAware', label: 'Position' },
                { key: 'boardTextureAware', label: 'Board texture' },
                { key: 'sizingTells', label: 'Sizing' },
              ].map(({ key, label }) => {
                const a = awareness[key];
                const detected = a?.detected;
                return (
                  <span key={key} style={{ color: detected ? '#22c55e' : '#4b5563' }}>
                    {detected ? '\u2713' : '\u2717'} {label}
                  </span>
                );
              })}
            </div>
          )}

          {/* Showdown anchors */}
          {showdownAnchors?.length > 0 && (
            <div>
              <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, fontWeight: 'bold' }}>
                Showdowns
              </div>
              {showdownAnchors.slice(0, 3).map((s, i) => (
                <div key={i} style={{ fontSize: 10, color: '#9ca3af', marginBottom: 1 }}>
                  <span style={{ color: '#d4a847' }}>{s.handDescription}</span>
                  {s.position && <span> from {s.position}</span>}
                  {s.outcome && (
                    <span style={{ color: s.outcome === 'won' ? '#22c55e' : '#ef4444' }}>
                      {' '}({s.outcome})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full profile link */}
      {onViewFullProfile && (
        <div
          onClick={onViewFullProfile}
          style={{
            fontSize: 10, color: '#4b8bbf', cursor: 'pointer',
            textAlign: 'right', marginTop: 6,
          }}
        >
          View full decision profile ›
        </div>
      )}
    </div>
  );
};

export default VillainModelCard;
