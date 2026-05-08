# Anti-Patterns — Monetization & PMF

**Project:** Monetization & PMF
**Date:** 2026-04-24 (stub authored Session 3b, expanded at Gate 4)
**Purpose:** Explicit refusal list. Under Q1=A verdict (doctrine binds all commerce UX), every anti-pattern below is a structural refusal — Gate 4 surface specs must not re-introduce them, and CI-linted forbidden-copy-strings check catches drift.

**Rule for amendments:** adding an anti-pattern requires persona-level review (red-line inheritance). Removing an anti-pattern requires explicit Q1 scope re-verdict at Gate 3 re-run.

---

## The 29 refusals (MPMF-AP-01 through MPMF-AP-29)

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

### MPMF-AP-17 — "Maybe later" pressure-button on commerce dismissals

**Pattern:** Dismiss button on a paywall modal, upgrade prompt, or trial banner labeled `"Maybe later"` / `"Not now"` / `"Remind me later"` / `"I'll think about it"` / `"Come back to this"` instead of a factual dismissal verb.

**Why refused:** red line #5 (no engagement-pressure) + #7 (editor's-note tone). "Maybe later" implies the user has agreed to revisit the decision — the autonomous "no" gets framed as a deferral. Doctrine refuses: dismissal is dismissal, not a postponed yes. Compounds with H-N07 7-day cooldown — if the user dismisses today, the system won't re-prompt for 7 days regardless of button label, but the label itself shapes how the user interprets their own action.

**Forbidden strings** (CI lint): `"maybe later"`, `"not now"`, `"remind me"`, `"i'll think"`, `"come back to this"`, `"think it over"`, `"decide later"` as button labels in commerce surfaces.

**Permitted alternatives:** factual dismissal verbs naming the action's outcome — `"Keep free"`, `"Close"`, `"Stay on free tier"`, `"Dismiss"`, `"No thanks"`. Verb describes what the tap *does*, not a future obligation.

---

### MPMF-AP-18 — Pre-focused / pre-selected primary commerce CTA

**Pattern:** Commerce modals or dialogs that auto-focus the upgrade/conversion button on render (e.g., `<button autofocus>View plans</button>`); pricing-page tier cards with visual pre-selection (highlighted border, scaled treatment, "selected" state) on a default tier; tab order placing primary conversion CTA before dismissal/secondary action.

**Why refused:** red line #6 (flat-access). Pre-focus and pre-selection steer keyboard, screen-reader, and assistive-tech users into the conversion path automatically — equal-weight is not equal if the cursor lands on one button by default. Compounds AP-15 (silent plan-change pre-selection on cancellation) into the conversion direction.

**Forbidden patterns** (structural):
- No `autofocus` attribute on conversion CTAs in commerce modals. Modal opens with no focused element OR focuses the modal title `<h2>`.
- Tab order in commerce modals: `✕ close` → secondary action (dismiss / Keep free) → primary action (View plans / Upgrade). Per paywall-modal §Modal contract.
- No "Recommended" / "Default" / pre-selected tier on pricing-page tier cards or plan-change selection modals.
- No CSS treatment that visually pre-selects without explicit user interaction (no default `:focus`-equivalent styling on a non-focused element).

**Permitted alternatives:** dismissal/secondary action receives natural tab order priority. Pre-selection only after explicit user interaction (tap / arrow-key navigation).

---

### MPMF-AP-19 — Editorial choice-steering badges on tier cards

**Pattern:** Pricing-page tier cards labeled `"Most Popular"` / `"Best Value"` / `"Recommended"` / `"Editor's Choice"` / `"Top Pick"` / `"#1 Choice"`, or visually highlighted (starred, boxed in colored border, scaled larger, gradient background) to steer evaluator choice toward a specific tier.

**Why refused:** red line #5 (no engagement-pressure) + #7 (editor's-note tone) + flat-access spirit. Editorial steering pressures the evaluator toward a tier the product *wants* them to pick. Distinct from MPMF-AP-02 (false social-proof counts): the pressure is editorial framing, not numeric inflation. Even if a "recommended" badge corresponds to a true metric (e.g., genuinely most-popular), the act of nudging via UI weight is coercion — the evaluator's choice should derive from feature/price comparison, not from product editorial.

