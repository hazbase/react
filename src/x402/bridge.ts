import type { X402CompletionMode } from './types';

export const X402_BRIDGE_VERSION = 1;
export const X402_BRIDGE_REQUEST = 'hazbase:x402:request';
export const X402_BRIDGE_DETECTED = 'hazbase:x402:detected';
export const X402_BRIDGE_PAYMENT = 'hazbase:x402:payment';
export const X402_BRIDGE_ERROR = 'hazbase:x402:error';

export type X402BridgeMessageType =
  | typeof X402_BRIDGE_REQUEST
  | typeof X402_BRIDGE_DETECTED
  | typeof X402_BRIDGE_PAYMENT
  | typeof X402_BRIDGE_ERROR;

export interface X402BridgeCompletion {
  mode: X402CompletionMode;
  param?: string;
}

export interface X402BridgeRequestInput {
  id?: string;
  sourceUrl: string;
  title?: string;
  x402: Record<string, unknown>;
  completion?: X402BridgeCompletion;
}

export interface X402BridgeWalletInfo {
  name?: string;
  extensionId?: string;
  [key: string]: unknown;
}

export interface X402BridgeCapabilities {
  sidePanel?: boolean;
  pwaHandoff?: boolean;
  postMessagePayment?: boolean;
  [key: string]: unknown;
}

export interface X402BridgeRequestMessage {
  type: typeof X402_BRIDGE_REQUEST;
  version: typeof X402_BRIDGE_VERSION;
  id: string;
  sourceUrl: string;
  title?: string;
  x402: Record<string, unknown>;
  completion?: X402BridgeCompletion;
}

export interface X402BridgeDetectedMessage {
  type: typeof X402_BRIDGE_DETECTED;
  version: typeof X402_BRIDGE_VERSION;
  id?: string;
  wallet?: X402BridgeWalletInfo;
  capabilities?: X402BridgeCapabilities;
}

export interface X402BridgePaymentMessage {
  type: typeof X402_BRIDGE_PAYMENT;
  version: typeof X402_BRIDGE_VERSION;
  id?: string;
  paymentRequestId: string;
  xPayment: string;
}

export interface X402BridgeErrorMessage {
  type: typeof X402_BRIDGE_ERROR;
  version: typeof X402_BRIDGE_VERSION;
  id?: string;
  code: string;
  message?: string;
}

export type X402BridgeMessage =
  | X402BridgeRequestMessage
  | X402BridgeDetectedMessage
  | X402BridgePaymentMessage
  | X402BridgeErrorMessage;

export type X402BridgeMessageHandler = (message: X402BridgeMessage, event: MessageEvent) => void;

export interface PostX402BridgeRequestOptions {
  targetWindow?: Window;
  targetOrigin?: string;
}

export interface ListenForX402BridgeMessagesOptions {
  targetWindow?: Window;
  allowedOrigins?: string[];
  requestId?: string | null;
  sourceWindow?: Window | null;
}

export function createX402BridgeRequest(input: X402BridgeRequestInput): X402BridgeRequestMessage {
  return {
    type: X402_BRIDGE_REQUEST,
    version: X402_BRIDGE_VERSION,
    id: input.id ?? createBridgeId(),
    sourceUrl: input.sourceUrl,
    ...(input.title ? { title: input.title } : {}),
    x402: input.x402,
    ...(input.completion ? { completion: input.completion } : {}),
  };
}

export function postX402BridgeRequest(
  input: X402BridgeRequestInput,
  options: PostX402BridgeRequestOptions = {},
): string {
  const message = createX402BridgeRequest(input);
  const targetWindow = options.targetWindow ?? getCurrentWindow();
  const targetOrigin = options.targetOrigin ?? getCurrentOrigin();
  targetWindow.postMessage(message, targetOrigin);
  return message.id;
}

export function listenForX402BridgeMessages(
  handler: X402BridgeMessageHandler,
  options: ListenForX402BridgeMessagesOptions = {},
): () => void {
  const targetWindow = options.targetWindow ?? getCurrentWindow();
  const listener = (event: MessageEvent) => {
    if (options.allowedOrigins?.length && !options.allowedOrigins.includes(event.origin)) return;
    if (options.sourceWindow !== undefined && event.source !== options.sourceWindow) return;
    if (!isX402BridgeMessage(event.data)) return;
    if (!matchesRequestId(event.data, options.requestId)) return;
    handler(event.data, event);
  };
  targetWindow.addEventListener('message', listener);
  return () => targetWindow.removeEventListener('message', listener);
}

export function isX402BridgeMessage(value: unknown): value is X402BridgeMessage {
  return (
    isX402BridgeRequestMessage(value)
    || isX402BridgeDetectedMessage(value)
    || isX402BridgePaymentMessage(value)
    || isX402BridgeErrorMessage(value)
  );
}

export function isX402BridgeRequestMessage(value: unknown): value is X402BridgeRequestMessage {
  return (
    isBridgeBase(value, X402_BRIDGE_REQUEST)
    && typeof value.id === 'string'
    && typeof value.sourceUrl === 'string'
    && isRecord(value.x402)
    && optionalString(value.title)
    && optionalCompletion(value.completion)
  );
}

export function isX402BridgeDetectedMessage(value: unknown): value is X402BridgeDetectedMessage {
  return (
    isBridgeBase(value, X402_BRIDGE_DETECTED)
    && optionalString(value.id)
    && optionalRecord(value.wallet)
    && optionalRecord(value.capabilities)
  );
}

export function isX402BridgePaymentMessage(value: unknown): value is X402BridgePaymentMessage {
  return (
    isBridgeBase(value, X402_BRIDGE_PAYMENT)
    && optionalString(value.id)
    && typeof value.paymentRequestId === 'string'
    && typeof value.xPayment === 'string'
  );
}

export function isX402BridgeErrorMessage(value: unknown): value is X402BridgeErrorMessage {
  return (
    isBridgeBase(value, X402_BRIDGE_ERROR)
    && optionalString(value.id)
    && typeof value.code === 'string'
    && optionalString(value.message)
  );
}

function createBridgeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `x402_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function getCurrentWindow(): Window {
  if (typeof window === 'undefined') throw new Error('window is not available');
  return window;
}

function getCurrentOrigin(): string {
  if (typeof window === 'undefined') return '*';
  return window.location.origin;
}

function matchesRequestId(message: X402BridgeMessage, requestId?: string | null): boolean {
  if (!requestId) return true;
  if (!('id' in message) || !message.id) return true;
  return message.id === requestId;
}

function isBridgeBase(value: unknown, type: X402BridgeMessageType): value is { type: string; version: number } & Record<string, unknown> {
  return isRecord(value) && value.type === type && value.version === X402_BRIDGE_VERSION;
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function optionalRecord(value: unknown): value is Record<string, unknown> | undefined {
  return value === undefined || isRecord(value);
}

function optionalCompletion(value: unknown): value is X402BridgeCompletion | undefined {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (value.mode === 'fragment' || value.mode === 'none') && optionalString(value.param);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
