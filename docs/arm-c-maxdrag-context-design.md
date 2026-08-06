# Arm C — Context System Design (maximum-drag arm)

**Author's position, stated so the judge can weight it:** I have this entire session in working
context — a six-lens roundtable, a cross-critic, an engine fix, a Gate 2, and every correction the
founder made to me along the way. If context drag is real, this document should carry the most of
it. I have not tried to write around that; doing so would destroy the control.

Against R1–R14 of `docs/context-system-requirements.md`.

---

## The central idea

**The always-loaded tier is not a summary. It is a sample of the output I should produce.**

Everything follows from R1. If context is a prior on the output distribution, then a document that
*describes* good reasoning is weaker than one *written in* the voice, vocabulary and cadence of the
reasoning I want. A reference work says "use credible intervals rather than point estimates." A
prior says "k/n, the conditioning set, and the inverse conditional — a number without them is a
decoration." The second is shorter, more specific, and far more likely to reappear in my output,
because it is already in the shape of my output.

So: **write the light tier as if it were an excerpt from an excellent response.** Imperatives and
named quantities, not descriptions of practice.

## R2/R3 — the two tiers

**Light (`poker-theory-light.md`), always loaded.** Vocabulary, invariants as imperatives, the
handful of formulas that must never be re-derived wrong, and the named failure modes. **Ceiling: 200
lines.** Not aesthetic — beyond roughly that, it competes with the task for attention and starts
being skimmed, at which point it stops being a prior and becomes furniture.

Selection criterion, stated as a test: *would a response that ignored this line be wrong, or merely
less informed?* Only the first earns a place.

**Heavy (`POKER_THEORY.md`), loaded by task type.** Derivations, measurements with provenance,
implementation inventory, the full argument for every claim in the light tier. Nothing in the light
tier may exist without a heavy-tier source.

## R4 — the tiers cannot disagree, by construction

**The light tier is generated, never hand-edited.** Passages in the heavy document are marked
(`<!-- LIGHT: invariant -->`, `<!-- LIGHT: vocab -->`), a build step extracts them, and the light
file carries a content hash of its source span.

A check — the same shape as the freshness mechanism built today — verifies every light-tier line
still resolves to its marked source and that the source has not changed since extraction. Drift
warns and names the line. The light file is generated output and should be treated like any other
generated artifact: never edited, always reproducible.

This is the discipline the hole map already uses — JSON is truth, the view is a projection — applied
to doctrine.

## R5 — corrections: split the fact from the narrative

The requirements offer a distinction and I think it is nearly right but incomplete. Fired-once-and-
fixed-structurally is archaeology; fired-more-than-once is doctrine. **But there is a third thing,
and it is the one that actually bit this session:** the *fact that a claim has been falsified before*
is permanent doctrine even when the narrative of that falsification is archaeology.

§3.4's exhaustive taxonomy of betting motivations was falsified once (protection and equity denial
were missing). The recommended marker — "this list has been incomplete before" — was never added,
and the section still reads with unqualified confidence. The correction was archived; the *humility*
was not.

So, three destinations:
- **Light tier**: a falsification counter on any claim asserting completeness. `§3.4 — taxonomy,
  falsified 1×`. Four words, and it does the work that the whole narrative failed to do.
- **Heavy tier**: the correction, attached to the claim it qualifies, not in a changelog.
- **Archive** (`docs/context-archive/`): the narrative, out of the loading path entirely.

Kill the changelog at the head of the heavy document. It is archaeology occupying the most-primed
position in the most-loaded file in the repo.

## R6 — promotion is earned, not curated

A concept enters the light tier when it has been independently rediscovered. The mechanism already
exists: finding files carry `dedup_key` and `source.run_id`. **A finding whose `dedup_key` recurs
across two or more distinct `run_id`s is a concept the system keeps failing to hold — promote it.**

That makes promotion a query, not a judgement call, and it is auditable. Candidates by this rule
today: labels-as-inputs, confidence-on-a-different-denominator-than-the-estimate, correctness-
verified-without-reachability.

## R7 — bundles

