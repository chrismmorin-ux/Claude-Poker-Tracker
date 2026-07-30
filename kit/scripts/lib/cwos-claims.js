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
const path = require('path');
const { readYAMLFile, writeFileAtomic, withFileLock, patchYAMLFile } = require('./cwos-utils');

/** A claim older than this from a non-heartbeating session is reclaimable. */
const STALE_MINUTES = 90;

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
 */
function isSessionLive(wsDir, id, staleMinutes = STALE_MINUTES, now = Date.now()) {
  if (!id) return false;
  for (const name of [`${id}.yaml`, `session-${id}.yaml`]) {
    const file = path.join(wsDir, 'sessions', name);
    if (fs.existsSync(file)) return minutesSinceHeartbeat(file, now) <= staleMinutes;
  }
  return false; // no session file — dead by definition
}

/**
 * Resolve this process's session id, minting one when the pointer is absent or dangling.
 *
 * Minting writes a MINIMAL session YAML — enough for liveness and claim ownership, in the
 * same shape `/session-end` and `cwos-session-recovery` already read. It is deliberately
 * not a substitute for `/session-start`'s richer record; it exists so that a session which
 * never ran the ceremony still has an identity to claim under, rather than falling back to
 * the no-identity behaviour that produced the collision this module exists to prevent.
 */
function resolveSessionId(wsDir, { create = true, clock = null } = {}) {
  const existing = readSessionPointer(wsDir);
  if (existing) return existing.id;
  if (!create) return null;

  const ts = (clock ? new Date(clock) : new Date()).toISOString();
  const stamp = ts.slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const id = `ses-${stamp}-auto`;
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
      `pid: ${process.pid}`,
      '',
      '# Minted by cwos-claims because no valid .current-session pointer existed.',
      '# A session that never ran /session-start still needs an identity to claim under.',
      'claimed_items: []',
      'files_locked: []',
      '',
    ].join('\n'));
  }
  writeFileAtomic(path.join(wsDir, POINTER), id);
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
function findClaimConflicts(wsDir, mySessionId, itemIds, { staleMinutes = STALE_MINUTES, now = Date.now() } = {}) {
  const out = [];
  const ids = (itemIds && itemIds.length) ? itemIds : listQueueIds(wsDir);
  for (const id of ids) {
    const queuePath = path.join(wsDir, 'queue', `${id}.yaml`);
    const claim = readClaim(queuePath);
    if (!claim || !claim.claimedBy) continue;
    if (claim.claimedBy === mySessionId) continue;
    if (claim.status === 'done') continue; // a closed item cannot be contended
    if (!isSessionLive(wsDir, claim.claimedBy, staleMinutes, now)) continue; // stale — reclaimable
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
  readSessionPointer,
  resolveSessionId,
  isSessionLive,
  minutesSinceHeartbeat,
  touchSession,
  readClaim,
  listQueueIds,
  findClaimConflicts,
  claimItems,
  releaseItems,
};
