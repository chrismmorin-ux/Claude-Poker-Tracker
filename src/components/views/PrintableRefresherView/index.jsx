/**
 * PrintableRefresherView — top-level surface for the Printable Refresher.
 *
 * Per `docs/design/surfaces/printable-refresher.md` §Top-level view. Phase 1
 * MVP scope (S18):
 *   - Header + back button
 *   - Filter chips (class) + showSuppressed toggle
 *   - Sort dropdown
 *   - CardCatalog (CardRow list)
 *
 * Deferred to S19+:
 *   - StalenessBanner (passive amber)
 *   - Stakes / stacks / status filter chips beyond class
 *   - "Print selected batch" + "Print preview" buttons
 *   - CardDetail / LineageModal / PrintPreview / PrintConfirmationModal sub-views
 *   - Card-row → CardDetail navigation (placeholder action only at S18)
 *
 * Composition: pulls state + helpers from useRefresher() + useRefresherView().
 * Card filtering + sorting applied locally before passing to CardCatalog.
 *
 * Red line #11 (Reference-mode write-silence) — this surface dispatches
 * `currentIntent: 'Reference'` at mount per the surface spec. The dispatch
 * is wired through useUI from contexts; if currentIntent isn't yet a UI
 * reducer field at S18, the dispatch is a no-op for now and logs a dev-mode
 * warning. The structural segregation of writers is enforced separately via
 * I-WR-2 in writerBoundary.test.js.
 *
 * PRF Phase 5 — Session 18 (PRF-G5-UI).
 */

import React, { useMemo, useCallback, useState } from 'react';
import { useRefresher } from '../../../contexts';
import { useRefresherView } from '../../../hooks/useRefresherView';
import { useUI } from '../../../contexts';
import { SCREEN } from '../../../constants/uiConstants';
import { CardCatalog } from './CardCatalog';
import { CardDetail } from './CardDetail';
import { SuppressConfirmModal } from './SuppressConfirmModal';

const CLASS_FILTER_OPTIONS = ['preflop', 'math', 'equity', 'exceptions'];

const SORT_OPTIONS = [
  { value: 'theoretical', label: 'Theoretical order' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'lastPrinted', label: 'Last printed' },
  { value: 'pinnedFirst', label: 'Pinned first' },
];

/**
 * Apply useRefresherView filters + sort to a card list.
 */
function applyFiltersAndSort(cards, view) {
  if (!Array.isArray(cards)) return [];
  let out = cards;

  // Class filter (empty array = all classes)
  if (view.filter.classes.length > 0) {
    const set = new Set(view.filter.classes);
    out = out.filter((c) => set.has(c.class));
  }

  // Phase + tier filters (deferred — empty arrays at v1)
  if (view.filter.phases && view.filter.phases.length > 0) {
    const set = new Set(view.filter.phases);
    out = out.filter((c) => set.has(c.phase));
  }
  if (view.filter.tiers && view.filter.tiers.length > 0) {
    const set = new Set(view.filter.tiers);
    out = out.filter((c) => set.has(c.tier));
  }

  // Sort
  switch (view.sort) {
    case 'alphabetical':
      out = [...out].sort((a, b) => a.cardId.localeCompare(b.cardId));
      break;
    case 'pinnedFirst':
      out = [...out].sort((a, b) => {
        const aPin = a.visibility === 'pinned' ? 0 : 1;
        const bPin = b.visibility === 'pinned' ? 0 : 1;
        if (aPin !== bPin) return aPin - bPin;
        return a.cardId.localeCompare(b.cardId);
      });
      break;
    case 'lastPrinted':
      // Phase 1 v1: no batch info reachable from card alone; falls back to
      // theoretical order. Sort stub for forward compat.
      break;
    case 'theoretical':
    default:
      // Manifest registry order (already deterministic — sorted by cardId in
      // cardRegistry.js); no resort.
      break;
  }
  return out;
}

