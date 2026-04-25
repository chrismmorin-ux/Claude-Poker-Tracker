/**
 * copyDisciplinePatterns.test.js — unit coverage for validateCopyDiscipline
 * + CD-1..CD-5 regex patterns.
 *
 * Strategy: pair each CD rule with at least one failing fixture (the regex
 * must catch this) and at least one near-miss passing fixture (the regex
 * must NOT catch innocent prose). Special cases: CD-4 whitelist-exception
 * (POKER_THEORY citation within 200 chars) + CD-5 cd5_exempt bypass.
 *
 * Spec source: docs/projects/printable-refresher/copy-discipline.md §CI-lint
 */

import { describe, test, expect } from 'vitest';
import {
  CD1_PATTERNS,
  CD2_PATTERNS,
  CD3_PATTERNS,
  CD4_PATTERN,
  CD5_STAKES_REGEX,
  CD5_STACK_REGEX,
  validateCopyDiscipline,
} from '../copyDisciplinePatterns.js';

const cleanBase = {
  cardId: 'TEST',
  title: 'CO open · 100bb · rake-agnostic',
  bodyMarkdown: 'Bet B into pot P needs villain to fold at least B/(P+B). Rake-agnostic at 100bb effective.',
  cd5_exempt: false,
  cd5_exempt_justification: null,
};

// Helper: replace bodyMarkdown but keep CD-5 stakes + stack tokens so we don't
// confound CD-1/2/3/4 tests with CD-5 violations.
function withBody(extra) {
  return {
    ...cleanBase,
    bodyMarkdown: `${cleanBase.bodyMarkdown} ${extra}`,
  };
}

describe('copyDisciplinePatterns — pattern catalog shape', () => {
  test('CD-1 has 5 patterns', () => expect(CD1_PATTERNS).toHaveLength(5));
  test('CD-2 has 6 patterns', () => expect(CD2_PATTERNS).toHaveLength(6));
  test('CD-3 has 14 patterns including the "your N%" rule', () => {
    expect(CD3_PATTERNS.length).toBeGreaterThanOrEqual(14);
    expect(CD3_PATTERNS.some((p) => p.regex.toString().includes('\\d+%'))).toBe(true);
  });
  test('CD-4 has labels-as-inputs regex', () => {
    expect(CD4_PATTERN.regex).toBeInstanceOf(RegExp);
  });
  test('CD-5 stakes + stack regexes both exposed', () => {
    expect(CD5_STAKES_REGEX).toBeInstanceOf(RegExp);
    expect(CD5_STACK_REGEX).toBeInstanceOf(RegExp);
  });
});

describe('copyDisciplinePatterns — CD-1 imperative tone', () => {
  test('catches "you must"', () => {
    const r = validateCopyDiscipline(withBody('You must fold here.'));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-1a')).toBeTruthy();
  });

  test('catches "always" + action verb', () => {
    const r = validateCopyDiscipline(withBody('Always fold against deep stacks.'));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-1b')).toBeTruthy();
  });

  test('catches "never bluff"', () => {
    const r = validateCopyDiscipline(withBody('Never bluff into uncapped ranges.'));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-1c')).toBeTruthy();
  });

  test('catches "do not" + action verb', () => {
    const r = validateCopyDiscipline(withBody('Do not fold here.'));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-1d')).toBeTruthy();
  });

  test('catches "don\'t" + action verb', () => {
    const r = validateCopyDiscipline(withBody('Don\'t bet thin here.'));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-1e')).toBeTruthy();
  });

  test('does NOT catch "always" without an action verb nearby', () => {
    const r = validateCopyDiscipline(withBody('Auto-profit math is always rake-agnostic.'));
    // No fold/iso/check/bet/bluff/etc. within 50 chars after "always"
    const cd1bHits = r.violations.filter((v) => v.rule === 'CD-1b');
    expect(cd1bHits).toHaveLength(0);
  });
});

describe('copyDisciplinePatterns — CD-2 self-evaluation', () => {
  test('catches "grade your"', () => {
    const r = validateCopyDiscipline(withBody('Grade your decision against the chart.'));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-2a')).toBeTruthy();
  });

  test('catches "test yourself"', () => {
    const r = validateCopyDiscipline(withBody('Test yourself: would you call here?'));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-2e')).toBeTruthy();
  });

  test('catches "did your read"', () => {
    const r = validateCopyDiscipline(withBody('Did your read align with this outcome?'));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-2f')).toBeTruthy();
  });
});

describe('copyDisciplinePatterns — CD-3 engagement', () => {
  test('catches "mastered"', () => {
    const r = validateCopyDiscipline(withBody('You\'ve mastered this concept.'));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-3a')).toBeTruthy();
  });

  test('catches "level up"', () => {
    const r = validateCopyDiscipline(withBody('Level up your river play.'));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-3f')).toBeTruthy();
  });

  test('catches "limited time"', () => {
    const r = validateCopyDiscipline(withBody('Re-print this card in a limited time window.'));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-3i')).toBeTruthy();
  });

  test('catches "users like you"', () => {
    const r = validateCopyDiscipline(withBody('Users like you re-print quarterly.'));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-3k')).toBeTruthy();
  });

  test('catches "your 45%"', () => {
    const r = validateCopyDiscipline(withBody('Your 45% equity edge in this spot.'));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-3n')).toBeTruthy();
  });

  test('does NOT catch a plain "42.9%" without "your"', () => {
    const r = validateCopyDiscipline(withBody('Break-even fold frequency = 6/14 = 42.9%.'));
    const cd3nHits = r.violations.filter((v) => v.rule === 'CD-3n');
    expect(cd3nHits).toHaveLength(0);
  });

  test('does NOT catch "unlock" inside a body that does not contain it', () => {
    // The plain auto-profit body has no "unlock" — sanity check
    const r = validateCopyDiscipline(cleanBase);
    const cd3gHits = r.violations.filter((v) => v.rule === 'CD-3g');
    expect(cd3gHits).toHaveLength(0);
  });
});

