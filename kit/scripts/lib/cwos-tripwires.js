/**
 * cwos-tripwires.js — WS-322 Phase B: deferred-scope trigger evaluator.
 *
 * When the repo's state changes (archetype migration, stage transition,
 * program tier change), this module scans all blocked WS items with
 * re_eval_trigger fields and flips matching items from `status: blocked`
 * to `status: backlog`. The newly-unblocked items surface in /pulse +
 * /status (Phase C) for founder re-evaluation.
 *
 * Trigger kinds (initial set per WS-322 design decision):
 *   - archetype_migration  — fires when onboarding.archetype === trigger.target
 *   - milestone_reached    — fires when current_milestone >= trigger.target
 *   - program_tier_change  — fires when target program's tier matches/exceeds
 *   - fleet_event          — deferred to Phase D (stub returns false)
 *
 * Re-eval policy: an unblocked item gets a note appended to blocked_by_note
 * recording the firing event ("trigger fired YYYY-MM-DD: archetype_migration
 * -> A3"). status flips to backlog. Founder is expected to triage via /pulse.
 *
 * Exposed:
 *   evaluateDeferredTriggers(wsDir, repoRoot, opts) -> {
 *     unblocked: [{ ws_id, title, trigger, fired_because }],
 *     still_blocked: [{ ws_id, title, trigger }],
 *     errors: [],
 *   }
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { readYAMLFile, writeFileAtomic } = require('./cwos-utils');

// Milestone ordering — used by milestone_reached comparison.
// M0 < M1 < M2 < M3 < M4 < M5
const MILESTONE_ORDER = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5'];

// Tier ordering — for program_tier_change comparison.
// dormant < watch < active < critical
const TIER_ORDER = ['dormant', 'watch', 'active', 'critical'];

function readOnboarding(repoRoot) {
  const p = path.join(repoRoot, '.cwos-onboarding.yaml');
  if (!fs.existsSync(p)) return { archetype: null, stage: null, current_milestone: null, _raw: '' };
  const r = readYAMLFile(p);
  if (!r.ok) return { archetype: null, stage: null, current_milestone: null, _raw: '' };
  return {
    archetype: (r.data.archetype || '').toString().split('#')[0].trim() || null,
    stage: (r.data.stage || '').toString().split('#')[0].trim() || null,
    current_milestone: (r.data.current_milestone || '').toString().split('#')[0].trim() || null,
    _raw: r.data,
  };
}

function readPrograms(wsDir) {
  const programsDir = path.join(wsDir, 'programs');
  if (!fs.existsSync(programsDir)) return [];
  const out = [];
  for (const f of fs.readdirSync(programsDir)) {
    if (!/^prog-.+\.yaml$/.test(f)) continue;
    const r = readYAMLFile(path.join(programsDir, f));
    if (!r.ok) continue;
    out.push({
      id: r.data.id || f.replace(/\.yaml$/, ''),
      tier: (r.data.tier || '').toString().split('#')[0].trim() || 'dormant',
    });
  }
  return out;
}

// Compare two milestones (M0..M5). Returns -1 / 0 / 1.
function compareMilestones(a, b) {
  const ai = MILESTONE_ORDER.indexOf(a);
  const bi = MILESTONE_ORDER.indexOf(b);
  if (ai === -1 || bi === -1) return null; // unknown
  if (ai < bi) return -1;
  if (ai > bi) return 1;
  return 0;
}

function compareTiers(a, b) {
  const ai = TIER_ORDER.indexOf(a);
  const bi = TIER_ORDER.indexOf(b);
  if (ai === -1 || bi === -1) return null;
  if (ai < bi) return -1;
  if (ai > bi) return 1;
  return 0;
}

// Decide whether a trigger has fired given current repo state.
// Returns { fired: bool, reason: string }.
function evaluateTrigger(trigger, state) {
  if (!trigger || !trigger.type) return { fired: false, reason: 'no trigger' };
  switch (trigger.type) {
    case 'archetype_migration': {
      if (!state.archetype) return { fired: false, reason: 'no current archetype' };
      const fired = state.archetype === trigger.target;
      return {
        fired,
        reason: fired
          ? `archetype is now ${state.archetype} (matches target ${trigger.target})`
          : `archetype is ${state.archetype}, target is ${trigger.target}`,
      };
    }
    case 'milestone_reached': {
      if (!state.current_milestone) return { fired: false, reason: 'no current milestone' };
      const cmp = compareMilestones(state.current_milestone, trigger.target);
      if (cmp === null) return { fired: false, reason: 'unknown milestone value' };
      const fired = cmp >= 0;
      return {
        fired,
        reason: fired
          ? `milestone is now ${state.current_milestone} (>= target ${trigger.target})`
          : `milestone is ${state.current_milestone}, target is ${trigger.target}`,
      };
    }
    case 'program_tier_change': {
      // trigger.target is the program id (e.g., "prog-launch") OR
      // "<prog>:<min-tier>" (e.g., "prog-launch:active") to require a tier floor.
      const [progId, minTier] = String(trigger.target || '').split(':');
      const prog = state.programs.find(p => p.id === progId);
      if (!prog) return { fired: false, reason: `program ${progId} not installed` };
      if (!minTier) {
        // Any tier change qualifies — but we don't have history, so we treat
        // "tier != dormant" as fired. Crude but workable for v1.
        const fired = prog.tier !== 'dormant';
        return {
          fired,
          reason: fired ? `${progId} tier is ${prog.tier} (non-dormant)` : `${progId} still dormant`,
        };
      }
      const cmp = compareTiers(prog.tier, minTier);
      if (cmp === null) return { fired: false, reason: 'unknown tier value' };
      const fired = cmp >= 0;
      return {
        fired,
        reason: fired
          ? `${progId} tier is ${prog.tier} (>= target ${minTier})`
          : `${progId} tier is ${prog.tier}, target is ${minTier}`,
      };
    }
    case 'fleet_event': {
      // Deferred to a future phase — fleet events require additional plumbing
      // (event log inspection, fleet-wide state aggregation). v1 always
      // returns false so these tripwires stay blocked until manual triage.
      return { fired: false, reason: 'fleet_event triggers not implemented in v1 (manual triage required)' };
    }
    default:
      return { fired: false, reason: `unknown trigger type: ${trigger.type}` };
  }
}

// Patch a WS-NNN.yaml file in place: flip status to backlog, append a
// firing-event note to blocked_by_note. The note is properly quoted so
// the CWOS YAML parser reads it as a single string scalar.
function unblockItem(wsFilePath, firedReason) {
  let content;
  try { content = fs.readFileSync(wsFilePath, 'utf8'); }
  catch (e) { return { ok: false, error: e.message }; }

  // Flip status: blocked -> backlog
  const beforeStatus = content;
  content = content.replace(/^status:\s*blocked\s*(?:#.*)?$/m, 'status: backlog');
  if (content === beforeStatus) {
    return { ok: false, error: 'status: blocked line not found' };
  }

  // Append firing-event note to blocked_by_note. Capture the quoted-string
  // content of the existing note so we can rebuild a single quoted line that
  // preserves both the unblock prefix and the original.
  const today = new Date().toISOString().slice(0, 10);
  const eventNote = `Trigger fired ${today}: ${firedReason}`;
  const noteRe = /^blocked_by_note:\s*"((?:[^"\\]|\\.)*)"\s*$/m;
  const m = content.match(noteRe);
  if (m) {
    const originalUnescaped = m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const fullText = `[unblocked] ${eventNote}. Original: ${originalUnescaped}`;
    const escaped = fullText.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    content = content.replace(noteRe, `blocked_by_note: "${escaped}"`);
  } else {
    // No existing note — add one. Properly quoted single-line.
    const fullText = `[unblocked] ${eventNote}`;
    const escaped = fullText.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    content = content + `\n# Tripwire unblock note (WS-322 Phase B):\nblocked_by_note: "${escaped}"\n`;
  }

  try {
    writeFileAtomic(wsFilePath, content);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Scan all WS-NNN.yaml files in queue/, evaluate each blocked item with a
 * re_eval_trigger against current repo state, and unblock any that match.
 *
 * @param {string} wsDir — .claude/workstream/
 * @param {string} repoRoot — repo root containing .cwos-onboarding.yaml
 * @param {Object} opts — { dryRun: boolean }
 * @returns {Object} { unblocked, still_blocked, errors }
 */
