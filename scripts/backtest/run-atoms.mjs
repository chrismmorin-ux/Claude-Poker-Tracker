#!/usr/bin/env node
/**
 * run-atoms.mjs — WS-328 end to end: over-capture, census the zeros, rank the Ladder, rebase it.
 *
 * Usage:
 *   node scripts/backtest/run-atoms.mjs [--sites FTP] [--stakes 50NLH]
 *                                       [--max-files 40] [--rebase-files 20]
 *                                       [--out .artifacts/atoms]
 *
 * WHAT THIS RUN IS, STATED BEFORE ANY NUMBER IT PRINTS.
 *
 * It is an INSTRUMENT card, not a strategy card. It measures how much of the decision domain
 * the reconstruction instrument reaches, and whether the engine deps make any difference to
 * what it produces. It makes NO claim about strategy quality, and its admissibility says so.
 *
 * TRANSFER. The corpus is HandHQ, online, 2009, 50NLH. The founder's game is live 9-handed
 * 1/2-1/3. That is the top-ranked entry of the suspected-fault register, and it means every
 * figure below is TRANSFERRED to the live game, not measured in it.
 *
 * LEAKAGE, structurally. Decisions are atomized only for EVAL-partition players, so the
 * POOL/EVAL split is enforced by the guard rather than by intent. The walk-forward axis is not
 * applicable here and that is stated rather than implied: the Read surface is a STATIC
 * population prior, fitted nowhere in this run. But that prior was itself mined from this
 * corpus family (SRC-011/012), so it LEAKS BY CONSTRUCTION — recorded on the card, and the
 * reason the card is inadmissible for any accuracy claim.
 *
 * EVERY MODULE LOADS THROUGH THE VITE SSR LOADER, including this harness's own files, because
 * `phhAdapter` and `reconstruct.js` both reach app modules that use extensionless imports.
 * `run-hero-ev.mjs` established the pattern.
 */

import { mkdir, writeFile } from 'node:fs/promises';

import { openLoader } from './loader.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const list = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : null);

const SITES = list(flag('sites', 'FTP'));
const STAKES = list(flag('stakes', null));
const MAX_FILES = Number(flag('max-files', 40));
const REBASE_FILES = Number(flag('rebase-files', 20));
const OUT_DIR = flag('out', '.artifacts/atoms');
const SURFACE_ID = 'read:reconstructed-population-prior';
const FIELD_ID = 'field:handhq-50nlh-2009';

// ── The declared domain. `preflop x bet` is UNREACHABLE: preflop there is no bare bet, the BB
// is a raise. Everything else in the cross product can occur. ──────────────────────────────
const AXES = [
  { name: 'actorRole', levels: ['hero', 'villain'] },
  { name: 'street', levels: ['preflop', 'flop', 'turn', 'river'] },
  // The five categories `positionUtils.RANGE_POSITION_CATEGORIES` actually defines. SB and BB
  // are separate categories there, not one BLINDS bucket, and inventing a sixth name would put
  // every blind decision in a cell the engine never produces — a census axis that disagrees
  // with the code it censuses reports zeros that mean nothing.
  { name: 'posCategory', levels: ['EARLY', 'MIDDLE', 'LATE', 'SB', 'BB'] },
  { name: 'facingAction', levels: ['none', 'bet', 'raise', '3bet', '4bet+'] },
];

