# Gate 3 Decision Memo — Shape Language Adaptive Lesson Seeding

**Authored:** 2026-04-24
**Inputs:** Gate 1 inline output; Gate 2 blind-spot audit (RED); Gate 3 triage; autonomy-skeptic voice; POKER_THEORY.md; existing villain-modeling stack (`src/utils/assumptionEngine/`, `src/utils/rangeEngine/`); internal project survey (LSW, exploit-deviation, HRP).
**Purpose:** Resolve 7 owner-facing design questions with clear verdicts where they exist, honest "underdetermined" calls where they don't, and a shared skill-assessment architectural proposal that carries the "core competency" framing into code.

---

## Q1 — Unified Study Home: cross-project surface vs umbrella project?

**Question:** Shape Language lessons + Range Lab + Presession Drills + HRP mistake-flags all want a single "get better at poker" study home. Do we ship it as a cross-project surface artifact that each project plugs into, or as a formal umbrella project that coordinates?

**Options on the table:**
- A — `surfaces/study-home.md` cross-project surface; each project writes its own embed and a tiny adapter; no parent charter.
- B — `docs/projects/study-mode.project.md` umbrella charter + per-sub-project coordination docs + shared acceptance criteria.

**Prior art / research:**
- Internal: the existing project set does NOT coordinate via umbrella charters. `line-study-slice-widening.project.md` followed `line-study.project.md` as a successor charter, not an umbrella (`docs/projects/line-study-slice-widening.project.md:57` references the closed parent but does not inherit governance).
- Internal: `docs/projects/exploit-deviation.project.md:31-37` explicitly names two-surface consumption (Presession Drill + Live Exploit Sidebar) without an umbrella; the project just declares both surfaces as acceptance criteria in its own charter.
- Internal: the Design Program's own mechanism is surface artifacts (`docs/design/surfaces/`), not umbrella projects — `CLAUDE.md` §"Design Program Guardrail" names the surface artifact as the gatekeeping deliverable for Gate 4.
- Internal: `docs/projects/poker-shape-language.project.md:33-36` already declares "Relationship to other projects" informally (builds-on / adjacent / downstream-of).

**Analysis:**

Option B (umbrella project) is the shape people instinctively reach for when a concept spans multiple existing projects, but it is the wrong shape for this codebase. The project file convention here is a per-scope charter with its own phases and acceptance criteria; there is no precedent in `docs/projects/` for a parent that coordinates siblings, and the parent would inherit an ugly governance problem — whose acceptance criteria close the parent? HRP has its own project charter, Range Lab has its own, Presession Drills ships under Exploit Deviation. A parent that "coordinates" four active sub-charters is either trivially empty (a README) or load-bearing to the point of blocking each sub-project on the parent's gates. The latter is what design programs invented surface artifacts to prevent.

Option A maps onto the existing mechanism. Design Program Guardrail says: "a surface artifact in `docs/design/surfaces/` must exist… for any UX change." The study home IS a UX change that spans multiple projects — a single surface that four projects embed into. The correct artifact is `docs/design/surfaces/study-home.md`, authored once, referenced by each project's Gate 4 spec. Each project's embed then becomes a small spec that defers layout and IA to the parent surface. This is the "contract" pattern: the surface defines slots, embeds fill them.

Against the core-competency framing: skill-assessment is structurally cross-cutting, but the *study home surface* isn't the right place to enforce that cross-cut — the enforcement should live in code (the shared `skillAssessment/` module proposed below), not in a project governance layer. Governance cross-cutting belongs in `.claude/programs/` (the program file lists its invariants; each project commits to them). Surface-level coordination belongs in the surface artifact.

Against the red lines: the surface artifact approach preserves red line #6 (flat lesson index always accessible) as a property of the surface itself, not as something each embed reimplements. A user opening the study home sees every descriptor lesson, every Range Lab module, every HRP mistake-flag category flat — the surface enforces the flatness.

**Verdict:** CLEAR WINNER — Option A (cross-project surface artifact).

**Confidence:** High — matches existing Design Program mechanism, avoids governance invention, and maps cleanly onto precedent from `exploit-deviation`'s two-surface consumption pattern.

**Gate 4 implications:**
- Author `docs/design/surfaces/study-home.md` before `shape-language-study-home.md`. The Shape Language surface becomes an embed into the parent study home.
- Each of Range Lab / Presession Drill / HRP gets a small-scope "embed spec" referencing the study-home surface, not duplicating its layout.
- Add a backlog item: `STUDY-HOME-SURFACE` owned by no project in particular — authorship happens in the first Gate 4 that needs it (likely Shape Language's, since it's the one actively in Gate 3).

---

## Q2 — Opt-in enrollment: per-descriptor or per-feature?

**Question:** Does enabling Shape Language adaptive layer require one master toggle, ten per-descriptor toggles, or a hybrid?

**Options on the table:**
- A — Master toggle only: "Enable Shape Language adaptive layer" (one flag, all 10 descriptors participate).
- B — Per-descriptor toggles: 10 individual flags (granular, maximally autonomous).
- C — Hybrid: master toggle flips enrollment on, per-descriptor mute via "don't show me again this descriptor" action (opt-in coarse, opt-out granular).

