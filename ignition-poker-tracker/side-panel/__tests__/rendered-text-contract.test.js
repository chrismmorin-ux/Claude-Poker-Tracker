/**
 * rendered-text-contract.test.js — STP-1 Stage 4b / doctrine R-7.3.
 *
 * For every user-surfaced string in side-panel.js that references coordinator
 * state, pin the text source to the state field. Catches the class of bug
 * where the label drifts away from the data it claims to describe — e.g.,
 * the pre-STP-1 badge tooltip that said "in the last 30s" but read a lifetime
 * counter.
 *
 * Approach: text-based source assertions. The IIFE in side-panel.js prevents
 * direct import of render helpers, so we parse the source and pin (a) the
 * template literal, (b) the state field it reads, and (c) the label text.
 *
 * New user-surfaced strings added to side-panel.js must extend this list.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PANEL_DIR = resolve(__dirname, '..');
const sidePanelJs = readFileSync(resolve(PANEL_DIR, 'side-panel.js'), 'utf8');

describe('STP-1 R-7.3 — rendered-text contracts', () => {
  describe('Invariant badge tooltip', () => {
    it('reads violationCount30s, not the lifetime counter', () => {
      // Pre-STP-1 this read `snap.lastViolationCount` (lifetime) while the
      // tooltip text said "in the last 30s" — the source of the "213 in 30s"
      // false alarm. Now the counter field and the label must agree.
      expect(sidePanelJs).toMatch(
        /badge\.title\s*=\s*`\$\{snap\.violationCount30s\}\s*state invariant violation/
      );
    });

    it('does NOT read the lifetime counter for the tooltip', () => {
      // Negative pin: the literal text "lastViolationCount" or
      // "violationCountLifetime" must not appear in the same assignment.
      const match = sidePanelJs.match(/badge\.title\s*=\s*`[^`]*`/);
      expect(match, 'badge.title template literal should exist').toBeTruthy();
      expect(match[0]).not.toMatch(/violationCountLifetime|lastViolationCount/);
    });

    it('visibility gate reads lastViolationAt for the 30s aging window', () => {
      // The gate at side-panel.js:1856-1861 uses lastViolationAt (timestamp
      // of most recent violation) to hide the badge after 30s of no activity.
      // This is distinct from the COUNTER semantic — keep it in place.
      expect(sidePanelJs).toMatch(
        /const violationAge\s*=\s*snap\.lastViolationAt\s*\?\s*Date\.now\(\)\s*-\s*snap\.lastViolationAt/
      );
      expect(sidePanelJs).toMatch(/violationAge\s*<\s*30_?000\s*&&\s*snap\.violationCount30s\s*>\s*0/);
    });
  });

  describe('Stale-context indicator', () => {
    it('"Data may be stale" string is gated by staleContext && liveCtx', () => {
      // side-panel.js:1846 area. The user sees this only when both flags
      // agree: there IS a live context, and the 60s stale timer has tripped.
      const staleBlock = sidePanelJs.match(
        /if \(snap\.staleContext && liveCtx\)\s*\{[\s\S]*?Data may be stale[\s\S]*?\}/
      );
      expect(staleBlock, 'stale-indicator block must read both snap.staleContext and liveCtx').toBeTruthy();
    });
  });

  describe('Diagnostics dump — counter label matches data source', () => {
    it('dump line labeled "30s=" reads from _violationTimestamps (via filter)', () => {
      // STP-1 Stage 1 dump format: `invariantCount: 30s=N | lifetime=M`.
      // The "30s" value must be computed from the rolling-window backing
      // array, not from the lifetime counter.
      expect(sidePanelJs).toMatch(/_violationTimestamps/);
      expect(sidePanelJs).toMatch(/invariantCount:\s*30s=\$\{_dumpViol30s\}\s*\|\s*lifetime=\$\{_dumpViolLifetime\}/);
    });

    it('dump does NOT label a lifetime value as "30s"', () => {
      // Negative pin for the original tooltip-lie pattern. If someone ever
      // writes `30s=${_dumpViolLifetime}`, this catches it.
      expect(sidePanelJs).not.toMatch(/30s=\$\{_dumpViolLifetime\}/);
      expect(sidePanelJs).not.toMatch(/30s=\$\{_dumpViolCount\}/);
    });
  });

  describe('Template-literal audit — `snap.` references', () => {
    it('every `snap.X` read from a template literal references a real snapshot field', () => {
      // Guardrail: if a template literal reads `${snap.somethingNew}` that
      // doesn't exist in buildSnapshot, the string renders "undefined".
      // Enumerate the snap fields we currently expose so new additions
      // are intentional.
      const renderCoordinatorJs = readFileSync(
        resolve(PANEL_DIR, 'render-coordinator.js'), 'utf8'
      );
      const snapBlock = renderCoordinatorJs.match(/buildSnapshot\(\)\s*\{[\s\S]*?^\s{2}\}/m);
      expect(snapBlock, 'could not locate buildSnapshot method body').toBeTruthy();

      // Collect field names the snapshot exposes. Shape: `  name: value,`
      // (6-space indent inside the returned object literal).
      const exposedFields = new Set();
      for (const m of snapBlock[0].matchAll(/^\s{6}([a-zA-Z_][a-zA-Z0-9_]*)\s*:/gm)) {
        exposedFields.add(m[1]);
      }

      // Find all `${snap.X}` references in side-panel.js.
      const referenced = new Set();
      for (const m of sidePanelJs.matchAll(/\$\{snap\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
        referenced.add(m[1]);
      }

      // Every referenced field must exist in the snapshot.
      const missing = [...referenced].filter(f => !exposedFields.has(f));
      expect(missing, `template literals read snap fields not in buildSnapshot: ${missing}`).toEqual([]);
    });
  });
});
