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
 * Given the transcript line array and the boundary index, count tool rounds
 * and total characters from boundary forward.
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
  for (let i = boundaryIdx; i < lines.length; i++) {
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

  // Find the unstamped command_completed event first — cheap exit if there
  // is none, avoids transcript parsing on most Stop hook fires.
  const targetEvent = findMostRecentUnstamped(workstreamDir);
  if (!targetEvent) { debug('no recent unstamped command_completed'); return; }

  // Parse transcript
  let transcriptRaw;
  try { transcriptRaw = fs.readFileSync(transcriptPath, 'utf8'); }
  catch (err) { debug(`transcript read failed: ${err.message}`); return; }

  const lines = transcriptRaw.split('\n');
  const boundary = findCommandBoundary(lines);
  if (boundary === null) { debug('no command boundary found in transcript'); return; }

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
};
