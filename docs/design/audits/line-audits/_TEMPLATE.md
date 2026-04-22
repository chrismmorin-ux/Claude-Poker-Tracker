# Line Audit — [YYYY-MM-DD] — [line-id]

**Line:** `[line-id]` — [title]
**File:** `src/utils/postflopDrillContent/lines.js` (lines [start]–[end])
**Auditor:** Claude (main) + poker-theory persona
**Method:** Node-by-node expert walkthrough vs POKER_THEORY.md, pop/solver baselines, and live-exploit consensus.
**Status:** Draft / Review / Closed

---

## Executive summary

3–5 sentences. Accuracy verdict (GREEN / YELLOW / RED), total findings, severity mix, top theme (e.g., "villain action rates are solver-lean, ignore live-pool priors" or "rationale copy assumes student has read the line-1 framework notes"). Plain English — the owner reads this first.

---

## Scope

- **Nodes audited:** [N] total ([M] decision + [K] terminal)
- **Frameworks referenced by this line:** [framework-ids]
- **Heroes:** [position] [action] vs [villain-position] [villain-action], effStack [X]bb, pot type [SRP/3BP/4BP/MW], board class [dry/wet/paired/monotone]
- **Out of scope:** engine EV values (covered by `engineAuthoredDrift.test.js` RT-108); UI rendering (covered by component tests).

---

## Lens — what a poker expert checks at every node

For each node, auditor evaluates the **seven** dimensions below. Findings below are anchored to the dimension(s) they fail.

1. **Setup realism** — Position/action/vs tuple + effStack + board class match how this spot actually occurs at the declared stake. Is this a spot a real student will face, or a contrived teaching fabrication?
2. **Villain action realism** — The villain action declared at this node (donk / cbet / check-raise / barrel / check-back) occurs at a frequency the pop or solver supports. Not just "possible" — *common enough to study*.
3. **`correct` flag accuracy** — For every branch, the `correct` (or `correctByArchetype`) flag matches the theoretical + exploit-adjusted answer. If archetype matters, `correctByArchetype` is declared; if it doesn't, flat `correct` is fine. Flag disagreements with explicit reasoning.
4. **Framework citation quality** — Each node cites the *right* frameworks for the texture/SPR/pot-type. Not too many (dilutes signal), not the wrong ones (confuses the student), no missing frameworks that would change the answer.
5. **Copy — prompt + rationale + section text**
   - Prompt: answerable from information on-screen; not a trick question.
   - Rationale (per branch): concrete (hand classes, bb, %) not hand-wavy; tone direct; jargon defined or avoided.
   - Section copy: pedagogically progressive across the line (flop rationale sets up the turn framing, etc.); no unexplained forward references.
