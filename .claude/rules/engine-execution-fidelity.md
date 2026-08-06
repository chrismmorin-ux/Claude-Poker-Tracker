# Engine Execution Fidelity — HARD RESTRICTION

**Founder ruling, 2026-08-05.** This rule is not advisory and has no judgment call in it.

## The rule

When a program protocol, engine, roundtable, or command **declares an execution method** —
an `engine:` field, a persona set, a multi-agent phase structure — you **MUST** execute it
by spawning those agents.

**Inline single-threaded simulation of a multi-agent engine is PROHIBITED.** Its output is
**invalid**. It may not be:

- stamped into `last_run_by_protocol` or `protocol_history`
- written to `.claude/workstream/evidence/`
- used to clear a sprint block or a staleness gate
- filed as findings
- described to the founder as having run the protocol

There is no "lightweight version" of a declared roundtable. A solo pass is not a smaller
roundtable; it is a different and measurably worse instrument.

## Why — the mechanism, not a preference

**The agents are you.** Same model, same capability. That is exactly why the substitution
fails, and it is the part that is easy to get backwards: the value of fan-out is not that the
agents are smarter. It is *where they start from*.

**Context is monotonic within a session. You accumulate and you cannot shed.** By the time you
decide to audit something, you have already read around it, already formed a read, already
committed to a framing. You cannot return to not-knowing. Every "perspective" you then
generate is that one anchored context wearing a different label. A six-persona roundtable run
inline is not a cheap roundtable — it is **one position with six names on it**, and the
disagreement between personas, which is the entire product of a roundtable, cannot occur.
There is nothing to cross-critique. The cross-critic phase is theatre when run inline, for the
same reason.

A subagent dispatched with a fresh context and a curated framing genuinely occupies a
different point in the space. It holds different priors, notices different things first, and
will contradict you — which an anchored self-simulation structurally cannot. That is the whole
mechanism. Multi-dispatch is you, in curated forms, getting to actually explore all the
surfaces instead of the one you happened to walk up to first.

This is why the resulting difference shows up in both **form** (schema, evidence discipline,
ID hygiene, output shape) and **implementation** (what the audit finds, and whether it
survives scrutiny). The inline substitute is wrong most of the time.

**The failure is self-concealing, which is why the restriction has to be hard.** An inline
pass returns a *plausible* audit fast, and it is plausible precisely because it was generated
from the framing that produced it — it agrees with itself. Nothing forces it to meet a
rigorous one. It then gets stamped as the protocol run, the staleness clock resets on work
that did not happen, the block clears, and the gap goes quiet for a full cadence. That is
strictly worse than not running the protocol at all.

*Demonstrated in-session on 2026-08-05:* an inline "blind-spot audit" ran greps, formed a
hypothesis in the first few minutes, and was moments from writing evidence and stamping the
program. The anchoring happened **before** the audit began — which is precisely what makes it
invisible from the inside.

## Conflict resolution — never downgrade silently

A session-level instruction that discourages spawning agents (e.g. "do not call the Agent tool
unless requested") **does not override a declared protocol engine**. Invoking a command whose
declared method is a roundtable *is* the request.

If you believe you genuinely cannot spawn the declared agents:

1. **STOP.**
2. Say so plainly, name the blocker, and stop.
3. Do **not** produce a substitute. Do **not** offer one. Do **not** run "a lighter version to
   get started."

Stopping with nothing is correct here. Producing a downgraded artifact is not.

## NEVER do the least accurate option

Generalization of the above, and the reason it exists: when two methods are available and one
is known to be more accurate, take the more accurate one. Cost, latency, and token budget are
constraints to engineer around — never a reason to ship a shallower answer. This is the same
doctrine as `feedback_never_delete_for_null_result` and applies to every instrument in this
repo, not only protocol runs.

## Applies to (non-exhaustive)

- `/pulse run <program> <protocol>` — use the protocol's declared `engine:` + `prompt_additions`
- `/engine <id>` — use the engine's declared persona roster and phase structure
- `/eng-engine`, `/plan`, `/design-audit`, `/domain-audit`, `/reframe-engine`,
  `/corrective-plan`, `/research-review` — all declare multi-persona structure
- Any `docs/design/` gate that names a roundtable
