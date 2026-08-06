/**
 * holeMapFreshness.test.js — the Hole Map's staleness verdict.
 *
 * What these tests are defending. The whole point of the freshness mechanism is that a
 * rendered Hole Map cannot be read as current when it is not. Three ways that guarantee could
 * silently break, and each has a test below:
 *
 *   1. A missing/unanswerable provenance quietly presenting as "current" — `null` from git
 *      collapsing into `[]`. That is the dangerous direction: the reader sees a green banner
 *      derived from an unanswered question.
 *   2. The stale banner naming a count but not the commits, so the founder learns nothing
 *      actionable and starts ignoring it.
 *   3. The stamper appending a SECOND banner when the markers are absent, so a page ends up
 *      carrying two verdicts that disagree.
 *
 * The import split below is also load-bearing and is asserted: `holeMapFreshness.mjs` must stay
 * free of `node:` imports so the eventual in-app study surface can reuse the verdict and the
 * banner rather than re-implementing them.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  classifyFreshness,
  renderFreshnessLine,
  freshnessBannerHtml,
  stampFreshnessIntoHtml,
  parseCommitLines,
  FRESHNESS_STATE,
  WATCHED_PATHS,
  REGEN_COMMAND,
  BANNER_OPEN,
  BANNER_CLOSE,
} from '../backtest/holeMapFreshness.mjs';
import { readEngineCommits, gitRun } from '../backtest/holeMapGit.mjs';

const COMMIT = 'a'.repeat(40);
const manifest = (over = {}) => ({
  engineCommit: COMMIT,
  engineDirty: false,
  generatedAt: '2026-08-05T17:41:40.251Z',
  disclaimerRegisterVersion: 'FR-1+0123456789ab',
  regenCommand: REGEN_COMMAND,
  ...over,
});

describe('classifyFreshness', () => {
  it('is current only when git answered and answered zero', () => {
    const v = classifyFreshness(manifest(), []);
    expect(v.state).toBe(FRESHNESS_STATE.CURRENT);
    expect(v.commitCount).toBe(0);
    expect(v.headline).toContain('CURRENT');
  });

  it('never reports current when git could not be asked', () => {
    // The load-bearing case. `null` (unanswerable) must not degrade into `[]` (answered zero).
    const v = classifyFreshness(manifest(), null);
    expect(v.state).toBe(FRESHNESS_STATE.UNKNOWN);
    expect(v.state).not.toBe(FRESHNESS_STATE.CURRENT);
    expect(v.headline).toContain('UNKNOWN');
  });

  it('reports unknown, not current, when the artifact names no engine commit', () => {
    const v = classifyFreshness({ generatedAt: 'x' }, []);
    expect(v.state).toBe(FRESHNESS_STATE.UNKNOWN);
    expect(v.headline).toContain('PROVENANCE MISSING');
  });

  it('reports stale and NAMES the commits when the engine moved', () => {
    const commits = [
      { sha: 'b'.repeat(40), subject: 'fix(engine): re-derive the fold curve' },
      { sha: 'c'.repeat(40), subject: 'feat(range): new population prior' },
    ];
    const v = classifyFreshness(manifest(), commits);
    expect(v.state).toBe(FRESHNESS_STATE.STALE);
    expect(v.commitCount).toBe(2);
    expect(v.headline).toContain('STALE');
    expect(v.headline).toContain('2 commits');
    expect(v.commits).toEqual(commits);
  });

  it('singularises one commit', () => {
    const v = classifyFreshness(manifest(), [{ sha: 'd'.repeat(40), subject: 's' }]);
    expect(v.headline).toContain('1 commit touching');
    expect(v.headline).not.toContain('1 commits');
  });

  it('ranks uncommitted engine changes above a commit count', () => {
    // An artifact generated with engine edits in the tree did not run the commit it stamped,
    // so counting commits since that commit would over-claim precision.
    const v = classifyFreshness(manifest({ watchedDirty: true }), [{ sha: 'e'.repeat(40), subject: 's' }]);
    expect(v.state).toBe(FRESHNESS_STATE.DIRTY_SOURCE);
    expect(v.headline).toContain('UNCOMMITTED ENGINE CHANGES');
  });

  it('ignores a whole-tree dirty flag when the watched paths are clean', () => {
    // THE SIGNAL-PRESERVING CASE. CWOS rewrites `.claude/workstream/**` on every command, so
    // `git status --porcelain` over the whole tree is dirty almost always in this repo. Keying
    // the verdict on that would fire on every artifact and train the founder to ignore it.
    const v = classifyFreshness(manifest({ engineDirty: true, watchedDirty: false }), []);
    expect(v.state).toBe(FRESHNESS_STATE.CURRENT);
  });

  it('falls back to the whole-tree flag for artifacts stamped before watchedDirty existed', () => {
    const v = classifyFreshness(manifest({ engineDirty: true, watchedDirty: undefined }), []);
    expect(v.state).toBe(FRESHNESS_STATE.DIRTY_SOURCE);
  });

  it('always carries a regeneration command, even when the manifest omits one', () => {
    const v = classifyFreshness(manifest({ regenCommand: undefined }), []);
    expect(v.regenCommand).toBe(REGEN_COMMAND);
  });
});

describe('renderFreshnessLine', () => {
  it('lists every commit and the regen command when stale', () => {
    const v = classifyFreshness(manifest(), [
      { sha: 'b'.repeat(40), subject: 'fix(engine): re-derive the fold curve' },
    ]);
    const text = renderFreshnessLine(v);
    expect(text).toContain('bbbbbbbb');
    expect(text).toContain('re-derive the fold curve');
    expect(text).toContain(REGEN_COMMAND);
    expect(text).toContain('FR-1+0123456789ab');
  });

  it('omits the regen nag when current', () => {
    expect(renderFreshnessLine(classifyFreshness(manifest(), []))).not.toContain(REGEN_COMMAND);
  });
});

describe('freshnessBannerHtml', () => {
  it('marks the state and the count on the element for assertion and styling', () => {
    const html = freshnessBannerHtml(classifyFreshness(manifest(), [
      { sha: 'b'.repeat(40), subject: 'x' }, { sha: 'c'.repeat(40), subject: 'y' },
    ]));
    expect(html).toContain('data-freshness="stale"');
    expect(html).toContain('data-commit-count="2"');
    expect(html).toContain('#451a03'); // the app's one staleness amber
  });

  it('renders green with the check glyph when current', () => {
    const html = freshnessBannerHtml(classifyFreshness(manifest(), []));
    expect(html).toContain('data-freshness="current"');
    expect(html).toContain('#052e16');
  });

  it('escapes commit subjects rather than injecting them', () => {
    const html = freshnessBannerHtml(classifyFreshness(manifest(), [
      { sha: 'b'.repeat(40), subject: '<script>alert(1)</script>' },
    ]));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows the regeneration command so refreshing is one copy-paste', () => {
    expect(freshnessBannerHtml(classifyFreshness(manifest(), []))).toContain(REGEN_COMMAND);
  });
});

describe('stampFreshnessIntoHtml', () => {
  const page = `<h1>x</h1>${BANNER_OPEN}<section>old</section>${BANNER_CLOSE}<p>body</p>`;

  it('replaces the banner in place and keeps the rest of the page', () => {
    const v = classifyFreshness(manifest(), [{ sha: 'b'.repeat(40), subject: 'moved' }]);
    const { html, replaced } = stampFreshnessIntoHtml(page, v);
    expect(replaced).toBe(true);
    expect(html).toContain('<p>body</p>');
    expect(html).not.toContain('<section>old</section>');
    expect(html).toContain('data-freshness="stale"');
    // Exactly one banner — not the old one plus a new one.
    expect(html.match(/data-freshness=/g)).toHaveLength(1);
  });

  it('refuses to append a second banner when the markers are missing', () => {
    const { html, replaced } = stampFreshnessIntoHtml('<h1>no markers</h1>', classifyFreshness(manifest(), []));
    expect(replaced).toBe(false);
    expect(html).toBe('<h1>no markers</h1>');
  });

  it('round-trips: a stamped page can be re-stamped with a new verdict', () => {
    const once = stampFreshnessIntoHtml(page, classifyFreshness(manifest(), [])).html;
    const twice = stampFreshnessIntoHtml(once, classifyFreshness(manifest(), [{ sha: 'b'.repeat(40), subject: 'z' }])).html;
    expect(twice.match(/data-freshness=/g)).toHaveLength(1);
    expect(twice).toContain('data-freshness="stale"');
  });
});

describe('parseCommitLines', () => {
  it('splits sha from subject on the first separator only', () => {
    const out = parseCommitLines(`${'b'.repeat(40)}\x1ffix(engine): a\x1fb subject`);
    expect(out).toEqual([{ sha: 'b'.repeat(40), subject: 'fix(engine): a\x1fb subject' }]);
  });

  it('drops blank lines rather than emitting empty commits', () => {
    expect(parseCommitLines(`\n${'c'.repeat(40)}\x1fx\n\n`)).toHaveLength(1);
  });

  it('returns [] for empty output — the "answered zero" case', () => {
    expect(parseCommitLines('')).toEqual([]);
    expect(parseCommitLines(null)).toEqual([]);
  });
});

describe('readEngineCommits', () => {
  // The git call is injected rather than spawned. Spawning would make these assertions measure
  // process-spawn latency under whatever else the machine is doing — the defect this repo just
  // paid to remove in `fe716f59` — and could not exercise the failure branch on demand.
  const fake = (stdout) => () => stdout;
  const throws = () => { throw new Error('fatal: bad revision'); };

  it('returns null — not [] — when git fails', () => {
    // The load-bearing case. "Could not ask" must never degrade into "asked, answered zero",
    // because the latter renders a green banner.
    expect(readEngineCommits('f'.repeat(40), { run: throws })).toBeNull();
  });

  it('returns [] when git succeeds with no commits', () => {
    expect(readEngineCommits('f'.repeat(40), { run: fake('') })).toEqual([]);
  });

  it('returns the parsed commits when git succeeds with some', () => {
    const out = readEngineCommits('f'.repeat(40), {
      run: fake(`${'b'.repeat(40)}\x1ffix(engine): fold curve\n${'c'.repeat(40)}\x1ffeat: prior`),
    });
    expect(out).toHaveLength(2);
    expect(out[1].subject).toBe('feat: prior');
  });

  it('asks git for the watched paths, and for the artifact commit', () => {
    let seen = null;
    readEngineCommits('a'.repeat(40), { paths: ['src/utils/exploitEngine'], run: (args) => { seen = args; return ''; } });
    expect(seen).toContain(`${'a'.repeat(40)}..HEAD`);
    expect(seen).toContain('src/utils/exploitEngine');
    expect(seen).toContain('--no-merges');
  });

  it('rejects a non-sha before it ever calls git', () => {
    // `HEAD` would silently mean something different tomorrow, so a manifest that stamped a
    // ref instead of a resolved sha would be unfalsifiable. The guard refuses it.
    const boom = () => { throw new Error('git should not have been called'); };
    expect(readEngineCommits('HEAD', { run: boom })).toBeNull();
    expect(readEngineCommits('unknown', { run: boom })).toBeNull();
    expect(readEngineCommits(null, { run: boom })).toBeNull();
    expect(readEngineCommits('', { run: boom })).toBeNull();
  });

  it('defaults to the real git runner when none is injected', () => {
    expect(typeof gitRun).toBe('function');
  });

  /*
   * NO TEST HERE SPAWNS GIT, DELIBERATELY.
   *
   * An earlier draft asserted the real path by running `git log HEAD..HEAD`. It passed in
   * isolation in 27ms and timed out at 5s — then at 60s — inside the full suite, because a
   * synchronous process spawn competing with the engine tests for this thread pool is starved,
   * not slow. (`gitGuardConcurrency.test.js`, the repo's other git-spawning test, fails in the
   * same runs for the same reason.) That assertion was measuring machine load, which is exactly
   * what `fe716f59` removed from two EV assertions days earlier.
   *
   * What covers the real path instead: `npm run hole-map:check` runs it end to end on every
   * invocation and is a step in `docs/runbooks/baseline-ev-run.md` §11.7. A command the founder
   * runs is a stronger guarantee than a test that fails for reasons unrelated to the code.
   */
});

