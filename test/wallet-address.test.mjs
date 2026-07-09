import test from 'node:test';
import assert from 'node:assert/strict';

const moduleUrl = process.env.WALLET_ADDRESS_TEST_DIST
  ? new URL(process.env.WALLET_ADDRESS_TEST_DIST, `file://${process.cwd()}/`).href
  : new URL('../dist/index.js', import.meta.url).href;

const {
  WALLET_ADDRESS_REQUEST,
  WALLET_ADDRESS_RESPONSE,
  createWalletAddressUrl,
  normalizeWalletAddress,
  readWalletAddressFromUrl,
  requestWalletAddress,
  shortWalletAddress,
} = await import(moduleUrl);

class FakeWindow {
  constructor() {
    this.messages = [];
    this.listeners = new Set();
    this.location = {
      href: 'https://merchant.example/cards',
      assign: (url) => {
        this.location.href = url;
      },
    };
    this.opened = [];
  }

  addEventListener(type, listener) {
    if (type === 'message') this.listeners.add(listener);
  }

  removeEventListener(type, listener) {
    if (type === 'message') this.listeners.delete(listener);
  }

  postMessage(message, origin) {
    this.messages.push({ message, origin });
  }

  open(url, target, features) {
    this.opened.push({ url, target, features });
  }

  dispatchMessage(data, origin = 'https://merchant.example', source = this) {
    for (const listener of [...this.listeners]) {
      listener({ data, origin, source });
    }
  }
}

test('wallet address helpers normalize and shorten EVM addresses', () => {
  assert.equal(
    normalizeWalletAddress('  0xC3C464ED3782C77E6F90A6541D8ECC17F1B13C7C  '),
    '0xc3c464ed3782c77e6f90a6541d8ecc17f1b13c7c',
  );
  assert.equal(shortWalletAddress('0xc3c464ed3782c77e6f90a6541d8ecc17f1b13c7c'), '0xc3c4...3c7c');
  assert.equal(normalizeWalletAddress('not-an-address'), '');
});

test('wallet address PWA URL and return parsing support generic params', () => {
  const url = new URL(createWalletAddressUrl({
    walletUrl: 'https://wallet.example/pwa/',
    returnUrl: 'https://merchant.example/cards?view=collection',
  }));
  assert.equal(url.origin, 'https://wallet.example');
  assert.equal(url.searchParams.get('walletAddressReturnUrl'), 'https://merchant.example/cards?view=collection');

  assert.deepEqual(
    readWalletAddressFromUrl('https://merchant.example/#walletAddress=0xc3c464ed3782c77e6f90a6541d8ecc17f1b13c7c'),
    {
      address: '0xc3c464ed3782c77e6f90a6541d8ecc17f1b13c7c',
      param: 'walletAddress',
      source: 'hash',
    },
  );
  assert.deepEqual(
    readWalletAddressFromUrl('https://merchant.example/?hazbaseWalletAddress=0xc3c464ed3782c77e6f90a6541d8ecc17f1b13c7c'),
    {
      address: '0xc3c464ed3782c77e6f90a6541d8ecc17f1b13c7c',
      param: 'hazbaseWalletAddress',
      source: 'search',
    },
  );
});

test('requestWalletAddress resolves from generic bridge response', async () => {
  const fakeWindow = new FakeWindow();
  const promise = requestWalletAddress({
    targetWindow: fakeWindow,
    targetOrigin: 'https://merchant.example',
    allowedOrigins: ['https://merchant.example'],
    sourceWindow: fakeWindow,
    fallbackToPwa: false,
    timeoutMs: 1000,
    retryIntervalMs: 1000,
    purpose: 'card_holdings',
  });

  assert.equal(fakeWindow.messages.length, 1);
  const request = fakeWindow.messages[0].message;
  assert.equal(request.type, WALLET_ADDRESS_REQUEST);
  assert.equal(request.purpose, 'card_holdings');

  fakeWindow.dispatchMessage({
    type: WALLET_ADDRESS_RESPONSE,
    version: 1,
    id: request.id,
    ok: true,
    address: '0xC3C464ED3782C77E6F90A6541D8ECC17F1B13C7C',
  });

  assert.deepEqual(await promise, {
    ok: true,
    address: '0xc3c464ed3782c77e6f90a6541d8ecc17f1b13c7c',
    source: 'extension',
    message: {
      type: WALLET_ADDRESS_RESPONSE,
      version: 1,
      id: request.id,
      ok: true,
      address: '0xC3C464ED3782C77E6F90A6541D8ECC17F1B13C7C',
    },
  });
});

test('requestWalletAddress redirects to PWA after timeout when requested', async () => {
  const fakeWindow = new FakeWindow();
  const result = await requestWalletAddress({
    targetWindow: fakeWindow,
    targetOrigin: 'https://merchant.example',
    walletUrl: 'https://wallet.example/pwa/',
    returnUrl: 'https://merchant.example/cards',
    fallbackToPwa: true,
    timeoutMs: 10,
    retryIntervalMs: 1000,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'pwa_redirect');
  assert.equal(fakeWindow.location.href, 'https://wallet.example/pwa/?walletAddressReturnUrl=https%3A%2F%2Fmerchant.example%2Fcards');
});
