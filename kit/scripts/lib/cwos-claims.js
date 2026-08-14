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
 *
 * EVERY LIVENESS TEST IS SCOPED TO A MACHINE (WS-564). `.claude/workstream/sessions/` is
 * TRACKED, so a session record written on CM-NODE1 arrives on G16 by git pull. Until this
 * was fixed there was no `host` field at all, yet the pid and boot-time tests ran against
 * the LOCAL process table and the LOCAL `os.uptime()`. Both directions were wrong on the
 * founder's laptop + phone + dispatched-node setup: a pid collision read a dead remote
 * session as alive and fenced the queue, and — far worse — the boot-time proof declared
 * every remote session whose heartbeat predated THIS machine's last boot to be dead, which
 * on hardware that loses power routinely is the normal case. That is claim-stealing while
 * the other machine is still working. So: proofs that are only valid locally are gated on
 * `host === os.hostname()`, and a foreign (or unknown) host degrades to heartbeat-only,
 * which is the direction that costs a stale warning rather than someone's work.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  readYAMLFile, writeFileAtomic, withFileLock, patchYAMLFile, upsertYAMLScalarField,
} = require('./cwos-utils');

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

/** This machine's identity, as stamped on session records. Never throws. */
function localHost() {
  try { return os.hostname(); } catch { return null; }
}

/**
 * Was `recordHost` written by THIS machine?
 *
 * A record with no host at all is treated as foreign, not as local. That is the
 * conservative reading: records predating WS-564 carry no host, and assuming they
 * are local re-enables the boot-time test against a heartbeat that may have been
 * written on another machine — the claim-stealing direction. Records self-heal on
 * the owning machine's next heartbeat (touchSession stamps the host), so the
 * unknown case is transient by construction.
 */
function isLocalHost(recordHost, opts = {}) {
  const here = opts.host !== undefined ? opts.host : localHost();
  if (!recordHost || !here) return false;
  return String(recordHost).trim().toLowerCase() === String(here).trim().toLowerCase();
}

/**
 * Is a recorded pid still running ON THIS MACHINE?
 *
 * signal 0 tests existence without delivering anything. EPERM means the process
 * exists but is owned by someone else — still existence. Returns null when the
 * question cannot be answered, which callers must NOT read as "dead": a missing
 * answer is exactly the fail-open shape this module warns about elsewhere.
 *
 * `recordHost` is mandatory in spirit even though it is optional in signature: a
 * pid is only meaningful against the process table that issued it. Asked about a
 * foreign host, this returns null (unknowable) rather than consulting the local
 * table, where pid 4242 belongs to something entirely unrelated. Omitting the
 * argument preserves the legacy local-only reading for callers that have already
 * established the record is local.
 */
function isPidAlive(pid, recordHost, opts = {}) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (recordHost !== undefined && !isLocalHost(recordHost, opts)) return null;
  try { process.kill(pid, 0); return true; }
  catch (err) {
    if (err && err.code === 'EPERM') return true;
    if (err && err.code === 'ESRCH') return false;
    return null;
  }
}

/**
 * The one question that decides recovery: is the process that OWNS this session
 * record still with us? (WS-351; restored 2026-08-13 after the 3.10.3 kit sync
 * dropped it — FIND-108.)
 *
 * → 'dead'    provably gone: pid absent from the local table, or the pid was
 *             recorded before the current boot (whatever holds that number now
 *             is a post-reboot recycle).
 * → 'live'    a process with that pid is running here, right now.
 * → 'unknown' the question is not answerable from this record on this machine.
 *
 * WHY THIS OVERRIDES THE "PID IS NEVER A DEATH TEST" RULE. That rule was written
 * against `resolveSessionId`'s pid, which is `process.pid` — the minting script,
 * gone milliseconds later. It is NOT true of the pid `cwos-session-register`
 * records, which is the Claude Code harness. The registrar dates its pid with
 * `pid_recorded_at`; only then is the field safe to read.
 *
 * THE ASYMMETRY IS STILL REAL, and 'live' is deliberately weaker than 'dead'.
 * One harness process serves several session records, so a live pid does NOT
 * prove THIS session is live — only that something is still there. Callers use
 * 'dead' as proof and 'live' as a veto on destructive action, never as a licence
 * to keep a session open past its heartbeat timeout.
 *
 * PID REUSE is handled for the case that actually happens — a reboot. A pid
 * recorded before the current boot cannot name a surviving process, so it reads
 * 'dead' no matter what the local table says. `started_at` is the stamp's
 * fallback because that is when both writers stamped the pid before the field
 * existed; records self-heal on the next SessionStart.
 *
 * HOST GATE, as everywhere else here: a pid from another machine is asked of the
 * wrong process table, so a foreign or unknown host degrades to 'unknown'.
 */
