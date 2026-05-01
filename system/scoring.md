# RICE Scoring Reference

Standard scoring system used across all CWOS engines and workstream commands.

---

## Formula

```
RICE Score = (Reach x Impact x Confidence) / Effort
```

When a strategic phase multiplier is available (from traction engine):
```
Final Score = RICE Score x Phase_Multiplier
```

---

## Scales

### Reach (1-10)
How many users, components, or workflows are affected.

| Score | Meaning |
|-------|---------|
| 1-2 | Single user flow or edge case |
| 3-4 | One feature area or a few users |
| 5-6 | Multiple features or moderate user base |
| 7-8 | Core functionality affecting most users |
| 9-10 | System-wide or affects every user |

### Impact (1-5)
How much improvement per affected unit.

| Score | Meaning |
|-------|---------|
| 1 | Minimal — cosmetic or minor convenience |
| 2 | Low — noticeable improvement but not essential |
| 3 | Medium — meaningful improvement to workflow or quality |
| 4 | High — significant improvement, removes major pain point |
| 5 | Massive — transformative, enables something previously impossible |

### Confidence (0.5-1.0)
How sure are we about the reach and impact estimates.

| Score | Meaning |
|-------|---------|
| 0.5 | Low — speculative, no evidence |
| 0.6 | Below average — some reasoning but untested |
| 0.7 | Moderate — reasonable estimate based on patterns |
| 0.8 | Good — based on similar past work or clear evidence |
| 0.9 | High — well-understood problem with known solution |
| 1.0 | Certain — proven need with verified approach |

### Effort (1-10)
Development sessions to complete (1 session ~ 2-4 hours of Claude work).

| Score | Label | Meaning |
|-------|-------|---------|
| 1-2 | S (Small) | < 1 session, quick fix |
| 3-4 | S-M | 1-2 sessions |
| 5-6 | M (Medium) | 2-4 sessions |
| 7-8 | M-L | 4-8 sessions |
| 9-10 | L (Large) | 8+ sessions, multi-week |

---

## Phase Multipliers (used by traction engine)

| Phase | Aligned Work | Neutral Work | Misaligned Work |
|-------|-------------|-------------|-----------------|
| Foundation | 1.5x | 1.0x | 0.5x |
| Pre-Launch | 1.5x | 1.0x | 0.5x |
| Launch | 1.5x | 1.0x | 0.5x |
| Growth | 1.5x | 1.0x | 0.5x |
| Maturity | 1.5x | 1.0x | 0.5x |

---

## Context Multipliers (from system/context.md)

When `system/context.md` has active business context items, an additional context multiplier applies:

```
Final Score = RICE Score x Phase_Multiplier x Context_Multiplier
```

| Context Type | Multiplier | Notes |
|-------------|-----------|-------|
| customer_issue | 2.0x | Items touching related files/programs |
| deadline | 1.5x-4.0x | Scales with proximity: 7d=1.5x, 3d=2x, 1d=3x, overdue=4x |
| opportunity | 1.5x | Items touching related files/programs |
| risk | 1.5x | Items touching related files/programs |
| goal | 1.2x | Gentle nudge toward strategic goals |

Context multiplier is the **single highest match** (no stacking). If no context items match, multiplier is 1.0x.

---

## Examples

| Item | Reach | Impact | Confidence | Effort | RICE |
|------|-------|--------|-----------|--------|------|
| Fix login crash | 9 | 5 | 1.0 | 2 | 22.5 |
| Add dark mode | 6 | 2 | 0.8 | 5 | 1.9 |
| Index slow query | 7 | 4 | 0.9 | 1 | 25.2 |
| Rewrite auth system | 8 | 4 | 0.7 | 8 | 2.8 |

High RICE = do first. The index-slow-query item (25.2) beats the auth rewrite (2.8) by 9x because it's high impact with minimal effort.

---

## When to Use

- **`/workstream create`** — assign a RICE score when creating manual items
- **`/engine` facilitator output** — facilitator produces RICE scores for proposed work items
- **`/plan` synthesis** — final priority queue uses RICE for ranking
- **`traction` engine** — applies phase multipliers on top of base RICE
