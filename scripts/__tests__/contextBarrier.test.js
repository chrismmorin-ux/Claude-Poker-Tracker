import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOOK = path.join(REPO_ROOT, '.claude', 'hooks', 'context-barrier.cjs');
const ACTIVE = path.join(REPO_ROOT, '.claude', 'context', 'active-bundle.json');

const WITHHELD = '.claude/context/MEASUREMENT_OVERSIGHTS.md';

/** Run the hook exactly as the harness does: JSON on stdin, meaning in the exit code. */
function invoke(payload, env = {}) {
  const res = spawnSync('node', [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
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
  let saved = null;
  beforeEach(() => {
    saved = fs.existsSync(ACTIVE) ? fs.readFileSync(ACTIVE, 'utf8') : null;
  });
  afterEach(() => {
    try { fs.unlinkSync(ACTIVE); } catch { /* fine */ }
    if (saved !== null) fs.writeFileSync(ACTIVE, saved, 'utf8');
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
      const res = spawnSync('node', [HOOK], { input: 'not json at all', encoding: 'utf8', cwd: REPO_ROOT });
      expect(res.status).toBe(ALLOWED);
    });
  });

  describe('bypass is permitted and RECORDED, never silent', () => {
    it('allows the read under CONTEXT_BARRIER_BYPASS and writes a record', () => {
      declare();
      const log = path.join(REPO_ROOT, '.claude', 'workstream', 'meta', 'context-barrier-log.yaml');
      const before = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
      const { code } = invoke(
        { tool_name: 'Read', tool_input: { file_path: WITHHELD } },
        { CONTEXT_BARRIER_BYPASS: '1' },
      );
      expect(code).toBe(ALLOWED);
      const after = fs.readFileSync(log, 'utf8');
      expect(after.length).toBeGreaterThan(before.length);
      expect(after).toContain('kind: bypass');
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
});
