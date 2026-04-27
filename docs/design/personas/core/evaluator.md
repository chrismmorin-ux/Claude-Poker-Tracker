# Persona — The Evaluator

**Type:** Core
**Evidence status:** Owner-Confirmed (structural) — PROTO-evidential (unverified; awaiting Stream D telemetry)
**Last reviewed:** 2026-04-24
**Owner review:** Confirmed 2026-04-24 at Monetization & PMF Gate 3 (structural shape ratified; evidential assumptions E1–E6 remain proto pending telemetry data)

---

## Snapshot

Someone who discovered the app and is trying to figure out whether it's for them. They have no commitment yet. They don't know what the app does in detail. They don't know whether it's worth money. They arrived with a problem in mind (maybe: "my reads suck," "I want to stop second-guessing myself post-session," "I want better HUD data," "I saw a demo video") and are testing whether this product solves it. Their mental state is *evaluation*, not *use*.

Every existing persona in the cast (Chris, Scholar, Coach, etc.) describes an already-committed user. The Evaluator is the persona that the app must convert to Chris/Scholar/etc. — and fail to convert if the product isn't right for them.

---

## Context

- **Environment:** Variable. Could be at home on desktop, on a couch with phone, in a casino parking lot trying the app before walking in, on the commute home from a losing session. Different physical settings from actual-use personas because the context is "Should I use this?" not "I'm using this."
- **Device:** Phone is most likely first contact (mobile-optimized UI is the entry point), but desktop / landing-page visits matter for pricing-page evaluation.
- **Session shape:** Bursty, short sessions — 5 to 30 minutes per try. May be multiple distinct evaluation sessions separated by days. Unlike Chris's 3–6 hour live-play session, an evaluator's "session" is closer to a UX trial window.
- **Available attention:** Moderate-to-high. They came to the app specifically (pulled away from something else to look at it). But they will abandon quickly — the first awkward moment costs them.
- **Available hands:** Two-handed typically; not under physical table pressure. This is a relief compared to Chris.

---

## Goals (what success looks like for them)

- **Understand what the app does within 60 seconds** — core value prop must land that fast, or they bounce.
- **Try the core value claim without paying** — see the exploit engine say something plausibly useful. See a drill actually teach something. Feel the "wow" for themselves.
- **Decide if this is for them specifically** — not "is this cool?" but "would I use this every week / every session?"
- **Know how much it costs and what that includes — without feeling hustled** — transparent pricing + clear free/paid boundary.
- **Preserve autonomy** — they want to leave and come back without consequence. Forcing account creation upfront or gating the core demo behind email = bounce.

## Frustrations (what has caused pain before)

- **Landing pages that hide pricing** — they want the number; hiding it signals distrust. `[ASSUMPTION]`
- **Signup walls before first value** — "create account to start" when the app could let them poke around in demo mode. `[ASSUMPTION]`
- **Fake-free trials** — "free forever" that turns out to be 7 days of actual utility. `[ASSUMPTION]`
- **Dark-pattern cancel flows** — having heard stories or been burned. This evaluator has *memory of other products*. `[ASSUMPTION]`
- **Over-stuffed first-run tours** — long onboarding that won't let them skip to the feature they wanted to try. `[ASSUMPTION]`
- **Jargon walls** — the app assumes knowledge (SPR, MDF, ICM) without tooltips and they feel dumb. `[ASSUMPTION]`
- **Pricing that's wildly different from the category** — GTO Wizard is the category anchor; if this is 3× more, they need to see why, fast. `[ASSUMPTION]`

## Non-goals (what they explicitly don't care about)

- **Deep feature tours of every surface.** They want to try the thing they came for.
- **Community building / social features.** Not yet — they haven't committed.
- **Cross-device sync.** Not yet — they're testing on one device.
- **Account creation.** They'll create one if they convert; forcing it earlier is friction.
- **Fancy animations or polish.** They want substance. A beautiful landing page with nothing behind it is worse than a plain one with working features.

---

## Constraints specific to this persona

