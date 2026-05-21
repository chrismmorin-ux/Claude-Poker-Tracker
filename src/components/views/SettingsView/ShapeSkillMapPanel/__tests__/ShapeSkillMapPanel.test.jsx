// @vitest-environment jsdom
/**
 * ShapeSkillMapPanel.test.jsx — surface invariant tests.
 *
 * SLS Stream D — SPR-081 / WS-040.
 *
 * Tests:
 *   - 10 descriptor rows render in catalog order.
 *   - I-SM-1: declared + posterior render in SEPARATE DOM regions.
 *   - I-SM-1: no fused-score copy anywhere (`masteryScore`, `fusedMastery`,
 *     `confidenceLevel`).
 *   - I-SM-9: no engagement-pressure copy (`currentStreak`, `longestStreak`,
 *     `daysActive`, `consecutiveCorrectCount`).
 *   - Recovery affordances render as disabled buttons (read-only sprint).
 *   - Enrollment status renders per state.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ShapeSkillMapPanel } from '../ShapeSkillMapPanel';
import { ShapeMasteryProvider } from '../../../../../contexts/ShapeMasteryContext';
import {
  initialShapeMasteryState,
  SHAPE_DESCRIPTOR_CATALOG,
  buildDefaultDescriptorsDict,
  USER_MUTE_STATES,
  FORBIDDEN_MASTERY_FIELDS,
  FORBIDDEN_FUSED_FIELDS,
} from '../../../../../constants/shapeMasteryConstants';

const renderWithProvider = (state, dispatch = () => {}) =>
  render(
    <ShapeMasteryProvider
      shapeMasteryState={state}
      dispatchShapeMastery={dispatch}
    >
      <ShapeSkillMapPanel />
    </ShapeMasteryProvider>,
  );

const seededState = (overrides = {}) => ({
  ...initialShapeMasteryState,
  descriptors: buildDefaultDescriptorsDict(),
  ...overrides,
});

describe('ShapeSkillMapPanel — catalog rendering', () => {
  it('renders all 10 descriptor rows in catalog order', () => {
    renderWithProvider(seededState());
    const rowsContainer = screen.getByTestId('shape-skill-map-rows');
    const rows = rowsContainer.querySelectorAll('[data-testid^="descriptor-row-"]');
    expect(rows.length).toBe(SHAPE_DESCRIPTOR_CATALOG.length);
    expect(rows.length).toBe(10);
    SHAPE_DESCRIPTOR_CATALOG.forEach((descriptor, idx) => {
      expect(rows[idx].getAttribute('data-descriptor-id')).toBe(descriptor.id);
    });
  });

  it('renders each descriptor display name', () => {
    renderWithProvider(seededState());
    for (const descriptor of SHAPE_DESCRIPTOR_CATALOG) {
      expect(screen.getByText(descriptor.displayName)).toBeTruthy();
    }
  });
});

describe('I-SM-1 — separation of signals (rendered DOM)', () => {
  it('each descriptor row has a posterior region AND a declared region as separate elements', () => {
    renderWithProvider(seededState());
    for (const descriptor of SHAPE_DESCRIPTOR_CATALOG) {
      const posteriorRegion = screen.getByTestId(`descriptor-posterior-${descriptor.id}`);
      const declaredRegion = screen.getByTestId(`descriptor-declared-${descriptor.id}`);
      expect(posteriorRegion).toBeTruthy();
      expect(declaredRegion).toBeTruthy();
      // Regions are not nested in each other (separate axes).
      expect(posteriorRegion.contains(declaredRegion)).toBe(false);
      expect(declaredRegion.contains(posteriorRegion)).toBe(false);
      expect(posteriorRegion.getAttribute('data-signal')).toBe('posterior');
      expect(declaredRegion.getAttribute('data-signal')).toBe('declared');
    }
  });

  it('no DOM element on the panel uses a forbidden-fused-field name', () => {
    const { container } = renderWithProvider(seededState());
    const innerText = container.textContent || '';
    for (const forbidden of FORBIDDEN_FUSED_FIELDS) {
      // Case-insensitive grep against rendered text.
      const re = new RegExp(`\\b${forbidden}\\b`, 'i');
      expect(innerText).not.toMatch(re);
    }
  });
});

describe('I-SM-9 — no engagement-pressure copy', () => {
  it('no DOM element renders streak / daysActive / consecutiveCorrectCount copy', () => {
    const { container } = renderWithProvider(seededState());
    const innerText = container.textContent || '';
    for (const forbidden of FORBIDDEN_MASTERY_FIELDS) {
      const re = new RegExp(`\\b${forbidden}\\b`, 'i');
      expect(innerText).not.toMatch(re);
    }
    // Spot-check natural-language copy variants that would smuggle in
    // engagement-pressure framing.
    expect(innerText).not.toMatch(/current streak/i);
    expect(innerText).not.toMatch(/longest streak/i);
    expect(innerText).not.toMatch(/days active/i);
  });
});

describe('recovery affordances — disabled read-only sprint scope', () => {
  it('Recalibrate + Mark-as-already-known render as disabled buttons with "Coming soon" tooltip', () => {
    renderWithProvider(seededState());
    for (const descriptor of SHAPE_DESCRIPTOR_CATALOG) {
      const recalibrate = screen.getByTestId(`descriptor-recalibrate-${descriptor.id}`);
      const markKnown = screen.getByTestId(`descriptor-mark-known-${descriptor.id}`);
      expect(recalibrate.hasAttribute('disabled')).toBe(true);
      expect(recalibrate.getAttribute('title')).toBe('Coming soon');
      expect(markKnown.hasAttribute('disabled')).toBe(true);
      expect(markKnown.getAttribute('title')).toBe('Coming soon');
    }
  });

  it('Unmute affordance renders only when descriptor is muted', () => {
    const muted = {
      ...buildDefaultDescriptorsDict(),
      silhouette: {
        ...buildDefaultDescriptorsDict().silhouette,
        userMuteState: USER_MUTE_STATES.ALREADY_KNOWN,
      },
    };
    renderWithProvider(seededState({ descriptors: muted }));
    expect(screen.getByTestId('descriptor-unmute-silhouette')).toBeTruthy();
    // Non-muted descriptors do not render the Unmute affordance.
    expect(screen.queryByTestId('descriptor-unmute-saddle')).toBeNull();
  });
});

describe('enrollment status', () => {
  it('shows "Not enrolled" when enrolled=false', () => {
    renderWithProvider(seededState({ enrolled: false }));
    const status = screen.getByTestId('shape-skill-map-enrollment-status');
    expect(status.textContent).toMatch(/not enrolled/i);
  });

  it('shows enrollment date when enrolled=true', () => {
    renderWithProvider(seededState({ enrolled: true, enrolledAt: 1715600000000 }));
    const status = screen.getByTestId('shape-skill-map-enrollment-status');
    expect(status.textContent).toMatch(/enrolled: \d{4}-\d{2}-\d{2}/i);
  });
});

describe('panel structure', () => {
  it('top-level panel has a stable test id', () => {
    renderWithProvider(seededState());
    expect(screen.getByTestId('shape-skill-map-panel')).toBeTruthy();
  });

  it('header reads "Shape Skill Map"', () => {
    renderWithProvider(seededState());
    expect(screen.getByText('Shape Skill Map')).toBeTruthy();
  });
});
