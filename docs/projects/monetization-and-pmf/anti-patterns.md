# Anti-Patterns — Monetization & PMF

**Project:** Monetization & PMF
**Date:** 2026-04-24 (stub authored Session 3b, expanded at Gate 4)
**Purpose:** Explicit refusal list. Under Q1=A verdict (doctrine binds all commerce UX), every anti-pattern below is a structural refusal — Gate 4 surface specs must not re-introduce them, and CI-linted forbidden-copy-strings check catches drift.

**Rule for amendments:** adding an anti-pattern requires persona-level review (red-line inheritance). Removing an anti-pattern requires explicit Q1 scope re-verdict at Gate 3 re-run.

---

## The 12 refusals (MPMF-AP-01 through MPMF-AP-12)

### MPMF-AP-01 — Timer-urgency banners

**Pattern:** "3 days left!" / "Last chance!" / "Offer ends in 2 hours" / countdown animations on any commerce surface.

**Why refused:** red line #5 (no engagement-pressure / shame / streak-like urgency). Timer-based urgency manufactures scarcity that is engagement-coercive, not transactional. Bundle β in `paywall-spectrum.md` is disqualified under Q1=A primarily for this reason.

**Forbidden strings** (CI lint): `"left"` adjacent to time words, `"hurry"`, `"last chance"`, `"ends soon"`, `"don't wait"`, `"time is running out"`, any `{N} days remaining` banner that counts down.

**Permitted alternatives:** factual state indicators without urgency framing. "Founding-member cap: 7 of 50 remaining" is transactional scarcity (factual cap count) and permitted — not a timer.

---

### MPMF-AP-02 — Social-proof false counts

**Pattern:** "2,400 pros use Pro!" / "Join 1,000+ grinders" / "Most popular choice of serious players" — especially when the number is fake, inflated, or uncalculated.

**Why refused:** red line #7 (editor's-note tone). Social-proof framing pressures evaluators into compliance; inflated or unverifiable numbers damage trust when discovered.

**Forbidden strings** (CI lint): `"\d+[,.]?\d* (pros|players|grinders|users) (use|join|trust|love)"`, `"most popular"`, `"#1 choice"`.

**Permitted alternatives:** factual community references when counts are accurate. "Our founding-member cohort — 23 of 50 seats filled" is factual if counts are real and non-coercive.

---

### MPMF-AP-03 — Streak celebrations / engagement mechanics

**Pattern:** "You're on a 7-day streak!" / "Don't lose your streak" / "3 sessions this week — keep it up!" — gamification layered over commerce to manufacture retention.

**Why refused:** red line #5 (no streaks). Streak mechanics create engagement pressure that compromises user autonomy; commerce-streak coupling (e.g., "maintain your streak with Pro") is doubly coercive.

**Forbidden strings** (CI lint): `"streak"`, `"keep it up"`, `"don't break"`, `"X days in a row"`, `"maintain your"` (context-dependent — lint flags for review).

**Permitted alternatives:** none. Scholar persona's opt-in streak (per persona note) applies only to deliberate-engagement features; commerce surfaces never show streaks under Q1=A.

---

### MPMF-AP-04 — Re-engagement push notifications for monetization

**Pattern:** Push notification: "Come back to your poker analysis!" / "You haven't used Plus in 5 days" / re-engagement emails: "We miss you" / "Your insights are waiting."

**Why refused:** red lines #5 (no engagement-pressure), #7 (editor's-note). Re-engagement copy on returning-evaluator is a specific persona harm — the user drifted for a reason; engagement pressure is coercive.

**Forbidden strings** (CI lint): `"we miss you"`, `"come back"` in marketing context, `"haven't used"`, `"we noticed"`, `"last seen"` in notification or email copy.

**Permitted alternatives:** transactional emails only (payment receipt, cancellation confirmation, card-expiry grace-period warning). No marketing push channels exist for monetization under Q1=A.

---

### MPMF-AP-05 — Cancellation retention traps

**Pattern:** Cancellation confirm modal: "Are you sure? You'll lose all your [X]!" / Exit survey interposed between Cancel button and execution / "Pause instead — give us another chance" pre-selected as default.

