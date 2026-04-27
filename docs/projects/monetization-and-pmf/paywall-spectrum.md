# Paywall Spectrum — Full Option Space

**Project:** Monetization & PMF
**Author:** Session 1, 2026-04-24
**Purpose:** Enumerate the full spectrum of paywall / trial / messaging / CTA design choices so the owner can pick a bundle (not individual knobs) with eyes open. Every option ranked on (a) conversion efficiency (industry benchmarks where available), (b) doctrine compliance (9 autonomy red lines from `chris-live-player.md` §Autonomy constraint), (c) poker-domain fit.

---

## How to read this doc

This is not a recommendation. It is an option catalog with tradeoffs.

**Resolve these owner verdicts first** (listed in charter §Gate 3):
- **Q1 — Doctrine scope**: do the 9 red lines apply to commerce UX? (A/B/C)
- **Q5 — Free-tier shape**: session-scoped vs. usage-quota vs. feature-subset? (A/B/C)

Once Q1 and Q5 are verdicted, this doc compresses from ~40 options to ~8 compatible option bundles.

---

## Dimension 1 — Paywall location (WHEN does the user encounter it)

The paywall is placed at one or more of these trigger points. Stronger conversion correlates with placement at the *felt-value* moment (per Maxio 2026 SaaS best practices). Each option's doctrine compliance varies.

| # | Location | Conversion signal | Doctrine compliance | Fit for this app |
|---|---|---|---|---|
| L1 | **First-launch paywall** (registration wall before app usable) | Highest visitor-to-paid for B2B SaaS; lowest for consumer freemium | ❌ Fails red line #1 spirit (opt-in-only) — gates even *trying* the product | **Disqualified**. Conflicts with "try before you pay" (SA-71). |
| L2 | **Feature-first-open paywall** (user opens feature X for first time; modal intercepts) | Moderate; user has felt some value from other features before being gated | ⚠️ Requires editor's-note copy to comply with #7 | Good fit if the *gated feature* is demonstrably higher-tier (e.g., multi-session villain analysis). |
| L3 | **Usage-threshold paywall** (user hits limit — 50 hands / 10 drills / 3 villain profiles; modal on attempt to exceed) | **Highest** per Maxio (2.5× time-based); aligns with "sense of loss" moment | ⚠️ Borderline on #5 if framing = "you're out!" Safe if framing = "you've used X; unlock unlimited" | **Strong fit.** Poker players quantify things naturally. |
| L4 | **History-access paywall** (free tier keeps current session; paywall on opening prior session) | Moderate–high; ties to the Chris persona's goal of cross-session villain tracking | ✅ Clean — no mid-session friction, no timer, no coercion | **Strongest fit** per Session 1 roundtable recommendation. |
| L5 | **Export/share paywall** (user can analyze but not export; paywall on export) | Low–moderate for this category; export is less valued in live play than in online | ✅ Clean | Weak fit for live players; stronger for Scholar. |
| L6 | **Depth-of-analysis paywall** (free = top-line; paid = deep-dive game tree + exploit anchors) | Moderate; requires user to know what they're missing | ⚠️ Risks red line #6 spirit ("here's what you're missing!" framing can feel adversarial) | Viable if copy is editor's-note tone. |
| L7 | **Time-based trial end paywall** (7/14/30 days; timer modal on trial end) | Low per Maxio (time-based 2.5× worse); creates urgency that compounds | ❌ Directly conflicts with red line #5 (engagement pressure via countdown) | **Disqualified under Q1=A.** Viable only under Q1=B/C. |
| L8 | **Renewal paywall** (post-payment, trial converts to paid auto or prompts) | Standard; compliance depends on cancellation friction (Q2-SA-74 JTBD) | ✅ Clean if cancel is 2-tap; ❌ if dark-pattern | **Required** regardless of other choices; paywall UX at renewal is its own journey. |
| L9 | **Upsell paywall** (already-paying user hit tier ceiling; modal offers next tier up) | Moderate; softer than cold-paywall because user has trust | ✅ Cleanest — the user has already converted once | **Required** if multi-tier. |

