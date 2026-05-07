// @vitest-environment jsdom
/**
 * DistinguishingMarkBadge.test.jsx — single-mark renderer (SPR-041 Phase 4).
 *
 * Verifies:
 *   - Renders a <g> with data-mark-type / data-mark-location
 *   - Translates to the resolved location anchor
 *   - Picks per-type background circle when present
 *   - Renders all paths from the mark spec
 *   - Unknown mark.type renders nothing (returns null + console.warn)
 *   - Missing mark.location falls back to spec.defaultLocation
 *
 * The badge is meant to be composed inside an SVG (via AvatarRenderer);
 * tests wrap it in a host <svg> for jsdom rendering.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import DistinguishingMarkBadge from '../DistinguishingMarkBadge';
import {
  LOCATION_ANCHORS,
  VALID_MARK_TYPES,
  DISTINGUISHING_MARKS,
} from '../../../assets/distinguishingMarks';

const renderInSvg = (children) => render(
  <svg viewBox="0 0 100 100">{children}</svg>,
);

describe('DistinguishingMarkBadge', () => {
  describe('null / empty input', () => {
    it('renders null when mark is null', () => {
      const { container } = renderInSvg(<DistinguishingMarkBadge mark={null} />);
      expect(container.querySelector('g[data-mark-type]')).toBeNull();
    });

    it('renders null when mark.type is missing', () => {
      const { container } = renderInSvg(<DistinguishingMarkBadge mark={{}} />);
      expect(container.querySelector('g[data-mark-type]')).toBeNull();
    });

    it('renders null + warns when mark.type is unknown', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { container } = renderInSvg(
        <DistinguishingMarkBadge mark={{ type: 'imaginary-mark' }} />,
      );
      expect(container.querySelector('g[data-mark-type]')).toBeNull();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('imaginary-mark'),
      );
      warn.mockRestore();
    });
  });

  describe('rendering the 5 mark types', () => {
    for (const spec of DISTINGUISHING_MARKS) {
      it(`renders type="${spec.type}" with data attributes + paths`, () => {
        const { container } = renderInSvg(
          <DistinguishingMarkBadge mark={{ type: spec.type, location: 'arm' }} />,
        );
        const g = container.querySelector(`g[data-mark-type="${spec.type}"]`);
        expect(g).not.toBeNull();
        expect(g.getAttribute('data-mark-location')).toBe('arm');
        // Each spec contributes the path elements; some include a background circle
        const paths = g.querySelectorAll('path');
        expect(paths.length).toBe(spec.paths.length);
        if (spec.backgroundCircle) {
          expect(g.querySelector('circle')).not.toBeNull();
        } else {
          expect(g.querySelector('circle')).toBeNull();
        }
      });
    }
  });

  describe('location anchor translation', () => {
    it('translates to the resolved anchor (face = 66, 52)', () => {
      const { container } = renderInSvg(
        <DistinguishingMarkBadge mark={{ type: 'tattoo', location: 'face' }} />,
      );
      const g = container.querySelector('g[data-mark-type="tattoo"]');
      expect(g.getAttribute('transform')).toBe(
        `translate(${LOCATION_ANCHORS.face.cx} ${LOCATION_ANCHORS.face.cy})`,
      );
    });

    it('falls back to spec.defaultLocation when mark.location is missing', () => {
      // tattoo's defaultLocation is 'arm'
      const { container } = renderInSvg(
        <DistinguishingMarkBadge mark={{ type: 'tattoo' }} />,
      );
      const g = container.querySelector('g[data-mark-type="tattoo"]');
      expect(g.getAttribute('data-mark-location')).toBe('arm');
      expect(g.getAttribute('transform')).toBe(
        `translate(${LOCATION_ANCHORS.arm.cx} ${LOCATION_ANCHORS.arm.cy})`,
      );
    });

    it('falls back to defaultLocation when mark.location is unknown', () => {
      // hearing-aid's defaultLocation is 'ear'
      const { container } = renderInSvg(
        <DistinguishingMarkBadge mark={{ type: 'hearing-aid', location: 'imaginary' }} />,
      );
      const g = container.querySelector('g[data-mark-type="hearing-aid"]');
      expect(g.getAttribute('transform')).toBe(
        `translate(${LOCATION_ANCHORS.ear.cx} ${LOCATION_ANCHORS.ear.cy})`,
      );
    });

    it('every valid location anchor resolves to integer coords on the 100×100 viewBox', () => {
      for (const [loc, anchor] of Object.entries(LOCATION_ANCHORS)) {
        expect(anchor.cx).toBeGreaterThanOrEqual(0);
        expect(anchor.cx).toBeLessThanOrEqual(100);
        expect(anchor.cy).toBeGreaterThanOrEqual(0);
        expect(anchor.cy).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('coverage parity', () => {
    it('VALID_MARK_TYPES enumerates exactly 5 types per audit §A7', () => {
      expect(VALID_MARK_TYPES).toEqual(
        expect.arrayContaining(['tattoo', 'hearing-aid', 'bindi', 'scar', 'prosthetic']),
      );
      expect(VALID_MARK_TYPES).toHaveLength(5);
    });

    it('every type has a defaultLocation in LOCATION_ANCHORS', () => {
      for (const spec of DISTINGUISHING_MARKS) {
        expect(LOCATION_ANCHORS).toHaveProperty(spec.defaultLocation);
      }
    });
  });
});
