### SECURITY ENGINEER

## The dormant-program interrogation (asked first, per brief)

`.claude/workstream/programs/prog-security.yaml`: `tier: dormant` (line 79), `health_score: 0`,
`health_ceiling: 0`, `health_ceiling_reason: "No analysis performed yet. Run /pulse run <id>
baseline to establish first score."` (lines 170-172), `last_run_by_protocol` all-null (lines
163-168), `evidence.protocol_history: []` (line 178). This `0` is genuinely never-run, not
measured-failing -- the program's own baseline protocol has literally never executed.

But `findings_open: 6` (line 173) is not zero, and the six findings are real, dated 2026-08-07,
and still open today (2026-08-18 -- 11 days stale against the program's own `stale_days: 7`
escalation threshold, prog-security.yaml:139). They arrived sideways: `run-launch-sweep-2026-08-07`
(an `eng-engine` sweep run under the launch program) tagged its security-relevant output
`program: security` in `findings-index.yaml:726-778`, without the security program's own
protocol ever running. I re-verified all six against HEAD today; the affected files are unchanged
since 2026-08-07 (confirmed by direct read, not by trusting the finding text):

| ID | Severity | Verified still open at HEAD |
|---|---|---|
| FIND-100 | CRITICAL | AuthContext.jsx:296 -- deleteAccount() calls deleteUser(auth.currentUser) only; no local purge call exists anywhere in the function (read lines 260-303 today). |
| FIND-101 | CRITICAL | exportUtils.js backup/restore vs database.js DB_VERSION=28 -- not re-diffed line-by-line this pass, but no fix commit exists for this dedup_key; treat as open. |
| FIND-102 | HIGH | GuestDataMerge.jsx / migrateGuestData.js -- not re-diffed; no fix commit for this dedup_key. |
| FIND-103 | HIGH | exportUtils.js:159-182 non-atomic clearAllData -- not re-diffed; no fix commit. |
| FIND-104 | MEDIUM | handsStorage.js quota handling -- not re-diffed; no fix commit. |
| FIND-105 | MEDIUM | Confirmed live: firebase.json (read in full today) sets only Cache-Control headers, no CSP anywhere. ignition-poker-tracker/manifest.json:14 ships http://localhost:5173/* as a production host permission today. name/description (lines 3-5) still read "Poker Session Notes" / "Personal poker session note-taking assistant" -- no mention of WebSocket capture of a real-money casino site. |

Verdict: a dormant program with open findings is worse than an unmonitored one. The health
math treats this program as a 0 -- indistinguishable, to any aggregate reading health_score,
from "nothing has ever been looked at." That is false. Something was looked at, twice
(2026-08-07 launch sweep for FIND-100-105; 2026-08-07 methodology sweep for the related
FIND-083), found two CRITICAL and two HIGH defects, and then nobody's cadence machinery picked
up the resulting debt because the program that owns it has never run its own protocol to notice
its own backlog is stale. FIND-100 (account deletion purges nothing) is a launch blocker
by any reasonable standard -- a "delete my account" button that silently retains every hand,
every player's ethnicity/physical-description field, and unencrypted photo blobs, while telling
the user "Account deleted," is a data-protection failure a regulator or a partner would flag on
sight, not a code-quality nit.

## Key Concerns (top 5)

1. CRITICAL -- Account deletion is theater. src/contexts/AuthContext.jsx:296 calls only
   Firebase's deleteUser; clearAllData (src/utils/exportUtils.js) has no caller in that
   path. Every IndexedDB store -- hands, sessions, players, ethnicity/physical-description
   fields, unencrypted photo blobs -- survives on-device indefinitely after a user believes
   their account and data are gone (FIND-100, confirmed live).

