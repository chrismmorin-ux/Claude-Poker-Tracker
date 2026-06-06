/**
 * SessionRowWithRollup.jsx — wrapper around SessionCard adding an
 * expand-to-rollup affordance for the per-session anchor activity.
 *
 * Per `docs/design/surfaces/session-review-anchor-rollup.md` §SessionsView
 * row-expand variant (added SPR-061).
 *
 * Composition: <SessionCard> (unchanged) + expand button + lazy-mounted
 * <SessionAnchorRollup>. Default-collapsed; per-row expand state held in
 * useState (no localStorage — opt-in per session glance).
 *
 * Hand→session linkage: getHandsBySessionId is async. Hands are fetched
 * lazily on first expand and cached in component state for subsequent
 * collapse/re-expand cycles within the same mount.
 *
 * Observations + anchors come from useAnchorLibrary() context — already
 * in memory.
 *
 * EAL Phase 6 — SPR-061 / WS-171.
 */

import React, { useState, useCallback } from 'react';
import { SessionCard } from '../../ui/SessionCard';
import { SessionAnchorRollup } from './SessionAnchorRollup';
import { useAnchorLibrary } from '../../../contexts/AnchorLibraryContext';
import { selectAnchorActivityForSession } from '../../../utils/anchorLibrary/sessionRollupSelectors';
import { getHandsBySessionId } from '../../../utils/persistence/index';

/**
 * @param {Object} props
 * @param {Object} props.session     — Session record (must include sessionId, startTime, endTime)
 * @param {Function} props.onDelete  — Delete handler (passed through to SessionCard)
 * @param {string} [props.venueNote] — Venue note (passed through to SessionCard)
 * @param {Function} [props.onShowDetails] — Open session detail (to SessionCard)
 */
export const SessionRowWithRollup = ({ session, onDelete, venueNote = '', onShowDetails }) => {
  const [expanded, setExpanded] = useState(false);
  const [hands, setHands] = useState(null);
  const [loading, setLoading] = useState(false);

  // selectAllAnchors + raw observations dict (spread into value via ...anchorLibraryState).
  const anchorLibrary = useAnchorLibrary();
  const selectAllAnchors = anchorLibrary.selectAllAnchors;
  const allObservationsDict = anchorLibrary.observations || {};

  const handleToggle = useCallback(async () => {
    const next = !expanded;
    setExpanded(next);
    // Lazy-load hands on first expand only.
    if (next && hands === null && !loading) {
      setLoading(true);
      try {
        const loaded = await getHandsBySessionId(session.sessionId);
        setHands(Array.isArray(loaded) ? loaded : []);
      } catch {
        // Fail-soft — empty hands array means the rollup will simply show
        // empty sections. The error toast surface is owned by SessionsView.
        setHands([]);
      } finally {
        setLoading(false);
      }
    }
  }, [expanded, hands, loading, session?.sessionId]);

  const renderRollup = () => {
    if (loading) {
      return (
        <div
          data-testid={`session-row-rollup-loading-${session.sessionId}`}
          style={{
            padding: '0.75rem 1rem',
            fontSize: '0.8125rem',
            color: '#9ca3af',
          }}
        >
          Loading anchor activity…
        </div>
      );
    }
    if (hands === null) return null;

    const anchors = selectAllAnchors();
    const observations = Object.values(allObservationsDict);

    const activity = selectAnchorActivityForSession({
      sessionId: session.sessionId,
      sessionStart: session.startTime,
      sessionEnd: session.endTime,
      hands,
      observations,
      anchors,
    });

    return (
      <SessionAnchorRollup
        matcherFired={activity.matcherFired}
        ownerCaptured={activity.ownerCaptured}
        autoRetired={activity.autoRetired}
        distinctAnchorIds={activity.distinctAnchorIds}
      />
    );
  };

  return (
    <div data-testid={`session-row-with-rollup-${session.sessionId}`}>
      <SessionCard session={session} onDelete={onDelete} venueNote={venueNote} onShowDetails={onShowDetails} />
      <div
        style={{
          padding: '0.5rem 1rem 0.75rem',
          background: '#0f172a',
          borderTop: '1px solid #1f2937',
          borderBottom: '1px solid #1f2937',
        }}
      >
        <button
          type="button"
          data-testid={`session-row-rollup-toggle-${session.sessionId}`}
          onClick={handleToggle}
          aria-expanded={expanded}
          style={{
            minHeight: 44,
            padding: '0.5rem 1rem',
            background: '#1f2937',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontWeight: 500,
          }}
        >
          {expanded ? '▾ Hide anchor activity' : '▸ Show anchor activity'}
        </button>
        {expanded && (
          <div style={{ marginTop: '0.5rem' }}>
            {renderRollup()}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionRowWithRollup;
