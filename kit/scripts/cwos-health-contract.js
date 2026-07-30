#!/usr/bin/env node
/**
 * cwos-health-contract — declare and check a repo's own health standard.
 *
 * ADR-060: the fleet measures a repo against the repo's OWN declared intent,
 * not against a global norm. Stage is declared rather than inferred, because
 * whether a repo is finished is a judgment about intent that no activity metric
 * can make. Utilization is declared per repo, because value per use varies by
 * orders of magnitude — one use in six months of one repo can be worth as much
 * as daily use of another, so no single threshold serves both.
 *
 * Subcommands:
 *   init      scaffold .cwos-health.yaml from the kit template
 *   validate  structural + semantic checks on the contract
 *   check     is the repo currently meeting its own declared standard?
 *   show      parsed contract as JSON, with defaults applied
 *
 * `check` reads git history for last activity. It deliberately does NOT try to
 * measure utilization: what counts as a use is prose declared by the repo, and
 * no script can evaluate "a physics session that consults the verification
 * tree". `check` reports elapsed silence against `concerning_after` and leaves
 * the judgment where it belongs.
 *
 * Exit 0 on success. 2 on usage/validation failure. `check` exits 0 even when
 * a contract is being missed — it is a report, not a gate.
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { readYAMLFile, findRepoRoot, todayISO } = require('./lib/cwos-utils');

const CONTRACT_FILENAME = '.cwos-health.yaml';
const TEMPLATE_REL = path.join('kit', 'templates', 'cwos-health.yaml');

const VALID_STAGES = ['building', 'steady', 'quiet'];
const VALID_BLOCKERS = ['money', 'dependency', 'hours', 'choice'];

// Fleet defaults, applied when a repo declares nothing. A repo without a
// contract is a supported state (ADR-060 graceful degradation) — it is read
// against these rather than penalised for the omission.
const DEFAULTS = {
  stage: 'building',
  engagement_window_days: 30,
};

function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function fail(msg, extra) {
  writeJson(Object.assign({ ok: false, error: msg }, extra || {}));
  process.exit(2);
}

function repoRoot() {
  return findRepoRoot(process.cwd()) || process.cwd();
}

function contractPath(root) {
  return path.join(root, CONTRACT_FILENAME);
}

/**
 * Parse a human duration into days. Accepts the shapes a founder actually
 * writes: "18 months", "2 years", "90 days", "6 weeks", "never".
 * Returns null when unparseable — callers must treat that as "unknown", never
 * as zero, or an unreadable value would silently read as "concerning now".
 */
function durationToDays(text) {
  if (text === null || text === undefined) return null;
  const s = String(text).trim().toLowerCase();
  if (!s) return null;
  if (s === 'never' || s === 'n/a' || s === 'none') return Infinity;
  const m = /^(\d+(?:\.\d+)?)\s*(day|week|month|quarter|year)s?$/.exec(s);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const per = { day: 1, week: 7, month: 30.44, quarter: 91.31, year: 365.25 };
  return Math.round(n * per[m[2]]);
}

function loadContract(root) {
  const p = contractPath(root);
  if (!fs.existsSync(p)) return { present: false, data: {}, path: p };
  const r = readYAMLFile(p);
  if (!r.ok) return { present: true, data: null, path: p, error: r.error };
  return { present: true, data: r.data || {}, path: p };
}

