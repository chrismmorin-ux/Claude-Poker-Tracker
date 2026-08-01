#!/usr/bin/env node
/**
 * cwos-admin-escalation-audit.js — PreToolUse audit trail for admin escalation.
 *
 * On Windows, sshd skips UAC filtering, so `ssh chris@localhost '<cmd>'` returns
 * a full administrator token with no prompt. ADR-059 keeps that path — it removes
 * real founder friction, and removing it just pushes admin work back to UAC
 * clicks — but makes every use leave a record.
 *
 * This hook is AUDIT-ONLY by decision, not by oversight. ADR-059 §3 considered a
 * denylist of destructive admin commands and rejected it: denylists have gaps
 * that invite false confidence while blocking legitimate work. This never blocks
 * and always exits 0.
 *
 * Log: ~/.claude/admin-escalation.log (JSON lines).
 * Installed via ~/.claude/settings.json PreToolUse, matcher "Bash".
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const LOG_PATH = path.join(os.homedir(), '.claude', 'admin-escalation.log');

// SSH invocations that land on a shell with elevated rights. Two shapes:
//   - loopback to this machine: the no-UAC admin token path
//   - a fleet node over the tailnet: sessions there carry a full admin token
// Matched on the command string; deliberately broad, since this only records.
const ESCALATION_PATTERNS = [
  { kind: 'localhost-admin', re: /\bssh\s+(?:[\w.-]+@)?(?:localhost|127\.0\.0\.1|::1)\b/i },
  { kind: 'fleet-node',      re: /\bssh\s+(?:[\w.-]+@)?cm-node\d+\b/i },
  { kind: 'fleet-node',      re: /\bssh\s+(?:[\w.-]+@)?morincomputer\b/i },
];

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function classify(cmd) {
  for (const { kind, re } of ESCALATION_PATTERNS) {
    if (re.test(cmd)) return kind;
  }
  return null;
}

function record(entry) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // An audit trail must never break the session it is observing.
  }
}

function main() {
  const raw = readStdin();

  let input;
  try {
    // Strip a UTF-8 BOM — some shells prepend one when piping.
    input = JSON.parse(raw.replace(/^﻿/, '') || '{}');
  } catch {
    process.exit(0);
  }

  if ((input.tool_name || '') !== 'Bash') process.exit(0);

  const cmd = String((input.tool_input || {}).command || '');
  const kind = classify(cmd);
  if (!kind) process.exit(0);

  record({
    timestamp: new Date().toISOString(),
    node: os.hostname(),
    kind,
    session_id: input.session_id || null,
    cwd: input.cwd || process.cwd(),
    command: cmd,
  });

  process.exit(0);
}

// WS-544: guard the entry point so requiring this file for a dependency
// smoke check does not run it.
if (require.main === module) main();
