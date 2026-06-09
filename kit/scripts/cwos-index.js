#!/usr/bin/env node
/**
 * cwos-index — Deprecated shim. Forwards to cwos-reconcile.js.
 *
 * The full reconcile script does everything cwos-index did (rebuild queue +
 * findings indexes, reconcile counters) PLUS sprint/enhancement/readiness
 * indexes and integrity validation. New callers should use cwos-reconcile.js
 * directly.
 */

'use strict';

require('./cwos-reconcile.js');
