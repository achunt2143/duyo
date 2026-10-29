import type { KindDefinition } from '@duyo/core';
import type { BindingProps, RendererBinding } from '@duyo/react';
import { useEffect, useRef, useState } from 'react';

import { accent, fieldStyle, rowStyle } from './shared.js';

/**
 * `Designer.Picker`: a list to choose from, inside a dialog. It serves two jobs: choosing a
 * folder on this computer, and choosing one of the user's GitHub repositories.
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
      {pathBar ? (
        <input
          style={{ ...fieldStyle, marginBottom: 8 }}
          aria-label="Folder"
          value={typed}
          placeholder="Type a folder and press Enter"
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              bubble('onGo', { text: typed });
            }
          }}
        />
      ) : (
        <input style={{ ...fieldStyle, marginBottom: 8 }} aria-label="Filter" value={filter} placeholder="Filter" onChange={(event) => setFilter(event.target.value)} />
      )}
      <div
        role="listbox"
        aria-label={pathBar ? 'Folders' : 'Repositories'}
        aria-busy={busy}
        style={{ height: 260, overflowY: 'auto', border: '1px solid rgba(127,127,127,0.35)', borderRadius: 6, padding: 4, boxSizing: 'border-box' }}
      >
        {busy ? <div style={{ opacity: 0.7, padding: 8, fontSize: 13 }}>Loading…</div> : null}
        {!busy && message ? <div style={{ opacity: 0.85, padding: 8, fontSize: 13, whiteSpace: 'pre-wrap' }}>{message}</div> : null}
        {!busy && !message && shown.length === 0 ? <div style={{ opacity: 0.6, padding: 8, fontSize: 13 }}>{pathBar ? 'No folders here.' : 'Nothing matches.'}</div> : null}
        {!busy
          ? shown.map((item) => {
              const on = item.key === selectedKey;
              return (
                <div
                  key={item.key}
                  ref={on ? selected : undefined}
                  role="option"
                  aria-selected={on}
                  data-key={item.key}
                  title={item.subtitle ? `${item.title}: ${item.subtitle}` : item.title}
                  style={{ ...rowStyle(on), display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 8px' }}
                  onClick={() => bubble('onChoose', { key: item.key })}
                  onDoubleClick={() => bubble('onDouble', { key: item.key })}
                >
                  <span style={{ flex: 'none', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                  {item.badge ? <span style={{ flex: 'none', fontSize: 11, padding: '0 6px', borderRadius: 8, border: `1px solid ${accent}`, color: accent }}>{item.badge}</span> : null}
                  {item.subtitle ? <span style={{ flex: 1, minWidth: 0, opacity: 0.6, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.subtitle}</span> : null}
                </div>
              );
            })
          : null}
      </div>
    </div>
  );
}

export const pickerBinding: RendererBinding = { component: Picker };
