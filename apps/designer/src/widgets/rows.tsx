import type { HTMLAttributes, ReactNode } from 'react';

import '../lists.css';
import { Badge, List, ListItem } from './remochi.js';

/**
 * The designer's list rows: Remochi's `ListItem` inside a `List`, the webOS list look, with the
 * content laid out as a glyph, a label that takes the room, and a hint or `Badge` at the right
 * edge. Hierarchy shows as indentation; the selected row takes the theme's accent.
 *
 * Remochi's `Item` (a card) is better for a few rich rows (a name, a description and a badge);
 * this is for lists of many plain rows, where cards nest and clutter.
 */
export interface RowProps extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'title' | 'onSelect'> {
  depth?: number;
  selected?: boolean;
  /** Shown faintly, as for a generated file. */
  dim?: boolean;
  glyph?: ReactNode;
  /** Small text at the right edge. */
  hint?: string;
  badge?: { text: string; variant: string };
  /** Turns the row's glyph to point down, for an open folder. */
  open?: boolean;
  children: ReactNode;
}

export function Row({ depth = 0, selected, dim, glyph, hint, badge, open, children, className, style, ...rest }: RowProps) {
  const classes = [className, selected ? 'duyo-selected' : '', dim ? 'duyo-dim' : ''].filter(Boolean).join(' ');
  return (
    <ListItem className={classes} style={{ paddingLeft: 10 + depth * 16, ...style }} {...rest}>
      <div className="duyo-row">
        {glyph !== undefined ? (
          <span className="glyph" style={open ? { transform: 'rotate(90deg)' } : undefined}>
            {glyph}
          </span>
        ) : null}
        <span className="grow">{children}</span>
        {hint ? <span className="hint">{hint}</span> : null}
        {badge ? <Badge variant={badge.variant}>{badge.text}</Badge> : null}
      </div>
    </ListItem>
  );
}

/** A Remochi `List` of rows, scoped so the row styling applies. */
export function Rows({ children }: { children: ReactNode }) {
  return (
    <div className="duyo-list">
      <List>{children}</List>
    </div>
  );
}
