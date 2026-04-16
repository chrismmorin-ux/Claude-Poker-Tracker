/**
 * diagnostics-dump.test.js — STP-1 Stage 4c / doctrine R-7.4.
 *
 * The RT-66 badge tooltip says "copy diagnostics for details". Pre-STP-1 the
 * dump did not contain the details it pointed at — no pipelineEvents, no
 * violation counters, no hasTableHands. This test pins that every
 * user-facing label the dump promises actually gets emitted.
 *
 * Approach: parse runDiagnostics in side-panel.js and assert every required
 * `lines.push(...)` exists. side-panel.js is an IIFE so we cannot call
 * runDiagnostics directly; a text-based pin catches the regression class.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PANEL_DIR = resolve(__dirname, '..');
const sidePanelJs = readFileSync(resolve(PANEL_DIR, 'side-panel.js'), 'utf8');

// Extract the runDiagnostics function body so prose elsewhere in the file
// can't satisfy these assertions.
function extractRunDiagnostics(source) {
  const start = source.indexOf('const runDiagnostics = async () => {');
  if (start < 0) throw new Error('could not locate runDiagnostics');
  const open = source.indexOf('{', start);
  let depth = 1;
  let i = open + 1;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  return source.slice(open, i);
}

const runDiagBody = extractRunDiagnostics(sidePanelJs);

describe('STP-1 R-7.4 — diagnostics dump completeness', () => {
  describe('Required section headers', () => {
    // If any of these is removed, the diagnostic paste becomes useless for
    // its stated purpose. Each is a promise the badge tooltip or UI makes.
    const REQUIRED_SECTIONS = [
      '[SW Health]',
      '[Pipeline Status]',
      '[Storage (Side Panel Mirror)]',
      '[Side Panel State]',
      '[Invariant Violations',
      '[Exploits Cache]',
      '[Action Advice Cache]',
      '[Tournament Log]',
      '[Self-Test]',
    ];

    for (const header of REQUIRED_SECTIONS) {
      it(`emits section: "${header}"`, () => {
        // Each header lives inside a `lines.push(...)` call. Escape the
        // bracket and match a literal occurrence.
        const escaped = header.replace(/[[\]()]/g, '\\$&');
        expect(runDiagBody).toMatch(new RegExp(escaped));
      });
    }
  });

  describe('Required state fields in [Side Panel State]', () => {
    // Each field below must appear as a labelled line. These are what
    // debugging actually needs — if any is dropped, we lose the payload
    // that makes "copy diagnostics for details" meaningful.
    const REQUIRED_FIELDS = [
      'lastHandCount:',
      'hasTableHands:',
      'currentActiveTableId:',
      'currentTableState:',
      'currentLiveContext:',
      'invariantCount:',          // STP-1: unified 30s|lifetime line
      'invariantLastAt:',
    ];

    for (const field of REQUIRED_FIELDS) {
      it(`emits field label: "${field}"`, () => {
        expect(runDiagBody).toMatch(new RegExp(field));
      });
    }
  });

  describe('Invariant-violation payload (STP-1)', () => {
    it('dumps the most recent INVARIANT_VIOLATION entries with rule text', () => {
      expect(runDiagBody).toMatch(/INVARIANT_VIOLATION/);
      // The loop variable must iterate over a filtered slice so that
      // the detail (e.g., "R5: advicePendingForStreet=PREFLOP...") is
      // emitted, not just the count.
      expect(runDiagBody).toMatch(/_dumpInvEvents/);
      expect(runDiagBody).toMatch(/e\.detail/);
    });

    it('dumps both 30s and lifetime counters', () => {
      // STP-1: the tooltip-lie fix requires both counters to be visible so
      // the user can distinguish "spamming right now" from "large but aged".
      expect(runDiagBody).toMatch(/30s=\$\{_dumpViol30s\}/);
      expect(runDiagBody).toMatch(/lifetime=\$\{_dumpViolLifetime\}/);
    });

    it('notes ring-buffer eviction when zero INVARIANT_VIOLATION entries present', () => {
      // If the ring buffer has rolled over (50-entry cap), the dump must
      // say so — otherwise "no violations" is ambiguous between "never
      // violated" and "all evicted".
      expect(runDiagBody).toMatch(/capped at 50|evicted/i);
    });
  });

  describe('COPY affordance is wired', () => {
    it('diag-copy button reads diagOutput.textContent', () => {
      // The "COPY" button lives at side-panel.html:1740. Its click handler
      // must copy the actual diag output, not some other pane's content.
      expect(sidePanelJs).toMatch(/navigator\.clipboard\.writeText\(diagOutput\.textContent\)/);
    });
  });
});
