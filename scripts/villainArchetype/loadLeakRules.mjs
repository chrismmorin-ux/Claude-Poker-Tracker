/**
 * loadLeakRules.mjs — the node-side equivalent of the browser's `import.meta.glob` registry.
 *
 * `heroLeakDetector.js` finds its rules with a Vite transform, which does not exist in Node.
 * Rather than hand-maintain a barrel file — which would break "adding a rule is adding a file,
 * the detector never changes", principle #1 in `skillAssessment/CLAUDE.md` — this reads the same
 * directory and dynamically imports what it finds. A new rule file is picked up by both
 * environments with no registration step in either.
 *
 * The loop the rules are fed to is shared (`detectWithRules.js`); only the discovery differs.
 */

import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const LEAK_RULES_DIR = join(HERE, '..', '..', 'src', 'utils', 'skillAssessment', 'leakRules');

/**
 * Load every leak rule, sorted by id for deterministic iteration.
 *
 * `_template.js` is excluded for the same reason the browser registry excludes it: it is a
 * worked example, not a rule, and firing it would produce a leak nobody wrote.
 */
export const loadLeakRules = async (dir = LEAK_RULES_DIR) => {
  const files = (await readdir(dir))
    .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
    .sort();

  const rules = [];
  const skipped = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(join(dir, file)).href);
    if (!mod?.rule) {
      // Mirrors the browser registry's behaviour: warn and skip rather than throw, so one
      // malformed file cannot take down a review that the other rules could still produce.
      skipped.push({ file, reason: 'no exported `rule`' });
      continue;
    }
    rules.push(mod.rule);
  }
  rules.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return { rules, skipped };
};
