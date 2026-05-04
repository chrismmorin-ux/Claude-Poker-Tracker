---
conceptId:        capped-vs-uncapped-ranges
title:            Capped vs Uncapped Ranges
tier:             5
leakTagIds:       ['flop-overbet-frequency-tell', 'turn-overbet-tell']
frameworkIds:     ['capped_range_check']
test_substrate:   drill
exposition_source:
  module:         postflopDrillContent/lessons.js
  lesson_id:      capped-ranges
citation:
  source:         POKER_THEORY.md §6.4
  source_line:    null
successCriteria: |
  Internalized when the user can identify a capped vs uncapped range from a
  preflop action sequence within 5 seconds (e.g., "BB flat vs CO open is
  capped at TPTK+; CO's range is uncapped"; "SB cold-4-bet is uncapped at
  AA/KK/AK"). At the table, the user reads a betting tree and knows when
  each range is capped, where the capping threshold lives, and which
  player can credibly leverage the asymmetry with overbet sizing.
versionLineage:
  version:        1
  authored_at:    2026-05-02
  amended_at:     null
  amendment_reason: null
---

## Exposition

*Reused from `postflopDrillContent/lessons.js#capped-ranges` — see exposition_source.*

A range is "capped" when it has a structural ceiling — the player CAN'T have certain hands because they would have raised, 3-bet, or 4-bet preflop. The capping threshold depends on the preflop action sequence:

- **BB flat vs CO open:** capped at TPTK+ (no AA/KK/QQ/AK because those 3-bet preflop)
- **BTN flat vs UTG open:** capped at TPTK+ (similar; AA/KK/AK 3-bet)
- **SB cold-4-bet vs CO open + BTN 3-bet:** uncapped at AA/KK/AK (these are the only hands that 4-bet for value at this depth)
- **CO open + folded around:** uncapped (CO opens AA-22, AK-AT, KQ-K9s, QJ-QT, etc. — full range)

Capped vs uncapped is the structural input to overbet decisions. When YOUR range is uncapped and villain's is capped, betting larger is better — you have the nut region; villain doesn't; your overbet is leveraged because villain CAN'T raise you (you're polarized + uncapped + pressing on a capped range with no defense beyond TPTK).

When YOUR range is capped and villain's is uncapped, betting larger is exploited; check more, defend with the top of your capped range.

The most common capped-vs-uncapped textures:

- **AKQ rainbow** — BB flat vs CO open: BB is capped (no AA/KK/QQ); CO is uncapped (AA/AK/KK/QQ all in). CO is the overbettor.
- **A95 dry** — same shape: BB capped, CO uncapped. CO overbets.
- **862 wet (low coordinated)** — BB's flatting range has more pocket pairs and suited connectors that connect (sets, two pair, draws); CO's range has high pairs but few sets (AA/KK don't help). The asymmetry SHIFTS — BB now has more nut combos, even though BB is "capped" in the structural sense at AQ-AT. The structural cap is preserved but the texture-conditional nut advantage flips.

## Worked example

**Scenario 1: CO opens, BB flats. Flop AKQr.**
CO's range: AA / KK / QQ / AK / AQ / KQ / TT-66 (set-mining) / suited gappers. Uncapped at top.
BB's range: AQ-AT / KQ-KT / QJ-QT / TT-22 / suited connectors / suited aces. Capped at AQ.
CO is the overbettor on this texture. CO sizes 80% to pot+. BB defends top of capped range (AQ + occasional AK that BB might call-instead-of-3bet for balance).

**Scenario 2: SB cold-4-bets, CO calls. Flop A82r.**
SB's range: AA / KK / AK (cold-4-bet for value at this depth). Uncapped at the top, very narrow.
CO's range: AQ-AJ / KQ-KJ / TT-99 / suited broadway aces (all 4-bet calls). Capped at AQ.
SB is the overbettor on this texture. SB sizes 75-100% pot. CO defends with AQ-AJ + medium pairs that block sets.

**Scenario 3: BTN opens, BB flats. Flop 654ss.**
BB's range: 65s, 76s, 87s, 98s (all connect for straights or 2-pair); 22-99 (sets). Texture-conditional uncapped at the top — BB has more nut combos than BTN.
BTN's range: AA / KK / QQ / AK / etc. Top of range is overpair (AA/KK), blocked by 654 board (no straight, no flush). Capped texture-conditionally.
BTN is NOT the overbettor here despite being structurally uncapped preflop. BTN checks more often. BB can lead small with a defensive frequency (the nut advantage is BB's).

## Success criteria

Internalized when the user can identify a capped vs uncapped range from a preflop action sequence within 5 seconds (e.g., "BB flat vs CO open is capped at TPTK+; CO's range is uncapped"; "SB cold-4-bet is uncapped at AA/KK/AK"). At the table, the user reads a betting tree and knows when each range is capped, where the capping threshold lives, and which player can credibly leverage the asymmetry with overbet sizing.

---

**Test myself on this concept** is enabled (`test_substrate: 'drill'`). Tapping invokes the postflop drill engine in opt-in-test mode scoped to `frameworkIds: ['capped_range_check']`, with the scenario library filtered to capped-vs-uncapped scenarios.