function sessionOwnerVerdict(doc, opts = {}) {
  if (!doc) return 'unknown';
  const pid = doc.pid == null ? NaN : Number(doc.pid);
  if (!Number.isInteger(pid) || pid <= 0) return 'unknown';
  if (!isLocalHost(doc.host, opts)) return 'unknown';

  const boot = opts.bootTimeMs !== undefined ? opts.bootTimeMs : bootTimeMs();
  if (boot != null) {
    const stamp = doc.pid_recorded_at || doc.started_at;
    const at = stamp ? Date.parse(String(stamp).replace(/^"|"$/g, '')) : NaN;
    if (!Number.isFinite(at)) return 'unknown';   // undateable pid — reuse unrulable-out
    if (at < boot) return 'dead';                 // predates the boot: gone, whoever holds it now
  }

  const alive = isPidAlive(pid, doc.host, opts);
  if (alive === false) return 'dead';
  if (alive === true) return 'live';
  return 'unknown';
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
 *      APPLIES ONLY TO SESSIONS RECORDED ON THIS HOST (WS-564). `sessions/` is a
 *      tracked directory, so records arrive from other machines by git pull, and
 *      "predates MY last boot" says nothing whatever about a process on CM-NODE1.
 *      Applying it anyway declared live remote sessions dead and released their
 *      claims mid-work.
 *   2. Otherwise, the staleness window.
 *
 * PID DEATH IS NOW TEST (0), AND IT OUTRANKS BOTH (WS-351). This used to say pid
 * liveness could never be a death test, because the recorded pid was a short-lived
 * hook. That was true of one of the two writers and false of the other, and the
 * field meant different things depending on which had written it — see
 * `sessionOwnerVerdict`, where the reasoning and the fix at the source now live.
 * With the writers made honest, a dead pid is the strongest death proof available:
 * it does not wait for a timer, so a crashed session stops fencing its claims the
 * moment the next hook fires rather than up to `staleMinutes` later.
 *
 * The asymmetry that produced the old rule is unchanged and still respected: a LIVE
 * pid buys nothing here. It cannot extend a session past its heartbeat window,
 * because one harness pid serves several session records and a stale record sharing
 * a live pid would otherwise read as a peer forever.
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

    if (sessionOwnerVerdict(doc, opts) === 'dead') return false;                 // (0)

    if (isLocalHost(doc.host, opts)) {
      const boot = opts.bootTimeMs !== undefined ? opts.bootTimeMs : bootTimeMs();
      const beat = doc.last_heartbeat || doc.started_at;
      const beatMs = beat ? Date.parse(String(beat).replace(/^"|"$/g, '')) : NaN;
      if (Number.isFinite(beatMs) && boot != null && beatMs < boot) return false; // (1)
    }

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
      host: doc.host || null,
      foreign_host: !isLocalHost(doc.host, opts),
      last_heartbeat: doc.last_heartbeat || null,
      claimed_items: Array.isArray(doc.claimed_items) ? doc.claimed_items : [],
      files_locked: Array.isArray(doc.files_locked) ? doc.files_locked : [],
      mode: doc.mode || null,
    });
  }
  return out;
}

/**
 * Records that SAY `status: active` but have not heartbeated inside `staleMinutes`.
 *
 * This is the population that makes every concurrency signal unusable in both
 * directions (WS-564). Heartbeat-trusting checks read them as absent and hand out a
 * confident all-clear; heartbeat-independent checks count them and fence the queue
 * forever. claude-poker-tracker held eight of these from 2026-07-30, several holding
 * claims, while `cwos-session-recovery` had not run since. Neither reading is usable
 * — so the population itself has to be surfaced rather than silently interpreted.
 */
