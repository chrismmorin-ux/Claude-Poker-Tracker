#!/usr/bin/env node
/**
 * cwos-genesis-ignite.js — Ignition engine for /intend (WS-321 Phase C).
 *
 * Reads dormant-mode capture buffer + intention.md, proposes a full bundle
 * (archetype, stage, programs, invariants, constraints, seed work items),
 * gates on founder approval, and applies the bundle to flip adoption_phase
 * from M0 to M1. Generative, not interrogative — founder approves/edits
 * the whole bundle in one shot, not 17 questions.
 *
 * Subcommands:
 *   propose --target-dir <p> [--archetype-hint A?] [--out json|markdown]
 *           Pure-function generator. No side effects.
 *   apply   --target-dir <p> --proposal-file <p> --exit-trigger <trigger>
 *           Orchestrates the bundle install: cwos-adopt-archetype.js apply,
 *           prog-*.yaml copy, adoption_phase flip, system/*.md appends,
 *           queue seed, genesis_ignition_consumed envelope event.
 *   validate --target-dir <p>
 *           Preconditions: adoption_phase==M0, intention.md non-placeholder
 *           OR buffer non-empty, no prior ignition.
 *
 * Design refs: ADR-046 (genesis + dormant), ADR-047 (intention trigger),
 * WS-321 spec, plan at .claude/plans/elegant-wobbling-breeze.md.
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { readYAMLFile, writeFileAtomic, todayISO } = require('./lib/cwos-utils');
const { resolveBundle } = require('./cwos-adopt-archetype');

const KIT_ROOT = path.resolve(__dirname, '..', '..');
const ARCHETYPES_PATH = path.join(KIT_ROOT, 'kit', 'data', 'archetypes.yaml');
const STAGES_PATH = path.join(KIT_ROOT, 'kit', 'data', 'stages.yaml');
const GENESIS_SPRINTS_DIR = path.join(KIT_ROOT, 'kit', 'data', 'genesis-sprints');
const PROGRAM_TEMPLATES_DIR = path.join(KIT_ROOT, 'kit', 'templates', 'workstream', 'programs');

// ─── CLI helpers ────────────────────────────────────────────────────────────

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i < 0 || i === args.length - 1) return null;
  return args[i + 1];
}

function dieWith(code, msg) {
  process.stderr.write(`cwos-genesis-ignite: ${msg}\n`);
  process.exit(code);
}

function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function nowISO() { return new Date().toISOString(); }

function sha256OfNonCommentContent(text) {
  const stripped = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*$/gm, '')
    .trim();
  return crypto.createHash('sha256').update(stripped, 'utf8').digest('hex');
}

// ─── Inputs ─────────────────────────────────────────────────────────────────

function loadOnboarding(targetDir) {
  const p = path.join(targetDir, '.cwos-onboarding.yaml');
  if (!fs.existsSync(p)) dieWith(2, `${p} does not exist — is this a CWOS repo?`);
  const r = readYAMLFile(p);
  if (!r.ok) dieWith(2, `cannot parse ${p}: ${r.error}`);
  return { path: p, raw: fs.readFileSync(p, 'utf8'), data: r.data || {} };
}

function loadIntention(targetDir) {
  const candidates = [
    path.join(targetDir, 'system', 'intention.md'),
    path.join(targetDir, '.cwos', 'system', 'intention.md'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return { path: p, content: fs.readFileSync(p, 'utf8') };
  }
  return null;
}

// Read all T20:capture-buffer events from the events log.
function loadCaptureBuffer(targetDir) {
  const eventsPath = path.join(targetDir, '.claude', 'workstream', 'events', 'current.jsonl');
  if (!fs.existsSync(eventsPath)) return [];
  const events = [];
  try {
    const content = fs.readFileSync(eventsPath, 'utf8');
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line);
        if (ev.source_track === 'T20:capture-buffer') events.push(ev);
      } catch { /* skip bad line */ }
    }
  } catch { /* skip */ }
  return events;
}

// Has ignition already been consumed for this repo?
function hasIgnitionConsumed(targetDir) {
  const eventsPath = path.join(targetDir, '.claude', 'workstream', 'events', 'current.jsonl');
  if (!fs.existsSync(eventsPath)) return false;
  try {
    const content = fs.readFileSync(eventsPath, 'utf8');
    return content.includes('genesis_ignition_consumed');
  } catch { return false; }
}

// ─── Inference ──────────────────────────────────────────────────────────────

function loadArchetypesData() {
  const r = readYAMLFile(ARCHETYPES_PATH);
  if (!r.ok) dieWith(2, `cannot parse ${ARCHETYPES_PATH}: ${r.error}`);
  return r.data;
}

function loadStagesData() {
  const r = readYAMLFile(STAGES_PATH);
  if (!r.ok) dieWith(2, `cannot parse ${STAGES_PATH}: ${r.error}`);
  return r.data;
}

// Extract Principles section bullets from intention.md (or empty array if
// section is missing or only contains placeholder).
// Lines wrapped in single underscores (e.g., `_"Example principle"_`) are
// template example content, NOT real founder content. The intention.md
// template uses italic wrapping for guidance/examples; we treat those as
// placeholders alongside literal `_placeholder_` markers.
function isPlaceholderBullet(rawText) {
  const t = rawText.trim();
  if (!t) return true;
  if (/placeholder/i.test(t)) return true;
  // Italic-wrapped (single underscores at both ends) — template example.
  if (/^_[^_].*[^_]_$/.test(t) || t === '_placeholder_') return true;
  return false;
}

