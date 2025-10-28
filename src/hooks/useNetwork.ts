import { useContext, useMemo } from "react";
import { WalletContext } from "../context/WalletContext";
import type { ChainConfig } from "../types";

export function useNetwork() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("WalletProvider is missing");

  const info = useMemo(() => ({
    chainId: ctx.chainId,
    chain: ctx.chain,
    connector: ctx.connector
  }), [ctx.chainId, ctx.chain, ctx.connector]);

  return {
    ...info,
    refresh: ctx.refreshNetwork,
    switchNetwork: (target: ChainConfig) => ctx.switchChain(target),
    addNetwork: (params: ChainConfig) => ctx.addChain(params)
  };
}
