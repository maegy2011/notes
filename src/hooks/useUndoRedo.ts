import { useState, useCallback, useRef } from 'react';

interface UseUndoRedoOptions {
  /** Max history size (default 50) */
  maxSize?: number;
  /** Debounce ms for grouping consecutive changes (default 400ms) */
  debounceMs?: number;
}

/**
 * Generic undo/redo hook for any value type.
 * Groups consecutive rapid changes into a single history entry.
 */
export function useUndoRedo<T>(initialValue: T, options: UseUndoRedoOptions = {}) {
  const { maxSize = 50, debounceMs = 400 } = options;

  const [value, setValueState] = useState<T>(initialValue);
  const historyRef = useRef<T[]>([initialValue]);
  const indexRef = useRef<number>(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<T>(initialValue);
  const [, forceRender] = useState(0);

  const commitToHistory = useCallback((newValue: T) => {
    // Drop any "redo" history past current index
    historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
    historyRef.current.push(newValue);
    
    // Trim to max size
    if (historyRef.current.length > maxSize) {
      historyRef.current = historyRef.current.slice(historyRef.current.length - maxSize);
    }
    indexRef.current = historyRef.current.length - 1;
    forceRender(n => n + 1);
  }, [maxSize]);

  const setValue = useCallback((newValue: T | ((prev: T) => T), opts?: { immediate?: boolean }) => {
    setValueState(prev => {
      const resolved = typeof newValue === 'function' ? (newValue as (p: T) => T)(prev) : newValue;
      pendingValueRef.current = resolved;

      if (opts?.immediate) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        commitToHistory(resolved);
      } else {
        // Debounce: only push to history when user pauses typing
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          commitToHistory(pendingValueRef.current);
          debounceTimerRef.current = null;
        }, debounceMs);
      }
      return resolved;
    });
  }, [commitToHistory, debounceMs]);

  const undo = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      // Commit any pending value first
      if (pendingValueRef.current !== historyRef.current[indexRef.current]) {
        commitToHistory(pendingValueRef.current);
      }
    }
    if (indexRef.current > 0) {
      indexRef.current -= 1;
      const previousValue = historyRef.current[indexRef.current];
      setValueState(previousValue);
      pendingValueRef.current = previousValue;
      forceRender(n => n + 1);
      return true;
    }
    return false;
  }, [commitToHistory]);

  const redo = useCallback(() => {
    if (indexRef.current < historyRef.current.length - 1) {
      indexRef.current += 1;
      const nextValue = historyRef.current[indexRef.current];
      setValueState(nextValue);
      pendingValueRef.current = nextValue;
      forceRender(n => n + 1);
      return true;
    }
    return false;
  }, []);

  /** Reset history with a new initial value */
  const reset = useCallback((newInitial: T) => {
    historyRef.current = [newInitial];
    indexRef.current = 0;
    pendingValueRef.current = newInitial;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setValueState(newInitial);
    forceRender(n => n + 1);
  }, []);

  return {
    value,
    setValue,
    undo,
    redo,
    reset,
    canUndo: indexRef.current > 0,
    canRedo: indexRef.current < historyRef.current.length - 1,
    historySize: historyRef.current.length,
  };
}
