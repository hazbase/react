import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useX402Client } from './useX402Client';
import type { CreateX402RequirementInput, X402RequirementResult } from '../x402/types';

export type X402RequirementStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseX402RequirementOptions {
  enabled?: boolean;
  initialData?: X402RequirementResult | null;
  onError?: (error: Error) => void;
  onSuccess?: (result: X402RequirementResult) => void;
}

export interface UseX402RequirementResult {
  data: X402RequirementResult | null;
  status: X402RequirementStatus;
  error: Error | null;
  refresh: () => Promise<X402RequirementResult>;
}

export function useX402Requirement(
  input: CreateX402RequirementInput | null | undefined,
  options: UseX402RequirementOptions = {},
): UseX402RequirementResult {
  const client = useX402Client();
  const requestKey = useMemo(() => stableStringify(input), [input]);
  const latestInput = useRef(input);
  latestInput.current = input;

  const [data, setData] = useState<X402RequirementResult | null>(options.initialData ?? null);
  const [status, setStatus] = useState<X402RequirementStatus>(options.initialData ? 'ready' : 'idle');
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    const current = latestInput.current;
    if (!current) throw new Error('x402 requirement input is required');
    setStatus('loading');
    setError(null);
    try {
      const result = await client.createRequirement(current);
      setData(result);
      setStatus('ready');
      options.onSuccess?.(result);
      return result;
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error(String(cause));
      setError(nextError);
      setStatus('error');
      options.onError?.(nextError);
      throw nextError;
    }
  }, [client, options.onError, options.onSuccess]);

  useEffect(() => {
    const current = latestInput.current;
    if (options.enabled === false || !current) return;
    let cancelled = false;
    setStatus('loading');
    setError(null);
    client.createRequirement(current)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus('ready');
        options.onSuccess?.(result);
      })
      .catch((cause) => {
        if (cancelled) return;
        const nextError = cause instanceof Error ? cause : new Error(String(cause));
        setError(nextError);
        setStatus('error');
        options.onError?.(nextError);
      });
    return () => {
      cancelled = true;
    };
  }, [client, options.enabled, options.onError, options.onSuccess, requestKey]);

  return { data, error, refresh, status };
}

function stableStringify(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