**Common bundles:**
- **"History + usage"** = L3 + L4 + L8 + L9 — the recommended bundle for doctrine-compliant monetization under Q1=A.
- **"Feature + time"** = L2 + L7 + L8 — conventional freemium; works but requires Q1=B/C to ship.
- **"Depth + history"** = L4 + L6 + L8 + L9 — scholarly/analytical positioning.

---

## Dimension 2 — Trial length + mechanism

The user asked about "full spectrum of trial length." Here is the spectrum, ordered by increasing commitment:

| # | Mechanism | Length / shape | Conversion | Doctrine | Fit |
|---|---|---|---|---|---|
| T1 | **No trial — free tier indefinite** | ∞; free features always available | Moderate visitor-to-free; low free-to-paid (needs felt-loss trigger) | ✅ Strongest compliance — no timer, no expiration | **Recommended default** under Q1=A. Aligns with L3/L4 paywall style. |
| T2 | **Session-scoped trial** (current session has full features; next session downgrades to free) | 1 live session at full tier; after close, history-gated | High value-delivery in session; moderate conversion at close | ✅ No explicit timer; gate = natural session boundary | Very strong for live players — session is the natural unit. |
| T3 | **Hand-quota trial** (first 50 hands full features; afterward gated) | Progress-bar-style; user sees remaining | High loss-aversion at quota exhaustion | ⚠️ Depends on mid-hand UX — if exhaustion triggers mid-hand, conflicts with #5 | Good if quota is *session-reset aware* (never exhausts mid-hand). |
| T4 | **Feature-limit trial** (full features but capped — 3 villain profiles saved, not unlimited) | Permanent cap, not expiring | Low–moderate; user never feels "trial ended," just "can't do X" | ✅ No timer; cap = quantitative limit | Strong for Scholar; weaker for Chris (who wants unlimited villain profiles). |
| T5 | **7-day trial** (full app; timer) | 7 days | Low–moderate for consumer; high for B2B | ❌ Under Q1=A (timer = engagement pressure) | Disqualified unless Q1=B/C. |
| T6 | **14-day trial** (full app; timer) | 14 days | Industry default; moderate | ❌ Under Q1=A | Disqualified unless Q1=B/C. |
| T7 | **30-day trial** (full app; timer) | 30 days | Moderate; enough to form habit | ❌ Under Q1=A; ⚠️ under Q1=B (long trial is less urgency) | Viable under Q1=B. |
| T8 | **Pay-what-you-want / $1 trial** (nominal commit) | 30 days for $1 | High conversion (sunk cost + trust) | ⚠️ Payment-required up front | Stronger if Q2=B (founding-member angle). |
| T9 | **Founding-member lifetime** ($299 one-time, first 50) | Lifetime at locked price | High for evangelists; caps LTV pool | ✅ Transactional, not engagement-coercive | **Recommended Session 1 roundtable seeding mechanism.** |

**Common bundles:**
- **"Always free + session-scoped full"** = T1 + T2 — doctrine-clean freemium with session-level value demonstration.
- **"Hand quota + no timer"** = T1 + T3 — quota-as-gate with no expiration pressure.
- **"Founding lifetime + indefinite free tier"** = T1 + T9 — recommended Session 1 candidate.
- **"14-day full + auto-convert"** = T6 + L7 + L8 — conventional SaaS; requires Q1 = B/C.

---

## Dimension 3 — "Limited use" patterns (user's explicit ask)

The user's prompt said: "this might be a restriction of certain high value items to limited use only. Enough to get value out of what they are looking for, and see the quality we provide, and then get hit with the 'use this all the time?'"

This is the *limited-use* gate pattern. Options:

