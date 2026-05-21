/**
 * SaddleSection.test.jsx — DOM-assertion tests for the Saddle embed
 * inside HandReplayView/ReviewPanel.
 *
 * SLS Stream B3 — WS-043 / SPR-088.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SaddleSection } from '../SaddleSection';

const combo = (weight, heroEquity) => ({
  card1: 0,
  card2: 0,
  weight,
  bucket: 'marginal',
  heroEquity,
});

const SADDLE_PER_COMBO = [
  combo(1, 0.05), combo(1, 0.10), combo(1, 0.15), combo(1, 0.20), combo(1, 0.25), // 5 way-ahead
  combo(1, 0.75), combo(1, 0.80), combo(1, 0.85), combo(1, 0.90), combo(1, 0.95), // 5 way-behind
  combo(1, 0.50), // 1 middle
];

const WAY_AHEAD_PER_COMBO = [
  combo(1, 0.05), combo(1, 0.10), combo(1, 0.15), combo(1, 0.20), combo(1, 0.25),
  combo(1, 0.30), combo(1, 0.10), combo(1, 0.05), combo(1, 0.20), combo(1, 0.10), // 10 way-ahead
  combo(1, 0.50), combo(1, 0.55), // 2 middle
];

const WAY_BEHIND_PER_COMBO = [
  combo(1, 0.95), combo(1, 0.90), combo(1, 0.85), combo(1, 0.80), combo(1, 0.75),
  combo(1, 0.70), combo(1, 0.90), combo(1, 0.95), combo(1, 0.80), combo(1, 0.85), // 10 way-behind
  combo(1, 0.50), combo(1, 0.55), // 2 middle
];

const FLAT_PER_COMBO = [
  combo(1, 0.45), combo(1, 0.50), combo(1, 0.55), combo(1, 0.50), combo(1, 0.45),
  combo(1, 0.50), combo(1, 0.55), combo(1, 0.40), combo(1, 0.60), combo(1, 0.50),
];

describe('SaddleSection — null / empty handling', () => {
  it('renders nothing when perCombo is null', () => {
    const { container } = render(<SaddleSection perCombo={null} />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });

  it('renders nothing when perCombo is undefined', () => {
    const { container } = render(<SaddleSection />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });

  it('renders nothing when perCombo is empty array', () => {
    const { container } = render(<SaddleSection perCombo={[]} />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });

  it('renders nothing when perCombo is below sparse-input floor', () => {
    const sparse = [combo(1, 0.1), combo(1, 0.9), combo(1, 0.5)];
    const { container } = render(<SaddleSection perCombo={sparse} />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });
});

describe('SaddleSection — rendered labels', () => {
  it('renders the section wrapper for a saddle range', () => {
    render(<SaddleSection perCombo={SADDLE_PER_COMBO} />);
    expect(screen.getByTestId('saddle-section')).toBeTruthy();
    cleanup();
  });

  it('renders "Saddle" label for canonical saddle perCombo', () => {
    render(<SaddleSection perCombo={SADDLE_PER_COMBO} />);
    const label = screen.getByTestId('saddle-label');
    expect(label.textContent).toContain('Saddle');
    cleanup();
  });

  it('renders "Way-Ahead" label for villain-way-ahead-dominant range', () => {
    render(<SaddleSection perCombo={WAY_AHEAD_PER_COMBO} />);
    const label = screen.getByTestId('saddle-label');
    expect(label.textContent).toContain('Way-Ahead');
    cleanup();
  });

  it('renders "Way-Behind" label for villain-way-behind-dominant range', () => {
    render(<SaddleSection perCombo={WAY_BEHIND_PER_COMBO} />);
    const label = screen.getByTestId('saddle-label');
    expect(label.textContent).toContain('Way-Behind');
    cleanup();
  });

  it('renders "Flat" label for flat distribution', () => {
    render(<SaddleSection perCombo={FLAT_PER_COMBO} />);
    const label = screen.getByTestId('saddle-label');
    expect(label.textContent).toContain('Flat');
    cleanup();
  });
});

describe('SaddleSection — mass summary', () => {
  it('renders both mass percentages alongside the label', () => {
    render(<SaddleSection perCombo={SADDLE_PER_COMBO} />);
    const massSummary = screen.getByTestId('saddle-mass-summary');
    // Format: "WA NN% • WB MM%"
    expect(massSummary.textContent).toMatch(/WA\s+\d+%/);
    expect(massSummary.textContent).toMatch(/WB\s+\d+%/);
    cleanup();
  });

  it('formats mass percentages as integers (no decimals)', () => {
    render(<SaddleSection perCombo={SADDLE_PER_COMBO} />);
    const massSummary = screen.getByTestId('saddle-mass-summary').textContent;
    expect(massSummary).not.toMatch(/\d+\.\d/);
    cleanup();
  });

  it('renders the three-segment mass bar', () => {
    render(<SaddleSection perCombo={SADDLE_PER_COMBO} />);
    expect(screen.getByTestId('saddle-mass-bar')).toBeTruthy();
    expect(screen.getByTestId('saddle-mass-bar-wayAhead')).toBeTruthy();
    expect(screen.getByTestId('saddle-mass-bar-middle')).toBeTruthy();
    expect(screen.getByTestId('saddle-mass-bar-wayBehind')).toBeTruthy();
    cleanup();
  });
});

describe('SaddleSection — collapse toggle', () => {
  it('starts expanded (aria-expanded=true, body visible)', () => {
    render(<SaddleSection perCombo={SADDLE_PER_COMBO} />);
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByTestId('saddle-mass-bar')).toBeTruthy();
    cleanup();
  });

  it('toggles to collapsed when the header button is clicked', () => {
    render(<SaddleSection perCombo={SADDLE_PER_COMBO} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('saddle-mass-bar')).toBeFalsy();
    cleanup();
  });

  it('toggles back to expanded on second click', () => {
    render(<SaddleSection perCombo={SADDLE_PER_COMBO} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByTestId('saddle-mass-bar')).toBeTruthy();
    cleanup();
  });
});

describe('SaddleSection — copy discipline (CD-3 / AP-06)', () => {
  it('does not render shame or grading copy (you should / we recommend)', () => {
    const { container } = render(<SaddleSection perCombo={SADDLE_PER_COMBO} />);
    const text = container.textContent.toLowerCase();
    expect(text).not.toContain('you should');
    expect(text).not.toContain('we recommend');
    expect(text).not.toContain('better');
    expect(text).not.toContain('worse');
    expect(text).not.toContain('great');
    expect(text).not.toContain('excellent');
    cleanup();
  });
});