function staleActiveSessions(wsDir, opts = {}) {
  const staleMinutes = opts.staleMinutes || STALE_MINUTES;
  const now = opts.now || Date.now();
  const sessDir = path.join(wsDir, 'sessions');
  let files = [];
  try { files = fs.readdirSync(sessDir).filter((f) => f.endsWith('.yaml')); } catch { return []; }

  const out = [];
  for (const f of files) {
    const doc = readSessionDoc(path.join(sessDir, f));
    if (!doc || String(doc.status || '').toLowerCase() !== 'active') continue;
    const id = doc.id || f.replace(/\.yaml$/, '');
    if (opts.selfId && id === opts.selfId) continue;
    const mins = minutesSinceHeartbeat(path.join(sessDir, f), now);
    if (mins <= staleMinutes) continue;
    out.push({
      id,
      host: doc.host || null,
      last_heartbeat: doc.last_heartbeat || null,
      minutes_stale: Number.isFinite(mins) ? Math.round(mins) : null,
      claimed_items: Array.isArray(doc.claimed_items) ? doc.claimed_items : [],
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
 * TWO QUESTIONS, NOT ONE (WS-564). The original check asked only "is REGISTRATION
 * happening", over a 14-day window. In claude-poker-tracker on 2026-08-02 that
 * answered yes — sessions were registering fine — while the Stop hook that advances
 * `last_heartbeat` had been dead for two days. So `isSessionLive` filtered every
 * peer out as not-live, `listLiveSessions` returned [], and this function said
 * ok:true. Three sessions were concurrently editing the repo. Both green, both
 * wrong, and the all-clear propagated into `/next`'s conflict gate.
 *
 * Registration recency and heartbeat currency are independent failures and are now
 * measured separately. A registry can only be believed when BOTH hold: records are
 * being created, and the active ones are proving they are still alive.
 *
 * @returns {{ok, reason, active_count, stale_active, newest_record_age_days,
 *            heartbeat_age_minutes}}
 */
function registryHealth(wsDir, opts = {}) {
  const base = {
    active_count: 0, stale_active: [], newest_record_age_days: null, heartbeat_age_minutes: null,
  };
  const sessDir = path.join(wsDir, 'sessions');
  if (!fs.existsSync(sessDir)) {
    return { ...base, ok: false, reason: 'no sessions/ directory — nothing has ever registered' };
  }
  let files = [];
  try { files = fs.readdirSync(sessDir).filter((f) => f.endsWith('.yaml')); } catch {
    return { ...base, ok: false, reason: 'sessions/ is unreadable' };
  }
  if (files.length === 0) {
    return { ...base, ok: false, reason: 'sessions/ is empty — registration is not happening' };
  }

  const now = opts.now || Date.now();

  // Newest record by heartbeat/start. If the freshest entry is ancient, the
  // registry is not being fed even though files exist.
  let newest = 0;
  let newestBeat = 0;
  let activeCount = 0;
  for (const f of files) {
    const doc = readSessionDoc(path.join(sessDir, f));
    if (!doc) continue;
    const t = Date.parse(String(doc.last_heartbeat || doc.started_at || '').replace(/^"|"$/g, ''));
    if (Number.isFinite(t) && t > newest) newest = t;
    if (String(doc.status || '').toLowerCase() !== 'active') continue;
    activeCount++;
    // Heartbeat currency is asked of `last_heartbeat` ALONE. Falling back to
    // started_at here would let a freshly-registered session that never beats
    // again certify the hook as working — the exact substitution that made the
    // 14-day window read healthy while the hook was dead.
    const hb = Date.parse(String(doc.last_heartbeat || '').replace(/^"|"$/g, ''));
    if (Number.isFinite(hb) && hb > newestBeat) newestBeat = hb;
  }
  if (!newest) return { ...base, ok: false, reason: 'no session record carries a usable timestamp' };

  const out = {
    ...base,
    active_count: activeCount,
    stale_active: staleActiveSessions(wsDir, opts).map((s) => s.id),
    newest_record_age_days: (now - newest) / 86400000,
    heartbeat_age_minutes: newestBeat ? (now - newestBeat) / 60000 : null,
  };

  const maxAgeDays = opts.maxAgeDays != null ? opts.maxAgeDays : 14;
  if (out.newest_record_age_days > maxAgeDays) {
    return {
      ...out,
      ok: false,
      reason: `newest session record is ${Math.floor(out.newest_record_age_days)}d old (max ${maxAgeDays}d) — `
            + 'registration has stopped; treat "no other session" as UNKNOWN, not all-clear',
    };
  }

  // Currency is only a question when something claims to be active. A repo whose
  // sessions have all been closed properly has nothing to keep current.
  const maxBeatMinutes = opts.maxHeartbeatMinutes != null ? opts.maxHeartbeatMinutes : 120;
  if (activeCount > 0) {
    if (out.heartbeat_age_minutes == null) {
      return {
        ...out,
        ok: false,
        reason: `${activeCount} session(s) marked active and not one carries a last_heartbeat — `
              + 'the Stop hook has never run here; liveness is UNKNOWN, not all-clear',
      };
    }
    if (out.heartbeat_age_minutes > maxBeatMinutes) {
      return {
        ...out,
        ok: false,
        reason: `${activeCount} session(s) marked active, freshest heartbeat is `
              + `${Math.floor(out.heartbeat_age_minutes / 60)}h${Math.floor(out.heartbeat_age_minutes % 60)}m old `
              + `(max ${maxBeatMinutes}m) — the Stop hook is not advancing liveness, so every peer `
              + 'filters out as not-live and "no conflicts" means UNKNOWN, not none',
      };
    }
  }

  return { ...out, ok: true, reason: null };
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
function resolveSessionId(wsDir, {
  create = true, clock = null, agentId: agentIdOverride = null, pointer = true,
} = {}) {
  // A hook process is handed the harness id on stdin rather than in the environment;
  // it passes that in here so there is ONE resolver instead of a second, subtly
  // different copy per hook. cwos-heartbeat.js had such a copy and fell through to
  // the pointer, which is why it beat the wrong session under concurrency (WS-564).
  const agentId = agentIdOverride || agentSessionIdFromEnv();
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
      // The machine that owns this record. Without it, every pid and boot-time
      // test on a git-synced session file is asked of the wrong process table
      // (WS-564). Recorded at mint AND re-stamped on every heartbeat, so a record
      // that moves machines corrects itself rather than staying wrong.
      `host: "${localHost() || ''}"`,
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
  //
  // `pointer: false` exists for CROSS-REPO minting (WS-564 follow-up). A session
  // whose cwd is repo A can edit files in repo B — the founder's normal pattern —
  // and B's registry should learn about it. But repointing B's `.current-session`
  // at a session that merely touched one file would be a genuinely wrong claim
  // about who is working there, and the pointer's remaining consumers read it as
  // "the session in this repo". Register the identity, leave the pointer alone.
  if (pointer) {
    try { writeFileAtomic(path.join(wsDir, POINTER), id); } catch { /* non-fatal */ }
  }
  return id;
}

/**
 * Touch `last_heartbeat` so this session reads as live to everyone else.
 *
 * Stamps `host` in the same write. The process doing the touching is, by
 * definition, running on the machine that owns the session, so this is the one
 * place the host can be established without guessing — and it makes the field
 * self-healing for records minted before WS-564 and for a repo that has just been
 * pulled onto a different machine.
 *
 * @returns {boolean} whether a record was actually advanced. Callers that treat a
 * no-op as success are how a liveness stamp outlives the liveness it certifies.
 */
function touchSession(wsDir, id, clock = null) {
  if (!id) return false;
  const beatAt = (clock ? new Date(clock) : new Date()).toISOString();
  const beatPid = Number(process.env.CLAUDE_PID || process.pid) || undefined;
  for (const name of [`${id}.yaml`, `session-${id}.yaml`]) {
    const file = path.join(wsDir, 'sessions', name);
    if (!fs.existsSync(file)) continue;
    try {
      patchOrInsert(file, {
        last_heartbeat: beatAt,
        host: localHost() || '',
        // PID travels with the beat, for the same reason `host` does (WS-564):
        // a record judged against a stale identity is judged wrong forever.
        //
        // pid was written ONCE at registration and never again, so when the
        // Claude process restarts while the CONVERSATION continues — same
        // CLAUDE_CODE_SESSION_ID, new OS process — the record keeps pointing at
        // a pid that no longer exists. session-liveness then returns DEAD_PID,
        // correctly by its own rule and wrongly in fact, and recovery abandons
        // a session that is actively working. Measured 2026-08-05: record held
        // pid 10808 (gone) while the live process was 5732; the session was
        // abandoned mid-work and its claims released.
        //
        // Whoever is beating IS the session, so the beat is the authoritative
        // moment to re-anchor which process that is.
        // Number, not the raw env string: CLAUDE_PID arrives as a string and
        // would serialize quoted, silently changing the field's type on every
        // record that beats. Liveness copes, but registration writes a bare
        // number and a field that is sometimes 10808 and sometimes "10808" is
        // a trap for the next reader.
        pid: beatPid,
        // DATE the pid in the same write (WS-351). The beat is the THIRD pid
        // writer — register and its resume path are the other two — and an
        // undated pid cannot be told apart from one recycled across a reboot.
        // Concretely: a revived record whose started_at predates the current
        // boot would be re-condemned by the recycle rule on the very next
        // classify, despite actively beating. Only written when a pid is —
        // a date without its pid would vouch for nothing.
        ...(beatPid === undefined ? {} : { pid_recorded_at: beatAt }),
      }, 'pid');
      return true;
    } catch { /* best-effort: liveness is an optimisation, never a hard dependency */ }
    return false;
  }
  return false;
}

/**
 * Set scalar fields on a session record, INSERTING keys the record does not have.
 *
 * `patchYAMLFile` alone silently drops a patch whose key is absent — the WS-561
 * shape, and fatal here: every record minted before WS-564 lacks `host`, so a
 * plain patch would report success and stamp nothing, leaving liveness judged
 * against the wrong machine forever. Insert-if-missing is what makes the field
 * self-healing instead of requiring a migration.
 */
function patchOrInsert(file, patches, afterKey) {
  patchYAMLFile(file, patches); // replaces keys that are already present
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [k, v] of Object.entries(patches)) {
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`^${esc}:`, 'm').test(content)) continue;
    content = upsertYAMLScalarField(content, k, v, { after: afterKey }).content;
    changed = true;
  }
  if (changed) writeFileAtomic(file, content);
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
      //
      // WS-529: this used patchYAMLFile, which REPLACES but cannot INSERT. No
      // HomeBase queue item scaffolds `claimed_by`, so every claim since WS-533
      // wrote nothing and returned the id anyway — approve reported
      // `claimed: [WS-519, WS-563]` over two items that stayed `backlog` with
      // `claimed_by: null`, free for any other session's /next to pick up. The
      // fix WS-561 built for exactly this shape already existed here; claims
      // never adopted it.
      withFileLock(queuePath + '.lock', () => {
        let text = fs.readFileSync(queuePath, 'utf8');
        // `after: 'status'` keeps the lease fields next to the field they
        // qualify, matching where the done-path puts closure metadata.
        text = upsertYAMLScalarField(text, 'claimed_by', sessionId, { after: 'status' }).content;
        text = upsertYAMLScalarField(text, 'claimed_at', at, { after: 'claimed_by' }).content;
        writeFileAtomic(queuePath, text);
      }, { ownerLabel: 'next:claim', maxWaitMs: 5000 });

      // Report what LANDED, not what was attempted. A claim list that counts
      // writes it never made is worse than a short one: it is what let an
      // unclaimed sprint look approved for three hours.
      if (readClaimant(queuePath) === sessionId) claimed.push(id);
    } catch { /* non-fatal: a failed claim degrades to today's behaviour, never blocks */ }
  }
  mirrorIntoSession(wsDir, sessionId, claimed);
  return claimed;
}