**Forbidden patterns** (structural):
- No `"Most Popular"` / `"Best Value"` / `"Recommended"` / `"Editor's Choice"` / `"Top Pick"` labels on tier cards.
- No visual pre-emphasis on a default tier (starred, highlighted border, scaled larger, gradient/colored background distinct from peer tiers).
- All tier cards use identical visual treatment; price + factual feature description are the only differentiators.

**Forbidden strings** (CI lint): `"most popular"`, `"best value"`, `"recommended"` adjacent to tier names, `"top pick"`, `"editor's choice"`, `"#1 choice"` (also covered by AP-02 — re-listed here for pricing-page-specific scan).

**Permitted alternatives:** factual differentiation only. Sub-shape tailoring (per pricing-page §Sub-shape) reorders feature emphasis within a tier card but does not visually steer tier *selection*.

---

### MPMF-AP-20 — Competitive disparagement / "vs Competitor" comparison tables

**Pattern:** Pricing-page or marketing surface with a "vs GTO Wizard" / "vs PokerTracker" / "Why we beat [X]" / "Unlike [competitor]" feature comparison table that disparages external products; competitive ranking claims; competitor logos displayed adjacent to tier cards.

**Why refused:** red line #7 (editor's-note tone) + first-principles clarity (per pricing-page §Non-goals). Product stands on factual self-description; disparaging competitors damages trust by implying the product can't differentiate on its own merits. Also legally fraught — comparison-claim accuracy is a Q7 concern (deferred to external counsel; doctrine refuses preemptively).

**Forbidden patterns** (structural):
- No comparison tables that name external products.
- No "Why we're better than [X]" / "Unlike [X]" / "Compared to [X]" copy.
- No competitor logos in tier cards or marketing copy (even neutrally — implies association or positioning).
- No "vs" framing that compares features to named competitors.

**Forbidden strings** (CI lint): `"vs gto wizard"`, `"vs piosolver"`, `"vs pokertracker"`, `"vs holdem manager"` (any external-product disparagement), `"better than"` adjacent to product names, `"why we beat"`, `"unlike"` adjacent to product names, `"compared to"` adjacent to product names.

**Permitted alternatives:** factual self-description without comparison. "Tracks live hands with player tendencies" is factual; "Tracks better than [X]" is comparative. Competitive positioning, if needed, lives outside the product UI (e.g., in a blog post or marketing page authored under separate Q7 review) — not in pricing-page or any commerce surface.

---

### MPMF-AP-21 — Anti-patterns as A/B-test variants (meta-refusal)

**Pattern:** Setting up an A/B / multivariate experiment where one variant violates an established anti-pattern in this catalog — e.g., "test fake-countdown timer (variant A) vs no-timer (variant B)", "test 'Most Popular' badge vs no-badge", "test inflated social-proof count vs accurate count" — under the framing that doctrine compliance is one experimental option among others.

**Why refused:** red line spirit (autonomy doctrine is not a hypothesis). Anti-patterns in this catalog are categorical refusals derived from autonomy red lines + Q1=A verdict; treating any of them as a test variant is a category error. It would mean the product is willing to coerce users *if* the metrics improve. Once a refusal is established, it is binding regardless of conversion-rate signal. Per pricing-page §A/B-testing posture: "variations like 'show fake countdown timer' / 'use Most Popular badge' / 'social proof inflated counts' are categorically refused — they're anti-patterns, not test variants."

**Forbidden patterns** (structural):
- Experiment definitions in `growthbook.config` / equivalent A/B-test config that include any forbidden pattern from MPMF-AP-01 through MPMF-AP-29 as a variant arm.
- Test plans framed as "doctrine-compliant vs doctrine-violating" or "permissive vs strict copy".
- Telemetry events that distinguish "doctrine-compliant variant" from "doctrine-violating variant" — the variant comparison itself implies the violation is on the table.

