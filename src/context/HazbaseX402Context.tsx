import React, { createContext, useMemo } from 'react';
import { createHazbaseX402Client } from '../x402/client';
import { DEFAULT_X402_COMPLETION_PARAMS } from '../x402/url';
import type { HazbaseX402Client, HazbaseX402ClientConfig } from '../x402/types';

export interface HazbaseX402ContextValue {
  client: HazbaseX402Client;
  walletUrl?: string;
  completionParams: string[];
}

export interface HazbaseX402ProviderProps extends HazbaseX402ClientConfig {
  client?: HazbaseX402Client;
  walletUrl?: string;
  children: React.ReactNode;
}

export const HazbaseX402Context = createContext<HazbaseX402ContextValue | null>(null);

export function HazbaseX402Provider({
  apiEndpoint,
  children,
  client,
  completionParams,
  fetch,
  requestId,
  walletUrl,
}: HazbaseX402ProviderProps) {
  const resolvedClient = useMemo(
    () => client ?? createHazbaseX402Client({ apiEndpoint, completionParams, fetch, requestId }),
    [apiEndpoint, client, completionParams, fetch, requestId],
  );

  const value = useMemo<HazbaseX402ContextValue>(
    () => ({
      client: resolvedClient,
      completionParams: completionParams?.length ? completionParams : DEFAULT_X402_COMPLETION_PARAMS,
      ...(walletUrl ? { walletUrl } : {}),
    }),
    [completionParams, resolvedClient, walletUrl],
  );

  return <HazbaseX402Context.Provider value={value}>{children}</HazbaseX402Context.Provider>;
}
