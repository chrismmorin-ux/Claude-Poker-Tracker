import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import os from 'node:os';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOOK = path.join(REPO_ROOT, '.claude', 'hooks', 'context-barrier.cjs');

/**
 * THIS SUITE USED TO WRITE PRODUCTION STATE, AND IT WENT UNNOTICED FOR 15 DAYS.
 *
 * `ACTIVE` and the log both resolved from REPO_ROOT, and `invoke()` spawns the hook
 * with `cwd: REPO_ROOT`, so running the tests created and deleted the live
 * `active-bundle.json` -- a control file, on a tree that routinely carries several
 * concurrent sessions -- and appended fixtures to the live audit log. Design-critique
 * 2026-08-20 measured ~97% of that log's 1301 events as test residue with no field
 * marking them, which made the mechanism's only telemetry unusable as evidence.
 *
 * State now lives in a tmpdir and every spawn carries the redirect. The production
 * files are asserted untouched at the end of this file -- a test that guards the
 * property rather than a comment asking for it.
 */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxbarrier-'));
const ACTIVE = path.join(TMP, 'active-bundle.json');
const LOG = path.join(TMP, 'context-barrier-log.yaml');

const PROD_ACTIVE = path.join(REPO_ROOT, '.claude', 'context', 'active-bundle.json');
const PROD_LOG = path.join(REPO_ROOT, '.claude', 'workstream', 'meta', 'context-barrier-log.yaml');

const HOOK_ENV = {
  CONTEXT_BARRIER_ACTIVE: ACTIVE,
  CONTEXT_BARRIER_LOG: LOG,
  CONTEXT_BARRIER_SOURCE: 'test',
};

const WITHHELD = '.claude/context/MEASUREMENT_OVERSIGHTS.md';

/** Run the hook exactly as the harness does: JSON on stdin, meaning in the exit code. */
function invoke(payload, env = {}) {
  const res = spawnSync('node', [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    cwd: REPO_ROOT,
    env: { ...process.env, ...HOOK_ENV, ...env },
  });
  return { code: res.status, stderr: res.stderr || '' };
}

const BLOCKED = 2;
const ALLOWED = 0;

function declare(overrides = {}) {
  fs.writeFileSync(ACTIVE, JSON.stringify({
    bundle_id: 'math-blindspot',
    task_id: 'test',
    expires_at: '2099-01-01T00:00:00Z',
    ...overrides,
  }), 'utf8');
}

