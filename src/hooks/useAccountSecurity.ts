import { useCallback, useMemo, useState } from 'react';
import type {
  EmbeddedSessionInventory,
  PasskeyAssertionPurpose,
  PasskeyDeviceInventory,
  RevokeEmbeddedSessionResult,
  RevokePasskeyDeviceResult,
} from '../types';
import { usePasskeyAccount } from './usePasskeyAccount';

export interface AccountSecurityState {
  devices: PasskeyDeviceInventory['devices'];
  sessions: EmbeddedSessionInventory['sessions'];
  loadingDevices: boolean;
  loadingSessions: boolean;
  revokingDeviceId: string | null;
  revokingSessionId: string | null;
  reauthInFlight: boolean;
  error: string | null;
}

export interface AccountSecurityActions {
  refreshDevices(): Promise<PasskeyDeviceInventory>;
  refreshSessions(): Promise<EmbeddedSessionInventory>;
  refreshAll(): Promise<{ devices: PasskeyDeviceInventory; sessions: EmbeddedSessionInventory }>;
  revokeDevice(input: { deviceBindingId: string; purpose?: PasskeyAssertionPurpose }): Promise<RevokePasskeyDeviceResult>;
  revokeSession(input: { embeddedSessionId: string; purpose?: PasskeyAssertionPurpose }): Promise<RevokeEmbeddedSessionResult>;
}

/**
 * Wraps the backend-first account security APIs with a small React state layer.
 *
 * This hook intentionally stays focused on inventory + revoke operations so
 * product teams can build security settings screens without wiring raw client
 * calls, step-up state, or refresh flows by hand.
 */
export function useAccountSecurity(): AccountSecurityState & AccountSecurityActions {
  const account = usePasskeyAccount();
  const [devices, setDevices] = useState<PasskeyDeviceInventory['devices']>([]);
  const [sessions, setSessions] = useState<EmbeddedSessionInventory['sessions']>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [reauthInFlight, setReauthInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      setError(null);
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Account security request failed';
      setError(message);
      throw err;
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    setLoadingDevices(true);
    try {
      return await run(async () => {
        const inventory = await account.raw.listPasskeyDevices({
          emailSession: account.emailSession ?? (() => { throw new Error('Email session is required'); })(),
        });
        setDevices(inventory.devices ?? []);
        return inventory;
      });
    } finally {
      setLoadingDevices(false);
    }
  }, [account.emailSession, account.raw, run]);

  const refreshSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      return await run(async () => {
        const inventory = await account.raw.listEmbeddedSessions({
          emailSession: account.emailSession ?? (() => { throw new Error('Email session is required'); })(),
        });
        setSessions(inventory.sessions ?? []);
        return inventory;
      });
    } finally {
      setLoadingSessions(false);
    }
  }, [account.emailSession, account.raw, run]);

  const refreshAll = useCallback(async () => {
    const [deviceInventory, sessionInventory] = await Promise.all([
      refreshDevices(),
      refreshSessions(),
    ]);
    return { devices: deviceInventory, sessions: sessionInventory };
  }, [refreshDevices, refreshSessions]);

  const ensureReauthToken = useCallback(async (purpose: PasskeyAssertionPurpose = 'reauth') => {
    setReauthInFlight(true);
    try {
      const result = await account.ensureHighTrust({ purpose, force: true });
      if (!result.highTrustToken) throw new Error('High-trust token missing from passkey assertion result');
      return result.highTrustToken;
    } finally {
      setReauthInFlight(false);
    }
  }, [account]);

  const revokeDevice = useCallback(async (input: { deviceBindingId: string; purpose?: PasskeyAssertionPurpose }) => {
    setRevokingDeviceId(input.deviceBindingId);
    try {
      return await run(async () => {
        const highTrustToken = await ensureReauthToken(input.purpose ?? 'reauth');
        const result = await account.raw.revokePasskeyDevice({
          emailSession: account.emailSession ?? (() => { throw new Error('Email session is required'); })(),
          deviceBindingId: input.deviceBindingId,
          highTrustToken,
        });
        await refreshAll();
        return result;
      });
    } finally {
      setRevokingDeviceId(null);
    }
  }, [account.emailSession, account.raw, ensureReauthToken, refreshAll, run]);

  const revokeSession = useCallback(async (input: { embeddedSessionId: string; purpose?: PasskeyAssertionPurpose }) => {
    setRevokingSessionId(input.embeddedSessionId);
    try {
      return await run(async () => {
        const highTrustToken = await ensureReauthToken(input.purpose ?? 'reauth');
        const result = await account.raw.revokeEmbeddedSession({
          emailSession: account.emailSession ?? (() => { throw new Error('Email session is required'); })(),
          embeddedSessionId: input.embeddedSessionId,
          highTrustToken,
        });
        await refreshAll();
        return result;
      });
    } finally {
      setRevokingSessionId(null);
    }
  }, [account.emailSession, account.raw, ensureReauthToken, refreshAll, run]);

  return useMemo(() => ({
    devices,
    sessions,
    loadingDevices,
    loadingSessions,
    revokingDeviceId,
    revokingSessionId,
    reauthInFlight,
    error,
    refreshDevices,
    refreshSessions,
    refreshAll,
    revokeDevice,
    revokeSession,
  }), [
    devices,
    sessions,
    loadingDevices,
    loadingSessions,
    revokingDeviceId,
    revokingSessionId,
    reauthInFlight,
    error,
    refreshDevices,
    refreshSessions,
    refreshAll,
    revokeDevice,
    revokeSession,
  ]);
}
