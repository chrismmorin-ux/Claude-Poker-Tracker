/**
 * runtimeVersions.js — engine + app version constants for lineage footers.
 *
 * Used by:
 *   - `PrintConfirmationModal` to populate the W-URC-3 `engineVersion` +
 *     `appVersion` fields on `recordPrintBatch` payloads.
 *   - `PrintPreview` to thread the `runtime` prop through `ClassDispatchedTemplate`
 *     so the on-screen 7-field lineage footer shows real values (not the
 *     'unknown-engine' / 'unknown-app' fallbacks from `lineage.js`).
 *
 * Co-versioned with the npm package version + the architectural app version
 * tracked in CLAUDE.md. Engine version is currently the same as app version
 * because the engine is co-versioned (no separate semver). If the engine ever
 * gains an independent release cycle, split into separate constants.
 *
 * Bump these when:
 *   - Engine algorithm changes (gameTree, exploitEngine, rangeEngine, weaknessDetector).
 *   - App architecture changes meaningfully (state shape, persistence schema).
 *
 * Stale-printed-card detection uses `contentHash` (not version), so bumping
 * these does NOT mark prior prints as stale on its own — only the lineage
 * footer string changes.
 */

export const ENGINE_VERSION = 'v123';
export const APP_VERSION = 'v123';
