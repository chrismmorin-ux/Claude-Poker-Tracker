/**
 * @file useSyncBridgeImportPath.test.js — structural pin for the
 * extension-import → Online-classification chain.
 *
 * Per WS-080 / SPR-062 verify-and-pin: the SV-F7 Live/Online filter
 * relies on imported sessions carrying `source: 'ignition'`. The
 * investigation fork at SPR-062 confirmed the classification works
 * because both extension-import paths funnel through:
 *
 *   useSyncBridge.importHands  →  getOrCreateOnlineSession  →
 *   sessionsStorage.createOnlineSession  →  source: 'ignition'
 *
 * This test pins each link in that chain by source-grep so a future
 * refactor that replaces `getOrCreateOnlineSession` with a different
 * session-creation function that omits `source` (or that drops the
 * marker at the writer) is caught at CI time.
 *
 * The test does NOT mount the hook — it asserts the structural integrity
 * of the call chain via static reads. Equivalent to the WS-105 / SPR-043
 * boundary-hardening source-grep pattern.
 *
 * SPR-062 / WS-080.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const USE_SYNC_BRIDGE_PATH = path.join(REPO_ROOT, 'src/hooks/useSyncBridge.js');
const SESSIONS_STORAGE_PATH = path.join(REPO_ROOT, 'src/utils/persistence/sessionsStorage.js');
const SESSIONS_VIEW_PATH = path.join(REPO_ROOT, 'src/components/views/SessionsView/SessionsView.jsx');

const readSource = (file) => fs.readFileSync(file, 'utf8');

describe('Online session classification chain (verify-and-pin SPR-062)', () => {
  describe('Link 1: useSyncBridge.importHands → getOrCreateOnlineSession', () => {
    it('useSyncBridge.js imports getOrCreateOnlineSession', () => {
      const src = readSource(USE_SYNC_BRIDGE_PATH);
      expect(src).toMatch(
        /import\s*\{[^}]*\bgetOrCreateOnlineSession\b[^}]*\}\s*from\s*['"][^'"]*sessionsStorage['"]/,
      );
    });

    it('useSyncBridge.js calls getOrCreateOnlineSession inside importHands', () => {
      const src = readSource(USE_SYNC_BRIDGE_PATH);
      // Find the importHands function body
      const importHandsMatch = src.match(/importHands\s*=\s*useCallback\(\s*async[\s\S]*?\}\s*,\s*\[[^\]]*\]\)\s*;/);
      expect(importHandsMatch).not.toBeNull();
      const body = importHandsMatch[0];
      // The session-resolution path inside importHands must call getOrCreateOnlineSession.
      expect(body).toMatch(/getOrCreateOnlineSession\s*\(/);
    });
  });

  describe('Link 2: getOrCreateOnlineSession → createOnlineSession', () => {
    it('sessionsStorage.js getOrCreateOnlineSession delegates to createOnlineSession', () => {
      const src = readSource(SESSIONS_STORAGE_PATH);
      // Locate the start of the function and scan the next 60 lines (covers
      // the function body without needing balanced-brace parsing).
      const lines = src.split('\n');
      const startIdx = lines.findIndex((line) =>
        /export\s+const\s+getOrCreateOnlineSession\s*=/.test(line),
      );
      expect(startIdx).toBeGreaterThan(-1);
      const window = lines.slice(startIdx, startIdx + 60).join('\n');
      expect(window).toMatch(/createOnlineSession\s*\(/);
    });
  });

  describe('Link 3: createOnlineSession sets source:"ignition"', () => {
    it('sessionsStorage.js createOnlineSession assigns source: "ignition"', () => {
      const src = readSource(SESSIONS_STORAGE_PATH);
      // createOnlineSession is a regular function declaration in sessionsStorage.js
      const fnMatch = src.match(/function\s+createOnlineSession\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
      expect(fnMatch).not.toBeNull();
      const body = fnMatch[0];
      expect(body).toMatch(/source:\s*['"]ignition['"]/);
    });
  });

  describe('Link 4: SessionsView SV-F7 filter is consistent with the marker', () => {
    it('SessionsView.jsx imports matchesSessionsFilter (or has inline source-equality logic)', () => {
      const src = readSource(SESSIONS_VIEW_PATH);
      // Either imports the extracted util (preferred SPR-062 refactor) OR has the inline
      // 'ignition' source-equality logic. Both are acceptable; this asserts the
      // classification surface is wired to the marker.
      const usesExtractedUtil = /matchesSessionsFilter/.test(src);
      const hasInlineLogic = /source\s*===\s*['"]ignition['"]/.test(src) ||
                             /source\s*!==\s*['"]ignition['"]/.test(src);
      expect(usesExtractedUtil || hasInlineLogic).toBe(true);
    });
  });
});
