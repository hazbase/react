import React from 'react';
import { scriptSafeJson } from '../x402/payload';

export interface X402RequirementScriptProps {
  x402?: Record<string, unknown> | null;
  id?: string;
}

export function X402RequirementScript({ id, x402 }: X402RequirementScriptProps) {
  if (!x402) return null;
  return (
    <script
      {...(id ? { id } : {})}
      data-hazbase-x402="true"
      type="application/x-x402+json"
      dangerouslySetInnerHTML={{ __html: scriptSafeJson(x402) }}
    />
  );
}
