#!/usr/bin/env node
/**
 * cwos-stop-telemetry — Stop-hook script that back-fills tool_rounds_actual
 * and tokens_derived onto recent command_completed events.
 *
 * WS-260, ADR-037 Phase 1. Founder approved (SPR-099) the following design:
 *   - Hook scope: dedicated Stop-hook script (not extend cwos-heartbeat).
 *   - Token method: character heuristic with calibrated TOKENS_PER_CHAR=0.25.
 *   - Failure mode: silent exit 0 on every error (strict AS-42 non-fatal).
 *
 * Mechanism:
 *   1. Read Stop-hook stdin payload from Claude Code: { transcript_path, ... }.
 *   2. Read the transcript JSONL.
 *   3. Find the most recent <command-name> user message → boundary for the
 *      most-recent command's scope.
 *   4. Count assistant messages with tool_use content blocks within scope.
 *   5. Sum text-block character lengths within scope; derive tokens via the
 *      calibrated constant.
 *   6. Look up the most recent command_completed event in the event log.
 *      If it's within 60s AND has no matching command_telemetry_stamped event
 *      already, append a new command_telemetry_stamped event with
 *      causation_id = original event's id.
 *
 * Why a corrective event rather than mutating the original: events.log is
 * append-only per ADR-018 step 1. The envelope reducer (WS-260 patch) merges
 * command_telemetry_stamped onto the materialized envelope view.
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');

const { findWorkstreamDir } = require('./lib/cwos-utils');

// Token-counting constant. Founder-approved character heuristic per WS-260
// design Q&A. ≈ 4 chars/token for GPT-style English text. Re-tunable later
// without re-reading transcripts because chars_total is also stamped.
const TOKENS_PER_CHAR = 0.25;

// Telemetry only stamps onto a command_completed event if it landed within
// this window. Outside the window we assume the original command's session
// has rolled or the AI is no longer the producer. 60s is generous given Stop
// hooks fire within 1-2s of command end.
const STAMP_WINDOW_MS = 60_000;

// Hard cap on transcript lines we'll scan. Cheap protection against
// pathological transcripts blowing through the 5s hook timeout. The current
// /next session is ~300 lines after a long sprint; 10K is a 30x headroom.
const MAX_TRANSCRIPT_LINES = 10_000;

const VERBOSE = process.env.CWOS_DEBUG_HOOKS === '1';

function debug(msg) {
  if (VERBOSE) process.stderr.write(`cwos-stop-telemetry: ${msg}\n`);
}

// ─── Stdin reader ─────────────────────────────────────────────────────────

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    if (!raw || raw.trim() === '') return {};
    return JSON.parse(raw);
  } catch (err) {
    debug(`stdin parse failed: ${err.message}`);
    return {};
  }
}

// ─── Transcript parser ────────────────────────────────────────────────────

/**
 * Walk transcript lines bottom-up to find the most recent user message
 * containing a <command-name> tag. Return the line index (0-based) of that
 * message, or null if not found.
 */
function findCommandBoundary(lines) {
  const start = Math.max(0, lines.length - MAX_TRANSCRIPT_LINES);
  for (let i = lines.length - 1; i >= start; i--) {
    const line = lines[i];
    if (!line) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev.type !== 'user') continue;
    const msg = ev.message || {};
    let text = '';
    const c = msg.content;
    if (typeof c === 'string') text = c;
    else if (Array.isArray(c)) {
      for (const block of c) {
        if (block && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
          text += block.text;
        }
      }
    }
    if (text && text.includes('<command-name>')) return i;
  }
  return null;
}

/**
 * Extract the command tag and start timestamp from the boundary line.
 * Returns { tag: '/next', ts: epochMs } or null when either is unrecoverable.
 * (Sensor-repair 2026-07-25: needed by the envelope backfill below.)
 */
function extractCommandInfo(lines, boundaryIdx) {
  const line = lines[boundaryIdx];
  if (!line) return null;
  let ev;
  try { ev = JSON.parse(line); } catch { return null; }
  const msg = ev.message || {};
  let text = '';
  const c = msg.content;
  if (typeof c === 'string') text = c;
  else if (Array.isArray(c)) {
    for (const block of c) {
      if (block && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
        text += block.text;
      }
    }
  }
  const m = text.match(/<command-name>\s*\/?([\w-]+)\s*<\/command-name>/);
  if (!m) return null;
  const ts = ev.timestamp ? Date.parse(ev.timestamp) : NaN;
  if (!Number.isFinite(ts)) return null;
  return { tag: `/${m[1]}`, ts };
}