function withDefaults(data) {
  const d = data || {};
  const u = d.utilization || {};
  return {
    schema_version: d.schema_version ?? 1,
    stage: d.stage || DEFAULTS.stage,
    utilization: {
      what_counts: Array.isArray(u.what_counts) ? u.what_counts : [],
      expected_cadence: u.expected_cadence || '',
      concerning_after: u.concerning_after || '',
    },
    // Accepts the flat legacy shape (blocked_by_class) and the nested one.
    // Nested is canonical: the unlock fields only make sense grouped.
    blocked_by: (() => {
      const b = d.blocked_by && typeof d.blocked_by === 'object' ? d.blocked_by : {};
      return {
        class: b.class || d.blocked_by_class || null,
        unlocked_by: b.unlocked_by || '',
        estimated_cost: b.estimated_cost || '',
        unlock_ref: b.unlock_ref || '',
        note: b.note || d.blocked_by_note || '',
      };
    })(),
    engagement_window_days:
      typeof d.engagement_window_days === 'number' && d.engagement_window_days > 0
        ? d.engagement_window_days
        : DEFAULTS.engagement_window_days,
    continuation_prompt: d.continuation_prompt || '',
  };
}

// ─── validate ───────────────────────────────────────────────────────────────

function validateContract(c, opts = {}) {
  const errors = [];
  const warnings = [];

  if (!VALID_STAGES.includes(c.stage)) {
    errors.push(`stage must be one of ${VALID_STAGES.join(' | ')} — got "${c.stage}"`);
  }

  if (c.blocked_by.class !== null && !VALID_BLOCKERS.includes(c.blocked_by.class)) {
    errors.push(`blocked_by.class must be null or one of ${VALID_BLOCKERS.join(' | ')} — got "${c.blocked_by.class}"`);
  }

  // A blocker with no named unlock is a complaint, not a plan. It also cannot
  // participate in fleet-wide unlock accounting, which is the whole reason the
  // field is oriented around the unlock rather than the obstacle.
  if (c.blocked_by.class && !c.blocked_by.unlocked_by) {
    errors.push(
      `blocked_by.class is "${c.blocked_by.class}" but blocked_by.unlocked_by is empty. ` +
      'Name the specific thing that would unlock this — "money" is not actionable, ' +
      '"a clinician review panel" is. Repos that name the same unlock the same way can ' +
      'be grouped, which is how one purchase gets credited for everything it releases.'
    );
  }
  if (!c.blocked_by.class && c.blocked_by.unlocked_by) {
    warnings.push('blocked_by.unlocked_by is set but blocked_by.class is null — the unlock will not be grouped without a class.');
  }

  const concerningDays = durationToDays(c.utilization.concerning_after);

  if (c.stage === 'steady') {
    // A steady repo's health IS its utilization, so an unstated contract here
    // leaves the repo unmeasurable in the one dimension that matters for it.
    if (!c.utilization.what_counts.length) {
      errors.push(
        'stage is `steady` but utilization.what_counts is empty. A steady repo is ' +
        'scored on use, so it must say what a use IS — in its own terms.'
      );
    }
    if (!c.utilization.concerning_after) {
      errors.push(
        'stage is `steady` but utilization.concerning_after is empty. This is the ' +
        'field that makes the contract falsifiable: a standard you cannot MISS is ' +
        'not a standard. Answer "what would make this repo\'s silence concerning?" ' +
        '— or say `never` and mean it.'
      );
    } else if (concerningDays === null) {
      errors.push(
        `utilization.concerning_after: could not parse "${c.utilization.concerning_after}". ` +
        'Use a shape like "18 months", "90 days", "2 years", or "never".'
      );
    }
    if (!c.utilization.expected_cadence) {
      warnings.push('utilization.expected_cadence is empty — useful context for a future reader, though not load-bearing.');
    }
  }

  if (c.stage === 'quiet') {
    if (!c.blocked_by.class) {
      warnings.push(
        'stage is `quiet` with no blocked_by.class. Recording what would UNLOCK it ' +
        '(money / dependency / hours / choice, plus the specific unlock) turns ' +
        'dormancy from an absence into a priced decision — and lets the fleet credit ' +
        'one unlock with everything it releases.'
      );
    }
    if (!c.continuation_prompt) {
      warnings.push(
        'stage is `quiet` with no continuation_prompt. Re-entry is often one ' +
        'prompt when something points at where to resume; this is that pointer.'
      );
    }
  }

  if (concerningDays === Infinity && c.stage === 'steady') {
    warnings.push(
      'concerning_after is `never` — nothing about this repo\'s silence will ever ' +
      'be flagged. Legitimate for some repos; make sure it is a decision and not ' +
      'a way around picking a number.'
    );
  }

  // A contract that cannot fail launders a guess as a decision.
  if (concerningDays !== null && concerningDays !== Infinity && concerningDays > 365 * 3) {
    warnings.push(
      `concerning_after is ~${concerningDays} days (over 3 years). That is loose ` +
      'enough that it will effectively never fire — consider whether it reflects a ' +
      'real expectation.'
    );
  }

  if (opts.strict && warnings.length) errors.push(...warnings.map(w => `[strict] ${w}`));

  return { valid: errors.length === 0, errors, warnings, concerning_after_days: concerningDays };
}

