#!/usr/bin/env node
/**
 * cwos-token-budget — BLOCKING gate verifier (WS-272 + WS-289, ADR-037 Decision #5).
 *
 * Reads `tool_rounds_actual` + `tokens_derived` telemetry from the event
 * log (stamped by WS-260 Stop-hook on `command_completed` events) and
 * detects budget regressions per the rule:
 *
 *   3 consecutive monotonic increases on tokens_derived for one tag
 *   AND latest > earliest × (1 + threshold_pct)
 *
 * When the rule trips for `/next`, emit a `budget_regression_blocked` event
 * and exit 1. cwos-next.js gate treats exit 1 as a hard block on sprint
 * composition. Founder unblocks via:
 *
 *   /next gate --override-token-budget "<rationale ≥20 chars>"
 *
 * **Per-engine extension (WS-289, closes FIND-123):**
 *   --tag /engine/<engine-id> — scopes the check to one engine, sourcing
 *   samples from `engine_run_completed` events (T7:engines, payload.engine_id).
 *   Threshold defaults to 0.20 (vs /next's 0.15) because engine variance is
 *   wider. Trips emit `engine_token_budget_alarm`. Founder unblocks via:
 *
 *     --override-engine-token-budget "<rationale ≥20 chars>"
 *
 *   which emits `engine_token_budget_acknowledged` and exits 0.
 *
 *   Until run-016 F2 lands (engine_run_completed events stamped with
 *   tokens_derived by the /engine command), this path returns
 *   `insufficient_data` for every engine — that's the documented baseline.
 *
 * Threshold tuning via .cwos-config.yaml:
 *   `token_budget.regression_threshold` (default 0.15) — applies to /next
 *   `token_budget.engine_regression_threshold` (default 0.20) — applies to /engine/*
 *   `token_budget.window_size` (default 3) — applies to both
 *
 * Replay-purity: read-only against state-store + event log. Single event
 * emission when blocking or acknowledging. Accepts --clock <iso> for tests.
 *
 * Usage:
 *   cwos-token-budget --check                                # /next, exit 0|1
 *   cwos-token-budget --check --tag /next                    # explicit tag scope
 *   cwos-token-budget --check --tag /engine/eng-engine       # per-engine scope
 *   cwos-token-budget --check --clock <iso>                  # for tests
 *   cwos-token-budget --check --no-emit                      # don't emit event
 *   cwos-token-budget --check --events-dir <p>               # for fixture testing
 *   cwos-token-budget --check --tag /engine/<id> \
 *     --override-engine-token-budget "<rationale ≥20 chars>" # founder bypass
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');

const { findWorkstreamDir, readYAMLFile, loadEventDeps } = require('./lib/cwos-utils');

const { appendEvent, ensureCommandId } = loadEventDeps();

let stateStoreMod = null;
try { stateStoreMod = require('./core/state-store'); }
catch { /* state-store unavailable; will fall back to event-log scan */ }

const DEFAULT_THRESHOLD_PCT = 0.15;
const DEFAULT_ENGINE_THRESHOLD_PCT = 0.20;
const DEFAULT_WINDOW_SIZE = 3;
const DEFAULT_TAG = '/next';
const ENGINE_TAG_PREFIX = '/engine/';
const ENGINE_TAG_RE = /^\/engine\/([A-Za-z0-9._:-]+)$/;
const MIN_OVERRIDE_RATIONALE_LEN = 20;

// ─── Helpers ───────────────────────────────────────────────────────────────

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

function repoRoot() {
  const ws = findWorkstreamDir(process.cwd());
  return path.resolve(ws, '..', '..');
}

