/**
 * ladder.mjs — the persistent comparison across all Result Cards (WS-328).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THE ANCHOR IS, AND WHAT IT IS NOT.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * THE ANCHOR IS: the Deal Book + the Field + the metric definitions.
 * THE ANCHOR IS NOT: the engine version. That is an INPUT recorded on the card, so an engine
 * upgrade is a RE-RUN whose delta is attributable to the upgrade. If the engine were part of
 * the anchor, every upgrade would silently reset the comparison and the one thing you most want
 * to measure — did the upgrade help — would be the one thing you could not.
 *
 * When the Deal Book itself must change (population shift, new stakes), that is a NEW
 * GENERATION. Every prior card is re-run on the new book so the Ladder REBASES rather than
 * RESETS. Skipping the rebase re-run fragments the Ladder, which is the named risk on
 * `prog-strategy-of-record`, and `ladderProblems` is what detects it having happened.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE REFUSAL IS A THROW.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Two cards on different Deal Books are two numbers about different hands. Ranking them
 * produces an ordering that looks exactly like a real one. There is no visual difference
 * between a fragmented ladder and a sound one, which is why a warning would be read once and
 * ignored — the same argument `strategyCard`'s loader makes for rejecting rather than warning.
 */

export class LadderRefusal extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = 'LadderRefusal';
    Object.assign(this, detail);
  }
}

/** Read a dotted path out of a card, e.g. 'metrics.evBB100'. */
const at = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/** A rung is a SURFACE. The ladder ranks surfaces; a generation is which book they stood on. */
export const rungIdOf = (card) => card?.match?.surfaceId ?? null;

/**
 * Are two generations linked by a recorded rebase?
 *
 * Transitive: a card at generation 1 is comparable to one at generation 3 only if 1→2 and 2→3
 * were both rebased AND both carry this surface. Anything weaker would let a chain with one
 * missing link read as continuous.
 */
export const rebaseLinks = (from, to, rebases = []) => {
  if (from === to) return true;
  const [lo, hi] = from < to ? [from, to] : [to, from];
  for (let g = lo; g < hi; g += 1) {
    const step = rebases.find((r) => r.fromGeneration === g && r.toGeneration === g + 1);
    if (!step) return false;
  }
  return true;
};

/**
 * Refuse to compare across unrebased generations.
 *
 * @throws {LadderRefusal}
 */
export const assertComparable = (a, b, { rebases = [] } = {}) => {
  const ga = a?.anchorGeneration ?? null;
  const gb = b?.anchorGeneration ?? null;
  if (ga == null || gb == null) {
    throw new LadderRefusal(
      `Result Card "${(ga == null ? a : b)?.resultCardId}" does not name its anchorGeneration, so `
      + 'the Ladder cannot tell whether it stands on the same Deal Book as anything else. '
      + 'Without that field the cross-generation refusal is unenforceable and the Ladder '
      + 'silently fragments.',
      { a: a?.resultCardId, b: b?.resultCardId },
    );
  }
  if (ga !== gb && !rebaseLinks(ga, gb, rebases)) {
    throw new LadderRefusal(
      `Refusing to compare "${a.resultCardId}" (generation ${ga}) with "${b.resultCardId}" `
      + `(generation ${gb}): no recorded rebase links them. They were measured on different Deal `
      + 'Books, so the ordering would be about different hands — and a fragmented ladder is '
      + 'visually indistinguishable from a sound one.',
      { a: a.resultCardId, b: b.resultCardId, generations: [ga, gb] },
    );
  }
  // Same generation must also mean the same book. A generation number is a label; the hash is
  // the fact, and a label that disagrees with its fact is worse than no label.
  if (ga === gb && a?.manifest?.dealBookHash !== b?.manifest?.dealBookHash) {
    throw new LadderRefusal(
      `"${a.resultCardId}" and "${b.resultCardId}" both claim generation ${ga} but stand on `
      + `different Deal Books (${a?.manifest?.dealBookHash} vs ${b?.manifest?.dealBookHash}). `
      + 'The generation number is a label; the hash is the fact.',
      { a: a.resultCardId, b: b.resultCardId },
    );
  }
  return true;
};

/**
 * Build a Ladder over Result Cards.
 *
 * @param {Object} params
 * @param {Array}  params.cards - Result Cards
 * @param {Array}  [params.rebases] - `[{fromGeneration, toGeneration, dealBookHash, rungIds}]`
 * @param {string} params.metricPath - dotted path to the ranked figure, e.g. 'metrics.evBB100'
 * @param {boolean} [params.higherIsBetter]
 */