// ─── git activity ───────────────────────────────────────────────────────────

function lastCommitInfo(root) {
  try {
    const r = spawnSync('git', ['log', '-1', '--format=%cI'], { cwd: root, encoding: 'utf8' });
    if (r.status !== 0 || !r.stdout.trim()) return null;
    const iso = r.stdout.trim();
    const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
    return { last_commit_at: iso.slice(0, 10), days_since_commit: days };
  } catch { return null; }
}

function commitsSince(root, days) {
  try {
    const r = spawnSync('git', ['log', `--since=${days} days ago`, '--oneline'],
      { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) return null;
    return r.stdout.trim() ? r.stdout.trim().split('\n').length : 0;
  } catch { return null; }
}

// ─── subcommands ────────────────────────────────────────────────────────────

function runInit(args) {
  const root = repoRoot();
  const dest = contractPath(root);
  const force = args.includes('--force');

  if (fs.existsSync(dest) && !force) {
    fail(`${CONTRACT_FILENAME} already exists — pass --force to overwrite`, { path: dest });
  }

  // Template ships with the kit; fall back to an inline minimal contract when
  // running in an adopted repo that has no kit/templates tree.
  const candidates = [
    path.join(root, TEMPLATE_REL),
    path.join(__dirname, '..', 'templates', 'cwos-health.yaml'),
  ];
  let body = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) { body = fs.readFileSync(c, 'utf8'); break; }
  }
  if (body === null) {
    body = [
      '# Health contract — see ADR-060. Absent = read against fleet defaults.',
      'schema_version: 1',
      'stage: building   # building | steady | quiet  (DECLARED, never inferred)',
      'utilization:',
      '  what_counts: []          # what a "use" is here, in this repo\'s own terms',
      '  expected_cadence: ""',
      '  concerning_after: ""     # what would make this repo\'s silence concerning?',
      'blocked_by_class: null     # money | dependency | hours | choice',
      'blocked_by_note: ""',
      'engagement_window_days: null',
      'continuation_prompt: ""',
      '',
    ].join('\n');
  }

  fs.writeFileSync(dest, body);
  writeJson({
    ok: true, created: dest, stage: 'building',
    next: 'Edit the file, then run: node kit/scripts/cwos-health-contract.js validate',
    note: 'stage defaults to `building`. Change it deliberately — `steady` is a claim that this repo does what it needs and wants maintenance, not growth.',
  });
}

function runValidate(args) {
  const root = repoRoot();
  const loaded = loadContract(root);

  if (!loaded.present) {
    writeJson({
      ok: true, present: false, path: loaded.path,
      note: 'No health contract. This repo is read against fleet defaults — a supported state, not a failure. Run `init` to declare one and earn a more accurate reading.',
      defaults: DEFAULTS,
    });
    return;
  }
  if (loaded.data === null) fail(`could not parse ${CONTRACT_FILENAME}`, { detail: loaded.error, path: loaded.path });

  const c = withDefaults(loaded.data);
  const v = validateContract(c, { strict: args.includes('--strict') });

  writeJson({
    ok: v.valid, path: loaded.path, stage: c.stage,
    errors: v.errors, warnings: v.warnings,
    concerning_after_days: v.concerning_after_days,
  });
  if (!v.valid) process.exit(2);
}

