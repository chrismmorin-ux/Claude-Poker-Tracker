// @vitest-environment jsdom
/**
 * HeroStateSection.test.jsx
 *
 * WS-143 / SPR-029 (2026-05-03) — first consumer surface for HSP narrative.
 *
 * Coverage:
 *   - Renders nothing on villain-action steps
 *   - Loading state then resolved state on hero actions
 *   - Side-by-side panels with canonical narrative + actual action
 *   - Collapsible toggle works
 *   - Soft-degrade when villain data missing
 *   - Alignment label kinds (aligned, deviation, unknown)
 *   - Re-renders when currentActionEntry changes
 *   - Autonomy red line #5: no shame / engagement-pressure copy in shipped output
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { HeroStateSection } from '../HeroStateSection';
import { detectAlignment, reconstructGameStateAt } from '../heroStateReplayUtils';

// Mock buildHeroState so tests are deterministic + fast.
vi.mock('../../../../utils/heroState/buildHeroState.js', () => ({
  buildHeroState: vi.fn(),
}));

import { buildHeroState } from '../../../../utils/heroState/buildHeroState.js';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const HERO_SEAT = 1;
const BUTTON_SEAT = 6;

const sampleHand = () => ({
  handId: 'hand-1',
  cardState: { heroCards: [51, 46], communityCards: [20, 13, 3] }, // As Kh on 7d 5c 2s
  gameState: {
    players: { 1: { stack: 100 }, 2: { stack: 100 } },
    blindsPosted: [{ amount: 0.5 }, { amount: 1 }],
    rake: null,
  },
});

const heroAction = (overrides = {}) => ({
  seat: HERO_SEAT,
  action: 'BET',
  amount: 2.5,
  street: 'preflop',
  order: 0,
  ...overrides,
});

const villainAction = (overrides = {}) => ({
  seat: 2,
  action: 'CALL',
  amount: 2.5,
  street: 'preflop',
  order: 1,
  ...overrides,
});

const sampleHeroState = (overrides = {}) => ({
  archetypeId: 'PF_OPEN_RFI',
  archetypeFamily: 'PREFLOP_OPEN',
  situation: { street: 'preflop', actionContext: 'OPEN', positionClass: 'HJ' },
  handContext: { hand: [51, 46], handClass: null, handStrength: null },
  equity: { overall: null, vsRangeParts: null, realization: 1.0, realizedEquity: null },
  plan: {
    primary: { action: 'BET', sizing: 2.5, sizingRationale: 'standard open', ev: 0.42 },
    branches: [],
    rangeConfig: null,
  },
  adjustments: [],
  narrative: {
    headline: '**AJo on HJ — standard open.**',
    body: 'We open 2.5bb with the top of our HJ range.',
    branchSummary: 'If 3-bet from BB, fold.',
  },
  ...overrides,
});

// ─── isHeroAction gating ─────────────────────────────────────────────────

describe('HeroStateSection — isHeroAction gating', () => {
  it('renders nothing when currentActionEntry is a villain action', () => {
    render(
      <HeroStateSection
        hand={sampleHand()}
        currentActionEntry={villainAction()}
        visibleActions={[]}
        heroSeat={HERO_SEAT}
        buttonSeat={BUTTON_SEAT}
      />,
    );
    expect(screen.queryByTestId('hero-state-section')).toBeNull();
  });

  it('renders nothing when currentActionEntry is null', () => {
    render(
      <HeroStateSection
        hand={sampleHand()}
        currentActionEntry={null}
        visibleActions={[]}
        heroSeat={HERO_SEAT}
        buttonSeat={BUTTON_SEAT}
      />,
    );
    expect(screen.queryByTestId('hero-state-section')).toBeNull();
  });

  it('renders nothing when heroSeat is missing', () => {
    render(
      <HeroStateSection
        hand={sampleHand()}
        currentActionEntry={heroAction()}
        visibleActions={[]}
        heroSeat={null}
        buttonSeat={BUTTON_SEAT}
      />,
    );
    expect(screen.queryByTestId('hero-state-section')).toBeNull();
  });
});

// ─── Loading / resolved / error states ───────────────────────────────────

describe('HeroStateSection — async lifecycle', () => {
  it('shows loading state immediately on a hero action', () => {
    buildHeroState.mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <HeroStateSection
        hand={sampleHand()}
        currentActionEntry={heroAction()}
        visibleActions={[heroAction()]}
        heroSeat={HERO_SEAT}
        buttonSeat={BUTTON_SEAT}
      />,
    );
    expect(screen.getByTestId('hero-state-loading')).toBeDefined();
  });

  it('renders side-by-side panels after buildHeroState resolves', async () => {
    buildHeroState.mockResolvedValue(sampleHeroState());
    render(
      <HeroStateSection
        hand={sampleHand()}
        currentActionEntry={heroAction()}
        visibleActions={[heroAction()]}
        heroSeat={HERO_SEAT}
        buttonSeat={BUTTON_SEAT}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('hero-state-side-by-side')).toBeDefined();
    });
    expect(screen.getByTestId('hero-state-canonical-panel')).toBeDefined();
    expect(screen.getByTestId('hero-state-actual-panel')).toBeDefined();
  });

  it('renders error message when buildHeroState rejects', async () => {
    buildHeroState.mockRejectedValue(new Error('synthetic error'));
    render(
      <HeroStateSection
        hand={sampleHand()}
        currentActionEntry={heroAction()}
        visibleActions={[heroAction()]}
        heroSeat={HERO_SEAT}
        buttonSeat={BUTTON_SEAT}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('hero-state-error')).toBeDefined();
    });
    expect(screen.getByTestId('hero-state-error').textContent).toMatch(/synthetic error/);
  });

  it('renders error message when hero cards are missing', async () => {
    const handNoCards = { ...sampleHand(), cardState: { heroCards: null, communityCards: [] } };
    render(
      <HeroStateSection
        hand={handNoCards}
        currentActionEntry={heroAction()}
        visibleActions={[heroAction()]}
        heroSeat={HERO_SEAT}
        buttonSeat={BUTTON_SEAT}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('hero-state-error')).toBeDefined();
    });
    expect(screen.getByTestId('hero-state-error').textContent).toMatch(/Hero cards/);
  });
});

// ─── Collapsible toggle ──────────────────────────────────────────────────

describe('HeroStateSection — collapsible toggle', () => {
  it('renders body when expanded; hides body when collapsed', async () => {
    buildHeroState.mockResolvedValue(sampleHeroState());
    render(
      <HeroStateSection
        hand={sampleHand()}
        currentActionEntry={heroAction()}
        visibleActions={[heroAction()]}
        heroSeat={HERO_SEAT}
        buttonSeat={BUTTON_SEAT}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('hero-state-side-by-side')).toBeDefined();
    });
    const toggle = screen.getByRole('button', { name: /reasoning frame/i });
    fireEvent.click(toggle);
    expect(screen.queryByTestId('hero-state-side-by-side')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByTestId('hero-state-side-by-side')).toBeDefined();
  });
});

// ─── Soft-degrade when villain data missing ──────────────────────────────

describe('HeroStateSection — soft-degrade', () => {
  it('renders panels even when villainProfile + villainRange are null', async () => {
    buildHeroState.mockResolvedValue(sampleHeroState());
    render(
      <HeroStateSection
        hand={sampleHand()}
        currentActionEntry={heroAction()}
        visibleActions={[heroAction()]}
        heroSeat={HERO_SEAT}
        buttonSeat={BUTTON_SEAT}
        villainProfile={null}
        villainRange={null}
        villainModel={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('hero-state-side-by-side')).toBeDefined();
    });
    // buildHeroState was called with the nulls — soft-degrade contract held by HSP.
    expect(buildHeroState).toHaveBeenCalledWith(
      expect.objectContaining({ villainProfile: null, villainRange: null, villainModel: null }),
    );
  });
});

// ─── Re-render on currentActionEntry change ──────────────────────────────

describe('HeroStateSection — re-render on decision-point change', () => {
  it('calls buildHeroState again when currentActionEntry changes', async () => {
    buildHeroState.mockResolvedValue(sampleHeroState());
    const { rerender } = render(
      <HeroStateSection
        hand={sampleHand()}
        currentActionEntry={heroAction({ order: 0 })}
        visibleActions={[heroAction({ order: 0 })]}
        heroSeat={HERO_SEAT}
        buttonSeat={BUTTON_SEAT}
      />,
    );
    await waitFor(() => expect(buildHeroState).toHaveBeenCalledTimes(1));
    rerender(
      <HeroStateSection
        hand={sampleHand()}
        currentActionEntry={heroAction({ order: 5, street: 'flop' })}
        visibleActions={[heroAction({ order: 0 }), heroAction({ order: 5, street: 'flop' })]}
        heroSeat={HERO_SEAT}
        buttonSeat={BUTTON_SEAT}
      />,
    );
    await waitFor(() => expect(buildHeroState).toHaveBeenCalledTimes(2));
  });
});

// ─── Autonomy red line #5 — no shame copy ────────────────────────────────

describe('HeroStateSection — autonomy red line #5 (no shame / engagement copy)', () => {
  it('default rendered output contains no graded / engagement-pressure copy', async () => {
    buildHeroState.mockResolvedValue(sampleHeroState());
    render(
      <HeroStateSection
        hand={sampleHand()}
        currentActionEntry={heroAction()}
        visibleActions={[heroAction()]}
        heroSeat={HERO_SEAT}
        buttonSeat={BUTTON_SEAT}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('hero-state-side-by-side')).toBeDefined());
    const text = screen.getByTestId('hero-state-section').textContent || '';
    // Forbidden: graded copy, scoring, streak, engagement-pressure, shame.
    expect(text).not.toMatch(/wrong/i);
    expect(text).not.toMatch(/missed/i);
    expect(text).not.toMatch(/score/i);
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/level up/i);
    expect(text).not.toMatch(/master/i);
    expect(text).not.toMatch(/grade/i);
    expect(text).not.toMatch(/great job/i);
    expect(text).not.toMatch(/well done/i);
    expect(text).not.toMatch(/excellent/i);
  });
});

// ─── detectAlignment helper ──────────────────────────────────────────────

describe('detectAlignment', () => {
  it('returns aligned when actual + canonical actions match + sizing close', () => {
    const result = detectAlignment(
      { action: 'BET', amount: 2.5 },
      { action: 'BET', sizing: 2.5 },
    );
    expect(result.kind).toBe('aligned');
    expect(result.label).toMatch(/aligned/i);
  });

  it('returns deviation when canonical action differs', () => {
    const result = detectAlignment(
      { action: 'CHECK', amount: null },
      { action: 'BET', sizing: 2.5 },
    );
    expect(result.kind).toBe('deviation');
    expect(result.label).toMatch(/different line/i);
  });

  it('returns unknown when canonical plan is null', () => {
    const result = detectAlignment(
      { action: 'BET', amount: 2.5 },
      null,
    );
    expect(result.kind).toBe('unknown');
  });

  it('flags sizing differs but action aligned when sizing diverges', () => {
    const result = detectAlignment(
      { action: 'BET', amount: 5 },
      { action: 'BET', sizing: 2.5 },
    );
    expect(result.kind).toBe('aligned');
    expect(result.label).toMatch(/sizing differs/i);
  });

  it('label contains no graded / shame copy across all kinds', () => {
    const cases = [
      detectAlignment({ action: 'BET', amount: 2.5 }, { action: 'BET', sizing: 2.5 }),
      detectAlignment({ action: 'CHECK' }, { action: 'BET', sizing: 2.5 }),
      detectAlignment({ action: 'BET', amount: 2.5 }, null),
      detectAlignment({ action: 'BET', amount: 5 }, { action: 'BET', sizing: 2.5 }),
    ];
    for (const c of cases) {
      expect(c.label).not.toMatch(/wrong|missed|score|streak|grade|excellent|great job/i);
    }
  });
});

// ─── reconstructGameStateAt helper ───────────────────────────────────────

describe('reconstructGameStateAt', () => {
  it('throws when hand or currentActionEntry missing', () => {
    expect(() => reconstructGameStateAt({})).toThrow(/required/);
  });

  it('returns gameState shape with required fields', () => {
    const gs = reconstructGameStateAt({
      hand: sampleHand(),
      visibleActions: [heroAction()],
      currentActionEntry: heroAction(),
      heroSeat: HERO_SEAT,
      buttonSeat: BUTTON_SEAT,
    });
    expect(gs.street).toBe('preflop');
    expect(Array.isArray(gs.board)).toBe(true);
    expect(gs.heroPosition).toBeTruthy();
    expect(gs.pot).toBeGreaterThan(0); // blinds + actions summed
    expect(gs.playersRemaining).toBeGreaterThanOrEqual(2);
    expect(gs.actionSequence.length).toBeGreaterThan(0);
  });

  it('renders board for flop street', () => {
    const gs = reconstructGameStateAt({
      hand: sampleHand(),
      visibleActions: [heroAction()],
      currentActionEntry: heroAction({ street: 'flop' }),
      heroSeat: HERO_SEAT,
      buttonSeat: BUTTON_SEAT,
    });
    expect(gs.board.length).toBe(3);
  });

  it('returns empty board preflop', () => {
    const gs = reconstructGameStateAt({
      hand: sampleHand(),
      visibleActions: [],
      currentActionEntry: heroAction({ street: 'preflop' }),
      heroSeat: HERO_SEAT,
      buttonSeat: BUTTON_SEAT,
    });
    expect(gs.board).toEqual([]);
  });

  it('inPosition is null preflop', () => {
    const gs = reconstructGameStateAt({
      hand: sampleHand(),
      visibleActions: [],
      currentActionEntry: heroAction({ street: 'preflop' }),
      heroSeat: HERO_SEAT,
      buttonSeat: BUTTON_SEAT,
    });
    expect(gs.inPosition).toBeNull();
  });
});