function loadConfigThreshold(tag) {
  // Read .cwos-config.yaml `token_budget.*` if present.
  // tag-aware: /engine/* uses engine_regression_threshold (default 0.20),
  // everything else uses regression_threshold (default 0.15).
  const isEngine = typeof tag === 'string' && tag.startsWith(ENGINE_TAG_PREFIX);
  const fallback = isEngine ? DEFAULT_ENGINE_THRESHOLD_PCT : DEFAULT_THRESHOLD_PCT;
  try {
    const p = path.join(repoRoot(), '.cwos-config.yaml');
    if (!fs.existsSync(p)) return { threshold_pct: fallback, window_size: DEFAULT_WINDOW_SIZE };
    const r = readYAMLFile(p);
    if (!r.ok || !r.data || !r.data.token_budget) return { threshold_pct: fallback, window_size: DEFAULT_WINDOW_SIZE };
    const tb = r.data.token_budget || {};
    const cfgKey = isEngine ? 'engine_regression_threshold' : 'regression_threshold';
    return {
      threshold_pct: typeof tb[cfgKey] === 'number' ? tb[cfgKey] : fallback,
      window_size: typeof tb.window_size === 'number' ? tb.window_size : DEFAULT_WINDOW_SIZE,
    };
  } catch {
    return { threshold_pct: fallback, window_size: DEFAULT_WINDOW_SIZE };
  }
}

// ─── Telemetry source: prefer state-store, fall back to event-log scan ────

function loadEnvelopeSamples({ tag, eventsDir, workstreamDir }) {
  // Returns: array of {command_id, tag, completed_at, tokens_derived, tool_rounds_actual}
  // Per-engine tags route through engine_run_completed events directly;
  // /next-style tags use the state-store / command_telemetry path.
  const engineMatch = typeof tag === 'string' ? tag.match(ENGINE_TAG_RE) : null;
  if (engineMatch) {
    return loadFromEngineCompleted({ engineId: engineMatch[1], tag, eventsDir, workstreamDir });
  }
  const fromState = loadFromStateStore(tag);
  if (fromState.length > 0) return fromState;
  return loadFromEventLog({ tag, eventsDir, workstreamDir });
}