function runCheck() {
  const root = repoRoot();
  const loaded = loadContract(root);
  const c = withDefaults(loaded.present && loaded.data ? loaded.data : {});
  const git = lastCommitInfo(root);
  const window = c.engagement_window_days;
  const recent = commitsSince(root, window);
  const concerningDays = durationToDays(c.utilization.concerning_after);

  const out = {
    ok: true,
    repo: path.basename(root),
    contract_present: loaded.present,
    stage: c.stage,
    engagement_window_days: window,
    commits_in_window: recent,
    last_commit_at: git ? git.last_commit_at : null,
    days_since_commit: git ? git.days_since_commit : null,
  };

  // Engagement is measured. Utilization is NOT — what counts as a use is prose
  // this repo declared, and no script can evaluate it. Report the silence and
  // leave the judgment with the founder.
  if (c.stage === 'steady') {
    out.utilization_measurable = false;
    out.what_counts = c.utilization.what_counts;
    out.expected_cadence = c.utilization.expected_cadence;
    out.concerning_after = c.utilization.concerning_after || null;
    if (concerningDays === Infinity) {
      out.verdict = 'green';
      out.reason = 'contract declares silence is never concerning for this repo';
    } else if (concerningDays === null) {
      out.verdict = 'unknown';
      out.reason = 'concerning_after missing or unparseable — cannot tell whether this repo is meeting its own standard';
    } else if (git && git.days_since_commit > concerningDays) {
      out.verdict = 'check-in';
      out.reason =
        `no commit for ${git.days_since_commit} days against a declared concern threshold of ` +
        `${concerningDays}. Commits are not use, so this is a prompt to confirm the repo is ` +
        `still doing its job — not a verdict that it is not.`;
    } else {
      out.verdict = 'green';
      out.reason = 'within the repo\'s own declared threshold';
    }
  } else if (c.stage === 'quiet') {
    out.blocked_by = c.blocked_by.class ? c.blocked_by : null;
    out.continuation_prompt = c.continuation_prompt || null;
    out.verdict = c.continuation_prompt ? 'green' : 'check-resumability';
    out.reason = c.continuation_prompt
      ? 'quiet with a continuation pointer — effort banked, re-entry cheap'
      : 'quiet with no continuation pointer — resumability unverified. This is the failure mode worth attention, and it is repaired by adding the pointer, never by retiring the repo.';
  } else {
    out.verdict = recent && recent > 0 ? 'green' : 'check-in';
    out.reason = recent && recent > 0
      ? `building with ${recent} commit(s) in the last ${window} days`
      : `building but no commits in ${window} days — either work stalled, or the stage should be \`steady\`/\`quiet\``;
  }

  out.checked_at = todayISO();
  writeJson(out);
}

function runShow() {
  const root = repoRoot();
  const loaded = loadContract(root);
  if (loaded.present && loaded.data === null) {
    fail(`could not parse ${CONTRACT_FILENAME}`, { detail: loaded.error });
  }
  writeJson({
    ok: true,
    present: loaded.present,
    path: loaded.path,
    contract: withDefaults(loaded.present ? loaded.data : {}),
    defaults_applied: !loaded.present,
  });
}

/**
 * unlocks — fleet-wide unlock accounting.
 *
 * Reads every registered repo's contract and groups quiet repos by what would
 * unlock them. This is the payoff of orienting the blocker around the unlock
 * rather than the obstacle: "money-blocked" tells you nothing you can act on,
 * but three repos naming the same purchase tells you that purchase is worth
 * three times what it looks like from inside any one of them.
 *
 * Grouping is by normalized `unlocked_by` text, so naming the same thing the
 * same way across repos matters. Near-misses are surfaced rather than merged —
 * silently clustering "lawyer consult" with "a lawyer" would fabricate an
 * accounting the founder did not state.
 */
