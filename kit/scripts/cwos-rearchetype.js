#!/usr/bin/env node
/**
 * cwos-rearchetype.js — archetype migration helper.
 *
 * Diffs program/engine/persona sets between two archetypes (using
 * cwos-adopt-archetype.resolveBundle) and applies the migration:
 *   - .cwos-onboarding.yaml#archetype/declared_archetype/archetype_bundle_resolved
 *     refreshed for the new archetype
 *   - prior archetype declaration archived to archetype_history[]
 *   - disappearing-program findings/items soft-archived (status: archived,
 *     archived_reason: "program_removed_via_re_archetype",
 *     archived_in_archetype_change: "<from>→<to>")
 *
 * Subcommands:
 *   diff   — emit JSON {disappearing, appearing, escalating, de_escalating, staying}
 *   apply  — perform the migration; emit JSON summary
 *
 * Architecture mirrors cwos-adopt-archetype.js (subcommand dispatcher,
 * surgical YAML patching, writeFileAtomic for crash safety).
 */

const fs = require('fs');
const path = require('path');
const { readYAMLFile, writeFileAtomic, loadEventDeps } = require('./lib/cwos-utils.js');
const adopt = require('./cwos-adopt-archetype.js');
const tm = require('./lib/tier-mapper.js');

const { appendEvent, ensureCommandId } = loadEventDeps();

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i < 0 || i === args.length - 1) return null;
  return args[i + 1];
}
function hasFlag(args, name) { return args.indexOf(`--${name}`) >= 0; }
function writeJson(obj) { process.stdout.write(JSON.stringify(obj, null, 2) + '\n'); }
function dieWith(code, msg) { process.stderr.write(`cwos-rearchetype: ${msg}\n`); process.exit(code); }

function loadOnboarding(targetDir) {
  const p = path.join(targetDir, '.cwos-onboarding.yaml');
  if (!fs.existsSync(p)) dieWith(2, `${p} does not exist`);
  const r = readYAMLFile(p);
  if (!r.ok) dieWith(2, `cannot parse ${p}: ${r.error}`);
  return { path: p, raw: fs.readFileSync(p, 'utf8'), data: r.data || {} };
}

// ─── diff ─────────────────────────────────────────────────────────────────

function computeDiff(fromArchetype, toArchetype, stage, overrides) {
  const fromBundle = adopt.resolveBundle(fromArchetype, stage, overrides);
  const toBundle = adopt.resolveBundle(toArchetype, stage, overrides);

  const fromProgs = new Set(fromBundle.programs);
  const toProgs = new Set(toBundle.programs);
  const fromEngs = new Set(fromBundle.engines);
  const toEngs = new Set(toBundle.engines);
  const fromPers = new Set(fromBundle.personas);
  const toPers = new Set(toBundle.personas);

  const tierRank = { dormant: 0, watch: 1, active: 2, critical: 3 };

  const programs = {
    disappearing: [...fromProgs].filter(p => !toProgs.has(p)),
    appearing: [...toProgs].filter(p => !fromProgs.has(p)),
    staying: [],
    escalating: [],
    de_escalating: [],
  };
  for (const p of fromProgs) {
    if (!toProgs.has(p)) continue;
    const fromTier = fromBundle.tiers[p] || 'dormant';
    const toTier = toBundle.tiers[p] || 'dormant';
    if (fromTier === toTier) programs.staying.push({ id: p, tier: fromTier });
    else if ((tierRank[toTier] || 0) > (tierRank[fromTier] || 0)) programs.escalating.push({ id: p, from: fromTier, to: toTier });
    else programs.de_escalating.push({ id: p, from: fromTier, to: toTier });
  }

  return {
    from_archetype: fromArchetype,
    to_archetype: toArchetype,
    stage,
    programs,
    engines: {
      disappearing: [...fromEngs].filter(e => !toEngs.has(e)),
      appearing: [...toEngs].filter(e => !fromEngs.has(e)),
      staying: [...fromEngs].filter(e => toEngs.has(e)),
    },
    personas: {
      disappearing: [...fromPers].filter(p => !toPers.has(p)),
      appearing: [...toPers].filter(p => !fromPers.has(p)),
      staying: [...fromPers].filter(p => toPers.has(p)),
    },
    from_bundle: fromBundle,
    to_bundle: toBundle,
  };
}

