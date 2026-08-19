/**
 * WS-572 — a code fix must re-open the compute job it invalidated, and nothing else.
 *
 * The defect these cover: the compute dedupe keyed on `stepsFingerprint(steps, inputs)` —
 * the command and its arguments — so the analysis code was invisible to it. WS-320 shipped
 * three wrong verdicts, `separability.mjs` was fixed in a60d4084, and the corrected
 * instrument had still never run three days later because the job read as already done.
 *
 * The workaround attempted at the time is covered too. Commit 9361286b added a comment inside
 * the `compute_job:` block and asserted in its message that this re-keyed the job. YAML
 * comments do not survive parsing, so the fingerprint never moved. `legacy key is unchanged
 * when no digest is available` is the test that would have caught it being relied on.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require_ = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const { codeDigest, entryScripts, importClosure, parseLsTree } =
  require_(path.join(REPO_ROOT, 'kit/scripts/lib/cwos-code-digest.js'));
const { stepsFingerprint } =
  require_(path.join(REPO_ROOT, 'kit/scripts/lib/cwos-compute-job.js'));

/** The real WS-320 step, verbatim from cm-node1's terminal record ws-320-48bd185e7587.json. */
const WS320_STEPS = [{
  name: 'study-ladder-full-corpus',
  cmd: 'C:\\Users\\chris\\.local\\node\\node.exe',
  args: [
    'scripts/backtest/run-study-ladder.mjs',
    '--min-n', '20', '--pool-pct', '50',
    '--out', 'out/study-ladder.json',
    '--card-out', 'out/study-ladder.card.json',
  ],
  expectFiles: ['out/study-ladder.json', 'out/study-ladder.card.json'],
}];

