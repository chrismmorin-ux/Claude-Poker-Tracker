/**
 * handProvenance.js — positive provenance identity for hand records (WS-368).
 *
 * THE PROBLEM THIS EXISTS TO KILL. Before this module, a hand's provenance was
 * inferred from a field being UNDEFINED: `saveOnlineHand` stamped
 * `source: 'ignition'` and the manual/live path stamped nothing, so "live" was
 * the ABSENCE of a marker. Three consequences followed, all real rather than
 * hypothetical:
 *
 *   1. The live subset could not be SELECTED — `getHandsBySource('live')`
 *      returned [] on a database full of live hands.
 *   2. The import path (`exportUtils.importAllData`) called `saveHand`, which
 *      stamped nothing, so every imported hand silently JOINED the live set.
 *   3. An absence cannot carry a venue, a stake, or a schema version, so the
 *      population a number was measured on could never be stated.
 *
 * (3) is why this is not a one-line enum. FAULT-population-mismatch — the
 * rank-1 entry of the suspected-fault register — is about POPULATION: a live
 * 1/2 hand and a live 1/3 hand at a different venue are different populations.
 * A stamp that cannot tell those apart does not settle the fault it exists to
 * settle. So the stamp is a STRUCTURED object, not a string; encoding venue and
 * stake into the string ("live-windcreek-1_3") would make every future consumer
 * parse prose.
 *
 * THE SHAPE. Every stamp is the pair:
 *
 *   {
 *     source: 'live' | 'ignition' | 'import' | 'unknown',   // indexed scalar
 *     provenance: {
 *       channel,        // ALWAYS === source. The scalar is a projection of the
 *                       //   object, not a second independent field.
 *       venue,          // string | null   — where the hand was played
 *       stakeLabel,     // string | null   — verbatim, e.g. '1/3', 'NL Holdem'
 *       stake,          // { sb, bb } | null — structured, ONLY when known
 *       stampedAt,      // number (ms)
 *       schemaVersion,  // number
 *       ...channel-specific fields
 *     }
 *   }
 *
 * `source` stays a scalar because the `hands.source` index (v12) needs it and
 * `getHandsBySource` filters on it. It is produced only here, so the scalar and
 * the object cannot drift apart.
 *
 * WHY CONSTRUCTORS RATHER THAN VALIDATION. Repo doctrine is "prefer
 * unrepresentable to validated" — shrink the payload at construction rather
 * than checking it after the fact. There is no way to hand-write a stamp: the
 * channel is not a parameter of any constructor, it is baked into the
 * constructor's identity. `liveHandProvenance` can only produce a live stamp;
 * `importedHandProvenance` can only produce an import stamp. A caller cannot
 * pass the wrong channel because there is no channel argument to get wrong.
 * `validateHandRecord` still rejects an unstamped record, but that is a belt
 * over braces, not the mechanism.
 *
 * NOTHING HERE GUESSES. Unknown venue is `null`, not a default. Unknown stake
 * is `null`, not a parse of whatever prose happened to be in `gameType`. The
 * whole point of the module is that a stated fact and an absent fact are
 * distinguishable; manufacturing a fact to fill a field would reintroduce
 * exactly the failure it removes.
 */

/**
 * The closed set of hand provenance channels.
 *
 * `unknown` is load-bearing and is NOT a placeholder for "we'll fill it in
 * later". It is the honest value for a row whose provenance genuinely cannot
 * be recovered — recorded before stamping existed, and therefore possibly
 * live, possibly manually entered, possibly imported from a file. Writing
 * 'live' onto such a row would manufacture the exact fact the register's
 * falsifier is supposed to measure, and would do so irreversibly.
 */
export const HAND_SOURCE = Object.freeze({
  LIVE: 'live',
  IGNITION: 'ignition',
  IMPORT: 'import',
  UNKNOWN: 'unknown',
});

/** Every legal `source` value, in no significant order. */
export const HAND_SOURCES = Object.freeze(Object.values(HAND_SOURCE));

/**
 * Provenance object schema version. Bump when the shape of `provenance`
 * changes so a reader can tell which fields it may rely on. Independent of
 * DB_VERSION: the IDB schema version says when rows moved, this says what a
 * row's provenance object means.
 */
export const PROVENANCE_SCHEMA_VERSION = 1;

/** Reason recorded on rows stamped `unknown` by the v28 migration. */
export const UNKNOWN_REASON_PRE_STAMPING = 'recorded-before-provenance-stamping';

/** @param {*} value @returns {boolean} true if `value` is a legal source. */
export const isHandSource = (value) => HAND_SOURCES.includes(value);

