/**
 * z0-chrome.test.js — SR-6.10 enforcement.
 *
 * A) Coordinator default `lastHandCount` is null (boot-race placeholder
 *    per Z0 spec §0.2 — R-4.2 unknown distinct from known-zero).
 * B) `#diag-footer` exists, gated by `settings.debugDiagnostics`
 *    (default display:none so non-debug users never see it).
 * C) Source-level assertion: `updateStatusBar` writes `—` (U+2014) when
 *    `handCount == null`, numeric otherwise.
 * D) Source-level assertion: `diag-show` click handler early-returns when
 *    `settings.debugDiagnostics !== true` (belt-and-braces).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { RenderCoordinator } from '../render-coordinator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = resolve(__dirname, '..', 'side-panel.html');
const JS_PATH = resolve(__dirname, '..', 'side-panel.js');
const html = readFileSync(HTML_PATH, 'utf8');
const js = readFileSync(JS_PATH, 'utf8');

describe('SR-6.10 Z0 §0.2 — boot-race placeholder', () => {
  it('coordinator default lastHandCount is null (unknown)', () => {
    const coord = new RenderCoordinator({ renderFn: () => {} });
    expect(coord.get('lastHandCount')).toBeNull();
  });

  it('updateStatusBar renders em-dash when handCount is null', () => {
    // Source-level pin (DOM harness belongs in render-orchestrator tests).
    expect(js).toMatch(/handCount == null\s*\?\s*'\\u2014'\s*:\s*handCount/);
  });

  it('null lastHandCount satisfies `> 0` checks (no false positives)', () => {
    expect(null > 0).toBe(false);
  });
});

describe('SR-6.10 Z0 §0.7 — diagnostics flag gate', () => {
  it('defines #diag-footer wrapper (gated container)', () => {
    expect(html).toMatch(/id="diag-footer"/);
  });

  it('diag-footer defaults to display:none (flag defaults false)', () => {
    const m = html.match(/id="diag-footer"[^>]*style="([^"]+)"/);
    expect(m).not.toBeNull();
    expect(m[1]).toMatch(/display:\s*none/);
  });

  it('renderDiagnosticsGate toggles footer display by settings.debugDiagnostics', () => {
    expect(js).toMatch(/renderDiagnosticsGate/);
    expect(js).toMatch(/settings\?\.debugDiagnostics === true/);
    expect(js).toMatch(/diagFooter\.style\.display = flagOn \? '' : 'none'/);
  });

  it('diag-show click handler guards against flag-off stale state', () => {
    expect(js).toMatch(/coordinator\.get\('settings'\)\?\.debugDiagnostics !== true\) return/);
  });

  it('renderDiagnosticsGate is called from renderAll', () => {
    expect(js).toMatch(/renderDiagnosticsGate\(snap\)/);
  });
});
