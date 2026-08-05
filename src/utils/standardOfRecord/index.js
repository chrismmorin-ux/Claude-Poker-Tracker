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
  CELL_STATUSES,
  UNEXAMINED_REASONS,
  EXAMINATION_MODES,
  CONTEXT_KEY_SEP,
  enumerateContexts,
  declareExamination,
  buildCoverageCensus,
  coverageCensusProblems,
  censusCoverage,
  neverLooked,
  observedZeros,
} from './coverageCensus.js';

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
  shareOfTotal,
  attributeFirstLayer,
  pairedMeanCI,
  pairAtoms,
  exactPairsOnly,
} from './layerAttribution.js';

// THE one comparison path (WS-350). ADR-009 permits exactly one; see divergence.js.
export {
  DIVERGENCE_MEASURES,
  DIVERGENCE_WEIGHTINGS,
  VOLUME_EXCLUSIONS,
  MEASURE_UNITS,
  KL_FLOOR,
  KL_DIRECTION,
  buildSurfaceOutput,
  outputOfAtom,
  klDivergence,
  evDifference,
  divergenceFn,
  preRegisterPrimary,
  measureBoth,
  rankSurfaces,
  pairwiseSeparation,
  klFloorSweep,
} from './divergence.js';

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

export {
  FAULT_STATUSES,
  NON_LAYER_SITES,
  FAULT_SITES,
  SUSPECT_PENDING_REVIEW,
  REGISTER_EPOCH,
  BREADTH_PRIOR_WEIGHT,
  THE_DISCLAIMER,
  DISCLAIMER_TREATMENT,
  SUSPECTED_FAULTS,
  isFaultSite,
  buildFaultEntry,
  faultEntryProblems,
  registerProblems,
  contaminatedCards,
  measuredBreadth,
  blendedBreadth,
  expectedDamage,
  rankFaults,
  flagContaminated,
  confirmFault,
  retireFault,
  registerSelfCheck,
  canonicalRegisterBody,
  registerVersion,
} from './faultRegister.js';
