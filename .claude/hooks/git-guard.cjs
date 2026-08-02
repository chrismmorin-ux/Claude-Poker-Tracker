#!/usr/bin/env node
/**
 * Git Guard Hook - Enforces version control standards from CLAUDE.md
 *
 * Blocks:
 * - Force push to main/master
 * - Hard reset on main/master
 * - Direct commits to main without branch (warns)
 * - Tree-wide staging/stashing when the tree holds work from another session
 *
 * Exit codes:
 * - 0: Allow
 * - 1: Allow with warning (message printed)
 * - 2: Block (message printed)
 *
 * ── CONCURRENCY BLOCK: WHAT IT CATCHES, AND WHAT IT STILL MISSES ──────────────
 * Catches: (a) changed files whose mtime PREDATES this session — proof they are not ours;
 * (b) peer sessions that heartbeated within 6h, i.e. plausibly editing right now;
 * (c) a process whose own session cannot be identified at all (fails closed).
 *
 * KNOWN GAP, documented rather than left silent: a session that started BEFORE the Stop
 * heartbeat hook was wired (2026-08-02) carries a stale `last_heartbeat`, so if it edits
 * AFTER this session started, arm (a) cannot see it (mtime is newer than our start) and arm
 * (b) cannot see it (heartbeat looks old). Closing that needs per-file ownership —
 * `files_locked`, which has no writer anywhere in the kit and is filed to HomeBase. Until
 * then this guard reduces the window; it does not eliminate it.
 *
 * Deliberately NOT used here: `listLiveSessions()` / `registryHealth()`. Measured 2026-08-02
 * with three sessions concurrently editing this repo, they returned `[]` and `{ok:true}`
 * respectively, because the heartbeat hook had been dead for two days — a confident all-clear
 * computed from dead data. Counting `status: active` records heartbeat-independently fails
 * the opposite way: 8 sessions from 2026-07-30 are still marked active, which would block
 * tree staging permanently. Hence mtime, which is a proof and cannot rot.
 */

const readline = require('readline');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const WS_DIR = path.join(REPO, '.claude', 'workstream');

/**
 * Tree-wide staging/stashing: sweeps whatever is in the working tree, mine or not.
 * `git add <path>` is deliberately absent — explicit paths are the workflow this steers
 * toward, and blocking them would make the repo unusable.
 *
 * MATCHED CASE-SENSITIVELY, against the raw command. The rest of this hook works on a
 * lowercased copy, which silently turned `git add -A` into `git add -a` and made every
 * pattern here dead on arrival — caught by the fixture suite, which is exactly the class of
 * bug a state-dependent test would have missed.
 */
const SWEEPS_TREE = [
  /git\s+add\s+(?:-[A-Za-z]*\s+)*(?:-A|--all|\.)(?:\s|$)/,
  /git\s+add\s+-[A-Za-z]*A/,             // bundled short flags, e.g. -uA
  /git\s+commit\s+(?:-a|--all)(?:\s|$)/,
  /git\s+commit\s+-[A-Za-z]*a[A-Za-z]*(?:\s|$)/, // -am, -na, ...
  /git\s+stash(?:\s|$)/,                 // stashes other sessions' work too
];

/**
 * THE SIGNAL: changed files that CANNOT be mine, because they were already modified before
 * this session existed.
 *
 * Why mtime and not the session registry (both measured 2026-08-02):
 *
 *   - `listLiveSessions()` answers "is another PROCESS alive?", which is the wrong question.
 *     A crashed session's abandoned edits are equally not-mine and equally wrong to sweep
 *     into my commit. It also fails OPEN in the case that matters: with three sessions
 *     actively editing this repo it returned [] and `registryHealth()` returned {ok:true},
 *     because the heartbeat hook had been dead for two days. Both green, both wrong.
 *   - Heartbeat-INDEPENDENT `status: active` counting fails the other way — it found 8
 *     sessions from 2026-07-30 still marked active, several holding claims. Those zombies
 *     would block tree-wide staging permanently, which is friction with no safety left in it.
 *
 * `mtime < session start` is a PROOF of non-ownership that needs no bookkeeping and cannot
 * rot: this session had not begun, so it cannot have written that change. It is one-sided on
 * purpose — a file touched after my start might be mine or another session's, so the second
 * arm (a recently-heartbeating peer) covers concurrent activity.
 */
function foreignChanges(sessionStartMs, files) {
  if (!sessionStartMs) return [];
  const out = [];
  for (const f of files) {
    try {
      const st = fs.statSync(path.join(REPO, f));
      if (st.mtimeMs < sessionStartMs) out.push(f);
    } catch { /* deleted or unreadable — cannot attribute, so do not accuse */ }
  }
  return out;
}

