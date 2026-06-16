// @vitest-environment jsdom
/**
 * FrameworkMode.test.jsx — postflop Framework Drill grading parity (WS-229 F-DRILL-05).
 *
 * RANGE_DECOMPOSITION applies to every flop (its only subcase is 'always'), so it
 * carries zero structural-recognition signal in a selection drill. Preflop excludes
 * its identically-named `decomposition` from the gradable set; postflop used to expose
 * it in the picker AND count it in the truth set, so omitting it was marked as a miss —
 * a cross-view grading inconsistency. These tests pin the fix: range_decomposition is
 * neither selectable nor graded, while a genuine framework (e.g. Range Morphology, which
 * applies to single-range scenarios) remains in the picker.
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FrameworkMode } from '../FrameworkMode';
import { FRAMEWORK_ORDER } from '../../../../utils/postflopDrillContent/frameworks';

describe('FrameworkMode — non-gradable framework exclusion', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('does not offer Range Decomposition as a selectable framework', async () => {
    render(<FrameworkMode />);
    // The drill renders a scenario synchronously from the SCENARIOS library on mount.
    await screen.findByText('Identify frameworks');
    expect(
      screen.queryByText('Range Decomposition'),
    ).not.toBeInTheDocument();
  });

  it('still offers a genuine, conditionally-applicable framework in the picker', async () => {
    render(<FrameworkMode />);
    await screen.findByText('Identify frameworks');
    // Range Morphology is always-applicable but RETAINED (load-bearing for the
    // single-range scenarios); it must still appear in the picker.
    expect(screen.getByText('Range Morphology')).toBeInTheDocument();
  });

  it('range_decomposition is genuinely always-on — justifying its exclusion', () => {
    // Guard the premise: the framework we exclude really does apply to every flop
    // (its only subcase is 'always'), so excluding it never loses a real distinction.
    const decomp = FRAMEWORK_ORDER.find((fw) => fw.id === 'range_decomposition');
    expect(decomp).toBeTruthy();
    expect(decomp.subcases.map((s) => s.id)).toEqual(['always']);
  });
});
