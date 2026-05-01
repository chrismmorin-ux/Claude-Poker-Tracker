---
name: checkpoint
description: "Founder alignment checkpoint — what was done, what assumptions need your eyes, one question for you. Mutates intention.md based on your reply."
user-invocable: true
argument-hint: "[optional: focus area or 'quick']"
---

# /checkpoint — Founder Alignment Checkpoint

The deliberate gate where you (the founder) reconnect with autonomous work. Output is one scannable page. Designed to be runnable cold — you don't need to remember context to use it.

## Design constraints (do not violate)

These come from the design research and from the founder's polarizations. Violating any of them defeats the purpose:

1. **Output ≤ one screen.** If you need more, pick less.
2. **Three structural elements only:** what was done, assumptions to validate, one question. Anything else becomes status theater.
3. **One question maximum.** Two-option choice when possible. Free-text fallback always allowed.
4. **3-bucket status only:** ready | needs your eyes | blocked. No numerical scores.
5. **Mutate intention.md, don't just log.** If the founder confirms an assumption or answers the question, the corresponding section in `system/intention.md` MUST be updated as the same operation. Never just append to the change log without mutating the source.
6. **Drift is learning, not failure.** Frame intention changes as "founder learning" not "AI got it wrong" or "we drifted."
7. **Don't fabricate principles.** If `system/intention.md` has `_placeholder_` in Principles, say so honestly and use the question slot to ask for one.

## Output Shape

**Checkpoint arc:** `<aligned | needs-your-eyes | blocked>` — `<one-clause overall posture>` (e.g., "2 assumptions need your eyes; 1 blocker").

`<Delta line: what this invocation did — surfaced N assumptions for review, recorded founder reply, mutated intention.md section X.>`

`<Remainder: 3-block layout — What was done / Assumptions to validate / One question. Each block ≤ 5 lines. Total ≤ one screen — design constraint #1.>`

### Why this checkpoint matters
`<Value-rationale: cite the recently-mutated intention.md section, the autonomous work that ran since last checkpoint, or the active program whose protocol depends on founder confirmation. If no autonomous work has happened: declare it.>`