/** Wall-clock ms this session started, from its own registry record. */
function sessionStartMs(selfId) {
  if (!selfId) return null;
  try {
    const raw = fs.readFileSync(path.join(WS_DIR, 'sessions', `${selfId}.yaml`), 'utf8');
    const t = Date.parse((raw.match(/^started_at:\s*"?([^"\n]+)"?/m)?.[1] || '').trim());
    return Number.isFinite(t) ? t : null;
  } catch { return null; }
}

/**
 * Peers that heartbeated recently enough to be plausibly mid-edit RIGHT NOW.
 *
 * Deliberately wider than cwos-claims' 90-minute STALE_MINUTES: heartbeats are unreliable
 * here (the hook was unwired until 2026-08-02), so a short window would miss a session that
 * is genuinely open. Wide enough to catch real concurrency, narrow enough to ignore the
 * 3-day-old zombie records.
 */
function recentPeers(selfId, windowHours = 6) {
  const dir = path.join(WS_DIR, 'sessions');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')); } catch { return []; }

  const cutoff = Date.now() - windowHours * 3600 * 1000;
  const out = [];
  for (const f of files) {
    let raw;
    try { raw = fs.readFileSync(path.join(dir, f), 'utf8'); } catch { continue; }
    if (!/^status:\s*active\s*$/m.test(raw)) continue;
    const id = (raw.match(/^id:\s*"?([^"\n]+)"?/m)?.[1] || f.replace(/\.yaml$/, '')).trim();
    if (selfId && id === selfId) continue;
    const hb = (raw.match(/^last_heartbeat:\s*"?([^"\n]+)"?/m)?.[1] || '').trim();
    const t = Date.parse(hb);
    if (!Number.isFinite(t) || t < cutoff) continue;
    const items = (raw.match(/^claimed_items:\s*\n((?:\s+-\s.*\n?)*)/m)?.[1] || '')
      .split('\n').map((l) => l.replace(/^\s*-\s*"?|"?\s*$/g, '').trim()).filter(Boolean);
    out.push({ id, last_heartbeat: hb, claimed_items: items });
  }
  return out;
}

/**
 * This process's session id.
 *
 * Prefers the kit's `resolveSessionId` — authoritative, and the only resolver `cwos-claims`
 * documents as correct under concurrency. Falls back to scanning session records for a
 * matching `agent_session_id`, which is the same join key by a shorter path, so a kit that
 * is missing or mid-upgrade does not fail every tree-staging command closed.
 *
 * `CLAUDE_CODE_SESSION_ID` is exported by the harness into every subprocess, so the fallback
 * is reliable rather than a guess. Returns null only when nothing identifies this process —
 * and that genuinely warrants failing closed.
 */
function selfSessionId() {
  try {
    const claims = require(path.join(REPO, 'kit', 'scripts', 'lib', 'cwos-claims.js'));
    const id = claims.resolveSessionId(WS_DIR, { create: false });
    if (id) return id;
  } catch { /* fall through to the dependency-free path */ }

  const agent = (process.env.CLAUDE_CODE_SESSION_ID || '').trim();
  if (!agent) return null;
  const dir = path.join(WS_DIR, 'sessions');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')); } catch { return null; }
  for (const f of files) {
    let raw;
    try { raw = fs.readFileSync(path.join(dir, f), 'utf8'); } catch { continue; }
    const got = raw.match(/^agent_session_id:\s*"?([^"\n]*)"?/m)?.[1]?.trim();
    if (got && got === agent) {
      return (raw.match(/^id:\s*"?([^"\n]+)"?/m)?.[1] || f.replace(/\.yaml$/, '')).trim();
    }
  }
  return null;
}

function changedFiles() {
  try {
    const r = spawnSync('git', ['status', '--porcelain'], { cwd: REPO, encoding: 'utf8' });
    if (r.status !== 0) return [];
    return r.stdout.split('\n').map((l) => l.slice(3).trim()).filter(Boolean);
  } catch { return []; }
}

async function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    const rl = readline.createInterface({ input: process.stdin });

    // Timeout to prevent hanging if stdin never closes
    const timeout = setTimeout(() => {
      rl.close();
      resolve('');
    }, 100);

    rl.on('line', (line) => {
      clearTimeout(timeout);
      input += line;
    });

    rl.on('close', () => {
      clearTimeout(timeout);
      resolve(input);
    });

    rl.on('error', () => {
      clearTimeout(timeout);
      resolve('');
    });
  });
}

