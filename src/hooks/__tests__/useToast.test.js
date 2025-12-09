/**
 * useToast.test.js - Tests for toast notification hook
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast';

describe('useToast', () => {
  describe('initial state', () => {
    it('returns empty toasts array initially', () => {
      const { result } = renderHook(() => useToast());
      expect(result.current.toasts).toEqual([]);
    });

    it('returns all expected functions', () => {
      const { result } = renderHook(() => useToast());
      expect(typeof result.current.addToast).toBe('function');
      expect(typeof result.current.dismissToast).toBe('function');
      expect(typeof result.current.dismissAll).toBe('function');
      expect(typeof result.current.showError).toBe('function');
      expect(typeof result.current.showSuccess).toBe('function');
      expect(typeof result.current.showWarning).toBe('function');
      expect(typeof result.current.showInfo).toBe('function');
    });
  });

  describe('addToast', () => {
    it('adds a toast with message and default options', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast('Test message');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe('Test message');
      expect(result.current.toasts[0].variant).toBe('info');
      expect(result.current.toasts[0].duration).toBe(4000);
    });

    it('adds a toast with custom variant', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast('Error message', { variant: 'error' });
      });

      expect(result.current.toasts[0].variant).toBe('error');
    });

    it('adds a toast with custom duration', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast('Long message', { duration: 10000 });
      });

      expect(result.current.toasts[0].duration).toBe(10000);
    });

    it('adds a toast with duration 0 (no auto-dismiss)', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast('Permanent message', { duration: 0 });
      });

      expect(result.current.toasts[0].duration).toBe(0);
    });

    it('returns a unique ID for each toast', () => {
      const { result } = renderHook(() => useToast());

      let id1, id2;
      act(() => {
        id1 = result.current.addToast('First');
        id2 = result.current.addToast('Second');
      });

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('number');
      expect(typeof id2).toBe('number');
    });

    it('adds multiple toasts in order', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast('First');
        result.current.addToast('Second');
        result.current.addToast('Third');
      });

      expect(result.current.toasts).toHaveLength(3);
      expect(result.current.toasts[0].message).toBe('First');
      expect(result.current.toasts[1].message).toBe('Second');
      expect(result.current.toasts[2].message).toBe('Third');
    });
  });

  describe('dismissToast', () => {
    it('removes toast by ID', () => {
      const { result } = renderHook(() => useToast());

      let toastId;
      act(() => {
        toastId = result.current.addToast('To be dismissed');
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        result.current.dismissToast(toastId);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('only removes the specified toast', () => {
      const { result } = renderHook(() => useToast());

      let id1, id2, id3;
      act(() => {
        id1 = result.current.addToast('First');
        id2 = result.current.addToast('Second');
        id3 = result.current.addToast('Third');
      });

      act(() => {
        result.current.dismissToast(id2);
      });

      expect(result.current.toasts).toHaveLength(2);
      expect(result.current.toasts.find(t => t.id === id1)).toBeDefined();
      expect(result.current.toasts.find(t => t.id === id2)).toBeUndefined();
      expect(result.current.toasts.find(t => t.id === id3)).toBeDefined();
    });

    it('does nothing when ID not found', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast('Existing');
      });

      act(() => {
        result.current.dismissToast(99999);
      });

      expect(result.current.toasts).toHaveLength(1);
    });
  });

  describe('dismissAll', () => {
    it('removes all toasts', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast('First');
        result.current.addToast('Second');
        result.current.addToast('Third');
      });

      expect(result.current.toasts).toHaveLength(3);

      act(() => {
        result.current.dismissAll();
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('works when no toasts exist', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.dismissAll();
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe('showError', () => {
    it('adds toast with error variant and 6000ms duration', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showError('Error occurred');
      });

      expect(result.current.toasts[0].variant).toBe('error');
      expect(result.current.toasts[0].duration).toBe(6000);
      expect(result.current.toasts[0].message).toBe('Error occurred');
    });

    it('allows custom duration override', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showError('Error', 3000);
      });

      expect(result.current.toasts[0].duration).toBe(3000);
    });

    it('returns toast ID', () => {
      const { result } = renderHook(() => useToast());

      let id;
      act(() => {
        id = result.current.showError('Error');
      });

      expect(typeof id).toBe('number');
      expect(result.current.toasts[0].id).toBe(id);
    });
  });

  describe('showSuccess', () => {
    it('adds toast with success variant and default 4000ms duration', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showSuccess('Success!');
      });

      expect(result.current.toasts[0].variant).toBe('success');
      expect(result.current.toasts[0].duration).toBe(4000);
      expect(result.current.toasts[0].message).toBe('Success!');
    });

    it('allows custom duration', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showSuccess('Success', 2000);
      });

      expect(result.current.toasts[0].duration).toBe(2000);
    });
  });

  describe('showWarning', () => {
    it('adds toast with warning variant and 5000ms duration', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showWarning('Warning!');
      });

      expect(result.current.toasts[0].variant).toBe('warning');
      expect(result.current.toasts[0].duration).toBe(5000);
      expect(result.current.toasts[0].message).toBe('Warning!');
    });

    it('allows custom duration override', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showWarning('Warning', 8000);
      });

      expect(result.current.toasts[0].duration).toBe(8000);
    });
  });

  describe('showInfo', () => {
    it('adds toast with info variant and default 4000ms duration', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showInfo('Information');
      });

      expect(result.current.toasts[0].variant).toBe('info');
      expect(result.current.toasts[0].duration).toBe(4000);
      expect(result.current.toasts[0].message).toBe('Information');
    });

    it('allows custom duration', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showInfo('Info', 1000);
      });

      expect(result.current.toasts[0].duration).toBe(1000);
    });
  });

  describe('mixed operations', () => {
    it('handles adding and removing toasts in sequence', () => {
      const { result } = renderHook(() => useToast());

      let id1, id2;
      act(() => {
        id1 = result.current.showError('Error 1');
        id2 = result.current.showSuccess('Success 1');
        result.current.showWarning('Warning 1');
      });

      expect(result.current.toasts).toHaveLength(3);

      act(() => {
        result.current.dismissToast(id1);
      });

      expect(result.current.toasts).toHaveLength(2);

      act(() => {
        result.current.showInfo('Info 1');
      });

      expect(result.current.toasts).toHaveLength(3);

      act(() => {
        result.current.dismissAll();
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('maintains toast order after partial dismissal', () => {
      const { result } = renderHook(() => useToast());

      let id2;
      act(() => {
        result.current.addToast('First');
        id2 = result.current.addToast('Second');
        result.current.addToast('Third');
      });

      act(() => {
        result.current.dismissToast(id2);
      });

      expect(result.current.toasts[0].message).toBe('First');
      expect(result.current.toasts[1].message).toBe('Third');
    });
  });
});
