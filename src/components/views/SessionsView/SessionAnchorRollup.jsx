/**
 * SessionAnchorRollup.jsx — per-session anchor activity rollup.
 *
 * Per `docs/design/surfaces/session-review-anchor-rollup.md` §SessionsView
 * row-expand variant (added SPR-061).
 *
 * Renders 3 sections, AP-08 separated:
 *   1. Matcher-fired anchors (origin: 'matcher-system')
 *   2. Owner-captured observations (origin: 'owner-captured', reuses
 *      AnchorObservationList from HandReplayView)
 *   3. Auto-retired this session (anchors stamped by useAnchorAutoRetire
 *      with operator.lastOverrideBy='system' AND overrideReason='auto-retire'
 *      AND lastOverrideAt within session window)
 *
 * Hard rules:
 *   - AP-08 invariant: matcher-fired and owner-captured counts/lists are
 *     never combined into a single number/element. Tests assert this at
 *     the DOM level.
 *   - AP-06 forbidden patterns absent in auto-retire summary copy
 *     (validated against retirementCopy.FORBIDDEN_PATTERNS).
 *   - Tier-1 candidate-promotion section omitted per founder Q1c at
 *     SPR-061 (Phase 2 scope).
 *
 * Pure render — receives activity bundle from sessionRollupSelectors.
 *
 * EAL Phase 6 — SPR-061 / WS-171.
 */

import React from 'react';
import { AnchorObservationList } from '../HandReplayView/AnchorObservationList';

// ───────────────────────────────────────────────────────────────────────────
// Section sub-components (small, internal — not exported)
// ───────────────────────────────────────────────────────────────────────────

const SectionHeader = ({ label, count, testId }) => (
  <div
    data-testid={testId}
    style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: '0.5rem',
      padding: '0.5rem 0.75rem',
      fontSize: '0.875rem',
      fontWeight: 600,
      color: '#d1d5db',
    }}
  >
    <span>{label}</span>
    <span style={{ color: '#9ca3af', fontWeight: 400 }}>(n={count})</span>
  </div>
);

const EmptyRow = ({ children }) => (
  <div
    style={{
      padding: '0.5rem 1rem 0.75rem',
      fontSize: '0.8125rem',
      color: '#6b7280',
    }}
  >
    {children}
  </div>
);

// ───────────────────────────────────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {Object[]} props.matcherFired   — observations with origin='matcher-system'
 * @param {Object[]} props.ownerCaptured  — observations with origin='owner-captured'
 * @param {Object[]} props.autoRetired    — anchors auto-retired this session
 * @param {string[]} [props.distinctAnchorIds] — for future deep-link wiring; not rendered today
 */
export const SessionAnchorRollup = ({
  matcherFired,
  ownerCaptured,
  autoRetired,
}) => {
  const matcherFiredArr = Array.isArray(matcherFired) ? matcherFired : [];
  const ownerCapturedArr = Array.isArray(ownerCaptured) ? ownerCaptured : [];
  const autoRetiredArr = Array.isArray(autoRetired) ? autoRetired : [];

  const allEmpty =
    matcherFiredArr.length === 0 &&
    ownerCapturedArr.length === 0 &&
    autoRetiredArr.length === 0;

  if (allEmpty) {
    return (
      <div
        data-testid="session-anchor-rollup"
        data-empty="true"
        style={{
          padding: '1rem',
          fontSize: '0.8125rem',
          color: '#6b7280',
          background: '#0f172a',
          border: '1px solid #1f2937',
          borderRadius: '0.375rem',
        }}
      >
        No anchor activity for this session.
      </div>
    );
  }

  // Auto-retire summary copy — kept terse + factual; AP-06 compliant by
  // construction (no "your accuracy / observation / confidence" tokens).
  const autoRetireNoun = autoRetiredArr.length === 1 ? 'anchor' : 'anchors';
  const autoRetireMessage = autoRetiredArr.length > 0
    ? `${autoRetiredArr.length} ${autoRetireNoun} auto-retired during this session.`
    : null;

  return (
    <div
      data-testid="session-anchor-rollup"
      data-empty="false"
      style={{
        background: '#0f172a',
        border: '1px solid #1f2937',
        borderRadius: '0.375rem',
        overflow: 'hidden',
      }}
    >
      {/* Section 1: Matcher-fired (origin: 'matcher-system') */}
      <div data-testid="session-anchor-rollup-matcher-section">
        <SectionHeader
          label="Matcher-fired anchors"
          count={matcherFiredArr.length}
          testId="session-anchor-rollup-matcher-header"
        />
        {matcherFiredArr.length > 0 ? (
          <AnchorObservationList observations={matcherFiredArr} />
        ) : (
          <EmptyRow>No matcher firings during this session.</EmptyRow>
        )}
      </div>

      {/* Visual separator — purely cosmetic; AP-08 separation is structural */}
      <div style={{ borderTop: '1px solid #1f2937' }} />

      {/* Section 2: Owner-captured (origin: 'owner-captured') */}
      <div data-testid="session-anchor-rollup-owner-section">
        <SectionHeader
          label="Owner-captured observations"
          count={ownerCapturedArr.length}
          testId="session-anchor-rollup-owner-header"
        />
        {ownerCapturedArr.length > 0 ? (
          <AnchorObservationList observations={ownerCapturedArr} />
        ) : (
          <EmptyRow>No owner captures during this session.</EmptyRow>
        )}
      </div>

      <div style={{ borderTop: '1px solid #1f2937' }} />

      {/* Section 3: Auto-retired this session */}
      <div data-testid="session-anchor-rollup-auto-retire-section">
        <SectionHeader
          label="Auto-retired this session"
          count={autoRetiredArr.length}
          testId="session-anchor-rollup-auto-retire-header"
        />
        {autoRetiredArr.length > 0 ? (
          <>
            <div
              data-testid="session-anchor-rollup-auto-retire-summary"
              style={{
                padding: '0.5rem 0.75rem 0.25rem',
                fontSize: '0.8125rem',
                color: '#d1d5db',
              }}
            >
              {autoRetireMessage}
            </div>
            <ul
              data-testid="session-anchor-rollup-auto-retire-list"
              style={{
                listStyle: 'none',
                padding: '0 0.75rem 0.75rem',
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              {autoRetiredArr.map((anchor) => (
                <li
                  key={anchor.id}
                  data-testid={`session-anchor-rollup-auto-retire-row-${anchor.id}`}
                  style={{
                    padding: '0.375rem 0.5rem',
                    fontSize: '0.8125rem',
                    color: '#d1d5db',
                    background: '#1e293b',
                    borderRadius: '0.25rem',
                  }}
                >
                  {anchor.archetypeName || anchor.id}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyRow>No auto-retirements during this session.</EmptyRow>
        )}
      </div>
    </div>
  );
};

export default SessionAnchorRollup;