/**
 * True when `/name` is a CWOS command installed in this repo — the gate that
 * keeps backfill from emitting envelopes for non-CWOS slash commands.
 */
function isCwosCommand(tag, workstreamDir) {
  if (!tag || !tag.startsWith('/')) return false;
  const commandsDir = path.join(workstreamDir, '..', 'commands');
  return fs.existsSync(path.join(commandsDir, `${tag.slice(1)}.md`));
}

/**
 * Index of the line that ENDS the command started at boundaryIdx — the next
 * genuine user turn — or lines.length when the command ran to the end of the
 * session.
 *
 * WS-560. Without this bound, scanFromBoundary ran to the end of the
 * transcript, so every tool call made after the session's last slash command
 * was billed to that command. INV-cli-envelope-consumed-completely reads
 * tool_rounds_by_type.Read from these envelopes and enforces a per-invocation
 * ceiling of 5, and it was reporting Read=25 against a /next whose actual
 * envelope-consumption was fine: the session simply kept working afterwards.
 * All four of its standing "violations" were this artifact. The rule it
 * enforces (ADR-037 Prohibited Reads) is real; the sensor was measuring the
 * session tail instead of the command.
 *
 * A genuine user turn is a `user` event whose content carries text — the
 * transcript's tool_result turns are also role `user`, and those are part of
 * the command's own execution, not the end of it.
 */
function findCommandEnd(lines, boundaryIdx) {
  for (let i = boundaryIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev.type !== 'user') continue;
    const c = ev.message && ev.message.content;
    if (typeof c === 'string') {
      if (c.trim() !== '') return i;
      continue;
    }
    if (!Array.isArray(c)) continue;
    const hasText = c.some(b => b && typeof b === 'object' && b.type === 'text' &&
                               typeof b.text === 'string' && b.text.trim() !== '');
    if (hasText) return i;
  }
  return lines.length;
}

/**
 * Given the transcript line array and the boundary index, count tool rounds
 * and total characters for the command that starts there — bounded at the next
 * genuine user turn (see findCommandEnd).
 *
 * A "tool round" is one assistant message with at least one tool_use content
 * block. text+tool_use blocks all contribute their text to chars_total.
 */
function scanFromBoundary(lines, boundaryIdx) {
  let toolRounds = 0;
  let chars = 0;
  let scanned = 0;
  // WS-271: per-tool-type aggregation. Counts each individual tool_use
  // block (not rounds — a single round can have multiple tools, though
  // rare). Used by INV-cli-envelope-consumed-completely to count Read
  // tool calls per /next invocation against the per_invocation_max
  // threshold.
  const roundsByType = {};
  const endIdx = findCommandEnd(lines, boundaryIdx);
  for (let i = boundaryIdx; i < endIdx; i++) {
    const line = lines[i];
    if (!line) continue;
    scanned++;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    const msg = ev.message;
    if (!msg) continue;
    const c = msg.content;

    // Character accounting: text-string content
    if (typeof c === 'string') {
      chars += c.length;
      continue;
    }
    if (!Array.isArray(c)) continue;

    let hasToolUse = false;
    for (const block of c) {
      if (!block || typeof block !== 'object') continue;
      const t = block.type;
      if (t === 'text' && typeof block.text === 'string') chars += block.text.length;
      else if (t === 'tool_use') {
        hasToolUse = true;
        // WS-271: aggregate per-tool-type count.
        const toolName = block.name;
        if (toolName && typeof toolName === 'string') {
          roundsByType[toolName] = (roundsByType[toolName] || 0) + 1;
        }
        // Tool input is part of the round's token spend; serialize it.
        if (block.input) {
          try { chars += JSON.stringify(block.input).length; } catch { /* ignore */ }
        }
      } else if (t === 'tool_result') {
        // Tool results from the user role come back; count their content too.
        const tc = block.content;
        if (typeof tc === 'string') chars += tc.length;
        else if (Array.isArray(tc)) {
          for (const inner of tc) {
            if (inner && typeof inner === 'object' && inner.type === 'text' && typeof inner.text === 'string') {
              chars += inner.text.length;
            }
          }
        }
      } else if (t === 'thinking' && typeof block.thinking === 'string') {
        chars += block.thinking.length;
      }
    }
    if (ev.type === 'assistant' && hasToolUse) toolRounds++;
  }
  return { toolRounds, chars, scanned, roundsByType };
}

