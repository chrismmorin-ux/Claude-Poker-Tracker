/**
 * templateSlotIntegrity.test.js — every template slot must resolve against
 * the HeroState shape.
 *
 * CROSS_STREAM_SEAM_CONTRACT_MISMATCH guard: templates are authored in
 * docs/design/hero-state-templates/ against the HeroState contract in
 * types.js; interpolateTemplate deliberately leaves unresolved slots as raw
 * `{{path}}` text — which is USER-VISIBLE in the rendered narrative. A slot
 * path typo (e.g. the former `equity.vsRangeParts.vsBluffCatch`, a key the
 * builder never emits) shipped invisible to CI because no test rendered the
 * templates against the real shape.
 *
 * This test resolves every `{{...}}` slot in every loaded template's
 * rendered sections against a fully-populated HeroState fixture (built
 * field-by-field from the types.js typedefs). Any unresolvable path fails
 * with the template + path named.
 */

import { describe, it, expect } from 'vitest';
import { loadTemplate, listLoadedArchetypeIds } from '../loadTemplates';
import { interpolateTemplate, resolveDotPath } from '../interpolateTemplate';

const SLOT_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

/**
 * Shape-complete HeroState per types.js typedefs — every field populated
 * with a non-null representative value so any unresolved slot is a path
 * error, not a data gap.
 */
const FULL_HERO_STATE = {
  archetypeId: 'FIXTURE',
  archetypeFamily: 'FIXTURE_FAMILY',
  situation: {
    street: 'flop',
    actionContext: 'CBET',
    positionClass: 'BTN',
    inPosition: true,
    playersRemaining: 2,
    sprZone: 'MEDIUM',
    pot: 12,
    effStack: 88,
    rake: { pct: 5, cap: 5, noFlopNoDrop: true },
    potType: 'SRP',
    sizingFraction: 0.33,
    multiwayHeroRole: 'PFR_LEADING',
  },
  handContext: {
    hand: 'A♠K♠',
    handClass: 'TOP_OF_RANGE',
    handStrength: 'TPTK',
    rangeAdvantage: 'hero',
    nutAdvantage: 'neutral',
    boardTexture: 'DRY',
  },
  equity: {
    overall: 0.62,
    vsRangeParts: { vsValue: 0.41, vsBluff: 0.78, vsDraw: 0.55, vsAir: 0.85 },
    realization: 0.95,
    realizedEquity: 0.59,
  },
  plan: {
    primary: { action: 'BET', sizing: 0.5, sizingRationale: 'value vs capped range', ev: 1.2 },
    branches: [
      { trigger: 'villain raises', action: 'CALL', sizing: 0.5, rationale: 'priced in', ev: 0.4 },
      { trigger: 'villain calls', action: 'BET', sizing: 0.66, rationale: 'barrel good turns', ev: 0.8 },
    ],
    rangeConfig: {
      tight: { hands: ['AKs'], bias: 'value-heavy', triggers: ['aware blinds'] },
      wide: { hands: ['AKs', 'KQs'], bias: 'balanced', triggers: ['passive table'] },
    },
  },
  adjustments: [
    {
      condition: 'villain overfolds to barrels',
      delta: { sizingMultiplier: 1.25, polarize: true, bluffFreq: 0.3, actionOverride: 'BET' },
      rationale: 'fold equity up',
    },
  ],
  composedDelta: {
    sizingMultiplier: 1.25,
    polarize: false,
    bluffFreq: 0.3,
    actionOverride: 'BET',
    clamped: false,
    contributingCount: 1,
  },
  narrative: { headline: '', body: '', branchSummary: '' },
};

const extractSlots = (text) => {
  const slots = [];
  let m;
  SLOT_PATTERN.lastIndex = 0;
  while ((m = SLOT_PATTERN.exec(text)) !== null) slots.push(m[1]);
  return slots;
};

const SECTIONS = ['headline', 'body', 'branchSummary'];

describe('HSP template slot integrity (all loaded templates)', () => {
  const archetypeIds = listLoadedArchetypeIds();

  it('loads the full template catalog', () => {
    expect(archetypeIds.length).toBeGreaterThanOrEqual(44);
  });

  it.each(archetypeIds)('%s — every rendered-section slot resolves against the HeroState shape', (id) => {
    const template = loadTemplate(id);
    const failures = [];
    for (const section of SECTIONS) {
      for (const path of extractSlots(template.sections[section] || '')) {
        const resolved = resolveDotPath(FULL_HERO_STATE, path);
        if (resolved === null || resolved === undefined || resolved === '') {
          failures.push(`${section}: {{${path}}}`);
        }
      }
    }
    expect(failures, `unresolvable slots in ${template.path}:\n  ${failures.join('\n  ')}`).toEqual([]);
  });

  it.each(archetypeIds)('%s — fully-populated render leaves no raw {{...}} visible', (id) => {
    const template = loadTemplate(id);
    for (const section of SECTIONS) {
      const rendered = interpolateTemplate(template.sections[section] || '', FULL_HERO_STATE);
      expect(rendered, `${id} ${section} contains unresolved slot`).not.toMatch(/\{\{/);
    }
  });
});