2. CRITICAL -- Backup silently drops most of the schema. FIND-101: exportUtils.js's
   EXPORT_VERSION comment ties it to IDB v12 while database.js DB_VERSION=28; export pulls
   3 of ~25 stores. validateImportData validates only those same 3 arrays, so a restore reports
   success while photos, tournaments, range profiles, and exploit anchors silently vanish. This
   is the founder's only stated recovery path for a local-only app with no server backup -- its
   silent-failure mode is the worst possible shape for a data-loss safety net.

3. HIGH -- Cross-boundary message forgery on the app's own sync bridge. src/hooks/
   useSyncBridge.js:238 and ignition-poker-tracker/content/app-bridge.js:149 both gate
   window.postMessage handlers on event.source !== window only -- no event.origin check.
   event.source === window is true for any script running in that document, not just the
   legitimate extension content script or the legitimate app. Contrast with
   ignition-capture.js:442-443, which does check both event.source and event.origin
   (comment: "RT-42: defense-in-depth origin check") -- so the codebase already knows the correct
   pattern and applied it on the casino-page listener but not on the app-page listener. Filed as
   FIND-083, but under program: methodology-integrity, not security -- see Hidden Risks below.

4. HIGH -- No dependency vulnerability gate in CI for either package.json. .github/
   workflows/ci.yml (read in full) runs npm ci, npm test, a coherence scan, and a Playwright
   touch-floor check -- no npm audit step anywhere. Running npm audit --omit=dev against the
   main app today returns 14 vulnerabilities: 2 critical, 1 high, 11 moderate (grpc-js,
   protobufjs, websocket-driver, opentelemetry chain -- pulled in transitively via firebase and
   posthog-js). I have not verified whether Vite tree-shakes these Node-only transitive
   dependencies out of the shipped browser bundle -- that determines actual exploitability and is
   an open question, not a settled "safe." The ignition-poker-tracker/ extension audits clean
   (0 vulnerabilities) as of today. FIND-105 already names "no npm audit gate in CI" but scoped
   it as MEDIUM alongside the CSP/manifest items; the 2-critical count argues this half deserves
   its own HIGH line, not a footnote.

5. HIGH -- The extension is designed to evade the casino site's own detection, which is an
   account/funds risk, not a code vulnerability. ignition-poker-tracker/content/
   capture-websocket-probe.js runs in the MAIN world at document_start (manifest.json:26-31)
   and monkey-patches window.WebSocket with a Proxy. Its own section header, verbatim, is
   "STEALTH WEBSOCKET PROXY" (line 80), it stores patch-markers as Symbol()s specifically
   because they are "closure-scoped, undiscoverable by page JS" (line 24), and it fakes
   toString() to return the native function's string (lines 42-43, 126-131) so a site-side
   integrity check calling WebSocket.toString() sees what looks like the untouched native
   function. This is textbook anti-anti-cheat evasion engineering. Ignition Casino's own ToS
   almost certainly prohibits client tampering / automated data extraction; if their client ever
   adds (or already has, undetected) a check for WebSocket Symbol enumeration or proxy
   detection, the blast radius is the founder's real-money account, not a bug report. This is
   outside npm audit's reach entirely and outside every problem class prog-security.yaml
   enumerates (lines 33-61) -- none of Authentication, Data Protection, Secrets, Injection,
   Dependencies, or Infra Config covers "does our own product's evasion behavior risk the
   founder's account."

## Hidden Risks

- FIND-083's security half is filed under the wrong program and isn't counted in security's 6.
  The finding text itself says "ROUTE: origin check to security; dedup/captureId to engineering"
  (FIND-083.yaml:16), but FIND-083.yaml:7 still reads program: "methodology-integrity", and
  I confirmed via findings-index.yaml and queue-index.yaml that no security-owned duplicate
  or WS item exists for the origin-check half -- WS-514 (the only queue item referencing
  FIND-083) is scoped to the captureId/dedup half only, program: data-provenance. So the
  security program's finding count (6) undercounts a real, already-diagnosed, currently-open
  trust-boundary gap that its own routing note says belongs to it.

