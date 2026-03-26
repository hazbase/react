import {
  authorizeOwnerUserOp,
  bootstrapPasskeyAccount,
  completePasskeyAssertion,
  completePasskeyRegistration,
  endEmbeddedSession,
  listEmbeddedSessions,
  listPasskeyDevices,
  lookupPasskeyAccount,
  requestEmailOtp,
  requestPasskeyAccountDescriptor,
  requestPasskeyAssertionChallenge,
  requestPasskeyRegistrationChallenge,
  revokeEmbeddedSession,
  revokePasskeyDevice,
  sponsorUserOp,
  startEmbeddedSession,
  verifyEmailOtp,
} from '@hazbase/auth';
import { createPasskeyAssertionCredential, createPasskeyRegistrationCredential } from '../passkey/browserPasskey';
import type {
  EmailOtpSession,
  EmbeddedSessionGrant,
  EmbeddedSessionInventory,
  HazbasePasskeyClient,
  OwnerUserOpAuthorization,
  PasskeyAccountBootstrapResult,
  PasskeyAccountDescriptor,
  PasskeyAssertionPurpose,
  PasskeyAssertionResult,
  PasskeyDeviceInventory,
  PasskeyRegistrationChallengeResult,
  PasskeyRegistrationResult,
  RevokeEmbeddedSessionResult,
  RevokePasskeyDeviceResult,
  SponsorUserOpResult,
} from '../types';

export interface HazbasePasskeyClientOptions {
  defaultOtpPurpose?: string;
}

/**
 * Creates a default passkey client by composing `@hazbase/auth` backend calls
 * with the browser WebAuthn credential helpers bundled in `@hazbase/react`.
 */
