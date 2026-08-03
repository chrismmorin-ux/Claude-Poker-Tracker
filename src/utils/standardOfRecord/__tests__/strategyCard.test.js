/**
 * strategyCard.test.js — the loader REJECTS, and each rejection is a named failure mode.
 *
 * Every `expect(...).toThrow` here corresponds to a way a Strategy Card could look finished
 * and not be. The point of the suite is not coverage of the module; it is that each of these
 * five states fails LOUDLY at load time rather than producing a card that runs and quietly
 * means something other than what its author intended.
 */

import { describe, it, expect } from 'vitest';

import {
  loadStrategyCard,
  loadStrategyCardSync,
  evaluateCard,
  desugarAction,
  canonicalCardBody,
  MATCHABLE_AXES,
  ABSTAIN_REASONS,
} from '../strategyCard.js';
import { StandardOfRecordError } from '../schemas.js';
import { blindDefenseCard } from '../__fixtures__/blindDefense.card.js';
import { unenclosedCard } from '../__fixtures__/unenclosed.card.js';

/** A structurally valid card, cloned so a test can break exactly one thing. */
const validCard = () => JSON.parse(JSON.stringify(blindDefenseCard));

describe('loadStrategyCard — the five rejections', () => {
  it('rejects a card with no residual clause, naming enclosure as the reason', () => {
    expect(() => loadStrategyCardSync(unenclosedCard)).toThrow(StandardOfRecordError);
    expect(() => loadStrategyCardSync(unenclosedCard)).toThrow(/residual clause/i);
  });

  it('rejects a rule that matches on a positional string key', () => {
    const card = validCard();
    card.rules[0].when = 'preflop:dry:BB:false:false:raise:none';
    // The defect WS-317 removed from the engine must not re-enter through a card.
    expect(() => loadStrategyCardSync(card)).toThrow(/positional string key/i);
  });

  it('rejects a rule that matches on an axis outside the situation key', () => {
    const card = validCard();
    card.rules[0].when = { street: 'preflop', villainVibe: 'tilted' };
    expect(() => loadStrategyCardSync(card)).toThrow(/unknown axis "villainVibe"/);
  });

  it('rejects a warrant outside the enum', () => {
    const card = validCard();
    card.rules[0].warrant = 'intuition';
    expect(() => loadStrategyCardSync(card)).toThrow(/not one of equity \| structure \| read \| fear/);
  });

  it('rejects an action distribution that does not sum to 1, without renormalizing it', () => {
    const card = validCard();
    card.rules[0].do = { call: 0.5, fold: 0.2 };
    expect(() => loadStrategyCardSync(card)).toThrow(/sums to 0\.7, not 1/);
  });

  it('rejects a card missing a required top-level field', () => {
    const card = validCard();
    delete card.rationale;
    expect(() => loadStrategyCardSync(card)).toThrow(/rationale is required/);
  });

  it('rejects two rules sharing an id, because atoms attribute by rule id', () => {
    const card = validCard();
    card.rules[1].id = card.rules[0].id;
    expect(() => loadStrategyCardSync(card)).toThrow(/two rules with id/);
  });

  it('refuses a schemaVersion from the future rather than duck-typing it', () => {
    const card = validCard();
    card.schemaVersion = 99;
    expect(() => loadStrategyCardSync(card)).toThrow(/Refusing rather than duck-typing/);
  });
});

describe('desugarAction', () => {
  it('turns a bare action string into a point mass', () => {
    expect(desugarAction('raise')).toEqual({ raise: 1 });
  });

  it('passes a distribution through unchanged', () => {
    expect(desugarAction({ bet: 0.7, check: 0.3 })).toEqual({ bet: 0.7, check: 0.3 });
  });

  it('rejects a negative weight', () => {
    expect(() => desugarAction({ bet: 1.2, check: -0.2 })).toThrow(/negative weight/);
  });

  it('rejects an empty distribution', () => {
    expect(() => desugarAction({})).toThrow(/empty action distribution/);
  });
});

describe('a loaded card', () => {
  it('normalizes every rule to a distribution, including the sugared one', () => {
    const card = loadStrategyCardSync(validCard());
    const btn = card.rules.find((r) => r.id === 'btn-steal');
    expect(btn.action).toEqual({ raise: 1 });
  });

  it('carries a derivedVerdict slot on every warrant, starting null', () => {
    const card = loadStrategyCardSync(validCard());
    // Null means "not yet audited" — distinguishable from "audited and agreed" (WS-327).
    for (const rule of card.rules) {
      expect(rule.warrant.derivedVerdict).toBeNull();
    }
  });

  it('warns — but does not fail — on a read warrant that states no claim', () => {
    const card = validCard();
    card.rules[3].warrant = { class: 'read' };
    const loaded = loadStrategyCardSync(card);
    expect(loaded.warnings.join(' ')).toMatch(/states no claim/);
  });

  it('is stamped Declared', () => {
    expect(loadStrategyCardSync(validCard()).surfaceKind).toBe('Declared');
  });

  it('allows every matchable axis to be used in a when clause', () => {
    // Guards against the axis list and the loader drifting apart.
    const card = validCard();
    card.rules = [{
      id: 'all-axes',
      when: Object.fromEntries(MATCHABLE_AXES.map((a) => [a, 'x'])),
      do: 'fold',
      warrant: 'structure',
    }];
    expect(() => loadStrategyCardSync(card)).not.toThrow();
  });

  // ── WS-323: a card can now express a preflop chart ─────────────────────────────────────
  //
  // This is the shape the Entry Map is written in, and before WS-323 added HAND_AXIS it threw
  // `unknown axis "handClass"` — a Strategy Card could describe a spot but not what hero held
  // in it, which made the most basic Declared surface there is inexpressible.
  it('matches a group of hand classes, which is what a preflop chart is', () => {
    const card = validCard();
    card.rules = [{
      id: 'utg-open',
      when: { street: 'preflop', posCategory: 'EARLY', facingAction: 'none',
        handClass: ['AA', 'KK', 'QQ', 'AKs', 'AKo'] },
      do: 'raise',
      warrant: 'equity',
    }];
    const loaded = loadStrategyCardSync(card);
    const at = (handClass) => evaluateCard(loaded, {
      gameType: 'cash', seats: 6, stackDepthBB: 100,
      street: 'preflop', posCategory: 'EARLY', facingAction: 'none', handClass,
    });

    expect(at('AKs').action).toEqual({ raise: 1 });
    expect(at('AKs').ruleId).toBe('utg-open');

    // A hand outside the group falls to the residual — the enclosure clause, not a gap.
    const fringe = at('54s');
    expect(fringe.residual).toBe(true);
    expect(fringe.action).toEqual({ fold: 1 });
  });
});

