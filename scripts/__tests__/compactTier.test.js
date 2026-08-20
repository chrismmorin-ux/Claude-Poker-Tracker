import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOOK_REL = '.claude/hooks/compact-tier.cjs';
const tier = require(path.join(REPO_ROOT, HOOK_REL));

const HEADER_MARKER = 'COMPACT TIER (generated per turn';

/** Files permitted to contain the marker: the emitter itself, and this test. */
const MARKER_ALLOWLIST = [
  HOOK_REL,
  'scripts/__tests__/compactTier.test.js',
];

/**
 * Bounded walk. The first version read EVERY file in the repo synchronously with no
 * timeout override: ~2s in isolation, and it TIMED OUT under the full 630-file suite
 * because worker contention pushed it past vitest's 5s default.
 *
 * That is the identical failure the repo fixed the same day in `fe716f59` — "stop two
 * EV assertions from measuring machine load (WS-379)" — reintroduced in new test code
 * written in the same session. A test whose result depends on how busy the machine is
 * measures the machine, not the code.
 *
 * Two changes: only file types that could plausibly hold a cached tier are read, and
 * anything large is skipped by stat before it is read. The explicit testTimeout below
 * is the belt to this braces — the walk should not need it, and gets it anyway.
 */
const TEXTISH = /\.(md|markdown|txt|ya?ml|json|jsonl|cjs|mjs|js|ts|tsx|jsx|sh|html|css)$/i;
const MAX_BYTES = 512 * 1024;

function walk(dir, acc = []) {
  // `worktrees` (2026-08-16): `.claude/worktrees/<branch>/` holds ANOTHER CHECKOUT of this same
  // repo, so each one contains its own copy of the emitter and of this test — four false
  // offenders the moment a worktree exists, and the suite went red for everyone who had one.
  //
  // This is NOT the move the block comment below forbids. Adding those copies to
  // MARKER_ALLOWLIST would be, because it would whitelist specific paths and the next cached
  // artifact would land beside them unnoticed. This is a SCOPE fix: the claim under test is
  // "no artifact in this checkout caches the tier", and a nested checkout is not this one. Its
  // copy of the hook is the emitter, already allowlisted at its own relative path.
  const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.venv', '.cwos-snapshots', 'worktrees']);
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { walk(full, acc); continue; }
    if (!TEXTISH.test(e.name)) continue;
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (st.size > MAX_BYTES) continue;   // a cached tier is ~2KB; nothing large qualifies
    acc.push(full);
  }
  return acc;
}

describe('compact tier — S2: there is no file, and that is the mechanism', () => {
  // This is the regression that matters. "We'll just cache it to a file" is the
  // exact change that reintroduces the drift the no-file design exists to make
  // impossible — two artifacts can disagree; one cannot. If this test ever fails,
  // do not update the allowlist to make it pass.
  it('no on-disk artifact contains the emitted tier', { timeout: 30000 }, () => {
    const offenders = [];
    for (const file of walk(REPO_ROOT)) {
      const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
      if (MARKER_ALLOWLIST.includes(rel)) continue;
      let text;
      try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
      if (text.includes(HEADER_MARKER)) offenders.push(rel);
    }
    expect(offenders, `compact tier was cached to disk: ${offenders.join(', ')}`).toEqual([]);
  });

  it('emits identical content for the same turn — generation is deterministic', () => {
    expect(tier.build(1).text).toBe(tier.build(1).text);
  });
});

