/**
 * VulnerabilitiesPanel.jsx — Full vulnerabilities list with severity bars
 *
 * Shows all detected vulnerabilities with severity dots, labels,
 * exploit hints, and evidence. Expanded version of VulnerabilityCallout.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, FONT, COLOR, R } from '../panelTokens';

const sevColor = (severity) => {
  if (typeof severity === 'string') {
    return severity === 'high' ? COLOR.red : severity === 'medium' ? COLOR.orange : COLOR.yellow;
  }
  // Numeric 0-1
  if (severity >= 0.7) return COLOR.red;
  if (severity >= 0.4) return COLOR.orange;
  return COLOR.yellow;
};

const sevLabel = (severity) => {
  if (typeof severity === 'string') return severity;
  if (severity >= 0.7) return 'high';
  if (severity >= 0.4) return 'medium';
  return 'low';
};

export const VulnerabilitiesPanel = ({ vulnerabilities }) => {
  if (!vulnerabilities || vulnerabilities.length === 0) return null;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        ...sectionHeader,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Active Vulnerabilities</span>
        <span style={{ fontFamily: FONT.mono, fontSize: 8, fontWeight: 400, color: TEXT.faint }}>
          {vulnerabilities.length} found
        </span>
      </div>

      {vulnerabilities.map((v, i) => {
        const sc = sevColor(v.severity);
        const sl = sevLabel(v.severity);
        const barWidth = typeof v.severity === 'number'
          ? Math.round(v.severity * 100)
          : sl === 'high' ? 85 : sl === 'medium' ? 55 : 30;

        return (
          <div key={i} style={{
            padding: '5px 8px',
            marginBottom: 3,
            borderLeft: `3px solid ${sc}`,
            borderRadius: `0 ${R.sm}px ${R.sm}px 0`,
            background: `${sc}08`,
          }}>
            {/* Top row: severity bar + label + severity tag */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              {/* Severity bar */}
              <div style={{
                width: 30, height: 3, background: '#374151',
                borderRadius: 2, flexShrink: 0,
              }}>
                <div style={{
                  width: `${barWidth}%`, height: '100%', borderRadius: 2,
                  background: sc,
                }} />
              </div>

              {/* Label */}
              <span style={{
                fontSize: 10, fontWeight: 600, color: TEXT.primary,
                flex: 1, lineHeight: 1.2,
              }}>
                {v.label || v.description || v.id}
              </span>

              {/* Severity tag */}
              <span style={{
                fontSize: 7, fontWeight: 700, textTransform: 'uppercase',
                color: sc, flexShrink: 0,
              }}>
                {sl}
              </span>
            </div>

            {/* Exploit hint */}
            {v.exploitHint && (
              <div style={{
                fontSize: 9, fontStyle: 'italic', color: '#4b8bbf',
                lineHeight: 1.3, paddingLeft: 36,
              }}>
                {v.exploitHint}
              </div>
            )}

            {/* Evidence */}
            {v.evidence && (
              <div style={{
                fontSize: 8, fontFamily: FONT.mono, color: TEXT.faint,
                paddingLeft: 36, marginTop: 1,
              }}>
                {v.evidence}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const sectionHeader = {
  fontSize: 9, fontWeight: 700, color: TEXT.muted,
  textTransform: 'uppercase', letterSpacing: 0.8,
  marginBottom: 6, paddingBottom: 3,
  borderBottom: `1px solid ${BORDER.default}`,
};
