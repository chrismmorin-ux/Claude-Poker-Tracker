/**
 * ModelAuditPanel.jsx — Model transparency & audit trail
 *
 * Shows where the analysis data came from: data source, effective N,
 * compute time, tree depth, cache stats, Bayesian confidence.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, FONT, COLOR, GOLD, R } from '../panelTokens';

const SOURCE_COLORS = {
  'model+observed': COLOR.green,
  'observed': COLOR.green,
  'model': COLOR.yellow,
  'style': COLOR.yellow,
  'population': TEXT.faint,
  'personalized': COLOR.green,
};

const AuditRow = ({ label, value, valueColor }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '2px 0', fontSize: 9,
  }}>
    <span style={{ color: TEXT.muted }}>{label}</span>
    <span style={{
      fontFamily: FONT.mono, fontWeight: 600,
      color: valueColor || TEXT.primary,
    }}>
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
    <div style={{ marginBottom: 10 }}>
      <div style={sectionHeader}>Model Audit</div>

      <div style={{
        background: SURFACE.inset, borderRadius: R.md, padding: '6px 8px',
        border: `1px solid ${BORDER.default}`,
      }}>
        <AuditRow label="Data source" value={source} valueColor={sourceColor} />
        {observedN != null && (
          <AuditRow label="Effective N" value={`${observedN} observations`} />
        )}
        {quality && (
          <AuditRow
            label="Model quality"
            value={quality.charAt(0).toUpperCase() + quality.slice(1)}
            valueColor={quality === 'high' ? COLOR.green : quality === 'developing' ? COLOR.yellow : TEXT.muted}
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
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, paddingTop: 4,
          borderTop: `1px solid ${BORDER.default}`,
        }}>
          {treeMetadata.comboCounted && (
            <FlagPill label="Combo-counted" color={COLOR.green} />
          )}
          {treeMetadata.dynamicAnchors && (
            <FlagPill label="Dynamic anchors" color={COLOR.green} />
          )}
          {treeMetadata.rakeActive && (
            <FlagPill label="Rake adjusted" color={COLOR.cyan} />
          )}
          {treeMetadata.depth3 && (
            <FlagPill label="Depth-3" color={COLOR.purple} />
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
          <div style={{
            marginTop: 4, paddingTop: 4, borderTop: `1px solid ${BORDER.default}`,
            fontSize: 8, color: TEXT.faint,
          }}>
            Fold curve: {foldMeta.bet.curveSource}
          </div>
        )}
      </div>
    </div>
  );
};

const FlagPill = ({ label, color }) => (
  <span style={{
    fontSize: 7, fontFamily: FONT.mono, fontWeight: 600,
    padding: '1px 4px', borderRadius: 2,
    background: `${color}15`, color, border: `1px solid ${color}30`,
  }}>
    {label}
  </span>
);

const sectionHeader = {
  fontSize: 9, fontWeight: 700, color: TEXT.muted,
  textTransform: 'uppercase', letterSpacing: 0.8,
  marginBottom: 6, paddingBottom: 3,
  borderBottom: `1px solid ${BORDER.default}`,
};
