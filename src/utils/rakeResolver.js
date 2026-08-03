/**
 * rakeResolver.js — resolve a rake config for the game actually being played.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS DID NOT EXIST, AND WHAT IT COST.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * `potCalculator.estimateRake` has been correct all along. `GAME_TYPES` has carried real
 * rake schedules (1/2 → 10% capped at $8) since the session model was written. The game tree
 * threads `rakeConfig` through every EV branch. And `useLiveActionAdvisor:162` reads
 * `liveHandState.rakeConfig`.
 *
 * Nothing ever WROTE it. No reducer, no context, no component. So `estimateRake` returned 0
 * on every live decision and every EV figure the advisor has ever shown omitted the drop —
 * which at 1/2 is a $5-8 bite out of a pot that is often only $40. WS-333 measured the size
 * of what was missing: rake costs a blind defender **+4.8pp of required equity** live versus
 * +2.3pp on the 2009 online corpus.
 *
 * Two things kept it broken and both are worth stating, because neither was carelessness:
 *
 *   1. **`GAME_TYPES` is keyed by CONSTANT NAME (`ONE_TWO`), sessions store a LABEL
 *      (`'1/2'`).** So the obvious wiring — `GAME_TYPES[session.gameType].rake` — silently
 *      evaluates to `undefined` rather than failing. A lookup that returns nothing looks
 *      exactly like a game with no rake.
 *   2. **Online sessions derive their label from captured wire blinds** (`stakesLabel`), so
 *      an Ignition 0.5/1 table lands on `'0.5/1'`, which is in no `GAME_TYPES` entry at all.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * LIVE AND ONLINE ARE DIFFERENT RAKE REGIMES — AND THE DIFFERENCE IS THE POINT.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * A live 1/2 game takes 10% to $8. An online micro table takes ~5% to $3, and takes it from
 * a pot denominated in the same big blinds. Applying one to the other would be the transfer
 * error WS-333 registered against the corpus, committed inside the app instead of inside a
 * research claim. `venueClassOf` keeps them apart, and it keys off the SOURCE of the hand,
 * not off a stake label that both regimes can produce.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * AN UNKNOWN RAKE IS NOT A ZERO RAKE.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Every resolution returns a `tier` and a `reason`. When the game cannot be identified this
 * returns `rakeConfig: null` WITH `tier: 'unknown'` — which a caller can surface, log, or
 * refuse on. That is deliberately different from `tier: 'none'` (tournament — genuinely no
 * rake). The whole defect above was a `null` that read as "no rake" when it meant "nobody
 * said", and replacing it with a different silent null would be the same bug with newer code.
 */

import { GAME_TYPES } from '../constants/sessionConstants';
import { rakeForRoom } from '../constants/rakeStructures';

/**
 * Online rake schedule, by big blind.
 *
 * FOUNDER-CONFIGURABLE AND CURRENTLY AN ESTIMATE. These are typical US-facing online cash
 * schedules, not a scrape of Ignition's published table — the wire capture does not carry
 * the rake schedule, so this cannot be derived from the hand history. It is named, exported
 * and tiered as `online-default` so a figure computed under it is identifiable as resting on
 * an assumption rather than a measurement.
 *
 * `noFlopNoDrop` is true throughout: standard everywhere, and it is the property that creates
 * the untaxed-steal / taxed-defend asymmetry WS-333 measures.
 */
export const ONLINE_RAKE_SCHEDULE = [
  { maxBB: 0.10, rake: { pct: 0.05, cap: 1.00, noFlopNoDrop: true } },
  { maxBB: 0.25, rake: { pct: 0.05, cap: 1.50, noFlopNoDrop: true } },
  { maxBB: 0.50, rake: { pct: 0.05, cap: 2.00, noFlopNoDrop: true } },
  { maxBB: 1.00, rake: { pct: 0.05, cap: 3.00, noFlopNoDrop: true } },
  { maxBB: 2.00, rake: { pct: 0.05, cap: 3.00, noFlopNoDrop: true } },
  { maxBB: 5.00, rake: { pct: 0.05, cap: 3.50, noFlopNoDrop: true } },
  { maxBB: Infinity, rake: { pct: 0.05, cap: 5.00, noFlopNoDrop: true } },
];

/** Hand sources that mean "captured from an online client". */
const ONLINE_SOURCES = new Set(['ignition', 'online']);

/**
 * Which rake regime applies. Keyed off the SOURCE of the hand, never off the stake label —
 * a live 1/2 game and an online 1/2 game produce the same label and take very different rake.
 */
export const venueClassOf = ({ source, venue } = {}) => {
  if (source && ONLINE_SOURCES.has(String(source).toLowerCase())) return 'online';
  // A named physical venue is live by construction.
  if (venue) return 'live';
  return source ? 'live' : 'unknown';
};

