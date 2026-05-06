// @vitest-environment jsdom
/**
 * Smoke test for PlayerFinderView. Verifies the module loads cleanly and
 * the bundle's exports are intact. Full integration coverage (filter →
 * tap → diff → assign over real IDB) lives in the manual-validation
 * cycle on the phone — the contexts + IDB persistence layer is heavier
 * than is worth recreating here at Phase B. The hook + identification-
 * field tests already cover the unit-level state machine.
 */
import { describe, it, expect } from 'vitest';

describe('PlayerFinderView — smoke', () => {
  it('module loads without error and exports PlayerFinderView', async () => {
    const mod = await import('../PlayerFinderView');
    expect(mod.PlayerFinderView).toBeDefined();
    expect(typeof mod.PlayerFinderView).toBe('function');
  });

  it('default export matches the named export', async () => {
    const mod = await import('../PlayerFinderView');
    expect(mod.default).toBe(mod.PlayerFinderView);
  });
});
