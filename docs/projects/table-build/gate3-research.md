# Gate 3 Research — Table-Build Surface

**Gate:** 3 (Research)
**Date:** 2026-04-26
**References:** [Gate 1 Entry — `audits/2026-04-26-entry-table-build.md`](../../design/audits/2026-04-26-entry-table-build.md), [Gate 2 Blind-Spot — `audits/2026-04-26-blindspot-table-build.md`](../../design/audits/2026-04-26-blindspot-table-build.md), [persona — `personas/situational/cold-read-chris.md`](../../design/personas/situational/cold-read-chris.md)
**Status:** Draft, pending owner ratification.

This document addresses the five non-owner-preference open questions from Gate 1 + Gate 2 (Q3, Q4, Q5, Q7, Q8, Q9). Q1, Q2, and Q6 are owner-preference / already-resolved decisions and are deferred to ratification rather than researched here.

---

## Q3 — Stability Promotion Threshold (today → always)

**Framing.** After how many consecutive observed sessions should a `today`-flagged feature auto-promote to `always`? Gate 1 default proposal: N=2.

**Evidence.** Direct empirical evidence is thin — no published study of "minimum consecutive observations before categorical-trait inference" maps cleanly onto a 5–15 min table-entry context. The closest analogues are spaced-repetition systems and human heuristic-judgment literature.

