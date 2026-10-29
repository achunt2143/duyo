import type { CSSProperties } from 'react';

/** Drag payloads the designer's widgets exchange. */
export const DRAG_KIND = 'application/x-duyo-kind';
export const DRAG_PATH = 'application/x-duyo-path';

/** Where a drop lands relative to the row or component under the pointer. */
export type DropPlace = 'before' | 'after' | 'inside';

/**
 * Before or after along the axis, or inside when the target holds children and the pointer
 * is in its middle half.
 */
export function placeFor(rect: DOMRect, x: number, y: number, horizontal: boolean, container: boolean): DropPlace {
  const along = horizontal ? (x - rect.left) / Math.max(rect.width, 1) : (y - rect.top) / Math.max(rect.height, 1);
  if (container && along > 0.25 && along < 0.75) return 'inside';
  return along < 0.5 ? 'before' : 'after';
}

/**
 * Colours come from Remochi's theme variables (set by its ThemeWrapper), so the designer
 * follows light and dark, and never carries colours of its own.
 */
export const accent = 'var(--mochi-accent, #69cdff)';
export const accentSoft = 'color-mix(in srgb, var(--mochi-accent, #69cdff) 18%, transparent)';
export const accentStrong = 'color-mix(in srgb, var(--mochi-accent, #69cdff) 55%, transparent)';

/** Wraps a Remochi component so a drag can start on it: Remochi's `Item` does not forward DOM props. */
export const fill: CSSProperties = { width: '100%', minWidth: 0 };
