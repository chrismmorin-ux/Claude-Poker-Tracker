/**
 * guideLedger.test.js — WS-519 / prog-guide-authority.
 *
 * THE HOLE THIS FILLS. check-guide-ledger.mjs shipped wired into both
 * scripts/smart-test-runner.sh and .github/workflows/ci.yml with no test, while both of
 * its siblings (check-additive, check-label-ledger) carry one. A gate nobody has watched
 * fail is indistinguishable from a gate that cannot fail, and the repo has already paid
 * for that distinction once: FIND-086 / WS-431 records the Standard-of-Record additive
 * gate existing since WS-329 and being wired NOWHERE, so "registering a schema bought
 * nothing". Wiring fixes reach; only an executed failure fixes trust.
 *
 * SO EVERY TEST BELOW DRIVES A VIOLATION, NOT A PASS. The green path is asserted exactly
 * once (`a well-formed derived Guide`), and its job is to prove the fixtures are not
 * failing for an incidental reason — if that test ever goes red, every red test under it
 * stops meaning anything.
 *
 * THE LOAD-BEARING TESTS ARE the §INERT and ORPHANED LEDGER ROW blocks. Everything else
 * guards conformance, and a conformance-only monitor is the failure the gate's own header
 * names: a standard with zero instances passes every conformance check and prints a green
 * tick. Those two are the ones that fire when the gate is going green BY GOING BLIND.
 */

import { describe, it, expect } from 'vitest';

import {
  compare,
  readStanding,
  SLOTS,
  EXCLUSION_REASONS,
  UNTRIAGED_MAX_DAYS,
  AS732_ROWS,
  AS732_MIN_QUEUE_REFS,
} from '../standardOfRecord/check-guide-ledger.mjs';

const KEY = 'docs/guides/g1.md';

/** A conditioning block with every one of the five slots CLOSED. */
const closedConditioning = () => ({
  game: 'live-1-2-9-handed',
  position: 'BTN',
  subject: '99-TT-JJ',
  field: 'measured-2009-online',
  geometry: 'single-raised-pot',
});

/** A standing block that violates nothing, so each test can vary exactly one thing. */
const standing = (over = {}) => ({
  authority: 'derived',
  conditioning: closedConditioning(),
  marginalizes_over: [],
  weighting: null,
  census: { unexamined: 3 },
  ...over,
});

const row = (over = {}) => ({
  key: KEY,
  standing: standing(),
  standingPresent: true,
  parseError: null,
  sections: [0, 1, 2, 3, 4, 5, 6],
  ...over,
});

const ledgered = (over = {}) => ({ [KEY]: { ledger: 'GUIDE:g1' }, ...over });

/** Every test that is not specifically about AS-732 pins refs above the threshold. */
const refsOk = () => AS732_MIN_QUEUE_REFS;

const text = (v) => v.violations.join('\n');

// ─────────────────────────────────────────────────────────────────────────────

describe('the green path (fixture sanity — if this reds, nothing below means anything)', () => {
  it('a well-formed derived Guide produces zero violations', () => {
    const v = compare(ledgered(), [row()], refsOk);
    expect(v.violations).toEqual([]);
    expect(v.guides).toHaveLength(1);
    expect(v.derived).toHaveLength(1);
    expect(v.totalUnexamined).toBe(3);
  });
});

describe('the anti-rot core — --update records a document, it never decides one', () => {
  // The single property that keeps the ledger from going green by re-snapshotting.
  it('a null ledger is itself a violation', () => {
    const v = compare({ [KEY]: { ledger: null } }, [row()], refsOk);
    expect(text(v)).toMatch(/UNDECIDED DOCUMENT/);
  });

  it('a document absent from the baseline entirely is also UNDECIDED, not ignored', () => {
    const v = compare({}, [row()], refsOk);
    expect(text(v)).toMatch(/UNDECIDED DOCUMENT/);
  });
});

describe('exclusions are recorded judgments, so the vocabulary is closed', () => {
  it('rejects a reason outside EXCLUSION_REASONS', () => {
    const v = compare({ [KEY]: { ledger: 'EXCLUDED:because-i-said-so' } }, [row()], refsOk);
    expect(text(v)).toMatch(/EXCLUSION MALFORMED/);
  });

  it('accepts every reason inside it', () => {
    for (const reason of EXCLUSION_REASONS) {
      const base = { [KEY]: { ledger: `EXCLUDED:${reason}` } };
      // `not-yet-triaged` alone carries the extra ticket obligation asserted below.
      if (reason === 'not-yet-triaged') {
        base[KEY].ticket = 'WS-519';
        base[KEY].since = new Date().toISOString();
      }
      const v = compare(base, [row()], refsOk);
      expect(text(v)).not.toMatch(/EXCLUSION MALFORMED/);
    }
  });

  it('"not-yet-triaged" with no ticket is malformed — a promise with no owner is not one', () => {
    const v = compare({ [KEY]: { ledger: 'EXCLUDED:not-yet-triaged' } }, [row()], refsOk);
    expect(text(v)).toMatch(/EXCLUSION MALFORMED/);
    expect(text(v)).toMatch(/no ticket/);
  });

  it(`expires after ${UNTRIAGED_MAX_DAYS} days — an exception that never expires becomes the register`, () => {
    const v = compare(
      { [KEY]: { ledger: 'EXCLUDED:not-yet-triaged', ticket: 'WS-519', since: '2000-01-01' } },
      [row()],
      refsOk,
    );
    expect(text(v)).toMatch(/STALE EXCLUSION/);
  });

  it('does NOT expire while inside the window — the deadline is real in both directions', () => {
    const fresh = new Date(Date.now() - (UNTRIAGED_MAX_DAYS - 5) * 86_400_000).toISOString();
    const v = compare(
      { [KEY]: { ledger: 'EXCLUDED:not-yet-triaged', ticket: 'WS-519', since: fresh } },
      [row()],
      refsOk,
    );
    expect(text(v)).not.toMatch(/STALE EXCLUSION/);
  });
});