function loadFromEngineCompleted({ engineId, tag, eventsDir, workstreamDir }) {
  // WS-289: scan engine_run_completed events (T7:engines), filter by engine_id,
  // return samples shaped like the /next path so detectRegression can consume
  // them unmodified. Skips events without numeric tokens_derived — those flow
  // through as insufficient_data, which is the documented behavior until
  // run-016 F2 wires up tokens_derived stamping on engine_run_completed.
  const dir = eventsDir || path.join(workstreamDir || path.join(repoRoot(), '.claude', 'workstream'), 'events');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
    .sort();
  const samples = [];
  for (const f of files) {
    let lines;
    try { lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n'); }
    catch { continue; }
    for (const line of lines) {
      if (!line.trim()) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      const p = ev.payload || {};
      if (p.type !== 'engine_run_completed') continue;
      if (p.engine_id !== engineId) continue;
      if (typeof p.tokens_derived !== 'number' || p.tokens_derived <= 0) continue;
      samples.push({
        command_id: ev.command_id,
        tag,
        completed_at: p.completed_at || ev.timestamp,
        tokens_derived: p.tokens_derived,
        run_id: p.run_id || null,
      });
    }
  }
  samples.sort((a, b) => (a.completed_at || '').localeCompare(b.completed_at || ''));
  return samples;
}

function loadFromStateStore(tag) {
  if (!stateStoreMod) return [];
  try {
    const store = stateStoreMod.stateStore;
    store.load();
    const all = (store.envelope && store.envelope.all && store.envelope.all()) || [];
    const items = all.filter((d) =>
      d && d.tag === tag &&
      typeof d.tokens_derived === 'number' && d.tokens_derived > 0 &&
      d.completed_at
    );
    items.sort((a, b) => (a.completed_at || '').localeCompare(b.completed_at || ''));
    return items.map((d) => ({
      command_id: d.command_id,
      tag: d.tag,
      completed_at: d.completed_at,
      tokens_derived: d.tokens_derived,
      tool_rounds_actual: d.tool_rounds_actual,
    }));
  } catch { return []; }
}

function loadFromEventLog({ tag, eventsDir, workstreamDir }) {
  // Direct scan: pair command_completed (command=tag) with
  // command_telemetry_stamped (matching command_id).
  const dir = eventsDir || path.join(workstreamDir || path.join(repoRoot(), '.claude', 'workstream'), 'events');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
    .sort();
  const completedByCmdId = new Map(); // command_id → {completed_at, command_id}
  const telemByCmdId = new Map();     // command_id → {tokens_derived, tool_rounds_actual}
  for (const f of files) {
    let lines;
    try { lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n'); }
    catch { continue; }
    for (const line of lines) {
      if (!line.trim()) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      const p = ev.payload || {};
      if (p.type === 'command_completed' && p.command === tag) {
        completedByCmdId.set(ev.command_id, {
          command_id: ev.command_id,
          completed_at: ev.timestamp,
        });
      }
      if (p.type === 'command_telemetry_stamped' &&
          typeof p.tokens_derived === 'number') {
        telemByCmdId.set(ev.command_id, {
          tokens_derived: p.tokens_derived,
          tool_rounds_actual: p.tool_rounds_actual,
        });
      }
    }
  }
  // Inner-join: only items with both completion + telemetry
  const merged = [];
  for (const [cid, c] of completedByCmdId.entries()) {
    const t = telemByCmdId.get(cid);
    if (!t) continue;
    merged.push({
      command_id: cid, tag,
      completed_at: c.completed_at,
      tokens_derived: t.tokens_derived,
      tool_rounds_actual: t.tool_rounds_actual,
    });
  }
  merged.sort((a, b) => (a.completed_at || '').localeCompare(b.completed_at || ''));
  return merged;
}

// ─── Regression detection (pure function) ─────────────────────────────────

/**
 * Apply the 3-consecutive + pct-floor rule to a sorted array of samples
 * (oldest first). Returns:
 *   { blocked: boolean, reason, samples_used, threshold_pct, ... }
 *
 * Pure: no I/O, no date calls, no events. Same input → same output.
 */
function detectRegression(samples, { threshold_pct, window_size }) {
  const w = window_size || DEFAULT_WINDOW_SIZE;
  const pct = typeof threshold_pct === 'number' ? threshold_pct : DEFAULT_THRESHOLD_PCT;
  if (!Array.isArray(samples) || samples.length < w) {
    return {
      blocked: false,
      reason: 'insufficient_data',
      sample_count: Array.isArray(samples) ? samples.length : 0,
      window_size: w,
      threshold_pct: pct,
    };
  }
  const window = samples.slice(-w);
  const tokens = window.map((s) => s.tokens_derived);
  // Monotonic strictly-increasing check
  let monotonic = true;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] <= tokens[i - 1]) { monotonic = false; break; }
  }
  if (!monotonic) {
    return {
      blocked: false,
      reason: 'not_monotonic',
      sample_count: samples.length,
      window_tokens: tokens,
      window_command_ids: window.map((s) => s.command_id),
      threshold_pct: pct,
    };
  }
  // Pct floor: last > first × (1 + pct)
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const pctIncrease = (last - first) / first;
  if (pctIncrease <= pct) {
    return {
      blocked: false,
      reason: 'monotonic_below_pct_floor',
      sample_count: samples.length,
      window_tokens: tokens,
      window_command_ids: window.map((s) => s.command_id),
      pct_increase: round4(pctIncrease),
      threshold_pct: pct,
    };
  }
  return {
    blocked: true,
    reason: `${w}-consecutive-regression-with-pct-floor`,
    sample_count: samples.length,
    window_tokens: tokens,
    window_command_ids: window.map((s) => s.command_id),
    pct_increase: round4(pctIncrease),
    threshold_pct: pct,
  };
}

function round4(n) { return Math.round(n * 10000) / 10000; }

// ─── --check ──────────────────────────────────────────────────────────────

