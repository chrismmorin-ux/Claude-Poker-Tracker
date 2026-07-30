/**
 * cwos-claims.js — session identity and work-item claims.
 *
 * THE GAP THIS CLOSES. Every queue item has carried `claimed_by` / `claimed_at` fields
 * since adoption, the session schema has carried `claimed_items` / `files_locked`, and
 * `cwos-session-recovery.js` can RELEASE a claim and detect a stale session. Nothing ever
 * ACQUIRED one — a repo-wide grep for writes to `claimed_by` found exactly one, and it is
 * the release. `/next`'s own documentation says approve "claims items"; it did not.
 *
 * The cost is not theoretical. Two Claude sessions ran concurrently in claude-poker-tracker
 * on 2026-07-29: one implementing WS-302, the other reading that session's uncommitted
 * files mid-flight and writing a research-doc section describing work that had not
 * finished, reporting a parameter value that the finished sweep contradicted. Both
 * appended to the same event log and queue index with no interlock. Nothing was lost only
 * because the overlap happened to land in documentation.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not change `status`. A `status: claimed`
 * value would flow into the queue/sprint reducers, `state/*.json`, and every candidate
 * filter, and the blast radius of that is far larger than the problem. Claims live in
 * their own fields and are advisory-with-teeth: `gate` reports them and blocks when they
 * collide, and nothing else in the pipeline has to learn a new status.
 *
 * STALENESS IS THE RELEASE VALVE. A claim from a session that stopped heartbeating is not
 * a conflict — a crashed session must never be able to permanently fence off the queue.
 * Liveness is read from the session YAML's `last_heartbeat` (maintained by
 * `cwos-heartbeat.js`), and a session whose file is missing entirely is dead by
 * definition.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { readYAMLFile, writeFileAtomic, withFileLock, patchYAMLFile } = require('./cwos-utils');

/** A claim older than this from a non-heartbeating session is reclaimable. */
const STALE_MINUTES = 90;

/**
 * Approximate wall-clock ms of the last boot.
 *
 * WHY THIS EXISTS ALONGSIDE THE TIMER (WS-533). A 90-minute staleness window is a
 * guess about whether a process is alive. Boot time is a PROOF: a heartbeat written
 * before the machine booted cannot belong to a running process, so the session is
 * dead no matter how recent the timestamp looks. This matters far more here than it
 * would elsewhere — G16 loses power routinely (battery), so "crashed less than 90
 * minutes ago" is its normal state, not an edge case. Relying on the timer alone
 * meant a dead session fenced off its claims for up to 90 minutes after every crash.
 *
 * os.uptime() avoids a shell-out and behaves the same on Windows and POSIX.
 */
function bootTimeMs() {
  try { return Date.now() - (os.uptime() * 1000); } catch { return null; }
}

/**
 * Is a recorded pid still running?
 *
 * signal 0 tests existence without delivering anything. EPERM means the process
 * exists but is owned by someone else — still existence. Returns null when the
 * question cannot be answered, which callers must NOT read as "dead": a missing
 * answer is exactly the fail-open shape this module warns about elsewhere.
 */
function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try { process.kill(pid, 0); return true; }
  catch (err) {
    if (err && err.code === 'EPERM') return true;
    if (err && err.code === 'ESRCH') return false;
    return null;
  }
}

const POINTER = '.current-session';

const nowISO = () => new Date().toISOString();

/**
 * Read the `.current-session` pointer, if it resolves to a session file that exists.
 *
 * A DANGLING POINTER IS NOT A SESSION. The pointer in claude-poker-tracker read
 * `ses-20260726-1930-dc-lanes` for three days while `sessions/` held nothing newer than
 * seven weeks — so every consumer that trusted the pointer (heartbeat, verify's
 * hook-liveness check) silently no-opped. Validate, do not assume.
 *
 * @returns {{id: string, file: string}|null}
 */
function readSessionPointer(wsDir) {
  const ptr = path.join(wsDir, POINTER);
  if (!fs.existsSync(ptr)) return null;
  let id = '';
  try { id = fs.readFileSync(ptr, 'utf8').trim(); } catch { return null; }
  if (!id) return null;
  for (const name of [`${id}.yaml`, `session-${id}.yaml`]) {
    const file = path.join(wsDir, 'sessions', name);
    if (fs.existsSync(file)) return { id, file };
  }
  return null; // dangling
}

/**
 * Minutes since a session last proved it was alive, or Infinity when unknowable.
 */
