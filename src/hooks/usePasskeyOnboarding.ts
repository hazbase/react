import { useCallback } from 'react';
import { usePasskeyAccount } from './usePasskeyAccount';
import type { PasskeyAccountReadyResult } from '../types';

/**
 * Thin onboarding helper focused on the "OTP -> passkey -> account" path.
 *
 * This keeps first-party app screens small when they only need to bootstrap or
 * recover an account and do not care about the lower-level session/sponsor API.
 */
export function usePasskeyOnboarding() {
  const account = usePasskeyAccount();

  const completeOnboarding = useCallback(async (input: {
    email: string;
    code: string;
    purpose?: string;
    deviceId?: string;
    deviceLabel?: string;
    accountSalt?: string;
    chainId?: number;
    metadata?: Record<string, unknown>;
    forceBootstrap?: boolean;
  }): Promise<PasskeyAccountReadyResult> => {
    await account.verifyOtp({
      email: input.email,
      code: input.code,
      ...(input.purpose ? { purpose: input.purpose } : {}),
    });
    await account.ensurePasskey({
      ...(input.deviceId ? { deviceId: input.deviceId } : {}),
      ...(input.deviceLabel ? { deviceLabel: input.deviceLabel } : {}),
    });
    return account.ensureAccount({
      ...(input.accountSalt ? { accountSalt: input.accountSalt } : {}),
      ...(input.chainId != null ? { chainId: input.chainId } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      ...(input.forceBootstrap != null ? { forceBootstrap: input.forceBootstrap } : {}),
    });
  }, [account]);

  return {
    status: account.status,
    flowStep: account.flowStep,
    error: account.error,
    emailSession: account.emailSession,
    deviceBindingId: account.deviceBindingId,
    smartAccountAddress: account.smartAccountAddress,
    isEmailVerified: account.flowStep !== 'signed_out' && account.flowStep !== 'otp_requested',
    isPasskeyBound: Boolean(account.deviceBindingId),
    isAccountReady: Boolean(account.smartAccountAddress),
    sendOtp: account.sendOtp,
    verifyOtp: account.verifyOtp,
    ensurePasskey: account.ensurePasskey,
    ensureAccount: account.ensureAccount,
    completeOnboarding,
    signOut: account.signOut,
  };
}
