import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { HazbaseX402Context } from '../context/HazbaseX402Context';
import type { X402PaymentFromUrl, X402SettlementResult } from '../x402/types';

export type X402SettlementStatus = 'idle' | 'settling' | 'settled' | 'error';

export interface UseX402SettlementOptions {
  paymentRequestId?: string | null;
  autoReadUrl?: boolean;
  completionParam?: string;
  clearUrlOnRead?: boolean;
  onError?: (error: Error) => void;
  onSettled?: (result: X402SettlementResult) => void;
}

export interface UseX402SettlementResult {
  xPayment: string | null;
  returnedPayment: X402PaymentFromUrl | null;
  result: X402SettlementResult | null;
  status: X402SettlementStatus;
  error: Error | null;
  settle: (xPayment: string) => Promise<X402SettlementResult>;
  clearReturnParam: () => void;
}

export function useX402Settlement(options: UseX402SettlementOptions = {}): UseX402SettlementResult {
  const ctx = useContext(HazbaseX402Context);
  if (!ctx) throw new Error('HazbaseX402Provider is missing');

  const [returnedPayment, setReturnedPayment] = useState<X402PaymentFromUrl | null>(null);
  const [result, setResult] = useState<X402SettlementResult | null>(null);
  const [status, setStatus] = useState<X402SettlementStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const autoSettledPayment = useRef<string | null>(null);

  const clearReturnParam = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const params = options.completionParam ? [options.completionParam] : ctx.completionParams;
    let changed = false;
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    for (const param of params) {
      if (hashParams.has(param)) {
        hashParams.delete(param);
        changed = true;
      }
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    }
    url.hash = hashParams.toString();
    if (changed) window.history.replaceState(null, '', url.toString());
  }, [ctx.completionParams, options.completionParam]);

  const settle = useCallback(async (xPayment: string) => {
    if (!options.paymentRequestId) throw new Error('paymentRequestId is required');
    setStatus('settling');
    setError(null);
    try {
      const settlement = await ctx.client.settlePayment({
        paymentRequestId: options.paymentRequestId,
        xPayment,
      });
      setResult(settlement);
      setStatus(settlement.settled ? 'settled' : 'error');
      if (settlement.settled) {
        options.onSettled?.(settlement);
      } else {
        const nextError = new Error(settlement.errorCode ?? settlement.invalidReason ?? 'payment_not_settled');
        setError(nextError);
        options.onError?.(nextError);
      }
      return settlement;
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error(String(cause));
      setError(nextError);
      setStatus('error');
      options.onError?.(nextError);
      throw nextError;
    }
  }, [ctx.client, options.paymentRequestId, options.onError, options.onSettled]);

  useEffect(() => {
    if (options.autoReadUrl === false || typeof window === 'undefined') return;
    const params = options.completionParam ? [options.completionParam] : ctx.completionParams;
    const returned = ctx.client.readPaymentFromUrl(window.location.href, { params });
    if (!returned) return;
    if (autoSettledPayment.current === returned.xPayment) return;
    autoSettledPayment.current = returned.xPayment;
    setReturnedPayment(returned);
    if (options.clearUrlOnRead !== false) clearReturnParam();
    if (options.paymentRequestId) void settle(returned.xPayment).catch(() => undefined);
  }, [
    clearReturnParam,
    ctx.client,
    ctx.completionParams,
    options.autoReadUrl,
    options.clearUrlOnRead,
    options.completionParam,
    options.paymentRequestId,
    settle,
  ]);

  return {
    clearReturnParam,
    error,
    result,
    returnedPayment,
    settle,
    status,
    xPayment: returnedPayment?.xPayment ?? null,
  };
}