/** Read back the claimant a queue file actually carries, for write verification. */
function readClaimant(queuePath) {
  try {
    const m = fs.readFileSync(queuePath, 'utf8').match(/^claimed_by:\s*(.*)$/m);
    if (!m) return null;
    return m[1].trim().replace(/^["'](.*)["']$/, '$1') || null;
  } catch { return null; }
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
  mergeIntoSessionList(wsDir, sessionId, 'claimed_items', itemIds);
}

/**
 * Union `values` into a top-level list field on a session record.
 *
 * One implementation for `claimed_items` and `files_locked`. The second field
 * existed in the schema from adoption with ZERO writers anywhere in the kit —
 * the same shape WS-533 diagnosed for `claimed_by` ("nothing ever ACQUIRED one"),
 * except that fix stopped at items and never reached files. INV-069 now asserts
 * this function has live callers, because a field with a writer that later loses
 * it looks identical to one that never had it.
 */
function mergeIntoSessionList(wsDir, sessionId, key, values) {
  if (!sessionId || !values || values.length === 0) return [];
  for (const name of [`${sessionId}.yaml`, `session-${sessionId}.yaml`]) {
    const file = path.join(wsDir, 'sessions', name);
    if (!fs.existsSync(file)) continue;
    try {
      return withFileLock(file + '.lock', () => {
        const raw = fs.readFileSync(file, 'utf8');
        const existing = readListField(raw, key);
        const merged = [...new Set([...existing, ...values.map(String)])];
        const rendered = `${key}:\n${merged.map((i) => `  - "${i}"`).join('\n')}\n`;
        const block = new RegExp(`^${key}:\\s*(\\[\\]|\\n(?:\\s+-\\s+.*\\n?)*)`, 'm');
        const next = new RegExp(`^${key}:`, 'm').test(raw)
          ? raw.replace(block, rendered)
          : raw.trimEnd() + '\n' + rendered;
        writeFileAtomic(file, next);
        return merged;
      }, { ownerLabel: `session:${key}`, maxWaitMs: 5000 });
    } catch { return []; /* best-effort: bookkeeping never blocks the work */ }
  }
  return [];
}

/** Entries of a simple `key:\n  - "value"` list, from raw YAML text. */
function readListField(raw, key) {
  const block = raw.match(new RegExp(`^${key}:\\s*(\\[\\]|\\n(?:\\s+-\\s+.*\\n?)*)`, 'm'));
  if (!block || !block[1] || block[1].trim() === '[]') return [];
  return [...block[1].matchAll(/^\s+-\s+"?([^"\n]+?)"?\s*$/gm)].map((m) => m[1]);
}

/**
 * Record that this session is working on `files` (repo-relative, posix separators).
 *
 * ADVISORY, LIKE CLAIMS. Nothing is prevented by holding a lock; what changes is
 * that ownership becomes COMPUTED instead of inferred. The reporting repo's git
 * guard had to infer it from `mtime < session start` — a real proof, but a
 * one-sided one: it cannot see a session that started before ours and edited after
 * we began. That gap is precisely what a per-file record closes.
 *
 * @returns {string[]} the session's full lock set after the merge.
 */
function lockFiles(wsDir, sessionId, files) {
  const clean = (files || [])
    .map((f) => String(f).split('\\').join('/').replace(/^\.\//, '').trim())
    .filter(Boolean);
  return mergeIntoSessionList(wsDir, sessionId, 'files_locked', clean);
}

/**
 * Every file lock currently held, keyed by holder.
 *
 * `live` is reported per holder rather than filtered out here: a dead session's
 * locks are still evidence about who wrote what is sitting in the tree, and the
 * caller decides whether that should block (it should not) or explain (it should).
 */
function listFileLocks(wsDir, opts = {}) {
  const sessDir = path.join(wsDir, 'sessions');
  let names = [];
  try { names = fs.readdirSync(sessDir).filter((f) => f.endsWith('.yaml')); } catch { return []; }

  const out = [];
  for (const n of names) {
    const file = path.join(sessDir, n);
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const doc = readSessionDoc(file);
    if (!doc || String(doc.status || '').toLowerCase() !== 'active') continue;
    const id = doc.id || n.replace(/\.yaml$/, '');
    const files = readListField(raw, 'files_locked');
    if (!files.length) continue;
    out.push({
      session_id: id,
      host: doc.host || null,
      live: isSessionLive(wsDir, id, opts.staleMinutes || STALE_MINUTES, opts.now || Date.now(), opts),
      files,
    });
  }
  return out;
}

/**
 * Which of `files` are held by a DIFFERENT session, and by whom.
 *
 * @returns {Array<{file, session_id, live, host}>}
 */
function findFileLockConflicts(wsDir, mySessionId, files, opts = {}) {
  const want = new Set((files || []).map((f) => String(f).split('\\').join('/').replace(/^\.\//, '')));
  const out = [];
  for (const holder of listFileLocks(wsDir, opts)) {
    if (holder.session_id === mySessionId) continue;
    for (const f of holder.files) {
      if (!want.has(f)) continue;
      out.push({ file: f, session_id: holder.session_id, live: holder.live, host: holder.host });
    }
  }
  return out;
}

module.exports = {
  STALE_MINUTES,
  bootTimeMs,
  localHost,
  isLocalHost,
  isPidAlive,
  readSessionPointer,
  readSessionDoc,
  agentSessionIdFromEnv,
  findByAgentSessionId,
  resolveSessionId,
  isSessionLive,
  listLiveSessions,
  staleActiveSessions,
  registryHealth,
  minutesSinceHeartbeat,
  touchSession,
  readClaim,
  readListField,
  listQueueIds,
  findClaimConflicts,
  claimItems,
  releaseItems,
  lockFiles,
  listFileLocks,
  findFileLockConflicts,
  sessionOwnerVerdict,
  patchOrInsert,
};
