---
description: Automated health scan — lightweight audit of programs, staleness, and backlog hygiene
argument-hint: ["" | "full"]
---

# Health Check

Lightweight automated scan. Run weekly via schedule or manually. NOT a full eng-engine roundtable — this is a quick diagnostic that any session can run.

## Action: $ARGUMENTS

### Standard health check (no arguments):

#### Step 1: Program Health
Read all `.claude/programs/*.md`. For each program:
1. Evaluate health criteria against current code state:
   - For grep-checkable criteria (innerHTML, TRUSTED_AND_UNTRUSTED, Math.exp): run the grep
   - For test-count criteria: run `bash scripts/smart-test-runner.sh` and capture counts
   - For file-size criteria: check file line counts
2. Update `Status` (GREEN/YELLOW/RED) and `Last assessed` date in each program file
3. Check auto-backlog triggers — if any condition is met, add a REVIEW item to `.claude/BACKLOG.md`

#### Step 2: Staleness Detection
Read all `.claude/context/*.md` files that have `last-verified-against-code` frontmatter.
- Calculate days since verification
- Flag any where days > `staleness-threshold-days`
- List stale docs in output

#### Step 3: Backlog Hygiene
Read `.claude/BACKLOG.md`:
- Count items by status
- Flag any DONE items that should be archived
- Flag zombie items (NEXT + unclaimed + 90+ days old)
- Check IN_PROGRESS claims against `.claude/handoffs/` for stale claims

#### Step 4: Failure Library Check
Read `.claude/failures/` — count open failure modes. Note total count for snapshot.

#### Step 5: Health Snapshot
Append a new entry to `.claude/health-snapshots.json` with all metrics collected.

#### Step 6: Update STATUS.md
Update `.claude/STATUS.md` Project Health section with current data.

#### Step 7: Output
Present results in plain English:

```
HEALTH CHECK — [date]
=====================

PROGRAM HEALTH
  Security:        [GREEN/YELLOW/RED] [one-line reason if not GREEN]
  Engine Accuracy: [GREEN/YELLOW/RED] [one-line reason if not GREEN]
  UI Quality:      [GREEN/YELLOW/RED] [one-line reason if not GREEN]
  Test Health:     [GREEN/YELLOW/RED] [one-line reason if not GREEN]

DOCUMENTATION FRESHNESS
  [List stale docs, or "All docs current"]

BACKLOG HYGIENE
  Active items: [count by status]
  DONE items needing archive: [count]
  Zombie items (90+ days, unclaimed): [count]
  Stale claims: [count]

AUTO-GENERATED ITEMS
  [List any REVIEW items created from program triggers, or "None"]

TREND (vs last snapshot on [date])
  Tests: [current] ([+/- N] from last)
  Programs: [any status changes]
  Stale docs: [current] ([+/- N] from last)

RECOMMENDED ACTIONS
  [Numbered list of suggested next steps, if any]
```

### If "full":

Run the standard health check above, PLUS:

1. Dispatch 3 expert agents in parallel (lightweight roundtable):
   - **failure-engineer** — scan for new failure surfaces since last audit
   - **security-engineer** — check for new security concerns
   - **systems-architect** — check for invariant violations or coupling growth

2. Include agent findings in output under "DEEP SCAN FINDINGS" section

3. Any agent-identified issues become REVIEW backlog items

## Important

- This is designed to run fast (~2 minutes standard, ~5 minutes full)
- Write for a non-technical owner — plain English, no jargon
- Always append a health snapshot — this builds the trend data
- Do NOT modify program auto-backlog triggers — only evaluate them
- If a program flips from GREEN to YELLOW/RED, highlight it prominently
