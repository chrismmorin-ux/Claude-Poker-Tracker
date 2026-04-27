/**
 * PrintControls.jsx — print-preference controls panel.
 *
 * Lets the owner choose page size, cards-per-sheet, color mode, and the
 * include-lineage toggle. Settings persist to `userRefresherConfig.printPreferences`
 * via `refresher.patchConfig({ printPreferences })` (W-URC-1). Changes are
 * debounced 400ms so rapid toggling doesn't spam IDB writes.
 *
 * The Phase 2+ "Include personal codex" toggle is RENDERED but DISABLED with
 * a tooltip. The W-URC-1 writer rejects `printPreferences.includeCodex: true`
 * per AP-PRF-09 + red line #16; rendering the disabled toggle communicates
 * the future capability without enabling it.
 *
 * Spec: docs/design/surfaces/printable-refresher.md §PrintPreview / PrintControls.
 *
 * PRF Phase 5 — Session 21 (PRF-G5-UI).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRefresher } from '../../../contexts';

const PAGE_SIZES = ['letter', 'a4'];
const CARDS_PER_SHEET = [12, 6, 4, 1];
const COLOR_MODES = ['auto', 'bw'];

const DEBOUNCE_MS = 400;

const SECTION_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
};

const LABEL_STYLE = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginRight: '0.25rem',
};

const TOGGLE_BUTTON_STYLE = {
  minHeight: 44,
  minWidth: 44,
  padding: '0.375rem 0.75rem',
  background: '#1f2937',
  color: '#e5e7eb',
  // Longhand only — React warns if we mix `border` shorthand with `borderColor`
  // longhand when state toggles between active/inactive.
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#374151',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  fontSize: '0.8125rem',
};

const TOGGLE_BUTTON_ACTIVE_STYLE = {
  background: '#374151',
  color: '#fff',
  borderColor: '#6b7280',
};

const COLOR_MODE_LABELS = { auto: 'Color (auto)', bw: 'Black & white' };
const PAGE_SIZE_LABELS = { letter: 'Letter (8.5×11)', a4: 'A4 (21×29.7cm)' };

export const PrintControls = () => {
  const refresher = useRefresher();
  const prefs = refresher.config?.printPreferences || {};
  const [errorMessage, setErrorMessage] = useState(null);
  const debounceTimerRef = useRef(null);
  const pendingPatchRef = useRef(null);

  // Cleanup pending debounced write on unmount.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Schedule a debounced patchConfig call. Repeated calls within the debounce
   * window collapse the patch (Object.assign over pendingPatchRef.current.printPreferences).
   */
  const scheduleWrite = useCallback(
    (patch) => {
      pendingPatchRef.current = {
        printPreferences: {
          ...(pendingPatchRef.current?.printPreferences || {}),
          ...patch.printPreferences,
        },
      };
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(async () => {
        const toFlush = pendingPatchRef.current;
        pendingPatchRef.current = null;
        debounceTimerRef.current = null;
        try {
          await refresher.patchConfig(toFlush);
          setErrorMessage(null);
        } catch (err) {
          setErrorMessage(err.message || 'Failed to update print preferences.');
        }
      }, DEBOUNCE_MS);
    },
    [refresher],
  );

  const handlePageSize = useCallback(
    (value) => scheduleWrite({ printPreferences: { pageSize: value } }),
    [scheduleWrite],
  );

  const handleCardsPerSheet = useCallback(
    (value) => scheduleWrite({ printPreferences: { cardsPerSheet: value } }),
    [scheduleWrite],
  );

  const handleColorMode = useCallback(
    (value) => scheduleWrite({ printPreferences: { colorMode: value } }),
    [scheduleWrite],
  );

  const handleIncludeLineage = useCallback(
    (next) => scheduleWrite({ printPreferences: { includeLineage: next } }),
    [scheduleWrite],
  );

  return (
    <section
      className="refresher-print-controls"
      aria-label="Print preferences"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        background: '#111827',
        border: '1px solid #1f2937',
        borderRadius: '0.5rem',
        marginBottom: '1rem',
      }}
    >
      {/* Page size */}
      <div style={SECTION_STYLE}>
        <span style={LABEL_STYLE}>Page</span>
        {PAGE_SIZES.map((value) => {
          const active = prefs.pageSize === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handlePageSize(value)}
              aria-pressed={active}
              data-page-size={value}
              style={{
                ...TOGGLE_BUTTON_STYLE,
                ...(active ? TOGGLE_BUTTON_ACTIVE_STYLE : {}),
              }}
            >
              {PAGE_SIZE_LABELS[value]}
            </button>
          );
        })}
      </div>

      {/* Cards per sheet */}
      <div style={SECTION_STYLE}>
        <span style={LABEL_STYLE}>Cards/sheet</span>
        {CARDS_PER_SHEET.map((value) => {
          const active = prefs.cardsPerSheet === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleCardsPerSheet(value)}
              aria-pressed={active}
              data-cards-per-sheet={value}
              style={{
                ...TOGGLE_BUTTON_STYLE,
                ...(active ? TOGGLE_BUTTON_ACTIVE_STYLE : {}),
              }}
            >
              {value}-up
            </button>
          );
        })}
      </div>

      {/* Color mode */}
      <div style={SECTION_STYLE}>
        <span style={LABEL_STYLE}>Color</span>
        {COLOR_MODES.map((value) => {
          const active = prefs.colorMode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleColorMode(value)}
              aria-pressed={active}
              data-color-mode={value}
              style={{
                ...TOGGLE_BUTTON_STYLE,
                ...(active ? TOGGLE_BUTTON_ACTIVE_STYLE : {}),
              }}
            >
              {COLOR_MODE_LABELS[value]}
            </button>
          );
        })}
      </div>

      {/* Include lineage / include codex */}
      <div style={SECTION_STYLE}>
        <span style={LABEL_STYLE}>Footer</span>
        <button
          type="button"
          onClick={() => handleIncludeLineage(!prefs.includeLineage)}
          aria-pressed={prefs.includeLineage === true}
          data-include-lineage={prefs.includeLineage === true ? 'on' : 'off'}
          style={{
            ...TOGGLE_BUTTON_STYLE,
            ...(prefs.includeLineage ? TOGGLE_BUTTON_ACTIVE_STYLE : {}),
          }}
        >
          Lineage footer: {prefs.includeLineage ? 'On' : 'Off'}
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Personal codex export available in Phase 2+"
          data-include-codex="disabled"
          style={{
            ...TOGGLE_BUTTON_STYLE,
            cursor: 'not-allowed',
            opacity: 0.5,
          }}
        >
          Personal codex: Phase 2+
        </button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: '0.5rem 0.75rem',
            background: '#7f1d1d',
            color: '#fee2e2',
            borderRadius: '0.375rem',
            fontSize: '0.8125rem',
          }}
        >
          {errorMessage}
        </div>
      )}
    </section>
  );
};

export default PrintControls;
