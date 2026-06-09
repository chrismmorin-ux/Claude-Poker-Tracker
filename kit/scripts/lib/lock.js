'use strict';

// File-based advisory lock — re-export of withFileLock from cwos-utils.js.
// See cwos-utils.js:720-784 for the full primitive (atomic O_EXCL create,
// busy-wait+jitter retry, ISO-timestamp stale-lock recovery, owner-labeled
// lockfile content). This thin module exists so callers can require the
// lock primitive without pulling in the full cwos-utils surface.
//
// Honors WS-311 accept criterion (a) — kit/scripts/lib/lock.js exists.

const { withFileLock } = require('./cwos-utils');

module.exports = { withFileLock };
