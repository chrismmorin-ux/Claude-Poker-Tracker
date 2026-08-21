/**
 * build-stamp.test.js — provenance of the loaded artifact.
 *
 * WHY THIS EXISTS: on 2026-08-21 a live test cycle was spent on the wrong
 * build. The founder loaded `ignition-poker-tracker/dist/` — the canonical path
 * the docs name — and it held a build of a DIFFERENT branch's in-flight work:
 * none of the fixes under test, plus another session's half-finished changes.
 * The panel reported the bug faithfully and there was no way, from inside it,
 * to see that the code under test was not the code in question.
 *
 * The hazard had already been written down in prose ("dist/ was last built
 * 2026-08-04 and the source is two commits ahead"). Prose did not stop it.
 */

import { describe, it, expect } from 'vitest';
import { BUILD_STAMP, buildStampLine } from '../constants.js';

describe('build stamp', () => {
  it('falls back to a CONSPICUOUS marker when unbundled', () => {
    // In tests __BUILD_STAMP__ is never injected. The fallback must be
    // unmistakable: a dev/unbundled artifact passing for a real build is the
    // whole failure this guards against.
    expect(BUILD_STAMP.commit).toBe('UNBUILT');
    expect(BUILD_STAMP.sourceDir).toBe('UNBUILT');
    expect(BUILD_STAMP.builtAt).toBeNull();
  });

  it('renders the four fields needed to tell two builds apart', () => {
    const line = buildStampLine({
      version: '0.9.0',
      branch: 'worktree-sidebar-table-identity',
      commit: '76956d5',
      builtAt: '2026-08-21T17:21:00.000Z',
      sourceDir: 'sidebar-table-identity',
    });
    expect(line).toMatch(/0\.9\.0/);
    expect(line).toMatch(/worktree-sidebar-table-identity/);
    expect(line).toMatch(/76956d5/);
    expect(line).toMatch(/built \d{2}:\d{2}/);
  });

  it('shows sourceDir when it differs from the branch — the field that matters', () => {
    // sourceDir is what distinguishes the main checkout from a worktree, which
    // is exactly the confusion that occurred.
    const line = buildStampLine({
      version: '0.9.0', branch: 'main', commit: 'abc1234',
      builtAt: '2026-08-21T10:40:00.000Z', sourceDir: 'claude-poker-tracker',
    });
    expect(line).toMatch(/claude-poker-tracker\/main/);
  });

  it('does not repeat itself when sourceDir and branch agree', () => {
    const line = buildStampLine({
      version: '0.9.0', branch: 'feature-x', commit: 'abc1234',
      builtAt: '2026-08-21T10:40:00.000Z', sourceDir: 'feature-x',
    });
    expect(line).toMatch(/feature-x@abc1234/);
    expect(line).not.toMatch(/feature-x\/feature-x/);
  });

  it('two different builds never render the same line', () => {
    const a = buildStampLine({
      version: '0.9.0', branch: 'main', commit: 'aaa1111',
      builtAt: '2026-08-21T10:40:00.000Z', sourceDir: 'claude-poker-tracker',
    });
    const b = buildStampLine({
      version: '0.9.0', branch: 'worktree-sidebar-table-identity', commit: 'bbb2222',
      builtAt: '2026-08-21T12:21:00.000Z', sourceDir: 'sidebar-table-identity',
    });
    expect(a).not.toBe(b);
  });

  it('survives a malformed or missing stamp without throwing', () => {
    expect(() => buildStampLine({})).not.toThrow();
    expect(() => buildStampLine(null)).not.toThrow();
    expect(buildStampLine({ builtAt: 'not-a-date' })).toMatch(/built —/);
  });
});