function minutesSinceHeartbeat(sessionFile, now = Date.now()) {
  let doc;
  // `readYAMLFile` returns a {ok, data, warnings} WRAPPER, not the document. Reading
  // `.status` off the wrapper yields undefined, which lands on the Infinity branch and
  // makes every session look dead — i.e. the conflict check passes vacuously and the
  // whole mechanism reports "all clear" while doing nothing. Caught in test; it is the
  // same fail-open shape this module's own comments warn about, so unwrap explicitly.
  try {
    const r = readYAMLFile(sessionFile);
    doc = (r && typeof r === 'object' && 'data' in r) ? r.data : r;
  } catch { return Infinity; }
  if (!doc) return Infinity;
  const status = String(doc.status || '').toLowerCase();
  if (status && status !== 'active') return Infinity; // completed/abandoned = not holding
  const beat = doc.last_heartbeat || doc.started_at;
  const t = beat ? Date.parse(String(beat).replace(/^"|"$/g, '')) : NaN;
  if (!Number.isFinite(t)) return Infinity;
  return (now - t) / 60000;
}

/**
 * Is the session identified by `id` still holding its claims?
 *
 * Two tests (WS-533):
 *   1. HEARTBEAT PREDATES LAST BOOT -> dead, definitively. No process survives a
 *      reboot, so this outranks any timer. On a machine that loses power routinely
 *      this is the common case, and the 90-minute timer alone got it wrong: a dead
 *      session fenced off its claims for up to 90 minutes after every crash.
 *   2. Otherwise, the staleness window.
 *
 * WHY PID LIVENESS IS *NOT* A DEATH TEST, despite being tempting. The pid on a
 * session record is written by a short-lived hook process, so it is gone moments
 * later — testing it declared every session dead the instant it registered. Even
 * recording the parent pid is unreliable: the parent may be a transient shell.
 * And the error is not symmetric. Reading a LIVE session as dead releases its
 * claims and re-enables the concurrent clobbering this module exists to prevent,
 * whereas reading a dead session as live merely costs a stale warning. So we fail
 * conservative: pid is recorded for humans and diagnostics, never for the verdict.
 */
function isSessionLive(wsDir, id, staleMinutes = STALE_MINUTES, now = Date.now(), opts = {}) {
  if (!id) return false;
  for (const name of [`${id}.yaml`, `session-${id}.yaml`]) {
    const file = path.join(wsDir, 'sessions', name);
    if (!fs.existsSync(file)) continue;

    const doc = readSessionDoc(file);
    if (!doc) return false;
    const status = String(doc.status || '').toLowerCase();
    if (status && status !== 'active') return false;

    const boot = opts.bootTimeMs !== undefined ? opts.bootTimeMs : bootTimeMs();
    const beat = doc.last_heartbeat || doc.started_at;
    const beatMs = beat ? Date.parse(String(beat).replace(/^"|"$/g, '')) : NaN;
    if (Number.isFinite(beatMs) && boot != null && beatMs < boot) return false; // (1)

    return minutesSinceHeartbeat(file, now) <= staleMinutes;                     // (2)
  }
  return false; // no session file — dead by definition
}

/** Unwrap readYAMLFile's {ok,data} wrapper. See minutesSinceHeartbeat's warning. */
function readSessionDoc(file) {
  try {
    const r = readYAMLFile(file);
    return (r && typeof r === 'object' && 'data' in r) ? r.data : r;
  } catch { return null; }
}

/**
 * Every session that currently reads as live, excluding `selfId`.
 *
 * This is the answer to "is another session working in this repo right now?" — the
 * question that took 40 minutes to answer from mtimes and a process list during the
 * 2026-07-26 incident.
 */
function listLiveSessions(wsDir, selfId = null, opts = {}) {
  const sessDir = path.join(wsDir, 'sessions');
  let files = [];
  try { files = fs.readdirSync(sessDir).filter((f) => f.endsWith('.yaml')); } catch { return []; }

  const out = [];
  for (const f of files) {
    const doc = readSessionDoc(path.join(sessDir, f));
    if (!doc || String(doc.status || '').toLowerCase() !== 'active') continue;
    const id = doc.id || f.replace(/\.yaml$/, '');
    if (selfId && id === selfId) continue;
    if (!isSessionLive(wsDir, id, opts.staleMinutes || STALE_MINUTES, opts.now || Date.now(), opts)) continue;
    out.push({
      id,
      pid: doc.pid != null ? Number(doc.pid) : null,
      last_heartbeat: doc.last_heartbeat || null,
      claimed_items: Array.isArray(doc.claimed_items) ? doc.claimed_items : [],
      mode: doc.mode || null,
    });
  }
  return out;
}

