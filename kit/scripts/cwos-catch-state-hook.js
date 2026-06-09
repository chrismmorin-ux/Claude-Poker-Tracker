#!/usr/bin/env node
/**
 * cwos-catch-state-hook.js — UserPromptSubmit hook entry point (WS-299).
 *
 * Reads Claude Code hook input on stdin (JSON: {prompt, transcript_path, cwd, ...}),
 * builds conversationTurns from the transcript when available, runs the
 * cwos-catch-state classifier, emits engine_candidate_suggested or
 * engine_candidate_suppressed events, and outputs Claude Code hook spec
 * additionalContext when a suggestion clears the confidence gate.
 *
 * Per-turn latency budget: <500ms (rule-tier-only since LLM fallback is
 * stubbed in v1 — see WS-298 completion notes).
 *
 * Hook input shape (Claude Code UserPromptSubmit):
 *   { prompt: "<user text>", transcript_path: "<path or null>",
 *     cwd: "<repo>", session_id: "<id>", ... }
 *
 * Hook output shape (UserPromptSubmit additionalContext):
 *   { hookSpecificOutput: { hookEventName: "UserPromptSubmit",
 *                           additionalContext: "<routing-aware suggestion>" } }
 *   OR empty {} when no suggestion clears the gate.
 *
 * Replay-pure: read-only against transcript + event log; emits suggested/
 * suppressed events via core/events.
 *
 * Usage (typically invoked by Claude Code hook config):
 *   node cwos-catch-state-hook.js  < {hook-input-json}
 *   node cwos-catch-state-hook.js --debug < {hook-input-json}  # log to stderr
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { classify, PRE_FILL_WINDOW_TURNS } = require('./core/cwos-catch-state');
const { loadEventDeps, findRepoRoot } = require('./lib/cwos-utils');

const { appendEvent, ensureCommandId } = loadEventDeps();

const MAX_TRANSCRIPT_TURNS = 30;
const MAX_EVENT_LOOKBACK = 100;

function readStdinJson() {
  let data = '';
  try { data = fs.readFileSync(0, 'utf8'); } catch (_) { return null; }
  if (!data || !data.trim()) return null;
  try { return JSON.parse(data); } catch (_) { return null; }
}

/**
 * Parse a Claude Code transcript JSONL file into conversationTurns[].
 * Each line is a message; we extract role + text content. Falls back to
 * an empty array if the path is missing or the file is unreadable.
 */
function parseTranscript(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return [];
  let text;
  try { text = fs.readFileSync(transcriptPath, 'utf8'); }
  catch (_) { return []; }
  const lines = text.split('\n').filter(Boolean);
  const turns = [];
  for (const line of lines.slice(-MAX_TRANSCRIPT_TURNS * 2)) {
    let entry;
    try { entry = JSON.parse(line); } catch (_) { continue; }
    // Claude Code transcripts vary; common shapes:
    //   { type: "user"|"assistant", message: { content: [...] } }
    //   { role: "user"|"assistant", content: "..." }
    let role = entry.role || entry.type;
    if (role === 'user') role = 'founder';
    if (role !== 'founder' && role !== 'assistant') continue;
    let textContent = '';
    if (typeof entry.content === 'string') textContent = entry.content;
    else if (entry.message && typeof entry.message.content === 'string') textContent = entry.message.content;
    else if (entry.message && Array.isArray(entry.message.content)) {
      textContent = entry.message.content
        .map((c) => (typeof c === 'string' ? c : (c.text || '')))
        .join('\n');
    } else if (Array.isArray(entry.content)) {
      textContent = entry.content.map((c) => c.text || '').join('\n');
    }
    if (textContent) turns.push({ role, text: textContent, ts: entry.timestamp || null });
  }
  return turns;
}

function readRecentEvents(repoRoot) {
  const eventsDir = path.join(repoRoot, '.claude', 'workstream', 'events');
  if (!fs.existsSync(eventsDir)) return [];
  const files = fs.readdirSync(eventsDir).filter((f) => f.endsWith('.jsonl')).sort();
  const events = [];
  for (let i = files.length - 1; i >= 0 && events.length < MAX_EVENT_LOOKBACK; i--) {
    const text = fs.readFileSync(path.join(eventsDir, files[i]), 'utf8');
    const lines = text.split('\n').filter(Boolean);
    for (let j = lines.length - 1; j >= 0 && events.length < MAX_EVENT_LOOKBACK; j--) {
      try { events.unshift(JSON.parse(lines[j])); } catch (_) { /* skip */ }
    }
  }
  return events;
}