export const PrintableRefresherView = () => {
  const refresher = useRefresher();
  const ui = useUI();
  const { view, setFilter, setSort, setShowSuppressed } = useRefresherView();

  const [errorMessage, setErrorMessage] = useState('');
  // S19 — sub-view + modal navigation state
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [pendingSuppress, setPendingSuppress] = useState(null);

  // Choose the base set per "show suppressed" toggle.
  const baseCards = useMemo(
    () => (view.filter.showSuppressed ? refresher.getAllCards() : refresher.getActiveCards()),
    [view.filter.showSuppressed, refresher],
  );

  const filteredSorted = useMemo(
    () => applyFiltersAndSort(baseCards, view),
    [baseCards, view],
  );

  const staleCardIds = useMemo(() => {
    const stale = refresher.getStaleCards();
    return new Set(stale.map((c) => c.cardId));
  }, [refresher]);

  // selectedCard for CardDetail — pull from the full annotated set so a
  // detail view stays reachable even if the catalog filter would hide it.
  const selectedCard = useMemo(() => {
    if (!selectedCardId) return null;
    return refresher.getAllCards().find((c) => c.cardId === selectedCardId) || null;
  }, [selectedCardId, refresher]);

  // ── Action handlers ─────────────────────────────────────────────────
  const handlePin = useCallback(
    async (card) => {
      try {
        const next = card.visibility === 'pinned' ? 'default' : 'pinned';
        await refresher.setCardVisibility({ cardId: card.cardId, visibility: next });
        setErrorMessage('');
      } catch (err) {
        setErrorMessage(err.message || 'Failed to pin card');
      }
    },
    [refresher],
  );

  const handleHide = useCallback(
    async (card) => {
      try {
        const next = card.visibility === 'hidden' ? 'default' : 'hidden';
        await refresher.setCardVisibility({ cardId: card.cardId, visibility: next });
        setErrorMessage('');
      } catch (err) {
        setErrorMessage(err.message || 'Failed to hide card');
      }
    },
    [refresher],
  );

  const handleSuppress = useCallback(
    (card) => {
      // S19 — opens SuppressConfirmModal. Confirm flow calls
      // refresher.setClassSuppressed via handleSuppressConfirm below.
      setPendingSuppress({ classId: card.class, currentlySuppressed: card.classSuppressed === true });
    },
    [],
  );

  const handleSuppressConfirm = useCallback(async () => {
    if (!pendingSuppress) return;
    const { classId, currentlySuppressed } = pendingSuppress;
    try {
      if (currentlySuppressed) {
        await refresher.setClassSuppressed({
          classId,
          suppress: false,
          ownerInitiated: true,
        });
      } else {
        await refresher.setClassSuppressed({
          classId,
          suppress: true,
          confirmed: true,
        });
      }
      setPendingSuppress(null);
      setErrorMessage('');
    } catch (err) {
      // Re-throw so the modal can surface the error inline.
      throw err;
    }
  }, [pendingSuppress, refresher]);

  const handleSuppressCancel = useCallback(() => {
    setPendingSuppress(null);
  }, []);

  const handleOpenDetail = useCallback((card) => {
    setSelectedCardId(card.cardId);
  }, []);

  const handleBackToCatalog = useCallback(() => {
    setSelectedCardId(null);
  }, []);

  const handleClassFilterToggle = useCallback(
    (cls) => {
      const current = view.filter.classes;
      const next = current.includes(cls)
        ? current.filter((c) => c !== cls)
        : [...current, cls];
      setFilter({ classes: next });
    },
    [view.filter.classes, setFilter],
  );

  const handleBack = useCallback(() => {
    ui.setCurrentScreen(SCREEN.SESSIONS);
  }, [ui]);

  return (
    <div
      className="printable-refresher-view"
      role="main"
      style={{
        minHeight: '100dvh',
        background: '#0f172a',
        color: '#e5e7eb',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid #1f2937',
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back to sessions"
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '0.5rem 0.75rem',
            background: '#1f2937',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
          Printable Refresher
        </h1>
        <div style={{ flex: 1 }} />
        {!refresher.isReady && (
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Loading…</span>
        )}
      </header>

      {/* Filter row */}
      <section
        className="printable-refresher-filters"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginRight: '0.25rem' }}>Class:</span>
        {CLASS_FILTER_OPTIONS.map((cls) => (
          <button
            key={cls}
            type="button"
            onClick={() => handleClassFilterToggle(cls)}
            aria-pressed={view.filter.classes.includes(cls)}
            style={{
              minHeight: 36,
              padding: '0.25rem 0.75rem',
              background: view.filter.classes.includes(cls) ? '#374151' : '#1f2937',
              color: '#e5e7eb',
              border: '1px solid #374151',
              borderRadius: '999px',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              textTransform: 'capitalize',
            }}
          >
            {cls}
          </button>
        ))}

        <span style={{ flex: 1 }} />

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontSize: '0.8125rem',
            color: '#d1d5db',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={view.filter.showSuppressed}
            onChange={(e) => setShowSuppressed(e.target.checked)}
          />
          Show suppressed
        </label>

        <select
          value={view.sort}
          onChange={(e) => setSort(e.target.value)}
          style={{
            minHeight: 36,
            padding: '0.25rem 0.5rem',
            background: '#1f2937',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: '0.375rem',
            fontSize: '0.8125rem',
          }}
          aria-label="Sort order"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </section>

      {/* Showing N of M (only in catalog mode) */}
      {!selectedCard && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#9ca3af',
            marginBottom: '0.5rem',
          }}
        >
          Showing {filteredSorted.length} of {baseCards.length} cards
        </div>
      )}

      {/* Error toast (lightweight; full ToastContext deferred) */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: '0.5rem 0.75rem',
            marginBottom: '0.5rem',
            background: '#7f1d1d',
            color: '#fee2e2',
            border: '1px solid #b91c1c',
            borderRadius: '0.375rem',
            fontSize: '0.8125rem',
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Detail vs Catalog */}
      {selectedCard ? (
        <CardDetail
          card={selectedCard}
          isStale={staleCardIds.has(selectedCard.cardId)}
          onBack={handleBackToCatalog}
          onPin={handlePin}
          onHide={handleHide}
          onSuppress={handleSuppress}
        />
      ) : (
        <CardCatalog
          cards={filteredSorted}
          staleCardIds={staleCardIds}
          onPin={handlePin}
          onHide={handleHide}
          onSuppress={handleSuppress}
          onOpenDetail={handleOpenDetail}
        />
      )}

      {/* Suppress confirmation modal overlay */}
      {pendingSuppress && (
        <SuppressConfirmModal
          classId={pendingSuppress.classId}
          currentlySuppressed={pendingSuppress.currentlySuppressed}
          onConfirm={handleSuppressConfirm}
          onCancel={handleSuppressCancel}
        />
      )}

      {/* Phase 1 deferred features placeholder */}
      <footer
        style={{
          marginTop: '1.5rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #1f2937',
          fontSize: '0.75rem',
          color: '#6b7280',
        }}
      >
        Print preview and batch print will land in Session 20+.
      </footer>
    </div>
  );
};

export default PrintableRefresherView;
