export function parseX402Payload(input: string): Record<string, unknown> | null {
  const direct = parseJsonRecord(input);
  if (direct) return direct;
  return extractX402PayloadsFromHtml(input)[0] ?? null;
}

export function extractX402PayloadsFromHtml(input: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const pattern = /<script\b[^>]*type=["']application\/x-x402\+json["'][^>]*>([\s\S]*?)<\/script>/giu;
  for (const match of input.matchAll(pattern)) {
    const parsed = parseJsonRecord(unescapeScriptJson(match[1] ?? ''));
    if (parsed) results.push(parsed);
  }
  return results;
}

export function serializeX402ScriptTag(x402: Record<string, unknown>): string {
  return `<script type="application/x-x402+json">${scriptSafeJson(x402)}</script>`;
}

export function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function parseJsonRecord(input: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(input.trim());
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unescapeScriptJson(value: string): string {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
