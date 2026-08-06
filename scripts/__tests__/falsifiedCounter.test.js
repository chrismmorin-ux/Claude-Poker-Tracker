import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * S10 — DESTROY THE NARRATIVE, KEEP THE COUNTER.
 *
 * A correction that fired once and was fixed structurally is archaeology, and the
 * narrative belongs in git rather than in the document. But one clause is permanent
 * doctrine even when the story is not: THE FACT THAT A CLAIM HAS BEEN FALSIFIED.
 *
 * The case that decides it is POKER_THEORY §3.4. Its taxonomy was falsified, was
 * fixed, and the correction was archived — and the section still read with unqualified
 * confidence, so the next reader had no way to know the list had been too small
 * before. A tombstone at the code site answers the reader who USES a falsified thing;
 * it never reaches the reader sitting in §3.4 BELIEVING it. Hence the marker lives on
 * the CLAIM.
 *
 * This registry is the mechanism. Adding an entry is how a falsification becomes
 * permanent; this test is what stops the counter being lost in a later rewrite of the
 * section, which is exactly how the first one went missing.
 */
const FALSIFIED_CLAIMS = [
  {
    file: '.claude/context/POKER_THEORY.md',
    heading: '### 3.4 Why Players Bet — The Four Motivations',
    count: 1,
    what: 'Said THREE motivations; protection / equity denial had no home (WS-256).',
  },
];

describe('S10 — a falsified claim keeps its counter, on the claim itself', () => {
  for (const claim of FALSIFIED_CLAIMS) {
    it(`${claim.file} :: ${claim.heading} carries its falsified marker`, () => {
      const full = path.join(REPO_ROOT, claim.file);
      const text = fs.readFileSync(full, 'utf8');

      const idx = text.indexOf(claim.heading);
      expect(idx, `heading not found — if it was renamed, move the marker with it: ${claim.heading}`)
        .toBeGreaterThan(-1);

      // The marker must sit in the claim's own opening, not somewhere far below it.
      const window = text.slice(idx, idx + 1200);
      expect(window, `no "falsified Nx" marker under ${claim.heading}`)
        .toMatch(/falsified\s+\d+\s*×/i);

      const m = window.match(/falsified\s+(\d+)\s*×/i);
      expect(Number(m[1]),
        `marker count disagrees with the registry for ${claim.heading}`).toBe(claim.count);
    });

    it(`${claim.heading} no longer reads with unqualified confidence`, () => {
      const text = fs.readFileSync(path.join(REPO_ROOT, claim.file), 'utf8');
      const idx = text.indexOf(claim.heading);
      const window = text.slice(idx, idx + 1200).toLowerCase();
      // The whole point: a reader must learn the list has been incomplete BEFORE
      // reading the list, without opening the archive and without reading the code.
      expect(
        window.includes('too small') || window.includes('not read it as closed') || window.includes('incomplete'),
        'marker present but it does not tell the reader the claim has been too small before',
      ).toBe(true);
    });
  }

  it('the compact tier carries the counter into every session', () => {
    // The marker on the claim only helps a reader who opens the file. The status rule
    // in the compact tier is what reaches a session that never does.
    const { RULES } = require(path.join(REPO_ROOT, '.claude/hooks/compact-tier.cjs'));
    const status = RULES.filter(r => r.kind === 'status').map(r => r.text).join(' ');
    expect(status).toMatch(/falsified\s+\d+x/i);
    expect(status.toLowerCase()).toContain('too small');
  });
});
