export type X402Network = string;
export type X402Asset = string;
export type X402CompletionMode = 'fragment' | 'none';
export type X402Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface HazbaseX402ClientConfig {
  apiEndpoint?: string;
  fetch?: X402Fetch;
  requestId?: () => string;
  completionParams?: string[];
}

export interface X402PayoutMethod {
  kind: string;
  address?: string;
  [key: string]: unknown;
}

export interface CreateX402RequirementInput {
  resourceId: string;
  resourceUrl: string;
  description?: string;
  mimeType?: string;
  network: X402Network;
  asset: X402Asset;
  assetAddress?: string;
  priceAtomic: string;
  payoutMethod: X402PayoutMethod;
  metadata?: Record<string, unknown>;
}

export interface X402RequirementResult {
  paymentRequestId: string;
  x402: Record<string, unknown>;
  status?: string;
  [key: string]: unknown;
}

export interface SettleX402PaymentInput {
  paymentRequestId: string;
  xPayment: string;
}

export interface X402SettlementResult {
  settled: boolean;
  verified?: boolean;
  payer?: string | null;
  transactionHash?: string | null;
  status?: string;
  errorCode?: string;
  invalidReason?: string;
  [key: string]: unknown;
}

export interface X402WalletHandoffInput {
  walletUrl: string;
  x402: Record<string, unknown>;
  sourceUrl: string;
  title?: string;
  completion?: X402CompletionMode;
  completionParam?: string;
}

export interface X402PaymentFromUrl {
  xPayment: string;
  param: string;
  source: 'hash' | 'search';
}

export interface ReadX402PaymentFromUrlOptions {
  params?: string[];
}

export interface HazbaseX402Client {
  createRequirement(input: CreateX402RequirementInput): Promise<X402RequirementResult>;
  settlePayment(input: SettleX402PaymentInput): Promise<X402SettlementResult>;
  createWalletUrl(input: X402WalletHandoffInput): string;
  readPaymentFromUrl(input?: string | URL, options?: ReadX402PaymentFromUrlOptions): X402PaymentFromUrl | null;
  parsePayload(input: string): Record<string, unknown> | null;
}
