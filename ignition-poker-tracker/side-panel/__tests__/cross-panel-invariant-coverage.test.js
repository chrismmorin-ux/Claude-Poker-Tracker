/**
 * cross-panel-invariant-coverage.test.js — R-7.2 coverage pin.
 *
 * Doctrine R-7.2 requires: (a) cross-panel invariants evaluated pre-dispatch
 * by the render coordinator, (b) surfacing via the emergency-tier invariant
 * badge (RT-66 pattern). Post-SR-6.17 the coverage is split across two
 * cooperating layers:
 *
 *   1. `computeAdviceStaleness(advice, ctx)` in side-panel.js — the render
 *      gate. `reason: 'street-mismatch'` is emitted on ANY advice/ctx street
 *      divergence and drives `.stale` class + "Stale — recomputing" label on
 *      all four advice-consuming panels (action-bar, plan-panel,
 *      more-analysis, model-audit).
 *
 *   2. `_rule3_adviceStreetMatch` in state-invariants.js — the observability
 *      layer. Emits violations for >1-rank gaps and warnings for 1-behind
 *      (tolerable mid-push gap). Violations surface via the RT-66 invariant
 *      badge wired in render-orchestrator / renderInvariantBadge path.
 *
 * This test pins both layers exist and stay wired. See SR-8.3 / audit
 * caveat C-4 for rationale.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PANEL_DIR = resolve(__dirname, '..');

const sidePanelJs = readFileSync(resolve(PANEL_DIR, 'side-panel.js'), 'utf8');
const stateInvariantsJs = readFileSync(resolve(PANEL_DIR, 'state-invariants.js'), 'utf8');

describe('R-7.2 / SR-8.3 — cross-panel invariant coverage', () => {
  describe('Layer 1: render gate (computeAdviceStaleness)', () => {
    it('computeAdviceStaleness helper exists with advice+ctx signature', () => {
      expect(sidePanelJs).toMatch(
        /const computeAdviceStaleness = \(advice, ctx, now = Date\.now\(\)\)/
      );
    });

    it('helper emits street-mismatch reason when advice.currentStreet !== ctx.currentStreet', () => {
      const body = sidePanelJs.match(
        /const computeAdviceStaleness = [\s\S]*?\n  \};/
      )?.[0] || '';
      expect(body).toMatch(/street-mismatch/);
      expect(body).toMatch(/advice\.currentStreet/);
      expect(body).toMatch(/ctx\.currentStreet/);
    });

    it('all four advice-consuming panels toggle .stale off the helper result', () => {
      // SR-6.12 Z2 §2.10 consolidation: action-bar + plan-panel + more-analysis +
      // model-audit all share one isAdviceStale computation.
      for (const el of ['actionBarEl', 'planPanelEl', 'moreAnalysisContentEl', 'modelAuditContentEl']) {
        expect(sidePanelJs).toMatch(new RegExp(`${el}.*classList\\.toggle\\('stale'`));
      }
    });

    it('"Stale — recomputing" label is the user-facing surface', () => {
      expect(sidePanelJs).toMatch(/Stale \\u2014 recomputing|Stale — recomputing/);
    });
  });

  describe('Layer 2: observability (_rule3_adviceStreetMatch)', () => {
    it('Rule 3 exists and distinguishes violations from warnings', () => {
      expect(stateInvariantsJs).toMatch(/_rule3_adviceStreetMatch/);
      expect(stateInvariantsJs).toMatch(/violations\.push/);
      expect(stateInvariantsJs).toMatch(/warnings\.push/);
    });

    it('Rule 3 flags >1-street gaps (both directions) as violations', () => {
      // Grab a generous window after the method name; Rule 3 fits in ~30 lines.
      // Skip the first hit (dispatch call on line ~43) and land on the method definition.
      // Method definition (ends with `) {`), not the dispatch call (ends with `);`).
      const idx = stateInvariantsJs.indexOf('_rule3_adviceStreetMatch(snap, violations, warnings) {');
      const body = stateInvariantsJs.slice(idx, idx + 1500);
      expect(body).toMatch(/advRank < ctxRank - 1/);
      expect(body).toMatch(/advRank - ctxRank > 1/);
    });
  });
});
