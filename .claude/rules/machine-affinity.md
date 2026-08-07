# Machine Affinity — `runs_on:`

Every queue item carries a `runs_on:` field naming the machine it should be worked on. The
point is to stop wasting a session: some work is impossible from a phone, some work should
never occupy the founder's daily driver, and until now nothing in the queue said which.

## The fleet

| Label | Machine | What it means |
|---|---|---|
| `phone` | Galaxy S22 (`chriss-s22`) | Approvable from a pocket. Small scope, prose or config only, no diff to read on a 6-inch screen, no visual check. |
| `g16` | Dell G16 7630 (`morincomputer`) | Needs the cockpit. Dev server, Playwright screenshots, visual verification, any `.jsx`/CSS/layout work, the Ignition extension, large multi-file diffs. |
| `node1` | CM-NODE1 | Long unattended compute. Backtests, HandHQ corpus mining, calibration runs, ablations, full-suite sweeps. Start it, disconnect, check back. |
| `any` | — | Computer work with no machine constraint. The honest default. |

`offline` exists in the shared vocabulary but is **not used in this repo** — it means a
real-world errand, and this is a code repo. See the note on collisions below.

## Choosing a label

Ask in this order and stop at the first yes:

1. **Does it touch a `.jsx`, a view, a component, CSS, or the extension?** → `g16`.
   File paths beat prose here. A UI file is UI work however the title is worded.
2. **Is it a long compute job that needs no attention while it runs?** → `node1`.
   Backtest, corpus pass, calibration, ablation, bake-off, regeneration.
3. **Does it need to be seen?** Screenshots, dev server, responsive checks → `g16`.
4. **Is it small AND prose/config only?** → `phone`.
5. **Otherwise** → `any`. Do not guess. A wrong label gets trusted; an `any` label just
   defers the question to whoever picks the item up.

## Using it

- `/next` output should carry a **Machine** column in the items table. The `runs_on` value
  is part of the item, so read it when composing and surface it — a founder on a phone
  should be told immediately if the top item needs the G16.
- When the founder is clearly on mobile, prefer `phone` and `any` items, and say plainly
  when the highest-priority item is `g16`-bound rather than silently proposing it.
- Batch `node1` items. They are the ones worth queueing up before stepping away, and they
  are the reason node1 exists.

## Backfill provenance (2026-08-05)

174 items were labeled by rule, not by hand. Distribution: `any` 70.7%, `g16` 17.2%,
`node1` 9.8%, `phone` 2.3%. The high `any` share is deliberate — the backfill defaulted to
`any` whenever a rule did not clearly fire.

**Correct labels as you encounter them.** A rule-assigned label is a starting guess, and the
person who opens the item knows better than the regex did.

### The collision that shaped these rules

A first pass included an `offline` rule matching errand vocabulary — `call`, `check`,
`measure`, `inspect`, `buy`. In a poker codebase those are domain terms, and it mislabeled
18 ordinary engine items as real-world errands (`rangeRules treats Bayesian posterior…`
came back as "make a phone call"). A second pass matched a bare `court`, which turned every
custody-research item in the sibling repo into an errand.

The lesson generalizes: **keyword rules over a domain corpus will collide with that
domain's vocabulary.** Prefer structural signals (file extensions, paths, effort) over
prose, and when prose is all there is, require phrases specific enough that the domain
cannot produce them by accident.