**Permitted alternatives:** A/B-test variants must all be doctrine-compliant. Permitted dimensions: copy phrasing within the editor's-note register, layout variations within equal-weight constraint, sub-shape tailoring within "tailoring is invisible" rule (AP-29). Variant comparison evaluates which doctrine-compliant approach communicates best — not whether doctrine compliance is itself a variable. Per assumption-ledger M6: future A/B test of *doctrine-explicit-vs-doctrine-implicit copy* may run, but doctrine-violating arms are out of scope.

---

### MPMF-AP-22 — Runtime price modification

**Pattern:** Pricing values fetched from a remote service / feature flag / API response at runtime; in-app notification "your price went up" arriving without a new app version + PR review; existing subscribers re-priced retroactively; pricing constants modified without change-log entry.

**Why refused:** red line #2 (transparency) + #3 (durable overrides) + #4 (reversibility). User installed an app at a stated price; runtime modification violates the implicit contract at install. Runtime-pushed price changes can't be reverted by the user (red line #4) since they're remote-pushed. Compounds AP-08 (dark-pattern checkout) by surfacing surprise costs after commitment.

**Forbidden patterns** (structural):
- Pricing values cannot be fetched from a remote service at runtime. Hard-coded in `src/utils/entitlement/pricingTiers.js` constant + source-controlled.
- Price changes require a PR + version bump (semver-minor at minimum) + change-log entry referencing this anti-pattern.
- Existing subscribers grandfathered: founding-lifetime + locked-in monthly are not re-priced retroactively (per pricing-page §Founding-member terms).
- No `priceUpdated` / `newPrice` / `pricingChanged` push events from server to client that re-render with different numbers.

**Forbidden strings** (CI lint): `"price went up"`, `"new price"`, `"price update"`, `"pricing changed"` in any user-facing copy that implies retroactive change.

**Permitted alternatives:** future price changes apply to NEW subscribers only; existing users grandfathered at their original price. Pricing constant changes are PR-reviewable + change-log-trackable. If pricing must change for existing users for legal/regulatory reasons (rare), the change is announced with ≥30-day notice + opt-out via cancellation honored without penalty.

---

### MPMF-AP-23 — Animation-as-pressure on commerce surfaces

**Pattern:** Pulsing / blinking / bouncing / color-shifting / scale-pulsing animation on commerce buttons, modals, banners, badges, or indicators to draw attention. Examples: paywall modal entering with bounce/scale overshoot; trial-state-indicator chip pulsing red on cancellation grace; upgrade-prompt-inline color-shifting on render; commerce-adjacent navigation icon with red-dot ping animation.

**Why refused:** red line #5 (no engagement-pressure) + #7 (editor's-note tone). Visual pressure is the spatial analogue of timer-urgency (MPMF-AP-01) — instead of pressuring via time, pressuring via attention-stealing motion. Same coercion mechanism (forcing user attention), different vector. Per paywall-modal §Animation timing: "no bounce / scale effects (would feel coercive)." Per trial-state-indicator §Anti-patterns: "Animated chip (pulsing / blinking on grace-period activation) — refused. State change is synchronous." Per upgrade-prompt-inline §Inline-prompt-specific: "Pulsing / blinking / color-shift animation on the prompt to draw attention — refused."

**Forbidden patterns** (structural):
- No CSS animations on PaywallModal entrance beyond functional 150ms fade. No bounce / scale / overshoot effects.
- No pulsing / blinking on TrialStateIndicator state changes — chip transitions synchronously, no animation.
- No color-shift / fade-cycle animation on UpgradePromptInline rendering.
- No badge "ping" / red-dot pulse on commerce-adjacent navigation icons.
- No `@keyframes` definitions consumed by commerce components beyond functional fade-in/out (≤150ms duration; no infinite-loop animations on commerce surfaces).

**Permitted alternatives:** 150ms fade-in for modal entrance (functional, not pressure). Synchronous color/icon swaps for state changes. Static rendering for inline prompts. Loading spinners during async operations are permitted — they communicate state, not solicit attention.

---

### MPMF-AP-24 — Color-as-shame on user-choice states

