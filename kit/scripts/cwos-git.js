#!/usr/bin/env node
/**
 * cwos-git — stage what is YOURS, and make file ownership computable (WS-564).
 *
 * THE PROBLEM, MEASURED. The founder runs 3-4 concurrent sessions (laptop left
 * running, remote-controlled from a phone, HomeBase-dispatched autopilot) on topics
 * that start unrelated and converge. They share one working tree, so `git add -A`
 * sweeps whatever is in it — mine or not. On 2026-08-01 a blanket stage in
 * claude-poker-tracker would have committed a third session's mid-edit files; it was
 * avoided only by hand-auditing mtimes. The cost is not the commit, it is what the
 * commit destroys: WS-312's fix landed inside a commit named for a different ticket
 * and the item stayed open at P0 for two days, because nobody could tell what that
 * commit actually contained.
 *
 * THREE THINGS THAT DO NOT WORK, all measured 2026-08-02:
 *
 *   - `listLiveSessions()` / `registryHealth()`. With three sessions concurrently
 *     editing the repo they returned [] and {ok:true}: a confident all-clear computed
 *     from a heartbeat hook that had been dead for two days. That specific fail-open
 *     is fixed elsewhere in this item, but it is not what ownership should rest on
 *     anyway — "is another PROCESS alive" is the wrong question. A crashed session's
 *     abandoned edits are equally not-mine and equally wrong to sweep into my commit.
 *   - Counting `status: active` records heartbeat-independently. Eight zombie records
 *     from 2026-07-30 would fence tree staging permanently — friction with no safety
 *     left in it.
 *   - Trusting the session to remember. It does not, and a rule that lives only in
 *     prose is FIND-119: the AI read prog-*.yaml directly for ten straight days
 *     against a documented rule saying not to.
 *
 * SO OWNERSHIP IS COMPUTED FROM TWO SOURCES, one a proof and one a record:
 *
 *   mtime < session start   PROOF of non-ownership. This session had not begun, so
 *                           it cannot have written that change. Needs no bookkeeping
 *                           and cannot rot. One-sided on purpose: a file touched
 *                           after my start might be mine or a peer's.
 *   files_locked            RECORD of ownership, written by `record` (a PostToolUse
 *                           hook) and by `stage`. Closes the gap the proof cannot
 *                           see — a session that started before mine and edited
 *                           after I began is invisible to mtime.
 *
 * Subcommands:
 *   stage [paths...]  stage this session's files, never the whole tree
 *   record <paths...> note that this session modified these files (hook entry)
 *   locks             who holds what, and whether they are still live
 *   guard             PreToolUse Bash hook: refuse tree-wide staging/stashing
 *   worktree ...      isolation for unattended runs (see `worktree --help` notes)
 *
 * Exit codes: 0 ok | 1 refused / conflict | 2 bad command line.
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { cliGate } = require('./lib/cli');
const { runGit, runNode } = require('./lib/shell-safe');
const { findWorkstreamDir, findRepoRoot } = require('./lib/cwos-utils');
const {
  resolveSessionId, readSessionDoc, lockFiles, listFileLocks, findFileLockConflicts,
  listLiveSessions, staleActiveSessions,
} = require('./lib/cwos-claims');

/**
 * Shared derived state: rebuilt by `cwos-reconcile`, written by whichever session
 * happens to run a command, owned by none of them.
 *
 * Bundling these into a session's commit is what forces whoever commits to carry
 * every other session's state churn — the founder's actual complaint. They are
 * excluded from scoped staging by default and reinstated with --include-derived
 * for the deliberate case (a reconcile whose whole point IS the index refresh).
 *
 * Hardcoded rather than configurable on purpose: these four are CWOS's own files
 * and identical in every adopted repo, and a config key nothing else reads is the
 * declaration-without-a-consumer class this item is filed under.
 */
