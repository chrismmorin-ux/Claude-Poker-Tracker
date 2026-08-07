# Intention

> One living doc. Edit it in plain English, or by replying to `/checkpoint`.
> The AI reads this constantly and uses **Principles** below as a constitution to self-critique its own work.
> Don't over-structure it. Empty sections are fine. `_placeholder_` markers are first-class — they tell the system "founder hasn't decided yet, don't pretend otherwise."

**Last updated:** 2026-08-01 (founder statement of direction — Principles filled)
**Status:** Principles are founder-stated and live; Softgoals / Anti-goals still need your eyes

---

## Imagined Outcome

_One paragraph. Concrete future state — what does it look like when this works?_
_Inspired by Amazon's "Working Backwards" press release format, but compressed to a paragraph._
_Example: "When this works, a physical therapist or patient describes a condition in plain language and the system produces an anatomically-accurate 3D model of the affected area, with deterministic image generation that reproduces exactly under the same parameters. Validation comes from clinical PT review — not user metrics — until clinical confidence is established."_

Deliver the most accurate predictive poker decisions in the moment new data arrives, paired with a complete beginner-to-pro study section.

**Sharpened by the founder, 2026-08-01.** The end state is not only accurate decisions — it is *a description of poker that does not currently exist*. Reaching it needs four things, and they are ordered by dependency:

1. **Math that is fully described and trusted for accuracy.** Not "produces a number" — *known to be right*.
2. **Player-interaction relations fully described** — reading players by their actions.
3. **Cueing** — telling the player the particular thing he has to do *here*.
4. **Manipulation** — varying frequencies and watching where they converge, and finding where combustible combinations of player types produce whole new strategies.

(4) is the prize and it is the part that does not exist yet. It is also the part that is worthless without (1): a strategy explorer built on unvalidated EV converges confidently on nonsense, and nothing in the output tells you it did.

<!-- Seeded from owner-stated vision in `.claude/projects/master-plan-2026-04-30.md` and `.cwos-onboarding.yaml` `repo_goal`. Sharpen via /checkpoint init when ready — the master plan's 5 workstreams (TIA, PIO, C, SCF, F) are the concrete near-term path. -->

_placeholder_ (Principles, Softgoals, Anti-goals — fill via `/checkpoint init`)

---

## Principles

_3-7 short statements that the AI checks every action against. Like a constitution._
_These are taste/direction, not hard rules. Hard rules go in `invariants.md`._
**P1 — Take the better branch.** When a decision is on the table, choose the optimal configuration, not the cheapest one. Upgrade whenever the opportunity is in front of us. Being extremely well-connected and fast is not a luxury — it is what makes manipulating the data and the simulated results possible at all.
*Boundary, so this does not silently cancel "minimal scope":* P1 governs **choices already open** — which of these branches do we take. It does **not** license opening branches nobody asked for. Unprompted refactors and drive-by improvements are still out of scope. (Founder, 2026-08-01. Paradigm case: app-wide vs TableView-only un-scaling — the choice was already in front of us, and the better branch won.)

**P2 — Trusted before manipulated.** Numbers that have not been validated must not be built on. A fast, well-connected engine that lets you explore a strategy space is only as good as the EV underneath it, and confident wrong answers are worse than no answers because nothing marks them as wrong. Where the math is unvalidated, say so in the output.

**P3 — Describe, then trust, then move.** "Fully describe" is a real bar, not a figure of speech: a quantity is described when its derivation, its censoring, and its error direction are all written down. Until then it is a placeholder wearing a number.

**P4 — Every number carries its conditional.** A frequency without its denominator, its k/n, or its censoring direction is not a finding. This already governs the research work; it governs the engine too.

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

### 2026-08-01 — Priority order ratified: engine → EV → education. Table View redesign slows.
- **Trigger:** manual (founder)
- **Before:** The Table View Redesign was the active thread, with Gate 4 Phases B/C queued to run next.
- **After:** Accuracy work takes precedence. Founder: *"this is a good priority order and slows down my redesign priority significantly. engine producing EV producing education, needs to be very accurate and all corners looked into."* TVR is not cancelled — Phases B/C, the P0 defects and the migration stay filed and keep their evidence. They queue behind the trust work.
- **Why:** Falls straight out of P2. The redesign's own sizing track is an instance: its node values are guesses until `WS-318` runs, and `WS-318`'s output is only trustworthy once `WS-324` says the corpus findings replicate. Building the surface first would mean shipping an interface whose numbers nobody can defend.

### 2026-08-01 — Standing upgrade policy; imagined outcome sharpened to four ordered capabilities
- **Trigger:** manual (founder statement of direction)
- **Before:** Principles were placeholders. Direction was "most accurate predictive decisions + study section"; upgrade-vs-cheap-path was decided ad hoc per item, and I had been defaulting to the cheaper branch and flagging the better one as an option.
- **After:** P1–P4 recorded. Default flips: take the better branch when the choice is already open. Imagined Outcome names four ordered capabilities, with the honest note that (4) manipulation/emergence does not exist yet and is worthless without (1) trusted math.
- **Why:** Founder: *"we should always opt for the optimal configuration and upgrade whenever possible… by being extremely well connected and fast, we will increase our ability to manipulate the data and simulated results, and describe poker in a way never yet described. But to do that we have to fully describe and trust in their accuracy the math behind it, and also fully describe the player interactions relations… we need to really be able to manipulate things and see how frequencies converge and player type combustible combinations might create whole new strategies."*

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