describe('context barrier', () => {
  afterEach(() => {
    try { fs.unlinkSync(ACTIVE); } catch { /* fine */ }
  });

  describe('blocks a withheld read — the claim the shipped header said was impossible', () => {
    it('blocks Read', () => {
      declare();
      const { code, stderr } = invoke({ tool_name: 'Read', tool_input: { file_path: WITHHELD } });
      expect(code).toBe(BLOCKED);
      expect(stderr).toContain('withheld by context bundle');
    });

    it('blocks Grep and Glob', () => {
      declare();
      expect(invoke({ tool_name: 'Grep', tool_input: { path: WITHHELD } }).code).toBe(BLOCKED);
      expect(invoke({ tool_name: 'Glob', tool_input: { path: WITHHELD } }).code).toBe(BLOCKED);
    });
  });

  describe('THE HOLE THAT ACTUALLY LEAKED — gate on the path, not the tool name', () => {
    // v1 of this hook matched Read|Grep|Glob only. A live test showed
    // `head -3 <withheld>` walked straight past it and put the content in the
    // window with NO block and NO bypass record. Silence was the worst part: the
    // log would still have shown a clean discovery run. Enumerating read-tools is
    // the wrong shape of fix, so the check is now "does any tool input name a
    // withheld path".
    it('blocks a shell read via Bash', () => {
      declare();
      const { code } = invoke({ tool_name: 'Bash', tool_input: { command: `head -3 ${WITHHELD}` } });
      expect(code).toBe(BLOCKED);
    });

    it('blocks a shell read via PowerShell', () => {
      declare();
      const { code } = invoke({ tool_name: 'PowerShell', tool_input: { command: `Get-Content ${WITHHELD}` } });
      expect(code).toBe(BLOCKED);
    });

    it('blocks an UNKNOWN tool that names a withheld path (MCP file readers)', () => {
      declare();
      const { code } = invoke({ tool_name: 'mcp__whatever__read_file', tool_input: { uri: WITHHELD } });
      expect(code).toBe(BLOCKED);
    });

    it('blocks a bare leaf reference after a cd', () => {
      declare();
      const { code } = invoke({
        tool_name: 'Bash',
        tool_input: { command: 'cd .claude/context && cat MEASUREMENT_OVERSIGHTS.md' },
      });
      expect(code).toBe(BLOCKED);
    });
  });

  describe('THE SECOND HOLE -- naming a container instead of the file', () => {
    // Measured 2026-08-20 during design-critique. The leaf/substring check caught an
    // input that NAMED the withheld file and missed every input that named a directory
    // above it and let the tool enumerate. Five of six routes reached the content with
    // no block and no record -- and `cat <dir>/*` is strictly easier to type than the
    // `head -3 <file>` that motivated the v1 rewrite.
    it('blocks a Grep rooted at the containing directory', () => {
      declare();
      expect(invoke({ tool_name: 'Grep', tool_input: { pattern: 'posterior', path: '.claude/context/' } }).code).toBe(BLOCKED);
    });

    it('blocks a Glob over the containing directory', () => {
      declare();
      expect(invoke({ tool_name: 'Glob', tool_input: { pattern: '.claude/context/*.md' } }).code).toBe(BLOCKED);
    });

    it('blocks a shell wildcard read of the directory', () => {
      declare();
      expect(invoke({ tool_name: 'Bash', tool_input: { command: 'cat .claude/context/*.md' } }).code).toBe(BLOCKED);
    });

    it('blocks a git grep pathspec-scoped to the directory', () => {
      declare();
      expect(invoke({ tool_name: 'Bash', tool_input: { command: 'git grep -n posterior -- .claude/context' } }).code).toBe(BLOCKED);
    });

    it('blocks delegating the enumeration to a subagent', () => {
      declare();
      expect(invoke({
        tool_name: 'Task',
        tool_input: { prompt: 'Read every file under .claude/context and summarize' },
      }).code).toBe(BLOCKED);
    });
  });

  describe('the directory rule has bounds -- over-blocking the rest is breakage', () => {
    it('allows a SIBLING file the bundle does not withhold', () => {
      declare();
      expect(invoke({ tool_name: 'Read', tool_input: { file_path: '.claude/context/POKER_THEORY.md' } }).code).toBe(ALLOWED);
      expect(invoke({ tool_name: 'Grep', tool_input: { pattern: 'x', path: '.claude/context/STATE_SCHEMA.md' } }).code).toBe(ALLOWED);
    });

    it('allows a ONE-SEGMENT ancestor -- a bare .claude must not blanket-block', () => {
      declare();
      expect(invoke({ tool_name: 'Bash', tool_input: { command: 'ls -la .claude' } }).code).toBe(ALLOWED);
    });
  });

  describe('does not over-block ordinary work', () => {
    it('allows unrelated Bash', () => {
      declare();
      expect(invoke({ tool_name: 'Bash', tool_input: { command: 'git status --short' } }).code).toBe(ALLOWED);
    });

    it('allows reads of files the bundle does not withhold', () => {
      declare();
      expect(invoke({ tool_name: 'Read', tool_input: { file_path: 'CLAUDE.md' } }).code).toBe(ALLOWED);
    });
  });

  describe('fails OPEN — a broken barrier must never make the repo unusable', () => {
    it('allows everything when no declaration is active', () => {
      try { fs.unlinkSync(ACTIVE); } catch { /* already absent */ }
      expect(invoke({ tool_name: 'Read', tool_input: { file_path: WITHHELD } }).code).toBe(ALLOWED);
      expect(invoke({ tool_name: 'Bash', tool_input: { command: `cat ${WITHHELD}` } }).code).toBe(ALLOWED);
    });

    it('allows when the declaration has EXPIRED — a stale task must not keep blocking', () => {
      declare({ expires_at: '2000-01-01T00:00:00Z' });
      expect(invoke({ tool_name: 'Read', tool_input: { file_path: WITHHELD } }).code).toBe(ALLOWED);
    });

    it('allows when the declaration is malformed', () => {
      fs.writeFileSync(ACTIVE, '{ not json', 'utf8');
      expect(invoke({ tool_name: 'Read', tool_input: { file_path: WITHHELD } }).code).toBe(ALLOWED);
    });

    it('allows when the named bundle does not exist', () => {
      declare({ bundle_id: 'no-such-bundle' });
      expect(invoke({ tool_name: 'Read', tool_input: { file_path: WITHHELD } }).code).toBe(ALLOWED);
    });

    it('allows on malformed stdin', () => {
      declare();
      const res = spawnSync('node', [HOOK], {
        input: 'not json at all', encoding: 'utf8', cwd: REPO_ROOT,
        env: { ...process.env, ...HOOK_ENV },
      });
      expect(res.status).toBe(ALLOWED);
    });
  });

  describe('bypass is permitted and RECORDED, never silent', () => {
    it('allows the read under CONTEXT_BARRIER_BYPASS and writes a record', () => {
      declare();
      const before = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8') : '';
      const { code } = invoke(
        { tool_name: 'Read', tool_input: { file_path: WITHHELD } },
        { CONTEXT_BARRIER_BYPASS: '1' },
      );
      expect(code).toBe(ALLOWED);
      const after = fs.readFileSync(LOG, 'utf8');
      expect(after.length).toBeGreaterThan(before.length);
      expect(after).toContain('"kind": "bypass"'.replace('"kind"', 'kind'));
      expect(after).toContain('"source": "test"'.replace('"source"', 'source'));
    });
  });

  describe('the residue it honestly cannot reach', () => {
    it('does not pretend to withhold harness-injected context (USER_MEMORY sentinel)', () => {
      declare();
      // math-blindspot excludes USER_MEMORY/project_allin_side_pots.md. That content
      // is placed in the window before any hook runs, so a "block" on it would be
      // enforcement theatre. Deliberate reads are enforceable; harness injection is not.
      const { code } = invoke({
        tool_name: 'Read',
        tool_input: { file_path: 'USER_MEMORY/project_allin_side_pots.md' },
      });
      expect(code).toBe(ALLOWED);
    });
  });
  describe('the log is an audit trail, which means something can read it', () => {
    // A Windows absolute path is the exact shape that broke the old writer: it
    // escaped only the double quote, so a backslash followed by U read as a malformed
    // unicode escape and the file stopped parsing at event #3 of 1301.
    const B = String.fromCharCode(92);
    const WIN_PATH = 'C:' + B + 'Users' + B + 'chris' + B + 'MEASUREMENT_OVERSIGHTS.md';
    const NL = String.fromCharCode(10);

    function scalarsIn(text) {
      return text.split(NL)
        .map((l) => l.trim())
        .filter((l) => l.indexOf(': ') > 0)
        .map((l) => l.slice(l.indexOf(': ') + 2).trim())
        .filter((v) => v.length > 0);
    }

    it('emits scalars a parser accepts -- the defect that made it unreadable', () => {
      declare();
      invoke(
        { tool_name: 'Read', tool_input: { file_path: WIN_PATH } },
        { CONTEXT_BARRIER_BYPASS: '1' },
      );
      const scalars = scalarsIn(fs.readFileSync(LOG, 'utf8'));
      expect(scalars.length).toBeGreaterThan(0);
      // Every value is a JSON scalar, which is also a valid YAML 1.2 double-quoted
      // scalar. Asserting JSON.parse is strictly tighter than asserting YAML parses.
      for (const v of scalars) expect(() => JSON.parse(v)).not.toThrow();
    });

    it('round-trips a Windows path rather than corrupting it', () => {
      declare();
      invoke(
        { tool_name: 'Read', tool_input: { file_path: WIN_PATH } },
        { CONTEXT_BARRIER_BYPASS: '1' },
      );
      const scalars = scalarsIn(fs.readFileSync(LOG, 'utf8')).map((v) => JSON.parse(v));
      expect(scalars.some((v) => v.indexOf(B + 'Users' + B) !== -1)).toBe(true);
    });

    it('marks provenance, so no reader has to infer it from event counts', () => {
      declare();
      invoke({ tool_name: 'Read', tool_input: { file_path: WITHHELD } });
      expect(fs.readFileSync(LOG, 'utf8')).toContain('source: "test"');
    });
  });

  describe('THE REGRESSION THIS FILE EXISTS TO PREVENT', () => {
    it('does not touch production control state', () => {
      const activeBefore = fs.existsSync(PROD_ACTIVE);
      const logBefore = fs.existsSync(PROD_LOG) ? fs.statSync(PROD_LOG).size : -1;

      declare();
      invoke({ tool_name: 'Read', tool_input: { file_path: WITHHELD } });
      invoke({ tool_name: 'Read', tool_input: { file_path: WITHHELD } }, { CONTEXT_BARRIER_BYPASS: '1' });

      expect(fs.existsSync(PROD_ACTIVE)).toBe(activeBefore);
      expect(fs.existsSync(PROD_LOG) ? fs.statSync(PROD_LOG).size : -1).toBe(logBefore);
    });
  });
});