// ─── Event-log reader ─────────────────────────────────────────────────────

function eventChunkPath(workstreamDir, date) {
  const d = date || new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return path.join(workstreamDir, 'events', `${yyyy}-${mm}-${dd}.jsonl`);
}

/**
 * Find the most recent command_completed event that needs telemetry stamping.
 * Returns the parsed event or null. Excludes events that already have a
 * matching command_telemetry_stamped event (idempotency).
 */
function findMostRecentUnstamped(workstreamDir) {
  const today = eventChunkPath(workstreamDir);
  const yest = eventChunkPath(workstreamDir, new Date(Date.now() - 86_400_000));
  const stampedCausationIds = new Set();
  const candidates = [];

  for (const chunkPath of [yest, today]) {
    if (!fs.existsSync(chunkPath)) continue;
    const raw = fs.readFileSync(chunkPath, 'utf8');
    for (const line of raw.split('\n')) {
      if (!line) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      if (ev.source_track !== 'T0:envelope') continue;
      const ptype = ev.payload && ev.payload.type;
      if (ptype === 'command_completed') candidates.push(ev);
      else if (ptype === 'command_telemetry_stamped' && ev.causation_id) {
        stampedCausationIds.add(ev.causation_id);
      }
    }
  }

  // Most recent unstamped, within stamp window
  const now = Date.now();
  for (let i = candidates.length - 1; i >= 0; i--) {
    const ev = candidates[i];
    if (stampedCausationIds.has(ev.id)) continue;
    const ts = Date.parse(ev.timestamp);
    if (!Number.isFinite(ts)) continue;
    if (now - ts > STAMP_WINDOW_MS) return null;   // most recent is outside window → no work
    return ev;
  }
  return null;
}

/**
 * True when any command_completed event exists with timestamp >= sinceMs
 * (today + yesterday chunks). Used to decide whether the envelope for the
 * current command boundary is missing and needs backfill.
 */
function hasCompletedSince(workstreamDir, sinceMs) {
  const today = eventChunkPath(workstreamDir);
  const yest = eventChunkPath(workstreamDir, new Date(Date.now() - 86_400_000));
  for (const chunkPath of [yest, today]) {
    if (!fs.existsSync(chunkPath)) continue;
    const raw = fs.readFileSync(chunkPath, 'utf8');
    for (const line of raw.split('\n')) {
      if (!line) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      if (ev.source_track !== 'T0:envelope') continue;
      if (!(ev.payload && ev.payload.type === 'command_completed')) continue;
      const ts = Date.parse(ev.timestamp);
      if (Number.isFinite(ts) && ts >= sinceMs) return true;
    }
  }
  return false;
}

/**
 * Emit the command_completed envelope the AI failed to emit (FIND-273 /
 * WS-414 lesson generalized, sensor-repair 2026-07-25: prose-driven emission
 * fails silently, so the Stop hook — a deterministic script — owns it).
 * Returns true on success.
 */