const SHARED_DERIVED = [
  '.claude/workstream/queue-index.yaml',
  '.claude/workstream/sprint-index.yaml',
  '.claude/workstream/events/current.jsonl',
  'system/events.log.md',
  // Same class by a different route: stamped by whichever session's hook fired
  // last, so it is nobody's change in particular.
  '.claude/workstream/.hooks-liveness.yaml',
];

/**
 * A session record belongs to the session it names — a PROOF of ownership as
 * strong as mtime, and one that mtime gets wrong: a peer's heartbeat rewrites
 * its record after my session started, so the timestamp test reads it as mine.
 * Measured on this very change: a scoped stage picked up two peers' records.
 */
function peerSessionRecord(file, mySessionId) {
  const m = file.match(/^\.claude\/workstream\/sessions\/(?:session-)?(.+)\.yaml$/);
  if (!m) return false;
  return !mySessionId || m[1] !== mySessionId;
}

/**
 * Tree-wide staging/stashing: sweeps whatever is in the tree, mine or not.
 *
 * `git add <path>` is deliberately absent — explicit paths are the workflow this
 * steers toward, and blocking them would make the repo unusable.
 *
 * Every pattern is anchored to a COMMAND BOUNDARY (start of line, or after a
 * `;`, `&&`, `||`, or pipe). Without the anchor, a command that merely mentions
 * the string — `echo '{"command":"git add -A"}' | node …`, or a grep for it —
 * is blocked, and a guard that cries wolf gets disabled.
 *
 * Matched CASE-SENSITIVELY, against the raw command: git flags are case
 * sensitive, and lowercasing first silently turns `-A` into `-a` and makes every
 * pattern here dead on arrival.
 */
const BOUNDARY = '(?:^|[;&|]\\s*|\\n\\s*)';
const SWEEPS_TREE = [
  new RegExp(`${BOUNDARY}git\\s+add\\s+(?:-[A-Za-z]*\\s+)*(?:-A|--all|\\.)(?:\\s|$)`),
  new RegExp(`${BOUNDARY}git\\s+add\\s+-[A-Za-z]*A`),               // bundled short flags, e.g. -uA
  new RegExp(`${BOUNDARY}git\\s+commit\\s+(?:-a|--all)(?:\\s|$)`),
  new RegExp(`${BOUNDARY}git\\s+commit\\s+-[A-Za-z]*a[A-Za-z]*(?:\\s|$)`), // -am, -na, ...
  new RegExp(`${BOUNDARY}git\\s+stash(?:\\s|$)`),                   // stashes other sessions' work too
];

const CLI = {
  name: 'cwos-git',
  summary: 'session-scoped staging and per-file ownership',
  subcommands: {
    stage: 'stage this session\'s changed files (never the whole tree)',
    record: 'record that this session modified <paths> (PostToolUse hook entry)',
    locks: 'report which session holds which files',
    guard: 'PreToolUse Bash hook — refuse tree-wide staging when the tree is shared',
    worktree: 'create/list/remove an isolated worktree for unattended work',
  },
  flags: {
    'dry-run': { type: 'boolean', describe: 'print what would be staged, stage nothing' },
    'include-derived': { type: 'boolean', describe: 'also stage shared derived state (indexes, event log)' },
    json: { type: 'boolean', describe: 'machine-readable output' },
    quiet: { type: 'boolean', describe: 'suppress non-error output' },
    force: { type: 'boolean', describe: 'stage paths even when another live session holds them' },
    'repo-root': { type: 'string', placeholder: 'path', describe: 'override repo root discovery' },
  },
  notes: [
    'stage with no paths  — every changed file this session can prove is its own',
    'stage <paths...>     — those paths, refused if a live peer holds one (--force overrides)',
    '',
    'Shared derived state (queue-index.yaml, sprint-index.yaml, events/current.jsonl,',
    'system/events.log.md) is excluded unless --include-derived: reconcile rebuilds it,',
    'and bundling it makes whoever commits carry every session\'s churn.',
    '',
    'worktree create <topic> | worktree list | worktree remove <topic>',
    'Worktrees carry CODE. Workstream state stays in the main tree — see',
    'docs/worktree-isolation.md and lib/worktree-guard.js.',
  ].join('\n'),
};

