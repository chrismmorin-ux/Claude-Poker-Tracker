---
conceptId:        board-texture
title:            Board Texture & Range Asymmetry
tier:             3
leakTagIds:       ['flop-cbet-frequency-tell', 'turn-double-barrel-tell']
frameworkIds:     ['board_tilt', 'capped_range_check']
test_substrate:   drill
exposition_source:
  module:         postflopDrillContent/lessons.js
  lesson_id:      board-tilt
citation:
  source:         POKER_THEORY.md §5.6
  source_line:    null
successCriteria: |
  Internalized when the user can characterize a flop in 4 dimensions —
  high-card / connectivity / suit-connectivity / pairedness — and predict
  which preflop range (BTN-open / BB-flat / SB-3bet / etc.) holds the
  range advantage and the nut advantage on it, within 10 seconds at the
  table. The user reads "K72r" and immediately knows it favors BTN-open;
  reads "654ss" and immediately knows it favors BB-flat.
versionLineage:
  version:        1
  authored_at:    2026-05-02
  amended_at:     null
  amendment_reason: null
---

## Exposition

*Reused from `postflopDrillContent/lessons.js#board-tilt + #capped-ranges` — see exposition_source.*

Board texture is not a free variable — it interacts with each player's preflop range to produce range-vs-range asymmetries that determine who can credibly bet, raise, or check. Four dimensions characterize a flop:

1. **High-card** — does the highest card favor one range? (K72 favors aggressor's range; 654 favors caller's range.)
2. **Connectivity** — how many straight draws does the board enable? (Disconnected dry K72 vs connected wet 765.)
3. **Suit connectivity** — how many flush draws? (Rainbow vs two-tone vs monotone.)
4. **Pairedness** — does the board have a pair already? (K72 vs K77 vs 222.)

These four dimensions interact. K72r (high-card BTN-favored, disconnected, rainbow, unpaired) is the maximally BTN-favored texture. 654ss (low-card BB-favored, connected, two-tone, unpaired) is maximally BB-favored. Most boards live in between.

Capped ranges are a related concept. A range is "capped" when it has a structural ceiling — the player CAN'T have certain hands because they would have raised preflop. BB's flat range vs CO open is capped at TPTK+ (no AA/KK/QQ/AK because those 3-bet). So on AKQ rainbow, BB CAN'T have the nuts; CO's range CAN. This is leverage for the uncapped player: they can credibly bet large because their range contains nut-region combos and villain's doesn't.

The opposite of capped is "uncapped" — a range that contains the nut region for the texture. CO's open range on AKQ is uncapped (AA / KK / AK / AQ all in). BB's flat range on AKQ is capped.

The simplest rule: when YOUR range is uncapped and villain's is capped, betting larger is better. When YOUR range is capped and villain's is uncapped, betting larger is exploited; check more.

## Worked example

CO opens vs BB flat. Three flops:

**A95dd (BB capped, CO uncapped).** CO has AA/AK/A5/A9 in range structurally; BB's flat range tops out at AQ-AT. CO bets often + bets large; BB defends with TP-weak + flush draws + pair+gutshot. CO's c-bet frequency on this texture should be ~80% small or polar large.

**962r (BB uncapped, CO range pivots).** BB's flat range is full of suited 9X / 6X / pocket pairs that connect; CO's range whiffs more (lots of broadway offsuits). BB's check is now actively defensive — the nut advantage is THIS player's. CO checks more often than on A95dd.

**T98ss (BB favored on connectivity + nuts).** BB's flat range has 87s, T9s, 98s, JTs — all connected combos that smash this flop. CO has high pairs but few straights. CO checks the most of any of the three textures; BB can lead small with a defensive frequency.

## Success criteria

Internalized when the user can characterize a flop in 4 dimensions — high-card / connectivity / suit-connectivity / pairedness — and predict which preflop range (BTN-open / BB-flat / SB-3bet / etc.) holds the range advantage and the nut advantage on it, within 10 seconds at the table. The user reads "K72r" and immediately knows it favors BTN-open; reads "654ss" and immediately knows it favors BB-flat.

---

**Test myself on this concept** is enabled (`test_substrate: 'drill'`). Tapping invokes the postflop drill engine in opt-in-test mode scoped to `frameworkIds: ['board_tilt', 'capped_range_check']`, with the scenario library spanning both frameworks.
