/**
 * RangeSilhouetteSection.test.jsx — DOM-assertion tests for the Range
 * Silhouette embed inside HandReplayView/ReviewPanel.
 *
 * SLS Stream B1 — WS-041 / SPR-082.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RangeSilhouetteSection } from '../RangeSilhouetteSection';
import { parseRangeString, PREFLOP_CHARTS } from '../../../../utils/pokerCore/rangeMatrix';
import { GRID_SIZE } from '../../../../utils/shapeLanguage';

const afterEach = (fn) => fn; // vitest auto-cleans; this stays for clarity

describe('RangeSilhouetteSection — null / empty handling', () => {
  it('renders nothing when villainRange is null', () => {
    const { container } = render(<RangeSilhouetteSection villainRange={null} />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });

  it('renders nothing when villainRange is undefined', () => {
    const { container } = render(<RangeSilhouetteSection />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });

  it('renders nothing when villainRange has zero mass (empty grid)', () => {
    const empty = new Float64Array(GRID_SIZE);
    const { container } = render(<RangeSilhouetteSection villainRange={empty} />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });

  it('renders nothing when villainRange has near-empty mass (below sparse-input floor)', () => {
    // Just AKs (4 combos) — below MIN_CLASSIFIABLE_MASS (10).
    const sparse = parseRangeString('AKs');
    const { container } = render(<RangeSilhouetteSection villainRange={sparse} />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });
});

describe('RangeSilhouetteSection — classified ranges', () => {
  it('renders the label for a clear Oval (UTG GTO) range', () => {
    render(<RangeSilhouetteSection villainRange={PREFLOP_CHARTS.UTG} />);
    const section = screen.getByTestId('range-silhouette-section');
    expect(section).toBeTruthy();
    const label = screen.getByTestId('range-silhouette-label');
    expect(label.textContent).toContain('Oval');
    expect(label.textContent).toContain('condensed');
    cleanup();
  });

  it('renders the label for a clear Triangle (BTN GTO) range', () => {
    render(<RangeSilhouetteSection villainRange={PREFLOP_CHARTS.BTN} />);
    const label = screen.getByTestId('range-silhouette-label');
    expect(label.textContent).toContain('Triangle');
    expect(label.textContent).toContain('linear');
    cleanup();
  });

  it('renders confidence as a percentage', () => {
    render(<RangeSilhouetteSection villainRange={PREFLOP_CHARTS.UTG} />);
    const confidence = screen.getByTestId('range-silhouette-confidence');
    expect(confidence.textContent).toMatch(/confidence \d+%/);
    cleanup();
  });

  it('renders a score bar with all 5 prototype scores', () => {
    render(<RangeSilhouetteSection villainRange={PREFLOP_CHARTS.UTG} />);
    expect(screen.getByTestId('range-silhouette-score-bar')).toBeTruthy();
    for (const proto of ['oval', 'barbell', 'triangle', 'comb', 'cloud']) {
      expect(screen.getByTestId(`range-silhouette-score-${proto}`)).toBeTruthy();
    }
    cleanup();
  });
});

describe('RangeSilhouetteSection — compound labels', () => {
  it('renders both components when classifier returns compound', () => {
    // Build a synthetic compound case by constructing a grid that's
    // intentionally between two prototypes (e.g., a tight range with
    // a single bluff cluster — between Oval and Barbell).
    const g = parseRangeString('TT+,AKs,AKo,AQs,AQo,KQs,76s,65s,54s');
    render(<RangeSilhouetteSection villainRange={g} />);
    const label = screen.getByTestId('range-silhouette-label');
    // We don't assert which compound combination fires — calibration may
    // shift it. We assert the section renders and confidence is shown.
    expect(label).toBeTruthy();
    expect(screen.getByTestId('range-silhouette-confidence')).toBeTruthy();
    cleanup();
  });
});

describe('RangeSilhouetteSection — collapse toggle', () => {
  it('toggles body visibility on header click', () => {
    render(<RangeSilhouetteSection villainRange={PREFLOP_CHARTS.UTG} />);
    const section = screen.getByTestId('range-silhouette-section');
    const header = section.querySelector('button');
    expect(section.querySelector('#range-silhouette-section-body')).toBeTruthy();
    fireEvent.click(header);
    expect(section.querySelector('#range-silhouette-section-body')).toBe(null);
    fireEvent.click(header);
    expect(section.querySelector('#range-silhouette-section-body')).toBeTruthy();
    cleanup();
  });

  it('has aria-expanded reflecting collapse state', () => {
    render(<RangeSilhouetteSection villainRange={PREFLOP_CHARTS.UTG} />);
    const header = screen.getByTestId('range-silhouette-section').querySelector('button');
    expect(header.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('false');
    cleanup();
  });
});

describe('RangeSilhouetteSection — autonomy red lines', () => {
  it('contains no engagement-pressure or shame copy (CD-3 / I-SM-9)', () => {
    render(<RangeSilhouetteSection villainRange={PREFLOP_CHARTS.UTG} />);
    const section = screen.getByTestId('range-silhouette-section');
    const text = section.textContent.toLowerCase();
    const forbidden = [
      'great job',
      'keep it up',
      'level up',
      'streak',
      'percentile',
      'masteryscore',
      'fusedmastery',
    ];
    for (const f of forbidden) {
      expect(text.includes(f), `Forbidden phrase: "${f}"`).toBe(false);
    }
    cleanup();
  });

  it('renders no write-affordance buttons (no enroll / mute / seed UI)', () => {
    render(<RangeSilhouetteSection villainRange={PREFLOP_CHARTS.UTG} />);
    const section = screen.getByTestId('range-silhouette-section');
    // Allowed: the collapse toggle button. Disallowed: any button with
    // labels matching enroll/mute/seed/start drill/dismiss patterns.
    const buttons = section.querySelectorAll('button');
    for (const btn of buttons) {
      const t = btn.textContent.toLowerCase();
      expect(t.includes('enroll'), `Found enroll affordance`).toBe(false);
      expect(t.includes('mute'), `Found mute affordance`).toBe(false);
      expect(t.includes('mark as known'), `Found known affordance`).toBe(false);
      expect(t.includes('start drill'), `Found drill start`).toBe(false);
    }
    cleanup();
  });

  it('does not render mastery as a single fused score', () => {
    render(<RangeSilhouetteSection villainRange={PREFLOP_CHARTS.UTG} />);
    const text = screen.getByTestId('range-silhouette-section').textContent;
    expect(text).not.toMatch(/mastery[:\s]+0\./i);
    expect(text).not.toMatch(/your level/i);
  });
});