| # | Gate | User experiences | Conversion leverage | Doctrine | Example |
|---|---|---|---|---|---|
| U1 | **N uses per session** | "You've used deep analysis 3 times this session; 2 remaining in free tier" | Moderate; per-session reset is forgiving | ✅ Resets each session; no accumulating pressure | Deep game-tree analysis: 3/session free, unlimited paid. |
| U2 | **N uses per month** | "You've used deep analysis 47/50 this month" | High at threshold; moderate otherwise | ⚠️ Counter-as-visible = mild pressure; acceptable under #5 if not animated/urgent | Multi-session villain analysis: 50/mo free. |
| U3 | **N uses per lifetime** | "You've used deep analysis 98/100 (forever)" | High at threshold; permanent-loss framing | ⚠️ More aggressive; borderline with #5 | Weaker fit; penalizes long-term free users who may convert later. |
| U4 | **N saved artifacts** | "3/3 villain profiles saved; add more with Pro" | Moderate; loss-aversion on attempted-add | ✅ Clean — the limit is on *saved state*, not on usage | Scholar: 3 drill sets saved free; unlimited paid. |
| U5 | **N days of history** | "Sessions older than 7 days require Plus" | Moderate; aligns with history-gate L4 | ✅ Clean — history-depth is the canonical doctrine-safe gate | Free: last 7 days; Plus: unlimited history. |
| U6 | **Quality-of-analysis tiered** | Free shows top-line; paid shows game-tree + EV-decomposition | Moderate — requires user to *know* they want more depth | ⚠️ "Upgrade for deeper insight" must avoid judgment tone | Exploit engine: top recommendation free; confidence intervals + depth paid. |
| U7 | **Latency-tiered** | Free = immediate live advice; paid = live + post-hand replay + calibration | Moderate; paid adds post-hand analysis | ✅ Clean — no degradation of the free experience | Replay hand feature = paid; live recs = free. |

**User's specific idea ("deep analysis of a villain reserved / limited X hands / don't let them accumulate sessions on top of each other as a trial"):**

This combines U1 + U5. **U1** caps deep-analysis uses per session; **U5** caps history depth so multiple sessions don't silently accumulate into a de-facto free-forever tier. Both are doctrine-clean.

**Proposed free-tier limited-use bundle** (for paywall-spectrum candidate later):
- Unlimited hand entry (no cap — core JTBD DS-42 et al.)
- Unlimited end-of-session recap (no cap — the "wow" moment)
- **3 deep-analysis actions per session** (U1) — teaser density for game tree + exploit anchors
- **1 session of history** (U5) — session-scoped; each new session replaces prior in free tier
- **1 villain profile tracked across sessions** (U4 = 1 saved slot) — the "one villain you really want to crack" hook

---

## Dimension 4 — CTA / upgrade-prompt copy spectrum

The user asked: "then get hit with the 'use this all the time? Free users limited to ____. CTA'"

Here is the copy-register spectrum. Lower rows = more doctrine-compliant.

| # | Tone | Example | Conversion | Doctrine |
|---|---|---|---|---|
| C1 | **Urgency / scarcity** | "Last 3 hours to unlock Pro — 40% off today!" | Highest | ❌ Red line #5 direct violation |
| C2 | **Loss-framing / guilt** | "Don't lose this analysis — upgrade to save" | High | ❌ Red line #5 + #7 |
| C3 | **Social pressure** | "Join 2,400 pros using Pro" | Moderate–high | ❌ Red line #5 (social pressure is a form of coercion) |
| C4 | **Feature-lock standard** | "Upgrade to Pro to unlock deep analysis on every hand" | Moderate | ⚠️ Acceptable if #7 editor's-note (factual, not cajoling) |
| C5 | **Quantitative / factual** | "Free tier: 3 deep analyses per session. Plus: unlimited. $19/mo." | Moderate | ✅ Clean — states facts, no persuasion |
| C6 | **Editor's-note / opt-in ask** | "If you'd like to use deep analysis on every hand, Plus removes the session limit. $19/mo. No pressure; you can keep your current plan indefinitely." | Low–moderate | ✅ Highest compliance; explicit "no pressure" |
| C7 | **Silent gate** | "(deep analysis grayed out; tap for info → quiet explainer with tier link)" | Lowest | ✅ Cleanest — zero language-level pressure |

