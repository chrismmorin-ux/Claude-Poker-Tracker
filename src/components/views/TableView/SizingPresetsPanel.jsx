/**
 * SizingPresetsPanel.jsx — Sizing presets grid, editor popup, and custom amount form
 *
 * Displays bet/raise sizing options with long-press to customize.
 * Includes inline sizing editor for adjusting multipliers/fractions.
 */

import React from 'react';
import { getActionGradient, ACTION_COLORS } from '../../../constants/designTokens';

export const SizingPresetsPanel = ({
  sizingOptions, sizingAction, minRaise,
  customValue, setCustomValue,
  sizingEditorOpen, setSizingEditorOpen,
  editorValues, setEditorValues,
  sizingKey, potTotal, currentBet, blindsBb,
  onSizeSelected, onCustomSubmit,
  onSizingLongPressStart, onSizingLongPressEnd,
  onSaveSizing, onResetSizing,
  engineOptimal,
}) => {
  if (!sizingAction || sizingOptions.length === 0) return null;

  // Find closest preset to engine optimal
  const optimalAmount = engineOptimal?.sizing?.betSize;
  const optimalEV = engineOptimal?.ev;
  const closestIdx = optimalAmount != null
    ? sizingOptions.reduce((best, opt, idx) => {
        const dist = Math.abs(opt.amount - optimalAmount);
        return dist < best.dist ? { idx, dist } : best;
      }, { idx: -1, dist: Infinity }).idx
    : -1;
  // Only highlight if the closest preset is within 25% of optimal
  const isCloseEnough = closestIdx >= 0 && optimalAmount > 0
    && Math.abs(sizingOptions[closestIdx].amount - optimalAmount) / optimalAmount < 0.25;

  return (
    <div className="p-2 rounded-lg" style={{ background: 'var(--panel-surface)', border: '1px solid var(--panel-border)' }}>
      {/* Engine suggestion (when optimal doesn't match any preset well) */}
      {optimalAmount != null && !isCloseEnough && (
        <div style={{
          fontSize: 10, color: '#d4a847', padding: '3px 8px', marginBottom: 4,
          background: '#d4a84715', borderRadius: 4, textAlign: 'center',
        }}>
          Engine: {engineOptimal.sizing.betFraction != null ? `${Math.round(engineOptimal.sizing.betFraction * 100)}% pot ` : ''}
          <span style={{ fontWeight: 700 }}>${Math.round(optimalAmount)}</span>
          {optimalEV != null && (
            <span style={{ color: optimalEV > 0 ? '#22c55e' : '#ef4444', marginLeft: 4 }}>
              {optimalEV >= 0 ? '+' : ''}{optimalEV.toFixed(1)} EV
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5 mb-1.5">
        {sizingOptions.map(({ label, amount }, idx) => {
          const isOptimal = isCloseEnough && idx === closestIdx;
          return (
            <button
              key={label}
              onClick={() => onSizeSelected(amount)}
              onMouseDown={onSizingLongPressStart}
              onMouseUp={onSizingLongPressEnd}
              onMouseLeave={onSizingLongPressEnd}
              onTouchStart={onSizingLongPressStart}
              onTouchEnd={onSizingLongPressEnd}
              className="btn-press rounded-md font-bold text-white shadow"
              style={{
                height: '68px', background: getActionGradient('bet'), fontSize: '15px',
                ...(isOptimal ? { boxShadow: '0 0 0 2px #d4a847', border: '2px solid #d4a847' } : {}),
              }}
            >
              <div style={{ fontSize: '20px', fontWeight: 800 }}>${amount}</div>
              <div style={{ fontSize: '11px', opacity: 0.65 }}>{label}</div>
              {isOptimal && optimalEV != null && (
                <div style={{ fontSize: 9, color: optimalEV > 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                  {optimalEV >= 0 ? '+' : ''}{optimalEV.toFixed(1)} EV
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Sizing Editor Popup */}
      {sizingEditorOpen && (
        <div className="mb-2 p-2 rounded-lg" style={{ background: '#1a1d23', border: '1px solid var(--gold)' }}>
          <div className="text-white font-bold mb-2" style={{ fontSize: '13px' }}>
            Customize {sizingKey?.replace('_', ' ')}
          </div>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {editorValues.map((val, idx) => {
              const isPostflopBet = sizingKey === 'postflop_bet';
              const base = isPostflopBet ? (potTotal || 1) : (sizingKey === 'preflop_open' ? blindsBb : currentBet || blindsBb);
              const dollarAmount = Math.round(base * val);
              return (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => {
                      const newVals = [...editorValues];
                      newVals[idx] = parseFloat(e.target.value) || 0;
                      setEditorValues(newVals);
                    }}
                    step="any"
                    className="w-full px-1 rounded text-white text-center font-semibold focus:outline-none"
                    style={{ height: '36px', fontSize: '14px', background: '#374151', border: '1px solid var(--panel-border)' }}
                  />
                  <span className="text-gray-400" style={{ fontSize: '11px' }}>${dollarAmount}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={onSaveSizing}
              className="btn-press flex-1 rounded font-bold text-white"
              style={{ height: '36px', fontSize: '13px', background: '#166534' }}
            >
              Save
            </button>
            <button
              onClick={onResetSizing}
              className="btn-press flex-1 rounded font-bold text-white"
              style={{ height: '36px', fontSize: '13px', background: '#374151' }}
            >
              Reset
            </button>
            <button
              onClick={() => setSizingEditorOpen(false)}
              className="btn-press flex-1 rounded font-bold text-white"
              style={{ height: '36px', fontSize: '13px', background: '#374151' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <form onSubmit={onCustomSubmit} className="flex gap-1.5">
        <div className="flex-1 flex items-center gap-1">
          <span className="text-gray-500 font-bold" style={{ fontSize: '15px' }}>$</span>
          <input
            type="number"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder={`Min $${minRaise}`}
            min={minRaise}
            step="any"
            className="w-full px-3 rounded text-white font-semibold focus:outline-none"
            style={{ height: '48px', fontSize: '15px', background: '#1a1d23', border: '1px solid var(--panel-border)' }}
          />
        </div>
        <button
          type="submit"
          disabled={!customValue || parseFloat(customValue) < minRaise}
          className="btn-press px-5 rounded font-bold text-white"
            style={{ height: '48px', fontSize: '15px', background: !customValue || parseFloat(customValue) < minRaise ? '#374151' : ACTION_COLORS.bet.base }}
        >
          GO
        </button>
      </form>
    </div>
  );
};