**Pattern:** Red / orange / "warning" color treatment on UI representing user-initiated states — cancellation-grace chip in red, downgrade-pending plan-card in red, opted-out telemetry indicator in red, free-tier indicator in red. Color encodes the user's autonomous choice as an error or deficiency.

**Why refused:** red line #5 (no engagement-pressure) + #7 (editor's-note tone). User-initiated states are not errors. Color treatment encodes a normative judgment ("you should reverse this"), which is shame-framing in chrominance. Compounds MPMF-AP-06 (downgrade framing) into visual treatment — even if copy is neutral, red color smuggles the same message. Per trial-state-indicator §Anti-patterns: "Red color on cancellation indicator — refused. Cancellation is user choice; no shame/warning color treatment."

**Forbidden patterns** (structural):
- TrialStateIndicator cancellation-grace state uses neutral color (gray text "· Cancelling"), NOT red / orange / warning palette.
- Free-tier indicator does NOT use red / warning color — it's a state, not an error.
- Telemetry-opted-out indicator does NOT use red.
- Downgrade-pending plan-card does NOT use red.
- Reserved color domain: red is for *system-side errors* requiring user response (card decline, payment failed, network error, IDB write failed) — NOT for user-choice states.

**Forbidden visual patterns:** `bg-red-*` / `text-red-*` / `border-red-*` Tailwind classes (or equivalent CSS) on any component representing user-initiated commerce state. CI-grep target for the lint script.

**Permitted alternatives:** neutral colors (gray, slate, muted brand color) for user-choice states. Red reserved for system-side failures the user should respond to.

---

### MPMF-AP-25 — Spatial / viewport coercion on commerce surfaces

**Pattern:** Auto-scroll bringing commerce content into view (upgrade prompt scrolls itself into viewport when user scrolls past); commerce content re-renders at a different position after dismissal (prompt at top → after dismissal → reappears at bottom of next view); coachmark / tooltip with arrow auto-firing on commerce-adjacent UI ("← click here to manage billing"); commerce sticky banners that follow scroll; modal repositioning to follow user gaze / cursor.

**Why refused:** red line #5 (no engagement-pressure). Manipulating viewport / spatial position of commerce content is coercion via attention-control. User scrolled past the upgrade prompt → that's their autonomous action; re-summoning it via auto-scroll or repositioning is a reversal of an autonomous choice. Per upgrade-prompt-inline §Inline-prompt-specific: "Auto-scrolling to bring prompt into view if user scrolled past — refused. Re-rendering at different position after dismissal — refused."

**Forbidden patterns** (structural):
- No `scrollIntoView()` invocations on commerce content unless user-initiated (user tapped "Show plans" → scroll to pricing section: permitted; system auto-scrolls user back to upgrade prompt they passed: refused).
- No re-rendering at different position after dismissal — content gone for cooldown duration; doesn't move.
- No coachmark / tooltip / arrow auto-firing on commerce-adjacent UI elements (TrialStateIndicator chip, BillingSettings, etc.).
- No sticky scroll-following commerce banners.
- No background-color / border-flash changes during scroll to draw attention to commerce content.

**Permitted alternatives:** static rendering at one position; gone-during-cooldown means gone; re-discovery is via natural navigation (Settings → Billing → View plans, or trial-state-indicator chip tap) only. User-initiated scroll-to-section (e.g., anchor link from CTA) is permitted.

---

### MPMF-AP-26 — Confirm-dismissal sub-prompt on commerce dismissals

**Pattern:** Tapping `✕` or `"Dismiss"` / `"Keep free"` on a commerce surface triggers a confirmation sub-prompt — "Are you sure you want to skip the upgrade?" / "You'll lose your trial!" / "Sure you don't want plans?" — interposed between the dismissal action and its execution.

**Why refused:** red line #5 (no engagement-pressure) + #7 (editor's-note tone) + MPMF-AP-05 spirit extended to dismissal direction. User said no by tapping dismiss; questioning that decision is coercion. Distinct from MPMF-AP-05 — AP-05 covers cancellation flows (billing); AP-26 covers any commerce-surface dismissal (paywall modal, upgrade prompt, trial banner, pricing-page exit). Per upgrade-prompt-inline §Inline-prompt-specific: "Confirm dismissal sub-prompt on ✕ tap (single-tap dismiss; trust the user) — refused."

