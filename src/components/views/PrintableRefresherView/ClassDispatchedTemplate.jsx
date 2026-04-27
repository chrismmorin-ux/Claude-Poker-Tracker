/**
 * ClassDispatchedTemplate.jsx — shared 4-way card-class dispatcher.
 *
 * Routes a manifest to its class-specific template component:
 *   - 'math'       → MathCardTemplate
 *   - 'preflop'    → PreflopCardTemplate
 *   - 'equity'     → EquityCardTemplate
 *   - 'exceptions' → ExceptionsCardTemplate
 *   - default      → role="status" placeholder (defense-in-depth for corrupted
 *                    manifests with typo'd class names; renders informatively
 *                    rather than crashing).
 *
 * Lifted from `CardDetail.jsx` in S21 to allow `PrintPreview.jsx` to compose
 * cards without duplicating the switch logic. Two consumers is the minimum
 * threshold for extraction; this preserves single-source-of-truth for the
 * 4-way dispatch.
 *
 * PRF Phase 5 — Session 21 (PRF-G5-UI).
 */

import React from 'react';
import { MathCardTemplate } from './MathCardTemplate';
import { PreflopCardTemplate } from './PreflopCardTemplate';
import { EquityCardTemplate } from './EquityCardTemplate';
import { ExceptionsCardTemplate } from './ExceptionsCardTemplate';

/**
 * @param {object} props
 * @param {object} props.manifest - Card manifest (must include `class`).
 * @param {object} [props.runtime] - { engineVersion, appVersion } for lineage.
 * @param {boolean} [props.compact=false] - Compact preview mode (catalog rows).
 */
export const ClassDispatchedTemplate = ({ manifest, runtime, compact = false }) => {
  if (!manifest) return null;
  switch (manifest.class) {
    case 'math':
      return <MathCardTemplate manifest={manifest} runtime={runtime} compact={compact} />;
    case 'preflop':
      return <PreflopCardTemplate manifest={manifest} runtime={runtime} compact={compact} />;
    case 'equity':
      return <EquityCardTemplate manifest={manifest} runtime={runtime} compact={compact} />;
    case 'exceptions':
      return <ExceptionsCardTemplate manifest={manifest} runtime={runtime} compact={compact} />;
    default:
      return (
        <div
          role="status"
          style={{
            padding: '2rem',
            textAlign: 'center',
            background: '#111827',
            border: '1px dashed #374151',
            borderRadius: '0.5rem',
            color: '#9ca3af',
            fontSize: '0.875rem',
          }}
        >
          Card template for class &quot;{manifest.class}&quot; will land in a future session. The card
          data is loaded; only the rendering layer is missing.
        </div>
      );
  }
};

export default ClassDispatchedTemplate;
