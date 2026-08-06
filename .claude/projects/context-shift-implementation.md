# Context Shift — Implementation Handoff

**Written 2026-08-05 at a deliberate session boundary.** The session that designed this carries the
maximum accumulated context the shift exists to remove. Implementing it there would bake in the drag.
Founder: *"We probably need to refresh context in order to properly implement the context shift."*

**This file is the crossing artifact. It is deliberately compact.** A narrative handoff would move the
drag rather than leave it behind — which is the thing being fixed.

---

## The problem, in one paragraph

Context is a prior on the model's output distribution, not reference material. Terms present in
context become likelier to appear in output; framings present become likelier to be the framing
reasoned within. `POKER_THEORY.md` has grown to 2,495 lines, **62.5% of it written in the last ten
days at 156 lines/day against a prior-life average of 3.9** — a 40× acceleration with no ceiling.
Proven in-session: a six-lens roundtable "converged" on a conclusion already sitting in a memory file
loaded at every session start. The tell was one lens reproducing the conclusion's *structure* with its
*mechanism* wrong — recall-then-reconstruct, not read-then-derive.

## Artifacts — read in this order, do not read the session transcript

| Path | What it is |
|---|---|
| `docs/context-system-requirements.md` | R1–R14 + pre-registered criteria C1–C7 + predictions. **Fixed before any design existed. Binding.** |
| `docs/context-system-comparison.md` | Judge's verdict + **the cherry-picked synthesis. This is the design to build.** |
| `docs/context-architecture.md` | POKER_THEORY measurement + two-tier design + falsifier |
| `docs/context-bundles.md` | Scoped bundles, lens binding, validator (built and run) |
| `docs/arm-a-greenfield-context-design.md` | Greenfield arm |
| `docs/arm-c-maxdrag-context-design.md` | Max-drag arm |

Queue: **WS-422** (bundles), **WS-423** (POKER_THEORY tiering), plus whatever the judge filed.

## Settled — do not re-litigate

- **Section numbers do not travel; vocabulary does.** §16: 1 citation, 151 occurrences of its own
  vocabulary. §3.4: 19 citations, its heading phrase appears **zero** times elsewhere. §7, most-cited
  at 156, is the only section with an always-loaded compressed form. n=1 natural experiment, and it
  points at the light tier.
- **A summary nobody cites is the failure mode.** §8 is the only top-level section with **zero**
  external citations, and it is a digest of sections drawing 132 and 156. **Readers cite the source,
  never the summary.** A rise in light-tier citations is an *inverted* indicator.
- **The changelog is archaeology in prime position** — 8.9% of the document's words in 1.8% of its
  lines, at lines 10–55, ~4,740 tokens before the first sentence of doctrine, cited by nothing,
  already in git. Move it out.
- **Corrections-history is 12.5% of lines, not the main driver.** Accretion rate is. 24 narratives
  collapse to **6 recurring families + 11 one-shots**; ~40 lines of rule replace 313 of story. Six
  one-shots are closed by a test, and the test is the better record.
- **Two persona kinds stay distinct.** `.claude/agents/*.md` = 38 analytical **lenses** (who audits).
  `docs/design/personas/` = 40 product personas (who a surface serves). Field name is `lens:`. A
  `persona-kind-confusion` check exists because otherwise a category error reads as a typo.
- **The 20 bb/hr anchor is real** (Goone, $5/$5 Hustler; persuadeo 18.8 bb/hr at $1/$3) and **unfit as
  a scale test** — total-realised vs incremental-modelled, two stake tiers up. Band for live
  $1/$2–$1/$3: **8–12 bb/hr**. Use the **drop line** (20–29 bb/100 in rake+jackpot+tips) as the post:
  pace-independent, venue-published, self-measurable in one session.

## Open — the fresh session decides

1. **Storage partition vs sampling control.** Arm C organised around two tiers (storage). Arm A
   rejected the partition for control at the *injection point*, arguing position beats volume and cost
   is bytes × turns. The judge ruled; **follow the ruling.**