function cmdDiff(args) {
  const fromA = readFlag(args, 'from');
  const toA = readFlag(args, 'to');
  const targetDir = readFlag(args, 'target-dir');
  if (!fromA) dieWith(2, 'diff: --from <A?> required');
  if (!toA) dieWith(2, 'diff: --to <A?> required');

  let stage = readFlag(args, 'stage');
  let overrides = { programs: [], tiers: [] };
  if (targetDir) {
    const onboarding = loadOnboarding(targetDir);
    if (!stage) stage = onboarding.data.stage || onboarding.data.declared_stage || null;
    if (onboarding.data.archetype_overrides) {
      overrides = {
        programs: Array.isArray(onboarding.data.archetype_overrides.programs) ? onboarding.data.archetype_overrides.programs : [],
        tiers: Array.isArray(onboarding.data.archetype_overrides.tiers) ? onboarding.data.archetype_overrides.tiers : [],
      };
    }
  }
  if (!stage) {
    process.stderr.write('cwos-rearchetype: warning: no stage given (and no --target-dir to read from); diff returns programs only, no tier comparison.\n');
  }

  let diff;
  try { diff = computeDiff(fromA, toA, stage, overrides); }
  catch (e) { dieWith(2, `diff failed: ${e.message}`); }

  writeJson({ ok: true, computed_at: new Date().toISOString(), ...diff });
}

// ─── apply ────────────────────────────────────────────────────────────────

function cmdApply(args) {
  const toA = readFlag(args, 'to');
  const targetDir = readFlag(args, 'target-dir');
  const reason = readFlag(args, 'reason') || null;
  const keepOrphans = hasFlag(args, 'keep-orphan-findings');
  if (!toA) dieWith(2, 'apply: --to <A?> required');
  if (!targetDir) dieWith(2, 'apply: --target-dir <p> required');

  const onboarding = loadOnboarding(targetDir);
  const fromA = onboarding.data.archetype || onboarding.data.declared_archetype || 'NONE';
  const stage = onboarding.data.stage || onboarding.data.declared_stage || null;
  const overrides = onboarding.data.archetype_overrides || { programs: [], tiers: [] };

  if (fromA === toA) {
    writeJson({ ok: true, no_change: true, archetype: toA });
    return;
  }

  let diff;
  try { diff = computeDiff(fromA, toA, stage, overrides); }
  catch (e) { dieWith(2, `apply failed: ${e.message}`); }

  // Patch .cwos-onboarding.yaml
  let patched = onboarding.raw;

  // 1. Update archetype + declared_archetype to new value
  patched = patchScalarField(patched, 'archetype', `"${toA}"`);
  patched = patchScalarField(patched, 'declared_archetype', `"${toA}"`);

  // 2. Append prior archetype to archetype_history[]
  // Use bundle.resolved_at as declared_at (closest signal we have for when
  // the prior archetype was active). Fall back to "(unknown)" if the bundle
  // never resolved or its timestamp is missing/malformed (e.g., template
  // default with trailing YAML comment that the parser couldn't strip).
  const archivedAt = new Date().toISOString();
  const bundleResolvedAt = (onboarding.data.archetype_bundle_resolved && onboarding.data.archetype_bundle_resolved.resolved_at) || null;
  const declaredAt = (typeof bundleResolvedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(bundleResolvedAt)) ? bundleResolvedAt : '(unknown)';
  const historyEntry = {
    archetype: fromA,
    declared_at: declaredAt,
    archived_at: archivedAt,
    reason: reason || `re-archetype to ${toA}`,
  };
  patched = appendArchetypeHistory(patched, historyEntry);

  // 3. Replace archetype_bundle_resolved block with new bundle
  patched = replaceBundleBlock(patched, diff.to_bundle);

  writeFileAtomic(onboarding.path, patched);

  // 4. Soft-archive findings + work items tied to disappearing programs (unless --keep-orphan-findings)
  let archivedFindings = [];
  let archivedItems = [];
  if (!keepOrphans && diff.programs.disappearing.length > 0) {
    const change = `${fromA}→${toA}`;
    archivedFindings = archiveOrphanFindings(targetDir, diff.programs.disappearing, change);
    archivedItems = archiveOrphanQueueItems(targetDir, diff.programs.disappearing, change);
  }

  // Emit archetype_changed event
  let eventId = null;
  if (appendEvent && ensureCommandId) {
    try {
      const commandId = ensureCommandId('archetype-apply');
      const r = appendEvent({
        source_track: 'T6:workstream-archetype',
        source_tier: 'founder-prompt',
        track_tag: '/archetype',
        command_id: commandId,
        payload: {
          type: 'archetype_changed',
          target_dir: targetDir,
          from_archetype: fromA,
          to_archetype: toA,
          stage,
          reason,
          disappearing: diff.programs.disappearing,
          appearing: diff.programs.appearing,
          escalating: diff.programs.escalating,
          de_escalating: diff.programs.de_escalating,
          archived_findings: archivedFindings.length,
          archived_items: archivedItems.length,
          declared_at: archivedAt,
        },
      });
      if (r && r.ok && r.event) eventId = r.event.id;
    } catch (_e) { /* non-fatal */ }
  }

  // WS-322 Phase B: evaluate deferred-scope tripwires after archetype migration.
  // Tripwires gated on archetype_migration -> toA fire here.
  let tripwireResult = { unblocked: [], still_blocked: [], errors: [] };
  try {
    const { evaluateDeferredTriggers } = require('./lib/cwos-tripwires');
    const wsDir = path.join(targetDir, '.claude', 'workstream');
    if (fs.existsSync(wsDir)) {
      tripwireResult = evaluateDeferredTriggers(wsDir, targetDir);
    }
  } catch (_e) { /* non-fatal — tripwires module may be absent in older repos */ }

  writeJson({
    ok: true,
    target: onboarding.path,
    from_archetype: fromA,
    to_archetype: toA,
    stage,
    diff_summary: {
      disappearing: diff.programs.disappearing.length,
      appearing: diff.programs.appearing.length,
      escalating: diff.programs.escalating.length,
      de_escalating: diff.programs.de_escalating.length,
      staying: diff.programs.staying.length,
    },
    archived_findings: archivedFindings,
    archived_items: archivedItems,
    tripwires: {
      unblocked_count: tripwireResult.unblocked.length,
      unblocked: tripwireResult.unblocked.map(u => ({ ws_id: u.ws_id, fired_because: u.fired_because })),
      still_blocked_count: tripwireResult.still_blocked.length,
      errors: tripwireResult.errors,
    },
    event_id: eventId,
  });
}