// ─── context ────────────────────────────────────────────────────────────────

function context(values) {
  const root = values['repo-root'] ? path.resolve(values['repo-root']) : findRepoRoot(process.cwd());
  let wsDir = null;
  try { wsDir = findWorkstreamDir(root); } catch { /* not a CWOS repo */ }
  const sessionId = wsDir ? resolveSessionId(wsDir, { create: false }) : null;
  return { root, wsDir, sessionId };
}

/** Wall-clock ms this session started, from its own registry record. */
function sessionStartMs(wsDir, sessionId) {
  if (!wsDir || !sessionId) return null;
  const doc = readSessionDoc(path.join(wsDir, 'sessions', `${sessionId}.yaml`));
  if (!doc) return null;
  const t = Date.parse(String(doc.started_at || '').replace(/^"|"$/g, ''));
  return Number.isFinite(t) ? t : null;
}

/**
 * Changed paths, repo-relative with posix separators.
 *
 * `-uall` is load-bearing: by default git COLLAPSES an untracked directory to a
 * single entry (`.claude/`). Staging that one entry sweeps every new file
 * underneath it — including other sessions' — which is precisely the behaviour
 * this script exists to prevent, arriving through the back door. Caught by the
 * fixture suite, where a scoped stage reported staging exactly `.claude/`.
 */
function changedFiles(root) {
  const r = runGit(['status', '--porcelain', '-z', '-uall'], { cwd: root, timeout: 15000 });
  if (!r.ok) return [];
  // -z: NUL-separated, no quoting/escaping of unicode or spaces. The non-z form
  // wraps such paths in quotes, and a quoted path handed back to `git add` does
  // not match anything — a silent partial stage.
  const out = [];
  for (const rec of String(r.stdout).split('\0')) {
    if (!rec || rec.length < 4) continue;
    const status = rec.slice(0, 2);
    let p = rec.slice(3);
    if (status[0] === 'R' || status[1] === 'R') continue; // rename: dest arrives separately
    out.push(p.split('\\').join('/'));
  }
  return out;
}

const isDerived = (f) => SHARED_DERIVED.includes(f);

// ─── stage ──────────────────────────────────────────────────────────────────

/**
 * Classify every changed file as mine / foreign / unprovable.
 *
 * `foreign` is one of two proofs: the file was modified before this session
 * existed, or a DIFFERENT session holds a lock on it. `unprovable` means this
 * process cannot even identify itself, and is deliberately not folded into
 * "mine" — unprovable solitude is what burned 2026-08-01.
 */
function classifyChanges(ctx, opts = {}) {
  const files = changedFiles(ctx.root);
  const startMs = sessionStartMs(ctx.wsDir, ctx.sessionId);
  const cannotTell = !ctx.sessionId || !startMs;

  const locks = ctx.wsDir ? listFileLocks(ctx.wsDir) : [];
  const heldByOther = new Map();
  for (const h of locks) {
    if (h.session_id === ctx.sessionId) continue;
    for (const f of h.files) heldByOther.set(f, h);
  }

  const mine = [];
  const foreign = [];
  const derived = [];
  for (const f of files) {
    if (isDerived(f)) { derived.push(f); continue; }
    const holder = heldByOther.get(f);
    if (holder) { foreign.push({ file: f, why: `held by ${holder.session_id}${holder.live ? ' (live)' : ''}` }); continue; }
    if (peerSessionRecord(f, ctx.sessionId)) {
      foreign.push({ file: f, why: 'another session\'s registry record' });
      continue;
    }
    if (cannotTell) continue;
    let mtime = null;
    try { mtime = fs.statSync(path.join(ctx.root, f)).mtimeMs; } catch { /* deleted */ }
    if (mtime != null && mtime < startMs) {
      foreign.push({ file: f, why: 'modified before this session started' });
      continue;
    }
    mine.push(f);
  }
  return { files, mine, foreign, derived, cannot_tell: cannotTell, session_start: startMs };
}

