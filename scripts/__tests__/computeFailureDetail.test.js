/**
 * WS-547 — a compute failure must carry the reason it failed.
 *
 * ws-503-17172f8726ce failed twice on cm-node1 and was filed as "no error captured in the step
 * log", which reads as bad luck — and nobody goes looking for a mechanism behind bad luck. The
 * cause was recorded the whole time, in the runner's own terminal record:
 *
 *     "detail": "existing worktree at C:\\cj\\ws-503-17172f8726ce is 6f4cf7db…,
 *                expected 32d968a4…"
 *
 * The harvester only ever grepped `<jobId>.0.log`, and a job that dies BEFORE its first step
 * runs writes no step log at all. So the one field holding the answer was the one field never
 * read. These cover the wire format that now carries it.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SUMMARY = path.join(REPO_ROOT, 'scripts', 'fleet', 'done-summary.cjs');

/** Write a terminal record shaped like the ones in ~/fleet/compute/done on cm-node1. */
const withDoneDir = (records, fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws547-done-'));
  try {
    for (const [name, body] of Object.entries(records)) {
      fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(body));
    }
    const out = execFileSync(process.execPath, [SUMMARY, dir], { encoding: 'utf8' });
    return fn(out.split('\n').filter(Boolean).map((l) => {
      const [id, wsId, fingerprint, outcome, detailB64] = l.split('|');
      return {
        id, wsId, fingerprint, outcome,
        detail: detailB64 ? Buffer.from(detailB64, 'base64').toString('utf8') : '',
      };
    }));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const STEP = { name: 's', cmd: 'node', args: ['scripts/backtest/run-hero-ev.mjs'], expectFiles: ['out/x.json'] };

describe('the terminal record carries the runner verdict to the harvester', () => {
  it('round-trips the real WS-503 failure detail', () => {
    const detail = 'existing worktree at C:\\cj\\ws-503-17172f8726ce is '
      + '6f4cf7dbec6d71509b5bb54c6483d5b74a3e9538, expected 32d968a43ba796188deb7480685b95d31d0b9d93';
    withDoneDir({
      'ws-503-17172f8726ce': { commit: 'HEAD', steps: [STEP], outcome: 'failed', detail },
    }, (rows) => {
      expect(rows).toHaveLength(1);
      expect(rows[0].outcome).toBe('failed');
      // Backslashes and colons survive: this is a Windows path, and losing it is how the
      // failure became undiagnosable in the first place.
      expect(rows[0].detail).toBe(detail);
    });
  });

  it('survives a detail containing the field separator and newlines', () => {
    // Base64 is not decoration. A detail carrying a literal `|` would otherwise split the
    // record and shift `outcome` into `fingerprint` — silently, on the failure path.
    const detail = 'step failed | exit 3\nFATAL ERROR: heap limit\r\nmore | pipes | here';
    withDoneDir({
      'ws-999-abc': { commit: 'HEAD', steps: [STEP], outcome: 'failed', detail },
    }, (rows) => {
      expect(rows).toHaveLength(1);
      expect(rows[0].outcome).toBe('failed');
      expect(rows[0].detail).toBe(detail);
    });
  });

  it('emits an empty detail rather than breaking when the runner recorded none', () => {
    withDoneDir({
      'ws-100-def': { commit: 'HEAD', steps: [STEP], outcome: 'succeeded' },
    }, (rows) => {
      expect(rows[0].outcome).toBe('succeeded');
      expect(rows[0].detail).toBe('');
      // The fingerprint field must still be a fingerprint — the added column goes AFTER the
      // existing ones precisely so a stale reader keeps working.
      expect(rows[0].fingerprint).toMatch(/^[0-9a-f]{12}$/);
    });
  });

  it('keeps the first four fields in their historical positions', () => {
    withDoneDir({
      'ws-321-xyz': { source: { ws_id: 'WS-321' }, commit: 'HEAD', steps: [STEP], outcome: 'failed', detail: 'x' },
    }, (rows) => {
      expect(rows[0].id).toBe('ws-321-xyz');
      expect(rows[0].wsId).toBe('WS-321');
      expect(rows[0].fingerprint).toMatch(/^[0-9a-f]{12}$/);
      expect(rows[0].outcome).toBe('failed');
    });
  });
});

describe('the failure headline prefers the runner verdict to a missing log', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'kit/scripts/cwos-fleet-compute.js'), 'utf8');

  it('no longer claims a failure is undiagnosable when a detail exists', () => {
    // The exact string that made WS-547 look like a dead end must be gone.
    expect(src).not.toContain("'no error captured in the step log'");
  });

  it('passes the recorded detail into failureDetail', () => {
    expect(src).toMatch(/function failureDetail\(jobId, recordDetail/);
    expect(src).toMatch(/failureDetail\(t\.id, t\.recordDetail/);
  });

  it('still promotes an out-of-memory signature, which lives only in the log', () => {
    // WS-293's OOM leaves nothing useful in `detail` but a clear signature in the step log,
    // so the log must keep winning for that one case.
    expect(src).toMatch(/oom\s*\n?\s*\?\s*'JavaScript heap out of memory'/);
  });
});

describe('the runner recovers a stale worktree instead of dying on it', () => {
  const runner = 'C:/Users/chris/repos/ai-personal/nodes/scripts/compute-runner.js';

  it('repoints or rebuilds rather than returning a terminal error', () => {
    // Job ids are content-keyed, worktrees are never cleaned up, and HEAD advances — so
    // refusing on a commit mismatch made every re-submitted job permanently unrunnable.
    if (!fs.existsSync(runner)) return;   // ai-personal not checked out on this machine
    const s = fs.readFileSync(runner, 'utf8');
    expect(s).toMatch(/worktree_stale_repointing/);
    expect(s).toMatch(/checkout', '--detach', job\.commit/);
    expect(s).toMatch(/worktree', 'remove', '--force'/);
    // The old dead end: a bare `return { ok: false` on the mismatch branch with no recovery.
    expect(s).not.toMatch(/return \{ ok: false, dir, error: `existing worktree at \$\{dir\} is/);
  });
});