// ─── YAML patchers ────────────────────────────────────────────────────────

function patchScalarField(text, field, value) {
  const re = new RegExp(`^(${field.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}:[ \\t]*)([^\\n#]*?)([ \\t]*(?:#[^\\n]*)?)$`, 'm');
  if (re.test(text)) return text.replace(re, `$1${value}$3`);
  return text;
}

function appendArchetypeHistory(text, entry) {
  const headerRe = /^archetype_history:\s*(?:\[\])?\s*$/m;
  const lines = [
    `  - archetype: "${entry.archetype}"`,
    `    declared_at: "${entry.declared_at}"`,
    `    archived_at: "${entry.archived_at}"`,
    `    reason: ${JSON.stringify(entry.reason)}`,
  ].join('\n');

  if (headerRe.test(text)) {
    // Replace `archetype_history: []` with header + first entry, OR append under existing list.
    if (/^archetype_history:\s*\[\]\s*$/m.test(text)) {
      return text.replace(/^archetype_history:\s*\[\]\s*$/m, `archetype_history:\n${lines}`);
    }
    // Existing entries — find the LAST line that's part of the archetype_history
    // block (2+ space indent), insert the new entry immediately after it.
    // Walking past comments to the next top-level key would land the new entry
    // beyond an intervening comment block, separating it from its siblings.
    const headerStart = text.search(/^archetype_history:\s*\n/m);
    if (headerStart >= 0) {
      const allLines = text.split('\n');
      let headerLineIdx = -1;
      for (let i = 0; i < allLines.length; i++) {
        if (/^archetype_history:\s*$/.test(allLines[i])) { headerLineIdx = i; break; }
      }
      if (headerLineIdx >= 0) {
        let lastEntryLineIdx = headerLineIdx;
        for (let i = headerLineIdx + 1; i < allLines.length; i++) {
          // Only count lines that are part of YAML structure (not blank, not comment).
          if (allLines[i].trim() === '') continue;
          if (allLines[i].startsWith('#')) break; // comment ends the block
          if (/^[ \t]/.test(allLines[i])) lastEntryLineIdx = i; // indented = still part of block
          else break; // top-level key reached
        }
        // Insert new entry right after lastEntryLineIdx.
        allLines.splice(lastEntryLineIdx + 1, 0, lines);
        return allLines.join('\n');
      }
    }
  }
  // Field absent — append at end of file.
  return text + `\narchetype_history:\n${lines}\n`;
}

