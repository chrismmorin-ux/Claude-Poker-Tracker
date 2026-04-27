// @vitest-environment jsdom
/**
 * HandPlanSection.test.jsx — Stream P P5.
 *
 * Tests the Hand Plan composition root: source-selection logic, authored
 * plan rendering, engine plan rendering, conditional default visibility
 * (Q2=C), sessionStorage toggle persistence, and chip-modal integration.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// Mock the engine BEFORE importing HandPlanSection so the module wires the
// mock at import time. computeDepth2Plan is async; mock returns a stable
// shape per test (we override per-test where needed). LSW-D1 swapped the
// HandPlanSection's engine call from computeEnginePlan to computeDepth2Plan.
vi.mock('../../../../../utils/postflopDrillContent/computeDepth2Plan', () => ({
  computeDepth2Plan: vi.fn(),
}));

// Mock villainRanges so we don't pull the full alias resolution machinery.
vi.mock('../../../../../utils/postflopDrillContent/villainRanges', () => ({
  villainRangeFor: vi.fn(() => new Float64Array(1326)),
}));

// Mock parseBoard / parseAndEncode to return deterministic non-throwing values.
vi.mock('../../../../../utils/pokerCore/cardParser', () => ({
  parseBoard: vi.fn(() => [0, 1, 2]),
  parseAndEncode: vi.fn(() => 1),
}));

import { HandPlanSection, selectActivePlanSource } from '../HandPlanSection';
import { computeDepth2Plan } from '../../../../../utils/postflopDrillContent/computeDepth2Plan';
import { clearEngineCache } from '../../../../../utils/postflopDrillContent/engineCache';

const mockEnginePlan = (override = {}) => ({
  heroCombo: 'J♥T♠',
  perAction: [
    { actionLabel: 'check', actionKind: 'check', betFraction: null, ev: 12, evLow: null, evHigh: null, isBest: false, unsupported: false },
    { actionLabel: 'bet', actionKind: 'bet', betFraction: 0.75, ev: 18.32, evLow: null, evHigh: null, isBest: true, unsupported: false },
  ],
  bestActionLabel: 'bet',
  bestActionReason: 'Correct: bet at +18.32bb — depth-2 weighted reasoning.',
  decisionKind: 'standard',
  caveats: ['real-range'],
  nextStreetPlan: null,
  errorState: null,
  ...override,
});

const baseNode = (overrides = {}) => ({
  id: 'flop_root',
  street: 'flop',
  board: ['T♥', '9♥', '6♠'],
  pot: 20.5,
  decisionKind: 'standard',
  heroView: {
    kind: 'single-combo',
    combos: ['J♥T♠'],
    bucketCandidates: ['topPairGood'],
  },
  villainRangeContext: { baseRangeId: 'btn_vs_bb_3bp_bb_range' },
  decision: {
    prompt: 'Hero plays?',
    branches: [
      { label: 'Call',  nextId: null, correct: true,  rationale: '' },
      { label: 'Raise', nextId: null, correct: false, rationale: '' },
    ],
  },
  sections: [{ kind: 'prose', body: '...' }],
  ...overrides,
});

const baseLine = {
  id: 'test-line',
  setup: {
    villains: [{ position: 'BB', action: 'threeBet', vs: 'BTN' }],
    effStack: 90,
  },
};

beforeEach(() => {
  cleanup();
  clearEngineCache();
  computeDepth2Plan.mockReset();
  computeDepth2Plan.mockResolvedValue(mockEnginePlan());
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
});

// ---------- selectActivePlanSource (pure helper) ----------

describe('selectActivePlanSource', () => {
  it('authored alone → authored-only', () => {
    expect(selectActivePlanSource({ hasAuthored: true, hasEngine: false, toggleOn: false })).toBe('authored-only');
  });
  it('authored + toggle off → authored-only (engine hidden by default)', () => {
    expect(selectActivePlanSource({ hasAuthored: true, hasEngine: true, toggleOn: false })).toBe('authored-only');
  });
  it('authored + toggle on → both', () => {
    expect(selectActivePlanSource({ hasAuthored: true, hasEngine: true, toggleOn: true })).toBe('both');
  });
  it('no authored + engine present → engine-only (default for un-authored nodes)', () => {
    expect(selectActivePlanSource({ hasAuthored: false, hasEngine: true, toggleOn: false })).toBe('engine-only');
  });
  it('no authored + no engine → none', () => {
    expect(selectActivePlanSource({ hasAuthored: false, hasEngine: false, toggleOn: false })).toBe('none');
  });
});

// ---------- Render gating ----------

describe('HandPlanSection — render gating', () => {
  it('renders nothing when heroView is absent', () => {
    const node = baseNode({ heroView: undefined });
    const { container } = render(<HandPlanSection node={node} line={baseLine} archetype="reg" />);
    expect(container.firstChild).toBeNull();
    expect(computeDepth2Plan).not.toHaveBeenCalled();
  });
});

// ---------- Engine-only path (no authored) ----------

describe('HandPlanSection — engine-only path (no authored plan)', () => {
  it('renders engine plan with per-action EV table', async () => {
    render(<HandPlanSection node={baseNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText('Solver plan')).toBeInTheDocument());
    expect(screen.getByText('bet')).toBeInTheDocument();
    expect(screen.getByText('+18.32bb')).toBeInTheDocument();
    expect(screen.getByText('best')).toBeInTheDocument();
  });

  it('renders the templated reason', async () => {
    render(<HandPlanSection node={baseNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText(/Correct: bet at \+18\.32bb/)).toBeInTheDocument());
  });

  it('renders real-range caveat (depth-2 path replaces v1-simplified-ev)', async () => {
    render(<HandPlanSection node={baseNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText(/real-range/)).toBeInTheDocument());
  });

  it('renders an unavailable-forward-look stub when nextStreetPlan is null', async () => {
    render(<HandPlanSection node={baseNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText(/Forward-look unavailable/)).toBeInTheDocument());
  });

  it('renders the structured forward-look list when nextStreetPlan is present', async () => {
    computeDepth2Plan.mockResolvedValue(mockEnginePlan({
      nextStreetPlan: {
        ifCall: { plan: 'barrel', sizing: 0.66, scaryCardRanks: ['A', 'K'], note: 'Continue betting ~66% pot on safe runouts' },
        ifRaise: { plan: 'fold', note: 'Fold — their raise range is too strong here' },
      },
    }));
    render(<HandPlanSection node={baseNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText('Forward look')).toBeInTheDocument());
    expect(screen.getByText(/If villain calls/)).toBeInTheDocument();
    expect(screen.getByText(/Continue betting ~66% pot/)).toBeInTheDocument();
    expect(screen.getByText(/scary: A, K/)).toBeInTheDocument();
    expect(screen.getByText(/If villain raises/)).toBeInTheDocument();
    expect(screen.getByText(/Fold — their raise range is too strong/)).toBeInTheDocument();
  });

  it('does NOT render the toggle when only engine source is available', async () => {
    render(<HandPlanSection node={baseNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText('Solver plan')).toBeInTheDocument());
    expect(screen.queryByText('Show solver plan')).toBeNull();
  });
});

// ---------- Authored-only path ----------

describe('HandPlanSection — authored-only path (no toggle)', () => {
  const authoredNode = () => baseNode({
    comboPlans: {
      topPairGood: {
        planText: 'Call-call-fold to 75% turn barrel; lead bricks.',
        ruleChips: ['mdf-defense', 'call-fold-to-turn-barrel'],
      },
    },
  });

  it('renders authored plan text and "Your plan" label', async () => {
    render(<HandPlanSection node={authoredNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText('Your plan')).toBeInTheDocument());
    expect(screen.getByText(/Call-call-fold to 75% turn barrel/)).toBeInTheDocument();
  });

  it('renders rule chip pills', async () => {
    render(<HandPlanSection node={authoredNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText('mdf defense')).toBeInTheDocument());
    expect(screen.getByText('call fold to turn barrel')).toBeInTheDocument();
  });

  it('does NOT call the engine when authored present and toggle off (saves MC compute)', async () => {
    render(<HandPlanSection node={authoredNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText('Your plan')).toBeInTheDocument());
    // small wait to ensure no debounced engine call kicks in
    expect(computeDepth2Plan).not.toHaveBeenCalled();
  });

  it('hides Solver plan section by default when authored present', async () => {
    render(<HandPlanSection node={authoredNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText('Your plan')).toBeInTheDocument());
    expect(screen.queryByText('Solver plan')).toBeNull();
  });

  it('renders the toggle ONLY when both sources will exist (after engine resolves)', async () => {
    // The toggle is gated on hasAuthored && hasEngine. Engine plan is fetched
    // only if toggleOn — which it isn't by default, so toggle never appears.
    // To get the toggle to show, the test sets sessionStorage = '1' before
    // mount, which makes needsEngine true and lets engine plan resolve.
    sessionStorage.setItem('handPlanShowSolver', '1');
    render(<HandPlanSection node={authoredNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText('Show solver plan')).toBeInTheDocument());
  });

  it('honors per-combo override when present (replaces bucket plan)', async () => {
    const node = baseNode({
      comboPlans: {
        topPairGood: {
          planText: 'Generic top-pair-good plan.',
          ruleChips: ['mdf-defense'],
          overrides: {
            'J♥T♠': {
              planText: 'JTs specifically: lead any heart turn.',
              ruleChips: ['board-improvement-plan'],
            },
          },
        },
      },
    });
    render(<HandPlanSection node={node} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText(/JTs specifically/)).toBeInTheDocument());
    expect(screen.queryByText(/Generic top-pair-good/)).toBeNull();
    expect(screen.getByText('board improvement plan')).toBeInTheDocument();
  });
});

// ---------- Both path (toggle on) ----------

describe('HandPlanSection — both path (toggle on, sessionStorage seeded)', () => {
  const authoredNode = () => baseNode({
    comboPlans: {
      topPairGood: {
        planText: 'Call-call-fold default plan.',
        ruleChips: ['mdf-defense'],
      },
    },
  });

  it('renders both authored and engine when sessionStorage toggle is "1"', async () => {
    sessionStorage.setItem('handPlanShowSolver', '1');
    render(<HandPlanSection node={authoredNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText('Your plan')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Solver plan')).toBeInTheDocument());
  });

  it('toggle persistence: toggling off updates sessionStorage', async () => {
    sessionStorage.setItem('handPlanShowSolver', '1');
    render(<HandPlanSection node={authoredNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText('Show solver plan')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/Show solver plan/i));
    expect(sessionStorage.getItem('handPlanShowSolver')).toBe('0');
  });
});

// ---------- Chip-modal integration ----------

describe('HandPlanSection — chip modal integration', () => {
  const authoredNode = () => baseNode({
    comboPlans: {
      topPairGood: {
        planText: 'Plan with chip.',
        ruleChips: ['mdf-defense'],
      },
    },
  });

  it('opens RuleChipModal when chip is tapped', async () => {
    render(<HandPlanSection node={authoredNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText('mdf defense')).toBeInTheDocument());
    fireEvent.click(screen.getByText('mdf defense'));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Rule: MDF Defense');
  });

  it('closes modal on close button tap', async () => {
    render(<HandPlanSection node={authoredNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText('mdf defense')).toBeInTheDocument());
    fireEvent.click(screen.getByText('mdf defense'));
    fireEvent.click(screen.getByLabelText('Close rule'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

// ---------- Engine errorState path ----------

describe('HandPlanSection — engine error state', () => {
  it('renders "Solver plan unavailable" when computeDepth2Plan returns errorState', async () => {
    computeDepth2Plan.mockResolvedValue(mockEnginePlan({
      perAction: [],
      bestActionLabel: null,
      bestActionReason: null,
      caveats: [],
      errorState: {
        kind: 'engine-internal',
        userMessage: 'Multiway not yet supported',
        diagnostic: 'MW engine is LSW-G6',
        recovery: 'Wait for LSW-G6 multiway engine to ship.',
      },
    }));
    render(<HandPlanSection node={baseNode()} line={baseLine} archetype="reg" />);
    await waitFor(() => expect(screen.getByText('Solver plan unavailable')).toBeInTheDocument());
    expect(screen.getByText('Multiway not yet supported')).toBeInTheDocument();
    expect(screen.getByText(/Wait for LSW-G6/)).toBeInTheDocument();
  });
});