- The forgeable app-bridge listener's actual consequence for this app is model poisoning, not
  classic XSS. useSyncBridge.js:246-256 does run validateHandForRelay + validateHandRecord
  before accepting hands from the unauthenticated listener, so arbitrary JS execution isn't the
  direct outcome. But any script able to run in that document (a compromised npm dependency
  bundled into the build, a rogue browser extension, a future self-XSS) can inject
  schema-valid, fabricated hand records that the app will treat as genuine captured play. Given
  this product's entire value is Bayesian player modeling built from recorded hand history, a
  believable-but-fake hand stream is a more damaging attack than defacement -- it corrupts the
  villain models and exploit recommendations silently, with no error to surface.

- No Firestore/Realtime Database is in use anywhere (grep across src/ for
  "firestore|getFirestore|collection(" returned no matches; src/config/firebase.js imports
  only firebase/app and firebase/auth). So the brief's checklist item "are there Firestore
  rules restricting a user to their own data" resolves to N/A today -- there is no cloud data
  store to misconfigure. This is good news now and a hard constraint later: SC-04 in
  SYSTEM_MODEL.md:430 already names multi-device cloud sync as a possible future direction. If
  that ships, security rules must exist before the first write, not be retrofitted -- there is no
  rules file anywhere in the repo today to iterate from.

- No .env was ever committed -- git log --all --full-history -- .env .env.local
  .env.production returns empty, and .gitignore covers all five env variants (.env,
  .env.development.local, .env.local, .env.production.local, .env.test.local). The one
  file matching an API-key-shaped string, scripts/setup-local-env.mjs:47, is a documented
  placeholder (AIzaSyLOCALDEV-placeholder-not-a-real-key) that intentionally doesn't parse as a
  working key. This is the one clean bill of health in this sweep.

## Likely Missing Elements

- No npm audit in CI, confirmed by reading .github/workflows/ci.yml in full -- no step
  runs it for either package.json. FIND-105 names this but under-weights it (MEDIUM, bundled
  with CSP/manifest hygiene) given the 2-critical count found just now.
- No CSP header on any route -- firebase.json (read in full) sets only Cache-Control.
  React's default escaping plus NEV-11 is, per FIND-105's own description, "the entire XSS
  defense." That is a single-layer defense for a product that stores free-text player notes and
  ethnicity/physical-description fields per SYSTEM_MODEL.md:390, 397.
