/**
 * lineSchema.js — schema, validator, and DAG walker for Line Mode.
 *
 * A Line is a branching hand walkthrough: a root node + a DAG of decision and
 * terminal nodes authored end-to-end for teaching. Each node carries
 * commentary sections (prose / formula / example / compute / why / adjust /
 * mismatch) and an optional decision prompt whose branches navigate to next
 * nodes by ID.
 *
 * Schema summary:
 *   Line = {
 *     id, title, summary, rootId,
 *     setup: { hero, villains[], potType, effStack },
 *     nodes: { [nodeId]: Node },
 *     tags?, metadata?
 *   }
 *
 *   Node = {
 *     id, street, board[], pot,
 *     villainAction?: { kind, size? } | null,
 *     heroAction?:    { kind, size? } | null,
 *     heroHolding?:   {                // v2 (RT-106): hand-level teaching
 *       combos?: string[],             //   specific hero combos, e.g. ['A♠K♥']
 *       bucketCandidates?: string[]    //   bucket labels for bucket-EV view
 *     },
 *     sections: Section[],
 *     decision?: Decision,            // absent == terminal node
 *     frameworks?: string[],          // framework IDs this node teaches
 *     tags?: string[],
 *   }
 *
 *   Section.kind ∈ {prose, formula, example, compute, why, adjust, mismatch}
 *
 *   Decision = {
 *     prompt: string,
 *     branches: [{
 *       label, nextId|null, correct: boolean, rationale,
 *       correctByArchetype?: { [archetypeId]: boolean }  // v2 (RT-107)
 *     }]
 *   }
 *
 * Villain shape is `villains[]` (array) from day 1 so multiway support in
 * later phases is purely additive — HU lines use an array of length 1.
 *
 * Pure module — no imports from UI, state, or persistence layers.
 */

/**
 * Schema version — bumped from 1 → 2 on 2026-04-21 (RT-106) to add the
 * optional `Node.heroHolding` field. The field is additive and nullable;
 * existing content without it continues to validate under v2.
 */
export const SCHEMA_VERSION = 2;

export const SECTION_KINDS = Object.freeze([
  'prose', 'formula', 'example', 'compute', 'why', 'adjust', 'mismatch',
]);

/**
 * Regex for a 2-card hero combo, using the unicode-suit convention the rest
 * of the codebase uses (`parseCard` in pokerCore/cardParser). Rank is one of
 * 2-9/T/J/Q/K/A; suit is one of the four unicode suit glyphs.
 *
 * Examples that match: "A♠K♥", "7♦7♣", "T♠9♠".
 * Does NOT enforce the two cards are distinct — that check lives in the
 * validator below so the error message can name the offending field.
 */
const COMBO_REGEX = /^([2-9TJQKA])([♠♥♦♣])([2-9TJQKA])([♠♥♦♣])$/;

export const STREETS = Object.freeze(['flop', 'turn', 'river']);

export const POT_TYPES = Object.freeze([
  'srp', '3bp', '4bp', 'limped',
  'srp-3way', '3bp-3way', 'srp-4way',
]);

export const VILLAIN_ACTION_KINDS = Object.freeze([
  'check', 'bet', 'cbet', 'donk', 'raise', 'checkraise', 'fold', 'call',
]);

export const HERO_ACTION_KINDS = Object.freeze([
  'check', 'bet', 'cbet', 'call', 'raise', 'fold',
]);

// ---------- Primitive guards ---------- //

const isPlainObject = (x) =>
  x !== null && typeof x === 'object' && !Array.isArray(x);

const nonEmptyString = (x) => typeof x === 'string' && x.length > 0;

// ---------- Per-field validators ---------- //

