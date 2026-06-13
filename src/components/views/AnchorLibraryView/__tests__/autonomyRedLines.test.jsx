// @vitest-environment jsdom
/**
 * autonomyRedLines.test.jsx — contract suite for the 9 EAL autonomy red lines.
 *
 * WS-025 (legacy EAL-G5-RL). Acceptance: each red line has a passing test.
 *
 * The 9 red lines are owner-ratified guarantees enumerated in
 * `docs/design/audits/2026-04-24-blindspot-exploit-anchor-library.md`
 * §"The 9 autonomy red lines" and promoted to persona-level invariants in
 * `personas/core/chris-live-player.md` §Autonomy constraint:
 *
 *   1. Opt-in enrollment for the calibration loop
 *   2. Transparency screen per anchor, always one tap away
 *   3. Durable override — retire / suppress / reset respected indefinitely
 *   4. Three-way reversibility — per-anchor reset / global library reset /
 *      incognito observation mode
 *   5. No streaks / shame / engagement-pressure notifications
 *   6. Flat anchor index always accessible
 *   7. Editor's-note tone, never proclamation
 *   8. No cross-surface contamination — live surface = badge + dial only
 *   9. Incognito observation mode non-negotiable
 *
 * This file is the CONTRACT GUARD: deeper feature coverage lives in the
 * per-component suites (AnchorDetailPanel.test.jsx, LiveAnchorBadge.test.jsx,
 * useAnchorRetirement.test.js, AnchorObservationModal.test.jsx, ...). Each
 * block here asserts the load-bearing core of one red line so a regression
 * fails CI with the red line named in the failure output.
 *
 * Lives under AnchorLibraryView/__tests__ (the EAL home surface) because the
 * vitest `component` project is the only one with jsdom + jest-dom setup; the
 * suite itself spans utils + reducers + four surfaces.
 *
 * Red line #4b (global library reset) is NOT yet implemented — tracked as
 * WS-221. The it.todo marker below keeps the gap visible in every test run.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../../hooks/useAnchorObservationCapture', () => ({
  useAnchorObservationCapture: vi.fn(),
}));

import {
  ANCHOR_LIBRARY_ACTIONS,
  ENROLLMENT_STATES,
  initialAnchorLibraryState,
} from '../../../../constants/anchorLibraryConstants';
import { anchorLibraryReducer } from '../../../../reducers/anchorLibraryReducer';
import { captureObservation } from '../../../../utils/anchorLibrary/captureObservation';
import {
  RETIREMENT_ACTIONS,
  FORBIDDEN_PATTERNS as RETIREMENT_FORBIDDEN_PATTERNS,
  buildRetirementCopy,
  buildLibraryResetCopy,
  validateRetirementCopyBundle,
} from '../../../../utils/anchorLibrary/retirementCopy';
import {
  FORBIDDEN_PATTERNS as CALIBRATION_FORBIDDEN_PATTERNS,
  buildCalibrationProse,
  buildAnchorsEmptyStateCopy,
  buildPredicatesEmptyStateCopy,
  buildEnrollmentBannerCopy,
  buildInsufficientSparklineCopy,
  buildCollectingDataTrendCopy,
  validateCalibrationProse,
} from '../../../../utils/anchorLibrary/calibrationCopy';
import { buildOverridePayload } from '../../../../hooks/useAnchorRetirement';
import { getMatchingAnchors, DEFAULT_LIVE_STATUSES } from '../../../../utils/anchorLibrary/matcher';
import { selectAnchorsFiltered, EMPTY_FILTERS } from '../../../../utils/anchorLibrary/librarySelectors';
import { PERCEPTION_PRIMITIVE_SEEDS } from '../../../../utils/anchorLibrary/perceptionPrimitiveSeed';
import { EAL_SEED_01_ANCHOR } from '../../../../utils/anchorLibrary/__sim__/scenarios/nitOverfoldRiver4flush';

import { AnchorDetailPanel } from '../AnchorDetailPanel';
import { AnchorCard } from '../AnchorCard';
import { LiveAnchorBadge } from '../../TableView/LiveAnchorBadge';
import { EnrollmentStateBanner } from '../../CalibrationDashboardView/EnrollmentStateBanner';
import { AnchorObservationModal } from '../../HandReplayView/AnchorObservationModal';
import { useAnchorObservationCapture } from '../../../../hooks/useAnchorObservationCapture';

// ───────────────────────────────────────────────────────────────────────────
// Fixtures
// ───────────────────────────────────────────────────────────────────────────

const buildAnchor = (overrides = {}) => ({
  id: 'anchor:contract:1',
  archetypeName: 'Nit scare-fold',
  status: 'active',
  tier: 2,
  polarity: 'overfold',
  lineSequence: [{ street: 'flop' }, { street: 'turn' }, { street: 'river' }],
  perceptionPrimitiveIds: ['PP-01'],
  gtoBaseline: { method: 'MDF', referenceRate: 0.54, referenceEv: 0.04 },
  evidence: {
    pointEstimate: 0.72,
    sampleSize: 52,
    credibleInterval: { lower: 0.58, upper: 0.83, level: 0.95 },
    posteriorConfidence: 0.91,
  },
  calibrationGap: {
    observedRate: 0.58,
    observedCI: { lower: 0.42, upper: 0.74 },
    observedSampleSize: 22,
  },
  validation: { timesApplied: 12, lastFiredAt: '2026-04-26T12:00:00Z' },
  operator: {},
  ...overrides,
});

const VALID_CAPTURE_INPUT = Object.freeze({
  handId: 'hand-contract',
  ownerTags: ['villain-overfold'],
});

// Canonical SEED-01 situation (mirrors anchorMatchDrift.test.js) — satisfies
// the anchor's lineSequence so status is the ONLY variable in the live-filter
// assertions below.
const SEED_01_SITUATION = {
  villainStyle: 'Nit',
  actionHistory: {
    flop: { villainAction: { kind: 'call' }, board: { texture: 'wet' } },
    turn: { heroAction: { kind: 'bet', sizing: 0.75 }, villainAction: { kind: 'call' }, board: { texture: 'wet' } },
    river: { heroAction: { kind: 'bet', sizing: 1.2 }, board: { texture: 'flush-complete', scareKind: '4-flush' } },
  },
};

// Suite-local copy patterns beyond the modules' own FORBIDDEN_PATTERNS.
// Red line #5 — streak / engagement-pressure vocabulary.
const STREAK_PATTERNS = [
  /\bstreak\b/i,
  /\bin a row\b/i,
  /keep it up/i,
  /don'?t break/i,
  /come back (tomorrow|later)/i,
];
// Red line #7 — proclamation / directive vocabulary (editor's-note tone only).
const PROCLAMATION_PATTERNS = [
  /you should/i,
  /you need to/i,
  /you must/i,
  /this anchor (is broken|failed)/i,
];

const expectTextCleanOf = (text, patterns) => {
  for (const pattern of patterns) {
    expect(text, `forbidden pattern ${pattern} found in: "${text.slice(0, 200)}..."`).not.toMatch(pattern);
  }
};

// Every deterministic copy string the EAL surfaces emit, for the tone sweeps.
const allGeneratedCopyStrings = () => {
  const strings = [];
  for (const action of RETIREMENT_ACTIONS) {
    const bundle = buildRetirementCopy(action, buildAnchor());
    strings.push(
      bundle.title, bundle.subText, bundle.confirmLabel, bundle.cancelLabel,
      bundle.destructiveCheckboxLabel, bundle.successToast, bundle.undoLabel,
      bundle.undoneToast, bundle.errorToast,
    );
  }
  // Red line #4b — global library-reset copy bundle (count-aware variants).
  for (const count of [0, 1, 3]) {
    const lr = buildLibraryResetCopy(count);
    strings.push(
      lr.title, lr.subText, lr.confirmLabel, lr.cancelLabel,
      lr.destructiveCheckboxLabel, lr.successToast, lr.undoLabel,
      lr.undoneToast, lr.errorToast,
    );
  }
  const anchor = buildAnchor();
  strings.push(
    // All three calibration-prose branches.
    buildCalibrationProse(anchor, { predictedRate: 0.5, observedRate: 0.6, sampleSize: 4 }),
    buildCalibrationProse(anchor, {
      predictedRate: 0.54, observedRate: 0.58,
      credibleInterval: { lower: 0.42, upper: 0.74 }, sampleSize: 22, predictionInCi: true,
    }),
    buildCalibrationProse(anchor, {
      predictedRate: 0.9, observedRate: 0.58,
      credibleInterval: { lower: 0.42, upper: 0.74 }, sampleSize: 22, predictionInCi: false,
    }),
    buildAnchorsEmptyStateCopy(),
    buildPredicatesEmptyStateCopy(),
    buildEnrollmentBannerCopy().message,
    buildEnrollmentBannerCopy().ctaLabel,
    buildInsufficientSparklineCopy(3),
    buildCollectingDataTrendCopy(),
  );
  return strings.filter((s) => typeof s === 'string' && s.length > 0);
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ───────────────────────────────────────────────────────────────────────────
// Red line #1 — Opt-in enrollment for the calibration loop
// ───────────────────────────────────────────────────────────────────────────

describe('red line #1 — opt-in enrollment for the calibration loop', () => {
  it('enrollment defaults to NOT_ENROLLED (owner must explicitly opt in)', () => {
    expect(initialAnchorLibraryState.enrollment.observation_enrollment_state)
      .toBe(ENROLLMENT_STATES.NOT_ENROLLED);
  });

  it('not-enrolled forces contributesToCalibration=false even when caller asks for true (I-WR-5)', () => {
    const result = captureObservation(
      { ...VALID_CAPTURE_INPUT, contributesToCalibration: true },
      { observation_enrollment_state: ENROLLMENT_STATES.NOT_ENROLLED },
    );
    expect(result.ok).toBe(true);
    expect(result.record.contributesToCalibration).toBe(false);
  });

  it('Tier 0 observations still work without enrollment (capture itself is not gated)', () => {
    const result = captureObservation(
      VALID_CAPTURE_INPUT,
      { observation_enrollment_state: ENROLLMENT_STATES.NOT_ENROLLED },
    );
    expect(result.ok).toBe(true);
    expect(result.record.origin).toBe('owner-captured');
  });

  it('ENROLLMENT_TOGGLED round-trips enrolled ↔ not-enrolled and rejects unknown values', () => {
    const enrolled = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.ENROLLMENT_TOGGLED,
      payload: { observation_enrollment_state: ENROLLMENT_STATES.ENROLLED },
    });
    expect(enrolled.enrollment.observation_enrollment_state).toBe(ENROLLMENT_STATES.ENROLLED);

    const backOut = anchorLibraryReducer(enrolled, {
      type: ANCHOR_LIBRARY_ACTIONS.ENROLLMENT_TOGGLED,
      payload: { observation_enrollment_state: ENROLLMENT_STATES.NOT_ENROLLED },
    });
    expect(backOut.enrollment.observation_enrollment_state).toBe(ENROLLMENT_STATES.NOT_ENROLLED);

    const garbage = anchorLibraryReducer(enrolled, {
      type: ANCHOR_LIBRARY_ACTIONS.ENROLLMENT_TOGGLED,
      payload: { observation_enrollment_state: 'auto-enrolled' },
    });
    expect(garbage.enrollment.observation_enrollment_state).toBe(ENROLLMENT_STATES.ENROLLED);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Red line #2 — Transparency screen per anchor, always one tap away
// ───────────────────────────────────────────────────────────────────────────

describe('red line #2 — transparency screen per anchor', () => {
  it('detail panel renders every disclosure section: observed, predicted, perception, status, last-fired, overrides', () => {
    render(<AnchorDetailPanel anchor={buildAnchor()} />);
    expect(screen.getByTestId('panel-row-observed')).toBeInTheDocument();
    expect(screen.getByTestId('panel-row-predicted')).toBeInTheDocument();
    expect(screen.getByTestId('panel-row-perception')).toBeInTheDocument();
    expect(screen.getByTestId('panel-row-status')).toBeInTheDocument();
    expect(screen.getByTestId('panel-row-last-fired')).toBeInTheDocument();
    expect(screen.getByTestId('panel-overrides')).toBeInTheDocument();
  });

  it('shows observed rate with CI and sample size — the panel does not hide calibration state', () => {
    render(<AnchorDetailPanel anchor={buildAnchor()} />);
    const row = screen.getByTestId('panel-row-observed');
    expect(row.textContent).toContain('58%');
    expect(row.textContent).toContain('42%-74%');
    expect(row.textContent).toContain('n=22');
  });

  it('renders perception primitives by full name, not opaque ID alone (H-N06)', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ perceptionPrimitiveIds: ['PP-01'] })} />);
    const pp01 = PERCEPTION_PRIMITIVE_SEEDS.find((p) => p.id === 'PP-01');
    expect(pp01).toBeTruthy();
    expect(screen.getByTestId('panel-perception-list').textContent).toContain(pp01.name);
  });

  it('owner override actions are present on the same screen (retire/suppress/reset for active)', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ status: 'active' })} />);
    expect(screen.getByTestId('panel-action-retire')).toBeInTheDocument();
    expect(screen.getByTestId('panel-action-suppress')).toBeInTheDocument();
    expect(screen.getByTestId('panel-action-reset')).toBeInTheDocument();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Red line #3 — Durable override: retire / suppress / reset respected
// indefinitely
// ───────────────────────────────────────────────────────────────────────────

describe('red line #3 — durable override', () => {
  const dispatchOverride = (state, anchor) => anchorLibraryReducer(state, {
    type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_OVERRIDDEN,
    payload: { anchor },
  });

  it('retire stamps status + operator provenance with no expiry metadata', () => {
    const prior = buildAnchor();
    const copy = buildRetirementCopy('retire', prior);
    const updated = buildOverridePayload(prior, copy, '2026-06-10T12:00:00Z');
    expect(updated.status).toBe('retired');
    expect(updated.operator.lastOverrideAt).toBe('2026-06-10T12:00:00Z');
    expect(updated.operator.lastOverrideBy).toBe('owner');
    expect(updated.operator.overrideReason).toBe('manual-retire');
    // Durability: nothing in the payload schedules an automatic revert.
    expect(Object.keys(updated.operator)).not.toContain('expiresAt');
    expect(Object.keys(updated.operator)).not.toContain('revertAt');
  });

  it('the override survives unrelated subsequent state changes', () => {
    const prior = buildAnchor();
    let state = { ...initialAnchorLibraryState, anchors: { [prior.id]: prior } };
    const copy = buildRetirementCopy('suppress', prior);
    state = dispatchOverride(state, buildOverridePayload(prior, copy, '2026-06-10T12:00:00Z'));
    expect(state.anchors[prior.id].status).toBe('suppressed');

    // Unrelated actions do not disturb the override.
    const obs = captureObservation(VALID_CAPTURE_INPUT, {
      observation_enrollment_state: ENROLLMENT_STATES.NOT_ENROLLED,
    });
    state = anchorLibraryReducer(state, {
      type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED,
      payload: { observation: obs.record },
    });
    state = anchorLibraryReducer(state, {
      type: ANCHOR_LIBRARY_ACTIONS.ENROLLMENT_TOGGLED,
      payload: { observation_enrollment_state: ENROLLMENT_STATES.ENROLLED },
    });
    expect(state.anchors[prior.id].status).toBe('suppressed');
    expect(state.anchors[prior.id].operator.overrideReason).toBe('manual-suppress');
  });

  it('retired and suppressed anchors never fire on the live default filter', () => {
    const active = { ...EAL_SEED_01_ANCHOR, status: 'active' };
    // Sanity: the canonical situation fires the anchor when active...
    expect(getMatchingAnchors(SEED_01_SITUATION, [active]).map((a) => a.id))
      .toContain(EAL_SEED_01_ANCHOR.id);
    // ...so status is the only reason it stops firing after an override.
    for (const status of ['retired', 'suppressed']) {
      const overridden = { ...EAL_SEED_01_ANCHOR, status };
      expect(
        getMatchingAnchors(SEED_01_SITUATION, [overridden]),
        `${status} anchor must not fire on the live default filter`,
      ).toHaveLength(0);
    }
    expect(DEFAULT_LIVE_STATUSES).toEqual(['active']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Red line #4 — Three-way reversibility
// ───────────────────────────────────────────────────────────────────────────

describe('red line #4 — three-way reversibility', () => {
  it('(a) per-anchor reset is a destructive 2-tap action that stamps calibrationResetAt, status unchanged', () => {
    const prior = buildAnchor({ status: 'active' });
    const copy = buildRetirementCopy('reset', prior);
    expect(copy.destructive).toBe(true);
    expect(typeof copy.destructiveCheckboxLabel).toBe('string');
    const updated = buildOverridePayload(prior, copy, '2026-06-10T12:00:00Z');
    expect(updated.status).toBe('active');
    expect(updated.operator.calibrationResetAt).toBe('2026-06-10T12:00:00Z');
  });

  // Red line #4b — global library reset (WS-221). One owner action resets
  // calibration across every anchor; copy is a destructive 2-tap confirm; the
  // operation is fully undoable via snapshot restore; observations preserved.
  describe('(b) global library reset', () => {
    const buildLibraryState = () => {
      const a1 = buildAnchor({ id: 'anchor:lib:1', status: 'active' });
      const a2 = buildAnchor({ id: 'anchor:lib:2', status: 'retired' });
      const obs = captureObservation(VALID_CAPTURE_INPUT, {
        observation_enrollment_state: ENROLLMENT_STATES.NOT_ENROLLED,
      }).record;
      return {
        ...initialAnchorLibraryState,
        anchors: { [a1.id]: a1, [a2.id]: a2 },
        observations: { [obs.id]: obs },
      };
    };

    it('the library-reset copy is a destructive 2-tap action with AP-06-clean copy', () => {
      const copy = buildLibraryResetCopy(3);
      expect(copy.destructive).toBe(true);
      expect(typeof copy.destructiveCheckboxLabel).toBe('string');
      expect(copy.destructiveCheckboxLabel.length).toBeGreaterThan(0);
      expect(copy.overrideReason).toBe('manual-library-reset');
      const { valid, violations } = validateRetirementCopyBundle(copy);
      expect(valid, `library-reset copy violations: ${JSON.stringify(violations)}`).toBe(true);
    });

    it('stamps calibrationResetAt on EVERY anchor with status unchanged + observations preserved', () => {
      const prior = buildLibraryState();
      const ts = '2026-06-13T12:00:00Z';
      const after = anchorLibraryReducer(prior, {
        type: ANCHOR_LIBRARY_ACTIONS.LIBRARY_CALIBRATION_RESET,
        payload: { timestamp: ts },
      });
      for (const id of Object.keys(prior.anchors)) {
        expect(after.anchors[id].operator.calibrationResetAt).toBe(ts);
        expect(after.anchors[id].operator.lastOverrideBy).toBe('owner');
        expect(after.anchors[id].operator.overrideReason).toBe('manual-library-reset');
        // Status is never changed by a calibration reset.
        expect(after.anchors[id].status).toBe(prior.anchors[id].status);
      }
      // Evidence durability (red line #3): observation records are preserved.
      expect(after.observations).toEqual(prior.observations);
    });

    it('is fully reversible — the undo path restores the exact prior anchors snapshot', () => {
      const prior = buildLibraryState();
      const priorSnapshot = { ...prior.anchors };
      const reset = anchorLibraryReducer(prior, {
        type: ANCHOR_LIBRARY_ACTIONS.LIBRARY_CALIBRATION_RESET,
        payload: { timestamp: '2026-06-13T12:00:00Z' },
      });
      // Sanity: reset actually changed the anchors.
      expect(reset.anchors).not.toEqual(priorSnapshot);
      const undone = anchorLibraryReducer(reset, {
        type: ANCHOR_LIBRARY_ACTIONS.LIBRARY_CALIBRATION_RESET,
        payload: { restoreAnchors: priorSnapshot },
      });
      expect(undone.anchors).toEqual(priorSnapshot);
    });

    it('an empty library is a no-op (button is disabled, but the reducer is safe)', () => {
      const after = anchorLibraryReducer(initialAnchorLibraryState, {
        type: ANCHOR_LIBRARY_ACTIONS.LIBRARY_CALIBRATION_RESET,
        payload: { timestamp: '2026-06-13T12:00:00Z' },
      });
      expect(after.anchors).toEqual({});
    });
  });

  it('(c) per-observation incognito mode exists as the third reversibility arm (full contract in red line #9)', () => {
    const result = captureObservation(
      { ...VALID_CAPTURE_INPUT, contributesToCalibration: false },
      { observation_enrollment_state: ENROLLMENT_STATES.ENROLLED },
    );
    expect(result.ok).toBe(true);
    expect(result.record.contributesToCalibration).toBe(false);
  });

  it('retirement itself is reversible — re-enable is a first-class owner action targeting status=active', () => {
    expect(RETIREMENT_ACTIONS).toContain('re-enable');
    const copy = buildRetirementCopy('re-enable', buildAnchor({ status: 'retired' }));
    expect(copy.targetStatus).toBe('active');
    expect(copy.overrideReason).toBe('owner-un-retire');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Red line #5 — No streaks / shame / engagement-pressure notifications
// ───────────────────────────────────────────────────────────────────────────

describe('red line #5 — no streaks / shame / engagement-pressure', () => {
  it('every retirement copy bundle passes the AP-06 forbidden-pattern validator', () => {
    for (const action of RETIREMENT_ACTIONS) {
      const bundle = buildRetirementCopy(action, buildAnchor());
      const { valid, violations } = validateRetirementCopyBundle(bundle);
      expect(valid, `bundle for "${action}" has violations: ${JSON.stringify(violations)}`).toBe(true);
    }
  });

  it('every generated copy string is free of streak / engagement-pressure vocabulary', () => {
    for (const text of allGeneratedCopyStrings()) {
      expectTextCleanOf(text, STREAK_PATTERNS);
      expectTextCleanOf(text, RETIREMENT_FORBIDDEN_PATTERNS);
    }
  });

  it('the transparency panel DOM is free of owner-grading and streak copy', () => {
    const { container } = render(<AnchorDetailPanel anchor={buildAnchor()} />);
    const text = container.textContent;
    expectTextCleanOf(text, RETIREMENT_FORBIDDEN_PATTERNS);
    expectTextCleanOf(text, STREAK_PATTERNS);
  });

  it('the enrollment banner is informational — no nag, no dismiss-pressure copy', () => {
    const { container } = render(<EnrollmentStateBanner />);
    const text = container.textContent;
    expectTextCleanOf(text, CALIBRATION_FORBIDDEN_PATTERNS);
    expectTextCleanOf(text, STREAK_PATTERNS);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Red line #6 — Flat anchor index always accessible
// ───────────────────────────────────────────────────────────────────────────

describe('red line #6 — flat anchor index always accessible', () => {
  const ALL_STATUSES = ['active', 'expiring', 'retired', 'suppressed', 'candidate'];

  it('the empty filter set excludes nothing — all statuses pass through the library selector', () => {
    const anchors = ALL_STATUSES.map((status, i) => buildAnchor({
      id: `anchor:flat:${i}`, status, archetypeName: `Anchor ${status}`,
    }));
    const visible = selectAnchorsFiltered(anchors, EMPTY_FILTERS);
    expect(visible.map((a) => a.status).sort()).toEqual([...ALL_STATUSES].sort());
  });

  it.each(ALL_STATUSES)('an anchor with status "%s" renders a card tagged with its status', (status) => {
    render(<AnchorCard anchor={buildAnchor({ id: `anchor:tag:${status}`, status })} />);
    expect(screen.getByTestId('anchor-card')).toHaveAttribute('data-status', status);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Red line #7 — Editor's-note tone, never proclamation
// ───────────────────────────────────────────────────────────────────────────

describe("red line #7 — editor's-note tone, never proclamation", () => {
  it('all generated copy avoids directive / proclamation phrasing', () => {
    for (const text of allGeneratedCopyStrings()) {
      expectTextCleanOf(text, PROCLAMATION_PATTERNS);
    }
  });

  it('calibration prose evaluates the MODEL, never the owner, in every branch', () => {
    const anchor = buildAnchor();
    const branches = [
      buildCalibrationProse(anchor, { predictedRate: 0.5, observedRate: 0.6, sampleSize: 4 }),
      buildCalibrationProse(anchor, {
        predictedRate: 0.54, observedRate: 0.58,
        credibleInterval: { lower: 0.42, upper: 0.74 }, sampleSize: 22, predictionInCi: true,
      }),
      buildCalibrationProse(anchor, {
        predictedRate: 0.9, observedRate: 0.58,
        credibleInterval: { lower: 0.42, upper: 0.74 }, sampleSize: 22, predictionInCi: false,
      }),
    ];
    for (const prose of branches) {
      expect(prose.length).toBeGreaterThan(0);
      const { valid, violations } = validateCalibrationProse(prose);
      expect(valid, `calibration prose violations: ${JSON.stringify(violations)}`).toBe(true);
      // Verdicts are about the model, framed factually.
      expect(prose).toMatch(/the model/i);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Red line #8 — No cross-surface contamination (live = badge + dial only)
// ───────────────────────────────────────────────────────────────────────────

describe('red line #8 — no cross-surface contamination', () => {
  it('live badge renders only the archetype name, status glyph, and dial — even when full calibration data is present', () => {
    const { container } = render(<LiveAnchorBadge anchor={buildAnchor()} />);
    const text = container.textContent;
    expect(text).toContain('Nit scare-fold');
    expect(text).toContain('●');
    expect(screen.getByTestId('live-anchor-badge-dial')).toBeInTheDocument();
  });

  it('live badge leaks no calibration state (AP-07 hard floor)', () => {
    const anchor = buildAnchor({
      perceptionPrimitiveIds: ['PP-01'],
      consequence: { expectedDividend: { mean: 0.66, sd: 0.14, sharpe: 4.7 } },
    });
    const { container } = render(<LiveAnchorBadge anchor={anchor} />);
    const text = container.textContent;
    expectTextCleanOf(text, [
      /n=/, /observed/i, /predicted/i, /\bCI\b/, /±/, /%/,
      /retired/i, /suppressed/i, /expiring/i,
      /PP-/, /posterior/i, /sharpe/i, /dividend/i, /MDF/,
    ]);
  });

  it('calibration depth stays on study surfaces — the same anchor renders the full panel there', () => {
    // The contamination rule is one-directional: study mode shows everything,
    // live mode shows badge + dial. Render both from identical data.
    const anchor = buildAnchor();
    const study = render(<AnchorDetailPanel anchor={anchor} />);
    expect(study.container.textContent).toMatch(/observed/i);
    study.unmount();
    const live = render(<LiveAnchorBadge anchor={anchor} />);
    expect(live.container.textContent).not.toMatch(/observed/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Red line #9 — Incognito observation mode non-negotiable
// ───────────────────────────────────────────────────────────────────────────

describe('red line #9 — incognito observation mode', () => {
  const makeCaptureHook = ({ isEnrolled = true } = {}) => ({
    draft: null,
    hasDraft: false,
    isOpen: true,
    openCapture: vi.fn(),
    closeCapture: vi.fn(),
    isEnrolled,
    updateDraft: vi.fn(),
    discard: vi.fn(),
    save: vi.fn(() => ({
      ok: true,
      record: { id: 'obs:hand-rl9:0', handId: 'hand-rl9', ownerTags: ['villain-overfold'], origin: 'owner-captured' },
    })),
  });

  it('the incognito toggle is always primary-visible in the capture modal', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook({ isEnrolled: true }));
    render(<AnchorObservationModal handId="hand-rl9" onClose={vi.fn()} />);
    const toggle = screen.getByTestId('anchor-incognito-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeDisabled();
  });

  it('when not enrolled the toggle is forced on and locked (every observation incognito)', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook({ isEnrolled: false }));
    render(<AnchorObservationModal handId="hand-rl9" onClose={vi.fn()} />);
    const toggle = screen.getByTestId('anchor-incognito-toggle');
    expect(toggle).toBeChecked();
    expect(toggle).toBeDisabled();
  });

  it('incognito always wins at the writer boundary — enrolled + incognito → contributesToCalibration=false (I-WR-6)', () => {
    const result = captureObservation(
      { ...VALID_CAPTURE_INPUT, contributesToCalibration: false },
      { observation_enrollment_state: ENROLLMENT_STATES.ENROLLED },
    );
    expect(result.ok).toBe(true);
    expect(result.record.contributesToCalibration).toBe(false);
  });

  it('enrolled without incognito defaults to contributing (Q2-A opt-out default) — proving the flag is the lever', () => {
    const result = captureObservation(
      VALID_CAPTURE_INPUT,
      { observation_enrollment_state: ENROLLMENT_STATES.ENROLLED },
    );
    expect(result.ok).toBe(true);
    expect(result.record.contributesToCalibration).toBe(true);
  });
});
