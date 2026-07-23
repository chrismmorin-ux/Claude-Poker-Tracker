# Load-bearing source files (detected) — run-sweep-2026-07-22

Heuristic: named prominence + tested + doc-referenced (CLAUDE.md / POKER_THEORY.md / README / docs/).

| File / Directory | JS files | LOC | Tests? | Doc refs | Strength |
|------------------|----------|-----|--------|----------|----------|
| src/utils/exploitEngine/ | 41 | 17,769 | 52 test files | CLAUDE.md (own sub-CLAUDE.md), POKER_THEORY §5-§7 | strong |
| src/utils/rangeEngine/ | 11 | 1,595 | 12 | own sub-CLAUDE.md, RANGE_ENGINE_DESIGN.md | strong |
| src/utils/pokerCore/ | 10 | 3,025 | 12 | CLAUDE.md rules, POKER_THEORY | strong |
| src/utils/handAnalysis/ | 8 | 1,982 | 6 | prog scope, POKER_THEORY §5 | strong |
| src/utils/icmEngine/ | 4 | 334 | 2 | POKER_THEORY §10, memory | strong |
| src/utils/pushFoldEngine/ | 5 | 284 | 1 | POKER_THEORY §10, memory | strong |
| src/utils/heroState/ | 8 | 2,003 | 9 | HERO_STATE_DESIGN.md, prog scope | strong |
| src/utils/anchorLibrary/ | 20 | 4,131 | 25 | prog scope, ADRs | strong |
| src/utils/assumptionEngine/ | 8 | 2,611 | 12 | prog scope | medium (doc refs thinner) |
| src/utils/tournamentEngine/ | 4 | 324 | 3 | POKER_THEORY §10 | strong |
| src/utils/skillAssessment/ | 10 | 1,941 | 19 | prog scope, SCF memory | medium |
| src/utils/potCalculator.js | 1 | 539 | yes (suite) | prog scope, INV-POT-* | strong |

Notes:
- `villainDecisionModel/` and `refresher/` from prog scope file_patterns do NOT exist as directories — villain decision logic lives inside `exploitEngine/` (gameTreeEquity.js comboActionProbabilities, foldEquityCalculator.js, villainProfileBuilder.js). Scope-pattern staleness, not a coverage hole.
- `gameTreeEvaluator*.js`, `bayesianConfidence*.js`, `foldEquityCalc*.js` singletons at `src/utils/` do not exist — current homes are inside exploitEngine/ (bayesianConfidence.js, gameTreeEquity.js, foldEquityCalculator.js).
- Key single files inside exploitEngine (all tested + doc-named): monteCarloEquity.js, gameTreeEquity.js, generateExploits.js, villainProfileBuilder.js, foldEquityCalculator.js, poolBaseline.js (NEW 2026-06-21), bayesianConfidence.js, statRules.js.
