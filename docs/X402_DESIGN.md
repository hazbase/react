# x402 React Helpers Design

This document defines the generic x402 surface planned for `@hazbase/react`.
It must not depend on FUNAFC, Liquid, a specific chain, a specific token, or a
specific merchant domain.

## Goals

- Give web apps a small set of generic helpers for x402 paywalls.
- Keep payment requirement creation and settlement backend-contract based.
- Support both PWA wallet handoff and extension detection.
- Let apps configure networks, assets, token addresses, wallet URLs, and payout
  methods without adding token-specific SDK functions.
- Make the FUNAFC Wallet demo one application of these primitives, not a
  dependency of the SDK.

## Non-Goals

- No hard-coded `FUNAFC`, token address, Sepolia-only logic, or merchant domain
  allowlist in `@hazbase/react`.
- No frontend-only trust model for prices or payout addresses.
- No wallet-specific UI styling. The SDK should expose state and helpers; apps
  own the final UI.
- No replacement for backend settlement. Unlock decisions must still happen
  after a trusted backend verifies `X-PAYMENT`.

## Package Boundary

`@hazbase/react` should provide browser and React ergonomics:

- parse x402 payloads
- build PWA wallet handoff URLs
- read return fragments such as `#xPayment=...`
- call generic hazBase x402 endpoints when the app intentionally opts in
- expose hooks/components that orchestrate the above

The backend remains the source of truth for:

- price
- payout method
- resource identity
- allowed networks/assets
- settlement result
- access grant persistence

## Core Types

```ts
export type X402Network = string;
export type X402Asset = string;
export type X402CompletionMode = "fragment" | "none";

export interface HazbaseX402ClientConfig {
  apiEndpoint?: string;
  fetch?: typeof globalThis.fetch;
  requestId?: () => string;
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
```

## Non-React Client

The non-React layer should be framework-agnostic and testable.

```ts
export function createHazbaseX402Client(config?: HazbaseX402ClientConfig) {
  return {
    createRequirement(input: CreateX402RequirementInput): Promise<X402RequirementResult>;
    settlePayment(input: SettleX402PaymentInput): Promise<X402SettlementResult>;
    createWalletUrl(input: X402WalletHandoffInput): string;
    readPaymentFromUrl(input?: string | URL): { xPayment: string; param: string } | null;
    parsePayload(input: string): Record<string, unknown> | null;
  };
}
```

Notes:

- `createRequirement()` calls `POST /api/payments/x402/requirements`.
- `settlePayment()` calls `POST /api/payments/x402/settle`.
- `createWalletUrl()` should base64url encode the x402 payload and append
  `sourceUrl`, optional `title`, and optional completion mode.
- `readPaymentFromUrl()` should support both a generic `xPayment` parameter and
  app-specific aliases configured by the caller.
- `parsePayload()` should support raw JSON and
  `<script type="application/x-x402+json">...</script>`.

## React Provider

```tsx
export interface HazbaseX402ProviderProps {
  client?: HazbaseX402Client;
  apiEndpoint?: string;
  walletUrl?: string;
  children: React.ReactNode;
}

export function HazbaseX402Provider(props: HazbaseX402ProviderProps): JSX.Element;
```

The provider should only hold config and client instances. It should not store
merchant-specific payment state globally unless a hook opts in.

## React Hooks

### `useX402Client()`

Returns the configured client.

```ts
const client = useX402Client();
```

### `useX402Requirement()`

This hook is useful for demo pages and static price flows. For production
merchant pages, prefer calling the merchant backend and passing the returned
requirement to the UI.

```ts
const requirement = useX402Requirement(input, {
  enabled: Boolean(input),
  refetchOnWindowFocus: false,
});
```

Return shape:

```ts
{
  data: X402RequirementResult | null;
  status: "idle" | "loading" | "ready" | "error";
  error: Error | null;
  refresh(): Promise<X402RequirementResult>;
}
```

### `useX402WalletHandoff()`

Builds a wallet URL from an x402 payload.

```ts
const { walletUrl, openWallet } = useX402WalletHandoff({
  x402,
  sourceUrl: window.location.href,
  title: document.title,
  completion: "fragment",
});
```

### `useX402Settlement()`

Handles the return flow after a wallet completes payment.

