---
conceptId: ip-cbet-defense-medium-LATE
title: IP Cbet Defense — Medium Boards vs LATE Position
tier: 3
leakTagIds:
  - hero-ip-cbet-overfold
frameworkIds: []
test_substrate: pending
citation:
  source: POKER_THEORY.md §6.2 (MDF) + §3.1 (Board Texture Classification)
  source_line: null
versionLineage:
  version: 1
  authored_at: 2026-05-05
  amended_at: null
  amendment_reason: null
---

## Exposition

This concept narrows the umbrella `cbet-defense-cluster` to one cell: defending IP from LATE-position cbettors on medium-texture boards. Reading the umbrella first is recommended — it covers MDF math + the population overfold pattern. This sub-lesson covers what changes when texture moves from dry to medium.

A medium board has one of three structural properties: (1) one connected gap that opens straight draws (986r, 875r), (2) one paired card that creates trips/full-house equity (884r, KK4r), or (3) one flush draw on rainbow (K83 with two spades, J62 with two hearts). Examples: 9♣8♠6♥, 8♠8♣4♦, K♠8♥3♥. These textures sit between dry and wet — villain's range has more equity than on dry, less than on wet.

What that means in practice:

- **Villain's value combos expand.** On 986r vs CO, value includes top-pair (T9-A9, ~12 combos), overpairs (TT+, ~24 combos), two-pair (98s, 86s, 96s combos), sets (99/88/66 = 9 combos), and the occasional made straight (T7s/75s pickups). Roughly 2x the value-combo count vs dry.
- **Villain's bluffs have meaningful equity.** A bluff with K♣Q♣ on 9♣8♠6♥ has gutshot + overcard outs ≈ 20% equity to improve. A bluff with 5♠4♠ on 9♠8♠6♥ has open-ended + flush draw ≈ 45% equity. Bluffs that have equity aren't pure bluffs — they're semi-bluffs, which means denying-equity defense isn't free.
- **Solver baseline: 58-62% defend** (per cluster umbrella enumeration). Solver folds *more* on medium than dry because villain's bluffs have equity to realize. The leak rule's threshold is calibrated to this lower baseline; folds above ~70% on medium-LATE still trigger overfold detection, but the gap to solver is smaller than on dry.

The composition rule on medium-LATE: defend skews toward holdings with direct equity (made hands, draws, big overcards) and folds raw missed broadway without backdoor. The mistake to avoid is over-defending — calling K♣2♣ "because I have backdoor flush" on 986r is a leak in the opposite direction.

## Worked example

**Spot 1 — call.** Hero BB holds T♠9♠ on 9♣8♠6♥ vs CO ½-pot cbet. Pot odds: needs 25% equity. T9 on 986r is top-pair-good-kicker with one straight card (the T) — vs villain's combined value+bluff range, ≈ 50% raw equity. Plus position to extract value or fold to turn pressure. **Call** (or even raise) is standard.

**Spot 2 — fold.** Hero BB holds A♠4♣ on 9♣8♠6♥ vs CO ½-pot cbet. A4o on 986r has 3 overcard outs (Ace) and gutshot via 7 (4 outs) — about 7 outs / 14% raw turn equity. Sounds defendable, but: villain's range on this texture has many made straights (75s, T7s, 76s) that block the gutshot; the Ace overcard is ahead of villain's bluffs but loses to value. Effective equity ~17%, below 25% pot odds. **Fold** here is correct — and *not* the leak.

The pattern to internalize: medium-LATE rewards selective defense, not blanket defense. Hands with 1 out + position aren't enough; hands with 2 categories of equity (overcard + backdoor draw, or pair + draw) are.

## Success criteria

Internalized when the user, on a one-axis medium board (one paired, one connected, OR one flush draw — not multiple) facing a half-pot IP cbet from LATE position, can within 8 seconds (a) name MDF for the bet size (67% half-pot), (b) classify their hand as direct-equity (made or strong-draw) / backdoor-only / no-equity, and (c) defend the first category, fold the third, and assess the middle category against pot odds rather than defaulting either way.