const loader = await openLoader(process.cwd());
try {
  const { DEFAULT_CORPUS_ROOT, discoverCorpusFiles } = await loader.load('/scripts/backtest/corpusFiles.mjs');
  const { buildDealBook } = await loader.load('/scripts/backtest/dealBook.mjs');
  const { iterAppHands } = await loader.load('/scripts/backtest/phhAdapter.mjs');
  const { buildStampInput } = await loader.load('/scripts/backtest/replicationStamp.mjs');
  const { LeakageGuard, REFERENCE_DISABLED } = await loader.load('/scripts/backtest/leakageGuard.mjs');
  const { partitionOf } = await loader.load('/scripts/backtest/partition.mjs');
  const atomStore = await loader.load('/scripts/backtest/atomStore.mjs');
  const selfCheck = await loader.load('/scripts/backtest/atomsSelfCheck.mjs');
  const ladderMod = await loader.load('/scripts/backtest/ladder.mjs');

  const { reconstructPredictionAudit } = await loader.load('/src/utils/predictionAudit/reconstruct.js');
  const { atomizePredictionAudit, predictionAuditCoverage, assertPredictionAuditLive } =
    await loader.load('/src/utils/predictionAudit/atomize.js');
  const sor = await loader.load('/src/utils/standardOfRecord/index.js');
  const { buildBaselineRange } = await loader.load('/src/utils/exploitEngine/preflopAdvisor.js');
  const { getPositionName, getRangePositionCategory } = await loader.load('/src/utils/positionUtils.js');
  const { PRIMITIVE_ACTIONS } = await loader.load('/src/constants/primitiveActions.js');
  const { formatSituationKey } = await loader.load('/src/utils/pokerCore/situationKey.js');

  const ROOT = flag('corpus-root', DEFAULT_CORPUS_ROOT);

  // ── The Read surface: ONE static population-prior range profile, shared by every villain. ──
  // Static on purpose. A per-villain fitted profile would need a training window and would put
  // this run squarely in walk-forward territory; the point here is the atom pipeline, and a
  // simpler surface makes the divergence assertion unambiguous about what moved.
  // Derived through the REAL position functions rather than from a hand-written name list.
  // `getRangePositionCategory` takes (seat, buttonSeat) — not a position name — and a local
  // name->category table would be a second implementation free to drift from the engine's.
  // The corpus always seats the button at 9 (`phhAdapter.BUTTON_SEAT`).
  const CORPUS_BUTTON_SEAT = 9;
  const POPULATION_PROFILE = { ranges: {} };
  for (let seat = 1; seat <= 9; seat += 1) {
    const name = getPositionName(seat, CORPUS_BUTTON_SEAT);
    const cat = getRangePositionCategory(seat, CORPUS_BUTTON_SEAT);
    POPULATION_PROFILE.ranges[name] = {
      open: buildBaselineRange(25, 18, cat),
      coldCall: buildBaselineRange(30, 12, cat),
    };
  }

  const RAISES = new Set([PRIMITIVE_ACTIONS.RAISE, 'raise', '3bet', 'threeBet']);
  const BETS = new Set([PRIMITIVE_ACTIONS.BET, 'bet']);

  /** facingAction from the street prefix. Derived from SEQUENCE STATE, never first-action-only. */
  const facingOf = (street, prev) => {
    if (street === 'preflop') {
      const raises = prev.filter((p) => RAISES.has(p.action)).length;
      return ['none', 'raise', '3bet', '4bet+'][Math.min(raises, 3)];
    }
    const raises = prev.filter((p) => RAISES.has(p.action)).length;
    if (raises >= 2) return '4bet+';
    if (raises === 1) return 'raise';
    return prev.some((p) => BETS.has(p.action)) ? 'bet' : 'none';
  };

  const contextOf = ({ ctx, handData }) => {
    const cat = getRangePositionCategory(ctx.seat, handData.gameState.dealerButtonSeat);
    const facing = facingOf(ctx.street, ctx.prevActionsThisStreet);
    return { actorRole: ctx.actor, street: ctx.street, posCategory: cat, facingAction: facing };
  };
  const keyOf = (c) => [c.actorRole, c.street, c.posCategory, c.facingAction].join('|');

  /**
   * One measurement pass over a Deal Book. Returns everything a Result Card needs.
   */
  const runPass = async ({ files, dealBook, atomSetId, anchorGeneration }) => {
    // REFERENCE_DISABLED is the explicit sentinel, not a convenience: the shipped reference
    // table was mined from the whole corpus, and the guard refuses to be given nothing. This
    // run uses no reference tier at all, and says so rather than passing null.
    const guard = new LeakageGuard({ reference: REFERENCE_DISABLED });
    const writer = await atomStore.openAtomWriter({
      atomSetId, surfaceId: SURFACE_ID, fullSampleRate: 0, anchorGeneration,
    });

    const hits = {};
    const dropped = {};
    const droppedCounts = {};
    const wiredAtoms = [];
    const unwiredAtoms = [];
    const occupancy = new Map();       // `${seat}:${playerId}` -> span
    const skips = {};
    let handIdx = 0;
    // NOT `abstentions`. The schema's `abstentions` means "the surface declared itself out of
    // domain", which never happens here — a POOL-partition exclusion is a LEAKAGE control, and
    // filing it under abstentions would make the census claim a surface behaviour it never had.
    let partitionExcluded = 0;

    for (const f of files) {
      // BUFFER PER FILE, then process. `iterPhhHands` drives a readline async iterator, and
      // awaiting for a long time inside that loop lets the underlying stream close while the
      // iterator is paused — Node then throws ERR_USE_AFTER_CLOSE on the next resume. Every
      // other harness in this directory does synchronous work per hand and never hits it; this
      // one awaits two reconstructions and a store write. One file at a time keeps the memory
      // bounded, so buffering costs nothing that matters.
      const handsInFile = [];
      for await (const hand of iterAppHands(f.path, { site: f.site, stakeLabel: f.stakeLabel }, skips)) {
        handsInFile.push(hand);
      }
      for (const hand of handsInFile) {
        handIdx += 1;

        // Seat occupancy. A property of the TABLE OVER TIME — unrecoverable from atoms, which
        // is why it lives on the set manifest and is tallied here rather than derived later.
        for (const [seat, playerId] of Object.entries(hand.seatPlayers ?? {})) {
          const id = `${f.site}:${playerId}`;
          const k = `${seat}:${id}`;
          if (!occupancy.has(k)) {
            occupancy.set(k, { seat: Number(seat), playerId: id, stackBB: null, joinedAtHand: handIdx, leftAtHand: handIdx });
          } else {
            occupancy.get(k).leftAtHand = handIdx;
          }
        }

        const seeds = { deal: `${f.site}:${hand.handId ?? handIdx}` };
        const situationKeyFor = ({ ctx, handData }) => {
          const c = contextOf({ ctx, handData });
          return formatSituationKey({
            street: c.street, texture: 'na', posCategory: c.posCategory,
            isAgg: false, isIP: false, facingAction: c.facingAction, contextAction: 'na',
          });
        };
        const carriedFor = ({ ctx, handData }) => ({
          ...contextOf({ ctx, handData }),
          source: 'SRC-012',
          pool: `${f.site}:${f.stakeLabel}`,
        });

        const [wiredAudit, unwiredAudit] = await Promise.all([
          reconstructPredictionAudit(hand, { getRangeProfile: () => POPULATION_PROFILE }),
          reconstructPredictionAudit(hand, {}),
        ]);

        const opts = { handData: hand, surfaceId: SURFACE_ID, situationKeyFor, carriedFor, seeds,
          handId: `${f.site}:${hand.handId ?? handIdx}` };
        const wired = atomizePredictionAudit({ ...opts, audit: wiredAudit });
        const unwired = atomizePredictionAudit({ ...opts, audit: unwiredAudit });

        for (let i = 0; i < wired.length; i += 1) {
          const atom = wired[i];
          const playerId = `${f.site}:${hand.seatPlayers?.[atom.actorSeat]}`;
          // STRUCTURAL partition. An EVAL-only atom set cannot be talked into including a
          // POOL player later, which is the failure mode a convention would allow.
          if (partitionOf(playerId) !== 'eval') { partitionExcluded += 1; continue; }
          guard.assertEvalPlayer(playerId);

          const key = keyOf(atom.carried);
          if (atom.skipReason) {
            // Reached, then discarded. NOT a zero, and NOT folded into the hit count — a cell
            // that scored 400 and lost 3 must not read the same as one that lost everything.
            dropped[key] = atom.skipReason;
            droppedCounts[key] = (droppedCounts[key] ?? 0) + 1;
          } else {
            hits[key] = (hits[key] ?? 0) + 1;
          }
          await writer.append(atom);
          wiredAtoms.push(atom);
          if (unwired[i]) unwiredAtoms.push(unwired[i]);
        }
      }
    }

    // THE DIVERGENCE ASSERTION. Inertness is a run failure, not a later discovery.
    const divergence = assertPredictionAuditLive({ wired: wiredAtoms, unwired: unwiredAtoms });

    const seatOccupancy = [...occupancy.values()].map((s) => sor.buildOccupancySpan(s));
    const manifest = await writer.finalize({ seatOccupancy, notes: `WS-328 pass, gen ${anchorGeneration}` });
    const setManifest = sor.buildAtomSetManifest({
      atomSetId, surfaceId: SURFACE_ID, fullSampleRate: 0,
      seatOccupancy, atomCount: manifest.atomCount, anchorGeneration,
    });

    // ── The census. Examination is DECLARED, never inferred. ────────────────────────────
    const all = sor.enumerateContexts(AXES);
    const unreachable = {};
    for (const c of all) {
      if (c.coords.street === 'preflop' && c.coords.facingAction === 'bet') {
        unreachable[c.contextKey] = 'preflop has no bare bet — the BB is a raise';
      }
    }
    // The instrument evaluates every VILLAIN context. It cannot evaluate a HERO one at all:
    // `phhAdapter` sets gameState.mySeat = null because a corpus hand has no hero, so the hero
    // branch of the reconstructor is never taken. Those cells are NOT zeros; they were never
    // looked at, and saying so is the difference between a coverage gap and a measured absence.
    const examined = all
      .filter((c) => c.coords.actorRole === 'villain' && unreachable[c.contextKey] === undefined)
      .map((c) => c.contextKey);

    const census = sor.buildCoverageCensus({
      domain: {
        gameType: 'cash', seats: [3, 9], stackDepthBB: null,
        surfaceId: SURFACE_ID, dealBookId: dealBook.dealBookId, fieldId: FIELD_ID,
      },
      axes: AXES,
      hits,
      dropped,
      droppedCounts,
      unreachable,
      abstentions: 0,
      examination: sor.declareExamination({
        mode: 'enumerated',
        contexts: examined,
        unexaminedReason: sor.UNEXAMINED_REASONS.INSTRUMENT_CANNOT_EVALUATE,
        basis: 'phhAdapter sets gameState.mySeat = null (a corpus hand has no hero), so the hero '
          + 'branch of reconstructPredictionAudit is unreachable on this Deal Book. Villain '
          + 'contexts were all evaluated.',
      }),
    });

    // THE SELF-CHECK. Runs after every Match, reads EVERY captured field, and fails when a
    // field has no reader — the enforcement of the anti-rot rule.
    const check = selfCheck.assertAtomsSelfCheck(wiredAtoms, setManifest);

    return {
      atoms: wiredAtoms, setManifest, storeManifest: manifest, census, check, divergence,
      auditCoverage: predictionAuditCoverage(wiredAtoms), handIdx, skips, guard: guard.summary(),
      partitionExcluded,
    };
  };

  const buildCard = async ({ pass, dealBook, anchorGeneration, resultCardId }) => {
    const cov = sor.censusCoverage(pass.census);
    const stamp = await buildStampInput({
      loader,
      seeds: { deal: 'per-hand: site:handId', partition: 'fnv1a32(site:playerId)' },
      unseededSources: [],   // this pass reaches no Monte Carlo path — a POSITIVE claim
      dealBookHash: dealBook.contentHash,
      fieldVersion: 'population-prior/static',
      partition: 'EVAL(50%) by fnv1a32(site:playerId); walk-forward N/A — the Read surface is a '
        + 'STATIC population prior, fitted nowhere in this run',
    });

    return sor.buildResultCard({
      resultCardId,
      match: { surfaceId: SURFACE_ID, dealBookId: dealBook.dealBookId, fieldId: FIELD_ID },
      estimand:
        'The share of modeled decision nodes on this Deal Book for which the reconstruction '
        + 'instrument emitted an action distribution, over EVAL-partition players, and the share '
        + 'of the declared context domain it examined at all. AN INSTRUMENT MEASUREMENT, NOT A '
        + 'STRATEGY CLAIM.',
      treatment:
        'Substituting a static corpus-mined population prior for each villain\'s range, over '
        + 'recorded 2009 online 50NLH hands. Transferred, not measured, for any live claim.',
      metrics: {
        scoredShare: pass.auditCoverage.scoredGivenModeled.rate,
        scoredGivenModeled: pass.auditCoverage.scoredGivenModeled,
        modeledNodes: pass.auditCoverage.modeledNodes,
        neverLookedGivenReachable: cov.neverLookedGivenReachable,
        observedZeroGivenExamined: cov.observedZeroGivenExamined,
        droppedGivenReachable: cov.droppedGivenReachable,
        predictionAuditDivergence: pass.divergence,
        skipReasons: pass.auditCoverage.skippedBySkipReason,
        droppedDecisions: cov.droppedDecisions,
        partiallyDroppedCells: cov.partiallyDroppedCells,
        partitionExcludedDecisions: pass.partitionExcluded,
        leakage: pass.guard,
      },
      clusterUnit: 'players',
      admissibility: {
        admissible: false,
        reasons: [
          'The Read surface is a population prior mined from this corpus family (SRC-011/012), '
          + 'so it LEAKS BY CONSTRUCTION into any accuracy figure computed on the same corpus. '
          + 'Coverage figures are unaffected; accuracy figures are not computed here for exactly '
          + 'this reason.',
          'Online 2009 50NLH. Any live 1/2-1/3 reading is TRANSFERRED, not measured (register '
          + 'rank-1 entry).',
        ],
        quotableFor: ['instrument coverage', 'never-looked share', 'predictionAudit liveness'],
      },
      manifest: sor.buildReplicationManifest(stamp),
      census: pass.census,
      atomSetHash: pass.storeManifest.atomSetHash,
      atomCount: pass.storeManifest.atomCount,
      anchorGeneration,
    });
  };

  // ═══ GENERATION 1 ═══════════════════════════════════════════════════════════════════
  let files = await discoverCorpusFiles({ root: ROOT, sites: SITES, stakes: STAKES });
  const gen1Files = files.slice(0, MAX_FILES);
  const gen1Book = await buildDealBook({
    files: gen1Files, root: ROOT,
    sliceSpec: { sites: SITES, stakes: STAKES, maxFiles: MAX_FILES, generation: 1 },
    seeds: {}, identity: 'path+size',
  });
  console.log(`Deal Book gen1  ${gen1Book.dealBookId}  ${gen1Book.memberCount} files`);

  const stamp = Date.now();
  const pass1 = await runPass({
    files: gen1Files, dealBook: gen1Book, atomSetId: `ws328-gen1-${stamp}`, anchorGeneration: 1,
  });
  const card1 = await buildCard({
    pass: pass1, dealBook: gen1Book, anchorGeneration: 1, resultCardId: `RC-WS328-GEN1-${stamp}`,
  });

  console.log('');
  console.log(selfCheck.formatSelfCheck(pass1.check));
  console.log('');
  console.log('coverage:', JSON.stringify(sor.censusCoverage(pass1.census), null, 2));
  console.log('never looked:', sor.neverLooked(pass1.census).length, 'contexts;',
    'observed zeros:', sor.observedZeros(pass1.census).length);
  console.log('predictionAudit divergence:', JSON.stringify(pass1.divergence));

  // Atoms resolve BY HASH, or say why not. Never silently.
  const resolved = await atomStore.assertAtomsResolvable(card1);
  console.log(`atoms resolved by hash: ${resolved.manifest.atomCount} atoms at ${resolved.atomSetHash}`);

  // ═══ GENERATION 2 — the Deal Book changes, so the Ladder must REBASE, not reset ═══════
  const gen2Files = files.slice(MAX_FILES, MAX_FILES + REBASE_FILES);
  const gen2Book = await buildDealBook({
    files: gen2Files, root: ROOT,
    sliceSpec: { sites: SITES, stakes: STAKES, maxFiles: REBASE_FILES, generation: 2 },
    seeds: {}, identity: 'path+size',
  });
  console.log(`\nDeal Book gen2  ${gen2Book.dealBookId}  ${gen2Book.memberCount} files (population shifted)`);

  const ladder1 = ladderMod.buildLadder({
    cards: [card1], rebases: [], metricPath: 'metrics.scoredShare',
  });
  console.log(ladderMod.formatLadder(ladder1));

  // The refusal, demonstrated: a gen-2 card dropped into the ladder with no rebase record.
  const orphanPass = await runPass({
    files: gen2Files, dealBook: gen2Book, atomSetId: `ws328-gen2-${stamp}`, anchorGeneration: 2,
  });
  const card2 = await buildCard({
    pass: orphanPass, dealBook: gen2Book, anchorGeneration: 2, resultCardId: `RC-WS328-GEN2-${stamp}`,
  });
  try {
    ladderMod.assertComparable(card1, card2, { rebases: [] });
    console.log('\n!! REFUSAL DID NOT FIRE — the Ladder would have fragmented silently');
  } catch (err) {
    console.log(`\nLadder refusal fired as designed: ${err.message.split('\n')[0]}`);
  }

  // Now the rebase: every prior rung is RE-RUN on the new book.
  const rebased = await ladderMod.rebaseLadder({
    ladder: ladder1,
    toGeneration: 2,
    dealBookHash: gen2Book.contentHash,
    cards: [card1],
    rerun: async () => card2,
  });
  console.log('');
  console.log(ladderMod.formatLadder(rebased.ladder));
  const problems = ladderMod.ladderProblems(rebased.ladder);
  console.log(problems.length ? `LADDER PROBLEMS: ${problems.join(' | ')}`
    : 'Ladder REBASED: every generation-1 rung has a generation-2 counterpart.');

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(`${OUT_DIR}/gen1.card.json`, `${JSON.stringify(card1, null, 2)}\n`, 'utf8');
  await writeFile(`${OUT_DIR}/gen2.card.json`, `${JSON.stringify(card2, null, 2)}\n`, 'utf8');
  await writeFile(`${OUT_DIR}/gen1.census.json`, `${JSON.stringify(pass1.census, null, 2)}\n`, 'utf8');
  await writeFile(`${OUT_DIR}/ladder.json`, `${JSON.stringify(rebased.ladder, null, 2)}\n`, 'utf8');
  await writeFile(`${OUT_DIR}/gen1.selfcheck.json`, `${JSON.stringify(pass1.check, null, 2)}\n`, 'utf8');
  console.log(`\nwrote ${OUT_DIR}/{gen1.card,gen2.card,gen1.census,ladder,gen1.selfcheck}.json`);
} finally {
  await loader.close();
}
