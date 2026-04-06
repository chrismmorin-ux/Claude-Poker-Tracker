---
last-verified-against-code: 2026-04-06
verified-by: governance-overhaul
staleness-threshold-days: 60
---

# Constraints & Assumptions

**Version**: 1.0.0 | **Last verified**: 2026-04-06

---

## Hard Constraints (Cannot Change)

| ID | Constraint | Source | Impact |
|----|-----------|--------|--------|
| HC-01 | Single active session assumption | Architecture design | No multi-user, no concurrent editing sessions |
| HC-02 | IndexedDB only (no server) | Local-first design | No cloud sync without Firebase; all data on-device |
| HC-03 | Chrome MV3 for extension | Browser requirement | No MV2 APIs, service worker lifecycle constraints |
| HC-04 | Mobile-first 1600x720 | Target device (Samsung Galaxy A22 landscape) | All UI must fit this viewport; scale factor applied |
| HC-05 | React + Vite + Tailwind stack | Established architecture | No server-side rendering, no SSR, client-only |
| HC-06 | 9-handed game format | Poker game rules | CONSTANTS.NUM_SEATS = 9, SEAT_ARRAY = [1..9] |

## Soft Constraints (Could Change with Effort)

| ID | Constraint | Effort to Change | Trigger to Revisit |
|----|-----------|-----------------|-------------------|
| SC-01 | 9-seat max | Medium (CONSTANTS.NUM_SEATS propagates widely) | If 6-max or heads-up tables needed |
| SC-02 | Ignition-only extension | Large (protocol-specific WebSocket parsing) | If supporting PokerStars, GGPoker, etc. |
| SC-03 | English-only UI | Medium (no i18n framework) | If non-English markets are a priority |
| SC-04 | No server/API backend | Large (requires auth, hosting, data migration) | If multi-device sync or social features needed |
| SC-05 | Bayesian-only analysis | Medium (analysis pipeline assumes Beta-Binomial) | If ML-based player modeling is explored |

## Assumptions (Believed True, Not Proven)

| ID | Assumption | Risk if Wrong | How to Validate |
|----|-----------|---------------|----------------|
| A-01 | Users have < 500 tracked opponents | Performance degrades — getAllHands/usePlayerTendencies do full scans | Check largest IndexedDB player count in production |
| A-02 | Game tree depth-2 is sufficient for most decisions | Sub-optimal advice in complex multi-street spots | Compare depth-2 vs depth-3 EV on benchmark hands |
| A-03 | Population priors from Bayesian engine are reasonable starting points | Wrong initial range estimates for first ~10 hands vs a new player | Track showdown prediction accuracy over time |
| A-04 | Users record actions during live play (not retrospectively) | UI optimized for real-time entry may frustrate post-session review | User behavior observation |
| A-05 | Mobile Chrome on Android is the primary runtime | Desktop browser differences (viewport, touch, memory) may cause issues | Track user agent distribution if analytics added |
| A-06 | IndexedDB quota (~50MB minimum guaranteed) is sufficient | Data loss if quota exceeded with no warning | Monitor via `navigator.storage.estimate()` |
| A-07 | Game tree eval < 100ms on target device | UI jank during live play if evaluation is slow | RT-7 (physical device profiling) will validate |

---

*Update this file when: new constraint discovered, assumption validated/invalidated, or soft constraint becomes hard/irrelevant.*