function extractPrinciples(intentionContent) {
  if (!intentionContent) return [];
  const sectionMatch = intentionContent.match(/##\s+Principles\s*\n([\s\S]*?)(?=\n##\s|\n---|$)/);
  if (!sectionMatch) return [];
  const body = sectionMatch[1];
  const bullets = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*-\s+(.+?)\s*$/);
    if (!m) continue;
    if (isPlaceholderBullet(m[1])) continue;
    let text = m[1].replace(/^_+|_+$/g, '').trim();
    if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
    bullets.push(text);
  }
  return bullets;
}

function extractAntiGoals(intentionContent) {
  if (!intentionContent) return [];
  const sectionMatch = intentionContent.match(/##\s+Anti-goals\s*\n([\s\S]*?)(?=\n##\s|\n---|$)/);
  if (!sectionMatch) return [];
  const body = sectionMatch[1];
  const bullets = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*-\s+(.+?)\s*$/);
    if (!m) continue;
    if (isPlaceholderBullet(m[1])) continue;
    let text = m[1].replace(/^_+|_+$/g, '').trim();
    bullets.push(text);
  }
  return bullets;
}

function extractImaginedOutcome(intentionContent) {
  if (!intentionContent) return null;
  const sectionMatch = intentionContent.match(/##\s+Imagined Outcome\s*\n([\s\S]*?)(?=\n##\s|\n---|$)/);
  if (!sectionMatch) return null;
  const body = sectionMatch[1].trim();
  const realLines = body.split('\n').filter(l => {
    const t = l.trim();
    if (!t) return false;
    if (t.startsWith('#')) return false;
    if (/placeholder/i.test(t)) return false;
    // Italic-wrapped paragraphs are template examples (the template uses
    // italics liberally for guidance text). Only paragraphs without italic
    // wrapping count as real founder content.
    if (t.startsWith('_') && t.endsWith('_')) return false;
    return true;
  });
  if (realLines.length === 0) return null;
  return realLines.join(' ').slice(0, 600);
}

// Score each archetype by counting prompt-keyword matches against the
// intention.md Principles bullets and capture-buffer summaries. Tie-break to A3.
function inferArchetype(archetypesData, principles, captureSummaries) {
  const archetypes = archetypesData.archetypes || [];
  const haystack = [
    ...principles,
    ...captureSummaries,
  ].join(' ').toLowerCase();

  const scores = new Map();
  for (const a of archetypes) {
    const prompts = (a.label_extras && a.label_extras.prompts) || [];
    let hits = 0;
    for (const prompt of prompts) {
      const tokens = prompt.toLowerCase().split(/\s+/).filter(t => t.length >= 4);
      for (const tok of tokens) {
        if (haystack.includes(tok)) hits += 1;
      }
    }
    if (hits > 0) scores.set(a.id, hits);
  }

  if (scores.size === 0) {
    return { archetype: 'A3', rationale: 'No keyword hits across archetype prompts; defaulting to A3 (Real-time consumer app) per ADR-047 tie-break rule.' };
  }

  const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  const topScore = sorted[0][1];
  const tied = sorted.filter(([, s]) => s === topScore).map(([id]) => id);
  if (tied.includes('A3')) {
    return { archetype: 'A3', rationale: `A3 selected (score ${topScore}) — tied entries: ${tied.join(', ')}; A3 wins tie-break.` };
  }
  return { archetype: tied[0], rationale: `${tied[0]} selected (score ${topScore}, no tie).` };
}

function inferStage(stagesData, archetype) {
  const entry = stagesData.archetype_entry_stages || {};
  const raw = entry[archetype] || entry.default_no_archetype || 'S1';
  // CWOS YAML parser doesn't strip inline comments; the source file uses
  // `A3: S1   # ...` syntax, so the value comes back with the comment
  // appended. Strip everything from the first `#` onward and trim.
  return String(raw).split('#')[0].trim();
}

// Load the per-archetype ignition template (kit/data/genesis-sprints/<arch>.yaml).
function loadIgnitionTemplate(archetype) {
  const p = path.join(GENESIS_SPRINTS_DIR, `${archetype}.yaml`);
  if (!fs.existsSync(p)) return null;
  const r = readYAMLFile(p);
  if (!r.ok) return null;
  return r.data;
}

// ─── Trigger inference (WS-322 Phase A) ────────────────────────────────────
//
// Maps an anti-goal text string to a structured re_eval_trigger. The trigger
// gates a deferred-scope WS item — when the trigger condition fires (archetype
// migration, milestone advance, program tier change, fleet event), the item
// becomes eligible and surfaces in /pulse for re-evaluation.
//
// The shape of re_eval_trigger:
//   {
//     type: "archetype_migration" | "milestone_reached" | "program_tier_change" | "fleet_event",
//     target: <type-specific value — e.g., "A3" for archetype_migration, "M3" for milestone_reached>,
//     rationale: <plain-language explanation of why this trigger>,
//     set_at: <ISO timestamp when the trigger was inferred / set>
//   }
//
// Heuristic confidence: this is a "best effort at ignition time" map. Founder
// can edit any inferred trigger by editing the proposal JSON before approving
// (option 2 in /intend approval gate). Bias toward sensible defaults that are
// easy to recognize as wrong, not toward hidden cleverness.
function inferTriggerFromAntiGoal(antiGoalText) {
  const t = String(antiGoalText || '').toLowerCase();
  const now = nowISO();

  // Webapp / UX / interface / mobile — A3 (real-time consumer app) territory.
  // Word-prefix matches (no trailing \b) so "webapp" / "frontend" are caught.
  if (/\b(webapp|web app|ui surface|ux surface|user interface|mobile app|consumer app|frontend|front-end)\b/.test(t)) {
    return {
      type: 'archetype_migration',
      target: 'A3',
      rationale: 'Anti-goal mentions UX/webapp/consumer surface — A3 archetype migration is the natural trigger for re-evaluating this scope.',
      set_at: now,
    };
  }

  // Commercializ-, paying customer, monetiz-, billing — A1 (regulated commercial) territory.
  // Word-prefix matches: \w* allows "commercializing" / "monetization" etc.
  if (/\bcommercializ\w*|\bpaying customer|\bmonetiz\w*|\bbilling\b|\bpaywall\b|\bsubscription\b|\bpayment\b/.test(t)) {
    return {
      type: 'archetype_migration',
      target: 'A1',
      rationale: 'Anti-goal mentions commercialization / paying customers — A1 archetype migration is the trigger.',
      set_at: now,
    };
  }

  // Self-modifying tool / kit distribution — A5 territory.
  if (/\bself-modifying\b|\bkit distribution\b|\bfleet propagation\b|\bpublic api\b/.test(t)) {
    return {
      type: 'archetype_migration',
      target: 'A5',
      rationale: 'Anti-goal mentions self-modification or kit distribution — A5 archetype migration is the trigger.',
      set_at: now,
    };
  }

  // Falsifiable claims / research framework — A4 territory.
  if (/\bfalsifiab\w*|\bresearch framework\b|\bclaims-policy\b|\badversarial review\b|\bevidence tier\b/.test(t)) {
    return {
      type: 'archetype_migration',
      target: 'A4',
      rationale: 'Anti-goal mentions research-framework / falsifiability — A4 archetype migration is the trigger.',
      set_at: now,
    };
  }

  // Generic "in v1" / "for now" / "this version" — milestone-based fallback.
  if (/\b(v1|version 1|for now|this version|first pass|initial release|mvp)\b/.test(t)) {
    return {
      type: 'milestone_reached',
      target: 'M3',
      rationale: 'Anti-goal phrased as v1-deferral with no specific archetype signal — defaulting to M3 (workstream-active, sprint composer running) as the natural re-eval point.',
      set_at: now,
    };
  }

  // Default fallback: M3 milestone, low-confidence trigger.
  return {
    type: 'milestone_reached',
    target: 'M3',
    rationale: 'No specific trigger signal in anti-goal text; defaulting to M3 milestone as a generic re-eval point. Founder should edit if a more specific trigger applies.',
    set_at: now,
    confidence: 'low',
  };
}

// ─── Subcommand: validate ───────────────────────────────────────────────────

// WS-377: minimum hours between /genesis and /intend ignition. Catches the
// Nutrition-class "same-day ignition against placeholder intention" failure.
// Founder override: --force flag bypasses the gate.
const IGNITION_MIN_HOURS = 12;

function hoursSince(isoTimestamp) {
  if (!isoTimestamp) return null;
  const t = Date.parse(isoTimestamp);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 3600000;
}

function cmdValidate(args) {
  const targetDir = readFlag(args, 'target-dir');
  if (!targetDir) dieWith(2, 'validate: --target-dir required');
  const force = args.includes('--force');
  const target = path.resolve(targetDir);

  const onb = loadOnboarding(target);
  const phase = onb.data.adoption_phase;

  const result = { ok: true, errors: [], warnings: [] };

  if (phase !== 'M0') {
    result.errors.push(`adoption_phase is "${phase}" (expected M0). Already-ignited repos cannot re-ignite — use /checkpoint or /archetype re instead.`);
  }

  if (hasIgnitionConsumed(target)) {
    result.errors.push('genesis_ignition_consumed event already present in event log — ignition has run.');
  }

  const intention = loadIntention(target);
  const principles = intention ? extractPrinciples(intention.content) : [];
  const buffer = loadCaptureBuffer(target);
  const hasIntentionContent = principles.length > 0 || extractAntiGoals(intention ? intention.content : '').length > 0 || extractImaginedOutcome(intention ? intention.content : '');
  const hasBuffer = buffer.length > 0;
  if (!hasIntentionContent && !hasBuffer) {
    result.errors.push('write at least one paragraph in intention.md or drop one file in system/ — capture buffer is empty and intention.md is still placeholder.');
  }

  // WS-377 temporal/content gate: even if there's "some" content, refuse to
  // ignite if intention.md still has the placeholder hash AND less than
  // IGNITION_MIN_HOURS have elapsed since scaffold. This catches the
  // Nutrition class where /genesis and /intend ran the same day against a
  // placeholder. Override with --force (for sim and explicit founder intent).
  const m0 = onb.data && onb.data.m0_dormant ? onb.data.m0_dormant : {};
  const placeholderHash = m0.intention_content_hash || null;
  const enteredAt = m0.entered_at || null;
  const currentHash = intention ? sha256OfNonCommentContent(intention.content) : null;
  const hashUnchanged = placeholderHash && currentHash && placeholderHash === currentHash;
  const hours = hoursSince(enteredAt);
  const underMinHours = hours != null && hours < IGNITION_MIN_HOURS;

  if (hashUnchanged && underMinHours && !force) {
    const h = hours.toFixed(1);
    result.errors.push(
      `Genesis ran ${h}h ago and intention.md is still the placeholder template ` +
      `(content hash unchanged from scaffold). Edit system/intention.md with your ` +
      `declared goal, anti-goals, and constraints, then re-run /intend. ` +
      `(Use --force to override for testing.)`
    );
  } else if (hashUnchanged && !force) {
    // Hash unchanged but past min-hours window — warn rather than block.
    result.warnings.push(
      'intention.md content hash is unchanged from the /genesis placeholder. ' +
      'Ignition is proceeding because more than 12h have elapsed, but the founder ' +
      'has not edited intention.md — programs may be scoped to placeholders. ' +
      'Consider editing intention.md before continuing.'
    );
  }

  result.ok = result.errors.length === 0;
  result.checks = {
    adoption_phase: phase,
    intention_has_content: hasIntentionContent,
    buffer_event_count: buffer.length,
    ignition_already_consumed: hasIgnitionConsumed(target),
    intention_hash_unchanged: hashUnchanged,
    hours_since_genesis: hours,
    force_override: force,
  };
  writeJson(result);
  if (!result.ok) process.exit(1);
}

// ─── Subcommand: propose ────────────────────────────────────────────────────

function cmdPropose(args) {
  const targetDir = readFlag(args, 'target-dir');
  if (!targetDir) dieWith(2, 'propose: --target-dir required');
  const target = path.resolve(targetDir);
  const archetypeHint = readFlag(args, 'archetype-hint');
  const out = readFlag(args, 'out') || 'json';

  // Load inputs
  const onb = loadOnboarding(target);
  if (onb.data.adoption_phase !== 'M0') {
    dieWith(3, `adoption_phase is "${onb.data.adoption_phase}" — propose only runs in M0`);
  }
  const intention = loadIntention(target);
  const buffer = loadCaptureBuffer(target);
  const archetypesData = loadArchetypesData();
  const stagesData = loadStagesData();

  const principles = intention ? extractPrinciples(intention.content) : [];
  const antiGoals = intention ? extractAntiGoals(intention.content) : [];
  const imaginedOutcome = intention ? extractImaginedOutcome(intention.content) : null;
  const captureSummaries = buffer
    .filter(ev => ev.track_tag === 'conversation_summary')
    .map(ev => (ev.payload && ev.payload.summary_text) || '');
  const implicitDecisions = buffer
    .filter(ev => ev.track_tag === 'implicit_decision')
    .map(ev => (ev.payload && ev.payload.decision_text) || '')
    .filter(Boolean);

  // Inference
  const inferred = archetypeHint
    ? { archetype: archetypeHint, rationale: `Founder-supplied --archetype-hint=${archetypeHint}.` }
    : inferArchetype(archetypesData, principles, captureSummaries);
  const archetype = inferred.archetype;
  const stage = inferStage(stagesData, archetype);

  // Bundle resolution (reuses cwos-adopt-archetype.resolveBundle)
  const bundle = resolveBundle(archetype, stage, { programs: [], tiers: [] });

  // Ignition template
  const tmpl = loadIgnitionTemplate(archetype);

  // Compose proposal
  const invariants = [];
  for (const p of principles) {
    invariants.push({ source: 'intention.md Principles', text: p });
  }
  if (tmpl && Array.isArray(tmpl.initial_invariants_checklist)) {
    for (const iv of tmpl.initial_invariants_checklist) {
      invariants.push({
        source: `genesis-sprints/${archetype}.yaml`,
        id_hint: iv.id_hint,
        rule: iv.rule,
        rationale: iv.rationale,
        severity: iv.severity || 'medium',
      });
    }
  }

  const constraints = [];
  for (const ag of antiGoals) {
    // WS-322 Phase A: anti-goals get an inferred re_eval_trigger so apply can
    // emit them as deferred-scope tripwires. Founder edits the trigger in the
    // proposal JSON before approving if the inference is wrong.
    constraints.push({
      source: 'intention.md Anti-goals',
      text: ag,
      trigger: inferTriggerFromAntiGoal(ag),
    });
  }
  if (tmpl && Array.isArray(tmpl.initial_constraints_checklist)) {
    for (const c of tmpl.initial_constraints_checklist) {
      constraints.push({ source: `genesis-sprints/${archetype}.yaml`, text: c.text, rationale: c.rationale });
    }
  }

  const decisions = implicitDecisions.map(d => ({ source: 'capture-buffer.implicit_decision', text: d }));

  const seedItems = [];
  if (tmpl && Array.isArray(tmpl.seed_work_items)) {
    for (const item of tmpl.seed_work_items) {
      seedItems.push({
        title: item.title,
        effort: item.effort || 'M',
        type: item.type || 'feature',
        capability: item.capability || 'meta',
        program_hint: item.program_hint || null,
        description: item.description || '',
        accept_criteria: item.accept_criteria || [],
      });
    }
  }

  const proposal = {
    schema_version: 1,
    generated_at: nowISO(),
    inputs: {
      buffer_event_count: buffer.length,
      buffer_span: buffer.length > 0
        ? [buffer[0].timestamp, buffer[buffer.length - 1].timestamp]
        : [null, null],
      buffer_by_tag: buffer.reduce((acc, ev) => {
        acc[ev.track_tag] = (acc[ev.track_tag] || 0) + 1;
        return acc;
      }, {}),
      principles_count: principles.length,
      anti_goals_count: antiGoals.length,
      imagined_outcome_present: Boolean(imaginedOutcome),
      implicit_decision_count: implicitDecisions.length,
    },
    proposal: {
      archetype,
      archetype_rationale: inferred.rationale,
      stage,
      stage_rationale: `Default entry stage for ${archetype} per kit/data/stages.yaml#archetype_entry_stages.`,
      bundle: {
        programs: bundle.programs,
        engines: bundle.engines,
        personas: bundle.personas,
        tiers: bundle.tiers,
      },
      imagined_outcome: imaginedOutcome,
      invariants_proposed: invariants,
      constraints_proposed: constraints,
      decisions_proposed: decisions,
      seed_work_items: seedItems,
    },
    approval: {
      required: true,
      approval_path: '/intend reads this proposal, presents the markdown form, gates on founder approve/edit/cancel.',
    },
  };

  if (out === 'markdown') {
    process.stdout.write(renderProposalMarkdown(proposal));
  } else {
    writeJson(proposal);
  }
}

function renderProposalMarkdown(p) {
  const pr = p.proposal;
  const lines = [];
  lines.push('## Proposed bundle\n');
  lines.push(`### Archetype: ${pr.archetype}`);
  lines.push(`_Rationale: ${pr.archetype_rationale}_\n`);
  lines.push(`### Stage: ${pr.stage}`);
  lines.push(`_Rationale: ${pr.stage_rationale}_\n`);

  if (pr.imagined_outcome) {
    lines.push('### Imagined Outcome (from intention.md)');
    lines.push(`> ${pr.imagined_outcome}\n`);
  }

  lines.push('### Programs to spawn');
  for (const prog of pr.bundle.programs) {
    const tier = pr.bundle.tiers[prog] || '?';
    lines.push(`- ${prog} (${tier})`);
  }
  lines.push('');

  lines.push('### Engines + personas');
  lines.push(`Engines: ${pr.bundle.engines.join(', ') || '(none)'}`);
  lines.push(`Personas: ${pr.bundle.personas.join(', ') || '(none)'}\n`);

  if (pr.invariants_proposed.length > 0) {
    lines.push('### Invariants proposed');
    for (const iv of pr.invariants_proposed) {
      const text = iv.rule || iv.text;
      const src = iv.source ? ` _(from ${iv.source})_` : '';
      lines.push(`- [ ] ${text}${src}`);
    }
    lines.push('');
  }

  if (pr.constraints_proposed.length > 0) {
    // Split anti-goals (which become tripwires) from baseline constraints for
    // clearer founder review. Anti-goals show with their inferred triggers.
    const antiGoals = pr.constraints_proposed.filter(c => c.trigger);
    const baseline = pr.constraints_proposed.filter(c => !c.trigger);

    if (antiGoals.length > 0) {
      lines.push('### Anti-goals (deferred scope — will become blocked WS items with re-eval triggers)');
      antiGoals.forEach((c) => {
        const trig = c.trigger;
        lines.push(`- [ ] ${c.text}`);
        lines.push(`      _Trigger: ${trig.type} → ${trig.target}_${trig.confidence ? ` _(low confidence — verify)_` : ''}`);
      });
      lines.push('');
      lines.push('_Edit the trigger in the JSON proposal (option 2) if the inference is wrong._');
      lines.push('');
    }

    if (baseline.length > 0) {
      lines.push('### Baseline constraints (project rules — not deferred scope)');
      for (const c of baseline) {
        const src = c.source ? ` _(from ${c.source})_` : '';
        lines.push(`- [ ] ${c.text}${src}`);
      }
      lines.push('');
    }
  }

  if (pr.decisions_proposed.length > 0) {
    lines.push('### Implicit decisions detected');
    for (const d of pr.decisions_proposed) {
      lines.push(`- [ ] ${d.text} _(from ${d.source})_`);
    }
    lines.push('');
  }

  if (pr.seed_work_items.length > 0) {
    lines.push('### Seed work items');
    pr.seed_work_items.forEach((item, i) => {
      lines.push(`- WS-${String(i + 1).padStart(3, '0')}: ${item.title} (${item.effort})`);
    });
    lines.push('');
  }

  lines.push(`---\n[1] Approve as-is  [2] Edit JSON  [3] Cancel\n`);
  return lines.join('\n');
}

// ─── Subcommand: apply ──────────────────────────────────────────────────────

function cmdApply(args) {
  const targetDir = readFlag(args, 'target-dir');
  const proposalFile = readFlag(args, 'proposal-file');
  const exitTrigger = readFlag(args, 'exit-trigger') || 'intend_command';
  if (!targetDir) dieWith(2, 'apply: --target-dir required');
  if (!proposalFile) dieWith(2, 'apply: --proposal-file required');

  const target = path.resolve(targetDir);
  if (!fs.existsSync(proposalFile)) dieWith(2, `proposal-file not found: ${proposalFile}`);

  // Validate preconditions
  const onb = loadOnboarding(target);
  if (onb.data.adoption_phase !== 'M0') {
    dieWith(3, `apply refused: adoption_phase is "${onb.data.adoption_phase}", not M0`);
  }
  if (hasIgnitionConsumed(target)) {
    dieWith(3, 'apply refused: genesis_ignition_consumed event already present in event log');
  }

  let proposal;
  try {
    proposal = JSON.parse(fs.readFileSync(proposalFile, 'utf8'));
  } catch (e) {
    dieWith(2, `cannot parse proposal-file: ${e.message}`);
  }

  const pr = proposal.proposal;
  if (!pr || !pr.archetype) dieWith(2, 'proposal has no proposal.archetype field');

  const result = {
    ok: true,
    target,
    archetype: pr.archetype,
    stage: pr.stage,
    exit_trigger: exitTrigger,
    applied_at: nowISO(),
    steps: {},
  };

  // Step 1: Patch onboarding YAML with archetype/stage/bundle via cwos-adopt-archetype.
  // We invoke the existing apply subcommand as a subprocess to reuse its
  // patching logic (lines 181-216 in cwos-adopt-archetype.js).
  try {
    execFileSync('node', [
      path.join(KIT_ROOT, 'kit', 'scripts', 'cwos-adopt-archetype.js'),
      'apply',
      '--archetype', pr.archetype,
      '--stage', pr.stage,
      '--target-dir', target,
    ], { stdio: 'pipe' });
    result.steps.archetype_apply = 'ok';
  } catch (e) {
    result.steps.archetype_apply = `failed: ${e.message}`;
    result.ok = false;
    writeJson(result);
    process.exit(4);
  }

  // Step 2: Copy program YAMLs from kit templates → target's
  // .claude/workstream/programs/. Filter by bundle.programs[].
  const targetProgramsDir = path.join(target, '.claude', 'workstream', 'programs');
  fs.mkdirSync(targetProgramsDir, { recursive: true });
  const programsCopied = [];
  for (const progId of pr.bundle.programs) {
    const tmplPath = path.join(PROGRAM_TEMPLATES_DIR, `${progId}.yaml`);
    if (!fs.existsSync(tmplPath)) {
      result.steps[`program_${progId}`] = 'template_missing';
      continue;
    }
    const content = fs.readFileSync(tmplPath, 'utf8');
    const dst = path.join(targetProgramsDir, `${progId}.yaml`);
    writeFileAtomic(dst, content);
    programsCopied.push(progId);
  }
  result.steps.programs_copied = programsCopied;

  // Step 3: Flip adoption_phase M0 → M1 + set m0_dormant exit fields.
  const onbAfterArchetype = loadOnboarding(target);
  let raw = onbAfterArchetype.raw;
  raw = patchTopLevelScalarPreserveComment(raw, 'adoption_phase', 'M1');
  raw = patchIndentedScalar(raw, 'exited_at', `"${result.applied_at}"`);
  raw = patchIndentedScalar(raw, 'exit_trigger', `"${exitTrigger}"`);
  writeFileAtomic(onbAfterArchetype.path, raw);
  result.steps.phase_flipped = 'M0 -> M1';

  // Step 4: Append accepted invariants to system/invariants.md.
  appendInvariants(target, pr.invariants_proposed || [], result.applied_at);
  result.steps.invariants_appended = (pr.invariants_proposed || []).length;

  // Step 5: Append accepted constraints to system/constraints.md.
  appendConstraints(target, pr.constraints_proposed || []);
  result.steps.constraints_appended = (pr.constraints_proposed || []).length;

  // Step 6: Append accepted decisions to system/decisions.md.
  appendDecisions(target, pr.decisions_proposed || [], result.applied_at);
  result.steps.decisions_appended = (pr.decisions_proposed || []).length;

  // Step 7: Write seed work items to .claude/workstream/queue/.
  const seedCount = writeSeedWorkItems(target, pr.seed_work_items || [], pr.archetype, 0);
  result.steps.seed_work_items = seedCount;

  // Step 7b (WS-322 Phase A): Write deferred-scope tripwires — one blocked
  // WS item per intention.md Anti-goal with an inferred re_eval_trigger. When
  // the trigger fires (Phase B), the item surfaces in /pulse for founder
  // re-evaluation. Filter to anti-goals only (template constraints are
  // baseline rules, not deferred scope; they don't get tripwires).
  const antiGoalsForTripwires = (pr.constraints_proposed || []).filter(
    c => c.source && /intention\.md Anti-goals/.test(c.source)
  );
  const tripwireCount = writeDeferredScopeTripwires(
    target,
    antiGoalsForTripwires,
    pr.archetype,
    seedCount
  );
  result.steps.tripwires_written = tripwireCount;

  // Step 8: Set usage.yaml welcome_completed: true (suppress /welcome).
  try {
    setWelcomeCompleted(target);
    result.steps.welcome_suppressed = 'ok';
  } catch (e) {
    result.steps.welcome_suppressed = `warn: ${e.message}`;
  }

  // Step 9: Emit T0:envelope genesis_ignition_consumed event. This is the
  // archive-boundary read-receipt for the dormant capture buffer.
  const consumedResult = emitConsumedEvent(target, {
    archetype: pr.archetype,
    stage: pr.stage,
    exit_trigger: exitTrigger,
    event_count: proposal.inputs ? proposal.inputs.buffer_event_count : 0,
    span_start: proposal.inputs ? proposal.inputs.buffer_span[0] : null,
    span_end: proposal.inputs ? proposal.inputs.buffer_span[1] : null,
    summary: `Genesis ignition: ${pr.archetype}/${pr.stage}, ${programsCopied.length} programs, ${seedCount} seed items.`,
  });
  result.steps.consumed_event_emitted = consumedResult.ok ? 'ok' : `failed: ${consumedResult.error}`;
  if (!consumedResult.ok) result.ok = false;

  writeJson(result);
}

// ─── Apply helpers ──────────────────────────────────────────────────────────

function patchTopLevelScalarPreserveComment(raw, field, newValue) {
  const re = new RegExp(`^(${escapeRe(field)}:\\s*)(\\S+?)(\\s*(?:#.*)?)$`, 'm');
  return raw.replace(re, (m, prefix) => `${prefix}${newValue}`);
}

function patchIndentedScalar(raw, field, newValue, indent = '  ') {
  const re = new RegExp(`^(${escapeRe(indent)}${escapeRe(field)}:\\s*)(\\S+?)(\\s*(?:#.*)?)$`, 'm');
  return raw.replace(re, (m, prefix) => `${prefix}${newValue}`);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appendInvariants(targetDir, invariants, appliedAt) {
  if (invariants.length === 0) return;
  const p = path.join(targetDir, 'system', 'invariants.md');
  let content = '';
  if (fs.existsSync(p)) content = fs.readFileSync(p, 'utf8');
  if (!content.trim()) {
    content = '# Invariants\n\nThings that must always hold for this project. Updated by /intend at ignition; founder edits as the project evolves.\n\n';
  }
  const block = ['\n## Genesis ignition (' + appliedAt.slice(0, 10) + ')\n'];
  for (const iv of invariants) {
    const id = iv.id_hint ? `INV-${iv.id_hint.replace(/^INV-/, '')}` : `INV-genesis-${invariants.indexOf(iv) + 1}`;
    const rule = iv.rule || iv.text;
    const rationale = iv.rationale || '';
    const severity = iv.severity || 'medium';
    block.push(`### ${id}: ${rule}`);
    if (rationale) block.push(`**Rationale:** ${rationale}`);
    block.push(`**Severity:** ${severity}`);
    block.push(`**Last Verified:** ${appliedAt.slice(0, 10)}`);
    block.push(`**Status:** PROPOSED (founder to confirm post-ignition)\n`);
  }
  writeFileAtomic(p, content + block.join('\n'));
}

function appendConstraints(targetDir, constraints) {
  if (constraints.length === 0) return;
  const p = path.join(targetDir, 'system', 'constraints.md');
  let content = '';
  if (fs.existsSync(p)) content = fs.readFileSync(p, 'utf8');
  if (!content.trim()) {
    content = '# Constraints\n\nProject constraints — what we are explicitly NOT trying to do. Updated by /intend at ignition.\n\n';
  }
  const lines = ['\n## Genesis ignition\n'];
  for (const c of constraints) {
    lines.push(`- ${c.text}` + (c.rationale ? ` _(${c.rationale})_` : ''));
  }
  writeFileAtomic(p, content + lines.join('\n') + '\n');
}

function appendDecisions(targetDir, decisions, appliedAt) {
  if (decisions.length === 0) return;
  const p = path.join(targetDir, 'system', 'decisions.md');
  let content = '';
  if (fs.existsSync(p)) content = fs.readFileSync(p, 'utf8');
  if (!content.trim()) {
    content = '# Decisions\n\nDecisions captured during the project lifecycle. Genesis ignition seeds initial decisions from the dormant capture buffer.\n\n';
  }
  const lines = ['\n## Genesis ignition (' + appliedAt.slice(0, 10) + ')\n'];
  decisions.forEach((d, i) => {
    lines.push(`### DEC-genesis-${i + 1}: ${d.text}`);
    lines.push(`**Date:** ${appliedAt.slice(0, 10)} | **Status:** Proposed | **Source:** ${d.source}\n`);
  });
  writeFileAtomic(p, content + lines.join('\n'));
}

function writeSeedWorkItems(targetDir, items, archetype, startIndex = 0) {
  if (items.length === 0) return 0;
  const queueDir = path.join(targetDir, '.claude', 'workstream', 'queue');
  fs.mkdirSync(queueDir, { recursive: true });
  const today = todayISO();
  items.forEach((item, i) => {
    const id = `WS-${String(startIndex + i + 1).padStart(3, '0')}`;
    const yaml = [
      `id: "${id}"`,
      `title: "${(item.title || '').replace(/"/g, '\\"')}"`,
      'status: backlog',
      `type: ${item.type || 'feature'}`,
      `category: ${item.capability || 'meta'}`,
      `capability: ${item.capability || 'meta'}`,
      `program: ${(item.program_hint || '').replace(/^prog-/, '') || 'engineering'}`,
      'priority_score: 10',
      `effort: ${item.effort || 'M'}`,
      'source:',
      `  surfaced_by: "Genesis ignition (archetype ${archetype})"`,
      'description: >',
      `  ${(item.description || '').replace(/\n/g, '\n  ')}`,
      'accept_criteria:',
      ...(item.accept_criteria || []).map(ac => `  - "${ac.replace(/"/g, '\\"')}"`),
      `created_at: "${today}"`,
      '',
    ].join('\n');
    writeFileAtomic(path.join(queueDir, `${id}.yaml`), yaml);
  });
  return items.length;
}

// WS-322 Phase A — write deferred-scope tripwire WS items for each anti-goal.
// Each item is status: blocked with a re_eval_trigger field naming the state
// transition that unblocks it. When the trigger fires (handled in Phase B),
// the item's status flips to backlog and surfaces in /pulse.
function writeDeferredScopeTripwires(targetDir, antiGoals, archetype, startIndex = 0) {
  if (!antiGoals || antiGoals.length === 0) return 0;
  const queueDir = path.join(targetDir, '.claude', 'workstream', 'queue');
  fs.mkdirSync(queueDir, { recursive: true });
  const today = todayISO();
  antiGoals.forEach((ag, i) => {
    const id = `WS-${String(startIndex + i + 1).padStart(3, '0')}`;
    const text = (ag.text || ag.rule || ag.rationale || '').toString().trim();
    const trigger = ag.trigger || inferTriggerFromAntiGoal(text);
    const title = buildTripwireTitle(text);

    // Plain-language note for /pulse readability — does NOT replace the
    // structured re_eval_trigger field; both surface together.
    const blockedNote = renderTriggerNote(trigger);

    const yaml = [
      `id: "${id}"`,
      `title: "${title.replace(/"/g, '\\"')}"`,
      'status: blocked',
      'type: deferred-scope',
      'category: scope-tripwire',
      'capability: meta',
      `program: ${ag.source && /Anti-goals/.test(ag.source) ? 'program-integrity' : 'engineering'}`,
      'priority_score: 5',
      'effort: TBD',
      'blocked_by: []',
      `blocked_by_note: "${blockedNote.replace(/"/g, '\\"')}"`,
      're_eval_trigger:',
      `  type: ${trigger.type}`,
      `  target: "${trigger.target}"`,
      `  rationale: "${(trigger.rationale || '').replace(/"/g, '\\"')}"`,
      `  set_at: "${trigger.set_at || nowISO()}"`,
      ...(trigger.confidence ? [`  confidence: ${trigger.confidence}`] : []),
      'source:',
      `  surfaced_by: "Genesis ignition anti-goal (archetype ${archetype})"`,
      `  anti_goal_text: "${text.replace(/"/g, '\\"')}"`,
      'description: >',
      `  Deferred scope from genesis ignition. The founder declared this`,
      `  out of scope at v1: "${text.replace(/\n/g, ' ').slice(0, 200)}".`,
      `  When the trigger fires (${trigger.type} -> ${trigger.target}), this`,
      `  item becomes eligible and /pulse surfaces it for re-evaluation.`,
      `  Founder either (a) commits to building it now, (b) re-defers with`,
      `  a new trigger, or (c) marks it abandoned with rationale.`,
      'accept_criteria:',
      '  - "Re-evaluation completed: founder explicitly chose build / re-defer / abandon"',
      '  - "If build: scope-equivalent execute item replaces this tripwire"',
      '  - "If re-defer: new re_eval_trigger replaces the old one with a clear rationale"',
      '  - "If abandon: item moved to status: dismissed with abandonment note in decisions.md"',
      `created_at: "${today}"`,
      '',
    ].join('\n');
    writeFileAtomic(path.join(queueDir, `${id}.yaml`), yaml);
  });
  return antiGoals.length;
}

// Generate a clean title for the tripwire WS item from the anti-goal text.
// Strips leading "Not " and prepends "Re-evaluate:" so titles read as
// re-evaluation actions (which is what they are).
function buildTripwireTitle(antiGoalText) {
  let stripped = String(antiGoalText || '').trim();
  // Strip leading "Not " / "not " (case-insensitive) — typical anti-goal phrasing.
  stripped = stripped.replace(/^not\s+/i, '');
  // Capitalize first letter for readability.
  if (stripped.length > 0) stripped = stripped[0].toUpperCase() + stripped.slice(1);
  return `Re-evaluate: ${stripped}`.slice(0, 200);
}

function renderTriggerNote(trigger) {
  if (!trigger) return 'Deferred scope; trigger missing — manual re-evaluation required.';
  switch (trigger.type) {
    case 'archetype_migration':
      return `Re-evaluate when archetype migrates to ${trigger.target} (e.g., via /archetype re ${trigger.target}).`;
    case 'milestone_reached':
      return `Re-evaluate when repo reaches milestone ${trigger.target}.`;
    case 'program_tier_change':
      return `Re-evaluate when ${trigger.target} program tier changes.`;
    case 'fleet_event':
      return `Re-evaluate on fleet event: ${trigger.target}.`;
    default:
      return `Re-evaluate (custom trigger: ${trigger.type}).`;
  }
}

function setWelcomeCompleted(targetDir) {
  const usagePath = path.join(targetDir, '.claude', 'workstream', 'usage.yaml');
  let content = '';
  if (fs.existsSync(usagePath)) content = fs.readFileSync(usagePath, 'utf8');
  if (!content.trim()) {
    content = '# Usage telemetry — updated by /session-end and other commands.\n';
  }
  if (/^welcome_completed:/m.test(content)) {
    content = content.replace(/^welcome_completed:.*$/m, 'welcome_completed: true');
  } else {
    content = content.replace(/\n*$/, '\n') + 'welcome_completed: true\n';
  }
  writeFileAtomic(usagePath, content);
}

function emitConsumedEvent(targetDir, payload) {
  const eventCli = path.join(KIT_ROOT, 'kit', 'scripts', 'cwos-event.js');
  try {
    const r = execFileSync('node', [
      eventCli, 'append', 'genesis_ignition_consumed',
      '--track', 'T0:envelope',
      '--tag', 'genesis_ignition_consumed',
      '--payload', JSON.stringify({ type: 'genesis_ignition_consumed', ...payload }),
    ], { stdio: ['ignore', 'pipe', 'pipe'], cwd: targetDir, env: { ...process.env, CWOS_SKIP_RENDER: '1' } });
    return { ok: true, stdout: String(r) };
  } catch (e) {
    const stderr = (e.stderr && String(e.stderr)) || e.message;
    process.stderr.write(`cwos-genesis-ignite: emitConsumedEvent failed — ${stderr}\n`);
    return { ok: false, error: stderr };
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  const rest = args.slice(1);
  switch (sub) {
    case 'propose': return cmdPropose(rest);
    case 'apply': return cmdApply(rest);
    case 'validate': return cmdValidate(rest);
    default:
      process.stderr.write([
        'Usage:',
        '  cwos-genesis-ignite.js propose --target-dir <p> [--archetype-hint A?] [--out json|markdown]',
        '  cwos-genesis-ignite.js apply --target-dir <p> --proposal-file <p> --exit-trigger intend_command|intention_md_edit_detected',
        '  cwos-genesis-ignite.js validate --target-dir <p>',
        '',
      ].join('\n'));
      process.exit(2);
  }
}

main();
