# x402 Extension Bridge Design

This document defines a generic page-to-extension bridge for x402 merchant
pages. It is intentionally token-agnostic and wallet-extension agnostic.

## Goals

- Let merchant pages expose x402 payment requirements in a predictable way.
- Let wallet extensions detect requirements and open their own approval UI.
- Avoid hard-coding FUNAFC, Liquid, Sepolia, or a single merchant domain.
- Keep side-panel opening, permission prompts, and signing inside the extension.
- Keep settlement and access grants inside the merchant backend.

## Responsibilities

### Merchant Page

- Creates x402 requirements from its backend or Edge Function.
- Embeds the x402 payload with a standards-compatible script tag.
- Optionally announces the requirement with `window.postMessage`.
- Receives `X-PAYMENT` only through an explicit completion flow.
- Settles `X-PAYMENT` on its backend before unlocking content.

### `@hazbase/react`

- Provides helper functions/components to render x402 payloads.
- Provides a small, typed postMessage bridge helper.
- Does not open extension side panels directly.
- Does not assume a specific wallet extension ID.
- Does not store long-lived grants by default.

### Wallet Extension

- Owns host permissions and domain allowlisting.
- Detects x402 payloads from script tags or postMessage.
- Opens its side panel / popup when user gesture or extension policy allows it.
- Performs wallet-specific auth, signing, and payment.
- Returns a payment result through the agreed completion channel.

## Phase 1: Script Tag Detection

Merchant pages should render:

```html
<script type="application/x-x402+json">
  {"paymentRequestId":"...","accepts":[...]}
</script>
```

`@hazbase/react` already exposes:

```ts
serializeX402ScriptTag(x402)
```

Recommended React convenience component:

```tsx
<X402RequirementScript x402={requirement.x402} />
```

The component should render only the script tag. It should not communicate with
extensions by itself.

## Phase 2: Explicit postMessage Bridge

Script tags are passive. For richer UX, merchant pages can explicitly announce a
request:

```ts
window.postMessage({
  type: "hazbase:x402:request",
  version: 1,
  id: "msg_...",
  sourceUrl: window.location.href,
  title: document.title,
  x402: requirement.x402,
  completion: {
    mode: "fragment",
    param: "xPayment"
  }
}, window.location.origin);
```

The extension can reply:

```ts
window.postMessage({
  type: "hazbase:x402:detected",
  version: 1,
  id: "msg_...",
  wallet: {
    name: "Example Wallet",
    extensionId: "optional"
  },
  capabilities: {
    sidePanel: true,
    pwaHandoff: true
  }
}, window.location.origin);
```

After payment, a completion message can be sent only if both page and extension
opt in:

```ts
window.postMessage({
  type: "hazbase:x402:payment",
  version: 1,
  id: "msg_...",
  paymentRequestId: "pay_req_...",
  xPayment: "..."
}, window.location.origin);
```

For sensitive pages, prefer fragment return or backend-mediated completion over
posting `xPayment` to the page.

## Message Types

### `hazbase:x402:request`

Fields:

- `version`: `1`
- `id`: unique message id
- `sourceUrl`: canonical resource URL
- `title`: optional page title
- `x402`: x402 payload
- `completion`: optional completion preferences

### `hazbase:x402:detected`

Fields:

- `version`: `1`
- `id`: request message id when known
- `wallet.name`
- `wallet.extensionId`
- `capabilities.sidePanel`
- `capabilities.pwaHandoff`

### `hazbase:x402:payment`

Fields:

- `version`: `1`
- `id`: request message id when known
- `paymentRequestId`
- `xPayment`

This message should be optional. Extensions may decline to send raw
`X-PAYMENT` through `postMessage` and use URL fragment completion instead.

### `hazbase:x402:error`

Fields:

- `version`: `1`
- `id`: request message id when known
- `code`
- `message`

## Security Rules

- Merchant pages must validate `event.origin` and `event.source`.
- Extensions must only trust pages allowed by extension host permissions or
  explicit user action.
- Extensions should not auto-pay from a passive script tag.
- `X-PAYMENT` should not be broadcast unless both page and extension opt in.
- Merchant pages must settle on the backend before unlock.
- The bridge should never include private keys, passkey assertions, high-trust
  tokens, or wallet sessions.

## Permission Model

Recommended stages:

1. Demo allowlist: extension content script runs on known demo domains.
2. Merchant allowlist: extension release includes approved merchant domains.
3. Explicit user activation: user clicks the extension on any HTTPS page, then
   extension inspects the active tab.
4. Optional SDK bridge: page announces requests, extension responds when allowed.

For public third-party adoption, stages 3 and 4 are more scalable than adding
every merchant to static host permissions.

## `@hazbase/react` Implementation Plan

Status: implemented in `@hazbase/react` as generic helpers and an optional React
hook. Wallet extensions still keep their own domain policy and side-panel UX.

### Bridge Types

```ts
type X402BridgeMessage =
  | X402BridgeRequestMessage
  | X402BridgeDetectedMessage
  | X402BridgePaymentMessage
  | X402BridgeErrorMessage;
```

### Pure Helpers

```ts
createX402BridgeRequest(input): X402BridgeRequestMessage;
isX402BridgeMessage(value): value is X402BridgeMessage;
postX402BridgeRequest(input): string;
listenForX402BridgeMessages(handler, options): () => void;
```

### React Hooks

```ts
useX402ExtensionBridge({
  x402,
  sourceUrl,
  title,
  enabled,
  allowedOrigins,
  onDetected,
  onPayment,
  onError,
});
```

The hook should be optional. A merchant can use only script tags and PWA handoff
without opting into postMessage.

## Open Questions

- Should raw `X-PAYMENT` ever be sent through postMessage by default, or should
  URL fragment completion remain the default?
- Should extensions identify themselves with a stable wallet id, or keep only a
  display name?
- How should multiple wallet extensions on the same page coordinate?
- Should an EIP-style provider discovery event be used later?

## FUNAFC Wallet Implication

FUNAFC Wallet can continue using a demo-domain allowlist for the MVP while
also consuming the generic bridge messages on allowed HTTPS pages. FUNAFC
token policy should stay in the wallet app and merchant configuration, not in
`@hazbase/react`.
