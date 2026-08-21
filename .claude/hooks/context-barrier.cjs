#!/usr/bin/env node
/**
 * context-barrier.cjs — PreToolUse hook on Read|Grep|Glob. THE BLIND (WS-424 / S6).
 *
 * WHAT THIS PROVES. `scripts/context/cwos-context-bundle-validate.cjs` used to state:
 * "It cannot prevent an agent from reading an excluded file. Nothing in this repo can;
 * the tools are not sandboxed per task." Both clauses are false. This file is the
 * counter-example: a `PreToolUse` matcher on `Read|Grep|Glob` that exits 2, which
 * blocks the call BEFORE it executes so the content never enters the context window.
 * The same mechanism already runs twice in this directory (`git-guard.cjs:276`,
 * `secrets-scan.cjs`).
 *
 * WHY A BARRIER AND NOT A WARNING. A warning about a read is a report about a harm
 * that has already completed — by the time the warning exists the tokens are in the
 * window and there is no state to restore. Reading is irreversible, so under the
 * three-clause rule this is clause 1: BLOCK AN IRREVERSIBLE ACT.
 *
 * WHAT IT STILL CANNOT DO, AND THIS PART IS TRUE. Harness-injected context —
 * `CLAUDE.md`, `.claude/rules/*`, auto-memory — lands in the window before any hook
 * runs. 51,684 bytes of it, measured. No hook can withhold that. Hence the honest rule:
 *
 *     DELIBERATE READS ARE ENFORCEABLE. HARNESS INJECTION IS NOT.
 *
 * That residue is exactly why the post-hoc control ships alongside this and is not
 * made redundant by it (S7): the audit trail covers harness injection and a subagent
 * returning a withheld file's content as a summary; the barrier covers the deliberate
 * read. Different holes. Both ship.
 *
 * FAILS OPEN, ALWAYS. No active declaration, expired declaration, unreadable bundle,
 * malformed input, or any internal throw exits 0 and permits the read. A withholding
 * mechanism that breaks CLOSED would make the repo unusable the first time it had a
 * bug, and would then be disabled — and a disabled control is worse than none because
 * it still looks like coverage.
 *
 * BYPASS IS ALLOWED AND RECORDED. Set CONTEXT_BARRIER_BYPASS=1. The read proceeds and
 * the event is appended to .claude/workstream/meta/context-barrier-log.yaml. A control
 * with an unrecorded escape valve is theatre; a control with no escape valve gets
 * turned off.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
/**
 * STATE PATHS ARE OVERRIDABLE, AND THE REASON IS A MEASURED CONTAMINATION.
 *
 * `scripts/__tests__/contextBarrier.test.js` spawned this hook with `cwd: REPO_ROOT`,
 * and these constants resolve from `__dirname`, so the suite wrote the PRODUCTION log
 * and created and deleted the PRODUCTION declaration file. Design-critique 2026-08-20
 * measured the result: of 1301 logged events, ~97% were test fixtures, and NO FIELD
 * distinguished a fixture from a session. The only observability surface this mechanism
 * has could not be used as evidence for anything -- and it was caught by noticing that
 * the daily event counts were multiples of 11, which is not a method anyone should
 * need twice.
 *
 * Two consequences, both load-bearing:
 *   - a test must redirect BOTH files, or it mutates live control state on a tree that
 *     routinely carries 3-7 concurrent sessions;
 *   - every record carries `source:`, so provenance is data rather than inference.
 */
const ACTIVE = process.env.CONTEXT_BARRIER_ACTIVE
  || path.join(REPO_ROOT, '.claude', 'context', 'active-bundle.json');
const BUNDLE_DIR = process.env.CONTEXT_BARRIER_BUNDLE_DIR
  || path.join(REPO_ROOT, '.claude', 'context', 'bundles');
const LOG = process.env.CONTEXT_BARRIER_LOG
  || path.join(REPO_ROOT, '.claude', 'workstream', 'meta', 'context-barrier-log.yaml');

// Redirecting the log is itself evidence of a harness, so `source` defaults to `test`
// even when a caller forgets to say so. Explicit beats inferred; inferred beats silent.
const SOURCE = process.env.CONTEXT_BARRIER_SOURCE
  || (process.env.CONTEXT_BARRIER_LOG ? 'test' : 'session');

