#!/usr/bin/env node
/**
 * cwos-registry-paths — file-exists validator for path-bearing registry fields.
 *
 * Closes the kit_registry_drift class: registry sync `--check` only detects
 * MISSING entries, never whether a present entry's `skill_path` actually
 * RESOLVES to a file on disk. After a kit upgrade relocates engine files (the
 * recurring `skill_path` drift), the registry can still list a dead path. This
 * walks every path-bearing field and asserts the target exists.
 *
 * Path-bearing fields (engines/registry.yaml or .claude/workstream/engines/registry.yaml):
 *   - skill_path           literal repo-relative path (REQUIRED to resolve)
 *   - procedure            → engines/procedures/<x>.md  (checked iff that dir exists)
 *   - extends              → engines/base/<x>.md        (checked iff that dir exists)
 *   - command_path/agent_path/persona_path  literal paths (future-proofing)
 *
 * Used by /kit-upgrade's post-upgrade validation gate (hard error on any
 * unresolved path) and reusable by /audit.
 *
 * Usage: node kit/scripts/lib/cwos-registry-paths.js [--path <repo-root>] [--json]
 *   exits 1 if any path is unresolved, 0 otherwise.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { readYAMLFile } = require('./cwos-utils');

const ENGINE_REGISTRY_LOCATIONS = [
  '.claude/workstream/engines/registry.yaml', // adopted repos + HomeBase
  'engines/registry.yaml',                    // legacy / alternate layout
];

const LITERAL_PATH_FIELDS = ['skill_path', 'command_path', 'agent_path', 'persona_path'];

function isFile(abs) {
  try { return fs.statSync(abs).isFile(); } catch { return false; }
}

function fwd(p) { return p.replace(/\\/g, '/'); }

/**
 * Validate every path-bearing registry field under repoRoot.
 * @returns {{ ok:boolean, checked:number, unresolved:Array, registries:string[], skipped:Array }}
 */
function validateRegistryPaths(repoRoot, opts = {}) {
  const root = path.resolve(repoRoot || process.cwd());
  const out = { ok: true, checked: 0, unresolved: [], registries: [], skipped: [] };

  const hasProcedures = fs.existsSync(path.join(root, 'engines', 'procedures'));
  const hasBase = fs.existsSync(path.join(root, 'engines', 'base'));

  const seen = new Set();
  for (const rel of ENGINE_REGISTRY_LOCATIONS) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs) || seen.has(fwd(rel))) continue;
    seen.add(fwd(rel));
    const { ok, data } = readYAMLFile(abs);
    if (!ok || !data || !data.engines || typeof data.engines !== 'object') continue;
    out.registries.push(fwd(rel));

    for (const [engine, entry] of Object.entries(data.engines)) {
      if (!entry || typeof entry !== 'object') continue;

      for (const field of LITERAL_PATH_FIELDS) {
        const val = entry[field];
        if (typeof val !== 'string' || !val.trim()) continue;
        out.checked++;
        if (!isFile(path.join(root, val))) {
          out.unresolved.push({ registry: fwd(rel), engine, field, path: fwd(val) });
        }
      }

      if (typeof entry.procedure === 'string' && entry.procedure.trim()) {
        const rp = fwd(path.join('engines', 'procedures', `${entry.procedure}.md`));
        if (hasProcedures) {
          out.checked++;
          if (!isFile(path.join(root, rp))) {
            out.unresolved.push({ registry: fwd(rel), engine, field: 'procedure', path: rp });
          }
        } else {
          out.skipped.push({ engine, field: 'procedure', reason: 'engines/procedures/ not present in repo' });
        }
      }

      if (typeof entry.extends === 'string' && entry.extends.trim()) {
        const rp = fwd(path.join('engines', 'base', `${entry.extends}.md`));
        if (hasBase) {
          out.checked++;
          if (!isFile(path.join(root, rp))) {
            out.unresolved.push({ registry: fwd(rel), engine, field: 'extends', path: rp });
          }
        } else {
          out.skipped.push({ engine, field: 'extends', reason: 'engines/base/ not present in repo' });
        }
      }
    }
  }

  out.ok = out.unresolved.length === 0;
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  let root = process.cwd();
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--path' && argv[i + 1]) root = argv[++i];
    else if (argv[i] === '--json') json = true;
    else if (argv[i] === '--help' || argv[i] === '-h') {
      process.stdout.write('Usage: cwos-registry-paths.js [--path <repo-root>] [--json]\n');
      process.exit(0);
    }
  }
  const res = validateRegistryPaths(root);
  if (json) {
    process.stdout.write(JSON.stringify(res) + '\n');
  } else if (res.ok) {
    process.stdout.write(`Registry paths OK — ${res.checked} path(s) checked across ${res.registries.length} registr(ies).\n`);
  } else {
    process.stderr.write(`Registry path drift — ${res.unresolved.length} unresolved path(s):\n`);
    for (const u of res.unresolved) {
      process.stderr.write(`  ${u.registry} :: ${u.engine}.${u.field} → ${u.path} (missing)\n`);
    }
  }
  process.exit(res.ok ? 0 : 1);
}

module.exports = { validateRegistryPaths };

if (require.main === module) main();
