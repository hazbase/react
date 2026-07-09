export const WALLET_ADDRESS_BRIDGE_VERSION = 1;
export const WALLET_ADDRESS_REQUEST = 'hazbase:wallet:address-request';
export const WALLET_ADDRESS_RESPONSE = 'hazbase:wallet:address-response';

export const DEFAULT_WALLET_ADDRESS_URL_PARAMS = [
  'walletAddress',
  'hazbaseWalletAddress',
];

export type WalletAddressBridgeRequestType = typeof WALLET_ADDRESS_REQUEST;
export type WalletAddressBridgeResponseType = typeof WALLET_ADDRESS_RESPONSE;

export type WalletAddressResultSource = 'extension' | 'pwa' | 'url';

export interface WalletAddressRequestMessage {
  type: typeof WALLET_ADDRESS_REQUEST;
  version: typeof WALLET_ADDRESS_BRIDGE_VERSION;
  id: string;
  purpose?: string;
}

export type WalletAddressBridgeRequestMessage = WalletAddressRequestMessage;

export interface WalletAddressResponseMessage {
  type: typeof WALLET_ADDRESS_RESPONSE;
  version: typeof WALLET_ADDRESS_BRIDGE_VERSION;
  id?: string;
  ok?: boolean;
  address?: string;
  reason?: string;
  source?: WalletAddressResultSource;
}

export interface CreateWalletAddressRequestInput {
  id?: string;
  purpose?: string;
}

export interface PostWalletAddressRequestOptions {
  targetWindow?: Window;
  targetOrigin?: string;
}

export interface ListenForWalletAddressResponsesOptions {
  targetWindow?: Window;
  allowedOrigins?: string[];
  requestId?: string | null;
  sourceWindow?: Window | null;
}

export interface CreateWalletAddressUrlInput {
  walletUrl: string;
  returnUrl: string;
  returnUrlParam?: string;
}

export interface WalletAddressFromUrl {
  address: string;
  param: string;
  source: 'hash' | 'search';
}

export interface ReadWalletAddressFromUrlOptions {
  params?: string[];
}

export type RequestWalletAddressFailureReason =
  | 'timeout'
  | 'pwa_redirect'
  | 'invalid_response'
  | 'unsupported'
  | 'cancelled';

export type RequestWalletAddressResult =
  | {
      ok: true;
      address: string;
      source: WalletAddressResultSource;
      message: WalletAddressResponseMessage;
    }
  | {
      ok: false;
      reason: RequestWalletAddressFailureReason;
      message?: string;
      walletUrl?: string;
    };

export interface RequestWalletAddressOptions {
  walletUrl?: string;
  returnUrl?: string;
  returnUrlParam?: string;
  purpose?: string;
  timeoutMs?: number;
  retryIntervalMs?: number;
  targetWindow?: Window;
  targetOrigin?: string;
  allowedOrigins?: string[];
  sourceWindow?: Window | null;
  fallbackToPwa?: boolean;
  pwaTarget?: '_self' | '_blank';
}

export type WalletAddressResponseHandler = (message: WalletAddressResponseMessage, event: MessageEvent) => void;

export function normalizeWalletAddress(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/u.test(normalized) ? normalized : '';
}

export function shortWalletAddress(value: unknown, start = 6, end = 4): string {
  const normalized = normalizeWalletAddress(value);
  if (!normalized) return '';
  return normalized.length > start + end ? `${normalized.slice(0, start)}...${normalized.slice(-end)}` : normalized;
}

export function createWalletAddressRequest(input: CreateWalletAddressRequestInput = {}): WalletAddressRequestMessage {
  return {
    type: WALLET_ADDRESS_REQUEST,
    version: WALLET_ADDRESS_BRIDGE_VERSION,
    id: input.id ?? createWalletBridgeId(),
    ...(input.purpose ? { purpose: input.purpose } : {}),
  };
}

export function postWalletAddressRequest(
  input: CreateWalletAddressRequestInput = {},
  options: PostWalletAddressRequestOptions = {},
): string {
  const id = input.id ?? createWalletBridgeId();
  const targetWindow = options.targetWindow ?? getCurrentWindow();
  const targetOrigin = options.targetOrigin ?? getCurrentOrigin();
  targetWindow.postMessage(createWalletAddressRequest({ ...input, id }), targetOrigin);
  return id;
}

export function listenForWalletAddressResponses(
  handler: WalletAddressResponseHandler,
  options: ListenForWalletAddressResponsesOptions = {},
): () => void {
  const targetWindow = options.targetWindow ?? getCurrentWindow();
  const listener = (event: MessageEvent) => {
    if (options.allowedOrigins?.length && !options.allowedOrigins.includes(event.origin)) return;
    if (options.sourceWindow !== undefined && event.source !== options.sourceWindow) return;
    if (!isWalletAddressResponseMessage(event.data)) return;
    if (!matchesWalletRequestId(event.data, options.requestId)) return;
    handler(event.data, event);
  };
  targetWindow.addEventListener('message', listener);
  return () => targetWindow.removeEventListener('message', listener);
}

