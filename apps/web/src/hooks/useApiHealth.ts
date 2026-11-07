import { useEffect, useState } from 'react';
import type { ApiHealthResponse } from '@procureflow/shared';

export type ApiConnectionState = 'loading' | 'online' | 'offline';

export interface ApiConnection {
  state: ApiConnectionState;
  health: ApiHealthResponse | null;
}

export function useApiHealth(): ApiConnection {
  const [connection, setConnection] = useState<ApiConnection>({
    state: 'loading',
    health: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetch('/api/health', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Health check failed with status ${response.status}`);
        }

        return (await response.json()) as ApiHealthResponse;
      })
      .then((health) => {
        if (active) {
          setConnection({ state: health.status === 'ok' ? 'online' : 'offline', health });
        }
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }

        setConnection({ state: 'offline', health: null });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return connection;
}
