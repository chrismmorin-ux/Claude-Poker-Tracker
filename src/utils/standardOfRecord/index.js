/**
 * standardOfRecord — the vocabulary and schemas ADR-009 binds the repo to.
 *
 * Register (read this first): docs/standard-of-record/VOCABULARY.md
 * Decision:                   docs/adr/ADR-009-standard-of-record.md
 *
 * What lives here is the SHAPE of a claim, not the machinery that produces one. There is
 * deliberately no comparison path in this directory — see surfaceRegistry.js for why.
 */

export {
  SOR_SCHEMA_VERSIONS,
  SOR_SCHEMAS,
  MANIFEST_SCHEMA,
  StandardOfRecordError,
  checkAgainstSchema,
} from './schemas.js';

export {
  WARRANT_CLASSES,
  EMPIRICAL_WARRANTS,
  isWarrantClass,
  normalizeWarrant,
  warrantProblems,
  warrantWarnings,
} from './warrants.js';

export {
  SURFACE_KINDS,
  SURFACE_ORIGINS,
  isSurfaceKind,
  buildSurfaceEntry,
} from './surfaceRegistry.js';

export {
  MATCHABLE_AXES,
  ABSTAIN_REASONS,
  desugarAction,
  loadStrategyCard,
  loadStrategyCardSync,
  canonicalCardBody,
  evaluateCard,
} from './strategyCard.js';

export {
  REQUIRED_CONSTANTS,
  buildReplicationManifest,
  manifestProblems,
  knownDivergence,
} from './manifest.js';

export {
  CLUSTER_UNITS,
  buildResultCard,
  resultCardProblems,
  isValidResultCard,
} from './resultCard.js';
