---
conceptId: flop-vs-donk-defense-cluster
title: Flop vs Donk Lead — Reading the Polarization Signal
tier: 4
leakTagIds:
  - hero-flop-vs-donk-misresponse
frameworkIds: []
test_substrate: pending
citation:
  source: POKER_THEORY.md §6.4 (donk-lead reads) §7.1 (polarized vs merged ranges)
  source_line: null
versionLineage:
  version: 1
  authored_at: 2026-05-06
  amended_at: null
  amendment_reason: null
---

## Exposition

A "donk lead" is when villain — the preflop caller — bets first on the
flop instead of checking to the preflop aggressor. In solver play donks
are rare (~2-5% frequency) and almost always **polarized**: villain
either has a value hand they want to protect (sets, two pair, or strong
draws on wet boards) or is bluffing as part of a balanced strategy.

In live play, donks come from two recognizable populations:

- **Passive donker:** Recreational player who hit a piece and wants to
  "see where they're at" or "stop the cbet." Their donk range is mostly
  weak made hands (middle pair, weak draws) and occasional misclicks.
  Hero's correct response: defend wide with bluff-catchers, raise
  thinly for value, fold only the worst air.
- **Aggressive donker:** Studied or savvy player using the donk as a
  range-merging tool (often on boards that favor the BB's range). Their
  donk is more polarized — strong made hands + select bluffs. Hero's
  correct response: fold marginal hands, call only with hands that
  beat villain's value range (or bluff-catch with blockers).

The leak this rule detects is **mis-calibrated fold rate vs donk leads
in aggregate** — hero either over-folds (treating every donk as polarized
when most opponents donk passively) or under-folds (treating every donk
as a passive-donker bluff when villain is in fact value-betting). The
v1 baseline is averaged across donker styles; v2 will split by
villainProfile.donkStyle when that data is wired into the bucket.

For v1, the rule fires on **over-folding** specifically (delta from
baseline ≥ 5pp upward) — under-folding is its own future direction. The
baseline ~45-50% fold rate represents an averaged response and carries
lower confidence (0.75 vs cbet-defense's 0.80) because the donker-style
mixture in the user's pool is unobserved.

This umbrella concept covers six baseline-distinct situation cells
(texture × position):

- **flop-vs-donk-defense-dry-LATE / -BUTTON** — donk leads on dry boards from LP/HJ/CO/BTN. Baselines ~48-50%.
- **flop-vs-donk-defense-medium-LATE / -BUTTON** — donk leads on medium boards. Baselines ~46-48%.
- **flop-vs-donk-defense-wet-LATE / -BUTTON** — donk leads on wet boards. Baselines ~43-45%.

Per-cell lessons + donker-style splitting land in v2 (deferred).

## Worked example

**Spot 1 (medium-LATE):** Hero on CO opens to 2.5bb, BB calls. Flop
T♠8♥3♦ ($6 pot). BB donk-leads $4 (66% pot).

Read first: who is BB? If BB is a recreational player (passive donker
profile), this donk is most likely a weak made hand (T-x or 8-x) or a
middling draw they want to protect equity on. Hero's range should be
wide here — overpairs (TT+ are rare in CO open ranges that flatted),
top-pair-good-kicker (AT/KT/QT), strong draws (jack-nine, queen-jack
for double gutter). Folding hands like A♠J♠ (overcards + backdoor
flush) is the leak.

If BB is studied (aggressive donker), the donk is polarized. Hero
should fold marginal made hands (8-x without a kicker) and call with
hands that have showdown value AND bluff-catch potential.

**Spot 2 (wet-BUTTON):** Hero on BTN opens to 2.5bb, BB calls. Flop
J♠T♠9♥ ($6 pot). BB donk-leads $5 (83% pot).

Wet board, large sizing — both populations donk this for similar reasons
(protect equity on a draw-heavy board). Hero's range needs to defend
with: top pair good kicker (KJ, QJ, JT-ish), straights and sets if any,
and the strongest draws (KQ for the open-ender + flush draw, A♠X♠
for nut flush draw). Calling with weak top pair (J5s, J6s) is borderline
on wet textures because villain's value range is robust. Folding
hands like A♠5♠ (nut flush draw) is the leak.

## Success criteria

Internalized when the user pauses on a donk lead at the table to read
the donker first (passive vs aggressive) before deciding the
fold-call-raise distribution, rather than defaulting to a fixed
response. For cluster mastery, the user can articulate why donk
defense baselines are texture-conditioned (dry → fold more, wet →
fold less) and why the baseline carries lower confidence than
cbet-defense baselines (donker-style mixture is unobserved at the
bucket level until v2).
