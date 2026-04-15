import { useEffect, useRef, useState } from "react";

/**
 * Returns a debounced version of the value that only updates
 * after the specified delay has passed without changes.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Returns true while the debounced value differs from the current value.
 * Useful for showing loading indicators during debounce wait.
 */
export function useDebouncePending<T>(value: T, debouncedValue: T): boolean {
  return value !== debouncedValue;
}

/**
 * Debounced callback that cancels on unmount.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number,
): T {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // eslint-disable-next-line react-hooks/refs
  callbackRef.current = callback;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return ((...args: unknown[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => callbackRef.current(...args), delay);
  }) as T;
}