function evaluateDeferredTriggers(wsDir, repoRoot, opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const queueDir = path.join(wsDir, 'queue');
  if (!fs.existsSync(queueDir)) {
    return { unblocked: [], still_blocked: [], errors: [] };
  }

  const state = {
    ...readOnboarding(repoRoot),
    programs: readPrograms(wsDir),
  };

  const unblocked = [];
  const still_blocked = [];
  const errors = [];

  for (const f of fs.readdirSync(queueDir)) {
    if (!/^WS-.+\.yaml$/.test(f)) continue;
    const filePath = path.join(queueDir, f);
    const r = readYAMLFile(filePath);
    if (!r.ok) { errors.push(`${f}: parse failed`); continue; }
    const item = r.data || {};
    if (item.status !== 'blocked') continue;
    if (!item.re_eval_trigger) continue;

    const ev = evaluateTrigger(item.re_eval_trigger, state);
    const summary = {
      ws_id: item.id,
      title: item.title,
      trigger: item.re_eval_trigger,
      fired_because: ev.reason,
    };

    if (ev.fired) {
      if (!dryRun) {
        const u = unblockItem(filePath, ev.reason);
        if (!u.ok) {
          errors.push(`${item.id}: unblock write failed — ${u.error}`);
          still_blocked.push(summary);
          continue;
        }
      }
      unblocked.push(summary);
    } else {
      still_blocked.push(summary);
    }
  }

  return { unblocked, still_blocked, errors };
}

module.exports = {
  evaluateDeferredTriggers,
  evaluateTrigger,
  // exported for testing
  compareMilestones,
  compareTiers,
};
