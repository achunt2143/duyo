import type { KindDefinition } from '@duyo/core';
import type { BindingProps, RendererBinding } from '@duyo/react';
import { Collapsable, Input } from './remochi.js';
import { Row, Rows } from './rows.js';
import { useState } from 'react';

import type { KindInfo } from '../catalog.js';
import { DRAG_KIND, fill } from './shared.js';

/**
 * `Designer.Palette`: every kind, in Remochi `Collapsable` groups of `ListItem` rows, with a Remochi
 * `Input` to filter. Click a kind to add it at the selection (`onAdd`), or drag it onto the
 * canvas or the tree.
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
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const shown = kinds.filter((k) => !filter || k.name.toLowerCase().includes(filter.toLowerCase()));
  const groups = new Map<string, KindInfo[]>();
  for (const info of shown) groups.set(info.group, [...(groups.get(info.group) ?? []), info]);

  const { onClick: _tap, ...host } = hostProps;
  return (
    <div {...host} style={{ ...hostProps.style, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div style={{ flex: 'none', marginBottom: 8 }}>
          <Input value={filter} placeholder="Filter kinds" aria-label="Filter kinds" style={fill} onChange={(event: { target: { value: string } }) => setFilter(event.target.value)} />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Rows>
            {[...groups].map(([group, list]) => {
              const open = !!filter || !closed.has(group);
              return (
                <Collapsable
                  key={group}
                  title={group || 'other'}
                  isOpen={open}
                  onToggle={(next: boolean) => {
                    const copy = new Set(closed);
                    if (next) copy.delete(group);
                    else copy.add(group);
                    setClosed(copy);
                  }}
                >
                  {list.map((info) => (
                    <div
                      key={info.name}
                      data-kind={info.name}
                      draggable
                      title={`${info.name}: click to add at the selection, or drag`}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(DRAG_KIND, info.name);
                        event.dataTransfer.effectAllowed = 'copy';
                      }}
                    >
                      <Row onClick={() => bubble('onAdd', { kind: info.name })}>{info.label}</Row>
                    </div>
                  ))}
                </Collapsable>
              );
            })}
            {shown.length === 0 ? <Row dim>No kind matches.</Row> : null}
          </Rows>
        </div>
      </div>
    </div>
  );
}

export const paletteBinding: RendererBinding = { component: Palette };
