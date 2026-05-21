/**
 * SizingCurveTagSection.test.jsx — DOM-assertion tests for the
 * Sizing Curve Tag embed inside HandReplayView/ReviewPanel.
 *
 * SLS Stream B2 — WS-042 / SPR-084.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SizingCurveTagSection } from '../SizingCurveTagSection';

const mk = (fraction, ev) => ({ fraction, ev });

const RIDGE_EV = [
  mk(0.25, 0.0),
  mk(0.50, 0.2),
  mk(0.75, 1.0),
  mk(1.00, 0.3),
  mk(1.50, 0.1),
];

const CLIFF_EV = [
  mk(0.25, 1.0),
  mk(0.50, 0.7),
  mk(0.75, 0.4),
  mk(1.00, 0.1),
];

const RAMP_EV = [
  mk(0.25, 0.0),
  mk(0.50, 0.3),
  mk(0.75, 0.6),
  mk(1.00, 1.0),
];

describe('SizingCurveTagSection — null / empty handling', () => {
  it('renders nothing when evByFraction is null', () => {
    const { container } = render(<SizingCurveTagSection evByFraction={null} />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });

  it('renders nothing when evByFraction is undefined', () => {
    const { container } = render(<SizingCurveTagSection />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });

  it('renders nothing when evByFraction has fewer than MIN_SAMPLES', () => {
    const { container } = render(
      <SizingCurveTagSection evByFraction={[mk(0.5, 1), mk(0.75, 2)]} />,
    );
    expect(container.firstChild).toBe(null);
    cleanup();
  });
});

describe('SizingCurveTagSection — rendered output', () => {
  it('renders the section wrapper for valid evByFraction', () => {
    render(<SizingCurveTagSection evByFraction={RIDGE_EV} />);
    expect(screen.getByTestId('sizing-curve-tag-section')).toBeTruthy();
    cleanup();
  });

  it('renders the Ridge label for a sharp interior peak', () => {
    render(<SizingCurveTagSection evByFraction={RIDGE_EV} />);
    const label = screen.getByTestId('sizing-curve-tag-label');
    expect(label.textContent).toMatch(/Ridge|Compound/i);
    cleanup();
  });

  it('renders the Cliff label for monotone-decreasing curve', () => {
    render(<SizingCurveTagSection evByFraction={CLIFF_EV} />);
    const label = screen.getByTestId('sizing-curve-tag-label');
    expect(label.textContent).toMatch(/Cliff|Compound/i);
    cleanup();
  });

  it('renders the Ramp label for monotone-increasing curve', () => {
    render(<SizingCurveTagSection evByFraction={RAMP_EV} />);
    const label = screen.getByTestId('sizing-curve-tag-label');
    expect(label.textContent).toMatch(/Ramp|Compound/i);
    cleanup();
  });

  it('renders confidence as a percentage', () => {
    render(<SizingCurveTagSection evByFraction={RIDGE_EV} />);
    const conf = screen.getByTestId('sizing-curve-tag-confidence');
    expect(conf.textContent).toMatch(/confidence \d+%/);
    cleanup();
  });

  it('renders a per-prototype score bar with all 4 entries', () => {
    render(<SizingCurveTagSection evByFraction={RIDGE_EV} />);
    expect(screen.getByTestId('sizing-curve-tag-score-bar')).toBeTruthy();
    for (const proto of ['ridge', 'plateau', 'cliff', 'ramp']) {
      expect(screen.getByTestId(`sizing-curve-tag-score-${proto}`)).toBeTruthy();
    }
    cleanup();
  });

  it('renders the SVG thumbnail curve', () => {
    render(<SizingCurveTagSection evByFraction={RIDGE_EV} />);
    const thumb = screen.getByTestId('sizing-curve-tag-thumb');
    expect(thumb).toBeTruthy();
    expect(thumb.tagName.toLowerCase()).toBe('svg');
    expect(thumb.querySelector('path')).toBeTruthy();
    cleanup();
  });

  it('marks the peak with a circle on the thumb', () => {
    render(<SizingCurveTagSection evByFraction={RIDGE_EV} />);
    const peak = screen.getByTestId('sizing-curve-tag-thumb-peak');
    expect(peak).toBeTruthy();
    expect(peak.tagName.toLowerCase()).toBe('circle');
    cleanup();
  });
});

describe('SizingCurveTagSection — collapse toggle', () => {
  it('toggles body on header click', () => {
    render(<SizingCurveTagSection evByFraction={RIDGE_EV} />);
    const section = screen.getByTestId('sizing-curve-tag-section');
    const header = section.querySelector('button');
    expect(section.querySelector('#sizing-curve-tag-section-body')).toBeTruthy();
    fireEvent.click(header);
    expect(section.querySelector('#sizing-curve-tag-section-body')).toBe(null);
    fireEvent.click(header);
    expect(section.querySelector('#sizing-curve-tag-section-body')).toBeTruthy();
    cleanup();
  });

  it('reflects collapse state in aria-expanded', () => {
    render(<SizingCurveTagSection evByFraction={RIDGE_EV} />);
    const header = screen.getByTestId('sizing-curve-tag-section').querySelector('button');
    expect(header.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('false');
    cleanup();
  });
});

describe('SizingCurveTagSection — autonomy red lines', () => {
  it('contains no engagement-pressure copy', () => {
    render(<SizingCurveTagSection evByFraction={RIDGE_EV} />);
    const text = screen.getByTestId('sizing-curve-tag-section').textContent.toLowerCase();
    const forbidden = [
      'great job', 'keep it up', 'level up', 'streak',
      'percentile rank', 'masteryscore', 'fusedmastery',
      'your skill', 'we recommend',
    ];
    for (const f of forbidden) {
      expect(text.includes(f), `Forbidden phrase: "${f}"`).toBe(false);
    }
    cleanup();
  });

  it('renders no write-affordance buttons', () => {
    render(<SizingCurveTagSection evByFraction={RIDGE_EV} />);
    const buttons = screen.getByTestId('sizing-curve-tag-section').querySelectorAll('button');
    for (const btn of buttons) {
      const t = btn.textContent.toLowerCase();
      for (const w of ['enroll', 'mute', 'mark as known', 'start drill']) {
        expect(t.includes(w), `Found ${w} affordance`).toBe(false);
      }
    }
    cleanup();
  });
});
