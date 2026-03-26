import React, { createContext, useCallback, useMemo, useState } from 'react';
import { AbiCoder, keccak256 } from 'ethers';
import { createExecuteBatchUserOp, createExecuteUserOp, type SmartAccountCall } from '../userop/accountExecute';
import type {
  BundlerSendResult,
  BundlerUserOperation,
  EmailOtpSession,
  EmbeddedSessionGrant,
  HazbasePasskeyClient,
  Hex,
  OwnerUserOpAuthorization,
  PasskeyAccountDescriptor,
  PasskeyAccountReadyResult,
  PasskeyAssertionPurpose,
  PasskeyAssertionResult,
  PasskeyFlowStep,
  PasskeyRegistrationResult,
  SessionSigningMode,
  SponsorUserOpResult,
  UserOperationDraft,
} from '../types';

const DEFAULT_BUNDLER_BASE_URL = 'https://bundler.hazbase.com';
const DEFAULT_ENTRYPOINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Hex;

function hashBytes(value?: Hex): Hex {
  return keccak256(value ?? '0x') as Hex;
}

function packUserOp(userOp: BundlerUserOperation & { paymasterAndData: Hex; signature: Hex }): Hex {
  return AbiCoder.defaultAbiCoder().encode(
    ['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'],
    [
      userOp.sender,
      BigInt(userOp.nonce),
      hashBytes(userOp.initCode),
      hashBytes(userOp.callData),
      BigInt(userOp.callGasLimit),
      BigInt(userOp.verificationGasLimit),
      BigInt(userOp.preVerificationGas),
      BigInt(userOp.maxFeePerGas),
      BigInt(userOp.maxPriorityFeePerGas),
      hashBytes(userOp.paymasterAndData),
    ],
  ) as Hex;
}

function getUserOpHash(params: {
  chainId: number;
  entryPointAddress: Hex;
  userOp: BundlerUserOperation & { paymasterAndData: Hex; signature: Hex };
}): Hex {
  const packed = packUserOp(params.userOp);
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'address', 'uint256'],
      [keccak256(packed), params.entryPointAddress, BigInt(params.chainId)],
    ),
  ) as Hex;
}

