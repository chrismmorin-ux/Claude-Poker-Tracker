# Program: Test Health

Status: YELLOW
Owner: eng-engine (senior-engineer persona)
Last assessed: 2026-04-11 (R7)
Last verified against code: 2026-04-11

---

## Health Criteria

| Metric | Green | Yellow | Red | Current |
|--------|-------|--------|-----|---------|
| Total test count | > 5,000 | 4,000-5,000 | < 4,000 | ~5,400 |
| Test pass rate | 100% | 99-100% | < 99% | 100% |
| Test files | > 180 | 150-180 | < 150 | ~184 |
| Extension test count | > 800 | 600-800 | < 600 | 879 |
| exploitEngine test coverage | > 500 tests | 400-500 | < 400 | 500+ |
| New module has colocated tests | Always | Sometimes | Rarely | Always |
| Test-to-source ratio | > 1:1 | 0.5-1:1 | < 0.5:1 | > 1:1 |

## Active Backlog Items

_(none currently)_

## Milestone Gates

| Gate | Status | Criteria |
|------|--------|---------|
| Core engine coverage | PASSED | All exploitEngine modules have test files (RT-5 + RT-19) |
| Extension coverage | PASSED | 879 tests across extension modules |
| Persistence coverage | PASSED | fake-indexeddb integration tests for all stores |

## Auto-Backlog Triggers

| Condition | Backlog Template | Priority |
|-----------|-----------------|----------|
| Test count drops below previous snapshot | "Test count regression: [current] vs [previous] — investigate removed tests" | P1 |
| Any test file deleted without replacement | "Test file [name] removed — verify coverage not lost" | P1 |
| New module in exploitEngine/ without __tests__/ | "Missing test coverage for [module]" | P2 |
| Pass rate below 100% in health check | "Test failures detected — [N] failing" | P0 |

## History

| Date | Status | Notes |
|------|--------|-------|
| 2026-04-06 | GREEN | Initial assessment. ~5,400 tests, 100% pass rate, all engine modules covered. |
| 2026-04-07 | GREEN | R4 roundtable. 5,401 tests, 184 files, 100% pass rate. New gap: no tests for useEquityWorker or equityWorker.js (tracked via RT-27 singleton context migration). |
| 2026-04-07 | GREEN | R5 roundtable. 5,417 tests, 185 files, 100% pass rate. Integration test gap noted (view-level tests mock all contexts). No test for usePersistence unmount flush or migration cursor errors. |
| 2026-04-11 | YELLOW | R7 roundtable. Critical gap: sidebar temporal harness tests render layer only, bypasses message handler pipeline where real bugs live. Message-level integration test harness needed (RT-51). No test for cross-handler ordering, coordinator-vs-module divergence, or tournament timer DOM detachment. |
| 2026-04-20 | YELLOW | Drills Consolidation Roundtable. Existing INV-08 violation surfaced: `src/utils/drillContent/__tests__/lessons.test.js` imports `LessonCalculators.jsx` from views/ — utils-layer test pulling from UI layer (RT-95). Consolidation proposal's "net-zero test change" claim contradicted by three new behavioral surfaces that lack coverage today: drill-picker routing, Learn unified search, Browse unified filter. Mechanical enforcement of INV-08 proposed as ESLint rule (RT-103). Main-app test count ~5,422 unchanged. No regression in existing coverage. |