**Do next:** Single binary choice or free-text reply — exactly one question per checkpoint (design constraint #3).

## Steps

### 1. Read state

In parallel, read:
- `system/intention.md` — the constitution
- `.claude/workstream/queue/queue-index.yaml` — completed work items
- Last 5 entries in `system/decisions.md` (if it exists) — implicit decisions captured
- `system/intention.md` "Checkpoint Counters" — to know cadence
- Last `/checkpoint` timestamp from "Recent Direction Changes" if any

If `system/intention.md` doesn't exist or is entirely `_placeholder_`: output a one-liner explaining the file isn't seeded yet and offer to seed it now via 3 plain-language questions. Stop — don't fake a checkpoint against a blank constitution.

### 2. Build the re-entry briefing (60 seconds)

Write 3 sentences max:
- Sentence 1: Restate the **Imagined Outcome** in your own words (1 sentence). This is the intention-restatement pattern from the research.
- Sentence 2: Last directional move from "Recent Direction Changes" (or "no direction changes yet" if blank).
- Sentence 3: What's been the dominant work theme since last checkpoint (1 sentence).

This is what the founder reads to get oriented cold.

### 3. List "Done since last checkpoint"

Read workstream queue. List items completed since the last `/checkpoint` timestamp (or all of them if first checkpoint). Format:

```
- [WS-NNN] [title] — [one-clause outcome]
```

Cap at 10 items. If more than 10: show 10 + "and N more (archived)".

### 4. Constitutional self-critique → assumptions to validate

For each completed work item AND each implicit decision in `decisions.md` since last checkpoint:
- Check it against every Principle in `intention.md`
- Check it against every Anti-goal
- Check it against every Open Question (did the work proceed past an unresolved question?)

Surface as "assumptions I made you should sanity-check":

```
- "I treated [X] as [Y] because [Z]. Confirm?"
```

Cap at 5. If you can't find any honest assumptions to surface, write: `"No assumptions need validation since last checkpoint — work has stayed inside stated principles and anti-goals."` Don't manufacture assumptions to fill space.

### 5. Pick THE one question

The single most important thing you need from the founder right now. Pick from this priority list (use the first that applies):

1. An Open Question marked `needs_founder` that's blocking work.
2. A principle conflict surfaced in step 4 that you genuinely don't know how to resolve.
3. A new Open Question that emerged from recent work and isn't in `intention.md` yet.
4. A direction-confirm question: "We've been moving toward X. Stay the course or pivot?"
5. If none of the above: a phase question — "We've completed N items. Is this stretch of work done? Move to next focus or keep going?"

Format:
```
> [Question text]
> Reply: [option A] / [option B] / [free text]
```

If `intention.md` has `_placeholder_` in any major section, the question slot becomes: "I don't have a real [Principle / Imagined Outcome / etc.] yet. What's yours?" — and the reply collects it.

### 6. Status bucket

Pick exactly one:
- **ready** — work is aligned, no assumptions need validation, no open questions blocking. Continue autonomously.
- **needs your eyes** — at least one assumption or open question requires founder confirmation, but work isn't blocked.
- **blocked** — at least one open question is gating progress; work cannot meaningfully continue.

### 7. Output the checkpoint

Single output, all sections, ≤ one screen:

```
## Checkpoint — [Repo Name] — [YYYY-MM-DD]

### Where we left off
[Sentence 1: imagined outcome restate]
[Sentence 2: last directional move]
[Sentence 3: dominant work theme since last checkpoint]

### Done since last checkpoint
- [WS-NNN] [title] — [outcome]
- ...

### Assumptions to sanity-check
- "[assumption 1] Confirm?"
- ...

### One question for you
> [question]
> Reply: [option A] / [option B] / [free text]

### Status: [ready | needs your eyes | blocked]
```

End. Wait for founder reply.

### 8. Process founder reply → mutate intention.md

When the founder responds:

**For each assumption confirmed:** no mutation needed — the assumption was correct.

**For each assumption corrected:** MUTATE the relevant section of `intention.md`:
- Wrong principle interpretation → edit Principles
- Wrong anti-goal scope → edit Anti-goals
- Wrong outcome framing → edit Imagined Outcome
- New constraint surfaced → add Open Question OR edit appropriate section

**For the one question reply:**
- Two-option pick → record as resolution to the question, mutate the relevant section
- Free-text answer → extract structured intent, mutate the relevant section
- "Skip" or "later" → mark question as `needs_founder`, leave for next checkpoint

**For every mutation, append a one-line entry to "Recent Direction Changes":**
```
### YYYY-MM-DD — [one-line summary]
- **Trigger:** /checkpoint
- **Before:** [what was true]
- **After:** [what is now true]
- **Why:** [reason from founder reply]
```

**Reset checkpoint counters** in `intention.md`:
- Days since last checkpoint → 0
- Work items completed since last checkpoint → 0
- Implicit decisions auto-captured since last checkpoint → 0
- Open questions added since last checkpoint → 0
- Last checkpoint → today's ISO date

### 9. Confirm the mutation

After writing, output a 2-line confirmation:

```
✓ intention.md updated: [list of sections mutated, e.g., "Principles, Open Questions"]
✓ Counters reset. Next checkpoint recommended in ~14 days or after 10 work items.
```

Do NOT re-emit the full intention.md content — the founder doesn't read YAML/markdown updates. The confirmation is enough.

---

## Edge cases

### "Quick" mode
If invoked as `/checkpoint quick`: skip step 4 (constitutional self-critique) and step 5 (pick one question). Output only "Where we left off" + "Done since last checkpoint" + status bucket. For when the founder wants situational awareness without giving input.

### Focus area
If invoked as `/checkpoint <area>` (e.g., `/checkpoint imaging`): scope step 3 (done) and step 4 (assumptions) to work items tagged or path-matching that area. Keep everything else unchanged.

### Empty queue
If no work items completed since last checkpoint: skip "Done since last checkpoint" section entirely (don't show an empty list). The question slot becomes: "No work has happened since last checkpoint. Is the system stalled, or are you in pure-thinking mode?"

### intention.md doesn't exist
Per Step 1: refuse to fake a checkpoint. Output:
```
intention.md isn't seeded yet for this repo. Run /checkpoint init to seed it from 3 plain-language questions, or edit system/intention.md directly.
```

### `/checkpoint init`
A bootstrap mode. Asks 3 questions in sequence:
1. "When this works, what does it look like? One paragraph, plain English."
2. "What 2-3 principles must always hold? (taste, not hard rules)"
3. "What are you explicitly NOT trying to do?"
Captures answers, populates Imagined Outcome / Principles / Anti-goals. Leaves Softgoals and Open Questions empty (founder can add later or they'll surface naturally).

---

## Why this exists (read once, then forget)

Solo founders working through autonomous AI lose alignment in two ways:
1. **The AI drifts** from the founder's intention because the intention was never made explicit, queryable, or self-critiqueable.
2. **The founder drifts** — what they wanted at month 1 isn't what they want at month 3, but the system keeps optimizing for month 1.

`/checkpoint` exists to make both kinds of drift legible and easy to correct, without forcing the founder to read every diff or sit in every session. It batches "things that need your eyes" into one deliberate moment, on the founder's cadence.

The artifact (`intention.md`) is the constitution. The command (`/checkpoint`) is the periodic constitutional convention. Three structural elements, one question, three status buckets — by design.


---

## Shadow-event envelope (ADR-018 step 1)

After your final output, run:

`node kit/scripts/cwos-event.js append command_completed --track T12:program-management --tag /checkpoint --payload '{"command":"/checkpoint"}'`

Non-fatal. Do not gate any output on the exit status.
