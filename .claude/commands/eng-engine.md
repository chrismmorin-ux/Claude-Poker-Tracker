---
description: AI Engineering Roundtable — multi-expert audit producing prioritized backlog actions
argument-hint: [focus area or "full" — e.g., "exploitEngine", "persistence", "full"]
---

# Engineering Roundtable

You are orchestrating a multi-expert engineering panel. This is NOT brainstorming — it is rigorous, adversarial, systems-level analysis.

## Focus Area

$ARGUMENTS

If no argument given, default to "full" (entire codebase).

---

## STEP 0 — GATHER SYSTEM MODEL

Before dispatching agents, read these to understand current state:

1. `.claude/context/SYSTEM_MODEL.md` — full system model (architecture, invariants, risks)
2. `.claude/context/SYSTEM_MODEL_PROTOCOL.md` — update rules and persona integration
3. `.claude/context/INVARIANTS.md` — invariant catalog with verification dates
4. `CLAUDE.md` (root) — rules, patterns, commands
5. `.claude/BACKLOG.md` — current work items and priorities
6. All files in `.claude/programs/` — current program health state
7. All files in `.claude/failures/` — known failure modes to check against
8. Run `git log --oneline -20` — recent trajectory
9. Run `git diff --stat HEAD~5` — recent change surface area

If focus area targets `exploitEngine/` or `rangeEngine/`, also read `.claude/context/POKER_THEORY.md` and the sub-directory `CLAUDE.md`.

---

## PHASE 1 — DISPATCH EXPERT AGENTS (PARALLEL)

Launch ALL 6 expert agents in parallel using the Agent tool. Each agent has its own persona, domain knowledge, and review criteria defined in `.claude/agents/`.

For each agent, pass this briefing in the prompt:

> **Focus area:** [the focus area from $ARGUMENTS or "full"]
>
> Perform your independent analysis of the codebase. Read the context files listed in your agent definition, then analyze the focus area through your expert lens. Produce your structured output (Key Concerns, Hidden Risks, Likely Missing Elements, Dangerous Assumptions). Be specific — reference file paths and line numbers. Do NOT propose solutions yet.

The 6 agents to launch:

1. **systems-architect** — architecture, invariants, coupling, module boundaries
2. **senior-engineer** — implementation quality, maintainability, testing, DX
3. **failure-engineer** — failure modes, edge cases, cascading failures, data corruption
4. **performance-engineer** — rendering, bundle, mobile constraints, computation cost
5. **security-engineer** — attack surface, trust boundaries, data integrity, extension security
6. **product-ux-engineer** — user behavior stress, mobile UX, live-game constraints

Wait for all 6 to complete. Collect their outputs.

---

## PHASE 2 — CROSS-CRITIQUE

With all 6 expert outputs in hand, YOU (the orchestrator) now run the cross-critique. For each expert persona, review what the OTHER experts said and identify:

1. What other experts got WRONG
2. What they MISSED
3. Where their assumptions break at scale or in production

Be direct and critical. No politeness hedging. Use your knowledge of all 6 outputs to find contradictions and blind spots.

---

## PHASE 3 & 4 — FACILITATED SYNTHESIS

Launch the **roundtable-facilitator** agent with ALL Phase 1 outputs and Phase 2 cross-critique as input. The facilitator's prompt should include:

> Here are the 6 expert analyses and the cross-critique. Perform Phase 3 (synthesis: consensus, disagreements, unknowns, ranked weak points, forced resolution) and Phase 4 (decisions: top risks, structural improvements, backlog additions, system model updates).
>
> De-duplicate against existing backlog items in `.claude/BACKLOG.md`.
>
> Format each backlog addition as:
>
> | ID | Sev | Status | Description | Details |
> |----|-----|--------|-------------|---------|
> | RT-N | PX | REVIEW | Short title | One-line details |

---

## PHASE 5 — ADD FINDINGS TO BACKLOG & UPDATE STATUS

After the facilitator returns:

### 5a. Add to Backlog

Add all proposed backlog items to `.claude/BACKLOG.md` under the NEXT section (or a new Roundtable Findings subsection). Each item MUST include an **Accept Criteria** column:

```markdown
| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| RT-1 | PX | REVIEW | Short title | How owner verifies this is done (plain English) | — |
```

All items start as **REVIEW** status. Items move to NEXT only after the owner explicitly approves them via `/backlog approve <id>`.

### 5b. Update System Model

Apply any System Model updates proposed by the facilitator (new invariants, failure surfaces, coupling entries, decision log entries) to `.claude/context/SYSTEM_MODEL.md`. Bump version and timestamp.

### 5c. Update Program Health

Read each file in `.claude/programs/`. For each program:
1. Evaluate health criteria against current code state (grep for violations, check test counts, etc.)
2. Update `Status` (GREEN/YELLOW/RED) and `Last assessed` date
3. If any auto-backlog trigger condition is met, add a REVIEW item to BACKLOG.md
4. Append a row to the program's History table

### 5e. Update STATUS.md

Update `.claude/STATUS.md`:
- Add count of new findings to "Pending Review" section
- Note the date and severity breakdown
- Flag any P0 items in Alerts section

### 5f. Append Health Snapshot

Append a new entry to `.claude/health-snapshots.json` capturing current metrics:
- Run tests to get count and pass rate
- Count backlog items by status
- Read program health from `.claude/programs/*.md`
- Count stale docs (past their threshold)
- Count open failure modes in `.claude/failures/`

### 5g. Update Recommended Execution Order

Update the execution order block in BACKLOG.md to include the new findings.

---

## PHASE 6 — EXECUTIVE BRIEFING

After adding backlog items, present the final output in this exact structure. This is the PRIMARY deliverable — write it for a product owner who is not reading code daily. Each section must have enough detail for the reader to make a decision without asking follow-up questions.

---

### Health Snapshot

One paragraph (3-5 sentences) summarizing the overall state of the codebase. Is it healthy, deteriorating, or improving? What is the trajectory? What is the single biggest systemic concern? Write this like a quarterly health report, not a bug list.

---

### Risk Dashboard

A table of the top findings, sorted by impact. Each row should be self-contained — a reader should understand the risk, its consequence, and urgency from the row alone.

| # | Risk | What happens if ignored | Severity | Urgency | Effort |
|---|------|------------------------|----------|---------|--------|
| 1 | ... | ... | CRITICAL/HIGH/MEDIUM/LOW | NOW/SOON/LATER | S/M/L |

---

### Deep Dives

For each risk in the dashboard (or at minimum the top 5), write a section with:

**[Risk Title]**

- **The problem**: 2-3 sentences explaining what is wrong in plain language. No jargon. If a poker analogy helps, use it.
- **Real-world scenario**: A concrete example of how this would manifest for a user or developer. "You're at the table, you glance at your phone, and..."
- **What the experts found**: The specific technical detail (file, line, mechanism) — kept brief but precise enough to act on.
- **Recommended fix**: What to do about it, including effort estimate.
- **If we accept this risk**: What the consequences are of doing nothing. Some risks are acceptable — name the tradeoff explicitly.

---

### Backlog Items Added

List the items added to the backlog with their IDs and REVIEW status. Note that these are pending approval and will not be worked on until status is changed to READY.

---

### Open Questions

End with 2-4 questions that require the owner's judgment — tradeoffs where there is no objectively correct answer. Frame each as a choice with clear options and consequences.

---

Do NOT ask "which items should be added?" — they are already added as REVIEW. Instead ask which items should be APPROVED (moved to READY) and which should be REJECTED (removed or deferred).
