/**
 * AwarenessPanel.jsx — Villain's awareness indicators + showdown anchors
 *
 * Shows whether villain is position-aware, board-texture-aware, and has
 * sizing tells, plus recent showdown anchors for calibration.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, FONT, COLOR, GOLD, R } from '../panelTokens';

export const AwarenessPanel = ({ villainProfile }) => {
  if (!villainProfile) return null;
  const { awareness, showdownAnchors, decisionModelDescription } = villainProfile;
  if (!awareness && !showdownAnchors?.length && !decisionModelDescription) return null;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={sectionHeader}>Awareness & Calibration</div>

      {/* Decision model description */}
      {decisionModelDescription && (
        <div style={{
          fontSize: 10, color: TEXT.muted, fontStyle: 'italic',
          marginBottom: 6, lineHeight: 1.35,
        }}>
          {decisionModelDescription}
        </div>
      )}

      {/* Awareness checkmarks */}
      {awareness && (
        <div style={{
          display: 'flex', gap: 12, marginBottom: 8, fontSize: 10,
          flexWrap: 'wrap',
        }}>
          {[
            { key: 'positionAware', label: 'Position aware' },
            { key: 'boardTextureAware', label: 'Board texture' },
            { key: 'sizingTells', label: 'Sizing tells' },
          ].map(({ key, label }) => {
            const a = awareness[key];
            const detected = a?.detected;
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 6px', borderRadius: R.sm,
                background: detected ? 'rgba(34,197,94,0.08)' : 'rgba(75,85,99,0.1)',
                border: `1px solid ${detected ? 'rgba(34,197,94,0.2)' : 'rgba(75,85,99,0.15)'}`,
              }}>
                <span style={{
                  fontSize: 11, color: detected ? COLOR.green : TEXT.faint,
                  fontWeight: 700,
                }}>
                  {detected ? '\u2713' : '\u2717'}
                </span>
                <span style={{
                  color: detected ? TEXT.secondary : TEXT.faint,
                  fontSize: 9,
                }}>
                  {label}
                </span>
                {a?.detail && (
                  <span style={{ fontSize: 7, color: TEXT.faint, fontFamily: FONT.mono }}>
                    {a.detail}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Showdown anchors */}
      {showdownAnchors?.length > 0 && (
        <div>
          <div style={{
            fontSize: 8, color: TEXT.faint, textTransform: 'uppercase',
            letterSpacing: 0.5, marginBottom: 3, fontWeight: 600,
          }}>
            Showdowns
          </div>
          {showdownAnchors.slice(0, 5).map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 10, color: TEXT.muted, marginBottom: 2,
            }}>
              <span style={{ color: GOLD.base, fontWeight: 600 }}>
                {s.handDescription}
              </span>
              {s.position && (
                <span style={{ fontSize: 8, color: TEXT.faint }}>
                  {s.position}
                </span>
              )}
              {s.line && (
                <span style={{ fontSize: 8, color: TEXT.faint }}>
                  {s.line}
                </span>
              )}
              {s.outcome && (
                <span style={{
                  fontSize: 8, fontWeight: 600,
                  color: s.outcome === 'won' ? COLOR.green : COLOR.red,
                }}>
                  {s.outcome}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const sectionHeader = {
  fontSize: 9, fontWeight: 700, color: TEXT.muted,
  textTransform: 'uppercase', letterSpacing: 0.8,
  marginBottom: 6, paddingBottom: 3,
  borderBottom: `1px solid ${BORDER.default}`,
};
