---
name: feedback
description: "Record feedback about how CWOS is working — objections, preferences, concerns, or feature requests"
user-invocable: true
argument-hint: "<your feedback in plain language>"
---

# /feedback — Record Feedback

Log feedback about how CWOS is working for you. This gets aggregated across all your repos and used to improve the system.

## Output Shape

**Feedback arc:** `recorded` — `<one-clause acknowledgement>` (e.g., "Feedback logged as objection, severity 2").

`<Delta line: what this invocation did — appended entry FB-NNN to .cwos-feedback.yaml.>`

`<Remainder: 4-line confirmation block — Category / Severity / Affected component / Linked WS (if any).>`

### Why this feedback matters
`<Value-rationale: cite which CWOS component the feedback targets, whether it patterns with prior feedback (mention the count), and whether a work item or signal was filed. If genuinely standalone, declare it.>`

**Do next:** Single-line action — `Continue current work` (or `Open WS-NNN to act on this feedback now` when severity warrants it).

## Steps

### 1. Parse Input

Take `$ARGUMENTS` as the feedback content. If no arguments, ask: "What would you like to share? This can be anything — what's working, what's not, what you'd change, or what tools you already use that CWOS should know about."

### 2. Classify

Determine category from content:
- User dislikes something, finds something unnecessary, or disagrees → `objection`
- User prefers a different approach or style → `preference`
- User is worried or uncertain about something → `concern`
- User already has tools or processes they want to keep → `integration`
- User wishes something existed or asks for a new capability → `feature_request`

### 3. Write to Feedback File

Append to `.cwos-feedback.yaml` under `user_feedback`:

```yaml
- id: fb-NNN          # Scan existing entries, use max+1
  timestamp: "<now>"
  category: <classified category>
  summary: "<1-sentence summary>"
  detail: "<full user input>"
  resolved: false
  resolution: null
```

Update `summary` counts:
- Increment `total_user_feedback`
- Increment `unresolved_feedback`
- Update `most_recent_feedback`
- Update `by_category` count

If `.cwos-feedback.yaml` doesn't exist, create it from the template first.

### 4. Acknowledge

Output briefly:
```
Got it — logged as [category] feedback. This gets reviewed when the kit is updated.
```

Do not argue with the feedback, defend the system design, or try to solve it immediately unless the user explicitly asks.


---

## Shadow-event envelope (ADR-018 step 1)

After your final output, run:

`node kit/scripts/cwos-event.js append command_completed --track T1:capture --tag /feedback --payload '{"command":"/feedback"}'`

Non-fatal. Do not gate any output on the exit status.