/**
 * Normalize a stake label to `sb/bb` numbers.
 *
 * Accepts everything the app actually stores: `'1/2'`, `'$1/$2'`, `'1/2 NL'`, `'0.5/1'`, and
 * the legacy placeholder `'NL Holdem'` (which yields null — it carries no stakes).
 */
export const parseStakeLabel = (label) => {
  if (typeof label !== 'string') return null;
  const m = label.replace(/\$/g, '').match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const sb = Number.parseFloat(m[1]);
  const bb = Number.parseFloat(m[2]);
  if (!Number.isFinite(sb) || !Number.isFinite(bb) || bb <= 0) return null;
  return { sb, bb };
};

/**
 * Canonical `sb/bb` key for a stake label, so `'$1/$3'`, `'1/3 NL'` and `'1/3'` all reach the
 * same registry entry. The registry is keyed on this normalized form, never on raw input.
 */
export const stakeKeyFor = (label) => {
  const s = parseStakeLabel(label);
  return s ? `${s.sb}/${s.bb}` : null;
};

/** The GAME_TYPES entry whose label matches this stake label, if any. */
const liveGameTypeFor = (label) => {
  const stakes = parseStakeLabel(label);
  if (!stakes) return null;
  for (const [key, cfg] of Object.entries(GAME_TYPES)) {
    const entry = parseStakeLabel(cfg.label);
    if (entry && entry.sb === stakes.sb && entry.bb === stakes.bb) return { key, cfg };
  }
  return null;
};

const onlineRakeFor = (bb) => {
  for (const band of ONLINE_RAKE_SCHEDULE) {
    if (bb <= band.maxBB) return band.rake;
  }
  return ONLINE_RAKE_SCHEDULE[ONLINE_RAKE_SCHEDULE.length - 1].rake;
};

/**
 * Resolve the rake config for a session/hand.
 *
 * @param {object} p
 * @param {string} [p.gameType] - the session's stored label, e.g. '1/2' or '0.5/1'
 * @param {object} [p.blinds]   - `{sb, bb}` when captured from the wire; beats the label
 * @param {string} [p.source]   - 'ignition' | 'live' | undefined
 * @param {string} [p.venue]    - physical venue name, when known
 * @param {object|null} [p.override] - an explicit config always wins (settings, a test)
 * @returns {{rakeConfig: object|null, tier: string, reason: string, venueClass: string}}
 */
export const resolveRakeConfig = ({
  gameType, blinds, source, venue, override = null,
} = {}) => {
  if (override) {
    return {
      rakeConfig: override, tier: 'override', venueClass: venueClassOf({ source, venue }),
      reason: 'explicit rake config supplied by the caller',
    };
  }

  const venueClass = venueClassOf({ source, venue });
  const label = typeof gameType === 'string' ? gameType : null;

  // Tournaments have no rake at all — a genuine zero, not an unknown one.
  if (label && /tournament/i.test(label)) {
    return { rakeConfig: null, tier: 'none', venueClass, reason: 'tournament — no rake' };
  }

  if (venueClass === 'online') {
    const stakes = blinds?.bb > 0 ? blinds : parseStakeLabel(label);
    if (!stakes) {
      return {
        rakeConfig: null, tier: 'unknown', venueClass,
        reason: 'online session with no captured blinds and an unparseable stake label '
          + `(${label ?? 'none'}) — rake NOT applied, and that is a gap, not a zero`,
      };
    }
    return {
      rakeConfig: onlineRakeFor(stakes.bb), tier: 'online-default', venueClass,
      reason: `online schedule for ${stakes.sb}/${stakes.bb} — an ESTIMATE; the wire capture `
        + 'does not carry the rake schedule',
    };
  }

  // Live, and we know WHICH ROOM: use its published schedule. This is the only tier that
  // carries a real percentage-plus-flat-drop structure, which is what Chicago rooms actually
  // take — and the tier a profitability comparison between rooms has to be built on.
  if (venue) {
    const room = rakeForRoom(venue, stakeKeyFor(label));
    if (room) {
      return {
        rakeConfig: room.rakeConfig, tier: `room:${room.confidence}`, venueClass: 'live',
        reason: `${venue} ${stakeKeyFor(label)} — read ${room.verifiedAt} from ${room.source}. `
          + 'Rake schedules change without notice; re-verify before this reaches a conclusion.',
        source: room.source,
      };
    }
  }

  // Live, room unknown or unregistered: fall back to the founder-configured stake defaults.
  const match = liveGameTypeFor(label);
  if (match) {
    return {
      rakeConfig: match.cfg.rake, tier: 'configured', venueClass: 'live',
      reason: `GAME_TYPES.${match.key} (${match.cfg.label}) — a stake-level default, not this `
        + 'room\'s published schedule',
    };
  }

  return {
    rakeConfig: null, tier: 'unknown', venueClass,
    reason: `no rake schedule for game type "${label ?? 'none'}" — rake NOT applied. `
      + 'Add a GAME_TYPES entry for this stake, or pass an override.',
  };
};