function replaceBundleBlock(text, bundle) {
  // Build the new block.
  const lines = [];
  lines.push('archetype_bundle_resolved:');
  lines.push(`  programs: [${(bundle.programs || []).map(p => `"${p}"`).join(', ')}]`);
  lines.push(`  engines: [${(bundle.engines || []).map(e => `"${e}"`).join(', ')}]`);
  lines.push(`  personas: [${(bundle.personas || []).map(p => `"${p}"`).join(', ')}]`);
  const tierIds = Object.keys(bundle.tiers || {}).sort();
  if (tierIds.length === 0) {
    lines.push('  tiers: {}');
  } else {
    lines.push('  tiers:');
    for (const id of tierIds) lines.push(`    ${id}: "${bundle.tiers[id]}"`);
  }
  lines.push(`  resolved_at: "${bundle.resolved_at || new Date().toISOString()}"`);
  const block = lines.join('\n');

  // Locate the existing bundle by header line (start-of-line + literal).
  // JS regex has no \Z anchor, so we walk the text manually for the next
  // top-level key after the header, treating EOF as the natural end.
  const headerRe = /^archetype_bundle_resolved:[ \t]*$/m;
  const headerMatch = text.match(headerRe);
  if (!headerMatch) return text + '\n\n' + block + '\n';

  const startIdx = headerMatch.index;
  const afterHeader = startIdx + headerMatch[0].length;
  // Find the next top-level YAML key (line starting with [A-Za-z_]).
  const nextKeyRe = /\n([A-Za-z_][A-Za-z0-9_]*:)/g;
  nextKeyRe.lastIndex = afterHeader;
  const nextKeyMatch = nextKeyRe.exec(text);
  const endIdx = nextKeyMatch ? nextKeyMatch.index + 1 : text.length; // +1 keeps the newline before the next key
  return text.slice(0, startIdx) + block + '\n' + text.slice(endIdx);
}

// ─── orphan archival ──────────────────────────────────────────────────────

function archiveOrphanFindings(targetDir, disappearingProgs, changeLabel) {
  const findingsDir = path.join(targetDir, '.claude', 'workstream', 'findings');
  if (!fs.existsSync(findingsDir)) return [];
  const archived = [];
  const progSet = new Set(disappearingProgs);
  for (const f of fs.readdirSync(findingsDir)) {
    if (!/^FIND-\d+\.yaml$/.test(f)) continue;
    const fp = path.join(findingsDir, f);
    let txt; try { txt = fs.readFileSync(fp, 'utf8'); } catch { continue; }
    const progMatch = txt.match(/^program:\s*"?([a-z0-9-]+)"?/m);
    const statusMatch = txt.match(/^status:\s*(\w+)/m);
    if (!progMatch || !progSet.has(progMatch[1])) continue;
    if (statusMatch && statusMatch[1] !== 'open') continue; // only archive open findings
    let patched = txt.replace(/^status:\s*(\w+)/m, 'status: archived');
    if (!/^archived_reason:/m.test(patched)) {
      patched += `archived_reason: "program_removed_via_re_archetype"\narchived_in_archetype_change: "${changeLabel}"\narchived_at: "${new Date().toISOString()}"\n`;
    }
    writeFileAtomic(fp, patched);
    archived.push(f.replace(/\.yaml$/, ''));
  }
  return archived;
}

function archiveOrphanQueueItems(targetDir, disappearingProgs, changeLabel) {
  const queueDir = path.join(targetDir, '.claude', 'workstream', 'queue');
  if (!fs.existsSync(queueDir)) return [];
  const archived = [];
  const progSet = new Set(disappearingProgs);
  for (const f of fs.readdirSync(queueDir)) {
    if (!/^WS-\d+\.yaml$/.test(f)) continue;
    const fp = path.join(queueDir, f);
    let txt; try { txt = fs.readFileSync(fp, 'utf8'); } catch { continue; }
    const progMatch = txt.match(/^program:\s*"?([a-z0-9-]+)"?/m);
    const statusMatch = txt.match(/^status:\s*(\w+)/m);
    if (!progMatch || !progSet.has(progMatch[1])) continue;
    if (statusMatch && (statusMatch[1] === 'done' || statusMatch[1] === 'archived')) continue;
    let patched = txt.replace(/^status:\s*(\w+)/m, 'status: archived');
    if (!/^archived_reason:/m.test(patched)) {
      patched += `archived_reason: "program_removed_via_re_archetype"\narchived_in_archetype_change: "${changeLabel}"\narchived_at: "${new Date().toISOString()}"\n`;
    }
    writeFileAtomic(fp, patched);
    archived.push(f.replace(/\.yaml$/, ''));
  }
  return archived;
}

// ─── entry ────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  switch (sub) {
    case 'diff':   return cmdDiff(args.slice(1));
    case 'apply':  return cmdApply(args.slice(1));
    case '--help': case '-h': case undefined:
      process.stderr.write(
        'usage: cwos-rearchetype <diff|apply> [options]\n' +
        '  diff   --from <A?> --to <A?> [--target-dir <p>] [--stage <S?>]\n' +
        '  apply  --to <A?> --target-dir <p> [--reason "..."] [--keep-orphan-findings]\n'
      );
      process.exit(sub === undefined ? 2 : 0);
      return;
    default: dieWith(2, `unknown subcommand: ${sub}`);
  }
}

if (require.main === module) main();

module.exports = { cmdDiff, cmdApply, computeDiff, appendArchetypeHistory, replaceBundleBlock };
