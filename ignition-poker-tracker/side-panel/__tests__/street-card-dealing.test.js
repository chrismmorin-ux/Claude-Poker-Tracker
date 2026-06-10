// @vitest-environment jsdom
/**
 * street-card-dealing.test.js — WS-113 (RT-90) regression.
 *
 * During DEALING (the gap between hands), the street card must NOT keep the
 * prior hand's advice visible under the loading shimmer — holding stale advice
 * there misrepresents it as loading-current. The advice body is blanked during
 * DEALING; other loading states (PREFLOP awaiting advice on the now-live hand)
 * keep the hold-and-shimmer.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderStreetCard, resetStreetCardState } from '../render-street-card.js';

const PRIOR = '<div class="street-card-section">PRIOR HAND ADVICE — value bet 9.4</div>';

const setup = () => {
  document.body.innerHTML = `<div id="street-card">${PRIOR}</div>`;
  resetStreetCardState();
  return document.getElementById('street-card');
};

describe('renderStreetCard — DEALING blanks prior-hand advice (WS-113 / RT-90)', () => {
  beforeEach(() => setup());

  it('blanks the Z3 advice body during DEALING with advice pending', () => {
    const card = document.getElementById('street-card');
    expect(card.innerHTML).toContain('PRIOR HAND ADVICE'); // precondition: prior content present

    renderStreetCard(
      'preflop',
      null, // no advice yet
      { state: 'DEALING', currentStreet: 'preflop', heroSeat: 5 },
      {},
      null,
      null,
      { loading: true },
    );

    // No prior-hand advice may remain visible during DEALING.
    expect(card.innerHTML).toBe('');
    expect(card.innerHTML).not.toContain('PRIOR HAND ADVICE');
    // The shimmer (a ::after pseudo-element) is driven by this class.
    expect(card.classList.contains('loading-advice')).toBe(true);
  });

  it('does NOT blank during PREFLOP-awaiting-advice — same live hand keeps the hold', () => {
    const card = document.getElementById('street-card');

    renderStreetCard(
      'preflop',
      null,
      { state: 'PREFLOP', currentStreet: 'preflop', heroSeat: 5 },
      {},
      null,
      null,
      { loading: true },
    );

    // PREFLOP is the live hand awaiting advice — hold-and-shimmer is correct.
    expect(card.innerHTML).toContain('PRIOR HAND ADVICE');
    expect(card.classList.contains('loading-advice')).toBe(true);
  });

  it('blanks idempotently — a second DEALING render keeps the body empty', () => {
    const card = document.getElementById('street-card');
    const args = [
      'preflop', null,
      { state: 'DEALING', currentStreet: 'preflop', heroSeat: 5 },
      {}, null, null, { loading: true },
    ];
    renderStreetCard(...args);
    renderStreetCard(...args);
    expect(card.innerHTML).toBe('');
  });
});
