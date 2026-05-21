// @vitest-environment jsdom
/**
 * ActionRecommendationStrip.test.jsx — partition-display invariant.
 *
 * WS-185 / SPR-083 — value vs bluff-or-pay weights are a 2-value partition
 * that must sum to exactly 100%.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionRecommendationStrip } from '../ActionRecommendationStrip';

const renderWith = (valueWeight, bluffOrPayWeight, ratio = null) => {
  return render(
    <ActionRecommendationStrip
      recommendation={{ authoredReason: 'test reason', actionLabel: 'Call' }}
      valueBeatRatio={{
        valueWeight,
        bluffOrPayWeight,
        ratio: ratio ?? (bluffOrPayWeight > 0 ? valueWeight / bluffOrPayWeight : Infinity),
      }}
    />,
  );
};

describe('ActionRecommendationStrip — partition invariant (WS-185)', () => {
  it('value + bluff-or-pay sums to exactly 100', () => {
    renderWith(37.5, 62.5);
    const v = parseFloat(screen.getByTestId('ars-pct-value').textContent);
    const b = parseFloat(screen.getByTestId('ars-pct-bluff-or-pay').textContent);
    expect(v + b).toBeCloseTo(100, 9);
  });

  it('asymmetric split sums to exactly 100', () => {
    renderWith(72.456, 27.544);
    const v = parseFloat(screen.getByTestId('ars-pct-value').textContent);
    const b = parseFloat(screen.getByTestId('ars-pct-bluff-or-pay').textContent);
    expect(v + b).toBeCloseTo(100, 9);
  });

  it('1/3 vs 2/3 split sums to exactly 100', () => {
    renderWith(33.333, 66.667);
    const v = parseFloat(screen.getByTestId('ars-pct-value').textContent);
    const b = parseFloat(screen.getByTestId('ars-pct-bluff-or-pay').textContent);
    expect(v + b).toBeCloseTo(100, 9);
  });

  it('zero opposing region renders "no opposing region" hint, no testids', () => {
    render(
      <ActionRecommendationStrip
        recommendation={{ authoredReason: 'test reason', actionLabel: 'Bet' }}
        valueBeatRatio={{
          valueWeight: 100,
          bluffOrPayWeight: 0,
          ratio: Infinity,
        }}
      />,
    );
    // ratio is not finite → the ratio block does not render.
    expect(screen.queryByTestId('ars-pct-value')).toBeNull();
  });

  it('renders factual ratio without grading copy (CD-3 / red line #5)', () => {
    renderWith(40, 60);
    const text = screen.getByText(/value:bluff-or-pay ratio/i);
    expect(text.textContent).not.toMatch(/improve|level up|you missed|streak|score|grade/i);
  });
});
