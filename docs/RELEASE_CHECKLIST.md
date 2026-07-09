# @hazbase/react Release Checklist

## Versioning

- Patch: bug fix or documentation-only behavior clarification.
- Minor: new helper, hook, component, or additive response/type support.
- Major: breaking API, renamed exports, changed default backend contract, or removed behavior.

The x402 helper set, `X402Paywall`, and extension bridge are additive SDK surface,
so the next public release is `0.3.0`.

## Prepublish Checks

```bash
npm run test:x402
npm run build
npm pack --dry-run
```

Confirm that the package contains only:

- `dist`
- `README.md`
- `LICENSE`

## Public API Boundary

- Keep x402 helpers token-agnostic.
- Do not add app-specific exports, constants, contract addresses, token policy, or chain policy.
- Keep wallet extension allowlisting and side-panel UX outside `@hazbase/react`.
- Keep merchant pricing and payout decisions on merchant backend/API examples.

## Publish

```bash
npm publish --access public
```

Publish only after npm authentication is confirmed and the release commit is pushed.

## Suggested Release Notes

- Add generic hazBase x402 client helpers.
- Add x402 URL handoff and returned payment parsing.
- Add `HazbaseX402Provider`, x402 hooks, and `X402Paywall`.
- Add optional page-to-extension x402 bridge helpers.
