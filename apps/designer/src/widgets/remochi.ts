import type { ComponentType, ReactNode } from 'react';
import * as R from 'remochi';

/**
 * Remochi components, typed as their source behaves. Remochi 0.4.0's typings trail its source
 * (see "Remochi notes" in packages/remochi/README.md): they lack `Badge.children` and
 * `variant`, `Collapsable.isOpen`, `PopupPanel.anchorEl`, and a `ReactNode` as a `ViewSelectButton` item's content.
 * Re-declaring them here keeps the designer's widgets free of casts.
 */
export const { Button, Input, Item, List, ListHeader, ListItem, Subheader } = R;

export const Badge = R.Badge as unknown as ComponentType<{ children?: ReactNode; variant?: string; count?: number }>;

export const Collapsable = R.Collapsable as unknown as ComponentType<{
  title: string;
  isOpen?: boolean;
  defaultExpanded?: boolean;
  onToggle?: (open: boolean) => void;
  children?: ReactNode;
}>;

export const ViewSelectButton = R.ViewSelectButton as unknown as ComponentType<{
  items: Array<{ content: ReactNode; active?: boolean; disabled?: boolean }>;
  onSelect?: (item: unknown, index: number) => void;
  variant?: string;
}>;

export const PopupPanel = R.PopupPanel as unknown as ComponentType<{
  isOpen: boolean;
  title?: string;
  /** A ref-like to the element the popup points at. */
  anchorEl?: { current: HTMLElement | null };
  anchorRect?: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  actions?: Array<{ label: string; type?: string; onClick: () => void }>;
  onClose: () => void;
  children?: ReactNode;
}>;
