import assert from 'node:assert/strict';
import test from 'node:test';

test('the public package exports the authenticated wallet-link hook', async () => {
  const reactSdk = await import('../dist/index.js');
  assert.equal(typeof reactSdk.useWalletLink, 'function');
});

test('the declared Kit dependency provides the wallet-link primitives used by the hook', async () => {
  const kit = await import('@hazbase/kit/extension');
  assert.equal(typeof kit.requestWalletLink, 'function');
  assert.equal(typeof kit.createWalletLinkPwaUrl, 'function');
  assert.equal(typeof kit.consumeAndVerifyWalletLinkFromFragment, 'function');
  assert.equal(typeof kit.verifyWalletLinkSession, 'function');
});
