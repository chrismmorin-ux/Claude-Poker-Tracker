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

### 3. Record it

One command:

```bash
node kit/scripts/cwos-capture.js feedback "<1-sentence summary>" \
  --category objection|preference|concern|integration|feature_request \
  --detail "<full user input>"
```

That is the whole step. Do not open `.cwos-feedback.yaml`, do not allocate an
`fb-NNN` id, do not update a `summary:` block.

> **Why this replaced hand-editing the YAML (WS-578).** This step used to say
> "append under `user_feedback`, scan existing entries for max+1, update the
> summary counts". Three problems, all measured on 2026-08-04. It is a
> read-modify-write on a shared file with a derived section — the shape that
> lost a write on 2026-07-26 when two sessions shared a tree. The max+1 id
> scan collides in practice: region-desk's entries run `fr-009`,
> `fr-dev-server-zombie`, `fr-reconcile-mispromote` *before* `fr-001..008`.
> And the "auto-maintained" summary drifts — region-desk's claimed 8 friction
> events against 11 real ones.
>
> `.cwos-feedback.yaml` is now a **generated view** of the event log, carrying
> a do-not-edit header. Anything written into it by hand is lost at the next
> regeneration. The event log is the store.

If the command reports `NOT captured`, say so to the user rather than
retrying silently — it exits 0 by design so it can never block the
conversation, which means the message is the only signal.

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
