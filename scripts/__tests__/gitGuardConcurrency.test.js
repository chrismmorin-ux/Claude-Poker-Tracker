/**
 * gitGuardConcurrency.test.js — `.claude/hooks/git-guard.cjs` concurrency block.
 *
 * ── WHY THIS SUITE EXISTS IN THIS SHAPE ───────────────────────────────────────
 * The founder runs 3-4 concurrent sessions (laptop left running, remote-controlled from a
 * phone, HomeBase-dispatched autopilot) on topics that start unrelated and converge. The guard
 * stops a tree-wide `git add -A` from committing another session's in-flight edits under this
 * session's message — the failure that made WS-312 unattributable when its fix landed inside a
 * commit named for a different ticket.
 *
 * EACH SCENARIO GETS A THROWAWAY REPO. The guard derives its repo root from `__dirname`, so the
 * hook is copied into a temp tree per case and mtimes plus session records are set explicitly.
 * The first attempt at this test drove the REAL working tree and was worthless: it passed or
 * failed depending on whether another session happened to have committed yet, and it reported
 * 8 spurious failures for that reason alone.
 *
 * IT ALSO CAUGHT A REAL BUG. `git-guard` matches most patterns against a LOWERCASED copy of the
 * command, which silently turned `git add -A` into `git add -a` and made every tree-sweep
 * pattern dead on arrival. A state-dependent test could not have found that.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const HOOK_SRC = path.resolve(process.cwd(), '.claude/hooks/git-guard.cjs');

const AGENT_ID = 'agent-self-0001';
const SELF_ID = 'ses-20260801-1650-self';
const START = '2026-08-01T16:50:00.000Z';
const START_MS = Date.parse(START);

/** Commands are assembled from parts so the trigger patterns never appear as literals. */
const SWEEP = ['git ', 'add ', '-A'];

let ROOT;

beforeAll(() => { ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'gitguard-')); });
afterAll(() => { try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch { /* temp dir */ } });