function emitBackfillCompleted(cmd) {
  const { spawnSync } = require('child_process');
  const eventScript = path.join(__dirname, 'cwos-event.js');
  const commandId = `cmd-stopbackfill-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const payload = JSON.stringify({
    type: 'command_completed',
    command: cmd.tag,
    emitted_by: 'stop-hook-backfill',
  });
  const env = Object.assign({}, process.env, { CWOS_COMMAND_ID: commandId });
  const result = spawnSync('node', [
    eventScript, 'append', 'command_completed',
    '--track', 'T0:envelope',
    '--tag', cmd.tag,
    '--payload', payload,
  ], { stdio: VERBOSE ? 'inherit' : 'pipe', env });
  if (result.status !== 0) {
    debug(`backfill append failed (status=${result.status})`);
    return false;
  }
  debug(`backfilled command_completed for ${cmd.tag}`);
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────

function main() {
  let workstreamDir;
  try { workstreamDir = findWorkstreamDir(); }
  catch (err) {
    debug(`findWorkstreamDir failed: ${err.message}`);
    return;
  }

  const stdin = readStdinJson();
  const transcriptPath = stdin.transcript_path;
  if (!transcriptPath) { debug('no transcript_path on stdin'); return; }
  if (!fs.existsSync(transcriptPath)) { debug(`transcript not found: ${transcriptPath}`); return; }

  // Parse transcript first — the backfill decision needs the command boundary
  // before we know whether an envelope exists. (Pre-2026-07-25 this parsed
  // lazily after the event-log check; backfill inverts the order.)
  let transcriptRaw;
  try { transcriptRaw = fs.readFileSync(transcriptPath, 'utf8'); }
  catch (err) { debug(`transcript read failed: ${err.message}`); return; }

  const lines = transcriptRaw.split('\n');
  const boundary = findCommandBoundary(lines);
  if (boundary === null) { debug('no command boundary found in transcript'); return; }

  // Envelope backfill (sensor-repair 2026-07-25): if the transcript shows a
  // CWOS command ran but no command_completed event landed since its start,
  // emit it here. Deterministic script emission replaces the prose step at
  // the bottom of each command file, which the AI skipped often enough to
  // decay envelope telemetry to ~2 events/month.
  // 24h freshness guard: hasCompletedSince only scans today+yesterday chunks,
  // so an older boundary (long-lived resumed session) could false-negative and
  // double-emit. Skip backfill for boundaries older than the scan horizon.
  const cmd = extractCommandInfo(lines, boundary);
  const fresh = cmd && (Date.now() - cmd.ts) < 86_400_000;
  if (cmd && fresh && isCwosCommand(cmd.tag, workstreamDir) && !hasCompletedSince(workstreamDir, cmd.ts)) {
    emitBackfillCompleted(cmd);
  }

  // Find the unstamped command_completed event (includes one just backfilled).
  const targetEvent = findMostRecentUnstamped(workstreamDir);
  if (!targetEvent) { debug('no recent unstamped command_completed'); return; }

  const { toolRounds, chars, scanned, roundsByType } = scanFromBoundary(lines, boundary);
  const tokensDerived = Math.round(chars * TOKENS_PER_CHAR);

  // Append the corrective event. Use cwos-event.js spawn rather than
  // require()-ing core/events directly to keep the hook path narrow and
  // avoid cross-process state-store side effects.
  const { spawnSync } = require('child_process');
  const eventScript = path.join(__dirname, 'cwos-event.js');
  const payload = JSON.stringify({
    type: 'command_telemetry_stamped',
    tool_rounds_actual: toolRounds,
    tool_rounds_by_type: roundsByType,
    chars_total: chars,
    tokens_derived: tokensDerived,
    tokens_per_char: TOKENS_PER_CHAR,
    transcript_lines_scanned: scanned,
  });
  // CWOS_COMMAND_ID overrides ensureCommandId so the appended event keys
  // onto the target command's envelope record (the reducer joins via
  // command_id, not causation_id).
  const env = Object.assign({}, process.env, { CWOS_COMMAND_ID: targetEvent.command_id });
  const result = spawnSync('node', [
    eventScript, 'append', 'command_telemetry_stamped',
    '--track', 'T0:envelope',
    '--tag', 'command_telemetry_stamped',
    '--causation', targetEvent.id,
    '--payload', payload,
  ], { stdio: VERBOSE ? 'inherit' : 'pipe', env });

  if (result.status !== 0) {
    debug(`cwos-event append failed (status=${result.status}): ${result.stderr ? result.stderr.toString() : ''}`);
    return;
  }
  debug(`stamped: rounds=${toolRounds} chars=${chars} tokens=${tokensDerived} causation=${targetEvent.id}`);
}

// Test surface (WS-271): expose pure helpers for unit testing without
// running main(). When require()'d as a module (CWOS_STOP_TELEMETRY_NORUN=1
// or require.main !== module), main() is skipped and the helpers below
// are accessible.
if (require.main === module && process.env.CWOS_STOP_TELEMETRY_NORUN !== '1') {
  try { main(); } catch (err) { debug(`uncaught: ${err.message}`); }
  process.exit(0);
}

module.exports = {
  scanFromBoundary,
  findCommandBoundary,
  findMostRecentUnstamped,
  extractCommandInfo,
  isCwosCommand,
  hasCompletedSince,
  emitBackfillCompleted,
};
