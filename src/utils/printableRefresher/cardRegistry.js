/**
 * cardRegistry.js — Printable Refresher manifest barrel.
 *
 * Loads every JSON manifest under `./manifests/` at build time via Vite's
 * `import.meta.glob` and exposes them as a stable, sorted array. This is the
 * single entry point for the content-drift CI suite (`contentDrift.test.js`)
 * and the runtime surface (`PrintableRefresherView`).
 *
 * Sorting by `cardId` is required so test iteration order is deterministic
 * across machines and snapshot tests stay byte-stable.
 *
 * Spec: docs/projects/printable-refresher/content-drift-ci.md §Directory + file layout
 *       docs/projects/printable-refresher/content-drift-ci.md §Manifest shape
 */

const modules = import.meta.glob('./manifests/*.json', { eager: true });

function buildEntries() {
  const out = [];
  for (const [path, mod] of Object.entries(modules)) {
    const filename = path.split('/').pop();
    const slug = filename.replace(/\.json$/, '');
    const manifest = mod && typeof mod === 'object' && 'default' in mod ? mod.default : mod;
    out.push({ path, filename, slug, manifest });
  }
  out.sort((a, b) => a.manifest.cardId.localeCompare(b.manifest.cardId));
  return out;
}

const entries = buildEntries();

export const manifestEntries = entries;
export const manifests = entries.map((e) => e.manifest);
export const manifestsByCardId = Object.fromEntries(
  entries.map((e) => [e.manifest.cardId, e.manifest])
);

export const CARD_CLASS_VALUES = ['preflop', 'math', 'equity', 'exceptions'];
export const PHASE_VALUES = ['A', 'B', 'C'];
export const TIER_VALUES = ['free', 'plus'];
export const ATOMICITY_WORD_COUNT_MAX = 25;

export const FIDELITY_KEYS = [
  'F1_no_archetype_as_input',
  'F2_math_visible',
  'F3_scenario_declared',
  'F4_source_trail_footer',
  'F5_pure_exception_provenance_unambiguous',
  'F6_prescriptions_computed',
];