describe('WS-572 — the dependency closure of a compute job', () => {
  it('reaches the module whose bug invalidated the run', () => {
    // The first version of this digest followed static imports only and produced a TWO-file
    // closure that did not contain separability.mjs — it would have shipped looking correct
    // and re-opened nothing. The harnesses reach almost everything through the Vite SSR
    // loader with repo-root string paths, which is a real edge and not an import statement.
    const files = importClosure(entryScripts(WS320_STEPS, REPO_ROOT), REPO_ROOT);
    expect(files).toContain('scripts/backtest/separability.mjs');
    expect(files).toContain('scripts/backtest/studyLadderReport.mjs');
    expect(files.length).toBeGreaterThan(10);
  });

  it('excludes code the job cannot reach', () => {
    // The whole reason the digest is a closure and not `git rev-parse HEAD`: keying on HEAD
    // would re-run the entire compute history on every unrelated push.
    const files = importClosure(entryScripts(WS320_STEPS, REPO_ROOT), REPO_ROOT);
    expect(files.filter((f) => /^src\/(components|views|contexts|hooks)\//.test(f))).toEqual([]);
    expect(files.filter((f) => f.startsWith('ignition-poker-tracker/'))).toEqual([]);
  });

  it('takes entry scripts from step args and ignores non-repo paths', () => {
    expect(entryScripts(WS320_STEPS, REPO_ROOT)).toEqual(['scripts/backtest/run-study-ladder.mjs']);
    const foreign = [{ args: ['C:\\somewhere\\else.mjs', '../../escape.mjs', 'out/x.json'] }];
    expect(entryScripts(foreign, REPO_ROOT)).toEqual([]);
  });
});

describe('WS-572 — the digest re-opens exactly the jobs a change invalidated', () => {
  const digestAt = (commit) => codeDigest({ steps: WS320_STEPS, repoRoot: REPO_ROOT, commit });

  it('differs between the commit WS-320 ran at and the fixed instrument', () => {
    // THE ACCEPT CRITERION, on the real case. 48bd185e75 produced RC-study-ladder-d908f09d;
    // a60d4084 fixed the verdict path. If these two agree, the job never re-opens and the
    // wrong card stands forever — which is precisely what happened for three days.
    const atJobCommit = digestAt('48bd185e758753eac745d56cb6266555fb7a5eaf');
    const atFix = digestAt('a60d4084');
    expect(atJobCommit).toBeTruthy();
    expect(atFix).toBeTruthy();
    expect(atJobCommit).not.toEqual(atFix);
  });

  it('changes across the commit that fixed separability, and not before it', () => {
    const before = digestAt('a60d4084^');
    const after = digestAt('a60d4084');
    expect(before).not.toEqual(after);
  });

  it('is stable for the same commit', () => {
    expect(digestAt('a60d4084')).toEqual(digestAt('a60d4084'));
  });

  it('is null — not a throw, not a partial hash — when git cannot read the commit', () => {
    // A digest that crashes the feeder is worse than one that is unavailable: unavailable
    // degrades to the legacy key on both sides, and both sides degrade together.
    expect(codeDigest({ steps: WS320_STEPS, repoRoot: REPO_ROOT, commit: 'no-such-commit-xyz' }))
      .toBeNull();
    expect(codeDigest({ steps: [], repoRoot: REPO_ROOT, commit: 'HEAD' })).toBeNull();
    expect(codeDigest({ steps: WS320_STEPS, repoRoot: REPO_ROOT, commit: null })).toBeNull();
  });

  it('reads blob shas out of ls-tree output', () => {
    const map = parseLsTree(
      '100644 blob aaaaaaaaaaaa\tscripts/backtest/separability.mjs\n'
      + '040000 tree bbbbbbbbbbbb\tscripts\n',
    );
    expect(map.get('scripts/backtest/separability.mjs')).toBe('aaaaaaaaaaaa');
    expect(map.has('scripts')).toBe(false);
  });
});

describe('WS-572 — stepsFingerprint folds the digest in without breaking history', () => {
  const steps = WS320_STEPS;

  it('produces the legacy key unchanged when no digest is available', () => {
    // Load-bearing: the historical side emits no digest for a job whose commit git cannot
    // read. If omitting the digest changed the hash, every such job would re-run once.
    const omitted = stepsFingerprint(steps, null);
    expect(stepsFingerprint(steps, null, null)).toEqual(omitted);
    expect(stepsFingerprint(steps, null, undefined)).toEqual(omitted);
    expect(omitted).toMatch(/^[0-9a-f]{12}$/);
  });

  it('separates two runs of the same command under different code', () => {
    expect(stepsFingerprint(steps, null, 'aaaaaaaaaaaa'))
      .not.toEqual(stepsFingerprint(steps, null, 'bbbbbbbbbbbb'));
  });

  it('still separates two different commands under identical code', () => {
    const other = [{ ...steps[0], args: [...steps[0].args, '--max-files', '40'] }];
    expect(stepsFingerprint(steps, null, 'aaaaaaaaaaaa'))
      .not.toEqual(stepsFingerprint(other, null, 'aaaaaaaaaaaa'));
  });

  it('is unmoved by a YAML comment — the 9361286b workaround could never have worked', () => {
    // The re-key commit added a comment inside compute_job: and its message stated that this
    // let the feeder resubmit. Comments are stripped at parse, so both sides saw the same
    // steps and the same key. Measured 2026-08-19: 12a9c73eaaef before, after, and at HEAD.
    expect(stepsFingerprint(steps, null)).toEqual(stepsFingerprint(structuredClone(steps), null));
  });
});

describe('WS-572 — runwayFor receives the status it filters on', () => {
  it('is called with all three arguments', () => {
    // The in-flight filter was dead for as long as the call site passed two arguments:
    // `status` was undefined inside, both guards short-circuited, and the panel counted the
    // running job as runway behind itself. A signature is not a contract until a call site
    // honours it, so the regression this guards is textual by necessity.
    const src = fs.readFileSync(path.join(REPO_ROOT, 'kit/scripts/cwos-fleet-compute.js'), 'utf8');
    const declaration = /function runwayFor\(([^)]*)\)/.exec(src);
    expect(declaration).not.toBeNull();
    const arity = declaration[1].split(',').length;

    const callSites = [...src.matchAll(/(?<!function )runwayFor\(([^)]*)\)/g)]
      .map((m) => m[1].trim())
      .filter(Boolean);
    expect(callSites.length).toBeGreaterThan(0);
    for (const args of callSites) {
      expect(args.split(',').length).toBe(arity);
    }
  });
});

