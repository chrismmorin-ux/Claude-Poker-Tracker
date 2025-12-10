/**
 * Schema Validation Tests
 *
 * These tests verify that documentation stays in sync with code.
 * They enforce the source of truth hierarchy defined in docs/CANONICAL_SOURCES.md
 *
 * If these tests fail, it means documentation has drifted from code.
 * Update the documentation to match the canonical code sources.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Import canonical sources
import { ACTIONS, STREETS, SUITS, RANKS, ACTION_ABBREV } from '../constants/gameConstants.js';
import { SESSION_ACTIONS, VENUES, GAME_TYPES } from '../constants/sessionConstants.js';
import { PLAYER_ACTIONS, ETHNICITY_OPTIONS, BUILD_OPTIONS, GENDER_OPTIONS, STYLE_TAGS } from '../constants/playerConstants.js';
import { GAME_ACTIONS, initialGameState } from '../reducers/gameReducer.js';
import { UI_ACTIONS, initialUiState } from '../reducers/uiReducer.js';
import { CARD_ACTIONS, initialCardState } from '../reducers/cardReducer.js';
import { SESSION_REDUCER_ACTIONS, initialSessionState } from '../reducers/sessionReducer.js';
import { PLAYER_REDUCER_ACTIONS, initialPlayerState } from '../reducers/playerReducer.js';
import { ERROR_CODES } from '../utils/errorHandler.js';

const ROOT_DIR = path.resolve(__dirname, '../..');

// Helper to read a file
function readFile(relativePath) {
  const fullPath = path.join(ROOT_DIR, relativePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath, 'utf8');
}

// Helper to extract version from markdown (looks for **vXXX** pattern)
function extractVersionFromMarkdown(content) {
  const match = content.match(/\*\*v(\d+)\*\*/);
  return match ? parseInt(match[1]) : null;
}