**Forbidden patterns** (structural):
- `✕` / `"Keep free"` / `"Dismiss"` / `"Close"` buttons on commerce surfaces fire dismissal directly. No "Are you sure?" interposition.
- No "exit-intent" detection that triggers a follow-up modal asking the user to reconsider.
- No "before you go..." copy on dismissal hover/blur.
- Single-tap dismissal — trust the user's first action.

**Forbidden strings** (CI lint): `"are you sure"` adjacent to dismissal/skip/upgrade copy, `"don't miss"` in dismissal sub-prompts, `"think again"`, `"reconsider"`, `"sure you want to"`, `"before you go"`, `"wait!"` in dismissal context.

**Permitted alternatives:** dismissal is dismissal. Cooldown (H-N07 7-day per surface × trigger) prevents re-prompt; user's "no" is honored without interposition. Toast confirmation of the dismissal action is permitted but optional ("Kept on free tier" — factual, not coercive).

---

### MPMF-AP-27 — Hard-to-find Cancel button (depth-of-burial)

**Pattern:** Cancel-subscription action buried 3+ taps from any reasonable starting point — Settings → Account → Subscription → Plan Details → Manage → Cancel. Or behind paragraphs of policy text. Or in a "danger zone" sub-section requiring scroll/disclosure. Or styled with reduced visual weight relative to upgrade/retention CTAs. Any architecture that makes cancellation harder to discover than the upgrade path.

**Why refused:** red line #10 (no dark-pattern cancellation) + autonomy spirit. Cancellation depth-of-burial is structural friction — even without retention copy or interposed modals (MPMF-AP-05), users who can't *find* Cancel are de facto trapped. SA-74 JTBD specifies the ≤2-tap rule from Settings nav. Per billing-settings §Anti-patterns: "Cancel-button-hard-to-find anti-pattern. Refused: Cancel is in Actions section at equal visual weight, NOT hidden behind 3+ taps."

**Forbidden patterns** (structural):
- Cancel button in BillingSettings Actions section at top-level (not inside a sub-section behind disclosure / accordion / "Advanced" gate).
- Tap-count rule binding: Settings nav → BillingSettings → Cancel = 2 taps; modal confirm = 3rd tap to commit. ≤2-tap discovery rule from any reasonable starting point.
- Cancel button at equal visual weight to other Actions (View plans / Export — same size, same prominence per BillingActionRow contract).
- No "danger zone" / "advanced" / "subscription management" sub-section burial.
- Cancel discoverable from trial-state-indicator chip route (chip → BillingSettings → Cancel = 3 taps from anywhere; 2 taps from Settings nav — both within rule).
- Cancel link present on pricing-page footer + BillingSettings (multiple discoverable paths).

**Permitted alternatives:** cancellation flat in actions section; navigable from indicator chip; equal weight; clear factual label `"Cancel [tier]"` or `"Cancel subscription"`. Test target: MPMF-G5-RL #10 tap-count assertion suite.

---

### MPMF-AP-28 — Post-conversion celebration / engagement-pressure on upgrade

**Pattern:** After a user converts (free → paid, plan-change upgrade, founding-lifetime purchase), the system surfaces a celebration banner / confetti animation / `"Welcome to Plus!"` toast / `"You're now a Pro!"` full-screen takeover / `"Tell your friends!"` share-prompt / `"Rate the app now that you're upgraded"` review-solicitation.

**Why refused:** red line #5 (no engagement-pressure) + #7 (editor's-note tone). Celebration framing reframes a transactional decision as an emotional achievement, which is engagement-pressure post-conversion. User paid for a product feature, not for emotional validation. Also: celebration sets up the inverse pressure on cancellation ("you'll lose your achievement / streak / status") — banking on emotional investment to suppress later autonomous exit. Per upgrade-prompt-inline §Key interactions: "No 'Thanks for upgrading!' banner replaces it (refused as engagement-pressure)."