/**
 * Is the registry itself trustworthy, or is it silently dead? (WS-533 item 4)
 *
 * A registry that stops recording reports "no other session" when it means "no
 * data", and that is strictly worse than having none — it converts absence of
 * evidence into an all-clear. This is the same failure class .hooks-liveness.yaml
 * tracks for hooks, and it is what let the registry rot unnoticed from 2026-05-15
 * to 2026-07-26.
 *
 * @returns {{ok: boolean, reason: string|null}}
 */
function registryHealth(wsDir, opts = {}) {
  const sessDir = path.join(wsDir, 'sessions');
  if (!fs.existsSync(sessDir)) {
    return { ok: false, reason: 'no sessions/ directory — nothing has ever registered' };
  }
  let files = [];
  try { files = fs.readdirSync(sessDir).filter((f) => f.endsWith('.yaml')); } catch {
    return { ok: false, reason: 'sessions/ is unreadable' };
  }
  if (files.length === 0) {
    return { ok: false, reason: 'sessions/ is empty — registration is not happening' };
  }

  // Newest record by heartbeat/start. If the freshest entry is ancient, the
  // registry is not being fed even though files exist.
  let newest = 0;
  for (const f of files) {
    const doc = readSessionDoc(path.join(sessDir, f));
    if (!doc) continue;
    const t = Date.parse(String(doc.last_heartbeat || doc.started_at || '').replace(/^"|"$/g, ''));
    if (Number.isFinite(t) && t > newest) newest = t;
  }
  if (!newest) return { ok: false, reason: 'no session record carries a usable timestamp' };

  const maxAgeDays = opts.maxAgeDays != null ? opts.maxAgeDays : 14;
  const ageDays = ((opts.now || Date.now()) - newest) / 86400000;
  if (ageDays > maxAgeDays) {
    return {
      ok: false,
      reason: `newest session record is ${Math.floor(ageDays)}d old (max ${maxAgeDays}d) — `
            + 'registration has stopped; treat "no other session" as UNKNOWN, not all-clear',
    };
  }
  return { ok: true, reason: null };
}

/**
 * The harness's id for the session this process belongs to, if discoverable.
 *
 * Claude Code exports `CLAUDE_CODE_SESSION_ID` into every subprocess it spawns, so any
 * script the AI runs through Bash can identify its OWN session without a hook payload.
 */
function agentSessionIdFromEnv() {
  const v = process.env.CLAUDE_CODE_SESSION_ID;
  return v && String(v).trim() ? String(v).trim() : null;
}

/** The registry record whose `agent_session_id` matches, or null. */
function findByAgentSessionId(wsDir, agentId) {
  if (!agentId) return null;
  const sessDir = path.join(wsDir, 'sessions');
  let files = [];
  try { files = fs.readdirSync(sessDir).filter((f) => f.endsWith('.yaml')); } catch { return null; }
  for (const f of files) {
    const doc = readSessionDoc(path.join(sessDir, f));
    if (doc && String(doc.agent_session_id || '') === String(agentId)) {
      return { id: doc.id || f.replace(/\.yaml$/, ''), file: path.join(sessDir, f) };
    }
  }
  return null;
}

/**
 * Resolve this process's session id, minting one when nothing else identifies it.
 *
 * RESOLUTION ORDER, and why it is not just the pointer (WS-533):
 *   1. `CLAUDE_CODE_SESSION_ID` matched against the registry. This is the only source
 *      that is CORRECT UNDER CONCURRENCY. `.current-session` holds exactly one id, so
 *      with two live sessions it names whichever registered last — and a claim written
 *      under the pointer would be attributed to the OTHER session, silently making the
 *      conflict detector believe the wrong thing about who holds what.
 *   2. The pointer, for single-session repos and for records predating this field.
 *   3. Mint, so a session in a context where no hook ran (headless `claude -p`,
 *      /fleet-run) still has an identity to claim under rather than falling back to the
 *      no-identity behaviour that produced the collision this module exists to prevent.
 *
 * Minting writes a MINIMAL session YAML — enough for liveness and claim ownership, in the
 * same shape `/session-end` and `cwos-session-recovery` already read. It is deliberately
 * not a substitute for `/session-start`'s richer record.
 */
