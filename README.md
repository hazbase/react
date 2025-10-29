# @hazbase/react
[![npm version](https://badge.fury.io/js/%40hazbase%2Freact.svg)](https://badge.fury.io/js/%40hazbase%2Freact)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Overview
`@hazbase/react` is a lightweight React toolkit for **wallet connection and network control** built on **ethers v6**.  
It unifies **MetaMask (injected)**, **WalletConnect (via EIP-1193 provider)**, and **Guest login** (ephemeral private key in the browser), and provides a simple API surface:

- `<WalletProvider />` — global state & actions
- `useSigner()` — signer instance & connect/disconnect
- `useAddress()` — current address
- `useNetwork()` — read current chain info and **switch/add network**

Designed to work smoothly with `@hazbase/kit` helpers (connect with an ethers `Signer`), and to fit compliance-first architectures later (suitability, reputation, circuit-breaker, etc.).

---

## Requirements
- **Node.js**: 18+ (ESM recommended)
- **React**: 18+
- **Deps**: `ethers` v6

---

## Installation
```bash
npm i @hazbase/react ethers react react-dom
# or
yarn add @hazbase/react ethers react react-dom
```

---

## Quick start
Wrap your app with `WalletProvider`, then use hooks from anywhere.

```tsx
// main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { WalletProvider } from "@hazbase/react";

const knownChains = [
  { id: 1, name: "Ethereum", rpcUrls: ["https://..."] },
  { id: 137, name: "Polygon",  rpcUrls: ["https://..."] }
];

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletProvider knownChains={knownChains} autoConnect>
      <App />
    </WalletProvider>
  </React.StrictMode>
);
```

```tsx
// App.tsx
import React from "react";
import { useSigner, useAddress, useNetwork } from "@hazbase/react";

export default function App() {
  const { status, signer, connectMetaMask, connectGuest, disconnect } = useSigner();
  const { address, isConnected } = useAddress();
  const { chain, chainId, switchNetwork } = useNetwork();

  const polygon = { id: 137, name: "Polygon", rpcUrls: ["https://..."] };

  return (
    <div style={{ padding: 24 }}>
      <h2>@hazbase/react demo</h2>
      <p>Status: <b>{status}</b></p>
      <p>Address: <b>{address ?? "-"}</b></p>
      <p>Network: <b>{chain?.name ?? chainId ?? "-"}</b></p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <button onClick={connectMetaMask}>Connect MetaMask</button>
        <button
          onClick={() =>
            connectGuest({
              privKey: "0x...",
              rpcUrl: "https://..."
            })
          }
        >
          Connect Guest (demo key)
        </button>
        <button onClick={() => switchNetwork(polygon)} disabled={!isConnected}>
          Switch to Polygon
        </button>
        <button onClick={disconnect}>Disconnect</button>
      </div>

      <p style={{ marginTop: 12 }}>Signer ready? <b>{signer ? "yes" : "no"}</b></p>
    </div>
  );
}
```

---

## API

### `<WalletProvider />`
Global provider that manages connector state (MetaMask or Guest), current account, chain, and exposes actions.

**Props**
- `knownChains?: ChainConfig[]` — known networks for name/metadata and EIP-3085 `wallet_addEthereumChain`.
- `autoConnect?: boolean` — re-connect last connector (MetaMask only) on mount.

```ts
export interface ChainConfig {
  id: number;              // EIP-155 chain id (decimal)
  name: string;
  rpcUrls: string[];
  icon?: string;
  nativeCurrency?: { name: string; symbol: string; decimals: number };
  blockExplorers?: { name: string; url: string }[];
}
```

---

### `useSigner()`
Returns signer info & connect/disconnect actions.

```ts
type Status = "disconnected" | "connecting" | "connected" | "locked";

function useSigner(): {
  status: Status;
  signer: import("ethers").JsonRpcSigner | import("ethers").Wallet | null;
  connectMetaMask(): Promise<void>;
  connectGuest(params: { privKey: `0x${string}`; rpcUrl: string }): Promise<void>;
  disconnect(): void;
}
```

- **MetaMask**: wraps `window.ethereum` with `BrowserProvider("any")`, follows chain changes automatically.
- **Guest**: constructs `Wallet(privKey, new JsonRpcProvider(rpcUrl))`.  
  *Production note*: encrypt at rest (IndexedDB + WebCrypto) and decrypt only right before signing.

---

### `useAddress()`
Read current address and connection status.

```ts
function useAddress(): {
  address: `0x${string}` | null;
  isConnected: boolean;
}
```

---

### `useNetwork()`
Read chain info and **switch/add** networks.

```ts
function useNetwork(): {
  chainId: number | null;
  chain: ChainConfig | null | undefined;
  connector: "metamask" | "guest" | null;
  refresh(): Promise<void>;
  switchNetwork(target: ChainConfig): Promise<void>; // MetaMask: EIP-3326; Guest: rebind RPC
  addNetwork(params: ChainConfig): Promise<void>;    // EIP-3085 for injected wallets
}
```

- **MetaMask**: tries `wallet_switchEthereumChain`; if unknown (`code=4902`) uses `wallet_addEthereumChain`.
- **Guest**: re-creates `JsonRpcProvider` and `Wallet` with the **same private key**, validates actual `chainId`, then commits state.

---

## Patterns

### Use with `@hazbase/kit` helpers
Most helpers accept an ethers `Signer`. Just `connect(signer)` when available.

```tsx
import { useEffect, useMemo } from "react";
import { JsonRpcProvider } from "ethers";
import { useSigner } from "@hazbase/react";
import { FlexibleTokenHelper } from "@hazbase/kit";

export function BondWidget() {
  const { status, signer } = useSigner();

  const helper = useMemo(() => {
    const provider = new JsonRpcProvider("https://...");
    const token = FlexibleTokenHelper.attach("0xToken..." as `0x${string}`, provider);
  }, []);

  useEffect(() => {
    if (status === "connected" && signer) helper.connect(signer);
  }, [status, signer, helper]);

  // ...
  return null;
}
```

### Connect button (reusable)
```tsx
import { useSigner, useAddress } from "@hazbase/react";

export function ConnectButton() {
  const { status, connectMetaMask, connectGuest, disconnect } = useSigner();
  const { address, isConnected } = useAddress();

  return isConnected ? (
    <div style={{ display: "flex", gap: 8 }}>
      <span>{address?.slice(0, 6)}…{address?.slice(-4)}</span>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  ) : (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={connectMetaMask}>Connect MetaMask</button>
      <button onClick={() => connectGuest({ privKey: "0x...", rpcUrl: "https://..." })}>
        Guest
      </button>
      <span style={{ color: "#888" }}>{status === "connecting" ? "connecting..." : ""}</span>
    </div>
  );
}
```

---

## Behavior notes
- **MetaMask chain change**: With `BrowserProvider(…, "any")`, the provider follows chain changes. This library also listens to `chainChanged` and **re-reads account & signer**.
- **Account change**: `accountsChanged` triggers re-fetching `account` and `signer`.
- **Guest mode**: app-managed RPC & key; always switch networks via `useNetwork().switchNetwork()` to keep state/signers in sync.

---

## Troubleshooting
- **`METAMASK_NOT_FOUND`** — No injected EIP-1193 provider. Show install link or fallback to Guest.  
- **`RPC_URL_REQUIRED` (Guest)** — Target `ChainConfig.rpcUrls[0]` missing.  
- **`CHAIN_ID_MISMATCH` (Guest)** — RPC chain ID differs from `ChainConfig.id`. Fix target config or RPC.  
- **`UNSUPPORTED_CONNECTOR`** — Action not available for current connector.

---

## Roadmap
- WalletConnect connector (EIP-1193 provider → `BrowserProvider`)
- Guest key encryption helpers (IndexedDB + WebCrypto)
- Optional compliance hooks (suitability, reputation/MTC, circuit-breaker)

---

## License
Apache-2.0
