/**
 * @file CurriculumTab — descriptor header + tier-grouped concept tree
 * (Phase-5a slice).
 *
 * Renders:
 *   - Descriptor header (sentence summary; "next teachable" badge with
 *     expand-to-inspect-composition affordance).
 *   - Tier headers (numeric "Tier N", per descriptor-not-rank doctrine).
 *   - Per tier: root-level concepts (umbrellas + general-skills) sorted
 *     stably; umbrellas reveal sub-concept rows when expanded.
 *
 * Source-util-policy: whitelisted SCF consumer (SelfCoachView).
 *
 * SPR-042 / WS-159 (2026-05-06).
 */

import React, { useMemo, useState } from 'react';
import { useUI } from '../../../contexts';
import { GUEST_USER_ID } from '../../../constants/authConstants';
import { useSelfCoachMastery } from '../../../hooks/useSelfCoachMastery';
import { CONCEPT_REGISTRY } from '../../../utils/skillAssessment/tierConceptMap';
import { ConceptTreeNode } from './ConceptTreeNode';
import { CompositionInspector } from './CompositionInspector';

/**
 * Group concepts by tier; within a tier, sort umbrellas + general-skills
 * stably. Sub-concepts (rule-anchored-specific) are NEVER root-level —
 * they render only as children when their umbrella is expanded.
 */
const groupRootConceptsByTier = () => {
  const byTier = {};
  for (const [id, meta] of Object.entries(CONCEPT_REGISTRY)) {
    if (meta.kind === 'rule-anchored-specific') continue; // children render via umbrella
    if (!byTier[meta.tier]) byTier[meta.tier] = [];
    byTier[meta.tier].push(id);
  }
  for (const tier of Object.keys(byTier)) {
    byTier[tier].sort((a, b) => a.localeCompare(b));
  }
  return byTier;
};

const ROOT_BY_TIER = groupRootConceptsByTier();
const TIER_KEYS = Object.keys(ROOT_BY_TIER).map(Number).sort((a, b) => a - b);

const conceptDisplayName = (conceptId) => conceptId.replace(/-/g, ' ');

export const CurriculumTab = ({ userIdOverride }) => {
  const userId = userIdOverride || GUEST_USER_ID;
  const { openLessonDetail } = useUI();
  const {
    loading,
    masteriesByConceptId,
    compositesByConceptId,
    descriptor,
    nextTeachable,
    weights,
    toggles,
  } = useSelfCoachMastery(userId);

  const [headerInspectorOpen, setHeaderInspectorOpen] = useState(false);

  const handleDrillThis = (conceptId) => {
    openLessonDetail(conceptId);
  };

  // Composite + mastery for the recommendation badge (so the header inspector
  // can render the same CD-5 fields as a per-row inspector).
  const recommendationMastery = useMemo(
    () => (nextTeachable ? masteriesByConceptId[nextTeachable.conceptId] : null),
    [nextTeachable, masteriesByConceptId],
  );

  if (loading) {
    return (
      <div data-testid="self-coach-curriculum-tab" style={{ color: '#9ca3af' }}>
        Loading curriculum…
      </div>
    );
  }

  return (
    <div data-testid="self-coach-curriculum-tab">
      {/* Descriptor header */}
      <div
        data-testid="curriculum-descriptor"
        style={{
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
          Learning state
        </div>
        <div data-testid="curriculum-descriptor-summary" style={{ fontSize: '1rem', color: '#f3f4f6', marginBottom: '0.5rem' }}>
          {descriptor.summary}
        </div>
        {nextTeachable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Next teachable:</span>
            <span data-testid="curriculum-next-teachable" style={{ fontSize: '0.85rem', color: '#e5e7eb', fontWeight: 500 }}>
              {conceptDisplayName(nextTeachable.conceptId)}
            </span>
            <button
              type="button"
              onClick={() => setHeaderInspectorOpen((v) => !v)}
              aria-expanded={headerInspectorOpen}
              data-testid="curriculum-next-teachable-why"
              style={{
                minHeight: 28,
                padding: '0.2rem 0.6rem',
                background: '#1f2937',
                color: '#f3f4f6',
                border: '1px solid #374151',
                borderRadius: 999,
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              Why {headerInspectorOpen ? '▲' : '▾'}
            </button>
          </div>
        )}
        {headerInspectorOpen && nextTeachable && (
          <CompositionInspector
            concept={{ conceptId: nextTeachable.conceptId, meta: CONCEPT_REGISTRY[nextTeachable.conceptId] }}
            mastery={recommendationMastery}
            composite={nextTeachable}
            weights={weights}
            toggles={toggles}
          />
        )}
      </div>

      {/* Tier-grouped concept tree */}
      {TIER_KEYS.map((tier) => (
        <section key={tier} data-testid={`curriculum-tier-${tier}`} style={{ marginBottom: '1rem' }}>
          <h2
            style={{
              fontSize: '0.75rem',
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: '0 0 0.4rem',
            }}
          >
            Tier {tier}
          </h2>
          {ROOT_BY_TIER[tier].map((conceptId) => (
            <ConceptTreeNode
              key={conceptId}
              conceptId={conceptId}
              masteriesByConceptId={masteriesByConceptId}
              compositesByConceptId={compositesByConceptId}
              weights={weights}
              toggles={toggles}
              onDrillThis={handleDrillThis}
            />
          ))}
        </section>
      ))}
    </div>
  );
};
