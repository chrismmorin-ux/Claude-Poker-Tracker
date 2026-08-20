# Sparse n — refuse or shrink, and how to tell which

**Founder ruling, 2026-08-20.** Resolves ~29 open queue items that each carried this as a
per-item decision flag. It is a standing prior, not a case-by-case call.

## The rule

**Refuse for comparative claims. Shrink for decision inputs.**

- A **comparative claim** — anything someone could act on or cite, anything that resolves to a
  Result Card, anything a Guide or a drill or a Hole Map shows a human — **refuses** when n
  cannot support it. It emits `unexamined` with a reason from a closed enum. It does not emit a
  shrunk number that reads like a measured one.
- A **decision input** — a value the engine consumes internally on its way to an action, never
  displayed and never cited — **shrinks** toward its parent prior. A subclass grid is carved
  from its parent (DEC-025 Amd 1); a villain's thin cell pulls toward the population.

## Why this boundary and not another

The register already does both, in opposite directions, and already says so: a Guide cell with
n=0 reports `unexamined` and explicitly does **not** inherit the general Guide's value (`AS-732`),
while subclass grids shrink toward the parent. The register notes these *invert* each other and
coexist "because they are different operations — shrinkage answers *estimation under sparse
data*, the Guide lattice answers *marginalization of a measured joint*."

What was missing was the rule for **which applies when**. The founder tied it to ADR-009's
existing trigger rather than to a new boundary: **a number someone could act on or cite.** That
trigger was already load-bearing, already written down, and already the thing the Standard of
Record binds. This rule adds no new concept — it points the sparsity decision at the concept
that was already deciding everything else.

## Applying it

1. Ask ADR-009's question first: **could someone act on this number or cite it?** If yes, it is
   a comparative claim, whatever module it lives in.
2. Comparative → refuse. The refusal is **named**, never silent, and carries its reason.
   `observed-zero`, `unexamined` and `dropped` stay distinct — a zero is three facts, not one.
3. Decision input → shrink, and shrink **toward the parent**, never fit the child independently,
   never normalise a prior grid into a distribution.
4. **A shrunk value that later reaches a surface has changed class.** The moment a decision input
   is displayed, cited, or compared, it must carry the fact that it was shrunk, or it must
   refuse. Class is determined by where the number *ends up*, not by where it was computed.

## The failure this prevents

A shrunk number is indistinguishable from a measured one to a downstream consumer unless the
distinction is carried as data. That indistinguishability is the WS-291 mechanism: a wrong number
that never had to meet a right one. Refusing on the surface side keeps the holes visible, and
**the holes become the work queue** — which is the whole argument for `unexamined` over
inheritance.

Related: `.claude/rules/unmeasured-constants.md` (what to do when the value is missing entirely
rather than thin), `docs/standard-of-record/VOCABULARY.md` (`Census`, `unexamined` in a Guide).
