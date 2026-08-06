#!/usr/bin/env node
/**
 * cwos-next — CLI consolidation of /next (WS-266, ADR-037 Decision #3).
 *
 * Exactly 5 subcommands (Decision #3 / AS-037-4 — non-negotiable):
 *   gate       — Steps 1..1f: active-sprint check, config, activation gate,
 *                sprint blocks, replenish, drift detection. Exits 1 if blocked.
 *   candidates — Steps 2..2d: gather + soft-block + source-class damping.
 *                Returns ranked JSON array.
 *   compose    — Step 3 + Step 4a: anchor select + cluster + cap + classify +
 *                sequence + goal + decisions + anti-goal cross-check. `--human`
 *                emits founder-formatted text + Decision #8 footer.
 *   approve    — Step 5: write SPR-NNN.yaml, claim items, update indexes,
 *                emit `sprint_approved` event with two-field provenance per
 *                ALTERATION-5.
 *   done       — Step 6 closeout: mark items done, resolve linked findings,
 *                recompute program health, run cwos-reconcile.
 *
 * Output convention (mirrors cwos-state-store.js / cwos-event.js):
 *   - JSON to stdout by default; `--human` flag on compose adds formatted text.
 *   - Exit 0 on clean success, 1 on gate-block / validation failure, 2 on
 *     invalid argument. Most error paths exit 0 + stderr (AS-23 discipline).
 *
 * Replay-purity:
 *   - All reads via state-store typed-API; no raw YAML walks of state.
 *   - new Date() / Date.now() ONLY at event-emission boundaries (approve / done).
 *
 * Token-budget gate (Decision #5) gracefully falls back when
 * cwos-token-budget.js (WS-272) is not yet shipped — see runGate().
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let stateStoreMod = null;
try { stateStoreMod = require('./core/state-store'); }
catch { process.exit(0); }

const {
  findWorkstreamDir,
  readYAMLFile,
  writeFileAtomic,
  globFiles,
  todayISO,
  withFileLock,
  upsertYAMLScalarField,
  findRepoRoot,
} = require('./lib/cwos-utils');
const { loadEventDeps } = require('./lib/cwos-utils');
// WS-533: session identity + item claims. `claimed_by`/`claimed_at` have existed on
// every queue item since adoption and nothing ever wrote them — /next's own docs said
// approve "claims items"; it did not. See lib/cwos-claims.js for the incident.
// WS-564: the conflict list is only meaningful alongside the state that produced
// it — hence registryHealth / listLiveSessions / staleActiveSessions here too.
const {
  resolveSessionId,
  touchSession,
  findClaimConflicts,
  claimItems,
  releaseItems,
  registryHealth,
  listLiveSessions,
  staleActiveSessions,
} = require('./lib/cwos-claims');
const { classifySource, classifyMode } = require('./cwos-classify');

const { appendEvent, ensureCommandId } = loadEventDeps();

let computeHealthScore = null;
try { ({ computeHealthScore } = require('./core/health-scoring')); }
catch { /* health-scoring unavailable */ }

let validateStateDrift = null;
let stateCacheMissing = null;
try { ({ validateStateDrift, stateCacheMissing } = require('./cwos-reconcile')); }
catch { /* reconcile unavailable */ }

// ─── Shared helpers ────────────────────────────────────────────────────────

function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i === args.length - 1) return null;
  return args[i + 1];
}

function hasFlag(args, name) {
  return args.includes(`--${name}`);
}

function loadStore() {
  const store = stateStoreMod.stateStore;
  store.load();
  return store;
}

// WS-576: two different questions that used to have one answer.
//
// `repoRoot()` is WHERE MY CODE IS — the checkout this process is running in.
// In a linked worktree that is the worktree, and it must stay that way: it is
// the cwd for `git rev-parse --short HEAD` (whose answer becomes an item's
// completion_commit), and the base for repo content like system/context.md and
// .cwos-config.yaml, all of which are per-branch.
//
// `stateDir()` is WHERE MY STATE IS — the ONE canonical .claude/workstream/ for
// this repo, shared by every worktree. Deriving repoRoot from it (as this did
// before) silently fused the two, so canonicalizing state resolution would have
// made a worktree record the MAIN tree's HEAD as its completion commit.
function repoRoot() {
  return findRepoRoot(process.cwd());
}

function stateDir() {
  return findWorkstreamDir(process.cwd());
}

// WS-269 (fb-002 / fr-012 / fr-017 / fr-019): the resume-check used to match
// status:'active' only, but nothing in the pipeline ever writes that status —
// approve writes 'approved', done writes 'done'. So an approved-but-unexecuted
// sprint (composed + approved, execution not yet started — e.g. plan-first
// design awaiting founder decisions) was invisible to the resume path, and a
// later /next composed a duplicate sprint over it. On 2026-07-25 that produced
// two sprints independently executing WS-263.
//
// 'active' stays first so any hand-set or future active sprint keeps priority.
function findResumableSprint(sprints) {
  const list = (sprints || []).filter(
    (s) => s && s.id && s.status !== 'abandoned' && s.status !== 'done' && s.status !== 'completed'
  );
  const byRecency = (a, b) =>
    String(b.approved_at || b.created_at || '').localeCompare(String(a.approved_at || a.created_at || ''));
  const live = list.filter((s) => s.status === 'active').sort(byRecency);
  if (live.length) return live[0];
  const approved = list
    .filter((s) => s.status === 'approved' && !s.completed_at)
    .sort(byRecency);
  return approved.length ? approved[0] : null;
}

// Third resume source: the sprint YAMLs themselves. approve() writes the YAML
// synchronously but state/sprints.json and sprint-index.yaml are only refreshed
// when the T6 reducer / reconcile fires, so a just-approved sprint can be
// absent from both caches. Scanning the dir closes that race window.
function readSprintsFromDir() {
  const out = [];
  try {
    const dir = path.join(stateDir(), 'sprints');
    if (!fs.existsSync(dir)) return out;
    for (const f of fs.readdirSync(dir)) {
      if (!/^SPR-\d{3,4}\.yaml$/.test(f)) continue;
      const r = readYAMLFile(path.join(dir, f));
      if (!r.ok || !r.data) continue;
      const d = r.data;
      const items = Array.isArray(d.items) ? d.items : [];
      out.push({
        id: d.id || f.replace(/\.yaml$/, ''),
        title: d.title || null,
        status: d.status || null,
        approved_at: d.approved_at || null,
        created_at: d.created_at || null,
        completed_at: d.completed_at || null,
        item_count: items.length,
        items_done: items.filter((it) => it && (it.status === 'done' || it.status === 'skipped')).length,
      });
    }
  } catch { /* non-fatal — the cache sources still apply */ }
  return out;
}

// Unions the three sources by sprint id — later sources overwrite earlier ones,
// so the freshest record for each id wins (dir scan > sprint-index > state
// store). Union rather than first-hit: a stale cache can hold an old approved
// sprint that a fresher source shows as closed, and picking the most recent
// resumable sprint requires seeing all of them at once.
function resolveResumableSprint(store) {
  const merged = new Map();
  const absorb = (list) => {
    for (const s of list || []) {
      if (s && s.id) merged.set(s.id, Object.assign({}, merged.get(s.id), s));
    }
  };

  absorb((store && store.sprints && store.sprints.all && store.sprints.all()) || []);

  const idxPath = path.join(stateDir(), 'sprint-index.yaml');
  if (fs.existsSync(idxPath)) {
    const r = readYAMLFile(idxPath);
    if (r.ok && r.data && Array.isArray(r.data.sprints)) absorb(r.data.sprints);
  }

  absorb(readSprintsFromDir());

  return findResumableSprint(Array.from(merged.values()));
}

function readContextOverrideClass() {
  // Step 3a-rotation: scans system/context.md for an *active* override_class.
  // Active = under "## Active overrides", not "## Archived overrides".
  // Pure read — no parsing magic needed because the file is human-edited.
  try {
    const p = path.join(repoRoot(), 'system', 'context.md');
    if (!fs.existsSync(p)) return null;
    const txt = fs.readFileSync(p, 'utf8');
    const activeIdx = txt.indexOf('## Active overrides');
    const archivedIdx = txt.indexOf('## Archived overrides');
    if (activeIdx === -1) return null;
    const segEnd = archivedIdx === -1 ? txt.length : archivedIdx;
    const segment = txt.slice(activeIdx, segEnd);
    const m = segment.match(/^### override_class:\s*([\w-]+)/m);
    return m ? m[1].trim() : null;
  } catch { return null; }
}

/**
 * Coerce a config value to a number, tolerating an inline YAML comment riding
 * along on the scalar (WS-569).
 *
 * WS-497 taught the shared YAML reader to strip ` # comment` tails, so on a
 * current kit `max_items: 5   # Max items per sprint` already parses as 5. This
 * guard stays anyway, for two reasons that are not belt-and-braces:
 *
 *   1. **Adopted repos run older parsers.** Every adopted repo is on kit
 *      3.7.1-3.8.5 with its own copy of cwos-utils. A consumer-side coercion
 *      fixes the cap for them without waiting on a kit upgrade.
 *   2. **The failure is silent and total.** `8 >= "5 # ..."` is false, not an
 *      error — the cap simply never fires, and the sprint that results looks
 *      deliberate. This defect was found independently by region-desk
 *      (2026-05-13), ServeYourNote (2026-07-25) and HomeBase (2026-08-02): 83
 *      days, three discoveries, because nothing about it is loud.
 *
 * Returns `fallback` for anything that is not a finite number, INCLUDING a
 * string that parses to NaN. Note `0` is honoured rather than falling through:
 * the previous `||` treated a legitimate zero cap as "unset".
 */
function configNumber(v, fallback) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const head = v.split('#')[0].trim();
    const n = Number(head);
    if (head !== '' && Number.isFinite(n)) return n;
  }
  return fallback;
}

function loadConfig() {
  // Standard defaults if `.cwos-config.yaml` is absent. Per next.md Step 1b.
  const defaults = { ceremony: 'standard', sprints: { max_items: 5, max_effort_sessions: 2 } };
  try {
    const p = path.join(repoRoot(), '.cwos-config.yaml');
    if (!fs.existsSync(p)) return defaults;
    const r = readYAMLFile(p);
    if (!r.ok || !r.data) return defaults;
    const c = r.data;
    const s = c.sprints || {};
    return {
      // ceremony can carry a comment tail on an older parser too.
      ceremony: (typeof c.ceremony === 'string' ? c.ceremony.split('#')[0].trim() : c.ceremony) || defaults.ceremony,
      sprints: {
        max_items: configNumber(s.max_items, defaults.sprints.max_items),
        max_effort_sessions: configNumber(s.max_effort_sessions, defaults.sprints.max_effort_sessions),
      },
    };
  } catch { return defaults; }
}

function ceremonyDefaults(cer) {
  switch (cer) {
    case 'minimal':   return { max_items: 3, max_effort_sessions: 1 };
    case 'strategic': return { max_items: 8, max_effort_sessions: 4 };
    case 'standard':
    default:          return { max_items: 5, max_effort_sessions: 2 };
  }
}

function effortSessions(effort) {
  // S=0.5, M=1.5, L=3 per next.md Step 3c.
  if (effort === 'S') return 0.5;
  if (effort === 'M') return 1.5;
  if (effort === 'L') return 3;
  return 1;
}

