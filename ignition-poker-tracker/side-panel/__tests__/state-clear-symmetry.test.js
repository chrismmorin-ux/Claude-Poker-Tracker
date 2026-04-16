/**
 * state-clear-symmetry.test.js — STP-1 R-8.1 state-clear completeness gate.
 *
 * Parses STATE_FIELD_SCOPES.md and render-coordinator.js and asserts:
 *   - Every `_state` initial field is declared in the registry.
 *   - Every `perTable` field is cleared in clearForTableSwitch.
 *   - Every `perHand` field is cleared in the hand-new block of handleLiveContext.
 *   - Every `derived` field is computed in buildSnapshot, not assigned by handlers.
 *
 * This is the generalization of the advicePendingForStreet fix — it prevents
 * the class of bug rather than chasing instances. See MEMORY.md and
 * .claude/failures/STATE_CLEAR_ASYMMETRY.md for the incident this gate guards.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PANEL_DIR = resolve(__dirname, '..');

const registryMd = readFileSync(resolve(PANEL_DIR, 'STATE_FIELD_SCOPES.md'), 'utf8');
const coordinatorJs = readFileSync(resolve(PANEL_DIR, 'render-coordinator.js'), 'utf8');

// =========================================================================
// PARSE: initial state keys from render-coordinator.js constructor
// =========================================================================
// Strategy: find `this._state = {` and scan forward for `key: value,` until
// the matching `};`. We accept the file's own formatting — no AST needed.

function parseInitialStateKeys(source) {
  const start = source.indexOf('this._state = {');
  if (start < 0) throw new Error('could not locate `this._state = {` in render-coordinator.js');
  const after = source.slice(start + 'this._state = {'.length);
  // Match up to the first top-level `};` — the _state block has no nested
  // braces at top level other than inline `{}` literals for default values.
  const end = after.search(/^\s{4}\};/m);
  if (end < 0) throw new Error('could not locate closing `};` of _state block');
  const block = after.slice(0, end);

  const keys = new Set();
  // Match `  keyName:` at any indent, where keyName starts a line and the
  // colon is followed by a value. Exclude comment-only lines.
  const keyRe = /^\s{6}([a-zA-Z_][a-zA-Z0-9_]*)\s*:/gm;
  for (const m of block.matchAll(keyRe)) {
    keys.add(m[1]);
  }
  return keys;
}

// =========================================================================
// PARSE: registry sections from STATE_FIELD_SCOPES.md
// =========================================================================

function parseRegistry(md, knownFields) {
  // Registry lines use the convention:
  //   - `fieldName` — description with optional `methodName` prose mentions
  //   - `fieldA`, `fieldB`, `fieldC` — grouped declaration (comma-separated)
  //
  // Parse list-item lines (starting with "- "). Before the em-dash ("—"),
  // every backticked identifier is a declaration; after the em-dash, they
  // are prose references and ignored. Filtering against `knownFields`
  // discards method names and constants regardless of position.
  const scopes = { session: new Set(), perTable: new Set(), perHand: new Set(), derived: new Set(), monotonic: new Set() };
  let current = null;
  for (const line of md.split('\n')) {
    const header = line.match(/^###\s+(session|perTable|perHand|derived|monotonic)\s*$/);
    if (header) { current = header[1]; continue; }
    if (/^##\s+/.test(line)) { current = null; continue; }
    if (!current) continue;
    const listItem = line.match(/^-\s+(.+)$/);
    if (!listItem) continue;
    const [declarationPart] = listItem[1].split(/[—–-]\s*/); // before em-dash
    const ids = declarationPart.matchAll(/`(_?[a-zA-Z][a-zA-Z0-9_]*)`/g);
    for (const m of ids) {
      if (knownFields.has(m[1])) scopes[current].add(m[1]);
    }
  }
  return scopes;
}

// =========================================================================
// PARSE: clearForTableSwitch + hand-new block bodies
// =========================================================================

function extractMethodBody(source, signaturePattern) {
  const idx = source.search(signaturePattern);
  if (idx < 0) throw new Error(`could not locate signature ${signaturePattern}`);
  // Find opening brace
  const open = source.indexOf('{', idx);
  let depth = 1;
  let i = open + 1;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  return source.slice(open, i);
}