function resolveSessionId(wsDir, { create = true, clock = null } = {}) {
  const agentId = agentSessionIdFromEnv();
  const mine = findByAgentSessionId(wsDir, agentId);
  if (mine) return mine.id;

  // Only trust the shared pointer when this process has no identity of its own;
  // with an agentId in hand, an unmatched pointer means the pointer belongs to a
  // DIFFERENT session and adopting it would misattribute every claim we write.
  if (!agentId) {
    const existing = readSessionPointer(wsDir);
    if (existing) return existing.id;
  }
  if (!create) return null;

  const ts = (clock ? new Date(clock) : new Date()).toISOString();
  const stamp = ts.slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  // Suffix from the harness id, not "auto": two sessions minting in the same minute
  // would otherwise derive the SAME id, write to the same file, and each believe it
  // owned the other's claims.
  const suffix = agentId ? String(agentId).replace(/[^A-Za-z0-9]/g, '').slice(0, 8) : 'auto';
  const id = `ses-${stamp}-${suffix}`;
  const sessionsDir = path.join(wsDir, 'sessions');
  try { fs.mkdirSync(sessionsDir, { recursive: true }); } catch { /* exists */ }

  const file = path.join(sessionsDir, `${id}.yaml`);
  if (!fs.existsSync(file)) {
    writeFileAtomic(file, [
      `id: "${id}"`,
      'status: active',
      `started_at: "${ts}"`,
      'ended_at: null',
      'mode: auto',
      `last_heartbeat: "${ts}"`,
      // CLAUDE_PID is the actual Claude process; process.pid here is this
      // short-lived script. Diagnostic only either way — see isSessionLive.
      `pid: ${process.env.CLAUDE_PID || process.pid}`,
      // Written so the NEXT invocation finds this record by identity instead of
      // minting a second one for the same session.
      `agent_session_id: "${agentId || ''}"`,
      '',
      '# Minted by cwos-claims because no registered session matched this process.',
      '# A session that never ran /session-start still needs an identity to claim under.',
      'claimed_items: []',
      'files_locked: []',
      '',
    ].join('\n'));
  }
  // Best-effort legacy pointer. Not the identity of record: it holds one id and
  // cannot represent concurrent sessions.
  try { writeFileAtomic(path.join(wsDir, POINTER), id); } catch { /* non-fatal */ }
  return id;
}

/** Touch `last_heartbeat` so this session reads as live to everyone else. */
function touchSession(wsDir, id, clock = null) {
  if (!id) return;
  for (const name of [`${id}.yaml`, `session-${id}.yaml`]) {
    const file = path.join(wsDir, 'sessions', name);
    if (!fs.existsSync(file)) continue;
    try {
      patchYAMLFile(file, { last_heartbeat: (clock ? new Date(clock) : new Date()).toISOString() });
    } catch { /* best-effort: liveness is an optimisation, never a hard dependency */ }
    return;
  }
}