**Why refused:** red line #10 (no dark-pattern cancellation — NEW in Monetization & PMF Gate 2 audit) + #3 (durable override). Cancellation is cancellation; retention traps violate user autonomy at the moment trust is most fragile.

**Forbidden patterns** (structural):
- Exit survey cannot be interposed; if offered, it is below the confirm action, not in front of it.
- "Pause instead" must have equal visual weight to "Cancel," not pre-selected or dark-pattern-boosted.
- Confirm copy must be factual: "Cancel [tier]. You'll keep access through [date]."
- No guilt-framing ("You'll lose...", "Are you sure you want...").

**Permitted alternatives:** transparent factual confirmation + optional (not forced) exit survey + clear data-retention statement + easy re-subscribe path if they change their mind.

---

### MPMF-AP-06 — "Downgrade" framing on cancellation

**Pattern:** Labeling cancellation as "downgrade to free" / "reduce your capabilities" / framing the cancel action as a step-down on a status ladder.

**Why refused:** red line #7 (editor's-note tone). Cancellation is cancellation; "downgrade" frames the user's autonomous choice as a loss or diminishment. Also applies to plan-change flows (SA-76) — tier-change copy must not frame lower tiers as inferior status.

**Forbidden strings** (CI lint): `"downgrade"`, `"step down"`, `"reduce your"`, `"lose access"` (context-dependent — lint flags).

**Permitted alternatives:** neutral verbs — "Cancel," "Change plan to [tier]," "Switch to free tier." Factual descriptions of feature availability without status framing.

---

### MPMF-AP-07 — "Missing out" loss-framing

**Pattern:** "Don't miss out on [feature]!" / "Unlock your potential" / "Take your game to the next level" — copy that frames non-purchase as a loss.

**Why refused:** red line #7 (editor's-note tone). Aspirational pressure is a soft-coercion pattern that pushes evaluators into compliance via insecurity. Also violates first-principles clarity: the copy should state what the feature does, not what the user is missing.

**Forbidden strings** (CI lint): `"don't miss"`, `"unlock your"`, `"next level"`, `"potential"` in commerce context, `"take your"` (context-dependent).

**Permitted alternatives:** factual feature descriptions. "Plus adds cross-session villain tracking" is factual; "Don't miss out on cross-session villain tracking with Plus!" is loss-framed.

---

### MPMF-AP-08 — Dark-pattern checkout

**Pattern:** Pre-checked upsell boxes at checkout / unclear total price / hidden fees revealed at payment-method step / "negative-option" enrollment (trial auto-converts without clear notification).

**Why refused:** red lines #2 (transparency), #10 (no dark-pattern cancellation spirit extends to checkout). Hidden costs at point of sale are the strongest trust violation available.

**Forbidden patterns** (structural):
- All charges displayed in summary before payment-method entry.
- No pre-checked upsell or add-on options — any upsell is explicit opt-in.
- Trial auto-conversion (if ever used — deferred given Q1=A) requires clear advance notification.
- No "continue"/"upgrade" buttons that skip the explicit price confirmation.

**Permitted alternatives:** standard explicit-consent checkout flow with full price visibility + itemized costs + clear action labels.

---

### MPMF-AP-09 — "Limited-time" fake scarcity

**Pattern:** "50% off — today only!" / "Special pricing for new users this week" / "Flash sale" / countdown-clock marketing banners that reset or extend without user knowledge.

**Why refused:** red line #5 (no engagement-pressure) + red line #7 (editor's-note). Manufactured scarcity is coercive; fake or rolling "limited time" is actively deceptive.

**Distinction from permitted transactional scarcity:** founding-member cap at 50 users is a *factual* cap (it ends when 50 users sign up, not at an arbitrary date). The count is factual and states "cap remaining" not "time remaining."

**Forbidden strings** (CI lint): `"limited time"`, `"flash sale"`, `"today only"`, `"this week only"`, `"while supplies last"`.

**Permitted alternatives:** transactional cap disclosure ("7 of 50 founding-member seats remaining") — no temporal urgency language.

