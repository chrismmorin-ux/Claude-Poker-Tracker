---
name: business-engine
description: "Business analysis engine — market positioning, feature ROI, competitive analysis, and strategic improvement recommendations"
user-invocable: false
default_mode: decide
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: business-engine` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: decide`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Business Analysis Engine

Strategic analysis of the project from a business perspective. Evaluates market positioning, feature completeness, competitive landscape, and identifies high-ROI improvements.

## Focus Area

$ARGUMENTS (specific area, or "full" for complete analysis)

---

## PHASE 0 — GATHER CONTEXT

1. Read `CLAUDE.md` — project purpose, target audience, constraints
2. Read `system/state.md` — current state and capabilities
3. Read `system/constraints.md` — budget, scale, and resource constraints
4. Read `system/decisions.md` — strategic decisions already made
5. Scan the codebase for: README, landing page, feature list, user-facing routes/pages
6. Identify: what the product does, who it's for, and what state it's in

---

## PHASE 1 — MARKET ANALYSIS

### Product Definition
- What problem does this solve?
- Who is the target user?
- What's the core value proposition?
- How is it differentiated from alternatives?

### Feature Inventory
- List all user-facing features/capabilities
- Rate each: core (must have) / differentiator (competitive advantage) / nice-to-have / dead weight
- Identify: features started but not finished, features with poor UX

### Competitive Landscape
- What are the obvious alternatives? (open source, commercial, manual process)
- Where does this product win vs alternatives?
- Where does it lose?
- What would make someone switch TO this product?
- What would make someone switch AWAY?

---

## PHASE 2 — ROI ANALYSIS

For each potential improvement area, estimate:

| Improvement | User Impact | Effort | ROI Score | Notes |
|-------------|------------|--------|-----------|-------|
| ... | HIGH/MED/LOW | S/M/L | (impact/effort) | ... |

### Scoring Criteria
- **User Impact:** How many users affected x how much their experience improves
- **Effort:** Development time + testing + deployment risk
- **ROI:** Impact / Effort (higher is better)

---

## PHASE 2b — STRATEGIC AND MISSION REVIEW (2 PARALLEL AGENTS)

Launch two agents to evaluate the market analysis and ROI data through strategic and mission lenses.

### Agent 1: Strategic Assessment
Launch the **strategic-thinker** persona as an agent with this mandate:

> Review the Phase 1 market analysis and Phase 2 ROI table. Evaluate:
> 1. Does the competitive landscape analysis capture the real strategic position?
> 2. Which high-ROI improvements build lasting advantage vs temporary gains?
> 3. Which low-ROI items would create defensible moats worth the investment?
> 4. Is the improvement portfolio balanced between short-term wins and long-term positioning?
>
> Produce: Strategic annotations on the ROI table (item, strategic assessment, moat potential: high/medium/low/none) and one strategic direction recommendation.

### Agent 2: Mission Grounding
Launch the **mission-advocate** persona as an agent with this mandate:

> Review the Phase 1 market analysis and Phase 2 ROI table against the project's stated mission in CLAUDE.md. Evaluate:
> 1. Do the highest-ROI improvements serve the target beneficiaries?
> 2. Would any proposed improvements pull the product away from its core purpose?
> 3. Is the growth strategy focused on the right users or chasing easier markets?
> 4. What business improvements would most directly serve the mission?
>
> Produce: Mission alignment annotations (item, mission alignment: serves/neutral/drifts, rationale) and mission-first recommendations that may differ from pure ROI ranking.

### Integration
Feed both agents' outputs into Phase 3 (Strategic Recommendations). Where ROI ranking and mission alignment diverge, present both perspectives with clear labeling.

---

## PHASE 3 — STRATEGIC RECOMMENDATIONS

### Quick Wins (high ROI, low effort)
Items that can be done in a single session with outsized impact.

### Strategic Investments (high impact, higher effort)
Items that require multiple sessions but build lasting competitive advantage.

### Technical Debt with Business Impact
Technical issues that users feel (slow load times, confusing flows, unreliable features).

### Missing Features
Features that would open new user segments or significantly improve retention.

### Features to Remove or Simplify
Features that add complexity without proportional value.

---

## PHASE 4 — GROWTH STRATEGY

Based on the analysis:

1. **What's the single most impactful change?** (if you could only do one thing)
2. **What's the 90-day improvement roadmap?** (ordered by ROI)
3. **What metrics should be tracked?** (to measure if improvements are working)
4. **What's the long-term moat?** (defensible advantage to build toward)

---

## PHASE 5 — FINDINGS & WORK ITEMS

Create work items categorized by:
- `quick-win` — single-session, high ROI
- `strategic` — multi-session, builds competitive advantage
- `tech-debt-business` — technical work with clear user impact
- `feature-gap` — missing capability

**WS-id allocation (WS-040):** allocate every new work item's id via `node kit/scripts/cwos-next.js allocate-ws-id` — call it once per id, in order. Do NOT compute the next id by eyeballing the active-queue max: that scan misses `queue/archive/` and re-issues retired ids, which lets reconcile force-complete the new item (the SPR-018 / WS-033 incident). The CLI scans queue + archive + index.

---

## PHASE 6 — EXECUTIVE BRIEFING

```
## Business Analysis Results

### Product Health Score: [N]/10
### Competitive Position: [STRONG/MODERATE/WEAK]

### Key Findings
1. [Most important business insight]
2. [Second most important]
3. [Third most important]

### Recommended Priorities (next 90 days)
| # | Action | Type | ROI | Effort |
|---|--------|------|-----|--------|
| 1 | ... | quick-win | HIGH | S |
| 2 | ... | strategic | HIGH | M |
| 3 | ... | feature-gap | MED | M |

### Strategic Direction
[1-2 paragraph recommendation for where to take the product]

### Metrics to Track
[Key metrics that would indicate improvement]
```

---

## Contract Alignment (ADR-038)

The briefing/output phase MUST emit this block (per ADR-038 Decision #6):

```
### Contract Alignment
- mode: <honored | departed (reason)>
- stretch: <honored | departed (reason)>
- success_shape: <honored — list which target items hit | departed (reason)>
- scope_ceiling: <complied — items skipped: [list] | violated (reason)>
```
