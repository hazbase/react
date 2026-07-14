import { useCallback, useEffect, useState } from 'react';
import {
  consumeAndVerifyWalletLinkFromFragment,
  createWalletAddressReturnUrl,
  createWalletLinkPwaUrl,
  requestWalletLink,
  verifyWalletLinkSession,
  type RequestWalletLinkOptions,
  type RequestWalletLinkResult,
} from '@hazbase/kit/extension';
import type {
  VerifyWalletLinkResult,
  VerifyWalletLinkSessionResult,
} from '@hazbase/kit/wallet';

export type WalletLinkStatus = 'idle' | 'restoring' | 'requesting' | 'redirecting' | 'connected' | 'error';

export interface UseWalletLinkOptions extends RequestWalletLinkOptions {
  enabled?: boolean;
  walletUrl?: string;
  returnUrl?: string;
  storageKey?: string;
  autoRestore?: boolean;
  autoConsumeReturn?: boolean;
  fallbackToPwa?: boolean;
  onLinked?: (result: VerifyWalletLinkResult | VerifyWalletLinkSessionResult) => void;
  onResult?: (result: RequestWalletLinkResult) => void;
}

export interface UseWalletLinkResult {
  walletAddress: string | null;
  chainId: number | null;
  status: WalletLinkStatus;
  error: string | null;
  isConnected: boolean;
  connect: () => Promise<RequestWalletLinkResult>;
  clear: () => void;
}

export function useWalletLink(options: UseWalletLinkOptions = {}): UseWalletLinkResult {
  const enabled = options.enabled !== false;
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [status, setStatus] = useState<WalletLinkStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const persistToken = useCallback((token: string | null) => {
    if (!options.storageKey || typeof localStorage === 'undefined') return;
    try {
      if (token) localStorage.setItem(options.storageKey, token);
      else localStorage.removeItem(options.storageKey);
    } catch {
      // Persistence is optional; the verified link still works for this page session.
    }
  }, [options.storageKey]);

  const applyVerified = useCallback((result: VerifyWalletLinkResult | VerifyWalletLinkSessionResult, token?: string) => {
    if (options.purpose && result.purpose !== options.purpose) {
      throw new Error('wallet_link_purpose_mismatch');
    }
    setWalletAddress(result.walletAddress);
    setChainId(result.chainId);
    setStatus('connected');
    setError(null);
    if (token) persistToken(token);
    options.onLinked?.(result);
  }, [options.onLinked, options.purpose, persistToken]);

  const clear = useCallback(() => {
    setWalletAddress(null);
    setChainId(null);
    setStatus('idle');
    setError(null);
    persistToken(null);
  }, [persistToken]);

  const connect = useCallback(async () => {
    setStatus('requesting');
    setError(null);
    const result = await requestWalletLink(options);
    options.onResult?.(result);
    if (result.ok) {
      applyVerified(result, result.linkSessionToken);
      return result;
    }
    if (options.fallbackToPwa && options.walletUrl && result.challenge && typeof location !== 'undefined') {
      setStatus('redirecting');
      location.assign(createWalletLinkPwaUrl(options.walletUrl, {
        challenge: result.challenge,
        returnUrl: options.returnUrl ?? createWalletAddressReturnUrl(location.href),
      }));
      return result;
    }
    setStatus('error');
    setError(result.reason ?? 'wallet_link_failed');
    return result;
  }, [applyVerified, options]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const restore = async () => {
      setStatus('restoring');
      try {
        if (options.autoConsumeReturn !== false) {
          const returned = await consumeAndVerifyWalletLinkFromFragment({
            ...(options.apiEndpoint ? { apiEndpoint: options.apiEndpoint } : {}),
            ...(options.fetcher ? { fetcher: options.fetcher } : {}),
          });
          if (!active) return;
          if (returned) {
            applyVerified(returned, returned.linkSessionToken);
            return;
          }
        }
        if (options.autoRestore !== false && options.storageKey && typeof localStorage !== 'undefined') {
          const token = localStorage.getItem(options.storageKey);
          if (token) {
            const restored = await verifyWalletLinkSession(token, {
              ...(options.apiEndpoint ? { apiEndpoint: options.apiEndpoint } : {}),
              ...(options.fetcher ? { fetcher: options.fetcher } : {}),
            });
            if (!active) return;
            applyVerified(restored, token);
            return;
          }
        }
        if (active) setStatus('idle');
      } catch (cause) {
        if (!active) return;
        persistToken(null);
        setWalletAddress(null);
        setChainId(null);
        setStatus('error');
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    };
    void restore();
    return () => { active = false; };
  }, [
    applyVerified,
    enabled,
    options.apiEndpoint,
    options.autoConsumeReturn,
    options.autoRestore,
    options.fetcher,
    options.storageKey,
    persistToken,
  ]);

  return {
    walletAddress,
    chainId,
    status,
    error,
    isConnected: Boolean(walletAddress),
    connect,
    clear,
  };
}