describe('a document claiming to be a Guide is bound by the form', () => {
  it('rejects a ledger that is neither GUIDE: nor EXCLUDED:', () => {
    const v = compare({ [KEY]: { ledger: 'maybe later' } }, [row()], refsOk);
    expect(text(v)).toMatch(/LEDGER MALFORMED/);
  });

  it('flags a missing guide-standing block — the monitor reads data, never prose', () => {
    const v = compare(ledgered(), [row({ standingPresent: false, standing: null })], refsOk);
    expect(text(v)).toMatch(/STANDING BLOCK MISSING/);
  });

  it('flags an unparseable standing block rather than silently skipping it', () => {
    const v = compare(
      ledgered(),
      [row({ standing: null, parseError: 'Unexpected token }' })],
      refsOk,
    );
    expect(text(v)).toMatch(/STANDING BLOCK UNPARSEABLE/);
  });

  it.each(SLOTS)('flags %s omitted from the conditioning block entirely', (slot) => {
    const cond = closedConditioning();
    delete cond[slot];
    const v = compare(ledgered(), [row({ standing: standing({ conditioning: cond }) })], refsOk);
    expect(text(v)).toMatch(/UNDECLARED SLOT/);
    expect(text(v)).toMatch(new RegExp(slot));
  });

  it('an explicit null is NOT an undeclared slot — declaring it open is the sanctioned move', () => {
    const cond = { ...closedConditioning(), position: null };
    const v = compare(
      ledgered(),
      [row({
        standing: standing({
          conditioning: cond,
          weighting: 'frequency',
          marginalizes_over: ['BTN', 'CO'],
        }),
      })],
      refsOk,
    );
    expect(text(v)).not.toMatch(/UNDECLARED SLOT/);
  });

  it('flags a missing required section — a Guide missing one is not a shorter Guide', () => {
    const v = compare(ledgered(), [row({ sections: [0, 1, 2, 3, 4, 5] })], refsOk);
    expect(text(v)).toMatch(/MISSING REQUIRED SECTION/);
    expect(text(v)).toMatch(/§6/);
  });
});

describe('THE SLOT RULE — a word may leave a title only if the guide pays for it', () => {
  // The program's namesake violation, and the WS-291 mechanism reached by deletion:
  // the general claim wearing the specific claim's credibility.
  const openSlot = (over = {}) => standing({
    conditioning: { ...closedConditioning(), position: null },
    ...over,
  });

  it('an open slot with no weighting is a dropped slot', () => {
    const v = compare(ledgered(), [row({ standing: openSlot({ weighting: null }) })], refsOk);
    expect(text(v)).toMatch(/SLOT DROPPED WITHOUT WEIGHTING/);
  });

  it('an open slot with a weighting but no marginalizes_over set is still dropped', () => {
    const v = compare(
      ledgered(),
      [row({ standing: openSlot({ weighting: 'frequency', marginalizes_over: [] }) })],
      refsOk,
    );
    expect(text(v)).toMatch(/SLOT DROPPED WITHOUT WEIGHTING/);
  });

  it('paying BOTH halves clears it', () => {
    const v = compare(
      ledgered(),
      [row({ standing: openSlot({ weighting: 'frequency', marginalizes_over: ['BTN', 'CO'] }) })],
      refsOk,
    );
    expect(text(v)).not.toMatch(/SLOT DROPPED/);
  });

  it('the register defines exactly two weightings', () => {
    const v = compare(
      ledgered(),
      [row({ standing: openSlot({ weighting: 'vibes', marginalizes_over: ['BTN'] }) })],
      refsOk,
    );
    expect(text(v)).toMatch(/WEIGHTING UNKNOWN/);
  });

  it('an authored root is exempt from the slot rule — that is its one privilege', () => {
    const v = compare(
      ledgered(),
      [row({ standing: openSlot({ authority: 'authored-root', weighting: null }) })],
      refsOk,
    );
    expect(text(v)).not.toMatch(/SLOT DROPPED/);
  });
});