function cmdStage(ctx, values, paths) {
  const dry = values['dry-run'];
  const out = { staged: [], skipped: [], refused: [], derived_excluded: [] };

  let toStage;
  if (paths.length) {
    // Explicit paths: the founder (or the AI) named them, so the only question is
    // whether a LIVE peer holds one. A dead session's lock is history, not a veto.
    const conflicts = ctx.wsDir
      ? findFileLockConflicts(ctx.wsDir, ctx.sessionId, paths).filter((c) => c.live)
      : [];
    if (conflicts.length && !values.force) {
      out.refused = conflicts;
      report(values, out, ctx,
        `Refusing to stage ${conflicts.length} file(s) held by another LIVE session:\n`
        + conflicts.map((c) => `  ${c.file} — ${c.session_id}`).join('\n')
        + '\n\nCoordinate, or override with --force if you know the other session is done.');
      return 1;
    }
    toStage = paths.map((p) => String(p).split('\\').join('/'));
  } else {
    const cls = classifyChanges(ctx);
    if (cls.cannot_tell) {
      report(values, { ...out, cannot_tell: true }, ctx,
        'Cannot identify this session (no registry record), so ownership cannot be\n'
        + 'established. Failing closed rather than guessing — stage by explicit path:\n'
        + '  node kit/scripts/cwos-git.js stage <path> [<path> ...]');
      return 1;
    }
    toStage = cls.mine;
    out.skipped = cls.foreign;
    out.derived_excluded = cls.derived;
  }

  if (values['include-derived']) {
    const present = new Set(changedFiles(ctx.root));
    for (const d of SHARED_DERIVED) if (present.has(d)) toStage.push(d);
    out.derived_excluded = [];
  }

  if (!toStage.length) {
    report(values, out, ctx, 'Nothing to stage for this session.');
    return 0;
  }

  if (!dry) {
    // Chunked: a Windows command line caps out well before a large sweep does.
    for (let i = 0; i < toStage.length; i += 50) {
      const chunk = toStage.slice(i, i + 50);
      const r = runGit(['add', '--', ...chunk], { cwd: ctx.root, timeout: 30000 });
      if (!r.ok) {
        report(values, out, ctx, `git add failed: ${String(r.stderr).trim()}`);
        return 1;
      }
      out.staged.push(...chunk);
    }
    // Staging a file is an assertion of ownership — record it so a peer's guard
    // can SEE it rather than infer it from timestamps.
    if (ctx.wsDir && ctx.sessionId) lockFiles(ctx.wsDir, ctx.sessionId, out.staged);
  } else {
    out.staged = toStage;
  }

  const lines = [`${dry ? 'Would stage' : 'Staged'} ${out.staged.length} file(s) for ${ctx.sessionId || 'this session'}.`];
  if (out.skipped.length) {
    lines.push(`Left alone — not this session's (${out.skipped.length}):`);
    for (const s of out.skipped.slice(0, 20)) lines.push(`  ${s.file} — ${s.why}`);
    if (out.skipped.length > 20) lines.push(`  ... and ${out.skipped.length - 20} more`);
  }
  if (out.derived_excluded.length) {
    lines.push(`Shared derived state excluded (${out.derived_excluded.length}) — reconcile rebuilds it; --include-derived to override:`);
    for (const d of out.derived_excluded) lines.push(`  ${d}`);
  }
  report(values, out, ctx, lines.join('\n'));
  return 0;
}

// ─── record (hook entry) ────────────────────────────────────────────────────

/**
 * Note that this session modified these files.
 *
 * Wired as a PostToolUse hook on Edit|Write|NotebookEdit, this is what gives
 * `files_locked` a live writer — the field has existed in the session schema
 * since adoption with zero writers anywhere in the kit, which is the same shape
 * WS-533 diagnosed for `claimed_by` and fixed only for items.
 */
