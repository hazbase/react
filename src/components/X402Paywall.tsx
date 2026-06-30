import React, { useMemo } from 'react';
import { useX402Settlement, type UseX402SettlementResult, type X402SettlementStatus } from '../hooks/useX402Settlement';
import { useX402WalletHandoff } from '../hooks/useX402WalletHandoff';
import type { X402CompletionMode, X402RequirementResult, X402SettlementResult } from '../x402/types';
import { X402RequirementScript } from './X402RequirementScript';

export type X402PaywallStatus = 'idle' | 'ready' | X402SettlementStatus;

export interface X402PaywallRenderProps {
  requirement: X402RequirementResult | null;
  status: X402PaywallStatus;
  walletUrl: string | null;
  openWallet: (event?: { preventDefault?: () => void }) => void;
  settle: UseX402SettlementResult['settle'];
  settlement: X402SettlementResult | null;
  xPayment: string | null;
  error: Error | null;
}

export interface X402PaywallProps {
  requirement?: X402RequirementResult | null;
  walletUrl?: string;
  sourceUrl: string;
  title?: string;
  completion?: X402CompletionMode;
  completionParam?: string;
  target?: '_self' | '_blank';
  autoReadUrl?: boolean;
  clearUrlOnRead?: boolean;
  renderRequirementScript?: boolean;
  scriptId?: string;
  onSettled?: (result: X402SettlementResult) => void;
  onError?: (error: Error) => void;
  children: (props: X402PaywallRenderProps) => React.ReactNode;
}

export function X402Paywall({
  autoReadUrl = true,
  children,
  clearUrlOnRead,
  completion = 'fragment',
  completionParam,
  onError,
  onSettled,
  renderRequirementScript = true,
  requirement = null,
  scriptId,
  sourceUrl,
  target,
  title,
  walletUrl,
}: X402PaywallProps) {
  const handoff = useX402WalletHandoff({
    x402: requirement?.x402,
    ...(walletUrl ? { walletUrl } : {}),
    sourceUrl,
    ...(title ? { title } : {}),
    completion,
    ...(completionParam ? { completionParam } : {}),
    ...(target ? { target } : {}),
  });

  const settlement = useX402Settlement({
    paymentRequestId: requirement?.paymentRequestId ?? null,
    autoReadUrl,
    ...(clearUrlOnRead != null ? { clearUrlOnRead } : {}),
    ...(completionParam ? { completionParam } : {}),
    ...(onError ? { onError } : {}),
    ...(onSettled ? { onSettled } : {}),
  });

  const status = useMemo<X402PaywallStatus>(() => {
    if (!requirement) return 'idle';
    return settlement.status === 'idle' ? 'ready' : settlement.status;
  }, [requirement, settlement.status]);

  return (
    <>
      {renderRequirementScript ? <X402RequirementScript id={scriptId} x402={requirement?.x402} /> : null}
      {children({
        error: settlement.error,
        openWallet: handoff.openWallet,
        requirement,
        settle: settlement.settle,
        settlement: settlement.result,
        status,
        walletUrl: handoff.walletUrl,
        xPayment: settlement.xPayment,
      })}
    </>
  );
}
