/**
 * checkFigureCurrency.test.js — WS-437.
 *
 * The failure this scanner exists to catch: a percentage in a doc HEADING that reads as a
 * performance claim while its currency caveat lives in a different document — the §11.9
 * "Recovers ~56% of the Engine" pattern. Each test pins a distinction whose collapse would
 * make the scanner either miss that pattern or drown it in noise.
 */

import { describe, it, expect } from 'vitest';

import { scanText, scanRepo, WINDOW } from '../check-figure-currency.mjs';

describe('scanText', () => {
  it('flags a heading with a percentage and no currency annotation — the §11.9 pattern', () => {
    const doc = [
      '### 11.9 A Fifteen-Number Rule Recovers ~56% of the Engine (WS-303, measured)',
      '',
      'Founder doctrine: the teachable model may differ from the engine model.',
    ].join('\n');
    const findings = scanText(doc, 'context/SOME_DOC.md');
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'context/SOME_DOC.md', line: 1 });
  });

  it('passes when the currency is inline in the heading itself', () => {
    const doc = '### Recovers ~56% of the Engine (Delta-log against revealed hole cards — not an EV claim)';
    expect(scanText(doc, 'x.md')).toHaveLength(0);
  });

  it(`passes when the annotation is within the ${WINDOW}-line window below the heading`, () => {
    const doc = [
      '### Recovers ~56% of the Engine',
      '',
      'Every figure here is a diagnostic, not a result.',
    ].join('\n');
    expect(scanText(doc, 'x.md')).toHaveLength(0);
  });

  it('does NOT pass when the annotation sits beyond the window — that is the caveat-in-another-room failure', () => {
    const filler = Array.from({ length: WINDOW + 3 }, (_, i) => `filler line ${i}`);
    const doc = ['### Recovers ~56% of the Engine', ...filler, 'Measured in Delta-log.'].join('\n');
    expect(scanText(doc, 'x.md')).toHaveLength(1);
  });

  it('ignores percentages outside headings — prose is annotated by its paragraph, headings travel alone', () => {
    const doc = 'The rule recovers 56% of the engine narrowing edge in some sense.';
    expect(scanText(doc, 'x.md')).toHaveLength(0);
  });

  it('ignores headings with no figure', () => {
    expect(scanText('### The Fifteen-Number Rule', 'x.md')).toHaveLength(0);
  });

  it('recognizes bb/100 and named axes as currencies', () => {
    expect(scanText('### Arm beats baseline by 12% (bb/100, paired)', 'x.md')).toHaveLength(0);
    expect(scanText('### Gate C1 — ≥ 60.0% accuracy AND ≥ 8.0% lift', 'x.md')).toHaveLength(0);
  });

  it('honors the allowlist by (file substring, heading substring)', () => {
    const doc = '### Claim 4 — "Hero equity ~30% vs the donk range"';
    expect(scanText(doc, 'docs/upper-surface/comparisons/some-line.md')).toHaveLength(0);
    expect(scanText(doc, 'docs/live-doctrine.md')).toHaveLength(1);
  });
});

describe('scanRepo — the repo itself must stay clean', () => {
  it('finds no unannotated percentage-bearing headings in .claude/context or docs', () => {
    const { files, findings } = scanRepo();
    expect(files).toBeGreaterThan(100);
    expect(findings).toEqual([]);
  });
});