function cmdRecord(ctx, values, paths) {
  let files = paths.slice();
  if (!files.length) {
    // Hook payload on stdin: { tool_input: { file_path | notebook_path | edits } }
    try {
      const raw = fs.readFileSync(0, 'utf8');
      if (raw && raw.trim()) {
        const p = JSON.parse(raw);
        const ti = (p && p.tool_input) || {};
        for (const k of ['file_path', 'notebook_path', 'path']) {
          if (ti[k]) files.push(String(ti[k]));
        }
      }
    } catch { /* not a hook invocation */ }
  }
  if (!files.length || !ctx.wsDir || !ctx.sessionId) return 0; // silent: a hook must never be noisy

  // Store repo-relative so a lock means the same thing to every session,
  // whatever cwd each one happens to have.
  const rel = files.map((f) => {
    const abs = path.isAbsolute(f) ? f : path.resolve(ctx.root, f);
    return path.relative(ctx.root, abs).split('\\').join('/');
  }).filter((f) => f && !f.startsWith('..'));

  if (!rel.length) return 0;
  const held = lockFiles(ctx.wsDir, ctx.sessionId, rel);
  if (values.json) process.stdout.write(JSON.stringify({ session: ctx.sessionId, held }) + '\n');
  else if (!values.quiet) process.stdout.write(`recorded ${rel.length} file(s) for ${ctx.sessionId}\n`);
  return 0;
}

// ─── locks ──────────────────────────────────────────────────────────────────

function cmdLocks(ctx, values) {
  const holders = ctx.wsDir ? listFileLocks(ctx.wsDir) : [];
  if (values.json) {
    process.stdout.write(JSON.stringify({ session: ctx.sessionId, holders }, null, 2) + '\n');
    return 0;
  }
  if (!holders.length) {
    process.stdout.write('No file locks held.\n');
    return 0;
  }
  for (const h of holders) {
    const me = h.session_id === ctx.sessionId ? ' (this session)' : '';
    process.stdout.write(`${h.session_id}${me} — ${h.live ? 'live' : 'NOT heartbeating'}${h.host ? ` on ${h.host}` : ''}\n`);
    for (const f of h.files.slice(0, 40)) process.stdout.write(`  ${f}\n`);
    if (h.files.length > 40) process.stdout.write(`  ... and ${h.files.length - 40} more\n`);
  }
  return 0;
}

// ─── guard (PreToolUse hook) ────────────────────────────────────────────────

/**
 * Refuse a tree-wide stage/stash while the tree holds work that is not ours.
 *
 * Promoted from claude-poker-tracker's repo-local `.claude/hooks/git-guard.cjs`,
 * which proved the shape in production. Its documented gap — "a session that
 * started BEFORE ours and edits AFTER we began is invisible to both arms" — is
 * closed here by the third arm, `files_locked`, which now has a live writer.
 *
 * Blocking is the recoverable direction: `git add <path>` is never blocked, and
 * a commit spanning three workstreams is what makes a defect unattributable
 * later. Reads the hook payload on stdin; exit 2 blocks, exit 0 allows.
 */
