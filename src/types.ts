export type Hex = `0x${string}`;

export type Status = 'disconnected' | 'connecting' | 'connected' | 'locked';

export interface ChainConfig {
  id: number;
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

export interface SupportedChainSummary {
  chainId: number;
  key: string;
  name: string;
  kind: 'testnet' | 'mainnet';
  rpcUrl: string;
  bundlerRpcUrl?: string | null;
  entryPointAddress: Hex | string;
  paymasterAddress?: Hex | string | null;
  defaultAccountVariant?: string;
  defaultProfileKey?: string | null;
  blockExplorerUrl?: string | null;
  capabilities?: {
    owner: boolean;
    session: boolean;
    sponsor: boolean;
    firstPartyProfiles: boolean;
  };
}

export interface SupportedChainsResult {
  defaultChainId: number;
  chains: SupportedChainSummary[];
  status?: string;
}

export interface EmailOtpAccountSummary {
  smartAccountAddress: Hex;
  chainId: number;
  accountVariant?: string;
  relayMode?: string;
  primaryDeviceBindingId?: string;
  updatedAt?: string;
}

export interface EmailOtpSession {
  email: string;
  accessToken: string;
  refreshToken?: string;
  sessionId?: string;
  userId?: string;
  ownerBootstrapRequired?: boolean;
  smartAccountAddress?: Hex;
  accountVariant?: string;
  relayMode?: string;
  accounts?: EmailOtpAccountSummary[];
  [key: string]: unknown;
}

export interface EmbeddedSessionGrant {
  sessionId?: string;
  chainId?: number;
  sessionKeyAddress?: Hex;
  validUntil?: string | number;
  level?: number | string;
  profileKey?: string;
  gasBudgetInitial?: string;
  gasBudgetRemaining?: string;
  accountVariant?: string;
  grantStatus?: string;
  grantTxHash?: Hex | string;
  revokeTxHash?: Hex | string | null;
  revokeStatus?: string;
  sessionVersion?: number;
  grantedTargets?: Hex[];
  grantedSelectors?: Record<string, Hex[] | string[]>;
  relayMode?: string;
  submittedUserOpHash?: Hex | string | null;
  receipt?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface PasskeyDeviceRecord {
  deviceBindingId: string;
  credentialId: string;
  label?: string | null;
  displayDeviceId?: string | null;
  status: string;
  createdAt?: string;
  lastAssertedAt?: string | null;
}

export interface PasskeyDeviceInventory {
  devices: PasskeyDeviceRecord[];
  status?: string;
}

export interface RevokePasskeyDeviceResult {
  deviceBindingId: string;
  cascadedEmbeddedSessions?: boolean;
  status?: string;
}

export interface EmbeddedSessionRecord {
  embeddedSessionId: string;
  smartAccountAddress: Hex;
  chainId?: number;
  deviceBindingId: string;
  actionProfileKey: string;
  sessionKeyAddress?: Hex;
  validUntil?: string;
  gasBudgetRemaining?: string;
  createdAt?: string;
  accountVariant?: string;
  grantStatus?: string;
  grantTxHash?: Hex | string | null;
  sessionVersion?: number;
  relayMode?: string | null;
  lastExecutionTxHash?: Hex | string | null;
  lastExecutionAt?: string | null;
}

export interface EmbeddedSessionInventory {
  sessions: EmbeddedSessionRecord[];
  status?: string;
}

export interface RevokeEmbeddedSessionResult {
  embeddedSessionId: string;
  chainId?: number;
  accountVariant?: string;
  relayMode?: string;
  revokeTxHash?: Hex | string | null;
  submittedUserOpHash?: Hex | string | null;
  revokeStatus?: string;
  status?: string;
}

export type PasskeyAssertionPurpose = 'bootstrap' | 'migration' | 'reauth' | 'session';
export type PasskeyAlgorithm = 'ES256' | 'RS256';
export type PasskeyFlowStep =
  | 'signed_out'
  | 'otp_requested'
  | 'email_verified'
  | 'passkey_bound'
  | 'high_trust_ready'
  | 'account_ready'
  | 'session_ready'
  | 'session_granted'
  | 'error';

export interface PasskeyRegistrationChallengeResult {
  challengeId: string;
  challenge: string;
  rpId: string;
  rpName: string;
  origin: string;
  userHandle: string;
  userName: string;
  userDisplayName: string;
  timeoutMs?: number;
  excludeCredentialIds?: string[];
  status?: string;
  [key: string]: unknown;
}

export interface PasskeyRegistrationCredential {
  username: string;
  credential: {
    id: string;
    publicKey: string;
    algorithm: PasskeyAlgorithm;
  };
  authenticatorData: string;
  clientData: string;
  attestationData?: string;
}

export interface PasskeyRegistrationResult {
  deviceBindingId: string;
  credentialId: string;
  status?: string;
  userId?: string;
  [key: string]: unknown;
}

export interface PasskeyAssertionChallengeResult {
  challengeId: string;
  challenge: string;
  rpId: string;
  origin: string;
  timeoutMs?: number;
  purpose: PasskeyAssertionPurpose;
  deviceBindingId?: string;
  credentialIds?: string[];
  status?: string;
  [key: string]: unknown;
}

export interface PasskeyAssertionCredential {
  credentialId: string;
  authenticatorData: string;
  clientData: string;
  signature: string;
  userHandle?: string;
}

export interface PasskeyAssertionResult {
  deviceBindingId: string;
  credentialId: string;
  purpose: PasskeyAssertionPurpose;
  assertedAt?: string;
  highTrustToken?: string;
  highTrustExpiresAt?: string;
  status?: string;
  [key: string]: unknown;
}

export interface PasskeyAccountDescriptor {
  chainId: number;
  factoryAddress: Hex;
  ownerValidator: Hex;
  ownerConfig: Hex;
  ownerConfigHash: Hex;
  predictedAccountAddress: Hex;
  accountSalt: string;
  accountVariant?: string;
  relayMode?: string;
  credentialId?: string;
  deviceBindingId?: string;
  status?: string;
}

export interface PasskeyAccountBootstrapResult extends PasskeyAccountDescriptor {
  smartAccountAddress: Hex;
  userId?: string;
}

export interface PasskeyAccountReadyResult extends PasskeyAccountDescriptor {
  smartAccountAddress: Hex;
  bootstrapped: boolean;
}

export interface OwnerUserOpAuthorization {
  ownerValidator: Hex;
  ownerConfigHash: Hex;
  accountVariant?: string;
  relayMode?: string;
  validAfter: number;
  validUntil: number;
  signatureType: number;
  signaturePayload: Hex;
  accountSignature: Hex;
  status?: string;
}

export type SessionSigningMode = 'none' | 'session';

export interface SponsorUserOpResult {
  decisionId: string;
  approved: boolean;
  expiresAt: string;
  profileKey: string;
  chainId?: number | null;
  paymasterAndData: Hex;
  validAfter: number;
  validUntil: number;
  paymasterAddress: Hex;
  sponsoredUserOpHash?: Hex;
  sessionKeyAddress?: Hex;
  accountSignature?: Hex;
  signingMode?: SessionSigningMode;
  status?: string;
}

export interface DirectRelayExecutionResult {
  chainId?: number;
  accountVariant?: string;
  relayMode?: string;
  bundlerRpcUrl?: string;
  rpcUrl?: string;
  smartAccountAddress?: Hex;
  relayerAddress?: Hex;
  beneficiary?: Hex;
  nonce?: string;
  initCode?: Hex;
  target?: Hex;
  data?: Hex;
  value?: string;
  localUserOpHash?: Hex;
  submittedUserOpHash?: Hex | string | null;
  transactionHash?: Hex;
  receipt?: Record<string, unknown> | null;
  sponsor?: SponsorUserOpResult;
  status?: string;
  [key: string]: unknown;
}

export interface UserOperationDraft {
  sender: Hex;
  nonce: bigint | number | string;
  initCode?: Hex;
  callData: Hex;
  callGasLimit: bigint | number | string;
  verificationGasLimit: bigint | number | string;
  preVerificationGas?: bigint | number | string;
  maxFeePerGas?: bigint | number | string;
  maxPriorityFeePerGas?: bigint | number | string;
}

export interface BundlerUserOperation extends UserOperationDraft {
  preVerificationGas: bigint | number | string;
  maxFeePerGas: bigint | number | string;
  maxPriorityFeePerGas: bigint | number | string;
  paymasterAndData?: Hex;
  signature?: Hex;
}

export interface BundlerSendResult {
  userOpHash: Hex;
  transactionHash?: Hex;
  receipt?: Record<string, unknown> | null;
  userOp: BundlerUserOperation & {
    paymasterAndData: Hex;
    signature: Hex;
  };
  sponsor: SponsorUserOpResult;
}

export interface HazbasePasskeyClient {
  listSupportedChains(): Promise<SupportedChainsResult>;
  sendOtp(input: { email: string; purpose?: string }): Promise<unknown>;
  verifyOtp(input: { email: string; code: string; purpose?: string }): Promise<EmailOtpSession>;
  registerPasskey(input: { emailSession: EmailOtpSession; deviceId?: string; deviceLabel?: string }): Promise<PasskeyRegistrationResult>;
  assertPasskey(input: { emailSession: EmailOtpSession; purpose?: PasskeyAssertionPurpose; deviceBindingId?: string }): Promise<PasskeyAssertionResult>;
  getAccountDescriptor(input: { emailSession: EmailOtpSession; deviceBindingId: string; accountSalt?: string; chainId?: number; accountVariant?: string }): Promise<PasskeyAccountDescriptor>;
  bootstrapAccount(input: {
    emailSession: EmailOtpSession;
    deviceBindingId: string;
    highTrustToken: string;
    accountSalt?: string;
    chainId?: number;
    accountVariant?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PasskeyAccountBootstrapResult>;
  lookupAccount(input: { emailSession: EmailOtpSession; deviceBindingId?: string; smartAccountAddress?: Hex; chainId?: number }): Promise<Record<string, unknown>>;
  authorizeOwnerUserOp(input: {
    emailSession: EmailOtpSession;
    deviceBindingId: string;
    highTrustToken: string;
    smartAccountAddress: Hex;
    chainId?: number;
    userOpHash: Hex;
    validForSec?: number;
  }): Promise<OwnerUserOpAuthorization>;
  startSession(input: {
    emailSession: EmailOtpSession;
    deviceBindingId: string;
    smartAccountAddress: Hex;
    chainId?: number;
    actionProfileKey: string;
    highTrustToken: string;
    sessionKeyAddress?: Hex;
    metadata?: Record<string, unknown>;
  }): Promise<EmbeddedSessionGrant>;
  grantSession(input: {
    emailSession: EmailOtpSession;
    embeddedSessionId: string;
    smartAccountAddress: Hex;
    deviceBindingId: string;
    highTrustToken: string;
  }): Promise<EmbeddedSessionGrant>;
  executeSession(input: {
    emailSession: EmailOtpSession;
    embeddedSessionId: string;
    userOp: UserOperationDraft;
    target: Hex;
    data: Hex;
    value?: bigint | number | string;
    paymasterValiditySec?: string;
    metadata?: Record<string, unknown>;
    waitForReceipt?: boolean;
  }): Promise<DirectRelayExecutionResult>;
  endSession(input: { emailSession: EmailOtpSession; embeddedSessionId: string }): Promise<void>;
  listPasskeyDevices(input: { emailSession: EmailOtpSession }): Promise<PasskeyDeviceInventory>;
  revokePasskeyDevice(input: {
    emailSession: EmailOtpSession;
    deviceBindingId: string;
    highTrustToken: string;
  }): Promise<RevokePasskeyDeviceResult>;
  listEmbeddedSessions(input: { emailSession: EmailOtpSession }): Promise<EmbeddedSessionInventory>;
  revokeEmbeddedSession(input: {
    emailSession: EmailOtpSession;
    embeddedSessionId: string;
    highTrustToken: string;
  }): Promise<RevokeEmbeddedSessionResult>;
  sponsorUserOp(input: {
    emailSession: EmailOtpSession;
    embeddedSessionId: string;
    userOp: UserOperationDraft;
    target: Hex;
    data: Hex;
    value?: bigint | number | string;
    paymasterValiditySec?: string;
    signingMode?: SessionSigningMode;
    metadata?: Record<string, unknown>;
  }): Promise<SponsorUserOpResult>;
}
