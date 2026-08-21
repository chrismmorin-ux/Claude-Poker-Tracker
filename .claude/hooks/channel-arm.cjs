#!/usr/bin/env node
/**
 * channel-arm.cjs — the seeded coin for the channel-composition experiment.
 *
 * FOUNDER RULING 2026-08-20, decision (a): "Channel composition is settled by a
 * seeded-coin experiment, not by argument." The seven rulings of 2026-08-20 stay pushed
 * in arm A and move behind a routing entry in arm B, randomized at session level, claim
 * survival deciding. This file is that coin.
 *
 * ─── WHY A HOOK CANNOT SIMPLY "WITHHOLD" THE RULES ──────────────────────────────
 *
 * The build list specified "arm A current channel, arm B rules relocated," randomized by
 * this hook. That is not directly implementable and the reason is structural:
 *
 *   The push channel is composed by the HARNESS, from files on disk, BEFORE any hook
 *   runs. `CLAUDE.md` and every `.claude/rules/*.md` arrive as project instructions in
 *   the system prompt. A hook can only ADD context. It can never withhold.
 *
 * And this repo routinely runs 4-6 concurrent sessions against one working tree, so
 * "relocate the files for arm B sessions only" would have one session's coin changing
 * another session's channel mid-flight.
 *
 * So the arms are produced the other way round, which is the same comparison:
 *   - the seven files in `.claude/rules/` are thinned to ROUTING STUBS (pushed to all)
 *   - the full text lives at `.claude/context/relocated-rules/`
 *   - **arm A**: this hook re-injects the full text -> equivalent to today's push channel
 *   - **arm B**: this hook injects nothing -> the stub's routing entry is all that is pushed
 *
 * Per-session, hook-controlled, concurrency-safe, and identical in what it contrasts.
 *
 * ─── MODE: SHIPS INERT ──────────────────────────────────────────────────────────
 *
 * `mode: "off"` assigns an arm and logs it and INJECTS NOTHING. That is the shipping
 * state. It is not a half-measure — it lets the randomizer, the log and the join key be
 * verified against real sessions while the content is still identical for everyone, so
 * the only thing the cutover changes is the one thing under test. `mode: "live"` turns
 * on injection, and it must not be flipped until the stubs exist, or arm A sessions
 * receive the seven rulings twice.
 *
 * ─── FAIL-OPEN IS TOWARD ARM A, AND IT IS RECORDED ──────────────────────────────
 *
 * Any error injects the full text and records the session as `A-failopen`. Losing
 * doctrine silently is the expensive failure, so the safe direction is "everything
 * present." But that direction is also a bias in the assignment, which is why it is
 * written to the log as its own value rather than folded into A. Analysis excludes or
 * treats those sessions separately; it is never left to be discovered later.
 *
 * The salt pins the randomization. Changing it re-randomizes every session and is a new
 * experiment, so it is recorded in every log line rather than living only here.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
// Env-overridable so the suite can exercise the LIVE path without writing production
// state. Rank 1 of the 2026-08-20 pressure-test fixed exactly this shape in
// `contextBarrier.test.js`, where the tests spawned the hook against the real config and
// silently mutated it. An untested `live` branch is the one that fires at cutover.
const CONFIG = process.env.CHANNEL_ARM_CONFIG
  || path.join(REPO_ROOT, '.claude', 'context', 'channel-experiment.json');
const FULL_DIR = process.env.CHANNEL_ARM_FULL_DIR
  || path.join(REPO_ROOT, '.claude', 'context', 'relocated-rules');
const LOG = process.env.CHANNEL_ARM_LOG
  || path.join(REPO_ROOT, '.claude', 'workstream', 'evidence', 'channel-arm-assignments.jsonl');

/**
 * The coin. SHA-256 over (salt + session id), low bit of the first byte.
 *
 * Deterministic in the session id, so the same session always resolves to the same arm
 * no matter how many turns it takes or how many times this runs — an assignment that
 * could flip mid-session would put both arms inside one transcript and destroy the unit
 * of analysis. `Math.random()` would do exactly that, and would also make the whole
 * experiment unreplicable while looking identical in the report.
 */
function assignArm(sessionId, salt) {
  const h = crypto.createHash('sha256').update(`${salt}:${sessionId}`).digest();
  return (h[0] & 1) === 0 ? 'A' : 'B';
}

/**
 * The session id, by two independent routes. `session_id` is what the harness sends;
 * the transcript filename is the same UUID, verified against the claim corpus where
 * session `d435e738-…` sits in transcript `d435e738-….jsonl`. Two routes because the
 * coin is worthless if the key is ever missing.
 */
function sessionIdFrom(payload) {
  if (payload && typeof payload.session_id === 'string' && payload.session_id) {
    return { id: payload.session_id, via: 'session_id' };
  }
  const tp = payload && payload.transcript_path;
  if (typeof tp === 'string' && tp) {
    const base = path.basename(tp).replace(/\.jsonl$/i, '');
    if (base) return { id: base, via: 'transcript_path' };
  }
  return { id: null, via: 'none' };
}

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { return null; }
}

/** The arm-A payload: the full text of every relocated ruling, in a stable order. */
function fullText(names) {
  const parts = [];
  for (const n of [...names].sort()) {
    const p = path.join(FULL_DIR, `${n}.md`);
    let t = '';
    try { t = fs.readFileSync(p, 'utf8'); } catch { continue; }
    parts.push(t.trim());
  }
  if (!parts.length) return '';
  return parts.join('\n\n---\n\n');
}

/** One line per session, written once. Appending every turn would make the log a turn counter. */
function recordOnce(entry) {
  try {
    if (fs.existsSync(LOG)) {
      const seen = fs.readFileSync(LOG, 'utf8');
      if (seen.includes(`"session":"${entry.session}"`)) return;
    } else {
      fs.mkdirSync(path.dirname(LOG), { recursive: true });
    }
    fs.appendFileSync(LOG, JSON.stringify(entry) + '\n', 'utf8');
  } catch { /* the log is evidence, never a gate on the founder's turn */ }
}

module.exports = { assignArm, sessionIdFrom, fullText, recordOnce };

if (require.main === module) {
  let injected = '';
  try {
    let stdin = '';
    try { stdin = fs.readFileSync(0, 'utf8'); } catch { /* no stdin */ }
    let payload = {};
    try { payload = JSON.parse(stdin || '{}'); } catch { payload = {}; }

    const cfg = readConfig();
    const { id, via } = sessionIdFrom(payload);

    if (!cfg || cfg.mode === 'disabled') {
      process.exit(0);                       // not running an experiment; emit nothing
    }

    let arm;
    if (!id) {
      // No join key means the session could never be scored. Fail toward everything present.
      arm = 'A-failopen';
    } else {
      arm = assignArm(id, cfg.salt);
    }

    if (id) {
      recordOnce({
        session: id,
        via,
        arm,
        salt: cfg.salt,
        experiment: cfg.experiment_id,
        mode: cfg.mode,
        at: new Date().toISOString(),
      });
    }

    if (cfg.mode === 'live' && (arm === 'A' || arm === 'A-failopen')) {
      injected = fullText(cfg.relocated || []);
    }
  } catch {
    // Even the outer failure injects, if it can, rather than silently thinning the channel.
    try {
      const cfg = readConfig();
      if (cfg && cfg.mode === 'live') injected = fullText(cfg.relocated || []);
    } catch { /* nothing more to try */ }
  }

  if (injected) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: injected },
    }));
  }
  process.exit(0);
}
