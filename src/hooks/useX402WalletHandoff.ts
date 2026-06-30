import { useCallback, useContext, useMemo } from 'react';
import { HazbaseX402Context } from '../context/HazbaseX402Context';
import type { X402CompletionMode } from '../x402/types';

export interface UseX402WalletHandoffInput {
  x402?: Record<string, unknown> | null;
  walletUrl?: string;
  sourceUrl: string;
  title?: string;
  completion?: X402CompletionMode;
  completionParam?: string;
  target?: '_self' | '_blank';
}

export interface UseX402WalletHandoffResult {
  walletUrl: string | null;
  openWallet: (event?: { preventDefault?: () => void }) => void;
}

export function useX402WalletHandoff(input: UseX402WalletHandoffInput): UseX402WalletHandoffResult {
  const ctx = useContext(HazbaseX402Context);
  if (!ctx) throw new Error('HazbaseX402Provider is missing');

  const walletUrl = useMemo(() => {
    const baseWalletUrl = input.walletUrl ?? ctx.walletUrl;
    if (!baseWalletUrl || !input.x402) return null;
    return ctx.client.createWalletUrl({
      walletUrl: baseWalletUrl,
      x402: input.x402,
      sourceUrl: input.sourceUrl,
      ...(input.title ? { title: input.title } : {}),
      completion: input.completion ?? 'fragment',
      ...(input.completionParam ? { completionParam: input.completionParam } : {}),
    });
  }, [
    ctx.client,
    ctx.walletUrl,
    input.completion,
    input.completionParam,
    input.sourceUrl,
    input.title,
    input.walletUrl,
    input.x402,
  ]);

  const openWallet = useCallback((event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();
    if (!walletUrl || typeof window === 'undefined') return;
    if (input.target === '_blank') {
      window.open(walletUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    window.location.assign(walletUrl);
  }, [input.target, walletUrl]);

  return { openWallet, walletUrl };
}
