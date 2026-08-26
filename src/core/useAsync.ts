import { useCallback, useEffect, useState } from 'react';

export function useAsync<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setData(await loader());
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Request failed'));
    } finally {
      setLoading(false);
    }
  }, dependencies);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, loading, reload: load };
}
