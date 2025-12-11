# Process Maturity Command

Calculates the current process maturity score (0-10 scale) based on compliance metrics, quality indicators, and system health.

## Usage

```bash
/process-maturity
```

## What It Does

Analyzes 6 key dimensions of process maturity and produces:
1. **Overall Maturity Score** (0-10)
2. **Trend Direction** (improving/stable/declining)
3. **Dimension Breakdown** (scores per category)
4. **Recommendations** (what to improve next)

## Maturity Dimensions

### 1. Delegation Compliance (weight: 25%)
- **Score Calculation**:
  - 0-20%: Score 0-2 (Critical)
  - 21-40%: Score 3-4 (Poor)
  - 41-60%: Score 5-6 (Fair)
  - 61-80%: Score 7-8 (Good)
  - 81-100%: Score 9-10 (Excellent)

- **Data Source**: `.claude/metrics/delegation.json`
- **Measured**: % of delegable tasks actually delegated

### 2. Error Recurrence Rate (weight: 20%)
- **Score Calculation**:
  - >20% recurring: Score 0-2
  - 15-20%: Score 3-4
  - 10-15%: Score 5-6
  - 5-10%: Score 7-8
  - <5%: Score 9-10

- **Data Source**: Git log analysis (fix: commits for same files)
- **Measured**: % of errors that recur within 7 days

### 3. Documentation Coverage (weight: 15%)
- **Score Calculation**:
  - <40% functions documented: Score 0-2
  - 40-60%: Score 3-4
  - 60-75%: Score 5-6
  - 75-90%: Score 7-8
  - >90%: Score 9-10

- **Data Source**: JSDoc analysis + QUICK_REF.md completeness
- **Measured**: % of exported functions with documentation

### 4. Test Coverage (weight: 15%)
- **Score Calculation**:
  - <60% coverage: Score 0-2
  - 60-70%: Score 3-4
  - 70-80%: Score 5-6
  - 80-90%: Score 7-8
  - >90%: Score 9-10

- **Data Source**: Test suite + coverage reports
- **Measured**: % of critical paths with tests

### 5. Context Freshness (weight: 15%)
- **Score Calculation**:
  - >30 days stale: Score 0-2
  - 15-30 days: Score 3-4
  - 8-15 days: Score 5-6
  - 3-8 days: Score 7-8
  - <3 days: Score 9-10

- **Data Source**: Git last modified dates for context files
- **Measured**: Days since context files updated vs source code

### 6. Hook Adoption Rate (weight: 10%)
- **Score Calculation**:
  - <20% advice followed: Score 0-2
  - 20-40%: Score 3-4
  - 40-60%: Score 5-6
  - 60-80%: Score 7-8
  - >80%: Score 9-10

- **Data Source**: `.claude/metrics/hook-activity.json`
- **Measured**: % of hook warnings that result in action

## Output Example

```
╔═══════════════════════════════════════════════════════════╗
║           PROCESS MATURITY SCORE                          ║
╚═══════════════════════════════════════════════════════════╝

Overall Score: 6.8 / 10 (Good) ↗️ Improving
Trend: +2.3 points over 30 days

Dimension Breakdown:
┌──────────────────────────┬───────┬────────┬────────────┐
│ Dimension                │ Score │ Weight │ Trend      │
├──────────────────────────┼───────┼────────┼────────────┤
│ Delegation Compliance    │  8/10 │  25%   │ ↗️ +4.2    │
│ Error Recurrence         │  7/10 │  20%   │ ↗️ +1.5    │
│ Documentation Coverage   │  5/10 │  15%   │ → stable   │
│ Test Coverage            │  9/10 │  15%   │ ↗️ +0.8    │
│ Context Freshness        │  4/10 │  15%   │ ↘️ -1.2    │
│ Hook Adoption            │  6/10 │  10%   │ ↗️ +2.0    │
└──────────────────────────┴───────┴────────┴────────────┘

Strengths:
✅ Delegation compliance excellent (68% → target 70%)
✅ Test coverage strong (2,643 passing tests)
✅ Error recurrence declining

Areas for Improvement:
⚠️  Context freshness declining (23 days since update)
    → Recommendation: Implement auto-update on git commit

⚠️  Documentation coverage stagnant (62% for 60 days)
    → Recommendation: Add JSDoc requirement to new functions

Next Steps:
1. Focus on context freshness (biggest gap: -6 points)
2. Maintain delegation gains (recent +4.2 improvement)
3. Continue reducing error recurrence
```

## Trend Calculation

Compares current scores to:
- **7 days ago**: Short-term trend
- **30 days ago**: Medium-term trend (primary)
- **90 days ago**: Long-term trend

Trend direction:
- **↗️ Improving**: Score increased >0.5 points
- **→ Stable**: Score changed -0.5 to +0.5 points
- **↘️ Declining**: Score decreased >0.5 points

## Maturity Levels

| Score Range | Level      | Description |
|-------------|------------|-------------|
| 0.0 - 2.0   | Critical   | Immediate intervention needed |
| 2.1 - 4.0   | Poor       | Significant gaps, high risk |
| 4.1 - 6.0   | Fair       | Basic processes in place |
| 6.1 - 8.0   | Good       | Solid foundation, room to grow |
| 8.1 - 10.0  | Excellent  | Mature, optimized system |

## When to Use

- **Weekly**: Track progress toward goals
- **After major process changes**: Validate impact
- **Monthly reviews**: Assess overall system health
- **Before proposing new rules**: Check if system can handle more

## Strategic Value

The maturity score provides:
- **Single metric** for system health
- **Objective measurement** of improvement
- **Prioritization guidance** (focus on lowest scores)
- **Confidence indicator** for reducing enforcement

High maturity (8+) signals readiness to reduce enforcement friction and trust the system.
