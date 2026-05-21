/**
 * ExplorerMode — the reference/learning surface for postflop drills.
 *
 * Two range sources (founder ratification, SPR-098 — Range Lab is an expansion
 * INSIDE Explorer, not a new view):
 *   - Archetype: pick a focal (+ optional opposing) preflop context + flop;
 *     RangeFlopBreakdown renders live bucket bars + advantage chips.
 *   - Custom (Range Lab, WS-056): paint an arbitrary 13×13 range, set a 3–5 card
 *     board, persist for the session, and read the same breakdown for the flop.
 *
 * No grading, no progress tracking.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ContextPicker, isValidContext } from './ContextPicker';
import { BoardPicker } from './BoardPicker';
import { RangeFlopBreakdown } from './RangeFlopBreakdown';
import { RangePaintGrid } from './RangePaintGrid';
import { useRangePaint } from './useRangePaint';
import { archetypeRangeFor } from '../../../utils/postflopDrillContent/archetypeRanges';
import { parseBoard } from '../../../utils/pokerCore/cardParser';

const SourceToggle = ({ value, onChange }) => (
  <div className="inline-flex rounded-lg border border-gray-700 bg-gray-900 p-0.5 text-sm">
    {[
      { id: 'archetype', label: 'Archetype' },
      { id: 'custom', label: 'Custom (Range Lab)' },
    ].map((opt) => (
      <button
        key={opt.id}
        type="button"
        onClick={() => onChange(opt.id)}
        className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
          value === opt.id ? 'bg-teal-600 text-white' : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const ToolbarButton = ({ onClick, disabled, children, tone = 'neutral' }) => {
  const tones = {
    neutral: 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700',
    danger: 'bg-rose-900/30 border-rose-800/50 text-rose-300 hover:bg-rose-900/50',
    primary: 'bg-teal-600 border-teal-500 text-white hover:bg-teal-500',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-xs font-semibold border rounded px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${tones[tone]}`}
    >
      {children}
    </button>
  );
};

export const ExplorerMode = () => {
  const [rangeSource, setRangeSource] = useState('archetype');
  const [focalCtx, setFocalCtx] = useState({ position: 'BTN', action: 'open' });
  const [opposingCtx, setOpposingCtx] = useState({ position: 'BB', action: 'call', vs: 'BTN' });
  const [boardCards, setBoardCards] = useState(['K♠', '7♥', '2♦']);
  const [runMc, setRunMc] = useState(false);
  const [confirm, setConfirm] = useState(null); // { message, onConfirm }

  const isCustom = rangeSource === 'custom';
  const paint = useRangePaint({ enabled: isCustom });

  // On entering Custom mode, restore the last-saved painted range + board.
  useEffect(() => {
    if (!isCustom) return;
    const savedBoard = paint.restore();
    if (Array.isArray(savedBoard) && savedBoard.length >= 3) setBoardCards(savedBoard);
    // restore is stable (useCallback); run once per entry into custom mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustom]);

  const { range, opposingRange, board, error } = useMemo(() => {
    try {
      const flopCards = boardCards.slice(0, 3);
      const board = parseBoard(flopCards);
      if (isCustom) {
        return { range: paint.range, opposingRange: null, board, error: null };
      }
      const range = isValidContext(focalCtx) ? archetypeRangeFor(focalCtx) : null;
      const opposingRange = opposingCtx && isValidContext(opposingCtx) ? archetypeRangeFor(opposingCtx) : null;
      return { range, opposingRange, board, error: null };
    } catch (e) {
      return { range: null, opposingRange: null, board: [], error: e.message || String(e) };
    }
  }, [isCustom, paint.range, focalCtx, opposingCtx, boardCards]);

  const flopCards = boardCards.slice(0, 3);
  const boardReady = board.length === 3 && new Set(flopCards).size === 3;
  const hasDupes = new Set(boardCards).size !== boardCards.length;
  const hasExtraStreets = boardCards.length > 3;

  const requestNewRange = () => {
    const doClear = () => { paint.clearAll(); setConfirm(null); };
    if (paint.isDirty) {
      setConfirm({ message: 'Start a new range? Your unsaved painted range will be cleared.', onConfirm: doClear });
    } else {
      doClear();
    }
  };
  const requestClearAll = () =>
    setConfirm({ message: 'Clear the entire range? This cannot be undone.', onConfirm: () => { paint.clearAll(); setConfirm(null); } });

  // ── Custom (Range Lab) layout — controls pinned above; grid + breakdown scroll ──
  if (isCustom) {
    return (
      <div className="flex flex-col gap-3 h-full overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SourceToggle value={rangeSource} onChange={setRangeSource} />
          {paint.isDirty && <span className="text-xs text-amber-400 font-semibold">• Range not saved</span>}
        </div>

        {/* Paint controls (always visible) */}
        <div className="flex items-center gap-2 flex-wrap">
          <ToolbarButton onClick={paint.undo} disabled={!paint.canUndo}>↶ Undo</ToolbarButton>
          <ToolbarButton onClick={paint.redo} disabled={!paint.canRedo}>↷ Redo</ToolbarButton>
          <ToolbarButton onClick={requestClearAll} tone="danger">Clear all</ToolbarButton>
          {paint.isDirty ? (
            <ToolbarButton onClick={() => paint.save(boardCards)} tone="primary">Save Range</ToolbarButton>
          ) : (
            <ToolbarButton onClick={requestNewRange} tone="primary">New Range</ToolbarButton>
          )}
        </div>

        <BoardPicker label="Board" value={boardCards} onChange={setBoardCards} minCards={3} maxCards={5} />

        <div className="grid grid-cols-[auto_1fr] gap-6 items-start flex-1 min-h-0">
          {/* Canonical paint grid */}
          <div className="overflow-y-auto pr-1">
            <RangePaintGrid range={range} onTapCell={paint.tapCell} onApplyWeight={paint.applyWeight} />
          </div>

          {/* Breakdown for the painted range (flop) */}
          <div className="overflow-y-auto pr-2">
            {error ? (
              <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-4 text-sm">{error}</div>
            ) : hasDupes ? (
              <div className="text-sm text-gray-400">Resolve duplicate board cards to see the breakdown.</div>
            ) : !boardReady ? (
              <div className="text-sm text-gray-400">Pick 3 distinct flop cards to see the breakdown.</div>
            ) : (
              <>
                {hasExtraStreets && (
                  <div className="mb-2 text-xs text-gray-400 bg-gray-800/50 border border-gray-800 rounded-md px-3 py-2">
                    Composition below reflects the <span className="text-teal-300">flop</span>. Per-street (turn/river) range evolution arrives in a later Range Lab phase — your painted range and full board are saved.
                  </div>
                )}
                <RangeFlopBreakdown range={range} opposingRange={null} board={board} context={null} opposingContext={null} heroEquityOpts={null} />
              </>
            )}
          </div>
        </div>

        {confirm && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 max-w-sm w-full mx-4">
              <div className="text-sm text-gray-200 mb-4">{confirm.message}</div>
              <div className="flex justify-end gap-2">
                <ToolbarButton onClick={() => setConfirm(null)}>Cancel</ToolbarButton>
                <ToolbarButton onClick={confirm.onConfirm} tone="danger">Confirm</ToolbarButton>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Archetype layout (original) ──
  return (
    <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
      <div className="flex flex-col gap-3 overflow-y-auto pr-2">
        <SourceToggle value={rangeSource} onChange={setRangeSource} />
        <ContextPicker label="Focal range (hero's read)" value={focalCtx} onChange={setFocalCtx} />
        <ContextPicker label="Opposing range (optional)" value={opposingCtx} onChange={setOpposingCtx} allowEmpty />
        <BoardPicker value={boardCards} onChange={setBoardCards} />

        <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-4 text-xs text-gray-400">
          <div className="font-semibold text-gray-300 mb-2">How to read this</div>
          <p className="mb-1">
            <span className="text-teal-300">Tier summary</span> — top-of-screen chips summarize Flush+, Straight+, Set/Trips/2P, TP+, strong/weak draws, and air as %-of-range.
          </p>
          <p className="mb-1">
            <span className="text-teal-300">Hand-type panel</span> shows every made category (overpair, TPTK+, TP-weak, middle pair, etc.) with combo count, weighted %, and average outs. "<span className="text-orange-400">draw N out</span>" = straight/flush outs; "<span className="text-amber-400">imp N out</span>" = pair-to-trips / overcard-to-pair improvement.
          </p>
          <p className="mb-1">
            <span className="text-teal-300">Nut region Δ</span> compares strictly made strong-hand share (straight+ ∪ sets ∪ trips ∪ two-pair). Top pair and overpairs are <span className="italic">not</span> nuts — they're a separate tier.
          </p>
          <p>
            <span className="text-teal-300">Framework chips</span> name the lens that applies. Use them to build a mental library of repeatable patterns (capped ranges, board tilt, etc.).
          </p>
        </div>

        {opposingRange && (
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={runMc} onChange={(e) => setRunMc(e.target.checked)} className="accent-teal-500" />
            Compute MC range-vs-range equity (~1–2 s)
          </label>
        )}
      </div>

      <div className="overflow-y-auto pr-2">
        {error ? (
          <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-4 text-sm">{error}</div>
        ) : !range ? (
          <div className="text-sm text-gray-400">Pick a focal range to begin.</div>
        ) : !boardReady ? (
          <div className="text-sm text-gray-400">Pick 3 distinct flop cards to see the breakdown.</div>
        ) : (
          <RangeFlopBreakdown
            range={range}
            opposingRange={opposingRange}
            board={board}
            context={focalCtx}
            opposingContext={opposingCtx}
            heroEquityOpts={runMc ? { trials: 1200 } : null}
          />
        )}
      </div>
    </div>
  );
};
