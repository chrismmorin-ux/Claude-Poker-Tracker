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

// The Read surface's record form. Named by the founder 2026-08-18 to pair with the Strategy
// Card: a Strategy Card is what someone SAYS they will do, a Conduct Card is what a player DID.
// It is the only one of the four villain objects that makes no comparative claim, which is why
// it is a form of its own and an Appraisal or a Read is a Result Card variant.
export {
  MIX_VERDICTS,
  VERDICT_SPEC_ANALOGUE,
  isMixVerdict,
  buildMix,
  buildConductCard,
  conductCardProblems,
  isValidConductCard,
  conductCaveat,
  // WS-578 — the sizing vocabulary. The record form owns the WORDS (the closed regime list,
  // the unsized cell, which actions have a size at all); the induction owns the BOUNDARIES,
  // in scripts/villainArchetype/sizingBands.mjs, because a lattice is a property of the corpus
  // that was measured and not of the record form — and because `src/` must not import `scripts/`.
  // A consumer validating or reading a card needs these; it does not need the boundaries, which
  // ride on the card itself.
  SIZING_REGIMES,
  SIZING_UNSIZED_BAND,
  SIZED_ACTIONS,
  UNSIZED_ACTIONS,
} from './conductCard.js';

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

// WS-434: the declared metrics union — the "Scored Readout" shape VOCABULARY.md names.
export {
  METRICS_SCHEMA_ENTRIES,
  METRICS_SCHEMA_VERSIONS,
} from './metricsSchemas.js';

export {
  METRICS_KINDS,
  metricsProblems,
  conditionedRateProblems,
  overallEvFactorProblems,
} from './metrics.js';

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
  MATCHABLE_CARD_FIELDS,
  PROSE_CARD_FIELDS,
  POPULATION_ANCHORS,
  cardPopulation,
  proseMatchers,
  contaminationDisclosure,
} from './faultRegister.js';

// WS-445 — the Label & Foundation Ledger. Sibling to faultRegister.js above and shaped after
// it deliberately: both are append-only registers whose rows may only be resolved with
// recorded evidence plus a note stating what the resolution does NOT cover.
//
// Note the three impact constructors are the whole point of the module and are NOT
// interchangeable. `buildUnmeasuredReach` mints no EV key at all, so an unmeasured row's
// `absEvBB100` is `undefined` rather than `null` — there is no slot for a future relaxation to
// fill. Reach for the constructor that matches the evidence you actually hold.
export {
  FOUNDATIONS,
  FOUNDATION_STATUSES,
  BOUND_METHODS,
  EXCLUSION_REASONS,
  LIVENESS,
  LABEL_STATUSES,
  LABEL_LEDGER,
  LEDGER_EPOCH,
  RESULT_CARD_ID_PATTERN,
  LEDGER_VERSION_PATTERN,
  isFoundation,
  isFoundationStatus,
  isBoundMethod,
  isExclusionReason,
  isLiveness,
  isLedgerVersionShape,
  buildMeasuredImpact,
  buildBoundedImpact,
  buildUnmeasuredReach,
  impactProblems,
  buildLabelEntry,
  labelEntryProblems,
  reachScore,
  rankLabels,
  ledgerSelfCheck,
  canonicalLedgerBody,
  ledgerVersion,
  resolveLabel,
} from './labelLedger.js';