---

### MPMF-AP-10 — Pre-paywall friction

**Pattern:** Forced account creation before free-tier value / forced email collection / forced tutorial before hand entry / any gate that intervenes before the user has experienced the product's core value.

**Why refused:** red line #1 (opt-in enrollment). Evaluator has not agreed to create accounts, share email, or sit through tutorials. Under Q1=A, pre-paywall friction is a structural autonomy violation. L1 paywall in `paywall-spectrum.md` is disqualified specifically under this anti-pattern.

**Forbidden patterns** (structural):
- First-launch sequence cannot require account creation for free-tier access.
- First-launch cannot require email input before sample-data or hand-entry is accessible.
- First-run tour must be skippable per ON-84 + ON-88 (evaluator expert-bypass).
- Sample-data mode accessible without any prior input.

**Permitted alternatives:** anonymous ID by default → identified on explicit account creation at paywall-moment or at user-initiated feature. Email collection at signup moment, not as gate.

---

### MPMF-AP-11 — Silent auto-renewal

**Pattern:** Subscription auto-renews without advance user notification / renewal charge surprises the user / "auto-renewal" buried in T&Cs rather than visible in billing settings.

**Why refused:** red line #2 (transparency on demand). Silent auto-renewal violates the "know-when-ill-be-billed-and-how-much" JTBD (SA-78). Surprise charges destroy trust at the exact moment the app is being evaluated for continued commitment.

