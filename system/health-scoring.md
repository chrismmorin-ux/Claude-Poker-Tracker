# Program Health Scoring Model

Canonical reference for how program health scores are computed. All commands that read or write `health_score` must use this formula.

## Score Formula

```
health_score = min(earned_score, rigor_ceiling) - penalties
```

Where:
- `rigor_ceiling` is the max reachable score based on analysis depth (see table below)
- `earned_score` is how well the program is performing within that ceiling
- `penalties` are hard caps from critical findings or staleness

---

## Rigor Ceiling Table

The ceiling is determined by the **highest-rigor analysis that has successfully completed** for this program. Higher-rigor analysis unlocks higher possible scores.

| Level | Completed Analysis | Ceiling | Example |
|-------|-------------------|---------|---------|
| 0 | Nothing — program never run | 0 | Newly created program |
| 1 | File read / heuristic report | 2 | Manual exploration, no engine |
| 2 | Single-pass engine or delta protocol | 4 | preflight delta, item-enhance |
| 3 | Suite-based check (full run) | 5 | health-check, preflight full, persona-validator |
| 4 | Multi-agent analysis (2-4 agents) | 6 | coverage-detector, domain audit engines |
| 5 | Full eng-engine baseline (6 agents + cross-critique + synthesis) | 7 | eng-engine baseline or sweep |
| 6 | Challenge protocol (adversarial review via eng-engine) | 8 | eng-engine with challenge prompt additions |
| 7 | Quality-judge validates most recent engine run | 9 | quality-judge evaluates run artifacts |
| 8 | Blind-spot protocol completed | 9 | eng-engine with blind-spot prompt additions |
| 9 | Meta-engine analysis across 3+ runs AND quality-judge passed | 10 | Full rigor — system has been deeply examined |

When multiple analyses have run, use the **highest level achieved**. The ceiling never decreases (ratchet up only).

### Mapping Protocols to Rigor Levels

| Protocol | Typical Engine | Rigor Level |
|----------|---------------|-------------|
| baseline | eng-engine | 5 |
| sweep | eng-engine | 5 |
| delta | preflight | 2 |
| challenge | eng-engine + adversarial prompts | 6 |
| blind_spot | eng-engine + blind-spot prompts | 8 |

Additional rigor from evolution engines:
- quality-judge run against program's last engine output → Level 7
- meta-engine analysis referencing this program → Level 9

---

## Earned Score

Within the ceiling, the earned score measures how well the program is actually performing:

```
raw = (finding_health * 0.35) + (protocol_currency * 0.25) 
    + (problem_class_coverage * 0.25) + (maturity_progress * 0.15)

earned_score = round(raw * ceiling)
```

### Components

**finding_health** (0.0 to 1.0):
```
penalty = (open_critical * 0.4) + (open_high * 0.2) + (open_medium * 0.1)
finding_health = max(0.0, 1.0 - penalty)
```

**protocol_currency** (0.0 to 1.0):
- For each protocol active at the program's current tier, compute: `min(1.0, effective_cadence / days_since_run)`
- Average across all active protocols
- If ANY active protocol has never run: protocol_currency = 0.0

**problem_class_coverage** (0.0 to 1.0):
```
checked_classes / total_classes
```
A problem class counts as "checked" if any protocol run has examined it (even if no findings were produced).

**maturity_progress** (0.0 to 1.0):
```
maturity.level / 4
```

---

## Penalties (Hard Caps)

These override the computed score regardless of earned score:

| Condition | Maximum Score |
|-----------|--------------|
| Any open CRITICAL finding | 4 |
| 3+ open HIGH findings | 6 |
| `block_sprint: true` AND program is stale | 2 |

### Staleness Decay

If the most recent protocol run is older than `2 * effective_cadence`:
- Score drops by 1 per additional cadence period missed
- Floor of 1 (to distinguish "stale but was healthy" from "never checked")
- Decay applies after all other computation

---

## Target Ceiling by Tier

Programs at different tiers have different expected ceiling levels. Auto-recommendations use this to determine what rigor level to suggest next.

| Tier | Target Ceiling | Rationale |
|------|---------------|-----------|
| dormant | 0 | No monitoring needed |
| watch | 4 | Delta checks sufficient |
| active | 8 | Challenge protocol required |
| critical | 10 | Full rigor required — meta-engine validated |

---

## Auto-Recommendation Priority Waterfall

When generating a program's "next best improvement" work item, use this priority order:

1. **ceiling = 0** → "Run `/pulse run {id} baseline`" (establish baseline)
2. **Has CRITICAL findings** → "Resolve CRITICAL finding {finding_id}: {title}"
3. **Any protocol overdue** → "Run `/pulse run {id} {most_overdue_protocol}`"
4. **ceiling < target for tier** → Recommend next rigor step:
   - ceiling 0-4 → "Run `/pulse run {id} baseline`"
   - ceiling 5-6 → "Run `/pulse run {id} challenge`"
   - ceiling 7 → "Run `/engine quality-judge` against last run"
   - ceiling 8 → "Run `/pulse run {id} blind_spot`"
   - ceiling 9 → "Run `/engine meta-engine` referencing this program"
5. **Problem classes uncovered** → "Run sweep focused on: {unchecked_classes}"
6. **Maturity gaps** → Action from `maturity.criteria` for next level
7. **score = 10, ceiling = target** → "All clear. Consider building new analysis for {weakest_class}"

### Auto-Recommendation Priority Score

```
base = (target_ceiling - health_score) * tier_weight
priority_score = base * phase_relevance_multiplier
```

Where:
- `tier_weight`: dormant=0, watch=1.5, active=2.5, critical=4.0
- `phase_relevance_multiplier`: critical=2.0, high=1.5, medium=1.0, low=0.5

This produces scores in the 0-80 range, allowing critical programs with large health gaps to outrank routine work items.

### Auto-Recommendation Lifecycle

- Each program has at most 1 auto-recommendation with `source: auto-recommendation` and `status: backlog`
- When `health_score` is recomputed (after any protocol run), the existing auto-recommendation for that program is **expired** (deleted if backlog, preserved if claimed/in_progress) and a new one generated
- Auto-recommendations carry `auto_expires: true` so the system knows they're ephemeral

---

## Worked Example

**Program: engine-reliability (critical tier)**

Current state:
- Last run: baseline (eng-engine), 2 findings (1 HIGH, 0 CRITICAL)
- Protocols run: baseline only. sweep, delta, challenge, blind_spot never run.
- Problem classes checked: 3 of 5
- Maturity level: 1

Computation:
```
rigor_ceiling = 7 (baseline via eng-engine = level 5)
finding_health = 1.0 - (0 * 0.4 + 1 * 0.2 + 0 * 0.1) = 0.8
protocol_currency = 0.0 (sweep, delta, challenge, blind_spot never run)
problem_class_coverage = 3/5 = 0.6
maturity_progress = 1/4 = 0.25

raw = (0.8 * 0.35) + (0.0 * 0.25) + (0.6 * 0.25) + (0.25 * 0.15)
    = 0.28 + 0.0 + 0.15 + 0.0375 = 0.4675

earned_score = round(0.4675 * 7) = round(3.27) = 3
health_score = min(3, 7) = 3 (no penalties apply)
```

Target ceiling for critical tier: 10. Current ceiling: 7. Gap: 7.

Auto-recommendation: "Run `/pulse run engine-reliability challenge`" (next rigor step)
Priority: (10 - 3) * 4.0 * 2.0 = 56 (very high — will surface in /next)