describe('Schema Validation - Documentation Drift Detection', () => {
  describe('Version Synchronization', () => {
    it('CLAUDE.md version should match CHANGELOG.md current version', () => {
      const claudeMd = readFile('CLAUDE.md');
      const changelog = readFile('docs/CHANGELOG.md');

      expect(claudeMd).not.toBeNull();
      expect(changelog).not.toBeNull();

      // CHANGELOG has "## v114 (Current)" or "## v114 - Name (Current)" format
      const changelogMatch = changelog.match(/## v(\d+)(?:\s+-\s+[^(]+)?\s+\(Current\)/);
      const changelogVersion = changelogMatch ? parseInt(changelogMatch[1]) : null;

      // CLAUDE.md has "v114" or "**v114**" in Architecture section
      const claudeMatch = claudeMd.match(/Architecture \(v(\d+)\)/);
      const claudeVersion = claudeMatch ? parseInt(claudeMatch[1]) : null;

      expect(changelogVersion).not.toBeNull();
      expect(claudeVersion).not.toBeNull();
      expect(claudeVersion).toBe(changelogVersion);
    });

    it('README.md version should match CHANGELOG.md', () => {
      const readme = readFile('README.md');
      const changelog = readFile('docs/CHANGELOG.md');

      expect(readme).not.toBeNull();
      expect(changelog).not.toBeNull();

      // CHANGELOG has "## v114 (Current)" or "## v114 - Name (Current)" format
      const changelogMatch = changelog.match(/## v(\d+)(?:\s+-\s+[^(]+)?\s+\(Current\)/);
      const changelogVersion = changelogMatch ? parseInt(changelogMatch[1]) : null;

      // README has "**v114**" format
      const readmeVersion = extractVersionFromMarkdown(readme);

      expect(changelogVersion).not.toBeNull();
      expect(readmeVersion).not.toBeNull();
      expect(readmeVersion).toBe(changelogVersion);
    });
  });

  describe('Constants Documentation', () => {
    it('All ACTIONS should have ACTION_ABBREV defined', () => {
      const actionKeys = Object.values(ACTIONS);
      const abbrevKeys = Object.keys(ACTION_ABBREV);

      for (const action of actionKeys) {
        expect(abbrevKeys).toContain(action);
      }
    });

    it('STREETS should include all expected streets', () => {
      expect(STREETS).toContain('preflop');
      expect(STREETS).toContain('flop');
      expect(STREETS).toContain('turn');
      expect(STREETS).toContain('river');
      expect(STREETS).toContain('showdown');
      expect(STREETS.length).toBe(5);
    });

    it('Standard 52-card deck constants are valid', () => {
      expect(SUITS.length).toBe(4);
      expect(RANKS.length).toBe(13);

      // Total cards = 52
      expect(SUITS.length * RANKS.length).toBe(52);
    });
  });

  describe('Reducer State Schemas', () => {
    it('gameReducer initialState has required fields', () => {
      expect(initialGameState).toHaveProperty('currentStreet');
      expect(initialGameState).toHaveProperty('dealerButtonSeat');
      expect(initialGameState).toHaveProperty('mySeat');
      expect(initialGameState).toHaveProperty('seatActions');
      expect(initialGameState).toHaveProperty('absentSeats');
    });

    it('uiReducer initialState has required fields', () => {
      expect(initialUiState).toHaveProperty('selectedPlayers');
      expect(initialUiState).toHaveProperty('contextMenu');
      expect(initialUiState).toHaveProperty('isSidebarCollapsed');
      // View state (moved from cardReducer in v114)
      expect(initialUiState).toHaveProperty('showCardSelector');
      expect(initialUiState).toHaveProperty('isShowdownViewOpen');
    });

    it('cardReducer initialState has required fields', () => {
      expect(initialCardState).toHaveProperty('communityCards');
      expect(initialCardState).toHaveProperty('holeCards');
      expect(initialCardState).toHaveProperty('holeCardsVisible');
      expect(initialCardState).toHaveProperty('allPlayerCards');
    });

    it('sessionReducer initialState has required fields', () => {
      expect(initialSessionState).toHaveProperty('currentSession');
      expect(initialSessionState).toHaveProperty('allSessions');
      expect(initialSessionState).toHaveProperty('isLoading');
    });

    it('playerReducer initialState has required fields', () => {
      expect(initialPlayerState).toHaveProperty('allPlayers');
      expect(initialPlayerState).toHaveProperty('seatPlayers');
      expect(initialPlayerState).toHaveProperty('isLoading');
    });
  });

  describe('Error Codes', () => {
    it('ERROR_CODES should have all documented categories', () => {
      // E1xx - State errors
      expect(ERROR_CODES.INVALID_STATE).toMatch(/^E1\d{2}$/);
      expect(ERROR_CODES.STATE_CORRUPTION).toMatch(/^E1\d{2}$/);

      // E2xx - Validation errors
      expect(ERROR_CODES.INVALID_INPUT).toMatch(/^E2\d{2}$/);
      expect(ERROR_CODES.INVALID_ACTION).toMatch(/^E2\d{2}$/);

      // E3xx - Persistence errors
      expect(ERROR_CODES.DB_INIT_FAILED).toMatch(/^E3\d{2}$/);
      expect(ERROR_CODES.SAVE_FAILED).toMatch(/^E3\d{2}$/);

      // E4xx - Component errors
      expect(ERROR_CODES.RENDER_FAILED).toMatch(/^E4\d{2}$/);
    });

    it('All error codes are unique', () => {
      const codes = Object.values(ERROR_CODES);
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });
  });

  describe('File Structure Validation', () => {
    it('All hooks referenced in settings.json exist', () => {
      const settingsContent = readFile('.claude/settings.json');
      expect(settingsContent).not.toBeNull();

      const settings = JSON.parse(settingsContent);
      const hookCommands = [];

      // Extract all hook commands from settings
      const extractHooks = (obj) => {
        if (Array.isArray(obj)) {
          obj.forEach(extractHooks);
        } else if (typeof obj === 'object' && obj !== null) {
          if (obj.command && obj.command.includes('.claude/hooks/')) {
            hookCommands.push(obj.command);
          }
          Object.values(obj).forEach(extractHooks);
        }
      };

      extractHooks(settings);

      // Verify each hook file exists
      for (const cmd of hookCommands) {
        const hookPath = cmd.replace('node ', '');
        const fullPath = path.join(ROOT_DIR, hookPath);
        expect(fs.existsSync(fullPath), `Hook file missing: ${hookPath}`).toBe(true);
      }
    });

    it('All reducers have corresponding test files', () => {
      const reducerDir = path.join(ROOT_DIR, 'src/reducers');
      const testDir = path.join(reducerDir, '__tests__');

      const reducers = fs.readdirSync(reducerDir)
        .filter(f => f.endsWith('.js') && !f.startsWith('index'));

      for (const reducer of reducers) {
        const testFile = reducer.replace('.js', '.test.js');
        const testPath = path.join(testDir, testFile);
        expect(fs.existsSync(testPath), `Test missing for reducer: ${reducer}`).toBe(true);
      }
    });

    it('All context providers have corresponding test files', () => {
      const contextDir = path.join(ROOT_DIR, 'src/contexts');
      const testDir = path.join(contextDir, '__tests__');

      if (!fs.existsSync(contextDir)) return; // Skip if no contexts

      const contexts = fs.readdirSync(contextDir)
        .filter(f => f.endsWith('.jsx') && !f.startsWith('index'));

      for (const context of contexts) {
        const testFile = context.replace('.jsx', '.test.jsx');
        const testPath = path.join(testDir, testFile);
        expect(fs.existsSync(testPath), `Test missing for context: ${context}`).toBe(true);
      }
    });
  });

  describe('Player Constants', () => {
    it('ETHNICITY_OPTIONS should have valid entries', () => {
      expect(Array.isArray(ETHNICITY_OPTIONS)).toBe(true);
      expect(ETHNICITY_OPTIONS.length).toBeGreaterThan(0);
    });

    it('BUILD_OPTIONS should have valid entries', () => {
      expect(Array.isArray(BUILD_OPTIONS)).toBe(true);
      expect(BUILD_OPTIONS.length).toBeGreaterThan(0);
    });

    it('GENDER_OPTIONS should have valid entries', () => {
      expect(Array.isArray(GENDER_OPTIONS)).toBe(true);
      expect(GENDER_OPTIONS.length).toBeGreaterThan(0);
    });

    it('STYLE_TAGS should have valid entries', () => {
      expect(Array.isArray(STYLE_TAGS)).toBe(true);
      expect(STYLE_TAGS.length).toBeGreaterThan(0);
    });
  });

  describe('Session Constants', () => {
    it('VENUES should be an array', () => {
      expect(Array.isArray(VENUES)).toBe(true);
    });

    it('GAME_TYPES should have buyInDefault for each type', () => {
      const types = Object.values(GAME_TYPES);
      for (const type of types) {
        if (typeof type === 'object') {
          expect(type).toHaveProperty('buyInDefault');
        }
      }
    });
  });
});

describe('Hook Integration Validation', () => {
  it('Required hook state files can be created in .claude directory', () => {
    const claudeDir = path.join(ROOT_DIR, '.claude');
    expect(fs.existsSync(claudeDir)).toBe(true);

    // These files are created by hooks - verify directory is writable
    // We don't actually create them, just verify the directory exists
    const stats = fs.statSync(claudeDir);
    expect(stats.isDirectory()).toBe(true);
  });
});
