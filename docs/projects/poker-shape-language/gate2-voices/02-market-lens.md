# Market / External Lens — Gate 2 Voice: Adaptive Lesson Seeding

## Shipped patterns I'm drawing from

Duolingo uses a hybrid seed: an adaptive placement test (novice-default, difficulty ramps with correct answers, unlocks skills it believes you already know) plus in-lesson real-time difficulty adaptation where the tail of a lesson is replaced with harder exercises if you're running the table ([Duolingo Blog — adaptive lessons](https://blog.duolingo.com/keeping-you-at-the-frontier-of-learning-with-adaptive-lessons/), [Lumetest placement test](https://lumetest.com/blog/duolingo-english-test/the-duolingo-placement-test-what-to-know-about-it)). Anki/FSRS seeds nothing explicitly about content — it infers difficulty from review outcomes via a three-component memory model (stability, retrievability, difficulty) and abandons SM-2's ease-factor to avoid "ease hell" ([FSRS wiki](https://github.com/open-spaced-repetition/fsrs4anki/wiki/abc-of-fsrs), [Expertium benchmark](https://expertium.github.io/Benchmark.html)). Khan Academy uses Bayesian Knowledge Tracing (BKT) — a hidden-Markov latent-skill model with guess/slip/learn parameters ([BKT Wikipedia](https://en.wikipedia.org/wiki/Bayesian_Knowledge_Tracing), [Khan help](https://support.khanacademy.org/hc/en-us/articles/5548760867853--How-do-Khan-Academy-s-Mastery-levels-work)). Chess.com Lessons is mostly **manually curated paths** (New/Beginner/Intermediate/Advanced) with free library browse — the adaptive part is small and optional ([Chess.com help](https://support.chess.com/en/articles/8609703-how-do-lessons-work-on-chess-com)). GTO Wizard's Trainer is **user-curated** drills (you pick spots, tag them, sort by GTOW Score%) with three difficulty tiers (Standard/Grouped/Simple) — no auto-seeding; the system never infers your skill, it just records your score per drill ([GTO Wizard — Manage Drills](https://help.gtowizard.com/manage-training-drills/), [Five Levels of Trainer Mastery](https://blog.gtowizard.com/the-5-levels-of-trainer-mastery/)).

The spread matters: Duolingo is **behavior-inferred**, Anki/FSRS is **performance-inferred**, Khan is **latent-state-inferred**, Chess.com is **manual path**, GTO Wizard is **user-curated with score feedback**. For a 10-descriptor shape language, the owner has an N-of-1 audience — this rules out population-trained BKT priors; it points toward FSRS-style per-descriptor Bayesian updates or GTO-Wizard-style self-curation with score visibility.

## Stage A — Outside-in persona check

**Verdict:** ⚠️ YELLOW — core archetypes are well-represented, but two meaningful adaptive-learning archetypes are missing and one existing persona doesn't express the right attributes for adaptive seeding.

**Archetypes from the wild:**
- *Self-directed skill-builder* — Scholar's drill-heavy mode.
- *Prep-for-goal learner* — cramming for a specific session/tournament.
- *Habit-maintainer* — streak-driven, consistency over depth (Duolingo's median user).
- *Completionist* — needs to see all 10 descriptors touched; progress bar is the motivator.
- *Skeptical learner* — refuses personalization, wants to drive. Chess.com's "browse the library" user.
- *Returning-after-break* — skills decayed; needs re-seeding without starting over.
- *Curiosity-browser* — wants to wander across descriptors, not be funneled by the model.

**Mapping to existing personas:**
- **Self-directed skill-builder** → `Scholar` (core). Clean fit — drills-only, high complexity tolerance, no time pressure.
- **Prep-for-goal learner** → `Pre-Session Preparer` (situational, 2026-04-23). Strong fit — time-budget-aware, specific-context, anti-generic.
- **Habit-maintainer** → `Study Block` (situational) partially covers it ("streak + progress visibility without overdoing gamification"), but the phrase *without overdoing* flags that the existing model does not embrace streak mechanics. No persona owns the "I need the streak to show up" JTBD.
- **Completionist** → **GAP.** No persona treats "all 10 descriptors covered at bronze level" as the primary goal. Scholar gets closest but is framed around mastery depth, not breadth-coverage.
- **Skeptical learner** → **GAP.** No persona rejects personalization as the organizing frame. The closest is `Rounder` ("wants efficiency") but that's tolerance, not refusal. Every current persona assumes the adaptive system is *welcome*.
- **Returning-after-break** → **GAP.** No persona models skill decay or reseeding. This is where FSRS-style memory-model seeding matters most and where Chris himself is likely to live during livestream breaks, travel, or burnout stretches.
- **Curiosity-browser** → partial fit with Scholar's "rabbit-hole" note in `study-block.md`, but no explicit persona attribute.

**Gaps / recommended additions:**

1. **New core persona: `streak-habitualist`** (or extend Scholar with a `habit_orientation: streak | mastery` attribute). Separates the "I care about doing something every day" user from the "I care about depth" user. Critical because the seeding order that satisfies a habit-user (easy wins first, short sessions) is *opposite* to what satisfies a mastery-user (weakness-first, long sessions).

2. **New situational persona: `returning-after-break`**. Applies to Chris specifically after a travel stretch or burnout. The adaptive seeder must know whether to *reseed from scratch* (decay assumption) or *resume at prior state* (memory persistence assumption). FSRS handles this with forgetting curves; Anki SM-2 used relearning steps. Owner will hit this within 6 months of first shipping; designing for it later means a data-migration retrofit.

3. **New situational persona: `skeptical-of-personalization`**. Owner-operators of poker trackers are statistically a skeptical population — they built the tracker precisely because they don't trust black-box recommendations. Needs explicit attribute: `wants_to_see_why_this_descriptor_is_next` and `wants_manual_override`. Without this, the adaptive system reads as paternalistic and gets disabled within a week.

4. **Attribute extension to existing personas:** add `coverage_orientation: completionist | depth-first | breadth-first` across Scholar, Apprentice, and Chris. This disambiguates seeding goals without needing three new personas. A completionist Scholar seeds differently from a depth-first Scholar.

## Stage B — JTBD coverage

**Verdict:** ❌ RED — the JTBD atlas is thin on outcomes specific to adaptive-learning products. Four of the seven outcomes below have no matching JTBD.

**Outcomes users actually pursue in adaptive-learning products:**
- Mastery plateau ("I know this, stop testing me")
- Retention (not losing what I learned — the core FSRS promise)
- Edge-case comfort (robust recognition, not just median-case)
- Surprise / curiosity-driven exploration (wander outside the optimal path)
- Self-calibration ("am I actually as good as I think?" — Dunning-Kruger check)
- Streak / habit formation
- Credentialing / external proof (badge, score, shareable result)

**Mapping to existing JTBD atlas:**
- **Mastery plateau** → Partially `JTBD-DS-47` (skill map / mastery grid, Proposed). But the atlas entry is about *visibility* of mastery, not about the seeding behavior changing ("stop showing me things I've plateaued on"). Seeding side is missing.
- **Retention** → **GAP.** `JTBD-DS-46` (spaced repetition, Proposed) is the closest, but it's framed as a request for a feature, not as an outcome. No JTBD phrases the user goal as "I want to not lose what I learned three months ago."
- **Edge-case comfort** → **GAP.** No JTBD captures "I want to be ambushed by unusual cases so I know I'm robust, not just fluent on the median." This is FSRS's "hard retention" regime and GTO Wizard's purpose for custom spots.
- **Surprise / curiosity-driven exploration** → **GAP.** No JTBD legitimizes wandering. `JTBD-DS-43` (10-minute quick drill) assumes targeted-weakness efficiency; nothing covers "show me something I wouldn't have picked."
- **Self-calibration** → Partial overlap with `JTBD-SE-02` (exploit-deviation loop-close review), but SE-02 is about hand outcomes, not descriptor-level self-knowledge. The Dunning-Kruger check ("I thought I knew Spire, drills say I don't") is unowned.
- **Streak / habit formation** → **GAP.** `study-block.md` *constraints* mention it ("without overdoing"), but there's no JTBD like "I want a visible streak and break-forgiveness so I come back tomorrow." The owner's `Pre-Session Preparer` is event-driven, not habit-driven — these are different jobs.
- **Credentialing / external proof** → Not applicable to owner's N-of-1 context; safe to skip.

**Gaps / recommended additions:**

1. **New JTBD — DS-52: Retention maintenance.** "When I've learned a descriptor, I want the system to re-surface it before I forget, so mastery doesn't decay silently." Owns the FSRS-style scheduling side of seeding. Currently orphaned.

2. **New JTBD — DS-53: Edge-case probe.** "When I'm fluent on a descriptor's common cases, I want to be shown unusual cases specifically, so I learn to recognize it out-of-distribution." Distinct from DS-44 (reasoning); distinct from DS-47 (mastery grid). The seeder's job is to *detect fluency* and *switch modes*.

3. **New JTBD — DS-54: Exploration override.** "When the adaptive system wants to show me descriptor X, I want to choose descriptor Y instead without losing my progress state, so my autonomy is preserved." This is the skeptical-learner + curiosity-browser JTBD. Directly addresses the self-regulated-learning literature's concern about systems that "take over regulation from learners" ([Frontiers meta-analysis](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2025.1738751/full)).

4. **New JTBD — DS-55: Resumption after break.** "When I return after a break, I want the system to reassess where I am rather than resume as if no time passed, so my seeding reflects decay." Without this, the seeder will recommend advanced Saddle drills to a returning user whose Silhouette recognition has already decayed.

5. **New JTBD — DS-56: Calibration check.** "When I self-assess as fluent on a descriptor, I want a blind probe to confirm, so my internal confidence is calibrated against performance." Solves Dunning-Kruger specifically. Anki's "again"/"hard"/"good"/"easy" is a weak version of this; poker needs the stronger version because confidence miscalibration is itself a poker skill gap.

6. **JTBD-ON-87 (new): Cold-start descriptor seeding.** "When I first open the shape-language curriculum, I want the system to infer my starting level from a minimum number of inputs — existing hand history, a 5-question placement, or self-report — so I don't start at zero or get miscalibrated at advanced." Onboarding domain. Today `ON-82` (90-sec tour) and `ON-86` (sample data) are the closest; neither addresses the seeding-cold-start problem.

## Failure modes from the literature worth flagging

- **Streak anxiety / dark-pattern creep.** Duolingo's streak mechanic monetizes the anxiety it creates; users report their original goals take a back seat to streak preservation ([Decision Lab — Streak Creep](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification), [Cambridge Analytica on Duolingo](https://cambridgeanalytica.org/corporate-practices/how-duolingo-s-gamification-creates-behavioral-addiction-profiles-50432/)). For an owner-operator app, a streak is a tool, not a business lever — design it so break-forgiveness is free and silent, not monetized or guilt-notified.

- **Mastery illusion from over-personalization.** When the seeder only shows what the learner can succeed on, the learner develops false fluency and fails out-of-distribution. BKT literature calls this the "mastery-criterion problem" — setting the mastery threshold too loose produces the illusion, too tight produces grinding ([Mastery Learning Heuristics, PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7334722/)). Mitigation: periodic un-adaptive probes (DS-53, DS-56).

- **Filter-bubble analog — descriptor narrowing.** Adaptive seeders converge on descriptors the learner is improving fastest on, starving descriptors that need slower warm-up. The recommender-system literature directly parallels this: personalization competes with diversity, and both must be engineered in tension ([Jiang 2025, JASIST](https://asistdl.onlinelibrary.wiley.com/doi/10.1002/asi.24988?af=R), [Filter Bubbles in Recommender Systems, arXiv](https://arxiv.org/html/2307.01221)). For a 10-descriptor curriculum, a hard constraint like "no descriptor goes more than N sessions without a touch" prevents the narrowing pathology.

- **Self-regulation erosion.** Recent research finds that personalized-learning environments often *fail to support* self-regulated learning — the adaptive system takes over the regulation rather than scaffolding it, and autonomy drops ([Frontiers meta-analysis 2025](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2025.1738751/full), [Tracing SRL in digital learning, ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1747938X26000217)). For an owner who built his own tracker to stay in the driver's seat, this is the dominant risk. Mitigation: DS-54 (exploration override), make the seeder's reasoning visible, fade support over time.

- **Ease-hell / difficulty-lock-in.** SM-2's failure mode — a card that fails a few times gets permanently hard and reviews crowd — is a direct warning for any per-descriptor difficulty model. FSRS solved it by using a holistic memory model per card ([FSRS vs SM-2 guide](https://memoforge.app/blog/fsrs-vs-sm2-anki-algorithm-guide-2025/)). The shape-language seeder must avoid lock-in when Chris fails a Saddle drill three times in one bad session — the failures should update the memory model, not assign a permanent "Saddle is hard for me" label.

- **Cold-start miscalibration.** Duolingo's placement test defaults to novice and ramps up; this wastes time for experts. GTO Wizard avoids the problem by not auto-seeding at all. For an owner who is *already* an expert on most of the 10 descriptors (he co-authored the catalog), a novice-default seeder is the wrong shape — it needs either an explicit self-placement, or inferred-from-hand-history placement, or both (ON-87 above).

- **Manual-curation fatigue.** GTO Wizard's "build your own drills" works for pros but requires ongoing curation energy. Anki users abandon their decks when setup-cost exceeds daily-study-cost. If the shape-language seeder pushes setup onto the owner, adoption will stall; if it auto-seeds with no override, autonomy suffers. The balance point is *intelligent defaults with cheap override* — Chess.com's model, not GTO Wizard's or pure Duolingo's.

Sources:
- [Duolingo Blog — Adaptive lessons](https://blog.duolingo.com/keeping-you-at-the-frontier-of-learning-with-adaptive-lessons/)
- [Duolingo Blog — Partial credit on placement test](https://blog.duolingo.com/partial-credit-improvements-to-duolingos-placement-test/)
- [Lumetest — Duolingo placement test mechanics](https://lumetest.com/blog/duolingo-english-test/the-duolingo-placement-test-what-to-know-about-it)
- [FSRS4Anki wiki — ABC of FSRS](https://github.com/open-spaced-repetition/fsrs4anki/wiki/abc-of-fsrs)
- [Anki FAQs — algorithm overview](https://faqs.ankiweb.net/what-spaced-repetition-algorithm)
- [FSRS vs SM-2 complete guide](https://memoforge.app/blog/fsrs-vs-sm2-anki-algorithm-guide-2025/)
- [Expertium — SRS benchmark](https://expertium.github.io/Benchmark.html)
- [Chess.com — How Lessons work](https://support.chess.com/en/articles/8609703-how-do-lessons-work-on-chess-com)
- [Khan Academy — Mastery levels](https://support.khanacademy.org/hc/en-us/articles/5548760867853--How-do-Khan-Academy-s-Mastery-levels-work)
- [Bayesian Knowledge Tracing — Wikipedia](https://en.wikipedia.org/wiki/Bayesian_Knowledge_Tracing)
- [Mastery Learning Heuristics and Their Hidden Models — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7334722/)
- [Deep Knowledge Tracing — arXiv](https://arxiv.org/pdf/1506.05908)
- [GTO Wizard — Manage Training Drills](https://help.gtowizard.com/manage-training-drills/)
- [GTO Wizard — Five Levels of Trainer Mastery](https://blog.gtowizard.com/the-5-levels-of-trainer-mastery/)
- [GTO Wizard — Study Mode](https://help.gtowizard.com/study-mode/)
- [Frontiers — AI and learner autonomy meta-analysis 2025](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2025.1738751/full)
- [ScienceDirect — Tracing SRL in K-12 digital learning 1990-2024](https://www.sciencedirect.com/science/article/abs/pii/S1747938X26000217)
- [Filter Bubbles in Recommender Systems — arXiv systematic review](https://arxiv.org/html/2307.01221)
- [Jiang 2025 — Restraining filter bubbles via algorithmic affordances, JASIST](https://asistdl.onlinelibrary.wiley.com/doi/10.1002/asi.24988?af=R)
- [Decision Lab — Streak Creep](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification)
- [Cambridge Analytica — Duolingo gamification addiction](https://cambridgeanalytica.org/corporate-practices/how-duolingo-s-gamification-creates-behavioral-addiction-profiles-50432/)
- [When Gamification Spoils Your Learning — arXiv](https://arxiv.org/pdf/2203.16175)
