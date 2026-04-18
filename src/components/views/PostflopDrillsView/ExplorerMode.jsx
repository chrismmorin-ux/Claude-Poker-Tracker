/**
 * ExplorerMode — the reference/learning surface for postflop drills.
 *
 * User picks a focal preflop context (optional opposing context) + a flop;
 * RangeFlopBreakdown renders live bucket bars + advantage chips + framework
 * narrations. No grading, no progress tracking.
 */

import React, { useMemo, useState } from 'react';
import { ContextPicker, isValidContext } from './ContextPicker';
import { BoardPicker } from './BoardPicker';
import { RangeFlopBreakdown } from './RangeFlopBreakdown';
import { archetypeRangeFor } from '../../../utils/postflopDrillContent/archetypeRanges';
import { parseBoard } from '../../../utils/pokerCore/cardParser';

export const ExplorerMode = () => {
  const [focalCtx, setFocalCtx] = useState({ position: 'BTN', action: 'open' });
  const [opposingCtx, setOpposingCtx] = useState({ position: 'BB', action: 'call', vs: 'BTN' });
  const [boardCards, setBoardCards] = useState(['K♠', '7♥', '2♦']);
  const [runMc, setRunMc] = useState(false);

  const { range, opposingRange, board, error } = useMemo(() => {
    try {
      const range = isValidContext(focalCtx) ? archetypeRangeFor(focalCtx) : null;
      const opposingRange = opposingCtx && isValidContext(opposingCtx) ? archetypeRangeFor(opposingCtx) : null;
      const board = parseBoard(boardCards);
      return { range, opposingRange, board, error: null };
    } catch (e) {
      return { range: null, opposingRange: null, board: [], error: e.message || String(e) };
    }
  }, [focalCtx, opposingCtx, boardCards]);

  const boardReady = board.length === 3 && new Set(boardCards).size === 3;

  return (
    <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
      <div className="flex flex-col gap-3 overflow-y-auto pr-2">
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
