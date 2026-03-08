import { useState, useEffect } from 'react';

const formatRelativeTime = (startTime) => {
  if (!startTime) return '';

  const now = Date.now();
  const diff = now - startTime;

  if (diff < 0) return '';

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `Started ${minutes}m ago`;
  if (hours < 24) return `Started ${hours}h ago`;
  return `Started ${days}d ago`;
};

/**
 * useSessionTimer - Tracks elapsed session time with 60s interval updates
 * @param {number|null} sessionStartTime - Session start timestamp
 * @returns {string} Formatted time display string
 */
export const useSessionTimer = (sessionStartTime) => {
  const [sessionTimeDisplay, setSessionTimeDisplay] = useState(() => formatRelativeTime(sessionStartTime));

  useEffect(() => {
    if (!sessionStartTime) {
      setSessionTimeDisplay('');
      return;
    }

    setSessionTimeDisplay(formatRelativeTime(sessionStartTime));

    const interval = setInterval(() => {
      setSessionTimeDisplay(formatRelativeTime(sessionStartTime));
    }, 60000);

    return () => clearInterval(interval);
  }, [sessionStartTime]);

  return sessionTimeDisplay;
};
