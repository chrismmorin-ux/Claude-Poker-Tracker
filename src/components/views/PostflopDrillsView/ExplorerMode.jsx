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
import { SubrangeFilter } from './SubrangeFilter';
import { EquityHistogram } from './EquityHistogram';
import { useRangePaint } from './useRangePaint';
import { archetypeRangeFor } from '../../../utils/postflopDrillContent/archetypeRanges';
import { handTypeBreakdown } from '../../../utils/postflopDrillContent/handTypeBreakdown';
import { filterCombosByGroups } from '../../../utils/postflopDrillContent/rangeEquityHistogram';
import { loadRangeLabState } from '../../../utils/postflopDrillContent/rangeLabPersistence';
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
  const [subrangeGroups, setSubrangeGroups] = useState(() => new Set()); // Range Lab subrange filter (empty = all)
  // Range Lab Phase 2b (WS-210): range-vs-range comparison.
  const [compareOn, setCompareOn] = useState(false);
  const [focusedGrid, setFocusedGrid] = useState('A'); // which grid keyboard undo + toolbar target
  const [runCompareMc, setRunCompareMc] = useState(false); // gate the A-vs-B MC equity

  const isCustom = rangeSource === 'custom';
  // Keyboard undo binds to the focused grid only — paint A is active unless we're
  // comparing and the user last touched grid B.
  const paint = useRangePaint({ enabled: isCustom && (!compareOn || focusedGrid === 'A') });
  const paintB = useRangePaint({ enabled: isCustom && compareOn && focusedGrid === 'B' });
  const activePaint = compareOn && focusedGrid === 'B' ? paintB : paint;

  // On entering Custom mode, restore the last-saved painted range(s) + board +
  // compare flag (coordinated across both paint instances).
  useEffect(() => {
    if (!isCustom) return;
    const saved = loadRangeLabState();
    if (saved) {
      paint.setRange(saved.range);
      if (saved.rangeB) paintB.setRange(saved.rangeB);
      if (Array.isArray(saved.board) && saved.board.length >= 3) setBoardCards(saved.board);
      setCompareOn(!!saved.compareOn);
    }
    // setRange hooks are stable (useCallback); run once per entry into custom mode.
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

  // Range Lab Phase 2 (WS-057): subrange filter + equity-histogram inputs.
  // Classify the painted range once on the flop; the histogram consumes the
  // filtered combo set. handType classification feeds SELECTION only — equity
  // is computed separately from card math (AP-RL-01).
  const subrange = useMemo(() => {
    if (!isCustom || !boardReady || error || hasDupes || !range) return null;
    try {
      const bd = handTypeBreakdown(range, board);
      const filtered = filterCombosByGroups(bd.engine, subrangeGroups);
      const weightSum = filtered.reduce((s, c) => s + c.weight, 0);
      const histKey = `${board.join(',')}|${[...subrangeGroups].sort().join(',')}|${filtered.length}|${weightSum.toFixed(3)}`;
      return { byGroup: bd.byGroup, filtered, histKey };
    } catch {
      return null;
    }
  }, [isCustom, boardReady, error, hasDupes, range, board, subrangeGroups]);

  // In compare mode, undo/redo/clear act on the focused grid; Save is global.
  const activeLabel = compareOn ? (focusedGrid === 'B' ? 'Range B' : 'Range A') : null;
  const anyDirty = paint.isDirty || (compareOn && paintB.isDirty);

  const requestNewRange = () => {
    const doClear = () => { activePaint.clearAll(); setConfirm(null); };
    if (activePaint.isDirty) {
      setConfirm({ message: `Start a new ${activeLabel || 'range'}? Your unsaved painted range will be cleared.`, onConfirm: doClear });
    } else {
      doClear();
    }
  };
  const requestClearAll = () =>
    setConfirm({ message: `Clear the entire ${activeLabel || 'range'}? This cannot be undone.`, onConfirm: () => { activePaint.clearAll(); setConfirm(null); } });

  // One Save writes the whole Range Lab state (A + optional B + board + compare flag).
  const handleSave = () => {
    const ok = paint.save(boardCards, { rangeB: compareOn ? paintB.range : null, compareOn });
    if (ok && compareOn) paintB.markSaved();
  };

  // ── Custom (Range Lab) layout — controls pinned above; grid + breakdown scroll ──
  if (isCustom) {
    return (
      <div className="flex flex-col gap-3 h-full overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <SourceToggle value={rangeSource} onChange={setRangeSource} />
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={compareOn} onChange={(e) => setCompareOn(e.target.checked)} className="accent-teal-500" />
              Compare ranges
            </label>
          </div>
          {anyDirty && <span className="text-xs text-amber-400 font-semibold">• Range not saved</span>}
        </div>

        {/* Paint controls — undo/redo/clear target the focused grid; Save is global */}
        <div className="flex items-center gap-2 flex-wrap">
          {compareOn && (
            <span className="text-xs text-gray-400">Editing: <span className="text-teal-300 font-semibold">{activeLabel}</span></span>
          )}
          <ToolbarButton onClick={activePaint.undo} disabled={!activePaint.canUndo}>↶ Undo</ToolbarButton>
          <ToolbarButton onClick={activePaint.redo} disabled={!activePaint.canRedo}>↷ Redo</ToolbarButton>
          <ToolbarButton onClick={requestClearAll} tone="danger">Clear{compareOn ? ` ${activeLabel}` : ' all'}</ToolbarButton>
          {anyDirty ? (
            <ToolbarButton onClick={handleSave} tone="primary">Save Range{compareOn ? 's' : ''}</ToolbarButton>
          ) : (
            <ToolbarButton onClick={requestNewRange} tone="primary">New {compareOn ? activeLabel : 'Range'}</ToolbarButton>
          )}
        </div>

        <BoardPicker label="Board" value={boardCards} onChange={setBoardCards} minCards={3} maxCards={5} />

        <div className="grid grid-cols-[auto_1fr] gap-6 items-start flex-1 min-h-0">
          {/* Paint grid(s) — single (A) or two side by side (A + B) when comparing */}
          <div className="overflow-y-auto pr-1">
            {compareOn ? (
              <div className="flex gap-3">
                {[
                  { id: 'A', p: paint },
                  { id: 'B', p: paintB },
                ].map(({ id, p }) => (
                  <div
                    key={id}
                    onPointerDownCapture={() => setFocusedGrid(id)}
                    className={`rounded-lg p-1.5 border transition-colors ${
                      focusedGrid === id ? 'border-teal-500 bg-teal-900/10' : 'border-gray-800'
                    }`}
                  >
                    <div className="text-[11px] font-semibold mb-1 text-center text-gray-300">
                      Range {id}
                      {p.isDirty && <span className="text-amber-400"> •</span>}
                    </div>
                    <RangePaintGrid range={p.range} onTapCell={p.tapCell} onApplyWeight={p.applyWeight} />
                  </div>
                ))}
              </div>
            ) : (
              <RangePaintGrid range={range} onTapCell={paint.tapCell} onApplyWeight={paint.applyWeight} />
            )}
          </div>

          {/* Breakdown — single range (A) or A-vs-B comparison when comparing */}
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
                {compareOn && (
                  <label className="flex items-center gap-2 text-xs text-gray-300 mb-2">
                    <input type="checkbox" checked={runCompareMc} onChange={(e) => setRunCompareMc(e.target.checked)} className="accent-teal-500" />
                    Compute Range A vs Range B equity (~1–2 s)
                  </label>
                )}
                <RangeFlopBreakdown
                  range={range}
                  opposingRange={compareOn ? paintB.range : null}
                  board={board}
                  context={null}
                  opposingContext={null}
                  heroEquityOpts={compareOn && runCompareMc ? { trials: 1200 } : null}
                />
                {subrange && (
                  <div className="mt-3 space-y-3">
                    {compareOn && <div className="text-[11px] text-gray-500">Subrange filter + equity histogram below apply to <span className="text-teal-300">Range A</span>.</div>}
                    <SubrangeFilter byGroup={subrange.byGroup} value={subrangeGroups} onChange={setSubrangeGroups} />
                    <EquityHistogram combos={subrange.filtered} board={board} inputKey={subrange.histKey} />
                  </div>
                )}
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