async function sendBundlerRpc<T>(bundlerRpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(bundlerRpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });

  if (!res.ok) {
    throw new Error(`Bundler request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json().catch(() => undefined);
  if (json?.error) {
    throw new Error(json.error.message ?? 'Bundler RPC error');
  }
  return json?.result as T;
}

async function waitForBundlerReceipt(
  bundlerRpcUrl: string,
  userOpHash: Hex,
  intervalMs: number,
  maxAttempts: number,
): Promise<Record<string, unknown> | null> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const result = await sendBundlerRpc<Record<string, unknown> | null>(bundlerRpcUrl, 'eth_getUserOperationReceipt', [userOpHash]);
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

export interface PasskeyAccountState {
  status: 'idle' | 'ready' | 'error';
  flowStep: PasskeyFlowStep;
  emailSession: EmailOtpSession | null;
  deviceBindingId: string | null;
  passkeyCredentialId: string | null;
  highTrustToken: string | null;
  highTrustExpiresAt: string | null;
  descriptor: PasskeyAccountDescriptor | null;
  smartAccountAddress: Hex | null;
  serverSession: EmbeddedSessionGrant | null;
  error: string | null;
}

export interface PasskeyAccountActions {
  sendOtp(input: { email: string; purpose?: string }): Promise<unknown>;
  verifyOtp(input: { email: string; code: string; purpose?: string }): Promise<EmailOtpSession>;
  ensurePasskey(options?: { deviceId?: string; deviceLabel?: string }): Promise<PasskeyRegistrationResult>;
  ensureHighTrust(options?: { purpose?: PasskeyAssertionPurpose; force?: boolean }): Promise<PasskeyAssertionResult>;
  ensureAccount(options?: { accountSalt?: string; chainId?: number; metadata?: Record<string, unknown>; forceBootstrap?: boolean }): Promise<PasskeyAccountReadyResult>;
  ensureSession(options?: {
    actionProfileKey?: string;
    sessionKeyAddress?: Hex;
    metadata?: Record<string, unknown>;
    forceNew?: boolean;
  }): Promise<EmbeddedSessionGrant>;
  refreshAccount(input?: { smartAccountAddress?: Hex }): Promise<Record<string, unknown>>;
  authorizeOwnerUserOp(input: { smartAccountAddress?: Hex; userOpHash: Hex; validForSec?: number }): Promise<OwnerUserOpAuthorization>;
  sponsorUserOp(input: {
    embeddedSessionId?: string;
    actionProfileKey?: string;
    userOp: UserOperationDraft;
    target: Hex;
    data: Hex;
    value?: bigint | number | string;
    paymasterValiditySec?: string;
    signingMode?: SessionSigningMode;
    metadata?: Record<string, unknown>;
  }): Promise<SponsorUserOpResult>;
  sponsorAndSend(input: {
    mode?: 'owner' | 'session';
    embeddedSessionId?: string;
    actionProfileKey?: string;
    userOp: BundlerUserOperation;
    target: Hex;
    data: Hex;
    value?: bigint | number | string;
    paymasterValiditySec?: string;
    metadata?: Record<string, unknown>;
    waitForReceipt?: boolean;
  }): Promise<BundlerSendResult>;
  sponsorAndSendExecute(input: {
    mode?: 'owner' | 'session';
    embeddedSessionId?: string;
    actionProfileKey?: string;
    nonce: bigint | number | string;
    target: Hex;
    data: Hex;
    value?: bigint | number | string;
    initCode?: Hex;
    callGasLimit: bigint | number | string;
    verificationGasLimit: bigint | number | string;
    preVerificationGas: bigint | number | string;
    maxFeePerGas: bigint | number | string;
    maxPriorityFeePerGas: bigint | number | string;
    paymasterValiditySec?: string;
    metadata?: Record<string, unknown>;
    waitForReceipt?: boolean;
  }): Promise<BundlerSendResult>;
  sponsorAndSendExecuteBatch(input: {
    mode?: 'owner' | 'session';
    embeddedSessionId?: string;
    actionProfileKey?: string;
    nonce: bigint | number | string;
    calls: SmartAccountCall[];
    initCode?: Hex;
    callGasLimit: bigint | number | string;
    verificationGasLimit: bigint | number | string;
    preVerificationGas: bigint | number | string;
    maxFeePerGas: bigint | number | string;
    maxPriorityFeePerGas: bigint | number | string;
    paymasterValiditySec?: string;
    metadata?: Record<string, unknown>;
    waitForReceipt?: boolean;
  }): Promise<BundlerSendResult>;
  endSession(): Promise<void>;
  signOut(): void;
  raw: HazbasePasskeyClient;
}

export interface PasskeyAccountProviderProps {
  children: React.ReactNode;
  client: HazbasePasskeyClient;
  defaultOtpPurpose?: string;
  defaultAccountSalt?: string;
  defaultChainId?: number;
  defaultActionProfileKey?: string;
  defaultOwnerValidForSec?: number;
  bundlerRpcUrl?: string;
  entryPointAddress?: Hex;
  bundlerWaitMs?: number;
  bundlerMaxAttempts?: number;
}

export const PasskeyAccountContext = createContext<(PasskeyAccountState & PasskeyAccountActions) | null>(null);

/**
 * Coordinates the hazBase passkey login flow around a single client object.
 *
 * Apps interact with flow helpers like `ensurePasskey`, `ensureAccount`, and
 * `ensureSession` rather than manually threading OTP sessions, device bindings,
 * and step-up tokens through each backend call.
 */
export function PasskeyAccountProvider({
  children,
  client,
  defaultOtpPurpose = 'smart_wallet_sign_in',
  defaultAccountSalt,
  defaultChainId,
  defaultActionProfileKey,
  defaultOwnerValidForSec,
  bundlerRpcUrl,
  entryPointAddress = DEFAULT_ENTRYPOINT_ADDRESS,
  bundlerWaitMs = 750,
  bundlerMaxAttempts = 40,
}: PasskeyAccountProviderProps) {
  const [state, setState] = useState<PasskeyAccountState>({
    status: 'idle',
    flowStep: 'signed_out',
    emailSession: null,
    deviceBindingId: null,
    passkeyCredentialId: null,
    highTrustToken: null,
    highTrustExpiresAt: null,
    descriptor: null,
    smartAccountAddress: null,
    serverSession: null,
    error: null,
  });

  const applyError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown passkey flow error';
    setState((prev) => ({ ...prev, status: 'error', flowStep: 'error', error: message }));
    throw error;
  }, []);

  const requireEmailSession = useCallback(() => {
    if (!state.emailSession) throw new Error('Email OTP session is required');
    return state.emailSession;
  }, [state.emailSession]);

  const requireDeviceBinding = useCallback(() => {
    if (!state.deviceBindingId) throw new Error('Passkey device binding is required');
    return state.deviceBindingId;
  }, [state.deviceBindingId]);

  const requireHighTrust = useCallback(() => {
    if (!state.highTrustToken) throw new Error('Passkey step-up is required');
    return state.highTrustToken;
  }, [state.highTrustToken]);

  const resolveChainId = useCallback((override?: number) => {
    return override ?? state.descriptor?.chainId ?? defaultChainId;
  }, [defaultChainId, state.descriptor?.chainId]);

  const resolveBundlerUrl = useCallback((chainId: number) => {
    if (bundlerRpcUrl) return bundlerRpcUrl;
    return `${DEFAULT_BUNDLER_BASE_URL}/${chainId}`;
  }, [bundlerRpcUrl]);

  const sendOtp = useCallback(async ({ email, purpose }: { email: string; purpose?: string }) => {
    try {
      const result = await client.sendOtp({ email, purpose: purpose ?? defaultOtpPurpose });
      setState((prev) => ({ ...prev, status: 'ready', flowStep: 'otp_requested', error: null }));
      return result;
    } catch (error) {
      return applyError(error);
    }
  }, [applyError, client, defaultOtpPurpose]);

  const verifyOtp = useCallback(async ({ email, code, purpose }: { email: string; code: string; purpose?: string }) => {
    try {
      const session = await client.verifyOtp({ email, code, purpose: purpose ?? defaultOtpPurpose });
      setState((prev) => ({
        ...prev,
        status: 'ready',
        flowStep: 'email_verified',
        emailSession: session,
        smartAccountAddress: (session.smartAccountAddress as Hex | undefined) ?? prev.smartAccountAddress,
        error: null,
      }));
      return session;
    } catch (error) {
      return applyError(error);
    }
  }, [applyError, client, defaultOtpPurpose]);

  const ensurePasskey = useCallback(async ({ deviceId, deviceLabel }: { deviceId?: string; deviceLabel?: string } = {}) => {
    if (state.deviceBindingId && state.passkeyCredentialId) {
      return {
        deviceBindingId: state.deviceBindingId,
        credentialId: state.passkeyCredentialId,
        status: 'reused',
      } as PasskeyRegistrationResult;
    }

    try {
      const result = await client.registerPasskey({
        emailSession: requireEmailSession(),
        ...(deviceId ? { deviceId } : {}),
        ...(deviceLabel ? { deviceLabel } : {}),
      });
      setState((prev) => ({
        ...prev,
        status: 'ready',
        flowStep: 'passkey_bound',
        deviceBindingId: result.deviceBindingId,
        passkeyCredentialId: result.credentialId,
        error: null,
      }));
      return result;
    } catch (error) {
      return applyError(error);
    }
  }, [applyError, client, requireEmailSession, state.deviceBindingId, state.passkeyCredentialId]);

  const ensureHighTrust = useCallback(async ({ purpose = 'reauth', force = false }: { purpose?: PasskeyAssertionPurpose; force?: boolean } = {}) => {
    if (!force && state.highTrustToken && state.highTrustExpiresAt && new Date(state.highTrustExpiresAt).getTime() > Date.now()) {
      return {
        deviceBindingId: state.deviceBindingId ?? requireDeviceBinding(),
        credentialId: state.passkeyCredentialId ?? '',
        purpose,
        highTrustToken: state.highTrustToken,
        highTrustExpiresAt: state.highTrustExpiresAt ?? undefined,
        status: 'reused',
      } as PasskeyAssertionResult;
    }

    try {
      const result = await client.assertPasskey({
        emailSession: requireEmailSession(),
        purpose,
        deviceBindingId: state.deviceBindingId ?? undefined,
      });
      setState((prev) => ({
        ...prev,
        status: 'ready',
        flowStep: 'high_trust_ready',
        deviceBindingId: result.deviceBindingId,
        passkeyCredentialId: result.credentialId,
        highTrustToken: result.highTrustToken ?? prev.highTrustToken,
        highTrustExpiresAt: result.highTrustExpiresAt ?? prev.highTrustExpiresAt,
        error: null,
      }));
      return result;
    } catch (error) {
      return applyError(error);
    }
  }, [applyError, client, requireDeviceBinding, requireEmailSession, state.deviceBindingId, state.highTrustExpiresAt, state.highTrustToken, state.passkeyCredentialId]);

  const refreshAccount = useCallback(async ({ smartAccountAddress }: { smartAccountAddress?: Hex } = {}) => {
    try {
      const record = await client.lookupAccount({
        emailSession: requireEmailSession(),
        ...(smartAccountAddress ? { smartAccountAddress } : {}),
        ...(!smartAccountAddress && state.deviceBindingId ? { deviceBindingId: state.deviceBindingId } : {}),
      });
      setState((prev) => ({
        ...prev,
        status: 'ready',
        flowStep: record.smartAccountAddress ? 'account_ready' : prev.flowStep,
        smartAccountAddress: (record.smartAccountAddress as Hex | undefined) ?? prev.smartAccountAddress,
        error: null,
      }));
      return record;
    } catch (error) {
      return applyError(error);
    }
  }, [applyError, client, requireEmailSession, state.deviceBindingId]);

  const ensureAccount = useCallback(async ({ accountSalt, chainId, metadata, forceBootstrap = false }: { accountSalt?: string; chainId?: number; metadata?: Record<string, unknown>; forceBootstrap?: boolean } = {}) => {
    try {
      await ensurePasskey();
      const emailSession = requireEmailSession();
      const deviceBindingId = requireDeviceBinding();
      const descriptor = await client.getAccountDescriptor({
        emailSession,
        deviceBindingId,
        accountSalt: accountSalt ?? defaultAccountSalt,
        chainId: chainId ?? defaultChainId,
      });

      const lookup = await client.lookupAccount({
        emailSession,
        smartAccountAddress: descriptor.predictedAccountAddress,
      });

      if (!forceBootstrap && lookup.smartAccountAddress) {
        const readyResult: PasskeyAccountReadyResult = {
          ...descriptor,
          smartAccountAddress: lookup.smartAccountAddress as Hex,
          bootstrapped: false,
        };
        setState((prev) => ({
          ...prev,
          status: 'ready',
          flowStep: 'account_ready',
          descriptor,
          smartAccountAddress: readyResult.smartAccountAddress,
          error: null,
        }));
        return readyResult;
      }

      const stepUp = await ensureHighTrust({ purpose: 'bootstrap' });
      const result = await client.bootstrapAccount({
        emailSession,
        deviceBindingId,
        highTrustToken: stepUp.highTrustToken ?? requireHighTrust(),
        ...(accountSalt ?? defaultAccountSalt ? { accountSalt: accountSalt ?? defaultAccountSalt } : {}),
        ...(chainId ?? defaultChainId ? { chainId: chainId ?? defaultChainId } : {}),
        ...(metadata ? { metadata } : {}),
      });
      const readyResult: PasskeyAccountReadyResult = {
        ...result,
        smartAccountAddress: result.smartAccountAddress,
        bootstrapped: true,
      };
      setState((prev) => ({
        ...prev,
        status: 'ready',
        flowStep: 'account_ready',
        descriptor: result,
        smartAccountAddress: result.smartAccountAddress,
        error: null,
      }));
      return readyResult;
    } catch (error) {
      return applyError(error);
    }
  }, [applyError, client, defaultAccountSalt, defaultChainId, ensureHighTrust, ensurePasskey, requireDeviceBinding, requireEmailSession, requireHighTrust]);

  const ensureSession = useCallback(async ({
    actionProfileKey,
    sessionKeyAddress,
    metadata,
    forceNew = false,
  }: {
    actionProfileKey?: string;
    sessionKeyAddress?: Hex;
    metadata?: Record<string, unknown>;
    forceNew?: boolean;
  } = {}) => {
    if (!forceNew && state.serverSession?.sessionId) {
      return state.serverSession;
    }
    try {
      const accountAddress = state.smartAccountAddress ?? (await ensureAccount()).smartAccountAddress;
      const emailSession = requireEmailSession();
      const deviceBindingId = requireDeviceBinding();
      const stepUp = await ensureHighTrust({ purpose: 'session', force: true });
      const profileKey = actionProfileKey ?? defaultActionProfileKey;
      if (!profileKey) throw new Error('actionProfileKey is required to start an embedded session');
      const result = await client.startSession({
        emailSession,
        deviceBindingId,
        smartAccountAddress: accountAddress,
        actionProfileKey: profileKey,
        highTrustToken: stepUp.highTrustToken ?? requireHighTrust(),
        ...(sessionKeyAddress ? { sessionKeyAddress } : {}),
        ...(metadata ? { metadata } : {}),
      });
      setState((prev) => ({
        ...prev,
        status: 'ready',
        flowStep: 'session_ready',
        serverSession: result,
        error: null,
      }));
      return result;
    } catch (error) {
      return applyError(error);
    }
  }, [applyError, client, defaultActionProfileKey, ensureAccount, ensureHighTrust, requireDeviceBinding, requireEmailSession, requireHighTrust, state.serverSession, state.smartAccountAddress]);

  const authorizeOwnerUserOpAction = useCallback(async ({ smartAccountAddress, userOpHash, validForSec }: { smartAccountAddress?: Hex; userOpHash: Hex; validForSec?: number }) => {
    try {
      const account = smartAccountAddress ?? state.smartAccountAddress ?? (await ensureAccount()).smartAccountAddress;
      const stepUp = await ensureHighTrust({ purpose: 'reauth' });
      return await client.authorizeOwnerUserOp({
        emailSession: requireEmailSession(),
        deviceBindingId: requireDeviceBinding(),
        highTrustToken: stepUp.highTrustToken ?? requireHighTrust(),
        smartAccountAddress: account,
        userOpHash,
        ...(validForSec != null ? { validForSec } : defaultOwnerValidForSec != null ? { validForSec: defaultOwnerValidForSec } : {}),
      });
    } catch (error) {
      return applyError(error);
    }
  }, [applyError, client, defaultOwnerValidForSec, ensureAccount, ensureHighTrust, requireDeviceBinding, requireEmailSession, requireHighTrust, state.smartAccountAddress]);

  const sponsorUserOpAction = useCallback(async ({
    embeddedSessionId,
    actionProfileKey,
    userOp,
    target,
    data,
    value,
    paymasterValiditySec,
    signingMode,
    metadata,
  }: {
    embeddedSessionId?: string;
    actionProfileKey?: string;
    userOp: UserOperationDraft;
    target: Hex;
    data: Hex;
    value?: bigint | number | string;
    paymasterValiditySec?: string;
    signingMode?: SessionSigningMode;
    metadata?: Record<string, unknown>;
  }) => {
    try {
      const sessionId = embeddedSessionId ?? state.serverSession?.sessionId ?? (await ensureSession({ actionProfileKey })).sessionId;
      if (!sessionId) throw new Error('Embedded session is required');
      return await client.sponsorUserOp({
        emailSession: requireEmailSession(),
        embeddedSessionId: sessionId,
        userOp,
        target,
        data,
        ...(value != null ? { value } : {}),
        ...(paymasterValiditySec ? { paymasterValiditySec } : {}),
        ...(signingMode ? { signingMode } : {}),
        ...(metadata ? { metadata } : {}),
      });
    } catch (error) {
      return applyError(error);
    }
  }, [applyError, client, ensureSession, requireEmailSession, state.serverSession?.sessionId]);

  const sponsorAndSend = useCallback(async ({
    mode = 'session',
    embeddedSessionId,
    actionProfileKey,
    userOp,
    target,
    data,
    value,
    paymasterValiditySec,
    metadata,
    waitForReceipt = true,
  }: {
    mode?: 'owner' | 'session';
    embeddedSessionId?: string;
    actionProfileKey?: string;
    userOp: BundlerUserOperation;
    target: Hex;
    data: Hex;
    value?: bigint | number | string;
    paymasterValiditySec?: string;
    metadata?: Record<string, unknown>;
    waitForReceipt?: boolean;
  }) => {
    try {
      const account = state.smartAccountAddress ?? (await ensureAccount()).smartAccountAddress;
      const emailSession = requireEmailSession();
      const session = embeddedSessionId
        ? { ...(state.serverSession ?? {}), sessionId: embeddedSessionId }
        : await ensureSession({ actionProfileKey });
      if (!session.sessionId) throw new Error('Embedded session is required');

      const sponsor = await client.sponsorUserOp({
        emailSession,
        embeddedSessionId: session.sessionId,
        userOp,
        target,
        data,
        ...(value != null ? { value } : {}),
        ...(paymasterValiditySec ? { paymasterValiditySec } : {}),
        signingMode: mode === 'session' ? 'session' : 'none',
        ...(metadata ? { metadata } : {}),
      });

      const chainId = resolveChainId();
      if (!chainId) throw new Error('Chain ID is required to submit a sponsored user operation');
      const finalizedUserOp = {
        ...userOp,
        initCode: userOp.initCode ?? '0x',
        paymasterAndData: sponsor.paymasterAndData,
        signature: (userOp.signature ?? '0x') as Hex,
      } as BundlerUserOperation & { paymasterAndData: Hex; signature: Hex };

      const localUserOpHash = getUserOpHash({
        chainId,
        entryPointAddress,
        userOp: finalizedUserOp,
      });

      if (mode === 'session') {
        if (!sponsor.accountSignature) {
          throw new Error('Session-mode sponsor response is missing accountSignature');
        }
        if (sponsor.sponsoredUserOpHash && sponsor.sponsoredUserOpHash !== localUserOpHash) {
          throw new Error('Session-mode sponsor response returned a mismatched sponsoredUserOpHash');
        }
        finalizedUserOp.signature = sponsor.accountSignature;
      } else {
        const ownerAuthorization = await authorizeOwnerUserOpAction({
          smartAccountAddress: account,
          userOpHash: localUserOpHash,
        });
        finalizedUserOp.signature = ownerAuthorization.accountSignature;
      }

      const bundlerUrl = resolveBundlerUrl(chainId);
      const submittedUserOpHash = await sendBundlerRpc<Hex>(bundlerUrl, 'eth_sendUserOperation', [finalizedUserOp, entryPointAddress]);
      const receiptEnvelope = waitForReceipt
        ? await waitForBundlerReceipt(bundlerUrl, submittedUserOpHash, bundlerWaitMs, bundlerMaxAttempts)
        : null;
      const receipt = receiptEnvelope && typeof receiptEnvelope === 'object' && 'receipt' in receiptEnvelope
        ? (receiptEnvelope.receipt as Record<string, unknown> | null)
        : (receiptEnvelope as Record<string, unknown> | null);
      const transactionHash = receipt?.transactionHash as Hex | undefined;

      return {
        userOpHash: submittedUserOpHash,
        transactionHash,
        receipt,
        userOp: finalizedUserOp,
        sponsor,
      };
    } catch (error) {
      return applyError(error);
    }
  }, [
    applyError,
    authorizeOwnerUserOpAction,
    bundlerMaxAttempts,
    bundlerWaitMs,
    client,
    ensureAccount,
    ensureSession,
    entryPointAddress,
    requireEmailSession,
    resolveBundlerUrl,
    resolveChainId,
    state.serverSession,
    state.smartAccountAddress,
  ]);

  const sponsorAndSendExecute = useCallback(async ({
    nonce,
    target,
    data,
    value,
    initCode,
    callGasLimit,
    verificationGasLimit,
    preVerificationGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    ...rest
  }: {
    mode?: 'owner' | 'session';
    embeddedSessionId?: string;
    actionProfileKey?: string;
    nonce: bigint | number | string;
    target: Hex;
    data: Hex;
    value?: bigint | number | string;
    initCode?: Hex;
    callGasLimit: bigint | number | string;
    verificationGasLimit: bigint | number | string;
    preVerificationGas: bigint | number | string;
    maxFeePerGas: bigint | number | string;
    maxPriorityFeePerGas: bigint | number | string;
    paymasterValiditySec?: string;
    metadata?: Record<string, unknown>;
    waitForReceipt?: boolean;
  }) => {
    const sender = state.smartAccountAddress ?? (await ensureAccount()).smartAccountAddress;
    const userOp = createExecuteUserOp({
      sender,
      nonce,
      target,
      data,
      ...(value != null ? { value } : {}),
      ...(initCode ? { initCode } : {}),
      callGasLimit,
      verificationGasLimit,
      preVerificationGas,
      maxFeePerGas,
      maxPriorityFeePerGas,
    });
    return sponsorAndSend({
      ...rest,
      userOp,
      target,
      data,
      ...(value != null ? { value } : {}),
    });
  }, [ensureAccount, sponsorAndSend, state.smartAccountAddress]);

  const sponsorAndSendExecuteBatch = useCallback(async ({
    nonce,
    calls,
    initCode,
    callGasLimit,
    verificationGasLimit,
    preVerificationGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    ...rest
  }: {
    mode?: 'owner' | 'session';
    embeddedSessionId?: string;
    actionProfileKey?: string;
    nonce: bigint | number | string;
    calls: SmartAccountCall[];
    initCode?: Hex;
    callGasLimit: bigint | number | string;
    verificationGasLimit: bigint | number | string;
    preVerificationGas: bigint | number | string;
    maxFeePerGas: bigint | number | string;
    maxPriorityFeePerGas: bigint | number | string;
    paymasterValiditySec?: string;
    metadata?: Record<string, unknown>;
    waitForReceipt?: boolean;
  }) => {
    if (calls.length === 0) throw new Error('calls must not be empty');
    const sender = state.smartAccountAddress ?? (await ensureAccount()).smartAccountAddress;
    const userOp = createExecuteBatchUserOp({
      sender,
      nonce,
      calls,
      ...(initCode ? { initCode } : {}),
      callGasLimit,
      verificationGasLimit,
      preVerificationGas,
      maxFeePerGas,
      maxPriorityFeePerGas,
    });
    return sponsorAndSend({
      ...rest,
      userOp,
      target: calls[0].target,
      data: calls[0].data,
      value: calls[0].value ?? 0,
    });
  }, [ensureAccount, sponsorAndSend, state.smartAccountAddress]);

  const endSessionAction = useCallback(async () => {
    try {
      const emailSession = requireEmailSession();
      const current = state.serverSession;
      if (!current?.sessionId) throw new Error('No active embedded session');
      await client.endSession({ emailSession, embeddedSessionId: current.sessionId });
      setState((prev) => ({
        ...prev,
        status: 'ready',
        flowStep: prev.smartAccountAddress ? 'account_ready' : prev.flowStep,
        serverSession: null,
        error: null,
      }));
    } catch (error) {
      return applyError(error);
    }
  }, [applyError, client, requireEmailSession, state.serverSession]);

  const signOut = useCallback(() => {
    setState({
      status: 'idle',
      flowStep: 'signed_out',
      emailSession: null,
      deviceBindingId: null,
      passkeyCredentialId: null,
      highTrustToken: null,
      highTrustExpiresAt: null,
      descriptor: null,
      smartAccountAddress: null,
      serverSession: null,
      error: null,
    });
  }, []);

  const value = useMemo<PasskeyAccountState & PasskeyAccountActions>(() => ({
    ...state,
    sendOtp,
    verifyOtp,
    ensurePasskey,
    ensureHighTrust,
    ensureAccount,
    ensureSession,
    refreshAccount,
    authorizeOwnerUserOp: authorizeOwnerUserOpAction,
    sponsorUserOp: sponsorUserOpAction,
    sponsorAndSend,
    sponsorAndSendExecute,
    sponsorAndSendExecuteBatch,
    endSession: endSessionAction,
    signOut,
    raw: client,
  }), [
    authorizeOwnerUserOpAction,
    client,
    endSessionAction,
    ensureAccount,
    ensureHighTrust,
    ensurePasskey,
    ensureSession,
    refreshAccount,
    sendOtp,
    signOut,
    sponsorAndSend,
    sponsorAndSendExecute,
    sponsorAndSendExecuteBatch,
    sponsorUserOpAction,
    state,
    verifyOtp,
  ]);

  return <PasskeyAccountContext.Provider value={value}>{children}</PasskeyAccountContext.Provider>;
}
