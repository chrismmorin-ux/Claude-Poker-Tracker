/**
 * useRangePaint — paint state for the Range Lab Custom range source (WS-056).
 *
 * Owns a 169-cell Float64Array of per-combo weights plus a PER-STROKE undo/redo
 * stack (ADR-008): every atomic paint action (tap-toggle, slider-Apply) is one
 * entry. "Clear all" is a separate destructive action that resets the range and
 * BOTH stacks — it is intentionally NOT undo-recoverable (the caller gates it
 * behind a confirmation per ADR-008 / E-A3).
 *
 * Persistence (session-scoped, sessionStorage) is delegated to
 * rangeLabPersistence; `save()` writes, `restore()` reads. Durable cross-session
 * saved-ranges are Phase 5.
 *
 * Cmd-Z / Cmd-Shift-Z (and Ctrl variants) are bound while `enabled` so undo/redo
 * matches industry tools (Anki/Figma/Photoshop) per ADR-008.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRange } from '../../../utils/pokerCore/rangeMatrix';
import { saveRangeLabState, loadRangeLabState } from '../../../utils/postflopDrillContent/rangeLabPersistence';

const cloneRange = (r) => Float64Array.from(r);

/**
 * @param {object} [opts]
 * @param {boolean} [opts.enabled=true] - bind keyboard undo/redo only while active
 */
export const useRangePaint = ({ enabled = true } = {}) => {
  const [range, setRange] = useState(() => createRange());
  const [undoStack, setUndoStack] = useState([]); // [{ idx, priorWeight, newWeight }]
  const [redoStack, setRedoStack] = useState([]);
  const [isDirty, setIsDirty] = useState(false);

  // Apply a single-cell weight change as one atomic, undoable stroke.
  const commitStroke = useCallback((idx, newWeight) => {
    setRange((prev) => {
      const priorWeight = prev[idx] || 0;
      if (priorWeight === newWeight) return prev; // no-op, no stroke
      const next = cloneRange(prev);
      next[idx] = newWeight;
      setUndoStack((s) => [...s, { idx, priorWeight, newWeight }]);
      setRedoStack([]); // any new mutation clears redo
      setIsDirty(true);
      return next;
    });
  }, []);

  /** Tap a cell: empty → 100%, included → excluded. One undo entry. */
  const tapCell = useCallback((idx) => {
    setRange((prev) => {
      const priorWeight = prev[idx] || 0;
      const newWeight = priorWeight > 0 ? 0 : 1;
      const next = cloneRange(prev);
      next[idx] = newWeight;
      setUndoStack((s) => [...s, { idx, priorWeight, newWeight }]);
      setRedoStack([]);
      setIsDirty(true);
      return next;
    });
  }, []);

  /** Long-press → slider → Apply: set an explicit weight in [0,1]. One undo entry. */
  const applyWeight = useCallback((idx, weight) => {
    const clamped = Math.max(0, Math.min(1, weight));
    commitStroke(idx, clamped);
  }, [commitStroke]);

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const entry = stack[stack.length - 1];
      setRange((prev) => {
        const next = cloneRange(prev);
        next[entry.idx] = entry.priorWeight;
        return next;
      });
      setRedoStack((r) => [...r, entry]);
      setIsDirty(true);
      return stack.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const entry = stack[stack.length - 1];
      setRange((prev) => {
        const next = cloneRange(prev);
        next[entry.idx] = entry.newWeight;
        return next;
      });
      setUndoStack((u) => [...u, entry]);
      setIsDirty(true);
      return stack.slice(0, -1);
    });
  }, []);

  /** Destructive reset — empties the range and BOTH stacks (NOT undo-recoverable). */
  const clearAll = useCallback(() => {
    setRange(createRange());
    setUndoStack([]);
    setRedoStack([]);
    setIsDirty(true);
  }, []);

  /**
   * Replace the range wholesale (clears BOTH stacks + dirty flag). Used by a
   * parent that owns coordinated restore across multiple paint instances
   * (Range Lab Phase 2b compare mode); a fresh externally-supplied range has no
   * meaningful local undo history. Falls back to an empty range if given null.
   */
  const setRangeExternal = useCallback((nextRange) => {
    setRange(nextRange instanceof Float64Array ? cloneRange(nextRange) : createRange());
    setUndoStack([]);
    setRedoStack([]);
    setIsDirty(false);
  }, []);

  /**
   * Persist current range + board to the session; clears the dirty flag.
   * `extra` is merged into the persisted blob (Phase 2b passes the comparison
   * range B + compareOn flag so one Save writes the whole Range Lab state).
   */
  const save = useCallback((board, extra = {}) => {
    const ok = saveRangeLabState({ range, board, ...extra });
    if (ok) setIsDirty(false);
    return ok;
  }, [range]);

  /**
   * Clear the dirty flag WITHOUT writing storage. Used when a sibling paint
   * instance owns the coordinated write (Phase 2b: Save A writes both ranges,
   * then B is marked saved here).
   */
  const markSaved = useCallback(() => setIsDirty(false), []);

  /**
   * Restore the last-saved range from the session. Returns the saved board (if
   * any) so the caller can re-sync board state, or null if nothing was saved.
   */
  const restore = useCallback(() => {
    const saved = loadRangeLabState();
    if (!saved) return null;
    setRange(saved.range);
    setUndoStack([]);
    setRedoStack([]);
    setIsDirty(false);
    return saved.board;
  }, []);

  // Keyboard undo/redo (Cmd/Ctrl-Z, Cmd/Ctrl-Shift-Z) while active.
  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, undo, redo]);

  return {
    range,
    isDirty,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    tapCell,
    applyWeight,
    undo,
    redo,
    clearAll,
    setRange: setRangeExternal,
    save,
    markSaved,
    restore,
  };
};
