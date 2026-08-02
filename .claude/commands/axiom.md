---
name: axiom
description: "Formalise strategy material into candidate axioms with scoreable predictions — the intake half of the axiom register"
user-invocable: true
argument-hint: "[draft <source> | challenge AX-NNN | list] "
---

# /axiom — Claim intake and formalisation

The **upper half** of the axiom loop: raw strategy material in, candidate entries with scoreable
predictions and a named falsifier out. The lower half — actually scoring them — is
`scripts/backtest/` and is deliberately a separate step.

Register: `.claude/context/POKER_AXIOMS.md`. Staging: `.claude/context/POKER_AXIOMS.draft.md`.

## The rule this command exists to enforce

The assistant **may not originate axioms** (founder, 2026-08-01). It formalises material that
has an owner — the founder's own reasoning, a named external analyst, or a measurement run in
this repo. Anything else is nominated at most, never registered.

**This command never writes to the register.** It writes to `POKER_AXIOMS.draft.md`; the founder
promotes. Same safety posture as the voice pipeline, where facts land in `PROPOSED.md` rather
than editing a system-of-record file unconfirmed.

## Output Shape

**Axiom arc:** `<extracting | formalised | staged>` — `<one-clause status>`.

`<Delta line: what this invocation did — N claims extracted, M formalised, K rejected.>`

`<Remainder: the formalised entries table — ID / working title / provenance / falsifier / scoreable-now? — never prose-only.>`

### Why these claims now?
`<Value-rationale: what the source was, and which register gap it fills. If it duplicates an existing entry, say which.>`

**Do next:** Numbered options — `1. Promote to register` / `2. Score the falsifier first` / `3. Send back for a sharper falsifier`.

## Modes

### `draft <source>` (default)

`<source>` is a path, a pasted transcript, a named analyst + topic, or `--from-measurement <run>`.

1. **Resolve the source and its provenance tier** before anything else. If you cannot name an
   owner for the material, stop and say so — that is an `assistant-asserted` intake and it is
   inadmissible, not a small problem.
2. **Invoke the `claim-formalizer` agent** with the source material. The agent carries the
   consistent context (register schema, POKER_THEORY §7 + §11.7–11.9, engine anti-patterns,
   the 2009 corpus caveat) so entries are comparable across invocations. It is read-only by
   design and cannot touch the register.
3. **Review its output yourself before staging.** Specifically check:
   - Is the **falsifier** aimed at the mechanism, or at a downstream consequence that could
     hold for unrelated reasons? Send it back if it's the latter — this is the failure mode
     that makes an axiom unfalsifiable in practice.
   - Are any magnitudes stated that were never measured? Strike them.
   - Is the founder's original language preserved verbatim where the source was the founder?
4. **Append to `.claude/context/POKER_AXIOMS.draft.md`** under a dated heading, with the
   provenance ledger. Never to `POKER_AXIOMS.md`.
5. **Surface the scoreable predictions** and note which are `(structural)` — runnable against
   the corpus now — versus `(population-drift)` — unscoreable, because the corpus is July 2009
   and seventeen years stale.

### `challenge AX-NNN`

Adversarial pass on a registered axiom. Invoke `claim-formalizer` with the entry and instruct it
to attack the mechanism, not the wording: what else would produce these consequences? What
would we expect to see if the mechanism were false, and do we see it? Append the result to the
register's **Challenge log** — a challenge that finds nothing is still logged, because "never
challenged" and "survived challenge" are different states.

### `list`

Render the register: registered entries with status, candidates split by provenance
admissibility, and the challenge log. No agent invocation.

## Steps (draft mode)

1. Read `.claude/context/POKER_AXIOMS.md` — you need the existing IDs and the provenance rule.
2. Resolve source + provenance tier. Refuse `assistant-asserted` intake.
3. `Agent(claim-formalizer)` with the material.
4. Review per the checklist above. Send back rather than staging a weak falsifier.
5. Append to `POKER_AXIOMS.draft.md` with date, source, and provenance ledger.
6. Emit the arc + table + Do-next options.

## When NOT to use this

- **To generate axioms from nothing.** That is the prohibited mode. No source, no intake.
- **To mark something supported.** Only a scored measurement does that — `/axiom` cannot
  promote status, and the agent is instructed to always write `unverified`.
- **To settle a disagreement.** If the founder and a source conflict, both get formalised as
  separate candidates and the corpus adjudicates. Do not pick a winner in intake.

## Shadow-event envelope

```bash
node kit/scripts/cwos-event.js append command_completed --track T10:axiom-intake --tag /axiom --payload '{"command":"/axiom"}'
```

Non-fatal; never gate output on it.