A bundle is a **manifest** (`.claude/bundles/<name>.yaml`) naming files and path globs, plus a
`digest` — the content hash of everything it resolves to. Staleness is the difference between the
recorded digest and the current one, checked by the same validator that checks everything else. A
manifest can name a file that no longer exists; the check catches it. This is exactly the failure
that made nine of thirteen scope patterns in `prog-domain-correctness.yaml` match zero files while
the program read as healthy.

## R8 — two persona kinds, kept apart by a namespace

`docs/design/personas/` — **product personas**. Who uses the product. `study-block`,
`chris-live-player`.

`.claude/lenses/` — **analytical lenses**. How a problem is examined. `estimation-theorist`,
`game-theorist`.

Different directories, different filename prefixes, and a check that refuses a cross-reference. They
are not two flavours of one thing: a product persona is a subject of the design, a lens is an
instrument applied to it. Conflating them would let "who reads this" quietly answer "how was this
examined."

## R9 — withholding, which is the hard one

A bundle declares `withhold:` — paths a task must **not** load. For any bundle tagged
`mode: discovery`, prior findings on the same subject are withheld **by default**, opt-in rather
than opt-out.

The justification is measured rather than theoretical. This session's roundtable produced apparent
six-lens convergence on a conclusion that was sitting in a memory file loaded at every session
start. The tell was one lens reproducing the conclusion's structure with its mechanism wrong. A
discovery task that loads the answer does not discover it.

Enforcement is honest but partial: the validator can check that a bundle *declares* its withholds
and that they resolve. It cannot check that an agent did not read a file it was told to skip. That
gap is real and I am not going to paper over it — the containment is that discovery tasks run as
subagents with their own context, so withholding is enforced by what is *put in front of them*, not
by their restraint. The greenfield arm of this very comparison is the working prototype.

## R10/R12 — enforcement, and why it must be a hook

**Two hooks already exist and prove the pattern**: a `UserPromptSubmit` hook injecting a standing
rule every turn, and a `Stop` hook that blocks on retreat vocabulary. Both were built today,
specifically because a rules file had failed to change behaviour for months.

The light tier ships the same way: **injected by hook, not read by discipline.** That satisfies R12
outright — the system does not depend on my having read the system.

The validator extends `cwos-reconcile.js:738`'s existing precedent: builds the declared vocabulary,
checks usage, **warns and never blocks**, because an item failing the check may be evidence about
the declaration rather than about the item.

## R11 — the ceiling is a test, and it fails hard

`lightTierSize.test.js` — asserts the generated light tier is ≤200 lines and its vocabulary is a
subset of `VOCABULARY.md`. **This one fails rather than warns.** Everything else warns because
ambiguity is informative; here it is not. A light tier over its ceiling is not evidence about the
ceiling, it is a light tier that has stopped working.

## R13 — vocabulary is checked against the register

The same test asserts every term in the light tier appears in `docs/standard-of-record/
VOCABULARY.md`. A new term must land in the register in the same change — a rule that file already
imposes on itself.

## R14 — falsifier

**Primary, and measurable now.** Vocabulary adoption rate. Take the declared terms from
`VOCABULARY.md`, sample N assistant turns from session transcripts before the change and N after,
and count the rate at which a declared term is used versus a paraphrase of it. If the light tier is
functioning as a prior, that rate rises. If it does not move, the mechanism is not working and the
restructure has failed regardless of how good the documents look.

**Secondary, and stronger but slower.** Re-run a blind-spot protocol with the memory file withheld
and compare the findings to the run that had it. If the convergence changes, drag was real and the
withholding rule earns its place. If the findings are the same, the inheritance diagnosis was wrong
and R9 should be dropped.

I want to name that second one clearly: **it can falsify a requirement I have just designed around.**
That is the point of stating it.

---

## What I would tell the judge about my own arm

The drag I can see in my own output: every mechanism above is a variation on something built earlier
today — generated-artifact-plus-hash from the hole map, warn-don't-block from the reconcile
validator, hook-injection from the improvement-default rule. That is either good reuse of proven
machinery or it is exactly the failure mode this experiment was designed to detect, and **I am the
wrong party to judge which.**

The drag I probably cannot see is the shape of the problem itself. I have accepted "two tiers,
light and heavy" as the frame because the founder proposed it and I have been reasoning inside it
for an hour. A greenfield arm might not partition it that way at all, and if it does not, that
disagreement is the most informative output of this comparison.