function getRecentSprintAnchors(store, n) {
  // Returns the source_class of the first item in each of the last n
  // *completed/approved* sprints (skip abandoned). Used for source-class
  // damping (Step 2d) and fleet-rotation rotation (Step 3a-rotation).
  const all = (store.sprints && store.sprints.all && store.sprints.all()) || [];
  const ranked = all
    .filter((s) => s && s.status !== 'abandoned')
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return ranked.slice(0, n).map((s) => ({
    id: s.id,
    program_focus: s.program_focus || null,
    anchor_source_class: s.anchor_source_class || 'untagged',
  }));
}

// ─── 1. gate ───────────────────────────────────────────────────────────────

function runGate(args) {
  const json = !hasFlag(args, 'human');
  // WS-272: validate --override-token-budget rationale BEFORE any other
  // checks so malformed input fails fast regardless of active-sprint or
  // other short-circuit paths. Empty/missing flag is fine; it just means
  // the override isn't being used.
  const overridePreCheck = readFlag(args, 'override-token-budget');
  if (overridePreCheck != null && overridePreCheck.length < 20) {
    process.stderr.write(`gate: --override-token-budget rationale must be ≥ 20 characters; got ${overridePreCheck.length}\n`);
    process.exit(2);
  }

  // WS-271: validate --override-read-restraint rationale at the same
  // pre-check boundary; mirrors the WS-272 friction-by-design pattern.
  const readRestraintPreCheck = readFlag(args, 'override-read-restraint');
  if (readRestraintPreCheck != null && readRestraintPreCheck.length < 20) {
    process.stderr.write(`gate: --override-read-restraint rationale must be ≥ 20 characters; got ${readRestraintPreCheck.length}\n`);
    process.exit(2);
  }

  // WS-411 (this commit): --override-stale-protocol "<program>:<protocol>:<rationale ≥30 chars>"
  // gives the founder an explicit acknowledgment escape hatch for stale-protocol
  // blocks. Symmetric with --override-token-budget. Records a
  // stale_protocol_acknowledged event so the override is auditable. Per-invocation
  // only — the next /next checks fresh staleness. Multiple overrides can be passed
  // by repeating the flag.
  const staleOverrides = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--override-stale-protocol' || args[i].startsWith('--override-stale-protocol=')) {
      let val;
      if (args[i] === '--override-stale-protocol') {
        val = args[i + 1]; i++;
      } else {
        val = args[i].slice('--override-stale-protocol='.length);
      }
      if (val == null) {
        process.stderr.write(`gate: --override-stale-protocol requires a value of the form "<program>:<protocol>:<rationale ≥30 chars>"\n`);
        process.exit(2);
      }
      const m = val.match(/^([^:]+):([^:]+):(.+)$/s);
      if (!m) {
        process.stderr.write(`gate: --override-stale-protocol must be "<program>:<protocol>:<rationale>"; got ${JSON.stringify(val)}\n`);
        process.exit(2);
      }
      const [, prog, proto, rationale] = m;
      if (rationale.length < 30) {
        process.stderr.write(`gate: --override-stale-protocol rationale must be ≥ 30 characters; got ${rationale.length}\n`);
        process.exit(2);
      }
      staleOverrides.push({ program: prog.trim(), protocol: proto.trim(), rationale: rationale.trim() });
    }
  }
  // If valid, emit the acknowledgment event up front so any downstream
  // INV scan sees it. Non-fatal on emission failure (AS-23).
  if (readRestraintPreCheck != null && appendEvent && ensureCommandId) {
    try {
      const commandId = ensureCommandId('read-restraint-ack');
      appendEvent({
        source_track: 'T0:envelope',
        source_tier: 'founder-prompt',
        track_tag: 'read_restraint_acknowledged',
        command_id: commandId,
        payload: {
          type: 'read_restraint_acknowledged',
          rationale: readRestraintPreCheck,
          ack_at: new Date().toISOString(),
          authorized_by: 'founder',
          composed_by: 'cli-deterministic',
        },
      });
    } catch (e) {
      process.stderr.write(`gate: read-restraint-ack event emission failed (non-fatal): ${e.message}\n`);
    }
  }

  // ADR-058 self-heal: state/*.json is an untracked per-node cache. On a
  // fresh clone (or headless `claude -p` / /fleet-run path where the
  // SessionStart --refresh-state hook never fired), the cache is absent —
  // rebuild it via a full reconcile before gating so the candidate pool
  // isn't silently empty. Non-fatal: gate proceeds either way (candidates
  // fall back to queue-index.yaml when state lags).
  let stateRefreshed = false;
  try {
    const wsDirForHeal = findWorkstreamDir(process.cwd());
    if (stateCacheMissing && stateCacheMissing(wsDirForHeal)) {
      const heal = spawnSync(process.execPath, [path.join(__dirname, 'cwos-reconcile.js'), '--quiet'], {
        stdio: 'ignore', timeout: 60000,
      });
      stateRefreshed = heal.status === 0;
      process.stderr.write(`gate: state cache was missing — reconcile rebuild ${stateRefreshed ? 'succeeded' : 'failed (continuing on index fallbacks)'} (ADR-058)\n`);
    }
  } catch { /* non-fatal (AS-23) */ }

  const store = loadStore();
  const result = {
    active_sprint: null,
    config: null,
    activation_gate: { ok: true, reason: null, installed_count: 0, active_count: 0 },
    sprint_blocks: [],
    drift_detected: false,
    drift_items: [],
    replenishment: { needed: [], note: null },
    token_budget: { available: false, exit: null, note: null },
    // WS-564: `claim_conflicts` NEVER travels alone. It is computed by filtering
    // on liveness, so an empty list means one of two opposite things — "N peers
    // are live and hold other items" or "liveness is UNKNOWN and this check just
    // failed open". The conditioning set travels with the answer.
    session: {
      id: null,
      claim_conflicts: [],
      conflicts_conditioning: 'unknown',
      live_sessions: [],
      stale_active: [],
      registry: { ok: false, reason: 'not evaluated' },
    },
    blocked: false,
    state_refreshed: stateRefreshed,
  };

  // Step 0b: session identity + claim conflicts (WS-533).
  //
  // Runs BEFORE the resumable-sprint check below, which exits early — if another
  // session is already working the sprint we are about to resume, that is precisely
  // when the founder needs to know, so the check must not sit behind that return.
  //
  // Identity comes from CLAUDE_CODE_SESSION_ID where available, NOT from
  // `.current-session`: the pointer holds one id, so with two live sessions it names
  // whichever registered last and every claim we wrote would be attributed to the
  // other session. See resolveSessionId.
  //
  // A conflict counts only when the other session is still ALIVE. A crashed session
  // must never fence off the queue permanently — on a machine that loses power
  // routinely that would be a weekly occurrence — so a claim whose owner stopped
  // heartbeating is silently reclaimable rather than blocking.
  try {
    const wsDirForClaims = findWorkstreamDir(process.cwd());
    const mySession = resolveSessionId(wsDirForClaims);
    result.session.id = mySession;
    touchSession(wsDirForClaims, mySession);
    // Scans the queue DIRECTORY, not state/queue.json — that cache lags item
    // creation, and a safety check that degrades to "no conflicts" on stale input is
    // worse than no check.
    result.session.claim_conflicts = findClaimConflicts(wsDirForClaims, mySession, null);

    // WS-564: the conditioning set. On 2026-08-02 this gate reported
    // `claim_conflicts: []` to a session about to implement WS-312 while three
    // sessions were concurrently editing the repo — the list was empty because
    // the heartbeat hook had been dead for two days and every peer filtered out
    // as not-live. That session's own claim then became reclaimable 90 minutes
    // in, WHILE it was implementing the item. An empty list is only an all-clear
    // when the registry that produced it can be believed.
    result.session.registry = registryHealth(wsDirForClaims);
    result.session.live_sessions = listLiveSessions(wsDirForClaims, mySession)
      .map((s) => ({ id: s.id, host: s.host, foreign_host: s.foreign_host, claimed_items: s.claimed_items }));
    result.session.stale_active = staleActiveSessions(wsDirForClaims, { selfId: mySession })
      .map((s) => ({ id: s.id, minutes_stale: s.minutes_stale, claimed_items: s.claimed_items }));
    result.session.conflicts_conditioning = result.session.registry.ok ? 'known' : 'unknown';
  } catch (e) {
    // Claim bookkeeping must never take the gate down: worst case we degrade to the
    // pre-WS-533 behaviour, which is what shipped for months.
    result.session.error = e.message;
  }

  // Step 1: resumable sprint? (WS-269)
  // Matches status:active OR status:approved with completed_at:null, across
  // three sources of decreasing staleness — see resolveResumableSprint.
  const active = resolveResumableSprint(store);
  if (active) {
    result.active_sprint = {
      id: active.id,
      title: active.title || null,
      status: active.status || null,
      items_done: active.items_done || 0,
      item_count: active.item_count || 0,
    };
    if (json) writeJson(result);
    process.exit(0);
  }

  // Step 1b: config
  result.config = loadConfig();

  // Step 1d-pre: program activation gate
  const programsDir = path.join(stateDir(), 'programs');
  let installed = 0;
  let activeProgs = 0;
  if (fs.existsSync(programsDir)) {
    const files = fs.readdirSync(programsDir).filter((f) => /^prog-.+\.yaml$/.test(f) && f !== 'prog-template.yaml');
    installed = files.length;
    const regPath = path.join(programsDir, 'registry.yaml');
    if (fs.existsSync(regPath)) {
      const r = readYAMLFile(regPath);
      if (r.ok && r.data && Array.isArray(r.data.programs)) {
        activeProgs = r.data.programs.filter((p) => p && p.tier && p.tier !== 'dormant').length;
      }
    }
  }
  result.activation_gate.installed_count = installed;
  result.activation_gate.active_count = activeProgs;
  if (installed > 0 && activeProgs === 0) {
    result.activation_gate.ok = false;
    result.activation_gate.reason = 'no_programs_active';
    result.blocked = true;
    if (json) writeJson(result);
    process.exit(1);
  }

  // Step 1d: scan blocking programs (block_sprint: true; skip monitor_only).
  // WS-349 / FIND-231 fix: previously checked p.block_sprint at the protocol
  // level, but block_sprint is only declared at acc.on_stale.block_sprint
  // (program level). The broken inner guard meant the loop always continued,
  // so no protocol was ever flagged stale — block_sprint was inert.
  // Now: outer onStale.block_sprint gate (line 285) decides whether to enter
  // the inner loop; inner loop evaluates per-protocol staleness via
  // acc.on_stale.stale_days (WS-370 schema addition). cadence_days remains the
  // protocol's running schedule and is unrelated to staleness tolerance.
  const today = todayISO();
  if (fs.existsSync(programsDir)) {
    for (const f of fs.readdirSync(programsDir)) {
      if (!/^prog-.+\.yaml$/.test(f) || f === 'prog-template.yaml') continue;
      const r = readYAMLFile(path.join(programsDir, f));
      if (!r.ok || !r.data) continue;
      const d = r.data;
      if (d.monitor_only === true) continue;
      const acc = d.accountability || {};
      const onStale = acc.on_stale || {};
      if (onStale.block_sprint !== true) continue;

      // Source the program-level staleness floor from acc.on_stale.stale_days,
      // then escalation, then a 30-day default. Per WS-410 (this commit), this
      // is a FLOOR not a uniform threshold: each protocol's effective stale
      // window is max(program_floor, cadence_days * 1.5). Rationale: a 30-day-
      // cadence blind_spot shouldn't be considered "stale" at 8 days just
      // because the program-level on_stale.stale_days=7 was tuned for the
      // fastest protocol. Uncadenced protocols (baseline, meta) keep the
      // program floor.
      const escalation = acc.escalation || (acc.on_finding && acc.on_finding.escalation) || {};
      const staleDaysFloor = (typeof onStale.stale_days === 'number' ? onStale.stale_days : null)
        ?? (typeof escalation.stale_days === 'number' ? escalation.stale_days : null)
        ?? 30;

      const protos = d.protocols || {};
      let blockedHere = false;
      let staleProtoName = null;
      let overdueDays = 0;
      let effectiveStaleDays = staleDaysFloor;
      for (const [pname, p] of Object.entries(protos)) {
        if (!p) continue; // skip null/undefined entries; do NOT gate on p.block_sprint (broken)
        // Uncadenced protocols (baseline, meta) don't carry a running schedule
        // and are not the "is this program being watched?" signal — they
        // contribute to maturity, not freshness. Only cadenced protocols
        // count toward sprint-blocking staleness.
        const cadence = (typeof p.cadence_days === 'number' && p.cadence_days > 0) ? p.cadence_days : null;
        if (cadence == null) continue;
        const lastRun = (p.last_run_date)
          || (d.last_run_by_protocol && d.last_run_by_protocol[pname] && d.last_run_by_protocol[pname].date)
          || d.last_run_date
          || null;
        if (!lastRun) continue;
        const days = daysBetween(lastRun, today);
        const protoStale = Math.max(staleDaysFloor, Math.ceil(cadence * 1.5));
        const overdue = days - protoStale;
        if (overdue > 0) {
          blockedHere = true;
          staleProtoName = pname;
          overdueDays = overdue;
          effectiveStaleDays = protoStale;
          break;
        }
      }

      // WS-365 / FIND-247 prong 3: null-lastRun on active/critical block_sprint:true
      // programs surfaces explicitly instead of silent skip. Fires when the program
      // has ≥1 cadenced protocol and EVERY cadenced protocol has lastRun null
      // (never run). Watch/dormant tiers retain the soft path (the gap is
      // acceptable while ramping up). One block per program; bypasses gate-mismatch
      // check + per-protocol override (those gates assume a stale protocol exists).
      if (!blockedHere && (d.tier === 'active' || d.tier === 'critical')) {
        const cadenced = Object.entries(protos).filter(
          ([, p]) => p && typeof p.cadence_days === 'number' && p.cadence_days > 0
        );
        const allNeverRun = cadenced.length > 0 && cadenced.every(([pname, p]) => {
          const lr = (p.last_run_date)
            || (d.last_run_by_protocol && d.last_run_by_protocol[pname] && d.last_run_by_protocol[pname].date)
            || d.last_run_date
            || null;
          return !lr;
        });
        if (allNeverRun) {
          result.sprint_blocks.push({
            program: d.id,
            reason: 'first-run-required',
            tier: d.tier,
            protocols_never_run: cadenced.map(([pname]) => pname),
            hint: `/pulse run ${d.id} <protocol> --completed — first run required to clear block_sprint. `
              + `Run the protocol's engine first; --completed records last_run_by_protocol.<protocol>.date, `
              + `which is the field this gate reads. Without --completed the CLI records intent only and the block persists.`,
          });
          continue;
        }
      }

      // WS-349 part 2: event-log cross-check — if the YAML last_run_date
      // diverges from the most recent protocol_run_intent event in the log
      // by more than the program floor, surface a gate-mismatch warning. The
      // event log is canonical (ADR-045); a YAML that drifted past the log
      // can mask a stale program.
      if (!blockedHere && staleProtoName === null) {
        const mismatch = detectGateMismatch(path.dirname(programsDir), d.id, Object.keys(protos), staleDaysFloor, today);
        if (mismatch) {
          result.gate_mismatches = result.gate_mismatches || [];
          result.gate_mismatches.push(mismatch);
        }
      }

      if (blockedHere) {
        // WS-411: founder-acknowledgment escape hatch. If --override-stale-protocol
        // matches this program+protocol, drop the block + emit an audit event.
        const ovIdx = staleOverrides.findIndex(o => o.program === d.id && o.protocol === staleProtoName);
        if (ovIdx >= 0) {
          const ov = staleOverrides[ovIdx];
          result.stale_protocol_overrides = result.stale_protocol_overrides || [];
          result.stale_protocol_overrides.push({
            program: d.id,
            protocol: staleProtoName,
            overdue_days: overdueDays,
            stale_days: effectiveStaleDays,
            rationale: ov.rationale,
          });
          if (appendEvent && ensureCommandId) {
            try {
              const commandId = ensureCommandId('stale-protocol-ack');
              appendEvent({
                source_track: 'T0:envelope',
                source_tier: 'founder-prompt',
                track_tag: 'stale_protocol_acknowledged',
                command_id: commandId,
                payload: {
                  type: 'stale_protocol_acknowledged',
                  program: d.id,
                  protocol: staleProtoName,
                  overdue_days: overdueDays,
                  stale_days: effectiveStaleDays,
                  rationale: ov.rationale,
                  ack_at: new Date().toISOString(),
                  authorized_by: 'founder',
                  composed_by: 'cli-deterministic',
                },
              });
            } catch (e) {
              process.stderr.write(`gate: stale-protocol-ack event emission failed (non-fatal): ${e.message}\n`);
            }
          }
          staleOverrides.splice(ovIdx, 1); // consume the override; one per block
        } else {
          result.sprint_blocks.push({
            program: d.id,
            protocol: staleProtoName,
            overdue_days: overdueDays,
            stale_days: effectiveStaleDays,
          });
        }
      }
    }
  }
  if (result.sprint_blocks.length > 0) {
    result.blocked = true;
  }

  // A LIVE foreign claim blocks composition (WS-533). This is the one place the
  // founder is told "another session is already on this" before two agents start
  // editing the same files, so it is a hard stop rather than an advisory line: the
  // failure it prevents is silent and only becomes visible after the clobber.
  if (result.session.claim_conflicts.length > 0) {
    result.blocked = true;
    for (const c of result.session.claim_conflicts) {
      result.sprint_blocks.push({ reason: 'claimed-by-other-session', item: c.id, hint: c.message });
    }
  } else if (result.session.conflicts_conditioning === 'unknown') {
    // NOT a block — a broken registry must not fence the queue, or the founder
    // loses the ability to work at all in exactly the state where the tooling is
    // already failing them. But it must not read as an all-clear either. This is
    // reported so the composed sprint carries its own caveat.
    result.sprint_blocks.push({
      reason: 'claim-conflicts-unknown',
      item: null,
      hint: `No claim conflicts found, but the session registry cannot be believed: ${result.session.registry.reason}. `
          + 'Treat "no conflicts" as UNKNOWN and check with the other sessions before editing shared files.',
    });
  }

  // Step 1e: replenishment — detect-and-report.
  // Full generation is deferred to cwos-pulse.js (WS-267) because the waterfall
  // depends on per-program tier weights + phase relevance lookups that belong
  // beside the health-score formula. gate surfaces the count so the founder
  // can see the gap; the actual mutation happens in /pulse.
  const backlog = store.queue.byStatus('backlog');
  const autoRecsByProg = new Set(backlog.filter((q) => classifySource(q) === 'auto-rec' && q.program).map((q) => q.program));
  if (fs.existsSync(programsDir)) {
    for (const f of fs.readdirSync(programsDir)) {
      if (!/^prog-.+\.yaml$/.test(f) || f === 'prog-template.yaml') continue;
      const r = readYAMLFile(path.join(programsDir, f));
      if (!r.ok || !r.data) continue;
      const d = r.data;
      if (d.monitor_only === true) continue;
      const score = typeof d.health_score === 'number' ? d.health_score : null;
      if (score === null || score >= 10) continue;
      if (autoRecsByProg.has(d.id)) continue;
      result.replenishment.needed.push({ program: d.id, health_score: score });
    }
  }
  if (result.replenishment.needed.length > 0) {
    result.replenishment.note = 'auto-rec generation deferred to cwos-pulse compute-health (WS-267); gate surfaces counts only';
  }

  // Step 1f: state-drift detection. Per ADR-045 / DEC-034 the detector reads
  // the canonical event log (not commit messages) and auto-reconciles inline.
  // Drift is blocking ONLY when reconcile fails (genuine corruption — e.g.,
  // an item_closed event exists but the queue YAML write fails). Successful
  // auto-reconciles are surfaced as advisory in compose --human output.
  if (validateStateDrift) {
    const queueDir = path.join(stateDir(), 'queue');
    const queueItems = [];
    if (fs.existsSync(queueDir)) {
      for (const f of globFiles(queueDir, 'WS-*.yaml')) {
        const r = readYAMLFile(f);
        if (r.ok && r.data) queueItems.push(r.data);
      }
    }
    try {
      const drifts = validateStateDrift(stateDir(), queueItems, null);
      if (Array.isArray(drifts) && drifts.length > 0) {
        const reconciled = drifts.filter((d) => d.auto_reconciled);
        const blocked = drifts.filter((d) => !d.auto_reconciled);
        if (reconciled.length > 0) {
          result.drift_auto_reconciled = reconciled.map((d) => ({
            ws_id: d.ws_id,
            kind: d.kind,
            prior_status: d.prior_status,
            new_status: d.new_status,
            event_id: d.event_id || d.sprint_event_id,
          }));
        }
        if (blocked.length > 0) {
          result.drift_detected = true;
          result.drift_items = blocked.map((d) => ({
            ws_id: d.ws_id,
            kind: d.kind,
            prior_status: d.prior_status,
            event_id: d.event_id,
            error: d.error,
          }));
          result.blocked = true;
        }
      }
    } catch { /* drift check unavailable; non-fatal */ }
  }

  // Token-budget gate — graceful fallback per fork-1.
  // WS-272: --override-token-budget "<rationale ≥20 chars>" short-circuits
  // the spawn AND emits a `budget_regression_acknowledged` event so the
  // override is auditable in the event log.
  const overrideRationale = readFlag(args, 'override-token-budget');
  if (overrideRationale != null) {
    if (overrideRationale.length < 20) {
      process.stderr.write(`gate: --override-token-budget rationale must be ≥ 20 characters; got ${overrideRationale.length}\n`);
      process.exit(2);
    }
    // Emit acknowledgment event before continuing
    let ackEventId = null;
    if (appendEvent && ensureCommandId) {
      try {
        const commandId = ensureCommandId('budget-ack');
        const r = appendEvent({
          source_track: 'T0:envelope',
          source_tier: 'founder-prompt',
          track_tag: 'budget_regression_acknowledged',
          command_id: commandId,
          payload: {
            type: 'budget_regression_acknowledged',
            rationale: overrideRationale,
            ack_at: new Date().toISOString(),
            authorized_by: 'founder',
            composed_by: 'cli-deterministic',
          },
        });
        if (r && r.ok && r.event) ackEventId = r.event.id;
      } catch (e) {
        process.stderr.write(`gate: budget-ack event emission failed (non-fatal): ${e.message}\n`);
      }
    }
    result.token_budget.available = true;
    result.token_budget.override = true;
    result.token_budget.rationale = overrideRationale;
    result.token_budget.ack_event_id = ackEventId;
  } else {
    const tbPath = path.join(__dirname, 'cwos-token-budget.js');
    if (fs.existsSync(tbPath)) {
      try {
        const r = spawnSync(process.execPath, [tbPath, '--check'], { cwd: repoRoot() });
        result.token_budget.available = true;
        result.token_budget.exit = r.status;
        if (r.status === 1) {
          result.blocked = true;
          result.token_budget.note = 'budget regression detected';
        }
      } catch (e) {
        result.token_budget.note = `invocation error: ${e.message}`;
      }
    } else {
      process.stderr.write('[gate] cwos-token-budget.js not present (WS-272 not yet shipped) — token-budget check skipped\n');
      result.token_budget.note = 'cwos-token-budget.js not present (WS-272 not yet shipped); skipped';
    }
  }

  if (json) writeJson(result);
  process.exit(result.blocked ? 1 : 0);
}

