# Constraints & Assumptions

Hard constraints and working assumptions that bound this project. Assumptions must be periodically re-verified.

---

## Hard Constraints

These are non-negotiable boundaries.

| ID | Constraint | Source | Notes |
|----|-----------|--------|-------|
| HC-001 | <!-- e.g., "Must run on Node 18+" --> | <!-- e.g., "hosting provider" --> | |
| HC-002 | <!-- e.g., "Budget: $0/month infrastructure" --> | <!-- e.g., "project scope" --> | |

## Working Assumptions

These are believed true but must be verified periodically.

| ID | Assumption | Last Verified | Confidence | Notes |
|----|-----------|---------------|------------|-------|
| WA-001 | <!-- e.g., "Database will stay under 1GB" --> | YYYY-MM-DD | HIGH/MEDIUM/LOW | |
| WA-002 | <!-- e.g., "Users will access via modern browsers" --> | YYYY-MM-DD | HIGH/MEDIUM/LOW | |

<!--
Assumptions should be re-verified when:
- 30+ days since last verification
- The codebase has changed significantly in the assumption's area
- A failure occurs that might relate to the assumption
- /audit flags the assumption as stale
-->

## Scale Assumptions

| Dimension | Current | Assumed Max | What Breaks Beyond |
|-----------|---------|-------------|-------------------|
| Data volume | <!-- e.g., "10K records" --> | <!-- e.g., "100K records" --> | <!-- e.g., "Full table scans" --> |
| Concurrent users | <!-- e.g., "1-5" --> | <!-- e.g., "50" --> | <!-- e.g., "Connection pool" --> |
| Request rate | <!-- e.g., "10/min" --> | <!-- e.g., "100/min" --> | <!-- e.g., "Rate limiting" --> |
