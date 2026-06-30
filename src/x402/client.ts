import { parseX402Payload } from './payload';
import { createX402WalletUrl, readX402PaymentFromUrl } from './url';
import type {
  CreateX402RequirementInput,
  HazbaseX402Client,
  HazbaseX402ClientConfig,
  ReadX402PaymentFromUrlOptions,
  SettleX402PaymentInput,
  X402Fetch,
  X402RequirementResult,
  X402SettlementResult,
  X402WalletHandoffInput,
} from './types';

const DEFAULT_HAZBASE_API_ENDPOINT = 'https://api.hazbase.com';

export class HazbaseX402Error extends Error {
  readonly status?: number;
  readonly body?: unknown;
  readonly code?: string;

  constructor(message: string, options: { status?: number; body?: unknown; code?: string } = {}) {
    super(message);
    this.name = 'HazbaseX402Error';
    this.status = options.status;
    this.body = options.body;
    this.code = options.code;
  }
}

export function createHazbaseX402Client(config: HazbaseX402ClientConfig = {}): HazbaseX402Client {
  const apiEndpoint = normalizeEndpoint(config.apiEndpoint ?? DEFAULT_HAZBASE_API_ENDPOINT);
  const fetcher = resolveFetch(config.fetch);
  const requestId = config.requestId ?? defaultRequestId;

  return {
    async createRequirement(input: CreateX402RequirementInput): Promise<X402RequirementResult> {
      return postJson<X402RequirementResult>({
        fetcher,
        requestId,
        url: `${apiEndpoint}/api/payments/x402/requirements`,
        body: input,
      });
    },

    async settlePayment(input: SettleX402PaymentInput): Promise<X402SettlementResult> {
      return postJson<X402SettlementResult>({
        fetcher,
        requestId,
        url: `${apiEndpoint}/api/payments/x402/settle`,
        body: input,
      });
    },

    createWalletUrl(input: X402WalletHandoffInput): string {
      return createX402WalletUrl(input);
    },

    readPaymentFromUrl(input?: string | URL, options: ReadX402PaymentFromUrlOptions = {}) {
      return readX402PaymentFromUrl(input, {
        params: options.params ?? config.completionParams,
      });
    },

    parsePayload(input: string): Record<string, unknown> | null {
      return parseX402Payload(input);
    },
  };
}

async function postJson<T>(params: {
  fetcher: X402Fetch;
  requestId: () => string;
  url: string;
  body: unknown;
}): Promise<T> {
  const response = await params.fetcher(params.url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-request-id': params.requestId(),
    },
    body: JSON.stringify(params.body),
  });
  return readHazbaseJson<T>(response);
}

async function readHazbaseJson<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new HazbaseX402Error(readErrorMessage(json, response), {
      status: response.status,
      body: json,
      code: readErrorCode(json),
    });
  }
  if (isRecord(json) && 'data' in json) return json.data as T;
  return json as T;
}

function readErrorMessage(body: unknown, response: Response): string {
  if (isRecord(body)) {
    const value = body.message ?? body.error ?? body.reason ?? body.code ?? body.errorCode;
    if (typeof value === 'string' && value) return value;
  }
  return `${response.status} ${response.statusText}`.trim();
}

function readErrorCode(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  const value = body.code ?? body.errorCode;
  return typeof value === 'string' && value ? value : undefined;
}

function normalizeEndpoint(value: string): string {
  return value.trim().replace(/\/+$/g, '') || DEFAULT_HAZBASE_API_ENDPOINT;
}

function resolveFetch(fetcher?: X402Fetch): X402Fetch {
  if (fetcher) return fetcher;
  if (typeof fetch === 'function') return fetch.bind(globalThis);
  throw new HazbaseX402Error('fetch is not available; pass a fetch implementation to createHazbaseX402Client()');
}

function defaultRequestId(): string {
  if (globalThis.crypto?.randomUUID) return `req_${globalThis.crypto.randomUUID()}`;
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
