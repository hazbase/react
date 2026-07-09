import test from 'node:test';
import assert from 'node:assert/strict';

const moduleUrl = process.env.X402_TEST_DIST
  ? new URL(process.env.X402_TEST_DIST, `file://${process.cwd()}/`).href
  : new URL('../dist/index.js', import.meta.url).href;

const {
  base64UrlDecode,
  base64UrlEncode,
  createHazbaseX402Client,
  createX402BridgeRequest,
  createX402WalletUrl,
  isX402BridgeDetectedMessage,
  isX402BridgeMessage,
  isX402BridgePaymentMessage,
  isX402BridgeRequestMessage,
  parseX402Payload,
  readX402PaymentFromUrl,
  serializeX402ScriptTag,
  X402_BRIDGE_REQUEST,
} = await import(moduleUrl);

test('base64url helpers round-trip unicode JSON', () => {
  const value = JSON.stringify({ message: 'x402 日本語', accepts: [{ network: 'sepolia' }] });
  const encoded = base64UrlEncode(value);
  assert.equal(encoded.includes('+'), false);
  assert.equal(encoded.includes('/'), false);
  assert.equal(encoded.includes('='), false);
  assert.equal(base64UrlDecode(encoded), value);
});

test('createX402WalletUrl encodes payload and handoff metadata', () => {
  const x402 = { paymentRequestId: 'pay_req_1', accepts: [{ scheme: 'exact' }] };
  const url = new URL(createX402WalletUrl({
    walletUrl: 'https://wallet.example/pwa/',
    x402,
    sourceUrl: 'https://merchant.example/article',
    title: 'Article',
    completion: 'fragment',
    completionParam: 'xPayment',
  }));

  assert.equal(url.origin, 'https://wallet.example');
  assert.equal(url.searchParams.get('sourceUrl'), 'https://merchant.example/article');
  assert.equal(url.searchParams.get('title'), 'Article');
  assert.equal(url.searchParams.get('x402Completion'), 'fragment');
  assert.equal(url.searchParams.get('x402CompletionParam'), 'xPayment');
  assert.deepEqual(JSON.parse(base64UrlDecode(url.searchParams.get('x402'))), x402);
});

test('readX402PaymentFromUrl reads hash and configured aliases', () => {
  assert.deepEqual(readX402PaymentFromUrl('https://merchant.example/#xPayment=proof'), {
    xPayment: 'proof',
    param: 'xPayment',
    source: 'hash',
  });
  assert.deepEqual(
    readX402PaymentFromUrl('https://merchant.example/#merchantXPayment=proof', { params: ['merchantXPayment'] }),
    {
      xPayment: 'proof',
      param: 'merchantXPayment',
      source: 'hash',
    },
  );
});

test('parseX402Payload supports direct JSON and script tags', () => {
  const payload = { paymentRequestId: 'pay_req_1', accepts: [] };
  assert.deepEqual(parseX402Payload(JSON.stringify(payload)), payload);
  assert.deepEqual(parseX402Payload(`<main></main>${serializeX402ScriptTag(payload)}`), payload);
});

test('x402 bridge request messages are generic and type guarded', () => {
  const message = createX402BridgeRequest({
    id: 'bridge_req_1',
    sourceUrl: 'https://merchant.example/article',
    title: 'Article',
    x402: { paymentRequestId: 'pay_req_1', accepts: [{ network: 'sepolia', asset: 'token' }] },
    completion: { mode: 'fragment', param: 'xPayment' },
  });

  assert.equal(message.type, X402_BRIDGE_REQUEST);
  assert.equal(message.version, 1);
  assert.equal(message.id, 'bridge_req_1');
  assert.equal(isX402BridgeMessage(message), true);
  assert.equal(isX402BridgeRequestMessage(message), true);
  assert.equal(isX402BridgeDetectedMessage(message), false);
  assert.equal(isX402BridgePaymentMessage(message), false);
});

test('createHazbaseX402Client calls generic requirements and settle endpoints', async () => {
  const calls = [];
  const client = createHazbaseX402Client({
    apiEndpoint: 'https://api.example/',
    requestId: () => 'req_test',
    fetch: async (input, init) => {
      calls.push({ input: String(input), init });
      if (String(input).endsWith('/requirements')) {
        return Response.json({ data: { paymentRequestId: 'pay_req_1', x402: { accepts: [] } } });
      }
      return Response.json({ data: { settled: true, transactionHash: '0xabc' } });
    },
  });

  const requirement = await client.createRequirement({
    resourceId: 'resource-1',
    resourceUrl: 'https://merchant.example/resource-1',
    network: 'sepolia',
    asset: 'token',
    priceAtomic: '1',
    payoutMethod: { kind: 'external_eoa', address: '0x1234567890AbcdEF1234567890aBcdef12345678' },
  });
  const settlement = await client.settlePayment({ paymentRequestId: requirement.paymentRequestId, xPayment: 'proof' });

  assert.equal(requirement.paymentRequestId, 'pay_req_1');
  assert.equal(settlement.settled, true);
  assert.equal(calls[0].input, 'https://api.example/api/payments/x402/requirements');
  assert.equal(calls[1].input, 'https://api.example/api/payments/x402/settle');
  assert.equal(calls[0].init.headers['x-request-id'], 'req_test');
});
