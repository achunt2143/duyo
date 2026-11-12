import type { HTMLAttributes } from 'react';

const SAFE_EXACT = new Set(['role', 'id', 'title', 'tabindex', 'draggable']);
const NO_ATTRIBUTES: HTMLAttributes<HTMLElement> = Object.freeze({});

/**
 * Filters a component's `attributes` property down to safe, scalar DOM attributes:
 * `data-*` (excluding `data-duyo-*`), `aria-*`, `role`, `id`, `title`, `tabIndex`, and `draggable`.
 */
export function filterAttributes(raw: unknown): HTMLAttributes<HTMLElement> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return NO_ATTRIBUTES;

  const out: Record<string, string | number | boolean> = {};
  let hasAny = false;

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue;
    const lower = key.toLowerCase();

    if (lower.startsWith('data-')) {
      if (lower.startsWith('data-duyo-')) continue;
      out[key] = value;
      hasAny = true;
      continue;
    }

    if (lower.startsWith('aria-')) {
      out[key] = value;
      hasAny = true;
      continue;
    }

    if (SAFE_EXACT.has(lower)) {
      out[lower === 'tabindex' ? 'tabIndex' : key] = value;
      hasAny = true;
    }
  }

  return hasAny ? (out as HTMLAttributes<HTMLElement>) : NO_ATTRIBUTES;
}