function daysBetween(isoA, isoB) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return Math.floor((b - a) / 86400000);
}

// WS-349 part 2: event-log cross-check helper.
// Compares the program's YAML last_run_by_protocol[*].date against the most
// recent protocol_run_intent event in the canonical log. If divergence
// exceeds the staleness threshold, surface a founder-readable warning. The
// event log is canonical (ADR-045); a YAML that drifted past the log can
// mask a stale program from the gate.
//
// Returns null when no mismatch detected (or events unavailable). Otherwise:
//   { program, protocol, yaml_date, event_date, divergence_days, message }
function detectGateMismatch(wsDir, programId, protocolNames, staleDays, today) {
  let readAllChunks = null;
  try { ({ readAllChunks } = require('./core/events')); } catch { return null; }
  if (!readAllChunks) return null;
  let events;
  try { events = readAllChunks(wsDir).events || []; } catch { return null; }
  if (!Array.isArray(events) || events.length === 0) return null;

  // Build last protocol_run_intent date per (program, protocol) from event log.
  const lastIntentByProto = new Map();
  for (const ev of events) {
    if (!ev || !ev.payload || ev.payload.type !== 'protocol_run_intent') continue;
    if (ev.payload.program !== programId) continue;
    const proto = ev.payload.protocol;
    if (!proto) continue;
    const at = ev.payload.emitted_at || (ev.timestamp && ev.timestamp.slice(0, 10));
    if (!at) continue;
    const prior = lastIntentByProto.get(proto);
    if (!prior || at > prior) lastIntentByProto.set(proto, at);
  }

  // Re-read the program YAML once for last_run_by_protocol comparison.
  const progPath = path.join(wsDir, 'programs', `prog-${programId}.yaml`);
  if (!fs.existsSync(progPath)) return null;
  const r = readYAMLFile(progPath);
  if (!r.ok || !r.data) return null;
  const lastByProto = (r.data.last_run_by_protocol && typeof r.data.last_run_by_protocol === 'object')
    ? r.data.last_run_by_protocol
    : {};

  for (const proto of protocolNames) {
    const yamlDate = (lastByProto[proto] && lastByProto[proto].date) || r.data.last_run_date || null;
    const eventDate = lastIntentByProto.get(proto) || null;
    if (!yamlDate || !eventDate) continue;
    // Divergence: event log has run-intent newer than YAML by > staleDays?
    // OR YAML claims newer run than the event log by > staleDays?
    const divergence = Math.abs(daysBetween(yamlDate, eventDate));
    if (divergence > staleDays) {
      return {
        program: programId,
        protocol: proto,
        yaml_date: yamlDate,
        event_date: eventDate,
        divergence_days: divergence,
        message: `YAML last_run_date for ${programId}/${proto} (${yamlDate}) diverges from event log (${eventDate}) by ${divergence} days — gate may be bypassed; reconcile via /pulse run.`,
      };
    }
  }
  return null;
}