describe('content hashing', () => {
  it('stamps the hash at load time rather than trusting the source', async () => {
    const source = validCard();
    source.contentHash = 'sha256:a-hash-this-card-does-not-have';
    const card = await loadStrategyCard(source);
    expect(card.contentHash).not.toBe(source.contentHash);
    expect(card.contentHash.startsWith('sha256:')).toBe(true);
  });

  it('is stable across loads of identical content', async () => {
    const a = await loadStrategyCard(validCard());
    const b = await loadStrategyCard(validCard());
    expect(a.contentHash).toBe(b.contentHash);
  });

  it('changes when a rule changes', async () => {
    const before = await loadStrategyCard(validCard());
    const mutated = validCard();
    mutated.rules[0].do = { call: 0.6, raise: 0.15, fold: 0.25 };
    const after = await loadStrategyCard(mutated);
    expect(after.contentHash).not.toBe(before.contentHash);
  });

  it('changes when the rationale changes, because the reasons are part of the strategy', async () => {
    const before = await loadStrategyCard(validCard());
    const mutated = validCard();
    mutated.rationale = 'Something else entirely.';
    const after = await loadStrategyCard(mutated);
    expect(after.contentHash).not.toBe(before.contentHash);
  });

  it('changes when rules are reordered, because first match wins', async () => {
    const before = await loadStrategyCard(validCard());
    const mutated = validCard();
    [mutated.rules[0], mutated.rules[1]] = [mutated.rules[1], mutated.rules[0]];
    const after = await loadStrategyCard(mutated);
    expect(after.contentHash).not.toBe(before.contentHash);
  });

  it('excludes derived fields from the canonical body', () => {
    const card = loadStrategyCardSync(validCard());
    const body = canonicalCardBody(card);
    expect(body).not.toHaveProperty('contentHash');
    expect(body).not.toHaveProperty('warnings');
  });
});

describe('evaluateCard', () => {
  const inDomainSituation = { gameType: 'cash', seats: 9, stackDepthBB: 100 };

  it('returns the first matching rule, with its warrant', () => {
    const card = loadStrategyCardSync(validCard());
    const out = evaluateCard(card, {
      ...inDomainSituation, street: 'preflop', posCategory: 'BB', facingAction: 'raise',
    });
    expect(out.ruleId).toBe('bb-defend-vs-btn');
    expect(out.warrant.class).toBe('structure');
    expect(out.residual).toBe(false);
  });

  it('falls through to the residual clause with ruleId null — the residual-EV-share signal', () => {
    const card = loadStrategyCardSync(validCard());
    const out = evaluateCard(card, {
      ...inDomainSituation, street: 'river', posCategory: 'UTG', facingAction: 'bet',
    });
    expect(out.residual).toBe(true);
    expect(out.ruleId).toBeNull();
    expect(out.warrant).toBeNull();
    expect(out.action).toEqual({ fold: 1 });
  });

  it('abstains explicitly outside the declared domain, with a countable reason', () => {
    const card = loadStrategyCardSync(validCard());
    const out = evaluateCard(card, {
      ...inDomainSituation, stackDepthBB: 25, street: 'preflop', posCategory: 'BB',
    });
    expect(out.abstained).toBe(true);
    expect(out.reason).toBe(ABSTAIN_REASONS.OUT_OF_DOMAIN);
    expect(out.field).toBe('stackDepthBB');
    expect(out.action).toBeNull();
  });

  it('abstains rather than assuming coverage when the query omits a constrained field', () => {
    const card = loadStrategyCardSync(validCard());
    const out = evaluateCard(card, { street: 'preflop', posCategory: 'BB', facingAction: 'raise' });
    expect(out.abstained).toBe(true);
    expect(out.reason).toBe(ABSTAIN_REASONS.DOMAIN_UNKNOWN);
  });

  it('honours rule order — an earlier rule shadows a later one', () => {
    const card = validCard();
    card.rules.unshift({
      id: 'catch-all-preflop',
      when: { street: 'preflop' },
      do: 'fold',
      warrant: 'structure',
    });
    const loaded = loadStrategyCardSync(card);
    const out = evaluateCard(loaded, {
      ...inDomainSituation, street: 'preflop', posCategory: 'BB', facingAction: 'raise',
    });
    expect(out.ruleId).toBe('catch-all-preflop');
  });
});