**Forbidden patterns** (structural):
- No celebration banner / toast / takeover after successful payment.
- No confetti / particle / animation effects on tier upgrade.
- Tier upgrade UI updates synchronously: chip changes from "Free" to "Plus", BillingSettings reflects new state. Done.
- No "share with friends" / "tell us why you upgraded" / "rate the app now that you're Plus" prompts in the conversion afterglow.
- No re-engagement push notification or transactional email beyond the receipt: payment confirmation receipt is permitted (factual); "welcome to the family!" follow-up email is refused.

**Forbidden strings** (CI lint): `"thanks for upgrading"`, `"welcome to plus"`, `"welcome to pro"`, `"you're now"` adjacent to tier names, `"congrats"`, `"share with"`, `"tell your friends"`, `"high five"`, `"you did it"`, exclamation-marks in tier-confirmation copy.

**Permitted alternatives:** factual confirmation only — "Plus subscription active. Next charge: $17 on [date]." Receipt email arrives transactionally with itemized charge. UI reflects new tier without celebration. If user explicitly seeks acknowledgment ("share my upgrade"), they can — but the system never solicits it.

---

### MPMF-AP-29 — Surveillance disclosure in tailoring copy

**Pattern:** Copy that reveals the system's per-user tailoring inference — `"We see you're a live player — here's the live-tracking pitch!"` / `"Based on your usage, you might want Pro"` / `"We noticed you opened the app 3 times this week"` / `"Since you've been studying postflop, try Pro for solver views"` — surfacing the surveillance/inference layer to the user.

**Why refused:** red line #1 (opt-in enrollment for data collection) + #9 (incognito observation mode). Telemetry consent is a user-controlled boundary; copy that reveals what the system has inferred *about* the user is a violation of the spirit of consent — even if the data was collected with consent, surfacing the inference creates a different kind of exposure that wasn't part of the original consent. Surveillance-disclosure copy creates the perception of being watched, which is autonomy-corroding regardless of opt-in state. Per pricing-page §Sub-shape: "Sub-shape tailoring is invisible to user. No 'We see you're a live player — here's the Pro tier!' copy. Tailoring is gentle feature-ordering only." Per upgrade-prompt-inline §Known behavior: "Sub-shape tailoring is invisible to user. No 'We see you're a live player — here's the live-tracking pitch!' copy."

**Forbidden patterns** (structural):
- Sub-shape tailoring (pricing-page + upgrade-prompt + paywall-modal + trial-indicator) is INVISIBLE in copy. User sees one tailored variant; never sees the inference behind the choice.
- No `"we noticed"`, `"we see"`, `"based on your"`, `"since you've been"`, `"your usage shows"` copy in any commerce surface.
- A/B-test bucket assignment is not disclosed to users via copy.
- No explanatory text stating which telemetry signals were used to choose the surface variant.
- Telemetry events for tailoring (sub-shape inference, segment classification) respect consent gate per CC-88 — and even with consent, the *output* of inference doesn't appear in user-facing commerce copy.

**Forbidden strings** (CI lint): `"we see you"`, `"we noticed"`, `"based on your"`, `"since you've"`, `"your usage"`, `"we observed"`, `"you've been"`, `"we know you"`, `"because you"`.

**Permitted alternatives:** tailoring exists internally; user sees the resulting copy without disclosure of *why* that variant was chosen. If user explicitly asks ("why is the app showing me this?"), they navigate to Settings → Telemetry to see what's collected and inferred — commerce surfaces never proactively explain inference. Release notes (out-of-app) may describe tailoring behavior in aggregate, never per-user.

---

## Copy-discipline enforcement

Under Q1=A verdict, Gate 4 ships CI-linted forbidden-copy-strings check (mirrors EAL `scripts/check-anchor-writers.sh` pattern):

- `scripts/check-commerce-copy.cjs` (new at Gate 5 per MPMF-G5-CL backlog row).
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

Monetization & PMF's 29 anti-patterns are commerce-UX-specific but inherit from the same 9 autonomy red lines established in `chris-live-player.md` § Autonomy constraint. The 10th commerce red line (no dark-pattern cancellation) is new here. Catalog grew from 12 (Batch 1, Session 3b) → 14 (Batch 2) → 16 (Batch 3) → 29 (Batch 4, SPR-050) as surface specs revealed additional refusals.