6. **Bucket-teaching readiness** — Would `heroHolding` + `correctByArchetype` meaningfully improve this node? If yes, propose the combo set + archetype split. If no (e.g., terminal commentary node, or archetype doesn't flip the answer), say so explicitly. Flows into Stream B / C backlog items.
7. **External validation (MANDATORY for every decision node)** — POKER_THEORY.md is a ceiling on what we already believe; external sources are the reality check. Per decision node, perform at minimum one targeted web query per non-obvious claim (correct branch identification, villain action frequency, bluff-to-value estimate, equity claim, MDF/pot-odds math). Sources in priority order:
   1. **Solver outputs** — GTO Wizard blog / free library, Run It Once hand review posts, published solver work
   2. **Training-site public content** — Upswing / Jonathan Little / Pads Chips / Doug Polk / Saulo Costa
   3. **Books** — Modern Poker Theory (Acevedo), Play Optimal Poker (Clements), Poker's 1% (Cardner), The Course (Sklansky), PLO (Hwang) where relevant
   4. **Community consensus** — 2+2 archives, high-stakes thread regulars, r/poker theory threads (lowest weight — only for commonly-discussed spots where consensus is durable)

   For each query, document:
   - **Query:** verbatim search string or URL
   - **Source:** publisher + author + date if available
   - **Finding:** one-sentence summary of what the source says
   - **Categorization:**
     - **A — No disagreement.** Source matches our content. No action.
     - **B — Our content is wrong.** Source disagrees, our content is the error. Open Stream F finding.
     - **C — Our engine is wrong.** Source disagrees with a number our engine would output (fold rates, equity priors, archetype multipliers, `HERO_BUCKET_TYPICAL_EQUITY` values, etc.). Open Stream G finding — this is feedback into the *system*, not the content.
     - **D — Intentional divergence.** Source disagrees but our position is deliberate (live-pool target vs solver baseline, our archetype taxonomy vs a different site's etc.). Document the divergence with reasoning and route it to POKER_THEORY.md §11 "Documented Divergences" (create section if absent).
   - **Citation:** URL or bibliographic reference. Permanent citations preferred — paywalled or expired content is weaker evidence than public.

   An audit with zero web queries fails review. An audit where 100% of queries categorize A (no disagreement) is suspicious — either the queries were too soft, or the line is genuinely fully-grounded and we should say so explicitly.

---

## Node-by-node findings

For each node in the line, walk the six dimensions and record findings. Nodes with zero findings on all six dimensions get a single `✓ clean` row.

### `[node-id]` — [street] · [villain-action or terminal-label]

- **1. Setup:** ✓ / ✗ — [one line]
- **2. Villain action:** ✓ / ✗ — [one line]
- **3. `correct` flag:** ✓ / ✗ per branch
- **4. Frameworks:** ✓ / ✗ — [one line]
- **5. Copy:**
  - Prompt: ✓ / ✗ — [one line]
  - Rationale per branch: ✓ / ✗ — [one line per flagged branch]
  - Sections: ✓ / ✗ — [one line per flagged section]
- **6. Bucket-teaching readiness:** YES / NO / PARTIAL — [proposed combo set + archetype split, or reason to skip]
- **7. External validation:** [N] queries issued. [A / B / C / D counts]. See sub-log.

#### 7a. External-validation log for `[node-id]`

| # | Claim under test | Query | Source | Finding | Category |
|---|------------------|-------|--------|---------|----------|
| 1 | [e.g., "BB donks T96ss in 3BP ~15% of the time"] | [search string or URL] | [publisher/author/date] | [one-sentence summary] | A / B / C / D |
| ... | | | | | |

#### Findings on this node

- **L-[node-id]-F1 — [short title]**
  - **Severity:** 0–4 (see template rubric below)
  - **Dimension:** 1/2/3/4/5/6 (multiple allowed)
  - **Observation:** What exactly is wrong, with file:line reference.
  - **Recommended fix:** What to change. If copy, quote the new text verbatim.
  - **Effort:** S / M / L
  - **Risk:** Any ripple (changes another node's setup, changes which framework is correct, etc.)

(Repeat per node.)

---

## Cross-node observations

Themes that span multiple nodes in this line (e.g., "every decision omits the exploit-adjust section", "pot-odds math is implicit at all three bluff-catch nodes"). Not tied to a single node.

- ...

## Open questions for the owner

Things the auditor cannot resolve alone (e.g., "is our target student base ~1–2 NL or 2–5? Affects archetype weighting for this line").

- ...

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | L-[node-id]-F1 — title | 4 | S | P0 |
| ... | | | | |

---

## Bucket-teaching queue (flows into Stream B/C backlog)

For every decision node where dimension 6 returned YES or PARTIAL:

| Node | Hero combo(s) | `bucketCandidates` proposal | `correctByArchetype` split (fish / reg / pro) | Rationale |
|------|---------------|------------------------------|------------------------------------------------|-----------|
| [node-id] | [e.g., K♠Q♠] | `[tptk, nutFlushDraw, comboDraw, air]` | call:{fish:F,reg:T,pro:T}; raise:{fish:T,reg:F,pro:F} | [one-line why archetype matters here] |

---

## Severity rubric

| Severity | Definition |
|----------|------------|
| 0 | Cosmetic — phrasing nit, no comprehension cost. |
| 1 | Minor — small copy fix or framework nit that doesn't change the student's takeaway. |
| 2 | Moderate — copy error that risks student mis-generalizing; or framework citation the student will likely skip. |
| 3 | Significant — `correct` flag is defensible but suboptimal against the pop we target; or copy materially misleads; or missing framework changes the student's takeaway. |
| 4 | Blocker — `correct` flag is wrong; rationale teaches a -EV principle; setup is unrealistic enough that the node teaches nothing real. Ship blocker. |

---

## Accuracy verdict

- **GREEN** — zero P0/P1 findings. Line ships as-is; P2/P3 polish batched.
- **YELLOW** — ≥1 P1, zero P0. Line fixes needed before bucket-teaching content lands on it (Stream B/C blocked on this line).
- **RED** — ≥1 P0. Line needs structural rework (node added/removed, villain action rate rewritten, or removed from library).

---

## Review sign-off

- **Drafted by:** Claude (session [id])
- **Reviewed by:** [owner] on [date]
- **Closed:** [date] — linked to BACKLOG items [...]

Audit is immutable after close. Follow-up audits create a new file with `-v2` suffix.

---

## Change log

- YYYY-MM-DD — Draft.
- YYYY-MM-DD — Reviewed.
- YYYY-MM-DD — Closed.
