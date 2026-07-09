import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createHazbaseWalletClient,
  type GetActivityInput,
  type GetActivityResult,
  type GetBalanceInput,
  type GetBalanceResult,
  type HazbaseWalletClient,
  type HazbaseWalletClientOptions,
} from '@hazbase/kit/wallet';

export interface UseHazbaseWalletClientOptions extends Partial<HazbaseWalletClientOptions> {
  client?: HazbaseWalletClient | null;
}

export function useHazbaseWalletClient(options: UseHazbaseWalletClientOptions = {}): HazbaseWalletClient {
  return useMemo(() => {
    if (options.client) return options.client;
    return createHazbaseWalletClient({
      ...(options.apiEndpoint ? { apiEndpoint: options.apiEndpoint } : {}),
      ...(options.fetcher ? { fetcher: options.fetcher } : {}),
      ...(options.headers ? { headers: options.headers } : {}),
      ...(options.requestId ? { requestId: options.requestId } : {}),
    });
  }, [options.apiEndpoint, options.client, options.fetcher, options.headers, options.requestId]);
}

export type HazbaseWalletQueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseTokenBalanceOptions extends Omit<GetBalanceInput, 'account' | 'token'>, UseHazbaseWalletClientOptions {
  account?: string | null;
  token?: string | null;
  enabled?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: (result: GetBalanceResult) => void;
}

export interface UseTokenBalanceResult {
  result: GetBalanceResult | null;
  balance: GetBalanceResult['balance'] | null;
  status: HazbaseWalletQueryStatus;
  error: Error | null;
  refresh: () => Promise<GetBalanceResult | null>;
}

export function useTokenBalance(options: UseTokenBalanceOptions): UseTokenBalanceResult {
  const client = useHazbaseWalletClient(options);
  const [result, setResult] = useState<GetBalanceResult | null>(null);
  const [status, setStatus] = useState<HazbaseWalletQueryStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!client || !options.account || !options.token) return null;
    setStatus('loading');
    setError(null);
    try {
      const next = await client.getBalance({
        account: options.account,
        token: options.token,
        ...(options.chainId != null ? { chainId: options.chainId } : {}),
        ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      });
      setResult(next);
      setStatus('success');
      options.onSuccess?.(next);
      return next;
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error(String(cause));
      setError(nextError);
      setStatus('error');
      options.onError?.(nextError);
      throw nextError;
    }
  }, [client, options.account, options.chainId, options.endpoint, options.onError, options.onSuccess, options.token]);

  useEffect(() => {
    if (options.enabled === false) return;
    void refresh().catch(() => undefined);
  }, [options.enabled, refresh]);

  return {
    balance: result?.balance ?? null,
    error,
    refresh,
    result,
    status,
  };
}

export interface UseWalletActivityOptions extends Omit<GetActivityInput, 'account' | 'token'>, UseHazbaseWalletClientOptions {
  account?: string | null;
  token?: string | null;
  enabled?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: (result: GetActivityResult) => void;
}

export interface UseWalletActivityResult {
  result: GetActivityResult | null;
  activities: GetActivityResult['activities'];
  status: HazbaseWalletQueryStatus;
  error: Error | null;
  refresh: () => Promise<GetActivityResult | null>;
}

export function useWalletActivity(options: UseWalletActivityOptions): UseWalletActivityResult {
  const client = useHazbaseWalletClient(options);
  const [result, setResult] = useState<GetActivityResult | null>(null);
  const [status, setStatus] = useState<HazbaseWalletQueryStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!client || !options.account || !options.token) return null;
    setStatus('loading');
    setError(null);
    try {
      const next = await client.getActivity({
        account: options.account,
        token: options.token,
        ...(options.chainId != null ? { chainId: options.chainId } : {}),
        ...(options.limit != null ? { limit: options.limit } : {}),
        ...(options.cursor ? { cursor: options.cursor } : {}),
        ...(options.fromBlock != null ? { fromBlock: options.fromBlock } : {}),
        ...(options.toBlock != null ? { toBlock: options.toBlock } : {}),
        ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      });
      setResult(next);
      setStatus('success');
      options.onSuccess?.(next);
      return next;
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error(String(cause));
      setError(nextError);
      setStatus('error');
      options.onError?.(nextError);
      throw nextError;
    }
  }, [
    client,
    options.account,
    options.chainId,
    options.cursor,
    options.endpoint,
    options.fromBlock,
    options.limit,
    options.onError,
    options.onSuccess,
    options.toBlock,
    options.token,
  ]);

  useEffect(() => {
    if (options.enabled === false) return;
    void refresh().catch(() => undefined);
  }, [options.enabled, refresh]);

  return {
    activities: result?.activities ?? [],
    error,
    refresh,
    result,
    status,
  };
}
