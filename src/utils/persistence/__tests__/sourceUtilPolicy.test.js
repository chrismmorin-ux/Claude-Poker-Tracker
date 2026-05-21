/**
 * @file sourceUtilPolicy.test.js — CI-grep enforcement of the source-util-policy
 * whitelist for PIO + SCF modules.
 *
 * Per `src/utils/skillAssessment/CLAUDE.md` source-util-policy + AP-PIO-02:
 *   PIO modules (sightingLogsStore, playerPhotosStore, playerMatching/*,
 *   PlayerProfileView, PlayerEditorView/* PIO sections) MUST NOT be
 *   imported by blacklisted live-table surfaces:
 *     - OnlineView, sidebar HUD, TableView, TournamentView, ShowdownView
 *
 *   SCF modules (skillAssessment/*, useHeroLeaks, hero-leak detection
 *   pipeline) have the same blacklist (already documented in
 *   src/utils/skillAssessment/CLAUDE.md).
 *
 * This test scans every component file under blacklisted surface paths and
 * fails if any import string references a PIO or SCF module.
 *
 * SPR-036 / WS-165 (2026-05-04).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '../../../..');

// Blacklisted surface roots — files under these MUST NOT import from
// PIO/SCF modules. Each entry is a directory relative to src/.
const BLACKLISTED_ROOTS = [
  'src/components/views/OnlineView',
  'src/components/views/TableView',
  'src/components/views/TournamentView',
  'src/components/views/ShowdownView',
  // sidebar HUD (Ignition extension is a separate workspace; not scanned here)
];

// Forbidden import substrings. If a blacklisted file's source contains any of
// these (in an import line), the test fails.
const FORBIDDEN_IMPORTS = [
  // PIO data layer
  'persistence/sightingLogsStore',
  'persistence/playerPhotosStore',
  'utils/playerMatching/',
  // PIO surfaces
  'PlayerProfileView',
  'PlayerFinderView',
  'PlayerEditorView/AgeDecadeSection',
  // SCF data layer + utilities (already documented in skillAssessment/CLAUDE.md)
  'persistence/heroLeaksStore',
  'utils/skillAssessment/',
  'hooks/useHeroLeaks',
  'hooks/useHeroLeakDetection',
  // EAL Calibration Dashboard study surface (WS-169 / SPR-066, 2026-05-09).
  // Per Gate 1 audit condition C3: study-mode calibration state must NEVER leak
  // into live-table surfaces (AP-07). Anchor Library is a study surface and
  // remains importable here; only CalibrationDashboardView + its dashboard
  // hook are forbidden.
  'CalibrationDashboardView',
  'hooks/useCalibrationDashboard',
];

const collectFiles = (rootDir, exts = ['.js', '.jsx']) => {
  if (!fs.existsSync(rootDir)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
      } else if (exts.some((e) => entry.name.endsWith(e))) {
        out.push(full);
      }
    }
  };
  walk(rootDir);
  return out;
};

const findForbiddenImports = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const violations = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // Match `import` lines and `require` calls.
    if (!/^\s*import\s|require\s*\(/.test(line)) continue;
    for (const forbidden of FORBIDDEN_IMPORTS) {
      if (line.includes(forbidden)) {
        violations.push({ line: i + 1, content: line.trim(), forbidden });
      }
    }
  }
  return violations;
};

describe('source-util-policy — PIO + SCF blacklist enforcement', () => {
  for (const rootRel of BLACKLISTED_ROOTS) {
    const rootAbs = path.join(REPO_ROOT, rootRel);
    const files = collectFiles(rootAbs);

    describe(`${rootRel}`, () => {
      if (files.length === 0) {
        it('directory exists OR is intentionally absent', () => {
          // If the directory is missing, that's fine — nothing to scan.
          expect(true).toBe(true);
        });
        return;
      }

      it(`no file imports a PIO/SCF module (${files.length} files scanned)`, () => {
        const allViolations = [];
        for (const f of files) {
          const violations = findForbiddenImports(f);
          for (const v of violations) {
            allViolations.push(`${path.relative(REPO_ROOT, f)}:${v.line} — imports "${v.forbidden}" via: ${v.content}`);
          }
        }
        expect(allViolations, allViolations.join('\n')).toEqual([]);
      });
    });
  }

  it('the blacklist + forbidden-imports lists are non-empty (sanity)', () => {
    expect(BLACKLISTED_ROOTS.length).toBeGreaterThan(0);
    expect(FORBIDDEN_IMPORTS.length).toBeGreaterThan(0);
  });
});