export function createHazbasePasskeyClient(
  options: HazbasePasskeyClientOptions = {},
): HazbasePasskeyClient {
  const defaultOtpPurpose = options.defaultOtpPurpose ?? 'smart_wallet_sign_in';

  return {
    sendOtp: async ({ email, purpose }) => requestEmailOtp({ email, purpose: purpose ?? defaultOtpPurpose }),
    verifyOtp: async ({ email, code, purpose }) => {
      const result = await verifyEmailOtp({ email, code, purpose: purpose ?? defaultOtpPurpose });
      return { ...result } as EmailOtpSession;
    },
    registerPasskey: async ({ emailSession, deviceId, deviceLabel }) => {
      const challenge = await requestPasskeyRegistrationChallenge({
        emailSession: emailSession.accessToken,
        ...(deviceId ? { deviceId } : {}),
        ...(deviceLabel ? { deviceLabel } : {}),
      });
      const credential = await createPasskeyRegistrationCredential({ ...challenge } as PasskeyRegistrationChallengeResult);
      const result = await completePasskeyRegistration({
        emailSession: emailSession.accessToken,
        challengeId: challenge.challengeId,
        credential,
        ...(deviceId ? { deviceId } : {}),
        ...(deviceLabel ? { deviceLabel } : {}),
      });
      return { ...result } as PasskeyRegistrationResult;
    },
    assertPasskey: async ({ emailSession, purpose, deviceBindingId }) => {
      const resolvedPurpose: PasskeyAssertionPurpose = purpose ?? 'reauth';
      const challenge = await requestPasskeyAssertionChallenge({
        emailSession: emailSession.accessToken,
        purpose: resolvedPurpose,
        ...(deviceBindingId ? { deviceBindingId } : {}),
      });
      const credential = await createPasskeyAssertionCredential({ ...challenge } as any);
      const result = await completePasskeyAssertion({
        emailSession: emailSession.accessToken,
        challengeId: challenge.challengeId,
        credential,
        purpose: resolvedPurpose,
        ...(challenge.deviceBindingId ?? deviceBindingId ? { deviceBindingId: challenge.deviceBindingId ?? deviceBindingId } : {}),
      });
      return { ...result } as PasskeyAssertionResult;
    },
    getAccountDescriptor: async ({ emailSession, deviceBindingId, accountSalt, chainId }) => {
      const result = await requestPasskeyAccountDescriptor({
        emailSession: emailSession.accessToken,
        deviceBindingId,
        ...(accountSalt ? { accountSalt } : {}),
        ...(chainId != null ? { chainId } : {}),
      });
      return { ...result } as PasskeyAccountDescriptor;
    },
    bootstrapAccount: async ({ emailSession, deviceBindingId, highTrustToken, accountSalt, chainId, metadata }) => {
      const result = await bootstrapPasskeyAccount({
        emailSession: emailSession.accessToken,
        deviceBindingId,
        highTrustToken,
        ...(accountSalt ? { accountSalt } : {}),
        ...(chainId != null ? { chainId } : {}),
        ...(metadata ? { metadata } : {}),
      });
      return { ...result } as PasskeyAccountBootstrapResult;
    },
    lookupAccount: async ({ emailSession, deviceBindingId, smartAccountAddress }) =>
      lookupPasskeyAccount({
        emailSession: emailSession.accessToken,
        ...(deviceBindingId ? { deviceBindingId } : {}),
        ...(smartAccountAddress ? { smartAccountAddress } : {}),
      }),
    authorizeOwnerUserOp: async ({ emailSession, deviceBindingId, highTrustToken, smartAccountAddress, userOpHash, validForSec }) => {
      const result = await authorizeOwnerUserOp({
        emailSession: emailSession.accessToken,
        deviceBindingId,
        highTrustToken,
        smartAccountAddress,
        userOpHash,
        ...(validForSec != null ? { validForSec } : {}),
      });
      return { ...result } as OwnerUserOpAuthorization;
    },
    startSession: async ({ emailSession, deviceBindingId, smartAccountAddress, actionProfileKey, highTrustToken, sessionKeyAddress, metadata }) => {
      const result = await startEmbeddedSession({
        emailSession: emailSession.accessToken,
        deviceBindingId,
        smartAccountAddress,
        actionProfileKey,
        highTrustToken,
        ...(sessionKeyAddress ? { sessionKeyAddress } : {}),
        ...(metadata ? { metadata } : {}),
      });
      return { ...result } as EmbeddedSessionGrant;
    },
    endSession: async ({ emailSession, embeddedSessionId }) => {
      await endEmbeddedSession({ emailSession: emailSession.accessToken, embeddedSessionId });
    },
    listPasskeyDevices: async ({ emailSession }) => {
      const result = await listPasskeyDevices({ emailSession: emailSession.accessToken });
      return { ...result } as PasskeyDeviceInventory;
    },
    revokePasskeyDevice: async ({ emailSession, deviceBindingId, highTrustToken }) => {
      const result = await revokePasskeyDevice({
        emailSession: emailSession.accessToken,
        deviceBindingId,
        highTrustToken,
      });
      return { ...result } as RevokePasskeyDeviceResult;
    },
    listEmbeddedSessions: async ({ emailSession }) => {
      const result = await listEmbeddedSessions({ emailSession: emailSession.accessToken });
      return { ...result } as EmbeddedSessionInventory;
    },
    revokeEmbeddedSession: async ({ emailSession, embeddedSessionId, highTrustToken }) => {
      const result = await revokeEmbeddedSession({
        emailSession: emailSession.accessToken,
        embeddedSessionId,
        highTrustToken,
      });
      return { ...result } as RevokeEmbeddedSessionResult;
    },
    sponsorUserOp: async ({ emailSession, embeddedSessionId, userOp, target, data, value, paymasterValiditySec, signingMode, metadata }) => {
      const result = await sponsorUserOp({
        emailSession: emailSession.accessToken,
        embeddedSessionId,
        sender: userOp.sender,
        nonce: String(userOp.nonce),
        ...(userOp.initCode ? { initCode: userOp.initCode } : {}),
        callData: userOp.callData,
        callGasLimit: String(userOp.callGasLimit),
        verificationGasLimit: String(userOp.verificationGasLimit),
        ...(userOp.preVerificationGas != null ? { preVerificationGas: String(userOp.preVerificationGas) } : {}),
        ...(userOp.maxFeePerGas != null ? { maxFeePerGas: String(userOp.maxFeePerGas) } : {}),
        ...(userOp.maxPriorityFeePerGas != null ? { maxPriorityFeePerGas: String(userOp.maxPriorityFeePerGas) } : {}),
        target,
        data,
        ...(value != null ? { value: String(value) } : {}),
        ...(paymasterValiditySec != null ? { paymasterValiditySec } : {}),
        ...(signingMode ? { signingMode } : {}),
        ...(metadata ? { metadata } : {}),
      });
      return { ...result } as SponsorUserOpResult;
    },
  };
}
