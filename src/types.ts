// English comments only in code
export type Hex = `0x${string}`;

export type Status = "disconnected" | "connecting" | "connected" | "locked";

export interface ChainConfig {
  id: number; // EIP-155 chain id (decimal)
  name: string;
  rpcUrls: string[];
  icon?: string;
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorers?: { name: string; url: string }[];
}