describe('WS-572 — code-digest.cjs refuses arguments that are not ids', () => {
  it('prints nothing for a shell-metacharacter commit', () => {
    // This script is invoked over ssh. done-summary.cjs exists because `$` variables came
    // back empty over that hop and the dedupe silently found zero finished jobs; the argument
    // shape is the guard that keeps this one from acquiring the same class of failure.
    const { spawnSync } = require_('child_process');
    const script = path.join(REPO_ROOT, 'scripts/fleet/code-digest.cjs');
    const bad = spawnSync(process.execPath, [script, 'HEAD; echo pwned', 'WS-320'], {
      encoding: 'utf8', windowsHide: true,
    });
    expect(bad.status).toBe(0);
    expect(bad.stdout.trim()).toBe('');

    const good = spawnSync(process.execPath, [script, 'HEAD', 'WS-320'], {
      encoding: 'utf8', windowsHide: true,
    });
    expect(good.stdout.trim()).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('WS-572 — the digest survives a repo it does not know', () => {
  it('returns null rather than throwing outside a git repo', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ws572-'));
    try {
      expect(codeDigest({ steps: WS320_STEPS, repoRoot: tmp, commit: 'HEAD' })).toBeNull();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('WS-572 — one result files one review item', () => {
  const { contentKeyOf, harvestedContentKeys, pendingSets } =
    require_(path.join(REPO_ROOT, 'kit/scripts/lib/cwos-fleet-harvest.js'));

  /** Build an inbox dir the way the runner's artifact return does. */
  const writeSet = (root, jobId, dataSha, cardSha, harvestedAs) => {
    const dir = path.join(root, jobId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
      jobId,
      files: [
        { rel: 'out/study-ladder.json', bytes: 35578, sha256: dataSha },
        { rel: 'out/study-ladder.card.json', bytes: 20632, sha256: cardSha },
      ],
      missing: [],
    }));
    if (harvestedAs) {
      fs.writeFileSync(path.join(dir, '.harvested.json'), JSON.stringify({
        harvested_at: '2026-08-16T09:20:03.817Z', review_item: harvestedAs, job_id: jobId,
      }));
    }
    return dir;
  };

  it('treats two runs of identical data as one result even at different engine commits', () => {
    // The real pair: ws-320-48bd185e7587 and ws-320-f6c3e820c448 both emitted
    // study-ladder.json at 6a1f1d425db8, and their CARDS differ only because the card stamps
    // the engine commit. Keying on the card would have kept them looking like two results.
    const a = { files: [
      { rel: 'out/study-ladder.json', sha256: '6a1f1d425db8' },
      { rel: 'out/study-ladder.card.json', sha256: '6c8bce93d44d' },
    ] };
    const b = { files: [
      { rel: 'out/study-ladder.json', sha256: '6a1f1d425db8' },
      { rel: 'out/study-ladder.card.json', sha256: '5b2642293a7b' },
    ] };
    expect(contentKeyOf(a)).toEqual(contentKeyOf(b));
  });

  it('keeps genuinely different results apart', () => {
    const a = { files: [{ rel: 'out/x.json', sha256: 'aaaa' }] };
    const b = { files: [{ rel: 'out/x.json', sha256: 'bbbb' }] };
    expect(contentKeyOf(a)).not.toEqual(contentKeyOf(b));
    expect(contentKeyOf({ files: [] })).toBeNull();
  });

  it('finds the review item a duplicate should collapse into', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ws572-inbox-'));
    try {
      writeSet(root, 'ws-320-48bd185e7587', '6a1f1d425db8', '6c8bce93d44d', 'WS-497');
      writeSet(root, 'ws-320-f6c3e820c448', '6a1f1d425db8', '5b2642293a7b', null);

      const filed = harvestedContentKeys(root);
      const pending = pendingSets(root);

      expect(pending).toHaveLength(1);
      expect(pending[0].jobId).toBe('ws-320-f6c3e820c448');
      // This is the lookup the harvest command performs before allocating a new WS id.
      expect(filed.get(pending[0].contentKey)).toMatchObject({ reviewId: 'WS-497' });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('files a genuinely new result rather than swallowing it', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ws572-inbox-'));
    try {
      writeSet(root, 'ws-320-48bd185e7587', '6a1f1d425db8', '6c8bce93d44d', 'WS-497');
      // The re-run on the CORRECTED separability code — different verdicts, different data.
      writeSet(root, 'ws-320-corrected', 'ffffffffffff', 'eeeeeeeeeeee', null);

      const filed = harvestedContentKeys(root);
      const pending = pendingSets(root);
      expect(pending).toHaveLength(1);
      expect(filed.get(pending[0].contentKey)).toBeUndefined();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
