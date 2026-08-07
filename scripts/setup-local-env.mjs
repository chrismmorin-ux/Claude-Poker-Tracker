/**
 * setup-local-env.mjs — write a .env.local that lets the app boot locally
 * with no Firebase project and no real credentials.
 *
 * WHY THIS EXISTS
 * The Table View Redesign kickoff (2026-07-31) could not verify a single visual
 * claim: `src/config/firebase.js` calls `initializeApp` at module scope, so an
 * absent `VITE_FIREBASE_API_KEY` throws `auth/invalid-api-key` and the whole app
 * dies at boot. Every finding in the Gate 1 audit had to be derived from reading
 * code, and the founder had to photograph his phone to verify anything.
 *
 * HOW IT WORKS — and what it does NOT do
 * The app is IndexedDB-first and already has a real guest mode (GUEST_USER_ID in
 * authConstants). Firebase Auth's `onAuthStateChanged` resolves the initial state
 * from LOCAL persistence and calls back with `null` when nobody is signed in — no
 * network round-trip. So placeholder config is enough to get past module init, and
 * the app then runs the entire local feature set as a guest.
 *
 * Nothing is stubbed, mocked, or branched. No production code path changes. The
 * only thing that differs from a real setup is that sign-in will not work — which
 * is correct, because there is no project behind these values.
 *
 * NOT FOR PRODUCTION. `.env.local` is gitignored. These are not secrets and are not
 * redacted credentials — they are syntactically-shaped placeholders that point at
 * nothing. Never copy them into `.env.production` or a deploy environment.
 *
 * Usage:
 *   npm run env:local            # write .env.local if absent
 *   npm run env:local -- --force # overwrite an existing .env.local
 */

import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TARGET = resolve('.env.local');
const FORCE = process.argv.includes('--force');

const CONTENTS = `# Local development only — written by \`npm run env:local\`.
#
# These are PLACEHOLDERS, not credentials. They point at no Firebase project.
# They exist so \`initializeApp()\` does not throw at module scope; the app then
# boots into its existing guest mode and the full local feature set works.
#
# Sign-in / sync will NOT work with these values. That is expected.
# Never use this file in a deploy. It is gitignored.

VITE_FIREBASE_API_KEY=AIzaSyLOCALDEV-placeholder-not-a-real-key
VITE_FIREBASE_AUTH_DOMAIN=localhost
VITE_FIREBASE_PROJECT_ID=local-dev
VITE_FIREBASE_STORAGE_BUCKET=local-dev.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:localdev
VITE_FIREBASE_MEASUREMENT_ID=

# Empty key = silent-mode telemetry (console.debug only).
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://us.i.posthog.com
`;

if (existsSync(TARGET) && !FORCE) {
  console.log('.env.local already exists — leaving it alone.');
  console.log('Use `npm run env:local -- --force` to overwrite it.');
  process.exit(0);
}

writeFileSync(TARGET, CONTENTS);
console.log(`Wrote ${TARGET}`);
console.log('\nNext:');
console.log('  npm run dev        # terminal 1');
console.log('  npm run devshot    # terminal 2 — screenshots + rendered-size measurements');
