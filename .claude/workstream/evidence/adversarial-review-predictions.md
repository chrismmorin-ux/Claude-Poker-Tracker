# Adversarial review — predictions recorded BEFORE any result arrived

**Written 2026-08-06, five fresh-context adversaries dispatched, none reported yet.** Recorded so
they can be wrong. Scored against the actual findings in the same file afterwards.

## The exposure I already know about, stated first

**P0 — the `matcher: "*"` change may have silently disabled the barrier, and my "proof" predates it.**
I demonstrated the Bash block live through the harness while the matcher was
`Read|Grep|Glob|NotebookRead|Bash`. I then changed it to `"*"` and **only re-tested by piping JSON
into the hook directly** — which exercises the hook's logic, not its registration. If `"*"` is not a
valid `PreToolUse` matcher in this version, the barrier currently does not run at all, and the
accept criterion I claimed to satisfy ("proven by a denied read, not by a passing test of the hook's
logic") is no longer satisfied by the code as it now stands. **I expect this to be found.** It is
the same class of error as the turn counter: a change made after the verification, never re-verified.

## Predictions

**P1 — the decoy shuffle is broken.** `sort(() => rand() - 0.5)` is a known-invalid shuffle idiom
and I used it in `echo-meter.mjs`. Predicted: confirmed as a defect. Predicted immaterial to the
conclusion, because `E(O,D)` is zero regardless — but "immaterial" is my guess and it is exactly the
kind of guess that has been wrong twice today.

**P2 — `E(O,D) = 0.00000` across all 26 sessions is an instrument artifact, not a finding.**
I flagged it as suspicious and then concluded it was genuine ("verbatim 5-content-word collisions do
not happen"). I now think that was the comfortable reading. Predicted: partly an artifact, most
likely in `buildDecoy`'s exclusion filter, whose second condition
(`rel.endsWith(r.replace(/^.*?\//, ''))`) I cannot justify on inspection.

**P3 — several compact-tier anchors are vacuous.** Anchors are single strings that must appear in a
source file. Several are common words — `engine`, `live`, `dispatch`, `blocker`, `equity`,
`conditional`, `3.4` — which would resolve even if the doctrine they claim to represent were
deleted. Predicted: **at least 5 of 18 anchors are theatre.** This is a design flaw, not a typo: it
makes S2's "every term re-verified against source at emit time" weaker than advertised.

**P4 — inherited numbers I never verified will not survive.** Specifically "62.5% growth in ten
days", "156 lines/day", "prior-life average of 3.9", and "136 commits". I took the first three from
the handoff and the fourth from a subagent, and repeated all four as fact. Predicted: at least one
refuted or unverifiable.

**P5 — the power formula is wrong or inadmissible.** `n = 15.7 * (SD/delta)^2` is a half-remembered
two-sample normal approximation applied to heavily skewed rate differences (CV 2.5, floor at zero).
Predicted: the formula is roughly right for its assumptions and the ASSUMPTIONS are violated, so the
reported MDEs are optimistic. Predicted direction: the study needs MORE data than I claimed, not less.

**P6 — the compact tier contains redundant rules.** Several restate doctrine already injected every
session by the harness (`CLAUDE.md`, `.claude/rules/*`). Under S5 ("never a digest") those are pure
duplicated cost. Predicted: **at least 4 of 18 rules are redundant with always-loaded content.**

**P7 — D4 does not survive.** `.git/hooks/` is untracked and `.git/config` is local, so the fix is a
one-time manual action on one machine with nothing detecting regression. Predicted: confirmed, and
correctly characterised as unsolved rather than fixed.

**P8 — the broader test suite has breakage I did not look for.** I ran only my own four files.
Predicted: something else is red, most likely from the `cwos-reconcile.js` surgery or the
`settings.json` changes.

## What would make me wrong in the useful direction

If the adversaries return mostly clean, the honest reading is **not** that the work is sound — it is
that the briefs were too narrow or the adversaries too agreeable. In that case the correct next step
is a harder brief, not a victory lap. Recording that now so it cannot be renegotiated later.
