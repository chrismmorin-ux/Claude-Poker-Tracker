/**
 * pipeline-visibility-gating.test.js — V-status §I.3 regression pin (Gate 5 PR-10).
 *
 * Spec §I.3 declares the pipeline-stage-health strip visibility-gated to the
 * empty-no-table state. The binding requirement is §I.3 #9: the strip MUST NOT
 * co-occur with normal HUD content, because co-occurrence with the §II freshness
 * strip creates user-visible ambiguity.
 *
 * This test asserts both code branches exist as a regression pin — removing the
 * gating without doctrine amendment would silently drop a load-bearing axis-3
 * surface on the no-table state.
 *
 * The gate predicate is `currentActiveTableId`, NOT `hasTableHands`. The strip
 * answers "is a table present?"; hasTableHands answers "has a hand finished and
 * been written to session storage" — a different question whose answer is false
 * for the whole of the first hand at any table and after every table switch.
 * Keying the shell on it rendered "No active table detected" over a live hand.
 * The spec's non-co-occurrence requirement is unchanged and still pinned below;
 * only the predicate that identifies the no-table state was corrected.
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

  it('renderAll shows pipeline-health when no table is present', () => {
    const noTableBranch = src.match(
      /if\s*\(\s*!\s*tablePresent\s*\)\s*\{[\s\S]{0,400}?showEl\s*\(\s*\$\(\s*['"]pipeline-health['"]\s*\)\s*\)/
    );
    expect(noTableBranch).toBeTruthy();
  });

  it('renderAll hides pipeline-health when a table is present', () => {
    const tablePresentBranch = src.match(
      /\}\s*else\s*\{[\s\S]{0,400}?hideEl\s*\(\s*\$\(\s*['"]pipeline-health['"]\s*\)\s*\)/
    );
    expect(tablePresentBranch).toBeTruthy();
  });

  it('gates the shell on table presence, never on stored hands (regression)', () => {
    // The defect: the shell gate asked hasTableHands, so the panel rendered
    // "No active table detected" during the first hand at a table and after
    // every reconnect-induced table switch.
    expect(src).toMatch(/const\s+tablePresent\s*=\s*!!\s*snap\.currentActiveTableId/);
    expect(src).not.toMatch(/if\s*\(\s*!\s*snap\.hasTableHands\s*\)/);
  });

  it('§I.3 #9: pipeline strip never co-occurs with HUD content', () => {
    // The binding spec requirement. The branch that shows the strip must hide
    // #hud-content, and the branch that shows #hud-content must hide the strip.
    const gate = src.match(
      /if\s*\(\s*!\s*tablePresent\s*\)\s*\{([\s\S]{0,400}?)\}\s*else\s*\{([\s\S]{0,400}?)\}/
    );
    expect(gate).toBeTruthy();
    const [, noTable, hasTable] = gate;
    expect(noTable).toMatch(/showEl\s*\(\s*\$\(\s*['"]pipeline-health['"]/);
    expect(noTable).toMatch(/hideEl\s*\(\s*\$\(\s*['"]hud-content['"]/);
    expect(hasTable).toMatch(/hideEl\s*\(\s*\$\(\s*['"]pipeline-health['"]/);
    expect(hasTable).toMatch(/showEl\s*\(\s*\$\(\s*['"]hud-content['"]/);
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