- **Time pressure:** High to moderate. They have 5–30 minutes and will NOT come back if the first try is frustrating. First bounce is likely permanent.
- **Error tolerance:** Very low. Any confusing error or crash kills the evaluation. They have no sunk cost to make them persist.
- **Visibility tolerance:** Extremely high for pricing + tier clarity. Moderate for feature discovery (they'll click around). Low tolerance for "Pro features" advertised without a clear path to see what they do.
- **Recovery expectation:** High — if anything goes wrong, they want an obvious "back" or "skip" path. Tolerance for "figure it out" is zero.

---

## Evaluator-specific cognitive shape

The Evaluator differs from all other personas in three structural ways:

1. **They do not know the domain of the app yet.** Chris, Scholar, Coach all know *what the app is for*. An Evaluator may be poker-literate but has never used *this* app; they are learning both the category ("is this a HUD? a trainer? a tracker?") and the product simultaneously.

2. **They will not read documentation.** Tooltips fire on-demand; help pages go unread. Everything they need must be *in the UI* at the moment they need it.

3. **They are one bounce from gone.** Most personas can recover from confusion because they already decided this is their tool. The Evaluator will uninstall on a single bad moment.

**Design implications:**
- The first 60 seconds must produce one "oh, that's useful" moment. Ideally from the paywall-spectrum "free value" teaser (session-scoped live-play feedback, or a drill that actually teaches).
- Every paywall hit in this state is *adversarial by default*. The paywall copy rules in `paywall-spectrum.md` §C6 (editor's-note tone) exist specifically for this persona.
- Tier explanations must live inside the flow, not in a separate pricing page the evaluator has to navigate to.
- Undo / skip / back must be visible everywhere — an evaluator clicks the wrong thing and wants a way out.

---

## Evaluator sub-shapes (distinct mental models)

Evaluators do not arrive as a single type. At least three starting profiles, each with different expectations:

### E-CHRIS — Chris-shape evaluator
- Already a live-poker player.
- Came looking for a live HUD / exploit engine.
- Expects to try the app *at a table* tonight.
- Wants to see a live recommendation fire during a real hand.
- WTP cluster: $20–50/mo for the live HUD + exploit engine.

### E-SCHOLAR — Scholar-shape evaluator
- Already uses GTO Wizard / Upswing / Run It Once for study.
- Came looking for a better drill mechanism or a cheaper alternative.
- Expects to try the app *at home on desktop*.
- Wants to see a drill that's better than GTO Wizard's, not just equivalent.
- WTP cluster: $15–30/mo for drills + study.

### E-IGNITION — Ignition-shape evaluator
- Plays online on Ignition specifically.
- Came looking for a sidebar / HUD / WebSocket capture tool.
- Expects the extension to install and capture hands during a session.
- WTP cluster: $50–100/mo if the sidebar quality exceeds Hand2Note.

Each of these has a different first-60-seconds wow moment, a different trial length that feels right, and a different pricing ceiling. Gate 2 blind-spot roundtable Stage A (persona sufficiency) will decide whether these should be authored as separate sub-personas or as attributes of this core Evaluator.

---

## Related JTBD

- **SA-71** — Try the product before paying (*Proposed* — authored in this project)
- **SA-72** — Understand what's free, what's paid, and why (*Proposed* — authored in this project)
- **SA-73** — Hit a paywall with dignity (*Proposed* — authored in this project)
- **SA-74** — Cancel without friction (*Proposed* — authored in this project)
- **SA-75** — Evaluate the sidebar separately from the main app (*Proposed* — authored in this project)
- **SA-64** — Free tier with real value (*Proposed* — existing)
- **SA-65** — Tier comparison before purchase (*Proposed* — existing)
- **SA-66** — Transparent billing + easy pause (*Proposed* — existing)
- **ON-82** — 90-second product tour (*Proposed* — existing)
- **ON-83** — First-hover jargon explanations (*Proposed* — existing)
- **ON-86** — Sample data for evaluation (*Proposed* — existing)
- **ON-88** — Expert-bypass onboarding for category-experienced evaluators (*Proposed* — authored in this project, distinct from ON-84)
- **CC-88** — Have the app observe my usage honestly and transparently (*Proposed* — authored in this project)

## Related situational sub-personas

- [Trial-first-session](../situational/trial-first-session.md) — the 5–15 minute first-impression window
- [Returning-evaluator](../situational/returning-evaluator.md) — came back after drift

## Related core personas (conversion target)

The Evaluator's job is to become one of:
- [Chris Live Player](./chris-live-player.md) (if E-CHRIS shape)
- [Scholar Drills-Only](./scholar-drills-only.md) (if E-SCHOLAR shape)
- Multi-tabler / online grinder (if E-IGNITION shape — existing `online-mtt-shark.md` or `multi-tabler.md`)

If conversion fails, the Evaluator is lost — not a persona transition, an acquisition failure.

---

## Tier fit hypothesis

Unverified. Authored cold-start.

- **Free tier is mandatory** — no-card evaluation is expected by category (GTO Wizard $0, Run It Once $0 validate).
- **Trial length indifferent** — Evaluators respond to value demonstrations, not time windows. Session-scoped free (T2 in paywall spectrum) or indefinite free (T1) both serve the Evaluator.
- **WTP conversion price anchor:** $19–29/mo for main app (per roundtable and market data). Founding-member lifetime ($299) specifically appeals to E-CHRIS evaluators who value predictability.

---

## Proto-persona caveat

Marked PROTO until owner confirms or telemetry validates. Key assumptions:

- **[E1]** Evaluators arrive with a problem in mind, not blank-slate curiosity. Basis: poker-specific tooling is rarely discovered by accident; most entries are problem-driven search or referral. Verify by: first-touch source data once acquisition begins.
- **[E2]** The 3 sub-shapes (E-CHRIS / E-SCHOLAR / E-IGNITION) are the full set; no fourth or fifth evaluator mental model exists. Basis: mapping against the 14 existing core personas — only Chris, Scholar, and Ignition-side have clear commercial lanes. Verify: Gate 2 blind-spot roundtable Stage A.
- **[E3]** Evaluators will NOT create accounts before value. Basis: SaaS industry norm + red line #1 (opt-in enrollment). Verify: A/B test signup placement post-launch.
- **[E4]** First-60-second wow moment is required; no wow = bounce. Basis: B2C landing-page conversion research. Verify: PostHog funnel data from first cohort.
- **[E5]** Evaluators remember being burned by dark-pattern cancel flows elsewhere. Basis: industry-wide reputation for SaaS cancel hostility. Verify: anecdotal via founding-member interviews.
- **[E6]** Session-scoped free tier (paywall-spectrum bundle α) produces enough felt value to drive conversion within 2–3 evaluation sessions. Basis: Session 1 roundtable hypothesis (M1 in assumption ledger). Verify: kill-criterion in `assumption-ledger.md`.

Any E1–E6 that turns out false triggers re-review of Goals + Frustrations + Tier fit.

---

## Autonomy constraint inheritance

The Evaluator is an applied-case of the 9 autonomy red lines established in `chris-live-player.md` §Autonomy constraint. In particular:

- **Red line #1 (opt-in enrollment)** → evaluator does not sign up to see value; signup is *post-decision*, not gate.
- **Red line #5 (no streaks/shame/engagement-pressure)** → evaluator encounters NO urgency copy, NO countdown timers, NO pluralized social-proof pressure. Q1 verdict pending; recommended Q1=A.
- **Red line #7 (editor's-note tone)** → all commerce copy the evaluator sees is factual, not cajoling. See `paywall-spectrum.md` §Dimension 4 for copy registers.
- **Red line #9 (incognito observation)** → telemetry on evaluator usage has a first-launch transparency panel + one-tap off-switch. Q8 verdict pending.

Any paywall / pricing / trial surface that violates a red line against an Evaluator triggers persona-level review, not just surface-level.

---

## Change log

- 2026-04-24 — Created in Session 1 of monetization-and-pmf project. PROTO status; awaiting owner confirmation of assumptions. Three sub-shapes (E-CHRIS / E-SCHOLAR / E-IGNITION) flagged for Gate 2 roundtable Stage A decision — fold or split.
- 2026-04-24 (later same day — Session 3b) — **Ratified to Owner-Confirmed (structural)** at Monetization & PMF Gate 3. Q10 verdict B: keep unified Evaluator at core level; 3 sub-shapes (E-CHRIS / E-SCHOLAR / E-IGNITION) remain as attributes in §Evaluator sub-shapes, not forked to separate core personas. Owner ratified structural shape: prospective-buyer cognitive state, 3 sub-shapes, autonomy-constraint inheritance. Evidential assumptions E1–E6 remain proto pending Stream D telemetry 30-60-day window (e.g., E4 60-sec wow threshold kill-criterion needs first-session bounce correlation data). Full Verified status pending. See `docs/projects/monetization-and-pmf/gate3-owner-interview.md` §Q10 for verdict rationale.