**Forbidden patterns** (structural):
- Next-renewal date + amount must be visible in SettingsView → Billing at all times (not gated behind a click).
- 3-day advance in-app informational banner (passive, non-urgent — respects red line #5) before renewal.
- Transactional email at charge time (receipt, not marketing).
- Cancellation-before-renewal must be honored without pro-rata penalties beyond industry norm.

**Permitted alternatives:** factual renewal transparency — date, amount, tier visible at all times; passive in-app notice before charge; transactional receipt after.

---

### MPMF-AP-12 — Paywall mid-hand

**Pattern:** Paywall modal fires while user has a live hand in progress / quota-exhaustion mid-hand interrupts hand entry / upgrade CTA surfaces on LiveAdviceBar during active decision.

**Why refused:** red line #8 (no cross-surface commerce contamination) + H-SC01 new project-specific heuristic (paywall never interrupts active work). Live-hand mid-flow is the most autonomy-critical surface in the entire app; commerce intervention here is categorically unacceptable.

**Forbidden patterns** (structural):
- Usage-threshold paywall (L3) defers modal to hand-end, never during active hand.
- Depth-of-analysis paywall (L6) defers to post-hand review, never during live decision.
- Feature-first-open paywall (L2) blocked from TableView while any hand is in progress (detected via `isHandInProgress()` state).
- Tier-state indicator on TableView ≤ 150ms glanceable; no banners, no badges with pressure framing.

**Permitted alternatives:** all paywall triggers defer to hand-end or session-end boundary. Session-close → paywall-next-open pattern for free-tier users who hit history-access gates (L4) respects this.

---

### MPMF-AP-13 — Telemetry-consent nag

**Pattern:** Re-prompting users to reconsider opt-outs / "You've had session replay off for 30 days — try it?" / badges on Settings icon indicating "consent update needed" / in-app modal "We've added new telemetry — review?" firing without user request.

**Why refused:** red line #5 (no engagement-pressure) + red line #9 (incognito observation mode non-negotiable). Once a user has opted out of a telemetry category, that decision must be durable and non-adversarial. Any "reconsider?" prompt is coercion wrapped in politeness.

**Forbidden patterns** (structural):
- First-launch telemetry panel does NOT re-fire after dismissal (once `firstLaunchSeenAt` is set, panel cannot re-mount except by explicit Settings action).
- No automatic surfacing of consent panel after dismissal — only user-initiated navigation to Settings → Telemetry.
- No "consent update available" badges on any navigation icon.
- New telemetry categories added in future releases default to OFF — they do NOT inherit the user's prior "ON" state without explicit re-consent. Existing categories retain user's prior preference.

**Permitted alternatives:** Settings → Telemetry panel always available; release notes (never in-app modal) may mention "we added a new event category (default: off)." User revisits Settings on their own schedule.

---

### MPMF-AP-15 — Silent plan-change on cancellation

**Pattern:** Cancellation flow that pre-selects "Pause instead" or "Switch to Plus" as default, requiring user to explicitly opt-out of a plan-change they didn't ask for / confirmation modal shows "Change to Plus" as primary button with "Cancel" as secondary / tier change committed without explicit user confirmation of the new tier.

**Why refused:** red line #10 (no dark-pattern cancellation) + red line #3 (durable override). User initiated cancellation; conflating that intent with plan-change is interposition at its worst. Also refuses the inverse: plan-change flows that accidentally cancel on user's tap (e.g., "Save money by downgrading to free" that triggers cancellation without mentioning it).

**Forbidden patterns** (structural):
- Cancellation confirm modal cannot have "Pause instead" or plan-change pre-selected; must be third option at equal visual weight.
- Plan-change journey cannot offer "Cancel instead" as a third option; plan-change is between-paid-tiers only.
- No single UI element should submit both cancellation AND plan-change depending on context — separate buttons, separate writers (W-SUB-3 vs W-SUB-4), separate confirmation copy.
- Founding-member cancellation does NOT offer "Switch to Plus subscription instead" as an alternative — would reintroduce "downgrade" status framing via the back door.

**Permitted alternatives:** cancellation modal offers "Pause instead" as equal-weight OPTIONAL button (user explicitly taps it if desired); plan-change journey is distinct entry point from cancel; both journeys document their distinct scope.

---

### MPMF-AP-16 — Deceptive proration display

**Pattern:** Upgrade flow hides the prorated charge amount until after confirmation / shows only monthly price without acknowledging today's prorated charge / downgrade flow shows "You'll save $X!" without mentioning no refund for current-period-at-higher-tier / proration math rendered as "complicated — trust us" rather than line-item factual.

**Why refused:** red line #2 (full transparency on demand) + MPMF-AP-08 (dark-pattern checkout). Proration is a common source of post-charge surprise and trust damage. Every dollar of charge today must be disclosed before confirmation tap; every dollar of refund or credit must be factually acknowledged (including the absence of refund on downgrade).

**Forbidden patterns** (structural):
- Upgrade confirm modal WITHOUT a "You'll be charged: $X today" line — refused.
- Downgrade confirm modal showing "Save $X by switching!" without clarifying no refund for unused days at higher tier — refused.
- Proration calculation shown only as percentage or "prorated amount" opaque label — refused; show dollars-and-cents.
- Complex "credit toward next bill" logic hidden behind tooltips or "learn more" links — refused; show plainly.
- "Upgrade special: first month $X off" bundled in proration display, conflating discount with proration — refused; keep discounts (if any) separate from proration math.

**Permitted alternatives:** upgrade shows line-item: "Today: $X prorated charge. Next full charge: $Y on [date]." Downgrade shows: "No additional charge today. Next charge: $Y on [date]. Current tier access continues through [date]." Both factual, both dollars-explicit.

---

### MPMF-AP-14 — Onboarding lock-in

**Pattern:** Forcing users through a tutorial they didn't ask for / making Skip difficult to find / multi-step onboarding where each step is required / tour cannot be dismissed until completed / progress-bar "75% done — finish your tour!" pressure.

**Why refused:** red line #5 (no engagement-pressure) + red line #1 (opt-in enrollment — applies to tutorials as well as data collection). Tutorials must be opt-in; forcing them is a kind of enrollment without consent.

**Forbidden patterns** (structural):
- Every step of Full Tour variation has a Skip affordance at equal visual weight.
- First-run variation picker has 3 cards at equal visual weight — Full tour / Fast orientation / Skip — with no "recommended" framing.
- Once Skip is selected, `settings.onboarding.skipped = true` is durable; no re-prompt next launch.
- No progress indicators that imply "X% complete" pressure.
- Re-triggerable tour is via Settings → Help → "Take the tour" ONLY; never auto-fires.
- Variation D (at-table) auto-detect does not force the user into tour; it SUPPRESSES tour + delivers direct TableView.

**Permitted alternatives:** optional orientation with equal-weight Skip. Sample-data mode (ON-86) is a tool, not a required step. Help icon in nav re-opens tour on demand.

---

## Copy-discipline enforcement

Under Q1=A verdict, Gate 4 ships CI-linted forbidden-copy-strings check (mirrors EAL `scripts/check-anchor-writers.sh` pattern):

- `scripts/check-commerce-copy.sh` (new at Gate 5 per MPMF-G5-CL backlog row).
- Scans all commerce UX copy strings against forbidden-string list.
- Fails CI on any match with rationale pointing to the MPMF-AP-NN refusal.
- Deterministic copy generators (mirror EAL `calibrationCopy.js` + `retirementCopy.js`) for paywall-modal, cancellation-confirm, renewal-notice, upgrade-prompt copy.

**Copy registers permitted** (from `paywall-spectrum.md` §Dimension 4):
- **C5 quantitative/factual** — "Free tier: 3 deep analyses per session. You've used 3 of 3."
- **C6 editor's-note / opt-in ask** — "If you'd like to use deep analysis on every hand, Plus removes the session limit. $19/mo. No pressure; you can keep your current plan indefinitely."
- **C7 silent-gate** — (feature grayed out with inline explainer on tap → factual tier info).

**Copy registers refused** under Q1=A:
- C1 urgency/scarcity
- C2 loss-framing / guilt
- C3 social pressure

---

## Relationship to other projects' anti-pattern lists

This document follows the pattern established by:
- `docs/projects/exploit-anchor-library/anti-patterns.md` — 9 anti-patterns + 3 inherited (autonomy contract for anchor feature)
- `docs/projects/poker-shape-language/` — 8 red lines + anti-patterns (skill-state autonomy)
- `docs/projects/printable-refresher/` — 11 anti-patterns + 5 copy-discipline rules (print-medium + lineage-permanence)

Monetization & PMF's 12 anti-patterns are commerce-UX-specific but inherit from the same 9 autonomy red lines established in `chris-live-player.md` § Autonomy constraint. The 10th commerce red line (no dark-pattern cancellation) is new here.

---

## Change log

- 2026-04-24 — Created Session 3b. 12 anti-patterns authored matching the 12 enumerated in Gate 2 audit §Stage E. Each includes forbidden-string patterns for CI-lint + permitted alternatives + red-line citation. Anchored by Q1=A verdict at Gate 3 owner interview. Will be expanded at Gate 4 as surface specs reveal additional refusals.
- 2026-04-24 (Gate 4 Batch 2) — Added **MPMF-AP-13** (telemetry-consent-nag — re-prompting opt-outs; re-firing consent panel; consent-update-badges) + **MPMF-AP-14** (onboarding-lock-in — forced tutorials; hidden Skip; progress-bar pressure; auto-firing tour on re-launch). Surfaced during authoring of `surfaces/telemetry-consent-panel.md` (MPMF-G4-S6) + `journeys/evaluator-onboarding.md` (MPMF-G4-J1). Both inherit red line #1 (opt-in enrollment) + #5 (no engagement-pressure). Refusal count now 14 (from 12 at stub).
- 2026-04-24 (Gate 4 Batch 3) — Added **MPMF-AP-15** (silent-plan-change-on-cancellation — cancellation flow pre-selecting pause/switch as default; conflating cancel intent with plan-change; UI elements that submit either action ambiguously) + **MPMF-AP-16** (deceptive-proration-display — hiding prorated charge amount; "save $X" framing on downgrade without refund clarification; opaque proration math). Surfaced during authoring of `journeys/cancellation.md` (MPMF-G4-J3) + `journeys/plan-change.md` (MPMF-G4-J4). Both inherit red line #2 (transparency) + #10 (no dark-pattern cancellation) + reinforce MPMF-AP-05 + MPMF-AP-06 + MPMF-AP-08. Refusal count now 16 (from 14 after Batch 2).