/** Read one queue item's claim fields without parsing the whole document. */
function readClaim(queuePath) {
  let raw;
  try { raw = fs.readFileSync(queuePath, 'utf8'); } catch { return null; }
  const by = raw.match(/^claimed_by:\s*(.*)$/m);
  const at = raw.match(/^claimed_at:\s*(.*)$/m);
  const st = raw.match(/^status:\s*(\S+)/m);
  const clean = (m) => {
    if (!m) return null;
    const v = m[1].trim().replace(/^["']|["']$/g, '');
    return (!v || v === 'null' || v === '~') ? null : v;
  };
  return { claimedBy: clean(by), claimedAt: clean(at), status: st ? st[1] : null };
}

/**
 * Every item id present in the queue DIRECTORY.
 *
 * Deliberately not `state/queue.json`. That cache is a reducer output which lags item
 * creation — WS-304 was absent from it minutes after being written — and it keys `items`
 * as an object rather than an array, so an `Array.isArray` guard against it silently
 * yields an empty set and the conflict check passes vacuously. A safety check that
 * degrades to "no conflicts" when its input is malformed is worse than no check. The
 * directory is the editable surface and is always current.
 */
function listQueueIds(wsDir) {
  const queueDir = path.join(wsDir, 'queue');
  let names = [];
  try { names = fs.readdirSync(queueDir); } catch { return []; }
  return names
    .filter((n) => /^[A-Za-z]+-\d+\.yaml$/.test(n))
    .map((n) => n.replace(/\.yaml$/, ''));
}

/**
 * Claims that would collide: held by a DIFFERENT session that is still alive.
 *
 * @param {string[]} [itemIds] - ids to check; defaults to the whole queue directory.
 * @returns {Array<{id, claimed_by, claimed_at, message}>}
 */
function findClaimConflicts(wsDir, mySessionId, itemIds, opts = {}) {
  const { staleMinutes = STALE_MINUTES, now = Date.now() } = opts;
  const out = [];
  const ids = (itemIds && itemIds.length) ? itemIds : listQueueIds(wsDir);
  for (const id of ids) {
    const queuePath = path.join(wsDir, 'queue', `${id}.yaml`);
    const claim = readClaim(queuePath);
    if (!claim || !claim.claimedBy) continue;
    if (claim.claimedBy === mySessionId) continue;
    if (claim.status === 'done') continue; // a closed item cannot be contended
    // Pass opts through so bootTimeMs is injectable — without it a caller cannot
    // test the pre-boot path deterministically and would silently be asserting
    // against the real machine's boot time.
    if (!isSessionLive(wsDir, claim.claimedBy, staleMinutes, now, opts)) continue; // stale — reclaimable
    out.push({
      id,
      claimed_by: claim.claimedBy,
      claimed_at: claim.claimedAt,
      message: `${id} is claimed by session ${claim.claimedBy}, which is still active. `
             + 'Two sessions editing the same item is how uncommitted work gets clobbered.',
    });
  }
  return out;
}

/** Write claims onto queue items and mirror them into the session record. */
function claimItems(wsDir, sessionId, itemIds, clock = null) {
  if (!sessionId || !itemIds || itemIds.length === 0) return [];
  const at = clock || nowISO();
  const claimed = [];
  for (const id of itemIds) {
    const queuePath = path.join(wsDir, 'queue', `${id}.yaml`);
    if (!fs.existsSync(queuePath)) continue;
    try {
      // Same lock the done-path uses, so a concurrent reconcile cannot interleave.
      withFileLock(queuePath + '.lock', () => {
        patchYAMLFile(queuePath, { claimed_by: sessionId, claimed_at: at });
      }, { ownerLabel: 'next:claim', maxWaitMs: 5000 });
      claimed.push(id);
    } catch { /* non-fatal: a failed claim degrades to today's behaviour, never blocks */ }
  }
  mirrorIntoSession(wsDir, sessionId, claimed);
  return claimed;
}

/** Clear claims — called when items close, so the queue does not accrete dead holds. */
function releaseItems(wsDir, itemIds) {
  for (const id of itemIds || []) {
    const queuePath = path.join(wsDir, 'queue', `${id}.yaml`);
    if (!fs.existsSync(queuePath)) continue;
    try {
      withFileLock(queuePath + '.lock', () => {
        patchYAMLFile(queuePath, { claimed_by: null, claimed_at: null });
      }, { ownerLabel: 'next:release', maxWaitMs: 5000 });
    } catch { /* non-fatal */ }
  }
}

/** Keep the session's own `claimed_items` list in step, for session-recovery to read. */
function mirrorIntoSession(wsDir, sessionId, itemIds) {
  if (!itemIds || itemIds.length === 0) return;
  for (const name of [`${sessionId}.yaml`, `session-${sessionId}.yaml`]) {
    const file = path.join(wsDir, 'sessions', name);
    if (!fs.existsSync(file)) continue;
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const existing = new Set();
      const block = raw.match(/^claimed_items:\s*(\[\]|\n(?:\s+-\s+.*\n?)*)/m);
      if (block && block[1] && block[1] !== '[]') {
        for (const m of block[1].matchAll(/-\s+"?([A-Za-z]+-\d+)"?/g)) existing.add(m[1]);
      }
      for (const id of itemIds) existing.add(id);
      const rendered = `claimed_items:\n${[...existing].map((i) => `  - "${i}"`).join('\n')}\n`;
      const next = /^claimed_items:/m.test(raw)
        ? raw.replace(/^claimed_items:\s*(\[\]|\n(?:\s+-\s+.*\n?)*)/m, rendered)
        : raw.trimEnd() + '\n' + rendered;
      writeFileAtomic(file, next);
    } catch { /* best-effort */ }
    return;
  }
}

module.exports = {
  STALE_MINUTES,
  bootTimeMs,
  isPidAlive,
  readSessionPointer,
  readSessionDoc,
  agentSessionIdFromEnv,
  findByAgentSessionId,
  resolveSessionId,
  isSessionLive,
  listLiveSessions,
  registryHealth,
  minutesSinceHeartbeat,
  touchSession,
  readClaim,
  listQueueIds,
  findClaimConflicts,
  claimItems,
  releaseItems,
};
