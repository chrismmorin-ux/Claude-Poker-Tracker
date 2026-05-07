/**
 * DistinguishingMarkBadge.jsx — single-mark renderer (SPR-041 Phase 4).
 *
 * Renders ONE mark from `player.distinguishingMarks` as an SVG `<g>` group
 * positioned at its location anchor on the avatar's 100×100 viewBox.
 *
 * Designed to be composed inside the AvatarRenderer SVG (NOT a standalone
 * SVG element) so the mark sits in the same coordinate system as the rest
 * of the avatar layers.
 *
 * Usage (inside AvatarRenderer's <svg>):
 *   <DistinguishingMarkBadge mark={{ type: 'tattoo', location: 'arm' }} />
 *
 * Unknown types render nothing (and console.warn for schema-drift visibility).
 */

import React from 'react';
import {
  getDistinguishingMarkSpec,
  resolveMarkAnchor,
} from '../../assets/distinguishingMarks';

const renderPath = (p, i) => (
  <path
    key={i}
    d={p.d}
    fill={p.fill ?? 'none'}
    stroke={p.stroke ?? undefined}
    strokeWidth={p.strokeWidth ?? undefined}
    strokeLinecap={p.strokeLinecap ?? undefined}
    strokeLinejoin={p.strokeLinejoin ?? undefined}
  />
);

const DistinguishingMarkBadge = ({ mark }) => {
  if (!mark || !mark.type) return null;
  const spec = getDistinguishingMarkSpec(mark.type);
  if (!spec) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`[DistinguishingMarkBadge] unknown mark type: "${mark.type}"`);
    }
    return null;
  }
  const { cx, cy } = resolveMarkAnchor(mark);
  return (
    <g
      transform={`translate(${cx} ${cy})`}
      data-mark-type={spec.type}
      data-mark-location={mark.location || spec.defaultLocation}
    >
      {spec.backgroundCircle ? (
        <circle
          r={spec.backgroundCircle.r}
          fill={spec.backgroundCircle.fill}
          stroke="rgba(0,0,0,0.15)"
          strokeWidth={0.4}
        />
      ) : null}
      {spec.paths.map(renderPath)}
    </g>
  );
};

export default DistinguishingMarkBadge;
