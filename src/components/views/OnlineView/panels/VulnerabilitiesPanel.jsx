/**
 * VulnerabilitiesPanel.jsx — Full vulnerabilities list with severity bars
 *
 * Shows all detected vulnerabilities with severity dots, labels,
 * exploit hints, and evidence. Expanded version of VulnerabilityCallout.
 */

import React from 'react';
import { BORDER, TEXT } from '../../../../constants/designTokens';

const RED = '#ef4444';     // red-500 — was COLOR.red
const ORANGE = '#f97316';  // orange-500 — was COLOR.orange
const YELLOW = '#eab308';  // yellow-500 — was COLOR.yellow

const SECTION_HEADER_CLASSES = "text-[9px] font-bold uppercase tracking-[0.8px] mb-1.5 pb-[3px] border-b";

const sevColor = (severity) => {
  if (typeof severity === 'string') {
    return severity === 'high' ? RED : severity === 'medium' ? ORANGE : YELLOW;
  }
  // Numeric 0-1
  if (severity >= 0.7) return RED;
  if (severity >= 0.4) return ORANGE;
  return YELLOW;
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
    <div className="mb-2.5">
      <div
        className={`${SECTION_HEADER_CLASSES} flex justify-between items-center`}
        style={{ color: TEXT.muted, borderBottomColor: BORDER.default }}
      >
        <span>Active Vulnerabilities</span>
        <span className="font-mono text-[8px] font-normal" style={{ color: TEXT.faint }}>
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
          <div
            key={i}
            className="px-2 py-[5px] mb-[3px] border-l-[3px] rounded-r-[3px]"
            style={{
              borderLeftColor: sc,
              background: `${sc}08`,
            }}
          >
            {/* Top row: severity bar + label + severity tag */}
            <div className="flex items-center gap-1.5 mb-0.5">
              {/* Severity bar */}
              <div className="w-[30px] h-[3px] bg-gray-700 rounded-sm shrink-0">
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${barWidth}%`,
                    background: sc,
                  }}
                />
              </div>

              {/* Label */}
              <span
                className="text-[10px] font-semibold flex-1 leading-[1.2]"
                style={{ color: TEXT.primary }}
              >
                {v.label || v.description || v.id}
              </span>

              {/* Severity tag */}
              <span
                className="text-[7px] font-bold uppercase shrink-0"
                style={{ color: sc }}
              >
                {sl}
              </span>
            </div>

            {/* Exploit hint */}
            {v.exploitHint && (
              <div className="text-[9px] italic text-[#4b8bbf] leading-[1.3] pl-9">
                {v.exploitHint}
              </div>
            )}

            {/* Evidence */}
            {v.evidence && (
              <div
                className="font-mono text-[8px] pl-9 mt-px"
                style={{ color: TEXT.faint }}
              >
                {v.evidence}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