let seq = 0;
function mkRepo() {
  const repo = path.join(ROOT, `r${seq++}`);
  fs.mkdirSync(path.join(repo, '.claude', 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.claude', 'workstream', 'sessions'), { recursive: true });
  fs.copyFileSync(HOOK_SRC, path.join(repo, '.claude', 'hooks', 'git-guard.cjs'));
  const git = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed\n');
  git('add', 'seed.txt');
  git('commit', '-q', '-m', 'seed');
  return repo;
}

function session(repo, { id, agent, started = START, heartbeat, status = 'active', items = [] }) {
  const lines = [
    `id: "${id}"`, `status: ${status}`, `started_at: "${started}"`,
    `last_heartbeat: "${heartbeat}"`, `agent_session_id: "${agent || ''}"`,
  ];
  lines.push(items.length ? 'claimed_items:' : 'claimed_items: []');
  for (const i of items) lines.push(`  - "${i}"`);
  fs.writeFileSync(
    path.join(repo, '.claude/workstream/sessions', `${id}.yaml`),
    lines.join('\n') + '\n',
  );
}

/** A tracked file with a pending change, stamped with a chosen mtime. */
function dirtyFile(repo, name, mtimeMs) {
  const p = path.join(repo, name);
  fs.writeFileSync(p, 'v1\n');
  execFileSync('git', ['add', name], { cwd: repo, stdio: 'pipe' });
  execFileSync('git', ['commit', '-q', '-m', `add ${name}`], { cwd: repo, stdio: 'pipe' });
  fs.writeFileSync(p, 'v2\n');
  fs.utimesSync(p, mtimeMs / 1000, mtimeMs / 1000);
}

function run(repo, parts, { agent = AGENT_ID } = {}) {
  const r = spawnSync(process.execPath, [path.join(repo, '.claude/hooks/git-guard.cjs')], {
    input: JSON.stringify({ tool_input: { command: parts.join('') } }),
    cwd: repo, encoding: 'utf8',
    env: { ...process.env, CLAUDE_CODE_SESSION_ID: agent },
  });
  // Whitespace-normalized: the guard hard-wraps its prose, so phrase assertions must not
  // depend on where the line breaks land.
  return { status: r.status, err: (r.stderr || '').replace(/\s+/g, ' ') };
}

const now = () => new Date().toISOString();
const ago = (ms) => new Date(Date.now() - ms).toISOString();

describe('git-guard — tree-sweep detection', () => {
  // The lowercasing bug lived here: `-A` became `-a` and matched nothing.
  test.each([
    ['add -A', ['git ', 'add ', '-A']],
    ['add .', ['git ', 'add ', '.']],
    ['add --all', ['git ', 'add ', '--all']],
    ['add -uA (bundled)', ['git ', 'add ', '-uA']],
    ['commit -a', ['git ', 'commit ', '-a']],
    ['commit -am', ['git ', 'commit ', '-am ', '"x"']],
    ['stash', ['git ', 'stash']],
    ['stash push', ['git ', 'stash ', 'push']],
  ])('%s is treated as a tree sweep', (_label, parts) => {
    const repo = mkRepo();
    session(repo, { id: SELF_ID, agent: AGENT_ID, heartbeat: now() });
    dirtyFile(repo, 'theirs.txt', START_MS - 3600_000); // foreign -> must block
    expect(run(repo, parts).status).toBe(2);
  });

  test.each([
    ['explicit paths', ['git ', 'add ', 'a.txt ', 'b.txt']],
    ['single path', ['git ', 'add ', '.claude/settings.json']],
    ['commit -m', ['git ', 'commit ', '-m ', '"fix: y"']],
    ['status', ['git ', 'status ', '--short']],
    ['diff --cached', ['git ', 'diff ', '--cached']],
    ['log', ['git ', 'log ', '--oneline']],
    ['non-git command', ['npm ', 'test']],
    ['prose containing "added all"', ['echo ', '"added all the files"']],
  ])('%s is NOT a tree sweep', (_label, parts) => {
    const repo = mkRepo();
    session(repo, { id: SELF_ID, agent: AGENT_ID, heartbeat: now() });
    dirtyFile(repo, 'theirs.txt', START_MS - 3600_000); // foreign present, yet must allow
    expect(run(repo, parts).status).toBe(0);
  });
});

describe('git-guard — ownership signals', () => {
  test('a change predating this session blocks the sweep, and is named', () => {
    // mtime < session start is a PROOF of non-ownership: we had not started yet.
    const repo = mkRepo();
    session(repo, { id: SELF_ID, agent: AGENT_ID, heartbeat: now() });
    dirtyFile(repo, 'theirs.txt', START_MS - 3600_000);
    const r = run(repo, SWEEP);
    expect(r.status).toBe(2);
    expect(r.err).toMatch(/theirs\.txt/);
  });

  test('scoped staging stays allowed even when foreign work is present', () => {
    // The block must never prevent committing your OWN work, or the repo is unusable.
    const repo = mkRepo();
    session(repo, { id: SELF_ID, agent: AGENT_ID, heartbeat: now() });
    dirtyFile(repo, 'theirs.txt', START_MS - 3600_000);
    expect(run(repo, ['git ', 'add ', 'theirs.txt']).status).toBe(0);
  });

  test('only-own changes allow the sweep', () => {
    const repo = mkRepo();
    session(repo, { id: SELF_ID, agent: AGENT_ID, heartbeat: now() });
    dirtyFile(repo, 'mine.txt', START_MS + 3600_000);
    expect(run(repo, SWEEP).status).toBe(0);
  });

  test('a peer that heartbeated recently blocks, and is named with its claims', () => {
    const repo = mkRepo();
    session(repo, { id: SELF_ID, agent: AGENT_ID, heartbeat: now() });
    session(repo, {
      id: 'ses-peer', agent: 'agent-peer', started: ago(7200_000),
      heartbeat: ago(600_000), items: ['WS-999'],
    });
    dirtyFile(repo, 'mine.txt', START_MS + 3600_000);
    const r = run(repo, SWEEP);
    expect(r.status).toBe(2);
    expect(r.err).toMatch(/ses-peer/);
    expect(r.err).toMatch(/WS-999/);
  });

  test('a 3-day-old zombie peer does NOT block', () => {
    // 8 such records exist in this repo from 2026-07-30, several holding claims. Counting
    // active records heartbeat-independently would block tree staging permanently — friction
    // with no safety left in it.
    const repo = mkRepo();
    session(repo, { id: SELF_ID, agent: AGENT_ID, heartbeat: now() });
    session(repo, {
      id: 'ses-zombie', agent: 'agent-zzz', started: '2026-07-30T03:00:00.000Z',
      heartbeat: '2026-07-30T03:25:52.000Z', items: ['WS-300'],
    });
    dirtyFile(repo, 'mine.txt', START_MS + 3600_000);
    expect(run(repo, SWEEP).status).toBe(0);
  });

  test('a completed peer is not a peer', () => {
    const repo = mkRepo();
    session(repo, { id: SELF_ID, agent: AGENT_ID, heartbeat: now() });
    session(repo, {
      id: 'ses-done', agent: 'agent-done', started: ago(7200_000),
      heartbeat: ago(600_000), status: 'completed',
    });
    dirtyFile(repo, 'mine.txt', START_MS + 3600_000);
    expect(run(repo, SWEEP).status).toBe(0);
  });

  test('an unidentifiable session fails CLOSED, and says why', () => {
    // "nothing foreign" must never be produced by absence of data — the fail-open that
    // reported claim_conflicts: [] from 48h-dead liveness on 2026-08-01.
    const repo = mkRepo();
    dirtyFile(repo, 'mine.txt', START_MS + 3600_000);
    const r = run(repo, SWEEP, { agent: 'agent-unknown-to-registry' });
    expect(r.status).toBe(2);
    expect(r.err).toMatch(/ownership cannot be established/i);
  });

  test('identity resolves without the kit present (dependency-free fallback)', () => {
    // The fixtures have no kit/, so requiring cwos-claims fails. If that made the guard fail
    // closed, every tree-staging command would be blocked during a kit upgrade.
    const repo = mkRepo();
    session(repo, { id: SELF_ID, agent: AGENT_ID, heartbeat: now() });
    dirtyFile(repo, 'mine.txt', START_MS + 3600_000);
    expect(run(repo, SWEEP).status).toBe(0); // resolved via agent_session_id, so not cannotTell
  });
});

describe('git-guard — pre-existing protections still hold', () => {
  test.each([
    ['force push to main', ['git ', 'push ', '--force ', 'origin ', 'main'], 2],
    ['interactive rebase', ['git ', 'rebase ', '-i ', 'HEAD~2'], 2],
    ['plain status', ['git ', 'status'], 0],
  ])('%s -> exit %i', (_label, parts, expected) => {
    const repo = mkRepo();
    session(repo, { id: SELF_ID, agent: AGENT_ID, heartbeat: now() });
    expect(run(repo, parts).status).toBe(expected);
  });
});
