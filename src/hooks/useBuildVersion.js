import { useEffect, useRef, useState } from 'react';

// Production polls /version.json every minute to detect new deploys. The file
// is stamped by CI (.github/workflows/deploy.yml) and served no-cache by
// Firebase hosting (firebase.json), so each fetch returns the live SHA.
const POLL_INTERVAL_MS = 60_000;
const VERSION_URL = '/version.json';

const fetchVersion = async () => {
  const res = await fetch(VERSION_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`version.json HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data.version !== 'string') {
    throw new Error('version.json malformed');
  }
  return { version: data.version, built: data.built || null };
};

export const useBuildVersion = ({ pollIntervalMs = POLL_INTERVAL_MS, enabled } = {}) => {
  // Disabled in dev by default — vite dev server doesn't serve /version.json.
  const isEnabled = enabled ?? !import.meta.env.DEV;

  const [current, setCurrent] = useState(null);
  const [latest, setLatest] = useState(null);
  const [error, setError] = useState(null);
  const currentRef = useRef(null);

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
      } catch (err) {
        if (!cancelled) setError(err);
      }
    };

    check();
    const id = setInterval(check, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
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
    error,
  };
};