describe('copyDisciplinePatterns — CD-4 labels-as-inputs', () => {
  test('catches "vs Fish ... iso"', () => {
    const r = validateCopyDiscipline(withBody('vs Fish always iso 22+.'));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-4')).toBeTruthy();
  });

  test('catches "against LAG ... 3-bet"', () => {
    const r = validateCopyDiscipline(withBody('Against LAG opens, 3-bet wider.'));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-4')).toBeTruthy();
  });

  test('whitelist exception: POKER_THEORY citation within 200 chars passes', () => {
    const r = validateCopyDiscipline(withBody(
      'Glossary entry: vs Fish iso (POKER_THEORY.md §5.5 — population annotation). Decompose to game-state inputs at decision time.'
    ));
    const cd4Hits = r.violations.filter((v) => v.rule === 'CD-4');
    expect(cd4Hits).toHaveLength(0);
  });

  test('whitelist exception fails when POKER_THEORY citation is > 200 chars away', () => {
    // ~300 chars of filler between the match and the citation
    const filler = 'lorem ipsum '.repeat(30);
    const r = validateCopyDiscipline(withBody(
      `vs Fish always iso. ${filler} POKER_THEORY.md §5.5.`
    ));
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-4')).toBeTruthy();
  });
});

describe('copyDisciplinePatterns — CD-5 unqualified assumptions', () => {
  test('passes when bodyMarkdown declares stakes + stack', () => {
    const r = validateCopyDiscipline({
      ...cleanBase,
      bodyMarkdown: '$2/$5 cash, 100bb effective; standard breakeven analysis.',
    });
    expect(r.valid).toBe(true);
  });

  test('passes "rake-agnostic" + "100bb effective" (auto-profit case)', () => {
    const r = validateCopyDiscipline(cleanBase);
    expect(r.valid).toBe(true);
  });

  test('passes "tournament" + "200BB"', () => {
    const r = validateCopyDiscipline({
      ...cleanBase,
      bodyMarkdown: 'tournament context, 200BB starting stack assumed.',
    });
    expect(r.valid).toBe(true);
  });

  test('fails when bodyMarkdown is missing stakes declaration', () => {
    const r = validateCopyDiscipline({
      ...cleanBase,
      bodyMarkdown: 'CO open: 22+, Axs+, broadway+; 100bb effective.',
    });
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-5-stakes')).toBeTruthy();
  });

  test('fails when bodyMarkdown is missing stack declaration', () => {
    const r = validateCopyDiscipline({
      ...cleanBase,
      bodyMarkdown: '$2/$5 cash standard open ranges.',
    });
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-5-stack')).toBeTruthy();
  });

  test('cd5_exempt: true with non-empty justification bypasses CD-5', () => {
    const r = validateCopyDiscipline({
      ...cleanBase,
      bodyMarkdown: 'Glossary: equity buckets (no stakes/stack scope).',
      cd5_exempt: true,
      cd5_exempt_justification: 'Glossary card — population-annotation context per CD-5 whitelist',
    });
    // Whatever fails, it should not be CD-5-stakes or CD-5-stack
    const cd5Hits = r.violations.filter((v) => v.rule === 'CD-5-stakes' || v.rule === 'CD-5-stack');
    expect(cd5Hits).toHaveLength(0);
  });

  test('cd5_exempt: true with empty justification does NOT bypass (incomplete bypass)', () => {
    const r = validateCopyDiscipline({
      ...cleanBase,
      bodyMarkdown: 'Glossary entry without scope tokens.',
      cd5_exempt: true,
      cd5_exempt_justification: '',
    });
    expect(r.valid).toBe(false);
    expect(r.violations.find((v) => v.rule === 'CD-5-stakes' || v.rule === 'CD-5-stack')).toBeTruthy();
  });
});

describe('copyDisciplinePatterns — multi-violation reporting', () => {
  test('multiple CD rules can fail simultaneously and all are enumerated', () => {
    const r = validateCopyDiscipline(withBody(
      'You must always fold. vs Fish iso 22+. Mastered this concept.'
    ));
    expect(r.valid).toBe(false);
    expect(r.violations.length).toBeGreaterThanOrEqual(3);
    const rules = new Set(r.violations.map((v) => v.rule));
    // CD-1a (you must) + CD-1b (always fold) + CD-3a (mastered) + CD-4
    expect(rules.has('CD-1a')).toBe(true);
    expect(rules.has('CD-3a')).toBe(true);
  });

  test('clean prose passes all CD checks', () => {
    const r = validateCopyDiscipline(cleanBase);
    expect(r.valid).toBe(true);
    expect(r.violations).toEqual([]);
  });
});