/** Minimal `excludes:` reader. Avoids a YAML dependency in a hot per-tool-call path. */
function readExcludes(bundleId) {
  const file = path.join(BUNDLE_DIR, `${bundleId}.yaml`);
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const out = [];
  let inExcludes = false;
  for (const line of lines) {
    if (/^excludes:\s*$/.test(line)) { inExcludes = true; continue; }
    if (inExcludes && /^[A-Za-z_]/.test(line)) break;   // next top-level key
    if (!inExcludes) continue;
    const m = line.match(/^\s*-\s*path:\s*"?([^"#]+?)"?\s*$/);
    if (m) out.push(m[1].trim());
  }
  return out;
}

/**
 * The active withholding declaration, or null if there is none / it expired.
 *
 * FAIL-OPEN IS LOGGED. Adversarial review, 2026-08-06: a malformed
 * `active-bundle.json` disabled the barrier for the whole session and produced NO
 * record — "malformed JSON silently disabled the control" and "no declaration was
 * ever active" were indistinguishable in the log. Fail-open remains the right
 * behaviour; failing open SILENTLY does not. The second return value is the reason,
 * logged by the caller when a declaration file exists but could not be honoured.
 *
 * Absence of the file is NOT logged — that is the normal state on every tool call in
 * every ordinary session, and logging it would bury the signal in noise.
 */
function activeDeclaration() {
  if (!fs.existsSync(ACTIVE)) return { decl: null, reason: null };
  let decl;
  try { decl = JSON.parse(fs.readFileSync(ACTIVE, 'utf8')); }
  catch { return { decl: null, reason: 'malformed-declaration' }; }
  if (!decl || !decl.bundle_id) return { decl: null, reason: 'declaration-missing-bundle-id' };
  if (decl.expires_at) {
    const exp = Date.parse(decl.expires_at);
    // An unparseable or past expiry fails OPEN. A stale declaration must not
    // silently keep blocking reads for a task that finished days ago.
    if (!Number.isFinite(exp)) return { decl: null, reason: 'unparseable-expiry' };
    if (Date.now() > exp) return { decl: null, reason: 'expired-declaration' };
  }
  return { decl, reason: null };
}

/**
 * The control files. Editing or deleting these disables withholding, and the
 * adversarial review confirmed all three routes reached UNLOGGED — an agent could
 * `rm` the declaration, or rename `excludes:` in the bundle, and the record was
 * identical to a clean run. They are not withheld paths, so the exclude check never
 * looked at them.
 *
 * These are LOGGED, NOT BLOCKED, deliberately: ending a declaration is legitimate —
 * the hook's own block message instructs the user to delete the file. Blocking would
 * make a declaration un-endable. Logging converts a silent disable into a recorded
 * act, which is the same discipline as the recorded bypass.
 */
function controlFileTouch(blobLower) {
  if (blobLower.includes('active-bundle.json')) return 'active-bundle.json';
  if (blobLower.includes('/bundles/') || blobLower.includes('context/bundles')) return 'bundle-definition';
  return null;
}

/** Does `target` fall under withheld path `pattern`? Directory prefixes count. */
function matches(target, pattern) {
  if (!target || !pattern) return false;
  const norm = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
  const t = norm(target);
  const p = norm(pattern);
  if (p.startsWith('user_memory/')) return false;   // sentinel: harness-injected, unreachable
  if (t === p) return true;
  if (t.endsWith('/' + p)) return true;             // absolute target vs repo-relative pattern
  if (p.endsWith('/') && t.includes(p)) return true;
  if (t.includes('/' + p.replace(/\/$/, '') + '/')) return true;
  return false;
}

/**
 * DOES THIS INPUT REACH A WITHHELD FILE BY NAMING A DIRECTORY ABOVE IT?
 *
 * The leaf/substring check catches an input that NAMES the file. It does not catch an
 * input that names a container and lets the tool do the enumerating. Measured
 * 2026-08-20, against `.claude/context/MEASUREMENT_OVERSIGHTS.md` withheld:
 *
 *     Read the exact file .................. BLOCKED
 *     Grep rooted at .claude/context/ ...... ALLOWED
 *     Glob .claude/context/*.md ............ ALLOWED
 *     cat .claude/context/*.md ............. ALLOWED
 *     git grep -- .claude/context .......... ALLOWED
 *     Task "read every file under ..." ..... ALLOWED
 *
 * Five of six routes reached the content with no block and no record, which is the
 * same shape as the v1 tool-enumeration hole and worse: `cat <dir>/*` is strictly
 * easier to type than `head -3 <file>`, and the log still showed a clean run.
 *
 * THE RULE. A token is a directory reach if some withheld path starts with it plus a
 * separator. Two deliberate bounds:
 *
 *   - MINIMUM TWO SEGMENTS. `.claude/context` reaches; a bare `.claude` does not.
 *     One segment would blanket-block the session on `ls .claude`, and a control that
 *     makes the repo unusable gets switched off, which is worse than none.
 *   - A SPECIFIC FILE IS NOT A REACH. `.claude/context/POKER_THEORY.md` is a sibling,
 *     not a container -- no withheld path starts with it -- so reading a file the
 *     bundle does not withhold stays allowed. Over-blocking is the right error, but
 *     over-blocking the rest of the directory is not over-blocking, it is breakage.
 *
 * A wildcard truncates to its directory: `.claude/context/*.md` reaches via
 * `.claude/context`.
 */
function reachesByDirectory(hay, withheldPath) {
  const target = String(withheldPath).replace(/^[.][/]/, '').toLowerCase();
  if (target.startsWith('user_memory/')) return false;
  // `hay` is already lowercased with separators normalised to '/'.
  for (let tok of hay.split(/[^a-z0-9_.*/-]+/)) {
    if (!tok || tok.indexOf('/') === -1) continue;
    if (tok.indexOf('*') !== -1) tok = tok.slice(0, tok.indexOf('*'));   // glob -> its directory
    tok = tok.replace(/[/]+$/, '').replace(/^[.][/]/, '');
    if (tok.split('/').filter(Boolean).length < 2) continue;             // two-segment floor
    if (target === tok) continue;                                        // the file itself: leaf check owns it
    if (target.startsWith(tok + '/')) return true;                       // tok is a container
  }
  return false;
}

function recordBypass(entry) {
  try {
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    if (!fs.existsSync(LOG)) fs.writeFileSync(LOG, 'events:\n', 'utf8');
    // JSON.stringify, NOT hand-rolled quoting. A YAML 1.2 double-quoted scalar is
    // JSON-compatible, so one call is both correct YAML and TOTAL: backslashes,
    // newlines, quotes and control characters all escape in a single pass.
    //
    // The previous writer replaced `"` with `'` and did nothing else. On Windows that
    // made every absolute path an invalid scalar -- a path beginning `C:` followed by a
    // backslash and `U` reads as a malformed unicode escape -- and this log has been
    // UNPARSEABLE SINCE EVENT #3 OF 1301. Nothing ever read it, so nothing surfaced it
    // for 15 days. A writer whose output no parser accepts is not an audit trail.
    const q = (v) => JSON.stringify(String(v));
    const line = `  - at: ${q(new Date().toISOString())}
` +
      `    source: ${q(SOURCE)}
` +
      `    kind: ${q(entry.kind)}
` +
      `    bundle: ${q(entry.bundle)}
` +
      `    path: ${q(entry.path)}
` +
      `    tool: ${q(entry.tool)}
` +
      (entry.agent ? `    agent: ${q(entry.agent)}
` : '');
    fs.appendFileSync(LOG, line, 'utf8');
  } catch { /* logging must never break the tool call */ }
}

function main() {
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }

  let payload;
  try { payload = JSON.parse(raw || '{}'); } catch { process.exit(0); }

  const tool = payload.tool_name || '';
  const input = payload.tool_input || {};

  // NOTE THE DESTRUCTURING. `activeDeclaration()` returns { decl, reason }. An earlier
  // revision changed that shape to add fail-open logging and did NOT update this line,
  // so `decl.bundle_id` was `undefined`, `readExcludes` looked for `bundles/undefined.yaml`,
  // and EVERY call fell through to exit(0). The barrier was completely dead for a full
  // revision while its header still claimed, unqualified, that it blocks. The test file
  // that catches this in three seconds existed the whole time and was not run.
  const { decl, reason } = activeDeclaration();

  // A declaration that exists but cannot be honoured fails OPEN and SAYS SO. Silent
  // fail-open makes "malformed JSON disabled the control" indistinguishable from
  // "no declaration was ever active".
  if (!decl) {
    if (reason) recordBypass({ kind: `fail-open:${reason}`, bundle: '-', path: '-', tool, agent: payload.agent_type || '' });
    process.exit(0);
  }

  let excludes;
  try { excludes = readExcludes(decl.bundle_id); } catch { excludes = null; }
  if (!excludes || excludes.length === 0) {
    recordBypass({ kind: 'fail-open:unreadable-bundle', bundle: String(decl.bundle_id), path: '-', tool, agent: payload.agent_type || '' });
    process.exit(0);
  }

  // Touching the control files disables withholding and was previously UNLOGGED.
  // Logged, not blocked — ending a declaration is legitimate.
  try {
    const ctl = controlFileTouch(JSON.stringify(input).toLowerCase());
    if (ctl && !['Read', 'Grep', 'Glob'].includes(tool)) {
      recordBypass({ kind: 'control-file-touch', bundle: `${decl.bundle_id}:${ctl}`, path: '-', tool, agent: payload.agent_type || '' });
    }
  } catch { /* logging must never break the tool call */ }

  // GATE ON THE PATH, NOT ON THE TOOL NAME. This is the second design of this
  // function and the first one was wrong in a way only testing revealed.
  //
  // v1 matched Read|Grep|Glob. `head -3 <withheld>` walked straight past it and put
  // the content in the window, silently — no block, no bypass record. So the bundle's
  // core promise (knowing which findings were derived versus recalled) failed exactly
  // where it mattered, and failed invisibly: an agent could read every withheld source
  // and the log would still show a clean discovery run.
  //
  // Enumerating read-tools is the wrong SHAPE of fix, because the next unenumerated
  // tool reopens the hole — Bash, PowerShell, and file-reading MCP servers are all
  // content-reaching routes, and that list grows. So the check is now: does ANY field
  // of ANY tool's input name a withheld path? A path is a path whatever tool holds it.
  //
  // Over-blocking is the correct error here. A discovery task has no legitimate
  // business naming the file whose conclusion it is meant to derive, and the recorded
  // bypass is one environment variable away.
  let blob = '';
  try { blob = JSON.stringify(input); } catch { process.exit(0); }
  if (!blob || blob === '{}') process.exit(0);
  const hay = blob.replace(/\\\\/g, '/').replace(/\\/g, '/').toLowerCase();

  const hit = excludes.find(p => {
    // USER_MEMORY/ is a sentinel for harness-injected context. No hook can withhold
    // it — it is in the window before any hook runs — so matching on it would produce
    // blocks that cannot possibly be the enforcement they appear to be.
    if (String(p).startsWith('USER_MEMORY/')) return false;
    const base = String(p).replace(/\\/g, '/').toLowerCase();
    const leaf = base.split('/').pop();
    if (hay.includes(base)) return true;
    // Distinctive leaf names catch `cd .claude/context && cat MEASUREMENT_OVERSIGHTS.md`.
    // Length-gated so a generic leaf like `index.md` cannot blanket-block the session.
    if (leaf && leaf.length > 8 && hay.includes(leaf)) return true;
    // ...and naming a directory ABOVE it reaches it just as surely. See above.
    return reachesByDirectory(hay, base);
  });

  if (!hit) process.exit(0);

  const target = (input.file_path || input.path || input.notebook_path ||
    input.command || blob).toString().slice(0, 200);

  // Hooks fire inside subagents and carry agent identity — record it, because the
  // delegated read was the hole the greenfield arm named and left open.
  const agent = payload.agent_type || payload.agent_id || '';

  if (process.env.CONTEXT_BARRIER_BYPASS === '1') {
    recordBypass({ kind: 'bypass', bundle: decl.bundle_id, path: target, tool, agent });
    process.exit(0);
  }

  recordBypass({ kind: 'blocked', bundle: decl.bundle_id, path: target, tool, agent });

  console.error(`BLOCKED: "${hit}" is withheld by context bundle "${decl.bundle_id}".`);
  console.error('');
  console.error('This bundle runs in discovery mode: it withholds sources that already STATE the');
  console.error('conclusion the task is supposed to derive. The recorded failure this prevents was');
  console.error('not "we loaded too much" — it was a lens being told the answer and reporting that');
  console.error('it had found it.');
  console.error('');
  if (decl.task_id) console.error(`Active task: ${decl.task_id}`);
  if (agent) console.error(`Reading agent: ${agent}`);
  console.error('');
  console.error('If you re-derive something this file already contains, that is REPLICATION and it');
  console.error('is a good outcome — mark the entry replicated. The goal is not ignorance; it is');
  console.error('knowing which findings were derived and which were recalled.');
  console.error('');
  console.error('To read it anyway (recorded, not silent):');
  console.error('  CONTEXT_BARRIER_BYPASS=1');
  console.error('To end the declaration:  rm .claude/context/active-bundle.json');
  process.exit(2);
}

module.exports = { readExcludes, activeDeclaration, matches, reachesByDirectory };

if (require.main === module) {
  try { main(); } catch { process.exit(0); }  // fail open on ANY internal error
}
