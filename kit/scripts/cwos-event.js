#!/usr/bin/env node
/**
 * cwos-event — thin CLI wrapper for appending a shadow event.
 *
 * ADR-018 step 1, WS-174 Phase B. Commands in `kit/commands/*.md` add
 * ONE call to this CLI at their final-summary step so the log records
 * a `command_completed` envelope. Per-mutation events fire from the
 * invoked scripts (Phase A), not from commands.
 *
 * Zero external dependencies. Safe to run in environments without a
 * workstream dir — failure is quiet + non-fatal (AS-42: guarded so
 * fleet repos without the runtime installed do not break).
 *
 * Usage:
 *   cwos-event append <type> --track <track> --tag <tag> [--payload <json>]
 *   cwos-event append command_completed --track T0:envelope --tag /status --payload '{"exit":0}'
 *   cwos-event head                      # print current chain head (empty if no log)
 *   cwos-event current-id                # print CWOS_COMMAND_ID (or generate + set)
 */

'use strict';

require('./lib/preflight');

const path = require('path');

let events, composition, renderEvents, telemetry;
try {
  events = require('./core/events');
  composition = require('./core/composition');
} catch (err) {
  // Guarded by AS-42: if the core modules are missing (e.g. fleet repo
  // without the step-1 runtime), exit 0 silently. Instrumented commands
  // invoking this CLI should NOT break the command.
  process.exit(0);
}
try { renderEvents = require('./core/render-events'); } catch { /* optional */ }
try { telemetry = require('./core/telemetry'); } catch { /* optional */ }

// Best-effort post-append regen of system/events.log.md. Guarded with
// CWOS_SKIP_RENDER=1 for CI / replay-corpus runs. Failure is silent —
// never blocks the host command (AS-23).
function maybeRegenView() {
  if (!renderEvents) return;
  if (process.env.CWOS_SKIP_RENDER === '1') return;
  try { renderEvents.renderEventsLog({}); } catch { /* silent */ }
}

function parseFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i === args.length - 1) return null;
  return args[i + 1];
}

function parsePayload(raw) {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
  } catch { /* fall through */ }
  return { raw: String(raw) };
}

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];

  try {
    if (!sub || sub === '--help' || sub === '-h') {
      process.stdout.write('usage: cwos-event <append|head|current-id> [options]\n');
      process.exit(sub ? 0 : 1);
    }

    if (sub === 'append') {
      const type = args[1] || 'command_completed';
      const track = parseFlag(args, 'track') || 'T0:envelope';
      const tag = parseFlag(args, 'tag') || type;
      const payloadRaw = parseFlag(args, 'payload');
      const causation = parseFlag(args, 'causation') || null;
      const sourceTier = parseFlag(args, 'tier') || 'founder-prompt';
      const payload = parsePayload(payloadRaw);
      payload.type = type;

      // WS-180: auto-populate transcript_mark for token attribution.
      // Silent no-op if telemetry module or transcript is unavailable.
      if (payload.transcript_mark == null && telemetry) {
        try {
          const mark = telemetry.currentTranscriptMark({ cwd: process.cwd() });
          if (Number.isInteger(mark)) payload.transcript_mark = mark;
        } catch { /* silent */ }
      }

      const commandId = composition.ensureCommandId(type);
      const result = events.appendEvent({
        source_track: track,
        source_tier: sourceTier,
        track_tag: tag,
        command_id: commandId,
        causation_id: causation,
        payload,
      });

      if (!result.ok) {
        // Warn-only per ADR-018 (validation in warn mode during step 1).
        process.stderr.write(`cwos-event: append validation failed: ${result.errors.join('; ')}\n`);
        process.exit(0); // non-blocking
      }
      process.stdout.write(`${result.event.id} ${result.event.content_hash.slice(0, 12)}\n`);
      maybeRegenView();
      return;
    }

    if (sub === 'head') {
      process.stdout.write(`${events.chainHead() || '(empty)'}\n`);
      return;
    }

    if (sub === 'current-id') {
      const id = composition.ensureCommandId();
      process.stdout.write(`${id}\n`);
      return;
    }

    process.stderr.write(`cwos-event: unknown subcommand: ${sub}\n`);
    process.exit(2);
  } catch (err) {
    // Final safety net — AS-42 + AS-23 (do not break commands under any
    // shadow-log failure). Log to stderr, exit 0.
    process.stderr.write(`cwos-event: ${err.message}\n`);
    process.exit(0);
  }
}

if (require.main === module) main();
