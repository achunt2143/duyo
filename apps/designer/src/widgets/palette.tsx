import type { KindDefinition } from '@duyo/core';
import type { BindingProps, RendererBinding } from '@duyo/react';
import { useState } from 'react';

import type { KindInfo } from '../catalog.js';
import { DRAG_KIND, fieldStyle, rowStyle } from './shared.js';

/**
 * `Designer.Palette`: every kind, grouped, filterable. Click a kind to add it at the
 * selection (`onAdd`), or drag it onto the canvas or the tree.
 */
export const paletteKind: KindDefinition = {
  name: 'Designer.Palette',
  kind: 'duyo.Control',
  published: { revision: 0 },
  events: { onAdd: '' },
};

function Palette({ node, hostProps, bubble }: BindingProps) {
  const kinds = (node['kinds'] as KindInfo[] | undefined) ?? [];
  const [filter, setFilter] = useState('');
  const shown = kinds.filter((k) => !filter || k.name.toLowerCase().includes(filter.toLowerCase()));
  const groups = new Map<string, KindInfo[]>();
  for (const info of shown) groups.set(info.group, [...(groups.get(info.group) ?? []), info]);

  const { onClick: _tap, ...host } = hostProps;
  return (
    <div {...host} style={{ ...hostProps.style, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <input
        style={{ ...fieldStyle, marginBottom: 8 }}
        placeholder="Filter kinds"
        aria-label="Filter kinds"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <div style={{ overflowY: 'auto', minHeight: 0, flex: 1 }} role="list" aria-label="Kinds">
        {[...groups].map(([group, list]) => (
          <div key={group}>
            <div style={{ margin: '10px 0 2px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6 }}>
              {group || 'other'}
            </div>
            {list.map((info) => (
              <div
                key={info.name}
                role="listitem"
                title={`${info.name}: click to add at the selection, or drag`}
                draggable
                data-kind={info.name}
                style={rowStyle(false)}
                onDragStart={(event) => {
                  event.dataTransfer.setData(DRAG_KIND, info.name);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => bubble('onAdd', { kind: info.name })}
              >
                {info.label}
              </div>
            ))}
          </div>
        ))}
        {shown.length === 0 ? <div style={{ opacity: 0.6, padding: 8 }}>No kind matches.</div> : null}
      </div>
      </div>
    </div>
  );
}

export const paletteBinding: RendererBinding = { component: Palette };
