import { useEffect, useState } from 'react';

/**
 * Retorna o valor apenas depois que ele fica estável por `delayMs`.
 * Útil para não disparar uma query a cada tecla digitada na busca.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
