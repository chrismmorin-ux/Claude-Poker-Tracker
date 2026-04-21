/**
 * SPITooltip — breakdown popover explaining a line's Study Priority Index.
 *
 * Rendered below the card on click-expand. Shows the three factor inputs
 * (position-pair frequency × pot-type frequency × board-class frequency)
 * plus the dominant node's reach probability, pot size, and difficulty bonus.
 */

import React from 'react';
import { explainSPI } from '../../../utils/postflopDrillContent/studyPriorityIndex';

const fmtPct = (p) => {
  const v = p * 100;
  if (v === 0) return '0%';
  if (v < 0.01) return `${v.toFixed(4)}%`;
  if (v < 1) return `${v.toFixed(3)}%`;
  return `${v.toFixed(2)}%`;
};

export const SPITooltip = ({ line, onClose }) => {
  if (!line) return null;
  const x = explainSPI(line);

  return (
    <div className="mt-3 bg-gray-900/80 border border-gray-700 rounded-lg p-3 text-xs text-gray-300">
      <div className="flex items-center justify-between mb-2">
        <div className="uppercase tracking-wide text-gray-500">Why SPI {Math.round(x.score)}</div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-[10px] uppercase"
          >
            Hide
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <FactorCell label="Position pair" labelSub={x.factors.positionLabel} value={fmtPct(x.factors.positionFactor)} />
        <FactorCell label="Pot type"      labelSub={x.factors.potTypeLabel}  value={fmtPct(x.factors.potTypeFactor)} />
        <FactorCell label="Board class"   labelSub={x.factors.boardTagsLabel} value={fmtPct(x.factors.boardFactor)} />
      </div>

      <div className="pt-2 border-t border-gray-800">
        <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">
          Dominant node
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap text-[11px]">
          <span>
            <span className="font-mono text-amber-300">{x.dominantNode.street}</span>
            {' · '}
            <span className="text-gray-400">pot</span>{' '}
            <span className="font-mono text-gray-100">{x.dominantNode.potBB}bb</span>
          </span>
          <span>
            <span className="text-gray-400">reach</span>{' '}
            <span className="font-mono text-gray-100">{fmtPct(x.dominantNode.reachProbability)}</span>
          </span>
          <span>
            <span className="text-gray-400">log-freq</span>{' '}
            <span className="font-mono text-gray-100">{x.dominantNode.logFreqComponent.toFixed(2)}</span>
          </span>
          <span>
            <span className="text-gray-400">diff+</span>{' '}
            <span className="font-mono text-gray-100">{x.dominantNode.difficultyBonus.toFixed(2)}</span>
          </span>
        </div>
        <div className="mt-2 text-[10px] text-gray-500 italic">
          SPI = log₁₀(reach × 1M) × potBB × (1 + difficulty)
        </div>
      </div>
    </div>
  );
};

const FactorCell = ({ label, labelSub, value }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
    <div className="font-mono text-gray-100 text-sm tabular-nums">{value}</div>
    <div className="text-[10px] text-gray-400 truncate" title={labelSub}>{labelSub}</div>
  </div>
);
