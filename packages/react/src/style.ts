import type { CSSProperties } from 'react';

/** Splits on `;` outside parentheses, so `url(data:...;base64,...)` survives. */
function declarations(source: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ';' && depth === 0) {
      out.push(source.slice(start, i));
      start = i + 1;
    }
  }
  out.push(source.slice(start));
  return out;
}

/**
 * Enyo-style inline style string -> React style object.
 * `"padding: 8px; background-color: red"` -> `{ padding: '8px', backgroundColor: 'red' }`.
 * Custom properties (`--x`) keep their name.
 */
export function parseStyle(source: unknown): CSSProperties {
  if (typeof source !== 'string' || source.trim() === '') return {};
  const style: Record<string, string> = {};
  for (const declaration of declarations(source)) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (!property || !value) continue;
    const key = property.startsWith('--')
      ? property
      : property.toLowerCase().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    style[key] = value;
  }
  return style as CSSProperties;
}
