// @vitest-environment jsdom
/**
 * DrillTabGuard.test.jsx — tab-switch protection for the drill views (WS-229 F-DRILL-02).
 */

import React, { useRef, useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  confirmTabSwitch,
  DrillTabGuardProvider,
  useDrillProgress,
} from '../DrillTabGuard';

describe('confirmTabSwitch', () => {
  it('allows the switch and never prompts when no drill is in progress', () => {
    const confirmFn = vi.fn(() => false);
    expect(confirmTabSwitch(false, confirmFn)).toBe(true);
    expect(confirmFn).not.toHaveBeenCalled();
  });

  it('prompts when a drill is in progress and proceeds only on confirm', () => {
    expect(confirmTabSwitch(true, () => true)).toBe(true);
    expect(confirmTabSwitch(true, () => false)).toBe(false);
  });
});

describe('useDrillProgress', () => {
  it('writes the mode\'s progress flag into the provider ref', () => {
    let captured;
    const Mode = ({ value }) => {
      const report = useDrillProgress();
      useEffect(() => { report(value); }, [report, value]);
      return null;
    };
    const Harness = ({ value }) => {
      const ref = useRef(false);
      captured = ref;
      return (
        <DrillTabGuardProvider progressRef={ref}>
          <Mode value={value} />
        </DrillTabGuardProvider>
      );
    };

    const { rerender } = render(<Harness value />);
    expect(captured.current).toBe(true);

    rerender(<Harness value={false} />);
    expect(captured.current).toBe(false);
  });

  it('is a no-op (does not throw) when a mode is rendered outside a provider', () => {
    const Mode = () => {
      const report = useDrillProgress();
      useEffect(() => { report(true); }, [report]);
      return null;
    };
    expect(() => render(<Mode />)).not.toThrow();
  });
});
