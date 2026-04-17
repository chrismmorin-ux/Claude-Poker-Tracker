import { describe, it, expect } from 'vitest';
import { deriveAutoName, pickDistinctiveFeature } from '../playerAutoName';

describe('pickDistinctiveFeature', () => {
  it('returns null for null/undefined/empty input', () => {
    expect(pickDistinctiveFeature(null)).toBeNull();
    expect(pickDistinctiveFeature(undefined)).toBeNull();
    expect(pickDistinctiveFeature({})).toBeNull();
  });

  it('prefers beard over hat over glasses', () => {
    expect(pickDistinctiveFeature({
      beard: 'beard.goatee',
      hat: 'hat.cowboy',
      glasses: 'glasses.shades',
    })).toBe('Goatee');
  });

  it('falls through beard.none to hat', () => {
    expect(pickDistinctiveFeature({
      beard: 'beard.none',
      hat: 'hat.cap',
    })).toBe('Baseball Cap');
  });

  it('falls through to hair when no beard/hat/glasses', () => {
    expect(pickDistinctiveFeature({
      beard: 'beard.none',
      hat: 'hat.none',
      hair: 'hair.long',
    })).toBe('Long');
  });

  it('skips "None" / "Clean Shaven" / ".none" entries', () => {
    expect(pickDistinctiveFeature({
      beard: 'beard.none',  // Clean Shaven
      hat: 'hat.none',       // None
      glasses: 'glasses.none',
      hair: 'hair.none',
      eyes: 'eyes.round',
    })).toBe('Round');
  });

  it('returns null when every category is "none"', () => {
    expect(pickDistinctiveFeature({
      beard: 'beard.none',
      hat: 'hat.none',
      glasses: 'glasses.none',
      hair: 'hair.none',
    })).toBeNull();
  });

  it('ignores unknown feature ids (treats as absent)', () => {
    expect(pickDistinctiveFeature({
      beard: 'beard.imaginary',
      hat: 'hat.cowboy',
    })).toBe('Cowboy Hat');
  });
});

describe('deriveAutoName — user-typed wins', () => {
  it('returns user-typed name and nameSource=user', () => {
    expect(deriveAutoName({ name: 'Mike' }, null)).toEqual({
      name: 'Mike',
      nameSource: 'user',
    });
  });

  it('trims whitespace from typed name', () => {
    expect(deriveAutoName({ name: '  Mike  ' }, null).name).toBe('Mike');
  });

  it('user-typed wins over seatContext', () => {
    expect(deriveAutoName({ name: 'Mike' }, { seat: 3 })).toEqual({
      name: 'Mike',
      nameSource: 'user',
    });
  });
});

describe('deriveAutoName — seatContext fallback', () => {
  it('uses "Seat N — feature" when distinctive feature present', () => {
    const result = deriveAutoName(
      { name: '', avatarFeatures: { beard: 'beard.goatee' } },
      { seat: 3 },
    );
    expect(result).toEqual({ name: 'Seat 3 — Goatee', nameSource: 'auto' });
  });

  it('uses "Seat N" when no distinctive features picked', () => {
    expect(deriveAutoName(
      { name: '', avatarFeatures: { beard: 'beard.none', hat: 'hat.none' } },
      { seat: 5 },
    )).toEqual({ name: 'Seat 5', nameSource: 'auto' });
  });

  it('treats empty name same as missing name', () => {
    expect(deriveAutoName({ name: '   ' }, { seat: 3 })).toEqual({
      name: 'Seat 3',
      nameSource: 'auto',
    });
  });

  it('handles seatContext with extra fields (sessionId etc.)', () => {
    expect(deriveAutoName(
      { avatarFeatures: { hat: 'hat.cap' } },
      { seat: 7, sessionId: 42 },
    )).toEqual({ name: 'Seat 7 — Baseball Cap', nameSource: 'auto' });
  });

  it('requires numeric seat (skips to timestamp fallback if seat is invalid)', () => {
    const result = deriveAutoName({}, { seat: 'invalid' });
    expect(result.nameSource).toBe('auto');
    expect(result.name).toMatch(/^Player \d{6}$/);
  });
});

describe('deriveAutoName — timestamp fallback', () => {
  it('produces "Player HHMMSS" when no name and no seatContext', () => {
    const fixed = new Date('2026-04-16T13:45:09Z');
    const fixedLocal = new Date(fixed.getFullYear(), fixed.getMonth(), fixed.getDate(), 13, 45, 9);
    const result = deriveAutoName({}, null, () => fixedLocal);
    expect(result.name).toBe('Player 134509');
    expect(result.nameSource).toBe('auto');
  });

  it('zero-pads single-digit hour/minute/second', () => {
    const t = new Date(2026, 3, 16, 3, 4, 5);
    const result = deriveAutoName({}, null, () => t);
    expect(result.name).toBe('Player 030405');
  });
});
