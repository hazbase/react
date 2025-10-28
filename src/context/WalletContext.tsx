import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider, JsonRpcProvider, JsonRpcSigner, Wallet, ethers } from "ethers";
import type { ChainConfig, Hex, Status } from "../types";

type Connector = "metamask" | "guest" | null;

export interface WalletState {
  status: Status;
  connector: Connector;
  provider: (BrowserProvider | JsonRpcProvider) | null;
  signer: (JsonRpcSigner | Wallet) | null;
  account: Hex | null;
  chainId: number | null;
  chain?: ChainConfig | null;
}

export interface WalletActions {
  connectMetaMask(): Promise<void>;
  connectGuest(params: { privKey: Hex; rpcUrl: string }): Promise<void>;
  disconnect(): void;
  refreshNetwork(): Promise<void>;
  switchChain(target: ChainConfig): Promise<void>;
  addChain(params: ChainConfig): Promise<void>;
}

export const WalletContext = createContext<(WalletState & WalletActions) | null>(null);

export function WalletProvider({
  children,
  knownChains = [],
  autoConnect = false
}: {
  children: React.ReactNode;
  knownChains?: ChainConfig[];
  autoConnect?: boolean;
}) {
  const [state, setState] = useState<WalletState>({
    status: "disconnected",
    connector: null,
    provider: null,
    signer: null,
    account: null,
    chainId: null,
    chain: null
  });

  const lastConnectorKey = useRef("@hazbase/react:last-connector");

  const resolveChain = useCallback((id: number | null) => {
    if (id == null) return null;
    return knownChains.find(c => c.id === id) ?? null;
  }, [knownChains]);

  const bindInjectedEvents = useCallback((eth: any, provider: BrowserProvider) => {
    // Bind EIP-1193 events to keep React state in sync
    const onAccounts = async (accounts: string[]) => {
      const account = (accounts?.[0] ?? null) as Hex | null;
      setState(s => ({ ...s, account }));
    };
    const onChain = async (_chainIdHex: string) => {
      const net = await provider.getNetwork();
      const chainId = Number(net.chainId);
      setState(s => ({ ...s, chainId, chain: resolveChain(chainId) }));
    };
    eth?.on?.("accountsChanged", onAccounts);
    eth?.on?.("chainChanged", onChain);
  }, [resolveChain]);

  const connectMetaMask = useCallback(async () => {
    setState(s => ({ ...s, status: "connecting" }));
    const eth = (globalThis as any).ethereum;
    if (!eth?.request) {
      setState(s => ({ ...s, status: "disconnected" }));
      throw new Error("METAMASK_NOT_FOUND");
    }
    const provider = new ethers.BrowserProvider(eth, "any");
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const account = (await signer.getAddress()) as Hex;
    const net = await provider.getNetwork();
    const chainId = Number(net.chainId);
    bindInjectedEvents(eth, provider);
    localStorage.setItem(lastConnectorKey.current, "metamask");
    setState({
      status: "connected",
      connector: "metamask",
      provider,
      signer,
      account,
      chainId,
      chain: resolveChain(chainId)
    });
  }, [bindInjectedEvents, resolveChain]);

  const connectGuest = useCallback(async ({ privKey, rpcUrl }: { privKey: Hex; rpcUrl: string }) => {
    setState(s => ({ ...s, status: "connecting" }));
    // NOTE: In production, decrypt the key with WebCrypto before using it.
    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(privKey, provider);
    const account = (await wallet.getAddress()) as Hex;
    const net = await provider.getNetwork();
    const chainId = Number(net.chainId);
    localStorage.setItem(lastConnectorKey.current, "guest");
    setState({
      status: "connected",
      connector: "guest",
      provider,
      signer: wallet,
      account,
      chainId,
      chain: resolveChain(chainId)
    });
  }, [resolveChain]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(lastConnectorKey.current);
    setState({
      status: "disconnected",
      connector: null,
      provider: null,
      signer: null,
      account: null,
      chainId: null,
      chain: null
    });
  }, []);

  const refreshNetwork = useCallback(async () => {
    if (!state.provider) return;
    const net = await state.provider.getNetwork();
    const chainId = Number(net.chainId);
    setState(s => ({ ...s, chainId, chain: resolveChain(chainId) }));
  }, [state.provider, resolveChain]);

  const ensureOnInjected = useCallback(async (target: ChainConfig) => {
    // Try to switch, add if missing
    const eth = (globalThis as any).ethereum;
    if (!eth?.request) throw new Error("NO_INJECTED_PROVIDER");
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${target.id.toString(16)}` }]
      });
    } catch (err: any) {
      if (err?.code === 4902 && target.rpcUrls?.length) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: `0x${target.id.toString(16)}`,
            chainName: target.name,
            rpcUrls: target.rpcUrls,
            nativeCurrency: target.nativeCurrency ?? { name: "ETH", symbol: "ETH", decimals: 18 },
            blockExplorerUrls: target.blockExplorers?.map(b => b.url) ?? []
          }]
        });
      } else {
        throw err;
      }
    }
  }, []);

  const switchChain = useCallback(async (target: ChainConfig) => {
    // MetaMask: EIP-3326 switch; Guest: re-bind RPC
    if (state.connector === "metamask") {
      await ensureOnInjected(target);
      await refreshNetwork();
      return;
    }
    if (state.connector === "guest") {
      const rpcUrl = target.rpcUrls?.[0];
      if (!rpcUrl) throw new Error("RPC_URL_REQUIRED");
      const provider = new JsonRpcProvider(rpcUrl);
      const prevWallet = state.signer as Wallet;
      const wallet = new Wallet(prevWallet.privateKey, provider);
      const net = await provider.getNetwork();
      const chainId = Number(net.chainId);
      setState(s => ({
        ...s,
        provider,
        signer: wallet,
        chainId,
        chain: resolveChain(chainId)
      }));
      return;
    }
    throw new Error("UNSUPPORTED_CONNECTOR");
  }, [state.connector, state.signer, ensureOnInjected, resolveChain, refreshNetwork]);

  const addChain = useCallback(async (params: ChainConfig) => {
    const eth = (globalThis as any).ethereum;
    if (!eth?.request) throw new Error("NO_INJECTED_PROVIDER");
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: `0x${params.id.toString(16)}`,
        chainName: params.name,
        rpcUrls: params.rpcUrls,
        nativeCurrency: params.nativeCurrency ?? { name: "ETH", symbol: "ETH", decimals: 18 },
        blockExplorerUrls: params.blockExplorers?.map(b => b.url) ?? []
      }]
    });
  }, []);

  // Auto-connect last connector if requested
  useEffect(() => {
    (async () => {
      if (!autoConnect) return;
      const last = localStorage.getItem(lastConnectorKey.current);
      if (last === "metamask") {
        try { await connectMetaMask(); } catch { /* noop */ }
      } else if (last === "guest") {
        // For guest, restoring the key is app-specific; skip silent auto-connect.
      }
    })();
  }, [autoConnect, connectMetaMask]);

  const value = useMemo(() => ({
    ...state,
    connectMetaMask,
    connectGuest,
    disconnect,
    refreshNetwork,
    switchChain,
    addChain
  }), [state, connectMetaMask, connectGuest, disconnect, refreshNetwork, switchChain, addChain]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