const validateSection = (section, ctx) => {
  const errs = [];
  if (!isPlainObject(section)) {
    errs.push(`${ctx}: section must be an object`);
    return errs;
  }
  if (!SECTION_KINDS.includes(section.kind)) {
    errs.push(`${ctx}: section.kind '${section.kind}' is not one of ${SECTION_KINDS.join(', ')}`);
    return errs;
  }
  switch (section.kind) {
    case 'prose':
    case 'why':
    case 'adjust':
    case 'mismatch':
      if (!nonEmptyString(section.body)) {
        errs.push(`${ctx}: ${section.kind} section requires non-empty body`);
      }
      break;
    case 'formula':
      if (!nonEmptyString(section.body)) {
        errs.push(`${ctx}: formula section requires non-empty body`);
      }
      break;
    case 'example':
      if (!isPlainObject(section.context)) {
        errs.push(`${ctx}: example section requires context object`);
      }
      if (!nonEmptyString(section.board)) {
        errs.push(`${ctx}: example section requires board string`);
      }
      if (!nonEmptyString(section.takeaway)) {
        errs.push(`${ctx}: example section requires takeaway`);
      }
      break;
    case 'compute':
      if (!nonEmptyString(section.calculator)) {
        errs.push(`${ctx}: compute section requires calculator name`);
      }
      break;
    default:
      break;
  }
  return errs;
};

/**
 * Validate the optional `branch.correctByArchetype` field (RT-107, schema v2).
 *
 * Must be a plain object whose keys are non-empty strings (archetype IDs —
 * enum not enforced here to keep the taxonomy extensible) and whose values
 * are strictly booleans. Returns the list of archetype IDs whose value is
 * `true`, for the decision-level "≥1 correct per archetype" aggregation.
 */
const validateCorrectByArchetype = (cba, ctx) => {
  const errs = [];
  const correctIds = [];
  if (cba === undefined) return { errs, correctIds, archetypeIds: [] };
  if (!isPlainObject(cba)) {
    errs.push(`${ctx}: correctByArchetype must be an object`);
    return { errs, correctIds, archetypeIds: [] };
  }
  const archetypeIds = Object.keys(cba);
  if (archetypeIds.length === 0) {
    errs.push(`${ctx}: correctByArchetype must have at least one archetype key`);
    return { errs, correctIds, archetypeIds };
  }
  for (const id of archetypeIds) {
    if (!nonEmptyString(id)) {
      errs.push(`${ctx}: correctByArchetype keys must be non-empty strings`);
      continue;
    }
    if (typeof cba[id] !== 'boolean') {
      errs.push(`${ctx}: correctByArchetype['${id}'] must be boolean`);
      continue;
    }
    if (cba[id]) correctIds.push(id);
  }
  return { errs, correctIds, archetypeIds };
};

const validateDecision = (decision, ctx, nodeIds) => {
  const errs = [];
  if (!isPlainObject(decision)) {
    errs.push(`${ctx}: decision must be an object`);
    return errs;
  }
  if (!nonEmptyString(decision.prompt)) {
    errs.push(`${ctx}: decision.prompt required`);
  }
  if (!Array.isArray(decision.branches) || decision.branches.length < 2) {
    errs.push(`${ctx}: decision.branches must have at least 2 entries`);
    return errs;
  }
  let hasCorrect = false;
  // RT-107: for each archetype referenced across branches, track whether at
  // least one branch is correct under it.
  const archetypeHasCorrect = new Map();
  decision.branches.forEach((b, i) => {
    const bctx = `${ctx}.branches[${i}]`;
    if (!isPlainObject(b)) { errs.push(`${bctx}: must be an object`); return; }
    if (!nonEmptyString(b.label))     errs.push(`${bctx}: label required`);
    if (!nonEmptyString(b.rationale)) errs.push(`${bctx}: rationale required`);
    if (typeof b.correct !== 'boolean') errs.push(`${bctx}: correct must be boolean`);
    if (b.correct) hasCorrect = true;
    if (b.nextId !== null && !nonEmptyString(b.nextId)) {
      errs.push(`${bctx}: nextId must be non-empty string or null (terminal)`);
    }
    if (b.nextId && !nodeIds.has(b.nextId)) {
      errs.push(`${bctx}: nextId '${b.nextId}' does not resolve to a node`);
    }
    if (b.correctByArchetype !== undefined) {
      const { errs: cbaErrs, correctIds, archetypeIds } = validateCorrectByArchetype(
        b.correctByArchetype, bctx,
      );
      errs.push(...cbaErrs);
      for (const id of archetypeIds) {
        if (!archetypeHasCorrect.has(id)) archetypeHasCorrect.set(id, false);
      }
      for (const id of correctIds) archetypeHasCorrect.set(id, true);
    }
  });
  if (!hasCorrect) errs.push(`${ctx}: decision needs at least one branch with correct=true`);
  // RT-107 — every archetype referenced by any branch must have ≥1 correct branch.
  for (const [id, anyCorrect] of archetypeHasCorrect.entries()) {
    if (!anyCorrect) {
      errs.push(`${ctx}: archetype '${id}' has no branch with correctByArchetype['${id}']=true`);
    }
  }
  return errs;
};