```ts
const settlement = useX402Settlement({
  paymentRequestId,
  autoReadUrl: true,
  completionParam: "xPayment",
  onSettled(result) {
    // App unlocks or asks its backend for an access grant.
  },
});
```

Return shape:

```ts
{
  xPayment: string | null;
  result: X402SettlementResult | null;
  status: "idle" | "settling" | "settled" | "error";
  error: Error | null;
  settle(xPayment: string): Promise<X402SettlementResult>;
  clearReturnParam(): void;
}
```

### `useX402AccessGrant()`

Optional helper for simple browser-side grants.

```ts
const grant = useX402AccessGrant({
  resourceUrl,
  ttlMs: 24 * 60 * 60 * 1000,
  storageKeyPrefix: "my-app.x402.grant.v1",
});
```

This should remain explicitly opt-in. Production apps should usually store
access grants server-side.

## Render-Prop Component

`X402Paywall` should be a convenience wrapper around the hooks, not a mandatory
UI system.

```tsx
<X402Paywall
  requirement={requirement}
  walletUrl="https://wallet.example/pwa/"
  sourceUrl={window.location.href}
  onSettled={saveAccessGrant}
>
  {({ status, openWallet, settle, error }) => (
    <button disabled={status === "settling"} onClick={openWallet}>
      Pay
    </button>
  )}
</X402Paywall>
```

## Extension Bridge

The first generic extension bridge should be page-to-extension friendly, but it
must not assume every merchant domain is allowlisted.

Recommended staged approach:

1. SDK embeds a standards-compatible x402 script tag.
2. Extension content scripts detect that tag on allowlisted domains.
3. Later, define a `window.postMessage` bridge for explicit merchant opt-in.

Initial helper:

```ts
export function serializeX402ScriptTag(x402: Record<string, unknown>): string;
```

React helper:

```tsx
<X402RequirementScript x402={requirement.x402} />
```

The component should only render the script tag. Opening side panels remains an
extension concern.

## Security Notes

- Apps should create requirements from their backend when price or payout is
  sensitive.
- Apps should settle `X-PAYMENT` on the backend before unlocking content.
- Browser-side access grants are acceptable for demos and low-risk content only.
- Do not log full `X-PAYMENT` values by default.
- Do not add token-specific functions such as `getFunafcBalance()` to the SDK.
- Generic APIs should accept `chainId`, `network`, `asset`, `assetAddress`,
  `priceAtomic`, `payoutMethod`, `resourceUrl`, and `metadata`.

## Implementation Phases

### Phase 1: Pure Helpers

Status: implemented.

- Add `src/x402/client.ts`
- Add `src/x402/url.ts`
- Add `src/x402/payload.ts`
- Export types and helper functions from `src/index.ts`
- Add unit tests for URL encoding, fragment parsing, and payload parsing

### Phase 2: React Hooks

Status: implemented.

- Add `HazbaseX402Provider`
- Add `useX402Client`
- Add `useX402Requirement`
- Add `useX402WalletHandoff`
- Add `useX402Settlement`
- Add README examples

### Phase 3: Paywall Convenience

Status: implemented.

- Add `X402Paywall`
- Add `X402RequirementScript`
- Add a minimal example app or docs page

### Phase 4: Extension Bridge

Status: implemented.

- Define a generic page bridge contract
- Keep domain allowlisting and side-panel behavior in wallet extensions
- Document how merchant pages opt in

## Example Usage

```tsx
function ArticlePaywall({ requirement }) {
  const { walletUrl, openWallet } = useX402WalletHandoff({
    x402: requirement.x402,
    walletUrl: "https://wallet.example/pwa/",
    sourceUrl: window.location.href,
    title: document.title,
    completion: "fragment",
  });

  const settlement = useX402Settlement({
    paymentRequestId: requirement.paymentRequestId,
    autoReadUrl: true,
    completionParam: "xPayment",
  });

  if (settlement.status === "settled") return <ArticleContent />;

  return (
    <section>
      <X402RequirementScript x402={requirement.x402} />
      <a href={walletUrl} onClick={(event) => openWallet(event)}>
        Pay to unlock
      </a>
      {settlement.error ? <p>{settlement.error.message}</p> : null}
    </section>
  );
}
```
