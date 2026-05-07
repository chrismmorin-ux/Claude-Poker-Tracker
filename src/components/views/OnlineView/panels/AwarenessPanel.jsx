/**
 * AwarenessPanel.jsx — Villain's awareness indicators + showdown anchors
 *
 * Shows whether villain is position-aware, board-texture-aware, and has
 * sizing tells, plus recent showdown anchors for calibration.
 */

import React from 'react';
import { BORDER, TEXT, GOLD } from '../../../../constants/designTokens';

const GREEN = '#22c55e'; // green-500 — was COLOR.green
const RED = '#ef4444';   // red-500 — was COLOR.red

const SECTION_HEADER_CLASSES = "text-[9px] font-bold uppercase tracking-[0.8px] mb-1.5 pb-[3px] border-b";

export const AwarenessPanel = ({ villainProfile }) => {
  if (!villainProfile) return null;
  const { awareness, showdownAnchors, decisionModelDescription } = villainProfile;
  if (!awareness && !showdownAnchors?.length && !decisionModelDescription) return null;

  return (
    <div className="mb-2.5">
      <div
        className={SECTION_HEADER_CLASSES}
        style={{ color: TEXT.muted, borderBottomColor: BORDER.default }}
      >
        Awareness & Calibration
      </div>

      {/* Decision model description */}
      {decisionModelDescription && (
        <div
          className="text-[10px] italic mb-1.5 leading-[1.35]"
          style={{ color: TEXT.muted }}
        >
          {decisionModelDescription}
        </div>
      )}

      {/* Awareness checkmarks */}
      {awareness && (
        <div className="flex gap-3 mb-2 text-[10px] flex-wrap">
          {[
            { key: 'positionAware', label: 'Position aware' },
            { key: 'boardTextureAware', label: 'Board texture' },
            { key: 'sizingTells', label: 'Sizing tells' },
          ].map(({ key, label }) => {
            const a = awareness[key];
            const detected = a?.detected;
            return (
              <div
                key={key}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-[3px]"
                style={{
                  background: detected ? 'rgba(34,197,94,0.08)' : 'rgba(75,85,99,0.1)',
                  border: `1px solid ${detected ? 'rgba(34,197,94,0.2)' : 'rgba(75,85,99,0.15)'}`,
                }}
              >
                <span
                  className="text-[11px] font-bold"
                  style={{ color: detected ? GREEN : TEXT.faint }}
                >
                  {detected ? '\u2713' : '\u2717'}
                </span>
                <span
                  className="text-[9px]"
                  style={{ color: detected ? TEXT.secondary : TEXT.faint }}
                >
                  {label}
                </span>
                {a?.detail && (
                  <span className="text-[7px] font-mono" style={{ color: TEXT.faint }}>
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
          <div
            className="text-[8px] uppercase tracking-[0.5px] mb-[3px] font-semibold"
            style={{ color: TEXT.faint }}
          >
            Showdowns
          </div>
          {showdownAnchors.slice(0, 5).map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-1 text-[10px] mb-0.5"
              style={{ color: TEXT.muted }}
            >
              <span className="font-semibold" style={{ color: GOLD.base }}>
                {s.handDescription}
              </span>
              {s.position && (
                <span className="text-[8px]" style={{ color: TEXT.faint }}>
                  {s.position}
                </span>
              )}
              {s.line && (
                <span className="text-[8px]" style={{ color: TEXT.faint }}>
                  {s.line}
                </span>
              )}
              {s.outcome && (
                <span
                  className="text-[8px] font-semibold"
                  style={{ color: s.outcome === 'won' ? GREEN : RED }}
                >
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