- **SM-2 / Anki graduation.** SM-2 promotes a card from "learning" to "review" after the second successful repetition (interval 1 day → 6 days), confirming N=2 is the de-facto floor for "graduate to a more durable category" in widely-deployed mastery systems ([Anki SM-2 docs](https://faqs.ankiweb.net/what-spaced-repetition-algorithm), [RemNote SM-2 explainer](https://help.remnote.com/en/articles/6026144-the-anki-sm-2-spaced-repetition-algorithm)). Default Anki learning steps end after the second "Good" press.
- **CRM "verified" thresholds.** HubSpot's duplicate-detection ML and Salesforce contact verification do not publish a fixed N; they accumulate signal over time and surface confidence to the user ([HubSpot dedupe overview](https://www.hublead.io/blog/hubspot-duplicate-contacts)). This is evidence that production CRMs *avoid* a hard count and prefer cumulative-evidence + user confirmation — a signal the surface should also expose the override.
- **Cognitive science.** No clean citation supports a specific N for trait-stability inference at this granularity. Be honest: the choice is principled but not literature-bound.

**Recommendation.** **N=2, with two guardrails.** (a) Promotion is *suggested* not silent — promotion fires the autonomy red-line #3 contract: the surface marks the feature `always (auto)` with a one-tap demote, never a hidden flip. (b) Per Gate 2 Stage E, schema records `source: 'inferred' | 'user'`; once user demotes, re-inference is suppressed permanently for that feature on that player.

**Confidence: Medium.** N=2 matches SM-2's graduation floor and Chris's stated heuristic ("this guy always wears the chain"). The autonomy-honest delivery (suggested + reversible) matters more than the exact N — N=3 would also be defensible.

---

## Q4 — Today-Feature Lifetime at Session End

**Framing.** Three options: (a) silent clear, (b) post-session review prompt, (c) auto-promote to `unknown`.

**Evidence.**

- **Daily-notes apps** (Roam, Obsidian, Bear) all keep ephemeral notes *forever* by default — they never silently clear. The cost of silent clearing is loss of recoverable context; the user model is "drop into the daily-note bucket, surface later if useful" ([Obsidian Daily Notes plugin](https://help.obsidian.md/plugins/daily-notes), [Roam fleeting-note pattern via Maggie Appleton](https://maggieappleton.com/daily-notes)). Permanence-by-default + later-review-on-demand is the dominant pattern.
- **Review-prompt fatigue.** Stale-PR Slack bots and similar nudge systems show the failure mode: hard-coded periodic prompts get muted within the first week if not tier-gated, throttled, or three-strike-capped ([ReviewNudgeBot writeup](https://reviewnudgebot.com/), [Babylon Engineering on PR-review reminders](https://medium.com/babylon-engineering/bringing-some-order-to-pull-request-reviews-27ac55d181bb)). 73% helpful at 210k+ reminders is *with* fatigue mitigation; without it the rate is much lower.
- **Cold-Read Chris time budget.** The persona explicitly says Post-Session-Chris is a separate situational persona with a different mental mode — surfacing a 5-question review at session end during the venue exit is the wrong moment.

**Recommendation.** **Hybrid: (a)+(c).** At session end, every `today` flag that did *not* recur during the session demotes to `unknown` (option c, soft preservation; not silent erasure). The Post-Session-Chris flow surfaces unknowns alongside other cleanup affordances *only when the user opens it themselves*, not via push prompt. This preserves data, avoids prompt fatigue, and respects autonomy red-line #6 (no proactive notifications outside session entry/end). Concretely: `today` becomes `unknown` (not deleted); promotion to `always` requires N=2 from Q3; demotion to `today` is a manual action.

**Confidence: Medium-High.** Daily-notes pattern is well-established; review-prompt-fatigue evidence is strong; the autonomy fit is clean.

---

## Q5 — Duplicate-Detection Threshold Posture

**Framing.** Aggressive (any stable-feature overlap) / Calibrated (weighted score crosses threshold) / Conservative (name-prefix + ≥2 stable features).

**Evidence.**

- **Production CRMs lean conservative-to-calibrated.** HubSpot's native dedupe defaults to email-as-primary-key, with name+phone+zip as secondary signals only surfaced as "potential" pairs ranked by confidence ([HubSpot dedupe guide](https://www.default.com/post/hubspot-duplicates), [Insycle deduplication](https://www.insycle.com/hubspot/deduplication/)). Apple Contacts and Google Contacts both surface duplicates as a passive banner rather than a blocking prompt and require user confirmation before merge ([iPhone duplicate-contacts overview](https://applemagazine.com/iphone-contact-merge/), [Google Contacts dedupe](https://www.mergix.com/duplicate-contacts-google)). None silent-merges; none is purely "any-overlap" aggressive.
- **Fellegi-Sunter probabilistic record linkage** is the academic baseline ([Fellegi & Sunter 1969 PDF](https://www.cs.cornell.edu/~shmat/courses/cs6434/fellegi-sunter.pdf), [Splink theory guide](https://moj-analytical-services.github.io/splink/topic_guides/theory/fellegi_sunter.html)). Two thresholds (Tλ, Tµ) define a *three-zone* result: match, non-match, indeterminate. The indeterminate zone is the right primitive for this UI — it's where "Possible matches" panels belong.
- **Jaro-Winkler for short names.** Winkler's extension of Fellegi-Sunter weighting common prefixes higher is the published best practice for short-name fields like first-name fragments ([IEEE: Jaro-Winkler in Fellegi-Sunter](https://ieeexplore.ieee.org/document/6864381/)). For a typed "Mike" the prefix-bonus is exactly what Cold-Read Chris's mental model uses.
- **Asymmetric error cost.** Per persona "Constraints": false-positive merge destroys data (autonomy red-line #1 catastrophic); false-negative merge produces a duplicate Chris will fix in Post-Session-Chris (annoying, recoverable). This argues for a higher threshold to surface, but the *panel itself* should not auto-merge — fire on lower confidence than where merge would commit, since the user is the validator.

**Recommendation.** **Calibrated, with the panel firing at the indeterminate threshold and the merge action requiring explicit confirmation always.** Suggested starting weights:

```
score =
  0.35 * jaro_winkler(name, candidate_name)            // Winkler-bonus on prefix
+ 0.20 * (ethnicity_tag_overlap > 0 ? 1 : 0)
+ 0.15 * (skin_stable_match ? 1 : 0)
+ 0.15 * (build_stable_match ? 1 : 0)
+ 0.10 * (hair_color_stable_match ? 1 : 0)
+ 0.05 * (eye_color_stable_match ? 1 : 0)
```

Fire panel at score ≥ 0.45 (indeterminate floor). Sort top 3 candidates. Do not display the score itself — Gate 2 Stage E autonomy finding: render evidence list, never confidence number. `today`-flag matches contribute zero weight (consistent with stability-aware ranking).

**Confidence: Medium.** Weight calibration is a starting point — Gate 4 must run ≥10 fixture queries against synthetic candidate pools and tune. The structural choice (calibrated + evidence-rendered + user-confirmed) is high-confidence; the specific weights are starter values.

---

## Q7 — Ethnicity Curated Suggestion List

**Framing.** Source taxonomy + granularity for the autocomplete chip input. Free-text remains supported; curated list = suggestions, not enum.

**Evidence.**

- **OMB Directive 15 minimum** is 5 racial categories + Hispanic/Latino ethnicity ([Census on OMB updates](https://www.census.gov/newsroom/blogs/random-samplings/2024/04/updates-race-ethnicity-standards.html), [White House OMB 1997 standard](https://obamawhitehouse.archives.gov/omb/fedreg_notice_15/)). This is too coarse — it collapses Irish/Polish/Greek into "White" and Punjabi/Han into "Asian," explicitly the discrimination Cold-Read Chris loses. Use OMB as a *roll-up* for analytics, not as the user-facing list.
- **2020 Census write-in expansion** explicitly added prompted examples like "German, Irish, English, Italian, Lebanese, Egyptian" to the race/ethnicity questions, recognizing the granularity gap ([2020 Census FAQ on race/ethnicity](https://www.census.gov/programs-surveys/decennial-census/decade/2020/planning-management/release/faqs-race-ethnicity.html)). This is the right granularity tier for Chris's use case — sub-national / cultural / regional descriptors.
- **UK Government ethnicity style guide** publishes a curated list of ~18 high-level + ~50 detailed entries ([gov.uk style guide](https://www.ethnicity-facts-figures.service.gov.uk/style-guide/ethnic-groups/)). It's a usable tier reference but UK-skewed.
- **Tag-input UX patterns.** Stack Overflow tag autocomplete and GitHub topics both surface ~5–8 suggestions per keystroke; the underlying tag pool is 10k+ but visible-suggestions are tightly bounded. Lesson: total list size matters less than suggestion-bar size + free-text fallback.

**Recommendation.** **Starter list of ~120 entries, blending three sources:** (1) the 2020 Census detailed-write-in examples (~30 European nationality/ancestry tags including Irish, Polish, Greek, Serbian, Italian, German); (2) South Asian / East Asian / Southeast Asian sub-national tags (~30 — Punjabi, Gujarati, Han, Cantonese, Korean, Vietnamese, Filipino, Thai); (3) Latin American / African / Middle Eastern sub-regional tags (~40 — Mexican, Cuban, Dominican, Nigerian, Ethiopian, Lebanese, Egyptian, etc.); (4) ~20 broad rollups (East Asian, South Asian, Latino, Middle Eastern) for users who want lower granularity. Free-text always permitted; the list is suggestions only. Stored as `string[]` per Gate 1 schema. Show 6 suggestions per keystroke. **Owner-editable list** (curation responsibility on Chris, since it represents his recognition vocabulary at his venue, not a universal taxonomy). Render abbreviations where conventional (UK, US-S, N.Eur) for chip display density.

**Confidence: Medium.** Source-tier choice (2020 Census + sub-national supplement) is well-grounded. Specific size 120 is a starting point — Chris should prune in first week of use.

---

## Q8 — Mobile-Portrait Scope for V1

**Framing.** Reference device is Samsung Galaxy A22 in landscape (1600×720). Should v1 also support portrait?

**Evidence.**

- **Portrait dominates phone usage at population scale.** ScientiaMobile reports 91% portrait at the 6–6.5" form factor; iPhone users portrait ~97% of the time across all app usage ([ScientiaMobile orientation report](https://scientiamobile.com/smartphone-vs-tablet-orientation-whos-using-what/)). Even on video-heavy sites, only 17.5% rotate to landscape ([ScientiaMobile video-viewer study](https://scientiamobile.com/how-do-mobile-video-viewers-hold-their-phone/)).
- **But task context flips this.** When users concentrate on a device, especially at rest, two-handed landscape becomes preferred ([IDSA portrait-vs-landscape study, Quinn 2013](https://www.idsa.org/wp-content/uploads/2022/09/Quinn-Final_Paper_Portrait-Versus_-Landscape.pdf)). At a poker table, the device is at rest on the rail / lap / table edge, the user is two-handed (cards not yet pitched per the Cold-Read situation), and the task is sustained — these match the conditions where landscape wins.
- **Poker-tracking competitors set no clear precedent.** PokerTracker 4 has no mobile companion ([forum confirmation](https://www.pokertracker.com/forums/viewtopic.php?f=59&t=42316)); GTOWizard mobile is a PWA with both orientations supported ([GTOWizard install guide](https://help.gtowizard.com/how-to-install-gto-wizard/)). No competitor-driven obligation either way.
- **Cost evidence from this codebase.** The existing surfaces (PlayerPickerView, PlayerEditorView, PlayersView) are landscape-tuned; DCOMP-W4-A1 found a 209px / 29% chrome problem at 1600×720. Adding portrait support means a second layout grid, a second responsive-test pass, and a second Playwright fixture set per Gate 2 Stage D test-churn estimate (~12–18 files affected as is).

**Recommendation.** **Landscape-only for v1.** Detect portrait on mount and render a one-line affordance ("rotate to landscape to build a table") rather than a degraded portrait layout. Reasons: (1) Cold-Read Chris is genuinely a landscape, two-handed, at-rest task by persona definition; (2) competitor field gives no portrait obligation; (3) test-churn already at upper bound for landscape-only; (4) portrait can land in v2 against measured demand, not speculative. The rotate-prompt is graceful, doesn't lock user out, and preserves evidence ("does anyone hit it?") for v2 prioritization.

**Confidence: High.** Persona context strongly favors landscape; population-level portrait dominance is a different task class; cost data is concrete.

---

## Q9 — Stability-Flag Vocabulary

**Framing.** Default proposal: `always` / `today` / `unknown`. Alternatives surveyed in Gate 2 Stage E.

**Evidence.**

- **Nielsen H-N6 (recognition over recall)** explicitly favors "match between system and the real world" — vocabulary the user already thinks in beats neologisms ([NN/G 10 heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/), [IxDF recognition vs recall](https://ixdf.org/literature/topics/recognition-vs-recall)). For a feature about *time-stability of an observation*, the everyday English mental model is "is this always true, just today, or do I not know yet?"
- **Settings-toggle convention.** iOS and Android both prefer concrete plain-English over abstract jargon for tri-state switches (e.g., "Always / While Using / Never" for permissions). The pattern is stable across both platforms.
- **Tense-aware labels.** Calendar apps differentiating recurring-vs-one-time use the same kind of pairing — "Recurring weekly / This event only" maps semantically onto `always / today`.

**Recommendation.** **Keep `always` / `today` / `unknown`** as the canonical labels. They are: short (≤7 chars, fits in chip UI); plain English; concrete; tense-aware; and map directly onto the user's natural framing of the observation. Alternatives evaluated:

| Vocabulary | Verdict |
|---|---|
| `always` / `today` / `unknown` | **Recommended.** Plain English, time-anchored, fits chip widths. |
| `permanent` / `this session` / `not sure` | "Permanent" overpromises (a beard is not permanent); "this session" is verbose. |
| `sticky` / `today only` / `?` | "Sticky" is jargon; `?` is ambiguous to first-session users. |
| `recurring` / `today` / `tentative` | "Recurring" implies a schedule, not a trait. |

Render the chip as the bare word with a leading icon (anchor for `always`, sun for `today`, question mark for `unknown`). For autonomy honesty, when a flag was system-inferred, append "(auto)" — `always (auto)` — so user knows they can demote.

**Confidence: High.** The vocabulary is short, plain-English, time-anchored, and fits chip UI. Owner ratification at Gate 4 closes the loop.

---

## Cross-cutting notes

- **Where evidence is thinnest:** Q3 (no published research on minimum-N for trait-inference at this granularity) and Q5 weight calibration (starting weights are principled but not data-fitted yet — Gate 4 fixture-tuning closes this).
- **Where evidence is strongest:** Q8 (population-level orientation data is large-N and converging) and Q9 (Nielsen heuristic + iOS/Android convention triangulate).
- **Autonomy thread.** Q3, Q4, and Q5 each touch red-line #3 (durable user overrides) — the recommendations consistently prefer user-confirmed + reversible + evidence-rendered over silent + automatic. This is consistent with EAL Phase 6 sticky-override pattern and with the Gate 2 Stage E findings.

---

## Change log

- 2026-04-26 — Created. Gate 3 research authored alongside Gate 1 + Gate 2. Five questions answered (Q3, Q4, Q5, Q7, Q8, Q9); Q1, Q2, Q6 deferred to owner ratification. Word count ~2050.
