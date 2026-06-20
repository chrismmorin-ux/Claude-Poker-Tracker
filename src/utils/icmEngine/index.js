/**
 * icmEngine — Independent Chip Model for tournament strategy.
 *
 * 4th peer engine (alongside exploitEngine/, rangeEngine/, pokerCore/).
 * Governed by POKER_THEORY.md §10 under prog-domain-correctness. See ./CLAUDE.md.
 *
 * Pure functions: chip stacks + payout ladder → $EV, and the ICM risk premium
 * that makes tournament all-in decisions correct (chip-EV is wrong near the money).
 */

export { computeIcmEquity, proportionalEquity, MAX_ICM_FIELD } from './malmuthHarville';
export { buildIcmStacks } from './buildIcmStacks';
export { computeRiskPremium, computeHeroPressure } from './riskPremium';
