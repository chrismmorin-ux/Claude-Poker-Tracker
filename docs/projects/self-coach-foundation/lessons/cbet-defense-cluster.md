---
conceptId: cbet-defense-cluster
title: IP Cbet Defense — Calibrating Your Fold Rate
tier: 3
leakTagIds:
  - hero-ip-cbet-overfold
frameworkIds: []
test_substrate: pending
citation:
  source: POKER_THEORY.md §6.2 (MDF + auto-profit)
  source_line: null
versionLineage:
  version: 2
  authored_at: 2026-05-03
  amended_at: 2026-05-04
  amendment_reason: "Reframed as cluster umbrella per WS-148 / SPR-033 high-granularity decision. Sub-concepts enumerated below; per-cell lessons authored in WS-149."
---

## Exposition

IP cbet defense is governed by minimum defense frequency (MDF). When facing a bet of size B into pot P, the math says hero needs to defend at least P / (P + B) of their continuing range to prevent villain's bluffs from being automatically profitable. For a half-pot cbet, that's 67%; for a two-thirds cbet, 60%; for pot-sized, 50%.

Live opponents rarely read solver charts. Most over-cbet — the default action is "fire" because they were the preflop raiser. That means villain's cbetting range typically contains more bluffs than solver, which makes wider defense profitable, not balanced.

The reverse leak — overfolding — is more common than underfolding among recreational players. The reasoning is "I missed; fold." That ignores realized equity from one more card and gives villain auto-profit on their bluff frequency. A solver's IP defending range vs a half-pot cbet on most flops sits around 60-65%; if hero folds 75%+, every bluff villain throws prints money.

The bigger lever than position is **board texture**. Dry boards justify wider defense (villain has fewer value combos because they didn't connect either); wet boards justify slightly tighter (more draws + more two-pair-or-better in villain's range). The position split (LATE vs BUTTON) shifts MDF less than texture does, but matters at the margins because BTN ranges are wider than LATE-position ranges, which translates to a slightly wider defending range.

This umbrella concept covers six baseline-distinct situation cells. Per the SCF granularity floor, each cell is its own concept (sub-lesson) because the solver baseline differs:

- **ip-cbet-defense-dry-LATE** — defending IP from LP/HJ/CO on dry boards (K72r, A52r, J83r). Solver baseline ~62-65% defend.
- **ip-cbet-defense-dry-BUTTON** — defending IP from BTN on dry boards. Solver baseline ~65-68% defend (BTN range widest).
- **ip-cbet-defense-medium-LATE** — defending IP from LP/HJ/CO on medium boards (T96ss, J85r, Q97). Baseline ~58-62%.
- **ip-cbet-defense-medium-BUTTON** — defending IP from BTN on medium boards. Baseline ~60-65%.
- **ip-cbet-defense-wet-LATE** — defending IP from LP/HJ/CO on wet boards (T98ss, JT9r, 765ss). Baseline ~55-60%.
- **ip-cbet-defense-wet-BUTTON** — defending IP from BTN on wet boards. Baseline ~58-62%.

Per-cell lesson files land in WS-149 ongoing. The detector currently fires on whichever cell crosses the n=30 threshold first; the leak record carries the situation key, so the badge can route to the most-specific lesson once it exists.

## Worked example

**Spot 1 (dry-LATE):** Hero on CO with 7♠5♠. Hero opened to 2.5bb, BB called, flop K♥7♣2♦ ($6 pot). BB cbets $2 (33% pot).

Pot odds: $2 to win $8 → need 20% equity. 75 on K72r has ~25% raw equity (pair of sevens with 3-outer to two-pair, gutshot with the 5). Plus equity-realization is excellent IP. **Call** is solidly +EV. Folding here is the leak.

**Spot 2 (medium-BUTTON):** Hero on BTN with K♣J♣. Hero opened to 2.5bb, BB called, flop 9♠4♥3♣ ($6 pot). BB donk-leads $4 (66% pot).

Pot odds: $4 to win $10 → need 28.5%. KJ on 943r has ~45% raw equity (overcards + backdoor straight + backdoor club draw). Even though hero missed, equity is well above pot odds. **Call** is +EV; backdoors will sometimes complete and overcards have showdown value.

## Success criteria

Internalized when the user can compute defending-range minimum-defense frequency for half-pot, two-thirds pot, and pot-sized cbet sizings within 10 seconds at the table without reaching for paper or the app, and can articulate when to deviate (villain over-cbets → wider defense; villain rarely cbets → tighter defense). For mastery at the cluster level, the user can also state which of the six sub-cells (texture × position) shifts the baseline up vs down without consulting the table.