function runCheck(args) {
  const tag = readFlag(args, 'tag') || DEFAULT_TAG;
  const eventsDir = readFlag(args, 'events-dir');
  const workstreamDir = readFlag(args, 'workstream-dir');
  const noEmit = hasFlag(args, 'no-emit');
  const clock = readFlag(args, 'clock');
  const overrideEngineRationale = readFlag(args, 'override-engine-token-budget');
  const config = loadConfigThreshold(tag);

  const engineMatch = tag.match(ENGINE_TAG_RE);
  const isEngineTag = !!engineMatch;
  const engineId = engineMatch ? engineMatch[1] : null;

  // Validate override rationale early — usage error before any sampling.
  if (overrideEngineRationale != null) {
    if (!isEngineTag) {
      process.stderr.write('cwos-token-budget: --override-engine-token-budget only applies to /engine/<id> tags\n');
      process.exit(2);
    }
    if (overrideEngineRationale.length < MIN_OVERRIDE_RATIONALE_LEN) {
      process.stderr.write(`cwos-token-budget: --override-engine-token-budget rationale must be ≥${MIN_OVERRIDE_RATIONALE_LEN} chars\n`);
      process.exit(2);
    }
  }

  const samples = loadEnvelopeSamples({ tag, eventsDir, workstreamDir });
  const detection = detectRegression(samples, config);

  const result = Object.assign({
    ok: true,
    tag,
    blocked: detection.blocked,
    sample_count: detection.sample_count,
    last_3_tokens: detection.window_tokens || [],
    threshold_pct: detection.threshold_pct,
    reason: detection.reason,
  }, detection.window_command_ids ? { window_command_ids: detection.window_command_ids } : {},
     detection.pct_increase != null ? { pct_increase: detection.pct_increase } : {},
     isEngineTag ? { engine_id: engineId } : {});

  // WS-289: founder override on /engine/<id> tags. The flip from blocked→0
  // applies regardless of --no-emit; emission is suppressed when --no-emit.
  if (detection.blocked && isEngineTag && overrideEngineRationale != null) {
    if (!noEmit) {
      const eventId = emitEngineAcknowledgedEvent({
        detection, tag, engineId,
        rationale: overrideEngineRationale, clock,
      });
      result.event_id = eventId;
    }
    result.acknowledged = true;
    result.blocked = false;
    writeJson(result);
    process.exit(0);
  }

  if (detection.blocked && !noEmit) {
    if (isEngineTag) {
      const eventId = emitEngineAlarmEvent({ detection, tag, engineId, samples, clock });
      result.event_id = eventId;
    } else {
      const eventId = emitBlockedEvent(detection, tag, clock);
      result.event_id = eventId;
    }
  }

  writeJson(result);
  process.exit(detection.blocked ? 1 : 0);
}

function emitEngineAlarmEvent({ detection, tag, engineId, samples, clock }) {
  if (!appendEvent || !ensureCommandId) return null;
  try {
    const commandId = ensureCommandId('engine-token-budget-alarm');
    const windowSamples = samples.slice(-detection.window_tokens.length);
    const payload = {
      type: 'engine_token_budget_alarm',
      tag,
      engine_id: engineId,
      tokens_t0: detection.window_tokens[0],
      tokens_t1: detection.window_tokens[1],
      tokens_t2: detection.window_tokens[2],
      pct_increase: detection.pct_increase,
      threshold_pct: detection.threshold_pct,
      command_ids: detection.window_command_ids,
      run_ids: windowSamples.map((s) => s.run_id || null),
      reason: 'engine-token-budget-regression',
      composed_by: 'cli-deterministic',
      detected_at: clock || new Date().toISOString(),
    };
    const r = appendEvent({
      source_track: 'T0:envelope',
      source_tier: 'reducer-output',
      track_tag: 'engine_token_budget_alarm',
      command_id: commandId,
      payload,
    });
    if (r && !r.ok) {
      process.stderr.write(`cwos-token-budget: alarm event validation: ${(r.errors || []).join('; ')}\n`);
      return null;
    }
    return (r && r.ok && r.event) ? r.event.id : null;
  } catch (e) {
    process.stderr.write(`cwos-token-budget: alarm event emission failed (non-fatal): ${e.message}\n`);
    return null;
  }
}