**Doctrine-compliant copy exemplar (for Q1=A bundles):**

```
Free tier: 3 deep analyses per session.

You've used 3 of 3. Deep analysis unlocks on every hand with Plus.

[ View plans ]   [ Keep free ]
```

- Factual (C5), not C1/C2/C3.
- "Keep free" button equal visual weight (no dark-pattern de-emphasis).
- No countdown, no scarcity.
- No pluralized "join X others."

**Copy anti-patterns (forbidden under Q1=A, mirror `anti-patterns.md` from EAL):**
- "Don't miss out" / "Last chance" / "Today only"
- "X players have already upgraded this week"
- "Your free trial ends in 3 days" (timer itself is the violation)
- "Downgrade" framing on cancellation (cancellation = cancellation; do not rename it to soften)
- Any copy ladder where "Keep free" is visually subordinate to "Upgrade"

---

## Dimension 5 — Messaging themes (brand positioning for the commerce layer)

How the product *talks about* being paid matters. Three themes exist on a spectrum:

| # | Theme | Example tagline | Fit | Doctrine |
|---|---|---|---|---|
| M1 | **Radical honesty** | "No streaks. No guilt. Cancel in two taps." | Strong differentiator against GTO Wizard + Upswing | ✅ Leverages red lines as positioning wedge |
| M2 | **EV-framing** | "Recover one bb/hour in misreads per session." | Strong for Chris persona — poker players respect EV | ✅ Clean; factual |
| M3 | **Mastery / journey** | "Become the player you're training to be." | Strong for Scholar persona | ⚠️ Edge of red line #5 if crossed into "streak maintenance" tone |
| M4 | **Authority / GTO credibility** | "Built on the same math as solvers, surfaced at the table." | Moderate; requires engineering to back up | ✅ Factual |
| M5 | **Community / tribe** | "Join 2,400 live-game grinders…" | Moderate; conversion-friendly | ❌ Red line #5 (social pressure); also false until community exists |

**Recommended bundle (Q1=A):** M1 + M2 primary; M3 as subtext for Scholar-tier marketing specifically; M4 supporting; M5 disqualified.

---

## Dimension 6 — Free-tier shape options (Q5 reprise)

Re-listing for reference. Full details in charter §Q5.