// ─── 2. candidates ─────────────────────────────────────────────────────────

const SATURATED_CLASSES = new Set(['auto-rec', 'engine-finding']);
const NEVER_DAMPED = new Set(['pre-mortem', 'plan-internal', 'conversation', 'spr-followup', 'untagged']);

// WS-350: build a {programId → {priority_floor, cap_breach_active}} map by
// scanning program YAMLs once per candidates() call. Used to raise raw_score
// to priority_floor for candidates from cap-breached programs before tiebreak.
// Returns {} if programs directory is absent (graceful for tests + bare repos).
function loadProgramCapsByProgram() {
  const wsDir = findWorkstreamDir(process.cwd());
  const programsDir = path.join(wsDir, 'programs');
  if (!fs.existsSync(programsDir)) return {};
  const out = {};
  for (const f of fs.readdirSync(programsDir)) {
    if (!/^prog-.+\.yaml$/.test(f) || f === 'prog-template.yaml') continue;
    const r = readYAMLFile(path.join(programsDir, f));
    if (!r.ok || !r.data || !r.data.id) continue;
    const d = r.data;
    if (d.monitor_only === true) continue;
    const acc = d.accountability && d.accountability.on_finding;
    if (!acc || typeof acc.priority_floor !== 'number') continue;
    out[d.id] = {
      priority_floor: acc.priority_floor,
      cap_breach_active: !!(d.cap_breach && d.cap_breach.active === true),
      max_open_items: typeof acc.max_open_items === 'number' ? acc.max_open_items : null,
    };
  }
  return out;
}

function runCandidates(args) {
  const limit = parseInt(readFlag(args, 'limit') || '30', 10);
  const store = loadStore();
  const backlog = store.queue.byStatus('backlog') || [];

  // Source-class saturation lookup (Step 2d). Read last 3 anchors; classes
  // appearing ≥ 2 times become saturated → 0.7× damping factor.
  const recent = getRecentSprintAnchors(store, 3);
  const classCounts = {};
  for (const r of recent) {
    classCounts[r.anchor_source_class] = (classCounts[r.anchor_source_class] || 0) + 1;
  }
  const saturated = new Set();
  for (const [cls, n] of Object.entries(classCounts)) {
    if (SATURATED_CLASSES.has(cls) && n >= 2) saturated.add(cls);
  }

  // WS-350: program accountability caps. Candidates from cap-breached programs
  // get raw_score raised to that program's priority_floor before softblock /
  // damping / tiebreak. The cap field is reset on reconcile when work_items_open
  // drops back to max_open_items; until then breached programs naturally bubble
  // to the top of candidates without /next blocking sprint composition.
  const programCapsByProgram = loadProgramCapsByProgram();

  // Filter dependency-blocked items (Step 2: skip items where blocking items
  // are not yet `done`).
  const doneIds = new Set();
  for (const item of (store.queue.all() || [])) {
    if (item && item.status === 'done') doneIds.add(item.id);
  }
  function depsClear(item) {
    const deps = Array.isArray(item.blocked_by) ? item.blocked_by : [];
    if (deps.length === 0) return true;
    return deps.every((depId) => doneIds.has(depId));
  }

  const ranked = [];
  for (const item of backlog) {
    if (!depsClear(item)) continue;
    const sourceClass = item.source_class || classifySource(item);
    const rawDeclared = typeof item.priority_score === 'number' ? item.priority_score : 0;

    // WS-350: priority_floor application. Raise rawDeclared to floor when the
    // candidate's program is in cap-breach AND the item's declared score is
    // below floor. Pure additive — items already above floor are unaffected.
    let raw = rawDeclared;
    let priorityFloorApplied = null;
    const progCap = item.program ? programCapsByProgram[item.program] : null;
    if (progCap && progCap.cap_breach_active && rawDeclared < progCap.priority_floor) {
      raw = progCap.priority_floor;
      priorityFloorApplied = {
        from: rawDeclared,
        to: progCap.priority_floor,
        reason: `program-${item.program} cap-breach: priority_floor=${progCap.priority_floor} applied`,
      };
    }

    const softBlockFactor = (item.blocked_by_note && String(item.blocked_by_note).length > 0) ? 0.25 : 1.0;
    const sourceDamping = saturated.has(sourceClass) && !NEVER_DAMPED.has(sourceClass) ? 0.7 : 1.0;
    // Capability + context boosts deferred to a follow-up — the current
    // composition rationale relies on soft-block + source-class only (see
    // SPR-100..SPR-105 composition_notes). When/if .cwos-onboarding.yaml
    // capability boosts become live, this is the wiring point.
    const adjusted = raw * softBlockFactor * sourceDamping;
    const entry = {
      id: item.id,
      title: item.title || null,
      raw_score: raw,
      adjusted_score: round2(adjusted),
      effort: item.effort || null,
      program: item.program || null,
      source_class: sourceClass,
      blocked_by_note: (item.blocked_by_note && String(item.blocked_by_note).length > 0) ? item.blocked_by_note : null,
      soft_block_factor: softBlockFactor,
      source_damping: sourceDamping,
    };
    if (priorityFloorApplied) entry.priority_floor_applied = priorityFloorApplied;
    ranked.push(entry);
  }
  ranked.sort(candidateRankCmp);
  writeJson({
    saturated_classes: Array.from(saturated),
    last_anchor_classes: recent.map((r) => r.anchor_source_class),
    breached_programs: Object.keys(programCapsByProgram).filter((p) => programCapsByProgram[p].cap_breach_active),
    candidates: ranked.slice(0, limit),
  });
}

function round2(n) { return Math.round(n * 100) / 100; }

// Candidate sort comparator. Tiebreak at equal adjusted_score: prefer unblocked
// (higher soft_block_factor) so a small unblocked item beats a high-raw-score
// item that's soft-blocked at its prerequisite. Without this, e.g. WS-091
// (raw 64 × 0.25) beat WS-315 (raw 16 × 1.0) at the same adjusted_score 16,
// anchoring on work that can't run yet. Secondary tiebreak: higher raw_score.
function candidateRankCmp(a, b) {
  if (b.adjusted_score !== a.adjusted_score) return b.adjusted_score - a.adjusted_score;
  if (b.soft_block_factor !== a.soft_block_factor) return b.soft_block_factor - a.soft_block_factor;
  return b.raw_score - a.raw_score;
}

// ─── 3. compose ────────────────────────────────────────────────────────────

