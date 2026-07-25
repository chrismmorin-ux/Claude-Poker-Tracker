# Mass population data — source selection, mining results, and import plan (WS-262)

Date: 2026-07-25 · Status: **GO — executed through the research phase** (founder-directed; scope extended beyond the options-memo deliverable by founder instruction "do it")
Findings artifact: https://claude.ai/code/artifact/06797515-5340-4b72-9e80-77f3bcdead1f

## Decision summary

| Question (from WS-262) | Answer |
|---|---|
| Source | **uoftcprg/phh-dataset**, HandHQ subset: 21,606,087 real-money NLHE cash hands, 6 networks (PS/PTY/IPN/FTP/ABS/ONG), 25NL–1000NL, July 2009, PHH format, showdown hole cards, stable per-player pseudonyms. GitHub (MIT) + Zenodo DOI 10.5281/zenodo.10796885 (CC-BY 4.0). |
| Licensing posture | Clean. Published academic dataset; no scraping by us; long-term we retain only aggregate count tables. No legal-safety escalation needed. Rejected alternatives: IRC DB (play-money era, poor fit), commercial datamined HH vendors (ToS-gray, unnecessary). |
| Ingestion shape | As specified: per-segment **(k, n) count pairs** for STAT_COUNT_FIELDS, plus new aggregate families (fold-vs-size, barrel chains, river showdown composition). Tiny JSON, trivial IDB footprint. |
| Trust tier | **Reference-class** (Exploit Model 3-class doctrine). Never masquerades as founder-observed pool; provenance registry entry required at import (prog-data-provenance). |
| Segmentation | Maps onto `segmentKey` (`online/<stake>`) with a **new seat-count dimension needed** (6-max vs full-ring differ on every stat). Sequence import after WS-260 canonicalization. |
| Cap policy | Empirical answer, not just a cap: between-player overdispersion implies per-stat effective prior weights ≈ **vpip 10 · foldTo3Bet 10 · cbet 13 · pfr 21 · foldToCbet 22 · threeBet 35**. `PRIOR_WEIGHT=10` validated (vpip); `POOL_PRIOR_MAX_PSEUDOCOUNT=200` refuted (~20× too confident). |

## What was mined (local pipeline, outside repo)

- Pipeline: `C:\Users\chris\data\phh-mining\phh_miner.py` (+ `analyze.py`); aggregates in `C:\Users\chris\data\phh-mining\out\` (per site×stake JSON + `combined.json` + `report.md`).
- Stat semantics mirror `tendencyCalculations.js` exactly — including the foldTo3Bet definition quirk (counts folds facing any raise). The **true** opener-facing-3bet response was mined separately: fold 49.9% / call 38.8% / 4-bet 11.0% (n=1.83M).
- Raw data: blobless sparse clone at `C:\Users\chris\data\phh-dataset` (working tree cleared after mining; git pack retained — any directory re-materializes with `git sparse-checkout add`, no re-download).
- Dedup-checked (0% duplicate hand IDs in a 300-file sample). HU tables excluded from all headline numbers.

## Headline empirical results

See the findings artifact for the full nine maxims. Engine-relevant deltas:

1. Called big-river bets: 76–83% two-pair+, ≤7% air — pool bluff share ~⅕ of equilibrium. River fold rates vs big sizings run 12–16pp past bluff-breakeven (fold 71.5% vs pot–1.5×, 76.0% vs overbet). Both sides of river honesty confirmed at scale.
2. Barrel funnel baseline: turn continuation 40.0%, river continuation after double barrel 39.4% (→ ~16% of c-bets triple). Field-frame seed for the pipeline/barrel-tree doctrine.
3. Fold-vs-size curves per street on 10.6M decisions (small turn bets fold only 25.9% — stickiest cell; raise rates collapse monotonically with size, 17.7%→1.9%).
4. STAT_PRIORS scorecard: vpip/pfr/cbet/foldTo3Bet close; foldToCbet low by ~5–10pp; threeBet high for small stakes. Full table in artifact.
5. 6-max vs full-ring: distinct populations on every stat at every stake (VPIP 28.6 vs 22.0 at 25NL) → seat-count belongs in the segment key.
6. Player-weighted vs hand-weighted VPIP: 0.37–0.41 vs 0.29 (multitabling regs) — live seeding should prefer player-weighted numbers.

## Follow-up work (to be ticketed via /workstream — deliberately not queue-edited here)

1. **Import**: Reference-tier aggregate table into `poolBaseline.js` path + per-stat prior weights replacing the single 200 cap + provenance registry entry (SRC-new). Depends on WS-260.
2. **Mining pass 2**: per-spot pot sizes (money-weighted maxim/study ranking — founder factor), concealment premium (perceived-range factor — founder factor), position-level open/fold trees, board-texture c-bet splits.
3. **Bluff triggers surface**: founder-named model gap ("when to bluff"); Maxim II is the Field-frame basis.
4. **Domain review**: foldTo3Bet definition (evidence: true 49.9% vs tracker-definition 78–86% on identical hands) — extends the WS-236 domain flag.
5. **Export-coverage bug** (independent): `exportAllData` omits `anchorObservations` (owner-captured judgment, irrecoverable) — backup gap worth its own ticket.

## Caveats (binding)

- July 2009 era; Reference-class only; founder's accumulating data overrides.
- Online pools only — never blends into live segments (domain spec, ratified 2026-07-22).
- Showdown composition is a censored (called-bets-only) sample and is labeled as the call-decision conditional it actually is.
