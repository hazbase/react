import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  normalizeWalletAddress,
  readWalletAddressFromUrl,
  requestWalletAddress,
  type RequestWalletAddressOptions,
  type RequestWalletAddressResult,
} from '../wallet/address';

export type WalletAddressLinkStatus = 'idle' | 'connected' | 'requesting' | 'redirecting' | 'error';

export interface UseWalletAddressLinkOptions extends RequestWalletAddressOptions {
  enabled?: boolean;
  initialAddress?: string | null;
  storageKey?: string;
  autoReadUrl?: boolean;
  urlParams?: string[];
  onAddress?: (address: string, result?: RequestWalletAddressResult) => void;
  onResult?: (result: RequestWalletAddressResult) => void;
}

export interface UseWalletAddressLinkResult {
  address: string | null;
  status: WalletAddressLinkStatus;
  result: RequestWalletAddressResult | null;
  isConnected: boolean;
  connect: () => Promise<RequestWalletAddressResult>;
  clear: () => void;
  setAddress: (address: string | null) => boolean;
}

/** @deprecated Raw wallet addresses are not identity proof. Use useWalletLink for authenticated linking. */
export function useWalletAddressLink(options: UseWalletAddressLinkOptions = {}): UseWalletAddressLinkResult {
  const enabled = options.enabled !== false;
  const initialAddress = useMemo(() => normalizeWalletAddress(options.initialAddress), [options.initialAddress]);
  const [address, setAddressState] = useState<string | null>(initialAddress || null);
  const [status, setStatus] = useState<WalletAddressLinkStatus>(initialAddress ? 'connected' : 'idle');
  const [result, setResult] = useState<RequestWalletAddressResult | null>(null);

  const persistAddress = useCallback((nextAddress: string | null) => {
    if (!options.storageKey || typeof localStorage === 'undefined') return;
    try {
      if (nextAddress) localStorage.setItem(options.storageKey, nextAddress);
      else localStorage.removeItem(options.storageKey);
    } catch {
      // Storage is a convenience cache; wallet connection still works without it.
    }
  }, [options.storageKey]);

  const setAddress = useCallback((value: string | null) => {
    const normalized = normalizeWalletAddress(value);
    if (!normalized) {
      setAddressState(null);
      setStatus('idle');
      persistAddress(null);
      return false;
    }
    setAddressState(normalized);
    setStatus('connected');
    persistAddress(normalized);
    options.onAddress?.(normalized);
    return true;
  }, [options.onAddress, persistAddress]);

  const clear = useCallback(() => {
    setAddressState(null);
    setStatus('idle');
    setResult(null);
    persistAddress(null);
  }, [persistAddress]);

  const connect = useCallback(async () => {
    setStatus('requesting');
    const nextResult = await requestWalletAddress(options);
    setResult(nextResult);
    options.onResult?.(nextResult);
    if (nextResult.ok) {
      setAddressState(nextResult.address);
      setStatus('connected');
      persistAddress(nextResult.address);
      options.onAddress?.(nextResult.address, nextResult);
      return nextResult;
    }
    setStatus(nextResult.reason === 'pwa_redirect' ? 'redirecting' : 'error');
    return nextResult;
  }, [options, persistAddress]);

  useEffect(() => {
    if (!enabled) return;
    const fromUrl = options.autoReadUrl === false
      ? null
      : readWalletAddressFromUrl(undefined, options.urlParams ? { params: options.urlParams } : {});
    if (fromUrl?.address) {
      setAddressState(fromUrl.address);
      setStatus('connected');
      persistAddress(fromUrl.address);
      options.onAddress?.(fromUrl.address, {
        ok: true,
        address: fromUrl.address,
        source: 'url',
        message: {
          type: 'hazbase:wallet:address-response',
          version: 1,
          ok: true,
          address: fromUrl.address,
          source: 'url',
        },
      });
      return;
    }

    if (!initialAddress && options.storageKey && typeof localStorage !== 'undefined') {
      try {
        const stored = normalizeWalletAddress(localStorage.getItem(options.storageKey));
        if (stored) {
          setAddressState(stored);
          setStatus('connected');
          options.onAddress?.(stored);
        }
      } catch {
        // Ignore storage errors.
      }
    }
  }, [
    enabled,
    initialAddress,
    options.autoReadUrl,
    options.onAddress,
    options.storageKey,
    options.urlParams,
    persistAddress,
  ]);

  return {
    address,
    clear,
    connect,
    isConnected: Boolean(address),
    result,
    setAddress,
    status,
  };
}