/**
 * Parse a stake label into structured blinds, or null when it does not parse.
 *
 * DELIBERATELY STRICT. Only `N/M` (optionally $-prefixed / spaced) yields a
 * number pair. 'NL Holdem', '1/2/5 with straddle', '' and undefined all yield
 * null — an unparsed label is recorded verbatim in `stakeLabel` and `stake`
 * stays null. Inventing {sb:1, bb:2} from a label we did not understand is the
 * guessing this module exists to prevent.
 *
 * @param {*} label
 * @returns {{sb: number, bb: number} | null}
 */
export const parseStakeLabel = (label) => {
  if (typeof label !== 'string') return null;
  const match = /^\s*\$?\s*(\d+(?:\.\d+)?)\s*\/\s*\$?\s*(\d+(?:\.\d+)?)\s*$/.exec(label);
  if (!match) return null;
  const sb = Number(match[1]);
  const bb = Number(match[2]);
  if (!(sb > 0) || !(bb > 0)) return null;
  return { sb, bb };
};

/**
 * Normalize a session's stake information into the (label, structured) pair.
 * Online sessions carry a validated `stakes` object; live sessions carry only
 * a `gameType` label the founder typed. Prefer the object, fall back to
 * parsing the label, never invent.
 *
 * @param {Object|null|undefined} session
 * @returns {{stakeLabel: string|null, stake: {sb: number, bb: number}|null}}
 */
const stakeFromSession = (session) => {
  const rawLabel = session?.gameType;
  const stakeLabel = typeof rawLabel === 'string' && rawLabel.length > 0 ? rawLabel : null;
  const declared = session?.stakes;
  const stake =
    declared && typeof declared.sb === 'number' && typeof declared.bb === 'number'
      ? { sb: declared.sb, bb: declared.bb }
      : parseStakeLabel(stakeLabel);
  return { stakeLabel, stake };
};

/** Freeze both halves so the scalar and the object cannot be edited apart. */
const sealStamp = (source, provenance) =>
  Object.freeze({
    source,
    provenance: Object.freeze({
      channel: source,
      schemaVersion: PROVENANCE_SCHEMA_VERSION,
      ...provenance,
    }),
  });

/**
 * Stamp for a hand recorded at a physical table by the founder (the manual /
 * live-entry path).
 *
 * Venue and stake come from the ACTIVE SESSION record — the place the founder
 * actually declared them — not from a default. With no active session both are
 * null: the hand is still positively `live`, we simply do not know where.
 *
 * @param {Object|null} session - active session record, or null
 * @param {{stampedAt?: number}} [opts]
 * @returns {{source: 'live', provenance: Object}}
 */
export const liveHandProvenance = (session, opts = {}) => {
  const { stakeLabel, stake } = stakeFromSession(session);
  return sealStamp(HAND_SOURCE.LIVE, {
    venue: typeof session?.venue === 'string' && session.venue.length > 0 ? session.venue : null,
    stakeLabel,
    stake,
    sessionId: session?.sessionId ?? null,
    stampedAt: opts.stampedAt ?? Date.now(),
  });
};

/**
 * Stamp for a hand captured from the Ignition extension's WebSocket feed.
 *
 * @param {Object|null} session - online session record (venue 'Ignition')
 * @param {{tableId?: string|null, stampedAt?: number}} [opts]
 * @returns {{source: 'ignition', provenance: Object}}
 */
export const ignitionHandProvenance = (session, opts = {}) => {
  const { stakeLabel, stake } = stakeFromSession(session);
  return sealStamp(HAND_SOURCE.IGNITION, {
    venue: typeof session?.venue === 'string' && session.venue.length > 0 ? session.venue : 'Ignition',
    stakeLabel,
    stake,
    tableId: opts.tableId ?? session?.tableId ?? null,
    sessionId: session?.sessionId ?? null,
    stampedAt: opts.stampedAt ?? Date.now(),
  });
};

/**
 * Stamp for a hand that arrived through the backup-import path.
 *
 * THE CONTAMINATION VECTOR, CLOSED. An imported hand is `import`, never `live`,
 * even when the file it came from claimed otherwise. Whatever the file said is
 * preserved verbatim under `original` — kept as evidence, not promoted to
 * truth. A hand round-tripped through export and import is therefore
 * distinguishable from one recorded at the table, which is the whole point:
 * before this, it was not.
 *
 * @param {{source?: *, provenance?: *}} incoming - the record as it appeared in the file
 * @param {{importedAt?: number, stampedAt?: number}} [opts]
 * @returns {{source: 'import', provenance: Object}}
 */
