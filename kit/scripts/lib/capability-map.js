/**
 * capability-map.js — Single source of truth for L1-L5 → capability translation.
 *
 * ADR-016 reframed CWOS adoption from a kit-picked level into user-owned
 * capability state carried in .cwos-onboarding.yaml. The five capabilities are
 * the install groups already declared in kit/MANIFEST.yaml. L1-L5 remains as
 * a one-release compatibility shim; this module owns the translation.
 *
 * Zero dependencies. Required by cwos-adopt-install.js, cwos-migrate.js, and
 * any future reader that needs to resolve enabled capabilities from an
 * onboarding data object.
 */

'use strict';

// L<N> → the capability unlocked at that level. The DAG is cumulative:
// enabling L3 implies core + workstream + engines. See ADR-016.
const LEVEL_TO_CAPABILITY = Object.freeze({
  L1: 'core',
  L2: 'workstream',
  L3: 'engines',
  L4: 'governance',
  L5: 'autonomous',
});

const CAPABILITY_TO_LEVEL = Object.freeze({
  core: 'L1',
  workstream: 'L2',
  engines: 'L3',
  governance: 'L4',
  autonomous: 'L5',
});

const CAPABILITY_ORDER = Object.freeze([
  'core',
  'workstream',
  'engines',
  'governance',
  'autonomous',
]);

/**
 * Given an adoption_level string (L1-L5), return the cumulative capability
 * set implied by that level. L3 → {core, workstream, engines}.
 */
function capabilitiesForLevel(level) {
  const idx = CAPABILITY_ORDER.indexOf(LEVEL_TO_CAPABILITY[level]);
  if (idx < 0) return new Set();
  return new Set(CAPABILITY_ORDER.slice(0, idx + 1));
}

/**
 * Given a set/array of enabled capability names, return the highest
 * L<N> value that the set satisfies (for legacy shim writes).
 */
function levelForCapabilities(caps) {
  const set = caps instanceof Set ? caps : new Set(caps);
  let highest = null;
  for (const cap of CAPABILITY_ORDER) {
    if (set.has(cap)) highest = CAPABILITY_TO_LEVEL[cap];
    else break;
  }
  return highest;
}

/**
 * Dual-read resolver for .cwos-onboarding.yaml data.
 *
 * Returns { enabled: Set<string>, source: 'capabilities' | 'level' | 'empty',
 *   needsRewrite: boolean }.
 *
 * - If the `capabilities:` block is present with any `state: enabled|intended`
 *   entries, read it verbatim. source = 'capabilities'. needsRewrite = false.
 * - Else if `adoption_level: L<N>` is set, translate via LEVEL_TO_CAPABILITY
 *   (cumulative). source = 'level'. needsRewrite = true — callers who are
 *   write-authoritative (/adopt, /discover) should flush a capabilities block
 *   on the next file write.
 * - Else, no state at all. source = 'empty'. needsRewrite = false.
 *
 * Only `enabled` and `intended` states count toward the "enabled" set for
 * filtering purposes; `declined` and `unconfigured` do not.
 */
function resolveEnabledCapabilities(onboardingData) {
  const enabled = new Set();

  const caps = onboardingData && onboardingData.capabilities;
  if (caps && typeof caps === 'object') {
    let any = false;
    for (const name of CAPABILITY_ORDER) {
      const entry = caps[name];
      if (!entry) continue;
      const state = (typeof entry === 'object' ? entry.state : entry) || null;
      if (state === 'enabled' || state === 'intended') {
        enabled.add(name);
        any = true;
      } else if (state && state !== 'unconfigured') {
        any = true;
      }
    }
    if (any) return { enabled, source: 'capabilities', needsRewrite: false };
  }

  const level = onboardingData && onboardingData.adoption_level;
  if (level && LEVEL_TO_CAPABILITY[level]) {
    return {
      enabled: capabilitiesForLevel(level),
      source: 'level',
      needsRewrite: true,
    };
  }

  return { enabled, source: 'empty', needsRewrite: false };
}

/**
 * Parse a comma-separated `--capabilities` CLI argument into a validated Set.
 * Throws on unknown names. Empty string → empty Set.
 */
function parseCapabilitiesArg(arg) {
  if (!arg || !arg.trim()) return new Set();
  const parts = arg.split(',').map((s) => s.trim()).filter(Boolean);
  const out = new Set();
  for (const part of parts) {
    if (!CAPABILITY_TO_LEVEL[part]) {
      throw new Error(
        `Unknown capability: "${part}". ` +
        `Valid: ${CAPABILITY_ORDER.join(', ')}.`
      );
    }
    out.add(part);
  }
  return out;
}

module.exports = {
  LEVEL_TO_CAPABILITY,
  CAPABILITY_TO_LEVEL,
  CAPABILITY_ORDER,
  capabilitiesForLevel,
  levelForCapabilities,
  resolveEnabledCapabilities,
  parseCapabilitiesArg,
};
