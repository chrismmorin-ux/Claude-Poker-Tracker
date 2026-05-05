import { describe, it, expect } from 'vitest';
import { deriveAutoName, pickDistinctiveFeature } from '../playerAutoName';

// Phase 7 (PIO G4 v2 §11): pickDistinctiveFeature now reads Phase-3
// identification fields directly (facialHair / headwear / eyewear /
// hairLength) instead of the legacy avatarFeatures sub-object.

describe('pickDistinctiveFeature', () => {
  it('returns null for null/undefined/empty input', () => {
    expect(pickDistinctiveFeature(null)).toBeNull();
    expect(pickDistinctiveFeature(undefined)).toBeNull();
    expect(pickDistinctiveFeature({})).toBeNull();
  });

  it('prefers facialHair over headwear over eyewear', () => {
    expect(pickDistinctiveFeature({
      facialHair: 'goatee',
      headwear: 'cowboy',
      eyewear: 'sunglasses',
    })).toBe('Goatee');
  });

  it('falls through clean facialHair to headwear', () => {
    expect(pickDistinctiveFeature({
      facialHair: 'clean',
      headwear: 'cap',
    })).toBe('Cap');
  });

  it('falls through to hairLength when no facialHair / headwear / eyewear', () => {
    expect(pickDistinctiveFeature({
      facialHair: 'clean',
      headwear: 'none',
      hairLength: 'long',
    })).toBe('Long Hair');
  });

  it('skips "none" / "clean" entries', () => {
    expect(pickDistinctiveFeature({
      facialHair: 'clean',
      headwear: 'none',
      eyewear: 'none',
      hairLength: 'short',  // "Short" not in distinctive labels
    })).toBeNull();
  });

  it('returns null when every category is none/missing', () => {
    expect(pickDistinctiveFeature({
      facialHair: 'clean',
      headwear: 'none',
      eyewear: 'none',
    })).toBeNull();
  });

  it('ignores unknown values (treats as absent)', () => {
    expect(pickDistinctiveFeature({
      facialHair: 'imaginary',
      headwear: 'cowboy',
    })).toBe('Cowboy Hat');
  });

  it('maps each Phase-3 facialHair value', () => {
    expect(pickDistinctiveFeature({ facialHair: 'stubble' })).toBe('Stubble');
    expect(pickDistinctiveFeature({ facialHair: 'mustache' })).toBe('Mustache');
    expect(pickDistinctiveFeature({ facialHair: 'goatee' })).toBe('Goatee');
    expect(pickDistinctiveFeature({ facialHair: 'full' })).toBe('Full Beard');
    expect(pickDistinctiveFeature({ facialHair: 'soul-patch' })).toBe('Soul Patch');
  });

  it('maps each Phase-3 headwear value', () => {
    expect(pickDistinctiveFeature({ headwear: 'cap' })).toBe('Cap');
    expect(pickDistinctiveFeature({ headwear: 'beanie' })).toBe('Beanie');
    expect(pickDistinctiveFeature({ headwear: 'visor' })).toBe('Visor');
    expect(pickDistinctiveFeature({ headwear: 'fedora' })).toBe('Fedora');
    expect(pickDistinctiveFeature({ headwear: 'cowboy' })).toBe('Cowboy Hat');
  });

  it('maps each Phase-3 eyewear value', () => {
    expect(pickDistinctiveFeature({ eyewear: 'clear' })).toBe('Glasses');
    expect(pickDistinctiveFeature({ eyewear: 'sunglasses' })).toBe('Sunglasses');
    expect(pickDistinctiveFeature({ eyewear: 'readers' })).toBe('Readers');
    expect(pickDistinctiveFeature({ eyewear: 'aviators' })).toBe('Aviators');
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
      { name: '', facialHair: 'goatee' },
      { seat: 3 },
    );
    expect(result).toEqual({ name: 'Seat 3 — Goatee', nameSource: 'auto' });
  });

  it('uses "Seat N" when no distinctive features picked', () => {
    expect(deriveAutoName(
      { name: '', facialHair: 'clean', headwear: 'none' },
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
      { headwear: 'cap' },
      { seat: 7, sessionId: 42 },
    )).toEqual({ name: 'Seat 7 — Cap', nameSource: 'auto' });
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