function cmdGuard(ctx, values) {
  let command = '';
  try {
    const raw = fs.readFileSync(0, 'utf8');
    if (raw && raw.trim()) command = (JSON.parse(raw).tool_input || {}).command || '';
  } catch { return 0; } // unparseable payload: not our business
  const cmd = String(command).replace(/\s+/g, ' ').trim();
  if (!cmd || !SWEEPS_TREE.some((re) => re.test(cmd))) return 0;

  const cls = classifyChanges(ctx);
  const peers = ctx.wsDir ? listLiveSessions(ctx.wsDir, ctx.sessionId) : [];
  if (!cls.foreign.length && !peers.length && !cls.cannot_tell) return 0;

  const say = (s) => process.stderr.write(s + '\n');
  say('BLOCKED: tree-wide staging would capture work that is not this session\'s.');
  say('');
  if (cls.foreign.length) {
    say(`Not this session's (${cls.foreign.length}):`);
    for (const f of cls.foreign.slice(0, 30)) say(`  ${f.file} — ${f.why}`);
    if (cls.foreign.length > 30) say(`  ... and ${cls.foreign.length - 30} more`);
    say('');
  }
  if (peers.length) {
    say(`Sessions live right now (${peers.length}) — possibly mid-edit:`);
    for (const p of peers) {
      const items = p.claimed_items.length ? ` holds ${p.claimed_items.join(', ')}` : '';
      say(`  - ${p.id}${items} (heartbeat ${p.last_heartbeat || 'never'})`);
    }
    say('');
  }
  if (cls.cannot_tell) {
    say('This process has no resolvable session record, so ownership cannot be');
    say('established at all. Failing closed rather than guessing.');
    say('');
  }
  say('Stage your own files — never blocked:');
  say('  node kit/scripts/cwos-git.js stage        # everything provably yours');
  say('  git add <path> [<path> ...]               # or by explicit path');
  say('');
  const stale = ctx.wsDir ? staleActiveSessions(ctx.wsDir, { selfId: ctx.sessionId }) : [];
  if (stale.length) {
    say(`${stale.length} stale 'active' record(s) inflate this. Close them with /session-end, or:`);
    say('  node kit/scripts/cwos-session-recovery.js --auto');
  }
  return 2;
}

// ─── worktree ───────────────────────────────────────────────────────────────

/**
 * Isolation for unattended runs (WS-564 AC #10).
 *
 * POLICY. An interactive session works in the main tree: the founder is watching,
 * and visibility is the right tool — seeing another session's changes in
 * `git status` is information, not contention. An UNATTENDED run (HomeBase-
 * dispatched autopilot, /fleet-run, a scheduled cycle) has nobody watching, runs
 * for hours, and stages repeatedly. That is where a shared tree stops being
 * visibility and becomes a race, so it gets its own worktree.
 *
 * WORKTREES CARRY CODE, THE MAIN TREE OWNS STATE (WS-532). This is not a style
 * preference: `.claude/workstream/` is tracked, so a worktree FORKS it, and
 * `allocateNextWsId` scans the local queue dir — two worktrees issue the same
 * WS-id. Worse, `events/` is gitignored and does not travel into a worktree at
 * all, so an event appended there merges back never and the branch carries the
 * YAML changes without the events justifying them. `worktree-guard.js` enforces
 * this by refusing event writes from a linked worktree.
 *
 * The created worktree therefore records where its main tree is, and every
 * workstream command run from inside it must be pointed back at that tree:
 *
 *     node <main>/kit/scripts/cwos-next.js gate --workstream-dir <main>/.claude/workstream
 *
 * That is printed at creation time rather than left to memory.
 */
