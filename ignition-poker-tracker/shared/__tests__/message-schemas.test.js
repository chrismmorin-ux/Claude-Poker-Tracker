import { describe, it, expect } from 'vitest';
import { validateMessage } from '../message-schemas.js';

describe('message-schemas — capture-port validators (RT-65)', () => {
  describe('hand_complete', () => {
    it('accepts a valid hand object', () => {
      expect(validateMessage('hand_complete', { type: 'hand_complete', hand: { id: 'h1' } })).toBeNull();
    });
    it('rejects missing hand', () => {
      expect(validateMessage('hand_complete', { type: 'hand_complete' })).toMatch(/hand/);
    });
    it('rejects non-object hand', () => {
      expect(validateMessage('hand_complete', { type: 'hand_complete', hand: 'oops' })).toMatch(/hand/);
    });
  });

  describe('pipeline_diagnostics', () => {
    it('accepts a valid data object', () => {
      expect(validateMessage('pipeline_diagnostics', { type: 'pipeline_diagnostics', data: { foo: 1 } })).toBeNull();
    });
    it('rejects missing data', () => {
      expect(validateMessage('pipeline_diagnostics', { type: 'pipeline_diagnostics' })).toMatch(/data/);
    });
  });

  describe('recovery_needed', () => {
    it('accepts a reason string', () => {
      expect(validateMessage('recovery_needed', { type: 'recovery_needed', reason: 'silence' })).toBeNull();
    });
    it('accepts a message string', () => {
      expect(validateMessage('recovery_needed', { type: 'recovery_needed', message: 'reload' })).toBeNull();
    });
    it('rejects both missing', () => {
      expect(validateMessage('recovery_needed', { type: 'recovery_needed' })).toMatch(/reason|message/);
    });
  });

  describe('recovery_cleared', () => {
    it('accepts empty message', () => {
      expect(validateMessage('recovery_cleared', { type: 'recovery_cleared' })).toBeNull();
    });
  });

  describe('silence_alert', () => {
    it('accepts numeric silenceMs', () => {
      expect(validateMessage('silence_alert', { type: 'silence_alert', silenceMs: 30000 })).toBeNull();
    });
    it('rejects missing silenceMs', () => {
      expect(validateMessage('silence_alert', { type: 'silence_alert' })).toMatch(/silenceMs/);
    });
    it('rejects non-numeric silenceMs', () => {
      expect(validateMessage('silence_alert', { type: 'silence_alert', silenceMs: 'forever' })).toMatch(/silenceMs/);
    });
  });

  it('rejects unknown message types', () => {
    expect(validateMessage('__not_a_type__', {})).toMatch(/unknown/);
  });
});
