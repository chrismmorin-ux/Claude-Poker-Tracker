/**
 * LiveAdviceBar.test.jsx — Tests for LiveAdviceBar UI enhancements
 *
 * Item 28.7-28.10: Confidence badge, fold curve tooltip, advantage badges,
 * reasoning text display.
 */

import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveAdviceBar } from '../LiveAdviceBar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseGameTreeAdvice = {
  heroEquity: 0.58,
  foldPct: { bet: 0.42 },
  recommendations: [{
    action: 'bet',
    ev: 15.3,
    sizing: { betFraction: 0.75, betSize: 75, foldPct: 0.42 },
    reasoning: 'Value bet — 58% equity, +EV when called (solid read, 25 obs)',
    villainResponse: {
      fold: { pct: 0.42, ev: 100 },
      call: { pct: 0.45, ev: 8.5 },
      raise: { pct: 0.13, ev: -20 },
    },
    villainPrediction: { confidence: 0.75, effectiveN: 25, source: 'model_blended' },
    handPlan: { ifCall: { note: 'Continue betting safe turns' } },
  }],
  treeMetadata: {
    advantage: { rangeAdvantage: 0.35, nutAdvantage: 0.1, polarization: 0.4, mergedness: 0.6 },
  },
  foldMeta: {
    curve: [
      { sizing: 0.33, foldPct: 0.28 },
      { sizing: 0.50, foldPct: 0.35 },
      { sizing: 0.75, foldPct: 0.42 },
      { sizing: 1.00, foldPct: 0.50 },
      { sizing: 1.50, foldPct: 0.58 },
      { sizing: 2.00, foldPct: 0.63 },
    ],
    curveSource: 'personalized',
  },
};

// ---------------------------------------------------------------------------
// 28.7 — Confidence badge
// ---------------------------------------------------------------------------

describe('28.7: confidence source badge', () => {
  test('shows DATA badge when effectiveN >= 15 and model source', () => {
    const { container } = render(
      <LiveAdviceBar gameTreeAdvice={baseGameTreeAdvice} />
    );
    expect(container.textContent).toContain('DATA');
  });

  test('shows EST badge when source is population', () => {
    const advice = {
      ...baseGameTreeAdvice,
      recommendations: [{
        ...baseGameTreeAdvice.recommendations[0],
        villainPrediction: { confidence: 0.2, effectiveN: 3, source: 'population' },
      }],
    };
    const { container } = render(<LiveAdviceBar gameTreeAdvice={advice} />);
    expect(container.textContent).toContain('EST');
  });

  test('shows PARTIAL badge when effectiveN between 5 and 14', () => {
    const advice = {
      ...baseGameTreeAdvice,
      recommendations: [{
        ...baseGameTreeAdvice.recommendations[0],
        villainPrediction: { confidence: 0.4, effectiveN: 8, source: 'blended' },
      }],
    };
    const { container } = render(<LiveAdviceBar gameTreeAdvice={advice} />);
    expect(container.textContent).toContain('PARTIAL');
  });

  test('no badge when villainPrediction is absent', () => {
    const advice = {
      ...baseGameTreeAdvice,
      recommendations: [{
        ...baseGameTreeAdvice.recommendations[0],
        villainPrediction: undefined,
      }],
    };
    const { container } = render(<LiveAdviceBar gameTreeAdvice={advice} />);
    expect(container.textContent).not.toContain('DATA');
    expect(container.textContent).not.toContain('EST');
    expect(container.textContent).not.toContain('PARTIAL');
  });
});

// ---------------------------------------------------------------------------
// 28.8 — Fold curve tooltip
// ---------------------------------------------------------------------------

describe('28.8: fold curve tooltip', () => {
  test('fold curve tooltip toggle appears when curve data exists', () => {
    const { container } = render(
      <LiveAdviceBar gameTreeAdvice={baseGameTreeAdvice} />
    );
    // The "···" toggle should be present
    expect(container.textContent).toContain('···');
  });

  test('clicking toggle shows fold curve with all 6 sizings', () => {
    const { container } = render(
      <LiveAdviceBar gameTreeAdvice={baseGameTreeAdvice} />
    );
    // Find and click the "···" toggle
    const toggle = [...container.querySelectorAll('span')].find(s => s.textContent === '···');
    expect(toggle).toBeDefined();
    fireEvent.click(toggle);

    // After click, the tooltip should show fold curve data
    const text = container.textContent;
    expect(text).toContain('FOLD CURVE');
    expect(text).toContain('(personalized)');
    expect(text).toContain('33% pot');
    expect(text).toContain('100% pot');
    expect(text).toContain('200% pot');
  });

  test('no fold curve toggle when curve data is absent', () => {
    const advice = {
      ...baseGameTreeAdvice,
      foldMeta: {},
    };
    const { container } = render(<LiveAdviceBar gameTreeAdvice={advice} />);
    expect(container.textContent).not.toContain('···');
  });
});

// ---------------------------------------------------------------------------
// 28.9 — Advantage badges
// ---------------------------------------------------------------------------

describe('28.9: advantage badges', () => {
  test('shows R+ badge when rangeAdvantage > 0.2', () => {
    const { container } = render(
      <LiveAdviceBar gameTreeAdvice={baseGameTreeAdvice} />
    );
    expect(container.textContent).toContain('R+');
  });

  test('shows N- badge when nutAdvantage < -0.2', () => {
    const advice = {
      ...baseGameTreeAdvice,
      treeMetadata: {
        advantage: { rangeAdvantage: 0.1, nutAdvantage: -0.3, polarization: 0.4, mergedness: 0.6 },
      },
    };
    const { container } = render(<LiveAdviceBar gameTreeAdvice={advice} />);
    expect(container.textContent).toContain('N-');
  });

  test('no advantage badges when both are neutral', () => {
    const advice = {
      ...baseGameTreeAdvice,
      treeMetadata: {
        advantage: { rangeAdvantage: 0.05, nutAdvantage: -0.05, polarization: 0.3, mergedness: 0.7 },
      },
    };
    const { container } = render(<LiveAdviceBar gameTreeAdvice={advice} />);
    expect(container.textContent).not.toContain('R+');
    expect(container.textContent).not.toContain('R-');
    expect(container.textContent).not.toContain('N+');
    expect(container.textContent).not.toContain('N-');
  });
});

// ---------------------------------------------------------------------------
// 28.10 — Reasoning text display
// ---------------------------------------------------------------------------

describe('28.10: reasoning text display', () => {
  test('reasoning text is displayed when game tree advice is present', () => {
    const { container } = render(
      <LiveAdviceBar gameTreeAdvice={baseGameTreeAdvice} />
    );
    expect(container.textContent).toContain('Value bet');
    expect(container.textContent).toContain('58% equity');
  });

  test('no reasoning text when game tree advice is absent', () => {
    const { container } = render(
      <LiveAdviceBar
        actionAdvice={{ label: 'VALUE', color: '#22c55e', icon: 'up' }}
        liveEquity={{ equity: 0.55, foldPct: 0.40 }}
      />
    );
    expect(container.textContent).not.toContain('Value bet');
  });
});