const validateVillain = (v, ctx) => {
  const errs = [];
  if (!isPlainObject(v)) {
    errs.push(`${ctx}: must be an object`);
    return errs;
  }
  if (!nonEmptyString(v.position)) errs.push(`${ctx}: villain.position required`);
  if (!nonEmptyString(v.action))   errs.push(`${ctx}: villain.action required`);
  if (v.action && v.action !== 'open' && v.action !== 'limp' && !nonEmptyString(v.vs)) {
    errs.push(`${ctx}: villain.vs required when action is '${v.action}'`);
  }
  return errs;
};

const validateSetup = (setup) => {
  const errs = [];
  if (!isPlainObject(setup)) {
    errs.push('setup must be an object');
    return errs;
  }
  if (!isPlainObject(setup.hero)) {
    errs.push('setup.hero must be an object');
  } else if (!nonEmptyString(setup.hero.position)) {
    errs.push('setup.hero.position required');
  }
  if (!Array.isArray(setup.villains) || setup.villains.length < 1) {
    errs.push('setup.villains must be an array with ≥ 1 entry');
  } else {
    setup.villains.forEach((v, i) => {
      errs.push(...validateVillain(v, `setup.villains[${i}]`));
    });
  }
  if (!POT_TYPES.includes(setup.potType)) {
    errs.push(`setup.potType '${setup.potType}' is not one of ${POT_TYPES.join(', ')}`);
  }
  if (typeof setup.effStack !== 'number' || setup.effStack <= 0) {
    errs.push('setup.effStack must be a positive number (bb)');
  }
  return errs;
};

const validateVillainAction = (va, ctx) => {
  const errs = [];
  if (!isPlainObject(va)) {
    errs.push(`${ctx}: villainAction must be an object`);
    return errs;
  }
  if (!VILLAIN_ACTION_KINDS.includes(va.kind)) {
    errs.push(`${ctx}: villainAction.kind '${va.kind}' must be one of ${VILLAIN_ACTION_KINDS.join(', ')}`);
  }
  if (va.size != null && (typeof va.size !== 'number' || va.size < 0)) {
    errs.push(`${ctx}: villainAction.size must be a non-negative number (pot fraction or bb)`);
  }
  return errs;
};

/**
 * Validate the optional `heroHolding` field on a Node (RT-106, schema v2).
 *
 * Shape: `{ combos?: string[], bucketCandidates?: string[] }`. At least one
 * of the two arrays must be present and non-empty. `combos` entries match
 * the `COMBO_REGEX` format and must have two distinct cards. `bucketCandidates`
 * entries are free-form non-empty strings — the bucket taxonomy is pinned in
 * RT-110 and not enforced here to avoid pre-committing that naming.
 */
