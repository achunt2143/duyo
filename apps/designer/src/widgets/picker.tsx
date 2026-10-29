import type { KindDefinition } from '@duyo/core';
import type { BindingProps, RendererBinding } from '@duyo/react';
import { Badge, Input, Item, List } from './remochi.js';
import { Row, Rows } from './rows.js';
import { useEffect, useRef, useState } from 'react';

import { fill } from './shared.js';

/**
 * `Designer.Picker`: a list to choose from, inside a dialog, built from a Remochi `Input`
 * and a `List`: `ListItem` rows for folders, `Item` cards (a name, a description and a badge)
 * for repositories. It serves two jobs: choosing a folder on this
 * computer, and choosing one of the user's GitHub repositories.
 *
 * The host sets `items` (`{ key, title, subtitle?, badge? }`) and `message` (shown instead of
 * the list when there is nothing to list, or why), and reads `selectedKey`. With `pathBar`,
 * the current location is an editable field; without, a filter box narrows the list.
 *
 *   onChoose { key }    a row was clicked
 *   onGo { text }       the path was typed and entered
 *   onDouble { key }    a row was double-clicked
 */
export interface PickerItem {
  key: string;
  title: string;
  subtitle?: string;
  badge?: string;
}

export const pickerKind: KindDefinition = {
  name: 'Designer.Picker',
  kind: 'duyo.Control',
  published: { revision: 0, selectedKey: '', pathBar: false, location: '', busy: false },
  events: { onChoose: '', onGo: '', onDouble: '' },
};

const BADGES: Record<string, string> = { project: 'success', git: 'info', private: 'warning' };

function Picker({ node, hostProps, bubble }: BindingProps) {
  const items = (node['items'] as PickerItem[] | undefined) ?? [];
  const message = String(node['message'] ?? '');
  const selectedKey = String(node.get('selectedKey') ?? '');
  const pathBar = node.get('pathBar') === true;
  const location = String(node.get('location') ?? '');
  const busy = node.get('busy') === true;
  const [filter, setFilter] = useState('');
  const [typed, setTyped] = useState(location);
  const selected = useRef<HTMLDivElement>(null);

  // A navigation elsewhere replaces what was typed.
  useEffect(() => setTyped(location), [location]);
  useEffect(() => {
    selected.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedKey]);

  const shown = pathBar || !filter ? items : items.filter((i) => `${i.title} ${i.subtitle ?? ''}`.toLowerCase().includes(filter.toLowerCase()));
  const { onClick: _tap, ...host } = hostProps;

  return (
    <div {...host} style={{ ...hostProps.style, width: '100%', minWidth: 0 }}>
      <div style={{ marginBottom: 8 }}>
        {pathBar ? (
          <Input
            aria-label="Folder"
            style={fill}
            value={typed}
            placeholder="Type a folder and press Enter"
            onChange={(event: { target: { value: string } }) => setTyped(event.target.value)}
            onKeyDown={(event: { key: string; preventDefault(): void }) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                bubble('onGo', { text: typed });
              }
            }}
          />
        ) : (
          <Input aria-label="Filter" style={fill} value={filter} placeholder="Filter" onChange={(event: { target: { value: string } }) => setFilter(event.target.value)} />
        )}
      </div>
      <div role="listbox" aria-label={pathBar ? 'Folders' : 'Repositories'} aria-busy={busy} style={{ height: 260 }}>
        {pathBar ? (
          <Rows>
            {busy ? <Row dim>Loading…</Row> : null}
            {!busy && message ? <Row dim>{message}</Row> : null}
            {!busy && !message && shown.length === 0 ? <Row dim>No folders here.</Row> : null}
            {!busy
              ? shown.map((item) => (
                  <div key={item.key} role="option" aria-selected={false} data-key={item.key}>
                    <Row
                      {...(item.subtitle ? { hint: item.subtitle } : {})}
                      {...(item.badge ? { badge: { text: item.badge, variant: BADGES[item.badge] ?? 'default' } } : {})}
                      onClick={() => bubble('onChoose', { key: item.key })}
                    >
                      {item.title}
                    </Row>
                  </div>
                ))
              : null}
          </Rows>
        ) : (
          <List>
            {busy ? <Item title="Loading…" disabled /> : null}
            {!busy && message ? <Item title={message} disabled /> : null}
            {!busy && !message && shown.length === 0 ? <Item title="Nothing matches." disabled /> : null}
            {!busy
              ? shown.map((item) => {
                  const on = item.key === selectedKey;
                  return (
                    <div key={item.key} ref={on ? selected : undefined} role="option" aria-selected={on} data-key={item.key} onDoubleClick={() => bubble('onDouble', { key: item.key })}>
                      <Item
                        title={item.title}
                        subtitle={item.subtitle}
                        selected={on}
                        rightContent={item.badge ? <Badge variant={BADGES[item.badge] ?? 'default'}>{item.badge}</Badge> : undefined}
                        onClick={() => bubble('onChoose', { key: item.key })}
                      />
                    </div>
                  );
                })
              : null}
          </List>
        )}
      </div>
    </div>
  );
}

export const pickerBinding: RendererBinding = { component: Picker };
