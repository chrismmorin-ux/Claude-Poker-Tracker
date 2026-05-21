/**
 * lessonRegistry.js — SLS lesson loader.
 *
 * Loads all lessons from `docs/projects/poker-shape-language/lessons/`
 * at build time via Vite's `import.meta.glob`. Mirrors the SCF lesson
 * registry shape (`src/utils/skillAssessment/lessonRegistry.js`) but
 * keys by `descriptorId` (matching `SHAPE_DESCRIPTOR_CATALOG`) rather
 * than `conceptId`. Adds a Drill spots section parser so a single
 * lesson markdown can carry both reference content and graded drill
 * material for the future LessonRunnerView Deliberate/Discover
 * variants.
 *
 * Source-util-policy: read-allowed surfaces are study-mode only —
 * HandReplayView (for the lesson lookup affordance once it ships) and
 * the future LessonRunnerView. Live-table surfaces MUST NOT import.
 *
 * Per `docs/design/contracts/shape-mastery.md` — this module is
 * read-only; it never dispatches or writes IDB.
 *
 * SLS Stream B1 — WS-041 / SPR-082.
 */

import { parseFrontmatter } from '../heroState/parseFrontmatter';

const rawLessons = import.meta.glob(
  '../../../docs/projects/poker-shape-language/lessons/*.md',
  { eager: true, query: '?raw', import: 'default' },
);

const SECTION_PATTERN = /^##\s+(Exposition|Worked example|Success criteria|Drill spots)\s*\r?\n/gm;

const parseSections = (body) => {
  const sections = {
    exposition: '',
    workedExample: '',
    successCriteria: '',
    drillSpots: '',
  };
  if (typeof body !== 'string') return sections;
  const matches = [...body.matchAll(SECTION_PATTERN)];
  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const sectionName = m[1];
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    const content = body.slice(start, end).trim();
    const key = sectionName === 'Worked example' ? 'workedExample'
      : sectionName === 'Success criteria' ? 'successCriteria'
      : sectionName === 'Drill spots' ? 'drillSpots'
      : 'exposition';
    sections[key] = content;
  }
  return sections;
};

/**
 * Parse the Drill spots section body into a list of structured drill
 * entries. The Drill spots section uses a lightweight bullet format:
 *
 *   - **Spot 1.** Range: "<range string>". Correct prototype: <label>.
 *     Reasoning: <one-sentence explanation>.
 *
 * Returns `[]` when the section is empty or unparseable. The format is
 * intentionally human-authorable; we extract structured fields when
 * present and pass the raw content otherwise.
 */
const parseDrillSpots = (drillSpotsBody) => {
  if (typeof drillSpotsBody !== 'string' || !drillSpotsBody.trim()) return [];
  // Split on `- **Spot N.**` markers — each marker begins a new spot.
  const spotPattern = /^-\s+\*\*Spot\s+\d+\.\*\*/gm;
  const indices = [];
  let m;
  while ((m = spotPattern.exec(drillSpotsBody)) !== null) {
    indices.push(m.index);
  }
  if (indices.length === 0) return [];
  const spots = [];
  for (let i = 0; i < indices.length; i += 1) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : drillSpotsBody.length;
    const block = drillSpotsBody.slice(start, end).trim();
    const rangeMatch = block.match(/Range:\s*["“]([^"”]+)["”]/i);
    const labelMatch = block.match(/Correct\s+prototype:\s*([a-z]+)/i);
    const reasoningMatch = block.match(/Reasoning:\s*([^\n]+(?:\n\s+[^\n]+)*)/i);
    spots.push({
      index: spots.length + 1,
      range: rangeMatch ? rangeMatch[1].trim() : null,
      correctLabel: labelMatch ? labelMatch[1].trim().toLowerCase() : null,
      reasoning: reasoningMatch ? reasoningMatch[1].trim() : null,
      raw: block,
    });
  }
  return spots;
};

const buildLessons = () => {
  const map = new Map();
  for (const [path, raw] of Object.entries(rawLessons)) {
    if (typeof raw !== 'string') continue;
    const { meta, body } = parseFrontmatter(raw);
    if (!meta.descriptorId) {
      // eslint-disable-next-line no-console
      console.warn(`[shapeLanguage] Lesson ${path} missing descriptorId frontmatter; skipping`);
      continue;
    }
    const sections = parseSections(body);
    const drillSpots = parseDrillSpots(sections.drillSpots);
    map.set(meta.descriptorId, { meta, sections, drillSpots, path });
  }
  return map;
};

const lessons = buildLessons();

/**
 * Look up a lesson by descriptorId.
 *
 * @param {string} descriptorId - kebab-case ID matching
 *   `SHAPE_DESCRIPTOR_CATALOG[*].id`.
 * @returns {{
 *   meta: object,
 *   sections: { exposition: string, workedExample: string, successCriteria: string, drillSpots: string },
 *   drillSpots: Array<{ index: number, range: string|null, correctLabel: string|null, reasoning: string|null, raw: string }>,
 *   path: string,
 * } | null}
 */
export const getShapeLesson = (descriptorId) => lessons.get(descriptorId) || null;

/**
 * @returns {string[]} - All loaded descriptor IDs (for diagnostics + drift tests).
 */
export const getAllShapeLessons = () => Array.from(lessons.keys()).sort();