describe('compact tier — ceiling is an invariant of the producer, not a check', () => {
  it('never exceeds the scheduled ceiling at any turn index', () => {
    for (const turn of [1, 2, 3, 5, 8, 9, 20, 60, 500]) {
      const { text, ceiling } = tier.build(turn);
      expect(Buffer.byteLength(text, 'utf8'),
        `turn ${turn} exceeded its ${ceiling}B ceiling`).toBeLessThanOrEqual(ceiling);
    }
  });

  it('DOES NOT decay with turn index — v1 did, and that was the error', () => {
    // v1 decayed 8000 -> 2000 -> 400. It rationed the per-turn channel against the
    // session-start load, which is backwards (position dominates volume), and it cut
    // the behavioural spine hardest at turn 40 — exactly where mid-session drift is
    // worst and where this session's own record shows the behaviour had to be
    // externally forced. A decaying reminder is anti-correlated with need.
    expect(tier.ceilingForTurn(1)).toBe(tier.ceilingForTurn(9));
    expect(tier.ceilingForTurn(9)).toBe(tier.ceilingForTurn(500));
  });

  it('emits the FULL rule set at turn 500 exactly as at turn 1', () => {
    const early = tier.build(1);
    const late = tier.build(500);
    const count = (r) => r.text.split('\n').filter(l => l.startsWith('- ')).length;
    expect(count(late)).toBe(count(early));
    expect(late.dropped).toBe(0);
    expect(late.text).not.toMatch(/\[dropped /);
  });

  it('still reports truncation as [dropped N] if the RULE SET ever outgrows the backstop', () => {
    // The ceiling is a backstop against unbounded growth of the rules themselves,
    // not a ration on what a session may be reminded of. Exercise it directly.
    const original = [...tier.RULES];
    try {
      for (let i = 0; i < 400; i++) {
        tier.RULES.push({
          kind: 'doctrine', anchor: 'SPR', source: '.claude/context/POKER_THEORY.md',
          text: `Filler imperative number ${i} used only to overflow the backstop ceiling here.`,
        });
      }
      const { text, ceiling, droppedDetail } = tier.build(1);
      expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(ceiling);
      expect(text).toMatch(/\[dropped \d+:/);
      // The diagnostic must not itself breach the ceiling it reports against.
      expect(droppedDetail.some((d) => d.cause === 'truncated')).toBe(true);
      // Priority is preserved: truncation stops at the first line that does not fit,
      // so no BEHAVIOUR rule may be cut while a DOCTRINE rule survives.
      const emitted = text.split('\n').filter((l) => l.startsWith('- '));
      const survivingDoctrine = tier.RULES.filter(
        (r) => r.kind === 'doctrine' && emitted.includes(`- ${r.text}`));
      const cutBehaviour = droppedDetail.filter(
        (d) => d.cause === 'truncated'
          && tier.RULES.some((r) => r.anchor === d.anchor && r.kind === 'behaviour'));
      expect(survivingDoctrine.length === 0 || cutBehaviour.length === 0).toBe(true);
    } finally {
      tier.RULES.length = 0;
      tier.RULES.push(...original);
    }
  });
});

describe('compact tier — turn counting (the defect that silently disabled the schedule)', () => {
  // Found live, not by reading code: the naive `"type":"user"` count read 132 against
  // an actual 2, because every TOOL RESULT is also stored as a type:"user" record.
  // That drove the ceiling to its 400-byte floor inside the first founder turn, so the
  // 8,000-byte head — the whole point of the decay curve — never applied.
  const tmp = path.join(REPO_ROOT, 'scripts', '__tests__', '.tmp-transcript.jsonl');

  const write = (records) =>
    fs.writeFileSync(tmp, records.map(r => JSON.stringify(r)).join('\n'), 'utf8');

  afterEach(() => { try { fs.unlinkSync(tmp); } catch { /* already gone */ } });

  it('counts founder prompts and ignores tool-result records', () => {
    write([
      { type: 'user', message: { role: 'user', content: 'first real prompt' } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] } },
      // tool results — also type:"user", content is an ARRAY. Must not count.
      { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'a', content: 'x' }] } },
      { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'b', content: 'y' }] } },
      { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c', content: 'z' }] } },
      { type: 'user', message: { role: 'user', content: 'second real prompt' } },
    ]);
    expect(tier.turnIndex(tmp)).toBe(2);
  });

  it('ignores isMeta records', () => {
    write([
      { type: 'user', isMeta: true, message: { role: 'user', content: 'system noise' } },
      { type: 'user', message: { role: 'user', content: 'the only real turn' } },
    ]);
    expect(tier.turnIndex(tmp)).toBe(1);
  });

  it('a transcript of pure tool results is still turn 1, never turn N', () => {
    write(Array.from({ length: 40 }, (_, i) => ({
      type: 'user',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `t${i}`, content: 'x' }] },
    })));
    expect(tier.turnIndex(tmp)).toBe(1);
    // and therefore still gets the full head ceiling
    expect(tier.ceilingForTurn(tier.turnIndex(tmp))).toBe(8000);
  });

  it('fails open to turn 1 (the LARGER ceiling) on a missing transcript', () => {
    expect(tier.turnIndex(path.join(REPO_ROOT, 'does', 'not', 'exist.jsonl'))).toBe(1);
    expect(tier.turnIndex(undefined)).toBe(1);
  });
});

