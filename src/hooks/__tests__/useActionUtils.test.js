/**
 * useActionUtils.test.js - Tests for action utilities hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionUtils } from '../useActionUtils';
import { ACTIONS, SEAT_STATUS } from '../../test/utils';

describe('useActionUtils', () => {
  describe('returns all expected functions', () => {
    it('returns getActionDisplayName function', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(typeof result.current.getActionDisplayName).toBe('function');
    });

    it('returns getActionColor function', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(typeof result.current.getActionColor).toBe('function');
    });

    it('returns getSeatActionStyle function', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(typeof result.current.getSeatActionStyle).toBe('function');
    });

    it('returns getOverlayStatus function', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(typeof result.current.getOverlayStatus).toBe('function');
    });

    it('returns getCardAbbreviation function', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(typeof result.current.getCardAbbreviation).toBe('function');
    });

    it('returns getHandAbbreviation function', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(typeof result.current.getHandAbbreviation).toBe('function');
    });
  });

  describe('getActionDisplayName', () => {
    it('returns display name for FOLD action', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(result.current.getActionDisplayName(ACTIONS.FOLD)).toBe('fold');
    });

    it('returns display name for CALL action', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(result.current.getActionDisplayName(ACTIONS.CALL)).toBe('call');
    });

    it('returns display name for CHECK action', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(result.current.getActionDisplayName(ACTIONS.CHECK)).toBe('check');
    });

    it('returns display name for standard action', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(result.current.getActionDisplayName(ACTIONS.OPEN)).toBe('open');
    });
  });

  describe('getActionColor', () => {
    it('returns color classes for FOLD action', () => {
      const { result } = renderHook(() => useActionUtils());
      const color = result.current.getActionColor(ACTIONS.FOLD);
      expect(color).toContain('red');
    });

    it('returns color classes for CALL action', () => {
      const { result } = renderHook(() => useActionUtils());
      const color = result.current.getActionColor(ACTIONS.CALL);
      expect(color).toContain('blue');
    });

    it('returns color classes for aggressive action', () => {
      const { result } = renderHook(() => useActionUtils());
      const color = result.current.getActionColor(ACTIONS.OPEN);
      expect(color).toContain('green');
    });
  });

  describe('getSeatActionStyle', () => {
    it('returns style object for FOLD action', () => {
      const { result } = renderHook(() => useActionUtils());
      const style = result.current.getSeatActionStyle(ACTIONS.FOLD);
      expect(style).toHaveProperty('bg');
      expect(style).toHaveProperty('ring');
    });

    it('returns style object for CALL action', () => {
      const { result } = renderHook(() => useActionUtils());
      const style = result.current.getSeatActionStyle(ACTIONS.CALL);
      expect(style.bg).toContain('blue');
    });
  });

  describe('getOverlayStatus', () => {
    it('returns FOLDED for folded inactive status', () => {
      const { result } = renderHook(() => useActionUtils());
      const status = result.current.getOverlayStatus(SEAT_STATUS.FOLDED, false, false);
      expect(status).toBe(SEAT_STATUS.FOLDED);
    });

    it('returns ABSENT for absent inactive status', () => {
      const { result } = renderHook(() => useActionUtils());
      const status = result.current.getOverlayStatus(SEAT_STATUS.ABSENT, false, false);
      expect(status).toBe(SEAT_STATUS.ABSENT);
    });

    it('returns "mucked" when isMucked is true', () => {
      const { result } = renderHook(() => useActionUtils());
      const status = result.current.getOverlayStatus(null, true, false);
      expect(status).toBe('mucked');
    });

    it('returns "won" when hasWon is true', () => {
      const { result } = renderHook(() => useActionUtils());
      const status = result.current.getOverlayStatus(null, false, true);
      expect(status).toBe('won');
    });

    it('returns null when no status applies', () => {
      const { result } = renderHook(() => useActionUtils());
      const status = result.current.getOverlayStatus(null, false, false);
      expect(status).toBeNull();
    });
  });

  describe('getCardAbbreviation', () => {
    it('converts spade card correctly', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(result.current.getCardAbbreviation('A♠')).toBe('As');
    });

    it('converts heart card correctly', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(result.current.getCardAbbreviation('K♥')).toBe('Kh');
    });

    it('converts diamond card correctly', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(result.current.getCardAbbreviation('Q♦')).toBe('Qd');
    });

    it('converts club card correctly', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(result.current.getCardAbbreviation('J♣')).toBe('Jc');
    });

    it('handles empty card', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(result.current.getCardAbbreviation('')).toBe('');
    });
  });

  describe('getHandAbbreviation', () => {
    it('converts two cards correctly', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(result.current.getHandAbbreviation(['A♠', 'K♥'])).toBe('AsKh');
    });

    it('handles empty cards array', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(result.current.getHandAbbreviation([])).toBe('');
    });

    it('handles array with empty strings', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(result.current.getHandAbbreviation(['', ''])).toBe('');
    });

    it('handles single card (returns empty since requires 2 cards)', () => {
      const { result } = renderHook(() => useActionUtils());
      expect(result.current.getHandAbbreviation(['A♠'])).toBe('');
    });
  });

  describe('hook stability', () => {
    it('returns stable function references across renders', () => {
      const { result, rerender } = renderHook(() => useActionUtils());

      const firstRender = {
        getActionDisplayName: result.current.getActionDisplayName,
        getActionColor: result.current.getActionColor,
        getSeatActionStyle: result.current.getSeatActionStyle,
        getOverlayStatus: result.current.getOverlayStatus,
        getCardAbbreviation: result.current.getCardAbbreviation,
        getHandAbbreviation: result.current.getHandAbbreviation,
      };

      rerender();

      expect(result.current.getActionDisplayName).toBe(firstRender.getActionDisplayName);
      expect(result.current.getActionColor).toBe(firstRender.getActionColor);
      expect(result.current.getSeatActionStyle).toBe(firstRender.getSeatActionStyle);
      expect(result.current.getOverlayStatus).toBe(firstRender.getOverlayStatus);
      expect(result.current.getCardAbbreviation).toBe(firstRender.getCardAbbreviation);
      expect(result.current.getHandAbbreviation).toBe(firstRender.getHandAbbreviation);
    });
  });
});
