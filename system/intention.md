# Intention

> One living doc. Edit it in plain English, or by replying to `/checkpoint`.
> The AI reads this constantly and uses **Principles** below as a constitution to self-critique its own work.
> Don't over-structure it. Empty sections are fine. `_placeholder_` markers are first-class — they tell the system "founder hasn't decided yet, don't pretend otherwise."

**Last updated:** 2026-04-30 (seeded by `/adopt` from owner-stated vision)
**Status:** needs your eyes

---

## Imagined Outcome

_One paragraph. Concrete future state — what does it look like when this works?_
_Inspired by Amazon's "Working Backwards" press release format, but compressed to a paragraph._
_Example: "When this works, a physical therapist or patient describes a condition in plain language and the system produces an anatomically-accurate 3D model of the affected area, with deterministic image generation that reproduces exactly under the same parameters. Validation comes from clinical PT review — not user metrics — until clinical confidence is established."_

Deliver the most accurate predictive poker decisions in the moment new data arrives, paired with a complete beginner-to-pro study section.

<!-- Seeded from owner-stated vision in `.claude/projects/master-plan-2026-04-30.md` and `.cwos-onboarding.yaml` `repo_goal`. Sharpen via /checkpoint init when ready — the master plan's 5 workstreams (TIA, PIO, C, SCF, F) are the concrete near-term path. -->

_placeholder_ (Principles, Softgoals, Anti-goals — fill via `/checkpoint init`)

---

## Principles

_3-7 short statements that the AI checks every action against. Like a constitution._
_These are taste/direction, not hard rules. Hard rules go in `invariants.md`._
_Examples:_
- _"Determinism > novelty. A generative output without a reproducible seed/trace is not done."_
- _"Modeling fidelity matters more than UI polish at this stage."_
- _"Clinical correctness is non-negotiable; aesthetic correctness is negotiable."_

- _placeholder_

---

## Softgoals

_What does "good enough" look like for the current stretch of work?_
_Qualitative, not numeric. Inspired by KAOS goal modeling._
_Examples: "A model that a licensed PT looks at and says 'yeah, that's a normal shoulder.'"_

- _placeholder_

---

## Anti-goals

_What we are explicitly NOT trying to do. Often more clarifying than goals._
_Examples: "Not building a consumer-facing app yet." / "Not optimizing for low-end devices." / "Not pursuing FDA clearance in v1."_

- _placeholder_

---

## Open Questions

_First-class state. These are the questions where founder direction is pending._
_Don't resolve them artificially. They sit here until you have a real answer._
_Status: open | needs_founder | resolved (with date)_

| ID | Question | Status | Resolved (date + answer) |
|----|----------|--------|--------------------------|
| OQ-001 | _placeholder — example: "Who is the first user we're designing validation for?"_ | open | — |

---

## Recent Direction Changes

_Auto-appended by `/checkpoint` when you confirm an assumption or change direction._
_Most recent on top._

<!-- Format:
### YYYY-MM-DD — [one-line summary of change]
- **Trigger:** /checkpoint | /decide | manual edit
- **Before:** [what was true]
- **After:** [what is now true]
- **Why:** [reason]
-->

_(no entries yet)_

---

## Checkpoint Counters

_Maintained by `/status`, `/session-start`, and `/checkpoint`. Surface "checkpoint due" recommendation when thresholds tip._
_These are signals to the founder, not a forced interrupt._

| Counter | Value | Threshold | Action when tipped |
|---------|-------|-----------|--------------------|
| Days since last checkpoint | 0 | 14 | Surface "checkpoint recommended" in /status |
| Work items completed since last checkpoint | 0 | 10 | Surface "checkpoint recommended" in /status |
| Implicit decisions auto-captured since last checkpoint | 0 | 3 | Surface "checkpoint recommended" in /status |
| Open questions added since last checkpoint | 0 | 2 | Surface "checkpoint recommended" in /status |

**Last checkpoint:** never

---

<!--
Authoring notes for AI:

1. **Replace `_placeholder_` markers** ONLY when the founder has provided real content. Never make up content to fill them.
2. **Principles drive self-critique.** When you finish a work item, before marking it complete, ask: "Does this still serve every principle? If not, flag it."
3. **Open questions block work.** Items that depend on an unresolved open question should be deferred or surface the question to the founder.
4. **Direction changes are mutations, not appendices.** When the founder confirms a direction change in /checkpoint, MUTATE the relevant section (Imagined Outcome, Principles, Softgoals, Anti-goals) AND append a one-line entry to "Recent Direction Changes". Never just log without mutating.
5. **Checkpoint counters auto-update.** /status reads workstream queue completions, auto-decision captures, and open question additions to keep these current.
-->