describe('compact tier — S4: no re-measurable magnitude', () => {
  it('emits no decimal, percentage, or parameter assignment', () => {
    for (const turn of [1, 5, 20]) {
      for (const line of tier.build(turn).text.split('\n')) {
        expect(/\d+\.\d/.test(line), `decimal in: ${line}`).toBe(false);
        expect(/\d\s*%/.test(line), `percentage in: ${line}`).toBe(false);
        expect(/[A-Za-z_]\w*\s*=\s*-?\d/.test(line), `assignment in: ${line}`).toBe(false);
      }
    }
  });

  it('still admits integer ledger counters, which S5 requires', () => {
    // `falsified 1x` is a ledger fact, not a quantity anyone can re-measure.
    expect(tier.violatesMagnitudeRule('taxonomy: falsified 1x')).toBe(false);
    expect(tier.violatesMagnitudeRule('coverage is 94.2 percent')).toBe(true);
    expect(tier.violatesMagnitudeRule('set lambda = 0')).toBe(true);
    expect(tier.violatesMagnitudeRule('the rate is 62%')).toBe(true);
  });
});

describe('compact tier — S3: imperatives, not names', () => {
  const lines = () => tier.build(1).text.split('\n').filter(l => l.startsWith('- '));

  it('emits no bare term list', () => {
    for (const line of lines()) {
      const body = line.replace(/^- /, '');
      // A bare list: mostly commas, few verbs, short segments.
      const segments = body.split(',');
      const isList = segments.length >= 4 && segments.every(s => s.trim().split(/\s+/).length <= 3);
      expect(isList, `bare term list: ${line}`).toBe(false);
    }
  });

  it('every line is a sentence, not a label', () => {
    for (const line of lines()) {
      const body = line.replace(/^- /, '');
      expect(body.split(/\s+/).length, `too short to be an imperative: ${line}`).toBeGreaterThanOrEqual(8);
      expect(body.trim().endsWith('.'), `not a sentence: ${line}`).toBe(true);
    }
  });
});

