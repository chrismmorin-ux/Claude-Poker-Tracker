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
  FORCING_QUESTIONS,
  READER_DEPTHS,
  StandardOfRecordError,
  checkAgainstSchema,
} from './schemas.js';

export {
  CONCLUSION_DIRECTIONS,
  buildMargin,
  buildFragility,
  buildFlipRegister,
  fragilityCaveat,
} from './fragility.js';

export {
  COMPARISON_AXES,
  BLOCK_REASONS,
  contrastKey,
  enumeratePossible,
  buildComparisonCensus,
  censusSummary,
} from './comparisonCensus.js';

export {
  VALUE_KINDS,
  ATOM_BASIS,
  buildLayerEmission,
  samplesFull,
  buildAtomTruth,
  buildDecisionAtom,
  buildAtomSetManifest,
  buildOccupancySpan,
} from './decisionAtom.js';

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
  STACK_LAYERS,
  TERMINAL_LAYER,
  LAYER_GROUND_TRUTH,
  layerIndex,
  isStackLayer,
  buildLayer,
  stackProblems,
  isValidStack,
  firstStructuralDivergence,
} from './stack.js';

export {
  PROBE_REFUSALS,
  PROBEABLE_LAYERS,
  LAYER_PROBES,
  probeRange,
  probeEquity,
  probeFoldProbability,
  probeEv,
  probeAction,
  probeAtomLayer,
  probeLayerOverAtoms,
  probeAllLayers,
} from './layerProbes.js';

export {
  localizeByLayer,
  decomposeByLayerTelescoping,
  decomposeByLayerShapley,
  decomposeBySituation,
  decompositionsAgree,
  attributionGap,
  firstMeasuredDivergence,
  pairedMeanCI,
  pairAtoms,
  exactPairsOnly,
} from './layerAttribution.js';

export {
  substituteLayer,
  substitutionReach,
  ablateLayer,
  exactlyAblatable,
} from './layerAblation.js';

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
  cardCaveat,
  needsCaveat,
} from './resultCard.js';
