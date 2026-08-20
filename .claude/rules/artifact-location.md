# Where heavy artifacts live — node1 is the canonical home

**Founder ruling, 2026-08-20.** Resolves ~7 open queue items that each carried this as a
per-item decision flag.

## The rule

**Heavy artifacts live outside the repo, and CM-NODE1 is their canonical home.**

That covers the atom store, Result Cards, corpus derivatives, backtest outputs, generated
Deal Books, and anything else that is large, machine-produced, and re-derivable. The repo holds
the code that produces them and the manifests that identify them — never the artifacts.

**node1 does the compute and owns the output. G16 pulls what it needs.** This is the fleet
working as designed rather than an exception to it: node1 exists for long unattended compute,
and an artifact produced there should not have to travel to be authoritative.

## What stays in the repo

- **The replication manifest.** Engine commit, Deal Book hash, partition, every seed, every
  load-bearing constant, `disclaimerRegisterVersion`. A Result Card's manifest is the repo's
  record of an artifact it does not store.
- **The pointer** — enough identity (hash, size, location) that a card can always find its
  atoms, and that a missing artifact fails loudly rather than silently resolving to something
  else.
- Anything small, hand-authored, or that must version in lockstep with the code.

## The cost this ruling accepts, named

**G16 work stalls when node1 is unreachable.** That is the known price and it was chosen with
the price stated. Two consequences follow and neither is optional:

1. **Unreachable must be an error, never a fallback.** A consumer that cannot reach the
   canonical artifact refuses. It does not silently use a stale local copy, and it does not
   quietly recompute a substitute — either would reintroduce the exact ambiguity the Standard
   of Record exists to remove.
2. **A local copy is a cache and says so.** If one exists it carries the canonical hash, and a
   mismatch is a hard failure.

## Moving data

Do not improvise a transfer. Load the `fleet` skill — a channel already exists for this, and
the anti-patterns in it came from real incidents. Note the standing fleet fact: **SSH-launched
processes die with the session on node1** — use Task Scheduler for anything unattended.

Related: `docs/standard-of-record/VOCABULARY.md` (§ atom store operations — location, measured
sizes, and how to move it), `.claude/rules/machine-affinity.md`.
