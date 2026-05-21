// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  logFirstActionSeat,
  logAutoSelectFiring,
  __setDevGateOverride,
} from '../seatSelectionTelemetry';

describe('seatSelectionTelemetry', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    __setDevGateOverride(null);
  });

  describe('logFirstActionSeat', () => {
    it('emits a console.log line when dev gate is open', () => {
      __setDevGateOverride(true);
      const inputs = {
        currentStreet: 'preflop',
        dealerSeat: 1,
        absentSeats: [],
        straddler: null,
        foldedSeats: [],
        numSeats: 9,
      };
      logFirstActionSeat(inputs, 4);

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[seat-select] getFirstActionSeat',
        { inputs, output: 4 }
      );
    });

    it('does NOT emit when dev gate is closed (prod build)', () => {
      __setDevGateOverride(false);
      logFirstActionSeat(
        { currentStreet: 'flop', dealerSeat: 3, absentSeats: [], straddler: null, foldedSeats: [], numSeats: 9 },
        5
      );

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('logAutoSelectFiring', () => {
    it('emits a console.log line when dev gate is open', () => {
      __setDevGateOverride(true);
      const payload = {
        trigger: 'street-change',
        currentStreet: 'flop',
        prevStreet: 'preflop',
        candidateSeat: 3,
        currentSelection: [2, 5],
        action: 'set',
      };
      logAutoSelectFiring(payload);

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[seat-select] useAutoSeatSelection',
        payload
      );
    });

    it('does NOT emit when dev gate is closed (prod build)', () => {
      __setDevGateOverride(false);
      logAutoSelectFiring({
        trigger: 'mount',
        currentStreet: 'preflop',
        prevStreet: 'preflop',
        candidateSeat: 1,
        currentSelection: undefined,
        action: 'set',
      });

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  it('uses real import.meta.env.DEV when override is null', () => {
    // Default Vitest environment runs as dev → import.meta.env.DEV === true.
    // With the override reset to null, the real env value gates the log.
    __setDevGateOverride(null);
    logFirstActionSeat({ currentStreet: 'preflop', dealerSeat: 1, absentSeats: [], straddler: null, foldedSeats: [], numSeats: 9 }, 4);
    // Vitest dev mode → expect a log. If this assertion ever flips in CI under
    // a build that sets import.meta.env.DEV to false, the test is doing its
    // job: it surfaces the env state.
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });
});