function runUnlocks() {
  const root = repoRoot();
  const registryPath = path.join(root, 'fleet', 'registry.yaml');
  if (!fs.existsSync(registryPath)) {
    fail('unlocks: fleet/registry.yaml not found — run this from the fleet hub', { looked_in: registryPath });
  }
  const reg = readYAMLFile(registryPath);
  if (!reg.ok || !reg.data) fail('unlocks: could not parse fleet/registry.yaml');

  const repos = reg.data.repositories || reg.data.repos || [];
  const groups = new Map();
  const scanned = [];
  const noContract = [];

  for (const r of repos) {
    if (!r || !r.path) continue;
    const p = path.join(r.path, CONTRACT_FILENAME);
    if (!fs.existsSync(p)) { noContract.push(r.name); continue; }
    const parsed = readYAMLFile(p);
    if (!parsed.ok || !parsed.data) { noContract.push(r.name); continue; }
    const c = withDefaults(parsed.data);
    scanned.push(r.name);
    if (!c.blocked_by.class || !c.blocked_by.unlocked_by) continue;

    const key = String(c.blocked_by.unlocked_by).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!groups.has(key)) {
      groups.set(key, { unlocked_by: c.blocked_by.unlocked_by, class: c.blocked_by.class, repos: [], costs: [], refs: [] });
    }
    const g = groups.get(key);
    g.repos.push(r.name);
    if (c.blocked_by.estimated_cost) g.costs.push(c.blocked_by.estimated_cost);
    if (c.blocked_by.unlock_ref) g.refs.push(c.blocked_by.unlock_ref);
  }

  const unlocks = [...groups.values()]
    .map(g => ({
      unlocked_by: g.unlocked_by,
      class: g.class,
      repos_released: g.repos.length,
      repos: g.repos,
      estimated_costs: [...new Set(g.costs)],
      unlock_refs: [...new Set(g.refs)],
    }))
    .sort((a, b) => b.repos_released - a.repos_released);

  writeJson({
    ok: true,
    repos_with_contracts: scanned.length,
    repos_without_contracts: noContract,
    unlocks,
    note: unlocks.length
      ? 'Sorted by how many repos each unlock releases. Grouping is exact on normalized text — repos naming the same thing differently will not merge, deliberately.'
      : 'No blocked repos with a named unlock yet. This fills in as contracts are declared.',
    checked_at: todayISO(),
  });
}

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  if (!sub || sub === '--help' || sub === '-h') {
    process.stdout.write(
      'usage: cwos-health-contract <init|validate|check|show|unlocks>\n' +
      '  init      [--force]   scaffold .cwos-health.yaml\n' +
      '  validate  [--strict]  structural + semantic checks\n' +
      '  check                 is this repo meeting its own declared standard?\n' +
      '  show                  parsed contract with defaults applied\n' +
      '  unlocks               fleet-wide: what unlocks the most repos (run from the hub)\n' +
      '\nA repo with no contract is read against fleet defaults — supported, not a failure.\n'
    );
    process.exit(sub ? 0 : 1);
  }
  if (sub === 'init') return runInit(args.slice(1));
  if (sub === 'validate') return runValidate(args.slice(1));
  if (sub === 'check') return runCheck();
  if (sub === 'show') return runShow();
  if (sub === 'unlocks') return runUnlocks();
  process.stderr.write(`cwos-health-contract: unknown subcommand: ${sub}\n`);
  process.exit(2);
}

if (require.main === module) main();

module.exports = {
  durationToDays, withDefaults, validateContract, loadContract,
  VALID_STAGES, VALID_BLOCKERS, DEFAULTS, CONTRACT_FILENAME,
};