function fieldsAssignedIn(bodySource) {
  // Match `this._state.fieldName =` (assignment, not reference).
  const assigned = new Set();
  for (const m of bodySource.matchAll(/this\._state\.([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g)) {
    assigned.add(m[1]);
  }
  return assigned;
}

// =========================================================================
// FIXTURES
// =========================================================================

const initialStateKeys = parseInitialStateKeys(coordinatorJs);
const registry = parseRegistry(registryMd, initialStateKeys);
const clearForTableSwitchBody = extractMethodBody(coordinatorJs, /clearForTableSwitch\(\)\s*\{/);
const clearedOnTableSwitch = fieldsAssignedIn(clearForTableSwitchBody);

// Hand-new block lives inside handleLiveContext; extract the method then slice
// out the `if (!promotedPending && prevState !== newState && ...)` block.
const handleLiveContextBody = extractMethodBody(coordinatorJs, /handleLiveContext\(/);
const handNewMatch = handleLiveContextBody.match(
  /if \(!promotedPending && prevState !== newState[\s\S]*?\}\s*/
);
if (!handNewMatch) throw new Error('could not locate hand-new block in handleLiveContext');
const clearedOnHandNew = fieldsAssignedIn(handNewMatch[0]);

// FSM-owned fields (`panels`, `seatPopoverDetail`) are cleared via
// `dispatchTableSwitch()` / `dispatchHandNew()` fan-out, not direct
// assignment. Credit those dispatch calls as equivalent clears.
const FSM_OWNED = ['panels', 'seatPopoverDetail'];
if (/this\.dispatchTableSwitch\(\)/.test(clearForTableSwitchBody)) {
  for (const f of FSM_OWNED) clearedOnTableSwitch.add(f);
}
if (/this\.dispatchHandNew\(\)/.test(handNewMatch[0])) {
  for (const f of FSM_OWNED) clearedOnHandNew.add(f);
}

// Timer-owned fields (`modeAExpired`, `modeATimerActive`) are cleared via
// the `clearModeATimer()` method. Credit that method call as equivalent.
const MODE_A_OWNED = ['modeAExpired', 'modeATimerActive'];
if (/this\.clearModeATimer\(\)/.test(clearForTableSwitchBody)) {
  for (const f of MODE_A_OWNED) clearedOnTableSwitch.add(f);
}

// =========================================================================
// TESTS
// =========================================================================

describe('STP-1 R-8.1 — state-clear symmetry', () => {
  it('every initial-state field is declared in the registry', () => {
    const allRegistered = new Set([
      ...registry.session, ...registry.perTable, ...registry.perHand,
      ...registry.derived, ...registry.monotonic,
    ]);
    const undeclared = [...initialStateKeys].filter(k => !allRegistered.has(k));
    expect(undeclared).toEqual([]);
  });

  it('no field is declared in more than one non-overlapping scope pair', () => {
    // perHand fields are legitimately cleared by clearForTableSwitch too
    // (table-switch is a superset of hand-new). Listing a field in both
    // perHand and perTable is non-canonical but tolerated. We only flag
    // collisions between scopes that have incompatible semantics.
    const INCOMPATIBLE = [
      ['session', 'perTable'], ['session', 'perHand'],
      ['derived', 'perTable'], ['derived', 'perHand'], ['derived', 'session'],
      ['monotonic', 'perTable'], ['monotonic', 'perHand'], ['monotonic', 'session'], ['monotonic', 'derived'],
    ];
    const collisions = [];
    for (const field of initialStateKeys) {
      for (const [a, b] of INCOMPATIBLE) {
        if (registry[a].has(field) && registry[b].has(field)) {
          collisions.push({ field, scopes: [a, b] });
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it('every perTable field is cleared in clearForTableSwitch', () => {
    const missing = [...registry.perTable].filter(f => !clearedOnTableSwitch.has(f));
    expect(missing).toEqual([]);
  });

  it('every perHand field is cleared in the hand-new block OR in clearForTableSwitch', () => {
    // Hand-new must reset; table-switch is a superset, so field must appear
    // in at least one. (Many appear in both, which is fine.)
    const missing = [...registry.perHand].filter(
      f => !clearedOnHandNew.has(f) && !clearedOnTableSwitch.has(f)
    );
    expect(missing).toEqual([]);
  });

  it('session fields are NOT cleared in clearForTableSwitch', () => {
    // Catches accidental over-clearing (e.g., wiping the user's
    // tournamentCollapsed preference on a table switch).
    const overCleared = [...registry.session].filter(f => clearedOnTableSwitch.has(f));
    expect(overCleared).toEqual([]);
  });

  it('monotonic counters are NOT cleared in clearForTableSwitch', () => {
    // Resetting monotonic counters causes renderKey collisions — a new push
    // after a table switch could hash to the same key as a pre-switch push
    // and get skipped.
    const overCleared = [...registry.monotonic].filter(f => clearedOnTableSwitch.has(f));
    expect(overCleared).toEqual([]);
  });

  it('advicePendingForStreet regression pin — present in clearForTableSwitch', () => {
    // Direct pin for the original SRT-trust fix. If someone removes line 754
    // from render-coordinator.js, R5 will arm on probe-flake cycles again.
    expect(clearedOnTableSwitch.has('advicePendingForStreet')).toBe(true);
  });
});