export const buildLadder = ({ cards = [], rebases = [], metricPath, higherIsBetter = true } = {}) => {
  if (!metricPath) {
    throw new LadderRefusal(
      'buildLadder: metricPath is required. A ladder without a named metric is ranking whatever '
      + 'field happened to be present, which is how two incomparable numbers end up adjacent.',
    );
  }
  const generations = new Map();
  for (const card of cards) {
    const g = card?.anchorGeneration;
    if (g == null) {
      throw new LadderRefusal(
        `Result Card "${card?.resultCardId}" has no anchorGeneration and cannot enter a Ladder.`,
        { resultCardId: card?.resultCardId },
      );
    }
    if (!generations.has(g)) generations.set(g, []);
    generations.get(g).push(card);
  }

  const rungs = [];
  for (const [generation, group] of [...generations.entries()].sort((a, b) => a[0] - b[0])) {
    // Every card inside one generation must be mutually comparable, or the generation itself
    // is already fragmented and nothing built on top of it means anything.
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) assertComparable(group[i], group[j], { rebases });
    }
    const ranked = [...group]
      .map((card) => ({
        rungId: rungIdOf(card),
        resultCardId: card.resultCardId,
        value: at(card, metricPath) ?? null,
        dealBookHash: card?.manifest?.dealBookHash ?? null,
        engineCommit: card?.manifest?.engineCommit ?? null,
        atomSetHash: card?.atomSetHash ?? null,
        admissible: card?.admissibility?.admissible ?? null,
      }))
      .sort((a, b) => {
        if (a.value == null) return 1;
        if (b.value == null) return -1;
        return higherIsBetter ? b.value - a.value : a.value - b.value;
      })
      .map((r, i) => ({ ...r, rank: i + 1 }));
    rungs.push({ generation, ranked, dealBookHash: group[0]?.manifest?.dealBookHash ?? null });
  }

  return Object.freeze({
    metricPath,
    higherIsBetter,
    generations: rungs,
    rebases: [...rebases],
    cardCount: cards.length,
  });
};

/**
 * Did the Ladder REBASE or did it RESET?
 *
 * A reset is the named risk and it is silent: the newest generation simply has fewer rungs, and
 * a reader looking at one generation cannot see the ones that vanished. So the check is on the
 * rung SETS, not on the counts.
 */
export const ladderProblems = (ladder) => {
  const problems = [];
  for (let i = 1; i < ladder.generations.length; i += 1) {
    const prev = ladder.generations[i - 1];
    const cur = ladder.generations[i];
    const prevRungs = new Set(prev.ranked.map((r) => r.rungId));
    const curRungs = new Set(cur.ranked.map((r) => r.rungId));
    const lost = [...prevRungs].filter((r) => !curRungs.has(r));
    const rebase = ladder.rebases.find(
      (r) => r.fromGeneration === prev.generation && r.toGeneration === cur.generation,
    );
    if (!rebase) {
      problems.push(
        `generation ${prev.generation} -> ${cur.generation} has no rebase record: the Ladder RESET `
        + 'rather than rebasing, so nothing before the new Deal Book can be compared to anything '
        + 'after it',
      );
    }
    if (lost.length) {
      problems.push(
        `generation ${cur.generation} is missing rungs present at ${prev.generation}: `
        + `${lost.join(', ')}. Skipping the rebase re-run for a surface FRAGMENTS the Ladder — `
        + 'the surface still has a number, it just no longer has a comparable one.',
      );
    }
  }
  return problems;
};

/**
 * Rebase a Ladder onto a new Deal Book generation.
 *
 * `rerun(rungId, priorCard)` must produce a Result Card measured on the NEW book. Every rung is
 * re-run; a rung whose re-run throws is reported rather than dropped, because a dropped rung is
 * exactly the silent fragmentation this function exists to prevent.
 *
 * @returns {Promise<{ladder, rebase, failures}>}
 */
export const rebaseLadder = async ({
  ladder,
  toGeneration,
  dealBookHash,
  rerun,
  cards = [],
} = {}) => {
  const latest = ladder.generations[ladder.generations.length - 1];
  if (!latest) throw new LadderRefusal('rebaseLadder: the ladder has no generations to rebase');
  if (toGeneration <= latest.generation) {
    throw new LadderRefusal(
      `rebaseLadder: toGeneration ${toGeneration} must be above the current ${latest.generation}. `
      + 'Generations are additive, like every other schema here — a reused number would make two '
      + 'different Deal Books share an identity.',
    );
  }

  const newCards = [];
  const failures = [];
  for (const rung of latest.ranked) {
    const priorCard = cards.find((c) => c.resultCardId === rung.resultCardId);
    try {
      const card = await rerun(rung.rungId, priorCard);
      if (card.anchorGeneration !== toGeneration) {
        throw new LadderRefusal(
          `rerun of "${rung.rungId}" produced a card at generation ${card.anchorGeneration}, `
          + `expected ${toGeneration}`,
        );
      }
      newCards.push(card);
    } catch (err) {
      failures.push({ rungId: rung.rungId, error: err?.message ?? String(err) });
    }
  }

  const rebase = {
    fromGeneration: latest.generation,
    toGeneration,
    dealBookHash,
    rungIds: newCards.map((c) => rungIdOf(c)),
    rebasedAt: new Date().toISOString(),
    // Recorded ON the rebase rather than discovered later. A rebase that silently covered 3 of
    // 4 rungs and a rebase that covered all 4 must not look the same in six months.
    failedRungIds: failures.map((f) => f.rungId),
  };

  return {
    ladder: buildLadder({
      cards: [...cards, ...newCards],
      rebases: [...ladder.rebases, rebase],
      metricPath: ladder.metricPath,
      higherIsBetter: ladder.higherIsBetter,
    }),
    rebase,
    newCards,
    failures,
  };
};

/** Human-readable dump, generation by generation. */
export const formatLadder = (ladder) => {
  const lines = [`Ladder on ${ladder.metricPath} (${ladder.cardCount} cards)`];
  for (const g of ladder.generations) {
    lines.push(`  generation ${g.generation}  book ${g.dealBookHash}`);
    for (const r of g.ranked) {
      lines.push(`    #${r.rank} ${String(r.rungId).padEnd(28)} ${r.value == null ? 'n/a' : r.value.toFixed(4)}  ${r.resultCardId}`);
    }
  }
  const problems = ladderProblems(ladder);
  lines.push(problems.length ? `  PROBLEMS:\n    - ${problems.join('\n    - ')}` : '  no fragmentation detected');
  return lines.join('\n');
};