describe('compact tier — S5: never a digest', () => {
  // The repo's own controlled experiment: POKER_THEORY section 8 "Common Mistakes"
  // is the only top-level section with zero external citations, and it is a digest
  // of sections drawing 132 and 156 citations. Readers cite the source, never the
  // summary. So every emitted line must carry something the heavy tier does NOT
  // have, rather than less of what it does.
  const HEAVY = ['.claude/context/POKER_THEORY.md', 'CLAUDE.md'];

  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  it('no emitted line is a substring-equivalent of any heavy-tier line', () => {
    const heavyText = HEAVY
      .map(f => { try { return fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'); } catch { return ''; } })
      .join('\n');
    const heavyNorm = norm(heavyText);

    for (const line of tier.build(1).text.split('\n').filter(l => l.startsWith('- '))) {
      const body = norm(line.replace(/^- /, ''));
      expect(heavyNorm.includes(body), `line is copied from the heavy tier: ${line}`).toBe(false);
    }
  });
});

describe('compact tier — S2: every term is verified against its source at emit time', () => {
  it('every rule anchor currently resolves in the file it names', () => {
    const unresolved = [];
    for (const rule of tier.RULES) {
      let src;
      try { src = fs.readFileSync(path.join(REPO_ROOT, rule.source), 'utf8'); } catch { src = null; }
      if (src === null || !src.includes(rule.anchor)) unresolved.push(`${rule.anchor} -> ${rule.source}`);
    }
    // A failure here is a real signal, not a broken test: the doctrine moved and the
    // tier is now injecting a claim its source no longer makes.
    expect(unresolved, `anchors no longer resolve: ${unresolved.join(', ')}`).toEqual([]);
  });

  it('drops a rule whose anchor has vanished rather than emitting it unverified', () => {
    const original = [...tier.RULES];
    tier.RULES.push({
      kind: 'doctrine', anchor: 'ZZZ_ANCHOR_THAT_CANNOT_EXIST_ZZZ',
      source: '.claude/context/POKER_THEORY.md',
      text: 'This line must never be emitted because its anchor does not resolve.',
    });
    try {
      const { text, dropped, droppedDetail } = tier.build(1);
      expect(dropped).toBeGreaterThan(0);
      expect(text).not.toContain('must never be emitted');
      expect(text).toMatch(/\[dropped \d+:/);

      // The drop must NAME itself. A bare count is what let a kit upgrade silently
      // withhold a HARD RESTRICTION for part of a session on 2026-08-06: the tier
      // printed `[dropped 2]` and nothing in the window said which two.
      const rec = droppedDetail.find((d) => d.anchor === 'ZZZ_ANCHOR_THAT_CANNOT_EXIST_ZZZ');
      expect(rec).toBeTruthy();
      expect(rec.cause).toBe('anchor-missing');
      expect(rec.id).toBe('POKER_THEORY.md:"ZZZ_ANCHOR_THAT_CANNOT_EXIST_ZZZ"');
      expect(text).toContain('POKER_THEORY.md:"ZZZ_ANCHOR_THAT_CANNOT_EXIST_ZZZ" anchor-missing');
    } finally {
      tier.RULES.length = 0;
      tier.RULES.push(...original);
    }
  });

  it('distinguishes the three drop causes rather than pooling them into one count', () => {
    // "The doctrine moved" and "someone wrote a percentage into a rule" are unrelated
    // failures with unrelated fixes. A single `dropped` counter cannot tell them apart,
    // so neither could a reader of the emitted tier.
    const original = [...tier.RULES];
    tier.RULES.push(
      { kind: 'doctrine', anchor: 'ZZZ_GONE_ZZZ', source: '.claude/context/POKER_THEORY.md',
        text: 'Anchor absent from a source that exists.' },
      { kind: 'doctrine', anchor: 'SPR', source: '.claude/context/POKER_THEORY.md',
        text: 'This rule states a fold frequency of 41.5% and must be refused.' },
      { kind: 'doctrine', anchor: 'anything', source: 'no/such/file/ZZZ.md',
        text: 'This rule names a source that cannot be read at all.' },
    );
    try {
      const { droppedDetail } = tier.build(1);
      const causeOf = (anchor) => (droppedDetail.find((d) => d.anchor === anchor) || {}).cause;
      expect(causeOf('ZZZ_GONE_ZZZ')).toBe('anchor-missing');
      expect(causeOf('anything')).toBe('source-unreadable');
      const magnitude = droppedDetail.filter((d) => d.cause === 'magnitude');
      expect(magnitude.length).toBe(1);
      expect(magnitude[0].source).toBe('.claude/context/POKER_THEORY.md');
    } finally {
      tier.RULES.length = 0;
      tier.RULES.push(...original);
    }
  });
});
