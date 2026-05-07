/**
 * ModelAuditPanel.jsx — Model transparency & audit trail
 *
 * Shows where the analysis data came from: data source, effective N,
 * compute time, tree depth, cache stats, Bayesian confidence.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT } from '../../../../constants/designTokens';

const GREEN = '#22c55e';   // green-500 — was GREEN
const YELLOW = '#eab308';  // yellow-500 — was YELLOW
const CYAN = '#22d3ee';    // cyan-400 — was CYAN
const PURPLE = '#a78bfa';  // violet-400 — was PURPLE

const SECTION_HEADER_CLASSES = "text-[9px] font-bold uppercase tracking-[0.8px] mb-1.5 pb-[3px] border-b";

const SOURCE_COLORS = {
  'model+observed': GREEN,
  'observed': GREEN,
  'model': YELLOW,
  'style': YELLOW,
  'population': TEXT.faint,
  'personalized': GREEN,
};

const AuditRow = ({ label, value, valueColor }) => (
  <div className="flex justify-between items-center py-0.5 text-[9px]">
    <span style={{ color: TEXT.muted }}>{label}</span>
    <span
      className="font-mono font-semibold"
      style={{ color: valueColor || TEXT.primary }}
    >
      {value}
    </span>
  </div>
);

export const ModelAuditPanel = ({ treeMetadata, foldMeta, modelQuality, dataQuality }) => {
  if (!treeMetadata) return null;

  const source = foldMeta?.bet?.source || modelQuality?.overallSource || 'population';
  const sourceColor = SOURCE_COLORS[source] || TEXT.faint;
  const observedN = foldMeta?.bet?.observedN;
  const quality = dataQuality?.tier;

  return (
    <div className="mb-2.5">
      <div
        className={SECTION_HEADER_CLASSES}
        style={{ color: TEXT.muted, borderBottomColor: BORDER.default }}
      >
        Model Audit
      </div>

      <div
        className="rounded-[5px] px-2 py-1.5 border"
        style={{ background: SURFACE.inset, borderColor: BORDER.default }}
      >
        <AuditRow label="Data source" value={source} valueColor={sourceColor} />
        {observedN != null && (
          <AuditRow label="Effective N" value={`${observedN} observations`} />
        )}
        {quality && (
          <AuditRow
            label="Model quality"
            value={quality.charAt(0).toUpperCase() + quality.slice(1)}
            valueColor={quality === 'high' ? GREEN : quality === 'developing' ? YELLOW : TEXT.muted}
          />
        )}
        {treeMetadata.depth != null && (
          <AuditRow label="Tree depth" value={`D${treeMetadata.depthReached || treeMetadata.depth}`} />
        )}
        {treeMetadata.branches != null && (
          <AuditRow label="Branches evaluated" value={`${treeMetadata.branches} actions`} />
        )}
        {treeMetadata.refinedActions != null && (
          <AuditRow label="Depth-2 refined" value={`${treeMetadata.refinedActions} actions`} />
        )}
        {treeMetadata.computeMs != null && (
          <AuditRow label="Compute time" value={`${treeMetadata.computeMs}ms`} />
        )}
        {treeMetadata.spr != null && (
          <AuditRow label="SPR" value={`${treeMetadata.spr.toFixed(1)} (${treeMetadata.sprZone || '?'})`} />
        )}
        {treeMetadata.numOpponents != null && (
          <AuditRow label="Opponents" value={treeMetadata.numOpponents} />
        )}

        {/* Flags row */}
        <div
          className="flex flex-wrap gap-1 mt-1 pt-1 border-t"
          style={{ borderTopColor: BORDER.default }}
        >
          {treeMetadata.comboCounted && (
            <FlagPill label="Combo-counted" color={GREEN} />
          )}
          {treeMetadata.dynamicAnchors && (
            <FlagPill label="Dynamic anchors" color={GREEN} />
          )}
          {treeMetadata.rakeActive && (
            <FlagPill label="Rake adjusted" color={CYAN} />
          )}
          {treeMetadata.depth3 && (
            <FlagPill label="Depth-3" color={PURPLE} />
          )}
          {treeMetadata.callDepth2 && (
            <FlagPill label="Call D2" color={TEXT.muted} />
          )}
          {treeMetadata.betDepth2 && (
            <FlagPill label="Bet D2" color={TEXT.muted} />
          )}
        </div>

        {/* Fold curve source */}
        {foldMeta?.bet?.curveSource && (
          <div
            className="mt-1 pt-1 border-t text-[8px]"
            style={{ borderTopColor: BORDER.default, color: TEXT.faint }}
          >
            Fold curve: {foldMeta.bet.curveSource}
          </div>
        )}
      </div>
    </div>
  );
};

const FlagPill = ({ label, color }) => (
  <span
    className="font-mono text-[7px] font-semibold px-1 py-px rounded-sm"
    style={{
      background: `${color}15`,
      color,
      border: `1px solid ${color}30`,
    }}
  >
    {label}
  </span>
);