async function main() {
  const input = await readStdin();

  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    // Not valid JSON, allow
    process.exit(0);
  }

  const command = data?.tool_input?.command || '';

  // Normalize command for pattern matching
  const cmd = command.toLowerCase().replace(/\s+/g, ' ').trim();
  // Case-PRESERVED copy: git flags are case-sensitive (-A is not -a), so the
  // tree-sweep patterns must not run against the lowercased form.
  const rawCmd = command.replace(/\s+/g, ' ').trim();

  // ── BLOCK: tree-wide staging while other sessions hold uncommitted work ──────
  //
  // The founder runs 3-4 concurrent sessions (laptop, remote-from-phone, HomeBase-dispatched
  // autopilot) on topics that start unrelated and converge. On 2026-08-01 a blanket `git add
  // -A` in this repo would have committed a third session's mid-edit settings/UI files; it was
  // avoided only by hand-auditing mtimes. Blocking is recoverable — a commit spanning three
  // workstreams is what makes a defect unattributable later (see WS-312, whose fix landed
  // inside a commit named for a different ticket and stayed open at P0 for two days).
  if (SWEEPS_TREE.some((re) => re.test(rawCmd))) {
    const self = selfSessionId();
    const startMs = sessionStartMs(self);
    const files = changedFiles();
    const foreign = foreignChanges(startMs, files);
    const peers = recentPeers(self);
    // Fail CLOSED when we cannot even identify ourselves: "nothing foreign" must not be
    // produced by absence of data. Unprovable solitude is what burned 2026-08-01.
    const cannotTell = !self || !startMs;

    if (foreign.length > 0 || peers.length > 0 || cannotTell) {
      console.error('BLOCKED: tree-wide staging would capture work that is not this session\'s.');
      console.error('');
      if (foreign.length > 0) {
        console.error(`Changed BEFORE this session started (${foreign.length}) — cannot be yours:`);
        for (const f of foreign.slice(0, 30)) console.error(`  ${f}`);
        if (foreign.length > 30) console.error(`  ... and ${foreign.length - 30} more`);
        console.error('');
      }
      if (peers.length > 0) {
        console.error(`Sessions active in the last 6h (${peers.length}) — possibly mid-edit now:`);
        for (const p of peers) {
          const items = p.claimed_items.length ? ` holds ${p.claimed_items.join(', ')}` : '';
          console.error(`  - ${p.id}${items} (heartbeat ${p.last_heartbeat})`);
        }
        console.error('');
      }
      if (cannotTell) {
        console.error('This process has no resolvable session record, so ownership cannot be');
        console.error('established at all. Failing closed rather than guessing.');
        console.error('');
      }
      console.error('Stage your own files by explicit path — never blocked:');
      console.error('  git add <path> [<path> ...]');
      console.error('');
      console.error('Per-file ownership is not yet tracked (`files_locked` has no writer in the');
      console.error('kit — filed to HomeBase), so this reports facts rather than guessing.');
      console.error('Shared derived state (queue-index.yaml, sprint-index.yaml,');
      console.error('events/current.jsonl, system/events.log.md) is rebuilt by reconcile —');
      console.error('prefer leaving it out of any commit.');
      console.error('');
      console.error('Stale `status: active` records inflate this. Close finished sessions with');
      console.error('/session-end, or: node kit/scripts/cwos-session-recovery.js --auto');
      process.exit(2);
    }
  }

  // BLOCK: Force push to main/master
  // Note: Exit code 2 requires stderr for error message per Claude Code docs
  if (/git\s+push\s+.*--force/.test(cmd) || /git\s+push\s+-f/.test(cmd)) {
    if (/\b(main|master)\b/.test(cmd) || !/\b\w+\/\w+\b/.test(cmd)) {
      console.error('BLOCKED: Force push to main/master is prohibited.');
      console.error('See CLAUDE.md Section 1: Branch Protection Rules');
      console.error('');
      console.error('If you need to force push to a feature branch, specify the branch explicitly:');
      console.error('  git push --force origin feature/your-branch');
      process.exit(2);
    }
  }

  // BLOCK: Hard reset on main/master
  if (/git\s+reset\s+--hard/.test(cmd)) {
    // Check if we're on main/master
    if (/\b(main|master|origin\/main|origin\/master)\b/.test(cmd)) {
      console.error('BLOCKED: Hard reset on main/master is prohibited.');
      console.error('See CLAUDE.md Section 1: Branch Protection Rules');
      process.exit(2);
    }
  }

  // WARN: Committing directly (might be on main)
  if (/git\s+commit\s/.test(cmd) && !/-m\s+["']?(feat|fix|refactor|docs|test|style|chore|perf)/.test(cmd)) {
    console.log('WARNING: Commit message may not follow conventional format.');
    console.log('Expected format: <type>: <description>');
    console.log('Types: feat, fix, refactor, docs, test, style, chore, perf');
    console.log('See CLAUDE.md Section 2: Commit Format');
    // Don't block, just warn
  }

  // WARN: Amending commits (risky if pushed)
  if (/git\s+commit\s+--amend/.test(cmd)) {
    console.log('WARNING: Amending commits. Ensure this commit has not been pushed.');
    console.log('See CLAUDE.md Section 2: History Hygiene Rules');
  }

  // BLOCK: Rebase with -i (interactive) - not supported in non-interactive shells
  if (/git\s+rebase\s+-i/.test(cmd) || /git\s+add\s+-i/.test(cmd)) {
    console.error('BLOCKED: Interactive git commands (-i) are not supported in this environment.');
    console.error('Use non-interactive alternatives or run manually in your terminal.');
    process.exit(2);
  }

  // BLOCK: Merge to main without PR (direct merge)
  if (/git\s+merge\s+.*\b(main|master)\b/.test(cmd)) {
    console.log('WARNING: Merging to/from main. Ensure this follows PR workflow.');
    console.log('See CLAUDE.md Section 1: Branch Workflow');
  }

  // Allow
  process.exit(0);
}

main().catch(err => {
  console.error('Hook error:', err.message);
  process.exit(0); // Fail open
});