describe('module boundary', () => {
  it('holeMapFreshness.mjs imports nothing from node: — the app must be able to import it', () => {
    // If this fails, the in-app study surface can no longer reuse `classifyFreshness` /
    // `freshnessBannerHtml` and will grow its own copy of the banner. Two banners that can
    // disagree about whether a readout is current is strictly worse than one.
    const src = readFileSync(
      new URL('../backtest/holeMapFreshness.mjs', import.meta.url), 'utf8',
    );
    expect(src).not.toMatch(/from\s+['"]node:/);
    expect(src).not.toMatch(/require\(\s*['"]node:/);
  });
});

describe('WATCHED_PATHS', () => {
  it('watches the engine directories whose contents move a number in the artifact', () => {
    expect(WATCHED_PATHS).toContain('src/utils/exploitEngine');
    expect(WATCHED_PATHS).toContain('src/utils/rangeEngine');
  });

  it('watches the generator itself — a change to the arithmetic stales the output too', () => {
    expect(WATCHED_PATHS).toContain('scripts/backtest/holeMap.mjs');
    expect(WATCHED_PATHS).toContain('scripts/backtest/run-hole-map.mjs');
  });

  it('does NOT watch all of src — a view change cannot move a cell, and false stale kills the signal', () => {
    expect(WATCHED_PATHS).not.toContain('src');
    expect(WATCHED_PATHS.every((p) => p !== 'src/components')).toBe(true);
  });
});
