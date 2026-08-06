import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const { CLASSES, CATALOGUE } = require(path.join(REPO_ROOT, 'scripts/context/enforcement-classes.cjs'));

describe('S9 — every check declares its class AND the argument for it', () => {
  it('every entry names a real class and a real clause', () => {
    const valid = new Set(Object.values(CLASSES));
    for (const e of CATALOGUE) {
      expect(valid.has(e.class), `${e.check}: unknown class "${e.class}"`).toBe(true);
      expect([1, 2, 3]).toContain(e.clause);
    }
  });

  it('class and clause agree — a mismatch is a finding about the RULE, not a typo', () => {
    const expected = { 1: CLASSES.BLOCK, 2: CLASSES.FAIL, 3: CLASSES.WARN };
    for (const e of CATALOGUE) {
      expect(e.class,
        `${e.check} is class "${e.class}" but cites clause ${e.clause}. Either the class is wrong or the rule does not cover this check — the second is a finding about the rule.`
      ).toBe(expected[e.clause]);
    }
  });

  it('every entry argues its class rather than asserting it', () => {
    for (const e of CATALOGUE) {
      expect(e.why, `${e.check} has no argument`).toBeTruthy();
      // An argument, not a label. Short strings here are how "warn" quietly becomes
      // the default for everything.
      expect(e.why.split(/\s+/).length,
        `${e.check}: argument is too thin to be an argument`).toBeGreaterThanOrEqual(12);
    }
  });

  it('the file each check claims to live in exists', () => {
    for (const e of CATALOGUE) {
      const file = e.where.split(' ')[0];
      expect(fs.existsSync(path.join(REPO_ROOT, file)), `${e.check}: missing ${file}`).toBe(true);
    }
  });

  /**
   * Strip comments before scanning for blocking behaviour.
   *
   * Found the hard way: this suite first reported the bundle validator as "catalogued
   * as WARN but exits 2 somewhere". It does not. The match was inside the file's own
   * header, in a sentence DESCRIBING git-guard.cjs:276. A grep over source text that
   * includes prose is not a check on behaviour.
   */
  const codeOf = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/^\s*#(?!!).*$/gm, ' ');

  /**
   * THERE ARE TWO BLOCKING MECHANISMS AND THEY ARE NOT INTERCHANGEABLE.
   * Also found the hard way: this suite claimed retreat-detector.cjs "never exits 2".
   * Correct, and irrelevant — it is a STOP hook, and Stop hooks block by writing
   * {"decision":"block"} and exiting 0. Only PreToolUse blocks with exit code 2.
   * Asserting one mechanism would have forced a real blocker to be mislabelled WARN.
   */
  const blocks = (src) =>
    /process\.exit\(2\)/.test(src) ||
    /decision['"]?\s*:\s*['"]block['"]/.test(src);

  it('the irreversible-act blockers really do block, by either mechanism', () => {
    const blockers = CATALOGUE.filter(e => e.class === CLASSES.BLOCK);
    expect(blockers.length).toBeGreaterThan(0);
    for (const e of blockers) {
      const file = e.where.split(' ')[0];
      expect(blocks(codeOf(file)),
        `${e.check} is catalogued as BLOCK but ${file} neither exits 2 nor emits decision:block`
      ).toBe(true);
    }
  });

  it('warn-class checks do not secretly block', () => {
    for (const e of CATALOGUE.filter(x => x.class === CLASSES.WARN)) {
      const file = e.where.split(' ')[0];
      expect(blocks(codeOf(file)),
        `${e.check} is catalogued as WARN but ${file} blocks`).toBe(false);
    }
  });

  it('all three clauses are actually used — the rule is a union, not a favourite', () => {
    const used = new Set(CATALOGUE.map(e => e.class));
    expect(used.has(CLASSES.BLOCK)).toBe(true);
    expect(used.has(CLASSES.FAIL)).toBe(true);
    expect(used.has(CLASSES.WARN)).toBe(true);
  });
});
