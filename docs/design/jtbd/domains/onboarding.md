# JTBD Domain — Onboarding

Jobs around getting a new user functional — product tour, jargon explanations, skip-paths for experts, sample data for evaluation.

**Primary personas:** [Newcomer](../../personas/core/newcomer.md), [Apprentice](../../personas/core/apprentice-student.md), [Weekend Warrior](../../personas/core/weekend-warrior.md) (first session).

**Anti-primary:** pros ([Multi-Tabler](../../personas/core/multi-tabler.md), [Online MTT Shark](../../personas/core/online-mtt-shark.md)) who want onboarding to be skippable.

**Surfaces:** first-run tour (doesn't exist), tooltips (sparse), sample data (doesn't exist).

---

## ON-82 — 90-second product tour

> When I install the app, I want a 90-second tour that shows the 3 things it does, so I know what to do next.

- State: **Proposed**.

## ON-83 — First-hover jargon explanations

> When I encounter jargon (SPR, MDF, 3-bet, ICM), I want a first-hover tooltip that explains it, so I'm not shut out by terminology.

- State: **Proposed**.

## ON-84 — Skip onboarding for pros

> When I'm experienced with similar tools, I want to skip all onboarding immediately, so I don't waste time.

- State: **Proposed**.

## ON-85 — Import guided mapping

> When I'm importing data from another tool, I want guided field mapping, so nothing breaks and nothing's lost.

- State: **Proposed** (depends on DISC-10).

## ON-86 — Sample data for evaluation

> When I'm evaluating the app without real play data, I want sample hands to explore, so I can see features in context.

- State: **Proposed**.

## ON-88 — Expert-bypass onboarding for category-experienced evaluators

> When I install this app having already used other poker trackers / HUDs / training sites, I want a fast orientation path that shows me this app's specific layout and features — without teaching me what a HUD is, what SPR means, or how to count outs, so I can evaluate whether this product fits my workflow in minutes, not hours.

- State: **Active** (pending Monetization & PMF Gate 4).
- **Primary persona:** [Evaluator](../../personas/core/evaluator.md) in [trial-first-session](../../personas/situational/trial-first-session.md) state. Specifically the E-CHRIS (came from PT4/HM3/DriveHUD) and E-SCHOLAR (came from GTO Wizard/Upswing/Run It Once) sub-shapes — they know the category; they need to know THIS product.
- **Autonomy constraint:** inherits red line #1 (opt-in enrollment) — expert-bypass does not lock the user out of detailed onboarding; it is a faster path offered alongside the standard path. Inherits red line #7 (editor's-note tone) — orientation is factual ("This is where you enter hands. This is where the exploit engine surfaces reads.") not cajoling.
- **Mechanism:**
  - First-run path offers 3 options at equal visual weight: (a) "I'm new to poker trackers — give me the full tour" (routes to full ON-82 product tour), (b) "I've used trackers before — show me this app's layout" (routes to ON-88 expert-bypass fast-orientation), (c) "Skip — let me just use it" (routes straight to main app, ON-84 skip-for-pros).
  - ON-88 expert-bypass fast-orientation is a single-screen (or 3-panel max) overlay that points out: where hand entry lives, where the exploit engine surfaces output, where drills live, where settings live. ≤60 seconds to complete.
  - Tooltips and jargon explanations (ON-83) still fire on-demand during usage for terms specific to this app (e.g., "Shape Language descriptors," "Anchor Library," "Exploit Anchor") — even for expert-bypass users.
- **Served by:** `journeys/evaluator-onboarding.md` (Gate 4 — includes first-run branching for ON-82 vs ON-88 vs ON-84 paths).
- **Distinct from:**
  - **ON-84** (skip onboarding for pros) — ON-84 is "skip tutorials entirely, I don't want any orientation." ON-88 is "I want brief orientation to THIS app's layout, just not taught-from-scratch." An ON-88 user still receives a ~60s app-layout overlay; an ON-84 user receives nothing.
  - **ON-87** (cold-start descriptor seeding / expert bypass for adaptive-learning) — ON-87 seeds an adaptive skill model (for users entering adaptive-learning features like Shape Language); ON-88 orients the user to the app's overall layout. ON-87 is about model-state; ON-88 is about UI-orientation. A user can invoke both (fast orientation + self-declare skill seed) or either independently.
  - **ON-82** (90-second product tour) — ON-82 is the full tour for newcomers-to-category; ON-88 is the abbreviated tour for experts-in-category.
- Doctrine basis: Monetization & PMF Gate 2 audit §Stage B (Market voice surfaced this as missing from original 7-JTBD scope — every SaaS in category has this implicit, worth making explicit). Distinct-from-sibling pattern follows ON-87's distinct-from-ON-84 precedent (see ON-87 entry below).

## ON-87 — Cold-start descriptor seeding (expert bypass)

> When I first enter the adaptive-learning layer for a concept-set I already have expertise in, I want to declare "I already know these" in one screen — without a placement quiz — so the system's initial recommendations respect my starting knowledge.

- State: **Active** (pending Poker Shape Language Gate 4).
- **Autonomy constraint:** the expert-bypass screen is **optional and skippable**. Skip is equal visual weight to declare. No placement quiz (disqualified by Gate 2 autonomy voice + market-lens Duolingo-dropout evidence).
- **Mechanism:** at first Discover-mode entry post-enrollment, one screen lists all N descriptors with a simple "mark any you already know well" checkbox UI + prominent Skip button. Checked descriptors get posterior seed (e.g., `alpha=8, beta=2` ≈ 10 observed interactions with 80% success) + `userMuteState='already-known'`. Unchecked descriptors hydrate at the charter default (`alpha=1, beta=1`).
- **Decision memo basis:** `docs/projects/poker-shape-language/gate3-decision-memo.md` §Q7. The owner is the expert case — he co-authored the descriptors; a uniform-novice start patronizes him; a placement quiz is forbidden. Self-declaration threads the needle.
- **Served by:** enrollment journey spec (proposed Stream A Gate 4).
- Distinct from ON-84 (skip onboarding for pros — that's about skipping tutorials entirely; ON-87 is about seeding an adaptive model, not avoiding one).

---

## Domain-wide constraints

- Onboarding must be skippable — every skip path matters more than any forced-education path.
- Jargon tooltips must be first-hover-only; they must not re-fire after the user has seen them.
- Sample data must be clearly labeled sample (no confusion with real).

## Change log

- 2026-04-21 — Created Session 1b.
- 2026-04-23 — Added ON-87 (cold-start descriptor seeding / expert bypass). Output of Gate 3 for Poker Shape Language adaptive-seeding project. Distinct from ON-84 (skip-onboarding-for-pros = skip tutorials) in that ON-87 seeds an adaptive model rather than bypassing one. See `docs/projects/poker-shape-language/gate3-decision-memo.md` §Q7.
- 2026-04-24 — Added ON-88 (expert-bypass onboarding for category-experienced evaluators). Output of Gate 3 for Monetization & PMF project. Distinct from ON-84 (skip-tutorials-entirely — ON-88 user still gets ~60s app-layout overlay) and ON-87 (seed-adaptive-skill-model — ON-88 is UI-orientation, not model-state). First-run path offers ON-82 full tour / ON-88 fast orientation / ON-84 skip at equal visual weight. See `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf.md` (Gate 2 §Stage B) + `docs/projects/monetization-and-pmf.project.md`.
