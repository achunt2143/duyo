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

export const accent = '#3fa9f5';
export const muted: CSSProperties = { opacity: 0.65 };

export const rowStyle = (selected: boolean, depth = 0): CSSProperties => ({
  padding: `3px 8px 3px ${8 + depth * 14}px`,
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  background: selected ? 'rgba(63, 169, 245, 0.35)' : undefined,
  userSelect: 'none',
});

export const iconButton: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  padding: '0 4px',
  font: 'inherit',
  opacity: 0.75,
};

export const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid rgba(127,127,127,0.4)',
  background: 'rgba(127,127,127,0.12)',
  color: 'inherit',
  font: 'inherit',
  fontSize: 13,
};