export const importedHandProvenance = (incoming, opts = {}) => {
  const claimedSource = isHandSource(incoming?.source) ? incoming.source : null;
  const claimedProvenance =
    incoming?.provenance && typeof incoming.provenance === 'object' && !Array.isArray(incoming.provenance)
      ? incoming.provenance
      : null;
  const now = opts.stampedAt ?? Date.now();
  return sealStamp(HAND_SOURCE.IMPORT, {
    // Venue/stake are NOT copied up from the claim. They would read as measured
    // facts about this row; they are hearsay from a file. They stay reachable
    // under `original` for anyone who wants to weigh them.
    venue: null,
    stakeLabel: null,
    stake: null,
    importedAt: opts.importedAt ?? now,
    original: claimedSource || claimedProvenance
      ? Object.freeze({ source: claimedSource, provenance: claimedProvenance })
      : null,
    stampedAt: now,
  });
};

/**
 * Stamp for a row whose provenance is genuinely unrecoverable.
 *
 * Written ONLY by the v28 migration, over rows that predate stamping. Not
 * reachable from any write path — a new hand always knows where it came from,
 * so there is no honest way for one to be born `unknown`.
 *
 * @param {{reason?: string, observedSource?: *, stampedAt?: number}} [opts]
 * @returns {{source: 'unknown', provenance: Object}}
 */
export const unknownHandProvenance = (opts = {}) =>
  sealStamp(HAND_SOURCE.UNKNOWN, {
    venue: null,
    stakeLabel: null,
    stake: null,
    reason: opts.reason ?? UNKNOWN_REASON_PRE_STAMPING,
    // What the row literally had in `source` before the migration touched it,
    // so a later forensic pass can tell "field absent" from "field garbage".
    observedSource: opts.observedSource ?? null,
    stampedAt: opts.stampedAt ?? Date.now(),
  });

/**
 * Rebuild a full stamp for a row that already carries a trustworthy scalar
 * `source` but predates the structured object (e.g. pre-v28 Ignition hands).
 * The channel is READ from the row, never chosen — this promotes a fact that
 * was already positively recorded, it does not create one.
 *
 * @param {*} observedSource
 * @param {{stampedAt?: number}} [opts]
 * @returns {{source: string, provenance: Object} | null} null if unusable
 */
export const backfillHandProvenance = (observedSource, opts = {}) => {
  if (!isHandSource(observedSource) || observedSource === HAND_SOURCE.UNKNOWN) return null;
  return sealStamp(observedSource, {
    venue: observedSource === HAND_SOURCE.IGNITION ? 'Ignition' : null,
    stakeLabel: null,
    stake: null,
    // Distinguishes "stamped when the hand was written" from "reconstructed
    // from the scalar at migration time" — the second is weaker evidence.
    backfilled: true,
    stampedAt: opts.stampedAt ?? Date.now(),
  });
};

/**
 * Structural problems with a record's provenance pair, as messages.
 * Empty array means the pair is well-formed and self-consistent.
 *
 * @param {Object} record - a hand record
 * @returns {string[]}
 */
export const handProvenanceProblems = (record) => {
  const problems = [];
  const source = record?.source;

  if (source === undefined || source === null) {
    problems.push(
      `Missing source — every hand must carry a positive provenance value (one of: ${HAND_SOURCES.join(', ')})`,
    );
    return problems;
  }
  if (!isHandSource(source)) {
    problems.push(`source must be one of: ${HAND_SOURCES.join(', ')} (got ${JSON.stringify(source)})`);
  }

  const p = record?.provenance;
  if (p === undefined || p === null) {
    problems.push('Missing provenance object — the stamp carries venue and stake, not just a bare source');
    return problems;
  }
  if (typeof p !== 'object' || Array.isArray(p)) {
    problems.push('provenance must be an object');
    return problems;
  }
  if (p.channel !== source) {
    problems.push(`provenance.channel (${JSON.stringify(p.channel)}) must equal source (${JSON.stringify(source)})`);
  }
  if (typeof p.schemaVersion !== 'number') {
    problems.push('provenance.schemaVersion must be a number');
  }
  if (p.venue !== null && p.venue !== undefined && typeof p.venue !== 'string') {
    problems.push('provenance.venue must be a string or null');
  }
  if (p.stakeLabel !== null && p.stakeLabel !== undefined && typeof p.stakeLabel !== 'string') {
    problems.push('provenance.stakeLabel must be a string or null');
  }
  if (p.stake !== null && p.stake !== undefined) {
    if (typeof p.stake !== 'object' || typeof p.stake.sb !== 'number' || typeof p.stake.bb !== 'number') {
      problems.push('provenance.stake must be {sb: number, bb: number} or null');
    }
  }
  return problems;
};
