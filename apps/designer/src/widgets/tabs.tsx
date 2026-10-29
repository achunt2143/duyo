import type { KindDefinition } from '@duyo/core';
import type { BindingProps, RendererBinding } from '@duyo/react';

import { accent, iconButton } from './shared.js';

/**
 * `Designer.Tabs`: the open documents. A dot marks unsaved changes.
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
  return (
    <div {...host} role="tablist" style={{ display: 'flex', gap: 2, overflowX: 'auto', minHeight: 32, ...hostProps.style }}>
      {items.map((item) => {
        const on = item.key === active;
        return (
          <div
            key={item.key}
            role="tab"
            aria-selected={on}
            title={item.title}
            data-key={item.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 6px 4px 12px',
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              borderBottom: `2px solid ${on ? accent : 'transparent'}`,
              opacity: on ? 1 : 0.7,
            }}
            onClick={() => bubble('onActivate', { key: item.key })}
            onAuxClick={(event) => event.button === 1 && bubble('onClose', { key: item.key })}
          >
            <span>{item.label}</span>
            <button
              type="button"
              style={{ ...iconButton, width: 18 }}
              aria-label={`Close ${item.label}`}
              title={item.dirty ? 'Unsaved changes' : 'Close'}
              onClick={(event) => {
                event.stopPropagation();
                bubble('onClose', { key: item.key });
              }}
            >
              {item.dirty ? '●' : '×'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export const tabsBinding: RendererBinding = { component: Tabs };