const validateHeroHolding = (heroHolding, ctx) => {
  const errs = [];
  if (!isPlainObject(heroHolding)) {
    errs.push(`${ctx}: heroHolding must be an object`);
    return errs;
  }
  const hasCombos = heroHolding.combos !== undefined;
  const hasBuckets = heroHolding.bucketCandidates !== undefined;
  if (!hasCombos && !hasBuckets) {
    errs.push(`${ctx}: heroHolding requires combos or bucketCandidates`);
    return errs;
  }
  if (hasCombos) {
    if (!Array.isArray(heroHolding.combos) || heroHolding.combos.length === 0) {
      errs.push(`${ctx}: heroHolding.combos must be a non-empty array`);
    } else {
      heroHolding.combos.forEach((c, i) => {
        if (typeof c !== 'string' || !COMBO_REGEX.test(c)) {
          errs.push(`${ctx}: heroHolding.combos[${i}] '${c}' must match rank+suit×2 (e.g. 'A♠K♥')`);
          return;
        }
        // Distinct-card check: split into the two card strings (rank + suit glyph).
        const m = c.match(COMBO_REGEX);
        if (m && m[1] === m[3] && m[2] === m[4]) {
          errs.push(`${ctx}: heroHolding.combos[${i}] '${c}' has duplicate card`);
        }
      });
    }
  }
  if (hasBuckets) {
    if (!Array.isArray(heroHolding.bucketCandidates) || heroHolding.bucketCandidates.length === 0) {
      errs.push(`${ctx}: heroHolding.bucketCandidates must be a non-empty array`);
    } else {
      heroHolding.bucketCandidates.forEach((b, i) => {
        if (!nonEmptyString(b)) {
          errs.push(`${ctx}: heroHolding.bucketCandidates[${i}] must be a non-empty string`);
        }
      });
    }
  }
  return errs;
};

const validateNode = (node, id, nodeIds) => {
  const errs = [];
  if (!isPlainObject(node)) {
    errs.push(`nodes['${id}']: must be an object`);
    return errs;
  }
  if (node.id !== id) errs.push(`nodes['${id}']: node.id '${node.id}' must match key`);
  if (!STREETS.includes(node.street)) {
    errs.push(`nodes['${id}']: street '${node.street}' must be one of ${STREETS.join(', ')}`);
  }
  if (!Array.isArray(node.board)) {
    errs.push(`nodes['${id}']: board must be an array of card strings`);
  } else if (STREETS.includes(node.street)) {
    const expected = node.street === 'flop' ? 3 : node.street === 'turn' ? 4 : 5;
    if (node.board.length !== expected) {
      errs.push(`nodes['${id}']: board.length ${node.board.length} but street '${node.street}' expects ${expected}`);
    }
  }
  if (typeof node.pot !== 'number' || node.pot < 0) {
    errs.push(`nodes['${id}']: pot must be non-negative number (bb)`);
  }
  if (node.villainAction != null) {
    errs.push(...validateVillainAction(node.villainAction, `nodes['${id}'].villainAction`));
  }
  if (!Array.isArray(node.sections) || node.sections.length === 0) {
    errs.push(`nodes['${id}']: sections required (non-empty array)`);
  } else {
    node.sections.forEach((s, i) => {
      errs.push(...validateSection(s, `nodes['${id}'].sections[${i}]`));
    });
  }
  if (node.decision != null) {
    errs.push(...validateDecision(node.decision, `nodes['${id}'].decision`, nodeIds));
  }
  if (node.frameworks != null) {
    if (!Array.isArray(node.frameworks) || node.frameworks.some((f) => !nonEmptyString(f))) {
      errs.push(`nodes['${id}']: frameworks must be array of non-empty strings`);
    }
  }
  if (node.heroHolding != null) {
    errs.push(...validateHeroHolding(node.heroHolding, `nodes['${id}']`));
  }
  return errs;
};

// ---------- Public API ---------- //

/**
 * Walk the DAG from rootId, returning the set of reachable node IDs.
 * Detects cycles (which must not exist in authored content) and returns
 * them via the `cycles` array — each entry is the path from a repeated
 * ancestor back to itself.
 *
 * @param {object} line
 * @returns {{ reachable: Set<string>, cycles: string[][] }}
 */
