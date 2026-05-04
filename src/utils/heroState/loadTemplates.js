/**
 * @file Loads HSP narrative templates at build time via Vite's `import.meta.glob`.
 *
 * Loads all 18 templates from docs/design/hero-state-templates/{preflop,flop}/*.md
 * at build time (zero runtime fetch), parses each into {meta, sections},
 * and exposes a Map keyed by archetypeId.
 *
 * Pattern follows src/utils/printableRefresher/cardRegistry.js:16 — the
 * established convention in this repo for bundling structured assets.
 *
 * The path crosses out of src/ via `../../../docs/...` — Vite resolves
 * upward from this file's location and bundles the matched files at build.
 */

import { parseFrontmatter } from './parseFrontmatter.js';

// Import all 18 templates as raw strings at build time.
// `as: 'raw'` returns the file content as a string instead of a parsed module.
const rawTemplates = import.meta.glob(
  '../../../docs/design/hero-state-templates/{preflop,flop}/*.md',
  { eager: true, query: '?raw', import: 'default' },
);

const SECTION_PATTERN = /^##\s+(Headline|Body|Branch summary)\s*\r?\n([\s\S]*?)(?=^##\s|\Z)/gm;

/**
 * Parse the body markdown into {headline, body, branchSummary} sections.
 * Each section's content is extracted between `## SectionName` markers.
 */
const parseSections = (body) => {
  const sections = { headline: '', body: '', branchSummary: '' };
  const matches = [...body.matchAll(/^##\s+(Headline|Body|Branch summary)\s*\r?\n/gm)];

  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const sectionName = m[1];
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    const content = body.slice(start, end).trim();

    const key = sectionName === 'Branch summary' ? 'branchSummary'
      : sectionName.toLowerCase();
    sections[key] = content;
  }

  return sections;
};

const buildTemplates = () => {
  const map = new Map();
  for (const [path, raw] of Object.entries(rawTemplates)) {
    if (typeof raw !== 'string') continue;
    const { meta, body } = parseFrontmatter(raw);
    if (!meta.archetypeId) {
      // eslint-disable-next-line no-console
      console.warn(`HSP loadTemplates: ${path} missing archetypeId frontmatter; skipping`);
      continue;
    }
    const sections = parseSections(body);
    map.set(meta.archetypeId, { meta, sections, path });
  }
  return map;
};

const templates = buildTemplates();

/**
 * Look up a template by archetypeId.
 *
 * @param {string} archetypeId - One of ARCHETYPE_IDS from types.js.
 * @returns {{meta: object, sections: {headline: string, body: string, branchSummary: string}, path: string}}
 * @throws {Error} when no template registered for archetypeId
 */
export const loadTemplate = (archetypeId) => {
  const t = templates.get(archetypeId);
  if (!t) {
    throw new Error(`HSP loadTemplate: no template for archetypeId="${archetypeId}"`);
  }
  return t;
};

/**
 * @returns {string[]} - All loaded archetypeIds (for diagnostics + tests).
 */
export const listLoadedArchetypeIds = () => Array.from(templates.keys()).sort();