describe('the Census refuses to collapse a zero into one fact', () => {
  it('flags an absent unexamined count', () => {
    const v = compare(ledgered(), [row({ standing: standing({ census: {} }) })], refsOk);
    expect(text(v)).toMatch(/CENSUS INCOMPLETE/);
  });

  it('flags a claim of total coverage — a guide that looked everywhere has not looked', () => {
    const v = compare(
      ledgered(),
      [row({ standing: standing({ census: { unexamined: 0 } }) })],
      refsOk,
    );
    expect(text(v)).toMatch(/CENSUS CLAIMS TOTAL COVERAGE/);
  });
});

describe('going green BY GOING BLIND — the two that catch a regressed harvest', () => {
  it('ORPHANED LEDGER ROW: a baseline row whose document vanished', () => {
    const v = compare(
      { ...ledgered(), 'docs/guides/deleted.md': { ledger: 'GUIDE:gone' } },
      [row()],
      refsOk,
    );
    expect(text(v)).toMatch(/ORPHANED LEDGER ROW/);
    expect(text(v)).toMatch(/go green by going blind/i);
  });

  it('__meta is not mistaken for a document', () => {
    const v = compare({ ...ledgered(), __meta: { inert_owner: 'WS-519' } }, [row()], refsOk);
    expect(text(v)).not.toMatch(/ORPHANED LEDGER ROW/);
  });

  it('§INERT: zero derived instances past the grace deadline FAILS', () => {
    const base = { ...ledgered(), __meta: { inert_deadline: '2000-01-01', inert_owner: 'WS-519' } };
    const v = compare(base, [row({ standing: standing({ authority: 'authored-root' }) })], refsOk);
    expect(text(v)).toMatch(/STANDARD INERT/);
    expect(v.derived).toHaveLength(0);
  });

  it('§INERT does NOT fire while the grace period is open', () => {
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const base = { ...ledgered(), __meta: { inert_deadline: future, inert_owner: 'WS-519' } };
    const v = compare(base, [row({ standing: standing({ authority: 'authored-root' }) })], refsOk);
    expect(text(v)).not.toMatch(/STANDARD INERT/);
  });

  it('§INERT does NOT fire once a derived instance exists', () => {
    const base = { ...ledgered(), __meta: { inert_deadline: '2000-01-01', inert_owner: 'WS-519' } };
    const v = compare(base, [row()], refsOk);
    expect(text(v)).not.toMatch(/STANDARD INERT/);
  });
});

describe('the root exemption is capped at one', () => {
  it('a second authored root is the slot rule with an opt-out', () => {
    const k2 = 'docs/guides/g2.md';
    const base = { [KEY]: { ledger: 'GUIDE:g1' }, [k2]: { ledger: 'GUIDE:g2' } };
    const rows = [
      row({ standing: standing({ authority: 'authored-root' }) }),
      row({ key: k2, standing: standing({ authority: 'authored-root' }) }),
    ];
    const v = compare(base, rows, refsOk);
    expect(text(v)).toMatch(/MULTIPLE AUTHORED ROOTS/);
  });
});

describe('AS-732 is EXECUTED, not described', () => {
  // The founder ruled that holes become the work queue. This asserts that they are.
  const manyHoles = () => row({ standing: standing({ census: { unexamined: AS732_ROWS + 5 } }) });

  it('fires when the holes outnumber the items working them', () => {
    const v = compare(ledgered(), [manyHoles()], () => AS732_MIN_QUEUE_REFS - 1);
    expect(text(v)).toMatch(/AS-732 FALSIFIED/);
    expect(v.totalUnexamined).toBe(AS732_ROWS + 5);
  });

  it('does NOT fire once enough items reference them — the threshold is real', () => {
    const v = compare(ledgered(), [manyHoles()], () => AS732_MIN_QUEUE_REFS);
    expect(text(v)).not.toMatch(/AS-732 FALSIFIED/);
  });

  it('does NOT fire below the row threshold regardless of queue refs', () => {
    const v = compare(ledgered(), [row()], () => 0);
    expect(text(v)).not.toMatch(/AS-732 FALSIFIED/);
  });
});

describe('readStanding parses declared data, never prose', () => {
  it('extracts a fenced guide-standing block', () => {
    const doc = ['# G', '', '```guide-standing', '{ "authority": "derived" }', '```', ''].join('\n');
    const r = readStanding(doc);
    expect(r.present).toBe(true);
    expect(r.parseError).toBeNull();
    expect(r.standing).toEqual({ authority: 'derived' });
  });

  it('reports absence rather than inventing a default', () => {
    const r = readStanding('# G\n\nThis guide uses a frequency weighting, honest.\n');
    expect(r.present).toBe(false);
    expect(r.standing).toBeNull();
  });

  it('reports a parse error rather than silently returning null standing', () => {
    const doc = ['```guide-standing', '{ not json ]', '```'].join('\n');
    const r = readStanding(doc);
    expect(r.present).toBe(true);
    expect(r.standing).toBeNull();
    expect(r.parseError).toBeTruthy();
  });

  it('does not match a prose mention of the word weighting', () => {
    const r = readStanding('The weighting here is deliberately NOT declared.\n');
    expect(r.present).toBe(false);
  });
});
