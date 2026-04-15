/**
 * motion-budget.test.js — SR-6.9 enforcement.
 *
 * Pins the motion contract from SIDEBAR_DESIGN_PRINCIPLES (R-6.1/R-6.2/R-6.3):
 *   - .street-card.fade-in animation ≥ 200ms (R-6.1 floor)
 *   - .deep-body max-height transition ≤ 300ms (R-6.2 ceiling)
 *   - @media (prefers-reduced-motion: reduce) zeroes non-essential motion (R-6.3)
 *   - render-street-card fade timer matches the CSS floor (no drift)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = resolve(__dirname, '..', 'side-panel.html');
const STREET_CARD_PATH = resolve(__dirname, '..', 'render-street-card.js');
const html = readFileSync(HTML_PATH, 'utf8');
const streetCardSrc = readFileSync(STREET_CARD_PATH, 'utf8');

describe('SR-6.9 motion budget — CSS durations', () => {
  it('.street-card.fade-in animation is 0.2s (R-6.1 floor)', () => {
    expect(html).toMatch(/\.street-card\.fade-in\s*\{[^}]*animation:\s*streetFadeIn\s+0\.2s/);
  });

  it('.deep-body max-height transition is 0.3s (R-6.2 ceiling)', () => {
    expect(html).toMatch(/\.deep-body\s*\{[^}]*transition:\s*max-height\s+0\.3s/);
  });
});

describe('SR-6.9 motion budget — prefers-reduced-motion', () => {
  it('declares a @media (prefers-reduced-motion: reduce) block', () => {
    expect(html).toMatch(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/);
  });

  it('the reduced-motion block zeroes animation-duration and transition-duration', () => {
    const m = html.match(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{([\s\S]*?)\n\s{0,4}\}\s*\n\s*<\/style>/);
    expect(m, 'reduced-motion @media block must close before </style>').not.toBeNull();
    const body = m[1];
    expect(body).toMatch(/animation-duration\s*:\s*0(?:\.\d+)?m?s\s*!important/);
    expect(body).toMatch(/transition-duration\s*:\s*0(?:\.\d+)?m?s\s*!important/);
  });
});

describe('SR-6.9 motion budget — JS/CSS sync', () => {
  it('render-street-card fade timer matches 200ms CSS floor', () => {
    expect(streetCardSrc).toMatch(/scheduleTimer\([^)]*TRANSITION_TIMER_KEY[\s\S]*?\},\s*200\s*\)/);
  });
});
