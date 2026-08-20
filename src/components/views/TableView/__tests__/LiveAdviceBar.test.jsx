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

// ---------------------------------------------------------------------------
// WS-470 (FIND-131) — hand-identity gate: advice computed for a different hand
// must never render as current. This is the resolve-after-advance scenario: a
// slow compute for hand 100 lands while the table is already on hand 101.
// ---------------------------------------------------------------------------

describe('WS-470: hand-identity gate', () => {
  test('advice for a previous hand is rejected — bar disappears when nothing else is live', () => {
    const advice = { ...baseGameTreeAdvice, handNumber: 100 };
    const { container } = render(
      <LiveAdviceBar gameTreeAdvice={advice} liveHandNumber={101} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('advice for a previous hand never shows its recommendation, even when other signals keep the bar visible', () => {
    const advice = { ...baseGameTreeAdvice, handNumber: 100 };
    const { container } = render(
      <LiveAdviceBar
        gameTreeAdvice={advice}
        liveHandNumber={101}
        actionAdvice={{ label: 'VALUE', color: '#22c55e', icon: 'up' }}
        liveEquity={{ equity: 0.55, foldPct: 0.40 }}
      />
    );
    expect(container.textContent).not.toContain('BET');
    expect(container.textContent).not.toContain('58% equity');
  });

  test('advice for the current hand renders normally', () => {
    const advice = { ...baseGameTreeAdvice, handNumber: 101 };
    const { container } = render(
      <LiveAdviceBar gameTreeAdvice={advice} liveHandNumber={101} />
    );
    expect(container.textContent).toContain('BET');
  });

  test('identity gating only strengthens with information: null on either side renders (legacy payloads)', () => {
    const noPayloadId = render(
      <LiveAdviceBar gameTreeAdvice={baseGameTreeAdvice} liveHandNumber={101} />
    );
    expect(noPayloadId.container.textContent).toContain('BET');

    const noCurrentId = render(
      <LiveAdviceBar gameTreeAdvice={{ ...baseGameTreeAdvice, handNumber: 100 }} />
    );
    expect(noCurrentId.container.textContent).toContain('BET');
  });
});

// ---------------------------------------------------------------------------
// WS-471 (FIND-132) — in-flight game-tree recompute affordance. The live table
// must show that it is thinking; street/age staleness cannot fire on a
// within-street recompute, so this is the only signal for that case.
// ---------------------------------------------------------------------------

describe('WS-471: recomputing affordance', () => {
  test('in-flight recompute shows RECOMPUTING badge and dims the previous recommendation', () => {
    const { container } = render(
      <LiveAdviceBar gameTreeAdvice={baseGameTreeAdvice} adviceComputing={true} />
    );
    expect(container.textContent).toContain('RECOMPUTING');
    expect(container.firstChild.style.opacity).toBe('0.75');
    // Previous recommendation stays visible (dimmed), not blanked.
    expect(container.textContent).toContain('BET');
  });

  test('no badge when nothing is computing', () => {
    const { container } = render(
      <LiveAdviceBar gameTreeAdvice={baseGameTreeAdvice} adviceComputing={false} />
    );
    expect(container.textContent).not.toContain('RECOMPUTING');
    expect(container.firstChild.style.opacity).toBe('1');
  });

  test('driven by the game-tree compute flag, NOT the equity hook flag', () => {
    // The equity hook computing alone must not claim a game-tree recompute.
    const { container } = render(
      <LiveAdviceBar
        gameTreeAdvice={baseGameTreeAdvice}
        liveEquity={{ equity: 0.5, isComputing: true }}
        adviceComputing={false}
      />
    );
    expect(container.textContent).not.toContain('RECOMPUTING');
  });

  test('computing with no advice yet keeps the bar visible with the analyzing pulse', () => {
    const { container } = render(<LiveAdviceBar adviceComputing={true} />);
    expect(container.firstChild).not.toBeNull();
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// WS-574 / WS-575 — two-phase advice state
//
// The main-app table's advice comes from `OnlineAnalysisContext` (see
// CommandStrip.jsx: `useAnalysisContext` IS the online context), so this surface cannot be
// driven to a badge state by `npm run devshot` against the plain dev table — there is no
// game-tree advisor on that path. These render tests are the verification of the badge
// logic; the visual check belongs on the online/extension path.
// ---------------------------------------------------------------------------

describe('WS-574: refinement state is on the face of the recommendation', () => {
  test('a provisional answer says so', () => {
    const { container } = render(
      <LiveAdviceBar gameTreeAdvice={{ ...baseGameTreeAdvice, isProvisional: true }} />
    );
    expect(container.textContent).toContain('REFINING');
  });

  test('a finished answer does not', () => {
    const { container } = render(
      <LiveAdviceBar gameTreeAdvice={{ ...baseGameTreeAdvice, isProvisional: false }} />
    );
    expect(container.textContent).not.toContain('REFINING');
  });

  test('advice with no phase marker at all renders unchanged — the badge is additive', () => {
    // Every pre-WS-574 caller and every fixture omits these fields. If their absence produced
    // a badge, the surface would be lying about work that never happened.
    const { container } = render(<LiveAdviceBar gameTreeAdvice={baseGameTreeAdvice} />);
    expect(container.textContent).not.toContain('REFINING');
    expect(container.textContent).not.toContain('WAS ');
  });

  test('when refinement changes the action, the bar names what it changed FROM', () => {
    // WS-496 measured depth-2 flipping the top action on 35.3% of flops. A silent swap is the
    // common case, so the callout is the default, not an exception path.
    const { container } = render(
      <LiveAdviceBar gameTreeAdvice={{
        ...baseGameTreeAdvice, isProvisional: false, changedOnRefine: 'bet',
      }} />
    );
    expect(container.textContent).toContain('WAS BET');
  });

  test('the flip callout is suppressed while still provisional', () => {
    // Reporting "WAS BET" next to a BET that has not been superseded yet would be nonsense.
    const { container } = render(
      <LiveAdviceBar gameTreeAdvice={{
        ...baseGameTreeAdvice, isProvisional: true, changedOnRefine: 'bet',
      }} />
    );
    expect(container.textContent).toContain('REFINING');
    expect(container.textContent).not.toContain('WAS BET');
  });
});