function runCompose(args) {
  const human = hasFlag(args, 'human');
  const candidatesFile = readFlag(args, 'candidates-file');
  const goalArg = readFlag(args, 'goal'); // optional founder-supplied goal
  const composedAt = readFlag(args, 'clock') || new Date().toISOString();
  const store = loadStore();

  // Source candidates either from stdin / a file / a fresh run-candidates pass.
  let candidatesPayload;
  if (candidatesFile) {
    candidatesPayload = JSON.parse(fs.readFileSync(candidatesFile, 'utf8'));
  } else {
    candidatesPayload = candidatesInline(store);
  }
  const candidates = candidatesPayload.candidates || [];
  if (candidates.length === 0) {
    writeJson({ ok: false, reason: 'no_candidates', composed_at: composedAt });
    process.exit(1);
  }

  const config = loadConfig();
  const cap = ceremonyDefaults(config.ceremony);
  // configNumber already normalised these; assign unconditionally so an
  // explicit 0 is honoured rather than read as "unset" by a truthiness test.
  if (config.sprints) {
    cap.max_items = configNumber(config.sprints.max_items, cap.max_items);
    cap.max_effort_sessions = configNumber(config.sprints.max_effort_sessions, cap.max_effort_sessions);
  }

  // Step 3a: anchor = top adjusted_score candidate.
  let anchor = candidates[0];

  // Step 3a-rotation: fleet-rotation override.
  const overrideClass = readContextOverrideClass();
  let rotationNote = null;
  if (overrideClass === 'internal-investment-phase') {
    rotationNote = 'fleet-rotation override SUPPRESSED via system/context.md active internal-investment-phase block';
  }
  // (Full rotation invariant — last 4 sprints, fleet/repo-goal classification
  // — deferred to a follow-up. The override path is the load-bearing branch
  // for this session because the founder is in an internal-investment phase.)

  // Step 3b/c: pull related items + cap by effort/items.
  const items = [anchor];
  let usedSessions = effortSessions(anchor.effort);
  for (const c of candidates.slice(1)) {
    if (items.length >= cap.max_items) break;
    if (usedSessions + effortSessions(c.effort) > cap.max_effort_sessions) break;
    // Prefer same program as anchor (continuity)
    if (anchor.program && c.program === anchor.program) {
      items.push(c);
      usedSessions += effortSessions(c.effort);
    }
  }

  // Step 3d: classify mode for each item via the shared module.
  const classified = items.map((it) => {
    const queueItem = store.queue.byId(it.id) || {};
    const mode = classifyMode(queueItem);
    return Object.assign({}, it, { mode, queue_item_known: !!queueItem.id });
  });

  // Step 3e: sequence — execute-no-deps first, then deps, then plan-first.
  classified.sort((a, b) => {
    const am = a.mode === 'execute' ? 0 : 1;
    const bm = b.mode === 'execute' ? 0 : 1;
    if (am !== bm) return am - bm;
    return b.adjusted_score - a.adjusted_score;
  });

  // Step 3f: goal — if --goal was provided, use it; else templated from anchor.
  const goal = goalArg || `Ship ${anchor.id}: ${anchor.title || 'work item'}`;

  // Step 3g: aggregate decisions.
  const decisions = [];
  for (const it of classified) {
    if (it.mode !== 'plan-first') continue;
    const queueItem = store.queue.byId(it.id) || {};
    const flags = Array.isArray(queueItem.decision_flags) ? queueItem.decision_flags : [];
    for (const f of flags) decisions.push(`Item ${it.id}: ${f}`);
  }

  // Step 4a: anti-goal cross-check.
  const checkText = [goal].concat(classified.map((c) => c.title || c.id)).join('; ');
  const anti = runConstitutionalAuditCheck(checkText);

  const sprint = {
    composed_at: composedAt,
    goal,
    program_focus: anchor.program || null,
    override_class: overrideClass || null,
    items: classified,
    decisions_needed: decisions,
    anti_goal_check: anti,
    composition_notes: buildCompositionNotes({
      anchor,
      candidates,
      saturated: candidatesPayload.saturated_classes || [],
      lastClasses: candidatesPayload.last_anchor_classes || [],
      rotationNote,
      effortSessions: usedSessions,
      cap,
      itemCount: classified.length,
      breachedPrograms: candidatesPayload.breached_programs || [],
    }),
    cap_used: {
      items: classified.length,
      effort_sessions: usedSessions,
      ceremony: config.ceremony,
      max_items: cap.max_items,
      max_effort_sessions: cap.max_effort_sessions,
      // WS-569: machine-readable, so a caller never has to re-derive whether a
      // composition fits by parsing the prose notes.
      over_cap: capOvershoot(classified.length, usedSessions, cap),
    },
  };

  // FIND-314 fix: always persist the canonical sidecar atomically before
  // emitting stdout. Approve consumes this path; stdout-only would let a
  // stale tmp file silently ratify on the next approve.
  const tmpPath = path.join(repoRoot(), '.claude', '.tmp-sprint.json');
  try { writeFileAtomic(tmpPath, JSON.stringify(sprint, null, 2) + '\n'); }
  catch (e) { process.stderr.write(`compose: sidecar write failed (non-fatal): ${e.message}\n`); }

  if (human) {
    process.stdout.write(renderHumanCompose(sprint));
    return;
  }
  writeJson(sprint);
}

function candidatesInline(store) {
  // In-process equivalent of `cwos-next.js candidates --json` for callers
  // (compose) that don't want to shell out.
  const backlog = store.queue.byStatus('backlog') || [];
  const recent = getRecentSprintAnchors(store, 3);
  const classCounts = {};
  for (const r of recent) classCounts[r.anchor_source_class] = (classCounts[r.anchor_source_class] || 0) + 1;
  const saturated = new Set();
  for (const [cls, n] of Object.entries(classCounts)) {
    if (SATURATED_CLASSES.has(cls) && n >= 2) saturated.add(cls);
  }
  // WS-350: mirror runCandidates priority_floor application.
  const programCapsByProgram = loadProgramCapsByProgram();
  const doneIds = new Set();
  for (const item of (store.queue.all() || [])) {
    if (item && item.status === 'done') doneIds.add(item.id);
  }
  const ranked = [];
  for (const item of backlog) {
    const deps = Array.isArray(item.blocked_by) ? item.blocked_by : [];
    if (!deps.every((d) => doneIds.has(d))) continue;
    const sourceClass = item.source_class || classifySource(item);
    const rawDeclared = typeof item.priority_score === 'number' ? item.priority_score : 0;
    let raw = rawDeclared;
    let priorityFloorApplied = null;
    const progCap = item.program ? programCapsByProgram[item.program] : null;
    if (progCap && progCap.cap_breach_active && rawDeclared < progCap.priority_floor) {
      raw = progCap.priority_floor;
      priorityFloorApplied = {
        from: rawDeclared,
        to: progCap.priority_floor,
        reason: `program-${item.program} cap-breach: priority_floor=${progCap.priority_floor} applied`,
      };
    }
    const softBlockFactor = (item.blocked_by_note && String(item.blocked_by_note).length > 0) ? 0.25 : 1.0;
    const sourceDamping = saturated.has(sourceClass) && !NEVER_DAMPED.has(sourceClass) ? 0.7 : 1.0;
    const entry = {
      id: item.id, title: item.title || null,
      raw_score: raw, adjusted_score: round2(raw * softBlockFactor * sourceDamping),
      effort: item.effort || null, program: item.program || null,
      source_class: sourceClass,
      blocked_by_note: (item.blocked_by_note && String(item.blocked_by_note).length > 0) ? item.blocked_by_note : null,
      soft_block_factor: softBlockFactor, source_damping: sourceDamping,
    };
    if (priorityFloorApplied) entry.priority_floor_applied = priorityFloorApplied;
    ranked.push(entry);
  }
  ranked.sort(candidateRankCmp);
  return {
    saturated_classes: Array.from(saturated),
    last_anchor_classes: recent.map((r) => r.anchor_source_class),
    breached_programs: Object.keys(programCapsByProgram).filter((p) => programCapsByProgram[p].cap_breach_active),
    candidates: ranked,
  };
}

function buildCompositionNotes({ anchor, candidates, saturated, lastClasses, rotationNote, effortSessions: used, cap, itemCount, breachedPrograms }) {
  const lines = [];
  lines.push(`Anchor: ${anchor.id} selected (${anchor.raw_score} × ${anchor.soft_block_factor !== 1 ? `${anchor.soft_block_factor} soft-block × ` : ''}${anchor.source_damping !== 1 ? `${anchor.source_damping} source-damping` : 'no damping'} = ${anchor.adjusted_score}).`);
  if (saturated.length > 0) {
    lines.push(`Source-class damping fired: last 3 anchor classes = [${lastClasses.join(', ')}]; saturated = [${saturated.join(', ')}]; 0.7×.`);
  }
  if (rotationNote) {
    lines.push(rotationNote);
  }
  // WS-350: surface cap-breach state + any priority_floor applications.
  if (Array.isArray(breachedPrograms) && breachedPrograms.length > 0) {
    lines.push(`Program cap-breach: ${breachedPrograms.join(', ')} (priority_floor applied to candidates from these programs).`);
  }
  const floored = (candidates || []).filter((c) => c.priority_floor_applied);
  if (floored.length > 0) {
    const sample = floored.slice(0, 3).map((c) => `${c.id} ${c.priority_floor_applied.from}→${c.priority_floor_applied.to}`).join(', ');
    const more = floored.length > 3 ? ` (+${floored.length - 3} more)` : '';
    lines.push(`priority_floor applied: ${sample}${more}.`);
  }
  lines.push(`Cap usage: ${used} session(s) / ${cap.max_effort_sessions} (${cap.max_items} items max).`);

  // WS-569 second half. Capping the LOOP is not the same as capping the SPRINT:
  // the anchor is seated before the loop runs, so a single L item (3 sessions)
  // overshoots a standard 2-session ceiling and every later break is a no-op.
  // SPR-028's stored record read "Cap usage: 10 session(s) / 2" as a neutral
  // line, which is how a 5x overshoot survived review. An overshoot that does
  // not announce itself is indistinguishable from a sprint that fits.
  const over = capOvershoot(itemCount, used, cap);
  if (over) lines.push(`⚠ OVER CEREMONY CAP — ${over}. Approving accepts the overshoot.`);

  return lines.join('\n');
}

/**
 * Describe how a composition exceeds its ceremony caps, or null if it fits.
 * Exported so the JSON path and the --human path cannot disagree about whether
 * a sprint is over cap.
 */
function capOvershoot(itemCount, usedSessions, cap) {
  const parts = [];
  if (Number.isFinite(cap.max_items) && itemCount > cap.max_items) {
    parts.push(`${itemCount} items against a ${cap.max_items}-item cap`);
  }
  if (Number.isFinite(cap.max_effort_sessions) && usedSessions > cap.max_effort_sessions) {
    parts.push(`${usedSessions} session(s) against a ${cap.max_effort_sessions}-session ceiling`);
  }
  return parts.length ? parts.join(' and ') : null;
}

