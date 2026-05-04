/**
 * @file SCF lesson registry — loads all lessons from
 * docs/projects/self-coach-foundation/lessons/ at build time via Vite's
 * import.meta.glob. Mirrors the heroState/loadTemplates.js pattern.
 *
 * Per docs/projects/self-coach-foundation/lesson-authoring-template.md spec.
 *
 * Per src/utils/skillAssessment/CLAUDE.md source-util-policy whitelist:
 *   READ-ALLOWED surfaces: HandReplayView (Drill-this affordance),
 *   SelfCoachView (Curriculum section, future).
 *   BLACKLISTED: live-table surfaces.
 *
 * SPR-032 / WS-147 (2026-05-03).
 */

import { parseFrontmatter } from '../heroState/parseFrontmatter.js';

const rawLessons = import.meta.glob(
  '../../../docs/projects/self-coach-foundation/lessons/*.md',
  { eager: true, query: '?raw', import: 'default' },
);

const SECTION_PATTERN = /^##\s+(Exposition|Worked example|Success criteria)\s*\r?\n/gm;

const parseSections = (body) => {
  const sections = { exposition: '', workedExample: '', successCriteria: '' };
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
      : 'exposition';
    sections[key] = content;
  }
  return sections;
};

const buildLessons = () => {
  const map = new Map();
  for (const [path, raw] of Object.entries(rawLessons)) {
    if (typeof raw !== 'string') continue;
    const { meta, body } = parseFrontmatter(raw);
    if (!meta.conceptId) {
      // eslint-disable-next-line no-console
      console.warn(`[skillAssessment] Lesson ${path} missing conceptId frontmatter; skipping`);
      continue;
    }
    map.set(meta.conceptId, { meta, sections: parseSections(body), path });
  }
  return map;
};

const lessons = buildLessons();

/**
 * Look up a lesson by conceptId.
 *
 * @param {string} conceptId - kebab-case ID matching the lesson file.
 * @returns {{meta: object, sections: {exposition: string, workedExample: string, successCriteria: string}, path: string}|null}
 */
export const getLesson = (conceptId) => lessons.get(conceptId) || null;

/**
 * @returns {string[]} - All loaded conceptIds (for diagnostics + tests).
 */
export const listLoadedLessons = () => Array.from(lessons.keys()).sort();

/**
 * @returns {Array<object>} - All loaded lessons sorted by tier asc then conceptId asc.
 */
export const listLessonsForCurriculum = () => {
  const entries = Array.from(lessons.values());
  entries.sort((a, b) => {
    const tA = a.meta.tier ?? 99;
    const tB = b.meta.tier ?? 99;
    if (tA !== tB) return tA - tB;
    return (a.meta.conceptId || '').localeCompare(b.meta.conceptId || '');
  });
  return entries;
};
