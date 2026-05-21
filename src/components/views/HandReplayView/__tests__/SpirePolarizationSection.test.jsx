/**
 * SpirePolarizationSection.test.jsx — DOM-assertion tests for the
 * Spire+Polarization embed inside HandReplayView/ReviewPanel.
 *
 * SLS Stream B2 — WS-042 / SPR-084.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SpirePolarizationSection } from '../SpirePolarizationSection';

const mk = (weight, heroEquity) => ({ weight, heroEquity });

// Same fixture as EDC section — hockey-stick perCombo with a small
// spire on the high villain-equity end.
const HOCKEY_STICK_PER_COMBO = [
  mk(1, 0.7), mk(1, 0.7), mk(1, 0.7), mk(1, 0.7), mk(1, 0.7), mk(1, 0.7),
  mk(1, 0.05), mk(1, 0.05),
];

// Bimodal perCombo — equal mass on each extreme of villain equity.
const DUMBBELL_PER_COMBO = [
  mk(1, 1), mk(1, 1), mk(1, 1), mk(1, 1), // villain eq 0 → bucket 0
  mk(1, 0), mk(1, 0), mk(1, 0), mk(1, 0), // villain eq 1 → bucket 7
];

// Mid-mass-only perCombo — no top-bucket combos at all, so no spire
// can possibly fire. Combos cluster around villain eq 0.4-0.6.
const NO_SPIRE_PER_COMBO = (() => {
  const out = [];
  for (let i = 0; i < 10; i++) out.push(mk(1, 0.55)); // villain eq 0.45 → bucket 3
  for (let i = 0; i < 10; i++) out.push(mk(1, 0.45)); // villain eq 0.55 → bucket 4
  return out;
})();

describe('SpirePolarizationSection — null / empty handling', () => {
  it('renders nothing when perCombo is null', () => {
    const { container } = render(<SpirePolarizationSection perCombo={null} />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });

  it('renders nothing when perCombo is undefined', () => {
    const { container } = render(<SpirePolarizationSection />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });

  it('renders nothing when perCombo is empty', () => {
    const { container } = render(<SpirePolarizationSection perCombo={[]} />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });

  it('renders nothing when curve weight falls below sparse-input floor', () => {
    const sparse = [mk(0.0001, 0.5), mk(0.0005, 0.7)];
    const { container } = render(<SpirePolarizationSection perCombo={sparse} />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });
});

describe('SpirePolarizationSection — rendered labels', () => {
  it('renders the section wrapper for valid perCombo', () => {
    render(<SpirePolarizationSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    expect(screen.getByTestId('spire-polarization-section')).toBeTruthy();
    cleanup();
  });

  it('renders Spire chip when classifier fires hasSpire', () => {
    render(<SpirePolarizationSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    const chip = screen.getByTestId('spire-polarization-spire-chip');
    expect(chip.textContent).toMatch(/Spire/);
    cleanup();
  });

  it('renders No-spire chip when classifier reports hasSpire=false', () => {
    render(<SpirePolarizationSection perCombo={NO_SPIRE_PER_COMBO} />);
    const chip = screen.getByTestId('spire-polarization-spire-chip');
    expect(chip.textContent.toLowerCase()).toContain('no spire');
    cleanup();
  });

  it('renders the Dumbbell polarization label for bimodal data', () => {
    render(<SpirePolarizationSection perCombo={DUMBBELL_PER_COMBO} />);
    const label = screen.getByTestId('spire-polarization-label');
    expect(label.textContent).toContain('Dumbbell');
    cleanup();
  });

  it('renders one of the canonical 4 polarization labels', () => {
    render(<SpirePolarizationSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    const label = screen.getByTestId('spire-polarization-label').textContent;
    const matchAny = ['Flat', 'Left-heavy', 'Right-heavy', 'Dumbbell']
      .some((l) => label.includes(l));
    expect(matchAny).toBe(true);
    cleanup();
  });
});

describe('SpirePolarizationSection — 8-bucket histogram bar', () => {
  it('renders all 8 buckets', () => {
    render(<SpirePolarizationSection perCombo={DUMBBELL_PER_COMBO} />);
    for (let i = 0; i < 8; i++) {
      expect(screen.getByTestId(`spire-polarization-bucket-${i}`)).toBeTruthy();
    }
    cleanup();
  });

  it('renders the bar container with aria-label', () => {
    render(<SpirePolarizationSection perCombo={DUMBBELL_PER_COMBO} />);
    const bar = screen.getByTestId('spire-polarization-bucket-bar');
    expect(bar.getAttribute('aria-label')).toMatch(/equity distribution/i);
    cleanup();
  });
});

describe('SpirePolarizationSection — collapse toggle', () => {
  it('toggles body on header click', () => {
    render(<SpirePolarizationSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    const section = screen.getByTestId('spire-polarization-section');
    const header = section.querySelector('button');
    expect(section.querySelector('#spire-polarization-section-body')).toBeTruthy();
    fireEvent.click(header);
    expect(section.querySelector('#spire-polarization-section-body')).toBe(null);
    fireEvent.click(header);
    expect(section.querySelector('#spire-polarization-section-body')).toBeTruthy();
    cleanup();
  });

  it('reflects collapse state in aria-expanded', () => {
    render(<SpirePolarizationSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    const header = screen.getByTestId('spire-polarization-section').querySelector('button');
    expect(header.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('false');
    cleanup();
  });
});

describe('SpirePolarizationSection — autonomy red lines', () => {
  it('contains no engagement-pressure copy', () => {
    render(<SpirePolarizationSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    const text = screen.getByTestId('spire-polarization-section').textContent.toLowerCase();
    const forbidden = [
      'great job', 'keep it up', 'level up', 'streak',
      'percentile rank', 'masteryscore', 'fusedmastery', 'your skill',
    ];
    for (const f of forbidden) {
      expect(text.includes(f), `Forbidden phrase: "${f}"`).toBe(false);
    }
    cleanup();
  });

  it('renders no write-affordance buttons', () => {
    render(<SpirePolarizationSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    const buttons = screen.getByTestId('spire-polarization-section').querySelectorAll('button');
    for (const btn of buttons) {
      const t = btn.textContent.toLowerCase();
      for (const w of ['enroll', 'mute', 'mark as known', 'start drill']) {
        expect(t.includes(w), `Found ${w} affordance`).toBe(false);
      }
    }
    cleanup();
  });
});
