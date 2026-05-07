---
conceptId: ip-cbet-defense-wet-LATE
title: IP Cbet Defense — Wet Boards vs LATE Position
tier: 3
leakTagIds:
  - hero-ip-cbet-overfold
frameworkIds: []
test_substrate: pending
citation:
  source: POKER_THEORY.md §6.2 (MDF) + §3.1 (Board Texture Classification) + §1.4 (Equity Realization)
  source_line: null
versionLineage:
  version: 1
  authored_at: 2026-05-05
  amended_at: null
  amendment_reason: null
---

## Exposition

This concept narrows the umbrella `cbet-defense-cluster` to one cell: defending IP from LATE-position cbettors on wet boards. Reading the umbrella first is recommended — it covers MDF math + the population overfold pattern. This sub-lesson covers what changes when texture moves from medium to wet, and where reverse-implied odds start mattering more than raw equity.

A wet board has multiple equity-axis features at once: (1) two-tone or monotone (live flush draw), (2) connected ranks (live straight draw), often (3) broadway-or-mid range that hits both ranges. Examples: T♠9♠8♣, J♥T♠9♦, K♦Q♦8♣. These textures maximize villain's texture-flexibility and equity for both bluffs and value.

What that means in practice:

- **Villain's bluffs have full equity.** A flush draw on T♠9♠8♣ has 9 outs (~36% turn equity, ~52% turn-river). An open-ender has 8 outs (~32% turn equity). When the bluff has ≥30% equity, it's a semi-bluff, and it's mathematically correct for villain to fire it — solver actually *increases* cbet bluff frequency on wet boards. The "denying-equity" framing finally matters.
- **Villain's value range is wider too.** Two-pair, sets, made straights, made flushes, top-pair-strong-kicker with backdoors. Villain's value-combo count is highest on wet boards.
- **Solver baseline: 55-60% defend** (per cluster umbrella enumeration). The lowest of the three texture buckets. Solver permits *more* folds on wet because villain's range is strongest.
- **Reverse-implied odds matter.** Calling with 88, 99, A2-no-suit on wet two-tone boards gets punished on most turn cards — flush turns kill non-suited overpairs, straight turns kill bottom-set or one-pair holdings. Raw equity meeting MDF isn't enough; the question is whether the equity *realizes* to a winning showdown.

The defense rule on wet-LATE: defend skews toward (1) hands that complete a strong made hand (top-pair-good-kicker on uncoordinated turn), (2) hands with direct nut-draw equity (nut flush draw, open-ender to nuts), (3) hands that block villain's value combos. Fold raw made hands with reverse-implied risk despite raw equity meeting MDF — this is the only board texture where "I have a pair but I'm folding" is correct over MDF.

## Worked example

**Spot 1 — call (and consider raise).** Hero BB holds A♥5♥ on J♥T♠9♥ vs CO ½-pot cbet. Pot odds: needs 25%. A5h has nut flush draw (9 outs) + gutshot to Q for the made straight (3 outs after flush discount) ≈ 30%+ turn equity, with implied odds for nut flush completion + position. **Call** standard; **raise** is reasonable when villain caps wide on this texture and folds enough to small/medium check-raise sizings (a ~3.0x raise to ~$15 into ~$5).

**Spot 2 — fold.** Hero BB holds 9♣9♦ on T♠9♠8♣ vs CO ½-pot cbet. 9d9c has middle-set (~70% raw equity vs villain's range). Sounds like an instant call, and at SPR ~3 it is — but at deeper SPRs (≥6), reverse-implied odds destroy it: any heart on turn (12 cards) gives villain straight or flush draw equity that draws live; any 7/J/Q/K on turn completes a straight that beats hero's set. The hand often becomes a one-street value bet that pays off villain's two-pair-or-better. At 100bb effective, **call is still correct** but with reduced extraction expectation. The fold version of this spot is at 200bb+ where set-mining EV is dwarfed by reverse-implied losses.

The bigger lesson — illustrative even when call is the action: wet boards punish marginal made hands more than dry boards reward them, and the math shifts based on stack depth.

## Success criteria

Internalized when the user, on a two-tone connected flop (or monotone, or three-card-straight) facing a half-pot IP cbet from LATE position, can within 10 seconds (a) name MDF for the bet size (67% half-pot), (b) identify if their hand has nut-or-near-nut draw equity (nut flush draw, open-ender to nuts, top-pair-good-kicker on partially-coordinated turn), and (c) reject made hands with reverse-implied-odds risk at deep SPR despite raw equity meeting MDF. The user can articulate the difference between "raw equity above pot odds" and "realized equity above pot odds" on this texture without conflating them.
