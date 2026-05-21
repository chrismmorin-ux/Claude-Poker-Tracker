/**
 * ShapeSkillMapPanel.jsx — Shape Language transparency surface.
 *
 * SLS Stream D — SPR-081 / WS-040. Read-only this sprint per owner-ratified
 * scope (B). 10 descriptor rows in catalog order; each row renders posterior
 * + declaredLevel + lastValidatedAt in SEPARATE DOM regions per I-SM-1.
 *
 * Per `docs/design/surfaces/shape-skill-map.md`:
 *   - Single scrollable page (founder-ratified IA in SLS Gate 4).
 *   - 10 descriptor rows in catalog order.
 *   - "Composition is always inspectable" — per
 *     `feedback_scf_learning_state_not_tier_rank.md`.
 *
 * Mounted but UNLINKED from any nav entry point this sprint — Settings
 * deep-link is part of the fast-follow WS scope. Component is exported
 * for future routing + Playwright-driven manual verification at the
 * developer-only path.
 *
 * Red-line bindings enforced here:
 *   - I-SM-1: declared + posterior never fused (separate DOM regions, no
 *     `masteryScore` / `fusedMastery` field on the row).
 *   - I-SM-9: no engagement-pressure counter fields render in the DOM
 *     (FORBIDDEN_MASTERY_FIELDS lint test in __tests__/ asserts).
 *   - AP-SCF-01 / red line #5: no engagement-pressure copy.
 *   - CD-2 (test surface opt-in): the panel is read-only; no system-imposed
 *     grading. Recovery affordances are owner-volunteered (disabled this
 *     sprint, but the contract holds at the layout level).
 */

import React from 'react';
import { useShapeMastery } from '../../../../contexts';
import { SHAPE_DESCRIPTOR_CATALOG } from '../../../../constants/shapeMasteryConstants';
import { GOLD } from '../../../../constants/designTokens';
import { DescriptorRow } from './DescriptorRow';

const formatEnrollment = (enrolled, enrolledAt) => {
  if (!enrolled) return 'Not enrolled — Shape Language adaptive layer is off.';
  if (typeof enrolledAt !== 'number') return 'Enrolled';
  const date = new Date(enrolledAt);
  return `Enrolled: ${date.toISOString().slice(0, 10)}`;
};

export const ShapeSkillMapPanel = () => {
  const shapeMastery = useShapeMastery();
  const { enrolled, enrolledAt, descriptors, selectDescriptor } = shapeMastery;

  return (
    <div
      className="bg-gray-900 rounded-lg p-5"
      data-testid="shape-skill-map-panel"
    >
      <h3 className="text-lg font-bold mb-2" style={{ color: GOLD.base }}>
        Shape Skill Map
      </h3>
      <p
        className="text-xs text-gray-400 mb-4"
        data-testid="shape-skill-map-enrollment-status"
      >
        {formatEnrollment(enrolled, enrolledAt)}
      </p>
      <p className="text-sm text-gray-300 mb-4">
        Composition is always inspectable. Each descriptor shows the data
        signal (drill-derived posterior) and the declared signal (self-
        asserted) as separate axes — never combined into a single score.
      </p>

      <div data-testid="shape-skill-map-rows">
        {SHAPE_DESCRIPTOR_CATALOG.map((descriptor) => {
          // Prefer the selector if available (consistent with provider's API);
          // fall back to dict lookup if the provider didn't wire the selector.
          const mastery = selectDescriptor
            ? selectDescriptor(descriptor.id)
            : descriptors?.[descriptor.id] || null;
          return (
            <DescriptorRow
              key={descriptor.id}
              descriptor={descriptor}
              mastery={mastery}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ShapeSkillMapPanel;
