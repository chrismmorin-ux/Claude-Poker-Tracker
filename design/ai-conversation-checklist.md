# AI-Conversation Surface Checklist

The AI-conversation surface is the shape of what Claude surfaces back to the
founder inside a repo. It is partially variable (Claude's responses fluctuate)
but strongly influenceable via scaffolding: command preambles, response-shape
conventions, state-visibility decisions, hooks.

This checklist audits the scaffolding, not individual responses. It lifts
prog-design AI-conversation surface through L1-L5.

## Scaffolding audit: command preambles

Every slash command should have a preamble that specifies:

- [ ] **Who the output is for** — founder, AI in next session, automated consumer
- [ ] **Response shape** — table? bullets? decision-first prose? structured markdown?
- [ ] **Signal priority** — what gets surfaced first vs. what can be buried
- [ ] **Failure surface** — what happens when the command can't complete? how is that communicated?
- [ ] **State references** — which state files does this command read? write?

**Red flags:**
- Preambles that describe *process* (what the command does) without shaping *output* (what the founder sees)
- Commands with no preamble at all
- Preambles that vary in format across commands — predictability is UX

## Scaffolding audit: state visibility

### L2 requirement — key state mentioned in common commands
- [ ] `/status` equivalent names at least the top 3 signals the founder cares about
- [ ] Commands that modify state reference the state they changed

### L3 requirement — `/status` + `/pulse` equivalents show key state by default
- [ ] Running `/status` with no arguments surfaces all load-bearing state
- [ ] Staleness signals (old data, unreviewed items) appear without being asked for
- [ ] Programs with open critical findings surface at the top

### L4 requirement — coverage + fidelity
- [ ] **Coverage audit:** every program, every open finding, every staleness signal is reachable via a command
- [ ] **Fidelity check:** surfaced signals match source of truth (no drift from underlying state files, no stale cache)
- [ ] A founder who hasn't opened the repo in 2 weeks gets reoriented in <3 minutes via `/status` + `/session-start`

### L5 requirement — meta-audit
- [ ] There is a way to measure response quality over time (signal density, decision placement, founder action rate)
- [ ] The measurement loop produces improvement items for the scaffolding itself

## Scaffolding audit: response-surface discipline

- [ ] **Decision first, detail second** — every command output leads with the decision or next action, not the analysis
- [ ] **Tables beat prose** for comparisons, scorecards, lists-of-equivalents
- [ ] **One fewer word** — if a line doesn't change behavior, remove it
- [ ] **Warnings are prominent** — not buried below summaries; use visible markers
- [ ] **Output length matches stakes** — one-line for trivial, scannable block for standard, full report for major decisions

**Anti-patterns:**
- Wall-of-text responses with decision buried in paragraph 4
- Long preambles like "I'll now analyze..." before the actual output
- Summarizing what you already showed ("So as you can see...")

## Scaffolding audit: hooks and auto-surfacing

Hooks surface friction without the founder having to trigger it.

- [ ] Session-start hook reads state and surfaces the top priority
- [ ] Session-end hook updates state durably
- [ ] Edit hooks on critical files trigger verification
- [ ] Silent failures (hook errors, broken commands) are themselves surfaced in the next session
- [ ] Staleness hooks — if a program hasn't been audited in N days, surface that

## Scaffolding audit: engine and persona output shape

For repos using CWOS engines:

- [ ] Engine output is **artifact-shaped** (structured YAML/markdown) not freeform prose
- [ ] Each phase of an engine produces a named artifact the next phase consumes
- [ ] Persona output has consistent section headers across invocations
- [ ] Handoffs are smooth — output of one command is legible as input to the next

## What can't be scaffolded (accept the variance)

Claude's individual response phrasing, creativity, and exact word choice vary
session to session. Do not try to control these. Instead, control:

- **What gets surfaced** (preambles, hooks)
- **What format it arrives in** (response shape, state files)
- **What happens next** (commands chain, outputs are reusable)

## Maturity checkpoint

Score yourself against the rubric:

| If you have... | You're at |
|---|---|
| At least one slash command with any preamble | L1 |
| Preambles for common commands that guide response shape | L2 |
| `/status` + `/pulse` equivalents showing load-bearing state | L3 |
| Coverage + fidelity verified; hooks surface friction; response discipline is a habit | L4 |
| A working feedback loop that measures response quality and improves scaffolding | L5 |

## Minimum viable AI-conversation surface (L1 starter)

If bootstrapping, start with:
1. `CLAUDE.md` at the repo root listing the 3 most important state files and the 3 most common commands
2. One preamble on one slash command (pick the one you'll use most)
3. `/status` equivalent that reads state and renders it in a predictable format

That's L1. Graduate to L2 by adding preambles to the other common commands.