export function isWalletAddressResponseMessage(value: unknown): value is WalletAddressResponseMessage {
  if (!isRecord(value)) return false;
  if (value.version !== WALLET_ADDRESS_BRIDGE_VERSION) return false;
  if (value.type !== WALLET_ADDRESS_RESPONSE) return false;
  return optionalString(value.id)
    && optionalBoolean(value.ok)
    && optionalString(value.address)
    && optionalString(value.reason)
    && optionalString(value.source);
}

export function createWalletAddressUrl(input: CreateWalletAddressUrlInput): string {
  const url = new URL(input.walletUrl);
  url.searchParams.set(input.returnUrlParam ?? 'walletAddressReturnUrl', input.returnUrl);
  return url.toString();
}

export function readWalletAddressFromUrl(
  input: string | URL = defaultLocationHref(),
  options: ReadWalletAddressFromUrlOptions = {},
): WalletAddressFromUrl | null {
  const url = toUrl(input);
  if (!url) return null;
  const params = options.params?.length ? options.params : DEFAULT_WALLET_ADDRESS_URL_PARAMS;
  const hashParams = new URLSearchParams(url.hash.replace(/^#/u, ''));
  const fromHash = readFirstWalletAddressParam(hashParams, params);
  if (fromHash) return { ...fromHash, source: 'hash' };
  const fromSearch = readFirstWalletAddressParam(url.searchParams, params);
  return fromSearch ? { ...fromSearch, source: 'search' } : null;
}

export function requestWalletAddress(options: RequestWalletAddressOptions = {}): Promise<RequestWalletAddressResult> {
  const targetWindow = options.targetWindow ?? safeCurrentWindow();
  if (!targetWindow) {
    return Promise.resolve({ ok: false, reason: 'unsupported', message: 'window is not available' });
  }

  const timeoutMs = Math.max(1, Number(options.timeoutMs ?? 2500));
  const retryIntervalMs = Math.max(1, Number(options.retryIntervalMs ?? 300));
  const targetOrigin = options.targetOrigin ?? getCurrentOrigin();
  const requestId = createWalletBridgeId();

  return new Promise((resolve) => {
    let settled = false;
    let retryTimer: ReturnType<typeof setInterval> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let cleanupResponse: (() => void) | null = null;

    const cleanup = () => {
      if (retryTimer) clearInterval(retryTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      cleanupResponse?.();
      retryTimer = null;
      timeoutTimer = null;
      cleanupResponse = null;
    };

    const finish = (result: RequestWalletAddressResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const postRequest = () => {
      if (settled) return;
      postWalletAddressRequest({
        id: requestId,
        ...(options.purpose ? { purpose: options.purpose } : {}),
      }, {
        targetWindow,
        targetOrigin,
      });
    };

    cleanupResponse = listenForWalletAddressResponses((message) => {
      const address = normalizeWalletAddress(message.address);
      if (message.ok === true && address) {
        finish({
          ok: true,
          address,
          source: message.source ?? 'extension',
          message,
        });
        return;
      }
      if (message.ok === false) {
        finish({
          ok: false,
          reason: 'invalid_response',
          message: message.reason || 'wallet returned an error',
        });
      }
    }, {
      targetWindow,
      allowedOrigins: options.allowedOrigins,
      requestId,
      sourceWindow: options.sourceWindow,
    });

    postRequest();
    retryTimer = setInterval(postRequest, retryIntervalMs);
    timeoutTimer = setTimeout(() => {
      if (options.fallbackToPwa !== false && options.walletUrl) {
        const returnUrl = options.returnUrl ?? defaultLocationHref();
        const walletUrl = createWalletAddressUrl({
          walletUrl: options.walletUrl,
          returnUrl,
          ...(options.returnUrlParam ? { returnUrlParam: options.returnUrlParam } : {}),
        });
        try {
          if (options.pwaTarget === '_blank') {
            targetWindow.open(walletUrl, '_blank', 'noopener,noreferrer');
          } else {
            targetWindow.location.assign(walletUrl);
          }
        } catch {
          // The caller still receives the URL and can navigate manually.
        }
        finish({ ok: false, reason: 'pwa_redirect', walletUrl });
        return;
      }
      finish({ ok: false, reason: 'timeout' });
    }, timeoutMs);
  });
}

function createWalletBridgeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `wallet_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function getCurrentWindow(): Window {
  if (typeof window === 'undefined') throw new Error('window is not available');
  return window;
}

function safeCurrentWindow(): Window | null {
  return typeof window === 'undefined' ? null : window;
}

function getCurrentOrigin(): string {
  if (typeof window === 'undefined') return '*';
  return window.location.origin;
}

function defaultLocationHref(): string {
  return typeof location === 'undefined' ? '' : location.href;
}

function matchesWalletRequestId(message: WalletAddressResponseMessage, requestId?: string | null): boolean {
  if (!requestId) return true;
  return message.id === requestId;
}

function readFirstWalletAddressParam(
  searchParams: URLSearchParams,
  params: string[],
): Pick<WalletAddressFromUrl, 'address' | 'param'> | null {
  for (const param of params) {
    const address = normalizeWalletAddress(searchParams.get(param));
    if (address) return { address, param };
  }
  return null;
}

function toUrl(input: string | URL): URL | null {
  if (input instanceof URL) return input;
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function optionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean';
}