**Prior art / research:**
- Duolingo course selection is per-language (one course = one enrollment), with skill-level placement inside it via the adaptive algorithm ([Duolingo Placement Test, Fandom](https://duolingo.fandom.com/wiki/Placement_test)). No per-skill opt-out inside a course.
- Khan Academy mastery challenges are per-course, with per-skill mastery progression but no per-skill opt-out; users have raised this as a friction point ("including already mastered skills in mastery challenges can be demotivating" — [Khan support community](https://support.khanacademy.org/hc/en-us/community/posts/360039462811)).
- Anki is the only widely-used reference for genuinely per-unit opt-in/out: deck-level enable/disable + card-level suspend. The pattern works there because users build decks manually; it's explicit curation.
- Brilliant and GTO Wizard both use topic-level enrollment with no per-skill opt-out mechanism documented.

**Analysis:**

Option B (per-descriptor) is seductive on autonomy grounds — it maximizes the surface area of explicit consent, which is what Gate 2's red line #1 demands. But it creates three problems that aren't hypothetical. First, the onboarding friction: ten toggles presented up front is exactly the kind of cognitive load that makes expert users close the tab (Duolingo's placement-test work explicitly optimizes *against* this). Second, the cold-start math: the senior engineer's cold-start spec (project charter, Decisions Log 2026-04-23) hydrates all 10 descriptors at `alpha=1,beta=1` — a per-descriptor toggle then creates a three-state model (enrolled / explicitly-disabled / never-touched) where the middle state has to suppress recommendations but preserve skill data, which is more reducer logic than justified by any observed user need. Third, Duolingo/Khan/Brilliant all ship without per-skill opt-in and users don't complain — the JTBD is "get started studying a language," not "decide for each phoneme whether I want to be assessed."

Option A (master only) fails Gate 2 red line #3 (durable overrides). If the user says "I already know Silhouette" and the only way to express that is to disable the whole system, that's not a durable override — that's a nuclear option. This option maps onto exactly the dark-pattern Duolingo/SDT literature flags: treating dissent as a binary engage/disengage choice rather than a legitimate signal within engaged state.

Option C (master + per-descriptor mute via "don't show me again") matches how every successful adaptive-learning tool handles the tension. The master toggle is where enrollment-as-consent lives (red line #1). The per-descriptor mute ("I already know this" on a lesson card, plus a recalibrate-descriptor affordance in the transparency screen) is where durable override lives (red line #3). The one-time-disambiguation pattern the autonomy voice cites — "already know" vs "not today" at skip time — fits naturally inside this hybrid because the disambiguation happens at the skip, and the "already know" answer is what flips the per-descriptor mute.

Mapping against three-intent taxonomy: Reference-mode consumption doesn't require enrollment at all (no skill inference in Reference — it's look-up). Deliberate-mode needs one enrollment gate (the master toggle). Discover-mode is the surface where per-descriptor mute matters — it's where the seeder is making choices, so it's where choice-refinement affordances live. All three intents fit the hybrid cleanly.

Against the shared-skill-assessment framing: villain modeling has a clean analogue — the app doesn't ask the user to opt-in per-predicate to villain-assumption inference, but it does let users dismiss individual assumptions via the dial affordance (`src/utils/assumptionEngine/CLAUDE.md` §"Dial curve"). Hybrid C mirrors the dial pattern — coarse enrollment, fine-grained per-item adjustment.

**Verdict:** CLEAR WINNER — Option C (master toggle + per-descriptor mute via "already know / not today" disambiguation at skip time, plus recalibrate-descriptor in transparency screen).

**Confidence:** High — only option that honors both red line #1 and red line #3 without onboarding-friction or nuclear-option failure modes.

**Gate 4 implications:**
- Enrollment journey spec (`journeys/shape-language-enrollment.md`): single master toggle + consent copy. Not ten toggles.
- Skip-time disambiguation: one-time tap resolving "already know" vs "not today." Persist "already know" as a per-descriptor mute flag with `mutedAt` timestamp and revocable via transparency screen.
- Transparency screen must expose a "recalibrate this descriptor" action (undoes both user mute and algorithmic mastery) per red line #3.
- Schema: `shapeMastery` record grows a `userMuteState: 'none' | 'already-known' | 'not-interested'` field. Additive, does not break v18 migration.

---

## Q3 — Retention re-surfacing: how aggressive?

**Question:** Once a descriptor is mastered, how aggressively does the system re-test to prevent decay?

**Options on the table:**
- A — Aggressive (FSRS/Anki-style spacing, decaying intervals, auto-surfacing).
- B — Gentle (monthly prompt, opt-in each time).
- C — None (mastery permanent until manual reset).

**Prior art / research:**
- FSRS supports a tunable "desired retention" between 70% and 97%, with 90% as the default balance point and the maintainers explicitly recommending users tune for *their own* workload-to-knowledge ratio ([FSRS Optimal Retention Wiki](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-optimal-retention), [RemNote FSRS article](https://help.remnote.com/en/articles/9124137-the-fsrs-spaced-repetition-algorithm)).
- Procedural memory (pattern recognition — which is what Shape Language descriptor identification is) is **more resistant to forgetting** than declarative memory ([PubMed: declarative vs procedural retention](https://pmc.ncbi.nlm.nih.gov/articles/PMC7161705/), [Matbury on declarative vs procedural](https://matbury.com/wordpress/index.php/2025/07/02/declarative-vs-procedural-memory-in-language-learning-what-every-learner-teacher-should-know/)). Once a user can recognize a Silhouette prototype, the skill decays slowly — closer to bike-riding than vocabulary.
- Duolingo's daily-streak mechanics are widely criticized as aversive-emotion-on-disengagement ([Deceptive Patterns — Duolingo](https://www.deceptive.design/brands/duolingo)), and Gate 2 red line #5 explicitly forbids streaks/notifications/engagement-pressure.
- Anki's own literature acknowledges aggressive spacing causes abandonment when stakes are low and the user has no external deadline — Anki works for medical students preparing for boards, less well for casual learners.

**Analysis:**

The procedural-vs-declarative finding is the pivotal fact. Language vocabulary is declarative — a fact about symbol-meaning mapping that decays. Shape Language descriptor recognition is procedural — a pattern-matching skill learned through repeated exposure to canonical instances. Shape recognition, like chess-position pattern recognition, is closer to bike-riding than Spanish vocabulary in its decay profile. Aggressive FSRS-style scheduling was *designed* for declarative vocabulary retention at 90% accuracy; applying it to poker pattern recognition over-corrects for a decay curve that doesn't match.

Option A (aggressive) also collides head-on with red line #5. FSRS without notifications is just an unread queue; FSRS with notifications is Duolingo's mascot. The autonomy voice was specific: "No streaks. No notifications about missed days." Any retention schedule that surfaces "you haven't practiced Silhouette in 14 days" as a push or even as a persistent in-app badge is importing the exact UX pattern the owner ruled out. This isn't fixable by turning aggressiveness down — the mechanism itself wants to nag.

Option C (none, manual-only) under-reacts to a real phenomenon. Recognition latency does drift after months away (FSRS literature documents this, as does the BKT decay model); ignoring it entirely means a user who returns after a 4-month gap sees "Mastered" on a descriptor they can no longer reliably identify under time pressure. That's the mastery-illusion failure mode the Gate 2 audit flagged as DS-53 (edge-case probe) and DS-55 (resumption).

Option B (gentle) — a monthly or decay-triggered check-in prompt, opt-in each time, never a push notification — threads both needles. It surfaces the retention signal without importing streak mechanics, and it respects the procedural-memory finding by using a longer baseline interval than FSRS defaults would produce (monthly, not "in 3 days per FSRS-90"). The surfacing is **passive**: the transparency screen shows "Silhouette: last validated 6 weeks ago — recalibrate?" as an in-app affordance, not a notification. Returning-after-break personas (authored in Gate 3) get a "welcome back — here's what decayed" surface at next-session start, but only after the decay threshold crosses and only once.

Aligning with three-intent taxonomy: retention belongs to Deliberate mode (the user explicitly chose to study) — not Reference (which is look-up) and not Discover (which is exploratory). The monthly check-in surfaces only when Deliberate mode is opened, and the user can decline. Reference-mode use does not trigger retention prompts.

Cross-link to shared skill-assessment: villain modeling has an analogous concept — assumption staleness. `src/utils/assumptionEngine/CLAUDE.md` §"Conservative-ceiling rule" + architecture's rolling Tier-2 calibration gap drive predicate retirement when gap widens. The parallel for user skill is: on-read decay (Gate 2 senior engineer: "Decay is computed on read, not written, to avoid a timer-driven write storm"), with in-app surfacing gated by a threshold and always dismissable.

**Verdict:** CLEAR WINNER — Option B (gentle / passive monthly check-in; no notifications; decay computed on read; returning-after-break gets a one-time welcome-back surface).

**Confidence:** High — procedural-memory evidence directly disqualifies aggressive FSRS spacing; red line #5 disqualifies any notification mechanism; Option C leaves the mastery-illusion failure mode unaddressed.

**Gate 4 implications:**
- Lesson-runner spec: in-study-mode surface shows "last validated N days/weeks ago" per descriptor; no out-of-study notification.
- Welcome-back surface fires **once** on session open after ≥28 days gap, dismissable, offers "recalibrate" (one drill) or "resume" (skip validation).
- Schema: `shapeMastery.lastValidatedAt` distinct from `lastInteractedAt`. Decay is `f(now - lastValidatedAt)`, computed on read.
- Forbidden: any code path that writes "decay occurred" to state. Decay is a read-time function, full stop.

---

## Q4 — Self-assessment vs behavioral signal: when they disagree, which wins?

**Question:** User declares "I know Silhouette cold"; drill data says 4/8 recent identifications wrong. Which signal governs the recommendation?

**Options on the table:**
- A — User always wins (declaration fully overrides data; model hides the drill-data-based estimate).
- B — Data always wins (declaration is ignored; model trusts behavior).
- C — User wins silently, but data is shown transparently (declaration governs recommendation; transparency screen shows the disagreement without acting on it).
- D — Data wins with explicit acknowledge-and-re-override (behavioral model overrides, but user can see the conflict and re-declare with a one-tap "trust me anyway" persistent override).

**Prior art / research:**
- Self-Determination Theory (Ryan & Deci) — controlled motivation undermines autonomous engagement; autonomy-support is the single biggest lever for sustained learning ([Ryan & Deci SDT meta-analysis, 2023](https://selfdeterminationtheory.org/wp-content/uploads/2023/01/2023_RyanDuineveldDiDomenicoEtAl_Meta-1.pdf)).
- Divergence literature: self-assessment accuracy improves when learners have objective feedback, but accuracy is notably miscalibrated on novel tasks — participants' confidence predicted accuracy only when they chose to answer (72% vs 7% when they declined) ([PMC: Divergence between self-assessment and self-monitoring](https://pmc.ncbi.nlm.nih.gov/articles/PMC3139875/)).
- Dunning-Kruger in poker is documented and severe ([PokerListings DK article](https://www.pokerlistings.com/poker-and-the-dunning-kruger-effect-you-re-not-as-good-as-you-think-53930), [Princeton rational DK model](https://cocosci.princeton.edu/papers/rachelCogsci.pdf)). Poker-specific variance amplifies miscalibration because outcome feedback is noisy.
- Medical decision-aid research converges on a specific pattern: clinician retains override authority, but system documents both recommendation and override with rationale; "raising the bar when transparency is low" reduces over-reliance while preserving clinical judgment ([Frontiers: Physician's autonomy with AI support](https://www.frontiersin.org/journals/medicine/articles/10.3389/fmed.2024.1324963/full), [PMC: Trust calibration framework](https://pmc.ncbi.nlm.nih.gov/articles/PMC12428550/)).

**Analysis:**

This is the hardest question on the list, and I want to say so plainly: the four options encode a real trade-off between autonomy (red line #3 — durable overrides) and Dunning-Kruger defense (Gate 2 JTBD DS-53 — edge-case probe / mastery-illusion guard). Neither concern dominates; every option pays for one with the other.

Option A (user always wins, silent) is the maximally autonomy-respecting answer and it's the answer most consistent with treating the owner as a sophisticated adult. It fails one specific case that the Gate 2 audit named explicitly: mastery illusion under Dunning-Kruger. The poker-DK literature is unusually damning here because variance makes feedback unreliable — a user who has been losing to bad luck interprets drill-wrong-but-read-the-line-correctly as "I know this, bad cards happened," which is sometimes right and sometimes the mastery illusion. A design that never surfaces the disagreement trusts the owner's read fully. That's defensible but it leaves money on the table in the specific case where the owner is wrong.

Option B (data always wins) imports the exact dark-pattern Duolingo is notorious for — "he's avoiding this because he's weak at it" (cited verbatim in Gate 2 audit, autonomy voice). It violates red line #3. Disqualified.

Option D (data wins with re-override) looks autonomy-respecting because it has the override, but the information architecture is wrong: the default is *the system overrides the user, and then the user overrides the system.* That framing puts the user in the position of arguing with the algorithm every time they want to be taken at their word. SDT meta-analysis is clear that this flavor of interaction — structured as ongoing negotiation with an algorithmic judge — erodes autonomous motivation even when the override is free. Medical-decision-aid research has the same finding under a different name: automation bias reduces physicians' clinical confidence when the AI's override is the default.

Option C (user wins silently, data transparent) is the medical-decision-aid consensus pattern applied here. Declaration governs the recommendation immediately and durably. Transparency screen shows the disagreement factually: "You marked Silhouette as known. Drill data in last 30 days: 4/8 correct. You can recalibrate here." The user's declaration is a first-class signal; the drill data is a first-class signal; the model holds both and exposes both; the *recommendation* follows the declaration. No nagging, no override-of-override, but also no hiding the disagreement from an owner who the whole app is premised on treating as someone who wants more information, not less.

On shared skill-assessment: the villain-modeling analogue is exact. The Assumption Engine treats observed-frequency data and style-classification priors as distinct signals with explicit separation (`assumptionEngine/CLAUDE.md` §"DO NOT apply population priors when style is classified" — "applying both stacks the same behavioral information twice"). Declaration ≈ prior; drill data ≈ posterior update. The architectural move — don't average them, don't let one silence the other, hold both and show both — is already the house pattern.

Against the three-intent taxonomy: Discover-mode is where the disagreement surfaces most (the mode that actively makes choices about what to show). Reference and Deliberate modes both respect declaration as-given. This is consistent with Option C.

**Verdict:** LEAN Option C (user wins silently, data shown transparently).

**Confidence:** Medium — the medical-decision-aid convergence is real but the poker-DK case is genuine counter-evidence. Option C is the best answer *within the autonomy red lines the owner set*; if those red lines were softer, Option D would be competitive. The lean comes with a design obligation: transparency screen must make the disagreement legibly visible, because silent-wins-for-user is only defensible if the user can see what they're silencing.

**Gate 4 implications:**
- Transparency screen spec must show both signals in parallel, not a fused estimate. "You: known. Data: 4/8 correct." Not "50% confidence."
- Recommendation engine: declaration overrides data for ordering, does not erase data from storage. Data remains visible on demand.
- Override disambiguation at skip-time (already in Q2) feeds the user-declaration signal directly.
- Forbidden: any composite metric that fuses declaration + data into a single score used to drive recommendations. The villain-modeling I-AE-7 rule ("posterior and resistance score are never combined") applies here.

---

## Q5 — Incognito drill mode default: on or off?

**Question:** Incognito = practice without writing to skill model. Red line #4 made it non-negotiable as an *option*; what's the default?

**Options on the table:**
- A — Default off (drills are graded unless user toggles incognito).
- B — Default on (drills are ungraded unless user toggles grading).
- C — Context-dependent: Reference-mode never grades, Deliberate and Discover do (graded is the default for the modes where it makes sense).

**Prior art / research:**
- Chess.com operates this exact distinction structurally: "rated puzzles" change rating, "custom puzzles" don't — and users pick one or the other by entering a different surface, not by toggling inside a shared one ([Chess.com puzzle help](https://support.chess.com/article/286-how-do-puzzles-work), [Chess.com rated vs custom forum](https://www.chess.com/forum/view/more-puzzles/rated-puzzles-vs-custom-puzzles)).
- Anki has a "preview mode" that doesn't affect scheduling, reached from the card browser — it's surfaced as a separate code path, not a toggle on the normal review.
- Gate 2 red line #4 (autonomy voice): incognito mode is non-negotiable. Three-intent taxonomy (charter decisions log): Reference is inherently un-graded (it's look-up, not assessment).

**Analysis:**

Options A and B are the wrong frame. Both assume a single surface (the drill) with a modal flag (incognito on/off). That's the frame Anki's preview-mode sits inside, and even Anki sidesteps it by routing preview through a different entry point. The owner's three-intent taxonomy has already done the disambiguation work: Reference / Deliberate / Discover are distinct intents with distinct state-writing expectations, and the toggle-default question only applies to intents where grading is *meaningful at all.*

Option C treats the three intents as first-class. Reference is a read path — no writes to skill model ever, not just by default. Deliberate is the user's declaration of "I'm here to study and I'm enrolled" — grading is the expected behavior, and incognito is an explicit toggle on that surface for "I want to practice this drill without it counting." Discover is the adaptive-seeder's home — grading is what makes it adaptive, and incognito is again an explicit toggle. This maps 1:1 onto Chess.com's rated-vs-custom split: Chess.com didn't make "rated" a toggle inside custom, they made the entry point be the distinction.

A and B both violate a subtler red line: the default state determines what happens when a user interacts without deliberation. Default-off (A) means enrolled drill interactions produce inferences immediately after opt-in — consistent with explicit enrollment, arguably the right behavior for a user who just said "I want to study." Default-on (B) means the user explicitly opts into enrollment and then has to re-opt-in to grading, which is over-ceremonious and defeats the point of the enrollment gesture.

Option C collapses the whole question: the default is determined by the mode, not by a toggle. Inside Deliberate or Discover, incognito is available as a one-tap affordance — "this session doesn't count" — and exiting the mode exits incognito. The red-line-#4 requirement is satisfied structurally, not through a default.

On shared skill-assessment: villain modeling has an exact analogue — the "game-tree baseline evaluator" vs "assumption-mutation" distinction (`assumptionEngine/CLAUDE.md`: "A CitedDecision requires a valid depth-3 baseline from gameTreeEvaluator"). The baseline is always computed; whether the assumption layer fires is mode-gated. Reference-mode shape lookup ≈ baseline. Deliberate/Discover-mode drilling ≈ assumption-mutation layer, which writes state. Same pattern.

**Verdict:** CLEAR WINNER — Option C (context-dependent; mode determines default; incognito is an in-mode toggle for Deliberate/Discover).

**Confidence:** High — the three-intent taxonomy was adopted precisely to avoid modal-toggle ambiguity, and Chess.com provides external validation that distinct surfaces/entry-points is the shipping pattern.

**Gate 4 implications:**
- Lesson-runner spec defines mode as routing state: entering Reference routes to a read-only surface; entering Deliberate/Discover routes to the graded surface with an incognito affordance.
- Incognito affordance in-mode: single tap on drill header, persisted per-session, shown in the transparency screen as "last session was incognito (no model update)."
- No global "default: incognito on/off" setting. The setting question is answered by intent.
- Reference-mode writes zero skill state. Enforce at the reducer level — Reference-mode actions do not dispatch mastery mutations.

---

## Q6 — Skill-model portability: included in export/backup?

**Question:** When the user exports / backs up app data, is skill-model data included?

**Options on the table:**
- A — Always included (part of standard export).
- B — Never included (local-only, distinct from app data).
- C — Opt-in checkbox (user selects during export whether to include).
- D — Separate export for study data (one-click study-data-only export).

**Prior art / research:**
- GDPR Article 20 distinguishes user-provided data (always portable) from inferred data (not required to be portable) ([GDPR Art. 20](https://gdpr-info.eu/art-20-gdpr/), [GDPR for ML — GDPR Local](https://gdprlocal.com/gdpr-machine-learning/)). Skill-model posteriors are inferred; user declarations are provided.
- xAPI learning analytics exports treat xAPI statements (observations) as portable by default, with learner analytics dashboards rebuilt from the statement store ([Watershed xAPI GDPR](https://www.watershedlrs.com/blog/product/news/what-is-gdpr/)).
- Internal: `src/utils/persistence/` — the existing persistence layer has domain-specific storage modules (assumptionStorage, handsStorage, playersStorage, etc.) with a shared `createPersistenceLogger` pattern (`index.js:24-30`). Gate 2 senior engineer noted the export path needs audit — existing export doesn't cover villainAssumptions or rangeProfiles yet (audit §"Export / backup" in `2026-04-23-blindspot-shape-language-adaptive-seeding.md:154`).
- Internal: `.claude/context/SYSTEM_MODEL.md` doesn't currently list a canonical export/import writer for all stores — it's fragmented.

**Analysis:**

GDPR framing is instructive but not binding here (app is local-only, not a hosted service with a controller relationship). What it buys us is a principle: user-provided data and inferred data have different portability profiles. Declarations (the "I already know Silhouette" flag, the enrollment toggle, the explicit mutes) are provided; the Bayesian alpha/beta posteriors and the recommendation state are inferred.

Option A (always included) makes backup-and-restore trivial and correct for the common case (user is migrating devices, rebuilding after a crash). It imports one risk the autonomy voice cares about: an export file containing "the system's opinion about my skill" is a data object the user may not want attached to their data file, especially if they share the export for troubleshooting. The red-line-#4 three-way reversibility (per-descriptor reset / global model reset / incognito) already addresses user-initiated wiping, but export-attachment is a separate case.

Option B (never included) solves the attachment concern and fails the common case. Backup-and-restore loses the skill model, making enrollment a one-device affair. For a user whose study pattern spans a phone and a tablet, this is a regression. Red line #4 is about reversibility, not isolation — "I can wipe it" is not the same claim as "it never leaves this device."

Option C (opt-in checkbox at export) is the export-friction answer that matches the per-descriptor-toggle answer in Q2: it asks the user to make a decision every time. For a backup operation the user does rarely and often under stress (migrating devices, pre-upgrade), extra decisions are anti-value.

Option D (separate export for study data) is interesting because it matches the data model. If `shapeMastery` and `shapeLessons` are additive stores (per senior engineer's v17 → v18 spec), and if villainAssumptions and rangeProfiles are similarly store-scoped, then per-store or per-domain export is structurally natural — the export writer iterates over stores, and a "study data" bundle is a subset of stores. This is the xAPI-adjacent pattern.

The decision principle I'd apply: skill-model data **is user data** (including inferred posteriors — they're derived from the user's own actions and constitute a behavioral record), and the default should be inclusion. Separate study-data export (Option D) is a useful additional affordance but not a replacement for default inclusion. The hybrid that best serves the owner: Option A as default + Option D as an additional export option for users who want to share (or discard) just the study portion.

On shared skill-assessment: the export writer should be polymorphic over skill-assessment records regardless of subject. Villain skill records and user skill records should serialize through the same path, with a `subject` discriminator — this pays dividends when the user moves between devices and the app rebuilds both the user's posture and the villain population prior cache from the same backup file.

**Verdict:** CLEAR WINNER — Option A (always included in standard export), with Option D as a complementary "study data only" export button for the edge case.

**Confidence:** High — backup-and-restore is the common case, autonomy red line #4 already covers user-initiated wipe, and the store-scoped architecture makes both A and D cheap to implement together.

**Gate 4 implications:**
- Export writer audit already flagged by senior engineer (Gate 2 audit §"Export / backup"). That audit should land additive inclusion of `shapeMastery`, `shapeLessons`, `villainAssumptions`, `rangeProfiles`, and the existing stores in one pass.
- Add a secondary "Export study data only" button in the settings surface — writes a subset bundle, useful for sharing troubleshooting context without attaching hand histories.
- Schema versioning: each store's records carry `schemaVersion`, per I-AE-5 convention. Import validates and migrates per-record (already established pattern).

---

## Q7 — Cold-start: expert bypass?

**Question:** Owner co-authored the descriptors. On first Discover-mode entry, system knows nothing. How does it handle expertise?

**Options on the table:**
- A — Uniform novice start (everyone begins at `alpha=1,beta=1`, system learns).
- B — Self-declaration seed (one-time "mark as already known" pass before first drill).
- C — Structured placement quiz (Duolingo-style adaptive test).
- D — Skip-to-any-lesson (flat index; no seeding, model inherits from drill data onward).

**Prior art / research:**
- Duolingo placement test is the mainstream pattern; adaptive, ~10 minutes, raises difficulty on correct answers ([Duolingo placement test](https://duolingo.fandom.com/wiki/Placement_test), [Partial credit improvements to placement test — Duolingo blog](https://blog.duolingo.com/partial-credit-improvements-to-duolingos-placement-test/)).
- Cold-start recommender literature: asking users for initial preferences is the standard strategy, with a threshold on registration friction — "a threshold has to be found between the length of the user registration process and the amount of initial data required for the recommender to work properly" ([Things Solver cold-start](https://thingsolver.com/blog/the-cold-start-problem/), [Cold & Warm Net paper](https://arxiv.org/abs/2309.15646)).
- Khan Academy starts users at zero mastery with no placement test by default; test-out is available per-skill but opt-in ([Khan mastery system](https://support.khanacademy.org/hc/en-us/sections/200665650-The-Mastery-System)).
- GTO Wizard and Chess.com Lessons both allow direct entry to any module (skip-to-any-lesson pattern). Chess.com in particular treats lesson access as unrelated to skill rating — you can open the grandmaster lesson at 600 rating.
- Internal: project charter Decisions Log (2026-04-23) already committed: "Cold-start hydrates all descriptors at alpha=1,beta=1; first rec is Silhouette unconditionally." That's Option A + a hardcoded first-rec.

**Analysis:**

The charter already decided this at the architectural level. The question is whether to layer a user-facing seed on top — Option B or C — or to leave the architectural answer exposed as the UX (Option A, which is what the charter implies).

Option C (placement quiz) is disqualified by two separate voices. Autonomy skeptic explicitly named it as the nightmare case ("the skeptic's nightmare is a 10-question placement test on day one"). Market lens on Duolingo placement-test dropout is oblique but suggestive — Duolingo improves placement tests constantly because users abandon during them. For an expert owner who co-authored the descriptors, a placement quiz is patronizing. For a future scholar-persona user, it's friction. The ROI for the system (better initial posterior) is real but the UX cost is high on both ends.

Option D (skip-to-any-lesson) is not really a cold-start answer — it's a description of what red line #6 (flat lesson index always accessible) already requires. It's necessary but not sufficient. The user can open any lesson; the question is what the *adaptive seeder* does when the user first enters Discover-mode without having picked a lesson. Option D says "nothing — there's no Discover-mode seed, only lessons the user picks." That's a viable answer if Discover mode is deprioritized to the point that there is no seeded first experience, but it concedes the adaptive-seeding feature.

Option A (uniform novice start) is the charter-adopted answer and it's defensible. Hydrate at `alpha=1,beta=1`; first Discover-mode rec is Silhouette unconditionally (top-ranked by the roundtable, broadest surface coverage, shallowest curve); after 3 interactions switch to adaptive. This is fine for a new user. It's annoying for the owner specifically, because he's the expert case the system cannot currently distinguish.

Option B (one-time self-declaration seed) is the pattern that fills the gap. At first Discover-mode entry, show a one-screen affordance: "Mark any descriptors you already know well" as a checkbox list of the ten descriptors, with "skip this" as the prominent default. The user can check none, all, or any subset. Checked descriptors get an initial posterior shift (say, `alpha=8,beta=2` — equivalent to 10 observed interactions with 80% success) and a mute flag that suppresses them from the first Discover-mode rec until a recalibrate or drift fires. Unchecked get the charter default (`alpha=1,beta=1`). The affordance is skippable in one tap. Expert users seed their model in 30 seconds; novice users skip and get the charter behavior.

This is exactly the pattern the cold-start recommender literature calls for: minimize registration friction while allowing the user to volunteer knowledge. It's also Option B + Option A fused — B adds a skippable onramp; A handles the default.

The red-line alignment: skippable + flat lesson index preserved (red line #6) + declaration-as-signal, not as quiz (red lines #1 and #3). Option B *combined with* the charter's "adaptive after 3 interactions" rule means the declaration is never binding — it's a seed, not a lock.

On shared skill-assessment: villain modeling has the exact analogue — style-conditioned priors (Fish/Nit/LAG/TAG) override population priors once classification is confident (`assumptionEngine/CLAUDE.md` §"DO NOT apply population priors when style is classified"). The user-declaration seed is the user-side equivalent of a style prior: a domain-expert categorization that the system respects as an initial signal and updates against as observations accrue.

**Verdict:** CLEAR WINNER — Option B (one-time self-declaration seed, skippable, prominent-default skip) layered on Option A (charter hydration) — NOT a placement quiz.

**Confidence:** High — the expert-bypass JTBD is real (the owner flagged it, Market lens flagged it, cold-start literature endorses it); the placement-quiz alternative is disqualified by two independent voices; self-declaration is one-screen and skippable.

**Gate 4 implications:**
- Enrollment journey spec: after master-toggle opt-in, present one screen titled "Know any of these already? (optional)" with the 10 descriptors and a dominant "Skip" button. Copy must make skipping frictionless and un-shameful.
- Declared descriptors get initial posterior `alpha=8,beta=2` + `userMuteState='already-known'`. Flip to `alpha=1,beta=1` if the user recalibrates.
- Even for declared descriptors, the lesson is accessible from the flat index immediately — the seed affects *ordering in Discover-mode*, not *access* (red line #6).
- First Discover-mode rec post-seed: if any descriptor was declared, skip those; otherwise Silhouette per charter.

---

## Summary table

| # | Question | Verdict | Confidence |
|---|----------|---------|------------|
| Q1 | Unified Study Home: A vs B | **A — cross-project surface** | High |
| Q2 | Opt-in enrollment granularity | **C — hybrid (master + per-descriptor mute)** | High |
| Q3 | Retention re-surfacing aggression | **B — gentle, passive, no notifications** | High |
| Q4 | Self-assessment vs data disagreement | **LEAN C — user wins silently, data transparent** | Medium |
| Q5 | Incognito drill default | **C — context-dependent (three-intent taxonomy)** | High |
| Q6 | Skill-model in export/backup | **A — always included + D as secondary affordance** | High |
| Q7 | Cold-start expert bypass | **B — self-declaration seed, skippable** | High |

---

## Cross-cutting observations

**Pattern 1 — Three-intent taxonomy is doing most of the work.** Four of seven questions (Q2, Q3, Q5, Q7) resolved more cleanly once the answer was allowed to depend on mode. This suggests the Reference / Deliberate / Discover split is not just an IA choice — it's a substrate that should be wired through the data model, not just the navigation. Concretely: the reducer should carry a `currentIntent` field and the mastery-mutation actions should assert on it (Reference-mode dispatch of a mastery mutation is a bug, not a default). This matches the pattern already used for villain assumptions, where `scope.situation` is a first-class discriminator on when an assumption is meaningful.

**Pattern 2 — The Assumption Engine's separation patterns are directly reusable for user skill.** Three specific house rules in `assumptionEngine/CLAUDE.md` carry over unchanged to user-skill modeling: (a) don't combine epistemic signals with behavioral signals via arithmetic (I-AE-7 → Q4 user-declaration vs drill-data); (b) don't stack priors when a categorization is confident (style priors rule → Q7 self-declaration seed); (c) decay is computed on read, not written (Gate 2 senior engineer → Q3 retention). The user-skill system should not invent new versions of these patterns; it should import them.

**Pattern 3 — Red lines collapse options more than they constrain design.** The Autonomy skeptic's eight red lines look like constraints when you read them in isolation, but in the 7-question decision matrix they actually *eliminate* options decisively — Q3 Option A (aggressive FSRS), Q4 Option B (data wins), Q7 Option C (placement quiz) all fail a red line without any other analysis needed. The design space is smaller than it looks, which is a gift: it means the red lines are doing the work of narrowing scope, not just slowing delivery. Gate 4 should enumerate the red-line checks as a boolean conformance matrix per surface spec.

**Pattern 4 — The shared skill-assessment module has compounding returns.** Every question where I could map the user-skill decision onto an existing villain-modeling pattern (Q2 dial affordance / per-descriptor mute; Q3 on-read decay / predicate staleness; Q4 separate-signal rule / declaration-vs-data; Q7 style prior / user-declaration seed) got sharper because the pattern had already been thought through once. This is the "core competency" framing paying off: the owner's claim that skill-assessment is cross-cutting isn't aspirational — the existing code already encodes the patterns, and user-skill modeling should adopt them.

---

## Architectural proposal: shared skill-assessment module

**Directory:** `src/utils/skillAssessment/`

**Purpose:** Provide a shared substrate for Bayesian skill inference that serves both user-skill (Shape Language descriptors, future learning surfaces) and villain-skill (existing villain assumption engine). Package the generalizable math + decay semantics + separation-of-signals invariants in one place; let the two consumers differ only in their signal sources and priors.

**What's shared:**
- Beta-Binomial posterior update (`updateBetaPosterior(alpha, beta, successes, trials) → {alpha, beta}`).
- Credible interval computation (`betaCredibleInterval(alpha, beta, confidenceLevel) → [lo, hi]`).
- On-read decay (`applyTemporalDecay(posterior, lastObservedAt, now, decayProfile) → decayedPosterior`). Decay profile supports both procedural (slow decay, for user pattern-recognition and villain population priors) and declarative (fast decay, for volatile tendencies).
- Separation-of-signals invariant enforcement (`assertIndependentSignals(signalA, signalB)` — lints against arithmetic combinations per I-AE-7).
- Style/declaration priors (`applyCategoricalPrior(basePrior, category, priorTable) → adjustedPrior`).

**What's user-specific (consumer: `shapeLanguage/skillFacade.js`):**
- Drill outcomes translated to (successes, trials) with recognition-latency weighting.
- Self-declaration seed — one-time shape `{descriptorId, declaredLevel}`.
- User-mute state per descriptor (`userMuteState: 'none' | 'already-known' | 'not-interested'`).
- Mode-gated signal routing (Reference does not write; Deliberate/Discover write per mode).

**What's villain-specific (consumer: `assumptionEngine/` — refactor, not rewrite):**
- Action-frequency observations (hand-state reconstructor feeds trial counts per predicate).
- Showdown data as calibration input.
- Population priors from `POP_BETA_PRIORS` style-conditioned tables.
- Four-gate actionability filter + Sharpe floor (stays in `assumptionEngine/qualityGate.js` — gate-level filtering is villain-specific in its thresholds).

**API sketch (10 functions):**

```
// Core Bayesian layer (subject-agnostic)
updateBetaPosterior(posterior, observation) → posterior
betaCredibleInterval(posterior, level) → [lo, hi]
applyTemporalDecay(posterior, lastObservedAt, now, profile) → posterior
applyCategoricalPrior(basePrior, category, priorTable) → posterior

// Signal-hygiene invariants (subject-agnostic)
assertIndependentSignals(signalA, signalB) → void (throws in dev)
composeRecommendation({signals, combineRule}) → recommendation

// User-consumer facade
recordUserDrillOutcome({descriptorId, correct, latencyMs, mode}) → void
seedUserDeclaration({descriptorIds, declaredLevel}) → void

// Villain-consumer facade (existing — refactored to delegate to core)
recordVillainAction({villainId, predicate, outcome}) → void
classifyVillainStyle({villainId, observations}) → styleCategory
```

**Migration path:**
1. **Phase A (no refactor, additive):** Author `skillAssessment/` as a new module. User-skill code (Shape Language Stream D) imports from it directly. Villain modeling stays on its current implementation.
2. **Phase B (villain delegation):** Refactor `assumptionEngine/posteriorUpdate` and related internals to delegate to `skillAssessment/` core functions. Gate-logic and four-gate actionability stay in `assumptionEngine/` — they're villain-specific.
3. **Phase C (invariant unification):** Move the I-AE-7 ESLint rule to guard the shared module; extend to user-skill signal pairs.

This is the safe order. Phase A ships user-skill on the shared substrate without touching villain modeling. Phase B happens only after the user-skill consumer has proven the shared API. Phase C is a linting cleanup. None of the three phases is a big-bang refactor; each is independently revertible.

**The architectural claim this justifies:** the owner's "core competency" framing is correct, and the codebase has already paid most of the math-integrity cost in the villain path. User-skill modeling should *inherit* that cost, not re-pay it. The `skillAssessment/` module is the place where the inheritance is made explicit, and the three-phase migration ensures the existing villain code doesn't destabilize during the adoption.

---

## Sources

**Autonomy / SDT / override literature:**
- [Self-Determination Theory — Ryan & Deci 2000](https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf)
- [SDT Meta-Analysis — Ryan, Duineveld, DiDomenico et al. 2023](https://selfdeterminationtheory.org/wp-content/uploads/2023/01/2023_RyanDuineveldDiDomenicoEtAl_Meta-1.pdf)
- [SDT and Self-Directed E-Learning — Frontiers 2025](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1545980/full)
- [PMC: Divergence between self-assessment and self-monitoring](https://pmc.ncbi.nlm.nih.gov/articles/PMC3139875/)
- [Deceptive Patterns — Duolingo brand page](https://www.deceptive.design/brands/duolingo)

**Adaptive learning / placement / cold-start:**
- [Duolingo Placement Test — Fandom](https://duolingo.fandom.com/wiki/Placement_test)
- [Partial Credit: Improvements to Duolingo's Placement Test — Duolingo Blog](https://blog.duolingo.com/partial-credit-improvements-to-duolingos-placement-test/)
- [Khan Academy Mastery Levels](https://support.khanacademy.org/hc/en-us/articles/5548760867853--How-do-Khan-Academy-s-Mastery-levels-work)
- [Khan Academy — Mastery Challenges Demotivation Thread](https://support.khanacademy.org/hc/en-us/community/posts/360039462811-Including-already-Mastered-Skills-in-Mastery-Challenges-can-be-demotivating)
- [Cold-Start Problem in Recommender Systems — Things Solver](https://thingsolver.com/blog/the-cold-start-problem/)
- [Cold & Warm Net: Addressing Cold-Start Users — arXiv 2023](https://arxiv.org/abs/2309.15646)

**FSRS / spacing / memory:**
- [FSRS Algorithm — RemNote](https://help.remnote.com/en/articles/9124137-the-fsrs-spaced-repetition-algorithm)
- [The Optimal Retention — FSRS4Anki Wiki](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-optimal-retention)
- [Spaced Repetition — Wikipedia](https://en.wikipedia.org/wiki/Spaced_repetition)
- [Procedural vs Declarative Memory in DLD — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7161705/)
- [Declarative vs Procedural Memory — Matbury](https://matbury.com/wordpress/index.php/2025/07/02/declarative-vs-procedural-memory-in-language-learning-what-every-learner-teacher-should-know/)

**Chess / poker practice modes:**
- [Chess.com Puzzles — Help](https://support.chess.com/article/286-how-do-puzzles-work)
- [Chess.com Rated vs Custom Puzzles — Forum](https://www.chess.com/forum/view/more-puzzles/rated-puzzles-vs-custom-puzzles)
- [Poker Dunning-Kruger — PokerListings](https://www.pokerlistings.com/poker-and-the-dunning-kruger-effect-you-re-not-as-good-as-you-think-53930)
- [Modeling Dunning-Kruger: A Rational Account — Princeton](https://cocosci.princeton.edu/papers/rachelCogsci.pdf)
- [Poker Skills Measure (PSM) — Journal of Gambling Studies](https://link.springer.com/article/10.1007/s10899-014-9475-0)

**Medical decision aid / trust calibration:**
- [Physician's Autonomy in the Face of AI Support — Frontiers](https://www.frontiersin.org/journals/medicine/articles/10.3389/fmed.2024.1324963/full)
- [Enhancing Clinician Trust in AI Diagnostics — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12428550/)
- [Case for an Autonomy Algorithm — AMA Journal of Ethics](https://journalofethics.ama-assn.org/article/should-artificial-intelligence-augment-medical-decision-making-case-autonomy-algorithm/2018-09)

**Data portability / export:**
- [GDPR Article 20 — Right to Data Portability](https://gdpr-info.eu/art-20-gdpr/)
- [GDPR for Machine Learning — GDPR Local](https://gdprlocal.com/gdpr-machine-learning/)
- [xAPI and GDPR — Watershed LRS](https://www.watershedlrs.com/blog/product/news/what-is-gdpr/)

**Internal references (file paths):**
- `C:\Users\chris\OneDrive\Desktop\Claude-Poker-Tracker\docs\projects\poker-shape-language.project.md` (charter + Decisions Log)
- `C:\Users\chris\OneDrive\Desktop\Claude-Poker-Tracker\docs\projects\poker-shape-language\gate3-triage.md`
- `C:\Users\chris\OneDrive\Desktop\Claude-Poker-Tracker\docs\design\audits\2026-04-23-blindspot-shape-language-adaptive-seeding.md`
- `C:\Users\chris\OneDrive\Desktop\Claude-Poker-Tracker\docs\projects\poker-shape-language\gate2-voices\04-autonomy-skeptic.md`
- `C:\Users\chris\OneDrive\Desktop\Claude-Poker-Tracker\.claude\context\POKER_THEORY.md`
- `C:\Users\chris\OneDrive\Desktop\Claude-Poker-Tracker\src\utils\assumptionEngine\CLAUDE.md`
- `C:\Users\chris\OneDrive\Desktop\Claude-Poker-Tracker\src\utils\assumptionEngine\assumptionTypes.js`
- `C:\Users\chris\OneDrive\Desktop\Claude-Poker-Tracker\src\utils\persistence\assumptionStorage.js`
- `C:\Users\chris\OneDrive\Desktop\Claude-Poker-Tracker\src\utils\persistence\index.js`
- `C:\Users\chris\OneDrive\Desktop\Claude-Poker-Tracker\docs\projects\line-study-slice-widening.project.md`
- `C:\Users\chris\OneDrive\Desktop\Claude-Poker-Tracker\docs\projects\exploit-deviation.project.md`