2. **Is withholding enforceable?** Arms B and C said no. Arm A cites `git-guard.cjs:276` — a
   `PreToolUse` hard deny — as proof a `Read` can be blocked before it happens. **Decides whether
   `excludes` is a barrier or an audit trail.**
3. **Warn vs block.** Repo precedent is warn-never-block. Arm A refuses it for irreversible acts:
   *warn on a declaration, block on an irreversible act.*
4. **How the tiers cannot disagree.** Three candidates: hash-checked generation (detection); no file
   at all, generated per turn (impossibility); no re-measurable magnitude in the light tier
   (impossibility by a different route).

## Verify before building — claimed, not all confirmed

- `.git/hooks/` is **empty**, so six shipped pre-commit hooks never run.
- The bundle validator's only caller is a local edit to a **kit-managed** file (`cwos-reconcile.js` in
  `kit/hashes-3.8.5.yaml:233`) — `/kit-upgrade` reverts it. Never put enforcement in `kit/`.
- Name collision with `kit/scripts/lib/cwos-bundle-validate.js`, required by `cwos-verify.js:596`.
- 4 open items carry a math `problem_class` with no scoped context: **WS-405, WS-406, WS-416, WS-417**.
- 16 dangling `§`-citations in POKER_THEORY.md, including a `§FSA` that does not exist.
- **The same measurement appears five times with three values**; §11.9's "coverage 100%" is true *by
  construction*, so the "~94%" elsewhere is a different quantity mislabelled. **WS-291's mechanism
  inside the document written to prevent it.**

## The falsifier — pre-register before shipping

Light-tier vocabulary rate **minus a control vocabulary rate**, per 1,000 words, in artifacts created
after the change. Baseline is the reproducible Part 1 sweep. Gate: n ≥ 40 artifacts or 60 days.
**A null result deletes the light tier rather than tuning it.**

## What NOT to carry across

Do not import this session's narrative, its corrections, or its conclusions-as-premises. The findings
above are stated as facts with their evidence; **that is all that should cross.** If a fresh session
re-derives one independently, that is replication and it is worth more than the inheritance.

Two confounds on the comparison, for honesty: **Arm B's brief was written by Arm C's author**, so
A-vs-(B,C) is the real contrast; and **Arm A was greenfield only for long-form documents** — the
harness injected `CLAUDE.md`, `.claude/rules/*`, and `MEMORY.md` before its first action. Re-running
cleanly needs a settings override.

## The founder's closing requirement — the light tier carries BEHAVIOUR, not doctrine

*"You ran this session in a completely different way than normal... I think this kind of behavior is
what we want to be pervasive throughout our context as well."*

What changed, stated as behaviour so it can be encoded: **dispatch rather than assert** · write briefs
that permit disagreement (state the hypothesis under test as the *correction*, not the founder's
claim) · **pre-register the falsifier before seeing the result** · treat your own output as the least
trustworthy input · relay contradictions prominently, never in a footnote · name your own
contamination unprompted.

Evidence it worked: **nine claims relayed to the founder were overturned by agents dispatched to check
them**, and both pre-registered predictions failed and were recorded unhedged. The judge's diagnosis
of the opposite failure is the same axis inverted — **"context-ladenness substituted for looking."**

**It was externally forced twice and holds only because of mechanism** — a `UserPromptSubmit` hook
injecting a rotating real past failure each turn, and a `Stop` hook blocking on retreat vocabulary.
Left alone, the drift returns. That is the argument for structure over memory, and it is the same
argument the whole context shift rests on.

**Design consequence, and it is binding:** the light tier must carry *behaviour*, not a summary of
doctrine — and per the judge's ruling it must **never be a digest**, because §8 "Common Mistakes" is
the only POKER_THEORY section with **zero** external citations. Readers cite the source, never the
summary. Full statement: `memory/feedback_dispatch_dont_assert.md`.

## Sequencing

1. Read the judge's synthesis. Build what it specifies.
2. Enforcement lives in `.claude/hooks/` or `scripts/` — **never `kit/`**.
3. Pre-register the falsifier before shipping, not after.
4. Fix `.git/hooks/` independently; it is unrelated and currently silent.
