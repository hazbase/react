import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  listenForX402BridgeMessages,
  postX402BridgeRequest,
  type X402BridgeCompletion,
  type X402BridgeDetectedMessage,
  type X402BridgeErrorMessage,
  type X402BridgePaymentMessage,
} from '../x402/bridge';

export type X402ExtensionBridgeStatus = 'idle' | 'announced' | 'detected' | 'paid' | 'error';

export interface UseX402ExtensionBridgeOptions {
  x402?: Record<string, unknown> | null;
  sourceUrl: string;
  title?: string;
  paymentRequestId?: string | null;
  completion?: X402BridgeCompletion;
  enabled?: boolean;
  autoAnnounce?: boolean;
  targetOrigin?: string;
  allowedOrigins?: string[];
  sourceWindow?: Window | null;
  onDetected?: (message: X402BridgeDetectedMessage) => void;
  onPayment?: (message: X402BridgePaymentMessage) => void;
  onError?: (message: X402BridgeErrorMessage) => void;
}

export interface UseX402ExtensionBridgeResult {
  status: X402ExtensionBridgeStatus;
  requestId: string | null;
  detected: X402BridgeDetectedMessage[];
  payment: X402BridgePaymentMessage | null;
  error: X402BridgeErrorMessage | null;
  announce: () => string | null;
}

export function useX402ExtensionBridge(options: UseX402ExtensionBridgeOptions): UseX402ExtensionBridgeResult {
  const enabled = options.enabled !== false;
  const autoAnnounce = options.autoAnnounce === true;
  const [status, setStatus] = useState<X402ExtensionBridgeStatus>('idle');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [detected, setDetected] = useState<X402BridgeDetectedMessage[]>([]);
  const [payment, setPayment] = useState<X402BridgePaymentMessage | null>(null);
  const [error, setError] = useState<X402BridgeErrorMessage | null>(null);
  const announcedKey = useRef<string | null>(null);

  const requestKey = useMemo(() => {
    if (!options.x402) return '';
    return JSON.stringify({
      completion: options.completion ?? null,
      sourceUrl: options.sourceUrl,
      title: options.title ?? null,
      x402: options.x402,
    });
  }, [options.completion, options.sourceUrl, options.title, options.x402]);

  const allowedOriginsKey = options.allowedOrigins?.join('\n') ?? '';

  const announce = useCallback(() => {
    if (!enabled || !options.x402 || typeof window === 'undefined') return null;
    const nextRequestId = postX402BridgeRequest({
      sourceUrl: options.sourceUrl,
      ...(options.title ? { title: options.title } : {}),
      x402: options.x402,
      ...(options.completion ? { completion: options.completion } : {}),
    }, {
      ...(options.targetOrigin ? { targetOrigin: options.targetOrigin } : {}),
    });
    setRequestId(nextRequestId);
    setStatus('announced');
    setPayment(null);
    setError(null);
    return nextRequestId;
  }, [enabled, options.completion, options.sourceUrl, options.targetOrigin, options.title, options.x402]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    return listenForX402BridgeMessages((message) => {
      if (message.type === 'hazbase:x402:detected') {
        setDetected((current) => {
          if (current.some((item) => sameDetectedMessage(item, message))) return current;
          return [...current, message];
        });
        setStatus((current) => (current === 'paid' ? current : 'detected'));
        options.onDetected?.(message);
        return;
      }

      if (message.type === 'hazbase:x402:payment') {
        if (options.paymentRequestId && message.paymentRequestId !== options.paymentRequestId) return;
        setPayment(message);
        setStatus('paid');
        setError(null);
        options.onPayment?.(message);
        return;
      }

      if (message.type === 'hazbase:x402:error') {
        setError(message);
        setStatus('error');
        options.onError?.(message);
      }
    }, {
      allowedOrigins: options.allowedOrigins,
      requestId,
      sourceWindow: options.sourceWindow,
    });
  }, [
    allowedOriginsKey,
    enabled,
    options.onDetected,
    options.onError,
    options.onPayment,
    options.paymentRequestId,
    options.sourceWindow,
    requestId,
  ]);

  useEffect(() => {
    if (!enabled || !autoAnnounce || !options.x402 || !requestKey) return;
    if (announcedKey.current === requestKey) return;
    announcedKey.current = requestKey;
    announce();
  }, [announce, autoAnnounce, enabled, options.x402, requestKey]);

  return {
    announce,
    detected,
    error,
    payment,
    requestId,
    status,
  };
}

function sameDetectedMessage(a: X402BridgeDetectedMessage, b: X402BridgeDetectedMessage): boolean {
  if (a.id && b.id) return a.id === b.id;
  const aWallet = a.wallet?.extensionId ?? a.wallet?.name;
  const bWallet = b.wallet?.extensionId ?? b.wallet?.name;
  if (aWallet && bWallet) return aWallet === bWallet;
  return JSON.stringify(a) === JSON.stringify(b);
}
