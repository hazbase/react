import { useContext } from "react";
import { WalletContext } from "../context/WalletContext";
import type { Hex } from "../types";

export function useAddress(): { address: Hex | null; isConnected: boolean } {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("WalletProvider is missing");
  return {
    address: ctx.account,
    // Require an actual account, not just 'connected' status: a locked wallet or
    // a revoked-permissions state can be 'connected' with a null account/signer.
    isConnected: ctx.status === "connected" && ctx.account != null
  };
}