---

## Change log

- 2026-04-24 — Created Session 3b. 12 anti-patterns authored matching the 12 enumerated in Gate 2 audit §Stage E. Each includes forbidden-string patterns for CI-lint + permitted alternatives + red-line citation. Anchored by Q1=A verdict at Gate 3 owner interview. Will be expanded at Gate 4 as surface specs reveal additional refusals.
- 2026-04-24 (Gate 4 Batch 2) — Added **MPMF-AP-13** (telemetry-consent-nag — re-prompting opt-outs; re-firing consent panel; consent-update-badges) + **MPMF-AP-14** (onboarding-lock-in — forced tutorials; hidden Skip; progress-bar pressure; auto-firing tour on re-launch). Surfaced during authoring of `surfaces/telemetry-consent-panel.md` (MPMF-G4-S6) + `journeys/evaluator-onboarding.md` (MPMF-G4-J1). Both inherit red line #1 (opt-in enrollment) + #5 (no engagement-pressure). Refusal count now 14 (from 12 at stub).
- 2026-04-24 (Gate 4 Batch 3) — Added **MPMF-AP-15** (silent-plan-change-on-cancellation — cancellation flow pre-selecting pause/switch as default; conflating cancel intent with plan-change; UI elements that submit either action ambiguously) + **MPMF-AP-16** (deceptive-proration-display — hiding prorated charge amount; "save $X" framing on downgrade without refund clarification; opaque proration math). Surfaced during authoring of `journeys/cancellation.md` (MPMF-G4-J3) + `journeys/plan-change.md` (MPMF-G4-J4). Both inherit red line #2 (transparency) + #10 (no dark-pattern cancellation) + reinforce MPMF-AP-05 + MPMF-AP-06 + MPMF-AP-08. Refusal count now 16 (from 14 after Batch 2).
- 2026-05-08 (Gate 4 Batch 4 — WS-028 / SPR-050) — Added **13 net-new refusals (MPMF-AP-17 through MPMF-AP-29)**, mined from the 6 remaining Gate 4 surface specs + paywall-hit journey. Founder decisions ratified at sprint composition: scope = all 6 unmined surfaces; organization = continue flat MPMF-AP-NN sequence; coverage = autonomy + tone red lines (legal jargon refusals deferred until Q7 external-counsel session resolves; cross-feature PIO/SCF refusals deferred). New entries by source surface:
  - **paywall-modal.md** → AP-17 ("Maybe later" pressure-button), AP-18 (pre-focused/pre-selected primary commerce CTA).
  - **pricing-page.md** → AP-19 (editorial choice-steering badges), AP-20 (competitive disparagement / vs-tables), AP-21 (anti-patterns as A/B-test variants — meta-refusal), AP-22 (runtime price modification).
  - **paywall-modal.md + trial-state-indicator.md + upgrade-prompt-inline.md** (cross-cutting) → AP-23 (animation-as-pressure).
  - **trial-state-indicator.md** → AP-24 (color-as-shame on user-choice states).
  - **upgrade-prompt-inline.md** → AP-25 (spatial/viewport coercion — auto-scroll, repositioning, coachmark, sticky-banner), AP-26 (confirm-dismissal sub-prompt on commerce dismissals), AP-28 (post-conversion celebration / engagement-pressure on upgrade), AP-29 (surveillance disclosure in tailoring copy).
  - **billing-settings.md** → AP-27 (hard-to-find Cancel / depth-of-burial — extends red line #10 into surface architecture).
  - All 13 inherit from existing 9 autonomy red lines + the 10th commerce red line; all bind under Q1=A verdict. Refusal count now 29 (from 16 after Batch 3). Header updated. Each entry includes Pattern + Why refused + Forbidden strings/patterns + Permitted alternatives sections per established structure. Each entry cross-references the surface spec inline that surfaced it. Co-located WS-035 (CI-linted forbidden-copy-strings check) consumes the new forbidden-string lists in a follow-up sprint.