- **Q5-A — Session-scoped free.** Unlimited hand entry + single-session analysis; no cross-session persistence. (Session 1 roundtable recommendation.)
- **Q5-B — Hand-quota free.** 50 hands/mo, 3 villain profiles, 5 drills. (Industry-standard but conflicts with #5 if mid-session.)
- **Q5-C — Feature-subset free.** Free forever for entry + recap; everything else paid. (Cleanest but lowest conversion pressure.)

---

## Compatibility matrix — which options bundle cleanly

This matrix enforces "don't mix-and-match incompatible options." Rows = location, columns = trial mechanism; cells = doctrine-compatible under Q1=A/B/C.

| L \ T | T1 (no trial, indefinite free) | T2 (session-scoped) | T3 (hand quota) | T5–T7 (timer trials) | T9 (founding lifetime) |
|---|---|---|---|---|---|
| **L3 (usage-threshold)** | ✅ Q1=A/B/C | ✅ Q1=A/B/C | ✅ Q1=A/B/C (with session-reset) | ❌ Q1=A; ⚠️ Q1=B/C | ✅ (founding bypasses) |
| **L4 (history-access)** | ✅ Q1=A/B/C | ✅ Q1=A/B/C | ✅ Q1=A/B/C | ❌ Q1=A | ✅ |
| **L6 (depth-of-analysis)** | ✅ Q1=A/B/C | ✅ Q1=A/B/C | ✅ Q1=A/B/C | ❌ Q1=A | ✅ |
| **L7 (time-trial end)** | — (contradicts T1) | — (contradicts T2) | — | ✅ Q1=B/C only | — |
| **L8 (renewal)** | — (N/A) | — (N/A) | — (N/A) | ✅ All | ✅ (for founding → renewal if they elect to continue post-lifetime) |
| **L9 (upsell tier-to-tier)** | ✅ Q1=A/B/C | ✅ Q1=A/B/C | ✅ Q1=A/B/C | ✅ Q1=B/C | ✅ |

---

## 5 compatible bundles (Session 1 candidates — owner picks at Gate 3)

### Bundle α — "Doctrine-clean + session-scoped" (recommended under Q1=A)
- **Paywall locations:** L3 + L4 + L8 + L9
- **Trial mechanism:** T1 + T2 + T9 (founding lifetime seed)
- **Limited-use pattern:** U1 (3 deep analyses/session) + U4 (1 villain saved) + U5 (1 session history)
- **CTA register:** C5 / C6
- **Messaging theme:** M1 + M2
- **Doctrine cost:** Zero — all red lines respected.
- **Conversion cost:** Moderate. Loses the 2.5× bump from urgency/timer triggers. Founding-member lifetime + felt-loss at session close compensate partially.
- **Fit:** Recommended Session 1 roundtable alignment. Best fit for Chris persona.

### Bundle β — "Conventional freemium" (requires Q1=B/C)
- **Paywall locations:** L2 + L7 + L8
- **Trial mechanism:** T6 (14-day full trial)
- **Limited-use pattern:** post-trial → U1 + U4 + U5 + U6 enforced
- **CTA register:** C4 mostly, C1/C2 for renewal reminders if Q1=C
- **Messaging theme:** M2 + M3 + M5
- **Doctrine cost:** Fails red line #5 at trial-end and renewal. Acceptable only if Q1 verdicts B or C.
- **Conversion cost:** Highest industry benchmark.
- **Fit:** Standard SaaS; conflicts with positioning differentiator (M1).

### Bundle γ — "Scholar-leaning learning ladder"
- **Paywall locations:** L4 + L6 + L8 + L9
- **Trial mechanism:** T1 + T4 (feature-limit cap)
- **Limited-use pattern:** U4 (drill sets, charts, saved ranges) + U6 (depth-of-analysis)
- **CTA register:** C4 + C6
- **Messaging theme:** M3 + M4 (mastery + GTO-credibility)
- **Doctrine cost:** Low — M3 edge case acceptable if framed "continue at your own pace" (not streak-coerced).
- **Conversion cost:** Moderate. Scholar segment is well-understood commercially (GTO Wizard / Upswing precedent).
- **Fit:** Strong for Scholar-as-distinct-market (Q6=A).

### Bundle δ — "Founding-member + indefinite free"
- **Paywall locations:** L9 only (founding-member upsell path if they ever choose to leave lifetime)
- **Trial mechanism:** T1 + T9 (lifetime for 50)
- **Limited-use pattern:** for non-founding users: U1 + U4 + U5
- **CTA register:** C6 (editor's-note, opt-in)
- **Messaging theme:** M1 + M2
- **Doctrine cost:** Zero.
- **Conversion cost:** Tiny founding cohort + soft conversion pressure = slow monetization. Best if Q2=B and the owner values direct-feedback signal > revenue velocity.
- **Fit:** Recommended Session 1 seeding mechanism.

### Bundle ε — "Ignition SKU separate commercial lane"
- **Paywall locations:** L2 (first-open of Ignition side panel) + L9 (upsell from main-app Pro)
- **Trial mechanism:** T2 (session-scoped — one online session fully HUD-enabled, then gated) + T4 for feature cap
- **Limited-use pattern:** U1 at online-session scope + U4 for saved profiles
- **CTA register:** C5 / C6
- **Messaging theme:** M2 + M4 (online-specific EV framing)
- **Doctrine cost:** Zero.
- **Conversion cost:** Expected premium pricing ($69–99/mo) + small audience + competitive pressure from Hand2Note ($49/mo).
- **Fit:** Separate SKU. Only ships if Q3=A or Q3=B.

---

## Cancellation flow (mandatory for any bundle)

Cancellation UX is a standalone JTBD (SA-74 proposed) and a doctrine-critical surface. Rules:

1. **≤ 2 taps to cancel.** Settings → Billing → Cancel → Confirm.
2. **No retention dark patterns.** Exit survey is *optional*; "downgrade to free" / "pause instead" are *offered, not interposed*.
3. **Cancellation copy is editor's-note (C6):** "Cancel Plus. You'll keep access through [date]. You can come back any time — your account and data are preserved."
4. **No guilt trip.** No "Are you sure? You'll lose all your…" modals unless strictly accurate and informational.
5. **Post-cancel state is honored.** If user cancels, the app downgrades to free on renewal date; until then, no degraded experience, no upsell banners.
6. **Data retention policy explicit.** Cancelled users keep data (local IDB); app does not server-side delete unless user explicitly asks via separate action.

**This is a `journeys/cancellation.md` at Gate 4.** Its compliance bar is high because cancellation is where dark patterns cluster industrywide and where red line #5 (engagement-pressure) + #7 (editor's-note) have the strongest practical bite.

---

## Hidden-cost audit — what could go wrong

Doctrine-compliant bundles (α, δ) have lower conversion ceilings than conventional bundles (β). Trade-offs to acknowledge:

1. **Lower conversion** — accept or mitigate via M1 positioning (the "no guilt" wedge becomes the marketing asset).
2. **Slower LTV build** — founding-member lifetime at $299 permanently caps those 50 accounts' revenue. Mitigate: strict cap + clear scarcity (transactional, not engagement-coercive).
3. **Harder to A/B-test** — without urgency triggers, conversion experiments have lower statistical power per user. Mitigate: longer soak periods, bigger cohorts, richer telemetry via PostHog.
4. **Marketing copy is narrower** — can't use "act now" lines on landing page or ads. Mitigate: M1 + M2 are novel positions (many poker competitors use C1/C3); this is a differentiator.
5. **Renewal retention without reminders** — under Q1=A, "your card will be charged tomorrow" emails must be editor's-note, not salesy. Industry default dark patterns increase retention 10–30%; forgoing them costs retention. Mitigate: high product value + low churn rate via focus on LTV-driving features over acquisition.

---

## Recommended next actions

1. **Owner reads this doc + charter + `market-research.md` + the 3 new personas.**
2. **Owner verdicts Q1 (doctrine scope) + Q5 (free-tier shape) + Q2 (sequencing) + Q3 (Ignition timing) + Q4 (founding mechanism) + Q6 (Scholar fork) + Q7 (legal/ToS) + Q8 (telemetry consent).** These 8 verdicts converge the 40-option space to an actionable bundle.
3. **Gate 2 roundtable session** — run 5-stage blind-spot audit on the recommended bundle, with specific attention to Stage C (situational stress — can trial-first-session persona survive the paywall at each location?) and Stage E (heuristic pre-check on CTA copy).
4. **Gate 3 — author the 7 JTBDs and the `gate3-owner-interview.md` verdict doc.**
5. **Parallel: Stream D starts** (install PostHog pending Q8 verdict; begin 30-day observation window).
6. **Gate 4 surface spec session** — author 6 surfaces + 3 journeys.
7. **Gate 5 implementation** — entitlement reducer + Stripe + paywall component + trial-state indicator.
8. **Stream E — founding-member outreach** once Gate 5 basics + Stream D Phase 1 both ready.

---

## Change log

- 2026-04-24 — Session 1. Full option catalog + 5 compatible bundles + compatibility matrix + cancellation rules + hidden-cost audit.
