import type { KindDefinition } from '@duyo/core';
import type { BindingProps, RendererBinding } from '@duyo/react';
import { ViewSelectButton } from './remochi.js';

/**
 * `Designer.Tabs`: the open documents, as a Remochi `ViewSelectButton`: the same sliding
 * selection bar as the mode switch beside it. A dot marks unsaved changes; the × closes one.
 *
 *   onActivate { key }   onClose { key }
 */
export interface TabItem {
  key: string;
  label: string;
  title: string;
  dirty: boolean;
}

export const tabsKind: KindDefinition = {
  name: 'Designer.Tabs',
  kind: 'duyo.Control',
  published: { revision: 0, active: '' },
  events: { onActivate: '', onClose: '' },
};

function Tabs({ node, hostProps, bubble }: BindingProps) {
  const items = (node['items'] as TabItem[] | undefined) ?? [];
  const active = String(node.get('active') ?? '');
  const { onClick: _tap, ...host } = hostProps;
  if (items.length === 0) return <div {...host} role="tablist" />;

  return (
    <div {...host} role="tablist" style={{ ...hostProps.style, overflowX: 'auto' }}>
      <ViewSelectButton
        items={items.map((item) => ({
          active: item.key === active,
          content: (
            <span title={item.title} data-key={item.key} role="tab" aria-selected={item.key === active}>
              {item.label}
              <span
                role="button"
                aria-label={`Close ${item.label}`}
                title={item.dirty ? 'Unsaved changes: close…' : 'Close'}
                style={{ marginLeft: 8, opacity: 0.7 }}
                onClick={(event) => {
                  event.stopPropagation();
                  bubble('onClose', { key: item.key });
                }}
              >
                {item.dirty ? '●' : '×'}
              </span>
            </span>
          ),
        }))}
        onSelect={(_item: unknown, index: number) => {
          const item = items[index];
          if (item) bubble('onActivate', { key: item.key });
        }}
      />
    </div>
  );
}

export const tabsBinding: RendererBinding = { component: Tabs };
