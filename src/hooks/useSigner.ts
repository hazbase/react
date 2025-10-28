import { useContext } from "react";
import { WalletContext } from "../context/WalletContext";

export function useSigner() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("WalletProvider is missing");
  return {
    status: ctx.status,
    signer: ctx.signer,
    connectMetaMask: ctx.connectMetaMask,
    connectGuest: ctx.connectGuest,
    disconnect: ctx.disconnect
  };
}
