/**
 * pipeline-visibility-gating.test.js — V-status §I.3 regression pin (Gate 5 PR-10).
 *
 * Spec §I.3 declares the pipeline-stage-health strip as
 * `!hasHands` visibility-gated — the strip is shown when the panel has
 * no hands to display, and hidden when normal HUD content is up. The
 * runtime gating lives in renderAll (side-panel.js) and is driven by
 * the `hasTableHands` snapshot field, which buildSnapshot derives from
 * `lastHandCount > 0` (semantically the same as the spec's `hasHands`).
 *
 * This test asserts both code branches exist as a regression pin —
 * removing the gating without doctrine amendment would silently drop
 * a load-bearing axis-3 surface on the no-table state.
 *
 * Spec: docs/design/surfaces/sidebar-shell-spec.md §I.3.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { RenderCoordinator } from '../render-coordinator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PANEL_DIR = resolve(__dirname, '..');

describe('V-status §I.3 — pipeline-strip visibility-gating', () => {
  const src = readFileSync(resolve(PANEL_DIR, 'side-panel.js'), 'utf8');

  it('renderAll shows pipeline-health when !hasTableHands', () => {
    // Look for the gating block around `if (!snap.hasTableHands)` ... showEl pipeline-health.
    const noHandsBranch = src.match(
      /if\s*\(\s*!\s*snap\.hasTableHands\s*\)\s*\{[\s\S]{0,400}?showEl\s*\(\s*\$\(\s*['"]pipeline-health['"]\s*\)\s*\)/
    );
    expect(noHandsBranch).toBeTruthy();
  });

  it('renderAll hides pipeline-health when hasTableHands', () => {
    // The `else` branch — hasTableHands true — must hide the strip.
    // Match `}\s*else\s*\{` followed by hideEl pipeline-health within ~400 chars.
    const hasHandsBranch = src.match(
      /\}\s*else\s*\{[\s\S]{0,400}?hideEl\s*\(\s*\$\(\s*['"]pipeline-health['"]\s*\)\s*\)/
    );
    expect(hasHandsBranch).toBeTruthy();
  });

  it('hasHands derived field reflects lastHandCount > 0', () => {
    // Spec calls this `hasHands` and the runtime gate uses `hasTableHands`;
    // both pivot around the same semantics. This assertion pins the derive.
    const coord = new RenderCoordinator({
      renderFn: () => {},
      getTimestamp: () => Date.now(),
      requestFrame: (cb) => setTimeout(cb, 0),
      setTimeout: (cb, ms) => setTimeout(cb, ms),
      clearTimeout: (id) => clearTimeout(id),
    });

    coord.set('lastHandCount', 0);
    expect(coord.buildSnapshot().hasHands).toBe(false);

    coord.set('lastHandCount', 1);
    expect(coord.buildSnapshot().hasHands).toBe(true);

    coord.set('lastHandCount', null);
    // null > 0 === false — boot-race state correctly excluded from "has hands"
    expect(coord.buildSnapshot().hasHands).toBe(false);
  });
});
