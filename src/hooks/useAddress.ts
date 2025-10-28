import { useContext } from "react";
import { WalletContext } from "../context/WalletContext";
import type { Hex } from "../types";

export function useAddress(): { address: Hex | null; isConnected: boolean } {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("WalletProvider is missing");
  return {
    address: ctx.account,
    isConnected: ctx.status === "connected"
  };
}