function getActiveEngineContext(events) {
  // Last engine_intent_recorded event (or engine_run_completed) within recent
  // window indicates an active engine context. v1 simple: most recent
  // engine_intent_recorded engine, if any.
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.payload && e.payload.type === 'engine_intent_recorded') {
      return e.payload.engine || null;
    }
  }
  return null;
}

function renderRoutingForm(suggestion) {
  const triggerSummary = suggestion.trigger_signals && suggestion.trigger_signals.length
    ? `(${suggestion.trigger_signals.join(',')})`
    : '';
  const tgt = suggestion.suggested_target ? ` on ${suggestion.suggested_target}` : '';
  const conf = (suggestion.confidence != null) ? ` conf=${suggestion.confidence.toFixed(2)}` : '';
  const modeNote = suggestion.mode === 'DISAMBIGUATING'
    ? ` — DISAMBIGUATING vs current engine ${suggestion.active_engine_context}`
    : '';
  return `Catch-state: consider \`/engine ${suggestion.suggested_engine}${tgt}\`${triggerSummary}${conf}${modeNote}. Founder may dismiss silently.`;
}

async function main() {
  const args = process.argv.slice(2);
  const debug = args.includes('--debug');

  const hookInput = readStdinJson() || {};
  const repoRoot = findRepoRoot(hookInput.cwd || process.cwd());
  const prompt = hookInput.prompt || '';
  const transcriptPath = hookInput.transcript_path || null;

  let conversationTurns = parseTranscript(transcriptPath);
  // Always append the current prompt as the latest founder turn (in case
  // the transcript hasn't been flushed by the time the hook runs).
  if (prompt && (conversationTurns.length === 0 || conversationTurns[conversationTurns.length - 1].text !== prompt)) {
    conversationTurns.push({ role: 'founder', text: prompt, ts: new Date().toISOString() });
  }

  const recentEvents = readRecentEvents(repoRoot);
  const activeEngineContext = getActiveEngineContext(recentEvents);

  let result;
  try {
    result = await classify({ conversationTurns, activeEngineContext, recentEvents });
  } catch (e) {
    if (debug) process.stderr.write(`catch-state-hook: classify failed: ${e.message}\n`);
    process.stdout.write(JSON.stringify({}) + '\n');
    process.exit(0);
  }

  if (debug) {
    process.stderr.write(`catch-state-hook: ruleHits=${JSON.stringify(result.ruleHits)} latencyMs=${result.latencyMs} fallbackUsed=${result.fallbackUsed}\n`);
  }

  // Emit event (suggested or suppressed) — non-fatal.
  if ((result.suggestion || result.suppressed) && appendEvent && ensureCommandId) {
    try {
      const commandId = ensureCommandId('catch-state-hook');
      const payload = result.suggestion || result.suppressed;
      const r = appendEvent({
        source_track: 'T7:engines',
        source_tier: 'founder-prompt',
        track_tag: '/userpromptsubmit',
        command_id: commandId,
        payload,
      });
      if (debug && r && !r.ok) process.stderr.write(`catch-state-hook: validation errors: ${(r.errors || []).join('; ')}\n`);
    } catch (e) {
      if (debug) process.stderr.write(`catch-state-hook: event emission failed: ${e.message}\n`);
    }
  }

  // Surface to Claude only when a suggestion cleared the gate.
  if (result.suggestion) {
    const additionalContext = renderRoutingForm(result.suggestion);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext,
      },
    }) + '\n');
  } else {
    process.stdout.write(JSON.stringify({}) + '\n');
  }
  process.exit(0);
}

if (require.main === module) main().catch((e) => {
  // Hooks must not crash the user prompt — always exit 0 with empty output.
  process.stderr.write(`catch-state-hook: unhandled: ${e.message}\n`);
  process.stdout.write(JSON.stringify({}) + '\n');
  process.exit(0);
});

module.exports = {
  parseTranscript,
  readRecentEvents,
  getActiveEngineContext,
  renderRoutingForm,
  PRE_FILL_WINDOW_TURNS,
};