function emitEngineAcknowledgedEvent({ detection, tag, engineId, rationale, clock }) {
  if (!appendEvent || !ensureCommandId) return null;
  try {
    const commandId = ensureCommandId('engine-token-budget-ack');
    const payload = {
      type: 'engine_token_budget_acknowledged',
      tag,
      engine_id: engineId,
      rationale,
      tokens_t0: detection.window_tokens[0],
      tokens_t1: detection.window_tokens[1],
      tokens_t2: detection.window_tokens[2],
      pct_increase: detection.pct_increase,
      threshold_pct: detection.threshold_pct,
      composed_by: 'cli-deterministic',
      acknowledged_at: clock || new Date().toISOString(),
    };
    const r = appendEvent({
      source_track: 'T0:envelope',
      source_tier: 'founder-prompt',
      track_tag: 'engine_token_budget_acknowledged',
      command_id: commandId,
      payload,
    });
    if (r && !r.ok) {
      process.stderr.write(`cwos-token-budget: ack event validation: ${(r.errors || []).join('; ')}\n`);
      return null;
    }
    return (r && r.ok && r.event) ? r.event.id : null;
  } catch (e) {
    process.stderr.write(`cwos-token-budget: ack event emission failed (non-fatal): ${e.message}\n`);
    return null;
  }
}

function emitBlockedEvent(detection, tag, clock) {
  if (!appendEvent || !ensureCommandId) return null;
  try {
    const commandId = ensureCommandId('token-budget-block');
    const payload = {
      type: 'budget_regression_blocked',
      tag,
      tokens_t0: detection.window_tokens[0],
      tokens_t1: detection.window_tokens[1],
      tokens_t2: detection.window_tokens[2],
      pct_increase: detection.pct_increase,
      threshold_pct: detection.threshold_pct,
      command_ids: detection.window_command_ids,
      reason: detection.reason,
      composed_by: 'cli-deterministic',
      detected_at: clock || new Date().toISOString(),
    };
    const r = appendEvent({
      source_track: 'T0:envelope',
      source_tier: 'reducer-output',
      track_tag: 'budget_regression_blocked',
      command_id: commandId,
      payload,
    });
    return (r && r.ok && r.event) ? r.event.id : null;
  } catch (e) {
    process.stderr.write(`cwos-token-budget: event emission failed (non-fatal): ${e.message}\n`);
    return null;
  }
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  if (!sub || sub === '--help' || sub === '-h') {
    process.stdout.write('usage: cwos-token-budget --check [--tag <tag>] [--clock <iso>] [--no-emit] [--events-dir <p>] [--override-engine-token-budget <rationale>]\n');
    process.exit(sub ? 0 : 1);
  }
  try {
    if (sub === '--check') return runCheck(args.slice(1));
    process.stderr.write(`cwos-token-budget: unknown invocation: ${sub}\n`);
    process.exit(2);
  } catch (err) {
    // AS-23 final safety net.
    process.stderr.write(`cwos-token-budget: ${err.message}\n${err.stack || ''}\n`);
    process.exit(0);
  }
}

if (require.main === module) main();

module.exports = {
  detectRegression, loadConfigThreshold, loadEnvelopeSamples,
  loadFromStateStore, loadFromEventLog, loadFromEngineCompleted,
  DEFAULT_THRESHOLD_PCT, DEFAULT_ENGINE_THRESHOLD_PCT,
  DEFAULT_WINDOW_SIZE, DEFAULT_TAG,
  ENGINE_TAG_PREFIX, ENGINE_TAG_RE, MIN_OVERRIDE_RATIONALE_LEN,
};