export const walkLine = (line) => {
  const reachable = new Set();
  const cycles = [];
  if (!line || !line.nodes || !line.rootId) return { reachable, cycles };

  const visiting = new Set();

  const visit = (id, path) => {
    if (visiting.has(id)) {
      cycles.push([...path, id]);
      return;
    }
    if (reachable.has(id)) return;
    reachable.add(id);
    visiting.add(id);
    const node = line.nodes[id];
    if (node && node.decision && Array.isArray(node.decision.branches)) {
      for (const b of node.decision.branches) {
        if (b && b.nextId && line.nodes[b.nextId]) {
          visit(b.nextId, [...path, id]);
        }
      }
    }
    visiting.delete(id);
  };

  visit(line.rootId, []);
  return { reachable, cycles };
};

/**
 * Validate a line end-to-end. Returns `{ ok, errors }` where `errors` is a
 * list of human-readable messages. `ok === true` iff `errors.length === 0`.
 */
export const validateLine = (line) => {
  const errors = [];

  if (!isPlainObject(line)) {
    errors.push('line must be an object');
    return { ok: false, errors };
  }
  if (!nonEmptyString(line.id))      errors.push('line.id required (non-empty string)');
  if (!nonEmptyString(line.title))   errors.push('line.title required (non-empty string)');
  if (!nonEmptyString(line.summary)) errors.push('line.summary required (non-empty string)');
  if (!nonEmptyString(line.rootId))  errors.push('line.rootId required (non-empty string)');

  errors.push(...validateSetup(line.setup));

  if (!isPlainObject(line.nodes)) {
    errors.push('line.nodes must be an object (id -> node)');
    return { ok: false, errors };
  }

  const nodeIds = new Set(Object.keys(line.nodes));
  if (line.rootId && !nodeIds.has(line.rootId)) {
    errors.push(`line.rootId '${line.rootId}' does not resolve to a node`);
  }

  for (const [id, node] of Object.entries(line.nodes)) {
    errors.push(...validateNode(node, id, nodeIds));
  }

  if (nodeIds.has(line.rootId)) {
    const { reachable, cycles } = walkLine(line);
    const orphans = [];
    for (const id of nodeIds) {
      if (!reachable.has(id)) orphans.push(id);
    }
    if (orphans.length > 0) {
      errors.push(`orphan nodes (unreachable from root): ${orphans.join(', ')}`);
    }
    if (cycles.length > 0) {
      errors.push(`cycles detected: ${cycles.map((p) => p.join(' -> ')).join(' | ')}`);
    }
  }

  return { ok: errors.length === 0, errors };
};

/**
 * Resolve a branch's correctness against an optional archetype toggle.
 *
 * Fallback contract (RT-107):
 *   - If `branch.correctByArchetype[archetype]` is defined, return it.
 *   - Otherwise return `branch.correct` (the flat boolean is the default
 *     answer; new archetype-aware content opts in per-branch).
 *
 * @param {{correct: boolean, correctByArchetype?: Record<string, boolean>}} branch
 * @param {string} [archetype]
 * @returns {boolean}
 */
export const resolveBranchCorrect = (branch, archetype) => {
  if (!branch) return false;
  if (archetype && isPlainObject(branch.correctByArchetype)
      && typeof branch.correctByArchetype[archetype] === 'boolean') {
    return branch.correctByArchetype[archetype];
  }
  return !!branch.correct;
};

/**
 * Summary stats for a line — reachable count, decision/terminal split,
 * stub branches (branches whose nextId is null AND whose target node is
 * absent). Used by the UI's completeness badge.
 */
export const lineStats = (line) => {
  const { reachable } = walkLine(line);
  const totalNodes = Object.keys(line.nodes || {}).length;
  let decisionNodes = 0;
  let terminalNodes = 0;
  let branches = 0;
  let stubBranches = 0;
  for (const id of reachable) {
    const n = line.nodes[id];
    if (!n) continue;
    if (n.decision) {
      decisionNodes++;
      for (const b of n.decision.branches || []) {
        branches++;
        if (b.nextId === null) stubBranches++;
      }
    } else {
      terminalNodes++;
    }
  }
  return {
    totalNodes,
    reachableNodes: reachable.size,
    decisionNodes,
    terminalNodes,
    branches,
    stubBranches,
  };
};
