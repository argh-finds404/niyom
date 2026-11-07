import { useEffect, useState } from "react";

/**
 * Reusable debounce hook that delays propagating rapid value changes
 * (such as search inputs or live auto-saving memo fields) by `delayMs`.
 * Returns both the settled `debouncedValue` and `isPending` when the input is ahead.
 */
export function useDebouncedValue<T>(value: T, delayMs = 220): { debouncedValue: T; isPending: boolean } {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return {
    debouncedValue,
    isPending: !Object.is(value, debouncedValue),
  };
}

