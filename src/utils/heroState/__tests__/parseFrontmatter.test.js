/**
 * @file Tests for src/utils/heroState/parseFrontmatter.js
 */

import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../parseFrontmatter.js';

describe('parseFrontmatter', () => {
  it('parses simple key: value scalars', () => {
    const md = `---
archetypeId: PF_OPEN_RFI
family: PREFLOP_OPEN
---
body text`;
    const { meta, body } = parseFrontmatter(md);
    expect(meta).toEqual({ archetypeId: 'PF_OPEN_RFI', family: 'PREFLOP_OPEN' });
    expect(body).toBe('body text');
  });

  it('parses multiline literal block scalar (|)', () => {
    const md = `---
voiceNotes: |
  Hand-conditioned headline.
  Range-config branches.
family: PREFLOP_OPEN
---
body`;
    const { meta } = parseFrontmatter(md);
    expect(meta.voiceNotes).toBe('Hand-conditioned headline.\nRange-config branches.');
    expect(meta.family).toBe('PREFLOP_OPEN');
  });

  it('parses string array', () => {
    const md = `---
slotsUsed:
  - handContext.hand
  - situation.positionClass
  - plan.primary.sizing
---
body`;
    const { meta } = parseFrontmatter(md);
    expect(meta.slotsUsed).toEqual([
      'handContext.hand',
      'situation.positionClass',
      'plan.primary.sizing',
    ]);
  });

  it('returns body unchanged when no frontmatter', () => {
    const md = '## Just a heading\n\nNo frontmatter here.';
    const { meta, body } = parseFrontmatter(md);
    expect(meta).toEqual({});
    expect(body).toBe(md);
  });

  it('returns empty meta + body when input is malformed (no closing ---)', () => {
    const md = `---
archetypeId: PF_OPEN_RFI
no closing fence`;
    const { meta, body } = parseFrontmatter(md);
    expect(meta).toEqual({});
    expect(body).toBe(md);
  });

  it('returns empty result for non-string input', () => {
    expect(parseFrontmatter(null)).toEqual({ meta: {}, body: '' });
    expect(parseFrontmatter(undefined)).toEqual({ meta: {}, body: '' });
    expect(parseFrontmatter(42)).toEqual({ meta: {}, body: '' });
  });

  it('strips quotes from quoted string values', () => {
    const md = `---
archetypeId: "PF_OPEN_RFI"
family: 'PREFLOP_OPEN'
unquoted: PF_3BET
---
body`;
    const { meta } = parseFrontmatter(md);
    expect(meta.archetypeId).toBe('PF_OPEN_RFI');
    expect(meta.family).toBe('PREFLOP_OPEN');
    expect(meta.unquoted).toBe('PF_3BET');
  });

  it('handles mixed scalar + multiline + array', () => {
    const md = `---
archetypeId: FLOP_3BP_HU_OOP_CBET
family: FLOP_3BP_HU_CBET
voiceNotes: |
  Hand-conditioned headline. Mirrors §5.2 worked example.
slotsUsed:
  - handContext.hand
  - plan.primary.sizing
---
body content here`;
    const { meta, body } = parseFrontmatter(md);
    expect(meta.archetypeId).toBe('FLOP_3BP_HU_OOP_CBET');
    expect(meta.family).toBe('FLOP_3BP_HU_CBET');
    expect(meta.voiceNotes).toBe('Hand-conditioned headline. Mirrors §5.2 worked example.');
    expect(meta.slotsUsed).toEqual(['handContext.hand', 'plan.primary.sizing']);
    expect(body).toBe('body content here');
  });

  it('skips comment lines (# ...)', () => {
    const md = `---
# this is a comment
archetypeId: PF_OPEN_RFI
# another comment
family: PREFLOP_OPEN
---
body`;
    const { meta } = parseFrontmatter(md);
    expect(meta).toEqual({ archetypeId: 'PF_OPEN_RFI', family: 'PREFLOP_OPEN' });
  });

  it('handles CRLF line endings', () => {
    const md = '---\r\narchetypeId: PF_OPEN_RFI\r\n---\r\nbody';
    const { meta, body } = parseFrontmatter(md);
    expect(meta.archetypeId).toBe('PF_OPEN_RFI');
    expect(body).toBe('body');
  });

  it('parses an empty value as empty string', () => {
    const md = `---
key1: PF_OPEN_RFI
key2:
key3: another
---
body`;
    const { meta } = parseFrontmatter(md);
    expect(meta.key1).toBe('PF_OPEN_RFI');
    expect(meta.key2).toBe(''); // no inline value, no list — empty string
    expect(meta.key3).toBe('another');
  });

  it('parses real PF_OPEN_RFI frontmatter from shipped templates', () => {
    const md = `---
archetypeId: PF_OPEN_RFI
family: PREFLOP_OPEN
voiceNotes: |
  Hand-conditioned headline. Body anchors on range construction
  + tight-vs-wide flop config. Branches cover the three responses
  hero faces (call from BTN, 3bet from later position, 3bet from
  blinds). Mirrors §5.1 worked example (AJo HJ).
slotsUsed:
  - handContext.hand
  - handContext.handClass
  - situation.positionClass
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.rangeConfig.tight.bias
  - plan.rangeConfig.wide.bias
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} on {{situation.positionClass}} — standard open.**`;
    const { meta, body } = parseFrontmatter(md);
    expect(meta.archetypeId).toBe('PF_OPEN_RFI');
    expect(meta.family).toBe('PREFLOP_OPEN');
    expect(meta.voiceNotes).toContain('Mirrors §5.1');
    expect(meta.slotsUsed).toHaveLength(10);
    expect(meta.slotsUsed[0]).toBe('handContext.hand');
    expect(meta.slotsUsed[9]).toBe('plan.branches[*].rationale');
    expect(body).toContain('## Headline');
    expect(body).toContain('{{handContext.hand}}');
  });
});
