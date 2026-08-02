#!/usr/bin/env node
/**
 * session-heartbeat — Stop hook. Advance THIS session's `last_heartbeat`.
 *
 * ── WHY THIS EXISTS ALONGSIDE kit/scripts/cwos-heartbeat.js ───────────────────
 * `cwos-heartbeat.js` stamps `.hooks-liveness.yaml` correctly (under a lock, preserving
 * both fields per INV-036) and should keep doing that. But it resolves WHICH session to
 * heartbeat through the `.current-session` pointer, and `cwos-claims.resolveSessionId`
 * documents in its own header why the pointer is wrong here:
 *
 *     ".current-session holds exactly one id, so with two live sessions it names
 *      whichever registered last"
 *
 * Two concrete failures observed in this repo on 2026-08-01/02, with three concurrent
 * sessions running:
 *
 *   1. The pointer was DELETED mid-session by another session. `cwos-heartbeat` then
 *      reported "no .current-session file" and advanced nobody's heartbeat, while still
 *      stamping hook-liveness — so INV-026 would go GREEN while the liveness data it
 *      stands proxy for stayed dead. A false green is worse than a red.
 *   2. Even with the pointer present, it names one session. The other two never get a
 *      heartbeat, so `isSessionLive` reads them as dead, `listLiveSessions` returns [],
 *      and every concurrency check downstream gets a confident all-clear that is wrong.
 *
 * Measured at the time of writing: three session files with `status: active`,
 * `listLiveSessions()` → `[]`, `registryHealth()` → `{ok: true}`.
 *
 * ── WHAT THIS DOES INSTEAD ───────────────────────────────────────────────────
 * Resolves identity via `CLAUDE_CODE_SESSION_ID` — which the harness exports into every
 * subprocess, is per-session by construction, and is the ONLY source `cwos-claims` calls
 * correct under concurrency — then calls the kit's exported `touchSession`. No kit logic is
 * reimplemented here; the kit's own concurrency-correct resolver is simply the one used.
 *
 * `create: false` is deliberate: minting a session record from a Stop hook would invent
 * identities for headless one-shot runs. SessionStart's `cwos-session-register` owns
 * creation; this hook only advances what already exists.
 *
 * The kit-side fix (make `cwos-heartbeat.js` use `resolveSessionId`) is filed to HomeBase.
 * When it lands, this hook becomes redundant and should be deleted rather than left to rot.
 *
 * CONTRACT: never throws, never blocks, always exits 0. A heartbeat must not be able to
 * break a turn — the same rule `cwos-heartbeat.js` states for itself.
 */

'use strict';

const path = require('path');

function main() {
  const repo = path.resolve(__dirname, '..', '..');
  const wsDir = path.join(repo, '.claude', 'workstream');

  let claims;
  try {
    claims = require(path.join(repo, 'kit', 'scripts', 'lib', 'cwos-claims.js'));
  } catch {
    return; // kit not installed / mid-upgrade — nothing to do, and never a hard failure
  }

  if (typeof claims.resolveSessionId !== 'function' || typeof claims.touchSession !== 'function') {
    return; // older kit without the WS-533 API
  }

  const id = claims.resolveSessionId(wsDir, { create: false });
  if (!id) return; // no registered session for this process; SessionStart owns creation

  claims.touchSession(wsDir, id);

  if (process.argv.includes('--verbose')) {
    process.stdout.write(`session-heartbeat: touched ${id}\n`);
  }
}

try { main(); } catch { /* liveness is an optimisation, never a hard dependency */ }
process.exit(0);
