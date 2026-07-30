#!/usr/bin/env node
/**
 * readiness-gate.cjs — SessionStart hook for the Model Readiness Gate.
 *
 * The founder asked for "a big waving flag" at the moment the poker model becomes
 * accurate and stable enough to sit down and STUDY rather than keep building. This is
 * that flag. It runs every session and stays completely silent until the gate opens.
 *
 * WHY SILENT WHEN CLOSED. A banner shown every session is a banner nobody reads by
 * week three. The flag is worth something precisely because it has never fired. Do not
 * add a "progress: 2/6 criteria" line here — that is the change that kills it.
 *
 * WHY A HOOK RATHER THAN THE CWOS KIT. `kit/` is synced from HomeBase and a local edit
 * to `cwos-next.js` would be silently reverted by the next `/kit-upgrade`, taking the
 * flag with it and leaving no trace. Hooks are repo-local and survive.
 *
 * FAILS OPEN. A broken readiness script must never block the founder's session, so any
 * error exits 0 with no output. The cost of that choice is that a silently broken
 * checker looks identical to a closed gate — which is why WS-286 carries a periodic
 * manual `node scripts/readiness/model-readiness.mjs` as a backstop.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
const SCRIPT = path.join(REPO, 'scripts/readiness/model-readiness.mjs');

try {
  // Exit 0 = gate OPEN. Exit 1 = closed (expected). Exit 2 = evidence missing.
  const out = execFileSync(process.execPath, [SCRIPT, '--banner'], {
    cwd: REPO,
    encoding: 'utf8',
    timeout: 10000,
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  // Reaching here means exit 0 — the gate is OPEN.
  const banner = (out || '').trim();
  if (!banner) process.exit(0);

  const context = [
    banner,
    '',
    'THE MODEL READINESS GATE HAS OPENED. This is a milestone the founder set in',
    'advance (docs/domain/MODEL_READINESS_GATE.md) and asked to be interrupted for.',
    '',
    'Surface this to the founder IMMEDIATELY and BEFORE anything else in your first',
    'response this session — before answering whatever they asked, before any status',
    'summary. Say plainly that the model is now accurate and stable enough to study,',
    'and that WS-286 holds the next steps (the full report, the learnable theory',
    'rewrite, and the comprehension work they requested).',
    '',
    'HOLD sprint composition: do not compose or start a new sprint via /next until the',
    'founder has acknowledged the gate. If they ask for new work, tell them the gate is',
    'open and ask whether to proceed anyway — they may defer, and that is their call.',
  ].join('\n');

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context,
    },
  }));
  process.exit(0);
} catch (err) {
  // Exit 1 (gate closed) and exit 2 (evidence missing) both land here, as does any
  // genuine failure. All are silent by design — see FAILS OPEN above.
  process.exit(0);
}
