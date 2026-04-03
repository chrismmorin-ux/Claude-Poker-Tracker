/**
 * Tests for record-builder.js — stateless hand record construction
 */

import { describe, it, expect } from 'vitest';
import { buildRecordFromState } from '../record-builder.js';

const baseState = () => ({
  currentStreet: 'river',
  dealerSeat: 3,
  heroSeat: 5,
  actionSequence: [
    { seat: 1, action: 'fold', street: 'preflop', order: 1 },
    { seat: 3, action: 'raise', street: 'preflop', order: 2, amount: 6 },
    { seat: 5, action: 'call', street: 'preflop', order: 3, amount: 6 },
  ],
  communityCards: ['Ac', 'Kd', 'Qh', 'Js', 'Tc'],
  holeCards: ['As', 'Ks'],
  allPlayerCards: {},
  activeSeats: new Set([1, 3, 5]),
  seatPlayers: { 1: 'seat_1', 3: 'seat_3', 5: 'hero' },
  connId: 'conn_42',
  handNumber: 'hand_123',
  blinds: { sb: 0.5, bb: 1 },
  ante: 0,
  gameType: null,
  stacks: { 1: 95, 3: 72, 5: 133 },
  pot: 58,
  potDistribution: [],
  winners: [5],
  seatDisplayMap: {},
});

describe('buildRecordFromState', () => {
  it('builds a valid record from complete state', () => {
    const { record, validation } = buildRecordFromState(baseState());
    expect(validation.valid).toBe(true);
    expect(record).not.toBeNull();
    expect(record.gameState.currentStreet).toBe('river');
    expect(record.gameState.dealerButtonSeat).toBe(3);
    expect(record.gameState.mySeat).toBe(5);
    expect(record.gameState.actionSequence).toHaveLength(3);
    expect(record.cardState.communityCards).toHaveLength(5);
    expect(record.cardState.holeCards).toHaveLength(2);
    expect(record.source).toBe('ignition');
    expect(record.tableId).toBe('table_conn_42');
  });

  it('pads community cards to 5', () => {
    const state = baseState();
    state.communityCards = ['Ac', 'Kd', 'Qh']; // Only flop
    state.currentStreet = 'flop';
    const { record } = buildRecordFromState(state);
    expect(record.cardState.communityCards).toHaveLength(5);
    expect(record.cardState.communityCards[3]).toBe('');
    expect(record.cardState.communityCards[4]).toBe('');
  });

  it('calculates absent seats correctly', () => {
    const state = baseState();
    state.activeSeats = new Set([1, 3, 5]);
    const { record } = buildRecordFromState(state);
    expect(record.gameState.absentSeats).toEqual([2, 4, 6, 7, 8, 9]);
  });

  it('marks hero in seatPlayers', () => {
    const state = baseState();
    state.seatPlayers = { 1: 'seat_1', 3: 'seat_3', 5: 'seat_5' };
    state.heroSeat = 5;
    const { record } = buildRecordFromState(state);
    expect(record.seatPlayers[5]).toBe('hero');
  });

  it('sets finalStreet to showdown when allPlayerCards present', () => {
    const state = baseState();
    state.allPlayerCards = { 3: ['9h', '9d'] };
    const { record } = buildRecordFromState(state);
    expect(record.gameState.currentStreet).toBe('showdown');
  });

  it('defaults currentStreet to preflop when null', () => {
    const state = baseState();
    state.currentStreet = null;
    const { record } = buildRecordFromState(state);
    expect(record.gameState.currentStreet).toBe('preflop');
  });

  it('falls back to dealerSeat=1 when null', () => {
    const state = baseState();
    state.dealerSeat = null;
    const { record } = buildRecordFromState(state);
    expect(record.gameState.dealerButtonSeat).toBe(1);
  });

  it('refuses to emit when heroSeat is null', () => {
    const state = baseState();
    state.heroSeat = null;
    const { record, validation } = buildRecordFromState(state);
    expect(record).toBeNull();
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('heroSeat is null');
  });

  it('includes ignitionMeta with all fields', () => {
    const { record } = buildRecordFromState(baseState());
    expect(record.ignitionMeta.handNumber).toBe('hand_123');
    expect(record.ignitionMeta.blinds).toEqual({ sb: 0.5, bb: 1 });
    expect(record.ignitionMeta.ante).toBe(0);
    expect(record.ignitionMeta.pot).toBe(58);
    expect(record.ignitionMeta.winners).toEqual([5]);
    expect(record.ignitionMeta.finalStacks).toEqual({ 1: 95, 3: 72, 5: 133 });
  });

  it('omits seatDisplayMap when empty', () => {
    const state = baseState();
    state.seatDisplayMap = {};
    const { record } = buildRecordFromState(state);
    expect(record.ignitionMeta.seatDisplayMap).toBeUndefined();
  });

  it('includes seatDisplayMap when populated', () => {
    const state = baseState();
    state.seatDisplayMap = { 1: 42, 3: 43 };
    const { record } = buildRecordFromState(state);
    expect(record.ignitionMeta.seatDisplayMap).toEqual({ 1: 42, 3: 43 });
  });

  it('accepts activeSeats as array (not just Set)', () => {
    const state = baseState();
    state.activeSeats = [1, 3, 5]; // Array instead of Set
    const { record, validation } = buildRecordFromState(state);
    expect(validation.valid).toBe(true);
    expect(record.gameState.absentSeats).toEqual([2, 4, 6, 7, 8, 9]);
  });
});
