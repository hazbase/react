import { useContext } from 'react';
import { PasskeyAccountContext } from '../context/PasskeyAccountContext';

/**
 * Returns the high-level passkey account flow API.
 *
 * The main entry points are `sendOtp`, `verifyOtp`, `ensurePasskey`,
 * `ensureAccount`, `ensureSession`, `sponsorAndSend`, and the execute helpers.
 * Low-level backend calls remain available under `raw` for advanced integrations.
 */
export function usePasskeyAccount() {
  const ctx = useContext(PasskeyAccountContext);
  if (!ctx) throw new Error('PasskeyAccountProvider is missing');
  return ctx;
}
