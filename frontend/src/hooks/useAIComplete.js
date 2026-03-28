import { useRef, useCallback } from 'react';
import { api } from '../services/api';

/**
 * Returns a debounced function that fetches AI completion.
 * Call it with { prefix, suffix, language, slug } and it resolves
 * to { completion: string } or null on error/cancel.
 */
export function useAIComplete() {
  const controllerRef = useRef(null);
  const timerRef      = useRef(null);

  const complete = useCallback(({ prefix, suffix, language, slug }, delay = 600) => {
    // Cancel any in-flight request and pending debounce
    controllerRef.current?.abort();
    clearTimeout(timerRef.current);

    return new Promise((resolve) => {
      timerRef.current = setTimeout(async () => {
        const controller = new AbortController();
        controllerRef.current = controller;

        try {
          const { data } = await api.post(
            `/rooms/${slug}/ai/complete`,
            { prefix, suffix, language },
            { signal: controller.signal }
          );
          resolve(data.completion || null);
        } catch (err) {
          if (err.name !== 'CanceledError') console.warn('[ai] complete error:', err.message);
          resolve(null);
        }
      }, delay);
    });
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    clearTimeout(timerRef.current);
  }, []);

  return { complete, cancel };
}
