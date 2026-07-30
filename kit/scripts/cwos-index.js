#!/usr/bin/env node
/**
 * cwos-index — Deprecated shim. Forwards to cwos-reconcile.js.
 *
 * The full reconcile script does everything cwos-index did (rebuild queue +
 * findings indexes, reconcile counters) PLUS sprint/enhancement/readiness
 * indexes and integrity validation. New callers should use cwos-reconcile.js
 * directly.
 *
 * DISPOSITION (WS-488, 2026-07-26): KEEP, do not delete.
 * Retire-or-keep was decided in favour of keep. There are zero live callers in
 * HomeBase, but adopted repos received this file through kit/MANIFEST.yaml and
 * may reference it from their own notes, scripts, or permission allowlists.
 * Deleting a shipped kit file without first updating every adopted repo is the
 * failure mode CLAUDE.md's "never delete kit/ files" rule exists to prevent, and
 * a 13-line forwarder is not worth that risk. The actual defect WS-488 named —
 * three docs citing `cwos-index.deriveCapability()`, an API that moved — is
 * fixed: deriveCapability() now lives in kit/scripts/lib/cwos-reconcile-core.js
 * and kit/commands/workstream.md, kit/templates/workstream/queue-index.yaml and
 * cwos-backfill-capability.js all point there.
 * Revisit only as part of a deliberate kit-wide deprecation sweep with a
 * /fleet-update behind it.
 */

'use strict';

require('./cwos-reconcile.js');
