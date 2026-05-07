/**
 * @file CompositionInspector — inline expand-on-click panel that reveals
 * the 4-field CD-5 composition of a concept's composite score.
 *
 * Mirrors the inline-expand pattern from
 *   src/components/views/HandReplayView/HeroCoachingCard.jsx:129-213
 * (`hero-leak-claim-card` data-testid suffixes carry CD-5 field semantics
 * so the existing copy-discipline lint can be re-used.)
 *
 * Bound by `feedback_scf_learning_state_not_tier_rank.md`:
 *   - Tier shown as numeric "Tier N", never as a rank label.
 *   - All composition math is exposed here — not summarized away.
 *
 * Bound by AP-SCF-01 / AP-06 (no graded copy):
 *   - Signal lines render formula values only ("0.5 × 0.6 = 0.30"); no
 *     "you did well" / "wrong" / "level up" copy.
 *
 * SPR-042 / WS-159 (2026-05-06).
 */

import React from 'react';

const fmtFixed = (n) => (Number.isFinite(n) ? n.toFixed(2) : '0.00');

const SignalLine = ({ label, weightLabel, weightValue, factorLabel, factorValue, contrib, enabled, signed = '+' }) => {
  const sign = signed === '-' ? '−' : '+';
  return (
    <div
      data-testid={`composition-inspector-signal-${label}`}
      style={{
        display: 'grid',
        gridTemplateColumns: '5rem auto 1fr auto',
        gap: '0.5rem',
        alignItems: 'baseline',
        textDecoration: enabled ? 'none' : 'line-through',
        color: enabled ? '#e5e7eb' : '#6b7280',
        fontSize: '0.85rem',
        fontFamily: 'monospace',
      }}
    >
      <span style={{ fontWeight: 500 }}>{sign} {label}</span>
      <span style={{ color: '#9ca3af' }}>{weightLabel}={fmtFixed(weightValue)}</span>
      <span style={{ color: '#9ca3af' }}>× {factorLabel}={fmtFixed(factorValue)}</span>
      <span style={{ fontWeight: 600 }}>= {fmtFixed(contrib)}</span>
    </div>
  );
};

export const CompositionInspector = ({ concept, mastery, composite, weights, toggles }) => {
  if (!concept || !composite) return null;
  const tier = concept.meta?.tier ?? mastery?.meta?.tier ?? null;
  const kind = concept.meta?.kind ?? mastery?.meta?.kind ?? null;
  const parent = concept.meta?.parent ?? mastery?.meta?.parent ?? null;

  const leakSig = mastery?.leakSignal || { hasFiredLeak: false, severity: 0, sampleSize: 0 };
  const drillSig = mastery?.drillSignal || { mastery: 0, attemptCount: 0, lastAttemptAt: null };
  const testSig = mastery?.testSignal || { mastery: 0, attemptCount: 0, lastAttemptAt: null };
  const recencyPenalty = mastery?.recencyPenalty ?? 0;

  const leakValue = leakSig.hasFiredLeak ? (leakSig.severity || 0) : 0;
  const drillGap = 1 - (drillSig.mastery || 0);
  const testGap = 1 - (testSig.mastery || 0);

  return (
    <div
      data-testid="composition-inspector"
      role="region"
      aria-label="Composite score composition"
      style={{
        marginTop: '0.5rem',
        padding: '0.75rem 1rem',
        background: '#0b1220',
        border: '1px solid #1f2937',
        borderRadius: 8,
      }}
    >
      {/* Field 1: Concept */}
      <div data-testid="cd5-field-concept" style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
          Concept
        </div>
        <div style={{ fontSize: '0.95rem', color: '#f3f4f6', fontWeight: 500 }}>
          {concept.conceptId}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          {kind || '—'}{tier !== null ? ` · Tier ${tier}` : ''}{parent ? ` · parent: ${parent}` : ''}
        </div>
      </div>

      {/* Field 2: Signals contributing */}
      <div data-testid="cd5-field-signals" style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
          Signals contributing
        </div>
        <SignalLine
          label="leak"
          weightLabel="W_leak"
          weightValue={weights.W_leak}
          factorLabel={leakSig.hasFiredLeak ? 'severity' : 'no-fire'}
          factorValue={leakValue}
          contrib={composite.breakdown.leak}
          enabled={toggles.enableLeak}
        />
        <SignalLine
          label="drill"
          weightLabel="W_drill"
          weightValue={weights.W_drill}
          factorLabel="(1−mastery)"
          factorValue={drillGap}
          contrib={composite.breakdown.drill}
          enabled={toggles.enableDrill}
        />
        <SignalLine
          label="test"
          weightLabel="W_test"
          weightValue={weights.W_test}
          factorLabel="(1−mastery)"
          factorValue={testGap}
          contrib={composite.breakdown.test}
          enabled={toggles.enableTest}
        />
        <SignalLine
          label="recent"
          weightLabel="W_recent"
          weightValue={weights.W_recent}
          factorLabel="penalty"
          factorValue={recencyPenalty}
          contrib={composite.breakdown.recent}
          enabled={toggles.enableRecent}
          signed="-"
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '5rem auto 1fr auto',
            gap: '0.5rem',
            marginTop: '0.4rem',
            paddingTop: '0.4rem',
            borderTop: '1px dashed #374151',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
          }}
        >
          <span style={{ fontWeight: 600, color: '#f3f4f6' }}>composite</span>
          <span />
          <span />
          <span style={{ fontWeight: 700, color: '#f3f4f6' }}>= {fmtFixed(composite.compositeScore)}</span>
        </div>
      </div>

      {/* Field 3: Sample basis */}
      <div data-testid="cd5-field-sample" style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
          Sample basis
        </div>
        <div style={{ fontSize: '0.8rem', color: '#d1d5db', fontFamily: 'monospace', lineHeight: 1.5 }}>
          leak: {leakSig.sampleSize || 0} hands{leakSig.hasFiredLeak ? ' (fired; above n=30 floor)' : ' (no fire)'}
          <br />
          drill: {drillSig.attemptCount || 0} attempts
          {drillSig.lastAttemptAt ? ` · last ${drillSig.lastAttemptAt}` : ' · no attempts yet'}
          <br />
          test: {testSig.attemptCount || 0} attempts
          {testSig.lastAttemptAt ? ` · last ${testSig.lastAttemptAt}` : ' · test substrate pending'}
          <br />
          recency penalty: {fmtFixed(recencyPenalty)} (linear decay over 30 days)
        </div>
      </div>

      {/* Field 4: Methodology note */}
      <div data-testid="cd5-field-methodology">
        <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
          Methodology
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>
          composite = Σ(W<sub>i</sub> × signal<sub>i</sub>) − W_recent × recencyPenalty.
          Source: src/utils/skillAssessment/composite.js.
        </div>
      </div>
    </div>
  );
};
