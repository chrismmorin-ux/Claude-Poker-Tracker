---
description: View and manage the project backlog with multi-session claim tracking
argument-hint: ["status" | "add <desc>" | "claim <id>" | "complete <id>" | "unclaim <id>" | "approve <id>" | "reject <id>" | "archive" | "sweep" | "prioritize"]
---

# Backlog Command

You are managing the project backlog at `.claude/BACKLOG.md` with completed items archived in `.claude/BACKLOG_ARCHIVE.md`.

## Action: $ARGUMENTS

### If no arguments or "status":

1. Read `.claude/BACKLOG.md`
2. Read ALL files in `.claude/handoffs/` for claim cross-reference
3. Display formatted summary:

```
BACKLOG STATUS
==============

IN PROGRESS ([count]):
  [ID] [Description] — claimed by [session] ([age])

NEXT ([count] ready):
  P0: [list]
  P1: [list]
  P2: [list]

BLOCKED ([count]):
  [ID] [Description] — waiting on [what]

PAUSED ([count]):
  [ID] [Description]

REVIEW ([count] — need owner approval):
  [ID] [Description]

Recommended next: [top unclaimed NEXT item by priority]
```

### If "add <description>":

1. Parse the description
2. **Require acceptance criteria** — if not provided, ask: "How will you know this is done? (plain English)"
3. Assign an ID based on context:
   - RT-N for roundtable findings
   - PM-N for project management
   - Sequential number for feature work
4. Determine priority (ask if unclear)
5. Estimate sessions needed (ask if unclear)
6. Add to BACKLOG.md under NEXT section with status NEXT, Claimed By = —
7. Update STATUS.md if item is P0/P1

### If "claim <id>":

1. Find the item in BACKLOG.md
2. **Check if already claimed** — if yes, report who owns it and ask user
3. Set status to IN_PROGRESS
4. Set Claimed By to current session identifier
5. Move item to NOW section if not already there
6. Create or update this session's handoff file in `.claude/handoffs/`
7. Update `.claude/STATUS.md` Active Sessions table

### If "complete <id>":

1. Find the item in BACKLOG.md
2. **Verify acceptance criteria are met** — review against the item's Accept Criteria column
3. If criteria not met: report what's missing, ask user whether to complete anyway
4. If criteria met (or user approves):
   - Remove item from BACKLOG.md
   - Add to `.claude/BACKLOG_ARCHIVE.md` with completion date
   - Release claim (clear Claimed By)
   - Update handoff file: clear item from "Files I Own" if applicable
   - Update `.claude/STATUS.md`: add to Recently Completed, remove from Active Sessions if no other items
   - Display: "[ID] completed and archived. [Acceptance criteria summary]"

### If "unclaim <id>":

1. Find the item in BACKLOG.md
2. Clear the Claimed By field
3. Set status back to NEXT
4. Move to NEXT section
5. Update the former session's handoff file if it exists
6. Report: "[ID] unclaimed and returned to NEXT queue"
7. Use this for stale/dead sessions that hold claims

### If "approve <id>":

1. Find item with REVIEW status in BACKLOG.md
2. Change status to NEXT
3. Report: "[ID] approved and moved to NEXT"

### If "reject <id>":

1. Find item with REVIEW status in BACKLOG.md
2. Ask for rejection reason
3. Remove from BACKLOG.md (or move to archive with REJECTED status)
4. Report: "[ID] rejected: [reason]"

### If "archive":

1. Scan BACKLOG.md for any items that slipped through with DONE status
2. Move them to BACKLOG_ARCHIVE.md
3. Report count of items archived

### If "sweep":

Full backlog hygiene pass:

1. **Archive DONE items**: Same as "archive" — move any DONE items to archive
2. **Flag zombies**: Scan NEXT items. A "zombie" is an item that is:
   - Status NEXT (not claimed, not blocked)
   - Has been in the backlog for 90+ days (check creation date or last roundtable date)
   - Not referenced by any active program in `.claude/programs/`
3. **Report stale claims**: Check IN_PROGRESS items against `.claude/handoffs/`. If the claiming session's handoff is COMPLETE or missing, the claim is stale.
4. **Output**:
   ```
   SWEEP RESULTS
   =============
   Archived: [N] DONE items moved to archive
   Zombies flagged: [N] items (list with IDs and ages)
   Stale claims: [N] items with dead session claims
   
   Recommended actions:
   - [list of suggested unclaims or archival]
   ```
5. Do NOT auto-archive zombies — flag them for the founder to decide

### If "prioritize":

WSJF (Weighted Shortest Job First) scoring for all NEXT items:

1. Read all NEXT items from BACKLOG.md
2. For each item, assess and score (1-5):
   - **Value**: How much does this improve the product for the user?
   - **Urgency**: Does this get worse over time if ignored?
   - **Risk reduction**: Does this prevent a failure or data loss?
   - **Effort** (inverted: 5=trivial, 1=massive): How much work is this?
3. Calculate WSJF = (Value + Urgency + Risk Reduction) / Effort
4. Output sorted by WSJF score:
   ```
   PRIORITY RANKING (WSJF)
   =======================
   
   #1 [ID] — Score: [N.N]
      [Description]
      Why: [plain-English explanation of why it ranks here]
      Value: [N] | Urgency: [N] | Risk: [N] | Effort: [N]
   
   #2 [ID] — Score: [N.N]
      ...
   ```
5. Write for a non-technical owner — explain scores in plain language

## Important

- **Acceptance criteria are mandatory** for every item — they're how the non-technical owner verifies completion
- **Only one session can claim an item** — this prevents duplicate work across concurrent sessions
- **Always update STATUS.md** after any backlog change — the owner dashboard must stay current
- **Always update handoff files** when claims change — other sessions read these to avoid conflicts
- Write output in plain English for a non-technical owner
