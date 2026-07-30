import { useEffect, useRef, useState } from 'react';
import { BUILD_SHA, BUILD_TIME } from '../utils/buildInfo';
import { requestSwUpdate } from '../utils/swUpdate';

// Production polls /version.json every minute to detect new deploys. The file
// is stamped by CI (.github/workflows/deploy.yml) and served no-cache by
// Firebase hosting (firebase.json), so each fetch returns the live SHA.
const POLL_INTERVAL_MS = 60_000;
const VERSION_URL = '/version.json';

// The running bundle's own identity, when it has one. `current` is seeded from
// this rather than from the first poll — version.json ALWAYS reports the
// server's newest build, so first-poll seeding compares the server to itself
// and can never detect that THIS page is stale. That was the whole job of the
// banner, and it silently never fired: an install left open across a deploy
// stayed on the old bundle with no prompt until a lazy chunk 404'd.
// 'dev' (the Vite define never ran) and 'local' (git rev-parse failed) aren't
// real build identities — fall back to first-poll seeding there so neither
// shows a phantom "update available". Callers can pass `build` to override.
const runningBuild = (BUILD_SHA && BUILD_SHA !== 'dev' && BUILD_SHA !== 'local')
  ? { version: BUILD_SHA, built: BUILD_TIME }
  : null;

const fetchVersion = async () => {
  const res = await fetch(VERSION_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`version.json HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data.version !== 'string') {
    throw new Error('version.json malformed');
  }
  return { version: data.version, built: data.built || null };
};

export const useBuildVersion = ({
  pollIntervalMs = POLL_INTERVAL_MS,
  enabled,
  build = runningBuild,
} = {}) => {
  // Disabled in dev by default — vite dev server doesn't serve /version.json.
  const isEnabled = enabled ?? !import.meta.env.DEV;

  const [current, setCurrent] = useState(build);
  const [latest, setLatest] = useState(null);
  const [error, setError] = useState(null);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const currentRef = useRef(build);

  useEffect(() => {
    if (!isEnabled) return undefined;

    let cancelled = false;

    const check = async () => {
      try {
        const fetched = await fetchVersion();
        if (cancelled) return;
        if (!currentRef.current) {
          currentRef.current = fetched;
          setCurrent(fetched);
          setLatest(fetched);
        } else {
          setLatest(fetched);
        }
        setError(null);
        setLastCheckedAt(Date.now());
      } catch (err) {
        if (!cancelled) setError(err);
      }
    };

    // Ask the browser for a newer worker at the same moments we ask the server
    // for a newer version. Otherwise the app can KNOW it's behind while the new
    // worker has never even been fetched.
    const checkBoth = () => {
      check();
      requestSwUpdate();
    };

    checkBoth();
    const id = setInterval(check, pollIntervalMs);

    // A phone PWA is resumed, not reloaded. While it's backgrounded the
    // interval above is throttled or frozen outright, so on resume the hook
    // would keep displaying whatever it last fetched — possibly hours old —
    // as though it were current. That is why the app could say "up to date"
    // right up until a manual Force Update. Re-check the moment it comes back
    // to the foreground, and again when the network returns.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkBoth();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', checkBoth);
    window.addEventListener('online', checkBoth);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', checkBoth);
      window.removeEventListener('online', checkBoth);
    };
  }, [isEnabled, pollIntervalMs]);

  const updateAvailable = Boolean(
    current && latest && current.version !== latest.version
  );

  return {
    currentVersion: current?.version || null,
    currentBuiltAt: current?.built || null,
    latestVersion: latest?.version || null,
    latestBuiltAt: latest?.built || null,
    updateAvailable,
    // When the last successful check happened. A caller showing a confident
    // "up to date" needs this: without it, an answer fetched hours ago reads
    // exactly like one fetched a second ago.
    lastCheckedAt,
    error,
  };
};