function cmdWorktree(ctx, values, positionals) {
  const action = positionals[0] || 'list';
  const topic = positionals[1];

  if (action === 'list') {
    const r = runGit(['worktree', 'list'], { cwd: ctx.root, timeout: 15000 });
    process.stdout.write(r.ok ? r.stdout : `worktree list failed: ${r.stderr}\n`);
    return r.ok ? 0 : 1;
  }

  if (action === 'remove') {
    if (!topic) { process.stderr.write('worktree remove needs a <topic>\n'); return 2; }
    const dir = path.join(ctx.root, '.claude', 'worktrees', `wt-${topic}`);
    const r = runGit(['worktree', 'remove', dir], { cwd: ctx.root, timeout: 30000 });
    if (!r.ok) { process.stderr.write(`worktree remove failed: ${String(r.stderr).trim()}\n`); return 1; }
    runGit(['branch', '-d', `wt/${topic}`], { cwd: ctx.root, timeout: 15000 });
    process.stdout.write(`removed worktree wt-${topic}\n`);
    return 0;
  }

  if (action !== 'create') {
    process.stderr.write(`unknown worktree action: ${action} (create|list|remove)\n`);
    return 2;
  }
  if (!topic || !/^[a-z0-9][a-z0-9-]*$/i.test(topic)) {
    process.stderr.write('worktree create needs a <topic> of [a-z0-9-]\n');
    return 2;
  }

  const dir = path.join(ctx.root, '.claude', 'worktrees', `wt-${topic}`);
  if (fs.existsSync(dir)) {
    process.stderr.write(`worktree already exists: ${dir}\n`);
    return 1;
  }
  const add = runGit(['worktree', 'add', dir, '-b', `wt/${topic}`], { cwd: ctx.root, timeout: 60000 });
  if (!add.ok) {
    process.stderr.write(`worktree add failed: ${String(add.stderr).trim()}\n`);
    return 1;
  }

  // `.claude/commands/` is gitignored, so a fresh worktree has ZERO slash
  // commands until this runs. Skipping it is the difference between an
  // unattended run that works and one that silently cannot invoke anything.
  const bootstrap = path.join(ctx.root, 'kit', 'scripts', 'cwos-node-bootstrap.js');
  if (fs.existsSync(bootstrap)) runNode(bootstrap, [], { cwd: dir, timeout: 60000 });

  // The marker is what makes the isolation contract legible from inside the
  // worktree — including to a session that did not create it.
  const marker = {
    kind: 'cwos-worktree',
    topic,
    branch: `wt/${topic}`,
    main_tree: ctx.root.split('\\').join('/'),
    workstream_dir: path.join(ctx.root, '.claude', 'workstream').split('\\').join('/'),
    created_by_session: ctx.sessionId || null,
    created_at: new Date().toISOString(),
    contract: 'Code lives here. Workstream state lives in main_tree — run /next, /workstream, '
            + '/pulse and any event-emitting command from there (see docs/worktree-isolation.md).',
  };
  try { fs.writeFileSync(path.join(dir, '.cwos-worktree.json'), JSON.stringify(marker, null, 2) + '\n'); }
  catch { /* non-fatal */ }

  if (values.json) { process.stdout.write(JSON.stringify(marker, null, 2) + '\n'); return 0; }
  process.stdout.write([
    `Created worktree ${dir} on branch wt/${topic}.`,
    '',
    'Code goes here. Workstream state does NOT — events/ is gitignored and cannot',
    'merge back, and WS-id allocation scans the local queue dir. Run state commands',
    'against the main tree:',
    `  node ${ctx.root}/kit/scripts/<script>.js --workstream-dir ${ctx.root}/.claude/workstream`,
    '',
    'Merge back, from the MAIN tree (master cannot be checked out twice):',
    `  git -C ${dir} rebase master`,
    `  git merge --ff-only wt/${topic}`,
    `  node kit/scripts/cwos-git.js worktree remove ${topic}`,
    '',
  ].join('\n'));
  return 0;
}

// ─── output ─────────────────────────────────────────────────────────────────

function report(values, payload, ctx, text) {
  if (values.json) {
    process.stdout.write(JSON.stringify({ session: ctx.sessionId, ...payload }, null, 2) + '\n');
  } else if (!values.quiet) {
    process.stdout.write(text + '\n');
  }
}

// ─── entry ──────────────────────────────────────────────────────────────────

function main() {
  const { values, positionals, sub } = cliGate(process.argv.slice(2), CLI);
  const ctx = context(values);

  switch (sub) {
    case 'stage':    return cmdStage(ctx, values, positionals);
    case 'record':   return cmdRecord(ctx, values, positionals);
    case 'locks':    return cmdLocks(ctx, values);
    case 'guard':    return cmdGuard(ctx, values);
    case 'worktree': return cmdWorktree(ctx, values, positionals);
    default:         return 2;
  }
}

module.exports = { SHARED_DERIVED, SWEEPS_TREE, classifyChanges, changedFiles };

if (require.main === module) {
  try {
    process.exit(main());
  } catch (err) {
    // `guard` runs as a PreToolUse hook: a crash here must not block every Bash
    // call in the session, so it fails OPEN and says why. Every other subcommand
    // is invoked deliberately and reports the failure honestly.
    const isGuard = process.argv[2] === 'guard';
    process.stderr.write(`cwos-git: ${err.message}\n`);
    process.exit(isGuard ? 0 : 1);
  }
}
