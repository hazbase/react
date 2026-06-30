import type {
  ReadX402PaymentFromUrlOptions,
  X402PaymentFromUrl,
  X402WalletHandoffInput,
} from './types';

export const DEFAULT_X402_COMPLETION_PARAMS = ['xPayment', 'x-payment', 'X-PAYMENT', 'x402Payment'];

export function createX402WalletUrl(input: X402WalletHandoffInput): string {
  const url = new URL(input.walletUrl);
  url.searchParams.set('x402', base64UrlEncode(JSON.stringify(input.x402)));
  url.searchParams.set('sourceUrl', input.sourceUrl);
  if (input.title) url.searchParams.set('title', input.title);
  if (input.completion && input.completion !== 'none') url.searchParams.set('x402Completion', input.completion);
  if (input.completionParam) url.searchParams.set('x402CompletionParam', input.completionParam);
  return url.toString();
}

export function readX402PaymentFromUrl(
  input: string | URL = defaultLocationHref(),
  options: ReadX402PaymentFromUrlOptions = {},
): X402PaymentFromUrl | null {
  const url = toUrl(input);
  if (!url) return null;
  const params = options.params?.length ? options.params : DEFAULT_X402_COMPLETION_PARAMS;
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const fromHash = readFirstParam(hashParams, params);
  if (fromHash) return { ...fromHash, source: 'hash' };
  const fromSearch = readFirstParam(url.searchParams, params);
  return fromSearch ? { ...fromSearch, source: 'search' } : null;
}

export function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(value: string): string | null {
  try {
    const normalized = decodeURIComponent(value).replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function readFirstParam(
  searchParams: URLSearchParams,
  params: string[],
): Pick<X402PaymentFromUrl, 'xPayment' | 'param'> | null {
  for (const param of params) {
    const value = searchParams.get(param)?.trim();
    if (value) return { xPayment: value, param };
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

function defaultLocationHref(): string {
  return typeof location === 'undefined' ? '' : location.href;
}
