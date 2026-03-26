# @hazbase/react
[![npm version](https://badge.fury.io/js/@hazbase%2Freact.svg)](https://badge.fury.io/js/@hazbase%2Freact)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Overview
`@hazbase/react` is a React toolkit for two frontend patterns:

- standard injected wallet apps with `WalletProvider`
- passkey-native hazBase smart-wallet apps with `PasskeyAccountProvider`

The passkey flow is intentionally flow-oriented. Instead of wiring every backend step yourself, you create one client and then use helpers like `ensurePasskey()`, `ensureAccount()`, `ensureSession()`, `sponsorAndSend()`, and `sponsorAndSendExecute()`.

## Requirements
- Node.js >= 18
- React >= 18
- Ethers v6
- A hazBase-compatible backend for the passkey flow
- WebAuthn support in the browser when you use passkeys

## Installation
```bash
pnpm add @hazbase/react @hazbase/auth @hazbase/kit ethers react
# or
npm i @hazbase/react @hazbase/auth @hazbase/kit ethers react
```

## Usage patterns
`@hazbase/react` supports two main frontend patterns:

- `WalletProvider`: MetaMask / injected wallet apps
- `PasskeyAccountProvider`: email OTP + passkey + account bootstrap + sponsored action apps

Use `WalletProvider` when your app should behave like a normal wallet-connected dApp. Use `PasskeyAccountProvider` when your app should guide users through a hazBase-managed smart-wallet flow.

## Quick start: WalletProvider (MetaMask / injected wallet)

```tsx
import {
  WalletProvider,
  useAddress,
  useNetwork,
  useSigner,
} from '@hazbase/react';

function WalletPanel() {
  const { signer, connectMetaMask, disconnect } = useSigner();
  const { address, isConnected } = useAddress();
  const network = useNetwork();

  return (
    <div>
      <button onClick={() => connectMetaMask()}>Connect MetaMask</button>
      <button onClick={() => disconnect()}>Disconnect</button>
      <pre>
        {JSON.stringify(
          {
            isConnected,
            address,
            chainId: network.chainId,
            hasSigner: Boolean(signer),
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}

export function App() {
  return (
    <WalletProvider autoConnect>
      <WalletPanel />
    </WalletProvider>
  );
}
```

## Quick start: PasskeyAccountProvider

```tsx
import {
  PasskeyAccountProvider,
  createHazbasePasskeyClient,
  usePasskeyAccount,
} from '@hazbase/react';

const client = createHazbasePasskeyClient();

function PasskeyPanel() {
  const {
    sendOtp,
    verifyOtp,
    ensurePasskey,
    ensureSession,
    ensureAccount,
    sponsorAndSendExecute,
  } = usePasskeyAccount();

  async function runFlow() {
    await sendOtp({ email: 'demo@example.com' });
    await verifyOtp({ email: 'demo@example.com', code: '123456' });
    await ensurePasskey({ deviceLabel: 'Chrome on MacBook' });
    const account = await ensureAccount({ chainId: 11155111, accountSalt: 'user-owned-account' });
    await ensureSession({ actionProfileKey: 'first_party_l2' });

    const sent = await sponsorAndSendExecute({
      mode: 'session',
      nonce: '0',
      target: '0x1111111111111111111111111111111111111111',
      data: '0x12345678',
      value: '0',
      callGasLimit: '150000',
      verificationGasLimit: '120000',
      preVerificationGas: '50000',
      maxFeePerGas: '1000000000',
      maxPriorityFeePerGas: '100000000',
    });

    console.log(account.smartAccountAddress, sent.userOpHash, sent.transactionHash);
  }

  return <button onClick={runFlow}>Run passkey account flow</button>;
}

export function App() {
  return (
    <PasskeyAccountProvider
      client={client}
      defaultChainId={11155111}
      defaultAccountSalt="user-owned-account"
      defaultActionProfileKey="first_party_l2"
    >
      <PasskeyPanel />
    </PasskeyAccountProvider>
  );
}
```

## Quick start: usePasskeyOnboarding

```tsx
import {
  PasskeyAccountProvider,
  createHazbasePasskeyClient,
  usePasskeyOnboarding,
} from '@hazbase/react';

const client = createHazbasePasskeyClient();

function OnboardingPanel() {
  const { sendOtp, completeOnboarding, isAccountReady, smartAccountAddress } = usePasskeyOnboarding();

  async function onboard() {
    await sendOtp({ email: 'demo@example.com' });
    await completeOnboarding({
      email: 'demo@example.com',
      code: '123456',
      deviceLabel: 'Chrome on MacBook',
      chainId: 11155111,
      accountSalt: 'user-owned-account',
    });
  }

  return (
    <div>
      <button onClick={onboard}>Bootstrap account</button>
      {isAccountReady ? <pre>{smartAccountAddress}</pre> : null}
    </div>
  );
}

export function App() {
  return (
    <PasskeyAccountProvider client={client} defaultChainId={11155111}>
      <OnboardingPanel />
    </PasskeyAccountProvider>
  );
}
```

## Common operations

### Standard wallet hooks
- `useSigner()`
- `useAddress()`
- `useNetwork()`

### Passkey flow hooks
The main passkey hook is `usePasskeyAccount()`.

High-level helpers:
- `sendOtp()`
- `verifyOtp()`
- `ensurePasskey()`
- `ensureHighTrust()`
- `ensureAccount()`
- `ensureSession()`
- `sponsorUserOp()`
- `sponsorAndSend()`
- `sponsorAndSendExecute()`
- `sponsorAndSendExecuteBatch()`
- `authorizeOwnerUserOp()`
- `refreshAccount()`
- `endSession()`
- `signOut()`

Onboarding-focused helper:
- `usePasskeyOnboarding()`

Account security helper:
- `useAccountSecurity()`

Execute helpers:
- `encodeSmartAccountExecute()`
- `encodeSmartAccountExecuteBatch()`
- `createExecuteUserOp()`
- `createExecuteBatchUserOp()`

Advanced escape hatch:
- `raw`: access to the low-level client for custom integrations

## Main exports
- `WalletProvider`
- `PasskeyAccountProvider`
- `createHazbasePasskeyClient`
- `useSigner`
- `useAddress`
- `useNetwork`
- `usePasskeyAccount`
- `usePasskeyOnboarding`
- `useAccountSecurity`
- `encodeSmartAccountExecute`
- `encodeSmartAccountExecuteBatch`
- `createExecuteUserOp`
- `createExecuteBatchUserOp`

## Notes
- `PasskeyAccountProvider` assumes a first-party or allowlisted partner backend.
- `@hazbase/react` stays backend-contract based: apps integrate against a backend URL, and the React surface does not depend on any specific infrastructure provider.
- The same React integration should work with any hazBase-compatible backend as long as the backend API contract is preserved.
- `sendOtp()` and `verifyOtp()` manage the application session, not wallet ownership by themselves.
- `ensureAccount()` will reuse an existing bound smart account when possible and bootstrap only when needed.
- New embedded sessions always require a fresh `purpose=session` passkey step-up. Existing active sessions are reused until revoked or expired.
- Session mode is sponsor-required. The backend returns the final `accountSignature` for the sponsored payload, and the React layer forwards it to the bundler.
- Embedded sessions use a snapshot of the action profile taken at issuance time. Later profile broadening does not widen already-issued sessions.
- Profile deactivation still acts as a kill switch for active sessions.
- `raw` is useful when you want to override one step without giving up the higher-level flow state.
- `useAccountSecurity()` wraps device/session inventory plus reauth-gated revoke flows for first-party security settings screens.

## Troubleshooting (FAQ)

### MetaMask is not found
Make sure the browser has an injected wallet and that your app is running in a context where `window.ethereum` is available.

### `ensureSession()` says that `actionProfileKey` is required
Pass an `actionProfileKey` directly, or set `defaultActionProfileKey` on `PasskeyAccountProvider`.

### How do I build a device/session security screen?
Use `useAccountSecurity()` to list active devices and embedded sessions, then call `revokeDevice()` or `revokeSession()` when the user confirms a revoke. The hook triggers a fresh passkey reauth before destructive operations.

### Why does passkey setup still need OTP?
The intended model is:
- OTP starts the app session
- passkey binds the device and handles step-up authentication
- account bootstrap and sponsorship happen only after those steps succeed

### Why does a new embedded session always ask for passkey step-up?
Session issuance is treated as a privileged action. A fresh `purpose=session` high-trust token is required whenever the provider needs to mint a new embedded session.

### When should I use `sponsorAndSendExecute()` instead of `sponsorAndSend()`?
Use `sponsorAndSendExecute()` when you want the React layer to build `SmartAccount.execute(...)` callData for you. Use `sponsorAndSend()` when you already have a full userOp draft.

### Low-level account security methods
`PasskeyAccountProvider` does not add first-class settings UI in this phase, but the underlying client exposed as `raw` includes backend-first account security methods:

- `raw.listPasskeyDevices()`
- `raw.revokePasskeyDevice()`
- `raw.listEmbeddedSessions()`
- `raw.revokeEmbeddedSession()`

Listing uses app-session auth. Revoke calls require a fresh `purpose=reauth` passkey step-up token. Device revoke cascades to active embedded sessions on that device.
