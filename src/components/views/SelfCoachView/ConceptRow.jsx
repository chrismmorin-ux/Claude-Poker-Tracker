/**
 * @file ConceptRow — single-row presentation of a concept in the curriculum
 * tree. Renders glyph + name + signal indicators + composite badge +
 * (optional) "Lesson coming" tag + (optional) Drill-this affordance.
 *
 * Tap on the composite badge → reveals CompositionInspector (parent
 * controls open/close state).
 *
 * Per `feedback_scf_learning_state_not_tier_rank.md`:
 *   - Tier shown as numeric "Tier N", never as a rank label.
 *   - No graded copy ("good" / "poor" / "wrong" / "well done") — rendering
 *     is observational only.
 *
 * Per AP-SCF-04 + CD-5 — leak indicator only renders when sample size is
 * above floor and a leak has actually fired (data passes through here as
 * already-filtered by the underlying conceptMastery aggregation).
 *
 * SPR-042 / WS-159 (2026-05-06).
 */

import React from 'react';

const KIND_GLYPH = {
  'rule-anchored-umbrella': { collapsed: '▶', expanded: '▼' },
  'rule-anchored-specific': { collapsed: '•', expanded: '•' },
  'general-skill': { collapsed: '◆', expanded: '◆' },
};

const conceptDisplayName = (conceptId) => conceptId.replace(/-/g, ' ');

const fmt = (n) => (Number.isFinite(n) ? n.toFixed(2) : '0.00');

/**
 * @param {object} props
 * @param {string} props.conceptId
 * @param {object} props.mastery - per-concept mastery record
 * @param {object} props.composite - per-concept composite { compositeScore, breakdown }
 * @param {object} [props.lesson] - lesson record from getLesson(); null when no lesson authored
 * @param {boolean} [props.isUmbrella] - true to render umbrella glyph + expand toggle
 * @param {boolean} [props.expanded] - umbrella expansion state
 * @param {Function} [props.onToggleExpand] - umbrella toggle handler
 * @param {boolean} [props.inspectorOpen] - composition inspector state
 * @param {Function} props.onToggleInspector - inspector toggle handler
 * @param {Function} [props.onDrillThis] - Drill-this handler; only called when lesson != null
 * @param {number} [props.indentLevel=0] - 0 = root row, 1 = child of expanded umbrella
 */
export const ConceptRow = ({
  conceptId,
  mastery,
  composite,
  lesson,
  isUmbrella = false,
  expanded = false,
  onToggleExpand,
  inspectorOpen = false,
  onToggleInspector,
  onDrillThis,
  indentLevel = 0,
}) => {
  const kind = mastery?.meta?.kind || 'general-skill';
  const glyph = KIND_GLYPH[kind]?.[expanded ? 'expanded' : 'collapsed'] || '•';
  const compositeScore = composite?.compositeScore ?? 0;
  const hasLesson = !!lesson;
  const muted = !hasLesson && !isUmbrella;

  const leakFired = !!mastery?.leakSignal?.hasFiredLeak;
  const drillMastery = mastery?.drillSignal?.mastery ?? 0;
  const testMastery = mastery?.testSignal?.mastery ?? 0;

  return (
    <div
      data-testid={`concept-row-${conceptId}`}
      data-concept-id={conceptId}
      style={{
        paddingLeft: `${indentLevel * 1.5}rem`,
        marginBottom: '0.25rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 0.5rem',
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 6,
          color: muted ? '#6b7280' : '#e5e7eb',
        }}
      >
        {isUmbrella ? (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${conceptDisplayName(conceptId)}`}
            data-testid={`concept-row-${conceptId}-toggle`}
            style={{
              minWidth: 28,
              minHeight: 28,
              padding: '0 0.4rem',
              background: 'transparent',
              color: '#d1d5db',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            {glyph}
          </button>
        ) : (
          <span aria-hidden="true" style={{ display: 'inline-block', width: 28, textAlign: 'center', color: '#9ca3af' }}>
            {glyph}
          </span>
        )}

        <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: isUmbrella ? 600 : 400 }}>
          {conceptDisplayName(conceptId)}
        </span>

        {/* Signal indicators — observational only; no graded copy. */}
        <span
          aria-label="signal indicators"
          style={{
            fontSize: '0.7rem',
            fontFamily: 'monospace',
            color: '#9ca3af',
            display: 'flex',
            gap: '0.5rem',
            minWidth: '11rem',
            justifyContent: 'flex-end',
          }}
        >
          <span title="leak fire-state" data-testid={`concept-row-${conceptId}-leak`}>
            {leakFired ? <span style={{ color: '#f59e0b' }}>● leak</span> : '— leak'}
          </span>
          <span title="drill mastery" data-testid={`concept-row-${conceptId}-drill`}>
            drill {fmt(drillMastery)}
          </span>
          <span title="test mastery" data-testid={`concept-row-${conceptId}-test`}>
            test {fmt(testMastery)}
          </span>
        </span>

        <button
          type="button"
          onClick={onToggleInspector}
          aria-expanded={inspectorOpen}
          aria-label={`${inspectorOpen ? 'Hide' : 'Show'} composition for ${conceptDisplayName(conceptId)}`}
          data-testid={`concept-row-${conceptId}-composite-badge`}
          style={{
            minHeight: 28,
            padding: '0.2rem 0.6rem',
            background: '#1f2937',
            color: '#f3f4f6',
            border: '1px solid #374151',
            borderRadius: 999,
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontFamily: 'monospace',
          }}
        >
          composite {fmt(compositeScore)} {inspectorOpen ? '▲' : '▾'}
        </button>

        {!hasLesson && !isUmbrella && (
          <span
            data-testid={`concept-row-${conceptId}-lesson-coming`}
            style={{
              fontSize: '0.7rem',
              color: '#6b7280',
              padding: '0.15rem 0.4rem',
              background: '#0b1220',
              border: '1px dashed #374151',
              borderRadius: 4,
            }}
          >
            Lesson coming
          </span>
        )}

        <button
          type="button"
          disabled={!hasLesson}
          onClick={hasLesson ? onDrillThis : undefined}
          aria-label={hasLesson ? `Drill ${conceptDisplayName(conceptId)}` : `Lesson not yet authored for ${conceptDisplayName(conceptId)}`}
          data-testid={`concept-row-${conceptId}-drill-this`}
          style={{
            minHeight: 28,
            padding: '0.2rem 0.6rem',
            background: hasLesson ? '#7c3aed' : '#1f2937',
            color: hasLesson ? '#ffffff' : '#6b7280',
            border: '1px solid #374151',
            borderRadius: 6,
            cursor: hasLesson ? 'pointer' : 'not-allowed',
            fontSize: '0.75rem',
            fontWeight: 500,
            opacity: hasLesson ? 1 : 0.6,
          }}
        >
          Drill
        </button>
      </div>
    </div>
  );
};