function runConstitutionalAuditCheck(text) {
  const auditScript = path.join(__dirname, 'cwos-constitutional-audit.js');
  if (!fs.existsSync(auditScript)) return { status: 'unavailable', matches: [] };
  try {
    const r = spawnSync(process.execPath, [auditScript, '--check-text', text], { encoding: 'utf8' });
    if (r.status === 0) return { status: 'passed', matches: [] };
    if (r.status === 1) {
      let parsed;
      try { parsed = JSON.parse(r.stdout || '{}'); } catch { parsed = {}; }
      return { status: 'matched', matches: parsed.matches || [], raw: r.stdout || '' };
    }
    return { status: 'error', exit: r.status, stderr: r.stderr || '' };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

function renderHumanCompose(sprint) {
  const out = [];
  out.push(`## Proposed Sprint`);
  out.push(``);
  out.push(`### Goal`);
  out.push(sprint.goal);
  out.push(``);
  out.push(`### Items`);
  out.push(`| # | ID | Title | Mode | Effort |`);
  out.push(`|---|----|-------|------|--------|`);
  sprint.items.forEach((it, i) => {
    out.push(`| ${i + 1} | ${it.id} | ${it.title || ''} | ${it.mode === 'execute' ? 'Just do it' : 'Design first'} | ${it.effort || '?'} |`);
  });
  out.push(``);
  out.push(`### Cap usage`);
  out.push(`${sprint.cap_used.items} item(s), ~${sprint.cap_used.effort_sessions} session(s) (${sprint.cap_used.ceremony} ceremony).`);
  out.push(``);
  if (sprint.decisions_needed.length > 0) {
    out.push(`### Decisions needed`);
    for (const d of sprint.decisions_needed) out.push(`- ${d}`);
    out.push(``);
  }
  out.push(`### Composition notes`);
  out.push(sprint.composition_notes);
  out.push(``);
  out.push(`### Anti-goal check`);
  if (sprint.anti_goal_check.status === 'passed') out.push(`✓ Anti-goal check: clean.`);
  else if (sprint.anti_goal_check.status === 'matched') out.push(`⚠ Anti-goal check: ${sprint.anti_goal_check.matches.length} match(es) — review before approval.`);
  else out.push(`Anti-goal check: ${sprint.anti_goal_check.status}`);
  out.push(``);
  out.push(`---`);
  // Decision #8 footer — verbatim. Founders learn what is script vs AI judgment.
  out.push(`Sprint composition: deterministic (CLI). Rationale: pre-computed. Anti-goal check: deterministic (CLI).`);
  out.push(``);
  return out.join('\n');
}

// ─── 4. approve ────────────────────────────────────────────────────────────

function runApprove(args) {
  const sprintFile = readFlag(args, 'sprint-file');
  const aiAutonomous = hasFlag(args, 'ai-autonomous');
  const forceStale = hasFlag(args, 'force-stale');
  const approvedAt = readFlag(args, 'clock') || new Date().toISOString();

  // WS-269: rationale validated up front, mirroring the gate's
  // --override-token-budget friction-by-design pattern.
  const overrideActive = readFlag(args, 'override-active-sprint');
  if (overrideActive != null && overrideActive.length < 20) {
    process.stderr.write(`approve: --override-active-sprint rationale must be ≥ 20 characters; got ${overrideActive.length}\n`);
    process.exit(2);
  }

  if (!sprintFile) {
    process.stderr.write('approve: --sprint-file <path-to-compose-output.json> is required\n');
    process.exit(2);
  }
  let sprint;
  try { sprint = JSON.parse(fs.readFileSync(sprintFile, 'utf8')); }
  catch (e) {
    process.stderr.write(`approve: cannot read sprint file: ${e.message}\n`);
    process.exit(2);
  }

  // FIND-314 fix: freshness check on composed_at. Stale tmp files are the
  // root cause of phantom sprints (SPR-152/155/157/159). Env var override
  // primarily for tests; 5min default matches FIND-314 accept_criteria.
  const FRESHNESS_WINDOW_MS = parseInt(process.env.CWOS_NEXT_FRESHNESS_MS || '300000', 10);
  const composedAtStr = sprint.composed_at || null;
  if (!composedAtStr) {
    process.stderr.write('approve: sprint file missing composed_at field\n');
    process.exit(2);
  }
  const composedMs = Date.parse(composedAtStr);
  if (Number.isNaN(composedMs)) {
    process.stderr.write(`approve: sprint file has invalid composed_at (${composedAtStr})\n`);
    process.exit(2);
  }
  const ageMs = Date.now() - composedMs;
  const isStale = ageMs > FRESHNESS_WINDOW_MS;
  if (isStale && !forceStale) {
    process.stderr.write(
      `approve: sprint file is stale — composed ${Math.round(ageMs / 1000)}s ago (limit ${FRESHNESS_WINDOW_MS / 1000}s). ` +
      `Recompose with cwos-next.js compose, or pass --force-stale to override.\n`
    );
    process.exit(2);
  }

  // FIND-314 fix: intersection-with-done check. SPR-159's anchor was already
  // status:done — approve should never mint a sprint over closed items.
  const itemIdsForCheck = (sprint.items || []).map((it) => it.id);
  const doneIntersect = [];
  try {
    const store = loadStore();
    for (const id of itemIdsForCheck) {
      const q = store.queue.byId(id);
      if (q && q.status === 'done') doneIntersect.push(id);
    }
  } catch (e) { /* store unavailable; skip check rather than block */ }
  if (doneIntersect.length > 0 && !forceStale) {
    process.stderr.write(
      `approve: sprint includes already-done items: ${doneIntersect.join(', ')}. ` +
      `Recompose, or pass --force-stale to override.\n`
    );
    process.exit(2);
  }

  // --force-stale audit-trail event: emit BEFORE sprint_approved so the
  // override is captured even if the subsequent write fails. Non-fatal.
  if (forceStale && (isStale || doneIntersect.length > 0) && appendEvent && ensureCommandId) {
    try {
      appendEvent({
        source_track: 'T6:workstream-rebalance',
        source_tier: aiAutonomous ? 'llm-emission' : 'founder-prompt',
        track_tag: '/next',
        command_id: ensureCommandId('sprint-approve-force-stale'),
        payload: {
          type: 'force_stale_approve',
          sprint_file: sprintFile,
          composed_at: composedAtStr,
          age_ms: ageMs,
          freshness_window_ms: FRESHNESS_WINDOW_MS,
          intersected_done_ids: doneIntersect,
          stale_acknowledged: true,
        },
      });
    } catch (e) {
      process.stderr.write(`approve: force_stale_approve event emission failed (non-fatal): ${e.message}\n`);
    }
  }

  // WS-269 duplicate-sprint block: approve is the mutation boundary, so refuse
  // to mint a second sprint while an active/approved-unexecuted one is open.
  // The gate normally catches this first; this is the backstop for direct
  // approve calls and for concurrent sessions that gated before the other
  // session's approve landed.
  let openSprint = null;
  try { openSprint = resolveResumableSprint(loadStore()); }
  catch { /* store unavailable; dir scan inside resolveResumableSprint still applies */ }
  if (openSprint && overrideActive == null) {
    process.stderr.write(
      `approve: sprint ${openSprint.id} is ${openSprint.status === 'active' ? 'active' : 'approved but not executed'} — ` +
      `resume it via /next, abandon it, or pass --override-active-sprint "<rationale ≥20 chars>".\n`
    );
    process.exit(2);
  }
  if (openSprint && overrideActive != null && appendEvent && ensureCommandId) {
    try {
      appendEvent({
        source_track: 'T6:workstream-rebalance',
        source_tier: aiAutonomous ? 'llm-emission' : 'founder-prompt',
        track_tag: '/next',
        command_id: ensureCommandId('sprint-approve-override-active'),
        payload: {
          type: 'duplicate_sprint_acknowledged',
          open_sprint_id: openSprint.id,
          open_sprint_status: openSprint.status || null,
          rationale: overrideActive,
          acknowledged_at: approvedAt,
          authorized_by: aiAutonomous ? 'ai-autonomous' : 'founder',
        },
      });
    } catch (e) {
      process.stderr.write(`approve: duplicate_sprint_acknowledged event emission failed (non-fatal): ${e.message}\n`);
    }
  }

  const sprintsDir = path.join(stateDir(), 'sprints');
  if (!fs.existsSync(sprintsDir)) fs.mkdirSync(sprintsDir, { recursive: true });
  const sprintId = nextSprintId(sprintsDir);
  const yamlPath = path.join(sprintsDir, `${sprintId}.yaml`);
  const yamlText = renderSprintYaml(sprintId, sprint, approvedAt);
  writeFileAtomic(yamlPath, yamlText);

  // Emit sprint_approved event with default-proposal payload (fork-3) +
  // ALTERATION-5 two-field provenance.
  const itemIds = (sprint.items || []).map((it) => it.id);
  const anchorId = itemIds[0] || null;
  const payload = {
    sprint_id: sprintId,
    program_focus: sprint.program_focus || null,
    item_ids: itemIds,
    anchor_id: anchorId,
    anti_goal_check_status: (sprint.anti_goal_check && sprint.anti_goal_check.status) || 'unknown',
    authorized_by: aiAutonomous ? 'ai-autonomous' : 'founder',
    composed_by: 'cli-deterministic',
    composed_at: sprint.composed_at || approvedAt,
    approved_at: approvedAt,
  };
  let eventId = null;
  if (appendEvent && ensureCommandId) {
    try {
      const commandId = ensureCommandId('sprint-approve');
      const r = appendEvent({
        source_track: 'T6:workstream-rebalance',
        source_tier: aiAutonomous ? 'llm-emission' : 'founder-prompt',
        track_tag: '/next',
        command_id: commandId,
        payload: Object.assign({ type: 'sprint_approved' }, payload),
      });
      if (r && r.ok && r.event) eventId = r.event.id;
    } catch (e) {
      process.stderr.write(`approve: event emission failed (non-fatal): ${e.message}\n`);
    }
  }

  // Sprint-index.yaml is regenerated by the T6 reducer next time it fires.
  // We DO NOT hand-patch state/queue.json here — the event's reducer dispatch (via
  // state-store) re-reads queue/WS-*.yaml. The founder-edited WS files are the
  // editable surface; approve writes the sprint YAML and the reducer materializes
  // downstream.
  //
  // WS-533 lifts the deferral this comment used to record. Per-item claims were left
  // "in the founder-flow (or in next.md prose) until WS-267/268 templated similar
  // patterns" and were then never picked up — so /next's documented promise that
  // approve "claims items" went unimplemented long enough for two concurrent sessions
  // to collide (2026-07-26, and again in claude-poker-tracker on 2026-07-29).
  //
  // Replay-purity is preserved: claimed_by/claimed_at are LEASE state, not derived
  // state. No reducer computes them, nothing downstream reads them to rebuild
  // anything, and re-running the event log reproduces the same queue regardless of
  // their value. The write takes the same per-item lock as the done-path.
  let claimedIds = [];
  try {
    const wsDir = findWorkstreamDir(process.cwd());
    const sessionId = resolveSessionId(wsDir);
    touchSession(wsDir, sessionId);
    claimedIds = claimItems(wsDir, sessionId, itemIds, approvedAt);
  } catch (e) {
    process.stderr.write(`approve: claim write failed (non-fatal): ${e.message}\n`);
  }

  // WS-529: claimItems now reports what LANDED, so a shortfall is real
  // information rather than an artifact. Say it out loud. An approved sprint
  // whose items are not claimed is precisely what let SPR-194 sit for three
  // hours advertising WS-519 and WS-563 to every other session's /next — and
  // the reason nobody noticed is that approve reported success either way.
  const unclaimed = itemIds.filter((id) => !claimedIds.includes(id));
  if (unclaimed.length) {
    process.stderr.write(
      `approve: WARNING — ${unclaimed.length} of ${itemIds.length} item(s) were NOT claimed: ${unclaimed.join(', ')}. ` +
      `Another session may hold them, or the queue file is unwritable. ` +
      `They remain visible to other sessions' /next. Check with: node kit/scripts/cwos-item.js show <id>\n`
    );
  }

  writeJson({ ok: true, sprint_id: sprintId, sprint_path: yamlPath, event_id: eventId, claimed: claimedIds, payload });
}

function nextSprintId(sprintsDir) {
  let max = 0;
  for (const f of fs.readdirSync(sprintsDir)) {
    const m = f.match(/^SPR-(\d{3,4})\.yaml$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `SPR-${String(max + 1).padStart(3, '0')}`;
}

function renderSprintYaml(sprintId, sprint, approvedAt) {
  // Pragmatic YAML emit — matches the structure of SPR-104.yaml / SPR-105.yaml.
  // Block scalars (|) for goal/composition_notes; quoted scalars elsewhere.
  const out = [];
  out.push(`id: "${sprintId}"`);
  out.push(`title: ${yamlString(sprint.goal.split('\n')[0].slice(0, 100))}`);
  out.push(`status: approved`);
  out.push(`approved_at: "${approvedAt}"`);
  if (sprint.program_focus) out.push(`program_focus: "${sprint.program_focus}"`);
  if (sprint.override_class) out.push(`override_class: "${sprint.override_class}"`);
  out.push(``);
  out.push(`goal: |`);
  for (const line of sprint.goal.split('\n')) out.push(`  ${line}`);
  out.push(``);
  if (sprint.anti_goal_check) {
    out.push(`anti_goal_check:`);
    out.push(`  status: ${sprint.anti_goal_check.status}`);
    out.push(`  reviewed_at: "${approvedAt}"`);
    if (Array.isArray(sprint.anti_goal_check.matches) && sprint.anti_goal_check.matches.length > 0) {
      out.push(`  matches: ${JSON.stringify(sprint.anti_goal_check.matches)}`);
    } else {
      out.push(`  matches: []`);
    }
    out.push(``);
  }
  if (sprint.composition_notes) {
    out.push(`composition_notes: |`);
    for (const line of sprint.composition_notes.split('\n')) out.push(`  ${line}`);
    out.push(``);
  }
  out.push(`items:`);
  for (const it of (sprint.items || [])) {
    out.push(`  - id: "${it.id}"`);
    if (it.title) out.push(`    title: ${yamlString(it.title)}`);
    out.push(`    mode: ${it.mode || 'plan-first'}`);
    if (it.effort) out.push(`    effort: ${it.effort}`);
    out.push(`    status: pending`);
  }
  out.push(``);
  if (Array.isArray(sprint.decisions_needed) && sprint.decisions_needed.length > 0) {
    out.push(`decisions_needed:`);
    for (const d of sprint.decisions_needed) out.push(`  - ${yamlString(d)}`);
    out.push(``);
  }
  out.push(`created_at: "${approvedAt}"`);
  out.push(``);
  return out.join('\n');
}

function yamlString(s) {
  if (s == null) return '""';
  const str = String(s);
  if (/[:#\n"'{}\[\]&*!|>%@`]/.test(str)) return JSON.stringify(str);
  return `"${str}"`;
}

// Re-render a sprint YAML at closeout. Mirrors renderSprintYaml's structure
// but emits status=done plus completion metadata, and propagates per-item
// status/completed_at fields from the in-memory sprint object (which runDone
// has already mutated for the items it closed).
function renderSprintYamlClosed(sprintId, sprint, completedAt, completionCommit) {
  const out = [];
  const title = sprint.title || (sprint.goal ? sprint.goal.split('\n')[0].slice(0, 100) : sprintId);
  out.push(`id: "${sprintId}"`);
  out.push(`title: ${yamlString(title)}`);
  out.push(`status: done`);
  if (sprint.approved_at) out.push(`approved_at: "${sprint.approved_at}"`);
  out.push(`completed_at: "${completedAt}"`);
  if (completionCommit) out.push(`completed_by_commit: "${completionCommit}"`);
  if (sprint.manual_close_note) out.push(`manual_close_note: ${yamlString(sprint.manual_close_note)}`);
  if (sprint.program_focus) out.push(`program_focus: "${sprint.program_focus}"`);
  if (sprint.override_class) out.push(`override_class: "${sprint.override_class}"`);
  out.push(``);
  if (sprint.goal) {
    out.push(`goal: |`);
    for (const line of String(sprint.goal).split('\n')) out.push(`  ${line}`);
    out.push(``);
  }
  if (sprint.anti_goal_check) {
    out.push(`anti_goal_check:`);
    out.push(`  status: ${sprint.anti_goal_check.status || 'passed'}`);
    if (sprint.anti_goal_check.reviewed_at) out.push(`  reviewed_at: "${sprint.anti_goal_check.reviewed_at}"`);
    if (sprint.anti_goal_check.exemption_reason) {
      out.push(`  exemption_reason: ${yamlString(sprint.anti_goal_check.exemption_reason)}`);
    }
    const matches = Array.isArray(sprint.anti_goal_check.matches) ? sprint.anti_goal_check.matches : [];
    if (matches.length > 0) {
      out.push(`  matches: ${JSON.stringify(matches)}`);
    } else {
      out.push(`  matches: []`);
    }
    out.push(``);
  }
  if (sprint.composition_notes) {
    out.push(`composition_notes: |`);
    for (const line of String(sprint.composition_notes).split('\n')) out.push(`  ${line}`);
    out.push(``);
  }
  out.push(`items:`);
  for (const it of (sprint.items || [])) {
    out.push(`  - id: "${it.id}"`);
    if (it.title) out.push(`    title: ${yamlString(it.title)}`);
    if (it.mode) out.push(`    mode: ${it.mode}`);
    if (it.effort) out.push(`    effort: ${it.effort}`);
    out.push(`    status: ${it.status || 'pending'}`);
    if (it.completed_at) out.push(`    completed_at: "${it.completed_at}"`);
  }
  out.push(``);
  if (Array.isArray(sprint.decisions_needed) && sprint.decisions_needed.length > 0) {
    out.push(`decisions_needed:`);
    for (const d of sprint.decisions_needed) out.push(`  - ${yamlString(d)}`);
    out.push(``);
  }
  if (sprint.created_at) out.push(`created_at: "${sprint.created_at}"`);
  out.push(``);
  return out.join('\n');
}

// ─── 5. done ───────────────────────────────────────────────────────────────

function runDone(args) {
  const sprintId = readFlag(args, 'sprint');
  const completedAt = readFlag(args, 'clock') || new Date().toISOString();
  if (!sprintId) {
    process.stderr.write('done: --sprint SPR-NNN is required\n');
    process.exit(2);
  }
  const sprintsDir = path.join(stateDir(), 'sprints');
  const sprintPath = path.join(sprintsDir, `${sprintId}.yaml`);
  if (!fs.existsSync(sprintPath)) {
    process.stderr.write(`done: sprint file not found: ${sprintPath}\n`);
    process.exit(2);
  }

  const result = {
    ok: true,
    sprint_id: sprintId,
    completed_at: completedAt,
    event_id: null,
    reconcile: null,
    items_closed: [],
    items_skipped_already_done: [],
    items_skipped_user_skipped: [],
  };

  // Read sprint YAML — items + status. ADR-045 / DEC-034: runDone is
  // responsible for per-item closure (writing status=done to each queue YAML
  // AND emitting an item_closed event for each), in addition to the
  // sprint_completed event. The prior contract — "done emits a boundary
  // signal; founder closes items" — silently dropped item_closed events
  // (FIND-131) and made the auto-promotion failsafe in cwos-reconcile.js
  // unreachable. The current contract: event log records every closure
  // by construction; queue YAMLs are kept in sync atomically.
  const sprintRead = readYAMLFile(sprintPath);
  if (!sprintRead.ok || !sprintRead.data) {
    process.stderr.write(`done: sprint YAML unreadable: ${sprintPath}\n`);
    process.exit(2);
  }
  const sprint = sprintRead.data;
  const sprintItems = Array.isArray(sprint.items) ? sprint.items : [];

  // Resolve current git HEAD (committed_commit attribution). Best-effort —
  // missing HEAD is non-fatal; we still close items + emit events.
  let completionCommit = null;
  try {
    const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot(), encoding: 'utf8' });
    if (r.status === 0 && r.stdout) completionCommit = r.stdout.trim();
  } catch { /* non-fatal */ }

  // Per-item closure pass. For each item the sprint references that has not
  // already been closed (or explicitly skipped), emit item_closed event then
  // mutate the queue YAML. Event-log-first: the event is the commit point,
  // YAML mutation is the materialized view. Idempotent — re-running done()
  // emits zero new events for already-closed items.
  const queueDir = path.join(stateDir(), 'queue');
  for (const spItem of sprintItems) {
    if (!spItem || !spItem.id) continue;
    if (!/^WS-\d+$/.test(spItem.id)) continue;
    if (spItem.status === 'skipped') {
      result.items_skipped_user_skipped.push(spItem.id);
      continue;
    }
    const queuePath = path.join(queueDir, `${spItem.id}.yaml`);
    if (!fs.existsSync(queuePath)) continue;
    const qRead = readYAMLFile(queuePath);
    if (!qRead.ok || !qRead.data) continue;
    const qStatus = qRead.data.status;
    if (qStatus === 'done' || qStatus === 'skipped') {
      result.items_skipped_already_done.push(spItem.id);
      continue;
    }

    // Emit item_closed event FIRST (event-log is commit point per
    // core/rebalance.js convention). If the YAML write below fails, the next
    // cwos-reconcile run promotes it via promoteStaleQueueItemsFromSprints
    // (defense-in-depth). Track is T6:workstream so the workstream + sprints
    // reducers re-materialize state/*.json automatically.
    let itemEventId = null;
    if (appendEvent && ensureCommandId) {
      try {
        const commandId = ensureCommandId('item-closed');
        const r = appendEvent({
          source_track: 'T6:workstream',
          source_tier: 'founder-prompt',
          track_tag: 'item_closed',
          command_id: commandId,
          payload: {
            type: 'item_closed',
            ws_id: spItem.id,
            sprint_id: sprintId,
            completed_at: completedAt,
            completion_commit: completionCommit,
          },
        });
        if (r && r.ok && r.event) itemEventId = r.event.id;
      } catch (e) { /* non-fatal */ }
    }

    // Mutate the queue YAML in place — preserve hand-edited content
    // (description, accept_criteria, completion_notes) by regex-replacing
    // only the status field and appending closure metadata. Mirrors the
    // pattern in cwos-reconcile.js promoteStaleQueueItemsFromSprints.
    // WS-311: lock per-item to serialize against concurrent reconcile
    // patches at cwos-reconcile.js:315 and :813.
    try {
      withFileLock(queuePath + '.lock', () => {
        const raw = fs.readFileSync(queuePath, 'utf8');
        let patched = raw.replace(/^status:\s*.*$/m, `status: done`);
        // WS-561: these three used to test `!/^key:/m` — key PRESENCE, not
        // value. An item scaffolding `completed_at: null` while open matched,
        // so the write no-opped and `done` reported ok. upsertYAMLScalarField
        // fills absent-or-null and leaves a real value alone.
        patched = upsertYAMLScalarField(patched, 'completed_at', completedAt, { after: 'status' }).content;
        if (completionCommit) {
          patched = upsertYAMLScalarField(patched, 'completion_commit', completionCommit, { after: 'completed_at' }).content;
        }
        if (itemEventId) {
          patched = upsertYAMLScalarField(patched, 'closed_by_event', itemEventId).content;
        }
        writeFileAtomic(queuePath, patched);
      }, { ownerLabel: 'next:done', maxWaitMs: 5000 });
    } catch (e) {
      // Write failure is non-fatal — the item_closed event is already in the
      // log, so the next reconcile run will catch up via the event-log
      // drift detector (validateStateDrift, ADR-045).
    }

    // Mirror the closure into the sprint YAML's items list (so the sprints
    // reducer's items_done counter advances, and so promoteStaleQueueItemsFromSprints
    // sees a matching done state for any future repair pass).
    spItem.status = 'done';
    if (!spItem.completed_at) spItem.completed_at = completedAt;

    result.items_closed.push({ ws_id: spItem.id, event_id: itemEventId });

    // WS-310 Phase C: auto-resolved calibration write. If the closing queue
    // item carries a `finding_id`, the resolution implies the finding was
    // useful — append entries to findings-feedback.yaml + finding-lifecycle.yaml
    // and refresh the validator hash. Failures are non-fatal: the item_closed
    // event is already in the log; cwos-reconcile catches drift on next pass.
    //
    // 2026-05-19 (SpeechTherapyGame WS-024 upstream patch): also accept
    // finding link at source.finding (the auto-promoter writes there);
    // broaden regex to admit FIND-B003, FIND-CA-INV-F1, etc. — not just
    // digit-only IDs.
    // Accept every shape a finding link appears in: top-level finding_id,
    // top-level source_finding (what the auto-promoter writes — previously
    // missed, so auto-promoted items never auto-resolved), and source.finding /
    // source.finding_id (legacy + auto-promoter nested form).
    const findingId =
      (qRead.data && qRead.data.finding_id) ||
      (qRead.data && qRead.data.source_finding) ||
      (qRead.data && qRead.data.source && (qRead.data.source.finding || qRead.data.source.finding_id)) ||
      null;
    if (findingId && /^FIND-[A-Za-z0-9-]+$/.test(findingId)) {
      try {
        const { writeAutoResolvedEntries } = require('./lib/auto-resolved');
        const wr = writeAutoResolvedEntries({
          rootDir: repoRoot(),
          findingId,
          wsId: spItem.id,
          sprintId,
          completedAt,
        });
        if (!result.auto_resolved_writes) result.auto_resolved_writes = [];
        result.auto_resolved_writes.push({
          ws_id: spItem.id,
          finding_id: findingId,
          feedback_appended: !!wr.feedback_appended,
          lifecycle_appended: !!wr.lifecycle_appended,
          hash_updated: !!wr.hash_updated,
          warnings: wr.warnings || [],
        });
        for (const w of (wr.warnings || [])) {
          process.stderr.write(`done: auto-resolved ${findingId}: ${w}\n`);
        }
      } catch (e) {
        process.stderr.write(`done: auto-resolved write for ${findingId} threw (non-fatal): ${e.message}\n`);
      }
    }
  }

  // Persist sprint YAML — status=done + completed_at + completed_by_commit +
  // items[].status updates. Re-render via renderSprintYamlClosed (preserves
  // structure of approve-time render but flips status + adds completion fields).
  try {
    const closedYaml = renderSprintYamlClosed(sprintId, sprint, completedAt, completionCommit);
    writeFileAtomic(sprintPath, closedYaml);
  } catch (e) {
    result.sprint_yaml_write_error = e.message;
  }

  // Emit sprint_completed event (boundary signal preserved). Track stays at
  // T6:workstream-rebalance to match the historical schema for this event
  // type — schema lookup is tolerant for this track (events.js
  // _resolveSchemaLookup), so no schema migration is required.
  if (appendEvent && ensureCommandId) {
    try {
      const commandId = ensureCommandId('sprint-done');
      const r = appendEvent({
        source_track: 'T6:workstream-rebalance',
        source_tier: 'founder-prompt',
        track_tag: '/next',
        command_id: commandId,
        payload: {
          type: 'sprint_completed',
          sprint_id: sprintId,
          completed_at: completedAt,
          completion_commit: completionCommit,
          items_closed: result.items_closed.map((i) => i.ws_id),
          composed_by: 'cli-deterministic',
        },
      });
      if (r && r.ok && r.event) result.event_id = r.event.id;
    } catch (e) { /* non-fatal */ }
  }

  // WS-533: a closed item releases its lease. Without this the queue accretes claims
  // that outlive the session that took them, and the first stale hold teaches everyone
  // to ignore the conflict warning — which is worse than never having had one.
  try {
    releaseItems(findWorkstreamDir(process.cwd()), result.items_closed.map((i) => i.ws_id));
  } catch (e) {
    process.stderr.write(`done: claim release failed (non-fatal): ${e.message}\n`);
  }

  // Health recompute using the canonical formula. Iterates over programs
  // referenced by the sprint's items. TODO(WS-267): replace with cwos-pulse
  // compute-health when that CLI lands.
  if (computeHealthScore) {
    try {
      const programsDir = path.join(stateDir(), 'programs');
      const findingsPath = path.join(stateDir(), 'findings-index.yaml');
      let findingsIndex = [];
      if (fs.existsSync(findingsPath)) {
        const fr = readYAMLFile(findingsPath);
        if (fr.ok && fr.data && Array.isArray(fr.data.findings)) findingsIndex = fr.data.findings;
      }
      // Collect program-ids from the sprint's items (read sprint YAML).
      const sr = readYAMLFile(sprintPath);
      const programs = new Set();
      if (sr.ok && sr.data && sr.data.program_focus) programs.add(sr.data.program_focus);
      const updates = [];
      const todayISOdate = (completedAt || '').slice(0, 10);
      for (const pid of programs) {
        const pf = path.join(programsDir, `prog-${pid}.yaml`);
        if (!fs.existsSync(pf)) continue;
        const r = readYAMLFile(pf);
        if (!r.ok || !r.data) continue;
        const score = computeHealthScore(r.data, findingsIndex, todayISOdate);
        updates.push({ program: pid, recomputed_score: score });
      }
      result.health_recompute = updates;
    } catch (e) { result.health_recompute = { error: e.message }; }
  }

  // Run cwos-reconcile --quiet (subprocess; mirrors how /next prose did it).
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'cwos-reconcile.js'), '--quiet'], { encoding: 'utf8' });
    result.reconcile = { exit: r.status, stderr: (r.stderr || '').trim() || null };
    if (r.status !== 0) {
      writeJson(result);
      process.exit(1);
    }
  } catch (e) {
    result.reconcile = { error: e.message };
  }

  writeJson(result);
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  if (!sub || sub === '--help' || sub === '-h') {
    process.stdout.write(
      'usage: cwos-next <gate|candidates|compose|approve|done|allocate-ws-id> [options]\n' +
      '\n' +
      'subcommands:\n' +
      '  gate            check for an active sprint, blocks, drift and claim conflicts\n' +
      '  candidates      ranked backlog candidates (JSON)\n' +
      '  compose         compose a sprint; --human renders the preview\n' +
      '  approve         write the sprint YAML and claim its items\n' +
      '  done            close a sprint and its items\n' +
      '  allocate-ws-id  allocate an id, reserving it so the next call differs\n' +
      '\n' +
      'allocate-ws-id options:\n' +
      '  --kind <ws|spr|find|inv|adr>   which id kind (default: ws)\n' +
      '        ws/spr/find scan workstream state; inv/adr scan the repo tree.\n' +
      '        The returned id is reserved for 24h, so consecutive calls never\n' +
      '        collide even when no file is written between them (WS-574).\n'
    );
    process.exit(sub ? 0 : 1);
  }
  try {
    switch (sub) {
      case 'gate':       return runGate(args.slice(1));
      case 'candidates': return runCandidates(args.slice(1));
      case 'compose':    return runCompose(args.slice(1));
      case 'approve':    return runApprove(args.slice(1));
      case 'done':       return runDone(args.slice(1));
      case 'allocate-ws-id': return runAllocateWsId(args.slice(1));
      default:
        process.stderr.write(`cwos-next: unknown subcommand: ${sub}\n`);
        process.exit(2);
    }
  } catch (err) {
    // Final safety net — AS-23: do not break invoking commands on
    // unexpected internal errors. Surface to stderr; exit non-fatal.
    process.stderr.write(`cwos-next: ${err.message}\n${err.stack || ''}\n`);
    process.exit(0);
  }
}

