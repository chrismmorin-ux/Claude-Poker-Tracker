/**
 * useResponsiveBreakpoint — returns one of 'lg' | 'md' | 'sm' | 'xs' based
 * on current DOM viewport width. Matches the Gate-4 F02 resolution thresholds:
 *
 *   lg — ≥1200px (reference desktop / tablet landscape)
 *   md — 900–1199px (smaller tablet / phone landscape)
 *   sm — 640–899px (phone landscape minimum)
 *   xs — <640px (below minimum — pushes content into vertical reflow)
 *
 * `useScale` compresses visual size but not DOM — breakpoints are tested
 * against the raw DOM viewport width, which is what container-query logic
 * cares about. Uses `window.innerWidth` + a resize listener (no media-query
 * handlers; simpler state semantics in test environments).
 */

import { useEffect, useState } from 'react';

const classify = (w) => {
  if (w < 640) return 'xs';
  if (w < 900) return 'sm';
  if (w < 1200) return 'md';
  return 'lg';
};

const getInitial = () => {
  if (typeof window === 'undefined' || typeof window.innerWidth !== 'number') {
    return 'lg';
  }
  return classify(window.innerWidth);
};

export const useResponsiveBreakpoint = () => {
  const [bp, setBp] = useState(getInitial);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let timer = null;
    const onResize = () => {
      // Debounce a little so rapid drag-resize doesn't thrash.
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setBp(classify(window.innerWidth)), 100);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return bp;
};

/**
 * Row cap for P1's visible-row list: default 6 at lg/md, 4 at sm, 3 at xs.
 * Groups beyond the cap are collapsed behind a "Show all N groups" disclosure.
 */
export const p1RowCapForBreakpoint = (bp) => {
  if (bp === 'xs') return 3;
  if (bp === 'sm') return 4;
  return 6;
};

/**
 * Column count for P2's WeightedTotalTable: 5 per-group + Total at lg/md,
 * 3 aggregated (Beats/Pays/Other) + Total at sm, vertical-reflow at xs.
 */
export const p2ColumnModeForBreakpoint = (bp) => {
  if (bp === 'xs') return 'vertical';
  if (bp === 'sm') return 'aggregated-3';
  return 'detail-5';
};