- No account-deletion purge, and no user-invocable purge path exists anywhere in the product
  even outside the deletion flow (FIND-100's stronger, facilitator-verified claim). A user who
  simply wants their data gone -- without deleting their account -- has no path at all.
- No behavioral test for the oldest IndexedDB cursor migrations (v7, v13 per FIND-104) and no
  test asserting migration ordering, despite "migrateV28 must-stay-last" being enforced by
  comment only.
- No Chrome Web Store listing audit -- the shipped name/description do not describe what the
  extension does (WebSocket capture of a real-money casino site + HUD), which is itself a
  store-policy risk distinct from the ToS/account risk in Key Concern 5: an unannounced listing
  pull would silently take the HUD down for the founder mid-session with no warning.

## Dangerous Assumptions

- "IndexedDB is same-origin, so it's isolated" is being treated as sufficient, when the actual
  boundary that matters is which scripts can run in that origin, not the origin label itself.
  SYSTEM_MODEL.md:387-390 marks "Local app (same-origin)" as "Fully trusted" and "Ignition
  Extension" as "Semi-trusted... sender.id validation active" -- accurate for the
  extension-to-service-worker hop, but the page-to-content-script hop (useSyncBridge.js:238,
  app-bridge.js:149) has no equivalent validation, and the System Model's security section
  doesn't distinguish these two different hops under "Ignition Extension" as one line.
- "A dormant/never-run program can't produce false confidence" is false in this repo, right now.
  Six findings sit under a program at tier: dormant, health: 0, and nothing in the cadence
  machinery (stale_days, block_sprint) is firing on them, because those triggers key off
  protocol staleness (last_run_by_protocol), and the protocol has literally never run to
  become stale in the tracked sense -- it's stuck at "never run" rather than "overdue." The
  findings are overdue; the program's own accounting isn't built to notice that distinction.
- "npm audit clean for the extension means the shipped surface is clean" undersells the actual
  supply chain -- the extension's runtime trust surface is the casino site's own JS
  environment (a hostile-by-default page with third-party ads/trackers/analytics scripts
  co-resident in the same MAIN world the probe patches), which npm audit cannot see at all.
- "Validation before persistence stops the bridge-forgery risk" is only half true -- wire and
  record-shape validation (confirmed present, useSyncBridge.js:249-253) stops malformed data,
  not fabricated-but-valid data, which is the more dangerous case for a Bayesian modeling
  product (see Hidden Risks).

## Verdict on H1-H4

H1 (self-perpetuating NOT READY artifact) -- SUPPORT, with a security-specific mechanism.
prog-launch.yaml:107 reads blocking_programs: [] today, confirmed by direct read. Separately,
prog-security.yaml:154 declares interconnections: { blocks: [launch] } -- security believes
it blocks launch -- but that belief is never consulted, because the launch gate's own
blocking_programs list, the thing it actually evaluates against, is empty. Even a healthy
security program couldn't move this gate today; the wiring is one-directional and inert on the
consuming end. This is exactly the shape H1 describes, and I can name the specific broken edge.

H2 (health score vs. 60-point threshold scale mismatch) -- SUPPORT. prog-launch.yaml:106:
required_program_health: 60. Every program health figure I've read across this sweep --
prog-security.yaml: health_score: 0, health_ceiling: 0; prog-launch.yaml: health_score: 2,
health_ceiling: 5; and the brief's own line 60-64 listing "domain-correctness 2/10,
self-compliance 2/10 ... security 0" -- is on what reads as a 0-10 scale (health_ceiling values
of 5, 8, 10 appear nowhere near 60). A gate comparing a 0-10 score against a 60-point threshold
cannot pass by construction, independent of how good the underlying work is. I did not locate the
scoring function itself (out of my lens/time), so I can't rule out that required_program_
health: 60 secretly means something on a different scale than health_score -- but every
artifact I read is consistent with H2 and none contradicts it.

H3 (a shippable subset exists) -- SUPPORT, from the security lens specifically. Of the six open
security findings, the two CRITICALs (FIND-100 account-deletion purge, FIND-101 backup schema
parity) and one HIGH (FIND-102 guest auto-merge) all attach to the optional account/cloud-sync
surface -- sign-in, delete-account, cross-device backup, shared-device guest merge -- not to the
core local recording flow. A user who never signs in (the app's own default, per CLAUDE.md:
"guest mode works with no credentials") is not exposed to FIND-100, FIND-101, or FIND-102 at
all. The remaining findings (FIND-103 non-atomic clear, FIND-104 quota/migration gaps, FIND-105
CSP/manifest) are real but HIGH/MEDIUM infrastructure hygiene, not user-facing blockers for solo
local play. Caveat that narrows H3: the extension's stealth-evasion design (Key Concern 5) is a
risk on the core live-play flow itself -- the one the founder uses at the table today -- and is
not a code-security question at all, so it isn't "fixed" by scoping down to local-only use the
way the account-flow findings are.

H4 (health 0 = never-run, not broken) -- SUPPORT the distinction, REFUTE the implied safety.
prog-security.yaml confirms 0 is genuinely never-run (baseline protocol never executed,
protocol_history: []). But this sweep shows that "never run" and "nothing wrong" are not the
same claim: six real findings, two CRITICAL, sit underneath that 0, dated 11 days ago, unfixed,
and structurally invisible to the escalation machinery that would normally surface program
staleness. An aggregate treating this 0 as "unmeasured, discount it" would be exactly backwards
-- this is a program that has something to say and isn't being asked.