// WS-040: deterministic WS-id allocation. Engine/AI synthesis flows MUST call this
// instead of eyeballing the active-queue max — the lib scans queue/ + queue/archive/ +
// queue-index.yaml, so it never re-issues a retired (archived) id. Re-issuing an id
// that still lives in queue/archive/ and in a done sprint is what let reconcile
// force-complete a brand-new item (the SPR-018 incident). Output is JSON:
//   { "ok": true, "ws_id": "WS-041" }
// WS-574: this returned the same id on every consecutive call, because it took
// the unlocked scan path and reserved nothing — so until a file existed at the
// returned id, the next caller got it again. It now reserves what it returns.
// `--kind` extends the same guarantee to SPR, FIND, INV and ADR ids, which
// previously had no allocator at all (two sessions both allocated INV-067 on
// 2026-08-03; the collision was caught by hand during a rebase).
function runAllocateWsId(argv = []) {
  const ws = findWorkstreamDir(process.cwd());

  let kind = 'ws';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--kind') { kind = String(argv[i + 1] || '').toLowerCase(); i++; }
    else if (argv[i].startsWith('--kind=')) kind = argv[i].slice(7).toLowerCase();
    else {
      // ADR-063: an unrecognised flag is fatal rather than silently ignored.
      process.stderr.write(`cwos-next allocate-ws-id: unknown option "${argv[i]}"\n`);
      process.exit(2);
    }
  }

  let allocateId, kindNames, KINDS;
  try { ({ allocateId, kindNames, KINDS } = require('./lib/id-allocator')); }
  catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: `allocator lib unavailable: ${e.message}` }) + '\n');
    process.exit(0);
  }

  if (!KINDS[kind]) {
    process.stderr.write(`cwos-next allocate-ws-id: --kind must be one of ${kindNames().join(', ')}\n`);
    process.exit(2);
  }

  // Code root and state root are separate questions on purpose (CLAUDE.md):
  // INV/ADR are branch content and live under the repo root; WS/SPR/FIND are
  // shared state. Never derive one from the other.
  const repoRoot = KINDS[kind].root === 'code' ? findRepoRoot(process.cwd()) : undefined;

  const id = allocateId(kind, { wsDir: ws, repoRoot, reservedBy: `cwos-next:pid:${process.pid}` });
  process.stdout.write(JSON.stringify({
    ok: true,
    kind,
    id,
    ...(kind === 'ws' ? { ws_id: id } : {}),   // back-compat for existing callers
    scanned: KINDS[kind].describe,
    reserved: true,
  }) + '\n');
  return id;
}

if (require.main === module) main();

module.exports = {
  // exported for tests + downstream composition
  runGate, runCandidates, runCompose, runApprove, runDone, runAllocateWsId,
  candidatesInline, buildCompositionNotes, renderSprintYaml, renderSprintYamlClosed,
  readContextOverrideClass, ceremonyDefaults, effortSessions,
  configNumber, capOvershoot, loadConfig,
  nextSprintId,
  findResumableSprint, readSprintsFromDir, resolveResumableSprint,
  loadProgramCapsByProgram,
};
